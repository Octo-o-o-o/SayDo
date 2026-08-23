import { mkdirSync } from "node:fs";
import { explainCliProcessFailure } from "../../providers/byoa/processFailure.js";
import { cursorHookCommand } from "../adapter.js";
import { buildClaudeGateMjs, buildClaudeGateScript, writeGateScriptAtomic, type GatePaths } from "../gateScript.js";
import type { Tier1Backend, Tier1BuildArgvInput, Tier1Event } from "./types.js";

export const CLAUDE_TOOLS = "Bash,Read,Write,Edit,NotebookEdit";
export const CLAUDE_CLOSED_TOOLS = new Set(CLAUDE_TOOLS.split(","));
export const CLAUDE_DISALLOWED = "WebFetch,WebSearch";
export const CLAUDE_HOOK_MATCHER = "*";
const CURL_MAX_TIME_SEC = 100;

/**
 * G4 env 白名单例外两键(09 §11;方案 D13,显式注入/覆盖,非凭据):
 * DISABLE_AUTOUPDATER=1 防批中自更新改 digest(--setting-sources "" 使用户 autoUpdates=false 失效);
 * SHELL=/bin/sh 防登录 shell profile 快照把 ~/.zshrc 导出变量带进 agent Bash。
 * 恒不含 ANTHROPIC_* / CLAUDE_CODE_OAUTH_TOKEN(订阅只经 claude CLI 登录态)。
 * consumers 归 C2 spawn 接线;本阶段只落常量。
 */
export const claudeEnvOverrides = Object.freeze({
  DISABLE_AUTOUPDATER: "1",
  SHELL: "/bin/sh"
} as const);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function assertHooksSettings(settings: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(settings);
  } catch {
    throw new Error("claude backend: settingsJson must be JSON");
  }
  if (!isRecord(parsed) || !isRecord(parsed["hooks"]) || !Array.isArray(parsed["hooks"]["PreToolUse"])) {
    throw new Error("claude backend: settingsJson must contain hooks.PreToolUse");
  }
  if (parsed["hooks"]["PreToolUse"].length === 0) {
    throw new Error("claude backend: settingsJson hooks.PreToolUse must be non-empty");
  }
}

export function buildClaudeArgv(i: Tier1BuildArgvInput): string[] {
  if (i.sessionId && i.resumeKey) {
    throw new Error("claude backend: sessionId and resumeKey are mutually exclusive");
  }
  if (!i.settingsJson) {
    throw new Error("claude backend: settingsJson with PreToolUse hooks is required");
  }
  assertHooksSettings(i.settingsJson);
  const maxTurns = i.maxTurns ?? 200;
  const settings = i.settingsJson;
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    i.model,
    "--permission-mode",
    "default",
    "--tools",
    CLAUDE_TOOLS,
    "--disallowedTools",
    CLAUDE_DISALLOWED,
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--settings",
    settings,
    "--max-turns",
    String(maxTurns)
  ];
  if (i.sessionId) args.push("--session-id", i.sessionId);
  if (i.resumeKey) args.push("--resume", i.resumeKey);
  args.push(i.prompt);
  const flagPart = args.slice(0, -1).join("\0");
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
    if (flagPart.includes(banned)) throw new Error(`claude argv must not contain ${banned}`);
  }
  return args;
}

export function buildClaudeHooksSettings(gateScriptPath: string, hookTimeoutSec = 120): string {
  if (!(hookTimeoutSec >= 120 && hookTimeoutSec > CURL_MAX_TIME_SEC + 10)) {
    throw new Error(
      `claude hookTimeoutSec must be >= 120 and > ${CURL_MAX_TIME_SEC}+10 (got ${hookTimeoutSec})`
    );
  }
  return JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: CLAUDE_HOOK_MATCHER,
          hooks: [{ type: "command", command: cursorHookCommand(gateScriptPath), timeout: hookTimeoutSec }]
        }
      ]
    }
  });
}

export function parseClaudeTier1Line(line: string): Tier1Event[] {
  const trimmed = line.trim();
  if (!trimmed) return [{ kind: "unknown" }];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [{ kind: "unknown" }];
  }
  if (!isRecord(parsed)) return [{ kind: "unknown" }];
  const type = parsed["type"];
  if (type === "system") {
    const subtype = parsed["subtype"];
    if (subtype === "init" || (asString(parsed["session_id"]) && Array.isArray(parsed["tools"]))) {
      const tools = Array.isArray(parsed["tools"])
        ? parsed["tools"].filter((t): t is string => typeof t === "string")
        : undefined;
      const ev: Extract<Tier1Event, { kind: "init" }> = { kind: "init" };
      const sid = asString(parsed["session_id"]);
      const model = asString(parsed["model"]);
      const perm = asString(parsed["permissionMode"]);
      const src = asString(parsed["apiKeySource"]);
      const ver = asString(parsed["claude_code_version"]);
      if (sid) ev.session_id = sid;
      if (model) ev.model = model;
      if (tools) ev.tools = tools;
      if (perm) ev.permissionMode = perm;
      if (src) ev.apiKeySource = src;
      if (ver) ev.claudeCodeVersion = ver;
      const out: Tier1Event[] = [ev];
      if (model) out.push({ kind: "observed_model", observedModel: model });
      return out;
    }
    return [{ kind: "ignore" }];
  }
  if (type === "rate_limit_event") {
    const info = isRecord(parsed["rate_limit_info"]) ? parsed["rate_limit_info"] : parsed;
    const rl: Extract<Tier1Event, { kind: "rate_limit" }> = { kind: "rate_limit" };
    const st = asString(info["status"]);
    const resets = asNumber(info["resetsAt"]);
    const rlt = asString(info["rateLimitType"]);
    if (st) rl.status = st;
    if (resets !== undefined) rl.resetsAt = resets;
    if (rlt) rl.rateLimitType = rlt;
    return [rl];
  }
  if (type === "assistant") {
    const msg = isRecord(parsed["message"]) ? parsed["message"] : undefined;
    const out: Tier1Event[] = [];
    const model = msg ? asString(msg["model"]) : undefined;
    if (model) out.push({ kind: "observed_model", observedModel: model });
    const content = msg && Array.isArray(msg["content"]) ? msg["content"] : [];
    for (const block of content) {
      if (!isRecord(block)) continue;
      if (block["type"] === "tool_use") {
        const started: Extract<Tier1Event, { kind: "tool_started" }> = {
          kind: "tool_started",
          tool: asString(block["name"]) ?? "unknown_tool"
        };
        const id = asString(block["id"]);
        if (id) started.toolUseId = id;
        out.push(started);
      }
    }
    return out.length > 0 ? out : [{ kind: "ignore" }];
  }
  if (type === "user") {
    const msg = isRecord(parsed["message"]) ? parsed["message"] : undefined;
    const content = msg && Array.isArray(msg["content"]) ? msg["content"] : [];
    const out: Tier1Event[] = [];
    for (const block of content) {
      if (!isRecord(block)) continue;
      if (block["type"] === "tool_result" || asString(block["tool_use_id"])) {
        const tr: Extract<Tier1Event, { kind: "tool_result" }> = {
          kind: "tool_result",
          isError: block["is_error"] === true
        };
        const tid = asString(block["tool_use_id"]);
        if (tid) tr.toolUseId = tid;
        out.push(tr);
      }
    }
    return out.length > 0 ? out : [{ kind: "ignore" }];
  }
  if (type === "result") {
    const res: Extract<Tier1Event, { kind: "result" }> = {
      kind: "result",
      isError: parsed["is_error"] === true
    };
    const sessionId = asString(parsed["session_id"]);
    const subtype = asString(parsed["subtype"]);
    const numTurns = asNumber(parsed["num_turns"]);
    const stop = asString(parsed["stop_reason"]);
    const terminal = asString(parsed["terminal_reason"]);
    const text = asString(parsed["result"]);
    if (sessionId) res.session_id = sessionId;
    if (subtype) res.subtype = subtype;
    if (numTurns !== undefined) res.numTurns = numTurns;
    const totalCost = asNumber(parsed["total_cost_usd"]);
    if (totalCost !== undefined) res.totalCostUsd = totalCost;
    if (parsed["usage"] !== undefined) res.usage = parsed["usage"];
    if (parsed["modelUsage"] !== undefined) res.modelUsage = parsed["modelUsage"];
    if (parsed["permission_denials"] !== undefined) res.permissionDenials = parsed["permission_denials"];
    if (stop) res.stopReason = stop;
    if (terminal) res.terminalReason = terminal;
    if (text) res.text = text;
    return [res];
  }
  return [{ kind: "unknown" }];
}

export function claudeIsTerminalResult(line: string): boolean {
  return /"type"\s*:\s*"result"/.test(line);
}

export function claudeBackend(): Tier1Backend {
  return {
    adapter: "claude_code",
    buildArgv: buildClaudeArgv,
    provisionHooks(_cwd: string, gate: GatePaths, hookTimeoutSec?: number) {
      mkdirSync(gate.dir, { recursive: true });
      const scriptPath = gate.claudeScriptPath;
      if (process.platform === "win32") {
        writeGateScriptAtomic(scriptPath, buildClaudeGateMjs(gate.bindPath, gate.secretPath, gate.logPath));
      } else {
        writeGateScriptAtomic(scriptPath, buildClaudeGateScript(gate.sockPath, gate.logPath));
      }
      const settings = buildClaudeHooksSettings(scriptPath, hookTimeoutSec ?? 120);
      return { extraArgs: ["--settings", settings], filesWritten: [scriptPath] };
    },
    parseLine: parseClaudeTier1Line,
    isTerminalResult: claudeIsTerminalResult,
    finishPolicy: "wait_exit_then_kill",
    canaryLeft: "tool_result",
    explainFailure(exit, stderrTail, lines) {
      const explained = explainCliProcessFailure("claude_cli", {
        stderrTail,
        ...(exit !== undefined ? { exitCode: exit } : {}),
        ...(lines !== undefined ? { lines } : {})
      });
      return { code: explained.code, message: explained.message };
    }
  };
}
