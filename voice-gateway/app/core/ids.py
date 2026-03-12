import secrets


def new_session_id() -> str:
    return f"sess_{secrets.token_hex(16)}"


def new_user_id() -> str:
    return f"user_{secrets.token_hex(12)}"
