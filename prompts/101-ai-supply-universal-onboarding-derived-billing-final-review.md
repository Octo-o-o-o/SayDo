# AI 供给方案派生 Billing 最终复核

你是零上下文、只读、对抗性评审者。不要修改文件，不要启动 subagent，不要联网。

主输入：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- `research/codex-findings/100-ai-supply-universal-onboarding-final-billing-gate-review.md`

Codex 100 发现 BillingMatch 可伪造派生向量、dynamic 可只验证成功 member，以及 Phase 0 缺专用门禁。只复核这三项回修及其是否引入新的 A 级矛盾：

1. BillingMatch 是否已经不保存/不信任任何金额 summary，只保存 typed source refs、完整 coverageSources 与固定 derivation algorithm；strict schema 是否拒绝额外 summary；构造、Result verify、promote、dispatch 是否都从准确 CandidateBilling、Authorization child/aggregate、attempt/ingress reservation、conformance runtime Billing 和权威 terminal ledger current state 重算，不能把真实 1 元 ref 抄成 10 元，也不能把 ledger 5 元低报成 0/1。
2. fixed 是否恰好一个 coverage；dynamic 是否按唯一连续 attemptOrdinal 覆盖本次 ingress 全部 sent attempt，member 序列匹配 InvocationEnvelope 实际序列；每个 coverage 是否绑定自己的 member CandidateBilling/reservation/terminal entries 和已有 runtime Billing。是否逐 member 检查 `memberTerminalTotal <= effectiveRuntimeWorst <= candidateWorst <= attemptReserved <= authorizedAttempt`，然后才检查 `sum(memberTerminalTotal) <= ingressReserved <= authorizedAggregate`；A runtimeWorst=1/held=5、B runtimeWorst/settled=1 时，即使 aggregate=10，也必须因 A 失败而零 covered。
3. Result 选择的 billingCoverageAttemptOrdinal 是否唯一命中成功 coverage，相关 refs 与 Result 完全相等；operation-specific closure 与最终 fixed/RouteSetCore binding 集合是否仍闭合且 producer DAG 无环。
4. Phase 0 是否有真实 Billing contract/refinement 测试命令；Phase 3 是否有 strict-summary、source-ref 抄大、terminal 低报、dynamic 非成功 member 击穿、coverage 漏重错序/错 member 的构造/verify/promote 反例，并由专用测试文件进入门禁；总矩阵是否覆盖。

不要重新评审已关闭的旧问题，不评价尚未实施代码、owner 决策或排产开工门。

输出规则：

- 无未关闭 A 级时，第一行严格输出 `PASS`，随后不超过 10 条简短证据。
- 有 A 级时，第一行严格输出 `FAIL`，只列可复现 A 级并给位置、反例、最小修复。
- 不列 B/C，不重写方案。
