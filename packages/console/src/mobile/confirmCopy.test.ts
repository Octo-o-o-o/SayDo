import { describe, expect, it } from "vitest";
import {
  CONFIRM_REJECT_SUBTEXT,
  CONFIRM_WITHDRAW_SUBTEXT,
  clipConfirmSubtext,
  confirmAcceptSubtext
} from "./confirmCopy";

describe("确认卡动作副文字", () => {
  it("长 prompt 不进「做」副行，改为按建议", () => {
    const long = "是否按当前方向继续推进本周交付并同步相关方";
    expect(confirmAcceptSubtext(long)).toBe("按建议");
    expect(confirmAcceptSubtext(long).length).toBeLessThanOrEqual(12);
  });

  it("短标题直接作 ≤12 字摘要", () => {
    expect(confirmAcceptSubtext("继续推进")).toBe("继续推进");
    expect(clipConfirmSubtext("一二三四五六七八九十一二三", 12)).toBe("一二三四五六七八九十一二…");
  });

  it("不要/撤销副文字固定短语", () => {
    expect(CONFIRM_REJECT_SUBTEXT).toBe("不按这个来");
    expect(CONFIRM_WITHDRAW_SUBTEXT).toBe("当我没问过");
  });
});
