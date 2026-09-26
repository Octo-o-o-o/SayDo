# PTT 松开后识别仍在途,模式 PTT -> HF -> PTT 会退役 speech generation。
# quiesce 必须等这条仍合法的 ptt_flush 终态。成功 ACK 不得先于 final。
# 已退役 HF、别的 sid、新连接纪元不得混进这一轮。让出一次事件循环只为观察是否提前 ACK。

from __future__ import annotations

import asyncio

from test_hf_owned_asr import GatedAsr
from test_ptt_mode_terminal import CAP, PCM, SID, _finals, _hf_client, _ptt_client, _utterance
from test_vad_handsfree import FakeWs, run
from test_voice_barrier_quiesce import quiesced

from saydo_pipeline.hub_client import HubClient


def _quiesce_msg(
    sid: str = SID,
    request_id: str = "evt_01TESTQSC000000000000020",
    epoch: int = 1,
    discard: list[int] | None = None,
) -> dict:
    msg: dict = {
        "t": "voice.quiesce",
        "sessionId": sid,
        "requestId": request_id,
        "epoch": epoch,
    }
    if discard is not None:
        msg["discardUnknownEpochs"] = discard
    return msg


async def _yield_once() -> None:
    """让出一次事件循环,观察 quiesce 是否已提前 ACK。不是墙钟排空。"""
    await asyncio.sleep(0)


def _ack_after_finals(ws: FakeWs) -> None:
    finals = [i for i, msg in enumerate(ws.sent) if msg.get("t") == "asr.final"]
    acks = [i for i, msg in enumerate(ws.sent) if msg.get("t") == "voice.quiesced"]
    assert finals and acks
    assert max(finals) < min(acks)


async def _roundtrip(client: HubClient, ws: FakeWs, sid: str) -> int:
    old_gen = client._speech_generation
    await client._handle(ws, {"t": "voice.mode", "sessionId": sid, "mode": "hands_free"})
    await client._handle(ws, {"t": "voice.mode", "sessionId": sid, "mode": "ptt"})
    assert client._generation_retired(old_gen)
    assert client._speech_generation != old_gen
    return old_gen


def test_ptt_hf_ptt_quiesce_acks_only_after_old_generation_final() -> None:
    """生产顺序:PTT 识别在途 -> HF -> PTT -> 新 Focus quiesce。旧 generation 的 ptt_flush 必须先 final。"""

    async def scenario() -> None:
        asr = GatedAsr(["PTT old text"])
        client = _ptt_client(asr)
        ws = FakeWs()
        client._spawn_ptt_flush(ws, SID, PCM, CAP)
        await asr.wait_started(0)
        old_gen = await _roundtrip(client, ws, SID)
        still = [
            work
            for work in client._owned_asr
            if work.kind == "ptt_flush" and work.generation == old_gen and not work.task.done()
        ]
        assert still, "切档不得取消仍合法的旧 generation ptt_flush"
        q_task = asyncio.create_task(client._handle_quiesce(ws, _quiesce_msg()))
        await client._handle(ws, {"t": "asr.hotwords", "words": ["worktree"]})
        await _yield_once()
        assert client._hotwords == ["worktree"]
        assert quiesced(ws) == [], "ASR 未释放时不得先发 classified ACK"
        assert _finals(ws) == []
        assert not q_task.done()
        asr.release(0)
        await asyncio.wait_for(q_task, 2)
        finals = _finals(ws)
        acks = quiesced(ws)
        assert len(finals) == 1
        assert finals[0]["text"] == "PTT old text"
        assert finals[0]["captureMode"] == "ptt"
        assert finals[0]["captureId"] == CAP
        assert finals[0]["recognitionOutcome"] == "ok"
        assert finals[0]["sessionId"] == SID
        assert len(acks) == 1
        assert acks[0]["classified"] is True
        assert "emptyRound" not in acks[0]
        _ack_after_finals(ws)

    run(scenario())


def test_old_generation_ptt_empty_and_failed_terminal_before_ack() -> None:
    async def scenario() -> None:
        empty = GatedAsr([""])
        sid = "ses_01TESTPTTMODE0000000000002"
        cap = "evt_01TESTPTTCAP0000000000002"
        client = _ptt_client(empty, sid)
        ws = FakeWs()
        client._spawn_ptt_flush(ws, sid, PCM, cap)
        await empty.wait_started(0)
        await _roundtrip(client, ws, sid)
        q_task = asyncio.create_task(
            client._handle_quiesce(ws, _quiesce_msg(sid, "evt_01TESTQSC000000000000021"))
        )
        await _yield_once()
        assert quiesced(ws) == []
        empty.release(0)
        await asyncio.wait_for(q_task, 2)
        finals = _finals(ws)
        assert len(finals) == 1
        assert finals[0]["text"] == ""
        assert finals[0]["recognitionOutcome"] == "ok"
        assert finals[0]["captureId"] == cap
        ack = quiesced(ws)[-1]
        assert ack["classified"] is True
        assert "emptyRound" not in ack
        _ack_after_finals(ws)

        class Boom(GatedAsr):
            async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
                i = self.calls
                self.calls += 1
                started, gate = self._slot(i)
                started.set()
                await gate.wait()
                raise RuntimeError("ptt asr down")

        failed = Boom([])
        sid_f = "ses_01TESTPTTMODE0000000000003"
        cap_f = "evt_01TESTPTTCAP0000000000003"
        client_f = _ptt_client(failed, sid_f)
        ws_f = FakeWs()
        client_f._spawn_ptt_flush(ws_f, sid_f, PCM, cap_f)
        await failed.wait_started(0)
        await _roundtrip(client_f, ws_f, sid_f)
        q_f = asyncio.create_task(
            client_f._handle_quiesce(ws_f, _quiesce_msg(sid_f, "evt_01TESTQSC000000000000022"))
        )
        await _yield_once()
        assert quiesced(ws_f) == []
        failed.release(0)
        await asyncio.wait_for(q_f, 2)
        bad = _finals(ws_f)
        assert len(bad) == 1
        assert bad[0]["text"] == ""
        assert bad[0]["recognitionOutcome"] == "failed"
        assert bad[0]["captureId"] == cap_f
        nack = quiesced(ws_f)[-1]
        assert nack["classified"] is False
        assert nack["code"] == "voice_recognition_failed"
        assert "emptyRound" not in nack
        _ack_after_finals(ws_f)

    run(scenario())


def test_timeout_cancel_disconnect_and_rearm_do_not_false_ack() -> None:
    async def scenario() -> None:
        class TimeoutAsr(GatedAsr):
            async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
                i = self.calls
                self.calls += 1
                started, gate = self._slot(i)
                started.set()
                await gate.wait()
                raise TimeoutError("asr budget")

        timed = TimeoutAsr([])
        sid = "ses_01TESTPTTMODE0000000000008"
        cap = "evt_01TESTPTTCAP0000000000008"
        client = _ptt_client(timed, sid)
        ws = FakeWs()
        client._spawn_ptt_flush(ws, sid, PCM, cap)
        await timed.wait_started(0)
        await _roundtrip(client, ws, sid)
        q_task = asyncio.create_task(client._handle_quiesce(ws, _quiesce_msg(sid, "evt_01TESTQSC000000000000023")))
        await _yield_once()
        assert quiesced(ws) == []
        timed.release(0)
        await asyncio.wait_for(q_task, 2)
        assert _finals(ws)[-1]["recognitionOutcome"] == "failed"
        assert quiesced(ws)[-1]["classified"] is False
        _ack_after_finals(ws)

        cancelled = GatedAsr(["不应作为成功文本"])
        sid_c = "ses_01TESTPTTMODE0000000000009"
        cap_c = "evt_01TESTPTTCAP0000000000009"
        client_c = _ptt_client(cancelled, sid_c)
        ws_c = FakeWs()
        client_c._spawn_ptt_flush(ws_c, sid_c, PCM, cap_c)
        await cancelled.wait_started(0)
        await _roundtrip(client_c, ws_c, sid_c)
        q_c = asyncio.create_task(
            client_c._handle_quiesce(ws_c, _quiesce_msg(sid_c, "evt_01TESTQSC000000000000024"))
        )
        await _yield_once()
        assert quiesced(ws_c) == []
        work = next(item for item in client_c._owned_asr if item.kind == "ptt_flush")
        work.task.cancel()
        await asyncio.wait_for(q_c, 2)
        assert _finals(ws_c)[-1]["recognitionOutcome"] == "failed"
        assert _finals(ws_c)[-1]["text"] == ""
        assert quiesced(ws_c)[-1]["classified"] is False
        _ack_after_finals(ws_c)

        dropped = GatedAsr(["断线前还没返回"])
        sid_d = "ses_01TESTPTTMODE0000000000010"
        cap_d = "evt_01TESTPTTCAP0000000000010"
        client_d = _ptt_client(dropped, sid_d)
        ws_d = FakeWs()
        client_d._spawn_ptt_flush(ws_d, sid_d, PCM, cap_d)
        await dropped.wait_started(0)
        old_epoch = client_d._connection_epoch
        await client_d._handle(ws_d, _quiesce_msg(sid_d, "evt_01TESTQSC000000000000025"))
        await _yield_once()
        assert quiesced(ws_d) == []
        await client_d._reset_connection_tasks()
        assert client_d._connection_epoch != old_epoch
        assert all(ack.get("classified") is not True for ack in quiesced(ws_d))
        failed = _finals(ws_d)
        assert len(failed) == 1
        assert failed[0]["text"] == ""
        assert failed[0]["recognitionOutcome"] == "failed"
        await client_d._handle_quiesce(ws_d, _quiesce_msg(sid_d, "evt_01TESTQSC000000000000026", epoch=2))
        new_ack = quiesced(ws_d)[-1]
        assert new_ack["classified"] is True
        assert new_ack["epoch"] == 2
        assert new_ack.get("emptyRound") == "unusable"
        assert all(item.get("text") != "断线前还没返回" for item in _finals(ws_d))
        assert ws_d.sent.index(failed[0]) < ws_d.sent.index(new_ack)

        rearm = GatedAsr(["rearm 之后的新一轮"])
        sid_r = "ses_01TESTPTTMODE0000000000011"
        cap_r = "evt_01TESTPTTCAP0000000000011"
        client_r = _ptt_client(rearm, sid_r)
        ws_r = FakeWs()
        await client_r._handle_quiesce(ws_r, _quiesce_msg(sid_r, "evt_01TESTQSC000000000000027"))
        await client_r._handle(
            ws_r,
            {
                "t": "voice.mode",
                "sessionId": sid_r,
                "mode": "ptt",
                "quiesceRequestId": "evt_01TESTQSC000000000000027",
            },
        )
        client_r._spawn_ptt_flush(ws_r, sid_r, PCM, cap_r)
        await rearm.wait_started(0)
        q_r = asyncio.create_task(
            client_r._handle_quiesce(ws_r, _quiesce_msg(sid_r, "evt_01TESTQSC000000000000028"))
        )
        await _yield_once()
        assert [ack for ack in quiesced(ws_r) if ack["requestId"] == "evt_01TESTQSC000000000000028"] == []
        rearm.release(0)
        await asyncio.wait_for(q_r, 2)
        assert _finals(ws_r)[-1]["text"] == "rearm 之后的新一轮"
        second = [ack for ack in quiesced(ws_r) if ack["requestId"] == "evt_01TESTQSC000000000000028"]
        assert len(second) == 1
        assert second[0]["classified"] is True
        assert "emptyRound" not in second[0]
        final_i = ws_r.sent.index(_finals(ws_r)[-1])
        ack_i = ws_r.sent.index(second[0])
        assert final_i < ack_i

    run(scenario())


def test_multi_ptt_out_of_order_release_and_duplicate_quiesce() -> None:
    async def scenario() -> None:
        asr = GatedAsr(["第一段", "第二段"])
        sid = "ses_01TESTPTTMODE0000000000012"
        cap1 = "evt_01TESTPTTCAP0000000000012"
        cap2 = "evt_01TESTPTTCAP0000000000013"
        client = _ptt_client(asr, sid)
        ws = FakeWs()
        client._spawn_ptt_flush(ws, sid, PCM, cap1)
        await asr.wait_started(0)
        client._spawn_ptt_flush(ws, sid, PCM, cap2)
        await _roundtrip(client, ws, sid)
        pending = [work for work in client._owned_asr if work.kind == "ptt_flush" and not work.task.done()]
        assert len(pending) == 2
        q_task = asyncio.create_task(client._handle_quiesce(ws, _quiesce_msg(sid, "evt_01TESTQSC000000000000029")))
        dup = asyncio.create_task(client._handle_quiesce(ws, _quiesce_msg(sid, "evt_01TESTQSC000000000000029")))
        other = asyncio.create_task(client._handle_quiesce(ws, _quiesce_msg(sid, "evt_01TESTQSC000000000000030")))
        await _yield_once()
        assert quiesced(ws) == []
        asr.release(0)
        await asr.wait_started(1)
        await _yield_once()
        assert quiesced(ws) == []
        assert [item["captureId"] for item in _finals(ws)] == [cap1]
        asr.release(1)
        await asyncio.wait_for(asyncio.gather(q_task, dup, other), 2)
        finals = _finals(ws)
        assert [item["text"] for item in finals] == ["第一段", "第二段"]
        assert [item["captureId"] for item in finals] == [cap1, cap2]
        acks = quiesced(ws)
        assert {ack["requestId"] for ack in acks} == {
            "evt_01TESTQSC000000000000029",
            "evt_01TESTQSC000000000000030",
        }
        assert all(ack["classified"] is True and "emptyRound" not in ack for ack in acks)
        assert sum(1 for ack in acks if ack["requestId"] == "evt_01TESTQSC000000000000029") == 1
        _ack_after_finals(ws)

    run(scenario())


def test_retired_hf_other_sid_and_discard_stay_outside_ptt_drain() -> None:
    async def scenario() -> None:
        asr = GatedAsr(["旧免手不得混入", "本会话 PTT"])
        sid = "ses_01TESTPTTMODE0000000000014"
        client = _hf_client(asr, sid)
        ws = FakeWs()
        await _utterance(client, ws)
        await asr.wait_started(0)
        cap = "evt_01TESTPTTCAP0000000000014"
        client._spawn_ptt_flush(ws, sid, PCM, cap)
        await asr.wait_started(1)
        old_gen = client._speech_generation
        client._retire_speech_generation()
        client._hf.retire(sid, old_gen)
        assert client._generation_retired(old_gen)
        hf_pending = [
            work
            for work in client._owned_asr
            if work.kind == "hf_recognize" and work.generation == old_gen and not work.task.done()
        ]
        assert hf_pending, "这个反例要求退役 HF 任务仍在跑,用来区分「等全部任务」"
        q_task = asyncio.create_task(client._handle_quiesce(ws, _quiesce_msg(sid, "evt_01TESTQSC000000000000031")))
        await _yield_once()
        assert quiesced(ws) == []
        asr.release(1)
        await asyncio.wait_for(q_task, 2)
        assert [item.get("text") for item in _finals(ws)] == ["本会话 PTT"]
        assert quiesced(ws)[-1]["classified"] is True
        assert "emptyRound" not in quiesced(ws)[-1]
        assert any(not work.task.done() for work in hf_pending)
        asr.release(0)
        await asyncio.gather(*[work.task for work in hf_pending], return_exceptions=True)
        assert [item.get("text") for item in _finals(ws)] == ["本会话 PTT"]
        _ack_after_finals(ws)

        foreign = GatedAsr(["本会话", "外会话"])
        sid_a = "ses_01TESTPTTMODE0000000000015"
        sid_b = "ses_01TESTPTTMODE0000000000016"
        client_b = _ptt_client(foreign, sid_a)
        ws_b = FakeWs()
        cap_a = "evt_01TESTPTTCAP0000000000015"
        cap_b = "evt_01TESTPTTCAP0000000000016"
        client_b._spawn_ptt_flush(ws_b, sid_a, PCM, cap_a)
        await foreign.wait_started(0)
        client_b._spawn_ptt_flush(ws_b, sid_b, PCM, cap_b)
        await _roundtrip(client_b, ws_b, sid_a)
        q_b = asyncio.create_task(
            client_b._handle_quiesce(ws_b, _quiesce_msg(sid_a, "evt_01TESTQSC000000000000032"))
        )
        await _yield_once()
        assert quiesced(ws_b) == []
        foreign.release(0)
        await foreign.wait_started(1)
        await asyncio.wait_for(q_b, 2)
        assert _finals(ws_b)[-1]["captureId"] == cap_a
        assert _finals(ws_b)[-1]["text"] == "本会话"
        assert quiesced(ws_b)[-1]["sessionId"] == sid_a
        assert all(item.get("captureId") != cap_b for item in _finals(ws_b))
        foreign.release(1)
        await asyncio.gather(*[work.task for work in list(client_b._owned_asr)], return_exceptions=True)
        texts = [item.get("text") for item in _finals(ws_b)]
        assert texts == ["本会话", "外会话"]
        ack_i = next(i for i, msg in enumerate(ws_b.sent) if msg.get("t") == "voice.quiesced")
        foreign_i = next(i for i, msg in enumerate(ws_b.sent) if msg.get("captureId") == cap_b)
        assert ack_i < foreign_i

        discard_asr = GatedAsr(["放弃前仍要终态"])
        sid_x = "ses_01TESTPTTMODE0000000000017"
        cap_x = "evt_01TESTPTTCAP0000000000017"
        client_x = _ptt_client(discard_asr, sid_x)
        ws_x = FakeWs()
        client_x._spawn_ptt_flush(ws_x, sid_x, PCM, cap_x)
        await discard_asr.wait_started(0)
        await _roundtrip(client_x, ws_x, sid_x)
        q_x = asyncio.create_task(
            client_x._handle_quiesce(
                ws_x,
                _quiesce_msg(sid_x, "evt_01TESTQSC000000000000033", discard=[1]),
            )
        )
        await _yield_once()
        assert quiesced(ws_x) == []
        discard_asr.release(0)
        await asyncio.wait_for(q_x, 2)
        assert _finals(ws_x)[-1]["text"] == "放弃前仍要终态"
        assert _finals(ws_x)[-1]["recognitionOutcome"] == "ok"
        assert quiesced(ws_x)[-1]["classified"] is True
        _ack_after_finals(ws_x)

        # 已结算的失败不得在 discard 之后复活,下一轮没有新录音时仍是 empty ack。
        sid_y = "ses_01TESTPTTMODE0000000000018"
        cap_y = "evt_01TESTPTTCAP0000000000018"

        class Boom(GatedAsr):
            async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
                i = self.calls
                self.calls += 1
                started, gate = self._slot(i)
                started.set()
                await gate.wait()
                raise RuntimeError("settled failure")

        boom = Boom([])
        client_y = _ptt_client(boom, sid_y)
        ws_y = FakeWs()
        client_y._spawn_ptt_flush(ws_y, sid_y, PCM, cap_y)
        await boom.wait_started(0)
        await _roundtrip(client_y, ws_y, sid_y)
        q_fail = asyncio.create_task(
            client_y._handle_quiesce(ws_y, _quiesce_msg(sid_y, "evt_01TESTQSC000000000000034"))
        )
        boom.release(0)
        await asyncio.wait_for(q_fail, 2)
        assert quiesced(ws_y)[-1]["classified"] is False
        await client_y._handle_quiesce(
            ws_y,
            _quiesce_msg(sid_y, "evt_01TESTQSC000000000000035", discard=[1]),
        )
        assert quiesced(ws_y)[-1]["classified"] is True
        await client_y._handle_quiesce(ws_y, _quiesce_msg(sid_y, "evt_01TESTQSC000000000000036", epoch=2))
        later = quiesced(ws_y)[-1]
        assert later["classified"] is True
        assert later.get("emptyRound") == "unusable"
        assert client_y._has_unresolved_failure(sid_y) is False

    run(scenario())
