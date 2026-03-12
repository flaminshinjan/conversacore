from pathlib import Path

from redis.asyncio import Redis

from app.core.config import get_config

LUA_DIR = Path(__file__).resolve().parent / "lua"
ADMIT_SCRIPT = (LUA_DIR / "admit_session.lua").read_text()
RELEASE_SCRIPT = (LUA_DIR / "release_session.lua").read_text()


async def admit_session(redis: Redis, user_id: str, session_id: str) -> bool:
    cfg = get_config()
    cap = cfg["concurrency_cap_per_user"]
    ttl = 7200
    user_key = f"user:{user_id}:active_calls"
    session_key = f"session:{session_id}:lease"
    script = redis.register_script(ADMIT_SCRIPT)
    result = await script(keys=[user_key, session_key], args=[cap, ttl])
    return result == 1


async def release_session(redis: Redis, user_id: str, session_id: str) -> None:
    user_key = f"user:{user_id}:active_calls"
    session_key = f"session:{session_id}:lease"
    script = redis.register_script(RELEASE_SCRIPT)
    await script(keys=[user_key, session_key])
