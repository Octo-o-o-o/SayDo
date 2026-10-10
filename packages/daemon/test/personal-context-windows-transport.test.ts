// 真实本机命名管道与加密握手；没有连接日用 daemon 或外部账户。
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { createWin32PersonalPipe, openWin32PersonalPipe } from "@saydo/platform";
import { personalContextStatusSchema, type PersonalContextPeerIdentity } from "@saydo/contracts";
import { PersonalContextWindowsTransport } from "../src/personalContext/windowsTransport.js";

const windows = test.runIf(process.platform === "win32");
async function fixture(wrongKey = false) {
  const server = createWin32PersonalPipe();
  const accept = server.accept(); const client = await openWin32PersonalPipe(server.name); await accept;
  const s = generateKeyPairSync("ed25519"), a = generateKeyPairSync("ed25519");
  const identity: PersonalContextPeerIdentity = { installationId: randomUUID(), peerInstallationId: randomUUID(), nodeId: randomUUID(), connectionId: randomUUID(), connectionEpoch: 1, registrationId: randomUUID(), registrationRevision: 1 };
  let revoked = false;
  const assertCurrent = () => { if (revoked) throw Error("revoked"); };
  const connections = await Promise.allSettled([
    PersonalContextWindowsTransport.establish(server, { role: "saydo", identity, bootEpoch: randomBytes(32).toString("base64url"), privateKey: s.privateKey, peerKey: a.publicKey, assertCurrent }),
    PersonalContextWindowsTransport.establish(client, { role: "anyvia", identity, bootEpoch: randomBytes(32).toString("base64url"), privateKey: a.privateKey, peerKey: wrongKey ? generateKeyPairSync("ed25519").publicKey : s.publicKey, assertCurrent }),
  ]);
  return { server, client, connections, revoke: () => { revoked = true; }, async close() { await Promise.all([server.close(), client.close()]); } };
}
function pair(f: Awaited<ReturnType<typeof fixture>>) {
  const [s, a] = f.connections;
  if (s?.status !== "fulfilled" || a?.status !== "fulfilled") throw Error("handshake failed");
  return { saydo: s.value, anyvia: a.value };
}
function receipt() { return { operationId: randomUUID(), payloadDigest: `sha256:${"a".repeat(64)}`, state: "unknown" as const, sourceReceiptDigest: null }; }

windows("UPGRADE.T08.103 真实内核绑定与双方密钥确认后严格状态往返", async () => {
  const f = await fixture();
  try {
    const p = pair(f), value = receipt();
    const receive = p.anyvia.receive(personalContextStatusSchema);
    await p.saydo.send(personalContextStatusSchema, value, commit => commit());
    expect(await receive).toEqual(value);
    const back = p.saydo.receive(personalContextStatusSchema);
    await p.anyvia.send(personalContextStatusSchema, value, commit => commit());
    expect(await back).toEqual(value);
    await Promise.all([p.saydo.close(), p.anyvia.close()]);
  } finally { await f.close(); }
});

windows("UPGRADE.T08.104 最终写入前撤销使真实对端收不到业务正文", async () => {
  const f = await fixture();
  try {
    const p = pair(f);
    const receive = p.anyvia.receive(personalContextStatusSchema).then(() => "unexpected plaintext", () => "rejected");
    await expect(p.saydo.send(personalContextStatusSchema, receipt(), commit => { f.revoke(); commit(); })).rejects.toThrow();
    expect(await receive).toBe("rejected");
    await p.anyvia.close();
  } finally { await f.close(); }
});

windows("UPGRADE.T08.105 同用户真实管道不能绕过登记公钥绑定", async () => {
  const f = await fixture(true);
  try { expect(f.connections.map(result => result.status)).toEqual(["rejected", "rejected"]); }
  finally { await f.close(); }
});

windows("UPGRADE.T08.106 无后续调用时闲置截止仍关闭实际管道", async () => {
  const f = await fixture();
  try {
    const p = pair(f);
    await new Promise(resolve => setTimeout(resolve, 5200));
    expect(() => f.server.assertCurrent()).toThrow();
    expect(() => f.client.assertCurrent()).toThrow();
    await Promise.all([p.saydo.closed, p.anyvia.closed]);
    await expect(p.anyvia.send(personalContextStatusSchema, receipt(), commit => commit())).rejects.toThrow();
    await Promise.all([p.saydo.close(), p.anyvia.close()]);
  } finally { await f.close(); }
}, 15000);

windows("UPGRADE.T08.107 巨大长度头立即关闭而不等待或分配正文", async () => {
  const f = await fixture();
  try {
    const p = pair(f), header = Buffer.alloc(4); header.writeUInt32BE(0xffffffff);
    const result = p.saydo.receive(personalContextStatusSchema).then(() => "unexpected plaintext", () => "rejected");
    await f.client.write(header, commit => commit());
    expect(await result).toBe("rejected");
    expect(() => f.server.assertCurrent()).toThrow();
    await p.anyvia.close();
  } finally { await f.close(); }
});

windows("UPGRADE.T08.108 同步最终写者阻塞不能越过五秒期限进入内核", async () => {
  const f = await fixture();
  try {
    const p = pair(f);
    const bytes = f.client.readExact(4).then(() => "unexpected bytes", () => "rejected");
    await expect(p.saydo.send(personalContextStatusSchema, receipt(), commit => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5200);
      commit();
    })).rejects.toThrow();
    expect(await bytes).toBe("rejected");
    await p.saydo.closed;
    await p.anyvia.close();
  } finally { await f.close(); }
}, 15000);
