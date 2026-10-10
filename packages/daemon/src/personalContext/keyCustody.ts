// §19.2.3：耐久意图与系统凭据分开提交，失败不重写 OS 或恢复旧授权。
import { createHash, createPublicKey, type KeyObject } from "node:crypto";
import { jcsDigest, jcsSerialize, personalContextKeyProvisionSchema, type PersonalContextKeyPreparation, type PersonalContextPeerIdentity } from "@saydo/contracts";
import type { Win32PersonalSigningKeyReference, Win32PersonalPipe } from "@saydo/platform";
import { PersonalContextWindowsTransport } from "./windowsTransport.js";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { withSqliteAuditTransaction } from "../api/sqliteAuditTransaction.js";
import { withPersonalContextClock, personalContextOperationTime, observePersonalContextElapsed } from "./clock.js";

export type PersonalSigningKeyDescriptor = Win32PersonalSigningKeyReference;
export type PersonalSigningKeyIntent = Pick<PersonalSigningKeyDescriptor, "reference" | "publicKey" | "publicKeyDigest">;
export interface PersonalSigningKeyStore {
  readonly available: boolean;
  create(beforeWrite: (facts: Readonly<PersonalSigningKeyIntent>) => void): PersonalSigningKeyDescriptor;
  load(input: PersonalSigningKeyDescriptor): KeyObject;
}
interface Preparation {
  operation_id: string; registration_id: string; registration_revision: number; request_digest: string;
  reference: string; public_key: string; public_key_digest: string; credential_digest: string | null;
  state: PersonalContextKeyPreparation["state"]; revision: number; os_result: "pending" | "confirmed" | "unknown";
  retained: number; created_at: number; updated_at: number;
}
interface Registration { id: string; revision: number; state: string; expires_at: number }
const sha = /^sha256:[a-f0-9]{64}$/u;
const reference = /^saydo-personal-context(?:-test)?\/1\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
function publicDigest(key: KeyObject): string {
  return `sha256:${createHash("sha256").update(createPublicKey(key).export({ format: "der", type: "spki" })).digest("hex")}`;
}
function view(row: Preparation): PersonalContextKeyPreparation {
  return { operationId: row.operation_id, state: row.state, publicKey: row.public_key, publicKeyDigest: row.public_key_digest };
}
export class PersonalContextKeyCustody {
  constructor(private readonly db: Db, private readonly audit: AuditSink, private readonly store: PersonalSigningKeyStore, private readonly now: () => number = Date.now) {
    if (audit.sharesSqlite?.(db) !== true) throw Error("personal_context_same_database_required");
    this.transaction(() => {
      const rows = db.prepare("SELECT * FROM personal_context_key_preparations WHERE state='pending' ORDER BY operation_id LIMIT 1001").all() as Preparation[];
      if (rows.length > 1000) throw Error("personal_context_key_capacity");
      for (const row of rows) this.unknown(row);
    });
  }
  private transaction<T>(work: () => T): T {
    if (this.db.inTransaction) throw Error("personal_context_key_outer_boundary_required");
    return withPersonalContextClock(this.db, () => withSqliteAuditTransaction(this.db, this.audit, work), this.now);
  }
  private record(action: string, row: Pick<Preparation, "operation_id" | "registration_id" | "revision">): void {
    this.audit.record({ actor: "owner", action: `personal_context.key_${action}`, meta: { operationId: row.operation_id, registrationId: row.registration_id, revision: row.revision } });
  }
  private row(id: string): Preparation | undefined {
    return this.db.prepare("SELECT * FROM personal_context_key_preparations WHERE operation_id=?").get(id) as Preparation | undefined;
  }
  private registration(id: string): Registration {
    const row = this.db.prepare("SELECT * FROM personal_context_registrations WHERE id=?").get(id) as Registration | undefined;
    if (!row) throw Error("personal_context_registration_missing");
    return row;
  }
  private assertProvisionable(id: string, revision: number): void {
    const row = this.registration(id);
    if (row.revision !== revision || row.state !== "registered" || row.expires_at <= personalContextOperationTime(this.db)) throw Error("personal_context_key_registration_stale");
  }
  private unknown(row: Preparation, stored?: PersonalSigningKeyDescriptor): void {
    const changed = this.db.prepare("UPDATE personal_context_key_preparations SET state='unknown',revision=revision+1,os_result=?,credential_digest=?,retained=1,updated_at=? WHERE operation_id=? AND state='pending' AND revision=?")
      .run(stored ? "confirmed" : "unknown", stored?.credentialDigest ?? null, personalContextOperationTime(this.db), row.operation_id, row.revision);
    if (changed.changes !== 1) throw Error("personal_context_key_prepare_conflict");
    this.record("unknown", { ...row, revision: row.revision + 1 });
  }
  private systemCall<T>(work: () => T): T {
    let result!: T, failed = false, original: unknown;
    try { result = work(); } catch (error) { failed = true; original = error; }
    try { observePersonalContextElapsed(this.db); }
    catch (error) {
      if (failed) throw new AggregateError([original, error], "personal_context_key_load_and_clock_failed");
      throw error;
    }
    if (failed) throw original;
    return result;
  }
  provision(input: unknown): PersonalContextKeyPreparation {
    // durable intent 与 OS 分开提交，但共用本次原始时钟作用域和单调起点。
    return withPersonalContextClock(this.db, () => this.provisionInScope(input), this.now);
  }
  private provisionInScope(input: unknown): PersonalContextKeyPreparation {
    const value = personalContextKeyProvisionSchema.parse(input), digest = jcsDigest(value);
    const previous = this.transaction(() => {
      const row = this.row(value.operationId);
      if (row) { if (row.request_digest !== digest) throw Error("personal_context_key_operation_conflict"); return row; }
      this.assertProvisionable(value.registrationId, value.expectedRegistrationRevision);
      if (this.db.prepare("SELECT 1 FROM personal_context_key_preparations WHERE registration_id=?").get(value.registrationId)) throw Error("personal_context_key_registration_has_intent");
      if (!this.store.available) throw Error("personal_context_key_platform_unavailable");
      return undefined;
    });
    if (previous) return view(previous);
    let stored: PersonalSigningKeyDescriptor | undefined;
    try {
      stored = this.systemCall(() => this.store.create(facts => {
        observePersonalContextElapsed(this.db);
        // 同步回调必须先提交精确非秘密意图，平台原语此后才可以写 OS。
        if (!reference.test(facts.reference) || !sha.test(facts.publicKeyDigest) || facts.publicKey.length > 1024) throw Error("personal_context_key_intent_invalid");
        const publicKey = createPublicKey(facts.publicKey);
        if (publicKey.asymmetricKeyType !== "ed25519" || `sha256:${createHash("sha256").update(publicKey.export({ format: "der", type: "spki" })).digest("hex")}` !== facts.publicKeyDigest) throw Error("personal_context_key_intent_invalid");
        this.transaction(() => {
          this.assertProvisionable(value.registrationId, value.expectedRegistrationRevision);
          const at = personalContextOperationTime(this.db);
          this.db.prepare("INSERT INTO personal_context_key_preparations(operation_id,registration_id,registration_revision,request_digest,reference,public_key,public_key_digest,state,revision,os_result,retained,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',1,'pending',0,?,?)")
            .run(value.operationId, value.registrationId, value.expectedRegistrationRevision, digest, facts.reference, facts.publicKey, facts.publicKeyDigest, at, at);
          this.record("pending", { operation_id: value.operationId, registration_id: value.registrationId, revision: 1 });
        });
      }));
      const result = stored;
      if (!sha.test(result.credentialDigest)) throw Error("personal_context_key_readback_invalid");
      const row = this.row(value.operationId);
      if (!row || result.reference !== row.reference || result.publicKey !== row.public_key || result.publicKeyDigest !== row.public_key_digest) throw Error("personal_context_key_readback_invalid");
      const key = this.systemCall(() => this.store.load(result));
      if (key.type !== "private" || key.asymmetricKeyType !== "ed25519" || publicDigest(key) !== row.public_key_digest) throw Error("personal_context_key_readback_invalid");
      return this.transaction(() => {
        this.assertProvisionable(value.registrationId, value.expectedRegistrationRevision);
        const changed = this.db.prepare("UPDATE personal_context_key_preparations SET state='stored',revision=revision+1,credential_digest=?,os_result='confirmed',retained=1,updated_at=? WHERE operation_id=? AND state='pending' AND revision=1 AND request_digest=?")
          .run(result.credentialDigest, personalContextOperationTime(this.db), value.operationId, digest);
        if (changed.changes !== 1) throw Error("personal_context_key_prepare_conflict");
        const current = this.row(value.operationId)!; this.record("stored", current); return view(current);
      });
    } catch (original) {
      // 状态提交失败不清理未知凭据，不重发；审计仍失败时 pending 留待启动隔离。
      try { this.transaction(() => {
        const row = this.row(value.operationId);
        if (row?.state === "pending") {
          const exact = stored && stored.reference === row.reference && stored.publicKey === row.public_key && stored.publicKeyDigest === row.public_key_digest && sha.test(stored.credentialDigest) ? stored : undefined;
          this.unknown(row, exact);
        }
      }); } catch (error) { throw new AggregateError([original, error], "personal_context_key_prepare_and_isolation_failed"); }
      throw new Error("personal_context_key_prepare_failed", { cause: original });
    }
  }
  assertReady(registrationId: string, expectedRevision: number): void {
    this.readReady(registrationId, expectedRevision);
  }
  private readReady(registrationId: string, expectedRevision: number): { key: KeyObject; row: Preparation; registration: Registration } {
    return withPersonalContextClock(this.db, () => {
      const registration = this.registration(registrationId), row = this.db.prepare("SELECT * FROM personal_context_key_preparations WHERE registration_id=?").get(registrationId) as Preparation | undefined;
      if (!row || row.state !== "stored" || !row.credential_digest || !this.store.available || registration.revision !== expectedRevision || registration.expires_at <= personalContextOperationTime(this.db) || !((registration.state === "registered" && registration.revision === row.registration_revision) || (registration.state === "enabled" && registration.revision === row.registration_revision + 1))) throw Error("personal_context_key_not_ready");
      // 成功及失败的阻塞系统读取都推进原期限，错误仍保留给调用者。
      const key = this.systemCall(() => this.store.load({ reference: row.reference, publicKey: row.public_key, publicKeyDigest: row.public_key_digest, credentialDigest: row.credential_digest! }));
      if (key.type !== "private" || key.asymmetricKeyType !== "ed25519" || publicDigest(key) !== row.public_key_digest) throw Error("personal_context_key_not_ready");
      // OS 读取可以阻塞；另一连接可能已撤销。只接受原完整登记与原意图仍完全相同。
      const currentRegistration = this.registration(registrationId), currentIntent = this.row(row.operation_id);
      if (!currentIntent || jcsSerialize(currentRegistration) !== jcsSerialize(registration) || jcsSerialize(currentIntent) !== jcsSerialize(row) || currentRegistration.expires_at <= personalContextOperationTime(this.db)) throw Error("personal_context_key_not_ready");
      return { key, row, registration };
    }, this.now);
  }
  /** 只返回非秘密的原意图水位，不向调用方返回 KeyObject。 */
  sessionKeyFacts(registrationId: string, expectedRevision: number): { operationId: string; revision: number; publicKeyDigest: string } {
    const { row } = this.readReady(registrationId, expectedRevision);
    return { operationId: row.operation_id, revision: row.revision, publicKeyDigest: row.public_key_digest };
  }
  /** 受监督握手唯一入口；私钥不交给外部 callback 或 HTTP。 */
  async establishSession(pipe: Win32PersonalPipe, input: { identity: PersonalContextPeerIdentity; keyOperationId: string; keyRevision: number; bootEpoch: string; peerKey: KeyObject; assertCurrent: () => void }): Promise<PersonalContextWindowsTransport> {
    const captured = this.readReady(input.identity.registrationId, input.identity.registrationRevision);
    if (captured.row.operation_id !== input.keyOperationId || captured.row.revision !== input.keyRevision) throw Error("personal_context_key_session_stale");
    const registrationJson = jcsSerialize(captured.registration), intentJson = jcsSerialize(captured.row);
    // 不能捕获含 key 的 captured 对象：此 guard 在握手结束后仍由连接持有。
    const registrationId = input.identity.registrationId, operationId = input.keyOperationId;
    const assertCurrent = () => {
      input.assertCurrent();
      withPersonalContextClock(this.db, () => {
        const registration = this.registration(registrationId), row = this.row(operationId);
        if (!row || jcsSerialize(registration) !== registrationJson || jcsSerialize(row) !== intentJson || registration.expires_at <= personalContextOperationTime(this.db)) throw Error("personal_context_key_session_stale");
      }, this.now);
    };
    assertCurrent();
    const transport = await PersonalContextWindowsTransport.establish(pipe, { role: "saydo", identity: input.identity, bootEpoch: input.bootEpoch, privateKey: captured.key, peerKey: input.peerKey, assertCurrent });
    try { assertCurrent(); return transport; } catch (error) { try { await transport.close(); } catch (cleanup) { throw new AggregateError([error, cleanup], "personal_context_session_handshake_cleanup_failed"); } throw error; }
  }
  /** 登记、许可和内存认证先失效；此方法只收紧记录，不尝试物理删除。 */
  revokeForRegistration(registrationId: string): void {
    this.transaction(() => {
      let row = this.db.prepare("SELECT * FROM personal_context_key_preparations WHERE registration_id=?").get(registrationId) as Preparation | undefined;
      if (!row || row.state === "revoked") return;
      if (row.state === "pending") { this.unknown(row); row = this.row(row.operation_id)!; }
      const changed = this.db.prepare("UPDATE personal_context_key_preparations SET state='revoked',revision=revision+1,updated_at=? WHERE operation_id=? AND revision=? AND state IN ('stored','unknown')")
        .run(personalContextOperationTime(this.db), row.operation_id, row.revision);
      if (changed.changes !== 1) throw Error("personal_context_key_revoke_conflict");
      this.record("revoked", { ...row, revision: row.revision + 1 });
    });
  }
}
