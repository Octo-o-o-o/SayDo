// Windows 审批门:环回临时端口 + HMAC + gate-cursor.mjs(fail-closed 四律)。
// POSIX 同样可跑(listenGateHttp 不绑 unix socket),作为运输层回归。

import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import {
  GATE_HMAC_HEADER,
  hmacHex,
  listenGateHttp,
  newGateSecret,
  writeGateBindAndSecret
} from "@saydo/platform";
import { buildCursorGateMjs, writeGateScriptAtomic } from "../src/tier1/gateScript.js";
import { parseGateWireRequest, type GateWireRequest } from "../src/tier1/gateServer.js";

function runMjs(scriptPath: string, hookInput: object): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [scriptPath], { timeout: 15_000 }, (err, stdout) => {
      resolve({ stdout: (stdout ?? "").trim(), code: (err as { code?: number } | null)?.code ?? 0 });
    });
    child.stdin?.write(JSON.stringify(hookInput));
    child.stdin?.end();
  });
}

let server: Server | null = null;
afterEach(() => {
  server?.close();
  server = null;
});

describe("gate-cursor.mjs 环回+HMAC(fail-closed 四律)", () => {
  it("daemon allow ⇒ 钩子输出 allow;每次请求独立到达", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-lb-"));
    const seen: GateWireRequest[] = [];
    const listened = await listenGateHttp(home, async (json) => {
      seen.push(parseGateWireRequest(json));
      return { permission: "allow" as const };
    });
    server = listened.server;
    const script = join(home, "tier1", "gate-cursor.mjs");
    writeGateScriptAtomic(
      script,
      buildCursorGateMjs(join(home, "tier1", "gate-bind.json"), join(home, "tier1", "gate-secret"), join(home, "tier1", "gate-fired.log"))
    );
    const r1 = await runMjs(script, { command: "ls -la", cwd: home });
    expect(JSON.parse(r1.stdout)).toEqual({ permission: "allow" });
    const r2 = await runMjs(script, { command: "git status", cwd: home });
    expect(JSON.parse(r2.stdout)).toEqual({ permission: "allow" });
    expect(seen).toEqual([
      { command: "ls -la", cwd: home },
      { command: "git status", cwd: home }
    ]);
  });

  it("daemon deny ⇒ 钩子输出 deny + agent_message 透传", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-lb-"));
    const listened = await listenGateHttp(home, async () => ({
      permission: "deny" as const,
      agent_message: "SayDo gate denied (S3): no voice grant"
    }));
    server = listened.server;
    const script = join(home, "tier1", "gate-cursor.mjs");
    writeGateScriptAtomic(
      script,
      buildCursorGateMjs(join(home, "tier1", "gate-bind.json"), join(home, "tier1", "gate-secret"), join(home, "tier1", "gate-fired.log"))
    );
    const r = await runMjs(script, { command: "git push origin main", cwd: home });
    const out = JSON.parse(r.stdout) as { permission: string; agent_message: string };
    expect(out.permission).toBe("deny");
    expect(out.agent_message).toContain("S3");
  });

  it("daemon 不可达 ⇒ deny(fail-closed 律③)", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-lb-"));
    mkdirSync(join(home, "tier1"), { recursive: true });
    writeGateBindAndSecret(home, { host: "127.0.0.1", port: 1 }, newGateSecret());
    const script = join(home, "tier1", "gate-cursor.mjs");
    writeGateScriptAtomic(
      script,
      buildCursorGateMjs(join(home, "tier1", "gate-bind.json"), join(home, "tier1", "gate-secret"), join(home, "tier1", "gate-fired.log"))
    );
    const r = await runMjs(script, { command: "ls", cwd: home });
    expect((JSON.parse(r.stdout) as { permission: string }).permission).toBe("deny");
  });

  it("畸形 hook 输入不 POST 即 deny", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-lb-"));
    const seen: unknown[] = [];
    const listened = await listenGateHttp(home, async (json) => {
      seen.push(json);
      return { permission: "allow" as const };
    });
    server = listened.server;
    const script = join(home, "tier1", "gate-cursor.mjs");
    writeGateScriptAtomic(
      script,
      buildCursorGateMjs(join(home, "tier1", "gate-bind.json"), join(home, "tier1", "gate-secret"), join(home, "tier1", "gate-fired.log"))
    );
    const r = await runMjs(script, { cwd: home });
    expect((JSON.parse(r.stdout) as { permission: string }).permission).toBe("deny");
    expect(seen).toEqual([]);
  });

  it("HMAC 失败 ⇒ deny,handler 不执行", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-lb-"));
    let called = false;
    const listened = await listenGateHttp(home, async () => {
      called = true;
      return { permission: "allow" as const };
    });
    server = listened.server;
    const body = Buffer.from(JSON.stringify({ cwd: home, command: "ls" }), "utf8");
    const { request } = await import("node:http");
    const status = await new Promise<number>((resolve) => {
      const req = request(
        {
          host: "127.0.0.1",
          port: listened.bind.port,
          path: "/gate",
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": String(body.length),
            [GATE_HMAC_HEADER]: hmacHex(newGateSecret(), body)
          }
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode ?? 0));
        }
      );
      req.write(body);
      req.end();
    });
    expect(status).toBe(200);
    expect(called).toBe(false);
  });

  it("未知 kind deny 且不到达 handler", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-lb-"));
    const seen: unknown[] = [];
    const listened = await listenGateHttp(home, async (json) => {
      seen.push(json);
      return { permission: "allow" as const };
    });
    server = listened.server;
    const script = join(home, "tier1", "gate-cursor.mjs");
    writeGateScriptAtomic(
      script,
      buildCursorGateMjs(join(home, "tier1", "gate-bind.json"), join(home, "tier1", "gate-secret"), join(home, "tier1", "gate-fired.log"))
    );
    const r = await runMjs(script, { kind: "file_write", command: "ls", cwd: home });
    expect((JSON.parse(r.stdout) as { permission: string }).permission).toBe("deny");
    expect(seen).toEqual([]);
  });
});
