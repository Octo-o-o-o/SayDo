// 订阅限流 fail-fast + 一次性 billing-switch 收据(09 §11 规则 5;07 D18 纪律 3,复评 A5)。
// 触发限流 => 槽位 waiting_confirmation => Brain 询问(10 #40/#41)=> 确认落一次性收据(绑
// sessionId+槽位+目标端点+有效期,单次消费)=> 无收据不得产生 source='api' 计费行。
// P0 不做自动排队重放;daemon 重启则重新询问(内存态,不 durable)。

import { ulid } from "ulid";
import type { CageProvider } from "./cage.js";
import { isClaudeBareResult } from "./parsers.js";

export interface BillingSwitchReceipt {
  id: string;
  sessionId: string;
  slot: string;
  targetEndpoint: string; // 切换到的 api 命名端点
  issuedAt: number;
  expiresAt: number;
  consumed: boolean;
}

export class BillingSwitchStore {
  private readonly receipts = new Map<string, BillingSwitchReceipt>();

  /** 用户确认切计费:签发一次性收据(绑四要素) */
  issue(i: { sessionId: string; slot: string; targetEndpoint: string; ttlMs?: number }, now = Date.now()): BillingSwitchReceipt {
    const r: BillingSwitchReceipt = {
      id: `bsw_${ulid()}`,
      sessionId: i.sessionId,
      slot: i.slot,
      targetEndpoint: i.targetEndpoint,
      issuedAt: now,
      expiresAt: now + (i.ttlMs ?? 10 * 60 * 1000),
      consumed: false
    };
    this.receipts.set(r.id, r);
    return r;
  }

  /**
   * 消费收据以放行一次 api 计费调用。原子单次:并发/重复消费只成功一次(复评 A5 竞态不双扣)。
   * 返回 true 表示本次调用获批产生 source='api' 计费行;false 表示无有效收据(禁止计费)。
   */
  consume(receiptId: string, i: { sessionId: string; slot: string }, now = Date.now()): boolean {
    const r = this.receipts.get(receiptId);
    if (!r) return false;
    if (r.consumed) return false; // 已消费:第二次拒(单次)
    if (now > r.expiresAt) return false; // 过期拒
    if (r.sessionId !== i.sessionId || r.slot !== i.slot) return false; // 绑定不符拒
    r.consumed = true; // 原子置位(单线程 JS 事件循环内无竞态窗口)
    return true;
  }

  /** 是否有该 (session, slot) 的可用收据(未消费未过期) */
  hasUsable(sessionId: string, slot: string, now = Date.now()): boolean {
    for (const r of this.receipts.values()) {
      if (r.sessionId === sessionId && r.slot === slot && !r.consumed && now <= r.expiresAt) return true;
    }
    return false;
  }
}

/** 识别 provider 返回是否为订阅限流(fail-fast,不静默转计费) */
export function isSubscriptionRateLimited(code: string): boolean {
  return code === "subscription_rate_limited" || code === "rate_limited";
}

const SUBSCRIPTION_LIMIT_PATTERNS: Record<CageProvider, readonly RegExp[]> = {
  codex_cli: [
    /^(?:error:\s*)?usage[_ -]?limit(?:[_ -]?(?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?rate[_ -]?limit(?:[_ -]?(?:error|exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:weekly|monthly|subscription) limit(?: (?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:account|subscription|usage|request|token) quota (?:exceeded|reached|reset)/im,
    /\b(?:codex|chatgpt|openai)\b[^\n]{0,80}\b(?:usage|rate|request|subscription) limit\b/i,
    /\byou(?:'ve| have) (?:hit|reached|exceeded) (?:your )?(?:usage|rate|request|weekly|monthly) limit\b/i
  ],
  claude_cli: [
    /^rate_limit_error$/im,
    /^(?:error:\s*)?usage[_ -]?limit(?:[_ -]?(?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?rate[_ -]?limit(?:[_ -]?(?:error|exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:weekly|monthly|subscription) limit(?: (?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:account|subscription|usage|request|token) quota (?:exceeded|reached|reset)/im,
    /\b(?:claude|anthropic)\b[^\n]{0,80}\b(?:usage|rate|request|subscription) limit\b/i
  ],
  cursor_cli: [
    /^(?:error:\s*)?usage[_ -]?limit(?:[_ -]?(?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:request )?rate[_ -]?limit(?:[_ -]?(?:error|exceeded|reached|reset))?/im,
    /^(?:error:\s*)?request limit (?:exceeded|reached|reset)/im,
    /^(?:error:\s*)?(?:weekly|monthly|subscription) limit(?: (?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:account|subscription|usage|request|token) quota (?:exceeded|reached|reset)/im,
    /\bcursor\b[^\n]{0,80}\b(?:usage|rate|request|subscription) limit\b/i,
    /\byou(?:'ve| have) (?:hit|reached|exceeded) (?:your )?(?:usage|rate|request|weekly|monthly) limit\b/i,
    /ActionRequiredError[^\n]{0,120}usage limit/i
  ],
  grok_cli: [
    /^(?:error:\s*)?usage[_ -]?limit(?:[_ -]?(?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?rate[_ -]?limit(?:[_ -]?(?:error|exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:weekly|monthly|subscription) limit(?: (?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:account|subscription|usage|request|token) quota (?:exceeded|reached|reset)/im,
    /\b(?:grok|xai|x\.ai)\b[^\n]{0,80}\b(?:usage|rate|request|subscription) limit\b/i,
    /\byou(?:'ve| have) (?:hit|reached|exceeded) (?:your )?(?:usage|rate|request|weekly|monthly) limit\b/i
  ],
  gemini_cli: [
    /^(?:error:\s*)?usage[_ -]?limit(?:[_ -]?(?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?rate[_ -]?limit(?:[_ -]?(?:error|exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:weekly|monthly|subscription) limit(?: (?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:account|subscription|usage|request|token) quota (?:exceeded|reached|reset)/im,
    /\b(?:gemini|google)\b[^\n]{0,80}\b(?:usage|rate|request|subscription|quota) limit\b/i
  ],
  qwen_cli: [
    /^(?:error:\s*)?usage[_ -]?limit(?:[_ -]?(?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?rate[_ -]?limit(?:[_ -]?(?:error|exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:weekly|monthly|subscription) limit(?: (?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:account|subscription|usage|request|token) quota (?:exceeded|reached|reset)/im,
    /\b(?:qwen|dashscope)\b[^\n]{0,80}\b(?:usage|rate|request|subscription|quota) limit\b/i
  ],
  copilot_cli: [
    /^(?:error:\s*)?usage[_ -]?limit(?:[_ -]?(?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?rate[_ -]?limit(?:[_ -]?(?:error|exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:weekly|monthly|subscription) limit(?: (?:exceeded|reached|reset))?/im,
    /^(?:error:\s*)?(?:account|subscription|usage|request|token) quota (?:exceeded|reached|reset)/im,
    /\b(?:copilot|github)\b[^\n]{0,80}\b(?:usage|rate|request|subscription|quota) limit\b/i
  ]
};

const NON_SUBSCRIPTION_LIMIT_CONTEXT =
  /(?:^|[^a-z])(?:auth|authenticate|authenticated|authenticating|authentication|authorization|oauth|unauthorized|login|proxy|disk|filesystem|storage)(?=$|[^a-z])/i;

function matchesSubscriptionLimit(patterns: readonly RegExp[], evidence: string): boolean {
  if (NON_SUBSCRIPTION_LIMIT_CONTEXT.test(evidence)) return false;
  return patterns.some((pattern) => pattern.test(evidence));
}

function collectStringLeaves(value: unknown): string[] {
  const out: string[] = [];
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === "string") {
      out.push(current);
      continue;
    }
    const children = Array.isArray(current)
      ? current
      : current && typeof current === "object"
        ? Object.values(current)
        : [];
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]);
  }
  return out;
}

/** 只按各供应商已知额度措辞分类；普通认证/进程错误不误判为订阅限流。 */
export function isCliSubscriptionRateLimit(
  provider: CageProvider,
  result: { stderrTail: string; lines: readonly string[]; exitCode?: number | null }
): boolean {
  const patterns = SUBSCRIPTION_LIMIT_PATTERNS[provider];
  if (
    typeof result.exitCode === "number" &&
    result.exitCode !== 0 &&
    matchesSubscriptionLimit(patterns, result.stderrTail)
  ) {
    return true;
  }
  for (const line of result.lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const event = value as Record<string, unknown>;
    const type = event["type"];
    const isFailure =
      (provider === "codex_cli" && (type === "turn.failed" || type === "thread.failed")) ||
      (provider === "claude_cli" &&
        (type === "result" || isClaudeBareResult(event)) &&
        (event["is_error"] === true || event["subtype"] === "error")) ||
      (provider === "cursor_cli" && type === "result" && event["subtype"] === "error") ||
      (provider === "grok_cli" &&
        type === "end" &&
        (event["stopReason"] === "error" || event["stopReason"] === "cancelled")) ||
      ((provider === "gemini_cli" || provider === "qwen_cli") &&
        (type === "result" || type === "end") &&
        (event["status"] === "error" || event["is_error"] === true || event["ok"] === false)) ||
      (provider === "copilot_cli" &&
        (type === "result" || type === "end") &&
        (event["subtype"] === "error" || event["is_error"] === true || event["ok"] === false));
    if (!isFailure) continue;
    const evidence = collectStringLeaves(event).join("\n");
    if (matchesSubscriptionLimit(patterns, evidence)) return true;
  }
  return false;
}
