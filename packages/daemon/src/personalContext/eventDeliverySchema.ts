// §19.2.4.2：分页状态不是新行动账本；旧映射缺首水位保持 NULL。
export const PERSONAL_CONTEXT_EVENT_DELIVERY_DDL = `
CREATE INDEX personal_context_event_mapping_cursor ON personal_context_event_bindings(mapping_id,commit_sequence);
ALTER TABLE personal_context_event_mappings ADD COLUMN stream_epoch TEXT;
ALTER TABLE personal_context_event_mappings ADD COLUMN initial_sequence INTEGER;
ALTER TABLE personal_context_event_mappings ADD COLUMN acknowledged_sequence INTEGER;
ALTER TABLE personal_context_event_mappings ADD COLUMN progress_revision INTEGER NOT NULL DEFAULT 0;
DROP TRIGGER personal_context_event_mapping_revoke_only;
CREATE TRIGGER personal_context_event_mapping_revoke_only BEFORE UPDATE ON personal_context_event_mappings
WHEN NEW.id IS NOT OLD.id OR NEW.focus_id IS NOT OLD.focus_id OR NEW.session_id IS NOT OLD.session_id
 OR NEW.boundary_json IS NOT OLD.boundary_json OR NEW.link_json IS NOT OLD.link_json
 OR NEW.permission_id IS NOT OLD.permission_id OR NEW.event_kinds_json IS NOT OLD.event_kinds_json
 OR NEW.allow_focus_events IS NOT OLD.allow_focus_events OR NEW.expires_at IS NOT OLD.expires_at
 OR NEW.stream_epoch IS NOT OLD.stream_epoch OR NEW.initial_sequence IS NOT OLD.initial_sequence
 OR NOT ((OLD.state='active' AND NEW.state='revoked' AND NEW.revision=OLD.revision+1
     AND NEW.acknowledged_sequence IS OLD.acknowledged_sequence AND NEW.progress_revision=OLD.progress_revision)
  OR (OLD.state='active' AND NEW.state=OLD.state AND NEW.revision=OLD.revision
     AND OLD.initial_sequence IS NOT NULL AND NEW.acknowledged_sequence>OLD.acknowledged_sequence
     AND NEW.progress_revision=OLD.progress_revision+1))
BEGIN SELECT RAISE(ABORT,'personal_context_event_mapping_immutable'); END;
CREATE UNIQUE INDEX personal_context_event_original_once ON personal_context_operations(
 json_extract(event_source_json,'$.mappingId'),json_extract(event_source_json,'$.mappingRevision'),
 json_extract(event_source_json,'$.streamEpoch'),json_extract(event_source_json,'$.commitSequence'))
 WHERE method='event/ingest' AND event_source_json IS NOT NULL;
CREATE TRIGGER personal_context_event_receipt_immutable BEFORE UPDATE ON personal_context_operations
 WHEN OLD.method='event/ingest' AND OLD.state='applied'
 AND (NEW.state IS NOT OLD.state OR NEW.receipt_digest IS NOT OLD.receipt_digest)
 BEGIN SELECT RAISE(ABORT,'personal_context_event_receipt_immutable'); END;
`;

// v42 保留 v41 历史；旧写者不能跳过未确认事件，读取还须重核原正文摘要。
export const PERSONAL_CONTEXT_EVENT_CURSOR_GUARD_DDL = `
CREATE TRIGGER personal_context_event_cursor_ack_required BEFORE UPDATE OF acknowledged_sequence ON personal_context_event_mappings
WHEN OLD.initial_sequence IS NOT NULL AND NEW.acknowledged_sequence IS NOT OLD.acknowledged_sequence
 AND (NEW.acknowledged_sequence IS NOT (SELECT MIN(commit_sequence) FROM personal_context_event_bindings WHERE mapping_id=OLD.id AND commit_sequence>OLD.acknowledged_sequence)
 OR NOT EXISTS (SELECT 1 FROM personal_context_operations
   WHERE method='event/ingest' AND event_source_json IS NOT NULL
    AND json_extract(event_source_json,'$.mappingId')=OLD.id
    AND json_extract(event_source_json,'$.mappingRevision')=OLD.revision
    AND json_extract(event_source_json,'$.streamEpoch')=OLD.stream_epoch
    AND json_extract(event_source_json,'$.commitSequence')=NEW.acknowledged_sequence
    AND state='applied' AND receipt_digest IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'personal_context_event_cursor_ack_required'); END;
`;
