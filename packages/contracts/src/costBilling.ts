// 09 §9.1：只读计费投影，账本写入与业务 source 词表不变。
import { z } from "zod";
import { moneySchema } from "./types/common.js";

const countSchema = z.number().int().nonnegative().nullable();
export const costBillingSummarySchema = z.strictObject({
  unknownMoneyEntries: countSchema,
  subscriptionEntries: countSchema,
  subscriptionRequests: countSchema,
  upstreamCliEntries: countSchema
}).refine((b) => b.subscriptionRequests === null || (b.subscriptionEntries !== null && b.subscriptionEntries > 0 && b.subscriptionRequests > 0), { message: "完整订阅N只属于非空已确证订阅分类" });
export type CostBillingSummary = z.infer<typeof costBillingSummarySchema>;
export type CostByProject = {
  projectId: string | null;
  projectTitle: string | null;
  knownByCurrency: Record<string, number>;
  unknownCount: number;
  billing?: CostBillingSummary;
};

/** 不完整或不安全的计数在后续累积中保持未知。 */
export function sumCostCounts(a: number | null, b: number | null): number | null {
  return a !== null && b !== null && Number.isSafeInteger(a) && Number.isSafeInteger(b)
    && a >= 0 && b >= 0 && Number.isSafeInteger(a + b) ? a + b : null;
}

export function costMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {}; }
}

export function subscriptionRequestCount(raw: unknown): number | null {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : null;
}

export function costApiMoney(row: Record<string, unknown>) {
  if (row["source"] !== "api" || (row["known"] !== 1 && row["known"] !== true)) return null;
  const parsed = moneySchema.safeParse({ known: true, value: row["amount"], currency: row["currency"] });
  return parsed.success ? parsed.data : null;
}

/** 每行只消费一次；只保留项目/币种累计状态，不把全账本载入内存。 */
export function createCostAccumulator() {
  const knownByCurrency: Record<string, number> = {};
  const contributors = new Map<string, number>();
  const overflow = new Set<string>();
  const billing: CostBillingSummary = { unknownMoneyEntries: 0, subscriptionEntries: 0, subscriptionRequests: null, upstreamCliEntries: 0 };
  let requests: number | null = 0;
  let unknownCount = 0;
  return {
    add(row: Record<string, unknown>): void {
      if (row["source"] === "subscription") {
        unknownCount++;
        const meta = costMetadata(row["meta_json"]);
        if (meta["provenance"] === "subscription") {
          billing.subscriptionEntries = sumCostCounts(billing.subscriptionEntries, 1);
          requests = sumCostCounts(requests, subscriptionRequestCount(meta["requests"]));
        } else billing.upstreamCliEntries = sumCostCounts(billing.upstreamCliEntries, 1);
        return;
      }
      const money = costApiMoney(row);
      if (!money || money.currency === undefined || money.value === undefined) {
        unknownCount++;
        billing.unknownMoneyEntries = sumCostCounts(billing.unknownMoneyEntries, 1);
        return;
      }
      const cur = money.currency;
      if (overflow.has(cur)) {
        unknownCount++;
        billing.unknownMoneyEntries = sumCostCounts(billing.unknownMoneyEntries, 1);
        return;
      }
      const count = (contributors.get(cur) ?? 0) + 1;
      const sum = (knownByCurrency[cur] ?? 0) + money.value;
      if (!Number.isFinite(sum)) {
        delete knownByCurrency[cur]; overflow.add(cur);
        unknownCount += count;
        billing.unknownMoneyEntries = sumCostCounts(billing.unknownMoneyEntries, count);
      } else { knownByCurrency[cur] = sum; contributors.set(cur, count); }
    },
    finish(): { knownByCurrency: Record<string, number>; unknownCount: number; billing: CostBillingSummary } {
      return {
        knownByCurrency: { ...knownByCurrency }, unknownCount,
        billing: { ...billing, subscriptionRequests: billing.subscriptionEntries !== null && billing.subscriptionEntries > 0 ? requests : null }
      };
    }
  };
}

export function summarizeCostEntries(rows: Iterable<Record<string, unknown>>) {
  const accumulator = createCostAccumulator();
  for (const row of rows) accumulator.add(row);
  return accumulator.finish();
}
