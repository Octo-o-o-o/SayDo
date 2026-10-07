// 现役六文件写入口：真实 SQLite 全表回滚与同库审计，不证明 PG 闭包或原生语义。
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { createFocusApi, archiveFocusApi, abandonFocusApi, forkFocusApi, reopenFocusApi } from "../src/api/focuses.js";
import { createFocusArtifact, listFocusArtifacts, realizeArtifactApi } from "../src/api/artifacts.js";
import { adjustExpectationApi, withdrawExpectationApi } from "../src/api/expectations.js";
import { createSpace, renameSpace, deleteSpace, assignFocusSpace, listSpaces } from "../src/api/spaces.js";
import { createLaneApi, retireLaneApi, unretireLaneApi, redoFromLaneApi } from "../src/api/lanes.js";
import { withFocusWriteTx } from "../src/focus/writeTx.js";
import { changeFocusLifecycle } from "../src/focus/registry.js";
import { startActivation } from "../src/focus/activation.js";
import { createLane, retireLane } from "../src/focus/lanes.js";
import { projectArtifactExpectationOnOps, adjustExpectationOnOps } from "../src/focus/expectations.js";
import { AuditWriteError, createFileAuditSink, type AuditSink } from "../src/obs/audit.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { openFocusFixture, openSecondConnection, type FocusFixture } from "./helpers/focus-fixture.js";

let fx: FocusFixture;
const now = "2026-10-03T00:00:00Z";
beforeEach(() => { fx = openFocusFixture(); });
afterEach(() => { fx.close(); });
function setup(kind: string) {
  const seeded = withFocusWriteTx(fx.db, {}, (ops) => {
    const { focusId } = ops.createFocus({ title: "事务审计基线" });
    const { obligationId } = ops.upsertObligation(focusId, { kind: "action", title: "用户动作", owner: "human", status: "open", verification: "confirmed", dedupeKey: "api-atomic" });
    const artifact = ops.linkArtifact(focusId, { kind: "file", role: "expected", title: "验收文件", refJson: "{}", actorKind: "user" });
    const expectationId = projectArtifactExpectationOnOps(ops, focusId, artifact.artifactId, "验收文件", artifact.eventSeq);
    return { focusId, obligationId, artifactId: artifact.artifactId, expectationId };
  });
  changeFocusLifecycle(fx.db, seeded.focusId, { to: "active", reason: "开始", actorKind: "user" });
  const { activationId } = startActivation(fx.db, { focusId: seeded.focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
  const { laneId } = createLane(fx.db, { focusId: seeded.focusId, title: "支线" });
  fx.db.prepare("UPDATE focus_obligations SET lane_id=? WHERE id=?").run(laneId, seeded.obligationId);
  const spaceId = newId("foc");
  fx.db.prepare("INSERT INTO focus_spaces(id,title,created_at,updated_at) VALUES (?,?,?,?)").run(spaceId, "空间", now, now);
  fx.db.prepare("UPDATE focuses SET space_id=? WHERE id=?").run(spaceId, seeded.focusId);
  if (kind === "reopen") changeFocusLifecycle(fx.db, seeded.focusId, { to: "archived", reason: "收起", actorKind: "user" });
  if (kind === "unretire") retireLane(fx.db, { focusId: seeded.focusId, laneId });
  let expectationId = seeded.expectationId;
  if (kind === "withdraw") expectationId = withFocusWriteTx(fx.db, {}, (ops) => adjustExpectationOnOps(ops, seeded.focusId, seeded.expectationId, { text: "待确认" }, { actorKind: "user" })).expectationId;
  return { ...seeded, expectationId, laneId, spaceId, activationId };
}
type Seed = ReturnType<typeof setup>;
const entries = [
  { kind: "create", action: "focus.created", call: (s: Seed, a: AuditSink) => createFocusApi(fx.db, a, { title: "新 Focus", spaceId: s.spaceId, direction: "尝试" }, now) },
  { kind: "archive", action: "focus.archived", call: (s: Seed, a: AuditSink) => archiveFocusApi(fx.db, a, s.focusId, { reason: "收起" }) },
  { kind: "abandon", action: "focus.abandoned", call: (s: Seed, a: AuditSink) => abandonFocusApi(fx.db, a, s.focusId, { reason: "放弃" }) },
  { kind: "fork", action: "focus.forked", call: (s: Seed, a: AuditSink) => forkFocusApi(fx.db, a, s.focusId, { title: "分叉", direction: "新方向" }) },
  { kind: "reopen", action: "focus.reopened", call: (s: Seed, a: AuditSink) => reopenFocusApi(fx.db, a, s.focusId) },
  { kind: "artifact-create", action: "artifact.linked", call: (s: Seed, a: AuditSink) => createFocusArtifact(fx.db, a, s.focusId, { kind: "file", role: "expected", title: "新产物", ref: {} }, now) },
  { kind: "artifact-realize", action: "artifact.realized", call: (s: Seed, a: AuditSink) => realizeArtifactApi(fx.db, a, s.artifactId, { refJson: { path: "result.txt" } }) },
  { kind: "adjust", action: "expectation.adjusted", call: (s: Seed, a: AuditSink) => adjustExpectationApi(fx.db, a, s.focusId, s.expectationId, { text: "新验收" }) },
  { kind: "withdraw", action: "expectation.withdrawn", call: (s: Seed, a: AuditSink) => withdrawExpectationApi(fx.db, a, s.focusId, s.expectationId) },
  { kind: "space-create", action: "space.created", call: (_s: Seed, a: AuditSink) => createSpace(fx.db, a, { title: "新空间" }, now) },
  { kind: "space-rename", action: "space.renamed", call: (s: Seed, a: AuditSink) => renameSpace(fx.db, a, s.spaceId, { title: "改名" }, now) },
  { kind: "space-delete", action: "space.deleted", call: (s: Seed, a: AuditSink) => deleteSpace(fx.db, a, s.spaceId, now) },
  { kind: "space-assign", action: "space.assigned", call: (s: Seed, a: AuditSink) => assignFocusSpace(fx.db, a, s.focusId, { spaceId: null }, now) },
  { kind: "lane-create", action: "lane.created", call: (s: Seed, a: AuditSink) => createLaneApi(fx.db, a, s.focusId, { title: "另一支线" }) },
  { kind: "retire", action: "lane.retired", call: (s: Seed, a: AuditSink) => retireLaneApi(fx.db, a, s.focusId, s.laneId) },
  { kind: "unretire", action: "lane.restored", call: (s: Seed, a: AuditSink) => unretireLaneApi(fx.db, a, s.focusId, s.laneId) },
  { kind: "redo", action: "lane.redo_from", call: (s: Seed, a: AuditSink) => redoFromLaneApi(fx.db, a, s.focusId, s.laneId, { anchorSeq: 0, supersededIds: [s.obligationId] }) }
];
function snapshot() {
  const tables = fx.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  return Object.fromEntries(tables.map(({ name }) => [name, fx.db.prepare(`SELECT * FROM "${name}"`).all().map((row) => JSON.stringify(row)).sort()]));
}
describe.each(entries)("$kind 全表审计原子性", (entry) => {
  it("真实 SQLite audit INSERT ABORT 整库回滚", () => {
    const s = setup(entry.kind); const before = snapshot();
    fx.db.exec("CREATE TRIGGER reject_api_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
    let out: ReturnType<typeof entry.call> | undefined;
    try { out = entry.call(s, createSqliteAuditSink(fx.db)); } catch { /* 旧入口曾直接抛错；快照仍揭示半写。 */ }
    expect(snapshot()).toEqual(before);
    expect(out?.status).toBe(409);
  });
  it("同连接同步 sink throw 整库回滚", () => {
    const s = setup(entry.kind); const before = snapshot(); const base = createSqliteAuditSink(fx.db);
    const audit: AuditSink = { sharesSqlite: (db) => base.sharesSqlite!(db), record: () => { throw new AuditWriteError("injected_io", new Error("审计故障")); } };
    expect(entry.call(s, audit).status).toBe(409); expect(snapshot()).toEqual(before);
  });
  it("合法请求状态变更且审计恰一次", () => {
    const s = setup(entry.kind); const before = snapshot();
    const out = entry.call(s, createSqliteAuditSink(fx.db)); expect(out.status).toBe(200);
    expect(snapshot()).not.toEqual(before);
    expect(fx.db.prepare("SELECT action FROM audit_log").all()).toEqual([{ action: entry.action }]);
    if (entry.kind === "abandon" || entry.kind === "archive") expect(fx.db.prepare("SELECT status FROM focus_activations WHERE id=?").get(s.activationId)).toEqual({ status: "closed" });
  });
  it("未知和文件 sink 在任何写前拒绝", () => {
    const s = setup(entry.kind); const before = snapshot(); let calls = 0;
    const unknown: AuditSink = { record: () => { calls++; return { id: "aud_unused" }; } };
    expect(entry.call(s, unknown)).toMatchObject({ status: 409, payload: { code: "audit_transaction_unavailable" } });
    expect(calls).toBe(0); expect(snapshot()).toEqual(before);
    const path = join(fx.home, "file-audit.jsonl");
    expect(entry.call(s, createFileAuditSink(path))).toMatchObject({ status: 409, payload: { code: "audit_transaction_unavailable" } });
    expect(snapshot()).toEqual(before); expect(existsSync(path)).toBe(false);
  });
  it("同文件不同连接也在任何写前拒绝", () => {
    const s = setup(entry.kind); const before = snapshot(); const second = openSecondConnection(fx.dbPath);
    try { expect(entry.call(s, createSqliteAuditSink(second))).toMatchObject({ status: 409, payload: { code: "audit_transaction_unavailable" } }); expect(snapshot()).toEqual(before); } finally { second.close(); }
  });
});
it.each(["archive", "abandon"])("%s 的 activation 写入故障不能吞掉或部分提交", (kind) => {
  const s = setup(kind); const before = snapshot();
  fx.db.exec("CREATE TRIGGER reject_close BEFORE UPDATE ON focus_activations BEGIN SELECT RAISE(ABORT,'activation close denied'); END");
  const out = kind === "archive" ? archiveFocusApi(fx.db, createSqliteAuditSink(fx.db), s.focusId, { reason: "收起" }) : abandonFocusApi(fx.db, createSqliteAuditSink(fx.db), s.focusId, { reason: "放弃" });
  expect(out.status).toBe(409); expect(snapshot()).toEqual(before);
});
it("只读与 redo preview 不要求写事务能力", () => {
  const s = setup("redo"); const before = snapshot(); const audit: AuditSink = { record: () => { throw new Error("只读不审计"); } };
  expect(listFocusArtifacts(fx.db, s.focusId).status).toBe(200); expect(listSpaces(fx.db)).toBeDefined();
  expect(redoFromLaneApi(fx.db, audit, s.focusId, s.laneId, { anchorSeq: 0 })).toMatchObject({ status: 200, payload: { preview: true } });
  expect(snapshot()).toEqual(before);
});
it.each(["create", "fork"])("%s 可选 direction 失败仍按原语义忽略，审计必提交", (kind) => {
  const s = setup(kind);
  fx.db.exec("CREATE TRIGGER reject_direction BEFORE INSERT ON focus_states BEGIN SELECT RAISE(ABORT,'direction unavailable'); END");
  const entry = entries.find((e) => e.kind === kind)!;
  expect(entry.call(s, createSqliteAuditSink(fx.db))).toMatchObject({ status: 200, payload: { directionIgnored: true } });
  expect(fx.db.prepare("SELECT action FROM audit_log").all()).toEqual([{ action: entry.action }]);
});
