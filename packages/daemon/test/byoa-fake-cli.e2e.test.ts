// T18a-1 fake CLI 进程级反例:超时/畸形 JSON/非零退出/unknown/取消/排队/schema 拒绝。

import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AuditEvent, AuditSink } from "../src/obs/audit.js";
import { DRAFT_JSON_SCHEMA } from "../src/brain/liveTools.js";
import { runDialogCliOneshot } from "../src/brain/dialogLoop.js";
import { ToolRegistry } from "../src/brain/registry.js";
import { familyFromModelName } from "../src/config/family.js";
import {
  abortAllByoaInvocations,
  activeByoaInvocationCount,
  BYOA_NO_TOOL_PROMPT_HEADER,
  createByoaProvider,
  resetByoaLifecycleForTests,
  type ByoaProviderOptions
} from "../src/providers/byoa/provider.js";
import { ByoaConcurrencyLimiter } from "../src/providers/byoa/runner.js";
import {
  configureRuntimeChildRegistry,
  resetRuntimeChildLifecycleForTests
} from "../src/runtimeChildRegistry.js";

const fakeCli = fileURLToPath(new URL("./fixtures/fake-byoa-cli.mjs", import.meta.url));
const testDir = mkdtempSync(join(tmpdir(), "saydo-byoa-e2e-"));
const binaryDigest = createHash("sha256").update(readFileSync(fakeCli)).digest("hex");
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: { value: { type: "string", enum: ["ok"] } }
} as const;

function auditCollector(): { events: AuditEvent[]; sink: AuditSink } {
  const events: AuditEvent[] = [];
  return {
    events,
    sink: {
      record(event) {
        events.push(event);
        return { id: `aud_${events.length}` };
      }
    }
  };
}

function makeProvider(overrides: Partial<ByoaProviderOptions> = {}) {
  const audit = auditCollector();
  const providerName = overrides.provider ?? "cursor_cli";
  const model = overrides.model ?? (providerName === "codex_cli" ? "gpt-5.6-luna" : "claude-fable-5");
  const provider = createByoaProvider({
    provider: providerName,
    model,
    expectedFamily: providerName === "codex_cli" ? "gpt" : "claude",
    familyOf: familyFromModelName,
    profile: "default",
    audit: audit.sink,
    binaryPath: fakeCli,
    networkRetryLimit: 0,
    ...overrides
  });
  return { provider, audit };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("waitUntil timeout");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

beforeAll(() => {
  chmodSync(fakeCli, 0o755);
  configureRuntimeChildRegistry(testDir);
});
afterEach(() => {
  resetByoaLifecycleForTests();
  try {
    resetRuntimeChildLifecycleForTests();
  } catch {
    // 污染由本测断言覆盖
  }
});
afterAll(() => rmSync(testDir, { recursive: true, force: true }));

describe("BYOA fake CLI 进程级反例", () => {
  it("dialog_cli_oneshot 经真实 fake 子进程返回 remember envelope 并按序 dispatch", async () => {
    const { provider } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    const registry = new ToolRegistry();
    const calls: unknown[] = [];
    registry.register(
      {
        name: "remember",
        description: "记忆",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["tier", "claim", "trust"],
          properties: {
            tier: { type: "string" },
            claim: { type: "string" },
            trust: { type: "string" },
            projectId: { type: "string" }
          }
        }
      },
      (args) => {
      calls.push(args);
      return { ok: true };
      }
    );
    const result = await runDialogCliOneshot(
      provider,
      { sessionId: "s1", turnId: "t1", userText: "fake:oneshot-valid", history: [] },
      { registry, ctx: { sessionId: "s1", turnId: "t1" } }
    );
    expect(result.modelText).toBe("已准备记下。");
    expect(calls).toEqual([{ tier: "M1", claim: "买了乐高", trust: "user_stated" }]);
  });

  it("oneshot 禁用工具由 schema 重试一次后拒绝,dialog 层不得再发第三个进程", async () => {
    const { provider, audit } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    const result = await runDialogCliOneshot(
      provider,
      { sessionId: "s1", turnId: "t2", userText: "fake:oneshot-banned-tool", history: [] },
      { registry: new ToolRegistry(), ctx: { sessionId: "s1", turnId: "t2" } }
    );
    expect(result.errorCode).toBe("invalid_structured_output");
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("oneshot 空白 reply 经真实 fake 进程重试一次后拒绝且零 dispatch", async () => {
    const { provider, audit } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    const registry = new ToolRegistry();
    let dispatches = 0;
    registry.register({ name: "getStatus", description: "", parameters: {} }, () => {
      dispatches += 1;
      return { ok: true };
    });

    const result = await runDialogCliOneshot(
      provider,
      { sessionId: "s1", turnId: "t-blank", userText: "fake:oneshot-blank-reply", history: [] },
      { registry, ctx: { sessionId: "s1", turnId: "t-blank" } }
    );

    expect(result.errorCode).toBe("invalid_structured_output");
    expect(dispatches).toBe(0);
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("oneshot 同轮两个 pending action 经真实进程拒绝且零 dispatch", async () => {
    const { provider, audit } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    const registry = new ToolRegistry();
    const dispatched: string[] = [];
    for (const name of ["proposeFocusAnchor", "proposeObligation"]) {
      registry.register({ name, description: name, parameters: { type: "object", additionalProperties: false, properties: {} } }, () => {
        dispatched.push(name);
        return { ok: true };
      });
    }
    const result = await runDialogCliOneshot(
      provider,
      { sessionId: "s1", turnId: "t-pending", userText: "fake:oneshot-two-pending", history: [] },
      { registry, ctx: { sessionId: "s1", turnId: "t-pending" } }
    );
    expect(result.errorCode).toBe("invalid_structured_output");
    expect(dispatched).toEqual([]);
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("oneshot 遇真实进程产出的 await_user 后立即停余 action 并丢 reply", async () => {
    const { provider } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    const registry = new ToolRegistry();
    const dispatched: string[] = [];
    for (const name of ["createTask", "proposeObligation", "getStatus"]) {
      registry.register({ name, description: name, parameters: { type: "object", additionalProperties: false, properties: {} } }, () => {
        dispatched.push(name);
        return name === "proposeObligation" ? { control: "await_user" } : { ok: true };
      });
    }
    const result = await runDialogCliOneshot(
      provider,
      { sessionId: "s1", turnId: "t-await", userText: "fake:oneshot-await-user", history: [] },
      { registry, ctx: { sessionId: "s1", turnId: "t-await" } }
    );
    expect(dispatched).toEqual(["createTask", "proposeObligation"]);
    expect(result.sentences).toEqual([]);
    expect(result.modelText).toBeUndefined();
  });

  it("oneshot action 失败后丢模型 reply,部分应用也不重试", async () => {
    const { provider, audit } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    const registry = new ToolRegistry();
    registry.register({ name: "createTask", description: "", parameters: { type: "object", additionalProperties: false, properties: {} } }, () => ({ ok: true }));
    registry.register({ name: "getStatus", description: "", parameters: { type: "object", additionalProperties: false, properties: {} } }, () => ({ ok: false, code: "boom" }));
    const result = await runDialogCliOneshot(
      provider,
      { sessionId: "s1", turnId: "t-fail", userText: "fake:oneshot-action-failure", history: [] },
      { registry, ctx: { sessionId: "s1", turnId: "t-fail" } }
    );
    expect(result.errorCode).toBe("oneshot_action_failed");
    expect(result.sentences.map((item) => item.text).join(" ")).not.toContain("失败后不得下发");
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(1);
  });

  it("oneshot 仅在零 action 应用时允许一次格式重试", async () => {
    const marker = join(testDir, "oneshot-retry.state");
    const { provider, audit } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    const registry = new ToolRegistry();
    let applied = 0;
    registry.register({ name: "getStatus", description: "", parameters: { type: "object", additionalProperties: false, properties: {} } }, () => {
      applied += 1;
      return { ok: true };
    });
    const result = await runDialogCliOneshot(
      provider,
      { sessionId: "s1", turnId: "t-retry", userText: `fake:oneshot-retry-once:${marker}`, history: [] },
      { registry, ctx: { sessionId: "s1", turnId: "t-retry" } }
    );
    expect(result.modelText).toBe("重试后合法");
    expect(applied).toBe(1);
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("provider 内部已重试后才出现 Zod 重复 id,dialog 不得再起第三进程", async () => {
    const marker = join(testDir, "oneshot-tripwire-duplicate.state");
    const { provider, audit } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    const registry = new ToolRegistry();
    registry.register({ name: "getStatus", description: "", parameters: { type: "object", additionalProperties: false, properties: {} } }, () => ({ ok: true }));
    const result = await runDialogCliOneshot(
      provider,
      { sessionId: "s1", turnId: "t-budget", userText: `fake:oneshot-tripwire-then-duplicate:${marker}`, history: [] },
      { registry, ctx: { sessionId: "s1", turnId: "t-budget" } }
    );
    expect(result.errorCode).toBe("invalid_structured_output");
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("并发限制配置拒绝零或负数,不形成永不启动的队列", () => {
    expect(() => new ByoaConcurrencyLimiter({ perCliLimit: 0 })).toThrow("正整数");
    expect(() => new ByoaConcurrencyLimiter({ globalLimit: -1 })).toThrow("正整数");
    expect(() => new ByoaConcurrencyLimiter({ maxQueue: -1 })).toThrow("非负整数");
  });

  it("网络重试上限只允许关闭或一次,不得扩成多次", async () => {
    const { provider } = makeProvider({ networkRetryLimit: 2 });
    await expect(provider.chat({ messages: [{ role: "user", content: "fake:success" }] })).rejects.toThrow(
      "networkRetryLimit 只允许 0 或 1"
    );
  });

  it("wall timeout 先 SIGTERM 并返回可重试 timeout", async () => {
    const marker = join(testDir, "timeout.term");
    const { provider } = makeProvider({ wallTimeoutMs: 200, idleTimeoutMs: 1000 });
    const result = await provider.chat({ messages: [{ role: "user", content: `fake:timeout:${marker}` }] });
    expect(result).toMatchObject({ ok: false, code: "timeout", retryable: true });
    if (process.platform === "win32") return;
    expect(readFileSync(marker, "utf8")).toBe("SIGTERM");
  });

  it("AbortSignal 取消并按 SIGTERM→宽限→SIGKILL 收口", async () => {
    const marker = join(testDir, "cancel.term");
    const { provider } = makeProvider({ wallTimeoutMs: 5000, idleTimeoutMs: 5000, killGraceMs: 50 });
    const controller = new AbortController();
    const pending = provider.chat({ messages: [{ role: "user", content: `fake:stubborn:${marker}` }] }, controller.signal);
    await waitUntil(() => existsSync(`${marker}.ready`), 1000);
    controller.abort();
    await expect(pending).resolves.toMatchObject({ ok: false, code: "cancelled" });
    if (process.platform === "win32") return;
    expect(readFileSync(marker, "utf8")).toBe("SIGTERM");
  });

  it("daemon 生命周期取消可终止所有活动 BYOA 子进程", async () => {
    const marker = join(testDir, "shutdown.term");
    const { provider } = makeProvider({ wallTimeoutMs: 5000, idleTimeoutMs: 5000, killGraceMs: 50 });
    const pending = provider.chat({ messages: [{ role: "user", content: `fake:stubborn:${marker}` }] });
    await waitUntil(() => existsSync(`${marker}.ready`), 1000);
    expect(activeByoaInvocationCount()).toBe(1);
    const drain = abortAllByoaInvocations();
    const blocked = makeProvider().provider.chat({ messages: [{ role: "user", content: "fake:success" }] });
    await expect(blocked).resolves.toMatchObject({ ok: false, code: "cancelled" });
    await expect(drain).resolves.toEqual({ aborted: 1 });
    await expect(pending).resolves.toMatchObject({ ok: false, code: "cancelled" });
    expect(activeByoaInvocationCount()).toBe(0);
    if (process.platform !== "win32") expect(readFileSync(marker, "utf8")).toBe("SIGTERM");
  });

  it("CLI 直接父进程正常退出时也终止继承 pipe 与 ignore stdio 的后代", async () => {
    const marker = join(testDir, "orphan-grandchildren.log");
    const { provider } = makeProvider();
    await expect(
      provider.chat({ messages: [{ role: "user", content: `fake:orphan-grandchildren:${marker}` }] })
    ).resolves.toMatchObject({ ok: true, text: "children-drained" });
    await waitUntil(
      () => existsSync(marker) && (
        process.platform === "win32"
          ? /ignore-started:/u.test(readFileSync(marker, "utf8"))
          : readFileSync(marker, "utf8").includes("ignore-SIGTERM")
      ),
      3000
    );
    const evidence = readFileSync(marker, "utf8");
    expect(evidence).toContain("inherit-started");
    expect(evidence).toContain("ignore-started");
    if (process.platform !== "win32") {
      expect(evidence).toContain("inherit-SIGTERM");
      expect(evidence).toContain("ignore-SIGTERM");
    }
    const descendantPids = [...evidence.matchAll(/(?:inherit|ignore)-started:(\d+)/g)].map((match) => Number(match[1]));
    expect(descendantPids).toHaveLength(2);
    await waitUntil(
      () =>
        descendantPids.every((pid) => {
          try {
            process.kill(pid, 0);
            return false;
          } catch {
            return true;
          }
        }),
      3000
    );
    for (const pid of descendantPids) expect(() => process.kill(pid, 0)).toThrow();
  });

  it("输入超过 cap 时在 spawn 前如实拒绝", async () => {
    const { provider, audit } = makeProvider({ inputLimitBytes: 128 });
    await expect(
      provider.chat({ messages: [{ role: "user", content: "过长输入".repeat(100) }] })
    ).resolves.toMatchObject({ ok: false, code: "input_limit" });
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(0);
  });

  it("cursor 畸形 JSON 严格重试一次后仍拒绝", async () => {
    const { provider, audit } = makeProvider();
    const result = await provider.chat({
      messages: [{ role: "user", content: "fake:malformed-json" }],
      jsonSchema: schema as unknown as Record<string, unknown>
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_structured_output" });
    const invocations = audit.events.filter((event) => event.action === "byoa.invocation");
    expect(invocations).toHaveLength(2);
    expect(invocations.every((event) => event.meta?.["voided"] === true)).toBe(true);
    expect(invocations.every((event) => event.meta?.["voidReason"] === "invalid_structured_output")).toBe(true);
  });

  it("非法 NDJSON 必须穿过 spawn/decoder 后即时 parse_error 作废", async () => {
    const { provider, audit } = makeProvider();
    await expect(
      provider.chat({ messages: [{ role: "user", content: "fake:invalid-ndjson" }] })
    ).resolves.toMatchObject({ ok: false, code: "voided_parse_error" });
    expect(audit.events.find((event) => event.action === "byoa.invocation")?.meta).toMatchObject({
      voided: true,
      voidReason: "parse_error"
    });
  });

  it("持续输出后静默由 idle watchdog 终止,不误报 wall timeout", async () => {
    const marker = join(testDir, "idle.term");
    // idle 计时从 spawn 开始；给并行 CI 中的 Node 子进程留出确定的冷启动窗口。
    const { provider, audit } = makeProvider({ wallTimeoutMs: 2000, idleTimeoutMs: 500 });
    await expect(
      provider.chat({ messages: [{ role: "user", content: `fake:idle-after-output:${marker}` }] })
    ).resolves.toMatchObject({ ok: false, code: "timeout" });
    if (process.platform !== "win32") expect(readFileSync(marker, "utf8")).toBe("SIGTERM");
    expect(audit.events.find((event) => event.action === "byoa.invocation")?.meta).toMatchObject({
      timedOut: true,
      timeoutKind: "idle",
      voidReason: "timeout_idle"
    });
  });

  it("非零退出和空输出不得收成成功文本,进程失败审计必须作废", async () => {
    const nonzeroSetup = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest, defaultModel: "gpt-5.6-luna" }
    });
    const nonzero = nonzeroSetup.provider;
    await expect(nonzero.chat({ messages: [{ role: "user", content: "fake:nonzero" }] })).resolves.toMatchObject({
      ok: false,
      code: "process_exit"
    });
    expect(nonzeroSetup.audit.events.find((event) => event.action === "byoa.invocation")?.meta).toMatchObject({
      configured_provider: "codex_cli",
      routed_provider: "unknown",
      voided: true,
      voidReason: "process_exit"
    });
    const emptySetup = makeProvider();
    await expect(emptySetup.provider.chat({ messages: [{ role: "user", content: "fake:empty" }] })).resolves.toMatchObject({
      ok: false,
      code: "empty_output"
    });
    expect(emptySetup.audit.events.find((event) => event.action === "byoa.invocation")?.meta).toMatchObject({
      voided: true,
      voidReason: "empty_output"
    });
  });

  it("unknown event fail-closed", async () => {
    const warns: Array<{ msg: string; fields?: Record<string, unknown> }> = [];
    const { provider, audit } = makeProvider({
      slot: "thinking",
      log: {
        warn: (msg, fields) => {
          warns.push(fields ? { msg, fields } : { msg });
        }
      }
    });
    await expect(provider.chat({ messages: [{ role: "user", content: "fake:unknown-event" }] })).resolves.toMatchObject({
      ok: false,
      code: "voided_unknown_event",
      message: expect.stringMatching(
        /^CLI 输出了无法识别的内容,这次结果作废\(保守处理\)\(触发内容:\{"type":"SECRET_MUST_NOT_ENTER_AUDIT"/
      )
    });
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
    const meta = audit.events.find((event) => event.action === "byoa.invocation")?.meta;
    expect(meta?.["unknownEventShapes"]).toEqual(["unknown-json"]);
    expect(JSON.stringify(meta)).not.toContain("SECRET_MUST_NOT_ENTER_AUDIT");
    expect(JSON.stringify(meta)).not.toContain("TOKEN_MUST_NOT_ENTER_AUDIT");
    expect(warns.length).toBeGreaterThanOrEqual(1);
    expect(warns[0]).toMatchObject({
      msg: "byoa.safety_stop",
      fields: { provider: "cursor_cli", slot: "thinking", kind: "unknown_event" }
    });
    expect(String(warns[0]?.fields?.["triggerLine"] ?? "")).toContain("SECRET_MUST_NOT_ENTER_AUDIT");
  });

  it("首发 unknown_event 同参重试一次后干净响应可用", async () => {
    const marker = join(testDir, "unknown-event-once.state");
    const { provider, audit } = makeProvider({ slot: "thinking" });
    await expect(
      provider.chat({ messages: [{ role: "user", content: `fake:unknown-event-once:${marker}` }] })
    ).resolves.toMatchObject({ ok: true, text: "unknown-retry-ok" });
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("两次 unknown_event 才失败且不加强化禁令", async () => {
    const { provider, audit } = makeProvider();
    await expect(
      provider.chat({ messages: [{ role: "user", content: "fake:unknown-event-repeat" }] })
    ).resolves.toMatchObject({
      ok: false,
      code: "voided_unknown_event",
      message: expect.stringContaining("(触发内容:")
    });
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("Codex 已知元事件中的异族 model 不能被 fixed-family 豁免覆盖", async () => {
    const { provider } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    await expect(
      provider.chat({ messages: [{ role: "user", content: "fake:codex-meta-model-mismatch" }] })
    ).resolves.toMatchObject({ ok: false, code: "voided_family_mismatch" });
  });

  it.each(["codex_cli", "claude_cli", "cursor_cli"] as const)(
    "%s 订阅限流在通用进程错误前归类为 canonical code",
    async (providerName) => {
      const model = providerName === "codex_cli" ? "gpt-5.6-luna" : "claude-sonnet-5";
      const identity = providerName === "cursor_cli" ? undefined : { path: fakeCli, digest: binaryDigest };
      const { provider, audit } = makeProvider({
        provider: providerName,
        model,
        ...(identity ? { binaryIdentity: identity } : {})
      });
      await expect(
        provider.chat({ messages: [{ role: "user", content: "fake:subscription-rate-limit" }] })
      ).resolves.toMatchObject({ ok: false, code: "subscription_rate_limited", retryable: true });
      expect(audit.events.find((event) => event.action === "byoa.invocation")?.meta?.["voidReason"]).toBe(
        "subscription_rate_limited"
      );
    }
  );

  it.each(["codex_cli", "claude_cli", "cursor_cli"] as const)(
    "%s 仅结构化失败事件也能识别订阅限流",
    async (providerName) => {
      const model = providerName === "codex_cli" ? "gpt-5.6-luna" : "claude-sonnet-5";
      const identity = providerName === "cursor_cli" ? undefined : { path: fakeCli, digest: binaryDigest };
      const { provider } = makeProvider({
        provider: providerName,
        model,
        ...(identity ? { binaryIdentity: identity } : {})
      });
      await expect(
        provider.chat({ messages: [{ role: "user", content: "fake:subscription-rate-limit-structured" }] })
      ).resolves.toMatchObject({ ok: false, code: "subscription_rate_limited", retryable: true });
    }
  );

  it.each(["codex_cli", "claude_cli", "cursor_cli"] as const)(
    "%s 仅 stderr 的精确额度措辞也能识别订阅限流",
    async (providerName) => {
      const model = providerName === "codex_cli" ? "gpt-5.6-luna" : "claude-sonnet-5";
      const identity = providerName === "cursor_cli" ? undefined : { path: fakeCli, digest: binaryDigest };
      const { provider } = makeProvider({
        provider: providerName,
        model,
        ...(identity ? { binaryIdentity: identity } : {})
      });
      await expect(
        provider.chat({ messages: [{ role: "user", content: "fake:subscription-rate-limit-stderr" }] })
      ).resolves.toMatchObject({ ok: false, code: "subscription_rate_limited", retryable: true });
    }
  );

  it.each(["codex_cli", "claude_cli", "cursor_cli"] as const)(
    "%s 已识别的限流不得被通用网络重试洗成成功",
    async (providerName) => {
      const marker = join(testDir, `rate-limit-network-${providerName}.state`);
      const model = providerName === "codex_cli" ? "gpt-5.6-luna" : "claude-sonnet-5";
      const identity = providerName === "cursor_cli" ? undefined : { path: fakeCli, digest: binaryDigest };
      const { provider, audit } = makeProvider({
        provider: providerName,
        model,
        networkRetryLimit: 1,
        ...(identity ? { binaryIdentity: identity } : {})
      });
      await expect(
        provider.chat({ messages: [{ role: "user", content: `fake:subscription-rate-limit-network-once:${marker}` }] })
      ).resolves.toMatchObject({ ok: false, code: "subscription_rate_limited" });
      expect(readFileSync(marker, "utf8")).toBe("first");
      expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(1);
    }
  );

  it.each([
    "disk-quota",
    "auth-rate-limit",
    "network-proxy-rate-limit",
    "rate-limit-by-proxy",
    "rate-limit-authenticating",
    "quota-local-proxy",
    "rate-limit-split-context",
    "rate-limit-structured-context"
  ])(
    "%s 普通进程错误不得误报订阅限流",
    async (mode) => {
      const { provider } = makeProvider();
      await expect(provider.chat({ messages: [{ role: "user", content: `fake:${mode}` }] })).resolves.toMatchObject({
        ok: false,
        code: mode === "rate-limit-structured-context" ? "voided_unknown_event" : "process_exit"
      });
    }
  );

  it.each(["codex_cli", "claude_cli", "cursor_cli"] as const)(
    "%s 成功正文出现 rate/usage limit 词组不得误判为订阅限流",
    async (providerName) => {
      const model = providerName === "codex_cli" ? "gpt-5.6-luna" : "claude-sonnet-5";
      const identity = providerName === "cursor_cli" ? undefined : { path: fakeCli, digest: binaryDigest };
      const { provider } = makeProvider({
        provider: providerName,
        model,
        ...(identity ? { binaryIdentity: identity } : {})
      });
      await expect(
        provider.chat({ messages: [{ role: "user", content: "fake:success-rate-limit-text" }] })
      ).resolves.toMatchObject({ ok: true, text: expect.stringContaining("rate limit") });
    }
  );

  it("CLI 自报失败事件不得收成成功文本", async () => {
    for (const providerName of ["codex_cli", "claude_cli", "cursor_cli"] as const) {
      const model = providerName === "codex_cli" ? "gpt-5.6-luna" : "claude-sonnet-5";
      const { provider } = makeProvider({ provider: providerName, model });
      const result = await provider.chat({ messages: [{ role: "user", content: "fake:provider-error-event" }] });
      expect(result.ok).toBe(false);
      if (providerName === "claude_cli") {
        expect(result).toMatchObject({
          ok: false,
          code: "cli_error",
          message: "must-not-pass"
        });
        continue;
      }
      expect(result).toMatchObject({ ok: false, code: "voided_unknown_event" });
    }
  });

  it("畸形事件字段不得抛出未捕获异常或收成成功", async () => {
    for (const providerName of ["codex_cli", "claude_cli", "cursor_cli"] as const) {
      const model = providerName === "codex_cli" ? "gpt-5.6-luna" : "claude-fable-5";
      const { provider } = makeProvider({ provider: providerName, model });
      await expect(
        provider.chat({ messages: [{ role: "user", content: "fake:malformed-field" }] })
      ).resolves.toMatchObject({ ok: false });
    }
  });

  it("exit=0 的截断流缺少供应商成功终态时一律作废", async () => {
    for (const providerName of ["codex_cli", "claude_cli", "cursor_cli"] as const) {
      const model = providerName === "codex_cli" ? "gpt-5.6-luna" : "claude-fable-5";
      const identity =
        providerName === "cursor_cli" ? undefined : { path: fakeCli, digest: binaryDigest };
      const { provider } = makeProvider({ provider: providerName, model, ...(identity ? { binaryIdentity: identity } : {}) });
      await expect(
        provider.chat({ messages: [{ role: "user", content: "fake:partial-exit" }] })
      ).resolves.toMatchObject({ ok: false, code: "voided_incomplete_stream" });
    }
  });

  it("Claude/Cursor 明确空终态不得回收此前 assistant partial text", async () => {
    for (const providerName of ["claude_cli", "cursor_cli"] as const) {
      const identity = providerName === "claude_cli" ? { path: fakeCli, digest: binaryDigest } : undefined;
      const { provider } = makeProvider({ provider: providerName, ...(identity ? { binaryIdentity: identity } : {}) });
      await expect(
        provider.chat({ messages: [{ role: "user", content: "fake:terminal-empty" }] })
      ).resolves.toMatchObject({ ok: false, code: "empty_output" });
    }
  });

  it("Claude schema 模式只有 assistant JSON 而无 structured_output 终态也必须拒绝", async () => {
    const { provider } = makeProvider({
      provider: "claude_cli",
      model: "claude-sonnet-5",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    await expect(
      provider.chat({
        messages: [{ role: "user", content: "fake:partial-exit" }],
        jsonSchema: schema as unknown as Record<string, unknown>
      })
    ).resolves.toMatchObject({ ok: false, code: "voided_incomplete_stream" });
  });

  it("总输出超过 cap 即终止并拒绝", async () => {
    const { provider } = makeProvider({ outputLimitBytes: 4096 });
    await expect(provider.chat({ messages: [{ role: "user", content: "fake:output-cap" }] })).resolves.toMatchObject({
      ok: false,
      code: "output_limit"
    });
  });

  it("jsonSchema 真传入 cage 文件、familyFixed 登记豁免并在调用后清理", async () => {
    const marker = join(testDir, "schema-path.txt");
    const { provider, audit } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest, defaultModel: "gpt-5.6-luna" }
    });
    const result = await provider.chat({
      messages: [{ role: "user", content: `fake:schema-ok:${marker}` }],
      jsonSchema: schema as unknown as Record<string, unknown>
    });
    expect(result).toMatchObject({
      ok: true,
      observedModel: "gpt-5.6-luna",
      observedModelSource: "verified_binary_default",
      observedModelExempted: true
    });
    const materializedPath = readFileSync(marker, "utf8");
    expect(materializedPath).toContain("output-schema.json");
    expect(existsSync(materializedPath)).toBe(false);
    expect(audit.events.some((event) => event.action === "provider.observed_model_exemption")).toBe(true);
  });

  it("三槽一发一收以硬禁令开头并使用自动清理的空隔离 cwd", async () => {
    const marker = join(testDir, "isolation.json");
    const { provider } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    await expect(
      provider.chat({
        messages: [{ role: "user", content: `fake:capture-isolation:${marker}` }],
        jsonSchema: schema as unknown as Record<string, unknown>
      })
    ).resolves.toMatchObject({ ok: true });
    const evidence = JSON.parse(readFileSync(marker, "utf8")) as {
      cwd: string;
      cwdEntries: string[];
      promptStart: string;
    };
    expect(evidence.promptStart.startsWith(BYOA_NO_TOOL_PROMPT_HEADER)).toBe(true);
    expect(evidence.cwdEntries).toEqual([]);
    expect(evidence.cwd).not.toBe(process.cwd());
    expect(evidence.cwd).not.toBe(process.env["HOME"]);
    expect(existsSync(evidence.cwd)).toBe(false);
  });

  it("claude --json-schema 传内联 JSON 而非临时文件路径", async () => {
    const marker = join(testDir, "claude-schema.txt");
    const { provider } = makeProvider({
      provider: "claude_cli",
      model: "claude-sonnet-5",
      binaryIdentity: { path: fakeCli, digest: binaryDigest, defaultModel: "claude-sonnet-5" }
    });
    await expect(
      provider.chat({
        messages: [{ role: "user", content: `fake:schema-ok:${marker}` }],
        jsonSchema: schema as unknown as Record<string, unknown>
      })
    ).resolves.toMatchObject({
      ok: true,
      observedModel: "claude-sonnet-5",
      observedModelSource: "verified_binary_default",
      observedModelExempted: true
    });
    expect(JSON.parse(readFileSync(marker, "utf8"))).toEqual(schema);
  });

  it("claude schema envelope 缺 structured_output 时 fail-closed", async () => {
    const { provider } = makeProvider({
      provider: "claude_cli",
      model: "claude-sonnet-5",
      binaryIdentity: { path: fakeCli, digest: binaryDigest, defaultModel: "claude-sonnet-5" }
    });
    await expect(
      provider.chat({
        messages: [{ role: "user", content: "fake:claude-schema-missing" }],
        jsonSchema: schema as unknown as Record<string, unknown>
      })
    ).resolves.toMatchObject({ ok: false, code: "voided_unknown_event" });
  });

  it("UTF-8 多字节字符跨 stdout chunk 不得静默损坏", async () => {
    const { provider } = makeProvider();
    await expect(provider.chat({ messages: [{ role: "user", content: "fake:split-utf8" }] })).resolves.toMatchObject({
      ok: true,
      text: "中文完整"
    });
  });

  it("cursor 内嵌 schema 指令;违反 schema 重试一次后拒绝", async () => {
    const marker = join(testDir, "cursor-schema.txt");
    const okProvider = makeProvider().provider;
    await expect(
      okProvider.chat({
        messages: [{ role: "user", content: `fake:schema-ok:${marker}` }],
        jsonSchema: schema as unknown as Record<string, unknown>
      })
    ).resolves.toMatchObject({ ok: true, observedModelSource: "stream", observedModelExempted: false });
    expect(readFileSync(marker, "utf8")).toBe("cursor-prompt-schema");

    const rejected = makeProvider();
    await expect(
      rejected.provider.chat({
        messages: [{ role: "user", content: "fake:schema-reject" }],
        jsonSchema: schema as unknown as Record<string, unknown>
      })
    ).resolves.toMatchObject({ ok: false, code: "invalid_structured_output" });
    expect(rejected.audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("Cursor 首答只违反 zod 侧约束时也由同一 JSON Schema 触发一次严格重试", async () => {
    const retried = makeProvider();
    await expect(
      retried.provider.chat({
        messages: [{ role: "user", content: "fake:schema-zod-only" }],
        jsonSchema: DRAFT_JSON_SCHEMA as unknown as Record<string, unknown>
      })
    ).resolves.toMatchObject({ ok: true, text: expect.stringContaining("重试通过") });
    expect(retried.audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("网络型非零退出只重试一次后成功", async () => {
    const marker = join(testDir, "network-once.state");
    const { provider, audit } = makeProvider({ networkRetryLimit: 1 });
    await expect(provider.chat({ messages: [{ role: "user", content: `fake:network-once:${marker}` }] })).resolves.toMatchObject({
      ok: true,
      text: "retried-ok"
    });
    const invocation = audit.events.find((event) => event.action === "byoa.invocation");
    expect(invocation?.meta?.["attempts"]).toBe(2);
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("首轮已出现 tripwire 时即刻终止且不得借网络错误重试", async () => {
    const marker = join(testDir, "network-unsafe.state");
    const { provider, audit } = makeProvider({ networkRetryLimit: 1 });
    await expect(
      provider.chat({ messages: [{ role: "user", content: `fake:network-unsafe-once:${marker}` }] })
    ).resolves.toMatchObject({ ok: false, code: "voided_tripwire" });
    expect(readFileSync(marker, "utf8")).toBe("first");
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(1);
  });

  it("tripwire 且零消费时带强化禁令重试一次,干净响应可用", async () => {
    const marker = join(testDir, "tripwire-once.state");
    const { provider, audit } = makeProvider();
    await expect(
      provider.chat({ messages: [{ role: "user", content: `fake:tripwire-once:${marker}` }] })
    ).resolves.toMatchObject({ ok: true, text: "tripwire-retry-ok" });
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("tripwire 零消费强化重试后再次触发仍如实失败", async () => {
    const { provider, audit } = makeProvider();
    await expect(
      provider.chat({ messages: [{ role: "user", content: "fake:tripwire-repeat" }] })
    ).resolves.toMatchObject({
      ok: false,
      code: "voided_tripwire",
      message: expect.stringMatching(/^CLI 尝试调用工具,已终止\(触发内容:/)
    });
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("tool event 的异族 model 优先作废且不得被 tripwire 重试洗白", async () => {
    const marker = join(testDir, "tripwire-model.state");
    const { provider, audit } = makeProvider({
      provider: "codex_cli",
      model: "gpt-5.6-luna",
      expectedFamily: "gpt",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    await expect(
      provider.chat({ messages: [{ role: "user", content: `fake:tripwire-model-mismatch-once:${marker}` }] })
    ).resolves.toMatchObject({ ok: false, code: "voided_family_mismatch" });
    expect(readFileSync(marker, "utf8")).toBe("first");
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(1);
  });

  it("Claude 同事件已有正文再触发工具时不得按零消费重试", async () => {
    const marker = join(testDir, "tripwire-after-text.state");
    const { provider, audit } = makeProvider({
      provider: "claude_cli",
      model: "claude-sonnet-5",
      binaryIdentity: { path: fakeCli, digest: binaryDigest }
    });
    await expect(
      provider.chat({ messages: [{ role: "user", content: `fake:tripwire-after-text-once:${marker}` }] })
    ).resolves.toMatchObject({ ok: false, code: "voided_tripwire" });
    expect(readFileSync(marker, "utf8")).toBe("first");
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(1);
  });

  it("tripwire 强化重试已消费唯一预算,Cursor schema 失败不得第三发", async () => {
    const marker = join(testDir, "tripwire-schema.state");
    const { provider, audit } = makeProvider();
    await expect(
      provider.chat({
        messages: [{ role: "user", content: `fake:tripwire-cursor-schema:${marker}` }],
        jsonSchema: schema as unknown as Record<string, unknown>
      })
    ).resolves.toMatchObject({ ok: false, code: "invalid_structured_output" });
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("首轮 tripwire 记账失败时不以强化重试洗成成功", async () => {
    const marker = join(testDir, "tripwire-accounting.state");
    let accountingCalls = 0;
    const { provider, audit } = makeProvider({
      onSubscriptionInvocation: () => {
        accountingCalls++;
        if (accountingCalls === 1) throw new Error("first ledger write failed");
      }
    });
    await expect(
      provider.chat({ messages: [{ role: "user", content: `fake:tripwire-once:${marker}` }] })
    ).resolves.toMatchObject({ ok: false, code: "cost_ledger_failed" });
    expect(accountingCalls).toBe(1);
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(1);
    expect(audit.events.filter((event) => event.action === "byoa.subscription_accounting_failed")).toHaveLength(1);
  });

  it("无尾换行的 tripwire 也不得借网络错误重试洗白", async () => {
    const marker = join(testDir, "network-unsafe-no-newline.state");
    const { provider, audit } = makeProvider({ networkRetryLimit: 1 });
    await expect(
      provider.chat({ messages: [{ role: "user", content: `fake:network-unsafe-no-newline:${marker}` }] })
    ).resolves.toMatchObject({ ok: false, code: "voided_tripwire" });
    expect(readFileSync(marker, "utf8")).toBe("first");
    expect(audit.events.filter((event) => event.action === "byoa.invocation")).toHaveLength(2);
  });

  it("记账回调异常不会让 Promise 裸 reject,但结果 fail-closed", async () => {
    const { provider, audit } = makeProvider({
      onSubscriptionInvocation: () => {
        throw new Error("ledger unavailable");
      }
    });
    await expect(provider.chat({ messages: [{ role: "user", content: "ok" }] })).resolves.toMatchObject({
      ok: false,
      code: "cost_ledger_failed"
    });
    expect(audit.events.some((event) => event.action === "byoa.invocation")).toBe(true);
    expect(audit.events.some((event) => event.action === "byoa.subscription_accounting_failed")).toBe(true);
  });

  it("per-CLI=1、全局=2;同 CLI 排队且不同 CLI 可并行", async () => {
    const limiter = new ByoaConcurrencyLimiter({ perCliLimit: 1, globalLimit: 2, maxQueue: 4 });
    const cursor = makeProvider({ concurrencyLimiter: limiter }).provider;
    const claude = makeProvider({ provider: "claude_cli", model: "claude-sonnet-5", concurrencyLimiter: limiter }).provider;
    const first = cursor.chat({ messages: [{ role: "user", content: "fake:delay" }] });
    await waitUntil(() => limiter.snapshot().globalActive === 1);
    const second = cursor.chat({ messages: [{ role: "user", content: "fake:delay" }] });
    const other = claude.chat({ messages: [{ role: "user", content: "fake:delay" }] });
    await waitUntil(() => limiter.snapshot().globalActive === 2 && limiter.snapshot().queued === 1);
    expect((await Promise.all([first, second, other])).every((result) => result.ok)).toBe(true);
    expect(limiter.snapshot()).toMatchObject({ globalActive: 0, queued: 0 });
  });

  it("队满返回 busy;排队中的 AbortSignal 可撤销", async () => {
    const limiter = new ByoaConcurrencyLimiter({ perCliLimit: 1, globalLimit: 1, maxQueue: 1 });
    const provider = makeProvider({ concurrencyLimiter: limiter }).provider;
    const active = provider.chat({ messages: [{ role: "user", content: "fake:delay" }] });
    await waitUntil(() => limiter.snapshot().globalActive === 1);
    const controller = new AbortController();
    const queued = provider.chat({ messages: [{ role: "user", content: "fake:delay" }] }, controller.signal);
    await waitUntil(() => limiter.snapshot().queued === 1);
    await expect(provider.chat({ messages: [{ role: "user", content: "fake:delay" }] })).resolves.toMatchObject({
      ok: false,
      code: "busy"
    });
    controller.abort();
    await expect(queued).resolves.toMatchObject({ ok: false, code: "cancelled" });
    await expect(active).resolves.toMatchObject({ ok: true });
  });
});
