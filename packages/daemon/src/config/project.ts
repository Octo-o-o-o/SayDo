// 项目层配置生产全量加载(W1.3;09 §11 <workspace>/.saydo/project.toml;HANDOFF §2-8-② 清账)。
// 独立 schema,禁复用全局 configSchema 或其 partial 变体(types.ts 防踩注记:全局 schema 的
// privacy.prefault 会把键注入解析结果,白名单裁决会恒误报 rejectedKeys)。
// project.toml 是"仓库随附的不可信输入"(09 §11 白名单头注):
// - 顶层仅允许 [project]/[git]/[verify]/[setup]/[writing] 自有域 + 覆盖全局 budget/dnd/params;
// - models/providers/gate0/hopper/privacy/voice/pricing/tier1 等白名单外键出现一律拒收
//   (拒键不拒文件:合法域照常生效,拒收留痕由调用方审计——防克隆仓静默把 key 引到攻击者端点);
// - [git].protected 是减法敏感键:消费按 contracts effectiveProtectedBranches 并集公式,
//   项目值只能追加保护面、不能顶掉 main/master 安全默认;
// - params 内全局专属键(backup_retention_days)项目层覆盖被剥(applyProjectOverrides 经 mergeConfig)。
// 执行器专属的 [verify]/[setup] 消费(白名单模板 + setup 命令白名单形态)仍在 tier1/projectConfig.ts,
// 本模块只做全量解析、白名单裁决与覆盖域合并。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";
import { mergeConfig } from "./load.js";
import type { SaydoConfig } from "./types.js";

/** 项目层顶层白名单(09 §11:自有域 + 可覆盖全局域;此外一切键出现即拒收) */
export const PROJECT_ALLOWED_TOP_KEYS = ["project", "git", "verify", "setup", "writing", "budget", "dnd", "params"] as const;

// 域内部 looseObject:additive 前向兼容(域内新键不炸);顶层白名单裁决在 loadProjectConfig 手工做
// (strictObject 抛错无法"拒键不拒文件"并收集 rejectedKeys)。
const projectConfigSchema = z.looseObject({
  project: z
    .looseObject({
      type: z.string().optional(),
      exec_mode_default: z.string().optional()
    })
    .optional(),
  git: z
    .looseObject({
      protected: z.array(z.string()).optional()
    })
    .optional(),
  verify: z
    .looseObject({
      entries: z
        .array(z.looseObject({ name: z.string().min(1), source: z.string(), ref: z.string().min(1) }))
        .optional()
    })
    .optional(),
  setup: z.looseObject({ command: z.string().optional() }).optional(),
  budget: z.looseObject({}).optional(),
  dnd: z.looseObject({}).optional(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional()
});

export interface ProjectConfig {
  /** project.toml 是否存在(缺失 = 全空,合法) */
  present: boolean;
  /** 白名单外顶层键(出现即拒收;非空时调用方必须审计留痕) */
  rejectedKeys: string[];
  /** [git].protected 原样值(消费必须走 effectiveProtectedBranches 并集,不得直接替换) */
  gitProtected: readonly string[];
  projectType?: string;
  execModeDefault?: string;
  /** 可覆盖全局的三域(喂 applyProjectOverrides;params 全局专属键剥除在 merge 内) */
  overrides: Pick<Partial<SaydoConfig>, "budget" | "dnd" | "params">;
}

const EMPTY: ProjectConfig = { present: false, rejectedKeys: [], gitProtected: [], overrides: {} };

/**
 * 读 <repo>/.saydo/project.toml 全量:文件缺失 = 空(合法);存在但坏(TOML/schema)= 抛
 * (fail-closed,认领方转 blocked——与 readProjectExecConfig 同一错误面语义)。
 */
export function loadProjectConfig(repoPath: string): ProjectConfig {
  let text: string;
  try {
    text = readFileSync(join(repoPath, ".saydo", "project.toml"), "utf8");
  } catch (err) {
    // 仅"不存在"= 空合法;EACCES/EPERM 等"存在但读不了"rethrow(fail-closed,认领方转 blocked——
    // 否则 [git].protected 静默丢失;code-review C1)
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return EMPTY;
    throw err;
  }
  const raw = parseToml(text);
  const rejectedKeys = Object.keys(raw).filter(
    (k) => !(PROJECT_ALLOWED_TOP_KEYS as readonly string[]).includes(k)
  );
  const allowed = Object.fromEntries(Object.entries(raw).filter(([k]) => !rejectedKeys.includes(k)));
  const parsed = projectConfigSchema.parse(allowed);
  const out: ProjectConfig = {
    present: true,
    rejectedKeys,
    gitProtected: parsed.git?.protected ?? [],
    overrides: {
      ...(parsed.budget !== undefined ? { budget: parsed.budget } : {}),
      ...(parsed.dnd !== undefined ? { dnd: parsed.dnd } : {}),
      ...(parsed.params !== undefined ? { params: parsed.params } : {})
    }
  };
  if (parsed.project?.type !== undefined) out.projectType = parsed.project.type;
  if (parsed.project?.exec_mode_default !== undefined) out.execModeDefault = parsed.project.exec_mode_default;
  return out;
}

/**
 * 项目覆盖生效(白名单内解析顺序 项目>全局,09 §11):经 mergeConfig 复用既有白名单合并——
 * params 全局专属键(backup_retention_days)在此被剥并计入 rejectedKeys。
 */
export function applyProjectOverrides(
  global: SaydoConfig,
  project: ProjectConfig
): { config: SaydoConfig; rejectedKeys: string[] } {
  return mergeConfig(global, project.overrides);
}
