import os
from functools import lru_cache


@lru_cache
def get_config():
    return {
        "jwt_secret": os.getenv("JWT_SECRET", "dev-secret-change-in-production"),
        "jwt_algorithm": os.getenv("JWT_ALGORITHM", "HS256"),
        "jwt_expiry_seconds": int(os.getenv("JWT_EXPIRY_SECONDS", "3600")),
        "redis_url": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        "log_level": os.getenv("LOG_LEVEL", "INFO"),
        "concurrency_cap_per_user": int(os.getenv("CONCURRENCY_CAP_PER_USER", "2")),
        "deepgram_api_key": os.getenv("DEEPGRAM_API_KEY", ""),
        "openai_api_key": os.getenv("OPENAI_API_KEY", ""),
        "cartesia_api_key": os.getenv("CARTESIA_API_KEY", ""),
        "cartesia_voice_id": os.getenv("CARTESIA_VOICE_ID", "71a7ad14-091c-4e8e-a314-022ece01c121"),
    }
