// docs/09 §6.1 TaskCard 全量状态转换表。触发者:U=用户 / L=本地执行器 / P=投影 / T=定时器。

import type { TaskStatus } from "../types/task.js";

export type TaskTrigger = "U" | "L" | "P" | "T";

/** from -> to -> 允许的触发者集合(09 §6.1 全量表逐行照抄) */
const T: Partial<Record<TaskStatus, Partial<Record<TaskStatus, TaskTrigger[]>>>> = {
  confirmed: {
    queued: ["L"],
    cancel_requested: ["U"]
  },
  queued: {
    running: ["L", "P"],
    cancel_requested: ["U"]
  },
  running: {
    paused_step_boundary: ["L"],
    blocked: ["L", "P"],
    ready_for_review: ["L", "P"],
    cancel_requested: ["U"]
  },
  paused_step_boundary: {
    running: ["U"],
    blocked: ["T"], // 步骤边界确认 30s 无应答转 blocked 停靠(04 §5.4;不直接老化,先落 blocked 再按升级链叫人)
    cancel_requested: ["U"]
  },
  blocked: {
    running: ["U"],
    cancel_requested: ["U", "T"] // 72h 停靠老化取消(04 §6;cancelReason=park_expired)
  },
  ready_for_review: {
    running: ["U"], // 验收返工:同 task 新 attempt,这轮不作废(09 §6.1)
    review_approved_waiting_merge: ["U"],
    cancel_requested: ["U", "T"] // T:parkedDeadline 到期(转草稿)
  },
  review_approved_waiting_merge: {
    merging: ["L"], // receipt-gated(09 §3.3 红线①):唯一合法入口 = approveMerge,须携已消费 S3 收据 id 谓词
    task_done: ["P"] // 人工合并:MergeProof(treeSha 匹配)断言通过才推进(§13 reviewTask)
  },
  merging: {
    task_done: ["P"],
    merge_failed: ["P"]
  },
  merge_failed: {
    running: ["U"], // 解冲突
    ready_for_review: ["U"] // 人工转 PR
  },
  failed: {
    // retryTask 重派发(owner 2026-07-25 拍板;09 §6.1 新边):旧 run 保持终态、证据不串线,
    // attempt+1 新派发重过全部派发前置(worktree/预算/Gate 0);不开绕同仓串行队列直进 running 的第二口子;
    // 离开 failed 时活跃 trigger=failed 回叫条目置 resolved(superseded)(与离开 ready_for_review 冻结同构)
    queued: ["U"]
  },
  cancel_requested: {
    cancel_settled: ["L", "P"]
  },
  cancel_settled: {
    queued: ["L"], // 改需求缺省=同卡修订链(re-drop+retry,task 身份不变回队列)
    superseded: ["U"] // 显式换卡
  }
};

/** any -> failed(L/P:非取消失败;failed 自身除外) */
const FAILABLE: readonly TaskStatus[] = [
  "confirmed",
  "queued",
  "running",
  "paused_step_boundary",
  "blocked",
  "ready_for_review",
  "review_approved_waiting_merge",
  "merging",
  "merge_failed",
  "cancel_requested",
  "cancel_settled"
];

export function allowedTaskTriggers(from: TaskStatus, to: TaskStatus): TaskTrigger[] {
  if (to === "failed" && FAILABLE.includes(from)) return ["L", "P"];
  return T[from]?.[to] ?? [];
}

/** merging 边的 receipt-gate 谓词参数(09 §3.3 红线①,W4):已消费 S3 收据 id;缺失 ⇒ 该边不可走 */
export interface TaskTransitionGate {
  consumedS3ReceiptId?: string;
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus, trigger: TaskTrigger, gate?: TaskTransitionGate): boolean {
  if (!allowedTaskTriggers(from, to).includes(trigger)) return false;
  // review_approved_waiting_merge → merging 唯一合法入口 = approveMerge(同事务消费 S3MergeReceipt);
  // 无已消费收据 id 谓词 ⇒ 拒(daemon 无 S3MergeReceipt 不得进 merging,generic screen 收据不构成)
  if (from === "review_approved_waiting_merge" && to === "merging") {
    return typeof gate?.consumedS3ReceiptId === "string" && gate.consumedS3ReceiptId.length > 0;
  }
  return true;
}

export const TASK_TERMINAL_STATES: readonly TaskStatus[] = ["task_done", "superseded"];
