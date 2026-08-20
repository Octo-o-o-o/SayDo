// 停靠老化(计划 4.2;09 §6.1 park_expired;04 §5.2):停靠占 worktree 与同仓队列,不能无限悬挂。
// 缺省 72h(params.park_aging_hours)无应答 ⇒ 取消(cancelReason=park_expired)+ 对应 package 回落
// draft(revision+1 待编辑)。停靠态 = ready_for_review / blocked(paused_step_boundary 先经 30s 转 blocked)。

import { canTransitionTask } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { isParkExpired } from "./circuitBreakers.js";
import type { AuditSink } from "../obs/audit.js";

const PARKED_STATES = ["ready_for_review", "blocked"] as const;

export interface ParkAgingResult {
  expiredTaskIds: string[];
}

/**
 * 扫描到期停靠任务并老化(幂等:仅处理 parkedDeadline 到期且当前处于停靠态的任务)。
 * 转 cancel_requested(cancelReason=park_expired);package 回落 draft 由调用方(A6)按 revision+1 承接
 * ——本函数只落任务侧终局与审计,不跨域改包(避免与改包链竞态)。
 */
export function ageOutParkedTasks(db: Db, audit: AuditSink, nowIso: string): ParkAgingResult {
  const placeholders = PARKED_STATES.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT id, status, parked_deadline FROM tasks
       WHERE parked_deadline IS NOT NULL AND status IN (${placeholders})`
    )
    .all(...PARKED_STATES) as { id: string; status: string; parked_deadline: string }[];
  const expired: string[] = [];
  const upd = db.prepare(
    "UPDATE tasks SET status = 'cancel_requested', cancel_reason = 'park_expired', updated_at = ?, parked_at = NULL, parked_deadline = NULL WHERE id = ? AND status = ?"
  );
  const tx = db.transaction(() => {
    for (const r of rows) {
      if (!isParkExpired(r.parked_deadline, nowIso)) continue;
      // 状态机守卫(接线批 code-review B1 回修:与 requestCancel/retryTask 纪律统一,防状态机变更后本路径静默走非法边)
      if (!canTransitionTask(r.status as never, "cancel_requested", "T")) continue;
      const res = upd.run(nowIso, r.id, r.status);
      if (res.changes > 0) {
        expired.push(r.id);
        audit.record({
          actor: "daemon",
          action: "task.park_expired",
          meta: { taskId: r.id, fromStatus: r.status, parkedDeadline: r.parked_deadline }
        });
      }
    }
  });
  tx();
  return { expiredTaskIds: expired };
}
