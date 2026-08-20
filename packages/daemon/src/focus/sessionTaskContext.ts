// 会话任务上下文(合同 §5.4):弹窗打开时 set,关闭 DELETE+nonce CAS;TTL 2h 懒过期;
// daemon 重启清全表(UI 瞬态)。pack 注入段本批不做(批 3)。

import { newId } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";

export const SESSION_TASK_CONTEXT_TTL_MS = 2 * 60 * 60 * 1000;

export type TaskContextRefKind = "obligation" | "task";

export interface SessionTaskContext {
  sessionId: string;
  refKind: TaskContextRefKind;
  refId: string;
  nonce: string;
  setAt: string;
}

export class TaskContextError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "TaskContextError";
  }
}

function assertTargetExists(db: Db, refKind: TaskContextRefKind, refId: string): void {
  if (refKind === "obligation") {
    const r = db.prepare("SELECT id FROM focus_obligations WHERE id = ?").get(refId);
    if (!r) throw new TaskContextError("target_not_found", `obligation ${refId} not found`);
    return;
  }
  const r = db.prepare("SELECT id FROM tasks WHERE id = ?").get(refId);
  if (!r) throw new TaskContextError("target_not_found", `task ${refId} not found`);
}

/** set:校验 target 存在;开新弹窗换 nonce(旧关闭 CAS 不中) */
export function setSessionTaskContext(
  db: Db,
  input: { sessionId: string; refKind: TaskContextRefKind; refId: string; nonce?: string },
  now: () => Date = () => new Date()
): SessionTaskContext {
  const session = db.prepare("SELECT id FROM sessions WHERE id = ?").get(input.sessionId);
  if (!session) throw new TaskContextError("session_not_found", `session ${input.sessionId} not found`);
  assertTargetExists(db, input.refKind, input.refId);
  const nonce = input.nonce ?? newId("evt");
  const setAt = now().toISOString();
  db.prepare(
    `INSERT INTO session_task_context(session_id, ref_kind, ref_id, nonce, set_at)
     VALUES (?,?,?,?,?)
     ON CONFLICT(session_id) DO UPDATE SET
       ref_kind=excluded.ref_kind, ref_id=excluded.ref_id, nonce=excluded.nonce, set_at=excluded.set_at`
  ).run(input.sessionId, input.refKind, input.refId, nonce, setAt);
  return {
    sessionId: input.sessionId,
    refKind: input.refKind,
    refId: input.refId,
    nonce,
    setAt
  };
}

/**
 * clear:带 nonce 时 CAS(不等则 no-op 返回 false);
 * 不带 nonce 强制清(会话换锚/收尾)。
 */
export function clearSessionTaskContext(
  db: Db,
  sessionId: string,
  nonce?: string
): boolean {
  if (nonce !== undefined) {
    const r = db
      .prepare("DELETE FROM session_task_context WHERE session_id = ? AND nonce = ?")
      .run(sessionId, nonce) as { changes: number };
    return r.changes === 1;
  }
  const r = db.prepare("DELETE FROM session_task_context WHERE session_id = ?").run(sessionId) as {
    changes: number;
  };
  return r.changes >= 1;
}

/** 读取;TTL 过期懒删 */
export function getSessionTaskContext(
  db: Db,
  sessionId: string,
  now: () => Date = () => new Date()
): SessionTaskContext | null {
  const row = db
    .prepare("SELECT session_id, ref_kind, ref_id, nonce, set_at FROM session_task_context WHERE session_id = ?")
    .get(sessionId) as
    | { session_id: string; ref_kind: string; ref_id: string; nonce: string; set_at: string }
    | undefined;
  if (!row) return null;
  const age = now().getTime() - Date.parse(row.set_at);
  if (!Number.isFinite(age) || age > SESSION_TASK_CONTEXT_TTL_MS) {
    db.prepare("DELETE FROM session_task_context WHERE session_id = ?").run(sessionId);
    return null;
  }
  return {
    sessionId: row.session_id,
    refKind: row.ref_kind as TaskContextRefKind,
    refId: row.ref_id,
    nonce: row.nonce,
    setAt: row.set_at
  };
}

/** daemon 启动:清全表(UI 瞬态,重启即失效)+audit 记数 */
export function clearAllSessionTaskContexts(db: Db, audit?: AuditSink | null): number {
  const before = (db.prepare("SELECT COUNT(*) AS c FROM session_task_context").get() as { c: number }).c;
  if (before > 0) {
    db.prepare("DELETE FROM session_task_context").run();
  }
  try {
    audit?.record({
      actor: "daemon",
      action: "session_task_context.cleared_on_boot",
      meta: { count: before }
    });
  } catch {
    // ignore
  }
  return before;
}
