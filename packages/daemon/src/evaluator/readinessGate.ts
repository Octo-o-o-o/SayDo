// readinessSkeleton 生产门(09 §13/§4;Codex 21 A3;W1 空账本漏洞根修;A3-armed 2026-07-28 定稿)。
// 单源 = @saydo/contracts readinessSkeleton(会话绑定装配/assessReadiness/proposeStart 复用同一实现)。
// fail-closed 四况 ⇒ gap_critical 且落 readiness_assessments 行:
//   ① 类型模板缺失(readinessSkeleton 返回 null)② 骨架未装配(evidence 提供方缺失)
//   ③ 全 unknown(空账本;assessRules 对 critical unknown 判 gap_critical)④ provider 不可用/异常。
// readinessRef 组包绑定:门通过后出 { dimsDigest, checklistDigest, evidenceDigest, assessmentId, verdict }
// (A3-armed 双 digest 版本锚,Codex 23 A-2),factory 写入包(§0.1 签名域)。
//
// covered 语义(A3-armed 定稿,09 §13 covered 块):= 现役 confirmed ReadinessBinding key 集
// (provider = evaluator/readinessBinding.evidenceFor;candidate 不算覆盖)。本层不自造判定。
// dims 结构化持久化 {key,label,axis,critical,state,text}(text 派生;digest 签结构字段——Codex 23 B-3)。

import { ulid } from "ulid";
import {
  checklistDigestOf,
  readinessDimsDigest,
  readinessEvidenceDigest,
  readinessSkeleton,
  type ProjectType,
  type ReadinessDim,
  type ReadinessEvidenceDetail,
  type ReadinessRef,
  type ReadinessVerdict
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { assessRules } from "./readiness.js";

export interface ReadinessGateDeps {
  db: Db;
  audit: AuditSink;
  /**
   * 证据提供方(A3-armed:= readinessBinding.evidenceFor 闭包——现役 confirmed 绑定)。
   * 低层保留 optional:仅供"错误组装也 fail-closed 落 gap_critical 行"的防御测试(Codex 23 B-6);
   * 生产 composition root 必须注入(required、缺失 fail-fast,index.ts 承载)。
   */
  evidenceProvider?: (sessionId: string, projectId: string) => ReadinessEvidenceDetail | null;
  now?: () => Date;
}

export interface ReadinessGateResult {
  verdict: ReadinessVerdict;
  dims: ReadinessDim[];
  blockingCriticals: string[];
  ref: ReadinessRef;
}

/** 落 readiness_assessments 行(rules 层;deep 行四必填不适用 rules,DDL CHECK 允许 rules 空) */
function persistAssessment(
  deps: ReadinessGateDeps,
  sessionId: string,
  verdict: ReadinessVerdict,
  dims: ReadinessDim[],
  blocking: string[],
  digests: { checklistDigest: string; evidenceDigest: string }
): string {
  const id = `asm_${ulid()}`;
  deps.db
    .prepare(
      `INSERT INTO readiness_assessments(id, session_id, verdict, dims_json, blocking_criticals_json, layer, checklist_digest, evidence_digest, created_at)
       VALUES (?, ?, ?, ?, ?, 'rules', ?, ?, ?)`
    )
    .run(
      id,
      sessionId,
      verdict,
      JSON.stringify(dims),
      JSON.stringify(blocking),
      digests.checklistDigest,
      digests.evidenceDigest,
      (deps.now ?? (() => new Date()))().toISOString()
    );
  return id;
}

/** 无清单/无证据时的空指纹(gap_critical 行也持久化版本锚,审计可重建) */
const EMPTY_DIGEST = "none";

/**
 * 会话绑定装配(09 §13 消费点之一;w4-readback B-4 接线;A3-armed 口径 = 每次 session↔project
 * 绑定建立或变更:created/rebuilt/promote/reanchor,装配幂等——重复调用只落新评估行)。
 * 复用 assessReadinessSkeleton 同一实现(单源纪律);装配失败不得断对话链(调用方 catch);
 * 无模板项目落况① gap_critical 行,语义如实。
 */
export function assembleOnSessionStart(
  deps: ReadinessGateDeps,
  i: { sessionId: string; projectId: string; type: ProjectType }
): ReadinessGateResult {
  const r = assessReadinessSkeleton(deps, i);
  deps.audit.record({
    actor: "daemon",
    action: "readiness.skeleton_assemble",
    meta: { sessionId: i.sessionId, projectId: i.projectId, type: i.type, verdict: r.verdict, assessmentId: r.ref.assessmentId }
  });
  return r;
}

/**
 * 就绪门(rules 层;骨架单源)。返回评估结果 + readinessRef;fail-closed 四况恒 gap_critical 且落行。
 * lane 影响口播密度不降就绪门(readinessSkeleton 内 critical 恒保留;lane 不进语义 digest)。
 */
export function assessReadinessSkeleton(
  deps: ReadinessGateDeps,
  i: { sessionId: string; projectId: string; type: ProjectType; lane?: "quick" | "guided" | "explore" }
): ReadinessGateResult {
  const checklistDigest = checklistDigestOf(i.type) ?? EMPTY_DIGEST;
  const gapCritical = (dims: ReadinessDim[], blocking: string[], reason: string, evidenceDigest: string): ReadinessGateResult => {
    const assessmentId = persistAssessment(deps, i.sessionId, "gap_critical", dims, blocking, { checklistDigest, evidenceDigest });
    deps.audit.record({ actor: "daemon", action: "readiness.skeleton_gap_critical", meta: { sessionId: i.sessionId, type: i.type, reason } });
    return {
      verdict: "gap_critical",
      dims,
      blockingCriticals: blocking,
      ref: { dimsDigest: readinessDimsDigest(dims), assessmentId, verdict: "gap_critical", checklistDigest, evidenceDigest }
    };
  };

  // 况②:证据提供方缺失(骨架未装配)⇒ gap_critical(空 dims 落行;生产组装层 required——此路径属防御)
  if (!deps.evidenceProvider) return gapCritical([], ["readiness evidence provider not armed"], "evidence_provider_missing", EMPTY_DIGEST);
  // 况④:provider 调用异常 ⇒ 同样 gap_critical 且持久化(fail-closed 不外抛;RA-closeout,Codex 22 §5.1)
  let evidence: ReadinessEvidenceDetail;
  try {
    evidence = deps.evidenceProvider(i.sessionId, i.projectId) ?? { covered: [], bindings: [] };
  } catch (err) {
    return gapCritical([], [`evidence provider threw: ${String(err).slice(0, 80)}`], "evidence_provider_error", EMPTY_DIGEST);
  }
  const evidenceDigest = readinessEvidenceDigest(evidence.bindings);

  // 况①:类型模板缺失 ⇒ null ⇒ gap_critical
  const dims = readinessSkeleton(i.type, evidence, i.lane);
  if (dims === null) return gapCritical([], [`no readiness checklist for type ${i.type}`], "template_missing", evidenceDigest);

  // 况③:全 unknown(空账本)/ critical unknown ⇒ assessRules 判 gap_critical(不可被平均掉)
  const rules = assessRules(dims);
  const assessmentId = persistAssessment(deps, i.sessionId, rules.verdict, dims, rules.blockingCriticals, { checklistDigest, evidenceDigest });
  deps.audit.record({
    actor: "daemon",
    action: "readiness.skeleton_assess",
    meta: { sessionId: i.sessionId, type: i.type, verdict: rules.verdict, covered: evidence.covered.length, dims: dims.length }
  });
  return {
    verdict: rules.verdict,
    dims,
    blockingCriticals: rules.blockingCriticals,
    ref: { dimsDigest: readinessDimsDigest(dims), assessmentId, verdict: rules.verdict, checklistDigest, evidenceDigest }
  };
}
