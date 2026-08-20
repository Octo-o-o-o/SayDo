/**
 * Spike 2(决策文档 docs/plan/2026-08-15-default-runner-decision.md §七-2):
 * DeepSeek 官方端点能否走通 SayDo 的**生产 provider 路径**。
 *
 * 刻意不另写 HTTP client —— 要验证的是「SayDo 的 openaiCompat adapter 能不能驱动 DeepSeek」,
 * 不是「DeepSeek API 本身是否可用」。adapter 对 reasoning 的特殊处理只针对 OpenRouter
 * (openaiCompat.ts:79-80),官方 DeepSeek 是否完全兼容必须实测。
 *
 * 跑法:pnpm --filter @saydo/daemon exec tsx ../../e2e/spikes/deepseek-toolloop/spike.ts
 * key 从 ~/.saydo/.env 读,永不打印。
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createOpenAICompatProvider } from "../../../packages/daemon/src/providers/openaiCompat.js";
import type { ChatRequest, ChatResult, ToolSpec } from "../../../packages/daemon/src/providers/types.js";

const BASE_URL = "https://api.deepseek.com/v1";
const CHAT_MODEL = "deepseek-chat";
const REASONER_MODEL = "deepseek-reasoner";

/** 与 daemon parseEnvText 同口径:剥注释与引号。key 只回存在性,绝不回显。 */
function readKey(): string {
  const path = join(homedir(), ".saydo", ".env");
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const idx = t.indexOf("=");
    const k = t.slice(0, idx).trim();
    if (k !== "DEEPSEEK_API_KEY") continue;
    return t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("~/.saydo/.env 内无有效 DEEPSEEK_API_KEY 键值行(注释行不算)");
}

const WEATHER_TOOL: ToolSpec = {
  name: "get_weather",
  description: "查询某城市当前天气",
  parameters: {
    type: "object",
    properties: { city: { type: "string", description: "城市名" } },
    required: ["city"],
    additionalProperties: false
  }
};

function provider(model: string, apiKey: string) {
  const rejections: string[] = [];
  const p = createOpenAICompatProvider({
    baseUrl: BASE_URL,
    apiKey,
    model,
    expectedFamily: "deepseek",
    timeoutMs: 60000,
    onObservedModelRejected: (e) => rejections.push(e.code)
  });
  return { p, rejections };
}

function brief(r: ChatResult): string {
  if (!r.ok) return `ERROR code=${r.code} retryable=${r.retryable} msg=${String(r.message).slice(0, 120)}`;
  const tc = (r.toolCalls ?? []).map((c) => `${c.name}(${c.arguments.slice(0, 60)})`).join(" | ");
  return [
    `observedModel=${r.observedModel ?? "(缺失)"}`,
    `source=${r.observedModelSource}`,
    `exempted=${r.observedModelExempted}`,
    `usage=${r.usage ? `in:${r.usage.promptTokens}/out:${r.usage.completionTokens}/cached:${r.usage.cachedPromptTokens ?? "-"}` : "(无)"}`,
    `toolCalls=${r.toolCalls?.length ?? 0}${tc ? ` [${tc}]` : ""}`,
    `text=${JSON.stringify(r.text.slice(0, 80))}`
  ].join("  ");
}

async function main(): Promise<void> {
  const apiKey = readKey();
  console.log(`[前置] key 已读取(长度 ${apiKey.length},内容不回显);baseUrl=${BASE_URL}\n`);

  // --- S1 基础调用:observedModel 能否提取 + 家族复核 + usage ---
  const { p: chat, rejections: rej1 } = provider(CHAT_MODEL, apiKey);
  const s1 = await chat.chat({ messages: [{ role: "user", content: "只回复两个字:收到" }], maxTokens: 64 });
  console.log(`S1 基础调用      : ${brief(s1)}`);
  console.log(`   observedModel 拒收事件: ${rej1.length ? rej1.join(",") : "无"}`);

  // --- S2 单工具调用:adapter 是否把 tools 正确发出并解析回 toolCalls ---
  const s2req: ChatRequest = {
    messages: [{ role: "user", content: "北京现在天气怎么样?用工具查。" }],
    tools: [WEATHER_TOOL],
    maxTokens: 256
  };
  const s2 = await chat.chat(s2req);
  console.log(`S2 单工具调用    : ${brief(s2)}`);

  // --- S3 多轮回填:tool result 回填后能否续跑出终答(执行器 loop 的最小前提) ---
  if (s2.ok && s2.toolCalls?.length) {
    const call = s2.toolCalls[0]!;
    const s3 = await chat.chat({
      messages: [
        ...s2req.messages,
        { role: "assistant", content: s2.text, toolCalls: s2.toolCalls },
        { role: "tool", content: JSON.stringify({ city: "北京", tempC: 21, cond: "晴" }), toolCallId: call.id }
      ],
      tools: [WEATHER_TOOL],
      maxTokens: 256
    });
    console.log(`S3 多轮回填      : ${brief(s3)}`);
  } else {
    console.log(`S3 多轮回填      : 跳过(S2 未产出 toolCalls)`);
  }

  // --- S4 并行工具调用:一轮内能否返回多个 tool_calls ---
  const s4 = await chat.chat({
    messages: [{ role: "user", content: "同时查北京和上海的天气,一次把两个工具调用都发出来。" }],
    tools: [WEATHER_TOOL],
    maxTokens: 256
  });
  console.log(`S4 并行工具调用  : ${brief(s4)}`);

  // --- S5 reasoner 模型:thinking 档兼容性(adapter 的 reasoning 处理只针对 OpenRouter) ---
  const { p: reasoner, rejections: rej5 } = provider(REASONER_MODEL, apiKey);
  const s5 = await reasoner.chat({ messages: [{ role: "user", content: "1+1 等于几?只回数字。" }], maxTokens: 512 });
  console.log(`S5 reasoner 档   : ${brief(s5)}`);
  console.log(`   observedModel 拒收事件: ${rej5.length ? rej5.join(",") : "无"}`);

  // --- S6 取消:AbortSignal 语义(执行器必须能中断) ---
  console.log(`S6 取消语义      : provider 层无 signal 入参(ChatRequest 无 signal 字段)——取消只能靠上层超时,记为缺口`);
}

main().catch((e: unknown) => {
  console.error(`spike 失败: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
