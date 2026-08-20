// Focus registry + resolver + lifecycle(实施计划 B1)。

import type {
  Focus,
  FocusLifecycle,
  FocusResolveResult,
  FocusSemanticAuthority
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { focusFromRow, type FocusRow } from "./rows.js";
import {
  withFocusWriteTx,
  type FocusWriteTxOptions,
  type CreateFocusInput,
  type LifecycleChangeInput
} from "./writeTx.js";

export type ResolveFocusOptions = {
  /** shadow 期外部查询期望 authority;不匹配 → authority_mismatch */
  expectedAuthority?: FocusSemanticAuthority;
  /** 为 true 时 closed/abandoned 仍以 found 返回(内部工具用);默认走 closed_or_abandoned 判别 */
  includeTerminal?: boolean;
};

/**
 * resolveFocus(focus_id):单次 PK lookup,判别返回。
 * 禁止按活跃度静默选中——title 匹配另见 listFocusCandidatesByTitle。
 */
export function resolveFocus(db: Db, focusId: string, opts: ResolveFocusOptions = {}): FocusResolveResult {
  const row = db.prepare("SELECT * FROM focuses WHERE id = ?").get(focusId) as FocusRow | undefined;
  if (!row) return { kind: "not_found" };
  const focus = focusFromRow(row);
  if (opts.expectedAuthority && focus.semanticAuthority !== opts.expectedAuthority) {
    return { kind: "authority_mismatch", focus, expected: opts.expectedAuthority };
  }
  if (!opts.includeTerminal && (focus.lifecycle === "closed" || focus.lifecycle === "abandoned")) {
    return { kind: "closed_or_abandoned", focus };
  }
  return { kind: "found", focus };
}

export interface FocusTitleCandidate {
  id: string;
  title: string;
  lifecycle: FocusLifecycle;
  updatedAt: string;
}

/**
 * title/语义匹配只产候选列表:多候选列出、零候选如实、禁止静默选中。
 * 调用方必须进 ConfirmationLoop 或转 console。
 */
export function listFocusCandidatesByTitle(db: Db, titleQuery: string, limit = 20): FocusTitleCandidate[] {
  const q = titleQuery.trim();
  if (!q) return [];
  const rows = db
    .prepare(
      `SELECT id, title, lifecycle, updated_at FROM focuses
       WHERE title LIKE ? ESCAPE '\\'
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .all(`%${escapeLike(q)}%`, limit) as { id: string; title: string; lifecycle: string; updated_at: string }[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    lifecycle: r.lifecycle as FocusLifecycle,
    updatedAt: r.updated_at
  }));
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function createFocus(db: Db, input: CreateFocusInput, opts: FocusWriteTxOptions = {}): { focusId: string; eventId: string } {
  return withFocusWriteTx(db, opts, (ops) => ops.createFocus(input));
}

export function changeFocusLifecycle(
  db: Db,
  focusId: string,
  input: LifecycleChangeInput,
  opts: FocusWriteTxOptions = {}
): { eventId: string } {
  return withFocusWriteTx(db, opts, (ops) => ops.changeLifecycle(focusId, input));
}

export function getFocusOrThrow(db: Db, focusId: string): Focus {
  const r = resolveFocus(db, focusId, { includeTerminal: true });
  if (r.kind === "not_found") throw new Error(`focus ${focusId} not found`);
  return r.focus;
}

/** lifecycle 合法边表(供测试/文档对账;运行时由 writeTx.assertLifecycleEdge 强制) */
export const LIFECYCLE_EDGES: ReadonlyArray<readonly [FocusLifecycle, FocusLifecycle]> = [
  ["captured", "active"],
  ["active", "dormant"],
  ["dormant", "active"],
  ["active", "closed"],
  ["active", "abandoned"],
  ["active", "archived"],
  ["archived", "active"],
  ["archived", "abandoned"],
  ["dormant", "closed"],
  ["dormant", "abandoned"],
  ["closed", "dormant"],
  ["abandoned", "dormant"]
];
