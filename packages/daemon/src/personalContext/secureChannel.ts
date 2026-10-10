// 加密通道原语，不授予 peer、Owner 或效果许可；OS 端点适配器尚须单独装配。
import { createCipheriv, createDecipheriv, createHash, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, sign, verify, type KeyObject } from "node:crypto";
import { jcsDigest, jcsSerialize, PERSONAL_CONTEXT_PROTOCOL, PERSONAL_CONTEXT_DIRECTION_FRAMES, PERSONAL_CONTEXT_MAX_FRAME_BYTES, PERSONAL_CONTEXT_MAX_HANDSHAKE_BYTES, PERSONAL_CONTEXT_TRANSPORT_SCHEMA_DIGEST, personalContextTransportAssertionSchema, personalContextTransportBindingSchema, personalContextTransportHelloSchema, type PersonalContextTransportAssertion, type PersonalContextTransportBinding, type PersonalContextTransportHello, type PersonalContextTransportRole } from "@saydo/contracts";

const opposite = (role: PersonalContextTransportRole): PersonalContextTransportRole => role === "saydo" ? "anyvia" : "saydo";
const utf8 = new TextDecoder("utf-8", { fatal: true });
const bytes = (value: unknown): Buffer => Buffer.from(jcsSerialize(value), "utf8");
export function personalContextPublicKeyDigest(key: KeyObject): string {
  if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") throw Error("personal_context_transport_key");
  return `sha256:${createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex")}`;
}
function decodeHandshake(input: Buffer): unknown {
  if (input.length === 0 || input.length > PERSONAL_CONTEXT_MAX_HANDSHAKE_BYTES) throw Error("personal_context_handshake_size");
  const value: unknown = JSON.parse(utf8.decode(input));
  // 唯一编码也拒绝重复 JSON 键，避免两实现解释不同的签名内容。
  if (!bytes(value).equals(input)) throw Error("personal_context_handshake_encoding");
  return value;
}

export interface PersonalContextHandshakeOptions {
  role: PersonalContextTransportRole;
  binding: PersonalContextTransportBinding;
  bootEpoch: string;
  privateKey: KeyObject;
  peerKey: KeyObject;
  // 只能由受保护传输组合根提供，每公共入口重查端点与当前登记。
  assertCurrent: () => void;
  monotonicNow?: () => number;
}

export class PersonalContextSecureHandshake {
  private readonly hello: PersonalContextTransportHello;
  private ephemeral: KeyObject | undefined;
  private readonly started: number;
  private lastTime: number;
  private transcript: Buffer | undefined;
  private peerHello: PersonalContextTransportHello | undefined;
  private closed = false;
  private readonly now: () => number;
  private readonly options: PersonalContextHandshakeOptions;
  constructor(options: PersonalContextHandshakeOptions) {
    const binding = personalContextTransportBindingSchema.parse(options.binding);
    this.options = { ...options, binding };
    this.now = options.monotonicNow ?? (() => performance.now());
    this.started = this.now(); this.lastTime = this.started;
    if (!Number.isFinite(this.started) || this.started < 0) throw Error("personal_context_transport_clock");
    if (options.privateKey.type !== "private" || options.privateKey.asymmetricKeyType !== "ed25519") throw Error("personal_context_transport_key");
    if (personalContextPublicKeyDigest(createPublicKey(options.privateKey)) !== binding[`${options.role}KeyDigest`] ||
        personalContextPublicKeyDigest(options.peerKey) !== binding[`${opposite(options.role)}KeyDigest`]) throw Error("personal_context_transport_key_binding");
    options.assertCurrent();
    const ephemeral = generateKeyPairSync("x25519"); this.ephemeral = ephemeral.privateKey;
    this.hello = personalContextTransportHelloSchema.parse({ protocol: PERSONAL_CONTEXT_PROTOCOL, schemaDigest: PERSONAL_CONTEXT_TRANSPORT_SCHEMA_DIGEST,
      role: options.role, binding, bootEpoch: options.bootEpoch, nonce: randomBytes(32).toString("base64url"),
      ephemeralKey: ephemeral.publicKey.export({ type: "spki", format: "der" }).toString("base64url") });
  }
  helloBytes(): Buffer { return this.attempt(() => { this.guard(); return bytes(this.hello); }); }
  acceptHello(input: Buffer): Buffer {
    return this.attempt(() => {
      this.guard(); if (this.peerHello) throw Error("personal_context_handshake_repeated");
      const peer = personalContextTransportHelloSchema.parse(decodeHandshake(input));
      if (peer.role !== opposite(this.options.role) || peer.schemaDigest !== PERSONAL_CONTEXT_TRANSPORT_SCHEMA_DIGEST ||
          jcsDigest(peer.binding) !== jcsDigest(this.options.binding) || peer.nonce === this.hello.nonce) throw Error("personal_context_handshake_binding");
      const key = createPublicKey({ key: Buffer.from(peer.ephemeralKey, "base64url"), type: "spki", format: "der" });
      if (key.asymmetricKeyType !== "x25519" || key.export({ type: "spki", format: "der" }).toString("base64url") !== peer.ephemeralKey) throw Error("personal_context_handshake_ephemeral");
      this.peerHello = peer;
      this.transcript = bytes({ domain: "personal-context-handshake/1", anyvia: this.options.role === "anyvia" ? this.hello : peer, saydo: this.options.role === "saydo" ? this.hello : peer });
      const assertion: PersonalContextTransportAssertion = { role: this.options.role, transcriptDigest: jcsDigest(JSON.parse(this.transcript.toString("utf8"))),
        signature: sign(null, this.signatureBytes(this.options.role), this.options.privateKey).toString("base64url") };
      return bytes(assertion);
    });
  }
  finish(input: Buffer): PersonalContextSecureChannel {
    return this.attempt(() => {
      this.guard(); if (!this.transcript || !this.peerHello || !this.ephemeral) throw Error("personal_context_handshake_order");
      const assertion = personalContextTransportAssertionSchema.parse(decodeHandshake(input));
      const transcriptDigest = jcsDigest(JSON.parse(this.transcript.toString("utf8")));
      if (assertion.role !== opposite(this.options.role) || assertion.transcriptDigest !== transcriptDigest ||
          !verify(null, this.signatureBytes(assertion.role), this.options.peerKey, Buffer.from(assertion.signature, "base64url"))) throw Error("personal_context_handshake_signature");
      const shared = diffieHellman({ privateKey: this.ephemeral, publicKey: createPublicKey({ key: Buffer.from(this.peerHello.ephemeralKey, "base64url"), type: "spki", format: "der" }) });
      try {
        if (shared.length !== 32 || shared.every(value => value === 0)) throw Error("personal_context_handshake_shared_secret");
        const salt = createHash("sha256").update(this.transcript).digest();
        const key = (role: PersonalContextTransportRole) => Buffer.from(hkdfSync("sha256", shared, salt, bytes({ protocol: PERSONAL_CONTEXT_PROTOCOL, domain: "personal-context-frame-key/1", direction: role }), 32));
        const channel = new PersonalContextSecureChannel(this.options.role, transcriptDigest, key(this.options.role), key(opposite(this.options.role)), this.options.assertCurrent, this.started, this.lastTime, this.now);
        this.close(); return channel;
      } finally { shared.fill(0); }
    });
  }
  close(): void { this.closed = true; this.ephemeral = undefined; this.transcript = undefined; this.peerHello = undefined; }
  private signatureBytes(role: PersonalContextTransportRole): Buffer {
    if (!this.transcript) throw Error("personal_context_handshake_order");
    return bytes({ domain: "personal-context-handshake-signature/1", role, transcript: JSON.parse(this.transcript.toString("utf8")) });
  }
  private guard(): void {
    if (this.closed) throw Error("personal_context_handshake_closed");
    const now = this.now();
    if (!Number.isFinite(now) || now < this.lastTime || now - this.started >= 5000) { this.close(); throw Error("personal_context_handshake_expired"); }
    this.lastTime = now; this.options.assertCurrent();
  }
  private attempt<T>(work: () => T): T { try { return work(); } catch { this.close(); throw Error("personal_context_handshake_rejected"); } }
}

export class PersonalContextSecureChannel {
  private sent = 0;
  private received = 0;
  private sentConfirmation = false;
  private receivedConfirmation = false;
  private closed = false;
  private lastActivity: number;
  constructor(private readonly role: PersonalContextTransportRole, private readonly transcriptDigest: string,
    private readonly sendKey: Buffer, private readonly receiveKey: Buffer, private readonly assertCurrent: () => void,
    private readonly handshakeStarted: number, private lastObserved: number, private readonly now: () => number) { this.lastActivity = lastObserved; }
  confirmation(): Buffer {
    return this.attempt(() => { this.guard(); if (this.sentConfirmation) throw Error("confirmation_repeated");
      const result = this.encrypt(bytes({ kind: "key-confirmation", transcriptDigest: this.transcriptDigest, role: this.role }));
      this.sentConfirmation = true; return result;
    });
  }
  acceptConfirmation(frame: Buffer): void {
    this.attempt(() => { this.guard(); if (this.receivedConfirmation) throw Error("confirmation_repeated");
      const result = this.decrypt(frame);
      if (!result.equals(bytes({ kind: "key-confirmation", transcriptDigest: this.transcriptDigest, role: opposite(this.role) }))) throw Error("confirmation_invalid");
      this.receivedConfirmation = true;
    });
  }
  seal(plaintext: Buffer): Buffer { return this.attempt(() => { this.ready(); return this.encrypt(plaintext); }); }
  open(frame: Buffer): Buffer { return this.attempt(() => { this.ready(); return this.decrypt(frame); }); }
  close(): void { this.closed = true; this.sendKey.fill(0); this.receiveKey.fill(0); }
  private guard(): void {
    if (this.closed) throw Error("channel_closed");
    const at = this.now();
    if (!Number.isFinite(at) || at < this.lastObserved ||
        ((!this.sentConfirmation || !this.receivedConfirmation) && at - this.handshakeStarted >= 5000) ||
        at - this.lastActivity >= 5000) throw Error("channel_expired");
    this.lastObserved = at; this.lastActivity = at; this.assertCurrent();
  }
  private ready(): void { this.guard(); if (!this.sentConfirmation || !this.receivedConfirmation) throw Error("confirmation_required"); }
  private aad(role: PersonalContextTransportRole, sequence: number): Buffer { return bytes({ protocol: PERSONAL_CONTEXT_PROTOCOL, transcriptDigest: this.transcriptDigest, direction: role, sequence }); }
  private iv(sequence: number): Buffer { const value = Buffer.alloc(12); value.writeBigUInt64BE(BigInt(sequence), 4); return value; }
  private encrypt(plaintext: Buffer): Buffer {
    if (this.sent >= PERSONAL_CONTEXT_DIRECTION_FRAMES || plaintext.length === 0 || plaintext.length + 28 > PERSONAL_CONTEXT_MAX_FRAME_BYTES) throw Error("frame_limit");
    const sequence = this.sent++;
    const cipher = createCipheriv("aes-256-gcm", this.sendKey, this.iv(sequence), { authTagLength: 16 });
    cipher.setAAD(this.aad(this.role, sequence));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const header = Buffer.alloc(12); header.writeUInt32BE(24 + ciphertext.length); header.writeBigUInt64BE(BigInt(sequence), 4);
    return Buffer.concat([header, cipher.getAuthTag(), ciphertext]);
  }
  private decrypt(frame: Buffer): Buffer {
    if (this.received >= PERSONAL_CONTEXT_DIRECTION_FRAMES || frame.length <= 28 || frame.length > PERSONAL_CONTEXT_MAX_FRAME_BYTES ||
        frame.readUInt32BE(0) !== frame.length - 4 || frame.readBigUInt64BE(4) !== BigInt(this.received)) throw Error("frame_limit");
    const sequence = this.received++;
    const decipher = createDecipheriv("aes-256-gcm", this.receiveKey, this.iv(sequence), { authTagLength: 16 });
    decipher.setAAD(this.aad(opposite(this.role), sequence)); decipher.setAuthTag(frame.subarray(12, 28));
    // final 验证成功前不把 update 的暂存正文交给调用者。
    const tentative = decipher.update(frame.subarray(28));
    try { return Buffer.concat([tentative, decipher.final()]); } finally { tentative.fill(0); }
  }
  private attempt<T>(work: () => T): T { try { return work(); } catch { this.close(); throw Error("personal_context_channel_rejected"); } }
}
