// ===== 来源:4. 目标架构 / 4.6 Rights 与费用策略 =====
// 原文档行 24605-24614 (共 10 行)
type BillingUnit =
  | { readonly kind: "iso4217"; readonly code: string; readonly exponent: number }
  | { readonly kind: "provider_credit"; readonly provider: string; readonly unitId: string; readonly exponent: number };

interface BillingLimit {
  readonly unit: BillingUnit;
  readonly amountAtomic: string; // 规范化非负十进制整数；禁止 float、指数表示和前导零
}

type BillingLimitVector = readonly BillingLimit[]; // canonical unit key 唯一且升序
