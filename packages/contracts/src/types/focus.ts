// Focus Contract v0.2.1 域类型(方案 §2/§3)。
// 批 1 六对象 + RpFact/packet/binding + event payload 判别 schema(payloadSchemaVersion=1)。
// daemon 一律 import 本文件形状,禁私定义。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";

// ---------- 词表 ----------

/** 合同 §4.1:六值;archived 约束放开(v22),archive/reopen 行为归批 3 */
export const focusLifecycleSchema = z.enum([
  "captured",
  "active",
  "dormant",
  "closed",
  "abandoned",
  "archived"
]);
export type FocusLifecycle = z.infer<typeof focusLifecycleSchema>;

export const focusSemanticAuthoritySchema = z.enum(["external_bootstrap", "saydo"]);
export type FocusSemanticAuthority = z.infer<typeof focusSemanticAuthoritySchema>;

export const focusObligationKindSchema = z.enum(["answer", "decision", "action", "followup", "check"]);
export type FocusObligationKind = z.infer<typeof focusObligationKindSchema>;

export const focusObligationStatusSchema = z.enum([
  "open",
  "in_progress",
  "waiting",
  "deferred",
  "blocked",
  "resolved",
  "superseded"
]);
export type FocusObligationStatus = z.infer<typeof focusObligationStatusSchema>;

export const focusObligationVerificationSchema = z.enum(["provisional", "unverified", "confirmed"]);
export type FocusObligationVerification = z.infer<typeof focusObligationVerificationSchema>;

export const focusObligationResolutionSchema = z.enum([
  "done",
  "abandoned",
  "superseded",
  "no_longer_applicable"
]);
export type FocusObligationResolution = z.infer<typeof focusObligationResolutionSchema>;

/**
 * Focus v0.4 ④e A7:agent 义务 resolve(done) 的可验证证据(判别联合)。
 * 写门在 FocusWriteTx 同事务做存在性+同 Focus 归属+现势三查。
 */
export const obligationResolveEvidenceSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("artifact"),
    id: z.string().min(1),
    version: z.number().int().positive(),
    digest: z.string().min(1).optional()
  }),
  z.strictObject({
    type: z.literal("task"),
    id: z.string().min(1),
    attempt: z.number().int().positive()
  }),
  z.strictObject({
    type: z.literal("event"),
    focusId: z.string().min(1),
    seq: z.number().int().positive()
  })
]);
export type ObligationResolveEvidence = z.infer<typeof obligationResolveEvidenceSchema>;

export const focusObligationOwnerSchema = z.enum(["human", "agent", "external"]);
export type FocusObligationOwner = z.infer<typeof focusObligationOwnerSchema>;

/** 合同 §5.3:当前需要人做什么(与 kind 正交);表无 CHECK,zod 层约束 */
export const focusObligationNeedsSchema = z.enum(["decision", "input", "action", "unknown"]);
export type FocusObligationNeeds = z.infer<typeof focusObligationNeedsSchema>;

/** M1 `/api/focuses` 四状态互斥聚合投影。 */
export const focusFourStateCountsSchema = z.strictObject({
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  needsYou: z.number().int().nonnegative(),
  settled: z.number().int().nonnegative()
});
export type FocusFourStateCounts = z.infer<typeof focusFourStateCountsSchema>;

export const focusActivationStatusSchema = z.enum(["active", "closed", "interrupted"]);
export type FocusActivationStatus = z.infer<typeof focusActivationStatusSchema>;

export const focusActivationTriggerSchema = z.enum(["user_explicit", "session_open_suggest", "reopen"]);
export type FocusActivationTrigger = z.infer<typeof focusActivationTriggerSchema>;

export const focusResumeSourceSchema = z.enum(["packet", "state_direct", "cold"]);
export type FocusResumeSource = z.infer<typeof focusResumeSourceSchema>;

export const closeSettlementPhaseSchema = z.enum([
  "enumerated",
  "presented",
  "confirmed",
  "auto_ledgered",
  "committed",
  "conflict"
]);
export type CloseSettlementPhase = z.infer<typeof closeSettlementPhaseSchema>;

export const focusEventTypeSchema = z.enum([
  "created",
  "activation_started",
  "activation_closed",
  "revision_settled",
  "obligation_opened",
  "obligation_status_changed",
  "obligation_resolved",
  "lifecycle_changed",
  "project_ref_added",
  "project_ref_removed",
  "packet_frozen",
  "packet_confirmed",
  "binding_authorized",
  "binding_ledger_bound",
  "authority_transfer",
  "close_settlement",
  "correction",
  // 批 3:lanes / 依赖 / 产物 realization(zod 为唯一 type 防线,v21 后库无 CHECK)
  "lane_split",
  "lane_retired",
  "redo_from",
  "dependency_set",
  "dependency_woken",
  "dependency_blocked",
  "artifact_linked",
  "artifact_realized",
  "focus_forked",
  // Focus v0.4 ④a:确认环 timeline 回补(有 focusId 的 focus_* kind 才写)
  "confirmation_presented",
  "confirmation_settled",
  "confirmation_expired",
  // Focus v0.4 ④b:降格落账幂等标记(payload.receiptRef;同 focus 同 receipt 仅一次)
  "confirmation_downgraded",
  // Focus v0.4 ④d:Expectation aggregate 调整与 ack 终局
  "expectation_adjusted",
  "expectation_ack_settled"
]);
export type FocusEventType = z.infer<typeof focusEventTypeSchema>;

// ---------- Expectation aggregate (Focus v0.4 ④d) ----------

export const focusExpectationKindSchema = z.enum(["acceptance", "artifact", "budget", "due"]);
export type FocusExpectationKind = z.infer<typeof focusExpectationKindSchema>;

export const focusExpectationStatusSchema = z.enum(["active", "pending_ack", "superseded"]);
export type FocusExpectationStatus = z.infer<typeof focusExpectationStatusSchema>;

export const focusExpectationAppliesFromSchema = z.enum(["current", "next_dispatch"]);
export type FocusExpectationAppliesFrom = z.infer<typeof focusExpectationAppliesFromSchema>;

/** source_ref:权威引用;包 digest/revision/序号只进此字段,不进 logical_key */
export const focusExpectationSourceRefSchema = z.strictObject({
  type: z.enum(["decision_package", "artifact", "obligation"]),
  id: z.string().min(1),
  digest: z.string().optional(),
  revision: z.number().int().positive().optional(),
  /** acceptance 在包内序号(0-based);不进 logical_key */
  criterionIndex: z.number().int().nonnegative().optional(),
  /** criterion 文本 sha256 前 16 位(迁移匹配用) */
  textHash16: z.string().length(16).optional(),
  /** 同文本序次 n(1-based) */
  textOrdinal: z.number().int().positive().optional(),
  packageId: idSchema.optional(),
  lineageRootDigest: z.string().optional(),
  budgetMax: z.number().optional(),
  artifactId: idSchema.optional(),
  obligationId: idSchema.optional()
});
export type FocusExpectationSourceRef = z.infer<typeof focusExpectationSourceRefSchema>;

export const focusExpectationSchema = z.strictObject({
  id: idSchema,
  focusId: idSchema,
  logicalKey: z.string().min(1),
  kind: focusExpectationKindSchema,
  sourceRef: focusExpectationSourceRefSchema,
  text: z.string().min(1),
  status: focusExpectationStatusSchema,
  revision: z.number().int().positive(),
  appliesFrom: focusExpectationAppliesFromSchema,
  createdFromEvent: z.number().int().positive().optional(),
  createdAt: tsSchema,
  updatedAt: tsSchema
});
export type FocusExpectation = z.infer<typeof focusExpectationSchema>;

export const focusActorKindSchema = z.enum(["user", "daemon", "brain_proposal"]);
export type FocusActorKind = z.infer<typeof focusActorKindSchema>;

export const focusEventResolutionTypes = ["obligation_resolved"] as const;

// ---------- 六对象 + 批 2 ----------

export const focusSchema = z.strictObject({
  id: idSchema,
  title: z.string().min(1),
  lifecycle: focusLifecycleSchema,
  semanticAuthority: focusSemanticAuthoritySchema,
  authorityEpoch: z.number().int().nonnegative(),
  currentRevision: z.number().int().nonnegative(),
  createdAt: tsSchema,
  updatedAt: tsSchema
});
export type Focus = z.infer<typeof focusSchema>;

export const focusProjectRefSchema = z.strictObject({
  focusId: idSchema,
  projectId: idSchema,
  addedByEventId: idSchema,
  removedByEventId: idSchema.optional(),
  removedAt: tsSchema.optional(),
  note: z.string().optional(),
  addedAt: tsSchema
}).superRefine((r, ctx) => {
  const hasRemAt = r.removedAt !== undefined;
  const hasRemEv = r.removedByEventId !== undefined;
  if (hasRemAt !== hasRemEv) {
    ctx.addIssue({ code: "custom", message: "removedAt and removedByEventId must both be present or both absent" });
  }
});
export type FocusProjectRef = z.infer<typeof focusProjectRefSchema>;

export const acceptedDecisionRefSchema = z.strictObject({
  kind: z.enum(["decision_package", "focus_event"]),
  id: idSchema
});
export type AcceptedDecisionRef = z.infer<typeof acceptedDecisionRefSchema>;

export const focusStateSchema = z.strictObject({
  focusId: idSchema,
  revision: z.number().int().positive(),
  currentDirection: z.string(),
  lastReliableState: z.string(),
  nextActivationTrigger: z.string().optional(),
  acceptedDecisionRefs: z.array(acceptedDecisionRefSchema),
  eventHighWatermark: z.number().int().nonnegative(),
  obligationsDigest: digestSchema,
  createdBySessionId: idSchema.optional(),
  createdAt: tsSchema
});
export type FocusState = z.infer<typeof focusStateSchema>;

export const focusObligationSchema = z
  .strictObject({
    id: idSchema,
    focusId: idSchema,
    kind: focusObligationKindSchema,
    title: z.string().min(1),
    detail: z.string().optional(),
    owner: focusObligationOwnerSchema,
    status: focusObligationStatusSchema,
    verification: focusObligationVerificationSchema,
    waitingOn: z.string().optional(),
    /** 合同 §3.4:结构化依赖,引用同 focus 义务 id;与 waitingOn 文本并存 */
    waitingOnObligationId: idSchema.optional(),
    deferReason: z.string().optional(),
    nextStep: z.string().optional(),
    dueOrTrigger: z.string().optional(),
    blocking: z.boolean(),
    projectRef: idSchema.optional(),
    actionRef: idSchema.optional(),
    sourceSessionId: idSchema.optional(),
    sourceTurnRef: z.string().optional(),
    dedupeKey: z.string().min(1),
    /** 合同 §3.1:所属线;NULL=主线 */
    laneId: idSchema.optional(),
    /** 合同 §3.3:开账事件 seq;NULL=迁移未匹配 */
    createdFromEvent: z.number().int().positive().optional(),
    /** 合同 §5.3:owner=human 且未结时非空;owner≠human 应为 undefined */
    needs: focusObligationNeedsSchema.optional(),
    /**
     * Focus v0.4 ④b:过期确认降格溯源。
     * - confirm_expired:单条过期确认落入义务
     * - confirm_expired_batch:同日防风暴聚合义务
     * 可选,向后兼容;不参与 obligationsDigest(防既有 digest 链断裂)。
     */
    provenance: z.enum(["confirm_expired", "confirm_expired_batch"]).optional(),
    resolutionEventId: idSchema.optional(),
    resolution: focusObligationResolutionSchema.optional(),
    createdAt: tsSchema,
    updatedAt: tsSchema
  })
  .superRefine((o, ctx) => {
    if ((o.status === "waiting" || o.status === "blocked") && !o.waitingOn) {
      ctx.addIssue({ code: "custom", message: "waiting/blocked requires waitingOn" });
    }
    if (o.status === "deferred" && !o.deferReason) {
      ctx.addIssue({ code: "custom", message: "deferred requires deferReason" });
    }
    if (o.status === "resolved" || o.status === "superseded") {
      if (!o.resolutionEventId) {
        ctx.addIssue({ code: "custom", message: "resolved/superseded requires resolutionEventId" });
      }
      if (!o.resolution) {
        ctx.addIssue({ code: "custom", message: "resolved/superseded requires resolution" });
      }
    }
    if (o.verification === "unverified" && o.status === "resolved" && o.resolution === "done") {
      ctx.addIssue({ code: "custom", message: "unverified obligation cannot resolve(done)" });
    }
    // 写路径验证器口径:human 未结 ⇒ needs 非空(解析层放宽,upsert 单点强制)
  });
export type FocusObligation = z.infer<typeof focusObligationSchema>;

export const focusActivationSchema = z
  .strictObject({
    id: idSchema,
    focusId: idSchema,
    sessionId: idSchema,
    anchorRevision: z.number().int().nonnegative(),
    inputFocusRevision: z.number().int().nonnegative(),
    resumeSource: focusResumeSourceSchema,
    packetRevision: z.number().int().positive().optional(),
    trigger: focusActivationTriggerSchema,
    status: focusActivationStatusSchema,
    outputFocusRevision: z.number().int().positive().optional(),
    startedAt: tsSchema,
    closedAt: tsSchema.optional()
  })
  .superRefine((a, ctx) => {
    if (a.status === "active") {
      if (a.closedAt !== undefined || a.outputFocusRevision !== undefined) {
        ctx.addIssue({ code: "custom", message: "active activation must not have closedAt/outputFocusRevision" });
      }
    }
    if (a.status === "closed") {
      if (a.closedAt === undefined || a.outputFocusRevision === undefined) {
        ctx.addIssue({ code: "custom", message: "closed activation requires closedAt and outputFocusRevision" });
      }
    }
    if (a.status === "interrupted") {
      if (a.closedAt === undefined) {
        ctx.addIssue({ code: "custom", message: "interrupted activation requires closedAt" });
      }
      if (a.outputFocusRevision !== undefined) {
        ctx.addIssue({ code: "custom", message: "interrupted activation must keep outputFocusRevision null" });
      }
    }
  });
export type FocusActivation = z.infer<typeof focusActivationSchema>;

export const frozenInputsSchema = z.strictObject({
  focusRevision: z.number().int().nonnegative(),
  eventHighWatermark: z.number().int().nonnegative(),
  obligationsDigest: digestSchema,
  sessionFocusAnchorRevision: z.number().int().nonnegative(),
  transcriptBoundary: z.string().optional(),
  transcriptDigest: digestSchema.optional().nullable()
});
export type FrozenInputs = z.infer<typeof frozenInputsSchema>;

export const closeSettlementCandidateKindSchema = z.enum([
  "unanswered_user_question",
  "agent_commitment",
  "touched_open_obligation"
]);
export type CloseSettlementCandidateKind = z.infer<typeof closeSettlementCandidateKindSchema>;

export const closeSettlementCandidateSchema = z.strictObject({
  candidateId: z.string().min(1),
  kind: closeSettlementCandidateKindSchema,
  title: z.string().min(1),
  detail: z.string().optional(),
  turnRef: z.string().optional(),
  obligationId: idSchema.optional(),
  dedupeKey: z.string().min(1),
  owner: focusObligationOwnerSchema.optional()
});
export type CloseSettlementCandidate = z.infer<typeof closeSettlementCandidateSchema>;

export const closeSettlementDecisionSchema = z.strictObject({
  disposition: z.enum(["ledger", "answered", "abandoned", "skip"]),
  ref: z.string().optional()
});
export type CloseSettlementDecision = z.infer<typeof closeSettlementDecisionSchema>;

export const closeSettlementSchema = z.strictObject({
  id: idSchema,
  sessionId: idSchema,
  focusId: idSchema,
  activationId: idSchema,
  idempotencyKey: z.string().min(1),
  closeAttempt: z.number().int().positive(),
  frozenInputs: frozenInputsSchema,
  candidatesJson: z.string().min(2),
  decisionsJson: z.string().optional(),
  presentationId: z.string().optional(),
  phase: closeSettlementPhaseSchema,
  createdAt: tsSchema,
  updatedAt: tsSchema
});
export type CloseSettlement = z.infer<typeof closeSettlementSchema>;

// ---------- Event payload 判别 (payloadSchemaVersion=1) ----------

export const FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION = 1 as const;

const payloadBase = { payloadSchemaVersion: z.literal(FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION) };

export const focusEventPayloadCreatedSchema = z.strictObject({
  ...payloadBase,
  title: z.string().min(1)
});
export const focusEventPayloadActivationStartedSchema = z.strictObject({
  ...payloadBase,
  activationId: idSchema,
  sessionId: idSchema,
  trigger: focusActivationTriggerSchema,
  inputFocusRevision: z.number().int().nonnegative()
});
export const focusEventPayloadActivationClosedSchema = z.strictObject({
  ...payloadBase,
  activationId: idSchema,
  sessionId: idSchema,
  status: z.enum(["closed", "interrupted"]),
  outputFocusRevision: z.number().int().positive().optional()
});
export const focusEventPayloadRevisionSettledSchema = z.strictObject({
  ...payloadBase,
  revision: z.number().int().positive(),
  eventHighWatermark: z.number().int().nonnegative(),
  obligationsDigest: digestSchema
});
export const focusEventPayloadObligationOpenedSchema = z.strictObject({
  ...payloadBase,
  obligationId: idSchema,
  kind: focusObligationKindSchema,
  title: z.string().min(1),
  dedupeKey: z.string().min(1),
  owner: focusObligationOwnerSchema,
  laneId: idSchema.optional()
});
export const focusEventPayloadObligationStatusChangedSchema = z.strictObject({
  ...payloadBase,
  obligationId: idSchema,
  fromStatus: focusObligationStatusSchema,
  toStatus: focusObligationStatusSchema,
  verification: focusObligationVerificationSchema.optional()
});
export const focusEventPayloadObligationResolvedSchema = z.strictObject({
  ...payloadBase,
  obligationId: idSchema,
  /** J13:带标题渲染,航迹/记录流不裸 id(可选=兼容历史事件) */
  title: z.string().optional(),
  resolution: focusObligationResolutionSchema,
  previousStatus: focusObligationStatusSchema,
  /** ④e A7:agent done 销账证据(可选=兼容历史事件;写门在应用层强制) */
  evidence: obligationResolveEvidenceSchema.optional()
});
export const focusEventPayloadLifecycleChangedSchema = z.strictObject({
  ...payloadBase,
  from: focusLifecycleSchema,
  to: focusLifecycleSchema,
  reason: z.string().optional()
});
export const focusEventPayloadProjectRefAddedSchema = z.strictObject({
  ...payloadBase,
  projectId: idSchema,
  note: z.string().optional()
});
export const focusEventPayloadProjectRefRemovedSchema = z.strictObject({
  ...payloadBase,
  projectId: idSchema
});
export const focusEventPayloadPacketFrozenSchema = z.strictObject({
  ...payloadBase,
  revision: z.number().int().positive(),
  digest: digestSchema
});
export const focusEventPayloadPacketConfirmedSchema = z.strictObject({
  ...payloadBase,
  revision: z.number().int().positive(),
  digest: digestSchema
});
export const focusEventPayloadBindingAuthorizedSchema = z.strictObject({
  ...payloadBase,
  bindingId: idSchema,
  taskId: idSchema,
  selectedAuthority: z.enum(["tier1", "hopper"])
});
export const focusEventPayloadBindingLedgerBoundSchema = z.strictObject({
  ...payloadBase,
  bindingId: idSchema,
  authoritativeLedgerRef: z.string().min(1)
});
export const focusEventPayloadAuthorityTransferSchema = z.strictObject({
  ...payloadBase,
  fromAuthority: focusSemanticAuthoritySchema,
  toAuthority: focusSemanticAuthoritySchema,
  fromEpoch: z.number().int().nonnegative(),
  toEpoch: z.number().int().nonnegative()
});
export const focusEventPayloadCloseSettlementSchema = z.strictObject({
  ...payloadBase,
  settlementId: idSchema,
  phase: closeSettlementPhaseSchema,
  closeAttempt: z.number().int().positive()
});
export const focusEventPayloadCorrectionSchema = z.strictObject({
  ...payloadBase,
  correctsEventId: idSchema.optional(),
  note: z.string().min(1)
});

/** 确认环 baseline 三元组(合同 §3.2/§6;payload 冻结) */
export const focusBaselineTripleSchema = z.strictObject({
  focusRevision: z.number().int().nonnegative(),
  eventHWM: z.number().int().nonnegative(),
  obligationsDigest: digestSchema
});
export type FocusBaselineTriple = z.infer<typeof focusBaselineTripleSchema>;

export const focusEventPayloadLaneSplitSchema = z.strictObject({
  ...payloadBase,
  laneIds: z.array(idSchema).min(1),
  titles: z.array(z.string().min(1)).min(1),
  parentLaneIds: z.array(idSchema.nullable()),
  obligationIds: z.array(idSchema),
  baseline: focusBaselineTripleSchema
});
export const focusEventPayloadLaneRetiredSchema = z.strictObject({
  ...payloadBase,
  laneId: idSchema,
  title: z.string().min(1),
  resolvedIds: z.array(idSchema),
  baseline: focusBaselineTripleSchema
});
export const focusEventPayloadRedoFromSchema = z.strictObject({
  ...payloadBase,
  laneId: idSchema,
  anchorSeq: z.number().int().nonnegative(),
  supersededIds: z.array(idSchema),
  baseline: focusBaselineTripleSchema
});
export const focusEventPayloadDependencySetSchema = z.strictObject({
  ...payloadBase,
  depId: idSchema,
  depTitle: z.string().min(1),
  preId: idSchema,
  preTitle: z.string().min(1)
});
export const focusEventPayloadDependencyWokenSchema = z.strictObject({
  ...payloadBase,
  depId: idSchema,
  depTitle: z.string().min(1),
  preId: idSchema,
  preTitle: z.string().min(1)
});
export const focusEventPayloadDependencyBlockedSchema = z.strictObject({
  ...payloadBase,
  depId: idSchema,
  depTitle: z.string().min(1),
  preId: idSchema,
  preTitle: z.string().min(1),
  preResolution: focusObligationResolutionSchema
});
export const focusEventPayloadArtifactLinkedSchema = z.strictObject({
  ...payloadBase,
  artifactId: idSchema,
  kind: z.string().min(1),
  role: z.string().min(1),
  title: z.string().min(1)
});
export const focusEventPayloadArtifactRealizedSchema = z.strictObject({
  ...payloadBase,
  artifactId: idSchema,
  title: z.string().min(1),
  fromRole: z.literal("expected"),
  toRole: z.literal("deliverable"),
  oldRefJson: z.record(z.string(), z.unknown()),
  newRefJson: z.record(z.string(), z.unknown())
});
export const focusEventPayloadFocusForkedSchema = z.strictObject({
  ...payloadBase,
  sourceId: idSchema,
  sourceTitle: z.string().min(1),
  newId: idSchema
});

/** 确认环 timeline 摘要(与 ledger payload_summary 白名单对齐;无 detail/路径全文) */
export const confirmationEventSummarySchema = z.strictObject({
  title: z.string().max(80).optional(),
  dedupeKey: z.string().optional(),
  obligationKind: focusObligationKindSchema.optional()
});

export const focusEventPayloadConfirmationPresentedSchema = z.strictObject({
  ...payloadBase,
  receiptRef: idSchema,
  kind: z.string().min(1),
  summary: confirmationEventSummarySchema.optional()
});
export const focusEventPayloadConfirmationSettledSchema = z.strictObject({
  ...payloadBase,
  receiptRef: idSchema,
  kind: z.string().min(1),
  outcome: z.enum([
    "accepted",
    "rejected",
    "dismissed",
    "to_screen",
    "withdrawn",
    "stale",
    "expired"
  ]),
  summary: confirmationEventSummarySchema.optional()
});
export const focusEventPayloadConfirmationExpiredSchema = z.strictObject({
  ...payloadBase,
  receiptRef: idSchema,
  kind: z.string().min(1),
  summary: confirmationEventSummarySchema.optional()
});
/** ④b 降格已应用标记;receipt 级幂等锚(同 focus 事件流内 receiptRef 唯一) */
export const focusEventPayloadConfirmationDowngradedSchema = z.strictObject({
  ...payloadBase,
  receiptRef: idSchema,
  /** individual=单条落账;batch=并入当日聚合义务 */
  mode: z.enum(["individual", "batch"]).optional()
});

/** ④d adjust 落账:新 pending_ack 行 + 可选旧 active 保留(dispatch 仍读 active) */
export const focusEventPayloadExpectationAdjustedSchema = z.strictObject({
  ...payloadBase,
  expectationId: idSchema,
  logicalKey: z.string().min(1),
  kind: focusExpectationKindSchema,
  fromRevision: z.number().int().nonnegative(),
  toRevision: z.number().int().positive(),
  previousExpectationId: idSchema.optional(),
  text: z.string().min(1),
  patch: z
    .strictObject({
      text: z.string().optional(),
      dueOrTrigger: z.string().optional(),
      budgetNote: z.string().optional()
    })
    .optional()
});

/** ④d ack 终局:CAS 转 active / reject·withdraw 转 superseded */
export const focusEventPayloadExpectationAckSettledSchema = z.strictObject({
  ...payloadBase,
  expectationId: idSchema,
  logicalKey: z.string().min(1),
  kind: focusExpectationKindSchema,
  fromRevision: z.number().int().positive(),
  toRevision: z.number().int().positive(),
  /** accepted | rejected | withdrawn | withdrawn_system */
  outcome: z.enum(["accepted", "rejected", "withdrawn", "withdrawn_system"]),
  previousActiveId: idSchema.optional(),
  receiptRef: idSchema.optional()
});

/** 合同 §3.1 lane 对象 */
export const focusLaneSchema = z.strictObject({
  focusId: idSchema,
  id: idSchema,
  title: z.string().min(1),
  parentLaneId: idSchema.nullable().optional(),
  createdFromEvent: z.number().int().positive(),
  retiredAt: tsSchema.optional()
});
export type FocusLane = z.infer<typeof focusLaneSchema>;

export const focusEventPayloadByType = {
  created: focusEventPayloadCreatedSchema,
  activation_started: focusEventPayloadActivationStartedSchema,
  activation_closed: focusEventPayloadActivationClosedSchema,
  revision_settled: focusEventPayloadRevisionSettledSchema,
  obligation_opened: focusEventPayloadObligationOpenedSchema,
  obligation_status_changed: focusEventPayloadObligationStatusChangedSchema,
  obligation_resolved: focusEventPayloadObligationResolvedSchema,
  lifecycle_changed: focusEventPayloadLifecycleChangedSchema,
  project_ref_added: focusEventPayloadProjectRefAddedSchema,
  project_ref_removed: focusEventPayloadProjectRefRemovedSchema,
  packet_frozen: focusEventPayloadPacketFrozenSchema,
  packet_confirmed: focusEventPayloadPacketConfirmedSchema,
  binding_authorized: focusEventPayloadBindingAuthorizedSchema,
  binding_ledger_bound: focusEventPayloadBindingLedgerBoundSchema,
  authority_transfer: focusEventPayloadAuthorityTransferSchema,
  close_settlement: focusEventPayloadCloseSettlementSchema,
  correction: focusEventPayloadCorrectionSchema,
  lane_split: focusEventPayloadLaneSplitSchema,
  lane_retired: focusEventPayloadLaneRetiredSchema,
  redo_from: focusEventPayloadRedoFromSchema,
  dependency_set: focusEventPayloadDependencySetSchema,
  dependency_woken: focusEventPayloadDependencyWokenSchema,
  dependency_blocked: focusEventPayloadDependencyBlockedSchema,
  artifact_linked: focusEventPayloadArtifactLinkedSchema,
  artifact_realized: focusEventPayloadArtifactRealizedSchema,
  focus_forked: focusEventPayloadFocusForkedSchema,
  confirmation_presented: focusEventPayloadConfirmationPresentedSchema,
  confirmation_settled: focusEventPayloadConfirmationSettledSchema,
  confirmation_expired: focusEventPayloadConfirmationExpiredSchema,
  confirmation_downgraded: focusEventPayloadConfirmationDowngradedSchema,
  expectation_adjusted: focusEventPayloadExpectationAdjustedSchema,
  expectation_ack_settled: focusEventPayloadExpectationAckSettledSchema
} as const;

export type FocusEventPayloadMap = {
  [K in FocusEventType]: z.infer<(typeof focusEventPayloadByType)[K]>;
};

export function parseFocusEventPayload<T extends FocusEventType>(
  type: T,
  payload: unknown
): FocusEventPayloadMap[T] {
  return focusEventPayloadByType[type].parse(payload) as FocusEventPayloadMap[T];
}

export const focusEventSchema = z.strictObject({
  id: idSchema,
  focusId: idSchema,
  seq: z.number().int().positive(),
  type: focusEventTypeSchema,
  payloadSchemaVersion: z.literal(FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION),
  payloadJson: z.string().min(2),
  actorKind: focusActorKindSchema,
  sessionId: idSchema.optional(),
  turnRef: z.string().optional(),
  createdAt: tsSchema
});
export type FocusEvent = z.infer<typeof focusEventSchema>;

// ---------- RpFact / packet / binding (批 2 形状;服务层 M3) ----------

export const rpFactLayerSchema = z.enum(["history", "actionable", "needs_confirmation"]);
export type RpFactLayer = z.infer<typeof rpFactLayerSchema>;

export const rpFactSourceRefSchema = z.strictObject({
  kind: z.enum(["focus_event", "obligation", "transcript_turn", "decision_package"]),
  ref: z.string().min(1)
});

export const rpFactSchema = z
  .strictObject({
    factId: z.string().min(1),
    layer: rpFactLayerSchema,
    text: z.string().min(1),
    asOf: tsSchema.optional(),
    sourceRefs: z.array(rpFactSourceRefSchema).min(1),
    conflict: z.strictObject({ withFactId: z.string().min(1), note: z.string() }).optional(),
    origin: z.enum(["deterministic", "model_summary"])
  })
  .superRefine((f, ctx) => {
    if (f.layer === "actionable" && !f.asOf) {
      ctx.addIssue({ code: "custom", message: "actionable fact requires asOf" });
    }
  });
export type RpFact = z.infer<typeof rpFactSchema>;

export const focusResumePacketSchema = z.strictObject({
  focusId: idSchema,
  revision: z.number().int().positive(),
  baseline: z.strictObject({
    revision: z.number().int().positive(),
    eventHighWatermark: z.number().int().nonnegative(),
    obligationsDigest: digestSchema
  }),
  compiledFrom: z.strictObject({
    eventSeqRange: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
    transcriptRefs: z.array(
      z.strictObject({
        sessionId: idSchema,
        turnRange: z.tuple([z.string(), z.string()]),
        digest: digestSchema
      })
    )
  }),
  compilerVersion: z.string().min(1),
  rendererVersion: z.string().min(1),
  inputDigest: digestSchema,
  factsJson: z.string().min(2),
  obligationsSnapshotJson: z.string().min(2),
  digest: digestSchema,
  createdAt: tsSchema
});
export type FocusResumePacket = z.infer<typeof focusResumePacketSchema>;

export const actionExecutionBindingSchema = z
  .strictObject({
    id: idSchema,
    focusId: idSchema,
    taskId: idSchema,
    focusRevisionAtAuthorization: z.number().int().nonnegative(),
    selectedAuthority: z.enum(["tier1", "hopper"]),
    phase: z.enum(["authorized", "bound"]),
    authorizedByEventId: idSchema,
    authoritativeLedgerRef: z.string().min(1).optional(),
    mode: z.enum(["direct_to_review", "step_confirm"]).optional(),
    settlementRef: z.string().optional(),
    supersededByBindingId: idSchema.optional(),
    createdAt: tsSchema,
    updatedAt: tsSchema
  })
  .superRefine((b, ctx) => {
    if (b.phase === "bound" && !b.authoritativeLedgerRef) {
      ctx.addIssue({ code: "custom", message: "bound binding requires authoritativeLedgerRef" });
    }
  });
export type ActionExecutionBinding = z.infer<typeof actionExecutionBindingSchema>;

// ---------- resolver 判别 ----------

export const focusResolveResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("found"), focus: focusSchema }),
  z.strictObject({ kind: z.literal("not_found") }),
  z.strictObject({ kind: z.literal("closed_or_abandoned"), focus: focusSchema }),
  z.strictObject({ kind: z.literal("authority_mismatch"), focus: focusSchema, expected: focusSemanticAuthoritySchema })
]);
export type FocusResolveResult = z.infer<typeof focusResolveResultSchema>;

/** 未结义务状态(收场/RP exact-set 分母;合同 §5.2 OPEN_SET 同源) */
export const OPEN_OBLIGATION_STATUSES: readonly FocusObligationStatus[] = [
  "open",
  "in_progress",
  "waiting",
  "deferred",
  "blocked"
];

/**
 * 合同 §5.2 attention 未结集合常量(OPEN_SET)。
 * 与 OPEN_OBLIGATION_STATUSES 同值,contracts 导出单源,禁在 daemon 私定义。
 */
export const OPEN_SET = OPEN_OBLIGATION_STATUSES;

export function isOpenObligationStatus(s: FocusObligationStatus): boolean {
  return (OPEN_OBLIGATION_STATUSES as readonly string[]).includes(s);
}

// ---------- timeline 读模型(批次③a;docs/09 §15 + v3 R4 / v4 F5) ----------
// 主干 = focus_events 单源投影;activation_started/closed 合成 session_segment;
// 其余事件 → kind:'event' + eventType(P0 不按类型发明子结构)。
// 前端 console redesign TimelineItem 可另有 note/task 等呈现成员;本契约为 daemon 投影权威。

/** 事件项 refs:从 payload 抽取的可导航 id,无则省略;不做 per-type 子结构 */
export const focusTimelineItemRefsSchema = z
  .object({
    obligationId: idSchema.optional(),
    artifactId: idSchema.optional(),
    taskId: idSchema.optional(),
    bindingId: idSchema.optional(),
    laneId: idSchema.optional(),
    projectId: idSchema.optional(),
    sessionId: idSchema.optional(),
    activationId: idSchema.optional(),
    settlementId: idSchema.optional(),
    revision: z.number().int().nonnegative().optional(),
    sourceId: idSchema.optional(),
    newId: idSchema.optional(),
    depId: idSchema.optional(),
    preId: idSchema.optional()
  })
  .strict();
export type FocusTimelineItemRefs = z.infer<typeof focusTimelineItemRefsSchema>;

export const focusTimelineSessionSegmentSchema = z.strictObject({
  seq: z.number().int().positive(),
  ts: tsSchema,
  kind: z.literal("session_segment"),
  /** activationId:懒加载 GET /api/focuses/:fid/activations/:aid/transcript 的 aid */
  sessionRef: z.string().min(1),
  startTs: tsSchema,
  /** 无 activation_closed 时为 null(中断缺尾,v4 F5) */
  endTs: tsSchema.nullable(),
  turnCount: z.number().int().nonnegative(),
  transcriptAvailable: z.boolean()
});
export type FocusTimelineSessionSegment = z.infer<typeof focusTimelineSessionSegmentSchema>;

export const focusTimelineEventItemSchema = z.strictObject({
  seq: z.number().int().positive(),
  ts: tsSchema,
  kind: z.literal("event"),
  eventType: focusEventTypeSchema,
  summary: z.string().min(1),
  refs: focusTimelineItemRefsSchema
});
export type FocusTimelineEventItem = z.infer<typeof focusTimelineEventItemSchema>;

export const focusTimelineItemSchema = z.discriminatedUnion("kind", [
  focusTimelineSessionSegmentSchema,
  focusTimelineEventItemSchema
]);
export type FocusTimelineItem = z.infer<typeof focusTimelineItemSchema>;

export const focusTimelineResponseSchema = z.strictObject({
  items: z.array(focusTimelineItemSchema),
  /** 下一页水位(更早方向);null=已尽 */
  nextCursor: z.number().int().positive().nullable()
});
export type FocusTimelineResponse = z.infer<typeof focusTimelineResponseSchema>;

/** 会话段转写懒加载:可用时只返轮次;不可用绝不伪造 */
export const focusTranscriptTurnSchema = z.strictObject({
  turnId: z.string().min(1),
  speaker: z.enum(["user", "ai"]),
  text: z.string(),
  ts: tsSchema
});
export type FocusTranscriptTurn = z.infer<typeof focusTranscriptTurnSchema>;

export const focusTranscriptResponseSchema = z.discriminatedUnion("available", [
  z.strictObject({
    available: z.literal(true),
    turns: z.array(focusTranscriptTurnSchema)
  }),
  z.strictObject({
    available: z.literal(false),
    reason: z.literal("not_stored")
  })
]);
export type FocusTranscriptResponse = z.infer<typeof focusTranscriptResponseSchema>;
