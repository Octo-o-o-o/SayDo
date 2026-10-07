# 09 §10.1.13:识别完成可以乱序,提交必须按 recordSeq。一条逻辑轮恰好一条终态。
# 这些断言在录音序状态机落地前失败;不用 sleep,不改 VAD 事件顺序。

from __future__ import annotations

import asyncio

from test_hf_owned_asr import GatedAsr
from test_vad_handsfree import LOUD, QUIET, FakeAsr, FakeWs, run
from test_voice_barrier_quiesce import classified_finals, quiesced

from saydo_pipeline.hub_client import HubClient


def _client(asr: object, sid: str) -> HubClient:
    client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
    client._mode = "hands_free"
    client._active_sid = sid
    return client


async def _utterance(client: HubClient, ws: FakeWs) -> None:
    for _ in range(20):
        await client._feed_vad(ws, LOUD, wait_recognize=False)
    for _ in range(45):
        await client._feed_vad(ws, QUIET, wait_recognize=False)


def _hf_finals(ws: FakeWs) -> list[dict]:
    return [m for m in classified_finals(ws) if m.get("captureMode") == "hands_free"]


def test_out_of_order_asr_commits_in_record_order_as_one_final() -> None:
    """X1:后段先识别完,不得先发后半句;等 seq1 提交后拼成一条 final。"""

    async def scenario() -> None:
        asr = GatedAsr(["先保留 npm,然后", "补 pnpm"])
        sid = "ses_01TESTHFORDER0000000000001"
        client = _client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        await _utterance(client, ws)
        await asr.wait_started(1)
        asr.release(1)
        await asyncio.sleep(0)
        assert _hf_finals(ws) == [], "后段先完成不得先发 final"
        asr.release(0)
        await client._await_owned_asr(sid, client._speech_generation)
        finals = _hf_finals(ws)
        assert len(finals) == 1
        assert finals[0]["text"] == "先保留 npm,然后补 pnpm"
        assert finals[0]["recognitionOutcome"] == "ok"
        assert isinstance(finals[0].get("hfRoundId"), str)
        ids = finals[0].get("hfSegmentIds")
        assert isinstance(ids, list) and len(ids) == 2
        assert finals[0]["recordSeqFirst"] == 1
        assert finals[0]["recordSeqLast"] == 2
        starts = [m for m in ws.sent if m.get("t") == "vad.speech" and m.get("phase") == "start"]
        assert [m["recordSeq"] for m in starts] == [1, 2]
        assert starts[0]["hfRoundId"] == starts[1]["hfRoundId"] == finals[0]["hfRoundId"]
        assert [m["hfSegmentId"] for m in starts] == ids

    run(scenario())


def test_partial_failure_is_one_empty_failed_final() -> None:
    """X4:前半 ok、后半 failed → 一条 failed 空 final,不得把前半当成功稿。"""

    async def scenario() -> None:
        class BoomSecond(GatedAsr):
            async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
                i = self.calls
                self.calls += 1
                started, gate = self._slot(i)
                started.set()
                await gate.wait()
                self.order.append(i)
                if i == 1:
                    raise RuntimeError("second segment failed")
                return "前半"

        asr = BoomSecond(["前半"])
        sid = "ses_01TESTHFFAIL00000000000001"
        client = _client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        await _utterance(client, ws)
        await asr.wait_started(1)
        asr.release(0)
        await asyncio.sleep(0)
        assert _hf_finals(ws) == []
        asr.release(1)
        await client._await_owned_asr(sid, client._speech_generation)
        finals = _hf_finals(ws)
        assert len(finals) == 1
        assert finals[0]["recognitionOutcome"] == "failed"
        assert finals[0]["text"] == ""
        assert len(finals[0]["hfSegmentIds"]) == 2
        assert client._has_unresolved_failure(sid)
        await client._handle_quiesce(
            ws,
            {"t": "voice.quiesce", "sessionId": sid, "requestId": "evt_01TESTHFFAILQ000000000001", "epoch": 4},
        )
        assert quiesced(ws)[-1]["classified"] is False
        assert len(_hf_finals(ws)) == 1

    run(scenario())


def test_repeat_done_does_not_emit_second_final() -> None:
    async def scenario() -> None:
        asr = FakeAsr(["说完这一句"])
        sid = "ses_01TESTHFDONE00000000000001"
        client = _client(asr, sid)
        ws = FakeWs()
        for _ in range(10):
            await client._feed_vad(ws, LOUD, wait_recognize=False)
        await client._handle(ws, {"t": "turn.done_speaking", "sessionId": sid})
        await client._handle(ws, {"t": "turn.done_speaking", "sessionId": sid})
        finals = _hf_finals(ws)
        assert len(finals) == 1
        assert finals[0]["text"] == "说完这一句"
        assert len(finals[0]["hfSegmentIds"]) == 1

    run(scenario())


def test_no_open_round_empty_tail_acks_without_final() -> None:
    async def scenario() -> None:
        asr = GatedAsr([])
        sid = "ses_01TESTHFEMPTY0000000000001"
        client = _client(asr, sid)
        ws = FakeWs()
        await client._handle_quiesce(
            ws,
            {"t": "voice.quiesce", "sessionId": sid, "requestId": "evt_01TESTHFEMPTYQ00000000001", "epoch": 5},
        )
        assert _hf_finals(ws) == []
        ack = quiesced(ws)[-1]
        assert ack["classified"] is True
        assert ack.get("emptyRound") == "unusable"

    run(scenario())


def test_terminal_and_dropped_rounds_release_transcript_buffers() -> None:
    """终态、退役与放弃都释放旧转写;迟到结果不得重新留下正文。"""
    from itertools import count

    from saydo_pipeline.hf_round import HfRoundMachine

    ids = count()
    machine = HfRoundMachine(lambda: f"evt_{next(ids)}")
    for mode in ("finish", "retire", "drop"):
        sid = f"session-{mode}"
        slot = machine.open_speech(sid, 0)
        assert slot is not None
        machine.close_speech(sid)
        machine.note_result(sid, slot, "先保留这段,然后", "ok", 0)
        if mode == "finish":
            assert machine.settle(sid, force=True) is not None
        elif mode == "retire":
            machine.retire(sid, 0)
        else:
            machine.drop_open(sid)
        assert not machine._rounds, "终态不应长期保留含正文的轮次"
        assert not machine._results
        assert machine.note_result(sid, slot, "迟到正文", "ok", 0) is None
        assert not machine._rounds and not machine._results
