import { describe, expect, it } from "vitest";
import { expectedConfirmOutcome, MobileConfirmOutcomeError } from "./confirmDecision";

describe("M1 确认裁决回执", () => {
  it("三个动作只接受各自的精确终态", () => {
    expect(expectedConfirmOutcome("accept")).toBe("accepted");
    expect(expectedConfirmOutcome("reject")).toBe("rejected");
    expect(expectedConfirmOutcome("withdraw")).toBe("withdrawn");
  });

  it("过期与其他终态使用未执行话术，不误报裁决成功", () => {
    expect(new MobileConfirmOutcomeError("expired").message).toContain("已过期搁置");
    expect(new MobileConfirmOutcomeError("stale").message).toContain("本次裁决未执行");
    const untrusted = new MobileConfirmOutcomeError("untrusted_source");
    expect(untrusted.message).toContain("受信桌面");
    expect(untrusted.keepsWithdrawAvailable).toBe(true);
    expect(new MobileConfirmOutcomeError("expired").keepsWithdrawAvailable).toBe(false);
  });
});
