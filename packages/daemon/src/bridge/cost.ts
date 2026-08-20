// C8 路径二 per-task 成本对账(P0.5-B;04 §6):dispatch_binding taskId<->runId +
// `hopper show --json` last_run_cost 累加入 cost_entries。
// 纪律:unknown 不编数(known:false => known=0/amount=NULL);fake-runner 恒 unknown 路径。

import { ulid } from "ulid";
import type { Db } from "../storage/db.js";
import { insertCostEntry } from "../storage/dao/misc.js";

export interface LastRunCost {
  known: boolean;
  amount?: number;
  currency?: string;
  /** runner-result.json 的 mtime(ISO;Hopper appendix §3.1) */
  asOf?: string;
  meta?: Record<string, unknown>;
}

/** show --json 提取 last_run_cost(真实形状经 Hopper appendix §3.1 确认,2026-07-25:
 *  known:true = {known, value, currency:"USD", as_of}——字段是 value 不是 amount,币种 USD;
 *  claude=CLI envelope 实报 / codex=token x 单价估算(未登记单价回落 known:false)。
 *  缺字段/非 number = unknown,绝不编数;绝不默认 CNY(混币种即编数)。 */
export function extractLastRunCost(showJson: string): LastRunCost {
  try {
    const obj = JSON.parse(showJson) as Record<string, unknown>;
    const c = (obj["last_run_cost"] ?? (obj["projected"] as Record<string, unknown> | undefined)?.["last_run_cost"]) as
      | Record<string, unknown>
      | undefined;
    if (!c || c["known"] !== true || typeof c["value"] !== "number") return { known: false };
    if (typeof c["currency"] !== "string") return { known: false }; // 币种缺失不猜(不编数)
    return {
      known: true,
      amount: c["value"],
      currency: c["currency"],
      ...(typeof c["as_of"] === "string" ? { asOf: c["as_of"] } : {}),
      ...(c["meta"] ? { meta: c["meta"] as Record<string, unknown> } : {})
    };
  } catch {
    return { known: false };
  }
}

/** 对账入账(known=false 行照落——留痕"跑过但金额未知",Money.unknown 口径) */
export function recordTaskRunCost(
  db: Db,
  i: { projectId?: string; taskId: string; runId: string; cost: LastRunCost },
  nowIso: string
): void {
  insertCostEntry(db, {
    id: ulid(),
    ts: nowIso,
    ...(i.projectId ? { projectId: i.projectId } : {}),
    taskId: i.taskId,
    kind: "hopper.run",
    ...(i.cost.known && i.cost.amount !== undefined && i.cost.currency
      ? { amount: i.cost.amount, currency: i.cost.currency, known: 1 as const } // 币种如实(Hopper=USD),不折算不混计
      : { known: 0 as const }),
    source: "api",
    meta: { runId: i.runId, ...(i.cost.asOf ? { as_of: i.cost.asOf } : {}), ...(i.cost.meta ?? {}) }
  });
}

// ---- CAS 预检(--expect-status/--expect-last-event;失败 => voided_by_conflict,不盲发) ----

export interface CasExpectation {
  expectStatus?: string;
  expectLastEventId?: string;
}

export type CasVerdict = { ok: true } | { ok: false; verdict: "voided_by_conflict"; reason: string };

export function casPreflight(exp: CasExpectation, actual: { status: string; lastEventId: string }): CasVerdict {
  if (exp.expectStatus && exp.expectStatus !== actual.status) {
    return { ok: false, verdict: "voided_by_conflict", reason: `状态已变(${actual.status}≠期望 ${exp.expectStatus}),先重读再决策` };
  }
  if (exp.expectLastEventId && exp.expectLastEventId !== actual.lastEventId) {
    return { ok: false, verdict: "voided_by_conflict", reason: "事件尾已前进(全局尾 CAS 失配),收据作废重签" };
  }
  return { ok: true };
}
