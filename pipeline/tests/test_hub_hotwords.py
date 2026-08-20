# 接线批(HANDOFF §2-9-③):asr.hotwords 下发 -> HubClient 存词表 -> recognize 传参(热词偏置 live 链)。

import asyncio
import json
from typing import Any

import pytest

import saydo_pipeline.hub_client as hub_client_module
from saydo_pipeline.hub_client import HubClient


class FakeAsr:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
        self.calls.append({"bytes": len(wav_audio), "hotwords": hotwords})
        return "识别结果"


class FakeWs:
    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send(self, data: str) -> None:
        self.sent.append(data)


class HealthWs(FakeWs):
    async def send(self, data: str) -> None:
        self.sent.append(data)
        raise asyncio.CancelledError


class FailingAsr:
    async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
        raise RuntimeError("provider down")


class HangingTts:
    async def synthesize(self, text: str) -> bytes:
        await asyncio.Event().wait()
        return b""


class EmptyTts:
    async def synthesize(self, text: str) -> bytes:
        return b""


class ReconnectTts:
    def __init__(self) -> None:
        self.calls = 0
        self.first_started = asyncio.Event()

    async def synthesize(self, text: str) -> bytes:
        self.calls += 1
        if self.calls == 1:
            self.first_started.set()
            await asyncio.Event().wait()
        return b"audio"


class DisconnectAsr:
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.cancelled = False

    async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
        self.started.set()
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            self.cancelled = True
            raise
        return ""


def test_hotwords_message_updates_bias_list() -> None:
    client = HubClient("ws://x", tts=None, asr=FakeAsr())  # type: ignore[arg-type]
    asyncio.run(client._handle(FakeWs(), {"t": "asr.hotwords", "words": ["worktree", "digest", ""]}))
    assert client._hotwords == ["worktree", "digest"]  # 空串滤除


def test_recognize_receives_hotwords() -> None:
    asr = FakeAsr()
    client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
    client._hotwords = ["worktree", "digest"]
    asyncio.run(client._flush_mic(FakeWs(), "ses_01TESTHOTW0000000000000000", b"\x00\x00" * 3200))  # >=100ms 门槛
    assert asr.calls, "recognize 未被调用"
    assert asr.calls[0]["hotwords"] == ["worktree", "digest"]


def test_recognize_without_hotwords_passes_none() -> None:
    asr = FakeAsr()
    client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
    asyncio.run(client._flush_mic(FakeWs(), "ses_01TESTHOTW0000000000000000", b"\x00\x00" * 3200))
    assert asr.calls[0]["hotwords"] is None  # 空词表传 None(build_config 不带 corpus)


def test_health_uses_real_probe_state_not_provider_presence() -> None:
    client = HubClient("ws://x", tts=None, asr=FakeAsr(), asr_ready=False)  # type: ignore[arg-type]
    ws = HealthWs()
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(client._health_loop(ws))
    health = json.loads(ws.sent[0])
    assert health["asr"] == "degraded"
    assert health["tts"] == "down"
    assert health["identity"] == {
        "sourceRevision": "0" * 40,
        "buildId": "pipeline-000000000000",
        "protocolVersion": "1.0.0",
    }


def test_runtime_provider_failure_downgrades_health() -> None:
    client = HubClient("ws://x", tts=None, asr=FailingAsr())  # type: ignore[arg-type]
    asyncio.run(client._flush_mic(FakeWs(), "ses_01TESTHOTW0000000000000000", b"\x00\x00" * 3200))
    assert client._asr_ready is False


def test_tts_timeout_downgrades_health(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(hub_client_module, "TTS_TIMEOUT_S", 0.01)
    client = HubClient("ws://x", tts=HangingTts(), asr=None)  # type: ignore[arg-type]

    async def run() -> None:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        await queue.put({"text": "probe", "sentenceId": "sent_1"})
        client._say_queues["ses_1"] = queue
        await client._say_worker(FakeWs(), "ses_1")

    asyncio.run(run())
    assert client._tts_ready is False


def test_tts_empty_audio_skips_sentence_health_kept() -> None:
    # F04(2026-08-04 合同变更):单句空音频=重试后跳过,不降级全局 health
    # (旧行为"单句空即 tts_ready=False"正是 E2 实测的 tts=down 误报根因)
    client = HubClient("ws://x", tts=EmptyTts(), asr=None)  # type: ignore[arg-type]
    client._tts_ready = True

    async def run() -> None:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        await queue.put({"text": "probe", "sentenceId": "sent_1"})
        client._say_queues["ses_1"] = queue
        await client._say_worker(FakeWs(), "ses_1")

    asyncio.run(run())
    assert client._tts_ready is True


def test_tts_empty_audio_retries_stripped_quotes() -> None:
    # F04:引号包裹句空音频 → 剥引号重试成功
    class QuoteSensitiveTts:
        def __init__(self) -> None:
            self.calls: list[str] = []

        async def synthesize(self, text: str) -> bytes:
            self.calls.append(text)
            return b"" if ("\u201c" in text or "“" in text) else b"mp3"

    tts = QuoteSensitiveTts()
    client = HubClient("ws://x", tts=tts, asr=None)  # type: ignore[arg-type]

    async def run() -> None:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        await queue.put({"text": "用“模型评估”作为关键词", "sentenceId": "sent_q"})
        client._say_queues["ses_1"] = queue
        await client._say_worker(FakeWs(), "ses_1")

    asyncio.run(run())
    assert len(tts.calls) == 2
    assert client._tts_ready is True


def test_reconnect_cancels_old_tts_worker_and_new_message_uses_new_socket() -> None:
    tts = ReconnectTts()
    client = HubClient("ws://x", tts=tts, asr=None)  # type: ignore[arg-type]
    old_ws = FakeWs()
    new_ws = FakeWs()

    async def run() -> None:
        await client._handle(
            old_ws,
            {"t": "tts.say", "sessionId": "ses_1", "sentenceId": "old_1", "text": "旧连接"},
        )
        await tts.first_started.wait()
        await client._reset_connection_tasks()
        await client._handle(
            new_ws,
            {"t": "tts.say", "sessionId": "ses_1", "sentenceId": "new_1", "text": "新连接"},
        )
        await client._say_workers["ses_1"]

    asyncio.run(run())
    assert tts.calls == 2
    assert old_ws.sent == []
    assert len(new_ws.sent) == 1
    assert isinstance(new_ws.sent[0], bytes)


def test_disconnect_cancels_inline_hands_free_asr_before_reconnect() -> None:
    asr = DisconnectAsr()
    client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
    client._active_sid = "ses_1"

    async def run() -> None:
        disconnected = asyncio.Event()

        async def wait_closed() -> None:
            await disconnected.wait()

        disconnect_task = asyncio.create_task(wait_closed())
        guarded = asyncio.create_task(
            client._run_while_connected(
                disconnect_task,
                client._recognize_hands_free(FakeWs(), b"\x00\x00" * 3200),
            )
        )
        await asr.started.wait()
        disconnected.set()
        with pytest.raises(OSError, match="disconnected"):
            await guarded

    asyncio.run(run())
    assert asr.cancelled is True


def test_disconnect_cancels_every_ptt_chain_task() -> None:
    asr = DisconnectAsr()
    client = HubClient("ws://x", tts=None, asr=asr)  # type: ignore[arg-type]
    old_ws = FakeWs()

    async def run() -> None:
        pcm = b"\x00\x00" * 3200
        client._spawn_ptt_flush(old_ws, "ses_1", pcm)
        first = client._asr_task
        assert first is not None
        await asr.started.wait()
        client._spawn_ptt_flush(old_ws, "ses_1", pcm)
        tail = client._asr_task
        assert tail is not None and tail is not first
        sent_before_reset = len(old_ws.sent)

        await client._reset_connection_tasks()

        assert first.cancelled()
        assert tail.cancelled()
        assert len(old_ws.sent) == sent_before_reset

    asyncio.run(run())
    assert asr.cancelled is True


def test_disconnect_clears_connection_scoped_audio_and_session_state() -> None:
    client = HubClient("ws://x", tts=None, asr=None)
    client._mode = "hands_free"
    client._active_sid = "ses_1"
    client._mic_buf = [b"old"]
    client._pending_text = "旧连接未决文本"
    client._last_turn_id["ses_1"] = "turn-old"
    client._tts_first_byte_sent.add("ses_1")
    client._vad.feed(b"\x01\x00" * 100)

    asyncio.run(client._reset_connection_tasks())

    assert client._mode == "ptt"
    assert client._active_sid == ""
    assert client._mic_buf == []
    assert client._pending_text == ""
    assert client._last_turn_id == {}
    assert client._tts_first_byte_sent == set()
