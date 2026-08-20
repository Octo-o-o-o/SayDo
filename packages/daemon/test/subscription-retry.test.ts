// W5a 3.7:订阅限流 durable 排队重放(09 §11-5 清偿)单元锚。
// 一句验收:限流入队落库(durable,重启可见)-> sweep 到点按 kind 重放 -> 再限流指数退避 ->
// 超上限 expired 不无限重试;无 replayer 的 kind 保持 queued 不吞。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { enqueueRateLimited, sweepRetryQueue, pendingRetryCount, type RetryEntry } from "../src/providers/byoa/retryQueue.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const T0 = new Date("2026-07-27T12:00:00.000Z");

let dbPath: string;
let db: Db;

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "saydo-srq-")), "saydo.db");
  db = openDb(dbPath);
});

describe("订阅限流 durable 排队重放", () => {
  it("主锚:入队落库(重启可见)-> 到点重放成功 -> replayed;未到点不动", async () => {
    enqueueRateLimited(db, nullAudit, { slot: "evaluator", kind: "deep_assess", payload: { sessionId: "s1" }, reason: "weekly window" }, () => T0);
    expect(pendingRetryCount(db)).toBe(1);

    // durable:换连接重开同一库,条目仍在(重启不丢——09 §11-5 此前"内存态重启重新询问"的清偿点)
    db.close();
    db = openDb(dbPath);
    expect(pendingRetryCount(db)).toBe(1);

    const calls: RetryEntry[] = [];
    const okReplayer = async (e: RetryEntry): Promise<{ ok: true }> => {
      calls.push(e);
      return { ok: true };
    };
    // 未到 not_before:不重放
    const early = await sweepRetryQueue(db, nullAudit, { deep_assess: okReplayer }, () => T0);
    expect(early).toEqual({ replayed: 0, requeued: 0, expired: 0 });
    // 到点(缺省退避 5min):重放成功
    const later = new Date(T0.getTime() + 6 * 60_000);
    const r = await sweepRetryQueue(db, nullAudit, { deep_assess: okReplayer }, () => later);
    expect(r.replayed).toBe(1);
    expect(calls[0]?.payload).toEqual({ sessionId: "s1" });
    expect(pendingRetryCount(db)).toBe(0);
    const row = db.prepare("SELECT state FROM subscription_retry_queue").get() as { state: string };
    expect(row.state).toBe("replayed");
  });

  it("再限流:指数退避重排(attempts+1,not_before 后移);超上限 => expired 不无限重试", async () => {
    enqueueRateLimited(db, nullAudit, { slot: "thinking", kind: "draft", payload: null, reason: "5h window", notBeforeMs: 0 }, () => T0);
    const alwaysLimited = async (): Promise<{ ok: false; rateLimitedAgain: boolean }> => ({ ok: false, rateLimitedAgain: true });
    let t = T0.getTime();
    let expired = 0;
    for (let i = 0; i < 10 && expired === 0; i++) {
      t += 24 * 60 * 60_000; // 每轮拨一天,保证越过任何退避
      const r = await sweepRetryQueue(db, nullAudit, { draft: alwaysLimited }, () => new Date(t));
      expired += r.expired;
    }
    expect(expired).toBe(1); // MAX_ATTEMPTS 后终局
    const row = db.prepare("SELECT state, attempts FROM subscription_retry_queue").get() as { state: string; attempts: number };
    expect(row.state).toBe("expired");
    expect(row.attempts).toBe(5);
  });

  it("无 replayer 的 kind 保持 queued(等 5.4 消费面接线,不吞不删);限流重放不产生 api 计费行(队列层无计费面)", async () => {
    enqueueRateLimited(db, nullAudit, { slot: "evaluator", kind: "unknown_kind", payload: {}, reason: "x", notBeforeMs: 0 }, () => T0);
    const r = await sweepRetryQueue(db, nullAudit, {}, () => new Date(T0.getTime() + 60_000));
    expect(r).toEqual({ replayed: 0, requeued: 0, expired: 0 });
    expect(pendingRetryCount(db)).toBe(1);
    // 计费纪律:重放机器不触 cost_entries(source='api' 行只能经 billing-switch 收据,07 D18)
    expect((db.prepare("SELECT COUNT(*) AS c FROM cost_entries").get() as { c: number }).c).toBe(0);
  });
});
