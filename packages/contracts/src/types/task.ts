// docs/09 §6.1 TaskCard 与状态机 + §9 tier1_runs / Tier1SettleProof / Tier1CancelProof。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";
import { acceptanceCheckSchema, type AcceptanceCheck } from "./tools.js";

export const taskRouteSchema = z.enum(["tier1", "hopper"]);
export type TaskRoute = z.infer<typeof taskRouteSchema>;

/** tier1 后端词表(09 §6.1 adapter;与 DevAgentBinding.agent 同词表) */
export const adapterSchema = z.enum(["claude_code", "cursor", "codex"]);
export type Adapter = z.infer<typeof adapterSchema>;

export const taskStatusSchema = z.enum([
  "confirmed",
  "queued",
  "running",
  "paused_step_boundary",
  "blocked",
  "ready_for_review",
  "review_approved_waiting_merge",
  "merging",
  "task_done",
  "failed",
  "merge_failed",
  "cancel_requested",
  "cancel_settled",
  "superseded"
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskCardSchema = z
  .strictObject({
    id: idSchema,
    projectId: idSchema,
    packageRef: z.strictObject({ packageId: idSchema, revision: z.number().int().positive(), digest: digestSchema }),
    title: z.string().min(1),
    specMarkdown: z.string(),
    route: taskRouteSchema,
    status: taskStatusSchema,
    cancelReason: z.enum(["user_cancel", "supersede", "park_expired"]).optional(),
    supersedes: idSchema.optional(),
    adapter: adapterSchema.optional(),
    nativeSessionId: z.string().optional(),
    cwd: z.string().optional(),
    budget: z.strictObject({
      walltimeActiveMin: z.number().positive(),
      maxTurns: z.number().int().positive(),
      maxCost: z.number().positive()
    }),
    actualCostRef: idSchema.optional(),
    parkedAt: tsSchema.optional(),
    parkedDeadline: tsSchema.optional(),
    updatedAt: tsSchema
  })
  .superRefine((t, ctx) => {
    // route×adapter 判别(09 §6.1/§12-10):route=tier1 必带 adapter;route=hopper 恒空
    if (t.route === "tier1" && !t.adapter) ctx.addIssue({ code: "custom", message: "route=tier1 requires adapter" });
    if (t.route === "hopper" && t.adapter) ctx.addIssue({ code: "custom", message: "route=hopper must not carry adapter" });
  });
export type TaskCard = z.infer<typeof taskCardSchema>;

/** tier1_runs(09 §9;C2 执行客户端承载) */
export const tier1RunStateSchema = z.enum([
  "reserved",
  "running",
  "step_paused",
  "settled_review",
  "settled_failed",
  "cancel_requested",
  "cancel_settled"
]);
export type Tier1RunState = z.infer<typeof tier1RunStateSchema>;

export const tier1SettleProofSchema = z.strictObject({
  kind: z.literal("tier1").default("tier1"),
  taskId: idSchema,
  runId: z.string().min(1),
  attempt: z.number().int().positive(),
  packageRevision: z.number().int().positive(),
  treeSha: z.string().min(1),
  tier1VerifyDigest: digestSchema,
  /**
   * coding 验收逐条证据。旧版落库 proof 没有本字段，解析时回落为空数组；
   * 消费方必须据 DecisionPackage.acceptance 补成 unknown，不能据 task 终态推成 pass。
   */
  acceptanceChecks: z.array(acceptanceCheckSchema).default([]),
  transcriptCursor: z.string().min(1),
  settledAt: tsSchema
});
export type Tier1SettleProof = z.infer<typeof tier1SettleProofSchema>;

/**
 * WritingSettleProof(09 §6.1a;W4;与 Tier1SettleProof 并列,route=tier1 按 project.type 二选一)。
 * kind 判别键;sectionCoverage 大纲逐节覆盖("empty" 仅活在步界进度载荷,settle 时须全 "drafted");
 * acceptanceChecks 就绪清单逐条(settle 时 manual 项恒 unknown,人评终局在 reviewTask approve)。
 */
export const writingSettleProofSchema = z.strictObject({
  kind: z.literal("writing"),
  taskId: idSchema,
  runId: z.string().min(1),
  attempt: z.number().int().positive(),
  packageRevision: z.number().int().positive(),
  treeSha: z.string().min(1), // worktree 树对象(合并链复用)
  articleArtifactId: idSchema, // 成稿产物(§8 Artifact type="article")
  articleVersion: z.number().int().positive(),
  articlePath: z.string().min(1).optional(), // 新写必带；旧 proof 缺失时消费者仅兼容为 article.md，不能改写旧 digest
  articleDigest: digestSchema, // 文章正文 sha256
  sectionCoverage: z.array(z.strictObject({ outlineSectionId: z.string().min(1), status: z.enum(["drafted", "empty"]) })),
  acceptanceChecks: z.array(acceptanceCheckSchema),
  transcriptCursor: z.string().min(1),
  settledAt: tsSchema
});
export type WritingSettleProof = z.infer<typeof writingSettleProofSchema>;

/** writing settle proof 判别(settle_proof_json 落同列;reviewTask/merge 按 kind 分叉) */
export function isWritingSettleProof(p: unknown): p is WritingSettleProof {
  return typeof p === "object" && p !== null && (p as { kind?: unknown }).kind === "writing";
}

/** AcceptanceCheck 与 DecisionPackage.acceptance 的双向 exact-set 对账(两侧都禁重复)。 */
export function acceptanceExactSetViolations(
  checks: readonly Pick<AcceptanceCheck, "criterion">[],
  acceptance: readonly string[]
): string[] {
  const violations: string[] = [];
  const expected = new Set(acceptance);
  const got = checks.map((check) => check.criterion);
  const actual = new Set(got);
  if (acceptance.length !== expected.size) violations.push("DecisionPackage.acceptance 有重复项");
  if (got.length !== actual.size) violations.push("acceptanceChecks 有重复项");
  for (const criterion of actual) if (!expected.has(criterion)) violations.push(`幽灵验收项:${criterion}`);
  for (const criterion of expected) if (!actual.has(criterion)) violations.push(`漏验收项:${criterion}`);
  return violations;
}

/**
 * writingSettleBarrier 结构断言(09 §6.1a ②③;单源纯函数——IO 面 ①(digest/ls-tree)在 daemon 执行段)。
 * plan/acceptance 来自 DecisionPackage;返回 violation 列表(空 = 结构过)。
 *   ② 节 exact-set:outlineSectionId 词表 = plan 中 owner="ai" 步的 String(seq),双向相等无重复;
 *      settle 门(requireAllDrafted=true)下全部 status="drafted"("empty" 只活在步界进度载荷);
 *   ③ 验收对账:acceptanceChecks.criterion 与 acceptance[] exact-set;source="verify" 须绑 evidenceRef;
 *      settle 时 source="manual" 恒 unknown;critical 验收项禁 source="agent_claim" 作终局。
 */
export function writingSettleStructuralViolations(
  proof: { sectionCoverage: { outlineSectionId: string; status: "drafted" | "empty" }[]; acceptanceChecks: AcceptanceCheck[] },
  ctx: { plan: { seq: number; owner: "ai" | "human" }[]; acceptance: string[] },
  opts: { requireAllDrafted?: boolean; manualMustBeUnknown?: boolean } = {}
): string[] {
  const violations: string[] = [];
  // ② 节 exact-set
  const expectedSections = new Set(ctx.plan.filter((s) => s.owner === "ai").map((s) => String(s.seq)));
  const gotSections = proof.sectionCoverage.map((s) => s.outlineSectionId);
  const gotSet = new Set(gotSections);
  if (gotSections.length !== gotSet.size) violations.push("sectionCoverage 有重复节");
  for (const id of gotSet) if (!expectedSections.has(id)) violations.push(`幽灵节 outlineSectionId=${id}(不在 ai 步 seq 集)`);
  for (const id of expectedSections) if (!gotSet.has(id)) violations.push(`漏节 outlineSectionId=${id}`);
  if (opts.requireAllDrafted) {
    for (const s of proof.sectionCoverage) {
      if (s.status !== "drafted") violations.push(`节 ${s.outlineSectionId} 未成稿(status=${s.status});进 ready_for_review 须全 drafted`);
    }
  }
  // ③ 验收对账
  violations.push(...acceptanceExactSetViolations(proof.acceptanceChecks, ctx.acceptance));
  for (const c of proof.acceptanceChecks) {
    if (c.status !== "unknown" && !c.evidenceRef?.trim()) {
      violations.push(`pass/fail 验收项须绑非空 evidenceRef:${c.criterion}`);
    }
    if (c.source === "verify" && (!c.evidenceRef || c.status !== "pass")) {
      violations.push(`verify 验收项须绑 evidenceRef 且 pass:${c.criterion}`);
    }
    if (opts.manualMustBeUnknown && c.source === "manual" && c.status !== "unknown") {
      violations.push(`settle 时 manual 验收项恒 unknown(agent 不得自填):${c.criterion}`);
    }
    if (c.source === "agent_claim") violations.push(`writing 验收项禁 agent_claim 作终局:${c.criterion}`);
  }
  return violations;
}

export const tier1CancelProofSchema = z.strictObject({
  taskId: idSchema,
  runId: z.string().min(1),
  processExited: z.literal(true),
  worktreeLockReleased: z.literal(true),
  lastEventId: z.string().min(1),
  settledAt: tsSchema
});
export type Tier1CancelProof = z.infer<typeof tier1CancelProofSchema>;

/** blocked/failed 回叫的最小 settle proof(09 §9:不需 tree/verify digest) */
export const tier1MinimalProofSchema = z
  .strictObject({
    questionId: z.string().min(1).optional(),
    exitEvidence: z.string().min(1).optional(),
    transcriptCursor: z.string().min(1)
  })
  .refine((p) => p.questionId !== undefined || p.exitEvidence !== undefined, {
    message: "blocked/failed proof requires questionId or exitEvidence"
  });
export type Tier1MinimalProof = z.infer<typeof tier1MinimalProofSchema>;

/** MergeProof(09 §6.1/§13):人工合并证据——treeSha 须与批准 evidenceDigest 的 prospectiveTree 匹配才 task_done */
export const mergeProofSchema = z.strictObject({
  taskId: idSchema,
  mergeCommit: z.string().min(1),
  treeSha: z.string().min(1),
  /** 批准时绑定的 prospectiveTreeSha(reviewTask approve 落 evidenceDigest 携带) */
  approvedProspectiveTreeSha: z.string().min(1)
});
export type MergeProof = z.infer<typeof mergeProofSchema>;
