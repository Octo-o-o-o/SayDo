// docs/09 §11 模型槽位绑定(ModelBinding / DevAgentBinding)。
// 校验规则 1-6(异族/双开关/笼子/探测/记账/深评律)在 daemon 配置层(0.4)实现,本文件只承载形状。

import { z } from "zod";

export const codexReasoningSchema = z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
export type CodexReasoning = z.infer<typeof codexReasoningSchema>;

/** 已接线、可写入 ModelBinding 的 CLI provider(inventory_only 的 kimi_cli/opencode_cli 不在此列) */
export const WIRED_CLI_PROVIDERS = [
  "codex_cli",
  "claude_cli",
  "cursor_cli",
  "grok_cli",
  "gemini_cli",
  "qwen_cli",
  "copilot_cli"
] as const;
export type WiredCliProvider = (typeof WIRED_CLI_PROVIDERS)[number];

export function isWiredCliProvider(value: string): value is WiredCliProvider {
  return (WIRED_CLI_PROVIDERS as readonly string[]).includes(value);
}

/** CLI 调用计费来源(09 §11-5;探测采集,ledger 原样带上) */
export const costProvenanceSchema = z.enum(["subscription", "external_api", "unknown"]);
export type CostProvenance = z.infer<typeof costProvenanceSchema>;

export const modelBindingSchema = z.union([
  // 简写:字符串 = { provider:"api", model:<string> }(官方端点)
  z.string().min(1),
  z.strictObject({ provider: z.literal("api"), model: z.string().min(1), via: z.string().min(1).optional() }),
  z.strictObject({ provider: z.literal("codex_cli"), model: z.string().min(1).optional(), reasoning: codexReasoningSchema.optional() }),
  z.strictObject({ provider: z.literal("claude_cli"), model: z.string().min(1).optional() }),
  z.strictObject({ provider: z.literal("cursor_cli"), model: z.string().min(1) }),
  // grok_cli:模型可省(用 CLI 默认);族恒 grok;无头 --tools "" 可证零工具(2026-08-12 实测)
  z.strictObject({ provider: z.literal("grok_cli"), model: z.string().min(1).optional() }),
  // gemini_cli:model 可省;family 仅来自 model 名或 observedModel;禁用 verified_binary_default
  z.strictObject({ provider: z.literal("gemini_cli"), model: z.string().min(1).optional() }),
  // qwen_cli:传输型;family 仅来自显式 model 或 observedModel
  z.strictObject({ provider: z.literal("qwen_cli"), model: z.string().min(1).optional() }),
  // copilot_cli:传输型;family 仅来自显式 model 或 observedModel
  z.strictObject({ provider: z.literal("copilot_cli"), model: z.string().min(1).optional() }),
  z.strictObject({ provider: z.literal("acp"), bin: z.string().min(1), model: z.string().min(1) }) // P0 校验器一律拒
]);
export type ModelBinding = z.infer<typeof modelBindingSchema>;

export const devAgentBindingSchema = z.discriminatedUnion("agent", [
  z.strictObject({ agent: z.literal("claude_code"), model: z.string().min(1) }),
  z.strictObject({
    agent: z.literal("cursor"),
    model: z.string().min(1),
    transport: z.enum(["cli", "sdk"]).optional() // 缺省 sdk;dev 机缺省显式 cli
  }),
  z.strictObject({ agent: z.literal("codex"), model: z.string().min(1) })
]);
export type DevAgentBinding = z.infer<typeof devAgentBindingSchema>;

/** DevAgentBinding.agent -> tier1_runs.adapter 词表映射(同词表,09 §6.1) */
export function adapterOfAgent(agent: "claude_code" | "cursor" | "codex"): "claude_code" | "cursor" | "codex" {
  return agent;
}

export const namedApiProviderSchema = z.strictObject({
  base_url: z.string().url(),
  api_key: z.string().regex(/^env:[A-Z][A-Z0-9_]*$/u, "api_key must be env reference (env:NAME)"),
  family: z.string().min(1).optional(),
  // M2/①-4(2026-07-25):聚合网关(OpenRouter)钉路由——白名单固定排序 + 禁 fallback,
  // 防首 token 抖动 + 前缀缓存跨供应商全量 miss;单家直连端点留空
  provider_order: z.array(z.string().min(1)).min(1).optional()
});
export type NamedApiProvider = z.infer<typeof namedApiProviderSchema>;
