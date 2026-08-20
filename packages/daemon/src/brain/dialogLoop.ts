// A3 对话环最小 live 形态(5.4 "可日用"落点):asr.final -> 对话档 LLM -> 分句 tts.say。
// 纪律:
// - TTS 脱敏红线(10 §1):所有出口文本过 redactForSpeech;
// - 状态词纪律由 instructions 承载(golden 已验);口播 <=30s(超长截到句边界转"细节我放屏幕上了");
// - C8 记账(M4 meta 定型:cached tokens + routed provider);M3 llm_first_token 埋点
//   (P0 非流式:以响应到达近似首 token,如实注记);
// - 工具环(remember/propose_package 等)P0 由工具契约测试承载,live 工具调用随场次② dogfood 增量
//   ——本环 P0 纯对话 + 采访话术(instructions 驱动),不产生副作用(副作用一律经工具,骨架 rule 4)。

import { BRAIN_INSTRUCTIONS } from "./instructions.js";
import { redactForSpeech } from "../voice/redactor.js";
import type { ChatMessage, ChatUsage, LlmProvider, ToolSpec } from "../providers/types.js";
import type { ToolRegistry, ToolContext } from "./registry.js";
import { z } from "zod";

/** L8:上游空响应(invalid_response)自动重试一次——瞬时抖动占绝大多数,重试即愈;仍失败才走降级话术 */
async function chatWithRetry(
  provider: LlmProvider,
  req: Parameters<LlmProvider["chat"]>[0],
  signal?: AbortSignal
): Promise<Awaited<ReturnType<LlmProvider["chat"]>>> {
  const first = await provider.chat(req, signal);
  if (!first.ok && first.code === "invalid_response") {
    return provider.chat(req, signal);
  }
  return first;
}

/** J10 零工具宣告拦截:账本动作完成式宣告词(避开提议式"我提议:记下") */
export const LEDGER_CLAIM_RE =
  /(记下了|已记下|办结了|已办结|销账|落账了|已落账|都齐了|两笔都齐|拆好了|已拆出|现在拆线|正在拆线)/;
/** ④e 话术门:J10 同族——"放屏幕"宣告须本轮 screen_text 投递 succeeded≥1(dialog 层判定) */
export const SCREEN_CLAIM_RE = /(细节放屏幕|放屏幕上了|放屏幕上|我放屏幕|细节有点多,\s*我放屏幕)/;
/** 账本写类工具白名单:本轮碰过任一(即使 pending 确认)即不拦 */
export const LEDGER_WRITE_TOOLS = new Set([
  "proposeObligation",
  "proposeObligationResolve",
  "proposeLaneSplit",
  "proposeExpectationAck",
  "proposeFocusAnchor",
  "proposeFocusRevision",
  "confirmAndDispatch",
  "suspendSession",
  "remember"
]);

export const DIALOG_CLI_ONESHOT_ALLOWLIST = [
  "remember",
  "createTask",
  "getStatus",
  "getDecisionPackage",
  "getFocusStatus",
  "resolveProject",
  "proposeProjectAnchor",
  "proposeStart",
  "confirmReadiness",
  "proposeFocusAnchor",
  "proposeObligation",
  "proposeObligationResolve",
  "proposeFocusRevision",
  "proposeLaneSplit",
  "proposeExpectationAck"
] as const;

export type DialogCliOneshotTool = (typeof DIALOG_CLI_ONESHOT_ALLOWLIST)[number];

export const DIALOG_CLI_ONESHOT_PENDING_TOOLS = new Set<DialogCliOneshotTool>([
  "resolveProject",
  "proposeProjectAnchor",
  "confirmReadiness",
  "proposeFocusAnchor",
  "proposeObligation",
  "proposeObligationResolve",
  "proposeFocusRevision",
  "proposeLaneSplit",
  "proposeExpectationAck"
]);

const dialogCliOneshotActionSchema = z.strictObject({
  id: z.string().trim().min(1).max(80),
  tool: z.enum(DIALOG_CLI_ONESHOT_ALLOWLIST),
  arguments: z.record(z.string(), z.unknown())
});

export const dialogCliOneshotEnvelopeSchema = z
  .strictObject({
    version: z.literal(1),
    reply: z.string().trim().min(1).max(12_000),
    actions: z.array(dialogCliOneshotActionSchema).max(8)
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    let pendingActions = 0;
    for (const [index, action] of value.actions.entries()) {
      if (ids.has(action.id)) {
        ctx.addIssue({ code: "custom", path: ["actions", index, "id"], message: "action id 同轮必须唯一" });
      }
      ids.add(action.id);
      if (Buffer.byteLength(JSON.stringify(action.arguments)) > 32 * 1024) {
        ctx.addIssue({ code: "custom", path: ["actions", index, "arguments"], message: "action arguments 超过 32 KiB" });
      }
      if (DIALOG_CLI_ONESHOT_PENDING_TOOLS.has(action.tool)) pendingActions += 1;
    }
    if (pendingActions > 1) {
      ctx.addIssue({ code: "custom", path: ["actions"], message: "同轮至多一个可能产生 pending 的 action" });
    }
  });

export type DialogCliOneshotEnvelope = z.infer<typeof dialogCliOneshotEnvelopeSchema>;

const DIALOG_CLI_ONESHOT_ENVELOPE_PROPERTIES = {
  version: { type: "integer", const: 1 },
  reply: { type: "string", minLength: 1, maxLength: 12_000 }
} as const;

function schemaTypeOf(value: unknown): string | undefined {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "number";
  if (typeof value === "string" || typeof value === "boolean") return typeof value;
  if (typeof value === "object") return "object";
  return undefined;
}

/** OpenAI/Codex strict schema 要求 object 的每个 property 都列入 required;原可选字段转为 nullable。 */
function strictToolParameterSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...schema };
  if (normalized["type"] === undefined && Object.hasOwn(normalized, "const")) {
    const inferred = schemaTypeOf(normalized["const"]);
    if (inferred) normalized["type"] = inferred;
  }
  if (normalized["type"] === "object") {
    const properties =
      normalized["properties"] && typeof normalized["properties"] === "object" && !Array.isArray(normalized["properties"])
        ? (normalized["properties"] as Record<string, unknown>)
        : {};
    const originallyRequired = new Set(
      Array.isArray(normalized["required"])
        ? normalized["required"].filter((value): value is string => typeof value === "string")
        : []
    );
    const strictProperties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => {
        const child =
          value && typeof value === "object" && !Array.isArray(value)
            ? strictToolParameterSchema(value as Record<string, unknown>)
            : {};
        return [key, originallyRequired.has(key) ? child : { anyOf: [child, { type: "null" }] }];
      })
    );
    normalized["properties"] = strictProperties;
    normalized["required"] = Object.keys(strictProperties);
    normalized["additionalProperties"] = false;
  }
  if (normalized["items"] && typeof normalized["items"] === "object" && !Array.isArray(normalized["items"])) {
    normalized["items"] = strictToolParameterSchema(normalized["items"] as Record<string, unknown>);
  }
  for (const combinator of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(normalized[combinator])) {
      normalized[combinator] = normalized[combinator].map((part) =>
        part && typeof part === "object" && !Array.isArray(part)
          ? strictToolParameterSchema(part as Record<string, unknown>)
          : part
      );
    }
  }
  return normalized;
}

/** strict output 把可选字段编码成 null;dispatch 前还原成原工具合同里的“省略”。 */
function restoreOptionalArguments(value: unknown, schema: Record<string, unknown>): unknown {
  if (Array.isArray(value)) {
    const items = schema["items"];
    return items && typeof items === "object" && !Array.isArray(items)
      ? value.map((item) => restoreOptionalArguments(item, items as Record<string, unknown>))
      : value;
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || schema["type"] !== "object") return value;
  const properties =
    schema["properties"] && typeof schema["properties"] === "object" && !Array.isArray(schema["properties"])
      ? (schema["properties"] as Record<string, unknown>)
      : {};
  const required = new Set(
    Array.isArray(schema["required"])
      ? schema["required"].filter((item): item is string => typeof item === "string")
      : []
  );
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      if (child === null && !required.has(key)) return [];
      const childSchema = properties[key];
      return [
        [
          key,
          childSchema && typeof childSchema === "object" && !Array.isArray(childSchema)
            ? restoreOptionalArguments(child, childSchema as Record<string, unknown>)
            : child
        ]
      ];
    })
  );
}

/** Codex strict schema 要求所有 object 都封闭;按 registry 的真实参数 schema 生成 tool-discriminated action。 */
export function dialogCliOneshotJsonSchema(toolSpecs: readonly ToolSpec[]): Record<string, unknown> {
  const allowlist = new Set<string>(DIALOG_CLI_ONESHOT_ALLOWLIST);
  const variants = toolSpecs
    .filter((spec) => allowlist.has(spec.name))
    .map((spec) => ({
      type: "object",
      additionalProperties: false,
      required: ["id", "tool", "arguments"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 80 },
        tool: { type: "string", const: spec.name },
        arguments: strictToolParameterSchema(spec.parameters)
      }
    }));
  const itemSchema =
    variants.length > 0
      ? { anyOf: variants }
      : {
          type: "object",
          additionalProperties: false,
          required: ["id", "tool", "arguments"],
          properties: {
            id: { type: "string", minLength: 1, maxLength: 80 },
            tool: { type: "string", enum: [...DIALOG_CLI_ONESHOT_ALLOWLIST] },
            arguments: { type: "object", additionalProperties: false, properties: {} }
          }
        };
  return {
    type: "object",
    additionalProperties: false,
    required: ["version", "reply", "actions"],
    properties: {
      ...DIALOG_CLI_ONESHOT_ENVELOPE_PROPERTIES,
      actions: { type: "array", maxItems: 8, items: itemSchema }
    }
  };
}

/** 无 registry 的 setup 自检只允许零 actions;生产调用使用 dialogCliOneshotJsonSchema(registry.specs())。 */
export const DIALOG_CLI_ONESHOT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "reply", "actions"],
  properties: {
    ...DIALOG_CLI_ONESHOT_ENVELOPE_PROPERTIES,
    actions: {
      type: "array",
      minItems: 0,
      maxItems: 0,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "tool", "arguments"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 80 },
          tool: { type: "string", enum: [...DIALOG_CLI_ONESHOT_ALLOWLIST] },
          arguments: { type: "object", additionalProperties: false, properties: {} }
        }
      }
    }
  }
} as const;

export function parseDialogCliOneshotEnvelope(text: string): DialogCliOneshotEnvelope | null {
  if (Buffer.byteLength(text) > 64 * 1024) return null;
  try {
    const parsed = dialogCliOneshotEnvelopeSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const ONESHOT_CORE_INSTRUCTIONS = `你是 SayDo 的文本对话大脑。简短、口语、中文,先结论后细节。
只输出一个符合 schema 的 JSON 对象,不得输出 Markdown 或附加文字。reply 是给用户看的回复;actions 按发生顺序列出。
一切写入只能通过 allowlist action;不得声称已经记下、销账、拆线或交付,除非同轮安排了对应 action。
用户明确要求记下待办或决定时优先 proposeObligation;用户带具体事情开场时可 proposeFocusAnchor;就绪信息用 remember,任务草稿用 createTask。
显式记录请求(记一下/别忘了/记住):若当前 manifest 没有 proposeObligation,必须降级用 remember 当轮记下,reply 说明「先记进记忆;这件事立起来后可以再挂到账上」,不许因缺工具而拒绝。
reply 里绝不出现内部术语(action/allowlist/manifest/工具名等),一律说人话。
S3、派发、删除、会话控制、本地文件和屏幕动作一律不请求。一次只发起一个可能等待用户确认的 action;它必须放在 actions 最后。
失败、不确定或缺参数时 reply 如实说明并询问,不要猜。`;

function dynamicOneshotInstructions(instructions: string | undefined): string {
  if (!instructions) return "";
  const sections: string[] = [];
  const readinessAt = instructions.indexOf("[就绪采访清单");
  const anchorAt = instructions.indexOf("[项目归属轮状态]");
  if (readinessAt >= 0) {
    sections.push(instructions.slice(readinessAt, anchorAt > readinessAt ? anchorAt : undefined));
  }
  if (anchorAt >= 0) sections.push(instructions.slice(anchorAt));
  return sections.join("\n\n");
}

export function buildDialogCliOneshotMessages(input: DialogTurnInput, registry: ToolRegistry): ChatMessage[] {
  const allowlist = new Set<string>(DIALOG_CLI_ONESHOT_ALLOWLIST);
  const manifest = registry.specs().filter((spec) => allowlist.has(spec.name));
  const dynamic = dynamicOneshotInstructions(input.instructions);
  const systemContent = [
    ONESHOT_CORE_INSTRUCTIONS,
    dynamic,
    `[action manifest]\n${JSON.stringify(manifest)}`,
    input.packText ? `[Context Pack]\n${input.packText}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...input.history.slice(-12).map((item) => ({
      role: item.speaker === "user" ? ("user" as const) : ("assistant" as const),
      content: item.text
    }))
  ];
  messages.push(
    input.controlMessage !== undefined
      ? { role: "system", content: input.controlMessage }
      : { role: "user", content: input.userText }
  );
  return messages;
}

const ONESHOT_RETRY_INSTRUCTION =
  "上一轮 JSON 未通过 schema。只重答一个合法 envelope;version=1,reply 非空,actions 只用 allowlist;不得解释或使用 Markdown。";

/** 强化指令并入首个 system,确保 B4 截断仍把末尾当前请求作为保底消息。 */
export function reinforceDialogCliOneshotMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message, index) =>
    index === 0 && message.role === "system"
      ? { ...message, content: `${ONESHOT_RETRY_INSTRUCTION}\n\n${message.content}` }
      : message
  );
}

export interface DialogTurnInput {
  sessionId: string;
  turnId: string;
  userText: string;
  /** 近轮对话(调用方从 A2 转写取;M8 高水位截断先简化全量) */
  history: { speaker: "user" | "ai"; text: string }[];
  /** Context Pack 渲染文本(B1;可空=未编译) */
  packText?: string;
  /** 动态 instructions(A3-armed §1.8:含就绪采访清单段,每轮现算;缺省 = 静态 BRAIN_INSTRUCTIONS) */
  instructions?: string;
  /**
   * ④c 控制轮:以 system 角色注入的控制消息(非 user role)。
   * 有此字段时不追加 user 消息;Brain 收到即续办信号。
   */
  controlMessage?: string;
  /** 轮起源:control=运维/控制轮口径,不计用户会话交互统计 */
  origin?: "user" | "control";
  /** 当前轮生命周期；BYOA 槽须在抢占/关闭时终止子进程。 */
  signal?: AbortSignal;
}

/** 组装 dialog 消息列表(用户轮 vs 控制轮分叉) */
export function buildDialogMessages(input: DialogTurnInput): ChatMessage[] {
  const systemContent = input.packText
    ? `${input.instructions ?? BRAIN_INSTRUCTIONS}\n\n[Context Pack]\n${input.packText}`
    : (input.instructions ?? BRAIN_INSTRUCTIONS);
  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...input.history.slice(-12).map((h) => ({
      role: h.speaker === "user" ? ("user" as const) : ("assistant" as const),
      content: h.text
    }))
  ];
  if (input.controlMessage !== undefined) {
    messages.push({ role: "system", content: input.controlMessage });
  } else {
    messages.push({ role: "user", content: input.userText });
  }
  return messages;
}

export interface DialogTurnOutput {
  sentences: { sentenceId: string; text: string }[];
  /** provider 返回的完整模型原文；供截断/分句前的输出闸判定，不直接口播或落日志。 */
  modelText?: string;
  observedModel?: string | undefined;
  usage?: { promptTokens: number; completionTokens: number; cachedPromptTokens?: number; cacheWriteInputTokens?: number } | undefined;
  routedProvider?: string | undefined;
  /** llm 响应到达单调毫秒(M3 llm_first_token 近似;非流式如实注记) */
  llmArrivedAtMs: number;
  error?: string;
  /** provider 结构化错误码(impl-readback B2:observed_model_missing 需专用审计与话术,调用方按码分支) */
  errorCode?: string;
}

/** 分句(中文句读;<=30s 口播纪律由句数上限近似:最多 6 句,余转屏幕) */
export function splitSentences(text: string, maxSentences = 6): string[] {
  const parts = text
    .replace(/\n+/g, "。")
    .split(/(?<=[。!?！？;；])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length <= maxSentences) return parts;
  return [...parts.slice(0, maxSentences), "细节有点多,我放屏幕上了。"];
}

export async function runDialogTurn(
  provider: LlmProvider,
  input: DialogTurnInput,
  nowMs: () => number = () => performance.now()
): Promise<DialogTurnOutput> {
  const messages = buildDialogMessages(input);
  const res = await chatWithRetry(provider, { messages, temperature: 0.4, maxTokens: 400 }, input.signal);
  const arrived = nowMs();
  if (!res.ok) {
    // 降级话术(11 §5.9 人话一句;不静默)。impl-readback B2:作废类(observed_model_missing)与
    // "没接通"是两回事——模型接通了、响应缺身份标识,话术如实区分,免得用户去检查本没错的配置。
    // 双匹配(回收批 C-1 防踩):BYOA 侧同语义码是前缀拼接的 voided_observed_model_missing——对话档
    // 虽恒 api(07 D18),但本函数不绑定 provider 形态,防日后接 BYOA 时作废轮误走"没接通"。
    const voided = res.code === "observed_model_missing" || res.code === "voided_observed_model_missing";
    return {
      sentences: [
        {
          sentenceId: `s-${input.turnId}-${voided ? "void" : "err"}`,
          text: voided
            ? "这轮的模型应答没带身份标识,按规矩作废了,你再说一遍。"
            : res.code === "invalid_response"
              ? "这一轮上游没接住,你再说一遍就好——配置没问题,不用去动。"
              : "对话模型这边没接通,你在屏幕上看下设置里的模型配置。"
        }
      ],
      llmArrivedAtMs: arrived,
      error: `${res.code}: ${res.message}`,
      // errorCode 归一:两种拼写统一为 canonical 码透出(下游审计/分支只认一种,error 字段保留原码供日志)
      errorCode: voided ? "observed_model_missing" : res.code
    };
  }
  // TTS 脱敏红线:出口统一 redact(token/路径/PII 永不进语音)
  const sentences = splitSentences(res.text).map((t, i) => ({
    sentenceId: `s-${input.turnId}-${i}`,
    text: redactForSpeech(t).text
  }));
  return {
    sentences,
    modelText: res.text,
    observedModel: res.observedModel,
    usage: res.usage,
    routedProvider: res.routedProvider,
    llmArrivedAtMs: arrived
  };
}

// ---- live 工具调用环(接线批任务③;09 §13 function-call 装配)----

export interface ToolLoopDeps {
  registry: ToolRegistry;
  ctx: ToolContext;
  /** 当前用户轮是否仍有效；下一轮到达后旧轮不得再调工具或产出口播。 */
  isCurrent?: () => boolean;
  /** 单轮最多几步模型调用(防循环;超步取末步文本收口) */
  maxSteps?: number;
  /** 每步记账钩子(每次模型调用各记一条 usage/invocation——多步不合并,审计如实) */
  onStep?: (step: {
    usage?: ChatUsage | undefined;
    observedModel?: string | undefined;
    routedProvider?: string | undefined;
    toolCalls: number;
  }) => void;
  /** J11 每次工具调用审计钩子("说了没做"分歧的裁决依据;消费方打持久日志行) */
  onToolCall?: (info: { name: string; ok: boolean; code?: string | undefined }) => void;
}

export interface ToolLoopOutput extends DialogTurnOutput {
  /** 本轮实际执行的工具调用数(审计/测试锚) */
  toolCallsMade: number;
}

function awaitsUser(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { control?: unknown }).control === "await_user"
  );
}

function actionFailed(result: unknown): result is { ok: false; code?: string } {
  return typeof result === "object" && result !== null && (result as { ok?: unknown }).ok === false;
}

const ONESHOT_FORMAT_ERROR_REPLY = "这轮慢速模式的回复格式不对,没有写入任何内容。你再说一次。";
const ONESHOT_ACTION_ERROR_REPLY = "这轮提议没有写进去,我停在这里了。你再说一次,或到屏幕上看看具体原因。";

/**
 * CLI 对话单发:一次结构化模型调用产 reply+有序 actions,daemon 逐项 dispatch。
 * 解析失败仅在零 action 已应用时强化重试一次;action 失败永不重跑整轮。
 */
export async function runDialogCliOneshot(
  provider: LlmProvider,
  input: DialogTurnInput,
  deps: ToolLoopDeps,
  nowMs: () => number = () => performance.now()
): Promise<ToolLoopOutput> {
  const baseMessages = buildDialogCliOneshotMessages(input, deps.registry);
  const toolSpecs = deps.registry.specs();
  const outputSchema = dialogCliOneshotJsonSchema(toolSpecs);
  const toolSpecByName = new Map(toolSpecs.map((spec) => [spec.name, spec]));
  let arrived = 0;
  let toolCallsMade = 0;
  let actionsApplied = 0;
  let envelope: DialogCliOneshotEnvelope | null = null;
  let lastMeta: Pick<ToolLoopOutput, "observedModel" | "usage" | "routedProvider"> = {
    observedModel: undefined,
    usage: undefined
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const messages =
      attempt === 0
        ? baseMessages
        : reinforceDialogCliOneshotMessages(baseMessages);
    const res = await provider.chat(
      {
        messages,
        temperature: 0.2,
        maxTokens: 1200,
        jsonSchema: outputSchema,
        retryBudget: attempt === 0 ? 1 : 0
      },
      input.signal
    );
    if (attempt === 0) arrived = nowMs();
    if (deps.isCurrent && !deps.isCurrent()) {
      return { sentences: [], llmArrivedAtMs: arrived || nowMs(), toolCallsMade };
    }
    if (!res.ok) {
      const schemaFailure = res.code === "invalid_structured_output";
      if (schemaFailure && attempt === 0 && (res.attemptsMade ?? 1) === 1 && actionsApplied === 0) continue;
      const text = schemaFailure
        ? ONESHOT_FORMAT_ERROR_REPLY
        : res.code === "input_limit"
          ? "这轮带的上下文太长,慢速模式装不下。你缩短一点再说。"
          : "CLI 慢速模式这轮没接通,你再说一次,或到设置里检查自检状态。";
      return {
        sentences: [{ sentenceId: `s-${input.turnId}-oneshot-error`, text }],
        llmArrivedAtMs: arrived || nowMs(),
        error: `${res.code}: ${res.message}`,
        errorCode: res.code,
        toolCallsMade
      };
    }
    deps.onStep?.({
      usage: res.usage,
      observedModel: res.observedModel,
      routedProvider: res.routedProvider,
      toolCalls: 0
    });
    lastMeta = { observedModel: res.observedModel, usage: res.usage, routedProvider: res.routedProvider };
    envelope = parseDialogCliOneshotEnvelope(res.text);
    if (envelope) break;
    if (attempt > 0 || actionsApplied > 0 || (res.attemptsMade ?? 1) > 1) break;
  }

  if (!envelope) {
    return {
      sentences: [{ sentenceId: `s-${input.turnId}-oneshot-format`, text: ONESHOT_FORMAT_ERROR_REPLY }],
      ...lastMeta,
      llmArrivedAtMs: arrived || nowMs(),
      error: "invalid_oneshot_envelope",
      errorCode: "invalid_structured_output",
      toolCallsMade
    };
  }

  const toolNamesCalled = new Set<string>();
  for (const action of envelope.actions) {
    toolCallsMade += 1;
    toolNamesCalled.add(action.tool);
    const spec = toolSpecByName.get(action.tool);
    const argumentsForDispatch = spec
      ? restoreOptionalArguments(action.arguments, spec.parameters)
      : action.arguments;
    const result = await deps.registry.dispatch(action.tool, JSON.stringify(argumentsForDispatch), deps.ctx);
    deps.onToolCall?.({
      name: action.tool,
      ok: !actionFailed(result),
      ...(actionFailed(result) && result.code ? { code: result.code } : {})
    });
    if (deps.isCurrent && !deps.isCurrent()) {
      return { sentences: [], ...lastMeta, llmArrivedAtMs: arrived || nowMs(), toolCallsMade };
    }
    if (actionFailed(result)) {
      return {
        sentences: [{ sentenceId: `s-${input.turnId}-oneshot-action`, text: ONESHOT_ACTION_ERROR_REPLY }],
        ...lastMeta,
        llmArrivedAtMs: arrived || nowMs(),
        error: `oneshot_action_failed:${action.tool}:${result.code ?? "unknown"}`,
        errorCode: "oneshot_action_failed",
        toolCallsMade
      };
    }
    actionsApplied += 1;
    if (awaitsUser(result)) {
      return { sentences: [], ...lastMeta, llmArrivedAtMs: arrived || nowMs(), toolCallsMade };
    }
  }

  let finalText = envelope.reply;
  if (LEDGER_CLAIM_RE.test(finalText) && ![...toolNamesCalled].some((name) => LEDGER_WRITE_TOOLS.has(name))) {
    finalText = "刚才那句我说过头了——这轮我没有真正写入账本。你再说一次要记的内容,我用正规通道办。";
  }
  const sentences = splitSentences(finalText).map((text, index) => ({
    sentenceId: `s-${input.turnId}-${index}`,
    text: redactForSpeech(text).text
  }));
  return {
    sentences,
    modelText: finalText,
    ...lastMeta,
    llmArrivedAtMs: arrived || nowMs(),
    toolCallsMade
  };
}

/**
 * 带工具环的对话轮:LLM 发起 tool_calls -> daemon 执行(ToolRegistry)-> 结果回填 -> 续跑,
 * 直至纯文本或步数上限;最终文本分句 + 脱敏下发。错误对象直接作为工具结果回给模型(不断环)。
 */
export async function runDialogTurnWithTools(
  provider: LlmProvider,
  input: DialogTurnInput,
  deps: ToolLoopDeps,
  nowMs: () => number = () => performance.now()
): Promise<ToolLoopOutput> {
  const maxSteps = deps.maxSteps ?? 10; // N12:错误自救链 4 败+1 救即耗尽 6 步,提至 10(guard/isCurrent 兜底)
  const messages = buildDialogMessages(input);
  let arrived = 0;
  let toolCallsMade = 0;
  const toolNamesCalled = new Set<string>();
  let lastText = "";
  let lastMeta: Pick<ToolLoopOutput, "observedModel" | "usage" | "routedProvider"> = {
    observedModel: undefined,
    usage: undefined
  };

  for (let step = 0; step < maxSteps; step++) {
    const res = await chatWithRetry(
      provider,
      { messages, temperature: 0.4, maxTokens: 600, tools: deps.registry.specs() },
      input.signal
    );
    if (step === 0) arrived = nowMs();
    if (deps.isCurrent && !deps.isCurrent()) {
      return { sentences: [], llmArrivedAtMs: arrived || nowMs(), toolCallsMade };
    }
    if (!res.ok) {
      const voided = res.code === "observed_model_missing" || res.code === "voided_observed_model_missing";
      return {
        sentences: [
          {
            sentenceId: `s-${input.turnId}-${voided ? "void" : "err"}`,
            text: voided
              ? "这轮的模型应答没带身份标识,按规矩作废了,你再说一遍。"
              : res.code === "invalid_response"
                ? "这一轮上游没接住,你再说一遍就好——配置没问题,不用去动。"
                : "对话模型这边没接通,你在屏幕上看下设置里的模型配置。"
          }
        ],
        llmArrivedAtMs: arrived || nowMs(),
        error: `${res.code}: ${res.message}`,
        errorCode: voided ? "observed_model_missing" : res.code,
        toolCallsMade
      };
    }
    deps.onStep?.({
      usage: res.usage,
      observedModel: res.observedModel,
      routedProvider: res.routedProvider,
      toolCalls: res.toolCalls?.length ?? 0
    });
    lastMeta = { observedModel: res.observedModel, usage: res.usage, routedProvider: res.routedProvider };
    lastText = res.text;
    if (!res.toolCalls || res.toolCalls.length === 0) break;
    messages.push({ role: "assistant", content: res.text, toolCalls: res.toolCalls });
    for (const tc of res.toolCalls) {
      toolCallsMade += 1;
      toolNamesCalled.add(tc.name);
      const result = await deps.registry.dispatch(tc.name, tc.arguments, deps.ctx);
      {
        const r = result as { ok?: boolean; code?: string } | null;
        deps.onToolCall?.({ name: tc.name, ok: r?.ok !== false, code: r?.ok === false ? r?.code : undefined });
      }
      if (deps.isCurrent && !deps.isCurrent()) {
        return {
          sentences: [],
          ...lastMeta,
          llmArrivedAtMs: arrived || nowMs(),
          toolCallsMade
        };
      }
      if (awaitsUser(result)) {
        return {
          sentences: [],
          ...lastMeta,
          llmArrivedAtMs: arrived || nowMs(),
          toolCallsMade
        };
      }
      messages.push({ role: "tool", toolCallId: tc.id, content: JSON.stringify(result ?? null) });
    }
  }

  // C3(impl-readback 回收批 2):工具环步数耗尽且末步纯 tool_calls ⇒ lastText 为空,用户会听到沉默——
  // 兜底一句中性话术(不说"完成";dogfood 修复 2026-07-28:旧句"放屏幕上了"在屏幕无物时是虚指,改诚实版)
  let finalText = lastText.trim() === "" && toolCallsMade > 0 ? "这轮我调了工具但没组织出口播总结——你再问一句,或到任务页看看有没有新东西。" : lastText;
  // J10 零工具宣告拦截:宣告账本动作完成(记下了/齐了/拆好了/现在拆线…)而本轮没碰任何账本写工具
  // ⇒ 叙事-账本分叉的恶性形态,整轮替换为诚实句(有调用即使 pending 也不拦,只拦零调用的空口宣告)。
  if (LEDGER_CLAIM_RE.test(finalText) && ![...toolNamesCalled].some((n) => LEDGER_WRITE_TOOLS.has(n))) {
    finalText = "刚才那句我说过头了——这轮我没有真正写入账本。你再说一次要记/要拆的内容,我用正规通道办。";
  }
  const sentences = splitSentences(finalText).map((t, i) => ({
    sentenceId: `s-${input.turnId}-${i}`,
    text: redactForSpeech(t).text
  }));
  return { sentences, modelText: finalText, ...lastMeta, llmArrivedAtMs: arrived || nowMs(), toolCallsMade };
}
