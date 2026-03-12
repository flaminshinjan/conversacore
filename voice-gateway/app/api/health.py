from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis

router = APIRouter()


def _get_redis(request: Request) -> Redis:
    return request.app.state.redis


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/ready")
async def ready(redis: Redis = Depends(_get_redis)):
    try:
        await redis.ping()
        return {"status": "ready"}
    except Exception:
        return {"status": "not_ready"}
