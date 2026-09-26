import { describe, expect, it, vi } from "vitest";
import {
  PENDING_ANCHOR_KEY,
  anchoredBannerText,
  buildPendingAnchor,
  canSendThemedContent,
  clearPendingAnchor,
  consumeOwnedPendingDraft,
  shouldConsumeSentDraft,
  focusAnchorBody,
  focusAnchorPath,
  gateChatSend,
  parsePendingAnchor,
  readPendingAnchor,
  resolveLaneTitle,
  writePendingAnchor
} from "./pendingAnchor";

describe("parsePendingAnchor", () => {
  it("拒绝缺 focusId 的坏数据", () => {
    expect(parsePendingAnchor(null)).toBeNull();
    expect(parsePendingAnchor("{")).toBeNull();
    expect(parsePendingAnchor(JSON.stringify({ title: "x" }))).toBeNull();
    expect(parsePendingAnchor(JSON.stringify({ focusId: "  " }))).toBeNull();
  });

  it("保留真实标题/线名/草稿,不把空串当标题", () => {
    expect(
      parsePendingAnchor(
        JSON.stringify({ focusId: "foc_1", title: "周报", laneTitle: "主线", draft: "关于期待:" })
      )
    ).toEqual({ focusId: "foc_1", title: "周报", laneTitle: "主线", draft: "关于期待:" });
    expect(parsePendingAnchor(JSON.stringify({ focusId: "foc_1", title: "", laneTitle: "  " }))).toEqual({
      focusId: "foc_1"
    });
  });
});

describe("resolveLaneTitle", () => {
  it("用真实标题,不用 laneId", () => {
    expect(resolveLaneTitle([{ id: "lan_a", title: "素材线" }], "lan_a")).toBe("素材线");
    expect(resolveLaneTitle([{ id: "__main__", title: "主线" }], "__main__")).toBe("主线");
  });

  it("缺标题或标题等于 id 时省略,避免把 laneId 当标题", () => {
    expect(resolveLaneTitle([], "lan_a")).toBeUndefined();
    expect(resolveLaneTitle([{ id: "lan_a", title: "lan_a" }], "lan_a")).toBeUndefined();
    expect(resolveLaneTitle([{ id: "lan_a", title: "  " }], "lan_a")).toBeUndefined();
  });
});

describe("Records 续接请求不得把 laneId 当标题", () => {
  it("合成主线传 主线", () => {
    const body = focusAnchorBody(
      buildPendingAnchor({
        focusId: "foc_01F1XT0RE0F0CVS00000000001",
        title: "整理 D2 观察表素材",
        laneTitle: resolveLaneTitle([{ id: "__main__", title: "主线" }], "__main__")
      })
    );
    expect(body).toEqual({
      focusId: "foc_01F1XT0RE0F0CVS00000000001",
      laneTitle: "主线"
    });
    expect(JSON.stringify(body)).not.toContain("__main__");
  });
});

describe("focus-anchor 请求形状", () => {
  it("路径带当前 sessionId,body 只含 focusId 与可选真实 laneTitle", () => {
    expect(focusAnchorPath("ses_ABC")).toBe("/api/sessions/ses_ABC/focus-anchor");
    expect(focusAnchorBody({ focusId: "foc_1" })).toEqual({ focusId: "foc_1" });
    expect(focusAnchorBody({ focusId: "foc_1", laneTitle: "主线" })).toEqual({
      focusId: "foc_1",
      laneTitle: "主线"
    });
  });
});

describe("gateChatSend", () => {
  it("无 pendingAnchor 的普通对话:通道可发送则发出并清空草稿", async () => {
    const sendText = vi.fn(async () => true);
    expect(
      await gateChatSend({
        pending: null,
        phase: "idle",
        sessionId: "ses_1",
        anchoredSessionId: null,
        text: "你好",
        sendText
      })
    ).toEqual({ sent: true, keepDraft: false });
    expect(sendText).toHaveBeenCalledWith("你好");
  });

  it("无 pendingAnchor 时通道失败仍保留草稿", async () => {
    expect(
      await gateChatSend({
        pending: null,
        phase: "idle",
        sessionId: "ses_1",
        anchoredSessionId: null,
        text: "你好",
        sendText: async () => false
      })
    ).toEqual({ sent: false, keepDraft: true, reason: "通道未就绪,内容还在输入框" });
  });

  it("pending 未就绪或失败时不发送,保留草稿", async () => {
    const pending = { focusId: "foc_1", draft: "关于期待:" };
    const sendText = vi.fn(async () => true);
    expect(
      (
        await gateChatSend({
          pending,
          phase: "pending",
          sessionId: "ses_1",
          anchoredSessionId: null,
          text: pending.draft!,
          sendText
        })
      ).sent
    ).toBe(false);
    expect(
      await gateChatSend({
        pending,
        phase: "failed",
        sessionId: "ses_1",
        anchoredSessionId: null,
        text: pending.draft!,
        sendText
      })
    ).toMatchObject({ sent: false, keepDraft: true, reason: "续接还没接上,请先重试" });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("成功必须落在当前会话;会话变化不发给错误主题", async () => {
    const pending = { focusId: "foc_1" };
    const sendText = vi.fn(async () => true);
    expect(canSendThemedContent("ready", "ses_new", "ses_old")).toBe(false);
    expect(
      (
        await gateChatSend({
          pending,
          phase: "ready",
          sessionId: "ses_new",
          anchoredSessionId: "ses_old",
          text: "接着做",
          sendText
        })
      ).sent
    ).toBe(false);
    expect(sendText).not.toHaveBeenCalled();
    expect(
      (
        await gateChatSend({
          pending,
          phase: "ready",
          sessionId: "ses_1",
          anchoredSessionId: "ses_1",
          text: "接着做",
          sendText
        })
      ).sent
    ).toBe(true);
    expect(sendText).toHaveBeenCalledOnce();
  });
});

describe("sessionStorage 读写", () => {
  it("成功消费只清当前 owner 副本,不动其它 owner 新稿", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    };
    writePendingAnchor(storage, buildPendingAnchor({ focusId: "foc_A", draft: "已发送的A" }));
    const ownerA = { id: 1, sessionId: "ses_1", focusId: "foc_A" };
    expect(
      consumeOwnedPendingDraft(ownerA, storage, (o) => o.id === 1 && o.focusId === "foc_A")
    ).toBe(true);
    expect(readPendingAnchor(storage)).toBeNull();

    writePendingAnchor(storage, buildPendingAnchor({ focusId: "foc_B", draft: "B新稿" }));
    expect(
      consumeOwnedPendingDraft(ownerA, storage, (o) => o.id === 1 && o.focusId === "foc_A")
    ).toBe(false);
    expect(readPendingAnchor(storage)).toEqual({ focusId: "foc_B", draft: "B新稿" });
    expect(
      consumeOwnedPendingDraft({ id: 2, sessionId: "ses_1", focusId: "foc_B" }, storage, () => false)
    ).toBe(false);
    expect(readPendingAnchor(storage)?.draft).toBe("B新稿");

    consumeOwnedPendingDraft({ id: 2, sessionId: "ses_1", focusId: "foc_B" }, storage, (o) => o.id === 2);
    expect(readPendingAnchor(storage)).toBeNull();
    writePendingAnchor(storage, buildPendingAnchor({ focusId: "foc_B", draft: "离开前新改的" }));
    expect(readPendingAnchor(storage)?.draft).toBe("离开前新改的");
    expect(readPendingAnchor(storage)?.draft).not.toBe("B新稿");
  });

  it("成功前可重写保留草稿,成功后才清", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    };
    const payload = buildPendingAnchor({ focusId: "foc_1", title: "周报", draft: "草稿" });
    expect(writePendingAnchor(storage, payload)).toBe(true);
    expect(readPendingAnchor(storage)).toEqual(payload);
    expect(store.get(PENDING_ANCHOR_KEY)).toContain("foc_1");
    clearPendingAnchor(storage);
    expect(readPendingAnchor(storage)).toBeNull();
  });
});

describe("shouldConsumeSentDraft", () => {
  it("迟到 accepted 不得清掉新稿/新 owner/新 request", () => {
    const ownerA = { id: 1, sessionId: "ses_1", focusId: "foc_A" };
    const binding = {
      text: "稿A",
      version: 1,
      owner: ownerA,
      requestId: "evt_a",
      daemonEpoch: "evt_ep"
    };
    expect(
      shouldConsumeSentDraft({
        binding,
        currentText: "稿B",
        currentVersion: 2,
        currentOwner: ownerA,
        currentRequestId: "evt_a",
        currentEpoch: "evt_ep",
        isCurrentOwner: () => true
      })
    ).toBe(false);
    expect(
      shouldConsumeSentDraft({
        binding,
        currentText: "稿A",
        currentVersion: 1,
        currentOwner: { id: 2, sessionId: "ses_1", focusId: "foc_B" },
        currentRequestId: "evt_b",
        currentEpoch: "evt_ep",
        isCurrentOwner: (o) => o.id === 2
      })
    ).toBe(false);
    expect(
      shouldConsumeSentDraft({
        binding,
        currentText: "稿A",
        currentVersion: 1,
        currentOwner: ownerA,
        currentRequestId: "evt_a",
        currentEpoch: "evt_ep",
        isCurrentOwner: () => true
      })
    ).toBe(true);
  });
});

describe("anchoredBannerText", () => {
  it("线名用真实标题", () => {
    expect(anchoredBannerText({ focusId: "foc_1", title: "周报", laneTitle: "主线" })).toBe(
      "已接上「周报」 · 工作线:「主线」"
    );
  });
});
