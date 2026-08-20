import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfigFile, paramValue } from "../config/load.js";
import { assertParamSanity, PARAM_DEFAULTS } from "../config/types.js";

/** 缺失配置使用默认值；已存在但非法的配置 fail-closed，禁止静默改用默认保留期清理。 */
export function backupRetentionDays(saydoHome: string): number {
  const configPath = join(saydoHome, "config.toml");
  if (!existsSync(configPath)) return PARAM_DEFAULTS.backup_retention_days;
  const cfg = loadConfigFile(configPath);
  assertParamSanity({ ...PARAM_DEFAULTS, ...(cfg.params ?? {}) });
  return paramValue(cfg, "backup_retention_days");
}

export function backupTranscriptPersistence(
  saydoHome: string
): "required" | "privacy_disabled" {
  const configPath = join(saydoHome, "config.toml");
  if (!existsSync(configPath)) return "required";
  return loadConfigFile(configPath).privacy.store_transcript
    ? "required"
    : "privacy_disabled";
}
