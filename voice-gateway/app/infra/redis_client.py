from redis.asyncio import Redis

from app.core.config import get_config

_redis: Redis | None = None


async def init_redis() -> Redis:
    global _redis
    cfg = get_config()
    _redis = Redis.from_url(cfg["redis_url"])
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


