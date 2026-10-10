// §19.4：只保存源事件身份、摘要和登记绑定，不复制源事件正文。
export const PERSONAL_CONTEXT_EVENT_DDL = `
CREATE TABLE personal_context_event_stream_identity (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  stream_epoch TEXT NOT NULL
);
CREATE TABLE personal_context_event_mappings (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>0),
  state TEXT NOT NULL CHECK(state IN ('active','revoked')),
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  boundary_json TEXT NOT NULL,
  link_json TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  event_kinds_json TEXT NOT NULL,
  allow_focus_events INTEGER NOT NULL CHECK(allow_focus_events IN (0,1)),
  expires_at INTEGER NOT NULL CHECK(expires_at>0)
);
CREATE INDEX personal_context_event_mappings_focus ON personal_context_event_mappings(focus_id,state);
CREATE TABLE personal_context_event_stream (
  commit_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE REFERENCES focus_events(id),
  source_digest TEXT NOT NULL,
  focus_revision INTEGER NOT NULL CHECK(focus_revision>=0),
  focus_authority_epoch INTEGER NOT NULL CHECK(focus_authority_epoch>=0)
);
CREATE TABLE personal_context_event_bindings (
  commit_sequence INTEGER NOT NULL REFERENCES personal_context_event_stream(commit_sequence),
  mapping_id TEXT NOT NULL REFERENCES personal_context_event_mappings(id),
  mapping_revision INTEGER NOT NULL CHECK(mapping_revision>0),
  boundary_json TEXT NOT NULL,
  link_json TEXT NOT NULL,
  PRIMARY KEY(commit_sequence,mapping_id)
);
`;

// 原地篡改不得把旧源证据换成新的披露目标；未来留存清理另走明确的删除路径。
export const PERSONAL_CONTEXT_EVENT_IMMUTABLE_DDL = `
CREATE TRIGGER personal_context_event_stream_immutable BEFORE UPDATE ON personal_context_event_stream
BEGIN SELECT RAISE(ABORT,'personal_context_event_stream_immutable'); END;
CREATE TRIGGER personal_context_event_bindings_immutable BEFORE UPDATE ON personal_context_event_bindings
BEGIN SELECT RAISE(ABORT,'personal_context_event_bindings_immutable'); END;
CREATE TRIGGER personal_context_event_identity_immutable BEFORE UPDATE ON personal_context_event_stream_identity
BEGIN SELECT RAISE(ABORT,'personal_context_event_identity_immutable'); END;
CREATE TRIGGER personal_context_event_mapping_revoke_only BEFORE UPDATE ON personal_context_event_mappings
WHEN NOT (OLD.state='active' AND NEW.state='revoked' AND NEW.revision=OLD.revision+1
AND NEW.id=OLD.id AND NEW.focus_id=OLD.focus_id AND NEW.session_id=OLD.session_id
AND NEW.boundary_json=OLD.boundary_json AND NEW.link_json=OLD.link_json
AND NEW.permission_id=OLD.permission_id AND NEW.event_kinds_json=OLD.event_kinds_json
AND NEW.allow_focus_events=OLD.allow_focus_events AND NEW.expires_at=OLD.expires_at)
BEGIN SELECT RAISE(ABORT,'personal_context_event_mapping_immutable'); END;
`;
