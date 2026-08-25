// T18a-2 三槽 CLI 接线:真实 fake 进程 self-test、双 ack、runtime 登记与订阅记账。

import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildSetupProbe, pendingCliSelfTestGate, runSetupTest } from "../src/api/setup.js";
import { recordCliSubscriptionInvocation } from "../src/cost/ledger.js";
import type { CliCapability, CliName } from "../src/config/cliCapability.js";
import {
  cliRuntimePath,
  loadCliRuntimeRegistry,
  loadCliRuntimeReceiptIndex,
  loadPendingCliRuntimeRegistry,
  promotePendingCliRuntime,
  registerCliSelfTest,
  registeredCliSlot,
  shouldPromotePendingCliRuntime,
  type CliRuntimeRegistry
} from "../src/config/cliRuntime.js";
import { promotePendingFile, rollbackActivationFiles } from "../src/config/pending.js";
import { parseConfigText } from "../src/config/load.js";
import { validateConfig } from "../src/config/validate.js";
import type { AuditEvent, AuditSink } from "../src/obs/audit.js";
import { resolveEvaluatorProvider } from "../src/providers/slotResolvers.js";
import { openDb } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import {
  configureRuntimeChildRegistry,
  resetRuntimeChildLifecycleForTests
} from "../src/runtimeChildRegistry.js";

const sourceFakeCli = fileURLToPath(new URL("./fixtures/fake-byoa-cli.mjs", import.meta.url));

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function makeHome(): {
  home: string;
  cli: string;
  digest: string;
  runtimeAudit: ReturnType<typeof auditCollector>;
} {
  const home = mkdtempSync(join(tmpdir(), "saydo-t18a-slots-"));
  configureRuntimeChildRegistry(home);
  const cli = join(home, "fake-byoa-cli.mjs");
  copyFileSync(sourceFakeCli, cli);
  chmodSync(cli, 0o755);
  return { home, cli, digest: sha256(cli), runtimeAudit: auditCollector() };
}

afterEach(() => {
  try {
    resetRuntimeChildLifecycleForTests();
  } catch {
    // 污染由本测断言覆盖
  }
});

function capability(name: CliName, cli: string, digest: string): CliCapability {
  return {
    name,
    provider:
      name === "codex" ? "codex_cli" : name === "claude" ? "claude_cli" : name === "grok" ? "grok_cli" : "cursor_cli",
    label: name,
    found: true,
    path: cli,
    binaryDigest: digest,
    auth: { status: "logged_in" },
    enumerable: false,
    models: []
  };
}

function cliConfig(failSlot?: "thinking" | "cheap" | "evaluator") {
  const thinkingModel = failSlot === "thinking" ? "claude-sonnet-5-fail" : "claude-sonnet-5";
  const cheapModel = failSlot === "cheap" ? "gemini-3.1-flash-lite-fail" : "gemini-3.1-flash-lite";
  const evaluatorModel = failSlot === "evaluator" ? "gpt-5.6-luna-fail" : "gpt-5.6-luna";
  return parseConfigText(`
[models]
profile = "default"
evaluator_same_family_ack = true
evaluator_isolation_ack = true
dialog = { provider = "api", model = "anthropic/claude-sonnet-5" }
thinking = { provider = "claude_cli", model = "${thinkingModel}" }
cheap = { provider = "cursor_cli", model = "${cheapModel}" }
evaluator = { provider = "codex_cli", model = "${evaluatorModel}", reasoning = "high" }
`);
}

function writeConfig(home: string, failSlot?: "thinking" | "cheap" | "evaluator"): void {
  const cfg = cliConfig(failSlot);
  const model = (slot: "thinking" | "cheap" | "evaluator"): string => {
    const binding = cfg.models[slot];
    return typeof binding === "string" ? binding : "model" in binding ? binding.model ?? "" : "";
  };
  writeFileSync(
    join(home, "config.toml"),
    `[models]\nprofile = "default"\nevaluator_same_family_ack = true\nevaluator_isolation_ack = true\n` +
      `dialog = { provider = "api", model = "anthropic/claude-sonnet-5" }\n` +
      `thinking = { provider = "claude_cli", model = "${model("thinking")}" }\n` +
      `cheap = { provider = "cursor_cli", model = "${model("cheap")}" }\n` +
      `evaluator = { provider = "codex_cli", model = "${model("evaluator")}", reasoning = "high" }\n`,
    { mode: 0o600 }
  );
}

function auditCollector(): { events: AuditEvent[]; receipts: Map<string, string>; sink: AuditSink } {
  const events: AuditEvent[] = [];
  const receipts = new Map<string, string>();
  return {
    events,
    receipts,
    sink: {
      record(event) {
        events.push(event);
        const id = `aud_${events.length}`;
        if (event.action === "config.cli_runtime_registered" && event.refDigest) {
          receipts.set(id, event.refDigest);
        }
        return { id };
      }
    }
  };
}

describe("T18a 三槽 CLI runtime", () => {
  it("含 CLI 的 staged 配置在四槽真实 self-test 齐全前不得晋升", async () => {
    const { home, cli, digest, runtimeAudit: audit } = makeHome();
    writeFileSync(
      join(home, "config.toml.pending"),
      `[models]\nprofile = "default"\nevaluator_same_family_ack = true\nevaluator_isolation_ack = true\n` +
        `dialog = { provider = "codex_cli", model = "gpt-5.6-luna" }\n` +
        `thinking = { provider = "codex_cli", model = "gpt-5.6-luna" }\n` +
        `cheap = { provider = "codex_cli", model = "gpt-5.6-luna" }\n` +
        `evaluator = { provider = "codex_cli", model = "gpt-5.6-luna" }\n`,
      { mode: 0o600 }
    );
    expect(pendingCliSelfTestGate(home, audit.receipts)).toEqual({
      ok: false,
      missingSlots: ["dialog", "thinking", "cheap", "evaluator"]
    });

    const tested = await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async () => capability("codex", cli, digest),
      cliRuntimeReceipts: audit.receipts,
      audit: audit.sink
    });
    for (const slot of ["dialog", "thinking", "cheap", "evaluator"] as const) {
      expect(tested.slots[slot]?.status, slot).toBe("ok");
    }
    expect(pendingCliSelfTestGate(home, audit.receipts)).toEqual({ ok: true });
    writeFileSync(
      join(home, "config.toml.pending"),
      `${readFileSync(join(home, "config.toml.pending"), "utf8")}\n# changed after self-test\n`,
      { mode: 0o600 }
    );
    expect(pendingCliSelfTestGate(home, audit.receipts)).toEqual({
      ok: false,
      missingSlots: ["dialog", "thinking", "cheap", "evaluator"]
    });
  });

  it("只有 env pending 时也必须绑定自检 activation,自检后改写 env 立即失效", async () => {
    const { home, cli, digest, runtimeAudit: audit } = makeHome();
    writeConfig(home);
    writeFileSync(join(home, ".env.pending"), "UNRELATED_FLAG=one\n", { mode: 0o600 });
    await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      cliRuntimeReceipts: audit.receipts,
      audit: audit.sink
    });
    expect(pendingCliSelfTestGate(home, audit.receipts)).toEqual({ ok: true });
    writeFileSync(join(home, ".env.pending"), "UNRELATED_FLAG=two\n", { mode: 0o600 });
    expect(pendingCliSelfTestGate(home, audit.receipts)).toEqual({
      ok: false,
      missingSlots: ["thinking", "cheap", "evaluator"]
    });
  });

  it("真实 fake CLI 逐槽 self-test 后由 unarmed 投影为 active,并固化四字段证据", async () => {
    const { home, cli, digest, runtimeAudit: audit } = makeHome();
    writeConfig(home);
    const invocations: Array<{ slot: string; provider: string; requests: number }> = [];

    const before = await buildSetupProbe({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliRuntimeReceipts: audit.receipts,
      skipCliProbe: true
    });
    expect(before.config.slots.thinking).toMatchObject({ effective: "unarmed", reason: "cli_self_test_required" });
    expect(before.config.slots.cheap).toMatchObject({ effective: "unarmed", reason: "cli_self_test_required" });
    expect(before.config.slots.evaluator).toMatchObject({ effective: "unarmed", reason: "cli_self_test_required" });

    const tested = await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      cliRuntimeReceipts: audit.receipts,
      onSubscriptionInvocation: (slot, invocation) => invocations.push({ slot, ...invocation }),
      audit: audit.sink
    });
    for (const slot of ["thinking", "cheap", "evaluator"] as const) {
      expect(tested.slots[slot]).toMatchObject({ status: "ok" });
    }
    expect(tested.slots.thinking).toMatchObject({
      requestedModel: "claude-sonnet-5",
      observedModel: "claude-sonnet-5",
      observedModelSource: "stream",
      observedModelExempted: false
    });
    expect(tested.slots.cheap).toMatchObject({
      requestedModel: "gemini-3.1-flash-lite",
      observedModel: "gemini-3.1-flash-lite",
      observedModelSource: "stream",
      observedModelExempted: false
    });
    expect(tested.slots.evaluator).toMatchObject({
      requestedModel: "gpt-5.6-luna",
      observedModelSource: "verified_binary_default",
      observedModelExempted: true
    });
    expect(tested.slots.evaluator?.observedModel).toBeUndefined();

    const registry = loadCliRuntimeRegistry(home);
    expect(Object.values(registry.registrations).map((row) => row.slot).sort()).toEqual(["cheap", "evaluator", "thinking"]);
    expect(registeredCliSlot(registry, "evaluator", cliConfig().models.evaluator, audit.receipts)).toMatchObject({
      binaryPath: cli,
      binaryDigest: digest,
      expectedFamily: "gpt",
      requestedModel: "gpt-5.6-luna",
      observedModelSource: "verified_binary_default",
      observedModelExempted: true
    });
    expect(registeredCliSlot(registry, "evaluator", cliConfig().models.evaluator, audit.receipts)?.observedModel).toBeUndefined();
    expect(invocations.map((item) => item.slot).sort()).toEqual(["cheap", "evaluator", "thinking"]);
    expect(invocations.every((item) => item.requests === 1)).toBe(true);
    expect(audit.events.filter((event) => event.action === "config.cli_runtime_registered")).toHaveLength(3);
    expect(
      audit.events
        .filter((event) => event.action === "config.cli_runtime_registered")
        .every((event) => event.meta?.["target"] === "active")
    ).toBe(true);
    expect(audit.events.some((event) => event.action === "provider.observed_model_exemption")).toBe(true);

    const after = await buildSetupProbe({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliRuntimeReceipts: audit.receipts,
      skipCliProbe: true
    });
    for (const slot of ["thinking", "cheap", "evaluator"] as const) {
      expect(after.config.slots[slot].effective).toBe("active");
    }
  });

  it.each(["thinking", "cheap", "evaluator"] as const)("%s 真实进程 self-test 失败只标红本槽", async (slot) => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    writeConfig(home, slot);
    const tested = await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts
    });
    expect(tested.slots[slot]).toMatchObject({ status: "fail", error: expect.stringContaining("请求失败") });
    expect(
      registeredCliSlot(loadCliRuntimeRegistry(home), slot, cliConfig(slot).models[slot], runtimeAudit.receipts)
    ).toBeUndefined();
    for (const other of (["thinking", "cheap", "evaluator"] as const).filter((item) => item !== slot)) {
      expect(tested.slots[other]?.status).toBe("ok");
    }
  });

  it("pending binding 自检成败都不污染活动 binding 的 runtime 登记", async () => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    writeConfig(home);
    await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts
    });
    const activeBinding = cliConfig().models.evaluator;
    expect(
      registeredCliSlot(loadCliRuntimeRegistry(home), "evaluator", activeBinding, runtimeAudit.receipts)
    ).toBeDefined();

    const activeText = readFileSync(join(home, "config.toml"), "utf8");
    const candidateModelText = activeText.replace("gpt-5.6-luna", "gpt-5.6-sol");
    writeFileSync(join(home, "config.toml.pending"), `${candidateModelText}\n# candidate A\n`, { mode: 0o600 });
    const pendingAudit = runtimeAudit;
    const pendingOk = await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      cliRuntimeReceipts: pendingAudit.receipts,
      audit: pendingAudit.sink
    });
    expect(pendingOk.configSource).toBe("pending");
    expect(pendingOk.slots.evaluator?.status).toBe("ok");
    const pendingRegistrationEvents = pendingAudit.events.filter(
      (event) => event.action === "config.cli_runtime_registered" && event.meta?.["target"] === "pending"
    );
    expect(pendingRegistrationEvents).toHaveLength(3);
    expect(
      pendingRegistrationEvents.every((event) => typeof event.meta?.["activationConfigDigest"] === "string")
    ).toBe(true);
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "evaluator", activeBinding, pendingAudit.receipts)).toBeDefined();

    writeFileSync(join(home, "config.toml.pending"), `${candidateModelText}\n# candidate B\n`, {
      mode: 0o600
    });
    const pendingFail = await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: pendingAudit.sink,
      cliRuntimeReceipts: pendingAudit.receipts,
      slotChatFn: async (slot, _req, callIndex) => {
        if (slot === "evaluator") return { ok: false, code: "forced", message: "forced", retryable: false };
        if (slot === "dialog" && callIndex === 0) {
          return {
            ok: true,
            text: "",
            toolCalls: [{ id: "self-test", name: "saydo_self_test", arguments: '{"value":"ping"}' }],
            requestedModel: "anthropic/claude-sonnet-5",
            observedModel: "anthropic/claude-sonnet-5",
            observedModelSource: "stream",
            observedModelExempted: false,
            usage: undefined
          };
        }
        const observedModel =
          slot === "dialog"
            ? "anthropic/claude-sonnet-5"
            : slot === "thinking"
              ? "claude-sonnet-5"
              : "gemini-3.1-flash-lite";
        return {
          ok: true,
          text:
            slot === "cheap"
              ? JSON.stringify({
                  outcomePreview: "自检",
                  inScope: ["setup"],
                  outOfScope: [],
                  acceptance: ["返回合同"],
                  plan: [{ seq: 1, step: "检查", owner: "ai" }],
                  risks: []
                })
              : "自检通过",
          requestedModel: observedModel,
          observedModel,
          observedModelSource: "stream",
          observedModelExempted: false,
          usage: undefined
        };
      }
    });
    expect(pendingFail.slots.evaluator?.status).toBe("fail");
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "evaluator", activeBinding, pendingAudit.receipts)).toBeDefined();
    expect(Object.values(loadPendingCliRuntimeRegistry(home).registrations).map((row) => row.slot).sort()).toEqual([
      "cheap",
      "thinking"
    ]);
    const activeProbe = await buildSetupProbe({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliRuntimeReceipts: pendingAudit.receipts,
      skipCliProbe: true
    });
    expect(activeProbe.config.slots.evaluator.effective).toBe("active");

    const failedPendingText = readFileSync(join(home, "config.toml.pending"), "utf8");
    const failedPendingConfig = parseConfigText(failedPendingText);
    writeFileSync(join(home, "config.toml"), failedPendingText, { mode: 0o600 });
    unlinkSync(join(home, "config.toml.pending"));
    const partialPromotion = promotePendingCliRuntime(
      home,
      {
        thinking: failedPendingConfig.models.thinking,
        cheap: failedPendingConfig.models.cheap,
        evaluator: failedPendingConfig.models.evaluator
      },
      pendingAudit.sink,
      pendingAudit.receipts,
      loadPendingCliRuntimeRegistry(home).activation
    );
    expect(partialPromotion.promoted).toBe(0);
    expect(partialPromotion.promotedBindings).toEqual([]);
    expect(existsSync(join(home, "cli-runtime.pending.json"))).toBe(true);
    // 候选失败不发布新登记,但同 binding 的旧 active 登记必须原样保留。
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "thinking", failedPendingConfig.models.thinking, pendingAudit.receipts)).toBeDefined();
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "cheap", failedPendingConfig.models.cheap, pendingAudit.receipts)).toBeDefined();
    expect(
      registeredCliSlot(
        loadCliRuntimeRegistry(home),
        "evaluator",
        failedPendingConfig.models.evaluator,
        pendingAudit.receipts
      )
    ).toBeUndefined();
  });

  it("pending 与 active 同 binding 时使用独立 runtime 登记,晋升前不得覆盖或清除活动证据", async () => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    writeConfig(home);
    await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts,
      now: () => new Date("2026-08-11T01:00:00.000Z")
    });
    const cfg = cliConfig();
    const activeBefore = registeredCliSlot(
      loadCliRuntimeRegistry(home),
      "evaluator",
      cfg.models.evaluator,
      runtimeAudit.receipts
    );
    expect(activeBefore?.testedAt).toBe("2026-08-11T01:00:00.000Z");

    const activeText = readFileSync(join(home, "config.toml"), "utf8");
    writeFileSync(join(home, "config.toml.pending"), `${activeText}\n[budget]\nmonthly = 99\n`, {
      mode: 0o600
    });
    await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts,
      now: () => new Date("2026-08-11T02:00:00.000Z")
    });
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "evaluator", cfg.models.evaluator, runtimeAudit.receipts)?.testedAt).toBe(
      "2026-08-11T01:00:00.000Z"
    );
    expect(
      registeredCliSlot(loadPendingCliRuntimeRegistry(home), "evaluator", cfg.models.evaluator, runtimeAudit.receipts)?.testedAt
    ).toBe(
      "2026-08-11T02:00:00.000Z"
    );

    await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts,
      slotChatFn: async (slot) =>
        slot === "evaluator"
          ? { ok: false, code: "forced", message: "forced pending failure", retryable: false }
          : {
              ok: true,
              text: slot === "cheap" ? JSON.stringify({
                outcomePreview: "自检",
                inScope: ["setup"],
                outOfScope: [],
                acceptance: ["返回合同"],
                plan: [{ seq: 1, step: "检查", owner: "ai" }],
                risks: []
              }) : "自检通过",
              requestedModel: slot === "thinking" ? "claude-sonnet-5" : "gemini-3.1-flash-lite",
              observedModel: slot === "thinking" ? "claude-sonnet-5" : "gemini-3.1-flash-lite",
              observedModelSource: "stream",
              observedModelExempted: false,
              usage: undefined
            }
    });
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "evaluator", cfg.models.evaluator, runtimeAudit.receipts)?.testedAt).toBe(
      "2026-08-11T01:00:00.000Z"
    );
    expect(
      registeredCliSlot(loadPendingCliRuntimeRegistry(home), "evaluator", cfg.models.evaluator, runtimeAudit.receipts)
    ).toBeUndefined();

    await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts,
      now: () => new Date("2026-08-11T03:00:00.000Z")
    });
    writeFileSync(join(home, "config.toml"), readFileSync(join(home, "config.toml.pending")));
    unlinkSync(join(home, "config.toml.pending"));
    const promoted = promotePendingCliRuntime(
      home,
      {
        thinking: cfg.models.thinking,
        cheap: cfg.models.cheap,
        evaluator: cfg.models.evaluator
      },
      runtimeAudit.sink,
      runtimeAudit.receipts,
      loadPendingCliRuntimeRegistry(home).activation
    );
    expect(promoted).toMatchObject({ promoted: 3 });
    expect(promoted.promotedBindings.map((row) => row.slot).sort()).toEqual(["cheap", "evaluator", "thinking"]);
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "evaluator", cfg.models.evaluator, runtimeAudit.receipts)?.testedAt).toBe(
      "2026-08-11T03:00:00.000Z"
    );
  });

  it("codex 留空使用 CLI 默认时以固定家族身份登记,observedModel 不编造", async () => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    writeConfig(home);
    const activeText = readFileSync(join(home, "config.toml"), "utf8");
    writeFileSync(
      join(home, "config.toml"),
      activeText.replace(', model = "gpt-5.6-luna"', ""),
      { mode: 0o600 }
    );
    const tested = await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts
    });
    expect(tested.slots.evaluator).toMatchObject({
      status: "ok",
      observedModelSource: "verified_binary_default",
      observedModelExempted: true
    });
    expect(tested.slots.evaluator?.observedModel).toBeUndefined();
    const cfg = parseConfigText(readFileSync(join(home, "config.toml"), "utf8"));
    const registration = registeredCliSlot(
      loadCliRuntimeRegistry(home),
      "evaluator",
      cfg.models.evaluator,
      runtimeAudit.receipts
    );
    expect(registration).toMatchObject({
      observedModelSource: "verified_binary_default",
      observedModelExempted: true,
      expectedFamily: "gpt"
    });
    expect(registration?.observedModel).toBeUndefined();
  });

  it("staged runtime 只在目标文件已晋升时生效,二进制漂移时回滚文件并保留证据", async () => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    writeConfig(home);
    const activeConfig = readFileSync(join(home, "config.toml"), "utf8");
    const stagedConfig = `${activeConfig}\n# staged activation\n`;
    writeFileSync(join(home, "config.toml.pending"), stagedConfig, { mode: 0o600 });
    await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts
    });
    const noPendingStatus = {
      config: { ok: true, promoted: false },
      env: { ok: true, promoted: false }
    };
    expect(
      shouldPromotePendingCliRuntime(home, noPendingStatus)
    ).toBe(false);

    const filePromotion = promotePendingFile(home, "config.toml");
    expect(filePromotion).toMatchObject({ ok: true, promoted: true });
    expect(shouldPromotePendingCliRuntime(home, noPendingStatus)).toBe(true);
    expect(
      shouldPromotePendingCliRuntime(home, {
        config: { ok: false, promoted: false },
        env: { ok: true, promoted: true }
      })
    ).toBe(false);

    writeFileSync(cli, `${readFileSync(cli, "utf8")}\n// binary drift\n`, { mode: 0o755 });
    const activation = loadPendingCliRuntimeRegistry(home).activation;
    const stagedCfg = parseConfigText(stagedConfig);
    const runtimePromotion = promotePendingCliRuntime(
      home,
      {
        thinking: stagedCfg.models.thinking,
        cheap: stagedCfg.models.cheap,
        evaluator: stagedCfg.models.evaluator
      },
      runtimeAudit.sink,
      runtimeAudit.receipts,
      activation
    );
    expect(runtimePromotion.promoted).toBe(0);
    expect(
      rollbackActivationFiles(home, activation, {
        config: filePromotion,
        env: { ok: true, promoted: false, reason: "no_pending" }
      })
    ).toEqual({ ok: true });
    expect(readFileSync(join(home, "config.toml"), "utf8")).toBe(activeConfig);
    expect(readFileSync(join(home, "config.toml.pending"), "utf8")).toBe(stagedConfig);
    expect(existsSync(join(home, "cli-runtime.pending.json"))).toBe(true);
  });

  it("evaluator 双 ack 四态中只有双齐且登记命中时 armed", async () => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    writeConfig(home);
    await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts
    });
    const registry = loadCliRuntimeRegistry(home);
    for (const same of [false, true]) {
      for (const isolation of [false, true]) {
        const cfg = cliConfig();
        cfg.models.evaluator_same_family_ack = same;
        cfg.models.evaluator_isolation_ack = isolation;
        const validated = validateConfig({ config: cfg, env: {} });
        expect(validated.ok).toBe(true);
        const result = resolveEvaluatorProvider(cfg, {}, undefined, undefined, {
          registry,
          receipts: runtimeAudit.receipts
        });
        expect(result.effective).toBe(same && isolation ? "active" : "unarmed");
        if (!same) expect(result.reason).toBe("same_family_blocked");
        else if (!isolation) expect(result.reason).toBe("isolation_ack_required");
      }
    }
  });

  it("Codex evaluator resolver 把 binding.reasoning 传进真实 cage argv", async () => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    writeConfig(home);
    await runSetupTest({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts
    });
    const cfg = cliConfig();
    const resolved = resolveEvaluatorProvider(cfg, {}, undefined, undefined, {
      registry: loadCliRuntimeRegistry(home),
      receipts: runtimeAudit.receipts
    });
    expect(resolved.effective).toBe("active");
    await expect(
      resolved.provider?.chat({ messages: [{ role: "user", content: "fake:reasoning-high" }] })
    ).resolves.toMatchObject({ ok: true, text: "reasoning-ok" });
  });

  it("API evaluator 按 thinking 的真实 active/fallback 家族判同族", () => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    const cfg = parseConfigText(`
[models]
profile = "default"
dialog = { provider = "api", model = "openai/gpt-5.6-luna" }
thinking = { provider = "claude_cli", model = "claude-sonnet-5" }
cheap = { provider = "api", model = "google/gemini-3.1-flash-lite" }
evaluator = { provider = "api", model = "anthropic/claude-sonnet-5" }
`);
    expect(resolveEvaluatorProvider(cfg, { OPENAI_API_KEY: "k" }, undefined, undefined, {
      registry: loadCliRuntimeRegistry(home),
      receipts: runtimeAudit.receipts
    }).effective).toBe("active");

    registerCliSelfTest(home, cfg.models.thinking, {
      slot: "thinking",
      provider: "claude_cli",
      binaryPath: cli,
      binaryDigest: digest,
      expectedFamily: "claude",
      requestedModel: "claude-sonnet-5",
      observedModel: "claude-sonnet-5",
      observedModelSource: "stream",
      observedModelExempted: false,
      testedAt: "2026-08-11T00:00:00.000Z"
    }, runtimeAudit.sink);
    expect(resolveEvaluatorProvider(cfg, { OPENAI_API_KEY: "k" }, undefined, undefined, {
      registry: loadCliRuntimeRegistry(home),
      receipts: runtimeAudit.receipts
    })).toMatchObject({ effective: "unarmed", reason: "same_family_blocked" });
  });

  it("binding 变化、unknown 登记与 binary digest 漂移都不能继续武装", async () => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    const binding = { provider: "codex_cli", model: "gpt-5.6-luna", reasoning: "high" } as const;
    registerCliSelfTest(home, binding, {
      slot: "evaluator",
      provider: "codex_cli",
      binaryPath: cli,
      binaryDigest: digest,
      expectedFamily: "gpt",
      requestedModel: "gpt-5.6-luna",
      observedModelSource: "verified_binary_default",
      observedModelExempted: true,
      testedAt: "2026-08-11T00:00:00.000Z"
    }, runtimeAudit.sink);
    const cfg = cliConfig();
    const audit = auditCollector();
    expect(
      resolveEvaluatorProvider(cfg, {}, undefined, audit.sink, {
        registry: loadCliRuntimeRegistry(home),
        receipts: runtimeAudit.receipts
      }).effective
    ).toBe("active");
    cfg.models.evaluator = { provider: "codex_cli", model: "gpt-5.6-sol" };
    expect(resolveEvaluatorProvider(cfg, {}, undefined, audit.sink, {
      registry: loadCliRuntimeRegistry(home),
      receipts: runtimeAudit.receipts
    })).toMatchObject({
      effective: "unarmed",
      reason: "cli_self_test_required"
    });
    expect(audit.events.at(-1)).toMatchObject({
      action: "provider.cli_runtime_rejected",
      meta: { slot: "evaluator", provider: "codex_cli", reason: "cli_self_test_required" }
    });

    const raw = JSON.parse(readFileSync(cliRuntimePath(home), "utf8")) as {
      registrations: Record<string, Record<string, unknown>>;
    };
    const evaluatorKey = Object.keys(raw.registrations).find((key) => key.startsWith("evaluator:"))!;
    raw.registrations[evaluatorKey]!.observedModelSource = "unknown";
    writeFileSync(cliRuntimePath(home), `${JSON.stringify(raw)}\n`, { mode: 0o600 });
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "evaluator", binding, runtimeAudit.receipts)).toBeUndefined();

    raw.registrations[evaluatorKey]!.observedModelSource = "stream";
    raw.registrations[evaluatorKey]!.observedModel = "";
    raw.registrations[evaluatorKey]!.observedModelExempted = false;
    writeFileSync(cliRuntimePath(home), `${JSON.stringify(raw)}\n`, { mode: 0o600 });
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "evaluator", binding, runtimeAudit.receipts)).toBeUndefined();

    cfg.models.evaluator = binding;
    registerCliSelfTest(home, binding, {
      slot: "evaluator",
      provider: "codex_cli",
      binaryPath: cli,
      binaryDigest: digest,
      expectedFamily: "gpt",
      observedModelSource: "verified_binary_default",
      observedModelExempted: true,
      testedAt: "2026-08-11T00:00:00.000Z"
    }, runtimeAudit.sink);
    const active = resolveEvaluatorProvider(cfg, {}, undefined, audit.sink, {
      registry: loadCliRuntimeRegistry(home),
      receipts: runtimeAudit.receipts
    });
    writeFileSync(cli, `${readFileSync(cli, "utf8")}\n// digest drift\n`, { mode: 0o755 });
    writeConfig(home);
    const driftedProbe = await buildSetupProbe({
      saydoHome: home,
      processEnv: {},
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliRuntimeReceipts: runtimeAudit.receipts,
      skipCliProbe: true
    });
    expect(driftedProbe.config.slots.evaluator).toMatchObject({
      effective: "unarmed",
      reason: "cli_self_test_required"
    });
    await expect(active.provider?.chat({ messages: [{ role: "user", content: "test" }] })).resolves.toMatchObject({
      ok: false,
      code: "binary_identity_mismatch"
    });
    expect(audit.events.at(-1)).toMatchObject({
      action: "provider.cli_runtime_rejected",
      meta: {
        provider: "codex_cli",
        reason: "binary_identity_mismatch",
        registeredBinaryDigest: digest
      }
    });
    expect(audit.events.at(-1)?.meta?.["actualBinaryDigest"]).not.toBe(digest);
  });

  it("registry 行必须与不可变 audit receipt 逐字段交叉核对,手写文件不能武装", () => {
    const source = makeHome();
    const binding = { provider: "claude_cli", model: "claude-sonnet-5" } as const;
    registerCliSelfTest(source.home, binding, {
      slot: "thinking",
      provider: "claude_cli",
      binaryPath: source.cli,
      binaryDigest: source.digest,
      expectedFamily: "claude",
      requestedModel: "claude-sonnet-5",
      observedModel: "claude-sonnet-5",
      observedModelSource: "stream",
      observedModelExempted: false,
      testedAt: "2026-08-11T00:00:00.000Z"
    }, source.runtimeAudit.sink);

    const target = makeHome();
    writeFileSync(cliRuntimePath(target.home), readFileSync(cliRuntimePath(source.home)), { mode: 0o600 });
    const db = openDb(join(target.home, "saydo.db"));
    expect(loadCliRuntimeReceiptIndex(db).size).toBe(0);
    expect(
      registeredCliSlot(loadCliRuntimeRegistry(target.home), "thinking", binding, loadCliRuntimeReceiptIndex(db))
    ).toBeUndefined();
    db.close();

    expect(() =>
      registerCliSelfTest(target.home, { provider: "codex_cli", model: "gpt-5.6-luna" }, {
        slot: "evaluator",
        provider: "codex_cli",
        binaryPath: target.cli,
        binaryDigest: target.digest,
        expectedFamily: "gpt",
        requestedModel: "gpt-5.6-luna",
        observedModel: "gpt-5.6-luna",
        observedModelSource: "verified_binary_default",
        observedModelExempted: true,
        testedAt: "2026-08-11T00:00:00.000Z"
      }, target.runtimeAudit.sink)
    ).toThrow("四字段证据不合法");
  });

  it("SQLite audit receipt 可重建 active 证据索引", () => {
    const { home, cli, digest } = makeHome();
    const db = openDb(join(home, "saydo.db"));
    const audit = createSqliteAuditSink(db, () => new Date("2026-08-11T00:00:00.000Z"));
    const binding = { provider: "claude_cli", model: "claude-sonnet-5" } as const;
    registerCliSelfTest(home, binding, {
      slot: "thinking",
      provider: "claude_cli",
      binaryPath: cli,
      binaryDigest: digest,
      expectedFamily: "claude",
      requestedModel: "claude-sonnet-5",
      observedModel: "claude-sonnet-5",
      observedModelSource: "stream",
      observedModelExempted: false,
      testedAt: "2026-08-11T00:00:00.000Z"
    }, audit);
    const receipts = loadCliRuntimeReceiptIndex(db);
    expect(receipts.size).toBe(1);
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "thinking", binding, receipts)).toBeDefined();
    db.close();
  });

  it("同 HOME 的单槽 pending receipt 不能靠复制武装或部分晋升", () => {
    const { home, cli, digest } = makeHome();
    writeConfig(home);
    const db = openDb(join(home, "saydo.db"));
    const audit = createSqliteAuditSink(db, () => new Date("2026-08-11T00:00:00.000Z"));
    const binding = { provider: "claude_cli", model: "claude-sonnet-5" } as const;
    const activation = {
      configDigest: createHash("sha256").update(readFileSync(join(home, "config.toml"))).digest("hex")
    };
    const pending = registerCliSelfTest(home, binding, {
      slot: "thinking",
      provider: "claude_cli",
      binaryPath: cli,
      binaryDigest: digest,
      expectedFamily: "claude",
      requestedModel: "claude-sonnet-5",
      observedModel: "claude-sonnet-5",
      observedModelSource: "stream",
      observedModelExempted: false,
      testedAt: "2026-08-11T00:00:00.000Z"
    }, audit, "pending", activation);

    writeFileSync(cliRuntimePath(home), readFileSync(join(home, "cli-runtime.pending.json")), { mode: 0o600 });
    expect(loadCliRuntimeReceiptIndex(db).has(pending.receipt.auditId)).toBe(false);
    expect(
      registeredCliSlot(loadCliRuntimeRegistry(home), "thinking", binding, loadCliRuntimeReceiptIndex(db))
    ).toBeUndefined();

    const cfg = cliConfig();
    const promoted = promotePendingCliRuntime(home, {
      thinking: binding,
      cheap: cfg.models.cheap,
      evaluator: cfg.models.evaluator
    }, audit, loadCliRuntimeReceiptIndex(db, "pending", activation), activation);
    expect(promoted.promoted).toBe(0);
    expect(existsSync(join(home, "cli-runtime.pending.json"))).toBe(true);
    const receipts = loadCliRuntimeReceiptIndex(db);
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "thinking", binding, receipts)).toBeUndefined();
    db.close();
  });

  it("手写 staged registry 复制旧候选 receipt 时不得经启动晋升洗为 active", () => {
    const { home, cli, digest } = makeHome();
    writeConfig(home);
    const db = openDb(join(home, "saydo.db"));
    const audit = createSqliteAuditSink(db, () => new Date("2026-08-11T00:00:00.000Z"));
    const binding = { provider: "claude_cli", model: "claude-sonnet-5" } as const;
    const activation = {
      configDigest: createHash("sha256").update(readFileSync(join(home, "config.toml"))).digest("hex")
    };
    registerCliSelfTest(home, binding, {
      slot: "thinking",
      provider: "claude_cli",
      binaryPath: cli,
      binaryDigest: digest,
      expectedFamily: "claude",
      requestedModel: "claude-sonnet-5",
      observedModel: "claude-sonnet-5",
      observedModelSource: "stream",
      observedModelExempted: false,
      testedAt: "2026-08-11T00:00:00.000Z"
    }, audit, "pending", activation);
    const forgedConfig = `${readFileSync(join(home, "config.toml"), "utf8")}\n# forged activation\n`;
    writeFileSync(join(home, "config.toml"), forgedConfig, { mode: 0o600 });
    const forgedActivation = { configDigest: createHash("sha256").update(forgedConfig).digest("hex") };
    const staged = JSON.parse(readFileSync(join(home, "cli-runtime.pending.json"), "utf8")) as CliRuntimeRegistry;
    staged.activation = forgedActivation;
    writeFileSync(join(home, "cli-runtime.pending.json"), JSON.stringify(staged), { mode: 0o600 });

    const cfg = cliConfig();
    const promoted = promotePendingCliRuntime(home, {
      thinking: binding,
      cheap: cfg.models.cheap,
      evaluator: cfg.models.evaluator
    }, audit, loadCliRuntimeReceiptIndex(db, "pending", forgedActivation), forgedActivation);
    expect(promoted.promoted).toBe(0);
    expect(registeredCliSlot(loadCliRuntimeRegistry(home), "thinking", binding, loadCliRuntimeReceiptIndex(db))).toBeUndefined();
    db.close();
  });

  it("thinking 登记后再解析 API evaluator,self-test 与生产投影同为 same-family unarmed", async () => {
    const { home, cli, digest, runtimeAudit } = makeHome();
    writeFileSync(join(home, "config.toml"), `
[models]
profile = "default"
dialog = { provider = "api", model = "openai/gpt-5.6-luna" }
thinking = { provider = "claude_cli", model = "claude-sonnet-5" }
cheap = { provider = "api", model = "google/gemini-3.1-flash-lite" }
evaluator = { provider = "api", model = "anthropic/claude-sonnet-5" }
`, { mode: 0o600 });
    const result = await runSetupTest({
      saydoHome: home,
      processEnv: { OPENAI_API_KEY: "test-key" },
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliCapabilityFn: async (name) => capability(name, cli, digest),
      audit: runtimeAudit.sink,
      cliRuntimeReceipts: runtimeAudit.receipts,
      slotChatFn: async (slot, _req, callIndex) => {
        if (slot === "dialog" && callIndex === 0) {
          return {
            ok: true,
            text: "",
            toolCalls: [{ id: "call", name: "saydo_self_test", arguments: '{"value":"ping"}' }],
            requestedModel: "openai/gpt-5.6-luna",
            observedModel: "openai/gpt-5.6-luna",
            observedModelSource: "stream",
            observedModelExempted: false,
            usage: undefined
          };
        }
        const observedModel = slot === "thinking" ? "claude-sonnet-5" : `test/${slot}`;
        return {
          ok: true,
          text:
            slot === "cheap"
              ? JSON.stringify({
                  outcomePreview: "自检",
                  inScope: ["setup"],
                  outOfScope: [],
                  acceptance: ["返回合同"],
                  plan: [{ seq: 1, step: "检查", owner: "ai" }],
                  risks: []
                })
              : "自检通过",
          requestedModel: observedModel,
          observedModel,
          observedModelSource: "stream",
          observedModelExempted: false,
          usage: undefined
        };
      }
    });
    expect(result.slots.thinking?.status).toBe("ok");
    expect(result.slots.evaluator).toMatchObject({ status: "fail", error: expect.stringContaining("同族") });
    const probe = await buildSetupProbe({
      saydoHome: home,
      processEnv: { OPENAI_API_KEY: "test-key" },
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      cliRuntimeReceipts: runtimeAudit.receipts,
      skipCliProbe: true
    });
    expect(probe.config.slots.evaluator).toMatchObject({ effective: "unarmed", reason: "same_family_blocked" });
  });

  it("订阅记账按槽位落金额 unknown 与 usage_unavailable", () => {
    const { home } = makeHome();
    const db = openDb(join(home, "saydo.db"));
    recordCliSubscriptionInvocation(
      db,
      "cheap",
      { provider: "cursor_cli", model: "", requests: 2 },
      () => new Date("2026-08-11T00:00:00.000Z")
    );
    const rows = db.prepare("SELECT kind, known, amount, source, meta_json FROM cost_entries ORDER BY rowid").all() as {
      kind: string;
      known: number;
      amount: number | null;
      source: string;
      meta_json: string;
    }[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ kind: "llm.cheap", known: 0, amount: null, source: "subscription" });
      expect(JSON.parse(row.meta_json)).toMatchObject({
        model: "unknown",
        input_tokens: 0,
        cached_input_tokens: 0,
        output_tokens: 0,
        provider: "cursor_cli",
        requests: 1,
        usage_unavailable: true
      });
    }
    db.close();
  });
});
