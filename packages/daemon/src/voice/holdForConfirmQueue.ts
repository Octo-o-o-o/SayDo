// 手动档 holdForConfirm 的 session FIFO 计数(09 §10 / RA-closeout)。
// PTT 下每个 done_speaking 恰好一个 asr.final(可空),旗与 final 一对一消费。
// 免手 _force_finalize 空轮不发 final:空轮不得 record,否则下一条正常语音会被误扣。

export const HOLD_FLAG_TTL_MS = 120_000;

export type HoldConsumeResult = "held" | "expired" | "none";

/** asr.final 进对话环前的闸:hold 优先消费,空文本不进 Brain。 */
export type AsrFinalIngress = "hold" | "empty" | "brain";

export class HoldForConfirmQueue {
  private readonly flags = new Map<string, number[]>();

  record(sessionId: string, now = Date.now()): void {
    const queue = this.flags.get(sessionId) ?? [];
    queue.push(now + HOLD_FLAG_TTL_MS);
    this.flags.set(sessionId, queue);
  }

  consume(sessionId: string, now = Date.now()): HoldConsumeResult {
    const holdQueue = this.flags.get(sessionId);
    if (holdQueue === undefined || holdQueue.length === 0) return "none";
    const expiry = holdQueue.shift() as number;
    if (holdQueue.length === 0) this.flags.delete(sessionId);
    if (now <= expiry) return "held";
    return "expired";
  }

  pendingCount(sessionId: string): number {
    return this.flags.get(sessionId)?.length ?? 0;
  }
}

export function decideAsrFinalIngress(
  queue: HoldForConfirmQueue,
  sessionId: string,
  text: string,
  now = Date.now()
): AsrFinalIngress {
  const hold = queue.consume(sessionId, now);
  if (hold === "held") return "hold";
  if (text.trim() === "") return "empty";
  return "brain";
}
