// Focus 产物最小 API(合同 §4.2):list/create/realize;role=expected 时 ref_json 允许 {}。

import { z } from "zod";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { projectArtifactExpectationOnOps } from "../focus/expectations.js";
import { FocusWriteError, withFocusWriteTx } from "../focus/writeTx.js";

export interface ApiResponse {
  status: number;
  payload: unknown;
}

function err(status: number, code: string, message: string, retryable = false): ApiResponse {
  return { status, payload: { ok: false, code, message, retryable } };
}

const refJsonSchema = z
  .object({
    repo: z.string().optional(),
    path: z.string().optional(),
    commit: z.string().optional(),
    url: z.string().optional(),
    digest: z.string().optional(),
    note: z.string().optional()
  })
  .strict();

const createBody = z.object({
  kind: z.enum(["file", "git_commit", "url", "text"]),
  role: z.enum(["expected", "deliverable", "input", "reference"]),
  title: z.string().min(1),
  ref: refJsonSchema,
  createdFromEvent: z.number().int().positive().optional()
});

function assertRef(role: string, ref: Record<string, unknown>): string | null {
  // expected 可空对象;其余至少一键
  if (role === "expected") return null;
  const keys = Object.keys(ref).filter((k) => ref[k] !== undefined && ref[k] !== "");
  if (keys.length === 0) return "ref_json must have at least one key (except role=expected)";
  return null;
}

export function listFocusArtifacts(db: Db, focusId: string): ApiResponse {
  const focus = db.prepare("SELECT id FROM focuses WHERE id = ?").get(focusId);
  if (!focus) return err(404, "not_found", `focus ${focusId} not found`);
  const rows = db
    .prepare(
      `SELECT id, focus_id, kind, role, title, ref_json, copied_from_artifact_id, created_from_event, created_at
       FROM focus_artifacts WHERE focus_id = ? ORDER BY created_at, id`
    )
    .all(focusId) as Array<{
    id: string;
    focus_id: string;
    kind: string;
    role: string;
    title: string;
    ref_json: string;
    copied_from_artifact_id: string | null;
    created_from_event: number | null;
    created_at: string;
  }>;
  return {
    status: 200,
    payload: {
      artifacts: rows.map((r) => ({
        id: r.id,
        focusId: r.focus_id,
        kind: r.kind,
        role: r.role,
        title: r.title,
        ref: JSON.parse(r.ref_json) as unknown,
        copiedFromArtifactId: r.copied_from_artifact_id,
        createdFromEvent: r.created_from_event,
        createdAt: r.created_at
      }))
    }
  };
}

export function createFocusArtifact(
  db: Db,
  audit: AuditSink,
  focusId: string,
  body: unknown,
  _nowIso: string
): ApiResponse {
  void _nowIso;
  const focus = db.prepare("SELECT id FROM focuses WHERE id = ?").get(focusId);
  if (!focus) return err(404, "not_found", `focus ${focusId} not found`);
  const parsed = createBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);
  const refErr = assertRef(parsed.data.role, parsed.data.ref as Record<string, unknown>);
  if (refErr) return err(400, "invalid_ref", refErr);
  // created_from_event 写入口断言(复合 FK 债 v24 再补):有值则须属本 focus
  if (parsed.data.createdFromEvent !== undefined) {
    const ev = db
      .prepare("SELECT seq FROM focus_events WHERE focus_id = ? AND seq = ?")
      .get(focusId, parsed.data.createdFromEvent);
    if (!ev) return err(400, "invalid_event", `createdFromEvent ${parsed.data.createdFromEvent} not on focus`);
  }
  // ④d:产物行 + artifact_linked 同事务;role=expected 时顺手投影 artifact 期待行
  let id: string;
  try {
    const linked = withFocusWriteTx(db, {}, (ops) => {
      const r = ops.linkArtifact(focusId, {
        kind: parsed.data.kind,
        role: parsed.data.role,
        title: parsed.data.title,
        refJson: JSON.stringify(parsed.data.ref),
        createdFromEvent: parsed.data.createdFromEvent,
        actorKind: "user"
      });
      if (parsed.data.role === "expected") {
        // 动态 import 避免 writeTx↔expectations 环;此处同包静态 import 即可
        projectArtifactExpectationOnOps(ops, focusId, r.artifactId, parsed.data.title, r.eventSeq);
      }
      return r;
    });
    id = linked.artifactId;
  } catch (e) {
    if (e instanceof FocusWriteError) {
      if (e.code === "not_found") return err(404, "not_found", e.message);
      if (e.code === "authority_mismatch" || e.code === "epoch_fence") {
        return err(409, e.code, e.message);
      }
      return err(409, e.code, e.message);
    }
    return err(409, "create_failed", e instanceof Error ? e.message : String(e));
  }
  audit.record({
    actor: "owner",
    action: "artifact.linked",
    meta: { artifactId: id, focusId, kind: parsed.data.kind, role: parsed.data.role }
  });

  return {
    status: 200,
    payload: {
      ok: true,
      id,
      focusId,
      kind: parsed.data.kind,
      role: parsed.data.role,
      title: parsed.data.title
    }
  };
}

const realizeBody = z.object({
  refJson: refJsonSchema
});

/**
 * POST /api/artifacts/:id/realize {refJson}
 * CAS:WHERE role='expected',changes==1 → deliverable + artifact_realized 事件
 */
export function realizeArtifactApi(
  db: Db,
  audit: AuditSink,
  artifactId: string,
  body: unknown
): ApiResponse {
  const parsed = realizeBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);
  const refErr = assertRef("deliverable", parsed.data.refJson as Record<string, unknown>);
  if (refErr) return err(400, "invalid_ref", refErr);

  const row = db
    .prepare(
      `SELECT id, focus_id, role, title, ref_json FROM focus_artifacts WHERE id = ?`
    )
    .get(artifactId) as
    | { id: string; focus_id: string; role: string; title: string; ref_json: string }
    | undefined;
  if (!row) return err(404, "not_found", `artifact ${artifactId} not found`);
  if (row.role !== "expected") {
    return err(409, "not_expected", `artifact role=${row.role}, only expected can realize`);
  }

  const newRefJson = JSON.stringify(parsed.data.refJson);
  let oldRef: Record<string, unknown> = {};
  try {
    oldRef = JSON.parse(row.ref_json) as Record<string, unknown>;
  } catch {
    oldRef = {};
  }

  try {
    const eventId = withFocusWriteTx(db, {}, (ops) => {
      const cas = db
        .prepare(
          `UPDATE focus_artifacts SET role = 'deliverable', ref_json = ?
           WHERE id = ? AND role = 'expected'`
        )
        .run(newRefJson, artifactId) as { changes: number };
      if (cas.changes !== 1) {
        throw new FocusWriteError("realize_cas_failed", "artifact role changed concurrently");
      }
      const ev = ops.appendEvent(row.focus_id, {
        type: "artifact_realized",
        payload: {
          artifactId,
          title: row.title,
          fromRole: "expected",
          toRole: "deliverable",
          oldRefJson: oldRef,
          newRefJson: parsed.data.refJson as Record<string, unknown>
        },
        actorKind: "user"
      });
      return ev.id;
    });
    audit.record({
      actor: "owner",
      action: "artifact.realized",
      meta: { artifactId, focusId: row.focus_id, eventId }
    });
    return {
      status: 200,
      payload: {
        ok: true,
        id: artifactId,
        role: "deliverable",
        eventId
      }
    };
  } catch (e) {
    if (e instanceof FocusWriteError) {
      return err(409, e.code, e.message);
    }
    return err(409, "realize_failed", e instanceof Error ? e.message : String(e));
  }
}
