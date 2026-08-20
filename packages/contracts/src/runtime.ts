import { z } from "zod";

export const RUNTIME_PROTOCOL_VERSION = "1.0.0";

export const runtimeIdentitySchema = z.strictObject({
  sourceRevision: z.string().regex(/^[0-9a-f]{7,64}$/),
  buildId: z.string().min(1).max(128),
  protocolVersion: z.string().regex(/^\d+\.\d+\.\d+$/)
});
export type RuntimeIdentity = z.infer<typeof runtimeIdentitySchema>;

export const runtimeOwnershipProofSchema = z.strictObject({
  version: z.literal(1),
  nonce: z.string().regex(/^[0-9a-f]{32,128}$/),
  mac: z.string().regex(/^[0-9a-f]{64}$/)
});
export type RuntimeOwnershipProof = z.infer<typeof runtimeOwnershipProofSchema>;

/** ownership challenge 的跨进程 canonical 字节串；HMAC key 只存在于目标 HOME。 */
export function runtimeOwnershipPayload(input: {
  nonce: string;
  pid: number;
  port: number;
  startedAt: string;
  stateRootDigest: string;
  identity: RuntimeIdentity;
}): string {
  return JSON.stringify([
    1,
    input.nonce,
    input.pid,
    input.port,
    input.startedAt,
    input.stateRootDigest,
    input.identity.sourceRevision,
    input.identity.buildId,
    input.identity.protocolVersion
  ]);
}

export const voiceReadinessReasonSchema = z.enum([
  "ready",
  "pipeline_absent",
  "protocol_mismatch",
  "home_mismatch",
  "health_stale",
  "asr_unavailable",
  "tts_unavailable"
]);
export type VoiceReadinessReason = z.infer<typeof voiceReadinessReasonSchema>;

export const runtimeReadinessSchema = z.strictObject({
  version: z.literal(1),
  coreReady: z.boolean(),
  voiceReady: z.boolean(),
  voice: z.strictObject({
    enabled: z.boolean(),
    reason: voiceReadinessReasonSchema
  })
});
export type RuntimeReadiness = z.infer<typeof runtimeReadinessSchema>;

export const desktopSummaryV1Schema = z.strictObject({
  version: z.literal(1),
  activeWork: z.strictObject({
    total: z.number().int().nonnegative(),
    recoverableTier1: z.number().int().nonnegative(),
    unrecoverableCalls: z.number().int().nonnegative()
  }),
  dnd: z.strictObject({
    enabled: z.boolean(),
    active: z.boolean(),
    window: z.string().nullable()
  }),
  attention: z.strictObject({
    orange: z.number().int().nonnegative(),
    blue: z.number().int().nonnegative(),
    green: z.number().int().nonnegative(),
    gray: z.number().int().nonnegative()
  })
});
export type DesktopSummaryV1 = z.infer<typeof desktopSummaryV1Schema>;

export const prepareShutdownReasonSchema = z.enum([
  "cli_sigint",
  "app_quit",
  "restart",
  "supervisor_stop"
]);
export type PrepareShutdownReason = z.infer<typeof prepareShutdownReasonSchema>;

export const supervisorFrameSchema = z.discriminatedUnion("t", [
  z.strictObject({
    v: z.literal(1),
    t: z.literal("ready"),
    identity: runtimeIdentitySchema,
    port: z.number().int().min(1).max(65_535),
    stateRootDigest: z.string().regex(/^[0-9a-f]{64}$/),
    readiness: runtimeReadinessSchema
  }),
  z.strictObject({
    v: z.literal(1),
    t: z.literal("prepareShutdown"),
    reason: prepareShutdownReasonSchema
  }),
  z.strictObject({
    v: z.literal(1),
    t: z.literal("restartRequested"),
    reason: z.string().min(1).max(200),
    generation: z.number().int().nonnegative().optional()
  }),
  z.strictObject({
    v: z.literal(1),
    t: z.literal("stopped"),
    reason: z.string().min(1).max(200),
    recoverableTier1: z.number().int().nonnegative(),
    abortedUnrecoverable: z.number().int().nonnegative()
  }),
  z.strictObject({
    v: z.literal(1),
    t: z.literal("fatal"),
    code: z.string().min(1).max(100),
    message: z.string().min(1).max(500)
  })
]);
export type SupervisorFrame = z.infer<typeof supervisorFrameSchema>;

export function runtimeProtocolCompatible(a: string, b: string): boolean {
  const aMajor = /^(\d+)\./.exec(a)?.[1];
  const bMajor = /^(\d+)\./.exec(b)?.[1];
  return aMajor !== undefined && aMajor === bMajor;
}
