// §19.2.2：仅按精确产品引用访问 Credential Manager；绝不枚举用户凭据。
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { createRequire } from "node:module";
import type * as Koffi from "koffi";

const require = createRequire(import.meta.url);
const comment = "Ed25519 PKCS8 DER";
const userName = "saydo-personal-context/1";
const referencePattern = /^saydo-personal-context(?:-test)?\/1\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const digest = (value: Buffer | string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
interface Credential {
  Flags: number; Type: number; TargetName: string; Comment: string;
  LastWritten: { low: number; high: number }; CredentialBlobSize: number; CredentialBlob: unknown;
  Persist: number; AttributeCount: number; Attributes: unknown; TargetAlias: string | null; UserName: string;
}
function bind() {
  if (process.platform !== "win32" || !["x64", "arm64"].includes(process.arch)) throw Error("personal_key_platform_unavailable");
  const koffi = require("koffi") as typeof Koffi;
  const advapi = koffi.load("advapi32.dll"), kernel = koffi.load("kernel32.dll");
  const time = koffi.struct({ low: "uint32", high: "uint32" });
  const credential = koffi.struct({ Flags: "uint32", Type: "uint32", TargetName: "str16", Comment: "str16", LastWritten: time,
    CredentialBlobSize: "uint32", CredentialBlob: "void *", Persist: "uint32", AttributeCount: "uint32", Attributes: "void *", TargetAlias: "str16", UserName: "str16" });
  return { koffi, credential,
    read: advapi.func("int __stdcall CredReadW(str16, uint32, uint32, _Out_ void **)"),
    write: advapi.func("CredWriteW", "int", [koffi.pointer(credential), "uint32"]),
    remove: advapi.func("int __stdcall CredDeleteW(str16, uint32, uint32)"),
    free: advapi.func("void __stdcall CredFree(void *)"),
    lastError: kernel.func("uint32 __stdcall GetLastError()"),
  };
}
let binding: ReturnType<typeof bind> | undefined;
function api() { return binding ??= bind(); }
function assertReference(reference: string): void { if (!referencePattern.test(reference)) throw Error("personal_key_reference_rejected"); }

export interface Win32PersonalSigningKeyReference {
  reference: string;
  publicKey: string;
  publicKeyDigest: string;
  // 对随机私钥及固定元信息的摘要用于精确清理，不是授权，也不含可还原私钥。
  credentialDigest: string;
}
export class Win32PersonalKeyCreationError extends Error {
  constructor(readonly reference: string, readonly credentialMayExist: boolean) {
    super("personal_key_creation_failed_reference_retained");
    this.name = "Win32PersonalKeyCreationError";
  }
}
interface ReadCredential { key: KeyObject; publicKey: string; publicKeyDigest: string; credentialDigest: string }
function read(reference: string): ReadCredential | null {
  assertReference(reference); const n = api(), output: unknown[] = [null];
  if (!n.read(reference, 1, 0, output)) {
    if (n.lastError() === 1168) return null;
    throw Error("personal_key_read_failed");
  }
  if (!output[0]) throw Error("personal_key_read_pointer");
  let nativeBlob: Buffer | undefined, copy: Buffer | undefined;
  try {
    const value = n.koffi.decode(output[0], n.credential) as Credential;
    // 先限界，再创建外部内存视图；所有可证明有界的原生正文均在 finally 清零。
    if (!Number.isInteger(value.CredentialBlobSize) || value.CredentialBlobSize < 1 || value.CredentialBlobSize > 2560 || !value.CredentialBlob) throw Error("personal_key_blob_bound");
    nativeBlob = Buffer.from(n.koffi.view(value.CredentialBlob, value.CredentialBlobSize));
    if (value.Flags !== 0 || value.Type !== 1 || value.TargetName !== reference || value.Comment !== comment || value.Persist !== 2 ||
        value.AttributeCount !== 0 || value.Attributes || value.TargetAlias !== null || value.UserName !== userName || value.CredentialBlobSize !== 48) throw Error("personal_key_metadata_rejected");
    copy = Buffer.from(nativeBlob);
    const key = createPrivateKey({ key: copy, format: "der", type: "pkcs8" });
    const canonical = key.export({ format: "der", type: "pkcs8" });
    try { if (key.asymmetricKeyType !== "ed25519" || !canonical.equals(copy)) throw Error("personal_key_algorithm_rejected"); }
    finally { canonical.fill(0); }
    const publicKeyObject = createPublicKey(key);
    const publicKey = publicKeyObject.export({ format: "pem", type: "spki" }).toString();
    const publicKeyDigest = digest(publicKeyObject.export({ format: "der", type: "spki" }));
    const credentialDigest = digest(JSON.stringify({ reference, comment, userName, persist: 2, type: 1, written: value.LastWritten, blobDigest: digest(copy) }));
    return { key, publicKey, publicKeyDigest, credentialDigest };
  } finally { copy?.fill(0); nativeBlob?.fill(0); n.free(output[0]); }
}

/** 只生成新 UUID，不接受用户指定的目标覆盖。创建不使任何登记活跃。 */
export function createWin32PersonalSigningKey(namespace: "production" | "test", beforeWrite?: (facts: Readonly<{ reference: string; publicKey: string; publicKeyDigest: string }>) => void): Win32PersonalSigningKeyReference {
  if (namespace !== "production" && namespace !== "test") throw Error("personal_key_namespace_rejected");
  const reference = `${namespace === "test" ? "saydo-personal-context-test" : "saydo-personal-context"}/1/${randomUUID()}`;
  if (read(reference) !== null) throw Error("personal_key_target_exists");
  const n = api(), pair = generateKeyPairSync("ed25519"), blob = pair.privateKey.export({ format: "der", type: "pkcs8" });
  let writeAttempted = false;
  try {
    const publicKey = pair.publicKey.export({ format: "pem", type: "spki" }).toString();
    const publicKeyDigest = digest(pair.publicKey.export({ format: "der", type: "spki" }));
    // 生产登记先耐久保存精确非秘密 intent，之后才调用 OS；这不是跨存储原子事务。
    const prepared: unknown = beforeWrite?.(Object.freeze({ reference, publicKey, publicKeyDigest }));
    if (prepared !== undefined) {
      // void 回调在 TS 中也能接受 async 函数。只观察拒绝，绝不等待后继续写入。
      void Promise.resolve(prepared).catch(() => undefined);
      throw Error("personal_key_async_preparation_rejected");
    }
    const value = { Flags: 0, Type: 1, TargetName: reference, Comment: comment, LastWritten: { low: 0, high: 0 }, CredentialBlobSize: blob.length,
      CredentialBlob: blob, Persist: 2, AttributeCount: 0, Attributes: null, TargetAlias: null, UserName: userName };
    writeAttempted = true;
    if (!n.write(value, 0)) throw Error("personal_key_write_failed");
    const stored = read(reference);
    if (!stored) throw Error("personal_key_readback_missing_retained");
    const raw = stored.key.export({ format: "der", type: "pkcs8" });
    try { if (!raw.equals(blob)) throw Error("personal_key_readback_mismatch_retained"); }
    finally { raw.fill(0); }
    return { reference, publicKey: stored.publicKey, publicKeyDigest: stored.publicKeyDigest, credentialDigest: stored.credentialDigest };
  } catch { throw new Win32PersonalKeyCreationError(reference, writeAttempted); }
  finally { blob.fill(0); }
}

export function loadWin32PersonalSigningKey(input: Win32PersonalSigningKeyReference): KeyObject {
  if (!digestPattern.test(input.publicKeyDigest) || !digestPattern.test(input.credentialDigest)) throw Error("personal_key_digest_rejected");
  const stored = read(input.reference);
  if (!stored || stored.publicKey !== input.publicKey || stored.publicKeyDigest !== input.publicKeyDigest || stored.credentialDigest !== input.credentialDigest) throw Error("personal_key_reference_stale");
  return stored.key;
}

/** 调用方先撤销逻辑权威。本方法不能原子 compare-delete，不回滚任何撤销事实。 */
export function removeWin32PersonalSigningKey(input: Win32PersonalSigningKeyReference): "removed" | "absent" {
  if (!digestPattern.test(input.publicKeyDigest) || !digestPattern.test(input.credentialDigest)) throw Error("personal_key_digest_rejected");
  const stored = read(input.reference);
  if (!stored) return "absent";
  if (stored.publicKey !== input.publicKey || stored.publicKeyDigest !== input.publicKeyDigest || stored.credentialDigest !== input.credentialDigest) throw Error("personal_key_cleanup_mismatch_retained");
  const n = api(); if (!n.remove(input.reference, 1, 0)) throw Error("personal_key_delete_failed_retained");
  if (read(input.reference) !== null) throw Error("personal_key_delete_unconfirmed_retained");
  return "removed";
}
