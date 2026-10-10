// §19.2：此服务只由本机 Owner 管理入口装配；peer 不能自注册。
import { createPublicKey, randomUUID } from "node:crypto";
import {
  jcsDigest, jcsSerialize, personalContextRegisterSchema, personalContextRegistrationChangeSchema,
  personalContextPermissionSchema, personalContextPermissionRevokeSchema, personalContextPeerIdentitySchema,
  personalContextEffectSchema,
  type PersonalContextPeerIdentity, type PersonalContextEffect,
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { withSqliteAuditTransaction } from "../api/sqliteAuditTransaction.js";
import { withPersonalContextClock, personalContextOperationTime } from "./clock.js";
import { assertPersonalContextSourceCurrent } from "./sourceAuthority.js";
import { PersonalContextPeerAuthentication, type AuthenticatedPeerHandle } from "./peerAuthentication.js";

interface Registration {
  id: string; installation_id: string; peer_installation_id: string; node_id: string;
  connection_id: string; connection_epoch: number; revision: number;
  state: "registered" | "enabled" | "paused" | "revoked";
  public_key: string; key_digest: string; expires_at: number;
}
interface Permission {
  id: string; registration_id: string; revision: number; state: "active" | "revoked";
  method: PersonalContextEffect["method"]; link_json: string; expires_at: number;
}
function identity(row: Registration): PersonalContextPeerIdentity {
  return personalContextPeerIdentitySchema.parse({ installationId: row.installation_id,
    peerInstallationId: row.peer_installation_id, nodeId: row.node_id,
    connectionId: row.connection_id, connectionEpoch: row.connection_epoch,
    registrationId: row.id, registrationRevision: row.revision });
}

export interface PersonalContextKeyGuard {
  assertReady(registrationId: string, expectedRevision: number): void;
  revokeForRegistration(registrationId: string): void;
}
export class PersonalContextRegistry {
  // 数据库 enabled 只表示保存过的配置；重启没有活跃授权会话。
  private readonly live = new Set<string>();
  readonly authentication: PersonalContextPeerAuthentication;
  constructor(private readonly db: Db, private readonly audit: AuditSink, private readonly now: () => number = Date.now, private readonly keyGuard?: PersonalContextKeyGuard) {
    if (audit.sharesSqlite?.(db) !== true) throw Error("personal_context_same_database_required");
    this.authentication = new PersonalContextPeerAuthentication(value => this.currentPeer(value),
      () => personalContextOperationTime(this.db),
      work => withPersonalContextClock(this.db, work, this.now));
  }
  private row(id: string): Registration {
    const row = this.db.prepare("SELECT * FROM personal_context_registrations WHERE id=?").get(id) as Registration | undefined;
    if (!row) throw Error("personal_context_registration_missing");
    return row;
  }
  private transaction<T>(work: () => T): T {
    if (this.db.inTransaction) throw Error("personal_context_registry_outer_boundary_required");
    return withPersonalContextClock(this.db, () => withSqliteAuditTransaction(this.db, this.audit, work), this.now);
  }
  private record(action: string, id: string, revision: number): void {
    this.audit.record({ actor: "owner", action: `personal_context.${action}`, meta: { id, revision } });
  }
  list(): unknown {
    const installation = this.db.prepare("SELECT installation_id FROM personal_context_installation WHERE singleton=1").get() as { installation_id: string } | undefined;
    const rows = this.db.prepare("SELECT * FROM personal_context_registrations ORDER BY created_at,id LIMIT 1001").all() as Registration[];
    return { installationId: installation?.installation_id ?? null,
      // 尚未装配受保护端点与独立当前 Anyvia 权威，不能显示为已连接。
      transport: "not_connected", registrations: rows.map(row => ({ ...identity(row), state: row.state,
        keyDigest: row.key_digest, expiresAt: row.expires_at, sessionEnabled: this.live.has(row.id),
        permissions: this.db.prepare("SELECT id,revision,state,method,expires_at AS expiresAt FROM personal_context_permissions WHERE registration_id=? ORDER BY created_at,id").all(row.id),
      })) };
  }
  register(input: unknown): PersonalContextPeerIdentity {
    const value = personalContextRegisterSchema.parse(input);
    if (!value.publicKey.startsWith("-----BEGIN PUBLIC KEY-----")) throw Error("personal_context_public_key_required");
    const key = createPublicKey(value.publicKey);
    if (key.asymmetricKeyType !== "ed25519") throw Error("personal_context_key_type");
    const publicKey = key.export({ type: "spki", format: "pem" }).toString();
    return this.transaction(() => {
      const at = personalContextOperationTime(this.db);
      if (value.expiresAt <= at) throw Error("personal_context_registration_expired");
      const count = this.db.prepare("SELECT COUNT(*) n FROM personal_context_registrations").get() as { n: number };
      if (count.n >= 1000) throw Error("personal_context_registration_capacity");
      this.db.prepare("INSERT OR IGNORE INTO personal_context_installation(singleton,installation_id) VALUES(1,?)").run(randomUUID());
      const installation = this.db.prepare("SELECT installation_id FROM personal_context_installation WHERE singleton=1").get() as { installation_id: string };
      const prior = this.db.prepare("SELECT MAX(connection_epoch) epoch FROM personal_context_registrations WHERE installation_id=? AND peer_installation_id=? AND node_id=?").get(installation.installation_id, value.peerInstallationId, value.nodeId) as { epoch: number | null };
      const epoch = (prior.epoch ?? 0) + 1;
      if (!Number.isSafeInteger(epoch)) throw Error("personal_context_epoch_exhausted");
      const id = randomUUID(), connection = randomUUID();
      this.db.prepare("INSERT INTO personal_context_registrations(id,installation_id,peer_installation_id,node_id,connection_id,connection_epoch,revision,state,public_key,key_digest,expires_at,created_at) VALUES(?,?,?,?,?,?,1,'registered',?,?,?,?)")
        .run(id, installation.installation_id, value.peerInstallationId, value.nodeId, connection, epoch, publicKey, jcsDigest({ publicKey }), value.expiresAt, at);
      this.record("registered", id, 1);
      return identity(this.row(id));
    });
  }
  change(input: unknown): PersonalContextPeerIdentity {
    const value = personalContextRegistrationChangeSchema.parse(input);
    const result = this.transaction(() => {
      const row = this.row(value.registrationId);
      if (row.revision !== value.expectedRevision) throw Error("personal_context_registration_conflict");
      if (value.action === "enable" && (row.state !== "registered" || row.expires_at <= personalContextOperationTime(this.db))) throw Error("personal_context_registration_not_enableable");
      if (value.action === "enable") this.keyGuard?.assertReady(row.id, row.revision);
      const state = value.action === "enable" ? "enabled" : value.action === "pause" ? "paused" : "revoked";
      this.db.prepare("UPDATE personal_context_registrations SET state=?,revision=revision+1 WHERE id=? AND revision=?").run(state, row.id, row.revision);
      if (state !== "enabled") this.db.prepare("UPDATE personal_context_permissions SET state='revoked',revision=revision+1 WHERE registration_id=? AND state='active'").run(row.id);
      this.record(state, row.id, row.revision + 1);
      return identity(this.row(row.id));
    });
    if (value.action === "enable") this.live.add(result.registrationId);
    else { this.live.delete(result.registrationId); this.keyGuard?.revokeForRegistration(result.registrationId); }
    return result;
  }
  currentPeer(input: PersonalContextPeerIdentity): { publicKey: string } {
    const value = personalContextPeerIdentitySchema.parse(input);
    return withPersonalContextClock(this.db, () => {
      const row = this.row(value.registrationId);
      if (jcsSerialize(identity(row)) !== jcsSerialize(value) || row.state !== "enabled" || !this.live.has(row.id) || row.expires_at <= personalContextOperationTime(this.db)) throw Error("personal_context_registration_stale");
      this.keyGuard?.assertReady(row.id, row.revision);
      if (jcsDigest({ publicKey: row.public_key }) !== row.key_digest) throw Error("personal_context_registration_damaged");
      return { publicKey: row.public_key };
    }, this.now);
  }
  grant(input: unknown): { permissionId: string; revision: number } {
    const value = personalContextPermissionSchema.parse(input);
    return this.transaction(() => {
      const row = this.row(value.registrationId), at = personalContextOperationTime(this.db);
      if (row.revision !== value.expectedRegistrationRevision) throw Error("personal_context_registration_conflict");
      this.currentPeer(identity(row));
      if (value.expiresAt <= at || value.expiresAt > row.expires_at) throw Error("personal_context_permission_expired");
      assertPersonalContextSourceCurrent(this.db, value.link);
      const count = this.db.prepare("SELECT COUNT(*) n FROM personal_context_permissions").get() as { n: number };
      if (count.n >= 10000) throw Error("personal_context_permission_capacity");
      const id = randomUUID();
      this.db.prepare("INSERT INTO personal_context_permissions(id,registration_id,revision,state,method,link_json,expires_at,created_at) VALUES(?,?,1,'active',?,?,?,?)")
        .run(id, row.id, value.method, jcsSerialize(value.link), value.expiresAt, at);
      this.record("permission_granted", id, 1);
      return { permissionId: id, revision: 1 };
    });
  }
  revokePermission(input: unknown): void {
    const value = personalContextPermissionRevokeSchema.parse(input);
    this.transaction(() => {
      const changed = this.db.prepare("UPDATE personal_context_permissions SET state='revoked',revision=revision+1 WHERE id=? AND revision=? AND state='active'").run(value.permissionId, value.expectedRevision);
      if (changed.changes !== 1) throw Error("personal_context_permission_conflict");
      this.record("permission_revoked", value.permissionId, value.expectedRevision + 1);
    });
  }
  /** 仅证明 SayDo 本地许可；不能替代当前 Anyvia 权威、源端原请求证明或最终 writer。 */
  assertLocalPermission(handle: AuthenticatedPeerHandle, permissionId: string, input: unknown): void {
    const effect = personalContextEffectSchema.parse(input);
    withPersonalContextClock(this.db, () => {
      const peer = this.authentication.assertCurrent(handle, effect.payloadDigest);
      this.currentPeer(peer);
      const row = this.db.prepare("SELECT * FROM personal_context_permissions WHERE id=?").get(permissionId) as Permission | undefined;
      if (!row || row.registration_id !== peer.registrationId || row.state !== "active" || row.method !== effect.method || row.expires_at <= personalContextOperationTime(this.db)) throw Error("personal_context_permission_denied");
      if (effect.method === "candidate/propose" && (effect.payload.permissionId !== row.id || effect.payload.permissionRevision !== row.revision)) throw Error("personal_context_permission_revision");
      const boundary = effect.boundary;
      if (boundary.installationId !== peer.installationId || boundary.nodeId !== peer.nodeId || boundary.connectionId !== peer.connectionId || boundary.connectionEpoch !== peer.connectionEpoch) throw Error("personal_context_permission_boundary");
      const registered = JSON.parse(row.link_json) as PersonalContextEffect["link"];
      // 真实事件使用提交时的源版本；固定 Case/session/anchor 等身份仍须全匹配。
      const expected = effect.method === "event/ingest" ? { ...registered, focusRevision: effect.link.focusRevision, focusAuthorityEpoch: effect.link.focusAuthorityEpoch } : registered;
      if (jcsSerialize(expected) !== jcsSerialize(effect.link)) throw Error("personal_context_permission_scope");
    }, this.now);
  }
}
