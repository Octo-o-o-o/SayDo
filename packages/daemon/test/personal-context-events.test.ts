import { randomUUID } from "node:crypto";
import { expect, test, vi } from "vitest";
import { newId, PERSONAL_CONTEXT_PROTOCOL, personalContextEffectDigest, type PersonalContextEventMapping } from "@saydo/contracts";
import { openFocusFixture } from "./helpers/focus-fixture.js";
import { createFocus, changeFocusLifecycle } from "../src/focus/registry.js";
import { startActivation, closeActivation } from "../src/focus/activation.js";
import { captureFocusAuthSnapshot } from "../src/focus/binding.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { PersonalContextEvents, type PersonalContextEventAuthority } from "../src/personalContext/events.js";
import { PersonalContextJournal } from "../src/personalContext/journal.js";
import { openDb } from "../src/storage/db.js";
import { withSqliteAuditTransaction } from "../src/api/sqliteAuditTransaction.js";
import { personalContextOperationTime } from "../src/personalContext/clock.js";

function fixture() {
  const f = openFocusFixture(), audit = createSqliteAuditSink(f.db);
  const { focusId } = createFocus(f.db, { title: "真实事件来源" });
  const activation = startActivation(f.db, { focusId, sessionId: f.sessionId, trigger: "user_explicit" });
  const snapshot = captureFocusAuthSnapshot(f.db, f.sessionId)!;
  const mapping: PersonalContextEventMapping = { id: randomUUID(), boundary: { installationId: randomUUID(), nodeId: randomUUID(), connectionId: randomUUID(), connectionEpoch: 1, authorityEpoch: 1, vaultGeneration: 1, restrictionSequence: 0 }, link: { spaceId: "unified", caseId: randomUUID(), caseRevision: 1, controlGeneration: 1, hardConstraintsRevision: 1, focusId, focusRevision: snapshot.focusRevision, focusAuthorityEpoch: snapshot.authorityEpoch, focusAnchorRevision: snapshot.focusAnchorRevision, sessionId: f.sessionId }, permissionId: randomUUID(), eventKinds: ["lifecycle_changed"], allowFocusEvents: true, expiresAt: Date.now() + 60000 };
  let allowed = true;
  // 明确的权限端口夹具；本测试不证明实际 Owner/peer 注册传输已经装配。
  const check = () => { if (!allowed) throw new Error("current_disclosure_revoked"); };
  const authority: PersonalContextEventAuthority = { sharesDatabase: db => db === f.db, assertOwnerRegistration: check, assertOwnerRevocation: check, assertReadCurrent: check };
  const events = new PersonalContextEvents(f.db, audit, authority);
  const journal = new PersonalContextJournal(f.db, audit, { sharesDatabase: db => db === f.db, assertEffectCurrent: check, assertStatusCurrent: check });
  return { ...f, activation, focusId, mapping, events, journal, deny: () => { allowed = false; } };
}

function addSession(f: ReturnType<typeof fixture>): string {
  const id = newId("ses");
  f.db.prepare("INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at) SELECT ?,project_id,state,engine,transcript_path,started_at FROM sessions WHERE id=?").run(id, f.sessionId);
  return id;
}

test("UPGRADE.T08.070 原生事件过期观察在回拨及重新打开数据库后保持", () => {
  const f=fixture(),clock=vi.spyOn(Date,"now");
  try {
    f.events.register({...f.mapping,eventKinds:["activation_started","activation_closed"],allowFocusEvents:false});
    clock.mockReturnValue(f.mapping.expiresAt+1000);
    closeActivation(f.db,{activationId:f.activation.activationId,sessionId:f.sessionId,focusId:f.focusId});
    clock.mockReturnValue(f.mapping.expiresAt-1000);
    f.db.close();
    const reopened=openDb(f.dbPath);
    try {
      startActivation(reopened,{focusId:f.focusId,sessionId:f.sessionId,trigger:"user_explicit"});
      expect(reopened.prepare("SELECT count(*) n FROM personal_context_event_stream").get()).toEqual({n:0});
      expect(reopened.prepare("SELECT high_water FROM personal_context_clock").get()).toEqual({high_water:f.mapping.expiresAt+1000});
    } finally {reopened.close();}
  } finally {clock.mockRestore();f.close();}
});

test("UPGRADE.T08.071 分页每次只使用一个已持久时间且后续到期不能回拨", () => {
  const f=fixture(),clock=vi.spyOn(Date,"now");
  try {
    f.events.register(f.mapping);clock.mockClear();
    clock.mockReturnValueOnce(f.mapping.expiresAt-1000).mockReturnValueOnce(f.mapping.expiresAt+1).mockReturnValue(f.mapping.expiresAt-1000);
    expect(f.events.page(f.mapping.id,0)).toEqual([]);
    expect(clock).toHaveBeenCalledTimes(1);
    expect(()=>f.events.page(f.mapping.id,0)).toThrow("mapping_unavailable");
    expect(()=>f.events.page(f.mapping.id,0)).toThrow("mapping_unavailable");
  } finally {clock.mockRestore();f.close();}
});

test("UPGRADE.T08.072 业务与审计外层失败不回滚时钟且不残留旧scope", () => {
  const f=fixture(),clock=vi.spyOn(Date,"now");
  try {
    f.events.register(f.mapping);clock.mockReturnValue(f.mapping.expiresAt+1000);
    const before=f.db.prepare("SELECT count(*) n FROM focus_events").get();
    expect(()=>withSqliteAuditTransaction(f.db,createSqliteAuditSink(f.db),()=>{
      changeFocusLifecycle(f.db,f.focusId,{to:"abandoned",actorKind:"user"});
      throw new Error("injected_audit_failure");
    })).toThrow("injected_audit_failure");
    expect(f.db.prepare("SELECT count(*) n FROM focus_events").get()).toEqual(before);
    expect(()=>personalContextOperationTime(f.db)).toThrow("scope_required");
    clock.mockReturnValue(f.mapping.expiresAt-1000);
    expect(()=>f.events.page(f.mapping.id,0)).toThrow("mapping_unavailable");
  } finally {clock.mockRestore();f.close();}
});

test("UPGRADE.T08.073 未接入时钟的原始嵌套事务拒绝映射捕获且原生事件回滚", () => {
  const f=fixture();
  try {
    f.events.register(f.mapping);
    const before=f.db.prepare("SELECT count(*) n FROM focus_events").get();
    expect(()=>f.db.transaction(()=>changeFocusLifecycle(f.db,f.focusId,{to:"abandoned",actorKind:"user"})).immediate()).toThrow("scope_required");
    expect(f.db.prepare("SELECT count(*) n FROM focus_events").get()).toEqual(before);
    expect(f.events.page(f.mapping.id,0)).toEqual([]);
  } finally {f.close();}
});

test("UPGRADE.T08.074 绑定不可换Case或anchor且损坏旧投影仍拒绝披露", () => {
  const f=fixture();
  try {
    f.events.register(f.mapping);changeFocusLifecycle(f.db,f.focusId,{to:"abandoned",actorKind:"user"});
    const row=f.events.page(f.mapping.id,0)[0]!;
    const corrupted={...row.link,caseId:randomUUID(),focusAnchorRevision:row.link.focusAnchorRevision+1};
    const corrupt=()=>f.db.prepare("UPDATE personal_context_event_bindings SET link_json=? WHERE mapping_id=?").run(JSON.stringify(corrupted),f.mapping.id);
    expect(corrupt).toThrow("immutable");
    f.db.exec("DROP TRIGGER personal_context_event_bindings_immutable");corrupt();
    expect(()=>f.events.page(f.mapping.id,0)).toThrow("provenance_invalid");
  } finally {f.close();}
});

test("UPGRADE.T08.075 登记范围只能单调撤销且源捕获版本损坏拒绝", () => {
  const f=fixture();
  try {
    f.events.register(f.mapping);changeFocusLifecycle(f.db,f.focusId,{to:"abandoned",actorKind:"user"});
    expect(()=>f.db.prepare("UPDATE personal_context_event_mappings SET expires_at=expires_at+1 WHERE id=?").run(f.mapping.id)).toThrow("immutable");
    f.db.exec("DROP TRIGGER personal_context_event_stream_immutable");
    f.db.prepare("UPDATE personal_context_event_stream SET focus_revision=focus_revision+1").run();
    expect(()=>f.events.page(f.mapping.id,0)).toThrow("provenance_invalid");
    f.events.revoke(f.mapping.id,1);
    expect(()=>f.db.prepare("UPDATE personal_context_event_mappings SET state='active',revision=revision+1 WHERE id=?").run(f.mapping.id)).toThrow("immutable");
  } finally {f.close();}
});

test("UPGRADE.T08.063 真实终态事件保留空来源会话且不会复活Focus执行权", () => {
  const f = fixture();
  try {
    f.events.register(f.mapping);
    changeFocusLifecycle(f.db, f.focusId, { to: "abandoned", reason: "本人放弃", actorKind: "user" });
    const rows = f.events.page(f.mapping.id, 0);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.payload.sourceSessionId).toBeNull();
    expect(row.link.sessionId).toBe(f.sessionId);
    expect(row.link.focusRevision).toBeGreaterThan(f.mapping.link.focusRevision);
    const unsigned = { protocol: PERSONAL_CONTEXT_PROTOCOL, operationId: randomUUID(), method: "event/ingest" as const, ...row, expiresAt: f.mapping.expiresAt };
    const effect = { ...unsigned, payloadDigest: personalContextEffectDigest(unsigned) };
    expect(f.journal.admitOutbound(effect).admitted).toBe(true);
    expect(f.journal.admitOutbound(effect).admitted).toBe(false);
    expect(() => f.journal.applyLocal(effect, () => effect.payloadDigest)).toThrow("outbound_only");
    const compile = { ...unsigned, operationId: randomUUID(), method: "compile/request", payload: { contextId: randomUUID(), purpose: "answer", processorId: "saydo", recipientId: "explicit", maxBytes: 4096 } };
    expect(() => f.journal.admitOutbound({ ...compile, payloadDigest: personalContextEffectDigest(compile) })).toThrow("focus_not_active");
    f.deny();
    expect(() => f.events.page(f.mapping.id, 0)).toThrow("current_disclosure_revoked");
  } finally { f.close(); }
});

test("UPGRADE.T08.064 Focus级范围不会广播到只允许会话事件的映射，旧事件不补造", () => {
  const f = fixture();
  try {
    const other = { ...f.mapping, id: randomUUID(), link: { ...f.mapping.link, caseId: randomUUID() }, allowFocusEvents: false };
    f.events.register(f.mapping); f.events.register(other);
    expect(f.events.page(f.mapping.id, 0)).toEqual([]);
    changeFocusLifecycle(f.db, f.focusId, { to: "abandoned", reason: "结束", actorKind: "user" });
    expect(f.events.page(f.mapping.id, 0)).toHaveLength(1);
    expect(f.events.page(other.id, 0)).toEqual([]);
    f.events.revoke(f.mapping.id, 1);
    expect(() => f.events.page(f.mapping.id, 0)).toThrow("mapping_unavailable");
  } finally { f.close(); }
});

test("UPGRADE.T08.065 提交绑定失败与原生状态事件及全局游标一起回滚", () => {
  const f = fixture();
  try {
    f.events.register(f.mapping);
    const before = f.db.prepare("SELECT lifecycle,current_revision FROM focuses WHERE id=?").get(f.focusId);
    const count = f.db.prepare("SELECT count(*) n FROM focus_events").get();
    f.db.exec("CREATE TRIGGER injected_binding_failure BEFORE INSERT ON personal_context_event_bindings BEGIN SELECT RAISE(ABORT,'injected_binding'); END");
    expect(() => changeFocusLifecycle(f.db, f.focusId, { to: "abandoned", reason: "结束", actorKind: "user" })).toThrow("injected_binding");
    expect(f.db.prepare("SELECT lifecycle,current_revision FROM focuses WHERE id=?").get(f.focusId)).toEqual(before);
    expect(f.db.prepare("SELECT count(*) n FROM focus_events").get()).toEqual(count);
    expect(f.db.prepare("SELECT * FROM personal_context_event_stream").all()).toEqual([]);
    f.db.exec("DROP TRIGGER injected_binding_failure");
    changeFocusLifecycle(f.db, f.focusId, { to: "abandoned", reason: "结束", actorKind: "user" });
    expect(f.events.page(f.mapping.id, 0)[0]!.payload.commitSequence).toBe(1);
  } finally { f.close(); }
});

test("UPGRADE.T08.066 源事件不可改写，伪造来源会话与损坏投影不能通过校验", () => {
  const f = fixture();
  try {
    f.events.register(f.mapping);
    changeFocusLifecycle(f.db, f.focusId, { to: "abandoned", reason: "结束", actorKind: "user" });
    const row = f.events.page(f.mapping.id, 0)[0]!;
    const forged = { protocol: PERSONAL_CONTEXT_PROTOCOL, operationId: randomUUID(), method: "event/ingest", ...row, payload: { ...row.payload, sourceSessionId: f.sessionId }, expiresAt: f.mapping.expiresAt };
    expect(() => f.journal.admitOutbound({ ...forged, payloadDigest: personalContextEffectDigest(forged) })).toThrow("provenance_invalid");
    expect(() => f.db.prepare("UPDATE focus_events SET actor_kind='daemon' WHERE id=?").run(row.payload.sourceEventId)).toThrow("immutable");
    // 先证明新守卫拒绝改写，再显式拆除本测试库派生投影守卫模拟旧库损坏。
    expect(() => f.db.prepare("UPDATE personal_context_event_stream SET source_digest=? WHERE event_id=?").run("sha256:" + "0".repeat(64), row.payload.sourceEventId)).toThrow("immutable");
    f.db.exec("DROP TRIGGER personal_context_event_stream_immutable");
    f.db.prepare("UPDATE personal_context_event_stream SET source_digest=? WHERE event_id=?").run("sha256:" + "0".repeat(64), row.payload.sourceEventId);
    expect(() => f.events.page(f.mapping.id, 0)).toThrow("provenance_invalid");
  } finally { f.close(); }
});

test("UPGRADE.T08.067 已观察的披露到期不因墙钟回拨复活", () => {
  const f = fixture();
  const clock = vi.spyOn(Date, "now");
  try {
    f.events.register(f.mapping);
    clock.mockReturnValue(f.mapping.expiresAt + 1);
    expect(() => f.events.page(f.mapping.id, 0)).toThrow("mapping_unavailable");
    clock.mockReturnValue(f.mapping.expiresAt - 1000);
    expect(() => f.events.page(f.mapping.id, 0)).toThrow("mapping_unavailable");
  } finally { clock.mockRestore(); f.close(); }
});

test("UPGRADE.T08.068 同Focus的另一个真实会话事件不会归给登记会话", () => {
  const f = fixture();
  try {
    f.events.register({ ...f.mapping, eventKinds: ["activation_started", "activation_closed"], allowFocusEvents: false });
    const otherSession = addSession(f);
    const other = startActivation(f.db, { focusId: f.focusId, sessionId: otherSession, trigger: "user_explicit" });
    closeActivation(f.db, { activationId: other.activationId, sessionId: otherSession, focusId: f.focusId });
    expect(f.events.page(f.mapping.id, 0)).toEqual([]);
    closeActivation(f.db, { activationId: f.activation.activationId, sessionId: f.sessionId, focusId: f.focusId });
    const rows = f.events.page(f.mapping.id, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload.sourceSessionId).toBe(f.sessionId);
    expect(rows[0]!.payload.eventKind).toBe("activation_closed");
  } finally { f.close(); }
});

test("UPGRADE.T08.069 跨Focus提交游标独立于各自原生seq且分页不跨映射", () => {
  const f = fixture();
  try {
    f.events.register({ ...f.mapping, eventKinds: ["activation_closed"], allowFocusEvents: false });
    const otherSession = addSession(f), otherFocus = createFocus(f.db, { title: "另一源端事项" }).focusId;
    const activation = startActivation(f.db, { focusId: otherFocus, sessionId: otherSession, trigger: "user_explicit" });
    const source = captureFocusAuthSnapshot(f.db, otherSession)!;
    const other = { ...f.mapping, id: randomUUID(), eventKinds: ["activation_closed"], allowFocusEvents: false, link: { ...f.mapping.link, caseId: randomUUID(), focusId: otherFocus, sessionId: otherSession, focusRevision: source.focusRevision, focusAuthorityEpoch: source.authorityEpoch, focusAnchorRevision: source.focusAnchorRevision } };
    f.events.register(other);
    closeActivation(f.db, { activationId: f.activation.activationId, sessionId: f.sessionId, focusId: f.focusId });
    closeActivation(f.db, { activationId: activation.activationId, sessionId: otherSession, focusId: otherFocus });
    const first = f.events.page(f.mapping.id, 0)[0]!, second = f.events.page(other.id, 0)[0]!;
    expect(first.payload.focusSequence).toBe(second.payload.focusSequence);
    expect(second.payload.commitSequence).toBeGreaterThan(first.payload.commitSequence);
    expect(first.payload.streamEpoch).toBe(second.payload.streamEpoch);
    expect(f.events.page(f.mapping.id, first.payload.commitSequence)).toEqual([]);
    expect(f.events.page(other.id, first.payload.commitSequence)).toHaveLength(1);
  } finally { f.close(); }
});
