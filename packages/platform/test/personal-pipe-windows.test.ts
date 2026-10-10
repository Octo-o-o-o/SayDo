// 真实本机 Windows kernel32/advapi32；不修改用户配置，不代表产品身份已配对。
import { expect, test } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createServer, type Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createWin32PersonalPipe, openWin32PersonalPipe } from "../src/win32.js";
const windows = test.skipIf(process.platform !== "win32");

windows("UPGRADE.T08.094 私有管道真实owner/DACL/两端PID与创建身份后双向读写", async () => {
  const server = createWin32PersonalPipe(); const accepted = server.accept();
  const client = await openWin32PersonalPipe(server.name);
  try {
    await accepted;
    const s = server.assertCurrent(), c = client.assertCurrent();
    expect(s.peer.pid).toBe(process.pid); expect(c.peer).toEqual(s.local); expect(c.local).toEqual(s.peer); expect(c.owner).toBe(s.owner);
    const read = server.readExact(5); await client.write(Buffer.from("hello"), commit => commit()); expect(await read).toEqual(Buffer.from("hello"));
    const response = client.readExact(2); await server.write(Buffer.from("ok"), commit => commit()); expect(await response).toEqual(Buffer.from("ok"));
  } finally { await client.close(); await server.close(); }
}, 15000);

windows("UPGRADE.T08.095 停止真实pending accept必须等待CancelIoEx完成且旧管道不可再开", async () => {
  const server = createWin32PersonalPipe(); const accepted = server.accept().then(() => "accepted", () => "rejected");
  await server.close(); expect(await accepted).toBe("rejected"); await server.close();
  await expect(openWin32PersonalPipe(server.name)).rejects.toThrow("open failed");
}, 15000);

windows("UPGRADE.T08.096 停止真实pending read取消缓冲区并使新写入拒绝", async () => {
  const server = createWin32PersonalPipe(); const accepted = server.accept(); const client = await openWin32PersonalPipe(server.name); await accepted;
  const read = server.readExact(10).then(() => "read", () => "rejected");
  await server.close(); expect(await read).toBe("rejected");
  await expect(server.write(Buffer.from("denied"), commit => commit())).rejects.toThrow(); await client.close();
}, 15000);

windows("UPGRADE.T08.097 最终writer不准入零写入且保存closure不可晚调用", async () => {
  const server = createWin32PersonalPipe(); const accepted = server.accept(); const client = await openWin32PersonalPipe(server.name); await accepted;
  let saved: (() => void) | undefined;
  try {
    await expect(client.write(Buffer.from("denied"), commit => { saved = commit; })).rejects.toThrow("not called");
    expect(saved).toBeTypeOf("function"); expect(() => saved!()).toThrow("stale");
    await expect(server.readExact(1)).rejects.toThrow();
  } finally { await client.close(); await server.close(); }
}, 15000);

windows("UPGRADE.T08.098 非产品/远程pipe名字不会进入CreateFile", async () => {
  for (const name of ["\\\\remote\\pipe\\saydo-personal-context-00000000-0000-0000-0000-000000000000", "\\\\.\\pipe\\unrelated", "C:/personal-context"]) await expect(openWin32PersonalPipe(name)).rejects.toThrow("name rejected");
});

windows("UPGRADE.T08.100 独立真实Node子进程双向核对PID和创建身份再往返", async () => {
  const server = createWin32PersonalPipe(); const accepted = server.accept();
  const child = spawn(process.execPath, ["--import", new URL("../../daemon/node_modules/tsx/dist/loader.mjs", import.meta.url).href,
    fileURLToPath(new URL("./personal-pipe-child.ts", import.meta.url)), server.name], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const exited = once(child, "exit"); let output = "", diagnostic = "";
  child.stdout.on("data", chunk => { output = (output + String(chunk)).slice(-4096); });
  child.stderr.on("data", chunk => { diagnostic = (diagnostic + String(chunk)).slice(-4096); });
  try {
    await accepted; const identity = server.assertCurrent();
    expect(identity.peer.pid).toBe(child.pid); expect(identity.peer.pid).not.toBe(process.pid);
    await server.write(Buffer.from("ping"), commit => commit());
    expect(await server.readExact(4)).toEqual(Buffer.from("pong"));
    await server.write(Buffer.from("!"), commit => commit());
    const [code] = await exited; expect(code, diagnostic).toBe(0);
    expect(JSON.parse(output)).toEqual({ pid: child.pid, peerPid: process.pid, birth: identity.peer.birth });
    expect(() => server.assertCurrent()).toThrow();
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill(); await exited; }
    await server.close();
  }
}, 15000);

windows("UPGRADE.T08.101 同用户同前缀但不能证明私有ACL的真实Node管道在正文前拒绝", async () => {
  const name = `\\\\.\\pipe\\saydo-personal-context-${randomUUID()}`;
  const sockets = new Set<Socket>(); let received = 0;
  const server = createServer(socket => { sockets.add(socket); socket.on("data", chunk => { received += chunk.length; }); socket.on("error", () => undefined); });
  const listening = once(server, "listening"); server.listen(name); await listening;
  try { await expect(openWin32PersonalPipe(name)).rejects.toThrow(/ACL (rejected|readback failed)/u); expect(received).toBe(0); }
  finally { for (const socket of sockets) socket.destroy(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}, 15000);

windows("UPGRADE.T08.102 明确Everyone读权限的原生管道即使同用户也拒绝", async () => {
  const koffi = createRequire(import.meta.url)("koffi"), kernel = koffi.load("kernel32.dll"), advapi = koffi.load("advapi32.dll");
  const descriptor = advapi.func("int32 __stdcall ConvertStringSecurityDescriptorToSecurityDescriptorW(str16, uint32, _Out_ void **, _Out_ uint32 *)");
  const create = kernel.func("void * __stdcall CreateNamedPipeW(str16, uint32, uint32, uint32, uint32, uint32, uint32, void *)");
  const close = kernel.func("int32 __stdcall CloseHandle(void *)"), free = kernel.func("void * __stdcall LocalFree(void *)");
  const sid = createWin32PersonalPipe(); const name = `\\\\.\\pipe\\saydo-personal-context-${randomUUID()}`;
  // 使用当前用户SID构造明确宽ACL；临时安全管道只为取得同一实际SID。
  const { currentUserSid } = await import("../src/win32.js"); const owner = currentUserSid(); await sid.close();
  const sd = [null], length = [0]; expect(descriptor(`O:${owner}D:P(A;;0x0012019b;;;${owner})(A;;0x00120089;;;WD)`, 1, sd, length)).toBe(1);
  const sa = Buffer.alloc(24); sa.writeUInt32LE(24, 0); sa.writeBigUInt64LE(BigInt(koffi.address(sd[0])), 8);
  let handle: unknown;
  try { handle = create(name, 3 | 0x40000000 | 0x00080000, 8, 1, 65536, 65536, 0, sa); }
  finally { free(sd[0]); }
  expect(BigInt.asIntN(64, BigInt(koffi.address(handle)))).not.toBe(-1n);
  try { await expect(openWin32PersonalPipe(name)).rejects.toThrow("ACL rejected"); }
  finally { expect(close(handle)).toBe(1); }
}, 15000);
