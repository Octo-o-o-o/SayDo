# PTT 松开后识别仍在途时切档:终态和已识别文本必须留下。
# HF 代次退役不放行迟到 HF final。不用 sleep 当排空。

from __future__ import annotations

import asyncio

from test_hf_owned_asr import GatedAsr
from test_vad_handsfree import LOUD, QUIET, FakeWs, run

from saydo_pipeline.hub_client import HubClient

PCM = b"\x01\x00" * 2000
SID = "ses_01TESTPTTMODE0000000000001"
CAP = "evt_01TESTPTTCAP0000000000001"


def _ptt_client(asr: GatedAsr, sid: str = SID) -> HubClient:
    client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
    client._mode = "ptt"
    client._active_sid = sid
    return client


def _hf_client(asr: GatedAsr, sid: str) -> HubClient:
    client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
    client._mode = "hands_free"
    client._active_sid = sid
    return client


def _finals(ws: FakeWs) -> list[dict]:
    return [m for m in ws.sent if m.get("t") == "asr.final"]


async def _utterance(client: HubClient, ws: FakeWs) -> None:
    for _ in range(20):
        await client._feed_vad(ws, LOUD, wait_recognize=False)
    for _ in range(45):
        await client._feed_vad(ws, QUIET, wait_recognize=False)


def test_ptt_flush_survives_switch_to_hands_free_and_keeps_text() -> None:
    async def scenario() -> None:
        asr = GatedAsr(["A项目受众是谁"])
        client = _ptt_client(asr)
        ws = FakeWs()
        client._spawn_ptt_flush(ws, SID, PCM, CAP)
        await asr.wait_started(0)
        old_gen = client._speech_generation
        await client._handle(ws, {"t": "voice.mode", "sessionId": SID, "mode": "hands_free"})
        assert client._generation_retired(old_gen)
        assert client._mode == "hands_free"
        still = [w for w in client._owned_asr if w.kind == "ptt_flush" and not w.task.done()]
        assert still, "在途 PTT 不得被切档取消"
        asr.release(0)
        await asyncio.wait_for(client._asr_task, 2)  # type: ignore[arg-type]
        finals = _finals(ws)
        assert len(finals) == 1
        assert finals[0]["text"] == "A项目受众是谁"
        assert finals[0]["captureMode"] == "ptt"
        assert finals[0]["captureId"] == CAP
        assert finals[0]["recognitionOutcome"] == "ok"
        assert finals[0]["sessionId"] == SID

    run(scenario())


def test_ptt_empty_and_failed_still_terminal_after_mode_switch() -> None:
    async def scenario() -> None:
        empty = GatedAsr([""])
        client = _ptt_client(empty, "ses_01TESTPTTMODE0000000000002")
        ws = FakeWs()
        client._spawn_ptt_flush(ws, client._active_sid, PCM, "evt_01TESTPTTCAP0000000000002")
        await empty.wait_started(0)
        await client._handle(ws, {"t": "voice.mode", "sessionId": client._active_sid, "mode": "hands_free"})
        empty.release(0)
        await asyncio.wait_for(client._asr_task, 2)  # type: ignore[arg-type]
        finals = _finals(ws)
        assert len(finals) == 1
        assert finals[0]["text"] == ""
        assert finals[0]["recognitionOutcome"] == "ok"
        assert finals[0]["captureMode"] == "ptt"

        class Boom(GatedAsr):
            async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
                i = self.calls
                self.calls += 1
                started, gate = self._slot(i)
                started.set()
                await gate.wait()
                raise RuntimeError("ptt asr down")

        failed = Boom([])
        client_f = _ptt_client(failed, "ses_01TESTPTTMODE0000000000003")
        ws_f = FakeWs()
        client_f._spawn_ptt_flush(ws_f, client_f._active_sid, PCM, "evt_01TESTPTTCAP0000000000003")
        await failed.wait_started(0)
        await client_f._handle(ws_f, {"t": "voice.mode", "sessionId": client_f._active_sid, "mode": "hands_free"})
        failed.release(0)
        await asyncio.wait_for(client_f._asr_task, 2)  # type: ignore[arg-type]
        bad = _finals(ws_f)
        assert len(bad) == 1
        assert bad[0]["text"] == ""
        assert bad[0]["recognitionOutcome"] == "failed"
        assert bad[0]["captureId"] == "evt_01TESTPTTCAP0000000000003"

    run(scenario())


def test_cancelled_ptt_flush_still_emits_failed_terminal() -> None:
    async def scenario() -> None:
        asr = GatedAsr(["不应作为成功文本"])
        sid = "ses_01TESTPTTMODE0000000000004"
        client = _ptt_client(asr, sid)
        ws = FakeWs()
        client._spawn_ptt_flush(ws, sid, PCM, "evt_01TESTPTTCAP0000000000004")
        await asr.wait_started(0)
        work = next(w for w in client._owned_asr if w.kind == "ptt_flush")
        work.task.cancel()
        await asyncio.gather(work.task, return_exceptions=True)
        finals = _finals(ws)
        assert len(finals) == 1
        assert finals[0]["recognitionOutcome"] == "failed"
        assert finals[0]["text"] == ""
        assert finals[0]["captureMode"] == "ptt"
        assert finals[0]["captureId"] == "evt_01TESTPTTCAP0000000000004"

    run(scenario())


def test_disconnect_ptt_emits_failed_terminal_without_inventing_text() -> None:
    async def scenario() -> None:
        asr = GatedAsr(["断线前还没返回"])
        sid = "ses_01TESTPTTMODE0000000000005"
        client = _ptt_client(asr, sid)
        ws = FakeWs()
        client._spawn_ptt_flush(ws, sid, PCM, "evt_01TESTPTTCAP0000000000005")
        await asr.wait_started(0)
        old_gen = client._speech_generation
        await client._reset_connection_tasks()
        assert client._generation_retired(old_gen)
        asr.release(0)
        finals = _finals(ws)
        assert len(finals) == 1
        assert finals[0]["text"] == ""
        assert finals[0]["recognitionOutcome"] == "failed"
        assert finals[0]["captureMode"] == "ptt"
        assert all(m.get("captureMode") != "hands_free" for m in finals)

    run(scenario())


def test_hf_to_ptt_still_drops_late_hf_final() -> None:
    async def scenario() -> None:
        asr = GatedAsr(["旧免手迟到"])
        sid = "ses_01TESTPTTMODE0000000000006"
        client = _hf_client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        old_gen = client._speech_generation
        await client._handle(ws, {"t": "voice.mode", "sessionId": sid, "mode": "ptt"})
        assert client._generation_retired(old_gen)
        asr.release(0)
        await asyncio.gather(*[w.task for w in list(client._owned_asr)], return_exceptions=True)
        assert _finals(ws) == []

    run(scenario())


def test_rearm_ptt_keeps_in_flight_ptt_and_drops_old_hf() -> None:
    async def scenario() -> None:
        asr = GatedAsr(["免手旧轮", "手动档原文"])
        sid = "ses_01TESTPTTMODE0000000000007"
        client = _hf_client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        client._spawn_ptt_flush(ws, sid, PCM, "evt_01TESTPTTCAP0000000000007")
        await asr.wait_started(1)
        old_gen = client._speech_generation
        await client._handle(ws, {"t": "voice.mode", "sessionId": sid, "mode": "ptt", "quiesceRequestId": "evt_01REARM00000000000000007"})
        assert client._generation_retired(old_gen)
        asr.release(0)
        asr.release(1)
        await asyncio.gather(*[w.task for w in list(client._owned_asr)], return_exceptions=True)
        if client._asr_task is not None:
            await asyncio.wait_for(client._asr_task, 2)
        finals = _finals(ws)
        assert [m.get("text") for m in finals] == ["手动档原文"]
        assert finals[0]["captureMode"] == "ptt"
        assert finals[0]["recognitionOutcome"] == "ok"

    run(scenario())
