// SD-2(2026-09-08;09 §4 / §13,借 deepseek-harness"审批由独立系统接口产生"):普通 M0 记忆确认消费。
// 模型 remember(tier=M0)只产生提议(confirm 环 kind=memory),用户封闭肯定后由本模块以 user_approved 写账本。
// 边界:claimDigest 绑定确认正文(改 claim ⇒ 拒);同一提议重复消费幂等(同 claim+同来源轮不重复写);
// 不改 ledger.add 的可信系统路径(user_stated 仍可由非模型入口直入)。
// 09 §13:同 SQLite 上 memory_events + memory.m0_confirmed 同一事务。
// 拒写审计不得被外层事务吞掉;同步第二连接不能在第一连接持写锁时独立提交同库。
// 调用方若已持有 SQLite 事务:本函数拒绝落账,把拒写审计交给外层在回滚后持久化。

import { claimDigestOf } from "../evaluator/readinessBinding.js";
import type { MemoryPendingPayload } from "../live/confirm.js";
import type { AuditEvent, AuditSink } from "../obs/audit.js";
import type { Db } from "../storage/db.js";
import type { MemoryLedger } from "./ledger.js";
import { assertPersistableStrings, isMemorySecretLiteralError } from "./credentialLiterals.js";

export interface MemoryConfirmInput {
  sessionId: string;
  turnId: string;
  receiptId: string;
  payload: MemoryPendingPayload;
}

export interface MemoryConfirmDeps {
  db: Pick<Db, "prepare"> & {
    transaction?: Db["transaction"];
    inTransaction?: boolean;
  };
  ledger: Pick<MemoryLedger, "add">;
  audit: AuditSink;
}

export type MemoryConfirmPersist = "none" | "unknown";

export class MemoryConfirmError extends Error {
  constructor(
    message: string,
    readonly code: "memory_claim_digest_mismatch" | "memory_tier_invalid",
    readonly persist: MemoryConfirmPersist = "none"
  ) {
    super(message);
    this.name = "MemoryConfirmError";
  }
}

/** 落账/确认审计失败。persist=none 表示可确认未保存;unknown 表示结果待核实。 */
export class MemoryConfirmWriteError extends Error {
  readonly persist: MemoryConfirmPersist;
  constructor(message: string, persist: MemoryConfirmPersist, cause?: unknown) {
    super(message);
    this.name = "MemoryConfirmWriteError";
    this.persist = persist;
    if (cause instanceof Error) this.cause = cause;
  }
}

/**
 * 调用方事务内无法安全兑现的边界。
 * pendingRejectAudit 须由外层在事务回滚后写入;同步嵌套 SQLite 不能独立提交同库。
 */
export class MemoryConfirmBoundaryError extends Error {
  readonly persist: MemoryConfirmPersist;
  readonly pendingRejectAudit?: AuditEvent;
  constructor(
    message: string,
    persist: MemoryConfirmPersist,
    opts?: { pendingRejectAudit?: AuditEvent; cause?: unknown }
  ) {
    super(message);
    this.name = "MemoryConfirmBoundaryError";
    this.persist = persist;
    if (opts?.pendingRejectAudit) this.pendingRejectAudit = opts.pendingRejectAudit;
    if (opts?.cause instanceof Error) this.cause = opts.cause;
  }
}

export function memoryConfirmPersistOf(err: unknown): MemoryConfirmPersist {
  if (
    err instanceof MemoryConfirmError ||
    err instanceof MemoryConfirmWriteError ||
    err instanceof MemoryConfirmBoundaryError
  ) {
    return err.persist;
  }
  if (isMemorySecretLiteralError(err)) return "none";
  return "unknown";
}

export function memoryConfirmPendingRejectAuditOf(err: unknown): AuditEvent | undefined {
  return err instanceof MemoryConfirmBoundaryError ? err.pendingRejectAudit : undefined;
}

function callerHoldsTransaction(db: MemoryConfirmDeps["db"]): boolean {
  return db.inTransaction === true;
}

function persistRejectAudit(deps: MemoryConfirmDeps, event: AuditEvent, cause: Error): never {
  if (callerHoldsTransaction(deps.db)) {
    throw new MemoryConfirmBoundaryError(cause.message, "none", { pendingRejectAudit: event, cause });
  }
  try {
    deps.audit.record(event);
  } catch (err) {
    throw new MemoryConfirmWriteError("memory confirm reject audit failed", "none", err);
  }
  throw cause;
}

function sameSqliteAudit(deps: MemoryConfirmDeps): boolean {
  return deps.audit.sharesSqlite?.(deps.db) === true;
}

/**
 * 确认消费:校验载荷自洽 → 幂等回读 → ledger.add(M0, user_approved) + audit。
 * 同库 SQLite(sharesSqlite)时 add + memory.m0_confirmed 同一事务,失败回滚。
 * 返回 duplicate=true 表示同 claim+同来源轮已有 trusted M0,未再写。
 */
export function confirmMemoryProposal(deps: MemoryConfirmDeps, input: MemoryConfirmInput): { memId: string; duplicate: boolean } {
  const { payload } = input;
  if (payload.tier !== "M0") {
    throw new MemoryConfirmError(`memory confirm only carries M0, got ${String(payload.tier)}`, "memory_tier_invalid");
  }
  if (claimDigestOf(payload.claim) !== payload.claimDigest) {
    persistRejectAudit(
      deps,
      {
        actor: "daemon",
        action: "memory.m0_confirm_rejected",
        meta: { sessionId: input.sessionId, turnId: input.turnId, receiptId: input.receiptId, reason: "claim_digest_mismatch" }
      },
      new MemoryConfirmError("memory proposal claim does not match its digest", "memory_claim_digest_mismatch")
    );
  }
  const source = { kind: "user_utterance" as const, ref: payload.sourceTurnId };
  try {
    assertPersistableStrings([payload.claim, source.ref]);
  } catch (err) {
    if (isMemorySecretLiteralError(err)) {
      persistRejectAudit(
        deps,
        {
          actor: "daemon",
          action: "memory.secret_literal_rejected",
          meta: {
            tier: "M0",
            ...(payload.projectId ? { projectId: payload.projectId } : {}),
            hits: err.hits.map((hit) => ({ kind: hit.kind, spanDigest: hit.spanDigest }))
          }
        },
        err
      );
    }
    throw err;
  }
  const existing = deps.db
    .prepare(
      `SELECT id FROM memory_events
       WHERE op = 'add' AND tier = 'M0' AND trust = 'user_approved' AND claim = ? AND source_json = ?
       ORDER BY ts DESC LIMIT 1`
    )
    .get(payload.claim, JSON.stringify(source)) as { id: string } | undefined;

  if (callerHoldsTransaction(deps.db)) {
    if (existing) {
      throw new MemoryConfirmBoundaryError(
        "memory confirm cannot isolate duplicate audit inside a caller SQLite transaction",
        "unknown"
      );
    }
    throw new MemoryConfirmBoundaryError(
      "confirmMemoryProposal cannot run inside a caller SQLite transaction",
      "none"
    );
  }

  if (existing) {
    try {
      deps.audit.record({
        actor: "daemon",
        action: "memory.m0_confirmed",
        meta: { sessionId: input.sessionId, turnId: input.turnId, receiptId: input.receiptId, memId: existing.id, claimDigest: payload.claimDigest, duplicate: true }
      });
    } catch (err) {
      throw new MemoryConfirmWriteError("memory confirm audit failed", "unknown", err);
    }
    return { memId: existing.id, duplicate: true };
  }

  const write = (): ReturnType<MemoryLedger["add"]> => {
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
    return ev;
  };

  if (sameSqliteAudit(deps) && typeof deps.db.transaction === "function") {
    try {
      const ev = deps.db.transaction(write)();
      return { memId: ev.id, duplicate: false };
    } catch (err) {
      if (err instanceof MemoryConfirmError || err instanceof MemoryConfirmBoundaryError || isMemorySecretLiteralError(err)) {
        throw err;
      }
      throw new MemoryConfirmWriteError("memory confirm write rolled back", "none", err);
    }
  }

  let added = false;
  try {
    const ev = deps.ledger.add({
      tier: "M0",
      ...(payload.projectId ? { projectId: payload.projectId } : {}),
      claim: payload.claim,
      source,
      requestedTrust: "user_approved"
    });
    added = true;
    deps.audit.record({
      actor: "daemon",
      action: "memory.m0_confirmed",
      meta: { sessionId: input.sessionId, turnId: input.turnId, receiptId: input.receiptId, memId: ev.id, claimDigest: payload.claimDigest, duplicate: false }
    });
    return { memId: ev.id, duplicate: false };
  } catch (err) {
    if (err instanceof MemoryConfirmError || err instanceof MemoryConfirmBoundaryError || isMemorySecretLiteralError(err)) {
      throw err;
    }
    throw new MemoryConfirmWriteError(
      added ? "memory confirm audit failed after write" : "memory confirm write result unknown",
      // 非共享 sink 无法确认 ledger.add 抛错前是否已 insert；不能冒称没有落账。
      "unknown",
      err
    );
  }
}
