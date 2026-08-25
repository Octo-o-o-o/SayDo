# AI Supply 通用接入参考架构终审 v14

## 1. 结论

结论：`FAIL`。

计数：`A=4，B=0，C=0`。本轮规则为 A/B 任一非零即失败，因此该方案当前不能作为“实施后必然闭合”的最终参考架构基线。

本轮只计入“完全按当前方案施工后，合同、producer 或 release gate 仍允许错误闭包”的问题；没有把尚未创建包、服务、脚本、fixture、三平台报告或 24 小时任务本身重复记为缺陷。

## 2. 冻结核对与边界

审查对象：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。

开审与落报告前均执行：

```text
shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
fcde60a8700dbfc14566d7183a30bf14d0310aa070d628173e23177dd1bda1ab

wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
30490 1830991
```

结果与指定冻结值完全一致，冻结核对为 `[ok]`。

报告初次落盘后再次执行同一组命令，结果仍为 SHA-256 `fcde60a8700dbfc14566d7183a30bf14d0310aa070d628173e23177dd1bda1ab`、`30490` 行、`1830991` bytes；目标未漂移，复核为 `[ok]`。

审查期间未读取 `prompts/`、既有 `research/codex-findings/`、`history/` 或任何旧评审；未修改目标方案、生产代码或 canonical。发现全部来自目标方案自身的合同、类型、门禁与其自称的完成条件，不依赖外部二手结论。由于本轮缺陷均是内部可机械复现的类型/闭包矛盾，没有用可变的外部产品事实作为判据。

## 3. 方法与只读证据

1. 按章节检查两条供给平面、protocol/Execution/bridge、receipt/producer/DAG/deep-readonly、authority/cursor/restart、四槽 `review_ready`、Rights/Auth/Funding/TUF/network、73 行 requirements、deterministic/live qualification、Connector SDK/第三方 Execution、三平台 helper/witness、JSON/SQLite 迁移、Phase 0–8/1A 与 Definition Complete。
2. 抽取方案内全部 11 个 TypeScript block，按文档顺序拼接，在本机 TypeScript `5.9.3` 下使用 `strict`、`noEmit`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、ES2023/NodeNext 编译，未注入任何 stub。
3. 通过 TypeScript AST 读取固定 requirements，而不是用文本行数猜测；再针对可疑交叉平面约束构造最小反例。
4. 对最终 gate/evidence/binding 使用 AST 成员清单和源码 occurrence 核对，确认所需证据是否真的进入可重算闭包，而不把 prose 中的“必须”当成已经存在的机器依赖。

只读检查结果：

```text
TypeScript blocks=11
extracted source bytes=1196869
extracted source lines=27683
diagnostics=0
instantiations=870075
types=113691
wall=2.07 s
maximum resident set size=536903680 bytes
```

以上均在方案声明的绝对资源门内；严格编译本身为 `[ok]`。但这也直接证明下列反例不是语法噪声：当前宽类型和 ambient producer 在零 diagnostics 下接受了错误组合。

requirements 的 AST census 为：

```json
{"rows":73,"uniqueRequirementKeys":73,"surfaces":{"inference":63,"execution":5,"bridge":4,"control_plane":1}}
```

固定行数、唯一 key 和四类数量为 `[ok]`。

主动反例摘要：

| 反例 | 当前 strict 结果 |
|---|---:|
| `codex.app-server/not_installed` 的已品牌 recovery 被替换成 custom endpoint graph，首步 ordinal 改为 `999` | `diagnostics=0` |
| 当前 state-only resolver 对 Codex `not_installed` 与 generic CLI `signed_out` 分别接受 local-runtime/reauthenticate rule | `diagnostics=0` |
| 要求上述两项使用 execution-specific resolver | `2 x TS2322`，证明当前类型已固定为错误的跨平面选择 |
| 从派生 registry row B 取得 after-intent terminal，提交给 row A | `diagnostics=0` |
| 远程 provider 选择 `not_applicable_local_execution_or_control`，完全省略 live plan/cycles | `diagnostics=0` |
| macOS remote-only release profile 与 TPM enrollment 拼接 | `diagnostics=0` |

## 4. 发现

### A-01：runtime recovery 仍按 state 全局分派，无法实现 73 行逐 row 的准确 graph、首步与证据

- 级别：A
- 锚点：`ReferenceRecoveryResolverRuleForStateV5`（25466–25492）、`ReferenceRuntimeRecoveryScenarioV5`（25505–25533）、`deriveReferenceRuntimeRecoveryContractsV5`（25547–25555）、Execution requirements（25678–25682）、Phase 4 recovery 验收（29146 起）、Definition Complete（29946）。
- 问题：resolver 的类型参数只有 runtime state `S`，没有 requirement `R`、surface、recipe、protocol 或 product。所有 `not_installed/not_running/cold/...` 都被固定到 `local_runtime_managed_or_external`，所有 `signed_out` 都被固定到 `reauthenticate`。因此 `codex.app-server` 的 `not_installed` 会落入包含 `install-local-runtime → start-local-runtime → load-or-select-model` 的本地推理模型图，而不是 Execution 安装/身份/session 图。更根本的是，scenario 中 `recoveryGraph` 仍只是任意 `ReferenceJourneyGraphV3`，`firstRecoveryStepOrdinal` 仍只是任意 `number`，二者也不从 rule 的 graph 或该 row 的状态索引得到。
- 反例：对合法品牌的 `CodexNotInstalledRecovery` 做不可变 copy，只把 graph 换成 `JOURNEY_GRAPH_CUSTOM_V3`、ordinal 换成 `999`，strict 编译仍为零 diagnostics。另一个类型探针显示当前 Codex `not_installed` 被定为 `local_runtime_managed_or_external`；把它要求为 execution-specific rule 得到 TS2322。这不是“producer 将来可能算对”的保障，因为当前 schema/type/release 输入都允许任意 graph/number，Definition Complete 声称的逐 row 机械派生尚不存在。
- 根因修复：新增唯一、版本化、按 `(requirementKey, runtimeState)` 键控的 recovery policy；每个值必须固定准确 `ruleId`、graph literal、first-step literal、所需 precondition/assertion evidence、recovery terminal 与 post-graph chain。`ReferenceRuntimeRecoveryScenario` 应从该 policy 做 dependent lookup，不能另存宽 `ReferenceJourneyGraphV3`/`number`。Execution、bridge、control plane、本地 managed/unmanaged 应各自使用准确 graph，不能由共享 state 名跨平面猜测。品牌 scenario 只允许私有 producer 从该 policy 提交。
- 机械验收：
  1. 从 73 行逐 row 展开完整 recovery subject exact set，expected/actual key、graph、first ordinal、evidence kind、terminal 全等；漏、重、换 row 均非零。
  2. 本轮的 `custom graph + ordinal 999` 反例必须在 TypeScript、Zod、producer 与 release verifier 四层失败。
  3. Codex/Kimi/OpenCode/generic CLI 的 `not_installed/signed_out/session_recovery` 使用各自 Execution graph；把任一项替换为 local-model、generic OAuth、bridge 或 custom graph 必须失败。
  4. 对每个 recovery state 自动生成错 graph、错首步、错 evidence、错 terminal、相邻 row 互换 mutation，并证明正向 scenario 可构造。

### A-02：authority registry 没有 after-intent 生命周期 SoT，派生结果退化为同一个宽 row 类型

- 级别：A
- 锚点：`AuthorityLeaseRegistryEntryV3`（582–618）、compiler census（785–805）、`deriveAuthorityLeaseRegistryV3`（1036–1043）、`AUTHORITY_LEASE_REGISTRY_V3`（1045 起）、registered terminal/reconciliation（1121–1198）、Phase 0 验收（28865）、Phase 8 authority gate（29424）。
- 问题：compiler census 只发现 type name、constituent/discriminant 和 authority kinds；`deriveAuthorityLeaseRegistryV3` 的六个输入也只有 census、expected/alias 列表和 authority-kind policy，没有 before-intent terminal、restart terminal、in-flight/terminal cursor、after-intent action、domain terminal 或私有 producer 的逐 constituent policy。全文 `after-intent-producer:` 只出现于模板类型声明一次，`operationIdentityDigest`、`actionIntentOrdinal`、`terminalOrdinal` 也只存在于两个抽象基类型；没有任何实际 domain action/terminal 注册到这些 brand。派生函数返回 `NonEmptyReadonly<AuthorityLeaseRegistryEntryV3>`，丢失逐 row literal generic，因此 `AUTHORITY_LEASE_REGISTRY_V3[number]` 只是同一个宽基型。
- 反例：声明两个派生 registry row A/B，从 A 取 lease/cursor/action、从 B 取 domain terminal，再调用 `commitRegisteredAfterIntentDomainTerminalV5`；strict 编译为零 diagnostics。它直接违反 Phase 0 的“另一 registry row 的 terminal 不可构造”，也意味着 restart sweep 的泛型外观不能证明实际生产域映射准确。
- 根因修复：建立唯一的 `AUTHORITY_LEASE_LIFECYCLE_POLICY`，以 compiler census 的每个 concrete constituent 为精确键，显式登记 lease、pre-intent closure、expiry/restart recovery、所有 in-flight/terminal cursor、真实 action-intent 类型、真实 domain terminal 类型与唯一私有 producer。deriver 必须返回保留每一项 generic/literal 的 readonly tuple/discriminated union，不能返回基型数组。实际 action/terminal 只能由各自 domain producer 取得 registry brand，随后才可进入统一 restart reconciliation。
- 机械验收：
  1. census constituent set 与 lifecycle policy key set、registry key set三者精确相等；新增、遗漏、alias 展开、branch 合并均非零。
  2. 每个真实 action/terminal 类型在源码中有唯一注册映射和 producer；模板字符串或 digest-only 占位不得通过。
  3. 本轮 row-B-terminal→row-A 反例必须产生编译错误；同 kind 不同 constituent、同 lease 不同 connection mode、旧 producer/version 互换也必须失败。
  4. restart store census 必须逐 exact registry row 形成一个 disposition，且在 exact set 完成前 admission 关闭；裸 `ReceiptRef`、通用包装、漏 terminal 或 producer swap 均使运行门和 release gate 非零。

### A-03：bounded live qualification 可被远程 row 声明为不适用，且未进入 entry/ecosystem/release gate

- 级别：A
- 锚点：`GaLiveQualificationApplicabilityV5`（22615–22630）、`GaJourneyReleaseEvidenceV2.liveQualification`（27712–27725）、`GaEntryGateReportReceipt`（27727–27747）、`GaEcosystemGateReportReceipt`（27784–27816）、`GaEcosystemReleaseEvidenceSetV3`（27886–27912）、`ReleaseEcosystemBinding`（27914–27937）、Phase 8（29384、29418）、Definition Complete（29954）。
- 问题：`GaLiveQualificationApplicabilityV5` 是不带 requirement 泛型的自由 union。任何远程 OpenAI/Azure/Bedrock/TokenHub 等 journey 都可选择 `not_applicable_local_execution_or_control`，只写固定 reason，省略 coverage plan 与两个 cycle。更严重的是，虽然单个 `GaJourneyReleaseEvidenceV2` 有 `liveQualification`，`GaEntryGateReportReceipt` 只消费 journey aggregate reports/attestations；ecosystem gate、release evidence set 与最外层 binding 均没有 expected/actual live coverage unit set、coverage plan 或两个 cycle 的引用/digest。最终 gate 因而无法从自身输入重算“remote 必须 live、最小 set cover 完整、连续两 cycle、cleanup 为零”。
- 反例：构造 `GaLiveQualificationApplicabilityV5 = { applicability: "not_applicable_local_execution_or_control", reason: "no_external_provider_account_or_remote_provider_entitlement" }`，strict 编译为零 diagnostics；AST 成员清单确认 entry/ecosystem/binding 无任何 live plan/cycle 字段。删除全部远程 live 运行仍可保留结构上完整的 entry/ecosystem gate。
- 根因修复：为每个 requirement 派生不可自由选择的 `liveQualificationMode`，并由 product/realm/auth/protocol/funding/必要平台 coverage unit policy决定；只有经精确 policy 证明无外部 provider/account entitlement 的 row 才能取 not-applicable。entry gate、ecosystem gate、release evidence set 和 `ReleaseEcosystemBinding` 必须逐层携带 expected/actual coverage unit exact set、plan receipt、同 distribution 的两个 cycle、资产 lease 与 terminal cleanup/credential/billing reconciliation closure。
- 机械验收：
  1. OpenAI 等任一 required remote row 选择 not-applicable 必须在类型/schema/producer 阶段失败。
  2. 从 73 行和平台政策独立重算 coverage unit set；漏 product/realm/auth/protocol/funding/platform unit、重复 unit 或用 deterministic fixture 代 live 均非零。
  3. 两 cycle 必须引用相同 current distribution 与 exact plan，cycle ordinal 为 1/2；旧 artifact、跨 plan、只一轮、quarantine、残留资源/credential/billing hold 均阻断 release。
  4. 最外层 binding 的 digest 必须覆盖上述 typed receipts；删除 journey 内 live evidence 或把 remote 改为 N/A 必须改变/破坏可离线验证的闭包。

### A-04：三平台 helper/witness 只剩摘要 digest，平台/backend 与最终 release closure 没有类型级绑定

- 级别：A
- 锚点：`MonotonicAnchorPlatformReleaseProfileV1`（5696–5723）、`MonotonicAnchorEnrollmentReceipt`（6337–6383）、三平台产品面要求（28188）、Phase 0（28861）、Phase 1A（28962–28975）、Phase 8（29405–29406、29420–29421）、Definition Complete（29939）。
- 问题：platform profile 只保存固定平台表和一个 `platformBackendConformanceReportSetDigest: string`；没有 typed refs 绑定三个最终 installer/helper、权限 manifest、direct-syscall TCK、升级/降级报告、签名/provenance、当前 production witness deployment、threshold/IaC 与未过期 operational qualification。`MonotonicAnchorEnrollmentReceipt` 也不以当前 platform 为泛型，TPM 与 remote 两分支可与任意 platform profile 拼接；macOS 表明只允许 remote witness，但类型仍允许 TPM。最终 `ReferenceGradeProfileV3`、ecosystem gate/evidence 与 `ReleaseEcosystemBinding` 都没有 platform-security/witness closure receipt，只有普通 distribution/profile/report digest 不能证明所指对象就是本次最终安装包和当前 production 服务。
- 反例：把一个合法 TPM enrollment spread 后换挂 `MonotonicAnchorPlatformReleaseProfileV1`，作为 macOS release profile 使用，strict 编译为零 diagnostics；该组合与 profile 中 `macos-arm64` 的 remote-only矩阵矛盾。另一个 AST 成员检查确认最终 gate/binding 没有 helper/installer/deployment/IaC/qualification 的 typed closure。
- 根因修复：新增按 platform 判别并私有提交的 `PlatformSecurityReleaseClosureReceipt`：精确三元素 tuple 分别绑定最终 installer、实际安装的 helper artifact、权限/系统调用能力、SBOM/provenance/signature、direct-syscall corpus、升级/降级/卸载与当前 distribution。remote 分支再绑定 production deployment、realm、threshold member set、IaC digest、operator/trust domain、当前 24 小时 qualification；TPM 分支绑定设备/NV attestation。`MonotonicAnchorEnrollmentReceipt<P>` 必须按 `P` 条件限制 backend，且 platform closure 逐层进入 reference profile、ecosystem gate、release evidence 与最外层 binding。
- 机械验收：
  1. 本轮 macOS+TPM 反例必须编译失败；Linux/Windows 的 TPM 正例和三平台 remote 正例分别可构造。
  2. 最终 closure 必须恰有 macOS arm64、Linux x64、Windows x64 三项，全部等于 current distribution；漏平台、重复平台、另一 artifact helper、installer 未安装或 helper handshake 不等均失败。
  3. staging/mock witness、旧 production deployment、IaC/deployment/threshold 任一 digest 换挂、qualification 过期/缺 member/缺 observer/缺 fault corpus 均不能生成 producer receipt或 release binding。
  4. 删除任一 helper/installer/witness typed ref 必须让 Phase 1A 与 Phase 8 release verifier 非零，而不是仅由一个自报 report-set digest继续通过。

## 5. 覆盖结论

| 审查面 | 结论 |
|---|---|
| 两平面、三核心协议、五种 Execution surface、bridge data/control 区分 | 未发现额外 post-implementation A/B/C；plane/wire/identity 与 Execution 生命周期主体闭合 |
| receipt producer、DAG、deep-readonly、physical send/effect authority | deep-readonly 与 send/effect DAG主体可闭合；after-intent registry 受 A-02 阻断 |
| authority/cursor/after-intent/restart | A-02 |
| 四槽 `review_ready` | 四元素 tuple、slot/binding/Activation/chat terminal/conversation-ready gate 与 evaluator independence 有精确绑定，未发现额外问题 |
| Rights/Auth/Funding/TUF/network | 判别 auth producer、逐请求资金/账本、完整 TUF lineage、SSRF/proxy/credential egress主体闭合，未发现额外问题 |
| 73 行 requirements 与逐 row recovery | 行数和四类分布正确；A-01 阻断逐 row recovery 完成声明 |
| deterministic 与 bounded live qualification | deterministic run-subject展开主体闭合；A-03 允许 live 被省略 |
| Connector SDK、第三方 inference/Execution plugin | 公共边界、TCK、sandbox与第三方 Execution surface主体闭合，未发现额外问题 |
| 三平台 helper、anchor/witness | A-04 |
| JSON/SQLite 迁移 | 五态 dual-read/shadow/reconcile/dual-write/cutover、kill point、quarantine与上一版降级路径闭合，未发现额外问题 |
| strict 零 stub 编译与资源门 | 本轮无 stub strict 编译零 diagnostics且在绝对门内；通过不能掩盖四个语义闭包缺口 |
| Phase 0–8/1A 与 Definition Complete | 各 Phase 均有目标、验收与统一 orchestrator；但当前 gate 输入不足以机械拒绝 A-01 至 A-04 的反例，Definition Complete 尚不可判真 |

## 6. 最终裁决

`A=4，B=0，C=0，FAIL`。

必须先修复四项合同并让所列反例在 strict TypeScript、schema、私有 producer、运行 verifier 和最外层 release gate 全部失败，再进行下一轮冻结终审。仅在 prose、Phase checklist 或布尔 `proves...: true` 中补一句承诺不构成关闭。
