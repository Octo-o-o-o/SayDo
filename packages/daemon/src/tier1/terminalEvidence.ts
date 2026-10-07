// 当前 task/run 的终态一致性与验收条目是否带引用无关。
import type { Db } from "../storage/db.js";

/** 兼容旧记录缺终态审计；重复、冲突或唯一审计与 run 状态失配均不可采用。 */
export function hasTier1TerminalConflict(db: Db, taskId: string, runId: string, state: string): boolean {
  const rows = db.prepare(`SELECT action FROM audit_log
    WHERE action IN ('tier1.settled_review','tier1.failed','tier1.blocked')
      AND json_valid(meta_json)
      AND json_extract(meta_json,'$.taskId')=? AND json_extract(meta_json,'$.runId')=?`)
    .all(taskId, runId) as { action: string }[];
  if (rows.length === 0) return false;
  if (rows.length !== 1) return true;
  const action = rows[0]!.action;
  return state === "settled_review" ? action !== "tier1.settled_review" :
    state === "settled_failed" ? action !== "tier1.failed" && action !== "tier1.blocked" : true;
}

export function assertTier1TerminalConsistent(db: Db, taskId: string, runId: string, state: string): void {
  if (hasTier1TerminalConflict(db, taskId, runId, state)) {
    throw new Error("当前执行的终态审计重复、冲突或与运行状态不符，不能批准");
  }
}
