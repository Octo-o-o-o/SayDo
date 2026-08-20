/**
 * Spike 2b:deepseek-v4-pro 官方直连是否可用作 thinking/evaluator 档。
 *
 * 动因(spike 2 实测):官方模型列表只有 deepseek-v4-flash / deepseek-v4-pro;
 * deepseek-chat / deepseek-reasoner 是旧别名,均被服务端映射到 flash。
 * 风险点:openaiCompat.ts:75-80 记载 "deepseek-v4-pro 等 reasoning 模型把预算花在
 * reasoning 字段,content=null 被判" —— 而 reasoning 限额只在 baseUrl 含 openrouter 时发出,
 * 官方直连不发。故必须验证 pro 直连在正常/紧预算下会不会拿不到 content。
 *
 * 用 fetchImpl 注入包一层,既走生产 adapter,又能看到原始响应字段。key 永不打印。
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createOpenAICompatProvider } from "../../../packages/daemon/src/providers/openaiCompat.js";
import type { ChatResult, ToolSpec } from "../../../packages/daemon/src/providers/types.js";

const BASE_URL = "https://api.deepseek.com/v1";
const PRO = "deepseek-v4-pro";
const FLASH = "deepseek-v4-flash";

function readKey(): string {
  const text = readFileSync(join(homedir(), ".saydo", ".env"), "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const idx = t.indexOf("=");
    if (t.slice(0, idx).trim() !== "DEEPSEEK_API_KEY") continue;
    return t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("无有效 DEEPSEEK_API_KEY");
}

const WEATHER_TOOL: ToolSpec = {
  name: "get_weather",
  description: "查询某城市当前天气",
  parameters: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
    additionalProperties: false
  }
};

/** 记录最后一次原始响应,用于看 reasoning_content / content 是否为 null。 */
let lastRaw: Record<string, unknown> | null = null;
const spyFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input as string, init);
  const body = await res.clone().text();
  try {
    lastRaw = JSON.parse(body) as Record<string, unknown>;
  } catch {
    lastRaw = null;
  }
  return res;
};

function rawShape(): string {
  const choice = (lastRaw?.["choices"] as Array<Record<string, unknown>> | undefined)?.[0];
  const msg = choice?.["message"] as Record<string, unknown> | undefined;
  if (!msg) return "(无 message)";
  const content = msg["content"];
  const reasoning = msg["reasoning_content"];
  const usage = lastRaw?.["usage"] as Record<string, unknown> | undefined;
  return [
    `content=${content === null ? "NULL" : content === undefined ? "(缺)" : `str(${String(content).length})`}`,
    `reasoning_content=${reasoning === null || reasoning === undefined ? "(无)" : `str(${String(reasoning).length})`}`,
    `finish=${String(choice?.["finish_reason"])}`,
    `reasoning_tokens=${String((usage?.["completion_tokens_details"] as Record<string, unknown> | undefined)?.["reasoning_tokens"] ?? "-")}`
  ].join("  ");
}

function brief(r: ChatResult): string {
  if (!r.ok) return `ERROR code=${r.code} retryable=${r.retryable} msg=${String(r.message).slice(0, 100)}`;
  return `observed=${r.observedModel ?? "(缺)"}  usage=in:${r.usage?.promptTokens}/out:${r.usage?.completionTokens}  toolCalls=${r.toolCalls?.length ?? 0}  text=${JSON.stringify(r.text.slice(0, 60))}`;
}

function mk(model: string, apiKey: string) {
  return createOpenAICompatProvider({
    baseUrl: BASE_URL,
    apiKey,
    model,
    expectedFamily: "deepseek",
    timeoutMs: 120000,
    fetchImpl: spyFetch
  });
}

async function main(): Promise<void> {
  const apiKey = readKey();
  const pro = mk(PRO, apiKey);

  // S7 正常预算:pro 能否拿到 content
  const s7 = await pro.chat({ messages: [{ role: "user", content: "1+1 等于几?只回数字。" }], maxTokens: 2048 });
  console.log(`S7 pro 正常预算(2048) : ${brief(s7)}`);
  console.log(`   原始响应            : ${rawShape()}`);

  // S8 紧预算:复现 content=null 风险(reasoning 吃掉预算)
  const s8 = await pro.chat({
    messages: [{ role: "user", content: "证明:任意三角形内角和为 180 度。给出完整推理。" }],
    maxTokens: 64
  });
  console.log(`S8 pro 紧预算(64)     : ${brief(s8)}`);
  console.log(`   原始响应            : ${rawShape()}`);

  // S9 pro 工具调用:thinking/evaluator 档若要用工具须验
  const s9 = await pro.chat({
    messages: [{ role: "user", content: "北京天气如何?用工具查。" }],
    tools: [WEATHER_TOOL],
    maxTokens: 2048
  });
  console.log(`S9 pro 工具调用       : ${brief(s9)}`);
  console.log(`   原始响应            : ${rawShape()}`);

  // S10 对照:flash 紧预算(确认 S8 若失败是 pro 特有,不是通用限制)
  const s10 = await mk(FLASH, apiKey).chat({
    messages: [{ role: "user", content: "证明:任意三角形内角和为 180 度。给出完整推理。" }],
    maxTokens: 64
  });
  console.log(`S10 flash 紧预算(64)  : ${brief(s10)}`);
  console.log(`   原始响应            : ${rawShape()}`);
}

main().catch((e: unknown) => {
  console.error(`失败: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
