// 就绪确认绑定服务(A3-armed 2026-07-28;09 §13 covered 块 + §9 readiness_bindings;
// 方案 research/2026-07-28-a3-armed-design.md v1.2)。
//
// 三态覆盖:none →(remember 带 readinessKey,来源完整性四闸)→ candidate →(confirmReadiness
// 复述确认环)→ confirmed。covered = 现役 confirmed 绑定 key 集——candidate 不算覆盖(骨架 unknown)。
// 升格权威 = 人在环(daemon 机械渲染 claim 原文,用户封闭确认);深评抽查是纵深不是前置(A5-armed)。
//
// 现役绑定判定:未 superseded ∧ 底层 claim 现役(账本 active 投影:未 forget/invalidate/supersede/
// 未过期)∧(knowledge 轴)foundation_generation 现役。requirement 轴不随奠基换代失效。

import type { ProjectType, ReadinessEvidenceBinding, ReadinessEvidenceDetail } from "@saydo/contracts";
import { READINESS_CHECKLISTS, jcsDigest, newId } from "@saydo/contracts";
import type { MemoryLedger } from "../memory/ledger.js";
import type { AuditSink } from "../obs/audit.js";
import { insertClaimSnapshotLink } from "../storage/dao/sourceSnapshots.js";
import type { Db } from "../storage/db.js";
import type { Snapshotter } from "./snapshotter.js";

/** claim 内容指纹(绑定版本锚:同 key 换证 ⇒ digest 变 ⇒ evidenceDigest 变 ⇒ 旧包 stale) */
export function claimDigestOf(claim: string): string {
  return jcsDigest({ claim });
}

export interface ReadinessCandidate {
  key: string;
  label: string;
  axis: "knowledge" | "requirement";
  memId: string;
  claim: string;
  claimDigest: string;
  /** claim 源轮(用户说这句话的轮;快照锚) */
  sourceTurnId: string;
}

interface BindingRow {
  id: string;
  key: string;
  axis: string;
  mem_id: string;
  claim_digest: string;
  foundation_generation: number | null;
}

/**
 * 待确认候选(confirmReadiness 环的渲染源):项目 active claims 中带合法 readinessKey、
 * trust 人背书、source=user_utterance,且其 (key, claimDigest) 尚无现役绑定的——
 * 已确认过的同内容 claim 不重复上环;同 key 新说法(digest 变)会再次上环(确认后旧绑定 supersede)。
 */
export function listCandidates(deps: { db: Db; ledger: MemoryLedger }, projectId: string, type: ProjectType): ReadinessCandidate[] {
  const checklist = READINESS_CHECKLISTS[type];
  if (!checklist || checklist.length === 0) return [];
  const byKey = new Map(checklist.map((d) => [d.key, d]));
  const activeBindings = deps.db
    .prepare("SELECT id, key, axis, mem_id, claim_digest, foundation_generation FROM readiness_bindings WHERE project_id = ? AND superseded_at IS NULL")
    .all(projectId) as BindingRow[];
  const bound = new Set(activeBindings.map((b) => `${b.key}\u0000${b.claim_digest}`));

  const out: ReadinessCandidate[] = [];
  for (const m of deps.ledger.project()) {
    if (m.projectId !== projectId || !m.readinessKey) continue;
    const dim = byKey.get(m.readinessKey);
    if (!dim) continue; // 词表失配 = 未覆盖(清单演化语义,不报错)
    if (m.trust !== "user_stated" && m.trust !== "user_approved") continue;
    if (m.source.kind !== "user_utterance") continue;
    const digest = claimDigestOf(m.claim);
    if (bound.has(`${m.readinessKey}\u0000${digest}`)) continue;
    out.push({
      key: m.readinessKey,
      label: dim.label,
      axis: dim.axis,
      memId: m.id,
      claim: m.claim,
      claimDigest: digest,
      sourceTurnId: m.source.ref
    });
  }
  // 同 key 多候选:取最新(账本序 = ts 序,project() 保序——后写覆盖),一环一 key 一条
  const latestByKey = new Map<string, ReadinessCandidate>();
  for (const c of out) latestByKey.set(c.key, c);
  return [...latestByKey.values()];
}

/** 复述清单机械渲染(10 #41 锁定档;Brain 不得改写——TTS 与屏幕卡同文) */
export function renderReadinessChecklist(candidates: ReadinessCandidate[]): string {
  // J3:claim 常被模型带上 label 前缀("粗目标:…"),机械拼接会成"粗目标:粗目标:…"——剥重复前缀
  const stripLabelPrefix = (label: string, claim: string): string => {
    const t = claim.trim();
    for (const sep of [":", ":"]) {
      if (t.startsWith(`${label}${sep}`)) return t.slice(label.length + sep.length).trim();
    }
    return t;
  };
  // N4(8/6 轨 A):claim 冗长嵌套把普通用户吓跑——单条截 80 字+清换行(全文在系统记录里,复述卡只读要点)
  const tidy = (v: string): string => {
    const t = v.replace(/\s+/g, " ").trim();
    return t.length > 80 ? `${t.slice(0, 80)}…` : t;
  };
  const items = candidates.map((c) => `「${c.label}:${tidy(stripLabelPrefix(c.label, c.claim))}」`).join(";");
  return `我跟你确认几点(记错了单说哪条):${items}。——都对吗?`;
}

export interface ConfirmBindingsDeps {
  db: Db;
  audit: AuditSink;
  /** §4.1 快照链(确认时捕获 claim 源轮转写快照;capture 失败 ⇒ 整环拒,fail-closed) */
  snapshotter: Pick<Snapshotter, "capture"> | null;
  /** knowledge 轴绑定的奠基代(换代 ⇒ 绑定失效);无奠基项目返回 0 */
  foundationGenerationOf: (projectId: string) => number;
  now?: () => Date;
}

/**
 * 确认升格事务(confirm 环 accept 后调用;09 §13):逐 key 落 ReadinessBinding + 同 key 旧绑定
 * 自动 superseded(机械,不靠 prompt 纪律)+ snapshot 链。candidates = 环发起时的渲染快照
 * (确认的是用户听到的那批,不重列——防确认与新增候选竞态)。
 */
export function confirmBindings(
  deps: ConfirmBindingsDeps,
  input: { sessionId: string; turnId: string; projectId: string; receiptId: string; candidates: ReadinessCandidate[] }
): { receiptId: string; bindingIds: string[] } {
  if (input.candidates.length === 0) throw new Error("no candidates to confirm");
  const nowIso = (deps.now ?? (() => new Date()))().toISOString();
  const receiptId = input.receiptId;
  const bindingIds: string[] = [];

  // 快照先行(文件 IO 不进 SQLite 事务;失败即整环拒——绑定行要求锚可回读)
  const snapshotByMem = new Map<string, string>();
  if (deps.snapshotter) {
    for (const c of input.candidates) {
      const snap = deps.snapshotter.capture({ kind: "user_utterance", ref: c.sourceTurnId });
      snapshotByMem.set(c.memId, snap.id);
    }
  }

  const tx = deps.db.transaction(() => {
    for (const c of input.candidates) {
      const id = newId("rbd");
      const gen = c.axis === "knowledge" ? deps.foundationGenerationOf(input.projectId) : null;
      // 同 key 旧绑定 supersede(确认事务内机械做;Codex 23 A-2-5)
      deps.db
        .prepare("UPDATE readiness_bindings SET superseded_at = ?, superseded_by = ? WHERE project_id = ? AND key = ? AND superseded_at IS NULL")
        .run(nowIso, id, input.projectId, c.key);
      deps.db
        .prepare(
          `INSERT INTO readiness_bindings(id, project_id, key, axis, mem_id, claim_digest, snapshot_id, receipt_id,
             session_id, turn_id, foundation_generation, bound_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(id, input.projectId, c.key, c.axis, c.memId, c.claimDigest, snapshotByMem.get(c.memId) ?? null, receiptId, input.sessionId, input.turnId, gen, nowIso);
      const snapId = snapshotByMem.get(c.memId);
      if (snapId) {
        insertClaimSnapshotLink(deps.db, {
          projectId: input.projectId,
          memoryEventId: c.memId,
          claimDigest: c.claimDigest,
          snapshotId: snapId,
          createdAt: nowIso
        });
      }
      bindingIds.push(id);
    }
  });
  tx();

  deps.audit.record({
    actor: "owner",
    action: "memory.readiness_confirmed",
    meta: { receiptId, sessionId: input.sessionId, turnId: input.turnId, projectId: input.projectId, keys: input.candidates.map((c) => c.key), bindingIds }
  });
  return { receiptId, bindingIds };
}

export interface EvidenceDeps {
  db: Db;
  ledger: MemoryLedger;
  foundationGenerationOf: (projectId: string) => number;
}

/**
 * 证据 provider(armed 注入;09 §13):covered = 现役 confirmed 绑定 key 集(结构化明细供
 * evidenceDigest 版本锚)。现算不缓存——forget/换代后即时反映(撤销传导)。
 */
export function evidenceFor(deps: EvidenceDeps, projectId: string): ReadinessEvidenceDetail {
  const rows = deps.db
    .prepare(
      "SELECT id, key, axis, mem_id, claim_digest, foundation_generation FROM readiness_bindings WHERE project_id = ? AND superseded_at IS NULL ORDER BY key, id"
    )
    .all(projectId) as BindingRow[];
  if (rows.length === 0) return { covered: [], bindings: [] };
  const activeMem = new Set(deps.ledger.project().filter((m) => m.projectId === projectId).map((m) => m.id));
  const gen = deps.foundationGenerationOf(projectId);
  const bindings: ReadinessEvidenceBinding[] = [];
  for (const b of rows) {
    if (!activeMem.has(b.mem_id)) continue; // 底层 claim 已 forget/invalidate/supersede/过期 ⇒ 绑定非现役
    if (b.axis === "knowledge" && b.foundation_generation !== gen) continue; // 奠基换代 ⇒ knowledge 绑定失效
    bindings.push({ key: b.key, memId: b.mem_id, claimDigest: b.claim_digest, bindingId: b.id });
  }
  return { covered: [...new Set(bindings.map((b) => b.key))], bindings };
}
