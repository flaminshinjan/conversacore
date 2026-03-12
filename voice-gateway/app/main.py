from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, metrics, token
from app.api.websocket import websocket_handler
from app.core.config import get_config
from app.core.logging import configure_logging
from app.infra.redis_client import close_redis, init_redis
from app.sessions.manager import SessionManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_dotenv()
    cfg = get_config()
    configure_logging(cfg["log_level"])
    redis = await init_redis()
    app.state.redis = redis
    app.state.session_manager = SessionManager()
    yield
    await close_redis()


app = FastAPI(title="Voice Gateway", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(token.router, tags=["token"])
app.include_router(health.router, tags=["health"])
app.include_router(metrics.router, tags=["metrics"])


@app.websocket("/ws/talk")
async def ws_talk(websocket: WebSocket):
    await websocket_handler(websocket)