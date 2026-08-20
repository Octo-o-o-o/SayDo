import { describe, expect, it } from "vitest";
import {
  assessRuntimeIdentity,
  assessRuntimeReadiness,
  pipelineRuntimeForReadiness,
  pipelineRuntimeJoined,
  type RuntimeIdentityInput
} from "../src/runtimeIdentity.js";

const NOW_MS = 10_000;
const SHA = "1".repeat(40);
const DIGEST = "a".repeat(64);
const IDENTITY = { sourceRevision: SHA, buildId: "test-build", protocolVersion: "1.0.0" };

function input(overrides: Partial<RuntimeIdentityInput["pipeline"]> = {}): RuntimeIdentityInput {
  return {
    daemonIdentity: IDENTITY,
    daemonStateRootDigest: DIGEST,
    pipeline: {
      connected: true,
      runtimeSha: SHA,
      protocolVersion: "1.0.0",
      stateRootDigest: DIGEST,
      lastHealthAtMs: NOW_MS - 1_000,
      asr: "ok",
      tts: "ok",
      ...overrides
    },
    nowMs: NOW_MS,
    maxHealthAgeMs: 45_000,
    coreReady: true
  };
}

describe("daemon/pipeline 运行时身份", () => {
  it("协议、状态根、健康时效与语音依赖全部一致时 core/voice 均 ready", () => {
    expect(assessRuntimeIdentity(input())).toMatchObject({
      ok: true,
      coreReady: true,
      voiceReady: true,
      voice: { enabled: true, reason: "ready" },
      healthAgeMs: 1_000
    });
  });

  it("状态根不一致只关闭 voice,不拖红 core", () => {
    expect(assessRuntimeIdentity(input({ stateRootDigest: "b".repeat(64) }))).toMatchObject({
      ok: true,
      coreReady: true,
      voiceReady: false,
      voice: { reason: "home_mismatch" }
    });
  });

  it("新 pipeline 入场清空上一 peer 的健康快照", () => {
    const joined = pipelineRuntimeJoined(SHA);
    expect(joined).toEqual({
      connected: true,
      runtimeSha: SHA,
      protocolVersion: "1.0.0",
      stateRootDigest: null,
      lastHealthAtMs: 0,
      asr: "down",
      tts: "down"
    });
    expect(assessRuntimeIdentity({ ...input(), pipeline: joined }).voiceReady).toBe(false);
  });

  it("pipeline 缺席时 core 仍绿且明确 voice 原因", () => {
    const staleHealthy = input().pipeline;
    const unavailable = assessRuntimeReadiness(input(), false);
    expect(unavailable).toMatchObject({
      ok: true,
      coreReady: true,
      voiceReady: false,
      voice: { reason: "pipeline_absent" },
      pipeline: { connected: false, asr: "down", tts: "down" }
    });
    expect(pipelineRuntimeForReadiness(staleHealthy, true)).toBe(staleHealthy);
    expect(assessRuntimeReadiness(input(), true).voiceReady).toBe(true);
  });

  it.each([
    ["协议不兼容", { protocolVersion: "2.0.0" }, "protocol_mismatch"],
    ["pipeline 未连接", { connected: false }, "pipeline_absent"],
    ["ASR 降级", { asr: "degraded" as const }, "asr_unavailable"],
    ["TTS 下线", { tts: "down" as const }, "tts_unavailable"]
  ])("%s 时只关闭 voice", (_label, overrides, reason) => {
    expect(assessRuntimeIdentity(input(overrides))).toMatchObject({
      coreReady: true,
      voiceReady: false,
      voice: { reason }
    });
  });

  it("健康时间戳过期或来自未来时 voice fail-closed", () => {
    expect(assessRuntimeIdentity(input({ lastHealthAtMs: NOW_MS - 45_001 })).voiceReady).toBe(false);
    expect(assessRuntimeIdentity(input({ lastHealthAtMs: NOW_MS + 1 })).voiceReady).toBe(false);
  });

  it("recovery-only 时 core 为红", () => {
    expect(assessRuntimeIdentity({ ...input(), coreReady: false }).ok).toBe(false);
  });
});
