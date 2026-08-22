import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCursorLine } from "../../providers/byoa/parsers.js";
import { explainCliProcessFailure } from "../../providers/byoa/processFailure.js";
import { buildCursorHooksJson } from "../adapter.js";
import type { GatePaths } from "../gateScript.js";
import type { Tier1Backend, Tier1BuildArgvInput, Tier1Event } from "./types.js";

/** cursor stream-json 的 shell 类 tool_call(e2e 实测校准词表) */
export function isCursorShellToolCall(rawLine: string): boolean {
  return /"(shellToolCall|shell_tool_call)"|"name"\s*:\s*"(shell|bash|run_terminal_cmd|terminal)"/i.test(rawLine);
}

export function isCursorStartedToolCall(rawLine: string): boolean {
  return /"subtype"\s*:\s*"started"/.test(rawLine);
}

export function cursorBuildArgv(i: Tier1BuildArgvInput): string[] {
  const args = ["-p", "--force", "--trust", "--output-format", "stream-json", "--model", i.model];
  if (i.resumeKey) args.push("--resume", i.resumeKey);
  args.push(i.prompt);
  return args;
}

export function cursorParseLine(line: string): Tier1Event {
  const ev = parseCursorLine(line);
  if (ev.kind === "observed_model" && ev.observedModel) {
    return { kind: "observed_model", observedModel: ev.observedModel };
  }
  if (ev.kind === "result") {
    return ev.text !== undefined
      ? { kind: "result", isError: false, text: ev.text }
      : { kind: "result", isError: false };
  }
  if (ev.kind === "tool_call") {
    if (!isCursorStartedToolCall(line)) return { kind: "ignore" };
    return { kind: "tool_started", tool: ev.toolName ?? "unknown_tool" };
  }
  if (ev.kind === "ignore" || ev.kind === "text") return { kind: "ignore" };
  return { kind: "unknown" };
}

export function cursorIsTerminalResult(line: string): boolean {
  return /"type"\s*:\s*"result"/.test(line);
}

export function cursorBackend(): Tier1Backend {
  return {
    adapter: "cursor",
    buildArgv: cursorBuildArgv,
    provisionHooks(cwd: string, gate: GatePaths, hookTimeoutSec?: number) {
      const cursorDir = join(cwd, ".cursor");
      mkdirSync(cursorDir, { recursive: true });
      const hooksJsonPath = join(cursorDir, "hooks.json");
      writeFileSync(hooksJsonPath, buildCursorHooksJson(gate.scriptPath, hookTimeoutSec ?? 120));
      return { extraArgs: [], filesWritten: [hooksJsonPath] };
    },
    parseLine: (line) => [cursorParseLine(line)],
    isTerminalResult: cursorIsTerminalResult,
    finishPolicy: "kill_on_result",
    canaryLeft: "shell_started",
    explainFailure(exit, stderrTail, lines) {
      const explained = explainCliProcessFailure("cursor_cli", {
        stderrTail,
        ...(exit !== undefined ? { exitCode: exit } : {}),
        ...(lines !== undefined ? { lines } : {})
      });
      return { code: explained.code, message: explained.message };
    }
  };
}
