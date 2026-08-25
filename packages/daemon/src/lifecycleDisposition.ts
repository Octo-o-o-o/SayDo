import type { PrepareShutdownReason } from "@saydo/contracts";

export type LifecycleIntent =
  | { kind: "restart"; generation: number }
  | { kind: "signal"; reason: PrepareShutdownReason }
  | { kind: "fatal"; code: string; message?: string };

/**
 * restart HTTP 200 已写出到 freeze 之间的覆盖窗口。
 * 用单调 timer 界定，不是事件循环让步；等待纳入单一 shutdown 总截止。
 */
export const RESTART_OVERRIDE_GRACE_MS = 500;

export interface LifecycleDispositionClock {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (timer: unknown) => void;
}

const defaultClock: LifecycleDispositionClock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (timer) => {
    clearTimeout(timer as NodeJS.Timeout);
  }
};

let clock: LifecycleDispositionClock = defaultClock;

export function setLifecycleDispositionClock(next: LifecycleDispositionClock | null): void {
  clock = next ?? defaultClock;
}

function priority(kind: LifecycleIntent["kind"]): number {
  if (kind === "fatal") return 3;
  if (kind === "signal") return 2;
  return 1;
}

/** fatal > signal/supervisor stop > restart。freeze 之后不可再改。 */
export class LifecycleDisposition {
  private current: LifecycleIntent | null = null;
  private frozen: LifecycleIntent | null = null;
  private graceStartedAt: number | null = null;
  private graceTimer: unknown = null;
  private graceDone = false;
  private graceWaiters: Array<() => void> = [];

  peek(): LifecycleIntent | null {
    return this.frozen ?? this.current;
  }

  get isFrozen(): boolean {
    return this.frozen !== null;
  }

  claim(next: LifecycleIntent): boolean {
    if (this.frozen) return false;
    let accepted = false;
    if (!this.current) {
      this.current = next;
      accepted = true;
    } else if (priority(next.kind) > priority(this.current.kind)) {
      this.current = next;
      accepted = true;
    } else if (next.kind === "signal" && this.current.kind === "signal") {
      accepted = this.current.reason === next.reason;
    } else if (next.kind === "restart" && this.current.kind === "restart") {
      accepted = this.current.generation === next.generation;
    }
    if (accepted && next.kind !== "restart") this.completeGrace();
    return accepted;
  }

  /** 在 restart HTTP 200 已写出后调用一次；重复调用不重置窗口。 */
  armRestartOverrideGrace(): void {
    if (this.frozen || this.graceDone || this.graceStartedAt !== null || this.current?.kind !== "restart") {
      return;
    }
    this.graceStartedAt = clock.now();
    this.graceTimer = clock.setTimeout(() => this.expireOverrideWindow(), RESTART_OVERRIDE_GRACE_MS);
  }

  waitRestartOverrideGrace(): Promise<void> {
    if (this.frozen || this.current?.kind !== "restart") {
      this.completeGrace();
      return Promise.resolve();
    }
    if (this.graceDone) return Promise.resolve();
    if (this.graceStartedAt === null) return Promise.resolve();
    const now = clock.now();
    const started = this.graceStartedAt;
    if (now < started || now - started >= RESTART_OVERRIDE_GRACE_MS) {
      this.expireOverrideWindow();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.graceWaiters.push(resolve);
    });
  }

  freeze(): LifecycleIntent {
    this.completeGrace();
    this.frozen ??= this.current ?? { kind: "signal", reason: "supervisor_stop" };
    return this.frozen;
  }

  /** grace 到期只结束等待，不冻结；terminal frame 前仍允许 fatal 升级。 */
  private expireOverrideWindow(): void {
    this.completeGrace();
  }

  private completeGrace(): void {
    if (this.graceDone) return;
    this.graceDone = true;
    if (this.graceTimer !== null) {
      clock.clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
    const waiters = this.graceWaiters;
    this.graceWaiters = [];
    for (const waiter of waiters) waiter();
  }
}

export function shutdownReasonOf(intent: LifecycleIntent): PrepareShutdownReason {
  if (intent.kind === "signal") return intent.reason;
  if (intent.kind === "restart") return "restart";
  return "supervisor_stop";
}

/** 让出到下一轮 poll。不是 restart 覆盖合同；覆盖窗口见 RESTART_OVERRIDE_GRACE_MS。 */
export function yieldForPendingSignals(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => {
      setImmediate(resolve);
    });
  });
}

export function afterClientGone(
  socket: { destroyed?: boolean; once(event: "close", listener: () => void): unknown } | null | undefined,
  run: () => void
): void {
  const go = (): void => {
    queueMicrotask(run);
  };
  if (!socket || socket.destroyed) {
    go();
    return;
  }
  socket.once("close", go);
}
