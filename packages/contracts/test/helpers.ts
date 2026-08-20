// 契约测试固件构造器:合法 DecisionPackage / EffectGrant(digest 现算)。

import { computeGrantDigest, computePackageDigest } from "../src/digests.js";
import { renderSpoken } from "../src/effects.js";
import type { DecisionPackage, EffectGrant } from "../src/types/package.js";

export function buildInstallGrant(overrides: Partial<Omit<EffectGrant, "grantDigest" | "spokenForm">> = {}): EffectGrant {
  const base = {
    effect: "install_dependency" as const,
    target: "workspace",
    constraints: { packages: ["papaparse"], environment: "worktree" as const },
    downstreamTriggers: "none" as const,
    ttlHours: 72,
    ...overrides
  };
  const spokenForm = renderSpoken(base.effect, base.constraints, base.downstreamTriggers);
  return { ...base, spokenForm, grantDigest: computeGrantDigest({ ...base, spokenForm }) };
}

export function buildPushGrant(branchPattern = "saydo/T-0042-*"): EffectGrant {
  const base = {
    effect: "push_branch" as const,
    target: "origin",
    constraints: { branchPattern, environment: "worktree" as const },
    downstreamTriggers: "ci_preview" as const,
    ttlHours: 72
  };
  const spokenForm = renderSpoken(base.effect, base.constraints, base.downstreamTriggers);
  return { ...base, spokenForm, grantDigest: computeGrantDigest({ ...base, spokenForm }) };
}

const FIXED = {
  pkgId: "pkg_01JD9WYX0000000000000000AA",
  prjId: "prj_01JD9WYX0000000000000000BB",
  artId: "art_01JD9WYX0000000000000000CC"
} as const;

export function buildPackage(
  overrides: Partial<Omit<DecisionPackage, "digest">> = {},
  grants: EffectGrant[] = []
): DecisionPackage {
  const body: Omit<DecisionPackage, "digest"> = {
    id: FIXED.pkgId,
    revision: 1,
    projectId: FIXED.prjId,
    outcomePreview: "报表页出现可用的 CSV 导出",
    inScope: ["前端导出按钮", "导出 API"],
    outOfScope: ["数据模型变更"],
    assumptions: [
      {
        text: "requirement:导出格式为 CSV(UTF-8 BOM)",
        source: { kind: "user_utterance", ref: "trn_x" },
        confidence: "high",
        critical: true,
        state: "verified"
      }
    ],
    acceptance: ["报表页出现导出按钮并可下载 .csv", "Excel 双击打开无乱码"],
    plan: [
      { seq: 1, step: "实现导出 API", owner: "ai" },
      { seq: 2, step: "验收导出文件", owner: "human" }
    ],
    cost: {
      expected: { known: true, value: 3, currency: "CNY", asOf: "2026-07-24T00:00:00Z" },
      p95: { known: false },
      max: 20,
      currency: "CNY"
    },
    risks: ["CSV 编码兼容性"],
    mode: grants.length > 0 ? "direct_to_review" : "step_confirm",
    preauthorizedEffects: grants,
    effectPolicyVersion: "e2-v1",
    status: "approved",
    expiresAt: "2026-07-31T00:00:00Z",
    createdAt: "2026-07-24T00:00:00Z",
    ...overrides
  };
  return { ...body, digest: computePackageDigest(body) };
}

export const FIXED_IDS = FIXED;
