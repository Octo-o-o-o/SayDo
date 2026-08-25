/** 不依赖被清理 Promise 的独立单调截止。无 runtime/BYOA 依赖，避免循环加载。 */

export const DAEMON_SHUTDOWN_DEADLINE_MS = 25_000;
export const TIER1_EMERGENCY_CLEANUP_DEADLINE_MS = 5_000;
export const INDEPENDENT_DEADLINE_PREFIX = "shutdown deadline exceeded:";

const independentDeadlineErrors = new WeakSet<object>();

export class IndependentDeadlineError extends Error {
  readonly label: string;

  constructor(label: string) {
    super(`${INDEPENDENT_DEADLINE_PREFIX}${label}`);
    this.name = "IndependentDeadlineError";
    this.label = label;
    independentDeadlineErrors.add(this);
  }
}

export function isIndependentDeadlineError(err: unknown): boolean {
  return typeof err === "object" && err !== null && independentDeadlineErrors.has(err);
}

export interface IndependentDeadlineHooks {
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (timer: unknown) => void;
}

let independentDeadlineHooks: IndependentDeadlineHooks = {};

export function setIndependentDeadlineTestHooks(hooks: IndependentDeadlineHooks | null): void {
  independentDeadlineHooks = hooks ?? {};
}

export function raceWithMonotonicDeadline<T>(
  work: Promise<T>,
  label: string,
  deadlineMs = DAEMON_SHUTDOWN_DEADLINE_MS
): Promise<T> {
  const setT = independentDeadlineHooks.setTimeout ?? ((fn, ms) => {
    const timer = setTimeout(fn, ms);
    // hard deadline 在裁决前必须保持 referenced，避免 unsupervised 且 work 无 handle 时提前 0 退出。
    return timer;
  });
  const clearT = independentDeadlineHooks.clearTimeout ?? ((timer) => {
    clearTimeout(timer as NodeJS.Timeout);
  });
  let timer: unknown;
  let settled = false;
  const workPromise = Promise.resolve(work);
  void workPromise.then(() => undefined, () => undefined);
  const timeout = new Promise<never>((_, reject) => {
    timer = setT(() => {
      if (settled) return;
      settled = true;
      reject(new IndependentDeadlineError(label));
    }, deadlineMs);
  });
  return Promise.race([
    workPromise.finally(() => {
      if (timer) clearT(timer);
      settled = true;
    }),
    timeout
  ]);
}

export async function performEmergencyCleanup(
  work: Promise<unknown>,
  label: string,
  deadlineMs = TIER1_EMERGENCY_CLEANUP_DEADLINE_MS
): Promise<{ ok: true } | { ok: false; deadline: boolean }> {
  try {
    await raceWithMonotonicDeadline(work, label, deadlineMs);
    return { ok: true };
  } catch (err) {
    return { ok: false, deadline: isIndependentDeadlineError(err) };
  }
}
