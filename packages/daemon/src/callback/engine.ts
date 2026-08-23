// C4 回叫引擎(计划 4.4;modules/c C4;09 §6.3)。
// durable outbox + PagerDuty 式升级链(L0 语音 → L1 桌面+ntfy → L2 电话 P1)+ 免打扰/输出仲裁。
// 只认 settle 后状态(不消费原始事件);settle 四项缺一不叫(proof 齐备才写 outbox)。
// 取消/返工冻结活跃条目(superseded);重建接通第一句 = 原因;DND snooze 补叫;ack 后 resolution-timeout 重升级。

import {
  newId,
  buildDedupeKey,
  tier1MinimalProofSchema,
  type CallbackOutboxEntry,
  type OutboxTrigger,
  type Tier1MinimalProof,
  type Tier1SettleProof
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import {
  bumpOutboxEscalation,
  insertOutboxEntry,
  resolveActiveEntriesForTask,
  transitionOutbox
} from "../storage/dao/outbox.js";
import { deliveryPreflight } from "../recovery/reconciler.js";
import type { AuditSink } from "../obs/audit.js";

/** settle 证据齐备(路径一 Tier1SettleProof;缺一不叫)——回叫前必须齐备且 verify 独立通过 */
export function isSettleComplete(proof: Tier1SettleProof | undefined): proof is Tier1SettleProof {
  if (!proof) return false;
  return (
    proof.taskId !== "" &&
    proof.runId !== "" &&
    proof.treeSha !== "" &&
    proof.tier1VerifyDigest !== "" &&
    Array.isArray(proof.acceptanceChecks) &&
    proof.transcriptCursor !== ""
  );
}

export interface EnqueueInput {
  taskId: string;
  trigger: OutboxTrigger;
  packageRevision: number;
  /** occurrenceKey(09 §6.3 口径表:ready_for_review=attempt / blocked=触发 event_id / …) */
  occurrenceKey: string;
  settleProof?: Tier1SettleProof;
  /** blocked/failed 回叫的最小 settle proof(09 §9:questionId 或 exitEvidence + transcriptCursor;缺一不叫) */
  minimalProof?: Tier1MinimalProof;
  projectionCursor: string;
  artifactChecks: string[];
}

/** L0 语音 → L1 桌面+ntfy → L2 电话(P1)。S2 批 escalation 上限 1,电话 L2 未实现。 */
export const ESCALATION_CHANNELS: Record<0 | 1 | 2, string[]> = {
  0: ["voice"],
  1: ["desktop", "ntfy"],
  2: ["phone"] // P1;未接线,sweep 不升到 2
};

export class CallbackEngine {
  private readonly db: Db;
  private readonly audit: AuditSink;
  private readonly now: () => Date;
  private readonly resolutionTimeoutMin: number;

  constructor(deps: { db: Db; audit: AuditSink; now?: () => Date; resolutionTimeoutMin?: number }) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => new Date());
    this.resolutionTimeoutMin = deps.resolutionTimeoutMin ?? 30;
  }

  /**
   * settle 后入队(settle 四项缺一不叫;dedupeKey 活跃唯一由 DDL 索引兜底——重复入队被拒即幂等)。
   * ready_for_review 触发必须带齐备 settleProof;blocked/failed 必须带最小 proof
   * (09 §9:questionId 或 exitEvidence + transcriptCursor——外呼必须有可定位证据,Codex 16 6.2 回修)。
   */
  enqueue(input: EnqueueInput): { entryId: string; enqueued: boolean; reason?: string } {
    if (input.trigger === "ready_for_review" && !isSettleComplete(input.settleProof)) {
      return { entryId: "", enqueued: false, reason: "settle proof incomplete (四项缺一不叫)" };
    }
    let minimal: Tier1MinimalProof | undefined;
    if (input.trigger === "blocked" || input.trigger === "failed") {
      const parsed = tier1MinimalProofSchema.safeParse(input.minimalProof);
      if (!parsed.success) {
        return { entryId: "", enqueued: false, reason: "blocked/failed 最小 proof 缺失(questionId/exitEvidence + transcriptCursor,09 §9 缺一不叫)" };
      }
      minimal = parsed.data;
    }
    const dedupeKey = buildDedupeKey({
      taskId: input.taskId,
      trigger: input.trigger,
      packageRevision: input.packageRevision,
      occurrenceKey: input.occurrenceKey
    });
    const nowIso = this.now().toISOString();
    const entry: CallbackOutboxEntry = {
      id: newId("ntf"),
      taskId: input.taskId,
      trigger: input.trigger,
      occurrenceKey: input.occurrenceKey,
      dedupeKey,
      settleProof: {
        projectionCursor: input.projectionCursor,
        artifactChecks: input.artifactChecks,
        ...(minimal ? { minimalProof: minimal } : {}) // 结构化持久化(settle_json;09 §9)
      },
      state: "pending",
      escalationLevel: 0,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    try {
      insertOutboxEntry(this.db, entry);
    } catch (err) {
      // 只把“同一 dedupeKey 已有活跃条目”的唯一约束当幂等；磁盘、trigger、schema 等
      // 其他写失败必须继续抛出，让 settle 外层事务整体回滚，不能伪装成已在队。
      const code = typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: unknown }).code
        : undefined;
      const existing = code === "SQLITE_CONSTRAINT_UNIQUE"
        ? (this.db
            .prepare(
              "SELECT id FROM callback_outbox WHERE dedupe_key=? AND state IN ('pending','notified','acked','requeued')"
            )
            .get(dedupeKey) as { id: string } | undefined)
        : undefined;
      if (existing) {
        return { entryId: existing.id, enqueued: false, reason: "dedupe active-unique" };
      }
      throw err;
    }
    this.audit.record({ actor: "daemon", action: "callback.enqueue", meta: { entryId: entry.id, trigger: input.trigger, dedupeKey } });
    return { entryId: entry.id, enqueued: true };
  }

  /**
   * 投递成功后落 notified。DND 选路在 sweep,本方法不做窗口 snooze(避免与 sweep 双真相)。
   * 设备不可达留原状态短周期重试。
   */
  attemptNotify(
    entryId: string,
    ctx: { nowHm: string; channelReachable: boolean; escalationDelta?: number }
  ): { delivered: boolean; snoozed?: boolean; reason?: string } {
    const pf = deliveryPreflight({ nowHm: ctx.nowHm, channelReachable: ctx.channelReachable });
    const nowIso = this.now().toISOString();
    if (!pf.ok) {
      return { delivered: false, snoozed: false, ...(pf.reason ? { reason: pf.reason } : {}) };
    }
    const row = this.db.prepare("SELECT escalation FROM callback_outbox WHERE id=?").get(entryId) as
      | { escalation: number }
      | undefined;
    // S2 路径封顶 1:只有当前 escalation<1 才传 delta;DAO 仍 MIN(...,2) 预留 L2
    const requested = ctx.escalationDelta ?? 0;
    const patch =
      requested > 0 && (row?.escalation ?? 0) < 1 ? { escalationDelta: 1 as const } : {};
    transitionOutbox(this.db, entryId, "notified", nowIso, patch);
    return { delivered: true };
  }

  /** DND 已推低优先级 ntfy 后 snooze 到窗口末,状态保持 pending/requeued。 */
  snooze(entryId: string, untilIso: string): void {
    const nowIso = this.now().toISOString();
    this.db
      .prepare(
        "UPDATE callback_outbox SET snoozed_until=?, updated_at=? WHERE id=? AND state IN ('pending','requeued')"
      )
      .run(untilIso, nowIso, entryId);
  }

  /**
   * L0 语音已 notified 但应答窗未 ack:保持 notified,escalation 0→1。
   * 非状态转换(合同不允许 notified→notified,requeued 只能从 acked 进入)。
   */
  bumpUnackedToL1(entryId: string): boolean {
    return bumpOutboxEscalation(this.db, entryId, this.now().toISOString(), 1);
  }

  /** 用户接通(ack);重建接通第一句 = 原因(10 回叫纪律) */
  ack(entryId: string): void {
    transitionOutbox(this.db, entryId, "acked", this.now().toISOString());
  }

  /** 扫全部 acked 条目,resolution-timeout 到期则升级。返回本轮刚升上去的 id(sweep 随即 L1 重投)。 */
  escalateAckedIfStale(): string[] {
    const rows = this.db
      .prepare("SELECT id, acked_at FROM callback_outbox WHERE state='acked' AND acked_at IS NOT NULL")
      .all() as { id: string; acked_at: string }[];
    const ids: string[] = [];
    for (const row of rows) {
      const out = this.escalateIfStale(row.id, row.acked_at);
      if (out.escalated) ids.push(row.id);
    }
    return ids;
  }

  /**
   * ack 后 resolution-timeout 到期 ⇒ 只走到 requeued(合同允许 acked→requeued)。
   * 禁止投递成功前写 notified;sweep 对 requeued 走 L1,成功后再 attemptNotify。
   */
  escalateIfStale(entryId: string, ackedAtIso: string): { escalated: boolean; toLevel?: 1 } {
    const elapsedMin = (this.now().getTime() - new Date(ackedAtIso).getTime()) / 60_000;
    if (elapsedMin < this.resolutionTimeoutMin) return { escalated: false };
    const nowIso = this.now().toISOString();
    transitionOutbox(this.db, entryId, "requeued", nowIso);
    const row = this.db.prepare("SELECT escalation FROM callback_outbox WHERE id=?").get(entryId) as { escalation: number };
    const toLevel = Math.min(row.escalation + 1, 1) as 1;
    return { escalated: true, toLevel };
  }

  /** 用户解决 ⇒ resolved(done) */
  resolve(entryId: string): void {
    transitionOutbox(this.db, entryId, "resolved", this.now().toISOString(), { resolution: "done" });
  }

  /** 取消/返工冻结:task 全部活跃条目 superseded(不再外呼) */
  freezeForTask(taskId: string, trigger?: string): number {
    const n = resolveActiveEntriesForTask(this.db, taskId, this.now().toISOString(), trigger);
    if (n > 0) this.audit.record({ actor: "daemon", action: "callback.freeze", meta: { taskId, frozen: n, trigger } });
    return n;
  }
}

/** DND 窗口末 ISO(本地时区;跨午夜落到次日) */
export function dndWindowEnd(window: string, fallbackIso: string): string {
  const end = window.split("-")[1];
  if (!end) return fallbackIso;
  const [h, m] = end.split(":");
  const d = new Date(fallbackIso);
  d.setHours(Number(h), Number(m ?? 0), 0, 0);
  if (d.getTime() <= new Date(fallbackIso).getTime()) d.setDate(d.getDate() + 1); // 跨午夜:窗口末在次日
  return d.toISOString();
}
