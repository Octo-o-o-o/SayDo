// C7 对账与恢复(计划 4.3;modules/c C7;09 §12-7)。
// daemon 启动对账:中断的 tier1_runs、dispatch binding NULL 行重放、hopper_commands ≠confirmed 重放(P0.5)。
// 恢复顺序:先本地账(SQLite journal)→ 再跨域对账(Hopper 投影,P0.5)→ 最后叫人(回叫补发经 C4 dedupe)。
// 只恢复到一致态,悬案上浮(不做业务决策)。

import { existsSync } from "node:fs";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { markInterruptedOnStartup, type InterruptMarkReport } from "../focus/interruptRecovery.js";

export type RunRecovery =
  | { runId: string; taskId: string; action: "resumable"; key: { adapter: string; nativeSessionId: string; cwd: string } }
  | { runId: string; taskId: string; action: "degrade_new_session"; reason: string };

export interface ReconcileReport {
  interruptedRuns: number;
  recoveries: RunRecovery[];
  danglingDispatchBindings: number; // 两阶段 dispatch:binding NULL 行(P0.5 跨域重放,P0 仅计数上浮)
  /** C2:遗留 talking session / active activation → interrupted */
  focusInterrupt?: InterruptMarkReport;
}

const NON_TERMINAL = ["reserved", "running", "step_paused"] as const;

/**
 * 启动本地对账:非终态 tier1_runs = 上次进程中断(daemon 无常驻子进程,重启即中断)。
 * 恢复钥匙 = (adapter, nativeSessionId, cwd):worktree 在且有 nativeSessionId ⇒ resumable;
 * 否则降级 "摘要+diff 注入新会话"(09 §12-7 失败降级)。不自动重启进程(等 C4 叫人/用户决定)。
 */
export function reconcileOnStartup(db: Db, audit: AuditSink): ReconcileReport {
  const placeholders = NON_TERMINAL.map(() => "?").join(",");
  const runs = db
    .prepare(
      `SELECT id, task_id, adapter, native_session_id, cwd, worktree_path, state
       FROM tier1_runs WHERE state IN (${placeholders})`
    )
    .all(...NON_TERMINAL) as {
    id: string;
    task_id: string;
    adapter: string;
    native_session_id: string | null;
    cwd: string;
    worktree_path: string;
    state: string;
  }[];

  const recoveries: RunRecovery[] = [];
  for (const r of runs) {
    if (r.native_session_id && existsSync(r.worktree_path)) {
      recoveries.push({
        runId: r.id,
        taskId: r.task_id,
        action: "resumable",
        key: { adapter: r.adapter, nativeSessionId: r.native_session_id, cwd: r.cwd }
      });
    } else {
      recoveries.push({
        runId: r.id,
        taskId: r.task_id,
        action: "degrade_new_session",
        reason: !r.native_session_id ? "no nativeSessionId (resume key missing)" : "worktree missing"
      });
    }
  }

  // 两阶段 dispatch:binding 已插但 dispatch 未确认(dispatch_id NULL)——P0 Tier1 无 Hopper,仅计数上浮(P0.5-B 跨域重放)
  const dangling = db.prepare("SELECT COUNT(*) AS c FROM dispatch_bindings WHERE dispatch_id IS NULL").get() as
    | { c: number }
    | undefined;

  // C2:上一进程遗留 talking session + active activation → interrupted(session→suspended 可 rebuild)
  const focusInterrupt = markInterruptedOnStartup(db, audit);

  const report: ReconcileReport = {
    interruptedRuns: runs.length,
    recoveries,
    danglingDispatchBindings: dangling?.c ?? 0,
    focusInterrupt
  };
  audit.record({
    actor: "daemon",
    action: "reconcile.startup",
    meta: {
      interruptedRuns: report.interruptedRuns,
      resumable: recoveries.filter((r) => r.action === "resumable").length,
      degraded: recoveries.filter((r) => r.action === "degrade_new_session").length,
      danglingBindings: report.danglingDispatchBindings,
      focusSessionsMarked: focusInterrupt.sessionsMarked,
      focusActivationsInterrupted: focusInterrupt.activationsInterrupted
    }
  });
  return report;
}

/** delivery preflight(回叫拨出前验通道可达:免打扰窗口 + 设备在线) */
export interface PreflightInput {
  nowHm: string; // "HH:MM"
  dndWindow?: string | undefined; // "23:00-08:00"
  channelReachable: boolean;
}

export function deliveryPreflight(i: PreflightInput): { ok: boolean; reason?: string } {
  if (!i.channelReachable) return { ok: false, reason: "channel unreachable (device offline)" };
  if (i.dndWindow && inDndWindow(i.nowHm, i.dndWindow)) {
    return { ok: false, reason: `in DND window ${i.dndWindow} (defer to window end)` };
  }
  return { ok: true };
}

/** 免打扰窗口判定(支持跨午夜,如 23:00-08:00) */
export function inDndWindow(nowHm: string, window: string): boolean {
  const [start, end] = window.split("-");
  if (!start || !end) return false;
  const n = hm(nowHm);
  const s = hm(start);
  const e = hm(end);
  return s <= e ? n >= s && n < e : n >= s || n < e; // 跨午夜
}

function hm(s: string): number {
  const [h, m] = s.split(":");
  return Number(h) * 60 + Number(m ?? "0");
}
