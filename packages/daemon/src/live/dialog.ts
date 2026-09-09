// live 对话装配(接线批 2026-07-25;HANDOFF §2-9-①/②/③):
// asr.final -> 会话登记(开口即建/重建)-> 转写落盘 -> [确认词表环拦截(审批裁决轮,不进 Brain)]
// -> Context Pack 编译注入 -> 工具调用环(function-call)-> 分句 TTS;
// unheard 过滤经 LiveVoiceSessions(barge-in 结算);dispatch 收据的 accept/reject 裁决只认
// daemon 侧封闭词表(10 §2.5),presentation 被打断即作废(09 §14-A8 最小形态)。
// index.ts 只装配本模块;e2e 直接构造(注入 fake provider/fake say)。

import type { Db } from "../storage/db.js";
import { textDigest, type NativeReplyOrigin } from "@saydo/contracts";
import type { AuditSink } from "../obs/audit.js";
import type { LlmProvider } from "../providers/types.js";
import type { Logger } from "../obs/logger.js";
import {
  runDialogCliOneshot,
  runDialogTurn,
  runDialogTurnWithTools,
  SCREEN_CLAIM_RE
} from "../brain/dialogLoop.js";
import type { VoiceDelivery } from "../voice/hub.js";
import type { ToolRegistry } from "../brain/registry.js";
import { recordLlmUsage } from "../cost/ledger.js";
import { applyReceiptEvent } from "../approvals/issue.js";
import { dispatchApprovedPackage, takeScreenCredit, type LiveToolsDeps } from "../brain/liveTools.js";
import { redactForSpeech } from "../voice/redactor.js";
import type { LiveVoiceSessions } from "./voiceSessions.js";
import type {
  ConfirmationLoop,
  ConfirmChannel,
  ConfirmOutcome,
  PendingConfirmation,
  FocusPendingPayload,
  MemoryPendingPayload
} from "./confirm.js";
import {
  ConfirmationLoop as ConfirmationLoopClass,
  focusObligationItems
} from "./confirm.js";
import { getSession } from "../storage/dao/projects.js";
import { compileLivePack, type LivePackDeps } from "./pack.js";
import type { RuntimeApprovalFlow } from "../tier1/approvalFlow.js";
import type { ReadinessCandidate } from "../evaluator/readinessBinding.js";
import {
  classifyProjectAnchorTurn,
  type ProjectAnchorCandidate,
  type SessionProjectEvent
} from "../projects/anchor.js";
import {
  BRAIN_INSTRUCTIONS,
  isProjectAnchorQuestion,
  PROJECT_ANCHOR_QUESTION,
  PROJECT_ANCHOR_REPEAT_FALLBACK,
  SESSION_END_INTENT_RE,
  type ProjectAnchorTurnState,
  withProjectAnchorTurnState
} from "../brain/instructions.js";
import { undoLastFocusAction } from "../focus/undo.js";
import { closeActivation, startActivationOnOps } from "../focus/activation.js";
import { withFocusWriteTx } from "../focus/writeTx.js";
import { settleExpectationAckOnOps } from "../focus/expectations.js";
import { consumeLaneSplitOnOps } from "../focus/lanes.js";
import {
  buildInterruptedCleanupPresentation,
  rebuildProvisionalFromInterrupted,
  listUnsettledInterruptedActivations
} from "../focus/interruptRecovery.js";
import {
  colorForOwner,
  emitFocusEntitySafe,
  ownerSub,
  resolutionSub,
  type FocusEntityEmitter
} from "../focus/entityFeed.js";

export interface LiveDialogDeps {
  db: Db;
  audit: AuditSink;
  sessions: LiveVoiceSessions;
  dialogProvider: LlmProvider | null;
  /** W5a 3.5:按会话锚定项目解析对话档;返回 null 表示当前已撤销,不得回退构造期快照。02 §5.1 生效链 */
  dialogProviderFor?: (sessionId: string, projectId: string | null) => LlmProvider | null;
  /** TTS 下发(voiceHub.sendTtsSay 包装;出口脱敏 dialogLoop/redactor 已做,hub 层再兜一遍) */
  say: (
    sessionId: string,
    sentenceId: string,
    text: string,
    nativeContext?: { turnId: string; origin: NativeReplyOrigin }
  ) => boolean;
  /**
   * ④e:screen_text 定向投递(仅 via=local console;不脱敏)。
   * 返回投递计数——话术门要求 succeeded≥1 才允许"放屏幕"宣告。
   */
  sendScreenText?: (sessionId: string, turnId: string, text: string) => VoiceDelivery;
  log: Logger;
  /** 工具环(缺省 null = 纯对话降级,Phase 1 形态) */
  registry?: ToolRegistry | null;
  /** dispatch 收据确认词表环(工具环启用时必备) */
  confirm?: ConfirmationLoop | null;
  /** 词表环 accept 后的派发依赖(dispatchApprovedPackage 用;A3-armed 加 readinessEvidence 供权威现势复核) */
  dispatchDeps?: Pick<
    LiveToolsDeps,
    "db" | "audit" | "gate0" | "devAdapter" | "now" | "enabledProjectTypes" | "readinessEvidence" | "emitFocusEntity"
    | "acceptingDispatch"
  >;
  /** 执行中 S2 审批承接(执行器批;runtime_effect 张的 accept/reject 落收据 + 放行 gate promise) */
  runtimeApprovals?: RuntimeApprovalFlow | null;
  /** Context Pack live 编译(缺省 null = 不注入) */
  packDeps?: LivePackDeps | null;
  /** M3 llm_first_token 埋点(P0 非流式以响应到达近似) */
  /** M3 llm_first_token 近似;meta 让延迟收集器按 origin 打标(工具轮 / 控制轮不与文本/语音轮混一个分布,GAP-02 2.4) */
  onLlmArrived?: (turnId: string, atMs: number, meta: { toolCallsMade: number; control: boolean }) => void;
  /** invocation 审计的 configured_provider 标签(index.ts 从配置推导) */
  configuredProvider?: string;
  /** 用户轮已写入 durable transcript 后通知 once 协调器；拒收/写入失败不得提前消费 marker。 */
  onUserMessageAccepted?: (sessionId: string) => void;
  /** 用户轮开始:隐式 ack 本 session 项目的 L0 语音回叫条目。 */
  onUserTurnBegin?: (sessionId: string) => void;
  /**
   * 会话绑定装配(09 §13 readinessSkeleton 消费点之一;w4-readback B-4 接线,A3-armed 口径 =
   * 每次 session↔project 绑定建立或变更:created/rebuilt/promote/reanchor,装配幂等)。
   * armed(readinessEvidence 注入)时由 index.ts 组装传入;未 armed 缺省 undefined = 零行为。
   * 实现 = evaluator/readinessGate.assembleOnSessionStart(与 assessReadiness/proposeStart 同一 contracts 单源)。
   */
  readinessAssemble?: (sessionId: string, projectId: string) => void;
  /**
   * 就绪复述确认环 accept 后的升格事务(A3-armed;09 §13 covered 块)。
   * index.ts 组装 = evaluator/readinessBinding.confirmBindings 闭包(snapshotter/foundationGeneration 注入)。
   */
  readinessConfirm?: (input: {
    sessionId: string;
    turnId: string;
    projectId: string;
    receiptId: string;
    candidates: ReadinessCandidate[];
  }) => { bindingIds: string[] };
  /**
   * SD-2:普通 M0 记忆确认环 accept 后的写账本消费(09 §4 / §13 kind=memory)。
   * index.ts 组装 = memory/m0Confirm.confirmMemoryProposal 闭包;缺省 undefined ⇒ 确认不落账、如实说。
   */
  memoryConfirm?: (input: {
    sessionId: string;
    turnId: string;
    receiptId: string;
    payload: MemoryPendingPayload;
  }) => { memId: string; duplicate: boolean };
  /** 项目归属确认 accept 的原子消费；内部完成 post-commit readiness/Pack/event 投递。 */
  projectAnchorAccept?: (
    sessionId: string,
    candidate: ProjectAnchorCandidate
  ) => { event: SessionProjectEvent; ready: boolean; postCommitDegraded?: boolean };
  /** projectRevision>0 时重试并核验 durable readiness/Pack 双闸；false 则本轮 Brain/tool 暂停。 */
  ensureProjectAnchorReady?: (sessionId: string) => boolean;
  /**
   * 动态 instructions 组装(A3-armed §1.8/B3:类型清单采访段每轮现算——promote 后自然刷新;
   * index.ts 组装 = buildInstructions(evidenceFor + listCandidates 三态);未 armed 缺省 = 静态)。
   */
  readinessInstructions?: (sessionId: string, projectId: string | null) => string | null;
  /**
   * F27+接线补(2026-08-04 任务3 dogfood):Focus instructions delta+[当前 Focus]背景段——
   * stage 门在 index 侧(stage 0 返回空);focusBrainInstructionDelta 此前从未接线。
   */
  focusInstructionExtras?: (sessionId: string) => string;
  /**
   * C3 Focus 确认消费后的可选钩子(审计/播报增强);缺省走内置 FocusWriteTx 路径。
   */
  onFocusConfirm?: (sessionId: string, payload: FocusPendingPayload, accepted: boolean) => void;
  /**
   * 批 4:账本写入成功后推 console「这次聊出来的东西」卡(确认消费成功各 case)。
   * 勿在 confirm.resolved 处发射——确认卡本身不长实体卡。
   */
  emitFocusEntity?: FocusEntityEmitter;
  /** C2 中断尾部重建:加载历史 session 转写 */
  loadFocusTranscript?: (sessionId: string) => {
    lines: import("../focus/closeSettlement.js").TranscriptLine[];
    storeTranscript: boolean;
  };
  now?: () => Date;
}

/** ④c 控制轮 payload(dialog 层注入,非 user 轮) */
export type ControlTurnKind = "confirmation_settled" | "downgrade_applied" | "expectation_adjusted";

export interface ControlTurnPayload {
  kind: ControlTurnKind;
  receiptRef?: string;
  outcome?: string;
  remainingIntent?: string;
  focusId?: string;
}

/** 同 session 控制轮连锁深度上限(超限不注入+audit+attention) */
export const CONTROL_TURN_MAX_DEPTH = 3;

interface ControlSessionState {
  queue: ControlTurnPayload[];
  /** 无用户介入的连续控制轮深度 */
  depth: number;
  inFlight: boolean;
  /** barge-in 取消当前控制轮后重排 */
  cancelled: boolean;
  userTurnInFlight: boolean;
  /** barge-in 后到对应 ASR final 结算前，控制轮不得抢在用户输入前启动。 */
  speechPending: boolean;
  userTurnGeneration: number;
  activeUserTurnController?: AbortController;
}

export class LiveDialog {
  private readonly deps: LiveDialogDeps;
  private readonly now: () => Date;
  /** ④c 控制轮 per-session 态 */
  private readonly controlBySession = new Map<string, ControlSessionState>();
  /** 当前 session 的模型轮；新用户轮、barge-in、session suspend 会 abort 旧轮。 */
  private readonly modelTurnBySession = new Map<string, AbortController>();
  private readonly inFlightTurns = new Set<Promise<void>>();
  private acceptingTurns = true;

  constructor(deps: LiveDialogDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  /** 真正在途的用户轮(sweep voiceBusy);onUserTurn 留下的 currentUserTurn 不算。 */
  hasUserTurnInFlight(sessionId: string): boolean {
    return this.controlBySession.get(sessionId)?.userTurnInFlight === true;
  }

  private safeWarn(message: string, fields: Record<string, unknown>): void {
    try {
      this.deps.log.warn(message, fields);
    } catch {
      // 已落账事实和控制流不得被诊断出口反转。
    }
  }

  private controlState(sessionId: string): ControlSessionState {
    let st = this.controlBySession.get(sessionId);
    if (!st) {
      st = {
        queue: [],
        depth: 0,
        inFlight: false,
        cancelled: false,
        userTurnInFlight: false,
        speechPending: false,
        userTurnGeneration: 0
      };
      this.controlBySession.set(sessionId, st);
    }
    return st;
  }

  private beginModelTurn(sessionId: string): AbortController {
    this.abortSession(sessionId);
    const controller = new AbortController();
    this.modelTurnBySession.set(sessionId, controller);
    return controller;
  }

  private finishModelTurn(sessionId: string, controller: AbortController): void {
    if (this.modelTurnBySession.get(sessionId) === controller) this.modelTurnBySession.delete(sessionId);
  }

  abortSession(sessionId: string): void {
    this.modelTurnBySession.get(sessionId)?.abort();
    this.modelTurnBySession.delete(sessionId);
  }

  /** session 挂起/关闭时退休当前世代；旧轮 finally 不得再泵起控制轮复活会话。 */
  retireSession(sessionId: string): void {
    const st = this.controlState(sessionId);
    st.userTurnGeneration += 1;
    st.activeUserTurnController?.abort();
    delete st.activeUserTurnController;
    st.userTurnInFlight = false;
    st.speechPending = false;
    if (st.inFlight) st.cancelled = true;
    this.abortSession(sessionId);
  }

  /**
   * Focus v0.4 ④c 控制轮注入(R3):
   * ①不写 session 转写;②不刷新 idle;③计费 origin=control;④system 角色进 dialogLoop。
   * 排队至用户轮结算后;barge-in 让位重排;深度上限 CONTROL_TURN_MAX_DEPTH。
   */
  injectControlTurn(sessionId: string, payload: ControlTurnPayload): { accepted: boolean; reason?: string } {
    if (!this.acceptingTurns) return { accepted: false, reason: "daemon_draining" };
    const st = this.controlState(sessionId);
    // depth=已启动的连锁数(含 inFlight);queue=尚未启动;合计达上限则拒
    if (st.depth + st.queue.length >= CONTROL_TURN_MAX_DEPTH) {
      this.auditControlDepthExceeded(sessionId, payload);
      return { accepted: false, reason: "depth_exceeded" };
    }
    st.queue.push(payload);
    void this.pumpControlQueue(sessionId);
    return { accepted: true };
  }

  /** ④c:降格 saga 成功后调用;session 非 talking 则跳过(下次激活自然可见) */
  notifyDowngradeApplied(sessionId: string, receiptRef: string, focusId?: string | null): void {
    try {
      const sess = getSession(this.deps.db, sessionId);
      if (!sess || sess.state !== "talking") return;
    } catch {
      return;
    }
    this.injectControlTurn(sessionId, {
      kind: "downgrade_applied",
      receiptRef,
      ...(focusId ? { focusId } : {})
    });
  }

  private auditControlDepthExceeded(sessionId: string, payload: ControlTurnPayload): void {
    try {
      this.deps.audit.record({
        actor: "daemon",
        action: "dialog.control_turn_depth_exceeded",
        meta: {
          sessionId,
          kind: payload.kind,
          receiptRef: payload.receiptRef ?? null,
          depth: CONTROL_TURN_MAX_DEPTH
        }
      });
    } catch {
      // ignore
    }
    // 有 focus 时挂一条 attention 可见工程义务(与降格 abandoned 同型)
    const focusId = payload.focusId;
    if (!focusId) return;
    try {
      withFocusWriteTx(this.deps.db, {}, (ops) => {
        ops.upsertObligation(focusId, {
          kind: "action",
          title: "控制轮连锁过深,有后续流程未自动续办",
          detail: JSON.stringify({
            receiptRef: payload.receiptRef ?? null,
            kind: payload.kind
          }),
          owner: "human",
          status: "open",
          verification: "provisional",
          needs: "action",
          dedupeKey: `control-depth:${sessionId}:${payload.kind}:${payload.receiptRef ?? "x"}`,
          actorKind: "daemon",
          sessionId
        });
      });
    } catch {
      // 挂条失败不阻塞主链
    }
  }

  private formatControlMessage(payload: ControlTurnPayload): string {
    const parts = [
      "[控制轮 control turn]",
      `kind=${payload.kind}`,
      payload.receiptRef ? `receiptRef=${payload.receiptRef}` : null,
      payload.outcome ? `outcome=${payload.outcome}` : null,
      payload.focusId ? `focusId=${payload.focusId}` : null,
      payload.remainingIntent ? `remainingIntent=${payload.remainingIntent}` : null,
      "这是系统续办信号:确认已落账/降格已应用,请按既定多步流程继续,禁止等待用户再开口;禁止对同 dedupeKey 重复发起确认。"
    ].filter(Boolean);
    return parts.join("\n");
  }

  private async pumpControlQueue(sessionId: string): Promise<void> {
    if (!this.acceptingTurns) return;
    const st = this.controlState(sessionId);
    if (st.speechPending || st.userTurnInFlight || st.inFlight) return;
    const session = getSession(this.deps.db, sessionId);
    if (!session || session.state !== "talking") return;
    const next = st.queue.shift();
    if (!next) return;
    if (st.depth >= CONTROL_TURN_MAX_DEPTH) {
      this.auditControlDepthExceeded(sessionId, next);
      // 继续抽干超限队列并审计
      while (st.queue.length > 0) {
        const dropped = st.queue.shift()!;
        this.auditControlDepthExceeded(sessionId, dropped);
      }
      return;
    }
    st.inFlight = true;
    st.cancelled = false;
    st.depth += 1;
    const turnId = `ctl-${next.kind}-${(next.receiptRef ?? "x").slice(-8)}-${Date.now().toString(36)}`;
    const controller = this.beginModelTurn(sessionId);
    try {
      // 注入成功:remainingIntent 同事务语义(单连接写)置 handled
      if (next.receiptRef && this.deps.confirm) {
        try {
          (this.deps.confirm as ConfirmationLoopClass).markRemainingIntentHandled(next.receiptRef);
        } catch {
          // ignore
        }
      }
      const turn = this.runControlTurn(sessionId, turnId, next, controller.signal);
      this.inFlightTurns.add(turn);
      try {
        await turn;
      } finally {
        this.inFlightTurns.delete(turn);
      }
    } catch (err) {
      this.safeWarn("control turn failed", {
        sessionId,
        kind: next.kind,
        error: String(err).slice(0, 160)
      });
    } finally {
      this.finishModelTurn(sessionId, controller);
      st.inFlight = false;
      if (st.cancelled && this.acceptingTurns) {
        // barge-in 让位:控制轮重排到队首
        st.queue.unshift(next);
        st.cancelled = false;
        // 本轮未真正完成,深度回退一档
        st.depth = Math.max(0, st.depth - 1);
      }
      // 无用户轮时继续泵
      if (this.acceptingTurns && !st.userTurnInFlight) void this.pumpControlQueue(sessionId);
    }
  }

  private async runControlTurn(
    sessionId: string,
    turnId: string,
    payload: ControlTurnPayload,
    signal: AbortSignal
  ): Promise<void> {
    const d = this.deps;
    const st = this.controlState(sessionId);
    const session = getSession(d.db, sessionId);
    if (!session || session.state !== "talking") return;
    const provider = d.dialogProviderFor
      ? d.dialogProviderFor(sessionId, session.projectId ?? null)
      : d.dialogProvider;
    if (!provider) return;

    let packText: string | undefined;
    if (d.packDeps) {
      try {
        const pack = compileLivePack(d.packDeps, {
          sessionId,
          projectId: session.projectId,
          userText: "",
          rebuild: false
        });
        packText = pack?.packText;
      } catch {
        // 控制轮 pack 失败降级无 pack
      }
    }

    let instructions: string | undefined;
    if (d.readinessInstructions) {
      try {
        instructions = d.readinessInstructions(sessionId, session.projectId ?? null) ?? undefined;
      } catch {
        // ignore
      }
    }
    instructions = instructions ?? BRAIN_INSTRUCTIONS;
    try {
      const focusExtras = d.focusInstructionExtras?.(sessionId) ?? "";
      if (focusExtras) instructions = `${instructions}\n\n${focusExtras}`;
    } catch {
      // ignore
    }

    const history = d.sessions.historyOf(sessionId);
    const controlMessage = this.formatControlMessage(payload);
    const input = {
      sessionId,
      turnId,
      userText: "",
      history,
      controlMessage,
      origin: "control" as const,
      signal,
      ...(packText !== undefined ? { packText } : {}),
      instructions
    };

    const out = d.registry
      ? await (provider.kind === "api" ? runDialogTurnWithTools : runDialogCliOneshot)(provider, input, {
          registry: d.registry,
          ctx: {
            sessionId,
            turnId,
            signal,
            assertCurrent: () => {
              if (st.cancelled || st.userTurnInFlight) throw new Error("stale control turn");
            }
          },
          isCurrent: () => !st.cancelled && !st.userTurnInFlight,
          onStep: (step) => this.recordStep(sessionId, turnId, step, "control"),
          onToolCall: (t) =>
            d.log.info("brain tool call", {
              mod: "brain",
              sessionId,
              turnId,
              tool: t.name,
              ok: t.ok,
              origin: "control",
              ...(t.code ? { code: t.code } : {})
            })
        })
      : await runDialogTurn(provider, input);

    if (st.cancelled || st.userTurnInFlight) return;

    d.onLlmArrived?.(turnId, out.llmArrivedAtMs, {
      toolCallsMade: "toolCallsMade" in out ? (out as { toolCallsMade: number }).toolCallsMade : 0,
      control: true
    });
    if (!d.registry && out.usage && out.observedModel) {
      this.recordStep(
        sessionId,
        turnId,
        {
          usage: out.usage,
          observedModel: out.observedModel,
          routedProvider: out.routedProvider,
          toolCalls: 0
        },
        "control"
      );
    }
    d.audit.record({
      actor: "daemon",
      action: "dialog.control_turn",
      meta: {
        sessionId,
        turnId,
        kind: payload.kind,
        receiptRef: payload.receiptRef ?? null,
        origin: "control",
        toolCalls: "toolCallsMade" in out ? (out as { toolCallsMade: number }).toolCallsMade : 0
      }
    });

    for (const s of out.sentences) {
      if (st.cancelled || st.userTurnInFlight) break;
      if (s.text.replace(/[\s。,,.;;:!?!?、·—-]+/g, "").length === 0) continue;
      // 控制轮:TTS 可下发,但不写 JSONL、不刷新 idle
      this.sayControl(sessionId, turnId, s.sentenceId, s.text);
    }
  }

  /** 控制轮口播:不写转写、不 touchIdle */
  private sayControl(sessionId: string, turnId: string, sentenceId: string, text: string): boolean {
    const enqueued = this.deps.say(sessionId, sentenceId, text, { turnId, origin: "system" });
    this.deps.sessions.onAiSentences(sessionId, [{ sentenceId, text }], {
      touchIdle: false,
      trackTranscript: false
    });
    return enqueued;
  }

  /** barge-in:unheard 标记 + presentation 作废(随后裸肯定不消费,必须重播——A8) */
  onBargeIn(sessionId: string, truncatedSentenceId: string): void {
    this.abortSession(sessionId);
    this.deps.sessions.onBargeIn(sessionId, truncatedSentenceId);
    this.deps.confirm?.invalidateOnBargeIn(sessionId, this.now().toISOString());
    const st = this.controlState(sessionId);
    // 退休旧用户轮所有权，并在 ASR final 结算前保留语音门；旧 finally 不得抢先泵 control。
    st.userTurnGeneration += 1;
    delete st.activeUserTurnController;
    st.userTurnInFlight = false;
    st.speechPending = true;
    // 控制轮让位:标取消,泵循环会重排
    if (st.inFlight) st.cancelled = true;
  }

  /** 空 final 或确认采集截获 final：用户语音已结算，但不产生 Brain 用户轮。 */
  settlePendingSpeech(sessionId: string): void {
    const st = this.controlState(sessionId);
    if (!st.speechPending) return;
    st.speechPending = false;
    if (!st.userTurnInFlight && !st.inFlight) void this.pumpControlQueue(sessionId);
  }

  /** asr.final 主链(hub onAsrFinal 接线) */
  async onAsrFinal(sessionId: string, turnId: string, text: string): Promise<void> {
    if (!this.acceptingTurns) throw new Error("daemon_draining");
    const ctl = this.controlState(sessionId);
    ctl.speechPending = false;
    // 用户开口优先:打断控制轮并重置连锁深度
    if (ctl.inFlight) ctl.cancelled = true;
    ctl.depth = 0;
    const generation = ++ctl.userTurnGeneration;
    const controller = this.beginModelTurn(sessionId);
    ctl.userTurnInFlight = true;
    ctl.activeUserTurnController = controller;
    try {
      const turn = this.runUserTurn(sessionId, turnId, text, controller.signal);
      this.inFlightTurns.add(turn);
      try {
        await turn;
      } finally {
        this.inFlightTurns.delete(turn);
      }
    } finally {
      this.finishModelTurn(sessionId, controller);
      if (ctl.userTurnGeneration === generation && ctl.activeUserTurnController === controller) {
        ctl.userTurnInFlight = false;
        delete ctl.activeUserTurnController;
        if (this.acceptingTurns) void this.pumpControlQueue(sessionId);
      }
    }
  }

  /** D1 prepareShutdown:停止新用户/控制轮,abort 在途 provider,等模型轮退出。 */
  async prepareShutdown(): Promise<void> {
    this.acceptingTurns = false;
    for (const { timer } of this.autoTimers.values()) clearTimeout(timer);
    this.autoTimers.clear();
    for (const controller of this.modelTurnBySession.values()) controller.abort();
    for (const state of this.controlBySession.values()) {
      state.queue.length = 0;
      state.cancelled = true;
      state.activeUserTurnController?.abort();
    }
    await Promise.allSettled([...this.inFlightTurns]);
  }

  /** 用户轮主体(由 onAsrFinal 包 try/finally 管理控制轮泵) */
  private async runUserTurn(sessionId: string, turnId: string, text: string, signal: AbortSignal): Promise<void> {
    const d = this.deps;
    try {
      d.onUserTurnBegin?.(sessionId);
    } catch (err) {
      d.log.warn(`implicit L0 ack failed: ${String(err).slice(0, 120)}`);
    }
    const isCurrentTurn = (): boolean => !signal.aborted && d.sessions.findUserTurn(sessionId, turnId) !== null;
    const assertCurrentTurn = (): void => {
      if (!isCurrentTurn()) throw new Error("stale tool turn");
    };
    const acceptUserTurn = (options?: { excludeFromHistory?: boolean }): void => {
      d.sessions.onUserTurn(sessionId, turnId, text, options);
      d.onUserMessageAccepted?.(sessionId);
    };
    const ensured = d.sessions.ensureSession(sessionId);
    // 会话绑定装配(B-4 + A3-armed 补齐:消费点 = 每次 session↔project 绑定建立或变更——
    // created / daemon 重启后 rebuilt 同触发,09 §13;promote 触发在工具侧;装配幂等,失败不断对话链)
    if ((ensured.created || ensured.rebuilt) && ensured.session.projectId && d.readinessAssemble) {
      try {
        d.readinessAssemble(sessionId, ensured.session.projectId);
      } catch (err) {
        d.log.warn(`readiness assemble failed (non-fatal): ${String(err).slice(0, 120)}`);
      }
    }
    // 确认词表环拦截(10 §2.5):有 pending dispatch 确认时,本轮是审批裁决轮——
    // 不进 Brain 对话环,答复也不入对话史(照落转写;Codex 16 5.4 防审批答复污染下一轮上下文)
    // 双速直通:用户开口即取消 AI 提议的自动倒计时(用户在交互,不抢跑)
    const hadCountdown = this.cancelAutoAccept(sessionId);
    // "等一下"= 保持 pending、只停表(用户要想想)
    if (hadCountdown && d.confirm && d.confirm.pending(sessionId) && /等一下|等等|先别|让我想/.test(text)) {
      acceptUserTurn({ excludeFromHistory: true });
      this.sayAndTrack(sessionId, `s-${turnId}-hold`, "好,不着急,你说了算。");
      return;
    }
    // "撤销"(无 pending 时的正常轮):撤回最近一次 Focus 直通操作
    if (!(d.confirm && d.confirm.pending(sessionId)) && /^(撤销|撤回)/.test(text.trim())) {
      const r = undoLastFocusAction(d.db, sessionId);
      acceptUserTurn({ excludeFromHistory: true });
      this.sayAndTrack(sessionId, `s-${turnId}-undo`, r.spoken);
      return;
    }
    // E2 真人验证(2026-08-04 晚,义骁抓出):收场/挂起等会话级意图优先于 pending 确认——
    // 用户说"今天先到这里"时不得被词表环扣住(此前 reread→to_screen 连吞三轮);
    // pending 确认被撤下并留痕,该事项由收场清单兜底(宁挂账勿扣人)。
    let isConfirmTurn = !!(d.confirm && d.confirm.pending(sessionId));
    if (isConfirmTurn && SESSION_END_INTENT_RE.test(text)) {
      const dismissed = (d.confirm as ConfirmationLoop).dismiss(sessionId);
      if (dismissed) {
        d.audit.record({
          actor: "daemon",
          action: "confirm.dismissed_by_session_intent",
          meta: { sessionId, turnId, receiptId: dismissed.receiptId }
        });
        this.sayAndTrack(sessionId, `s-${turnId}-confirm-aside`, "好,那个确认先放一边。");
      }
      isConfirmTurn = false;
    }
    acceptUserTurn({ excludeFromHistory: isConfirmTurn });
    if (isConfirmTurn) {
      this.handleConfirmReply(sessionId, turnId, text);
      return;
    }
    // L7 收尾词法直通(义骁 8/6 真测抓出:收尾此前依赖模型调 suspendSession,上游一抖收尾即丢)——
    // 用户轮命中结束意图词表 ⇒ daemon 直接走收尾流程(与建 Focus 直通同型);确认轮撤卡后也流经此处,
    // 补全"说先到这里=撤卡+收尾"的完整语义。suspendSession 工具保留(承接 AI 问"先到这里吗?"的短肯定轮)。
    if (SESSION_END_INTENT_RE.test(text)) {
      d.audit.record({ actor: "daemon", action: "session.end_intent_fastlane", meta: { sessionId, turnId } });
      d.sessions.suspend(sessionId, "explicit");
      return;
    }
    if (
      ensured.session.projectRevision > 0 &&
      d.ensureProjectAnchorReady &&
      !d.ensureProjectAnchorReady(sessionId)
    ) {
      d.audit.record({
        actor: "daemon",
        action: "project.anchor.rebuild_pending",
        meta: {
          sessionId,
          projectId: ensured.session.projectId,
          projectRevision: ensured.session.projectRevision
        }
      });
      this.sayAndTrack(sessionId, `s-${turnId}-anchor`, "项目已经挂好了,但上下文还在重建。这轮我先停在这里,你稍后再说一次。");
      return;
    }

    const projectRows = d.db
      .prepare(
        `SELECT id, title FROM projects
          WHERE id != ? AND status NOT IN ('archived', 'draft') AND trim(title) != ''`
      )
      .all(ensured.session.projectId) as { id: string; title: string }[];
    const anchorTurn = classifyProjectAnchorTurn(text, projectRows);
    const projectState = d.db
      .prepare("SELECT status FROM projects WHERE id=?")
      .get(ensured.session.projectId) as { status: string } | undefined;
    const anchorState: ProjectAnchorTurnState =
      ensured.session.projectRevision > 0 || projectState?.status !== "draft"
        ? "anchored"
        : d.sessions.hasAskedProjectAnchorQuestion(sessionId)
          ? "asked_unresolved"
          : "unasked_draft";

    // 显式路径轮由 daemon 先机械路由，避免 Brain 误调 resolveProject 或重复索要同一路径。
    // exact 已登记路径无需 Brain 补 type，可直接进入封闭确认；新路径缺 type 时再交给 Brain 识别。
    if (d.registry && anchorState !== "anchored" && anchorTurn.kind === "explicit_path") {
      const routed = await d.registry.dispatch("proposeProjectAnchor", "{}", {
        sessionId,
        turnId,
        assertCurrent: assertCurrentTurn
      });
      if (!isCurrentTurn()) return;
      if (
        typeof routed === "object" &&
        routed !== null &&
        (routed as { ok?: unknown }).ok === true &&
        (routed as { control?: unknown }).control === "await_user"
      ) {
        d.audit.record({
          actor: "daemon",
          action: "project.anchor.explicit_path_routed",
          meta: { sessionId, turnId }
        });
        return;
      }
    }

    if (d.registry && anchorState !== "anchored" && anchorTurn.kind === "name_only") {
      const routed = await d.registry.dispatch("resolveProject", "{}", {
        sessionId,
        turnId,
        assertCurrent: assertCurrentTurn
      });
      if (!isCurrentTurn()) return;
      if (
        typeof routed === "object" &&
        routed !== null &&
        (routed as { ok?: unknown }).ok === true &&
        (routed as { control?: unknown }).control === "await_user"
      ) {
        return;
      }
    }

    // F01(E2 真人验证纠偏 2026-08-04 晚):锚定/Focus 意图的首轮不签发项目归属问句,
    // 放行进 Brain 走 proposeFocusAnchor(此前补丁误打在 Brain 输出拦截层,对 daemon 直签路径无效——义骁首幕实测抓出)
    const hasFocusIntent = /锚定|锚到|[Ff]ocus|关注点/.test(text);
    // W4(2026-08-05 晨间走查):主轴倒置步骤 A 第一片——会话已接上 Focus 时对话有主轴,
    // 不再签发项目归属问句劫持记事轮(项目=资源,需要 workspace 的动作各自 fail-closed 引导)
    const hasFocusAnchor = !!(
      d.db.prepare("SELECT primary_focus_id FROM sessions WHERE id = ?").get(sessionId) as
        | { primary_focus_id: string | null }
        | undefined
    )?.primary_focus_id;
    // N0(8/6 轨 A 四连实锤):没有任何其他可接续项目时,"新事情还是接着哪个项目"是废问——
    // 空候选直接按新事情走,首句需求陈述放行进 Brain(真实用户的第一句话不该被分类学问句截胡)
    const hasOtherProjects = projectRows.length > 0;
    if (
      hasOtherProjects &&
      !hasFocusIntent &&
      !hasFocusAnchor &&
      anchorState === "unasked_draft" &&
      anchorTurn.kind === "other" &&
      d.sessions.reserveProjectAnchorQuestion(sessionId)
    ) {
      let enqueued = false;
      try {
        enqueued = this.sayAndTrack(sessionId, `s-${turnId}-anchor-question`, PROJECT_ANCHOR_QUESTION);
      } catch (err) {
        this.safeWarn("project anchor question enqueue failed", {
          code: err instanceof Error ? err.name : "unknown"
        });
      }
      d.sessions.settleProjectAnchorQuestion(sessionId, enqueued);
      return;
    }

    // W5a 3.5:解析器未注入时才用构造期 provider;显式 null 是 self-test 红灯热撤销。
    const provider = d.dialogProviderFor
      ? d.dialogProviderFor(sessionId, ensured.session.projectId ?? null)
      : d.dialogProvider;
    if (!provider) {
      this.sayAndTrack(sessionId, `s-${turnId}-nocfg`, "对话模型还没配置,你在屏幕上的全局设置里选一个。");
      return;
    }

    // Context Pack live 传入(09 §5;编译异常降级为无注入,如实记日志不断链)
    let packText: string | undefined;
    if (d.packDeps) {
      try {
        const pack = compileLivePack(d.packDeps, {
          sessionId,
          projectId: ensured.session.projectId,
          userText: text,
          rebuild: ensured.rebuilt
        });
        packText = pack?.packText;
      } catch (err) {
        d.log.warn("live pack compile failed (dialog degrades to no-pack)", { error: String(err).slice(0, 160) });
      }
    }
    if (ensured.session.projectRevision > 0 && packText === undefined) {
      d.audit.record({
        actor: "daemon",
        action: "project.anchor.pack_not_ready",
        meta: { sessionId, projectId: ensured.session.projectId, projectRevision: ensured.session.projectRevision }
      });
      this.sayAndTrack(sessionId, `s-${turnId}-pack`, "项目已经挂好了,但上下文还没装好。这轮我先不往下聊,你稍后再说一次。");
      return;
    }

    const history = d.sessions.historyOf(sessionId).slice(0, -1); // 末位是本轮 user,runDialogTurn 单独携带
    // A3-armed §1.8:动态 instructions 每轮现算(失败降级静态,不断链)
    let instructions: string | undefined;
    if (d.readinessInstructions) {
      try {
        instructions = d.readinessInstructions(sessionId, ensured.session.projectId ?? null) ?? undefined;
      } catch (err) {
        d.log.warn("readiness instructions build failed", { code: err instanceof Error ? err.name : "unknown" });
        if (ensured.session.projectRevision > 0) {
          this.sayAndTrack(sessionId, `s-${turnId}-readiness`, "项目就绪信息暂时没装好。这轮我先停在这里,你稍后再说一次。");
          return;
        }
      }
    }
    instructions = withProjectAnchorTurnState(
      instructions ?? BRAIN_INSTRUCTIONS,
      anchorState
    );
    // F27:Focus delta+背景段追加(失败/空段零影响)
    try {
      const focusExtras = d.focusInstructionExtras?.(sessionId) ?? "";
      if (focusExtras) instructions = `${instructions}\n\n${focusExtras}`;
    } catch {
      // 背景段装配失败不断对话链
    }
    // L5:续推入口指定的默认工作线注入(记账未指明线时归它;lane 级续推的 Brain 侧接线)
    const defaultLane = d.sessions.defaultLaneOf?.(sessionId);
    if (defaultLane) {
      instructions = `${instructions}\n\n[本会话工作线]\n本会话由「在此线续推」进入,默认工作线:「${defaultLane}」。凡 proposeObligation 用户未指明归哪条线时,一律带 laneTitle="${defaultLane}";用户明说别的线则听用户的。`;
    }
    const input = {
      sessionId,
      turnId,
      userText: text,
      history,
      signal,
      ...(packText !== undefined ? { packText } : {}),
      ...(instructions !== undefined ? { instructions } : {})
    };

    const out = d.registry
      ? await (provider.kind === "api" ? runDialogTurnWithTools : runDialogCliOneshot)(provider, input, {
          registry: d.registry,
          ctx: {
            sessionId,
            turnId,
            signal,
            assertCurrent: assertCurrentTurn
          },
          isCurrent: isCurrentTurn,
          onStep: (step) => this.recordStep(sessionId, turnId, step),
          // J11:每次工具调用落持久日志行——"说了没做"分歧从此可裁决
          onToolCall: (t) =>
            d.log.info("brain tool call", {
              mod: "brain",
              sessionId,
              turnId,
              tool: t.name,
              ok: t.ok,
              ...(t.code ? { code: t.code } : {})
            })
        })
      : await runDialogTurn(provider, input);
    if (!isCurrentTurn()) {
      d.audit.record({
        actor: "daemon",
        action: "dialog.stale_turn_discarded",
        meta: { sessionId, turnId }
      });
      return;
    }
    d.onLlmArrived?.(turnId, out.llmArrivedAtMs, {
      toolCallsMade: "toolCallsMade" in out ? (out as { toolCallsMade: number }).toolCallsMade : 0,
      control: false
    });
    if (out.errorCode === "observed_model_missing") {
      d.audit.record({ actor: "daemon", action: "dialog.observed_model_missing", meta: { sessionId, turnId } });
    }
    // 纯对话路径(无 registry)单步记账;工具环路径已按步记账(onStep)
    if (!d.registry && out.usage && out.observedModel) {
      this.recordStep(sessionId, turnId, {
        usage: out.usage,
        observedModel: out.observedModel,
        routedProvider: out.routedProvider,
        toolCalls: 0
      });
    }
    if (out.error) d.log.warn("dialog turn degraded", { error: out.error });
    const anchorQuestion = isProjectAnchorQuestion(
      out.modelText ?? out.sentences.map((sentence) => sentence.text).join(" ")
    )
      ? out.sentences[0]
      : out.sentences.find((sentence) => isProjectAnchorQuestion(sentence.text));
    if (anchorQuestion) {
      const s = anchorQuestion;
      if (anchorState === "anchored") {
        d.audit.record({
          actor: "daemon",
          action: "dialog.project_anchor_question_anchored_blocked",
          meta: { sessionId, sentenceId: s.sentenceId }
        });
        this.sayAndTrack(
          sessionId,
          `${s.sentenceId}-anchor-anchored`,
          "当前对话已经挂在一个项目上了。请继续说这件事。"
        );
        return;
      }
      if (anchorTurn.kind === "explicit_path") {
        d.audit.record({
          actor: "daemon",
          action: "dialog.project_anchor_question_path_blocked",
          meta: { sessionId, sentenceId: s.sentenceId }
        });
        this.sayAndTrack(
          sessionId,
          `${s.sentenceId}-anchor-type`,
          "我已经收到本地路径,但还需要知道这是写作、开发还是其他类型。"
        );
        return;
      }
      if (anchorState === "asked_unresolved") {
        d.audit.record({
          actor: "daemon",
          action: "dialog.project_anchor_question_repeat_blocked",
          meta: { sessionId, sentenceId: s.sentenceId }
        });
        this.sayAndTrack(sessionId, `${s.sentenceId}-anchor-fallback`, PROJECT_ANCHOR_REPEAT_FALLBACK);
        return;
      }
      // F01(E2 eval):锚定/Focus 意图的轮次不签发项目归属问句——放行进 Brain(工具环走 Focus anchor)
      if (/锚定|锚到|[Ff]ocus|关注点/.test(text)) {
        d.audit.record({
          actor: "daemon",
          action: "dialog.project_anchor_question_focus_intent_bypass",
          meta: { sessionId }
        });
      } else {
      if (!d.sessions.reserveProjectAnchorQuestion(sessionId)) return;
      let enqueued = false;
      try {
        enqueued = this.sayAndTrack(sessionId, s.sentenceId, PROJECT_ANCHOR_QUESTION);
      } catch (err) {
        this.safeWarn("project anchor question enqueue failed", {
          code: err instanceof Error ? err.name : "unknown"
        });
      }
      d.sessions.settleProjectAnchorQuestion(sessionId, enqueued);
      return;
      }
    }
    // ④e:screen_text 定向投递(全文不脱敏,仅 via=local);话术门绑定投递结果
    const modelText = out.modelText ?? out.sentences.map((s) => s.text).join("");
    let screenDelivery: VoiceDelivery = { attempted: 0, succeeded: 0, failed: 0 };
    if (modelText.trim() !== "" && d.sendScreenText) {
      screenDelivery = d.sendScreenText(sessionId, turnId, modelText);
    }
    const toolCredit = takeScreenCredit(sessionId, turnId);
    screenDelivery = {
      attempted: screenDelivery.attempted + toolCredit.attempted,
      succeeded: screenDelivery.succeeded + toolCredit.succeeded,
      failed: screenDelivery.failed + toolCredit.failed
    };
    let sentences = out.sentences;
    let nativeOrigin: NativeReplyOrigin = "assistant_reply";
    if (SCREEN_CLAIM_RE.test(modelText) && screenDelivery.succeeded < 1) {
      // J10 同族:宣告"放屏幕"而本轮零投递 → 整轮换诚实句
      d.audit.record({
        actor: "daemon",
        action: "dialog.screen_claim_blocked",
        meta: {
          sessionId,
          turnId,
          attempted: screenDelivery.attempted,
          succeeded: screenDelivery.succeeded
        }
      });
      sentences = [
        {
          sentenceId: `s-${turnId}-screen-honest`,
          text: "这轮细节我没能放到你本机屏幕上——你再问一句,或到屏幕上看当前状态。"
        }
      ];
      nativeOrigin = "system";
    }
    for (const s of sentences) {
      // 10 §4-1 结果句式硬规则的运行时闸(RA-closeout dogfood 修复 2026-07-28;Codex 21 B5 最小形态,
      // golden s1-b2 的生产 gate):结果/完成句式只能由回叫链(C4)在真实 settle/task_done 播报出现——
      // 对话轮 Brain 自发念且会话项目无任何活跃/待验收任务 = 违规,逐句拦下不播(audit 留痕;合规句照播)
      if (this.violatesResultPhraseRule(ensured.session.projectId, s.text)) {
        // GAP-02 2.3:审计不可变且敏感 payload 只记 digest(E3)——模型句子原文不进审计与日志,只留 sentenceId + textDigest
        const blockedDigest = textDigest(s.text);
        d.audit.record({
          actor: "daemon",
          action: "dialog.result_phrase_blocked",
          meta: { sessionId, sentenceId: s.sentenceId, textDigest: blockedDigest }
        });
        d.log.warn(`result phrase blocked (10 §4-1 runtime gate): sentence=${s.sentenceId} digest=${blockedDigest.slice(0, 19)}`);
        continue;
      }
      // F07(E2 eval):冒号后被切出的空句(如"。")不播不入账
      if (s.text.replace(/[\s。,,.;;:!?!?、·—-]+/g, "").length === 0) continue;
      this.sayAndTrack(sessionId, s.sentenceId, s.text, { turnId, origin: nativeOrigin });
    }
  }

  /**
   * 确认结果公共入口(词表环 + confirm.click 双调;合同 §6)。
   * 不复制 switch 体——词表与 click 共用本方法。
   */
  applyConfirmOutcome(
    sessionId: string,
    turnId: string,
    outcome: ConfirmOutcome,
    channel: ConfirmChannel = "voice"
  ): void {
    const d = this.deps;
    if (outcome.kind === "stale") {
      d.audit.record({
        actor: "daemon",
        action: "confirm.stale",
        meta: { sessionId, turnId, receiptId: outcome.pending.receiptId, channel }
      });
      this.sayAndTrack(
        sessionId,
        `s-confirm-${turnId}-stale`,
        "内容变了,这个确认作废了,需要的话我重新提议。"
      );
      return;
    }
    // 执行中 S2 审批张(执行器批):accept/reject/超时终局全部由 RuntimeApprovalFlow 承接
    if (outcome.kind !== "not_pending" && outcome.pending.payload.kind === "runtime_effect") {
      this.handleRuntimeEffectOutcome(sessionId, turnId, outcome, channel);
      return;
    }
    if (outcome.kind !== "not_pending" && outcome.pending.payload.kind === "readiness") {
      this.handleReadinessOutcome(sessionId, turnId, outcome);
      return;
    }
    if (outcome.kind !== "not_pending" && outcome.pending.payload.kind === "memory") {
      this.handleMemoryOutcome(sessionId, turnId, outcome);
      return;
    }
    if (outcome.kind !== "not_pending" && outcome.pending.payload.kind === "project_anchor") {
      this.handleProjectAnchorOutcome(sessionId, turnId, outcome);
      return;
    }
    if (
      outcome.kind !== "not_pending" &&
      ConfirmationLoopClass.isFocusSemanticKind(outcome.pending.payload.kind)
    ) {
      this.handleFocusConfirmOutcome(sessionId, turnId, outcome, channel);
      return;
    }
    this.handleDispatchConfirmOutcome(sessionId, turnId, outcome);
  }

  /** 审批裁决轮(词表环;09 §3 收据状态机 + §13 confirmAndDispatch 执行体) */
  private handleConfirmReply(sessionId: string, turnId: string, reply: string): void {
    const d = this.deps;
    const confirm = d.confirm as ConfirmationLoop;
    const replayId = `s-confirm-${turnId}`;
    const outcome = confirm.consumeReply(sessionId, reply, replayId);
    this.applyConfirmOutcome(sessionId, turnId, outcome, "voice");
  }

  /** console confirm.click 入口 */
  applyConfirmClick(
    sessionId: string,
    receiptId: string,
    digest: string,
    decision: "accept" | "reject",
    channel: ConfirmChannel = "click"
  ): void {
    const confirm = this.deps.confirm as ConfirmationLoop | null | undefined;
    if (!confirm) return;
    const turnId = `click-${receiptId.slice(-8)}`;
    const outcome = confirm.consumeClick(sessionId, receiptId, digest, decision);
    this.applyConfirmOutcome(sessionId, turnId, outcome, channel);
  }

  /** M1 移动卡裁决:按卡原 session+receipt 命中;withdraw 只撤下,不等同 reject。 */
  applyConfirmDecision(
    sessionId: string,
    receiptId: string,
    decision: "accept" | "reject" | "withdraw",
    via: "local" | "tailnet" | "mobile_lan" = "local"
  ): "applied" | "not_pending" | "untrusted_runtime" {
    const confirm = this.deps.confirm as ConfirmationLoop | null | undefined;
    if (!confirm) return "not_pending";
    const pending = confirm.pending(sessionId);
    if (!pending || pending.receiptId !== receiptId) return "not_pending";
    if (decision === "withdraw") {
      this.cancelAutoAccept(sessionId);
      confirm.withdraw(sessionId, receiptId);
      return "applied";
    }
    // mobile_lan 只有长期 token、没有设备配对/PIN 身份，不能接受或拒绝 S2 runtime gate；
    // withdraw 只撤 presentation，已在上方独立处理，不释放 gate。
    if (via === "mobile_lan" && pending.payload.kind === "runtime_effect") return "untrusted_runtime";
    this.applyConfirmClick(sessionId, receiptId, pending.digest, decision, via === "local" ? "click" : via);
    return "applied";
  }

  private handleDispatchConfirmOutcome(
    sessionId: string,
    turnId: string,
    outcome: ConfirmOutcome
  ): void {
    const d = this.deps;
    switch (outcome.kind) {
      case "not_pending":
        return;
      case "stale":
        return;
      case "accepted": {
        const p = outcome.pending;
        // C3 负向:未知 payload 不再落 dispatch 分支(fail-closed)
        if (p.payload.kind !== "dispatch") {
          d.audit.record({
            actor: "daemon",
            action: "confirm.unknown_payload_rejected",
            meta: {
              sessionId,
              turnId,
              receiptId: p.receiptId,
              payloadKind: (p.payload as { kind?: string }).kind ?? "unknown"
            }
          });
          this.sayAndTrack(
            sessionId,
            `s-confirm-${turnId}-unknown`,
            "这类确认我还接不上,先不开工,你在屏幕上看一眼。"
          );
          return;
        }
        // impl-readback 回收批 2(B2):收据可能已被 15s sweep 终局(timeout/expired)——
        // 此时 applyReceiptEvent 抛 "receipt is terminal",旧实现异常上抛只落 log,用户零反馈。
        try {
          applyReceiptEvent(d.db, d.audit, p.receiptId, { kind: "user_accept" }, this.now);
        } catch (err) {
          // C-1(回收批 2 复审):按错误面分话术——terminal(sweep 已终局)= 过期;其他(基础设施故障)不谎称过期
          const msg = String(err);
          const terminal = msg.includes("is terminal") || msg.includes("already decided");
          d.log.warn(terminal ? "confirm accept on terminal receipt" : "confirm accept failed (infra)", {
            receiptId: p.receiptId,
            error: msg.slice(0, 120)
          });
          this.sayAndTrack(
            sessionId,
            `s-confirm-${turnId}-${terminal ? "expired" : "err"}`,
            terminal ? "这个确认已经过期了,还要做的话重新说一遍。" : "这单我这边出了点问题,你在屏幕上看一眼。"
          );
          return;
        }
        if (!d.dispatchDeps) {
          this.sayAndTrack(sessionId, `s-dispatch-${turnId}`, "确认记下了,但派发通道没接好,你在屏幕上看一眼。");
          return;
        }
        const pl = p.payload;
        try {
          const r = dispatchApprovedPackage(d.dispatchDeps, {
            packageId: pl.packageId,
            revision: pl.revision,
            mode: pl.mode,
            receiptId: p.receiptId
          });
          d.audit.record({
            actor: "owner",
            action: "dispatch.voice_confirmed",
            meta: { sessionId, turnId, receiptId: p.receiptId, taskId: r.taskId }
          });
          // 状态词纪律:排队 != 执行完;回叫点承诺照 10 §3-4
          this.sayAndTrack(sessionId, `s-dispatch-${turnId}`, "好,任务排进队列了,到验收点我叫你。");
        } catch (err) {
          const msg = String(err instanceof Error ? err.message : err);
          const text = msg.includes("Gate 0")
            ? "这单我现在还不能自动开工——安全门禁没配好,你在屏幕上处理一下,或者这次我陪你手动走。"
            : redactForSpeech(`这单派不出去:${msg.slice(0, 60)}。你在屏幕上看下详情。`).text;
          this.sayAndTrack(sessionId, `s-dispatch-${turnId}`, text);
        }
        return;
      }
      case "rejected": {
        try {
          applyReceiptEvent(d.db, d.audit, outcome.pending.receiptId, { kind: "user_reject" }, this.now);
        } catch (err) {
          // B2+C-1:terminal=过期(拒绝语义已达成,不开工);基础设施故障=如实报障(收据仍 pending,sweep 会终局,同样不开工)
          const msg = String(err);
          const terminal = msg.includes("is terminal") || msg.includes("already decided");
          d.log.warn(terminal ? "confirm reject on terminal receipt" : "confirm reject failed (infra)", {
            receiptId: outcome.pending.receiptId,
            error: msg.slice(0, 120)
          });
          this.sayAndTrack(
            sessionId,
            `s-confirm-${turnId}-${terminal ? "expired" : "err"}`,
            terminal ? "这个确认已经过期了,本来也不会开工。" : "这单我这边出了点问题,先不开工,你在屏幕上看一眼。"
          );
          return;
        }
        this.sayAndTrack(sessionId, `s-confirm-${turnId}-no`, "好,先不开工。要改哪里,直接说。");
        return;
      }
      case "reread":
      case "invalidated_reread": {
        // 复读 = 原文重放(10 §3-3;被打断后必须完整重播,裸肯定不消费——A8)
        this.replayConfirmation(sessionId, outcome.pending, turnId);
        return;
      }
      case "to_screen": {
        d.audit.record({
          actor: "daemon",
          action: "approval.to_screen",
          meta: { sessionId, receiptId: outcome.pending.receiptId, at: this.now().toISOString() }
        });
        this.sayAndTrack(sessionId, `s-confirm-${turnId}-scr`, "这个确认我放屏幕上了,你在审批页点一下。");
        return;
      }
    }
  }

  /** 项目归属确认环：accept 才改锚；拒绝/不匹配/过期均零项目写入。 */
  private handleProjectAnchorOutcome(
    sessionId: string,
    turnId: string,
    outcome: Exclude<ConfirmOutcome, { kind: "not_pending" }>
  ): void {
    const d = this.deps;
    const candidate = outcome.pending.payload as ProjectAnchorCandidate;
    switch (outcome.kind) {
      case "accepted": {
        if (!d.projectAnchorAccept) {
          this.sayAndTrack(sessionId, `s-anchor-${turnId}-err`, "项目归属通道没接好,这轮先不改。");
          return;
        }
        let accepted: ReturnType<NonNullable<LiveDialogDeps["projectAnchorAccept"]>>;
        try {
          accepted = d.projectAnchorAccept(sessionId, candidate);
        } catch (err) {
          const code = err instanceof Error ? err.name : "unknown";
          d.log.warn("project anchor accept failed", { code });
          const retryPath =
            err instanceof Error &&
            (/过期|变化/u.test(err.message) || err.name === "WorkspacePolicyError");
          this.sayAndTrack(
            sessionId,
            `s-anchor-${turnId}-err`,
            retryPath
              ? "项目归属在确认时发生了变化,这轮没改。请把路径再说一次。"
              : "项目归属落账时遇到问题,这轮没改。你稍后再试一次。"
          );
          return;
        }
        try {
          this.sayAndTrack(
            sessionId,
            `s-anchor-${turnId}-ok`,
            accepted.ready && !accepted.postCommitDegraded
              ? candidate.branch === "adopt_workspace"
                ? "好,项目归属已经挂上了。接着说这件事。"
                : "好,已经挂回已有项目。接着说这件事。"
              : "项目归属已经挂上了,上下文还在重建。这轮先停在这里,你稍后再说一次。"
          );
        } catch (err) {
          const code = err instanceof Error ? err.name : "unknown";
          this.safeWarn("project anchor post-commit speech failed", {
            code,
            projectRevision: accepted.event.projectRevision
          });
        }
        return;
      }
      case "rejected":
        d.audit.record({
          actor: "owner",
          action: "project.anchor.rejected",
          refDigest: candidate.canonicalPathDigest,
          meta: { sessionId, proposalId: candidate.proposalId, turnId }
        });
        this.sayAndTrack(sessionId, `s-anchor-${turnId}-no`, "好,这轮不改项目归属。");
        return;
      case "reread":
      case "invalidated_reread":
        this.replayConfirmation(sessionId, outcome.pending, turnId);
        return;
      case "to_screen":
        d.audit.record({
          actor: "daemon",
          action: "project.anchor.abandoned",
          refDigest: candidate.canonicalPathDigest,
          meta: { sessionId, proposalId: candidate.proposalId, turnId }
        });
        this.sayAndTrack(sessionId, `s-anchor-${turnId}-again`, "这次先不改。需要时把本地路径再说一遍。");
        return;
    }
  }

  // 双速直通(2026-08-04):AI 提议的 5 秒倒计时——到点无异议自动 accept;用户开口即取消倒计时
  private autoTimers = new Map<string, { receiptId: string; timer: ReturnType<typeof setTimeout> }>();

  scheduleAutoAccept(sessionId: string, receiptId: string, ms: number): void {
    const prev = this.autoTimers.get(sessionId);
    if (prev) clearTimeout(prev.timer);
    const timer = setTimeout(() => {
      this.autoTimers.delete(sessionId);
      const d = this.deps;
      const confirm = d.confirm as ConfirmationLoop;
      const pending = confirm.pending(sessionId);
      if (!pending || pending.receiptId !== receiptId) return; // 已被裁决/撤下,不抢跑
      // 合同 §6.1:走 accept 预占路径,不再 dismiss(dismiss 会轻终局清行)
      const outcome = confirm.consumeAutoAccept(sessionId, receiptId);
      d.audit.record({
        actor: "daemon",
        action: "focus.confirm.auto_accepted_countdown",
        meta: { sessionId, receiptId, outcome: outcome.kind }
      });
      this.applyConfirmOutcome(sessionId, `auto-${receiptId}`, outcome, "auto");
    }, ms);
    timer.unref?.();
    this.autoTimers.set(sessionId, { receiptId, timer });
  }

  private cancelAutoAccept(sessionId: string): boolean {
    const t = this.autoTimers.get(sessionId);
    if (!t) return false;
    clearTimeout(t.timer);
    this.autoTimers.delete(sessionId);
    return true;
  }

  /** C3 Focus 确认环:accept 走 FocusWriteTx;拒绝零写入 */
  /** 换锚语义(E2 F02 补):锚到新 Focus 前,先正常关闭本 session 在其他 Focus 上的 active activation */
  private closeOtherActiveActivation(sessionId: string, targetFocusId: string): void {
    const d = this.deps;
    const row = d.db
      .prepare("SELECT id, focus_id FROM focus_activations WHERE session_id = ? AND status = 'active'")
      .get(sessionId) as { id: string; focus_id: string } | undefined;
    if (row && row.focus_id !== targetFocusId) {
      closeActivation(d.db, { activationId: row.id, sessionId, focusId: row.focus_id });
    }
  }

  private handleFocusConfirmOutcome(
    sessionId: string,
    turnId: string,
    outcome: Exclude<ConfirmOutcome, { kind: "not_pending" }>,
    channel: ConfirmChannel = "voice"
  ): void {
    const d = this.deps;
    const confirm = d.confirm as ConfirmationLoop;
    const pl = outcome.pending.payload as FocusPendingPayload;
    switch (outcome.kind) {
      case "accepted": {
        try {
          // 合同 §6.1:mutation 与 DELETE pending 同事务;成功后 finalizeAccepted
          // 侧效应(interrupted 清理/关他激活)放事务外 best-effort,失败不回滚主账
          if (pl.kind === "focus_anchor") {
            const load =
              d.loadFocusTranscript ??
              (() => ({ lines: [] as import("../focus/closeSettlement.js").TranscriptLine[], storeTranscript: false }));
            const cleanup = buildInterruptedCleanupPresentation(d.db, pl.focusId, load);
            if (cleanup.combinedChecklist) {
              this.sayAndTrack(sessionId, `s-focus-cleanup-${turnId}`, cleanup.combinedChecklist.slice(0, 400));
              for (const item of cleanup.items) {
                if (!item.degradedNoTranscript) {
                  const u = listUnsettledInterruptedActivations(d.db, pl.focusId).find(
                    (x) => x.activationId === item.activationId
                  );
                  if (u) {
                    const t = load(u.sessionId);
                    rebuildProvisionalFromInterrupted(d.db, {
                      focusId: pl.focusId,
                      activationId: u.activationId,
                      sessionId: u.sessionId,
                      transcriptLines: t.lines,
                      storeTranscript: t.storeTranscript,
                      dryRun: false
                    });
                  }
                }
              }
            }
            this.closeOtherActiveActivation(sessionId, pl.focusId);
            withFocusWriteTx(d.db, {}, (ops) => {
              startActivationOnOps(ops, {
                focusId: pl.focusId,
                sessionId,
                trigger: pl.trigger ?? "user_explicit",
                expectedAnchorRevision: pl.expectedAnchorRevision,
                actorKind: "user"
              });
              confirm.commitConsume(sessionId, outcome.pending.receiptId);
            });
            confirm.finalizeAccepted(sessionId, outcome.pending.receiptId, channel);
            this.sayAndTrack(sessionId, `s-focus-anchor-${turnId}`, `好,接到「${pl.title}」上了(focus:${pl.focusId})。`);
            emitFocusEntitySafe(d.emitFocusEntity, d.log, sessionId, {
              kind: "接上",
              title: pl.title,
              sub: "会话接到 Focus",
              color: "act"
            });
          } else if (pl.kind === "focus_obligation") {
            const items = focusObligationItems(pl);
            if (items.length === 0) throw new Error("focus_obligation payload empty");
            // 逐项 dedupeKey 预检:库内已存在任一 → 整卡拒绝零写入
            for (const ob of items) {
              const hit = d.db
                .prepare(
                  `SELECT id FROM focus_obligations WHERE focus_id = ? AND dedupe_key = ?`
                )
                .get(pl.focusId, ob.dedupeKey) as { id: string } | undefined;
              if (hit) {
                throw new Error(
                  `obligation_dedupe_conflict: dedupeKey=${ob.dedupeKey} already exists (batch all-or-nothing)`
                );
              }
            }
            // 同事务:全有或全无
            withFocusWriteTx(d.db, {}, (ops) => {
              for (const ob of items) {
                const obAlreadyDecided = ob.alreadyDecided === true;
                const obLaneId = ob.laneId;
                const obWaitId = ob.waitingOnObligationId;
                const obWaitText = ob.waitingOn;
                ops.upsertObligation(pl.focusId, {
                  kind: ob.kind,
                  title: ob.title,
                  ...(ob.detail ? { detail: ob.detail } : {}),
                  owner: ob.owner,
                  ...(obAlreadyDecided
                    ? { status: "resolved" as const, resolution: "done" as const }
                    : obWaitId
                      ? {
                          status: "waiting" as const,
                          waitingOnObligationId: obWaitId,
                          ...(obWaitText ? { waitingOn: obWaitText } : {})
                        }
                      : { status: "open" as const }),
                  ...(obLaneId ? { laneId: obLaneId } : {}),
                  verification: ob.verification ?? "confirmed",
                  dedupeKey: ob.dedupeKey,
                  ...(ob.nextStep ? { nextStep: ob.nextStep } : {}),
                  ...(ob.needs && !obAlreadyDecided ? { needs: ob.needs } : {}),
                  actorKind: "user",
                  sessionId
                });
              }
              confirm.commitConsume(sessionId, outcome.pending.receiptId);
            });
            confirm.finalizeAccepted(sessionId, outcome.pending.receiptId, channel);
            const titles = items.map((o) => o.title).join("、");
            this.sayAndTrack(
              sessionId,
              `s-focus-ob-${turnId}`,
              items.length > 1
                ? `好,「${titles}」一共 ${items.length} 条都记下了。`
                : items[0]!.alreadyDecided
                  ? `好,已定的事记档了:「${items[0]!.title}」——不用你再动。`
                  : items[0]!.waitingOn
                    ? `好,「${items[0]!.title}」记下了,排在「${items[0]!.waitingOn}」之后。`
                    : `好,「${items[0]!.title}」记下了。`
            );
            for (const ob of items) {
              emitFocusEntitySafe(d.emitFocusEntity, d.log, sessionId, {
                kind: "记下一件事",
                title: ob.title,
                sub: ob.alreadyDecided
                  ? "已定档"
                  : ob.waitingOn
                    ? `排队等「${ob.waitingOn}」`
                    : ownerSub(ob.owner, ob.nextStep),
                color: ob.alreadyDecided ? "gray" : colorForOwner(ob.owner, ob.needs)
              });
            }
          } else if (pl.kind === "focus_obligation_resolve") {
            try {
              withFocusWriteTx(d.db, {}, (ops) => {
                ops.upsertObligation(pl.focusId, {
                  kind: pl.obKind,
                  title: pl.obligationTitle,
                  owner: pl.obOwner,
                  status: "resolved",
                  verification: pl.obVerification,
                  dedupeKey: pl.obDedupeKey,
                  resolution: pl.resolution,
                  actorKind: "user",
                  sessionId,
                  ...(pl.evidence ? { evidence: pl.evidence } : {})
                });
                confirm.commitConsume(sessionId, outcome.pending.receiptId);
              });
            } catch (e) {
              // ④e A7:写门拒(缺 evidence / 三查失败)——不销账,诚实告知
              const msg = e instanceof Error ? e.message : String(e);
              d.audit.record({
                actor: "daemon",
                action: "confirm.obligation_resolve_blocked",
                meta: { sessionId, turnId, code: msg.slice(0, 80) }
              });
              this.sayAndTrack(
                sessionId,
                `s-focus-obres-blocked-${turnId}`,
                msg.includes("evidence")
                  ? "这笔记在账上归我办的事,还没有可对账的交付证据,我不能空口销账。先交付再销,或改说放弃/不再适用。"
                  : `这笔记销账没办成:${msg.slice(0, 60)}。`
              );
              return;
            }
            confirm.finalizeAccepted(sessionId, outcome.pending.receiptId, channel);
            const resWord = pl.resolution === "done" ? "完成" : pl.resolution === "abandoned" ? "放弃" : "不再适用";
            this.sayAndTrack(sessionId, `s-focus-obres-${turnId}`, `好,「${pl.obligationTitle}」已按「${resWord}」销账。`);
            emitFocusEntitySafe(d.emitFocusEntity, d.log, sessionId, {
              kind: "办结",
              title: pl.obligationTitle,
              sub: resolutionSub(pl.resolution),
              color: "act"
            });
          } else if (pl.kind === "focus_create_anchor") {
            // 先关本 session 他激活(独立事务;新建 id 尚未知,关全部 active 即可)
            this.closeOtherActiveActivation(sessionId, "__new__");
            const created = withFocusWriteTx(d.db, {}, (ops) => {
              const c = ops.createFocus({ title: pl.title, actorKind: "user", sessionId });
              startActivationOnOps(ops, {
                focusId: c.focusId,
                sessionId,
                trigger: "user_explicit",
                expectedAnchorRevision: pl.expectedAnchorRevision,
                actorKind: "user"
              });
              confirm.commitConsume(sessionId, outcome.pending.receiptId);
              return c;
            });
            confirm.finalizeAccepted(sessionId, outcome.pending.receiptId, channel);
            this.sayAndTrack(
              sessionId,
              `s-focus-create-${turnId}`,
              `好,已新建 Focus「${pl.title}」并把会话锚上去了(focus:${created.focusId})。`
            );
            emitFocusEntitySafe(d.emitFocusEntity, d.log, sessionId, {
              kind: "接上",
              title: pl.title,
              sub: "新建 Focus 并接上",
              color: "act"
            });
          } else if (pl.kind === "focus_revision") {
            withFocusWriteTx(d.db, {}, (ops) => {
              ops.settleRevision(pl.focusId, {
                currentDirection: pl.currentDirection,
                lastReliableState: pl.lastReliableState,
                ...(pl.nextActivationTrigger ? { nextActivationTrigger: pl.nextActivationTrigger } : {}),
                createdBySessionId: sessionId,
                actorKind: "user",
                sessionId
              });
              confirm.commitConsume(sessionId, outcome.pending.receiptId);
            });
            confirm.finalizeAccepted(sessionId, outcome.pending.receiptId, channel);
            this.sayAndTrack(sessionId, `s-focus-rev-${turnId}`, "好,焦点状态已更新一版。");
            emitFocusEntitySafe(d.emitFocusEntity, d.log, sessionId, {
              kind: "方向更新",
              title: pl.currentDirection.slice(0, 80) || "方向更新",
              sub: "方向写进账本",
              color: "act"
            });
          } else if (pl.kind === "focus_lane_split") {
            withFocusWriteTx(d.db, {}, (ops) => {
              // 消费端同事务:建 lanes + 事件 + 义务归线;baseline 漂移抛 stale
              consumeLaneSplitOnOps(ops, {
                focusId: pl.focusId,
                lanes: pl.lanes,
                baseline: pl.baseline,
                actorKind: "user",
                sessionId
              });
              confirm.commitConsume(sessionId, outcome.pending.receiptId);
            });
            confirm.finalizeAccepted(sessionId, outcome.pending.receiptId, channel);
            const titles = pl.lanes.map((l) => l.title).join("、");
            this.sayAndTrack(sessionId, `s-focus-lane-${turnId}`, `好,拆出线:${titles}。`);
            emitFocusEntitySafe(d.emitFocusEntity, d.log, sessionId, {
              kind: "拆出线",
              title: titles || "并行线",
              sub: `拆出 ${pl.lanes.length} 条线`,
              color: "act"
            });
          } else if (pl.kind === "expectation_ack") {
            // ④d:四合一 CAS(旧 active→superseded + pending_ack→active + 事件 + commitConsume)
            withFocusWriteTx(d.db, {}, (ops) => {
              settleExpectationAckOnOps(ops, {
                focusId: pl.focusId,
                expectationId: pl.expectationId,
                fromRevision: pl.fromRevision,
                toRevision: pl.toRevision,
                outcome: "accepted",
                receiptRef: outcome.pending.receiptId,
                sessionId
              });
              confirm.commitConsume(sessionId, outcome.pending.receiptId);
            });
            confirm.finalizeAccepted(sessionId, outcome.pending.receiptId, channel);
            this.sayAndTrack(
              sessionId,
              `s-focus-exp-ack-${turnId}`,
              `好,期待调整记下了:${pl.summary.slice(0, 60)}。`
            );
          }
          d.onFocusConfirm?.(sessionId, pl, true);
          d.audit.record({
            actor: "owner",
            action: "focus.confirm.accepted",
            meta: { sessionId, turnId, kind: pl.kind, focusRef: "focusId" in pl ? pl.focusId : pl.title, channel }
          });
          // ④c:commitConsume 成功 → confirmation_settled 控制轮(Brain 续办发令枪)
          this.enqueueConfirmationSettledControl(sessionId, outcome.pending.receiptId, pl);
        } catch (err) {
          confirm.releaseHold(sessionId);
          const msg = String(err instanceof Error ? err.message : err).slice(0, 120);
          d.log.warn("focus confirm accept failed", { kind: pl.kind, error: msg });
          this.sayAndTrack(
            sessionId,
            `s-focus-${turnId}-err`,
            redactForSpeech(`这次没能落账:${msg.slice(0, 40)}。你再说一次或去屏幕上看。`).text
          );
        }
        return;
      }
      case "stale":
        this.sayAndTrack(
          sessionId,
          `s-focus-${turnId}-stale`,
          "内容变了,这个确认作废了,需要的话我重新提议。"
        );
        return;
      case "rejected":
        d.onFocusConfirm?.(sessionId, pl, false);
        d.audit.record({
          actor: "owner",
          action: "focus.confirm.rejected",
          meta: { sessionId, turnId, kind: pl.kind, focusRef: "focusId" in pl ? pl.focusId : pl.title }
        });
        this.sayAndTrack(sessionId, `s-focus-${turnId}-no`, "好,这轮不改焦点。");
        return;
      case "reread":
      case "invalidated_reread":
        this.replayConfirmation(sessionId, outcome.pending, turnId);
        return;
      case "to_screen":
        d.audit.record({
          actor: "daemon",
          action: "focus.confirm.to_screen",
          meta: { sessionId, turnId, kind: pl.kind, focusRef: "focusId" in pl ? pl.focusId : pl.title }
        });
        this.sayAndTrack(sessionId, `s-focus-${turnId}-scr`, "这个确认我放屏幕上了。");
        return;
    }
  }

  /** 就绪复述确认环承接(A3-armed;10 #41):accept ⇒ 升格事务(candidate→confirmed);否认 ⇒ 环作废零升格 */
  private handleReadinessOutcome(sessionId: string, turnId: string, outcome: Exclude<ConfirmOutcome, { kind: "not_pending" }>): void {
    const d = this.deps;
    const pl = outcome.pending.payload as Extract<PendingConfirmation["payload"], { kind: "readiness" }>;
    switch (outcome.kind) {
      case "accepted": {
        if (!d.readinessConfirm) {
          this.sayAndTrack(sessionId, `s-readiness-${turnId}`, "你确认的我听到了,但绑定通道没接好,这轮先不算数,你在屏幕上看一眼。");
          return;
        }
        try {
          d.readinessConfirm({
            sessionId,
            turnId,
            projectId: pl.projectId,
            receiptId: outcome.pending.receiptId,
            candidates: pl.candidates
          });
          this.sayAndTrack(sessionId, `s-readiness-${turnId}`, "都对上了,这几项我按确认过的算。");
        } catch (err) {
          d.log.warn("readiness confirm failed", { error: String(err).slice(0, 160) });
          this.sayAndTrack(sessionId, `s-readiness-${turnId}`, "确认落账的时候出了问题,这轮先不算数——稍后我再跟你确认一遍。");
        }
        return;
      }
      case "rejected": {
        // 环作废零升格(10 #41):按修正重新 remember 再确认
        d.audit.record({ actor: "owner", action: "readiness.confirm_rejected", meta: { sessionId, turnId, receiptId: outcome.pending.receiptId } });
        this.sayAndTrack(sessionId, `s-readiness-${turnId}`, "好,哪条不对直接说,我改过来再跟你确认一遍。");
        return;
      }
      case "reread":
      case "invalidated_reread": {
        this.replayConfirmation(sessionId, outcome.pending, turnId);
        return;
      }
      case "to_screen": {
        // 就绪确认卡屏幕面未接(11 §5.6a 随 console 批)——环作废如实说,不指向不存在的卡
        d.audit.record({ actor: "daemon", action: "readiness.confirm_abandoned", meta: { sessionId, receiptId: outcome.pending.receiptId } });
        this.sayAndTrack(sessionId, `s-readiness-${turnId}`, "那这次先不确认。想核对的时候说一声,我重新念一遍。");
        return;
      }
    }
  }

  /** SD-2:普通 M0 记忆确认环裁决(10 #36 "记不记";只有确认过的偏好才说"记住了") */
  private handleMemoryOutcome(sessionId: string, turnId: string, outcome: Exclude<ConfirmOutcome, { kind: "not_pending" }>): void {
    const d = this.deps;
    const pl = outcome.pending.payload as MemoryPendingPayload;
    const receiptId = outcome.pending.receiptId;
    switch (outcome.kind) {
      case "accepted": {
        if (!d.memoryConfirm) {
          d.audit.record({ actor: "daemon", action: "memory.m0_confirm_unwired", meta: { sessionId, turnId, receiptId } });
          this.sayAndTrack(sessionId, `s-memory-${turnId}`, "你确认的我听到了,但记忆通道没接好,这条先没记,你在屏幕上看一眼。");
          return;
        }
        try {
          d.memoryConfirm({ sessionId, turnId, receiptId, payload: pl });
          this.sayAndTrack(sessionId, `s-memory-${turnId}`, "记住了。");
        } catch (err) {
          d.log.warn("memory confirm failed", { error: String(err).slice(0, 160) });
          this.sayAndTrack(sessionId, `s-memory-${turnId}`, "记的时候出了问题,这条先没记——稍后我再跟你确认一遍。");
        }
        return;
      }
      case "rejected": {
        d.audit.record({ actor: "owner", action: "memory.m0_rejected", meta: { sessionId, turnId, receiptId, claimDigest: pl.claimDigest } });
        this.sayAndTrack(sessionId, `s-memory-${turnId}`, "好,这条不记。");
        return;
      }
      case "reread":
      case "invalidated_reread": {
        this.replayConfirmation(sessionId, outcome.pending, turnId);
        return;
      }
      case "to_screen": {
        d.audit.record({ actor: "daemon", action: "memory.m0_abandoned", meta: { sessionId, receiptId } });
        this.sayAndTrack(sessionId, `s-memory-${turnId}`, "那这条先不记。想记的时候再说一声。");
        return;
      }
    }
  }

  /** 执行中 S2 审批张的词表裁决承接(10 #19;收据状态机与 gate promise 在 RuntimeApprovalFlow) */
  private handleRuntimeEffectOutcome(
    sessionId: string,
    turnId: string,
    outcome: Exclude<ConfirmOutcome, { kind: "not_pending" }>,
    channel: ConfirmChannel
  ): void {
    const d = this.deps;
    const flow = d.runtimeApprovals;
    const receiptId = outcome.pending.receiptId;
    if (!flow) {
      // 装配缺失(不应发生):fail-closed——不裁决,收据按超时终局,gate 侧到点 deny
      d.log.warn("runtime approval outcome with no flow wired", { receiptId });
      return;
    }
    const actualVia = channel === "voice" || channel === "auto" ? "voice" : channel === "tailnet" ? "tailnet" : "screen";
    switch (outcome.kind) {
      case "accepted": {
        const r = flow.decide(receiptId, "accept", { via: actualVia, sessionId, turnId });
        this.sayAndTrack(
          sessionId,
          `s-rtapproval-${turnId}`,
          r.ok ? "好,放行了,继续跑。" : "这个审批已经过期了,这条命令我先拦下了。"
        );
        return;
      }
      case "rejected": {
        flow.decide(receiptId, "reject", { via: actualVia, sessionId, turnId });
        this.sayAndTrack(sessionId, `s-rtapproval-${turnId}`, "好,这条不做。agent 会换个路子或先停下。");
        return;
      }
      case "reread":
      case "invalidated_reread":
        this.replayConfirmation(sessionId, outcome.pending, turnId);
        return;
      case "to_screen":
        d.audit.record({
          actor: "daemon",
          action: "approval.to_screen",
          meta: { sessionId, receiptId, at: this.now().toISOString() }
        });
        this.sayAndTrack(sessionId, `s-rtapproval-${turnId}-scr`, "这个审批我放屏幕上了,你在审批页点一下;不点的话到点我就先拦下。");
        return;
    }
  }

  /** ④c:语义确认消费成功后注入 confirmation_settled 控制轮 */
  private enqueueConfirmationSettledControl(
    sessionId: string,
    receiptId: string,
    pl: FocusPendingPayload
  ): void {
    let remainingIntent: string | undefined;
    try {
      const ri = (this.deps.confirm as ConfirmationLoopClass | null | undefined)?.readRemainingIntent?.(
        receiptId
      );
      if (ri && !ri.handled && ri.text) remainingIntent = ri.text;
    } catch {
      // ignore
    }
    this.injectControlTurn(sessionId, {
      kind: "confirmation_settled",
      receiptRef: receiptId,
      outcome: "accepted",
      ...(remainingIntent ? { remainingIntent } : {}),
      ...("focusId" in pl && pl.focusId ? { focusId: pl.focusId } : {})
    });
  }

  private recordStep(
    sessionId: string,
    turnId: string,
    step: {
      usage?:
        | {
            promptTokens: number;
            completionTokens: number;
            cachedPromptTokens?: number;
            cacheWriteInputTokens?: number;
          }
        | undefined;
      observedModel?: string | undefined;
      routedProvider?: string | undefined;
      toolCalls: number;
    },
    origin: "user" | "control" = "user"
  ): void {
    const d = this.deps;
    if (!step.usage || !step.observedModel) return;
    recordLlmUsage(
      d.db,
      "dialog",
      {
        model: step.observedModel,
        promptTokens: step.usage.promptTokens,
        completionTokens: step.usage.completionTokens,
        ...(step.usage.cachedPromptTokens !== undefined
          ? { cachedPromptTokens: step.usage.cachedPromptTokens }
          : {}),
        ...(step.usage.cacheWriteInputTokens !== undefined
          ? { cacheWriteInputTokens: step.usage.cacheWriteInputTokens }
          : {}),
        ...(step.routedProvider !== undefined ? { routedProvider: step.routedProvider } : {})
      },
      { sessionId, origin }
    );
    d.audit.record({
      actor: "daemon",
      action: origin === "control" ? "invocation.dialog_control" : "invocation.dialog",
      meta: {
        sessionId,
        turnId,
        origin,
        configured_provider: d.configuredProvider ?? "api",
        routed_provider: step.routedProvider ?? "unknown",
        observedModel: step.observedModel,
        toolCalls: step.toolCalls
      }
    });
  }

  private sayAndTrack(
    sessionId: string,
    sentenceId: string,
    text: string,
    options: {
      trackAlways?: boolean;
      turnId?: string;
      origin?: NativeReplyOrigin;
    } = {}
  ): boolean {
    const nativeContext = options.turnId
      ? { turnId: options.turnId, origin: options.origin ?? "system" }
      : undefined;
    const enqueued = this.deps.say(sessionId, sentenceId, text, nativeContext);
    // J5:文本落转写与 tts 解耦——pipeline 缺席只是没声音,文本必须照常落屏(此前 enqueued=false 时
    // 整句静默丢失且不重放)。replay 路径传 trackAlways=false 维持原语义(防重复行)。
    if (enqueued || options.trackAlways !== false) {
      this.deps.sessions.onAiSentences(sessionId, [{ sentenceId, text }]);
    }
    return enqueued;
  }

  private replayConfirmation(sessionId: string, pending: PendingConfirmation, turnId: string): void {
    let enqueued = false;
    try {
      enqueued = this.sayAndTrack(sessionId, pending.sentenceId, pending.promptText, {
        trackAlways: false,
        turnId,
        origin: "confirmation"
      });
    } catch (err) {
      this.deps.log.warn("confirmation replay enqueue failed", {
        receiptId: pending.receiptId,
        code: err instanceof Error ? err.name : "unknown"
      });
    }
    if (enqueued) this.deps.confirm?.armReplay(sessionId, pending.receiptId, pending.sentenceId);
  }

  /** 结果句式词表(10 §4-1 四类:执行/检查跑完·等你验收·交付了·做完了)——零任务语境下恒违规 */
  private static readonly RESULT_PHRASE = /(执行|检查)[^。!?]{0,8}跑完|等你验收|交付了|做完了/u;

  private violatesResultPhraseRule(projectId: string | null | undefined, text: string): boolean {
    if (!LiveDialog.RESULT_PHRASE.test(text)) return false;
    if (!projectId) return true; // 无项目锚定必无任务
    const row = this.deps.db
      .prepare(
        `SELECT 1 AS x FROM tasks WHERE project_id=? AND status IN
         ('queued','running','paused_step_boundary','blocked','ready_for_review','review_approved_waiting_merge','merging','cancel_requested') LIMIT 1`
      )
      .get(projectId);
    return !row; // 有活跃/待验收任务 ⇒ 放行(getStatus 转述场景);零任务 ⇒ 拦
  }
}
