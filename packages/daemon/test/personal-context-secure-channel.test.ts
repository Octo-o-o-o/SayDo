// 使用真实 Node 加密；端点字段是显式软件夹具，不声称已验证 OS 端点或产品装配。
import { generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { expect, test } from "vitest";
import { jcsDigest, jcsSerialize, PERSONAL_CONTEXT_MAX_FRAME_BYTES, type PersonalContextTransportBinding } from "@saydo/contracts";
import { PersonalContextSecureHandshake, personalContextPublicKeyDigest } from "../src/personalContext/secureChannel.js";

const json = (value: unknown) => Buffer.from(jcsSerialize(value));
function fixture() {
  const saydoKey = generateKeyPairSync("ed25519"), anyviaKey = generateKeyPairSync("ed25519");
  const binding: PersonalContextTransportBinding = {
    identity: { installationId: randomUUID(), peerInstallationId: randomUUID(), nodeId: randomUUID(), connectionId: randomUUID(), connectionEpoch: 1, registrationId: randomUUID(), registrationRevision: 2 },
    saydoKeyDigest: personalContextPublicKeyDigest(saydoKey.publicKey), anyviaKeyDigest: personalContextPublicKeyDigest(anyviaKey.publicKey),
    endpoint: { platform: "win32", endpointDigest: jcsDigest({ endpoint: "software-fixture" }), owner: "S-1-5-21-123", saydo: { pid: 1, birth: "100" }, anyvia: { pid: 2, birth: "200" } },
  };
  let revoked = false, now = 100;
  const assertCurrent = () => { if (revoked) throw Error("revoked"); };
  const make = () => ({
    saydo: new PersonalContextSecureHandshake({ role: "saydo", binding, bootEpoch: randomBytes(32).toString("base64url"), privateKey: saydoKey.privateKey, peerKey: anyviaKey.publicKey, assertCurrent, monotonicNow: () => now }),
    anyvia: new PersonalContextSecureHandshake({ role: "anyvia", binding, bootEpoch: randomBytes(32).toString("base64url"), privateKey: anyviaKey.privateKey, peerKey: saydoKey.publicKey, assertCurrent, monotonicNow: () => now }),
  });
  const handshake = (pair = make()) => {
    const saydoHello = pair.saydo.helloBytes(), anyviaHello = pair.anyvia.helloBytes();
    const saydoAssertion = pair.saydo.acceptHello(anyviaHello), anyviaAssertion = pair.anyvia.acceptHello(saydoHello);
    return { saydo: pair.saydo.finish(anyviaAssertion), anyvia: pair.anyvia.finish(saydoAssertion) };
  };
  const connected = () => {
    const pair = handshake(); const a = pair.anyvia.confirmation(), s = pair.saydo.confirmation();
    pair.anyvia.acceptConfirmation(s); pair.saydo.acceptConfirmation(a); return pair;
  };
  return { binding, make, handshake, connected, anyviaPrivate: anyviaKey.privateKey, revoke: () => { revoked = true; }, time: (value: number) => { now = value; } };
}

test("UPGRADE.T08.084 双向真实签名/X25519/GCM密钥确认后才交付准确正文", () => {
  const f = fixture(), c = f.connected(), original = json({ claim: "private-context-body", operationId: randomUUID() });
  const frame = c.anyvia.seal(original);
  expect(frame.includes(original)).toBe(false);
  expect(c.saydo.open(frame)).toEqual(original);
  expect(c.anyvia.open(c.saydo.seal(json({ receipt: "applied" })))).toEqual(json({ receipt: "applied" }));
  c.saydo.close(); c.anyvia.close();
  const unconfirmed = fixture().handshake();
  expect(() => unconfirmed.anyvia.seal(original)).toThrow("rejected");
  unconfirmed.saydo.close();
});

test("UPGRADE.T08.085 替换安装/端点/进程身份及未知握手字段拒绝", () => {
  for (const change of [
    (v: Record<string, unknown>) => { v.extra = true; },
    (v: Record<string, unknown>) => { (v.binding as PersonalContextTransportBinding).endpoint.anyvia.birth = "201"; },
    (v: Record<string, unknown>) => { (v.binding as PersonalContextTransportBinding).identity.connectionEpoch++; },
  ]) {
    const p = fixture().make(); const hello = JSON.parse(p.anyvia.helloBytes().toString()) as Record<string, unknown>; change(hello);
    expect(() => p.saydo.acceptHello(json(hello))).toThrow("rejected"); p.anyvia.close();
  }
});

test("UPGRADE.T08.086 中继替换临时公钥不能拼接双方签名", () => {
  const f = fixture(), p = f.make(); const original = p.anyvia.helloBytes(), s = p.saydo.helloBytes();
  const changed = JSON.parse(original.toString());
  changed.ephemeralKey = generateKeyPairSync("x25519").publicKey.export({ format: "der", type: "spki" }).toString("base64url");
  const saydoAssertion = p.saydo.acceptHello(json(changed)), anyviaAssertion = p.anyvia.acceptHello(s);
  expect(() => p.saydo.finish(anyviaAssertion)).toThrow("rejected");
  expect(() => p.anyvia.finish(saydoAssertion)).toThrow("rejected");
});

test("UPGRADE.T08.087 改帧/截断/反射/重放与旧连接密文使通道永久关闭", () => {
  for (const kind of ["tamper", "truncate", "reflection", "replay", "old-channel"] as const) {
    const f = fixture(), c = f.connected(); let frame = c.anyvia.seal(json({ body: "private" }));
    if (kind === "tamper") frame[frame.length - 1] = (frame[frame.length - 1] ?? 0) ^ 1;
    if (kind === "truncate") frame = frame.subarray(0, frame.length - 1);
    if (kind === "reflection") frame = c.saydo.seal(json({ body: "reflected" }));
    if (kind === "replay") expect(c.saydo.open(frame)).toEqual(json({ body: "private" }));
    if (kind === "old-channel") { const other = f.connected(); frame = other.anyvia.seal(json({ body: "old" })); other.saydo.close(); other.anyvia.close(); }
    expect(() => c.saydo.open(frame)).toThrow("rejected");
    expect(() => c.saydo.open(c.anyvia.seal(json({ body: "later" })))).toThrow("rejected"); c.anyvia.close();
  }
});

test("UPGRADE.T08.088 握手期限/回拨/撤销以及已认证待发送分别拒绝", () => {
  const f = fixture(), p = f.make(), hello = p.anyvia.helloBytes(); f.time(5100);
  expect(() => p.saydo.acceptHello(hello)).toThrow("rejected"); f.time(100);
  expect(() => p.saydo.helloBytes()).toThrow("rejected"); p.anyvia.close();
  const rollback = fixture(), r = rollback.make(); rollback.time(99);
  expect(() => r.saydo.helloBytes()).toThrow("rejected"); r.anyvia.close();
  const active = fixture(), c = active.connected(); active.revoke();
  expect(() => c.anyvia.seal(json({ body: "denied" }))).toThrow("rejected"); c.saydo.close();
});

test("UPGRADE.T08.089 65536含开销且方向512帧含确认帧不重复nonce", () => {
  const c = fixture().connected(); const plain = Buffer.alloc(PERSONAL_CONTEXT_MAX_FRAME_BYTES - 28, 65);
  const frame = c.anyvia.seal(plain); expect(frame.length).toBe(PERSONAL_CONTEXT_MAX_FRAME_BYTES); expect(c.saydo.open(frame)).toEqual(plain);
  for (let i = 2; i < 512; i++) expect(c.saydo.open(c.anyvia.seal(Buffer.from("x")))).toEqual(Buffer.from("x"));
  expect(() => c.anyvia.seal(Buffer.from("x"))).toThrow("rejected"); c.saydo.close();
  const oversized = fixture().connected(); expect(() => oversized.anyvia.seal(Buffer.alloc(65509))).toThrow("rejected"); oversized.saydo.close();
});

test("UPGRADE.T08.090 非规范JSON/重复键/非法UTF8/握手超长直接拒绝", () => {
  const invalid = [Buffer.from("{\"role\":\"saydo\",\"role\":\"anyvia\"}"), Buffer.from([0xff, 0xfe]), Buffer.alloc(8193), Buffer.from("{} ")];
  for (const input of invalid) { const p = fixture().make(); expect(() => p.saydo.acceptHello(input)).toThrow("rejected"); p.anyvia.close(); }
});

test("UPGRADE.T08.091 已登记合法签名也不能放行全零X25519共享秘密", () => {
  const f = fixture(), p = f.make(); const s = JSON.parse(p.saydo.helloBytes().toString()), a = JSON.parse(p.anyvia.helloBytes().toString());
  const key = Buffer.from(a.ephemeralKey, "base64url"); key.fill(0, key.length - 32); a.ephemeralKey = key.toString("base64url");
  p.saydo.acceptHello(json(a));
  const transcript = { domain: "personal-context-handshake/1", anyvia: a, saydo: s };
  const assertion = { role: "anyvia", transcriptDigest: jcsDigest(transcript), signature: sign(null, json({ domain: "personal-context-handshake-signature/1", role: "anyvia", transcript }), f.anyviaPrivate).toString("base64url") };
  expect(() => p.saydo.finish(json(assertion))).toThrow("rejected"); p.anyvia.close();
});

test("UPGRADE.T08.092 乱序与重复密钥确认不进入可用状态", () => {
  const c = fixture().connected(); c.anyvia.seal(Buffer.from("first")); const second = c.anyvia.seal(Buffer.from("second"));
  expect(() => c.saydo.open(second)).toThrow("rejected"); c.anyvia.close();
  const p = fixture().handshake(), confirmation = p.anyvia.confirmation(); p.saydo.acceptConfirmation(confirmation);
  expect(() => p.saydo.acceptConfirmation(confirmation)).toThrow("rejected"); p.anyvia.close();
});

test("UPGRADE.T08.093 密钥确认继承握手起点截止而非签名完成时重新计时", () => {
  const lateSend = fixture(), a = lateSend.handshake(); lateSend.time(5100);
  expect(() => a.anyvia.confirmation()).toThrow("rejected"); a.saydo.close();
  const lateReceive = fixture(), b = lateReceive.handshake(), frame = b.anyvia.confirmation(); lateReceive.time(5100);
  expect(() => b.saydo.acceptConfirmation(frame)).toThrow("rejected"); b.anyvia.close();
  const idle = fixture(), c = idle.connected(); idle.time(5100);
  expect(() => c.anyvia.seal(Buffer.from("idle"))).toThrow("rejected"); c.saydo.close();
});
