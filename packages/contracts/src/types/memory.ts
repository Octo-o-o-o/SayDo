// docs/09 §4 记忆域:MemoryEvent 按 op 判别联合 + Trust/Tier/SourceRef。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";

export const tierSchema = z.enum(["M0", "M1", "M2", "M3"]);
export type Tier = z.infer<typeof tierSchema>;

export const trustSchema = z.enum(["user_stated", "user_approved", "auto_low_impact", "candidate", "third_party"]);
export type Trust = z.infer<typeof trustSchema>;

export const sourceRefSchema = z.strictObject({
  kind: z.enum(["user_utterance", "user_edit", "repo_file", "web", "artifact", "agent_output", "import"]),
  ref: z.string(),
  quote: z.string().optional()
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

const memoryEventBase = {
  id: idSchema,
  ts: tsSchema,
  tier: tierSchema,
  projectId: idSchema.optional()
};

export const memoryEventSchema = z.discriminatedUnion("op", [
  z.strictObject({
    ...memoryEventBase,
    op: z.enum(["add", "correct"]),
    claim: z.string().min(1),
    source: sourceRefSchema,
    trust: trustSchema,
    taint: z.array(z.string()).optional(),
    expiresAt: tsSchema.optional(),
    supersedes: idSchema.optional(),
    // A3-armed(09 §13 covered 块):就绪候选绑定 key——词表/来源/trust/项目四闸由 remember 工具层校验,
    // schema 只承载形状(additive;事件溯源,重放入投影)
    readinessKey: z.string().min(1).optional()
  }),
  z.strictObject({
    ...memoryEventBase,
    op: z.enum(["invalidate", "forget_soft"]),
    targets: z.array(idSchema).min(1),
    reason: z.string().min(1)
  }),
  z.strictObject({
    ...memoryEventBase,
    op: z.literal("forget_hard"),
    targets: z.array(idSchema).min(1),
    targetDigests: z.array(digestSchema).min(1),
    generation: z.number().int().positive(),
    stores: z.array(z.enum(["fts", "projection", "summary", "backup", "snapshot"])).min(1)   // snapshot=源快照正文删除(09 §4.1,2026-07-24)
  }),
  // consolidate = P1(09 §4;类型保留,写路径 P0 拒收)
  z.strictObject({
    ...memoryEventBase,
    op: z.literal("consolidate"),
    mergedFrom: z.array(idSchema).min(1),
    into: z.string().min(1)
  })
]);
export type MemoryEvent = z.infer<typeof memoryEventSchema>;
