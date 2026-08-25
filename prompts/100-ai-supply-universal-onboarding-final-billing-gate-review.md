# AI 供给方案最终 Billing 数值与 operation 门

你是零上下文、只读、对抗性评审者。不要修改文件，不要启动 subagent，不要联网。

主输入：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- `research/codex-findings/99-ai-supply-universal-onboarding-billing-closure-review.md`

Codex 99 已确认 candidate/runtime Billing 接缝的单位和身份漂移被关闭；随后两个独立复核又发现两个 A 级反例。只攻击这两项回修以及回修是否引入新的 A 级合同矛盾：

1. 数值链：candidate/child/aggregate/attempt+ingress reserve 都为 `CNY 10.00`，runtime worst 为 `CNY 1.00`，实际 settled/held 为 `CNY 5.00` 时，是否必然在 BillingMatch 构造、verify、promote 三处拒绝。逐单位是否明确强制 `settledOrHeld <= runtimeWorst <= candidateWorst <= attemptReserved <= authorizedAttempt`，并强制 `settledOrHeld <= terminalLedgerTotal <= ingressReserved <= authorizedAggregate`；dynamic terminal total 是否覆盖该 InvocationEnvelope 本次 ingress 的全部 terminal ledger entry，每项绑定准确 ordinal/attempt/member CandidateBilling 和已有的 member runtime Billing；漏项、重复、错 member、溢出是否进入专用 anomaly，而不是仍可 `covered`。
2. operation 闭包：CandidateBilling 是否为每个计划支持的 runtime `InferenceOperation` 保存唯一投影；每个 `OperationBillingClosureReceipt` 是否钉住同一 attempt/member/account/effective route/resource subject、准确 ComputePolicyBinding、其 runtime Billing、candidate projection 和成功 conformance match；ConformanceResult 的 operation closure 集合是否非空唯一，并与 fixed InferenceBinding 或对应 RouteSetCore member 的 operation→ComputePolicyBinding 集合完全相等。`chat/CNY` Match 后换入 `tool_roundtrip/USD` binding、漏项、重复 operation、跨成员 closure 或用 B Billing 覆盖 A，是否在 Result 构造、verify、promote、首字节前必然拒绝；两 operation 正向路径是否仍能形成无环 DAG。
3. Phase 0 schema/refinement、Phase 3 fixed/dynamic 正反例、专用测试命令和总验收矩阵是否形成可机械执行的门，而非仅有描述性文案。

不要重新评审 Codex 98/99 已通过的旧问题，不评价尚未实施代码、owner 六项决策或排产开工门。

输出规则：

- 无未关闭 A 级时，第一行严格输出 `PASS`，随后不超过 10 条简短证据。
- 有 A 级时，第一行严格输出 `FAIL`，只列可复现 A 级并给位置、反例、最小修复。
- 不列 B/C，不重写方案。
