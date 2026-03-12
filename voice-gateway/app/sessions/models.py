from dataclasses import dataclass
from enum import Enum

from fastapi import WebSocket


class SessionState(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    TEARDOWN = "teardown"


@dataclass
class VoiceSession:
    session_id: str
    user_id: str
    websocket: WebSocket
    started_at: float
