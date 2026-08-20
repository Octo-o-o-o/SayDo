// P0.5-A A2/A8 完整形态:E2 签名 presentation(09 §14)。
// 运行中 S2 只播 E2 签名 presentation(六字段 project/task/effect/target/downstream/expiry);
// presentation digest+nonce、heard/invalidated、parentReceiptId、per-subject CAS。
// 播报本身不改任何 receipt/package/tool 状态(golden 断言锚)。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";

/** E2 签名载荷(六字段;spokenForm 由 renderSpoken 从此渲染,禁自由造句) */
export const presentationPayloadSchema = z.strictObject({
  project: z.string().min(1),
  task: z.string().min(1),
  effect: z.string().min(1),
  target: z.string().min(1),
  downstream: z.array(z.string()),
  expiry: tsSchema
});
export type PresentationPayload = z.infer<typeof presentationPayloadSchema>;

export const signedPresentationSchema = z.strictObject({
  id: z.string().min(1), // psn-<nonce> 形态(非三字母 id 域;presentation 不落库为一等实体,journal 内嵌)
  nonce: z.string().min(8),
  receiptId: idSchema,
  /** 升级链父收据(4.2 C5:同一意图升级重发时链回原收据) */
  parentReceiptId: idSchema.optional(),
  /** per-subject CAS 键:同一 subject(缺省=receiptId)同时至多一个活跃 presentation */
  subject: z.string().min(1),
  payload: presentationPayloadSchema,
  /** digest = jcsDigest({payload, nonce, receiptId})——被打断重播必须换 nonce ⇒ 新 digest */
  digest: digestSchema,
  sentenceId: z.string().min(1),
  heard: z.boolean(),
  invalidatedAt: tsSchema.optional(),
  consumedAt: tsSchema.optional(),
  createdAt: tsSchema
});
export type SignedPresentation = z.infer<typeof signedPresentationSchema>;
