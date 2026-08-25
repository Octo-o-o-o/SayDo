# AI 供给参考架构最终闭包复审 v4

VERDICT: FAIL

结论：当前输入仍有 4 个 A、6 个 B、0 个 C。即使严格完整实施本 SHA，仍存在不可构造的 OAuth DAG、跨 flow credential 换挂、fallback 授权 producer 矛盾，以及 Execution tool 重复副作用/费用路径。

## SHA 与读取范围

- 目标文件开始 SHA-256：`79ad953a4dbb200100ff5362079928b0e8f0e03837cae1401e6b8b6fe19c27dd`
- 目标文件结束 SHA-256：`79ad953a4dbb200100ff5362079928b0e8f0e03837cae1401e6b8b6fe19c27dd`
- 与期望 SHA-256 完全一致。
- 仓库开始 HEAD：`bb9d28735598693f03345630eb4dc256862d5c29`
- 仓库结束 HEAD：`174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`
- 审查期间仓库 HEAD 被其他任务并发推进，但唯一评审对象的内容和 SHA 未变化。
- 完整读取 prompt 1–35 行、目标文档 1–5,341 行（471,590 bytes）；未打开既往报告、未编辑文件、未运行实施测试。

## A

### A1. OAuth 成功 terminal 与 credential transition 形成不可哈希的双向环

- 位置：`ReceiptRef` 第 244–248 行；`OAuthExchangeTerminalReceipt` 第 387–404 行，尤其第 397 行；`OAuthCredentialTransitionReceipt` 第 406–440 行，尤其第 409 行。
- 最小反例：成功 terminal `T` 必须保存 `resultingCredentialTransition={id,generation,digest(C)}`；transition `C` 又必须保存 `exchangeTerminal={id,generation,digest(T)}`。两者都是内容寻址、不可变 receipt，因此既不能先算 `T`，也不能先算 `C`。
- 现有条款为何挡不住：原子选择 winner 只能解决数据库 CAS，不能解开内容摘要递归；不存在排除字段的 core、原子 SCC bundle 或其他可计算规则。
- 最小修订：改成单向链 `ExchangeSuccessEvidence(lease/token-response)` → `CredentialTransition(successEvidence)` → `ExchangeCommit/Terminal(transition)`，或合并为一个判别型原子 commit receipt。

### A2. Device Authorization 缺少响应 producer，device code 可跨 flow/local session 换挂

- 位置：device flow-start 第 320–326 行；device poll lease 第 365–368 行；最终 device grant 第 465–483 行；宣称闭包的第 2906、3571 行。
- 最小反例：并发创建 `F_A`、`F_B` 两个 device flow；poll lease 可填写 `flowAuthorization=F_A`、`deviceCodeHandleDigest=H_B`，没有 receipt 证明 `H_B` 来自 `F_A` 的 request/client/issuer/session。
- 现有条款为何挡不住：flow-start 只保存请求；最终 grant 在成功后才复制响应字段，无法在首个 poll 字节前阻止换挂。
- 最小修订：新增 `OAuthDeviceAuthorizationResultReceipt`，绑定 flow、client、endpoint/request、device-code broker handle、user-code/verification URI、interval、expiry、issuer与 initiating session/user；每个 poll lease必须引用它。

### A3. FallbackPlan 的激活时 disclosure 依赖运行时才产生的授权，producer 顺序不可构造

- 位置：`AuthorizationDisclosureReceipt` 第 1447–1456 行；`FallbackPlanReceipt.authorizationDisclosure` 第 2094–2112 行；ActivationManifest 第 2833–2872 行；第 3056、3090–3092、3562、3777 行。
- 最小反例：payg A→B fallback 要随 ActivationManifest 固化 plan；但 disclosure 必须绑定待消费 authorization/consent，而具体 runtime authorization 明确只在 dispatch 现场产生且不得进入 manifest。
- 现有条款为何挡不住：aggregate limit/template 不是当前用户同意或可消费 reservation；重生成 plan 又违反授权过期不改 active pointer。
- 最小修订：拆 activation-time `FallbackPlanTemplateReceipt` 与 per-ingress `FallbackAdmissionReceipt`；后者绑定当前 FundingDecision、原子 aggregate reservation、实际 disclosure 和 ingress identity，cursor/solution lease引用它。

### A4. Execution tool 没有逐外部请求/effect 的 durable child lease

- 位置：`ExecutionToolConsentReceipt.maxExternalPhysicalRequests` 第 2567–2589 行；`ToolInvocationReceipt`、funding、commit lease与 transition 第 2679–2788 行；第 3555、4555–4558 行。
- 最小反例：用户同意最多 1 个外部请求，tool 获得 invocation 与 commit lease 后发两个 POST；或给 `no_external_charge` 填无关 receipt 后调用付费 API。
- 现有条款为何挡不住：Agent physical lease不绑定 logical tool invocation/consent/funding；invocation 级 commit lease不能表达多个 external request ordinal。
- 最小修订：新增 tool request cursor、逐 ordinal physical request lease/terminal和逐 effect ordinal commit lease，绑定 invocation、arguments/scope、consent、funding/reservation、endpoint/request digest与 generation；定义严格 tool-specific no-charge proof。

## B

### B1. Runtime inference 物理发送闭包没有绑定当前 FundingDecision

- 位置：`RuntimeUpstreamAttemptLeaseReceipt` 第 937–958 行；`InferenceFundingDecisionReceipt` 第 1734–1739 行；`PreparedAttemptDescriptor` 第 3176–3235 行；第 3056、3575 行。
- 最小反例：把另一 operation 的 no-new-spend proof、过期 authorization 或另一 custom consent用于发送；attempt lease和 descriptor均没有 funding template/decision ref。
- 最小修订：runtime physical lease和 descriptor加入准确 FundingPolicyTemplate、InferenceFundingDecision与分支 proof/authorization/consent refs，与 successor、reservation消费和 commit token同事务。

### B2. Execution physical terminal 不是严格联合

- 位置：`ExecutionPhysicalRequestTerminalReceipt` 第 2504–2512 行；对照 inference 第 970–990 行；通用 cursor 规则第 3560 行。
- 最小反例：可构造 `{outcome:"success", sentState:"not_sent"}` 或 `{outcome:"failed_before_send", sentState:"sent"}`，且没有 closesCursor/retry edge语义。
- 最小修订：改成与 inference 等价的判别联合；success固定 sent+close，failed-before-send固定 not-sent+具名 edge，其余 sent/charge-unknown固定 close。

### B3. Execution 的 no-secret 与 owned-capacity 是不可验证断言

- 位置：`ExecutionCredentialStateReceipt` 第 2314–2328 行；`ExecutionOwnedCapacityAdmissionReceipt` 第 2330–2341 行；`ExecutionNoNewSpendProofReceipt` 第 2343–2363 行。
- 最小反例：stdio分支把任意 receipt填入 no-secret proof；远程 surface自行签两个 true 布尔值即可进入 no-new-spend。
- 最小修订：定义严格 no-secret receipt，绑定 surface/admission、空 env/handle/broker ACL、credential-store deny和 generation；owned capacity拆 host-spawned local与 independent-authority分支，绑定 owner、process/device、session、measurement/nonce和单次 admission。

### B4. ActualAttemptReport 没有 ingress/session/turn 边界

- 位置：`AuthorizationDisclosureReceipt` 与 `ActualAttemptReportReceipt` 第 1447–1466 行；第 3777、4615 行。
- 最小反例：持久预算/session有 C1、C2 两次 ingress，报告可混入 C2 lease或只列 C1 的部分 sent entry。
- 最小修订：disclosure/report均绑定唯一 ingress/session-turn、FundingDecision、selected sequence和权威 ledger root/range；report由该范围全部 sent entries确定性 fold。

### B5. Execution extension 的 ProtocolImplementationReceipt 没进入对象图

- 位置：`ProtocolImplementationReceipt` 第 1929–1956 行；`ExecutionSurface` 第 2204–2209 行；Connection 第 2790–2812 行；Activation 第 2874–2892 行；第 3241 行。
- 最小反例：`ext:execution:*` 只提供 generic wire profile/driver即可激活，stdio surface甚至没有 wire protocol字段，无法遍历 implementation/TCK ref。
- 最小修订：所有 Execution surface显式绑定 ExecutionWireProtocolId、ProtocolImplementationReceipt和TCK attestation；Connection、Activation、SessionAdmission/Lease逐层保存同一 ref并校验 plane/kind/sdk/artifact/profile。

### B6. EvidenceStore 并发上限与 orphan 上限冲突

- 位置：`EvidenceStoreBudgetProfileV1` 第 3655–3667 行；原子 admission/恢复承诺第 3751–3752 行。
- 最小反例：4 个并发 ingest各留下64 MiB temp，共256 MiB orphan，但 recovery cap只有128 MiB。
- 最小修订：potential-orphan reservation成为不超过128 MiB的 admission硬约束，或把 recovery cap提高到所有并发 in-flight temp的最大组合；明确 crash-safe staging/rename、journal和超限恢复。

## C

无。
