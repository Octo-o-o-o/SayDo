# 5.3 音频烟测 5 条(真管线 sauc 流式识别 + 术语命中断言)。
# 底板两套(W1.1 收编 ~/.saydo/owner-audio/rerun-smoke.py 的重打包与多格式逻辑):
#   --profile synthetic(缺省):1.0 种子语料合成音(e2e/spikes/asr-1.0/audio,mp3)
#   --profile owner:真人底板(~/.saydo/owner-audio,m4a;R45 两条稳定误听登记为 known-miss)
#   --audio-dir <path>:任意目录覆盖(known-miss 清单为空)
# 关键实测知识(R45,详见 HANDOFF §5):afconvert 从 m4a 转 wav 产 WAVEFORMATEXTENSIBLE 头
# (fmt chunk 40 字节),sauc 整段识别对该头返回 audio_info.duration=0 + 空文本(不报错);
# mp3 源转出经典头(fmt=16)故合成底板从未踩坑——统一重打包经典 44 字节 PCM 头。
# 用法:python3 e2e/smoke/audio-smoke-5.py [--profile owner] [--audio-dir PATH](读 ~/.saydo/.env 三元组)

import argparse
import asyncio
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "pipeline" / "src"))
from saydo_pipeline.doubao_asr import DoubaoAsr  # noqa: E402

CLIPS = [
    ("a01", ["contracts", "digest"]),
    ("a02", ["ready for review"]),
    ("a04", ["pnpm install"]),
    ("a13", ["settle barrier", "proof"]),
    ("a20", ["Gate 0", "dispatch"]),
]
HOTWORDS = ["contracts", "digest", "ready for review", "pnpm", "settle barrier", "proof", "Gate 0", "dispatch", "worktree", "daemon"]

SYNTHETIC_DIR = Path(__file__).resolve().parents[1] / "spikes" / "asr-1.0" / "audio"
OWNER_DIR = Path.home() / ".saydo" / "owner-audio"
# R45 真人底板稳定误听(两次复跑一致):a13 "settle barrier"->"strawberry"、a20 "Gate 0"->"get 0"。
# 已入 golden 回归集(W1.2);热词调优拉回后从此清单移除(输出会标 [recovered] 提示)。
OWNER_KNOWN_MISSES = {"a13", "a20"}


def read_env() -> tuple[str, str]:
    env_path = Path.home() / ".saydo" / ".env"
    kv: dict[str, str] = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            kv[k.strip()] = v.strip().strip('"')
    app_id = kv.get("VOLC_APP_ID", "")
    token = kv.get("VOLC_ACCESS_TOKEN", "")
    if not app_id or not token:
        raise SystemExit("[fail] VOLC_APP_ID/VOLC_ACCESS_TOKEN 未配置")
    return app_id, token


def to_classic_wav(src: Path) -> bytes:
    """任意源(m4a/wav/mp3)-> afconvert 16k mono s16 -> 提取 data chunk -> 经典 44 字节 PCM 头重打包。"""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        out = Path(f.name)
    subprocess.run(
        ["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", str(src), str(out)],
        check=True,
        capture_output=True,
    )
    d = out.read_bytes()
    out.unlink()
    off, pcm = 12, None
    while off + 8 <= len(d):
        cid = d[off : off + 4]
        size = struct.unpack("<I", d[off + 4 : off + 8])[0]
        if cid == b"data":
            pcm = d[off + 8 : off + 8 + size]
            break
        off += 8 + size + (size & 1)
    if not pcm:
        raise SystemExit(f"[fail] {src.name} 无 data chunk")
    hdr = (
        b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE"
        + b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, 16000, 32000, 2, 16)
        + b"data" + struct.pack("<I", len(pcm))
    )
    return hdr + pcm


def find_clip(audio_dir: Path, clip: str) -> Path | None:
    for ext in (".m4a", ".wav", ".mp3"):
        p = audio_dir / f"{clip}{ext}"
        if p.exists():
            return p
    return None


def norm(s: str) -> str:
    return "".join(ch for ch in s.lower() if ch.isalnum())


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", choices=["synthetic", "owner"], default="synthetic")
    ap.add_argument("--audio-dir", type=Path, default=None, help="覆盖底板目录(known-miss 清单为空)")
    args = ap.parse_args()

    if args.audio_dir is not None:
        audio_dir, known_misses, label = args.audio_dir, set(), f"自定义底板 {args.audio_dir}"
    elif args.profile == "owner":
        audio_dir, known_misses, label = OWNER_DIR, set(OWNER_KNOWN_MISSES), "真人底板"
    else:
        audio_dir, known_misses, label = SYNTHETIC_DIR, set(), "合成底板"

    app_id, token = read_env()
    asr = DoubaoAsr(app_id, token)
    passed = 0
    unexpected_miss = 0
    lines: list[str] = []
    for clip, terms in CLIPS:
        src = find_clip(audio_dir, clip)
        if not src:
            unexpected_miss += 1
            lines.append(f"[miss] {clip}: 音频文件缺失({audio_dir})")
            continue
        text = await asr.recognize(to_classic_wav(src), hotwords=HOTWORDS)
        hits = [t for t in terms if norm(t) in norm(text)]
        ok = len(hits) == len(terms)
        if ok:
            passed += 1
            tag = "recovered" if clip in known_misses else "ok"
        elif clip in known_misses:
            tag = "known-miss"
        else:
            tag = "miss"
            unexpected_miss += 1
        lines.append(f"[{tag}] {clip}: \"{text}\" 术语命中 {len(hits)}/{len(terms)}")
    print("\n".join(lines))
    baseline = len(CLIPS) - len(known_misses)
    print(
        f"[{'ok' if passed >= baseline else 'partial'}] 音频烟测 {passed}/{len(CLIPS)}"
        f"({label};known-miss {len(known_misses)} 条,基线 = 非 known-miss 全过)"
    )
    # 退出语义 = 与已知基线一致性:known-miss 之外允许 1 条术语抖动;超出视为环境/键/回退问题。
    if unexpected_miss > 1:
        raise SystemExit(1)


asyncio.run(main())
