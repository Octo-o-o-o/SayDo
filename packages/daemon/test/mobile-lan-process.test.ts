import { request } from "node:http";
import { mkdtempSync, realpathSync } from "node:fs";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reservePort, startDaemonProcess, type DaemonProcess } from "./helpers/daemonProcess.js";

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
  it("默认关时远程连接拒绝;显式开时只读路由放行、setup 写口仍拒绝", async () => {
    const closed = await startDaemonProcess({
      home: realpathSync(mkdtempSync(join(tmpdir(), "saydo-mobile-closed-"))),
      port: await reservePort()
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
      env: { SAYDO_MOBILE_LAN: "1" }
    });
    try {
      const allowed = await mobileRequest(opened, "/api/focuses");
      expect(allowed.status, allowed.body).toBe(200);
      expect(JSON.parse(allowed.body)).toEqual([]);
      const browserGet = await mobileRequest(opened, "/api/focuses", "GET", {
        origin: undefined,
        referer: `http://${privateLanAddress()}:${opened.port}/#/m`
      });
      expect(browserGet.status, browserGet.body).toBe(200);
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
      expect(setupWrite.body).toContain("mobile_lan_route_rejected");
      // voice-fix-backend:历史回放 + 记忆只读 两条放行
      const recentTranscript = await mobileRequest(opened, "/api/sessions/recent-transcript?limit=40");
      expect(recentTranscript.status, recentTranscript.body).toBe(200);
      expect(JSON.parse(recentTranscript.body)).toMatchObject({
        sessionId: null,
        projectId: null,
        turns: []
      });
      const memory = await mobileRequest(
        opened,
        "/api/projects/prj_01F1XT0RE0A000000000000000/memory"
      );
      expect(memory.status, memory.body).toBe(200);
      expect(JSON.parse(memory.body)).toEqual([]);
      const recentMemory = await mobileRequest(opened, "/api/memory/recent?limit=30");
      expect(recentMemory.status, recentMemory.body).toBe(200);
      expect(Array.isArray(JSON.parse(recentMemory.body))).toBe(true);
      const pairing = await mobileRequest(opened, "/api/pairing-info");
      expect(pairing.status).toBe(403);
      expect(pairing.body).toContain("mobile_lan_route_rejected");
      const artVer = await mobileRequest(
        opened,
        "/api/artifacts/art_01AAAAAAAAAAAAAAAAAAAAAAAA/versions/1?project=prj_01F1XT0RE0A000000000000000"
      );
      expect(artVer.status).toBe(403);
      expect(artVer.body).toContain("mobile_lan_route_rejected");
      expect(opened.output()).toContain('listen="0.0.0.0"');
      expect(opened.output()).toContain("mobileLan=true");
    } finally {
      await opened.stop();
    }
  }, 30_000);
});
