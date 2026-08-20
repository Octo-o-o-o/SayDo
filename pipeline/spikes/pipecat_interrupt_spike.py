"""1.1 D2 去留 spike:验证 Pipecat 能实现"打断即截断已听到的历史"(07 D2 判定点)。

验证三断言:
  A. 输出侧可维护 playout watermark(已实际写出/播放的音频毫秒数,句内粒度);
  B. 打断(InterruptionFrame)后队列中未播帧被清,第二句零帧写出(unheard 不进事实);
  C. 打断响应及时(打断后写出不超过一个 chunk 的余量)。

方法:MockTTS(每句 2s 音频,10ms chunk 由输出侧节流)-> WatermarkOutput(write 按实时 sleep 模拟播放,
     逐句累计 watermark);t~=1s 时注入 InterruptionFrame;对照断言。
运行:uv run python spikes/pipecat_interrupt_spike.py
"""

import asyncio
import json
import sys
import time

from pipecat.frames.frames import (
    EndFrame,
    InterruptionFrame,
    TTSAudioRawFrame,
    TTSSpeakFrame,
    TTSStartedFrame,
    TTSStoppedFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.services.tts_service import TTSService
from pipecat.transports.base_output import BaseOutputTransport
from pipecat.transports.base_transport import TransportParams

SAMPLE_RATE = 16000
SENTENCE_SECS = 2.0


class MockTTS(TTSService):
    """确定性 TTS:每句产 2 秒静音音频(0.2s x 10 帧),零外部依赖。"""

    def __init__(self):
        super().__init__(sample_rate=SAMPLE_RATE, text_aggregation_mode="sentence")
        self.synthesized: list[str] = []

    def can_generate_metrics(self) -> bool:
        return False

    async def run_tts(self, text: str, context_id: str):
        self.synthesized.append(text)
        yield TTSStartedFrame()
        chunk = b"\x00\x00" * int(SAMPLE_RATE * 0.2)  # 0.2s @16kHz mono s16le
        for _ in range(int(SENTENCE_SECS / 0.2)):
            yield TTSAudioRawFrame(audio=chunk, sample_rate=SAMPLE_RATE, num_channels=1)
        yield TTSStoppedFrame()


class WatermarkOutput(BaseOutputTransport):
    """输出 transport:write 时按音频真实时长 sleep(模拟实时播放),累计 watermark。"""

    def __init__(self, params: TransportParams):
        super().__init__(params)
        self.watermark_ms = 0.0
        self.write_log: list[tuple[float, float]] = []  # (wallclock, watermark_ms)

    async def start(self, frame):
        await super().start(frame)
        await self.set_transport_ready(frame)  # 注册 default destination(1.6 模式,同 local/audio)

    async def write_audio_frame(self, frame) -> bool:
        dur = len(frame.audio) / 2 / frame.sample_rate  # s16le mono
        await asyncio.sleep(dur)  # 模拟声卡实时消费
        self.watermark_ms += dur * 1000
        self.write_log.append((time.monotonic(), self.watermark_ms))
        return True


async def main() -> int:
    tts = MockTTS()
    out = WatermarkOutput(
        TransportParams(audio_out_enabled=True, audio_out_sample_rate=SAMPLE_RATE, audio_out_10ms_chunks=20)
    )
    pipeline = Pipeline([tts, out])
    task = PipelineTask(pipeline, cancel_on_idle_timeout=False)

    async def scenario():
        await task.queue_frame(TTSSpeakFrame("第一句,大概两秒钟长,播放到一半会被打断。"))
        await task.queue_frame(TTSSpeakFrame("第二句,不应该发出任何声音。"))
        await asyncio.sleep(1.0)  # 第一句播到 ~1s
        watermark_at_interrupt = out.watermark_ms
        await task.queue_frame(InterruptionFrame())
        await asyncio.sleep(1.5)  # 观察窗:打断后是否还有帧写出
        watermark_after = out.watermark_ms
        await task.queue_frame(EndFrame())
        return watermark_at_interrupt, watermark_after

    runner = PipelineRunner(handle_sigint=False)
    scenario_task = asyncio.create_task(scenario())
    await runner.run(task)
    watermark_at_interrupt, watermark_after = await scenario_task

    residue_ms = watermark_after - watermark_at_interrupt
    results = {
        "sentences_synthesized": len(tts.synthesized),
        "watermark_at_interrupt_ms": round(watermark_at_interrupt),
        "watermark_after_ms": round(watermark_after),
        "residue_after_interrupt_ms": round(residue_ms),
        "total_first_sentence_ms": SENTENCE_SECS * 1000,
    }

    checks = {
        # A watermark 可维护且在打断时刻接近 1000ms(调度容差 +-400)
        "A_watermark_trackable": 500 <= watermark_at_interrupt <= 1500,
        # B 第一句未播完(watermark < 2000)且总写出远小于两句总长(4000)=> 未播文本未下发
        "B_unheard_dropped": watermark_after < 1900,
        # C 打断后残余写出 <= 一个 chunk(200ms)+ 调度余量
        "C_interrupt_prompt": residue_ms <= 400,
    }
    print(json.dumps({"results": results, "checks": checks}, ensure_ascii=False, indent=2))
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
