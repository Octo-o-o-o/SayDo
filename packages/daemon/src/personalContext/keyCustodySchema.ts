// §19.2.3：系统密钥引用只是对账元信息，不承载启用或资料授权。
export const PERSONAL_CONTEXT_KEY_CUSTODY_DDL = `
CREATE TABLE personal_context_key_preparations (
 operation_id TEXT PRIMARY KEY,
 registration_id TEXT NOT NULL UNIQUE REFERENCES personal_context_registrations(id),
 registration_revision INTEGER NOT NULL CHECK(registration_revision>0),
 request_digest TEXT NOT NULL,
 reference TEXT NOT NULL UNIQUE,
 public_key TEXT NOT NULL, public_key_digest TEXT NOT NULL,
 credential_digest TEXT,
 state TEXT NOT NULL CHECK(state IN ('pending','stored','unknown','revoked')),
 revision INTEGER NOT NULL CHECK(revision>0),
 os_result TEXT NOT NULL CHECK(os_result IN ('pending','confirmed','unknown')),
 retained INTEGER NOT NULL CHECK(retained IN (0,1)),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 CHECK(state!='stored' OR (credential_digest IS NOT NULL AND os_result='confirmed'))
);
CREATE TRIGGER personal_context_key_identity_guard BEFORE UPDATE ON personal_context_key_preparations
 WHEN NEW.operation_id IS NOT OLD.operation_id OR NEW.registration_id IS NOT OLD.registration_id
 OR NEW.registration_revision IS NOT OLD.registration_revision OR NEW.request_digest IS NOT OLD.request_digest
 OR NEW.reference IS NOT OLD.reference OR NEW.public_key IS NOT OLD.public_key
 OR NEW.public_key_digest IS NOT OLD.public_key_digest OR NEW.created_at IS NOT OLD.created_at
 OR NEW.revision IS NOT OLD.revision+1 OR NEW.updated_at<OLD.updated_at
 OR NOT ((OLD.state='pending' AND NEW.state IN ('stored','unknown'))
 OR (OLD.state IN ('stored','unknown') AND NEW.state='revoked'))
 OR (OLD.credential_digest IS NOT NULL AND NEW.credential_digest IS NOT OLD.credential_digest)
 OR (OLD.os_result!='pending' AND NEW.os_result IS NOT OLD.os_result)
 OR NEW.retained<OLD.retained
 BEGIN SELECT RAISE(ABORT,'personal_context_key_identity_immutable'); END;
CREATE TRIGGER personal_context_key_no_delete BEFORE DELETE ON personal_context_key_preparations
 BEGIN SELECT RAISE(ABORT,'personal_context_key_tombstone_required'); END;
`;
