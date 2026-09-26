import { afterEach, describe, expect, it, vi } from "vitest";
import { runOwnedAnchorAttempt } from "./chatAnchor";
import {
  claimFocusAnchorOwner,
  releaseFocusAnchorOwner,
  resetFocusAnchorCoordinatorForTests
} from "./focusAnchorCoordinator";
import { clearPendingAnchor, readPendingAnchor, writePendingAnchor } from "./pendingAnchor";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  resetFocusAnchorCoordinatorForTests();
  vi.unstubAllGlobals();
});

function stubBrowser(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("location", { search: "", host: "127.0.0.1:47120", hostname: "127.0.0.1" });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k)
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k)
  });
  return store;
}

describe("跨 Chat 实例迟到锚定", () => {
  it("延迟 A + 切 B 再迟到 A:服务端最后一笔是 B,A 不回写共享草稿", async () => {
    const store = stubBrowser();
    const serverWrites: string[] = [];
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body ? (JSON.parse(String(init.body)) as { focusId: string }) : { focusId: "" };
        if (body.focusId === "foc_A") await gateA;
        serverWrites.push(body.focusId);
        return jsonResponse(200, { ok: true });
      })
    );

    writePendingAnchor(
      { setItem: (k, v) => store.set(k, v) },
      { focusId: "foc_A", title: "主题A", draft: "A草稿" }
    );
    const ownerA = claimFocusAnchorOwner("ses_1", "foc_A");
    const pA = runOwnedAnchorAttempt({
      owner: ownerA,
      payload: { focusId: "foc_A", title: "主题A", draft: "A草稿" },
      sessionId: "ses_1",
      liveDraft: () => "A草稿-改过"
    });

    releaseFocusAnchorOwner(ownerA);
    writePendingAnchor(
      { setItem: (k, v) => store.set(k, v) },
      { focusId: "foc_B", title: "主题B", draft: "B草稿" }
    );
    const ownerB = claimFocusAnchorOwner("ses_1", "foc_B");
    const pB = runOwnedAnchorAttempt({
      owner: ownerB,
      payload: { focusId: "foc_B", title: "主题B", draft: "B草稿" },
      sessionId: "ses_1",
      liveDraft: () => "B草稿"
    });

    releaseA();
    const [a, b] = await Promise.all([pA, pB]);
    expect(a.status).toBe("stale");
    expect(b.status).toBe("ready");
    expect(serverWrites[serverWrites.length - 1]).toBe("foc_B");
    expect(serverWrites).toContain("foc_B");

    if (b.status === "ready") {
      clearPendingAnchor({ removeItem: (k) => void store.delete(k) });
    }
    if (a.status === "failed") {
      writePendingAnchor({ setItem: (k, v) => store.set(k, v) }, a.payload);
    }
    expect(readPendingAnchor({ getItem: (k) => store.get(k) ?? null })).toBeNull();
    expect(JSON.stringify([...store.values()]).includes("A草稿")).toBe(false);
  });

  it("旧实例失败迟到时不覆盖新续接草稿", async () => {
    const store = stubBrowser();
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body ? (JSON.parse(String(init.body)) as { focusId: string }) : { focusId: "" };
        if (body.focusId === "foc_A") {
          await gateA;
          return jsonResponse(503, { ok: false, code: "unavailable", message: "A 迟到失败" });
        }
        return jsonResponse(200, { ok: true });
      })
    );

    const ownerA = claimFocusAnchorOwner("ses_1", "foc_A");
    const pA = runOwnedAnchorAttempt({
      owner: ownerA,
      payload: { focusId: "foc_A", draft: "旧A草稿" },
      sessionId: "ses_1",
      liveDraft: () => "旧A草稿"
    });
    releaseFocusAnchorOwner(ownerA);
    writePendingAnchor({ setItem: (k, v) => store.set(k, v) }, { focusId: "foc_B", draft: "新B草稿" });
    const ownerB = claimFocusAnchorOwner("ses_1", "foc_B");
    const pB = runOwnedAnchorAttempt({
      owner: ownerB,
      payload: { focusId: "foc_B", draft: "新B草稿" },
      sessionId: "ses_1",
      liveDraft: () => "新B草稿"
    });
    releaseA();
    const [a, b] = await Promise.all([pA, pB]);
    expect(a.status).toBe("stale");
    expect(b.status).toBe("ready");
    expect(readPendingAnchor({ getItem: (k) => store.get(k) ?? null })).toEqual({
      focusId: "foc_B",
      draft: "新B草稿"
    });
  });
});
