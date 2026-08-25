# AI 供给方案 Billing 接缝终审

你是零上下文、只读、对抗性评审者。不要修改任何文件，不要启动 subagent，不要做网络检索。

主输入：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- `research/codex-findings/98-ai-supply-universal-onboarding-final-gate-review.md`

Codex 98 已确认五处 canonical 机械门和跨计费单位预算向量闭合；随后独立生态复核构造出一个新反例：CandidateBilling/授权只有 `CNY 1.00`，响应后的 runtime Billing 却为 `USD 1.00`，旧 ConformanceResult 没有验证二者和 ledger 的接缝。

只攻击这项回修及其是否引入新的 A 级合同矛盾：

1. `ConformanceBillingMatchReceipt` 是否在无 producer/digest 环的顺序中，精确绑定同一 attempt/member/account/effective route 的 CandidateBilling、runtime Billing、已消费 ConformanceAuthorization/ordinal、reservation 和 terminal ledger entries。
2. ConformanceResult 的 candidate Billing 是否必须等于 ConformancePolicyBinding 的 candidate ref，runtime Billing 是否必须等于对应 ComputePolicyBinding 的 runtime ref，BillingMatch/authorization/ordinal/ledger 是否与 Result 逐项相等；只有 `outcome=covered` 才能生成 Result、Capability、RouteSet/Binding 和 Activation。
3. runtime unit 集合、price version、funding/overage、逐单位最坏金额和 settled/held 金额是否同时受 candidate、child limit、aggregate vector 与 reservation 覆盖；新增单位、语义漂移或超限是否只生成不可激活 anomaly 并 hard stop。
4. 已发生请求的已知新增单位是否独立进入 `charge_unknown` 异常账，非规范单位是否以 opaque evidence 隔离并锁 route；是否明确禁止拿其他单位余额或 FX 抵扣、禁止把 anomaly 当授权。
5. Phase 0 schema、Phase 3 fixed/dynamic 的 `candidate CNY → runtime USD`、price/funding/overage/cap 漂移三时点反例，以及总验收矩阵是否足以机械阻止该漏洞。

不要重新评审已由 Codex 98 判定通过的两项，也不要评价代码尚未实施、owner 六项决策或排产开工门。

输出规则：

- 已关闭且无新 A 级时，第一行严格输出 `PASS`，随后用不超过 10 条简短证据说明关闭点。
- 仍有 A 级时，第一行严格输出 `FAIL`，只列可复现 A 级；每项给位置、反例、最小修复。
- 不列 B/C，不重写方案。
