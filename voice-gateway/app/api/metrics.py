from fastapi import APIRouter
from prometheus_client import generate_latest
from starlette.responses import Response

router = APIRouter()


@router.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
