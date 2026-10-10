import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, beforeEach, afterEach, vi } from "vitest";
import { newId, PERSONAL_CONTEXT_PROTOCOL, personalContextEffectDigest, type PersonalContextEffect } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createFocus } from "../src/focus/registry.js";
import { startActivation } from "../src/focus/activation.js";
import { captureFocusAuthSnapshot } from "../src/focus/binding.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { PersonalContextJournal, type PersonalContextAuthority } from "../src/personalContext/journal.js";
// 原生 Focus 与 journal 现在共享时间水位；整个夹具使用同一确定性起点。
beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(100); });
afterEach(() => { vi.restoreAllMocks(); });
function effect(db: Db): PersonalContextEffect {
  const projectId = newId("prj"), sessionId = newId("ses");
  const now = "2026-10-10T00:00:00.000Z";
  db.prepare("INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at) VALUES(?,'测试','coding','active','{}','step_confirm',?,?)").run(projectId, now, now);
  db.prepare("INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at) VALUES(?,?,'talking','cascade','unused',?)").run(sessionId, projectId, now);
  const { focusId } = createFocus(db, { title: "真实源端事项" });
  startActivation(db, { focusId, sessionId, trigger: "user_explicit" });
  const snapshot = captureFocusAuthSnapshot(db, sessionId)!;
  const value = { protocol: PERSONAL_CONTEXT_PROTOCOL, operationId: randomUUID(), boundary: { installationId: randomUUID(), nodeId: randomUUID(), connectionId: randomUUID(), connectionEpoch: 1, authorityEpoch: 1, vaultGeneration: 1, restrictionSequence: 0 }, link: { spaceId: "unified", caseId: randomUUID(), caseRevision: 1, controlGeneration: 1, hardConstraintsRevision: 1, focusId: newId("foc"), focusRevision: 1, focusAuthorityEpoch: 0, focusAnchorRevision: 1, sessionId: newId("ses") }, expiresAt: 1000, method: "compile/request" as const, payload: { contextId: randomUUID(), purpose: "answer", processorId: "saydo", recipientId: "selected-agent", maxBytes: 4096 } };
  value.link = { ...value.link, focusId, sessionId, focusRevision: snapshot.focusRevision, focusAuthorityEpoch: snapshot.authorityEpoch, focusAnchorRevision: snapshot.focusAnchorRevision };
  return { ...value, payloadDigest: personalContextEffectDigest(value) };
}
function query(value: PersonalContextEffect) { return { protocol: PERSONAL_CONTEXT_PROTOCOL, method: "operation/status", operationId: value.operationId, boundary: value.boundary, originalMethod: value.method, payloadDigest: value.payloadDigest }; }
function fixture(path = ":memory:") {
  const db = openDb(path), realAudit = createSqliteAuditSink(db);
  let now = 100, allowed = true, failAudit = false;
  // 此处为明确的内部权限端口 fixture，不证明真实安装认证或代表授权。
  const authority: PersonalContextAuthority = { sharesDatabase: other => other === db, assertEffectCurrent() { if (!allowed) throw Error("revoked"); }, assertStatusCurrent() { if (!allowed) throw Error("revoked"); } };
  const audit = { sharesSqlite: realAudit.sharesSqlite!, record: (event: Parameters<typeof realAudit.record>[0]) => { if (failAudit && event.action === "personal_context.applied") throw Error("injected-audit"); return realAudit.record(event); } };
  const journal = new PersonalContextJournal(db, audit, authority, () => now);
  return { db, journal, setTime: (n: number) => { now = n; }, revoke: () => { allowed = false; }, failAudit: () => { failAudit = true; } };
}

test("UPGRADE.T08.054 源端业务和效果回执与审计真实同库回滚", () => {
  const f = fixture(), value = effect(f.db);
  try {
    f.db.exec("CREATE TABLE source_effects(id TEXT PRIMARY KEY)");
    f.failAudit();
    expect(() => f.journal.applyLocal(value, () => { f.db.prepare("INSERT INTO source_effects VALUES(?)").run(value.operationId); return value.payloadDigest; })).toThrow("injected-audit");
    expect(f.db.prepare("SELECT * FROM source_effects").all()).toEqual([]);
    expect(f.db.prepare("SELECT * FROM personal_context_operations").all()).toEqual([]);
    expect(f.db.prepare("SELECT high_water FROM personal_context_clock").get()).toEqual({ high_water: 100 });
  } finally { f.db.close(); }
});
test("UPGRADE.T08.055 已应用重复请求不会第二次调用源端效果", () => {
  const f = fixture(), value = effect(f.db); let applied = 0;
  try {
    const run = () => f.journal.applyLocal(value, () => { applied++; return value.payloadDigest; });
    expect(run().state).toBe("applied"); expect(run().state).toBe("applied"); expect(applied).toBe(1);
    expect(f.journal.status(query(value)).sourceReceiptDigest).toBe(value.payloadDigest);
    const changed = { ...value, expiresAt: 999 }; changed.payloadDigest = personalContextEffectDigest(changed);
    expect(() => f.journal.applyLocal(changed, () => { applied++; return changed.payloadDigest; })).toThrow("idempotency_conflict");
    expect(applied).toBe(1);
  } finally { f.db.close(); }
});
test("UPGRADE.T08.056 实际库重开保留 unknown，重复提交和只读对账都不发送", () => {
  const path = join(mkdtempSync(join(tmpdir(), "saydo-personal-journal-")), "state.sqlite");
  const first = fixture(path), value = effect(first.db);
  expect(first.journal.admitOutbound(value)).toMatchObject({ admitted: true, status: { state: "unknown" } }); first.db.close();
  const reopened = fixture(path);
  try {
    expect(reopened.journal.admitOutbound(value)).toMatchObject({ admitted: false, status: { state: "unknown" } });
    expect(reopened.journal.status(query(value)).state).toBe("unknown");
    reopened.revoke();
    expect(() => reopened.journal.admitOutbound(value)).toThrow("revoked");
    expect(() => reopened.journal.status(query(value))).toThrow("revoked");
  } finally { reopened.db.close(); }
});
test("UPGRADE.T08.057 过期失败后回拨不能复活旧操作，账本无个人正文", () => {
  const f = fixture(), value = effect(f.db);
  try {
    f.setTime(2000); expect(() => f.journal.admitOutbound(value)).toThrow("expired");
    f.setTime(10); expect(() => f.journal.admitOutbound(value)).toThrow("expired");
    expect(f.db.prepare("SELECT * FROM personal_context_operations").all()).toEqual([]);
    const columns = f.db.prepare("PRAGMA table_info(personal_context_operations)").all() as { name: string }[];
    expect(columns.map(x => x.name)).not.toContain("payload_json");
    expect(f.db.prepare("SELECT high_water FROM personal_context_clock").get()).toEqual({ high_water: 2000 });
  } finally { f.db.close(); }
});
