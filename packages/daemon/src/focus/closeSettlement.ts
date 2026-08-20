// CloseSettlement 状态机(实施计划 B4):纯服务层,不挂 live 链。
// frozenInputs 冻结 → 枚举 → presented → confirmed/auto_ledgered → committed 单事务
// (全元组 CAS + obligations upsert + revision settle + event + 原子关 activation + session 终态)。

import {
  jcsDigest,
  newId,
  type CloseSettlement,
  type CloseSettlementCandidate,
  type CloseSettlementDecision,
  type CloseSettlementPhase,
  type FrozenInputs
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { settlementFromRow, type SettlementRow, type ObligationRow } from "./rows.js";
import { withFocusWriteTx, FocusWriteError, type FocusWriteTxOptions } from "./writeTx.js";
import { buildObligationDedupeKey } from "./obligations.js";
import { closeActivation } from "./activation.js";
import { openObligationsDigest, maxFocusEventSeq } from "./baseline.js";

export interface TranscriptLine {
  turnId: string;
  speaker: "user" | "agent" | "system";
  text: string;
  /** heard=true 的用户轮才进入未答问题候选 */
  heard?: boolean;
}

export interface EnumerateInput {
  sinceBoundary?: string;   // E2 热修:上次 committed 收场的 transcriptBoundary(增量水位)
  sessionId: string;
  focusId: string;
  activationId: string;
  /** 转写行;store_transcript=false 时传 [] 并设 storeTranscript=false */
  transcriptLines: TranscriptLine[];
  storeTranscript?: boolean;
  actorKind?: "user" | "daemon" | "brain_proposal";
}

export interface EnumerateResult {
  settlement: CloseSettlement;
  candidates: CloseSettlementCandidate[];
  degradedNoTranscript: boolean;
}

const maxEventSeq = maxFocusEventSeq;

/**
 * 枚举候选:
 * 1) speaker=user ∧ heard=true 未答问题
 * 2) agent 承诺
 * 3) 本 session 触碰的未结义务
 * 每项稳定 candidateId。
 */
export function enumerateCandidates(
  db: Db,
  input: {
    focusId: string;
    sessionId: string;
    transcriptLines: TranscriptLine[];
    storeTranscript: boolean;
    sinceBoundary?: string;
  }
): { candidates: CloseSettlementCandidate[]; degradedNoTranscript: boolean; transcriptDigest: string | null; transcriptBoundary?: string } {
  const candidates: CloseSettlementCandidate[] = [];
  const storeTranscript = input.storeTranscript;
  let transcriptDigest: string | null = null;
  let transcriptBoundary: string | undefined;

  if (!storeTranscript) {
    // 降级:如实标注,不阻止关闭
  } else if (input.transcriptLines.length > 0) {
    transcriptDigest = jcsDigest(
      input.transcriptLines.map((l) => ({ turnId: l.turnId, speaker: l.speaker, text: l.text, heard: l.heard ?? false }))
    );
    transcriptBoundary = input.transcriptLines[input.transcriptLines.length - 1]!.turnId;

    // E2 热修(2026-08-04):增量水位——上次 committed 收场的 boundary 之前的轮不再重复枚举
    // (turnId 为 ULID 系,字典序=时间序;boundary 行本身已被上次收场处理)
    const effectiveLines = input.sinceBoundary
      ? input.transcriptLines.filter((l) => l.turnId > input.sinceBoundary!)
      : input.transcriptLines;

    for (const line of effectiveLines) {
      if (line.speaker === "user" && line.heard === true && looksLikeQuestion(line.text)) {
        // F14(E2 eval;codex 三审预言):其后已有 agent 实质回答轮(非问句)的问句视为已答,不再挂账
        const idx = input.transcriptLines.indexOf(line);
        // F29(任务3 dogfood):AI 轮落盘为整轮多句合一,轮末反问是常态对话风格——
        // 整轮 looksLikeQuestion 会把带反问的实质回答误判为问句,已答判定形同虚设;
        // 改为"该轮含实质陈述句"(切句后任一非问句长句)即算回答
        const answered = input.transcriptLines
          .slice(idx + 1)
          .find(
            (l) =>
              l.speaker === "agent" &&
              hasSubstantiveStatement(l.text) &&
              !looksLikeCommitment(l.text) && // 承诺是新义务不是答案(B4 语义)
              l.text.trim().length > 4
          );
        if (answered) continue;
        const dedupeKey = buildObligationDedupeKey({
          focusId: input.focusId,
          kind: "answer",
          sourceKey: `turn:${line.turnId}`
        });
        candidates.push({
          candidateId: `cand:q:${line.turnId}`,
          kind: "unanswered_user_question",
          title: truncate(line.text, 120),
          detail: line.text,
          turnRef: line.turnId,
          dedupeKey,
          owner: "agent"
        });
      }
      if (line.speaker === "agent" && looksLikeCommitment(line.text)) {
        const dedupeKey = buildObligationDedupeKey({
          focusId: input.focusId,
          kind: "action",
          sourceKey: `commit:${line.turnId}`
        });
        candidates.push({
          candidateId: `cand:c:${line.turnId}`,
          kind: "agent_commitment",
          title: truncate(line.text, 120),
          detail: line.text,
          turnRef: line.turnId,
          dedupeKey,
          owner: "agent"
        });
      }
    }
  }

  // 触碰的未结义务:source_session_id = 本 session,或全部未结(收场范围=本 focus 未结)
  const openRows = db
    .prepare(
      `SELECT * FROM focus_obligations WHERE focus_id = ? AND status IN ('open','in_progress','waiting','deferred','blocked')
       ORDER BY id`
    )
    .all(input.focusId) as ObligationRow[];
  for (const o of openRows) {
    // 本 session 触碰 或 无 source 的既有未结
    if (o.source_session_id && o.source_session_id !== input.sessionId) continue;
    candidates.push({
      candidateId: `cand:o:${o.id}`,
      kind: "touched_open_obligation",
      title: o.title,
      ...(o.detail ? { detail: o.detail } : {}),
      obligationId: o.id,
      dedupeKey: o.dedupe_key,
      owner: o.owner as CloseSettlementCandidate["owner"]
    });
  }

  return {
    candidates,
    degradedNoTranscript: !storeTranscript,
    transcriptDigest,
    ...(transcriptBoundary !== undefined ? { transcriptBoundary } : {})
  };
}

function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /[?？]/.test(t) || /^(什么|怎么|为何|为什么|是否|能否|可以吗|哪)/.test(t);
}

function looksLikeCommitment(text: string): boolean {
  const t = text.trim();
  return /(我会|我来|稍后|下次|记得|一定|保证|跟进|会处理)/.test(t);
}

/** F29:整轮 text 切句后存在非问句实质陈述(len>4)即视为"有回答内容" */
function hasSubstantiveStatement(text: string): boolean {
  return text
    .split(/[。;;!!\n]/)
    .some((s) => {
      const t = s.trim();
      return t.length > 4 && !/[??]/.test(t) && !/^(什么|怎么|为何|为什么|是否|能否|可以吗|哪)/.test(t);
    });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/** 机械渲染清单(confirmReadiness 模式) */
export function renderCloseSettlementChecklist(
  candidates: CloseSettlementCandidate[],
  opts?: { degradedNoTranscript?: boolean; mode?: "ask" | "auto" }
): string {
  // F28/F24 族(任务3 dogfood):auto=stage2 自动结算路径(idle/显式挂起),话术必须陈述式——
  // 问句+不等回答直接挂起是"假征询",扣人又失信;ask 仅 stage1 presented(真等用户答)
  const auto = opts?.mode === "auto";
  const parts: string[] = [];
  if (opts?.degradedNoTranscript) {
    parts.push("[转写未存,未答问题枚举不可用]");
  }
  if (candidates.length === 0) {
    parts.push(auto ? "这轮没有要留的事。" : "这轮没有要留的事。确认收尾吗?");
    return parts.join(" ");
  }
  const items = candidates.map((c, i) => `${i + 1}.${c.title}`).join("; ");
  parts.push(
    auto
      ? `我把 ${candidates.length} 件事留到下次:${items}。回来随时接着办。`
      : `收尾清单(共${candidates.length}件):${items}。——逐件确认,或先放着?`
  );
  return parts.join(" ");
}

function lastCommittedBoundary(db: Db, sessionId: string): string | null {
  const row = db
    .prepare(
      `SELECT json_extract(frozen_inputs_json,'$.transcriptBoundary') AS b FROM focus_close_settlements
       WHERE session_id = ? AND phase = 'committed' ORDER BY created_at DESC LIMIT 1`
    )
    .get(sessionId) as { b: string | null } | undefined;
  return row?.b ?? null;
}

function nextCloseAttempt(db: Db, sessionId: string): number {
  const r = db
    .prepare("SELECT MAX(close_attempt) AS m FROM focus_close_settlements WHERE session_id = ?")
    .get(sessionId) as { m: number | null };
  return (r.m ?? 0) + 1;
}

function assertActivationAnchor(db: Db, activationId: string, sessionId: string, focusId: string): void {
  const row = db.prepare("SELECT session_id, focus_id, status FROM focus_activations WHERE id = ?").get(activationId) as
    | { session_id: string; focus_id: string; status: string }
    | undefined;
  if (!row) throw new FocusWriteError("activation_not_found", `activation ${activationId} not found`);
  if (row.session_id !== sessionId || row.focus_id !== focusId) {
    throw new FocusWriteError(
      "activation_anchor_mismatch",
      `CloseSettlement.activationId must point to active activation of same session+focus`
    );
  }
  if (row.status !== "active") {
    throw new FocusWriteError("activation_not_active", `activation status=${row.status}, expected active`);
  }
}

/**
 * 枚举 → phase=enumerated。idempotencyKey=sessionId:closeAttempt。
 */
export function enumerateCloseSettlement(
  db: Db,
  input: EnumerateInput,
  opts: FocusWriteTxOptions = {}
): EnumerateResult {
  return withFocusWriteTx(db, opts, (ops) => {
    ops.getFocus(input.focusId);
    assertActivationAnchor(db, input.activationId, input.sessionId, input.focusId);

    const storeTranscript = input.storeTranscript !== false;
    const enumerated = enumerateCandidates(db, {
      focusId: input.focusId,
      sessionId: input.sessionId,
      transcriptLines: input.transcriptLines,
      storeTranscript,
      ...(lastCommittedBoundary(db, input.sessionId) !== null
        ? { sinceBoundary: lastCommittedBoundary(db, input.sessionId)! }
        : {})
    });

    const focus = ops.getFocus(input.focusId);
    const session = db
      .prepare("SELECT focus_anchor_revision FROM sessions WHERE id = ?")
      .get(input.sessionId) as { focus_anchor_revision: number } | undefined;
    if (!session) throw new FocusWriteError("session_not_found", `session ${input.sessionId} not found`);

    const frozenInputs: FrozenInputs = {
      focusRevision: focus.current_revision,
      eventHighWatermark: maxEventSeq(db, input.focusId),
      obligationsDigest: openObligationsDigest(db, input.focusId),
      sessionFocusAnchorRevision: session.focus_anchor_revision,
      ...(enumerated.transcriptBoundary !== undefined ? { transcriptBoundary: enumerated.transcriptBoundary } : {}),
      transcriptDigest: enumerated.transcriptDigest
    };

    const closeAttempt = nextCloseAttempt(db, input.sessionId);
    const idempotencyKey = `${input.sessionId}:${closeAttempt}`;
    const id = newId("fcs");
    const candidatesJson = JSON.stringify(enumerated.candidates);

    // 已有活跃 settlement → 拒(部分唯一索引也会拒)
    const active = db
      .prepare(
        `SELECT id FROM focus_close_settlements WHERE session_id = ? AND phase NOT IN ('committed','conflict')`
      )
      .get(input.sessionId) as { id: string } | undefined;
    if (active) {
      throw new FocusWriteError("settlement_active", `session already has active settlement ${active.id}`);
    }

    db.prepare(
      `INSERT INTO focus_close_settlements(
        id, session_id, focus_id, activation_id, idempotency_key, close_attempt,
        frozen_inputs_json, candidates_json, phase, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'enumerated', ?, ?)`
    ).run(
      id,
      input.sessionId,
      input.focusId,
      input.activationId,
      idempotencyKey,
      closeAttempt,
      JSON.stringify(frozenInputs),
      candidatesJson,
      ops.nowIso,
      ops.nowIso
    );

    ops.appendEvent(input.focusId, {
      type: "close_settlement",
      payload: { settlementId: id, phase: "enumerated", closeAttempt },
      actorKind: input.actorKind ?? "daemon",
      sessionId: input.sessionId
    });

    const settlement = getSettlement(db, id)!;
    return {
      settlement,
      candidates: enumerated.candidates,
      degradedNoTranscript: enumerated.degradedNoTranscript
    };
  });
}

export function presentCloseSettlement(
  db: Db,
  settlementId: string,
  presentationId: string,
  opts: FocusWriteTxOptions = {}
): CloseSettlement {
  return withFocusWriteTx(db, opts, (ops) => {
    const row = mustSettlement(db, settlementId);
    if (row.phase !== "enumerated") {
      throw new FocusWriteError("settlement_phase", `present requires enumerated, got ${row.phase}`);
    }
    db.prepare(
      `UPDATE focus_close_settlements SET phase = 'presented', presentation_id = ?, updated_at = ? WHERE id = ?`
    ).run(presentationId, ops.nowIso, settlementId);
    ops.appendEvent(row.focus_id, {
      type: "close_settlement",
      payload: { settlementId, phase: "presented", closeAttempt: row.close_attempt },
      actorKind: "daemon",
      sessionId: row.session_id
    });
    return getSettlement(db, settlementId)!;
  });
}

export function confirmCloseSettlement(
  db: Db,
  settlementId: string,
  decisions: Record<string, CloseSettlementDecision>,
  opts: FocusWriteTxOptions = {}
): CloseSettlement {
  return withFocusWriteTx(db, opts, (ops) => {
    const row = mustSettlement(db, settlementId);
    if (row.phase !== "presented" && row.phase !== "enumerated") {
      throw new FocusWriteError("settlement_phase", `confirm requires presented|enumerated, got ${row.phase}`);
    }
    db.prepare(
      `UPDATE focus_close_settlements SET phase = 'confirmed', decisions_json = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify(decisions), ops.nowIso, settlementId);
    ops.appendEvent(row.focus_id, {
      type: "close_settlement",
      payload: { settlementId, phase: "confirmed", closeAttempt: row.close_attempt },
      actorKind: "user",
      sessionId: row.session_id
    });
    return getSettlement(db, settlementId)!;
  });
}

export function autoLedgerCloseSettlement(
  db: Db,
  settlementId: string,
  opts: FocusWriteTxOptions = {}
): CloseSettlement {
  return withFocusWriteTx(db, opts, (ops) => {
    const row = mustSettlement(db, settlementId);
    if (row.phase !== "presented" && row.phase !== "enumerated") {
      throw new FocusWriteError("settlement_phase", `auto_ledger requires presented|enumerated, got ${row.phase}`);
    }
    const candidates = JSON.parse(row.candidates_json) as CloseSettlementCandidate[];
    const decisions: Record<string, CloseSettlementDecision> = {};
    for (const c of candidates) {
      decisions[c.candidateId] = { disposition: "ledger" };
    }
    db.prepare(
      `UPDATE focus_close_settlements SET phase = 'auto_ledgered', decisions_json = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify(decisions), ops.nowIso, settlementId);
    ops.appendEvent(row.focus_id, {
      type: "close_settlement",
      payload: { settlementId, phase: "auto_ledgered", closeAttempt: row.close_attempt },
      actorKind: "daemon",
      sessionId: row.session_id
    });
    return getSettlement(db, settlementId)!;
  });
}

/**
 * committed: frozenInputs 全元组 CAS → obligations upsert → revision settle →
 * close_settlement event → 原子关 activation → session 终态。
 * 任一漂移 → conflict 本行,调用方应新行 closeAttempt+1。
 *
 * 注意:closeActivation 内部也开 withFocusWriteTx —— SQLite better-sqlite3 嵌套 transaction
 * 会变成 savepoint。此处直接在 ops 内联关闭,避免双入口竞态。
 */
export type CommitCloseResult =
  | { ok: true; settlement: CloseSettlement }
  | { ok: false; reason: string; settlement: CloseSettlement };

export function commitCloseSettlement(
  db: Db,
  settlementId: string,
  opts: FocusWriteTxOptions & { sessionTerminalState?: string } = {}
): CommitCloseResult {
  return withFocusWriteTx(db, opts, (ops) => {
    const row = mustSettlement(db, settlementId);
    if (row.phase !== "confirmed" && row.phase !== "auto_ledgered") {
      throw new FocusWriteError("settlement_phase", `commit requires confirmed|auto_ledgered, got ${row.phase}`);
    }

    const frozen = JSON.parse(row.frozen_inputs_json) as FrozenInputs;
    const cas = casFrozenInputs(db, row.focus_id, row.session_id, frozen);
    if (!cas.ok) {
      // conflict 是终态留痕:必须提交本事务,不得 throw 回滚
      db.prepare(
        `UPDATE focus_close_settlements SET phase = 'conflict', updated_at = ? WHERE id = ?`
      ).run(ops.nowIso, settlementId);
      ops.appendEvent(row.focus_id, {
        type: "close_settlement",
        payload: { settlementId, phase: "conflict", closeAttempt: row.close_attempt },
        actorKind: "daemon",
        sessionId: row.session_id
      });
      return { ok: false as const, reason: cas.reason, settlement: getSettlement(db, settlementId)! };
    }

    assertActivationAnchor(db, row.activation_id, row.session_id, row.focus_id);

    const candidates = JSON.parse(row.candidates_json) as CloseSettlementCandidate[];
    const decisions = (row.decisions_json ? JSON.parse(row.decisions_json) : {}) as Record<
      string,
      CloseSettlementDecision
    >;

    for (const c of candidates) {
      const d = decisions[c.candidateId] ?? { disposition: "ledger" as const };
      if (d.disposition === "skip" || d.disposition === "answered" || d.disposition === "abandoned") {
        // answered/abandoned/skip 不新建义务;已有义务 abandoned 在 disposition=abandoned 时 resolve
        if (d.disposition === "abandoned" && c.obligationId) {
          const existing = db.prepare("SELECT * FROM focus_obligations WHERE id = ?").get(c.obligationId) as
            | ObligationRow
            | undefined;
          if (existing && ["open", "in_progress", "waiting", "deferred", "blocked"].includes(existing.status)) {
            ops.upsertObligation(row.focus_id, {
              id: existing.id,
              kind: existing.kind as "answer",
              title: existing.title,
              owner: existing.owner as "human",
              status: "resolved",
              verification: existing.verification as "confirmed",
              dedupeKey: existing.dedupe_key,
              resolution: "abandoned",
              blocking: existing.blocking === 1,
              actorKind: "user",
              sessionId: row.session_id
            });
          }
        }
        continue;
      }
      // ledger: 新义务或保持触碰义务
      if (c.kind === "touched_open_obligation") continue;
      ops.upsertObligation(row.focus_id, {
        kind: c.kind === "unanswered_user_question" ? "answer" : "action",
        title: c.title,
        ...(c.detail ? { detail: c.detail } : {}),
        owner: c.owner ?? "agent",
        status: "open",
        verification: "provisional",
        dedupeKey: c.dedupeKey,
        sourceSessionId: row.session_id,
        ...(c.turnRef ? { sourceTurnRef: c.turnRef } : {}),
        nextStep: c.kind === "unanswered_user_question" ? "回答用户问题" : "兑现承诺",
        actorKind: "daemon",
        sessionId: row.session_id
      });
    }

    // 方向保留不覆写(J14/W5——"post-close settlement"覆写用户方向的根因即此处),状态描述人话(J7)
    ops.settleRevision(row.focus_id, {
      lastReliableState: "上一场已收尾结清",
      createdBySessionId: row.session_id,
      actorKind: "daemon",
      sessionId: row.session_id
    });

    // 原子关 activation(内联,不嵌套另一 withFocusWriteTx)
    const focus = ops.getFocus(row.focus_id);
    const outputRev = focus.current_revision;
    db.prepare(
      `UPDATE focus_activations SET status = 'closed', output_focus_revision = ?, closed_at = ? WHERE id = ?`
    ).run(outputRev, ops.nowIso, row.activation_id);
    ops.appendEvent(row.focus_id, {
      type: "activation_closed",
      payload: {
        activationId: row.activation_id,
        sessionId: row.session_id,
        status: "closed",
        outputFocusRevision: outputRev
      },
      actorKind: "daemon",
      sessionId: row.session_id
    });

    // session 终态(默认 suspended;live 挂载点 M3 决定实际 state 词表)
    const terminal = opts.sessionTerminalState ?? "suspended";
    db.prepare(`UPDATE sessions SET state = ?, ended_at = COALESCE(ended_at, ?) WHERE id = ?`).run(
      terminal,
      ops.nowIso,
      row.session_id
    );

    db.prepare(
      `UPDATE focus_close_settlements SET phase = 'committed', updated_at = ? WHERE id = ?`
    ).run(ops.nowIso, settlementId);

    ops.appendEvent(row.focus_id, {
      type: "close_settlement",
      payload: { settlementId, phase: "committed", closeAttempt: row.close_attempt },
      actorKind: "daemon",
      sessionId: row.session_id
    });

    return { ok: true as const, settlement: getSettlement(db, settlementId)! };
  });
}

/**
 * conflict 后新行:closeAttempt+1,从 enumerated 重走。
 * 旧行须已是 conflict 终态。
 */
export function reenumerateAfterConflict(
  db: Db,
  previousSettlementId: string,
  transcriptLines: TranscriptLine[],
  storeTranscript: boolean,
  opts: FocusWriteTxOptions = {}
): EnumerateResult {
  const prev = mustSettlement(db, previousSettlementId);
  if (prev.phase !== "conflict") {
    throw new FocusWriteError("settlement_phase", `reenumerate requires conflict, got ${prev.phase}`);
  }
  return enumerateCloseSettlement(
    db,
    {
      sessionId: prev.session_id,
      focusId: prev.focus_id,
      activationId: prev.activation_id,
      transcriptLines,
      storeTranscript
    },
    opts
  );
}

function casFrozenInputs(
  db: Db,
  focusId: string,
  sessionId: string,
  frozen: FrozenInputs
): { ok: true } | { ok: false; reason: string } {
  const focus = db.prepare("SELECT current_revision FROM focuses WHERE id = ?").get(focusId) as
    | { current_revision: number }
    | undefined;
  if (!focus) return { ok: false, reason: "focus_missing" };
  if (focus.current_revision !== frozen.focusRevision) {
    return { ok: false, reason: `focusRevision ${focus.current_revision} != ${frozen.focusRevision}` };
  }
  // 冻结后 present/confirm/auto_ledger 会追加 close_settlement 相位事件——不算输入漂移。
  // 真正漂移 = 冻结水位之后出现非 close_settlement 的语义事件。
  const drifted = db
    .prepare(
      `SELECT id, type, seq FROM focus_events
       WHERE focus_id = ? AND seq > ? AND type != 'close_settlement'
       ORDER BY seq LIMIT 1`
    )
    .get(focusId, frozen.eventHighWatermark) as { id: string; type: string; seq: number } | undefined;
  if (drifted) {
    return {
      ok: false,
      reason: `event drift after freeze: seq=${drifted.seq} type=${drifted.type}`
    };
  }
  const dig = openObligationsDigest(db, focusId);
  if (dig !== frozen.obligationsDigest) {
    return { ok: false, reason: "obligationsDigest drift" };
  }
  const session = db.prepare("SELECT focus_anchor_revision FROM sessions WHERE id = ?").get(sessionId) as
    | { focus_anchor_revision: number }
    | undefined;
  if (!session) return { ok: false, reason: "session_missing" };
  if (session.focus_anchor_revision !== frozen.sessionFocusAnchorRevision) {
    return {
      ok: false,
      reason: `sessionFocusAnchorRevision ${session.focus_anchor_revision} != ${frozen.sessionFocusAnchorRevision}`
    };
  }
  return { ok: true };
}

function mustSettlement(db: Db, id: string): SettlementRow {
  const row = db.prepare("SELECT * FROM focus_close_settlements WHERE id = ?").get(id) as SettlementRow | undefined;
  if (!row) throw new FocusWriteError("settlement_not_found", `settlement ${id} not found`);
  return row;
}

export function getSettlement(db: Db, id: string): CloseSettlement | null {
  const row = db.prepare("SELECT * FROM focus_close_settlements WHERE id = ?").get(id) as SettlementRow | undefined;
  return row ? settlementFromRow(row) : null;
}

export function getActiveSettlementForSession(db: Db, sessionId: string): CloseSettlement | null {
  const row = db
    .prepare(
      `SELECT * FROM focus_close_settlements WHERE session_id = ? AND phase NOT IN ('committed','conflict') ORDER BY close_attempt DESC LIMIT 1`
    )
    .get(sessionId) as SettlementRow | undefined;
  return row ? settlementFromRow(row) : null;
}

/** 测试辅助:直接标 phase(仅测试库 V7 恢复模拟) */
export function forceSettlementPhaseForTest(db: Db, settlementId: string, phase: CloseSettlementPhase): void {
  db.prepare(`UPDATE focus_close_settlements SET phase = ?, updated_at = ? WHERE id = ?`).run(
    phase,
    new Date().toISOString(),
    settlementId
  );
}

// 抑制未用 import 告警:closeActivation 在 commit 内联实现,保留 re-export 给外部
export { closeActivation };
