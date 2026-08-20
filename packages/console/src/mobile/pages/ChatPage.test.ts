import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  historyToBubbles,
  isPendingUserBubble,
  mergeChatBubbles,
  mobileFirstRunTurn,
  mobileThinkingUi,
  MOBILE_THINKING_TIMEOUT_MS,
  MOBILE_THINKING_TIMEOUT_TEXT,
  shouldRequestMobileFirstRun,
  shouldRetryMobileFirstRun
} from "./ChatPage";

describe("M-Chat first-run 开场白", () => {
  it("只消费既有端点如实返回的 presented 消息", () => {
    expect(
      mobileFirstRunTurn({ state: "presented", delivered: true, message: "固定首跑开场白", turnId: "turn-1" })
    ).toEqual({ key: "mobile-onboarding-turn-1", text: "固定首跑开场白" });
    expect(mobileFirstRunTurn({ state: "presented", delivered: false, message: "等待朗读" })).toEqual({
      key: "mobile-onboarding-first",
      text: "等待朗读"
    });
    expect(mobileFirstRunTurn({ state: "legacy_not_eligible", delivered: false })).toBeNull();
  });

  it("等 voice WS 完成握手后才请求，并在定向回复尚未送达时有界重试", () => {
    expect(shouldRequestMobileFirstRun(false, false)).toBe(false);
    expect(shouldRequestMobileFirstRun(false, true)).toBe(true);
    expect(shouldRequestMobileFirstRun(true, true)).toBe(false);
    expect(shouldRetryMobileFirstRun({ state: "presented", delivered: false }, 0)).toBe(true);
    expect(shouldRetryMobileFirstRun({ state: "presented", delivered: true }, 0)).toBe(false);
    expect(shouldRetryMobileFirstRun({ state: "presented", delivered: false }, 20)).toBe(false);
  });

  it("pending 用户气泡仅匹配乐观对账文本或转写中态", () => {
    expect(isPendingUserBubble("你好", "你好")).toBe(true);
    expect(isPendingUserBubble("你好", "别的")).toBe(false);
    expect(isPendingUserBubble("转写中", null, true)).toBe(true);
    expect(isPendingUserBubble("实心", null, false)).toBe(false);
  });
});

describe("M-Chat 历史回放合并", () => {
  it("历史置顶且与 live 同 turnId 不重复", () => {
    const history = [
      { speaker: "user", text: "昨天说的", turnId: "trn_old" },
      { speaker: "ai", text: "记下了", turnId: "trn_ai_old" }
    ];
    const bubbles = mergeChatBubbles({
      history,
      firstRun: null,
      transcript: [
        { turnId: "trn_old", text: "昨天说的", seq: 1 },
        { turnId: "trn_new", text: "新一句", seq: 2 }
      ],
      spoken: [{ sentenceId: "trn_ai_old", text: "记下了", seq: 1, turnId: "trn_ai_old" }],
      pendingUserText: "新一句"
    });
    const texts = bubbles.map((b) => b.text);
    expect(texts).toEqual(["昨天说的", "记下了", "新一句"]);
    expect(bubbles.find((b) => b.text === "新一句")?.pending).toBe(true);
    expect(historyToBubbles(history)[0]?.history).toBe(true);
  });
});

describe("M-Chat 思考气泡超时", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("90 秒未回复 → timeout 文案;sticky 不因 thinking 清除而消失", () => {
    expect(MOBILE_THINKING_TIMEOUT_MS).toBe(90_000);
    expect(mobileThinkingUi(false, false)).toBe("hidden");
    expect(mobileThinkingUi(true, false)).toBe("pending");

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
    }, MOBILE_THINKING_TIMEOUT_MS);
    expect(mobileThinkingUi(true, timedOut)).toBe("pending");
    vi.advanceTimersByTime(89_999);
    expect(timedOut).toBe(false);
    vi.advanceTimersByTime(1);
    expect(timedOut).toBe(true);
    expect(mobileThinkingUi(true, timedOut)).toBe("timeout");
    // 通道兜底清 thinking 后错误态仍在(原位转错误,不回到 hidden)
    expect(mobileThinkingUi(false, timedOut)).toBe("timeout");
    expect(MOBILE_THINKING_TIMEOUT_TEXT).toContain("这轮没等到回复");
    clearTimeout(timer);
  });

  it("下一轮 thinking 重置后回到 pending,迟到回复与 timeout 可共存于流", () => {
    // 超时 sticky 后新一轮 thinking 由 UI 重置 timedOut=false
    expect(mobileThinkingUi(true, false)).toBe("pending");
    // 迟到 spoken 走 mergeChatBubbles 正常追加,不依赖 thinking 态
    const bubbles = mergeChatBubbles({
      history: [],
      firstRun: null,
      transcript: [{ turnId: "u1", text: "记一下", seq: 1 }],
      spoken: [{ sentenceId: "a1", text: "先记进记忆了", seq: 2 }]
    });
    expect(bubbles.map((b) => b.text)).toEqual(["记一下", "先记进记忆了"]);
  });
});
