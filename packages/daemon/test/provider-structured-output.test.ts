import { describe, expect, it } from "vitest";
import { testResolvedModelSlot } from "../src/api/setup.js";
import { DEEP_OUTPUT_JSON_SCHEMA } from "../src/evaluator/readiness.js";
import { createOpenAICompatProvider } from "../src/providers/openaiCompat.js";
import type { ChatRequest } from "../src/providers/types.js";

const schema = DEEP_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>;

function fixture(baseUrl = "https://api.deepseek.com/v1", text = '{"perClaim":[]}') {
  const bodies: Record<string, unknown>[] = [];
  const provider = createOpenAICompatProvider({
    baseUrl,
    apiKey: "test-key",
    model: "deepseek-flash",
    expectedFamily: "deepseek",
    fetchImpl: (async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ model: "deepseek-flash", choices: [{ message: { content: text } }] }));
    }) as typeof fetch
  });
  return { provider, bodies };
}

describe("DeepSeek 官方直连的对象结构化输出", () => {
  it.each(["https://api.deepseek.com", "https://api.deepseek.com/v1", "https://API.DEEPSEEK.COM:443/v1"])(
    "官方 origin %s 使用 JSON 模式并传完整 schema", async (baseUrl) => {
      const { provider, bodies } = fixture(baseUrl);
      const result = await testResolvedModelSlot("evaluator", provider, undefined, "deepseek");
      expect(result).toMatchObject({ status: "ok", observedModel: "deepseek-flash", observedModelExempted: false });
      expect(bodies[0]?.response_format).toEqual({ type: "json_object" });
      const messages = bodies[0]?.messages as { role: string; content: string }[];
      expect(messages[0]).toMatchObject({ role: "system" });
      expect(messages[0]?.content).toContain(JSON.stringify(schema));
      expect(messages[1]?.content).toContain("按 schema 返回空 perClaim 数组");
    }
  );

  it("只追加最后一条 system，保留全部消息及工具回指且不修改原请求", async () => {
    const { provider, bodies } = fixture();
    const request: ChatRequest = {
      messages: [
        { role: "system", content: "第一条系统约束" },
        { role: "system", content: "必须保留的数据隔离约束" },
        { role: "user", content: "用户输入保持不变" },
        { role: "assistant", content: "", toolCalls: [{ id: "call-1", name: "inspect", arguments: "{}" }] },
        { role: "tool", content: "结果", toolCallId: "call-1" }
      ],
      jsonSchema: schema
    };
    const before = structuredClone(request);
    await provider.chat(request);
    expect(request).toEqual(before);
    const messages = bodies[0]?.messages as { role: string; content: string }[];
    expect(messages).toHaveLength(5);
    expect(messages[0]?.content).toBe("第一条系统约束");
    expect(messages[1]?.content).toMatch(/^必须保留的数据隔离约束\n\n/);
    expect(messages[1]?.content).toContain(JSON.stringify(schema));
    expect(messages[2]?.content).toBe("用户输入保持不变");
    expect(messages[3]).toMatchObject({ tool_calls: [{ id: "call-1", type: "function", function: { name: "inspect", arguments: "{}" } }] });
    expect(messages[4]).toMatchObject({ tool_call_id: "call-1", content: "结果" });
  });

  it.each([
    "https://openrouter.ai/api/v1", "https://example.invalid/api.deepseek.com/v1",
    "https://api.deepseek.com.example.invalid/v1", "http://api.deepseek.com/v1", "https://api.deepseek.com:444/v1"
  ])("其他 origin %s 不因模型名或 URL 子串改变传输", async (baseUrl) => {
    const { provider, bodies } = fixture(baseUrl);
    const messages = [{ role: "user" as const, content: "原消息" }];
    await provider.chat({ messages, jsonSchema: schema });
    expect(bodies[0]?.response_format).toEqual({ type: "json_schema", json_schema: { name: "result", schema } });
    expect(bodies[0]?.messages).toEqual(messages);
  });

  it.each([{ type: "array", items: { type: "string" } }, { type: ["object", "null"] }, { properties: {} }])(
    "非明确对象根保留原传输：%j", async (otherSchema) => {
      const { provider, bodies } = fixture();
      const messages = [{ role: "user" as const, content: "按原合同输出" }];
      await provider.chat({ messages, jsonSchema: otherSchema });
      expect(bodies[0]?.response_format).toEqual({ type: "json_schema", json_schema: { name: "result", schema: otherSchema } });
      expect(bodies[0]?.messages).toEqual(messages);
    }
  );

  it("普通文本请求不注入 JSON 指令", async () => {
    const { provider, bodies } = fixture();
    const messages = [{ role: "user" as const, content: "你好" }];
    await provider.chat({ messages });
    expect(bodies[0]?.response_format).toBeUndefined();
    expect(bodies[0]?.messages).toEqual(messages);
  });

  it.each([
    "", "不是 JSON", "```json\n{\"perClaim\":[]}\n```", "{}",
    '{"perClaim":[],"ready":true}', '{"perClaim":[{"claimDigest":"x","semanticSupport":"ready"}]}',
    JSON.stringify({ perClaim: Array.from({ length: 1001 }, () => ({ claimDigest: "x", semanticSupport: "supported" })) })
  ])("HTTP 200 的坏输出仍被生产评估自检拒绝（用例 %#）", async (text) => {
    const { provider } = fixture(undefined, text);
    const result = await testResolvedModelSlot("evaluator", provider, undefined, "deepseek");
    expect(result.status).toBe("fail");
  });

  it("5xx 重试不重复追加 schema 指令", async () => {
    const bodies: unknown[] = [];
    const provider = createOpenAICompatProvider({
      baseUrl: "https://api.deepseek.com", apiKey: "test-key", model: "deepseek-flash",
      fetchImpl: (async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return bodies.length === 1 ? new Response("暂不可用", { status: 503 })
          : new Response(JSON.stringify({ model: "deepseek-flash", choices: [{ message: { content: '{"perClaim":[]}' } }] }));
      }) as typeof fetch
    });
    expect((await provider.chat({ messages: [{ role: "system", content: "原约束" }], jsonSchema: schema })).ok).toBe(true);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });
});
