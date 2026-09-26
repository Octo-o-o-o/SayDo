import { afterEach, describe, expect, it, vi } from "vitest";
import { establishTaskContext, loadObligationDetail, loadTaskModalTask } from "./taskModalContext";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("TaskModal 详情与上下文分离(真实请求)", () => {
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

  it("GET 安排成功后,task-context 404 仍返回详情,不自动建会话", async () => {
    stubBrowser();
    const calls: { method: string; url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (url.includes("/api/focuses/foc_1") && (init?.method ?? "GET") === "GET") {
          return jsonResponse(200, {
            focus: { id: "foc_1", title: "周报" },
            obligations: [
              {
                id: "fob_1",
                title: "整理观察表行",
                detail: "打开表格核对",
                needs: null,
                status: "open",
                nextStep: "打开表格核对",
                owner: "human",
                kind: "action"
              }
            ]
          });
        }
        if (url.includes("/task-context")) {
          return jsonResponse(404, { ok: false, code: "session_not_found", message: "session ses_ghost not found" });
        }
        return jsonResponse(404, { ok: false, code: "not_found" });
      })
    );

    const detail = await loadObligationDetail("foc_1", "fob_1");
    expect(detail).toEqual({
      ok: true,
      obligation: expect.objectContaining({ id: "fob_1", title: "整理观察表行" })
    });

    const ctx = await establishTaskContext({
      sessionId: "ses_ghost",
      refKind: "obligation",
      refId: "fob_1",
      requestTargetKey: "obligation:fob_1",
      liveTargetKey: () => "obligation:fob_1",
      liveSessionId: () => "ses_ghost"
    });
    expect(ctx.status).toBe("failed");
    if (ctx.status === "failed") expect(ctx.message).toContain("详情可以先看");
    expect(calls.some((c) => c.url.includes("/api/session/ses_ghost/task-context") && c.method === "POST")).toBe(true);
    expect(calls.some((c) => c.url.includes("/api/sessions") && String(c.body).includes("ensure"))).toBe(false);
  });

  it("过期上下文成功响应不落到新 target/session,并清掉旧 nonce", async () => {
    stubBrowser();
    const deletes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if ((init?.method ?? "GET") === "DELETE" && url.includes("/task-context")) {
          deletes.push(url);
          return jsonResponse(200, { ok: true, cleared: true });
        }
        return jsonResponse(200, { ok: true, nonce: "nonce_old" });
      })
    );

    const ctx = await establishTaskContext({
      sessionId: "ses_old",
      refKind: "task",
      refId: "tsk_1",
      requestTargetKey: "task:tsk_1",
      liveTargetKey: () => "task:tsk_2",
      liveSessionId: () => "ses_new"
    });
    expect(ctx.status).toBe("stale");
    await Promise.resolve();
    await Promise.resolve();
    expect(deletes.some((u) => u.includes("/api/session/ses_old/task-context"))).toBe(true);
  });

  it("GET 任务认嵌套 task 包", async () => {
    stubBrowser();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          task: { id: "tsk_run", title: "分页性能优化", status: "running", viewStatus: "running", project_id: "prj_1" }
        })
      )
    );
    await expect(loadTaskModalTask("tsk_run")).resolves.toEqual({
      ok: true,
      task: {
        id: "tsk_run",
        title: "分页性能优化",
        status: "running",
        viewStatus: "running",
        projectId: "prj_1"
      }
    });
  });
});
