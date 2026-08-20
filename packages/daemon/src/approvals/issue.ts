// 拍板流程与 dispatch_package 收据签发(计划 3.4;09 §2/§3;modules/a A6 ⑤)。
// P0 单档:固定逐步确认(step_confirm),不询问两档——中性二选一话术随直达档 P0.5-C 启用。
// 收据语义:接入 0.2b 状态机(receiptTransition)+ 0.3 DDL CHECK,不重建第三层;
// riskLevel = 包内 grants 最高级(无 grants = S1,09 §3);合法组合矩阵由 schema superRefine + DDL 双层把守。

import { randomUUID } from "node:crypto";
import {
  newId,
  receiptTransition,
  type ApprovalReceipt,
  type DecisionPackage,
  type ReceiptEvent
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { insertApproval, getApproval } from "../storage/dao/approvals.js";
import { updatePackageStatus } from "../storage/dao/packages.js";
import { computeRisk, type RiskLevel } from "../policy/engine.js";
import type { AuditSink } from "../obs/audit.js";
import { captureFocusAuthSnapshot, storeFocusAuthSnapshot } from "../focus/binding.js";

/** dispatch_package 收据的 riskLevel = 包内 grants 最高级;无 grants = S1(09 §3) */
export function packageRiskLevel(pkg: DecisionPackage): RiskLevel {
  if (pkg.preauthorizedEffects.length === 0) return "S1";
  let level: RiskLevel = "S1";
  for (const g of pkg.preauthorizedEffects) {
    const r = computeRisk(
      {
        kind: g.effect,
        ...(g.constraints.branchPattern !== undefined ? { target: g.constraints.branchPattern } : {}),
        triggersDeployPreview: g.downstreamTriggers === "ci_preview"
      },
      {}
    );
    if (["S0", "S1", "S2", "S3"].indexOf(r.level) > ["S0", "S1", "S2", "S3"].indexOf(level)) level = r.level;
  }
  return level;
}

export interface IssueInput {
  pkg: DecisionPackage;
  decidedVia: ApprovalReceipt["decidedVia"];
  authStrength: ApprovalReceipt["authStrength"];
  sessionId?: string;
  /** decidedVia=voice 时必填(IntentLedger 关联,G5) */
  turnRef?: string;
  taskId?: string;
  /** 收据超时窗口(缺省 params.receipt_timeout_sec=45) */
  timeoutSec?: number;
}

/** 签发 dispatch_package 收据(pending;accept/consume 走状态机) */
export function issueDispatchReceipt(db: Db, audit: AuditSink, input: IssueInput, now: () => Date): ApprovalReceipt {
  const issuedAt = now();
  const receipt: ApprovalReceipt = {
    id: newId("apr"),
    kind: "dispatch_package",
    refDigest: input.pkg.digest,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.turnRef ? { turnRef: input.turnRef } : {}),
    riskLevel: packageRiskLevel(input.pkg),
    principal: "owner",
    decidedVia: input.decidedVia,
    authStrength: input.authStrength,
    nonce: randomUUID(),
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + (input.timeoutSec ?? 45) * 1000).toISOString(),
    outcome: "pending"
  };
  insertApproval(db, receipt); // schema superRefine 矩阵 + DDL CHECK 双层把守
  // C5:签发时冻结 Focus 授权快照(session 无 Focus → null 行,dispatch 时 binding 不建)
  const snap = captureFocusAuthSnapshot(db, input.sessionId);
  storeFocusAuthSnapshot(db, receipt.id, snap, issuedAt.toISOString());
  audit.record({
    actor: "daemon",
    action: "approval.issue",
    meta: {
      receiptId: receipt.id,
      kind: receipt.kind,
      risk: receipt.riskLevel,
      decidedVia: receipt.decidedVia,
      focusSnapshot: snap
        ? {
            focusId: snap.focusId,
            focusRevision: snap.focusRevision,
            focusAnchorRevision: snap.focusAnchorRevision,
            authorityEpoch: snap.authorityEpoch
          }
        : null
    }
  });
  return receipt;
}

/** 收据状态推进(唯一写路径:0.2b 状态机裁决,非法转换拒) */
export function applyReceiptEvent(
  db: Db,
  audit: AuditSink,
  receiptId: string,
  event: ReceiptEvent,
  now: () => Date
): ApprovalReceipt {
  const current = getApproval(db, receiptId);
  if (!current) throw new Error(`receipt not found: ${receiptId}`);
  const t = receiptTransition({ outcome: current.outcome, decision: current.decision }, event);
  if (!t.ok) throw new Error(`receipt transition rejected: ${t.reason}`);
  const ts = now().toISOString();
  const isDecision = event.kind === "user_accept" || event.kind === "user_reject" || event.kind === "user_ignore";
  db.prepare(
    `UPDATE approvals SET outcome = ?, decision = ?,
       decided_at = COALESCE(decided_at, CASE WHEN ? THEN ? END),
       consumed_at = CASE WHEN ? = 'consumed' THEN ? ELSE consumed_at END
     WHERE id = ?`
  ).run(t.next.outcome, t.next.decision ?? null, isDecision ? 1 : 0, ts, t.next.outcome, ts, receiptId);
  audit.record({
    actor: "daemon",
    action: "approval.transition",
    meta: { receiptId, event: event.kind, outcome: t.next.outcome }
  });
  return getApproval(db, receiptId) as ApprovalReceipt;
}

/**
 * 拍板流程(P0 单档):draft 包 -> proposed -> 语音 accept -> dispatch 点消费 -> approved。
 * mode 固定 step_confirm(组包时已定),不在拍板时询问两档(3.4 注)。
 */
export function approvePackageWithReceipt(
  db: Db,
  audit: AuditSink,
  pkg: DecisionPackage,
  receiptId: string
): void {
  const receipt = getApproval(db, receiptId);
  if (!receipt) throw new Error(`receipt not found: ${receiptId}`);
  if (receipt.outcome !== "consumed") throw new Error("package approval requires a consumed dispatch receipt");
  if (receipt.refDigest !== pkg.digest) throw new Error("receipt refDigest does not match package digest");
  updatePackageStatus(db, pkg.id, pkg.revision, "approved");
  audit.record({
    actor: "daemon",
    action: "package.approve",
    meta: { packageId: pkg.id, revision: pkg.revision, receiptId }
  });
}
