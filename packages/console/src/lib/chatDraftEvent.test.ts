import { describe, expect, it } from "vitest";
import { applyChatDraftEvent, readInitialChatDraft } from "./chatDraftEvent";

describe("Chat 迟到 final 消费(SD-HANDOFF-006)", () => {
  it("idle 收迟到免手稿,进入待确认", () => {
    expect(
      applyChatDraftEvent({
        ev: { kind: "text", text: "迟到一句" },
        inputState: "idle",
        draftText: "",
        draftBase: ""
      })
    ).toEqual({
      applied: true,
      draftText: "迟到一句",
      inputState: "confirm",
      transcribeError: false
    });
  });

  it("录音中丢弃 draftEvent,不覆盖当前轮", () => {
    expect(
      applyChatDraftEvent({
        ev: { kind: "text", text: "上一轮迟到" },
        inputState: "recording",
        draftText: "",
        draftBase: ""
      })
    ).toEqual({
      applied: false,
      draftText: "",
      inputState: "recording",
      transcribeError: false
    });
  });

  it("confirm 已改人工稿时不覆盖", () => {
    expect(
      applyChatDraftEvent({
        ev: { kind: "text", text: "ASR稿" },
        inputState: "confirm",
        draftText: "我改过的",
        draftBase: "ASR旧基线"
      })
    ).toEqual({
      applied: true,
      draftText: "我改过的",
      inputState: "confirm",
      transcribeError: false
    });
  });

  it("卸载再挂载从 pendingAnchor 回填未发送稿", () => {
    const store = new Map<string, string>();
    store.set(
      "saydo.chat.pendingAnchor",
      JSON.stringify({ focusId: "foc_1", draft: "断线还在的稿" })
    );
    expect(readInitialChatDraft({ getItem: (k) => store.get(k) ?? null })).toBe("断线还在的稿");
    expect(readInitialChatDraft({ getItem: () => null })).toBe("");
  });
});
