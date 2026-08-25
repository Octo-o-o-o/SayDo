# AI Supply 参考架构最终闭包复核 v12

## 唯一 verdict

`FAIL`

- A：2
- B：2
- C：0

本快照不能作为顶级开源项目的最终可施工参考架构。阻断原因不是文档覆盖面不足，而是四处机器合同仍允许正文明确禁止的状态：authority registry 对联合分支过度授权、evaluator operation 没有可达的能力与激活闭包、IPv6 loopback 身份存在两套互斥字面量、custom eligibility/rights 仍可由非法笛卡尔积和 bare `ReceiptRef` 构造。

## 冻结完整性

审查启动及报告成稿前分别独立执行：

```text
wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

两次结果一致：

```text
25018 1513595 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
7ffadde7837eeab3332431a67437aff2a65595cc1e9cda8c88c69a2e970e8d09
```

与 prompt 冻结身份完全一致。随后按行号从第 1 行连续读到第 25,018 行；未抽样，未读取其他 prompt、review、history、journal、日志或实现者说明，也未修改目标文档。

## Findings

### A-1 authority registry 不是按联合分支定权，读操作被授予 effect authority，副作用请求又出现双 authority

精确落点：

- `AuthorityLeaseRegistryEntryV2` 只以 `sourceTypeName` 标识租约，见第 400–409 行；`AUTHORITY_LEASE_REQUIRED_KIND_POLICY_V2` 也只是 `Record<ConcreteAuthorityLeaseTypeNameV2, ...>`，见第 537–542 行。
- `ExecutionTurnUnknownReconciliationLeaseReceipt` 是含 `authority_query | effect_cleanup | manual_permanent_block` 的一个 concrete union，见第 14831–14884 行；三个分支分别声明不授予 query network/process、cleanup effect、或任何 external action authority，见第 14858–14883 行。
- 但 registry 对这个 concrete type 无条件要求 `network_admission + external_effect + exclusive_cursor_action`，见第 598 行。
- `ExecutionToolExternalRequestLeaseReceipt` 同时容纳 `read_only` 与 `side_effect`，见第 15754–15770 行；其两个窄化类型只是 alias，见第 15808–15814 行和第 521–529 行。
- registry 却对整个 base 无条件要求 `external_effect`，见第 599 行。side-effect 分支又内嵌 `ExecutorCommitLeaseReceipt`，后者独立要求 `gate_lease + external_effect`，见第 600 行和第 16285–16319 行。

最小反例：

1. 构造 `requestEffect.kind="read_only"`、GET/HEAD proof 完整的 `ExecutionToolReadOnlyExternalRequestLeaseReceipt`。
2. 按 registry 的准确 policy 给它的 inventory 放入 `network_admission`、`funding_reservation`、`external_effect`、`exclusive_cursor_action`。
3. 该对象恰好满足当前 census/policy，却在只读路径持有正文不需要的 effect authority。

另一个同根反例是 side-effect request：外层 `ExecutionToolExternalRequestLeaseReceipt` 和内层 `ExecutorCommitLeaseReceipt` 各自持有一份 `external_effect`。它们有不同 lease/commit token，可在崩溃恢复或错误消费路径中成为两个合法 authority，而不是单一 effect-once 前驱。`manual_permanent_block` reconciliation 也会按第 598 行持有 network/effect authority，尽管第 14876–14883 行声明它不授予任何外部动作。

现有门禁抓不到的原因：第 437–444 行、第 23556 行和 `pre-intent-authority-closure.model` 第 24277 行验证的是“实际 inventory 是否等于 registry policy”。这里 registry policy 本身就是过宽的，因而 exact-equality 会为错误状态背书。alias census 还特意把 read-only/side-effect 两个分支归为不增字段的纯 alias，无法给它们定义不同权限集。`execution-tool-child-lease.model` 第 24292 行检查结果/effect-once 状态，但没有“read-only 分支 surplus effect kind”或“request lease 与 commit lease 双持 effect authority”的 registry mutation。

根因级修复：

- 把 registry key 从单一 type name 提升为 `{sourceTypeName, discriminant path, discriminant value}`，或把三个 reconciliation 分支及 read-only/side-effect request 拆成独立 concrete lease type。
- read-only request 只持 network/funding/cursor 权限，不持 `external_effect`；side-effect 的唯一 `external_effect` owner 应是 `ExecutorCommitLeaseReceipt`，external request lease 只持发送与账务相关权限。
- `authority_query` 只获得准确 query 所需权限，`effect_cleanup` 只获得准确 cleanup 所需权限，`manual_permanent_block` 只获得内部 cursor action。
- 为每个联合 constituent 增加 exact required-kind 正例、surplus-kind 负例、同一 logical effect 双 authority 负例，以及 restart sweep 中按 discriminant 恢复的 kill-point fixture。

### A-2 evaluator 是声明过但不可闭合的 operation，`review_ready` 可在没有 evaluate 证明时构造

精确落点：

- `InferenceOperation` 明确包含 `"evaluate"`，见第 224 行。
- `CapabilityReceipt.verifiedOperations` 只有 `readonly ["chat"]` 或 `readonly ["chat", "tool_roundtrip"]`，见第 11514–11541 行；类型中不存在能证明 `evaluate` 的 constituent。
- `RequiredCapabilityForSlot<"evaluator">` 只要求 strict JSON schema 与 observed model，见第 11543–11565 行，不要求 `verifiedOperations` 包含 `evaluate`。
- `SupplySlotBindingReceipt` 因而可以把上述 capability 放进 evaluator，并由四槽 tuple 生成 `SupplySolutionReceipt.readiness="review_ready"`，见第 12161–12210 行。
- `InferenceActivationManifest.enabledInferenceOperations` 也只有 `["chat"]` 或 `["chat", "tool_roundtrip"]`，见第 16867–16886 行，没有 `evaluate` 激活分支。
- 同时正文要求 operation-specific Billing/Policy 完整、dispatch 恰好命中当前 operation，见第 17595–17600 行。

最小反例：构造一份 `conversationProfile="plain_dialog"`、`verifiedOperations=["chat"]`、`structuredOutputSupport.kind="json_schema_strict"`、model/route/raw evidence 独立且资金合格的 capability。它能满足 `RequiredCapabilityForSlot<"evaluator">`，四槽 solution 可声明 `review_ready`。之后只有两个选择：

1. 以 `operation="evaluate"` 调度，当前 Activation 没有可达分支；
2. 偷用 `operation="chat"` 调度，则 evaluate 的 operation-specific Rights/Billing/route/funding 从未被验证。

这不是纯命名问题：第一种使核心正向终态不可构造，第二种使按 operation 隔离的安全、权益和费用策略失真。

现有门禁抓不到的原因：第 17190–17205 行的负类型断言只拒绝缺 reasoning、cost 或 strict schema 的 plain-dialog capability；第 23680 行和 `capability-slot-funding.tck` 第 24286 行也只列能力轴、独立性与 unknown-funding 换挂，没有“evaluator 必须具备并激活 evaluate operation”的正反例。IPv4/普通 chat 的四槽 fixture 可以让这些门全部绿。

根因级修复：先确定唯一语义并删除另一套真相：

- 若 `evaluate` 是真实 operation，则为 capability 增加可证明的 evaluator operation constituent；`RequiredCapabilityForSlot<"evaluator">`、Binding、Activation、Rights、Billing、route fence、funding decision 和 terminal 全部必须精确携带 `evaluate`，并新增正例及 chat→evaluate 换挂负例。
- 若 evaluator 只是 chat 上层用途，则从 `InferenceOperation` 删除 `evaluate`，明确所有 evaluator 调用按 chat operation 取策略，禁止任何表或 receipt 再声明独立 evaluate operation。

两种修复都必须增加 compile-time reachability、Zod、dispatch、actual ledger 与 release TCK 的同一 operation 断言，不能只补一个布尔字段。

### B-1 IPv6 loopback 在 raw address 与 URL literal 之间没有唯一 canonical identity

精确落点：

- `PassiveLoopbackMetadataProbe.address` 使用 `"::1"`，见第 17830–17839 行。
- `DiscoveryConformanceModeBinding.literalLoopbackAddress` 使用 `"[::1]"`，见第 18363–18380 行。
- `PassiveLoopbackDiscoveryProbeIntentReceipt.literalLoopbackAddress` 也使用 `"[::1]"`，并声称与 core/peer address exact，见第 18578–18589 行。
- `ReleaseBundledPassiveProbeCapabilityCore` 与 `PassiveLoopbackPeerAdmissionReceipt` 又使用 `"::1"`，见第 19372–19406 行。
- Phase 4 把 literal `127.0.0.1/::1` 与 exact core/run equality 同时列为门禁，见第 23835–23836 行。

最小反例：release capability core 与 held-socket peer admission 都选择 IPv6 `"::1"`。要生成 probe intent 和 conformance subject时，类型只接受 `"[::1]"`。若按“逐字段 exact”比较，没有值能同时满足两边；若生产者静默补方括号，则该 normalization 没有版本化 canonicalizer、输入/输出字段或 digest 规则，换挂检查无法判断这是合法渲染还是 identity 漂移。IPv4 `127.0.0.1` 会掩盖该问题。

现有门禁抓不到的原因：`discovery-conformance.tck` 第 24288 行要求冻结 literal address，却没有区分 raw IP 与 URI authority、没有 IPv6 normalization golden，也没有 `::1`/`[::1]` 混用 mutation。TypeScript required-`never` 扫描不会把这些字段相交，因此两套各自可编译的 union 不会报错。

根因级修复：定义唯一 `CanonicalLoopbackIp = "127.0.0.1" | "::1"`，所有身份、core、peer、intent 和 semantic subject只保存它；URL 构造另设派生字段 `urlAuthorityLiteral`，由版本化纯函数把 `::1` 渲染为 `[::1]`，但不参与 raw address equality。增加 IPv4/IPv6正例、方括号混用负例和跨平台 socket/URL digest golden。

### B-2 custom eligibility 与 private rights 仍允许非法笛卡尔积和 bare authority ref

精确落点：

- `ProductEligibilityReceipt.status`、`permitsCredentialInput: boolean` 与可选 `attestedCustomScope` 相互独立，见第 3887–3905 行。
- `UserAdminAttestedCustomRightsReceipt.productEligibility` 仍是裸 `ReceiptRef`，见第 3908–3923 行；相邻的 official rights 已使用具体 `ProductEligibilityReceipt`，见第 3926–3942 行。
- 正文要求只有 `eligible` 或完整 exact custom attestation 才能令 `permitsCredentialInput=true`，`unknown/forbidden` 必须为 false，见第 17586 行。
- Phase 1 只以验收段落声明 exact custom 流程，见第 23618 行；持续 TCK 表没有对应的 discriminated-union/typed-ref mutation。

最小反例有三种，均能通过当前 TypeScript 形状：

1. `status="forbidden"` 且 `permitsCredentialInput=true`；
2. `status="user_or_admin_attested_custom"`、`permitsCredentialInput=true`，但省略 `attestedCustomScope`；
3. `UserAdminAttestedCustomRightsReceipt.productEligibility` 指向任意结构合法的无关 receipt。

后续 proposal/candidate billing 虽另带一份具体 `ProductEligibilityReceipt`，当前形状没有把 rights 内部 ref 类型化为同一 exact custom constituent；多个 `proves...Exact` 布尔不能替代这一约束。

现有门禁抓不到的原因：通用 edge manifest 最多能在未来手写 target kind，不能从当前 bare 类型机械推出 status、permit、scope 与 rights subject 的联合谓词。`transport-credential-boundary.tck` 第 24275 行覆盖 header、recipient、proxy/TLS，但不覆盖 eligibility 状态笛卡尔积；Phase 1 的 prose 条目也没有给出对应类型断言或具名 mutation。因此一个实现可以忠实生成当前 interface 与 registry schema，却仍接收以上对象。

根因级修复：把 `ProductEligibilityReceipt` 改成四分支严格联合：

- `eligible`：`permitsCredentialInput:true`，custom scope 禁止；
- `user_or_admin_attested_custom`：`permitsCredentialInput:true`，完整 scope 必填；
- `unknown | forbidden`：`permitsCredentialInput:false`，custom scope 禁止。

同时把 private rights 的字段收紧为 `Extract<ProductEligibilityReceipt, {status:"user_or_admin_attested_custom"; permitsCredentialInput:true}>`，并直接绑定相同 endpoint/product/use/distribution/attesting principal。新增上述三种反例以及跨 endpoint/principal/TTL 的 compile-time、Zod、edge-manifest 和 runtime mutation。

## 覆盖矩阵

| 编号 | 审查面 | 结论 | 证据与说明 |
|---:|---|---|---|
| 1 | Connector/Adapter/Protocol 边界 | 未发现额外阻断 | 两平面、协议扩展 ID、SDK 端口和依赖方向分别定义于第 186–224、17790–17854、24180–24189 行。 |
| 2 | Capability/Policy/Receipt 唯一真相 | 阻断 | evaluator operation 出现 enum、capability、activation 三套不一致真相，见 A-2。 |
| 3 | lease 穷举与非空 inventory | 阻断 | census 覆盖面很大，但 required-kind policy 只按 type name，不能按 union constituent 定权，见 A-1。 |
| 4 | 单向 producer、CAS、restart recovery | 有条件闭合 | 通用 edge manifest、writer fence 与 sweep 均有合同；A-1 的双 effect authority 会破坏“每个 effect 一个可消费前驱”。 |
| 5 | descriptor→lease→envelope→bundle→intent→terminal | 未发现额外阻断 | 推理发送链、before/after-intent 与 hosted occurrence closure 在第 23749–23751、24280 行具有正反门。 |
| 6 | Gate/effect/network authority 分离 | 阻断 | hosted inference 分离已定义；Execution request/commit lease 的 `external_effect` 重复，见 A-1。 |
| 7 | conformance/runtime/fallback 费用与 retry | 未发现额外阻断 | priced/两类unknown、correction escrow、sent/billing 正交与 fallback terminal 在第 23747–23756、24280–24284 行闭合。 |
| 8 | Rights/Data/Route/Model/raw response/usage | 未发现额外阻断 | operation closure、response inventory/loss、field authority与usage dimension有具名合同和 TCK；custom eligibility 的前置形状例外见 B-2。 |
| 9 | SupplySolution 四槽与 manual-only | 阻断 | 四槽 tuple及 unknown 自动链隔离存在，但 evaluator operation closure缺失，见 A-2。 |
| 10 | Execution identity/sandbox/session/turn/close | 未发现新的独立问题 | stdio/loopback/remote identity、close-ready revision、unknown recovery与sandbox canary均有正向和故障分支；权限集问题统一归 A-1。 |
| 11 | Execution tool/effect/manual reconciliation | 阻断 | 结果证据和 reconciliation 分支较完整，但 branch-insensitive authority policy 导致 overgrant/double authority，见 A-1。 |
| 12 | discovery 三模式与 live evidence | 部分阻断 | static/passive/explicit-active 类型互斥且 core/run 分离；IPv6 raw/URI identity 不闭合，见 B-1。 |
| 13 | OAuth/API-key/workload identity | 未发现额外阻断 | flow、family、physical step、send intent、terminal、rotation/recovery和 kill-point 均有具名状态机与 TCK。 |
| 14 | custom header/mTLS/proxy/TLS/recipient | 未发现额外阻断 | component、processor、remote DNS authority、0-RTT 与 header collision 覆盖较完整；ProductEligibility/private rights 例外见 B-2。 |
| 15 | publisher fairness与资源预算 | 未发现阻断 | twelfths 递推、`-13..13` golden、0–8 tuple、cohort、restart与独立 oracle 可计算；未发现舍入或等待上限矛盾。 |
| 16 | TUF/registry/plugin/release/witness | 未发现阻断 | root rotation、逐role high-watermark、hermetic build/sign、detached binding及24h witness qualification均有不可替换证据链。 |
| 17 | 61 行 requirements 与 typed journey | 行数闭合，未发现额外阻断 | 独立计数第 21486–21546 行恰为61个 `requirementKey`；recipe、state producer、run-subject与GA exact-set投影有 Phase/TCK 门。 |
| 18 | Phase/TCK/DoD 映射 | 部分阻断 | 总体投影具体；A-1、A-2、B-1、B-2 所列 mutation 未进入现有具名 suite，故当前不能作为最终门。 |
| 19 | 性能、稳定性、可观测性与保留 | 未发现阻断 | 北极星指标、资源 cap、soak、审计/日志分流、敏感 payload digest与证据预算均有数字门。 |
| 20 | 回滚、迁移与长期扩展 | 未发现阻断 | inactive dual-read、旧模型受控双写、上一正式版降级演练、feature flag/hard-stop 与 owner preflight 均有明确边界。 |

## 收口判定

依据 prompt 的唯一判定规则，A=2、B=2，因此 verdict 只能是 `FAIL`。先修复按联合 constituent 定权、evaluator operation 单一真相、IPv6 canonical identity 和 custom eligibility 严格联合，再以新 SHA 重新运行类型正向可达、Zod、authority census、state-machine mutation、Phase/TCK 与三路独立终审；不能以当前预冻结自审的 0 diagnostics 或布尔 proof 字段替代这些反例。
