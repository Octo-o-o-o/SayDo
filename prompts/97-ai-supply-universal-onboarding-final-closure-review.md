# AI 供给方案最终定向收口复核

你是零上下文、只读、对抗性评审者。不要修改任何文件，不要启动 subagent，不要做网络检索。

主输入：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- `research/codex-findings/96-ai-supply-universal-onboarding-closure-review.md`

必要时只读取主方案直接引用的 canonical/代码，用来确认文件真实存在或现状断言；不扩展成新一轮生态调研。

逐项攻击 Codex 96 的 A-1 至 A-8，以及后续定向复核发现的 A-9 至 A-23，是否已被机械关闭：

1. 真实 C2/C5 canonical 路径与 08/D8/09 一致性门；
2. URL query 默认拒绝、RequestProfile 规范化及 identity/receipt/activation/hard-stop 绑定；
3. AuthSubject、ResourceScopeReceipt、PolicySubject 共同 subject、恰好一条匹配与换挂反例；
4. RouteSetReceipt 的完整有序闭包、全成员槽位/独立性检查、冻结与 generation CAS；
5. `charge_unknown` 对发送后超时/取消/崩溃、重试与调和截止的处理；
6. 双协议自检的有序尝试集合、子额度与聚合上限；
7. ActivationManifest 全资源 generation/digest/fencing token、activation barrier、紧邻 pointer CAS 与逐 dispatch 复核；
8. 全局“数据不出本机”承诺的 canonical 撤销、远程 API 激活前置门、覆盖 inference/Execution/tool/network 的 data-egress graph 与 UI 反例；
9. loopback transport 与 local compute 的分离，ComputeBoundaryCore/ComputePolicyBinding 对 Ollama cloud model、LM Studio LM Link、principal/funding/overage/DataBoundary/Spend/Activation/hard-stop 的绑定，以及本地优先/no-new-spend/本机隐私承诺的反例。
10. transport endpoint/account/scope 与实际 compute account/device/scope 的双主体建模；`InferenceResourceSubject`、ComputePolicyBinding、PolicyBinding、RouteSet、SpendAuthorization 与 ActivationManifest 的逐项同一性；direct/gateway/bridge 上下游换挂或复用旧 local receipt 必须 fail-closed。
11. ComputeBoundaryCore 不反向引用 policy，producer 顺序能形成可重算的无环 receipt DAG；至少一条 direct 和一条 gateway 正向 fixture 可生成，换挂负例仍会拒绝。
12. CapabilityReceipt 绑定 resource subject、ComputeBoundaryCore、effective route 与 model identity；同 endpoint/model alias 下跨 compute member 换挂 capability 在 verify、promote、首字节前全部 fail-closed。
13. InferenceBinding/RouteSetCore 按 operation 冻结无重复 ComputePolicyBinding 集合；`chat → tool_roundtrip` 有正向闭包，缺项或跨 operation 复用 fail-closed。
14. Conformance/Runtime 费用授权的完整 identity closure 下沉到每个 route/member/operation attempt，顶层只保留聚合上限；r1→r2、member A→B 不共用主体或额度。
15. 零既有 Capability 的首次 payg direct/gateway 使用独立 ConformanceAttemptSubject/Boundary/Policy/RouteSet/Authorization，不依赖 observed model、Capability、InferenceBinding 或最终 RouteSet；响应后才生成 runtime DAG。
16. 动态 bridge 冻结一次 ingress 的全部可能 upstream invocation 序列与 retry 次数，并按最坏序列费用/token/request 总和预留；A sent→timeout→B success 不会超授权，无法证明时只 route-pinned/inventory。
17. 首次自检与 runtime local boundary 共用同一类型化 LocalComputeEvidence（device/process/loaded artifact/local-only attestation）；Ollama Cloud/LM Link 在首个生成请求前分类，证据缺项或前后不一致时零请求或按远程边界重新确认。
18. LocalComputeEvidence 还绑定精确 attempt/route/requested model/candidate route/route→artifact，响应后以 LocalModelIdentityBinding 证明 observed model/model identity→同一 artifact；同一 Ollama process 的本地模型证据不能换挂给 cloud model。
19. ConformanceResultReceipt 把已消费 attempt/authorization、ledger、真实 request/response/terminal 与最终 effective route/model identity/resource subject/core/adapter 串成唯一接缝；Capability/RouteSet/Activation 必引，A 结果不能挂到 B。
20. InferenceBinding 是 fixed/route_set 判别联合；route_set 分支没有单成员字段，只引用最终 RouteSet，Activation 按 ordinal 冻结并比对所有成员闭包；两成员异构集合能合法 promote 和调度 A/B。
21. ActivationManifest 只冻结不可变 FundingPolicyTemplate，不冻结可消费 RuntimeSpendAuthorization；payg connector 可激活为 paid_dispatch_locked，当前授权在 dispatch 匹配并消费，缺失/过期不改 active，ConformanceAuthorization 永不升级为日常同意。
22. 每个 ConformanceAttempt 都有 CandidateRouteFence；首字节前验证 endpoint/auth/credential lease 或上游 admission generation/callback/immutable process config。preflight 后切 Ollama account/cloud route 或 LM Link device 时零请求，无 fence 则只 inventory/direct API。
23. DataBoundary 按阶段判别：CandidateDataBoundary 绑定 fixed attempt/fence/boundary，或在不反向引用 ConformanceRouteSet 的前提下独立冻结完整动态候选集合；runtime DataBoundary 绑定实际 route/resource/core。ConformanceResult 保证实际 operator/region/retention 等属于候选集合，candidate 不能满足 runtime 承诺。

另外只检查二次回修是否引入新的 A 级合同矛盾。“代码尚未实施”、owner 已被明确上浮的六项决策、以及已显式的排产开工门，不得单独判为方案 A 级缺口。

输出规则：

- 无未关闭 A 级问题时，第一行严格输出 `PASS`，然后用不超过 25 条简短证据说明 A-1 至 A-23 的关闭点。
- 只要仍有 A 级，第一行严格输出 `FAIL`，只列可复现的 A 级问题；每项给位置、反例、最小修复。
- 不列 B/C 级建议，不重写方案，不评论代码实施完成度。
