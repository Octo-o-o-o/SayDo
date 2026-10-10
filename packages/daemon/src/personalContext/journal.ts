// §19：业务效果、源端回执和审计同事务；出站 unknown 不自动重放。
import { personalContextEffectSchema, personalContextStatusQuerySchema, digestSchema, type PersonalContextEffect } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { withSqliteAuditTransaction } from "../api/sqliteAuditTransaction.js";
import { assertPersonalContextSourceCurrent } from "./sourceAuthority.js";
import { assertPersonalContextEventSource } from "./events.js";
import { withPersonalContextClock, personalContextOperationTime } from "./clock.js";

type StatusQuery = ReturnType<typeof personalContextStatusQuerySchema.parse>;
export interface PersonalContextAuthority {
  sharesDatabase(db: Db): boolean;
  // 必须校验已认证的内部主体、当前连接/主持代次、恢复隔离及独立操作权限。
  assertEffectCurrent(effect: PersonalContextEffect): void;
  assertStatusCurrent(query: StatusQuery): void;
}
export interface OperationStatus {
  operationId: string;
  payloadDigest: string;
  state: "not_found" | "pending" | "unknown" | "applied" | "rejected" | "expired";
  sourceReceiptDigest: string | null;
}
interface Row { payload_digest: string; state: Exclude<OperationStatus["state"], "not_found">; receipt_digest: string | null }
const KEY = "installation_id=? AND node_id=? AND connection_id=? AND connection_epoch=? AND method=? AND operation_id=?";
function key(effect: PersonalContextEffect | StatusQuery) {
  const b = effect.boundary;
  return [b.installationId, b.nodeId, b.connectionId, b.connectionEpoch, effect.method === "operation/status" ? effect.originalMethod : effect.method, effect.operationId];
}

export class PersonalContextJournal {
  constructor(private readonly db: Db, private readonly audit: AuditSink, private readonly authority: PersonalContextAuthority, private readonly now: () => number = Date.now) {
    if (authority.sharesDatabase(db) !== true || audit.sharesSqlite?.(db) !== true) throw new Error("personal_context_same_database_required");
  }
  private withClock<T>(work: () => T): T {
    return withPersonalContextClock(this.db, work, this.now);
  }
  private get(value: PersonalContextEffect | StatusQuery): OperationStatus | null {
    const row = this.db.prepare(`SELECT payload_digest,state,receipt_digest FROM personal_context_operations WHERE ${KEY}`).get(...key(value)) as Row | undefined;
    if (!row) return null;
    if (row.payload_digest !== value.payloadDigest) throw new Error("personal_context_idempotency_conflict");
    return { operationId: value.operationId, payloadDigest: row.payload_digest, state: row.state, sourceReceiptDigest: row.receipt_digest };
  }
  private insert(effect: PersonalContextEffect, state: "pending" | "unknown", now: number): void {
    if (effect.expiresAt <= now) throw new Error("personal_context_expired");
    const count = this.db.prepare("SELECT count(*) n FROM personal_context_operations").get() as { n: number };
    if (count.n >= 100000) throw new Error("personal_context_journal_capacity");
    this.db.prepare("INSERT INTO personal_context_operations(installation_id,node_id,connection_id,connection_epoch,method,operation_id,payload_digest,state,expires_at,created_at,observed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(...key(effect), effect.payloadDigest, state, effect.expiresAt, now, now);
    this.audit.record({ actor: "bridge", action: "personal_context.admitted", refDigest: effect.payloadDigest, meta: { operationId: effect.operationId, method: effect.method, state } });
  }
  /** 仅用于同库的源端业务操作；apply 不得执行网络或返回异步工作。 */
  applyLocal(input: unknown, apply: (effect: PersonalContextEffect) => string): OperationStatus {
    return this.withClock(() => {
    const effect = personalContextEffectSchema.parse(input), now = personalContextOperationTime(this.db);
    if (effect.method === "event/ingest") throw new Error("personal_context_event_is_outbound_only");
    return withSqliteAuditTransaction(this.db, this.audit, () => {
      this.authority.assertEffectCurrent(effect);
      assertPersonalContextSourceCurrent(this.db, effect.link);
      const prior = this.get(effect);
      if (prior) return prior;
      this.insert(effect, "pending", now);
      const receipt = digestSchema.parse(apply(effect));
      this.db.prepare(`UPDATE personal_context_operations SET state='applied',receipt_digest=?,observed_at=? WHERE ${KEY}`).run(receipt, now, ...key(effect));
      this.audit.record({ actor: "bridge", action: "personal_context.applied", refDigest: effect.payloadDigest, meta: { operationId: effect.operationId, sourceReceiptDigest: receipt } });
      return { operationId: effect.operationId, payloadDigest: effect.payloadDigest, state: "applied", sourceReceiptDigest: receipt };
    });
    });
  }
  /** 在任何出站字节之前耐久登记。调用方必须另外在已连接的最终 writer 复核。 */
  admitOutbound(input: unknown): { admitted: boolean; status: OperationStatus } {
    return this.withClock(() => {
    const effect = personalContextEffectSchema.parse(input), now = personalContextOperationTime(this.db);
    return withSqliteAuditTransaction(this.db, this.audit, () => {
      this.authority.assertEffectCurrent(effect);
      if (effect.method === "event/ingest") assertPersonalContextEventSource(this.db, effect);
      else assertPersonalContextSourceCurrent(this.db, effect.link);
      const prior = this.get(effect);
      if (prior) return { admitted: false, status: prior };
      this.insert(effect, "unknown", now);
      return { admitted: true, status: { operationId: effect.operationId, payloadDigest: effect.payloadDigest, state: "unknown", sourceReceiptDigest: null } };
    });
    });
  }
  status(input: unknown): OperationStatus {
    return this.withClock(() => {
    const query = personalContextStatusQuerySchema.parse(input);
    personalContextOperationTime(this.db);
    return this.db.transaction((): OperationStatus => {
      this.authority.assertStatusCurrent(query);
      return this.get(query) ?? { operationId: query.operationId, payloadDigest: query.payloadDigest, state: "not_found", sourceReceiptDigest: null };
    }).immediate();
    });
  }
}
