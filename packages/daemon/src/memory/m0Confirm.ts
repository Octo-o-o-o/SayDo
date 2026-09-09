// SD-2(2026-09-08;09 §4 / §13,借 deepseek-harness"审批由独立系统接口产生"):普通 M0 记忆确认消费。
// 模型 remember(tier=M0)只产生提议(confirm 环 kind=memory),用户封闭肯定后由本模块以 user_approved 写账本。
// 边界:claimDigest 绑定确认正文(改 claim ⇒ 拒);同一提议重复消费幂等(同 claim+同来源轮不重复写);
// 不改 ledger.add 的可信系统路径(user_stated 仍可由非模型入口直入)。

import { claimDigestOf } from "../evaluator/readinessBinding.js";
import type { MemoryPendingPayload } from "../live/confirm.js";
import type { AuditSink } from "../obs/audit.js";
import type { Db } from "../storage/db.js";
import type { MemoryLedger } from "./ledger.js";

export interface MemoryConfirmInput {
  sessionId: string;
  turnId: string;
  receiptId: string;
  payload: MemoryPendingPayload;
}

export interface MemoryConfirmDeps {
  db: Pick<Db, "prepare">;
  ledger: Pick<MemoryLedger, "add">;
  audit: AuditSink;
}

export class MemoryConfirmError extends Error {
  constructor(
    message: string,
    readonly code: "memory_claim_digest_mismatch" | "memory_tier_invalid"
  ) {
    super(message);
    this.name = "MemoryConfirmError";
  }
}

/**
 * 确认消费:校验载荷自洽 → 幂等回读 → ledger.add(M0, user_approved) → audit。
 * 返回 duplicate=true 表示同 claim+同来源轮已有 trusted M0,未再写。
 */
export function confirmMemoryProposal(deps: MemoryConfirmDeps, input: MemoryConfirmInput): { memId: string; duplicate: boolean } {
  const { payload } = input;
  if (payload.tier !== "M0") throw new MemoryConfirmError(`memory confirm only carries M0, got ${String(payload.tier)}`, "memory_tier_invalid");
  if (claimDigestOf(payload.claim) !== payload.claimDigest) {
    deps.audit.record({
      actor: "daemon",
      action: "memory.m0_confirm_rejected",
      meta: { sessionId: input.sessionId, turnId: input.turnId, receiptId: input.receiptId, reason: "claim_digest_mismatch" }
    });
    throw new MemoryConfirmError("memory proposal claim does not match its digest", "memory_claim_digest_mismatch");
  }
  const source = { kind: "user_utterance" as const, ref: payload.sourceTurnId };
  const existing = deps.db
    .prepare(
      `SELECT id FROM memory_events
       WHERE op = 'add' AND tier = 'M0' AND trust = 'user_approved' AND claim = ? AND source_json = ?
       ORDER BY ts DESC LIMIT 1`
    )
    .get(payload.claim, JSON.stringify(source)) as { id: string } | undefined;
  if (existing) {
    deps.audit.record({
      actor: "daemon",
      action: "memory.m0_confirmed",
      meta: { sessionId: input.sessionId, turnId: input.turnId, receiptId: input.receiptId, memId: existing.id, claimDigest: payload.claimDigest, duplicate: true }
    });
    return { memId: existing.id, duplicate: true };
  }
  const ev = deps.ledger.add({
    tier: "M0",
    ...(payload.projectId ? { projectId: payload.projectId } : {}),
    claim: payload.claim,
    source,
    requestedTrust: "user_approved"
  });
  deps.audit.record({
    actor: "daemon",
    action: "memory.m0_confirmed",
    meta: { sessionId: input.sessionId, turnId: input.turnId, receiptId: input.receiptId, memId: ev.id, claimDigest: payload.claimDigest, duplicate: false }
  });
  return { memId: ev.id, duplicate: false };
}
