import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startRecoveryOnlyServer } from "../src/api/recoveryOnlyServer.js";
import { openDb } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { loadOrCreateCapToken } from "../src/net/capToken.js";

const homes: string[] = [];
afterEach(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
  homes.length = 0;
});

describe("recovery-only JSON body fail-closed", () => {
  it("invalid JSON 写一次 400 且不得进入 setup 业务路由", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-ro-json-"));
    homes.push(home);
    writeFileSync(join(home, "config.toml"), "[models]\n", { mode: 0o600 });
    mkdirSync(join(home, "logs"), { recursive: true });
    const db = openDb(join(home, "saydo.db"));
    const token = loadOrCreateCapToken(home);
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("listen failed");
    const port = addr.port;
    const log = { info() {}, warn() {}, error() {}, child() { return log; } };
    startRecoveryOnlyServer({
      saydoHome: home,
      daemonDir: join(import.meta.dirname, ".."),
      port,
      startedAt: new Date().toISOString(),
      identity: {
        runtimeSha: "sha",
        sourceRevision: "rev",
        builtAt: "t"
      } as never,
      stateRootDigest: "d".repeat(64),
      db,
      audit: createSqliteAuditSink(db),
      log: log as never,
      supervised: false,
      violations: [{ code: "active_config_unreadable", message: "bad", slot: "dialog" }],
      preboundServer: server
    });
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/setup/restart?token=${token}`, {
        method: "POST",
        headers: { "content-type": "application/json", host: `127.0.0.1:${port}` },
        body: "{not json"
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { code?: string };
      expect(body.code).toBe("invalid_json");
      const again = await fetch(`http://127.0.0.1:${port}/api/setup/restart?token=${token}`, {
        method: "POST",
        headers: { "content-type": "application/json", host: `127.0.0.1:${port}` },
        body: "{still not json"
      });
      expect(again.status).toBe(400);
      const probe = await fetch(`http://127.0.0.1:${port}/api/setup/probe?token=${token}`, {
        headers: { host: `127.0.0.1:${port}` }
      });
      expect(probe.status === 200 || probe.status === 403 || probe.status === 503).toBe(true);
    } finally {
      db.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  }, 15_000);
});
