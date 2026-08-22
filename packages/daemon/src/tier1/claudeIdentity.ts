// W5.4-b C1:claude 身份登记承载(方案 D12;09 §11 claude_code 承载段)。
// 登记文件 = $SAYDO_HOME/tier1/claude-identity.json({binaryPath, binaryDigest, version, testedAt, receipt}),
// 由 setup 自检(scope=tier1)写入;启动与每次 spawn 前核验(核验只认 binaryPath/digest,receipt 不参与判定)。
// 用于版本 pin,不用于 observedModel 豁免(Tier1 claude_code 恒 observedModelExempted=false)。

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { checkBinaryIdentity, type BinaryIdentityCheckOptions } from "../providers/binaryIdentity.js";

export const claudeIdentityRecordSchema = z.object({
  /** 配置 [tier1].claude_bin 的绝对路径(symlink 已解析到实体)。 */
  binaryPath: z.string().min(1),
  /** 二进制内容 SHA-256(hex)。 */
  binaryDigest: z.string().regex(/^[a-f0-9]{64}$/),
  /** 自检实测版本(claude --version 首 token)。 */
  version: z.string().min(1),
  /** 自检时间(ISO)。 */
  testedAt: z.string().min(1),
  /** 自检回执(各检查项结论;核验不消费,仅存证)。 */
  receipt: z.unknown()
});
export type ClaudeIdentityRecord = z.infer<typeof claudeIdentityRecordSchema>;

export function claudeIdentityPath(saydoHome: string): string {
  return join(saydoHome, "tier1", "claude-identity.json");
}

/** 缺失/不可读/形状不符 ⇒ null(消费方按"登记缺失"处方化提示,不抛)。 */
export function readClaudeIdentity(saydoHome: string): ClaudeIdentityRecord | null {
  let text: string;
  try {
    text = readFileSync(claudeIdentityPath(saydoHome), "utf8");
  } catch {
    return null;
  }
  try {
    return claudeIdentityRecordSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

/** 原子写(tmp + rename;0o600——登记非密但同 gate 资产纪律)。 */
export function writeClaudeIdentity(saydoHome: string, record: ClaudeIdentityRecord): void {
  const target = claudeIdentityPath(saydoHome);
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, target);
}

export type ClaudeIdentityVerdict =
  | { ok: true; record: ClaudeIdentityRecord }
  | {
      ok: false;
      code: "identity_missing" | "binary_path_mismatch" | "digest_mismatch" | "binary_unreadable";
      detail: string;
    };

/**
 * 登记核验:登记存在 + binaryPath 与配置一致 + digest 与实际文件一致
 * (digest 重算经共享 checkBinaryIdentity 的 mtime/size 缓存,变化才重哈希)。
 */
export function verifyClaudeIdentity(
  saydoHome: string,
  claudeBin: string,
  opts?: BinaryIdentityCheckOptions
): ClaudeIdentityVerdict {
  const record = readClaudeIdentity(saydoHome);
  if (!record) {
    return {
      ok: false,
      code: "identity_missing",
      detail: `登记文件缺失或不可读:${claudeIdentityPath(saydoHome)};先跑 POST /api/setup/test {"scope":"tier1"} 写入登记`
    };
  }
  if (record.binaryPath !== claudeBin) {
    return {
      ok: false,
      code: "binary_path_mismatch",
      detail: `登记 binaryPath(${record.binaryPath})与配置 claude_bin(${claudeBin})不一致;重跑 scope=tier1 自检重新登记`
    };
  }
  const check = checkBinaryIdentity(
    claudeBin,
    { path: record.binaryPath, digest: record.binaryDigest },
    () => null,
    "claude",
    opts
  );
  if (!check.ok) {
    if (check.code === "digest_mismatch") {
      return {
        ok: false,
        code: "digest_mismatch",
        detail: "claude 二进制 digest 与登记不符(身份漂移;可能被更新)——升级须重跑门禁仪式并重新自检登记"
      };
    }
    return {
      ok: false,
      code: "binary_unreadable",
      detail: `claude_bin 不可读或不是常规文件:${claudeBin}`
    };
  }
  return { ok: true, record };
}
