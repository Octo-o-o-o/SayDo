import { describe, expect, it } from "vitest";
import { RECONNECT_COALESCE_MS, shouldFireReconnect } from "./reconnectPolicy";

describe("shouldFireReconnect", () => {
  it("健康 OPEN 的 visibility 不拆连接", () => {
    expect(
      shouldFireReconnect({
        trigger: "visibility",
        wsOpen: true,
        nowMs: 1_000,
        lastFiredAtMs: null
      })
    ).toEqual({ fire: false, nextLastFiredAtMs: null });
  });

  it("非 OPEN 的 visibility 立即重连", () => {
    expect(
      shouldFireReconnect({
        trigger: "visibility",
        wsOpen: false,
        nowMs: 1_000,
        lastFiredAtMs: null
      })
    ).toEqual({ fire: true, nextLastFiredAtMs: 1_000 });
  });

  it("native-resume 在 OPEN 时仍强制重连(iOS 僵尸 OPEN)", () => {
    expect(
      shouldFireReconnect({
        trigger: "native-resume",
        wsOpen: true,
        nowMs: 1_000,
        lastFiredAtMs: null
      }).fire
    ).toBe(true);
  });

  it("短窗口内连发只响一次", () => {
    const first = shouldFireReconnect({
      trigger: "manual",
      wsOpen: false,
      nowMs: 5_000,
      lastFiredAtMs: null
    });
    const second = shouldFireReconnect({
      trigger: "native-resume",
      wsOpen: true,
      nowMs: 5_000 + RECONNECT_COALESCE_MS - 1,
      lastFiredAtMs: first.nextLastFiredAtMs
    });
    expect(first.fire).toBe(true);
    expect(second.fire).toBe(false);
    expect(second.nextLastFiredAtMs).toBe(5_000);
  });

  it("健康 OPEN 的 visibility 不占用短窗口", () => {
    const skipped = shouldFireReconnect({
      trigger: "visibility",
      wsOpen: true,
      nowMs: 1_000,
      lastFiredAtMs: null
    });
    expect(skipped.fire).toBe(false);
    expect(
      shouldFireReconnect({
        trigger: "native-resume",
        wsOpen: true,
        nowMs: 1_001,
        lastFiredAtMs: skipped.nextLastFiredAtMs
      }).fire
    ).toBe(true);
  });

  it("窗口过后允许再响", () => {
    expect(
      shouldFireReconnect({
        trigger: "manual",
        wsOpen: false,
        nowMs: 5_000 + RECONNECT_COALESCE_MS,
        lastFiredAtMs: 5_000
      }).fire
    ).toBe(true);
  });
});
