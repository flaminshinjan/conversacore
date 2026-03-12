from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.auth import create_token
from app.core.ids import new_user_id

router = APIRouter()


class TokenRequest(BaseModel):
    user_id: str | None = None


class TokenResponse(BaseModel):
    token: str


@router.post("/token", response_model=TokenResponse)
async def token(req: TokenRequest | None = None):
    user_id = (req.user_id if req else None) or new_user_id()
    tok = create_token(user_id)
    return TokenResponse(token=tok)
