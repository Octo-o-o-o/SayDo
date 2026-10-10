// 仅本次测试拥有的独立 Node 对端；密钥留在该子进程，父进程只收到公钥。
import { createPublicKey, generateKeyPairSync, randomBytes } from "node:crypto";
import { openWin32PersonalPipe } from "@saydo/platform";
import { personalContextEventRequestSchema, personalContextEventResponseSchema } from "@saydo/contracts";
import { PersonalContextWindowsTransport } from "../../src/personalContext/windowsTransport.js";
const pair = generateKeyPairSync("ed25519");
let transport: PersonalContextWindowsTransport | undefined;
let pipe: Awaited<ReturnType<typeof openWin32PersonalPipe>> | undefined;
let busy = false;
process.send!({ type: "publicKey", publicKey: pair.publicKey.export({ type: "spki", format: "pem" }).toString() });
process.on("message", (message: { type: string; endpoint?: string; publicKey?: string; request?: unknown }) => {
  if (busy) { process.send!({ type: "error", code: "public_peer_busy" }); return; }
  busy = true;
  void (async () => {
    if (message.type === "close") { await transport?.close(); await pipe?.close(); process.send!({ type: "closed" }); process.disconnect(); return; }
    const request = personalContextEventRequestSchema.parse(message.request);
    if (!transport) {
      pipe = await openWin32PersonalPipe(message.endpoint!);
      transport = await PersonalContextWindowsTransport.establish(pipe, { role: "anyvia", identity: request.identity, bootEpoch: randomBytes(32).toString("base64url"), privateKey: pair.privateKey, peerKey: createPublicKey(message.publicKey!), assertCurrent() {} });
      process.send!({ type: "connected", pid: process.pid });
    }
    const response = transport.receive(personalContextEventResponseSchema);
    void response.catch(() => undefined);
    await transport.send(personalContextEventRequestSchema, request, commit => commit());
    process.send!({ type: "response", value: await response });
  })().catch(async () => {
    try { await transport?.close(); await pipe?.close(); process.send!({ type: "rejected" }); }
    catch { process.send!({ type: "cleanupRejected" }); process.exitCode = 1; }
  }).finally(() => { busy = false; });
});
process.on("disconnect", () => { void Promise.all([transport?.close(), pipe?.close()]).catch(() => { process.exitCode = 1; }); });
