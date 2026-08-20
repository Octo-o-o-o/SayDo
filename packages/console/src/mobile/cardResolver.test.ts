import { describe, expect, it } from "vitest";
import { attentionKind, resolveCard } from "./cardResolver";
import type { AttentionItem, MobileCardRef } from "./types";

const future = "2099-01-01T00:10:00.000Z";
const past = "2020-01-01T00:10:00.000Z";

function item(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: "conf:apr_mobile",
    color: "orange",
    title: "是否继续",
    focusId: "foc_mobile",
    focusTitle: "移动端",
    action: "open_confirm",
    updatedAt: "2026-08-11T12:00:00.000Z",
    sourceKind: "confirmation",
    refId: "apr_mobile",
    expiresAt: future,
    ...overrides
  };
}

describe("CardResolver 判别联合", () => {
  it("attention 三类实体映射到 CardKind", () => {
    expect(attentionKind(item())).toBe("confirmation");
    expect(attentionKind(item({ id: "ob:obl_mobile", sourceKind: "obligation" }))).toBe("obligation");
    expect(attentionKind(item({ id: "task:tsk_mobile", sourceKind: "task" }))).toBe("task");
  });

  it("live 态只对 confirmation 开放裁决与撤销", () => {
    const ref: MobileCardRef = { kind: "confirmation", entityId: "apr_mobile" };
    expect(resolveCard({ ref, attention: [item()], nowMs: Date.parse("2026-08-11T12:00:00.000Z") })).toEqual(
      expect.objectContaining({ state: "live", allowedActions: ["decide", "withdraw"] })
    );
  });

  it("resolved 态以快照终态为准，不重复执行", () => {
    const ref: MobileCardRef = { kind: "obligation", entityId: "obl_mobile", focusId: "foc_mobile" };
    expect(resolveCard({ ref, attention: [], snapshot: { status: "resolved" } })).toEqual({
      state: "resolved",
      ref,
      allowedActions: ["open_lane"]
    });
  });

  it("attention 已 ack 但 Focus 快照仍 open 时保持 live 只读", () => {
    const ref: MobileCardRef = { kind: "obligation", entityId: "obl_mobile" };
    const cached = item({ id: "ob:obl_mobile", sourceKind: "obligation", refId: "obl_mobile", expiresAt: undefined });
    expect(resolveCard({ ref, attention: [], cached, snapshot: { status: "open" } })).toEqual({
      state: "live",
      ref,
      item: cached,
      allowedActions: ["open"]
    });
  });

  it("expired 态只保留去泳道查看", () => {
    const ref: MobileCardRef = { kind: "confirmation", entityId: "apr_mobile" };
    expect(resolveCard({ ref, attention: [item({ expiresAt: past })], nowMs: Date.parse("2026-08-11T12:00:00.000Z") })).toEqual({
      state: "expired",
      ref,
      expiresAt: past,
      allowedActions: ["open_lane"]
    });
  });

  it("stale 态保留诚实模糊回执，missing 态零动作", () => {
    const ref: MobileCardRef = { kind: "task", entityId: "tsk_mobile" };
    const cached = item({ id: "task:tsk_mobile", sourceKind: "task", refId: "tsk_mobile", expiresAt: undefined });
    expect(resolveCard({ ref, attention: [], cached })).toEqual({
      state: "stale",
      ref,
      cached,
      allowedActions: ["open_lane"]
    });
    expect(resolveCard({ ref, attention: [] })).toEqual({ state: "missing", ref, allowedActions: [] });
  });

  it("没有 Focus 目标的回执态不伪造去泳道动作", () => {
    const ref: MobileCardRef = { kind: "confirmation", entityId: "apr_mobile" };
    const cached = item({ focusId: null, focusTitle: null, expiresAt: past });
    expect(resolveCard({ ref, attention: [], cached })).toEqual({
      state: "expired",
      ref,
      expiresAt: past,
      allowedActions: []
    });
  });
});
