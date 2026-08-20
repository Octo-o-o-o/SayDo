// 项目类型门禁(09 §13 proposeStart/issueDispatchReceipt/confirmAndDispatch 前置;§11 enabled_project_types;W4)。
// fail-closed:project.type ∉ enabled 集 ⇒ 拒(project_type_not_enabled)。§1/§9 词表含 writing/research
// 等非启用类型仅为 schema 前瞻,不代表能力开启(05 §4)。
// pending 生命周期(owner 裁决 2026-07-28 取 (a) 案,09 §13;Codex 22 新 A 关闭):保留"首包后转正"——
// pending 可 propose(首包 = 供 owner 过目的提案);拍板/派发一律拒(先 promoteProject 定型再拍板)。

import type { Db } from "../storage/db.js";

export type TypeGatePhase = "propose" | "dispatch";
export type TypeGateVerdict =
  | { ok: true; type: string }
  | { ok: false; code: "project_type_not_enabled" | "project_pending_promotion"; message: string };

export function assertProjectTypeEnabled(db: Db, projectId: string, enabled: string[], phase: TypeGatePhase): TypeGateVerdict {
  const row = db.prepare("SELECT type FROM projects WHERE id = ?").get(projectId) as { type: string } | undefined;
  if (!row) return { ok: false, code: "project_type_not_enabled", message: `项目不存在:${projectId}` };
  if (row.type === "pending") {
    if (phase === "propose") return { ok: true, type: row.type };
    return {
      ok: false,
      code: "project_pending_promotion",
      message: "这个项目还没定型——先说清楚它是什么类型(比如要写代码还是写文章),我把项目转正后你再拍板"
    };
  }
  if (!enabled.includes(row.type)) {
    return {
      ok: false,
      code: "project_type_not_enabled",
      message: `项目类型 ${row.type} 未启用(当前启用:${enabled.join("/")})——这类项目的能力还没开,先在配置里开值`
    };
  }
  return { ok: true, type: row.type };
}
