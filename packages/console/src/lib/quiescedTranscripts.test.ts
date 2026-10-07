import { describe, expect, it } from "vitest";
import {
  clearPendingTurnText,
  clearPendingTurnTextIfMatch,
  readPendingTurnText,
  planAdoptQuiescedDraft,
  readQuiescedTranscripts,
  removeQuiescedTranscript,
  upsertQuiescedTranscript,
  writePendingTurnText
} from "./quiescedTranscripts";

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  };
}

describe("旧稿队列与 turn.text 缓存", () => {
  it("写入成功可 ACK;采用/丢弃只动本地,不自动当 turn.text", () => {
    const storage = memoryStorage();
    const item = {
      sessionId: "ses_1",
      requestId: "evt_req",
      turnId: "ses_turn",
      text: "独立旧稿",
      captureMode: "hands_free" as const
    };
    expect(upsertQuiescedTranscript(storage, item)).toBe(true);
    expect(upsertQuiescedTranscript(storage, item)).toBe(true);
    expect(readQuiescedTranscripts(storage, "ses_1")).toHaveLength(1);
    removeQuiescedTranscript(storage, "ses_1", "evt_req", "ses_turn");
    expect(readQuiescedTranscripts(storage, "ses_1")).toEqual([]);
  });

  it("pending turn 断线重挂同键恢复,accepted 才清", () => {
    const storage = memoryStorage();
    expect(
      writePendingTurnText(storage, "ses_1", {
        turnId: "ses_t",
        text: "还在发",
        daemonEpoch: "evt_ep",
        receiptAction: "submit"
      })
    ).toBe(true);
    expect(readPendingTurnText(storage, "ses_1")?.text).toBe("还在发");
    clearPendingTurnText(storage, "ses_1");
    expect(readPendingTurnText(storage, "ses_1")).toBeNull();
  });

  it("accepted 只清匹配 turnId,不误清后续另一轮或新稿", () => {
    const storage = memoryStorage();
    writePendingTurnText(storage, "ses_1", {
      turnId: "ses_new",
      text: "后写的稿",
      daemonEpoch: "evt_ep",
      receiptAction: "submit"
    });
    expect(clearPendingTurnTextIfMatch(storage, "ses_1", "ses_old")).toBe(false);
    expect(readPendingTurnText(storage, "ses_1")?.turnId).toBe("ses_new");
    expect(clearPendingTurnTextIfMatch(storage, "ses_1", "ses_new")).toBe(true);
    expect(readPendingTurnText(storage, "ses_1")).toBeNull();
  });

  it("空输入直接采用;有人工稿须确认追加或替换,不自动覆盖", () => {
    expect(planAdoptQuiescedDraft("", "旧稿")).toEqual({ action: "fill", next: "旧稿" });
    expect(planAdoptQuiescedDraft("新打的", "旧稿")).toEqual({
      action: "confirm",
      append: "新打的\n旧稿",
      replace: "旧稿"
    });
  });
});


it.each(["read", "parse", "shape"])("已有旧稿 %s 故障不覆写且不可 ACK", (fault) => {
  const old = JSON.stringify([{ sessionId: "ses_1", requestId: "evt_old", turnId: "ses_old", text: "旧稿", captureMode: "hands_free" }]);
  let stored = old; let writes = 0;
  const storage = { getItem: () => { if (fault === "read") throw new Error("synthetic getter"); return fault === "parse" ? "{" : "{}"; },
    setItem: (_key: string, value: string) => { writes++; stored = value; } };
  expect(upsertQuiescedTranscript(storage, { sessionId: "ses_1", requestId: "evt_new", turnId: "ses_new", text: "新稿", captureMode: "ptt" })).toBe(false);
  expect(removeQuiescedTranscript(storage, "ses_1", "evt_old", "ses_old")).toBe(false);
  expect(stored).toBe(old); expect(writes).toBe(0);
});

it("合法空队列与旧新合并、去重均保留各自文本", () => {
  const storage = memoryStorage();
  const first = { sessionId: "ses_1", requestId: "evt_old", turnId: "ses_old", text: "旧稿", captureMode: "hands_free" as const };
  const second = { ...first, requestId: "evt_new", turnId: "ses_new", text: "新稿" };
  expect(upsertQuiescedTranscript(storage, first)).toBe(true);
  expect(upsertQuiescedTranscript(storage, second)).toBe(true);
  expect(upsertQuiescedTranscript(storage, second)).toBe(true);
  expect(readQuiescedTranscripts(storage, "ses_1").map((x) => x.text)).toEqual(["旧稿", "新稿"]);
});
