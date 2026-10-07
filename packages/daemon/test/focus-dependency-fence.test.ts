// 真实 SQLite 权限拒绝与审计故障回滚；不证明 PG-02 静态闭包或原生 D1。
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setWaitingOnApi } from "../src/api/obligations.js";
import { setObligationWaitingOn } from "../src/focus/dependency.js";
import { withFocusWriteTx } from "../src/focus/writeTx.js";
import { createFileAuditSink } from "../src/obs/audit.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";

let fx: FocusFixture;
beforeEach(() => { fx = openFocusFixture(); });
afterEach(() => { fx.close(); });

function seedWaiting() {
  return withFocusWriteTx(fx.db, { now: () => new Date("2026-09-20T00:00:00.000Z") }, (ops) => {
    const { focusId } = ops.createFocus({ title: "依赖权限" });
    const make = (title: string) => ops.upsertObligation(focusId, {
      kind: "action", title, owner: "human", status: "open", verification: "confirmed", dedupeKey: title
    }).obligationId;
    const preId = make("前置");
    const obligationId = make("依赖方");
    setObligationWaitingOn(fx.db, { obligationId, preId });
    fx.db.prepare("UPDATE focuses SET authority_epoch=5 WHERE id=?").run(focusId);
    return { focusId, obligationId, preId };
  });
}

function snapshot() {
  return Object.fromEntries(["focuses", "focus_obligations", "focus_events", "audit_log"].map((table) =>
    [table, fx.db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]
  ));
}

describe("依赖清除权限与审计事务", () => {
  it.each(["authority_mismatch", "epoch_fence"])("no-op %s 仍拒绝且全部表及更新时间不变", (code) => {
    const { focusId, obligationId } = seedWaiting();
    setObligationWaitingOn(fx.db, { obligationId, preId: null });
    if (code === "authority_mismatch") {
      fx.db.prepare("UPDATE focuses SET semantic_authority='external_bootstrap' WHERE id=?").run(focusId);
    }
    const before = snapshot();
    expect(() => setObligationWaitingOn(fx.db, { obligationId, preId: null }, {
      capturedEpoch: code === "epoch_fence" ? 4 : 5,
      now: () => new Date("2026-10-03T12:00:00.000Z")
    })).toThrow(code);
    expect(snapshot()).toEqual(before);
  });

  it("HTTP no-op 错authority也返回409且不新增审计", () => {
    const { focusId, obligationId } = seedWaiting();
    setObligationWaitingOn(fx.db, { obligationId, preId: null });
    fx.db.prepare("UPDATE focuses SET semantic_authority='external_bootstrap' WHERE id=?").run(focusId);
    const before = snapshot();
    expect(setWaitingOnApi(fx.db, createSqliteAuditSink(fx.db), obligationId, { preId: null })).toMatchObject({
      status: 409, payload: { code: "authority_mismatch" }
    });
    expect(snapshot()).toEqual(before);
  });

  it("授权no-op清除保持状态/时间/事件幂等，HTTP逐请求仍留具名审计", () => {
    const { obligationId } = seedWaiting();
    setObligationWaitingOn(fx.db, { obligationId, preId: null });
    const before = snapshot();
    for (let n = 0; n < 2; n += 1) {
      expect(setObligationWaitingOn(fx.db, { obligationId, preId: null }, {
        capturedEpoch: 5, now: () => new Date("2026-10-03T12:00:00.000Z")
      })).toEqual({ ok: true, status: "open" });
    }
    expect(snapshot()).toEqual(before);
    for (let n = 0; n < 2; n += 1) {
      expect(setWaitingOnApi(fx.db, createSqliteAuditSink(fx.db), obligationId, { preId: null }).status).toBe(200);
    }
    const after = snapshot();
    for (const table of ["focuses", "focus_obligations", "focus_events"]) expect(after[table]).toEqual(before[table]);
    expect(fx.db.prepare("SELECT action FROM audit_log").all()).toEqual([
      { action: "obligation.waiting_on" }, { action: "obligation.waiting_on" }
    ]);
  });

  it.each(["authority_mismatch", "epoch_fence"])("%s 拒绝且目标、时间、事件、审计逐字不变", (code) => {
    const { focusId, obligationId } = seedWaiting();
    if (code === "authority_mismatch") {
      fx.db.prepare("UPDATE focuses SET semantic_authority='external_bootstrap' WHERE id=?").run(focusId);
    }
    const before = snapshot();
    expect(() => setObligationWaitingOn(fx.db, { obligationId, preId: null }, {
      capturedEpoch: code === "epoch_fence" ? 4 : 5,
      now: () => new Date("2026-10-03T00:00:00.000Z")
    })).toThrow(code);
    expect(snapshot()).toEqual(before);
  });

  it("HTTP 错 authority 清除返回409且无审计副作用", () => {
    const { focusId, obligationId } = seedWaiting();
    fx.db.prepare("UPDATE focuses SET semantic_authority='external_bootstrap' WHERE id=?").run(focusId);
    const before = snapshot();
    expect(setWaitingOnApi(fx.db, createSqliteAuditSink(fx.db), obligationId, { preId: null })).toMatchObject({
      status: 409, payload: { code: "authority_mismatch" }
    });
    expect(snapshot()).toEqual(before);
  });

  it.each(["clear", "obligation", "task"])("%s 的实际 audit INSERT 故障回滚全部状态/事件", (kind) => {
    const { obligationId, preId, focusId } = seedWaiting();
    let body: unknown = kind === "clear" ? { preId: null } : { preId };
    if (kind === "task") {
      const taskId = "tsk_01FENCE0000000000000000000";
      const now = "2026-09-20T00:00:00.000Z";
      fx.db.prepare(`INSERT INTO tasks(id,project_id,package_id,package_rev,package_digest,title,spec_markdown,
        route,status,adapter,budget_json,created_at,updated_at) VALUES (?,?,?,1,'dig','前置任务','spec','tier1','running','claude_code','{}',?,?)`)
        .run(taskId, fx.projectId, "pkg_01FENCE0000000000000000000", now, now);
      fx.db.prepare(`INSERT INTO action_execution_bindings(id,focus_id,task_id,focus_revision_at_authorization,
        selected_authority,phase,authorized_by_event_id,created_at,updated_at) VALUES ('aeb_fence',?,?,0,'tier1','authorized','fev_fence',?,?)`)
        .run(focusId, taskId, now, now);
      body = { taskId, condition: "accepted" };
    }
    const before = snapshot();
    fx.db.exec("CREATE TRIGGER reject_waiting_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'audit_disk_fault'); END");
    const out = setWaitingOnApi(fx.db, createSqliteAuditSink(fx.db), obligationId, body);
    expect(out).toMatchObject({ status: 409, payload: { code: "waiting_on_failed" } });
    expect(snapshot()).toEqual(before);
  });

  it("文件 sink 无同库能力时写前拒绝，文件与数据库均无新增", () => {
    const { obligationId } = seedWaiting();
    const path = join(fx.home, "audit.jsonl");
    const audit = createFileAuditSink(path);
    const before = snapshot();
    expect(setWaitingOnApi(fx.db, audit, obligationId, { preId: null })).toMatchObject({
      status: 409, payload: { code: "audit_transaction_unavailable" }
    });
    expect(snapshot()).toEqual(before);
    expect(existsSync(path)).toBe(false);
  });

  it("合法 clear 四列全空、open、同库审计恰一次且不造woken事件", () => {
    const { obligationId } = seedWaiting();
    const before = fx.db.prepare("SELECT * FROM focus_events ORDER BY id").all();
    expect(setWaitingOnApi(fx.db, createSqliteAuditSink(fx.db), obligationId, { preId: null }).status).toBe(200);
    expect(fx.db.prepare("SELECT status,waiting_on,waiting_on_obligation_id,waiting_on_task_id,waiting_task_condition FROM focus_obligations WHERE id=?").get(obligationId))
      .toEqual({ status: "open", waiting_on: null, waiting_on_obligation_id: null, waiting_on_task_id: null, waiting_task_condition: null });
    expect(fx.db.prepare("SELECT * FROM focus_events ORDER BY id").all()).toEqual(before);
    expect(fx.db.prepare("SELECT action FROM audit_log").all()).toEqual([{ action: "obligation.waiting_on" }]);
  });
});
