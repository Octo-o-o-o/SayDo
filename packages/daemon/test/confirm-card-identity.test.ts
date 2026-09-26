import { describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { confirmCardIdentityFromPayload } from "../src/live/confirm.js";

describe("confirmCardIdentityFromPayload", () => {
  it("dispatch 带 packageId+revision;任务锚只在 payload 已有 taskId", () => {
    const pkg = newId("pkg");
    expect(
      confirmCardIdentityFromPayload({ kind: "dispatch", packageId: pkg, revision: 3, mode: "step_confirm" })
    ).toEqual({ packageId: pkg, revision: 3 });
    expect(confirmCardIdentityFromPayload({ kind: "runtime_effect" })).toEqual({});
    expect(confirmCardIdentityFromPayload({ kind: "runtime_effect", taskId: "tsk_1" })).toEqual({ taskId: "tsk_1" });
  });
});
