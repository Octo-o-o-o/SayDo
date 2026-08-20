import { describe, expect, it } from "vitest";
import {
  desktopSummaryV1Schema,
  runtimeIdentitySchema,
  runtimeOwnershipPayload,
  runtimeProtocolCompatible,
  runtimeReadinessSchema,
  supervisorFrameSchema
} from "../src/index.js";

const identity = {
  sourceRevision: "a".repeat(40),
  buildId: "0.0.1+aaaaaaaaaaaa",
  protocolVersion: "1.2.3"
};

describe("可分发 runtime 合同", () => {
  it("身份三元组与协议兼容只按 major 判定", () => {
    expect(runtimeIdentitySchema.parse(identity)).toEqual(identity);
    expect(runtimeProtocolCompatible("1.2.3", "1.9.0")).toBe(true);
    expect(runtimeProtocolCompatible("1.2.3", "2.0.0")).toBe(false);
  });

  it("ownership proof payload 绑定目标端口与 runtime identity", () => {
    const base = {
      nonce: "a".repeat(48),
      pid: 123,
      port: 47100,
      startedAt: "2026-08-12T00:00:00.000Z",
      stateRootDigest: "b".repeat(64),
      identity
    };
    expect(runtimeOwnershipPayload(base)).not.toBe(runtimeOwnershipPayload({ ...base, port: 47101 }));
  });

  it("core/voice readiness 分离", () => {
    expect(
      runtimeReadinessSchema.parse({
        version: 1,
        coreReady: true,
        voiceReady: false,
        voice: { enabled: false, reason: "pipeline_absent" }
      })
    ).toMatchObject({ coreReady: true, voiceReady: false });
  });

  it("supervisor 五类 IPC frame 均有版本化 schema", () => {
    const frames = [
      {
        v: 1,
        t: "ready",
        identity,
        port: 47100,
        stateRootDigest: "b".repeat(64),
        readiness: {
          version: 1,
          coreReady: true,
          voiceReady: false,
          voice: { enabled: false, reason: "pipeline_absent" }
        }
      },
      { v: 1, t: "prepareShutdown", reason: "app_quit" },
      { v: 1, t: "restartRequested", reason: "setup", generation: 1 },
      { v: 1, t: "stopped", reason: "app_quit", recoverableTier1: 1, abortedUnrecoverable: 2 },
      { v: 1, t: "fatal", code: "listen_failed", message: "bind failed" }
    ];
    expect(frames.map((frame) => supervisorFrameSchema.safeParse(frame).success)).toEqual([
      true,
      true,
      true,
      true,
      true
    ]);
  });

  it("desktop summary v1 固定 active-work、DND 与四色字段", () => {
    expect(
      desktopSummaryV1Schema.safeParse({
        version: 1,
        activeWork: { total: 3, recoverableTier1: 1, unrecoverableCalls: 2 },
        dnd: { enabled: true, active: false, window: "23:00-08:00" },
        attention: { orange: 1, blue: 2, green: 3, gray: 4 }
      }).success
    ).toBe(true);
  });
});
