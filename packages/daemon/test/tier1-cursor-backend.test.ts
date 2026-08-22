import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { cursorHookCommand } from "../src/tier1/adapter.js";
import {
  cursorBackend,
  cursorBuildArgv,
  cursorIsTerminalResult,
  cursorParseLine,
  isCursorShellToolCall,
  isCursorStartedToolCall
} from "../src/tier1/backends/cursor.js";
import { gatePaths } from "../src/tier1/gateScript.js";

describe("cursor backend seam(B1-a 快照,行为对齐抽取前)", () => {
  it("buildArgv 与抽取前 realAgentSpawner 一致", () => {
    expect(cursorBuildArgv({ model: "fable-5-max", prompt: "hello" })).toEqual([
      "-p",
      "--force",
      "--trust",
      "--output-format",
      "stream-json",
      "--model",
      "fable-5-max",
      "hello"
    ]);
    expect(
      cursorBuildArgv({ model: "fable-5-max", prompt: "hello", resumeKey: "chat-1", sessionId: "ignored", maxTurns: 9 })
    ).toEqual([
      "-p",
      "--force",
      "--trust",
      "--output-format",
      "stream-json",
      "--model",
      "fable-5-max",
      "--resume",
      "chat-1",
      "hello"
    ]);
  });

  it("finishPolicy / canaryLeft / adapter 恒 cursor 现状", () => {
    const b = cursorBackend();
    expect(b.adapter).toBe("cursor");
    expect(b.finishPolicy).toBe("kill_on_result");
    expect(b.canaryLeft).toBe("shell_started");
  });

  it("provisionHooks 写 worktree .cursor/hooks.json 指向 gate.sh", () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cur-prov-"));
    const cwd = mkdtempSync(join(tmpdir(), "saydo-cur-wt-"));
    const p = gatePaths(home);
    mkdirSync(p.dir, { recursive: true });
    const out = cursorBackend().provisionHooks(cwd, p, 120);
    expect(out.filesWritten).toHaveLength(1);
    expect(out.filesWritten[0]).toBe(join(cwd, ".cursor", "hooks.json"));
    expect(out.extraArgs).toEqual([]);
    const hooks = JSON.parse(readFileSync(out.filesWritten[0]!, "utf8")) as {
      hooks: { beforeShellExecution: Array<{ command: string; timeout: number }> };
    };
    // 评审 91 B-3:command 由 shell 执行,路径须 shell 引用(裸拼在含空格/单引号的 SAYDO_HOME 下会损坏)。
    // 评审 92:让 shell 真解析一遍,断言回原路径,而不是与生成侧同源比对。
    const rawCmd = hooks.hooks.beforeShellExecution[0]?.command ?? "";
    if (process.platform === "win32") {
      expect(rawCmd).toContain("gate-cursor.mjs");
    } else {
      expect(execFileSync("/bin/sh", ["-c", `printf '%s' ${rawCmd}`], { encoding: "utf8" })).toBe(p.scriptPath);
    }
    expect(hooks.hooks.beforeShellExecution[0]?.timeout).toBe(120);
  });

  it("parseLine: system.init -> observed_model; started shell -> tool_started; result success -> result", () => {
    expect(
      cursorParseLine(JSON.stringify({ type: "system", subtype: "init", model: "fable-5-max" }))
    ).toEqual({ kind: "observed_model", observedModel: "fable-5-max" });
    const started = JSON.stringify({
      type: "tool_call",
      subtype: "started",
      tool_call: { name: "shell", args: { command: "ls" } }
    });
    expect(isCursorStartedToolCall(started)).toBe(true);
    expect(isCursorShellToolCall(started)).toBe(true);
    expect(cursorParseLine(started)).toEqual({ kind: "tool_started", tool: "started" });
    const result = JSON.stringify({ type: "result", subtype: "success", result: "done" });
    expect(cursorIsTerminalResult(result)).toBe(true);
    expect(cursorParseLine(result).kind).toBe("result");
    const err = JSON.stringify({ type: "result", subtype: "error", result: "oops" });
    expect(cursorIsTerminalResult(err)).toBe(true);
    expect(cursorParseLine(err).kind).toBe("unknown");
  });
});
