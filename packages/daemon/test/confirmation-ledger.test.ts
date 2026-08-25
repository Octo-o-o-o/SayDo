// Focus v0.4 ④a:confirmation_ledger 基座契约测试
// a present 原子性 / b finalize 原子性 / c expired downgrade payload /
// d sweep 到点终局 / e 90 天清理豁免 saga / f 白名单快照 /
// g classifier 穷举 / h focus_events 三事件仅六 focus_* 有 focusId 时落

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import {
  ConfirmationLoop,
  NON_SEMANTIC_CONFIRM_KINDS,
  SEMANTIC_MUTATION_KINDS,
  buildPayloadSummary,
  computePayloadDigest,
  sweepConfirmationLedgerRetention,
  type PendingPayload
} from "../src/live/confirm.js";
import { runParkSweep } from "../src/live/scheduler.js";

function seedSession(db: Db): string {
  const home = mkdtempSync(join(tmpdir(), "saydo-cl-"));
  const now = new Date().toISOString();
  const projectId = newId("prj");
  const sessionId = newId("ses");
  db.prepare(
    `INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at)
     VALUES (?,?, 'coding','active',?,'step_confirm',?,?)`
  ).run(projectId, "p", JSON.stringify({ kind: "local_folder", path: home, managed: true }), now, now);
  db.prepare(
    `INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at)
     VALUES (?,?, 'talking','live',?,?)`
  ).run(sessionId, projectId, join(home, "t.jsonl"), now);
  return sessionId;
}

function seedFocus(db: Db, title = "F"): string {
  const now = new Date().toISOString();
  const id = newId("foc");
  db.prepare(
    `INSERT INTO focuses(id,title,lifecycle,semantic_authority,authority_epoch,current_revision,created_at,updated_at)
     VALUES (?,?, 'active','saydo',0,0,?,?)`
  ).run(id, title, now, now);
  return id;
}

function focusObligationPayload(focusId: string, extra?: { detail?: string; nextStep?: string }): PendingPayload {
  return {
    kind: "focus_obligation",
    focusId,
    obligation: {
      kind: "action",
      title: "写测",
      detail: extra?.detail ?? "完整 detail 全文不应进 summary",
      owner: "human",
      dedupeKey: `${focusId}:action:t1`,
      verification: "confirmed",
      needs: "action",
      nextStep: extra?.nextStep ?? "下一步路径 /tmp/secret"
    }
  };
}

function wrapDbThrowOn(db: Db, predicate: (sql: string) => boolean): {
  prepare: (sql: string) => { run: (...args: unknown[]) => unknown; get: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown };
  transaction: <T>(fn: () => T) => () => T;
} {
  return {
    prepare: (sql: string) => {
      const stmt = db.prepare(sql) as {
        run: (...args: unknown[]) => unknown;
        get: (...args: unknown[]) => unknown;
        all: (...args: unknown[]) => unknown;
      };
      if (!predicate(sql)) return stmt;
      return {
        run: (..._args: unknown[]) => {
          throw new Error("injected_txn_fail");
        },
        get: (...args: unknown[]) => stmt.get(...args),
        all: (...args: unknown[]) => stmt.all(...args)
      };
    },
    transaction: <T>(fn: () => T) => db.transaction(fn)
  };
}

describe("confirmation_ledger ④a", () => {
  let db: Db;
  let sessionId: string;
  let focusId: string;

  beforeEach(() => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cl-db-"));
    db = openDb(join(home, "saydo.db"));
    sessionId = seedSession(db);
    focusId = seedFocus(db);
  });

  it("a) present 原子性:事务中途抛错→pending 未持久化且 ledger 无行", () => {
    const boom = wrapDbThrowOn(db, (sql) => /INSERT INTO confirmation_ledger/i.test(sql));
    const loop = new ConfirmationLoop({}, boom as never);
    const receiptId = newId("apr");
    expect(() =>
      loop.present(sessionId, {
        receiptId,
        sentenceId: "s1",
        promptText: "记下?",
        payload: focusObligationPayload(focusId)
      })
    ).toThrow(/injected_txn_fail/);
    expect(loop.pending(sessionId)).toBeUndefined();
    const pending = db.prepare("SELECT COUNT(*) AS c FROM pending_confirmations").get() as { c: number };
    const ledger = db.prepare("SELECT COUNT(*) AS c FROM confirmation_ledger").get() as { c: number };
    expect(pending.c).toBe(0);
    expect(ledger.c).toBe(0);
  });

  it("b) finalize 原子性:ledger 终局写失败→pending 保留且 ledger 无终局", () => {
    const loopOk = new ConfirmationLoop({}, db);
    const receiptId = newId("apr");
    loopOk.present(sessionId, {
      receiptId,
      sentenceId: "s1",
      promptText: "记下?",
      payload: focusObligationPayload(focusId)
    });
    expect(loopOk.pending(sessionId)?.receiptId).toBe(receiptId);

    // 包装:UPDATE confirmation_ledger 时炸(终局写点)
    const boom = wrapDbThrowOn(db, (sql) => /UPDATE confirmation_ledger/i.test(sql));
    const loop = new ConfirmationLoop({}, boom as never);
    // 把已 present 的内存态迁入(模拟同一 loop 被替换 deps 的边界;直接写 bySession 不可——改用 restore 或 re-present 后替换)
    // 更直接:在同一 loop 上注入 fail db 不可行(构造后 db 固定)。改用手动把 pending 灌入新 loop:
    // 通过 restoreFromDb 从库重建,再换… restore 也绑 db。
    // 方案:直接对 lightFinalize 路径用失败 db 的 loop,先用成功 db present,再手工 set 内存——
    // ConfirmationLoop 无私有 setter。改为:present 在 boom db 上先不炸,reject 时炸。
    // 用成功 present 后,构造新 loop 并从 DB restore,再…… restore 用的是构造时 db。
    // 最终方案:先 normal present;再 new ConfirmationLoop(boom) + restoreFromDb 从同一物理 db 读出 pending。
    const loop2 = new ConfirmationLoop({}, boom as never);
    const restored = loop2.restoreFromDb();
    expect(restored.restored).toBe(1);
    expect(() => loop2.dismiss(sessionId)).toThrow(/injected_txn_fail/);
    // pending 仍在库与内存
    expect(loop2.pending(sessionId)?.receiptId).toBe(receiptId);
    const row = db.prepare("SELECT receipt_id FROM pending_confirmations WHERE session_id=?").get(sessionId) as
      | { receipt_id: string }
      | undefined;
    expect(row?.receipt_id).toBe(receiptId);
    const led = db.prepare("SELECT outcome, finalized_at FROM confirmation_ledger WHERE receipt_id=?").get(receiptId) as {
      outcome: string | null;
      finalized_at: string | null;
    };
    expect(led.outcome).toBeNull();
    expect(led.finalized_at).toBeNull();
  });

  it("c) expired 的 focus_obligation 行带完整 downgrade_payload_json 且 status=pending", () => {
    const loop = new ConfirmationLoop({}, db);
    const receiptId = newId("apr");
    const past = new Date(Date.now() - 60_000).toISOString();
    loop.present(sessionId, {
      receiptId,
      sentenceId: "s1",
      promptText: "?",
      payload: focusObligationPayload(focusId, { detail: "detail-x", nextStep: "ns-1" }),
      presentedAt: past,
      expiresAt: past
    });
    const o = loop.consumeReply(sessionId, "好", "s-r");
    expect(o.kind).toBe("not_pending");
    const led = db
      .prepare(
        `SELECT outcome, downgrade_status, downgrade_payload_json FROM confirmation_ledger WHERE receipt_id=?`
      )
      .get(receiptId) as {
      outcome: string;
      downgrade_status: string;
      downgrade_payload_json: string;
    };
    expect(led.outcome).toBe("expired");
    expect(led.downgrade_status).toBe("pending");
    const dp = JSON.parse(led.downgrade_payload_json) as Record<string, unknown>;
    expect(dp.owner).toBe("human");
    expect(dp.needs).toBe("action");
    expect(dp.kind).toBe("action");
    expect(dp.title).toBe("写测");
    expect(dp.detail).toBe("detail-x");
    expect(dp.verification).toBe("confirmed");
    expect(dp.nextStep).toBe("ns-1");
    expect(dp.dedupeKey).toBe(`${focusId}:action:t1`);
  });

  it("d) sweepExpired 到点终局(不依赖 consume 入口)", () => {
    const loop = new ConfirmationLoop({}, db);
    const receiptId = newId("apr");
    const past = new Date(Date.now() - 60_000).toISOString();
    loop.present(sessionId, {
      receiptId,
      sentenceId: "s1",
      promptText: "?",
      payload: focusObligationPayload(focusId),
      presentedAt: past,
      expiresAt: past
    });
    expect(loop.pending(sessionId)).toBeDefined();
    const nowIso = new Date().toISOString();
    const expired = loop.sweepExpired(nowIso);
    expect(expired).toHaveLength(1);
    expect(expired[0]!.receiptId).toBe(receiptId);
    expect(loop.pending(sessionId)).toBeUndefined();
    const led = db.prepare("SELECT outcome FROM confirmation_ledger WHERE receipt_id=?").get(receiptId) as {
      outcome: string;
    };
    expect(led.outcome).toBe("expired");
  });

  it("e) 90 天清理豁免 saga 行(pending/failed)", () => {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();
    const mk = (receiptId: string, status: string) => {
      db.prepare(
        `INSERT INTO confirmation_ledger(
          receipt_id, kind, outcome, payload_summary_json, payload_digest,
          session_id, focus_id, presented_at, finalized_at,
          downgrade_status, downgrade_payload_json, retry_count, next_retry_at, remaining_intent_json
        ) VALUES (?,?, 'expired', '{}', 'd', ?, NULL, ?, ?, ?, NULL, 0, NULL, NULL)`
      ).run(receiptId, "focus_obligation", sessionId, old, old, status);
    };
    const idNa = newId("apr");
    const idDone = newId("apr");
    const idAbandoned = newId("apr");
    const idPending = newId("apr");
    const idFailed = newId("apr");
    mk(idNa, "n/a");
    mk(idDone, "done");
    mk(idAbandoned, "abandoned");
    mk(idPending, "pending");
    mk(idFailed, "failed");

    const deleted = sweepConfirmationLedgerRetention(db, nowIso);
    expect(deleted).toBe(3); // n/a + done + abandoned
    const left = db
      .prepare("SELECT receipt_id, downgrade_status FROM confirmation_ledger ORDER BY downgrade_status")
      .all() as { receipt_id: string; downgrade_status: string }[];
    expect(left.map((r) => r.downgrade_status).sort()).toEqual(["failed", "pending"]);
  });

  it("f) 白名单快照:summary 无 detail 全文/无路径", () => {
    const payload = focusObligationPayload(focusId, {
      detail: "敏感细节全文",
      nextStep: `${["", "Users", "secret"].join("/")}/path/to/repo`
    });
    const summary = buildPayloadSummary(payload);
    const json = JSON.stringify(summary);
    expect(json).not.toContain("敏感细节全文");
    expect(json).not.toContain(["", "Users", "secret"].join("/"));
    expect(summary.kind).toBe("focus_obligation");
    expect(summary.title).toBe("写测");
    expect(summary.dedupeKey).toBe(`${focusId}:action:t1`);
    expect(summary.focusId).toBe(focusId);
    expect(summary.obligationKind).toBe("action");
    // 完整 payload 仍可经 digest 追溯
    expect(computePayloadDigest(payload)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("g) classifier 穷举:PendingPayload 每个 kind 必须在 SEMANTIC 或 NON_SEMANTIC 之一", () => {
    // 以类型字面量构造全 kind 表(expectation_ack 仅在 SEMANTIC 集合,尚无 PendingPayload 形态)
    const pendingKinds = [
      "dispatch",
      "runtime_effect",
      "readiness",
      "project_anchor",
      "focus_anchor",
      "focus_obligation",
      "focus_obligation_resolve",
      "focus_create_anchor",
      "focus_revision",
      "focus_lane_split",
      "expectation_ack"
    ] as const;
    const semantic = new Set<string>(SEMANTIC_MUTATION_KINDS);
    const nonSemantic = new Set<string>(NON_SEMANTIC_CONFIRM_KINDS);
    for (const k of pendingKinds) {
      const inS = semantic.has(k);
      const inN = nonSemantic.has(k);
      expect(inS || inN).toBe(true);
      expect(inS && inN).toBe(false);
    }
    // 新 kind 未登记=失败:SEMANTIC 必须含 expectation_ack
    expect(semantic.has("expectation_ack")).toBe(true);
    // isFocusSemanticKind 与集合一致
    for (const k of SEMANTIC_MUTATION_KINDS) {
      expect(ConfirmationLoop.isFocusSemanticKind(k)).toBe(true);
    }
    for (const k of NON_SEMANTIC_CONFIRM_KINDS) {
      expect(ConfirmationLoop.isFocusSemanticKind(k)).toBe(false);
    }
  });

  it("h) 六 focus_* 有 focusId 时 presented/settled/expired 落 focus_events;dispatch/readiness 不落", () => {
    const loop = new ConfirmationLoop({}, db);
    // 1) focus_obligation present → confirmation_presented
    const r1 = newId("apr");
    loop.present(sessionId, {
      receiptId: r1,
      sentenceId: "s1",
      promptText: "记下?",
      payload: focusObligationPayload(focusId)
    });
    const presented = db
      .prepare(`SELECT type, payload_json FROM focus_events WHERE focus_id=? AND type='confirmation_presented'`)
      .all(focusId) as { type: string; payload_json: string }[];
    expect(presented.length).toBe(1);
    expect(JSON.parse(presented[0]!.payload_json).receiptRef).toBe(r1);

    // reject → confirmation_settled
    loop.consumeClick(sessionId, r1, loop.pending(sessionId)!.digest, "reject");
    const settled = db
      .prepare(`SELECT type, payload_json FROM focus_events WHERE focus_id=? AND type='confirmation_settled'`)
      .all(focusId) as { type: string; payload_json: string }[];
    expect(settled.length).toBe(1);
    expect(JSON.parse(settled[0]!.payload_json).outcome).toBe("rejected");

    // 2) expired → confirmation_expired
    const r2 = newId("apr");
    const past = new Date(Date.now() - 60_000).toISOString();
    loop.present(sessionId, {
      receiptId: r2,
      sentenceId: "s2",
      promptText: "?",
      payload: focusObligationPayload(focusId),
      presentedAt: past,
      expiresAt: past
    });
    loop.sweepExpired(new Date().toISOString());
    const expEv = db
      .prepare(`SELECT type FROM focus_events WHERE focus_id=? AND type='confirmation_expired'`)
      .all(focusId) as { type: string }[];
    expect(expEv.length).toBe(1);

    // 3) dispatch present: 无 focus 事件
    const before = (
      db.prepare(`SELECT COUNT(*) AS c FROM focus_events WHERE type LIKE 'confirmation_%'`).get() as { c: number }
    ).c;
    const r3 = newId("apr");
    loop.present(sessionId, {
      receiptId: r3,
      sentenceId: "s3",
      promptText: "派发?",
      payload: { kind: "dispatch", packageId: newId("pkg"), revision: 1, mode: "step_confirm" }
    });
    const after = (
      db.prepare(`SELECT COUNT(*) AS c FROM focus_events WHERE type LIKE 'confirmation_%'`).get() as { c: number }
    ).c;
    expect(after).toBe(before); // 无新增
    // ledger 仍有 dispatch 行
    const dLed = db.prepare("SELECT kind, outcome FROM confirmation_ledger WHERE receipt_id=?").get(r3) as {
      kind: string;
      outcome: string | null;
    };
    expect(dLed.kind).toBe("dispatch");
    expect(dLed.outcome).toBeNull();

    // 4) readiness 同理
    const r4 = newId("apr");
    loop.present(sessionId, {
      receiptId: r4,
      sentenceId: "s4",
      promptText: "就绪?",
      payload: { kind: "readiness", projectId: newId("prj"), candidates: [] }
    });
    const after2 = (
      db.prepare(`SELECT COUNT(*) AS c FROM focus_events WHERE type LIKE 'confirmation_%'`).get() as { c: number }
    ).c;
    expect(after2).toBe(before);

    // 5) focus_create_anchor 无 focusId → 只进 ledger
    const r5 = newId("apr");
    loop.present(sessionId, {
      receiptId: r5,
      sentenceId: "s5",
      promptText: "新建?",
      payload: { kind: "focus_create_anchor", title: "新 Focus", expectedAnchorRevision: 0 }
    });
    const after3 = (
      db.prepare(`SELECT COUNT(*) AS c FROM focus_events WHERE type LIKE 'confirmation_%'`).get() as { c: number }
    ).c;
    expect(after3).toBe(before);
    const cLed = db.prepare("SELECT focus_id, kind FROM confirmation_ledger WHERE receipt_id=?").get(r5) as {
      focus_id: string | null;
      kind: string;
    };
    expect(cLed.kind).toBe("focus_create_anchor");
    expect(cLed.focus_id).toBeNull();
  });

  it("scheduler 经回调注入调用 sweep(不直接 import ConfirmationLoop)", () => {
    const loop = new ConfirmationLoop({}, db);
    const receiptId = newId("apr");
    const past = new Date(Date.now() - 60_000).toISOString();
    loop.present(sessionId, {
      receiptId,
      sentenceId: "s1",
      promptText: "?",
      payload: focusObligationPayload(focusId),
      presentedAt: past,
      expiresAt: past
    });
    let confirmCalled = false;
    let ledgerCalled = false;
    // 最小 stub factory/callbacks——本测只关心回调是否触发
    const r = runParkSweep({
      db,
      audit: { record: () => ({ id: "a" }) },
      factory: { revise: () => ({}) } as never,
      callbacks: { enqueue: () => {}, freezeForTask: () => {} } as never,
      parkAgingHours: () => 72,
      now: () => new Date(),
      sweepConfirmExpired: (nowIso) => {
        confirmCalled = true;
        loop.sweepExpired(nowIso);
      },
      sweepConfirmationLedger: (nowIso) => {
        ledgerCalled = true;
        sweepConfirmationLedgerRetention(db, nowIso);
      }
    });
    expect(r.confirmSweepRan).toBe(true);
    expect(r.ledgerRetentionRan).toBe(true);
    expect(confirmCalled).toBe(true);
    expect(ledgerCalled).toBe(true);
    const led = db.prepare("SELECT outcome FROM confirmation_ledger WHERE receipt_id=?").get(receiptId) as {
      outcome: string;
    };
    expect(led.outcome).toBe("expired");
  });

  it("migration v26 建表成功", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='confirmation_ledger'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("confirmation_ledger");
    const ver = (db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v;
    expect(ver).toBeGreaterThanOrEqual(26);
  });
});
