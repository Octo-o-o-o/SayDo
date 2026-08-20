// 3.3 验收:cost unknown 不显示 0(estimate);产物版本链 + digest 校验(B4);
// A6 组装签署(digest 可复算/revision 变 digest 变/acceptance 空拒/step_confirm 带 grants 拒/
// critical unknown 不可拍板)。

import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { verifyPackageDigest, renderSpoken, type Claim, type EffectGrant, computeGrantDigest, computePackageDigest } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { ArtifactStore, ArtifactCorruptError } from "../src/artifacts/store.js";
import { artifactLineage } from "../src/storage/dao/artifacts.js";
import { DecisionPackageFactory, assertProposable, type AssembleInput } from "../src/packages/factory.js";
import { getPackage, insertPackage } from "../src/storage/dao/packages.js";
import { estimateCost, lookupRate } from "../src/cost/estimate.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const TS = () => new Date("2026-07-24T00:00:00.000Z");
const PRJ = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";

let db: Db;
let saydo: string;
let store: ArtifactStore;
let factory: DecisionPackageFactory;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "saydo-fac-"));
  saydo = join(dir, ".saydo");
  mkdirSync(saydo, { recursive: true });
  db = openDb(join(saydo, "saydo.db"));
  store = new ArtifactStore({ db, saydoDir: saydo, now: TS });
  factory = new DecisionPackageFactory({ db, artifacts: store, audit: nullAudit, now: TS });
});

const baseInput = (over?: Partial<AssembleInput>): AssembleInput => ({
  projectId: PRJ,
  outcomePreview: "报表页出现导出按钮,点了能下 CSV",
  inScope: ["导出 CSV"],
  outOfScope: ["Excel 模板美化"],
  assumptions: [],
  acceptance: ["Excel 能直接打开导出文件", "字段与后台一致"],
  plan: [
    { seq: 1, step: "加导出接口", owner: "ai" },
    { seq: 2, step: "验收抽查", owner: "human" }
  ],
  cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" },
  risks: ["大表导出超时"],
  mode: "step_confirm",
  preauthorizedEffects: [],
  effectPolicyVersion: "e2/0.1.0",
  ...over
});

describe("Money 接线(estimate;Codex B6:无表项即 unknown 不编数)", () => {
  const pricing = { currency: "CNY" as const, as_of: "2026-07-24", llm: { "gpt-5-mini": 0.008, "gpt-5": 0.02 }, tts: { "seed-tts": 0.02 } };

  it("全维可计价 ⇒ known(value/currency/asOf);p95=1.5x", () => {
    const c = estimateCost({ llmModel: "gpt-5-mini-2026", llmKTokens: 100, ttsVoice: "seed-tts-2.0", ttsKChars: 10 }, pricing, 20);
    expect(c.expected).toEqual({ known: true, value: 1, currency: "CNY", asOf: "2026-07-24T00:00:00.000Z" });
    expect(c.p95.known && c.p95.value).toBe(1.5);
    expect(c.max).toBe(20);
  });

  it("有用量但无价目 ⇒ unknown(绝不编数、绝不 0);max 必 known 为正", () => {
    const c = estimateCost({ llmModel: "claude-sonnet-5", llmKTokens: 100 }, pricing, 20);
    expect(c.expected.known).toBe(false);
    expect(c.expected.value).toBeUndefined(); // 不是 0
    expect(() => estimateCost({}, pricing, 0)).toThrow(/positive/);
    // 无 pricing 表 ⇒ unknown
    expect(estimateCost({ llmModel: "gpt-5-mini", llmKTokens: 1 }, undefined, 20).expected.known).toBe(false);
  });

  it("最长前缀匹配(gpt-5-mini 优先于 gpt-5;短键会兜住同前缀家族——表键须写全名避免误配)", () => {
    expect(lookupRate(pricing.llm, "gpt-5-mini-hot")).toBe(0.008);
    expect(lookupRate(pricing.llm, "gpt-5.6-sol")).toBe(0.02); // "gpt-5" 是其前缀:简单前缀匹配的真实行为
    expect(lookupRate(pricing.llm, "claude-sonnet-5")).toBeUndefined();
  });
});

describe("B4 产物库:版本链 + digest 校验", () => {
  it("write v1 -> v2 自动 supersedes;lineage 新到旧;读取重校 digest,篡改报损坏", () => {
    const v1 = store.write({ projectId: PRJ, type: "plan", content: "# 计划 v1", source: "agent_output" });
    expect(v1.version).toBe(1);
    const v2 = store.write({ projectId: PRJ, type: "plan", content: "# 计划 v2(改)", source: "agent_output", artifactId: v1.id });
    expect(v2.version).toBe(2);
    expect(v2.supersedes).toEqual({ artifactId: v1.id, version: 1 });

    const chain = artifactLineage(db, v1.id, 2);
    expect(chain.map((a) => a.version)).toEqual([2, 1]);

    expect(store.read(v1.id, 2).content).toBe("# 计划 v2(改)");
    writeFileSync(v2.path, "被外部篡改");
    expect(() => store.read(v1.id, 2)).toThrow(ArtifactCorruptError);
    // 未知 artifactId 起新版拒
    expect(() => store.write({ projectId: PRJ, type: "plan", content: "x", source: "agent_output", artifactId: "art_01ZZZZZZZZZZZZZZZZZZZZZZZZ" })).toThrow(/not found/);
  });
});

describe("A6 决策包工厂", () => {
  it("组装签署:digest 可复验(verifyPackageDigest null);plan 落 artifact;审计", () => {
    const { pkg, planArtifactId } = factory.assemble(baseInput());
    expect(pkg.status).toBe("draft");
    expect(pkg.revision).toBe(1);
    expect(verifyPackageDigest(pkg)).toBeNull();
    const plan = store.read(planArtifactId, 1);
    expect(plan.content).toContain("[AI] 加导出接口");
    expect(plan.content).toContain("[人] 验收抽查");
    expect(plan.artifact.type).toBe("plan");
  });

  it("revise:revision+1、digest 变、supersedes 链;跨状态字段不入签名域", () => {
    const { pkg } = factory.assemble(baseInput());
    const r2 = factory.revise(pkg, { outcomePreview: "改为导出 Excel" });
    expect(r2.revision).toBe(2);
    expect(r2.digest).not.toBe(pkg.digest);
    expect(r2.supersedes).toEqual({ packageId: pkg.id, revision: 1 });
    expect(verifyPackageDigest(r2)).toBeNull();
  });

  it("反例:acceptance 空拒;step_confirm 携带 grants 拒(validateGrants fail-closed)", () => {
    expect(() => factory.assemble(baseInput({ acceptance: [] }))).toThrow(/acceptance/);
    expect(() => factory.assemble(baseInput({ acceptance: ["  "] }))).toThrow(/acceptance/);
    const grantBase = {
      effect: "push_branch" as const,
      target: "origin",
      constraints: { branchPattern: "feature/*", environment: "worktree" as const },
      downstreamTriggers: "none" as const,
      ttlHours: 24
    };
    // spokenForm 必须由模板渲染(自由造句被 validateGrants 拒——§12-2 ⑤)
    const unsigned = { ...grantBase, spokenForm: renderSpoken(grantBase.effect, grantBase.constraints, grantBase.downstreamTriggers) };
    const signed: EffectGrant = { ...unsigned, grantDigest: computeGrantDigest(unsigned) };
    expect(() => factory.assemble(baseInput({ preauthorizedEffects: [signed] }))).toThrow(/step_confirm/);
    // direct_to_review 带合法 grants 可组
    expect(() => factory.assemble(baseInput({ mode: "direct_to_review", preauthorizedEffects: [signed] }))).not.toThrow();
  });

  it("assemble 后 demoRef 存在且 artifact 可读为 HTML", () => {
    const { pkg } = factory.assemble(baseInput());
    expect(pkg.demoRef).toBeDefined();
    const demo = store.read(pkg.demoRef!.artifactId, pkg.demoRef!.version);
    expect(demo.artifact.type).toBe("demo");
    expect(demo.content).toContain("<!doctype html>");
    expect(demo.content).toContain("data-seq=\"1\"");
    expect(demo.content).toContain("报表页出现导出按钮");
  });

  it("assemble 后 verifyPackageDigest 通过(demoRef 入签名域)", () => {
    const { pkg } = factory.assemble(baseInput());
    expect(verifyPackageDigest(pkg)).toBeNull();
    expect(pkg.demoRef).toEqual({ artifactId: pkg.demoRef!.artifactId, version: 1 });
  });

  it("revise 后 demoRef 指向新版本且 supersedes 旧版本、digest 变化", () => {
    const { pkg } = factory.assemble(baseInput());
    const r2 = factory.revise(pkg, { outcomePreview: "改为导出 Excel" });
    expect(r2.demoRef).toBeDefined();
    expect(r2.demoRef!.artifactId).toBe(pkg.demoRef!.artifactId);
    expect(r2.demoRef!.version).toBe(pkg.demoRef!.version + 1);
    expect(r2.digest).not.toBe(pkg.digest);
    expect(verifyPackageDigest(r2)).toBeNull();
    const demo2 = store.read(r2.demoRef!.artifactId, r2.demoRef!.version);
    expect(demo2.artifact.supersedes).toEqual({ artifactId: pkg.demoRef!.artifactId, version: pkg.demoRef!.version });
    expect(demo2.content).toContain("改为导出 Excel");
  });

  it("demo artifact 路径以 .html 结尾", () => {
    const { pkg } = factory.assemble(baseInput());
    const demo = store.read(pkg.demoRef!.artifactId, pkg.demoRef!.version);
    expect(demo.artifact.path.endsWith(".html")).toBe(true);
    const plan = store.write({ projectId: PRJ, type: "plan", content: "# p", source: "agent_output" });
    expect(plan.path.endsWith(".md")).toBe(true);
  });

  it("getPackage 回读含 demoRef", () => {
    const { pkg } = factory.assemble(baseInput());
    const loaded = getPackage(db, pkg.id, pkg.revision);
    expect(loaded).not.toBeNull();
    expect(loaded!.demoRef).toEqual(pkg.demoRef);
    expect(verifyPackageDigest(loaded!)).toBeNull();
  });

  it("旧包无 demoRef:getPackage + verifyPackageDigest 仍通过且可拍板", () => {
    const id = "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA";
    const body = {
      id,
      revision: 1,
      projectId: PRJ,
      outcomePreview: "旧包无小样",
      inScope: ["导出"],
      outOfScope: [],
      assumptions: [],
      acceptance: ["能导出"],
      plan: [{ seq: 1, step: "做", owner: "ai" as const }],
      cost: { expected: { known: false as const }, p95: { known: false as const }, max: 20, currency: "CNY" as const },
      risks: [],
      mode: "step_confirm" as const,
      preauthorizedEffects: [],
      effectPolicyVersion: "e2/0.1.0"
    };
    insertPackage(db, {
      ...body,
      digest: computePackageDigest(body),
      status: "draft",
      createdAt: "2026-07-24T00:00:00.000Z"
    });
    const loaded = getPackage(db, id, 1);
    expect(loaded).not.toBeNull();
    expect(loaded!.demoRef).toBeUndefined();
    expect(verifyPackageDigest(loaded!)).toBeNull();
    expect(() => assertProposable(loaded!)).not.toThrow();
  });

  it("critical unknown ⇒ 不可拍板(assertProposable 机械门)", () => {
    const criticalUnknown: Claim = {
      text: "requirement:删除范围涉及生产数据",
      source: { kind: "user_utterance", ref: "t@1" },
      confidence: "low",
      critical: true,
      state: "unknown"
    };
    const { pkg } = factory.assemble(baseInput({ assumptions: [criticalUnknown] }));
    expect(() => assertProposable(pkg)).toThrow(/critical/);
    const ok = factory.assemble(baseInput({ assumptions: [{ ...criticalUnknown, state: "verified" }] }));
    expect(() => assertProposable(ok.pkg)).not.toThrow();
  });
});
