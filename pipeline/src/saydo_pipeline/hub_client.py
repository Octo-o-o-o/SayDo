"""A1 语音管线 <-> daemon 的 WS client(09 §10 契约;计划 1.2)。

- 连接 daemon /ws/voice,hello {v:1, role:"pipeline"},断线指数退避重连(进程无状态可随时重启);
- 收 tts.say -> doubao 合成 -> 二进制帧(tag 0x02 + seq + mp3)回 daemon(console 播放);
- 收 barge_in -> 取消该 session 进行中/排队的合成任务(unheard 纪律的合成侧);
- ASR 侧(ADR-101,1.2 补完):mic 上行帧(0x01 + 4B seq + PCM16LE 16k)累积,
  收 turn.done_speaking(PTT 松开,hub 已路由)-> 封 WAV -> sauc 整段识别 -> asr.final 回 daemon;
  P0 单用户单活跃会话(G1 单用户假设),mic 缓冲不分会话;空缓冲跳过(注入通道自测兼容);
- W2 阶段 D(05 §4 提前批 #6):免手档——voice.mode 切换 ptt/hands_free;免手时 mic 帧过
  能量 VAD(vad.py):speech_start -> 发 vad.speech(console 播放侧触发 barge-in watermark 截断,
  unheard 纪律不变);utterance_end -> 识别 -> 语义 EOU 判"说完了没":完 ⇒ asr.final,
  未完 ⇒ 缓存拼接等续说(悬挂上限 EOU_HOLD_MS 硬终结);turn.done_speaking(说完了按钮)
  在免手档 = 强制终结(第三层兜底);
- 定时 pipeline.health(30s)。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
import struct
import sys
import time
from collections.abc import Coroutine
from typing import Any

import websockets

from .doubao_asr import DoubaoAsr
from .doubao_tts import DoubaoTts
from .hf_round import FinalSpec, HfRoundMachine, SegmentSlot
from .vad import EOU_HOLD_MS, EnergyVad

PROTOCOL_VERSION = 1
RUNTIME_PROTOCOL_VERSION = "1.0.0"
TTS_TIMEOUT_S = 30

_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _ulid_body() -> str:
    ts = int(time.time() * 1000)
    chars = []
    for _ in range(10):
        chars.append(_CROCKFORD[ts & 0x1F])
        ts >>= 5
    head = "".join(reversed(chars))
    tail = "".join(secrets.choice(_CROCKFORD) for _ in range(16))
    return f"{head}{tail}"


def new_turn_id() -> str:
    """ses_<ULID>(idSchema ^[a-z]{3}_[0-9A-HJKMNP-TV-Z]{26}$;daemon appendTurn 同前缀先例)。"""
    return f"ses_{_ulid_body()}"


def new_evt_id() -> str:
    """evt_<ULID>:hfSegmentId / hfRoundId。"""
    return f"evt_{_ulid_body()}"


# 与 daemon turnIdOfSentence 同一允许集。不匹配的系统句和任意字符串都不归属。
_ULID_BODY = r"[0-9A-HJKMNP-TV-Z]{26}"
_CONVERSATION_TURN = (
    rf"ses_{_ULID_BODY}"
    r"|evt_[0-9]+"
    r"|ctl-(?:confirmation_settled|downgrade_applied|expectation_adjusted)"
    r"-(?:[0-9A-HJKMNP-TV-Z]{8}|x)-[0-9a-z]+"
)
_TURN_RE = re.compile(rf"^(?:{_CONVERSATION_TURN})$")
_SENTENCE_TURN_RE = re.compile(rf"^s-({_CONVERSATION_TURN})-\d+$")
_SOURCE_TURN_KEY = "sourceTurnId"
_TTS_TURN_SEEN_MAX = 500


def turn_id_of_sentence(sentence_id: object) -> str | None:
    """s-<真实对话 turn>-<数字> 才返回 turn。系统句、占位 0 和任意字符串返回 None。"""
    if not isinstance(sentence_id, str):
        return None
    match = _SENTENCE_TURN_RE.fullmatch(sentence_id)
    if match is None:
        return None
    return match.group(1)


def bind_say_source_turn(msg: dict[str, Any]) -> dict[str, Any]:
    """入队时固定源 turn。回包只读这个绑定,不读最近 ASR。"""
    queued = dict(msg)
    queued[_SOURCE_TURN_KEY] = turn_id_of_sentence(msg.get("sentenceId"))
    return queued


def source_turn_of_say(say: dict[str, Any]) -> str | None:
    if _SOURCE_TURN_KEY in say:
        value = say.get(_SOURCE_TURN_KEY)
        if isinstance(value, str) and _TURN_RE.fullmatch(value):
            return value
        return None
    return turn_id_of_sentence(say.get("sentenceId"))


def pcm16_to_wav(pcm: bytes, rate: int = 16000) -> bytes:
    """PCM16LE mono -> RIFF WAV(sauc 要求 wav/pcm;mp3 会尾截断,ADR-101)。"""
    byte_rate = rate * 2
    return (
        b"RIFF"
        + struct.pack("<I", 36 + len(pcm))
        + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, rate, byte_rate, 2, 16)
        + b"data"
        + struct.pack("<I", len(pcm))
        + pcm
    )


def log(level: str, msg: str, **fields: object) -> None:
    record = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "level": level, "name": "pipeline", "msg": msg}
    record.update(fields)
    sys.stderr.write(json.dumps(record, ensure_ascii=False) + "\n")


class _OwnedAsr:
    """会话所有权下的一条识别工作。HF 绑 speech generation;PTT 绑连接纪元。"""

    __slots__ = ("connection_epoch", "generation", "kind", "sid", "task")

    def __init__(
        self,
        sid: str,
        generation: int,
        kind: str,
        task: asyncio.Task[None],
        connection_epoch: int,
    ) -> None:
        self.sid = sid
        self.generation = generation
        self.kind = kind
        self.task = task
        self.connection_epoch = connection_epoch


class _PttObligation:
    """一条 PTT 录音轮的终态。切档改变 speech generation 也不解除。"""

    __slots__ = ("capture_id", "connection_epoch", "outcome", "settled", "sid", "task")

    def __init__(
        self,
        sid: str,
        capture_id: str | None,
        connection_epoch: int,
        task: asyncio.Task[None],
    ) -> None:
        self.sid = sid
        self.capture_id = capture_id
        self.connection_epoch = connection_epoch
        self.task = task
        self.outcome: str | None = None
        self.settled = False


class HubClient:
    def __init__(
        self,
        url: str,
        tts: DoubaoTts | None,
        asr: DoubaoAsr | None = None,
        runtime_sha: str = "0" * 40,
        state_root_digest: str = "0" * 64,
        *,
        asr_ready: bool | None = None,
        tts_ready: bool | None = None,
    ) -> None:
        self.url = url
        self.tts = tts
        self.asr = asr
        self.runtime_sha = runtime_sha
        self.runtime_identity = {
            "sourceRevision": runtime_sha,
            "buildId": os.environ.get("SAYDO_BUILD_ID", f"pipeline-{runtime_sha[:12]}"),
            "protocolVersion": os.environ.get("SAYDO_PROTOCOL_VERSION", RUNTIME_PROTOCOL_VERSION),
        }
        self.state_root_digest = state_root_digest
        self._asr_ready = asr is not None if asr_ready is None else asr_ready
        self._tts_ready = tts is not None if tts_ready is None else tts_ready
        self._say_queues: dict[str, asyncio.Queue[dict[str, Any]]] = {}
        self._say_workers: dict[str, asyncio.Task[None]] = {}
        self._cancelled_sessions: set[str] = set()
        self._seq = 0
        self._mic_buf: list[bytes] = []
        # 最近 ASR 轮只作会话诊断。tts_first_byte 不读它。
        self._last_turn_id: dict[str, str] = {}
        # 已上报 tts_first_byte 的 turnId。按 turn 去重,超过上限丢最旧。
        self._tts_first_byte_sent: set[str] = set()
        self._tts_turn_order: list[str] = []
        # 热词偏置词表(接线批;daemon asr.hotwords 下发,recognize 请求组装消费——07 D4/ADR-101 +10 点术语召回)
        self._hotwords: list[str] = []
        # W2 阶段 D 免手档状态(P0 单活跃会话,与 mic 缓冲同假设)
        self._mode: str = "ptt"
        self._active_sid: str = ""
        self._vad = EnergyVad()
        self._pending_text: str = ""  # 已按 recordSeq 提交、尚未终态的正文镜像
        self._hf = HfRoundMachine(new_evt_id)
        self._eou_hold: asyncio.Task[None] | None = None
        # dogfood 冻结回修:PTT 识别任务化(读循环永不因 recognize 阻塞;新轮抢占旧任务)
        self._asr_task: asyncio.Task[None] | None = None
        # 每条 websocket 连接捕获的后台任务全集；断线必须全部 cancel + await，不能只记链尾。
        self._connection_tasks: set[asyncio.Task[None]] = set()
        # first-run onboarding v4:self-restart 世代(重连 hello/health 上报)
        self.generation: int | None = None
        self._restart_requested = False
        # 09 §10.1.6:本连接每 sid 未裁决识别失败标记,仅 discard+实际清理才清。
        self._unresolved_failures: dict[str, bool] = {}
        self._hf_task: asyncio.Task[None] | None = None
        self._vad_lock = asyncio.Lock()
        self._sid_inflight: dict[str, set[asyncio.Task[None]]] = {}
        # 识别所有权:HF 按 speech generation;PTT 按连接纪元。切档只退役免手。
        self._speech_generation: int = 0
        self._connection_epoch: int = 0
        self._owned_asr: set[_OwnedAsr] = set()
        self._ptt_obligations: set[_PttObligation] = set()
        self._retired_generations: set[int] = set()
        self._draining_sid: str | None = None
        self._drain_extra_pcm: list[bytes] = []
        self._quiesce_lock = asyncio.Lock()
        self._quiesce_inflight: dict[tuple[str, str], asyncio.Task[None]] = {}

    async def run_forever(self) -> None:
        backoff = 1.0
        while True:
            if self._restart_requested:
                return
            try:
                await self._run_once()
                backoff = 1.0
            except (OSError, websockets.WebSocketException) as err:
                if self._restart_requested:
                    return
                log("warn", "hub connection lost; reconnecting", error=str(err), backoff_s=backoff)
            except Exception as err:  # noqa: BLE001 冻结尸检回修
                # dogfood 冻结尸检回修(2026-07-28):此前只 catch 网络两类——任何其他异常穿透
                # while 杀死重连循环(进程活着、主循环死了、永不重连,且 launchd 看不出)。
                # catch-all 保"重连循环不死"这条命根;异常本身如实记日志。
                if self._restart_requested:
                    return
                log("error", "hub loop crashed; reconnecting", error=f"{type(err).__name__}: {str(err)[:200]}", backoff_s=backoff)
            if self._restart_requested:
                return
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)

    async def _run_once(self) -> None:
        async with websockets.connect(self.url, max_size=None, proxy=None) as ws:  # 本地直连,豁免系统代理注入
            hello: dict[str, Any] = {
                "v": PROTOCOL_VERSION,
                "role": "pipeline",
                "identity": self.runtime_identity,
            }
            if self.generation is not None:
                hello["generation"] = self.generation
            await ws.send(json.dumps(hello))
            ack = json.loads(await ws.recv())
            if ack.get("t") != "hello.ack":
                raise RuntimeError(f"unexpected hello response: {ack}")
            log("info", "connected to daemon voice hub", generation=self.generation)
            health_task = asyncio.create_task(self._health_loop(ws))
            disconnect_task = asyncio.create_task(ws.wait_closed())
            try:
                async for raw in ws:
                    if self._restart_requested:
                        break
                    if isinstance(raw, bytes):
                        # mic 上行帧:0x01 + 4B seq + PCM16LE(console 采集,hub 已路由)
                        if len(raw) > 5 and raw[0] == 0x01 and self.asr:
                            if self._mode == "hands_free":
                                task = self._track_connection_task(self._feed_vad_locked(ws, raw[5:]))
                                self._track_sid_task(self._active_sid, task)
                            else:
                                self._mic_buf.append(raw[5:])
                        continue
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    await self._run_while_connected(disconnect_task, self._handle(ws, msg))
                    if self._restart_requested:
                        break
            finally:
                health_task.cancel()
                disconnect_task.cancel()
                await asyncio.gather(health_task, disconnect_task, return_exceptions=True)
                await self._reset_connection_tasks()
        # restart_pending:正常返回,由 run_forever / main 做 self-exec

    async def _run_while_connected(
        self,
        disconnect_task: asyncio.Task[None],
        operation: Coroutine[Any, Any, None],
    ) -> None:
        """连接关闭与内联操作竞速；关闭先到时立即取消免手 ASR 等旧 socket 操作。"""
        operation_task = self._track_connection_task(operation)
        done, _ = await asyncio.wait(
            {operation_task, disconnect_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        if disconnect_task in done:
            operation_task.cancel()
            await asyncio.gather(operation_task, return_exceptions=True)
            raise OSError("daemon voice hub disconnected during pipeline operation")
        await operation_task

    def _track_connection_task(self, operation: Coroutine[Any, Any, None]) -> asyncio.Task[None]:
        task = asyncio.create_task(operation)
        self._connection_tasks.add(task)
        task.add_done_callback(self._connection_tasks.discard)
        return task

    def _track_sid_task(self, sid: str, task: asyncio.Task[None]) -> asyncio.Task[None]:
        if not sid:
            return task
        bucket = self._sid_inflight.setdefault(sid, set())
        bucket.add(task)
        task.add_done_callback(bucket.discard)
        return task

    async def _await_same_sid_inflight(self, sid: str) -> None:
        tasks = [task for task in self._sid_inflight.get(sid, set()) if not task.done()]
        if self._hf_task and not self._hf_task.done() and self._hf_task not in tasks:
            tasks.append(self._hf_task)
        if not tasks:
            return
        await asyncio.gather(*tasks, return_exceptions=True)

    def _register_owned_asr(self, sid: str, generation: int, kind: str, task: asyncio.Task[None]) -> _OwnedAsr:
        work = _OwnedAsr(sid, generation, kind, task, self._connection_epoch)
        self._owned_asr.add(work)

        def _drop(_task: asyncio.Task[None]) -> None:
            self._owned_asr.discard(work)

        task.add_done_callback(_drop)
        return work

    def _track_ptt_obligation(self, sid: str, capture_id: str | None, task: asyncio.Task[None]) -> None:
        ob = _PttObligation(sid, capture_id, self._connection_epoch, task)
        self._ptt_obligations.add(ob)

        def _done(_task: asyncio.Task[None]) -> None:
            if ob.outcome is None:
                self._mark_failure(sid)

        task.add_done_callback(_done)

    def _note_ptt_outcome(self, outcome: str) -> None:
        current = asyncio.current_task()
        if current is None:
            return
        for ob in self._ptt_obligations:
            if ob.task is current and ob.outcome is None:
                ob.outcome = outcome
                return

    def _open_ptt_obligations(self, sid: str, connection_epoch: int) -> list[_PttObligation]:
        """只看本连接还没被某次 quiesce 结算的 PTT。已结算的不得再挡下一轮。"""
        return [
            ob
            for ob in self._ptt_obligations
            if ob.sid == sid and ob.connection_epoch == connection_epoch and not ob.settled
        ]

    @staticmethod
    def _settle_ptt(obligations: list[_PttObligation]) -> None:
        for ob in obligations:
            ob.settled = True

    def _retire_speech_generation(self) -> None:
        self._retired_generations.add(self._speech_generation)
        self._speech_generation += 1

    def _generation_retired(self, generation: int) -> bool:
        return generation in self._retired_generations

    def _spawn_hf_recognize(
        self,
        ws: websockets.ClientConnection,
        pcm: bytes,
        sid: str | None = None,
        slot: SegmentSlot | None = None,
    ) -> asyncio.Task[None]:
        emit_sid = sid or self._active_sid
        generation = slot.speech_gen if slot is not None else self._speech_generation

        async def _run() -> None:
            await self._recognize_hands_free(ws, pcm, generation=generation, sid=emit_sid, slot=slot)

        task = self._track_connection_task(_run())
        self._register_owned_asr(emit_sid, generation, "hf_recognize", task)
        self._track_sid_task(emit_sid, task)
        self._hf_task = task
        return task

    async def _await_owned_asr(self, sid: str, generation: int) -> None:
        """只等该 sid+世代的识别工作;不扫全局 connection_tasks,也不只等 last 句柄。"""
        while True:
            pending = [
                work.task
                for work in self._owned_asr
                if work.sid == sid and work.generation == generation and not work.task.done()
            ]
            if not pending:
                return
            await asyncio.gather(*pending, return_exceptions=True)

    def _quiesce_pending_tasks(self, sid: str, generation: int, connection_epoch: int) -> list[asyncio.Task[None]]:
        """排空集合:同连接同 sid 的在途 PTT,加上未退役的当前 HF 世代。"""
        pending: list[asyncio.Task[None]] = []
        for work in self._owned_asr:
            if work.task.done() or work.sid != sid or work.connection_epoch != connection_epoch:
                continue
            if work.kind == "ptt_flush":
                pending.append(work.task)
                continue
            if (
                work.kind == "hf_recognize"
                and work.generation == generation
                and not self._generation_retired(work.generation)
            ):
                pending.append(work.task)
        return pending

    async def _await_quiesce_owned(self, sid: str, generation: int, connection_epoch: int) -> None:
        while True:
            pending = self._quiesce_pending_tasks(sid, generation, connection_epoch)
            if not pending:
                return
            await asyncio.gather(*pending, return_exceptions=True)

    async def _reset_connection_tasks(self) -> None:
        """断线时清掉所有捕获旧 websocket 的任务与队列；新连接只能创建新 worker。"""
        self._connection_epoch += 1
        tasks = [task for task in self._connection_tasks if not task.done()]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._connection_tasks.clear()
        self._say_workers.clear()
        self._say_queues.clear()
        self._cancelled_sessions.clear()
        self._asr_task = None
        self._hf_task = None
        self._eou_hold = None
        self._sid_inflight.clear()
        self._retire_speech_generation()
        self._hf.reset_all()
        self._owned_asr.clear()
        self._ptt_obligations.clear()
        self._quiesce_inflight.clear()
        self._draining_sid = None
        self._drain_extra_pcm.clear()
        self._mic_buf.clear()
        self._vad.reset()
        self._pending_text = ""
        self._active_sid = ""
        self._mode = "ptt"
        self._last_turn_id.clear()
        self._tts_first_byte_sent.clear()
        self._tts_turn_order.clear()
        self._unresolved_failures.clear()

    async def _health_loop(self, ws: websockets.ClientConnection) -> None:
        while True:
            payload: dict[str, Any] = {
                "t": "pipeline.health",
                "asr": "ok" if self._asr_ready else "degraded",
                "tts": "ok" if self._tts_ready else "down",
                "identity": self.runtime_identity,
                "stateRootDigest": self.state_root_digest,
            }
            if self.generation is not None:
                payload["generation"] = self.generation
            await ws.send(json.dumps(payload))
            await asyncio.sleep(30)

    async def _handle(self, ws: websockets.ClientConnection, msg: dict[str, Any]) -> None:
        t = msg.get("t")
        if t == "pipeline.restart_pending":
            # first-run onboarding v4:ACK 后 self-exec 重读 .env
            gen = msg.get("generation")
            if isinstance(gen, int):
                self.generation = gen
            try:
                await ws.send(json.dumps({"t": "pipeline.restart_ack", "generation": self.generation or 0}))
            except websockets.WebSocketException as err:
                log("warn", "restart_ack send failed", error=str(err)[:120])
            self._restart_requested = True
            log("info", "pipeline.restart_pending received; will self-exec", generation=self.generation)
            return
        if t == "tts.say":
            sid = msg["sessionId"]
            self._cancelled_sessions.discard(sid)
            queue = self._say_queues.setdefault(sid, asyncio.Queue())
            await queue.put(bind_say_source_turn(msg))
            if sid not in self._say_workers or self._say_workers[sid].done():
                self._say_workers[sid] = self._track_connection_task(self._say_worker(ws, sid))
        elif t == "barge_in":
            sid = msg.get("sessionId", "")
            # unheard 纪律(合成侧):取消排队中的合成;进行中的句子由 worker 检查标志后丢弃
            self._cancelled_sessions.add(sid)
            queue = self._say_queues.get(sid)
            if queue:
                while not queue.empty():
                    queue.get_nowait()
            log("info", "barge_in: pending synthesis cancelled", sessionId=sid)
        elif t == "turn.done_speaking":
            sid = str(msg.get("sessionId", "") or self._active_sid)
            capture_id = msg.get("captureId") if isinstance(msg.get("captureId"), str) else None
            if self._mode == "hands_free":
                # 第三层兜底(说完了按钮)。屏障 HF 停采不走本支。
                await self._force_finalize(ws, sid)
            else:
                pcm = b"".join(self._mic_buf)
                self._mic_buf.clear()
                self._spawn_ptt_flush(ws, sid, pcm, capture_id)
        elif t == "voice.quiesce":
            self._track_connection_task(self._handle_quiesce(ws, msg))
        elif t == "voice.mode":
            # 迟到评审 A2 回收:sid 无条件重绑(console 刷新产生新 sessionId,mode 值相同也必须
            # 重绑——旧 sid 黏滞会把 asr.final 记到旧会话/旧 pending 并入新会话);
            # mode 或 sid 任一变化即清账(VAD/EOU 缓存/mic 缓冲不跨会话不跨模式带账)
            new_mode = "hands_free" if msg.get("mode") == "hands_free" else "ptt"
            new_sid = str(msg.get("sessionId", "")) or self._active_sid
            if new_mode != self._mode or new_sid != self._active_sid:
                old_sid = self._active_sid
                old_gen = self._speech_generation
                self._mode = new_mode
                self._active_sid = new_sid
                self._vad.reset()
                self._pending_text = ""
                self._cancel_eou_hold()
                self._mic_buf.clear()
                self._drain_extra_pcm.clear()
                self._retire_speech_generation()
                if old_sid:
                    self._hf.retire(old_sid, old_gen)
                for work in list(self._owned_asr):
                    # PTT 松开后的识别不属于 HF 代次。切档只退役免手,在途 ptt_flush 继续发终态。
                    if work.kind == "ptt_flush":
                        continue
                    if work.sid == old_sid and work.generation == old_gen and not work.task.done():
                        work.task.cancel()
                # 失败标记不得被切模式清除(09 §10.1.6 步骤 2)。
                log("info", "voice mode/session rebound", mode=self._mode, sessionId=self._active_sid)
        elif t == "asr.hotwords":
            words = msg.get("words")
            if isinstance(words, list):
                self._hotwords = [w for w in words if isinstance(w, str) and w]
                log("info", "hotwords updated", count=len(self._hotwords))

    # ---------- W2 阶段 D:免手档(VAD 起停 + 语义 EOU + 按钮兜底) ----------

    async def _feed_vad_locked(self, ws: websockets.ClientConnection, frame: bytes) -> None:
        async with self._vad_lock:
            await self._feed_vad(ws, frame, wait_recognize=False)

    async def _feed_vad(
        self,
        ws: websockets.ClientConnection,
        frame: bytes,
        *,
        wait_recognize: bool = True,
    ) -> None:
        for ev in self._vad.feed(frame):
            if ev.kind == "speech_start":
                # 排空中不再开新 HF 账,避免 ACK 后旧开口进入新 Brain。
                if self._draining_sid and self._draining_sid == self._active_sid:
                    continue
                # 用户开口:通知 console(在播则由 console 发 barge_in 截断,watermark 语义不变);
                # 若 EOU 悬挂中 = 用户续说,取消硬终结计时
                self._cancel_eou_hold()
                slot = self._hf.open_speech(self._active_sid, self._speech_generation)
                if slot is None:
                    continue
                await self._send_vad_phase(ws, "start", slot)
            elif ev.kind == "utterance_end":
                if self._draining_sid and self._draining_sid == self._active_sid:
                    self._drain_extra_pcm.append(ev.pcm)
                    continue
                slot = self._hf.close_speech(self._active_sid)
                if slot is None:
                    continue
                await self._send_vad_phase(ws, "end", slot)
                task = self._spawn_hf_recognize(ws, ev.pcm, self._active_sid, slot)
                if wait_recognize:
                    await task

    async def _send_vad_phase(
        self,
        ws: websockets.ClientConnection,
        phase: str,
        slot: SegmentSlot | None = None,
    ) -> None:
        if not self._active_sid:
            return
        payload: dict[str, Any] = {"t": "vad.speech", "sessionId": self._active_sid, "phase": phase}
        if slot is not None:
            payload["hfSegmentId"] = slot.hf_segment_id
            payload["hfRoundId"] = slot.hf_round_id
            payload["recordSeq"] = slot.record_seq
        try:
            await ws.send(json.dumps(payload))
        except websockets.WebSocketException:
            pass  # 观测/打断辅助信号丢失不阻断主链(截断兜底 = 用户 PTT/按钮)

    async def _recognize_hands_free(
        self,
        ws: websockets.ClientConnection,
        pcm: bytes,
        *,
        generation: int | None = None,
        sid: str | None = None,
        slot: SegmentSlot | None = None,
    ) -> None:
        """识别结果只写入 recordSeq 槽。提交与终态由 HfRoundMachine 决定,不在返回时改共享正文。"""
        emit_sid = sid if sid is not None else self._active_sid
        work_gen = self._speech_generation if generation is None else generation
        if self._generation_retired(work_gen):
            return
        if slot is None:
            await self._recognize_untagged(pcm, emit_sid, work_gen)
            return
        if not self.asr or not emit_sid or len(pcm) < 3200:
            self._mirror_hold(emit_sid)
            self._rearm_eou_hold_if_pending(ws, emit_sid)
            return
        text = ""
        outcome = "ok"
        try:
            text = await asyncio.wait_for(self.asr.recognize(pcm16_to_wav(pcm), hotwords=self._hotwords or None), 90) or ""
            self._asr_ready = True
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001 识别单轮失败全形态如实记(ImportError 曾穿透杀循环)
            self._asr_ready = False
            outcome = "failed"
            text = ""
            if emit_sid and not self._generation_retired(work_gen):
                self._mark_failure(emit_sid)
            log("error", "asr recognize failed (hands_free)", error=str(err)[:200])
        if self._generation_retired(work_gen) or self._hf.generation_retired(emit_sid, work_gen):
            return
        spec = self._hf.note_result(emit_sid, slot, text, "failed" if outcome == "failed" else "ok", work_gen)
        await self._after_hf_result(ws, emit_sid, spec)

    async def _recognize_untagged(self, pcm: bytes, sid: str, generation: int) -> None:
        """没有句段身份的识别不得进入逻辑轮,失败仍留下未裁决标记。"""
        if not self.asr or not sid or len(pcm) < 3200 or self._generation_retired(generation):
            return
        try:
            await asyncio.wait_for(self.asr.recognize(pcm16_to_wav(pcm), hotwords=self._hotwords or None), 90)
            self._asr_ready = True
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001
            self._asr_ready = False
            if not self._generation_retired(generation):
                self._mark_failure(sid)
            log("error", "asr recognize failed (untagged)", error=str(err)[:200])

    async def _after_hf_result(
        self,
        ws: websockets.ClientConnection,
        sid: str,
        spec: FinalSpec | None,
    ) -> None:
        if spec is not None:
            await self._emit_hf(ws, sid, spec)
            return
        self._mirror_hold(sid)
        self._rearm_eou_hold_if_pending(ws, sid)

    def _mirror_hold(self, sid: str) -> None:
        self._pending_text = self._hf.held_text(sid) if sid else ""

    async def _eou_hold_timer(self, ws: websockets.ClientConnection, sid: str) -> None:
        try:
            await asyncio.sleep(EOU_HOLD_MS / 1000)
        except asyncio.CancelledError:
            return
        spec = self._hf.settle(sid, force=True)
        if spec is None:
            return
        try:
            await self._emit_hf(ws, sid, spec)
        except (OSError, websockets.WebSocketException) as err:
            log("warn", "eou hold emit failed; pending dropped (stale ws)", chars=len(spec.text), error=str(err)[:120])
            self._pending_text = ""

    def _rearm_eou_hold_if_pending(self, ws: websockets.ClientConnection, sid: str) -> None:
        """已提交但语义未完才悬挂。未提交的后序结果不靠计时器抢发。"""
        target = sid or self._active_sid
        if target and self._hf.needs_hold(target):
            self._pending_text = self._hf.held_text(target)
            self._cancel_eou_hold()
            self._eou_hold = self._track_connection_task(self._eou_hold_timer(ws, target))

    def _cancel_eou_hold(self) -> None:
        if self._eou_hold and not self._eou_hold.done():
            self._eou_hold.cancel()
        self._eou_hold = None

    async def _force_finalize(self, ws: websockets.ClientConnection, sid: str) -> None:
        """说完了按钮:先闭合当前开口,再按录音序强制一条终态。无开轮不补空 final。"""
        if sid:
            self._active_sid = sid
        emit_sid = self._active_sid or sid
        await self._await_same_sid_inflight(emit_sid)
        slot: SegmentSlot | None = None
        pcm = b""
        async with self._vad_lock:
            slot = self._hf.speaking_slot(emit_sid)
            if self._vad.speaking and slot is not None:
                self._hf.close_speech(emit_sid)
            pcm = self._vad.flush()
        self._cancel_eou_hold()
        if slot is not None:
            await self._send_vad_phase(ws, "end", slot)
            await self._consume_open_pcm(ws, emit_sid, slot, pcm)
        if self._has_unresolved_failure(emit_sid):
            failed = self._hf.settle(emit_sid, force=True)
            if failed is not None and failed.outcome == "failed":
                await self._emit_hf(ws, emit_sid, failed)
            return
        spec = self._hf.settle(emit_sid, force=True)
        if spec is not None:
            await self._emit_hf(ws, emit_sid, spec)

    async def _consume_open_pcm(
        self,
        ws: websockets.ClientConnection,
        sid: str,
        slot: SegmentSlot,
        pcm: bytes,
    ) -> bool:
        if self._generation_retired(slot.speech_gen):
            return False
        if not self.asr or len(pcm) < 3200:
            if self._hf.has_open_round(sid):
                self._mark_failure(sid)
            return False
        text = ""
        outcome: str = "ok"
        try:
            text = await asyncio.wait_for(
                self.asr.recognize(pcm16_to_wav(pcm), hotwords=self._hotwords or None), 90
            ) or ""
            self._asr_ready = True
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001
            self._asr_ready = False
            self._mark_failure(sid)
            outcome = "failed"
            text = ""
            log("error", "asr recognize failed (force finalize)", error=str(err)[:200])
        if self._generation_retired(slot.speech_gen):
            return False
        spec = self._hf.note_result(sid, slot, text, "failed" if outcome == "failed" else "ok", slot.speech_gen)
        if spec is not None:
            await self._emit_hf(ws, sid, spec)
            return True
        self._mirror_hold(sid)
        return False

    async def _emit_hf(self, ws: websockets.ClientConnection, sid: str, spec: FinalSpec) -> None:
        if spec.outcome == "failed":
            self._mark_failure(sid)
        self._cancel_eou_hold()
        self._pending_text = ""
        await self._emit_final(
            ws,
            sid,
            spec.text,
            capture_mode="hands_free",
            recognition_outcome=spec.outcome,
            hf_round_id=spec.hf_round_id,
            hf_segment_ids=spec.hf_segment_ids,
            record_seq_first=spec.record_seq_first,
            record_seq_last=spec.record_seq_last,
        )

    async def _emit_final(
        self,
        ws: websockets.ClientConnection,
        sid: str,
        text: str,
        *,
        capture_mode: str = "hands_free",
        capture_id: str | None = None,
        recognition_outcome: str = "ok",
        hf_round_id: str | None = None,
        hf_segment_ids: list[str] | None = None,
        record_seq_first: int | None = None,
        record_seq_last: int | None = None,
    ) -> None:
        turn_id = new_turn_id()
        self._last_turn_id[sid] = turn_id
        await self._send_latency(ws, sid, turn_id, "asr_final", time.monotonic())
        payload: dict[str, Any] = {
            "t": "asr.final",
            "sessionId": sid,
            "turnId": turn_id,
            "text": text,
            "captureMode": capture_mode,
            "recognitionOutcome": recognition_outcome,
        }
        if capture_mode == "ptt" and capture_id:
            payload["captureId"] = capture_id
        if capture_mode == "hands_free" and hf_round_id and hf_segment_ids and record_seq_first and record_seq_last:
            payload["hfRoundId"] = hf_round_id
            payload["hfSegmentIds"] = hf_segment_ids
            payload["recordSeqFirst"] = record_seq_first
            payload["recordSeqLast"] = record_seq_last
        await ws.send(json.dumps(payload))
        if capture_mode == "ptt":
            self._note_ptt_outcome(recognition_outcome)
        log("info", "asr recognized", sessionId=sid, chars=len(text), captureMode=capture_mode)

    def _spawn_ptt_flush(
        self,
        ws: websockets.ClientConnection,
        sid: str,
        pcm: bytes,
        capture_id: str | None = None,
    ) -> None:
        """PTT 识别任务化(读循环不阻塞)+ **串行链式**(实施后 review A-1,2026-07-28):
        旧版抢占 cancel 会让被取消轮零 final(CancelledError 越过 except Exception、尾部 send
        不在 finally)——守恒破洞连锁 console 队列错位/hold 旗错配。改为链式排队:新轮等旧轮
        发完 final 再跑,final 顺序与 done_speaking 顺序一致(FIFO 配对成立)。"""
        prev = self._asr_task

        async def _chained() -> None:
            if prev and not prev.done():
                try:
                    await prev
                except Exception as err:  # noqa: BLE001 链式只保序,旧轮失败不阻断新轮
                    log("warn", "prior ptt flush ended with error (chained)", error=str(err)[:120])
            await self._flush_mic(ws, sid, pcm, capture_id)

        self._asr_task = self._track_connection_task(_chained())
        self._register_owned_asr(sid, self._speech_generation, "ptt_flush", self._asr_task)
        self._track_sid_task(sid, self._asr_task)
        self._track_ptt_obligation(sid, capture_id, self._asr_task)

    async def _flush_mic(
        self,
        ws: websockets.ClientConnection,
        sid: str,
        pcm: bytes,
        capture_id: str | None = None,
    ) -> None:
        """PTT 松开:累积 mic PCM -> WAV -> sauc 整段识别 -> asr.final 回 daemon。

        轮次守恒(双动作交互回修 2026-07-28,评审 A1;09 §10):PTT 下每个 turn.done_speaking
        恰好产生一个 asr.final(短按/空转写/识别异常发 **空 final**)——否则 daemon 的 hold 旗
        与 console 的 intent 队列都会因"无 final 轮"滞留错位(hold 旗泄漏 = 下一直发轮被误扣)。
        """
        turn_id = new_turn_id()
        text = ""
        try:
            if not self.asr or len(pcm) < 3200:  # <100ms 音频(纯注入自测/误触)
                log("info", "ptt flush skipped", sessionId=sid, pcmBytes=len(pcm))
            else:
                self._last_turn_id[sid] = turn_id
                t0 = time.monotonic()
                # M3 五段延迟:PTT 模式下 vad_end = 松开即说完(单调毫秒,同进程内可减)
                await self._send_latency(ws, sid, turn_id, "vad_end", t0)
                text = await asyncio.wait_for(self.asr.recognize(pcm16_to_wav(pcm), hotwords=self._hotwords or None), 90) or ""
                self._asr_ready = True
                t1 = time.monotonic()
                ms = round((t1 - t0) * 1000)
                if text:
                    await self._send_latency(ws, sid, turn_id, "asr_final", t1)
                    log("info", "asr recognized", sessionId=sid, chars=len(text), ms=ms)
                else:
                    log("info", "asr empty result", sessionId=sid, pcmBytes=len(pcm), ms=ms)
        except asyncio.CancelledError:
            if sid:
                self._mark_failure(sid)
            if capture_id:
                current = asyncio.current_task()
                if current is not None:
                    current.uncancel()
                try:
                    await self._emit_final(
                        ws,
                        sid,
                        "",
                        capture_mode="ptt",
                        capture_id=capture_id,
                        recognition_outcome="failed",
                    )
                except Exception as err:  # noqa: BLE001 取消路径只补终态,发送失败不再掩盖取消
                    log("warn", "ptt cancel final failed", error=str(err)[:160])
            raise
        except Exception as err:  # noqa: BLE001 识别单轮失败全形态如实记(ImportError 曾穿透杀循环)
            self._asr_ready = False
            if sid:
                self._unresolved_failures[sid] = True
            log("error", "asr recognize failed", error=str(err)[:200])
            if capture_id:
                await self._emit_final(
                    ws,
                    sid,
                    "",
                    capture_mode="ptt",
                    capture_id=capture_id,
                    recognition_outcome="failed",
                )
                return
        if capture_id:
            await self._emit_final(
                ws,
                sid,
                text,
                capture_mode="ptt",
                capture_id=capture_id,
                recognition_outcome="ok",
            )
            return
        await ws.send(json.dumps({"t": "asr.final", "sessionId": sid, "turnId": turn_id, "text": text}))
        self._note_ptt_outcome("ok")

    def _mark_failure(self, sid: str) -> None:
        if sid:
            self._unresolved_failures[sid] = True

    def _has_unresolved_failure(self, sid: str) -> bool:
        return bool(sid and self._unresolved_failures.get(sid))

    async def _await_prior_recognition(self) -> None:
        sid = self._active_sid
        await self._await_owned_asr(sid, self._speech_generation)

    async def _handle_quiesce(self, ws: websockets.ClientConnection, msg: dict[str, Any]) -> None:
        """09 §10.1.6 固定顺序;不得堵死收包循环,不得因空 tail 清掉已结束失败。"""
        sid = str(msg.get("sessionId", "") or self._active_sid)
        request_id = msg.get("requestId")
        epoch = msg.get("epoch")
        discard = msg.get("discardUnknownEpochs")
        discard_set = set(discard) if isinstance(discard, list) else set()
        if not sid or not isinstance(request_id, str) or not isinstance(epoch, int):
            return
        self._active_sid = sid
        key = (sid, request_id)
        current = asyncio.current_task()
        async with self._quiesce_lock:
            prior = self._quiesce_inflight.get(key)
            if prior is not None and prior is not current and not prior.done():
                leader = prior
            else:
                leader = None
                if current is not None:
                    self._quiesce_inflight[key] = current
        if leader is not None:
            await asyncio.gather(leader, return_exceptions=True)
            return

        drain_gen = self._speech_generation
        connection_epoch = self._connection_epoch
        open_ptt = self._open_ptt_obligations(sid, connection_epoch)
        self._draining_sid = sid
        try:
            await self._await_quiesce_owned(sid, drain_gen, connection_epoch)
            if self._connection_epoch != connection_epoch:
                return
            if current is not None and current.cancelling():
                raise asyncio.CancelledError
            seen = {id(ob) for ob in open_ptt}
            for ob in self._open_ptt_obligations(sid, connection_epoch):
                if id(ob) not in seen:
                    open_ptt.append(ob)
            discard_current = epoch in discard_set
            if not discard_current and any(ob.outcome != "ok" for ob in open_ptt):
                self._mark_failure(sid)

            leftover = b""
            closed_slot: SegmentSlot | None = None
            async with self._vad_lock:
                closed_slot = self._hf.speaking_slot(sid)
                if closed_slot is not None:
                    self._hf.close_speech(sid)
                leftover = self._vad.flush()
            if self._drain_extra_pcm:
                leftover = b"".join(self._drain_extra_pcm) + leftover
                self._drain_extra_pcm.clear()

            await self._finish_quiesce(
                ws,
                sid,
                request_id,
                epoch,
                leftover,
                discard_current=discard_current,
                closed_slot=closed_slot,
                open_ptt=open_ptt,
            )
            if self._connection_epoch == connection_epoch:
                self._retire_speech_generation()
        finally:
            if self._draining_sid == sid:
                self._draining_sid = None
            self._drain_extra_pcm.clear()
            async with self._quiesce_lock:
                if self._quiesce_inflight.get(key) is current:
                    self._quiesce_inflight.pop(key, None)

    async def _finish_quiesce(
        self,
        ws: websockets.ClientConnection,
        sid: str,
        request_id: str,
        epoch: int,
        leftover: bytes,
        *,
        discard_current: bool,
        open_ptt: list[_PttObligation],
        closed_slot: SegmentSlot | None = None,
    ) -> None:
        self._cancel_eou_hold()
        if discard_current:
            missing = any(ob.outcome is None for ob in open_ptt)
            if missing:
                self._mark_failure(sid)
                self._clear_buffers()
                self._mode = "ptt"
                await self._send_quiesced(ws, sid, request_id, epoch, classified=False)
                self._settle_ptt(open_ptt)
                return
            self._hf.drop_open(sid)
            empty_round = "unusable" if leftover else "empty"
            self._clear_buffers()
            self._mode = "ptt"
            self._unresolved_failures.pop(sid, None)
            await self._send_quiesced(ws, sid, request_id, epoch, classified=True, empty_round=empty_round)
            self._settle_ptt(open_ptt)
            return

        if self._has_unresolved_failure(sid):
            if closed_slot is not None:
                await self._send_vad_phase(ws, "end", closed_slot)
                failed_now = self._hf.note_result(sid, closed_slot, "", "failed", closed_slot.speech_gen)
                if failed_now is not None:
                    await self._emit_hf(ws, sid, failed_now)
            failed = self._hf.settle(sid, force=True)
            if failed is not None and failed.outcome == "failed":
                await self._emit_hf(ws, sid, failed)
            self._clear_buffers()
            self._mode = "ptt"
            await self._send_quiesced(ws, sid, request_id, epoch, classified=False)
            self._settle_ptt(open_ptt)
            return

        sent = False
        if closed_slot is not None:
            await self._send_vad_phase(ws, "end", closed_slot)
            sent = await self._consume_open_pcm(ws, sid, closed_slot, leftover)
        elif leftover:
            sent = await self._consume_tail(ws, sid, leftover)

        if self._has_unresolved_failure(sid):
            failed = self._hf.settle(sid, force=True)
            if failed is not None and failed.outcome == "failed":
                await self._emit_hf(ws, sid, failed)
            self._clear_buffers()
            self._mode = "ptt"
            await self._send_quiesced(ws, sid, request_id, epoch, classified=False)
            self._settle_ptt(open_ptt)
            return

        if not sent:
            spec = self._hf.settle(sid, force=True)
            if spec is not None:
                await self._emit_hf(ws, sid, spec)
                sent = True
                if spec.outcome == "failed":
                    self._clear_buffers()
                    self._mode = "ptt"
                    await self._send_quiesced(ws, sid, request_id, epoch, classified=False)
                    self._settle_ptt(open_ptt)
                    return
        classified_ptt = any(ob.outcome == "ok" for ob in open_ptt)
        ptt_blocked = any(ob.outcome != "ok" for ob in open_ptt)
        if sent or classified_ptt:
            if self._has_unresolved_failure(sid) or ptt_blocked:
                self._clear_buffers()
                self._mode = "ptt"
                await self._send_quiesced(ws, sid, request_id, epoch, classified=False)
                self._settle_ptt(open_ptt)
                return
            self._clear_buffers()
            self._mode = "ptt"
            await self._send_quiesced(ws, sid, request_id, epoch, classified=True)
            self._settle_ptt(open_ptt)
            return

        if self._has_unresolved_failure(sid) or ptt_blocked:
            self._mark_failure(sid)
            self._clear_buffers()
            self._mode = "ptt"
            await self._send_quiesced(ws, sid, request_id, epoch, classified=False)
            self._settle_ptt(open_ptt)
            return

        empty_round = "empty" if leftover and len(leftover) >= 3200 else "unusable"
        self._clear_buffers()
        self._mode = "ptt"
        await self._send_quiesced(ws, sid, request_id, epoch, classified=True, empty_round=empty_round)
        self._settle_ptt(open_ptt)

    async def _consume_tail(self, ws: websockets.ClientConnection, sid: str, pcm: bytes) -> bool:
        """无开口的 leftover:空/短不新开轮;非空才新开一轮。已有开轮则并入。"""
        if len(pcm) < 3200 or not self.asr:
            if self._hf.has_open_round(sid):
                self._mark_failure(sid)
            return False
        text = ""
        outcome: str = "ok"
        try:
            text = await asyncio.wait_for(
                self.asr.recognize(pcm16_to_wav(pcm), hotwords=self._hotwords or None),
                90,
            ) or ""
            self._asr_ready = True
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001
            self._asr_ready = False
            self._mark_failure(sid)
            outcome = "failed"
            text = ""
            log("error", "asr recognize failed (quiesce hf tail)", error=str(err)[:200])
        if outcome == "failed" and not self._hf.has_open_round(sid):
            return False
        if not self._hf.has_open_round(sid) and not text.strip():
            return False
        slot = self._hf.open_speech(sid, self._speech_generation)
        if slot is None:
            return False
        self._hf.close_speech(sid)
        await self._send_vad_phase(ws, "start", slot)
        await self._send_vad_phase(ws, "end", slot)
        spec = self._hf.note_result(sid, slot, text, "failed" if outcome == "failed" else "ok", slot.speech_gen)
        if spec is not None:
            await self._emit_hf(ws, sid, spec)
            return True
        self._mirror_hold(sid)
        return False

    def _clear_buffers(self) -> None:
        self._vad.reset()
        self._mic_buf.clear()
        self._pending_text = ""
        self._cancel_eou_hold()

    async def _send_quiesced(
        self,
        ws: websockets.ClientConnection,
        sid: str,
        request_id: str,
        epoch: int,
        *,
        classified: bool,
        empty_round: str | None = None,
    ) -> None:
        if classified:
            payload: dict[str, Any] = {
                "t": "voice.quiesced",
                "sessionId": sid,
                "requestId": request_id,
                "epoch": epoch,
                "classified": True,
            }
            if empty_round:
                payload["emptyRound"] = empty_round
        else:
            payload = {
                "t": "voice.quiesced",
                "sessionId": sid,
                "requestId": request_id,
                "epoch": epoch,
                "classified": False,
                "code": "voice_recognition_failed",
            }
        await ws.send(json.dumps(payload))

    async def _send_latency(self, ws: websockets.ClientConnection, sid: str, turn_id: str, stage: str, t_mono: float) -> None:
        """M3:latency.stage 事件(atMs=单调时钟毫秒;daemon 侧 LatencyCollector 聚合)。"""
        try:
            await ws.send(json.dumps({
                "t": "latency.stage", "sessionId": sid, "turnId": turn_id,
                "stage": stage, "atMs": round(t_mono * 1000, 1),
            }))
        except websockets.WebSocketException:
            pass  # 观测事件丢失不影响主链

    def _claim_tts_first_byte(self, turn_id: str) -> bool:
        """同一 turn 只记一次。超过上限时丢掉最旧 turn,避免集合无界增长。"""
        if turn_id in self._tts_first_byte_sent:
            return False
        self._tts_first_byte_sent.add(turn_id)
        self._tts_turn_order.append(turn_id)
        while len(self._tts_first_byte_sent) > _TTS_TURN_SEEN_MAX and self._tts_turn_order:
            stale = self._tts_turn_order.pop(0)
            self._tts_first_byte_sent.discard(stale)
        return True

    async def _say_worker(self, ws: websockets.ClientConnection, sid: str) -> None:
        queue = self._say_queues[sid]
        while not queue.empty():
            say = await queue.get()
            if sid in self._cancelled_sessions:
                continue
            if not self.tts:
                log("warn", "tts.say dropped: no TTS provider configured", sentenceId=say.get("sentenceId"))
                continue
            try:
                t0 = time.monotonic()
                audio = await asyncio.wait_for(self.tts.synthesize(say["text"]), TTS_TIMEOUT_S)
                if not audio:
                    # F04(E2 eval 2026-08-04):doubao 对引号/标记包裹短句可返回空音频——
                    # 剥引号星号重试一次;仍空则仅跳过本句(单句失败不降级全局 tts_ready)
                    stripped = re.sub("[\u201c\u201d\u2018\u2019\"'\u300c\u300d\u300e\u300f*]", "", str(say["text"]))
                    if stripped and stripped != say["text"]:
                        log("warn", "tts empty audio; retry stripped", sentenceId=say.get("sentenceId"))
                        audio = await asyncio.wait_for(self.tts.synthesize(stripped), TTS_TIMEOUT_S)
                if not audio:
                    log("warn", "tts empty audio; sentence skipped (health kept)", sentenceId=say.get("sentenceId"))
                    continue
                self._tts_ready = True
                if sid in self._cancelled_sessions:
                    continue  # 合成期间被打断:该句作废,不下发,也不记入该 turn
                source_turn = source_turn_of_say(say)
                if source_turn and self._claim_tts_first_byte(source_turn):
                    await self._send_latency(ws, sid, source_turn, "tts_first_byte", time.monotonic())
                self._seq += 1
                sentence_id = str(say.get("sentenceId", "")).encode()
                # 二进制帧:tag 0x02 + seq(4B BE)+ sentenceId 长度(1B)+ sentenceId + mp3
                frame = b"\x02" + struct.pack(">I", self._seq) + bytes([len(sentence_id)]) + sentence_id + audio
                await ws.send(frame)
                log("info", "tts synthesized", sentenceId=say.get("sentenceId"), bytes=len(audio), ms=round((time.monotonic() - t0) * 1000))
            except Exception as err:  # noqa: BLE001 provider 超时/协议/实现故障都必须降级 health
                self._tts_ready = False
                log("error", "tts synthesis failed", error=str(err)[:200])
