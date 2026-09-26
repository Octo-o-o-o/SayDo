# 09 §10.1.6 / 反例 49、50:失败标记跨空 tail/切模式保留;新 HF final 必带 recognitionOutcome=ok。

import asyncio
from typing import Any

from test_vad_handsfree import LOUD, QUIET, FakeWs, make_client, run

from saydo_pipeline.hub_client import HubClient


class BoomAsr:
    def __init__(self) -> None:
        self.calls = 0

    async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
        self.calls += 1
        raise RuntimeError("simulated asr failure")


class DelayedAsr:
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.gate = asyncio.Event()
        self.calls = 0

    async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
        self.calls += 1
        self.started.set()
        await self.gate.wait()
        raise RuntimeError("delayed asr failure")


def quiesced(ws: FakeWs) -> list[dict[str, Any]]:
    return [m for m in ws.sent if m.get("t") == "voice.quiesced"]


def classified_finals(ws: FakeWs) -> list[dict[str, Any]]:
    return [m for m in ws.sent if m.get("t") == "asr.final"]


def test_hf_finals_always_include_recognition_outcome_ok() -> None:
    """反例 50:每条新 HF final 必有 recognitionOutcome=ok,禁 captureId。"""

    async def scenario() -> None:
        client, _ = make_client(["把导出按钮修好", "把分页补上"])
        ws = FakeWs()
        for _ in range(2):
            for _ in range(20):
                await client._feed_vad(ws, LOUD)
            for _ in range(45):
                await client._feed_vad(ws, QUIET)
        finals = classified_finals(ws)
        assert len(finals) == 2
        for item in finals:
            assert item["captureMode"] == "hands_free"
            assert item["recognitionOutcome"] == "ok"
            assert "captureId" not in item

        await client._handle(ws, {"t": "turn.done_speaking", "sessionId": client._active_sid})
        for item in classified_finals(ws):
            if item.get("captureMode") == "hands_free":
                assert item["recognitionOutcome"] == "ok"

    run(scenario())


def test_ended_hf_failure_survives_empty_tail_and_mode_switch() -> None:
    """反例 49:quiesce 前已结束的 HF 失败不被空 tail / voice.mode 清掉。"""

    async def scenario() -> None:
        asr = BoomAsr()
        client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
        client._mode = "hands_free"
        sid = "ses_01TESTFAIL000000000000001"
        client._active_sid = sid
        ws = FakeWs()
        for _ in range(20):
            await client._feed_vad(ws, LOUD)
        for _ in range(45):
            await client._feed_vad(ws, QUIET)
        assert client._has_unresolved_failure(sid)
        failed = classified_finals(ws)
        assert len(failed) == 1
        assert failed[0]["recognitionOutcome"] == "failed"
        assert failed[0]["text"] == ""

        await client._handle(
            ws,
            {"t": "voice.mode", "sessionId": sid, "mode": "ptt"},
        )
        assert client._has_unresolved_failure(sid)

        await client._handle_quiesce(
            ws,
            {"t": "voice.quiesce", "sessionId": sid, "requestId": "evt_01TESTQSC000000000000001", "epoch": 1},
        )
        acks = quiesced(ws)
        assert len(acks) == 1
        assert acks[0]["classified"] is False
        assert acks[0]["code"] == "voice_recognition_failed"
        assert client._has_unresolved_failure(sid)

        await client._handle_quiesce(
            ws,
            {
                "t": "voice.quiesce",
                "sessionId": sid,
                "requestId": "evt_01TESTQSC000000000000002",
                "epoch": 1,
                "discardUnknownEpochs": [1],
            },
        )
        assert client._has_unresolved_failure(sid) is False
        assert quiesced(ws)[-1]["classified"] is True

    run(scenario())


class OkAfterBoom:
    def __init__(self) -> None:
        self.calls = 0

    async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("first hf failed")
        return "后来听清了"


def test_later_success_does_not_clear_unresolved_failure() -> None:
    """失败标记不被后续成功 HF 清除,quiesce 仍失败 ACK。"""

    async def scenario() -> None:
        asr = OkAfterBoom()
        client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
        client._mode = "hands_free"
        sid = "ses_01TESTKEEP00000000000001"
        client._active_sid = sid
        ws = FakeWs()
        for _ in range(20):
            await client._feed_vad(ws, LOUD)
        for _ in range(45):
            await client._feed_vad(ws, QUIET)
        assert client._has_unresolved_failure(sid)
        for _ in range(20):
            await client._feed_vad(ws, LOUD)
        for _ in range(45):
            await client._feed_vad(ws, QUIET)
        finals = classified_finals(ws)
        assert finals[-1]["recognitionOutcome"] == "ok"
        assert client._has_unresolved_failure(sid)
        await client._handle_quiesce(
            ws,
            {"t": "voice.quiesce", "sessionId": sid, "requestId": "evt_01TESTQSC000000000000004", "epoch": 3},
        )
        assert quiesced(ws)[-1]["classified"] is False
        assert client._has_unresolved_failure(sid)

    run(scenario())


def test_quiesce_does_not_block_receive_loop() -> None:
    """排空在后台跑,收包循环仍能处理后续 JSON。"""

    async def scenario() -> None:
        asr = DelayedAsr()
        client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
        client._mode = "hands_free"
        sid = "ses_01TESTSLOW00000000000001"
        client._active_sid = sid
        ws = FakeWs()
        pcm = LOUD * 20
        client._spawn_hf_recognize(ws, pcm, sid)
        await asr.started.wait()
        await client._handle(
            ws,
            {"t": "voice.quiesce", "sessionId": sid, "requestId": "evt_01TESTQSC000000000000003", "epoch": 2},
        )
        await client._handle(ws, {"t": "asr.hotwords", "words": ["worktree"]})
        assert client._hotwords == ["worktree"]
        assert quiesced(ws) == []
        asr.gate.set()
        await asyncio.gather(*list(client._connection_tasks), return_exceptions=True)
        assert quiesced(ws)[-1]["classified"] is False
        assert client._has_unresolved_failure(sid)

    run(scenario())
