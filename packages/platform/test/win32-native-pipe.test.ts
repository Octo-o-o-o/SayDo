// 注入生产 overlapped ReadFile / CancelIoEx / owner 边界。不是 Windows 真机 kernel32。
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import {
  PlatformNativeError,
  WIN32_ERROR_BROKEN_PIPE,
  WIN32_ERROR_HANDLE_EOF,
  WIN32_ERROR_IO_INCOMPLETE,
  WIN32_ERROR_IO_PENDING,
  WIN32_ERROR_OPERATION_ABORTED,
  WIN32_ERROR_PIPE_NOT_CONNECTED,
  WIN32_FILE_FLAG_OVERLAPPED,
  createWin32HandleReadable,
  createWin32HandleWritable,
  createWin32PipeHandleOwner,
  disposeOwnedWin32ParentStdio,
  getWin32PipeOwner,
  readWin32HandleAsync,
  startWin32HandleRead,
  startWin32HandleWrite,
  win32StdioClientOpenFlags,
  win32StdioServerOpenMode,
  writeWin32HandleAsync,
  type Win32PipeIoNative
} from "../src/win32.js";

type EventHandle = { kind: "event"; signaled: boolean };

function tick(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function waitUntil(pred: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    if (pred()) return;
    await delay(5);
  }
  throw new Error(label);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const OWNED_WINDOWS_READ_PIPE_CLOSE_CODES = new Set([
  "EOF",
  "EBADF",
  "EPIPE",
  "ECONNRESET",
  "UNKNOWN",
  "ERR_STREAM_DESTROYED",
  "ERR_STREAM_PREMATURE_CLOSE"
]);

function pipeNative(opts: {
  read?: (ctx: { buf: Buffer; overlapped: unknown; written: number[] }) => { ok: number; lastError: number };
  write?: (ctx: { buf: Buffer; overlapped: unknown; written: number[] }) => { ok: number; lastError: number };
  result?: (ctx: { overlapped: unknown; transferred: number[] }) => { ok: number; lastError: number };
  cancel?: (overlapped: unknown) => { ok: number; lastError: number };
  close?: (handle: unknown) => number;
  wait?: (event: unknown) => number;
}): Win32PipeIoNative & { events: EventHandle[] } {
  let lastError = 0;
  const events: EventHandle[] = [];
  return {
    events,
    ReadFile: (_h, buf, _n, written, overlapped) => {
      const r = opts.read?.({ buf, overlapped, written }) ?? { ok: 1, lastError: 0 };
      lastError = r.lastError;
      return r.ok;
    },
    WriteFile: (_h, buf, _n, written, overlapped) => {
      const r = opts.write?.({ buf, overlapped, written }) ?? { ok: 1, lastError: 0 };
      lastError = r.lastError;
      return r.ok;
    },
    CreateEventW: () => {
      const event: EventHandle = { kind: "event", signaled: false };
      events.push(event);
      return event;
    },
    CloseHandle: (handle) => {
      if (handle && typeof handle === "object" && (handle as EventHandle).kind === "event") return 1;
      return opts.close ? opts.close(handle) : 1;
    },
    GetLastError: () => lastError,
    SetLastError: (code) => {
      lastError = code;
    },
    CancelIoEx: (_h, overlapped) => {
      const r = opts.cancel?.(overlapped) ?? { ok: 1, lastError: 0 };
      lastError = r.lastError;
      return r.ok;
    },
    GetOverlappedResult: (_h, overlapped, transferred, _wait) => {
      const r = opts.result?.({ overlapped, transferred }) ?? { ok: 1, lastError: 0 };
      lastError = r.lastError;
      return r.ok;
    },
    WaitForSingleObject: (event, _ms) => {
      if (opts.wait) return opts.wait(event);
      return event && typeof event === "object" && (event as EventHandle).signaled ? 0 : 258;
    }
  };
}

describe("win32 stdio 创建标志", () => {
  it("父端带 overlapped，子端保持同步", () => {
    expect(win32StdioServerOpenMode(true) & WIN32_FILE_FLAG_OVERLAPPED).toBe(WIN32_FILE_FLAG_OVERLAPPED);
    expect(win32StdioServerOpenMode(false) & WIN32_FILE_FLAG_OVERLAPPED).toBe(WIN32_FILE_FLAG_OVERLAPPED);
    expect(win32StdioClientOpenFlags() & WIN32_FILE_FLAG_OVERLAPPED).toBe(0);
  });
});

describe("readWin32HandleAsync 生产边界注入", () => {
  it("正常数据返回字节数", async () => {
    const n = pipeNative({
      read: ({ buf }) => {
        buf.write("hello");
        return { ok: 1, lastError: 0 };
      },
      result: ({ transferred }) => {
        transferred[0] = 5;
        return { ok: 1, lastError: 0 };
      }
    });
    const got = await readWin32HandleAsync(n, {}, Buffer.alloc(16));
    expect(got).toBe(5);
  });

  it("证据充分 BROKEN_PIPE 才是 EOF", async () => {
    const n = pipeNative({
      read: () => ({ ok: 0, lastError: WIN32_ERROR_BROKEN_PIPE })
    });
    await expect(readWin32HandleAsync(n, {}, Buffer.alloc(8))).resolves.toBe(0);
  });

  it("证据充分 HANDLE_EOF 才是 EOF", async () => {
    const n = pipeNative({
      read: () => ({ ok: 0, lastError: WIN32_ERROR_HANDLE_EOF })
    });
    await expect(readWin32HandleAsync(n, {}, Buffer.alloc(8))).resolves.toBe(0);
  });

  it("SUCCESS+0 不得当 EOF", async () => {
    const n = pipeNative({
      read: () => ({ ok: 1, lastError: 0 }),
      result: ({ transferred }) => {
        transferred[0] = 0;
        return { ok: 1, lastError: 0 };
      }
    });
    await expect(readWin32HandleAsync(n, {}, Buffer.alloc(8))).rejects.toMatchObject({
      code: "EIO",
      message: expect.stringMatching(/empty success/u)
    });
  });

  it("回调未知异常不得标 EOF", async () => {
    const n = pipeNative({
      read: () => {
        throw new Error("native worker failure");
      }
    });
    await expect(readWin32HandleAsync(n, {}, Buffer.alloc(8))).rejects.toMatchObject({
      code: "EIO",
      message: expect.stringMatching(/invocation failed/u)
    });
  });

  it("读取失败与未完成 pending 不得标 EOF", async () => {
    const denied = pipeNative({
      read: () => ({ ok: 0, lastError: 5 })
    });
    await expect(readWin32HandleAsync(denied, {}, Buffer.alloc(8))).rejects.toMatchObject({
      code: "EIO"
    });
    let complete = false;
    const incomplete = pipeNative({
      read: () => ({ ok: 1, lastError: 0 }),
      wait: () => 0,
      result: ({ transferred }) => {
        if (!complete) return { ok: 0, lastError: WIN32_ERROR_IO_INCOMPLETE };
        transferred[0] = 1;
        return { ok: 1, lastError: 0 };
      }
    });
    let settled = false;
    const reading = readWin32HandleAsync(incomplete, {}, Buffer.alloc(8)).finally(() => { settled = true; });
    await delay(10);
    expect(settled).toBe(false);
    complete = true;
    await expect(reading).resolves.toBe(1);
  });

  it("PIPE_NOT_CONNECTED 读不得冒充 EOF", async () => {
    const n = pipeNative({
      read: () => ({ ok: 0, lastError: WIN32_ERROR_PIPE_NOT_CONNECTED })
    });
    await expect(readWin32HandleAsync(n, {}, Buffer.alloc(8))).rejects.toMatchObject({
      code: "EIO"
    });
  });
});

describe("writeWin32HandleAsync 生产边界注入", () => {
  it("整写成功", async () => {
    const data = Buffer.from("abcd");
    const n = pipeNative({
      write: () => ({ ok: 1, lastError: 0 }),
      result: ({ transferred }) => {
        transferred[0] = data.length;
        return { ok: 1, lastError: 0 };
      }
    });
    await expect(writeWin32HandleAsync(n, {}, data)).resolves.toBeUndefined();
  });

  it("短写是 EIO 不是 EPIPE", async () => {
    const n = pipeNative({
      write: () => ({ ok: 1, lastError: 0 }),
      result: ({ transferred }) => {
        transferred[0] = 1;
        return { ok: 1, lastError: 0 };
      }
    });
    await expect(writeWin32HandleAsync(n, {}, Buffer.from("abcd"))).rejects.toMatchObject({
      code: "EIO",
      message: expect.stringMatching(/write short/u)
    });
  });

  it("写入未知失败不是 EPIPE", async () => {
    const n = pipeNative({
      write: () => {
        throw new Error("native worker failure");
      }
    });
    await expect(writeWin32HandleAsync(n, {}, Buffer.from("x"))).rejects.toMatchObject({
      code: "EIO",
      message: expect.stringMatching(/invocation failed/u)
    });
  });

  it("证据充分对端断开才是 EPIPE", async () => {
    const n = pipeNative({
      write: () => ({ ok: 0, lastError: WIN32_ERROR_BROKEN_PIPE })
    });
    await expect(writeWin32HandleAsync(n, {}, Buffer.from("x"))).rejects.toMatchObject({
      code: "EPIPE"
    });
    const disconnected = pipeNative({
      write: () => ({ ok: 0, lastError: WIN32_ERROR_PIPE_NOT_CONNECTED })
    });
    await expect(writeWin32HandleAsync(disconnected, {}, Buffer.from("x"))).rejects.toMatchObject({
      code: "EPIPE"
    });
  });
});

describe("createWin32HandleReadable/Writable 实际消费者", () => {
  it("正常数据后证据充分 EOF 结束且关闭成功", async () => {
    let step = 0;
    let closes = 0;
    const n = pipeNative({
      read: ({ buf }) => {
        if (step === 0) {
          step = 1;
          buf.write("abc");
          return { ok: 1, lastError: 0 };
        }
        return { ok: 0, lastError: WIN32_ERROR_BROKEN_PIPE };
      },
      result: ({ transferred }) => {
        transferred[0] = 3;
        return { ok: 1, lastError: 0 };
      },
      close: () => {
        closes += 1;
        return 1;
      }
    });
    const stream = createWin32HandleReadable(n, { id: "out" }, "stdout-server");
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    await once(stream, "end");
    expect(Buffer.concat(chunks).toString("utf8")).toBe("abc");
    expect(closes).toBe(1);
    expect(getWin32PipeOwner(stream)?.released()).toBe(true);
  });

  it("读取未知失败传到消费者且不是可吞掉的管道结束码", async () => {
    const n = pipeNative({
      read: () => {
        throw new Error("native worker failure");
      },
      close: () => 1
    });
    const stream = createWin32HandleReadable(n, { id: "out" }, "stdout-server");
    stream.resume();
    const [err] = (await once(stream, "error")) as [NodeJS.ErrnoException];
    expect(err).toBeInstanceOf(PlatformNativeError);
    expect(err.code).toBe("EIO");
    expect(OWNED_WINDOWS_READ_PIPE_CLOSE_CODES.has(err.code ?? "")).toBe(false);
  });

  it("写入失败传到 write 回调且不是 EPIPE", async () => {
    const n = pipeNative({
      write: () => ({ ok: 0, lastError: 5 }),
      close: () => 1
    });
    const stream = createWin32HandleWritable(n, { id: "in" }, "stdin-server");
    stream.on("error", () => undefined);
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      stream.write("hi", (e) => resolve((e as NodeJS.ErrnoException | null) ?? null));
    });
    expect(err?.code).toBe("EIO");
    expect(err?.code).not.toBe("EPIPE");
  });

  it("短写传到消费者且不是 EPIPE", async () => {
    const n = pipeNative({
      write: () => ({ ok: 1, lastError: 0 }),
      result: ({ transferred }) => {
        transferred[0] = 1;
        return { ok: 1, lastError: 0 };
      },
      close: () => 1
    });
    const stream = createWin32HandleWritable(n, { id: "in" }, "stdin-server");
    stream.on("error", () => undefined);
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      stream.write("abcd", (e) => resolve((e as NodeJS.ErrnoException | null) ?? null));
    });
    expect(err?.code).toBe("EIO");
    expect(err?.message).toMatch(/write short/u);
  });

  it("关闭失败不得标已闭且经 owner 恢复", async () => {
    let closes = 0;
    let allowClose = false;
    const n = pipeNative({
      read: () => ({ ok: 0, lastError: WIN32_ERROR_BROKEN_PIPE }),
      close: () => {
        closes += 1;
        return allowClose ? 1 : 0;
      }
    });
    const handle = { id: "owned" };
    const owner = createWin32PipeHandleOwner(n, handle, "stdout-server");
    const stream = createWin32HandleReadable(n, handle, "stdout-server", { owner });
    stream.resume();
    const [err] = (await once(stream, "error")) as [Error];
    expect(err).toBeInstanceOf(PlatformNativeError);
    expect(err.message).toMatch(/CloseHandle failed:stdout-server/u);
    expect((err as NodeJS.ErrnoException).code).not.toBe("EOF");
    expect(closes).toBe(1);
    expect(owner.released()).toBe(false);
    allowClose = true;
    owner.close();
    expect(closes).toBe(2);
    expect(owner.released()).toBe(true);
  });

  it("idle destroy(error) 仍合法关闭并保留外部错误", async () => {
    let closes = 0;
    const n = pipeNative({
      close: () => {
        closes += 1;
        return 1;
      }
    });
    const stream = createWin32HandleReadable(n, { id: "out" }, "stdout-server");
    const errors: string[] = [];
    const closed = new Promise<void>((resolve) => {
      stream.once("close", () => resolve());
    });
    stream.on("error", (err) => {
      errors.push(err.message);
    });
    stream.destroy(new Error("external failure"));
    await closed;
    expect(closes).toBe(1);
    expect(getWin32PipeOwner(stream)?.released()).toBe(true);
    expect(errors.some((message) => message.includes("external failure"))).toBe(true);
  });

  it("idle destroy(error) 关闭失败保留双重错误且 owner 可恢复", async () => {
    let closes = 0;
    const n = pipeNative({
      close: () => {
        closes += 1;
        return closes === 1 ? 0 : 1;
      }
    });
    const handle = { id: "owned" };
    const owner = createWin32PipeHandleOwner(n, handle, "stdin-server");
    const stream = createWin32HandleWritable(n, handle, "stdin-server", { owner });
    stream.on("error", () => undefined);
    stream.destroy(new Error("external failure"));
    const [err] = (await once(stream, "error")) as [Error];
    expect(err.message).toMatch(/external failure/u);
    expect(err.message).toMatch(/CloseHandle failed:stdin-server/u);
    expect(owner.released()).toBe(false);
    expect(closes).toBe(1);
    owner.close();
    expect(owner.released()).toBe(true);
    expect(closes).toBe(2);
  });

  it("pending 读取消完成后关闭且不丢尾数据", async () => {
    let pendingOv: unknown;
    let bufRef: Buffer | undefined;
    let closes = 0;
    const n = pipeNative({
      read: ({ buf, overlapped }) => {
        bufRef = buf;
        pendingOv = overlapped;
        return { ok: 0, lastError: WIN32_ERROR_IO_PENDING };
      },
      cancel: (overlapped) => {
        expect(overlapped).toBe(pendingOv);
        const event = n.events[0];
        if (event) event.signaled = true;
        return { ok: 1, lastError: 0 };
      },
      result: ({ transferred }) => {
        (bufRef as Buffer).write("abcd");
        transferred[0] = 4;
        return { ok: 1, lastError: 0 };
      },
      close: () => {
        closes += 1;
        return 1;
      }
    });
    const stream = createWin32HandleReadable(n, { id: "out" }, "stdout-server");
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    stream.resume();
    await waitUntil(() => n.events.length > 0, "read event not created");
    const held = bufRef as Buffer;
    stream.destroy();
    await once(stream, "close");
    expect(closes).toBe(1);
    expect(bufRef).toBe(held);
    expect(Buffer.concat(chunks).toString("utf8")).toBe("abcd");
    expect(getWin32PipeOwner(stream)?.released()).toBe(true);
  });

  it("pending 写取消失败后有界失败且不假闭，后续完成才收尾", async () => {
    let bufRef: Buffer | undefined;
    let closes = 0;
    const n = pipeNative({
      write: ({ buf }) => {
        bufRef = buf;
        return { ok: 0, lastError: WIN32_ERROR_IO_PENDING };
      },
      cancel: () => ({ ok: 0, lastError: 5 }),
      result: ({ transferred }) => {
        transferred[0] = 7;
        return { ok: 1, lastError: 0 };
      },
      close: () => {
        closes += 1;
        return 1;
      }
    });
    const stream = createWin32HandleWritable(n, { id: "in" }, "stdin-server", { cancelWaitMs: 20 });
    stream.on("error", () => undefined);
    const writeDone = new Promise<Error | null | undefined>((resolve) => {
      stream.write("payload", (err) => resolve(err));
    });
    await waitUntil(() => n.events.length > 0, "write event not created");
    const held = bufRef as Buffer;
    expect(held.toString("utf8", 0, 7)).toBe("payload");
    const owner = getWin32PipeOwner(stream);
    stream.destroy();
    const [err] = (await once(stream, "error")) as [Error];
    expect(err.message).toMatch(/cancel wait timeout|CancelIoEx failed/u);
    expect(closes).toBe(0);
    expect(owner?.released()).toBe(false);
    expect(owner?.inFlight()).toBe(true);
    expect(owner?.lastFailure()?.message).toMatch(/cancel wait timeout|CancelIoEx failed/u);
    expect(stream.closed).toBe(false);
    expect(bufRef).toBe(held);
    const event = n.events[0];
    if (event) event.signaled = true;
    await writeDone;
    await waitUntil(() => owner?.released() === true, "late write close not recovered");
    expect(closes).toBe(1);
  });

  it("pending 读取消不完成时不得假闭，后续完成才释放", async () => {
    let bufRef: Buffer | undefined;
    let closes = 0;
    const n = pipeNative({
      read: ({ buf }) => {
        bufRef = buf;
        return { ok: 0, lastError: WIN32_ERROR_IO_PENDING };
      },
      cancel: () => ({ ok: 1, lastError: 0 }),
      result: () => ({ ok: 0, lastError: WIN32_ERROR_OPERATION_ABORTED }),
      close: () => {
        closes += 1;
        return 1;
      }
    });
    const stream = createWin32HandleReadable(n, { id: "out" }, "stdout-server", { cancelWaitMs: 20 });
    stream.on("error", () => undefined);
    stream.resume();
    await waitUntil(() => n.events.length > 0, "read event not created");
    const held = bufRef as Buffer;
    const owner = getWin32PipeOwner(stream);
    stream.destroy();
    await delay(40);
    expect(closes).toBe(0);
    expect(stream.destroyed).toBe(true);
    expect(stream.closed).toBe(false);
    expect(owner?.released()).toBe(false);
    expect(owner?.inFlight()).toBe(true);
    expect(owner?.lastFailure()?.message).toMatch(/cancel wait timeout/u);
    expect(bufRef).toBe(held);
    const event = n.events[0];
    if (event) event.signaled = true;
    await waitUntil(() => owner?.released() === true, "late read close not recovered");
    expect(closes).toBe(1);
  });
});

describe("disposeOwnedWin32ParentStdio 生产生命周期", () => {
  it("关闭失败不得记 disposed，再次 dispose 经 owner 恢复", () => {
    let closes = 0;
    let allowClose = false;
    const n = pipeNative({
      close: () => {
        closes += 1;
        return allowClose ? 1 : 0;
      }
    });
    const handle = { id: "owned" };
    const owner = createWin32PipeHandleOwner(n, handle, "stdout-server");
    const stream = createWin32HandleReadable(n, handle, "stdout-server", { owner });
    stream.on("error", () => undefined);
    expect(() => disposeOwnedWin32ParentStdio({ streams: [stream], owners: [owner] })).toThrow(/CloseHandle failed/u);
    expect(owner.released()).toBe(false);
    expect(closes).toBeGreaterThanOrEqual(1);
    const failedCloses = closes;
    allowClose = true;
    expect(disposeOwnedWin32ParentStdio({ streams: [stream], owners: [owner] })).toBe("disposed");
    expect(owner.released()).toBe(true);
    expect(closes).toBeGreaterThan(failedCloses);
    expect(disposeOwnedWin32ParentStdio({ streams: [stream], owners: [owner] })).toBe("disposed");
    expect(closes).toBeGreaterThan(failedCloses);
  });

  it("在途 dispose 记 pending 且不假释放", async () => {
    const n = pipeNative({
      read: () => ({ ok: 0, lastError: WIN32_ERROR_IO_PENDING }),
      cancel: () => ({ ok: 1, lastError: 0 }),
      result: () => ({ ok: 0, lastError: WIN32_ERROR_OPERATION_ABORTED }),
      close: () => 1
    });
    const handle = { id: "owned" };
    const owner = createWin32PipeHandleOwner(n, handle, "stdout-server");
    const stream = createWin32HandleReadable(n, handle, "stdout-server", { owner, cancelWaitMs: 20 });
    stream.on("error", () => undefined);
    stream.resume();
    await waitUntil(() => n.events.length > 0, "read event not created");
    expect(disposeOwnedWin32ParentStdio({ streams: [stream], owners: [owner] })).toBe("pending");
    expect(owner.released()).toBe(false);
    expect(owner.inFlight()).toBe(true);
    const event = n.events[0];
    if (event) event.signaled = true;
    await waitUntil(() => owner.released(), "pending dispose did not finish");
    expect(disposeOwnedWin32ParentStdio({ streams: [stream], owners: [owner] })).toBe("disposed");
  });
});

describe("startWin32HandleRead/Write 取消请求不是完成", () => {
  it("CancelIoEx 失败仍保留 session 与 buffer", async () => {
    let bufRef: Buffer | undefined;
    const n = pipeNative({
      read: ({ buf }) => {
        bufRef = buf;
        return { ok: 0, lastError: WIN32_ERROR_IO_PENDING };
      },
      cancel: () => ({ ok: 0, lastError: 5 })
    });
    const buf = Buffer.alloc(8);
    const session = startWin32HandleRead(n, {}, buf);
    await waitUntil(() => n.events.length > 0, "session event missing");
    const cancelErr = session.requestCancel();
    expect(cancelErr?.message).toMatch(/CancelIoEx failed/u);
    expect(session.buffer).toBe(buf);
    expect(bufRef).toBe(buf);
    const event = n.events[0];
    if (event) event.signaled = true;
    await expect(session.promise).rejects.toMatchObject({ code: "EIO" });
  });

  it("pending 写 session 在未完成前保持 overlapped 身份", async () => {
    let ov: unknown;
    const n = pipeNative({
      write: ({ overlapped }) => {
        ov = overlapped;
        return { ok: 0, lastError: WIN32_ERROR_IO_PENDING };
      },
      cancel: (overlapped) => {
        expect(overlapped).toBe(ov);
        return { ok: 1, lastError: 0 };
      },
      result: ({ transferred }) => {
        transferred[0] = 1;
        return { ok: 1, lastError: 0 };
      }
    });
    const data = Buffer.from("x");
    const session = startWin32HandleWrite(n, {}, data);
    await waitUntil(() => n.events.length > 0, "write session event missing");
    expect(session.requestCancel()).toBeUndefined();
    expect(session.overlapped).toBe(ov);
    const event = n.events[0];
    if (event) event.signaled = true;
    await session.promise;
  });
});
