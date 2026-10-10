import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { expect, test } from "vitest";
import { jcsDigest } from "@saydo/contracts";
import { PersonalContextPeerAuthentication, peerAssertionBytes, type AuthenticatedPeerHandle } from "../src/personalContext/peerAuthentication.js";
function fixture() {
  const key = generateKeyPairSync("ed25519"), identity = { installationId: randomUUID(), nodeId: randomUUID(), connectionId: randomUUID(), connectionEpoch: 1, peerInstallationId: randomUUID(), registrationId: randomUUID(), registrationRevision: 1 }, digest = jcsDigest({ effect: "exact effect" });
  let publicKey = key.publicKey.export({ type: "spki", format: "pem" }).toString(), revoked = false, now = 100;
  const auth = new PersonalContextPeerAuthentication(value => { if (revoked || JSON.stringify(value) !== JSON.stringify(identity)) throw Error("peer revoked"); return { publicKey }; }, () => now);
  const issue = () => { const challenge = auth.challenge(identity); return { nonce: challenge.nonce, operationDigest: digest, signature: sign(null, peerAssertionBytes(challenge, identity, digest), key.privateKey).toString("base64url") }; };
  return { auth, identity, digest, issue, revoke: () => { revoked = true; }, rotate: () => { publicKey = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString(); }, time: (value: number) => { now = value; } };
}
test("UPGRADE.T08.058 真实Ed25519安装认证不能跨效果/重放挑战/自报owner", () => {
  const f = fixture(), assertion = f.issue(), handle = f.auth.authenticate(assertion);
  expect(f.auth.assertCurrent(handle, f.digest)).toEqual(f.identity);
  expect(() => f.auth.assertCurrent(handle, jcsDigest({ effect: "another" }))).toThrow("stale");
  expect(() => f.auth.authenticate(assertion)).toThrow("stale");
  expect(() => f.auth.authenticate({ ...f.issue(), owner: true })).toThrow("shape");
  expect(() => f.auth.assertCurrent({} as AuthenticatedPeerHandle, f.digest)).toThrow("stale");
  f.auth.discard(handle); expect(() => f.auth.assertCurrent(handle, f.digest)).toThrow("stale");
});
test("UPGRADE.T08.059 当前公钥撤销/替换使排队签名和已经认证句柄失效", () => {
  const pending = fixture(), assertion = pending.issue(); pending.rotate();
  expect(() => pending.auth.authenticate(assertion)).toThrow("key_changed");
  const active = fixture(), handle = active.auth.authenticate(active.issue()); active.rotate();
  expect(() => active.auth.assertCurrent(handle, active.digest)).toThrow("key_changed");
  const revoked = fixture(), current = revoked.auth.authenticate(revoked.issue()); revoked.revoke();
  expect(() => revoked.auth.assertCurrent(current, revoked.digest)).toThrow("revoked");
});
test("UPGRADE.T08.060 错误签名被拒，过期后时钟回拨不复活句柄", () => {
  const f = fixture(), bad = f.issue(); bad.signature = "A".repeat(86);
  expect(() => f.auth.authenticate(bad)).toThrow("signature_invalid");
  const handle = f.auth.authenticate(f.issue()); f.time(31000);
  expect(() => f.auth.assertCurrent(handle, f.digest)).toThrow("stale");
  f.time(100); expect(() => f.auth.assertCurrent(handle, f.digest)).toThrow("stale");
});
