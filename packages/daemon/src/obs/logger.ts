// E3 结构化日志底座(docs/modules/e-crosscutting E1/E3;风格 = docs/11 §8):
// - 机器流:JSONL 追加到日志目录(可轮转,按天分文件);
// - 人读流:stderr 一行 `level=info msg="..." k=v`,状态标记用 [ok]/[warn]/[fail] 纯文本,禁 pictographic;
// - 颜色仅 stderr 错误红/警告黄,遵守 NO_COLOR;
// - 与审计分流:日志可轮转,审计不可变(见 audit.ts)。敏感 payload 不进日志,引用 digest。

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  dir: string;
  name: string;
  /** 测试注入用;缺省 Date.now */
  now?: () => Date;
  /** 测试注入用;缺省 process.stderr.write */
  stderrWrite?: (line: string) => void;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
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

export function createLogger(opts: LoggerOptions): Logger {
  const now = opts.now ?? (() => new Date());
  const write = opts.stderrWrite ?? ((line: string) => process.stderr.write(line));
  mkdirSync(opts.dir, { recursive: true });

  function emit(level: LogLevel, msg: string, fields: Record<string, unknown>): void {
    const ts = now().toISOString();
    const record = { ts, level, name: opts.name, msg, ...fields };
    const day = ts.slice(0, 10).replaceAll("-", "");
    appendFileSync(join(opts.dir, `${opts.name}-${day}.jsonl`), JSON.stringify(record) + "\n");
    write(fmtHuman(level, msg, fields) + "\n");
  }

  function make(bound: Record<string, unknown>): Logger {
    return {
      debug: (m, f = {}) => emit("debug", m, { ...bound, ...f }),
      info: (m, f = {}) => emit("info", m, { ...bound, ...f }),
      warn: (m, f = {}) => emit("warn", m, { ...bound, ...f }),
      error: (m, f = {}) => emit("error", m, { ...bound, ...f }),
      child: (b) => make({ ...bound, ...b })
    };
  }
  return make({});
}
