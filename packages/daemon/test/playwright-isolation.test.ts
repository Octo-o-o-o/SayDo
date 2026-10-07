// 真 listener/子进程验证测试装配隔离；健康服务模拟不构成产品或 native 验收。
import { createHash, createHmac } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runtimeOwnershipPayload } from "@saydo/contracts";
import { assertPlaywrightPortsAvailable, createPlaywrightState, stopOwnedPlaywrightChild, waitForOwnedPlaywrightDaemon } from "./helpers/playwright-isolation.js";

const roots = new Set<string>();
const children = new Set<ChildProcess>();
const servers = new Set<Server>();
afterEach(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
  servers.clear();
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close");
      child.kill("SIGKILL");
      await closed;
    }
  }
  children.clear();
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
});

function parent(): string {
  const root = mkdtempSync(join(tmpdir(), "saydo-pw-isolation-"));
  roots.add(root);
  return root;
}
function liveChild(): ChildProcess {
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
  children.add(child);
  return child;
}
async function listener(body?: (port: number, url: string) => unknown): Promise<number> {
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body?.((server.address() as AddressInfo).port, req.url ?? "/") ?? { ok: true }));
  });
  servers.add(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return (server.address() as AddressInfo).port;
}

describe("Playwright run 所有权", () => {
  it.skipIf(process.platform === "win32")("真实进程组leader先退出，忽略TERM后代被限时KILL且邻居仍存活", async () => {
    const base = parent();
    const ready = join(base, "descendant-ready");
    const term = join(base, "descendant-term");
    const neighbor = liveChild();
    const grandchildCode = `const fs = require('node:fs');
      process.on('SIGTERM', () => fs.writeFileSync(${JSON.stringify(term)}, 'ignored'));
      fs.writeFileSync(${JSON.stringify(ready)}, String(process.pid)); setInterval(() => {}, 1000);`;
    const leaderCode = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchildCode)}], {stdio:'ignore'}); setInterval(() => {}, 1000);`;
    const leader = spawn(process.execPath, ["-e", leaderCode], { detached: true, stdio: "ignore" });
    const deadline = Date.now() + 3000;
    try {
      while (!existsSync(ready) && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
      expect(existsSync(ready)).toBe(true);
      const start = Date.now();
      const stopped = stopOwnedPlaywrightChild(leader);
      await once(leader, "exit");
      // leader已退出的现场，组仍可探测；这不是内存模拟。
      expect(() => process.kill(-leader.pid!, 0)).not.toThrow();
      await stopped;
      expect(existsSync(term)).toBe(true);
      expect(Date.now() - start).toBeGreaterThanOrEqual(4900);
      expect(Date.now() - start).toBeLessThan(11000);
      expect(() => process.kill(-leader.pid!, 0)).toThrow();
      expect(() => process.kill(neighbor.pid!, 0)).not.toThrow();
      expect(neighbor.exitCode).toBeNull();
    } finally {
      // 仅清理本测试新spawn的组；不用文件中写入的后代PID作终止依据。
      try { process.kill(-leader.pid!, "SIGKILL"); } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err;
      }
    }
  }, 15000);

  it("同一parent两次装配得到唯一状态，清一轮不影响另一轮与历史marker", () => {
    const base = parent();
    const marker = join(base, "historical-marker");
    writeFileSync(marker, "旧状态");
    const a = createPlaywrightState(base);
    const b = createPlaywrightState(base);
    writeFileSync(join(b.home, "live-marker"), "正在运行");
    expect(a.root).not.toBe(b.root);
    rmSync(a.root, { recursive: true });
    expect(readFileSync(marker, "utf8")).toBe("旧状态");
    expect(readFileSync(join(b.home, "live-marker"), "utf8")).toBe("正在运行");
    expect(existsSync(b.firstRunHome)).toBe(true);
  });

  it("既有真实HTTP200 listener使端口预检拒绝，服务仍可访问", async () => {
    const port = await listener();
    await expect(assertPlaywrightPortsAvailable([port])).rejects.toThrow(/unavailable/);
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
  });

  it("只有HTTP200且不属于本轮token的服务不能ready", async () => {
    const { home } = createPlaywrightState(parent());
    writeFileSync(join(home, ".cap-token"), "owned-token");
    const child = liveChild();
    const port = await listener();
    await expect(waitForOwnedPlaywrightDaemon({
      url: `http://127.0.0.1:${port}/health`, home, port, children: [child], what: "foreign", timeoutMs: 100
    })).rejects.toThrow(/owned-ready/);
  });

  it("正确本轮HMAC可ready，但子进程退出后同一个HTTP200也必须拒绝", async () => {
    const { home } = createPlaywrightState(parent());
    const token = "owned-token";
    writeFileSync(join(home, ".cap-token"), token);
    const child = liveChild();
    const identity = { sourceRevision: "12345678", buildId: "test-only", protocolVersion: "1.0.0" };
    const stateRootDigest = createHash("sha256").update(home).digest("hex");
    const startedAt = new Date().toISOString();
    const port = await listener((port, url) => {
      const nonce = new URL(url, "http://localhost").searchParams.get("ownershipNonce") ?? "";
      return {
        ok: true, service: "saydo-daemon", pid: child.pid, startedAt, stateRootDigest, identity,
        ownershipProof: { version: 1, nonce, mac: createHmac("sha256", token).update(runtimeOwnershipPayload({
          nonce, pid: child.pid!, port, startedAt, stateRootDigest, identity
        })).digest("hex") }
      };
    });
    const input = { url: `http://127.0.0.1:${port}/health`, home, port, children: [child], what: "owned", timeoutMs: 1000 };
    expect(await waitForOwnedPlaywrightDaemon(input)).toBe(token);
    const closed = once(child, "close");
    child.kill("SIGKILL");
    await closed;
    await expect(waitForOwnedPlaywrightDaemon(input)).rejects.toThrow(/child exited before ready/);
  });
});
