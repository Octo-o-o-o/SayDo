// C8 成本账本接线(计划 1.2:ASR 分钟 / LLM token / TTS 字符入 cost_entries)。
// [pricing] 最小合同未回写前(计划 3.3 前置),api 计费行按 known=0/amount=NULL 落账、用量入 meta
// (09 §0 Money:unknown 永不显示 0;有单价表后回填 known 行)。订阅行纪律见 09 §11 规则 5(1.2b)。

import { ulid } from "ulid";
import type { Db } from "../storage/db.js";
import { insertCostEntry } from "../storage/dao/misc.js";
import {
  buildTier1SubscriptionCostEntry,
  type Tier1SubscriptionCostInput
} from "../tier1/claudeOutcome.js";

export interface UsageContext {
  projectId?: string | undefined;
  taskId?: string | undefined;
  sessionId?: string | undefined;
  /** ④c:control=控制轮运维口径,入账但不计入用户会话交互统计 */
  origin?: "user" | "control" | undefined;
}

export interface CliSubscriptionInvocation {
  provider: string;
  model: string;
  requests: number;
  provenance?: "subscription" | "external_api" | "unknown";
}

/** CLI 不回 token 用量时仍逐次落订阅调用；0 表示不可得，不表示实际零消耗。 */
export function recordCliSubscriptionInvocation(
  db: Db,
  slot: "dialog" | "thinking" | "cheap" | "evaluator",
  invocation: CliSubscriptionInvocation,
  now: () => Date = () => new Date()
): void {
  if (!Number.isInteger(invocation.requests) || invocation.requests <= 0) {
    throw new Error("subscription requests 必须是正整数");
  }
  db.transaction(() => {
    for (let request = 0; request < invocation.requests; request++) {
      recordLlmUsage(
        db,
        slot,
        {
          model: invocation.model || "unknown",
          promptTokens: 0,
          completionTokens: 0,
          subscription: {
            provider: invocation.provider,
            requests: 1,
            usageUnavailable: true,
            ...(invocation.provenance ? { provenance: invocation.provenance } : {})
          }
        },
        {},
        now,
        "subscription"
      );
    }
  })();
}

export function recordLlmUsage(
  db: Db,
  slot: "dialog" | "thinking" | "cheap" | "evaluator",
  // M4/③-4:meta 定型必含 input/cached_input/output tokens(cached<=input);routedProvider 见 M2;
  // source='subscription' 时金额 NULL 但 tokens 照记(07 D18);订阅行另含 provider/requests(09 §11-5,Codex 13b)
  usage: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    cachedPromptTokens?: number;
    /** W5a 3.5:缓存写入量(09 §9 注预留列位;Anthropic 1.25x 写入价)——上游回带才落 meta,不编数 */
    cacheWriteInputTokens?: number;
    routedProvider?: string;
    /** 订阅行必带(§11-5):provider + requests(plan_window 可选);CLI 不回 usage 时四键记 0 + usage_unavailable */
    subscription?: {
      provider: string;
      requests: number;
      planWindow?: string;
      usageUnavailable?: boolean;
      provenance?: "subscription" | "external_api" | "unknown";
    };
  },
  ctx: UsageContext = {},
  now: () => Date = () => new Date(),
  source: "api" | "subscription" = "api"
): void {
  const cached = usage.cachedPromptTokens ?? 0;
  if (cached > usage.promptTokens) throw new Error("cached_input_tokens must be <= input_tokens (§12 断言)");
  if (source === "subscription" && !usage.subscription) {
    throw new Error("subscription 行必带 {provider, requests}(09 §11-5)");
  }
  insertCostEntry(db, {
    id: ulid(),
    ts: now().toISOString(),
    ...ctx,
    kind: `llm.${slot}`,
    known: 0,
    source,
    // 定型键名(09 §9 cost_entries meta 注释):input_tokens/cached_input_tokens/output_tokens 恒在
    meta: {
      model: usage.model,
      input_tokens: usage.promptTokens,
      cached_input_tokens: cached,
      output_tokens: usage.completionTokens,
      // W5a 3.5:cache_write_input_tokens 列位启用(09 §9 注"留列位待 P1"清偿;additive meta 键,回带才写)
      ...(usage.cacheWriteInputTokens !== undefined ? { cache_write_input_tokens: usage.cacheWriteInputTokens } : {}),
      ...(usage.routedProvider !== undefined ? { routed_provider: usage.routedProvider } : {}),
      ...(ctx.origin ? { origin: ctx.origin } : {}),
      ...(usage.subscription
        ? {
            provider: usage.subscription.provider,
            requests: usage.subscription.requests,
            ...(usage.subscription.planWindow ? { plan_window: usage.subscription.planWindow } : {}),
            ...(usage.subscription.usageUnavailable ? { usage_unavailable: true } : {}),
            ...(usage.subscription.provenance ? { provenance: usage.subscription.provenance } : {})
          }
        : {})
    }
  });
}

/** W5.4-b C2b:消费 W5.4-a 纯对象落 `kind=tier1.run` 订阅行;cursor 同步补。不产生 source='api'。 */
export function recordTier1SubscriptionRun(
  db: Db,
  input: Tier1SubscriptionCostInput & { projectId?: string },
  now: () => Date = () => new Date()
): void {
  if (!input.runId) throw new Error("tier1.run 订阅记账必须绑定 runId");
  const entry = buildTier1SubscriptionCostEntry(input);
  const cacheWrite = entry.meta["cache_creation_input_tokens"];
  const id = `tier1.run:${input.runId}`;
  const projectId = input.projectId ?? null;
  const taskId = input.taskId ?? null;
  const metaJson = JSON.stringify({
    ...entry.meta,
    requests: entry.requests,
    ...(typeof cacheWrite === "number" ? { cache_write_input_tokens: cacheWrite } : {})
  });
  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO cost_entries(
         id, ts, project_id, task_id, session_id, kind, amount, currency, known, source, meta_json
       ) VALUES (?, ?, ?, ?, NULL, 'tier1.run', NULL, NULL, 0, 'subscription', ?)`
    )
    .run(id, now().toISOString(), projectId, taskId, metaJson);
  if (inserted.changes === 1) return;
  const existing = db
    .prepare(
      `SELECT project_id, task_id, session_id, kind, amount, currency, known, source, meta_json
       FROM cost_entries WHERE id=?`
    )
    .get(id) as
    | {
        project_id: string | null;
        task_id: string | null;
        session_id: string | null;
        kind: string;
        amount: number | null;
        currency: string | null;
        known: number;
        source: string;
        meta_json: string | null;
      }
    | undefined;
  if (
    !existing ||
    existing.project_id !== projectId ||
    existing.task_id !== taskId ||
    existing.session_id !== null ||
    existing.kind !== "tier1.run" ||
    existing.amount !== null ||
    existing.currency !== null ||
    existing.known !== 0 ||
    existing.source !== "subscription" ||
    existing.meta_json !== metaJson
  ) {
    throw new Error(`tier1.run 记账幂等键冲突:${input.runId}`);
  }
}

export function recordTtsChars(db: Db, sessionId: string, chars: number, now: () => Date = () => new Date()): void {
  insertCostEntry(db, {
    id: ulid(),
    ts: now().toISOString(),
    sessionId,
    kind: "tts.chars",
    known: 0,
    source: "api",
    meta: { chars }
  });
}

export function recordAsrSeconds(db: Db, sessionId: string, seconds: number, now: () => Date = () => new Date()): void {
  insertCostEntry(db, {
    id: ulid(),
    ts: now().toISOString(),
    sessionId,
    kind: "asr.seconds",
    known: 0,
    source: "api",
    meta: { seconds }
  });
}
