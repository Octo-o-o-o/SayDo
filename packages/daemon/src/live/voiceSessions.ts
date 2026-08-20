// live 语音会话注册(接线批 2026-07-25;HANDOFF §2-9-①):voice sessionId <-> DB session 一对一,
// 开口即建 draft(09 §1)+ 逐轮转写落盘(~/.saydo/sessions/<id>.jsonl)+ unheard 过滤 + 空闲挂起/重建。
// unheard 纪律(09 §10 / 10 §3):被打断句(barge_in.truncatedSentenceId)及其后未播句 heard=false,
// 不入 Brain 对话史、转写落盘如实标注;被打断的关键确认必须重述(审批侧由 PresentationStore 承载)。
// 结算点:AI 轮句子先入 pending,下一用户轮 / 挂起 时按 barge-in 标记结算落盘(P0 句粒度,保守方向)。

import { join } from "node:path";
import type { Session, TranscriptTurn } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { getSession } from "../storage/dao/projects.js";
import { createProjectDraft } from "../projects/lifecycle.js";
import type { SessionManager } from "../session/manager.js";
import type { AuditSink } from "../obs/audit.js";
import { recordInitialSessionProjectEvent, type SessionProjectEvent } from "../projects/anchor.js";
import { isProjectAnchorQuestion } from "../brain/instructions.js";

export interface HistoryTurn {
  speaker: "user" | "ai";
  text: string;
  origin?: "onboarding";
}

interface PendingAiSentence {
  sentenceId: string;
  text: string;
  unheard: boolean;
  origin?: "onboarding";
}

interface LiveState {
  pendingAi: PendingAiSentence[] | null;
  history: HistoryTurn[];
  currentUserTurn: { turnId: string; text: string } | null;
  projectAnchorQuestionAsked: boolean;
  projectAnchorQuestionReserved: boolean;
  idleTimer: NodeJS.Timeout | null;
  /** 最近一次真实用户活动刷新 idle 的单调毫秒(控制轮不得改写——④c 断言锚) */
  lastIdleTouchAtMs: number | null;
  /** L5:续推入口指定的默认工作线(内存态,会话易耗品;记账未指明线时注入引导) */
  defaultLaneTitle: string | null;
}

export interface LiveVoiceSessionsDeps {
  db: Db;
  audit: AuditSink;
  sessions: SessionManager;
  /** 转写落盘根(HANDOFF §2-9-①:~/.saydo/sessions/) */
  saydoHome: string;
  /** 空闲挂起阈值秒([params].session_idle_suspend_sec;0=禁用定时器,测试用) */
  idleSuspendSec: number;
  /** 挂起回调(收尾语出口,10 §3-4;调用方经 TTS 下发) */
  onSuspend?: (sessionId: string, reason?: "idle" | "explicit") => void;
  /** durable session.project commit 后通知；调用方负责投递，失败可由重连回读。 */
  onProjectChanged?: (event: SessionProjectEvent) => void;
  /**
   * C1 Focus 收场门(stage≥1):在 session 转态前执行。
   * 返回 true=门已完成 session 终态(committed),调用方勿再 setState;
   * 返回 false=调用方走旧直转(stage0/无 Focus/presented 后仍需 suspend)。
   * 缺省 undefined = stage0 行为(旧直转)。
   */
  beforeSuspend?: (sessionId: string, reason: "idle" | "explicit") => boolean;
  now?: () => Date;
}

/** 对话史窗口(M8 高水位前的简化上限;与旧 index.ts dialogHistory 口径一致) */
const HISTORY_WINDOW = 40;

export class LiveVoiceSessions {
  private readonly deps: LiveVoiceSessionsDeps;
  private readonly live = new Map<string, LiveState>();
  private readonly now: () => Date;
  private acceptingIdleTimers = true;

  constructor(deps: LiveVoiceSessionsDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  private restoreHistory(sessionId: string, turns: readonly TranscriptTurn[]): void {
    const history: HistoryTurn[] = [];
    for (const turn of turns) {
      const heardText = turn.sentences.filter((x) => x.heard).map((x) => x.text).join("");
      if (heardText !== "") {
        history.push({
          speaker: turn.speaker,
          text: heardText,
          ...(turn.origin === "onboarding" ? { origin: "onboarding" as const } : {})
        });
      }
    }
    const state = this.state(sessionId);
    state.history = history.slice(-HISTORY_WINDOW);
    state.projectAnchorQuestionAsked ||= history.some(
      (turn) => turn.speaker === "ai" && isProjectAnchorQuestion(turn.text)
    );
  }

  /**
   * 确保会话存在(开口即建,09 §1):未知 sessionId => createProjectDraft + create(talking);
   * suspended => rebuild(同 packDigest + turnId 连续;history 从转写读回,heard=false 句不回填)。
   */
  ensureSession(sessionId: string): { session: Session; rebuilt: boolean; created: boolean } {
    const nowIso = this.now().toISOString();
    const absentFromProcess = !this.live.has(sessionId);
    let s = getSession(this.deps.db, sessionId);
    let created = false;
    let rebuilt = false;
    if (!s) {
      const createdRow = this.deps.db.transaction(() => {
        const draft = createProjectDraft(this.deps.db, this.deps.audit, nowIso);
        const session = this.deps.sessions.create({
          id: sessionId,
          projectId: draft.id,
          transcriptPath: join(this.deps.saydoHome, "sessions", `${sessionId}.jsonl`)
        });
        const event = recordInitialSessionProjectEvent(this.deps.db, sessionId, draft.id, nowIso);
        return { session, event };
      });
      const createdResult = createdRow.immediate();
      s = createdResult.session;
      this.deps.sessions.setState(sessionId, "talking");
      s = { ...s, state: "talking" };
      created = true;
      this.deps.onProjectChanged?.(createdResult.event);
    } else if (s.state === "closed") {
      // C2:closed session 禁止 rebuild——必须新建 sessionId(禁复活已关闭会话)
      throw new Error(
        `session_closed_no_rebuild: session ${sessionId} is closed; open a new session id instead of rebuilding`
      );
    } else if (s.state === "suspended") {
      const r = this.deps.sessions.rebuild(sessionId, s.contextSnapshotDigest);
      s = r.session;
      rebuilt = true;
      // history 从转写读回(heard=false 句不进对话事实——unheard 纪律的重建侧)
      this.restoreHistory(sessionId, r.turns);
    } else if (s.state === "talking" && absentFromProcess) {
      // daemon 崩溃/重启不会先把 talking 改 suspended；新进程首触达也必须从 durable
      // transcript 恢复 history，不能因 DB 状态仍是 talking 而得到空上下文。
      this.restoreHistory(sessionId, this.deps.sessions.readTurns(sessionId));
      rebuilt = true;
    } else if (s.state === "learning") {
      this.deps.sessions.setState(sessionId, "talking");
      s = { ...s, state: "talking" };
    }
    return { session: s, rebuilt, created };
  }

  /**
   * 用户轮:先结算上一 AI 轮(unheard 过滤落盘),再落用户轮 + 刷新空闲定时器。
   * excludeFromHistory(Codex 16 5.4):审批裁决轮的答复("好/可以/不要")照落转写(诚实记录),
   * 但不进 Brain 对话史——防下一轮普通对话把审批答复当上下文语义消费。
   */
  onUserTurn(sessionId: string, turnId: string, text: string, opts: { excludeFromHistory?: boolean } = {}): void {
    this.settlePendingAi(sessionId);
    const st = this.state(sessionId);
    st.currentUserTurn = { turnId, text };
    this.deps.sessions.appendTurn(sessionId, {
      turnId,
      speaker: "user",
      text,
      sentences: [{ sentenceId: turnId, text, heard: true }],
      engine: "cascade"
    });
    if (!opts.excludeFromHistory) {
      st.history.push({ speaker: "user", text });
      if (st.history.length > HISTORY_WINDOW) st.history = st.history.slice(-HISTORY_WINDOW);
    }
    this.touchIdle(sessionId);
  }

  /**
   * 当前进程内仍有效的 heard user turn。下一用户轮会覆盖该锚；迟到工具调用不得回捞
   * TranscriptTurn，否则旧轮可在新轮到达后重新签发项目归属/就绪候选。
   */
  findUserTurn(sessionId: string, turnId: string): { text: string } | null {
    const current = this.live.get(sessionId)?.currentUserTurn;
    if (current?.turnId === turnId && current.text !== "") return { text: current.text };
    return null;
  }

  /** 进程内最近用户句仍在内存(仅 suspend 清空)。sweep voiceBusy 用 LiveDialog.hasUserTurnInFlight,不用本值。 */
  hasCurrentUserTurn(sessionId: string): boolean {
    return this.live.get(sessionId)?.currentUserTurn != null;
  }

  hasAskedProjectAnchorQuestion(sessionId: string): boolean {
    const state = this.state(sessionId);
    return state.projectAnchorQuestionAsked || state.projectAnchorQuestionReserved;
  }

  reserveProjectAnchorQuestion(sessionId: string): boolean {
    const state = this.state(sessionId);
    if (state.projectAnchorQuestionAsked || state.projectAnchorQuestionReserved) return false;
    this.deps.audit.record({
      actor: "daemon",
      action: "dialog.project_anchor_question_reserved",
      meta: { sessionId }
    });
    state.projectAnchorQuestionReserved = true;
    return true;
  }

  settleProjectAnchorQuestion(sessionId: string, enqueued: boolean): void {
    const state = this.state(sessionId);
    if (!state.projectAnchorQuestionReserved) return;
    this.deps.audit.record({
      actor: "daemon",
      action: enqueued
        ? "dialog.project_anchor_question_asked"
        : "dialog.project_anchor_question_enqueue_failed",
      meta: { sessionId }
    });
    state.projectAnchorQuestionReserved = false;
    state.projectAnchorQuestionAsked = enqueued;
  }

  /**
   * AI 轮句子入 pending(同轮多批追加;结算前不进对话史)。
   * opts.touchIdle=false:控制轮路径——不刷新 idle/收尾定时器(v0.4 R3)。
   * opts.trackTranscript=false:不入 pending/JSONL,仅可选写内存史(控制轮默认)。
   */
  onAiSentences(
    sessionId: string,
    sentences: { sentenceId: string; text: string }[],
    opts: { touchIdle?: boolean; trackTranscript?: boolean; origin?: "onboarding" } = {}
  ): void {
    const touchIdle = opts.touchIdle !== false;
    const trackTranscript = opts.trackTranscript !== false;
    const st = this.state(sessionId);
    if (trackTranscript) {
      if (!this.acceptingIdleTimers) {
        this.deps.sessions.appendTurn(sessionId, {
          speaker: "ai",
          text: sentences.map((s) => s.text).join(""),
          ...(opts.origin ? { origin: opts.origin } : {}),
          sentences: sentences.map((s) => ({ ...s, heard: false })),
          engine: "cascade"
        });
        return;
      }
      if (!st.pendingAi) st.pendingAi = [];
      for (const s of sentences) {
        st.pendingAi.push({
          sentenceId: s.sentenceId,
          text: s.text,
          unheard: false,
          ...(opts.origin ? { origin: opts.origin } : {})
        });
      }
    } else {
      // 控制轮:只进内存对话史,不写 JSONL(settlePendingAi 不碰)
      const heardText = sentences.map((s) => s.text).join("");
      if (heardText !== "") {
        st.history.push({ speaker: "ai", text: heardText, ...(opts.origin ? { origin: opts.origin } : {}) });
        if (st.history.length > HISTORY_WINDOW) st.history = st.history.slice(-HISTORY_WINDOW);
      }
    }
    if (touchIdle) this.touchIdle(sessionId);
  }

  /** ④c 测试/观测:最近 idle 刷新时间戳(ms);从未刷新则 null */
  lastIdleTouchAtMs(sessionId: string): number | null {
    return this.live.get(sessionId)?.lastIdleTouchAtMs ?? null;
  }

  /**
   * ④e A6 / K2 根治:取消 idle 收场定时器(不 suspend)。
   * 场景:console peer 全部离线 / 心跳超时——无人在场时不得幽灵 idle-suspend。
   */
  cancelIdle(sessionId: string): void {
    const st = this.live.get(sessionId);
    if (!st?.idleTimer) return;
    clearTimeout(st.idleTimer);
    st.idleTimer = null;
  }

  /** 测试/观测:session 是否仍挂着 idle 定时器 */
  hasIdleTimer(sessionId: string): boolean {
    return this.live.get(sessionId)?.idleTimer != null;
  }

  /** lifecycle drain 后禁止 idle timer 重建，避免 stopped 后仍触发账本写。 */
  prepareShutdown(): void {
    if (!this.acceptingIdleTimers) return;
    this.acceptingIdleTimers = false;
    for (const [sessionId, st] of this.live) {
      if (st.idleTimer) clearTimeout(st.idleTimer);
      st.idleTimer = null;
      for (const sentence of st.pendingAi ?? []) sentence.unheard = true;
      this.settlePendingAi(sessionId);
    }
  }

  /** L5:续推入口设置本会话默认工作线(内存态) */
  setDefaultLane(sessionId: string, laneTitle: string | null): void {
    this.state(sessionId).defaultLaneTitle = laneTitle;
  }

  defaultLaneOf(sessionId: string): string | null {
    return this.live.get(sessionId)?.defaultLaneTitle ?? null;
  }

  /**
   * barge-in:截断句及其后全部句(排队未播)标 unheard(09 §10;P0 句粒度保守——
   * 被截断句整句不作"已告知"依据,关键确认必须重述)。
   */
  onBargeIn(sessionId: string, truncatedSentenceId: string): void {
    const st = this.live.get(sessionId);
    if (!st?.pendingAi) return;
    const idx = st.pendingAi.findIndex((s) => s.sentenceId === truncatedSentenceId);
    if (idx < 0) return; // 晚到/已结算:忽略
    for (let i = idx; i < st.pendingAi.length; i++) (st.pendingAi[i] as PendingAiSentence).unheard = true;
  }

  /** 结算 pending AI 轮:落盘 TranscriptTurn(sentences 带 heard 标),heard 句进对话史 */
  settlePendingAi(sessionId: string): void {
    const st = this.live.get(sessionId);
    if (!st?.pendingAi || st.pendingAi.length === 0) {
      if (st) st.pendingAi = null;
      return;
    }
    const sentences = st.pendingAi.map((s) => ({ sentenceId: s.sentenceId, text: s.text, heard: !s.unheard }));
    this.deps.sessions.appendTurn(sessionId, {
      speaker: "ai",
      text: st.pendingAi.map((s) => s.text).join(""),
      ...(st.pendingAi.every((s) => s.origin === "onboarding") ? { origin: "onboarding" as const } : {}),
      sentences,
      engine: "cascade"
    });
    const heardText = st.pendingAi.filter((s) => !s.unheard).map((s) => s.text).join("");
    if (heardText !== "") {
      const onboarding = st.pendingAi.every((s) => s.origin === "onboarding");
      st.history.push({ speaker: "ai", text: heardText, ...(onboarding ? { origin: "onboarding" as const } : {}) });
    }
    if (st.history.length > HISTORY_WINDOW) st.history = st.history.slice(-HISTORY_WINDOW);
    st.pendingAi = null;
  }

  /** Brain 对话史(unheard 已滤;runDialogTurn 消费) */
  historyOf(sessionId: string): HistoryTurn[] {
    return this.state(sessionId).history;
  }

  /**
   * 空闲/显式挂起(session_idle_suspend_sec;挂起前结算 pending AI 轮)。
   * C1:stage≥1 时 beforeSuspend 先跑收场门——committed 则 session 已终态,不再直转;
   * stage 0 / 无门 / 门返回 false → 旧直转 setState(suspended)。
   */
  suspend(sessionId: string, reason: "idle" | "explicit" = "idle"): void {
    const st = this.live.get(sessionId);
    if (st?.idleTimer) {
      clearTimeout(st.idleTimer);
      st.idleTimer = null;
    }
    const s = getSession(this.deps.db, sessionId);
    if (!s || s.state !== "talking") return;
    if (st) st.currentUserTurn = null;
    this.settlePendingAi(sessionId);
    // C1:收场门优先;true = 已原子转态(或 presented 后由门决定),此处仅在 false 时直转
    if (this.deps.beforeSuspend) {
      const terminalDone = this.deps.beforeSuspend(sessionId, reason);
      if (terminalDone) {
        this.deps.onSuspend?.(sessionId, reason);
        return;
      }
    }
    // 旧直转(stage 0)或门允许随后 suspend(stage1 presented 后)
    const again = getSession(this.deps.db, sessionId);
    if (again && again.state === "talking") {
      this.deps.sessions.setState(sessionId, "suspended");
    }
    this.deps.onSuspend?.(sessionId, reason);
  }

  private touchIdle(sessionId: string): void {
    const st = this.state(sessionId);
    st.lastIdleTouchAtMs = performance.now();
    if (st.idleTimer) clearTimeout(st.idleTimer);
    st.idleTimer = null;
    if (!this.acceptingIdleTimers) return;
    if (this.deps.idleSuspendSec <= 0) return;
    st.idleTimer = setTimeout(() => this.suspend(sessionId), this.deps.idleSuspendSec * 1000);
    st.idleTimer.unref?.();
  }

  private state(sessionId: string): LiveState {
    let st = this.live.get(sessionId);
    if (!st) {
      const lastQuestionState = this.deps.db
        .prepare(
          `SELECT action FROM audit_log
            WHERE action IN (
              'dialog.project_anchor_question_reserved',
              'dialog.project_anchor_question_asked',
              'dialog.project_anchor_question_enqueue_failed'
            )
              AND json_extract(meta_json, '$.sessionId')=?
            ORDER BY rowid DESC
            LIMIT 1`
        )
        .get(sessionId) as { action: string } | undefined;
      // 孤立 reserved 可能位于 enqueue 前或后；没有跨 SQLite/TTS 的原子提交，恢复时以“不重复问”
      // 为硬约束保守阻断。只有明确 enqueue_failed 才重新开放。
      const asked =
        lastQuestionState?.action === "dialog.project_anchor_question_asked" ||
        lastQuestionState?.action === "dialog.project_anchor_question_reserved";
      st = {
        pendingAi: null,
        history: [],
        currentUserTurn: null,
        defaultLaneTitle: null,
        projectAnchorQuestionAsked: asked,
        projectAnchorQuestionReserved: false,
        idleTimer: null,
        lastIdleTouchAtMs: null
      };
      this.live.set(sessionId, st);
    }
    return st;
  }
}
