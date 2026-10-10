// docs/09 §19：跨产品协议。主体认证由受保护适配器完成，JSON 类型不授予权限。
import { z } from "zod";
import { idOf, idSchema } from "../ids.js";
import { digestSchema } from "./common.js";
import { jcsDigest } from "../jcs.js";
import { focusEventTypeSchema } from "./focus.js";

export const PERSONAL_CONTEXT_PROTOCOL = "anyvia-saydo-personal-context/1" as const;
const uuid = z.string().uuid();
const positive = z.number().int().positive().safe();
const sequence = z.number().int().nonnegative().safe();
const label = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_.:-]+$/u);
const boundedText = z.string().min(1).max(16384);

export const personalContextBoundarySchema = z.strictObject({
  // SayDo 源安装；与 Anyvia 节点和对端安装分别绑定。
  installationId: uuid,
  nodeId: uuid,
  connectionId: uuid,
  connectionEpoch: positive,
  authorityEpoch: positive,
  vaultGeneration: positive,
  restrictionSequence: sequence,
});
export type PersonalContextBoundary = z.infer<typeof personalContextBoundarySchema>;

export const personalContextLinkSchema = z.strictObject({
  spaceId: z.string().min(1).max(200),
  caseId: uuid,
  caseRevision: positive,
  controlGeneration: positive,
  hardConstraintsRevision: positive,
  focusId: idOf("foc"),
  focusRevision: sequence,
  focusAuthorityEpoch: sequence,
  focusAnchorRevision: sequence,
  sessionId: idOf("ses"),
});
export type PersonalContextLink = z.infer<typeof personalContextLinkSchema>;

export const personalContextPeerIdentitySchema = personalContextBoundarySchema
  .pick({ installationId: true, nodeId: true, connectionId: true, connectionEpoch: true })
  .extend({ peerInstallationId: uuid, registrationId: uuid, registrationRevision: positive });
export type PersonalContextPeerIdentity = z.infer<typeof personalContextPeerIdentitySchema>;
export const personalContextRegisterSchema = z.strictObject({
  peerInstallationId: uuid, nodeId: uuid,
  publicKey: z.string().min(1).max(1024), expiresAt: positive,
});
export const personalContextRegistrationChangeSchema = z.strictObject({
  registrationId: uuid, expectedRevision: positive,
  action: z.enum(["enable", "pause", "revoke"]),
});
export const personalContextPermissionSchema = z.strictObject({
  registrationId: uuid, expectedRegistrationRevision: positive,
  method: z.enum(["compile/request", "candidate/propose", "event/ingest", "request/respond"]),
  link: personalContextLinkSchema,
  expiresAt: positive,
});
// §19.2.3：只有本机 Owner 可准备精确登记的本地签名密钥。
export const personalContextKeyProvisionSchema = z.strictObject({
  operationId: uuid, registrationId: uuid, expectedRegistrationRevision: positive,
});
export type PersonalContextKeyProvision = z.infer<typeof personalContextKeyProvisionSchema>;
export const personalContextKeyPreparationSchema = z.strictObject({
  operationId: uuid, state: z.enum(["pending", "stored", "unknown", "revoked"]),
  publicKey: z.string().min(1).max(1024), publicKeyDigest: digestSchema,
});
export type PersonalContextKeyPreparation = z.infer<typeof personalContextKeyPreparationSchema>;

export const personalContextPermissionRevokeSchema = z.strictObject({
  permissionId: uuid, expectedRevision: positive,
});

export const personalContextEventMappingSchema = z.strictObject({
  id: uuid,
  boundary: personalContextBoundarySchema,
  link: personalContextLinkSchema,
  permissionId: uuid,
  eventKinds: z.array(focusEventTypeSchema).min(1).max(128),
  allowFocusEvents: z.boolean(),
  expiresAt: positive,
});
export type PersonalContextEventMapping = z.infer<typeof personalContextEventMappingSchema>;

// 只描述已签名的主体断言；绝不能将 parse 成功当作验签或当前授权成功。
export const personalContextActorSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("owner"), decisionId: uuid, challengeId: uuid, proofDigest: digestSchema }),
  z.strictObject({ kind: z.literal("representative"), mandateId: uuid, mandateRevision: positive }),
]);

const compilePayload = z.strictObject({
  contextId: uuid,
  purpose: label,
  processorId: label,
  recipientId: label,
  maxBytes: z.number().int().positive().max(65536),
});
const candidatePayload = z.strictObject({
  permissionId: uuid,
  permissionRevision: positive,
  recordId: uuid.nullable(),
  baseRevision: positive.nullable(),
  semanticKey: z.string().min(1).max(200),
  claim: boundedText,
  kind: z.enum(["fact", "inference", "preference"]),
  sourceEventId: idOf("fev"),
  sourceDigest: digestSchema,
}).superRefine((value, context) => {
  if ((value.recordId === null) !== (value.baseRevision === null)) {
    context.addIssue({ code: "custom", message: "记录身份与基准版本必须同时给出或同时为空" });
  }
});
const eventPayload = z.strictObject({
  mappingId: uuid,
  mappingRevision: positive,
  sourceEventId: idOf("fev"),
  sourceSessionId: idOf("ses").nullable(),
  focusSequence: positive,
  streamEpoch: uuid,
  commitSequence: positive,
  eventKind: label,
  sourceDigest: digestSchema,
  summary: z.string().max(2048),
});
const responsePayload = z.strictObject({
  receiptId: idSchema,
  requestRevision: positive,
  requestDigest: digestSchema,
  requestKind: label,
  decision: z.enum(["accept", "reject"]),
  actor: personalContextActorSchema,
});
const common = {
  protocol: z.literal(PERSONAL_CONTEXT_PROTOCOL),
  operationId: uuid,
  boundary: personalContextBoundarySchema,
  link: personalContextLinkSchema,
  expiresAt: positive,
  payloadDigest: digestSchema,
};
export const personalContextEffectSchema = z.discriminatedUnion("method", [
  z.strictObject({ ...common, method: z.literal("compile/request"), payload: compilePayload }),
  z.strictObject({ ...common, method: z.literal("candidate/propose"), payload: candidatePayload }),
  z.strictObject({ ...common, method: z.literal("event/ingest"), payload: eventPayload }),
  z.strictObject({ ...common, method: z.literal("request/respond"), payload: responsePayload }),
]).superRefine((value, context) => {
  if (value.payloadDigest !== personalContextEffectDigest(value)) {
    context.addIssue({ code: "custom", message: "操作正文与绑定摘要不一致" });
  }
});
export type PersonalContextEffect = z.infer<typeof personalContextEffectSchema>;

/** 整个效果签名：包含方法、主体边界、Focus/Case、期限；不能跨方法复用正文摘要。 */
export function personalContextEffectDigest(value: Record<string, unknown>): string {
  const { payloadDigest, ...effect } = value;
  void payloadDigest;
  return jcsDigest(effect);
}

export const personalContextStatusQuerySchema = z.strictObject({
  protocol: z.literal(PERSONAL_CONTEXT_PROTOCOL),
  method: z.literal("operation/status"),
  operationId: uuid,
  boundary: personalContextBoundarySchema,
  originalMethod: z.enum(["compile/request", "candidate/propose", "event/ingest", "request/respond"]),
  payloadDigest: digestSchema,
});
export const personalContextStatusSchema = z.strictObject({
  operationId: uuid,
  payloadDigest: digestSchema,
  state: z.enum(["not_found", "pending", "applied", "rejected", "unknown", "expired"]),
  sourceReceiptDigest: digestSchema.nullable(),
}).superRefine((value, context) => {
  if (value.state === "applied" && value.sourceReceiptDigest === null) {
    context.addIssue({ code: "custom", message: "源端已应用必须有耐久回执" });
  }
});
