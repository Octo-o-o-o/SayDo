// §19.2.3：只在正式备份的独立 SQLite 副本调用；不读取或删除系统凭据。
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { withSqliteAuditTransaction } from "../api/sqliteAuditTransaction.js";
import { withPersonalContextClock, personalContextOperationTime } from "./clock.js";

export function quarantinePersonalContextBackup(db: Db, audit: AuditSink): { registrations: number; keys: number } {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='personal_context_registrations'").get()) return { registrations: 0, keys: 0 };
  if (db.inTransaction) throw Error("personal_context_backup_outer_boundary_required");
  return withPersonalContextClock(db, () => withSqliteAuditTransaction(db, audit, () => {
    const registrations = db.prepare("SELECT id,revision FROM personal_context_registrations WHERE state!='revoked' ORDER BY id LIMIT 1001").all() as { id: string; revision: number }[];
    if (registrations.length > 1000) throw Error("personal_context_backup_capacity");
    let keys = 0;
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='personal_context_key_preparations'").get()) {
      const rows = db.prepare("SELECT operation_id,registration_id,revision,state FROM personal_context_key_preparations WHERE state!='revoked' ORDER BY operation_id LIMIT 1001").all() as { operation_id: string; registration_id: string; revision: number; state: string }[];
      if (rows.length > 1000) throw Error("personal_context_backup_capacity");
      const at = personalContextOperationTime(db);
      for (const row of rows) {
        let revision = row.revision;
        if (row.state === "pending") {
          db.prepare("UPDATE personal_context_key_preparations SET state='unknown',revision=revision+1,os_result='unknown',retained=1,updated_at=? WHERE operation_id=? AND revision=?").run(at, row.operation_id, revision++);
          audit.record({ actor: "daemon", action: "personal_context.key_backup_unknown", meta: { operationId: row.operation_id, revision } });
        }
        const changed = db.prepare("UPDATE personal_context_key_preparations SET state='revoked',revision=revision+1,updated_at=? WHERE operation_id=? AND revision=? AND state IN ('stored','unknown')").run(at, row.operation_id, revision);
        if (changed.changes !== 1) throw Error("personal_context_backup_key_conflict");
        audit.record({ actor: "daemon", action: "personal_context.key_backup_revoked", meta: { operationId: row.operation_id, revision: revision + 1 } }); keys++;
      }
    }
    for (const row of registrations) {
      const changed = db.prepare("UPDATE personal_context_registrations SET state='revoked',revision=revision+1 WHERE id=? AND revision=?").run(row.id, row.revision);
      if (changed.changes !== 1) throw Error("personal_context_backup_registration_conflict");
      db.prepare("UPDATE personal_context_permissions SET state='revoked',revision=revision+1 WHERE registration_id=? AND state='active'").run(row.id);
      audit.record({ actor: "daemon", action: "personal_context.registration_backup_revoked", meta: { id: row.id, revision: row.revision + 1 } });
    }
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='personal_context_sessions'").get()) {
      const sessions = db.prepare("SELECT operation_id,revision FROM personal_context_sessions WHERE state NOT IN ('unknown','closed') ORDER BY operation_id LIMIT 1001").all() as { operation_id: string; revision: number }[];
      if (sessions.length > 1000) throw Error("personal_context_backup_capacity");
      for (const session of sessions) {
        const changed = db.prepare("UPDATE personal_context_sessions SET state='unknown',revision=revision+1,failure_code='personal_context_session_backup_quarantine',updated_at=? WHERE operation_id=? AND revision=?").run(personalContextOperationTime(db), session.operation_id, session.revision);
        if (changed.changes !== 1) throw Error("personal_context_backup_session_conflict");
        audit.record({ actor: "daemon", action: "personal_context.session_backup_unknown", meta: { operationId: session.operation_id, revision: session.revision + 1 } });
      }
    }
    return { registrations: registrations.length, keys };
  }));
}
