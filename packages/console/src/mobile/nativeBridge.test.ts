import { describe, expect, it, vi } from "vitest";
import {
  NATIVE_BRIDGE_VERSION,
  composeNativeTranscript,
  installNativeBridge,
  parseNativeTranscriptRequest,
  recentNativeFocuses,
  sanitizeNativeFocusTitle,
  type NativeBridgeWindow
} from "./nativeBridge";
import type { FocusRow } from "./types";

function focus(id: string, title: string, lifecycle: FocusRow["lifecycle"], updatedAt: string): FocusRow {
  return {
    id,
    title,
    lifecycle,
    currentRevision: 0,
    semanticAuthority: "saydo",
    openObligationCount: 0,
    openByOwner: { human: 0, agent: 0, external: 0 },
    fourState: { queued: 0, running: 0, needsYou: 0, settled: 0 },
    projectRefs: [],
    updatedAt,
    spaceId: null,
    direction: null
  };
}

describe("M2 native bridge 冻结合同", () => {
  it("只接受严格的 submitNativeTranscript 形状", () => {
    const valid = { requestId: "r1", captureId: "c1", text: " 说话 ", action: "send" } as const;
    expect(parseNativeTranscriptRequest(valid)).toEqual(valid);
    expect(parseNativeTranscriptRequest({ ...valid, action: "deliver" })).toBeNull();
    expect(parseNativeTranscriptRequest({ ...valid, extra: true })).toBeNull();
    expect(parseNativeTranscriptRequest({ ...valid, text: " " })).toBeNull();
    expect(parseNativeTranscriptRequest({ ...valid, focusId: "f-1" })).toBeNull();
    expect(parseNativeTranscriptRequest({ ...valid, focusTitle: "标题" })).toBeNull();
  });

  it("最近 3 个 Focus 按 lifecycle、updatedAt DESC、id 稳定排序并净化标题", () => {
    const rows = [
      focus("f3", "三", "archived", "2026-08-12T03:00:00.000Z"),
      focus("f2", "二]号\nFocus", "active", "2026-08-12T02:00:00.000Z"),
      focus("f1b", "同刻 B", "dormant", "2026-08-12T01:00:00.000Z"),
      focus("f1a", "同刻 A", "captured", "2026-08-12T01:00:00.000Z"),
      focus("f0", "旧", "active", "2026-08-12T00:00:00.000Z")
    ];
    expect(recentNativeFocuses(rows)).toEqual([
      { id: "f2", title: "二号 Focus", updatedAt: "2026-08-12T02:00:00.000Z" },
      { id: "f1a", title: "同刻 A", updatedAt: "2026-08-12T01:00:00.000Z" },
      { id: "f1b", title: "同刻 B", updatedAt: "2026-08-12T01:00:00.000Z" }
    ]);
    expect(Array.from(sanitizeNativeFocusTitle("字".repeat(70)))).toHaveLength(64);
  });

  it("Focus 前缀只采用同源 bridge 列表中的净化标题", () => {
    const focuses = [{ id: "f1", title: "真实标题", updatedAt: "2026-08-12T00:00:00.000Z" }];
    const request = { requestId: "r", captureId: "c", text: "继续推进", action: "send" as const };
    expect(composeNativeTranscript(request, focuses)).toBe("继续推进");
    expect(composeNativeTranscript({ ...request, focusId: "f1", focusTitle: "真实标题" }, focuses))
      .toBe("[关于:真实标题] 继续推进");
    expect(composeNativeTranscript({ ...request, focusId: "f1", focusTitle: "伪造]标题" }, focuses)).toBeNull();
  });

  it("挂载即发 versioned page-ready，转发 focuses/status/reply，dispose 后失效", async () => {
    const messages: unknown[] = [];
    const submit = vi.fn(() => ({ status: "queued_to_socket", requestId: "r", captureId: "c" } as const));
    const target: NativeBridgeWindow = {
      __saydoNativePageNonce: "page-1",
      webkit: { messageHandlers: { saydoNative: { postMessage: (message) => messages.push(message) } } }
    };
    const bridge = installNativeBridge(target, "ses_1", submit);
    expect(bridge).not.toBeNull();
    expect(messages[0]).toEqual({
      version: NATIVE_BRIDGE_VERSION,
      pageNonce: "page-1",
      type: "page-ready",
      sessionId: "ses_1"
    });
    bridge?.publishFocuses([{ id: "f1", title: "标题", updatedAt: "now" }]);
    bridge?.publishStatus("online");
    bridge?.forwardReply({
      sessionId: "ses_1",
      turnId: "t1",
      sentenceId: "s1",
      text: "回复",
      origin: "assistant_reply"
    });
    expect(messages.slice(1).map((message) => (message as { type: string }).type)).toEqual(["focuses", "status", "reply"]);
    await expect(target.SayDoNativeBridge?.submitNativeTranscript({
      requestId: "r",
      captureId: "c",
      text: "说话",
      action: "send"
    })).resolves.toMatchObject({ status: "queued_to_socket" });
    bridge?.dispose();
    expect(target.SayDoNativeBridge).toBeUndefined();
  });

  it("不存在 WK handler 时桌面零激活", () => {
    expect(installNativeBridge({}, "ses_1", vi.fn())).toBeNull();
    expect(installNativeBridge({ webkit: { messageHandlers: { saydoNative: { postMessage: vi.fn() } } } }, "ses_1", vi.fn()))
      .toBeNull();
  });
});
