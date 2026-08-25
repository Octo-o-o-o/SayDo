# AI 供给普适接入方案架构终审 v15

## 结论

`FAIL`。

- A: 3
- B: 0
- C: 0
- 判定规则: 只有 A=0 且 B=0 才可 `PASS`；本轮不满足。

本结论只评价“按当前方案照样实施后仍会错误、不可构造、可绕过或不可机械判定”的问题；没有把尚未施工、目录尚不存在或生产代码仍处于旧形态本身计为缺陷。

## 冻结件核验

审查对象仅为：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

首次核验命令与原始结果：

```text
$ shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
7fbc0a8ba767d90d84e26a49f83a357d57c5a269f1cf0c43b54c2e6a4d832967  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

$ wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
   33210 2146263 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

三元组与指定冻结值完全一致，审查继续。审查基线仓库提交为：

```text
174ab48895aa1e4a6c6b42b9c74187f20efc3cfd
```

## 范围与方法

1. 对冻结件做字节级完整读取、标题索引和全部 11 个 TypeScript fence 的完整抽取；11 个开始 fence 与 11 个结束 fence 配平。
2. 对抽取合同运行 TypeScript strict 编译，启用 `exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`NodeNext` 和 extended diagnostics；另扫描 `any`、`ts-ignore`、`ts-expect-error` 与常见双重断言旁路。
3. 逐段核对当前 canonical 和生产基线，重点读取 `docs/09-data-contracts.md`、`docs/08-module-design.md`、`docs/modules/e-crosscutting.md`、`packages/contracts/src/types/modelbinding.ts`、`packages/daemon/src/providers/openaiCompat.ts`、`packages/daemon/src/providers/types.ts`、`packages/daemon/src/config/cliCapability.ts` 与 `packages/daemon/src/runtimeChildRegistry.ts`。现有旧形态只用来验证迁移输入和边界，没有把它当成方案施工缺口。
4. 对 73 行 requirement 与 73 行 exact connection oracle 做独立计数、重复键检查和排序后键集摘要比较。
5. 在完整合同副本末尾加入纯类型最小反例；反例不使用 `any`、断言、stub 或生产文件修改。编译成功即表示当前合同允许该构造。
6. 没有查阅旧评审内容，也没有使用二手资料。本轮三项结论均由冻结合同内部的构造性矛盾直接成立，因此无需联网核对易变事实。

### 原始检查结果

原合同 strict 编译：

```text
tsc_rc=0
Files:                          68
Lines of TypeScript:         30347
Types:                      134204
Instantiations:             882412
Memory used:               441167K
Check time:                  1.76s
Total time:                  1.95s
570671104 maximum resident set size
```

静态卫生与结构：

```text
typescript_fences=11
typescript_closing_fences=11
exact_word_any=0
ts_expect_error_or_ignore=0
unsafe_assertion_markers=0
target_headings=122
producer_signature_hits_for_exact_authority_terminal=0
terminal_brand_occurrences=2
```

73 行与 oracle：

```text
requirements=73 rc=0
oracles=73 rc=0
inference=63 rc=0
execution=5 rc=0
bridge=4 rc=0
control_plane=1 rc=0
duplicate requirement keys=0
duplicate oracle keys=0
```

两份排序键集的 SHA-256 相同：

```text
636351a77ac37e5b7f4822e2ff30564543331c1249b7090c544407d3a303c051  -
636351a77ac37e5b7f4822e2ff30564543331c1249b7090c544407d3a303c051  -
```

加入本报告三组最小反例后的 strict 编译：

```text
counterexample_tsc_rc=0
Files:                          68
Lines of TypeScript:         30446
Types:                      134341
Instantiations:             882742
Check time:                  1.77s
Total time:                  1.99s
```

这不是“编译绿即方案绿”：反例正是利用合同允许的错误构造，0 diagnostics 是发现成立的机械证据。

## 发现

### A-1 第三方 Execution 插件没有可遍历的 TUF、签名 manifest 与 artifact 信任闭包

准确锚点：

- 冻结件 `30795` 明确要求 Execution policy 引用完整 `TufTargetAuthorizationReceipt`，不能只存 delegated role 或 evidence digest；`33204` 又宣称 Execution closure 同值绑定 publisher、TUF target、signed manifest、artifact、driver、sandbox 等全部对象。
- 实际 `ExecutionPluginPolicyReceipt` 在 `13948-13966` 只有 `publisherIdentityDigest`、`adapterArtifactDigest`、若干 policy digest 和用户 decision，没有 `TufTargetAuthorizationReceipt`、签名 manifest、typed publisher identity 或 typed artifact。
- `commitExecutionPluginPolicyV1` 在 `13968-13973` 只接受上述缺口形状。
- `ExecutionThirdPartyPluginActivationClosureV6` 在 `14007-14025` 继续只传 string digest；没有补入 trust lineage。
- `ExecutionActivationManifestBase` 在 `19501-19521` 把 `driverArtifact` 与 `driverProvenance` 都降成任意 `ReceiptRef`；`19528-19543` 的 conditional branch 只要求另带 activation closure，没有证明两个 driver ref 与该 closure 的 artifact、publisher、manifest 或 TUF target 相同。
- 对照 inference 分支，`InferencePluginPolicyReceipt` 与 `InferenceActivationPluginPolicyClosureReceipt` 在 `14773-14823` 明确携带 typed TUF、manifest、publisher 与 artifact；Execution 没有等价结构。

最小反例：

```typescript
type MissingTrustObjects = ContractAssert<
  ContractIsNever<Extract<
    keyof ExecutionPluginPolicyReceipt<ExecutionThirdPartyCore>,
    "tufTargetAuthorization" | "signedManifest" | "publisherIdentity" | "adapterArtifact"
  >>
>;

type UnrelatedArtifactAccepted = ContractAssert<ContractIsAssignable<
  ReceiptRef<"receipt:unrelated-driver-artifact@99">,
  ExecutionActivationManifestBase["driverArtifact"]
>>;

type UnrelatedProvenanceAccepted = ContractAssert<ContractIsAssignable<
  ReceiptRef<"receipt:unrelated-driver-provenance@99">,
  ExecutionActivationManifestBase["driverProvenance"]
>>;
```

三条同时以 0 diagnostics 通过。照方案实现时，错误 producer 可以把不受当前 repository/role/target 授权的 driver artifact 或无关 provenance 换挂进 Activation；instance graph 只能看到不可解释的 string digest 或裸 `ReceiptRef`，无法离线重走 TUF lineage，也无法机械证明实际加载对象就是签名目标。该路径最终可进入 `commitExecutionPluginRuntimeAdmissionV6`（`19551-19563`），影响会执行工具和外部副作用的 Execution 平面，属于供应链与执行安全 A 级问题。

根因修复：

1. 把 inference 已有的 publisher、signed manifest、artifact 与 TUF target receipt 抽为 plane-neutral trust primitives，或为 Execution 定义同等强度的 typed 对象，不能仅复制 digest 字段。
2. 让 `ExecutionPluginPolicyReceipt<C>`、third-party implementation、activation closure、`ExecutionActivationManifestForImplementationV6<I>`、session admission 和 runtime admission 沿同一个 generic subject 逐级绑定这些对象。
3. 把 `driverArtifact`、`driverProvenance` 收窄为从同一 closure 投影出的精确类型，并绑定实际 verified open handle/content identity；producer 返回 deep-frozen committed receipt。

机械验收：

- 缺 TUF、缺中间 delegation、错 repository/role/target、过期/回滚 metadata、manifest 换 publisher、artifact 换 bytes、driver/provenance 跨 closure、Activation/session/runtime 跨 generation 均必须成为 `never` 或在 commit 前失败。
- 正例从 pinned root 到实际加载 open handle 全链可由 edge manifest/instance graph 离线遍历，且每条 same-value 边都由类型和运行时 verifier 双重证明。
- 将上面的三个反例加入 `plugin mutation gate`，其预期必须从“编译成功”翻为“编译失败”。

### A-2 authority registry 的 after-intent terminal 既无可构造 producer，又把逐 constituent 语义折叠成七个宽域

准确锚点：

- `AUTHORITY_LEASE_REQUIRED_KIND_POLICY_V3` 在 `949-1009` 给每种 lease 列出精确 authority kinds；测试账号 lease 单独要求 resource、budget、broker、credential/signing 与 exclusive cursor 五类 authority（`1008`）。
- 但 `AuthorityDomainTerminalPayloadV6` 在 `1298-1311` 只按七个 broad domain 给 terminal outcome。所有 `inference_transport_and_compute` constituent 共享 `not_sent | sent_succeeded | sent_failed | delivery_unknown_with_hold | compute_released`。
- `ExactAuthorityAfterIntentTerminalV6<K>` 在 `1348-1355` 只给这个宽 payload 加一个 constituent brand；`AuthorityLeaseRegistryEntryV6` 在 `1357-1375` 只保存 broad-domain producer ID，没有逐 constituent 的允许 outcome、权威 terminal 类型或 release policy。
- `commitRegisteredAfterIntentDomainTerminalV5` 在 `1495-1504` 接受该宽 terminal。全文对 `exactAuthorityRegistryTerminalBrandV6` 只有声明与字段两处引用，搜索不到任何返回 `ExactAuthorityAfterIntentTerminalV6` 的 producer 签名；因此所谓私有 producer 在合同内不可构造、不可审查。
- `31543`、`32340` 却要求每个 constituent 都有准确私有 producer 和逐 row mutation gate，当前形状与该验收目标不相容。

最小反例：

```typescript
type ProviderAccountTerminal = ExactAuthorityAfterIntentTerminalV6<
  "ProviderTestAccountAssetLeaseReceiptV6"
>["payload"];

type SentSucceededAccepted = ContractAssert<ContractIsAssignable<
  "sent_succeeded",
  ProviderAccountTerminal["outcome"]
>>;

type ComputeReleasedAccepted = ContractAssert<ContractIsAssignable<
  "compute_released",
  ProviderAccountTerminal["outcome"]
>>;
```

两条均以 0 diagnostics 通过。然而这两个 outcome 都没有证明测试账号的 credential/session/resource 清理、billing hold 对账、baseline reset，以及五类 authority 的精确释放。当前设计形成二选一失败：不使用断言时，合法 terminal 也没有合同内 producer 可构造；补一个通用 broad-domain producer 时，又会允许错误语义 terminal 关闭不相干 constituent。两条路都会破坏 restart sweep 的安全闭包，属于不可构造与 authority 丢失 A 级问题。

根因修复：

1. codegen 生成逐 constituent 的 action payload、terminal payload、允许 outcome、typed authoritative evidence 和 release mapping，而不是只给宽域 payload 加品牌。
2. 在合同中显式给出每个 registry row 的私有 producer map/签名；producer 输出必须是 deep-frozen committed receipt，并把准确业务 terminal 与 exact release set 作为输入。
3. 对 `ProviderTestAccountAssetLeaseReceiptV6`，after-intent terminal 必须消费同一 lease 的 provider cleanup terminal、billing/usage closure、credential/session revoke 与资源/baseline证据；网络发送或 compute release 不能替代它。

机械验收：

- compiler AST census 对 80 个 registry constituent 生成 80 个可构造 producer row，key set、source constructor、payload、terminal、release set 与 producer ID 全部双射。
- 每个 row 至少有一个正例；把任意其他 constituent 的 outcome、terminal、producer 或 release 换入都应在类型层成为 `never`。
- 禁止 `as`、裸 `ReceiptRef`、string digest 或 imported opaque leaf 充当 exact terminal；restart sweep 对缺一 terminal/release 的实例保持关闭。
- 将上面两个测试账号错误 outcome 作为固定负例，预期必须编译失败。

### A-3 测试账号 cleanup 在统一 authority closure 之前就重新发布 `available` cursor

准确锚点：

- 测试账号 lease 是统一 authority inventory 的成员，并持有五类 authority（`869`、`1008`、`23511-23537`）。
- `ProviderTestAccountAssetCursorReceiptV6` 的 `lastTransitionReceipt` 在 `23449-23463` 只是任意 `ReceiptRef`，没有要求前一 lease 的 exact terminal/release barrier。
- allocator `leaseProviderTestAccountAssetV6` 在 `23545-23556` 只要求 `AvailableProviderTestAccountCursorV6`。
- `cleanup_succeeded` 分支在 `23664-23674` 自己执行 `cleanup_in_flight -> available` CAS 并直接返回可再次租用的 cursor。
- `commitProviderTestAccountCleanupV6` 的输入在 `23703-23710` 没有 `PreIntentLeaseClosureReceipt`、`RegisteredAfterIntentDomainTerminalReceiptV5`、after-intent reconciliation terminal 或 exact authority release set。
- 正文 `32307` 与 gate `32362` 明确要求 cleanup 完成后、lease 释放前才可复用；当前类型顺序反了。

最小反例：

```typescript
type CleanupSuccess = Extract<
  ProviderTestAccountCleanupTerminalReceiptV6,
  { readonly outcome: "cleanup_succeeded" }
>;

type CanImmediatelyReLease = ContractAssert<ContractIsAssignable<
  CleanupSuccess["resultingCursor"],
  Parameters<typeof leaseProviderTestAccountAssetV6>[0]["availableCursor"]
>>;

type CleanupHasNoAuthorityClosure = ContractAssert<ContractIsNever<Extract<
  keyof CleanupSuccess,
  "preIntentClosure" | "registeredAfterIntentDomainTerminal" |
  "authorityAfterIntentReconciliationTerminal" | "authorityReleaseSet"
>>>;

type ArbitraryLastTransitionAccepted = ContractAssert<ContractIsAssignable<
  ReceiptRef<"receipt:unrelated-available-transition@99">,
  AvailableProviderTestAccountCursorV6["lastTransitionReceipt"]
>>;
```

三条均以 0 diagnostics 通过。最小事件序列为：lease A -> cleanup A 成功并发布 available cursor -> lease B 立即消费该 cursor；此时 lease A 的统一 after-intent terminal 和五类 authority release 仍可不存在。崩溃或并发下，B 会复用 A 尚未机械关闭的 broker handle、credential/signing authority、预算 hold 或账号资源，产生双租、重复费用或凭据交叉使用，属于权益、费用与 secret/resource authority A 级问题。

根因修复：

1. 把账号状态拆为 `cleanup_verified` 与 `available`；cleanup producer只能进入前者。
2. 新增原子 release barrier：消费同一 lease、同一 cleanup success、逐 constituent registered terminal/reconciliation 与 exact authority release set后，才 CAS 生成 `available`。
3. `leaseProviderTestAccountAssetV6` 对非 genesis cursor 必须要求这个精确 release barrier；`lastTransitionReceipt` 不再是裸 `ReceiptRef`。

机械验收：

- 在 cleanup evidence 落盘后、authority terminal 前和每个 release entry 前后注入 kill point，重启后新 lease 始终不可取得，直到完整 barrier 原子提交。
- 同一 available predecessor 的并发 sibling lease 只能一个成功；旧 lease 的全部五类 authority inventory 在新 lease 前必须显示 terminal 且 active count 为零。
- foreign cleanup、旧 generation、错 lease/run/asset、漏或重复 release、generic transition receipt、cleanup pending/quarantined 冒充 available 全部失败。
- 将 `CanImmediatelyReLease` 与 `ArbitraryLastTransitionAccepted` 反例加入 `provider-test-account-pool.model`，预期必须编译失败。

## 覆盖结论

| 审查面 | 结论 |
|---|---|
| Inference、Execution、bridge、control 两供给平面与四类 surface | 73 行分布及 exact oracle 键集机械闭合；第三方 Execution 信任闭包有 A-1。 |
| receipt candidate/commit、deep-readonly、JCS、producer DAG | JCS 与 deep-frozen骨架可编译；逐 constituent terminal producer/语义有 A-2。 |
| authority、cursor、restart、recovery | before-intent骨架与 sweep 形状已覆盖；after-intent逐 constituent 闭包仍被 A-2、A-3 阻断。 |
| provider账号池、flow/principal/MFA/admin set-cover、cleanup retry/CAS | 维度与 bounded set-cover形状存在；cleanup重试/quarantine可达；复用顺序有 A-3。 |
| 四槽与 `review_ready` | 四槽 typed qualification、solution member、Activation、terminal、evaluator/distribution绑定路径已检查，未发现独立 A/B。 |
| public support claim、row/oracle/qualification/distribution、四类产物 | 73 requirement 与 73 oracle 无重复且排序键集相同；claim到四类产物及 distribution closure形状未发现独立 A/B。 |
| rights/auth/funding/billing/data/network/TUF | 多维闭包和 fail-closed分支覆盖较完整；Execution TUF/trust对象缺失构成 A-1。 |
| Custom Base URL与三协议乘四种application auth乘两种mTLS状态 | safe relative path、显式base semantics与正交generic auth类型可达，Phase验收声明完整；未发现独立 A/B。 |
| Connector SDK、第三方 Execution、三平台helper/installer、remote witness | SDK/平台/production witness/installer/qualification均有明确结构与发布门；第三方 Execution 被 A-1 阻断。 |
| legacy JSON/SQLite迁移 | 当前 JSON v1生产形状已与 migration输入核对；lift/quarantine、dual-store repair/cutover/rollback验收未发现独立 A/B。 |
| strict零stub、readonly、构造性、编译预算 | 原合同 0 diagnostics、0 `any`、0 ignore；882412 < 900000，余量 17588。反例仍通过暴露三项构造性缺口。 |
| fail-fast、Phase与Definition Complete | 未施工能力没有被写成已交付；统一orchestrator与阶段门设计存在，但三项 A 使 Definition Complete不可满足。 |

## 收口复核

报告落盘后重新读取目标，冻结三元组未漂移：

```text
7fbc0a8ba767d90d84e26a49f83a357d57c5a269f1cf0c43b54c2e6a4d832967  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
   33210 2146263 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

报告单文件以及“目标加报告”两次 emoji 门均成功：

```text
[ok] emoji gate: clean
[ok] emoji gate: clean
emoji_report_rc=0
emoji_target_report_rc=0
```

## 最终判定

精确计数：`A=3, B=0, C=0`。

最终结论：`FAIL`。

三项 A 均有可编译最小反例，且分别落在 Execution 供应链、统一 authority recovery、测试账号凭据/费用/资源复用边界。它们不是“再补测试即可”的证据缺口；必须先修改合同形状与 producer ordering，再重新冻结并终审。
