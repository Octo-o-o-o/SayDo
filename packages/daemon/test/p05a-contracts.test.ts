// 保留的 Hopper 数据契约：A3 幂等锚、retryability 与 CancelProof/RunSettled。

import { describe, expect, it } from "vitest";
import {
  buildDispatchComment,
  hopperCancelProofSchema,
  MUTATION_RETRYABILITY,
  parseDispatchComment,
  runSettledSchema
} from "@saydo/contracts";

const NOW = new Date("2026-07-25T06:00:00.000Z");

describe("A3 跨域 exactly-once(幂等锚 + MutationResult retryability)", () => {
  it("dispatch 注释行 build/parse 往返;畸形返回 null", () => {
    const line = buildDispatchComment("dsp_01AAAAAAAAAAAAAAAAAAAAAAAA", 2, "sha256:" + "a".repeat(64));
    const parsed = parseDispatchComment(line);
    expect(parsed).toEqual({ dispatchId: "dsp_01AAAAAAAAAAAAAAAAAAAAAAAA", revision: 2, digest: "sha256:" + "a".repeat(64) });
    expect(parseDispatchComment("<!-- 其它注释 -->")).toBeNull();
    expect(parseDispatchComment("saydo:dispatch x rev=1")).toBeNull();
  });

  it("retryability:expired=对账(≠失败);conflict=先重读;failed 才盲重试;applied/duplicate 不重发", () => {
    expect(MUTATION_RETRYABILITY.expired).toBe("reconcile");
    expect(MUTATION_RETRYABILITY.conflict).toBe("reread_then_decide");
    expect(MUTATION_RETRYABILITY.failed).toBe("retry");
    expect(MUTATION_RETRYABILITY.applied).toBe("no");
    expect(MUTATION_RETRYABILITY.duplicate).toBe("no");
  });
});

describe("CancelProof 与 RunSettled 合同", () => {
  it("CancelProof:cancel settled 判据 = RunSettled 出现(recovery 兜底同构);缺 RunSettled ⇒ schema 拒", () => {
    const ok = hopperCancelProofSchema.safeParse({
      taskId: "hopper-task-1",
      runSettled: { final_status: "failed", recovery: true },
      lastEventId: "evt-99",
      settledAt: NOW.toISOString()
    });
    expect(ok.success).toBe(true);
    const bad = hopperCancelProofSchema.safeParse({ taskId: "t", lastEventId: "e", settledAt: NOW.toISOString() });
    expect(bad.success).toBe(false);
    // RunSettled payload 词表:final_status 只认三值
    expect(runSettledSchema.safeParse({ final_status: "done" }).success).toBe(false);
  });
});
