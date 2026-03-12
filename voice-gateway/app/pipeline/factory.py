import os

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.serializers.protobuf import ProtobufFrameSerializer
from pipecat.services.cartesia.tts import CartesiaTTSService, CartesiaTTSSettings, GenerationConfig
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.tts_service import TextAggregationMode
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

from app.pipeline.tools import get_tools_schema, play_audio_handler
from app.pipeline.usage_aggregator import UsageAggregator

SYSTEM_PROMPT = """You are a friendly AI voice assistant. Keep responses very brief (1-2 sentences when possible) for fast, natural conversation. Be conversational and concise.
You can play short audio cues using the play_audio tool when appropriate (e.g. to acknowledge, emphasize, or alert)."""


def create_pipeline(websocket, usage_tracker=None):
    deepgram_key = os.getenv("DEEPGRAM_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    cartesia_key = os.getenv("CARTESIA_API_KEY")
    voice_id = os.getenv("CARTESIA_VOICE_ID", "71a7ad14-091c-4e8e-a314-022ece01c121")
    if not all([deepgram_key, openai_key, cartesia_key]):
        raise ValueError("DEEPGRAM_API_KEY, OPENAI_API_KEY, and CARTESIA_API_KEY must be set")

    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=ProtobufFrameSerializer(),
        ),
    )

    stt = DeepgramSTTService(api_key=deepgram_key)
    llm = OpenAILLMService(
        api_key=openai_key,
        model="gpt-4o-mini",
    )
    tts = CartesiaTTSService(
        api_key=cartesia_key,
        settings=CartesiaTTSSettings(
            voice=voice_id,
            generation_config=GenerationConfig(speed=1.1),
        ),
        text_aggregation_mode=TextAggregationMode.TOKEN,
    )

    llm.register_function("play_audio", play_audio_handler, cancel_on_interruption=True)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]
    tools = get_tools_schema()
    context = LLMContext(messages=messages, tools=tools)
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),
            user_turn_stop_timeout=0.8,
        ),
    )

    steps = [
        transport.input(),
        stt,
        user_aggregator,
        llm,
        tts,
    ]
    if usage_tracker:
        steps.append(UsageAggregator(usage_tracker))
    steps.extend([transport.output(), assistant_aggregator])
    pipeline = Pipeline(steps)

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    @task.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        await task.cancel()

    return PipelineRunner(handle_sigint=False), task
