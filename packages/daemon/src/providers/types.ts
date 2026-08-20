// E1 Provider 抽象(modules/e E1):API 与 BYOA(codex/claude/cursor CLI)共用同一调用合同。

export interface ChatToolCall {
  id: string;
  name: string;
  /** 原始 JSON 串(解析与校验在工具注册表 dispatch,fail-closed) */
  arguments: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** assistant 消息携带的工具调用(function-call 装配,接线批任务③) */
  toolCalls?: ChatToolCall[];
  /** tool 结果消息回指的调用 id */
  toolCallId?: string;
}

/** 工具声明(OpenAI function 形态;parameters = JSON Schema) */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** 结构化输出约束(JSON schema;沉思档合同生成用) */
  jsonSchema?: Record<string, unknown>;
  /** 工具面(09 §13;Brain 只发起,daemon 执行) */
  tools?: ToolSpec[];
  /** 本次调用允许额外启动的进程次数;oneshot 用它保证跨层全局最多重试一次。 */
  retryBudget?: 0 | 1;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  /** 缓存命中的输入 token(M4/③-4:OpenAI prompt_tokens_details.cached_tokens / Anthropic cache_read_input_tokens);
   *  缓存命中率度量的前提,cost_entries.meta 必记(cached<=input) */
  cachedPromptTokens?: number;
  /** 缓存写入的输入 token(W5a 3.5;09 §9 注预留列位:Anthropic cache_creation_input_tokens,1.25x 写入价)——
   *  上游回带才记,不编数 */
  cacheWriteInputTokens?: number;
}

export interface ChatResponse {
  ok: true;
  text: string;
  /** 模型发起的工具调用(有则 text 可为空;执行与回填由 toolLoop 承载) */
  toolCalls?: ChatToolCall[];
  /** 配置请求的模型;T18 observedModel 四字段口径之一。 */
  requestedModel: string | undefined;
  /** 响应体 model 字段(09 §11 规则 2:api 适配器必须提取,供 familyOf 运行时断言;缺失时 undefined 由调用方作废该结果) */
  observedModel: string | undefined;
  /** 实际模型证据来源。 */
  observedModelSource: "stream" | "verified_binary_default" | "unknown";
  /** 是否使用经绝对路径+内容 digest 登记的 familyFixed 豁免。 */
  observedModelExempted: boolean;
  usage: ChatUsage | undefined;
  /** 实际路由的上游 provider(M2/①-4:OpenRouter 聚合网关回显;钉路由后应恒等于白名单单一上游;入 invocation/cost meta) */
  routedProvider?: string | undefined;
  /** BYOA 本次 chat 实际启动的进程数;调用层据此不得叠加第三次。 */
  attemptsMade?: number;
}

export interface ProviderError {
  ok: false;
  code: string; // timeout / http_4xx / http_5xx / network / subscription_rate_limited / invalid_response
  message: string;
  retryable: boolean;
  /** BYOA 本次 chat 实际启动的进程数;调用层据此不得叠加第三次。 */
  attemptsMade?: number;
}

export type ChatResult = ChatResponse | ProviderError;

export interface LlmProvider {
  readonly kind:
    | "api"
    | "codex_cli"
    | "claude_cli"
    | "cursor_cli"
    | "grok_cli"
    | "gemini_cli"
    | "qwen_cli"
    | "copilot_cli";
  readonly model: string;
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResult>;
}
