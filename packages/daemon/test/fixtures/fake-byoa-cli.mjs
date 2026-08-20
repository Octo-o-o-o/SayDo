#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const prompt = readFileSync(0, "utf8");
const match = /fake:([a-z0-9-]+)(?::([^\s]+))?/.exec(prompt);
let mode = match?.[1] ?? "success";
const marker = match?.[2];
const isCodex = args.includes("exec") && args.includes("--json");
const isClaude = args.includes("--safe-mode");
const isGrok = args.includes("--prompt-file") && args.includes("streaming-json");
const isGemini = args.includes("--admin-policy");
const isQwen = args.includes("--max-tool-calls");
const isCopilot = args.includes("--available-tools") || args.includes("--disable-builtin-mcps");
const provider = isCodex
  ? "codex"
  : isClaude
    ? "claude"
    : isGrok
      ? "grok"
      : isGemini
        ? "gemini"
        : isQwen
          ? "qwen"
          : isCopilot
            ? "copilot"
            : "cursor";
const modelFlag = args.indexOf(isCodex || isGemini || isQwen ? "-m" : isGrok ? "-m" : "--model");
const model =
  modelFlag >= 0
    ? args[modelFlag + 1]
    : provider === "cursor"
      ? "claude-fable-5"
      : provider === "gemini"
        ? "gemini-2.5-pro"
        : provider === "qwen"
          ? "qwen3-coder-plus"
          : provider === "copilot"
            ? "gpt-5.2"
            : "gpt-5.6-luna";
const schemaFlag = args.findIndex((arg) => arg === "--output-schema" || arg === "--json-schema");
const schemaArg = schemaFlag >= 0 ? args[schemaFlag + 1] : undefined;

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function success(text = "ok") {
  if (provider === "codex") {
    emit({ type: "thread.started", thread_id: "fake-thread" });
    emit({ type: "turn.started" });
    emit({ type: "item.completed", item: { id: "fake-item", type: "agent_message", text } });
    emit({ type: "turn.completed" });
    return;
  }
  if (provider === "gemini" || provider === "qwen") {
    emit({ type: "init", session_id: "fake-session" });
    emit({ type: "message", role: "assistant", content: text, model });
    emit({ type: "result", status: "success", stats: { model }, result: text });
    return;
  }
  if (provider === "copilot") {
    emit({ type: "assistant", message: { content: [{ type: "text", text }] }, model });
    emit({ type: "result", result: text, model });
    return;
  }
  if (provider === "claude") {
    if (schemaArg) {
      let structuredOutput;
      try {
        structuredOutput = JSON.parse(text);
      } catch {
        structuredOutput = text;
      }
      emit({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "ignored-non-structured-result",
        structured_output: structuredOutput
      });
      return;
    }
    emit({ type: "assistant", message: { model, content: [{ type: "text", text }] } });
    emit({ type: "result", subtype: "success", is_error: false, result: text });
    return;
  }
  emit({ type: "system", subtype: "init", model });
  emit({ type: "result", subtype: "success", result: text });
}

let setupText;
if (!match && prompt.includes("dialog_cli_oneshot 自检 envelope")) {
  setupText = '{"version":1,"reply":"pong","actions":[]}';
} else if (!match && prompt.includes("setup thinking self-test")) {
  setupText = "沉思自检响应";
} else if (!match && prompt.includes("最小决策包")) {
  setupText = JSON.stringify({
    outcomePreview: "自检",
    inScope: ["setup"],
    outOfScope: [],
    acceptance: ["返回合同"],
    plan: [{ seq: 1, step: "检查", owner: "ai" }],
    risks: []
  });
} else if (!match && prompt.includes("空 perClaim")) {
  setupText = '{"perClaim":[]}';
}
if (args.some((arg) => arg === "fake-fail" || arg.endsWith("-fail"))) mode = "nonzero";

if (mode === "timeout") {
  process.on("SIGTERM", () => {
    if (marker) writeFileSync(marker, "SIGTERM", "utf8");
    process.exit(0);
  });
  setInterval(() => {}, 1000);
} else if (mode === "stubborn") {
  process.on("SIGTERM", () => {
    if (marker) writeFileSync(marker, "SIGTERM", "utf8");
  });
  if (marker) writeFileSync(`${marker}.ready`, "ready", "utf8");
  setInterval(() => {}, 1000);
} else if (mode === "delay") {
  setTimeout(() => success("ok"), 150);
} else if (mode === "malformed-json") {
  success("not-json");
} else if (mode === "invalid-ndjson") {
  process.stdout.write('{"type":\n');
} else if (mode === "idle-after-output") {
  // 先武装信号处理再输出；高并发 CI 可能在首个 stdout write 后抢占子进程，
  // 若反过来会让 80ms idle timer 在 handler 注册前发送 SIGTERM，形成测试假阴性。
  process.on("SIGTERM", () => {
    if (marker) writeFileSync(marker, "SIGTERM", "utf8");
    process.exit(0);
  });
  if (provider === "cursor") {
    emit({ type: "system", subtype: "init", model });
    emit({ type: "assistant", message: { content: [{ type: "text", text: "partial" }] } });
  } else if (provider === "claude") {
    emit({ type: "assistant", message: { model, content: [{ type: "text", text: "partial" }] } });
  } else {
    emit({ type: "thread.started", thread_id: "fake-thread" });
    emit({ type: "item.completed", item: { id: "fake-item", type: "agent_message", text: "partial" } });
  }
  setInterval(() => {}, 1000);
} else if (mode === "orphan-grandchildren") {
  if (!marker) {
    process.stderr.write("orphan marker missing\n");
    process.exit(8);
  }
  const childCode = `
const fs = require("node:fs");
const marker = process.argv[1];
const role = process.argv[2];
fs.appendFileSync(marker, role + "-started:" + process.pid + "\\n");
process.on("SIGTERM", () => {
  fs.appendFileSync(marker, role + "-SIGTERM\\n");
  if (role === "inherit") process.exit(0);
});
setInterval(() => {}, 1000);
`;
  for (const role of ["inherit", "ignore"]) {
    spawn(process.execPath, ["-e", childCode, marker, role], {
      stdio: role === "inherit" ? "inherit" : "ignore"
    }).unref();
  }
  setTimeout(() => success("children-drained"), 100);
} else if (mode === "schema-reject") {
  success('{"wrong":true}');
} else if (mode === "schema-zod-only") {
  success(
    prompt.includes("上一轮输出未通过结构化校验")
      ? JSON.stringify({
          outcomePreview: "重试通过",
          inScope: ["setup"],
          outOfScope: [],
          acceptance: ["返回合同"],
          plan: [{ seq: 1, step: "检查", owner: "ai" }],
          risks: []
        })
      : JSON.stringify({ outcomePreview: "", inScope: [], outOfScope: [], acceptance: [], plan: [], risks: [] })
  );
} else if (mode === "claude-schema-missing") {
  emit({ type: "result", subtype: "success", is_error: false, result: '{"value":"ok"}' });
} else if (mode === "schema-ok") {
  if (marker) writeFileSync(marker, schemaArg ?? "cursor-prompt-schema", "utf8");
  if (provider === "codex" && (!schemaArg || !existsSync(schemaArg))) {
    process.stderr.write("schema file missing\n");
    process.exit(9);
  }
  if (provider === "claude") {
    try {
      const parsedSchema = JSON.parse(schemaArg ?? "");
      if (parsedSchema?.type !== "object") throw new Error("not object schema");
    } catch {
      process.stderr.write("inline schema missing\n");
      process.exit(9);
    }
  }
  if (provider === "cursor" && !prompt.includes("[structured-output]")) {
    process.stderr.write("schema prompt missing\n");
    process.exit(9);
  }
  success('{"value":"ok"}');
} else if (mode === "oneshot-valid") {
  success('{"version":1,"reply":"已准备记下。","actions":[{"id":"remember-1","tool":"remember","arguments":{"tier":"M1","claim":"买了乐高","trust":"user_stated","projectId":null}}]}');
} else if (mode === "oneshot-blank-reply") {
  success('{"version":1,"reply":"   ","actions":[]}');
} else if (mode === "oneshot-banned-tool") {
  success('{"version":1,"reply":"不得下发","actions":[{"id":"run-1","tool":"confirmAndDispatch","arguments":{}}]}');
} else if (mode === "oneshot-two-pending") {
  success('{"version":1,"reply":"不得继续","actions":[{"id":"p-1","tool":"proposeFocusAnchor","arguments":{}},{"id":"p-2","tool":"proposeObligation","arguments":{}}]}');
} else if (mode === "oneshot-await-user") {
  success('{"version":1,"reply":"这句不得下发","actions":[{"id":"a-1","tool":"createTask","arguments":{}},{"id":"a-2","tool":"proposeObligation","arguments":{}},{"id":"a-3","tool":"getStatus","arguments":{}}]}');
} else if (mode === "oneshot-action-failure") {
  success('{"version":1,"reply":"失败后不得下发","actions":[{"id":"f-1","tool":"createTask","arguments":{}},{"id":"f-2","tool":"getStatus","arguments":{}}]}');
} else if (mode === "oneshot-retry-once") {
  if (!marker) {
    process.stderr.write("oneshot retry marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    success('{"version":2,"reply":"坏格式","actions":[]}');
  } else success('{"version":1,"reply":"重试后合法","actions":[{"id":"r-1","tool":"getStatus","arguments":{}}]}');
} else if (mode === "oneshot-tripwire-then-duplicate") {
  if (!marker) {
    process.stderr.write("oneshot tripwire marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    emit({ type: "item.completed", item: { type: "command_execution" } });
  } else {
    success('{"version":1,"reply":"重复 id","actions":[{"id":"dup","tool":"getStatus","arguments":{}},{"id":"dup","tool":"getStatus","arguments":{}}]}');
  }
} else if (mode === "nonzero") {
  success("success-looking-text");
  process.stderr.write("fake denied\n");
  process.exit(7);
} else if (mode === "subscription-rate-limit") {
  if (provider === "codex") emit({ type: "turn.failed", error: { message: "usage limit reached" } });
  else if (provider === "claude") {
    emit({ type: "result", subtype: "error", is_error: true, error: { type: "rate_limit_error" } });
  } else emit({ type: "result", subtype: "error", message: "request rate limit reached" });
  process.stderr.write(`${provider} subscription usage limit reached\n`);
  process.exit(7);
} else if (mode === "subscription-rate-limit-structured") {
  if (provider === "codex") emit({ type: "turn.failed", error: { message: "usage limit reached" } });
  else if (provider === "claude") {
    emit({ type: "result", subtype: "error", is_error: true, error: { type: "rate_limit_error" } });
  } else emit({ type: "result", subtype: "error", message: "request rate limit reached" });
  process.exit(7);
} else if (mode === "subscription-rate-limit-stderr") {
  process.stderr.write("usage limit reached\n");
  process.exit(7);
} else if (mode === "subscription-rate-limit-network-once") {
  if (!marker) {
    process.stderr.write("rate-limit marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    if (provider === "codex") emit({ type: "turn.failed", error: { message: "usage limit reached" } });
    else if (provider === "claude") {
      emit({ type: "result", subtype: "error", is_error: true, error: { type: "rate_limit_error" } });
    } else emit({ type: "result", subtype: "error", message: "request rate limit reached" });
    process.stderr.write("network request failed while usage limit reached\n");
    process.exit(7);
  }
  success("must-not-retry");
} else if (mode === "disk-quota") {
  process.stderr.write("ENOSPC: Disk quota exceeded\n");
  process.exit(7);
} else if (mode === "auth-rate-limit") {
  process.stderr.write("authentication failed: login rate limit reached\n");
  process.exit(7);
} else if (mode === "network-proxy-rate-limit") {
  process.stderr.write("network proxy rate limit reached\n");
  process.exit(7);
} else if (mode === "rate-limit-by-proxy") {
  process.stderr.write("rate limit reached by network proxy\n");
  process.exit(7);
} else if (mode === "rate-limit-authenticating") {
  process.stderr.write("error: rate limit reached while authenticating login\n");
  process.exit(7);
} else if (mode === "quota-local-proxy") {
  process.stderr.write("request quota exceeded by local proxy\n");
  process.exit(7);
} else if (mode === "rate-limit-split-context") {
  process.stderr.write("rate limit reached\noauth token rejected\n");
  process.exit(7);
} else if (mode === "rate-limit-structured-context") {
  if (provider === "codex") {
    emit({ type: "turn.failed", error: { type: "authentication_error", message: "rate limit reached" } });
  } else if (provider === "claude") {
    emit({
      type: "result",
      subtype: "error",
      is_error: true,
      error: { code: "proxy_error", message: "usage limit reached" }
    });
  } else {
    emit({ type: "result", subtype: "error", error: { code: "proxy_error", message: "request rate limit reached" } });
  }
  process.exit(7);
} else if (mode === "success-rate-limit-text") {
  success("How to explain rate limit and usage limit behavior");
} else if (mode === "codex-meta-model-mismatch") {
  emit({ type: "thread.started", thread_id: "fake-thread", model: "claude-sonnet-5" });
  emit({ type: "turn.started" });
  emit({ type: "item.completed", item: { id: "fake-item", type: "agent_message", text: "must-not-pass" } });
  emit({ type: "turn.completed" });
} else if (mode === "unknown-event") {
  if (provider === "cursor") emit({ type: "system", subtype: "init", model });
  emit({ type: "SECRET_MUST_NOT_ENTER_AUDIT", subtype: "TOKEN_MUST_NOT_ENTER_AUDIT", payload: {} });
  success("must-not-pass");
} else if (mode === "unknown-event-once") {
  if (!marker) {
    process.stderr.write("unknown-event state marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    if (provider === "cursor") emit({ type: "system", subtype: "init", model });
    emit({ type: "codex_random_notice", payload: "TRIGGER_UNKNOWN_ONCE" });
    success("must-not-pass");
  } else if (prompt.includes("再次强调")) {
    process.stderr.write("unknown-event retry must keep same prompt\n");
    process.exit(9);
  } else success("unknown-retry-ok");
} else if (mode === "unknown-event-repeat") {
  if (provider === "cursor") emit({ type: "system", subtype: "init", model });
  emit({ type: "codex_random_notice", payload: "TRIGGER_UNKNOWN_REPEAT" });
  success("must-not-pass");
} else if (mode === "provider-error-event") {
  if (provider === "claude") emit({ type: "result", subtype: "error", is_error: true, result: "must-not-pass" });
  else if (provider === "cursor") emit({ type: "result", subtype: "error", result: "must-not-pass" });
  else emit({ type: "turn.failed", error: { message: "must-not-pass" } });
} else if (mode === "malformed-field") {
  if (provider === "cursor") emit({ type: "system", subtype: "init", model: {} });
  else if (provider === "claude") {
    emit({ type: "assistant", message: { model: {}, content: [{ type: "text", text: "must-not-pass" }] } });
  } else emit({ type: "item.completed", item: { type: "agent_message", text: {} } });
} else if (mode === "partial-exit") {
  if (provider === "cursor") {
    emit({ type: "system", subtype: "init", model });
    emit({ type: "assistant", message: { content: [{ type: "text", text: "must-not-pass" }] } });
  } else if (provider === "claude") {
    emit({ type: "assistant", message: { model, content: [{ type: "text", text: '{"value":"ok"}' }] } });
  } else emit({ type: "item.completed", item: { type: "agent_message", text: "must-not-pass" } });
} else if (mode === "reasoning-high") {
  if (!args.includes("model_reasoning_effort=high")) {
    process.stderr.write("reasoning flag missing\n");
    process.exit(9);
  }
  success("reasoning-ok");
} else if (mode === "terminal-empty") {
  if (provider === "cursor") {
    emit({ type: "system", subtype: "init", model });
    emit({ type: "assistant", message: { content: [{ type: "text", text: "partial-must-not-pass" }] } });
    emit({ type: "result", subtype: "success", result: "" });
  } else if (provider === "claude") {
    emit({ type: "assistant", message: { model, content: [{ type: "text", text: "partial-must-not-pass" }] } });
    emit({ type: "result", subtype: "success", is_error: false, result: "" });
  } else success("partial-is-codex-result");
} else if (mode === "empty") {
  process.exit(0);
} else if (mode === "output-cap") {
  process.stdout.write("x".repeat(1024 * 1024));
} else if (mode === "split-utf8") {
  const payload =
    provider === "cursor"
      ? `${JSON.stringify({ type: "system", subtype: "init", model })}\n${JSON.stringify({ type: "result", subtype: "success", result: "中文完整" })}\n`
      : `${JSON.stringify({ type: "future_event", text: "中文完整" })}\n`;
  for (const byte of Buffer.from(payload)) {
    process.stdout.write(Buffer.from([byte]));
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
} else if (mode === "network-once") {
  if (!marker) {
    process.stderr.write("network state marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    process.stderr.write("network connection reset\n");
    process.exit(8);
  }
  success("retried-ok");
} else if (mode === "network-unsafe-once") {
  if (!marker) {
    process.stderr.write("network state marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    if (provider === "cursor") {
      emit({ type: "system", subtype: "init", model });
      emit({ type: "assistant", message: { content: [{ type: "text", text: "already-consumed" }] } });
      emit({ type: "tool_call", subtype: "started" });
    } else if (provider === "claude") {
      emit({ type: "assistant", message: { model, content: [{ type: "text", text: "already-consumed" }] } });
      emit({ type: "assistant", message: { model, content: [{ type: "tool_use", name: "Read" }] } });
    } else {
      emit({ type: "thread.started", thread_id: "fake-thread" });
      emit({ type: "item.completed", item: { type: "agent_message", text: "already-consumed" } });
      emit({ type: "item.completed", item: { type: "web_search_call" } });
    }
    process.stderr.write("network connection reset\n");
    process.exit(8);
  }
  success("must-not-retry");
} else if (mode === "network-unsafe-no-newline") {
  if (!marker) {
    process.stderr.write("network state marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) writeFileSync(marker, "first", "utf8");
  process.stdout.write(JSON.stringify({ type: "tool_call", subtype: "started" }));
  process.stderr.write("network connection reset\n");
  process.exit(8);
} else if (mode === "tripwire-once") {
  if (!marker) {
    process.stderr.write("tripwire state marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    if (provider === "cursor") emit({ type: "tool_call", subtype: "started" });
    else if (provider === "claude") {
      emit({ type: "assistant", message: { model, content: [{ type: "tool_use", name: "Read" }] } });
    } else if (provider === "gemini" || provider === "qwen" || provider === "copilot") {
      emit({ type: "tool_call", tool_name: "read_file", model });
    } else emit({ type: "item.completed", item: { type: "command_execution" } });
  } else if (!prompt.startsWith("不要执行任何命令/不要读文件,仅基于给定内容直接输出 JSON")) {
    process.stderr.write("reinforced prompt lost canonical header\n");
    process.exit(9);
  } else success("tripwire-retry-ok");
} else if (mode === "tripwire-model-mismatch-once") {
  if (!marker) {
    process.stderr.write("tripwire model marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    emit({ type: "item.completed", model: "claude-sonnet-5", item: { type: "command_execution" } });
  } else success("must-not-retry");
} else if (mode === "tripwire-after-text-once") {
  if (!marker) {
    process.stderr.write("tripwire text marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    emit({
      type: "assistant",
      message: {
        model,
        content: [{ type: "text", text: "already-consumed" }, { type: "tool_use", name: "Read" }]
      }
    });
  } else success("must-not-retry");
} else if (mode === "tripwire-cursor-schema") {
  if (!marker) {
    process.stderr.write("tripwire schema marker missing\n");
    process.exit(8);
  }
  if (!existsSync(marker)) {
    writeFileSync(marker, "first", "utf8");
    emit({ type: "tool_call", subtype: "started" });
  } else if (prompt.includes("上一轮输出未通过结构化校验")) {
    success('{"value":"ok"}');
  } else success("not-json");
} else if (mode === "tripwire-repeat") {
  if (provider === "cursor") emit({ type: "tool_call", subtype: "started" });
  else if (provider === "claude") {
    emit({ type: "assistant", message: { model, content: [{ type: "tool_use", name: "Read" }] } });
  } else if (provider === "gemini" || provider === "qwen" || provider === "copilot") {
    emit({ type: "tool_call", tool_name: "read_file", model });
  } else emit({ type: "item.completed", item: { type: "command_execution" } });
} else if (mode === "capture-isolation") {
  if (marker) {
    writeFileSync(
      marker,
      JSON.stringify({
        cwd: process.cwd(),
        cwdEntries: readdirSync(process.cwd()),
        promptStart: prompt.slice(0, 80),
        reinforced: prompt.includes("再次强调")
      }),
      "utf8"
    );
  }
  success('{"value":"ok"}');
} else {
  success(setupText ?? "ok");
}
