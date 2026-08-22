// W5a 3.5:项目级模型/预算覆盖(02 §5.1"全局默认 + 项目覆盖";08 §6 项目设置行;PLAN-2 5.5)。
// 承载 = daemon 受控设置表 project_settings(v7)——**绝不落 project.toml**:09 §11 白名单把
// models/providers 列为项目层禁键(仓库随附输入不可信),该白名单是安全面不放宽;本表只经
// console 受信终端写口(tailnet 403)。
// 可覆盖面(02 §5.1 表):dialog/thinking 仅允许 API binding / dev(开发档:执行 agent 的
// model)+ budget(maxCost/walltimeActiveMin/maxTurns)。evaluator **不可覆盖**(异族护栏的
// 锚点档;覆盖它 = 在设置里悄悄放倒护栏)。
// 家族护栏(02 §5.1"一条护栏"):项目模型覆盖不得把原本异族的槽新改成 evaluator 同族；
// 全局已经显式 ack 的同族组合可被同族内冗余覆盖继承，budget/dev-only 覆盖不重复索取 ack。
// 成本三档预设不做(PLAN-2 §6-11 挂 owner 点名)。

import { z } from "zod";
import { modelBindingSchema, type ModelBinding } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { SaydoConfig } from "./types.js";
import { resolveFamily, type Violation } from "./validate.js";

export const projectOverridesSchema = z.strictObject({
  models: z
    .strictObject({
      dialog: modelBindingSchema.optional(),
      thinking: modelBindingSchema.optional(),
      /** 开发档(执行 agent 的 model;agent 词表=当前已接线后端 cursor/claude_code;codex 随后续批放开) */
      dev: z.strictObject({ agent: z.enum(["cursor", "claude_code"]), model: z.string().min(1) }).optional()
    })
    .optional(),
  budget: z
    .strictObject({
      maxCost: z.number().positive().optional(),
      walltimeActiveMin: z.number().int().positive().optional(),
      maxTurns: z.number().int().positive().optional()
    })
    .optional()
});
export type ProjectOverrides = z.infer<typeof projectOverridesSchema>;

export type OverridesValidation = { ok: true; overrides: ProjectOverrides } | { ok: false; violations: Violation[] };

/**
 * 写入前校验(fail-closed):schema + 项目模型覆盖恒拒 CLI(09 §11 T18a)+ 覆盖后组合的
 * evaluator 异族护栏(02 §5.1:护栏不得在设置里悄悄失效)。
 */
export function validateProjectOverrides(global: SaydoConfig, input: unknown): OverridesValidation {
  const parsed = projectOverridesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, violations: [{ code: "invalid_overrides", message: parsed.error.message.slice(0, 300) }] };
  }
  const ov = parsed.data;
  const violations: Violation[] = [];
  const providers = global.providers?.api;

  for (const slot of ["dialog", "thinking"] as const) {
    const binding = ov.models?.[slot];
    if (binding !== undefined) {
      const provider = typeof binding === "string" ? "api" : binding.provider;
      if (provider === "api") continue;
      violations.push({
        code: "project_override_cli_rejected",
        slot,
        message: `项目级 ${slot} 覆盖恒拒 CLI;CLI binding 只允许出现在全局模型配置`
      });
    }
  }

  // 覆盖后的组合:dialog/thinking 取覆盖值(缺省回全局),evaluator 恒全局(不可覆盖)
  const merged: Record<"dialog" | "thinking" | "evaluator", ModelBinding> = {
    dialog: ov.models?.dialog ?? global.models.dialog,
    thinking: ov.models?.thinking ?? global.models.thinking,
    evaluator: global.models.evaluator
  };
  const families: Record<string, string | null> = {};
  const globalFamilies: Record<string, string | null> = {};
  for (const slot of ["dialog", "thinking", "evaluator"] as const) {
    const r = resolveFamily(slot, merged[slot], providers);
    if ("violation" in r) {
      // evaluator 槽的全局解析问题不算覆盖的错(启动校验管);覆盖槽解析不出 => 拒
      if (slot !== "evaluator") violations.push(r.violation);
      families[slot] = null;
    } else {
      families[slot] = r.family;
    }
    const globalFamily = resolveFamily(slot, global.models[slot], providers);
    globalFamilies[slot] = "violation" in globalFamily ? null : globalFamily.family;
  }
  const fe = families["evaluator"];
  const clash = (["dialog", "thinking"] as const).find(
    (slot) =>
      ov.models?.[slot] !== undefined &&
      fe !== null &&
      fe === families[slot] &&
      globalFamilies[slot] !== fe
  );
  if (fe && clash) {
    violations.push({
      code: "evaluator_same_family",
      slot: clash,
      message: `覆盖后的组合违反异族护栏(02 §5.1/04 §2.3):evaluator=${fe} 与覆盖后的 ${clash} 同族——护栏不得在项目设置里悄悄失效`,
      fix: `把项目覆盖的 ${clash} 换成非 ${fe} 家族,或不覆盖该档`
    });
  }
  return violations.length === 0 ? { ok: true, overrides: ov } : { ok: false, violations };
}

/**
 * 全局配置保存/启动时重验全部存量项目覆盖。全局 evaluator 变更不能让原本合法的项目
 * dialog/thinking 覆盖在重启后静默变成同族；项目新造成的同族组合不能消费全局 ack，
 * 未改模型的 budget/dev-only 覆盖则继承已经过全局校验的模型组合。
 */
export function validateStoredProjectOverrides(db: Db, global: SaydoConfig): Violation[] {
  return inspectStoredProjectOverrides(db, global).flatMap((issue) => issue.violations);
}

export interface StoredProjectOverrideIssue {
  projectId: string;
  violations: Violation[];
}

/** recovery 自救与启动校验共用同一逐项目判定，避免按错误文案反解析 project id。 */
export function inspectStoredProjectOverrides(db: Db, global: SaydoConfig): StoredProjectOverrideIssue[] {
  const rows = db.prepare("SELECT project_id, overrides_json FROM project_settings ORDER BY project_id").all() as {
    project_id: string;
    overrides_json: string;
  }[];
  const issues: StoredProjectOverrideIssue[] = [];
  for (const row of rows) {
    let raw: unknown;
    try {
      raw = JSON.parse(row.overrides_json);
    } catch {
      issues.push({
        projectId: row.project_id,
        violations: [{
          code: "project_override_invalid",
          message: `项目 ${row.project_id} 的存量覆盖不可读,拒绝启用全局模型配置`
        }]
      });
      continue;
    }
    const result = validateProjectOverrides(global, raw);
    if (result.ok) continue;
    issues.push({
      projectId: row.project_id,
      violations: result.violations.map((violation) => ({
        ...violation,
        code: violation.code.startsWith("project_override_") ? violation.code : `project_override_${violation.code}`,
        message: `项目 ${row.project_id}:${violation.message}`
      }))
    });
  }
  return issues;
}

/** 用户在 recovery UI 明确确认后，只删除其点名且当前仍非法的 project_settings 行。 */
export function clearInvalidStoredProjectOverrides(
  db: Db,
  global: SaydoConfig,
  requestedProjectIds: readonly string[]
): string[] {
  const invalid = new Set(inspectStoredProjectOverrides(db, global).map((issue) => issue.projectId));
  const projectIds = [...new Set(requestedProjectIds)].filter((projectId) => invalid.has(projectId)).sort();
  if (projectIds.length === 0) return [];
  const remove = db.prepare("DELETE FROM project_settings WHERE project_id=?");
  db.transaction(() => {
    for (const projectId of projectIds) remove.run(projectId);
  })();
  return projectIds;
}

// ---------- DAO(daemon 受控表;console 受信终端写口专用) ----------

export function getProjectOverrides(db: Db, projectId: string): ProjectOverrides | null {
  const row = db.prepare("SELECT overrides_json FROM project_settings WHERE project_id=?").get(projectId) as
    | { overrides_json: string }
    | undefined;
  if (!row) return null;
  try {
    return projectOverridesSchema.parse(JSON.parse(row.overrides_json));
  } catch {
    return null; // 落库损坏按无覆盖(fail-safe 回全局;写路径有校验,此路径仅防御)
  }
}

export function upsertProjectOverrides(db: Db, projectId: string, overrides: ProjectOverrides, nowIso: string): void {
  db.prepare(
    `INSERT INTO project_settings(project_id, overrides_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET overrides_json=excluded.overrides_json, updated_at=excluded.updated_at`
  ).run(projectId, JSON.stringify(overrides), nowIso);
}

// ---------- 生效链解析(单元锚) ----------

/** dialog/thinking 生效 binding:项目覆盖 > 全局(02 §5.1 解析顺序) */
export function effectiveModelBinding(
  global: SaydoConfig,
  overrides: ProjectOverrides | null,
  slot: "dialog" | "thinking"
): { binding: ModelBinding; source: "project" | "global" } {
  const ov = overrides?.models?.[slot];
  if (ov !== undefined) return { binding: ov, source: "project" };
  return { binding: global.models[slot], source: "global" };
}

/** 开发档生效 model(执行器 claim 消费;agent 面由执行器自身校验——非 cursor 后端启动即拒) */
export function effectiveDevModel(globalModel: string, overrides: ProjectOverrides | null): { model: string; source: "project" | "global" } {
  const ov = overrides?.models?.dev;
  if (ov) return { model: ov.model, source: "project" };
  return { model: globalModel, source: "global" };
}

/**
 * W5.4-b C1(09 §11 claude_code 承载段):开发档生效 model 的 adapter 匹配版。
 * dev.agent !== 生效 adapter ⇒ 忽略该 override 回全局,返回 ignored 供消费方审计
 * `tier1.model_override_ignored_adapter_mismatch`(覆盖不跨后端漂移:cursor 的模型名对 claude 无意义,反之亦然)。
 * 消费点 = executor.resolveRunModel(C2 接线;schema enum 已放开 claude_code)。
 */
export function effectiveDevModelForAdapter(
  globalModel: string,
  overrides: ProjectOverrides | null,
  effectiveAdapter: string
): {
  model: string;
  source: "project" | "global";
  ignored?: { overrideAgent: string; effectiveAdapter: string };
} {
  const ov = overrides?.models?.dev;
  if (!ov) return { model: globalModel, source: "global" };
  if (ov.agent !== effectiveAdapter) {
    return {
      model: globalModel,
      source: "global",
      ignored: { overrideAgent: ov.agent, effectiveAdapter }
    };
  }
  return { model: ov.model, source: "project" };
}

/** 预算生效值(dispatch 时消费:包 cost.max 与任务三熔断预算) */
export function effectiveBudget(
  defaults: { maxCost: number; walltimeActiveMin: number; maxTurns: number },
  overrides: ProjectOverrides | null
): { maxCost: number; walltimeActiveMin: number; maxTurns: number; source: "project" | "global" } {
  const b = overrides?.budget;
  if (!b) return { ...defaults, source: "global" };
  return {
    maxCost: b.maxCost ?? defaults.maxCost,
    walltimeActiveMin: b.walltimeActiveMin ?? defaults.walltimeActiveMin,
    maxTurns: b.maxTurns ?? defaults.maxTurns,
    source: "project"
  };
}
