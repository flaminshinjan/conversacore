from dataclasses import dataclass, field
from enum import Enum

from fastapi import WebSocket

from app.usage.tracker import UsageTracker


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
    usage: UsageTracker = field(default_factory=UsageTracker)
