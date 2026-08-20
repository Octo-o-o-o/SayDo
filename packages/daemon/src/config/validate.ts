// docs/09 §11 校验规则 1-2 + 07 D18 纪律 2:ModelBinding 校验器全套(启动时 fail-closed)。
// 运行时项(argv 快照/tripwire/observedModel/billing-switch)随 1.2b/4.1;本文件只管配置/启动子集(计划 0.4)。

import { WIRED_CLI_PROVIDERS, type ModelBinding, type NamedApiProvider } from "@saydo/contracts";
import { familyFromModelName, type Family } from "./family.js";
import type { SaydoConfig } from "./types.js";

export interface Violation {
  code: string;
  slot?: string;
  message: string;
  /** 处方化:可粘贴的修复行(结合 .env 现状) */
  fix?: string;
}

export interface EffectiveBinding {
  slot: string;
  provider:
    | "api"
    | "codex_cli"
    | "claude_cli"
    | "cursor_cli"
    | "grok_cli"
    | "gemini_cli"
    | "qwen_cli"
    | "copilot_cli"
    | "acp";
  model: string | undefined;
  family: Family;
}

export interface ValidateResult {
  ok: boolean;
  violations: Violation[];
  /** 非阻塞提示(如 dev 单开关缺哪个;09 §11"缺一按 default 校验并处方化提示"——提示不硬拒,评审 B5) */
  hints: Violation[];
  /** 校验通过时每槽位的生效绑定(effective binding;§12-9 断言项) */
  effective?: Record<string, EffectiveBinding>;
  /** 双开关同时成立 => dev 生效(需打启动横幅 + 审计 + readiness evaluator_isolation="unproven") */
  devMode: boolean;
}

export interface ValidateInput {
  config: SaydoConfig;
  env: Record<string, string | undefined>;
}

function bindingProvider(b: ModelBinding): EffectiveBinding["provider"] {
  return typeof b === "string" ? "api" : b.provider;
}

function bindingModel(b: ModelBinding): string | undefined {
  if (typeof b === "string") return b;
  return "model" in b && typeof b.model === "string" ? b.model : undefined;
}

function apiBindingHasKey(
  b: ModelBinding,
  providers: Record<string, NamedApiProvider> | undefined,
  env: Record<string, string | undefined>
): boolean {
  if (typeof b === "string") return Boolean(env["OPENAI_API_KEY"]);
  if (b.provider !== "api") return false;
  if (!b.via) return Boolean(env["OPENAI_API_KEY"]);
  const ref = providers?.[b.via]?.api_key;
  if (!ref?.startsWith("env:")) return false;
  return Boolean(env[ref.slice(4)]);
}

/** evaluator 校验与生产 resolver 共用的实际消费家族。 */
export function evaluatorFamilyContext(
  config: SaydoConfig,
  env: Record<string, string | undefined>
): { evaluator: Family | null; dialog: Family | null; thinking: Family | null } {
  const providers = config.providers?.api;
  const family = (slot: "dialog" | "thinking" | "evaluator", b: ModelBinding): Family | null => {
    const r = resolveFamily(slot, b, providers);
    return "family" in r ? r.family : null;
  };
  const dialog = family("dialog", config.models.dialog);
  const configuredThinking = family("thinking", config.models.thinking);
  const thinkingProvider = bindingProvider(config.models.thinking);
  const thinking =
    thinkingProvider !== "api" || !apiBindingHasKey(config.models.thinking, providers, env) ? dialog : configuredThinking;
  const evaluator = family("evaluator", config.models.evaluator);
  return { evaluator, dialog, thinking };
}

/** 解析一个 binding 的 family;返回 family 或违规原因(W5a 3.5 起 projectOverrides 复用,导出) */
export function resolveFamily(
  slot: string,
  b: ModelBinding,
  providers: Record<string, NamedApiProvider> | undefined
): { family: Family } | { violation: Violation } {
  if (typeof b === "string") {
    const fam = familyFromModelName(b);
    if (!fam) {
      return {
        violation: {
          code: "model_unresolved",
          slot,
          message: `无法从模型名 "${b}" 解析家族(简写形态无 family 可依)`,
          fix: `${slot} = { provider = "api", via = "<命名端点>", model = "${b}" }  # 并在 [providers.api.<端点>] 写 family`
        }
      };
    }
    return { family: fam };
  }
  if (b.provider === "codex_cli") {
    // 族恒 GPT;显式 model 前缀与之不符 => 拒
    if (b.model) {
      const fam = familyFromModelName(b.model);
      if (fam && fam !== "gpt") {
        return {
          violation: { code: "family_conflict", slot, message: `codex_cli 恒 GPT 族,但 model "${b.model}" 解析为 ${fam}` }
        };
      }
    }
    return { family: "gpt" };
  }
  if (b.provider === "claude_cli") {
    if (b.model) {
      const fam = familyFromModelName(b.model);
      if (fam && fam !== "claude") {
        return {
          violation: { code: "family_conflict", slot, message: `claude_cli 恒 Claude 族,但 model "${b.model}" 解析为 ${fam}` }
        };
      }
    }
    return { family: "claude" };
  }
  if (b.provider === "cursor_cli") {
    const fam = familyFromModelName(b.model);
    if (!fam) {
      return { violation: { code: "model_unresolved", slot, message: `cursor_cli model "${b.model}" 前缀表解析不出家族` } };
    }
    return { family: fam };
  }
  if (b.provider === "grok_cli") {
    // 族恒 grok;显式 model 前缀与之不符 => 拒
    if (b.model) {
      const fam = familyFromModelName(b.model);
      if (fam && fam !== "grok") {
        return {
          violation: { code: "family_conflict", slot, message: `grok_cli 恒 grok 族,但 model "${b.model}" 解析为 ${fam}` }
        };
      }
    }
    return { family: "grok" };
  }
  if (b.provider === "gemini_cli" || b.provider === "qwen_cli" || b.provider === "copilot_cli") {
    // 传输型 / 非固定族:family 只来自显式 model;缺 model 或解析不出 ⇒ unknown(自检阻断)
    if (!b.model) return { family: "unknown" };
    const fam = familyFromModelName(b.model);
    if (!fam) return { family: "unknown" };
    return { family: fam };
  }
  if (b.provider === "acp") {
    return { violation: { code: "acp_p0_rejected", slot, message: "acp 常驻协议供给 P0 一律拒启动(P1 支持)" } };
  }
  // provider === "api"
  const nameFam = familyFromModelName(b.model);
  if (b.via) {
    const named = providers?.[b.via];
    if (!named) {
      return {
        violation: {
          code: "named_endpoint_missing",
          slot,
          message: `via 指向未定义命名端点 "${b.via}"`,
          fix: `[providers.api.${b.via}]\nbase_url = "..."\napi_key = "env:..."`
        }
      };
    }
    // 命名端点的显式 family 描述实际消费端,优先于模型名猜测。
    if (named.family) return { family: named.family };
    if (nameFam) return { family: nameFam };
    return {
      violation: {
        code: "model_unresolved",
        slot,
        message: `模型 "${b.model}" 前缀表解析不出,且命名端点 [${b.via}] 无 family`,
        fix: `在 [providers.api.${b.via}] 增加 family = "<gpt|claude|...>"`
      }
    };
  }
  // api 官方端点(无 via)=> 只能靠前缀表
  if (!nameFam) {
    return {
      violation: { code: "model_unresolved", slot, message: `官方端点模型 "${b.model}" 前缀表解析不出家族` }
    };
  }
  return { family: nameFam };
}

/**
 * 校验器全套(fail-closed;一次列全所有槽位问题)。
 * 规则:
 *  1. 全局 dialog 接受 API 或 CLI;CLI 天然表示 dialog_cli_oneshot;
 *  2. acp P0 一律拒;
 *  3. dev 双开关:profile="dev" ∧ SAYDO_DEV=1 才生效 dev 放宽,缺一按 default;
 *  4. dialog/thinking/cheap/evaluator 的 CLI 形态参与 family 校验并由 runtime self-test 决定是否 active;
 *  5. CLI evaluator 双 ack 缺一即保持 unarmed;API evaluator 同族仍需 same-family ack;
 *  6. family 冲突拒(前缀表优先);api/cursor/acp 模型名解析不出拒。
 */
export function validateConfig(input: ValidateInput): ValidateResult {
  const { config, env } = input;
  const m = config.models;
  const providers = config.providers?.api;
  const violations: Violation[] = [];
  const hints: Violation[] = [];

  const profileDev = m.profile === "dev";
  const envDev = env["SAYDO_DEV"] === "1";
  const devMode = profileDev && envDev;

  // dev 双开关:缺一 => 按 default 校验 + 处方化提示(提示不单独拒启动——default 下合法的配置照常放行;评审 B5)
  if (profileDev !== envDev) {
    if (profileDev && !envDev) {
      hints.push({
        code: "dev_switch_incomplete",
        message: "config profile=\"dev\" 但环境变量 SAYDO_DEV 未置 1;按 default 校验(dev 放宽不生效)",
        fix: "export SAYDO_DEV=1   # 或把 [models].profile 改回 default"
      });
    } else {
      hints.push({
        code: "dev_switch_incomplete",
        message: "环境变量 SAYDO_DEV=1 但 config profile 非 dev;按 default 校验",
        fix: '[models]\nprofile = "dev"   # 或 unset SAYDO_DEV'
      });
    }
  }

  const cliProviders = new Set<string>(WIRED_CLI_PROVIDERS);
  const evalProvider = bindingProvider(m.evaluator);
  if (cliProviders.has(evalProvider)) {
    if (m.evaluator_same_family_ack !== true) {
      hints.push({
        code: "evaluator_same_family_ack_required",
        slot: "evaluator",
        message: "CLI evaluator 需要显式确认同族风险;未确认时深评线保持 unarmed"
      });
    }
    if (m.evaluator_isolation_ack !== true) {
      hints.push({
        code: "evaluator_isolation_ack_required",
        slot: "evaluator",
        message: "CLI evaluator 需要显式确认隔离边界;未确认时深评线保持 unarmed"
      });
    }
    if (m.evaluator_same_family_ack === true && m.evaluator_isolation_ack === true) {
      hints.push({
        code: "evaluator_cli_acks_confirmed",
        slot: "evaluator",
        message: "CLI evaluator 双 ack 已确认;仍须真实 self-test 与 observedModel 证据通过才武装"
      });
    }
  }

  // 解析各槽位 family(acp 在此被拒;api/cursor 解析不出在此被拒)
  const effective: Record<string, EffectiveBinding> = {};
  const families: Record<string, Family | null> = {};
  for (const slot of ["dialog", "thinking", "cheap", "evaluator"] as const) {
    const b = m[slot];
    const provider = bindingProvider(b);
    const r = resolveFamily(slot, b, providers);
    if ("violation" in r) {
      violations.push(r.violation);
      families[slot] = null;
    } else {
      families[slot] = r.family;
      effective[slot] = {
        slot,
        provider,
        model: bindingModel(b),
        family: r.family
      };
    }
  }

  // thinking 的 CLI/解析失败在运行时回落 dialog,比较对象必须是实际消费 family。
  const familyContext = evaluatorFamilyContext(config, env);
  const fe = familyContext.evaluator;
  const fd = familyContext.dialog;
  const ft = familyContext.thinking;
  if (evalProvider === "api" && fe && (fe === fd || fe === ft)) {
    const clash = fe === fd ? "dialog" : "thinking";
    const acked = m.evaluator_same_family_ack === true;
    const detail = `evaluator=${fe} 与 ${clash} 同族`;
    if (acked) {
      hints.push({
        code: "evaluator_same_family_acked",
        slot: "evaluator",
        message: `评估器与 ${clash} 同族(${detail})——已按你的确认放行;同源模型容易一起犯错,评估结果的独立性打折扣`,
        fix: "想恢复独立性:把 evaluator 换成另一家族(GPT 系 dialog/thinking ⇒ evaluator 用 Claude 系,反之亦然)"
      });
    } else {
      violations.push({
        code: "evaluator_same_family",
        slot: "evaluator",
        message: `就绪评估器默认要与 dialog/thinking 异族(防相关错误链,04 §2.3):${detail}`,
        fix: '换成另一家族,或在 [models] 写 evaluator_same_family_ack = true 明确接受这个代价'
      });
    }
  }

  const ok = violations.length === 0;
  return ok ? { ok, violations, hints, effective, devMode } : { ok, violations, hints, devMode };
}

/** 处方化报错渲染(一次列全、每条给可粘贴修复行;11 §8 纯文本标记,禁 pictographic) */
export function formatViolations(violations: Violation[]): string {
  if (violations.length === 0) return "[ok] config valid";
  const lines = [`[fail] 配置校验发现 ${violations.length} 个问题(全部修复后再启动):`];
  violations.forEach((v, i) => {
    lines.push(`  ${i + 1}. [${v.code}]${v.slot ? ` (${v.slot})` : ""} ${v.message}`);
    if (v.fix) {
      for (const fl of v.fix.split("\n")) lines.push(`     修复: ${fl}`);
    }
  });
  return lines.join("\n");
}
