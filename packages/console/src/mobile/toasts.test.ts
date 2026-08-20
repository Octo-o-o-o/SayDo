import { describe, expect, it } from "vitest";
import {
  confirmDestinationHint,
  confirmSettlementToast,
  sendFailedToast,
  sentToast,
  summarizeForToast
} from "./toasts";

describe("移动 toast 人话", () => {
  it("发送成功带 20 字摘要", () => {
    expect(sentToast("继续推进本周三件事")).toBe('已发送:"继续推进本周三件事"');
    expect(sentToast("一二三四五六七八九十一二三四五六七八九十超出")).toBe(
      '已发送:"一二三四五六七八九十一二三四五六七八九十…"'
    );
  });

  it("失败 toast 人话，无排队/机房腔", () => {
    expect(sendFailedToast("offline")).toContain("连接恢复");
    expect(sendFailedToast("busy")).toContain("上一条");
    expect(sendFailedToast("unknown")).toContain("草稿");
    expect(sentToast("x")).not.toContain("队列");
    expect(sentToast("x")).not.toContain("queued");
  });

  it("拍板回执带可证明去向，无去向不造假", () => {
    expect(confirmSettlementToast("accept", "归入「周报」")).toBe("已确认·归入「周报」");
    expect(confirmSettlementToast("accept", null)).toBe("已确认·已记账");
    expect(confirmSettlementToast("reject")).toBe("已拒绝·不按这个来");
    expect(confirmSettlementToast("withdraw")).toBe("已撤下·当没问过");
  });

  it("去向只消费 focusTitle/needs 等已有字段", () => {
    expect(confirmDestinationHint({ focusTitle: "本周交付" })).toContain("本周交付");
    expect(confirmDestinationHint({ needs: "decision" })).toBe("方向已拍板");
    expect(confirmDestinationHint({ sourceKind: "confirmation" })).toBe("记入记忆库");
    expect(confirmSettlementToast("accept", "记入记忆库")).toBe("已确认·记入记忆库");
    expect(confirmDestinationHint({})).toBeNull();
    expect(summarizeForToast("短")).toBe("短");
  });
});
