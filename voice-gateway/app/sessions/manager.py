import time

import structlog
from redis.asyncio import Redis

from app.core.ids import new_session_id
from app.infra.metrics import session_duration_seconds, session_teardowns_total
from app.infra.rate_limit import admit_session, release_session
from app.sessions.models import VoiceSession

log = structlog.get_logger()


class SessionManager:
    def __init__(self):
        self._sessions: dict[str, VoiceSession] = {}
        self._ws_index: dict[int, str] = {}

    async def create_session(
        self, redis: Redis, user_id: str, websocket
    ) -> VoiceSession | None:
        session_id = new_session_id()
        admitted = await admit_session(redis, user_id, session_id)
        if not admitted:
            return None
        session = VoiceSession(
            session_id=session_id,
            user_id=user_id,
            websocket=websocket,
            started_at=time.monotonic(),
        )
        self._sessions[session_id] = session
        self._ws_index[id(websocket)] = session_id
        return session

    def get_by_ws(self, websocket) -> VoiceSession | None:
        sid = self._ws_index.get(id(websocket))
        return self._sessions.get(sid) if sid else None

    async def remove_session(self, redis: Redis, session: VoiceSession) -> None:
        session_id = session.session_id
        user_id = session.user_id
        ws = session.websocket
        if session_id in self._sessions:
            del self._sessions[session_id]
        self._ws_index.pop(id(ws), None)
        await release_session(redis, user_id, session_id)
        duration = time.monotonic() - session.started_at
        session_duration_seconds.observe(duration)
        session_teardowns_total.labels(reason="disconnect").inc()
        log.info(
            "session_teardown",
            session_id=session_id,
            user_id=user_id,
            duration_seconds=round(duration, 2),
        )
