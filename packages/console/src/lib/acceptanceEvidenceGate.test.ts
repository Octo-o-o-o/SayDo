import { describe, expect, it } from "vitest";
import { acceptanceApprovalBlocked, judgeAcceptanceCheck } from "./acceptanceEvidenceGate";

describe("验收引用必须有成功解析回执", () => {
  for (const status of ["pass", "fail", "unknown"] as const) {
    it.each([undefined, { ok: false, reason: "new_failure_reason" }, { ok: false, reason: "digest_mismatch" }])(`${status} 缺证只标 unknown 且拦批准`, (resolved) => {
      const check = { source: "manual", status, evidenceRef: "verify:ref" };
      expect(judgeAcceptanceCheck(check, resolved)).toEqual({ status: "unknown", boundInvalid: true });
      expect(acceptanceApprovalBlocked([check], resolved ? [{ evidenceRef: "verify:ref", ...resolved }] : [])).toBe(true);
    });
    it(`${status} 有效引用保留逐条状态`, () => {
      expect(judgeAcceptanceCheck({ source: "verify", status, evidenceRef: "verify:ref" }, { ok: true })).toEqual({ status, boundInvalid: false });
    });
  }
});

// 本轮终态冲突不依赖 checks 或 evidenceRef；旧 run 冲突不传染当前 run。
describe("最新执行终态决定能否批准", () => {
  const manual = [{ source: "manual", status: "unknown" }];
  const gate = acceptanceApprovalBlocked;
  it.each([{checks:manual}, {checks:[]}, {checks:[{source:"agent_claim",status:"unknown"}]}])("当前冲突即使无引用也拦批准", ({checks}) => {
    expect(gate(checks, [], [{attempt:2,evidence_conflict:true}])).toBe(true);
  });
  it("较旧冲突不污染合法当前执行", () => {
    expect(gate(manual, [], [{attempt:1,evidence_conflict:true},{attempt:2,evidence_conflict:false}])).toBe(false);
  });
  it("缺旧终态审计兼容路径不因unknown被拒", () => {
    expect(gate(manual, [], [{attempt:1,evidence_conflict:false}])).toBe(false);
  });
});
