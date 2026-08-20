// 执行器批:审批门物理链路(gate.sh <-> unix socket <-> daemon handler)。
// 真 bash + 真 curl --unix-socket + 真 jq(spike 8 通过版语义):
// deny 缺省 / allow 放行 / daemon 不可达=deny / 畸形响应=deny / 未知路由=deny(fail-closed 全谱)。

import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import {
  buildClaudeGateScript,
  buildGateScript,
  CLAUDE_HOOK_DENY_STATIC,
  ensureGateScript,
  gatePaths
} from "../src/tier1/gateScript.js";
import { startGateServer, type GateWireRequest } from "../src/tier1/gateServer.js";

function runGate(scriptPath: string, hookInput: object): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const child = execFile("bash", [scriptPath], { timeout: 15_000 }, (err, stdout) => {
      resolve({ stdout: stdout.trim(), code: (err as { code?: number } | null)?.code ?? 0 });
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

describe("gate.sh 物理链路(fail-closed 四律)", () => {
  it("daemon allow ⇒ 钩子输出 allow;请求带 command+cwd;每次请求独立到达", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-"));
    const p = ensureGateScript(home);
    const seen: GateWireRequest[] = [];
    server = startGateServer(p.sockPath, (req) => {
      seen.push(req);
      return Promise.resolve({ permission: "allow" as const });
    });
    const r1 = await runGate(p.scriptPath, { command: "ls -la", cwd: "/tmp/wt" });
    expect(JSON.parse(r1.stdout)).toEqual({ permission: "allow" });
    const r2 = await runGate(p.scriptPath, { command: "git status", cwd: "/tmp/wt" });
    expect(JSON.parse(r2.stdout)).toEqual({ permission: "allow" });
    expect(seen).toEqual([
      { command: "ls -la", cwd: "/tmp/wt" },
      { command: "git status", cwd: "/tmp/wt" }
    ]);
  });

  it("daemon deny ⇒ 钩子输出 deny + agent_message 透传", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-"));
    const p = ensureGateScript(home);
    server = startGateServer(p.sockPath, () =>
      Promise.resolve({ permission: "deny" as const, agent_message: "SayDo gate denied (S3): no voice grant" })
    );
    const r = await runGate(p.scriptPath, { command: "git push origin main", cwd: "/tmp/wt" });
    const out = JSON.parse(r.stdout) as { permission: string; agent_message: string };
    expect(out.permission).toBe("deny");
    expect(out.agent_message).toContain("S3");
  });

  it("daemon 不可达(socket 无人监听)⇒ deny(fail-closed 律③)", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-"));
    const p = ensureGateScript(home); // 不起 server
    const r = await runGate(p.scriptPath, { command: "ls", cwd: "/tmp/wt" });
    const out = JSON.parse(r.stdout) as { permission: string };
    expect(out.permission).toBe("deny");
  });

  it("daemon 回畸形 JSON ⇒ deny(律②:jq 解析不出 permission 即 deny)", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-"));
    const p = gatePaths(home);
    // 直接起裸 http server 回垃圾(绕过 startGateServer 的结构化出口)
    const { createServer } = await import("node:http");
    const raw = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("not-json-at-all");
    });
    const { mkdirSync } = await import("node:fs");
    mkdirSync(p.dir, { recursive: true });
    writeFileSync(p.scriptPath, buildGateScript(p.sockPath, p.logPath));
    chmodSync(p.scriptPath, 0o755);
    raw.listen(p.sockPath);
    server = raw;
    const r = await runGate(p.scriptPath, { command: "ls", cwd: "/tmp/wt" });
    expect((JSON.parse(r.stdout) as { permission: string }).permission).toBe("deny");
  });

  it("hook input 无 cwd 字段 ⇒ 回落 $PWD(请求仍可匹配 worktree)", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-"));
    const p = ensureGateScript(home);
    const seen: GateWireRequest[] = [];
    server = startGateServer(p.sockPath, (req) => {
      seen.push(req);
      return Promise.resolve({ permission: "deny" as const });
    });
    await runGate(p.scriptPath, { command: "ls" });
    expect(seen).toHaveLength(1);
    expect((seen[0] as GateWireRequest).cwd.length).toBeGreaterThan(0); // $PWD 兜底非空
  });

  it("W2 阶段0-④(Codex 20 B5)三反例:hook 输入畸形 ⇒ 不 POST 直接 deny(非 JSON / command 缺失 / command 空串)", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-"));
    const p = ensureGateScript(home);
    const seen: GateWireRequest[] = [];
    server = startGateServer(p.sockPath, (req) => {
      seen.push(req);
      return Promise.resolve({ permission: "allow" as const });
    });
    // 反例 1:非 JSON(stdin 直喂垃圾,绕过 runGate 的 JSON.stringify)
    const rawRun = (stdin: string): Promise<{ stdout: string }> =>
      new Promise((resolve) => {
        const child = execFile("bash", [p.scriptPath], { timeout: 15_000 }, (_e, stdout) => resolve({ stdout: stdout.trim() }));
        child.stdin?.write(stdin);
        child.stdin?.end();
      });
    const r1 = await rawRun("this is not json{");
    expect((JSON.parse(r1.stdout) as { permission: string }).permission).toBe("deny");
    // 反例 2:command 缺失
    const r2 = await runGate(p.scriptPath, { cwd: "/tmp/wt" });
    expect((JSON.parse(r2.stdout) as { permission: string }).permission).toBe("deny");
    // 反例 3:command 空串(此前空 command 仍 POST 上行)
    const r3 = await runGate(p.scriptPath, { command: "", cwd: "/tmp/wt" });
    expect((JSON.parse(r3.stdout) as { permission: string }).permission).toBe("deny");
    // 三例均未到达 daemon(畸形立即 deny,不 POST)
    expect(seen).toHaveLength(0);
    // 正例:合法输入照常上行
    const ok = await runGate(p.scriptPath, { command: "ls", cwd: "/tmp/wt" });
    expect((JSON.parse(ok.stdout) as { permission: string }).permission).toBe("allow");
    expect(seen).toHaveLength(1);
  });

  it("gateServer:未知路由/畸形 body 一律 deny(fail-closed)", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-gate-"));
    const p = gatePaths(home);
    const { mkdirSync } = await import("node:fs");
    mkdirSync(p.dir, { recursive: true });
    server = startGateServer(p.sockPath, () => Promise.resolve({ permission: "allow" as const }));
    // 用 curl 直打未知路由与坏 JSON
    const curl = (args: string[]): Promise<string> =>
      new Promise((resolve) => {
        execFile("curl", ["-s", "--unix-socket", p.sockPath, ...args], { timeout: 5000 }, (_e, stdout) => resolve(stdout));
      });
    const bad = await curl(["-X", "POST", "http://saydo/other"]);
    expect((JSON.parse(bad) as { permission: string }).permission).toBe("deny");
    const malformed = await curl(["-X", "POST", "-H", "content-type: application/json", "--data-binary", "{nope", "http://saydo/gate"]);
    expect((JSON.parse(malformed) as { permission: string }).permission).toBe("deny");
  });
});

function hookDecision(stdout: string): string {
  const o = JSON.parse(stdout) as { hookSpecificOutput?: { permissionDecision?: string } };
  return o.hookSpecificOutput?.permissionDecision ?? "";
}

describe("gate-claude.sh 物理链路(W5.4-a B2,既有 7 例不动)", () => {
  function writeClaude(home: string, curlMax = 100): string {
    const p = gatePaths(home);
    const { mkdirSync } = require("node:fs") as typeof import("node:fs");
    mkdirSync(p.dir, { recursive: true });
    const scriptPath = join(p.dir, "gate-claude.sh");
    writeFileSync(scriptPath, buildClaudeGateScript(p.sockPath, p.logPath, { curlMaxTimeSec: curlMax }));
    chmodSync(scriptPath, 0o755);
    return scriptPath;
  }

  function runClaude(scriptPath: string, hookInput: object): Promise<{ stdout: string; code: number }> {
    return new Promise((resolve) => {
      const child = execFile("bash", [scriptPath], { timeout: 15_000 }, (err, stdout) => {
        resolve({ stdout: stdout.trim(), code: (err as { code?: number } | null)?.code ?? 0 });
      });
      child.stdin?.write(JSON.stringify(hookInput));
      child.stdin?.end();
    });
  }

  function rawServer(sock: string, body: object): Server {
    const { createServer } = require("node:http") as typeof import("node:http");
    const s = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
    s.listen(sock);
    return s;
  }

  it("Bash allow", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const p = gatePaths(home);
    server = rawServer(p.sockPath, { permission: "allow" });
    const r = await runClaude(script, { tool_name: "Bash", tool_input: { command: "ls" }, cwd: "/tmp/wt" });
    expect(hookDecision(r.stdout)).toBe("allow");
    expect(r.code).toBe(0);
  });

  it("Bash deny", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const p = gatePaths(home);
    server = rawServer(p.sockPath, { permission: "deny", agent_message: "S3" });
    const r = await runClaude(script, { tool_name: "Bash", tool_input: { command: "rm -rf /" }, cwd: "/tmp/wt" });
    expect(hookDecision(r.stdout)).toBe("deny");
    expect(r.code).toBe(0);
  });

  it("畸形 stdin ⇒ deny+exit 2", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const r = await new Promise<{ stdout: string; code: number }>((resolve) => {
      const child = execFile("bash", [script], { timeout: 5000 }, (err, stdout) => {
        resolve({ stdout: stdout.trim(), code: (err as { code?: number } | null)?.code ?? 0 });
      });
      child.stdin?.write("not-json");
      child.stdin?.end();
    });
    expect(hookDecision(r.stdout)).toBe("deny");
    expect(r.code).toBe(2);
  });

  it("curl 不通 ⇒ deny+exit 2", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const r = await runClaude(script, { tool_name: "Bash", tool_input: { command: "ls" }, cwd: "/tmp/wt" });
    expect(hookDecision(r.stdout)).toBe("deny");
    expect(r.code).toBe(2);
  });

  it("curl 超时(--max-time 1 + 挂起 server) ⇒ deny+exit 2", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home, 1);
    const p = gatePaths(home);
    const { createServer } = await import("node:http");
    const hung = createServer(() => {
      /* never respond */
    });
    hung.listen(p.sockPath);
    server = hung;
    const r = await runClaude(script, { tool_name: "Bash", tool_input: { command: "ls" }, cwd: "/tmp/wt" });
    expect(hookDecision(r.stdout)).toBe("deny");
    expect(r.code).toBe(2);
  });

  it("jq 不在 PATH ⇒ 静态 deny+exit 2", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const r = await new Promise<{ stdout: string; code: number }>((resolve) => {
      const child = execFile("/bin/bash", [script], { timeout: 5000, env: { ...process.env, PATH: "/nonexistent" } }, (err, stdout) => {
        resolve({ stdout: stdout.trim(), code: (err as { code?: number } | null)?.code ?? 0 });
      });
      child.stdin?.write(JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" }, cwd: "/tmp/wt" }));
      child.stdin?.end();
    });
    expect(r.stdout).toBe(CLAUDE_HOOK_DENY_STATIC);
    expect(r.code).toBe(2);
  });

  it("Write 圈内非敏感 ⇒ allow", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const p = gatePaths(home);
    server = rawServer(p.sockPath, { permission: "allow" });
    const r = await runClaude(script, {
      tool_name: "Write",
      tool_input: { file_path: "/tmp/wt/a.ts" },
      cwd: "/tmp/wt"
    });
    expect(hookDecision(r.stdout)).toBe("allow");
    expect(r.code).toBe(0);
  });

  it("Write 圈内敏感:桩回 allow 与 deny 各一", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const p = gatePaths(home);
    server = rawServer(p.sockPath, { permission: "allow" });
    const a = await runClaude(script, {
      tool_name: "Write",
      tool_input: { file_path: "/tmp/wt/.env" },
      cwd: "/tmp/wt"
    });
    expect(hookDecision(a.stdout)).toBe("allow");
    server.close();
    server = rawServer(p.sockPath, { permission: "deny", agent_message: "sensitive" });
    const d = await runClaude(script, {
      tool_name: "Write",
      tool_input: { file_path: "/tmp/wt/.env" },
      cwd: "/tmp/wt"
    });
    expect(hookDecision(d.stdout)).toBe("deny");
  });

  it("Write 圈外 / 判不出 ⇒ deny", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const p = gatePaths(home);
    server = rawServer(p.sockPath, { permission: "deny", agent_message: "outside" });
    const r = await runClaude(script, {
      tool_name: "Write",
      tool_input: { file_path: "/etc/x" },
      cwd: "/tmp/wt"
    });
    expect(hookDecision(r.stdout)).toBe("deny");
  });

  it("Read 圈内空输出 exit 0;圈外 deny;未知 tool deny", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const p = gatePaths(home);
    server = rawServer(p.sockPath, { permission: "no_decision" });
    const inside = await runClaude(script, {
      tool_name: "Read",
      tool_input: { file_path: "/tmp/wt/a.ts" },
      cwd: "/tmp/wt"
    });
    expect(inside.stdout).toBe("");
    expect(inside.code).toBe(0);
    server.close();
    server = rawServer(p.sockPath, { permission: "deny", agent_message: "outside-read" });
    const outside = await runClaude(script, {
      tool_name: "Read",
      tool_input: { file_path: "/etc/hosts" },
      cwd: "/tmp/wt"
    });
    expect(hookDecision(outside.stdout)).toBe("deny");
    const unk = await runClaude(script, { tool_name: "Task", tool_input: {}, cwd: "/tmp/wt" });
    expect(unk.stdout).toBe(CLAUDE_HOOK_DENY_STATIC);
    expect(unk.code).toBe(2);
  });

  it("Write 圈外即使桩 allow 仍 deny", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const p = gatePaths(home);
    server = rawServer(p.sockPath, { permission: "allow" });
    const r = await runClaude(script, {
      tool_name: "Write",
      tool_input: { file_path: "/etc/x" },
      cwd: "/tmp/wt"
    });
    expect(hookDecision(r.stdout)).toBe("deny");
    expect(r.code).toBe(0);
  });

  it("Read 圈外即使桩 allow 仍 deny", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const p = gatePaths(home);
    server = rawServer(p.sockPath, { permission: "allow" });
    const r = await runClaude(script, {
      tool_name: "Read",
      tool_input: { file_path: "/etc/hosts" },
      cwd: "/tmp/wt"
    });
    expect(hookDecision(r.stdout)).toBe("deny");
  });

  it("SOCK 含单引号/换行/$()/反引号的脚本 bash -n 通过;curlMax 非整数抛错", async () => {
    const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
    const { writeFileSync: wf, mkdtempSync: mt, chmodSync: ch } = require("node:fs") as typeof import("node:fs");
    const home = mt(join(tmpdir(), "saydo-q-"));
    const scriptPath = join(home, "g.sh");
    for (const sock of ["/tmp/sock'quote", "/tmp/sock\nnl", "/tmp/sock$(whoami)", "/tmp/sock`id`"]) {
      const body = buildClaudeGateScript(sock, join(home, "log"));
      wf(scriptPath, body);
      ch(scriptPath, 0o755);
      execFileSync("/bin/bash", ["-n", scriptPath], { timeout: 3000 });
    }
    expect(() => buildClaudeGateScript("/tmp/s", "/tmp/l", { curlMaxTimeSec: 1.5 })).toThrow(/positive integer/);
    expect(() => buildClaudeGateScript("/tmp/s", "/tmp/l", { curlMaxTimeSec: 0 })).toThrow(/positive integer/);
  });

  it("file_path 含单引号与 $() 仍经 jq --arg 到达桩", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cg-"));
    const script = writeClaude(home);
    const p = gatePaths(home);
    const seen: string[] = [];
    const { createServer } = require("node:http") as typeof import("node:http");
    const s = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        seen.push(Buffer.concat(chunks).toString("utf8"));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ permission: "allow" }));
      });
    });
    s.listen(p.sockPath);
    server = s;
    const r = await runClaude(script, {
      tool_name: "Write",
      tool_input: { file_path: "/tmp/wt/a'$(whoami).ts" },
      cwd: "/tmp/wt"
    });
    expect(hookDecision(r.stdout)).toBe("allow");
    expect(seen.some((b) => b.includes("a'$(whoami).ts"))).toBe(true);
  });
});
