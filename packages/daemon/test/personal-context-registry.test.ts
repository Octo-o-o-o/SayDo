import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request } from "node:http";
import { once } from "node:events";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { newId, PERSONAL_CONTEXT_PROTOCOL, personalContextEffectDigest, type PersonalContextEffect, type PersonalContextPeerIdentity } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { createFocus } from "../src/focus/registry.js";
import { startActivation } from "../src/focus/activation.js";
import { captureFocusAuthSnapshot } from "../src/focus/binding.js";
import { PersonalContextRegistry } from "../src/personalContext/registry.js";
import { peerAssertionBytes } from "../src/personalContext/peerAuthentication.js";
import { handlePersonalContextOwnerApi } from "../src/api/personalContextOwner.js";
import { extractToken, verifyIdentity } from "../src/net/identity.js";

beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(100); });
afterEach(() => { vi.restoreAllMocks(); });
function fixture(path = ":memory:", clock?: () => number) {
  const db = openDb(path), realAudit = createSqliteAuditSink(db), key = generateKeyPairSync("ed25519");
  let fail = false, now = 100;
  const audit = { sharesSqlite: realAudit.sharesSqlite!, record: (event: Parameters<typeof realAudit.record>[0]) => {
    if (fail) throw Error("audit_injected"); return realAudit.record(event);
  } };
  const registry = new PersonalContextRegistry(db, audit, clock ?? (() => now));
  const registration = { peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: key.publicKey.export({ type: "spki", format: "pem" }).toString(), expiresAt: 10000 };
  return { db, registry, key, registration, audit, failAudit: (value: boolean) => { fail = value; }, time: (value: number) => { now = value; } };
}
function enabled(f: ReturnType<typeof fixture>) {
  const value = f.registry.register(f.registration);
  return f.registry.change({ registrationId: value.registrationId, expectedRevision: 1, action: "enable" });
}
function sourceEffect(db: Db, peer: PersonalContextPeerIdentity): PersonalContextEffect {
  const project = newId("prj"), session = newId("ses"), at = "2026-10-10T00:00:00Z";
  db.prepare("INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at) VALUES(?,'测试','coding','active','{}','step_confirm',?,?)").run(project, at, at);
  db.prepare("INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at) VALUES(?,?,'talking','cascade','unused',?)").run(session, project, at);
  const { focusId } = createFocus(db, { title: "本机登记测试" });
  startActivation(db, { focusId, sessionId: session, trigger: "user_explicit" });
  const source = captureFocusAuthSnapshot(db, session)!;
  const value = { protocol: PERSONAL_CONTEXT_PROTOCOL, operationId: randomUUID(),
    boundary: { installationId: peer.installationId, nodeId: peer.nodeId, connectionId: peer.connectionId, connectionEpoch: peer.connectionEpoch, authorityEpoch: 1, vaultGeneration: 1, restrictionSequence: 0 },
    link: { spaceId: "unified", caseId: randomUUID(), caseRevision: 1, controlGeneration: 1, hardConstraintsRevision: 1, focusId, focusRevision: source.focusRevision, focusAuthorityEpoch: source.authorityEpoch, focusAnchorRevision: source.focusAnchorRevision, sessionId: session },
    expiresAt: 1000, method: "compile/request" as const, payload: { contextId: randomUUID(), purpose: "answer", processorId: "saydo", recipientId: "exact-agent", maxBytes: 1024 } };
  return { ...value, payloadDigest: personalContextEffectDigest(value) };
}
function assertion(f: ReturnType<typeof fixture>, peer: PersonalContextPeerIdentity, digest: string) {
  const challenge = f.registry.authentication.challenge(peer);
  return { nonce: challenge.nonce, operationDigest: digest, signature: sign(null, peerAssertionBytes(challenge, peer, digest), f.key.privateKey).toString("base64url") };
}

test("UPGRADE.T08.076 登记默认关闭，启用不授予任何操作许可且拒私钥输入", () => {
  const f = fixture();
  const peer = f.registry.register(f.registration);
  expect(() => f.registry.authentication.challenge(peer)).toThrow("registration_stale");
  const active = f.registry.change({ registrationId: peer.registrationId, expectedRevision: 1, action: "enable" });
  const effect = sourceEffect(f.db, active), handle = f.registry.authentication.authenticate(assertion(f, active, effect.payloadDigest));
  expect(() => f.registry.assertLocalPermission(handle, randomUUID(), effect)).toThrow("permission_denied");
  expect(() => f.registry.register({ ...f.registration, publicKey: f.key.privateKey.export({ type: "pkcs8", format: "pem" }).toString() })).toThrow("public_key_required");
  expect(f.registry.list()).toMatchObject({ transport: "not_connected", registrations: [{ sessionEnabled: true, permissions: [] }] });
});

test("UPGRADE.T08.077 暂停原子撤销许可，同key新登记不复活旧挑战或句柄", () => {
  const f = fixture(), peer = enabled(f), effect = sourceEffect(f.db, peer);
  const permission = f.registry.grant({ registrationId: peer.registrationId, expectedRegistrationRevision: peer.registrationRevision, method: effect.method, link: effect.link, expiresAt: 1000 });
  const pending = assertion(f, peer, effect.payloadDigest), handle = f.registry.authentication.authenticate(assertion(f, peer, effect.payloadDigest));
  f.registry.assertLocalPermission(handle, permission.permissionId, effect);
  f.failAudit(true);
  expect(() => f.registry.change({ registrationId: peer.registrationId, expectedRevision: 2, action: "pause" })).toThrow("audit_injected");
  f.registry.assertLocalPermission(handle, permission.permissionId, effect);
  f.failAudit(false);
  f.registry.change({ registrationId: peer.registrationId, expectedRevision: 2, action: "pause" });
  expect(() => f.registry.change({ registrationId: peer.registrationId, expectedRevision: 3, action: "enable" })).toThrow("not_enableable");
  const next = enabled(f);
  expect(next.connectionEpoch).toBe(2); expect(next.connectionId).not.toBe(peer.connectionId);
  expect(() => f.registry.authentication.authenticate(pending)).toThrow("registration_stale");
  expect(() => f.registry.assertLocalPermission(handle, permission.permissionId, effect)).toThrow("registration_stale");
  expect(f.db.prepare("SELECT state,revision FROM personal_context_permissions WHERE id=?").get(permission.permissionId)).toEqual({ state: "revoked", revision: 2 });
});

test("UPGRADE.T08.078 精确Case及方法许可不升级，篡改身份与SQL权限扩范围均拒绝", () => {
  const f = fixture(), peer = enabled(f), effect = sourceEffect(f.db, peer);
  const permission = f.registry.grant({ registrationId: peer.registrationId, expectedRegistrationRevision: 2, method: effect.method, link: effect.link, expiresAt: 1000 });
  const changed = { ...effect, link: { ...effect.link, caseId: randomUUID() } }; changed.payloadDigest = personalContextEffectDigest(changed);
  const handle = f.registry.authentication.authenticate(assertion(f, peer, changed.payloadDigest));
  expect(() => f.registry.assertLocalPermission(handle, permission.permissionId, changed)).toThrow("permission_scope");
  const candidate = { ...effect, method: "candidate/propose", payload: { permissionId: permission.permissionId, permissionRevision: 1, recordId: null, baseRevision: null, semanticKey: "preference", claim: "最小候选", kind: "preference", sourceEventId: newId("fev"), sourceDigest: effect.payloadDigest } };
  candidate.payloadDigest = personalContextEffectDigest(candidate);
  const candidateHandle = f.registry.authentication.authenticate(assertion(f, peer, candidate.payloadDigest));
  expect(() => f.registry.assertLocalPermission(candidateHandle, permission.permissionId, candidate)).toThrow("permission_denied");
  expect(() => f.registry.authentication.challenge({ ...peer, peerInstallationId: randomUUID() })).toThrow("registration_stale");
  expect(() => f.db.prepare("UPDATE personal_context_permissions SET method='request/respond',revision=revision+1 WHERE id=?").run(permission.permissionId)).toThrow("immutable");
  expect(() => f.db.prepare("UPDATE personal_context_registrations SET public_key='changed',revision=revision+1 WHERE id=?").run(peer.registrationId)).toThrow("immutable");
});

test("UPGRADE.T08.079 物理库重开不恢复peer会话，过期后回拨仍拒且允许收紧", () => {
  const path = join(mkdtempSync(join(tmpdir(), "saydo-registry-")), "state.sqlite");
  const f = fixture(path), peer = enabled(f), digest = `sha256:${"a".repeat(64)}`;
  const pending = assertion(f, peer, digest);
  f.time(10001); expect(() => f.registry.currentPeer(peer)).toThrow("registration_stale");
  f.time(1); expect(() => f.registry.currentPeer(peer)).toThrow("registration_stale");
  f.db.close();
  const reopened = fixture(path);
  expect(() => reopened.registry.authentication.authenticate(pending)).toThrow("challenge_stale");
  expect(() => reopened.registry.currentPeer(peer)).toThrow("registration_stale");
  expect(reopened.registry.list()).toMatchObject({ registrations: [{ state: "enabled", sessionEnabled: false }] });
  expect(reopened.registry.change({ registrationId: peer.registrationId, expectedRevision: 2, action: "revoke" }).registrationRevision).toBe(3);
  expect(reopened.db.prepare("SELECT high_water FROM personal_context_clock").get()).toEqual({ high_water: 10001 });
});

test("UPGRADE.T08.080 真实HTTP登记入口复用本机CAP及Host来源门，不接受peer自报Owner", async () => {
  const f = fixture(); let port = 0;
  const cap = "local-owner-test-capability";
  const server = createServer((req, res) => {
    void handlePersonalContextOwnerApi(req, res, f.registry, () => {
      const checked = verifyIdentity({ host: req.headers.host, origin: req.headers.origin,
        peerAddress: req.socket.remoteAddress, token: extractToken(req.url, req.headers),
        port, expectedToken: cap, tailnetHosts: [] });
      return checked.ok && checked.via === "local";
    });
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}/api/personal-context/registrations`;
  try {
    for (const headers of [{}, { "x-saydo-token": "peer-self-declared-owner" }, { "x-saydo-token": cap, origin: "https://evil.invalid" }, { "x-saydo-token": cap, host: "evil.invalid" }]) {
      // Node fetch 会重写 Host；使用真实 http.request 保留待验证的恶意头。
      const req = request(url, { method: "POST", headers: { "content-type": "application/json", ...headers } });
      const response = once(req, "response"); req.end(JSON.stringify(f.registration));
      const [res] = await response; res.resume(); await once(res, "end");
      expect(res.statusCode).toBe(403);
    }
    expect(f.db.prepare("SELECT COUNT(*) n FROM personal_context_registrations").get()).toEqual({ n: 0 });
    const response = await fetch(url, { method: "POST", headers: { "x-saydo-token": cap, "content-type": "application/json" }, body: JSON.stringify(f.registration) });
    expect(response.status).toBe(200);
    const list = await fetch(url, { headers: { "x-saydo-token": cap } });
    expect(await list.json()).toMatchObject({ ok: true, transport: "not_connected", registrations: [{ state: "registered", sessionEnabled: false, permissions: [] }] });
  } finally { server.closeAllConnections(); server.close(); await once(server, "close"); }
});

test("UPGRADE.T08.081 正文在途撤销本机身份后最终写入拒绝，审计不假记成功", async () => {
  const f = fixture(); let port = 0, cap = "first-test-capability";
  let observed!: () => void;
  const firstCheck = new Promise<void>(resolve => { observed = resolve; });
  const server = createServer((req, res) => {
    void handlePersonalContextOwnerApi(req, res, f.registry, () => {
      const checked = verifyIdentity({ host: req.headers.host, origin: req.headers.origin,
        peerAddress: req.socket.remoteAddress, token: extractToken(req.url, req.headers), port, expectedToken: cap });
      observed(); return checked.ok && checked.via === "local";
    });
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); port = (server.address() as { port: number }).port;
  try {
    const body = JSON.stringify(f.registration);
    const req = request({ host: "127.0.0.1", port, path: "/api/personal-context/registrations", method: "POST", headers: { "x-saydo-token": cap, "content-type": "application/json" } });
    const response = once(req, "response");
    req.write(body.slice(0, 5)); await firstCheck;
    cap = "new-test-capability"; req.end(body.slice(5));
    const [res] = await response; res.resume(); await once(res, "end");
    expect(res.statusCode).toBe(403);
    expect(f.db.prepare("SELECT COUNT(*) n FROM personal_context_registrations").get()).toEqual({ n: 0 });
    expect(f.db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='personal_context.registered'").get()).toEqual({ n: 0 });
  } finally { server.closeAllConnections(); server.close(); await once(server, "close"); }
});

test("UPGRADE.T08.082 握手观察到过期后独立提交水位，第二次回拨不复活", () => {
  let calls = 0, probing = false;
  const f = fixture(":memory:", () => probing ? (++calls === 1 ? 10001 : 100) : 100), peer = enabled(f);
  probing = true;
  expect(() => f.registry.authentication.challenge(peer)).toThrow("registration_stale");
  expect(calls).toBe(1);
  expect(f.db.prepare("SELECT high_water FROM personal_context_clock").get()).toEqual({ high_water: 10001 });
  expect(() => f.registry.authentication.challenge(peer)).toThrow("registration_stale");
});

test("UPGRADE.T08.083 已认证许可检查只采一次，下一轮过期及回拨均拒绝", () => {
  let at = 100, probing = false, calls = 0;
  const f = fixture(":memory:", () => probing ? (++calls === 1 ? 100 : 2000) : at), peer = enabled(f), effect = sourceEffect(f.db, peer);
  const permission = f.registry.grant({ registrationId: peer.registrationId, expectedRegistrationRevision: 2, method: effect.method, link: effect.link, expiresAt: 1000 });
  const handle = f.registry.authentication.authenticate(assertion(f, peer, effect.payloadDigest));
  probing = true;
  f.registry.assertLocalPermission(handle, permission.permissionId, effect);
  expect(calls).toBe(1);
  probing = false; at = 2000;
  expect(() => f.registry.assertLocalPermission(handle, permission.permissionId, effect)).toThrow("permission_denied");
  at = 100;
  expect(() => f.registry.assertLocalPermission(handle, permission.permissionId, effect)).toThrow("permission_denied");
  expect(f.db.prepare("SELECT high_water FROM personal_context_clock").get()).toEqual({ high_water: 2000 });
});
