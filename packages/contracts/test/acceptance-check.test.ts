import { describe, expect, it } from "vitest";
import { acceptanceCheckSchema, acceptanceExactSetViolations } from "../src/index.js";

describe("AcceptanceCheck 证据闭环", () => {
  it("pass/fail 必须绑定非空 evidenceRef，unknown 可以不绑定", () => {
    expect(acceptanceCheckSchema.safeParse({ criterion: "lint", status: "unknown", source: "manual" }).success).toBe(true);
    expect(acceptanceCheckSchema.safeParse({ criterion: "lint", status: "pass", source: "verify" }).success).toBe(false);
    expect(acceptanceCheckSchema.safeParse({ criterion: "lint", status: "fail", source: "manual", evidenceRef: "  " }).success).toBe(false);
    expect(
      acceptanceCheckSchema.safeParse({ criterion: "lint", status: "pass", source: "verify", evidenceRef: "verify:lint" }).success
    ).toBe(true);
  });

  it("DecisionPackage 与 proof 双向 exact-set，对任一侧重复、漏项或幽灵项都拒绝", () => {
    expect(acceptanceExactSetViolations([{ criterion: "a" }, { criterion: "b" }], ["a", "b"])).toEqual([]);
    expect(acceptanceExactSetViolations([{ criterion: "a" }, { criterion: "a" }], ["a", "b"])).not.toEqual([]);
    expect(acceptanceExactSetViolations([{ criterion: "a" }, { criterion: "c" }], ["a", "b"])).not.toEqual([]);
    expect(acceptanceExactSetViolations([{ criterion: "a" }], ["a", "a"])).not.toEqual([]);
  });
});
