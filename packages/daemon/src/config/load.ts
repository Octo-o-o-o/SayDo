// 配置加载:全局(~/.saydo/config.toml)+ 项目(<workspace>/.saydo/project.toml)合并,解析顺序 项目>全局。
// (0.4 覆盖模型槽位在全局;项目覆盖同键的浅合并 + verify/setup/git 在项目层,后续 Phase 消费。)

import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import { configSchema, PARAM_DEFAULTS, type SaydoConfig } from "./types.js";

export function parseConfigText(text: string): SaydoConfig {
  return configSchema.parse(parseToml(text));
}

export function loadConfigFile(path: string): SaydoConfig {
  return parseConfigText(readFileSync(path, "utf8"));
}

/**
 * 项目 > 全局合并(白名单化,评审 B6):workspace 随附的 project.toml 是不可信输入,
 * 只允许覆盖低危键;models/providers/gate0/hopper/privacy/voice 项目层出现即拒
 * (否则克隆来的仓库可用 [providers.api.*] 把用户真实 key 引到攻击者端点)。
 */
const PROJECT_OVERRIDABLE_KEYS = ["budget", "dnd", "params"] as const;
// 白名单外一切键(models/providers/gate0/hopper/privacy/voice...)项目层出现即拒,缺省即禁。

/** params 中的全局专属键:项目层覆盖被剥除(如 backup_retention_days=0 会击穿 09 §4 备份保留,一致性评审收紧) */
// proposed_ttl_hours 全局专属(RA-closeout,Codex 21 B6 尾项 2026-07-28):恶意仓项目层缩短/拉长 proposed TTL
// 会操纵拍板窗口——与 enabled_project_types 同为安全面全局键,项目覆盖一律剥离
const PARAMS_GLOBAL_ONLY = ["backup_retention_days", "proposed_ttl_hours"] as const;

export function mergeConfig(
  global: SaydoConfig,
  project: Partial<SaydoConfig>
): { config: SaydoConfig; rejectedKeys: string[] } {
  const rejectedKeys: string[] = [];
  const merged: SaydoConfig = { ...global };
  for (const key of Object.keys(project) as (keyof SaydoConfig)[]) {
    if ((PROJECT_OVERRIDABLE_KEYS as readonly string[]).includes(key)) {
      if (key === "params" && project.params) {
        const filtered: Record<string, number | string | boolean | string[]> = { ...global.params };
        for (const [k, v] of Object.entries(project.params)) {
          // enabled_project_types 全局专属(09 §11:全局键,项目层不可覆盖);与 backup_retention_days 同剥
          if ((PARAMS_GLOBAL_ONLY as readonly string[]).includes(k) || k === "enabled_project_types") {
            rejectedKeys.push(`params.${k}`);
          } else filtered[k] = v;
        }
        merged.params = filtered;
      } else {
        (merged as Record<string, unknown>)[key] = project[key];
      }
    } else {
      rejectedKeys.push(key);
    }
  }
  return { config: merged, rejectedKeys };
}

export function paramValue<K extends keyof typeof PARAM_DEFAULTS>(cfg: SaydoConfig, key: K): number {
  const v = cfg.params?.[key];
  return typeof v === "number" ? v : PARAM_DEFAULTS[key];
}
