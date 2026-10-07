// docs09 §0/§11-5、docs11 §2.6：只读账本投影；订阅来源不证明实际计费来源。
import { costApiMoney, costBillingSummarySchema, costMetadata, subscriptionRequestCount, summarizeCostEntries, type CostBillingSummary } from "@saydo/contracts";

const UNKNOWN = "还没有确切数字";
const UPSTREAM = "按该 CLI 的上游计费方式，SayDo 不代付";

/** 只认真实正整数 requests，不拿 num_turns、行数或缺字段推调用次数。 */
function subscriptionText(raw: unknown): string {
  const meta = costMetadata(raw);
  if (meta["provenance"] !== "subscription") return UPSTREAM;
  const n = meta["requests"];
  return subscriptionRequestCount(n) !== null
    ? `订阅额度内(已用 ${n} 次)` : "订阅额度内(调用次数未提供)";
}

export function costEntryText(row: Record<string, unknown>): string {
  if (row["source"] === "subscription") return subscriptionText(row["meta_json"]);
  const money = costApiMoney(row);
  if (!money || money.value === undefined) return UNKNOWN;
  return `${money.value.toFixed(2)} ${money.currency === "CNY" ? "元" : money.currency}`;
}

export function parseCostBilling(raw: unknown): CostBillingSummary | undefined {
  const parsed = costBillingSummarySchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** 已核完整分类计数才授来源话术，缺失对象不借窗口补N。 */
export function costBillingText(raw: unknown): string {
  const billing = parseCostBilling(raw);
  if (!billing) return "计费来源与调用次数未汇总";
  const parts: string[] = [];
  if (billing.subscriptionEntries === null) parts.push("订阅笔数与调用次数未提供");
  else if (billing.subscriptionEntries > 0) parts.push(
    billing.subscriptionRequests !== null && billing.subscriptionRequests > 0
      ? `订阅额度内(已用 ${billing.subscriptionRequests} 次)` : "订阅额度内(调用次数不完整)"
  );
  if (billing.upstreamCliEntries === null) parts.push("上游CLI笔数未提供");
  else if (billing.upstreamCliEntries > 0) parts.push(UPSTREAM);
  return parts.join("；");
}

/** 任务完整costs与窗口共用contracts累计器，不从行数补订阅N。 */
export function projectCostRows(rows: Record<string, unknown>[]): {
  knownByCurrency: Record<string, number>; unknownCount: number | null; billingText: string; text: string
} {
  const projection = summarizeCostEntries(rows);
  const knownByCurrency = projection.knownByCurrency;
  const unknownCount = projection.billing.unknownMoneyEntries;
  const billingText = costBillingText(projection.billing);
  const parts: string[] = [];
  if (Object.keys(knownByCurrency).length) parts.push(`已知小计 ${Object.entries(knownByCurrency)
    .map(([currency, value]) => `${value.toFixed(2)} ${currency === "CNY" ? "元" : currency}`).join(" + ")}`);
  if (unknownCount === null) parts.push("未知金额笔数未提供");
  else if (unknownCount > 0) parts.push(`${unknownCount} 笔还没有确切数字`);
  if (billingText) parts.push(billingText);
  return { knownByCurrency, unknownCount, billingText, text: parts.join("；") || UNKNOWN };
}

export function taskCostsText(rows: Record<string, unknown>[]): string {
  return projectCostRows(rows).text;
}
