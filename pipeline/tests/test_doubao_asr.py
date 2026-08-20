# doubao_asr 协议帧构造/解析单测(离线;真实识别见 e2e/spikes/asr-1.0 跑分)。

import gzip
import json
import struct

from saydo_pipeline.doubao_asr import (
    build_config,
    encode_config_frame,
    encode_final_audio_frame,
    parse_server_frame,
)


def test_config_frame_shape():
    frame = encode_config_frame(build_config(["worktree", "digest"]))
    assert frame[0] == 0x11
    assert frame[1] == (0b0001 << 4) | 0b0001  # full client + pos seq
    assert frame[2] == (0b0001 << 4) | 0b0001  # json + gzip
    assert struct.unpack(">i", frame[4:8])[0] == 1
    size = struct.unpack(">I", frame[8:12])[0]
    cfg = json.loads(gzip.decompress(frame[12 : 12 + size]))
    assert cfg["audio"]["format"] == "wav"
    hot = json.loads(cfg["request"]["corpus"]["context"])
    assert {"word": "worktree"} in hot["hotwords"]


def test_config_without_hotwords_has_no_corpus():
    cfg = build_config(None)
    assert "corpus" not in cfg["request"]
    cfg2 = build_config([])
    assert "corpus" not in cfg2["request"]


def test_final_audio_frame_shape():
    frame = encode_final_audio_frame(b"PCMDATA")
    assert frame[0] == 0x11
    assert frame[1] == (0b0010 << 4) | 0b0011  # audio only + neg seq(last)
    assert struct.unpack(">i", frame[4:8])[0] == -2
    size = struct.unpack(">I", frame[8:12])[0]
    assert gzip.decompress(frame[12 : 12 + size]) == b"PCMDATA"


def _server_frame(seq: int, payload: dict, flags: int) -> bytes:
    pl = gzip.compress(json.dumps(payload).encode())
    return (
        bytes([0x11, (0b1001 << 4) | flags, 0x11, 0x00])
        + struct.pack(">i", seq)
        + struct.pack(">I", len(pl))
        + pl
    )


def test_parse_server_response_and_last():
    err, is_last, payload = parse_server_frame(_server_frame(1, {"result": {"text": "部分"}}, 0b0001))
    assert err is None and is_last is False
    assert payload["result"]["text"] == "部分"

    err, is_last, payload = parse_server_frame(_server_frame(-2, {"result": {"text": "完整句。"}}, 0b0011))
    assert err is None and is_last is True
    assert payload["result"]["text"] == "完整句。"


def test_parse_server_error_frame():
    msg = gzip.compress(json.dumps({"error": "not granted"}).encode())
    frame = (
        bytes([0x11, (0b1111 << 4) | 0b0000, 0x11, 0x00])
        + struct.pack(">I", 45000030)
        + struct.pack(">I", len(msg))
        + msg
    )
    err, _, payload = parse_server_frame(frame)
    assert err == 45000030
    assert payload["error"] == "not granted"


def test_new_turn_id_matches_id_schema():
    import re

    from saydo_pipeline.hub_client import new_turn_id

    ids = {new_turn_id() for _ in range(50)}
    assert len(ids) == 50  # 唯一性
    for i in ids:
        assert re.fullmatch(r"ses_[0-9A-HJKMNP-TV-Z]{26}", i), i


def test_pcm16_to_wav_riff_header():
    import struct

    from saydo_pipeline.hub_client import pcm16_to_wav

    pcm = b"\x01\x02" * 160
    wav = pcm16_to_wav(pcm)
    assert wav[:4] == b"RIFF" and wav[8:16] == b"WAVEfmt "
    assert struct.unpack("<I", wav[4:8])[0] == 36 + len(pcm)
    fmt = struct.unpack("<IHHIIHH", wav[16:36])
    assert fmt[1] == 1 and fmt[2] == 1 and fmt[3] == 16000 and fmt[6] == 16  # PCM/mono/16k/16bit
    assert wav[44:] == pcm
