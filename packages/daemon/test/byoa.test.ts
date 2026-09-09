// §12-9 1.2b 子集:buildCageArgv 快照 + cursor 六类 golden + tripwire + observedModel 族断言 + billing-switch 收据。

import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CAGE_LEVELS, buildCageArgv } from "../src/providers/byoa/cage.js";
import {
  parseClaudeLine,
  parseCodexLine,
  parseCopilotLine,
  parseCursorLine,
  parseGeminiLikeLine,
  parseGrokLine,
  parsePlaintextBlock,
  parseStructuredOutput,
  parserFor
} from "../src/providers/byoa/parsers.js";
import { GEMINI_DENY_POLICY, prepareIsolatedHome } from "../src/providers/byoa/isolatedHome.js";
import { consumeByoaEvents } from "../src/providers/byoa/consume.js";
import { BillingSwitchStore, isCliSubscriptionRateLimit, isSubscriptionRateLimited } from "../src/providers/byoa/billing.js";
import { familyFromModelName } from "../src/config/family.js";
import { CURSOR_GOLDEN, CURSOR_THINKING_SAMPLES } from "./fixtures/cursor-golden.js";
import {
  abortAllByoaInvocations,
  assertByoaShutdownAllowsStopped,
  buildBoundedPrompt,
  createByoaProvider,
  resetByoaProviderForTests
} from "../src/providers/byoa/provider.js";
import {
  ByoaConcurrencyLimiter,
  getByoaLifecycleContamination,
  runSpawnTurn
} from "../src/providers/byoa/runner.js";
import { ProcessGroupLifecycleError } from "../src/processGroupLifecycle.js";
import { formatSayDoJobName } from "@saydo/platform";
import {
  beginRuntimeChild,
  configureRuntimeChildRegistry,
  installRuntimeJobForTests,
  RUNTIME_DRAIN_DEADLINE_MS,
  resetRuntimeChildLifecycleForTests,
  runtimeChildOwnerIdentity,
  runtimeChildRecordPath,
  runtimeGenerationIsCurrent,
  setRuntimeChildTestHooks,
  signalRuntimeChildGeneration,
  type SpawnedRuntimeChild
} from "../src/runtimeChildRegistry.js";

const familyOf = (m: string) => familyFromModelName(m);

describe("buildCageArgv 参数集合快照(09 §11 规则 4)", () => {
  it("codex:read-only + ignore-user-config/rules + web_search=false + reasoning 映射(B9)", () => {
    const a = buildCageArgv({ provider: "codex_cli", cwd: "/tmp/c", model: "gpt-5.6-luna", reasoning: "max" });
    expect(a.bin).toBe("codex");
    expect(a.args).toEqual([
      "exec", "--json", "--ignore-user-config", "--ignore-rules", "-s", "read-only", "--ephemeral",
      "--skip-git-repo-check", "-c", "tools.web_search=false", "-c", "model_reasoning_effort=max", "-C", "/tmp/c", "-m", "gpt-5.6-luna"
    ]);
  });
  it("claude:tools 空集 + safe-mode + strict-mcp + dontAsk + no-session-persistence", () => {
    const a = buildCageArgv({ provider: "claude_cli", cwd: "/tmp/c", model: "claude-sonnet-5" });
    expect(a.bin).toBe("claude");
    expect(a.args).toContain("--safe-mode");
    expect(a.args).toContain("--strict-mcp-config");
    expect(a.args).toContain("--no-session-persistence");
    const ti = a.args.indexOf("--tools");
    expect(a.args[ti + 1]).toBe(""); // 零工具
  });
  it("claude schema:切 json envelope 并传内联 schema", () => {
    const schemaJson = '{"type":"object"}';
    const a = buildCageArgv({
      provider: "claude_cli",
      cwd: "/tmp/c",
      model: "claude-sonnet-5",
      outputSchemaJson: schemaJson
    });
    expect(a.args.slice(a.args.indexOf("--output-format"), a.args.indexOf("--output-format") + 2)).toEqual([
      "--output-format",
      "json"
    ]);
    expect(a.args).not.toContain("--verbose");
    expect(a.args.slice(a.args.indexOf("--json-schema"), a.args.indexOf("--json-schema") + 2)).toEqual([
      "--json-schema",
      schemaJson
    ]);
  });
  it("claude schema 只消费 structured_output,不信任普通 result 文本", () => {
    expect(
      parseClaudeLine(
        JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
          result: "这不是结构化结果",
          structured_output: { ok: true }
        }),
        true
      )
    ).toMatchObject({ kind: "result", text: '{"ok":true}' });
    expect(
      parseClaudeLine(
        JSON.stringify({ type: "result", subtype: "success", is_error: false, result: '{"ok":true}' }),
        true
      )
    ).toMatchObject({ kind: "unknown" });
  });
  it("claude 未知 content block fail-closed;system 通知家族改 ignore", () => {
    expect(parseClaudeLine(JSON.stringify({ type: "system", subtype: "future_security_event" }))).toMatchObject({
      kind: "ignore"
    });
    expect(
      parseClaudeLine(
        JSON.stringify({ type: "assistant", message: { content: [{ type: "future_block", value: "x" }] } })
      )
    ).toMatchObject({ kind: "unknown" });
  });
  it("claude 奠基只读例外:--tools Read,Glob,Grep", () => {
    const a = buildCageArgv({ provider: "claude_cli", cwd: "/repo", model: "claude-sonnet-5", readonlyFoundation: true });
    const ti = a.args.indexOf("--tools");
    expect(a.args[ti + 1]).toBe("Read,Glob,Grep");
  });
  it("cursor:-p + mode ask + trust + stream-json(无零工具旗标,最弱档)", () => {
    const a = buildCageArgv({ provider: "cursor_cli", cwd: "/tmp/c", model: "claude-fable-5-max" });
    expect(a.bin).toBe("cursor-agent");
    expect(a.args).toEqual(["-p", "--output-format", "stream-json", "--mode", "ask", "--trust", "--model", "claude-fable-5-max"]);
  });
  it("grok:prompt-file + tools 空集 + streaming-json + max-turns 1(tool-deny)", () => {
    const a = buildCageArgv({
      provider: "grok_cli",
      cwd: "/tmp/c",
      model: "grok-4.5",
      promptFile: "/tmp/prompt.txt",
      outputSchemaJson: '{"type":"object"}'
    });
    expect(a.bin).toBe("grok");
    expect(a.args).toEqual([
      "--prompt-file",
      "/tmp/prompt.txt",
      "--output-format",
      "streaming-json",
      "--permission-mode",
      "dontAsk",
      "--tools",
      "",
      "--disable-web-search",
      "--no-subagents",
      "--no-plan",
      "--max-turns",
      "1",
      "-m",
      "grok-4.5",
      "--json-schema",
      '{"type":"object"}'
    ]);
  });
  it("grok 缺 promptFile 拒构造", () => {
    expect(() => buildCageArgv({ provider: "grok_cli", cwd: "/tmp/c" })).toThrow(/promptFile/);
  });
  it("gemini:plan + admin-policy deny + 空 extensions/MCP + -p 空串", () => {
    const a = buildCageArgv({
      provider: "gemini_cli",
      cwd: "/tmp/c",
      model: "gemini-2.5-pro",
      policyFile: "/tmp/home/.gemini/policies/saydo-deny.toml"
    });
    expect(a.bin).toBe("gemini");
    expect(a.args).toContain("--approval-mode");
    expect(a.args).toContain("plan");
    expect(a.args).toContain("--admin-policy");
    expect(a.args).toContain("--skip-trust");
    expect(a.args).not.toContain("--allowed-mcp-server-names");
    expect(a.args.slice(-2)).toEqual(["-p", ""]);
  });
  it("gemini 缺 policyFile 拒构造", () => {
    expect(() => buildCageArgv({ provider: "gemini_cli", cwd: "/tmp/c" })).toThrow(/policyFile/);
  });
  it("qwen:max-tool-calls 0 + exclude-tools + bare + plan", () => {
    const a = buildCageArgv({ provider: "qwen_cli", cwd: "/tmp/c", model: "qwen3-coder-plus" });
    expect(a.bin).toBe("qwen");
    expect(a.args).toContain("--bare");
    expect(a.args).toContain("--max-tool-calls");
    expect(a.args[a.args.indexOf("--max-tool-calls") + 1]).toBe("0");
    expect(a.args).toContain("--exclude-tools");
    expect(a.args).toContain("run_shell_command");
    const withAuth = buildCageArgv({
      provider: "qwen_cli",
      cwd: "/tmp/c",
      model: "qwen3-coder-plus",
      authType: "openai"
    });
    expect(withAuth.args.slice(withAuth.args.indexOf("--auth-type"), withAuth.args.indexOf("--auth-type") + 2)).toEqual([
      "--auth-type",
      "openai"
    ]);
    expect(a.args.slice(-2)).toEqual(["-p", ""]);
  });
  it("copilot:空 available-tools + 关 MCP + -p 空串", () => {
    const a = buildCageArgv({ provider: "copilot_cli", cwd: "/tmp/c", model: "gpt-5.2" });
    expect(a.bin).toBe("copilot");
    expect(a.args).toContain("--available-tools");
    expect(a.args).toContain("--disable-builtin-mcps");
    expect(a.args).toContain("--no-custom-instructions");
    expect(a.args.slice(-2)).toEqual(["-p", ""]);
  });
});

describe("CAGE_LEVELS 分档单源(GAP-02 2.9;07 D18 纪律 1)", () => {
  it("四家老 CLI 的档位与 argv 对应;enforcement 只有 ask+tripwire 是 partial", () => {
    expect(CAGE_LEVELS.claude_cli).toEqual({ level: "tool-deny", enforcement: "full" });
    const claude = buildCageArgv({ provider: "claude_cli", cwd: "/tmp/c" });
    expect(claude.args.slice(claude.args.indexOf("--tools"), claude.args.indexOf("--tools") + 2)).toEqual(["--tools", ""]);

    expect(CAGE_LEVELS.grok_cli).toEqual({ level: "tool-deny", enforcement: "full" });
    const grok = buildCageArgv({ provider: "grok_cli", cwd: "/tmp/c", promptFile: "/tmp/p" });
    expect(grok.args.slice(grok.args.indexOf("--tools"), grok.args.indexOf("--tools") + 2)).toEqual(["--tools", ""]);

    expect(CAGE_LEVELS.codex_cli).toEqual({ level: "write-sandbox", enforcement: "full" });
    const codex = buildCageArgv({ provider: "codex_cli", cwd: "/tmp/c" });
    expect(codex.args.slice(codex.args.indexOf("-s"), codex.args.indexOf("-s") + 2)).toEqual(["-s", "read-only"]);

    expect(CAGE_LEVELS.cursor_cli).toEqual({ level: "ask+tripwire", enforcement: "partial" });
    const cursor = buildCageArgv({ provider: "cursor_cli", cwd: "/tmp/c" });
    expect(cursor.args).toContain("--mode");
    expect(cursor.args).toContain("ask");
    for (const forbidden of ["-f", "--force", "--yolo"]) expect(cursor.args).not.toContain(forbidden);
  });

  it("七家全部登记;partial 只有 cursor", () => {
    const providers = Object.keys(CAGE_LEVELS).sort();
    expect(providers).toEqual(["claude_cli", "codex_cli", "copilot_cli", "cursor_cli", "gemini_cli", "grok_cli", "qwen_cli"]);
    const partial = providers.filter((p) => CAGE_LEVELS[p as keyof typeof CAGE_LEVELS].enforcement === "partial");
    expect(partial).toEqual(["cursor_cli"]);
  });
});

describe("parseGrokLine", () => {
  it("拼接 text 分片,end.modelUsage 作 observedModel,structuredOutput 作 result", async () => {
    const { parseGrokLine } = await import("../src/providers/byoa/parsers.js");
    expect(parseGrokLine(JSON.stringify({ type: "thought", data: "..." }))).toMatchObject({ kind: "ignore" });
    expect(parseGrokLine(JSON.stringify({ type: "thought", subtype: "delta", data: "内心独白分片" }))).toMatchObject({
      kind: "ignore"
    });
    expect(parseGrokLine(JSON.stringify({ type: "thought", subtype: "completed" }))).toMatchObject({ kind: "ignore" });
    expect(parseGrokLine(JSON.stringify({ type: "text", data: "po" }))).toMatchObject({ kind: "text", text: "po" });
    expect(parseGrokLine(JSON.stringify({ type: "tool_call", toolName: "bash" }))).toMatchObject({
      kind: "tool_call",
      toolName: "bash"
    });
    expect(
      parseGrokLine(
        JSON.stringify({
          type: "end",
          stopReason: "end_turn",
          modelUsage: { "grok-4.5-build": { inputTokens: 1 } },
          structuredOutput: { reply: "pong" }
        })
      )
    ).toMatchObject({
      kind: "result",
      text: '{"reply":"pong"}',
      observedModel: "grok-4.5-build"
    });
  });
  it("end cancelled 无 structured ⇒ unknown(作废)", async () => {
    const { parseGrokLine } = await import("../src/providers/byoa/parsers.js");
    expect(
      parseGrokLine(JSON.stringify({ type: "end", stopReason: "cancelled", modelUsage: { "grok-4.5": {} } }))
    ).toMatchObject({ kind: "unknown", observedModel: "grok-4.5" });
  });
  it("text 分片 + end 无 structured 时 consume 保留拼接正文", async () => {
    const { parseGrokLine } = await import("../src/providers/byoa/parsers.js");
    const { consumeByoaEvents } = await import("../src/providers/byoa/consume.js");
    const events = [
      parseGrokLine(JSON.stringify({ type: "text", data: "po" })),
      parseGrokLine(JSON.stringify({ type: "text", data: "ng" })),
      parseGrokLine(
        JSON.stringify({ type: "end", stopReason: "end_turn", modelUsage: { "grok-4.5-build": {} } })
      )
    ];
    const out = consumeByoaEvents(events, {
      expectedFamily: "grok",
      familyOf,
      requireObservedModel: true,
      requireTerminalResult: true
    });
    expect(out).toMatchObject({
      ok: true,
      text: "pong",
      observedModel: "grok-4.5-build",
      observedModelSource: "stream",
      observedModelExempted: false
    });
  });
});

describe("BYOA prompt cap", () => {
  it("按历史→Context Pack 截断并保住 instructions 与当前请求", () => {
    const prompt = buildBoundedPrompt(
      [
        { role: "system", content: `必须保留的 instructions\n\n[Context Pack]\n${"背景".repeat(200)}` },
        { role: "user", content: `最旧历史${"旧".repeat(200)}` },
        { role: "assistant", content: `较新历史${"中".repeat(100)}` },
        { role: "user", content: "当前请求" }
      ],
      180
    );
    expect(prompt).not.toBeNull();
    expect(prompt).toContain("必须保留的 instructions");
    expect(prompt).toContain("当前请求");
    expect(prompt).not.toContain("最旧历史");
    expect(Buffer.byteLength(prompt!)).toBeLessThanOrEqual(180);

    const emojiPrompt = buildBoundedPrompt(
      [
        { role: "system", content: "I\n\n[Context Pack]\n\uD840\uDC00" },
        { role: "user", content: "U" }
      ],
      40
    );
    expect(emojiPrompt).not.toBeNull();
    expect(Buffer.from(emojiPrompt!, "utf8").toString("utf8")).toBe(emojiPrompt);
  });

  it("instructions 与当前请求自身超限时拒绝,不静默截断", () => {
    expect(
      buildBoundedPrompt(
        [
          { role: "system", content: "不可截断".repeat(100) },
          { role: "user", content: "当前请求" }
        ],
        64
      )
    ).toBeNull();
  });

  it("没有 system 消息时先丢最旧历史并保住当前请求", () => {
    const prompt = buildBoundedPrompt(
      [
        { role: "user", content: `最旧请求${"旧".repeat(100)}` },
        { role: "assistant", content: `历史回答${"中".repeat(100)}` },
        { role: "user", content: "当前请求" }
      ],
      32
    );
    expect(prompt).toBe("[user]\n当前请求");
  });
});

describe("cursor 六类 golden(复评 A3:未知/解析异常 fail-closed 作废)", () => {
  const opts = { expectedFamily: "claude", familyOf };

  it("读/写/shell/MCP:tool_call 命中 => tripwire 作废", () => {
    for (const key of ["readFile", "writeFile", "shell", "mcp"] as const) {
      const events = CURSOR_GOLDEN[key].map(parseCursorLine);
      const r = consumeByoaEvents(events, opts);
      expect(r.ok, key).toBe(false);
      expect(r.voidReason, key).toBe("tripwire");
      expect(r.toolCallCount, key).toBeGreaterThanOrEqual(1);
    }
  });

  it("未知事件 => 作废(unknown_event)", () => {
    const events = CURSOR_GOLDEN.unknown.map(parseCursorLine);
    const r = consumeByoaEvents(events, opts);
    expect(r.ok).toBe(false);
    expect(r.voidReason).toBe("unknown_event");
  });

  it("解析异常 => 作废(parse_error)", () => {
    const events = CURSOR_GOLDEN.parseError.map(parseCursorLine);
    const r = consumeByoaEvents(events, opts);
    expect(r.ok).toBe(false);
    expect(r.voidReason).toBe("parse_error");
  });

  it("干净文本(无工具,族匹配)=> 通过;model 来自 system.init", () => {
    const events = CURSOR_GOLDEN.clean.map(parseCursorLine);
    const r = consumeByoaEvents(events, opts);
    expect(r.ok).toBe(true);
    expect(r.text).toContain("方案是这样的");
    expect(r.observedModel).toBe("claude-fable-5"); // 实测:cursor model 在 system.init 顶层
    expect(r.toolCallCount).toBe(0);
  });

  it("system/user 元事件被忽略不作废(ignore)", () => {
    expect(parseCursorLine(JSON.stringify({ type: "system", subtype: "init" })).kind).toBe("ignore");
    expect(parseCursorLine(JSON.stringify({ type: "system", model: "claude-fable-5" })).kind).toBe("ignore");
    expect(parseCursorLine(JSON.stringify({ type: "result", result: "x" })).kind).toBe("unknown");
    expect(parseCursorLine(JSON.stringify({ type: "user", message: {} })).kind).toBe("ignore");
  });

  it("connection/retry 任意 subtype 按网络层噪音 ignore", () => {
    expect(parseCursorLine(JSON.stringify({ type: "connection", subtype: "reconnecting" })).kind).toBe("ignore");
    expect(parseCursorLine(JSON.stringify({ type: "retry", subtype: "starting" })).kind).toBe("ignore");
    expect(parseCursorLine(JSON.stringify({ type: "connection", subtype: "reconnected" })).kind).toBe("ignore");
    expect(parseCursorLine(JSON.stringify({ type: "retry", subtype: "anything-future" })).kind).toBe("ignore");
  });

  it("thinking.delta/completed 真实样本一律 ignore,不消费内心独白", () => {
    for (const line of CURSOR_THINKING_SAMPLES) {
      expect(parseCursorLine(line)).toMatchObject({ kind: "ignore", raw: line });
    }
    const leaked = CURSOR_THINKING_SAMPLES.map(parseCursorLine).some((ev) => ev.text);
    expect(leaked).toBe(false);
  });

  it("完整 thinking 流(system/user/thinking×N/assistant/result)正常产出正文", () => {
    const events = CURSOR_GOLDEN.thinkingStream.map(parseCursorLine);
    expect(events.map((ev) => ev.kind)).toEqual([
      "observed_model",
      "ignore",
      "ignore",
      "ignore",
      "ignore",
      "text",
      "result"
    ]);
    const r = consumeByoaEvents(events, { expectedFamily: "grok", familyOf });
    expect(r.ok).toBe(true);
    expect(r.text).toBe("方案是这样的");
    expect(r.text).not.toContain("先想一下怎么答");
    expect(r.text).not.toContain("再补一句独白");
    expect(r.observedModel).toBe("cursor-grok-4.6-high-fast");
    expect(r.toolCallCount).toBe(0);
    expect(r.voidReason).toBeUndefined();
  });

  it("真实 cursor 全流(显示名+网络重连)整流产出正文,不触发 safetyStop", () => {
    const raw = readFileSync(
      join(fileURLToPath(new URL("./fixtures", import.meta.url)), "cursor-full-stream.ndjson"),
      "utf8"
    );
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const events = lines.map(parseCursorLine);
    const safetyStops = events
      .map((event) => {
        if (event.observedModel && familyOf(event.observedModel) !== "grok") return "family_mismatch" as const;
        if (event.kind === "tool_call") return "tripwire" as const;
        if (event.kind === "unknown") return "unknown_event" as const;
        if (event.kind === "parse_error") return "parse_error" as const;
        return undefined;
      })
      .filter((reason) => reason !== undefined);
    expect(safetyStops).toEqual([]);
    expect(events.map((ev) => ev.kind)).toEqual([
      "observed_model",
      "ignore",
      "ignore",
      "ignore",
      "ignore",
      "ignore",
      "ignore",
      "ignore",
      "text",
      "result"
    ]);
    const r = consumeByoaEvents(events, { expectedFamily: "grok", familyOf });
    expect(r.ok).toBe(true);
    expect(r.text).toBe("这是一句纯文本，用于确认 setup thinking self-test 已通过。");
    expect(r.observedModel).toBe("Cursor Grok 4.6 High Fast");
    expect(r.toolCallCount).toBe(0);
    expect(r.voidReason).toBeUndefined();
  });

  it("cursor assistant 未知 block 与畸形 model/text 字段 fail-closed", () => {
    expect(
      parseCursorLine(
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "ok" }, { type: "tool_use", name: "Read" }] }
        })
      ).kind
    ).toBe("unknown");
    expect(parseCursorLine(JSON.stringify({ type: "system", subtype: "init", model: {} })).kind).toBe("parse_error");
    expect(parseCursorLine(JSON.stringify({ type: "system", subtype: "init", model: "" })).kind).toBe("parse_error");
    expect(
      parseCursorLine(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: {} }] } })).kind
    ).toBe("unknown");
  });
});

describe("observedModel 族断言(09 §11 规则 2,严格口径)", () => {
  it("codex 未知 item 生命周期与类型 fail-closed,不按前缀放行", () => {
    expect(parseCodexLine(JSON.stringify({ type: "item.future", item: { type: "future_tool" } })).kind).toBe("unknown");
    expect(parseCodexLine(JSON.stringify({ type: "item.completed", item: { type: "future_tool" } })).kind).toBe("unknown");
    expect(parseCodexLine(JSON.stringify({ type: "turn.failed", error: {} })).kind).toBe("unknown");
    expect(parseCodexLine(JSON.stringify({ type: "error", message: "stream error: broken pipe" })).kind).toBe("unknown");
    expect(parseCodexLine(JSON.stringify({ type: "item.completed", item: { type: "web_search_call" } })).kind).toBe(
      "tool_call"
    );
  });

  it("codex 文档证实的无害元事件 ignore:todo_list/plan_update/reconnect error/item.updated reasoning", () => {
    expect(
      parseCodexLine(
        JSON.stringify({
          type: "item.updated",
          item: { id: "item_8", type: "todo_list", items: [{ text: "Scan docs", completed: false }] }
        })
      ).kind
    ).toBe("ignore");
    expect(
      parseCodexLine(JSON.stringify({ type: "item.started", item: { id: "item_8", type: "todo_list", items: [] } })).kind
    ).toBe("ignore");
    expect(
      parseCodexLine(JSON.stringify({ type: "item.completed", item: { id: "p1", type: "plan_update" } })).kind
    ).toBe("ignore");
    expect(parseCodexLine(JSON.stringify({ type: "error", message: "Reconnecting... 1/5" })).kind).toBe("ignore");
    expect(
      parseCodexLine(JSON.stringify({ type: "item.updated", item: { id: "r1", type: "reasoning", text: "thinking" } }))
        .kind
    ).toBe("ignore");
  });

  it("codex rate_limit_event 通知 ignore,不把整轮作废,也不冒充订阅限流", () => {
    // v3.8 触发行前缀 {"type":"rate_limit_event","rate_limit_info":{"status":"all…(截断);
    // 补全为 allowed(status 以 all 开头的已知通知态)。真失败仍是 turn.failed。
    const notice = readFileSync(
      join(fileURLToPath(new URL("./fixtures", import.meta.url)), "codex-rate-limit-event.jsonl"),
      "utf8"
    )
      .split("\n")
      .find((row) => row.trim())!;
    expect(notice.startsWith('{"type":"rate_limit_event","rate_limit_info":{"status":"all')).toBe(true);
    expect(parseCodexLine(notice).kind).toBe("ignore");
    expect(parseCodexLine(JSON.stringify({ type: "turn.failed", error: {} })).kind).toBe("unknown");
    const events = [
      JSON.stringify({ type: "thread.started", thread_id: "t1" }),
      notice,
      JSON.stringify({ type: "item.completed", item: { id: "i0", type: "agent_message", text: "能听到。" } }),
      JSON.stringify({ type: "turn.completed" })
    ].map(parseCodexLine);
    expect(
      consumeByoaEvents(events, {
        expectedFamily: "gpt",
        familyOf,
        familyFixed: true,
        verifiedBinaryDefault: true,
        verifiedBinaryDefaultModel: "gpt-5.6-luna",
        requireTerminalResult: true
      })
    ).toMatchObject({ ok: true, text: "能听到。" });
    expect(isCliSubscriptionRateLimit("codex_cli", { stderrTail: "", lines: [notice], exitCode: 0 })).toBe(false);
    expect(
      isCliSubscriptionRateLimit("codex_cli", {
        stderrTail: "",
        lines: [notice, JSON.stringify({ type: "turn.failed", error: { message: "usage limit reached" } })],
        exitCode: 1
      })
    ).toBe(true);
  });

  it("claude rate_limit_event 通知 ignore,不把整轮作废,也不冒充订阅限流", () => {
    // v3.8 击杀日志(provider=claude_cli slot=thinking)真实行;uuid/session_id 脱敏。
    const notice = readFileSync(
      join(fileURLToPath(new URL("./fixtures", import.meta.url)), "claude-rate-limit-event.jsonl"),
      "utf8"
    )
      .split("\n")
      .find((row) => row.trim())!;
    expect(notice.startsWith('{"type":"rate_limit_event","rate_limit_info":{"status":"allowed"')).toBe(true);
    expect(parseClaudeLine(notice).kind).toBe("ignore");
    const events = [
      JSON.stringify({ type: "system", subtype: "init" }),
      notice,
      JSON.stringify({
        type: "assistant",
        message: { model: "claude-sonnet-5", content: [{ type: "text", text: "能听到。" }] }
      }),
      JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "能听到。" })
    ].map((line) => parseClaudeLine(line));
    expect(
      consumeByoaEvents(events, {
        expectedFamily: "claude",
        familyOf,
        requireTerminalResult: true
      })
    ).toMatchObject({ ok: true, text: "能听到。", observedModel: "claude-sonnet-5" });
    expect(isCliSubscriptionRateLimit("claude_cli", { stderrTail: "", lines: [notice], exitCode: 0 })).toBe(false);
    expect(
      isCliSubscriptionRateLimit("claude_cli", {
        stderrTail: "",
        lines: [
          notice,
          JSON.stringify({
            type: "result",
            subtype: "error",
            is_error: true,
            error: { message: "usage limit reached" }
          })
        ],
        exitCode: 1
      })
    ).toBe(true);
  });

  it("claude/cursor system 通知家族(含 model_refusal_fallback)ignore,不把整轮作废", () => {
    // v3.8f 击杀日志(provider=claude_cli)真实行;源行在 original_model 处截断,fixture 只闭合 JSON,不编造 session 字段。
    const notice = readFileSync(
      join(fileURLToPath(new URL("./fixtures", import.meta.url)), "claude-model-refusal-fallback.jsonl"),
      "utf8"
    )
      .split("\n")
      .find((row) => row.trim())!;
    expect(notice.startsWith('{"type":"system","subtype":"model_refusal_fallback","trigger":"refusal"')).toBe(true);
    expect(parseClaudeLine(notice).kind).toBe("ignore");
    expect(parseCursorLine(notice).kind).toBe("ignore");
    expect(parseClaudeLine(JSON.stringify({ type: "system", subtype: "future_security_event" })).kind).toBe("ignore");
    expect(parseCursorLine(JSON.stringify({ type: "system", subtype: "future_notice" })).kind).toBe("ignore");
    const events = [
      JSON.stringify({ type: "system", subtype: "init" }),
      notice,
      JSON.stringify({
        type: "assistant",
        message: { model: "claude-sonnet-5", content: [{ type: "text", text: "能听到。" }] }
      }),
      JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "能听到。" })
    ].map((line) => parseClaudeLine(line));
    expect(
      consumeByoaEvents(events, {
        expectedFamily: "claude",
        familyOf,
        requireTerminalResult: true
      })
    ).toMatchObject({ ok: true, text: "能听到。", observedModel: "claude-sonnet-5" });
  });

  it("rate_limit_event 全家 ignore(codex/claude 双实证,其余家预防)", () => {
    const notice = readFileSync(
      join(fileURLToPath(new URL("./fixtures", import.meta.url)), "claude-rate-limit-event.jsonl"),
      "utf8"
    )
      .split("\n")
      .find((row) => row.trim())!;
    expect(parseCodexLine(notice).kind).toBe("ignore");
    expect(parseClaudeLine(notice).kind).toBe("ignore");
    expect(parseCursorLine(notice).kind).toBe("ignore");
    expect(parseGrokLine(notice).kind).toBe("ignore");
    expect(parseGeminiLikeLine(notice).kind).toBe("ignore");
    expect(parseCopilotLine(notice).kind).toBe("ignore");
  });

  it("codex 已知元事件携带异族 model 时按 stream 证据作废,不得吃固定族豁免", () => {
    const events = [
      JSON.stringify({ type: "thread.started", thread_id: "t", model: "claude-sonnet-5" }),
      JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "must-not-pass" } }),
      JSON.stringify({ type: "turn.completed" })
    ].map(parseCodexLine);
    expect(events[0]).toMatchObject({ kind: "ignore", observedModel: "claude-sonnet-5" });
    expect(
      consumeByoaEvents(events, {
        expectedFamily: "gpt",
        familyOf,
        familyFixed: true,
        verifiedBinaryDefault: true,
        requireTerminalResult: true
      })
    ).toMatchObject({ ok: false, voidReason: "family_mismatch", observedModelSource: "stream" });
  });

  it("claude fallback 降级块产出 observed_model,后续 text 仍可消费", () => {
    // v3.8e 击杀日志:Claude CLI 把 fable-5 自动降级 opus-4-8。源行在 service_tier 处截断,
    // fixture 只闭合 JSON,不编造 session 字段;语义块(fallback from/to + message.model)保持原样。
    const fallbackLine = readFileSync(
      join(fileURLToPath(new URL("./fixtures", import.meta.url)), "claude-fallback-event.jsonl"),
      "utf8"
    )
      .split("\n")
      .find((row) => row.trim())!;
    const fallbackEvent = parseClaudeLine(fallbackLine);
    expect(fallbackEvent).toMatchObject({ kind: "observed_model", observedModel: "claude-opus-4-8" });
    expect(fallbackEvent.text).toBeUndefined();

    const events = [
      fallbackLine,
      JSON.stringify({
        type: "assistant",
        message: { model: "claude-opus-4-8", content: [{ type: "text", text: "能听到。" }] }
      }),
      JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "能听到。" })
    ].map((line) => parseClaudeLine(line));
    expect(events[1]).toMatchObject({ kind: "observed_model", observedModel: "claude-opus-4-8", text: "能听到。" });
    expect(
      consumeByoaEvents(events, {
        expectedFamily: "claude",
        familyOf,
        requestedModel: "claude-fable-5",
        requireTerminalResult: true
      })
    ).toMatchObject({
      ok: true,
      text: "能听到。",
      observedModel: "claude-opus-4-8",
      requestedModel: "claude-fable-5",
      note: "CLI 将 claude-fable-5 降级为 claude-opus-4-8(通常是订阅限流),同族仍生效"
    });
  });

  it("claude fallback 异族 to.model 走 family_mismatch,不得放行", () => {
    const event = parseClaudeLine(
      JSON.stringify({
        type: "assistant",
        message: {
          model: "claude-fable-5",
          content: [{ type: "fallback", from: { model: "claude-fable-5" }, to: { model: "gpt-5.6-luna" } }]
        }
      })
    );
    expect(event).toMatchObject({ kind: "observed_model", observedModel: "gpt-5.6-luna" });
    expect(
      consumeByoaEvents(
        [
          event,
          parseClaudeLine(
            JSON.stringify({
              type: "assistant",
              message: { model: "gpt-5.6-luna", content: [{ type: "text", text: "must-not-pass" }] }
            })
          ),
          parseClaudeLine(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "must-not-pass" }))
        ],
        { expectedFamily: "claude", familyOf, requestedModel: "claude-fable-5", requireTerminalResult: true }
      )
    ).toMatchObject({ ok: false, voidReason: "family_mismatch", observedModel: "gpt-5.6-luna" });
  });

  it("claude thinking 块 skip;仅 thinking 且无 model 则 ignore;未知块仍 fail-closed", () => {
    expect(
      parseClaudeLine(
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "thinking", thinking: "内部草稿" }, { type: "text", text: "正文" }] }
        })
      )
    ).toMatchObject({ kind: "text", text: "正文" });
    expect(
      parseClaudeLine(
        JSON.stringify({ type: "assistant", message: { content: [{ type: "thinking", thinking: "内部草稿" }] } })
      )
    ).toMatchObject({ kind: "ignore" });
    expect(
      parseClaudeLine(
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "fallback", from: { model: "claude-fable-5" }, to: {} }] }
        })
      )
    ).toMatchObject({ kind: "unknown" });
  });

  it("Claude 同事件的正文、model 与 tool_use 都保留,不得误判为零消费", () => {
    const event = parseClaudeLine(
      JSON.stringify({
        type: "assistant",
        message: {
          model: "claude-sonnet-5",
          content: [{ type: "text", text: "already-consumed" }, { type: "tool_use", name: "Read" }]
        }
      })
    );
    expect(event).toMatchObject({
      kind: "tool_call",
      text: "already-consumed",
      observedModel: "claude-sonnet-5"
    });
    expect(consumeByoaEvents([event], { expectedFamily: "claude", familyOf })).toMatchObject({
      ok: false,
      voidReason: "tripwire",
      hadConsumableOutput: true
    });
  });

  it("claude 裸 result 无 type:is_error 终态透传,false 收敛为成功 result", () => {
    const fixture = readFileSync(
      join(fileURLToPath(new URL("./fixtures", import.meta.url)), "claude-noType-result.jsonl"),
      "utf8"
    )
      .split("\n")
      .find((row) => row.trim())!;
    expect(fixture.includes('"type"')).toBe(false);
    expect(JSON.parse(fixture)).toMatchObject({ is_error: true, duration_api_ms: 2272, num_turns: 2 });
    const failed = parseClaudeLine(fixture);
    expect(failed).toMatchObject({
      kind: "error",
      text: "CLI 返回错误终态(通常是用量受限或拒答),num_turns=2"
    });
    expect(
      consumeByoaEvents([failed], { expectedFamily: "claude", familyOf, requireTerminalResult: true })
    ).toMatchObject({
      ok: false,
      voidReason: "cli_error",
      errorMessage: "CLI 返回错误终态(通常是用量受限或拒答),num_turns=2"
    });
    expect(parseCursorLine(fixture).kind).toBe("unknown");
    expect(parseClaudeLine(JSON.stringify({ is_error: true })).kind).toBe("unknown");
    expect(
      parseClaudeLine(JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "拒答" }))
    ).toMatchObject({ kind: "error", text: "拒答" });

    const withText = parseClaudeLine(
      JSON.stringify({
        is_error: true,
        num_turns: 1,
        usage: { output_tokens: 0 },
        result: "You've hit your usage limit"
      })
    );
    expect(withText).toMatchObject({ kind: "error", text: "You've hit your usage limit" });
    expect(
      consumeByoaEvents([withText], { expectedFamily: "claude", familyOf, requireTerminalResult: true }).voidReason
    ).toBe("cli_error");

    const okBare = parseClaudeLine(
      JSON.stringify({ is_error: false, num_turns: 1, result: "能听到。", usage: { output_tokens: 4 } })
    );
    expect(okBare).toMatchObject({ kind: "result", text: "能听到。" });
    expect(
      consumeByoaEvents(
        [
          parseClaudeLine(
            JSON.stringify({
              type: "assistant",
              message: { model: "claude-opus-4-8", content: [{ type: "text", text: "能听到。" }] }
            })
          ),
          okBare
        ],
        { expectedFamily: "claude", familyOf, requireTerminalResult: true }
      )
    ).toMatchObject({ ok: true, text: "能听到。", observedModel: "claude-opus-4-8" });

    expect(
      isCliSubscriptionRateLimit("claude_cli", {
        stderrTail: "",
        lines: [JSON.stringify({ is_error: true, num_turns: 1, usage: { output_tokens: 0 }, result: "usage limit reached" })],
        exitCode: 1
      })
    ).toBe(true);
    expect(
      isCliSubscriptionRateLimit("claude_cli", {
        stderrTail: "",
        lines: [fixture],
        exitCode: 1
      })
    ).toBe(false);
  });

  it("claude/codex 畸形字段 fail-closed", () => {
    expect(parseClaudeLine(JSON.stringify({ type: "result", result: "x" })).kind).toBe("unknown");
    expect(
      parseClaudeLine(
        JSON.stringify({ type: "assistant", message: { model: {}, content: [{ type: "text", text: "x" }] } })
      ).kind
    ).toBe("unknown");
    expect(
      parseClaudeLine(
        JSON.stringify({ type: "assistant", message: { model: "", content: [{ type: "text", text: "x" }] } })
      ).kind
    ).toBe("unknown");
    expect(parseCodexLine(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: {} } })).kind).toBe(
      "parse_error"
    );
  });

  it("族不符 => 作废(family_mismatch)", () => {
    const events = CURSOR_GOLDEN.clean.map(parseCursorLine); // model=claude-fable-5(claude)
    const r = consumeByoaEvents(events, { expectedFamily: "gpt", familyOf });
    expect(r.ok).toBe(false);
    expect(r.voidReason).toBe("family_mismatch");
  });
  it("cursor 缺 observedModel => 作废(observed_model_missing,严格口径)", () => {
    const events = parserFor("cursor_cli")(JSON.stringify({ type: "result", subtype: "success", result: "无 model 字段" }));
    const r = consumeByoaEvents([events], { expectedFamily: "claude", familyOf, requireObservedModel: true });
    expect(r.ok).toBe(false);
    expect(r.voidReason).toBe("observed_model_missing");
  });

  it("恒定族 provider 流内无 model:只有登记默认模型后才豁免", () => {
    // codex exec --json 实测无 model 字段:thread/turn/item(agent_message)
    const codexLines = [
      JSON.stringify({ type: "thread.started", thread_id: "t1" }),
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({ type: "item.completed", item: { id: "i0", type: "agent_message", text: "能听到。" } }),
      JSON.stringify({ type: "turn.completed", usage: { input_tokens: 10 } })
    ];
    const events = codexLines.map(parserFor("codex_cli"));
    const r = consumeByoaEvents(events, {
      expectedFamily: "gpt",
      familyOf,
      familyFixed: true,
      requestedModel: "gpt-5.6-luna",
      verifiedBinaryDefault: true,
      verifiedBinaryDefaultModel: "gpt-5.6-luna"
    });
    expect(r.ok).toBe(true);
    expect(r.text).toBe("能听到。");
    expect(r.observedModel).toBe("gpt-5.6-luna");
    expect(r.observedModelSource).toBe("verified_binary_default");
    expect(r.observedModelExempted).toBe(true);

    const unregistered = consumeByoaEvents(events, { expectedFamily: "gpt", familyOf, familyFixed: true });
    expect(unregistered).toMatchObject({ ok: false, voidReason: "observed_model_missing" });
  });

  it("评审 A3:先异族后同族 model 不翻案(逐事件族断言,不可清)", () => {
    const lines = [
      JSON.stringify({ type: "system", subtype: "init", model: "claude-sonnet-5" }), // 异族(expectedFamily=gpt)
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "x" }] } }),
      JSON.stringify({ type: "system", subtype: "init", model: "gpt-5.6-luna" }), // 后出现同族——不得翻案
      JSON.stringify({ type: "result", subtype: "success", result: "x" })
    ];
    const events = lines.map(parserFor("cursor_cli"));
    const r = consumeByoaEvents(events, { expectedFamily: "gpt", familyOf, familyFixed: true });
    expect(r.ok).toBe(false);
    expect(r.voidReason).toBe("family_mismatch");
  });

  it("恒定族 provider 若流内有 model 且族不符 => 仍作废(改写检测保留)", () => {
    const lines = [
      JSON.stringify({ type: "system", subtype: "init", model: "claude-sonnet-5" }), // 观测到 claude(但 expectedFamily=gpt)
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "x" }] } }),
      JSON.stringify({ type: "result", subtype: "success", result: "x" })
    ];
    const events = lines.map(parserFor("cursor_cli"));
    const r = consumeByoaEvents(events, { expectedFamily: "gpt", familyOf, familyFixed: true });
    expect(r.ok).toBe(false);
    expect(r.voidReason).toBe("family_mismatch");
  });
});

describe("结构化输出 schema 子集 fail-closed", () => {
  it("未实现关键字与 schema 形态 additionalProperties 不得静默放行", () => {
    expect(parseStructuredOutput('"bad"', { not: { const: "bad" } })).toMatchObject({
      ok: false,
      errors: ["$:unsupported_keyword_not"]
    });
    expect(parseStructuredOutput('"not-an-email"', { type: "string", format: "email" })).toMatchObject({
      ok: false,
      errors: ["$:unsupported_keyword_format"]
    });
    expect(
      parseStructuredOutput('{"x":1}', { type: "object", additionalProperties: { type: "number" } })
    ).toMatchObject({ ok: false, errors: ["$:unsupported_additionalProperties_schema"] });
  });
});

describe("gemini/qwen/copilot parser + 负向安全", () => {
  it("gemini-like:message 正文 + result.stats.model + tool_call tripwire", () => {
    expect(parseGeminiLikeLine(JSON.stringify({ type: "init" }))).toMatchObject({ kind: "ignore" });
    expect(
      parseGeminiLikeLine(
        JSON.stringify({ type: "system", subtype: "init", model: "qwen3.5-plus", tools: ["read_file"] })
      )
    ).toMatchObject({ kind: "ignore", observedModel: "qwen3.5-plus" });
    expect(
      parseGeminiLikeLine(JSON.stringify({ type: "message", role: "assistant", content: "pong", model: "gemini-2.5-pro" }))
    ).toMatchObject({ kind: "text", text: "pong", observedModel: "gemini-2.5-pro" });
    expect(
      parseGeminiLikeLine(
        JSON.stringify({
          type: "assistant",
          message: { model: "qwen3.5-plus", content: [{ type: "text", text: "pong" }] }
        })
      )
    ).toMatchObject({ kind: "text", text: "pong", observedModel: "qwen3.5-plus" });
    expect(
      parseGeminiLikeLine(JSON.stringify({ type: "tool_call", tool_name: "read_file" }))
    ).toMatchObject({ kind: "tool_call", toolName: "read_file" });
    expect(
      parseGeminiLikeLine(JSON.stringify({ type: "result", status: "success", stats: { model: "gemini-2.5-pro" }, result: "pong" }))
    ).toMatchObject({ kind: "result", text: "pong", observedModel: "gemini-2.5-pro" });
    expect(parseGeminiLikeLine(JSON.stringify({ type: "future_event" }))).toMatchObject({ kind: "unknown" });
  });
  it("诱导读文件的 tool_call 经 consume 作废(负向)", () => {
    const events = [
      parseGeminiLikeLine(JSON.stringify({ type: "init" })),
      parseGeminiLikeLine(JSON.stringify({ type: "tool_call", tool_name: "read_file", model: "gemini-2.5-pro" })),
      parseGeminiLikeLine(JSON.stringify({ type: "result", status: "success", result: "secret" }))
    ];
    const out = consumeByoaEvents(events, {
      expectedFamily: "gemini",
      familyOf,
      requireObservedModel: true,
      requireTerminalResult: true
    });
    expect(out.ok).toBe(false);
    expect(out.voidReason).toBe("tripwire");
    expect(out.toolCallCount).toBe(1);
  });
  it("copilot json 文本 + 未知事件 fail-closed", () => {
    expect(
      parseCopilotLine(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "ok" }] }, model: "gpt-5.2" }))
    ).toMatchObject({ kind: "text", text: "ok", observedModel: "gpt-5.2" });
    expect(parseCopilotLine(JSON.stringify({ type: "SECRET" }))).toMatchObject({ kind: "unknown" });
  });
  it("整段纯文本收敛", () => {
    const events = parsePlaintextBlock("pong");
    expect(events.map((e) => e.kind)).toEqual(["text", "result"]);
  });
  it("parserFor 分派三家", () => {
    expect(parserFor("gemini_cli")).toBe(parseGeminiLikeLine);
    expect(parserFor("qwen_cli")).toBe(parseGeminiLikeLine);
    expect(parserFor("copilot_cli")).toBe(parseCopilotLine);
  });

  it("思考类事件:gemini-like 词表已覆盖;真实样本无 thinking,copilot 无实据不臆加", () => {
    expect(parseGeminiLikeLine(JSON.stringify({ type: "thought", data: "..." }))).toMatchObject({ kind: "ignore" });
    expect(parseGeminiLikeLine(JSON.stringify({ type: "reasoning", data: "..." }))).toMatchObject({ kind: "ignore" });
    const sampleFiles = [
      "gemini-stream-sample.jsonl",
      "qwen-stream-sample.jsonl",
      "copilot-json-sample.jsonl"
    ] as const;
    const types = new Set<string>();
    for (const name of sampleFiles) {
      const text = readFileSync(join(fileURLToPath(new URL("./fixtures", import.meta.url)), name), "utf8");
      for (const line of text.split("\n").filter((row) => row.trim())) {
        const parsed = JSON.parse(line) as { type?: string };
        if (typeof parsed.type === "string") types.add(parsed.type);
      }
    }
    expect([...types].sort()).toEqual(["assistant", "init", "message", "result", "system"]);
    expect(types.has("thinking")).toBe(false);
    expect(types.has("thought")).toBe(false);
    expect(types.has("reasoning")).toBe(false);
    expect(parseCopilotLine(JSON.stringify({ type: "thinking", subtype: "delta", text: "x" }))).toMatchObject({
      kind: "unknown"
    });
  });
});

describe("隔离 HOME 注入笼配置", () => {
  it("gemini 写入 deny policy,不依赖真实 HOME", () => {
    const iso = prepareIsolatedHome("gemini_cli", "/no/such/home");
    try {
      const policy = readFileSync(join(iso.home, ".gemini", "policies", "saydo-deny.toml"), "utf8");
      expect(policy).toContain('toolName = "*"');
      expect(policy).toContain('decision = "deny"');
      expect(policy).toBe(GEMINI_DENY_POLICY);
    } finally {
      rmSync(iso.home, { recursive: true, force: true });
    }
  });
  it("qwen settings 含 maxToolCalls=0 且无 hooks", () => {
    const iso = prepareIsolatedHome("qwen_cli", "/no/such/home");
    try {
      const settings = JSON.parse(readFileSync(join(iso.home, ".qwen", "settings.json"), "utf8")) as {
        model?: { maxToolCalls?: number };
        hooks?: unknown;
      };
      expect(settings.model?.maxToolCalls).toBe(0);
      expect(settings.hooks).toBeUndefined();
    } finally {
      rmSync(iso.home, { recursive: true, force: true });
    }
  });
});

describe("billing-switch 一次性收据(09 §11 规则 5,复评 A5)", () => {
  it("限流识别 fail-fast", () => {
    expect(isSubscriptionRateLimited("subscription_rate_limited")).toBe(true);
    expect(isSubscriptionRateLimited("rate_limited")).toBe(true);
    expect(isSubscriptionRateLimited("http_5xx")).toBe(false);
  });

  it("磁盘、登录与代理限流措辞不得冒充订阅额度", () => {
    for (const provider of ["codex_cli", "claude_cli", "cursor_cli", "gemini_cli", "qwen_cli", "copilot_cli"] as const) {
      for (const stderrTail of [
        "ENOSPC: Disk quota exceeded",
        "authentication failed: login rate limit reached",
        "network proxy rate limit reached",
        "rate limit reached\nproxy connection failed",
        "usage limit reached\noauth token rejected",
        "request quota exceeded\nunauthorized",
        "rate limit reached\nauthenticate account first"
      ]) {
        expect(isCliSubscriptionRateLimit(provider, { stderrTail, lines: [], exitCode: 1 })).toBe(false);
      }
      const failureLine =
        provider === "codex_cli"
          ? JSON.stringify({ type: "turn.failed", error: { type: "authentication_error", message: "rate limit reached" } })
          : JSON.stringify({
              type: "result",
              subtype: "error",
              ...(provider === "claude_cli" ? { is_error: true } : {}),
              error: { code: "proxy_error", message: "usage limit reached" }
            });
      expect(isCliSubscriptionRateLimit(provider, { stderrTail: "", lines: [failureLine], exitCode: 1 })).toBe(false);
    }
  });

  it("结构化失败按整个 envelope 判定限流与负面语境", () => {
    for (const provider of ["codex_cli", "claude_cli", "cursor_cli"] as const) {
      const failure = (fields: Record<string, unknown>): string =>
        JSON.stringify({
          type: provider === "codex_cli" ? "turn.failed" : "result",
          ...(provider === "codex_cli" ? {} : { subtype: "error" }),
          ...(provider === "claude_cli" ? { is_error: true } : {}),
          ...fields
        });
      expect(
        isCliSubscriptionRateLimit(provider, {
          stderrTail: "",
          lines: [failure({ message: "rate limit reached", result: "authentication failed" })],
          exitCode: 1
        })
      ).toBe(false);
      expect(
        isCliSubscriptionRateLimit(provider, {
          stderrTail: "",
          lines: [failure({ result: "usage limit reached" })],
          exitCode: 1
        })
      ).toBe(true);
      for (const error of ["authentication failed", "proxy connection failed", "disk storage exhausted"]) {
        expect(
          isCliSubscriptionRateLimit(provider, {
            stderrTail: "",
            lines: [failure({ message: "rate limit reached", error })],
            exitCode: 1
          })
        ).toBe(false);
      }
    }
  });

  it("深层 failure envelope 使用显式 worklist，不因调用栈溢出而 reject", () => {
    const depth = 20_000;
    const line = `{"type":"turn.failed","error":${"[".repeat(depth)}"rate limit reached"${"]".repeat(depth)}}`;
    expect(Buffer.byteLength(line)).toBeLessThan(512 * 1024);
    expect(isCliSubscriptionRateLimit("codex_cli", { stderrTail: "", lines: [line], exitCode: 1 })).toBe(true);
  });

  it("签发 -> 单次消费 -> 二次消费拒(竞态不双扣)", () => {
    const store = new BillingSwitchStore();
    const r = store.issue({ sessionId: "ses_1", slot: "evaluator", targetEndpoint: "openrouter" });
    expect(store.hasUsable("ses_1", "evaluator")).toBe(true);
    expect(store.consume(r.id, { sessionId: "ses_1", slot: "evaluator" })).toBe(true);
    expect(store.consume(r.id, { sessionId: "ses_1", slot: "evaluator" })).toBe(false); // 单次
    expect(store.hasUsable("ses_1", "evaluator")).toBe(false);
  });

  it("绑定不符 / 过期 / 无收据 => 拒(无收据不产生 api 计费行)", () => {
    const store = new BillingSwitchStore();
    const r = store.issue({ sessionId: "ses_1", slot: "thinking", targetEndpoint: "openrouter", ttlMs: 1000 }, 1000);
    expect(store.consume(r.id, { sessionId: "ses_2", slot: "thinking" }, 1500)).toBe(false); // session 不符
    expect(store.consume(r.id, { sessionId: "ses_1", slot: "cheap" }, 1500)).toBe(false); // slot 不符
    expect(store.consume(r.id, { sessionId: "ses_1", slot: "thinking" }, 3000)).toBe(false); // 过期
    expect(store.consume("bsw_nonexistent", { sessionId: "ses_1", slot: "thinking" }, 1500)).toBe(false); // 无收据
  });
});

describe("provider invocation 记录(spawn 层不测,consume 层证据 digest 确定)", () => {
  it("evidenceDigest 对文本确定", () => {
    const a = consumeByoaEvents(CURSOR_GOLDEN.clean.map(parseCursorLine), { expectedFamily: "claude", familyOf });
    const b = consumeByoaEvents(CURSOR_GOLDEN.clean.map(parseCursorLine), { expectedFamily: "claude", familyOf });
    expect(a.evidenceDigest).toBe(b.evidenceDigest);
  });
});

describe("BYOA 有界 drain 与 pipe_failed", () => {
  const homes: string[] = [];
  afterEach(() => {
    setRuntimeChildTestHooks(null);
    try {
      resetRuntimeChildLifecycleForTests();
    } catch {
      // 污染用例由本测断言覆盖
    }
    resetByoaProviderForTests();
    for (const dir of homes) rmSync(dir, { recursive: true, force: true });
    homes.length = 0;
  });

  function virtualClock() {
    let now = 0;
    const timers: { id: number; at: number; fn: () => void }[] = [];
    let seq = 1;
    return {
      hooks: {
        now: () => now,
        setTimeout(fn: () => void, ms: number) {
          const id = seq++;
          timers.push({ id, at: now + ms, fn });
          return { id } as unknown as NodeJS.Timeout;
        },
        clearTimeout(timer: NodeJS.Timeout) {
          const id = (timer as unknown as { id: number }).id;
          const index = timers.findIndex((item) => item.id === id);
          if (index >= 0) timers.splice(index, 1);
        }
      },
      advance(ms: number) {
        now += ms;
        let progressed = true;
        while (progressed) {
          progressed = false;
          for (const timer of [...timers]) {
            if (timer.at > now) continue;
            const i = timers.indexOf(timer);
            if (i < 0) continue;
            timers.splice(i, 1);
            timer.fn();
            progressed = true;
          }
        }
      }
    };
  }

  function fakeSpawned(pid: number, home: string): SpawnedRuntimeChild {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdin = new PassThrough();
    const child = new EventEmitter() as SpawnedRuntimeChild["child"];
    child.stdout = stdout;
    child.stderr = stderr;
    child.stdin = stdin;
    Object.defineProperty(child, "pid", { value: pid });
    child.kill = () => true;
    queueMicrotask(() => child.emit("spawn"));
    const generationId = "01234567-89ab-cdef-0123-456789abcdef";
    const commandToken = `saydo-child-${generationId}`;
    const runId = `byoa-${String(pid)}`;
    const ownerInstanceId = runtimeChildOwnerIdentity().ownerInstanceId;
    const jobName = formatSayDoJobName("Local", ownerInstanceId, runId, generationId);
    const captured = installRuntimeJobForTests(pid, { name: jobName, handle: null }, {
      id: generationId,
      ownerInstanceId,
      runId,
      jobName,
      commandToken,
      binary: process.execPath,
      kind: "byoa",
      processStart: "byoa-birth"
    });
    const realLease = beginRuntimeChild(pid, process.execPath, "byoa", {
      registryHome: home,
      runId,
      commandToken,
      generation: generationId,
      jobName
    });
    return {
      child,
      commandToken,
      generation: captured,
      lease: { establish: async () => undefined, release: () => realLease.release() },
      signal: (signal) => {
        if (!runtimeGenerationIsCurrent(captured)) return;
        signalRuntimeChildGeneration(captured, signal);
      }
    };
  }

  it("alive drain deadline 有界 settle 并保留 owner", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-alive-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const clock = virtualClock();
    const spawned = fakeSpawned(51001, home);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "alive"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      wallTimeoutMs: 20,
      idleTimeoutMs: 0,
      killGraceMs: 20,
      networkRetryLimit: 0
    });
    await Promise.resolve();
    await Promise.resolve();
    clock.advance(500);
    clock.advance(20);
    clock.advance(20);
    clock.advance(RUNTIME_DRAIN_DEADLINE_MS);
    const result = await pending;
    expect(result.lifecycleError).toBe("process_group_not_reaped");
    expect(result.attempts).toBe(1);
    expect(existsSync(runtimeChildRecordPath(home, 51001))).toBe(true);
  });

  it("unknown drain deadline 同样有界 fail-closed", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-unknown-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const clock = virtualClock();
    const spawned = fakeSpawned(51002, home);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "unknown"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      wallTimeoutMs: 20,
      idleTimeoutMs: 0,
      killGraceMs: 20,
      networkRetryLimit: 0
    });
    await Promise.resolve();
    await Promise.resolve();
    clock.advance(500);
    clock.advance(20);
    clock.advance(20);
    clock.advance(RUNTIME_DRAIN_DEADLINE_MS);
    const result = await pending;
    expect(result.lifecycleError).toBe("process_group_not_reaped");
    expect(existsSync(runtimeChildRecordPath(home, 51002))).toBe(true);
  });

  it("活动 pipe error 不走 spawnError 且不可网络重试", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-pipe-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const spawned = fakeSpawned(51003, home);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      networkRetryLimit: 1
    });
    await Promise.resolve();
    spawned.child.stdout.emit("error", Object.assign(new Error("read EIO"), { code: "EIO" }));
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    const result = await pending;
    expect(result.pipeError).toEqual({ stream: "stdout", code: "EIO" });
    expect(result.pipeErrors).toEqual([{ stream: "stdout", code: "EIO" }]);
    expect(result.spawnError).toBeUndefined();
    expect(result.attempts).toBe(1);
  });

  it("两个 distinct pipe identity 进入 pipeErrors，SECRET 不进 stderrTail", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-pipe-dup-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const spawned = fakeSpawned(51034, home);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      networkRetryLimit: 0
    });
    await Promise.resolve();
    await Promise.resolve();
    const first = Object.assign(new Error("SECRET"), { code: "EIO" });
    const second = Object.assign(new Error("SECRET"), { code: "EPIPE" });
    spawned.child.stdout.emit("error", first);
    spawned.child.stdout.emit("error", first);
    spawned.child.stderr.emit("error", second);
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    const result = await pending;
    expect(result.pipeError).toEqual({ stream: "stdout", code: "EIO" });
    expect(result.pipeErrors).toEqual([
      { stream: "stdout", code: "EIO" },
      { stream: "stderr", code: "EPIPE" }
    ]);
    expect(result.stderrTail).not.toContain("SECRET");
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  it("真实 pipe listener 对 hostile/primitive/Proxy/null 不抛不泄漏", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-pipe-hostile-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const spawned = fakeSpawned(51033, home);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      networkRetryLimit: 0
    });
    await Promise.resolve();
    await Promise.resolve();
    const traps = { get: 0, getOwnPropertyDescriptor: 0, ownKeys: 0, getPrototypeOf: 0 };
    const proxy = new Proxy(Object.assign(new Error("read EIO"), { code: "EIO" }), {
      get(t, p, r) {
        traps.get += 1;
        return Reflect.get(t, p, r);
      },
      getOwnPropertyDescriptor(t, p) {
        traps.getOwnPropertyDescriptor += 1;
        return Reflect.getOwnPropertyDescriptor(t, p);
      },
      ownKeys(t) {
        traps.ownKeys += 1;
        return Reflect.ownKeys(t);
      },
      getPrototypeOf(t) {
        traps.getPrototypeOf += 1;
        return Reflect.getPrototypeOf(t);
      }
    });
    const secretObj = { code: "SECRET", message: "SECRET" };
    let accessorGets = 0;
    const accessor = new Error("init");
    Object.defineProperty(accessor, "code", {
      get(): string {
        accessorGets += 1;
        return "SECRET";
      }
    });
    Object.defineProperty(accessor, "message", {
      get(): string {
        accessorGets += 1;
        return "SECRET";
      }
    });
    const fn = function byoaPipe(): string {
      return "SECRET";
    };
    const revoked = Proxy.revocable(Object.assign(new Error("read EIO"), { code: "EIO" }), {
      get() {
        traps.get += 1;
        throw new Error("revoked get");
      }
    });
    revoked.revoke();
    const uncaught: unknown[] = [];
    const rejections: unknown[] = [];
    const onUncaught = (err: unknown): void => {
      uncaught.push(err);
    };
    const onReject = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("uncaughtException", onUncaught);
    process.on("unhandledRejection", onReject);
    try {
      expect(() => {
        spawned.child.stdout.emit("error", secretObj);
        spawned.child.stderr.emit("error", accessor);
        spawned.child.stdin.emit("error", fn);
        spawned.child.stdout.emit("error", 42);
        spawned.child.stderr.emit("error", null);
        spawned.child.stdin.emit("error", undefined);
        spawned.child.stdout.emit("error", proxy);
        spawned.child.stderr.emit("error", revoked.proxy);
      }).not.toThrow();
      spawned.child.emit("exit", 0, null);
      spawned.child.emit("close", 0, null);
      const result = await pending;
      expect(result.pipeError).toEqual({ stream: "stdout", code: "unknown" });
      expect(result.pipeErrors![0]).toEqual({ stream: "stdout", code: "unknown" });
      expect(JSON.stringify(result)).not.toContain("SECRET");
      expect(result.stderrTail).not.toContain("SECRET");
      expect(accessorGets).toBe(0);
      expect(traps.get + traps.getOwnPropertyDescriptor + traps.ownKeys + traps.getPrototypeOf).toBe(0);
      await new Promise((resolve) => setImmediate(resolve));
      expect(uncaught).toEqual([]);
      expect(rejections).toEqual([]);
    } finally {
      process.off("uncaughtException", onUncaught);
      process.off("unhandledRejection", onReject);
    }
  });

  it("pipe_failed 进入 API 与审计且不记录原文", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-api-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const spawned = fakeSpawned(51004, home);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const events: { action: string; meta?: Record<string, unknown> }[] = [];
    const limiter = new ByoaConcurrencyLimiter({ perCliLimit: 1, globalLimit: 1, maxQueue: 1 });
    const provider = createByoaProvider({
      provider: "cursor_cli",
      model: "claude-fable-5",
      expectedFamily: "claude",
      familyOf,
      profile: "default",
      audit: {
        record(event) {
          events.push({ action: event.action, ...(event.meta ? { meta: event.meta as Record<string, unknown> } : {}) });
          return { id: "aud_1" };
        }
      },
      binaryPath: process.execPath,
      networkRetryLimit: 1,
      concurrencyLimiter: limiter,
      readonlyFoundationCwd: home
    });
    const pending = provider.chat({ messages: [{ role: "user", content: "hi" }] });
    await Promise.resolve();
    spawned.child.stdout.emit("error", Object.assign(new Error("secret-token-should-not-audit"), { code: "EIO" }));
    spawned.child.emit("exit", 1, null);
    spawned.child.emit("close", 1, null);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, code: "pipe_failed", retryable: false });
    expect(limiter.snapshot().globalActive).toBe(0);
    const invocation = events.find((event) => event.action === "byoa.invocation");
    expect(invocation?.meta?.["voidReason"]).toBe("pipe_failed");
    expect(JSON.stringify(events)).not.toContain("secret-token-should-not-audit");
    await expect(abortAllByoaInvocations()).resolves.toMatchObject({ aborted: 0 });
    expect(() => assertByoaShutdownAllowsStopped()).not.toThrow();
    expect(getByoaLifecycleContamination()).toBeNull();
  });

  it("BYOA Job release 失败时不得当成功 settle，并保留 owner", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-release-fail-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const spawned = fakeSpawned(51099, home);
    spawned.lease.release = async () => {
      throw new ProcessGroupLifecycleError("byoa job close failed");
    };
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      wallTimeoutMs: 20,
      idleTimeoutMs: 0,
      killGraceMs: 20,
      networkRetryLimit: 0
    });
    await Promise.resolve();
    await Promise.resolve();
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0);
    const result = await pending;
    expect(result.lifecycleError).toBe("process_group_not_reaped");
    expect(result.exitCode).not.toBe(0);
    expect(getByoaLifecycleContamination()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(existsSync(runtimeChildRecordPath(home, 51099))).toBe(true);
    expect(() => assertByoaShutdownAllowsStopped()).toThrow(ProcessGroupLifecycleError);
  });

  it("普通 lifecycleError 字段不冒充全局 contamination", async () => {
    expect(getByoaLifecycleContamination()).toBeNull();
    expect(() => assertByoaShutdownAllowsStopped()).not.toThrow();
    await expect(abortAllByoaInvocations()).resolves.toMatchObject({ aborted: 0 });
  });

  it("alive drain 后全局 contamination，shutdown 不发 stopped，后续 chat 拒绝", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-cont-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const clock = virtualClock();
    const spawned = fakeSpawned(51005, home);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "alive"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      wallTimeoutMs: 20,
      idleTimeoutMs: 0,
      killGraceMs: 20,
      networkRetryLimit: 0
    });
    await Promise.resolve();
    await Promise.resolve();
    clock.advance(500);
    clock.advance(20);
    clock.advance(20);
    clock.advance(RUNTIME_DRAIN_DEADLINE_MS);
    const result = await pending;
    expect(result.lifecycleError).toBe("process_group_not_reaped");
    expect(getByoaLifecycleContamination()).toBeInstanceOf(ProcessGroupLifecycleError);
    await expect(abortAllByoaInvocations()).rejects.toBeInstanceOf(ProcessGroupLifecycleError);
    expect(() => assertByoaShutdownAllowsStopped()).toThrow(ProcessGroupLifecycleError);
    const limiter = new ByoaConcurrencyLimiter({ perCliLimit: 1, globalLimit: 1, maxQueue: 1 });
    const provider = createByoaProvider({
      provider: "cursor_cli",
      model: "claude-fable-5",
      expectedFamily: "claude",
      familyOf,
      profile: "default",
      audit: { record() { return { id: "aud_1" }; } },
      binaryPath: process.execPath,
      concurrencyLimiter: limiter,
      readonlyFoundationCwd: home
    });
    await expect(provider.chat({ messages: [{ role: "user", content: "hi" }] })).resolves.toMatchObject({
      ok: false,
      code: "process_group_not_reaped",
      retryable: false
    });
  });

  it("spawn 后 child error + group alive 走 bounded drain 并污染", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-err-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const clock = virtualClock();
    const spawned = fakeSpawned(51006, home);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "alive"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      wallTimeoutMs: 20,
      idleTimeoutMs: 0,
      killGraceMs: 20,
      networkRetryLimit: 0
    });
    await Promise.resolve();
    await Promise.resolve();
    clock.advance(500);
    spawned.child.emit("error", new Error("EIO after spawn"));
    clock.advance(20);
    clock.advance(RUNTIME_DRAIN_DEADLINE_MS);
    const result = await pending;
    expect(result.spawnError).toBe("process group error graph contained a hostile value");
    expect(result.spawnError).not.toContain("SECRET");
    expect(result.lifecycleError).toBe("process_group_not_reaped");
    expect(getByoaLifecycleContamination()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(existsSync(runtimeChildRecordPath(home, 51006))).toBe(true);
  });

  it("exit emitted close withheld 有界污染", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-close-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const clock = virtualClock();
    const spawned = fakeSpawned(51007, home);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "alive",
      closeDeadlineMs: 20
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      wallTimeoutMs: 20,
      idleTimeoutMs: 0,
      killGraceMs: 20,
      networkRetryLimit: 0
    });
    await Promise.resolve();
    await Promise.resolve();
    clock.advance(500);
    spawned.child.emit("exit", 0, null);
    clock.advance(20);
    clock.advance(RUNTIME_DRAIN_DEADLINE_MS);
    const result = await pending;
    expect(result.lifecycleError).toBe("process_group_not_reaped");
    expect(getByoaLifecycleContamination()).toBeInstanceOf(ProcessGroupLifecycleError);
  });

  it("活动期 stdin EPIPE 覆盖 exit 0 且 attempts=1", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-stdin-epipe-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const spawned = fakeSpawned(51008, home);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      networkRetryLimit: 1
    });
    await Promise.resolve();
    spawned.child.stdin.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    const result = await pending;
    expect(result.pipeError).toEqual({ stream: "stdin", code: "EPIPE" });
    expect(result.attempts).toBe(1);
    expect(result.spawnError).toBeUndefined();
  });

  it("exit 后 close 前 stdin EIO 失败且审计 pipe_failed", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-stdin-eio-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const spawned = fakeSpawned(51009, home);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const events: { action: string; meta?: Record<string, unknown> }[] = [];
    const limiter = new ByoaConcurrencyLimiter({ perCliLimit: 1, globalLimit: 1, maxQueue: 1 });
    const provider = createByoaProvider({
      provider: "cursor_cli",
      model: "claude-fable-5",
      expectedFamily: "claude",
      familyOf,
      profile: "default",
      audit: {
        record(event) {
          events.push({ action: event.action, ...(event.meta ? { meta: event.meta as Record<string, unknown> } : {}) });
          return { id: "aud_1" };
        }
      },
      binaryPath: process.execPath,
      networkRetryLimit: 1,
      concurrencyLimiter: limiter,
      readonlyFoundationCwd: home
    });
    const pending = provider.chat({ messages: [{ role: "user", content: "hi" }] });
    await Promise.resolve();
    spawned.child.emit("exit", 0, null);
    spawned.child.stdin.emit("error", Object.assign(new Error("read EIO"), { code: "EIO" }));
    spawned.child.emit("close", 0, null);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, code: "pipe_failed", retryable: false });
    expect(limiter.snapshot().globalActive).toBe(0);
    expect(events.find((event) => event.action === "byoa.invocation")?.meta?.["voidReason"]).toBe("pipe_failed");
  });

  it("terminating 窗口 stdin ECONNRESET 可成功", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-byoa-stdin-reset-"));
    homes.push(home);
    configureRuntimeChildRegistry(home);
    const spawned = fakeSpawned(51010, home);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = runSpawnTurn({
      argv: { bin: "cursor-agent", args: ["-p"], cwd: home },
      prompt: "hi",
      networkRetryLimit: 1
    });
    await Promise.resolve();
    spawned.child.emit("exit", 0, null);
    spawned.child.stdin.emit("error", Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }));
    spawned.child.emit("close", 0, null);
    const result = await pending;
    expect(result.pipeError).toBeUndefined();
    expect(result.exitCode).toBe(0);
    expect(result.attempts).toBe(1);
  });
});
