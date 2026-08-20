// Focus 域行 ↔ 契约对象映射(snake_case DB ↔ camelCase contracts)。

import {
  focusActivationSchema,
  focusObligationSchema,
  focusSchema,
  focusStateSchema,
  closeSettlementSchema,
  type Focus,
  type FocusActivation,
  type FocusObligation,
  type FocusState,
  type CloseSettlement,
  type FrozenInputs,
  type FocusEventType,
  type FocusActorKind
} from "@saydo/contracts";

export interface FocusRow {
  id: string;
  title: string;
  lifecycle: string;
  semantic_authority: string;
  authority_epoch: number;
  current_revision: number;
  created_at: string;
  updated_at: string;
}

export function focusFromRow(row: FocusRow): Focus {
  return focusSchema.parse({
    id: row.id,
    title: row.title,
    lifecycle: row.lifecycle,
    semanticAuthority: row.semantic_authority,
    authorityEpoch: row.authority_epoch,
    currentRevision: row.current_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export interface ObligationRow {
  id: string;
  focus_id: string;
  kind: string;
  title: string;
  detail: string | null;
  owner: string;
  status: string;
  verification: string;
  waiting_on: string | null;
  defer_reason: string | null;
  next_step: string | null;
  due_or_trigger: string | null;
  blocking: number;
  project_ref: string | null;
  action_ref: string | null;
  source_session_id: string | null;
  source_turn_ref: string | null;
  dedupe_key: string;
  /** v20 additive;老查询/测试行可能缺列 */
  needs?: string | null;
  /** v23:lane / 依赖 / 开账事件 */
  lane_id?: string | null;
  created_from_event?: number | null;
  waiting_on_obligation_id?: string | null;
  /** v27:过期确认降格溯源(confirm_expired / confirm_expired_batch) */
  provenance?: string | null;
  resolution_event_id: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export function obligationFromRow(row: ObligationRow): FocusObligation {
  return focusObligationSchema.parse({
    id: row.id,
    focusId: row.focus_id,
    kind: row.kind,
    title: row.title,
    ...(row.detail != null ? { detail: row.detail } : {}),
    owner: row.owner,
    status: row.status,
    verification: row.verification,
    ...(row.waiting_on != null ? { waitingOn: row.waiting_on } : {}),
    ...(row.waiting_on_obligation_id != null ? { waitingOnObligationId: row.waiting_on_obligation_id } : {}),
    ...(row.defer_reason != null ? { deferReason: row.defer_reason } : {}),
    ...(row.next_step != null ? { nextStep: row.next_step } : {}),
    ...(row.due_or_trigger != null ? { dueOrTrigger: row.due_or_trigger } : {}),
    blocking: row.blocking === 1,
    ...(row.project_ref != null ? { projectRef: row.project_ref } : {}),
    ...(row.action_ref != null ? { actionRef: row.action_ref } : {}),
    ...(row.source_session_id != null ? { sourceSessionId: row.source_session_id } : {}),
    ...(row.source_turn_ref != null ? { sourceTurnRef: row.source_turn_ref } : {}),
    dedupeKey: row.dedupe_key,
    ...(row.lane_id != null ? { laneId: row.lane_id } : {}),
    ...(row.created_from_event != null ? { createdFromEvent: row.created_from_event } : {}),
    ...(row.needs != null ? { needs: row.needs } : {}),
    ...(row.provenance != null ? { provenance: row.provenance } : {}),
    ...(row.resolution_event_id != null ? { resolutionEventId: row.resolution_event_id } : {}),
    ...(row.resolution != null ? { resolution: row.resolution } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export interface ActivationRow {
  id: string;
  focus_id: string;
  session_id: string;
  anchor_revision: number;
  input_focus_revision: number;
  resume_source: string;
  packet_revision: number | null;
  trigger: string;
  status: string;
  output_focus_revision: number | null;
  started_at: string;
  closed_at: string | null;
}

export function activationFromRow(row: ActivationRow): FocusActivation {
  return focusActivationSchema.parse({
    id: row.id,
    focusId: row.focus_id,
    sessionId: row.session_id,
    anchorRevision: row.anchor_revision,
    inputFocusRevision: row.input_focus_revision,
    resumeSource: row.resume_source,
    ...(row.packet_revision != null ? { packetRevision: row.packet_revision } : {}),
    trigger: row.trigger,
    status: row.status,
    ...(row.output_focus_revision != null ? { outputFocusRevision: row.output_focus_revision } : {}),
    startedAt: row.started_at,
    ...(row.closed_at != null ? { closedAt: row.closed_at } : {})
  });
}

export interface StateRow {
  focus_id: string;
  revision: number;
  current_direction: string;
  last_reliable_state: string;
  next_activation_trigger: string | null;
  accepted_decision_refs_json: string;
  event_high_watermark: number;
  obligations_digest: string;
  created_by_session_id: string | null;
  created_at: string;
}

export function stateFromRow(row: StateRow): FocusState {
  return focusStateSchema.parse({
    focusId: row.focus_id,
    revision: row.revision,
    currentDirection: row.current_direction,
    lastReliableState: row.last_reliable_state,
    ...(row.next_activation_trigger != null ? { nextActivationTrigger: row.next_activation_trigger } : {}),
    acceptedDecisionRefs: JSON.parse(row.accepted_decision_refs_json) as unknown[],
    eventHighWatermark: row.event_high_watermark,
    obligationsDigest: row.obligations_digest,
    ...(row.created_by_session_id != null ? { createdBySessionId: row.created_by_session_id } : {}),
    createdAt: row.created_at
  });
}

export interface SettlementRow {
  id: string;
  session_id: string;
  focus_id: string;
  activation_id: string;
  idempotency_key: string;
  close_attempt: number;
  frozen_inputs_json: string;
  candidates_json: string;
  decisions_json: string | null;
  presentation_id: string | null;
  phase: string;
  created_at: string;
  updated_at: string;
}

export function settlementFromRow(row: SettlementRow): CloseSettlement {
  const frozen = JSON.parse(row.frozen_inputs_json) as FrozenInputs;
  return closeSettlementSchema.parse({
    id: row.id,
    sessionId: row.session_id,
    focusId: row.focus_id,
    activationId: row.activation_id,
    idempotencyKey: row.idempotency_key,
    closeAttempt: row.close_attempt,
    frozenInputs: frozen,
    candidatesJson: row.candidates_json,
    ...(row.decisions_json != null ? { decisionsJson: row.decisions_json } : {}),
    ...(row.presentation_id != null ? { presentationId: row.presentation_id } : {}),
    phase: row.phase,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export interface EventInsert {
  id: string;
  focusId: string;
  seq: number;
  type: FocusEventType;
  payloadSchemaVersion: number;
  payloadJson: string;
  actorKind: FocusActorKind;
  sessionId?: string | undefined;
  turnRef?: string | undefined;
  createdAt: string;
}
