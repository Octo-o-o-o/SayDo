// 空间最小 API(合同 §2):list/create/rename/delete + focus 归组。
// 删除事务=置空 space_id + 删行 + audit(无级联删 Focus)。

import { newId } from "@saydo/contracts";
import { z } from "zod";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";

export interface ApiResponse {
  status: number;
  payload: unknown;
}

function err(status: number, code: string, message: string, retryable = false): ApiResponse {
  return { status, payload: { ok: false, code, message, retryable } };
}

const createBody = z.object({ title: z.string().min(1) });
const renameBody = z.object({ title: z.string().min(1) });
const assignBody = z.object({ spaceId: z.string().nullable() });

export function listSpaces(db: Db): unknown {
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.created_at, s.updated_at,
              (SELECT COUNT(*) FROM focuses f WHERE f.space_id = s.id) AS focus_count
       FROM focus_spaces s ORDER BY s.updated_at DESC`
    )
    .all() as Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    focus_count: number;
  }>;
  return {
    spaces: rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      focusCount: r.focus_count
    }))
  };
}

export function createSpace(db: Db, audit: AuditSink, body: unknown, nowIso: string): ApiResponse {
  const parsed = createBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);
  const id = newId("foc"); // 空间 id 复用 foc 前缀族(contracts 未单列 spc)
  db.prepare(
    `INSERT INTO focus_spaces(id, title, created_at, updated_at) VALUES (?,?,?,?)`
  ).run(id, parsed.data.title, nowIso, nowIso);
  audit.record({
    actor: "owner",
    action: "space.created",
    meta: { spaceId: id, title: parsed.data.title }
  });
  return { status: 200, payload: { ok: true, id, title: parsed.data.title } };
}

export function renameSpace(
  db: Db,
  audit: AuditSink,
  spaceId: string,
  body: unknown,
  nowIso: string
): ApiResponse {
  const parsed = renameBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);
  const r = db
    .prepare("UPDATE focus_spaces SET title = ?, updated_at = ? WHERE id = ?")
    .run(parsed.data.title, nowIso, spaceId) as { changes: number };
  if (r.changes !== 1) return err(404, "not_found", `space ${spaceId} not found`);
  audit.record({
    actor: "owner",
    action: "space.renamed",
    meta: { spaceId, title: parsed.data.title }
  });
  return { status: 200, payload: { ok: true, id: spaceId, title: parsed.data.title } };
}

/** 删除:置空 focuses.space_id + 删行(合同 §2 无级联删 Focus) */
export function deleteSpace(db: Db, audit: AuditSink, spaceId: string, nowIso: string): ApiResponse {
  const exists = db.prepare("SELECT id, title FROM focus_spaces WHERE id = ?").get(spaceId) as
    | { id: string; title: string }
    | undefined;
  if (!exists) return err(404, "not_found", `space ${spaceId} not found`);
  const result = db.transaction(() => {
    const affected = db
      .prepare("SELECT id FROM focuses WHERE space_id = ?")
      .all(spaceId) as { id: string }[];
    db.prepare("UPDATE focuses SET space_id = NULL, updated_at = ? WHERE space_id = ?").run(nowIso, spaceId);
    db.prepare("DELETE FROM focus_spaces WHERE id = ?").run(spaceId);
    return affected.map((r) => r.id);
  })();
  audit.record({
    actor: "owner",
    action: "space.deleted",
    meta: { spaceId, title: exists.title, affectedFocusIds: result, affectedCount: result.length }
  });
  return {
    status: 200,
    payload: { ok: true, id: spaceId, affectedFocusIds: result, affectedCount: result.length }
  };
}

export function assignFocusSpace(
  db: Db,
  audit: AuditSink,
  focusId: string,
  body: unknown,
  nowIso: string
): ApiResponse {
  const parsed = assignBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);
  const focus = db.prepare("SELECT id FROM focuses WHERE id = ?").get(focusId);
  if (!focus) return err(404, "not_found", `focus ${focusId} not found`);
  if (parsed.data.spaceId !== null) {
    const sp = db.prepare("SELECT id FROM focus_spaces WHERE id = ?").get(parsed.data.spaceId);
    if (!sp) return err(404, "space_not_found", `space ${parsed.data.spaceId} not found`);
  }
  db.prepare("UPDATE focuses SET space_id = ?, updated_at = ? WHERE id = ?").run(
    parsed.data.spaceId,
    nowIso,
    focusId
  );
  audit.record({
    actor: "owner",
    action: "space.assigned",
    meta: { focusId, spaceId: parsed.data.spaceId }
  });
  return { status: 200, payload: { ok: true, focusId, spaceId: parsed.data.spaceId } };
}
