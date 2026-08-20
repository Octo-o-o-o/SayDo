// Money 接线(计划 3.3;09 §11 [pricing] + §0 Money):cost estimate 用 known/asOf 结构。
// 纪律(Codex 复审 B6):无价目表项或无用量估计 ⇒ 该项 unknown——绝不编数、绝不显示 0;
// max 必 known(熔断依据,缺省 budget.task_max_default)。

import type { Money } from "@saydo/contracts";

export interface Pricing {
  currency?: "CNY";
  as_of?: string;
  llm?: Record<string, number>; // 元 / 1k token(键按模型名最长前缀匹配)
  asr?: Record<string, number>; // 元 / 分钟
  tts?: Record<string, number>; // 元 / 千字符
}

export interface UsageEstimate {
  llmModel?: string;
  llmKTokens?: number;
  asrProvider?: string;
  asrMinutes?: number;
  ttsVoice?: string;
  ttsKChars?: number;
}

/** 最长前缀匹配查价(09 §11:键按模型名前缀;查不到 = undefined ⇒ unknown) */
export function lookupRate(table: Record<string, number> | undefined, name: string | undefined): number | undefined {
  if (!table || !name) return undefined;
  let best: { key: string; rate: number } | undefined;
  for (const [key, rate] of Object.entries(table)) {
    if (name.startsWith(key) && (best === undefined || key.length > best.key.length)) {
      best = { key, rate };
    }
  }
  return best?.rate;
}

const UNKNOWN: Money = { known: false };

/**
 * 成本估算:三个计费维逐项查价——任一维"有用量但无价目" ⇒ 整体 expected unknown(不局部编数);
 * 全部可计价 ⇒ known(value/currency/asOf)。p95 = expected * 1.5(P0 内规粗估,估算法变更须升版注释)。
 */
export function estimateCost(
  usage: UsageEstimate,
  pricing: Pricing | undefined,
  maxBudget: number
): { expected: Money; p95: Money; max: number; currency: "CNY" } {
  if (maxBudget <= 0) throw new Error("cost.max must be positive (熔断依据必 known)");
  const parts: number[] = [];
  let anyUnknown = false;

  const dims: { qty: number | undefined; rate: number | undefined }[] = [
    { qty: usage.llmKTokens, rate: lookupRate(pricing?.llm, usage.llmModel) },
    { qty: usage.asrMinutes, rate: lookupRate(pricing?.asr, usage.asrProvider) },
    { qty: usage.ttsKChars, rate: lookupRate(pricing?.tts, usage.ttsVoice) }
  ];
  for (const d of dims) {
    if (d.qty === undefined || d.qty === 0) continue; // 无该维用量:不参与
    if (d.rate === undefined) {
      anyUnknown = true; // 有用量但无价目:unknown(不编数)
      continue;
    }
    parts.push(d.qty * d.rate);
  }

  if (anyUnknown || parts.length === 0) {
    return { expected: UNKNOWN, p95: UNKNOWN, max: maxBudget, currency: "CNY" };
  }
  const sum = round2(parts.reduce((a, b) => a + b, 0));
  // as_of 非法日期不炸(评审 C):可解析才带 asOf,否则省略(Money.asOf optional)
  const asOfMs = pricing?.as_of ? Date.parse(pricing.as_of) : NaN;
  const known = (value: number): Money => ({
    known: true,
    value,
    currency: "CNY",
    ...(Number.isFinite(asOfMs) ? { asOf: new Date(asOfMs).toISOString() } : {})
  });
  return { expected: known(sum), p95: known(round2(sum * 1.5)), max: maxBudget, currency: "CNY" };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
