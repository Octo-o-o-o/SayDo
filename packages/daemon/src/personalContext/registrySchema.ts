// §19.2：登记元信息与许可墓碑，不保存个人正文或私钥。
export const PERSONAL_CONTEXT_REGISTRY_DDL = `
CREATE TABLE personal_context_installation (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), installation_id TEXT NOT NULL UNIQUE
);
CREATE TRIGGER personal_context_installation_no_update BEFORE UPDATE ON personal_context_installation
 BEGIN SELECT RAISE(ABORT,'personal_context_installation_immutable'); END;
CREATE TRIGGER personal_context_installation_no_delete BEFORE DELETE ON personal_context_installation
 BEGIN SELECT RAISE(ABORT,'personal_context_installation_immutable'); END;
CREATE TABLE personal_context_registrations (
 id TEXT PRIMARY KEY, installation_id TEXT NOT NULL, peer_installation_id TEXT NOT NULL,
 node_id TEXT NOT NULL, connection_id TEXT NOT NULL UNIQUE,
 connection_epoch INTEGER NOT NULL CHECK(connection_epoch>0),
 revision INTEGER NOT NULL CHECK(revision>0),
 state TEXT NOT NULL CHECK(state IN ('registered','enabled','paused','revoked')),
 public_key TEXT NOT NULL, key_digest TEXT NOT NULL,
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 UNIQUE(installation_id,peer_installation_id,node_id,connection_epoch)
);
CREATE UNIQUE INDEX personal_context_registration_live ON personal_context_registrations(installation_id,peer_installation_id,node_id)
 WHERE state IN ('registered','enabled');
CREATE TABLE personal_context_permissions (
 id TEXT PRIMARY KEY, registration_id TEXT NOT NULL REFERENCES personal_context_registrations(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 state TEXT NOT NULL CHECK(state IN ('active','revoked')),
 method TEXT NOT NULL CHECK(method IN ('compile/request','candidate/propose','event/ingest','request/respond')),
 link_json TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TRIGGER personal_context_registration_identity_guard BEFORE UPDATE ON personal_context_registrations
 WHEN NEW.id IS NOT OLD.id OR NEW.installation_id IS NOT OLD.installation_id
 OR NEW.peer_installation_id IS NOT OLD.peer_installation_id OR NEW.node_id IS NOT OLD.node_id
 OR NEW.connection_id IS NOT OLD.connection_id OR NEW.connection_epoch IS NOT OLD.connection_epoch
 OR NEW.public_key IS NOT OLD.public_key OR NEW.key_digest IS NOT OLD.key_digest
 OR NEW.expires_at IS NOT OLD.expires_at OR NEW.created_at IS NOT OLD.created_at
 OR NEW.revision IS NOT OLD.revision+1
 OR NOT ((OLD.state='registered' AND NEW.state IN ('enabled','revoked'))
 OR (OLD.state='enabled' AND NEW.state IN ('paused','revoked')) OR (OLD.state='paused' AND NEW.state='revoked'))
 BEGIN SELECT RAISE(ABORT,'personal_context_registration_immutable'); END;
CREATE TRIGGER personal_context_permission_identity_guard BEFORE UPDATE ON personal_context_permissions
 WHEN NEW.id IS NOT OLD.id OR NEW.registration_id IS NOT OLD.registration_id
 OR NEW.method IS NOT OLD.method OR NEW.link_json IS NOT OLD.link_json
 OR NEW.expires_at IS NOT OLD.expires_at OR NEW.created_at IS NOT OLD.created_at
 OR NEW.revision IS NOT OLD.revision+1 OR OLD.state!='active' OR NEW.state!='revoked'
 BEGIN SELECT RAISE(ABORT,'personal_context_permission_immutable'); END;
CREATE TRIGGER personal_context_registration_no_delete BEFORE DELETE ON personal_context_registrations
 BEGIN SELECT RAISE(ABORT,'personal_context_registration_tombstone_required'); END;
CREATE TRIGGER personal_context_permission_no_delete BEFORE DELETE ON personal_context_permissions
 BEGIN SELECT RAISE(ABORT,'personal_context_permission_tombstone_required'); END;
`;
