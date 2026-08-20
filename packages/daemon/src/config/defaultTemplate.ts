// 首启缺省配置模板(onboarding v6):空 SAYDO_HOME 无 config.toml 时的 schema 合法基线。
// 单源:启动自举 + writeSetupConfigStaged 空基线合并共用本函数。
// 占位模型名含 placeholder-unconfigured,probe 据此报 missing(禁把占位当已配)。

import { existsSync } from "node:fs";
import { join } from "node:path";
import { stringify as tomlStringify } from "smol-toml";
import type { ModelBinding } from "@saydo/contracts";
import { writePendingFile } from "./pending.js";
import { configSchema, type SaydoConfig } from "./types.js";
import type { AuditSink } from "../obs/audit.js";

/** API 简写形态占位(前缀只用于 family 校验;语义=待配,不会发真实请求) */
export const PLACEHOLDER_MODEL_API = "gpt-placeholder-unconfigured";
export const PLACEHOLDER_MODEL_THINKING = "gpt-placeholder-unconfigured";
export const PLACEHOLDER_MODEL_EVALUATOR = "claude-placeholder-unconfigured";

const PLACEHOLDER_MARK = "placeholder-unconfigured";

/**
 * 最小完整配置对象:过 configSchema + validateConfig(异族/dialog=api)。
 * 四槽均为可识别占位,非真实已配模型。budget/dnd 用产品示例缺省。
 * dev 槽 optional 留空。
 */
export function defaultConfigTemplate(): Record<string, unknown> {
  return {
    models: {
      profile: "default",
      // 占位待配:字符串简写 = api 官方端点;非真实模型 id
      dialog: PLACEHOLDER_MODEL_API,
      // T17 当前真实供给为 API;三处均保持未配置占位,不预写未接线 CLI。
      thinking: PLACEHOLDER_MODEL_THINKING,
      cheap: PLACEHOLDER_MODEL_API,
      evaluator: PLACEHOLDER_MODEL_EVALUATOR
    },
    budget: {
      monthly: 200,
      currency: "CNY"
    },
    dnd: {
      window: "23:00-08:00"
    }
  };
}

/** 模板 TOML 文本(原子写入用);parse 后必过 configSchema */
export function defaultConfigTemplateToml(): string {
  const obj = defaultConfigTemplate();
  // 自检:构造即过 schema(开发期 fail-fast;生产路径同样走 parse)
  configSchema.parse(obj);
  return tomlStringify(obj);
}

/** binding 是否仍是模板占位(用户未改成真实模型) */
export function isPlaceholderBinding(binding: ModelBinding | undefined | null): boolean {
  if (binding === undefined || binding === null) return true;
  if (typeof binding === "string") return binding.includes(PLACEHOLDER_MARK);
  if (typeof binding === "object" && "model" in binding && typeof binding.model === "string") {
    return binding.model.includes(PLACEHOLDER_MARK);
  }
  return false;
}

export type BootstrapResult =
  | { wrote: true; path: string }
  | { wrote: false; reason: "already_exists" };

/**
 * 首启自举:SAYDO_HOME 无 config.toml 时原子写模板;已存在则不动。
 * audit action=config.bootstrap。
 */
export function bootstrapConfigIfMissing(saydoHome: string, audit?: AuditSink): BootstrapResult {
  const path = join(saydoHome, "config.toml");
  if (existsSync(path)) {
    return { wrote: false, reason: "already_exists" };
  }
  const text = defaultConfigTemplateToml();
  // 复用 pending 原子写(tmp+fsync+rename);目标即活动文件
  writePendingFile(path, text, 0o600);
  audit?.record({
    actor: "daemon",
    action: "config.bootstrap",
    meta: { path: "config.toml", slots: "dialog,thinking,cheap,evaluator" }
  });
  return { wrote: true, path };
}

/** 模板经 schema 解析后的类型化视图(测试/探针) */
export function parsedDefaultConfig(): SaydoConfig {
  return configSchema.parse(defaultConfigTemplate());
}
