"""实际 VAD、读循环和 WS 背压下的所属会话验证，无网络/真实 ASR。"""
import asyncio
import json
import struct

import pytest
from test_vad_handsfree import LOUD, QUIET, FakeAsr

import saydo_pipeline.hub_client as module


class ReadLoopWs:
    def __init__(self):
        self.input = asyncio.Queue()
        self.blocked = asyncio.Event()
        self.release = asyncio.Event()
        self.after_mode = asyncio.Event()
        self.closed = asyncio.Event()
        self.sent = []
        self.mode_seen = False

    async def send(self, raw):
        msg = json.loads(raw)
        self.sent.append(msg)
        if msg.get("t") == "vad.speech" and msg.get("phase") == "start" and not self.blocked.is_set():
            self.blocked.set()
            await self.release.wait()

    async def recv(self):
        return json.dumps({"t": "hello.ack"})

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def wait_closed(self):
        await self.closed.wait()

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.mode_seen:
            self.after_mode.set()
        raw = await self.input.get()
        if raw is None:
            raise StopAsyncIteration
        if isinstance(raw, str) and json.loads(raw).get("sessionId") == "new":
            self.mode_seen = True
        return raw


def pcm(seq, data):
    return bytes([1]) + struct.pack(">I", seq) + data


@pytest.mark.parametrize("mode", ["hands_free", "ptt"])
def test_old_queued_pcm_does_not_enter_new_owner(mode, monkeypatch):
    async def scenario():
        ws = ReadLoopWs()
        asr = FakeAsr(["旧主题合成稿"])
        client = module.HubClient("ws://unused", tts=None, asr=asr)
        client._mode = "hands_free"
        client._active_sid = "old"
        monkeypatch.setattr(module.websockets, "connect", lambda *a, **k: ws)
        task = asyncio.create_task(client._run_once())
        try:
            for i in range(3): await ws.input.put(pcm(i, LOUD))
            await asyncio.wait_for(ws.blocked.wait(), 1)
            for i in range(5): await ws.input.put(pcm(i + 3, LOUD))
            for i in range(45): await ws.input.put(pcm(i + 8, QUIET))
            await ws.input.put(json.dumps({"t": "voice.mode", "sessionId": "new", "mode": mode}))
            await asyncio.wait_for(ws.after_mode.wait(), 1)
            queued = list(client._connection_tasks)
            ws.release.set()
            await asyncio.wait_for(asyncio.gather(*queued), 2)
            assert asr.calls == []
            assert not [m for m in ws.sent if m.get("t") == "asr.final" and m.get("sessionId") == "new"]
            assert not [m for m in ws.sent if m.get("t") == "vad.speech" and m.get("sessionId") == "new"]
            if mode == "hands_free":
                for i, data in enumerate([LOUD] * 20 + [QUIET] * 45):
                    await client._feed_vad_locked(ws, data, ("new", client._speech_generation, client._connection_epoch, mode))
                await client._await_owned_asr("new", client._speech_generation)
                assert len(asr.calls) == 1
                assert any(m.get("t") == "asr.final" and m.get("sessionId") == "new" for m in ws.sent)
        finally:
            ws.release.set()
            await ws.input.put(None)
            await asyncio.wait_for(task, 2)
    asyncio.run(scenario())
