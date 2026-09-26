# B1:HF 并发识别按 sid+世代所有权排空;修复前只等 last _hf_task 会提前 ACK。
# 确定性并发,不用 sleep 冒充排空。覆盖先发后到、第二段先结束、断连/失败/取消、主题切换。

from __future__ import annotations

import asyncio

from test_vad_handsfree import LOUD, QUIET, FakeWs, run
from test_voice_barrier_quiesce import classified_finals, quiesced

from saydo_pipeline.hub_client import HubClient


class GatedAsr:
    """每轮独立 gate,按调用序号放行。"""

    def __init__(self, texts: list[str]) -> None:
        self.texts = texts
        self.calls = 0
        self.started: dict[int, asyncio.Event] = {}
        self.gates: dict[int, asyncio.Event] = {}
        self.order: list[int] = []

    def _slot(self, i: int) -> tuple[asyncio.Event, asyncio.Event]:
        started = self.started.setdefault(i, asyncio.Event())
        gate = self.gates.setdefault(i, asyncio.Event())
        return started, gate

    async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
        i = self.calls
        self.calls += 1
        started, gate = self._slot(i)
        started.set()
        await gate.wait()
        self.order.append(i)
        if i < len(self.texts):
            return self.texts[i]
        return f"seg-{i}"

    async def wait_started(self, i: int) -> None:
        started, _ = self._slot(i)
        await asyncio.wait_for(started.wait(), 2)

    def release(self, i: int) -> None:
        _, gate = self._slot(i)
        gate.set()


def _hf_client(asr: GatedAsr, sid: str = "ses_01TESTOWNED00000000000001") -> HubClient:
    client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
    client._mode = "hands_free"
    client._active_sid = sid
    return client


async def _utterance(client: HubClient, ws: FakeWs) -> None:
    for _ in range(20):
        await client._feed_vad(ws, LOUD, wait_recognize=False)
    for _ in range(45):
        await client._feed_vad(ws, QUIET, wait_recognize=False)


async def _last_handle_only(client: HubClient) -> None:
    """修复前口径:只等覆盖后的 _hf_task。"""
    if client._hf_task is not None and not client._hf_task.done():
        await client._hf_task


def test_second_finishes_first_last_handle_would_ack_while_first_pending() -> None:
    """复现窗:第二段先结束时 last 句柄已完,第一段仍在途;生产排空必须继续等。"""

    async def scenario() -> None:
        asr = GatedAsr(["第一段旧主题", "第二段后到"])
        sid = "ses_01TESTOWNED00000000000001"
        client = _hf_client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        await _utterance(client, ws)
        await asr.wait_started(1)
        first = [w for w in client._owned_asr if w.kind == "hf_recognize"]
        assert len(first) == 2
        asr.release(1)
        await asyncio.wait_for(client._hf_task, 2)  # type: ignore[arg-type]
        assert client._hf_task is not None and client._hf_task.done()
        still_first = [w for w in client._owned_asr if not w.task.done()]
        assert still_first, "第一段必须仍在途,否则不是并发窗"
        last_done = asyncio.create_task(_last_handle_only(client))
        owned_wait = asyncio.create_task(client._await_owned_asr(sid, client._speech_generation))
        await asyncio.wait_for(last_done, 1)
        assert last_done.done()
        assert not owned_wait.done(), "只等 last 会提前返回;所有权等待不得结束"
        asr.release(0)
        await asyncio.wait_for(owned_wait, 2)
        assert owned_wait.done()

    run(scenario())


def test_quiesce_waits_first_late_and_acks_after_all_owned() -> None:
    """先发后到:成功 ACK 不得出现在第一段 final 之前。"""

    async def scenario() -> None:
        asr = GatedAsr(["第一段旧主题", "第二段后到"])
        sid = "ses_01TESTOWNED00000000000002"
        client = _hf_client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        await _utterance(client, ws)
        await asr.wait_started(1)
        asr.release(1)
        await asyncio.wait_for(client._hf_task, 2)  # type: ignore[arg-type]
        q_task = asyncio.create_task(
            client._handle_quiesce(
                ws,
                {
                    "t": "voice.quiesce",
                    "sessionId": sid,
                    "requestId": "evt_01TESTQSC000000000000010",
                    "epoch": 1,
                },
            )
        )
        await client._handle(ws, {"t": "asr.hotwords", "words": ["worktree"]})
        assert client._hotwords == ["worktree"]
        await asyncio.sleep(0)
        assert quiesced(ws) == []
        texts = [m["text"] for m in classified_finals(ws)]
        assert "第一段旧主题" not in texts
        asr.release(0)
        await asyncio.wait_for(q_task, 2)
        finals = classified_finals(ws)
        acks = quiesced(ws)
        assert acks and acks[0]["classified"] is True
        assert len(finals) == 1
        assert finals[0]["text"] == "第一段旧主题第二段后到"
        assert finals[0]["recordSeqFirst"] == 1
        assert finals[0]["recordSeqLast"] == 2
        first_i = next(i for i, m in enumerate(ws.sent) if m.get("t") == "asr.final")
        ack_i = next(i for i, m in enumerate(ws.sent) if m.get("t") == "voice.quiesced")
        assert first_i < ack_i
        assert all(m.get("recognitionOutcome") == "ok" for m in finals)

    run(scenario())


def test_retired_generation_drops_late_final_after_rearm() -> None:
    """主题切换/rearm 后退役世代,迟到识别不得再发 asr.final。"""

    async def scenario() -> None:
        asr = GatedAsr(["旧主题迟到"])
        sid = "ses_01TESTOWNED00000000000003"
        client = _hf_client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        old_gen = client._speech_generation
        await client._handle(ws, {"t": "voice.mode", "sessionId": sid, "mode": "ptt"})
        assert client._generation_retired(old_gen)
        asr.release(0)
        await asyncio.gather(*[w.task for w in list(client._owned_asr)], return_exceptions=True)
        assert classified_finals(ws) == []
        client._mode = "hands_free"
        client._active_sid = sid
        asr.texts.append("新主题")
        await _utterance(client, ws)
        await asr.wait_started(1)
        asr.release(1)
        await client._await_owned_asr(sid, client._speech_generation)
        texts = [m["text"] for m in classified_finals(ws)]
        assert texts == ["新主题"]

    run(scenario())


def test_failed_owned_asr_keeps_failure_and_does_not_false_ok() -> None:
    async def scenario() -> None:
        class BoomThenOk(GatedAsr):
            async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
                i = self.calls
                self.calls += 1
                started, gate = self._slot(i)
                started.set()
                await gate.wait()
                self.order.append(i)
                if i == 0:
                    raise RuntimeError("first hf failed")
                return "第二段成功"

        asr = BoomThenOk([])
        sid = "ses_01TESTOWNED00000000000004"
        client = _hf_client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        await _utterance(client, ws)
        await asr.wait_started(1)
        asr.release(1)
        asr.release(0)
        await client._await_owned_asr(sid, client._speech_generation)
        await client._handle_quiesce(
            ws,
            {"t": "voice.quiesce", "sessionId": sid, "requestId": "evt_01TESTQSC000000000000011", "epoch": 2},
        )
        assert client._has_unresolved_failure(sid)
        assert quiesced(ws)[-1]["classified"] is False

    run(scenario())


def test_disconnect_retires_generation_and_cancels_owned() -> None:
    async def scenario() -> None:
        asr = GatedAsr(["不会发出"])
        sid = "ses_01TESTOWNED00000000000005"
        client = _hf_client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        old_gen = client._speech_generation
        await client._reset_connection_tasks()
        assert client._generation_retired(old_gen)
        asr.release(0)
        await asyncio.sleep(0)
        assert classified_finals(ws) == []
        assert client._owned_asr == set()

    run(scenario())


def test_quiesce_does_not_wait_foreign_sid_or_block_handle() -> None:
    async def scenario() -> None:
        asr = GatedAsr(["本会话", "外会话"])
        sid = "ses_01TESTOWNED00000000000006"
        other = "ses_01TESTOWNED00000000000007"
        client = _hf_client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        client._spawn_hf_recognize(ws, LOUD * 20, other)
        await asr.wait_started(1)
        q_task = asyncio.create_task(
            client._handle_quiesce(
                ws,
                {
                    "t": "voice.quiesce",
                    "sessionId": sid,
                    "requestId": "evt_01TESTQSC000000000000012",
                    "epoch": 3,
                },
            )
        )
        await client._handle(ws, {"t": "asr.hotwords", "words": ["alive"]})
        assert client._hotwords == ["alive"]
        asr.release(0)
        await asyncio.wait_for(q_task, 2)
        assert not asr.gates[1].is_set()
        asr.release(1)

    run(scenario())
