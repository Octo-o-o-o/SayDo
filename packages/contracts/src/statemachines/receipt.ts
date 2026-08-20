// docs/09 §3 收据 outcome 转换表(唯一合法集)。C5 审批服务(4.2)消费本实现。

import type { ReceiptDecision, ReceiptOutcome } from "../types/approval.js";
import type { ExecutionMode } from "../types/project.js";

export type ReceiptEvent =
  | { kind: "user_accept" }
  | { kind: "user_reject" }
  | { kind: "user_ignore" } // 直达档 ignore 语义(09 §3:reject/ignore 同边)
  | { kind: "user_edit" } // P1(仅屏幕):superseded_by_edit + 同步签发新收据
  | { kind: "consume" } // 执行点消费(decision=accept 前提)
  | { kind: "timeout"; mode: ExecutionMode }
  | { kind: "conflict_voided" } // 他端已决 => voided_by_conflict,永不重试提交
  | { kind: "expire" }; // decision=accept 未消费越过 expiresAt(expired 的唯一语义)

export interface ReceiptSnapshot {
  outcome: ReceiptOutcome;
  decision?: ReceiptDecision | undefined;
}

export type ReceiptTransition =
  | { ok: true; next: ReceiptSnapshot }
  | { ok: false; reason: string };

export const RECEIPT_TERMINAL_OUTCOMES: readonly ReceiptOutcome[] = [
  "consumed",
  "rejected",
  "timeout_rejected",
  "timeout_parked", // 终态:人回来一律签发新收据,旧张不复活(09 §3)
  "superseded_by_edit",
  "voided_by_conflict",
  "expired"
];

export function receiptTransition(current: ReceiptSnapshot, event: ReceiptEvent): ReceiptTransition {
  if (current.outcome !== "pending") {
    return { ok: false, reason: `receipt is terminal (${current.outcome}); no transitions allowed` };
  }
  switch (event.kind) {
    case "user_accept":
      if (current.decision !== undefined) return { ok: false, reason: "already decided" };
      // accept 后保持 pending 等消费(09 §3 转换表第一行)
      return { ok: true, next: { outcome: "pending", decision: "accept" } };
    case "consume":
      if (current.decision !== "accept") return { ok: false, reason: "consume requires decision=accept" };
      return { ok: true, next: { outcome: "consumed", decision: "accept" } };
    case "user_reject":
      if (current.decision !== undefined) return { ok: false, reason: "already decided" };
      return { ok: true, next: { outcome: "rejected", decision: "reject" } };
    case "user_ignore":
      if (current.decision !== undefined) return { ok: false, reason: "already decided" };
      return { ok: true, next: { outcome: "rejected", decision: "ignore" } };
    case "user_edit":
      if (current.decision !== undefined) return { ok: false, reason: "already decided" };
      return { ok: true, next: { outcome: "superseded_by_edit", decision: "edit" } };
    case "timeout":
      if (current.decision === "accept") return { ok: false, reason: "accepted receipt does not timeout; it expires" };
      return {
        ok: true,
        next: { outcome: event.mode === "direct_to_review" ? "timeout_rejected" : "timeout_parked" }
      };
    case "conflict_voided":
      return { ok: true, next: { outcome: "voided_by_conflict" } };
    case "expire":
      if (current.decision !== "accept") return { ok: false, reason: "expired applies only to accepted-but-unconsumed" };
      return { ok: true, next: { outcome: "expired", decision: "accept" } };
  }
}
