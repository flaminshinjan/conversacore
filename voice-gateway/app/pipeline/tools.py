import wave
from pathlib import Path

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.frames.frames import OutputAudioRawFrame
from pipecat.services.llm_service import FunctionCallParams

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
_CACHE: dict[str, tuple[bytes, int, int]] = {}

# Aliases: LLM may request e.g. "compassion" - map to existing assets
_ASSET_ALIASES: dict[str, str] = {
    "compassion": "ding",
}


def _load_asset(asset_id: str) -> tuple[bytes, int, int] | None:
    resolved = _ASSET_ALIASES.get(asset_id, asset_id)
    if resolved in _CACHE:
        return _CACHE[resolved]
    path = ASSETS_DIR / f"{resolved}.wav"
    if not path.exists():
        return None
    with wave.open(str(path), "rb") as wf:
        nch = wf.getnchannels()
        sr = wf.getframerate()
        data = wf.readframes(wf.getnframes())
    result = (data, sr, nch)
    _CACHE[resolved] = result
    return result


async def play_audio_handler(params: FunctionCallParams) -> None:
    asset_id = params.arguments.get("asset_id", "ding")
    loaded = _load_asset(asset_id)
    if not loaded:
        await params.result_callback({"error": f"asset not found: {asset_id}"})
        return
    audio_bytes, sample_rate, num_channels = loaded
    frame = OutputAudioRawFrame(
        audio=audio_bytes,
        sample_rate=sample_rate,
        num_channels=num_channels,
    )
    await params.llm.push_frame(frame)
    await params.result_callback({"played": asset_id})


PLAY_AUDIO_SCHEMA = FunctionSchema(
    name="play_audio",
    description="Play a short audio cue to the user. Use for notifications, alerts, or emphasis. Valid assets: ding, compassion.",
    properties={
        "asset_id": {
            "type": "string",
            "description": "Identifier of the audio asset: ding (default), compassion",
            "default": "ding",
        },
    },
    required=[],
)


def get_tools_schema() -> ToolsSchema:
    return ToolsSchema(standard_tools=[PLAY_AUDIO_SCHEMA])
