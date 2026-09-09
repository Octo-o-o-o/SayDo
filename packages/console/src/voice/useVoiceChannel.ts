// console <-> daemon 语音通道(1.2 最小):hello 握手、转写流、TTS 句播放 + playout watermark 回报、
// PTT barge-in + 真实麦克风采集(PTT 按住期间:getUserMedia -> AudioWorklet -> PCM16 16k mono
// -> 二进制帧 0x01 + 4B BE seq + payload 上行,09 §10;hub 已路由 console->pipeline)。
// AEC = 浏览器 baseline(modules/a ②:须查 track.getSettings() 实际生效,不作质量承诺)。
// capability token 参数位:?token= / localStorage(4.1 起 daemon 才校验)。

import { useCallback, useEffect, useRef, useState } from "react";
import { pipelineMsgSchema, type PipelineMsg } from "@saydo/contracts";
import { shouldFireReconnect, type ReconnectTrigger } from "../lib/reconnectPolicy";
import { NATIVE_RESUME_EVENT } from "../mobile/reconnect";
import { dispatchDataInvalidate } from "../lib/dataInvalidate";

export const VOICE_WS_PROTOCOL_VERSION = 1;

export interface TranscriptItem {
  turnId: string;
  text: string;
  final: boolean;
  /** W2 场次① A2:到达序(用户轮与 AI 句合并流的时序交错锚;partial->final 替换保原位) */
  seq: number;
  /** 双动作交互(2026-07-28,11 §5.10):直发档占位气泡——语音已发出、转写在途 */
  transcribing?: boolean;
  /** 语音轮时长标签(秒;占位与转写到达后都显示) */
  durationSec?: number;
  /** 转写失败/超时(占位气泡终态;点击可移除) */
  failed?: boolean;
}

export interface SpokenSentence {
  sentenceId: string;
  text: string;
  truncated: boolean;
  /** W2 场次① A2:到达序(与 TranscriptItem.seq 同一单调计数器) */
  seq: number;
  /**
   * ④e:所属 turnId(从 tts.say sentenceId 启发式提取,或 screen_text 全文替换时写入)。
   * 同 turnId 的 screen_text 到达后替换该轮逐句气泡为全文(保留时长标在用户轮侧)。
   */
  turnId?: string;
  /** ④e:是否已由 screen_text 全文替换(true 时 UI 按全文单气泡渲染) */
  fullScreenText?: boolean;
}

export interface MicState {
  active: boolean;
  /** 浏览器 AEC 实际生效与否(null=尚未采集) */
  aec: boolean | null;
  error: string | null;
  /** W4 3.9:实时电平(0-1 RMS;录音中反馈波形/电平条,11 §5.10) */
  level: number;
}

export type NativeReplyEvent = Omit<Extract<PipelineMsg, { t: "native.reply" }>, "t">;

export function enqueueNativeReply(queue: NativeReplyEvent[], reply: NativeReplyEvent): NativeReplyEvent[] {
  return [...queue.slice(-49), reply];
}

export function consumeNativeReplyQueue(queue: NativeReplyEvent[], count: number): NativeReplyEvent[] {
  if (!Number.isInteger(count) || count <= 0) return queue;
  return queue.slice(count);
}

/** F25 + 批 1:确认卡(digest 绑定;点击走 confirm.click) */
export interface ConfirmCardState {
  receiptId: string;
  text: string;
  kind: string;
  digest: string;
  digestVersion: number;
  /** countdown 消息到达时间戳+时长(null=等待式确认,无倒计时) */
  countdownStartAt: number | null;
  countdownMs: number | null;
}

/** 批 4:这次聊出来的东西(focus.entity;办成事才长卡) */
export interface EntityItem {
  id: string;
  kind: string;
  title: string;
  sub: string;
  color: string;
  at: string;
}

interface VoiceChannelState {
  connected: boolean;
  health: { asr: string; tts: string } | null;
  transcript: TranscriptItem[];
  spoken: SpokenSentence[];
  mic: MicState;
  /** W2 阶段 D:轮次采集模式(ptt=按住说 / hands_free=VAD 起停免手;10 §3-1 三层) */
  mode: "ptt" | "hands_free";
  /** W2 场次① A3:说完到 Brain 回话之间的 pending 指示(02 §3 学习中是一等状态;
   *  asr.final 置起,首句 tts.say 到达清除——实测 llm 首 token 5 秒级,零反馈会被当卡死) */
  thinking: boolean;
  /** dogfood 修复(2026-07-28):浏览器 autoplay 策略拒绝 audio.play()(刷新后无用户手势即打字)——
   *  此前 rejection 被静默吞,owner 无声无提示;置起后 UI 出"启用声音"提示,用户手势重试解锁 */
  audioBlocked: boolean;
  /** 双动作交互:B 档(转写编辑)结果事件——text 回填编辑框 / error 超时失败(Chat 消费后 consumeDraftEvent 清除) */
  draftEvent: { kind: "text"; text: string } | { kind: "error" } | null;
  sessionProject: SessionProjectState | null;
  /** F25:当前确认卡(null=无 pending 确认) */
  confirmCard: ConfirmCardState | null;
  /** 批 4:本会话实体卡流(新在前,上限 50) */
  entities: EntityItem[];
  /** M2-voice-a:仅 mobile_lan 收到；队列防同一 React commit 前连续回复互相覆盖。 */
  nativeReplies: NativeReplyEvent[];
}

/** 双动作交互(2026-07-28 评审 A2):采集意图 FIFO 队列——每条 asr.final 出队消费,
 *  防"final 在途 + 新采集"重叠时单标量路由错乱;per-entry 超时逐出(录音时长+30s,至少 20s)。 */
interface CaptureEntry {
  kind: "send" | "edit" | "cancelled";
  /** send 档占位气泡 key(负 seq 不与真轮冲突;final 到达按此替换) */
  placeholderKey?: string;
  timer: number;
}

const MIC_TARGET_RATE = 16000;
const MIC_FRAME_SAMPLES = 320; // 20ms @ 16k
export const THINKING_FALLBACK_MS = 245_000;
/** WS 断连指数退避：次数不封顶，单次间隔封顶 30s（移动真机回前台另走立即重连）。 */
export const WS_RECONNECT_BASE_MS = 500;
export const WS_RECONNECT_DELAY_CAP_MS = 30_000;
/** 与 packages/console/src/mobile/reconnect.ts 同名事件；回前台/手动/ iOS onResume 共用。 */
export const WS_RECONNECT_REQUEST_EVENT = "saydo:reconnect-request";
const WORKLET_SRC = `class T extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("saydo-mic-tap",T)`;

export function nextWsReconnectDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  const exp = Math.min(n, 16);
  return Math.min(WS_RECONNECT_DELAY_CAP_MS, WS_RECONNECT_BASE_MS * 2 ** exp);
}

/** 线性插值重采样(ctx 不支持 16k 时的兜底;支持时为恒等) */
function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === MIC_TARGET_RATE) return input;
  const outLen = Math.floor((input.length * MIC_TARGET_RATE) / fromRate);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = (i * fromRate) / MIC_TARGET_RATE;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = (input[i0] as number) * (1 - frac) + (input[i1] as number) * frac;
  }
  return out;
}

import { daemonWsUrl } from "../lib/api";
import { reduceSessionProject, type SessionProjectState } from "./sessionProject";

function wsUrl(): string {
  return daemonWsUrl(); // 同源判定单源(vite dev 指 47100,其余同源;token 从 ?token=/localStorage)
}

/** 从 sentenceId 启发式还原 turnId(dialogLoop:`s-${turnId}-${i}`) */
function guessTurnIdFromSentenceId(sentenceId: string): string | undefined {
  // s-<turnId>-<n>
  const m = /^s-(.+)-(\d+)$/.exec(sentenceId);
  if (m) return m[1];
  return undefined;
}

function sentenceIdBelongsToTurn(sentenceId: string, turnId: string): boolean {
  return sentenceId.includes(turnId);
}

export function useVoiceChannel(sessionId: string) {
  const [state, setState] = useState<VoiceChannelState>({
    connected: false,
    health: null,
    transcript: [],
    spoken: [],
    mic: { active: false, aec: null, error: null, level: 0 },
    mode: "ptt",
    thinking: false,
    audioBlocked: false,
    draftEvent: null,
    sessionProject: null,
    confirmCard: null,
    entities: [],
    nativeReplies: []
  });
  const modeRef = useRef<"ptt" | "hands_free">("ptt");
  const arrivalSeqRef = useRef(0); // A2:用户轮/AI 句合并流的到达序
  const thinkingTimerRef = useRef<number | null>(null); // A3:兜底清除(Brain 环异常永不回话时不悬挂)
  const captureQueueRef = useRef<CaptureEntry[]>([]); // 双动作 FIFO(评审 A2)
  const placeholderSeqRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<{ sentenceId: string; url: string }[]>([]); // F23:句音频顺序播放队列
  const playingSentenceRef = useRef<string | null>(null);
  const playoutTimerRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micNodeRef = useRef<AudioWorkletNode | null>(null);
  const micSeqRef = useRef(0);
  const micBufRef = useRef<number[]>([]);
  const lastLevelPushRef = useRef(0); // W4 3.9:电平推送节流

  /** thinking 置位统一 helper:兜底覆盖 CLI oneshot 两次 120s 调用上界,运行时终态仍会提前清除。 */
  const setThinkingWithFallback = useCallback(() => {
    if (thinkingTimerRef.current) window.clearTimeout(thinkingTimerRef.current);
    thinkingTimerRef.current = window.setTimeout(
      () => setState((s2) => ({ ...s2, thinking: false })),
      THINKING_FALLBACK_MS
    );
    setState((s) => ({ ...s, thinking: true }));
  }, []);

  /** 队列超时逐出(评审 B1:录音时长+30s,至少 20s——PTT 识别无总时限,按时长动态) */
  const expireCaptureEntry = useCallback((entry: CaptureEntry) => {
    const idx = captureQueueRef.current.indexOf(entry);
    if (idx < 0) return;
    captureQueueRef.current.splice(idx, 1);
    if (entry.kind === "send" && entry.placeholderKey) {
      setState((s) => ({
        ...s,
        transcript: s.transcript.map((t) => (t.turnId === entry.placeholderKey ? { ...t, transcribing: false, failed: true } : t))
      }));
    } else if (entry.kind === "edit") {
      setState((s) => ({ ...s, draftEvent: { kind: "error" } }));
    }
  }, []);

  const enqueueCapture = useCallback(
    (kind: CaptureEntry["kind"], durationSec: number, placeholderKey?: string) => {
      const entry: CaptureEntry = { kind, ...(placeholderKey !== undefined ? { placeholderKey } : {}), timer: 0 };
      entry.timer = window.setTimeout(() => expireCaptureEntry(entry), Math.max(105_000, durationSec * 1000 + 30_000)); // review B-2:下限对齐 pipeline 识别总超时 90s+余量(正常空 final 先到,此为双保险)
      captureQueueRef.current.push(entry);
    },
    [expireCaptureEntry]
  );

  const sendMicFrame = useCallback((samples: Float32Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const frame = new Uint8Array(1 + 4 + samples.length * 2);
    frame[0] = 0x01;
    new DataView(frame.buffer).setUint32(1, micSeqRef.current++, false);
    const pcm = new DataView(frame.buffer, 5);
    for (let i = 0; i < samples.length; i++) {
      const v = Math.max(-1, Math.min(1, samples[i] as number));
      pcm.setInt16(i * 2, Math.round(v * 32767), true);
    }
    ws.send(frame);
  }, []);

  const stopMic = useCallback(() => {
    micNodeRef.current?.port.close();
    micNodeRef.current?.disconnect();
    micNodeRef.current = null;
    micBufRef.current = [];
    setState((s) => ({ ...s, mic: { ...s.mic, active: false, level: 0 } }));
  }, []);

  const startMic = useCallback(async () => {
    if (micNodeRef.current) return;
    try {
      if (!micStreamRef.current) {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
        });
      }
      const track = micStreamRef.current.getAudioTracks()[0];
      const aec = track ? (track.getSettings().echoCancellation ?? false) : false;
      if (!micCtxRef.current) {
        const ctx = new AudioContext({ sampleRate: MIC_TARGET_RATE });
        await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET_SRC], { type: "text/javascript" })));
        micCtxRef.current = ctx;
      }
      const ctx = micCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const src = ctx.createMediaStreamSource(micStreamRef.current);
      const node = new AudioWorkletNode(ctx, "saydo-mic-tap");
      node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        const resampled = resampleTo16k(ev.data, ctx.sampleRate);
        // W4 3.9:RMS 电平(录音中波形/电平条反馈,11 §5.10)——节流到 state(每帧算,~50ms 推一次)
        let sum = 0;
        for (let i = 0; i < resampled.length; i++) sum += (resampled[i] as number) ** 2;
        const rms = Math.min(1, Math.sqrt(sum / resampled.length) * 3); // ×3 视觉增益
        const nowMs = Date.now();
        if (nowMs - lastLevelPushRef.current > 50) {
          lastLevelPushRef.current = nowMs;
          setState((s) => (s.mic.active ? { ...s, mic: { ...s.mic, level: rms } } : s));
        }
        const buf = micBufRef.current;
        for (let i = 0; i < resampled.length; i++) buf.push(resampled[i] as number);
        while (buf.length >= MIC_FRAME_SAMPLES) {
          sendMicFrame(new Float32Array(buf.splice(0, MIC_FRAME_SAMPLES)));
        }
      };
      src.connect(node);
      micNodeRef.current = node;
      setState((s) => ({ ...s, mic: { active: true, aec, error: null, level: 0 } }));
    } catch (err) {
      setState((s) => ({ ...s, mic: { active: false, aec: null, error: String(err), level: 0 } }));
    }
  }, [sendMicFrame]);

  const stopPlayback = useCallback(() => {
    if (playoutTimerRef.current) {
      clearInterval(playoutTimerRef.current);
      playoutTimerRef.current = null;
    }
    audioRef.current?.pause();
    audioRef.current = null;
    playingSentenceRef.current = null;
  }, []);

  /** F23:丢弃排队未播句(用户打断/卸载)——未播句从未报 playout,unheard 语义自然成立 */
  const clearAudioQueue = useCallback(() => {
    for (const q of audioQueueRef.current) URL.revokeObjectURL(q.url);
    audioQueueRef.current = [];
  }, []);

  const reportPlayout = useCallback(() => {
    const ws = wsRef.current;
    const audio = audioRef.current;
    const sentenceId = playingSentenceRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !audio || !sentenceId) return;
    ws.send(
      JSON.stringify({ t: "tts.playout", sessionId, sentenceId, watermarkMs: Math.round(audio.currentTime * 1000) })
    );
  }, [sessionId]);

  /** F23(2026-08-04 任务3 dogfood 抓出:连发多句后句截断前句):句音频顺序播放——
   *  播完出队续播;新句到达时在播则入队,不再 stopPlayback 覆盖 */
  const startPlayback = useCallback(
    function start(sentenceId: string, url: string) {
      const audio = new Audio(url);
      audioRef.current = audio;
      playingSentenceRef.current = sentenceId;
      playoutTimerRef.current = window.setInterval(reportPlayout, 250);
      audio.onended = () => {
        reportPlayout();
        stopPlayback();
        const next = audioQueueRef.current.shift();
        if (next) start(next.sentenceId, next.url);
      };
      audio.play().then(
        () => setState((s) => (s.audioBlocked ? { ...s, audioBlocked: false } : s)),
        () => setState((s) => ({ ...s, audioBlocked: true })) // autoplay 被拒:置提示,等用户手势 retryAudio
      );
    },
    [reportPlayout, stopPlayback]
  );

  /** 在播则触发 barge-in(watermark 截断,unheard 纪律)——PTT 按下与免手 VAD start 共用 */
  const bargeInIfPlaying = useCallback(() => {
    const ws = wsRef.current;
    const audio = audioRef.current;
    const sentenceId = playingSentenceRef.current;
    clearAudioQueue(); // F23:用户开口=打断一切,排队未播句一并丢弃
    if (ws && ws.readyState === WebSocket.OPEN && audio && sentenceId) {
      ws.send(
        JSON.stringify({
          t: "barge_in",
          sessionId,
          atMs: Math.round(audio.currentTime * 1000),
          truncatedSentenceId: sentenceId
        })
      );
      stopPlayback();
    }
  }, [sessionId, stopPlayback, clearAudioQueue]);

  const reconnectRef = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let heartbeatTimer: number | null = null;
    let skipAutoReconnect = false;
    let connectedOnce = false; // VIEW-01:首连之后的每次 hello.ack 都是重连 → 页面数据可能已过期
    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
    const scheduleReconnect = (immediate: boolean) => {
      if (disposed) return;
      clearReconnectTimer();
      if (immediate) {
        reconnectAttempt = 0;
        reconnectTimer = window.setTimeout(connect, 0);
        return;
      }
      const delay = nextWsReconnectDelayMs(reconnectAttempt++);
      reconnectTimer = window.setTimeout(connect, delay);
    };
    const forceReconnect = () => {
      if (disposed) return;
      clearReconnectTimer();
      reconnectAttempt = 0;
      const current = wsRef.current;
      if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
        skipAutoReconnect = true;
        try {
          current.close();
        } catch {
          // close 失败仍继续建新连接
        }
        if (wsRef.current === current) wsRef.current = null;
      }
      scheduleReconnect(true);
    };
    reconnectRef.current = forceReconnect;
    let lastReconnectAtMs: number | null = null;
    const requestReconnect = (trigger: ReconnectTrigger) => {
      const ws = wsRef.current;
      const decision = shouldFireReconnect({
        trigger,
        wsOpen: ws !== null && ws.readyState === WebSocket.OPEN,
        nowMs: Date.now(),
        lastFiredAtMs: lastReconnectAtMs
      });
      lastReconnectAtMs = decision.nextLastFiredAtMs;
      if (decision.fire) forceReconnect();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      requestReconnect("visibility");
    };
    const onReconnectRequest = () => requestReconnect("manual");
    const onNativeResume = () => requestReconnect("native-resume");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(WS_RECONNECT_REQUEST_EVENT, onReconnectRequest);
    window.addEventListener(NATIVE_RESUME_EVENT, onNativeResume);
    const connect = () => {
      if (disposed) return;
      clearReconnectTimer();
      const ws = new WebSocket(wsUrl());
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ v: VOICE_WS_PROTOCOL_VERSION, role: "console" }));
        // ④e A6:应用层心跳 30s(daemon 90s 超时视同断开)
        if (heartbeatTimer) window.clearInterval(heartbeatTimer);
        heartbeatTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN && sessionId) {
            ws.send(JSON.stringify({ t: "console.heartbeat", sessionId, atMs: performance.now() }));
          }
        }, 30_000);
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (heartbeatTimer) {
          window.clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        setState((s) => ({ ...s, connected: false }));
        if (disposed) return;
        if (skipAutoReconnect) {
          skipAutoReconnect = false;
          return;
        }
        scheduleReconnect(false);
      };
      ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") {
        // 二进制:tag 0x02 = TTS 句音频(seq 4B + sentenceId 长度 1B + sentenceId + mp3)
        const buf = new Uint8Array(ev.data as ArrayBuffer);
        if (buf[0] !== 0x02) return;
        const idLen = buf[5] ?? 0;
        const sentenceId = new TextDecoder().decode(buf.slice(6, 6 + idLen));
        const mp3 = buf.slice(6 + idLen);
        const url = URL.createObjectURL(new Blob([mp3], { type: "audio/mpeg" }));
        // F23:在播则入队(播完出队续播),不再截断前句;空闲直接播
        if (playingSentenceRef.current !== null) audioQueueRef.current.push({ sentenceId, url });
        else startPlayback(sentenceId, url);
        return;
      }
      const msg = JSON.parse(ev.data) as Record<string, unknown>;
      switch (msg["t"]) {
        case "hello.ack":
          reconnectAttempt = 0;
          setState((s) => ({ ...s, connected: true }));
          if (connectedOnce) dispatchDataInvalidate("ws.reconnect");
          connectedOnce = true;
          // 每次连接/重连都同步同一 durable sessionId；daemon 借 voice.mode 回放最新 session.project。
          ws.send(JSON.stringify({ t: "voice.mode", sessionId, mode: modeRef.current }));
          // ④e A6:握手后立即心跳,避免 30s 空窗被 90s 超时误杀(无 session 不发,schema 要求 sessionId)
          if (sessionId) ws.send(JSON.stringify({ t: "console.heartbeat", sessionId, atMs: performance.now() }));
          break;
        case "session.project": {
          const parsed = pipelineMsgSchema.safeParse(msg);
          if (!parsed.success || parsed.data.t !== "session.project") break;
          const projectMessage = parsed.data;
          setState((s) => {
            const sessionProject = reduceSessionProject(s.sessionProject, projectMessage, sessionId);
            return sessionProject === s.sessionProject ? s : { ...s, sessionProject };
          });
          break;
        }
        case "asr.partial":
        case "asr.final": {
          const final = msg["t"] === "asr.final";
          // 双动作路由(2026-07-28,评审 A2):PTT 采集轮按 FIFO 队列出队消费——
          // send=替换占位气泡+思考中;edit=只进编辑框事件(绝不进对话流,不置思考中);
          // cancelled=静默丢弃。队空(免手档/注入)走原行为。PTT 整段识别无 partial,分支互斥。
          const entry = final ? captureQueueRef.current.shift() : undefined;
          if (entry) window.clearTimeout(entry.timer);
          // 实施后 review B-2:PTT 模式下队空到达的 final = 超时逐出/切模式后的迟到孤儿——
          // 直接丢弃(回落原路径会让编辑/取消轮以"已发出"气泡复活 + thinking 悬挂);免手档不经队列照常
          if (final && !entry && modeRef.current === "ptt") break;
          if (entry && final) {
            const text = (msg["text"] as string).trim();
            if (entry.kind === "cancelled") break;
            if (entry.kind === "edit") {
              // 空转写(短按/没听清)也要出事件——Chat 侧给"没听清"反馈,不留悬挂 loading
              setState((s) => ({ ...s, draftEvent: text === "" ? { kind: "error" } : { kind: "text", text } }));
              break;
            }
            // send 档:替换占位气泡;空转写 ⇒ 占位置失败态(没听清),不喂 thinking(daemon 侧同判空跳过 Brain)
            setState((s) => ({
              ...s,
              transcript: s.transcript.map((t) =>
                t.turnId === entry.placeholderKey
                  ? text === ""
                    ? { ...t, transcribing: false, failed: true }
                    : { ...t, turnId: msg["turnId"] as string, text, final: true, transcribing: false }
                  : t
              )
            }));
            if (text !== "") setThinkingWithFallback();
            break;
          }
          setState((s) => {
            const turnId = msg["turnId"] as string;
            // A2:同 turnId 替换保原到达位(partial 渐显转 final 不跳位);新轮取新序
            const prior = s.transcript.find((x) => x.turnId === turnId && !x.final);
            const seq = prior?.seq ?? ++arrivalSeqRef.current;
            const item: TranscriptItem = { turnId, text: msg["text"] as string, final, seq };
            const rest = s.transcript.filter((x) => x.turnId !== turnId || x.final);
            // A3:用户说完(final)到 Brain 首句之间显示思考中;兜底覆盖 oneshot wall timeout。
            if (final && (msg["text"] as string).trim() !== "") {
              if (thinkingTimerRef.current) window.clearTimeout(thinkingTimerRef.current);
              thinkingTimerRef.current = window.setTimeout(
                () => setState((s2) => ({ ...s2, thinking: false })),
                THINKING_FALLBACK_MS
              );
              return { ...s, transcript: [...rest, item], thinking: true };
            }
            return { ...s, transcript: [...rest, item] };
          });
          break;
        }
        case "tts.say": {
          if (thinkingTimerRef.current) {
            window.clearTimeout(thinkingTimerRef.current);
            thinkingTimerRef.current = null;
          }
          const sentenceId = msg["sentenceId"] as string;
          // 常见句 id:`s-${turnId}-${i}` / `s-focus-*-${turnId}` —— 取最长像 id 的段作 turn 归并键
          const turnGuess = guessTurnIdFromSentenceId(sentenceId);
          setState((s) => {
            // 若该 turn 已有 screen_text 全文,不再叠逐句
            if (turnGuess && s.spoken.some((sp) => sp.turnId === turnGuess && sp.fullScreenText)) {
              return { ...s, thinking: false };
            }
            return {
              ...s,
              thinking: false, // A3:Brain 回话到达,pending 结束
              spoken: [
                ...s.spoken,
                {
                  sentenceId,
                  text: msg["text"] as string,
                  truncated: false,
                  seq: ++arrivalSeqRef.current,
                  ...(turnGuess ? { turnId: turnGuess } : {})
                }
              ]
            };
          });
          break;
        }
        case "native.reply": {
          const parsed = pipelineMsgSchema.safeParse(msg);
          if (!parsed.success || parsed.data.t !== "native.reply") break;
          const { sessionId: replySessionId, turnId, sentenceId, text, origin } = parsed.data;
          if (replySessionId !== sessionId) break;
          setState((s) => ({
            ...s,
            nativeReplies: enqueueNativeReply(
              s.nativeReplies,
              { sessionId: replySessionId, turnId, sentenceId, text, origin }
            )
          }));
          break;
        }
        case "screen_text": {
          // ④e:同 turnId 替换该轮逐句气泡为全文(不双显;用户轮时长标在 transcript 侧不受影响)
          const turnId = msg["turnId"] as string;
          const text = msg["text"] as string;
          setState((s) => {
            const rest = s.spoken.filter((sp) => sp.turnId !== turnId && !sentenceIdBelongsToTurn(sp.sentenceId, turnId));
            const priorSeq = s.spoken.find((sp) => sp.turnId === turnId || sentenceIdBelongsToTurn(sp.sentenceId, turnId))?.seq;
            return {
              ...s,
              thinking: false,
              spoken: [
                ...rest,
                {
                  sentenceId: `screen-${turnId}`,
                  text,
                  truncated: false,
                  seq: priorSeq ?? ++arrivalSeqRef.current,
                  turnId,
                  fullScreenText: true
                }
              ]
            };
          });
          break;
        }
        case "barge_in":
          setState((s) => ({
            ...s,
            spoken: s.spoken.map((sp) =>
              sp.sentenceId === (msg["truncatedSentenceId"] as string) ? { ...sp, truncated: true } : sp
            )
          }));
          break;
        case "vad.speech":
          // W2 阶段 D:免手档用户开口(pipeline VAD)——在播即截断(barge_in + watermark,unheard 不变)
          if (msg["phase"] === "start" && modeRef.current === "hands_free") bargeInIfPlaying();
          break;
        case "pipeline.health":
          setState((s) => ({ ...s, health: { asr: msg["asr"] as string, tts: msg["tts"] as string } }));
          break;
        // F25:确认卡生命周期(card -> countdown(可选) -> resolved;单 pending 不变量,新卡顶旧卡)
        case "confirm.card":
          setState((s) => ({
            ...s,
            confirmCard: {
              receiptId: msg["receiptId"] as string,
              text: msg["text"] as string,
              kind: (msg["kind"] as string) ?? "unknown",
              digest: (msg["digest"] as string) ?? "",
              digestVersion: (msg["digestVersion"] as number) ?? 1,
              countdownStartAt: null,
              countdownMs: null
            }
          }));
          break;
        case "confirm.countdown":
          setState((s) =>
            s.confirmCard && s.confirmCard.receiptId === (msg["receiptId"] as string)
              ? { ...s, confirmCard: { ...s.confirmCard, countdownStartAt: Date.now(), countdownMs: msg["ms"] as number } }
              : s
          );
          break;
        case "confirm.resolved":
          // 确认卡完成本身不长实体卡(后续写入成功才长——daemon 在写入处发射)
          dispatchDataInvalidate("confirm.resolved");
          setState((s) =>
            s.confirmCard && s.confirmCard.receiptId === (msg["receiptId"] as string) ? { ...s, confirmCard: null } : s
          );
          break;
        case "focus.entity": {
          const raw = msg["entity"] as Record<string, unknown> | undefined;
          if (!raw || typeof raw !== "object") break;
          const item: EntityItem = {
            id: String(raw["id"] ?? ""),
            kind: String(raw["kind"] ?? ""),
            title: String(raw["title"] ?? ""),
            sub: String(raw["sub"] ?? ""),
            color: String(raw["color"] ?? "act"),
            at: String(raw["at"] ?? new Date().toISOString())
          };
          if (!item.id || !item.kind) break;
          dispatchDataInvalidate("focus.entity");
          setState((s) => ({
            ...s,
            entities: [item, ...s.entities.filter((e) => e.id !== item.id)].slice(0, 50)
          }));
          break;
        }
      }
      };
    };
    connect();
    return () => {
      disposed = true;
      reconnectRef.current = () => {};
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(WS_RECONNECT_REQUEST_EVENT, onReconnectRequest);
      window.removeEventListener(NATIVE_RESUME_EVENT, onNativeResume);
      clearReconnectTimer();
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      stopPlayback();
      clearAudioQueue();
      stopMic();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      void micCtxRef.current?.close();
      micCtxRef.current = null;
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [sessionId, reportPlayout, stopPlayback, stopMic, startPlayback, clearAudioQueue]);

  const reconnect = useCallback(() => {
    reconnectRef.current();
  }, []);

  /** PTT 按下:开麦采集上行;若在播报即触发 barge-in(unheard 纪律的播放侧) */
  const pttDown = useCallback(() => {
    bargeInIfPlaying();
    void startMic();
  }, [bargeInIfPlaying, startMic]);

  const pttUp = useCallback(() => {
    stopMic();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "turn.done_speaking", sessionId }));
    }
  }, [sessionId, stopMic]);

  /** W2 阶段 D:模式切换(免手=常开麦 + pipeline VAD 起停;PTT 保留为兜底通道) */
  const setMode = useCallback(
    (mode: "ptt" | "hands_free") => {
      modeRef.current = mode;
      // 评审 A2:切模式清采集队列——遗留 send 占位置失败态,不留悬挂 loading;
      // 在途识别 pipeline 不 cancel(rebound 只清 VAD/EOU/mic 缓冲),迟到 final 由"PTT 队空丢弃"兜住(review B-2)
      for (const entry of captureQueueRef.current) {
        window.clearTimeout(entry.timer);
        if (entry.kind === "send" && entry.placeholderKey) {
          const key = entry.placeholderKey;
          setState((s) => ({
            ...s,
            transcript: s.transcript.map((t) => (t.turnId === key ? { ...t, transcribing: false, failed: true } : t))
          }));
        }
      }
      captureQueueRef.current = [];
      setState((s) => ({ ...s, mode, draftEvent: null }));
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ t: "voice.mode", sessionId, mode }));
      }
      if (mode === "hands_free") void startMic();
      else stopMic();
    },
    [sessionId, startMic, stopMic]
  );

  /** W2 阶段 D:显式"说完了"按钮(轮次第三层兜底;免手档强制终结当前轮) */
  const doneSpeaking = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "turn.done_speaking", sessionId }));
    }
  }, [sessionId]);

  /** W4 3.9:采完不直发(手动档进"待确认";11 §5.10)。RA-closeout 修复(2026-07-28):
   *  发 done_speaking + holdForConfirm——pipeline 需要轮次边界才 finalize 产 final 转写(此前只停麦
   *  不发信号 ⇒ final 永不来、待确认框恒空);daemon 消费 hold 标记挡该轮进 Brain,转写照常回填。 */
  const stopCaptureHold = useCallback(() => {
    stopMic();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "turn.done_speaking", sessionId, holdForConfirm: true }));
    }
  }, [sessionId, stopMic]);

  /** 双动作 A·直接发送(2026-07-28,11 §5.10):松开即发——对话流立刻插占位气泡
   *  「语音 mm:ss · 转写中…」(已发出语义),final 到达替换文字 + Brain 开跑(daemon 直发链)。 */
  const endCaptureSend = useCallback(
    (durationSec: number) => {
      stopMic();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ t: "turn.done_speaking", sessionId }));
      }
      const placeholderKey = `voice-pending-${++placeholderSeqRef.current}`;
      setState((s) => ({
        ...s,
        transcript: [...s.transcript, { turnId: placeholderKey, text: "", final: true, seq: ++arrivalSeqRef.current, transcribing: true, durationSec }]
      }));
      enqueueCapture("send", durationSec, placeholderKey);
    },
    [sessionId, stopMic, enqueueCapture]
  );

  /** 双动作 B·转写编辑:只进编辑框(draftEvent),绝不进对话流;编辑后 sendText 才进对话+Brain。 */
  const endCaptureEdit = useCallback(
    (durationSec: number) => {
      stopCaptureHold();
      enqueueCapture("edit", durationSec);
    },
    [stopCaptureHold, enqueueCapture]
  );

  /** 取消(修隐藏 bug:旧 cancelRecording 走 pttUp = 直发进 Brain):hold 语义收尾轮次,
   *  final 到达按 cancelled 静默丢弃——对话事实零痕迹。 */
  const cancelCapture = useCallback(
    (durationSec: number) => {
      stopCaptureHold();
      enqueueCapture("cancelled", durationSec);
    },
    [stopCaptureHold, enqueueCapture]
  );

  /** B 档结果事件消费(Chat 读后清;C1 守卫在消费端) */
  const consumeDraftEvent = useCallback(() => {
    setState((s) => (s.draftEvent ? { ...s, draftEvent: null } : s));
  }, []);

  const consumeNativeReplies = useCallback((count: number) => {
    if (!Number.isInteger(count) || count <= 0) return;
    setState((s) => ({ ...s, nativeReplies: consumeNativeReplyQueue(s.nativeReplies, count) }));
  }, []);

  /** W4 3.9:发送编辑后文本轮(纠 ASR 误听正道;typed provenance)——turnId 客户端生成(daemon 侧作用户轮) */
  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (t === "") return false;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
      let ulid = "";
      for (let i = 0; i < 26; i++) ulid += alphabet[Math.floor(Math.random() * 32)];
      ws.send(JSON.stringify({ t: "turn.text", sessionId, turnId: `ses_${ulid}`, text: t, typed: true }));
      // 本地即时回显为用户轮(乐观;daemon 侧同 turnId 的转写落盘);thinking 经统一 helper 兜底。
      setState((s) => ({
        ...s,
        transcript: [...s.transcript, { turnId: `ses_${ulid}`, text: t, final: true, seq: ++arrivalSeqRef.current }]
      }));
      setThinkingWithFallback();
      return true;
    },
    [sessionId]
  );

  /** 批 1:确认卡点击(confirm.click + digest;退役 sendText 词表复用) */
  const sendConfirmClick = useCallback(
    (decision: "accept" | "reject") => {
      const card = state.confirmCard;
      const ws = wsRef.current;
      if (!card || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (!card.digest) return;
      ws.send(
        JSON.stringify({
          t: "confirm.click",
          sessionId,
          receiptId: card.receiptId,
          digest: card.digest,
          decision
        })
      );
    },
    [sessionId, state.confirmCard]
  );

  /** dogfood 修复:用户手势重试被 autoplay 拦下的当前句(点"启用声音"时调) */
  const retryAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) {
      setState((s) => ({ ...s, audioBlocked: false })); // 句子已过,清提示;后续句有手势即可播
      return;
    }
    a.play().then(
      () => setState((s) => ({ ...s, audioBlocked: false })),
      () => setState((s) => ({ ...s, audioBlocked: true }))
    );
  }, []);

  return {
    ...state,
    pttDown,
    pttUp,
    setMode,
    doneSpeaking,
    stopCaptureHold,
    endCaptureSend,
    endCaptureEdit,
    cancelCapture,
    consumeDraftEvent,
    consumeNativeReplies,
    sendText,
    sendConfirmClick,
    retryAudio,
    reconnect
  };
}
