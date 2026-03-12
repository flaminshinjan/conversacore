from dataclasses import dataclass, field


@dataclass
class UsageTracker:
    stt_audio_seconds: float = 0.0
    llm_input_tokens: int = 0
    llm_output_tokens: int = 0
    tts_chars: int = 0
    tool_invocations: int = 0
