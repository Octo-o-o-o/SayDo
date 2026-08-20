import type { MemoryLedger } from "../memory/ledger.js";
import type { AuditSink } from "../obs/audit.js";
import type { Db } from "../storage/db.js";
import type { VoiceDelivery } from "../voice/hub.js";
import {
  acceptProjectAnchor,
  type ProjectAnchorCandidate,
  type SessionProjectEvent
} from "./anchor.js";

export interface ProjectAnchorCommitDeps {
  db: Db;
  ledger: MemoryLedger;
  audit: AuditSink;
  deliver: (event: SessionProjectEvent) => void;
  rebuild: (sessionId: string) => boolean;
  warn: (message: string, fields: Record<string, unknown>) => void;
  now?: () => Date;
}

export interface SessionProjectBroadcaster {
  sendSessionProject(event: SessionProjectEvent): VoiceDelivery;
}

/** 生产装配与测试共用同一投递判定，不能把“全失败”误当成已通知。 */
export function deliverSessionProjectOrThrow(
  broadcaster: SessionProjectBroadcaster,
  event: SessionProjectEvent
): void {
  const delivery = broadcaster.sendSessionProject(event);
  if (delivery.failed > 0 || (delivery.attempted > 0 && delivery.succeeded === 0)) {
    throw new Error("session.project delivery failed");
  }
}

function safeWarn(deps: ProjectAnchorCommitDeps, message: string, fields: Record<string, unknown>): void {
  try {
    deps.warn(message, fields);
  } catch {
    // durable accept 已提交后，诊断出口自身失败也不能反转提交结果。
  }
}

/**
 * durable accept 与 post-commit 投递/重建分域。返回后 event 一定已经提交；
 * post-commit 失败只标 degraded，绝不伪装成数据库回滚。
 */
export function acceptProjectAnchorWithFollowup(
  deps: ProjectAnchorCommitDeps,
  sessionId: string,
  candidate: ProjectAnchorCandidate
): { event: SessionProjectEvent; ready: boolean; postCommitDegraded: boolean } {
  const event = acceptProjectAnchor({
    db: deps.db,
    ledger: deps.ledger,
    audit: deps.audit,
    candidate,
    sessionId,
    now: (deps.now ?? (() => new Date()))()
  });
  let postCommitDegraded = false;
  try {
    deps.deliver(event);
  } catch (err) {
    postCommitDegraded = true;
    safeWarn(deps, "project anchor event delivery failed after commit", {
      code: err instanceof Error ? err.name : "unknown",
      projectRevision: event.projectRevision
    });
    try {
      deps.audit.record({
        actor: "daemon",
        action: "project.anchor.event_delivery_pending",
        meta: { sessionId: event.sessionId, projectId: event.projectId, projectRevision: event.projectRevision }
      });
    } catch (auditErr) {
      safeWarn(deps, "project anchor post-commit delivery audit failed", {
        code: auditErr instanceof Error ? auditErr.name : "unknown"
      });
    }
  }
  let ready = false;
  try {
    ready = deps.rebuild(event.sessionId);
  } catch (err) {
    postCommitDegraded = true;
    safeWarn(deps, "project anchor rebuild failed after commit", {
      code: err instanceof Error ? err.name : "unknown",
      projectRevision: event.projectRevision
    });
  }
  return { event, ready, postCommitDegraded };
}
