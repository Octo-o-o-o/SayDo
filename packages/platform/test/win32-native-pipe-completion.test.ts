// SC-51 历史反例直接注入生产 API；不代表 Windows 真机验证。
import { describe, expect, it } from "vitest";
import { createWin32HandleReadable, getWin32PipeOwner, type Win32PipeIoNative } from "../src/win32.js";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("overlapped 终态与释放证据", () => {
  it.each(["wait_failed", "result_incomplete", "event_close_failed"])("%s 不得假闭，恢复后才释放", async (mode) => {
    const pipe = {};
    const event = {};
    let recovered = false;
    let lastError = 0;
    let cancellations = 0;
    let queries = 0;
    const closed: unknown[] = [];
    const errors: Error[] = [];
    const n: Win32PipeIoNative = {
      ReadFile: () => { lastError = 997; return 0; },
      WriteFile: () => { lastError = 997; return 0; },
      CreateEventW: () => event,
      GetLastError: () => lastError,
      SetLastError: (code) => { lastError = code; },
      WaitForSingleObject: () => mode === "wait_failed" && !recovered ? 0xffffffff : 0,
      GetOverlappedResult: (_h, _o, count) => {
        queries += 1;
        if (!recovered && mode !== "event_close_failed") { lastError = 996; return 0; }
        count[0] = 1;
        return 1;
      },
      CancelIoEx: () => { cancellations += 1; return 1; },
      CloseHandle: (handle) => {
        if (!recovered && mode === "event_close_failed" && handle === event) { lastError = 6; return 0; }
        closed.push(handle);
        return 1;
      }
    };
    const stream = createWin32HandleReadable(n, pipe, mode, { cancelWaitMs: 5 });
    stream.on("error", (error) => errors.push(error));
    stream.once("data", () => stream.destroy());
    stream.resume();
    try {
      await delay(20);
      stream.destroy();
      await delay(20);
      expect(queries).toBeGreaterThan(0);
      expect(closed).not.toContain(pipe);
      expect(closed).not.toContain(event);
      expect(stream.closed).toBe(false);
      expect(getWin32PipeOwner(stream)?.released()).toBe(false);
      expect(getWin32PipeOwner(stream)?.inFlight()).toBe(true);
      if (mode !== "event_close_failed") expect(cancellations).toBeGreaterThan(0);
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      recovered = true;
      stream.destroy();
      for (let i = 0; i < 50 && !stream.closed; i += 1) await delay(10);
    }
    expect(stream.closed).toBe(true);
    expect(getWin32PipeOwner(stream)?.released()).toBe(true);
    expect(closed.filter((handle) => handle === event)).toHaveLength(1);
    expect(closed.filter((handle) => handle === pipe)).toHaveLength(1);
  });
});
