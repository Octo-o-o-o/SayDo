// docs/09 §3.3 S3 屏幕审批卡(WebAuthn;R-A 2026-07-26 owner 拍板 platform authenticator)。
// WebauthnCredential(注册凭据)+ S3Challenge(单次消费挑战)。S3MergeReceipt 判别型在 types/approval.ts
// (它是 ApprovalReceipt 的收窄,与收据基型同文件防分叉)。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";

/** S3 面 rpId 常量(09 §3.3:值恒由 daemon 派生,注册/签发入参不含 rpId;tailnet 面不放宽) */
export const S3_RP_ID = "localhost";

const base64urlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/u, "expected base64url");

/** WebAuthn 凭据注册(一次性,首次 S3 前;owner 亲自在受信终端完成) */
export const webauthnCredentialSchema = z.strictObject({
  id: idSchema, // cred_ 前缀
  credentialId: base64urlSchema, // WebAuthn credential.rawId(base64url)
  publicKeyCose: base64urlSchema, // COSE 公钥(验签用)
  // 防克隆计数器。Apple platform authenticator 恒回 0(WebAuthn L2 §6.1.1:counter 恒 0 时跳过克隆检测)
  // 校验规则:received>0 时须 > stored(否则拒+告警);received=0 ∧ stored=0 ⇒ 跳过克隆检测并诚实记账
  signCount: z.number().int().nonnegative(),
  principal: z.literal("owner"), // P0 单用户
  rpId: z.literal(S3_RP_ID), // 恒 daemon 常量派生(Codex 21 A2)
  // BE/BS 标志(同步凭据诚实条款,09 §3.3:注册与每次断言落账,凭据形态可辨;null=断言未携带)
  backupEligible: z.boolean().optional(),
  backupState: z.boolean().optional(),
  status: z.enum(["active", "revoked"]),
  createdAt: tsSchema,
  lastUsedAt: tsSchema.optional(),
  revokedAt: tsSchema.optional()
});
export type WebauthnCredential = z.infer<typeof webauthnCredentialSchema>;

/** S3 动作词表(04 §5.1;P0 签发入口仅 register|merge,其余值 fail-closed 保留,启用前须另立判别合同) */
export const s3ActionSchema = z.enum(["register", "merge", "publish", "deploy", "delete_data", "external_send", "force_push"]);
export type S3Action = z.infer<typeof s3ActionSchema>;

/** S3 审批挑战(每次 S3 动作一张,单次消费,防重放) */
export const s3ChallengeSchema = z
  .strictObject({
    id: idSchema, // s3c_ 前缀
    challenge: base64urlSchema, // CSPRNG ≥32 字节
    action: s3ActionSchema,
    // 绑定被批对象(单义,Codex 21 A2 拆分):merge ⇒ review evidence digest(daemon 自取);
    // register ⇒ bootstrap intent digest(daemon 生成)——树对账不复用本字段
    refDigest: digestSchema,
    // merge 必填(§9 CHECK):被批 attempt 的 Git tree SHA(裸 hex)——与 refDigest 拆义、禁互填
    prospectiveTreeSha: z.string().regex(/^[0-9a-f]{40}$/u).optional(),
    taskId: idSchema.optional(), // merge 必填、register 必空(§9 CHECK)
    projectId: idSchema.optional(),
    // RA-closeout(Codex 22 A2 残余,2026-07-28):merge 挑战签发时点固化 attempt/packageRevision——
    // 防挑战签发后 run 换代/包换版仍被消费(verify 时与当前值交叉断言,漂移即废)
    attempt: z.number().int().positive().optional(), // merge 必填(§9 CHECK)
    packageRevision: z.number().int().positive().optional(), // merge 必填(§9 CHECK)
    sessionId: idSchema.optional(), // 审计绑定:签发时 console 会话
    // register 强制可审计 owner intent:sessionId 或 bootstrapIntentId 至少一个非空(§9 CHECK;
    // 无 console 会话时 daemon 生成一次性 intent id 并落审计行)
    bootstrapIntentId: idSchema.optional(),
    expiresAt: tsSchema, // 缺省 issuedAt + 120s(短窗;过期即废,重新发起)
    consumedAt: tsSchema.optional(), // 单次消费(消费后同 challenge 再来 ⇒ 拒)
    createdAt: tsSchema
  })
  .superRefine((c, ctx) => {
    // §9 两条 CHECK 的 schema 同源投影(v12 同步,RA-closeout code-review B-1)
    if (c.action === "merge" && (!c.taskId || !c.projectId || !c.prospectiveTreeSha || c.attempt === undefined || c.packageRevision === undefined)) {
      ctx.addIssue({ code: "custom", message: "merge challenge requires taskId + projectId + prospectiveTreeSha + attempt + packageRevision" });
    }
    if (c.action === "register") {
      if (c.taskId !== undefined || c.projectId !== undefined || c.prospectiveTreeSha !== undefined) {
        ctx.addIssue({ code: "custom", message: "register challenge must not carry taskId/projectId/prospectiveTreeSha" });
      }
      if (!c.sessionId && !c.bootstrapIntentId) {
        ctx.addIssue({ code: "custom", message: "register challenge requires sessionId or bootstrapIntentId (auditable owner intent)" });
      }
    }
  });
export type S3Challenge = z.infer<typeof s3ChallengeSchema>;
