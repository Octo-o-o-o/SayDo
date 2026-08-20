import {
  RUNTIME_PROTOCOL_VERSION,
  runtimeProtocolCompatible,
  type RuntimeIdentity,
  type RuntimeReadiness,
  type VoiceReadinessReason
} from "@saydo/contracts";

export interface PipelineRuntimeState {
  connected: boolean;
  /** 旧 pipeline 诊断字段;不再与 daemon sourceRevision 比等。 */
  runtimeSha: string | null;
  protocolVersion: string | null;
  stateRootDigest: string | null;
  lastHealthAtMs: number;
  asr: "ok" | "degraded" | "down";
  tts: "ok" | "degraded" | "down";
}

export interface RuntimeIdentityInput {
  daemonIdentity: RuntimeIdentity;
  daemonStateRootDigest: string;
  pipeline: PipelineRuntimeState;
  nowMs: number;
  maxHealthAgeMs: number;
  coreReady: boolean;
}

export function pipelineRuntimeJoined(
  runtimeSha: string,
  protocolVersion = RUNTIME_PROTOCOL_VERSION
): PipelineRuntimeState {
  return {
    connected: true,
    runtimeSha,
    protocolVersion,
    stateRootDigest: null,
    lastHealthAtMs: 0,
    asr: "down",
    tts: "down"
  };
}

export function pipelineRuntimeForReadiness(
  pipeline: PipelineRuntimeState,
  transportAvailable: boolean
): PipelineRuntimeState {
  return transportAvailable
    ? pipeline
    : { ...pipeline, connected: false, asr: "down", tts: "down" };
}

function voiceReason(input: RuntimeIdentityInput): { reason: VoiceReadinessReason; healthAgeMs: number } {
  const healthAgeMs = input.nowMs - input.pipeline.lastHealthAtMs;
  if (!input.pipeline.connected) return { reason: "pipeline_absent", healthAgeMs };
  if (
    input.pipeline.protocolVersion === null ||
    !runtimeProtocolCompatible(input.daemonIdentity.protocolVersion, input.pipeline.protocolVersion)
  ) {
    return { reason: "protocol_mismatch", healthAgeMs };
  }
  if (input.pipeline.stateRootDigest !== input.daemonStateRootDigest) {
    return { reason: "home_mismatch", healthAgeMs };
  }
  if (healthAgeMs < 0 || healthAgeMs > input.maxHealthAgeMs) {
    return { reason: "health_stale", healthAgeMs };
  }
  if (input.pipeline.asr !== "ok") return { reason: "asr_unavailable", healthAgeMs };
  if (input.pipeline.tts !== "ok") return { reason: "tts_unavailable", healthAgeMs };
  return { reason: "ready", healthAgeMs };
}

export function assessRuntimeIdentity(
  input: RuntimeIdentityInput
): RuntimeReadiness & { ok: boolean; healthAgeMs: number } {
  const { reason, healthAgeMs } = voiceReason(input);
  const voiceReady = reason === "ready";
  return {
    version: 1,
    ok: input.coreReady,
    coreReady: input.coreReady,
    voiceReady,
    voice: { enabled: voiceReady, reason },
    healthAgeMs
  };
}

export function assessRuntimeReadiness(
  input: RuntimeIdentityInput,
  transportAvailable: boolean
): RuntimeReadiness & { ok: boolean; healthAgeMs: number; pipeline: PipelineRuntimeState } {
  const pipeline = pipelineRuntimeForReadiness(input.pipeline, transportAvailable);
  return { ...assessRuntimeIdentity({ ...input, pipeline }), pipeline };
}
