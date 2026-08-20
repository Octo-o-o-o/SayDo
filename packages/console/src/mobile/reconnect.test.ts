import { describe, expect, it, vi } from "vitest";
import {
  MOBILE_RECONNECT_EVENT,
  NATIVE_RESUME_EVENT,
  RECONNECT_DELAY_CAP_MS,
  installMobileForegroundReconnect,
  nextReconnectDelayMs,
  requestMobileReconnect
} from "./reconnect";

describe("移动重连退避与前台触发", () => {
  it("指数退避次数不封顶，间隔封顶 30s", () => {
    expect(nextReconnectDelayMs(0)).toBe(500);
    expect(nextReconnectDelayMs(1)).toBe(1_000);
    expect(nextReconnectDelayMs(2)).toBe(2_000);
    expect(nextReconnectDelayMs(10)).toBe(RECONNECT_DELAY_CAP_MS);
    expect(nextReconnectDelayMs(99)).toBe(RECONNECT_DELAY_CAP_MS);
    expect(RECONNECT_DELAY_CAP_MS).toBe(30_000);
  });

  it("手动/原生 resume 触发重连回调,visibility 不再由本 helper 监听", () => {
    type Handler = EventListenerOrEventListenerObject;
    const winHandlers = new Map<string, Set<Handler>>();
    const add = (map: Map<string, Set<Handler>>, type: string, fn: Handler) => {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type)!.add(fn);
    };
    const remove = (map: Map<string, Set<Handler>>, type: string, fn: Handler) => {
      map.get(type)?.delete(fn);
    };
    const emit = (map: Map<string, Set<Handler>>, type: string) => {
      const event = new Event(type);
      for (const fn of map.get(type) ?? []) {
        if (typeof fn === "function") fn(event);
        else fn.handleEvent(event);
      }
    };

    const fakeWindow = {
      addEventListener: (type: string, fn: Handler) => add(winHandlers, type, fn),
      removeEventListener: (type: string, fn: Handler) => remove(winHandlers, type, fn),
      dispatchEvent: (event: Event) => {
        emit(winHandlers, event.type);
        return true;
      }
    };

    const root = globalThis as typeof globalThis;
    const prevAdd = root.addEventListener;
    const prevRemove = root.removeEventListener;
    const prevDispatch = root.dispatchEvent;

    Object.assign(root, fakeWindow);

    try {
      const onReconnect = vi.fn();
      const dispose = installMobileForegroundReconnect(onReconnect);
      requestMobileReconnect();
      expect(onReconnect).toHaveBeenCalledTimes(1);
      root.dispatchEvent(new Event(NATIVE_RESUME_EVENT));
      expect(onReconnect).toHaveBeenCalledTimes(2);
      root.dispatchEvent(new Event("visibilitychange"));
      expect(onReconnect).toHaveBeenCalledTimes(2);
      dispose();
      root.dispatchEvent(new Event(MOBILE_RECONNECT_EVENT));
      expect(onReconnect).toHaveBeenCalledTimes(2);
    } finally {
      root.addEventListener = prevAdd;
      root.removeEventListener = prevRemove;
      root.dispatchEvent = prevDispatch;
    }
  });
});
