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
from .vad import EOU_HOLD_MS, EnergyVad, semantic_eou_complete

PROTOCOL_VERSION = 1
RUNTIME_PROTOCOL_VERSION = "1.0.0"
TTS_TIMEOUT_S = 30

_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def new_turn_id() -> str:
    """ses_<ULID>(idSchema ^[a-z]{3}_[0-9A-HJKMNP-TV-Z]{26}$;daemon appendTurn 同前缀先例)。"""
    ts = int(time.time() * 1000)
    chars = []
    for _ in range(10):
        chars.append(_CROCKFORD[ts & 0x1F])
        ts >>= 5
    head = "".join(reversed(chars))
    tail = "".join(secrets.choice(_CROCKFORD) for _ in range(16))
    return f"ses_{head}{tail}"


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
        # M3 五段延迟:最近 ASR 轮 id(严格轮替下 tts 关联);本轮 tts_first_byte 已发标记
        self._last_turn_id: dict[str, str] = {}
        self._tts_first_byte_sent: set[str] = set()
        # 热词偏置词表(接线批;daemon asr.hotwords 下发,recognize 请求组装消费——07 D4/ADR-101 +10 点术语召回)
        self._hotwords: list[str] = []
        # W2 阶段 D 免手档状态(P0 单活跃会话,与 mic 缓冲同假设)
        self._mode: str = "ptt"
        self._active_sid: str = ""
        self._vad = EnergyVad()
        self._pending_text: str = ""  # 语义 EOU 判"未完"的缓存(续段拼接)
        self._eou_hold: asyncio.Task[None] | None = None
        # dogfood 冻结回修:PTT 识别任务化(读循环永不因 recognize 阻塞;新轮抢占旧任务)
        self._asr_task: asyncio.Task[None] | None = None
        # 每条 websocket 连接捕获的后台任务全集；断线必须全部 cancel + await，不能只记链尾。
        self._connection_tasks: set[asyncio.Task[None]] = set()
        # first-run onboarding v4:self-restart 世代(重连 hello/health 上报)
        self.generation: int | None = None
        self._restart_requested = False

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
                                await self._run_while_connected(
                                    disconnect_task,
                                    self._feed_vad(ws, raw[5:]),
                                )
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

    async def _reset_connection_tasks(self) -> None:
        """断线时清掉所有捕获旧 websocket 的任务与队列；新连接只能创建新 worker。"""
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
        self._eou_hold = None
        self._mic_buf.clear()
        self._vad.reset()
        self._pending_text = ""
        self._active_sid = ""
        self._mode = "ptt"
        self._last_turn_id.clear()
        self._tts_first_byte_sent.clear()

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
            await queue.put(msg)
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
            if self._mode == "hands_free":
                # 第三层兜底(说完了按钮):强制终结当前 utterance + 立即发出 EOU 缓存
                await self._force_finalize(ws, msg.get("sessionId", "") or self._active_sid)
            else:
                # 冻结回修:缓冲快照在读循环内取(时序正确),识别 spawn 成任务——
                # recognize 内任何无超时路径(如整段音频 send 挂死)都不再冻结读循环
                pcm = b"".join(self._mic_buf)
                self._mic_buf.clear()
                self._spawn_ptt_flush(ws, msg.get("sessionId", ""), pcm)
        elif t == "voice.mode":
            # 迟到评审 A2 回收:sid 无条件重绑(console 刷新产生新 sessionId,mode 值相同也必须
            # 重绑——旧 sid 黏滞会把 asr.final 记到旧会话/旧 pending 并入新会话);
            # mode 或 sid 任一变化即清账(VAD/EOU 缓存/mic 缓冲不跨会话不跨模式带账)
            new_mode = "hands_free" if msg.get("mode") == "hands_free" else "ptt"
            new_sid = str(msg.get("sessionId", "")) or self._active_sid
            if new_mode != self._mode or new_sid != self._active_sid:
                self._mode = new_mode
                self._active_sid = new_sid
                self._vad.reset()
                self._pending_text = ""
                self._cancel_eou_hold()
                self._mic_buf.clear()
                log("info", "voice mode/session rebound", mode=self._mode, sessionId=self._active_sid)
        elif t == "asr.hotwords":
            words = msg.get("words")
            if isinstance(words, list):
                self._hotwords = [w for w in words if isinstance(w, str) and w]
                log("info", "hotwords updated", count=len(self._hotwords))

    # ---------- W2 阶段 D:免手档(VAD 起停 + 语义 EOU + 按钮兜底) ----------

    async def _feed_vad(self, ws: websockets.ClientConnection, frame: bytes) -> None:
        for ev in self._vad.feed(frame):
            if ev.kind == "speech_start":
                # 用户开口:通知 console(在播则由 console 发 barge_in 截断,watermark 语义不变);
                # 若 EOU 悬挂中 = 用户续说,取消硬终结计时
                self._cancel_eou_hold()
                await self._send_vad_phase(ws, "start")
            elif ev.kind == "utterance_end":
                await self._send_vad_phase(ws, "end")
                await self._recognize_hands_free(ws, ev.pcm)

    async def _send_vad_phase(self, ws: websockets.ClientConnection, phase: str) -> None:
        if not self._active_sid:
            return
        try:
            await ws.send(json.dumps({"t": "vad.speech", "sessionId": self._active_sid, "phase": phase}))
        except websockets.WebSocketException:
            pass  # 观测/打断辅助信号丢失不阻断主链(截断兜底 = 用户 PTT/按钮)

    async def _recognize_hands_free(self, ws: websockets.ClientConnection, pcm: bytes) -> None:
        """免手一轮:识别 -> 拼 EOU 缓存 -> 语义 EOU 判定:完 ⇒ asr.final;未完 ⇒ 缓存等续说。

        迟到评审 A1 回收:任何早退路径(识别异常/空转写/前置缺)都不得让 EOU 缓存失去
        悬挂计时——speech_start 已取消旧计时器,这里若直接 return,pending 会挂到任意久
        之后与语义无关的下一轮错拼进一条 asr.final(污染对话事实与记忆提名源)。
        """
        sid = self._active_sid
        if not self.asr or not sid or len(pcm) < 3200:
            self._rearm_eou_hold_if_pending(ws, sid)
            return
        try:
            text = await asyncio.wait_for(self.asr.recognize(pcm16_to_wav(pcm), hotwords=self._hotwords or None), 90)
            self._asr_ready = True
        except Exception as err:  # noqa: BLE001 识别单轮失败全形态如实记(ImportError 曾穿透杀循环)
            self._asr_ready = False
            log("error", "asr recognize failed (hands_free)", error=str(err)[:200])
            self._rearm_eou_hold_if_pending(ws, sid)
            return
        if not text:
            self._rearm_eou_hold_if_pending(ws, sid)
            return
        merged = (self._pending_text + text).strip()
        if semantic_eou_complete(merged):
            self._pending_text = ""
            self._cancel_eou_hold()
            await self._emit_final(ws, sid, merged)
        else:
            # 语义 EOU 判"未完"(接续词收尾):缓存等续段;悬挂上限后硬终结(防永挂)
            self._pending_text = merged
            self._cancel_eou_hold()
            self._eou_hold = self._track_connection_task(self._eou_hold_timer(ws, sid))
            log("info", "eou: incomplete, holding for continuation", chars=len(merged))

    async def _eou_hold_timer(self, ws: websockets.ClientConnection, sid: str) -> None:
        try:
            await asyncio.sleep(EOU_HOLD_MS / 1000)
        except asyncio.CancelledError:
            return
        # 第四轮终验 B3 回修:发射失败**丢弃并如实记日志**——闭包持有的旧 ws 已死、重发无门,
        # "保留 pending"会再次悬空并在下一轮错拼(A1 要消灭的污染形态);诚实丢弃优于错拼
        # (话没送到 Brain,用户自然会再说;console 刷新场景另有 voice.mode 重绑清账兜住)
        pending = self._pending_text
        if not pending:
            return
        try:
            await self._emit_final(ws, sid, pending)
        except (OSError, websockets.WebSocketException) as err:
            log("warn", "eou hold emit failed; pending dropped (stale ws)", chars=len(pending), error=str(err)[:120])
        finally:
            self._pending_text = ""

    def _rearm_eou_hold_if_pending(self, ws: websockets.ClientConnection, sid: str) -> None:
        """早退路径统一兜底:有缓存必有计时(A1;sid 缺省用当前活跃会话)。"""
        if self._pending_text and (sid or self._active_sid):
            self._cancel_eou_hold()
            self._eou_hold = self._track_connection_task(
                self._eou_hold_timer(ws, sid or self._active_sid)
            )

    def _cancel_eou_hold(self) -> None:
        if self._eou_hold and not self._eou_hold.done():
            self._eou_hold.cancel()
        self._eou_hold = None

    async def _force_finalize(self, ws: websockets.ClientConnection, sid: str) -> None:
        """说完了按钮(第三层):终结进行中 utterance + 立即发出缓存(绕语义 EOU)。"""
        if sid:
            self._active_sid = sid
        pcm = self._vad.flush()
        tail = ""
        if self.asr and len(pcm) >= 3200:
            try:
                tail = await asyncio.wait_for(self.asr.recognize(pcm16_to_wav(pcm), hotwords=self._hotwords or None), 90) or ""
                self._asr_ready = True
            except Exception as err:  # noqa: BLE001 识别单轮失败全形态如实记(ImportError 曾穿透杀循环)
                self._asr_ready = False
                log("error", "asr recognize failed (force finalize)", error=str(err)[:200])
        merged = (self._pending_text + tail).strip()
        self._pending_text = ""
        self._cancel_eou_hold()
        if merged and self._active_sid:
            await self._emit_final(ws, self._active_sid, merged)

    async def _emit_final(self, ws: websockets.ClientConnection, sid: str, text: str) -> None:
        turn_id = new_turn_id()
        self._last_turn_id[sid] = turn_id
        self._tts_first_byte_sent.discard(sid)
        await self._send_latency(ws, sid, turn_id, "asr_final", time.monotonic())
        await ws.send(json.dumps({"t": "asr.final", "sessionId": sid, "turnId": turn_id, "text": text}))
        log("info", "asr recognized (hands_free)", sessionId=sid, chars=len(text))

    def _spawn_ptt_flush(self, ws: websockets.ClientConnection, sid: str, pcm: bytes) -> None:
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
            await self._flush_mic(ws, sid, pcm)

        self._asr_task = self._track_connection_task(_chained())

    async def _flush_mic(self, ws: websockets.ClientConnection, sid: str, pcm: bytes) -> None:
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
                self._tts_first_byte_sent.discard(sid)
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
        except Exception as err:  # noqa: BLE001 识别单轮失败全形态如实记(ImportError 曾穿透杀循环)
            self._asr_ready = False
            log("error", "asr recognize failed", error=str(err)[:200])
        await ws.send(json.dumps({"t": "asr.final", "sessionId": sid, "turnId": turn_id, "text": text}))

    async def _send_latency(self, ws: websockets.ClientConnection, sid: str, turn_id: str, stage: str, t_mono: float) -> None:
        """M3:latency.stage 事件(atMs=单调时钟毫秒;daemon 侧 LatencyCollector 聚合)。"""
        try:
            await ws.send(json.dumps({
                "t": "latency.stage", "sessionId": sid, "turnId": turn_id,
                "stage": stage, "atMs": round(t_mono * 1000, 1),
            }))
        except websockets.WebSocketException:
            pass  # 观测事件丢失不影响主链

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
                    continue  # 合成期间被打断:该句作废,不下发
                # M3:本轮首句合成完成 = tts_first_byte(关联最近一次 ASR 轮;严格轮替 PTT 对话下成立)
                turn_id = self._last_turn_id.get(sid)
                if turn_id and sid not in self._tts_first_byte_sent:
                    self._tts_first_byte_sent.add(sid)
                    await self._send_latency(ws, sid, turn_id, "tts_first_byte", time.monotonic())
                self._seq += 1
                sentence_id = str(say.get("sentenceId", "")).encode()
                # 二进制帧:tag 0x02 + seq(4B BE)+ sentenceId 长度(1B)+ sentenceId + mp3
                frame = b"\x02" + struct.pack(">I", self._seq) + bytes([len(sentence_id)]) + sentence_id + audio
                await ws.send(frame)
                log("info", "tts synthesized", sentenceId=say.get("sentenceId"), bytes=len(audio), ms=round((time.monotonic() - t0) * 1000))
            except Exception as err:  # noqa: BLE001 provider 超时/协议/实现故障都必须降级 health
                self._tts_ready = False
                log("error", "tts synthesis failed", error=str(err)[:200])
