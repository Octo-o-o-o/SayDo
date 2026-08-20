// 停靠老化生产调度(接线批任务④;HANDOFF §2-9-④;09 §6.1 T 边 + Codex 14 #2):
// - 30s 步界:paused_step_boundary 无应答 -> blocked (T)(04 §5.4:先落 blocked 再按升级链叫人,
//   不直接老化取消);进入 blocked 时 transitionTask 落 parked 字段;
// - 72h 老化:parkedDeadline 到期(ready_for_review/blocked)-> cancel_requested(park_expired)
//   -> 无活跃 run 即时 cancel_settled + package 回落 draft(revision+1 待编辑)+ 回叫 #35;
// - 全部转换走 CAS(transitionTask WHERE status=from;T 与 U 竞态先提交者胜——定时器上线即激活竞态,
//   禁先接线后修,Codex 14 #2);每轮重读 [params].park_aging_hours(index.ts 备份定时器同样板)。

import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { transitionTask } from "../storage/dao/tasks.js";
import { ageOutParkedTasks } from "../approvals/parkAging.js";
import { settleCancelNoActiveRun } from "../tier1/operations.js";
import { getPackage } from "../storage/dao/packages.js";
import { applyReceiptEvent } from "../approvals/issue.js";
import type { DecisionPackageFactory } from "../packages/factory.js";
import type { CallbackEngine } from "../callback/engine.js";

/** 步骤边界确认无应答阈值(09 §6.1 表行/04 §5.4 定值 30s;canonical 常量,非可调参数) */
export const STEP_BOUNDARY_TIMEOUT_MS = 30_000;

export interface ParkSweepDeps {
  db: Db;
  audit: AuditSink;
  factory: DecisionPackageFactory;
  callbacks: CallbackEngine;
  /** 每轮重读配置(改 park_aging_hours 下一轮生效) */
  parkAgingHours: () => number;
  now?: () => Date;
  /**
   * Focus v0.4 ④a:确认环到点过期扫(回调注入——本模块不 import ConfirmationLoop)。
   * 与 approvals 超时同拍。实现侧应在 sweep 后紧随 processDowngradeSagas。
   */
  sweepConfirmExpired?: (nowIso: string) => void;
  /**
   * confirmation_ledger 90 天清理(finalized 且非 saga pending/failed)。
   * 实现落 confirm.ts:sweepConfirmationLedgerRetention。
   */
  sweepConfirmationLedger?: (nowIso: string) => void;
  /**
   * Focus v0.4 ④b:降格 saga 恢复扫描(pending 崩溃窗 + failed 到期重试)。
   * 与过期扫同拍;亦可仅在本回调内跑(若 sweep 侧已串联则可 no-op)。
   */
  processDowngradeSagas?: (nowIso: string) => void;
}

export interface ParkSweepResult {
  steppedToBlocked: string[];
  expired: string[];
  /** 本拍确认环过期扫是否调用 */
  confirmSweepRan?: boolean;
  /** 本拍 ledger 保留清理是否调用 */
  ledgerRetentionRan?: boolean;
  /** 本拍降格 saga 是否调用 */
  downgradeSagaRan?: boolean;
}

/** 一轮扫描(幂等;index.ts 定时器与测试共用同一函数) */
export function runParkSweep(deps: ParkSweepDeps): ParkSweepResult {
  const nowIso = (deps.now ?? (() => new Date()))().toISOString();
  const nowMs = Date.parse(nowIso);
  const hours = deps.parkAgingHours();

  // 1) 30s 步界转停靠:paused_step_boundary 超时 -> blocked (T) + 升级链叫人(trigger=blocked)
  const paused = deps.db
    .prepare("SELECT id, package_rev, updated_at FROM tasks WHERE status='paused_step_boundary'")
    .all() as { id: string; package_rev: number | null; updated_at: string }[];
  const steppedToBlocked: string[] = [];
  for (const t of paused) {
    if (nowMs - Date.parse(t.updated_at) < STEP_BOUNDARY_TIMEOUT_MS) continue;
    try {
      transitionTask(deps.db, t.id, "blocked", "T", { now: nowIso, parkAgingHours: hours });
    } catch {
      continue; // CAS 竞态:用户已应答/取消,先提交者胜
    }
    steppedToBlocked.push(t.id);
    deps.audit.record({
      actor: "daemon",
      action: "task.step_boundary_timeout",
      meta: { taskId: t.id, pausedAt: t.updated_at }
    });
    deps.callbacks.enqueue({
      taskId: t.id,
      trigger: "blocked",
      packageRevision: t.package_rev ?? 1,
      occurrenceKey: `step_timeout:${t.updated_at}`, // 该次停靠事件唯一锚(Tier1 无 questionId 的步界超时形态)
      // 09 §9 最小 proof(Codex 16 6.2):步界超时形态的可定位证据 = 超时事实锚 + 任务时点游标
      minimalProof: { exitEvidence: `step_boundary_timeout:${t.updated_at}`, transcriptCursor: `task:${t.id}@${t.updated_at}` },
      projectionCursor: `local:${nowIso}`,
      artifactChecks: []
    });
  }

  // 2) 72h 老化:parkedDeadline 到期 -> cancel_requested(park_expired)+ 后续承接
  const aged = ageOutParkedTasks(deps.db, deps.audit, nowIso);
  for (const taskId of aged.expiredTaskIds) {
    // 冻结活跃回叫(取消冻结,09 §6.3)
    deps.callbacks.freezeForTask(taskId);
    // 无活跃 run 即时 settled(停靠态本就无进行中执行的常态;有活跃 run 留 cancel_requested 走 proof 链)
    const active = (
      deps.db
        .prepare(
          "SELECT COUNT(*) AS c FROM tier1_runs WHERE task_id=? AND state IN ('reserved','running','step_paused','cancel_requested')"
        )
        .get(taskId) as { c: number }
    ).c;
    if (active === 0) {
      try {
        settleCancelNoActiveRun(deps.db, deps.audit, taskId, nowIso);
      } catch {
        // 已被并发结算:幂等继续
      }
    }
    // package 回落 draft(revision+1 待编辑;09 §6.1"转草稿"——调用方承接,parkAging 不跨域改包)
    const row = deps.db.prepare("SELECT package_id, package_rev FROM tasks WHERE id=?").get(taskId) as
      | { package_id: string | null; package_rev: number | null }
      | undefined;
    let draftOk = true; // Codex 16 6.3:revise 失败不得发送"转成草稿"成功语义的回叫(#35 话术含该承诺)
    if (row?.package_id && row.package_rev) {
      const prev = getPackage(deps.db, row.package_id, row.package_rev);
      if (prev) {
        try {
          deps.factory.revise(prev, {});
          deps.audit.record({
            actor: "daemon",
            action: "package.park_expired_draft",
            meta: { taskId, packageId: prev.id, newRevision: prev.revision + 1 }
          });
        } catch (err) {
          draftOk = false;
          deps.audit.record({
            actor: "daemon",
            action: "package.park_expired_draft_failed",
            meta: { taskId, packageId: row.package_id, error: String(err).slice(0, 160) }
          });
        }
      }
    }
    // 回叫 #35(10:"停靠三天没等到你,按规矩我取消了,内容转成草稿");occurrenceKey=taskId(09 §6.3);
    // revise 失败 => 不入队(话术承诺不成立;audit 已留告警锚,下一轮扫描因 parked 字段已清不会重试——
    // 该 package 停在旧 revision,待 owner/工程处置,不对用户虚报)
    if (draftOk) {
      deps.callbacks.enqueue({
        taskId,
        trigger: "parked_expired",
        packageRevision: row?.package_rev ?? 1,
        occurrenceKey: taskId,
        projectionCursor: `local:${nowIso}`,
        artifactChecks: []
      });
    }
  }

  // 3) 收据超时终局(Codex 16 5.3;09 §3):pending 越过 expiresAt——
  //    未决(decision NULL)=> timeout 按档终局(step_confirm=timeout_parked / direct=timeout_rejected);
  //    已 accept 未消费 => expire(expired 唯一语义)。转屏后的 voice 收据由此获得机械终局。
  const expiredReceipts = deps.db
    .prepare("SELECT id, ref_digest, decision FROM approvals WHERE outcome='pending' AND expires_at < ?")
    .all(nowIso) as { id: string; ref_digest: string; decision: string | null }[];
  for (const r of expiredReceipts) {
    try {
      if (r.decision === "accept") {
        applyReceiptEvent(deps.db, deps.audit, r.id, { kind: "expire" }, () => new Date(nowIso));
      } else {
        const pkg = deps.db
          .prepare("SELECT body_json FROM decision_packages WHERE digest=?")
          .get(r.ref_digest) as { body_json: string } | undefined;
        const mode = pkg ? ((JSON.parse(pkg.body_json) as { mode?: string }).mode ?? "step_confirm") : "step_confirm";
        applyReceiptEvent(
          deps.db,
          deps.audit,
          r.id,
          { kind: "timeout", mode: mode === "direct_to_review" ? "direct_to_review" : "step_confirm" },
          () => new Date(nowIso)
        );
      }
    } catch {
      continue; // 并发已终局:幂等继续
    }
  }

  // 4) Focus v0.4 ④a:确认环到点过期(回调;与 approvals 超时同拍)
  //    ④b:实现侧应在 sweep 后紧随 processDowngradeSagas
  let confirmSweepRan = false;
  if (deps.sweepConfirmExpired) {
    try {
      deps.sweepConfirmExpired(nowIso);
      confirmSweepRan = true;
    } catch {
      // 调用方应内部吞单条失败;此处兜底不阻断 park 扫
    }
  }

  // 5) Focus v0.4 ④b:降格 saga 恢复扫描(pending 续跑 + failed 到期重试)
  //    独立回调:即使本拍无新过期,崩溃窗/重试行仍被扫到
  let downgradeSagaRan = false;
  if (deps.processDowngradeSagas) {
    try {
      deps.processDowngradeSagas(nowIso);
      downgradeSagaRan = true;
    } catch {
      // 不阻断
    }
  }

  // 6) confirmation_ledger 90 天清理(saga pending/failed 豁免在实现侧)
  let ledgerRetentionRan = false;
  if (deps.sweepConfirmationLedger) {
    try {
      deps.sweepConfirmationLedger(nowIso);
      ledgerRetentionRan = true;
    } catch {
      // 不阻断
    }
  }

  return {
    steppedToBlocked,
    expired: aged.expiredTaskIds,
    confirmSweepRan,
    ledgerRetentionRan,
    downgradeSagaRan
  };
}
