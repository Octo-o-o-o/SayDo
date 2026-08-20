// docs/09 §6.2 跨域映射与出站命令(DispatchBinding / HopperCommand)。
// 读写路径属 P0.5-B;类型与表(0.3 v1 全集建表)先行,防契约分叉。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";
import { executionModeSchema } from "./project.js";

export const dispatchBindingSchema = z.strictObject({
  voiceTaskId: idSchema,
  dispatchId: idSchema,
  idempotencyKey: z.string().min(1),
  packageDigest: digestSchema,
  mode: executionModeSchema,
  hopper: z
    .strictObject({
      projectId: z.string().min(1),
      taskId: z.string().min(1),
      revision: z.number().int(),
      runId: z.string().optional(),
      vaultId: z.string().optional(),
      projectSnapshotDigest: digestSchema
    })
    .optional(),
  dropOutcome: z.enum(["created", "updated_draft", "new_revision", "duplicate_ignored"]).optional(), // 缺省(undefined)= in-flight
  createdAt: tsSchema
});
export type DispatchBinding = z.infer<typeof dispatchBindingSchema>;

export const hopperCommandOpSchema = z.enum([
  "drop",
  "scan",
  "run",
  "cancel",
  "unblock",
  "review_approve",
  "review_request_changes",
  "review_reject",
  "merge",
  "retry"
]);
export type HopperCommandOp = z.infer<typeof hopperCommandOpSchema>;

export const hopperCommandStateSchema = z.enum(["intent", "sent", "confirmed", "failed"]);
export type HopperCommandState = z.infer<typeof hopperCommandStateSchema>;

export const hopperCommandSchema = z.strictObject({
  id: idSchema,
  taskId: idSchema,
  op: hopperCommandOpSchema,
  idemKey: z.string().min(1),
  payloadDigest: digestSchema,
  receiptId: idSchema.optional(), // merge/approve 绑收据
  state: hopperCommandStateSchema,
  createdAt: tsSchema,
  updatedAt: tsSchema
});
export type HopperCommand = z.infer<typeof hopperCommandSchema>;

/** 出站命令 journal 规则(09 §6.2):先 intent -> sent -> confirmed;重启扫 != confirmed 重放 */
export const HOPPER_COMMAND_TRANSITIONS: Record<HopperCommandState, HopperCommandState[]> = {
  intent: ["sent", "failed"],
  sent: ["confirmed", "failed"],
  confirmed: [],
  failed: ["sent"] // 原 idemKey 重放
};
