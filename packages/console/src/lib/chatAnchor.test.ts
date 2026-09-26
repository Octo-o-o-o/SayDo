import { afterEach, describe, expect, it, vi } from "vitest";
import { runAnchorAttempt } from "./chatAnchor";
import { mergeLiveDraft, planChatSend, shouldApplyAnchorResult } from "./pendingAnchor";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Chat 四发送面", () => {
  it("文本/系统语音在主题未就绪时留稿;云端 PTT/handsfree 不直发", () => {
    const blocked = {
      pending: { focusId: "foc_1", draft: "初稿" },
      phase: "failed" as const,
      liveSessionId: "ses_1",
      anchoredSessionId: null
    };
    expect(planChatSend({ ...blocked, surface: "text", text: "新草稿" })).toEqual({
      action: "hold_as_draft",
      text: "新草稿",
      reason: "续接还没接上,请先重试"
    });
    expect(planChatSend({ ...blocked, surface: "system_voice", text: "语音一句" }).action).toBe("hold_as_draft");
    expect(planChatSend({ ...blocked, surface: "cloud_ptt" }).action).toBe("hold_as_draft");
    expect(planChatSend({ ...blocked, surface: "handsfree" }).action).toBe("block");
  });

  it("当前 session 已锚定才放行四个发送面", () => {
    const ready = {
      pending: { focusId: "foc_1" },
      phase: "ready" as const,
      liveSessionId: "ses_1",
      anchoredSessionId: "ses_1"
    };
    expect(planChatSend({ ...ready, surface: "text", text: "发出去" })).toEqual({ action: "send_text", text: "发出去" });
    expect(planChatSend({ ...ready, surface: "system_voice", text: "语音一句" }).action).toBe("send_text");
    expect(planChatSend({ ...ready, surface: "cloud_ptt" })).toEqual({ action: "cloud_ptt_send" });
    expect(planChatSend({ ...ready, surface: "handsfree" })).toEqual({ action: "handsfree_done" });
    expect(
      planChatSend({
        ...ready,
        liveSessionId: "ses_new",
        anchoredSessionId: "ses_old",
        surface: "text",
        text: "错会话"
      }).action
    ).toBe("hold_as_draft");
  });
});

describe("focus-anchor 真实请求与身份", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubBrowser(): void {
    const store = new Map<string, string>();
    vi.stubGlobal("location", { search: "", host: "127.0.0.1:47120", hostname: "127.0.0.1" });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    });
  }

  it("失败时持久化当前草稿,不回滚初始 payload.draft", async () => {
    stubBrowser();
    const posts: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        posts.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
        return jsonResponse(503, { ok: false, code: "unavailable", message: "测试注入续接失败" });
      })
    );
    const result = await runAnchorAttempt({
      payload: { focusId: "foc_1", title: "周报", draft: "初始草稿" },
      sessionId: "ses_1",
      requestGen: 1,
      liveGen: () => 1,
      liveSessionId: () => "ses_1",
      liveDraft: () => "用户改过的新草稿"
    });
    expect(posts[0]?.url).toBe("/api/sessions/ses_1/focus-anchor");
    expect(posts[0]?.body).toEqual({ focusId: "foc_1" });
    expect(result).toEqual({
      status: "failed",
      payload: { focusId: "foc_1", title: "周报", draft: "用户改过的新草稿" },
      reason: "续接没接上,草稿还在,可重试"
    });
    expect(mergeLiveDraft({ focusId: "foc_1", draft: "初始草稿" }, "用户改过的新草稿").draft).toBe("用户改过的新草稿");
  });

  it("过期成功响应不覆盖新 session/新 gen", async () => {
    stubBrowser();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { ok: true })));
    const staleGen = await runAnchorAttempt({
      payload: { focusId: "foc_1" },
      sessionId: "ses_old",
      requestGen: 1,
      liveGen: () => 2,
      liveSessionId: () => "ses_new",
      liveDraft: () => "新草稿"
    });
    expect(staleGen.status).toBe("stale");
    expect(shouldApplyAnchorResult({
      requestGen: 1,
      liveGen: 1,
      requestedSessionId: "ses_old",
      liveSessionId: "ses_new"
    })).toBe(false);

    const switched = await runAnchorAttempt({
      payload: { focusId: "foc_1" },
      sessionId: "ses_old",
      requestGen: 3,
      liveGen: () => 3,
      liveSessionId: () => "ses_new",
      liveDraft: () => "新草稿"
    });
    expect(switched).toMatchObject({ status: "failed", reason: "会话已切换,草稿还在,可重试" });
    if (switched.status === "failed") expect(switched.payload.draft).toBe("新草稿");
  });
});
