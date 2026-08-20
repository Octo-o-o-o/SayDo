// docs/09 §9 tier1_runs 状态转换表(C2 执行客户端承载)。
// step_confirm 语义:同一 SDK session 内暂停(step_paused 是 session 暂停态,续跑不产生新 run)。
// attempt 规则:返工/retryTask = INSERT 新行 attempt+1,旧行终态不动、证据不串线。

import type { Tier1RunState } from "../types/task.js";

const T: Record<Tier1RunState, Tier1RunState[]> = {
  // reserved 可直接取消(Phase4 评审 B1:requestCancel 覆盖 reserved run;09 §9 同步注记 2026-07-25)
  reserved: ["running", "cancel_requested"],
  running: ["step_paused", "settled_review", "settled_failed", "cancel_requested"],
  step_paused: ["running", "cancel_requested"],
  settled_review: [],
  settled_failed: [],
  cancel_requested: ["cancel_settled"],
  cancel_settled: []
};

export function canTransitionTier1Run(from: Tier1RunState, to: Tier1RunState): boolean {
  return T[from].includes(to);
}

export const TIER1_RUN_TERMINAL_STATES: readonly Tier1RunState[] = [
  "settled_review",
  "settled_failed",
  "cancel_settled"
];
