import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimTaskContextOwner,
  createTaskContextLifetime,
  enqueueTaskContextCleanup,
  establishTaskContext,
  releaseTaskContextOwner,
  resetTaskContextCoordinatorForTests,
  settleTaskContextResult
} from "./taskModalContext";
import { gateTaskModalSend } from "./taskModalView";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetTaskContextCoordinatorForTests();
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

describe("TaskModal 重试关闭共享失效", () => {
  it("关闭弹窗后迟到的重试成功会 DELETE nonce,不把结果应用到已关弹窗", async () => {
    stubBrowser();
    let releaseRetry!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    const deletes: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if ((init?.method ?? "GET") === "DELETE" && url.includes("/task-context")) {
          deletes.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
          return jsonResponse(200, { ok: true, cleared: true });
        }
        await gate;
        return jsonResponse(200, { ok: true, nonce: "nonce_late_retry" });
      })
    );

    const life = createTaskContextLifetime();
    const gen = life.begin();
    const pending = establishTaskContext({
      sessionId: "ses_1",
      refKind: "task",
      refId: "tsk_run",
      requestTargetKey: "task:tsk_run",
      liveTargetKey: () => "task:tsk_run",
      liveSessionId: () => "ses_1"
    });
    life.invalidate();
    releaseRetry();
    const raw = await pending;
    const settled = await settleTaskContextResult(life, gen, raw);
    expect(settled.status).toBe("stale");
    expect(deletes).toEqual([
      { url: "/api/session/ses_1/task-context", body: { nonce: "nonce_late_retry" } }
    ]);
  });
});

describe("确认卡文本发送", () => {
  it("弹窗是 A、当前 pending 卡是 B 时输入不要也不发", async () => {
    const sendText = vi.fn(async () => true);
    const result = await gateTaskModalSend({
      kind: "confirmation",
      text: "不要",
      card: { receiptId: "rcpt_b" },
      targetReceiptId: "rcpt_a",
      targetSessionId: "ses_1",
      liveSessionId: "ses_1",
      nonce: null,
      sendText
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toContain("当前确认卡不是这张");
    expect(sendText).not.toHaveBeenCalled();
  });

  it("Receipt 与 session 一致才把文本交给通道", async () => {
    const sendText = vi.fn(async () => true);
    expect(
      await gateTaskModalSend({
        kind: "confirmation",
        text: "不要",
        card: { receiptId: "rcpt_a" },
        targetReceiptId: "rcpt_a",
        targetSessionId: "ses_1",
        liveSessionId: "ses_1",
        nonce: null,
        sendText
      })
    ).toEqual({ sent: true });
    expect(sendText).toHaveBeenCalledWith("不要");
  });
});

describe("跨 modal 同会话 task-context 串行写", () => {
  it("延迟 A 的服务端处理,关闭 A 打开 B:B 等 A 写/cleanup 完才 ready,A 不能覆盖或删 B", async () => {
    stubBrowser();
    type Row = { refId: string; nonce: string };
    const store: { row: Row | null } = { row: null };
    const writes: string[] = [];
    let processA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      processA = resolve;
    });
    let nonceSeq = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body = init?.body ? (JSON.parse(String(init.body)) as { refId?: string; nonce?: string }) : {};
        if (method === "POST" && url.includes("/task-context")) {
          if (body.refId === "tsk_A") await gateA;
          nonceSeq += 1;
          const nonce = body.refId === "tsk_A" ? "nonce_A" : `nonce_B_${nonceSeq}`;
          store.row = { refId: String(body.refId), nonce };
          writes.push(`POST:${body.refId}:${nonce}`);
          return jsonResponse(200, { ok: true, nonce });
        }
        if (method === "DELETE" && url.includes("/task-context")) {
          const cleared = store.row !== null && store.row.nonce === body.nonce;
          if (cleared) store.row = null;
          writes.push(`DELETE:${body.nonce}:${cleared ? "hit" : "miss"}`);
          return jsonResponse(200, { ok: true, cleared });
        }
        return jsonResponse(404, { ok: false });
      })
    );

    const lifeA = createTaskContextLifetime();
    const genA = lifeA.begin();
    const ownerA = claimTaskContextOwner("ses_1", "task:tsk_A");
    const pendingA = establishTaskContext({
      sessionId: "ses_1",
      refKind: "task",
      refId: "tsk_A",
      requestTargetKey: "task:tsk_A",
      liveTargetKey: () => "task:tsk_A",
      liveSessionId: () => "ses_1",
      owner: ownerA
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    lifeA.invalidate();
    const cleanupA = enqueueTaskContextCleanup(async () => undefined);
    releaseTaskContextOwner(ownerA);

    const lifeB = createTaskContextLifetime();
    const genB = lifeB.begin();
    const ownerB = claimTaskContextOwner("ses_1", "task:tsk_B");
    const pendingB = establishTaskContext({
      sessionId: "ses_1",
      refKind: "task",
      refId: "tsk_B",
      requestTargetKey: "task:tsk_B",
      liveTargetKey: () => "task:tsk_B",
      liveSessionId: () => "ses_1",
      owner: ownerB
    });

    let bSettled = false;
    const bReady = pendingB.then(async (raw) => {
      const settled = await settleTaskContextResult(lifeB, genB, raw);
      bSettled = true;
      return settled;
    });
    await Promise.resolve();
    expect(bSettled).toBe(false);
    expect(store.row).toBeNull();

    processA();
    const [rawA, settledB] = await Promise.all([pendingA, bReady]);
    await cleanupA;
    const settledA = await settleTaskContextResult(lifeA, genA, rawA);
    expect(settledA.status).toBe("stale");
    expect(settledB.status).toBe("ready");
    if (settledB.status === "ready") {
      expect(store.row).toEqual({ refId: "tsk_B", nonce: settledB.nonce });
    }
    expect(writes.filter((w) => w.startsWith("POST:tsk_B")).length).toBe(1);
    expect(writes.some((w) => w.startsWith("DELETE:nonce_A"))).toBe(true);
    expect(store.row?.refId).toBe("tsk_B");
  });
});
