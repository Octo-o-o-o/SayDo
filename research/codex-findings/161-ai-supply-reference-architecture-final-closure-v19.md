# AI 供给普适接入 v19 架构终审报告

## 结论

- 最终判定：`FAIL`
- A：8
- B：0
- C：1
- PASS 条件是 A=0 且 B=0；本轮不满足。

本轮不是因为计划尚未施工而判失败。8 个 A 级问题均来自冻结合同本身：它们分别导致 public receipt 图无法按声明生成、authority 主路径不可构造、精确 TUF 授权无法进入分发主路径、fallback 重试路径断裂、unknown-metering 权益可跨主体拼接、owner migration-only 被错误降为 fresh、release 可复用其他分发的成功证据，以及 972 格 a11y 闭包没有可类型化的生产者。

## 冻结身份

审查前独立核验结果：

| 项目 | 预期 | 实际 | 结果 |
|---|---:|---:|---|
| 目标 | `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md` | 同左 | `[ok]` |
| SHA-256 | `f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7` | `f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7` | `[ok]` |
| 行数 | 44,555 | 44,555 | `[ok]` |
| bytes | 2,797,930 | 2,797,930 | `[ok]` |
| HEAD | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` | `[ok]` |

我按行号顺序完整读取了目标的 1-44,555 行。除本轮 prompt、冻结目标和运行机械检查所需的当前 TypeScript/Node/shell 工具外，没有读取旧 prompt、旧 finding、日志、journal 或其他审查结论。

## 方法与命令摘要

使用的检查均只读冻结目标；只有本报告被写入。

1. 身份：`shasum -a 256`、`wc -l -c`、`git rev-parse HEAD`。
2. 完整阅读：按连续、不重叠行区间顺序读取全文件，并检查 fenced block 边界。
3. 精确抽取：用 `/```ts\n([\s\S]*?)```/g` 抽取全部 11 个 TypeScript block，以两个换行连接。得到 41,547 行、2,082,083 bytes。
4. 基础编译：TypeScript 5.9.3 Compiler API，`target=ES2023`、`module=NodeNext`、`moduleResolution=NodeNext`、`strict=true`、`exactOptionalPropertyTypes=true`、`noUncheckedIndexedAccess=true`、`skipLibCheck=true`、`types=[]`、`noEmit=true`。
5. 全量静态检查：Compiler API 遍历所有声明、call signature、属性、联合 constituent、mapped type、public ID、registry key、receipt root、authority source、requirements/oracle、release suite/BOM 和 runtime-child migration 表；AST 另查 writable property、`any`、重复 literal property 和尾随空白。
6. 对抗探针：把最小 type/value probe 追加到同一内存 source，重新建立严格 Program，读取真实 diagnostics 和 checker type；没有用 `as any`、`@ts-ignore` 或跳过检查的断言。
7. 性能：5 个隔离 cold Node process 各自重新抽取、建立 Program 并取 diagnostics/types/instantiations；外层 `/usr/bin/time -l` 取每进程 peak RSS，wall 取中位数、RSS 取最大值。

## 机械检查总览

### 基础合同与清单

| 检查 | 实际结果 |
|---|---:|
| TypeScript block | 11 |
| 抽取 source | 41,547 行；2,082,083 bytes |
| strict diagnostics | 0 |
| types | 428,676 |
| instantiations | 643,618 |
| property signatures | 23,286 |
| writable property signatures | 0 |
| `any` keyword | 0 |
| duplicate literal property | 0 |
| 尾随空白行 | 0 |
| public IDs | 55，全部唯一 |
| public callable | 54，全部顶层直接返回 `DeepFrozenCommittedReceiptV1<...>` |
| public registry binding | 1，穷举 19 个状态 |
| public graph roots | 53，全部唯一 |
| authority source | 76，全部唯一 |
| alias-only | 8 |
| concrete source | 68 |
| branch-dispatched source | 7 |
| branch-free source/policy | 61/61 |
| constituent policies | 28 |
| 展开 lifecycle constituents | 89 |
| requirements/exact oracle | 73/73，key set 相等 |
| release suites/BOM rows | 32/34 |
| a11y 笛卡尔格 | 972 |

public callable 的最外层返回、55 ID、19 状态、53 root、73/73、32/34 和 972 的数量声明本身都成立；finding 指向的是这些数量之下的可构造性和同主体绑定，而不是重复报数量错误。

### required-`never` 全量检查

对 1,995 个具名 interface/type 声明展开 6,960 个 constituent。初始命中 455 个必填 `never` property；排除 computed unique-symbol 私有品牌后，仍有且仅有 10 个非品牌命中：

- `AuthorityLeaseRegistryRowV6` 的五个 `ProviderCleanupPhysicalOperationLeaseV9#operationKind=...` constituent；
- 每个 constituent 的 `lifecycleDomain` 与 `afterIntentDomainTerminalProducerId` 各为 `never`；
- 五个 operation 是 `delete_provider_resources`、`revoke_provider_sessions`、`revoke_credential_versions`、`reconcile_billing_and_usage`、`reset_account_baseline`。

这 10 个命中均归入 A-02，没有把同一根因拆成多个 finding。

### runtime-child migration 完整性

该子系统的机械检查没有发现新增阻断项：

- 5 个状态、17 个 operation、17 个 kill point；
- transition table 对五个状态分别覆盖 2、4、3、7、3 个 operation；共有 18 个合法 state-operation pair；
- step table 与 prerequisite table 的 key set 均与 transition table 完全相等，所有 tuple 非空；
- operation x kill-point oracle 覆盖完整。

### 五进程性能

五次都使用同一抽取 source、TypeScript 5.9.3 和同一 options，均为 0 diagnostics、428,676 types、643,618 instantiations。

| run | wall ms | peak RSS bytes |
|---:|---:|---:|
| 1 | 2,560.395209 | 758,513,664 |
| 2 | 2,667.569667 | 754,450,432 |
| 3 | 2,851.972166 | 711,753,728 |
| 4 | 2,645.070667 | 761,937,920 |
| 5 | 2,751.376167 | 757,530,624 |

- wall 中位数：2,667.569667 ms；绝对门 60,000 ms，通过。
- peak RSS 最大值：761,937,920 bytes；绝对门 2,684,354,560 bytes，通过。
- wall spread：109.30 permille；噪声门 200 permille，通过。
- instantiations：643,618；绝对门 900,000，通过。
- source：2,082,083 bytes 和 41,547 行；分别低于 4,194,304 bytes 和 80,000 行，且 source bytes/lines 剩余容量均超过 300 permille。
- 冻结目标未提供可独立验真的具体签名 baseline 值，因此本轮不把“尚未施工 baseline”计为缺陷，也不虚报相对门通过；当前自检数字漂移单列 C-01。

## Findings

### A-01 public receipt graph 含不可恢复 kind 的 bare `ReceiptRef`

严重度：A。会使 public typed edge manifest 的声明算法无法从冻结合同生成；如果实现忽略该错误继续生成，则 JCS/deserialize/DAG/runtime verifier 会遗漏真实边。

准确位置：

- `ReceiptRef` 的 `K` 默认值是宽模板：305-324。
- `LeaseAuthorityInventoryReceipt` 与 `AuthorityInventoryBearingLease` 直接 `extends ReceiptRef`：676-700。
- `CanonicalContractArtifactReceiptV3` 直接 `extends ReceiptRef`：1025-1032。
- `AuthorityLeaseRegistryGeneratedArtifactReceiptV6` 直接 `extends ReceiptRef`：1740-1755。
- public compilation 以 bare canonical artifact 为输入：40972-40995。
- manifest 声称 `bareReceiptRefWithDefaultKindCount: 0`，并要求无法恢复准确 kind 时失败：41075-41104。
- public physical binding 的 `exactDomainLease` 是 bare `AuthorityInventoryBearingLease`：41111-41133；其生产者又把 bare registry artifact 放入 public 输入 tuple：41135-41146。

最小复现的 checker 输出为：

```text
CanonicalContractArtifactReceiptV3["receiptKind"] = `receipt:${string}@${number}`
AuthorityLeaseRegistryGeneratedArtifactReceiptV6["receiptKind"] = `receipt:${string}@${number}`
diagnostics = 0
```

这不是单纯命名不够具体。manifest 的合同明确要求从 resolved target type symbol 恢复准确 target kind，并在不能恢复时失败；上述 public 可达边只能得到宽模板。于是实现只有两个选择：按合同失败，导致主发布图不可构造；或者猜 kind/跳过边，违反同源 manifest 与 runtime verifier 的安全承诺。

最小根因修复：

1. 为所有 public 图可达 receipt 声明准确 `ReceiptRef<literalKind, exactSubject>`；尤其是 canonical artifact、registry artifact、inventory 和 public domain lease。
2. 若 authority 基类必须复用，给基类增加 kind/subject 参数并由每个 concrete lease 精确传递，或在 public 边使用具名、精确、已验证 wrapper；不能把该边标成普通 bare ref。
3. public graph census 必须以 checker 实际解析结果拒绝所有宽模板 kind，并加入 canonical artifact、registry artifact、domain lease 三个 mutation。

### A-02 cleanup authority 的五个 constituent 没有 lifecycle domain，registry 行必填 `never`

严重度：A。cleanup 物理 operation 无法获得 after-intent domain terminal producer，五条清理主路径的 registry row 在类型上不可构造。

准确位置：

- `ProviderCleanupPhysicalOperationLeaseV9` 是 76 source 清单成员：981。
- 它被列为 branch-dispatched source：1018。
- 五个 operation constituent policy 位于 1298-1333。
- lifecycle group 的 `provider_test_account_cleanup` 只列出 `ProviderTestAccountAssetLeaseReceiptV6`，未列 physical operation lease：1362-1448，尤其 1421-1423。
- `AuthorityLifecycleDomainForSourceV6` 完全由该分组映射：1456-1462。
- registry row 强制包含 `lifecycleDomain` 与由其计算的 `afterIntentDomainTerminalProducerId`：1702-1718。

最小反例：

```ts
type CleanupDomain = AuthorityLifecycleDomainForSourceV6<
  "ProviderCleanupPhysicalOperationLeaseV9"
>;
// checker: never
```

全量 constituent 扫描进一步确认：五个 cleanup operation 的 `lifecycleDomain` 和 `afterIntentDomainTerminalProducerId` 共 10 个非品牌必填 `never`，没有其他非品牌 required-`never` 命中。

最小根因修复：把 `ProviderCleanupPhysicalOperationLeaseV9` 加入 `provider_test_account_cleanup` lifecycle group，并增加编译期双向集合断言：所有 concrete source 必须恰好出现于一个 lifecycle group，所有 group source 也必须属于 concrete source。随后重新生成 registry 并让五个 cleanup operation mutation 实际构造完整 lease/action/terminal/release tuple。

### A-03 精确 TUF target authorization 无法进入 distribution producer

严重度：A。分发主路径要么不能接收 TUF verifier 的准确输出，要么必须先做宽化/断言；同时 repository、最终 role 和 target path 在 release consumer 处被擦除，不能证明 distribution 与准确 catalog target 同一主体。

准确位置：

- TUF 高水位与 target authorization 的准确泛型核心位于 8588-8701，producer 位于 8703-8724。
- `DistributionArtifactIdentityReceiptV19.tufTargetAuthorization` 使用无参数宽类型，producer 输入也相同：41585-41611。
- `commitReferenceGradeTrustRootsV19` 接受三个同样宽化的 authorization：41613-41644。

最小 checker 探针：

```text
Distribution input repositoryKind = TufRepositoryKindV3
Distribution input finalRoleName = TufTargetRoleNameV10
Distribution input targetPath = string
TufTargetAuthorizationReceipt<
  TufRepositoryIdentityReceipt<"catalog">,
  "delegated:release",
  "distributions/saydo.bin"
> extends distribution input = false
diagnostics = 0
```

核心 TUF 模型的 root rotation、timestamp/snapshot/targets、delegation lineage、可信时间和逐 role high-water 结构本身是充分展开的；缺陷发生在 distribution public consumer：由于精确类型对宽默认实例并不可赋值，正确 verifier 输出不能无损传入。即使通过不安全断言宽化，三个 trust-root target 也没有各自准确 repository/role/path 的类型约束。

最小根因修复：

1. 让 `DistributionArtifactIdentityReceiptV19` 和 producer 参数化准确 repository、role、path、lineage，并把 TUF `targetDigest`/`targetLength` 与 distribution bytes/digest 建立同一泛型或精确 refinement。
2. 首发 distribution 明确要求 catalog repository、固定 delegated release role 和固定 target path namespace。
3. trust roots 的三个 authorization 使用三个具名准确 target path，而不是三个宽 `TufTargetAuthorizationReceipt`。
4. 增加 exact verifier output 正例，以及跨 repository、跨 role、跨 path、跨 digest 四类编译失败反例。

### A-04 fallback 的 before-send retry terminal 被非分布式条件消失，advance 又丢失 DAG 历史

严重度：A。正常的零字节、无 send-intent 失败无法进入 fallback advance/final 主路径；可进入的 advance 又返回不记录前一 attempt 的 ready cursor，无法形成声明的可遍历单链 DAG。

准确位置：

- `PhysicalAttemptSubjectV19` 默认 `State` 是 `before_send | after_send_intent`，且 `fallbackAttemptStart` 只保留 kind、丢失准确 subject：41148-41184。
- `ExactPhysicalAttemptTerminalV19` 使用非分布式 `S["sendState"] extends "before_send"`：41186-41208。
- ready cursor 明确禁止 `predecessorTerminal`：41256-41267。
- `commitFallbackAdvanceV19` 与 final input 都把 terminal 实例化为默认联合 state 的 `PhysicalAttemptSubjectV19`：41303-41328。

最小反例的 checker 结果：

```text
Extract<
  ExactPhysicalAttemptTerminalV19<
    PhysicalAttemptSubjectV19<"runtime_inference", "dist-x"> & {
      fallbackAttemptStart: ReceiptRef<"receipt:fallback-attempt-start@19">
    }
  >,
  { outcome: "failed_before_send" }
> = never
```

同时，public `commitPhysicalAttemptSubjectV19` 返回值中的 fallback-start canonical subject 是 `unknown`。因此先前准确 `FallbackAttemptStartCommitV19<S>` 也无法从 physical subject 的公开返回类型恢复。`commitFallbackAdvanceV19` 的返回只是 ready cursor，而 ready 分支把 predecessor terminal 设为 `never`，所以第 N 次尝试到第 N+1 次 cursor 的已提交历史没有进入返回 receipt 图。

最小根因修复：

1. 让 terminal 条件对 state 显式分布，或把 state 作为独立泛型并在 advance/final 明确使用 `before_send`/`after_send_intent` 分支。
2. `PhysicalAttemptSubjectV19` 参数化准确 fallback start，producer 保留 `FallbackAttemptStartCommitV19<S>`，禁止 canonical subject 退化为 `unknown`。
3. 增加 `FallbackAdvanceCommitV19`，同时保留 predecessor cursor、attempt start、physical terminal、successor cursor 和 CAS 证据；区分 genesis-ready 与 advanced-ready。
4. 增加 before-send failure 后 advance、before-send final、after-send authoritative-not-committed、delivery-unknown 不得 retry，以及两次 advance 不得共用 predecessor 的正反例。

### A-05 custom/official unknown-metering 的 Rights 与 compute binding 可跨主体拼接

严重度：A。私有 custom attestation 可以进入普通 `AllowedRightsReceipt`，而 unknown-metering closure 又把无参数 compute binding 与另一份 custom/official rights 并列，允许 A 主体的 policy binding 与 B 主体的 rights/endpoint 拼装为一个 funding closure。

准确位置：

- `ProductEligibilityReceipt` 的 custom 分支同样是 `permitsCredentialInput: true`：5766-5792。
- `AllowedRightsReceipt` 只按 decision status 选 `allowed|official_surface_only`；`commitAllowedRightsV8` 接受所有 `permitsCredentialInput: true` eligibility：5859-5877。
- dedicated custom rights 明确 `explicitlyNotOfficial: true`：6117-6137。
- runtime rights grant 固定包含 `AllowedRightsReceipt<S>`：13172-13222。
- `ComputePolicyBindingReceipt` 继承该 runtime grant：13312-13321。
- `ExternallyMeteredOperationClosureReceipt` 使用无参数 `ComputePolicyBindingReceipt`，另放一份不相关的 custom/official rights：14204-14233。
- v19 exact compute binding仍只接受 `AllowedRightsReceipt`：41405-41426。

机械反例：

```text
Extract<AllowedRightsReceipt["productEligibility"],
        { status: "user_or_admin_attested_custom" }> = non-never
diagnostics = 0
```

值级 probe 进一步声明一个普通 `ComputePolicyBindingReceipt` 和另一主体的 `UserAdminAttestedCustomRightsReceipt`，把两者赋给 custom closure 对应字段的 `Pick`；strict 编译为 0 diagnostics。全源 symbol census 中，`ExternallyMeteredOperationClosureReceipt` 只有类型定义和 consumer 引用，没有任何声明的 producer 返回该 closure。

这与冻结正文“custom 不把 unknown 改写为 allowed，custom 与 official unknown 不共享 rights attestation”的规则直接冲突。

最小根因修复：

1. `commitAllowedRightsV8` 只接受 `status: "eligible"`；custom eligibility 只能进入 exact `UserAdminAttestedCustomRightsReceipt` producer。
2. 把 runtime policy binding 改为按 `priced_official | unknown_custom | unknown_official` 判别的准确联合，每个分支参数化同一个 exact subject、endpoint、principal、resource、route 和 distribution。
3. 声明 unknown closure 的 mandatory producer，使用 `NoInfer` 绑定同一 subject，并由组件集合 equality 证明 billing/rights/network/data boundary 全部同主体。
4. 添加 custom-vs-official、A-vs-B endpoint/principal/distribution 换挂和 custom rights 进入 `AllowedRightsReceipt` 的编译失败反例。

### A-06 owner migration-only 输入被编译成 fresh onboarding 和 remote-provider live mode，v19 四子 qualification 没进入 claim

严重度：A。owner 明确提交 migration-only requirement 后，编译合同仍生成 fresh onboarding 和普通 remote-provider 两周期资格；公开 owner claim 继续消费旧 qualification，因此可绕过 migration positive/absence 证据。

准确位置：

- live dependency 只有固定 key `hunyuan.cn` 才归类 migration：33712-33727。
- onboarding availability 也只检查固定 key `hunyuan.cn`：33859-33863。
- owner input 明确允许 `ownerOnboardingAvailability: "existing_connection_migration_only"`：36346-36361。
- `OwnerAdditionalRequirementV4` 的派生字段没有消费 `ownerOnboardingAvailability`：36397-36428。
- 发布 qualification 和 owner claim 继续使用 V7/V6 的 journey/live/funding/mutation 类型：38751-38837。
- 新增 v19 四子 component/qualification 只在 41452-41508 自身定义和自身 producer 中出现，没有被 owner claim 或 release consumer 引用。

严格 checker 对合法 owner migration input 的输出：

```text
RequestedAvailability = "existing_connection_migration_only"
DerivedOnboardingAvailability = "fresh_onboarding_default"
DerivedLiveMode = "required_remote_provider"
LegacyModeEvidence = "required_remote_provider"
diagnostics = 0
```

这是实际的错误派生，不是“未来实现尚未完成”。同一输入会显示 fresh picker，并接受普通 remote-provider 两周期 evidence，而不是 existing-connection migration positive 加 no-existing-connection absence gate。新 v19 `live_or_migration` 子资格无法修复此问题，因为 downstream claim 根本不消费它。

最小根因修复：

1. owner onboarding availability 的派生必须读取受信 compiler 输入中的 `ownerOnboardingAvailability`，并与 onboarding recipe 一致；固定行仍使用固定 key 规则。
2. `ReferenceLiveDependencyClassForRequirementV7`/owner 专用派生必须把 owner migration-only 映射到 `remote_existing_connection_migration`。
3. owner release qualification 与 `PublishedOwnerProductProtocolClaimV6` 改为消费 `OwnerRequirementQualificationReceiptV19<R,D>` 或等价的准确四子 component set，删除并行旧入口。
4. 添加 owner fresh 正例、owner migration positive 正例、owner migration absence 正例，以及 migration input 被映射为 fresh/remote-provider 的编译失败反例。

### A-07 suite terminal 不绑定 BOM/distribution，release compile/manifest gate 也可跨 distribution 复用

严重度：A。一次 distribution A 的成功 suite terminal tuple 和 compile/manifest 证据可以用于 distribution B 的成功 orchestrator/release binding，形成发布假阳性。

准确位置：

- 32 suite 递归展开 34 行 BOM 的形状位于 42128-42215，数量正确。
- step terminal subject 只有 row `R`，没有 signed BOM 或 distribution：42224-42275。
- 三个 step producer 只接收 row、spawn evidence 和 predecessor：42277-42302。
- successful orchestrator 在外层才加入 `B,D`，但接收的 tuple 元素仍只绑定 row：42304-42322、42351-42358。
- release binding 中 type compile gate、edge manifest、public compilation、a11y matrix 和 MFA derivation均未参数化 `D`；orchestrator 的 BOM 参数又退化为宽 `AiSupplySignedExpectedBomReceiptV19`：42360-42405。

值级反例把同一个 `probePassedSteps` 分别传给 `commitAiSupplySuccessfulOrchestratorTerminalV19` 的 `dist-a` 与 `dist-b` 调用，strict diagnostics 为 0。另两个类型探针得到：

```text
ReleaseEcosystemBindingV19<"dist-a">["typeContractCompileGate"]
  extends ReleaseEcosystemBindingV19<"dist-b">["typeContractCompileGate"] = true

ReleaseEcosystemBindingV19<"dist-a">["receiptEdgeManifest"]
  extends ReleaseEcosystemBindingV19<"dist-b">["receiptEdgeManifest"] = true
```

因此准确 argv/predecessor DAG 虽能验证顺序，却没有证明这些进程测试的是哪一份 BOM bytes 和哪一个 distribution artifact；外层加上 `D` 不能追溯性地修补已经无主体的 terminal。

最小根因修复：

1. step terminal subject 改为 `readonly [B,D,R]`，每个 producer 输入都要求准确 signed BOM、distribution identity、被测 artifact digest 和 runner/environment identity。
2. predecessor terminal 必须精确保持相同 `B,D`，而不只是相同 predecessor row。
3. type compile gate、receipt edge manifest、public compilation、a11y required matrix 和 MFA derivation等 release-critical receipt 参数化当前 distribution 与准确 source/public artifact digest。
4. `ReleaseEcosystemBindingV19` 保留 exact `B`，不能退回宽 BOM interface；增加同 tuple 跨 B、跨 D、跨 artifact digest 复用的编译失败反例。

### A-08 972 个 passed cell 没有能产生准确 `K,D` refinement 的 typed producer

严重度：A。a11y release closure 要求 972 个精确 key、精确 distribution 的 pass receipt，但唯一 pass snapshot producer 丢失这两个 literal；主发布路径只能靠调用方结构性自填字段或断言。

准确位置：

- base snapshot 中 distribution、平台、locale、viewport 等都是宽字段：36900-36947。
- `GaAccessibilityPassSnapshotReceiptV9` 与唯一 pass producer 位于 36949-36976；producer 非泛型，返回值没有 `exactRequiredCellKey`，distribution 仍为 `string`。
- v19 的 972-key 联合及 required map 位于 41665-41702。
- passed map 强制每个值同时具有准确 `testedDistributionArtifactDigest: D` 与 `exactRequiredCellKey: K`：41712-41730。
- closure producer直接要求调用方提供整张 refined map：41733-41740。

最小探针：

```text
ReturnType<typeof commitGaAccessibilityPassSnapshotV9>
  extends GaAccessibilityExactPassedCellMapV19<"dist-x">[
    GaAccessibilityRequiredCellKeyV19
  ] = false
diagnostics = 0
```

全源 producer census 没有另一个函数把 pass snapshot 提升为准确 `K,D`。`deterministicExactKeyedCartesianEvaluator` 是 opaque evidence，却在调用者已经交入完整 map 后才出现，不能充当 mandatory producer。结构性 spread 自填 `exactRequiredCellKey` 会绕过“key 必须由实际 platform/locale/presentation/viewport/zoom/modality/screen-reader 字段计算”的要求。

最小根因修复：

1. 增加 `GaAccessibilityPassSnapshotReceiptV19<K,D>`，其 axis 字段从 `K` 投影，distribution 从 `D` 投影；producer 输入必须含 exact distribution identity 和 required-cell receipt。
2. 或增加具名、带私有 brand 的 refinement producer，由实际 snapshot axes 计算 `K`，验证与 required cell 相等后提交。
3. exact passed map 只接受这些 producer 的输出，并增加错 key、错 distribution、平台与 screen reader 错配、pseudo locale 缺失、重复 cell 的编译/运行失败反例。

### C-01 冻结尾注中的精确 Compiler API 数字已漂移，当前自检证据不可复现

严重度：C。当前绝对性能门仍通过，不单独阻断发布；但冻结文档声称的精确自检数字与同一目标、同一版本和同一严格配置的五次稳定结果不同。

准确位置：性能协议与预算为 27051-27246；冻结尾注在 44553 声称 `427,189 types`、`639,671 instantiations`。本轮五个 cold process 均稳定得到 `428,676 types`、`643,618 instantiations`，没有一次得到尾注数字。

最小根因修复：把方案自检的 extraction algorithm、完整 compiler options、lib 解析、package lock digest 和实际 argv 固化为可重放 artifact，再由该 artifact生成数字；在无法复现前不要把一次旧输出写成“最终机械读回”。未来 signed baseline 仍须按正文协议由 TUF target 和 owner-approved replacement producer提交。本轮没有把尚未存在的施工期 baseline 当作缺陷。

## 十项终审覆盖结论

| prompt 项 | 结论 | 证据摘要 |
|---:|---|---|
| 1 | `[fail]` | 55/54/19/53 数量成立；bare receipt 使 edge manifest 主路径不成立，见 A-01。 |
| 2 | `[fail]` | 76/8/61/28/89 数量成立；五个 cleanup constituent 无 lifecycle domain，见 A-02。其余 authority policy 未发现第二个非品牌 required-`never`。 |
| 3 | `[fail]` | TUF 核心 rotation/high-water/time 结构充分；distribution consumer 擦除并拒绝准确 repo/role/path，见 A-03。 |
| 4 | `[fail]` | physical before/after/unknown 基础联合存在；fallback before-send retry 与 DAG 历史断裂，见 A-04。 |
| 5 | `[fail]` | review-ready 四槽与大部分 rights/billing/network/data-boundary 结构存在；unknown-metering 可跨主体拼接，见 A-05。 |
| 6 | `[fail]` | Execution/plugin/external identity 与 5-state/17-operation/17-kill-point migration 检查未见新增阻断；cleanup authority 主路径仍因 A-02 失败。 |
| 7 | `[fail]` | 73/73 exact key set 成立；owner migration 与 claim qualification 旁路，见 A-06。 |
| 8 | `[fail]` | 32 suite/34 BOM 成立；terminal 未绑定 B/D，release 可跨主体复用，见 A-07。 |
| 9 | `[fail]` | 非联合 D 的外层检查、platform/observer/Codex/MFA 类型存在；release gate 未全绑定 D，a11y producer 悬空，见 A-07、A-08。 |
| 10 | `[fail]` | 基础 strict 0 diagnostics、绝对性能门通过；全量 checker 发现 10 个非品牌 required-`never`、非分布式 fallback、宽 ref、联合/结构性换挂及悬空 producer，见 A-01 至 A-08；数字漂移见 C-01。 |

## 最终计数

- A：8
- B：0
- C：1
- 最终判定：`FAIL`

在 A-01 至 A-08 修复并以同一冻结目标重新运行全量 Compiler API、正反例、五进程性能和 runtime manifest/BOM mutation 之前，不能把本方案判为可机械验收的发布闭包。
