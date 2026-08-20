// 语音确认词表环(接线批任务③ + 执行器批 S2 上浮;10 §2.5 审批级 utterance 防线 + 09 §14-A2 最小形态)。
// Focus Contract v0.3.3 批 1:DB-authoritative pending + 三元 digest + 消费同事务(§5.1/§6/§6.1)。
// 词表匹配在 daemon 状态机侧(单源 confirmVocab),不信 Brain 转述——ASR 幻觉/模型自由发挥都进不了审批;
// presentation(sentenceId<->receiptId)被 barge-in 作废后裸肯定不消费,必须重播(PresentationStore)。
// 两类 pending(payload 判别):dispatch(派发收据,accept 后派发链由 dialog 注入)/
// runtime_effect(执行中 S2 审批,10 #19;accept/reject 由 RuntimeApprovalFlow 承接)。

import { createHash } from "node:crypto";
import {
  FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION,
  confirmationDowngradePayloadSchema,
  jcsSerialize,
  newId,
  parseFocusEventPayload,
  remainingIntentJsonSchema,
  type ConfirmationDowngradePayload,
  type ConfirmationOutcome,
  type ConfirmationPayloadSummary,
  type ObligationResolveEvidence,
  type RemainingIntentJson
} from "@saydo/contracts";
import { decideConfirmation } from "../approvals/confirmVocab.js";
import { PresentationStore } from "../approvals/presentation.js";
import type { ReadinessCandidate } from "../evaluator/readinessBinding.js";
import type { ProjectAnchorCandidate } from "../projects/anchor.js";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { computeConfirmBaselineString, maxFocusEventSeq } from "../focus/baseline.js";
import {
  downgradeExpiredConfirmation,
  upsertAbandonedDowngradeAlert,
  withFocusWriteTx
} from "../focus/writeTx.js";
import { settleExpectationAckOnOps } from "../focus/expectations.js";
import { redactForSpeech } from "../voice/redactor.js";

/** Focus 义务候选项(单数/批量共用形状) */
export type FocusObligationItem = {
  kind: "answer" | "decision" | "action" | "followup" | "check";
  title: string;
  detail?: string;
  owner: "human" | "agent" | "external";
  dedupeKey: string;
  nextStep?: string;
  verification?: "provisional" | "unverified" | "confirmed";
  needs?: "decision" | "input" | "action" | "unknown";
  /** L4b 归线 / K5 排队 / L1 已决记档即结 */
  laneId?: string;
  waitingOnObligationId?: string;
  waitingOn?: string;
  alreadyDecided?: boolean;
};

/** C3 Focus 确认载荷(走 FocusWriteTx 消费端,不进 dispatch 分支) */
export type FocusPendingPayload =
  | {
      kind: "focus_anchor";
      focusId: string;
      /** 提案时 session.focus_anchor_revision,消费前 CAS */
      expectedAnchorRevision: number;
      title: string;
      trigger?: "user_explicit" | "session_open_suggest" | "reopen";
    }
  | {
      kind: "focus_obligation";
      focusId: string;
      /** 单数形态(既有);与 obligations 二选一 */
      obligation?: FocusObligationItem;
      /** ④c 批量复数形态;与 obligation 二选一;消费端全有或全无 */
      obligations?: FocusObligationItem[];
    }
  | {
      kind: "focus_obligation_resolve";
      focusId: string;
      obligationId: string;
      obligationTitle: string;
      obKind: "answer" | "decision" | "action" | "followup" | "check";
      obOwner: "human" | "agent" | "external";
      obVerification: "provisional" | "unverified" | "confirmed";
      obDedupeKey: string;
      resolution: "done" | "abandoned" | "no_longer_applicable";
      /** ④e A7:agent+done 时消费端写门校验;human/external 可省略 */
      evidence?: ObligationResolveEvidence;
    }
  | {
      kind: "focus_create_anchor";
      title: string;
      expectedAnchorRevision: number;
    }
  | {
      kind: "focus_revision";
      focusId: string;
      currentDirection: string;
      lastReliableState: string;
      nextActivationTrigger?: string;
    }
  | {
      kind: "focus_lane_split";
      focusId: string;
      lanes: Array<{
        title: string;
        parentLaneId: string | null;
        obligationIds: string[];
      }>;
      baseline: {
        focusRevision: number;
        eventHWM: number;
        obligationsDigest: string;
      };
    }
  | {
      /** ④d 期待调整双向确认(第 11 kind;consumer-owned finalize) */
      kind: "expectation_ack";
      focusId: string;
      expectationId: string;
      fromRevision: number;
      toRevision: number;
      summary: string;
    };

export type PendingPayload =
  | { kind: "dispatch"; packageId: string; revision: number; mode: "direct_to_review" | "step_confirm" }
  | { kind: "runtime_effect" }
  // A3-armed(09 §13/10 #41):就绪复述确认环——信息确认(这些事实对不对)≠ dispatch 授权确认;
  // candidates = 环发起时的渲染快照(确认的是用户听到的那批,accept 时不重列——防新增候选竞态)
  | { kind: "readiness"; projectId: string; candidates: ReadinessCandidate[] }
  | ProjectAnchorCandidate
  | FocusPendingPayload;

/**
 * Focus v0.4 ④a semantic classifier:consumer-owned finalize 集合 =
 * 六个 focus_* + expectation_ack(共七)。expectation_ack payload 与消费 CAS 归 ④d。
 */
export const SEMANTIC_MUTATION_KINDS = [
  "focus_anchor",
  "focus_obligation",
  "focus_obligation_resolve",
  "focus_create_anchor",
  "focus_revision",
  "focus_lane_split",
  "expectation_ack"
] as const;
export type SemanticMutationKind = (typeof SEMANTIC_MUTATION_KINDS)[number];

/** 非语义(轻终局 accept)集合——与 SEMANTIC 并集须覆盖 PendingPayload 每个 kind */
export const NON_SEMANTIC_CONFIRM_KINDS = [
  "dispatch",
  "runtime_effect",
  "readiness",
  "project_anchor"
] as const;
export type NonSemanticConfirmKind = (typeof NON_SEMANTIC_CONFIRM_KINDS)[number];

/** 有 focusId 时可写 focus_events 三事件的语义 kind(create_anchor 无 focusId 时只进 ledger) */
const FOCUS_TIMELINE_KINDS = new Set<string>([
  "focus_anchor",
  "focus_obligation",
  "focus_obligation_resolve",
  "focus_create_anchor",
  "focus_revision",
  "focus_lane_split",
  "expectation_ack"
]);

export const CONFIRM_DIGEST_VERSION = 1;
const US = "\x1f";
/** ledger 保留期(天);90 天清理跳过 downgrade_status∈{pending,failed} */
export const CONFIRMATION_LEDGER_RETENTION_DAYS = 90;
/** 同 session+focus 当日已成功降格条数上限;≥此数走聚合义务 */
export const DOWNGRADE_STORM_DAILY_LIMIT = 5;
/** 失败重试退避(ms):第 1/2/3 次失败后等待;retry_count 达 3 → abandoned */
export const DOWNGRADE_RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000] as const;
/** 重试次数上限(含);≥ 此值 abandoned */
export const DOWNGRADE_MAX_RETRIES = 3;

/**
 * 计时器 per-kind 单表(v0.4 §1):voiceAutoAcceptSec=语音倒计时自动 accept;
 * durableTtlSec=呈现环 durable TTL(原 10min)。值与既有 5s/10min 一致,行为不变。
 * expectation_ack 预留行(值同 focus_* 缺省);④d 消费。
 */
export const CONFIRM_TIMER_TABLE = {
  focus_anchor: { voiceAutoAcceptSec: 5, durableTtlSec: 600 },
  focus_obligation: { voiceAutoAcceptSec: 5, durableTtlSec: 600 },
  focus_obligation_resolve: { voiceAutoAcceptSec: 5, durableTtlSec: 600 },
  focus_create_anchor: { voiceAutoAcceptSec: 5, durableTtlSec: 600 },
  focus_revision: { voiceAutoAcceptSec: 5, durableTtlSec: 600 },
  focus_lane_split: { voiceAutoAcceptSec: 5, durableTtlSec: 600 },
  expectation_ack: { voiceAutoAcceptSec: 5, durableTtlSec: 600 }
} as const satisfies Record<
  Exclude<SemanticMutationKind, never>,
  { voiceAutoAcceptSec?: number; durableTtlSec?: number }
>;

/** 合同 §5.1:expires_at = presented_at + durable TTL(缺省 10 分钟;与 CONFIRM_TIMER_TABLE 对齐) */
export const CONFIRM_TTL_MS = 10 * 60 * 1000;

export function durableTtlMsForKind(kind: string): number {
  const row = (CONFIRM_TIMER_TABLE as Record<string, { durableTtlSec?: number } | undefined>)[kind];
  const sec = row?.durableTtlSec;
  return typeof sec === "number" ? sec * 1000 : CONFIRM_TTL_MS;
}

export function voiceAutoAcceptMsForKind(kind: string): number | undefined {
  const row = (CONFIRM_TIMER_TABLE as Record<string, { voiceAutoAcceptSec?: number } | undefined>)[kind];
  const sec = row?.voiceAutoAcceptSec;
  return typeof sec === "number" ? sec * 1000 : undefined;
}

/** sweepExpired 返回项 */
export interface ExpiredRecord {
  sessionId: string;
  receiptId: string;
  kind: string;
  focusId: string | null;
}

/** ledger 终局 outcome(与 hooks 对齐;无独立 consumed——见 confirmationOutcomeSchema 注释) */
export type LedgerFinalizeOutcome = ConfirmationOutcome;

export interface PendingConfirmation {
  receiptId: string;
  /** 确认播报句 id(presentation 锚) */
  sentenceId: string;
  /** 复读用原文(锁定档:原文重放,不重新生成——10 §3-3) */
  promptText: string;
  /** 已复读次数(unmatched 第一次复读,第二次转屏) */
  attempt: number;
  payload: PendingPayload;
  /** 三元 digest(合同 §6);present 时计算并持久化 */
  digest: string;
  digestVersion: number;
  /** present 时冻结的 baselineString(消费时重算比对) */
  baselineString: string;
  presentedAt: string;
  expiresAt: string;
}

export type ConfirmOutcome =
  | { kind: "not_pending" }
  | { kind: "accepted"; pending: PendingConfirmation }
  | { kind: "rejected"; pending: PendingConfirmation }
  | { kind: "reread"; pending: PendingConfirmation }
  | { kind: "to_screen"; pending: PendingConfirmation }
  | { kind: "invalidated_reread"; pending: PendingConfirmation }
  | { kind: "stale"; pending: PendingConfirmation };

export type ConfirmChannel =
  | "voice"
  | "click"
  | "tailnet"
  | "mobile_lan"
  | "auto"
  | "withdraw"
  | "dismiss"
  | "expired"
  | "restore";

/** F25:确认生命周期 UI 挂钩(daemon -> console 确认卡);通知失败绝不破坏审批状态机 */
export interface ConfirmationLoopHooks {
  onPresent?: (sessionId: string, pending: PendingConfirmation) => void;
  onResolve?: (
    sessionId: string,
    receiptId: string,
    outcome: "accepted" | "rejected" | "dismissed" | "to_screen" | "withdrawn" | "stale" | "expired"
  ) => void;
}

export type ConfirmDb = Pick<Db, "prepare" | "transaction">;

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** 合同 §6:digest = sha256(kind ‖US‖ jcs(payload) ‖US‖ promptText ‖US‖ baselineString) */
export function computeConfirmDigest(
  kind: string,
  payload: unknown,
  promptText: string,
  baselineString: string
): string {
  const body = kind + US + jcsSerialize(payload) + US + promptText + US + baselineString;
  return sha256Hex(body);
}

function isFocusSemanticPayload(kind: string): boolean {
  return (SEMANTIC_MUTATION_KINDS as readonly string[]).includes(kind);
}

function extractFocusId(payload: PendingPayload): string | null {
  if ("focusId" in payload && typeof payload.focusId === "string") return payload.focusId;
  return null;
}

/** title 截断至 ≤80 字(Unicode 码点) */
function truncateTitle80(title: string): string {
  const chars = Array.from(title);
  return chars.length <= 80 ? title : chars.slice(0, 80).join("");
}

/** 展开 focus_obligation 单数/复数为一组候选项 */
export function focusObligationItems(
  payload: Extract<PendingPayload, { kind: "focus_obligation" }>
): FocusObligationItem[] {
  if (payload.obligations && payload.obligations.length > 0) return payload.obligations;
  if (payload.obligation) return [payload.obligation];
  return [];
}

/** payload_summary 白名单投影(v3 R8);detail/路径/全文不进 */
export function buildPayloadSummary(payload: PendingPayload): ConfirmationPayloadSummary {
  const focusId = extractFocusId(payload);
  let title: string | undefined;
  let dedupeKey: string | undefined;
  let obligationKind: string | undefined;

  switch (payload.kind) {
    case "focus_obligation": {
      const items = focusObligationItems(payload);
      title = items.map((o) => o.title).join("、");
      dedupeKey = items.length === 1 ? items[0]!.dedupeKey : items.map((o) => o.dedupeKey).join("|");
      // focus_events summary.obligationKind 枚举无 batch;多项时用首项 kind 作代表
      obligationKind = items[0]?.kind;
      break;
    }
    case "focus_obligation_resolve":
      title = payload.obligationTitle;
      dedupeKey = payload.obDedupeKey;
      obligationKind = payload.obKind;
      break;
    case "focus_anchor":
    case "focus_create_anchor":
      title = payload.title;
      break;
    case "focus_revision":
      title = payload.currentDirection;
      break;
    case "focus_lane_split":
      title = payload.lanes.map((l) => l.title).join("、");
      break;
    case "expectation_ack":
      title = payload.summary;
      dedupeKey = `expectation_ack:${payload.expectationId}:${payload.toRevision}`;
      break;
    case "dispatch":
      title = payload.packageId;
      break;
    case "readiness":
      title = payload.projectId;
      break;
    case "project_anchor":
      title = "title" in payload && typeof payload.title === "string" ? payload.title : payload.draftId;
      break;
    case "runtime_effect":
      break;
    default: {
      // 穷尽 PendingPayload;新 kind 编译期应进 SEMANTIC/NON_SEMANTIC 登记
      const _exhaustive: never = payload;
      void _exhaustive;
    }
  }

  const summary: ConfirmationPayloadSummary = { kind: payload.kind };
  if (title !== undefined && title !== "") summary.title = truncateTitle80(title);
  if (dedupeKey) summary.dedupeKey = dedupeKey;
  if (focusId) summary.focusId = focusId;
  if (obligationKind) summary.obligationKind = obligationKind;
  return summary;
}

export function computePayloadDigest(payload: PendingPayload): string {
  return sha256Hex(jcsSerialize(payload));
}

function buildDowngradePayload(
  payload: Extract<PendingPayload, { kind: "focus_obligation" }>
): ConfirmationDowngradePayload | null {
  const items = focusObligationItems(payload);
  // 批量过期不写单条 saga payload(④c 主路径=accept 全有全无;多条过期降格留后续)
  if (items.length !== 1) return null;
  const o = items[0]!;
  return {
    owner: o.owner,
    ...(o.needs ? { needs: o.needs } : {}),
    kind: o.kind,
    title: o.title,
    ...(o.detail ? { detail: o.detail } : {}),
    ...(o.verification ? { verification: o.verification } : {}),
    ...(o.nextStep ? { nextStep: o.nextStep } : {}),
    ...(o.laneId ? { laneId: o.laneId } : {}),
    dedupeKey: o.dedupeKey
  };
}

/** remainingIntent 正文上限(字/码点)+ redactForSpeech 同源脱敏 */
export const REMAINING_INTENT_MAX_CHARS = 300;

export function buildRemainingIntentJson(text: string, sourceTurnId: string): RemainingIntentJson {
  const redacted = redactForSpeech(text).text;
  const chars = Array.from(redacted);
  const clipped = chars.length <= REMAINING_INTENT_MAX_CHARS ? redacted : chars.slice(0, REMAINING_INTENT_MAX_CHARS).join("");
  return {
    textDigest: `sha256:${sha256Hex(clipped)}`,
    sourceTurnId,
    handled: false,
    text: clipped
  };
}

function shouldWriteFocusTimeline(kind: string, focusId: string | null): focusId is string {
  return focusId !== null && FOCUS_TIMELINE_KINDS.has(kind);
}

/**
 * confirmation_ledger 90 天清理:finalized_at 早于 cutoff 且
 * downgrade_status ∈ {n/a,done,abandoned} 才删;pending/failed 豁免(saga 行)。
 */
export function sweepConfirmationLedgerRetention(
  db: ConfirmDb,
  nowIso: string,
  retentionDays: number = CONFIRMATION_LEDGER_RETENTION_DAYS
): number {
  const cutoffMs = Date.parse(nowIso) - retentionDays * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(cutoffMs)) return 0;
  const cutoff = new Date(cutoffMs).toISOString();
  const r = db
    .prepare(
      `DELETE FROM confirmation_ledger
       WHERE finalized_at IS NOT NULL
         AND finalized_at < ?
         AND downgrade_status IN ('n/a','done','abandoned')`
    )
    .run(cutoff) as { changes: number };
  return r.changes;
}

export interface ProcessDowngradeSagasResult {
  processed: number;
  done: number;
  failed: number;
  abandoned: number;
  noop: number;
  /** ④c:本次成功降格(含 no-op 幂等补账)的 session/receipt,供控制轮 downgrade_applied */
  applied: Array<{ sessionId: string; receiptId: string; focusId: string | null }>;
}

interface LedgerDowngradeRow {
  receipt_id: string;
  session_id: string;
  focus_id: string | null;
  downgrade_status: string;
  downgrade_payload_json: string | null;
  retry_count: number;
  finalized_at: string | null;
}

/** 同 session+focus 当日已成功降格(done)计数——防风暴阈值依据 */
export function countDailyDowngradesDone(
  db: ConfirmDb,
  sessionId: string,
  focusId: string,
  dayIso: string
): number {
  const day = dayIso.slice(0, 10);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM confirmation_ledger
       WHERE session_id = ? AND focus_id = ?
         AND outcome = 'expired'
         AND kind = 'focus_obligation'
         AND downgrade_status = 'done'
         AND substr(finalized_at, 1, 10) = ?`
    )
    .get(sessionId, focusId, day) as { c: number };
  return row.c;
}

function markDowngradeDone(db: ConfirmDb, receiptId: string): void {
  db.prepare(
    `UPDATE confirmation_ledger
     SET downgrade_status = 'done',
         downgrade_payload_json = NULL,
         next_retry_at = NULL
     WHERE receipt_id = ?`
  ).run(receiptId);
}

function markDowngradeFailed(
  db: ConfirmDb,
  receiptId: string,
  retryCount: number,
  nextRetryAt: string | null,
  abandoned: boolean
): void {
  if (abandoned) {
    db.prepare(
      `UPDATE confirmation_ledger
       SET downgrade_status = 'abandoned',
           downgrade_payload_json = NULL,
           retry_count = ?,
           next_retry_at = NULL
       WHERE receipt_id = ?`
    ).run(retryCount, receiptId);
  } else {
    db.prepare(
      `UPDATE confirmation_ledger
       SET downgrade_status = 'failed',
           retry_count = ?,
           next_retry_at = ?
       WHERE receipt_id = ?`
    ).run(retryCount, nextRetryAt, receiptId);
  }
}

/**
 * Focus v0.4 ④b:降格 saga 驱动。
 * 处理 downgrade_status='pending'(崩溃窗续跑)与 'failed' 且 next_retry_at 到期。
 * 成功→done+清 payload;失败→failed+retry;retry_count≥3→abandoned+告警义务。
 * 防风暴:同 session+focus 当日 done≥5 走 batch 聚合义务。
 */
export function processDowngradeSagas(
  db: Db,
  nowIso: string,
  audit: AuditSink | null = null
): ProcessDowngradeSagasResult {
  const result: ProcessDowngradeSagasResult = {
    processed: 0,
    done: 0,
    failed: 0,
    abandoned: 0,
    noop: 0,
    applied: []
  };
  const rows = db
    .prepare(
      `SELECT receipt_id, session_id, focus_id, downgrade_status, downgrade_payload_json,
              retry_count, finalized_at
       FROM confirmation_ledger
       WHERE downgrade_status = 'pending'
          OR (downgrade_status = 'failed'
              AND next_retry_at IS NOT NULL
              AND next_retry_at <= ?)
       ORDER BY finalized_at ASC, receipt_id ASC`
    )
    .all(nowIso) as LedgerDowngradeRow[];

  for (const row of rows) {
    result.processed += 1;
    try {
      if (!row.focus_id || !row.downgrade_payload_json) {
        // 无 focus 或 payload 丢失:无法降格,直接 abandoned+audit
        const nextCount = row.retry_count + 1;
        markDowngradeFailed(db, row.receipt_id, Math.max(nextCount, DOWNGRADE_MAX_RETRIES), null, true);
        result.abandoned += 1;
        try {
          audit?.record({
            actor: "daemon",
            action: "confirm.downgrade_abandoned",
            meta: {
              receiptId: row.receipt_id,
              reason: !row.focus_id ? "missing_focus_id" : "missing_payload",
              retryCount: Math.max(nextCount, DOWNGRADE_MAX_RETRIES)
            }
          });
        } catch {
          // ignore
        }
        continue;
      }

      let payload: ConfirmationDowngradePayload;
      try {
        payload = confirmationDowngradePayloadSchema.parse(JSON.parse(row.downgrade_payload_json));
      } catch (err) {
        const nextCount = Math.max(row.retry_count + 1, DOWNGRADE_MAX_RETRIES);
        markDowngradeFailed(db, row.receipt_id, nextCount, null, true);
        result.abandoned += 1;
        try {
          audit?.record({
            actor: "daemon",
            action: "confirm.downgrade_abandoned",
            meta: {
              receiptId: row.receipt_id,
              reason: "invalid_payload",
              error: String(err).slice(0, 120)
            }
          });
        } catch {
          // ignore
        }
        continue;
      }

      const day = nowIso.slice(0, 10);
      const doneToday = countDailyDowngradesDone(db, row.session_id, row.focus_id, day);
      const useBatch = doneToday >= DOWNGRADE_STORM_DAILY_LIMIT;

      const dr = downgradeExpiredConfirmation(db, {
        receiptRef: row.receipt_id,
        payload,
        focusId: row.focus_id,
        sessionId: row.session_id,
        useBatch,
        batchDate: day,
        now: () => new Date(nowIso)
      });

      if (dr.ok) {
        // Focus 已写(含 no-op 幂等)→ 补账 ledger done(崩溃窗二闭合)
        markDowngradeDone(db, row.receipt_id);
        result.done += 1;
        if (dr.noop) result.noop += 1;
        result.applied.push({
          sessionId: row.session_id,
          receiptId: row.receipt_id,
          focusId: row.focus_id
        });
        continue;
      }

      // 结构化失败:retry / abandon
      const nextCount = row.retry_count + 1;
      if (nextCount >= DOWNGRADE_MAX_RETRIES) {
        markDowngradeFailed(db, row.receipt_id, nextCount, null, true);
        result.abandoned += 1;
        try {
          audit?.record({
            actor: "daemon",
            action: "confirm.downgrade_abandoned",
            meta: {
              receiptId: row.receipt_id,
              focusId: row.focus_id,
              code: dr.code,
              message: dr.message.slice(0, 160),
              retryCount: nextCount
            }
          });
        } catch {
          // ignore
        }
        // 告警义务(attention 可见)
        try {
          upsertAbandonedDowngradeAlert(db, {
            focusId: row.focus_id,
            sessionId: row.session_id,
            receiptRef: row.receipt_id,
            now: () => new Date(nowIso)
          });
        } catch {
          // ignore;audit 已留锚
        }
      } else {
        const backoff = DOWNGRADE_RETRY_BACKOFF_MS[nextCount - 1] ?? DOWNGRADE_RETRY_BACKOFF_MS[2]!;
        const nextRetryAt = new Date(Date.parse(nowIso) + backoff).toISOString();
        markDowngradeFailed(db, row.receipt_id, nextCount, nextRetryAt, false);
        result.failed += 1;
        try {
          audit?.record({
            actor: "daemon",
            action: "confirm.downgrade_failed",
            meta: {
              receiptId: row.receipt_id,
              focusId: row.focus_id,
              code: dr.code,
              message: dr.message.slice(0, 160),
              retryCount: nextCount,
              nextRetryAt
            }
          });
        } catch {
          // ignore
        }
      }
    } catch (err) {
      // 单条异常不阻断余量
      try {
        audit?.record({
          actor: "daemon",
          action: "confirm.downgrade_saga_error",
          meta: {
            receiptId: row.receipt_id,
            error: String(err).slice(0, 160)
          }
        });
      } catch {
        // ignore
      }
      const nextCount = row.retry_count + 1;
      if (nextCount >= DOWNGRADE_MAX_RETRIES) {
        markDowngradeFailed(db, row.receipt_id, nextCount, null, true);
        result.abandoned += 1;
      } else {
        const backoff = DOWNGRADE_RETRY_BACKOFF_MS[nextCount - 1] ?? DOWNGRADE_RETRY_BACKOFF_MS[2]!;
        const nextRetryAt = new Date(Date.parse(nowIso) + backoff).toISOString();
        markDowngradeFailed(db, row.receipt_id, nextCount, nextRetryAt, false);
        result.failed += 1;
      }
    }
  }
  return result;
}

class LightFinalizeRaceError extends Error {
  constructor() {
    super("confirm.lightFinalize race: pending already consumed");
    this.name = "LightFinalizeRaceError";
  }
}

function baselineArgs(payload: PendingPayload): {
  kind: string;
  focusId?: string | undefined;
  title?: string | undefined;
} {
  const focusId = extractFocusId(payload);
  const title = "title" in payload ? String((payload as { title?: string }).title ?? "") : undefined;
  return {
    kind: payload.kind,
    ...(focusId ? { focusId } : {}),
    ...(title !== undefined ? { title } : {})
  };
}

function resolveUiOutcome(
  outcome: "accepted" | "rejected" | "dismissed" | "to_screen" | "withdrawn" | "stale" | "expired"
): Parameters<NonNullable<ConfirmationLoopHooks["onResolve"]>>[2] {
  return outcome;
}

export class ConfirmationLoop {
  private readonly bySession = new Map<string, PendingConfirmation>();
  /** session 内 accept 预占:阻断并发通道(词表/click/auto) */
  private readonly holding = new Map<string, string>(); // sessionId -> receiptId
  readonly presentations = new PresentationStore();

  constructor(
    private readonly hooks: ConfirmationLoopHooks = {},
    private readonly db: ConfirmDb | null = null,
    private readonly audit: AuditSink | null = null
  ) {}

  private nowIso(): string {
    return new Date().toISOString();
  }

  private notifyResolve(
    sessionId: string,
    receiptId: string,
    outcome: Parameters<NonNullable<ConfirmationLoopHooks["onResolve"]>>[2]
  ): void {
    try {
      this.hooks.onResolve?.(sessionId, receiptId, outcome);
    } catch {
      // UI 通知失败不上抛
    }
  }

  private auditConsumed(
    sessionId: string,
    receiptId: string,
    outcome: string,
    channel: ConfirmChannel
  ): void {
    try {
      this.audit?.record({
        actor: "daemon",
        action: "confirm.consumed",
        meta: { sessionId, receiptId, outcome, channel }
      });
    } catch {
      // audit 失败不上抛
    }
  }

  /**
   * 事务内 DELETE pending + ledger 终局 accepted + 可选 focus_events(合同 §6.1 commitConsume)。
   * 须在调用方 DB 事务内调用(与 FocusWriteTx mutation 同事务)。
   * changes==1 断言。
   *
   * outcome 映射:Focus 语义 mutation 消费完成写 ledger outcome='accepted'
   * (无独立 'consumed' 值;与非 Focus lightFinalize accepted 同字面)。
   */
  commitConsume(sessionId: string, receiptId: string): void {
    if (!this.db) return;
    const r = this.db
      .prepare("DELETE FROM pending_confirmations WHERE session_id = ? AND receipt_id = ?")
      .run(sessionId, receiptId) as { changes: number };
    if (r.changes !== 1) {
      throw new Error(`confirm.commitConsume CAS failed: changes=${r.changes} session=${sessionId} receipt=${receiptId}`);
    }
    const pending = this.bySession.get(sessionId);
    const payload = pending && pending.receiptId === receiptId ? pending.payload : null;
    const now = this.nowIso();
    this.finalizeLedgerInTx({
      receiptId,
      outcome: "accepted",
      finalizedAt: now,
      payload,
      sessionId
    });
  }

  /**
   * 事务成功后:清内存预占 + presentation + notifyResolve + audit。
   * 调用方保证 commitConsume 已在事务内成功。
   */
  finalizeAccepted(sessionId: string, receiptId: string, channel: ConfirmChannel = "voice"): void {
    const cur = this.bySession.get(sessionId);
    if (cur && cur.receiptId === receiptId) {
      this.bySession.delete(sessionId);
      this.presentations.withdraw(sessionId, receiptId);
    }
    this.holding.delete(sessionId);
    this.notifyResolve(sessionId, receiptId, "accepted");
    this.auditConsumed(sessionId, receiptId, "accepted", channel);
  }

  /** 事务失败:释放预占,pending 行与内存完整保留(用户可重答) */
  releaseHold(sessionId: string): void {
    this.holding.delete(sessionId);
  }

  /** 是否 Focus 域语义 mutation 确认(需 hold→commitConsume 路径) */
  static isFocusSemanticKind(kind: string): boolean {
    return isFocusSemanticPayload(kind);
  }

  /** 事务内写 confirmation_presented 事件(有 focusId 的六 focus_*);返回后 HWM 已前进 */
  private appendConfirmFocusEvent(
    focusId: string,
    type: "confirmation_presented" | "confirmation_settled" | "confirmation_expired",
    body: {
      receiptRef: string;
      kind: string;
      outcome?: LedgerFinalizeOutcome;
      summary?: ConfirmationPayloadSummary;
    },
    sessionId: string | undefined,
    nowIso: string
  ): void {
    if (!this.db) return;
    const maxRow = this.db
      .prepare("SELECT MAX(seq) AS m FROM focus_events WHERE focus_id = ?")
      .get(focusId) as { m: number | null } | undefined;
    const seq = (maxRow?.m ?? 0) + 1;
    const summary =
      body.summary ?
        {
          ...(body.summary.title !== undefined ? { title: body.summary.title } : {}),
          ...(body.summary.dedupeKey !== undefined ? { dedupeKey: body.summary.dedupeKey } : {}),
          ...(body.summary.obligationKind !== undefined
            ? {
                obligationKind: body.summary.obligationKind as
                  | "answer"
                  | "decision"
                  | "action"
                  | "followup"
                  | "check"
              }
            : {})
        }
      : undefined;
    const payload =
      type === "confirmation_presented"
        ? {
            payloadSchemaVersion: FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION,
            receiptRef: body.receiptRef,
            kind: body.kind,
            ...(summary && Object.keys(summary).length > 0 ? { summary } : {})
          }
        : type === "confirmation_settled"
          ? {
              payloadSchemaVersion: FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION,
              receiptRef: body.receiptRef,
              kind: body.kind,
              outcome: body.outcome ?? "accepted",
              ...(summary && Object.keys(summary).length > 0 ? { summary } : {})
            }
          : {
              payloadSchemaVersion: FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION,
              receiptRef: body.receiptRef,
              kind: body.kind,
              ...(summary && Object.keys(summary).length > 0 ? { summary } : {})
            };
    parseFocusEventPayload(type, payload);
    const id = newId("fev");
    this.db
      .prepare(
        `INSERT INTO focus_events(id, focus_id, seq, type, payload_schema_version, payload_json, actor_kind, session_id, turn_ref, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'daemon', ?, NULL, ?)`
      )
      .run(id, focusId, seq, type, FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION, JSON.stringify(payload), sessionId ?? null, nowIso);
    this.db.prepare("UPDATE focuses SET updated_at = ? WHERE id = ?").run(nowIso, focusId);
  }

  /** 事务内 ledger 终局(outcome IS NULL CAS);expired+focus_obligation 写降格 pending */
  private finalizeLedgerInTx(args: {
    receiptId: string;
    outcome: LedgerFinalizeOutcome;
    finalizedAt: string;
    payload: PendingPayload | null;
    sessionId?: string;
  }): void {
    if (!this.db) return;
    let downgradeStatus: string | null = null;
    let downgradeJson: string | null = null;
    if (args.outcome === "expired" && args.payload?.kind === "focus_obligation") {
      const dg = buildDowngradePayload(args.payload);
      if (dg) {
        downgradeStatus = "pending";
        downgradeJson = JSON.stringify(dg);
      }
    }
    const r = this.db
      .prepare(
        `UPDATE confirmation_ledger
         SET outcome = ?, finalized_at = ?,
             downgrade_status = CASE WHEN ? IS NOT NULL THEN ? ELSE downgrade_status END,
             downgrade_payload_json = CASE WHEN ? IS NOT NULL THEN ? ELSE downgrade_payload_json END
         WHERE receipt_id = ? AND outcome IS NULL`
      )
      .run(
        args.outcome,
        args.finalizedAt,
        downgradeStatus,
        downgradeStatus ?? "n/a",
        downgradeJson,
        downgradeJson,
        args.receiptId
      ) as { changes: number };
    if (r.changes !== 1) return; // 已终局或无行(pre-v26 恢复路径)

    const kind = args.payload?.kind;
    const focusId = args.payload ? extractFocusId(args.payload) : null;
    if (kind && shouldWriteFocusTimeline(kind, focusId)) {
      const summary = args.payload ? buildPayloadSummary(args.payload) : undefined;
      const eventType =
        args.outcome === "expired" ? ("confirmation_expired" as const) : ("confirmation_settled" as const);
      this.appendConfirmFocusEvent(
        focusId,
        eventType,
        {
          receiptRef: args.receiptId,
          kind,
          outcome: args.outcome,
          ...(summary ? { summary } : {})
        },
        args.sessionId,
        args.finalizedAt
      );
    }
  }

  private insertLedgerPresentedInTx(
    sessionId: string,
    p: PendingConfirmation,
    summary: ConfirmationPayloadSummary,
    focusId: string | null,
    remainingIntentJson: string | null = null
  ): void {
    if (!this.db) return;
    this.db
      .prepare(
        `INSERT INTO confirmation_ledger(
          receipt_id, kind, outcome, payload_summary_json, payload_digest,
          session_id, focus_id, presented_at, finalized_at,
          downgrade_status, downgrade_payload_json, retry_count, next_retry_at, remaining_intent_json
        ) VALUES (?,?,NULL,?,?,?,?,?,NULL,'n/a',NULL,0,NULL,?)`
      )
      .run(
        p.receiptId,
        p.payload.kind,
        JSON.stringify(summary),
        computePayloadDigest(p.payload),
        sessionId,
        focusId,
        p.presentedAt,
        remainingIntentJson
      );
  }

  /**
   * ④c:控制轮注入成功后同事务语义——置 handled=true 并清 text 只留 digest。
   * 无行/已 handled/JSON 坏 → no-op 不抛。
   */
  markRemainingIntentHandled(receiptId: string): void {
    if (!this.db) return;
    const row = this.db
      .prepare(`SELECT remaining_intent_json FROM confirmation_ledger WHERE receipt_id = ?`)
      .get(receiptId) as { remaining_intent_json: string | null } | undefined;
    if (!row?.remaining_intent_json) return;
    let parsed: RemainingIntentJson;
    try {
      parsed = remainingIntentJsonSchema.parse(JSON.parse(row.remaining_intent_json));
    } catch {
      return;
    }
    if (parsed.handled) return;
    const next: RemainingIntentJson = {
      textDigest: parsed.textDigest,
      sourceTurnId: parsed.sourceTurnId,
      handled: true
    };
    this.db
      .prepare(`UPDATE confirmation_ledger SET remaining_intent_json = ? WHERE receipt_id = ?`)
      .run(JSON.stringify(next), receiptId);
  }

  /** 读 ledger remaining_intent(测试/控制轮 payload 用);handled 后 text 已清 */
  readRemainingIntent(receiptId: string): RemainingIntentJson | null {
    if (!this.db) return null;
    const row = this.db
      .prepare(`SELECT remaining_intent_json FROM confirmation_ledger WHERE receipt_id = ?`)
      .get(receiptId) as { remaining_intent_json: string | null } | undefined;
    if (!row?.remaining_intent_json) return null;
    try {
      return remainingIntentJsonSchema.parse(JSON.parse(row.remaining_intent_json));
    } catch {
      return null;
    }
  }

  private insertPendingRowInTx(sessionId: string, p: PendingConfirmation, focusId: string | null): void {
    if (!this.db) return;
    this.db
      .prepare(
        `INSERT INTO pending_confirmations(
          session_id, receipt_id, kind, prompt_text, payload_json, digest, digest_version,
          sentence_id, attempt, focus_id, presented_at, expires_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        sessionId,
        p.receiptId,
        p.payload.kind,
        p.promptText,
        JSON.stringify(p.payload),
        p.digest,
        p.digestVersion,
        p.sentenceId,
        p.attempt,
        focusId,
        p.presentedAt,
        p.expiresAt
      );
  }

  /**
   * 轻终局(reject/dismiss/withdraw/expired/stale/to_screen 与非 Focus accept):
   * DELETE pending + ledger 终局同事务;内存态在提交后变更。无 mutation 原子性需求。
   */
  private lightFinalize(
    sessionId: string,
    pending: PendingConfirmation,
    outcome: LedgerFinalizeOutcome,
    channel: ConfirmChannel
  ): void {
    if (this.db) {
      try {
        const run = this.db.transaction(() => {
          const r = this.db!
            .prepare("DELETE FROM pending_confirmations WHERE session_id = ? AND receipt_id = ?")
            .run(sessionId, pending.receiptId) as { changes: number };
          // changes==0 可能已被并发通道消费;不写 ledger 终局、不重复 notify
          if (r.changes === 0 && outcome !== "expired") {
            throw new LightFinalizeRaceError();
          }
          // ④d:rejected/withdrawn → pending_ack 行 supersede;dismissed/to_screen/stale/expired 行保留
          const pl = pending.payload;
          if (pl.kind === "expectation_ack" && (outcome === "rejected" || outcome === "withdrawn")) {
            withFocusWriteTx(this.db as Db, {}, (ops) => {
              settleExpectationAckOnOps(ops, {
                focusId: pl.focusId,
                expectationId: pl.expectationId,
                fromRevision: pl.fromRevision,
                toRevision: pl.toRevision,
                outcome: outcome === "rejected" ? "rejected" : "withdrawn",
                receiptRef: pending.receiptId,
                sessionId
              });
            });
          }
          // expired 且 changes==0:仍尝试 ledger 终局(restore 路径可能已删 pending)
          this.finalizeLedgerInTx({
            receiptId: pending.receiptId,
            outcome,
            finalizedAt: this.nowIso(),
            payload: pending.payload,
            sessionId
          });
        });
        run();
      } catch (err) {
        if (err instanceof LightFinalizeRaceError) {
          this.bySession.delete(sessionId);
          this.holding.delete(sessionId);
          this.presentations.withdraw(sessionId, pending.receiptId);
          return;
        }
        // 事务失败=零半态:pending 保留、ledger 无终局残行
        throw err;
      }
    }
    this.bySession.delete(sessionId);
    this.holding.delete(sessionId);
    this.presentations.withdraw(sessionId, pending.receiptId);
    this.notifyResolve(sessionId, pending.receiptId, resolveUiOutcome(outcome));
    this.auditConsumed(sessionId, pending.receiptId, outcome, channel);
  }

  private updateReplayRow(sessionId: string, sentenceId: string, attempt: number): void {
    if (!this.db) return;
    this.db
      .prepare("UPDATE pending_confirmations SET sentence_id = ?, attempt = ? WHERE session_id = ?")
      .run(sentenceId, attempt, sessionId);
  }

  private buildPending(p: Omit<PendingConfirmation, "attempt" | "digest" | "digestVersion" | "baselineString" | "presentedAt" | "expiresAt"> & {
    attempt?: number;
    digest?: string;
    digestVersion?: number;
    baselineString?: string;
    presentedAt?: string;
    expiresAt?: string;
  }): PendingConfirmation {
    const presentedAt = p.presentedAt ?? this.nowIso();
    const ttl = durableTtlMsForKind(p.payload.kind);
    const expiresAt = p.expiresAt ?? new Date(Date.parse(presentedAt) + ttl).toISOString();
    const baselineString =
      p.baselineString ?? computeConfirmBaselineString(this.db as Db | null, baselineArgs(p.payload));
    const digest =
      p.digest ??
      computeConfirmDigest(p.payload.kind, p.payload, p.promptText, baselineString);
    return {
      receiptId: p.receiptId,
      sentenceId: p.sentenceId,
      promptText: p.promptText,
      attempt: p.attempt ?? 1,
      payload: p.payload,
      digest,
      digestVersion: p.digestVersion ?? CONFIRM_DIGEST_VERSION,
      baselineString,
      presentedAt,
      expiresAt
    };
  }

  /**
   * 签发确认(issueDispatchReceipt 后调用方登记;同 session 新确认顶掉旧的)。
   * 合同 §5.1:present 先落库后呈现;pending 持久化与 ledger presented 同事务;
   * 有 focusId 的 focus_* 另写 confirmation_presented 后重算 digest(吸收 HWM 前进)。
   * INSERT 失败抛错(调用方 tts_unavailable 路径承接);内存态在事务成功后变更。
   */
  present(
    sessionId: string,
    p: Omit<PendingConfirmation, "attempt" | "digest" | "digestVersion" | "baselineString" | "presentedAt" | "expiresAt"> & {
      attempt?: number;
      digest?: string;
      digestVersion?: number;
      baselineString?: string;
      presentedAt?: string;
      expiresAt?: string;
      /** ④c:Brain 显式携带的剩余诉求(随确认入 ledger,不进 pending payload digest) */
      remainingIntent?: string;
      remainingIntentSourceTurnId?: string;
    }
  ): void {
    const remainingIntentRaw =
      typeof p.remainingIntent === "string" && p.remainingIntent.trim() !== ""
        ? p.remainingIntent
        : undefined;
    const remainingSourceTurnId = p.remainingIntentSourceTurnId ?? "";
    // 剥除非 PendingConfirmation 字段再 build
    const { remainingIntent: _ri, remainingIntentSourceTurnId: _rst, ...pendingInput } = p;
    void _ri;
    void _rst;
    let pending = this.buildPending(pendingInput);
    if (this.db) {
      const run = this.db.transaction(() => {
        // 顶替:旧 pending 删前 ledger 标 withdrawn(有 ledger 行时)
        const old = this.db!
          .prepare(
            `SELECT receipt_id, kind, payload_json FROM pending_confirmations WHERE session_id = ?`
          )
          .get(sessionId) as { receipt_id: string; kind: string; payload_json: string } | undefined;
        if (old && old.receipt_id !== pending.receiptId) {
          let oldPayload: PendingPayload | null = null;
          try {
            oldPayload = JSON.parse(old.payload_json) as PendingPayload;
          } catch {
            oldPayload = null;
          }
          this.db!.prepare("DELETE FROM pending_confirmations WHERE session_id = ?").run(sessionId);
          this.finalizeLedgerInTx({
            receiptId: old.receipt_id,
            outcome: "withdrawn",
            finalizedAt: this.nowIso(),
            payload: oldPayload,
            sessionId
          });
        } else if (old) {
          this.db!.prepare("DELETE FROM pending_confirmations WHERE session_id = ?").run(sessionId);
        }

        const focusId = extractFocusId(pending.payload);
        const summary = buildPayloadSummary(pending.payload);
        this.insertPendingRowInTx(sessionId, pending, focusId);
        const riJson =
          remainingIntentRaw && remainingSourceTurnId
            ? JSON.stringify(buildRemainingIntentJson(remainingIntentRaw, remainingSourceTurnId))
            : remainingIntentRaw
              ? JSON.stringify(buildRemainingIntentJson(remainingIntentRaw, "unknown"))
              : null;
        this.insertLedgerPresentedInTx(sessionId, pending, summary, focusId, riJson);

        // confirmation_presented 会抬 HWM → 同事务内重算 digest,避免 accept 时误 stale;
        // lane_split 等自带 baseline 的 payload 同步 eventHWM,否则消费端 assertBaseline 必 stale
        if (shouldWriteFocusTimeline(pending.payload.kind, focusId)) {
          this.appendConfirmFocusEvent(
            focusId,
            "confirmation_presented",
            { receiptRef: pending.receiptId, kind: pending.payload.kind, summary },
            sessionId,
            pending.presentedAt
          );
          let payload = pending.payload;
          if (payload.kind === "focus_lane_split") {
            const newHwm = maxFocusEventSeq(this.db as Db, focusId);
            payload = {
              ...payload,
              baseline: { ...payload.baseline, eventHWM: newHwm }
            };
          }
          const baselineString = computeConfirmBaselineString(this.db as Db, baselineArgs(payload));
          const digest = computeConfirmDigest(
            payload.kind,
            payload,
            pending.promptText,
            baselineString
          );
          pending = { ...pending, payload, baselineString, digest };
          this.db!
            .prepare(
              `UPDATE pending_confirmations SET digest = ?, payload_json = ? WHERE session_id = ? AND receipt_id = ?`
            )
            .run(digest, JSON.stringify(payload), sessionId, pending.receiptId);
        }
      });
      run();
    }
    // 顶替旧内存 pending(含旧 presentation)——仅事务成功后
    const prev = this.bySession.get(sessionId);
    if (prev && prev.receiptId !== pending.receiptId) {
      this.presentations.withdraw(sessionId, prev.receiptId);
    }
    this.holding.delete(sessionId);
    this.bySession.set(sessionId, pending);
    this.presentations.present(sessionId, pending.receiptId, pending.sentenceId);
    try {
      this.hooks.onPresent?.(sessionId, pending);
    } catch {
      // UI 通知失败不上抛
    }
    try {
      this.audit?.record({
        actor: "daemon",
        action: "confirm.presented",
        meta: {
          sessionId,
          receiptId: pending.receiptId,
          kind: pending.payload.kind,
          digest: pending.digest,
          digestVersion: pending.digestVersion
        }
      });
    } catch {
      // ignore
    }
  }

  /**
   * 不抢占登记(执行中 S2 上浮用):session 已有 pending ⇒ 返回 false。
   * 库 INSERT 失败也返回 false(不呈现)。
   */
  tryPresent(
    sessionId: string,
    p: Omit<PendingConfirmation, "attempt" | "digest" | "digestVersion" | "baselineString" | "presentedAt" | "expiresAt"> & {
      attempt?: number;
      remainingIntent?: string;
      remainingIntentSourceTurnId?: string;
    }
  ): boolean {
    if (this.bySession.has(sessionId)) return false;
    if (this.holding.has(sessionId)) return false;
    try {
      this.present(sessionId, p);
      return true;
    } catch {
      return false;
    }
  }

  /** 主动撤下 pending(收据已被屏幕侧/超时终局时,语音环不再等待答复) */
  withdraw(sessionId: string, receiptId: string): void {
    const cur = this.bySession.get(sessionId);
    if (cur && cur.receiptId === receiptId) {
      this.lightFinalize(sessionId, cur, "withdrawn", "withdraw");
    }
  }

  /** barge-in:作废当前 presentation(随后裸肯定不消费,必须重播——A8) */
  invalidateOnBargeIn(sessionId: string, nowIso: string): void {
    this.presentations.invalidateOnBargeIn(sessionId, nowIso);
  }

  pending(sessionId: string): PendingConfirmation | undefined {
    return this.bySession.get(sessionId);
  }

  /** 会话级意图(如收场)优先于 pending 确认:撤下当前确认(不算裁决),返回被撤项供 audit */
  dismiss(sessionId: string): PendingConfirmation | undefined {
    const pending = this.bySession.get(sessionId);
    if (!pending) return undefined;
    this.lightFinalize(sessionId, pending, "dismissed", "dismiss");
    return pending;
  }

  /** 懒过期:consume 入口先查;过期则终局并返回 true(调用方当 not_pending) */
  private expireIfNeeded(sessionId: string, nowIso: string): boolean {
    const pending = this.bySession.get(sessionId);
    if (!pending) return false;
    if (pending.expiresAt >= nowIso) return false;
    this.lightFinalize(sessionId, pending, "expired", "expired");
    try {
      this.audit?.record({
        actor: "daemon",
        action: "confirm.expired",
        meta: { sessionId, receiptId: pending.receiptId }
      });
    } catch {
      // ignore
    }
    return true;
  }

  /**
   * 到点驱动过期扫(v0.4 §1):逐 session 执行既有懒过期逻辑;逐条即逐事务,
   * 单条失败 audit 告警不阻塞余量。scheduler 经回调注入调用。
   * ④b:返回后由调用方紧随 processDowngradeSagas(本方法不隐式跑 saga,便于测试隔离)。
   */
  sweepExpired(nowIso: string): ExpiredRecord[] {
    const expired: ExpiredRecord[] = [];
    for (const [sessionId, pending] of [...this.bySession.entries()]) {
      if (pending.expiresAt >= nowIso) continue;
      try {
        this.lightFinalize(sessionId, pending, "expired", "expired");
        try {
          this.audit?.record({
            actor: "daemon",
            action: "confirm.expired",
            meta: { sessionId, receiptId: pending.receiptId, channel: "sweep" }
          });
        } catch {
          // ignore
        }
        expired.push({
          sessionId,
          receiptId: pending.receiptId,
          kind: pending.payload.kind,
          focusId: extractFocusId(pending.payload)
        });
      } catch (err) {
        try {
          this.audit?.record({
            actor: "daemon",
            action: "confirm.sweep_expired_failed",
            meta: {
              sessionId,
              receiptId: pending.receiptId,
              error: String(err).slice(0, 160)
            }
          });
        } catch {
          // ignore
        }
      }
    }
    return expired;
  }

  /**
   * ④b:对 pending/到期 failed 降格行跑 saga(崩溃恢复 + 重试)。
   * 需要真实 Db(FocusWriteTx);ConfirmDb mock 时跳过。
   */
  processDowngradeSagas(nowIso: string): ProcessDowngradeSagasResult {
    if (!this.db || typeof (this.db as Db).transaction !== "function") {
      return { processed: 0, done: 0, failed: 0, abandoned: 0, noop: 0, applied: [] };
    }
    return processDowngradeSagas(this.db as Db, nowIso, this.audit);
  }

  private recheckDigest(pending: PendingConfirmation): boolean {
    const baseline = computeConfirmBaselineString(this.db as Db | null, baselineArgs(pending.payload));
    const dig = computeConfirmDigest(pending.payload.kind, pending.payload, pending.promptText, baseline);
    return dig === pending.digest && baseline === pending.baselineString;
  }

  /**
   * accept 预占 + baseline 复核(合同 §6.1)。
   * Focus 域:仅预占,返回 accepted,待消费端 commitConsume。
   * 非 Focus 域:轻终局 accept 后返回(既有 CAS 各自负责;无共事务则按轻终局)。
   */
  private tryAccept(sessionId: string, pending: PendingConfirmation, channel: ConfirmChannel): ConfirmOutcome {
    if (this.holding.has(sessionId) && this.holding.get(sessionId) !== pending.receiptId) {
      return { kind: "not_pending" };
    }
    if (this.holding.get(sessionId) === pending.receiptId) {
      // 已预占:幂等返回 accepted(并发第二通道)
      return { kind: "accepted", pending };
    }
    // 预占
    this.holding.set(sessionId, pending.receiptId);
    if (!this.recheckDigest(pending)) {
      this.holding.delete(sessionId);
      this.lightFinalize(sessionId, pending, "stale", channel);
      return { kind: "stale", pending };
    }
    if (isFocusSemanticPayload(pending.payload.kind)) {
      // 预占保留,不删 DB/内存
      return { kind: "accepted", pending };
    }
    // 非 Focus:轻终局 accept(mutation 由调用方既有路径处理)
    this.lightFinalize(sessionId, pending, "accepted", channel);
    return { kind: "accepted", pending };
  }

  /**
   * 消费一轮用户答复(asr.final 先经此环;有 pending 时该轮是审批裁决轮,不进对话环):
   * - presentation 已作废 ⇒ 不裁决,重播(新 presentation 同收据);
   * - 词表 accept ⇒ accepted(Focus 预占;非 Focus 轻终局);
   * - reject / reread / to_screen 同既有语义。
   */
  consumeReply(sessionId: string, reply: string, replaySentenceId: string): ConfirmOutcome {
    if (this.expireIfNeeded(sessionId, this.nowIso())) return { kind: "not_pending" };
    const pending = this.bySession.get(sessionId);
    if (!pending) return { kind: "not_pending" };
    if (this.holding.has(sessionId) && this.holding.get(sessionId) !== pending.receiptId) {
      return { kind: "not_pending" };
    }
    const gate = this.presentations.canConsumeByBareYes(sessionId, pending.receiptId);
    if (!gate.ok) {
      // F05:作废态下否定词仍消费(拒绝为安全方向)
      const eager = decideConfirmation(reply, pending.attempt);
      if (eager.action === "reject") {
        this.lightFinalize(sessionId, pending, "rejected", "voice");
        return { kind: "rejected", pending };
      }
      this.presentations.prepareReplay(sessionId, pending.receiptId, replaySentenceId);
      const next = { ...pending, sentenceId: replaySentenceId };
      this.bySession.set(sessionId, next);
      this.updateReplayRow(sessionId, replaySentenceId, next.attempt);
      return { kind: "invalidated_reread", pending: next };
    }
    const d = decideConfirmation(reply, pending.attempt);
    if (d.action === "accept") {
      return this.tryAccept(sessionId, pending, "voice");
    }
    if (d.action === "reject") {
      this.lightFinalize(sessionId, pending, "rejected", "voice");
      return { kind: "rejected", pending };
    }
    if (d.action === "reread") {
      const next = { ...pending, attempt: pending.attempt + 1, sentenceId: replaySentenceId };
      this.bySession.set(sessionId, next);
      this.presentations.prepareReplay(sessionId, pending.receiptId, replaySentenceId);
      this.updateReplayRow(sessionId, replaySentenceId, next.attempt);
      return { kind: "reread", pending: next };
    }
    // to_screen
    this.lightFinalize(sessionId, pending, "to_screen", "voice");
    return { kind: "to_screen", pending };
  }

  /**
   * console 点击消费(合同 §6 confirm.click)。
   * digest 与库行/内存不等 → stale。
   */
  consumeClick(
    sessionId: string,
    receiptId: string,
    digest: string,
    decision: "accept" | "reject"
  ): ConfirmOutcome {
    if (this.expireIfNeeded(sessionId, this.nowIso())) return { kind: "not_pending" };
    const pending = this.bySession.get(sessionId);
    if (!pending || pending.receiptId !== receiptId) return { kind: "not_pending" };
    if (this.holding.has(sessionId) && this.holding.get(sessionId) !== receiptId) {
      return { kind: "not_pending" };
    }
    if (digest !== pending.digest) {
      this.lightFinalize(sessionId, pending, "stale", "click");
      return { kind: "stale", pending };
    }
    if (decision === "reject") {
      this.lightFinalize(sessionId, pending, "rejected", "click");
      return { kind: "rejected", pending };
    }
    return this.tryAccept(sessionId, pending, "click");
  }

  /**
   * 倒计时自动 accept(channel=auto)。
   * 仅 Focus 语义确认使用;非 Focus 不经此路径。
   */
  consumeAutoAccept(sessionId: string, receiptId: string): ConfirmOutcome {
    if (this.expireIfNeeded(sessionId, this.nowIso())) return { kind: "not_pending" };
    const pending = this.bySession.get(sessionId);
    if (!pending || pending.receiptId !== receiptId) return { kind: "not_pending" };
    return this.tryAccept(sessionId, pending, "auto");
  }

  /** 调用方确认新确认句已进入在线 TTS peer 后，才重新允许封闭肯定消费。 */
  armReplay(sessionId: string, receiptId: string, sentenceId: string): boolean {
    const pending = this.bySession.get(sessionId);
    if (!pending || pending.receiptId !== receiptId || pending.sentenceId !== sentenceId) return false;
    this.presentations.replay(sessionId, receiptId, sentenceId);
    return true;
  }

  /**
   * 启动恢复(合同 §5.1 #3):扫表重建未过期 pending + 重发 confirm.card;
   * 过期行删除 + audit confirm.expired。
   */
  restoreFromDb(now: () => Date = () => new Date()): { restored: number; expired: number } {
    if (!this.db) return { restored: 0, expired: 0 };
    const nowIso = now().toISOString();
    const rows = this.db
      .prepare(
        `SELECT session_id, receipt_id, kind, prompt_text, payload_json, digest, digest_version,
                sentence_id, attempt, focus_id, presented_at, expires_at
         FROM pending_confirmations`
      )
      .all() as Array<{
      session_id: string;
      receipt_id: string;
      kind: string;
      prompt_text: string;
      payload_json: string;
      digest: string;
      digest_version: number;
      sentence_id: string;
      attempt: number;
      focus_id: string | null;
      presented_at: string;
      expires_at: string;
    }>;
    let restored = 0;
    let expired = 0;
    for (const row of rows) {
      if (row.expires_at < nowIso) {
        let payload: PendingPayload | null = null;
        try {
          payload = JSON.parse(row.payload_json) as PendingPayload;
        } catch {
          payload = null;
        }
        try {
          const run = this.db.transaction(() => {
            this.db!.prepare("DELETE FROM pending_confirmations WHERE session_id = ?").run(row.session_id);
            this.finalizeLedgerInTx({
              receiptId: row.receipt_id,
              outcome: "expired",
              finalizedAt: nowIso,
              payload,
              sessionId: row.session_id
            });
          });
          run();
        } catch {
          // 单条恢复失败不阻塞
        }
        try {
          this.audit?.record({
            actor: "daemon",
            action: "confirm.expired",
            meta: { sessionId: row.session_id, receiptId: row.receipt_id, channel: "restore" }
          });
        } catch {
          // ignore
        }
        expired += 1;
        continue;
      }
      let payload: PendingPayload;
      try {
        payload = JSON.parse(row.payload_json) as PendingPayload;
      } catch {
        this.db.prepare("DELETE FROM pending_confirmations WHERE session_id = ?").run(row.session_id);
        expired += 1;
        continue;
      }
      const baselineString = computeConfirmBaselineString(this.db as Db, baselineArgs(payload));
      const pending: PendingConfirmation = {
        receiptId: row.receipt_id,
        sentenceId: row.sentence_id,
        promptText: row.prompt_text,
        attempt: row.attempt,
        payload,
        digest: row.digest,
        digestVersion: row.digest_version,
        baselineString,
        presentedAt: row.presented_at,
        expiresAt: row.expires_at
      };
      this.bySession.set(row.session_id, pending);
      this.presentations.present(row.session_id, row.receipt_id, row.sentence_id);
      try {
        this.hooks.onPresent?.(row.session_id, pending);
      } catch {
        // ignore
      }
      try {
        this.audit?.record({
          actor: "daemon",
          action: "confirm.restored",
          meta: { sessionId: row.session_id, receiptId: row.receipt_id, kind: payload.kind }
        });
      } catch {
        // ignore
      }
      restored += 1;
    }
    return { restored, expired };
  }
}
