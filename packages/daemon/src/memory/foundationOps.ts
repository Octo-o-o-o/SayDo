// W2 阶段 C · 奠基生产接线(05 §4 提前批 #4;04 §1.2/§1.3;modules/b B3):
// 此前 FoundationBuilder.bootstrap 无生产调用点(库层就绪、只有 warmup 被 seedTerms 消费)。
// 本模块 = 项目 -> 奠基 -> 账本挂线(事实经 classifyTrust 自然分级)-> 旧代事实失效(生长闭环
// 的"失效"半边)-> M1 人可读投影刷新;API 面在 index.ts(POST /api/projects/:id/foundation/bootstrap,
// 仅受信终端——奠基写仓库文件,不对 tailnet 开)。

import { existsSync } from "node:fs";
import {
  idSchema,
  type GitProtectionResult,
  type KnowledgePrivacyFailureClass,
  type KnowledgePrivacyPrescription,
  type KnowledgePrivacySafeHit
} from "@saydo/contracts";
import type { AuditSink } from "../obs/audit.js";
import type { Db } from "../storage/db.js";
import type { MemoryLedger } from "./ledger.js";
import {
  FoundationBuilder,
  isFoundationBuildRestrictedError,
  renderProgressLine,
  type FoundationManifest
} from "./foundation.js";
import { isGitProtectionInsufficientError } from "./gitProtection.js";
import { projectM1Notes } from "./growth.js";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";

export interface BootstrapDeps {
  db: Db;
  ledger: MemoryLedger;
  audit: AuditSink;
  /** 预算([params] foundation_budget_min/foundation_budget_tokens;调用方读配置) */
  budgets?: { walltimeMs: number; tokens: number };
  /** 仅投影步骤可注入;bootstrap 复用已验证保护结果时不应被调用。 */
  projectM1NotesGit?: { noteGitCall?: () => void };
}

export interface BootstrapResult {
  ok: boolean;
  code?: string;
  message?: string;
  generation?: number;
  status?: FoundationManifest["status"];
  progressLine?: string;
  factsEmitted?: number;
  invalidatedOld?: number;
  failureClass?: KnowledgePrivacyFailureClass;
  safeHits?: KnowledgePrivacySafeHit[];
  overflowCount?: number;
  gitProtection?: { status: GitProtectionResult["status"]; relativeTarget?: string };
  prescription?: KnowledgePrivacyPrescription;
}

/** 项目奠基(首次/重奠基同链;重奠基 ⇒ generation+1 ⇒ 旧 Context Pack 失效重编译,见 live/pack.ts) */
export function bootstrapProjectFoundation(deps: BootstrapDeps, projectId: string, now = new Date().toISOString()): BootstrapResult {
  // 系统边界输入验证(API 路由参数):非法 id 快速失败——否则会在 publish 之后的 ledger.add
  // 才炸,把已发布的 generation 翻转成"失败返回"(OctoDesk 首奠实测踩坑,2026-07-26)
  if (!idSchema.safeParse(projectId).success) {
    return { ok: false, code: "invalid_project_id", message: `projectId 不合 ULID 形态:${projectId.slice(0, 40)}` };
  }
  const row = deps.db.prepare("SELECT status FROM projects WHERE id=?").get(projectId) as
    | { status: string }
    | undefined;
  if (!row) return { ok: false, code: "not_found", message: `project not found: ${projectId}` };
  let workspace: string | null;
  try {
    workspace = verifiedProjectWorkspace(deps.db, projectId);
  } catch {
    return { ok: false, code: "workspace_identity_changed", message: "工作区 identity 已变化,奠基已停止" };
  }
  if (!workspace) {
    return { ok: false, code: "no_workspace", message: "项目没有本地工作区,奠基不了" };
  }
  if (!existsSync(workspace)) {
    return { ok: false, code: "workspace_missing", message: "工作区路径不存在" };
  }

  // 旧代事实清单先取快照(迟到评审 B1 回收:invalidate 移到 bootstrap **成功之后**——
  // 此前先失效后奠基,奠基失败会留下"投影无奠基事实 + knowledge/current 仍旧代"的口径分裂)
  const oldFacts = deps.ledger
    .project(now)
    .filter((m) => m.projectId === projectId && m.source.ref.startsWith("foundation@"))
    .map((m) => m.id);

  let factsEmitted = 0;
  let factsFailed = 0;
  const builder = new FoundationBuilder({
    workspace,
    ...(deps.budgets ? { budgets: deps.budgets } : {}),
    onFact: (fact) => {
      // 单条事实写入失败不作废奠基(底座是主体、事实是增强;emitFacts 在 publish 之后跑,
      // 这里抛出会把已发布的 generation 翻转成失败返回——只记审计继续)
      try {
        deps.ledger.add({
          tier: "M1",
          projectId,
          claim: fact.claim,
          source: { kind: "repo_file", ref: fact.sourceRef },
          gitTracked: true
        });
        factsEmitted += 1;
      } catch (err) {
        factsFailed += 1;
        deps.audit.record({
          actor: "daemon",
          action: "foundation.fact_write_failed",
          meta: { projectId, error: String(err).slice(0, 160) }
        });
      }
    }
  });
  const previousGeneration = builder.currentGeneration();
  let manifest: FoundationManifest;
  try {
    manifest = builder.bootstrap(now);
  } catch (err) {
    if (isFoundationBuildRestrictedError(err) || isGitProtectionInsufficientError(err)) {
      const failureClass: KnowledgePrivacyFailureClass =
        previousGeneration > 0 ? "foundation_refresh_failed_kept_old" : "foundation_first_build_unavailable";
      const code = err.code;
      const gitProtection = isGitProtectionInsufficientError(err) ? err.gitProtection : undefined;
      const safeHits = isFoundationBuildRestrictedError(err) ? err.safeHits : [];
      const overflowCount = isFoundationBuildRestrictedError(err) ? err.overflowCount : undefined;
      const auditHits = isFoundationBuildRestrictedError(err) ? err.auditHits : [];
      const prescription = isGitProtectionInsufficientError(err) ? err.prescription : "remove_source_literal";
      deps.audit.record({
        actor: "daemon",
        action: "foundation.bootstrap_failed",
        meta: {
          projectId,
          code,
          failureClass,
          hits: auditHits.map((hit) => ({ kind: hit.kind, spanDigest: hit.spanDigest })),
          ...(gitProtection ? { gitProtection: gitProtection.status } : {})
        }
      });
      return {
        ok: false,
        code,
        message: err.message,
        failureClass,
        safeHits,
        ...(overflowCount !== undefined && overflowCount > 0 ? { overflowCount } : {}),
        ...(gitProtection
          ? {
              gitProtection: {
                status: gitProtection.status,
                ...(gitProtection.relativeTarget ? { relativeTarget: gitProtection.relativeTarget } : {})
              }
            }
          : {}),
        prescription
      };
    }
    // 发布失败保留旧 generation(builder.publish 原子性);如实报错
    deps.audit.record({
      actor: "daemon",
      action: "foundation.bootstrap_failed",
      meta: { projectId, code: err instanceof Error ? err.name : "unknown" }
    });
    return { ok: false, code: "bootstrap_failed", message: "奠基失败,请在受信屏幕查看诊断" };
  }
  // 奠基成功后再失效旧代(invalidate 不复活,04 §1.3 失效标记而非删除;新代事实已入账)
  if (oldFacts.length > 0) {
    deps.ledger.invalidate("invalidate", oldFacts, `refoundation: superseded by gen-${manifest.generation}`, "M1", projectId);
  }
  projectM1Notes(deps.ledger, projectId, workspace, now, {
    ...(builder.lastGitProtection ? { protection: builder.lastGitProtection } : {}),
    audit: deps.audit,
    ...(deps.projectM1NotesGit?.noteGitCall ? { noteGitCall: deps.projectM1NotesGit.noteGitCall } : {})
  });
  deps.audit.record({
    actor: "daemon",
    action: "foundation.bootstrap",
    meta: { projectId, generation: manifest.generation, status: manifest.status, factsEmitted, factsFailed, invalidatedOld: oldFacts.length }
  });
  return {
    ok: true,
    generation: manifest.generation,
    status: manifest.status,
    progressLine: renderProgressLine(manifest),
    factsEmitted,
    invalidatedOld: oldFacts.length
  };
}
