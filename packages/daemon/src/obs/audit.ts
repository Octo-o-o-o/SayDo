// E3 审计 sink(与日志分流:审计不可变、不轮转)。
// 0.1 形态 = append-only JSONL;0.3 存储落地后主 sink 切 SQLite audit_log,本文件保留为写入接口。
// 纪律(docs/modules/e-crosscutting E3):敏感 payload 只存 digest 不存原文;每条带 actor。

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ulid } from "ulid";

export type AuditActor = "owner" | "brain" | "daemon" | "bridge";

export interface AuditEvent {
  actor: AuditActor;
  action: string;
  refDigest?: string;
  meta?: Record<string, unknown>;
}

export interface AuditSink {
  record(event: AuditEvent): { id: string };
}

/**
 * 审计写失败(GAP-02 2.8):与普通日志的降级丢弃相反,审计是不可变合同,写失败必须 fail-closed 抛给调用方;
 * 本类型只让失败可见(带 code,不带路径),不提供吞错开关。
 */
export class AuditWriteError extends Error {
  readonly code: string;
  constructor(code: string, cause: unknown) {
    super(`audit write failed: ${code}`);
    this.name = "AuditWriteError";
    this.code = code;
    if (cause instanceof Error) this.cause = cause;
  }
}

function errorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return err instanceof Error ? err.name : "write_failed";
}

/** 0.1 文件 sink;0.3 起 daemon 主进程改用 SQLite sink(同一接口)。同步写、失败抛 AuditWriteError(不降级不丢)。 */
export function createFileAuditSink(
  filePath: string,
  now: () => Date = () => new Date(),
  hooks: { onWriteFailure?: (code: string) => void } = {}
): AuditSink {
  mkdirSync(dirname(filePath), { recursive: true });
  return {
    record(event) {
      const id = `aud_${ulid()}`;
      const row = { id, ts: now().toISOString(), ...event };
      try {
        appendFileSync(filePath, JSON.stringify(row) + "\n");
      } catch (err) {
        const code = errorCode(err);
        hooks.onWriteFailure?.(code);
        throw new AuditWriteError(code, err);
      }
      return { id };
    }
  };
}
