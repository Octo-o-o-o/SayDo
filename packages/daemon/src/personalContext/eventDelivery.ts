// §19.2.4.2：原 journal 单发；这里没有第二个行动账本或自动重放器。
import { randomUUID } from "node:crypto";
import { jcsSerialize, PERSONAL_CONTEXT_PROTOCOL, personalContextEffectDigest, personalContextEffectSchema,
  personalContextEventMappingSchema, personalContextEventOwnerRegisterSchema, personalContextEventOwnerRevokeSchema,
  personalContextEventPollQuerySchema, personalContextEventAckQuerySchema, personalContextEventPollResultSchema,
  personalContextEventAckResultSchema, type PersonalContextPeerIdentity } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { withSqliteAuditTransaction } from "../api/sqliteAuditTransaction.js";
import { withPersonalContextClock, personalContextOperationTime } from "./clock.js";
import { PersonalContextEvents, assertPersonalContextEventSource } from "./events.js";
import type { ContextEventMappingRow } from "./eventCapture.js";
import type { PersonalContextRegistry } from "./registry.js";
import { PersonalContextJournal } from "./journal.js";

type Poll = ReturnType<typeof personalContextEventPollQuerySchema.parse>;
type PollResult = ReturnType<typeof personalContextEventPollResultSchema.parse>;
type Ack = ReturnType<typeof personalContextEventAckQuerySchema.parse>;
interface Operation { operation_id: string; payload_digest: string; state: string; receipt_digest: string | null; boundary_json: string; link_json: string; event_source_json: string; expires_at: number }

export class PersonalContextEventDelivery {
  constructor(private readonly db: Db, private readonly audit: AuditSink, private readonly registry: PersonalContextRegistry) {
    if (audit.sharesSqlite?.(db) !== true || !registry.sharesDatabase(db)) throw Error("personal_context_same_database_required");
  }
  private tx<T>(work: () => T): T { return withPersonalContextClock(this.db, () => withSqliteAuditTransaction(this.db, this.audit, work)); }
  private source(peer: PersonalContextPeerIdentity): PersonalContextEvents {
    return new PersonalContextEvents(this.db, this.audit, {
      sharesDatabase: db => db === this.db,
      assertOwnerRegistration: mapping => this.registry.assertEventMapping(peer, mapping),
      assertOwnerRevocation: id => { this.mapping(peer, id); },
      assertReadCurrent: mapping => this.registry.assertEventMapping(peer, mapping),
    });
  }
  private mapping(peer: PersonalContextPeerIdentity, id: string) {
    const row = this.db.prepare("SELECT * FROM personal_context_event_mappings WHERE id=?").get(id) as ContextEventMappingRow | undefined;
    if (!row || row.state !== "active" || row.expires_at <= personalContextOperationTime(this.db)) throw Error("personal_context_event_mapping_unavailable");
    const mapping = personalContextEventMappingSchema.parse({ id: row.id, boundary: JSON.parse(row.boundary_json), link: JSON.parse(row.link_json), permissionId: row.permission_id, eventKinds: JSON.parse(row.event_kinds_json), allowFocusEvents: row.allow_focus_events === 1, expiresAt: row.expires_at });
    this.registry.assertEventMapping(peer, mapping);
    const stream = this.db.prepare("SELECT stream_epoch FROM personal_context_event_stream_identity WHERE singleton=1").get() as { stream_epoch: string };
    if (row.stream_epoch !== stream.stream_epoch || row.initial_sequence === null || row.acknowledged_sequence === null || !Number.isSafeInteger(row.initial_sequence) || !Number.isSafeInteger(row.acknowledged_sequence) || row.initial_sequence < 0 || row.acknowledged_sequence < row.initial_sequence) throw Error("personal_context_event_original_cursor_missing");
    if (!Number.isSafeInteger(row.progress_revision) || row.progress_revision < 0) throw Error("personal_context_event_progress_damaged");
    if (row.acknowledged_sequence === row.initial_sequence) {
      if (row.progress_revision !== 0) throw Error("personal_context_event_progress_damaged");
    } else {
      const original = this.original({ method: "event/poll", mappingId: row.id, mappingRevision: row.revision, streamEpoch: row.stream_epoch }, row.acknowledged_sequence);
      if (!original || original.state !== "applied" || !original.receipt_digest || !/^sha256:[0-9a-f]{64}$/.test(original.receipt_digest) || row.progress_revision < 1) throw Error("personal_context_event_progress_damaged");
      this.effect(original);
    }
    return { row, mapping };
  }
  register(input: unknown) {
    const value = personalContextEventOwnerRegisterSchema.parse(input);
    return this.tx(() => {
      const prior = this.db.prepare("SELECT id FROM personal_context_event_mappings WHERE id=?").get(value.mapping.id);
      if (prior) {
        const original = this.mapping(value.identity, value.mapping.id);
        if (jcsSerialize(original.mapping) !== jcsSerialize(value.mapping)) throw Error("personal_context_event_mapping_conflict");
      } else this.source(value.identity).register(value.mapping);
      const { row } = this.mapping(value.identity, value.mapping.id);
      return { mappingId: row.id, mappingRevision: row.revision, streamEpoch: row.stream_epoch, initialSequence: row.initial_sequence };
    });
  }
  revoke(input: unknown): void {
    const value = personalContextEventOwnerRevokeSchema.parse(input);
    this.tx(() => {
      const row = this.db.prepare("SELECT * FROM personal_context_event_mappings WHERE id=?").get(value.mappingId) as ContextEventMappingRow | undefined;
      if (!row) throw Error("personal_context_event_mapping_unavailable");
      const mapping = personalContextEventMappingSchema.parse({ id: row.id, boundary: JSON.parse(row.boundary_json), link: JSON.parse(row.link_json), permissionId: row.permission_id, eventKinds: JSON.parse(row.event_kinds_json), allowFocusEvents: row.allow_focus_events === 1, expiresAt: row.expires_at });
      this.registry.assertEventMappingRevocation(value.identity, mapping);
      new PersonalContextEvents(this.db, this.audit, { sharesDatabase: db => db === this.db,
        assertOwnerRegistration: () => { throw Error("personal_context_permission_denied"); },
        assertOwnerRevocation: () => this.registry.assertEventMappingRevocation(value.identity, mapping),
        assertReadCurrent: () => { throw Error("personal_context_permission_denied"); } }).revoke(value.mappingId, value.expectedRevision);
    });
  }
  private scope(peer: PersonalContextPeerIdentity, query: Poll | Ack) {
    const found = this.mapping(peer, query.mappingId);
    if (found.row.revision !== query.mappingRevision || found.row.stream_epoch !== query.streamEpoch) throw Error("personal_context_event_mapping_stale");
    return found;
  }
  private original(query: Poll | Ack, sequence: number): Operation | undefined {
    return this.db.prepare("SELECT * FROM personal_context_operations WHERE method='event/ingest' AND event_source_json IS NOT NULL AND json_extract(event_source_json,'$.mappingId')=? AND json_extract(event_source_json,'$.mappingRevision')=? AND json_extract(event_source_json,'$.streamEpoch')=? AND json_extract(event_source_json,'$.commitSequence')=?")
      .get(query.mappingId, query.mappingRevision, query.streamEpoch, sequence) as Operation | undefined;
  }
  private effect(row: Operation) {
    const effect = personalContextEffectSchema.parse({ protocol: PERSONAL_CONTEXT_PROTOCOL, method: "event/ingest", operationId: row.operation_id, boundary: JSON.parse(row.boundary_json), link: JSON.parse(row.link_json), payload: JSON.parse(row.event_source_json), expiresAt: row.expires_at, payloadDigest: row.payload_digest });
    if (effect.method !== "event/ingest") throw Error("personal_context_event_provenance_invalid");
    assertPersonalContextEventSource(this.db, effect); return effect;
  }
  poll(peer: PersonalContextPeerIdentity, input: unknown): PollResult {
    const query = personalContextEventPollQuerySchema.parse(input);
    return this.tx(() => {
      const { row, mapping } = this.scope(peer, query), after = row.acknowledged_sequence!;
      const next = this.source(peer).page(row.id, after, 1)[0];
      const cursor = { mappingId: row.id, mappingRevision: row.revision, streamEpoch: query.streamEpoch };
      if (!next) return { kind: "empty", ...cursor, acknowledgedSequence: after };
      const original = this.original(query, next.payload.commitSequence);
      if (original) {
        this.effect(original);
        if (original.state !== "unknown" || original.receipt_digest !== null) throw Error("personal_context_event_progress_damaged");
        return { kind: "blocked_unknown", ...cursor, commitSequence: next.payload.commitSequence, operationId: original.operation_id, payloadDigest: original.payload_digest };
      }
      const unsigned = { protocol: PERSONAL_CONTEXT_PROTOCOL, method: "event/ingest" as const, operationId: randomUUID(), ...next, expiresAt: mapping.expiresAt };
      const effect = personalContextEffectSchema.parse({ ...unsigned, payloadDigest: personalContextEffectDigest(unsigned) });
      const journal = new PersonalContextJournal(this.db, this.audit, { sharesDatabase: db => db === this.db,
        assertEffectCurrent: value => { this.scope(peer, query); if (value.method !== "event/ingest") throw Error("personal_context_event_provenance_invalid"); assertPersonalContextEventSource(this.db, value); },
        assertStatusCurrent: () => { throw Error("personal_context_event_status_requires_original_scope"); } });
      if (!journal.admitOutbound(effect).admitted) throw Error("personal_context_event_already_admitted");
      return personalContextEventPollResultSchema.parse({ kind: "effect", effect });
    });
  }
  assertPollCurrent(peer: PersonalContextPeerIdentity, input: unknown, result: PollResult): void {
    const query = personalContextEventPollQuerySchema.parse(input);
    this.tx(() => {
      const { row } = this.scope(peer, query);
      if (result.kind === "empty") {
        if (row.acknowledged_sequence !== result.acknowledgedSequence) throw Error("personal_context_event_progress_changed");
        return;
      }
      const sequence = result.kind === "effect" && result.effect.method === "event/ingest" ? result.effect.payload.commitSequence : result.kind === "blocked_unknown" ? result.commitSequence : -1;
      const original = this.original(query, sequence);
      if (!original || original.state !== "unknown" || original.receipt_digest !== null || sequence <= row.acknowledged_sequence!) throw Error("personal_context_event_progress_changed");
      const effect = this.effect(original);
      if (result.kind === "effect" ? jcsSerialize(effect) !== jcsSerialize(result.effect) : original.operation_id !== result.operationId || original.payload_digest !== result.payloadDigest) throw Error("personal_context_event_provenance_invalid");
    });
  }
  /** 原生 commit 只同步发起当前帧；异步 I/O 等待仍由 transport 在事务外承担。 */
  writePoll(peer: PersonalContextPeerIdentity, input: unknown, result: PollResult, commit: () => void): void {
    this.tx(() => { this.assertPollCurrent(peer, input, result); return commit(); });
  }
  writeAck(peer: PersonalContextPeerIdentity, input: unknown, result: unknown, commit: () => void): void {
    this.tx(() => {
      if (jcsSerialize(this.ack(peer, input)) !== jcsSerialize(result)) throw Error("personal_context_event_ack_conflict");
      return commit();
    });
  }
  ack(peer: PersonalContextPeerIdentity, input: unknown) {
    const query = personalContextEventAckQuerySchema.parse(input);
    return this.tx(() => {
      const { row } = this.scope(peer, query), original = this.original(query, query.commitSequence);
      if (!original || original.operation_id !== query.operationId || original.payload_digest !== query.payloadDigest) throw Error("personal_context_event_ack_conflict");
      this.effect(original);
      const { method, ...fields } = query; void method;
      const result = personalContextEventAckResultSchema.parse({ ...fields, state: "acknowledged" });
      if (original.state === "applied") {
        if (original.receipt_digest !== query.sourceReceiptDigest || row.acknowledged_sequence! < query.commitSequence) throw Error("personal_context_event_ack_conflict");
        return result;
      }
      const next = this.source(peer).page(row.id, row.acknowledged_sequence!, 1)[0];
      if (original.state !== "unknown" || original.receipt_digest !== null || next?.payload.commitSequence !== query.commitSequence) throw Error("personal_context_event_ack_conflict");
      const changed = this.db.prepare("UPDATE personal_context_operations SET state='applied',receipt_digest=?,observed_at=? WHERE method='event/ingest' AND operation_id=? AND payload_digest=? AND event_source_json=? AND state='unknown' AND receipt_digest IS NULL")
        .run(query.sourceReceiptDigest, personalContextOperationTime(this.db), query.operationId, query.payloadDigest, original.event_source_json);
      if (changed.changes !== 1) throw Error("personal_context_event_ack_conflict");
      const cursor = this.db.prepare("UPDATE personal_context_event_mappings SET acknowledged_sequence=?,progress_revision=progress_revision+1 WHERE id=? AND revision=? AND progress_revision=? AND acknowledged_sequence=? AND state='active'")
        .run(query.commitSequence, row.id, row.revision, row.progress_revision, row.acknowledged_sequence);
      if (cursor.changes !== 1) throw Error("personal_context_event_ack_conflict");
      this.audit.record({ actor: "bridge", action: "personal_context.event_acknowledged", refDigest: query.payloadDigest, meta: { mappingId: row.id, operationId: query.operationId, commitSequence: query.commitSequence, sourceReceiptDigest: query.sourceReceiptDigest } });
      return result;
    });
  }
}
