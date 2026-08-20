// docs/09 §4.1 源快照与引证验证(Phase 3 前置定稿,Codex 12 回修终稿;3.2 消费)。
// daemon 侧快照器捕获,evaluator 零工具只收摘录;原始维度独立持久化,critical-support 资格纯函数派生。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";
import { sourceRefSchema } from "./memory.js";

export const sourceSnapshotSchema = z.strictObject({
  id: idSchema,
  source: sourceRefSchema,
  /** 不可变定位(捕获那一刻):git:<commit>:<path> / realpath@捕获 / URL@捕获 / transcript:<ses>#<turn> / artifact:<id>@<v> */
  snapshotLocator: z.string().min(1),
  /** 现读定位(freshness 用),与 snapshotLocator 分离 */
  liveLocator: z.string().min(1),
  contentDigest: digestSchema,
  encoding: z.literal("utf-8"),
  bodyPath: z.string().min(1),
  capturedAt: tsSchema,
  resolver: z.strictObject({ name: z.literal("daemon-snapshotter"), version: z.string().min(1) })
});
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;

export const verifiedExcerptSchema = z.strictObject({
  snapshotId: idSchema,
  range: z.strictObject({ startByte: z.number().int().nonnegative(), endByte: z.number().int().nonnegative() }),
  /** 摘录正文——不可信数据:只进转义后的结构化 untrusted-data 字段,不得拼入 system instruction */
  text: z.string(),
  excerptDigest: digestSchema
});
export type VerifiedExcerpt = z.infer<typeof verifiedExcerptSchema>;

/** claim 的证据绑定(多源);snapshotId 与 noSnapshotReason 互斥、必居其一 */
export const evidenceBindingSchema = z
  .strictObject({
    snapshotId: idSchema.optional(),
    excerpt: verifiedExcerptSchema.optional(),
    noSnapshotReason: z.enum(["agent_output", "import"]).optional()
  })
  .refine((b) => (b.snapshotId !== undefined) !== (b.noSnapshotReason !== undefined), {
    message: "evidence binding requires exactly one of snapshotId | noSnapshotReason"
  });
export type EvidenceBinding = z.infer<typeof evidenceBindingSchema>;

export const claimSourceVerificationSchema = z.strictObject({
  claimDigest: digestSchema,
  snapshotId: idSchema,
  excerpt: verifiedExcerptSchema.optional(),
  integrity: z.enum(["intact", "digest_mismatch", "snapshot_missing"]),
  freshness: z.enum(["fresh", "stale"]),
  quoteMatch: z.enum(["match", "mismatch", "evidence_missing"]),
  /** 深评层语义判断;critical claim 必填,unclear/缺失一律阻塞(fail-closed) */
  semanticSupport: z.enum(["supported", "unsupported", "unclear"]).optional(),
  reason: z.string().optional()
});
export type ClaimSourceVerification = z.infer<typeof claimSourceVerificationSchema>;

/** 单条 binding 通过谓词(白名单式 fail-closed;09 §4.1) */
export function bindingPasses(v: ClaimSourceVerification): boolean {
  return (
    v.integrity === "intact" && v.freshness === "fresh" && v.quoteMatch === "match" && v.semanticSupport === "supported"
  );
}

/**
 * critical claim 支持成立(critical-support 资格,纯函数派生不持久化):
 * 至少一条 binding 通过,且通过集中至少一条来自非 {agent_output, import} 源。
 */
export function criticalSupportHolds(
  verifications: { verification: ClaimSourceVerification; sourceKind: string }[]
): boolean {
  const passed = verifications.filter((x) => bindingPasses(x.verification));
  if (passed.length === 0) return false;
  return passed.some((x) => x.sourceKind !== "agent_output" && x.sourceKind !== "import");
}
