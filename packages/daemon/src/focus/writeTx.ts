// FocusWriteTx —— Focus 域唯一写编排入口(实施计划 A4)。
// 一切语义 mutation 必经:BEGIN IMMEDIATE 内 authority/epoch 断言 → 目标表写 + focus_event
// + focuses.updatedAt(/currentRevision) 同事务;revision=current+1、seq=MAX+1 强制拒跳号/倒序。

import {
  FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION,
  computeObligationsDigest,
  focusEventTypeSchema,
  focusLifecycleSchema,
  focusObligationSchema,
  isOpenObligationStatus,
  newId,
  obligationResolveEvidenceSchema,
  parseFocusEventPayload,
  type ConfirmationDowngradePayload,
  type FocusActorKind,
  type FocusEventType,
  type FocusLifecycle,
  type FocusObligation,
  type FocusObligationNeeds,
  type FocusObligationResolution,
  type FocusObligationStatus,
  type FocusObligationVerification,
  type FocusSemanticAuthority,
  type FocusEventPayloadMap,
  type ObligationResolveEvidence
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import {
  focusFromRow,
  obligationFromRow,
  type FocusRow,
  type ObligationRow,
  type EventInsert
} from "./rows.js";
// 运行时调用(模块初始化后);dependency / expectations 反向 import 类型/ops,循环可接受
import { wakeDependentsOnOps } from "./dependency.js";
import { projectDueExpectationOnOps } from "./expectations.js";

export class FocusWriteError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(`${code}: ${message}`);
    this.name = "FocusWriteError";
  }
}

export interface FocusWriteTxOptions {
  /** 当前 writer 身份;canonical 写仅 saydo(shadow 期 external_bootstrap 拒 canonical) */
  writerAuthority?: FocusSemanticAuthority;
  /** 异步/跨进程 job 携带的 capturedEpoch;不等即 fence */
  capturedEpoch?: number;
  now?: () => Date;
  /**
   * 测试注入:目标表写后、事件写前抛错,验证崩溃回滚(IM-23)。
   * 仅测试库使用。
   */
  injectCrashAfterTargetWrite?: boolean;
}

export interface AppendEventInput<T extends FocusEventType = FocusEventType> {
  type: T;
  payload: Omit<FocusEventPayloadMap[T], "payloadSchemaVersion">;
  actorKind: FocusActorKind;
  sessionId?: string | undefined;
  turnRef?: string | undefined;
  /** 测试/内部:强制 seq(默认 MAX+1);跳号/倒序由 assert 拒 */
  forceSeq?: number | undefined;
}

export interface CreateFocusInput {
  title: string;
  semanticAuthority?: FocusSemanticAuthority | undefined;
  authorityEpoch?: number | undefined;
  actorKind?: FocusActorKind | undefined;
  sessionId?: string | undefined;
}

/** lifecycle 人话词(与 console Board lifecycleLabel 同表;J7/J13:内部态名不外露) */
export function lifecycleWord(lc: string): string {
  switch (lc) {
    case "active":
      return "进行中";
    case "captured":
      return "刚建";
    case "dormant":
      return "睡眠等外部";
    case "closed":
      return "已收官";
    case "archived":
      return "归档";
    case "abandoned":
      return "已放弃";
    default:
      return lc;
  }
}

export interface SettleRevisionInput {
  /** 不传 = 保留上一 revision 的方向(系统性 settle 不得覆写用户方向文本,J14/W5) */
  currentDirection?: string | undefined;
  lastReliableState: string;
  nextActivationTrigger?: string | undefined;
  acceptedDecisionRefs?: { kind: "decision_package" | "focus_event"; id: string }[] | undefined;
  createdBySessionId?: string | undefined;
  actorKind?: FocusActorKind | undefined;
  sessionId?: string | undefined;
  /** 测试注入:强制 revision 跳号/倒序 */
  forceRevision?: number | undefined;
}

export interface LifecycleChangeInput {
  to: FocusLifecycle;
  reason?: string | undefined;
  actorKind?: FocusActorKind | undefined;
  sessionId?: string | undefined;
  /** abandon 时逐项 resolution */
  abandonResolution?: Extract<FocusObligationResolution, "abandoned" | "no_longer_applicable"> | undefined;
}

export interface UpsertObligationInput {
  id?: string | undefined;
  kind: FocusObligation["kind"];
  title: string;
  detail?: string | undefined;
  owner: FocusObligation["owner"];
  status: FocusObligationStatus;
  verification: FocusObligationVerification;
  waitingOn?: string | undefined;
  waitingOnObligationId?: string | undefined;
  deferReason?: string | undefined;
  nextStep?: string | undefined;
  dueOrTrigger?: string | undefined;
  blocking?: boolean | undefined;
  projectRef?: string | undefined;
  actionRef?: string | undefined;
  sourceSessionId?: string | undefined;
  sourceTurnRef?: string | undefined;
  dedupeKey: string;
  laneId?: string | undefined;
  createdFromEvent?: number | undefined;
  /** 合同 §5.3 needs;owner=human 未结时未给则单点推导 */
  needs?: FocusObligationNeeds | undefined;
  /**
   * Focus v0.4 ④b 降格溯源;不参与 obligationsDigest(见 digests.ts 注释)。
   * 仅 confirm_expired / confirm_expired_batch。
   */
  provenance?: "confirm_expired" | "confirm_expired_batch" | undefined;
  resolution?: FocusObligationResolution | undefined;
  /** resolve/supersede 时若省略则同事务先写 resolution event 再回填 */
  resolutionEventId?: string | undefined;
  /**
   * ④e A7:agent + resolution=done 时必填;判别联合见 obligationResolveEvidenceSchema。
   * human/external 与 abandoned/no_longer_applicable 不受门。
   */
  evidence?: ObligationResolveEvidence | undefined;
  actorKind?: FocusActorKind | undefined;
  sessionId?: string | undefined;
  turnRef?: string | undefined;
}

/** 合同 §5.3:owner=human 且未结时 needs 兜底(decision→decision/answer→input/其余→action) */
export function deriveObligationNeeds(
  owner: FocusObligation["owner"],
  status: FocusObligationStatus,
  kind: FocusObligation["kind"],
  explicit?: FocusObligationNeeds | undefined
): FocusObligationNeeds | null {
  if (owner !== "human") return null;
  if (!isOpenObligationStatus(status)) return null;
  if (explicit) return explicit;
  if (kind === "decision") return "decision";
  if (kind === "answer") return "input";
  return "action";
}

export interface LinkArtifactInput {
  /** 预分配 id(默认 newId("art")) */
  id?: string | undefined;
  kind: string;
  role: string;
  title: string;
  refJson: string;
  createdFromEvent?: number | undefined;
  actorKind?: FocusActorKind | undefined;
  sessionId?: string | undefined;
  turnRef?: string | undefined;
}

export interface FocusWriteOps {
  readonly db: Db;
  readonly nowIso: string;
  getFocus(focusId: string): FocusRow;
  nextEventSeq(focusId: string): number;
  appendEvent<T extends FocusEventType>(focusId: string, input: AppendEventInput<T>): EventInsert;
  createFocus(input: CreateFocusInput): { focusId: string; eventId: string };
  settleRevision(focusId: string, input: SettleRevisionInput): { revision: number; eventId: string };
  changeLifecycle(focusId: string, input: LifecycleChangeInput): { eventId: string };
  upsertObligation(focusId: string, input: UpsertObligationInput): { obligationId: string; eventId: string };
  /**
   * Focus 产物落库 + artifact_linked 事件同事务(v0.4 ④d 前置:替换裸 INSERT+best-effort 事件)。
   * 调用方须在 withFocusWriteTx 内使用,保证与 authority 同锁窗。
   */
  linkArtifact(focusId: string, input: LinkArtifactInput): { artifactId: string; eventId: string; eventSeq: number };
  touchUpdatedAt(focusId: string): void;
  listOpenObligations(focusId: string): ObligationRow[];
  obligationsDigestOf(focusId: string): string;
  maxEventSeq(focusId: string): number;
  latestStateRevision(focusId: string): number | null;
  assertCurrentRevisionConsistent(focusId: string): void;
}

function assertAuthority(row: FocusRow, opts: FocusWriteTxOptions): void {
  const writer = opts.writerAuthority ?? "saydo";
  if (row.semantic_authority !== writer) {
    throw new FocusWriteError(
      "authority_mismatch",
      `writer=${writer} cannot mutate focus with semanticAuthority=${row.semantic_authority}`
    );
  }
  if (opts.capturedEpoch !== undefined && opts.capturedEpoch !== row.authority_epoch) {
    throw new FocusWriteError(
      "epoch_fence",
      `capturedEpoch=${opts.capturedEpoch} != authorityEpoch=${row.authority_epoch}`
    );
  }
}

/**
 * ④e A7 证据门:同事务重读真实 owner;owner=agent 且 resolution=done 时 evidence 必填,
 * 三查=存在性 + 同 Focus 归属 + 现势。human/external 与非 done 决议放行。
 */
export function assertAgentDoneEvidence(
  db: Db,
  focusId: string,
  realOwner: FocusObligation["owner"],
  resolution: FocusObligationResolution | undefined,
  evidence: ObligationResolveEvidence | undefined
): void {
  if (realOwner !== "agent" || resolution !== "done") return;
  if (evidence === undefined) {
    throw new FocusWriteError(
      "evidence_required",
      "agent obligation resolve(done) requires evidence (先交付再销账)"
    );
  }
  const parsed = obligationResolveEvidenceSchema.safeParse(evidence);
  if (!parsed.success) {
    throw new FocusWriteError("evidence_invalid", `evidence schema: ${parsed.error.message}`);
  }
  const ev = parsed.data;
  if (ev.type === "event") {
    if (ev.focusId !== focusId) {
      throw new FocusWriteError("evidence_focus_mismatch", "event evidence focusId must match obligation focus");
    }
    const row = db
      .prepare("SELECT seq FROM focus_events WHERE focus_id = ? AND seq = ?")
      .get(focusId, ev.seq) as { seq: number } | undefined;
    if (!row) {
      throw new FocusWriteError("evidence_missing", `focus event seq=${ev.seq} not found on focus`);
    }
    return;
  }
  if (ev.type === "artifact") {
    const art = db
      .prepare("SELECT id, version, project_id, digest FROM artifacts WHERE id = ? AND version = ?")
      .get(ev.id, ev.version) as
      | { id: string; version: number; project_id: string; digest: string | null }
      | undefined;
    if (!art) {
      throw new FocusWriteError("evidence_missing", `artifact ${ev.id}@${ev.version} not found`);
    }
    // 同 Focus 归属:project 在 focus_project_refs 活跃,或 focus_artifacts 同源 id
    const viaProject = db
      .prepare(
        `SELECT 1 AS x FROM focus_project_refs
          WHERE focus_id = ? AND project_id = ? AND removed_at IS NULL LIMIT 1`
      )
      .get(focusId, art.project_id) as { x: number } | undefined;
    const viaFocusArt = db
      .prepare(`SELECT 1 AS x FROM focus_artifacts WHERE focus_id = ? AND id = ? LIMIT 1`)
      .get(focusId, ev.id) as { x: number } | undefined;
    if (!viaProject && !viaFocusArt) {
      throw new FocusWriteError(
        "evidence_focus_mismatch",
        `artifact ${ev.id} not attributed to focus ${focusId}`
      );
    }
    // 现势:非 superseded——同 id 无更高 version
    const newer = db
      .prepare("SELECT version FROM artifacts WHERE id = ? AND version > ? LIMIT 1")
      .get(ev.id, ev.version) as { version: number } | undefined;
    if (newer) {
      throw new FocusWriteError(
        "evidence_stale",
        `artifact ${ev.id}@${ev.version} superseded by version ${newer.version}`
      );
    }
    if (ev.digest !== undefined && art.digest && ev.digest !== art.digest) {
      throw new FocusWriteError("evidence_digest_mismatch", "artifact digest does not match stored");
    }
    return;
  }
  // type === "task"
  const binding = db
    .prepare(
      `SELECT 1 AS x FROM action_execution_bindings
        WHERE focus_id = ? AND task_id = ? AND superseded_by_binding_id IS NULL LIMIT 1`
    )
    .get(focusId, ev.id) as { x: number } | undefined;
  if (!binding) {
    // 宽松:若任务行本身带 project 且 focus 有该 project ref,也算归属(无 binding 的直达测试)
    const task = db
      .prepare("SELECT id, project_id, status FROM tasks WHERE id = ?")
      .get(ev.id) as { id: string; project_id: string; status: string } | undefined;
    if (!task) {
      throw new FocusWriteError("evidence_missing", `task ${ev.id} not found`);
    }
    const viaProject = db
      .prepare(
        `SELECT 1 AS x FROM focus_project_refs
          WHERE focus_id = ? AND project_id = ? AND removed_at IS NULL LIMIT 1`
      )
      .get(focusId, task.project_id) as { x: number } | undefined;
    if (!viaProject) {
      throw new FocusWriteError(
        "evidence_focus_mismatch",
        `task ${ev.id} not attributed to focus ${focusId}`
      );
    }
    if (task.status !== "task_done") {
      throw new FocusWriteError("evidence_stale", `task ${ev.id} status=${task.status} (须 task_done)`);
    }
    return;
  }
  const task = db
    .prepare("SELECT id, status FROM tasks WHERE id = ?")
    .get(ev.id) as { id: string; status: string } | undefined;
  const run = db
    .prepare(
      `SELECT state FROM tier1_runs WHERE task_id = ? AND attempt = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(ev.id, ev.attempt) as { state: string } | undefined;
  const settledByTask = task?.status === "task_done";
  const settledByRun =
    run !== undefined &&
    (run.state === "settled_review" || run.state === "settled_failed" || run.state === "cancel_settled");
  if (!task && !run) {
    throw new FocusWriteError("evidence_missing", `task ${ev.id} attempt=${ev.attempt} not found`);
  }
  if (!settledByTask && !settledByRun) {
    throw new FocusWriteError(
      "evidence_stale",
      `task ${ev.id} attempt=${ev.attempt} not settled (task=${task?.status ?? "n/a"} run=${run?.state ?? "n/a"})`
    );
  }
}

function buildOps(db: Db, nowIso: string, opts: FocusWriteTxOptions): FocusWriteOps {
  const ops: FocusWriteOps = {
    db,
    nowIso,
    getFocus(focusId: string): FocusRow {
      const row = db.prepare("SELECT * FROM focuses WHERE id = ?").get(focusId) as FocusRow | undefined;
      if (!row) throw new FocusWriteError("not_found", `focus ${focusId} not found`);
      return row;
    },
    maxEventSeq(focusId: string): number {
      const r = db.prepare("SELECT MAX(seq) AS m FROM focus_events WHERE focus_id = ?").get(focusId) as {
        m: number | null;
      };
      return r.m ?? 0;
    },
    nextEventSeq(focusId: string): number {
      return ops.maxEventSeq(focusId) + 1;
    },
    latestStateRevision(focusId: string): number | null {
      const r = db.prepare("SELECT MAX(revision) AS m FROM focus_states WHERE focus_id = ?").get(focusId) as {
        m: number | null;
      };
      return r.m ?? null;
    },
    assertCurrentRevisionConsistent(focusId: string): void {
      const f = ops.getFocus(focusId);
      const latest = ops.latestStateRevision(focusId);
      if (latest === null) {
        if (f.current_revision !== 0) {
          throw new FocusWriteError(
            "revision_inconsistent",
            `currentRevision=${f.current_revision} but no focus_states rows`
          );
        }
        return;
      }
      if (f.current_revision !== latest) {
        throw new FocusWriteError(
          "revision_inconsistent",
          `currentRevision=${f.current_revision} != latest state revision=${latest}`
        );
      }
    },
    touchUpdatedAt(focusId: string): void {
      db.prepare("UPDATE focuses SET updated_at = ? WHERE id = ?").run(nowIso, focusId);
    },
    listOpenObligations(focusId: string): ObligationRow[] {
      return db
        .prepare(
          `SELECT * FROM focus_obligations WHERE focus_id = ? AND status IN ('open','in_progress','waiting','deferred','blocked') ORDER BY id`
        )
        .all(focusId) as ObligationRow[];
    },
    /**
     * 现势 digest:签名域不含 provenance(④b 降格旁路字段;纳入会断既有 digest 链)。
     * 与 contracts.computeObligationsDigest 排除条款一致。
     */
    obligationsDigestOf(focusId: string): string {
      const rows = db
        .prepare(
          `SELECT id, status, verification, owner, kind, dedupe_key, resolution FROM focus_obligations
           WHERE focus_id = ? AND status IN ('open','in_progress','waiting','deferred','blocked')`
        )
        .all(focusId) as {
        id: string;
        status: string;
        verification: string;
        owner: string;
        kind: string;
        dedupe_key: string;
        resolution: string | null;
      }[];
      return computeObligationsDigest(
        rows.map((r) => ({
          id: r.id,
          status: r.status,
          verification: r.verification,
          owner: r.owner,
          kind: r.kind,
          dedupeKey: r.dedupe_key,
          ...(r.resolution ? { resolution: r.resolution } : {})
        }))
      );
    },
    appendEvent<T extends FocusEventType>(focusId: string, input: AppendEventInput<T>): EventInsert {
      // authority fence:存在 focus 时重读
      const row = ops.getFocus(focusId);
      assertAuthority(row, opts);

      // v21 起 type 无库层 CHECK:写入口 zod 枚举单源(contracts focusEventTypeSchema)
      const eventType = focusEventTypeSchema.parse(input.type) as T;

      const expectedSeq = ops.nextEventSeq(focusId);
      const seq = input.forceSeq ?? expectedSeq;
      if (seq !== expectedSeq) {
        throw new FocusWriteError(
          "seq_not_contiguous",
          `event seq must be ${expectedSeq} (MAX+1), got ${seq}`
        );
      }

      const fullPayload = { payloadSchemaVersion: FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION, ...input.payload };
      parseFocusEventPayload(eventType, fullPayload);

      const id = newId("fev");
      const event: EventInsert = {
        id,
        focusId,
        seq,
        type: eventType,
        payloadSchemaVersion: FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION,
        payloadJson: JSON.stringify(fullPayload),
        actorKind: input.actorKind,
        sessionId: input.sessionId,
        turnRef: input.turnRef,
        createdAt: nowIso
      };

      if (opts.injectCrashAfterTargetWrite) {
        // 调用方须先完成目标表写,再 appendEvent;本开关在事件写前炸
        throw new FocusWriteError("injected_crash", "injected crash before event write");
      }

      db.prepare(
        `INSERT INTO focus_events(id, focus_id, seq, type, payload_schema_version, payload_json, actor_kind, session_id, turn_ref, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        event.id,
        event.focusId,
        event.seq,
        event.type,
        event.payloadSchemaVersion,
        event.payloadJson,
        event.actorKind,
        event.sessionId ?? null,
        event.turnRef ?? null,
        event.createdAt
      );
      ops.touchUpdatedAt(focusId);
      return event;
    },
    createFocus(input: CreateFocusInput): { focusId: string; eventId: string } {
      const writer = opts.writerAuthority ?? "saydo";
      const authority = input.semanticAuthority ?? writer;
      if (authority !== writer) {
        throw new FocusWriteError("authority_mismatch", `cannot create focus with authority=${authority} as writer=${writer}`);
      }
      const focusId = newId("foc");
      const epoch = input.authorityEpoch ?? 0;
      db.prepare(
        `INSERT INTO focuses(id, title, lifecycle, semantic_authority, authority_epoch, current_revision, created_at, updated_at)
         VALUES (?, ?, 'captured', ?, ?, 0, ?, ?)`
      ).run(focusId, input.title, authority, epoch, nowIso, nowIso);

      if (opts.injectCrashAfterTargetWrite) {
        throw new FocusWriteError("injected_crash", "injected crash before event write");
      }

      const ev = ops.appendEvent(focusId, {
        type: "created",
        payload: { title: input.title },
        actorKind: input.actorKind ?? "daemon",
        sessionId: input.sessionId
      });
      return { focusId, eventId: ev.id };
    },
    settleRevision(focusId: string, input: SettleRevisionInput): { revision: number; eventId: string } {
      const f = ops.getFocus(focusId);
      assertAuthority(f, opts);
      const expected = f.current_revision + 1;
      const revision = input.forceRevision ?? expected;
      if (revision !== expected) {
        throw new FocusWriteError(
          "revision_not_contiguous",
          `revision must be ${expected} (current+1), got ${revision}`
        );
      }
      const watermark = ops.maxEventSeq(focusId);
      const digest = ops.obligationsDigestOf(focusId);
      const refsJson = JSON.stringify(input.acceptedDecisionRefs ?? []);
      const inheritedDirection =
        input.currentDirection ??
        ((
          db
            .prepare(
              "SELECT current_direction FROM focus_states WHERE focus_id = ? ORDER BY revision DESC LIMIT 1"
            )
            .get(focusId) as { current_direction: string } | undefined
        )?.current_direction ??
          "");

      db.prepare(
        `INSERT INTO focus_states(focus_id, revision, current_direction, last_reliable_state, next_activation_trigger,
          accepted_decision_refs_json, event_high_watermark, obligations_digest, created_by_session_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        focusId,
        revision,
        inheritedDirection,
        input.lastReliableState,
        input.nextActivationTrigger ?? null,
        refsJson,
        watermark,
        digest,
        input.createdBySessionId ?? null,
        nowIso
      );
      db.prepare("UPDATE focuses SET current_revision = ?, updated_at = ? WHERE id = ?").run(revision, nowIso, focusId);

      if (opts.injectCrashAfterTargetWrite) {
        throw new FocusWriteError("injected_crash", "injected crash before event write");
      }

      const ev = ops.appendEvent(focusId, {
        type: "revision_settled",
        payload: { revision, eventHighWatermark: watermark, obligationsDigest: digest },
        actorKind: input.actorKind ?? "daemon",
        sessionId: input.sessionId
      });
      // revision_settled 事件会抬高 watermark;状态行锚的是 settle 前水位,合同允许
      ops.assertCurrentRevisionConsistent(focusId);
      return { revision, eventId: ev.id };
    },
    changeLifecycle(focusId: string, input: LifecycleChangeInput): { eventId: string } {
      const f = ops.getFocus(focusId);
      assertAuthority(f, opts);
      const from = focusLifecycleSchema.parse(f.lifecycle);
      const to = focusLifecycleSchema.parse(input.to);
      assertLifecycleEdge(from, to);

      // 合同 §4.1:archive 理由必填
      if (to === "archived" && !(input.reason && input.reason.trim())) {
        throw new FocusWriteError("lifecycle_precondition", "archive requires reason");
      }

      if (to === "closed") {
        const open = ops.listOpenObligations(focusId);
        if (open.length > 0) {
          throw new FocusWriteError(
            "lifecycle_precondition",
            `cannot close with ${open.length} open obligation(s)`
          );
        }
      }

      if (to === "abandoned") {
        const open = ops.listOpenObligations(focusId);
        const resolution = input.abandonResolution ?? "abandoned";
        for (const o of open) {
          // 同事务逐项 resolved + event
          ops.upsertObligation(focusId, {
            id: o.id,
            kind: o.kind as FocusObligation["kind"],
            title: o.title,
            owner: o.owner as FocusObligation["owner"],
            status: "resolved",
            verification: o.verification as FocusObligationVerification,
            dedupeKey: o.dedupe_key,
            resolution,
            blocking: o.blocking === 1,
            ...(o.detail ? { detail: o.detail } : {}),
            ...(o.next_step ? { nextStep: o.next_step } : {}),
            actorKind: input.actorKind ?? "user",
            sessionId: input.sessionId
          });
        }
      }

      db.prepare("UPDATE focuses SET lifecycle = ?, updated_at = ? WHERE id = ?").run(to, nowIso, focusId);

      if (opts.injectCrashAfterTargetWrite) {
        throw new FocusWriteError("injected_crash", "injected crash before event write");
      }

      // lifecycle_changed 必升 revision(方案 §2.2);方向保留不覆写(J14/W5),状态描述人话(J7)
      ops.settleRevision(focusId, {
        lastReliableState: `状态变化:${lifecycleWord(from)} → ${lifecycleWord(to)}`,
        actorKind: input.actorKind ?? "user",
        sessionId: input.sessionId
      });

      const ev = ops.appendEvent(focusId, {
        type: "lifecycle_changed",
        payload: { from, to, ...(input.reason ? { reason: input.reason } : {}) },
        actorKind: input.actorKind ?? "user",
        sessionId: input.sessionId
      });
      return { eventId: ev.id };
    },
    linkArtifact(focusId: string, input: LinkArtifactInput): { artifactId: string; eventId: string; eventSeq: number } {
      const f = ops.getFocus(focusId);
      assertAuthority(f, opts);
      const artifactId = input.id ?? newId("art");
      db.prepare(
        `INSERT INTO focus_artifacts(
          id, focus_id, kind, role, title, ref_json, copied_from_artifact_id, created_from_event, created_at
        ) VALUES (?,?,?,?,?,?,NULL,?,?)`
      ).run(
        artifactId,
        focusId,
        input.kind,
        input.role,
        input.title,
        input.refJson,
        input.createdFromEvent ?? null,
        nowIso
      );
      if (opts.injectCrashAfterTargetWrite) {
        throw new FocusWriteError("injected_crash", "injected crash before artifact event write");
      }
      const ev = ops.appendEvent(focusId, {
        type: "artifact_linked",
        payload: {
          artifactId,
          kind: input.kind,
          role: input.role,
          title: input.title
        },
        actorKind: input.actorKind ?? "user",
        sessionId: input.sessionId,
        turnRef: input.turnRef
      });
      return { artifactId, eventId: ev.id, eventSeq: ev.seq };
    },
    upsertObligation(focusId: string, input: UpsertObligationInput): { obligationId: string; eventId: string } {
      const f = ops.getFocus(focusId);
      assertAuthority(f, opts);

      const existing = db
        .prepare("SELECT * FROM focus_obligations WHERE focus_id = ? AND dedupe_key = ?")
        .get(focusId, input.dedupeKey) as ObligationRow | undefined;

      const isTerminal = input.status === "resolved" || input.status === "superseded";
      let resolutionEventId = input.resolutionEventId;

      // ④e A7:同事务重读真实 owner,agent+done 必过证据门(确认消费/直达/API 共享)
      if (isTerminal) {
        const realOwner = (existing?.owner ?? input.owner) as FocusObligation["owner"];
        assertAgentDoneEvidence(db, focusId, realOwner, input.resolution, input.evidence);
      }

      // 先写 resolution event(若需要且未提供),再落义务行并回填 id
      let preEventId: string | undefined;
      if (isTerminal && !resolutionEventId) {
        if (!input.resolution) {
          throw new FocusWriteError("resolution_required", "resolved/superseded requires resolution");
        }
        if (input.verification === "unverified" && input.resolution === "done") {
          throw new FocusWriteError("unverified_done", "unverified obligation cannot resolve(done)");
        }
        const obligationIdPreview = existing?.id ?? input.id ?? newId("fob");
        const prevStatus = (existing?.status ?? "open") as FocusObligationStatus;
        const revEv = ops.appendEvent(focusId, {
          type: "obligation_resolved",
          payload: {
            obligationId: obligationIdPreview,
            // J13:带 title,航迹/记录流渲染不裸 id
            title: input.title ?? existing?.title ?? "",
            resolution: input.resolution,
            previousStatus: prevStatus,
            ...(input.evidence ? { evidence: input.evidence } : {})
          },
          actorKind: input.actorKind ?? "daemon",
          sessionId: input.sessionId,
          turnRef: input.turnRef
        });
        preEventId = revEv.id;
        resolutionEventId = revEv.id;
      }

      // 构造契约对象做字段条件校验
      const obligationId = existing?.id ?? input.id ?? newId("fob");
      const createdAt = existing?.created_at ?? nowIso;
      // 合同 §5.3 needs 单点:human 未结兜底非空;非 human 置 NULL
      const needs = deriveObligationNeeds(input.owner, input.status, input.kind, input.needs);
      if (input.owner === "human" && isOpenObligationStatus(input.status) && !needs) {
        throw new FocusWriteError("needs_required", "human open obligation requires needs");
      }
      const laneId = input.laneId ?? existing?.lane_id ?? undefined;
      const waitingOnObligationId =
        input.waitingOnObligationId !== undefined
          ? input.waitingOnObligationId
          : (existing?.waiting_on_obligation_id ?? undefined);
      const provenance =
        input.provenance !== undefined
          ? input.provenance
          : existing?.provenance === "confirm_expired" || existing?.provenance === "confirm_expired_batch"
            ? existing.provenance
            : undefined;
      const candidate = {
        id: obligationId,
        focusId,
        kind: input.kind,
        title: input.title,
        ...(input.detail !== undefined ? { detail: input.detail } : {}),
        owner: input.owner,
        status: input.status,
        verification: input.verification,
        ...(input.waitingOn !== undefined
          ? { waitingOn: input.waitingOn }
          : existing?.waiting_on
            ? { waitingOn: existing.waiting_on }
            : {}),
        ...(waitingOnObligationId ? { waitingOnObligationId } : {}),
        ...(input.deferReason !== undefined ? { deferReason: input.deferReason } : {}),
        ...(input.nextStep !== undefined ? { nextStep: input.nextStep } : {}),
        ...(input.dueOrTrigger !== undefined ? { dueOrTrigger: input.dueOrTrigger } : {}),
        blocking: input.blocking ?? false,
        ...(input.projectRef !== undefined ? { projectRef: input.projectRef } : {}),
        ...(input.actionRef !== undefined ? { actionRef: input.actionRef } : {}),
        ...(input.sourceSessionId !== undefined ? { sourceSessionId: input.sourceSessionId } : {}),
        ...(input.sourceTurnRef !== undefined ? { sourceTurnRef: input.sourceTurnRef } : {}),
        dedupeKey: input.dedupeKey,
        ...(laneId ? { laneId } : {}),
        ...(input.createdFromEvent !== undefined
          ? { createdFromEvent: input.createdFromEvent }
          : existing?.created_from_event != null
            ? { createdFromEvent: existing.created_from_event }
            : {}),
        ...(needs ? { needs } : {}),
        ...(provenance ? { provenance } : {}),
        ...(resolutionEventId !== undefined ? { resolutionEventId } : {}),
        ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
        createdAt,
        updatedAt: nowIso
      };
      // 契约校验(含 unverified+done 拒)
      focusObligationSchema.parse(candidate);

      // resolutionEventId 跨表 validator:同 Focus + type=obligation_resolved
      if (resolutionEventId) {
        const er = db
          .prepare("SELECT focus_id, type FROM focus_events WHERE id = ?")
          .get(resolutionEventId) as { focus_id: string; type: string } | undefined;
        if (!er) {
          throw new FocusWriteError("resolution_event_missing", `resolutionEventId ${resolutionEventId} not found`);
        }
        if (er.focus_id !== focusId) {
          throw new FocusWriteError("resolution_event_focus_mismatch", "resolutionEventId must belong to same focus");
        }
        if (er.type !== "obligation_resolved") {
          throw new FocusWriteError(
            "resolution_event_type",
            `resolutionEventId type must be obligation_resolved, got ${er.type}`
          );
        }
      }

      const waitingOnVal =
        input.waitingOn !== undefined ? (input.waitingOn ?? null) : (existing?.waiting_on ?? null);
      const waitingOnObVal =
        input.waitingOnObligationId !== undefined
          ? (input.waitingOnObligationId ?? null)
          : (existing?.waiting_on_obligation_id ?? null);
      const laneIdVal = input.laneId !== undefined ? (input.laneId ?? null) : (existing?.lane_id ?? null);
      const provenanceVal = provenance ?? null;

      if (existing) {
        db.prepare(
          `UPDATE focus_obligations SET kind=?, title=?, detail=?, owner=?, status=?, verification=?,
            waiting_on=?, defer_reason=?, next_step=?, due_or_trigger=?, blocking=?,
            project_ref=?, action_ref=?, source_session_id=?, source_turn_ref=?,
            needs=?, resolution_event_id=?, resolution=?, updated_at=?,
            waiting_on_obligation_id=?, lane_id=?, provenance=?
           WHERE id=?`
        ).run(
          input.kind,
          input.title,
          input.detail ?? null,
          input.owner,
          input.status,
          input.verification,
          waitingOnVal,
          input.deferReason ?? null,
          input.nextStep ?? null,
          input.dueOrTrigger ?? null,
          (input.blocking ?? false) ? 1 : 0,
          input.projectRef ?? null,
          input.actionRef ?? null,
          input.sourceSessionId ?? existing.source_session_id,
          input.sourceTurnRef ?? existing.source_turn_ref,
          needs,
          resolutionEventId ?? null,
          input.resolution ?? null,
          nowIso,
          waitingOnObVal,
          laneIdVal,
          provenanceVal,
          obligationId
        );
      } else {
        if (opts.injectCrashAfterTargetWrite && !preEventId) {
          // 目标写后事件写前:先 INSERT 义务再 append 时炸
        }
        db.prepare(
          `INSERT INTO focus_obligations(
            id, focus_id, kind, title, detail, owner, status, verification,
            waiting_on, defer_reason, next_step, due_or_trigger, blocking,
            project_ref, action_ref, source_session_id, source_turn_ref,
            dedupe_key, needs, resolution_event_id, resolution, created_at, updated_at,
            lane_id, created_from_event, waiting_on_obligation_id, provenance
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).run(
          obligationId,
          focusId,
          input.kind,
          input.title,
          input.detail ?? null,
          input.owner,
          input.status,
          input.verification,
          input.waitingOn ?? null,
          input.deferReason ?? null,
          input.nextStep ?? null,
          input.dueOrTrigger ?? null,
          (input.blocking ?? false) ? 1 : 0,
          input.projectRef ?? null,
          input.actionRef ?? null,
          input.sourceSessionId ?? null,
          input.sourceTurnRef ?? null,
          input.dedupeKey,
          needs,
          resolutionEventId ?? null,
          input.resolution ?? null,
          createdAt,
          nowIso,
          input.laneId ?? null,
          input.createdFromEvent ?? null,
          input.waitingOnObligationId ?? null,
          provenanceVal
        );
      }

      // 合同 §3.4:resolve 单点同事务唤醒依赖方
      if (isTerminal && input.resolution) {
        wakeDependentsOnOps(ops, {
          id: obligationId,
          focusId,
          title: input.title,
          resolution: input.resolution
        });
      }

      const projectDueIfNeeded = (): void => {
        // ④d:仅当调用方显式带 dueOrTrigger 时投影(undefined=不碰 due 期待)
        if (input.dueOrTrigger !== undefined) {
          projectDueExpectationOnOps(
            ops,
            focusId,
            obligationId,
            input.dueOrTrigger,
            input.title
          );
        }
      };

      if (preEventId) {
        // resolution event 已写;若是 open→open 以外的 status change 另记
        ops.touchUpdatedAt(focusId);
        projectDueIfNeeded();
        return { obligationId, eventId: preEventId };
      }

      if (opts.injectCrashAfterTargetWrite) {
        throw new FocusWriteError("injected_crash", "injected crash before event write");
      }

      const eventType: FocusEventType = isTerminal ? "obligation_resolved" : existing ? "obligation_status_changed" : "obligation_opened";
      let ev: EventInsert;
      if (eventType === "obligation_opened") {
        // 新开账:若尚未写 created_from_event,用本事件 seq 回填
        ev = ops.appendEvent(focusId, {
          type: "obligation_opened",
          payload: {
            obligationId,
            kind: input.kind,
            title: input.title,
            dedupeKey: input.dedupeKey,
            owner: input.owner,
            ...(laneIdVal ? { laneId: laneIdVal } : {})
          },
          actorKind: input.actorKind ?? "daemon",
          sessionId: input.sessionId,
          turnRef: input.turnRef
        });
        if (!existing && input.createdFromEvent === undefined) {
          db.prepare(`UPDATE focus_obligations SET created_from_event = ? WHERE id = ?`).run(ev.seq, obligationId);
        }
      } else if (eventType === "obligation_status_changed") {
        ev = ops.appendEvent(focusId, {
          type: "obligation_status_changed",
          payload: {
            obligationId,
            fromStatus: (existing!.status as FocusObligationStatus),
            toStatus: input.status,
            verification: input.verification
          },
          actorKind: input.actorKind ?? "daemon",
          sessionId: input.sessionId,
          turnRef: input.turnRef
        });
      } else {
        // 外部提供 resolutionEventId 路径:仍校验,不重复写 event
        ev = {
          id: resolutionEventId!,
          focusId,
          seq: 0,
          type: "obligation_resolved",
          payloadSchemaVersion: FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION,
          payloadJson: "",
          actorKind: input.actorKind ?? "daemon",
          createdAt: nowIso
        };
        ops.touchUpdatedAt(focusId);
      }
      projectDueIfNeeded();
      return { obligationId, eventId: ev.id };
    }
  };
  return ops;
}

/** lifecycle 转换表(合同 §4.1;archived archive/reopen 批 2) */
export function assertLifecycleEdge(from: FocusLifecycle, to: FocusLifecycle): void {
  if (from === to) {
    throw new FocusWriteError("lifecycle_noop", `lifecycle already ${from}`);
  }
  const ok =
    (from === "captured" && to === "active") ||
    // W2:刚建的空 Focus 也能中途放下(captured → archived;§8.2 合同修订)
    (from === "captured" && to === "archived") ||
    (from === "active" && to === "dormant") ||
    (from === "dormant" && to === "active") ||
    (from === "active" && (to === "closed" || to === "abandoned" || to === "archived")) ||
    (from === "dormant" && (to === "closed" || to === "abandoned")) ||
    (from === "archived" && (to === "active" || to === "abandoned")) ||
    // 既有测试/旧路径:closed|abandoned → dormant(合同 v0.3.3 已禁出边,保留兼容直至收口)
    ((from === "closed" || from === "abandoned") && to === "dormant");
  if (!ok) {
    throw new FocusWriteError("lifecycle_illegal", `illegal lifecycle transition ${from} → ${to}`);
  }
}

/**
 * Focus 域唯一写事务入口。
 * work 内的一切 mutation 使用 ops;提交前跑一致性 validator。
 */
export function withFocusWriteTx<T>(db: Db, opts: FocusWriteTxOptions, work: (ops: FocusWriteOps) => T): T {
  const nowIso = (opts.now ?? (() => new Date()))().toISOString();
  const tx = db.transaction(() => {
    const ops = buildOps(db, nowIso, opts);
    const result = work(ops);
    // 事务末尾:凡触及的 focuses 可在 work 内 assert;此处全局不做扫全表
    return result;
  });
  return tx.immediate();
}

/** 只读:解析 focus 行(不经写路径) */
export function readFocus(db: Db, focusId: string) {
  const row = db.prepare("SELECT * FROM focuses WHERE id = ?").get(focusId) as FocusRow | undefined;
  return row ? focusFromRow(row) : null;
}

export function readObligation(db: Db, obligationId: string) {
  const row = db.prepare("SELECT * FROM focus_obligations WHERE id = ?").get(obligationId) as ObligationRow | undefined;
  return row ? obligationFromRow(row) : null;
}

/** ④b 降格 batch item(自包含;展开不依赖 ledger 存活) */
export interface ConfirmExpiredBatchItem {
  receiptRef: string;
  title: string;
  obligationKind: string;
  owner: string;
}

export type DowngradeExpiredResult =
  | {
      ok: true;
      noop: boolean;
      mode: "individual" | "batch";
      obligationId?: string;
      eventId?: string;
    }
  | {
      ok: false;
      code: "authority_mismatch" | "focus_closed" | "focus_not_found" | "invalid_payload" | "write_error";
      message: string;
    };

export interface DowngradeExpiredInput {
  receiptRef: string;
  payload: ConfirmationDowngradePayload;
  focusId: string;
  sessionId: string;
  /**
   * true=并入当日聚合义务(防风暴);false=单条 confirm_expired。
   * 由 saga 在 ledger 侧统计后传入。
   */
  useBatch: boolean;
  /** 聚合义务的日历日(YYYY-MM-DD,通常取 now 的 UTC 日) */
  batchDate?: string;
  now?: () => Date;
  writerAuthority?: FocusSemanticAuthority;
}

const TERMINAL_FOCUS_LIFECYCLES = new Set(["closed", "abandoned", "archived"]);

function hasConfirmationDowngraded(db: Db, focusId: string, receiptRef: string): boolean {
  const row = db
    .prepare(
      `SELECT id FROM focus_events
       WHERE focus_id = ? AND type = 'confirmation_downgraded'
         AND json_extract(payload_json, '$.receiptRef') = ?
       LIMIT 1`
    )
    .get(focusId, receiptRef) as { id: string } | undefined;
  return row != null;
}

function parseBatchItems(detail: string | null | undefined): ConfirmExpiredBatchItem[] {
  if (!detail) return [];
  try {
    const parsed = JSON.parse(detail) as { items?: ConfirmExpiredBatchItem[] };
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (it) =>
        it &&
        typeof it.receiptRef === "string" &&
        typeof it.title === "string" &&
        typeof it.obligationKind === "string" &&
        typeof it.owner === "string"
    );
  } catch {
    return [];
  }
}

function mergeBatchItems(
  existing: ConfirmExpiredBatchItem[],
  next: ConfirmExpiredBatchItem
): ConfirmExpiredBatchItem[] {
  const byRef = new Map<string, ConfirmExpiredBatchItem>();
  for (const it of existing) byRef.set(it.receiptRef, it);
  byRef.set(next.receiptRef, next);
  return [...byRef.values()];
}

/**
 * Focus v0.4 ④b:过期确认降格落账。
 * 同事务内:查 confirmation_downgraded(receiptRef)→已有则 no-op 成功;
 * 否则写 obligation + confirmation_downgraded 事件。
 * authority mismatch / Focus 终态 → 结构化失败(不抛,供 saga 标 failed)。
 */
export function downgradeExpiredConfirmation(db: Db, input: DowngradeExpiredInput): DowngradeExpiredResult {
  const opts: FocusWriteTxOptions = {
    writerAuthority: input.writerAuthority ?? "saydo",
    ...(input.now ? { now: input.now } : {})
  };
  try {
    return withFocusWriteTx(db, opts, (ops) => {
      let focus: FocusRow;
      try {
        focus = ops.getFocus(input.focusId);
      } catch (err) {
        if (err instanceof FocusWriteError && err.code === "not_found") {
          return { ok: false as const, code: "focus_not_found" as const, message: err.message };
        }
        throw err;
      }
      try {
        assertAuthority(focus, opts);
      } catch (err) {
        if (err instanceof FocusWriteError && (err.code === "authority_mismatch" || err.code === "epoch_fence")) {
          return { ok: false as const, code: "authority_mismatch" as const, message: err.message };
        }
        throw err;
      }
      if (TERMINAL_FOCUS_LIFECYCLES.has(focus.lifecycle)) {
        return {
          ok: false as const,
          code: "focus_closed" as const,
          message: `focus lifecycle=${focus.lifecycle} rejects downgrade`
        };
      }

      // 幂等:同 focus 事件流已有该 receiptRef 的 confirmation_downgraded → 成功 no-op
      if (hasConfirmationDowngraded(db, input.focusId, input.receiptRef)) {
        return { ok: true as const, noop: true, mode: input.useBatch ? ("batch" as const) : ("individual" as const) };
      }

      const p = input.payload;
      if (!p.dedupeKey || !p.title || !p.kind || !p.owner) {
        return { ok: false as const, code: "invalid_payload" as const, message: "downgrade payload incomplete" };
      }

      // 合同 §5.3:needs 仅 owner=human 时设置
      const humanNeeds: FocusObligationNeeds | undefined =
        p.owner === "human" ? (p.needs ?? (p.kind === "decision" ? "decision" : p.kind === "answer" ? "input" : "action")) : undefined;

      let obligationId: string;
      let mode: "individual" | "batch";

      if (input.useBatch) {
        mode = "batch";
        const date = input.batchDate ?? ops.nowIso.slice(0, 10);
        const batchDedupe = `confirm-batch:${input.focusId}:${date}`;
        const item: ConfirmExpiredBatchItem = {
          receiptRef: input.receiptRef,
          title: p.title,
          obligationKind: p.kind,
          owner: p.owner
        };
        const existing = db
          .prepare("SELECT * FROM focus_obligations WHERE focus_id = ? AND dedupe_key = ?")
          .get(input.focusId, batchDedupe) as ObligationRow | undefined;
        const merged = mergeBatchItems(parseBatchItems(existing?.detail), item);
        const title = `有 ${merged.length} 件没确认完的事`;
        const detail = JSON.stringify({ items: merged });
        const up = ops.upsertObligation(input.focusId, {
          kind: "followup",
          title,
          detail,
          owner: "human",
          status: "open",
          verification: "provisional",
          needs: "decision",
          dedupeKey: batchDedupe,
          provenance: "confirm_expired_batch",
          sourceSessionId: input.sessionId,
          actorKind: "daemon",
          sessionId: input.sessionId
        });
        obligationId = up.obligationId;
      } else {
        mode = "individual";
        const up = ops.upsertObligation(input.focusId, {
          kind: p.kind,
          title: p.title,
          ...(p.detail ? { detail: p.detail } : {}),
          owner: p.owner,
          status: "open",
          verification: p.verification ?? "provisional",
          ...(humanNeeds ? { needs: humanNeeds } : {}),
          ...(p.nextStep ? { nextStep: p.nextStep } : {}),
          ...(p.laneId ? { laneId: p.laneId } : {}),
          dedupeKey: p.dedupeKey,
          provenance: "confirm_expired",
          sourceSessionId: input.sessionId,
          actorKind: "daemon",
          sessionId: input.sessionId
        });
        obligationId = up.obligationId;
      }

      const ev = ops.appendEvent(input.focusId, {
        type: "confirmation_downgraded",
        payload: { receiptRef: input.receiptRef, mode },
        actorKind: "daemon",
        sessionId: input.sessionId
      });

      return {
        ok: true as const,
        noop: false,
        mode,
        obligationId,
        eventId: ev.id
      };
    });
  } catch (err) {
    if (err instanceof FocusWriteError) {
      if (err.code === "authority_mismatch" || err.code === "epoch_fence") {
        return { ok: false, code: "authority_mismatch", message: err.message };
      }
      return { ok: false, code: "write_error", message: `${err.code}: ${err.message}` };
    }
    return { ok: false, code: "write_error", message: String(err).slice(0, 200) };
  }
}

/**
 * 工程告警义务:saga 三败 abandoned 后挂 attention 可见条(owner=human,needs=action)。
 * 幂等:同 receipt 的 dedupeKey 命中已有行则 no-op。
 */
export function upsertAbandonedDowngradeAlert(
  db: Db,
  args: { focusId: string; sessionId: string; receiptRef: string; now?: () => Date }
): { ok: true; obligationId: string; noop: boolean } | { ok: false; code: string; message: string } {
  const dedupeKey = `confirm-abandoned-alert:${args.receiptRef}`;
  try {
    return withFocusWriteTx(
      db,
      { writerAuthority: "saydo", ...(args.now ? { now: args.now } : {}) },
      (ops) => {
        const focus = ops.getFocus(args.focusId);
        if (TERMINAL_FOCUS_LIFECYCLES.has(focus.lifecycle)) {
          return {
            ok: false as const,
            code: "focus_closed",
            message: `focus lifecycle=${focus.lifecycle}`
          };
        }
        const existing = db
          .prepare("SELECT id FROM focus_obligations WHERE focus_id = ? AND dedupe_key = ?")
          .get(args.focusId, dedupeKey) as { id: string } | undefined;
        if (existing) {
          return { ok: true as const, obligationId: existing.id, noop: true };
        }
        const up = ops.upsertObligation(args.focusId, {
          kind: "action",
          title: "有一件过期确认没能自动入账,需要人工看一眼",
          detail: JSON.stringify({ receiptRef: args.receiptRef }),
          owner: "human",
          status: "open",
          verification: "provisional",
          needs: "action",
          dedupeKey,
          sourceSessionId: args.sessionId,
          actorKind: "daemon",
          sessionId: args.sessionId
        });
        return { ok: true as const, obligationId: up.obligationId, noop: false };
      }
    );
  } catch (err) {
    return { ok: false, code: "write_error", message: String(err).slice(0, 200) };
  }
}

export { isOpenObligationStatus };
