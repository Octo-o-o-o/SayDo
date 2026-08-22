// 二进制身份核验共享模块(W5.4-b C1;方案 D12/§3.7)。
// 从 providers/byoa/provider.ts 提升:BYOA 四槽与 Tier1 claude 登记共用同一核验语义,
// 行为对 byoa 原调用点不变(verifyBinaryIdentity 签名与判定结论保持)。
// digest 重算仅在 mtime/size 变化时(D12:claude 单文件 256MB 级,每次 spawn 前全量重哈希不可接受;
// "内容变但 mtime+size 均不变"的病理场景是方案明确接受的取舍)。

import { createHash } from "node:crypto";
import { readFileSync, statSync, type Stats } from "node:fs";
import { isAbsolute } from "node:path";

export interface VerifiedBinaryIdentity {
  /** cliCapability 探测后固化的绝对路径。 */
  path: string;
  /** 文件内容 SHA-256(hex)。 */
  digest: string;
  /** 流内无 model 时使用的已登记默认模型。 */
  defaultModel?: string;
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** 测试注入位:替换实际哈希实现以断言"mtime/size 未变不重算"。 */
export interface BinaryIdentityCheckOptions {
  hashFile?: (path: string) => string;
}

const digestCache = new Map<string, { mtimeMs: number; size: number; digest: string }>();

/** mtime/size 未变时命中缓存,变化才重哈希(缓存 key = 路径)。 */
export function sha256FileCached(path: string, st: Stats, opts?: BinaryIdentityCheckOptions): string {
  const hit = digestCache.get(path);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.digest;
  const digest = (opts?.hashFile ?? sha256File)(path);
  digestCache.set(path, { mtimeMs: st.mtimeMs, size: st.size, digest });
  return digest;
}

export type BinaryIdentityCheck =
  | { ok: true; identity: VerifiedBinaryIdentity }
  | {
      ok: false;
      code:
        | "identity_or_path_missing"
        | "path_mismatch"
        | "not_a_file"
        | "digest_format"
        | "digest_mismatch"
        | "family_mismatch"
        | "unreadable";
    };

/** 带原因码的核验内核(Tier1 claude 登记核验消费原因码做处方化提示)。 */
export function checkBinaryIdentity(
  binaryPath: string | undefined,
  identity: VerifiedBinaryIdentity | undefined,
  familyOf: (model: string) => string | null,
  expectedFamily: string,
  opts?: BinaryIdentityCheckOptions
): BinaryIdentityCheck {
  if (!identity || !binaryPath || !isAbsolute(binaryPath) || !isAbsolute(identity.path)) {
    return { ok: false, code: "identity_or_path_missing" };
  }
  if (identity.path !== binaryPath) return { ok: false, code: "path_mismatch" };
  let st: Stats;
  try {
    st = statSync(identity.path);
  } catch {
    return { ok: false, code: "unreadable" };
  }
  if (!st.isFile()) return { ok: false, code: "not_a_file" };
  if (!/^[a-f0-9]{64}$/.test(identity.digest)) return { ok: false, code: "digest_format" };
  let actual: string;
  try {
    actual = sha256FileCached(identity.path, st, opts);
  } catch {
    return { ok: false, code: "unreadable" };
  }
  if (actual !== identity.digest) return { ok: false, code: "digest_mismatch" };
  try {
    const defaultFamily = identity.defaultModel ? familyOf(identity.defaultModel) : null;
    if (defaultFamily && defaultFamily !== expectedFamily) return { ok: false, code: "family_mismatch" };
  } catch {
    // 原 byoa 实现把 familyOf 异常吞为不通过(catch → undefined);保持等价
    return { ok: false, code: "family_mismatch" };
  }
  return { ok: true, identity };
}

/**
 * 原 byoa 私有函数的共享导出(签名与判定结论不变:通过回 identity,不通过回 undefined)。
 * spawn 前核验走这里即天然带 mtime/size 缓存。
 */
export function verifyBinaryIdentity(
  binaryPath: string | undefined,
  identity: VerifiedBinaryIdentity | undefined,
  familyOf: (model: string) => string | null,
  expectedFamily: string,
  opts?: BinaryIdentityCheckOptions
): VerifiedBinaryIdentity | undefined {
  const r = checkBinaryIdentity(binaryPath, identity, familyOf, expectedFamily, opts);
  return r.ok ? r.identity : undefined;
}
