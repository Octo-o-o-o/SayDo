// A6 决策包工厂(计划 3.3;modules/a A6;09 §2/§0.1/§13):就绪后组装三件套,签署 digest,
// 计划落盘为可编辑 artifact。不做:预授权推导(E2——工厂只接收并 fail-closed 校验,Brain 不得自由声明)、
// 就绪判定(A5——assertProposable 只做机械门:critical 项 unknown ⇒ 不可拍板)。
// 改包 = revision+1 + 新 digest + supersedes 链(旧收据作废语义在审批域)。
// Demo 三件套:assemble/revise 同轮确定性渲染小样并签入 demoRef(S1;08 A6 / 08 §R4)。

import { newId, validateGrants, computePackageDigest, type Claim, type DecisionPackage, type EffectGrant, type ReadinessRef } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { insertPackage } from "../storage/dao/packages.js";
import type { ArtifactStore } from "../artifacts/store.js";
import type { AuditSink } from "../obs/audit.js";
import { renderPackageDemoDraft, type DecisionPackageDraft } from "../demo/generator.js";

export interface AssembleInput {
  projectId: string;
  outcomePreview: string;
  inScope: string[];
  outOfScope: string[];
  assumptions: Claim[];
  /** 必须非空且逐条可测(路径二会渲染成 Hopper 验收标题;缺 ⇒ 组装拒) */
  acceptance: string[];
  plan: { seq: number; step: string; owner: "ai" | "human" }[];
  cost: DecisionPackage["cost"];
  risks: string[];
  mode: "direct_to_review" | "step_confirm";
  /** E2 推导产物(调用方=策略引擎);step_confirm 必须为空(validateGrants fail-closed) */
  preauthorizedEffects: EffectGrant[];
  effectPolicyVersion: string;
  /** 就绪绑定(Codex 21 A3;§0.1 签名域已含):armed 时 proposeStart 必给,拍板时比对 */
  readinessRef?: ReadinessRef;
}

export interface FactoryDeps {
  db: Db;
  artifacts: ArtifactStore;
  audit: AuditSink;
  now: () => Date;
}

function assertAssemblable(input: AssembleInput): void {
  if (input.acceptance.length === 0 || input.acceptance.some((a) => a.trim() === "")) {
    throw new Error("acceptance must be non-empty testable criteria (缺验收标准 ⇒ 不组包)");
  }
  if (input.plan.length === 0) throw new Error("plan must have at least one step");
  const grantCheck = validateGrants(input.preauthorizedEffects, { mode: input.mode });
  if (!grantCheck.ok) {
    throw new Error(`preauthorizedEffects rejected: ${grantCheck.reasons.join("; ")}`);
  }
}

/** critical 项 unknown/conflicting ⇒ 不可拍板(proposeStart 前的机械门;A5 verdict 由调用方另行把关) */
export function assertProposable(pkg: DecisionPackage): void {
  const blocking = pkg.assumptions.filter((c) => c.critical && (c.state === "unknown" || c.state === "conflicting"));
  if (blocking.length > 0) {
    throw new Error(`critical assumptions unresolved: ${blocking.map((c) => c.text).join(" / ")}`);
  }
}

export class DecisionPackageFactory {
  private readonly deps: FactoryDeps;

  constructor(deps: FactoryDeps) {
    this.deps = deps;
  }

  /** 组装 + 签署(revision=1,draft):plan 落盘 plan artifact(可编辑),同轮渲染 Demo 小样签入 demoRef */
  assemble(input: AssembleInput): { pkg: DecisionPackage; planArtifactId: string } {
    assertAssemblable(input);
    const planArtifact = this.deps.artifacts.write({
      projectId: input.projectId,
      type: "plan",
      content: renderPlanMarkdown(input),
      tags: ["decision-package-plan"],
      source: "agent_output"
    });
    const id = newId("pkg");
    const demoRef = this.writeDemo(input, { id, revision: 1 });
    const pkg = this.sign({ ...input, id, revision: 1, demoRef });
    insertPackage(this.deps.db, pkg);
    this.deps.audit.record({
      actor: "daemon",
      action: "package.assemble",
      meta: { packageId: pkg.id, revision: 1, digest: pkg.digest, planArtifact: `${planArtifact.id}@v${planArtifact.version}`, demoArtifact: `${demoRef.artifactId}@v${demoRef.version}` }
    });
    return { pkg, planArtifactId: planArtifact.id };
  }

  /** 改包:revision+1、新 digest、supersedes 指向旧版(旧包收据作废 = 审批域 superseded_by_edit)。
   *  传 planArtifactId 则同步产新版 plan artifact(评审 C:计划落盘在改包路径不断档)。 */
  revise(prev: DecisionPackage, changes: Partial<AssembleInput>, planArtifactId?: string): DecisionPackage {
    const merged: AssembleInput = {
      projectId: prev.projectId,
      outcomePreview: prev.outcomePreview,
      inScope: prev.inScope,
      outOfScope: prev.outOfScope,
      assumptions: prev.assumptions,
      acceptance: prev.acceptance,
      plan: prev.plan,
      cost: prev.cost,
      risks: prev.risks,
      mode: prev.mode,
      preauthorizedEffects: prev.preauthorizedEffects,
      effectPolicyVersion: prev.effectPolicyVersion,
      ...(prev.readinessRef ? { readinessRef: prev.readinessRef } : {}),
      ...changes
    };
    assertAssemblable(merged);
    if (planArtifactId !== undefined) {
      this.deps.artifacts.write({
        projectId: merged.projectId,
        type: "plan",
        content: renderPlanMarkdown(merged),
        tags: ["decision-package-plan"],
        source: "agent_output",
        artifactId: planArtifactId
      });
    }
    const revision = prev.revision + 1;
    const supersedes = { packageId: prev.id, revision: prev.revision };
    const demoRef = this.writeDemo(merged, { id: prev.id, revision, supersedes }, prev.demoRef);
    const pkg = this.sign({
      ...merged,
      id: prev.id,
      revision,
      supersedes,
      demoRef
    });
    insertPackage(this.deps.db, pkg);
    this.deps.audit.record({
      actor: "daemon",
      action: "package.revise",
      meta: { packageId: pkg.id, revision: pkg.revision, digest: pkg.digest }
    });
    return pkg;
  }

  private writeDemo(
    input: AssembleInput,
    extra: { id: string; revision: number; supersedes?: { packageId: string; revision: number } },
    prevDemoRef?: DecisionPackage["demoRef"]
  ): { artifactId: string; version: number } {
    const createdAt = this.deps.now().toISOString();
    const draft: DecisionPackageDraft = {
      id: extra.id,
      revision: extra.revision,
      ...(extra.supersedes ? { supersedes: extra.supersedes } : {}),
      projectId: input.projectId,
      outcomePreview: input.outcomePreview,
      inScope: input.inScope,
      outOfScope: input.outOfScope,
      assumptions: input.assumptions,
      acceptance: input.acceptance,
      plan: input.plan,
      cost: input.cost,
      risks: input.risks,
      mode: input.mode,
      preauthorizedEffects: input.preauthorizedEffects,
      effectPolicyVersion: input.effectPolicyVersion,
      ...(input.readinessRef ? { readinessRef: input.readinessRef } : {}),
      status: "draft",
      createdAt
    };
    const art = this.deps.artifacts.write({
      projectId: input.projectId,
      type: "demo",
      content: renderPackageDemoDraft(draft),
      tags: ["decision-package-demo"],
      source: "agent_output",
      ...(prevDemoRef ? { artifactId: prevDemoRef.artifactId } : {})
    });
    return { artifactId: art.id, version: art.version };
  }

  private sign(
    body: AssembleInput & {
      id: string;
      revision: number;
      supersedes?: { packageId: string; revision: number };
      demoRef?: { artifactId: string; version: number };
    }
  ): DecisionPackage {
    const unsigned = {
      id: body.id,
      revision: body.revision,
      ...(body.supersedes ? { supersedes: body.supersedes } : {}),
      projectId: body.projectId,
      outcomePreview: body.outcomePreview,
      inScope: body.inScope,
      outOfScope: body.outOfScope,
      assumptions: body.assumptions,
      acceptance: body.acceptance,
      plan: body.plan,
      cost: body.cost,
      risks: body.risks,
      mode: body.mode,
      preauthorizedEffects: body.preauthorizedEffects,
      effectPolicyVersion: body.effectPolicyVersion,
      ...(body.readinessRef ? { readinessRef: body.readinessRef } : {}),
      ...(body.demoRef ? { demoRef: body.demoRef } : {})
    };
    const now = this.deps.now();
    // A6:draft 无 expiry(移除 now+7d 写值)——expires_at 唯一写点 = proposed 转移事务(§2 注 ④)
    return {
      ...unsigned,
      digest: computePackageDigest(unsigned),
      status: "draft",
      createdAt: now.toISOString()
    };
  }
}

/** plan 的可编辑文件投影(人机分工表;A6 三件套之"计划") */
export function renderPlanMarkdown(input: AssembleInput): string {
  const lines = [
    `# 计划(决策包草案)`,
    "",
    `## 成果预览`,
    "",
    input.outcomePreview,
    "",
    `## 步骤(人机分工)`,
    "",
    ...input.plan.map((s) => `${s.seq}. [${s.owner === "ai" ? "AI" : "人"}] ${s.step}`),
    "",
    `## 验收标准`,
    "",
    ...input.acceptance.map((a) => `- ${a}`)
  ];
  return lines.join("\n");
}
