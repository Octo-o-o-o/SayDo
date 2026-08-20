// A2/A8 完整形态(P0.5-A;09 §14):E2 签名 presentation 状态机 + per-subject CAS。
// - digest = jcsDigest({payload, nonce, receiptId});重播必须换 nonce ⇒ 新 digest(旧 digest 不可复用);
// - per-subject CAS:同一 subject 同时至多一个活跃 presentation,替换须给出当前活跃 id(防并发覆盖);
// - heard:playout watermark 覆盖句尾才置 true;未 heard 不可消费(unheard 纪律的审批面);
// - barge-in ⇒ invalidatedAt;失效后裸肯定不消费,必须重播(新 nonce);
// - 播报/失效/重播全程不改 receipt/package/tool 状态(golden 断言:本 store 纯内存,消费才触发收据侧转换)。

import { randomBytes } from "node:crypto";
import { jcsDigest, presentationPayloadSchema, signedPresentationSchema, type PresentationPayload, type SignedPresentation } from "@saydo/contracts";

export type PresentResult = { ok: true; presentation: SignedPresentation } | { ok: false; reason: string };
export type ConsumeResult = { ok: true } | { ok: false; reason: string };

export class SignedPresentationStore {
  private readonly bySubject = new Map<string, SignedPresentation>();
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  /**
   * 签发播报(per-subject CAS):subject 已有活跃 presentation 时,必须携 expectedActiveId 才可替换;
   * 不携或不匹配 ⇒ 拒(防并发覆盖导致"所闻非所签")。
   */
  present(input: {
    subject: string;
    receiptId: string;
    parentReceiptId?: string;
    payload: PresentationPayload;
    sentenceId: string;
    expectedActiveId?: string;
  }): PresentResult {
    presentationPayloadSchema.parse(input.payload);
    const active = this.activeOf(input.subject);
    if (active && active.id !== input.expectedActiveId) {
      return { ok: false, reason: `subject 已有活跃 presentation(${active.id}),CAS 不匹配` };
    }
    const nonce = randomBytes(12).toString("base64url");
    const digest = jcsDigest({ payload: input.payload, nonce, receiptId: input.receiptId });
    const p: SignedPresentation = signedPresentationSchema.parse({
      id: `psn-${nonce}`,
      nonce,
      receiptId: input.receiptId,
      ...(input.parentReceiptId ? { parentReceiptId: input.parentReceiptId } : {}),
      subject: input.subject,
      payload: input.payload,
      digest,
      sentenceId: input.sentenceId,
      heard: false,
      createdAt: this.now().toISOString()
    });
    this.bySubject.set(input.subject, p);
    return { ok: true, presentation: p };
  }

  /** playout watermark 覆盖句尾 ⇒ heard(tts.playout 消费;未 heard 的授权播报不作数) */
  markHeard(subject: string, sentenceId: string): void {
    const p = this.bySubject.get(subject);
    if (p && p.sentenceId === sentenceId && p.invalidatedAt === undefined) {
      this.bySubject.set(subject, { ...p, heard: true });
    }
  }

  /** barge-in:立即作废当前 presentation + nonce(随后裸肯定不消费,必须重播换 nonce) */
  invalidateOnBargeIn(subject: string): void {
    const p = this.bySubject.get(subject);
    if (p && p.invalidatedAt === undefined) {
      this.bySubject.set(subject, { ...p, invalidatedAt: this.now().toISOString() });
    }
  }

  /**
   * 消费(用户肯定后调用方再触发收据侧转换;此处只判 presentation 合法性):
   * - 必须存在活跃 presentation 且 digest/receiptId 匹配;
   * - 必须 heard(unheard 不作"已告知");
   * - 被打断(invalidated)⇒ 拒;已消费 ⇒ 拒(nonce 单次);过期 ⇒ 拒。
   */
  consume(subject: string, input: { digest: string; receiptId: string }): ConsumeResult {
    const p = this.bySubject.get(subject);
    if (!p) return { ok: false, reason: "无活跃 presentation(裸肯定不消费旧 pending)" };
    if (p.consumedAt !== undefined) return { ok: false, reason: "presentation 已消费(nonce 单次)" };
    if (p.invalidatedAt !== undefined) return { ok: false, reason: "presentation 已被打断作废,必须重播" };
    if (!p.heard) return { ok: false, reason: "presentation 未播完(unheard 不作已告知)" };
    if (p.digest !== input.digest || p.receiptId !== input.receiptId) {
      return { ok: false, reason: "digest/receipt 不匹配(所闻非所签)" };
    }
    if (p.payload.expiry <= this.now().toISOString()) return { ok: false, reason: "presentation 已过期" };
    this.bySubject.set(subject, { ...p, consumedAt: this.now().toISOString() });
    return { ok: true };
  }

  activeOf(subject: string): SignedPresentation | undefined {
    const p = this.bySubject.get(subject);
    if (!p) return undefined;
    if (p.consumedAt !== undefined) return undefined;
    return p; // invalidated 仍占位(需 CAS 显式替换重播,防静默双播)
  }
}
