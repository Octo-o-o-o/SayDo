// §19：双向本地适配器使用独立的安装公钥。认证此 peer 不授予 owner 身份。
import { createPublicKey, randomBytes, timingSafeEqual, verify, type KeyObject } from "node:crypto";
import { jcsSerialize, PERSONAL_CONTEXT_PROTOCOL, personalContextBoundarySchema } from "@saydo/contracts";

export interface PeerIdentity { installationId: string; nodeId: string; connectionId: string; connectionEpoch: number }
export interface PeerChallenge { protocol: typeof PERSONAL_CONTEXT_PROTOCOL; serverEpoch: string; nonce: string; expiresAt: number }
export interface PeerAssertion { nonce: string; operationDigest: string; signature: string }
declare const peerHandleBrand: unique symbol;
export interface AuthenticatedPeerHandle { readonly [peerHandleBrand]: true }
interface Pending { challenge: PeerChallenge; identity: PeerIdentity; key: KeyObject }
interface Authenticated { identity: PeerIdentity; operationDigest: string; expiresAt: number; key: KeyObject }
const identitySchema = personalContextBoundarySchema.pick({ installationId: true, nodeId: true, connectionId: true, connectionEpoch: true });
const digest = /^sha256:[a-f0-9]{64}$/u;
const nonce = /^[A-Za-z0-9_-]{43}$/u;
const signature = /^[A-Za-z0-9_-]{86}$/u;

/** 此函数提供明确的签名域；客户端不能用另一个方法或安装实例的签名过关。 */
export function peerAssertionBytes(challenge: PeerChallenge, identity: PeerIdentity, operationDigest: string): Buffer {
  return Buffer.from(jcsSerialize({ protocol: PERSONAL_CONTEXT_PROTOCOL, serverEpoch: challenge.serverEpoch, nonce: challenge.nonce, expiresAt: challenge.expiresAt, identity, operationDigest }), "utf8");
}

export class PersonalContextPeerAuthentication {
  readonly serverEpoch = randomBytes(32).toString("base64url");
  private readonly pending = new Map<string, Pending>();
  private highWater = 0;
  private readonly authenticated = new WeakMap<AuthenticatedPeerHandle, Authenticated>();
  constructor(private readonly currentPeer: (identity: PeerIdentity) => { publicKey: string }, private readonly now: () => number = Date.now) {}

  challenge(identity: PeerIdentity): PeerChallenge {
    identity = identitySchema.parse(identity);
    const at = this.time();
    for (const [id, value] of this.pending) if (value.challenge.expiresAt <= at) this.pending.delete(id);
    if (this.pending.size >= 32) throw new Error("personal_context_challenge_capacity");
    const registered = this.currentPeer(identity);
    const key = createPublicKey(registered.publicKey);
    if (key.asymmetricKeyType !== "ed25519") throw new Error("personal_context_key_type");
    const challenge = { protocol: PERSONAL_CONTEXT_PROTOCOL, serverEpoch: this.serverEpoch, nonce: randomBytes(32).toString("base64url"), expiresAt: at + 30000 };
    this.pending.set(challenge.nonce, { challenge, identity: structuredClone(identity), key });
    return structuredClone(challenge);
  }
  authenticate(input: unknown): AuthenticatedPeerHandle {
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).sort().join(",") !== "nonce,operationDigest,signature") throw new Error("personal_context_assertion_shape");
    const value = input as PeerAssertion;
    if (!nonce.test(value.nonce) || !digest.test(value.operationDigest) || !signature.test(value.signature)) throw new Error("personal_context_assertion_shape");
    const entry = this.pending.get(value.nonce);
    this.pending.delete(value.nonce);
    if (!entry || entry.challenge.expiresAt <= this.time()) throw new Error("personal_context_challenge_stale");
    const current = createPublicKey(this.currentPeer(entry.identity).publicKey);
    const savedBytes = entry.key.export({ type: "spki", format: "der" }), currentBytes = current.export({ type: "spki", format: "der" });
    if (savedBytes.length !== currentBytes.length || !timingSafeEqual(savedBytes, currentBytes)) throw new Error("personal_context_key_changed");
    if (!verify(null, peerAssertionBytes(entry.challenge, entry.identity, value.operationDigest), entry.key, Buffer.from(value.signature, "base64url"))) throw new Error("personal_context_signature_invalid");
    const handle = Object.freeze({}) as AuthenticatedPeerHandle;
    this.authenticated.set(handle, { identity: entry.identity, operationDigest: value.operationDigest, expiresAt: entry.challenge.expiresAt, key: entry.key });
    return handle;
  }
  /** 由业务事务在实际效果/发送前调用；HTTP JSON不能制造 WeakMap 中的句柄。 */
  assertCurrent(handle: AuthenticatedPeerHandle, operationDigest: string): Readonly<PeerIdentity> {
    const value = this.authenticated.get(handle);
    if (!value || value.expiresAt <= this.time() || value.operationDigest !== operationDigest) throw new Error("personal_context_authentication_stale");
    const current = createPublicKey(this.currentPeer(value.identity).publicKey);
    const original = value.key.export({ type: "spki", format: "der" }), latest = current.export({ type: "spki", format: "der" });
    if (original.length !== latest.length || !timingSafeEqual(original, latest)) throw new Error("personal_context_key_changed");
    return Object.freeze(structuredClone(value.identity));
  }
  discard(handle: AuthenticatedPeerHandle): void { this.authenticated.delete(handle); }
  private time(): number {
    const value = this.now();
    if (!Number.isSafeInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER - 30000) throw new Error("personal_context_clock_invalid");
    this.highWater = Math.max(this.highWater, value);
    return this.highWater;
  }
}
