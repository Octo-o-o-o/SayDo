import { execFileSync } from "node:child_process";
import { request } from "node:http";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reservePort, startDaemonProcess, type DaemonProcess } from "./helpers/daemonProcess.js";

function daemonSpawnEnv(extra: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  try {
    execFileSync("/bin/ps", ["-o", "lstart=", "-p", String(process.pid)], { encoding: "utf8", timeout: 2000 });
    return extra;
  } catch {
    const preload = join(tmpdir(), `saydo-ps-preload-${process.pid}.cjs`);
    writeFileSync(
      preload,
      `"use strict";
const cp = require("node:child_process");
const orig = cp.execFileSync;
cp.execFileSync = function (file, args, options) {
  const f = String(file);
  if (f === "ps" || f.endsWith("/ps")) {
    const out = "Thu Jan  1 00:00:00 2026\\n";
    if (options && options.encoding && options.encoding !== "buffer") return out;
    return Buffer.from(out);
  }
  return orig.apply(this, arguments);
};
`
    );
    const prev = process.env["NODE_OPTIONS"] ?? "";
    const flag = `--require ${preload}`;
    return { ...extra, NODE_OPTIONS: prev ? `${prev} ${flag}` : flag };
  }
}

function mobileRequest(
  daemon: DaemonProcess,
  path: string,
  method = "GET",
  headerOverrides: Record<string, string | undefined> = {}
): Promise<{ status: number; body: string }> {
  const lanAddress = privateLanAddress();
  const lanHost = `${lanAddress}:${daemon.port}`;
  const headers: Record<string, string> = {
    host: lanHost,
    origin: `http://${lanHost}`,
    "x-saydo-token": daemon.token,
    ...(method === "POST" ? { "content-type": "application/json" } : {})
  };
  for (const [name, value] of Object.entries(headerOverrides)) {
    if (value === undefined) delete headers[name];
    else headers[name] = value;
  }
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: lanAddress,
        port: daemon.port,
        path,
        method,
        headers
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on("error", reject);
    if (method === "POST") req.write("{}");
    req.end();
  });
}

function privateLanAddress(): string {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const parts = entry.address.split(".").map(Number);
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && (parts[1] as number) >= 16 && (parts[1] as number) <= 31) ||
        (parts[0] === 192 && parts[1] === 168)
      ) {
        return entry.address;
      }
    }
  }
  throw new Error("M1 process test requires an RFC 1918 interface");
}

describe("SAYDO_MOBILE_LAN 真实进程访问链", () => {
  it("默认关时远程连接拒绝;显式开时业务 /api 一律 403,health/readyz 可探", async () => {
    const closed = await startDaemonProcess({
      home: realpathSync(mkdtempSync(join(tmpdir(), "saydo-mobile-closed-"))),
      port: await reservePort(),
      env: daemonSpawnEnv()
    });
    try {
      await expect(mobileRequest(closed, "/api/focuses")).rejects.toMatchObject({ code: "ECONNREFUSED" });
      expect(closed.output()).toContain('listen="127.0.0.1"');
      expect(closed.output()).toContain("mobileLan=false");
    } finally {
      await closed.stop();
    }

    const opened = await startDaemonProcess({
      home: realpathSync(mkdtempSync(join(tmpdir(), "saydo-mobile-open-"))),
      port: await reservePort(),
      env: daemonSpawnEnv({ SAYDO_MOBILE_LAN: "1" })
    });
    try {
      const health = await mobileRequest(opened, "/health");
      expect(health.status, health.body).toBe(200);
      expect(JSON.parse(health.body)).toMatchObject({ ok: true, service: "saydo-daemon" });
      const readyz = await mobileRequest(opened, "/readyz");
      expect(readyz.status).toBeGreaterThanOrEqual(200);
      const allowed = await mobileRequest(opened, "/api/focuses");
      expect(allowed.status, allowed.body).toBe(403);
      expect(allowed.body).toContain("remote_business_forbidden");
      const browserGet = await mobileRequest(opened, "/api/focuses", "GET", {
        origin: undefined,
        referer: `http://${privateLanAddress()}:${opened.port}/#/m`
      });
      expect(browserGet.status, browserGet.body).toBe(403);
      expect(browserGet.body).toContain("remote_business_forbidden");
      const missingOrigin = await mobileRequest(opened, "/api/focuses", "GET", { origin: undefined });
      expect(missingOrigin.status).toBe(403);
      expect(missingOrigin.body).toContain("origin_rejected");
      const crossReferer = await mobileRequest(opened, "/api/focuses", "GET", {
        origin: undefined,
        referer: "http://evil.example/#/m"
      });
      expect(crossReferer.status).toBe(403);
      expect(crossReferer.body).toContain("origin_rejected");
      const crossSite = await mobileRequest(opened, "/api/focuses", "GET", {
        origin: undefined,
        referer: `http://${privateLanAddress()}:${opened.port}/#/m`,
        "sec-fetch-site": "cross-site"
      });
      expect(crossSite.status).toBe(403);
      expect(crossSite.body).toContain("origin_rejected");
      const wrongToken = await mobileRequest(opened, "/api/focuses", "GET", { "x-saydo-token": "wrong" });
      expect(wrongToken.status).toBe(403);
      expect(wrongToken.body).toContain("token_mismatch");
      const spoofedLocal = await mobileRequest(opened, "/api/spaces", "GET", {
        host: `localhost:${opened.port}`,
        origin: `http://localhost:${opened.port}`
      });
      expect(spoofedLocal.status).toBe(403);
      expect(spoofedLocal.body).toContain("host_rejected");
      const setupWrite = await mobileRequest(opened, "/api/setup/config", "POST");
      expect(setupWrite.status).toBe(403);
      expect(setupWrite.body).toContain("remote_business_forbidden");
      const recentTranscript = await mobileRequest(opened, "/api/sessions/recent-transcript?limit=40");
      expect(recentTranscript.status, recentTranscript.body).toBe(403);
      expect(recentTranscript.body).toContain("remote_business_forbidden");
      const memory = await mobileRequest(
        opened,
        "/api/projects/prj_01F1XT0RE0A000000000000000/memory"
      );
      expect(memory.status, memory.body).toBe(403);
      expect(memory.body).toContain("remote_business_forbidden");
      const recentMemory = await mobileRequest(opened, "/api/memory/recent?limit=30");
      expect(recentMemory.status, recentMemory.body).toBe(403);
      expect(recentMemory.body).toContain("remote_business_forbidden");
      const pairing = await mobileRequest(opened, "/api/pairing-info");
      expect(pairing.status).toBe(403);
      expect(pairing.body).toContain("remote_business_forbidden");
      const artVer = await mobileRequest(
        opened,
        "/api/artifacts/art_01AAAAAAAAAAAAAAAAAAAAAAAA/versions/1?project=prj_01F1XT0RE0A000000000000000"
      );
      expect(artVer.status).toBe(403);
      expect(artVer.body).toContain("remote_business_forbidden");
      expect(opened.output()).toContain('listen="0.0.0.0"');
      expect(opened.output()).toContain("mobileLan=true");
    } finally {
      await opened.stop();
    }
  }, 30_000);
});
