// 对话句 s-<turnId>-<序号>。index 的 playout 与 barge-in 用同一函数。
// 只接受源码里的对话轮: pipeline/console/appendTurn 的 ses_<ULID>,
// 测量夹具里的 evt_<数字>, dialog.ts 控制轮
// ctl-<kind>-<收据末 8 位或 x>-<base36>。

import type { LatencyTrace } from "./latency.js";

const ULID_BODY = "[0-9A-HJKMNP-TV-Z]{26}";
const CONVERSATION_TURN = [
  `ses_${ULID_BODY}`,
  "evt_[0-9]+",
  "ctl-(?:confirmation_settled|downgrade_applied|expectation_adjusted)-(?:[0-9A-HJKMNP-TV-Z]{8}|x)-[0-9a-z]+"
].join("|");

const SENTENCE_TURN_RE = new RegExp(`^s-(${CONVERSATION_TURN})-\\d+$`);

export const PLAYOUT_SEEN_MAX = 500;

export function turnIdOfSentence(sentenceId: string): string | null {
  const match = SENTENCE_TURN_RE.exec(sentenceId);
  return match?.[1] ?? null;
}

export function notePlayout(
  seen: Set<string>,
  sentenceId: string,
  atMs: number,
  record: (turnId: string, atMs: number) => LatencyTrace | null,
  max = PLAYOUT_SEEN_MAX
): LatencyTrace | null {
  const turnId = turnIdOfSentence(sentenceId);
  if (!turnId || seen.has(turnId)) return null;
  seen.add(turnId);
  if (seen.size > max) seen.clear();
  return record(turnId, atMs);
}
