// W5a 3.7:订阅限流 durable 排队重放(09 §11-5"P0 不做自动排队重放;P0.5 再议 durable 排队"清偿)。
// 语义:订阅调用撞限流(subscription_rate_limited)且用户选"等重置"(或无同族 key 可切)时,
// 请求落 subscription_retry_queue 排队(durable,重启不丢);sweep 到点按 kind 经注入的 replayer
// 重放——再限流 => 指数退避重排;成功 => replayed;超上限 => expired + 审计(如实告知,不无限重试)。
// 纪律:重放仍是订阅额度内调用(不产生 source='api' 行——billing-switch 收据纪律不变,07 D18);
// 生产 enqueue 点随 claude 订阅接入批落(PLAN-2 5.4;当前 BYOA 生产消费者仅 cursor 执行器,不经此)。

import { ulid } from "ulid";
import type { Db } from "../../storage/db.js";
import type { AuditSink } from "../../obs/audit.js";

export interface RetryEntry {
  id: string;
  slot: string;
  kind: string;
  payload: unknown;
  reason: string;
  attempts: number;
  notBefore: string;
  state: "queued" | "replayed" | "expired" | "cancelled";
}

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 5 * 60_000; // 首次 5min,指数退避(订阅时窗按小时计,分钟级起步够用)

export function enqueueRateLimited(
  db: Db,
  audit: AuditSink,
  i: { slot: string; kind: string; payload: unknown; reason: string; notBeforeMs?: number },
  now: () => Date = () => new Date()
): RetryEntry {
  const nowMs = now().getTime();
  const notBefore = new Date(nowMs + (i.notBeforeMs ?? BASE_BACKOFF_MS)).toISOString();
  const id = `srq_${ulid()}`;
  db.prepare(
    `INSERT INTO subscription_retry_queue(id, slot, kind, payload_json, reason, attempts, not_before, state, enqueued_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, 'queued', ?, ?)`
  ).run(id, i.slot, i.kind, JSON.stringify(i.payload ?? null), i.reason, notBefore, new Date(nowMs).toISOString(), new Date(nowMs).toISOString());
  audit.record({ actor: "daemon", action: "subscription.retry_enqueued", meta: { id, slot: i.slot, kind: i.kind, notBefore } });
  return { id, slot: i.slot, kind: i.kind, payload: i.payload, reason: i.reason, attempts: 0, notBefore, state: "queued" };
}

export type Replayer = (entry: RetryEntry) => Promise<{ ok: true } | { ok: false; rateLimitedAgain: boolean; message?: string }>;

/**
 * 到点重放(index 15s sweep 调用;每轮至多 limit 条防风暴)。
 * 再限流 => attempts+1 指数退避重排;超上限 => expired(不静默无限重试);
 * 非限流失败 => 同样计次退避(网络抖动同窗恢复);kind 无 replayer => 保持 queued(等接线,不吞)。
 */
export async function sweepRetryQueue(
  db: Db,
  audit: AuditSink,
  replayers: Record<string, Replayer>,
  now: () => Date = () => new Date(),
  limit = 3
): Promise<{ replayed: number; requeued: number; expired: number }> {
  const nowIso = now().toISOString();
  const due = db
    .prepare("SELECT * FROM subscription_retry_queue WHERE state='queued' AND not_before <= ? ORDER BY not_before LIMIT ?")
    .all(nowIso, limit) as Record<string, unknown>[];
  let replayed = 0;
  let requeued = 0;
  let expired = 0;
  for (const row of due) {
    const entry: RetryEntry = {
      id: String(row["id"]),
      slot: String(row["slot"]),
      kind: String(row["kind"]),
      payload: JSON.parse(String(row["payload_json"])),
      reason: String(row["reason"]),
      attempts: Number(row["attempts"]),
      notBefore: String(row["not_before"]),
      state: "queued"
    };
    const replayer = replayers[entry.kind];
    if (!replayer) continue; // 等消费面接线(5.4);不吞不删
    let outcome: Awaited<ReturnType<Replayer>>;
    try {
      outcome = await replayer(entry);
    } catch (err) {
      outcome = { ok: false, rateLimitedAgain: false, message: String(err).slice(0, 160) };
    }
    if (outcome.ok) {
      db.prepare("UPDATE subscription_retry_queue SET state='replayed', updated_at=? WHERE id=? AND state='queued'").run(nowIso, entry.id);
      audit.record({ actor: "daemon", action: "subscription.retry_replayed", meta: { id: entry.id, slot: entry.slot, attempts: entry.attempts } });
      replayed++;
      continue;
    }
    const nextAttempts = entry.attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      db.prepare("UPDATE subscription_retry_queue SET state='expired', attempts=?, updated_at=? WHERE id=? AND state='queued'").run(
        nextAttempts,
        nowIso,
        entry.id
      );
      audit.record({
        actor: "daemon",
        action: "subscription.retry_expired",
        meta: { id: entry.id, slot: entry.slot, attempts: nextAttempts, lastError: outcome.message ?? "rate_limited" }
      });
      expired++;
      continue;
    }
    const backoffMs = BASE_BACKOFF_MS * 2 ** nextAttempts;
    const nextNotBefore = new Date(now().getTime() + backoffMs).toISOString();
    db.prepare("UPDATE subscription_retry_queue SET attempts=?, not_before=?, updated_at=? WHERE id=? AND state='queued'").run(
      nextAttempts,
      nextNotBefore,
      nowIso,
      entry.id
    );
    requeued++;
  }
  return { replayed, requeued, expired };
}

/** 观测面(成本页/周报可读):排队中条数 */
export function pendingRetryCount(db: Db): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM subscription_retry_queue WHERE state='queued'").get() as { c: number }).c;
}
