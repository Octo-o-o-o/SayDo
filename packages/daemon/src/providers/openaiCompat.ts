// OpenAI 兼容 chat/completions 适配器(E1 api 形态):
// - 统一超时(缺省 30s)+ 失败重试一次(仅 retryable:网络/5xx/超时);
// - 提取响应体 model 字段(observedModel,09 §11 规则 2——1.2b 起 familyOf 不符即作废);
// - 不做跨计费源降级(07 D18 纪律 3:限流 fail-fast,billing-switch 收据才许切)。

import type { ChatRequest, ChatResult, LlmProvider } from "./types.js";
import { familyFromModelName, type Family } from "../config/family.js";

export interface OpenAICompatOptions {
  baseUrl: string; // 形如 https://openrouter.ai/api/v1
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch; // 测试注入
  /** binding resolver 得出的实际消费家族；API 响应 model 必须可解析且同族。 */
  expectedFamily?: Family;
  onObservedModelRejected?: (event: {
    code: "observed_model_missing" | "observed_model_family_unresolved" | "observed_model_family_mismatch";
    expectedFamily?: Family;
    observedModel?: string;
    observedFamily?: Family;
  }) => void;
  /** M2/①-4 OpenRouter 钉路由:provider 白名单固定排序 + 禁 fallback——否则首 token 抖动 + 前缀缓存跨供应商全量 miss。
   *  仅对聚合网关(via=openrouter)设置;单家直连端点留空。 */
  providerPinning?: { order: string[]; allowFallbacks: boolean };
}

/**
 * 输出预算下限(reasoning 模型把预算先花在 reasoning 字段,留不下 content 就是空回答)。
 *
 * OpenRouter 路径靠下方统一 `reasoning:{max_tokens:1200}` 把推理压住,3000 够留给 content。
 * DeepSeek 官方直连**不认**该键——2026-08-15 实测:发了也静默忽略(不报错、reasoning 照吃满),
 * 于是 3000 预算下 content 恒空、`finish=length`(v4-pro 与 v4-flash 同现象;
 * `reasoning_effort` 三档在难题上均救不回来)。同题实测 8000 起即稳定 `finish=stop`,
 * 取 16000 留余量——**max_tokens 是上限不是用量**(32000 上限下实际只用 2875),不抬高成本。
 * 证据:`e2e/spikes/deepseek-toolloop/`。
 * 收窄到已验证端点:其他端点各有输出上限,盲目抬高可能被上游拒。
 */
const DEEPSEEK_DIRECT_MIN_OUTPUT_TOKENS = 16000;
const DEFAULT_MIN_OUTPUT_TOKENS = 3000;

function minOutputBudget(baseUrl: string): number {
  return baseUrl.includes("api.deepseek.com") ? DEEPSEEK_DIRECT_MIN_OUTPUT_TOKENS : DEFAULT_MIN_OUTPUT_TOKENS;
}

export function createOpenAICompatProvider(opts: OpenAICompatOptions): LlmProvider {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const doFetch = opts.fetchImpl ?? fetch;
  const rejectObservedModel = (
    code: "observed_model_missing" | "observed_model_family_unresolved" | "observed_model_family_mismatch",
    details: { observedModel?: string; observedFamily?: Family } = {}
  ): void => {
    try {
      opts.onObservedModelRejected?.({
        code,
        ...(opts.expectedFamily ? { expectedFamily: opts.expectedFamily } : {}),
        ...details
      });
    } catch {
      // 审计出口异常不得把既定 fail-closed 结果洗成 provider 异常或成功。
    }
  };

  async function once(req: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const controller = new AbortController();
    let timedOut = false;
    const onCallerAbort = (): void => controller.abort();
    signal?.addEventListener("abort", onCallerAbort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const body: Record<string, unknown> = {
        model: opts.model,
        // function-call 装配(接线批任务③):assistant 带 tool_calls / tool 结果带 tool_call_id
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.toolCalls && m.toolCalls.length > 0
            ? {
                tool_calls: m.toolCalls.map((tc) => ({
                  id: tc.id,
                  type: "function",
                  function: { name: tc.name, arguments: tc.arguments }
                }))
              }
            : {}),
          ...(m.toolCallId !== undefined ? { tool_call_id: m.toolCallId } : {})
        })),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        // 8/6 晚破案:deepseek-v4-pro 等 reasoning 模型把预算花在 reasoning 字段,content=null 被判
        // invalid_response(今日"上游抖动"总根因,instructions 加长后暴增)。max_tokens 上调给推理留
        // 空间 + OpenRouter 统一 reasoning 限额(非 reasoning 模型忽略该字段,无害)
        ...(req.maxTokens !== undefined ? { max_tokens: Math.max(req.maxTokens, minOutputBudget(opts.baseUrl)) } : {}),
        // reasoning 限额是 OpenRouter 统一参数;其他 openai 兼容端点可能拒未知字段,按 baseUrl 收窄
        ...(opts.baseUrl.includes("openrouter") ? { reasoning: { max_tokens: 1200 } } : {})
      };
      if (req.jsonSchema) {
        body["response_format"] = { type: "json_schema", json_schema: { name: "result", schema: req.jsonSchema } };
      }
      if (req.tools && req.tools.length > 0) {
        body["tools"] = req.tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters }
        }));
      }
      if (opts.providerPinning) {
        // OpenRouter 路由控制:固定 order + allow_fallbacks=false ⇒ 钉单一上游(前缀缓存 per-provider,跨供应商一次即全量 miss)
        body["provider"] = { order: opts.providerPinning.order, allow_fallbacks: opts.providerPinning.allowFallbacks };
      }
      const res = await doFetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (res.status === 429) {
        return { ok: false, code: "rate_limited", message: `429 from provider`, retryable: true };
      }
      if (!res.ok) {
        const text = (await res.text().catch(() => "")).slice(0, 300);
        return {
          ok: false,
          code: res.status >= 500 ? "http_5xx" : "http_4xx",
          message: `${res.status}: ${text}`,
          retryable: res.status >= 500
        };
      }
      const json = (await res.json()) as {
        model?: string;
        provider?: string; // OpenRouter 回显实际路由 provider(M2)
        choices?: {
          finish_reason?: string;
          message?: {
            content?: string | null;
            tool_calls?: { id?: string; type?: string; function?: { name?: string; arguments?: string } }[];
          };
        }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
          /** Anthropic 系经网关回带的缓存写入量(W5a 3.5;09 §9 注 1.25x 写入价列位) */
          cache_creation_input_tokens?: number;
        };
      };
      // 09 §11 规则 2 的模型身份证据先于正文/tool 形状校验。否则“换族 + 畸形正文”会先以
      // invalid_response 返回，绕过 provider.observed_model_rejected 不可变审计。
      if (typeof json.model !== "string" || json.model === "") {
        rejectObservedModel("observed_model_missing");
        return { ok: false, code: "observed_model_missing", message: "api response missing/invalid model field (09 §11 rule2 strict)", retryable: false };
      }
      if (opts.expectedFamily !== undefined) {
        const observedFamily = familyFromModelName(json.model);
        if (!observedFamily) {
          rejectObservedModel("observed_model_family_unresolved", { observedModel: json.model });
          return {
            ok: false,
            code: "observed_model_family_unresolved",
            message: `api response model family unresolved:${json.model}`,
            retryable: false
          };
        }
        if (observedFamily !== opts.expectedFamily) {
          rejectObservedModel("observed_model_family_mismatch", { observedModel: json.model, observedFamily });
          return {
            ok: false,
            code: "observed_model_family_mismatch",
            message: `api response model family ${observedFamily} differs from configured ${opts.expectedFamily}`,
            retryable: false
          };
        }
      }
      const msg = json.choices?.[0]?.message;
      // 工具调用解析(形状不合的调用项整响应作废——fail-closed,不静默剔除)
      const rawCalls = msg?.tool_calls ?? [];
      const toolCalls: { id: string; name: string; arguments: string }[] = [];
      for (const c of rawCalls) {
        if (typeof c.id !== "string" || typeof c.function?.name !== "string" || typeof c.function?.arguments !== "string") {
          return { ok: false, code: "invalid_response", message: "malformed tool_call entry", retryable: false };
        }
        toolCalls.push({ id: c.id, name: c.function.name, arguments: c.function.arguments });
      }
      const text = typeof msg?.content === "string" ? msg.content : "";
      if (toolCalls.length === 0 && typeof msg?.content !== "string") {
        return { ok: false, code: "invalid_response", message: "no choices[0].message.content", retryable: false };
      }
      // 预算耗尽在 reasoning ⇒ content 是合法空串,此前会被当成"模型回了空话"静默放行(fail-open)。
      // 空回答对上游是坏结果而非无结果,必须显形(2026-08-15 实测 deepseek v4 该形态)。
      if (toolCalls.length === 0 && text.length === 0 && json.choices?.[0]?.finish_reason === "length") {
        return {
          ok: false,
          code: "invalid_response",
          message: "输出预算耗尽在 reasoning,未产出 content(finish=length)——调高该槽 max_tokens 或改用非 reasoning 模型",
          retryable: false
        };
      }
      return {
        ok: true,
        text,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
        requestedModel: opts.model,
        observedModel: json.model,
        observedModelSource: "stream",
        observedModelExempted: false,
        ...(json.provider !== undefined ? { routedProvider: json.provider } : {}),
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens ?? 0,
              completionTokens: json.usage.completion_tokens ?? 0,
              // M4:统一 usage 命名——OpenAI prompt_tokens_details.cached_tokens(Anthropic 侧适配器映射 cache_read_input_tokens)
              ...(json.usage.prompt_tokens_details?.cached_tokens !== undefined
                ? { cachedPromptTokens: json.usage.prompt_tokens_details.cached_tokens }
                : {}),
              // W5a 3.5:缓存写入量(Anthropic cache_creation_input_tokens;上游回带才记)
              ...(json.usage.cache_creation_input_tokens !== undefined
                ? { cacheWriteInputTokens: json.usage.cache_creation_input_tokens }
                : {})
            }
          : undefined
      };
    } catch (err) {
      const callerCancelled = signal?.aborted === true;
      const aborted = controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
      return {
        ok: false,
        code: callerCancelled ? "cancelled" : aborted && timedOut ? "timeout" : "network",
        message: String(err).slice(0, 200),
        retryable: !callerCancelled
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  return {
    kind: "api",
    model: opts.model,
    async chat(req, signal) {
      const first = await once(req, signal);
      if (first.ok || !first.retryable) return first;
      return once(req, signal); // 统一重试一次(E1)
    }
  };
}
