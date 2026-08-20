import { describe, expect, it } from "vitest";
import {
  ProcessGroupLifecycleError,
  asProcessGroupLifecycleError,
  isProcessGroupLifecycleError
} from "../src/processGroupLifecycle.js";

describe("A1 process group lifecycle error", () => {
  it("识别进程组未 ESRCH 错误并禁止降格为普通 Error", () => {
    const err = new ProcessGroupLifecycleError("agent process group 12345 did not exit");
    expect(isProcessGroupLifecycleError(err)).toBe(true);
    expect(isProcessGroupLifecycleError(new Error("agent process group 9 state unknown"))).toBe(true);
    expect(isProcessGroupLifecycleError(new Error("ordinary business failure"))).toBe(false);
    expect(asProcessGroupLifecycleError(new Error("owned process group still alive")).code).toBe(
      "process_group_not_reaped"
    );
  });
});
