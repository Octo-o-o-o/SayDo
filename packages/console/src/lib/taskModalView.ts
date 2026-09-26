// TaskModal 视图/动作边界:复用任务详情的取消集合,不另造状态机。
// GET /api/tasks/:id 真实形状是 getTaskDetail({ task, package, ... }),不是扁平任务行。

import { ApiError } from "./apiError";

export const CANCELABLE_TASK_STATUSES = [
  "confirmed",
  "queued",
  "running",
  "blocked",
  "paused_step_boundary",
  "ready_for_review"
] as const;

const TERMINAL_NO_DEFAULT_ACTIONS = new Set(["task_done", "cancel_settled", "superseded"]);

const STEERABLE_TASK_STATUSES = new Set([
  "confirmed",
  "queued",
  "running",
  "paused_step_boundary",
  "blocked",
  "waiting_confirmation"
]);

export type TaskModalLoad = "loading" | "ready" | "missing" | "failed";

export type TaskModalTask = {
  id: string;
  title: string;
  status: string;
  viewStatus: string;
  projectId?: string;
};

export function parseTaskDetailPayload(raw: unknown): TaskModalTask | null {
  if (raw === null || raw === undefined || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const nested = rec["task"];
  const task =
    nested !== null && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : rec;
  const id = typeof task["id"] === "string" ? task["id"] : "";
  if (!id) return null;
  const title = typeof task["title"] === "string" ? task["title"] : "";
  const status = typeof task["status"] === "string" ? task["status"] : "";
  const viewStatus = typeof task["viewStatus"] === "string" && task["viewStatus"] !== "" ? task["viewStatus"] : status;
  const projectId =
    typeof task["projectId"] === "string"
      ? task["projectId"]
      : typeof task["project_id"] === "string"
        ? task["project_id"]
        : undefined;
  return { id, title, status, viewStatus, ...(projectId ? { projectId } : {}) };
}

export function isMissingTaskError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.code === "not_found" || err.status === 404 || err.message.includes("看不懂的内容");
  }
  return err instanceof Error && err.message.includes("看不懂的内容");
}

export function taskActionsAllowed(viewStatus: string): { cancel: boolean; steer: boolean } {
  if (TERMINAL_NO_DEFAULT_ACTIONS.has(viewStatus) || viewStatus === "") {
    return { cancel: false, steer: false };
  }
  return {
    cancel: (CANCELABLE_TASK_STATUSES as readonly string[]).includes(viewStatus),
    steer: STEERABLE_TASK_STATUSES.has(viewStatus)
  };
}

export type ConfirmCardIdentity = {
  receiptId: string;
  kind?: string;
  digest?: string;
  packageId?: string;
  revision?: number;
  taskId?: string;
};

export function confirmCardMatches(
  card: ConfirmCardIdentity | null | undefined,
  receiptId: string,
  entity?: { packageId?: string; revision?: number; taskId?: string; kind?: string; digest?: string }
): boolean {
  if (!card || card.receiptId !== receiptId) return false;
  if (!entity) return true;
  if (entity.kind === "dispatch" || entity.packageId) {
    if (card.kind !== "dispatch") return false;
    if (!card.packageId || card.packageId !== entity.packageId) return false;
    if (entity.revision !== undefined && card.revision !== entity.revision) return false;
    if (entity.digest && card.digest && entity.digest !== card.digest) return false;
    return true;
  }
  if (entity.taskId) {
    if (!card.taskId || card.taskId !== entity.taskId) return false;
    if (entity.kind && card.kind !== entity.kind) return false;
    if (entity.digest && card.digest && entity.digest !== card.digest) return false;
    return true;
  }
  if (entity.kind && card.kind !== entity.kind) return false;
  return true;
}

/** 确认卡所有输入(按钮+文本)共用 Receipt + 当前 session 身份。 */
export function canSendConfirmationInput(opts: {
  card: { receiptId: string } | null | undefined;
  targetReceiptId: string;
  targetSessionId?: string;
  liveSessionId: string;
  text?: string;
}): boolean {
  if (!confirmCardMatches(opts.card, opts.targetReceiptId)) return false;
  if (!opts.liveSessionId) return false;
  if (opts.targetSessionId && opts.targetSessionId !== opts.liveSessionId) return false;
  if (opts.text !== undefined && opts.text.trim() === "") return false;
  return true;
}

export type TaskModalContextPhase = "idle" | "pending" | "ready" | "failed";

export function taskModalTargetKey(target: {
  kind: string;
  id?: string;
  receiptId?: string;
}): string {
  if (target.kind === "confirmation") return `confirmation:${target.receiptId ?? ""}`;
  return `${target.kind}:${target.id ?? ""}`;
}

export function shouldApplyTaskContext(opts: {
  requestTargetKey: string;
  liveTargetKey: string;
  requestSessionId: string;
  liveSessionId: string;
}): boolean {
  return (
    opts.requestTargetKey !== "" &&
    opts.requestSessionId !== "" &&
    opts.requestTargetKey === opts.liveTargetKey &&
    opts.requestSessionId === opts.liveSessionId
  );
}

export function isMissingSessionError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.code === "session_not_found" || err.code === "target_not_found";
  }
  return false;
}

export function taskContextFailCopy(err: unknown): string {
  if (isMissingSessionError(err)) {
    return "还没接到当前对话。详情可以先看,要在这件事里发送需要先打开对话再试一次。";
  }
  if (err instanceof ApiError && err.kind === "network") {
    return "现在接不上对话。详情可以先看,内容还留着,连上后再发。";
  }
  return "还没接到这件事的对话。详情可以先看,发送需要接上后再试。";
}

export async function gateTaskModalSend(opts: {
  kind: "confirmation" | "task" | "obligation";
  text: string;
  card?: { receiptId: string } | null;
  targetReceiptId?: string;
  targetSessionId?: string;
  liveSessionId: string;
  nonce: string | null;
  nonceSessionId?: string | null;
  sendText: (text: string) => boolean | Promise<boolean>;
}): Promise<{ sent: boolean; reason?: string }> {
  const text = opts.text.trim();
  if (text === "") return { sent: false };
  if (opts.kind === "confirmation") {
    if (
      !canSendConfirmationInput({
        card: opts.card,
        targetReceiptId: opts.targetReceiptId ?? "",
        targetSessionId: opts.targetSessionId,
        liveSessionId: opts.liveSessionId,
        text
      })
    ) {
      return { sent: false, reason: "当前确认卡不是这张,内容还在输入框" };
    }
  } else if (
    !canSendTaskContextText({
      nonce: opts.nonce,
      text,
      nonceSessionId: opts.nonceSessionId,
      liveSessionId: opts.liveSessionId
    })
  ) {
    return { sent: false, reason: "还没接到这件事的对话,内容还在输入框" };
  }
  const ok = await opts.sendText(text);
  if (!ok) return { sent: false, reason: "现在发不出去,内容还在输入框" };
  return { sent: true };
}

export function canSendTaskContextText(opts: {
  nonce: string | null;
  text: string;
  nonceSessionId?: string | null;
  liveSessionId?: string;
}): boolean {
  if (!opts.nonce || !opts.text.trim()) return false;
  if (opts.nonceSessionId !== undefined || opts.liveSessionId !== undefined) {
    return Boolean(opts.nonceSessionId && opts.liveSessionId && opts.nonceSessionId === opts.liveSessionId);
  }
  return true;
}

export function taskDetailHref(task: { id: string; projectId?: string; viewStatus?: string }): string {
  if (task.viewStatus === "ready_for_review" || !task.projectId) {
    return `#/review/${encodeURIComponent(task.id)}`;
  }
  return `#/p/${encodeURIComponent(task.projectId)}/task/${encodeURIComponent(task.id)}`;
}

export function taskStatusLabel(viewStatus: string | undefined, load: TaskModalLoad): string {
  if (load === "loading") return "正在加载";
  if (load === "missing") return "不存在";
  if (load === "failed") return "加载失败";
  if (!viewStatus) return "状态未知";
  return viewStatus;
}
