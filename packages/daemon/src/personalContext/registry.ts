// §19.2：此服务只由本机 Owner 管理入口装配；peer 不能自注册。
import { createPublicKey, randomUUID } from "node:crypto";
import {
  jcsDigest, jcsSerialize, personalContextRegisterSchema, personalContextRegistrationChangeSchema,
  personalContextPermissionSchema, personalContextPermissionRevokeSchema, personalContextPeerIdentitySchema,
  personalContextEffectSchema,
  personalContextStatusQuerySchema, PERSONAL_CONTEXT_PROTOCOL,
  type PersonalContextPeerIdentity, type PersonalContextEffect, type PersonalContextEventMapping,
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { withSqliteAuditTransaction } from "../api/sqliteAuditTransaction.js";
import { withPersonalContextClock, personalContextOperationTime } from "./clock.js";
import { assertPersonalContextSourceCurrent } from "./sourceAuthority.js";
import { PersonalContextPeerAuthentication, type AuthenticatedPeerHandle } from "./peerAuthentication.js";
import { PersonalContextJournal, type OperationStatus } from "./journal.js";
import { assertPersonalContextEventSource } from "./events.js";

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
  private readonly invalidationListeners = new Set<(registrationId: string) => void>();
  onInvalidation(listener: (registrationId: string) => void): () => void {
    this.invalidationListeners.add(listener); return () => this.invalidationListeners.delete(listener);
  }
  readonly authentication: PersonalContextPeerAuthentication;
  constructor(private readonly db: Db, private readonly audit: AuditSink, private readonly now: () => number = Date.now, private readonly keyGuard?: PersonalContextKeyGuard) {
    if (audit.sharesSqlite?.(db) !== true) throw Error("personal_context_same_database_required");
    this.authentication = new PersonalContextPeerAuthentication(value => this.currentPeer(value),
      () => personalContextOperationTime(this.db),
      work => withPersonalContextClock(this.db, work, this.now));
  }
  sharesDatabase(db: Db): boolean { return this.db === db; }
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
    else {
      this.live.delete(result.registrationId);
      // 同步封闭已拥有 writer，系统关闭结果由监督器/Owner handler 等待。
      for (const listener of this.invalidationListeners) listener(result.registrationId);
      this.keyGuard?.revokeForRegistration(result.registrationId);
    }
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
  /** 从真实行读取精确当前身份，不接受调用方提供新的代次替换旧请求。 */
  sessionIdentity(registrationId: string, expectedRevision: number): PersonalContextPeerIdentity {
    const value = identity(this.row(registrationId));
    if (value.registrationRevision !== expectedRevision) throw Error("personal_context_registration_conflict");
    this.currentPeer(value); return value;
  }
  /** 仅供已验证管道监督器调用；没有制造旧 PeerAuthentication 的 WeakMap 句柄。 */
  sessionStatus(identity: PersonalContextPeerIdentity, input: unknown): OperationStatus {
    const query = personalContextStatusQuerySchema.parse(input);
    const journal = new PersonalContextJournal(this.db, this.audit, {
      sharesDatabase: db => db === this.db,
      assertEffectCurrent: () => { throw Error("personal_context_session_effect_not_connected"); },
      assertStatusCurrent: value => {
        this.currentPeer(identity);
        const boundary = value.boundary;
        if (boundary.installationId !== identity.installationId || boundary.nodeId !== identity.nodeId || boundary.connectionId !== identity.connectionId || boundary.connectionEpoch !== identity.connectionEpoch) throw Error("personal_context_status_scope_denied");
        const row = this.db.prepare("SELECT boundary_json,link_json,payload_digest,event_source_json,expires_at FROM personal_context_operations WHERE installation_id=? AND node_id=? AND connection_id=? AND connection_epoch=? AND method=? AND operation_id=?")
          .get(boundary.installationId, boundary.nodeId, boundary.connectionId, boundary.connectionEpoch, value.originalMethod, value.operationId) as { boundary_json: string | null; link_json: string | null; payload_digest: string; event_source_json: string | null; expires_at: number } | undefined;
        if (!row || !row.boundary_json || !row.link_json || row.boundary_json !== jcsSerialize(boundary) || row.payload_digest !== value.payloadDigest) throw Error("personal_context_status_scope_denied");
        if (value.originalMethod === "event/ingest") {
          // 原始事件证明来自耐久准入行；查询不能补造版本、映射或正文。
          if (!row.event_source_json) throw Error("personal_context_status_scope_denied");
          const effect = personalContextEffectSchema.parse({ protocol: PERSONAL_CONTEXT_PROTOCOL,
            method: "event/ingest", operationId: value.operationId, boundary: JSON.parse(row.boundary_json),
            link: JSON.parse(row.link_json), payload: JSON.parse(row.event_source_json),
            payloadDigest: row.payload_digest, expiresAt: row.expires_at });
          if (effect.method !== "event/ingest") throw Error("personal_context_status_scope_denied");
          // 核对真实提交时的源版本，不要求历史终态等于当前 Focus 版本。
          assertPersonalContextEventSource(this.db, effect);
          const mapping = this.db.prepare("SELECT permission_id FROM personal_context_event_mappings WHERE id=?").get(effect.payload.mappingId) as { permission_id: string };
          const permission = this.db.prepare("SELECT * FROM personal_context_permissions WHERE id=? AND registration_id=? AND state='active' AND method='event/ingest' AND expires_at>?")
            .get(mapping.permission_id, identity.registrationId, personalContextOperationTime(this.db)) as Permission | undefined;
          if (!permission || jcsSerialize({ ...JSON.parse(permission.link_json), focusRevision: effect.link.focusRevision, focusAuthorityEpoch: effect.link.focusAuthorityEpoch }) !== row.link_json) throw Error("personal_context_status_scope_denied");
        } else {
          const permission = this.db.prepare("SELECT 1 FROM personal_context_permissions WHERE registration_id=? AND state='active' AND method=? AND link_json=? AND expires_at>? LIMIT 1")
            .get(identity.registrationId, value.originalMethod, row.link_json, personalContextOperationTime(this.db));
          if (!permission) throw Error("personal_context_status_scope_denied");
        }
      },
    }, this.now);
    return journal.status(query);
  }
  /** 内部受管会话使用的源映射门；JSON 描述本身不认证 peer。 */
  assertEventMapping(peer: PersonalContextPeerIdentity, mapping: PersonalContextEventMapping): void {
    this.currentPeer(peer);
    const b = mapping.boundary;
    if (b.installationId !== peer.installationId || b.nodeId !== peer.nodeId || b.connectionId !== peer.connectionId || b.connectionEpoch !== peer.connectionEpoch) throw Error("personal_context_permission_boundary");
    const permission = this.db.prepare("SELECT * FROM personal_context_permissions WHERE id=?").get(mapping.permissionId) as Permission | undefined;
    if (!permission || permission.registration_id !== peer.registrationId || permission.state !== "active" || permission.method !== "event/ingest" || permission.expires_at <= personalContextOperationTime(this.db) || mapping.expiresAt > permission.expires_at || jcsSerialize(JSON.parse(permission.link_json)) !== jcsSerialize(mapping.link)) throw Error("personal_context_permission_denied");
  }
  /** Owner 撤销只收紧映射，不要求旧披露许可或系统密钥仍可用。 */
  assertEventMappingRevocation(peer: PersonalContextPeerIdentity, mapping: PersonalContextEventMapping): void {
    const current = this.row(peer.registrationId), b = mapping.boundary;
    if (jcsSerialize(identity(current)) !== jcsSerialize(peer) || b.installationId !== peer.installationId || b.nodeId !== peer.nodeId || b.connectionId !== peer.connectionId || b.connectionEpoch !== peer.connectionEpoch) throw Error("personal_context_permission_boundary");
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
