// docs/09 §1 项目与会话。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";

export const projectTypeSchema = z.enum(["coding", "writing", "planning", "research", "marketing", "general", "pending"]);
export type ProjectType = z.infer<typeof projectTypeSchema>;

export const executionModeSchema = z.enum(["step_confirm", "direct_to_review"]);
export type ExecutionMode = z.infer<typeof executionModeSchema>;

export const projectSchema = z.strictObject({
  id: idSchema,
  title: z.string(),
  type: projectTypeSchema,
  status: z.enum(["draft", "active", "archived"]),
  reanchoredTo: idSchema.optional(),
  workspace: z.strictObject({
    kind: z.enum(["local_folder", "remote_repo"]),
    path: z.string(),
    url: z.string().optional(),
    managed: z.boolean()
  }),
  hopperProjectId: z.string().optional(),
  executionModeDefault: executionModeSchema,
  createdAt: tsSchema,
  updatedAt: tsSchema
});
export type Project = z.infer<typeof projectSchema>;

export const sessionSchema = z.strictObject({
  id: idSchema,
  projectId: idSchema,
  projectRevision: z.number().int().nonnegative().default(0),
  state: z.enum(["learning", "talking", "suspended", "closed"]),
  engine: z.enum(["cascade", "s2s"]),
  transcriptPath: z.string(),
  contextSnapshotDigest: digestSchema.optional(),
  startedAt: tsSchema,
  endedAt: tsSchema.optional(),
  // 价值证据轨埋点(05 §价值证据轨"sessions 记 lane";近零成本,车道占比指标用)
  lane: z.enum(["quick", "guided", "explore"]).optional()
});
export type Session = z.infer<typeof sessionSchema>;

/** 转写行(sessions/<id>.jsonl 每行;turnId 是 IntentLedger/溯源的锚) */
export const transcriptTurnSchema = z.strictObject({
  turnId: idSchema,
  ts: tsSchema,
  speaker: z.enum(["user", "ai"]),
  text: z.string(),
  /** 固定首跑开场白的 durable provenance；普通轮缺省不写。 */
  origin: z.enum(["onboarding"]).optional(),
  asrConfidence: z.number().min(0).max(1).optional(),
  sentences: z.array(
    z.strictObject({
      sentenceId: z.string(),
      text: z.string(),
      heard: z.boolean(),
      // A8(P0.5-A):授权类播报句关联 presentation id(转写留痕:哪句播报承载了哪次授权呈现)
      presentationId: z.string().optional()
    })
  ),
  // M11/F2(2026-07-25):utterance <-> 原始音频段可关联(为 P1 diarize 事后审计留口;保留期 params.audio_retention_days,P0 缺省 0 不留)
  audioSegmentRef: z.strictObject({ path: z.string(), startMs: z.number().int().nonnegative(), endMs: z.number().int().nonnegative() }).optional(),
  engine: z.enum(["cascade", "s2s"])
});
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
