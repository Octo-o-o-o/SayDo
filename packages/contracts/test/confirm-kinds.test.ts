// GAP-02 2.1:确认环 kind 单源(09 §15.1)——SEMANTIC 与 NON_SEMANTIC 不相交、并集 = CONFIRM_KINDS、schema 拒未知 kind。
import { describe, expect, it } from "vitest";
import {
  CONFIRM_KINDS,
  NON_SEMANTIC_CONFIRM_KINDS,
  SEMANTIC_MUTATION_KINDS,
  confirmKindSchema,
  isConfirmKind
} from "../src/index.js";

describe("确认环 kind 单源", () => {
  it("SEMANTIC 与 NON_SEMANTIC 不相交,并集与 CONFIRM_KINDS 全等且无重复", () => {
    const semantic = new Set<string>(SEMANTIC_MUTATION_KINDS);
    const nonSemantic = new Set<string>(NON_SEMANTIC_CONFIRM_KINDS);
    for (const k of semantic) expect(nonSemantic.has(k)).toBe(false);
    expect(new Set(CONFIRM_KINDS).size).toBe(CONFIRM_KINDS.length);
    expect(new Set(CONFIRM_KINDS)).toEqual(new Set([...semantic, ...nonSemantic]));
  });

  it("固定成员:七个语义 kind + dispatch/runtime_effect/readiness/memory/project_anchor", () => {
    expect([...SEMANTIC_MUTATION_KINDS]).toEqual([
      "focus_anchor",
      "focus_obligation",
      "focus_obligation_resolve",
      "focus_create_anchor",
      "focus_revision",
      "focus_lane_split",
      "expectation_ack"
    ]);
    expect([...NON_SEMANTIC_CONFIRM_KINDS]).toEqual(["dispatch", "runtime_effect", "readiness", "memory", "project_anchor"]);
  });

  it("schema 与 isConfirmKind 接受全部成员、拒绝未知串", () => {
    for (const k of CONFIRM_KINDS) {
      expect(confirmKindSchema.safeParse(k).success).toBe(true);
      expect(isConfirmKind(k)).toBe(true);
    }
    for (const bad of ["unknown", "", "Memory", "focus"]) {
      expect(confirmKindSchema.safeParse(bad).success).toBe(false);
      expect(isConfirmKind(bad)).toBe(false);
    }
  });
});
