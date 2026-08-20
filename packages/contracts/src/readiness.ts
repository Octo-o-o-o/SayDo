// readinessSkeleton(09 §13/§4;02 §5 类型就绪清单;R-A 补完 2026-07-27,Codex 21 A3;
// A3-armed 2026-07-28 定稿,方案 research/2026-07-28-a3-armed-design.md v1.2):
// 单源纯函数——按 project.type 出该类型就绪清单的 dims 骨架(会话绑定装配/assessReadiness/proposeStart
// 复用同一实现,mock 任一处 ⇒ 测试红)。W1 实测"空账本判就绪"漏洞的根修:骨架 dims 默认 unknown,
// 空证据 ⇒ 全 unknown ⇒ 规则层 gap_critical ⇒ 不凭空出包。
//
// A3-armed 语义:
// - covered = 现役 confirmed ReadinessBinding 的 key 集(candidate 不计;09 §13 covered 块);
// - dims 结构化持久化 {key,label,axis,critical,state}(Codex 23 B-3:text 是派生渲染,digest 签结构字段,
//   lane 只影响 text 呈现、排除出语义指纹);
// - 双 digest 版本锚:checklistDigest(清单结构指纹)+ evidenceDigest(绑定证据版本向量指纹),
//   随 readinessRef 入包 digest,拍板/派发时全量重生成比对(同 key 换证/清单演化即 stale);
// - 门拒绝集单源 isReadinessBlocking:gap_critical 拒,gap_knowledge/gap_requirement 为建议态放行。

import { jcsDigest } from "./jcs.js";
import type { Claim } from "./types/contextpack.js";
import type { ProjectType } from "./types/project.js";
import type { ReadinessVerdict } from "./types/tools.js";

/** dim 骨架条目(单源词表;key 稳定用于 covered 集与 digest,label 供口播) */
export interface SkeletonDim {
  key: string;
  label: string;
  critical: boolean;
  /** knowledge=需理解/信息源类;requirement=需澄清/拍板类(双维缺口分诊) */
  axis: "knowledge" | "requirement";
}

/**
 * 02 §5 类型就绪清单(单源词表)。coding/writing 全列(W4 生效类型);research/marketing/planning
 * 前瞻(能力未开,§11 enabled_project_types)。pending 最小清单(A3-armed,Codex 23 A-4 选项②:
 * 未定型项目的首提案就绪——type_intent + rough_goal,promote 后清单换代旧包必 stale)。
 * general 无类型模板(fail-closed 况①)。
 */
export const READINESS_CHECKLISTS: Partial<Record<ProjectType, SkeletonDim[]>> = {
  pending: [
    { key: "type_intent", label: "这是件什么类型的事", critical: true, axis: "requirement" },
    { key: "rough_goal", label: "粗目标", critical: true, axis: "requirement" }
  ],
  coding: [
    { key: "goal", label: "目标", critical: true, axis: "requirement" },
    { key: "acceptance", label: "可验证的验收标准", critical: true, axis: "requirement" },
    { key: "scope", label: "涉及范围", critical: true, axis: "requirement" },
    { key: "constraints", label: "约束", critical: false, axis: "requirement" },
    { key: "codebase_understood", label: "代码库关键部分已理解", critical: true, axis: "knowledge" }
  ],
  writing: [
    { key: "core_thesis", label: "核心论点(用户亲口给出并确认)", critical: true, axis: "requirement" },
    { key: "audience", label: "目标读者与发表场景", critical: true, axis: "requirement" },
    { key: "form", label: "文体·篇幅", critical: false, axis: "requirement" },
    { key: "outline", label: "结构大纲", critical: true, axis: "requirement" },
    { key: "thesis_material", label: "论点—素材覆盖(经验或已验证引用)", critical: true, axis: "knowledge" },
    { key: "style_ref", label: "风格参照可及(既往文章或口头描述)", critical: false, axis: "knowledge" }
  ],
  research: [
    { key: "question", label: "调研问题", critical: true, axis: "requirement" },
    { key: "scope_depth", label: "范围与深度", critical: true, axis: "requirement" },
    { key: "deliverable", label: "交付形式", critical: false, axis: "requirement" },
    { key: "sources", label: "信息源可及", critical: true, axis: "knowledge" }
  ],
  marketing: [
    { key: "goal_metric", label: "目标与成功指标", critical: true, axis: "requirement" },
    { key: "audience", label: "受众", critical: true, axis: "requirement" },
    { key: "channel", label: "渠道", critical: false, axis: "requirement" },
    { key: "budget", label: "预算", critical: false, axis: "requirement" },
    { key: "tone", label: "调性", critical: false, axis: "knowledge" }
  ],
  planning: [
    { key: "goal", label: "目标", critical: true, axis: "requirement" },
    { key: "scope", label: "范围", critical: true, axis: "requirement" },
    { key: "stakeholders", label: "相关方", critical: false, axis: "requirement" },
    { key: "success", label: "成功标准", critical: true, axis: "requirement" }
  ]
};

/** 类型清单 key 词表(remember readinessKey 四闸-① 的判定源;null = 无清单类型) */
export function readinessKeysOf(type: ProjectType): string[] | null {
  const checklist = READINESS_CHECKLISTS[type];
  return checklist && checklist.length > 0 ? checklist.map((d) => d.key) : null;
}

/** 清单结构指纹(Codex 23 A-2/B-3:签结构字段含 label——key 增删/critical/axis/label 变化均使旧包 stale) */
export function checklistDigestOf(type: ProjectType): string | null {
  const checklist = READINESS_CHECKLISTS[type];
  if (!checklist || checklist.length === 0) return null;
  return jcsDigest(checklist.map((d) => ({ k: d.key, l: d.label, a: d.axis, cr: d.critical })));
}

export interface ProjectEvidence {
  /** 已覆盖的 dim key 集(A3-armed:= 现役 confirmed 绑定 key 集,provider 产出;本函数不自造判定) */
  covered: readonly string[];
}

/** 结构化就绪 dim(持久化形状;text = 派生渲染,digest 不签 text——Codex 23 B-3) */
export interface ReadinessDim {
  key: string;
  label: string;
  axis: "knowledge" | "requirement";
  critical: boolean;
  state: "verified" | "unknown";
  /** 派生渲染(含 lane 后缀,供口播/回读/forget 明文扫描;不进任何语义 digest) */
  text: string;
}

/** dim → Claim 投影(深评层等 Claim 消费面用;source 锚 = 骨架自述) */
export function dimAsClaim(d: ReadinessDim): Claim {
  return {
    text: d.text,
    source: { kind: "agent_output", ref: `readiness-skeleton:${d.key}` },
    confidence: "high",
    critical: d.critical,
    state: d.state
  };
}

/**
 * 出该类型的就绪 dims 骨架(结构化)。covered 命中 ⇒ verified,否则 unknown(fail-closed:空证据 ⇒ 全 unknown)。
 * lane(quick/guided/explore)**不得删 critical**——quick 只影响口播密度,不降就绪门(02 §5 守门句);
 * lane 只进 text 呈现,不进语义 digest。
 * 返回 null = 类型模板缺失(fail-closed 况①:调用方按 gap_critical 落行)。
 */
export function readinessSkeleton(type: ProjectType, evidence: ProjectEvidence, lane?: "quick" | "guided" | "explore"): ReadinessDim[] | null {
  const checklist = READINESS_CHECKLISTS[type];
  if (!checklist || checklist.length === 0) return null; // 况①:类型模板缺失
  const coveredSet = new Set(evidence.covered);
  return checklist.map((d) => ({
    key: d.key,
    label: d.label,
    axis: d.axis,
    critical: d.critical,
    state: coveredSet.has(d.key) ? ("verified" as const) : ("unknown" as const),
    text: `${d.axis}:${d.key}:${d.label}${lane ? ` [lane=${lane}]` : ""}`
  }));
}

/** readinessRef(组包绑定;§0.1 签名域已含):dims 指纹 + 清单/证据版本指纹 + 评估行 id + 裁决 */
export interface ReadinessRef {
  dimsDigest: string;
  assessmentId: string;
  verdict: ReadinessVerdict;
  /** A3-armed(Codex 23 A-2):清单结构指纹——清单演化即 stale */
  checklistDigest: string;
  /** A3-armed(Codex 23 A-2):绑定证据版本向量指纹——同 key 换证即 stale */
  evidenceDigest: string;
}

/** dims 指纹(签结构字段 key/critical/state,按 key 排序;不签 text/label/axis——后两者由 checklistDigest 锚) */
export function readinessDimsDigest(dims: ReadinessDim[]): string {
  return jcsDigest(
    [...dims].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map((d) => ({ k: d.key, cr: d.critical, s: d.state }))
  );
}

/** 绑定证据条目(provider 产出;ReadinessBinding 一等实体的评估投影,09 §9 readiness_bindings) */
export interface ReadinessEvidenceBinding {
  key: string;
  memId: string;
  claimDigest: string;
  bindingId: string;
}

/** provider 返回形状(结构化证据,非裸 key 集;Codex 23 A-2) */
export interface ReadinessEvidenceDetail {
  covered: string[];
  bindings: ReadinessEvidenceBinding[];
}

/** 证据版本向量指纹(按 key 排序;绑定集任何变化——换证/新增/撤销——digest 必变) */
export function readinessEvidenceDigest(bindings: ReadinessEvidenceBinding[]): string {
  return jcsDigest(
    [...bindings]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((b) => ({ k: b.key, m: b.memId, c: b.claimDigest, b: b.bindingId }))
  );
}

/**
 * 门拒绝集单源(A3-armed,Codex 23 B-4;09 §13):gap_critical 拒组包/拒拍板;
 * gap_knowledge/gap_requirement = 可播报建议态(非 critical 缺口),不阻塞。
 * rules/deep/propose/issue/dispatch 五处统一调用本函数,禁散落 verdict !== "ready"。
 */
export function isReadinessBlocking(verdict: ReadinessVerdict): boolean {
  return verdict === "gap_critical";
}
