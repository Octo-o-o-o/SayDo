// 口头否定/修订即时落账本(计划 M5/③-5②;A3 工具纪律)。
// 会话中检出"不要 X / 改成 Y / 别用 Z"类口头否定或修订,即时经 remember(trust=user_stated)写记忆事件——
// 防其只存在于转写层、被 M3 预算(近 K 轮 verbatim)挤出后静默消失(规则②否定不复活只管账本层,接不住转写层)。

import type { MemoryLedger } from "./ledger.js";
import type { MemoryEvent } from "@saydo/contracts";

export type NegationKind = "negation" | "revision";

export interface DetectedNegation {
  kind: NegationKind;
  /** 归一化后的账本 claim(承载否定/修订意图) */
  claim: string;
}

// 否定:别/不要/不用/不想 + 内容;修订:改成/换成/改用/不是 X 是 Y
const NEGATION_RE = /(?:别再?|不要|不用|不想|不能用|千万别)\s*([^,。,.!!?？]{1,40})/;
const REVISION_RE = /(?:改成|换成|改用|应该是|不是.{1,20}?[,,]?\s*是)\s*([^,。,.!!?？]{1,40})/;

/**
 * 检出否定/修订(机械正则;疑问句不算——"要不要不用 X" 是问不是命令)。
 * 返回 null = 无否定/修订。修订优先于否定(同句"不是 A 改成 B" 判 revision)。
 */
export function detectNegationRevision(utterance: string): DetectedNegation | null {
  const u = utterance.trim();
  if (/[?？]$|吗\s*$/.test(u)) return null; // 疑问句不落
  const rev = REVISION_RE.exec(u);
  if (rev) return { kind: "revision", claim: `修订:${rev[0].trim()}` };
  const neg = NEGATION_RE.exec(u);
  if (neg) return { kind: "negation", claim: `否定:${neg[0].trim()}` };
  return null;
}

/**
 * 即时落账本(user_stated;A3 检出后调用)。projectId 挂当前项目;source=user_utterance 带 turnRef。
 * 返回落账事件(无检出返回 null,不写)。
 */
export function captureNegation(
  ledger: MemoryLedger,
  input: { utterance: string; turnRef: string; projectId?: string }
): MemoryEvent | null {
  const d = detectNegationRevision(input.utterance);
  if (!d) return null;
  return ledger.add({
    tier: "M1",
    ...(input.projectId ? { projectId: input.projectId } : {}),
    claim: d.claim,
    source: { kind: "user_utterance", ref: input.turnRef },
    requestedTrust: "user_stated" // 用户亲口否定/修订 = user_stated(直入 trusted,不被预算挤)
  });
}
