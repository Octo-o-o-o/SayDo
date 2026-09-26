// PTT 采集队列:按 captureId 认轮,禁止 FIFO 把 cancel/edit 错配到下一轮。

export type CaptureKind = "send" | "edit" | "cancelled";

export type CaptureQueueItem = {
  kind: CaptureKind;
  captureId?: string;
  placeholderKey?: string;
  timer: number;
};

export function takeCaptureEntry<T extends { captureId?: string }>(
  queue: readonly T[],
  captureId?: string,
  opts?: { captureMode?: string }
): { entry: T | undefined; queue: T[] } {
  const next = queue.slice();
  if (opts?.captureMode === "hands_free") {
    return { entry: undefined, queue: next };
  }
  if (captureId) {
    const idx = next.findIndex((item) => item.captureId === captureId);
    if (idx < 0) return { entry: undefined, queue: next };
    const [entry] = next.splice(idx, 1);
    return { entry, queue: next };
  }
  if (opts?.captureMode === "ptt") {
    return { entry: undefined, queue: next };
  }
  return { entry: next.shift(), queue: next };
}

export function shouldAcceptDesktopTurn(outcome: "accepted" | "rejected" | "unknown"): boolean {
  return outcome === "accepted";
}

export function epochChangeLeavesPendingUnknown(
  prevEpoch: string | null,
  nextEpoch: string | null,
  hasPending: boolean
): boolean {
  return Boolean(prevEpoch && nextEpoch && prevEpoch !== nextEpoch && hasPending);
}

export type DesktopTurnTextPlan =
  | { ok: false; reason: "no_epoch" }
  | {
      ok: true;
      turnId: string;
      receiptAction: "submit" | "replay" | "retry";
      daemonEpoch: string;
    };

export function planDesktopTurnText(opts: {
  text: string;
  daemonEpoch: string | null;
  pending: { turnId: string; text: string; daemonEpoch: string } | null;
  lastOutcome: "accepted" | "rejected" | "unknown" | null;
  lastRetryable: boolean;
  nextTurnId: () => string;
}): DesktopTurnTextPlan {
  if (!opts.daemonEpoch) return { ok: false, reason: "no_epoch" };
  const pending = opts.pending;
  if (pending && pending.text === opts.text.trim() && pending.daemonEpoch === opts.daemonEpoch) {
    const receiptAction =
      opts.lastOutcome === "rejected" && opts.lastRetryable ? "retry" : "replay";
    return { ok: true, turnId: pending.turnId, receiptAction, daemonEpoch: opts.daemonEpoch };
  }
  return {
    ok: true,
    turnId: opts.nextTurnId(),
    receiptAction: "submit",
    daemonEpoch: opts.daemonEpoch
  };
}

export function shouldReplayPendingOnHello(
  pending: { daemonEpoch: string } | null,
  helloEpoch: string | null
): boolean {
  return Boolean(pending && helloEpoch && pending.daemonEpoch === helloEpoch);
}

export function desktopTextOutcomeCopy(outcome: "rejected" | "unknown"): string {
  return outcome === "unknown" ? "还没确认是否收到,内容还在输入框" : "没发出去,内容还在输入框";
}

/**
 * 切档时哪些采集还在等 pipeline 终态。
 * 有 captureId 的 PTT 与 daemon 登记同一身份,切 HF/PTT 不得先标失败。
 * 没有 captureId 的旧占位仍标失败,避免悬挂 loading。
 */
export function modeSwitchCapturePlan<T extends { kind: CaptureKind; captureId?: string; placeholderKey?: string }>(
  queue: readonly T[]
): { retain: T[]; failPlaceholderKeys: string[] } {
  const retain: T[] = [];
  const failPlaceholderKeys: string[] = [];
  for (const entry of queue) {
    if (entry.captureId) {
      retain.push(entry);
      continue;
    }
    if (entry.kind === "send" && entry.placeholderKey) failPlaceholderKeys.push(entry.placeholderKey);
  }
  return { retain, failPlaceholderKeys };
}

export type CapturedFinalRoute =
  | { action: "ignore" }
  | { action: "draft"; text: string }
  | { action: "draft_error" }
  | { action: "send"; text: string; failed: boolean; thinking: boolean };

/** 已认领的 PTT final。失败和空转写都显式失败,不编造成功文本,也不自动重发。 */
export function routeCapturedFinal(input: {
  kind: CaptureKind;
  recognitionOutcome?: string;
  text: string;
}): CapturedFinalRoute {
  const failedOutcome = input.recognitionOutcome === "failed";
  const text = failedOutcome ? "" : input.text.trim();
  if (input.kind === "cancelled") return { action: "ignore" };
  if (input.kind === "edit") return text === "" ? { action: "draft_error" } : { action: "draft", text };
  return { action: "send", text, failed: text === "", thinking: text !== "" };
}
