// P0.5-A 契约封闭验收(09 §14):A2/A8 完整 presentation、A3 幂等/MutationResult、
// A4 total mapping + CancelProof、A7 模式x后端矩阵。每项正例 + 反例。

import { describe, expect, it } from "vitest";
import {
  buildDispatchComment,
  hopperCancelProofSchema,
  MUTATION_RETRYABILITY,
  parseDispatchComment,
  runSettledSchema
} from "@saydo/contracts";
import { SignedPresentationStore } from "../src/approvals/presentationFull.js";
import { isAutoExecutionForbidden, projectHopperStatus } from "../src/bridge/statusMapping.js";
import { assertModeSupported, modeSupport } from "../src/bridge/capabilityMatrix.js";

const NOW = new Date("2026-07-25T06:00:00.000Z");

function mkStore(now: Date = NOW): SignedPresentationStore {
  return new SignedPresentationStore(() => now);
}

const PAYLOAD = {
  project: "报表系统",
  task: "导出 CSV",
  effect: "跑数据库迁移",
  target: "reports 表",
  downstream: ["回填缓存"],
  expiry: "2026-07-25T06:02:00.000Z"
};
const RCP = "apr_01AAAAAAAAAAAAAAAAAAAAAAAA";

describe("A2/A8 完整 presentation(E2 签名 + per-subject CAS)", () => {
  it("正例:present -> heard -> consume 成功;nonce 单次(二次消费拒)", () => {
    const store = mkStore();
    const r = store.present({ subject: RCP, receiptId: RCP, payload: PAYLOAD, sentenceId: "s1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.presentation.digest).toMatch(/^sha256:/);
    store.markHeard(RCP, "s1");
    expect(store.consume(RCP, { digest: r.presentation.digest, receiptId: RCP }).ok).toBe(true);
    const again = store.consume(RCP, { digest: r.presentation.digest, receiptId: RCP });
    expect(again.ok).toBe(false); // nonce 单次
  });

  it("反例:未 heard 不可消费(unheard 不作已告知)", () => {
    const store = mkStore();
    const r = store.present({ subject: RCP, receiptId: RCP, payload: PAYLOAD, sentenceId: "s1" });
    if (!r.ok) throw new Error("present failed");
    const c = store.consume(RCP, { digest: r.presentation.digest, receiptId: RCP });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain("未播完");
  });

  it("反例:barge-in 作废后裸肯定不消费;重播换 nonce ⇒ 新 digest 才可消费", () => {
    const store = mkStore();
    const r1 = store.present({ subject: RCP, receiptId: RCP, payload: PAYLOAD, sentenceId: "s1" });
    if (!r1.ok) throw new Error("present failed");
    store.markHeard(RCP, "s1");
    store.invalidateOnBargeIn(RCP);
    expect(store.consume(RCP, { digest: r1.presentation.digest, receiptId: RCP }).ok).toBe(false);
    // 重播:CAS 显式替换(携当前活跃 id)
    const r2 = store.present({ subject: RCP, receiptId: RCP, payload: PAYLOAD, sentenceId: "s2", expectedActiveId: r1.presentation.id });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.presentation.digest).not.toBe(r1.presentation.digest); // 新 nonce ⇒ 新 digest
    store.markHeard(RCP, "s2");
    expect(store.consume(RCP, { digest: r2.presentation.digest, receiptId: RCP }).ok).toBe(true);
  });

  it("反例:per-subject CAS——已有活跃 presentation 时不携/错携 expectedActiveId ⇒ 拒", () => {
    const store = mkStore();
    const r1 = store.present({ subject: RCP, receiptId: RCP, payload: PAYLOAD, sentenceId: "s1" });
    expect(r1.ok).toBe(true);
    const r2 = store.present({ subject: RCP, receiptId: RCP, payload: PAYLOAD, sentenceId: "s2" });
    expect(r2.ok).toBe(false); // 不携 CAS
    const r3 = store.present({ subject: RCP, receiptId: RCP, payload: PAYLOAD, sentenceId: "s2", expectedActiveId: "psn-wrong" });
    expect(r3.ok).toBe(false); // 错携
  });

  it("反例:digest 不匹配(所闻非所签)/过期 ⇒ 拒;A8 golden:全程零收据/包/工具状态变化(纯内存 store)", () => {
    const store = mkStore();
    const r = store.present({ subject: RCP, receiptId: RCP, payload: PAYLOAD, sentenceId: "s1" });
    if (!r.ok) throw new Error("present failed");
    store.markHeard(RCP, "s1");
    expect(store.consume(RCP, { digest: "sha256:" + "f".repeat(64), receiptId: RCP }).ok).toBe(false);
    // 过期:expiry 已过
    const late = new SignedPresentationStore(() => new Date("2026-07-25T06:03:00.000Z"));
    const r2 = late.present({ subject: RCP, receiptId: RCP, payload: PAYLOAD, sentenceId: "s1" });
    if (!r2.ok) throw new Error("present failed");
    late.markHeard(RCP, "s1");
    const c = late.consume(RCP, { digest: r2.presentation.digest, receiptId: RCP });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain("过期");
  });
});

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

describe("A4 total mapping + CancelProof", () => {
  it("14 值枚举全覆盖(逐值投影不抛)", () => {
    const states = ["received", "ready", "draft", "plan_needed", "research", "deferred", "conflict", "blocked", "running", "review", "done", "failed", "rejected", "archived"] as const;
    for (const s of states) {
      const p = projectHopperStatus({ task: s });
      expect(p.status, s).toBeTruthy();
    }
  });

  it("裁决语义:review+approved 四字段匹配 ⇒ waiting_merge;settle 未过 ⇒ 不说等你验收;排队只许 ready", () => {
    expect(projectHopperStatus({ task: "review", approvedBindingMatch: true }).status).toBe("review_approved_waiting_merge");
    const pending = projectHopperStatus({ task: "review", settleOk: false });
    expect(pending.status).toBe("running_pending_settle");
    expect(pending.userPhrase).not.toContain("等你验收");
    expect(projectHopperStatus({ task: "review", settleOk: true }).status).toBe("ready_for_review");
    // 分诊出口不许说排队
    expect(projectHopperStatus({ task: "draft" }).userPhrase).not.toContain("排队");
    expect(projectHopperStatus({ task: "ready", queueExecutable: true }).userPhrase).toContain("排队");
  });

  it("conflict 双来源分流(B4):merge 来源 ⇒ merge_failed;triage 来源 ⇒ blocked 疑似重复", () => {
    expect(projectHopperStatus({ task: "conflict", conflictSource: "merge" }).status).toBe("merge_failed");
    expect(projectHopperStatus({ task: "conflict", conflictSource: "triage" }).status).toBe("blocked");
    expect(projectHopperStatus({ task: "conflict" }).status).toBe("blocked"); // 缺省按 triage(保守)
  });

  it("红线:ready∧high ⇒ blocked 且禁自动执行(含 retry);failed+cancelled_by_user ⇒ cancel_settled", () => {
    const high = projectHopperStatus({ task: "ready", riskHigh: true });
    expect(high.status).toBe("blocked");
    expect(isAutoExecutionForbidden({ task: "ready", riskHigh: true })).toBe(true);
    expect(isAutoExecutionForbidden({ task: "ready" })).toBe(false);
    expect(projectHopperStatus({ task: "failed", lastReason: "cancelled_by_user" }).status).toBe("cancel_settled");
    expect(projectHopperStatus({ task: "failed", lastReason: "oom" }).status).toBe("failed");
  });

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

describe("A7 模式x后端矩阵(04 §5.4 SoT)", () => {
  it("hopper step_confirm=unsupported(带话术要点,fail-closed 拒派);direct_to_review=支持;tier1 双支持", () => {
    expect(modeSupport("hopper", "step_confirm").supported).toBe(false);
    const a = assertModeSupported("hopper", "step_confirm");
    expect(a.ok).toBe(false);
    expect(a.fallbackPhrase).toContain("不支持每步问你");
    expect(assertModeSupported("hopper", "direct_to_review").ok).toBe(true);
    expect(assertModeSupported("tier1", "step_confirm").ok).toBe(true);
    expect(assertModeSupported("tier1", "direct_to_review").ok).toBe(true);
    expect(modeSupport("hopper", "direct_to_review").switchSemantics).toBe("cancel_new_run");
  });
});
