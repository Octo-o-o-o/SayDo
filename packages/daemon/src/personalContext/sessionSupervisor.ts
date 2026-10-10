// §19.2.4：先保存打开意图，再持有实际句柄。生命周期关闭不代表业务应用成功。
import { createPublicKey, randomBytes } from "node:crypto";
import { createWin32PersonalPipe, processAlive, processBirth, type Win32PersonalPipe } from "@saydo/platform";
import { jcsDigest, jcsSerialize, PERSONAL_CONTEXT_PROTOCOL, PERSONAL_CONTEXT_TRANSPORT_SCHEMA_DIGEST, personalContextSessionOpenSchema, personalContextSessionCloseSchema, personalContextBusinessStatusRequestSchema, personalContextBusinessStatusResponseSchema, type PersonalContextPeerIdentity } from "@saydo/contracts";
import type { PersonalContextRegistry } from "./registry.js";
import type { PersonalContextKeyCustody } from "./keyCustody.js";
import { personalContextPublicKeyDigest } from "./secureChannel.js";
import type { PersonalContextWindowsTransport } from "./windowsTransport.js";
import { PersonalContextSessionJournal, type PersonalContextSessionRow } from "./sessionJournal.js";

interface OwnedSession {
  row: PersonalContextSessionRow; identity: PersonalContextPeerIdentity;
  stopped: boolean; pipe?: Win32PersonalPipe; transport?: PersonalContextWindowsTransport;
  worker?: Promise<void>; close?: Promise<void>; failure?: unknown;
}
export class PersonalContextSessionSupervisor {
  readonly bootEpoch = randomBytes(32).toString("base64url");
  private stopping = false;
  private readonly owned = new Map<string, OwnedSession>();
  constructor(private readonly journal: PersonalContextSessionJournal, private readonly registry: PersonalContextRegistry, private readonly keys: PersonalContextKeyCustody) {
    journal.isolatePreviousBoot(this.bootEpoch);
    registry.onInvalidation(id => { void this.stopRegistration(id).catch(() => undefined); });
  }
  list(): unknown[] { return this.journal.list().map(row => this.view(row)); }
  async open(input: unknown): Promise<unknown> {
    const value = personalContextSessionOpenSchema.parse(input), prior = this.journal.prior(value);
    if (prior) return this.view(prior);
    if (this.stopping || process.platform !== "win32") throw Error("personal_context_session_platform_unavailable");
    const identity = this.registry.sessionIdentity(value.registrationId, value.expectedRegistrationRevision);
    const key = this.keys.sessionKeyFacts(identity.registrationId, identity.registrationRevision), birth = processBirth(process.pid);
    if (!birth) throw Error("personal_context_session_process_unverified");
    const row = this.journal.begin(value, { identity, keyOperationId: key.operationId, keyRevision: key.revision, bootEpoch: this.bootEpoch, pid: process.pid, birth }, () => this.registry.currentPeer(identity));
    const entry: OwnedSession = { row, identity, stopped: false }; this.owned.set(row.operation_id, entry);
    try {
      entry.pipe = createWin32PersonalPipe();
      entry.row = this.journal.transition(entry.row, "listening", { endpoint: entry.pipe.name, assertCurrent: () => this.assertCurrent(entry) });
      // 在向 Owner 返回之前登记所有异步工作；close 会等待这个原 promise。
      entry.worker = this.accept(entry);
      void entry.worker.then(() => this.closeOwned(entry), error => { entry.failure = error; return this.closeOwned(entry); }).catch(error => { entry.failure = error; });
      return this.view(entry.row);
    } catch (error) {
      entry.failure = error; entry.stopped = true;
      // native 创建或 durable publication 失败也不能留下无人监督的句柄。
      try { await this.closeOwned(entry); } catch (cleanup) { throw new AggregateError([error, cleanup], "personal_context_session_open_cleanup_failed"); }
      throw error;
    }
  }
  async close(input: unknown): Promise<unknown> {
    const value = personalContextSessionCloseSchema.parse(input), row = this.journal.get(value.operationId);
    if (!row || row.revision !== value.expectedRevision) throw Error("personal_context_session_conflict");
    const entry = this.owned.get(value.operationId);
    if (entry) { await this.closeOwned(entry); return this.view(this.journal.get(value.operationId)!); }
    if (row.state === "closed") return this.view(row);
    // 无本进程句柄只能核实旧原进程已不再存在，不能把 unknown 文本当退出证明。
    if (row.boot_epoch === this.bootEpoch) throw Error("personal_context_session_cleanup_unverified");
    const alive = processAlive(row.owner_pid), birth = alive ? processBirth(row.owner_pid) : null;
    if (alive && (!birth || birth === row.owner_birth)) throw Error("personal_context_session_cleanup_unverified");
    if (row.state !== "unknown") throw Error("personal_context_session_cleanup_unverified");
    return this.view(this.journal.transition(row, "closed"));
  }
  /** 撤销/停止同步封闭全部原 writer；返回 promise 等待真实关闭和持久结算。 */
  stopRegistration(registrationId: string): Promise<void> {
    const entries = [...this.owned.values()].filter(entry => entry.row.registration_id === registrationId);
    for (const entry of entries) entry.stopped = true;
    return this.drain(entries);
  }
  stop(): Promise<void> {
    this.stopping = true; const entries = [...this.owned.values()];
    for (const entry of entries) entry.stopped = true;
    return this.drain(entries);
  }
  settleInvalidated(): Promise<void> { return this.drain([...this.owned.values()].filter(entry => entry.stopped)); }
  private async drain(entries: OwnedSession[]): Promise<void> {
    const results = await Promise.allSettled(entries.map(entry => this.closeOwned(entry)));
    const errors = results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, "personal_context_session_cleanup_failed");
  }
  private assertCurrent(entry: OwnedSession): void {
    if (this.stopping || entry.stopped || this.owned.get(entry.row.operation_id) !== entry) throw Error("personal_context_session_closed");
    const current = this.journal.get(entry.row.operation_id);
    if (!current || current.revision !== entry.row.revision || current.state !== entry.row.state || !["opening", "listening", "connected"].includes(current.state)) throw Error("personal_context_session_stale");
    this.registry.currentPeer(entry.identity);
  }
  private async accept(entry: OwnedSession): Promise<void> {
    const pipe = entry.pipe!;
    await pipe.accept(); this.assertCurrent(entry);
    const observation = pipe.assertCurrent();
    if (observation.local.pid !== entry.row.owner_pid || observation.local.birth !== entry.row.owner_birth || observation.name !== entry.row.endpoint) throw Error("personal_context_session_process_changed");
    const peer = this.registry.currentPeer(entry.identity);
    entry.transport = await this.keys.establishSession(pipe, { identity: entry.identity, keyOperationId: entry.row.key_operation_id, keyRevision: entry.row.key_revision, bootEpoch: this.bootEpoch, peerKey: createPublicKey(peer.publicKey), assertCurrent: () => this.assertCurrent(entry) });
    this.assertCurrent(entry);
    entry.row = this.journal.transition(entry.row, "connected", { assertCurrent: () => this.assertCurrent(entry) });
    await this.serveStatus(entry);
  }
  private async serveStatus(entry: OwnedSession): Promise<void> {
    const transport = entry.transport!;
    const requests = new Set<string>();
    while (!entry.stopped) {
      const started = performance.now(), deadline = started + 30000;
      const timer = setTimeout(() => { void transport.close().catch(error => { entry.failure = error; }); }, 30000);
      timer.unref();
      try {
      const request = await transport.receive(personalContextBusinessStatusRequestSchema);
      if (requests.has(request.requestId) || requests.size >= 256) throw Error("personal_context_session_request_replayed");
      requests.add(request.requestId);
      let last = started;
      const assertDeadline = () => {
        const at = performance.now();
        if (!Number.isFinite(at) || at < last || at >= deadline) throw Error("personal_context_session_request_expired");
        last = at; this.assertCurrent(entry);
        const after = performance.now();
        if (!Number.isFinite(after) || after < last || after >= deadline) throw Error("personal_context_session_request_expired");
        last = after;
      };
      assertDeadline();
      if (jcsSerialize(request.identity) !== jcsSerialize(entry.identity)) throw Error("personal_context_session_request_binding");
      const result = this.registry.sessionStatus(entry.identity, request.query);
      const response = personalContextBusinessStatusResponseSchema.parse({ protocol: PERSONAL_CONTEXT_PROTOCOL, version: 1, type: "response", requestId: request.requestId, identity: entry.identity, method: "operation/status", queryDigest: jcsDigest(request.query), result });
      await transport.send(personalContextBusinessStatusResponseSchema, response, commit => {
        assertDeadline();
        const current = this.registry.sessionStatus(entry.identity, request.query);
        if (jcsSerialize(current) !== jcsSerialize(result)) throw Error("personal_context_session_result_changed");
        assertDeadline(); commit();
      });
      assertDeadline();
      } finally { clearTimeout(timer); }
    }
  }
  private closeOwned(entry: OwnedSession): Promise<void> {
    entry.stopped = true;
    if (entry.close) return entry.close;
    entry.close = (async () => {
      const errors: unknown[] = [];
      try { if (entry.row.state !== "stopping" && entry.row.state !== "closed" && entry.row.state !== "unknown") entry.row = this.journal.transition(entry.row, "stopping"); } catch (error) { errors.push(error); }
      try { if (entry.transport) await entry.transport.close(); else await entry.pipe?.close(); } catch (error) { errors.push(error); }
      // accept 的失败是原操作失败；只有实际 close 的失败意味着 owned I/O 未证明退出。
      if (entry.worker) await entry.worker.catch(error => { entry.failure ??= error; });
      if (!errors.length) {
        try {
          if (entry.row.state === "stopping" || entry.row.state === "unknown") entry.row = this.journal.transition(entry.row, "closed");
          if (entry.row.state !== "closed") throw Error("personal_context_session_cleanup_unverified");
        } catch (error) { errors.push(error); }
      }
      if (errors.length) {
        try { if (entry.row.state !== "closed" && entry.row.state !== "unknown") entry.row = this.journal.transition(entry.row, "unknown", { failureCode: "personal_context_session_cleanup_failed" }); } catch (error) { errors.push(error); }
        throw new AggregateError(errors, "personal_context_session_cleanup_failed");
      }
    })();
    void entry.close.catch(() => undefined); return entry.close;
  }
  private view(row: PersonalContextSessionRow): unknown {
    const entry = this.owned.get(row.operation_id);
    let binding: unknown = null;
    if (entry && !entry.stopped && ["listening", "connected"].includes(row.state)) {
      this.assertCurrent(entry);
      const key = this.keys.sessionKeyFacts(entry.identity.registrationId, entry.identity.registrationRevision), peer = this.registry.currentPeer(entry.identity);
      binding = { protocol: PERSONAL_CONTEXT_PROTOCOL, schemaDigest: PERSONAL_CONTEXT_TRANSPORT_SCHEMA_DIGEST, identity: entry.identity, saydoKeyDigest: key.publicKeyDigest, anyviaKeyDigest: personalContextPublicKeyDigest(createPublicKey(peer.publicKey)), bootEpoch: row.boot_epoch, endpoint: row.endpoint, local: { pid: row.owner_pid, birth: row.owner_birth }, peer: row.state === "connected" ? entry.pipe!.assertCurrent().peer : null };
    }
    return { operationId: row.operation_id, registrationId: row.registration_id, registrationRevision: row.registration_revision, revision: row.revision, state: row.state, failureCode: row.failure_code, binding };
  }
}
