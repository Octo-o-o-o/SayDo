"""pipeline 进程入口(1.2):WS client 连 daemon 语音中枢;TTS=doubao(key 缺失则降级 down)。"""

import asyncio
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

from .doubao_asr import DoubaoAsr
from .doubao_tts import DoubaoTts
from .hub_client import HubClient, log, pcm16_to_wav
from .platform import install_stop_signal, saydo_state_root


def read_env_key(name: str) -> str | None:
    """读 SAYDO_HOME/.env 的 key(支持行尾注释;与 daemon 侧口径一致)。"""
    env_path = saydo_state_root() / ".env"
    if os.environ.get(name):
        return os.environ[name]
    if not env_path.exists():
        return None
    m = re.search(rf"^{name}=(.+)$", env_path.read_text(), re.MULTILINE)
    if not m:
        return None
    return m.group(1).split("#")[0].strip() or None


def read_cap_token() -> str | None:
    """G1(4.1):读 SAYDO_HOME/.cap-token 带 ?token= 连 daemon。"""
    p = saydo_state_root() / ".cap-token"
    if p.exists():
        t = p.read_text().strip()
        return t or None
    return None


def state_root_digest() -> str:
    return hashlib.sha256(str(saydo_state_root()).encode()).hexdigest()


def loaded_runtime_sha() -> str:
    """返回构建注入或当前源码 revision；不再作为 daemon 兼容等值判据。"""
    configured = os.environ.get("SAYDO_SOURCE_REVISION", "").strip()
    if configured:
        if not re.fullmatch(r"[0-9a-f]{7,64}", configured):
            raise RuntimeError(f"invalid SAYDO_SOURCE_REVISION:{configured}")
        return configured
    runtime_root = Path(__file__).resolve().parents[3]
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=runtime_root,
        check=True,
        capture_output=True,
        text=True,
    )
    sha = result.stdout.strip()
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise RuntimeError(f"invalid runtime SHA:{sha}")
    return sha


def self_exec_reread_env() -> None:
    """first-run onboarding v4:self-exec 重读 .env(os.execv 替换本进程)。"""
    # 清除可能已注入的密钥 env,让新进程从 .env 重读(process env 优先于 .env 的 read_env_key)
    for name in ("DOUBAO_TTS_API_KEY", "VOLC_APP_ID", "VOLC_ACCESS_TOKEN"):
        # 仅当值来自旧 .env 注入时才清;若用户显式 export 则保留——保守:不主动 del process env
        # 实际重读:read_env_key 先看 os.environ;若旧值仍在则仍用旧值。
        # 为让 .env.pending 晋升后的新 .env 生效,清掉这几个 key 的 process env 缓存。
        os.environ.pop(name, None)
    argv = [sys.executable, *sys.argv]
    log("info", "pipeline self-exec", argv0=argv[0], generation=os.environ.get("SAYDO_PIPELINE_GENERATION"))
    os.execv(sys.executable, argv)


async def main() -> None:
    daemon_port = os.environ.get("SAYDO_DAEMON_PORT", "47100")
    cap = read_cap_token()
    suffix = f"?token={cap}" if cap else ""
    url = f"ws://127.0.0.1:{daemon_port}/ws/voice{suffix}"
    key = read_env_key("DOUBAO_TTS_API_KEY")
    tts = DoubaoTts(key) if key else None
    app_id = read_env_key("VOLC_APP_ID")
    access_token = read_env_key("VOLC_ACCESS_TOKEN")
    asr = DoubaoAsr(app_id, access_token) if app_id and access_token else None
    gen_raw = os.environ.get("SAYDO_PIPELINE_GENERATION")
    generation: int | None = None
    if gen_raw and gen_raw.isdigit():
        generation = int(gen_raw)
    log(
        "info",
        "pipeline starting",
        daemon=url.split("?")[0],
        tts="doubao" if tts else "disabled",
        asr="volc-sauc" if asr else "disabled",
        generation=generation,
    )

    async def probe_asr() -> bool:
        if not asr:
            return False
        try:
            await asyncio.wait_for(asr.recognize(pcm16_to_wav(b"\0" * 3200), timeout_s=15), 20)
            return True
        except Exception as error:  # noqa: BLE001 provider 探活失败必须进入 readyz
            log("error", "asr startup probe failed", error=str(error)[:200])
            return False

    async def probe_tts() -> bool:
        if not tts:
            return False
        try:
            audio = await asyncio.wait_for(tts.synthesize("语音服务探活"), 20)
            return bool(audio)
        except Exception as error:  # noqa: BLE001 provider 探活失败必须进入 readyz
            log("error", "tts startup probe failed", error=str(error)[:200])
            return False

    asr_ready, tts_ready = await asyncio.gather(probe_asr(), probe_tts())
    client = HubClient(
        url,
        tts,
        asr,
        loaded_runtime_sha(),
        state_root_digest(),
        asr_ready=asr_ready,
        tts_ready=tts_ready,
    )
    if generation is not None:
        client.generation = generation
    run_task = asyncio.create_task(client.run_forever())

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    install_stop_signal(loop, stop)

    # 等 stop 信号或 restart 完成(run_forever 因 restart 返回)
    stop_task = asyncio.create_task(stop.wait())
    _done, pending = await asyncio.wait(
        {run_task, stop_task},
        return_when=asyncio.FIRST_COMPLETED,
    )
    for t in pending:
        t.cancel()
    await asyncio.gather(*pending, return_exceptions=True)
    if not run_task.done():
        run_task.cancel()
        await asyncio.gather(run_task, return_exceptions=True)

    # restart_pending 路径:HubClient 置标志后 run_forever 返回 → self-exec 重读 .env
    if client._restart_requested:
        if client.generation is not None:
            os.environ["SAYDO_PIPELINE_GENERATION"] = str(client.generation)
        self_exec_reread_env()
    log("info", "pipeline stopping")


if __name__ == "__main__":
    asyncio.run(main())
