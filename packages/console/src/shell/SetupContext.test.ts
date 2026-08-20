import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/apiError";
import { probeFailureFromCaught } from "./SetupContext";

describe("probeFailureFromCaught", () => {
  it("保留 ApiError.code,不靠人话文案", () => {
    const err = new ApiError("访问凭证已失效", {
      kind: "auth",
      retryable: false,
      code: "mobile_lan_route_rejected",
      status: 403
    });
    expect(probeFailureFromCaught(err)).toEqual({
      message: "访问凭证已失效",
      code: "mobile_lan_route_rejected"
    });
  });

  it("token_mismatch 同样抽出 code", () => {
    const err = new ApiError("访问凭证已失效", {
      kind: "auth",
      retryable: false,
      code: "token_mismatch",
      status: 403
    });
    expect(probeFailureFromCaught(err).code).toBe("token_mismatch");
  });

  it("网络层 Error 没有 code", () => {
    expect(probeFailureFromCaught(new Error("Failed to fetch"))).toEqual({
      message: "Failed to fetch",
      code: null
    });
  });
});
