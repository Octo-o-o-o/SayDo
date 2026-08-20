// WebAuthn 校验核(09 §3.3 签发链/注册链的密码学承载;node:crypto,零第三方依赖)。
// 范围:platform authenticator 主路径 = ES256(P-256)COSE 公钥 + attestation "none" 形态;
// 其他 alg/格式 fail-closed 拒(诚实报错,不降级)。全部校验规则照抄 09 §3.3:
//   assertion:type ∧ challenge ∧ origin 精确 ∧ rpIdHash ∧ UP=1 ∧ UV=1 ∧ COSE 验签 ∧ signCount 规则;
//   register:type ∧ challenge ∧ origin ∧ rpIdHash ∧ UP=1 ∧ UV=1,提取 credentialId/COSE key/BE/BS。

import { createHash, createPublicKey, verify as cryptoVerify, type KeyObject } from "node:crypto";
import { decodeCbor, decodeCborPrefix, type CborMap } from "./cbor.js";

export interface AuthenticatorData {
  rpIdHash: Uint8Array;
  flags: { up: boolean; uv: boolean; be: boolean; bs: boolean; at: boolean };
  signCount: number;
  /** AT=1 时的注册凭据数据 */
  attested?: { aaguid: Uint8Array; credentialId: Uint8Array; publicKeyCose: Uint8Array };
}

export function parseAuthenticatorData(data: Uint8Array): AuthenticatorData {
  if (data.length < 37) throw new Error("authenticatorData too short");
  const rpIdHash = data.subarray(0, 32);
  const flagsByte = data[32] as number;
  const flags = {
    up: (flagsByte & 0x01) !== 0,
    uv: (flagsByte & 0x04) !== 0,
    be: (flagsByte & 0x08) !== 0,
    bs: (flagsByte & 0x10) !== 0,
    at: (flagsByte & 0x40) !== 0
  };
  const signCount =
    (((data[33] as number) << 24) | ((data[34] as number) << 16) | ((data[35] as number) << 8) | (data[36] as number)) >>> 0;
  const out: AuthenticatorData = { rpIdHash: new Uint8Array(rpIdHash), flags, signCount };
  if (flags.at) {
    if (data.length < 55) throw new Error("attested credential data too short");
    const aaguid = data.subarray(37, 53);
    const idLen = ((data[53] as number) << 8) | (data[54] as number);
    if (data.length < 55 + idLen) throw new Error("credentialId out of range");
    const credentialId = data.subarray(55, 55 + idLen);
    const coseStart = 55 + idLen;
    const { bytes } = decodeCborPrefix(data.subarray(coseStart)); // COSE key 后可能跟 extensions
    const publicKeyCose = data.subarray(coseStart, coseStart + bytes);
    out.attested = {
      aaguid: new Uint8Array(aaguid),
      credentialId: new Uint8Array(credentialId),
      publicKeyCose: new Uint8Array(publicKeyCose)
    };
  }
  return out;
}

/** COSE_Key(ES256/P-256)→ node KeyObject;其他 kty/alg/crv 拒(fail-closed) */
export function coseKeyToKeyObject(cose: Uint8Array): KeyObject {
  const m = decodeCbor(cose);
  if (!(m instanceof Map)) throw new Error("COSE key: not a map");
  const map = m as CborMap;
  const kty = map.get(1);
  const alg = map.get(3);
  const crv = map.get(-1);
  const x = map.get(-2);
  const y = map.get(-3);
  if (kty !== 2) throw new Error(`COSE key: unsupported kty ${String(kty)} (only EC2)`);
  if (alg !== -7) throw new Error(`COSE key: unsupported alg ${String(alg)} (only ES256)`);
  if (crv !== 1) throw new Error(`COSE key: unsupported crv ${String(crv)} (only P-256)`);
  if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) {
    throw new Error("COSE key: x/y must be 32-byte strings");
  }
  return createPublicKey({
    key: { kty: "EC", crv: "P-256", x: Buffer.from(x).toString("base64url"), y: Buffer.from(y).toString("base64url") },
    format: "jwk"
  });
}

export function sha256(data: Uint8Array | string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

export interface ClientDataChecks {
  expectedType: "webauthn.get" | "webauthn.create";
  expectedChallenge: string; // base64url(挑战原文的 base64url 编码,与浏览器 clientData.challenge 同型)
  expectedOrigin: string; // 精确匹配(09 §3.3:http://localhost:<port>)
}

/** clientDataJSON 三断言(type/challenge/origin);全过返回 null,否则失败原因 */
export function checkClientData(clientDataJson: Uint8Array, c: ClientDataChecks): string | null {
  let parsed: { type?: unknown; challenge?: unknown; origin?: unknown };
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(clientDataJson)) as typeof parsed;
  } catch {
    return "clientDataJSON is not valid JSON";
  }
  if (parsed.type !== c.expectedType) return `clientData.type mismatch: ${String(parsed.type)}`;
  if (parsed.challenge !== c.expectedChallenge) return "clientData.challenge mismatch (replay/wrong challenge)";
  if (parsed.origin !== c.expectedOrigin) return `clientData.origin mismatch: ${String(parsed.origin)}`;
  return null;
}

/**
 * signCount 规则(09 §3.3 schema 注,逐字):received>0 时须 > stored(否则拒+告警);
 * received=0 ∧ stored=0(平台 passkey 常态)⇒ 跳过克隆检测并诚实记"该形态克隆检测不可用"。
 */
export function signCountVerdict(
  received: number,
  stored: number
): { ok: true; note: "clone_check_passed" | "clone_check_unavailable" } | { ok: false; reason: string } {
  if (received > 0) {
    if (received > stored) return { ok: true, note: "clone_check_passed" };
    return { ok: false, reason: `signCount regression: received=${received} stored=${stored} (possible clone)` };
  }
  if (stored === 0) return { ok: true, note: "clone_check_unavailable" };
  return { ok: false, reason: `signCount dropped to 0 from stored=${stored} (possible clone)` };
}

export interface AssertionInput {
  publicKeyCose: string; // base64url(库内凭据行)
  storedSignCount: number;
  clientDataJson: Uint8Array;
  authenticatorData: Uint8Array;
  signature: Uint8Array; // DER ECDSA
  expectedChallenge: string; // base64url
  expectedOrigin: string;
  expectedRpId: string;
}

export type AssertionVerdict =
  | {
      ok: true;
      newSignCount: number;
      cloneNote: "clone_check_passed" | "clone_check_unavailable";
      backupEligible: boolean;
      backupState: boolean;
    }
  | { ok: false; reason: string };

/** WebAuthn assertion 校验全链(09 §3.3 签发链 ③:全过才签) */
export function verifyWebauthnAssertion(i: AssertionInput): AssertionVerdict {
  const clientDataFail = checkClientData(i.clientDataJson, {
    expectedType: "webauthn.get",
    expectedChallenge: i.expectedChallenge,
    expectedOrigin: i.expectedOrigin
  });
  if (clientDataFail) return { ok: false, reason: clientDataFail };
  let auth: AuthenticatorData;
  try {
    auth = parseAuthenticatorData(i.authenticatorData);
  } catch (err) {
    return { ok: false, reason: `authenticatorData parse failed: ${String(err instanceof Error ? err.message : err)}` };
  }
  if (!bytesEqual(auth.rpIdHash, sha256(i.expectedRpId))) {
    return { ok: false, reason: `rpIdHash mismatch (expected rpId=${i.expectedRpId})` };
  }
  // UP=1 ∧ UV=1(用户在场且已生物/本机强认证——os_biometric 语义的机械支撑,缺任一即拒)
  if (!auth.flags.up) return { ok: false, reason: "UP flag not set (user not present)" };
  if (!auth.flags.uv) return { ok: false, reason: "UV flag not set (user not verified; os_biometric requires UV)" };
  let key: KeyObject;
  try {
    key = coseKeyToKeyObject(Buffer.from(i.publicKeyCose, "base64url"));
  } catch (err) {
    return { ok: false, reason: `COSE key invalid: ${String(err instanceof Error ? err.message : err)}` };
  }
  // 签名域 = authenticatorData || SHA-256(clientDataJSON)(WebAuthn L2 §6.3.3)
  const signedPayload = Buffer.concat([i.authenticatorData, sha256(i.clientDataJson)]);
  let sigOk = false;
  try {
    sigOk = cryptoVerify("sha256", signedPayload, key, i.signature);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { ok: false, reason: "signature verification failed" };
  const sc = signCountVerdict(auth.signCount, i.storedSignCount);
  if (!sc.ok) return { ok: false, reason: sc.reason };
  return {
    ok: true,
    newSignCount: auth.signCount,
    cloneNote: sc.note,
    backupEligible: auth.flags.be,
    backupState: auth.flags.bs
  };
}

export interface AttestationInput {
  clientDataJson: Uint8Array;
  attestationObject: Uint8Array; // CBOR { fmt, attStmt, authData }
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
}

export type AttestationVerdict =
  | {
      ok: true;
      credentialId: string; // base64url
      publicKeyCose: string; // base64url
      signCount: number;
      backupEligible: boolean;
      backupState: boolean;
    }
  | { ok: false; reason: string };

/**
 * 注册链校验(09 §3.3):回验 challenge/origin/rpIdHash/UP/UV,提取 credentialId + COSE 公钥 + signCount + BE/BS。
 * attestation 声明(attStmt)P0 不做链验证——platform authenticator 缺省 attestation="none",
 * 信任根 = 注册仪式本身(owner 亲自在受信终端 + loopback 通道绑定),与 04 §5.1 语义一致。
 */
export function verifyWebauthnAttestation(i: AttestationInput): AttestationVerdict {
  const clientDataFail = checkClientData(i.clientDataJson, {
    expectedType: "webauthn.create",
    expectedChallenge: i.expectedChallenge,
    expectedOrigin: i.expectedOrigin
  });
  if (clientDataFail) return { ok: false, reason: clientDataFail };
  let attObj: unknown;
  try {
    attObj = decodeCbor(i.attestationObject);
  } catch (err) {
    return { ok: false, reason: `attestationObject decode failed: ${String(err instanceof Error ? err.message : err)}` };
  }
  if (!(attObj instanceof Map)) return { ok: false, reason: "attestationObject is not a CBOR map" };
  const authData = (attObj as CborMap).get("authData");
  if (!(authData instanceof Uint8Array)) return { ok: false, reason: "attestationObject.authData missing" };
  let auth: AuthenticatorData;
  try {
    auth = parseAuthenticatorData(authData);
  } catch (err) {
    return { ok: false, reason: `authData parse failed: ${String(err instanceof Error ? err.message : err)}` };
  }
  if (!bytesEqual(auth.rpIdHash, sha256(i.expectedRpId))) {
    return { ok: false, reason: `rpIdHash mismatch (expected rpId=${i.expectedRpId})` };
  }
  if (!auth.flags.up) return { ok: false, reason: "UP flag not set" };
  if (!auth.flags.uv) return { ok: false, reason: "UV flag not set (userVerification=required)" };
  if (!auth.attested) return { ok: false, reason: "no attested credential data (AT flag not set)" };
  try {
    coseKeyToKeyObject(auth.attested.publicKeyCose); // 公钥可用性预检(ES256/P-256 之外拒)
  } catch (err) {
    return { ok: false, reason: String(err instanceof Error ? err.message : err) };
  }
  return {
    ok: true,
    credentialId: Buffer.from(auth.attested.credentialId).toString("base64url"),
    publicKeyCose: Buffer.from(auth.attested.publicKeyCose).toString("base64url"),
    signCount: auth.signCount,
    backupEligible: auth.flags.be,
    backupState: auth.flags.bs
  };
}
