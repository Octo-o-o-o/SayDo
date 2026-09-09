// A1⇄A2 语音中枢(计划 1.2):daemon 侧 WS server,承载 09 §10 PipelineMsg 契约。
// - 两类对端:pipeline(Python 语音进程,无状态可重启)与 console(浏览器音频页);
// - 版本协商:连接首消息 hello {v:1, role},版本不匹配 fail-closed 拒连(modules/a A1);
// - 测试音频注入通道:injectPipelineMsg —— asr.final / barge_in / tts.playout 三类事件可注入,
//   供 1.1/2.4/4.2 打断作废/5.3 音频断言一人可跑(不依赖真麦克风);
// - 二进制音频通道(09 §10 "二进制帧另通道,seq 配对";形态 canonical 未锁定,工程自决,记 evidence):
//   1 字节 tag(0x01 mic PCM 上行 / 0x02 TTS 音频下行)+ 4 字节 BE seq + payload;
// - capability token 参数位:?token= 现在只透传记录,校验 4.1 启用(计划 1.2 括注,防 5.x 返工)。

import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import {
  pipelineMsgSchema,
  RUNTIME_PROTOCOL_VERSION,
  runtimeIdentitySchema,
  runtimeProtocolCompatible,
  type NativeReplyOrigin,
  type PipelineMsg,
  type RuntimeIdentity
} from "@saydo/contracts";
import type { Logger } from "../obs/logger.js";
import { redactText } from "./redactor.js";
import type { RedactSpan } from "./redactor.js";
import type { IdentityVia } from "../net/identity.js";
import { remoteVoiceWsDecision } from "../net/remoteSurface.js";

export const VOICE_WS_PROTOCOL_VERSION = 1;

/** ④e A6:console 应用层心跳间隔(客户端);超时视同断开 */
export const CONSOLE_HEARTBEAT_INTERVAL_MS = 30_000;
export const CONSOLE_HEARTBEAT_TIMEOUT_MS = 90_000;

function turnIdFromSentenceId(sentenceId: string): string {
  return /ses_[0-9A-HJKMNP-TV-Z]{26}/u.exec(sentenceId)?.[0] ?? sentenceId;
}

export type PeerRole = "pipeline" | "console";

export interface VoiceDelivery {
  attempted: number;
  succeeded: number;
  failed: number;
}

/** console peer 对外可见元数据(predicate / 测试) */
export interface ConsolePeerMeta {
  via?: IdentityVia | undefined;
  role: PeerRole;
  sessionIds: ReadonlySet<string>;
}

export interface VoiceHubEvents {
  onAsrFinal?: (msg: Extract<PipelineMsg, { t: "asr.final" | "asr.partial" }>) => void;
  onBargeIn?: (msg: Extract<PipelineMsg, { t: "barge_in" }>) => void;
  onPlayout?: (msg: Extract<PipelineMsg, { t: "tts.playout" }>) => void;
  onTurnSignal?: (msg: Extract<PipelineMsg, { t: "turn.done_speaking" | "turn.listen_again" }>) => void;
  /** W4 3.9:console 编辑后文本轮(11 §5.10;纠 ASR 误听正道)——喂对话环作用户轮(typed provenance) */
  onTurnText?: (msg: Extract<PipelineMsg, { t: "turn.text" }>) => void;
  /** 批 1:console 确认卡点击(confirm.click;digest 绑定) */
  onConfirmClick?: (msg: Extract<PipelineMsg, { t: "confirm.click" }>) => void;
  /** M1:移动确认按卡原 session+receipt 显式定向,含撤销 */
  onConfirmDecision?: (
    msg: Extract<PipelineMsg, { t: "confirm.decision" }>,
    via: IdentityVia | undefined
  ) => Extract<PipelineMsg, { t: "confirm.resolved" }> | void;
  /** console 重连/切模式时回放该 session 最新 durable project 锚。 */
  onVoiceMode?: (msg: Extract<PipelineMsg, { t: "voice.mode" }>) => void;
  onHealth?: (msg: Extract<PipelineMsg, { t: "pipeline.health" }>) => void;
  /** TTS 用量记账钩子(C8 接线:tts.say 字符数) */
  onTtsChars?: (sessionId: string, chars: number) => void;
  /** M3 五段延迟时间戳(pipeline 报 vad_end/asr_final/tts_first_byte;console 报 playout_start) */
  onLatencyStage?: (msg: Extract<PipelineMsg, { t: "latency.stage" }>) => void;
  /** pipeline peer 完成 hello(接线批:daemon 借此主动推送热词偏置词表) */
  onPipelineJoined?: (identity: RuntimeIdentity, generation?: number) => void;
  onPipelineLeft?: () => void;
  /** first-run onboarding v4:pipeline 对 restart_pending 的 ACK */
  onRestartAck?: (generation: number) => void;
  /**
   * ④e A6:某 session 的全部 console peer 离线(断开或心跳超时)——调用方取消 idle 收场定时器,
   * 防止 K2 幽灵收尾(无人在场仍 idle-suspend)。
   */
  onConsoleSessionOffline?: (sessionId: string) => void;
  /** G1 网络半边(4.1):WS 连接身份校验;返回非 ok ⇒ 拒连。缺省(测试)不校验。
   *  via(W2 迟到评审 A1 回收):来源面标注透传——tailnet console 在连时语音工具环 S3 集合拒。 */
  verifyUpgrade?: (req: IncomingMessage) => { ok: boolean; code?: string; via?: IdentityVia };
}

interface Peer {
  ws: WebSocket;
  role: PeerRole;
  helloDone: boolean;
  token?: string | undefined;
  via?: IdentityVia | undefined;
  identity?: RuntimeIdentity | undefined;
  stateRootDigest?: string | undefined;
  pipelineAuthorized?: boolean | undefined;
  /** first-run onboarding:pipeline 上报的 restart generation */
  generation?: number | undefined;
  pipelineUnavailable?: boolean | undefined;
  /** ④e:本 peer 绑定的 session(voice.mode / heartbeat 登记) */
  sessionIds?: Set<string> | undefined;
  /** ④e A6:最近应用层心跳单调毫秒(console only) */
  lastHeartbeatAtMs?: number | undefined;
  heartbeatTimer?: ReturnType<typeof setInterval> | undefined;
  pipelineHealthTimer?: ReturnType<typeof setTimeout> | undefined;
}

export class VoiceHub {
  // role 可发起的消息类型(B8):pipeline 报 asr/playout/health/turn;console 只发 mic/PTT/播放回报;
  // asr.*(转写)只信 pipeline;tts.say 不在任何 peer 白名单——只许 daemon sendTtsSay。
  private static readonly ROLE_ALLOWED: Record<PeerRole, Set<string>> = {
    pipeline: new Set([
      "asr.partial",
      "asr.final",
      "tts.playout",
      "barge_in",
      "turn.done_speaking",
      "turn.listen_again",
      "pipeline.health",
      "pipeline.restart_ack", // first-run onboarding v4:协调重启 ACK
      "audio.frame",
      "latency.stage", // M3:vad_end/asr_final/tts_first_byte(pipeline 侧三段)
      "vad.speech" // W2 阶段 D:免手档语音活动边界(start 供 console 播放侧触发 barge-in)
    ]),
    // console 可报 playout_start(实际出声在 console 播放器;llm_first_token 由 daemon 自记不走 WS)
    console: new Set([
      "barge_in",
      "turn.done_speaking",
      "turn.listen_again",
      "audio.frame",
      "tts.playout",
      "latency.stage",
      "voice.mode",
      "turn.text",
      "confirm.click",
      "confirm.decision",
      "console.heartbeat" // ④e A6
    ])
  };
  /** M1 LAN 不是语音采集/播放控制面，只开放文本、定向裁决、会话登记与心跳。 */
  private static readonly MOBILE_LAN_UPSTREAM_ALLOWED = new Set([
    "voice.mode",
    "turn.text",
    "confirm.decision",
    "console.heartbeat"
  ]);
  /** M2-voice-a:mobile_lan 下行只保留移动 UI 所需文本事件，二进制另在 broadcastBinary 拒绝。 */
  private static readonly MOBILE_LAN_DOWNSTREAM_ALLOWED = new Set([
    "tts.say",
    "native.reply",
    "confirm.card",
    "confirm.countdown",
    "confirm.resolved",
    "focus.entity",
    "session.project"
  ]);

  private readonly wss: WebSocketServer;
  private readonly peers = new Set<Peer>();
  private currentPipelinePeer: Peer | undefined;
  /** capture ingress 评审 B-5(2026-08-26):最近一次转发给 pipeline 的采集模式。pipeline 单独
   *  重连会把自身 _mode 清账回 ptt,而在线 console 只在自己 hello.ack/用户切档时发 voice.mode——
   *  免手档下 mic 帧会在 pipeline 侧无限积压且永不 finalize。join 完成时由 hub 重放兜住;
   *  mobile_lan 来源不记录(不得借登记消息改采集模式,同 dispatch 红线)。 */
  private lastVoiceMode: Extract<PipelineMsg, { t: "voice.mode" }> | undefined;
  private readonly watermarks = new Map<string, { sentenceId: string; watermarkMs: number }>(); // sessionId -> 最新播出水位
  private events: VoiceHubEvents;
  /** first-run onboarding:等 pipeline.restart_ack 的 waiter(generation -> resolvers) */
  private readonly restartAckWaiters = new Map<number, Array<(acked: boolean) => void>>();
  private closePromise: Promise<void> | null = null;

  constructor(
    server: Server,
    private readonly log: Logger,
    events: VoiceHubEvents = {},
    private readonly runtimeProtocolVersion = RUNTIME_PROTOCOL_VERSION,
    private readonly expectedStateRootDigest?: string
  ) {
    this.events = events;
    this.wss = new WebSocketServer({ server, path: "/ws/voice" });
    this.wss.on("connection", (ws, req) => this.onConnection(ws, req));
  }

  /** 最近一次 console 登记的采集模式(ptt / hands_free);延迟观测按此给语音轮打 origin(全局近似,非 per-session) */
  currentVoiceMode(): "ptt" | "hands_free" | undefined {
    return this.lastVoiceMode?.mode;
  }

  setEvents(events: VoiceHubEvents): void {
    this.events = events;
  }

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    // G1 网络半边(4.1):连接身份校验(Host/Origin/token);不过 fail-closed 拒连
    let via: IdentityVia | undefined;
    if (this.events.verifyUpgrade) {
      const v = this.events.verifyUpgrade(req);
      if (!v.ok) {
        this.safeWarn("voice ws: identity rejected", { code: v.code ?? "unknown" });
        ws.close(4003, `identity rejected: ${v.code ?? "unknown"}`);
        return;
      }
      via = v.via;
    }
    const remoteWs = remoteVoiceWsDecision(via);
    if (!remoteWs.allow) {
      this.safeWarn("voice ws: remote business connection rejected", { code: remoteWs.code, via });
      ws.close(4003, remoteWs.code);
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token") ?? undefined;
    const peer: Peer = {
      ws,
      role: "console",
      helloDone: false,
      token,
      via,
      sessionIds: new Set(),
      lastHeartbeatAtMs: performance.now()
    };
    this.peers.add(peer);

    const helloTimeout = setTimeout(() => {
      if (!peer.helloDone) {
        this.safeWarn("voice ws: hello timeout, closing", {});
        ws.close(4002, "hello timeout");
      }
    }, 5000);

    ws.on("message", (data, isBinary) => {
      if (!peer.helloDone) {
        clearTimeout(helloTimeout);
        this.handleHello(peer, data, isBinary);
        return;
      }
      if (isBinary) {
        this.routeBinary(peer, data);
        return;
      }
      this.routeJson(peer, data);
    });
    const onPeerClose = (): void => {
      clearTimeout(helloTimeout);
      if (peer.heartbeatTimer) {
        clearInterval(peer.heartbeatTimer);
        peer.heartbeatTimer = undefined;
      }
      if (peer.pipelineHealthTimer) {
        clearTimeout(peer.pipelineHealthTimer);
        peer.pipelineHealthTimer = undefined;
      }
      const boundSessions = [...(peer.sessionIds ?? [])];
      this.peers.delete(peer);
      if (this.currentPipelinePeer === peer) {
        this.markPipelineUnavailable(peer);
        this.currentPipelinePeer = undefined;
      }
      // ④e A6:该 peer 绑定 session 若已无任何 console peer → 离线回调
      for (const sid of boundSessions) {
        if (!this.hasConsolePeerForSession(sid)) {
          try {
            this.events.onConsoleSessionOffline?.(sid);
          } catch (err) {
            this.safeWarn("voice ws: onConsoleSessionOffline failed", {
              sessionId: sid,
              error: err instanceof Error ? err.name : "unknown"
            });
          }
        }
      }
    };
    ws.on("close", onPeerClose);
    ws.on("error", (err) => {
      this.markPipelineUnavailable(peer);
      this.safeWarn("voice ws error", { error: String(err) });
    });
    // 半开检测(冻结尸检回修):对端冻结/网络半开时 close 事件永不来——服务端 30s ping,
    // 两个周期无 pong 即 terminate(触发 close 路径:peers 清理 + down 广播 + 对端库层感知重连)
    let alive = true;
    ws.on("pong", () => {
      alive = true;
    });
    const pinger = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(pinger);
        return;
      }
      if (!alive) {
        this.safeWarn("voice ws: peer unresponsive to ping; terminating", { role: peer.role });
        clearInterval(pinger);
        this.markPipelineUnavailable(peer);
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, 30_000);
    ws.on("close", () => clearInterval(pinger));
  }

  private hasPipelinePeer(): boolean {
    const peer = this.currentPipelinePeer;
    return !!(
      peer?.helloDone &&
      peer.pipelineAuthorized !== false &&
      !peer.pipelineUnavailable &&
      peer.ws.readyState === WebSocket.OPEN
    );
  }

  /** readiness 每次现读 transport；CLOSING owner 仍占席位，但不再算可用。 */
  pipelineAvailable(): boolean {
    return this.hasPipelinePeer();
  }

  private handleHello(peer: Peer, data: RawData, isBinary: boolean): void {
    if (isBinary) {
      peer.ws.close(4003, "hello must be json");
      return;
    }
    try {
      const hello = JSON.parse(String(data)) as {
        v?: number;
        role?: string;
        identity?: unknown;
        generation?: number;
      };
      if (hello.v !== VOICE_WS_PROTOCOL_VERSION) {
        // 版本不匹配 fail-closed 拒连(modules/a A1 失效与恢复)
        peer.ws.close(4001, `unsupported protocol version ${String(hello.v)}`);
        return;
      }
      if (hello.role !== "pipeline" && hello.role !== "console") {
        peer.ws.close(4003, "invalid role");
        return;
      }
      // 第四轮终验 B1 回修:role 是客户端自报——tailnet 客户端自称 pipeline 可①绕过
      // hasTailnetConsole 的 S3 门探测②进 asr.final 白名单注入伪造转写驱动工具环。
      // pipeline 永远与 daemon 同机(03 §9 架构事实),tailnet 来源自称 pipeline 即拒连。
      if (hello.role === "pipeline" && peer.via !== undefined && peer.via !== "local") {
        this.safeWarn("voice ws: remote peer claiming pipeline role rejected", { via: peer.via });
        peer.ws.close(4003, "pipeline role is local-only");
        return;
      }
      if (hello.role === "pipeline") {
        const identity = runtimeIdentitySchema.safeParse(hello.identity);
        if (!identity.success) {
          peer.ws.close(4001, "pipeline runtime identity missing or invalid");
          return;
        }
        if (!runtimeProtocolCompatible(identity.data.protocolVersion, this.runtimeProtocolVersion)) {
          peer.ws.close(4001, "pipeline protocol incompatible");
          return;
        }
        if (this.currentPipelinePeer) {
          this.safeWarn("voice ws: duplicate pipeline peer rejected", {});
          peer.ws.close(4003, "pipeline already connected");
          return;
        }
        peer.identity = identity.data;
        peer.pipelineAuthorized = this.expectedStateRootDigest === undefined;
        if (typeof hello.generation === "number" && Number.isFinite(hello.generation)) {
          peer.generation = hello.generation;
        }
      }
      peer.role = hello.role;
      peer.helloDone = true;
      if (peer.role === "pipeline") this.currentPipelinePeer = peer;
      // ④e A6:console peer 启用心跳监视(90s 无 console.heartbeat 视同断开)
      if (peer.role === "console") {
        peer.lastHeartbeatAtMs = performance.now();
        peer.heartbeatTimer = setInterval(() => this.checkConsoleHeartbeat(peer), 15_000);
        peer.heartbeatTimer.unref?.();
      }
      if (peer.role === "pipeline" && peer.pipelineAuthorized === false) {
        peer.pipelineHealthTimer = setTimeout(() => {
          if (peer.pipelineAuthorized === false && peer.ws.readyState === WebSocket.OPEN) {
            this.safeWarn("voice ws: pipeline health proof timeout", {});
            this.markPipelineUnavailable(peer);
            peer.ws.close(4001, "pipeline health proof timeout");
          }
        }, 5_000);
        peer.pipelineHealthTimer.unref?.();
      }
      peer.ws.send(JSON.stringify({ t: "hello.ack", v: VOICE_WS_PROTOCOL_VERSION }));
      try {
        this.log.info("voice ws peer joined", { role: peer.role });
      } catch {
        // 连接所有权已经建立，诊断异常不得反转。
      }
      if (peer.role === "pipeline" && peer.pipelineAuthorized) {
        this.firePipelineJoined(peer);
      }
    } catch {
      peer.ws.close(4003, "malformed hello");
    }
  }

  /** pipeline peer 完成接纳(hello 即授权,或首个 health 过 HOME 门):回调 + 采集模式重放。 */
  private firePipelineJoined(peer: Peer): void {
    try {
      this.events.onPipelineJoined?.(peer.identity as RuntimeIdentity, peer.generation);
    } catch (err) {
      this.safeWarn("voice ws: pipeline joined hook failed", {
        error: err instanceof Error ? err.name : "unknown"
      });
    }
    // B-5:重连的 pipeline 采集模式已清账回 ptt,在线 console 不会重发——重放最近生效档位
    // (含 sessionId 重绑);console 之后自己重连/切档时照常覆盖。
    if (this.lastVoiceMode) this.broadcast("pipeline", this.lastVoiceMode);
  }

  private routeJson(peer: Peer, data: RawData): void {
    let msg: PipelineMsg;
    try {
      msg = pipelineMsgSchema.parse(JSON.parse(String(data)));
    } catch (err) {
      this.safeWarn("voice ws: invalid message dropped", { from: peer.role, error: String(err).slice(0, 200) });
      return;
    }
    if (
      peer.role === "pipeline" &&
      (this.currentPipelinePeer !== peer ||
        peer.pipelineUnavailable ||
        peer.ws.readyState !== WebSocket.OPEN ||
        (peer.pipelineAuthorized === false && msg.t !== "pipeline.health"))
    ) {
      this.safeWarn("voice ws: unauthorised or stale pipeline message dropped", { t: msg.t });
      return;
    }
    if (
      msg.t === "pipeline.health" &&
      JSON.stringify(msg.identity) !== JSON.stringify(peer.identity)
    ) {
      this.safeWarn("voice ws: pipeline health identity mismatch, closing", {
        helloBuildId: peer.identity?.buildId,
        healthBuildId: msg.identity.buildId
      });
      this.markPipelineUnavailable(peer);
      peer.ws.close(4001, "pipeline health identity mismatch");
      return;
    }
    if (msg.t === "pipeline.health") {
      if (this.expectedStateRootDigest !== undefined && msg.stateRootDigest !== this.expectedStateRootDigest) {
        this.safeWarn("voice ws: pipeline state root mismatch, closing", {});
        this.markPipelineUnavailable(peer);
        peer.ws.close(4001, "pipeline state root mismatch");
        return;
      }
      peer.stateRootDigest = msg.stateRootDigest;
      if (peer.role === "pipeline" && peer.pipelineAuthorized === false) {
        peer.pipelineAuthorized = true;
        if (peer.pipelineHealthTimer) {
          clearTimeout(peer.pipelineHealthTimer);
          peer.pipelineHealthTimer = undefined;
        }
        this.firePipelineJoined(peer);
      }
    }
    if (peer.via === "mobile_lan" && !VoiceHub.MOBILE_LAN_UPSTREAM_ALLOWED.has(msg.t)) {
      this.safeWarn("voice ws: message type not allowed for mobile LAN, dropped", { t: msg.t });
      return;
    }
    // ④e:已过来源白名单的 console peer 绑定 session + 心跳刷新。
    if (peer.role === "console") {
      if (msg.t === "voice.mode" || msg.t === "console.heartbeat") {
        if (!peer.sessionIds) peer.sessionIds = new Set();
        peer.sessionIds.add(msg.sessionId);
        peer.lastHeartbeatAtMs = performance.now();
      } else if ("sessionId" in msg && typeof msg.sessionId === "string") {
        if (!peer.sessionIds) peer.sessionIds = new Set();
        peer.sessionIds.add(msg.sessionId);
      }
    }
    this.dispatch(msg, peer.role, peer.via, peer);
  }

  /** 统一分发(真实对端与注入通道共用同一路径,保证测试等价性) */
  private dispatch(msg: PipelineMsg, from: PeerRole | "inject", via?: IdentityVia, sourcePeer?: Peer): void {
    // role -> 允许发起的消息类型白名单(评审 B8:防 console 伪造 asr.final 驱动 Brain / 污染 watermark;
    // tts.say 只许 daemon 经 sendTtsSay 下发,任何 peer 发均丢弃——评审 B7)。inject=daemon 内部,豁免。
    if (from !== "inject" && !VoiceHub.ROLE_ALLOWED[from].has(msg.t)) {
      this.safeWarn("voice ws: message type not allowed for role, dropped", { from, t: msg.t });
      return;
    }
    switch (msg.t) {
      case "asr.partial":
      case "asr.final":
        this.broadcast("console", msg);
        this.events.onAsrFinal?.(msg);
        break;
      case "tts.say":
        // daemon 发起(Brain 口播)——经 sendTtsSay;对端直发的 tts.say 只转发给 console 展示
        this.broadcast("console", msg);
        break;
      case "native.reply":
        // 只许 daemon 经 sendNativeReply 下发，任何 peer 直发均由角色白名单丢弃。
        break;
      case "tts.playout": {
        this.watermarks.set(msg.sessionId, { sentenceId: msg.sentenceId, watermarkMs: msg.watermarkMs });
        this.broadcast("pipeline", msg); // pipeline 需要 watermark 做打断截断
        this.events.onPlayout?.(msg);
        break;
      }
      case "barge_in":
        this.broadcast("pipeline", msg); // 停止合成
        this.broadcast("console", msg); // UI 标记截断句
        this.events.onBargeIn?.(msg);
        break;
      case "turn.done_speaking":
      case "turn.listen_again":
        // holdForConfirm 剥离后转发 pipeline(python 零感知,finalize 行为不变;标记只给 daemon 消费——RA-closeout 修复)
        if (msg.t === "turn.done_speaking" && msg.holdForConfirm) {
          this.broadcast("pipeline", { t: "turn.done_speaking", sessionId: msg.sessionId });
        } else {
          this.broadcast("pipeline", msg);
        }
        this.events.onTurnSignal?.(msg);
        break;
      case "turn.text":
        // W4 3.9:console 编辑后文本轮 —— 不转发 pipeline(无需再合成音频),直接喂对话环作用户轮
        this.events.onTurnText?.(msg);
        break;
      case "confirm.click":
        // 批 1:确认卡点击 —— 不转发 pipeline,daemon 侧 consumeClick
        this.events.onConfirmClick?.(msg);
        break;
      case "confirm.decision":
        // M1:移动裁决只进 daemon,sessionId 是卡原会话而非当前浏览器会话。
        {
          const response = this.events.onConfirmDecision?.(msg, via);
          if (response && sourcePeer) this.sendToPeer(sourcePeer, response);
        }
        break;
      case "pipeline.health":
        this.broadcast("console", msg);
        this.events.onHealth?.(msg);
        break;
      case "pipeline.restart_ack": {
        // first-run onboarding v4:仅消费,不转发
        this.events.onRestartAck?.(msg.generation);
        const waiters = this.restartAckWaiters.get(msg.generation);
        if (waiters) {
          this.restartAckWaiters.delete(msg.generation);
          for (const w of waiters) w(true);
        }
        break;
      }
      case "pipeline.restart_pending":
        // 只许 daemon 经 requestPipelineRestart 下发;peer 直发丢弃
        break;
      case "latency.stage":
        // M3:不转发(纯观测),daemon 收集入 LatencyCollector + JSONL
        this.events.onLatencyStage?.(msg);
        break;
      case "audio.frame":
        // 元数据帧:转发给 pipeline(与二进制帧 seq 配对)
        this.broadcast("pipeline", msg);
        break;
      case "voice.mode":
        // mobile_lan 只用本消息登记 session，不得借 Provider 默认握手改 pipeline 采集模式。
        if (via !== "mobile_lan") {
          this.lastVoiceMode = msg; // B-5:留档供 pipeline (re)join 重放
          this.broadcast("pipeline", msg);
        }
        this.events.onVoiceMode?.(msg);
        break;
      case "console.heartbeat":
        // ④e A6:session 绑定与 lastHeartbeat 已在 routeJson 刷新;不转发
        break;
      case "vad.speech":
        // W2 阶段 D:免手档语音活动边界(pipeline -> console;start 时 console 若在播则发 barge_in——
        // 截断语义仍走既有 barge_in 消息与 watermark,unheard 纪律不变)
        this.broadcast("console", msg);
        break;
      case "asr.hotwords":
        // 只许 daemon 经 sendHotwords 下发(不在任何 peer 白名单;inject 通道供测试)
        this.broadcast("pipeline", msg);
        break;
      case "screen_text":
        // 只许 daemon 经 sendToConsolePeers / sendScreenText 下发(peer 直发丢弃)
        break;
    }
    if (from === "inject") {
      this.log.debug("injected pipeline msg", { t: msg.t });
    }
  }

  /** 二进制通道:0x01 mic 上行 -> pipeline;0x02 TTS 音频下行 -> console */
  private lastNoPipelineWarnAt = 0;

  private routeBinary(peer: Peer, data: RawData): void {
    if (peer.via === "mobile_lan") {
      this.safeWarn("voice ws: binary frame not allowed for mobile LAN, dropped", {});
      return;
    }
    if (
      peer.role === "pipeline" &&
      (this.currentPipelinePeer !== peer ||
        peer.pipelineAuthorized === false ||
        peer.pipelineUnavailable ||
        peer.ws.readyState !== WebSocket.OPEN)
    ) {
      this.safeWarn("voice ws: stale pipeline binary dropped", {});
      return;
    }
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    if (buf.length < 5) return;
    const tag = buf[0];
    if (tag === 0x01 && peer.role === "console") {
      // 冻结尸检回修:mic 上行零 pipeline peer 时节流告警(此前静默丢弃,音频黑洞不可排障——
      // 与 sendTtsSay 无 peer 告警同构,补上行方向)
      if (!this.hasPipelinePeer()) {
        const now = Date.now();
        if (now - this.lastNoPipelineWarnAt > 30_000) {
          this.lastNoPipelineWarnAt = now;
          this.safeWarn("voice ws: mic frames dropped (no pipeline peer connected)", {});
        }
        return;
      }
      this.broadcastBinary("pipeline", buf);
    } else if (tag === 0x02 && peer.role === "pipeline") this.broadcastBinary("console", buf);
  }

  private safeWarn(message: string, fields: Record<string, unknown>): void {
    try {
      this.log.warn(message, fields);
    } catch {
      // 传输真值不得被诊断出口反转。
    }
  }

  private markPipelineUnavailable(peer: Peer): void {
    if (this.currentPipelinePeer !== peer || peer.pipelineUnavailable) return;
    peer.pipelineUnavailable = true;
    this.safeWarn("voice ws: pipeline unavailable; broadcasting down", {});
    this.broadcast("console", {
      t: "pipeline.health",
      asr: "down",
      tts: "down",
      identity: peer.identity ?? {
        sourceRevision: "0".repeat(40),
        buildId: "pipeline-unavailable",
        protocolVersion: this.runtimeProtocolVersion
      },
      stateRootDigest: peer.stateRootDigest ?? "0".repeat(64)
    });
    try {
      this.events.onPipelineLeft?.();
    } catch (err) {
      this.safeWarn("voice ws: pipeline unavailable hook failed", {
        error: err instanceof Error ? err.name : "unknown"
      });
    }
  }

  private broadcast(role: PeerRole, msg: PipelineMsg | Record<string, unknown>): VoiceDelivery {
    const text = JSON.stringify(msg);
    const delivery: VoiceDelivery = { attempted: 0, succeeded: 0, failed: 0 };
    for (const p of this.peers) {
      if (
        p.helloDone &&
        p.role === role &&
        p.ws.readyState === WebSocket.OPEN &&
        this.downstreamAllowed(p, msg) &&
        (role !== "pipeline" ||
          (this.currentPipelinePeer === p && p.pipelineAuthorized !== false && !p.pipelineUnavailable))
      ) {
        delivery.attempted += 1;
        try {
          p.ws.send(text);
          delivery.succeeded += 1;
        } catch (err) {
          delivery.failed += 1;
          this.safeWarn("voice ws: broadcast send failed", {
            role,
            t: typeof msg["t"] === "string" ? msg["t"] : "unknown",
            error: err instanceof Error ? err.name : "unknown"
          });
        }
      }
    }
    return delivery;
  }

  /**
   * ④e:按 predicate 定向发送到 console peer(如 screen_text 仅 via=local)。
   * 返回投递计数——话术门要求 succeeded≥1 才允许"放屏幕"宣告。
   */
  sendToConsolePeers(
    predicate: (meta: ConsolePeerMeta) => boolean,
    msg: PipelineMsg | Record<string, unknown>
  ): VoiceDelivery {
    const text = JSON.stringify(msg);
    const delivery: VoiceDelivery = { attempted: 0, succeeded: 0, failed: 0 };
    for (const p of this.peers) {
      if (!p.helloDone || p.role !== "console" || p.ws.readyState !== WebSocket.OPEN) continue;
      if (!this.downstreamAllowed(p, msg)) continue;
      const meta: ConsolePeerMeta = {
        via: p.via,
        role: p.role,
        sessionIds: p.sessionIds ?? new Set()
      };
      if (!predicate(meta)) continue;
      delivery.attempted += 1;
      try {
        p.ws.send(text);
        delivery.succeeded += 1;
      } catch (err) {
        delivery.failed += 1;
        this.safeWarn("voice ws: sendToConsolePeers failed", {
          t: typeof msg["t"] === "string" ? msg["t"] : "unknown",
          error: err instanceof Error ? err.name : "unknown"
        });
      }
    }
    return delivery;
  }

  /** 非终态请求结果只回发起 socket，不能让同 session 其他屏幕误清 durable 卡。 */
  private sendToPeer(peer: Peer, msg: PipelineMsg): VoiceDelivery {
    const delivery: VoiceDelivery = { attempted: 0, succeeded: 0, failed: 0 };
    if (!peer.helloDone || peer.role !== "console" || peer.ws.readyState !== WebSocket.OPEN) return delivery;
    if (!this.downstreamAllowed(peer, msg)) return delivery;
    delivery.attempted = 1;
    try {
      pipelineMsgSchema.parse(msg);
      peer.ws.send(JSON.stringify(msg));
      delivery.succeeded = 1;
    } catch (err) {
      delivery.failed = 1;
      this.safeWarn("voice ws: source reply failed", {
        t: msg.t,
        error: err instanceof Error ? err.name : "unknown"
      });
    }
    return delivery;
  }

  /** ④e:screen_text 仅投 via=local 的 console peer(不脱敏;via 未标注=非 local,拒) */
  sendScreenText(msg: Extract<PipelineMsg, { t: "screen_text" }>): VoiceDelivery {
    try {
      pipelineMsgSchema.parse(msg);
    } catch (err) {
      this.safeWarn("screen_text dropped (schema)", { error: String(err).slice(0, 120) });
      return { attempted: 0, succeeded: 0, failed: 0 };
    }
    return this.sendToConsolePeers((m) => m.via === "local", msg);
  }

  /** 某 session 是否仍有在连 console peer */
  hasConsolePeerForSession(sessionId: string): boolean {
    return [...this.peers].some(
      (p) =>
        p.helloDone &&
        p.role === "console" &&
        p.ws.readyState === WebSocket.OPEN &&
        (p.sessionIds?.has(sessionId) ?? false)
    );
  }

  /** 某 session 是否有 via=local 的在连 console(S1 小样上屏;sendScreenText 只投 local) */
  hasLocalConsolePeerForSession(sessionId: string): boolean {
    return [...this.peers].some(
      (p) =>
        p.helloDone &&
        p.role === "console" &&
        p.via === "local" &&
        p.ws.readyState === WebSocket.OPEN &&
        (p.sessionIds?.has(sessionId) ?? false)
    );
  }

  private checkConsoleHeartbeat(peer: Peer): void {
    if (!peer.helloDone || peer.role !== "console") return;
    if (peer.ws.readyState !== WebSocket.OPEN) return;
    const last = peer.lastHeartbeatAtMs ?? 0;
    if (performance.now() - last > CONSOLE_HEARTBEAT_TIMEOUT_MS) {
      this.safeWarn("voice ws: console heartbeat timeout; terminating", {
        sessions: [...(peer.sessionIds ?? [])]
      });
      if (peer.heartbeatTimer) {
        clearInterval(peer.heartbeatTimer);
        peer.heartbeatTimer = undefined;
      }
      peer.ws.terminate();
    }
  }

  private broadcastBinary(role: PeerRole, buf: Buffer): void {
    for (const p of this.peers) {
      if (
        p.helloDone &&
        p.role === role &&
        p.ws.readyState === WebSocket.OPEN &&
        p.via !== "mobile_lan" &&
        (role !== "pipeline" ||
          (this.currentPipelinePeer === p && p.pipelineAuthorized !== false && !p.pipelineUnavailable))
      ) {
        try {
          p.ws.send(buf, { binary: true });
        } catch (err) {
          this.safeWarn("voice ws: binary broadcast send failed", {
            role,
            error: err instanceof Error ? err.name : "unknown"
          });
        }
      }
    }
  }

  private downstreamAllowed(peer: Peer, msg: PipelineMsg | Record<string, unknown>): boolean {
    if (peer.via !== "mobile_lan") return true;
    const type = typeof msg["t"] === "string" ? msg["t"] : "";
    return VoiceHub.MOBILE_LAN_DOWNSTREAM_ALLOWED.has(type);
  }

  /**
   * Brain/daemon 侧口播下发(1.3b/4.x 消费;C8 记账钩子在此接线)。
   * 安全红线(10 §1):一切进 TTS 的文本必经脱敏序列化层——token/secret/客户数据/完整路径永不进语音。
   * 客户数据等正则识别不了的,调用方经 redactSpans 显式标注。
   */
  /** F25/批 4:daemon 内部 UI 事件下发(确认卡生命周期 + focus.entity;只发 console,schema 校验后广播) */
  sendConsoleEvent(
    msg: Extract<
      PipelineMsg,
      { t: "confirm.card" | "confirm.countdown" | "confirm.resolved" | "focus.entity" }
    >
  ): void {
    try {
      pipelineMsgSchema.parse(msg);
      if (msg.t.startsWith("confirm.")) {
        this.sendToConsolePeers((meta) => meta.sessionIds.has(msg.sessionId), msg);
      } else {
        this.broadcast("console", msg);
      }
    } catch (err) {
      this.safeWarn("console event dropped (schema)", { t: msg.t, error: String(err).slice(0, 120) });
    }
  }

  sendTtsSay(
    msg: Extract<PipelineMsg, { t: "tts.say" }>,
    redactSpans: RedactSpan[] = [],
    origin: NativeReplyOrigin = "system",
    turnId?: string
  ): boolean {
    const safeText = redactText(msg.text, redactSpans);
    const safe = { ...msg, text: safeText };
    pipelineMsgSchema.parse(safe);
    this.sendNativeReply({
      sessionId: safe.sessionId,
      turnId: turnId ?? turnIdFromSentenceId(safe.sentenceId),
      sentenceId: safe.sentenceId,
      text: safeText,
      origin
    });
    const pipelineDelivery = this.broadcast("pipeline", safe);
    if (pipelineDelivery.succeeded === 0) {
      this.safeWarn("tts.say dropped: no pipeline peer accepted enqueue", {
        sessionId: safe.sessionId,
        sentenceId: safe.sentenceId,
        attempted: pipelineDelivery.attempted,
        failed: pipelineDelivery.failed
      });
      return false;
    }
    this.broadcast("console", safe);
    try {
      this.events.onTtsChars?.(safe.sessionId, safeText.length);
    } catch (err) {
      this.safeWarn("tts.say cost hook failed after enqueue", {
        sessionId: safe.sessionId,
        sentenceId: safe.sentenceId,
        error: err instanceof Error ? err.name : "unknown"
      });
    }
    return true;
  }

  sendNativeReply(
    input: Omit<Extract<PipelineMsg, { t: "native.reply" }>, "t">
  ): VoiceDelivery {
    const msg: Extract<PipelineMsg, { t: "native.reply" }> = pipelineMsgSchema.parse({
      t: "native.reply",
      ...input,
      text: redactText(input.text)
    }) as Extract<PipelineMsg, { t: "native.reply" }>;
    return this.sendToConsolePeers(
      (meta) => meta.via === "mobile_lan" && meta.sessionIds.has(msg.sessionId),
      msg
    );
  }

  /** 无 pipeline 的文本模式兜底:只向 console 呈现同一脱敏句,不冒充 TTS 成功或产生语音字符账。 */
  sendConsoleSay(msg: Extract<PipelineMsg, { t: "tts.say" }>, redactSpans: RedactSpan[] = []): boolean {
    const safe = { ...msg, text: redactText(msg.text, redactSpans) };
    pipelineMsgSchema.parse(safe);
    return this.sendToConsolePeers((meta) => meta.sessionIds.has(safe.sessionId), safe).succeeded > 0;
  }

  sendSessionProject(event: Omit<Extract<PipelineMsg, { t: "session.project" }>, "t">): VoiceDelivery {
    const msg: Extract<PipelineMsg, { t: "session.project" }> = {
      t: "session.project",
      sessionId: event.sessionId,
      projectId: event.projectId,
      projectRevision: event.projectRevision,
      reason: event.reason
    };
    pipelineMsgSchema.parse(msg);
    return this.broadcast("console", msg);
  }

  /** 测试音频注入通道(计划 1.2):asr.final / barge_in / tts.playout 等事件走与真实对端相同的分发路径 */
  injectPipelineMsg(msg: PipelineMsg): void {
    pipelineMsgSchema.parse(msg);
    if (msg.t === "pipeline.health") {
      throw new Error("pipeline.health 只接受已握手的真实 pipeline peer");
    }
    this.dispatch(msg, "inject");
  }

  /** 热词偏置词表下发(接线批;daemon 唯一发起方——peer 直发 asr.hotwords 被 ROLE_ALLOWED 丢弃) */
  sendHotwords(words: string[]): void {
    const msg: PipelineMsg = pipelineMsgSchema.parse({ t: "asr.hotwords", words });
    this.broadcast("pipeline", msg);
  }

  /** 当前播出水位(unheard 判定的基础;1.3a/4.2 消费) */
  watermarkOf(sessionId: string): { sentenceId: string; watermarkMs: number } | undefined {
    return this.watermarks.get(sessionId);
  }

  peerCount(role: PeerRole): number {
    return [...this.peers].filter((p) => p.helloDone && p.role === role).length;
  }

  /** W2 迟到评审 A1 回收:是否存在远程来源的 console peer(在连即 true)。
   *  P0 保守口径:语音工具环的 S3 集合动作在任何远程 console 在连时一律拒——
   *  单用户单活跃会话假设下无法逐帧绑定说话者终端,fail-safe 方向宁误拒
   *  (话术引导去屏幕,桌面 TaskDetail 按钮照常);精确来源绑定(per-session via)留 P1。 */
  hasTailnetConsole(): boolean {
    return [...this.peers].some(
      (p) => p.helloDone && p.role === "console" && (p.via === "tailnet" || p.via === "mobile_lan")
    );
  }

  /**
   * first-run onboarding v4:向 pipeline peer 发 restart_pending{generation},有界等 ACK。
   * 无 pipeline peer 时立即返回 acked:false(照走,不阻塞 self-restart)。
   */
  requestPipelineRestart(generation: number, timeoutMs = 3000): Promise<{ acked: boolean }> {
    const peer = this.currentPipelinePeer;
    if (
      !peer?.helloDone ||
      peer.pipelineAuthorized === false ||
      peer.pipelineUnavailable ||
      peer.ws.readyState !== WebSocket.OPEN
    ) {
      return Promise.resolve({ acked: false });
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (acked: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const list = this.restartAckWaiters.get(generation);
        if (list) {
          const next = list.filter((w) => w !== finish);
          if (next.length === 0) this.restartAckWaiters.delete(generation);
          else this.restartAckWaiters.set(generation, next);
        }
        resolve({ acked });
      };
      const existing = this.restartAckWaiters.get(generation) ?? [];
      existing.push(finish);
      this.restartAckWaiters.set(generation, existing);
      const timer = setTimeout(() => finish(false), timeoutMs);
      try {
        peer.ws.send(JSON.stringify({ t: "pipeline.restart_pending", generation }));
      } catch {
        finish(false);
      }
    });
  }

  /** 当前 pipeline peer 上报的 generation(未连/未报则 undefined) */
  pipelineGeneration(): number | undefined {
    return this.currentPipelinePeer?.generation;
  }

  async close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closePromise = (async () => {
      if (this.currentPipelinePeer) this.markPipelineUnavailable(this.currentPipelinePeer);
      for (const waiters of this.restartAckWaiters.values()) for (const finish of waiters) finish(false);
      this.restartAckWaiters.clear();
      for (const peer of this.peers) {
        if (peer.heartbeatTimer) clearInterval(peer.heartbeatTimer);
        if (peer.pipelineHealthTimer) clearTimeout(peer.pipelineHealthTimer);
        if (typeof peer.ws.terminate === "function") peer.ws.terminate();
      }
      for (const ws of this.wss.clients) ws.terminate();
      await new Promise<void>((resolveClose, rejectClose) => {
        let settled = false;
        const finish = (err?: Error): void => {
          if (settled) return;
          settled = true;
          clearTimeout(deadline);
          if (err) rejectClose(err);
          else resolveClose();
        };
        const deadline = setTimeout(() => {
          for (const ws of this.wss.clients) ws.terminate();
          if (this.wss.clients.size === 0) finish();
          else finish(new Error("voice websocket close deadline exceeded"));
        }, 2_000);
        deadline.unref();
        this.wss.close((err) => finish(err));
      });
    })();
    return this.closePromise;
  }
}
