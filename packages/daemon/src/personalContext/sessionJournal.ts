// §19.2.4：所有状态变化与审计同事务。此类不创建、关闭或宣称核验 OS 句柄。
import { jcsDigest, jcsSerialize, personalContextSessionOpenSchema, type PersonalContextPeerIdentity } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { withSqliteAuditTransaction } from "../api/sqliteAuditTransaction.js";
import { withPersonalContextClock, personalContextOperationTime } from "./clock.js";

export interface PersonalContextSessionRow {
  operation_id: string; registration_id: string; registration_revision: number; request_digest: string;
  identity_json: string; key_operation_id: string; key_revision: number; boot_epoch: string;
  owner_pid: number; owner_birth: string; endpoint: string | null;
  state: "opening" | "listening" | "connected" | "stopping" | "unknown" | "closed";
  revision: number; failure_code: string | null; created_at: number; updated_at: number;
}
export class PersonalContextSessionJournal {
  constructor(private readonly db: Db, private readonly audit: AuditSink, private readonly now: () => number = Date.now) {
    if (audit.sharesSqlite?.(db) !== true) throw Error("personal_context_same_database_required");
  }
  private transaction<T>(work: () => T): T {
    if (this.db.inTransaction) throw Error("personal_context_session_outer_boundary_required");
    return withPersonalContextClock(this.db, () => withSqliteAuditTransaction(this.db, this.audit, work), this.now);
  }
  get(operationId: string): PersonalContextSessionRow | undefined {
    return this.db.prepare("SELECT * FROM personal_context_sessions WHERE operation_id=?").get(operationId) as PersonalContextSessionRow | undefined;
  }
  list(): PersonalContextSessionRow[] {
    const rows = this.db.prepare("SELECT * FROM personal_context_sessions ORDER BY created_at,operation_id LIMIT 1001").all() as PersonalContextSessionRow[];
    if (rows.length > 1000) throw Error("personal_context_session_capacity");
    return rows;
  }
  prior(input: unknown): PersonalContextSessionRow | undefined {
    const value = personalContextSessionOpenSchema.parse(input), row = this.get(value.operationId);
    if (row && row.request_digest !== jcsDigest(value)) throw Error("personal_context_session_operation_conflict");
    return row;
  }
  begin(input: unknown, facts: { identity: PersonalContextPeerIdentity; keyOperationId: string; keyRevision: number; bootEpoch: string; pid: number; birth: string }, assertCurrent: () => void): PersonalContextSessionRow {
    const value = personalContextSessionOpenSchema.parse(input);
    return this.transaction(() => {
      const prior = this.prior(value); if (prior) return prior;
      assertCurrent();
      if (facts.identity.registrationId !== value.registrationId || facts.identity.registrationRevision !== value.expectedRegistrationRevision || !Number.isSafeInteger(facts.pid) || facts.pid <= 0 || !facts.birth || !facts.bootEpoch) throw Error("personal_context_session_binding_invalid");
      const count = this.db.prepare("SELECT count(*) total, sum(state!='closed') active FROM personal_context_sessions").get() as { total: number; active: number | null };
      if (count.total >= 1000 || (count.active ?? 0) >= 8) throw Error("personal_context_session_capacity");
      const at = personalContextOperationTime(this.db);
      this.db.prepare("INSERT INTO personal_context_sessions(operation_id,registration_id,registration_revision,request_digest,identity_json,key_operation_id,key_revision,boot_epoch,owner_pid,owner_birth,state,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'opening',1,?,?)")
        .run(value.operationId, value.registrationId, value.expectedRegistrationRevision, jcsDigest(value), jcsSerialize(facts.identity), facts.keyOperationId, facts.keyRevision, facts.bootEpoch, facts.pid, facts.birth, at, at);
      const row = this.get(value.operationId)!; this.record(row); return row;
    });
  }
  transition(original: PersonalContextSessionRow, state: PersonalContextSessionRow["state"], options: { endpoint?: string; failureCode?: string; assertCurrent?: () => void } = {}): PersonalContextSessionRow {
    return this.transaction(() => {
      const current = this.get(original.operation_id);
      if (!current || jcsSerialize(current) !== jcsSerialize(original)) throw Error("personal_context_session_conflict");
      options.assertCurrent?.();
      if (options.failureCode && !/^personal_context_[a-z_]{1,100}$/u.test(options.failureCode)) throw Error("personal_context_session_failure_code");
      const changed = this.db.prepare("UPDATE personal_context_sessions SET state=?,revision=revision+1,endpoint=?,failure_code=?,updated_at=? WHERE operation_id=? AND revision=?")
        .run(state, options.endpoint ?? original.endpoint, options.failureCode ?? null, personalContextOperationTime(this.db), original.operation_id, original.revision);
      if (changed.changes !== 1) throw Error("personal_context_session_conflict");
      const row = this.get(original.operation_id)!; this.record(row); return row;
    });
  }
  isolatePreviousBoot(bootEpoch: string): void {
    // 保留未知占位；真正退出证明由平台监督器另外核实，数据库自身不构成证明。
    for (const row of this.list()) if (row.boot_epoch !== bootEpoch && row.state !== "closed" && row.state !== "unknown") this.transition(row, "unknown", { failureCode: "personal_context_session_previous_boot" });
  }
  private record(row: PersonalContextSessionRow): void {
    this.audit.record({ actor: "daemon", action: `personal_context.session_${row.state}`, meta: { operationId: row.operation_id, registrationId: row.registration_id, revision: row.revision, bootEpoch: row.boot_epoch, failureCode: row.failure_code } });
  }
}
