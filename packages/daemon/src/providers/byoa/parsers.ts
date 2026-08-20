// BYOA 事件流解析(07 D18 实现路径;复评 A3:cursor 独立 raw NDJSON parser)。
// 事件不同型:
//  - codex_cli:jsonl,{type:"item.completed"/"turn.completed"/"item.updated", ...} + assistant 文本;工具事件在 item;todo_list/plan_update/reconnect error/rate_limit_event 为 ignore;
//  - claude_cli:stream-json,{type:"assistant", message:{content:[{type:"text"|"thinking"|"fallback"|"tool_use"}]}};
//    --output-format json 另发顶层无 type 的裸 result(is_error+usage/num_turns);is_error 走 error 终态;
//    fallback.to.model / message.model 作 observedModel(前者优先);thinking skip;未知块 fail-closed;
//    type===system 通知家族一律 ignore(init 保持;其余 subtype 不再逐条白名单);rate_limit_event 为 ignore;
//  - cursor_cli:顶层 {type:"tool_call", subtype:"started"/"completed"}、{type:"thinking"}(内心独白 ignore)、
//    {type:"system"}(init=observedModel;其余 subtype 通知家族 ignore)、{type:"connection"|"retry"}(网络层噪音,已单列) 与 {type:"assistant"/"result"};rate_limit_event 预防 ignore。
//  - grok_cli:streaming-json,{type:"text"|"thought"|"tool_call"|"end", ...};model 在 end.modelUsage 键(2026-08-12 实测);rate_limit_event 预防 ignore。
// 统一产出 ParsedEvent:文本增量 / 工具调用信号(tripwire 用)/ 观测模型 / 未知(fail-closed)。
// claude --output-format json 会吐顶层无 type 的裸 result(v3.8g 限流窗实证);按 result 终态收,不得当 unknown。

// kind 区分:ignore=已知但不消费的元事件(忽略,不作废);unknown=真未知(fail-closed 作废,复评 A3);
// error=供应商终态失败(is_error 等),人话透传,不走 unknown 重试。
export interface ParsedEvent {
  kind: "text" | "tool_call" | "observed_model" | "result" | "error" | "ignore" | "unknown" | "parse_error";
  text?: string;
  toolName?: string;
  observedModel?: string;
  raw?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * rate_limit_event 是限流通知(非终态;status=allowed 纯通知)。
 * Codex/Claude 双实证(v3.8 击杀日志);其余家预防同名 type,不得 fail-closed 作废整轮。
 */
function isRateLimitNotice(type: unknown): boolean {
  return type === "rate_limit_event";
}

/** Claude result 终态特征:is_error 布尔 + usage/num_turns/duration/modelUsage 之一。 */
export function hasClaudeResultShape(obj: Record<string, unknown>): boolean {
  return (
    typeof obj["is_error"] === "boolean" &&
    (typeof obj["num_turns"] === "number" ||
      typeof obj["duration_api_ms"] === "number" ||
      isRecord(obj["usage"]) ||
      isRecord(obj["modelUsage"]))
  );
}

/** --output-format json 裸 result:顶层无 type,但形如 result 终态。cursor result 有 type,不走这条。 */
export function isClaudeBareResult(obj: Record<string, unknown>): boolean {
  return obj["type"] === undefined && hasClaudeResultShape(obj);
}

function claudeResultErrorMessage(obj: Record<string, unknown>): string {
  const errorField = obj["error"];
  const errorText = isRecord(errorField) ? errorField["message"] : errorField;
  const text = firstString(obj["result"], errorText);
  if (text) return text;
  const turns = obj["num_turns"];
  const n = typeof turns === "number" && Number.isFinite(turns) ? String(turns) : "0";
  return `CLI 返回错误终态(通常是用量受限或拒答),num_turns=${n}`;
}

function parseClaudeResultEvent(
  obj: Record<string, unknown>,
  line: string,
  requireStructuredOutput: boolean
): ParsedEvent {
  if (obj["is_error"] === true) {
    return { kind: "error", text: claudeResultErrorMessage(obj), raw: line };
  }
  if (obj["type"] === "result" && obj["subtype"] !== "success") {
    return { kind: "unknown", raw: line };
  }
  const structured = obj["structured_output"];
  if (requireStructuredOutput && structured === undefined) return { kind: "unknown", raw: line };
  if (structured === undefined && obj["result"] !== undefined && typeof obj["result"] !== "string") {
    return { kind: "parse_error", raw: line };
  }
  return {
    kind: "result",
    text: structured !== undefined ? JSON.stringify(structured) : (obj["result"] as string | undefined) ?? "",
    raw: line
  };
}

/** cursor 专用 raw NDJSON parser(复评 A3:顶层 tool_call started/completed;未知/解析失败一律作废) */
export function parseCursorLine(line: string): ParsedEvent {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "unknown", raw: line };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "parse_error", raw: line }; // fail-closed:调用方作废该次结果
  }
  if (!isRecord(parsed)) return { kind: "parse_error", raw: line };
  const obj = parsed;
  const type = obj["type"];
  if (type === "tool_call") {
    const detail = obj["tool_call"];
    const subtype = obj["subtype"];
    const nestedName = isRecord(detail) ? detail["name"] : undefined;
    const toolName = typeof subtype === "string" ? subtype : typeof nestedName === "string" ? nestedName : "unknown_tool";
    return { kind: "tool_call", toolName, raw: line };
  }
  if (type === "system") {
    // system 是通知家族:正文只在 assistant/result,工具执行有专属 tool_call。
    // 家族级裁决(2026-08-13 owner,v3.8f 击杀日志):subtype!=="init" 一律 ignore。
    // 逐 subtype 白名单不可持续;fail-closed 只管未知顶层 type。
    // 实证 subtype:init(observedModel 观测点,保持)、model_refusal_fallback(trigger=refusal,direction=retry)。
    // 顶层 type===connection|retry(reconnecting/starting/reconnected)已单列,不并入本家族。
    if (obj["subtype"] !== "init") return { kind: "ignore", raw: line };
    // 实测(2026-07-24):model 在 system.init 事件顶层,不在 assistant——observedModel 观测点
    const model = obj["model"];
    if (model !== undefined && typeof model !== "string") return { kind: "parse_error", raw: line };
    if (model === "") return { kind: "parse_error", raw: line };
    if (model) return { kind: "observed_model", observedModel: model, raw: line };
    return { kind: "ignore", raw: line };
  }
  if (type === "assistant") {
    const msg = obj["message"];
    const content = isRecord(msg) ? msg["content"] : undefined;
    if (
      !Array.isArray(content) ||
      content.some((block) => !isRecord(block) || block["type"] !== "text" || typeof block["text"] !== "string")
    ) {
      return { kind: "unknown", raw: line };
    }
    const text = content.map((block) => block["text"] as string).join("");
    return { kind: "text", text, raw: line };
  }
  if (type === "result") {
    if (obj["is_error"] === true || obj["subtype"] !== "success") {
      return { kind: "unknown", raw: line };
    }
    const structured = obj["structured_output"];
    if (structured === undefined && obj["result"] !== undefined && typeof obj["result"] !== "string") {
      return { kind: "parse_error", raw: line };
    }
    return {
      kind: "result",
      text: structured !== undefined ? JSON.stringify(structured) : (obj["result"] as string | undefined) ?? "",
      raw: line
    };
  }
  if (type === "user") {
    return { kind: "ignore", raw: line }; // 已知元事件:忽略不作废
  }
  if (type === "thinking") {
    // 思考型模型(cursor-grok-4.6-high-fast 等)stream-json 会发 thinking.delta/completed;
    // 内心独白非正文,不消费不透传,delta/completed 一律 ignore,不得 fail-closed 作废。
    return { kind: "ignore", raw: line };
  }
  if (type === "connection" || type === "retry") {
    // 网络层噪音(reconnecting/retry.starting/reconnected 等任意 subtype),忽略不作废。
    return { kind: "ignore", raw: line };
  }
  if (isRateLimitNotice(type)) return { kind: "ignore", raw: line };
  return { kind: "unknown", raw: line }; // 真未知事件:调用方按 fail-closed 作废(§12-9)
}

/** claude stream-json parser:assistant.content 块级 text/thinking/fallback/tool_use */
export function parseClaudeLine(line: string, requireStructuredOutput = false): ParsedEvent {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "unknown", raw: line };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "parse_error", raw: line };
  }
  if (!isRecord(parsed)) return { kind: "parse_error", raw: line };
  const obj = parsed;
  const type = obj["type"];
  if (type === "assistant") {
    const msg = obj["message"];
    if (!isRecord(msg)) return { kind: "unknown", raw: line };
    const content = msg["content"];
    const model = msg["model"];
    if ((model !== undefined && typeof model !== "string") || model === "") {
      return { kind: "unknown", raw: line };
    }
    if (!Array.isArray(content)) return { kind: "unknown", raw: line };

    // 块级:text 拼正文;thinking skip(fable 思考型防御);fallback.to.model 作 observedModel;
    // 未知块整事件 fail-closed。message.model 也是观测源,与 fallback 不强制一致,后者优先。
    const texts: string[] = [];
    let toolUse: Record<string, unknown> | undefined;
    let fallbackModel: string | undefined;
    for (const block of content) {
      if (!isRecord(block)) return { kind: "unknown", raw: line };
      const blockType = block["type"];
      if (blockType === "text") {
        if (typeof block["text"] !== "string") return { kind: "unknown", raw: line };
        texts.push(block["text"]);
        continue;
      }
      if (blockType === "thinking") continue;
      if (blockType === "fallback") {
        const to = block["to"];
        if (!isRecord(to) || typeof to["model"] !== "string" || to["model"] === "") {
          return { kind: "unknown", raw: line };
        }
        fallbackModel = to["model"];
        continue;
      }
      if (blockType === "tool_use") {
        if (block["name"] !== undefined && typeof block["name"] !== "string") {
          return { kind: "unknown", raw: line };
        }
        toolUse = block;
        continue;
      }
      return { kind: "unknown", raw: line };
    }

    const text = texts.join("");
    const observedModel = fallbackModel ?? (typeof model === "string" && model ? model : undefined);
    if (toolUse) {
      return {
        kind: "tool_call",
        toolName: typeof toolUse["name"] === "string" ? toolUse["name"] : "unknown_tool",
        ...(observedModel ? { observedModel } : {}),
        ...(text ? { text } : {}),
        raw: line
      };
    }
    if (observedModel) {
      return { kind: "observed_model", observedModel, ...(text ? { text } : {}), raw: line };
    }
    if (text) return { kind: "text", text, raw: line };
    return { kind: "ignore", raw: line };
  }
  if (type === "result" || isClaudeBareResult(obj)) {
    return parseClaudeResultEvent(obj, line, requireStructuredOutput);
  }
  if (type === "system") {
    // system 是通知家族:正文只在 assistant/result。
    // 家族级裁决(2026-08-13 owner,v3.8f 击杀日志):type==="system" 一律 ignore。
    // 逐 subtype 白名单不可持续;fail-closed 只管未知顶层 type。
    // 实证 subtype:init(保持 ignore;claude observedModel 在 assistant/fallback,不在 system.init)、
    // model_refusal_fallback(trigger=refusal,direction=retry)。
    return { kind: "ignore", raw: line };
  }
  if (isRateLimitNotice(type)) return { kind: "ignore", raw: line };
  return { kind: "unknown", raw: line };
}

/** codex exec --json parser(core 移植:item/turn 事件 + assistant 文本) */
export function parseCodexLine(line: string): ParsedEvent {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "unknown", raw: line };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "parse_error", raw: line };
  }
  if (!isRecord(parsed)) return { kind: "parse_error", raw: line };
  const obj = parsed;
  const type = typeof obj["type"] === "string" ? obj["type"] : undefined;
  const item = isRecord(obj["item"]) ? obj["item"] : undefined;
  const model = obj["model"];
  if ((model !== undefined && typeof model !== "string") || model === "") {
    return { kind: "parse_error", raw: line };
  }
  const known = (event: ParsedEvent): ParsedEvent =>
    typeof model === "string" ? { ...event, observedModel: model } : event;
  // 工具/命令执行 item(read-only 笼下不应出现写工具;tripwire 关注 command_execution/file_change)
  // 实测(2026-07-24)+官方 exec --json 词表(2026-08):thread/turn 生命周期 + item.*;
  // item.type = agent_message(文本)/reasoning/command_execution/file_change/mcp_tool_call/web_search/todo_list;
  // 流内通常无 model 字段(族恒 GPT)。turn.failed / 非 reconnect 的 error 保持 unknown(fail-closed)。
  // rate_limit_event 见 isRateLimitNotice(真失败走 turn.failed,识别走 stopNetworkRetry)。
  const itemType = typeof item?.["type"] === "string" ? item["type"] : undefined;
  if (
    itemType === "command_execution" ||
    itemType === "file_change" ||
    itemType === "mcp_tool_call" ||
    itemType === "web_search" ||
    itemType === "web_search_call"
  ) {
    return known({ kind: "tool_call", toolName: itemType, raw: line });
  }
  if (type === "item.completed" && item && itemType === "agent_message") {
    return typeof item["text"] === "string"
      ? known({ kind: "text", text: item["text"], raw: line })
      : { kind: "parse_error", raw: line };
  }
  if (type === "turn.completed" || type === "thread.completed") {
    return known({ kind: "result", raw: line });
  }
  if (type === "thread.started" || type === "turn.started") return known({ kind: "ignore", raw: line });
  if (isRateLimitNotice(type)) return known({ kind: "ignore", raw: line });
  if (itemType === "todo_list" || itemType === "plan_update") {
    // 官方「plan updates」+ cheatsheet todo_list;不消费正文,也不当工具。
    return known({ kind: "ignore", raw: line });
  }
  if (
    (type === "item.started" || type === "item.updated" || type === "item.completed") &&
    (itemType === "agent_message" || itemType === "reasoning")
  ) {
    return known({ kind: "ignore", raw: line });
  }
  if (type === "error") {
    const message = obj["message"];
    // 文档:type=error 且 "Reconnecting... N/M" 是流重连进度,非终态失败。
    if (typeof message === "string" && /reconnecting/i.test(message)) {
      return known({ kind: "ignore", raw: line });
    }
  }
  // 只白名单已经实测或官方文档写清语义的元事件。不确定的保持 unknown,靠触发行日志+一次重试兜住。
  return { kind: "unknown", raw: line };
}

/**
 * grok streaming-json parser(2026-08-12 本机实测):
 *  - text.data = 正文分片(可拼接)
 *  - thought / available_commands / usage = 已知元事件(ignore)
 *  - tool_call / tool_call_update = tripwire
 *  - end.modelUsage 键 = observedModel;structuredOutput 优先作 result 正文
 *  - max_turns_reached 单独出现时 ignore(常紧跟 end);未知 type fail-closed
 */
export function parseGrokLine(line: string): ParsedEvent {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "unknown", raw: line };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "parse_error", raw: line };
  }
  if (!isRecord(parsed)) return { kind: "parse_error", raw: line };
  const obj = parsed;
  const type = obj["type"];
  if (type === "text") {
    const data = obj["data"];
    if (typeof data !== "string") return { kind: "parse_error", raw: line };
    return { kind: "text", text: data, raw: line };
  }
  if (type === "thought" || type === "available_commands" || type === "usage") {
    return { kind: "ignore", raw: line };
  }
  if (type === "tool_call" || type === "tool_call_update") {
    const name =
      typeof obj["toolName"] === "string"
        ? obj["toolName"]
        : typeof obj["title"] === "string"
          ? obj["title"]
          : "unknown_tool";
    return { kind: "tool_call", toolName: name, raw: line };
  }
  if (type === "max_turns_reached") return { kind: "ignore", raw: line };
  if (type === "end") {
    const modelUsage = obj["modelUsage"];
    let observedModel: string | undefined;
    if (isRecord(modelUsage)) {
      const keys = Object.keys(modelUsage).filter((k) => k.trim() !== "");
      if (keys.length > 0) observedModel = keys[0];
    }
    const structured = obj["structuredOutput"];
    const stop = obj["stopReason"];
    // cancelled/error 且无 structured 正文时作废,避免把失败当成功终态
    if (
      (stop === "cancelled" || stop === "error" || stop === "max_turns") &&
      structured === undefined
    ) {
      return {
        kind: "unknown",
        ...(observedModel ? { observedModel } : {}),
        raw: line
      };
    }
    if (structured !== undefined) {
      return {
        kind: "result",
        text: JSON.stringify(structured),
        ...(observedModel ? { observedModel } : {}),
        raw: line
      };
    }
    // 不设 text:""——consume 用 resultText ?? 拼接正文;空串会盖掉已拼好的 text 分片
    return {
      kind: "result",
      ...(observedModel ? { observedModel } : {}),
      raw: line
    };
  }
  if (isRateLimitNotice(type)) return { kind: "ignore", raw: line };
  return { kind: "unknown", raw: line };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

function modelFromRecord(obj: Record<string, unknown>): string | undefined {
  const stats = isRecord(obj["stats"]) ? obj["stats"] : undefined;
  const response = isRecord(obj["response"]) ? obj["response"] : undefined;
  const message = isRecord(obj["message"]) ? obj["message"] : undefined;
  const usage = isRecord(obj["usage"]) ? obj["usage"] : undefined;
  return firstString(
    obj["model"],
    obj["model_name"],
    stats?.["model"],
    response?.["model"],
    message?.["model"],
    usage?.["model"]
  );
}

function textFromGeminiLike(obj: Record<string, unknown>): string | undefined {
  if (typeof obj["content"] === "string") return obj["content"];
  if (typeof obj["text"] === "string") return obj["text"];
  if (typeof obj["delta"] === "string") return obj["delta"];
  if (typeof obj["result"] === "string") return obj["result"];
  const message = isRecord(obj["message"]) ? obj["message"] : undefined;
  if (message) {
    if (typeof message["content"] === "string") return message["content"];
    if (typeof message["text"] === "string") return message["text"];
    const content = message["content"];
    if (Array.isArray(content)) {
      const parts = content
        .filter((block) => isRecord(block) && (block["type"] === "text" || typeof block["text"] === "string"))
        .map((block) => (isRecord(block) && typeof block["text"] === "string" ? block["text"] : ""));
      if (parts.length > 0) return parts.join("");
    }
  }
  return undefined;
}

const GEMINI_LIKE_IGNORE = new Set([
  "init",
  "start",
  "system",
  "status",
  "usage",
  "thought",
  "reasoning",
  "debug",
  "progress",
  "keepalive"
]);
const GEMINI_LIKE_TEXT = new Set(["message", "assistant", "content", "text", "output", "delta"]);
const GEMINI_LIKE_TOOL = new Set([
  "tool_use",
  "tool_call",
  "tool_request",
  "function_call",
  "functionCall",
  "mcp_tool_call"
]);
const GEMINI_LIKE_RESULT = new Set(["result", "end", "completed", "done"]);

/**
 * gemini/qwen stream-json(2026-08-13 本机形态 + 官方 event 词表)。
 * 未知 type fail-closed;非 JSON 行 parse_error,由调用方决定是否整段收敛。
 */
export function parseGeminiLikeLine(line: string): ParsedEvent {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "unknown", raw: line };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "parse_error", raw: line };
  }
  if (!isRecord(parsed)) return { kind: "parse_error", raw: line };
  const obj = parsed;
  const type = firstString(obj["type"], obj["event"], obj["kind"]);
  const observedModel = modelFromRecord(obj);
  const withModel = (event: ParsedEvent): ParsedEvent =>
    observedModel ? { ...event, observedModel } : event;
  if (!type) {
    const text = textFromGeminiLike(obj);
    if (text !== undefined) return withModel({ kind: "text", text, raw: line });
    return { kind: "unknown", raw: line };
  }
  if (GEMINI_LIKE_TOOL.has(type)) {
    const toolName =
      firstString(obj["tool_name"], obj["toolName"], obj["name"], obj["tool"]) ?? "unknown_tool";
    return withModel({ kind: "tool_call", toolName, raw: line });
  }
  if (GEMINI_LIKE_TEXT.has(type)) {
    const text = textFromGeminiLike(obj) ?? "";
    return withModel({ kind: "text", text, raw: line });
  }
  if (GEMINI_LIKE_RESULT.has(type)) {
    if (
      obj["status"] === "error" ||
      obj["is_error"] === true ||
      obj["ok"] === false ||
      (typeof obj["subtype"] === "string" && obj["subtype"].includes("error"))
    ) {
      return withModel({ kind: "unknown", raw: line });
    }
    const text = textFromGeminiLike(obj);
    return withModel({ kind: "result", ...(text !== undefined ? { text } : {}), raw: line });
  }
  if (GEMINI_LIKE_IGNORE.has(type) || type === "user" || isRateLimitNotice(type)) {
    return withModel({ kind: "ignore", raw: line });
  }
  return { kind: "unknown", raw: line };
}

/**
 * copilot --output-format json(JSONL)。
 * 未知 type fail-closed;纯文本行 parse_error。
 */
export function parseCopilotLine(line: string): ParsedEvent {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "unknown", raw: line };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "parse_error", raw: line };
  }
  if (!isRecord(parsed)) return { kind: "parse_error", raw: line };
  const obj = parsed;
  const type = firstString(obj["type"], obj["event"], obj["kind"]);
  const observedModel = modelFromRecord(obj);
  const withModel = (event: ParsedEvent): ParsedEvent =>
    observedModel ? { ...event, observedModel } : event;
  if (type === "tool" || type === "tool_call" || type === "tool_use" || obj["tool"] !== undefined) {
    const toolName = firstString(obj["toolName"], obj["tool_name"], obj["name"], obj["tool"]) ?? "unknown_tool";
    return withModel({ kind: "tool_call", toolName, raw: line });
  }
  if (type === "assistant" || type === "message" || type === "text" || type === "content") {
    const text = textFromGeminiLike(obj) ?? "";
    return withModel({ kind: "text", text, raw: line });
  }
  if (type === "result" || type === "end" || type === "completed") {
    if (obj["subtype"] === "error" || obj["is_error"] === true || obj["ok"] === false) {
      return withModel({ kind: "unknown", raw: line });
    }
    const text = textFromGeminiLike(obj);
    return withModel({ kind: "result", ...(text !== undefined ? { text } : {}), raw: line });
  }
  if (
    type === "system" ||
    type === "init" ||
    type === "start" ||
    type === "usage" ||
    type === "status" ||
    isRateLimitNotice(type)
  ) {
    return withModel({ kind: "ignore", raw: line });
  }
  if (!type) {
    const text = textFromGeminiLike(obj);
    if (text !== undefined) return withModel({ kind: "text", text, raw: line });
  }
  return { kind: "unknown", raw: line };
}

/** 结构化优先失败后:整段非 JSON 收敛为单次 text+result(09 新家纪律)。 */
export function parsePlaintextBlock(text: string): ParsedEvent[] {
  const trimmed = text.trim();
  if (!trimmed) return [{ kind: "unknown", raw: text }];
  return [
    { kind: "text", text: trimmed, raw: text },
    { kind: "result", text: trimmed, raw: text }
  ];
}

export function parserFor(
  provider: "codex_cli" | "claude_cli" | "cursor_cli" | "grok_cli" | "gemini_cli" | "qwen_cli" | "copilot_cli",
  options: { requireClaudeStructuredOutput?: boolean } = {}
): (line: string) => ParsedEvent {
  if (provider === "cursor_cli") return parseCursorLine;
  if (provider === "claude_cli") return (line) => parseClaudeLine(line, options.requireClaudeStructuredOutput === true);
  if (provider === "grok_cli") return parseGrokLine;
  if (provider === "gemini_cli" || provider === "qwen_cli") return parseGeminiLikeLine;
  if (provider === "copilot_cli") return parseCopilotLine;
  return parseCodexLine;
}

export interface StructuredOutputCheck {
  ok: boolean;
  value?: unknown;
  errors: string[];
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function schemaErrors(value: unknown, schema: unknown, path: string): string[] {
  if (schema === true) return [];
  if (schema === false || typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    return [`${path}:invalid_schema`];
  }
  const s = schema as Record<string, unknown>;
  const supported = new Set([
    "type",
    "enum",
    "const",
    "allOf",
    "anyOf",
    "oneOf",
    "required",
    "properties",
    "additionalProperties",
    "items",
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "pattern",
    "minimum",
    "maximum",
    "$schema",
    "$id",
    "title",
    "description",
    "default",
    "examples"
  ]);
  for (const keyword of Object.keys(s)) {
    if (!supported.has(keyword)) return [`${path}:unsupported_keyword_${keyword}`];
  }
  if (
    s["additionalProperties"] !== undefined &&
    typeof s["additionalProperties"] !== "boolean"
  ) {
    return [`${path}:unsupported_additionalProperties_schema`];
  }

  const errors: string[] = [];
  const allowedTypes = typeof s["type"] === "string" ? [s["type"]] : Array.isArray(s["type"]) ? s["type"] : [];
  if (allowedTypes.length > 0) {
    const actual = valueType(value);
    const matches = allowedTypes.some((type) =>
      type === "number" ? typeof value === "number" && Number.isFinite(value) : type === actual
    );
    if (!matches) return [`${path}:expected_${allowedTypes.join("|")}_got_${actual}`];
  }

  if (Array.isArray(s["enum"]) && !s["enum"].some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) {
    errors.push(`${path}:enum`);
  }
  if (Object.hasOwn(s, "const") && JSON.stringify(s["const"]) !== JSON.stringify(value)) errors.push(`${path}:const`);

  if (Array.isArray(s["allOf"])) {
    for (const child of s["allOf"]) errors.push(...schemaErrors(value, child, path));
  }
  if (Array.isArray(s["anyOf"]) && !s["anyOf"].some((child) => schemaErrors(value, child, path).length === 0)) {
    errors.push(`${path}:anyOf`);
  }
  if (Array.isArray(s["oneOf"])) {
    const matches = s["oneOf"].filter((child) => schemaErrors(value, child, path).length === 0).length;
    if (matches !== 1) errors.push(`${path}:oneOf`);
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const required = Array.isArray(s["required"]) ? s["required"].filter((key): key is string => typeof key === "string") : [];
    for (const key of required) if (!Object.hasOwn(obj, key)) errors.push(`${path}.${key}:required`);
    const properties =
      typeof s["properties"] === "object" && s["properties"] !== null && !Array.isArray(s["properties"])
        ? (s["properties"] as Record<string, unknown>)
        : {};
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(obj, key)) errors.push(...schemaErrors(obj[key], child, `${path}.${key}`));
    }
    if (s["additionalProperties"] === false) {
      for (const key of Object.keys(obj)) if (!Object.hasOwn(properties, key)) errors.push(`${path}.${key}:additional_property`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof s["minItems"] === "number" && value.length < s["minItems"]) errors.push(`${path}:minItems`);
    if (typeof s["maxItems"] === "number" && value.length > s["maxItems"]) errors.push(`${path}:maxItems`);
    if (s["items"] !== undefined) {
      value.forEach((item, index) => errors.push(...schemaErrors(item, s["items"], `${path}[${index}]`)));
    }
  }

  if (typeof value === "string") {
    if (typeof s["minLength"] === "number" && value.length < s["minLength"]) errors.push(`${path}:minLength`);
    if (typeof s["maxLength"] === "number" && value.length > s["maxLength"]) errors.push(`${path}:maxLength`);
    if (typeof s["pattern"] === "string") {
      try {
        if (!new RegExp(s["pattern"]).test(value)) errors.push(`${path}:pattern`);
      } catch {
        errors.push(`${path}:invalid_pattern`);
      }
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (typeof s["minimum"] === "number" && value < s["minimum"]) errors.push(`${path}:minimum`);
    if (typeof s["maximum"] === "number" && value > s["maximum"]) errors.push(`${path}:maximum`);
  }
  return errors;
}

/** 严格 JSON:整段必须是单一 JSON 值,并满足当前请求 schema。 */
export function parseStructuredOutput(text: string, schema: Record<string, unknown>): StructuredOutputCheck {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["$:invalid_json"] };
  }
  const errors = schemaErrors(value, schema, "$");
  return errors.length === 0 ? { ok: true, value, errors } : { ok: false, errors };
}
