// S2 打断即作废最小版(计划 4.2;09 §14-A8 最小形态;04 §5.2)。
// 确认播报(tts.say 的 sentenceId)关联收据;收到 barge_in ⇒ presentation 置失效;
// 失效后裸肯定("好")不得消费收据,必须重播才可消费(A8 完整状态机 P0.5-A)。
// unheard 纪律的审批侧:被打断的关键确认必须重述(10 §3)。

export interface Presentation {
  receiptId: string;
  sentenceId: string;
  invalidatedAt?: string;
}

export class PresentationStore {
  private readonly bySession = new Map<string, Presentation>();

  /** 播报 S2 确认:登记 presentation(sentenceId <-> receiptId) */
  present(sessionId: string, receiptId: string, sentenceId: string): void {
    this.bySession.set(sessionId, { receiptId, sentenceId });
  }

  /** barge_in:置该 session 当前 presentation 失效(必须重播才可再消费) */
  invalidateOnBargeIn(sessionId: string, nowIso: string): void {
    const p = this.bySession.get(sessionId);
    if (p && p.invalidatedAt === undefined) p.invalidatedAt = nowIso;
  }

  /**
   * 裸肯定("好")能否消费该收据:
   * - 无 presentation ⇒ 不能(没有正在等确认的播报,防裸"好"消费旧 pending);
   * - presentation 已失效(被打断)⇒ 不能(必须重播);
   * - receiptId 不匹配 ⇒ 不能;
   * - 否则可消费。
   */
  canConsumeByBareYes(sessionId: string, receiptId: string): { ok: boolean; reason?: string } {
    const p = this.bySession.get(sessionId);
    if (!p) return { ok: false, reason: "no active presentation (bare-yes cannot consume stale pending)" };
    if (p.receiptId !== receiptId) return { ok: false, reason: "presentation receipt mismatch" };
    if (p.invalidatedAt !== undefined) return { ok: false, reason: "presentation invalidated by barge-in (must replay)" };
    return { ok: true };
  }

  /** 重播:清失效标记(A8 最小版:重新 present 覆盖) */
  replay(sessionId: string, receiptId: string, sentenceId: string): void {
    this.bySession.set(sessionId, { receiptId, sentenceId });
  }

  /** 重播准备态:TTS enqueue 成功前保持失效，后续裸肯定不得消费。 */
  prepareReplay(sessionId: string, receiptId: string, sentenceId: string): void {
    this.bySession.set(sessionId, {
      receiptId,
      sentenceId,
      invalidatedAt: "replay_pending"
    });
  }

  withdraw(sessionId: string, receiptId: string): void {
    const current = this.bySession.get(sessionId);
    if (current?.receiptId === receiptId) this.bySession.delete(sessionId);
  }

  current(sessionId: string): Presentation | undefined {
    return this.bySession.get(sessionId);
  }
}
