from app.core.config import get_config


def estimate_cost(
    stt_seconds: float = 0,
    llm_input_tokens: int = 0,
    llm_output_tokens: int = 0,
    tts_chars: int = 0,
) -> float:
    cfg = get_config()
    stt_per_min = 0.0048
    llm_in_per_1k = 0.005
    llm_out_per_1k = 0.015
    tts_per_1k = 0.016
    cost = 0.0
    cost += (stt_seconds / 60) * stt_per_min
    cost += (llm_input_tokens / 1000) * llm_in_per_1k
    cost += (llm_output_tokens / 1000) * llm_out_per_1k
    cost += (tts_chars / 1000) * tts_per_1k
    return round(cost, 6)
