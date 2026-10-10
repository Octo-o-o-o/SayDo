// §19.4：登记权限与源端事件投影分离；此服务不授予派发或 owner 回应权限。
import { jcsDigest, personalContextEventMappingSchema, personalContextBoundarySchema, personalContextLinkSchema, type PersonalContextEventMapping, type PersonalContextEffect } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { withSqliteAuditTransaction } from "../api/sqliteAuditTransaction.js";
import { assertPersonalContextSourceCurrent } from "./sourceAuthority.js";
import { contextSourceEventDigest, type ContextEventMappingRow, type ContextSourceEventRow } from "./eventCapture.js";
import { withPersonalContextClock, personalContextOperationTime } from "./clock.js";

export interface PersonalContextEventAuthority {
  sharesDatabase(db: Db): boolean;
  // 生产组合根必须复核已认证 owner、当前连接及独立披露授权，不由输入自报。
  assertOwnerRegistration(mapping: PersonalContextEventMapping): void;
  assertOwnerRevocation(mappingId: string): void;
  assertReadCurrent(mapping: PersonalContextEventMapping): void;
}
interface BindingRow { commit_sequence: number; mapping_id: string; mapping_revision: number; boundary_json: string; link_json: string; event_id: string; source_digest: string; focus_revision: number; focus_authority_epoch: number }

function currentMapping(db: Db, id: string): { row: ContextEventMappingRow; mapping: PersonalContextEventMapping } {
  const row = db.prepare("SELECT * FROM personal_context_event_mappings WHERE id=? AND state='active'").get(id) as ContextEventMappingRow | undefined;
  const at = personalContextOperationTime(db);
  if (!row || row.expires_at <= at) throw new Error("personal_context_event_mapping_unavailable");
  const mapping = personalContextEventMappingSchema.parse({ id: row.id, boundary: JSON.parse(row.boundary_json), link: JSON.parse(row.link_json), permissionId: row.permission_id, eventKinds: JSON.parse(row.event_kinds_json), allowFocusEvents: row.allow_focus_events === 1, expiresAt: row.expires_at });
  if (mapping.link.focusId !== row.focus_id || mapping.link.sessionId !== row.session_id) throw new Error("personal_context_event_mapping_damaged");
  return { row, mapping };
}

function observation(db: Db, binding: BindingRow, row: ContextEventMappingRow) {
  const source = db.prepare("SELECT * FROM focus_events WHERE id=?").get(binding.event_id) as ContextSourceEventRow | undefined;
  const link = personalContextLinkSchema.parse(JSON.parse(binding.link_json));
  const boundary = personalContextBoundarySchema.parse(JSON.parse(binding.boundary_json));
  const registeredLink = personalContextLinkSchema.parse(JSON.parse(row.link_json));
  const registeredBoundary = personalContextBoundarySchema.parse(JSON.parse(row.boundary_json));
  if (jcsDigest(boundary) !== jcsDigest(registeredBoundary) ||
      jcsDigest({ ...link, focusRevision: registeredLink.focusRevision, focusAuthorityEpoch: registeredLink.focusAuthorityEpoch }) !== jcsDigest(registeredLink) ||
      link.focusRevision !== binding.focus_revision || link.focusAuthorityEpoch !== binding.focus_authority_epoch) {
    throw new Error("personal_context_event_provenance_invalid");
  }
  const kinds = JSON.parse(row.event_kinds_json) as string[];
  if (!source || contextSourceEventDigest(source) !== binding.source_digest || source.focus_id !== row.focus_id || link.focusId !== row.focus_id || link.sessionId !== row.session_id || binding.mapping_revision !== row.revision || !kinds.includes(source.type) || (source.session_id === null ? row.allow_focus_events !== 1 : source.session_id !== row.session_id)) throw new Error("personal_context_event_provenance_invalid");
  const stream = db.prepare("SELECT stream_epoch FROM personal_context_event_stream_identity WHERE singleton=1").get() as { stream_epoch: string };
  return { boundary, link, payload: { mappingId: row.id, mappingRevision: binding.mapping_revision, sourceEventId: source.id, sourceSessionId: source.session_id, focusSequence: source.seq, streamEpoch: stream.stream_epoch, commitSequence: binding.commit_sequence, eventKind: source.type, sourceDigest: binding.source_digest, summary: "" } };
}

/** 只核验已提交原事件；不调用活动 Focus 写闸，不允许凭此恢复执行权。 */
export function assertPersonalContextEventSource(db: Db, effect: Extract<PersonalContextEffect, { method: "event/ingest" }>): void {
  if (!db.inTransaction) throw new Error("personal_context_event_requires_transaction");
  const { row } = currentMapping(db, effect.payload.mappingId);
  const binding = db.prepare("SELECT b.*,s.event_id,s.source_digest,s.focus_revision,s.focus_authority_epoch FROM personal_context_event_bindings b JOIN personal_context_event_stream s USING(commit_sequence) WHERE b.mapping_id=? AND b.commit_sequence=?").get(row.id, effect.payload.commitSequence) as BindingRow | undefined;
  if (!binding) throw new Error("personal_context_event_provenance_missing");
  const expected = observation(db, binding, row);
  if (jcsDigest(expected) !== jcsDigest({ boundary: effect.boundary, link: effect.link, payload: effect.payload })) throw new Error("personal_context_event_provenance_invalid");
}

export class PersonalContextEvents {
  constructor(private readonly db: Db, private readonly audit: AuditSink, private readonly authority: PersonalContextEventAuthority) {
    if (!authority.sharesDatabase(db) || audit.sharesSqlite?.(db) !== true) throw new Error("personal_context_same_database_required");
  }
  register(input: unknown): void {
    const mapping = personalContextEventMappingSchema.parse(input);
    withPersonalContextClock(this.db, () => withSqliteAuditTransaction(this.db, this.audit, () => {
      this.authority.assertOwnerRegistration(mapping);
      assertPersonalContextSourceCurrent(this.db, mapping.link);
      const at = personalContextOperationTime(this.db);
      if (mapping.expiresAt <= at) throw new Error("personal_context_event_mapping_expired");
      const count = this.db.prepare("SELECT count(*) n FROM personal_context_event_mappings WHERE state='active'").get() as { n: number };
      if (count.n >= 100) throw new Error("personal_context_event_mapping_capacity");
      this.db.prepare("INSERT INTO personal_context_event_mappings(id,revision,state,focus_id,session_id,boundary_json,link_json,permission_id,event_kinds_json,allow_focus_events,expires_at) VALUES(?,1,'active',?,?,?,?,?,?,?,?)").run(mapping.id, mapping.link.focusId, mapping.link.sessionId, JSON.stringify(mapping.boundary), JSON.stringify(mapping.link), mapping.permissionId, JSON.stringify(mapping.eventKinds), Number(mapping.allowFocusEvents), mapping.expiresAt);
      this.audit.record({ actor: "owner", action: "personal_context.event_mapping_registered", refDigest: jcsDigest(mapping), meta: { mappingId: mapping.id } });
    }));
  }
  revoke(id: string, revision: number): void {
    withSqliteAuditTransaction(this.db, this.audit, () => {
      this.authority.assertOwnerRevocation(id);
      const result = this.db.prepare("UPDATE personal_context_event_mappings SET state='revoked',revision=revision+1 WHERE id=? AND revision=? AND state='active'").run(id, revision);
      if (result.changes !== 1) throw new Error("personal_context_event_mapping_stale");
      this.audit.record({ actor: "owner", action: "personal_context.event_mapping_revoked", meta: { mappingId: id, revision } });
    });
  }
  page(id: string, after: number, limit = 50) {
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error("personal_context_event_cursor_invalid");
    return withPersonalContextClock(this.db, () => this.db.transaction(() => {
      const { row, mapping } = currentMapping(this.db, id);
      this.authority.assertReadCurrent(mapping);
      const bindings = this.db.prepare("SELECT b.*,s.event_id,s.source_digest,s.focus_revision,s.focus_authority_epoch FROM personal_context_event_bindings b JOIN personal_context_event_stream s USING(commit_sequence) WHERE b.mapping_id=? AND b.commit_sequence>? ORDER BY b.commit_sequence LIMIT ?").all(id, after, limit) as BindingRow[];
      return bindings.map(binding => observation(this.db, binding, row));
    }).immediate());
  }
}
