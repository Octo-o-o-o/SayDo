// C2 中断恢复:启动扫遗留 talking session + active activation → interrupted;
// 下次激活尾部重建 provisional 义务清单(批 1 机械渲染,不依赖 RP)。

import { newId } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { withFocusWriteTx, FocusWriteError } from "./writeTx.js";
import {
  enumerateCandidates,
  renderCloseSettlementChecklist,
  type TranscriptLine
} from "./closeSettlement.js";
import { upsertObligation, buildObligationDedupeKey } from "./obligations.js";
import type { ActivationRow } from "./rows.js";

export interface InterruptMarkReport {
  sessionsMarked: number;
  activationsInterrupted: number;
  sessionIds: string[];
  activationIds: string[];
}

/**
 * 启动恢复:上一进程遗留的 talking session(无活进程)与对应 active activation 原子标 interrupted。
 * session 终态 = suspended(可 rebuild)而非 closed(closed 禁 rebuild,C2)。
 */
export function markInterruptedOnStartup(db: Db, audit: AuditSink, nowIso?: string): InterruptMarkReport {
  const now = nowIso ?? new Date().toISOString();
  const talking = db
    .prepare("SELECT id FROM sessions WHERE state = 'talking'")
    .all() as { id: string }[];

  const sessionIds: string[] = [];
  const activationIds: string[] = [];

  const tx = db.transaction(() => {
    for (const s of talking) {
      db.prepare(
        `UPDATE sessions SET state = 'suspended', ended_at = COALESCE(ended_at, ?) WHERE id = ? AND state = 'talking'`
      ).run(now, s.id);
      sessionIds.push(s.id);

      const acts = db
        .prepare("SELECT id, focus_id FROM focus_activations WHERE session_id = ? AND status = 'active'")
        .all(s.id) as { id: string; focus_id: string }[];
      for (const a of acts) {
        // interrupted:closedAt 必填,outputFocusRevision 必须 NULL(契约 superRefine)
        db.prepare(
          `UPDATE focus_activations SET status = 'interrupted', closed_at = ?, output_focus_revision = NULL WHERE id = ? AND status = 'active'`
        ).run(now, a.id);
        activationIds.push(a.id);

        // 审计 event(非 FocusWriteTx 全路径——恢复路径允许直接 append 以避开 authority 重读成本;
        // 仍走 withFocusWriteTx 保证 seq/事件原子)
        try {
          withFocusWriteTx(db, { now: () => new Date(now) }, (ops) => {
            ops.appendEvent(a.focus_id, {
              type: "activation_closed",
              payload: {
                activationId: a.id,
                sessionId: s.id,
                status: "interrupted"
              },
              actorKind: "daemon",
              sessionId: s.id
            });
          });
        } catch (err) {
          // authority fence 等失败仍保留 interrupted 行;审计外溢
          audit.record({
            actor: "daemon",
            action: "focus.interrupt.event_failed",
            meta: {
              activationId: a.id,
              focusId: a.focus_id,
              error: String(err instanceof Error ? err.message : err).slice(0, 160)
            }
          });
        }
      }
    }
  });
  tx();

  const report: InterruptMarkReport = {
    sessionsMarked: sessionIds.length,
    activationsInterrupted: activationIds.length,
    sessionIds,
    activationIds
  };
  audit.record({
    actor: "daemon",
    action: "focus.interrupt.startup_mark",
    meta: {
      sessionsMarked: report.sessionsMarked,
      activationsInterrupted: report.activationsInterrupted
    }
  });
  return report;
}

export interface UnsettledInterrupted {
  activationId: string;
  focusId: string;
  sessionId: string;
  startedAt: string;
  closedAt: string | null;
}

/** interrupted(及历史扫描)且无对应 committed CloseSettlement 的 activation */
export function listUnsettledInterruptedActivations(db: Db, focusId: string): UnsettledInterrupted[] {
  const rows = db
    .prepare(
      `SELECT a.* FROM focus_activations a
       WHERE a.focus_id = ?
         AND a.status = 'interrupted'
         AND NOT EXISTS (
           SELECT 1 FROM focus_close_settlements s
           WHERE s.activation_id = a.id AND s.phase = 'committed'
         )
       ORDER BY a.started_at`
    )
    .all(focusId) as ActivationRow[];
  return rows.map((r) => ({
    activationId: r.id,
    focusId: r.focus_id,
    sessionId: r.session_id,
    startedAt: r.started_at,
    closedAt: r.closed_at
  }));
}

export interface RebuildProvisionalResult {
  activationId: string;
  provisionalCount: number;
  degradedNoTranscript: boolean;
  checklist: string;
  obligationIds: string[];
}

/**
 * 对 unsettled interrupted activation 从转写尾部重建 provisional 义务(verification=provisional)。
 * 用户确认后才走正常 upsert 路径;本函数在激活流程中直接落 provisional 候选义务。
 */
export function rebuildProvisionalFromInterrupted(
  db: Db,
  input: {
    focusId: string;
    activationId: string;
    sessionId: string;
    transcriptLines: TranscriptLine[];
    storeTranscript: boolean;
    /** true=只渲染清单不写义务(呈现后等用户确认) */
    dryRun?: boolean;
  },
  opts: { actorKind?: "user" | "daemon" | "brain_proposal" } = {}
): RebuildProvisionalResult {
  const unsettled = listUnsettledInterruptedActivations(db, input.focusId).find(
    (u) => u.activationId === input.activationId
  );
  if (!unsettled) {
    throw new FocusWriteError("interrupt_not_found", `no unsettled interrupted activation ${input.activationId}`);
  }

  const enumerated = enumerateCandidates(db, {
    focusId: input.focusId,
    sessionId: input.sessionId,
    transcriptLines: input.transcriptLines,
    storeTranscript: input.storeTranscript
  });

  // 仅重建「新」候选(问题/承诺),不重复 touched_open
  const rebuildable = enumerated.candidates.filter((c) => c.kind !== "touched_open_obligation");
  const obligationIds: string[] = [];

  if (!input.dryRun && input.storeTranscript) {
    for (const c of rebuildable) {
      const r = upsertObligation(db, input.focusId, {
        kind: c.kind === "unanswered_user_question" ? "answer" : "action",
        title: c.title,
        ...(c.detail ? { detail: c.detail } : {}),
        owner: c.owner ?? "agent",
        status: "open",
        verification: "provisional",
        dedupeKey: c.dedupeKey,
        sourceSessionId: input.sessionId,
        ...(c.turnRef ? { sourceTurnRef: c.turnRef } : {}),
        nextStep: c.kind === "unanswered_user_question" ? "回答用户问题(中断重建)" : "兑现承诺(中断重建)",
        actorKind: opts.actorKind ?? "daemon",
        sessionId: input.sessionId
      });
      obligationIds.push(r.obligationId);
    }
  }

  const header = input.storeTranscript
    ? "上次会话中断,以下待清理"
    : "上次会话中断且无转写,无法重建";
  const body = input.storeTranscript
    ? renderCloseSettlementChecklist(rebuildable, { degradedNoTranscript: false })
    : "[转写未存,中断尾部无法重建]";
  const checklist = `${header}。${body}`;

  // 无转写时留 correction/close 类 event 痕迹
  if (!input.storeTranscript) {
    withFocusWriteTx(db, {}, (ops) => {
      ops.appendEvent(input.focusId, {
        type: "correction",
        payload: {
          note: `interrupted activation ${input.activationId}: no transcript, rebuild skipped`
        },
        actorKind: "daemon",
        sessionId: input.sessionId
      });
    });
  }

  return {
    activationId: input.activationId,
    provisionalCount: input.dryRun || !input.storeTranscript ? rebuildable.length : obligationIds.length,
    degradedNoTranscript: !input.storeTranscript,
    checklist,
    obligationIds
  };
}

/** 激活前钩:扫描 unsettled interrupted,全部 dryRun 渲染合并清单(批 1 自足) */
export function buildInterruptedCleanupPresentation(
  db: Db,
  focusId: string,
  loadTranscript: (sessionId: string) => { lines: TranscriptLine[]; storeTranscript: boolean }
): { items: RebuildProvisionalResult[]; combinedChecklist: string } {
  const unsettled = listUnsettledInterruptedActivations(db, focusId);
  const items: RebuildProvisionalResult[] = [];
  for (const u of unsettled) {
    const t = loadTranscript(u.sessionId);
    items.push(
      rebuildProvisionalFromInterrupted(
        db,
        {
          focusId,
          activationId: u.activationId,
          sessionId: u.sessionId,
          transcriptLines: t.lines,
          storeTranscript: t.storeTranscript,
          dryRun: true
        },
        {}
      )
    );
  }
  if (items.length === 0) {
    return { items, combinedChecklist: "" };
  }
  const combinedChecklist = items.map((i) => i.checklist).join("\n");
  return { items, combinedChecklist };
}

/** 测试辅助:构造稳定 dedupe(与收场同源) */
export function provisionalDedupeKey(focusId: string, kind: "answer" | "action", sourceKey: string): string {
  return buildObligationDedupeKey({ focusId, kind, sourceKey });
}

/** 生成合成 activation id(仅测试) */
export function newActivationId(): string {
  return newId("fac");
}
