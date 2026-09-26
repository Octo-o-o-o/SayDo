// 义务写口(批 3):resolve / waiting-on。

import { z } from "zod";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { FocusWriteError, withFocusWriteTx } from "../focus/writeTx.js";
import { setObligationWaitingOn, setObligationWaitingOnTask } from "../focus/dependency.js";
import { taskDependencyConditionSchema } from "@saydo/contracts";

export interface ApiResponse {
  status: number;
  payload: unknown;
}

function err(status: number, code: string, message: string, retryable = false): ApiResponse {
  return { status, payload: { ok: false, code, message, retryable } };
}

const resolveBody = z.object({
  resolution: z.enum(["done", "abandoned", "superseded", "no_longer_applicable"]),
  /** ④e A7:agent+done 时必填(写门再校验);结构见 obligationResolveEvidenceSchema */
  evidence: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("artifact"),
        id: z.string().min(1),
        version: z.number().int().positive(),
        digest: z.string().min(1).optional()
      }),
      z.object({
        type: z.literal("task"),
        id: z.string().min(1),
        attempt: z.number().int().positive()
      }),
      z.object({
        type: z.literal("event"),
        focusId: z.string().min(1),
        seq: z.number().int().positive()
      })
    ])
    .optional()
});

/** POST /api/obligations/:id/resolve —— 经 upsert 单点,同事务走唤醒矩阵 */
export function resolveObligationApi(
  db: Db,
  audit: AuditSink,
  obligationId: string,
  body: unknown
): ApiResponse {
  const parsed = resolveBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);

  const row = db.prepare("SELECT * FROM focus_obligations WHERE id = ?").get(obligationId) as
    | {
        id: string;
        focus_id: string;
        kind: string;
        title: string;
        owner: string;
        status: string;
        verification: string;
        dedupe_key: string;
        detail: string | null;
        next_step: string | null;
        blocking: number;
        needs: string | null;
      }
    | undefined;
  if (!row) return err(404, "not_found", `obligation ${obligationId} not found`);
  if (["resolved", "superseded"].includes(row.status)) {
    return err(409, "already_terminal", `obligation status=${row.status}`);
  }

  try {
    const r = withFocusWriteTx(db, {}, (ops) =>
      ops.upsertObligation(row.focus_id, {
        id: row.id,
        kind: row.kind as "answer" | "decision" | "action" | "followup" | "check",
        title: row.title,
        owner: row.owner as "human" | "agent" | "external",
        status: parsed.data.resolution === "superseded" ? "superseded" : "resolved",
        verification: row.verification as "provisional" | "unverified" | "confirmed",
        dedupeKey: row.dedupe_key,
        resolution: parsed.data.resolution,
        blocking: row.blocking === 1,
        ...(row.detail ? { detail: row.detail } : {}),
        ...(row.next_step ? { nextStep: row.next_step } : {}),
        ...(parsed.data.evidence ? { evidence: parsed.data.evidence } : {}),
        actorKind: "user"
      })
    );
    audit.record({
      actor: "owner",
      action: "obligation.resolved",
      meta: {
        obligationId,
        focusId: row.focus_id,
        resolution: parsed.data.resolution,
        eventId: r.eventId
      }
    });
    return {
      status: 200,
      payload: {
        ok: true,
        id: obligationId,
        resolution: parsed.data.resolution,
        eventId: r.eventId
      }
    };
  } catch (e) {
    if (e instanceof FocusWriteError) {
      return err(409, e.code, e.message);
    }
    return err(409, "resolve_failed", e instanceof Error ? e.message : String(e));
  }
}

const waitingBody = z
  .object({
    /** 义务级前置(同 focus obligation id);null=清除全部等待 */
    preId: z.string().nullable().optional(),
    /** DAILY-01:任务级前置(同 focus 绑定任务 id);与 preId 互斥 */
    taskId: z.string().optional(),
    condition: taskDependencyConditionSchema.optional()
  })
  .superRefine((b, ctx) => {
    if (b.preId && b.taskId) {
      ctx.addIssue({ code: "custom", message: "preId 与 taskId 互斥" });
    }
  });

/** POST /api/obligations/:id/waiting-on {preId|null} 或 {taskId, condition}(DAILY-01 任务级) */
export function setWaitingOnApi(
  db: Db,
  audit: AuditSink,
  obligationId: string,
  body: unknown
): ApiResponse {
  const parsed = waitingBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);
  const b = parsed.data;
  if (b.preId === undefined && b.taskId === undefined) {
    return err(400, "invalid_input", "preId 或 taskId 必填其一(清等待传 {preId:null})");
  }

  try {
    if (b.taskId !== undefined) {
      const r = setObligationWaitingOnTask(db, {
        obligationId,
        taskId: b.taskId,
        condition: b.condition ?? "accepted",
        actorKind: "user"
      });
      audit.record({
        actor: "owner",
        action: "obligation.waiting_on_task",
        meta: { obligationId, taskId: b.taskId, condition: b.condition ?? "accepted", status: r.status }
      });
      return { status: 200, payload: { ok: true, id: obligationId, status: r.status } };
    }
    const r = setObligationWaitingOn(db, {
      obligationId,
      preId: b.preId ?? null,
      actorKind: "user"
    });
    audit.record({
      actor: "owner",
      action: "obligation.waiting_on",
      meta: { obligationId, preId: b.preId ?? null, status: r.status }
    });
    return { status: 200, payload: { ok: true, id: obligationId, status: r.status } };
  } catch (e) {
    if (e instanceof FocusWriteError) {
      const st =
        e.code === "not_found" ? 404 : e.code === "dependency_cycle" ? 400 : 409;
      return err(st, e.code, e.message);
    }
    return err(409, "waiting_on_failed", e instanceof Error ? e.message : String(e));
  }
}

const deferBody = z.object({
  reason: z.string().trim().min(1),
  /** 唤起条件/时间(文本;无后台调度器承诺,只是记录) */
  dueOrTrigger: z.string().optional()
});

/** DAILY-01:POST /api/obligations/:id/defer —— 推迟义务(理由必填;日期=记录非调度) */
export function deferObligationApi(
  db: Db,
  audit: AuditSink,
  obligationId: string,
  body: unknown
): ApiResponse {
  const parsed = deferBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", "defer 需要 reason");
  const row = db
    .prepare("SELECT id, focus_id, title, status FROM focus_obligations WHERE id = ?")
    .get(obligationId) as
    | { id: string; focus_id: string; title: string; status: string }
    | undefined;
  if (!row) return err(404, "not_found", `obligation ${obligationId} not found`);
  if (row.status === "resolved" || row.status === "superseded") {
    return err(409, "already_terminal", `obligation status=${row.status}`);
  }

  try {
    const r = withFocusWriteTx(db, {}, (ops) => {
      db.prepare(
        `UPDATE focus_obligations
         SET status = 'deferred', defer_reason = ?, due_or_trigger = COALESCE(?, due_or_trigger), updated_at = ?
         WHERE id = ?`
      ).run(parsed.data.reason, parsed.data.dueOrTrigger ?? null, ops.nowIso, row.id);
      return ops.appendEvent(row.focus_id, {
        type: "obligation_deferred",
        payload: {
          obligationId: row.id,
          title: row.title,
          deferReason: parsed.data.reason,
          ...(parsed.data.dueOrTrigger ? { dueOrTrigger: parsed.data.dueOrTrigger } : {})
        },
        actorKind: "user"
      });
    });
    audit.record({
      actor: "owner",
      action: "obligation.deferred",
      meta: { obligationId, focusId: row.focus_id, eventId: r.id }
    });
    return { status: 200, payload: { ok: true, id: obligationId, status: "deferred", eventId: r.id } };
  } catch (e) {
    if (e instanceof FocusWriteError) return err(409, e.code, e.message);
    return err(409, "defer_failed", e instanceof Error ? e.message : String(e));
  }
}
