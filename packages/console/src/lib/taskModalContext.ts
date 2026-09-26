// TaskModal 上下文建立:与详情加载分离。不自动创建会话、不把上下文 404 当成整页失败。

import { apiDelete, apiGet, apiPost } from "./api";
import {
  enqueueTaskContextCleanup,
  enqueueTaskContextWrite,
  isCurrentTaskContextOwner,
  type TaskContextOwner
} from "./taskContextCoordinator";
import {
  isMissingTaskError,
  parseTaskDetailPayload,
  shouldApplyTaskContext,
  taskContextFailCopy,
  type TaskModalTask
} from "./taskModalView";

export type { TaskContextOwner } from "./taskContextCoordinator";
export {
  claimTaskContextOwner,
  enqueueTaskContextCleanup,
  isCurrentTaskContextOwner,
  releaseTaskContextOwner,
  resetTaskContextCoordinatorForTests
} from "./taskContextCoordinator";

export type ObligationDetail = {
  id: string;
  title: string;
  detail: string | null;
  needs: string | null;
  status: string;
  nextStep: string | null;
  owner: string;
  kind: string;
};

export async function loadObligationDetail(
  focusId: string,
  obligationId: string
): Promise<{ ok: true; obligation: ObligationDetail } | { ok: false; missing: boolean; message: string }> {
  try {
    const d = await apiGet<{ obligations: ObligationDetail[] }>(`/api/focuses/${encodeURIComponent(focusId)}`);
    const found = d.obligations.find((o) => o.id === obligationId);
    if (!found) return { ok: false, missing: true, message: "找不到这条安排" };
    return { ok: true, obligation: found };
  } catch (e) {
    if (isMissingTaskError(e)) return { ok: false, missing: true, message: "找不到这条安排" };
    return { ok: false, missing: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function loadTaskModalTask(
  taskId: string
): Promise<{ ok: true; task: TaskModalTask } | { ok: false; missing: boolean; message: string }> {
  try {
    const raw = await apiGet<unknown>(`/api/tasks/${encodeURIComponent(taskId)}`);
    const parsed = parseTaskDetailPayload(raw);
    if (!parsed) return { ok: false, missing: true, message: "找不到这个任务" };
    return { ok: true, task: parsed };
  } catch (e) {
    if (isMissingTaskError(e)) return { ok: false, missing: true, message: "找不到这个任务" };
    return { ok: false, missing: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function postTaskContext(
  sessionId: string,
  refKind: "obligation" | "task",
  refId: string
): Promise<{ nonce: string }> {
  return apiPost<{ ok: true; nonce: string }>(`/api/session/${encodeURIComponent(sessionId)}/task-context`, {
    refKind,
    refId
  });
}

export async function clearBoundTaskContext(sessionId: string, nonce: string): Promise<void> {
  try {
    await apiDelete(`/api/session/${encodeURIComponent(sessionId)}/task-context`, { nonce });
  } catch {
    // 关闭/切换不因 clear 失败卡住
  }
}

export type TaskContextLifetime = {
  begin: () => number;
  invalidate: () => void;
  reopen: () => void;
  isCurrent: (gen: number) => boolean;
};

export function createTaskContextLifetime(): TaskContextLifetime {
  let gen = 0;
  let closed = false;
  return {
    begin: () => {
      gen += 1;
      return gen;
    },
    invalidate: () => {
      closed = true;
      gen += 1;
    },
    reopen: () => {
      closed = false;
    },
    isCurrent: (g) => !closed && g === gen
  };
}

export async function settleTaskContextResult(
  life: TaskContextLifetime,
  gen: number,
  result:
    | { status: "ready"; nonce: string; sessionId: string }
    | { status: "stale" }
    | { status: "failed"; message: string }
): Promise<
  | { status: "ready"; nonce: string; sessionId: string }
  | { status: "stale" }
  | { status: "failed"; message: string }
> {
  if (!life.isCurrent(gen) || result.status === "stale") {
    if (result.status === "ready") {
      await enqueueTaskContextCleanup(() => clearBoundTaskContext(result.sessionId, result.nonce));
    }
    return { status: "stale" };
  }
  return result;
}

export async function establishTaskContext(opts: {
  sessionId: string;
  refKind: "obligation" | "task";
  refId: string;
  requestTargetKey: string;
  liveTargetKey: () => string;
  liveSessionId: () => string;
  owner?: TaskContextOwner;
}): Promise<
  | { status: "ready"; nonce: string; sessionId: string }
  | { status: "stale" }
  | { status: "failed"; message: string }
> {
  if (!opts.sessionId) {
    return { status: "failed", message: "还没接到当前对话。详情可以先看,要在这件事里发送需要先打开对话再试一次。" };
  }
  if (opts.owner && !isCurrentTaskContextOwner(opts.owner)) return { status: "stale" };
  try {
    if (opts.owner) {
      const queued = await enqueueTaskContextWrite(
        opts.owner,
        async () => {
          const ctx = await postTaskContext(opts.sessionId, opts.refKind, opts.refId);
          return { nonce: ctx.nonce, sessionId: opts.sessionId };
        },
        async (value) => {
          await clearBoundTaskContext(value.sessionId, value.nonce);
        }
      );
      if (queued.status === "skipped") return { status: "stale" };
      if (!isCurrentTaskContextOwner(opts.owner)) return { status: "stale" };
      if (
        !shouldApplyTaskContext({
          requestTargetKey: opts.requestTargetKey,
          liveTargetKey: opts.liveTargetKey(),
          requestSessionId: opts.sessionId,
          liveSessionId: opts.liveSessionId()
        })
      ) {
        await clearBoundTaskContext(queued.value.sessionId, queued.value.nonce);
        return { status: "stale" };
      }
      return { status: "ready", nonce: queued.value.nonce, sessionId: queued.value.sessionId };
    }
    const ctx = await postTaskContext(opts.sessionId, opts.refKind, opts.refId);
    if (
      !shouldApplyTaskContext({
        requestTargetKey: opts.requestTargetKey,
        liveTargetKey: opts.liveTargetKey(),
        requestSessionId: opts.sessionId,
        liveSessionId: opts.liveSessionId()
      })
    ) {
      void clearBoundTaskContext(opts.sessionId, ctx.nonce);
      return { status: "stale" };
    }
    return { status: "ready", nonce: ctx.nonce, sessionId: opts.sessionId };
  } catch (e) {
    if (opts.owner && !isCurrentTaskContextOwner(opts.owner)) return { status: "stale" };
    if (
      !shouldApplyTaskContext({
        requestTargetKey: opts.requestTargetKey,
        liveTargetKey: opts.liveTargetKey(),
        requestSessionId: opts.sessionId,
        liveSessionId: opts.liveSessionId()
      })
    ) {
      return { status: "stale" };
    }
    return { status: "failed", message: taskContextFailCopy(e) };
  }
}
