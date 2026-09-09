// E3 结构化日志底座(docs/modules/e-crosscutting E1/E3;风格 = docs/11 §8):
// - 机器流:JSONL 追加到日志目录(可轮转,按天分文件);
// - 人读流:stderr 一行 `level=info msg="..." k=v`,状态标记用 [ok]/[warn]/[fail] 纯文本,禁 pictographic;
// - 颜色仅 stderr 错误红/警告黄,遵守 NO_COLOR;
// - 与审计分流:日志可轮转,审计不可变(见 audit.ts)。敏感 payload 不进日志,引用 digest。
// GAP-02 2.8 背压隔离:机器流改有界队列 + 异步写;ENOSPC/EACCES 等写失败不冒进业务调用栈,只计数并降级
// (丢弃普通日志,`health()` 暴露 degraded 供 /readyz 上报);进程退出时同步冲刷残留队列。审计 sink 不走本文件,
// 保持同步且失败 fail-closed(audit.ts)。

import { appendFileSync, mkdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  dir: string;
  name: string;
  /** 测试注入用;缺省 Date.now */
  now?: () => Date;
  /** 测试注入用;缺省 process.stderr.write */
  stderrWrite?: (line: string) => void;
  /** 有界队列上限(条);超过即丢弃并计数。缺省 2000 */
  maxQueue?: number;
  /** 测试注入用:异步追加实现;缺省 fs/promises appendFile */
  appendImpl?: (path: string, data: string) => Promise<void>;
  /** 测试注入用:退出时同步冲刷实现;缺省 appendFileSync */
  appendSyncImpl?: (path: string, data: string) => void;
  /** 是否在 process exit 时同步冲刷残留队列;缺省 true(测试可关) */
  flushOnExit?: boolean;
}

export interface LoggerHealth {
  /** 上一次写失败或队列溢出尚未恢复 ⇒ true;成功写完且队列清空后恢复 false */
  degraded: boolean;
  /** 累计写失败次数 */
  writeFailures: number;
  /** 累计因队列溢出丢弃的行数 */
  dropped: number;
  /** 当前排队未写行数 */
  queued: number;
  /** 最近一次写失败的错误码/名称(不含路径) */
  lastError?: string;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

/** createLogger 的真实形态:Logger + 背压可见;测试里的静默/捕获 fake 只需实现 Logger */
export interface DaemonLogger extends Logger {
  /** 背压/降级可见(GAP-02 2.8);child 与父共享同一队列与健康状态 */
  health(): LoggerHealth;
  /** 等待队列写完(测试与优雅停机用);写失败也会 resolve,不抛 */
  flush(): Promise<void>;
  child(bindings: Record<string, unknown>): DaemonLogger;
}

const COLOR = {
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  reset: "\u001b[0m"
} as const;

function useColor(): boolean {
  return !process.env["NO_COLOR"] && process.stderr.isTTY === true;
}

function fmtHuman(level: LogLevel, msg: string, fields: Record<string, unknown>): string {
  const kv = Object.entries(fields)
    .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : String(v)}`)
    .join(" ");
  const base = `level=${level} msg=${JSON.stringify(msg)}${kv ? " " + kv : ""}`;
  if (!useColor()) return base;
  if (level === "error") return `${COLOR.red}${base}${COLOR.reset}`;
  if (level === "warn") return `${COLOR.yellow}${base}${COLOR.reset}`;
  return base;
}

function errorLabel(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return err instanceof Error ? err.name : "write_failed";
}

export function createLogger(opts: LoggerOptions): DaemonLogger {
  const now = opts.now ?? (() => new Date());
  const write = opts.stderrWrite ?? ((line: string) => process.stderr.write(line));
  const maxQueue = opts.maxQueue ?? 2000;
  const appendImpl = opts.appendImpl ?? ((path: string, data: string) => appendFile(path, data));
  const appendSyncImpl = opts.appendSyncImpl ?? ((path: string, data: string) => appendFileSync(path, data));
  try {
    mkdirSync(opts.dir, { recursive: true });
  } catch {
    // 目录建不出来:后续写失败会计数降级,不在构造期抛
  }

  const queue: Array<{ path: string; line: string }> = [];
  let draining = false;
  let writeFailures = 0;
  let dropped = 0;
  let lastWriteFailed = false;
  let overflowed = false;
  let lastError: string | undefined;
  const waiters: Array<() => void> = [];

  function settleWaiters(): void {
    if (queue.length > 0 || draining) return;
    while (waiters.length > 0) waiters.shift()?.();
  }

  async function drain(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        // 同一文件的连续行合并成一次追加,减少 syscall
        const head = queue[0]!;
        let data = "";
        let n = 0;
        while (n < queue.length && queue[n]!.path === head.path && n < 256) {
          data += queue[n]!.line;
          n += 1;
        }
        try {
          await appendImpl(head.path, data);
          lastWriteFailed = false;
        } catch (err) {
          writeFailures += 1;
          lastWriteFailed = true;
          lastError = errorLabel(err);
        }
        queue.splice(0, n);
      }
      if (queue.length === 0) overflowed = false;
    } finally {
      draining = false;
      settleWaiters();
    }
  }

  function enqueue(path: string, line: string): void {
    if (queue.length >= maxQueue) {
      dropped += 1;
      overflowed = true;
      return;
    }
    queue.push({ path, line });
    if (!draining) void drain();
  }

  function flushSync(): void {
    if (queue.length === 0) return;
    const pending = queue.splice(0, queue.length);
    for (const item of pending) {
      try {
        appendSyncImpl(item.path, item.line);
      } catch (err) {
        writeFailures += 1;
        lastWriteFailed = true;
        lastError = errorLabel(err);
      }
    }
  }
  if (opts.flushOnExit ?? true) process.once("exit", flushSync);

  function emit(level: LogLevel, msg: string, fields: Record<string, unknown>): void {
    const ts = now().toISOString();
    const record = { ts, level, name: opts.name, msg, ...fields };
    const day = ts.slice(0, 10).replaceAll("-", "");
    enqueue(join(opts.dir, `${opts.name}-${day}.jsonl`), JSON.stringify(record) + "\n");
    try {
      write(fmtHuman(level, msg, fields) + "\n");
    } catch {
      // stderr 断开(EPIPE 等)同样不冒进业务调用栈
    }
  }

  function health(): LoggerHealth {
    return {
      degraded: lastWriteFailed || overflowed,
      writeFailures,
      dropped,
      queued: queue.length,
      ...(lastError ? { lastError } : {})
    };
  }

  function flush(): Promise<void> {
    if (queue.length === 0 && !draining) return Promise.resolve();
    return new Promise((resolve) => {
      waiters.push(resolve);
    });
  }

  function make(bound: Record<string, unknown>): DaemonLogger {
    return {
      debug: (m, f = {}) => emit("debug", m, { ...bound, ...f }),
      info: (m, f = {}) => emit("info", m, { ...bound, ...f }),
      warn: (m, f = {}) => emit("warn", m, { ...bound, ...f }),
      error: (m, f = {}) => emit("error", m, { ...bound, ...f }),
      child: (b) => make({ ...bound, ...b }),
      health,
      flush
    };
  }
  return make({});
}
