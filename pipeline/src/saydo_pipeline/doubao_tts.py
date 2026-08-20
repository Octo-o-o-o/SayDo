"""doubao seed-tts-2.0 v3 双向流式客户端(Python 移植;协议同 e2e/spikes/asr-1.0/doubao-tts.mjs,
上游来源 = owner repo-demo-recorder 实现,07 D5 指定复用)。

无状态、每句一连接(P0 简化;双向流式长连接优化留 P1)。
"""

from __future__ import annotations

import json
import struct
import uuid
from dataclasses import dataclass

import websockets

MSG_FULL_CLIENT = 0b0001
MSG_FULL_SERVER = 0b1001
MSG_AUDIO_ONLY = 0b1011
MSG_ERROR = 0b1111
FLAG_WITH_EVENT = 0b100

EV_START_CONNECTION = 1
EV_FINISH_CONNECTION = 2
EV_CONNECTION_STARTED = 50
EV_CONNECTION_FAILED = 51
EV_START_SESSION = 100
EV_FINISH_SESSION = 102
EV_SESSION_STARTED = 150
EV_SESSION_FINISHED = 152
EV_SESSION_FAILED = 153
EV_TASK_REQUEST = 200
EV_TTS_RESPONSE = 352

_NO_SESSION_EVENTS = {EV_START_CONNECTION, EV_FINISH_CONNECTION, EV_CONNECTION_STARTED, EV_CONNECTION_FAILED, 52}


def _encode(event: int, session_id: str = "", payload: str = "{}") -> bytes:
    header = bytes([0x11, (MSG_FULL_CLIENT << 4) | FLAG_WITH_EVENT, 0x10, 0x00])
    body = struct.pack(">i", event)
    if event not in _NO_SESSION_EVENTS:
        sid = session_id.encode()
        body += struct.pack(">I", len(sid)) + sid
    pb = payload.encode()
    body += struct.pack(">I", len(pb)) + pb
    return header + body


@dataclass
class _Msg:
    type: int
    event: int
    payload: bytes


def _decode(data: bytes) -> _Msg:
    header_size = (data[0] & 0x0F) * 4
    mtype = data[1] >> 4
    flag = data[1] & 0x0F
    off = header_size
    if mtype in (MSG_FULL_CLIENT, MSG_FULL_SERVER, MSG_AUDIO_ONLY):
        if flag in (0b1, 0b11):
            off += 4
    elif mtype == MSG_ERROR:
        off += 4
    event = 0
    if flag == FLAG_WITH_EVENT:
        event = struct.unpack(">i", data[off : off + 4])[0]
        off += 4
        if event not in _NO_SESSION_EVENTS:
            n = struct.unpack(">I", data[off : off + 4])[0]
            off += 4 + n
        if event in (EV_CONNECTION_STARTED, EV_CONNECTION_FAILED, 52):
            n = struct.unpack(">I", data[off : off + 4])[0]
            off += 4 + n
    payload = b""
    if off + 4 <= len(data):
        n = struct.unpack(">I", data[off : off + 4])[0]
        off += 4
        payload = data[off : off + n]
    return _Msg(mtype, event, payload)


class DoubaoTts:
    """每句一连接的合成客户端;synthesize 产出 (mp3_bytes, first_packet_ms)。"""

    def __init__(
        self,
        api_key: str,
        resource_id: str = "seed-tts-2.0",
        model: str = "seed-tts-2.0-expressive",
        voice: str = "zh_female_tianmeiyueyue_uranus_bigtts",
        sample_rate: int = 24000,
        endpoint: str = "wss://openspeech.bytedance.com/api/v3/tts/bidirection",
    ) -> None:
        self.api_key = api_key
        self.resource_id = resource_id
        self.model = model
        self.voice = voice
        self.sample_rate = sample_rate
        self.endpoint = endpoint

    async def synthesize(self, text: str) -> bytes:

        headers = {
            "X-Api-Key": self.api_key,
            "X-Api-Resource-Id": self.resource_id,
            "X-Api-Connect-Id": str(uuid.uuid4()),
        }
        session_id = str(uuid.uuid4())
        async with websockets.connect(self.endpoint, additional_headers=headers, max_size=None, proxy=None) as ws:
            await ws.send(_encode(EV_START_CONNECTION))
            while True:
                m = _decode(await ws.recv())
                if m.event == EV_CONNECTION_STARTED:
                    break
                if m.type == MSG_ERROR or m.event == EV_CONNECTION_FAILED:
                    raise RuntimeError(f"doubao connect failed: {m.payload[:200]!r}")
            await ws.send(
                _encode(
                    EV_START_SESSION,
                    session_id,
                    json.dumps(
                        {
                            "req_params": {
                                "model": self.model,
                                "speaker": self.voice,
                                "audio_params": {
                                    "format": "mp3",
                                    "sample_rate": self.sample_rate,
                                    "enable_subtitle": False,
                                },
                                "additions": json.dumps(
                                    {"disable_markdown_filter": True, "explicit_language": "zh-cn"}
                                ),
                            }
                        }
                    ),
                )
            )
            while True:
                m = _decode(await ws.recv())
                if m.event == EV_SESSION_STARTED:
                    break
                if m.type == MSG_ERROR or m.event == EV_SESSION_FAILED:
                    raise RuntimeError(f"doubao session failed: {m.payload[:200]!r}")
            await ws.send(_encode(EV_TASK_REQUEST, session_id, json.dumps({"req_params": {"text": text}})))
            await ws.send(_encode(EV_FINISH_SESSION, session_id))
            chunks: list[bytes] = []
            while True:
                m = _decode(await ws.recv())
                if m.type == MSG_ERROR or m.event == EV_SESSION_FAILED:
                    raise RuntimeError(f"doubao tts failed: {m.payload[:200]!r}")
                if m.event == EV_TTS_RESPONSE and m.type == MSG_AUDIO_ONLY:
                    chunks.append(m.payload)
                if m.event == EV_SESSION_FINISHED:
                    break
            await ws.send(_encode(EV_FINISH_CONNECTION))
            return b"".join(chunks)
