import { describe, expect, it } from "vitest";
import { costBillingSummarySchema, sumCostCounts, summarizeCostEntries } from "../src/index.js";
const empty = { unknownMoneyEntries: 0, subscriptionEntries: 0, subscriptionRequests: null, upstreamCliEntries: 0 };
const api = (amount: unknown, currency: unknown = "CNY") => ({ source: "api", known: 1, amount, currency });
const sub = (requests: unknown, provenance: unknown = "subscription") => ({ source: "subscription", meta_json: JSON.stringify({ provenance, requests }) });
describe("09 §9.1完整计费只读合同", () => {
  it("严格四键、安全整数/null；空订阅不是请求0", () => {
    expect(costBillingSummarySchema.parse(empty)).toEqual(empty);
    expect(costBillingSummarySchema.parse({ ...empty, unknownMoneyEntries: null })).toMatchObject({ unknownMoneyEntries: null });
    for (const raw of [undefined, {}, { ...empty, extra: 1 }, { ...empty, subscriptionRequests: 0 }, { ...empty, subscriptionRequests: 1 }])
      expect(costBillingSummarySchema.safeParse(raw).success).toBe(false);
    for (const value of [-1, 0.5, "1", Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(costBillingSummarySchema.safeParse({ ...empty, upstreamCliEntries: value }).success).toBe(false);
    expect(costBillingSummarySchema.safeParse({ ...empty, upstreamCliEntries: Number.MAX_SAFE_INTEGER }).success).toBe(true);
    expect(sumCostCounts(Number.MAX_SAFE_INTEGER, 1)).toBe(null); expect(sumCostCounts(null, 0)).toBe(null);
  });
  it("金额可有小数，0保币种；非法行和未知source不编0", () => {
    const summary = summarizeCostEntries([api(0), api(0.5, "USD"), api(-1), api("1"), api(1, "EUR"), { ...api(1), source: "future" }]);
    expect(summary.knownByCurrency).toEqual({ CNY: 0, USD: 0.5 }); expect(summary.billing.unknownMoneyEntries).toBe(4);
  });
  it("溢出前/触发/之后全部贡献行归未知，其他币种保留", () => {
    const summary = summarizeCostEntries([api(1), api(Number.MAX_VALUE), api(Number.MAX_VALUE), api(1), api(3, "USD"), sub(2)]);
    expect(summary.knownByCurrency).toEqual({ USD: 3 }); expect(summary.billing).toEqual({ ...empty, unknownMoneyEntries: 4, subscriptionEntries: 1, subscriptionRequests: 2 });
    expect(summary.unknownCount).toBe(5);
  });
  it.each([undefined, null, 0, -1, 0.1, "2", Number.MAX_SAFE_INTEGER + 1])("不完整requests %j拒局部N", (requests) => {
    expect(summarizeCostEntries([sub(2), sub(requests)]).billing).toMatchObject({ subscriptionEntries: 2, subscriptionRequests: null });
  });
  it("N累积溢出/null保持未知；上游CLI不纳N；空集合Nnull", () => {
    expect(summarizeCostEntries([sub(Number.MAX_SAFE_INTEGER), sub(1), sub(1)]).billing.subscriptionRequests).toBe(null);
    expect(summarizeCostEntries([sub(2), sub(9, "external_api"), sub(99, "unknown"), { source: "subscription", meta_json: "[]" }, { source: "subscription", meta_json: "broken" }]).billing)
      .toEqual({ ...empty, subscriptionEntries: 1, subscriptionRequests: 2, upstreamCliEntries: 4 });
    expect(summarizeCostEntries([]).billing).toEqual(empty);
  });
});
