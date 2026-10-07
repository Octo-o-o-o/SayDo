import type { Writable } from "node:stream";
import { ByteLineFramer, DEFAULT_FRAME_LIMITS, OutboundQueue, asBuffer, encodeLine, type FrameLimits } from "./framing.js";
import {
  type IntentRecord,
  type IntentRecorder,
  type SummaryValue,
  createFileIntentRecorder
} from "./intentLog.js";
import type { StdioLink } from "./link.js";
import { isExperimentPermit, type ExperimentPermit } from "./permit.js";
import {
  acceptOnceDecision,
  buildInitializeParams,
  buildInitializedNotification,
  buildThreadReadParams,
  buildThreadResumeParams,
  buildThreadStartParams,
  buildTurnInterruptParams,
  buildTurnStartParams,
  buildTurnSteerParams,
  classifyMessage,
  commandApprovalParamsSchema,
  declineDecision,
  emptyAnswersResult,
  emptyPermissionsResult,
  fileApprovalParamsSchema,
  idKey,
  initializeResultSchema,
  legacyDeniedDecision,
  legacyExecParamsSchema,
  legacyPatchParamsSchema,
  permissionsParamsSchema,
  redactText,
  threadCarrierSchema,
  turnInterruptResponseSchema,
  turnNoticeSchema,
  turnSchema,
  userInputParamsSchema,
  type RequestId,
  type TurnStatus
} from "./protocol.js";

export interface SendOutcome<T> {
  status: "unsent" | "rejected" | "acked" | "unknown";
  reason: string;
  requestId: string | null;
  value: T | null;
}

export interface InitializeValue {
  userAgent: string;
  platformFamily: string;
  platformOs: string;
  codexHomePresent: boolean;
}

export interface TurnView {
  turnId: string | null;
  phase: "start_pending" | "active" | "interrupt_pending" | "terminal" | "unknown";
  terminalStatus: "completed" | "interrupted" | "failed" | null;
  interruptAcked: boolean;
  interruptConfirmed: boolean;
  upstreamTerminal: boolean;
}

export interface ThreadSnapshot {
  threadId: string;
  generation: number;
  taskId: string;
  turn: TurnView | null;
}

export interface SessionSnapshot {
  phase: "new" | "initializing" | "ready" | "closed";
  generation: number;
  runId: string;
  unknownBlocks: number;
  realTurnFrames: number;
  saydoVerified: false;
  pendingClientIds: string[];
  threads: ThreadSnapshot[];
  timers: number;
}

export interface SessionDiagnostics {
  protocolErrors: number;
  ignoredNotifications: number;
  unknownResponses: number;
  stderrBytes: number;
  stderrRedacted: string;
  warnings: readonly string[];
}

export interface OneShotGrant {
  method: "item/commandExecution/requestApproval" | "item/fileChange/requestApproval";
  threadId: string;
  turnId: string;
  itemId: string;
}

export interface CodexAppServerSession {
  initialize(): Promise<SendOutcome<InitializeValue>>;
  startThread(input: { taskId: string; model?: string; cwd?: string }): Promise<SendOutcome<{ threadId: string }>>;
  readThread(input: { taskId: string; threadId: string }): Promise<SendOutcome<{ threadId: string }>>;
  resumeThread(input: { taskId: string; threadId: string }): Promise<SendOutcome<{ threadId: string }>>;
  startTurn(input: { taskId: string; threadId: string; text: string }): Promise<SendOutcome<TurnView>>;
  steerTurn(input: { taskId: string; threadId: string; expectedTurnId: string; text: string }): Promise<SendOutcome<{ turnId: string }>>;
  interruptTurn(input: { taskId: string; threadId: string; turnId: string }): Promise<SendOutcome<TurnView>>;
  retryLast(): SendOutcome<null>;
  snapshot(): SessionSnapshot;
  diagnostics(): SessionDiagnostics;
  shutdown(): Promise<{ sigkill: boolean; exitCode: number | null; signal: NodeJS.Signals | null } | null>;
}

interface LiveTurn extends TurnView {
  requestId: string;
  taskId: string;
  unknown: boolean;
}

interface OwnedThread {
  threadId: string;
  generation: number;
  taskId: string;
  liveTurn: LiveTurn | null;
  closedTurnIds: Set<string>;
}

interface ClientPending {
  requestId: string;
  method: string;
  isWritten: () => boolean;
  isSettled: () => boolean;
  onTimeout: () => void;
  finishUnknown: (reason: string) => void;
  finishUnsent: (reason: string) => void;
  finishRejected: (reason: string) => void;
  finishAck: (result: unknown) => void;
}

type Summary = Record<string, SummaryValue>;

function unsent<T>(reason: string): SendOutcome<T> {
  return { status: "unsent", reason, requestId: null, value: null };
}

function viewOf(turn: LiveTurn | null): TurnView | null {
  if (!turn) return null;
  return {
    turnId: turn.turnId,
    phase: turn.phase,
    terminalStatus: turn.terminalStatus,
    interruptAcked: turn.interruptAcked,
    interruptConfirmed: turn.interruptConfirmed,
    upstreamTerminal: turn.upstreamTerminal
  };
}

class AppServerSession implements CodexAppServerSession {
  private readonly framer: ByteLineFramer;
  private readonly outbound: OutboundQueue;
  private readonly threads = new Map<string, OwnedThread>();
  private readonly clientPending = new Map<string, ClientPending>();
  private readonly serverIds = new Set<string>();
  private readonly answeredItems = new Set<string>();
  private readonly unknownTokens = new Set<string>();
  private readonly warnings: string[] = [];
  private phase: SessionSnapshot["phase"] = "new";
  private generation = 1;
  private disposed = false;
  private nextId = 1;
  private realTurnFrames = 0;
  private reservedTurnSlots = 0;
  private protocolErrors = 0;
  private ignoredNotifications = 0;
  private unknownResponses = 0;
  private stderrBytes = 0;
  private stderrBuf = Buffer.alloc(0);
  private readonly onData = (chunk: Buffer | string): void => {
    this.ingest(asBuffer(chunk));
  };
  private readonly onStderr = (chunk: Buffer | string): void => {
    const buf = asBuffer(chunk);
    this.stderrBytes += buf.length;
    if (this.stderrBuf.length < 8192) {
      this.stderrBuf = Buffer.concat([this.stderrBuf, buf]).subarray(0, 8192);
    }
  };
  private readonly onEnd = (): void => {
    this.onLinkClosed("eof");
  };
  private readonly onClose = (): void => {
    this.onLinkClosed("close");
  };
  private readonly onErr = (): void => {
    this.onLinkClosed("stream_error");
  };

  constructor(
    private readonly link: StdioLink,
    private readonly recorder: IntentRecorder,
    private readonly runId: string,
    private readonly mode: "fixture" | "real",
    private readonly permit: ExperimentPermit | null,
    private readonly grants: OneShotGrant[],
    private readonly requestTimeoutMs: number,
    private readonly now: () => number,
    private readonly termMs: number,
    private readonly limits: FrameLimits
  ) {
    this.framer = new ByteLineFramer(limits);
    this.outbound = new OutboundQueue(sinkFromWritable(link.stdin), limits.maxQueued, limits.maxLineBytes, () => {
      this.onLinkClosed("stdin_write_threw");
    });
    link.stdout.on("data", this.onData);
    link.stdout.on("end", this.onEnd);
    link.stdout.on("close", this.onClose);
    link.stdout.on("error", this.onErr);
    link.stdin.on("error", this.onErr);
    link.stderr?.on("data", this.onStderr);
    link.stderr?.on("error", this.onErr);
    link.onExit?.(() => {
      this.onLinkClosed("process_exit");
    });
    this.armExperimentDeadline();
  }

  async initialize(): Promise<SendOutcome<InitializeValue>> {
    if (this.disposed) return unsent("link_closed");
    if (this.phase !== "new") return unsent("duplicate_initialize");
    this.phase = "initializing";
    let initializedWrite: Promise<boolean> = Promise.resolve(false);
    const outcome = await this.sendClient<InitializeValue>({
      method: "initialize",
      params: buildInitializeParams(),
      taskId: null,
      threadId: null,
      turnId: null,
      summary: { client: "saydo-codex-as-spike" },
      onAck: (result) => {
        const parsed = initializeResultSchema.safeParse(result);
        if (!parsed.success) {
          return { status: "rejected", reason: "protocol_error", value: null };
        }
        const noted = this.record({
          requestId: null,
          method: "initialized",
          taskId: null,
          threadId: null,
          turnId: null,
          summary: { notice: true },
          delivery: "intent",
          reason: null
        });
        if (!this.persist(noted)) {
          return { status: "rejected", reason: "intent_persist_failed", value: null };
        }
        initializedWrite = this.writeInitialized();
        return {
          status: "acked",
          reason: "ok",
          value: {
            userAgent: parsed.data.userAgent,
            platformFamily: parsed.data.platformFamily,
            platformOs: parsed.data.platformOs,
            codexHomePresent: true
          }
        };
      }
    });
    if (outcome.status === "acked" && !(await initializedWrite)) {
      return { ...outcome, status: "rejected", reason: "initialized_not_sent", value: null };
    }
    if (outcome.status === "unsent" && this.phase === "initializing") this.phase = "new";
    return outcome;
  }

  private writeInitialized(): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (written: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.timerCount -= 1;
        if (written && !this.disposed) this.phase = "ready";
        resolve(written && !this.disposed);
      };
      this.timerCount += 1;
      const timer = setTimeout(() => {
        finish(false);
        this.onLinkClosed("initialized_write_timeout");
      }, this.requestTimeoutMs);
      const accepted = this.enqueueEncoded(buildInitializedNotification(), {
        onWritten: () => finish(true),
        onDropped: () => finish(false)
      });
      if (accepted !== "accepted") finish(false);
    });
  }

  startThread(input: { taskId: string; model?: string; cwd?: string }): Promise<SendOutcome<{ threadId: string }>> {
    const blocked = this.gateEffect(input.taskId);
    if (blocked) return Promise.resolve(blocked);
    const model = this.mode === "real" ? this.permit?.model : input.model;
    const params = buildThreadStartParams({
      ...(model !== undefined ? { model } : {}),
      ...(input.cwd !== undefined ? { cwd: input.cwd } : {})
    });
    let requestId = "";
    return this.sendClient({
      method: "thread/start",
      params,
      taskId: input.taskId,
      threadId: null,
      turnId: null,
      summary: { modelChars: model?.length ?? 0, ephemeral: true },
      beforeWrite: (id) => {
        requestId = id;
      },
      onTimeout: (id) => {
        this.unknownTokens.add(`req:${id}`);
      },
      onAck: (result) => {
        const adopted = this.adoptThreadAck(result, input.taskId);
        if (adopted.status === "rejected" && adopted.reason === "protocol_error") {
          this.unknownTokens.add(`req:${requestId}`);
          return { status: "unknown", reason: "protocol_error", value: null };
        }
        return adopted;
      }
    });
  }

  readThread(input: { taskId: string; threadId: string }): Promise<SendOutcome<{ threadId: string }>> {
    const blocked = this.gateRead(input.taskId);
    if (blocked) return Promise.resolve(blocked);
    const found = this.threadFor(input.threadId, input.taskId);
    if (!found.ok) return Promise.resolve(unsent(found.reason));
    return this.sendClient({
      method: "thread/read",
      params: buildThreadReadParams(input.threadId),
      taskId: input.taskId,
      threadId: input.threadId,
      turnId: null,
      summary: { includeTurns: false },
      onAck: (result) => this.sameThreadAck(result, input.threadId)
    });
  }

  resumeThread(input: { taskId: string; threadId: string }): Promise<SendOutcome<{ threadId: string }>> {
    const blocked = this.gateEffect(input.taskId);
    if (blocked) return Promise.resolve(blocked);
    const found = this.threadFor(input.threadId, input.taskId);
    if (!found.ok) return Promise.resolve(unsent(found.reason));
    let requestId = "";
    return this.sendClient({
      method: "thread/resume",
      params: buildThreadResumeParams(input.threadId),
      taskId: input.taskId,
      threadId: input.threadId,
      turnId: null,
      summary: { excludeTurns: true },
      beforeWrite: (id) => {
        requestId = id;
      },
      onTimeout: (id) => {
        this.unknownTokens.add(`req:${id}`);
      },
      onAck: (result) => {
        const adopted = this.sameThreadAck(result, input.threadId);
        if (adopted.status === "rejected") {
          this.unknownTokens.add(`req:${requestId}`);
          return { status: "unknown", reason: adopted.reason, value: null };
        }
        return adopted;
      }
    });
  }

  startTurn(input: { taskId: string; threadId: string; text: string }): Promise<SendOutcome<TurnView>> {
    const blocked = this.gateEffect(input.taskId);
    if (blocked) return Promise.resolve(blocked);
    const found = this.threadFor(input.threadId, input.taskId);
    if (!found.ok) return Promise.resolve(unsent(found.reason));
    const thread = found.thread;
    if (thread.liveTurn && thread.liveTurn.phase !== "terminal") return Promise.resolve(unsent("turn_busy"));
    const slot = this.mode === "real" ? this.holdTurnSlot() : null;
    if (this.mode === "real" && slot === null) return Promise.resolve(unsent("experiment_budget"));
    const model = this.mode === "real" ? this.permit?.model : undefined;
    let requestId = "";
    return this.sendClient({
      method: "turn/start",
      params: buildTurnStartParams({
        threadId: input.threadId,
        text: input.text,
        ...(model !== undefined ? { model } : {})
      }),
      taskId: input.taskId,
      threadId: input.threadId,
      turnId: null,
      summary: { inputCount: 1, textChars: input.text.length },
      beforeWrite: (id) => {
        requestId = id;
        if (thread.liveTurn?.turnId) thread.closedTurnIds.add(thread.liveTurn.turnId);
        thread.liveTurn = freshTurn(id, input.taskId);
      },
      rollback: () => {
        slot?.release();
        if (thread.liveTurn?.requestId === requestId && thread.liveTurn.phase === "start_pending" && thread.liveTurn.turnId === null) {
          thread.liveTurn = null;
        }
      },
      releaseReservation: () => {
        slot?.release();
      },
      commitReservation: () => {
        slot?.commit();
      },
      onTimeout: () => {
        const live = thread.liveTurn;
        if (live && live.requestId === requestId) this.markUnknown(thread, live);
      },
      onError: () => {
        const live = thread.liveTurn;
        if (!live || live.requestId !== requestId || live.phase === "terminal") return;
        if (live.turnId) this.markUnknown(thread, live);
        else thread.liveTurn = null;
      },
      onAck: (result) => {
        const carrier = typeof result === "object" && result !== null ? turnSchema.safeParse((result as { turn?: unknown }).turn) : null;
        if (!carrier?.success) {
          const live = thread.liveTurn;
          // 只绑尚未终态的同一次 start。终态或换轮后仍返回 protocol_error，不再追加清不掉的 turn token。
          if (live?.requestId === requestId && live.phase !== "terminal") this.markUnknown(thread, live);
          return { status: "unknown", reason: "protocol_error", value: null };
        }
        const adopted = this.adoptStartAck(thread, requestId, carrier.data);
        const live = thread.liveTurn;
        if (adopted === "conflict") {
          return { status: "unknown", reason: "ack_conflict", value: viewOf(live) };
        }
        return { status: "acked", reason: "ok", value: viewOf(live) };
      }
    });
  }

  steerTurn(input: { taskId: string; threadId: string; expectedTurnId: string; text: string }): Promise<SendOutcome<{ turnId: string }>> {
    const blocked = this.gateEffect(input.taskId);
    if (blocked) return Promise.resolve(blocked);
    const found = this.threadFor(input.threadId, input.taskId);
    if (!found.ok) return Promise.resolve(unsent(found.reason));
    const thread = found.thread;
    const live = thread.liveTurn;
    if (!live?.turnId) return Promise.resolve(unsent("turn_unbound"));
    if (live.phase !== "active") return Promise.resolve(unsent("turn_not_active"));
    if (input.expectedTurnId !== live.turnId) return Promise.resolve(unsent("turn_mismatch"));
    const boundRequestId = live.requestId;
    const boundTurnId = live.turnId;
    return this.sendClient({
      method: "turn/steer",
      params: buildTurnSteerParams(input),
      taskId: input.taskId,
      threadId: input.threadId,
      turnId: input.expectedTurnId,
      summary: { inputCount: 1, textChars: input.text.length },
      onTimeout: () => {
        this.keepBoundTurnUnknown(thread, boundRequestId, boundTurnId);
      },
      onAck: (result) => {
        const parsed = turnIdResult(result);
        if (!parsed || parsed !== boundTurnId) {
          this.keepBoundTurnUnknown(thread, boundRequestId, boundTurnId);
          return { status: "unknown", reason: parsed ? "ack_conflict" : "protocol_error", value: null };
        }
        return { status: "acked", reason: "ok", value: { turnId: boundTurnId } };
      }
    });
  }

  interruptTurn(input: { taskId: string; threadId: string; turnId: string }): Promise<SendOutcome<TurnView>> {
    const blocked = this.gateEffect(input.taskId);
    if (blocked) return Promise.resolve(blocked);
    const found = this.threadFor(input.threadId, input.taskId);
    if (!found.ok) return Promise.resolve(unsent(found.reason));
    const thread = found.thread;
    const live = thread.liveTurn;
    if (!live?.turnId) return Promise.resolve(unsent("turn_unbound"));
    if (live.phase === "terminal" || live.phase === "unknown") return Promise.resolve(unsent("turn_not_active"));
    if (live.phase === "interrupt_pending") return Promise.resolve(unsent("interrupt_pending"));
    if (input.turnId !== live.turnId) return Promise.resolve(unsent("turn_mismatch"));
    const previous = live.phase;
    return this.sendClient({
      method: "turn/interrupt",
      params: buildTurnInterruptParams(input.threadId, input.turnId),
      taskId: input.taskId,
      threadId: input.threadId,
      turnId: input.turnId,
      summary: { interrupt: true },
      beforeWrite: () => {
        if (live.phase !== "terminal" && live.phase !== "unknown") live.phase = "interrupt_pending";
      },
      rollback: () => {
        if (live.phase === "interrupt_pending" && !live.interruptAcked && !live.upstreamTerminal) live.phase = previous;
      },
      onTimeout: () => {
        if (live.phase !== "terminal") this.markUnknown(thread, live);
      },
      onError: () => {
        if (live.phase === "interrupt_pending" && !live.upstreamTerminal) live.phase = previous === "start_pending" ? "active" : previous;
      },
      onAck: (result) => {
        if (!turnInterruptResponseSchema.safeParse(result).success) {
          this.noteMalformedInterrupt(thread, live, input.turnId);
          return { status: "unknown", reason: "protocol_error", value: null };
        }
        if (live.phase !== "terminal" && live.phase !== "unknown") {
          live.interruptAcked = true;
          live.phase = "interrupt_pending";
        }
        return { status: "acked", reason: "interrupt_ack", value: viewOf(live) };
      }
    });
  }

  retryLast(): SendOutcome<null> {
    return unsent("retry_refused");
  }

  snapshot(): SessionSnapshot {
    return {
      phase: this.phase,
      generation: this.generation,
      runId: this.runId,
      unknownBlocks: this.unknownTokens.size,
      realTurnFrames: this.realTurnFrames,
      saydoVerified: false,
      pendingClientIds: [...this.clientPending.keys()],
      threads: [...this.threads.values()].map((thread) => ({
        threadId: thread.threadId,
        generation: thread.generation,
        taskId: thread.taskId,
        turn: viewOf(thread.liveTurn)
      })),
      timers: this.timerCount
    };
  }

  diagnostics(): SessionDiagnostics {
    return {
      protocolErrors: this.protocolErrors,
      ignoredNotifications: this.ignoredNotifications,
      unknownResponses: this.unknownResponses,
      stderrBytes: this.stderrBytes,
      stderrRedacted: redactText(this.stderrBuf.toString("utf8")),
      warnings: this.warnings
    };
  }

  async shutdown(): Promise<{ sigkill: boolean; exitCode: number | null; signal: NodeJS.Signals | null } | null> {
    const nested = this.settlingKill;
    this.onLinkClosed("shutdown");
    if (nested) return this.childResult;
    this.killChild();
    if (this.killPromise) await this.killPromise;
    return this.childResult;
  }

  private timerCount = 0;
  private terminated = false;
  private childResult: { sigkill: boolean; exitCode: number | null; signal: NodeJS.Signals | null } | null = null;
  private deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private killPromise: Promise<void> | null = null;
  private settlingKill = false;

  private gateEffect(taskId: string): SendOutcome<never> | null {
    if (this.disposed || this.phase === "closed") return unsent("link_closed");
    if (this.phase !== "ready") return unsent("not_ready");
    if (taskId.trim() === "") return unsent("task_required");
    if (this.mode === "real") {
      if (!this.permit) return unsent("experiment_disabled");
      if (this.now() >= this.permit.deadlineMs) return unsent("experiment_deadline");
    }
    if (this.unknownTokens.size > 0) return unsent("unknown_blocks");
    return null;
  }

  private gateRead(taskId: string): SendOutcome<never> | null {
    if (this.disposed || this.phase === "closed") return unsent("link_closed");
    if (this.phase !== "ready") return unsent("not_ready");
    if (taskId.trim() === "") return unsent("task_required");
    if (this.mode === "real" && !this.permit) return unsent("experiment_disabled");
    return null;
  }

  private owned(threadId: string): OwnedThread | null {
    const thread = this.threads.get(threadId);
    if (!thread || thread.generation !== this.generation) return null;
    return thread;
  }

  private threadFor(threadId: string, taskId: string): { ok: true; thread: OwnedThread } | { ok: false; reason: "not_owned" | "task_mismatch" } {
    const thread = this.owned(threadId);
    if (!thread) return { ok: false, reason: "not_owned" };
    if (thread.taskId !== taskId) return { ok: false, reason: "task_mismatch" };
    return { ok: true, thread };
  }

  private sendClient<T>(spec: {
    method: string;
    params: unknown;
    taskId: string | null;
    threadId: string | null;
    turnId: string | null;
    summary: Summary;
    beforeWrite?: (requestId: string) => void;
    rollback?: () => void;
    onWritten?: () => void;
    releaseReservation?: () => void;
    commitReservation?: () => void;
    onTimeout?: (requestId: string) => void;
    onError?: () => void;
    onAck: (result: unknown) => { status: "acked" | "rejected" | "unknown"; reason: string; value: T | null };
  }): Promise<SendOutcome<T>> {
    if (this.disposed) {
      spec.releaseReservation?.();
      return Promise.resolve(unsent("link_closed"));
    }
    if (this.clientPending.size >= this.limits.maxPending) {
      spec.releaseReservation?.();
      return Promise.resolve(unsent("pending_full"));
    }
    const requestId = `c${this.nextId}`;
    this.nextId += 1;
    const intent = this.record({
      requestId,
      method: spec.method,
      taskId: spec.taskId,
      threadId: spec.threadId,
      turnId: spec.turnId,
      summary: spec.summary,
      delivery: "intent",
      reason: null
    });
    if (!this.persist(intent)) {
      spec.releaseReservation?.();
      return Promise.resolve(unsent("intent_persist_failed"));
    }
    spec.beforeWrite?.(requestId);
    let written = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let resolvePromise: (value: SendOutcome<T>) => void = () => undefined;
    const promise = new Promise<SendOutcome<T>>((resolve) => {
      resolvePromise = resolve;
    });
    const finish = (outcome: SendOutcome<T>, delivery: IntentRecord["delivery"]) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
        this.timerCount = Math.max(0, this.timerCount - 1);
      }
      this.clientPending.delete(idKey(requestId));
      if (delivery === "unsent") spec.releaseReservation?.();
      this.persist(this.record({
        requestId,
        method: spec.method,
        taskId: spec.taskId,
        threadId: spec.threadId,
        turnId: spec.turnId,
        summary: spec.summary,
        delivery,
        reason: outcome.reason
      }));
      resolvePromise(outcome);
    };
    const pending: ClientPending = {
      requestId,
      method: spec.method,
      isWritten: () => written,
      isSettled: () => settled,
      onTimeout: () => {
        spec.onTimeout?.(requestId);
      },
      finishUnknown: (reason) => {
        finish({ status: "unknown", reason, requestId, value: null }, "unknown");
      },
      finishUnsent: (reason) => {
        finish({ status: "unsent", reason, requestId, value: null }, "unsent");
      },
      finishRejected: (reason) => {
        spec.onError?.();
        finish({ status: "rejected", reason, requestId, value: null }, "rejected");
      },
      finishAck: (result) => {
        const applied = spec.onAck(result);
        const delivery = applied.status === "acked" ? "acked" : applied.status === "unknown" ? "unknown" : "rejected";
        finish(
          { status: applied.status, reason: applied.reason, requestId, value: applied.value },
          delivery
        );
      }
    };
    this.clientPending.set(idKey(requestId), pending);
    let bytes: Buffer;
    try {
      bytes = encodeLine({ id: requestId, method: spec.method, params: spec.params }, this.limits.maxLineBytes);
    } catch {
      spec.rollback?.();
      finish({ status: "unsent", reason: "line_too_long", requestId, value: null }, "unsent");
      return promise;
    }
    let cancelQueued = (): boolean => false;
    const queued = this.outbound.enqueue(bytes, {
      onQueued: (cancel) => {
        cancelQueued = cancel;
      },
      onWritten: () => {
        written = true;
        spec.commitReservation?.();
        spec.onWritten?.();
      },
      onDropped: () => {
        if (written || settled) return;
        spec.rollback?.();
        finish({ status: "unsent", reason: "not_written", requestId, value: null }, "unsent");
      }
    });
    if (queued !== "accepted" && !settled) {
      spec.rollback?.();
      finish({ status: "unsent", reason: queued === "closed" ? "link_closed" : "outbound_full", requestId, value: null }, "unsent");
    }
    if (queued === "accepted" && !settled && !this.disposed) {
      this.timerCount += 1;
      timer = setTimeout(() => {
        timer = null;
        this.timerCount = Math.max(0, this.timerCount - 1);
        if (settled) return;
        if (!written) {
          cancelQueued();
          if (!written) {
            spec.rollback?.();
            finish({ status: "unsent", reason: "deadline", requestId, value: null }, "unsent");
            return;
          }
        }
        spec.onTimeout?.(requestId);
        finish({ status: "unknown", reason: "timeout", requestId, value: null }, "unknown");
      }, this.requestTimeoutMs);
    }
    return promise;
  }

  private adoptThreadAck(result: unknown, taskId: string): { status: "acked" | "rejected"; reason: string; value: { threadId: string } | null } {
    const parsed = threadCarrierSchema.safeParse(result);
    if (!parsed.success) return { status: "rejected", reason: "protocol_error", value: null };
    const threadId = parsed.data.thread.id;
    const existing = this.threads.get(threadId);
    if (existing && existing.generation !== this.generation) {
      return { status: "rejected", reason: "stale_generation", value: null };
    }
    if (!existing) {
      this.threads.set(threadId, {
        threadId,
        generation: this.generation,
        taskId,
        liveTurn: null,
        closedTurnIds: new Set()
      });
    }
    return { status: "acked", reason: "ok", value: { threadId } };
  }

  private sameThreadAck(result: unknown, threadId: string): { status: "acked" | "rejected"; reason: string; value: { threadId: string } | null } {
    const parsed = threadCarrierSchema.safeParse(result);
    if (!parsed.success) return { status: "rejected", reason: "protocol_error", value: null };
    if (parsed.data.thread.id !== threadId) return { status: "rejected", reason: "ack_conflict", value: null };
    return { status: "acked", reason: "ok", value: { threadId } };
  }

  /** 回包不能把已经终态或 unknown 的轮次恢复成 active。 */
  private adoptStartAck(thread: OwnedThread, requestId: string, turn: { id: string; status: TurnStatus }): "ok" | "conflict" | "ignored" {
    const live = thread.liveTurn;
    if (!live || live.requestId !== requestId) return "ignored";
    if (live.phase === "terminal" || live.phase === "unknown") return "ok";
    if (live.turnId && live.turnId !== turn.id) {
      this.markUnknown(thread, live);
      return "conflict";
    }
    live.turnId = turn.id;
    if (turn.status === "completed" || turn.status === "interrupted" || turn.status === "failed") {
      this.noteTerminal(thread, live, turn.status);
      return "ok";
    }
    if (live.phase === "start_pending") live.phase = "active";
    return "ok";
  }

  /** 畸形 interrupt ACK 只绑发送时的那一轮。终态或新轮不改，也不加全局阻断。 */
  private noteMalformedInterrupt(thread: OwnedThread, live: LiveTurn, turnId: string): void {
    const current = thread.liveTurn;
    if (current !== live || current.turnId !== turnId) return;
    if (current.phase === "terminal" || current.phase === "unknown") return;
    this.markUnknown(thread, current);
  }

  /** 超时或畸形 ACK 只绑当时那一轮。终态、unknown 或已经换轮时不改当前轮，也不加 req 阻断。 */
  private keepBoundTurnUnknown(thread: OwnedThread, requestId: string, turnId: string): boolean {
    const current = thread.liveTurn;
    if (!current || current.requestId !== requestId || current.turnId !== turnId) return false;
    if (current.phase === "terminal" || current.phase === "unknown") return false;
    this.markUnknown(thread, current);
    return true;
  }

  private markUnknown(thread: OwnedThread, live: LiveTurn): void {
    if (live.phase === "terminal" || live.phase === "unknown") return;
    live.phase = "unknown";
    live.unknown = true;
    this.unknownTokens.add(`turn:${thread.threadId}:${live.requestId}`);
  }

  private noteTerminal(thread: OwnedThread, live: LiveTurn, status: "completed" | "interrupted" | "failed"): void {
    if (live.phase === "terminal") return;
    live.phase = "terminal";
    live.terminalStatus = status;
    live.upstreamTerminal = true;
    live.unknown = false;
    if (status === "interrupted") live.interruptConfirmed = true;
    if (live.turnId) thread.closedTurnIds.add(live.turnId);
    this.unknownTokens.delete(`turn:${thread.threadId}:${live.requestId}`);
  }

  private ingest(chunk: Buffer): void {
    if (this.disposed) return;
    const batch = this.framer.push(chunk);
    for (const error of batch.errors) {
      this.protocolErrors += 1;
      this.pushWarning(`frame:${error.code}`);
    }
    for (const message of batch.messages) this.onMessage(message);
  }

  private onMessage(value: unknown): void {
    if (this.disposed) return;
    const message = classifyMessage(value);
    if (message.kind === "malformed") {
      this.protocolErrors += 1;
      this.pushWarning("frame:malformed_message");
      return;
    }
    if (message.kind === "response") {
      const pending = this.clientPending.get(idKey(message.id));
      if (!pending) {
        this.unknownResponses += 1;
        this.pushWarning("unknown_response");
        return;
      }
      pending.finishAck(message.result);
      return;
    }
    if (message.kind === "error") {
      const pending = this.clientPending.get(idKey(message.id));
      if (!pending) {
        this.unknownResponses += 1;
        this.pushWarning("unknown_error_response");
        return;
      }
      pending.finishRejected("rpc_error");
      return;
    }
    if (message.kind === "notification") {
      this.onNotification(message.method, message.params);
      return;
    }
    this.handleServerRequest(message.id, message.method, message.params);
  }

  private onNotification(method: string, params: unknown): void {
    if (method === "thread/started") {
      const parsed = threadCarrierSchema.safeParse(params);
      if (!parsed.success) this.protocolErrors += 1;
      return;
    }
    if (method === "turn/started" || method === "turn/completed") {
      const parsed = turnNoticeSchema.safeParse(params);
      if (!parsed.success) {
        this.protocolErrors += 1;
        return;
      }
      const thread = this.owned(parsed.data.threadId);
      const live = thread?.liveTurn ?? null;
      if (!thread || !live) return;
      if (thread.closedTurnIds.has(parsed.data.turn.id) && live.turnId !== parsed.data.turn.id) return;
      if (live.turnId && live.turnId !== parsed.data.turn.id) return;
      if (!live.turnId) live.turnId = parsed.data.turn.id;
      if (method === "turn/completed") {
        if (parsed.data.turn.status === "inProgress") return;
        this.noteTerminal(thread, live, parsed.data.turn.status);
        return;
      }
      if (live.phase === "terminal" || live.phase === "unknown") return;
      if (live.phase === "start_pending") live.phase = "active";
      return;
    }
    this.ignoredNotifications += 1;
    this.pushWarning("ignored_notification");
  }

  private handleServerRequest(id: RequestId, method: string, params: unknown): void {
    const key = idKey(id);
    if (this.serverIds.has(key)) {
      this.sendServerError(id, method, -32600, "duplicate request", null, null);
      return;
    }
    this.serverIds.add(key);
    if (method === "item/commandExecution/requestApproval" || method === "item/fileChange/requestApproval") {
      this.handleItemApproval(id, method, params);
      return;
    }
    if (method === "item/permissions/requestApproval") {
      this.handlePermissions(id, method, params);
      return;
    }
    if (method === "item/tool/requestUserInput") {
      this.handleUserInput(id, method, params);
      return;
    }
    if (method === "execCommandApproval" || method === "applyPatchApproval") {
      this.handleLegacy(id, method, params);
      return;
    }
    this.sendServerError(id, method, -32601, "method not supported", null, null);
  }

  private handleItemApproval(id: RequestId, method: OneShotGrant["method"], params: unknown): void {
    const parsed = method === "item/commandExecution/requestApproval"
      ? commandApprovalParamsSchema.safeParse(params)
      : fileApprovalParamsSchema.safeParse(params);
    if (!parsed.success) {
      this.sendServerError(id, method, -32602, "request rejected", null, null);
      return;
    }
    const binding = parsed.data;
    if (!this.claimItem(method, binding.threadId, binding.turnId, binding.itemId)) {
      this.sendServerError(id, method, -32600, "duplicate request", binding.threadId, binding.turnId);
      return;
    }
    if (!this.turnIsBindable(binding.threadId, binding.turnId)) {
      this.sendServerError(id, method, -32602, "request rejected", binding.threadId, binding.turnId);
      return;
    }
    const grantIndex = this.grants.findIndex((grant) =>
      grant.method === method && grant.threadId === binding.threadId && grant.turnId === binding.turnId && grant.itemId === binding.itemId
    );
    if (grantIndex >= 0) {
      const [grant] = this.grants.splice(grantIndex, 1);
      const sent = this.sendServerResult(id, method, acceptOnceDecision(), { decision: "accept", once: true }, binding.threadId, binding.turnId);
      if (!sent && grant) this.grants.splice(grantIndex, 0, grant);
      return;
    }
    this.sendServerResult(id, method, declineDecision(), { decision: "decline" }, binding.threadId, binding.turnId);
  }

  private handlePermissions(id: RequestId, method: string, params: unknown): void {
    const parsed = permissionsParamsSchema.safeParse(params);
    if (!parsed.success) {
      this.sendServerError(id, method, -32602, "request rejected", null, null);
      return;
    }
    const binding = parsed.data;
    if (!this.claimItem(method, binding.threadId, binding.turnId, binding.itemId)) {
      this.sendServerError(id, method, -32600, "duplicate request", binding.threadId, binding.turnId);
      return;
    }
    if (!this.turnIsBindable(binding.threadId, binding.turnId)) {
      this.sendServerError(id, method, -32602, "request rejected", binding.threadId, binding.turnId);
      return;
    }
    this.sendServerResult(id, method, emptyPermissionsResult(), { decision: "empty-permissions" }, binding.threadId, binding.turnId);
  }

  private handleUserInput(id: RequestId, method: string, params: unknown): void {
    const parsed = userInputParamsSchema.safeParse(params);
    if (!parsed.success) {
      this.sendServerError(id, method, -32602, "request rejected", null, null);
      return;
    }
    const binding = parsed.data;
    if (!this.claimItem(method, binding.threadId, binding.turnId, binding.itemId)) {
      this.sendServerError(id, method, -32600, "duplicate request", binding.threadId, binding.turnId);
      return;
    }
    if (!this.turnIsBindable(binding.threadId, binding.turnId)) {
      this.sendServerError(id, method, -32602, "request rejected", binding.threadId, binding.turnId);
      return;
    }
    this.sendServerResult(
      id,
      method,
      emptyAnswersResult(),
      { decision: "empty-answers", questionCount: binding.questions.length },
      binding.threadId,
      binding.turnId
    );
  }

  private handleLegacy(id: RequestId, method: string, params: unknown): void {
    const parsed = method === "execCommandApproval" ? legacyExecParamsSchema.safeParse(params) : legacyPatchParamsSchema.safeParse(params);
    if (!parsed.success) {
      this.sendServerError(id, method, -32602, "request rejected", null, null);
      return;
    }
    const conversationId = parsed.data.conversationId;
    const callId = parsed.data.callId;
    if (!this.claimItem(method, conversationId, "-", callId)) {
      this.sendServerError(id, method, -32600, "duplicate request", conversationId, null);
      return;
    }
    const thread = this.owned(conversationId);
    const live = thread?.liveTurn ?? null;
    if (!thread || !live?.turnId || live.phase === "terminal" || live.phase === "unknown") {
      this.sendServerError(id, method, -32602, "request rejected", conversationId, live?.turnId ?? null);
      return;
    }
    this.sendServerResult(id, method, legacyDeniedDecision(), { decision: "denied" }, conversationId, live.turnId);
  }

  private claimItem(method: string, threadId: string, turnId: string, itemId: string): boolean {
    const key = `${method}\0${threadId}\0${turnId}\0${itemId}`;
    if (this.answeredItems.has(key)) return false;
    this.answeredItems.add(key);
    return true;
  }

  private turnIsBindable(threadId: string, turnId: string): boolean {
    const thread = this.owned(threadId);
    const live = thread?.liveTurn ?? null;
    if (!thread || !live?.turnId || live.turnId !== turnId) return false;
    return live.phase === "active" || live.phase === "interrupt_pending" || live.phase === "start_pending";
  }

  private sendServerResult(id: RequestId, method: string, result: unknown, summary: Summary, threadId: string | null, turnId: string | null): boolean {
    const intent = this.record({
      requestId: idKey(id),
      method,
      taskId: null,
      threadId,
      turnId,
      summary,
      delivery: "intent",
      reason: null
    });
    if (!this.persist(intent)) return false;
    const queued = this.enqueueEncoded({ id, result }, {
      onWritten: () => {
        this.persist(this.record({
          requestId: idKey(id),
          method,
          taskId: null,
          threadId,
          turnId,
          summary,
          delivery: "written",
          reason: null
        }));
      },
      onDropped: () => {
        this.persist(this.record({
          requestId: idKey(id),
          method,
          taskId: null,
          threadId,
          turnId,
          summary,
          delivery: "unsent",
          reason: "not_written"
        }));
      }
    });
    return queued === "accepted";
  }

  private sendServerError(id: RequestId, method: string, code: number, message: string, threadId: string | null, turnId: string | null): void {
    const summary: Summary = { decision: "error", code };
    const knownMethod = [
      "item/commandExecution/requestApproval", "item/fileChange/requestApproval",
      "item/permissions/requestApproval", "item/tool/requestUserInput",
      "execCommandApproval", "applyPatchApproval"
    ].includes(method);
    const intent = this.record({
      requestId: idKey(id),
      method: knownMethod ? method : "unknown_server_method",
      taskId: null,
      threadId,
      turnId,
      summary,
      delivery: "intent",
      reason: message
    });
    if (!this.persist(intent)) return;
    this.enqueueEncoded({ id, error: { code, message } }, {
      onWritten: () => undefined,
      onDropped: () => undefined
    });
  }

  private enqueueEncoded(value: unknown, hooks: { onWritten: () => void; onDropped: () => void }): "accepted" | "full" | "closed" | "too_big" {
    try {
      return this.outbound.enqueue(encodeLine(value, this.limits.maxLineBytes), hooks);
    } catch {
      hooks.onDropped();
      return "too_big";
    }
  }

  private record(input: {
    requestId: string | null;
    method: string;
    taskId: string | null;
    threadId: string | null;
    turnId: string | null;
    summary: Summary;
    delivery: IntentRecord["delivery"];
    reason: string | null;
  }): IntentRecord {
    return {
      at: new Date(this.now()).toISOString(),
      runId: this.runId,
      generation: this.generation,
      taskId: input.taskId,
      requestId: input.requestId,
      method: input.method,
      threadId: input.threadId,
      turnId: input.turnId,
      summary: input.summary,
      delivery: input.delivery,
      reason: input.reason
    };
  }

  private persist(record: IntentRecord): boolean {
    try {
      this.recorder.append(record);
      return true;
    } catch {
      return false;
    }
  }

  private holdTurnSlot(): { release(): void; commit(): void } | null {
    if (!this.permit) return null;
    if (this.realTurnFrames + this.reservedTurnSlots >= this.permit.maxTurns) return null;
    this.reservedTurnSlots += 1;
    let held = true;
    const finishHold = (commit: boolean): void => {
      if (!held) return;
      held = false;
      this.reservedTurnSlots = Math.max(0, this.reservedTurnSlots - 1);
      if (commit) this.realTurnFrames += 1;
    };
    return {
      release: () => finishHold(false),
      commit: () => finishHold(true)
    };
  }

  private pushWarning(message: string): void {
    if (this.warnings.length < 50) this.warnings.push(message);
  }

  private armExperimentDeadline(): void {
    if (this.mode !== "real" || !this.permit) return;
    const wait = Math.max(0, this.permit.deadlineMs - this.now());
    this.timerCount += 1;
    this.deadlineTimer = setTimeout(() => this.fireDeadline(), wait);
  }

  private fireDeadline(): void {
    this.deadlineTimer = null;
    this.timerCount = Math.max(0, this.timerCount - 1);
    if (this.disposed) return;
    this.onLinkClosed("experiment_deadline");
  }

  private clearDeadlineTimer(): void {
    if (!this.deadlineTimer) return;
    clearTimeout(this.deadlineTimer);
    this.deadlineTimer = null;
    this.timerCount = Math.max(0, this.timerCount - 1);
  }

  private killChild(): void {
    if (this.terminated || !this.link.terminate) return;
    this.terminated = true;
    const terminate = this.link.terminate;
    const termMs = this.termMs;
    this.settlingKill = true;
    let started: Promise<{ sigkill: boolean; exitCode: number | null; signal: NodeJS.Signals | null }>;
    try {
      started = Promise.resolve(terminate({ termMs }));
    } catch (error) {
      started = Promise.reject(error);
    } finally {
      this.settlingKill = false;
    }
    this.killPromise = started.then(
      (result) => {
        this.childResult = result;
      },
      () => undefined
    );
  }

  private onLinkClosed(reason: string): void {
    if (this.disposed) return;
    this.disposed = true;
    this.phase = "closed";
    this.clearDeadlineTimer();
    this.outbound.close();
    for (const pending of [...this.clientPending.values()]) {
      if (pending.isSettled()) continue;
      if (pending.isWritten()) {
        pending.onTimeout();
        pending.finishUnknown(reason);
      } else {
        pending.finishUnsent("not_written");
      }
    }
    for (const thread of this.threads.values()) {
      const live = thread.liveTurn;
      if (live && live.phase !== "terminal" && live.phase !== "unknown") this.markUnknown(thread, live);
    }
    this.generation += 1;
    this.killChild();
    this.detach();
    this.framer.reset();
  }

  private detach(): void {
    this.link.stdout.off("data", this.onData);
    this.link.stdout.off("end", this.onEnd);
    this.link.stdout.off("close", this.onClose);
    this.link.stderr?.off("data", this.onStderr);
    // error 监听留到流结束，关闭后的 destroy(err) 不能变成未捕获异常。
  }
}

function freshTurn(requestId: string, taskId: string): LiveTurn {
  return {
    requestId,
    taskId,
    turnId: null,
    phase: "start_pending",
    terminalStatus: null,
    interruptAcked: false,
    interruptConfirmed: false,
    upstreamTerminal: false,
    unknown: false
  };
}

function turnIdResult(result: unknown): string | null {
  if (result === null || typeof result !== "object") return null;
  const turnId = (result as { turnId?: unknown }).turnId;
  return typeof turnId === "string" && turnId.length > 0 ? turnId : null;
}

function sinkFromWritable(stream: Writable): {
  write(chunk: Buffer): boolean;
  end(): void;
  on(event: "drain", listener: () => void): void;
  off(event: "drain", listener: () => void): void;
} {
  return {
    write(chunk) {
      return stream.write(chunk);
    },
    end() {
      stream.end();
    },
    on(event, listener) {
      stream.on(event, listener);
    },
    off(event, listener) {
      stream.off(event, listener);
    }
  };
}

export function openFixtureSession(opts: {
  link: StdioLink;
  recorder: IntentRecorder;
  runId: string;
  requestTimeoutMs?: number;
  oneShotGrants?: OneShotGrant[];
  now?: () => number;
  frameLimits?: FrameLimits;
}): CodexAppServerSession {
  return new AppServerSession(
    opts.link,
    opts.recorder,
    opts.runId,
    "fixture",
    null,
    [...(opts.oneShotGrants ?? [])],
    opts.requestTimeoutMs ?? 15_000,
    opts.now ?? Date.now,
    50,
    opts.frameLimits ?? DEFAULT_FRAME_LIMITS
  );
}

export function openRealSession(opts: {
  link: StdioLink;
  intentLogPath: string;
  runId: string;
  permit: ExperimentPermit | null;
  requestTimeoutMs?: number;
  now?: () => number;
  termMs?: number;
  frameLimits?: FrameLimits;
}): CodexAppServerSession {
  const permit = opts.permit !== null && isExperimentPermit(opts.permit) ? opts.permit : null;
  return new AppServerSession(
    opts.link,
    createFileIntentRecorder(opts.intentLogPath),
    opts.runId,
    "real",
    permit,
    [],
    opts.requestTimeoutMs ?? 15_000,
    opts.now ?? Date.now,
    opts.termMs ?? 2_000,
    opts.frameLimits ?? DEFAULT_FRAME_LIMITS
  );
}
