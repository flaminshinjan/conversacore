from pipecat.frames.frames import MetricsFrame
from pipecat.metrics.metrics import LLMUsageMetricsData, TTSUsageMetricsData
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection

from app.usage.tracker import UsageTracker


class UsageAggregator(FrameProcessor):
    def __init__(self, tracker: UsageTracker, **kwargs):
        super().__init__(**kwargs)
        self._tracker = tracker

    async def process_frame(self, frame, direction: FrameDirection):
        if isinstance(frame, MetricsFrame) and hasattr(frame, "data"):
            for data in frame.data:
                if isinstance(data, LLMUsageMetricsData):
                    self._tracker.llm_input_tokens += data.value.prompt_tokens
                    self._tracker.llm_output_tokens += data.value.completion_tokens
                elif isinstance(data, TTSUsageMetricsData):
                    self._tracker.tts_chars += data.value
        await super().process_frame(frame, direction)
        await self.push_frame(frame, direction)
