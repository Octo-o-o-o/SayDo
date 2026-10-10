// 使用真实源事件、SQLite 和生产服务；登记key guard缺省是明确的软件授权夹具。
import { generateKeyPairSync, randomUUID, createHash } from "node:crypto";
import { expect, test } from "vitest";
import { jcsDigest, personalContextEventPollResultSchema, personalContextEffectDigest } from "@saydo/contracts";
import { z } from "zod";
import { openFocusFixture, openSecondConnection } from "./helpers/focus-fixture.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { createFocus, changeFocusLifecycle } from "../src/focus/registry.js";
import { startActivation } from "../src/focus/activation.js";
import { captureFocusAuthSnapshot } from "../src/focus/binding.js";
import { PersonalContextRegistry } from "../src/personalContext/registry.js";
import { PersonalContextEventDelivery } from "../src/personalContext/eventDelivery.js";

import { PersonalContextKeyCustody } from "../src/personalContext/keyCustody.js";
import { PersonalContextSessionJournal } from "../src/personalContext/sessionJournal.js";
import { PersonalContextSessionSupervisor } from "../src/personalContext/sessionSupervisor.js";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../src/storage/ddl.js";
import { openDb } from "../src/storage/db.js";
import { mkdtempSync } from "node:fs";
import { join, resolve, sep, basename } from "node:path";
import { tmpdir } from "node:os";
import { newId } from "@saydo/contracts";
import { runSnapshotBackup } from "../src/backup/snapshot.js";
import { createServer } from "node:http";
import { handlePersonalContextOwnerApi } from "../src/api/personalContextOwner.js";

function fixture(peerPublicKey?: string) {
  const f = openFocusFixture();
  try {
    const audit = createSqliteAuditSink(f.db), local = generateKeyPairSync("ed25519"), localPublicKey = local.publicKey.export({ format: "pem", type: "spki" }).toString();
    const descriptor = { reference: `saydo-personal-context-test/1/${randomUUID()}`, publicKey: localPublicKey, publicKeyDigest: `sha256:${createHash("sha256").update(local.publicKey.export({format:"der",type:"spki"})).digest("hex")}`, credentialDigest: jcsDigest({ public: "software-key-fixture" }) };
    const keys = new PersonalContextKeyCustody(f.db, audit, { available: true, create(beforeWrite) { beforeWrite(descriptor); return descriptor; }, load() { return local.privateKey; } });
    const registry = new PersonalContextRegistry(f.db, audit, Date.now, keys);
    const pair = generateKeyPairSync("ed25519");
    const registered = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peerPublicKey ?? pair.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: Date.now() + 60000 });
    keys.provision({operationId:randomUUID(),registrationId:registered.registrationId,expectedRegistrationRevision:1});
    const identity = registry.change({ registrationId: registered.registrationId, expectedRevision: 1, action: "enable" });
    const { focusId } = createFocus(f.db, { title: "公开事件夹具" }); startActivation(f.db, { focusId, sessionId: f.sessionId, trigger: "user_explicit" });
    const source = captureFocusAuthSnapshot(f.db, f.sessionId)!;
    const boundary = { installationId: identity.installationId, nodeId: identity.nodeId, connectionId: identity.connectionId, connectionEpoch: identity.connectionEpoch, authorityEpoch: 1, vaultGeneration: 1, restrictionSequence: 0 };
    const link = { spaceId: "unified", caseId: randomUUID(), caseRevision: 1, controlGeneration: 1, hardConstraintsRevision: 1, focusId, focusRevision: source.focusRevision, focusAuthorityEpoch: source.authorityEpoch, focusAnchorRevision: source.focusAnchorRevision, sessionId: f.sessionId };
    const expiresAt = Date.now() + 30000;
    const permission = registry.grant({ registrationId: identity.registrationId, expectedRegistrationRevision: identity.registrationRevision, method: "event/ingest", link, expiresAt });
    const delivery = new PersonalContextEventDelivery(f.db, audit, registry), mappingId = randomUUID();
    const mapping = { id: mappingId, boundary, link, permissionId: permission.permissionId, expiresAt, eventKinds: ["lifecycle_changed"], allowFocusEvents: true };
    const description = delivery.register({ identity, mapping });
    const query = { method: "event/poll", mappingId, mappingRevision: description.mappingRevision, streamEpoch: description.streamEpoch };
    const event = (to: "abandoned" | "dormant") => changeFocusLifecycle(f.db, focusId, { to, reason: "公开事件", actorKind: "user" });
    const poll = () => delivery.poll(identity, query);
    return { ...f, audit, keys, localPublicKey, registry, identity, permission, delivery, mapping, query, event, poll };
  } catch (error) { f.close(); throw error; }
}
function effectOf(f: ReturnType<typeof fixture>) {
  const result = f.poll(); expect(result.kind).toBe("effect");
  if (result.kind !== "effect" || result.effect.method !== "event/ingest") throw Error("missing actual event");
  const effect = result.effect;
  const ack = { ...f.query, method: "event/ack", commitSequence: effect.payload.commitSequence, operationId: effect.operationId, payloadDigest: effect.payloadDigest, sourceReceiptDigest: jcsDigest({ operationId: effect.operationId, received: true }) };
  return { result, effect, ack };
}

test("UPGRADE.T10.154 真实终态事件单发后unknown，第二事件确认后旧ACK精确幂等且不回退游标", () => {
  const f = fixture(); try {
    expect(f.poll().kind).toBe("empty"); f.event("abandoned"); const first = effectOf(f);
    expect(f.poll()).toMatchObject({ kind: "blocked_unknown", operationId: first.effect.operationId });
    f.delivery.ack(f.identity, first.ack); expect(f.poll().kind).toBe("empty");
    f.event("dormant"); const second = effectOf(f); f.delivery.ack(f.identity, second.ack);
    expect(f.delivery.ack(f.identity, first.ack)).toMatchObject({ state: "acknowledged", operationId: first.effect.operationId });
    expect(f.poll()).toMatchObject({ kind: "empty", acknowledgedSequence: second.effect.payload.commitSequence });
    expect(() => f.delivery.ack(f.identity, { ...first.ack, sourceReceiptDigest: jcsDigest({ conflict: true }) })).toThrow();
    f.registry.revokePermission({ permissionId: f.permission.permissionId, expectedRevision: 1 });
    expect(() => f.delivery.ack(f.identity, first.ack)).toThrow();
  } finally { f.close(); }
});

test("UPGRADE.T10.155 ACK审计失败原回执与游标同TX回滚，原unknown不重发且可原ACK重试", () => {
  const f = fixture(); try {
    f.event("abandoned"); const first = effectOf(f);
    f.db.exec("CREATE TRIGGER test_ack_audit BEFORE INSERT ON audit_log WHEN NEW.action='personal_context.event_acknowledged' BEGIN SELECT RAISE(ABORT,'public_ack_failure'); END");
    expect(() => f.delivery.ack(f.identity, first.ack)).toThrow();
    expect(f.poll().kind).toBe("blocked_unknown");
    expect(f.db.prepare("SELECT state,receipt_digest FROM personal_context_operations WHERE operation_id=?").get(first.effect.operationId)).toEqual({ state: "unknown", receipt_digest: null });
    f.db.exec("DROP TRIGGER test_ack_audit");
    expect(f.delivery.ack(f.identity, first.ack).state).toBe("acknowledged");
  } finally { f.close(); }
});

test("UPGRADE.T10.156 准入审计失败零unknown，原事件保持可首次准入", () => {
  const f = fixture(); try {
    f.event("abandoned");
    f.db.exec("CREATE TRIGGER test_admit_audit BEFORE INSERT ON audit_log WHEN NEW.action='personal_context.admitted' BEGIN SELECT RAISE(ABORT,'public_admit_failure'); END");
    expect(() => f.poll()).toThrow();
    expect(f.db.prepare("SELECT count(*) n FROM personal_context_operations").get()).toEqual({ n: 0 });
    f.db.exec("DROP TRIGGER test_admit_audit"); expect(f.poll().kind).toBe("effect");
  } finally { f.close(); }
});

test("UPGRADE.T10.157 最终发送检查在撤销后拒绝，已准入正文不再交付", () => {
  const f = fixture(); try {
    f.event("abandoned"); const first = effectOf(f);
    f.delivery.assertPollCurrent(f.identity, f.query, first.result);
    f.registry.revokePermission({ permissionId: f.permission.permissionId, expectedRevision: 1 });
    expect(() => f.delivery.assertPollCurrent(f.identity, f.query, first.result)).toThrow();
    expect(() => f.poll()).toThrow();
  } finally { f.close(); }
});

test("UPGRADE.T10.158 不接受任意after、新mapping版本或不同peer，也不能跳过当前unknown", () => {
  const f = fixture(); try {
    const plan = f.db.prepare("EXPLAIN QUERY PLAN SELECT b.*,s.event_id,s.source_digest,s.focus_revision,s.focus_authority_epoch FROM personal_context_event_bindings b JOIN personal_context_event_stream s USING(commit_sequence) WHERE b.mapping_id=? AND b.commit_sequence>? ORDER BY b.commit_sequence LIMIT ?").all(f.query.mappingId, 0, 1);
    expect(JSON.stringify(plan)).toContain("personal_context_event_mapping_cursor");
    expect(() => f.delivery.poll(f.identity, { ...f.query, after: 999 })).toThrow();
    expect(() => f.delivery.poll(f.identity, { ...f.query, mappingRevision: 2 })).toThrow();
    expect(() => f.delivery.poll({ ...f.identity, connectionId: randomUUID() }, f.query)).toThrow();
    f.event("abandoned"); const first = effectOf(f); f.event("dormant");
    expect(f.poll()).toMatchObject({ kind: "blocked_unknown", operationId: first.effect.operationId });
    expect(() => f.delivery.ack(f.identity, { ...first.ack, commitSequence: first.ack.commitSequence + 1 })).toThrow();
  } finally { f.close(); }
});

test.runIf(process.platform === "win32")("UPGRADE.T10.160 两个真实Node经受监督Windows管道poll与ACK，未ACK保持unknown不重传正文", async () => {
  const child = spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./fixtures/personal-context-event-peer.ts", import.meta.url))], { stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true });
  const messages: Array<{type:string;publicKey?:string;pid?:number;value?:unknown}> = [];
  child.on("message", value => messages.push(value as typeof messages[number]));
  let stderr = ""; child.stderr!.on("data", value => { stderr += value.toString(); });
  const exited = once(child, "exit"); void exited.catch(() => undefined);
  let f: ReturnType<typeof fixture> | undefined, supervisor: PersonalContextSessionSupervisor | undefined;
  try {
    await expect.poll(() => messages.find(value => value.type === "publicKey"), { timeout: 15000 }).toBeTruthy();
    f = fixture(messages.find(value => value.type === "publicKey")!.publicKey);
    supervisor = new PersonalContextSessionSupervisor(new PersonalContextSessionJournal(f.db, f.audit), f.registry, f.keys, f.delivery);
    const opened = await supervisor.open({ operationId: randomUUID(), registrationId: f.identity.registrationId, expectedRegistrationRevision: f.identity.registrationRevision }) as { binding: { endpoint: string } };
    const exchange = async (query: unknown) => {
      const requestId = randomUUID(), count = messages.filter(value => value.type === "response").length;
      child.send({ type: "request", endpoint: opened.binding.endpoint, publicKey: f!.localPublicKey,
        request: { protocol: "anyvia-saydo-personal-context/1", version: 1, type: "request", requestId, identity: f!.identity, query } });
      await expect.poll(() => messages.filter(value => value.type === "response").length, { timeout: 10000 }).toBe(count + 1);
      const response = messages.filter(value => value.type === "response")[count]!.value as { requestId: string; queryDigest: string; result: unknown };
      expect(response.requestId).toBe(requestId); expect(response.queryDigest).toBe(jcsDigest(query)); return response.result;
    };
    f.event("abandoned");
    const first = await exchange(f.query) as { kind: string; effect: {operationId:string;payloadDigest:string;payload:{commitSequence:number}} };
    expect(first.kind).toBe("effect"); expect(messages.find(value => value.type === "connected")?.pid).toBe(child.pid); expect(child.pid).not.toBe(process.pid);
    expect(await exchange(f.query)).toMatchObject({ kind: "blocked_unknown", operationId: first.effect.operationId });
    const ack = { ...f.query, method: "event/ack", operationId: first.effect.operationId, payloadDigest: first.effect.payloadDigest, commitSequence: first.effect.payload.commitSequence, sourceReceiptDigest: jcsDigest({ public: "authenticated-software-receiver-receipt" }) };
    expect(await exchange(ack)).toMatchObject({ state: "acknowledged" });
    expect(await exchange(ack)).toMatchObject({ state: "acknowledged" });
    expect(await exchange(f.query)).toMatchObject({ kind: "empty", acknowledgedSequence: ack.commitSequence });
    expect(stderr).toBe("");
  } finally {
    const stop = supervisor?.stop(); void stop?.catch(() => undefined);
    if (child.connected) child.send({ type: "close" });
    const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); }, 6000);
    try { const outcomes = await Promise.allSettled([stop, exited]); const failures = outcomes.filter((value): value is PromiseRejectedResult => value.status === "rejected").map(value => value.reason); if (failures.length) throw new AggregateError(failures, "public_event_peer_cleanup_failed"); }
    finally { clearTimeout(timer); f?.close(); }
  }
}, 30000);

test("UPGRADE.T10.159 实际v40旧映射升级不补首游标，禁止回填且再次打开不重迁移", () => {
  const directory = mkdtempSync(join(tmpdir(), "saydo-event-migration-")), path = join(directory, "legacy.sqlite"), legacy = new Database(path), mappingId = randomUUID();
  try {
    legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY NOT NULL,applied_at TEXT NOT NULL)");
    for (const migration of MIGRATIONS.filter(value => value.version <= 40)) legacy.transaction(() => {
      if ("apply" in migration) migration.apply(legacy); else legacy.exec(migration.sql);
      legacy.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(migration.version, new Date().toISOString());
    })();
    const projectId = newId("prj"), sessionId = newId("ses"), at = new Date().toISOString();
    legacy.prepare("INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at) VALUES(?,'公开迁移','coding','active','{}','step_confirm',?,?)").run(projectId, at, at);
    legacy.prepare("INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at) VALUES(?,?,'talking','cascade','unused',?)").run(sessionId, projectId, at);
    const { focusId } = createFocus(legacy, { title: "公开旧映射" });
    legacy.prepare("INSERT INTO personal_context_event_mappings VALUES(?,1,'active',?,?,?,?,?,?,1,?)").run(mappingId, focusId, sessionId, '{}', '{}', randomUUID(), '[]', Date.now()+30000);
  } finally { legacy.close(); }
  const db = openDb(path);
  try {
    expect(db.prepare("SELECT stream_epoch,initial_sequence,acknowledged_sequence,progress_revision FROM personal_context_event_mappings WHERE id=?").get(mappingId)).toEqual({stream_epoch:null,initial_sequence:null,acknowledged_sequence:null,progress_revision:0});
    expect(() => db.prepare("UPDATE personal_context_event_mappings SET stream_epoch=?,initial_sequence=0,acknowledged_sequence=0 WHERE id=?").run(randomUUID(),mappingId)).toThrow("mapping_immutable");
  } finally { db.close(); }
  const reopened = openDb(path); try { expect(reopened.prepare("SELECT count(*) n FROM schema_migrations WHERE version=41").get()).toEqual({n:1}); } finally { reopened.close(); }
});

test("UPGRADE.T10.161 生产备份副本隔离事件映射，原unknown与原映射不改且恢复拒绝继续轮询", async () => {
  const f=fixture(); let restored: ReturnType<typeof openDb> | undefined;
  try {
    f.event("abandoned"); const first=effectOf(f);
    const result=await runSnapshotBackup({backupRoot:join(f.home,"backups"),sources:[],sqlite:[{db:f.db,destName:"saydo.db"}],retentionDays:30});
    restored=openDb(join(result.snapshotDir,"saydo.db"));
    expect(restored.prepare("SELECT state FROM personal_context_event_mappings WHERE id=?").get(f.query.mappingId)).toEqual({state:"revoked"});
    expect(restored.prepare("SELECT state,receipt_digest FROM personal_context_operations WHERE operation_id=?").get(first.effect.operationId)).toEqual({state:"unknown",receipt_digest:null});
    const audit=createSqliteAuditSink(restored), registry=new PersonalContextRegistry(restored,audit), delivery=new PersonalContextEventDelivery(restored,audit,registry);
    expect(()=>delivery.poll(f.identity,f.query)).toThrow();
    expect(f.poll()).toMatchObject({kind:"blocked_unknown",operationId:first.effect.operationId});
  } finally { restored?.close(); f.close(); }
});

test.each([false,true])("UPGRADE.T10.162 实际杀死owned源进程后unknown或ACK耐久，重启旧身份不能自动轮询：%s", async(acknowledged)=>{
  const child=spawn(process.execPath,["--import","tsx",fileURLToPath(new URL("./fixtures/personal-context-event-kill.ts",import.meta.url)),...(acknowledged?["--acknowledged"]:[])],{stdio:["ignore","ignore","pipe","ipc"],windowsHide:true});
  let observed: {type:string;dbPath:string;home:string;identity:Parameters<PersonalContextEventDelivery["poll"]>[0];query:unknown;operationId:string;ack:{sourceReceiptDigest:string;commitSequence:number}}|undefined;
  let stderr="";child.stderr!.on("data",value=>{stderr+=value.toString();});child.on("message",value=>{observed=value as typeof observed;});
  const exited=once(child,"exit");void exited.catch(()=>undefined);
  try{
    await expect.poll(()=>observed?.type,{timeout:15000}).toBe("prepared");
    const saved=observed!;
    expect(resolve(saved.home).startsWith(resolve(tmpdir())+sep)).toBe(true);expect(basename(saved.home).startsWith("saydo-focus-")).toBe(true);expect(resolve(saved.dbPath)).toBe(join(resolve(saved.home),"saydo.db"));
    expect(child.kill()).toBe(true);await exited;
    const db=openDb(saved.dbPath);try{
      expect(db.prepare("SELECT state,receipt_digest FROM personal_context_operations WHERE operation_id=?").get(saved.operationId)).toEqual({state:acknowledged?"applied":"unknown",receipt_digest:acknowledged?saved.ack.sourceReceiptDigest:null});
      const audit=createSqliteAuditSink(db), registry=new PersonalContextRegistry(db,audit), delivery=new PersonalContextEventDelivery(db,audit,registry);
      expect(()=>delivery.poll(saved.identity,saved.query)).toThrow("registration_stale");
      expect(db.prepare("SELECT count(*) n FROM personal_context_operations").get()).toEqual({n:1});
    }finally{db.close();}
    expect(stderr).toBe("");
  }finally{if(child.exitCode===null&&child.signalCode===null)child.kill();await exited;}
},30000);

test("UPGRADE.T10.163 本人可在原permission撤销后继续收紧event映射，不能扩大权限",()=>{
 const f=fixture();try{f.registry.revokePermission({permissionId:f.permission.permissionId,expectedRevision:1});f.delivery.revoke({identity:f.identity,mappingId:f.query.mappingId,expectedRevision:1});expect(f.db.prepare("SELECT state FROM personal_context_event_mappings WHERE id=?").get(f.query.mappingId)).toEqual({state:"revoked"});expect(()=>f.poll()).toThrow();}finally{f.close();}
});

test("UPGRADE.T10.164 最终同步writer处持有同库事务，另一真实连接不能穿越撤销后仍发送",()=>{
  const f=fixture(), second=openSecondConnection(f.dbPath);second.pragma("busy_timeout=0");
  try{
    f.event("abandoned");const first=effectOf(f);let invoked=0;
    f.delivery.writePoll(f.identity,f.query,first.result,()=>{
      expect(f.db.inTransaction).toBe(true);
      expect(()=>second.prepare("UPDATE personal_context_permissions SET state='revoked',revision=revision+1 WHERE id=?").run(f.permission.permissionId)).toThrow();
      invoked++;
    });
    second.prepare("UPDATE personal_context_permissions SET state='revoked',revision=revision+1 WHERE id=?").run(f.permission.permissionId);
    expect(()=>f.delivery.writePoll(f.identity,f.query,first.result,()=>{invoked++;})).toThrow();expect(invoked).toBe(1);
  }finally{second.close();f.close();}
});

test("UPGRADE.T10.165 真实Owner HTTP仅本人登记或撤销映射，不提供任意effect投影入口",async()=>{
  const f=fixture(), server=createServer((req,res)=>{void handlePersonalContextOwnerApi(req,res,f.registry,()=>req.headers.authorization==="Bearer public-owner",f.keys,undefined,f.delivery);});
  try{
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw Error("public_address_missing");
    const base=`http://127.0.0.1:${address.port}/api/personal-context`, mapping={...f.mapping,id:randomUUID()};
    const request=(path:string,body:unknown,authorized=true)=>fetch(base+path,{method:"POST",headers:{"content-type":"application/json",...(authorized?{authorization:"Bearer public-owner"}:{})},body:JSON.stringify(body)});
    expect((await request("/events/register",{identity:f.identity,mapping},false)).status).toBe(403);
    expect(f.db.prepare("SELECT count(*) n FROM personal_context_event_mappings").get()).toEqual({n:1});
    const created=await request("/events/register",{identity:f.identity,mapping});expect(created.status).toBe(200);expect(await created.json()).toMatchObject({ok:true,result:{mappingId:mapping.id,mappingRevision:1,initialSequence:0}});
    expect((await request("/events/ingest",{effect:"self-reported"})).status).toBe(404);
    const revoked=await request("/events/revoke",{identity:f.identity,mappingId:mapping.id,expectedRevision:1});expect(revoked.status).toBe(200);
    expect(f.db.prepare("SELECT state FROM personal_context_event_mappings WHERE id=?").get(mapping.id)).toEqual({state:"revoked"});
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));f.close();}
});

test("UPGRADE.T10.166 本人登记丢回应后原body幂等，不刷新原首水位或接受新scope",()=>{
 const f=fixture();try{
  f.event("abandoned");const original=f.db.prepare("SELECT * FROM personal_context_event_mappings WHERE id=?").get(f.query.mappingId);
  expect(f.delivery.register({identity:f.identity,mapping:f.mapping})).toMatchObject({mappingId:f.query.mappingId,initialSequence:0});
  expect(f.db.prepare("SELECT * FROM personal_context_event_mappings WHERE id=?").get(f.query.mappingId)).toEqual(original);
  expect(()=>f.delivery.register({identity:f.identity,mapping:{...f.mapping,allowFocusEvents:false}})).toThrow("mapping_conflict");
  expect(f.poll().kind).toBe("effect");
 }finally{f.close();}
});

test("UPGRADE.T10.167 导出JSONSchema结构只允许event效果，运行时也重算完整摘要",()=>{
 const schema=JSON.stringify(z.toJSONSchema(personalContextEventPollResultSchema,{io:"input"}));
 expect(schema).toContain('"const":"event/ingest"');expect(schema).not.toContain('"const":"compile/request"');
 const f=fixture();try{
  f.event("abandoned");const first=effectOf(f);
  expect(()=>personalContextEventPollResultSchema.parse({kind:"effect",effect:{...first.effect,payloadDigest:jcsDigest({bad:true})}})).toThrow();
  const other={...first.effect,method:"compile/request",payload:{contextId:randomUUID(),purpose:"answer",processorId:"saydo",recipientId:"public",maxBytes:1024}};
  expect(()=>personalContextEventPollResultSchema.parse({kind:"effect",effect:{...other,payloadDigest:personalContextEffectDigest(other)}})).toThrow();
 }finally{f.close();}
});


test("UPGRADE.T10.168 事件分页拒绝另一真实SQLite注册服务装配", () => {
  const first = openFocusFixture(), second = openFocusFixture();
  try {
    const registry = new PersonalContextRegistry(second.db, createSqliteAuditSink(second.db));
    expect(() => new PersonalContextEventDelivery(first.db, createSqliteAuditSink(first.db), registry)).toThrow("personal_context_same_database_required");
  } finally { first.close(); second.close(); }
});


test("UPGRADE.T10.169 实际旧写者无ACK不能推进游标，历史损坏也不能伪装empty", () => {
  const f = fixture(); try {
    f.event("abandoned"); const first = effectOf(f);
    expect(() => f.db.prepare("UPDATE personal_context_event_mappings SET acknowledged_sequence=?,progress_revision=progress_revision+1 WHERE id=?").run(first.effect.payload.commitSequence, f.query.mappingId)).toThrow("cursor_ack_required");
    expect(f.poll().kind).toBe("blocked_unknown");
    // 仅此任务自有数据库模拟旧版已发生的损坏，不据此宣称能抵御任意数据库管理员。
    f.db.exec("DROP TRIGGER personal_context_event_cursor_ack_required");
    f.db.prepare("UPDATE personal_context_event_mappings SET acknowledged_sequence=?,progress_revision=progress_revision+1 WHERE id=?").run(first.effect.payload.commitSequence, f.query.mappingId);
    expect(() => f.poll()).toThrow("progress_damaged");
    expect(() => f.delivery.ack(f.identity, first.ack)).toThrow("progress_damaged");
  } finally { f.close(); }
});

test("UPGRADE.T10.170 游标只可确认紧接原绑定，已有真实回执不能跨过未确认事件", () => {
  const f = fixture(); try {
    f.event("abandoned"); const first = effectOf(f); f.delivery.ack(f.identity, first.ack);
    f.event("dormant"); const second = effectOf(f);
    expect(() => f.db.prepare("UPDATE personal_context_event_mappings SET acknowledged_sequence=?,progress_revision=progress_revision+1 WHERE id=?").run(second.effect.payload.commitSequence, f.query.mappingId)).toThrow("cursor_ack_required");
    expect(f.poll()).toMatchObject({kind:"blocked_unknown", operationId:second.effect.operationId});
    f.delivery.ack(f.identity, second.ack);
    expect(f.delivery.ack(f.identity, first.ack).operationId).toBe(first.effect.operationId);
    expect(f.poll()).toMatchObject({kind:"empty", acknowledgedSequence:second.effect.payload.commitSequence});
  } finally { f.close(); }
});


test("UPGRADE.T10.171 真实v41数据库重开安装v42且不伪造已有ACK或重置首游标", () => {
  const f = fixture(); try {
    f.event("abandoned"); const first = effectOf(f);
    const before = f.db.prepare("SELECT * FROM personal_context_event_mappings WHERE id=?").get(f.query.mappingId);
    f.db.exec("DROP TRIGGER personal_context_event_cursor_ack_required; DELETE FROM schema_migrations WHERE version=42");
    const upgraded = openDb(f.db.name);
    try {
      expect(upgraded.prepare("SELECT count(*) n FROM schema_migrations WHERE version=42").get()).toEqual({n:1});
      expect(upgraded.prepare("SELECT * FROM personal_context_event_mappings WHERE id=?").get(f.query.mappingId)).toEqual(before);
      expect(() => upgraded.prepare("UPDATE personal_context_event_mappings SET acknowledged_sequence=?,progress_revision=progress_revision+1 WHERE id=?").run(first.effect.payload.commitSequence, f.query.mappingId)).toThrow("cursor_ack_required");
    } finally { upgraded.close(); }
    expect(f.poll().kind).toBe("blocked_unknown");
  } finally { f.close(); }
});
