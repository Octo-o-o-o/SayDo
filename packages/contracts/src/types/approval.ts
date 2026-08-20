// docs/09 §3 审批收据(两类,不共用 approved=true)+ 合法组合矩阵。
// outcome 状态机在 statemachines/receipt.ts;DDL CHECK 在 0.3(storage)。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";

export const riskLevelSchema = z.enum(["S0", "S1", "S2", "S3"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const decidedViaSchema = z.enum(["voice", "screen", "push", "preauthorized"]);
export type DecidedVia = z.infer<typeof decidedViaSchema>;

export const authStrengthSchema = z.enum(["voice_weak", "paired_device_pin", "screen_authenticated", "os_biometric"]);
export type AuthStrength = z.infer<typeof authStrengthSchema>;

export const receiptOutcomeSchema = z.enum([
  "pending",
  "consumed",
  "rejected",
  "timeout_rejected",
  "timeout_parked",
  "superseded_by_edit",
  "voided_by_conflict",
  "expired"
]);
export type ReceiptOutcome = z.infer<typeof receiptOutcomeSchema>;

export const receiptDecisionSchema = z.enum(["accept", "reject", "edit", "respond", "ignore"]);
export type ReceiptDecision = z.infer<typeof receiptDecisionSchema>;

/** S3 收据判别域(09 §3.3;R-A 补完 2026-07-27,Codex 21 A1):六项全部 daemon 库内自取 */
export const s3ReceiptFieldsSchema = z.strictObject({
  challengeId: idSchema, // → s3_challenges(action="merge" 且同事务已消费;一挑战至多一收据,§9 UNIQUE)
  credentialId: z.string().min(1), // 验签 provenance(审计可回放)
  assertionDigest: digestSchema,
  attempt: z.number().int().positive(), // 全匹配域
  packageRevision: z.number().int().positive(),
  prospectiveTreeSha: z.string().regex(/^[0-9a-f]{40}$/u) // Git tree SHA(裸 hex)——与 §0 Digest 两型不混、禁互填(Codex 21 A2)
});
export type S3ReceiptFields = z.infer<typeof s3ReceiptFieldsSchema>;

const approvalReceiptBase = z.strictObject({
  id: idSchema,
  kind: z.enum(["dispatch_package", "runtime_effect"]),
  refDigest: digestSchema,
  parentPackageDigest: digestSchema.optional(),
  effectGrantRef: z.strictObject({ effect: z.string(), grantDigest: digestSchema }).optional(),
  taskId: idSchema.optional(),
  sessionId: idSchema.optional(),
  turnRef: idSchema.optional(),
  riskLevel: riskLevelSchema,
  principal: z.literal("owner"),
  decidedVia: decidedViaSchema,
  authStrength: authStrengthSchema,
  decision: receiptDecisionSchema.optional(),
  nonce: z.string().min(1),
  issuedAt: tsSchema,
  expiresAt: tsSchema,
  decidedAt: tsSchema.optional(),
  outcome: receiptOutcomeSchema,
  consumedAt: tsSchema.optional(),
  s3: s3ReceiptFieldsSchema.optional() // riskLevel=S3 必填、非 S3 必缺席(superRefine + DDL 双向 CHECK)
});

/** 合法组合矩阵(09 §3,写入校验;DDL CHECK 同源 0.3) */
export function receiptComboViolation(r: {
  kind: "dispatch_package" | "runtime_effect";
  riskLevel: RiskLevel;
  decidedVia: DecidedVia;
  authStrength: AuthStrength;
  parentPackageDigest?: string | undefined;
  turnRef?: string | undefined;
}): string | null {
  if (r.riskLevel === "S3" && (r.decidedVia !== "screen" || !["screen_authenticated", "os_biometric"].includes(r.authStrength))) {
    return "S3 only via authenticated screen";
  }
  if (r.decidedVia === "voice" && (r.authStrength !== "voice_weak" || r.riskLevel === "S3")) {
    return "voice is weak-auth and capped at S2";
  }
  if (r.decidedVia === "push" && (r.authStrength !== "paired_device_pin" || r.riskLevel === "S3")) {
    return "push requires paired_device_pin and is capped at S2";
  }
  if (r.decidedVia === "screen" && !["screen_authenticated", "os_biometric"].includes(r.authStrength)) {
    return "screen requires authenticated strength";
  }
  if (r.decidedVia === "preauthorized") {
    if (r.kind !== "runtime_effect") return "preauthorized only for runtime_effect";
    if (!r.parentPackageDigest) return "preauthorized requires parentPackageDigest";
    if (r.riskLevel === "S3") return "preauthorized capped at S2";
  }
  // 一切语音裁决须绑转写轮(09 §9 DDL CHECK 同源;SOL 反例 voice_dispatch_null_turn_ref)。
  // turn_ref 过约束放宽(09 §3.3,Codex 14 #1 随 S3 卡兑现):screen/push 的 runtime_effect 无当前
  // 语音轮,turnRef 允许 NULL——旧"非预授权 runtime_effect 须绑转写轮"规则删除,唯一强制 = voice 行。
  if (r.decidedVia === "voice" && !r.turnRef) return "voice decision requires turnRef";
  return null;
}

export const approvalReceiptSchema = approvalReceiptBase.superRefine((r, ctx) => {
  const violation = receiptComboViolation(r);
  if (violation) ctx.addIssue({ code: "custom", message: violation });
  if (r.kind === "runtime_effect" && !r.parentPackageDigest) {
    ctx.addIssue({ code: "custom", message: "runtime_effect requires parentPackageDigest" });
  }
  // S3 判别域双向断言(09 §3.3/§9,Codex 21 A1):S3 收据必带全部来源域(generic screen 行
  // schema 层即非法,fail-closed);非 S3 收据不得蹭挑战来源。
  if (r.riskLevel === "S3" && (r.s3 === undefined || !r.taskId)) {
    ctx.addIssue({ code: "custom", message: "S3 receipt requires s3 provenance fields + taskId (S3MergeReceipt 判别型)" });
  }
  if (r.riskLevel !== "S3" && r.s3 !== undefined) {
    ctx.addIssue({ code: "custom", message: "non-S3 receipt must not carry s3 provenance fields" });
  }
});
export type ApprovalReceipt = z.infer<typeof approvalReceiptBase>;

/**
 * S3MergeReceipt 判别型(09 §3.3,R-A 补完 2026-07-27,Codex 21 A1):riskLevel="S3" 的收据必为此形。
 * generic screen 收据无挑战/凭据来源域,类型层与 DDL 层(§9 approvals CHECK)双重不可能构成 S3 收据;
 * approveMerge 只认此形,防"普通屏幕收据冒充强认证"。
 */
export const s3MergeReceiptSchema = approvalReceiptBase
  .extend({
    kind: z.literal("runtime_effect"),
    riskLevel: z.literal("S3"),
    decidedVia: z.literal("screen"),
    authStrength: z.literal("os_biometric"),
    taskId: idSchema, // 基型可选,此处收窄必填
    s3: s3ReceiptFieldsSchema // 必填
  })
  .superRefine((r, ctx) => {
    if (r.kind === "runtime_effect" && !r.parentPackageDigest) {
      ctx.addIssue({ code: "custom", message: "runtime_effect requires parentPackageDigest" });
    }
  });
export type S3MergeReceipt = z.infer<typeof s3MergeReceiptSchema>;

/** S3MergeReceipt 判别函数(approveMerge ① 判别步;仅形状判别,全匹配域在事务内另断言) */
export function isS3MergeReceipt(r: ApprovalReceipt): r is ApprovalReceipt & S3MergeReceipt {
  return s3MergeReceiptSchema.safeParse(r).success;
}
