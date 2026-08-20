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

/** 0.1 文件 sink;0.3 起 daemon 主进程改用 SQLite sink(同一接口)。 */
export function createFileAuditSink(filePath: string, now: () => Date = () => new Date()): AuditSink {
  mkdirSync(dirname(filePath), { recursive: true });
  return {
    record(event) {
      const id = `aud_${ulid()}`;
      const row = { id, ts: now().toISOString(), ...event };
      appendFileSync(filePath, JSON.stringify(row) + "\n");
      return { id };
    }
  };
}
