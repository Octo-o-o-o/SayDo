import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  closeGateServer,
  GATE_BIND_FAILED,
  setGateServerTestHooks,
  startGateServer
} from "../../src/tier1/gateServer.js";

const home = process.env["SAYDO_HOME"];
if (!home) process.exit(2);
const mode = process.env["SAYDO_GATE_MODE"] ?? "normal";
const sockPath = process.env["SAYDO_GATE_SOCK"] ?? join(home, "gate.sock");
mkdirSync(home, { recursive: true, mode: 0o700 });

const rejections: unknown[] = [];
process.on("unhandledRejection", (reason) => {
  rejections.push(reason);
});

function exitBounded(code: number): void {
  if (rejections.length > 0) process.exit(9);
  process.exit(code);
}

if (mode === "eaddrinuse") {
  const first = await startGateServer(sockPath, async () => ({ permission: "deny" }));
  setGateServerTestHooks({ preserveSockFile: true });
  try {
    await startGateServer(sockPath, async () => ({ permission: "deny" }));
    await closeGateServer(first);
    exitBounded(4);
  } catch (err) {
    const message = err instanceof Error ? err.message : GATE_BIND_FAILED;
    process.stdout.write(message);
    await closeGateServer(first);
    exitBounded(message === "EADDRINUSE" || message === GATE_BIND_FAILED ? 1 : 5);
  }
}

if (mode === "eacces") {
  const forced = new Error("SECRET");
  Object.defineProperty(forced, "code", { value: "EACCES" });
  setGateServerTestHooks({ forceListenError: forced as NodeJS.ErrnoException });
  try {
    await startGateServer(sockPath, async () => ({ permission: "deny" }));
    exitBounded(4);
  } catch (err) {
    const message = err instanceof Error ? err.message : GATE_BIND_FAILED;
    process.stdout.write(message);
    exitBounded(message === "EACCES" && !message.includes("SECRET") ? 1 : 5);
  }
}

if (mode === "bind-close") {
  setGateServerTestHooks({ listenDelayMs: 80 });
  const ac = new AbortController();
  const started = startGateServer(sockPath, async () => ({ permission: "deny" }), { signal: ac.signal });
  setTimeout(() => ac.abort(), 10);
  try {
    await started;
    exitBounded(4);
  } catch {
    if (existsSync(sockPath)) {
      try { unlinkSync(sockPath); } catch { /* 竞态清理 */ }
    }
    const second = await startGateServer(sockPath, async () => ({ permission: "deny" }));
    await closeGateServer(second);
    exitBounded(0);
  }
}

if (mode === "delay-recover") {
  setGateServerTestHooks({ listenDelayMs: 60 });
  const server = await startGateServer(sockPath, async () => ({ permission: "deny" }));
  try {
    throw new Error("SECRET");
  } catch {
    await closeGateServer(server);
    if (existsSync(sockPath)) {
      try { unlinkSync(sockPath); } catch { /* 已关 */ }
    }
    const rebound = await startGateServer(sockPath, async () => ({ permission: "deny" }));
    await closeGateServer(rebound);
    exitBounded(1);
  }
}

const server = await startGateServer(sockPath, async () => ({ permission: "allow" }));
await closeGateServer(server);
if (existsSync(sockPath)) {
  try { unlinkSync(sockPath); } catch { /* 已关 */ }
}
const rebound = await startGateServer(sockPath, async () => ({ permission: "allow" }));
await closeGateServer(rebound);
exitBounded(0);
