import asyncio
import time

import structlog
from fastapi import WebSocket, WebSocketDisconnect

from app.core.auth import verify_token
from app.infra.metrics import concurrency_rejections_total, quota_rejections_total, ws_connections_active
from app.pipeline.factory import create_pipeline
from app.sessions.manager import SessionManager

log = structlog.get_logger()


def _get_token(websocket: WebSocket) -> str | None:
    query = websocket.scope.get("query_string", b"").decode()
    for part in query.split("&"):
        if "=" in part:
            k, v = part.split("=", 1)
            if k.strip().lower() == "access_token":
                return v.strip()
    return None


async def _extract_user_id(websocket: WebSocket) -> str | None:
    token = _get_token(websocket)
    if token:
        return verify_token(token)
    for name, value in websocket.scope.get("headers", []):
        if name.lower() == b"authorization":
            val = value.decode()
            if val.lower().startswith("bearer "):
                return verify_token(val[7:].strip())
    return None


async def websocket_handler(websocket: WebSocket):
    await websocket.accept()
    user_id = await _extract_user_id(websocket)
    if not user_id:
        await websocket.close(code=4000, reason="unauthorized")
        return

    app = websocket.app
    manager: SessionManager = app.state.session_manager
    redis = app.state.redis
    session, reject_reason = await manager.create_session(redis, user_id, websocket)
    if session is None:
        if reject_reason == "quota":
            quota_rejections_total.inc()
            await websocket.close(code=4001, reason="policy_violation: quota_exceeded")
        else:
            concurrency_rejections_total.inc()
            await websocket.close(code=4001, reason="policy_violation: concurrency_cap_exceeded")
        return

    ws_connections_active.inc()
    try:
        log.info(
            "session_started",
            session_id=session.session_id,
            user_id=user_id,
        )
        # Mandatory 160ms throttle to prevent race conditions in session loop (spec)
        await asyncio.get_running_loop().run_in_executor(None, time.sleep, 0.16)
        runner, task = create_pipeline(websocket, usage_tracker=session.usage)
        await runner.run(task)
    except ValueError as e:
        log.error("pipeline_config_error", error=str(e))
        await websocket.close(code=1011, reason="server_error")
    except WebSocketDisconnect:
        pass
    finally:
        ws_connections_active.dec()
        sess = manager.get_by_ws(websocket)
        if sess:
            await manager.remove_session(redis, sess)
