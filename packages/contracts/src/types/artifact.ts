// docs/09 §8 产物(Artifact)。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";
import { sourceRefSchema } from "./memory.js";

export const artifactTypeSchema = z.enum([
  "decision_package",
  "demo",
  "plan",
  "research",
  "report",
  "diff_summary",
  "transcript_export",
  "article" // writing 窄版成稿(09 §6.1a/§8;W4)
]);
export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const artifactSchema = z.strictObject({
  id: idSchema,
  projectId: idSchema,
  version: z.number().int().positive(),
  type: artifactTypeSchema,
  path: z.string().min(1),
  digest: digestSchema,
  supersedes: z.strictObject({ artifactId: idSchema, version: z.number().int().positive() }).optional(),
  tags: z.array(z.string()),
  source: sourceRefSchema.shape.kind,
  createdAt: tsSchema
});
export type Artifact = z.infer<typeof artifactSchema>;
