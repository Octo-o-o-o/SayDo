// 测试用 fake platform authenticator(§12-13 反例集基建):真 P-256 密钥 + 真 DER ECDSA 签名,
// daemon 侧走完整验签路径(不 mock 密码学);可注入 UP/UV/BE/BS/signCount/错误 rpId/错误密钥构造反例。

import { createHash, generateKeyPairSync, randomBytes, sign as cryptoSign, type KeyObject } from "node:crypto";
import { encodeCbor, type CborValue } from "../../src/tier1/webauthn/cbor.js";

export interface AuthDataOpts {
  at?: boolean;
  up?: boolean;
  uv?: boolean;
  be?: boolean;
  bs?: boolean;
  signCount?: number;
}

export class FakeAuthenticator {
  private readonly keys = generateKeyPairSync("ec", { namedCurve: "P-256" });
  readonly credentialIdBytes = randomBytes(16);
  /** 平台 passkey 常态 = 恒 0(09 §3.3 schema 注) */
  signCount = 0;
  be = true;
  bs = true;

  credentialId(): string {
    return Buffer.from(this.credentialIdBytes).toString("base64url");
  }

  coseKey(): Uint8Array {
    const jwk = this.keys.publicKey.export({ format: "jwk" }) as { x: string; y: string };
    const m = new Map<number | string, CborValue>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, new Uint8Array(Buffer.from(jwk.x, "base64url"))],
      [-3, new Uint8Array(Buffer.from(jwk.y, "base64url"))]
    ]);
    return encodeCbor(m);
  }

  authData(rpId: string, opts: AuthDataOpts = {}): Buffer {
    const rpIdHash = createHash("sha256").update(rpId).digest();
    let flags = 0;
    if (opts.up ?? true) flags |= 0x01;
    if (opts.uv ?? true) flags |= 0x04;
    if (opts.be ?? this.be) flags |= 0x08;
    if (opts.bs ?? this.bs) flags |= 0x10;
    if (opts.at ?? false) flags |= 0x40;
    const sc = Buffer.alloc(4);
    sc.writeUInt32BE(opts.signCount ?? this.signCount);
    const base = Buffer.concat([rpIdHash, Buffer.from([flags]), sc]);
    if (!(opts.at ?? false)) return base;
    const aaguid = Buffer.alloc(16);
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(this.credentialIdBytes.length);
    return Buffer.concat([base, aaguid, idLen, this.credentialIdBytes, this.coseKey()]);
  }

  clientData(type: "webauthn.create" | "webauthn.get", challenge: string, origin: string): Buffer {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }), "utf8");
  }

  /** 注册载荷(registerWebauthn 的 attestation 入参;fmt="none" = platform authenticator 缺省) */
  attest(challenge: string, origin: string, rpId: string, opts: AuthDataOpts = {}): string {
    const cdj = this.clientData("webauthn.create", challenge, origin);
    const attObj = encodeCbor(
      new Map<number | string, CborValue>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", new Uint8Array(this.authData(rpId, { at: true, ...opts }))]
      ])
    );
    return JSON.stringify({
      clientDataJSON: cdj.toString("base64url"),
      attestationObject: Buffer.from(attObj).toString("base64url")
    });
  }

  /** 断言载荷(verifyS3Assertion 的 assertion 入参);opts.signer 注入错误密钥构造验签失败反例 */
  assert(
    challenge: string,
    origin: string,
    rpId: string,
    opts: AuthDataOpts & { signer?: KeyObject; credentialIdOverride?: string } = {}
  ): string {
    const cdj = this.clientData("webauthn.get", challenge, origin);
    const ad = this.authData(rpId, { at: false, ...opts });
    const payload = Buffer.concat([ad, createHash("sha256").update(cdj).digest()]);
    const sig = cryptoSign("sha256", payload, opts.signer ?? this.keys.privateKey);
    return JSON.stringify({
      credentialId: opts.credentialIdOverride ?? this.credentialId(),
      clientDataJSON: cdj.toString("base64url"),
      authenticatorData: ad.toString("base64url"),
      signature: sig.toString("base64url")
    });
  }

  wrongKey(): KeyObject {
    return generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey;
  }
}
