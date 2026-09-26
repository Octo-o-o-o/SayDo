// 抽取实际生成的 flushStdioThenExit，用注入时钟/流做函数级回归。
// 本文件不是原生 Windows 验收。
import { EventEmitter, once } from "node:events";
import { PassThrough } from "node:stream";
import { createContext, runInContext } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { RuntimeInvocationError } from "../src/processGroupLifecycle.js";
import {
  execRuntimeChild,
  runtimeChildWrapperSource,
  setRuntimeChildTestHooks,
  type SpawnedRuntimeChild
} from "../src/runtimeChildRegistry.js";

interface FlushStream {
  writable: boolean;
  destroyed: boolean;
  writableLength: number;
  _handle: { writeQueueSize: number };
  write: (chunk: string, cb?: (err?: Error) => void) => void;
}

function extractFlushStdioThenExit(): string {
  const source = runtimeChildWrapperSource();
  const start = source.indexOf("function flushStdioThenExit(code) {");
  const end = source.indexOf("function drainAndExit(code)", start);
  if (start < 0 || end <= start) throw new Error("flushStdioThenExit not found");
  return source.slice(start, end);
}

function pendingOf(stream: FlushStream): number {
  if (!stream.writable || stream.destroyed) return 0;
  return (stream.writableLength || 0) + (stream._handle.writeQueueSize || 0);
}

function runGeneratedFlush(input: {
  code: number;
  stdout: FlushStream;
  stderr: FlushStream;
  tickMs?: number;
  maxTicks?: number;
  onTick?: (tick: number) => void;
}): {
  exitCodes: number[];
  ticks: number;
  logs: string[];
  diagnostics: string[];
  leftoverTimers: number;
} {
  let clock = 1;
  const exits: number[] = [];
  const scheduled: Array<() => void> = [];
  const logs: string[] = [];
  const diagnostics: string[] = [];
  const wrapWrite = (stream: FlushStream): FlushStream => {
    const inner = stream.write.bind(stream);
    stream.write = (chunk: string, cb?: (err?: Error) => void) => {
      if (typeof chunk === "string" && chunk.startsWith("saydo: wrapper stdio flush ")) {
        diagnostics.push(chunk);
      }
      inner(chunk, cb);
    };
    return stream;
  };
  const stdout = wrapWrite(input.stdout);
  const stderr = input.stderr === input.stdout ? stdout : wrapWrite(input.stderr);
  const ctx = createContext({
    process: {
      platform: "win32",
      stdout,
      stderr,
      exit: (code: number) => {
        exits.push(code);
      }
    },
    performance: { now: () => clock },
    setTimeout: (fn: () => void) => {
      scheduled.push(fn);
      return 0;
    },
    wlog: (msg: string) => {
      logs.push(String(msg));
    }
  });
  runInContext(`${extractFlushStdioThenExit()};flushStdioThenExit(${String(input.code)});`, ctx);
  const tickMs = input.tickMs ?? 1000;
  const maxTicks = input.maxTicks ?? 16;
  let ticks = 0;
  while (scheduled.length > 0 && ticks < maxTicks && exits.length === 0) {
    clock += tickMs;
    ticks += 1;
    input.onTick?.(ticks);
    const next = scheduled.shift();
    next?.();
  }
  return {
    exitCodes: exits,
    ticks,
    logs,
    diagnostics,
    leftoverTimers: scheduled.length
  };
}

function staticStream(bytes: number, write?: FlushStream["write"]): FlushStream {
  return {
    writable: true,
    destroyed: false,
    writableLength: bytes,
    _handle: { writeQueueSize: bytes },
    write: write ?? ((_chunk, cb) => {
      cb?.();
    })
  };
}

afterEach(() => {
  setRuntimeChildTestHooks(null);
});

describe("生成函数 flushStdioThenExit", () => {
  it("成功排空保留原成功码", () => {
    const stream = staticStream(0);
    const result = runGeneratedFlush({
      code: 0,
      stdout: stream,
      stderr: stream,
      maxTicks: 2
    });
    expect(result.exitCodes).toEqual([0]);
    expect(result.leftoverTimers).toBe(0);
    expect(result.diagnostics).toEqual([]);
  });

  it("成功排空保留原失败码", () => {
    const stream = staticStream(0);
    const result = runGeneratedFlush({
      code: 3,
      stdout: stream,
      stderr: stream,
      maxTicks: 2
    });
    expect(result.exitCodes).toEqual([3]);
    expect(result.leftoverTimers).toBe(0);
  });

  it("流停滞且原码为0则失败，待发字节仍在", () => {
    const stream = staticStream(4096);
    const result = runGeneratedFlush({
      code: 0,
      stdout: stream,
      stderr: stream,
      maxTicks: 12
    });
    expect(result.exitCodes).toEqual([124]);
    expect(pendingOf(stream) * 2).toBe(16384);
    expect(result.ticks).toBeLessThanOrEqual(12);
    expect(result.leftoverTimers).toBe(0);
    expect(result.logs.some((line) => line.includes("flush-stalled pending=16384"))).toBe(true);
    expect(result.diagnostics.some((line) => line.includes("stalled") && line.includes("16384"))).toBe(true);
  });

  it("流停滞且原码失败则不转成功", () => {
    const stream = staticStream(4096);
    const result = runGeneratedFlush({
      code: 7,
      stdout: stream,
      stderr: stream,
      maxTicks: 12
    });
    expect(result.exitCodes).toEqual([7]);
    expect(result.exitCodes[0]).not.toBe(0);
    expect(pendingOf(stream) * 2).toBe(16384);
    expect(result.leftoverTimers).toBe(0);
  });

  it("队列恢复变空后保留原成功码", () => {
    let pending = 4096;
    const stream: FlushStream = {
      writable: true,
      destroyed: false,
      get writableLength() {
        return pending;
      },
      _handle: {
        get writeQueueSize() {
          return pending;
        }
      },
      write(_chunk, cb) {
        cb?.();
      }
    };
    const result = runGeneratedFlush({
      code: 0,
      stdout: stream,
      stderr: stream,
      maxTicks: 8,
      onTick: (tick) => {
        if (tick === 3) pending = 0;
      }
    });
    expect(result.exitCodes).toEqual([0]);
    expect(result.ticks).toBeLessThan(10);
    expect(result.leftoverTimers).toBe(0);
  });

  it("队列持续变小则超过十秒仍保留原成功码", () => {
    let pending = 12000;
    const stream: FlushStream = {
      writable: true,
      destroyed: false,
      get writableLength() {
        return pending;
      },
      _handle: {
        get writeQueueSize() {
          return 0;
        }
      },
      write(_chunk, cb) {
        cb?.();
      }
    };
    const result = runGeneratedFlush({
      code: 0,
      stdout: stream,
      stderr: stream,
      maxTicks: 16,
      onTick: () => {
        if (pending > 0) pending = Math.max(0, pending - 1000);
      }
    });
    expect(result.exitCodes).toEqual([0]);
    expect(result.ticks).toBeGreaterThan(10);
    expect(result.leftoverTimers).toBe(0);
  });

  it("write 回调报错时原成功码失败且有界", () => {
    const stream = staticStream(0, (_chunk, cb) => {
      cb?.(new Error("EPIPE"));
    });
    const result = runGeneratedFlush({
      code: 0,
      stdout: stream,
      stderr: stream,
      maxTicks: 4
    });
    expect(result.exitCodes).toEqual([124]);
    expect(result.ticks).toBeLessThanOrEqual(2);
    expect(result.leftoverTimers).toBe(0);
    expect(result.logs.some((line) => line.includes("flush-write-error"))).toBe(true);
  });

  it("write 回调报错时原失败码不转成功", () => {
    const stream = staticStream(0, (_chunk, cb) => {
      cb?.(new Error("EPIPE"));
    });
    const result = runGeneratedFlush({
      code: 5,
      stdout: stream,
      stderr: stream,
      maxTicks: 4
    });
    expect(result.exitCodes).toEqual([5]);
    expect(result.leftoverTimers).toBe(0);
  });

  it("write 抛错时原成功码失败且有界", () => {
    const stream = staticStream(0, () => {
      throw new Error("write boom");
    });
    const result = runGeneratedFlush({
      code: 0,
      stdout: stream,
      stderr: stream,
      maxTicks: 4
    });
    expect(result.exitCodes).toEqual([124]);
    expect(result.ticks).toBe(0);
    expect(result.leftoverTimers).toBe(0);
  });

  it("write 永不回调时有界失败", () => {
    const stream = staticStream(0, () => undefined);
    const result = runGeneratedFlush({
      code: 0,
      stdout: stream,
      stderr: stream,
      maxTicks: 14
    });
    expect(result.exitCodes).toEqual([124]);
    expect(result.ticks).toBeLessThanOrEqual(12);
    expect(result.leftoverTimers).toBe(0);
    expect(result.logs.some((line) => line.includes("flush-write-stalled"))).toBe(true);
  });
});

describe("execRuntimeChild 消费包装器非零退出", () => {
  function fakeSpawned(pid = 424601): {
    spawned: SpawnedRuntimeChild;
    stdout: PassThrough;
    stderr: PassThrough;
  } {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdin = new PassThrough();
    const child = new EventEmitter() as SpawnedRuntimeChild["child"];
    child.stdout = stdout;
    child.stderr = stderr;
    child.stdin = stdin;
    Object.defineProperty(child, "pid", { value: pid });
    child.kill = () => true;
    queueMicrotask(() => child.emit("spawn"));
    return {
      spawned: {
        child,
        commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
        generation: "01234567-89ab-cdef-0123-456789abcdef",
        signal: () => undefined,
        lease: { establish: async () => undefined, release: async () => undefined }
      },
      stdout,
      stderr
    };
  }

  it("flush 未排空的 124 不得把已读输出当成功", async () => {
    const { spawned, stdout } = fakeSpawned();
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    stdout.write("partial-output");
    spawned.child.emit("exit", 124, null);
    spawned.child.emit("close", 124, null);
    const err = await pending.then(
      () => {
        throw new Error("wrapper 124 被当成成功");
      },
      (caught: unknown) => caught
    );
    expect(err).toBeInstanceOf(RuntimeInvocationError);
    expect(err).toMatchObject({
      name: "RuntimeInvocationError",
      exitCode: 124
    });
    expect(String(err)).toMatch(/Command failed with exit code 124/u);
  });

  it("close 0 仍是完整成功", async () => {
    const { spawned, stdout } = fakeSpawned(424602);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    stdout.write("git version 2.0.0\n");
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    await expect(pending).resolves.toMatchObject({
      stdout: "git version 2.0.0\n",
      stderr: ""
    });
  });
});
