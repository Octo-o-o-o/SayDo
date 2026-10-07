// docs/09 §10 语音管线 WS 契约(A1 与 A2 之间)。
// Unheard 纪律:被打断句 watermark 后文本 heard=false,不进对话事实(10 §3)。

import { z } from "zod";
import { idOf, idSchema } from "../ids.js";
import { confirmResolvedOutcomeSchema } from "./mobile.js";
import { runtimeIdentitySchema } from "../runtime.js";
import {
  captureIntentSchema,
  captureModeSchema,
  discardUnknownEpochsSchema,
  emptyRoundSchema,
  pipelineEpochSchema,
  receiptActionSchema,
  recognitionOutcomeSchema
} from "./voiceBarrier.js";

export const nativeReplyOriginSchema = z.enum([
  "assistant_reply",
  "system",
  "confirmation",
  "onboarding"
]);
export type NativeReplyOrigin = z.infer<typeof nativeReplyOriginSchema>;

export const HF_RECORD_SEQ_MAX = 2_147_483_647;

export const hfRecordSeqSchema = z.number().int().min(1).max(HF_RECORD_SEQ_MAX);

export const ASR_FINAL_KEYS = [
  "t",
  "sessionId",
  "turnId",
  "text",
  "confidence",
  "captureMode",
  "captureId",
  "recognitionOutcome",
  "hfRoundId",
  "hfSegmentIds",
  "recordSeqFirst",
  "recordSeqLast"
] as const;

const asrFinalConfidence = z.number().min(0).max(1).optional();

const asrFinalLegacySchema = z.strictObject({
  t: z.literal("asr.final"),
  sessionId: idSchema,
  turnId: idSchema,
  text: z.string(),
  confidence: asrFinalConfidence
});

const hfRoundFinalFields = {
  hfRoundId: idOf("evt"),
  hfSegmentIds: z.array(idOf("evt")).min(1),
  recordSeqFirst: hfRecordSeqSchema,
  recordSeqLast: hfRecordSeqSchema
} as const;

function refineHfRoundFinal(
  val: { hfSegmentIds: string[]; recordSeqFirst: number; recordSeqLast: number },
  ctx: z.RefinementCtx
): void {
  if (val.recordSeqFirst > val.recordSeqLast) {
    ctx.addIssue({ code: "custom", message: "recordSeqFirst 必须小于等于 recordSeqLast" });
  }
  if (new Set(val.hfSegmentIds).size !== val.hfSegmentIds.length) {
    ctx.addIssue({ code: "custom", message: "hfSegmentIds 不得重复" });
  }
  if (val.hfSegmentIds.length !== val.recordSeqLast - val.recordSeqFirst + 1) {
    ctx.addIssue({ code: "custom", message: "hfSegmentIds 必须覆盖 recordSeq 闭区间" });
  }
}

const asrFinalHandsFreeSchema = z.strictObject({
  t: z.literal("asr.final"),
  sessionId: idSchema,
  turnId: idSchema,
  text: z.string(),
  confidence: asrFinalConfidence,
  captureMode: z.literal("hands_free"),
  recognitionOutcome: z.literal("ok")
});

const asrFinalHandsFreeFailedSchema = z.strictObject({
  t: z.literal("asr.final"),
  sessionId: idSchema,
  turnId: idSchema,
  text: z.literal(""),
  confidence: asrFinalConfidence,
  captureMode: z.literal("hands_free"),
  recognitionOutcome: z.literal("failed")
});

const asrFinalHfOkSchema = z
  .strictObject({
    t: z.literal("asr.final"),
    sessionId: idSchema,
    turnId: idSchema,
    text: z.string(),
    confidence: asrFinalConfidence,
    captureMode: z.literal("hands_free"),
    recognitionOutcome: z.literal("ok"),
    ...hfRoundFinalFields
  })
  .superRefine(refineHfRoundFinal);

const asrFinalHfFailedSchema = z
  .strictObject({
    t: z.literal("asr.final"),
    sessionId: idSchema,
    turnId: idSchema,
    text: z.literal(""),
    confidence: asrFinalConfidence,
    captureMode: z.literal("hands_free"),
    recognitionOutcome: z.literal("failed"),
    ...hfRoundFinalFields
  })
  .superRefine(refineHfRoundFinal);

const asrFinalPttOkSchema = z.strictObject({
  t: z.literal("asr.final"),
  sessionId: idSchema,
  turnId: idSchema,
  text: z.string(),
  confidence: asrFinalConfidence,
  captureMode: z.literal("ptt"),
  captureId: idOf("evt"),
  recognitionOutcome: z.literal("ok")
});

const asrFinalPttFailedSchema = z.strictObject({
  t: z.literal("asr.final"),
  sessionId: idSchema,
  turnId: idSchema,
  text: z.literal(""),
  confidence: asrFinalConfidence,
  captureMode: z.literal("ptt"),
  captureId: idOf("evt"),
  recognitionOutcome: z.literal("failed")
});

export const asrFinalMsgSchema = z.union([
  asrFinalHfOkSchema,
  asrFinalHfFailedSchema,
  asrFinalHandsFreeSchema,
  asrFinalHandsFreeFailedSchema,
  asrFinalPttOkSchema,
  asrFinalPttFailedSchema,
  asrFinalLegacySchema
]);
export type AsrFinalMsg = z.infer<typeof asrFinalMsgSchema>;

export function pickAsrFinalKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ASR_FINAL_KEYS) {
    if (key in raw) out[key] = raw[key];
  }
  return out;
}

export function parseAsrFinal(raw: unknown): AsrFinalMsg | null {
  if (!raw || typeof raw !== "object") return null;
  if (
    "captureMode" in raw && raw.captureMode === "ptt"
    && ["hfSegmentId", "hfRoundId", "recordSeq", "hfSegmentIds", "recordSeqFirst", "recordSeqLast"].some((key) => key in raw)
  ) return null;
  const picked = pickAsrFinalKeys(raw as Record<string, unknown>);
  const parsed = asrFinalMsgSchema.safeParse(picked);
  return parsed.success ? parsed.data : null;
}

export type ClassifiedAsrFinal = Extract<AsrFinalMsg, { captureMode: "ptt" | "hands_free" }>;

export function isClassifiedAsrFinal(msg: AsrFinalMsg): msg is ClassifiedAsrFinal {
  return "captureMode" in msg && "recognitionOutcome" in msg;
}

export const turnTextLegacySchema = z.strictObject({
  t: z.literal("turn.text"),
  sessionId: idSchema,
  turnId: idSchema,
  text: z.string().min(1),
  typed: z.literal(true)
});

export const turnTextReceiptSchema = z.strictObject({
  t: z.literal("turn.text"),
  sessionId: idSchema,
  turnId: idSchema,
  text: z.string().min(1),
  typed: z.literal(true),
  receiptAction: receiptActionSchema,
  daemonEpoch: idOf("evt")
});

export const turnTextMsgSchema = z.union([turnTextReceiptSchema, turnTextLegacySchema]);
export type TurnTextMsg = z.infer<typeof turnTextMsgSchema>;

export const turnTextResultSchema = z.union([
  z.strictObject({
    t: z.literal("turn.text.result"),
    sessionId: idSchema,
    turnId: idSchema,
    outcome: z.literal("accepted")
  }),
  z.strictObject({
    t: z.literal("turn.text.result"),
    sessionId: idSchema,
    turnId: idSchema,
    outcome: z.literal("rejected"),
    code: z.string().min(1),
    retryable: z.boolean()
  }),
  z.strictObject({
    t: z.literal("turn.text.result"),
    sessionId: idSchema,
    turnId: idSchema,
    outcome: z.literal("unknown"),
    retryable: z.literal(false)
  })
]);
export type TurnTextResult = z.infer<typeof turnTextResultSchema>;

export const voiceAnchorStatusSchema = z.union([
  z.strictObject({
    t: z.literal("voice.anchor_status"),
    sessionId: idSchema,
    requestId: idOf("evt"),
    status: z.literal("prepared"),
    emptyRound: emptyRoundSchema.optional()
  }),
  z.strictObject({
    t: z.literal("voice.anchor_status"),
    sessionId: idSchema,
    requestId: idOf("evt"),
    status: z.literal("rearmed")
  }),
  z.strictObject({
    t: z.literal("voice.anchor_status"),
    sessionId: idSchema,
    requestId: idOf("evt"),
    status: z.literal("rejected"),
    code: z.literal("voice_audio_unknown"),
    retryable: z.literal(true),
    unknownEpochs: discardUnknownEpochsSchema.min(1)
  }),
  z
    .strictObject({
      t: z.literal("voice.anchor_status"),
      sessionId: idSchema,
      requestId: idOf("evt"),
      status: z.literal("rejected"),
      code: z.string().min(1),
      retryable: z.boolean()
    })
    .refine((msg) => msg.code !== "voice_audio_unknown")
]);
export type VoiceAnchorStatus = z.infer<typeof voiceAnchorStatusSchema>;

export const voiceQuiescedSchema = z.union([
  z.strictObject({
    t: z.literal("voice.quiesced"),
    sessionId: idSchema,
    requestId: idOf("evt"),
    epoch: pipelineEpochSchema,
    classified: z.literal(true),
    emptyRound: emptyRoundSchema.optional()
  }),
  z.strictObject({
    t: z.literal("voice.quiesced"),
    sessionId: idSchema,
    requestId: idOf("evt"),
    epoch: pipelineEpochSchema,
    classified: z.literal(false),
    code: z.literal("voice_recognition_failed")
  })
]);
export type VoiceQuiesced = z.infer<typeof voiceQuiescedSchema>;

const uniqueTSchema = z.discriminatedUnion("t", [
  z.strictObject({ t: z.literal("audio.frame"), sessionId: idSchema, seq: z.number().int().nonnegative() }),
  z.strictObject({
    t: z.literal("asr.partial"),
    sessionId: idSchema,
    turnId: idSchema,
    text: z.string(),
    confidence: asrFinalConfidence
  }),
  z.strictObject({
    t: z.literal("tts.say"),
    sessionId: idSchema,
    sentenceId: z.string().min(1),
    text: z.string(),
    interruptible: z.boolean()
  }),
  z.strictObject({
    t: z.literal("native.reply"),
    sessionId: idSchema,
    turnId: z.string().min(1),
    sentenceId: z.string().min(1),
    text: z.string(),
    origin: nativeReplyOriginSchema
  }),
  z.strictObject({
    t: z.literal("tts.playout"),
    sessionId: idSchema,
    sentenceId: z.string().min(1),
    watermarkMs: z.number().nonnegative()
  }),
  z.strictObject({
    t: z.literal("barge_in"),
    sessionId: idSchema,
    atMs: z.number().nonnegative(),
    truncatedSentenceId: z.string().min(1)
  }),
  z
    .strictObject({
      t: z.literal("turn.done_speaking"),
      sessionId: idSchema,
      holdForConfirm: z.literal(true).optional(),
      captureId: idOf("evt").optional(),
      captureIntent: captureIntentSchema.optional(),
      captureMode: z.literal("hands_free").optional()
    })
    .superRefine((val, ctx) => {
      if (val.captureMode !== "hands_free") return;
      if (val.captureId !== undefined || val.captureIntent !== undefined || val.holdForConfirm !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "HF done_speaking forbids captureId/captureIntent/holdForConfirm"
        });
      }
    }),
  z.strictObject({ t: z.literal("turn.listen_again"), sessionId: idSchema }),
  z.strictObject({
    t: z.literal("voice.mode"),
    sessionId: idSchema,
    mode: z.enum(["ptt", "hands_free"]),
    quiesceRequestId: idOf("evt").optional()
  }),
  z.strictObject({
    t: z.literal("vad.speech"),
    sessionId: idSchema,
    phase: z.enum(["start", "end"]),
    hfSegmentId: idOf("evt").optional(),
    hfRoundId: idOf("evt").optional(),
    recordSeq: hfRecordSeqSchema.optional()
  }),
  z.strictObject({
    t: z.literal("confirm.card"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    text: z.string(),
    kind: z.string(),
    digest: z.string().min(1),
    digestVersion: z.number().int().positive(),
    packageId: idSchema.optional(),
    revision: z.number().int().positive().optional(),
    taskId: idSchema.optional()
  }),
  z.strictObject({
    t: z.literal("confirm.countdown"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    ms: z.number().positive()
  }),
  z.strictObject({
    t: z.literal("confirm.resolved"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    outcome: confirmResolvedOutcomeSchema
  }),
  z.strictObject({
    t: z.literal("focus.entity"),
    sessionId: idSchema,
    entity: z.strictObject({
      id: z.string().min(1),
      kind: z.string().min(1),
      title: z.string(),
      sub: z.string(),
      color: z.string().min(1),
      at: z.string().min(1)
    })
  }),
  z.strictObject({
    t: z.literal("confirm.click"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    digest: z.string().min(1),
    decision: z.enum(["accept", "reject"])
  }),
  z.strictObject({
    t: z.literal("confirm.decision"),
    sessionId: idSchema,
    receiptId: z.string().min(1),
    decision: z.enum(["accept", "reject", "withdraw"])
  }),
  z.strictObject({
    t: z.literal("session.project"),
    sessionId: idSchema,
    projectId: idSchema,
    projectRevision: z.number().int().nonnegative(),
    reason: z.enum(["draft_created", "workspace_adopted", "draft_reanchored", "migration_snapshot"])
  }),
  z.strictObject({
    t: z.literal("latency.stage"),
    sessionId: idSchema,
    turnId: idSchema,
    stage: z.enum(["vad_end", "asr_final", "llm_first_token", "tts_first_byte", "playout_start"]),
    atMs: z.number().nonnegative()
  }),
  z.strictObject({
    t: z.literal("asr.hotwords"),
    words: z.array(z.string().min(1)).max(1000)
  }),
  z.strictObject({
    t: z.literal("pipeline.health"),
    asr: z.enum(["ok", "degraded", "down"]),
    tts: z.enum(["ok", "degraded", "down"]),
    identity: runtimeIdentitySchema,
    stateRootDigest: z.string().regex(/^[0-9a-f]{64}$/),
    generation: z.number().int().nonnegative().optional()
  }),
  z.strictObject({
    t: z.literal("pipeline.restart_pending"),
    generation: z.number().int().nonnegative()
  }),
  z.strictObject({
    t: z.literal("pipeline.restart_ack"),
    generation: z.number().int().nonnegative()
  }),
  z.strictObject({
    t: z.literal("screen_text"),
    sessionId: idSchema,
    turnId: idSchema,
    text: z.string()
  }),
  z.strictObject({
    t: z.literal("console.heartbeat"),
    sessionId: idSchema,
    atMs: z.number().nonnegative()
  }),
  z.strictObject({
    t: z.literal("voice.anchor_prepare"),
    sessionId: idSchema,
    requestId: idOf("evt"),
    focusId: idSchema,
    laneTitle: z.string().optional(),
    daemonEpoch: idOf("evt"),
    discardUnknownEpochs: discardUnknownEpochsSchema.optional()
  }),
  z.strictObject({
    t: z.literal("voice.quiesce"),
    sessionId: idSchema,
    requestId: idOf("evt"),
    epoch: pipelineEpochSchema,
    discardUnknownEpochs: discardUnknownEpochsSchema.optional()
  }),
  z.strictObject({
    t: z.literal("voice.quiesced_transcript"),
    sessionId: idSchema,
    requestId: idOf("evt"),
    turnId: idSchema,
    text: z.string().min(1),
    captureMode: captureModeSchema,
    captureId: idOf("evt").optional(),
    captureIntent: z.enum(["send", "edit"]).optional(),
    sourceFocusId: idSchema.optional()
  }),
  z.strictObject({
    t: z.literal("voice.quiesced_transcript_ack"),
    sessionId: idSchema,
    requestId: idOf("evt"),
    turnId: idSchema
  })
]);

export const pipelineMsgSchema = z
  .union([
    asrFinalMsgSchema,
    turnTextMsgSchema,
    turnTextResultSchema,
    voiceAnchorStatusSchema,
    voiceQuiescedSchema,
    uniqueTSchema
  ])
  .superRefine((msg, ctx) => {
    if (msg.t !== "vad.speech") return;
    const present = [msg.hfSegmentId, msg.hfRoundId, msg.recordSeq].filter((item) => item !== undefined).length;
    if (present !== 0 && present !== 3) {
      ctx.addIssue({ code: "custom", message: "vad.speech 的 hfSegmentId/hfRoundId/recordSeq 必须同时出现" });
    }
  });
export type PipelineMsg = z.infer<typeof pipelineMsgSchema>;

export function parsePipelineInbound(raw: unknown): PipelineMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.t === "asr.final") return parseAsrFinal(rec);
  const parsed = pipelineMsgSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export {
  captureIntentSchema,
  captureModeSchema,
  recognitionOutcomeSchema,
  receiptActionSchema
};
