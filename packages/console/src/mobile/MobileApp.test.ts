import { describe, expect, it, vi } from "vitest";
import { ensureMobileChatRoute, executeNativeTranscriptSubmission, planNativeTranscriptSubmission, publishMobileSettlement } from "./MobileApp";

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


describe("原生稿件归属与发送结算", () => {
  const request = { requestId: "r-owned", captureId: "c-owned", text: "唯一原稿", action: "send" as const };
  const plan = () => planNativeTranscriptSubmission(request, [], "", "online", false);
  it("发送Promise未结算不回报成功，发送前已有稿owner", async () => {
    let resolve!: (value: boolean) => void;let draft = "";let settled = false;
    const sending = new Promise<boolean>((done) => { resolve = done; });
    const send = vi.fn(() => { expect(draft).toBe("唯一原稿"); return sending; });
    const result = executeNativeTranscriptSubmission(request, plan(), (text) => { draft = text; }, send);
    void result.then(() => { settled = true; });await Promise.resolve();expect(settled).toBe(false);
    resolve(true);expect(await result).toMatchObject({ status: "queued_to_socket", requestId: request.requestId, captureId: request.captureId });expect(send).toHaveBeenCalledOnce();
  });
  it.each(["false", "throw"])("%s 不报成功、不清原稿、不重发", async (mode) => {
    let draft = "";const send = vi.fn(async () => { if (mode === "throw") throw new Error("synthetic failure"); return false; });
    expect(await executeNativeTranscriptSubmission(request, plan(), (text) => { draft = text; }, send)).toMatchObject({ status: "rejected", reason: "unknown" });
    expect(draft).toBe("唯一原稿");expect(send).toHaveBeenCalledOnce();
  });
  it("已有键盘稿的拒绝不收养或覆盖原稿", async () => {
    const adopt = vi.fn();const send = vi.fn(async () => true);
    const rejected = planNativeTranscriptSubmission(request, [], "键盘稿", "online", false);
    expect(await executeNativeTranscriptSubmission(request, rejected, adopt, send)).toMatchObject({ status: "rejected", reason: "draft_conflict" });expect(adopt).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled();
  });
  it("只采用草稿不触发发送", async () => {
    const draftRequest = { ...request, action: "draft" as const };const adopt = vi.fn();const send = vi.fn(async () => true);
    const planned = planNativeTranscriptSubmission(draftRequest, [], "", "offline", false);
    expect(await executeNativeTranscriptSubmission(draftRequest, planned, adopt, send)).toMatchObject({ status: "drafted" });expect(adopt).toHaveBeenCalledWith("唯一原稿");expect(send).not.toHaveBeenCalled();
  });
});
