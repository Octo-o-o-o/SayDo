import { createServer, type RequestListener, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { homeDigest, probeDaemon } from "../src/probe.js";
import { runtimeOwnershipPayload } from "@saydo/contracts";

const identity = {
  sourceRevision: "a".repeat(40),
  buildId: "probe-test",
  protocolVersion: "1.0.0"
};
const summary = {
  version: 1,
  activeWork: { total: 0, recoverableTier1: 0, unrecoverableCalls: 0 },
  dnd: { enabled: false, active: false, window: null },
  attention: { orange: 0, blue: 0, green: 0, gray: 0 }
};
const servers: Server[] = [];
const startedAt = "2026-08-12T00:00:00.000Z";

function healthBody(url: string | undefined, home: string, token: string, pid: number, port: number): Record<string, unknown> {
  const nonce = new URL(url ?? "/health", "http://localhost").searchParams.get("ownershipNonce") ?? "";
  const stateRootDigest = homeDigest(home);
  return {
    service: "saydo-daemon",
    pid,
    startedAt,
    identity,
    stateRootDigest,
    ownershipProof: {
      version: 1,
      nonce,
      mac: createHmac("sha256", token)
        .update(runtimeOwnershipPayload({ nonce, pid, port, startedAt, stateRootDigest, identity }))
        .digest("hex")
    }
  };
}

async function listen(handler: RequestListener): Promise<{ server: Server; port: number }> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return { server, port: (server.address() as { port: number }).port };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolveClose) => server.close(() => resolveClose()))));
});

describe("47100 ownership probe", () => {
  it("同 home、兼容协议、受保护探针通过才 attach", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-probe-home-"));
    writeFileSync(join(home, ".cap-token"), "test-token\n");
    const { port } = await listen((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url?.startsWith("/health")) {
        res.end(JSON.stringify(healthBody(req.url, home, "test-token", 123, port)));
        return;
      }
      if (req.url === "/api/desktop/summary" && req.headers["x-saydo-token"] === "test-token") {
        res.end(JSON.stringify(summary));
        return;
      }
      res.statusCode = 403;
      res.end(JSON.stringify({ ok: false }));
    });
    await expect(probeDaemon(home, port, "1.9.0")).resolves.toMatchObject({ kind: "attached", pid: 123 });
  });

  it("不同 home 明确冲突", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-probe-home-"));
    const { port } = await listen((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ service: "saydo-daemon", pid: 456, identity, stateRootDigest: "b".repeat(64) }));
    });
    await expect(probeDaemon(home, port, "1.0.0")).resolves.toEqual({
      kind: "conflict",
      reason: "home_mismatch",
      pid: 456
    });
  });

  it("未知监听服务明确冲突而非误判端口空闲", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-probe-home-"));
    const { port } = await listen((_req, res) => {
      res.statusCode = 200;
      res.end("not-json");
    });
    await expect(probeDaemon(home, port, "1.0.0")).resolves.toEqual({
      kind: "conflict",
      reason: "unknown_service"
    });
  });

  it("SayDo 响应缺合法 pid 时也不建立 ownership", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-probe-home-"));
    writeFileSync(join(home, ".cap-token"), "test-token\n");
    const { port } = await listen((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url?.startsWith("/health")) {
        res.end(JSON.stringify({ service: "saydo-daemon", identity, stateRootDigest: homeDigest(home) }));
        return;
      }
      res.end(JSON.stringify(summary));
    });
    await expect(probeDaemon(home, port, "1.0.0")).resolves.toEqual({
      kind: "conflict",
      reason: "ownership_unverified"
    });
  });

  it("伪服务不能先拿到 HOME bearer token 再冒充 attach", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-probe-home-"));
    writeFileSync(join(home, ".cap-token"), "secret-token\n");
    let leaked = false;
    const { port } = await listen((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url?.startsWith("/health")) {
        // 模拟把 challenge relay 到同 HOME 的另一端口；proof 绑定端口后必须失败。
        res.end(JSON.stringify(healthBody(req.url, home, "secret-token", 789, port + 1)));
        return;
      }
      leaked = leaked || req.headers["x-saydo-token"] === "secret-token";
      res.end(JSON.stringify(summary));
    });
    await expect(probeDaemon(home, port, "1.0.0")).resolves.toEqual({
      kind: "conflict",
      reason: "ownership_unverified",
      pid: 789
    });
    expect(leaked).toBe(false);
  });
});
