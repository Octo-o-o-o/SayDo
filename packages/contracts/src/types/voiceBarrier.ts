// docs/09 §10.1 主题锚定语音屏障:标识、载荷摘要、HTTP 写口与账本形状。
// 形状以 09 为准;本文件是唯一代码载体,禁在 daemon/console 重定义。

import { z } from "zod";
import { idOf, idSchema } from "../ids.js";
import { jcsDigest } from "../jcs.js";
import { digestSchema } from "./common.js";

export const PIPELINE_EPOCH_MIN = 1;
export const PIPELINE_EPOCH_MAX = 0x7fff_ffff;
export const FOCUS_ANCHOR_RECORDS_PER_SID = 32;
export const CAPTURE_REGISTRY_PER_SID = 64;
export const HANDOVER_PER_SID = 16;
export const TURN_RECEIPT_PER_SID = 32;
export const TURN_RECEIPT_GLOBAL = 256;
export const TURN_RECEIPT_TTL_MS = 30 * 60 * 1000;
export const VOICE_QUIESCE_TIMEOUT_MS = 120_000;

export const pipelineEpochSchema = z.number().int().min(PIPELINE_EPOCH_MIN).max(PIPELINE_EPOCH_MAX);
export type PipelineEpoch = z.infer<typeof pipelineEpochSchema>;

export const captureIntentSchema = z.enum(["send", "edit", "cancel"]);
export type CaptureIntent = z.infer<typeof captureIntentSchema>;

export const captureModeSchema = z.enum(["ptt", "hands_free"]);
export type CaptureMode = z.infer<typeof captureModeSchema>;

export const recognitionOutcomeSchema = z.enum(["ok", "failed"]);
export type RecognitionOutcome = z.infer<typeof recognitionOutcomeSchema>;

export const receiptActionSchema = z.enum(["submit", "replay", "retry"]);
export type ReceiptAction = z.infer<typeof receiptActionSchema>;

export const emptyRoundSchema = z.enum(["empty", "unusable"]);
export type EmptyRound = z.infer<typeof emptyRoundSchema>;

export const focusAnchorStateSchema = z.enum([
  "preparing",
  "prepared",
  "applied",
  "rearmed",
  "consumed",
  "failed"
]);
export type FocusAnchorState = z.infer<typeof focusAnchorStateSchema>;

export const unconfirmedAudioKindSchema = z.enum(["ptt", "hands_free", "accepted_pcm"]);
export type UnconfirmedAudioKind = z.infer<typeof unconfirmedAudioKindSchema>;

export const unconfirmedAudioStateSchema = z.enum(["unconfirmed", "unknown", "discarded", "confirmed"]);
export type UnconfirmedAudioState = z.infer<typeof unconfirmedAudioStateSchema>;

/** 唯一升序;元素 ∈ 1..2^31-1。空数组 ≡ 键不出现。 */
export function normalizeDiscardUnknownEpochs(raw: unknown): number[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new Error("invalid_input");
  if (raw.length === 0) return undefined;
  const out: number[] = [];
  for (const item of raw) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < PIPELINE_EPOCH_MIN || item > PIPELINE_EPOCH_MAX) {
      throw new Error("invalid_input");
    }
    out.push(item);
  }
  const unique = [...new Set(out)].sort((a, b) => a - b);
  if (unique.length !== out.length) throw new Error("invalid_input");
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== unique[i]) throw new Error("invalid_input");
  }
  return unique;
}

export const discardUnknownEpochsSchema = z
  .array(pipelineEpochSchema)
  .superRefine((value, ctx) => {
    try {
      normalizeDiscardUnknownEpochs(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "discardUnknownEpochs must be unique ascending epochs" });
    }
  });

export function normalizeLaneTitle(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** payloadDigest = sha256(JCS({ focusId, laneTitle?, discardUnknownEpochs? })) */
export function focusAnchorPayloadDigest(input: {
  focusId: string;
  laneTitle?: string;
  discardUnknownEpochs?: number[];
}): string {
  const payload: { focusId: string; laneTitle?: string; discardUnknownEpochs?: number[] } = {
    focusId: input.focusId
  };
  const lane = normalizeLaneTitle(input.laneTitle);
  if (lane !== undefined) payload.laneTitle = lane;
  const discard = input.discardUnknownEpochs === undefined ? undefined : normalizeDiscardUnknownEpochs(input.discardUnknownEpochs);
  if (discard !== undefined) payload.discardUnknownEpochs = discard;
  return jcsDigest(payload);
}

export function sameFocusLane(
  a: { focusId: string; laneTitle?: string },
  b: { focusId: string; laneTitle?: string }
): boolean {
  return a.focusId === b.focusId && normalizeLaneTitle(a.laneTitle) === normalizeLaneTitle(b.laneTitle);
}

export const voiceHelloAckSchema = z.strictObject({
  t: z.literal("hello.ack"),
  v: z.literal(1),
  peerId: idOf("evt"),
  daemonEpoch: idOf("evt")
});
export type VoiceHelloAck = z.infer<typeof voiceHelloAckSchema>;

export const focusAnchorRequestBodySchema = z.strictObject({
  focusId: idSchema,
  laneTitle: z.string().optional(),
  requestId: idOf("evt").optional()
});
export type FocusAnchorRequestBody = z.infer<typeof focusAnchorRequestBodySchema>;

export const focusAnchorOkSchema = z.strictObject({
  ok: z.literal(true),
  sessionId: idSchema,
  focusId: idSchema,
  already: z.boolean(),
  voiceBoundaryId: idOf("evt"),
  voiceBoundaryRequired: z.literal(true)
});
export type FocusAnchorOk = z.infer<typeof focusAnchorOkSchema>;

export const focusAnchorLegacyOkSchema = z.strictObject({
  ok: z.literal(true),
  sessionId: idSchema,
  focusId: idSchema,
  already: z.boolean()
});
export type FocusAnchorLegacyOk = z.infer<typeof focusAnchorLegacyOkSchema>;

export const focusAnchorErrSchema = z.strictObject({
  ok: z.literal(false),
  code: z.string().min(1),
  retryable: z.boolean(),
  message: z.string().optional()
});
export type FocusAnchorErr = z.infer<typeof focusAnchorErrSchema>;

export type FocusAnchorRecord = {
  sessionId: string;
  requestId: string;
  payloadDigest: string;
  focusId: string;
  laneTitle?: string;
  discardUnknownEpochs?: number[];
  ownerPeerId: string;
  state: FocusAnchorState;
  failedCode?: string;
  emptyRound?: EmptyRound;
  informedUnknown?: boolean;
};

export type CaptureRegistryEntry = {
  sessionId: string;
  captureId: string;
  epoch: number;
  intent: CaptureIntent;
} & (
  | { consumed: false; discarded: false }
  | { consumed: true; discarded: false }
  | { consumed: true; discarded: true }
);

export type UnconfirmedAudioEpoch = {
  sessionId: string;
  epoch: number;
  kind: UnconfirmedAudioKind;
  captureId?: string;
  hfSeq?: number;
  hfSegmentId?: string;
  hfRoundId?: string;
  recordSeq?: number;
  state: UnconfirmedAudioState;
  speechEnded?: boolean;
};

const captureRegistryIdentity = {
  sessionId: idSchema,
  captureId: idOf("evt"),
  epoch: pipelineEpochSchema,
  intent: captureIntentSchema
} as const;

export const captureRegistryEntrySchema = z.union([
  z.strictObject({
    ...captureRegistryIdentity,
    consumed: z.literal(false),
    discarded: z.literal(false)
  }),
  z.strictObject({
    ...captureRegistryIdentity,
    consumed: z.literal(true),
    discarded: z.literal(false)
  }),
  z.strictObject({
    ...captureRegistryIdentity,
    consumed: z.literal(true),
    discarded: z.literal(true)
  })
]);

export const unconfirmedAudioEpochSchema = z.strictObject({
  sessionId: idSchema,
  epoch: pipelineEpochSchema,
  kind: unconfirmedAudioKindSchema,
  captureId: idOf("evt").optional(),
  hfSeq: z.number().int().nonnegative().optional(),
  hfSegmentId: idOf("evt").optional(),
  hfRoundId: idOf("evt").optional(),
  recordSeq: z.number().int().min(1).max(2_147_483_647).optional(),
  state: unconfirmedAudioStateSchema,
  speechEnded: z.boolean().optional()
});

export function arraysEqual(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((value, i) => value === right[i]);
}

export const digestOfText = (text: string): string => jcsDigest({ text });

export { digestSchema };
