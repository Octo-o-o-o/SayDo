import { describe, expect, it } from "vitest";
import {
  desktopTextOutcomeCopy,
  epochChangeLeavesPendingUnknown,
  modeSwitchCapturePlan,
  planDesktopTurnText,
  routeCapturedFinal,
  shouldAcceptDesktopTurn,
  shouldReplayPendingOnHello,
  takeCaptureEntry,
  type CaptureQueueItem
} from "./captureQueue";

describe("PTT captureId 认轮(SD-HANDOFF-009)", () => {
  it("cancel 与 edit 不同轮按 captureId 匹配,不 FIFO 错消费", () => {
    const cancel: CaptureQueueItem = { kind: "cancelled", captureId: "evt_cancel", timer: 1 };
    const edit: CaptureQueueItem = { kind: "edit", captureId: "evt_edit", timer: 2 };
    const first = takeCaptureEntry([cancel, edit], "evt_edit");
    expect(first.entry).toEqual(edit);
    expect(first.queue).toEqual([cancel]);
    const second = takeCaptureEntry(first.queue, "evt_cancel");
    expect(second.entry).toEqual(cancel);
    expect(second.queue).toEqual([]);
  });

  it("无 captureId 的旧 final 仍 FIFO,避免新轮占位被队空迟到稿吃掉", () => {
    const send: CaptureQueueItem = { kind: "send", captureId: "evt_send", placeholderKey: "p1", timer: 1 };
    const taken = takeCaptureEntry([send], undefined);
    expect(taken.entry).toEqual(send);
  });

  it("classified HF 绝不走 PTT FIFO;PTT 无 captureId 也不 FIFO", () => {
    const send: CaptureQueueItem = { kind: "send", captureId: "evt_send", placeholderKey: "p1", timer: 1 };
    const hf = takeCaptureEntry([send], undefined, { captureMode: "hands_free" });
    expect(hf.entry).toBeUndefined();
    expect(hf.queue).toEqual([send]);
    const pttBare = takeCaptureEntry([send], undefined, { captureMode: "ptt" });
    expect(pttBare.entry).toBeUndefined();
    expect(pttBare.queue).toEqual([send]);
    const pttMatch = takeCaptureEntry([send], "evt_send", { captureMode: "ptt" });
    expect(pttMatch.entry).toEqual(send);
    expect(pttMatch.queue).toEqual([]);
  });
});

describe("PTT 在途切档后再切回", () => {
  it("有 captureId 的发送占位两轮切档后仍等终态,旧占位才标失败", () => {
    const send: CaptureQueueItem = { kind: "send", captureId: "evt_send", placeholderKey: "p-send", timer: 1 };
    const edit: CaptureQueueItem = { kind: "edit", captureId: "evt_edit", timer: 2 };
    const cancel: CaptureQueueItem = { kind: "cancelled", captureId: "evt_cancel", timer: 3 };
    const legacy: CaptureQueueItem = { kind: "send", placeholderKey: "p-legacy", timer: 4 };
    const toHf = modeSwitchCapturePlan([send, edit, cancel, legacy]);
    expect(toHf.failPlaceholderKeys).toEqual(["p-legacy"]);
    expect(toHf.retain.map((item) => item.captureId)).toEqual(["evt_send", "evt_edit", "evt_cancel"]);
    const back = modeSwitchCapturePlan(toHf.retain);
    expect(back.failPlaceholderKeys).toEqual([]);
    expect(back.retain).toEqual(toHf.retain);
    const taken = takeCaptureEntry(back.retain, "evt_send", { captureMode: "ptt" });
    expect(taken.entry?.placeholderKey).toBe("p-send");
    expect(takeCaptureEntry(taken.queue, undefined, { captureMode: "hands_free" }).queue.map((item) => item.captureId)).toEqual([
      "evt_edit",
      "evt_cancel"
    ]);
  });

  it("认领后的成功、空、失败、取消终态不编造重发", () => {
    expect(routeCapturedFinal({ kind: "send", recognitionOutcome: "ok", text: "已发出的原文" })).toEqual({
      action: "send",
      text: "已发出的原文",
      failed: false,
      thinking: true
    });
    expect(routeCapturedFinal({ kind: "send", recognitionOutcome: "ok", text: "  " })).toEqual({
      action: "send",
      text: "",
      failed: true,
      thinking: false
    });
    expect(routeCapturedFinal({ kind: "send", recognitionOutcome: "failed", text: "不该出现" })).toEqual({
      action: "send",
      text: "",
      failed: true,
      thinking: false
    });
    expect(routeCapturedFinal({ kind: "cancelled", recognitionOutcome: "ok", text: "取消原文" })).toEqual({
      action: "ignore"
    });
    expect(routeCapturedFinal({ kind: "edit", recognitionOutcome: "failed", text: "x" })).toEqual({ action: "draft_error" });
  });
});

describe("turn.text 回执", () => {
  it("仅 accepted 算发出;rejected/unknown 保稿", () => {
    expect(shouldAcceptDesktopTurn("accepted")).toBe(true);
    expect(shouldAcceptDesktopTurn("rejected")).toBe(false);
    expect(shouldAcceptDesktopTurn("unknown")).toBe(false);
  });

  it("跨 daemonEpoch 不自动重发,只标 unknown", () => {
    expect(epochChangeLeavesPendingUnknown("evt_old", "evt_new", true)).toBe(true);
    expect(epochChangeLeavesPendingUnknown("evt_same", "evt_same", true)).toBe(false);
    expect(epochChangeLeavesPendingUnknown(null, "evt_new", true)).toBe(false);
  });

  it("无 daemonEpoch 不得把发送当成功;同稿同 epoch 走 replay/retry", () => {
    expect(
      planDesktopTurnText({
        text: "还在发",
        daemonEpoch: null,
        pending: null,
        lastOutcome: null,
        lastRetryable: false,
        nextTurnId: () => "ses_new"
      })
    ).toEqual({ ok: false, reason: "no_epoch" });
    expect(
      planDesktopTurnText({
        text: "还在发",
        daemonEpoch: "evt_ep",
        pending: { turnId: "ses_old", text: "还在发", daemonEpoch: "evt_ep" },
        lastOutcome: null,
        lastRetryable: false,
        nextTurnId: () => "ses_new"
      })
    ).toMatchObject({ ok: true, turnId: "ses_old", receiptAction: "replay" });
    expect(
      planDesktopTurnText({
        text: "还在发",
        daemonEpoch: "evt_ep",
        pending: { turnId: "ses_old", text: "还在发", daemonEpoch: "evt_ep" },
        lastOutcome: "rejected",
        lastRetryable: true,
        nextTurnId: () => "ses_new"
      })
    ).toMatchObject({ ok: true, turnId: "ses_old", receiptAction: "retry" });
    expect(
      planDesktopTurnText({
        text: "新稿",
        daemonEpoch: "evt_ep",
        pending: { turnId: "ses_old", text: "还在发", daemonEpoch: "evt_ep" },
        lastOutcome: null,
        lastRetryable: false,
        nextTurnId: () => "ses_new"
      })
    ).toMatchObject({ ok: true, turnId: "ses_new", receiptAction: "submit" });
  });

  it("同 epoch 才重放 pending;unknown 与 rejected 文案分开", () => {
    expect(shouldReplayPendingOnHello({ daemonEpoch: "evt_a" }, "evt_a")).toBe(true);
    expect(shouldReplayPendingOnHello({ daemonEpoch: "evt_a" }, "evt_b")).toBe(false);
    expect(desktopTextOutcomeCopy("rejected")).toBe("没发出去,内容还在输入框");
    expect(desktopTextOutcomeCopy("unknown")).toBe("还没确认是否收到,内容还在输入框");
  });
});
