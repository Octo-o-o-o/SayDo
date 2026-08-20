// draft 项目全流程(计划 2.4;09 §1/§13):开口即建 createProjectDraft -> 识别回填(转写/候选记忆挂 draft)
// -> promoteProject 转正(触发时机 = 奠基完成或首个决策包后,调用方 A 域掌握)
// -> 或 reanchorDraft 并回既有项目(AI 提议、用户确认后,绝不自动执行——确认动作在调用方,
//    本层是确认后的执行原语):候选记忆按 §4 candidate 写路径并入,draft -> archived + reanchoredTo。
// 状态转换均落审计(09 §0 通用约定——评审 B-6)。

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { newId, type Project, type ProjectType } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { getProject, insertProject, promoteProjectRow, archiveReanchoredRow } from "../storage/dao/projects.js";
import type { MemoryLedger } from "../memory/ledger.js";
import type { AuditSink } from "../obs/audit.js";
import { managedProjectPath } from "./workspace.js";

/** 开口即建:type=pending(词表规定仅 draft 态)、系统管理文件夹(03 §6 非代码项目缺省) */
export function createProjectDraft(db: Db, audit: AuditSink, now: string): Project {
  const id = newId("prj");
  const draft: Project = {
    id,
    title: "未命名草稿",
    type: "pending",
    status: "draft",
    workspace: { kind: "local_folder", path: managedProjectPath(id), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: now,
    updatedAt: now
  };
  insertProject(db, draft);
  audit.record({ actor: "daemon", action: "project.create_draft", meta: { projectId: id } });
  return draft;
}

/** 转正(奠基完成/首个决策包后触发,09 §13):draft -> active,type 必须定型(不得再 pending) */
export function promoteProject(
  db: Db,
  audit: AuditSink,
  input: { projectId: string; title: string; type: Exclude<ProjectType, "pending"> },
  now: string
): Project {
  const p = getProject(db, input.projectId);
  if (!p) throw new Error(`project not found: ${input.projectId}`);
  if (p.status !== "draft") throw new Error(`promote requires draft status, got ${p.status}`);
  if (p.type !== "pending" && p.type !== input.type) {
    throw new Error(`project type is already ${p.type}; promote cannot change it to ${input.type}`);
  }
  promoteProjectRow(db, { id: input.projectId, title: input.title, type: input.type, updatedAt: now });
  // 转正 = 进入备份保护范围:备份把 active 项目的 .saydo/foundation 与 .saydo/knowledge 列为
  // **必需**源(backup/snapshot.ts activeWorkspaceSources),而这两个目录原本是懒创建的
  // (knowledge 要等第一次写 M1 笔记)——一个刚立起、还没奠基的项目会让**整轮**定时备份直接失败。
  // 与 SAYDO_HOME 的 sessions/ 同一处理:在进入保护范围的这一刻补齐标准结构。
  ensureProjectBackupDirs(p.workspace);
  audit.record({
    actor: "daemon",
    action: "project.promote",
    meta: { projectId: input.projectId, type: input.type }
  });
  return getProject(db, input.projectId) as Project;
}

/**
 * 备份必需的项目标准目录。
 * managed 目录归 daemon 所有,可以整棵建;外部文件夹只在它本来就在时补子目录——
 * 不为了让备份过关而在用户机器上凭空造出一棵目录树。
 */
function ensureProjectBackupDirs(workspace: Project["workspace"]): void {
  if (workspace.kind !== "local_folder") return;
  if (!workspace.managed && !existsSync(workspace.path)) return;
  mkdirSync(join(workspace.path, ".saydo", "foundation"), { recursive: true });
  mkdirSync(join(workspace.path, ".saydo", "knowledge"), { recursive: true });
}

export interface ReanchorResult {
  merged: number;
  draft: Project;
}

/**
 * 并回既有项目(用户已确认):draft 的候选记忆按 candidate 写路径并入 target
 * (source.kind=import ⇒ classifyTrust 自然落 candidate,09 §1"按 §4 candidate 写路径");
 * expiresAt/taint 随并入透传(评审 B-5:临时事实不因换 id 永生、污染源信息不断链);
 * M0 是跨项目档案不挂 projectId,天然不在并入集合(若有挂 draft 的 M0 事实,降 M1 并入——M0 红线不破)。
 * 整体事务包裹(评审 B-4):并入与归档之间崩溃不产生"半并入 + 仍 draft 可重跑"的重复并入窗口。
 */
export function reanchorDraft(
  db: Db,
  ledger: MemoryLedger,
  audit: AuditSink,
  input: { draftId: string; targetId: string },
  now: string
): ReanchorResult {
  const draft = getProject(db, input.draftId);
  if (!draft) throw new Error(`draft not found: ${input.draftId}`);
  if (draft.status !== "draft") throw new Error(`reanchor requires draft status, got ${draft.status}`);
  const target = getProject(db, input.targetId);
  if (!target) throw new Error(`target not found: ${input.targetId}`);
  if (target.status !== "active") throw new Error(`reanchor target must be active, got ${target.status}`);

  const tx = db.transaction(() => {
    let count = 0;
    for (const m of ledger.project(now)) {
      if (m.projectId !== input.draftId) continue;
      ledger.add({
        tier: m.tier === "M0" ? "M1" : m.tier,
        projectId: input.targetId,
        claim: m.claim,
        source: { kind: "import", ref: `reanchor:${input.draftId}` },
        ...(m.expiresAt ? { expiresAt: m.expiresAt } : {}),
        ...(m.taint && m.taint.length > 0 ? { taint: m.taint } : {})
      });
      count += 1;
    }
    archiveReanchoredRow(db, { id: input.draftId, reanchoredTo: input.targetId, updatedAt: now });
    return count;
  });
  const merged = tx();
  audit.record({
    actor: "daemon",
    action: "project.reanchor",
    meta: { draftId: input.draftId, targetId: input.targetId, merged }
  });
  return { merged, draft: getProject(db, input.draftId) as Project };
}
