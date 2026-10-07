// 真实 SQLite 义务状态/事件/审计的全表一致性；不是 PG-02 闭包或原生证明。
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deferObligationApi, resolveObligationApi, type ApiResponse } from "../src/api/obligations.js";
import { withFocusWriteTx } from "../src/focus/writeTx.js";
import { AuditWriteError, createFileAuditSink, type AuditSink } from "../src/obs/audit.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { openFocusFixture, openSecondConnection, type FocusFixture } from "./helpers/focus-fixture.js";

let fx: FocusFixture;
beforeEach(() => { fx = openFocusFixture(); });
afterEach(() => { fx.close(); });
const cases = [
  { kind: "resolve", call: resolveObligationApi, body: { resolution: "done" }, status: "resolved", audit: "obligation.resolved", event: "obligation_resolved" },
  { kind: "defer", call: deferObligationApi, body: { reason: "等依赖核对", dueOrTrigger: "下周" }, status: "deferred", audit: "obligation.deferred", event: "obligation_deferred" }
] as const;

function seed() {
  return withFocusWriteTx(fx.db, { now: () => new Date("2026-10-03T00:00:00Z") }, (ops) => {
    const { focusId } = ops.createFocus({ title: "义务同步审计" });
    const { obligationId } = ops.upsertObligation(focusId, {
      kind: "action", title: "等待用户裁决", owner: "human", status: "open", verification: "confirmed", dedupeKey: "atomic-audit"
    });
    return { focusId, obligationId };
  });
}
function snapshot() {
  return Object.fromEntries(["focuses", "focus_obligations", "focus_events", "audit_log"].map((table) =>
    [table, fx.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]
  ));
}
function expectUnchanged(out: ApiResponse, before: ReturnType<typeof snapshot>, code?: string) {
  expect(out).toMatchObject({ status: 409, ...(code ? { payload: { code } } : {}) });
  expect(snapshot()).toEqual(before);
}

describe.each(cases)("$kind 状态、事件与审计原子提交", (c) => {
  it("真实 SQLite audit INSERT ABORT 拒绝且四表逐字不变", () => {
    const { obligationId } = seed();
    const before = snapshot();
    fx.db.exec("CREATE TRIGGER reject_obligation_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'audit_write_denied'); END");
    expectUnchanged(c.call(fx.db, createSqliteAuditSink(fx.db), obligationId, c.body), before, `${c.kind}_failed`);
  });
  it("同连接 sink 同步抛 AuditWriteError 时回滚状态、事件、更新时间", () => {
    const { obligationId } = seed(); const before = snapshot();
    const base = createSqliteAuditSink(fx.db);
    const audit: AuditSink = { sharesSqlite: (db) => base.sharesSqlite!(db), record: () => { throw new AuditWriteError("injected_io", new Error("audit unavailable")); } };
    expectUnchanged(c.call(fx.db, audit, obligationId, c.body), before, `${c.kind}_failed`);
  });
  it("同连接合法请求提交既有事件与具名审计恰一次", () => {
    const { obligationId } = seed();
    const beforeEvents = fx.db.prepare("SELECT COUNT(*) n FROM focus_events").get() as { n: number };
    const out = c.call(fx.db, createSqliteAuditSink(fx.db), obligationId, c.body);
    expect(out.status).toBe(200);
    const payload = out.payload as { eventId: string };
    expect(fx.db.prepare("SELECT status FROM focus_obligations WHERE id=?").get(obligationId)).toEqual({ status: c.status });
    expect(fx.db.prepare("SELECT type FROM focus_events WHERE id=?").get(payload.eventId)).toEqual({ type: c.event });
    expect(fx.db.prepare("SELECT COUNT(*) n FROM focus_events").get()).toEqual({ n: beforeEvents.n + 1 });
    const audit = fx.db.prepare("SELECT action,meta_json FROM audit_log").all() as { action: string; meta_json: string }[];
    expect(audit).toHaveLength(1); expect(audit[0]!.action).toBe(c.audit);
    expect(JSON.parse(audit[0]!.meta_json)).toMatchObject({ obligationId, eventId: payload.eventId });
  });
  it("文件 sink 在任何语义写前拒绝且文件不存在", () => {
    const { obligationId } = seed(); const before = snapshot(); const path = join(fx.home, "obligation-audit.jsonl");
    expectUnchanged(c.call(fx.db, createFileAuditSink(path), obligationId, c.body), before, "audit_transaction_unavailable");
    expect(existsSync(path)).toBe(false);
  });
  it("未知 sink 不调用 record、不写状态", () => {
    const { obligationId } = seed(); const before = snapshot(); let recorded = 0;
    const audit: AuditSink = { record: () => { recorded += 1; return { id: "aud_unknown" }; } };
    expectUnchanged(c.call(fx.db, audit, obligationId, c.body), before, "audit_transaction_unavailable");
    expect(recorded).toBe(0);
  });
  it("同文件第二连接不具备同连接事务，前置拒绝且两连接均无新增", () => {
    const { obligationId } = seed(); const before = snapshot(); const second = openSecondConnection(fx.dbPath);
    try {
      expectUnchanged(c.call(fx.db, createSqliteAuditSink(second), obligationId, c.body), before, "audit_transaction_unavailable");
      expect(second.prepare("SELECT COUNT(*) n FROM audit_log").get()).toEqual({ n: 0 });
    } finally { second.close(); }
  });
  it("非法输入、未找到和终态保留原拒绝语义且零写入", () => {
    const { obligationId } = seed(); const audit: AuditSink = { record: () => { throw new Error("不得写审计"); } };
    const before = snapshot();
    expect(c.call(fx.db, audit, obligationId, {}).status).toBe(400);
    expect(c.call(fx.db, audit, "obl_missing", c.body)).toMatchObject({ status: 404, payload: { code: "not_found" } });
    expect(snapshot()).toEqual(before);
    expect(resolveObligationApi(fx.db, createSqliteAuditSink(fx.db), obligationId, { resolution: "done" }).status).toBe(200);
    const terminal = snapshot();
    expect(c.call(fx.db, audit, obligationId, c.body)).toMatchObject({ status: 409, payload: { code: "already_terminal" } });
    expect(snapshot()).toEqual(terminal);
  });
  it("错 authority 拒绝并保留状态、事件与审计", () => {
    const { focusId, obligationId } = seed();
    fx.db.prepare("UPDATE focuses SET semantic_authority='external_bootstrap' WHERE id=?").run(focusId);
    const before = snapshot(); expectUnchanged(c.call(fx.db, createSqliteAuditSink(fx.db), obligationId, c.body), before, "authority_mismatch");
  });
});
