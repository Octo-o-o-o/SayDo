import type { Db } from "../storage/db.js";

const observations = new WeakMap<Db, number>();

export function personalContextOperationTime(db: Db): number {
  const at = observations.get(db);
  if (at === undefined) throw new Error("personal_context_clock_scope_required");
  // 等待写锁期间其他连接可能推进水位；只能收紧，不能重新读墙钟。
  const current = db.prepare("SELECT high_water FROM personal_context_clock WHERE singleton=1").get() as { high_water: number } | undefined;
  if (!current || !Number.isSafeInteger(current.high_water) || current.high_water < at) throw new Error("personal_context_clock_damaged");
  return current.high_water;
}

export function assertSynchronousContextResult<T>(value: T): T {
  if (value !== null && (typeof value === "object" || typeof value === "function") && "then" in value) {
    throw new Error("personal_context_async_transaction_forbidden");
  }
  return value;
}

// 原始嵌套事务无法独立提交时间；不制造可信观察，捕获处有映射时会拒绝。
export function withPersonalContextClock<T>(db: Db, work: () => T, now: () => number = Date.now): T {
  if (observations.has(db) || db.inTransaction) return assertSynchronousContextResult(work());
  observations.set(db, observePersonalContextClock(db, now));
  try { return assertSynchronousContextResult(work()); }
  finally { observations.delete(db); }
}

// 未登记跨产品事件时，原生业务不额外产生个人上下文时钟写入。
export function withPersonalContextCaptureClock<T>(db: Db, work: () => T): T {
  if (!observations.has(db) && !db.inTransaction &&
      !db.prepare("SELECT 1 FROM personal_context_event_mappings WHERE state='active' LIMIT 1").get()) {
    return assertSynchronousContextResult(work());
  }
  return withPersonalContextClock(db, work);
}

// 独立提交观察水位，后续业务事务失败不得使已经过期的许可复活。
export function observePersonalContextClock(db: Db, now: () => number = Date.now): number {
  if (db.inTransaction) throw new Error("personal_context_clock_requires_outer_boundary");
  const observed = now();
  if (!Number.isSafeInteger(observed) || observed < 0) throw new Error("personal_context_clock_invalid");
  const result = db.prepare("UPDATE personal_context_clock SET high_water=MAX(high_water,?) WHERE singleton=1").run(observed);
  if (result.changes !== 1) throw new Error("personal_context_clock_missing");
  return (db.prepare("SELECT high_water FROM personal_context_clock WHERE singleton=1").get() as { high_water: number }).high_water;
}
