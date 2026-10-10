// §19.4：此函数只由原生 appendEvent 在同一事务调用，不提供任意事件注入入口。
import { jcsDigest, personalContextBoundarySchema, personalContextLinkSchema } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { personalContextOperationTime } from "./clock.js";

export interface ContextSourceEventRow {
  id: string; focus_id: string; seq: number; type: string; payload_schema_version: number;
  payload_json: string; actor_kind: string; session_id: string | null; turn_ref: string | null; created_at: string;
}
export interface ContextEventMappingRow {
  id: string; revision: number; state: string; focus_id: string; session_id: string;
  boundary_json: string; link_json: string; permission_id: string; event_kinds_json: string;
  allow_focus_events: number; expires_at: number;
}

export function contextSourceEventDigest(row: ContextSourceEventRow): string {
  return jcsDigest({ ...row, payload_json: JSON.parse(row.payload_json) as unknown });
}

export function captureRegisteredContextEvent(db: Db, eventId: string): void {
  if (!db.inTransaction) throw new Error("personal_context_event_requires_transaction");
  const event = db.prepare("SELECT * FROM focus_events WHERE id=?").get(eventId) as ContextSourceEventRow | undefined;
  if (!event) throw new Error("personal_context_event_missing");
  const mappings = db.prepare("SELECT * FROM personal_context_event_mappings WHERE focus_id=? AND state='active' ORDER BY id").all(event.focus_id) as ContextEventMappingRow[];
  if (!mappings.length) return;
  // 过期映射不产生新交付；发送时仍须独立复核当前许可和持久时钟水位。
  const at = personalContextOperationTime(db);
  const permitted = mappings.filter(mapping => {
    const kinds: unknown = JSON.parse(mapping.event_kinds_json);
    if (!Array.isArray(kinds) || !kinds.every(kind => typeof kind === "string")) throw new Error("personal_context_event_mapping_damaged");
    return mapping.expires_at > at && kinds.includes(event.type) && (event.session_id === null ? mapping.allow_focus_events === 1 : event.session_id === mapping.session_id);
  });
  if (!permitted.length) return;
  const focus = db.prepare("SELECT current_revision,authority_epoch FROM focuses WHERE id=?").get(event.focus_id) as { current_revision: number; authority_epoch: number };
  const sequence = db.prepare("INSERT INTO personal_context_event_stream(event_id,source_digest,focus_revision,focus_authority_epoch) VALUES(?,?,?,?)").run(event.id, contextSourceEventDigest(event), focus.current_revision, focus.authority_epoch).lastInsertRowid;
  for (const mapping of permitted) {
    const boundary = personalContextBoundarySchema.parse(JSON.parse(mapping.boundary_json));
    const link = personalContextLinkSchema.parse(JSON.parse(mapping.link_json));
    if (link.focusId !== event.focus_id || link.sessionId !== mapping.session_id) throw new Error("personal_context_event_mapping_damaged");
    const captured = { ...link, focusRevision: focus.current_revision, focusAuthorityEpoch: focus.authority_epoch };
    db.prepare("INSERT INTO personal_context_event_bindings(commit_sequence,mapping_id,mapping_revision,boundary_json,link_json) VALUES(?,?,?,?,?)").run(sequence, mapping.id, mapping.revision, JSON.stringify(boundary), JSON.stringify(captured));
  }
}
