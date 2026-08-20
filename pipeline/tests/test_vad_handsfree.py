# W2 阶段 D(05 §4 提前批 #6;10 §3-1 轮次三层):免手档——
# 能量 VAD 状态机(起说/断轮/preroll)+ 语义 EOU(接续词收尾判未完)+
# HubClient 免手链(注入 5 轮不误断 / EOU 缓存拼接 / 说完了按钮强制终结 / 模式切换清账)。

import asyncio
import json
import struct
from typing import Any

from saydo_pipeline.hub_client import HubClient
from saydo_pipeline.vad import EnergyVad, rms_of_pcm16, semantic_eou_complete

FRAME_SAMPLES = 320  # 20ms @16k


def frame(amplitude: int) -> bytes:
    """恒定幅度方波帧(确定性能量;amplitude=0 为静音)。"""
    return struct.pack("<h", amplitude) * FRAME_SAMPLES


LOUD = frame(8000)
QUIET = frame(50)


class FakeAsr:
    def __init__(self, results: list[str]) -> None:
        self.results = results
        self.calls: list[int] = []

    async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
        self.calls.append(len(wav_audio))
        return self.results.pop(0) if self.results else ""


class FakeWs:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send(self, data: str) -> None:
        self.sent.append(json.loads(data))

    def finals(self) -> list[str]:
        return [m["text"] for m in self.sent if m.get("t") == "asr.final"]

    def vad_phases(self) -> list[str]:
        return [m["phase"] for m in self.sent if m.get("t") == "vad.speech"]


def make_client(results: list[str]) -> tuple[HubClient, FakeAsr]:
    asr = FakeAsr(results)
    client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
    client._mode = "hands_free"
    client._active_sid = "ses_01TESTVAD00000000000000001"
    return client, asr


def test_rms_and_semantic_eou() -> None:
    assert rms_of_pcm16(LOUD) > 700 > rms_of_pcm16(QUIET)
    assert semantic_eou_complete("把导出按钮修好")
    assert not semantic_eou_complete("把导出按钮修好,然后")  # 接续词收尾 = 未完
    assert not semantic_eou_complete("我想先改这个,")  # 逗号收尾 = 未完
    assert not semantic_eou_complete("")  # 空 = 未完(不发空轮)


def test_vad_state_machine_start_end_and_preroll() -> None:
    vad = EnergyVad()
    events = []
    for _ in range(3):
        events += vad.feed(LOUD)
    assert [e.kind for e in events] == ["speech_start"]
    for _ in range(10):
        events += vad.feed(LOUD)
    # 静音 900ms(45 帧)断轮
    for _ in range(45):
        events += vad.feed(QUIET)
    kinds = [e.kind for e in events]
    assert kinds == ["speech_start", "utterance_end"]
    end = events[-1]
    # utterance 含 preroll(起说前缓存)+ 说话帧 + 静音尾;至少覆盖 13 帧说话
    assert len(end.pcm) >= 13 * FRAME_SAMPLES * 2
    # 单帧瞬时响声(<3 帧)不触发起说
    vad2 = EnergyVad()
    assert vad2.feed(LOUD) == []
    assert vad2.feed(QUIET) == []
    assert vad2.speaking is False


def run(coro: Any) -> None:
    asyncio.run(coro)


def test_hands_free_five_rounds_no_false_cut() -> None:
    """验收锚(IMPL-5 §3-D):注入通道跑免手 5 轮不误断——每轮恰一次 asr.final,轮内短停顿不断。"""

    async def scenario() -> None:
        client, asr = make_client([f"第{i}轮说完了内容" for i in range(1, 6)])
        ws = FakeWs()
        for _ in range(5):
            # 一轮:说 20 帧 -> 轮内短停顿 400ms(20 帧,< 900ms 不断)-> 再说 10 帧 -> 静音 45 帧断轮
            for _ in range(20):
                await client._feed_vad(ws, LOUD)
            for _ in range(20):
                await client._feed_vad(ws, QUIET)
            for _ in range(10):
                await client._feed_vad(ws, LOUD)
            for _ in range(45):
                await client._feed_vad(ws, QUIET)
        assert len(ws.finals()) == 5, f"应恰 5 轮,得到 {ws.finals()}"
        assert len(asr.calls) == 5  # 轮内停顿未触发额外识别(不误断)
        # 每轮一对 start/end(短停顿不产生额外边界)
        assert ws.vad_phases() == ["start", "end"] * 5

    run(scenario())


def test_semantic_eou_holds_and_merges_continuation() -> None:
    """语义 EOU 第二层:接续词收尾 ⇒ 不发,缓存;续段到 ⇒ 拼接一次性发出。"""

    async def scenario() -> None:
        client, _ = make_client(["先把导出修好,然后", "再把报表页的分页补上"])
        ws = FakeWs()
        # 第一段(接续词收尾)
        for _ in range(5):
            await client._feed_vad(ws, LOUD)
        for _ in range(45):
            await client._feed_vad(ws, QUIET)
        assert ws.finals() == []  # 判未完:不发
        assert client._pending_text != ""
        # 续段
        for _ in range(5):
            await client._feed_vad(ws, LOUD)
        for _ in range(45):
            await client._feed_vad(ws, QUIET)
        assert ws.finals() == ["先把导出修好,然后再把报表页的分页补上"]
        assert client._pending_text == ""

    run(scenario())


def test_eou_hold_timer_hard_finalizes(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """悬挂上限:判未完后无续说,EOU_HOLD 到期硬终结发出(防永挂)。
    迟到评审 C 回收:patch 常量跑**真实** _eou_hold_timer(此前测试自写复制体零覆盖)。"""

    async def scenario() -> None:
        import saydo_pipeline.hub_client as hc

        monkeypatch.setattr(hc, "EOU_HOLD_MS", 10)  # 真函数,10ms 快进
        client, _ = make_client(["就先做这个,然后"])
        ws = FakeWs()
        for _ in range(5):
            await client._feed_vad(ws, LOUD)
        for _ in range(45):
            await client._feed_vad(ws, QUIET)
        assert ws.finals() == []
        assert client._eou_hold is not None
        await asyncio.sleep(0.1)  # 等真实悬挂计时器到期
        assert ws.finals() == ["就先做这个,然后"]
        assert client._pending_text == ""

    run(scenario())


def test_early_return_paths_rearm_hold(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """迟到评审 A1 回收:空转写等早退后,EOU 缓存必须仍有悬挂计时(不得挂到任意久错拼下一轮)。"""

    async def scenario() -> None:
        import saydo_pipeline.hub_client as hc

        monkeypatch.setattr(hc, "EOU_HOLD_MS", 10)
        client, _ = make_client(["先改这个,然后", ""])  # 第二段识别为空(咳嗽/噪声触发 VAD)
        ws = FakeWs()
        for _ in range(5):
            await client._feed_vad(ws, LOUD)
        for _ in range(45):
            await client._feed_vad(ws, QUIET)
        assert client._pending_text != ""
        # 第二段:speech_start 取消悬挂 -> 识别为空早退 -> 必须重挂(修复前此处无计时器)
        for _ in range(5):
            await client._feed_vad(ws, LOUD)
        for _ in range(45):
            await client._feed_vad(ws, QUIET)
        assert client._eou_hold is not None, "早退路径必须重挂悬挂计时器"
        await asyncio.sleep(0.1)
        assert ws.finals() == ["先改这个,然后"]  # 悬挂到期把缓存发出,不再悬空

    run(scenario())


def test_voice_mode_rebinds_session_even_same_mode() -> None:
    """迟到评审 A2 回收:mode 值相同但 sessionId 变(console 刷新)⇒ 重绑 + 清账,旧 pending 不并入新会话。"""

    async def scenario() -> None:
        client, _ = make_client([])
        ws = FakeWs()
        client._pending_text = "旧会话残留"
        new_sid = "ses_01TESTVAD00000000000000002"
        await client._handle(ws, {"t": "voice.mode", "sessionId": new_sid, "mode": "hands_free"})
        assert client._active_sid == new_sid
        assert client._pending_text == ""
        assert client._mode == "hands_free"

    run(scenario())


def test_done_speaking_button_force_finalizes() -> None:
    """第三层兜底(说完了按钮):进行中 utterance + EOU 缓存立即合并发出(绕语义判定)。"""

    async def scenario() -> None:
        client, _ = make_client(["这一段还在说没有断轮"])
        ws = FakeWs()
        for _ in range(10):
            await client._feed_vad(ws, LOUD)  # 说话中,未断轮
        assert ws.finals() == []
        await client._handle(ws, {"t": "turn.done_speaking", "sessionId": client._active_sid})
        assert ws.finals() == ["这一段还在说没有断轮"]

    run(scenario())


def test_mode_switch_clears_state() -> None:
    """voice.mode 切换:VAD/EOU 缓存/mic 缓冲清账,不跨模式带账。"""

    async def scenario() -> None:
        client, _ = make_client([])
        ws = FakeWs()
        client._pending_text = "残留"
        client._mic_buf = [b"\x00\x00"]
        for _ in range(5):
            await client._feed_vad(ws, LOUD)
        assert client._vad.speaking is True
        await client._handle(ws, {"t": "voice.mode", "sessionId": client._active_sid, "mode": "ptt"})
        assert client._mode == "ptt"
        assert client._pending_text == ""
        assert client._vad.speaking is False
        assert client._mic_buf == []

    run(scenario())
