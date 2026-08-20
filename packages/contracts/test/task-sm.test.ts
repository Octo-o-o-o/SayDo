// §6.1 TaskCard 全量转换表 + §9 tier1_runs 转换表 + §6.3 outbox 状态机。

import { describe, expect, it } from "vitest";
import { canTransitionTask, allowedTaskTriggers } from "../src/statemachines/task.js";
import { canTransitionTier1Run } from "../src/statemachines/tier1run.js";
import { canTransitionOutbox } from "../src/statemachines/outbox.js";

describe("§6.1 TaskCard 状态机", () => {
  it("主链:confirmed->queued->running->ready_for_review->review_approved_waiting_merge->merging->task_done", () => {
    expect(canTransitionTask("confirmed", "queued", "L")).toBe(true);
    expect(canTransitionTask("queued", "running", "L")).toBe(true);
    expect(canTransitionTask("running", "ready_for_review", "L")).toBe(true);
    expect(canTransitionTask("ready_for_review", "review_approved_waiting_merge", "U")).toBe(true);
    // merging 边 receipt-gated(09 §3.3 红线①,W4):须携已消费 S3 收据 id 谓词
    expect(canTransitionTask("review_approved_waiting_merge", "merging", "L", { consumedS3ReceiptId: "apr_x" })).toBe(true);
    expect(canTransitionTask("merging", "task_done", "P")).toBe(true);
  });

  it("W4(09 §3.3 红线①):merging 边无已消费 S3 收据谓词 ⇒ 拒(无 S3MergeReceipt 不进 merging)", () => {
    expect(canTransitionTask("review_approved_waiting_merge", "merging", "L")).toBe(false);
    expect(canTransitionTask("review_approved_waiting_merge", "merging", "L", {})).toBe(false);
    expect(canTransitionTask("review_approved_waiting_merge", "merging", "L", { consumedS3ReceiptId: "" })).toBe(false);
    // 谓词只作用于该边:其他边不受影响
    expect(canTransitionTask("review_approved_waiting_merge", "task_done", "P")).toBe(true);
  });

  it("验收返工:ready_for_review->running 仅 U 触发(这轮不作废)", () => {
    expect(canTransitionTask("ready_for_review", "running", "U")).toBe(true);
    expect(canTransitionTask("ready_for_review", "running", "L")).toBe(false);
  });

  it("人工合并:review_approved_waiting_merge->task_done 仅投影(MergeProof watcher)触发", () => {
    expect(allowedTaskTriggers("review_approved_waiting_merge", "task_done")).toEqual(["P"]);
  });

  it("取消:任意可取消态 -> cancel_requested -> cancel_settled;settled 后同卡回 queued 或显式换卡", () => {
    for (const from of ["confirmed", "queued", "running", "blocked", "paused_step_boundary", "ready_for_review"] as const) {
      expect(canTransitionTask(from, "cancel_requested", "U")).toBe(true);
    }
    expect(canTransitionTask("cancel_requested", "cancel_settled", "L")).toBe(true);
    expect(canTransitionTask("cancel_settled", "queued", "L")).toBe(true);
    expect(canTransitionTask("cancel_settled", "superseded", "U")).toBe(true);
  });

  it("停靠老化:ready_for_review / blocked -> cancel_requested 允许 T 触发(park_expired)", () => {
    expect(canTransitionTask("ready_for_review", "cancel_requested", "T")).toBe(true);
    expect(canTransitionTask("blocked", "cancel_requested", "T")).toBe(true);
  });

  it("步骤边界 30s 无应答:paused_step_boundary -> blocked 由 T 触发(不直接老化取消)", () => {
    expect(canTransitionTask("paused_step_boundary", "blocked", "T")).toBe(true);
    // paused 不直接老化取消(先转 blocked 再按升级链)
    expect(canTransitionTask("paused_step_boundary", "cancel_requested", "T")).toBe(false);
  });

  it("非法转换拒绝:task_done/superseded 是终态;跳级不许", () => {
    expect(canTransitionTask("task_done", "running", "L")).toBe(false);
    expect(canTransitionTask("superseded", "queued", "L")).toBe(false);
    expect(canTransitionTask("confirmed", "running", "L")).toBe(false);
    expect(canTransitionTask("queued", "ready_for_review", "L")).toBe(false);
  });

  it("any -> failed(L/P;含 merge/blocked 等;failed 自身除外)", () => {
    expect(canTransitionTask("running", "failed", "L")).toBe(true);
    expect(canTransitionTask("merging", "failed", "P")).toBe(true);
    expect(canTransitionTask("failed", "failed", "L")).toBe(false);
    expect(canTransitionTask("running", "failed", "U")).toBe(false); // 用户不能"判失败"
  });

  it("retryTask 重派发:failed -> queued 仅 U 触发(09 §6.1 2026-07-25 新边;不直进 running)", () => {
    expect(canTransitionTask("failed", "queued", "U")).toBe(true);
    expect(allowedTaskTriggers("failed", "queued")).toEqual(["U"]);
    expect(canTransitionTask("failed", "running", "U")).toBe(false); // 禁绕队列直进 running
    expect(canTransitionTask("failed", "queued", "L")).toBe(false);
    expect(canTransitionTask("failed", "queued", "T")).toBe(false);
  });
});

describe("§9 tier1_runs 状态机", () => {
  it("合法链:reserved->running<->step_paused->settled_review", () => {
    expect(canTransitionTier1Run("reserved", "running")).toBe(true);
    expect(canTransitionTier1Run("running", "step_paused")).toBe(true);
    expect(canTransitionTier1Run("step_paused", "running")).toBe(true);
    expect(canTransitionTier1Run("running", "settled_review")).toBe(true);
    expect(canTransitionTier1Run("running", "settled_failed")).toBe(true);
  });
  it("取消链:running/step_paused->cancel_requested->cancel_settled;终态不动", () => {
    expect(canTransitionTier1Run("running", "cancel_requested")).toBe(true);
    expect(canTransitionTier1Run("step_paused", "cancel_requested")).toBe(true);
    expect(canTransitionTier1Run("cancel_requested", "cancel_settled")).toBe(true);
    expect(canTransitionTier1Run("settled_review", "running")).toBe(false);
    expect(canTransitionTier1Run("cancel_settled", "running")).toBe(false);
  });
});

describe("§6.3 outbox 状态机", () => {
  it("pending->notified->acked->requeued->notified(升级);活跃态可 resolved", () => {
    expect(canTransitionOutbox("pending", "notified")).toBe(true);
    expect(canTransitionOutbox("notified", "acked")).toBe(true);
    expect(canTransitionOutbox("acked", "requeued")).toBe(true);
    expect(canTransitionOutbox("requeued", "notified")).toBe(true);
    for (const s of ["pending", "notified", "acked", "requeued"] as const) {
      expect(canTransitionOutbox(s, "resolved")).toBe(true);
    }
    expect(canTransitionOutbox("resolved", "notified")).toBe(false);
  });
  it("requeued 唯一语义:只能从 acked 进入", () => {
    expect(canTransitionOutbox("pending", "requeued")).toBe(false);
    expect(canTransitionOutbox("notified", "requeued")).toBe(false);
  });
});
