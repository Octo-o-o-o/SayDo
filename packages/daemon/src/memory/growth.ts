// W2 阶段 C · 记忆生长闭环(04 §1.3;05 §4 提前批 #4;modules/b B2/B3):
// 会后提炼:session 挂起时从对话史机械提名"稳定结论"候选(candidate)——**只提名、人批准**
// (04 §1.3 consolidation 纪律;自动化留 P2);批准 = user_approved 新事件 supersedes 候选
// (raw -> candidate -> 人批 -> trusted 写路径,09 §4);拒绝 = forget_soft(否定不复活)。
// 提名器是机械规则(零模型成本、确定性可测);LLM 提名增强随 dogfood 观察再评,不预先接。
// M1 人可读投影(AGENTS.md 互通写侧,04 §1.2):trusted M1 渲染到 <workspace>/.saydo/knowledge/
// m1-notes.md——账本为真相源,文件是投影;P0 无 watcher,人工改文件不回写(要改对 SayDo 说)。

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { GitProtectionResult, MemoryEvent } from "@saydo/contracts";
import type { AuditSink } from "../obs/audit.js";
import type { MemoryLedger, ProjectedMemory } from "./ledger.js";
import { isImperative } from "./classify.js";
import { isMemorySecretLiteralError } from "./credentialLiterals.js";
import { ensureGitProtection, writePrivateLeafSync } from "./gitProtection.js";

/** 决策性标记(命中其一才提名——保守窄口,防候选淹没 review 面) */
const DECISION_MARKERS =
  /(决定|定了|就用|就按|以后都|统一用|统一按|规则是|口径是|约定|拍板|确定用|不再用|改成用|优先用)/;

/** 问句/征询(不提名:疑问不是结论) */
const QUESTION_TAIL = /[??]$|[吗呢]\s*$/;

export interface NominateInput {
  sessionId: string;
  projectId: string;
  /** 对话史用户轮文本(unheard 已滤;审批裁决轮已被 excludeFromHistory 排除) */
  userTurns: readonly string[];
  /** 每会话提名上限(缺省 5) */
  limit?: number;
}

/** 机械提名判定(导出便于 §12 反例测试) */
export function isNominatable(text: string): boolean {
  const t = text.trim();
  if (t.length < 8 || t.length > 120) return false;
  if (QUESTION_TAIL.test(t)) return false;
  if (isImperative(t)) return false; // 指令/副作用句不是"稳定结论"(且 classify 会降级,双保险)
  return DECISION_MARKERS.test(t);
}

/**
 * 会后提炼(挂 LiveVoiceSessions.onSuspend):候选写账本(classifyTrust:user_utterance
 * 无 requestedTrust 自然落 candidate),与现存投影 claim 完全相同的不重复提名。
 */
export function nominateFromSession(
  deps: { ledger: MemoryLedger; audit: AuditSink },
  input: NominateInput
): MemoryEvent[] {
  const limit = input.limit ?? 5;
  // 去重口径(迟到评审 B2/C3 回收):账本历史全量(含被拒/失效的——forget_soft 不复活)
  // 且限定本项目 ∪ 全局;seen 只作本次批内去重
  const seen = new Set<string>();
  const out: MemoryEvent[] = [];
  let skipped = 0;
  for (const text of input.userTurns) {
    if (out.length >= limit) break;
    const t = text.trim();
    if (!isNominatable(t) || seen.has(t) || deps.ledger.hasClaimHistory(t, input.projectId)) continue;
    seen.add(t);
    try {
      out.push(
        deps.ledger.add({
          tier: "M1",
          projectId: input.projectId,
          claim: t,
          source: { kind: "user_utterance", ref: `session:${input.sessionId}`, quote: t }
        })
      );
    } catch (err) {
      if (isMemorySecretLiteralError(err)) {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }
  if (out.length > 0 || skipped > 0) {
    deps.audit.record({
      actor: "daemon",
      action: "memory.session_nominated",
      meta: { sessionId: input.sessionId, projectId: input.projectId, count: out.length, skipped }
    });
  }
  return out;
}

/** 候选批准(人批 -> trusted;09 §4 写路径):user_approved 新事件 supersedes 候选,taint 透传留痕 */
export function approveCandidate(
  deps: { ledger: MemoryLedger; audit: AuditSink },
  candidateId: string
): MemoryEvent {
  const m = deps.ledger.project().find((x) => x.id === candidateId);
  if (!m) throw new Error(`candidate not found (可能已被处理): ${candidateId}`);
  if (m.trust !== "candidate") throw new Error(`只有 candidate 可批准,得到 trust=${m.trust}`);
  const ev = deps.ledger.add({
    tier: m.tier,
    ...(m.projectId ? { projectId: m.projectId } : {}),
    claim: m.claim,
    source: m.source,
    requestedTrust: "user_approved",
    supersedes: candidateId,
    ...(m.taint && m.taint.length > 0 ? { taint: m.taint } : {})
  });
  deps.audit.record({ actor: "owner", action: "memory.candidate_approved", meta: { candidateId, newId: ev.id } });
  return ev;
}

/** 候选拒绝:forget_soft(投影退场,否定不复活) */
export function rejectCandidate(
  deps: { ledger: MemoryLedger; audit: AuditSink },
  candidateId: string
): MemoryEvent {
  const m = deps.ledger.project().find((x) => x.id === candidateId);
  if (!m) throw new Error(`candidate not found (可能已被处理): ${candidateId}`);
  if (m.trust !== "candidate") throw new Error(`只有 candidate 可拒绝,得到 trust=${m.trust}`);
  const ev = deps.ledger.invalidate("forget_soft", [candidateId], "owner rejected candidate", m.tier, m.projectId);
  deps.audit.record({ actor: "owner", action: "memory.candidate_rejected", meta: { candidateId } });
  return ev;
}

const TRUSTED: readonly string[] = ["user_stated", "user_approved", "auto_low_impact"];

/** M1 稳定结论 -> 人可读文件投影(<workspace>/.saydo/knowledge/m1-notes.md;可重放再生) */
export function renderM1Notes(facts: readonly ProjectedMemory[], generatedAt: string): string {
  const lines = [
    "# M1 稳定结论(SayDo 投影)",
    "",
    "> 账本(memory_events)为真相源,本文件由 SayDo 重投影生成、随每次批准/奠基刷新;",
    "> 直接改本文件不会回写记忆(P0 无 watcher)——要改就对 SayDo 说。",
    `> 更新:${generatedAt}`,
    ""
  ];
  const byTrust = new Map<string, ProjectedMemory[]>();
  for (const f of facts) {
    const arr = byTrust.get(f.trust) ?? [];
    arr.push(f);
    byTrust.set(f.trust, arr);
  }
  const SECTION: Record<string, string> = {
    user_stated: "## 用户亲述",
    user_approved: "## 用户确认",
    auto_low_impact: "## 机械事实(奠基/低影响自动入库)"
  };
  for (const trust of TRUSTED) {
    const arr = byTrust.get(trust);
    if (!arr || arr.length === 0) continue;
    lines.push(SECTION[trust] as string, "");
    for (const f of [...arr].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const taint = f.taint && f.taint.length > 0 ? `[taint:${f.taint.join(",")}] ` : "";
      lines.push(`- ${taint}${f.claim}(来源:${f.source.kind}:${f.source.ref})`);
    }
    lines.push("");
  }
  if (facts.length === 0) lines.push("(暂无稳定结论)", "");
  return lines.join("\n");
}

export interface ProjectM1NotesOpts {
  /** 同一 bootstrap 边界已验证的保护结果;传入则不再查询。 */
  protection?: GitProtectionResult;
  audit?: AuditSink;
  /** 未传入 protection 时转给 ensureGitProtection;用于边界 Git 计数。 */
  noteGitCall?: () => void;
}

/** 投影落盘(workspace 存在且 Git 保护通过才写;返回是否写了) */
export function projectM1Notes(
  ledger: MemoryLedger,
  projectId: string,
  workspacePath: string,
  now = new Date().toISOString(),
  opts: ProjectM1NotesOpts = {}
): boolean {
  if (!existsSync(workspacePath)) return false;
  const protection =
    opts.protection ??
    ensureGitProtection(workspacePath, {
      ...(opts.noteGitCall ? { noteGitCall: opts.noteGitCall } : {})
    });
  if (protection.status !== "protected" && protection.status !== "not_git") {
    opts.audit?.record({
      actor: "daemon",
      action: "memory.m1_notes_skipped",
      meta: { projectId, status: protection.status }
    });
    return false;
  }
  const facts = ledger
    .project(now)
    .filter((m) => m.tier === "M1" && m.projectId === projectId && TRUSTED.includes(m.trust));
  const leafRel = ".saydo/knowledge/m1-notes.md";
  const dir = join(workspacePath, ".saydo", "knowledge");
  mkdirSync(dir, { recursive: true });
  const written = writePrivateLeafSync(workspacePath, leafRel, renderM1Notes(facts, now));
  if (written.status !== "protected") {
    opts.audit?.record({
      actor: "daemon",
      action: "memory.m1_notes_skipped",
      meta: { projectId, status: written.status }
    });
    return false;
  }
  return true;
}
