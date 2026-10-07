import { moneySchema, sumCostCounts, type CostByProject, type CostBillingSummary } from "@saydo/contracts";
import { parseCostBilling } from "./costDisplay";

export type CostEntriesWindow = {
  limit: number;
  returned: number;
  total: number;
  truncated: boolean;
};

export type { CostByProject } from "@saydo/contracts";

/** 「全部」合计只认 byProject 全账本聚合,不得把 300 窗 entries 再加总冒充。 */
export function authoritativeAllTotals(byProject: CostByProject[]): {
  knownByCurrency: Record<string, number>; unknownCount: number | null; projectCount: number; billing?: CostBillingSummary
} {
  const knownByCurrency: Record<string, number> = {};
  let unknownCount: number | null = 0;
  const overflowed = new Set<string>();
  const billing: CostBillingSummary = { unknownMoneyEntries: 0, subscriptionEntries: 0, subscriptionRequests: null, upstreamCliEntries: 0 };
  let requests: number | null = 0;
  let complete = true;
  for (const p of byProject) {
    for (const [cur, amt] of Object.entries(p.knownByCurrency ?? {})) {
      const money = moneySchema.safeParse({ known: true, value: amt, currency: cur });
      if (overflowed.has(cur)) continue;
      if (!money.success || money.data.value === undefined) {
        delete knownByCurrency[cur]; overflowed.add(cur); unknownCount = null; continue;
      }
      const sum = (knownByCurrency[cur] ?? 0) + money.data.value;
      if (Number.isFinite(sum)) knownByCurrency[cur] = sum;
      else { delete knownByCurrency[cur]; overflowed.add(cur); unknownCount = null; }
    }
    unknownCount = sumCostCounts(unknownCount, p.unknownCount);
    const part = parseCostBilling(p.billing);
    if (!part) { complete = false; continue; }
    billing.unknownMoneyEntries = sumCostCounts(billing.unknownMoneyEntries, part.unknownMoneyEntries);
    billing.subscriptionEntries = sumCostCounts(billing.subscriptionEntries, part.subscriptionEntries);
    billing.upstreamCliEntries = sumCostCounts(billing.upstreamCliEntries, part.upstreamCliEntries);
    if (part.subscriptionEntries === null || (part.subscriptionEntries > 0 && (part.subscriptionRequests === null || part.subscriptionRequests <= 0))) requests = null;
    else if (part.subscriptionEntries > 0) requests = sumCostCounts(requests, part.subscriptionRequests);
  }
  if (overflowed.size) billing.unknownMoneyEntries = null;
  billing.subscriptionRequests = billing.subscriptionEntries !== null && billing.subscriptionEntries > 0 ? requests : null;
  return { knownByCurrency, unknownCount, projectCount: byProject.length, ...(complete ? { billing } : {}) };
}

export function normalizeEntriesWindow(
  raw: CostEntriesWindow | undefined,
  entriesLength: number
): CostEntriesWindow {
  const limit = raw?.limit ?? 300;
  const returned = raw?.returned ?? entriesLength;
  const total = raw?.total ?? entriesLength;
  return {
    limit,
    returned,
    total,
    truncated: raw?.truncated ?? total > limit
  };
}

export function costWindowLabel(window: CostEntriesWindow): string {
  return window.truncated
    ? `明细窗口 最近 ${window.returned}/${window.total} 笔(上限 ${window.limit})`
    : `明细窗口 ${window.returned} 笔(上限 ${window.limit})`;
}

export function costExportFilename(opts: { group: string; window: CostEntriesWindow; now?: number }): string {
  const stamp = opts.now ?? Date.now();
  return `saydo-costs-${opts.group}-window-${opts.window.returned}-of-${opts.window.total}-${stamp}.csv`;
}

export function costExportHeader(window: CostEntriesWindow): string {
  return `# ${costWindowLabel(window)}`;
}
