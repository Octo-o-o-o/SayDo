// W5.4-b C1:claude 身份登记承载(方案 D12;09 §11 claude_code 承载段)。
// 登记文件 = $SAYDO_HOME/tier1/claude-identity.json({binaryPath, binaryDigest, version, testedAt, receipt}),
// 由 setup 自检(scope=tier1)写入;启动与每次 spawn 前核验(核验只认 binaryPath/digest,receipt 不参与判定)。
// 用于版本 pin,不用于 observedModel 豁免(Tier1 claude_code 恒 observedModelExempted=false)。

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { checkBinaryIdentity, type BinaryIdentityCheckOptions } from "../providers/binaryIdentity.js";
import { runtimeInvocationIdentityTarget } from "../runtimeChildRegistry.js";

export const claudeIdentityRecordSchema = z.object({
  /** 配置 [tier1].claude_bin 的绝对路径(symlink 已解析到实体)。 */
  binaryPath: z.string().min(1),
  /** 二进制内容 SHA-256(hex)。 */
  binaryDigest: z.string().regex(/^[a-f0-9]{64}$/),
  /** 自检实测版本(claude --version 首 token)。 */
  version: z.string().min(1),
  /** 自检时间(ISO)。 */
  testedAt: z.string().min(1),
  /** Windows npm .cmd shim 最终执行的 JS 实体；与 digest 必须成对出现。 */
  runtimeTargetPath: z.string().min(1).optional(),
  runtimeTargetDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /** 自检回执(各检查项结论;核验不消费,仅存证)。 */
  receipt: z.unknown()
}).superRefine((record, ctx) => {
  if ((record.runtimeTargetPath === undefined) !== (record.runtimeTargetDigest === undefined)) {
    ctx.addIssue({ code: "custom", message: "runtimeTargetPath/runtimeTargetDigest 必须成对出现" });
  }
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
  const tmp = `${target}.tmp-${process.pid}-${randomUUID()}`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, target);
}

export type ClaudeIdentityVerdict =
  | { ok: true; record: ClaudeIdentityRecord }
  | {
      ok: false;
      code:
        | "identity_missing"
        | "binary_path_mismatch"
        | "digest_mismatch"
        | "binary_unreadable"
        | "runtime_target_missing"
        | "runtime_target_path_mismatch"
        | "runtime_target_digest_mismatch"
        | "runtime_target_unreadable";
      detail: string;
    };

/**
 * 登记核验:登记存在 + binaryPath 与配置一致 + digest 与实际文件一致
 * Tier1 每次调用都对 wrapper 与 runtime target 重哈希；BYOA 的 mtime/size 缓存不参与此安全门。
 */
export function verifyClaudeIdentity(
  saydoHome: string,
  claudeBin: string,
  opts?: BinaryIdentityCheckOptions & { platform?: NodeJS.Platform }
): ClaudeIdentityVerdict {
  const record = readClaudeIdentity(saydoHome);
  if (!record) {
    return {
      ok: false,
      code: "identity_missing",
      detail: `登记文件缺失或不可读:${claudeIdentityPath(saydoHome)};先跑 POST /api/setup/test {"scope":"tier1"} 写入登记`
    };
  }
  let resolvedBin: string;
  try {
    resolvedBin = realpathSync(claudeBin);
  } catch {
    return {
      ok: false,
      code: "binary_unreadable",
      detail: `claude_bin 不可解析到实体文件:${claudeBin}`
    };
  }
  if (record.binaryPath !== resolvedBin) {
    return {
      ok: false,
      code: "binary_path_mismatch",
      detail: `登记 binaryPath(${record.binaryPath})与配置 claude_bin 实体(${resolvedBin})不一致;重跑 scope=tier1 自检重新登记`
    };
  }
  const check = checkBinaryIdentity(
    resolvedBin,
    { path: record.binaryPath, digest: record.binaryDigest },
    () => null,
    "claude",
    { ...opts, forceRehash: true }
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
      detail: `claude_bin 不可读或不是常规文件:${resolvedBin}`
    };
  }
  let runtimeTarget: string | null;
  try {
    runtimeTarget = runtimeInvocationIdentityTarget(resolvedBin, opts?.platform);
  } catch {
    return {
      ok: false,
      code: "runtime_target_unreadable",
      detail: "claude npm shim 形状或 JS 入口不可验证;重跑 scope=tier1 自检前不要启动执行器"
    };
  }
  if (runtimeTarget === null) {
    if (record.runtimeTargetPath !== undefined || record.runtimeTargetDigest !== undefined) {
      return {
        ok: false,
        code: "runtime_target_path_mismatch",
        detail: "claude 登记含 runtime target，但当前二进制不再解析为同一 npm shim;身份已漂移"
      };
    }
    return { ok: true, record };
  }
  if (record.runtimeTargetPath === undefined || record.runtimeTargetDigest === undefined) {
    return {
      ok: false,
      code: "runtime_target_missing",
      detail: "claude npm shim 的 JS 入口尚未登记;重跑 POST /api/setup/test {\"scope\":\"tier1\"}"
    };
  }
  if (record.runtimeTargetPath !== runtimeTarget) {
    return {
      ok: false,
      code: "runtime_target_path_mismatch",
      detail: "claude npm shim 的 JS 入口路径与登记不一致;包链接或安装目标已漂移"
    };
  }
  const targetCheck = checkBinaryIdentity(
    runtimeTarget,
    { path: record.runtimeTargetPath, digest: record.runtimeTargetDigest },
    () => null,
    "claude-runtime-target",
    { ...opts, forceRehash: true }
  );
  if (!targetCheck.ok) {
    return {
      ok: false,
      code: targetCheck.code === "digest_mismatch" ? "runtime_target_digest_mismatch" : "runtime_target_unreadable",
      detail:
        targetCheck.code === "digest_mismatch"
          ? "claude npm shim 的 JS 入口 digest 与登记不符;包内容已漂移"
          : "claude npm shim 的 JS 入口不可读或不是常规文件"
    };
  }
  return { ok: true, record };
}
