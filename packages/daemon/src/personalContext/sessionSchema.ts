// §19.2.4：会话生命周期不是业务操作账本；未知占位必须保留。
export const PERSONAL_CONTEXT_SESSION_DDL = `
ALTER TABLE personal_context_operations ADD COLUMN boundary_json TEXT;
ALTER TABLE personal_context_operations ADD COLUMN link_json TEXT;
ALTER TABLE personal_context_operations ADD COLUMN event_source_json TEXT;
CREATE TRIGGER personal_context_operation_scope_immutable BEFORE UPDATE ON personal_context_operations
 WHEN NEW.boundary_json IS NOT OLD.boundary_json OR NEW.link_json IS NOT OLD.link_json
 OR NEW.event_source_json IS NOT OLD.event_source_json OR NEW.expires_at IS NOT OLD.expires_at
 OR NEW.installation_id IS NOT OLD.installation_id OR NEW.node_id IS NOT OLD.node_id
 OR NEW.connection_id IS NOT OLD.connection_id OR NEW.connection_epoch IS NOT OLD.connection_epoch
 OR NEW.method IS NOT OLD.method OR NEW.operation_id IS NOT OLD.operation_id
 OR NEW.payload_digest IS NOT OLD.payload_digest
 BEGIN SELECT RAISE(ABORT,'personal_context_operation_scope_immutable'); END;
CREATE TABLE personal_context_sessions (
 operation_id TEXT PRIMARY KEY,
 registration_id TEXT NOT NULL REFERENCES personal_context_registrations(id),
 registration_revision INTEGER NOT NULL CHECK(registration_revision>0),
 request_digest TEXT NOT NULL,
 identity_json TEXT NOT NULL,
 key_operation_id TEXT NOT NULL REFERENCES personal_context_key_preparations(operation_id),
 key_revision INTEGER NOT NULL CHECK(key_revision>0),
 boot_epoch TEXT NOT NULL,
 owner_pid INTEGER NOT NULL CHECK(owner_pid>0),
 owner_birth TEXT NOT NULL,
 endpoint TEXT,
 state TEXT NOT NULL CHECK(state IN ('opening','listening','connected','stopping','unknown','closed')),
 revision INTEGER NOT NULL CHECK(revision>0),
 failure_code TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 CHECK(state NOT IN ('listening','connected') OR endpoint IS NOT NULL)
);
CREATE UNIQUE INDEX personal_context_session_active_registration ON personal_context_sessions(registration_id) WHERE state!='closed';
CREATE TRIGGER personal_context_session_update_guard BEFORE UPDATE ON personal_context_sessions
 WHEN NEW.operation_id IS NOT OLD.operation_id OR NEW.registration_id IS NOT OLD.registration_id
 OR NEW.registration_revision IS NOT OLD.registration_revision OR NEW.request_digest IS NOT OLD.request_digest
 OR NEW.identity_json IS NOT OLD.identity_json OR NEW.key_operation_id IS NOT OLD.key_operation_id
 OR NEW.key_revision IS NOT OLD.key_revision OR NEW.boot_epoch IS NOT OLD.boot_epoch
 OR NEW.owner_pid IS NOT OLD.owner_pid OR NEW.owner_birth IS NOT OLD.owner_birth
 OR NEW.created_at IS NOT OLD.created_at OR NEW.updated_at<OLD.updated_at
 OR NEW.revision IS NOT OLD.revision+1
 OR (OLD.endpoint IS NOT NULL AND NEW.endpoint IS NOT OLD.endpoint)
 OR (OLD.endpoint IS NULL AND NEW.endpoint IS NOT NULL AND NOT (OLD.state='opening' AND NEW.state='listening'))
 OR NOT ((OLD.state='opening' AND NEW.state IN ('listening','stopping','unknown'))
 OR (OLD.state='listening' AND NEW.state IN ('connected','stopping','unknown'))
 OR (OLD.state='connected' AND NEW.state IN ('stopping','unknown'))
 OR (OLD.state='stopping' AND NEW.state IN ('closed','unknown'))
 OR (OLD.state='unknown' AND NEW.state='closed'))
 BEGIN SELECT RAISE(ABORT,'personal_context_session_transition_rejected'); END;
CREATE TRIGGER personal_context_session_no_delete BEFORE DELETE ON personal_context_sessions
 BEGIN SELECT RAISE(ABORT,'personal_context_session_history_required'); END;
`;
