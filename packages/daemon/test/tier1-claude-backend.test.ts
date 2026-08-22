import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  buildClaudeArgv,
  buildClaudeHooksSettings,
  claudeBackend,
  claudeEnvOverrides,
  parseClaudeTier1Line
} from "../src/tier1/backends/claude.js";
import { explainCliProcessFailure } from "../src/providers/byoa/processFailure.js";
import { cursorHookCommand } from "../src/tier1/adapter.js";
import { gatePaths } from "../src/tier1/gateScript.js";

const FIX = join(__dirname, "fixtures/claude-cli/2.1.220");

function loadJsonl(name: string): string[] {
  return readFileSync(join(FIX, name), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

describe("claude backend argv 封闭集合", () => {
  const argv = buildClaudeArgv({
    model: "opus",
    prompt: "hello",
    settingsJson: buildClaudeHooksSettings("/tmp/gate-claude.sh", 120),
    sessionId: "00000000-0000-4000-8000-000000000001",
    maxTurns: 200
  });

  it("必含终版旗标(v3.1 default + 五工具 + 空 setting-sources + strict-mcp)", () => {
    expect(argv).toContain("-p");
    expect(argv).toContain("--verbose");
    expect(argv[argv.indexOf("--output-format") + 1]).toBe("stream-json");
    expect(argv[argv.indexOf("--permission-mode") + 1]).toBe("default");
    expect(argv[argv.indexOf("--tools") + 1]).toBe("Bash,Read,Write,Edit,NotebookEdit");
    expect(argv[argv.indexOf("--disallowedTools") + 1]).toBe("WebFetch,WebSearch");
    expect(argv[argv.indexOf("--setting-sources") + 1]).toBe("");
    expect(argv).toContain("--strict-mcp-config");
    expect(argv).not.toContain("--mcp-config");
    expect(argv).toContain("--settings");
    expect(argv[argv.indexOf("--max-turns") + 1]).toBe("200");
    expect(argv).toContain("--session-id");
    expect(argv).not.toContain("--resume");
  });

  it("必不含 bypass/dontAsk/dangerously-skip/--add-dir/--bare/--fallback-model/acceptEdits/--no-session-persistence", () => {
    const s = argv.join(" ");
    for (const banned of [
      "bypassPermissions",
      "dontAsk",
      "--dangerously-skip-permissions",
      "--add-dir",
      "--no-session-persistence",
      "--bare",
      "--fallback-model",
      "acceptEdits"
    ]) {
      expect(s.includes(banned), banned).toBe(false);
    }
  });

  it("sessionId 与 resumeKey 互斥", () => {
    const hooks = buildClaudeHooksSettings("/tmp/gate-claude.sh", 120);
    expect(() =>
      buildClaudeArgv({ model: "opus", prompt: "x", settingsJson: hooks, sessionId: "a", resumeKey: "b" })
    ).toThrow(/mutually exclusive/);
    const resume = buildClaudeArgv({ model: "opus", prompt: "x", settingsJson: hooks, resumeKey: "chat-1" });
    expect(resume).toContain("--resume");
    expect(resume).not.toContain("--session-id");
  });

  it("缺 settingsJson 或空 hooks 抛错", () => {
    expect(() => buildClaudeArgv({ model: "opus", prompt: "x" })).toThrow(/settingsJson/);
    expect(() => buildClaudeArgv({ model: "opus", prompt: "x", settingsJson: "{}" })).toThrow(/PreToolUse/);
    expect(() => buildClaudeArgv({ model: "opus", prompt: "x", settingsJson: '{"hooks":{}}' })).toThrow(/PreToolUse/);
  });
});

describe("claude hooks JSON 快照", () => {
  it("matcher=* timeout 120 且拒绝过短 timeout", () => {
    const json = JSON.parse(buildClaudeHooksSettings("/tmp/gate-claude.sh", 120)) as {
      hooks: { PreToolUse: Array<{ matcher: string; hooks: Array<{ timeout: number; command: string }> }> };
    };
    expect(json.hooks.PreToolUse[0]?.matcher).toBe("*");
    expect(json.hooks.PreToolUse[0]?.hooks[0]?.timeout).toBe(120);
    expect(json.hooks.PreToolUse[0]?.hooks[0]?.command).toBe(cursorHookCommand("/tmp/gate-claude.sh"));
    expect(() => buildClaudeHooksSettings("/tmp/x", 110)).toThrow(/hookTimeoutSec/);
  });

  it("provisionHooks 写 gate-claude.sh 而非 cursor gate.sh", () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-prov-"));
    const p = gatePaths(home);
    mkdirSync(p.dir, { recursive: true });
    const out = claudeBackend().provisionHooks("/tmp/wt", p);
    expect(out.filesWritten).toHaveLength(1);
    expect(out.filesWritten[0]).toMatch(process.platform === "win32" ? /gate-claude\.mjs$/u : /gate-claude\.sh$/u);
    expect(out.filesWritten[0]?.endsWith("gate.sh")).toBe(false);
    expect(existsSync(out.filesWritten[0]!)).toBe(true);
    const settings = JSON.parse(out.extraArgs[1]!) as {
      hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> };
    };
    const cmd = settings.hooks.PreToolUse[0]?.hooks[0]?.command ?? "";
    // 评审 91 B-3:POSIX 的 command 是 shell 引用过的脚本路径,不是裸路径。
    // 评审 92:不再拿同一 helper 生成期望值(那样两边同时错也会绿)——直接让 shell 解析,
    // 断言解析结果就是那个真实文件路径。
    if (process.platform === "win32") {
      expect(cmd).toContain("gate-claude.mjs");
    } else {
      const parsed = execFileSync("/bin/sh", ["-c", `printf '%s' ${cmd}`], { encoding: "utf8" });
      expect(parsed).toBe(out.filesWritten[0]);
    }
    expect(readFileSync(out.filesWritten[0]!, "utf8")).toContain("PreToolUse");
  });
});

describe("parseClaudeTier1Line 对 golden fixture", () => {
  it("init 含 apiKeySource/tools/model", () => {
    const evs = parseClaudeTier1Line(loadJsonl("init.jsonl")[0]!);
    const init = evs.find((e) => e.kind === "init");
    expect(init?.kind).toBe("init");
    if (init?.kind !== "init") throw new Error("expected init");
    expect(init.apiKeySource).toBe("none");
    expect(init.tools).toEqual(["Bash", "Edit", "NotebookEdit", "Read", "Write"]);
    expect(init.model).toBe("claude-sonnet-5");
    expect(init.claudeCodeVersion).toBe("2.1.220");
    expect(evs.some((e) => e.kind === "observed_model")).toBe(true);
  });

  it("并行 tool_use 两块都计", () => {
    const evs = parseClaudeTier1Line(loadJsonl("tool_use_multi.jsonl")[0]!);
    const started = evs.filter((e) => e.kind === "tool_started");
    expect(started).toHaveLength(2);
    expect(started.map((e) => (e.kind === "tool_started" ? e.tool : ""))).toEqual(["Bash", "Write"]);
    expect(started.every((e) => e.kind === "tool_started" && Boolean(e.toolUseId))).toBe(true);
  });

  it("user tool_result", () => {
    const lines = loadJsonl("tool_result.jsonl");
    const deny = parseClaudeTier1Line(lines[0]!);
    expect(deny.some((e) => e.kind === "tool_result" && e.isError === true)).toBe(true);
    const ok = parseClaudeTier1Line(lines[1]!);
    expect(ok.some((e) => e.kind === "tool_result" && e.isError === false)).toBe(true);
  });

  it("rate_limit", () => {
    const evs = parseClaudeTier1Line(loadJsonl("rate_limit.jsonl")[0]!);
    expect(evs[0]).toMatchObject({ kind: "rate_limit", status: "allowed", rateLimitType: "five_hour" });
  });

  it("result_success", () => {
    const evs = parseClaudeTier1Line(loadJsonl("result_success.jsonl")[0]!);
    expect(evs[0]?.kind).toBe("result");
    if (evs[0]?.kind !== "result") throw new Error("expected result");
    expect(evs[0].subtype).toBe("success");
    expect(evs[0].isError).toBe(false);
  });

  it("result_max_turns", () => {
    const evs = parseClaudeTier1Line(loadJsonl("result_max_turns.jsonl")[0]!);
    expect(evs[0]?.kind).toBe("result");
    if (evs[0]?.kind !== "result") throw new Error("expected result");
    expect(evs[0].subtype).toBe("error_max_turns");
    expect(evs[0].isError).toBe(true);
    expect(evs[0].terminalReason).toBe("max_turns");
  });

  it("resume_fail", () => {
    const evs = parseClaudeTier1Line(loadJsonl("resume_fail.jsonl")[0]!);
    expect(evs[0]?.kind).toBe("result");
    if (evs[0]?.kind !== "result") throw new Error("expected result");
    expect(evs[0].subtype).toBe("error_during_execution");
    expect(evs[0].isError).toBe(true);
  });
});

describe("explainFailure 三例", () => {
  const backend = claudeBackend();
  it("Login expired -> auth_required", () => {
    const e = backend.explainFailure(1, "Login expired. Please run /login");
    expect(e.code).toBe("auth_required");
  });
  it("Please run /login -> auth_required", () => {
    const e = explainCliProcessFailure("claude_cli", { exitCode: 1, stderrTail: "Please run /login" });
    expect(e.code).toBe("auth_required");
  });
  it("普通退出保留退出码", () => {
    const e = backend.explainFailure(1, "boom: unexpected parser crash");
    expect(e.code).toBe("process_exit");
    expect(e.message).toContain("1");
  });
});

describe("claude.ts 不引用 parseClaudeLine", () => {
  it("源码不含 parseClaudeLine", () => {
    const src = readFileSync(join(__dirname, "../src/tier1/backends/claude.ts"), "utf8");
    expect(src.includes("parseClaudeLine")).toBe(false);
  });
});

describe("claudeEnvOverrides(W5.4-b C1;09 §11 G4 例外两键,方案 D13)", () => {
  it("键集合恰为 DISABLE_AUTOUPDATER/SHELL 且值为终版(不多不少)", () => {
    expect(claudeEnvOverrides).toEqual({ DISABLE_AUTOUPDATER: "1", SHELL: "/bin/sh" });
    expect(Object.keys(claudeEnvOverrides).sort()).toEqual(["DISABLE_AUTOUPDATER", "SHELL"]);
  });

  it("恒不含 ANTHROPIC_* / CLAUDE_CODE_OAUTH_TOKEN(订阅只经 CLI 登录态,红线 4)", () => {
    for (const key of Object.keys(claudeEnvOverrides)) {
      expect(key.startsWith("ANTHROPIC_")).toBe(false);
      expect(key).not.toBe("CLAUDE_CODE_OAUTH_TOKEN");
    }
  });
});
