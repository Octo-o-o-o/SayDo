// SayDo 配置形状(docs/09 §11 config.toml)。解析用 zod 宽松校验(未知键不炸,允许项目覆盖子集)。

import { z } from "zod";
import { modelBindingSchema, namedApiProviderSchema } from "@saydo/contracts";

export const configSchema = z.object({
  models: z
    .object({
      profile: z.enum(["default", "dev"]).default("default"),
      dialog: modelBindingSchema,
      thinking: modelBindingSchema,
      cheap: modelBindingSchema,
      evaluator: modelBindingSchema,
      /**
       * 异族规则(09 §11 规则 5)的知情豁免:owner 明确同意"评估器与对话/沉思同族"。
       * 落在配置里而不是请求里——pending 晋升与重启后的校验都要看得到这份同意。
       * 代价:评估独立性下降(相关错误链),启动时仍会打提示。
       */
      evaluator_same_family_ack: z.boolean().optional(),
      /**
       * 评估档 BYOA 资格(09 §11 规则 4)的知情豁免:owner 接受 codex/cursor 当评估器。
       * 代价比同族那条重——它们的沙箱限写不限读,评估器可能翻到 ~/.saydo/ 里 Brain 的自辩,
       * 评估独立性"不可证"(docs/07 D18)。同 dev 双开关的定位:放宽防错链,不动审批安全链。
       */
      evaluator_isolation_ack: z.boolean().optional(),
      dev: z
        .object({
          agent: z.enum(["claude_code", "cursor", "codex"]),
          model: z.string(),
          transport: z.enum(["cli", "sdk"]).optional()
        })
        .optional()
    })
    .strict()
    .partial({ dev: true }),
  providers: z
    .object({
      api: z.record(z.string(), namedApiProviderSchema).optional()
    })
    .optional(),
  voice: z.looseObject({}).optional(),
  // prefault({}):privacy 恒有值且缺省经 schema 填充(此前 .partial().optional() 会削弱 default,
  // 缺省语义悬空——收口对账 #2;G6"分别同意"要求缺省=不留录音/留转写是机械事实而非注释)
  // impl-readback C3(防踩,W1.3 已落):项目层配置(project.toml)**不得复用本全局 schema 或其 partial 变体**
  // 解析——prefault 会把 privacy 键注入解析结果,白名单裁决会恒误报 rejectedKeys。
  // 独立 project schema = config/project.ts(生产加载已接执行器认领/恢复链)。
  privacy: z
    .object({
      store_audio: z.boolean().default(false),
      store_transcript: z.boolean().default(true),
      audio_retention_days: z.number().int().nonnegative().default(0)
    })
    .prefault({}),
  budget: z.looseObject({}).optional(),
  // Money 接线最小合同(09 §11 [pricing],3.3):无表项 ⇒ 该项成本 unknown(绝不编数);全局专属不可项目覆盖
  pricing: z
    .strictObject({
      currency: z.literal("CNY").optional(),
      as_of: z.string().optional(),
      llm: z.record(z.string(), z.number().nonnegative()).optional(),
      asr: z.record(z.string(), z.number().nonnegative()).optional(),
      tts: z.record(z.string(), z.number().nonnegative()).optional()
    })
    .optional(),
  dnd: z.looseObject({}).optional(),
  hopper: z.looseObject({}).optional(),
  // Tier1 执行器(执行器批;canonical 09 §11 [tier1] 补录随收尾轻量评审——工程 additive 扩展,时序如实):
  // 版本 pin 红线承载:cursor_agent_bin 必须是锁定副本绝对路径(versions/<ver>/cursor-agent,
  // 裸名走 PATH 会随 symlink 自更新漂移);两键齐备才启用执行器(fail-closed:缺任一不认领,处方化提示)
  tier1: z
    .looseObject({
      cursor_agent_bin: z.string().optional(),
      cursor_agent_pinned_version: z.string().optional()
    })
    .optional(),
  // T2 薄版(W2 阶段 B;05 §4 提前批 #2;canonical 09 §11 [t2] 补录随收尾轻量评审——additive 扩展):
  // tailnet_hosts = tailnet 主机显式白名单枚举(IMPL-5 §2-B 红线:禁通配;进 Host/Origin 白名单);
  // listen = daemon 绑定地址(缺省 127.0.0.1;开 tailnet 面时 owner 显式配,如 "0.0.0.0"——
  // 即便全绑,Host/Origin 白名单 + capability token 三道门照守,G1 语义不放宽)
  t2: z
    .looseObject({
      tailnet_hosts: z.array(z.string()).optional(),
      listen: z.string().optional()
    })
    .optional(),
  gate0: z
    .object({
      enabled: z.boolean().default(true),
      bypass: z.boolean().default(false)
    })
    .partial()
    .optional(),
  // Focus Contract feature flag(方案 §8 F11):0=schema-only 零行为;1=建议清单;2=close enforcement
  // hopperBindingEnabled:C5 dormant 开关,缺省关;完整写序在 binding.ts,生产桥收口后打开
  focus: z
    .object({
      stage: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
      hopperBindingEnabled: z.boolean().default(false)
    })
    .prefault({}),
  // 值域含字符串数组:enabled_project_types(09 §11 类型能力门,W4)是 [params] 内唯一数组键
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.array(z.string())])).optional()
});

/**
 * enabled_project_types(09 §11 类型能力门;W4):propose/dispatch 的 fail-closed 启用集。
 * 缺省 ["coding"];W4 收口动作 = 前置清单七项全绿后翻 ["coding","writing"]。全局键,项目层不可覆盖。
 * 非法/缺失 ⇒ 回缺省(fail-closed:至少 coding)。
 */
export function enabledProjectTypes(cfg: SaydoConfig): string[] {
  const raw = (cfg.params as Record<string, unknown> | undefined)?.["enabled_project_types"];
  if (Array.isArray(raw) && raw.length > 0 && raw.every((x) => typeof x === "string")) return raw as string[];
  return ["coding"];
}

export type SaydoConfig = z.infer<typeof configSchema>;

export const PARAM_DEFAULTS = {
  foundation_budget_min: 5,
  foundation_budget_tokens: 200000,
  interview_question_budget: 8,
  receipt_timeout_sec: 45,
  evaluator_deep_review_max_per_session: 3,
  callback_resolution_timeout_min: 30,
  park_aging_hours: 72,
  proposed_ttl_hours: 24, // proposed 决策包 TTL(09 §2 注 ④;Codex 21 A6;到期→expired,同项目新提议 supersede 旧)
  backup_retention_days: 30,
  // M8/③-2,③-3(2026-07-25 外部评审):会话空闲挂起 + 对话历史滞回截断水位
  // (音频保留期唯一 owner=[privacy].audio_retention_days,Codex 13b 消解双源——不在 params)
  session_idle_suspend_sec: 45,
  dialog_context_high_watermark_tokens: 6000,
  dialog_context_low_watermark_tokens: 3000
} as const;

/** [params] 新键健全性断言(§12-9,Codex 13b):违反 fail-closed 拒启动 */
export function assertParamSanity(params: Record<string, unknown>): void {
  const low = Number(params["dialog_context_low_watermark_tokens"] ?? PARAM_DEFAULTS.dialog_context_low_watermark_tokens);
  const high = Number(params["dialog_context_high_watermark_tokens"] ?? PARAM_DEFAULTS.dialog_context_high_watermark_tokens);
  if (!(low < high)) throw new Error(`[params] dialog_context 水位非法:low(${low}) 必须 < high(${high})`);
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "number" && v < 0) throw new Error(`[params] ${k} 不得为负: ${v}`);
  }
  const retention = Number(params["backup_retention_days"] ?? PARAM_DEFAULTS.backup_retention_days);
  if (!Number.isFinite(retention) || retention <= 0) {
    throw new Error(`[params] backup_retention_days 必须是大于 0 的有限数:${String(retention)}`);
  }
}
