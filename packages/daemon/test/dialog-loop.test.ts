// dialogLoop 错误分支(impl-readback B2):作废类与"没接通"话术分流 + errorCode 透出。
// 背景:provider 层对 observed_model_missing fail-closed 后,原 index.ts 的专用作废分支不可达——
// 话术与审计改由错误码驱动;"没接通"话术误导用户查配置,作废类必须如实说"响应缺身份标识"。

import { describe, expect, it } from "vitest";
import {
  buildDialogCliOneshotMessages,
  classifyLedgerAction,
  dialogCliOneshotJsonSchema,
  parseDialogCliOneshotEnvelope,
  presentLedgerOutcome,
  reinforceDialogCliOneshotMessages,
  runDialogCliOneshot,
  runDialogTurn,
  runDialogTurnWithTools
} from "../src/brain/dialogLoop.js";
import type { ChatToolCall } from "../src/providers/types.js";
import { ToolRegistry } from "../src/brain/registry.js";
import type { LlmProvider } from "../src/providers/types.js";
import { buildBoundedPrompt } from "../src/providers/byoa/provider.js";

function errProvider(code: string): LlmProvider {
  return {
    kind: "api",
    model: "m1",
    async chat() {
      return { ok: false, code, message: "x", retryable: false };
    }
  };
}

const baseInput = { sessionId: "s1", turnId: "t1", userText: "你好", history: [] as { speaker: "user" | "ai"; text: string }[] };

describe("runDialogTurn 错误分支(B2)", () => {
  it("observed_model_missing => 作废话术(含'身份标识',不含'没接通')+ errorCode 透出", async () => {
    const out = await runDialogTurn(errProvider("observed_model_missing"), baseInput);
    expect(out.errorCode).toBe("observed_model_missing");
    expect(out.sentences).toHaveLength(1);
    expect(out.sentences[0]!.text).toContain("身份标识");
    expect(out.sentences[0]!.text).not.toContain("没接通");
    expect(out.sentences[0]!.sentenceId).toContain("void");
  });

  it("其他错误(http_5xx)=> 通用降级话术('没接通'),errorCode 照透", async () => {
    const out = await runDialogTurn(errProvider("http_5xx"), { ...baseInput, turnId: "t2" });
    expect(out.errorCode).toBe("http_5xx");
    expect(out.sentences[0]!.text).toContain("没接通");
    expect(out.sentences[0]!.sentenceId).toContain("err");
  });

  it("BYOA 前缀码 voided_observed_model_missing => 同作废话术,errorCode 归一为 canonical 码(回收批 C-1)", async () => {
    const out = await runDialogTurn(errProvider("voided_observed_model_missing"), { ...baseInput, turnId: "t3" });
    expect(out.errorCode).toBe("observed_model_missing");
    expect(out.sentences[0]!.text).toContain("身份标识");
    expect(out.error).toContain("voided_observed_model_missing"); // 原码保留在日志字段
  });
});

function okResult(text: string) {
  return {
    ok: true as const,
    text,
    requestedModel: "gpt-5.6-luna",
    observedModel: undefined,
    observedModelSource: "verified_binary_default" as const,
    observedModelExempted: true,
    usage: undefined
  };
}

function oneshotProvider(outputs: string[]): LlmProvider & { calls: number } {
  return {
    kind: "codex_cli",
    model: "gpt-5.6-luna",
    calls: 0,
    async chat() {
      const text = outputs[this.calls] ?? outputs.at(-1) ?? "";
      this.calls += 1;
      return okResult(text);
    }
  };
}

function action(id: string, tool: string, args: Record<string, unknown> = {}) {
  return { id, tool, arguments: args };
}

function envelope(actions: unknown[], reply = "模型原回复") {
  return JSON.stringify({ version: 1, reply, actions });
}

function oneshotDeps(registry: ToolRegistry) {
  return { registry, ctx: { sessionId: "s1", turnId: "t1" } };
}

describe("dialog_cli_oneshot envelope", () => {
  it("oneshot 核心指令含无 proposeObligation 时 remember 降级与 reply 禁黑话", () => {
    const registry = new ToolRegistry();
    registry.register({ name: "remember", description: "记", parameters: {} }, () => ({ ok: true }));
    const messages = buildDialogCliOneshotMessages(
      { sessionId: "s1", turnId: "t1", userText: "帮我记一下买牛奶", history: [] },
      registry
    );
    const system = messages[0]!.content;
    expect(system).toContain("必须降级用 remember");
    expect(system).toContain("先记进记忆;这件事立起来后可以再挂到账上");
    expect(system).toContain("绝不出现内部术语");
  });

  it("强化重试在紧 cap 下仍保住当前用户请求", () => {
    const messages = reinforceDialogCliOneshotMessages([
      { role: "system", content: `instructions\n\n[Context Pack]\n${"背景".repeat(500)}` },
      { role: "assistant", content: "最旧历史" },
      { role: "user", content: "CURRENT_USER_REQUEST_MUST_SURVIVE" }
    ]);
    const prompt = buildBoundedPrompt(messages, 500);
    expect(prompt).not.toBeNull();
    expect(prompt).toContain("上一轮 JSON 未通过 schema");
    expect(prompt).toContain("CURRENT_USER_REQUEST_MUST_SURVIVE");
    expect(prompt).not.toContain("最旧历史");
  });

  it("Codex 输出 schema 把工具可选参数转为 required+nullable,所有 object 均封闭", () => {
    const schema = dialogCliOneshotJsonSchema([
      {
        name: "remember",
        description: "",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["claim"],
          properties: { claim: { type: "string" }, projectId: { type: "string" } }
        }
      }
    ]) as {
      properties: { actions: { items: { anyOf: Array<{ properties: { arguments: Record<string, unknown> } }> } } };
    };
    const args = schema.properties.actions.items.anyOf[0]!.properties.arguments as {
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(args.additionalProperties).toBe(false);
    expect(args.required).toEqual(["claim", "projectId"]);
    expect(args.properties.projectId).toEqual({ anyOf: [{ type: "string" }, { type: "null" }] });
  });

  it("strict 校验版本、重复 id、参数大小与 action 上限", () => {
    expect(parseDialogCliOneshotEnvelope(envelope([]))).not.toBeNull();
    expect(parseDialogCliOneshotEnvelope(JSON.stringify({ version: 2, reply: "x", actions: [] }))).toBeNull();
    expect(parseDialogCliOneshotEnvelope(envelope([action("x", "getStatus"), action("x", "getStatus")]))).toBeNull();
    expect(parseDialogCliOneshotEnvelope(envelope([action("x", "getStatus", { text: "a".repeat(33 * 1024) })]))).toBeNull();
    expect(parseDialogCliOneshotEnvelope(envelope(Array.from({ length: 9 }, (_, i) => action(String(i), "getStatus"))))).toBeNull();
    expect(parseDialogCliOneshotEnvelope(JSON.stringify({ version: 1, reply: "   ", actions: [] }))).toBeNull();
  });

  it("provider 已消费两个进程后返回 Zod-invalid envelope 时不得启动第三个进程", async () => {
    const provider = oneshotProvider([envelope([action("x", "getStatus"), action("x", "getStatus")])]);
    const original = provider.chat.bind(provider);
    provider.chat = async (...args) => ({ ...(await original(...args)), attemptsMade: 2 });
    const registry = new ToolRegistry();
    registry.register({ name: "getStatus", description: "", parameters: {} }, () => ({ ok: true }));
    const out = await runDialogCliOneshot(provider, baseInput, oneshotDeps(registry));
    expect(provider.calls).toBe(1);
    expect(out.errorCode).toBe("invalid_structured_output");
  });

  it("allowlist 拒执行面工具并在零应用时只强化重试一次", async () => {
    const provider = oneshotProvider([
      envelope([action("a1", "confirmAndDispatch")]),
      envelope([action("a2", "confirmAndDispatch")])
    ]);
    const registry = new ToolRegistry();
    registry.register({ name: "confirmAndDispatch", description: "禁用", parameters: {} }, () => ({ ok: true }));
    const out = await runDialogCliOneshot(provider, baseInput, oneshotDeps(registry));
    expect(provider.calls).toBe(2);
    expect(out.errorCode).toBe("invalid_structured_output");
    expect(out.toolCallsMade).toBe(0);
  });

  it("同轮两个可能 pending 的 action 在 dispatch 前整轮拒绝", async () => {
    const bad = envelope([action("a1", "proposeFocusAnchor"), action("a2", "proposeObligation")]);
    const provider = oneshotProvider([bad, bad]);
    const registry = new ToolRegistry();
    const dispatched: string[] = [];
    for (const name of ["proposeFocusAnchor", "proposeObligation"]) {
      registry.register({ name, description: name, parameters: {} }, () => (dispatched.push(name), { ok: true }));
    }
    const out = await runDialogCliOneshot(provider, baseInput, oneshotDeps(registry));
    expect(out.errorCode).toBe("invalid_structured_output");
    expect(dispatched).toEqual([]);
  });

  it("遇 await_user 立即停止余下 actions 且不下发模型 reply", async () => {
    const provider = oneshotProvider([
      envelope([
        action("a1", "createTask"),
        action("a2", "proposeObligation"),
        action("a3", "getStatus")
      ])
    ]);
    const registry = new ToolRegistry();
    const dispatched: string[] = [];
    registry.register({ name: "createTask", description: "", parameters: {} }, () => (dispatched.push("createTask"), { ok: true }));
    registry.register({ name: "proposeObligation", description: "", parameters: {} }, () => {
      dispatched.push("proposeObligation");
      return { control: "await_user" };
    });
    registry.register({ name: "getStatus", description: "", parameters: {} }, () => (dispatched.push("getStatus"), { ok: true }));
    const out = await runDialogCliOneshot(provider, baseInput, oneshotDeps(registry));
    expect(dispatched).toEqual(["createTask", "proposeObligation"]);
    expect(out.sentences).toEqual([]);
    expect(out.modelText).toBeUndefined();
  });

  it("action 失败丢弃模型 reply,部分应用后也不重跑整轮", async () => {
    const provider = oneshotProvider([
      envelope([action("a1", "createTask"), action("a2", "getStatus")], "这句不得出现"),
      envelope([], "重试不得发生")
    ]);
    const registry = new ToolRegistry();
    registry.register({ name: "createTask", description: "", parameters: {} }, () => ({ ok: true }));
    registry.register({ name: "getStatus", description: "", parameters: {} }, () => ({ ok: false, code: "boom" }));
    const out = await runDialogCliOneshot(provider, baseInput, oneshotDeps(registry));
    expect(provider.calls).toBe(1);
    expect(out.errorCode).toBe("oneshot_action_failed");
    expect(out.sentences.map((item) => item.text).join(" ")).not.toContain("这句不得出现");
    expect(out.toolCallsMade).toBe(2);
  });

  it("解析失败且零 action 已应用时重试一次后执行合法 envelope", async () => {
    const provider = oneshotProvider(["not-json", envelope([action("a1", "remember")], "已安排记忆 action")]);
    const registry = new ToolRegistry();
    let applied = 0;
    registry.register({ name: "remember", description: "", parameters: {} }, () => (applied += 1, { ok: true }));
    const out = await runDialogCliOneshot(provider, baseInput, oneshotDeps(registry));
    expect(provider.calls).toBe(2);
    expect(applied).toBe(1);
    expect(out.modelText).toBe("已安排记忆 action");
  });
});

// SD-1(2026-09-08,借 deepseek-harness"事实由系统结果给出"):账本动作的成功承诺必须由实际回执约束。
function toolCallProvider(steps: Array<{ text: string; toolCalls?: ChatToolCall[] }>): LlmProvider {
  let i = 0;
  return {
    kind: "api",
    model: "m",
    async chat() {
      const step = steps[i] ?? steps.at(-1)!;
      i += 1;
      return {
        ok: true as const,
        text: step.text,
        ...(step.toolCalls ? { toolCalls: step.toolCalls } : {}),
        requestedModel: "m",
        observedModel: undefined,
        observedModelSource: "verified_binary_default" as const,
        observedModelExempted: true,
        usage: undefined
      };
    }
  };
}
const call = (id: string, name: string, args: Record<string, unknown> = {}): ChatToolCall => ({ id, name, arguments: JSON.stringify(args) });
const loopInput = (turnId: string, userText: string) => ({ sessionId: "s1", turnId, userText, history: [] as { speaker: "user" | "ai"; text: string }[] });

describe("SD-1 classifyLedgerAction:逐工具按真实回执形状归类", () => {
  it("remember:{memId} 才算 persisted;{ok:true} 无 memId 只是 noop", () => {
    expect(classifyLedgerAction("remember", { memId: "mem_x" })).toEqual({ tool: "remember", outcome: "persisted", ref: "mem_x" });
    expect(classifyLedgerAction("remember", { ok: true }).outcome).toBe("noop");
  });
  it("propose*:ok+done 才是 persisted;await_user 是 pending;ok 无 done 是 noop", () => {
    expect(classifyLedgerAction("proposeObligation", { ok: true, done: true, obligationId: "fob_1" })).toEqual({ tool: "proposeObligation", outcome: "persisted", ref: "fob_1" });
    expect(classifyLedgerAction("proposeLaneSplit", { ok: true, receiptId: "r1", control: "await_user" })).toEqual({ tool: "proposeLaneSplit", outcome: "pending", ref: "r1" });
    expect(classifyLedgerAction("proposeFocusAnchor", { ok: true, candidates: [] }).outcome).toBe("noop");
  });
  it("ok:false 分两类:handler 明确拒绝 = failed;registry 折叠的 tool_failed(可能已写)= unknown;非对象 = unknown", () => {
    expect(classifyLedgerAction("remember", { ok: false, code: "fixture_write_failed" })).toEqual({ tool: "remember", outcome: "failed", code: "fixture_write_failed" });
    expect(classifyLedgerAction("remember", { ok: false, code: "tool_failed" })).toEqual({ tool: "remember", outcome: "unknown", code: "tool_failed" });
    expect(classifyLedgerAction("remember", null).outcome).toBe("unknown");
  });
});

describe("SD-1 presentLedgerOutcome:模型正文不能覆盖失败/未知,部分成功分开说", () => {
  it("零 persisted + 宣告 ⇒ 诚实句;有 persisted + 宣告 ⇒ 原文", () => {
    expect(presentLedgerOutcome("记下了。", [{ tool: "remember", outcome: "noop" }]).replaced).toBe("unclaimed_write");
    expect(presentLedgerOutcome("记下了。", []).replaced).toBe("unclaimed_write");
    expect(presentLedgerOutcome("记下了。", [{ tool: "remember", outcome: "persisted", ref: "mem_1" }])).toEqual({ text: "记下了。" });
  });
  it("A persisted + B failed ⇒ 只确认 A、B 说没写进去,不说全部失败,不暗示重做 A;措辞未命中正则也照样替换", () => {
    const r = presentLedgerOutcome("两件事我都安排妥当啦。", [
      { tool: "remember", outcome: "persisted", ref: "mem_1" },
      { tool: "proposeLaneSplit", outcome: "failed", code: "x" }
    ]);
    expect(r.replaced).toBe("action_failed");
    expect(r.text).toContain("这条记忆写进去了");
    expect(r.text).toContain("拆线没写进去");
    expect(r.text).not.toContain("安排妥当");
    expect(r.text).not.toContain("这条记忆没写进去");
  });
  it("unknown ⇒ 说没确认到、不暗示重试;非账本工具的失败不参与", () => {
    const r = presentLedgerOutcome("好的。", [{ tool: "remember", outcome: "unknown", code: "tool_failed" }, { tool: "getStatus", outcome: "failed", code: "boom" }]);
    expect(r.replaced).toBe("action_failed");
    expect(r.text).toContain("没确认到");
    expect(r.text).toContain("先别重来");
    expect(presentLedgerOutcome("好的。", [{ tool: "getStatus", outcome: "failed", code: "boom" }])).toEqual({ text: "好的。" });
  });
});

describe("SD-1 runDialogTurnWithTools(API 出口):失败回执后的“记下了”不再放行", () => {
  it("remember 返回 ok:false 明确未写入 ⇒ 口播不含“记下了”,ledgerActions 记为 failed", async () => {
    const registry = new ToolRegistry();
    registry.register({ name: "remember", description: "", parameters: {} }, () => ({ ok: false, code: "fixture_write_failed", message: "no write occurred", retryable: false }));
    const calls: Array<{ name: string; ok: boolean }> = [];
    const out = await runDialogTurnWithTools(
      toolCallProvider([{ text: "", toolCalls: [call("c1", "remember", { tier: "M0", claim: "偏好", trust: "user_stated" })] }, { text: "记下了。" }]),
      loopInput("t1", "请记住这个偏好"),
      { registry, ctx: { sessionId: "s1", turnId: "t1" }, onToolCall: (i) => calls.push({ name: i.name, ok: i.ok }) }
    );
    expect(calls).toEqual([{ name: "remember", ok: false }]);
    const spoken = out.sentences.map((s) => s.text).join("");
    expect(spoken).not.toContain("记下了");
    expect(spoken).toContain("没写进去");
    expect(out.ledgerActions).toEqual([{ tool: "remember", outcome: "failed", code: "fixture_write_failed" }]);
    expect(out.error).toBe("ledger_claim_replaced:action_failed");
  });

  it("A 成功、B 失败,模型说“都记下了,也拆好了” ⇒ 只确认 A", async () => {
    const registry = new ToolRegistry();
    registry.register({ name: "remember", description: "", parameters: {} }, () => ({ memId: "mem_A" }));
    registry.register({ name: "proposeLaneSplit", description: "", parameters: {} }, () => ({ ok: false, code: "fixture_fail" }));
    const out = await runDialogTurnWithTools(
      toolCallProvider([{ text: "", toolCalls: [call("c1", "remember"), call("c2", "proposeLaneSplit")] }, { text: "都记下了,也拆好了。" }]),
      loopInput("t2", "记住并拆线"),
      { registry, ctx: { sessionId: "s1", turnId: "t2" } }
    );
    const spoken = out.sentences.map((s) => s.text).join("");
    expect(spoken).toContain("这条记忆写进去了");
    expect(spoken).toContain("拆线没写进去");
    expect(spoken).not.toContain("都记下了");
    expect(out.ledgerActions?.map((a) => a.outcome)).toEqual(["persisted", "failed"]);
  });

  it("handler 抛错(registry 折叠为 tool_failed)⇒ unknown:不说写了、不说没写、不催重试", async () => {
    const registry = new ToolRegistry();
    registry.register({ name: "remember", description: "", parameters: {} }, () => {
      throw new Error("audit sink exploded after insert");
    });
    const out = await runDialogTurnWithTools(
      toolCallProvider([{ text: "", toolCalls: [call("c1", "remember")] }, { text: "记下了。" }]),
      loopInput("t3", "记住"),
      { registry, ctx: { sessionId: "s1", turnId: "t3" } }
    );
    const spoken = out.sentences.map((s) => s.text).join("");
    expect(spoken).not.toContain("记下了");
    expect(spoken).toContain("没确认到");
    expect(spoken).not.toContain("再说一次");
    expect(out.ledgerActions?.[0]?.outcome).toBe("unknown");
  });

  it("A 成功 + B 待确认(await_user):环在 B 处停住,不产口播、不重复执行", async () => {
    const registry = new ToolRegistry();
    let laneCalls = 0;
    registry.register({ name: "remember", description: "", parameters: {} }, () => ({ memId: "mem_A" }));
    registry.register({ name: "proposeLaneSplit", description: "", parameters: {} }, () => (laneCalls += 1, { ok: true, receiptId: "r1", control: "await_user" }));
    const out = await runDialogTurnWithTools(
      toolCallProvider([{ text: "", toolCalls: [call("c1", "remember"), call("c2", "proposeLaneSplit")] }, { text: "都拆好了。" }]),
      loopInput("t4", "记住并拆线"),
      { registry, ctx: { sessionId: "s1", turnId: "t4" } }
    );
    expect(out.sentences).toEqual([]);
    expect(laneCalls).toBe(1);
  });

  it("真实 persisted 回执 + 宣告 ⇒ 原文放行(不误伤)", async () => {
    const registry = new ToolRegistry();
    registry.register({ name: "remember", description: "", parameters: {} }, () => ({ memId: "mem_ok" }));
    const out = await runDialogTurnWithTools(
      toolCallProvider([{ text: "", toolCalls: [call("c1", "remember")] }, { text: "记下了。" }]),
      loopInput("t5", "记住"),
      { registry, ctx: { sessionId: "s1", turnId: "t5" } }
    );
    expect(out.sentences.map((s) => s.text)).toEqual(["记下了。"]);
    expect(out.error).toBeUndefined();
  });
});

describe("SD-1 runDialogCliOneshot(CLI 出口):部分成功如实分开说", () => {
  it("A remember 成功、B 落账失败 ⇒ 口播确认 A 写进去了、B 没写进去;不整轮说失败", async () => {
    const provider = oneshotProvider([envelope([action("a1", "remember"), action("a2", "proposeObligation")], "都记下了。")]);
    const registry = new ToolRegistry();
    registry.register({ name: "remember", description: "", parameters: {} }, () => ({ memId: "mem_A" }));
    registry.register({ name: "proposeObligation", description: "", parameters: {} }, () => ({ ok: false, code: "fixture_fail" }));
    const out = await runDialogCliOneshot(provider, baseInput, oneshotDeps(registry));
    expect(out.errorCode).toBe("oneshot_action_failed");
    const spoken = out.sentences.map((s) => s.text).join("");
    expect(spoken).toContain("这条记忆写进去了");
    expect(spoken).toContain("落账没写进去");
    expect(spoken).not.toContain("都记下了");
    expect(out.ledgerActions?.map((a) => a.outcome)).toEqual(["persisted", "failed"]);
  });
  it("reply 宣告“记下了”但 remember 只返回 {ok:true}(无 memId)⇒ 诚实句", async () => {
    const provider = oneshotProvider([envelope([action("a1", "remember")], "记下了。")]);
    const registry = new ToolRegistry();
    registry.register({ name: "remember", description: "", parameters: {} }, () => ({ ok: true }));
    const out = await runDialogCliOneshot(provider, baseInput, oneshotDeps(registry));
    expect(out.modelText).toContain("没有真正写入账本");
  });
});
