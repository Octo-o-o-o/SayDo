// 回叫 ack:HTTP 端点 + 用户轮隐式 ack L0(escalation 0)条目。
// mobile_lan 403(与 index 路由白名单双闸);已 ack/resolved 幂等 200。

import type { Db } from "../storage/db.js";
import { getOutboxEntry } from "../storage/dao/outbox.js";
import type { CallbackEngine } from "./engine.js";

export interface AckResponse {
  status: number;
  payload: unknown;
}

function err(status: number, code: string, message: string, retryable = false): AckResponse {
  return { status, payload: { ok: false, code, message, retryable } };
}

export function handleOutboxAck(
  engine: CallbackEngine,
  db: Db,
  entryId: string,
  via?: "local" | "tailnet" | "mobile_lan"
): AckResponse {
  if (via === "mobile_lan") {
    return err(403, "mobile_lan_ack_rejected", "回叫 ack 不在移动 LAN 面开放");
  }
  const entry = getOutboxEntry(db, entryId);
  if (!entry) return err(404, "not_found", `outbox entry not found: ${entryId}`);
  if (entry.state === "acked" || entry.state === "resolved") {
    return { status: 200, payload: { ok: true, state: entry.state, already: true } };
  }
  if (entry.state !== "notified") {
    return err(409, "precondition_failed", `cannot ack from ${entry.state}`);
  }
  engine.ack(entryId);
  return { status: 200, payload: { ok: true, state: "acked" } };
}

/** 用户轮开始:只 ack 本 session 项目下 L0 语音回叫过的 notified(escalation 0)条目。 */
export function ackL0ForSession(db: Db, engine: CallbackEngine, sessionId: string): number {
  const session = db.prepare("SELECT project_id FROM sessions WHERE id=?").get(sessionId) as
    | { project_id: string }
    | undefined;
  if (!session) return 0;
  const rows = db
    .prepare(
      `SELECT o.id FROM callback_outbox o
       JOIN tasks t ON t.id = o.task_id
       WHERE t.project_id = ? AND o.state = 'notified' AND o.escalation = 0`
    )
    .all(session.project_id) as { id: string }[];
  let n = 0;
  for (const row of rows) {
    try {
      engine.ack(row.id);
      n += 1;
    } catch {
      // 竞态已转态:跳过
    }
  }
  return n;
}
