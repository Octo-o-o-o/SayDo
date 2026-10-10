import type { Db } from "../storage/db.js";

interface ClockObservation { at: number; minimum: number; started: number; last: number }
const observations = new WeakMap<Db, ClockObservation>();
const uncommittedMinimum = new WeakMap<Db, number>();

export function personalContextOperationTime(db: Db): number {
  const scope = observations.get(db);
  if (scope === undefined) throw new Error("personal_context_clock_scope_required");
  // 等待写锁期间其他连接可能推进水位；只能收紧，不能重新读墙钟。
  const current = db.prepare("SELECT high_water FROM personal_context_clock WHERE singleton=1").get() as { high_water: number } | undefined;
  if (!current || !Number.isSafeInteger(current.high_water) || current.high_water < scope.at) throw new Error("personal_context_clock_damaged");
  return Math.max(current.high_water, scope.minimum);
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
  const started = performance.now();
  if (!Number.isFinite(started) || started < 0) throw new Error("personal_context_clock_invalid");
  const at = observePersonalContextClock(db, now), scope = { at, minimum: at, started, last: started };
  observations.set(db, scope);
  let failed = false, original: unknown, result!: T;
  try { result = assertSynchronousContextResult(work()); }
  catch (error) { failed = true; original = error; }
  finally { observations.delete(db); }
  // 最外业务事务已结束；即使该事务回滚，也独立保留阻塞期间已观察到的水位。
  if (scope.minimum > scope.at) {
    try {
      if (db.inTransaction) throw new Error("personal_context_clock_requires_outer_boundary");
      uncommittedMinimum.set(db, Math.max(uncommittedMinimum.get(db) ?? 0, scope.minimum));
      const changed = db.prepare("UPDATE personal_context_clock SET high_water=MAX(high_water,?) WHERE singleton=1").run(scope.minimum);
      if (changed.changes !== 1) throw new Error("personal_context_clock_missing");
      uncommittedMinimum.delete(db);
    } catch (error) {
      if (failed) throw new AggregateError([original, error], "personal_context_clock_commit_failed_with_original_error");
      throw error;
    }
  }
  if (failed) throw original;
  return result;
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
  const result = db.prepare("UPDATE personal_context_clock SET high_water=MAX(high_water,?) WHERE singleton=1").run(Math.max(observed, uncommittedMinimum.get(db) ?? 0));
  if (result.changes !== 1) throw new Error("personal_context_clock_missing");
  uncommittedMinimum.delete(db);
  return (db.prepare("SELECT high_water FROM personal_context_clock WHERE singleton=1").get() as { high_water: number }).high_water;
}


/** 只在可能阻塞的系统读取后调用；沿用最外原起点，不重采墙钟或重置嵌套期限。 */
export function observePersonalContextElapsed(db: Db): number {
  const scope = observations.get(db), at = performance.now();
  if (!scope || !Number.isFinite(at) || at < scope.last || at < scope.started) throw new Error("personal_context_clock_invalid");
  const elapsed = Math.floor(at - scope.started), minimum = scope.at + elapsed;
  if (!Number.isSafeInteger(elapsed) || !Number.isSafeInteger(minimum)) throw new Error("personal_context_clock_invalid");
  scope.last = at; scope.minimum = Math.max(scope.minimum, minimum);
  return personalContextOperationTime(db);
}
