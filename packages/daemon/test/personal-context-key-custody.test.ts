// 这些用例使用明确的软件密钥仓故障注入；真实 Windows 原语另列，不冒充 OS 验收。
import { createHash, createPublicKey, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer, request } from "node:http";
import { once } from "node:events";
import { handlePersonalContextOwnerApi } from "../src/api/personalContextOwner.js";
import { extractToken, verifyIdentity } from "../src/net/identity.js";
import { afterEach, expect, test } from "vitest";
import { openDb, closeTrackedDatabases } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { PersonalContextRegistry } from "../src/personalContext/registry.js";
import { PersonalContextKeyCustody, type PersonalSigningKeyStore, type PersonalSigningKeyDescriptor } from "../src/personalContext/keyCustody.js";
import { createWin32PersonalSigningKey, loadWin32PersonalSigningKey, removeWin32PersonalSigningKey } from "@saydo/platform";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../src/storage/ddl.js";
import { runSnapshotBackup } from "../src/backup/snapshot.js";
import { quarantinePersonalContextBackup } from "../src/personalContext/keyBackupIsolation.js";
const temp: string[] = [];
afterEach(() => { closeTrackedDatabases(); for (const directory of temp.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function softwareStore() {
  const values = new Map<string, { key: KeyObject; descriptor: PersonalSigningKeyDescriptor }>();
  let writes = 0, afterWrite: (() => void) | undefined, duringLoad: (() => void) | undefined;
  const store: PersonalSigningKeyStore = {
    available: true,
    create(beforeWrite) {
      const pair = generateKeyPairSync("ed25519"), publicKey = pair.publicKey.export({ format: "pem", type: "spki" }).toString();
      const descriptor = { reference: `saydo-personal-context-test/1/${randomUUID()}`, publicKey,
        publicKeyDigest: `sha256:${createHash("sha256").update(pair.publicKey.export({ format: "der", type: "spki" })).digest("hex")}`,
        credentialDigest: `sha256:${createHash("sha256").update(randomUUID()).digest("hex")}` };
      beforeWrite({ reference: descriptor.reference, publicKey, publicKeyDigest: descriptor.publicKeyDigest });
      writes++; values.set(descriptor.reference, { key: pair.privateKey, descriptor }); afterWrite?.(); return descriptor;
    },
    load(input) { const action = duringLoad; duringLoad = undefined; action?.(); const value = values.get(input.reference); if (!value || JSON.stringify(value.descriptor) !== JSON.stringify(input)) throw Error("software_key_missing_or_changed"); return value.key; },
  };
  return { store, values, duringLoad: (action: () => void) => { duringLoad = action; }, writes: () => writes, afterWrite: (action: () => void) => { afterWrite = action; } };
}
function fixture(path = ":memory:") {
  const db = openDb(path), audit = createSqliteAuditSink(db), software = softwareStore(), keys = new PersonalContextKeyCustody(db, audit, software.store);
  const registry = new PersonalContextRegistry(db, audit, Date.now, keys), peer = generateKeyPairSync("ed25519");
  const registration = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: Date.now() + 3600000 });
  const input = { operationId: randomUUID(), registrationId: registration.registrationId, expectedRegistrationRevision: 1 };
  return { db, audit, software, keys, registry, registration, input };
}

test("UPGRADE.T10.114 v39严格准备与真实同库审计，软件仓不代表系统能力", () => {
  const f = fixture(); expect(f.db.prepare("SELECT version v FROM schema_migrations WHERE version=39").get()).toEqual({ v: 39 });
  expect(() => f.registry.change({ registrationId: f.input.registrationId, expectedRevision: 1, action: "enable" })).toThrow("key_not_ready");
  const result = f.keys.provision(f.input); expect(result.state).toBe("stored"); expect(Object.keys(result).sort()).toEqual(["operationId", "publicKey", "publicKeyDigest", "state"]);
  expect(createPublicKey(result.publicKey).asymmetricKeyType).toBe("ed25519"); expect(f.software.writes()).toBe(1);
  expect(f.keys.provision(f.input)).toEqual(result); expect(f.software.writes()).toBe(1);
  expect(() => f.keys.provision({ ...f.input, expectedRegistrationRevision: 2 })).toThrow("operation_conflict");
  expect(() => f.keys.provision({ ...f.input, unsafe: true })).toThrow();
  const active = f.registry.change({ registrationId: f.input.registrationId, expectedRevision: 1, action: "enable" }); expect(active.registrationRevision).toBe(2);
  expect(f.registry.list()).toMatchObject({ transport: "not_connected", registrations: [{ sessionEnabled: true, permissions: [] }] });
});

test("UPGRADE.T10.115 intent审计失败时软件仓写入为零且不留下意图", () => {
  const f = fixture(); f.db.exec("CREATE TRIGGER fail_key_pending BEFORE INSERT ON audit_log WHEN NEW.action='personal_context.key_pending' BEGIN SELECT RAISE(ABORT,'public intent audit refused'); END");
  expect(() => f.keys.provision(f.input)).toThrow(); expect(f.software.writes()).toBe(0); expect(f.db.prepare("SELECT count(*) n FROM personal_context_key_preparations").get()).toEqual({ n: 0 });
});

test("UPGRADE.T10.116 OS类写入已发生而stored审计失败，结果unknown且重复不重写", () => {
  const f = fixture(); f.db.exec("CREATE TRIGGER fail_key_stored BEFORE INSERT ON audit_log WHEN NEW.action='personal_context.key_stored' BEGIN SELECT RAISE(ABORT,'public stored audit refused'); END");
  expect(() => f.keys.provision(f.input)).toThrow("key_prepare_failed");
  expect(f.db.prepare("SELECT state,os_result,retained FROM personal_context_key_preparations").get()).toEqual({ state: "unknown", os_result: "confirmed", retained: 1 });
  expect(f.keys.provision(f.input).state).toBe("unknown"); expect(f.software.writes()).toBe(1);
  expect(() => f.registry.change({ registrationId: f.input.registrationId, expectedRevision: 1, action: "enable" })).toThrow("key_not_ready");
});

test("UPGRADE.T10.117 撤销穿越软件仓写入，晚到成功不改回stored且重复返回当前revoked", () => {
  const f = fixture(); f.software.afterWrite(() => { f.registry.change({ registrationId: f.input.registrationId, expectedRevision: 1, action: "revoke" }); });
  expect(() => f.keys.provision(f.input)).toThrow("key_prepare_failed");
  expect(f.keys.provision(f.input).state).toBe("revoked"); expect(f.software.writes()).toBe(1);
  expect(f.db.prepare("SELECT state,os_result,retained FROM personal_context_key_preparations").get()).toEqual({ state: "revoked", os_result: "unknown", retained: 1 });
  expect(f.db.prepare("SELECT state FROM personal_context_registrations").get()).toEqual({ state: "revoked" });
});

test("UPGRADE.T10.118 pending冷重开只隔离unknown，不调用软件仓创建", () => {
  const directory = mkdtempSync(join(tmpdir(), "saydo-key-custody-")); temp.push(directory); const path = join(directory, "state.sqlite"), f = fixture(path);
  f.db.exec("CREATE TRIGGER fail_key_completion BEFORE INSERT ON audit_log WHEN NEW.action IN ('personal_context.key_stored','personal_context.key_unknown') BEGIN SELECT RAISE(ABORT,'public all completion audit refused'); END");
  expect(() => f.keys.provision(f.input)).toThrow(); expect(f.db.prepare("SELECT state FROM personal_context_key_preparations").get()).toEqual({ state: "pending" });
  f.db.exec("DROP TRIGGER fail_key_completion"); f.db.close(); const db = openDb(path), keys = new PersonalContextKeyCustody(db, createSqliteAuditSink(db), f.software.store);
  expect(keys.provision(f.input).state).toBe("unknown"); expect(f.software.writes()).toBe(1);
});

test("UPGRADE.T10.119 生产备份副本隔离registered与stored，原软件私钥仍在也不能启用", async () => {
  const directory = mkdtempSync(join(tmpdir(), "saydo-key-backup-")); temp.push(directory); const f = fixture(join(directory, "source.sqlite")); f.keys.provision(f.input);
  const before = f.db.prepare("SELECT state,revision FROM personal_context_registrations").get();
  const result = await runSnapshotBackup({ backupRoot: join(directory, "backups"), sources: [], sqlite: [{ db: f.db, destName: "saydo.db" }], retentionDays: 30 });
  const restored = openDb(join(result.snapshotDir, "saydo.db")), keys = new PersonalContextKeyCustody(restored, createSqliteAuditSink(restored), f.software.store), registry = new PersonalContextRegistry(restored, createSqliteAuditSink(restored), Date.now, keys);
  expect(f.software.values.size).toBe(1); expect(f.db.prepare("SELECT state,revision FROM personal_context_registrations").get()).toEqual(before); f.keys.assertReady(f.input.registrationId, 1);
  expect(restored.prepare("SELECT state FROM personal_context_key_preparations").get()).toEqual({ state: "revoked" });
  expect(() => registry.change({ registrationId: f.input.registrationId, expectedRevision: 2, action: "enable" })).toThrow("not_enableable");
  expect(() => keys.assertReady(f.input.registrationId, 2)).toThrow("key_not_ready");
});

test("UPGRADE.T10.120 备份隔离审计故障回滚副本全部状态", () => {
  const f = fixture(); f.keys.provision(f.input);
  f.db.exec("CREATE TRIGGER fail_backup_key BEFORE INSERT ON audit_log WHEN NEW.action='personal_context.key_backup_revoked' BEGIN SELECT RAISE(ABORT,'public backup audit refused'); END");
  expect(() => quarantinePersonalContextBackup(f.db, f.audit)).toThrow("public backup audit refused");
  expect(f.db.prepare("SELECT state FROM personal_context_key_preparations").get()).toEqual({ state: "stored" }); expect(f.db.prepare("SELECT state FROM personal_context_registrations").get()).toEqual({ state: "registered" }); expect(f.software.writes()).toBe(1);
});


test("UPGRADE.T10.121 真实Owner HTTP严格输入、身份与幂等准备，响应不泄漏凭据引用", async () => {
  const f = fixture(); let port = 0; const cap = "public-test-owner-cap";
  const server = createServer((req, res) => { void handlePersonalContextOwnerApi(req, res, f.registry, () => {
    const identity = verifyIdentity({ host: req.headers.host, origin: req.headers.origin, peerAddress: req.socket.remoteAddress, token: extractToken(req.url, req.headers), port, expectedToken: cap });
    return identity.ok && identity.via === "local";
  }, f.keys); });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}/api/personal-context/keys/provision`;
  try {
    for (const headers of [{}, { "x-saydo-token": "peer-not-owner" }, { "x-saydo-token": cap, origin: "https://evil.invalid" }]) {
      expect((await fetch(url, { method: "POST", headers, body: JSON.stringify(f.input) })).status).toBe(403);
    }
    expect(f.software.writes()).toBe(0);
    expect((await fetch(url, { method: "POST", headers: { "x-saydo-token": cap }, body: JSON.stringify({ ...f.input, reference: "caller-chosen" }) })).status).toBe(400);
    for (let i = 0; i < 2; i++) {
      const response = await fetch(url, { method: "POST", headers: { "x-saydo-token": cap }, body: JSON.stringify(f.input) });
      expect(response.status).toBe(200); const body = await response.json() as { result: Record<string, unknown> };
      expect(body.result.state).toBe("stored"); expect(Object.keys(body.result).sort()).toEqual(["operationId", "publicKey", "publicKeyDigest", "state"]);
    }
    expect(f.software.writes()).toBe(1);
  } finally { server.closeAllConnections(); server.close(); await once(server, "close"); }
});

test("UPGRADE.T10.122 真实慢正文中Owner撤销或登记版本改变都不得写系统仓", async () => {
  for (const revokeOwner of [true, false]) {
    const f = fixture(); let port = 0, cap = "original-public-test-cap"; let observed!: () => void;
    const checked = new Promise<void>(resolve => { observed = resolve; });
    const server = createServer((req, res) => { void handlePersonalContextOwnerApi(req, res, f.registry, () => {
      const identity = verifyIdentity({ host: req.headers.host, origin: req.headers.origin, peerAddress: req.socket.remoteAddress, token: extractToken(req.url, req.headers), port, expectedToken: cap });
      observed(); return identity.ok && identity.via === "local";
    }, f.keys); });
    server.listen(0, "127.0.0.1"); await once(server, "listening"); port = (server.address() as { port: number }).port;
    try {
      const body = JSON.stringify(f.input), req = request({ host: "127.0.0.1", port, path: "/api/personal-context/keys/provision", method: "POST", headers: { "x-saydo-token": cap } });
      const response = once(req, "response"); req.write(body.slice(0, 5)); await checked;
      if (revokeOwner) cap = "changed-public-test-cap";
      else f.registry.change({ registrationId: f.input.registrationId, expectedRevision: 1, action: "revoke" });
      req.end(body.slice(5)); const [res] = await response; res.resume(); await once(res, "end");
      expect(res.statusCode).toBe(revokeOwner ? 403 : 409); expect(f.software.writes()).toBe(0);
      expect(f.db.prepare("SELECT count(*) n FROM personal_context_key_preparations").get()).toEqual({ n: 0 });
    } finally { server.closeAllConnections(); server.close(); await once(server, "close"); }
  }
});

test("UPGRADE.T10.123 私钥缺失与撤销清理审计失败均不恢复登记授权", () => {
  const f = fixture(); f.keys.provision(f.input); f.software.values.clear();
  expect(() => f.registry.change({ registrationId: f.input.registrationId, expectedRevision: 1, action: "enable" })).toThrow("software_key_missing");
  f.db.exec("CREATE TRIGGER fail_revoke_key BEFORE INSERT ON audit_log WHEN NEW.action='personal_context.key_revoked' BEGIN SELECT RAISE(ABORT,'public cleanup audit refused'); END");
  expect(() => f.registry.change({ registrationId: f.input.registrationId, expectedRevision: 1, action: "revoke" })).toThrow("public cleanup audit refused");
  expect(f.db.prepare("SELECT state,revision FROM personal_context_registrations").get()).toEqual({ state: "revoked", revision: 2 });
  expect(() => f.keys.assertReady(f.input.registrationId, 2)).toThrow("key_not_ready");
  expect(f.software.writes()).toBe(1);
});


test("UPGRADE.T10.124 实际v38库迁移v39保留登记，旧登记无私钥不能启用", () => {
  const directory = mkdtempSync(join(tmpdir(), "saydo-key-migration-")); temp.push(directory); const path = join(directory, "legacy.sqlite");
  const legacy = new Database(path);
  legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
  for (const migration of MIGRATIONS.filter(m => m.version <= 38)) {
    legacy.transaction(() => { if ("apply" in migration) migration.apply(legacy); else legacy.exec(migration.sql);
      legacy.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(migration.version, new Date().toISOString()); })();
  }
  const oldRegistry = new PersonalContextRegistry(legacy, createSqliteAuditSink(legacy));
  const peer = generateKeyPairSync("ed25519"), old = oldRegistry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: Date.now() + 3600000 });
  legacy.close(); const db = openDb(path), software = softwareStore(), keys = new PersonalContextKeyCustody(db, createSqliteAuditSink(db), software.store), registry = new PersonalContextRegistry(db, createSqliteAuditSink(db), Date.now, keys);
  expect(db.prepare("SELECT version v FROM schema_migrations WHERE version=39").get()).toEqual({ v: 39 });
  expect(() => registry.change({ registrationId: old.registrationId, expectedRevision: 1, action: "enable" })).toThrow("key_not_ready");
  expect(software.writes()).toBe(0); db.close(); const reopened = openDb(path);
  expect(reopened.prepare("SELECT count(*) n FROM schema_migrations WHERE version=39").get()).toEqual({ n: 1 });
});

test("UPGRADE.T10.125 生产备份隔离无密钥registered以及pending，不创建或删除系统凭据", async () => {
  const directory = mkdtempSync(join(tmpdir(), "saydo-key-backup-pending-")); temp.push(directory); const f = fixture();
  const peer = generateKeyPairSync("ed25519"), other = f.registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: Date.now() + 3600000 });
  f.db.exec("CREATE TRIGGER fail_key_completion BEFORE INSERT ON audit_log WHEN NEW.action IN ('personal_context.key_stored','personal_context.key_unknown') BEGIN SELECT RAISE(ABORT,'public completion audit refused'); END");
  expect(() => f.keys.provision(f.input)).toThrow(); f.db.exec("DROP TRIGGER fail_key_completion");
  const result = await runSnapshotBackup({ backupRoot: join(directory, "backups"), sources: [], sqlite: [{ db: f.db, destName: "saydo.db" }], retentionDays: 30 });
  const copied = openDb(join(result.snapshotDir, "saydo.db"));
  expect(copied.prepare("SELECT state FROM personal_context_registrations WHERE id=?").get(other.registrationId)).toEqual({ state: "revoked" });
  expect(copied.prepare("SELECT state,os_result FROM personal_context_key_preparations").get()).toEqual({ state: "revoked", os_result: "unknown" });
  expect(f.db.prepare("SELECT state FROM personal_context_key_preparations").get()).toEqual({ state: "pending" });
  expect(f.software.writes()).toBe(1); expect(f.software.values.size).toBe(1);
});


test.skipIf(process.platform !== "win32")("UPGRADE.T10.126 真实新随机test凭据连接托管与enable，撤销后保留事实且只清理本次精确目标", () => {
  const f = fixture(); let created: PersonalSigningKeyDescriptor | undefined;
  const keys = new PersonalContextKeyCustody(f.db, f.audit, { available: true,
    create(beforeWrite) { created = createWin32PersonalSigningKey("test", beforeWrite); return created; },
    load: loadWin32PersonalSigningKey,
  });
  const registry = new PersonalContextRegistry(f.db, f.audit, Date.now, keys);
  try {
    expect(keys.provision(f.input).state).toBe("stored"); expect(created?.reference).toMatch(/^saydo-personal-context-test\/1\//u);
    expect(registry.change({ registrationId: f.input.registrationId, expectedRevision: 1, action: "enable" }).registrationRevision).toBe(2);
    registry.change({ registrationId: f.input.registrationId, expectedRevision: 2, action: "revoke" });
    expect(keys.provision(f.input).state).toBe("revoked");
    expect(loadWin32PersonalSigningKey(created!).type).toBe("private");
    expect(() => keys.assertReady(f.input.registrationId, 3)).toThrow("key_not_ready");
  } finally {
    if (created) { expect(removeWin32PersonalSigningKey(created)).toBe("removed"); expect(removeWin32PersonalSigningKey(created)).toBe("absent"); }
  }
});


test("UPGRADE.T10.127 实际备份再运行恢复演练，旧私钥仍在但新目录无旧启用权，原库和快照不变", async () => {
  const directory = mkdtempSync(join(tmpdir(), "saydo-key-restore-")); temp.push(directory); const f = fixture(); f.keys.provision(f.input);
  const sessions = join(directory, "sessions"); mkdirSync(sessions);
  const source = JSON.stringify(f.db.prepare("SELECT * FROM personal_context_key_preparations").all());
  const result = await runSnapshotBackup({ backupRoot: join(directory, "backups"), sources: [{ path: sessions, role: "global_sessions" }], requiredRoles: ["sqlite", "global_sessions"], sqlite: [{ db: f.db, destName: "saydo.db" }], retentionDays: 30 });
  const snapshot = join(result.snapshotDir, "saydo.db"), hash = () => createHash("sha256").update(readFileSync(snapshot)).digest("hex"), before = hash();
  const stdout = execFileSync(process.execPath, [resolve("../../scripts/dry-run-restore-snapshot.mjs"), result.snapshotDir], { encoding: "utf-8" });
  const output = JSON.parse(stdout.slice(stdout.indexOf("{"))) as { ok: boolean; dryRunRoot: string; saydoHome: string };
  const rel = relative(homedir(), output.dryRunRoot);
  expect(isAbsolute(rel)).toBe(false); expect(rel.startsWith("..")).toBe(false); expect(rel).toMatch(/^\.saydo-anchor-test-restore-[a-zA-Z0-9]+$/u);
  try {
    expect(output.ok).toBe(true); const restored = openDb(join(output.saydoHome, "saydo.db"));
    try {
      const keys = new PersonalContextKeyCustody(restored, createSqliteAuditSink(restored), f.software.store);
      expect(() => keys.assertReady(f.input.registrationId, 2)).toThrow("key_not_ready");
      expect(restored.prepare("SELECT state FROM personal_context_registrations").get()).toEqual({ state: "revoked" });
      expect(restored.prepare("SELECT state FROM personal_context_key_preparations").get()).toEqual({ state: "revoked" });
    } finally { restored.close(); }
    expect(hash()).toBe(before); expect(JSON.stringify(f.db.prepare("SELECT * FROM personal_context_key_preparations").all())).toBe(source);
    f.keys.assertReady(f.input.registrationId, 1); expect(f.software.values.size).toBe(1);
  } finally { rmSync(output.dryRunRoot, { recursive: true, force: true }); }
});


test("UPGRADE.T10.128 阻塞系统读取期间第二SQLite连接撤销登记或密钥意图，旧currentPeer都拒绝", () => {
  for (const revokeRegistration of [true, false]) {
    const directory = mkdtempSync(join(tmpdir(), "saydo-key-race-")); temp.push(directory); const path = join(directory, "state.sqlite"), f = fixture(path), other = openDb(path);
    try {
      f.keys.provision(f.input); const enabled = f.registry.change({ registrationId: f.input.registrationId, expectedRevision: 1, action: "enable" });
      const otherKeys = new PersonalContextKeyCustody(other, createSqliteAuditSink(other), f.software.store), otherRegistry = new PersonalContextRegistry(other, createSqliteAuditSink(other));
      f.software.duringLoad(() => {
        if (revokeRegistration) otherRegistry.change({ registrationId: f.input.registrationId, expectedRevision: 2, action: "revoke" });
        else otherKeys.revokeForRegistration(f.input.registrationId);
      });
      expect(() => f.registry.currentPeer(enabled)).toThrow("key_not_ready");
      expect(other.prepare(revokeRegistration ? "SELECT state FROM personal_context_registrations" : "SELECT state FROM personal_context_key_preparations").get()).toEqual({ state: "revoked" });
    } finally { other.close(); }
  }
});


test("UPGRADE.T10.129 同步系统读取跨原登记期限，单次墙钟观察不因timer未运行而放行", () => {
  const db = openDb(":memory:"), audit = createSqliteAuditSink(db), software = softwareStore(); let observations = 0;
  const now = () => { observations++; return 1000; };
  const keys = new PersonalContextKeyCustody(db, audit, software.store, now), registry = new PersonalContextRegistry(db, audit, now, keys), peer = generateKeyPairSync("ed25519");
  const registration = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: 1100 });
  keys.provision({ operationId: randomUUID(), registrationId: registration.registrationId, expectedRegistrationRevision: 1 });
  const enabled = registry.change({ registrationId: registration.registrationId, expectedRevision: 1, action: "enable" });
  software.duringLoad(() => { const until = performance.now() + 130; while (performance.now() < until) { /* 模拟同步 OS 读取实际耗时，非假时钟。 */ } });
  observations = 0;
  expect(() => registry.currentPeer(enabled)).toThrow(); expect(observations).toBe(1);
  expect(() => registry.currentPeer(enabled)).toThrow();
});


test("UPGRADE.T10.130 enable内系统读取跨期，业务回滚后独立水位仍阻止回拨复活", () => {
  const db = openDb(":memory:"), audit = createSqliteAuditSink(db), software = softwareStore(), now = () => 1000;
  const keys = new PersonalContextKeyCustody(db, audit, software.store, now), registry = new PersonalContextRegistry(db, audit, now, keys), peer = generateKeyPairSync("ed25519");
  const registration = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: 1100 });
  keys.provision({ operationId: randomUUID(), registrationId: registration.registrationId, expectedRegistrationRevision: 1 });
  software.duringLoad(() => { const until = performance.now() + 130; while (performance.now() < until) { /* 实际同步阻塞。 */ } });
  const enable = () => registry.change({ registrationId: registration.registrationId, expectedRevision: 1, action: "enable" });
  expect(enable).toThrow("key_not_ready");
  expect(db.prepare("SELECT state,revision FROM personal_context_registrations").get()).toEqual({ state: "registered", revision: 1 });
  expect((db.prepare("SELECT high_water FROM personal_context_clock").get() as { high_water: number }).high_water).toBeGreaterThanOrEqual(1100);
  expect(enable).toThrow("not_enableable");
});

test("UPGRADE.T10.131 过期与独立水位提交双失败均保留，未提交最低水位阻止本进程继续授权", () => {
  const db = openDb(":memory:"), audit = createSqliteAuditSink(db), software = softwareStore(), now = () => 1000;
  const keys = new PersonalContextKeyCustody(db, audit, software.store, now), registry = new PersonalContextRegistry(db, audit, now, keys), peer = generateKeyPairSync("ed25519");
  const registration = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: 1100 });
  keys.provision({ operationId: randomUUID(), registrationId: registration.registrationId, expectedRegistrationRevision: 1 });
  const enabled = registry.change({ registrationId: registration.registrationId, expectedRevision: 1, action: "enable" });
  db.exec("CREATE TRIGGER fail_clock_commit BEFORE UPDATE ON personal_context_clock WHEN NEW.high_water>=1100 BEGIN SELECT RAISE(ABORT,'public clock commit failed'); END");
  software.duringLoad(() => { const until = performance.now() + 130; while (performance.now() < until) { /* 实际同步阻塞。 */ } });
  let failure: unknown; try { registry.currentPeer(enabled); } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors.map((error: Error) => error.message)).toEqual(["personal_context_key_not_ready", "public clock commit failed"]);
  expect(() => registry.currentPeer(enabled)).toThrow("public clock commit failed");
  db.exec("DROP TRIGGER fail_clock_commit"); expect(() => registry.currentPeer(enabled)).toThrow("registration_stale");
});


test("UPGRADE.T10.132 失败的阻塞OS读取仍保留到期水位，水位提交失败不覆盖原OS错误", () => {
  for (const failCommit of [false, true]) {
    const db = openDb(":memory:"), audit = createSqliteAuditSink(db), software = softwareStore(), now = () => 1000;
    const keys = new PersonalContextKeyCustody(db, audit, software.store, now), registry = new PersonalContextRegistry(db, audit, now, keys), peer = generateKeyPairSync("ed25519");
    const registration = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: 1100 });
    keys.provision({ operationId: randomUUID(), registrationId: registration.registrationId, expectedRegistrationRevision: 1 });
    const enabled = registry.change({ registrationId: registration.registrationId, expectedRevision: 1, action: "enable" });
    if (failCommit) db.exec("CREATE TRIGGER fail_clock_commit BEFORE UPDATE ON personal_context_clock WHEN NEW.high_water>=1100 BEGIN SELECT RAISE(ABORT,'public clock commit failed'); END");
    software.duringLoad(() => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 130); throw Error("public software OS read failed"); });
    let failure: unknown; try { registry.currentPeer(enabled); } catch (error) { failure = error; }
    if (failCommit) {
      expect(failure).toBeInstanceOf(AggregateError);
      expect((failure as AggregateError).errors.map((error: Error) => error.message)).toEqual(["public software OS read failed", "public clock commit failed"]);
      expect(() => registry.currentPeer(enabled)).toThrow("public clock commit failed"); db.exec("DROP TRIGGER fail_clock_commit");
    } else expect((failure as Error).message).toBe("public software OS read failed");
    expect(() => registry.currentPeer(enabled)).toThrow("registration_stale");
  }
});


test("UPGRADE.T10.133 系统准备跨原期限且墙钟回拨，不能把旧登记意图提交stored", () => {
  const db = openDb(":memory:"), audit = createSqliteAuditSink(db), software = softwareStore(), now = () => 1000;
  const keys = new PersonalContextKeyCustody(db, audit, software.store, now), registry = new PersonalContextRegistry(db, audit, now, keys), peer = generateKeyPairSync("ed25519");
  const registration = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: 1100 });
  const input = { operationId: randomUUID(), registrationId: registration.registrationId, expectedRegistrationRevision: 1 };
  software.afterWrite(() => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 130); });
  expect(() => keys.provision(input)).toThrow();
  expect(keys.provision(input).state).toBe("unknown"); expect(software.writes()).toBe(1);
  expect(() => registry.change({ registrationId: registration.registrationId, expectedRevision: 1, action: "enable" })).toThrow();
});


test("UPGRADE.T10.134 准备前过期零写入，创建或回读失败跨期保unknown与独立水位", () => {
  for (const phase of ["before-intent", "create-failed", "load-failed"]) {
    const db = openDb(":memory:"), audit = createSqliteAuditSink(db), software = softwareStore(), now = () => 1000;
    const originalCreate = software.store.create;
    if (phase === "before-intent") software.store.create = before => originalCreate(facts => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 130); before(facts); });
    if (phase === "create-failed") software.afterWrite(() => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 130); throw Error("public software create failed"); });
    if (phase === "load-failed") software.duringLoad(() => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 130); throw Error("public software readback failed"); });
    const keys = new PersonalContextKeyCustody(db, audit, software.store, now), registry = new PersonalContextRegistry(db, audit, now, keys), peer = generateKeyPairSync("ed25519");
    const registration = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peer.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: 1100 });
    const input = { operationId: randomUUID(), registrationId: registration.registrationId, expectedRegistrationRevision: 1 };
    expect(() => keys.provision(input)).toThrow("key_prepare_failed");
    if (phase === "before-intent") {
      expect(software.writes()).toBe(0); expect(db.prepare("SELECT count(*) n FROM personal_context_key_preparations").get()).toEqual({ n: 0 });
    } else { expect(keys.provision(input).state).toBe("unknown"); expect(software.writes()).toBe(1); }
    expect((db.prepare("SELECT high_water FROM personal_context_clock").get() as { high_water: number }).high_water).toBeGreaterThanOrEqual(1100);
    expect(() => registry.change({ registrationId: registration.registrationId, expectedRevision: 1, action: "enable" })).toThrow("not_enableable");
  }
});
