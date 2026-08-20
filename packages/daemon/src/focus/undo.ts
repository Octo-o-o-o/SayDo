// E2 双速直通(义骁 2026-08-04 拍板 C 变体)的撤销侧:最近一次 Focus 语义操作可语音撤回。
// 栈深 1、TTL 5 分钟;undo 本身走 correction 语义(append-only 不删行)。
import type { Db } from "../storage/db.js";
import { upsertObligation } from "./obligations.js";
import { closeActivation, startActivation, getActiveActivationForSession } from "./activation.js";
import { changeFocusLifecycle } from "./registry.js";

export type UndoEntry =
  | { kind: "obligation_open"; focusId: string; dedupeKey: string; obKind: string; title: string; owner: string; verification: string; at: number }
  | { kind: "obligation_resolve"; focusId: string; dedupeKey: string; obKind: string; title: string; owner: string; at: number }
  | { kind: "anchor"; focusId: string; prevFocusId: string | null; at: number }
  | { kind: "create_anchor"; focusId: string; title: string; prevFocusId: string | null; at: number };

const TTL_MS = 5 * 60 * 1000;
const stack = new Map<string, UndoEntry>();

export function recordUndo(sessionId: string, entry: UndoEntry): void {
  stack.set(sessionId, entry);
}

export function undoLastFocusAction(db: Db, sessionId: string): { ok: boolean; spoken: string } {
  const e = stack.get(sessionId);
  if (!e || Date.now() - e.at > TTL_MS) return { ok: false, spoken: "最近没有可撤销的操作。" };
  stack.delete(sessionId);
  if (e.kind === "obligation_open") {
    upsertObligation(db, e.focusId, {
      kind: e.obKind as "answer" | "decision" | "action" | "followup" | "check",
      title: e.title,
      owner: e.owner as "human" | "agent" | "external",
      status: "superseded",
      verification: e.verification as "provisional" | "unverified" | "confirmed",
      dedupeKey: e.dedupeKey,
      resolution: "superseded",
      actorKind: "user",
      sessionId
    });
    return { ok: true, spoken: `好,撤回了——「${e.title}」作废了。` };
  }
  if (e.kind === "obligation_resolve") {
    upsertObligation(db, e.focusId, {
      kind: e.obKind as "answer" | "decision" | "action" | "followup" | "check",
      title: e.title,
      owner: e.owner as "human" | "agent" | "external",
      status: "open",
      verification: "confirmed",
      dedupeKey: e.dedupeKey,
      actorKind: "user",
      sessionId
    });
    return { ok: true, spoken: `好,撤回了——「${e.title}」重新记回账上。` };
  }
  if (e.kind === "anchor" || e.kind === "create_anchor") {
    const act = getActiveActivationForSession(db, sessionId);
    if (act && act.focusId === e.focusId) {
      closeActivation(db, { activationId: act.id, sessionId, focusId: e.focusId });
    }
    if (e.kind === "create_anchor") {
      changeFocusLifecycle(db, e.focusId, { to: "abandoned", actorKind: "user", sessionId });
    }
    if (e.prevFocusId) {
      const prevRow = db
        .prepare("SELECT focus_anchor_revision FROM sessions WHERE id = ?")
        .get(sessionId) as { focus_anchor_revision: number } | undefined;
      startActivation(db, {
        focusId: e.prevFocusId,
        sessionId,
        trigger: "reopen",
        expectedAnchorRevision: prevRow?.focus_anchor_revision ?? 0,
        resumeSource: "state_direct",
        actorKind: "user"
      });
      return { ok: true, spoken: e.kind === "create_anchor" ? "好,撤回了——新 Focus 已放弃,接回原来的。" : "好,撤回了——接回原来的 Focus。" };
    }
    return { ok: true, spoken: e.kind === "create_anchor" ? "好,撤回了——新 Focus 已放弃。" : "好,撤回了——这场对话不再接在那个 Focus 上。" };
  }
  return { ok: false, spoken: "最近没有可撤销的操作。" };
}
