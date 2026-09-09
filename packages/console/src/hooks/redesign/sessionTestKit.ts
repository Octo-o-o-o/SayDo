// VIEW-01 页面会话单测工具(GAP-02 残项 2.2):仓内无 DOM 测试环境——
// 用 vi.stubGlobal 桩 fetch/location/localStorage(apiGet 的最小依赖),EventTarget 假 window/document 驱动失效信号。
// 仅供 *.test.ts 引用;不进生产 bundle(无运行时副作用,导出的都是工厂)。

import { vi } from "vitest";
import type { RefreshSignalTargets } from "./useRefreshSignal";

export class FakeDoc extends EventTarget {
  visibilityState: "visible" | "hidden" = "visible";
}

export function fakeTargets(): RefreshSignalTargets & { doc: FakeDoc } {
  return { win: new EventTarget(), doc: new FakeDoc() };
}

export type FetchRoute = (url: string, init?: RequestInit) => unknown;

export interface FetchStub {
  /** 按 pathname 计数(含 query 剥离) */
  count(pathname: string): number;
  calls: string[];
  /** 让某路径下一次起返回 5xx(人话 message);再次调用恢复 */
  fail(pathname: string, message: string): void;
  restore(pathname: string): void;
}

/** node 单测无 DOM:为 capToken/localStorage/daemonBase 提供最小桩,并按 pathname 路由 JSON 响应 */
export function installFetchStub(routes: Record<string, FetchRoute>): FetchStub {
  const store = new Map<string, string>();
  vi.stubGlobal("location", { search: "", host: "127.0.0.1:47120", hostname: "127.0.0.1" });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    }
  });
  const calls: string[] = [];
  const failing = new Map<string, string>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = String(input);
    const pathname = raw.split("?")[0] ?? raw;
    calls.push(pathname);
    // abort 语义:调用方已 abort 则按 fetch 规范拒绝
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    const failMsg = failing.get(pathname);
    if (failMsg !== undefined) {
      return new Response(JSON.stringify({ ok: false, code: "server_error", message: failMsg, retryable: false }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }
    const route = routes[pathname];
    if (!route) {
      return new Response(JSON.stringify({ ok: false, code: "not_found", message: `no route ${pathname}`, retryable: false }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(JSON.stringify(route(raw, init)), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    count: (pathname) => calls.filter((c) => c === pathname).length,
    fail: (pathname, message) => {
      failing.set(pathname, message);
    },
    restore: (pathname) => {
      failing.delete(pathname);
    }
  };
}

/** 只假 timers(setTimeout/setInterval/Date),保留 setImmediate/nextTick 真实——flush 靠它们排空 fetch/then 链 */
export function useSessionFakeTimers(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
}

/** 让在途的 fetch/then 链跑完(microtask + 一轮 macrotask) */
export async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  await new Promise<void>((r) => setImmediate(r));
}
