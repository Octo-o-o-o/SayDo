import { describe, expect, it, vi } from "vitest";
import { ensureMobileChatRoute, planNativeTranscriptSubmission, publishMobileSettlement } from "./MobileApp";

describe("移动裁决后收口", () => {
  it("先同步显示 toast，attention 刷新只作 best-effort 且不阻塞已提交回执", () => {
    const calls: string[] = [];
    const reload = vi.fn(() => new Promise<void>(() => {}));
    publishMobileSettlement("已确认·已记账", (message) => calls.push(message), reload);
    expect(calls).toEqual(["已确认·已记账"]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("原生提交保留既有草稿，send 只在在线且空闲时如实返回 queued_to_socket", () => {
    const request = { requestId: "r1", captureId: "c1", text: "继续推进", action: "send" as const };
    expect(planNativeTranscriptSubmission(request, [], "键盘草稿", "online", false).result)
      .toMatchObject({ status: "rejected", reason: "draft_conflict" });
    expect(planNativeTranscriptSubmission(request, [], "", "offline", false).result)
      .toMatchObject({ status: "rejected", reason: "offline" });
    expect(planNativeTranscriptSubmission(request, [], "", "online", true).result)
      .toMatchObject({ status: "rejected", reason: "busy" });
    expect(planNativeTranscriptSubmission(request, [], "", "online", false))
      .toEqual({ result: { status: "queued_to_socket", requestId: "r1", captureId: "c1" }, text: "继续推进" });
  });

  it("原生 draft 不发送，只返回供输入框采用的文本", () => {
    const request = { requestId: "r2", captureId: "c2", text: "稍后再发", action: "draft" as const };
    expect(planNativeTranscriptSubmission(request, [], "", "offline", false))
      .toEqual({ result: { status: "drafted", requestId: "r2", captureId: "c2" }, text: "稍后再发" });
  });

  it("发送后不在 M-Chat 时规划导航到开口聊", () => {
    expect(ensureMobileChatRoute("#/m")).toBe("#/m/chat");
    expect(ensureMobileChatRoute("#/m/things")).toBe("#/m/chat");
    expect(ensureMobileChatRoute("#/m/chat")).toBe("#/m/chat");
  });
});
