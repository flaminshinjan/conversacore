from datetime import date
from pathlib import Path

from redis.asyncio import Redis

from app.core.config import get_config

LUA_DIR = Path(__file__).resolve().parent / "lua"
ADMIT_SCRIPT = (LUA_DIR / "admit_session.lua").read_text()
RELEASE_SCRIPT = (LUA_DIR / "release_session.lua").read_text()
CHECK_QUOTA_SCRIPT = (LUA_DIR / "check_quota.lua").read_text()
ADD_USAGE_SCRIPT = (LUA_DIR / "add_usage.lua").read_text()


def _quota_keys(user_id: str) -> tuple[str, str, str]:
    d = date.today().strftime("%Y-%m-%d")
    return (
        f"quota:{user_id}:{d}:stt_seconds",
        f"quota:{user_id}:{d}:llm_tokens",
        f"quota:{user_id}:{d}:tts_chars",
    )


async def check_quota_ok(redis: Redis, user_id: str) -> bool:
    cfg = get_config()
    keys = _quota_keys(user_id)
    script = redis.register_script(CHECK_QUOTA_SCRIPT)
    result = await script(
        keys=keys,
        args=[
            cfg["quota_stt_seconds_per_day"],
            cfg["quota_llm_tokens_per_day"],
            cfg["quota_tts_chars_per_day"],
        ],
    )
    return result == 1


async def add_usage(
    redis: Redis, user_id: str, stt_seconds: float, llm_tokens: int, tts_chars: int
) -> None:
    keys = _quota_keys(user_id)
    ttl = 86400 * 2  # 2 days
    script = redis.register_script(ADD_USAGE_SCRIPT)
    await script(
        keys=keys,
        args=[str(stt_seconds), str(llm_tokens), str(tts_chars), str(ttl)],
    )


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
