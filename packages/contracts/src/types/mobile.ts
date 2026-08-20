// M1 移动 Web 只读投影与回执词表；daemon producer 与 console consumer 共用。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { tsSchema } from "./common.js";
import {
  focusFourStateCountsSchema,
  focusLifecycleSchema,
  focusObligationKindSchema,
  focusObligationNeedsSchema,
  focusObligationOwnerSchema,
  focusObligationStatusSchema,
  focusObligationVerificationSchema,
  focusSemanticAuthoritySchema
} from "./focus.js";

export const attentionColorSchema = z.enum(["orange", "blue", "green", "gray"]);
export type AttentionColor = z.infer<typeof attentionColorSchema>;

export const attentionActionSchema = z.enum(["open_confirm", "open_task_modal", "open_focus"]);
export const attentionSourceKindSchema = z.enum(["confirmation", "obligation", "task"]);

export const attentionItemSchema = z.strictObject({
  id: z.string().min(1),
  color: attentionColorSchema,
  title: z.string(),
  focusId: idSchema.nullable(),
  focusTitle: z.string().nullable(),
  action: attentionActionSchema,
  updatedAt: tsSchema,
  sessionId: idSchema.optional(),
  expiresAt: tsSchema.optional(),
  projectId: idSchema.optional(),
  needs: focusObligationNeedsSchema.nullable().optional(),
  laneId: idSchema.nullable().optional(),
  sourceKind: attentionSourceKindSchema.optional(),
  refId: z.string().min(1).optional(),
  ackedAt: tsSchema.optional()
});
export type AttentionItem = z.infer<typeof attentionItemSchema>;

export const attentionResponseSchema = z.strictObject({ items: z.array(attentionItemSchema) });
export type AttentionResponse = z.infer<typeof attentionResponseSchema>;

export const focusOpenByOwnerSchema = z.strictObject({
  human: z.number().int().nonnegative(),
  agent: z.number().int().nonnegative(),
  external: z.number().int().nonnegative()
});

export const mobileFocusListItemSchema = z.strictObject({
  id: idSchema,
  title: z.string(),
  lifecycle: focusLifecycleSchema,
  currentRevision: z.number().int().nonnegative(),
  semanticAuthority: focusSemanticAuthoritySchema,
  openObligationCount: z.number().int().nonnegative(),
  openByOwner: focusOpenByOwnerSchema,
  fourState: focusFourStateCountsSchema,
  projectRefs: z.array(idSchema),
  updatedAt: tsSchema,
  spaceId: idSchema.nullable(),
  direction: z.string().nullable()
});
export type MobileFocusListItem = z.infer<typeof mobileFocusListItemSchema>;

export const mobileObligationSchema = z.strictObject({
  id: idSchema,
  kind: focusObligationKindSchema,
  title: z.string(),
  owner: focusObligationOwnerSchema,
  status: focusObligationStatusSchema,
  verification: focusObligationVerificationSchema,
  blocking: z.boolean(),
  nextStep: z.string().nullable(),
  detail: z.string().nullable(),
  needs: focusObligationNeedsSchema.nullable(),
  laneId: idSchema.nullable(),
  waitingOn: z.string().nullable(),
  waitingOnObligationId: idSchema.nullable(),
  createdFromEvent: z.number().int().nonnegative().nullable(),
  actionRef: z.string().nullable()
});
export type MobileObligation = z.infer<typeof mobileObligationSchema>;

export const mobileFocusDetailSchema = z.strictObject({
  focus: z.strictObject({
    id: idSchema,
    title: z.string(),
    lifecycle: focusLifecycleSchema,
    currentRevision: z.number().int().nonnegative(),
    semanticAuthority: focusSemanticAuthoritySchema,
    authorityEpoch: z.number().int().nonnegative(),
    updatedAt: tsSchema,
    direction: z.string().nullable(),
    openObligationCount: z.number().int().nonnegative(),
    spaceId: idSchema.nullable()
  }),
  obligations: z.array(mobileObligationSchema),
  lanes: z.array(
    z.strictObject({
      id: idSchema,
      title: z.string(),
      parentLaneId: idSchema.nullable(),
      createdFromEvent: z.number().int().nonnegative(),
      retiredAt: tsSchema.nullable()
    })
  ),
  events: z.array(
    z.strictObject({
      id: idSchema,
      seq: z.number().int().positive(),
      type: z.string().min(1),
      payload: z.strictObject({
        title: z.string().optional(),
        revision: z.union([z.string(), z.number()]).optional()
      }),
      actorKind: z.string().min(1),
      createdAt: tsSchema
    })
  )
});
export type MobileFocusDetail = z.infer<typeof mobileFocusDetailSchema>;

export const confirmResolvedOutcomeSchema = z.enum([
  "accepted",
  "rejected",
  "dismissed",
  "to_screen",
  "withdrawn",
  "stale",
  "expired",
  "untrusted_source"
]);
export type ConfirmResolvedOutcome = z.infer<typeof confirmResolvedOutcomeSchema>;

export const mobileConfirmSuccessOutcomeSchema = z.enum(["accepted", "rejected", "withdrawn"]);
export type MobileConfirmSuccessOutcome = z.infer<typeof mobileConfirmSuccessOutcomeSchema>;
