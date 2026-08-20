// hopper_commands 出站命令 journal(09 §6.2):全部真实出站调用入账。
// 规则:先落 intent -> 发送(sent) -> confirmed;重启扫 !=confirmed 行原 idemKey 重放。
// merge(S3)链靠此闭合(approve/merge 绑收据)。retry 闸门(X3a):risk=high 一律不自动 retry;
// 分诊 blocked 恢复只走 re-drop->unblock,不走 retry(防首跑直通闸门)。

import { ulid } from "ulid";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";

export type HopperOp =
  | "drop"
  | "scan"
  | "run"
  | "cancel"
  | "unblock"
  | "review_approve"
  | "review_request_changes"
  | "review_reject"
  | "merge"
  | "retry";

export type CommandState = "intent" | "sent" | "confirmed" | "failed";

export function recordIntent(
  db: Db,
  audit: AuditSink,
  i: { taskId: string; op: HopperOp; idemKey: string; payloadDigest: string; receiptId?: string },
  nowIso: string
): string {
  const id = `cmd_${ulid()}`;
  db.prepare(
    "INSERT INTO hopper_commands(id, task_id, op, idem_key, payload_digest, receipt_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'intent', ?, ?)"
  ).run(id, i.taskId, i.op, i.idemKey, i.payloadDigest, i.receiptId ?? null, nowIso, nowIso);
  audit.record({ actor: "daemon", action: "bridge.cmd_intent", meta: { id, op: i.op, taskId: i.taskId } });
  return id;
}

export function markCommand(db: Db, id: string, state: Exclude<CommandState, "intent">, nowIso: string): void {
  const res = db.prepare("UPDATE hopper_commands SET state = ?, updated_at = ? WHERE id = ?").run(state, nowIso, id);
  if (res.changes === 0) throw new Error(`hopper command not found: ${id}`);
}

/** 重启对账:!=confirmed 行(intent/sent/failed 中 retryable 的)按原 idemKey 重放 */
export function unconfirmedCommands(db: Db): { id: string; taskId: string; op: HopperOp; idemKey: string; state: CommandState }[] {
  return (
    db.prepare("SELECT id, task_id, op, idem_key, state FROM hopper_commands WHERE state != 'confirmed' ORDER BY created_at").all() as {
      id: string;
      task_id: string;
      op: HopperOp;
      idem_key: string;
      state: CommandState;
    }[]
  ).map((r) => ({ id: r.id, taskId: r.task_id, op: r.op, idemKey: r.idem_key, state: r.state }));
}

// ---- retry 闸门(owner X3a;09 §6.2/§7)----

export interface RetryGateInput {
  /** 重读后的投影 risk(必须发 retry 前重读,不用缓存) */
  riskHigh: boolean;
  /** 该任务是否处于"分诊即 blocked"(triage 出口;恢复只走 re-drop->unblock) */
  triageBlocked: boolean;
}

export type RetryGate = { allowed: true } | { allowed: false; route: "manual" | "redrop_unblock"; reason: string };

export function retryGate(i: RetryGateInput): RetryGate {
  if (i.riskHigh) {
    return { allowed: false, route: "manual", reason: "risk=high 不自动 retry(重跑要你亲自点,10 #30)" };
  }
  if (i.triageBlocked) {
    return { allowed: false, route: "redrop_unblock", reason: "分诊 blocked 恢复走 re-drop->unblock,不走 retry(防首跑直通闸门)" };
  }
  return { allowed: true };
}
