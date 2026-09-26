// Chat 消费 VoiceChannel draftEvent 的生产路径(SD-HANDOFF-006)。
// idle/confirm 收迟到稿;录音中不覆盖;已改过的人工稿不覆盖。

import { readPendingAnchor } from "./pendingAnchor";

export type ChatInputState = "idle" | "recording" | "transcribing" | "confirm";

export type ChatDraftEvent = { kind: "text"; text: string } | { kind: "error" };

export type ChatDraftApply = {
  applied: boolean;
  draftText: string;
  inputState: ChatInputState;
  transcribeError: boolean;
};

export function applyChatDraftEvent(opts: {
  ev: ChatDraftEvent;
  inputState: ChatInputState;
  draftText: string;
  draftBase: string;
}): ChatDraftApply {
  if (opts.inputState === "recording") {
    return {
      applied: false,
      draftText: opts.draftText,
      inputState: opts.inputState,
      transcribeError: false
    };
  }
  if (opts.ev.kind === "error") {
    return {
      applied: true,
      draftText: opts.draftText,
      inputState: opts.draftText.trim() === "" ? "idle" : "confirm",
      transcribeError: true
    };
  }
  const overwrite = opts.draftText === opts.draftBase || opts.draftText.trim() === "";
  return {
    applied: true,
    draftText: overwrite ? opts.ev.text : opts.draftText,
    inputState: "confirm",
    transcribeError: false
  };
}

export function readInitialChatDraft(storage: Pick<Storage, "getItem"> | undefined): string {
  if (!storage) return "";
  return readPendingAnchor(storage)?.draft ?? "";
}
