# AI 供给普适接入 v18 架构终审报告

## 结论

`FAIL`

- A：5
- B：0
- C：0

基础 TypeScript 编译为零 diagnostics，但五个 A 级问题分别导致安全边界未闭合、authority census 不完整、TUF 回滚防线不完整，或发布门无法构造/未被发布绑定消费。按本轮规则，A 不为零，因此不能给出 `PASS`。

## 冻结身份与隔离

审查目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

| 项目 | 预期 | 首次实测 | 写报告后复核 |
|---|---:|---:|---:|
| SHA-256 | `c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0` | `c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0` | `c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0` |
| 行数 | 42,437 | 42,437 | 42,437 |
| bytes | 2,672,219 | 2,672,219 | 2,672,219 |
| 仓库 HEAD | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` |

隔离纪律：只打开了本轮 prompt、冻结目标、必要的门禁脚本和当前官方协议文档；未打开任何旧 prompt、旧 finding、`history/`、日志或其他 agent 输出。冻结目标内部自带的历史段落属于本次目标字节，只作为待审内容，不把其中自述的审查结论当成证据。未修改冻结目标。

## 实际方法与命令摘要

### 身份与完整读取

```sh
shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
git rev-parse HEAD
```

首检与写报告后复检均得到上表中的相同值。目标的 11 个 `ts` 代码块全部由程序抽取、解析并进入同一个 TypeScript `Program`；正文按章节和安全性质交叉检索、逐段复核。

### TypeScript 与 Compiler API 门

用本机 TypeScript 5.9.3，将 11 个代码块按目标声明的抽取口径连接为单一合同源，运行：

- `target=ES2023`
- `module=NodeNext`
- `moduleResolution=NodeNext`
- `strict=true`
- `exactOptionalPropertyTypes=true`
- `noUncheckedIndexedAccess=true`
- `useUnknownInCatchVariables=true`
- `skipLibCheck=true`
- `noEmit=true`

实测：

| 指标 | 结果 |
|---|---:|
| 代码块 | 11 |
| 合同源 logical lines | 39,475 |
| 合同源 bytes | 1,978,244 |
| syntactic diagnostics | 0 |
| semantic diagnostics | 0 |
| options diagnostics | 0 |
| types | 418,145 |
| instantiations | 630,250 |
| 本次 wall | 2,919.33 ms |

另以 `skipLibCheck=false` 重跑，仍为 0 diagnostics；types 为 434,352，instantiations 为 634,968。

Compiler API 全量 AST 审计得到：

| 检查 | 结果 |
|---|---:|
| property signature | 22,362 |
| 可写 property | 0 |
| `any` keyword | 0 |
| 必填直接 `never` | 183 |
| 其中 computed private brand | 183 |
| 非 brand 必填直接 `never` | 0 |
| 同一 literal 内重复 property | 0 |
| property 上的裸 `ReceiptRef` | 259 |
| function declaration | 221 |
| 返回 receipt 形状的 function | 203 |
| 返回值带 deep-frozen brand | 176 |
| 返回值不带 deep-frozen brand | 27 |

基础编译的零 diagnostics 只能证明声明集合自洽，不能证明主路径可构造、producer/consumer 连接完备或运行时安全性质成立。下面的最小反例均把测试追加到同一完整合同源后独立编译，未修改目标文件。

### 生态与官方协议核对

Compiler API 从 `REFERENCE_REQUIREMENTS_V3` 和 `REFERENCE_EXACT_CONNECTION_ORACLE_V6` 展开得到：

- requirements：73，唯一键 73；
- exact oracle：73，唯一键 73；
- 两者缺失/额外键均为 0；
- surface 分布：63 inference、5 execution、4 bridge、1 control plane。

对关键易漂移协议点抽查了当前官方资料：AWS Bedrock Converse/API key、Google Gemini、Azure OpenAI Responses、BytePlus ModelArk、Tencent TokenHub、LM Studio Anthropic compatibility 和 OpenCode Server。抽查项与目标中的 method/path/auth 口径一致，未据此新增 finding。相关官方入口：

- [AWS Bedrock API keys](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html)
- [AWS ConverseStream](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html)
- [Google Gemini API](https://ai.google.dev/api)
- [Azure OpenAI Responses](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses)
- [BytePlus ModelArk Responses](https://docs.byteplus.com/api/docs/ModelArk/1958523)
- [Tencent TokenHub](https://cloud.tencent.com/document/product/1823/130079)
- [LM Studio Anthropic compatibility](https://lmstudio.ai/docs/developer/anthropic-compat)
- [OpenCode Server](https://dev.opencode.ai/docs/server/)

## A 级 findings

### A1. receipt 的 public/deep-frozen/JCS 边界与自身零计数声明矛盾

目标在 537–544 行声明 `exportedCommitProducerReturningUnfrozenShapeCount: 0`，并要求每个 public producer 返回 `DeepFrozenCommittedReceiptV1`；Phase 0 在 40,653 行再次要求所有持久化/authority 输入只接受同一 deep-frozen 类型。但实际完整函数 census 中，203 个 receipt-returning declaration 有 27 个返回值没有 deep-frozen brand。

安全关键例子包括：

- 754 行 `commitLeaseAuthorityInventoryV3` 返回裸 `LeaseAuthorityInventoryReceipt<E>`；
- 762 行 `closeLeaseAuthoritiesExactlyOnceV3` 返回裸 `PreIntentLeaseClosureReceipt<L>`；
- 1,899 行 `commitAuthorityLeaseRestartRecoverySweepV4` 返回裸 restart sweep receipt；
- 6,585、6,637、6,685 行的 remote witness qualification/release/service producer 返回裸 receipt；
- 8,408 行 `verifyAndCommitTufRootRotationLineageV3` 返回裸 TUF root lineage；
- 16,716 行 `commitSupplySlotFundingAdmissionV1` 返回裸 funding admission；
- execution session/reconciliation、runtime child migration、GA runtime/release evidence 还有同类返回值。

最小类型反例对 `commitLeaseAuthorityInventoryV3` 与 `verifyAndCommitTufRootRotationLineageV3` 的 `ReturnType` 分别断言必须 extends `DeepFrozenCommittedReceiptV1<ReceiptRef>`，实测得到 2 个 `TS2344: Type 'false' does not satisfy the constraint 'true'`。

JCS 泛型边界还把 `canonicalBody` 约束为 `B extends object`（336–375 行），而 `DeepReadonlyV1` 对 host object 只会保留其方法。最小反例证明 `"setTime" extends keyof DeepReadonlyV1<Date>` 为真；运行时 `Object.freeze(new Date(...))` 后调用 `setUTCFullYear`，`Object.isFrozen` 仍为真，但 `JSON.stringify({canonicalBody: date})` 从 `2025-01-01` 变成 `2026-01-01`。当前 profile 的显式拒绝集合列出 Map/Set/TypedArray 等，却没有用 `CanonicalJsonValue` 和 plain-object/no-accessor/no-`toJSON` 约束关闭该类 host-language alias。

影响：authority inventory、TUF root、remote witness、Execution/runtime recovery 与 release evidence 可以在静态合同中绕过目标宣称的 deep-frozen brand；浅冻结的 host object 还可在哈希后改变可序列化值。这会让 Phase 0 的 public-boundary 零计数门必然与当前合同冲突，属于安全与可实施性阻断。

必须修复：以封闭 `CanonicalJsonValue` 约束 schema body，运行时拒绝非 plain prototype、accessor、函数、symbol、BigInt、`toJSON` 和带可变 internal slot 的对象；所有受信 producer、消息/持久化/authority consumer 的类型都必须携带同一个 deep-frozen brand。Compiler API 门应从实际 export/consumer 图生成清单，并给上述 27 个签名逐项正向 fixture。

### A2. typed edge manifest 没有可生成的精确真相，259 个裸边仍允许跨 kind 换挂

`ReceiptEdgeManifestV1` 只在 1,948 行定义一次；完整 AST 中该标识符引用数为 1，没有实际 manifest 值、签名 producer 或消费路径。与此同时，property signature 中有 259 个零 type argument 的裸 `ReceiptRef`。例如 1,977–1,978 行 `TransportMtlsIdentityPolicyReceipt.credentialEgressDecision` 和 `brokerAcl` 都只是 `ReceiptRef`。

最小反例断言无关的 `ReceiptRef<"receipt:unrelated@1">` 不应能赋给 `credentialEgressDecision`。实测得到 `TS2344: Type 'true' does not satisfy the constraint 'false'`，即无关 receipt 在当前类型合同中可换挂。

正文要求 schema 自动生成 owner kind、JSON Pointer、非空 target kind、ordering、same-value path 与 single-successor authority，并要求任何未登记裸 ref 使 Phase 0 非零。但当前 schema 对上述 259 个字段没有携带 target kind 元数据，目标中也没有第二个可签名、可与 schema 字节一一对应的 manifest 真相；因此 generator 无法从现有类型恢复丢失的精确 target kind。仅靠以后手写一个 manifest 会制造第二真相源。

影响：credential egress、broker ACL、policy、cursor、evidence 等边可跨 kind 换挂；DAG/ordering verifier 无法从冻结合同建立完整字段图。该问题会让承诺的 `provesNoWildcardOrUnregisteredBareRef` 和 Phase 0 mutation gate 无法同时对当前合同为真。

必须修复：每个 receipt edge 在 canonical schema 中直接携带精确 target kind/subject 类型或生成器可读取的唯一元数据；提交随 schema 签名的实际 manifest 常量和私有 producer，并让 receipt commit、反序列化、实例 DAG verifier 与 release gate消费同一个 manifest digest。删除所有无法由 opaque-leaf 规则解释的裸 `ReceiptRef`。

### A3. authority registry 无法表示自身预期集合，并漏掉 provider cleanup 的真实 effect lease

机械展开得到 74 个 `AuthorityLeaseTypeNameV3`、66 个 concrete type、60 个 branch-free concrete type，以及 83 个 `AuthorityLifecycleConstituentKeyV6`。但 registry/census 的 `sourceTypeName` 在 799 和 1,014 行被固定为 ```${string}LeaseReceipt```。

74 个预期名字中有 3 个不能被该模板表示：

- `ProviderTestAccountAssetLeaseReceiptV6`
- `RuntimeChildRegistryMigrationOperationLeaseV7`
- `RuntimeChildRegistryMigrationRecoveryLeaseV7`

类型断言让第一个名字必须匹配 registry 模板，得到 `TS2344: Type 'false' does not satisfy the constraint 'true'`。因此 V3 conformance/census 形状无法表达它声称要逐名对账的完整 expected set。

更严重的是，28,461 行的 `ProviderCleanupPhysicalOperationLeaseV9` 明确 extends `AuthorityInventoryBearingLease<[network_admission, external_effect, budget_reservation]>`，却不在 `AUTHORITY_LEASE_EXPECTED_TYPE_NAMES_V3`、branch/required-kind policy、lifecycle source map 或 83 constituent 中。AST 以“直接引用 `AuthorityInventoryBearingLease` 的声明集合”对比 expected set时，该类型是唯一非 helper 的漏项。断言它必须属于 `AuthorityLeaseTypeNameV3`同样得到 `TS2344 false`。

影响：provider 测试账号的 DELETE/revoke/reconcile/reset 物理 cleanup 拥有网络、副作用和预算 authority，却没有 registry row、before-intent closure、after-intent terminal 与 restart recovery 的全局一一映射。要么正确 census 会使当前 gate 永久失败，要么实现按 expected list 运行而漏掉该 lease，允许 release barrier 在 cleanup authority 未闭合时出现假阳性。

必须修复：registry source name 改为从真实声明 symbol 派生、能表示 versioned 名字的精确联合；把 `ProviderCleanupPhysicalOperationLeaseV9` 的五个 operation constituent加入 census、required-kind policy、lifecycle source/terminal/recovery map，并重新生成显式 registry。正反例必须覆盖 cleanup lease 的 pre-intent、after-send unknown、reconciliation 和 release barrier。

### A4. TUF target authorization 允许非 target role，并没有逐中间 delegated role 的高水位推进

8,276 行的 `TufRoleNameV2` 包含 `root | timestamp | snapshot | targets | delegated:*`。8,449 行的 `TufNonRootRoleHighWatermarkAdvanceReceiptV9<R,N>` 和 8,529 行的 `verifyAndCommitTufTargetAuthorizationV2` 都让 `N extends TufRoleNameV2`，没有把 target 的 final role收窄为 `targets | delegated:*`，也没有把 `N` 等同于 `delegationLineage.finalRoleMetadata.roleName`。

最小反例实例化 `TufTargetAuthorizationReceipt<catalog-repo,"root","catalog/x">`，并断言 `root` 不应成为 `finalRoleName`；实测得到 `TS2344: Type 'true' does not satisfy the constraint 'false'`。也就是说，当前 producer 类型允许调用者请求一个以 root 为“最终 target role”的 authorization。

同时，`TufDelegationLineageReceipt` 可以携带任意长度的 `orderedSteps`，但 8,449–8,468 行的 high-water advance 只显式保存 timestamp、snapshot、top-level targets 和一个 `finalRoleEntry`。它没有与 `orderedSteps` 同长度、同 role、同 version/hash 的中间 delegated-role entry tuple。Compiler API 展开的属性也只有 `finalRoleEntry` 与通用 `resultingHighWatermark`；普通布尔和 digest 无法让调用方或 checker证明每个中间 delegated role 都持久推进。

反例：lineage 为 `targets → delegated:vendor → delegated:rights`。当前形状可以只显式推进 `delegated:rights`；重启后 `delegated:vendor` 的旧 version/hash 重新出现时，没有与本次 authorization 同一原子提交的 typed entry证明它被拒绝。该路径正是正文要求逐 repository+role 防 rollback 的对象。

影响：非 target metadata 可被错误标成 target final role，或中间 delegated role rollback 后重新授权已撤销/旧 target。两者都属于供应链授权绕过。

必须修复：`N` 收窄为 `"targets" | `delegated:${string}``，并从 `delegationLineage.finalRoleMetadata.roleName` 推导，禁止调用者独立指定；high-water advance 使用与完整 ordered metadata lineage 同构的精确 tuple，逐 role绑定 version/hash/expiry，和 target authorization 在同一 CAS 原子提交。增加 root/timestamp/snapshot-as-final、两级/多级 delegation 中间 rollback、same-version-different-digest 和 restart replay 反例。

### A5. phase BOM 的 terminal tuple 不可构造，且发布绑定不消费 phase gate 终态

当前 BOM 有 21 个 Definition Complete ID、19 个 step row，静态覆盖集合包含全部 21 个 ID，这一部分通过。但 38,864 行把 terminal tuple写成：

```ts
{ readonly [I in keyof typeof AI_SUPPLY_CANONICAL_PHASE_STEP_BOM_V9]: ReceiptRef }
```

Compiler API 展开后，该类型的 `length` 属性也是 `ReceiptRef`，而不是数值 19。把 19 个 receipt 组成只读 tuple并断言满足该字段，实测报错：`Type 'number' is not assignable to type 'ReceiptRef<...>'`。因此预期的有序 step terminal 正向主路径不可构造；基础编译没有实例化这个正向 fixture，所以仍显示零 diagnostics。

此外：

- `AiSupplySignedExpectedPhaseBomReceiptV9` 只有形状，没有把 canonical BOM bytes、TUF target和 source digest绑定起来的 producer；
- `AiSupplyFailFastOrchestratorTerminalReceiptV9` 标识符在完整合同中只出现 1 次，即自身声明，没有 producer或 consumer；
- 每个 step terminal 仍是裸 `ReceiptRef`，没有 stepId、argv digest、exit code、`passed` 与 `not_run_due_to_predecessor_failure` 的判别关系；
- 38,550 行 `commitReleaseEcosystemBindingV9` 的输入不包含 signed BOM、preflight 或 orchestrator terminal。

类型断言 `AiSupplyFailFastOrchestratorTerminalReceiptV9` 必须出现在 `commitReleaseEcosystemBindingV9` 的输入值联合中，实测得到 `TS2344 false`。

影响：一方面 gate 成功终态无法按声明构造；另一方面即使绕开该类型，`ReleaseEcosystemBinding` 仍可在未证明 19 个 canonical step 全部成功的情况下提交并签名，形成发布假阳性。

必须修复：使用只映射 tuple 数字元素的同构 tuple，元素类型按 BOM row 精确绑定 phaseId/stepId/argv/predecessor/scope 与 outcome；release-success 类型只能接受所有 required step `exitCode=0`，失败后的 `not_run` 不能成为成功闭包。增加 signed BOM 私有 producer，形成 `TUF-authorized BOM → preflight → exact step terminals → successful orchestrator terminal → ReleaseEcosystemBinding → attestation` 的 mandatory 单向链，并加入删步、换 argv、失败后续跑、全 unrelated receipt、漏 terminal 和 release bypass 负例。

## 八项审查矩阵

| 审查面 | 结论 | 反例或证明摘要 |
|---|---|---|
| 1. receipt/JCS/反序列化、edge、DAG、fencing、anchor、CAS、回滚 | `[fail]` | A1、A2、A4。基础 readonly/brand计数通过，但 public deep-frozen、typed edge与 TUF role watermark不闭合。 |
| 2. authority inventory、pre-intent、secret/browser/process/network/effect、cleanup/release barrier | `[fail]` | A3。主 registry 展开为 83 constituent，但 cleanup physical lease漏出；3 个 expected name又无法被 census字段表示。 |
| 3. inference、fallback、billing、delivery unknown、Rights/DataBoundary、四槽 | `[ok]` | 完整合同中的 `RuntimeRouteUnknownCannotRequestFallbackEdgeV9` 可达性断言通过；另构造 A/B 两个不同 `ExecutionRightsSubjectV8`，把 B 的 `AllowedRightsReceipt` 挂到 A 的 grant，strict 编译以 canonicalSubject 不同拒绝 1 个 diagnostic。未发现独立 A/B。 |
| 4. Execution、plugin dispatch、账号池、external identity、runtime child迁移 | `[fail]` | Execution effect-once、unknown terminal和 migration operation×kill-point类型基本闭合；但 provider account cleanup 的真实 effect lease漏出全局 lifecycle census，归入 A3。 |
| 5. OpenAI/Anthropic/Google/AWS/Azure/TokenHub/BytePlus/custom/local/bridge/CLI wire/auth | `[ok]` | 73-row exact oracle集合一一对应；对当前官方关键 path/auth 的抽查未发现独立 A/B。LM Studio Messages 的 none/x-api-key/Bearer与 OpenCode Server Basic/path均与官方当前文档一致。 |
| 6. requirements、owner append-only、expected oracle、claim、四件套、release、TUF、BOM | `[fail]` | 73/73 key与 surface分布准确，owner namespace/semantic compiler链存在；A4 与 A5 使 TUF逐role和 release mandatory gate不闭合。 |
| 7. accessibility、三 realm witness、platform helper、性能环境/回退门 | `[ok]` | a11y pass把六项事实收窄为 literal true并有 matrix producer；三 realm与三平台为精确 tuple，release evidence消费 platform closure；compile budget的 exact/signed-calibrated environment分支存在。未发现独立 A/B。 |
| 8. TypeScript required-never、Extract、并集推断、宽 ref、结构自填、类型爆炸 | `[fail]` | 0 diagnostics、0 any、0 writable property、0非brand直接required-never和预算均通过；但最小正反例暴露 27 个 unfrozen producer、259 个裸ref、authority集合不一致、非法 TUF role与不可构造 BOM tuple。 |

## 计数与最终裁决

| 严重度 | 数量 | 编号 |
|---|---:|---|
| A | 5 | A1–A5 |
| B | 0 | 无 |
| C | 0 | 无 |

最终裁决：`FAIL`。

目标在报告写入后的 SHA-256、行数、bytes 与 HEAD 已再次实测，均与冻结身份完全一致；冻结目标未漂移。
