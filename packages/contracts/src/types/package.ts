// docs/09 §2 决策包与预授权(DecisionPackage / EffectGrant)。
// 签名域与 fail-closed 规则见 digests.ts / effects.ts;本文件只承载形状。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, moneySchema, tsSchema } from "./common.js";
import { claimSchema } from "./contextpack.js";
import { executionModeSchema } from "./project.js";

/** P0 效果白名单(09 §2):create_remote_branch 并入 push;network_fetch=P1 */
export const effectKindSchema = z.enum(["install_dependency", "push_branch"]);
export type EffectKind = z.infer<typeof effectKindSchema>;

export const downstreamTriggersSchema = z.enum(["none", "ci_preview"]);
export type DownstreamTriggers = z.infer<typeof downstreamTriggersSchema>;

export const effectGrantSchema = z.strictObject({
  effect: effectKindSchema,
  target: z.string(),
  constraints: z.strictObject({
    packages: z.array(z.string().min(1)).min(1).optional(),
    branchPattern: z.string().min(1).optional(),
    maxCost: z.number().nonnegative().optional(),
    environment: z.enum(["worktree", "local"])
  }),
  downstreamTriggers: downstreamTriggersSchema,
  spokenForm: z.string().min(1),
  ttlHours: z.number().positive(),
  grantDigest: digestSchema
});
export type EffectGrant = z.infer<typeof effectGrantSchema>;

export const packageStatusSchema = z.enum(["draft", "proposed", "approved", "superseded", "expired"]);
export type PackageStatus = z.infer<typeof packageStatusSchema>;

export const decisionPackageSchema = z.strictObject({
  id: idSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  supersedes: z.strictObject({ packageId: idSchema, revision: z.number().int().positive() }).optional(),
  projectId: idSchema,
  outcomePreview: z.string().min(1),
  inScope: z.array(z.string()),
  outOfScope: z.array(z.string()),
  assumptions: z.array(claimSchema),
  acceptance: z.array(z.string().min(1)),
  plan: z.array(z.strictObject({ seq: z.number().int().positive(), step: z.string().min(1), owner: z.enum(["ai", "human"]) })),
  demoRef: z.strictObject({ artifactId: idSchema, version: z.number().int().positive() }).optional(),
  cost: z.strictObject({
    expected: moneySchema,
    p95: moneySchema,
    max: z.number().positive(),
    currency: z.literal("CNY")
  }),
  risks: z.array(z.string()),
  mode: executionModeSchema,
  preauthorizedEffects: z.array(effectGrantSchema),
  effectPolicyVersion: z.string().min(1),
  status: packageStatusSchema,
  approvedVia: z.strictObject({ receiptId: idSchema }).optional(),
  // readinessRef(09 §0.1 签名域已含;R-A 补完 2026-07-27,Codex 21 A3;A3-armed 2026-07-28 扩双 digest,
  // Codex 23 A-2):组包时绑定就绪评估——拍板/派发时对评估行 + 现势(checklist/evidence 版本)双检,
  // 缺失/不符拒拍板(readiness_stale)。armed 后 proposeStart 必写(pending 绑 pending 清单)。
  readinessRef: z
    .strictObject({
      dimsDigest: z.string().min(1),
      assessmentId: z.string().min(1),
      verdict: z.enum(["ready", "gap_knowledge", "gap_requirement", "gap_critical"]),
      checklistDigest: z.string().min(1),
      evidenceDigest: z.string().min(1)
    })
    .optional(),
  // expiresAt 可选(Codex 21 A6):draft 无 expiry;proposed 转移事务写 proposed_at + expires_at(=proposed_at+TTL);
  // 唯一写点 = 状态转移事务(§2 注 ④,禁裸改;updatePackageExpiry 已删)
  expiresAt: tsSchema.optional(),
  createdAt: tsSchema
});
export type DecisionPackage = z.infer<typeof decisionPackageSchema>;

/**
 * 包状态转换(09 §2 注 ④,Codex 21 A6):draft->proposed;proposed->approved|draft|expired|superseded;
 * approved->superseded|expired。proposed TTL 到期 ⇒ expired(调度器扫);同项目新提议 ⇒ 旧 proposed superseded。
 */
export const PACKAGE_TRANSITIONS: Record<PackageStatus, PackageStatus[]> = {
  draft: ["proposed"],
  proposed: ["approved", "draft", "expired", "superseded"],
  approved: ["superseded", "expired"],
  superseded: [],
  expired: []
};

export function canTransitionPackage(from: PackageStatus, to: PackageStatus): boolean {
  return PACKAGE_TRANSITIONS[from].includes(to);
}
