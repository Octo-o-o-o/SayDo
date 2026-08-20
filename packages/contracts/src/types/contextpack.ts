// docs/09 §5 Context Pack:Claim + ContextSnapshot(确定性编译)。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema } from "./common.js";
import { sourceRefSchema } from "./memory.js";
import { evidenceBindingSchema } from "./sourceverify.js";

export const claimSchema = z.strictObject({
  text: z.string().min(1),
  source: sourceRefSchema,
  confidence: z.enum(["high", "med", "low"]),
  critical: z.boolean(),
  state: z.enum(["verified", "assumed", "unknown", "conflicting"]),
  // 证据绑定(09 §4.1,多源;critical claim 须 >=1 条具资格 binding——3.2 消费)
  evidence: z.array(evidenceBindingSchema).optional()
});
export type Claim = z.infer<typeof claimSchema>;

export const contextSnapshotSchema = z.strictObject({
  packDigest: digestSchema,
  compilerVersion: z.string().min(1), // 含 FTS 分词器 + 渲染模板 + token 计数器版本(M7)
  sessionId: idSchema,
  projectId: idSchema,
  // M7/③-1:复用上轮前缀时父 pack 显式入签名域(保纯函数性;首轮 undefined)
  parentPackDigest: digestSchema.optional(),
  repoHead: z.string().optional(),
  dirtyDigest: z.string().optional(),
  memoryGeneration: z.number().int().nonnegative(),
  topicTerms: z.array(z.string()),
  budgets: z.strictObject({
    M0: z.number().int().nonnegative(),
    M1: z.number().int().nonnegative(),
    M2: z.number().int().nonnegative(),
    M3: z.number().int().nonnegative()
  }),
  slices: z.array(
    z.strictObject({
      tier: z.enum(["M0", "M1", "M2", "M3"]),
      refs: z.array(z.string()),
      tokens: z.number().int().nonnegative(),
      // M7:stable=稳定前缀段(instructions/M0/M1)/topical=易变段(FTS 命中/M3);form=M3 荷载形态;prefixDigest=累积前缀
      segment: z.enum(["stable", "topical"]),
      form: z.enum(["verbatim", "gist"]).optional(),
      prefixDigest: digestSchema.optional()
    })
  ),
  excluded: z.array(z.strictObject({ ref: z.string(), reason: z.string() }))
});
export type ContextSnapshot = z.infer<typeof contextSnapshotSchema>;
