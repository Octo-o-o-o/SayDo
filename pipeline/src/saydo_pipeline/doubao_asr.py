"""火山豆包 bigmodel 流式语音识别(sauc)客户端(ADR-101 定档;计划 1.2 补完/2.4 偏置接线)。

协议 = v3 二进制流式 WebSocket(与 doubao_tts.py 同族,方向相反:发音频收文本),
实测见 e2e/spikes/asr-1.0/RESULT.md(60 条跑分;热词偏置 +10 点术语召回)。

- 鉴权:经典三元组 X-Api-App-Key(VOLC_APP_ID)+ X-Api-Access-Key(VOLC_ACCESS_TOKEN)。
- 音频:wav/pcm 16k mono(mp3 整段直发会尾截断,ADR-101 已实测禁用)。
- 热词:request.corpus.context 内联 {"hotwords":[{"word":...}]};词表来源 = daemon 侧
  HotwordStore.biasTerms(P0 = M0 热词;奠基 seedTerms 经 extraSeeds 预留,生产接线挂账 dogfood 期)。
- P0 = PTT 整段识别 recognize();实时分片流式 P1(VAD 免手)。
"""

from __future__ import annotations

import asyncio
import gzip
import json
import struct
import uuid

import websockets

ENDPOINT = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel"
RESOURCE_ID = "volc.bigasr.sauc.duration"

_MSG_FULL_CLIENT = 0b0001
_MSG_AUDIO_ONLY = 0b0010
_MSG_SERVER_ERROR = 0b1111
_FLAG_POS_SEQ = 0b0001
_FLAG_NEG_SEQ_LAST = 0b0011
_SERIAL_JSON = 0b0001
_SERIAL_RAW = 0b0000
_COMPRESS_GZIP = 0b0001


def _header(msg_type: int, flags: int, serial: int, compress: int = _COMPRESS_GZIP) -> bytes:
    return bytes([0x11, (msg_type << 4) | flags, (serial << 4) | compress, 0x00])


def encode_config_frame(config: dict) -> bytes:
    payload = gzip.compress(json.dumps(config).encode())
    return (
        _header(_MSG_FULL_CLIENT, _FLAG_POS_SEQ, _SERIAL_JSON)
        + struct.pack(">i", 1)
        + struct.pack(">I", len(payload))
        + payload
    )


def encode_final_audio_frame(audio: bytes) -> bytes:
    payload = gzip.compress(audio)
    return (
        _header(_MSG_AUDIO_ONLY, _FLAG_NEG_SEQ_LAST, _SERIAL_RAW)
        + struct.pack(">i", -2)
        + struct.pack(">I", len(payload))
        + payload
    )


def encode_audio_chunk_frame(audio: bytes, seq: int, last: bool) -> bytes:
    """分片音频帧(dogfood 长语音回修 2026-07-28:owner 22s 语音整段一发触发服务端
    55000000 内部 rpc timeout(timeout_config=3s)——流式接口按设计增量喂,尾帧负 seq)。"""
    payload = gzip.compress(audio)
    return (
        _header(_MSG_AUDIO_ONLY, _FLAG_NEG_SEQ_LAST if last else _FLAG_POS_SEQ, _SERIAL_RAW)
        + struct.pack(">i", -seq if last else seq)
        + struct.pack(">I", len(payload))
        + payload
    )


def parse_server_frame(data: bytes) -> tuple[int | None, bool, dict | None]:
    """返回 (error_code, is_last, payload)。"""
    b = bytes(data)
    msg_type = b[1] >> 4
    flags = b[1] & 0x0F
    compress = b[2] & 0x0F
    off = (b[0] & 0x0F) * 4
    seq = None
    if flags & 0b0011:
        seq = struct.unpack(">i", b[off : off + 4])[0]
        off += 4
    error_code = None
    if msg_type == _MSG_SERVER_ERROR:
        error_code = struct.unpack(">I", b[off : off + 4])[0]
        off += 4
    size = struct.unpack(">I", b[off : off + 4])[0]
    off += 4
    payload_raw = b[off : off + size]
    if compress == _COMPRESS_GZIP and payload_raw:
        try:
            payload_raw = gzip.decompress(payload_raw)
        except OSError:
            pass
    try:
        payload = json.loads(payload_raw.decode())
    except (ValueError, UnicodeDecodeError):
        payload = None
    is_last = (seq is not None and seq < 0) or flags in (0b0010, 0b0011)
    return error_code, is_last, payload


def build_config(hotwords: list[str] | None = None, *, rate: int = 16000) -> dict:
    request: dict = {"model_name": "bigmodel", "enable_punc": True}
    if hotwords:
        request["corpus"] = {
            "context": json.dumps({"hotwords": [{"word": w} for w in hotwords]}, ensure_ascii=False)
        }
    return {
        "user": {"uid": "saydo"},
        "audio": {"format": "wav", "rate": rate, "bits": 16, "channel": 1},
        "request": request,
    }


class DoubaoAsr:
    """每次识别一连接(P0 简化,与 DoubaoTts 同型)。"""

    def __init__(self, app_id: str, access_token: str) -> None:
        self.app_id = app_id
        self.access_token = access_token

    async def recognize(self, wav_audio: bytes, hotwords: list[str] | None = None, timeout_s: float = 20) -> str:
        """PTT 整段识别:16k mono wav -> 最终文本(enable_punc)。"""
        headers = {
            "X-Api-App-Key": self.app_id,
            "X-Api-Access-Key": self.access_token,
            "X-Api-Resource-Id": RESOURCE_ID,
            "X-Api-Request-Id": str(uuid.uuid4()),
        }
        # proxy=None(dogfood 尸检回修 2026-07-28):launchd GUI 域可能被系统代理工具(Clash/EC)注入
        # SOCKS 环境变量——websockets v14+ 会读取并因缺 python-socks 抛 ImportError(旧版曾穿刺杀死
        # 重连循环);语音链走火山国内端点,显式直连(不引代理依赖、不吃代理抖动)
        async with websockets.connect(ENDPOINT, additional_headers=headers, max_size=None, open_timeout=15, proxy=None) as ws:
            await ws.send(encode_config_frame(build_config(hotwords)))
            err, _, payload = parse_server_frame(await asyncio.wait_for(ws.recv(), timeout_s))
            if err is not None:
                raise RuntimeError(f"doubao asr config rejected: {err} {payload}")
            # 分片增量发送(dogfood 长语音回修 2026-07-28):整段一发时服务端对长真实语音报
            # 55000000 内部 rpc timeout(算子间预算 3s)——流式接口按设计每片 ~200ms 喂,
            # 服务端边收边识;发送不 sleep(TCP 序保证,快于实时是允许用法)。
            # 收包并发进行:服务端在收音频期间就会回中间结果,若只发不收,双方缓冲互等可成死锁。
            chunk_bytes = 6400  # 200ms @ 16k mono PCM16
            text = ""
            done = asyncio.Event()

            async def _recv_loop() -> None:
                nonlocal text
                for _ in range(4096):
                    err2, is_last, payload2 = parse_server_frame(await asyncio.wait_for(ws.recv(), timeout_s))
                    if err2 is not None:
                        raise RuntimeError(f"doubao asr server error: {err2} {payload2}")
                    if isinstance(payload2, dict):
                        t = payload2.get("result", {}).get("text", "")
                        if t:
                            text = t
                    if is_last:
                        done.set()
                        return
                raise RuntimeError("doubao asr: server never sent last frame")

            recv_task = asyncio.create_task(_recv_loop())
            try:
                n = max(1, (len(wav_audio) + chunk_bytes - 1) // chunk_bytes)
                for i in range(n):
                    chunk = wav_audio[i * chunk_bytes : (i + 1) * chunk_bytes]
                    await ws.send(encode_audio_chunk_frame(chunk, seq=i + 2, last=(i == n - 1)))
                await recv_task
            finally:
                if not recv_task.done():
                    recv_task.cancel()
            return text
