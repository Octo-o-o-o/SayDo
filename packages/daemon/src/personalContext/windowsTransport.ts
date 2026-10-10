// §19.2.1：把真实内核观察与加密帧装配；业务权限仍由调用方最终写者核验。
import { createPublicKey, type KeyObject } from "node:crypto";
import { jcsDigest, jcsSerialize, PERSONAL_CONTEXT_MAX_FRAME_BYTES, PERSONAL_CONTEXT_MAX_HANDSHAKE_BYTES, type PersonalContextPeerIdentity, type PersonalContextTransportRole } from "@saydo/contracts";
import type { Win32PersonalPipe } from "@saydo/platform";
import { PersonalContextSecureHandshake, personalContextPublicKeyDigest, type PersonalContextSecureChannel } from "./secureChannel.js";

export interface PersonalContextWindowsTransportOptions {
  role: PersonalContextTransportRole;
  identity: PersonalContextPeerIdentity;
  bootEpoch: string;
  privateKey: KeyObject;
  peerKey: KeyObject;
  assertCurrent: () => void;
}
interface StrictDecoder<T> { parse(value: unknown): T }
const utf8 = new TextDecoder("utf-8", { fatal: true });

export class PersonalContextWindowsTransport {
  private channel: PersonalContextSecureChannel | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closing: Promise<void> | undefined;
  private stopped = false;
  private reading = false;
  private writing = false;
  private lastObserved = performance.now();
  private deadline = this.lastObserved + 5000;
  private resolveClosed!: () => void;
  private rejectClosed!: (error: unknown) => void;
  readonly closed = new Promise<void>((resolve, reject) => { this.resolveClosed = resolve; this.rejectClosed = reject; });
  private constructor(private readonly pipe: Win32PersonalPipe, private readonly options: PersonalContextWindowsTransportOptions) {
    // 调用方监督 closed；未及时订阅也不会产生全局未处理拒绝。
    void this.closed.catch(() => undefined);
  }

  static async establish(pipe: Win32PersonalPipe, options: PersonalContextWindowsTransportOptions): Promise<PersonalContextWindowsTransport> {
    const transport = new PersonalContextWindowsTransport(pipe, options);
    let handshake: PersonalContextSecureHandshake | undefined;
    try {
      const observation = pipe.assertCurrent();
      const localDigest = personalContextPublicKeyDigest(createPublicKey(options.privateKey));
      const peerDigest = personalContextPublicKeyDigest(options.peerKey);
      const binding = {
        identity: options.identity,
        saydoKeyDigest: options.role === "saydo" ? localDigest : peerDigest,
        anyviaKeyDigest: options.role === "anyvia" ? localDigest : peerDigest,
        endpoint: { platform: "win32" as const, endpointDigest: jcsDigest({ name: observation.name }), owner: observation.owner,
          saydo: options.role === "saydo" ? observation.local : observation.peer,
          anyvia: options.role === "anyvia" ? observation.local : observation.peer },
      };
      handshake = new PersonalContextSecureHandshake({ ...options, binding, assertCurrent: () => transport.guard() });
      transport.armDeadline();
      const hello = await transport.exchangeHandshake(handshake.helloBytes());
      const assertion = await transport.exchangeHandshake(handshake.acceptHello(hello));
      transport.channel = handshake.finish(assertion);
      const confirmation = transport.channel.confirmation();
      const [, peerConfirmation] = await Promise.all([transport.writeFrame(confirmation, commit => commit()), transport.readFrame(PERSONAL_CONTEXT_MAX_FRAME_BYTES, 25)]);
      transport.channel.acceptConfirmation(peerConfirmation);
      transport.guard(); transport.armDeadline();
      return transport;
    } catch (error) { await transport.close(); throw error; }
    finally { handshake?.close(); }
  }

  // 必须传 canonical strict schema；身份认证与 parse 不能替代当前业务授权。
  async send<T>(schema: StrictDecoder<T>, value: T, finalWriter: (commit: () => void) => void): Promise<void> {
    let plaintext: Buffer | undefined;
    try {
      this.guard(); if (!this.channel || this.writing) throw Error("personal_context_transport_write_busy");
      this.writing = true;
      plaintext = Buffer.from(jcsSerialize(schema.parse(value)), "utf8");
      const frame = this.channel.seal(plaintext);
      await this.writeFrame(frame, finalWriter);
      this.guard(); this.armDeadline();
    } catch (error) { await this.close(); throw error; }
    finally { plaintext?.fill(0); this.writing = false; }
  }

  async receive<T>(schema: StrictDecoder<T>): Promise<T> {
    let plaintext: Buffer | undefined;
    try {
      this.guard(); if (!this.channel || this.reading) throw Error("personal_context_transport_read_busy");
      this.reading = true;
      plaintext = this.channel.open(await this.readFrame(PERSONAL_CONTEXT_MAX_FRAME_BYTES, 25));
      const value: unknown = JSON.parse(utf8.decode(plaintext));
      if (!Buffer.from(jcsSerialize(value), "utf8").equals(plaintext)) throw Error("personal_context_transport_encoding");
      const result = schema.parse(value);
      this.guard(); this.armDeadline(); return result;
    } catch (error) { await this.close(); throw error; }
    finally { plaintext?.fill(0); this.reading = false; }
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopped = true; if (this.timer) clearTimeout(this.timer);
    this.channel?.close();
    this.closing = this.pipe.close();
    // 自动截止与显式关闭共享同一实际 I/O 清理结果，监督者可以提前订阅。
    void this.closing.then(this.resolveClosed, this.rejectClosed);
    return this.closing;
  }
  private guard(): void {
    const at = performance.now();
    if (this.stopped || !Number.isFinite(at) || at < this.lastObserved || at >= this.deadline) throw Error("personal_context_transport_closed");
    this.lastObserved = at; this.pipe.assertCurrent(); this.options.assertCurrent();
    // 同步权限回调也可能阻塞事件循环；不能依赖尚未执行的 timer 判定仍有效。
    const after = performance.now();
    if (!Number.isFinite(after) || after < at || after >= this.deadline) throw Error("personal_context_transport_expired");
    this.lastObserved = after;
  }
  private armDeadline(): void {
    if (this.timer) clearTimeout(this.timer);
    // 只在已通过原期限的成功操作后延长空闲期限。
    this.guard(); this.deadline = this.lastObserved + 5000;
    this.timer = setTimeout(() => { void this.close(); }, 5000);
    this.timer.unref();
  }
  private async writeFrame(frame: Buffer, finalWriter: (commit: () => void) => void): Promise<void> {
    this.guard();
    await this.pipe.write(frame, commit => finalWriter(() => { this.guard(); commit(); }));
  }
  private async readFrame(maximum: number, minimumBody: number): Promise<Buffer> {
    this.guard(); const header = await this.pipe.readExact(4), length = header.readUInt32BE(0);
    if (length < minimumBody || length + 4 > maximum) throw Error("personal_context_transport_frame_size");
    const body = await this.pipe.readExact(length); this.guard(); return Buffer.concat([header, body]);
  }
  private async exchangeHandshake(body: Buffer): Promise<Buffer> {
    if (body.length < 1 || body.length > PERSONAL_CONTEXT_MAX_HANDSHAKE_BYTES) throw Error("personal_context_handshake_size");
    const header = Buffer.alloc(4); header.writeUInt32BE(body.length);
    const [, received] = await Promise.all([this.writeFrame(Buffer.concat([header, body]), commit => commit()), this.readFrame(PERSONAL_CONTEXT_MAX_HANDSHAKE_BYTES + 4, 1)]);
    return received.subarray(4);
  }
}
