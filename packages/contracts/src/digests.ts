// docs/09 §0.1 digest 生成-校验矩阵(安全根基):每个 digest 有明确 producer -> 签名域 -> verifier -> 失败动作。
// 本文件承载 Tier1 用到的 P0 行:DecisionPackage.digest / EffectGrant.grantDigest / ContextSnapshot.packDigest /
// Artifact.digest(文件类,见 jcs.ts bytesDigest)。ApprovalReceipt presentation 与 HopperCommand 行随 P0.5。

import { jcsDigest } from "./jcs.js";
import type { ContextSnapshot } from "./types/contextpack.js";
import type { DecisionPackage, EffectGrant } from "./types/package.js";

/** EffectGrant.grantDigest 签名域 = H(effect, target, constraints, downstreamTriggers, spokenForm, ttlHours) */
export function computeGrantDigest(grant: Omit<EffectGrant, "grantDigest">): string {
  return jcsDigest({
    effect: grant.effect,
    target: grant.target,
    constraints: grant.constraints,
    downstreamTriggers: grant.downstreamTriggers,
    spokenForm: grant.spokenForm,
    ttlHours: grant.ttlHours
  });
}

/**
 * DecisionPackage.digest 签名域(09 §0.1):
 * H(id, revision, projectId, supersedes, outcomePreview, inScope, outOfScope, assumptions, acceptance,
 *   plan, demoRef, cost, risks, mode, preauthorizedEffects[](grantDigest 整体递归重算), effectPolicyVersion)
 * 排除 digest/status/approvedVia/expiresAt/createdAt。
 * "递归重算"防篡改字段留旧 digest:域内 grant 的 grantDigest 一律由字段现算,不取存量值。
 */
export function computePackageDigest(pkg: Omit<DecisionPackage, "digest" | "status" | "approvedVia" | "expiresAt" | "createdAt">): string {
  return jcsDigest({
    id: pkg.id,
    revision: pkg.revision,
    projectId: pkg.projectId,
    supersedes: pkg.supersedes,
    outcomePreview: pkg.outcomePreview,
    inScope: pkg.inScope,
    outOfScope: pkg.outOfScope,
    assumptions: pkg.assumptions,
    acceptance: pkg.acceptance,
    plan: pkg.plan,
    demoRef: pkg.demoRef,
    cost: pkg.cost,
    risks: pkg.risks,
    mode: pkg.mode,
    preauthorizedEffects: pkg.preauthorizedEffects.map((g) => ({
      effect: g.effect,
      target: g.target,
      constraints: g.constraints,
      downstreamTriggers: g.downstreamTriggers,
      spokenForm: g.spokenForm,
      ttlHours: g.ttlHours,
      grantDigest: computeGrantDigest(g) // 递归重算,不信任 g.grantDigest 存量
    })),
    effectPolicyVersion: pkg.effectPolicyVersion,
    // readinessRef 入签名域(09 §0.1;Codex 21 A3):就绪绑定改变 ⇒ digest 变 ⇒ 旧收据失效重签
    ...(pkg.readinessRef ? { readinessRef: pkg.readinessRef } : {})
  });
}

/** verifier(09 §0.1 行 1):拍板前重算比对,不符拒拍板。返回 null=通过,否则失败原因 */
export function verifyPackageDigest(pkg: DecisionPackage): string | null {
  const expected = computePackageDigest(pkg);
  if (pkg.digest !== expected) {
    return `package digest mismatch: stored=${pkg.digest} recomputed=${expected}`;
  }
  // 内嵌 grant 的存量 grantDigest 也必须与重算一致(篡改字段留旧 digest => 验包失败,§12-1)
  for (const [i, g] of pkg.preauthorizedEffects.entries()) {
    const gd = computeGrantDigest(g);
    if (g.grantDigest !== gd) {
      return `grant[${i}] digest mismatch: stored=${g.grantDigest} recomputed=${gd}`;
    }
  }
  return null;
}

/**
 * ContextSnapshot.packDigest 签名域(09 §0.1):
 * H(compilerVersion, memoryGeneration, repoHead, dirtyDigest, topicTerms, budgets, slices, excluded);
 * 排除 sessionId/projectId(元数据)。verifier:重建会话时比对,失配重编译。
 */
export function computePackDigest(snap: Omit<ContextSnapshot, "packDigest" | "sessionId" | "projectId">): string {
  return jcsDigest({
    compilerVersion: snap.compilerVersion,
    parentPackDigest: snap.parentPackDigest, // M7:父 pack 入签名保纯函数性
    memoryGeneration: snap.memoryGeneration,
    repoHead: snap.repoHead,
    dirtyDigest: snap.dirtyDigest,
    topicTerms: snap.topicTerms,
    budgets: snap.budgets,
    // slices 签 tier/refs/tokens/segment/form(定义输入);prefixDigest 是派生诊断值,排除以免自指涉(评审关注点)
    slices: snap.slices.map((s) => ({
      tier: s.tier,
      refs: s.refs,
      tokens: s.tokens,
      segment: s.segment,
      form: s.form
    })),
    excluded: snap.excluded
  });
}

export function verifyPackDigest(snap: ContextSnapshot): string | null {
  const expected = computePackDigest(snap);
  return snap.packDigest === expected ? null : `pack digest mismatch: stored=${snap.packDigest} recomputed=${expected}`;
}

/**
 * 未结 obligations 现势 digest(Focus Contract §2.2 三元组锚)。
 * 签名域=按 id 排序的 {id,status,verification,owner,kind,dedupeKey,resolution?}[]。
 *
 * 刻意排除 provenance(Focus v0.4 ④b confirm_expired / confirm_expired_batch):
 * provenance 是降格溯源旁路字段,不改变义务现势身份;纳入会令既有 digest 链断裂。
 */
export function computeObligationsDigest(
  obligations: ReadonlyArray<{
    id: string;
    status: string;
    verification: string;
    owner: string;
    kind: string;
    dedupeKey: string;
    resolution?: string | undefined;
  }>
): string {
  const sorted = [...obligations]
    .map((o) => ({
      id: o.id,
      status: o.status,
      verification: o.verification,
      owner: o.owner,
      kind: o.kind,
      dedupeKey: o.dedupeKey,
      ...(o.resolution ? { resolution: o.resolution } : {})
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return jcsDigest({ openObligations: sorted });
}

/**
 * FocusResumePacket.digest 签名域(方案 §3.1):
 * H(focusId, revision, baseline, compiledFrom, compilerVersion, rendererVersion, inputDigest, factsJson, obligationsSnapshotJson)
 * 排除 digest/createdAt。
 */
export function computeResumePacketDigest(packet: {
  focusId: string;
  revision: number;
  baseline: { revision: number; eventHighWatermark: number; obligationsDigest: string };
  compiledFrom: unknown;
  compilerVersion: string;
  rendererVersion: string;
  inputDigest: string;
  factsJson: string;
  obligationsSnapshotJson: string;
}): string {
  return jcsDigest({
    focusId: packet.focusId,
    revision: packet.revision,
    baseline: packet.baseline,
    compiledFrom: packet.compiledFrom,
    compilerVersion: packet.compilerVersion,
    rendererVersion: packet.rendererVersion,
    inputDigest: packet.inputDigest,
    factsJson: packet.factsJson,
    obligationsSnapshotJson: packet.obligationsSnapshotJson
  });
}

export function verifyResumePacketDigest(packet: {
  focusId: string;
  revision: number;
  baseline: { revision: number; eventHighWatermark: number; obligationsDigest: string };
  compiledFrom: unknown;
  compilerVersion: string;
  rendererVersion: string;
  inputDigest: string;
  factsJson: string;
  obligationsSnapshotJson: string;
  digest: string;
}): string | null {
  const expected = computeResumePacketDigest(packet);
  return packet.digest === expected ? null : `resume packet digest mismatch: stored=${packet.digest} recomputed=${expected}`;
}
