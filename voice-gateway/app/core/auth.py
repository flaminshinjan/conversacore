import time

import jwt

from app.core.config import get_config


def create_token(user_id: str) -> str:
    cfg = get_config()
    payload = {
        "sub": user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + cfg["jwt_expiry_seconds"],
    }
    return jwt.encode(
        payload,
        cfg["jwt_secret"],
        algorithm=cfg["jwt_algorithm"],
    )


def verify_token(token: str) -> str | None:
    cfg = get_config()
    try:
        payload = jwt.decode(
            token,
            cfg["jwt_secret"],
            algorithms=[cfg["jwt_algorithm"]],
        )
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
