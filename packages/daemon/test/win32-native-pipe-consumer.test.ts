// 注入生产 createWin32HandleReadable + wrapOwnedWindowsReadStream。不是 Windows 真机。
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import {
  WIN32_ERROR_BROKEN_PIPE,
  createWin32HandleReadable,
  type Win32PipeIoNative
} from "@saydo/platform";
import { wrapOwnedWindowsReadStream } from "../src/runtimeChildRegistry.js";

function pipeNative(read: (ctx: { buf: Buffer }) => { ok: number; lastError: number; bytes?: number }): Win32PipeIoNative {
  let lastError = 0;
  let lastBytes = 0;
  return {
    ReadFile: (_h, buf, _n, _written, _ov) => {
      const r = read({ buf });
      lastError = r.lastError;
      lastBytes = r.bytes ?? 0;
      return r.ok;
    },
    WriteFile: () => 1,
    CreateEventW: () => ({ kind: "event", signaled: true }),
    CloseHandle: () => 1,
    GetLastError: () => lastError,
    SetLastError: (code) => {
      lastError = code;
    },
    CancelIoEx: () => 1,
    GetOverlappedResult: (_h, _ov, transferred) => {
      transferred[0] = lastBytes;
      return lastError === 0 ? 1 : 0;
    },
    WaitForSingleObject: () => 0
  };
}

describe("wrapOwnedWindowsReadStream 消费生产可读流", () => {
  it("证据充分 EOF 被 wrap 收成正常结束", async () => {
    let step = 0;
    const owned = createWin32HandleReadable(
      pipeNative(({ buf }) => {
        if (step === 0) {
          step = 1;
          buf.write("ok");
          return { ok: 1, lastError: 0, bytes: 2 };
        }
        return { ok: 0, lastError: WIN32_ERROR_BROKEN_PIPE, bytes: 0 };
      }),
      { id: "out" },
      "stdout-server"
    );
    const wrapped = wrapOwnedWindowsReadStream(owned);
    const chunks: Buffer[] = [];
    wrapped.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    const erred = new Promise<Error | null>((resolve) => {
      wrapped.once("error", resolve);
      wrapped.once("end", () => resolve(null));
    });
    expect(await erred).toBeNull();
    expect(Buffer.concat(chunks).toString("utf8")).toBe("ok");
  });

  it("读取未知失败必须传到 wrap 消费者且不得收成结束", async () => {
    const owned = createWin32HandleReadable(
      pipeNative(() => {
        throw new Error("native worker failure");
      }),
      { id: "out" },
      "stdout-server"
    );
    const wrapped = wrapOwnedWindowsReadStream(owned);
    wrapped.resume();
    const [err] = (await once(wrapped, "error")) as [NodeJS.ErrnoException];
    expect(err.code).toBe("EIO");
    expect(err.code).not.toBe("EOF");
  });
});
