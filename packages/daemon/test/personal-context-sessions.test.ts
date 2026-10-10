// 真实 SQLite 生命周期与审计；本文件不将软件身份事实称作 OS 端点证明。
import { createHash, generateKeyPairSync, randomUUID, randomBytes } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import { openDb, closeTrackedDatabases } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { PersonalContextRegistry } from "../src/personalContext/registry.js";
import { PersonalContextSessionJournal } from "../src/personalContext/sessionJournal.js";
import { PersonalContextSessionSupervisor } from "../src/personalContext/sessionSupervisor.js";
import { PersonalContextKeyCustody } from "../src/personalContext/keyCustody.js";
import { openWin32PersonalPipe, createWin32PersonalSigningKey, loadWin32PersonalSigningKey, removeWin32PersonalSigningKey, type Win32PersonalSigningKeyReference } from "@saydo/platform";
import { PersonalContextWindowsTransport } from "../src/personalContext/windowsTransport.js";
import type { PersonalContextPeerIdentity } from "@saydo/contracts";
import { jcsDigest, jcsSerialize, newId, PERSONAL_CONTEXT_PROTOCOL, personalContextEffectDigest, type PersonalContextEffect } from "@saydo/contracts";
import { PersonalContextJournal } from "../src/personalContext/journal.js";
import { createFocus } from "../src/focus/registry.js";
import { startActivation } from "../src/focus/activation.js";
import { captureFocusAuthSnapshot } from "../src/focus/binding.js";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { runSnapshotBackup } from "../src/backup/snapshot.js";
import { createServer, request as httpRequest } from "node:http";
import { handlePersonalContextOwnerApi } from "../src/api/personalContextOwner.js";
import { extractToken, verifyIdentity } from "../src/net/identity.js";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../src/storage/ddl.js";
const taskDirectories: string[] = [];
const createdCredentials: Win32PersonalSigningKeyReference[] = [];
afterEach(() => {
  closeTrackedDatabases();
  for (const credential of createdCredentials.splice(0)) {
    expect(credential.reference).toMatch(/^saydo-personal-context-test\/1\//u);
    expect(removeWin32PersonalSigningKey(credential)).toBe("removed");
    expect(removeWin32PersonalSigningKey(credential)).toBe("absent");
  }
  for (const directory of taskDirectories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep) || !basename(directory).startsWith("saydo-session-")) throw Error("public cleanup boundary refused");
    rmSync(directory, { recursive: true, force: true });
  }
});
function fixture() {
  const db = openDb(":memory:"), audit = createSqliteAuditSink(db), registry = new PersonalContextRegistry(db, audit);
  const identity = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: generateKeyPairSync("ed25519").publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: Date.now() + 60000 });
  const keyId = randomUUID(), at = Date.now();
  // 只为满足真实 FK 的软件意图，不供启用或握手。
  db.prepare("INSERT INTO personal_context_key_preparations(operation_id,registration_id,registration_revision,request_digest,reference,public_key,public_key_digest,state,revision,os_result,retained,created_at,updated_at) VALUES(?,?,1,'public-digest','public-reference','public-key','public-key-digest','pending',1,'pending',0,?,?)").run(keyId, identity.registrationId, at, at);
  const journal = new PersonalContextSessionJournal(db, audit), input = { operationId: randomUUID(), registrationId: identity.registrationId, expectedRegistrationRevision: identity.registrationRevision };
  const facts = { identity, keyOperationId: keyId, keyRevision: 1, bootEpoch: randomUUID(), pid: 123, birth: "public-software-process-birth" };
  return { db, journal, input, facts };
}
test("UPGRADE.T10.140 会话 opening 与审计同TX，拒绝失败后的假端点事实", () => {
  const f = fixture();
  f.db.exec("CREATE TRIGGER reject_session_audit BEFORE INSERT ON audit_log WHEN NEW.action='personal_context.session_opening' BEGIN SELECT RAISE(ABORT,'public audit refused'); END");
  expect(() => f.journal.begin(f.input, f.facts, () => undefined)).toThrow("public audit refused");
  expect(f.journal.list()).toEqual([]);
  f.db.exec("DROP TRIGGER reject_session_audit");
  const row = f.journal.begin(f.input, f.facts, () => undefined);
  expect(row).toMatchObject({ state: "opening", endpoint: null, revision: 1 });
  expect(f.journal.prior(f.input)).toEqual(row);
  expect(() => f.journal.prior({ ...f.input, expectedRegistrationRevision: 2 })).toThrow("operation_conflict");
  expect(() => f.journal.begin({ ...f.input, operationId: randomUUID() }, f.facts, () => undefined)).toThrow();
});
test("UPGRADE.T10.141 固定原版本及最终复核拒绝旧监听提交，unknown保留占位", () => {
  const f = fixture(), opening = f.journal.begin(f.input, f.facts, () => undefined);
  expect(() => f.journal.transition(opening, "listening", { endpoint: "public-test-endpoint", assertCurrent: () => { throw Error("public revoked"); } })).toThrow("public revoked");
  expect(f.journal.get(f.input.operationId)).toEqual(opening);
  const listening = f.journal.transition(opening, "listening", { endpoint: "public-test-endpoint", assertCurrent: () => undefined });
  expect(() => f.journal.transition(opening, "unknown")).toThrow("session_conflict");
  const unknown = f.journal.transition(listening, "unknown", { failureCode: "personal_context_session_cleanup_failed" });
  expect(unknown.endpoint).toBe("public-test-endpoint");
  expect(() => f.journal.begin({ ...f.input, operationId: randomUUID() }, f.facts, () => undefined)).toThrow();
  expect(() => f.db.prepare("DELETE FROM personal_context_sessions WHERE operation_id=?").run(f.input.operationId)).toThrow("history_required");
});
test("UPGRADE.T10.142 旧boot仅隔离不重开，关闭必须经stopping且不伪造当前revision", () => {
  const f = fixture(), original = f.journal.begin(f.input, f.facts, () => undefined);
  expect(() => f.journal.transition(original, "closed")).toThrow("transition_rejected");
  f.journal.isolatePreviousBoot(randomUUID());
  const unknown = f.journal.get(f.input.operationId)!;
  expect(unknown).toMatchObject({ state: "unknown", endpoint: null, failure_code: "personal_context_session_previous_boot" });
  // 此处仅验证 journal 的可记录边；真实监督器必须另外证明 OS 已退出。
  const closed = f.journal.transition(unknown, "closed");
  expect(closed.revision).toBe(3);
  const next = f.journal.begin({ ...f.input, operationId: randomUUID() }, { ...f.facts, bootEpoch: randomUUID() }, () => undefined);
  expect(next.state).toBe("opening");
});

function nativeFixture(peerPublicKey?: string, systemKey = false) {
  const db = openDb(":memory:"), audit = createSqliteAuditSink(db), local = generateKeyPairSync("ed25519"), peer = generateKeyPairSync("ed25519");
  const publicKey = local.publicKey.export({ format: "pem", type: "spki" }).toString();
  const descriptor = { reference: `saydo-personal-context-test/1/${randomUUID()}`, publicKey, publicKeyDigest: `sha256:${createHash("sha256").update(local.publicKey.export({ format: "der", type: "spki" })).digest("hex")}`, credentialDigest: `sha256:${"a".repeat(64)}` };
  // 软件密钥仓只隔离系统凭据；下面的管道 ACL、I/O 和关闭均为真实平台实现。
  const keys = new PersonalContextKeyCustody(db, audit, systemKey ? { available: true,
    create(beforeWrite) { const result = createWin32PersonalSigningKey("test", beforeWrite); createdCredentials.push(result); return result; }, load: loadWin32PersonalSigningKey,
  } : { available: true, create(beforeWrite) { beforeWrite(descriptor); return descriptor; }, load() { return local.privateKey; } });
  const registry = new PersonalContextRegistry(db, audit, Date.now, keys);
  const registration = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peerPublicKey ?? peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: Date.now() + 60000 });
  const prepared = keys.provision({ operationId: randomUUID(), registrationId: registration.registrationId, expectedRegistrationRevision: 1 });
  const identity = registry.change({ registrationId: registration.registrationId, expectedRevision: 1, action: "enable" });
  const journal = new PersonalContextSessionJournal(db, audit), supervisor = new PersonalContextSessionSupervisor(journal, registry, keys);
  const input = { operationId: randomUUID(), registrationId: identity.registrationId, expectedRegistrationRevision: identity.registrationRevision };
  return { db, local, peer, keys, registry, journal, supervisor, identity, input, signingPublicKey: prepared.publicKey };
}
interface SessionView { state: string; revision: number; binding: { endpoint: string; identity: PersonalContextPeerIdentity } | null }
test.runIf(process.platform === "win32")("UPGRADE.T10.143 本人显式open实际Windows监听，待accept关闭返回后无owned I/O，旧op不重开", async () => {
  const f = nativeFixture();
  try {
    const opened = await f.supervisor.open(f.input) as SessionView;
    expect(opened.state).toBe("listening"); expect(opened.binding?.endpoint).toMatch(/^\\\\\.\\pipe\\saydo-personal-context-/u);
    const closed = await f.supervisor.close({ operationId: f.input.operationId, expectedRevision: opened.revision }) as SessionView;
    expect(closed).toMatchObject({ state: "closed", binding: null });
    await expect(openWin32PersonalPipe(opened.binding!.endpoint)).rejects.toThrow();
    expect(await f.supervisor.open(f.input)).toEqual(closed);
  } finally { await f.supervisor.stop(); }
});

function existingOperation(f: ReturnType<typeof nativeFixture>, lifetime = 30000) {
  const projectId = newId("prj"), sessionId = newId("ses"), at = new Date().toISOString();
  f.db.prepare("INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at) VALUES(?,'公开测试','coding','active','{}','step_confirm',?,?)").run(projectId, at, at);
  f.db.prepare("INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at) VALUES(?,?,'talking','cascade','unused',?)").run(sessionId, projectId, at);
  const { focusId } = createFocus(f.db, { title: "公开独立进程对账" }); startActivation(f.db, { focusId, sessionId, trigger: "user_explicit" });
  const source = captureFocusAuthSnapshot(f.db, sessionId)!;
  const value = { protocol: PERSONAL_CONTEXT_PROTOCOL, operationId: randomUUID(), method: "compile/request" as const,
    boundary: { installationId: f.identity.installationId, nodeId: f.identity.nodeId, connectionId: f.identity.connectionId, connectionEpoch: f.identity.connectionEpoch, authorityEpoch: 1, vaultGeneration: 1, restrictionSequence: 0 },
    link: { spaceId: "unified", caseId: randomUUID(), caseRevision: 1, controlGeneration: 1, hardConstraintsRevision: 1, focusId, focusRevision: source.focusRevision, focusAuthorityEpoch: source.authorityEpoch, focusAnchorRevision: source.focusAnchorRevision, sessionId },
    expiresAt: Date.now() + lifetime, payload: { contextId: randomUUID(), purpose: "answer", processorId: "saydo", recipientId: "public-test-agent", maxBytes: 1024 } };
  const effect: PersonalContextEffect = { ...value, payloadDigest: personalContextEffectDigest(value) };
  const permission = f.registry.grant({ registrationId: f.identity.registrationId, expectedRegistrationRevision: f.identity.registrationRevision, method: effect.method, link: effect.link, expiresAt: effect.expiresAt });
  // 原始业务授权端口 fixture 仅写 unknown，不声称真实 Anyvia compiler 或外部派发。
  const journal = new PersonalContextJournal(f.db, createSqliteAuditSink(f.db), { sharesDatabase: db => db === f.db, assertEffectCurrent: () => { f.registry.currentPeer(f.identity); }, assertStatusCurrent: () => { f.registry.currentPeer(f.identity); } });
  journal.admitOutbound(effect);
  const query = { protocol: PERSONAL_CONTEXT_PROTOCOL, method: "operation/status" as const, operationId: effect.operationId, boundary: effect.boundary, originalMethod: effect.method, payloadDigest: effect.payloadDigest };
  return { effect, query, permission, journal };
}
test("UPGRADE.T10.145 原journal精确保存scope，旧op改边界及缺证明历史拒绝且不可回填", async () => {
  const f = nativeFixture();
  try {
    const o = existingOperation(f);
    expect(f.registry.sessionStatus(f.identity, o.query).state).toBe("unknown");
    expect(() => f.registry.sessionStatus(f.identity, { ...o.query, boundary: { ...o.query.boundary, authorityEpoch: 2 } })).toThrow("scope_denied");
    expect(() => o.journal.status({ ...o.query, boundary: { ...o.query.boundary, vaultGeneration: 2 } })).toThrow("idempotency_conflict");
    expect(() => f.db.prepare("UPDATE personal_context_operations SET boundary_json=? WHERE operation_id=?").run(jcsSerialize({ ...o.query.boundary, authorityEpoch: 2 }), o.query.operationId)).toThrow("scope_immutable");
    const legacyId = randomUUID();
    f.db.prepare("INSERT INTO personal_context_operations(installation_id,node_id,connection_id,connection_epoch,method,operation_id,payload_digest,state,expires_at,created_at,observed_at) SELECT installation_id,node_id,connection_id,connection_epoch,method,?,payload_digest,state,expires_at,created_at,observed_at FROM personal_context_operations WHERE operation_id=?").run(legacyId, o.query.operationId);
    expect(() => o.journal.status({ ...o.query, operationId: legacyId })).toThrow("original_scope_missing");
    expect(() => f.registry.sessionStatus(f.identity, { ...o.query, operationId: legacyId })).toThrow("scope_denied");
    f.registry.revokePermission({ permissionId: o.permission.permissionId, expectedRevision: o.permission.revision });
    expect(() => f.registry.sessionStatus(f.identity, o.query)).toThrow("scope_denied");
  } finally { await f.supervisor.stop(); }
});
async function independentPeer(systemKey: boolean) {
  const child = spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./fixtures/personal-context-session-peer.ts", import.meta.url))], { stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true });
  const messages: Record<string, unknown>[] = []; let stderr = "";
  child.on("message", value => messages.push(value as Record<string, unknown>)); child.stderr!.on("data", chunk => { stderr = (stderr + String(chunk)).slice(-4096); });
  const exited = once(child, "exit"); let f: ReturnType<typeof nativeFixture> | undefined;
  try {
    await expect.poll(() => messages.find(value => value.type === "publicKey"), { timeout: 15000 }).toBeTruthy();
    f = nativeFixture(messages.find(value => value.type === "publicKey")!.publicKey as string, systemKey);
    const o = existingOperation(f), opened = await f.supervisor.open(f.input) as SessionView;
    const request = { protocol: PERSONAL_CONTEXT_PROTOCOL, version: 1, type: "request", requestId: randomUUID(), identity: f.identity, query: o.query };
    child.send({ type: "request", endpoint: opened.binding!.endpoint, publicKey: f.signingPublicKey, request });
    await expect.poll(() => messages.find(value => value.type === "response"), { timeout: 10000 }).toBeTruthy();
    expect(messages.find(value => value.type === "connected")?.pid).toBe(child.pid); expect(child.pid).not.toBe(process.pid);
    expect(messages.find(value => value.type === "response")?.value).toMatchObject({ requestId: request.requestId, identity: f.identity, queryDigest: jcsDigest(o.query), result: { operationId: o.query.operationId, state: "unknown", payloadDigest: o.query.payloadDigest, sourceReceiptDigest: null } });
    f.registry.revokePermission({ permissionId: o.permission.permissionId, expectedRevision: o.permission.revision });
    child.send({ type: "request", request: { ...request, requestId: randomUUID() } });
    await expect.poll(() => messages.some(value => value.type === "rejected"), { timeout: 10000 }).toBe(true);
    expect(messages.filter(value => value.type === "response")).toHaveLength(1);
    expect(stderr).toBe("");
  } finally {
    const stop = f?.supervisor.stop(); void stop?.catch(() => undefined);
    if (child.connected) child.send({ type: "close" });
    const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); }, 6000);
    try {
      const outcomes = await Promise.allSettled([stop, exited]);
      const failures = outcomes.filter((value): value is PromiseRejectedResult => value.status === "rejected").map(value => value.reason);
      if (failures.length) throw new AggregateError(failures, "public owned peer cleanup failed");
    } finally { clearTimeout(timer); }
  }
}
test.runIf(process.platform === "win32")("UPGRADE.T10.146 两个真实Node进程经Windows管道对账原unknown，撤销许可后零receipt披露", () => independentPeer(false), 30000);
test.runIf(process.platform === "win32")("UPGRADE.T10.152 真实新随机test系统密钥接线独立进程会话，结束仅精确删除本次凭据", () => independentPeer(true), 30000);

test.runIf(process.platform === "win32")("UPGRADE.T10.147 生产备份隔离活动会话与旧权，原监听和软件私钥不变且恢复不自动监听", async () => {
  const f = nativeFixture(), directory = mkdtempSync(join(tmpdir(), "saydo-session-backup-")); taskDirectories.push(directory);
  try {
    const o = existingOperation(f); await f.supervisor.open(f.input);
    const before = f.journal.get(f.input.operationId);
    const result = await runSnapshotBackup({ backupRoot: join(directory, "backups"), sources: [], sqlite: [{ db: f.db, destName: "saydo.db" }], retentionDays: 30 });
    expect(f.journal.get(f.input.operationId)).toEqual(before);
    expect(f.local.privateKey.type).toBe("private");
    const db = openDb(join(result.snapshotDir, "saydo.db")), audit = createSqliteAuditSink(db);
    const keys = new PersonalContextKeyCustody(db, audit, { available: true, create() { throw Error("unexpected create"); }, load() { return f.local.privateKey; } });
    const registry = new PersonalContextRegistry(db, audit, Date.now, keys), sessions = new PersonalContextSessionSupervisor(new PersonalContextSessionJournal(db, audit), registry, keys);
    try {
      expect(db.prepare("SELECT state FROM personal_context_sessions").get()).toEqual({ state: "unknown" });
      expect(sessions.list()).toMatchObject([{ state: "unknown", binding: null }]);
      expect(() => registry.sessionStatus(f.identity, o.query)).toThrow("registration_stale");
      await expect(sessions.open({ ...f.input, operationId: randomUUID() })).rejects.toThrow();
    } finally { await sessions.stop(); }
  } finally { await f.supervisor.stop(); }
});
test("UPGRADE.T10.148 当前许可真实过期后status拒绝披露旧receipt", async () => {
  const f = nativeFixture();
  try {
    const o = existingOperation(f, 120);
    expect(f.registry.sessionStatus(f.identity, o.query).state).toBe("unknown");
    await new Promise(resolve => setTimeout(resolve, 160));
    expect(() => f.registry.sessionStatus(f.identity, o.query)).toThrow("scope_denied");
  } finally { await f.supervisor.stop(); }
});
test.runIf(process.platform === "win32")("UPGRADE.T10.149 关闭审计失败仍关实际pipe并保unknown，重复停止传播原失败", async () => {
  const f = nativeFixture(); let failureExpected = false;
  try {
    const opened = await f.supervisor.open(f.input) as SessionView;
    f.db.exec("CREATE TRIGGER reject_session_closed BEFORE INSERT ON audit_log WHEN NEW.action='personal_context.session_closed' BEGIN SELECT RAISE(ABORT,'public close audit refused'); END");
    await expect(f.supervisor.close({ operationId: f.input.operationId, expectedRevision: opened.revision })).rejects.toThrow("cleanup_failed"); failureExpected = true;
    expect(f.journal.get(f.input.operationId)).toMatchObject({ state: "unknown", failure_code: "personal_context_session_cleanup_failed" });
    await expect(openWin32PersonalPipe(opened.binding!.endpoint)).rejects.toThrow();
    await expect(f.supervisor.stop()).rejects.toThrow("cleanup_failed");
  } finally {
    f.db.exec("DROP TRIGGER IF EXISTS reject_session_closed");
    if (failureExpected) await expect(f.supervisor.stop()).rejects.toThrow("cleanup_failed"); else await f.supervisor.stop();
  }
});
test.runIf(process.platform === "win32")("UPGRADE.T10.150 实际Owner HTTP拒绝peer与指定endpoint，慢body撤销零新会话", async () => {
  const f = nativeFixture(); let port = 0, cap = "public-session-owner-cap", notify: (() => void) | undefined;
  const server = createServer((req, res) => { void handlePersonalContextOwnerApi(req, res, f.registry, () => {
    const result = verifyIdentity({ host: req.headers.host, origin: req.headers.origin, peerAddress: req.socket.remoteAddress, token: extractToken(req.url, req.headers), port, expectedToken: cap });
    notify?.(); return result.ok && result.via === "local";
  }, f.keys, f.supervisor); });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}/api/personal-context/sessions/open`;
  try {
    expect((await fetch(url, { method: "POST", body: JSON.stringify(f.input) })).status).toBe(403);
    expect((await fetch(url, { method: "POST", headers: { "x-saydo-token": cap }, body: JSON.stringify({ ...f.input, endpoint: "caller-selected" }) })).status).toBe(400);
    expect(f.journal.list()).toHaveLength(0);
    const observed = new Promise<void>(resolve => { notify = resolve; });
    const json = JSON.stringify(f.input);
    const req = httpRequest(url, { method: "POST", headers: { "x-saydo-token": cap, "content-length": Buffer.byteLength(json) } });
    const response = new Promise<number | undefined>((resolve, reject) => { req.on("response", res => { res.resume(); res.on("end", () => resolve(res.statusCode)); }); req.on("error", reject); });
    req.write(json.slice(0, 10)); await observed; cap = "public-session-owner-replaced"; req.end(json.slice(10));
    expect(await response).toBe(403); expect(f.journal.list()).toHaveLength(0);
    const openedResponse = await fetch(url, { method: "POST", headers: { "x-saydo-token": cap }, body: json });
    expect(openedResponse.status).toBe(200);
    const opened = await openedResponse.json() as { result: SessionView };
    expect(opened.result.state).toBe("listening");
    const closed = await fetch(`http://127.0.0.1:${port}/api/personal-context/sessions/close`, { method: "POST", headers: { "x-saydo-token": cap }, body: JSON.stringify({ operationId: f.input.operationId, expectedRevision: opened.result.revision }) });
    expect(closed.status).toBe(200); expect(await closed.json()).toMatchObject({ result: { state: "closed", binding: null } });
    await expect(openWin32PersonalPipe(opened.result.binding!.endpoint)).rejects.toThrow();
  } finally { await f.supervisor.stop(); server.closeAllConnections(); server.close(); await once(server, "close"); }
});
test("UPGRADE.T10.151 实际v39旧库迁移保留NULL原scope，不补造且不可回填", () => {
  const directory = mkdtempSync(join(tmpdir(), "saydo-session-migration-")); taskDirectories.push(directory);
  const path = join(directory, "legacy.sqlite"), legacy = new Database(path);
  try {
    legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY NOT NULL,applied_at TEXT NOT NULL)");
    for (const migration of MIGRATIONS.filter(value => value.version <= 39)) legacy.transaction(() => {
      if ("apply" in migration) migration.apply(legacy); else legacy.exec(migration.sql);
      legacy.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(migration.version, new Date().toISOString());
    })();
    legacy.prepare("INSERT INTO personal_context_operations VALUES(?,?,?,1,'compile/request',?,?,'unknown',9999999999999,1,1,NULL)").run(randomUUID(), randomUUID(), randomUUID(), randomUUID(), `sha256:${"a".repeat(64)}`);
  } finally { legacy.close(); }
  const db = openDb(path), row = db.prepare("SELECT * FROM personal_context_operations").get() as { operation_id: string; boundary_json: string | null; link_json: string | null };
  expect(row.boundary_json).toBeNull(); expect(row.link_json).toBeNull();
  expect(db.prepare("SELECT version FROM schema_migrations WHERE version=40").get()).toEqual({ version: 40 });
  expect(() => db.prepare("UPDATE personal_context_operations SET boundary_json='{}',link_json='{}' WHERE operation_id=?").run(row.operation_id)).toThrow("scope_immutable");
  db.close(); const reopened = openDb(path);
  expect(reopened.prepare("SELECT count(*) n FROM schema_migrations WHERE version=40").get()).toEqual({ n: 1 });
});
test.runIf(process.platform === "win32")("UPGRADE.T10.144 实际Windows握手后撤销立即封闭监督writer且Owner等待真实关闭", async () => {
  const f = nativeFixture(); let client: Awaited<ReturnType<typeof openWin32PersonalPipe>> | undefined, transport: PersonalContextWindowsTransport | undefined;
  try {
    const opened = await f.supervisor.open(f.input) as SessionView;
    client = await openWin32PersonalPipe(opened.binding!.endpoint);
    transport = await PersonalContextWindowsTransport.establish(client, { role: "anyvia", identity: f.identity, bootEpoch: randomBytes(32).toString("base64url"), privateKey: f.peer.privateKey, peerKey: f.local.publicKey, assertCurrent() {} });
    await expect.poll(() => f.journal.get(f.input.operationId)?.state).toBe("connected");
    f.registry.change({ registrationId: f.identity.registrationId, expectedRevision: f.identity.registrationRevision, action: "revoke" });
    await f.supervisor.settleInvalidated();
    expect(f.journal.get(f.input.operationId)?.state).toBe("closed");
    await expect(client.readExact(4)).rejects.toThrow();
  } finally { await transport?.close(); await client?.close(); await f.supervisor.stop(); }
});
