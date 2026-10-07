# VOICE-MEASURE-01:调用生产 semantic_eou_complete 与 HubClient,不复制判定实现。

import asyncio
import json
import struct
from typing import Any

import pytest

from saydo_pipeline.hub_client import HubClient, new_turn_id, turn_id_of_sentence
from saydo_pipeline.vad import semantic_eou_complete

FRAME_SAMPLES = 320
SID = "ses_01TESTMEAS0000000000000001"
STRING_TURN = "ses_01ABCDEFGHJKMNPQRSTVWXYZAB"
CONTROL_TURN = "ctl-confirmation_settled-01ABCDEF-k3j2h1a"
SYSTEM_SENTENCE_IDS = (
    "s-cb-1690000000000",
    "s-cb-txt-1690000000000",
    "s-suspend-1690000000000",
    "s-focus-close-1690000000000",
)
REJECTED_SENTENCE_IDS = SYSTEM_SENTENCE_IDS + (
    "s-alpha-beta-2",
    "s-evt_42-١",
    "s-evt_42-0\n",
    "s-evt_42-0\r\n",
    "s-ses_NOTULID-1",
    "s-prj_01ABCDEFGHJKMNPQRSTVWXYZAB-0",
    "s-evt_01ABCDEFGHJKMNPQRSTVWXYZAB-0",
    "s-ctl-bogus-01ABCDEF-k3j2h1a-0",
)


def frame(amplitude: int) -> bytes:
    return struct.pack("<h", amplitude) * FRAME_SAMPLES


LOUD = frame(8000)
QUIET = frame(50)


class CollectWs:
    def __init__(self) -> None:
        self.sent: list[str | bytes] = []

    async def send(self, data: str | bytes) -> None:
        self.sent.append(data)


class InstantTts:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def synthesize(self, text: str) -> bytes:
        self.calls.append(text)
        return b"mp3"


class GateTts:
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.calls: list[str] = []

    async def synthesize(self, text: str) -> bytes:
        self.calls.append(text)
        if len(self.calls) == 1:
            self.started.set()
            await self.release.wait()
        return b"mp3"


def finals(ws: CollectWs) -> list[str]:
    found: list[str] = []
    for item in ws.sent:
        if isinstance(item, str):
            msg = json.loads(item)
            if msg.get("t") == "asr.final":
                found.append(msg["text"])
    return found


def stage_turns(ws: CollectWs, stage: str) -> list[str]:
    found: list[str] = []
    for item in ws.sent:
        if isinstance(item, str):
            msg = json.loads(item)
            if msg.get("t") == "latency.stage" and msg.get("stage") == stage:
                found.append(str(msg.get("turnId")))
    return found


def audio_count(ws: CollectWs) -> int:
    return sum(1 for item in ws.sent if isinstance(item, bytes))


def make_hf_client(results: list[str]) -> HubClient:
    class Asr:
        def __init__(self) -> None:
            self.results = results

        async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
            return self.results.pop(0) if self.results else ""

    client = HubClient("ws://x", tts=None, asr=Asr())  # type: ignore[arg-type]
    client._mode = "hands_free"
    client._active_sid = SID
    return client


async def speak_once(client: HubClient, ws: CollectWs) -> None:
    for _ in range(8):
        await client._feed_vad(ws, LOUD)
    for _ in range(45):
        await client._feed_vad(ws, QUIET)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("然后", False),
        ("然后。", False),
        ("然后.", False),
        ("但是，", False),
        ("修改配置、", False),
        ("修改配置,", False),
        ("修改配置，", False),
        ("修改配置，。", False),
        ("修改配置、！", False),
        ("修改配置,。", False),
        ("完成了吗？", True),
        ("把导出按钮修好", True),
        ("把导出按钮修好。", True),
        ("打开 README.md", True),
        ("修改 src/app.ts", True),
        ("把 API_KEY 配好。", True),
        ("不要改导出按钮", True),
        ("不要。", True),
        ("先不要,", False),
        ("不是这个，", False),
        ("", False),
        ("   ", False),
        ("。", False),
        ("？", False),
        ("...", False),
        ("！！", False),
        (",", False),
        ("，", False),
        ("、", False),
    ],
)
def test_eou_judgment_view(text: str, expected: bool) -> None:
    raw = text
    assert semantic_eou_complete(text) is expected
    assert text == raw


def test_hf_terminal_continuation_keeps_original_bytes() -> None:
    async def scenario() -> None:
        first = "然后。"
        second = "把报表补上"
        client = make_hf_client([first, second])
        ws = CollectWs()
        try:
            await speak_once(client, ws)
            assert finals(ws) == []
            assert client._pending_text.encode() == first.encode()
            await speak_once(client, ws)
            merged = finals(ws)
            assert merged == [first + second]
            assert merged[0].encode() == (first + second).encode()
        finally:
            client._cancel_eou_hold()

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "text",
    ["但是，", "修改配置、", "修改配置,", "修改配置，", "修改配置，。", "修改配置、！", "修改配置,。"],
)
def test_hf_continuation_punct_keeps_original_text(text: str) -> None:
    async def scenario() -> None:
        client = make_hf_client([text])
        ws = CollectWs()
        try:
            await speak_once(client, ws)
            assert finals(ws) == []
            assert client._pending_text.encode() == text.encode()
        finally:
            client._cancel_eou_hold()

    asyncio.run(scenario())


def test_slow_tts_a_returns_on_a_after_b_asr() -> None:
    async def one(sentence_id: str, turn_id: str) -> None:
        tts = GateTts()
        client = HubClient("ws://x", tts=tts, asr=None)  # type: ignore[arg-type]
        ws = CollectWs()
        await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": sentence_id, "text": "甲句"})
        await tts.started.wait()
        await client._emit_final(ws, SID, "乙轮转写")
        later = client._last_turn_id[SID]
        assert later != turn_id
        tts.release.set()
        await client._say_workers[SID]
        turns = stage_turns(ws, "tts_first_byte")
        assert turns == [turn_id]
        assert later not in turns
        assert audio_count(ws) == 1

    asyncio.run(one("s-evt_42-0", "evt_42"))
    asyncio.run(one(f"s-{STRING_TURN}-0", STRING_TURN))


def test_standard_evt_and_string_turn_ids_ignore_recent_asr() -> None:
    async def one(sentence_id: str, expected: str) -> None:
        client = HubClient("ws://x", tts=InstantTts(), asr=None)  # type: ignore[arg-type]
        client._last_turn_id[SID] = "evt_99"
        ws = CollectWs()
        await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": sentence_id, "text": "句"})
        await client._say_workers[SID]
        assert stage_turns(ws, "tts_first_byte") == [expected]
        assert audio_count(ws) == 1

    asyncio.run(one("s-evt_42-0", "evt_42"))
    asyncio.run(one("s-evt_7-12", "evt_7"))
    asyncio.run(one(f"s-{STRING_TURN}-3", STRING_TURN))
    asyncio.run(one(f"s-{CONTROL_TURN}-0", CONTROL_TURN))


def test_system_and_malformed_ids_do_not_borrow_recent_turn_or_zero() -> None:
    async def scenario() -> None:
        client = HubClient("ws://x", tts=InstantTts(), asr=None)  # type: ignore[arg-type]
        client._last_turn_id[SID] = "0"
        ws = CollectWs()
        sentence_ids = [
            *REJECTED_SENTENCE_IDS,
            "s-evt_42-hold",
            f"s-{STRING_TURN}-undo",
            f"s-focus-{STRING_TURN}-err",
            "",
            "sent_1",
            "s-",
            "s--1",
            "s-0-1",
            "s-evt_42-",
        ]
        for sentence_id in sentence_ids:
            await client._handle(
                ws,
                {"t": "tts.say", "sessionId": SID, "sentenceId": sentence_id, "text": "系统或畸形"},
            )
        await client._say_workers[SID]
        assert stage_turns(ws, "tts_first_byte") == []
        assert "0" not in stage_turns(ws, "tts_first_byte")
        assert client._tts_first_byte_sent == set()
        assert audio_count(ws) == len(sentence_ids)
        await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_42-0", "text": "真实句"})
        await client._say_workers[SID]
        assert stage_turns(ws, "tts_first_byte") == ["evt_42"]
        assert client._tts_first_byte_sent == {"evt_42"}

    asyncio.run(scenario())


def test_turn_id_of_sentence_rejects_arbitrary_and_system_ids() -> None:
    assert len(STRING_TURN) == 30
    assert turn_id_of_sentence("s-evt_42-0") == "evt_42"
    assert turn_id_of_sentence("s-evt_7-12") == "evt_7"
    assert turn_id_of_sentence(f"s-{STRING_TURN}-3") == STRING_TURN
    assert turn_id_of_sentence(f"s-{CONTROL_TURN}-0") == CONTROL_TURN
    assert turn_id_of_sentence("s-ctl-downgrade_applied-x-k3-1") == "ctl-downgrade_applied-x-k3"
    assert turn_id_of_sentence("s-ctl-expectation_adjusted-ABCDEFGH-m1-2") == "ctl-expectation_adjusted-ABCDEFGH-m1"
    assert turn_id_of_sentence("s-ctl-downgrade_applied-x-123456-0") == "ctl-downgrade_applied-x-123456"
    for sentence_id in REJECTED_SENTENCE_IDS:
        assert turn_id_of_sentence(sentence_id) is None
    assert turn_id_of_sentence("s-0-1") is None
    assert turn_id_of_sentence(None) is None
    generated = new_turn_id()
    assert turn_id_of_sentence(f"s-{generated}-0") == generated


def test_same_turn_multiple_sentences_emit_once() -> None:
    async def scenario() -> None:
        client = HubClient("ws://x", tts=InstantTts(), asr=None)  # type: ignore[arg-type]
        client._last_turn_id[SID] = "evt_99"
        ws = CollectWs()
        for index in (0, 1, 2):
            await client._handle(
                ws,
                {"t": "tts.say", "sessionId": SID, "sentenceId": f"s-evt_42-{index}", "text": f"句{index}"},
            )
        await client._say_workers[SID]
        assert stage_turns(ws, "tts_first_byte") == ["evt_42"]
        assert audio_count(ws) == 3

    asyncio.run(scenario())


def test_tts_turn_dedup_is_bounded_and_reset_reconnect_clears_it() -> None:
    async def scenario() -> None:
        client = HubClient("ws://x", tts=InstantTts(), asr=None)  # type: ignore[arg-type]
        client._last_turn_id[SID] = "evt_99"
        ws = CollectWs()
        total = 600
        for index in range(1, total + 1):
            await client._handle(
                ws,
                {"t": "tts.say", "sessionId": SID, "sentenceId": f"s-evt_{index}-0", "text": "句"},
            )
        await client._say_workers[SID]
        turns = stage_turns(ws, "tts_first_byte")
        assert len(turns) == total
        assert turns[0] == "evt_1" and turns[-1] == f"evt_{total}"
        assert len(set(turns)) == total
        assert len(client._tts_first_byte_sent) <= 500
        await client._reset_connection_tasks()
        assert client._tts_first_byte_sent == set()
        assert client._last_turn_id == {}
        ws2 = CollectWs()
        await client._handle(ws2, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_42-0", "text": "再来"})
        await client._say_workers[SID]
        assert stage_turns(ws2, "tts_first_byte") == ["evt_42"]

    asyncio.run(scenario())


def test_cancel_drops_inflight_and_later_sentence_stays_on_its_turn() -> None:
    async def scenario() -> None:
        tts = GateTts()
        client = HubClient("ws://x", tts=tts, asr=None)  # type: ignore[arg-type]
        client._last_turn_id[SID] = "evt_99"
        ws = CollectWs()
        await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_42-0", "text": "甲"})
        await tts.started.wait()
        await client._handle(ws, {"t": "barge_in", "sessionId": SID})
        tts.release.set()
        await client._say_workers[SID]
        assert audio_count(ws) == 0
        assert stage_turns(ws, "tts_first_byte") == []
        await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_42-1", "text": "乙"})
        await client._say_workers[SID]
        assert stage_turns(ws, "tts_first_byte") == ["evt_42"]
        assert audio_count(ws) == 1

    asyncio.run(scenario())


def test_native_reply_is_not_tts_say() -> None:
    async def scenario() -> None:
        client = HubClient("ws://x", tts=InstantTts(), asr=None)  # type: ignore[arg-type]
        client._last_turn_id[SID] = "evt_99"
        ws = CollectWs()
        await client._handle(
            ws,
            {
                "t": "native.reply",
                "sessionId": SID,
                "turnId": "evt_42",
                "sentenceId": "s-evt_42-0",
                "text": "移动回复",
            },
        )
        assert SID not in client._say_queues
        assert stage_turns(ws, "tts_first_byte") == []
        assert audio_count(ws) == 0

    asyncio.run(scenario())


def test_direct_queue_without_binding_still_parses_sentence_id() -> None:
    """已有测试直接入队。没有 sourceTurnId 时仍只解析 sentenceId,不读最近 ASR。"""

    async def scenario() -> None:
        client = HubClient("ws://x", tts=InstantTts(), asr=None)  # type: ignore[arg-type]
        client._last_turn_id[SID] = "evt_99"
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        await queue.put({"text": "直接", "sentenceId": "s-evt_42-0"})
        await queue.put({"text": "畸形", "sentenceId": "sent_1"})
        client._say_queues[SID] = queue
        ws = CollectWs()
        await client._say_worker(ws, SID)
        assert stage_turns(ws, "tts_first_byte") == ["evt_42"]
        assert audio_count(ws) == 2

    asyncio.run(scenario())


def audio_sentence_ids(ws: CollectWs) -> list[str]:
    return [data[6:6 + data[5]].decode() for data in ws.sent if isinstance(data, bytes)]


@pytest.mark.parametrize("interruptions", [1, 2])
def test_new_sentence_cannot_revive_interrupted_synthesis(interruptions: int) -> None:
    async def scenario() -> None:
        tts = GateTts()
        client = HubClient("ws://x", tts=tts, asr=None)  # type: ignore[arg-type]
        ws = CollectWs()
        try:
            await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_40-0", "text": "旧句"})
            await asyncio.wait_for(tts.started.wait(), 1)
            for index in range(interruptions):
                await client._handle(ws, {"t": "barge_in", "sessionId": SID})
                await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": f"s-evt_{41 + index}-0", "text": "新句"})
            # 另一会话不被打断，且不必等旧 provider。
            await client._handle(ws, {"t": "tts.say", "sessionId": "other", "sentenceId": "s-evt_50-0", "text": "另一会话"})
            await asyncio.wait_for(client._say_workers["other"], 1)
            tts.release.set()
            await asyncio.wait_for(client._say_workers[SID], 1)
            assert audio_sentence_ids(ws) == ["s-evt_50-0", f"s-evt_{40 + interruptions}-0"]
            assert stage_turns(ws, "tts_first_byte") == ["evt_50", f"evt_{40 + interruptions}"]
        finally:
            tts.release.set()
            await client._reset_connection_tasks()

    asyncio.run(scenario())


def test_interrupt_during_empty_audio_retry_drops_old_generation() -> None:
    class RetryTts(GateTts):
        async def synthesize(self, text: str) -> bytes:
            self.calls.append(text)
            if len(self.calls) == 1:
                return b""
            if len(self.calls) == 2:
                self.started.set()
                await self.release.wait()
            return b"mp3"

    async def scenario() -> None:
        tts = RetryTts()
        client = HubClient("ws://x", tts=tts, asr=None)  # type: ignore[arg-type]
        ws = CollectWs()
        try:
            await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_40-0", "text": "“旧句”"})
            await asyncio.wait_for(tts.started.wait(), 1)
            await client._handle(ws, {"t": "barge_in", "sessionId": SID})
            await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_41-0", "text": "新句"})
            tts.release.set()
            await asyncio.wait_for(client._say_workers[SID], 1)
            assert audio_sentence_ids(ws) == ["s-evt_41-0"]
            assert stage_turns(ws, "tts_first_byte") == ["evt_41"]
        finally:
            tts.release.set()
            await client._reset_connection_tasks()

    asyncio.run(scenario())


def test_reset_retires_provider_that_swallows_cancellation() -> None:
    class LateTts(GateTts):
        async def synthesize(self, text: str) -> bytes:
            self.calls.append(text)
            if len(self.calls) == 1:
                self.started.set()
                try:
                    await self.release.wait()
                except asyncio.CancelledError:
                    return b"old-after-cancel"
            return b"new"

    async def scenario() -> None:
        tts = LateTts()
        client = HubClient("ws://x", tts=tts, asr=None)  # type: ignore[arg-type]
        old_ws, new_ws = CollectWs(), CollectWs()
        try:
            await client._handle(old_ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_40-0", "text": "旧句"})
            await asyncio.wait_for(tts.started.wait(), 1)
            await client._handle(old_ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_40-1", "text": "旧排队句"})
            await asyncio.wait_for(client._reset_connection_tasks(), 1)
            await client._handle(new_ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_41-0", "text": "新连接句"})
            await asyncio.wait_for(client._say_workers[SID], 1)
            assert old_ws.sent == []
            assert audio_sentence_ids(new_ws) == ["s-evt_41-0"]
            assert tts.calls == ["旧句", "新连接句"]
        finally:
            tts.release.set()
            await client._reset_connection_tasks()

    asyncio.run(scenario())


def test_interrupt_while_latency_send_yields_cannot_send_old_audio() -> None:
    class DelayedLatencyWs(CollectWs):
        def __init__(self) -> None:
            super().__init__()
            self.started = asyncio.Event()
            self.release = asyncio.Event()

        async def send(self, data: str | bytes) -> None:
            if isinstance(data, str) and not self.started.is_set():
                self.started.set()
                await self.release.wait()
            self.sent.append(data)

    async def scenario() -> None:
        client = HubClient("ws://x", tts=InstantTts(), asr=None)  # type: ignore[arg-type]
        ws = DelayedLatencyWs()
        try:
            await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_40-0", "text": "旧句"})
            await asyncio.wait_for(ws.started.wait(), 1)
            await client._handle(ws, {"t": "barge_in", "sessionId": SID})
            await client._handle(ws, {"t": "tts.say", "sessionId": SID, "sentenceId": "s-evt_41-0", "text": "新句"})
            ws.release.set()
            await asyncio.wait_for(client._say_workers[SID], 1)
            assert audio_sentence_ids(ws) == ["s-evt_41-0"]
        finally:
            ws.release.set()
            await client._reset_connection_tasks()

    asyncio.run(scenario())
