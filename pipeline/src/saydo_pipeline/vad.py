"""W2 阶段 D · 免手轮次检测(05 §4 提前批 #6;10 §3-1 轮次三层;03 §3 轮次检测行)。

三层:① 能量 VAD 起停(本模块状态机)→ ② 语义 EOU(说完了没的机械词表判定)→
③ 显式"说完了"按钮兜底(console;turn.done_speaking 强制终结)。

VAD 引擎口径(诚实登记):P0 免手档用**能量 RMS + hangover 状态机**(纯 python 零依赖、
确定性可测;07 D2 的 Silero VAD 是 Pipecat 框架语境的内置件,当前管线为自写 WS client——
升级 Silero/webrtcvad 留 R-C sweep,嘈杂环境先走 PTT/按钮兜底)。中英混说默认延长静音阈值
(10 §3-1),EOU 判"未完"再延一档。
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field

FRAME_MS = 20  # console 采集帧 20ms @16k(useVoiceChannel MIC_FRAME_SAMPLES=320)

# 能量阈值(PCM16 RMS;16-bit 满幅 32767):静音底噪通常 <300,正常说话 >1000。
# 阈值可调参数,注入测试用确定性帧;真麦体感留 owner 场次调优。
DEFAULT_SPEECH_RMS = 700.0
# 起说判定:连续 3 帧(60ms)超阈(防瞬时咔哒声误触发)
START_FRAMES = 3
# 说完判定(第一层):静音 hangover 900ms(中英混说默认延长,10 §3-1;短于此的停顿不断轮)
END_SILENCE_MS = 900
# EOU 判"未完"后的续说等待上限:再无语音 2500ms 则硬终结(防悬挂)
EOU_HOLD_MS = 2500

# 语义 EOU 第二层(机械词表,P0 最小形态;LLM EOU 留升级):
# 以连接词/迟疑词收尾 = 大概率没说完(中文口语实测常见接续词)
_TRAILING_CONTINUATION = (
    "然后",
    "但是",
    "不过",
    "所以",
    "就是",
    "还有",
    "另外",
    "或者",
    "以及",
    "和",
    "跟",
    "那个",
    "这个",
    "嗯",
    "呃",
    "、",
    ",",
    ",",
)


def rms_of_pcm16(frame: bytes) -> float:
    """PCM16LE 帧 RMS(能量 VAD 的判定量)。"""
    n = len(frame) // 2
    if n == 0:
        return 0.0
    total = 0
    for (v,) in struct.iter_unpack("<h", frame[: n * 2]):
        total += v * v
    return (total / n) ** 0.5


def semantic_eou_complete(text: str) -> bool:
    """语义 EOU(第二层):判定这段转写像不像"说完了"。

    机械口径:非空 ∧ 不以接续词/迟疑词/顿号逗号收尾。判"未完"只延长等待
    (fail-safe 方向:误判未完最多多等 EOU_HOLD_MS,误判已完靠用户续说下一轮兜)。
    """
    t = text.strip()
    if t == "":
        return False
    return not any(t.endswith(suffix) for suffix in _TRAILING_CONTINUATION)


@dataclass
class VadEvent:
    kind: str  # "speech_start" | "utterance_end"
    pcm: bytes = b""


@dataclass
class EnergyVad:
    """能量 VAD 状态机(免手档;帧驱动,时间以帧数推进——确定性可测,不读墙钟)。

    输入:20ms PCM16 帧;输出事件:speech_start(打断链用)/ utterance_end(带该轮 PCM)。
    """

    speech_rms: float = DEFAULT_SPEECH_RMS
    start_frames: int = START_FRAMES
    end_silence_frames: int = END_SILENCE_MS // FRAME_MS
    speaking: bool = False
    _above: int = 0
    _silence: int = 0
    _buf: list[bytes] = field(default_factory=list)
    _preroll: list[bytes] = field(default_factory=list)

    def feed(self, frame: bytes) -> list[VadEvent]:
        events: list[VadEvent] = []
        loud = rms_of_pcm16(frame) >= self.speech_rms
        if not self.speaking:
            # preroll:起说前 300ms 缓存(补起说沿,防首字吞音)
            self._preroll.append(frame)
            if len(self._preroll) > 15:
                self._preroll.pop(0)
            self._above = self._above + 1 if loud else 0
            if self._above >= self.start_frames:
                self.speaking = True
                self._silence = 0
                self._buf = list(self._preroll)
                self._preroll = []
                events.append(VadEvent("speech_start"))
            return events
        self._buf.append(frame)
        if loud:
            self._silence = 0
        else:
            self._silence += 1
            if self._silence >= self.end_silence_frames:
                pcm = b"".join(self._buf)
                self.reset()
                events.append(VadEvent("utterance_end", pcm))
        return events

    def flush(self) -> bytes:
        """强制终结(说完了按钮 / 模式切换):返回累积 PCM(可能为空)。"""
        pcm = b"".join(self._buf) if self.speaking else b""
        self.reset()
        return pcm

    def reset(self) -> None:
        self.speaking = False
        self._above = 0
        self._silence = 0
        self._buf = []
        self._preroll = []
