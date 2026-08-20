// 槽位 binding -> Provider 实例(api 形态;BYOA 形态 1.2b 接入同接口)。
// key 解析:命名端点 api_key 恒 env 引用(env:NAME);缺 key 处方化报错(0.4 校验器先行,这里兜底)。

import type { ModelBinding, NamedApiProvider } from "@saydo/contracts";
import type { AuditSink } from "../obs/audit.js";
import { resolveFamily } from "../config/validate.js";
import { createOpenAICompatProvider } from "./openaiCompat.js";
import type { LlmProvider } from "./types.js";

const OFFICIAL_BASE_URLS: Record<string, string> = {
  gpt: "https://api.openai.com/v1",
  claude: "https://api.anthropic.com/v1", // 注:anthropic 原生非 OpenAI 兼容;P0 官方直连仅 gpt 系可用,claude 走命名端点网关
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai"
};

/**
 * 槽位输出等待预算(缺省 30s 由 adapter 提供;本表只对已知槽位覆盖)。
 *
 * dialog/cheap 在语音实时路径上,维持 30s——延迟本身是合同的一部分。
 * thinking/evaluator 是深推理档:reasoning 模型单次可产出数千 reasoning token
 * (2026-08-15 实测 deepseek-v4-pro 一次 out=7516,`e2e/spikes/deepseek-toolloop/`),
 * 30s 必然超时,而超时后重试只会再烧一遍同样的推理。放宽到 180s。
 * 这两档本就是低频操作(09 §11 `evaluator_deep_review_max_per_session=3`,深评仅在
 * "可能就绪 / propose 前"触发),不构成日常等待。
 */
export const SLOT_TIMEOUT_MS: Record<"dialog" | "thinking" | "cheap" | "evaluator", number> = {
  dialog: 30_000,
  cheap: 30_000,
  thinking: 180_000,
  evaluator: 180_000
};

export function resolveApiProvider(
  binding: ModelBinding,
  named: Record<string, NamedApiProvider> | undefined,
  env: Record<string, string | undefined>,
  officialKeyEnv = "OPENAI_API_KEY",
  observedModelContext?: { slot: "dialog" | "thinking" | "cheap" | "evaluator"; audit: AuditSink }
): LlmProvider {
  const family = resolveFamily("api", binding, named);
  if ("violation" in family) throw new Error(family.violation.message);
  const onObservedModelRejected = observedModelContext
    ? (event: {
        code: string;
        expectedFamily?: string;
        observedModel?: string;
        observedFamily?: string;
      }) => {
        observedModelContext.audit.record({
          actor: "daemon",
          action: "provider.observed_model_rejected",
          meta: {
            slot: observedModelContext.slot,
            code: event.code,
            expectedFamily: event.expectedFamily,
            observedFamily: event.observedFamily,
            observedModel: event.observedModel
          }
        });
      }
    : undefined;
  // 槽位已知时按档覆盖等待预算(深推理档 30s 必超时);槽位未知沿用 adapter 缺省
  const slotTimeout = observedModelContext ? { timeoutMs: SLOT_TIMEOUT_MS[observedModelContext.slot] } : {};
  if (typeof binding === "string") {
    const key = env[officialKeyEnv];
    if (!key) throw new Error(`api 简写形态需要 ${officialKeyEnv};或改用 via 命名端点`);
    const base = OFFICIAL_BASE_URLS["gpt"] as string;
    return createOpenAICompatProvider({
      baseUrl: base,
      apiKey: key,
      model: binding,
      expectedFamily: family.family,
      ...slotTimeout,
      ...(onObservedModelRejected ? { onObservedModelRejected } : {})
    });
  }
  if (binding.provider !== "api") {
    throw new Error(`resolveApiProvider 只处理 api 形态,got ${binding.provider}(BYOA 走 1.2b 适配器)`);
  }
  if (binding.via) {
    const endpoint = named?.[binding.via];
    if (!endpoint) throw new Error(`via 指向未定义命名端点 ${binding.via}`);
    const envName = endpoint.api_key.slice("env:".length);
    const key = env[envName];
    if (!key) throw new Error(`命名端点 [${binding.via}] 需要 ${envName}(填入 ~/.saydo/.env)`);
    return createOpenAICompatProvider({
      baseUrl: endpoint.base_url,
      apiKey: key,
      model: binding.model,
      expectedFamily: family.family,
      ...slotTimeout,
      ...(onObservedModelRejected ? { onObservedModelRejected } : {}),
      // M2 钉路由:命名端点配置 provider_order ⇒ 固定排序 + 禁 fallback(聚合网关适用)
      ...(endpoint.provider_order ? { providerPinning: { order: endpoint.provider_order, allowFallbacks: false } } : {})
    });
  }
  const key = env[officialKeyEnv];
  if (!key) throw new Error(`官方端点需要 ${officialKeyEnv}`);
  return createOpenAICompatProvider({
    baseUrl: OFFICIAL_BASE_URLS["gpt"] as string,
    apiKey: key,
    model: binding.model,
    expectedFamily: family.family,
    ...slotTimeout,
    ...(onObservedModelRejected ? { onObservedModelRejected } : {})
  });
}
