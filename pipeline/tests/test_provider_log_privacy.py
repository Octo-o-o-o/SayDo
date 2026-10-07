"""真实 TTS decoder/producer → worker → JSON logger 的合成故障注入，无网络。"""
import asyncio
import json
import struct

import pytest

import saydo_pipeline.doubao_tts as provider
from saydo_pipeline.hub_client import HubClient, log

TEXT = "SYNTHETIC_TRANSCRIPT_CANARY_20261003"
KEY = "SYNTHETIC_KEY_CANARY_20261003"


def frame(event: int, payload: bytes = b"{}") -> bytes:
    body = struct.pack(">i", event)
    if event not in provider._NO_SESSION_EVENTS:
        body += struct.pack(">I", 0)
    if event in (50, 51, 52):
        body += struct.pack(">I", 0)
    return bytes([0x11, (provider.MSG_FULL_SERVER << 4) | provider.FLAG_WITH_EVENT, 0x10, 0]) + body + struct.pack(">I", len(payload)) + payload


def error_frame(payload: bytes) -> bytes:
    return bytes([0x11, provider.MSG_ERROR << 4, 0x10, 0]) + struct.pack(">I", 400) + struct.pack(">I", len(payload)) + payload


class ProviderWs:
    def __init__(self, frames: list[bytes]) -> None:
        self.frames = frames
        self.sent: list[bytes] = []

    async def send(self, data: bytes) -> None:
        self.sent.append(data)

    async def recv(self) -> bytes:
        return self.frames.pop(0)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class HubWs:
    def __init__(self) -> None:
        self.sent: list[str | bytes] = []

    async def send(self, data: str | bytes) -> None:
        self.sent.append(data)


@pytest.mark.parametrize("stage", ["connect", "session", "tts"])
@pytest.mark.parametrize("echo", [False, True])
def test_provider_fault_does_not_echo_text_or_key(stage, echo, monkeypatch, capsys):
    payload = json.dumps({"text": TEXT, "key": KEY}).encode() if echo else b"invalid request"
    frames = ([] if stage == "connect" else [frame(50)]) + ([] if stage != "tts" else [frame(150)]) + [error_frame(payload)]
    fake = ProviderWs(frames)
    monkeypatch.setattr(provider.websockets, "connect", lambda *a, **k: fake)

    async def scenario():
        client = HubClient("ws://unused", tts=provider.DoubaoTts(KEY))
        ws = HubWs()
        client._say_queues["sid"] = asyncio.Queue()
        await client._say_queues["sid"].put({"text": TEXT, "sentenceId": "s-evt_40-0"})
        await client._say_worker(ws, "sid")
        assert not client._tts_ready
        assert ws.sent == []
    asyncio.run(scenario())
    raw = capsys.readouterr().err
    assert TEXT not in raw and KEY not in raw
    record = json.loads(raw)
    assert record["error_type"] == "RuntimeError"
    assert len(record["error_digest"]) == 64 and "error" not in record


def test_logger_fences_arbitrary_provider_exception_text(capsys):
    log("error", "tts failed", error=RuntimeError(f"{TEXT} {KEY}"), bytes=9)
    raw = capsys.readouterr().err
    assert TEXT not in raw and KEY not in raw
    assert json.loads(raw)["bytes"] == 9
