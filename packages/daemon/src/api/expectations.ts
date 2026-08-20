// Focus v0.4 ④d:Expectation adjust / withdraw 写口。

import { z } from "zod";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import {
  adjustExpectationOnOps,
  getExpectationRow,
  withdrawExpectationOnOps
} from "../focus/expectations.js";
import { FocusWriteError, withFocusWriteTx } from "../focus/writeTx.js";

export interface ApiResponse {
  status: number;
  payload: unknown;
}

function err(status: number, code: string, message: string, retryable = false): ApiResponse {
  return { status, payload: { ok: false, code, message, retryable } };
}

const adjustBody = z
  .object({
    text: z.string().min(1).optional(),
    dueOrTrigger: z.string().min(1).optional(),
    budgetNote: z.string().min(1).optional(),
    /** 可选:控制轮注入用 session(talking 时触发 expectation_adjusted) */
    sessionId: z.string().optional()
  })
  .strict();

/**
 * POST /api/focuses/:id/expectations/:eid/adjust
 * patch={text?,dueOrTrigger?,budgetNote?};已有 pending_ack→409。
 */
export function adjustExpectationApi(
  db: Db,
  audit: AuditSink,
  focusId: string,
  expectationId: string,
  body: unknown
): ApiResponse {
  const focus = db.prepare("SELECT id FROM focuses WHERE id = ?").get(focusId);
  if (!focus) return err(404, "not_found", `focus ${focusId} not found`);
  const row = getExpectationRow(db, expectationId);
  if (!row || row.focus_id !== focusId) {
    return err(404, "not_found", `expectation ${expectationId} not found on focus`);
  }
  const parsed = adjustBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);
  if (
    parsed.data.text === undefined &&
    parsed.data.dueOrTrigger === undefined &&
    parsed.data.budgetNote === undefined
  ) {
    return err(400, "empty_patch", "adjust requires text, dueOrTrigger, or budgetNote");
  }

  try {
    const result = withFocusWriteTx(db, {}, (ops) =>
      adjustExpectationOnOps(
        ops,
        focusId,
        expectationId,
        {
          ...(parsed.data.text !== undefined ? { text: parsed.data.text } : {}),
          ...(parsed.data.dueOrTrigger !== undefined ? { dueOrTrigger: parsed.data.dueOrTrigger } : {}),
          ...(parsed.data.budgetNote !== undefined ? { budgetNote: parsed.data.budgetNote } : {})
        },
        {
          actorKind: "user",
          ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {})
        }
      )
    );
    audit.record({
      actor: "owner",
      action: "expectation.adjusted",
      meta: {
        focusId,
        expectationId: result.expectationId,
        previousId: expectationId,
        fromRevision: result.fromRevision,
        toRevision: result.toRevision,
        kind: result.kind
      }
    });
    return {
      status: 200,
      payload: {
        ok: true,
        expectationId: result.expectationId,
        logicalKey: result.logicalKey,
        fromRevision: result.fromRevision,
        toRevision: result.toRevision,
        previousActiveId: result.previousActiveId,
        eventId: result.eventId,
        appliesFrom: result.appliesFrom,
        text: result.text,
        kind: result.kind,
        status: "pending_ack",
        /** 调用方(index)据此 injectControlTurn(kind=expectation_adjusted) */
        controlTurnHint: parsed.data.sessionId
          ? { kind: "expectation_adjusted" as const, focusId, sessionId: parsed.data.sessionId }
          : null
      }
    };
  } catch (e) {
    if (e instanceof FocusWriteError) {
      if (e.code === "pending_ack_exists") return err(409, e.code, e.message);
      if (e.code === "not_found") return err(404, e.code, e.message);
      if (e.code === "authority_mismatch" || e.code === "epoch_fence") {
        return err(409, e.code, e.message);
      }
      return err(409, e.code, e.message);
    }
    return err(409, "adjust_failed", e instanceof Error ? e.message : String(e));
  }
}

/**
 * POST /api/focuses/:id/expectations/:eid/withdraw
 * 用户撤回:pending_ack→superseded + expectation_ack_settled。
 */
export function withdrawExpectationApi(
  db: Db,
  audit: AuditSink,
  focusId: string,
  expectationId: string,
  body?: unknown
): ApiResponse {
  const focus = db.prepare("SELECT id FROM focuses WHERE id = ?").get(focusId);
  if (!focus) return err(404, "not_found", `focus ${focusId} not found`);
  const sessionId =
    body && typeof body === "object" && body !== null && "sessionId" in body
      ? String((body as { sessionId?: string }).sessionId ?? "")
      : "";

  try {
    const result = withFocusWriteTx(db, {}, (ops) =>
      withdrawExpectationOnOps(ops, focusId, expectationId, {
        actorKind: "user",
        ...(sessionId ? { sessionId } : {})
      })
    );
    audit.record({
      actor: "owner",
      action: "expectation.withdrawn",
      meta: {
        focusId,
        expectationId,
        eventId: result.eventId,
        revision: result.revision
      }
    });
    return {
      status: 200,
      payload: {
        ok: true,
        expectationId,
        logicalKey: result.logicalKey,
        eventId: result.eventId,
        status: "superseded",
        /** index 若有 session 上挂着同 expectation 的 ack 卡,应 dismiss 清卡 */
        dismissHint: sessionId
          ? { sessionId, expectationId }
          : null
      }
    };
  } catch (e) {
    if (e instanceof FocusWriteError) {
      if (e.code === "not_found") return err(404, e.code, e.message);
      if (e.code === "not_pending_ack") return err(409, e.code, e.message);
      return err(409, e.code, e.message);
    }
    return err(409, "withdraw_failed", e instanceof Error ? e.message : String(e));
  }
}
