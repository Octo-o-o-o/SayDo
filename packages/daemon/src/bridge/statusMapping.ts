// A4 Hopper -> SayDo 状态投影 total mapping(P0.5-A;09 §7,SoT=裁决 §2.3.3)。
// 语义红线:① ReviewApproved 不改状态(approved != done);② tree_mismatch/rolled_back 状态不变;
// ③ "排队"只许说 ready(分诊出口=等人);④ ready ∧ risk=high 无自动执行路径(bridge 不得代跑,含 retry)。
// 本地态(confirmed/paused_step_boundary/cancel_requested/superseded)不由投影产生。

import type { HopperTaskState } from "@saydo/contracts";

export interface ProjectionInput {
  task: HopperTaskState;
  /** 投影 risk(triage 按正文关键词算,覆盖 frontmatter) */
  riskHigh?: boolean;
  /** ready 档:queue explain=executable 且无活跃 run 才是"排队中" */
  queueExecutable?: boolean;
  hasActiveRun?: boolean;
  /** review 档:settle 判定(§6.3)通过才 ready_for_review */
  settleOk?: boolean;
  /** review show 四字段:approved && binding.run_id==runId && binding.evidence_digest==evidenceDigest */
  approvedBindingMatch?: boolean;
  /** MergeStarted->MergeFinished 间(bridge 同步调用存活期) */
  mergeInFlight?: boolean;
  /** MergeFinished.status=conflict */
  mergeConflict?: boolean;
  /** failed 档:last_reason */
  lastReason?: string;
  /** archived 档:final_status */
  archivedFinalStatus?: "done" | "failed";
  /** blocked 档来源(10 #30 四话术) */
  blockedSource?: "triage_missing_info" | "guard_findings" | "runner_question";
  /** conflict 档来源(09 §7 两行:TaskTriaged 重复 vs MergeFinished.status=conflict——评审 B4)。
   *  判别键已对锁定副本实证(2026-07-25):merge 冲突时 Hopper 发 MergeFinished{status:"conflict"}
   *  且投影置 conflict——C3 消费者看到该事件 => conflictSource="merge";TaskTriaged 来源(无 runs/
   *  无 MergeFinished)=> "triage"。另实证:merge 前有门(未 approve/binding 缺/acceptance=needs_human
   *  未 waive => blocked_gates 退出 1,不发 Merge 事件、投影留 review——门拒 != 冲突)。 */
  conflictSource?: "triage" | "merge";
}

export interface Projection {
  status:
    | "queued"
    | "blocked"
    | "running"
    | "ready_for_review"
    | "review_approved_waiting_merge"
    | "merging"
    | "merge_failed"
    | "task_done"
    | "failed"
    | "cancel_settled"
    // review 档 settle 未过:保持 running 口径(不提前说等你验收——状态词纪律)
    | "running_pending_settle";
  userPhrase: string;
}

/** total mapping:14 值枚举全覆盖,未知输入抛错(fail-closed,禁静默投影) */
export function projectHopperStatus(i: ProjectionInput): Projection {
  switch (i.task) {
    case "received":
      return { status: "queued", userPhrase: "已接单·分诊中" };
    case "ready":
      if (i.riskHigh) {
        return { status: "blocked", userPhrase: "内容被安全闸门判高风险,不会自动执行——改说法降风险,或转成逐步盯着做" };
      }
      if (i.queueExecutable && !i.hasActiveRun) return { status: "queued", userPhrase: "排队中" };
      return { status: "queued", userPhrase: "已接单·等调度" };
    case "draft":
    case "plan_needed":
    case "research":
      return { status: "blocked", userPhrase: "需要你确认再开工" };
    case "deferred":
      return { status: "blocked", userPhrase: "已挂起(分诊判定先不做,要做请说)" };
    case "conflict":
      // 双来源分流(09 §7):merge 来源 = 合并冲突(merge_failed);triage 来源 = 疑似重复(blocked)
      if (i.conflictSource === "merge") return { status: "merge_failed", userPhrase: "合并冲突(人解冲突或 retry 重取证)" };
      return { status: "blocked", userPhrase: "疑似与已有任务重复/冲突" };
    case "blocked":
      switch (i.blockedSource) {
        case "guard_findings":
          return { status: "blocked", userPhrase: "方案被安全闸门拒了" };
        case "runner_question":
          return { status: "blocked", userPhrase: "agent 有问题要问你" };
        default:
          return { status: "blocked", userPhrase: "开工前需要你补信息" };
      }
    case "running":
      return { status: "running", userPhrase: "执行中" };
    case "review":
      if (i.approvedBindingMatch) return { status: "review_approved_waiting_merge", userPhrase: "已批准·待合并" };
      if (i.mergeConflict) return { status: "merge_failed", userPhrase: "合并冲突" };
      if (i.mergeInFlight) return { status: "merging", userPhrase: "合并中" };
      if (i.settleOk) return { status: "ready_for_review", userPhrase: "等你验收" };
      return { status: "running_pending_settle", userPhrase: "执行收尾中(settle 未齐,先不叫人)" };
    case "done":
      return { status: "task_done", userPhrase: "已交付" };
    case "failed":
      if (i.lastReason === "cancelled_by_user") return { status: "cancel_settled", userPhrase: "已取消" };
      return { status: "failed", userPhrase: "失败了" };
    case "rejected":
      return { status: "failed", userPhrase: "已打回终止" };
    case "archived":
      return i.archivedFinalStatus === "failed"
        ? { status: "failed", userPhrase: "已归档(失败)" }
        : { status: "task_done", userPhrase: "已归档(交付)" };
  }
}

/** ready ∧ high 红线判定(§6.2 retry 闸门消费同源) */
export function isAutoExecutionForbidden(i: ProjectionInput): boolean {
  return i.task === "ready" && i.riskHigh === true;
}
