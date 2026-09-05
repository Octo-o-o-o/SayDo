import { describe, expect, it } from "vitest";
import { REMOTE_MOBILE_PROBE_CODE, resolveSetupBootstrapState } from "./SetupBootstrapBoundary";

describe("SetupBootstrapBoundary 判定", () => {
  it("loading 未满 300ms 不闪 Loading", () => {
    expect(
      resolveSetupBootstrapState({
        loading: true,
        showLoading: false,
        probePresent: false,
        probeError: null,
        dialogReady: false,
        peeked: false
      })
    ).toBe("pending");
  });

  it("loading 超过 300ms 才显示品牌呼吸", () => {
    expect(
      resolveSetupBootstrapState({
        loading: true,
        showLoading: true,
        probePresent: false,
        probeError: null,
        dialogReady: false,
        peeked: false
      })
    ).toBe("loading");
  });

  it("probe 失败是第三态,不得当成已配好", () => {
    expect(
      resolveSetupBootstrapState({
        loading: false,
        showLoading: false,
        probePresent: false,
        probeError: "Failed to fetch",
        dialogReady: false,
        peeked: false
      })
    ).toBe("probe-error");
    expect(
      resolveSetupBootstrapState({
        loading: false,
        showLoading: false,
        probePresent: false,
        probeError: "Failed to fetch",
        dialogReady: true,
        peeked: true
      })
    ).toBe("probe-error");
  });

  it("未配好且未 peek 直接向导", () => {
    expect(
      resolveSetupBootstrapState({
        loading: false,
        showLoading: false,
        probePresent: true,
        probeError: null,
        dialogReady: false,
        peeked: false
      })
    ).toBe("wizard");
  });

  it("LAN probe 精确码进 remote-mobile,未 peek 也不进向导", () => {
    expect(
      resolveSetupBootstrapState({
        loading: false,
        showLoading: false,
        probePresent: false,
        probeError: "访问凭证已失效",
        probeErrorCode: REMOTE_MOBILE_PROBE_CODE,
        dialogReady: false,
        peeked: false
      })
    ).toBe("remote-mobile");
  });

  it("已 peek 的 LAN 精确码仍进 remote-mobile,不得落到 app", () => {
    expect(
      resolveSetupBootstrapState({
        loading: false,
        showLoading: false,
        probePresent: false,
        probeError: "访问凭证已失效",
        probeErrorCode: REMOTE_MOBILE_PROBE_CODE,
        dialogReady: false,
        peeked: true
      })
    ).toBe("remote-mobile");
  });

  it("token_mismatch/origin_rejected/host_rejected/setup_local_only/remote_business_forbidden 仍停错误卡", () => {
    const blocked = [
      "token_mismatch",
      "origin_rejected",
      "host_rejected",
      "setup_local_only",
      "remote_business_forbidden"
    ] as const;
    for (const code of blocked) {
      expect(
        resolveSetupBootstrapState({
          loading: false,
          showLoading: false,
          probePresent: false,
          probeError: "访问凭证已失效",
          probeErrorCode: code,
          dialogReady: false,
          peeked: true
        })
      ).toBe("probe-error");
    }
  });

  it("已配好或已 peek 才进应用", () => {
    expect(
      resolveSetupBootstrapState({
        loading: false,
        showLoading: false,
        probePresent: true,
        probeError: null,
        dialogReady: true,
        peeked: false
      })
    ).toBe("app");
    expect(
      resolveSetupBootstrapState({
        loading: false,
        showLoading: false,
        probePresent: true,
        probeError: null,
        dialogReady: false,
        peeked: true
      })
    ).toBe("app");
  });
});
