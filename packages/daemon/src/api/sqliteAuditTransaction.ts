// E3：状态、Focus 事件与不可变审计必须在同一 SQLite 连接的锁窗内提交。
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { FocusWriteError } from "../focus/writeTx.js";
import { withPersonalContextCaptureClock, assertSynchronousContextResult } from "../personalContext/clock.js";

export function withSqliteAuditTransaction<T>(db: Db, audit: AuditSink, write: () => T): T {
  if (audit.sharesSqlite?.(db) !== true) {
    throw new FocusWriteError("audit_transaction_unavailable", "状态写入需要同库审计事务");
  }
  // 内层 FocusWriteTx 成为 savepoint；审计抛错会连同全部内层写入一并回滚。
  return withPersonalContextCaptureClock(db, () => db.transaction(() => assertSynchronousContextResult(write())).immediate());
}
