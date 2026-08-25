PASS

- BillingMatch 按 attempt/authorization/ordinal、candidate/runtime Billing、reservation 和 terminal ledger 建立无环接缝，并强制同 member/account/effective route。[方案:484](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:484) [方案:734](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:734)
- ConformanceResult 强制对齐 candidate/ComputePolicyBinding runtime Billing，并与 BillingMatch 的 authorization、ordinal、ledger 逐项相等。[方案:736](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:736)
- BillingMatch 只有字面量 `outcome="covered"`；anomaly 明确 `activationEligible=false`，且分支在 Result 前终止。
- runtime units、price version、funding/overage、最坏金额及 settled/held 金额均须同时受 candidate、child、aggregate 和 reservation 覆盖。[方案:835](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:835)
- 新单位、价格/资金语义漂移或任一 cap 超限只能产生 anomaly，不能产生 Result、Capability 或激活闭包。
- 已知新增单位独立记入 `charge_unknown`；非规范单位仅留 opaque digest 并锁 account/route，二者均不得充当授权。[方案:863](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:863)
- canonical 向量禁止隐式 FX、跨单位求和和余额抵扣。[方案:833](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:833)
- Phase 0 明确要求 BillingMatch/anomaly canonical schema；Phase 3 对 fixed/dynamic 的 CNY→USD、price、funding/overage、child/aggregate cap 漂移执行构造、verify、promote 三时点拒绝。[方案:1285](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1285) [方案:1419](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1419)
- 总验收矩阵已覆盖 candidate/runtime 漂移、BillingMatch/anomaly、分单位 ledger 与禁止 FX。[方案:1703](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1703)