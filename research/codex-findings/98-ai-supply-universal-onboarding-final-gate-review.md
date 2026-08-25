PASS

- Phase 0 明确要求在 08、07/D8、09、C2、C5 写入同一九字段机器投影。[方案:1237](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1237)
- 专用脚本须逐字段完全相等并验证真实 section/link anchor，明确排除关键词和普通链接检查。
- 隔离自测覆盖五处单文件漂移，以及 `undecided`、缺字段、重复 marker、错 anchor、不存在 section。[方案:1254](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1254)
- Phase 0 真实门禁明确执行专用自测和一致性脚本。[方案:1268](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1268)
- 所有金额合同统一为 canonical `BillingUnit`/`BillingLimitVector`，明确禁止顶层 `currency + amount`。[方案:782](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:782)
- 单位、exponent、整数金额、唯一排序、非法值、舍入与溢出均有 fail-closed 规则和边界反例。[方案:797](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:797)
- 动态 RouteSet 按每个单位计算最坏 invocation sequence 总和；未证明不收费的缺失分量不得视零。[方案:821](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:821)
- Conformance、Runtime、持久预算及 ledger 均沿用分单位向量；账本状态、释放和调和禁止跨单位抵扣。[方案:822](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:822)
- 首版明确禁止隐式 FX；确认界面和运行提示逐单位展示。[方案:827](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:827)
- `A=CNY sent→timeout，B=USD success` 的 ingress 向量预留、`charge_unknown/settled` 账本结果及非法向量反例均成为验收 fixture。[方案:1379](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1379)