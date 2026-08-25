# AI 供给普适接入 v19 最终对抗审查报告

## 结论

`FAIL`

精确计数：`A=19，B=7，C=0`。

当前冻结方案未达到 reference-grade。局部枚举与规模门多数机械正确，但 receipt 序列化、联合类型相关性、authority 生命周期、fallback、distribution 绑定、release BOM、性能 baseline、owner migration 和 a11y 闭包存在发布假阳性或主路径不可构造问题。

## 1. 冻结身份

审查目标：[2026-08-23-ai-supply-universal-onboarding-final.fable.md](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1)

开始与结束复核一致：

```text
SHA-256  f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7
lines    44555
bytes    2797930
HEAD     174ab48895aa1e4a6c6b42b9c74187f20efc3cfd
status   ?? docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

目标在当前 HEAD 下是未跟踪文件，但字节身份与 prompt 冻结值完全一致。审查期间未写文件。

未读取任何旧 prompt、旧 finding、logs、`history/PROCESS-JOURNAL.md` 或外部审查报告；目标文档自身包含的历史段落没有被当作审查依据。

## 2. 方法与机械结果

完整读取全部 44,555 行，并抽取全部 11 个 TypeScript fence。按文档采用的拼接方式，合同源恰为：

```text
41547 lines
2082083 bytes
```

使用 TypeScript `5.9.3`、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`skipLibCheck`、ES2023、NodeNext，全部探针均通过内存 CompilerHost 注入，没有产生临时文件。

基础编译：

```text
diagnostics=0
property signatures=23286
mutable property signatures=0
any keywords=0
non-brand required-never=0
duplicate properties=0
```

结构计数复现：

```text
public producer ids=55
public receipt graph roots=53
authority sources=76
alias-only sources=8
branch-free policies=61
branch constituents=28
lifecycle constituents=89
requirements=73
exact connection oracle entries=73
suite ids=32
BOM rows=34
UX states=19
a11y cells=972
```

五个独立编译进程：

```text
compiler wall ms: 2663.56, 2731.31, 2662.34, 2854.45, 2750.74
median wall:      2731.31 ms
spread/median:    70.34 permille
max RSS:          732640 KiB / 750223360 bytes
types:            428676, five runs identical
instantiations:   643618, five runs identical
diagnostics:      0, five runs identical
```

总 source、wall、RSS、instantiation 绝对门通过。handwritten source 门和签名相对 baseline 门因下述合同缺口不能据此判定通过。

关键内存探针原始结果：

```text
accepted_exploit_bundle diagnostics=0
semantic_probe_bundle diagnostics=0

canonical_projection_of_receipt diagnostics=1
TS2322 ... deepFrozenCommittedReceiptBrandV1 ... is not assignable to never

fallback_public_path diagnostics=1
TS2322 ... fallbackAttemptStart ...
"not_applicable" | ReceiptRef<...> is not assignable to FallbackAttemptStartCommitV19<...>

a11y_official_snapshot_to_required_cell diagnostics=1
TS2322 ... Property exactRequiredCellKey is missing ...

bom_public_output_composition diagnostics=2
TS2321 Excessive stack depth comparing
DeepFrozenCommittedReceiptV1<AiSupplySignedExpectedBomReceiptV19>
and AiSupplySignedExpectedBomReceiptV19
```

## 3. A 级发现

### A-01 Canonical JSON、nested pointer 与 hydrated receipt 没有分型，合法 commit 主路径不可构造

行号：L305–342、L410–470、L504–540、L18161–18170、L18371–18382、L25145–25158。

`CanonicalJsonProjectionV19`保留非字符串 symbol key并把值映为 required `never`。因此任意带两个 unique-symbol brand 的 `ReceiptRef` 都不能赋给其 canonical projection；实测得到 `TS2322`。与此同时 serialization profile 又要求嵌套 receipt 只写六字段 pointer，而 deserializer 没有 dependency resolver，却承诺恢复完整业务体 `B`。

实际主路径 `ExecutionExternalIdentitySubjectReceipt.providerRealm` 已嵌套 branded receipt；`ActiveSupplySnapshot` 还含七个 `ReadonlyMap`，与递归 JCS 可序列化声明冲突。

最小修复：建立唯一 `ReceiptPointer<K,S>` wire 类型；`CanonicalBodyOf<R>` 在普通对象递归前特判 receipt；canonical body 禁止 Map、handle 和 hydrated object；deserialize 先返回 pointer-bearing wire receipt，再由显式、验证依赖后的 hydrator 恢复对象图。

### A-02 union decoder 被拆成 K/S/B 笛卡尔积

行号：L497–540。

`ReceiptKindOfSchemaDecoderV8`、`ReceiptSubjectOfSchemaDecoderV8`、`ReceiptBodyOfSchemaDecoderV8`分别对 union 分布，再在返回式中重新组合。对于：

```ts
Decoder<A, SA, { a: string }> | Decoder<B, SB, { b: number }>
```

当前返回类型接受 `kind=A、subject=SA、body={b:number}` 的 trusted committed shape；类型断言在 strict 下为零诊断。

最小修复：只做一次 distributive conditional：

```ts
D extends Decoder<infer K, infer S, infer B>
  ? DeepFrozen<ReceiptRef<K, S> & B & Envelope<K, S, B>>
  : never
```

registry lookup 必须返回单一 decoder，不能接受 caller 提供的 decoder union。

### A-03 53-root manifest 无法实现“零裸 ref”

行号：L8481–8499、L8754–8821、L11280、L11347–11370、L13094–13104、L40966–41093、L41585–41602。

可从 public roots 遍历到多个默认 kind 的裸 `ReceiptRef`：

- `TransportSubject`、`ComputeSubject.resourceScope` 擦除了已存在的闭合 `ResourceScopeReceipt` union；
- runtime fence、effective route、funding limit 仍是裸 ref；
- distribution identity 的 TUF lineage 最终到 `exactTargetPathEvaluationReceipt: ReceiptRef`。

最小反例是把无关 `TimeAuthorityReceipt` 填入 transport/compute resource scope，类型仍接受。若 v19 generator 遵守“遇裸 ref 硬失败”，53-root release 主路径不能构造；若不失败，`bareReceiptRefWithDefaultKindCount:0` 是发布假阳性。

最小修复：全部可遍历字段改成准确 `ReceiptPointer<K,S>`或闭合 target union；manifest row 必须由 resolved owner-property symbol 泛型生成；对每个 public root 做 transitive no-bare-ref 门禁。

### A-04 Inference IR 没有请求或响应内容

行号：L24606–24743、L24952–24964。

`InferenceIrOccurrenceV1`只有 path、kind、digest、requiredness；`InferenceRequestIR`没有 text、tool arguments、audio、content handle 或 segment。`WireRequestPlan`只有 body digest，`content_delta`仍只返回 occurrence metadata。

最小反例：仅从某个 text occurrence 的 digest 不可能恢复 `"hello"`，因此无 ambient state 的纯 adapter 不可能生成 wire body；响应消费者也无法取得实际 text 或 tool arguments。

最小修复：增加版本化 discriminated item/content union；大内容使用 `{handle,digest,length,mime}`；adapter 显式接收 immutable resolver/segments；wire plan 持有 host-owned body segments；事件携带实际 typed value/handle、request、attempt 与 evidence identity。

### A-05 开放 extension protocol 被当作可枚举 mapped union

行号：L212–226、L15982–16177、L25234–25518。

协议 ID 包含无限 template-literal 域，但 semantic subject 和 conformance core 对该域做 mapped union 再 `Extract`。实测：

```ts
Extract<
  ProtocolConformanceSemanticSubject,
  { plane: "inference"; protocolId: "ext:inference:review.adapter@1" }
>
```

等于 `never`；builtin 则非 `never`。第三方 extension 的 required core 因而不可构造。反方向，bridge producer 又允许显式 `P=A|B`，从而组合 outer protocol A 与 dependency/semantic B。

最小修复：改成保留具体 literal 的 `ProtocolSubject<P>`、`ConformanceCore<P>`；只从唯一锚点推断一个 non-union `P`，其余位置使用 `NoInfer<P>`，并在运行时校验 literal equality。

### A-06 conformance core、payload、attestation 与 release distribution 互不相关

行号：L15938–15955、L25822–25907。

implementation、run payload、attestation、release binding 各保存独立 string distribution digest；后两者还是无 private brand、无唯一 producer 的普通结构类型。

最小反例：同一 `ReleaseConformanceBindingForCore<C>` 可令 payload=`dist:A`、outer binding=`dist:B`、attestation payload=`dist:C`，strict 类型仍接受。

最小修复：全链改成品牌化的 `DistributionArtifactIdentityReceipt<D>`：

```text
RunPayload<C,D>
→ Attestation<C,D,P>
→ ReleaseBinding<C,D,...>
→ ProtocolImplementation<C,D>
```

D 只从唯一锚点推断，所有后续参数 `NoInfer<D>`，每层必须有 private brand、唯一 producer 和运行时 canonical equality。

### A-07 provider cleanup 的五个 authority constituent 没有 lifecycle domain

行号：L940–1018、L1298–1332、L1418–1462。

`ProviderCleanupPhysicalOperationLeaseV9`列入 expected source、branch-dispatched source 和五个 constituent，但 `AUTHORITY_LIFECYCLE_SOURCE_GROUPS_V6.provider_test_account_cleanup`只有 asset lease。

实测：

```ts
AuthorityLifecycleDomainForSourceV6<
  "ProviderCleanupPhysicalOperationLeaseV9"
>
```

为 `never`。

最小修复：将 cleanup physical lease 纳入准确 lifecycle domain，并增加“每个 concrete source 恰属于一个 group”的 exact-partition 断言。当前 `satisfies Record<string,...>`只验证已列元素合法，不能发现遗漏。

### A-08 Rights/Network/Billing/DataBoundary 丢失 TUF 可遍历授权链

行号：L5836–5876、L39398、L41384–41403。

Rights producer 输入含 policy authority，但输出只保留 `policyEvidenceLocatorDigest`；network、billing、data-boundary component 更只保存没有 role/path/time 类型的 opaque leaf。离线 verifier 无法从 root 重放 timestamp、snapshot、delegation、target path、high-water 或 expiry。

最小反例：错误 role、旧 generation 或过期 target 的 evidence leaf仍具有同一 component 类型。

最小修复：四个 component 都保存精确 role/path 泛型化的 `TufTargetAuthorizationReceipt`、canonical target bytes、时间有效性和 lineage edge；digest只能作为派生索引，不能替代证据边。

### A-09 v19 physical terminal 没有完整 authority release closure

行号：L690–760、L41111–41231。

标准 authority 模型要求 `ExactLeaseAuthorityReleaseTuple<L>`覆盖 lease inventory 的每一项。v19 binding 却把精确 lease 擦成 `AuthorityInventoryBearingLease`，terminal 只保存一条 `GeneratedReceiptEdge<..., "receipt:lease-authority-release@1", S>`，producer 输入甚至没有 exact release tuple。

最小反例：拥有 network、funding、cursor 三项 authority 的 lease，只需当前单 edge 形状即可得到 terminal；同时该 edge 的 canonical subject `S` 也不是实际 `LeaseAuthorityReleaseReceipt<L,E>`要求的 `[L,E,token]`。

最小修复：binding 保留准确 constituent lease `L`；terminal 参数化 `L`并强制保存 `ExactLeaseAuthorityReleaseTuple<L>`及计数/set digest；producer 输入消费准确 closure，不能从 opaque graph补造。

### A-10 fallback 正向链既不可构造，又擦除 predecessor terminal

行号：L41148–41335。

`commitPhysicalAttemptSubjectV19`只把 fallback start 保存为宽 `ReceiptRef | "not_applicable"`，返回类型不保留准确 `FallbackAttemptStartCommitV19<S>`。把官方 subject producer输出交给官方 terminal producer后，再调用 `commitFallbackAdvanceV19`，实测得到 `TS2322`。

即使绕过类型错误，advance 返回的 `ready` cursor明确禁止 `predecessorTerminal`，两个不同 terminal 可以生成不可区分的后继 cursor，无法重放上一尝试为何可安全 retry。

最小修复：`PhysicalAttemptSubjectV19`显式参数化准确 fallback start `F`；terminal保留同一 F；新增 branded `FallbackAdvanceReceipt<S,F,T>`或 advanced-ready 分支，持有 predecessor cursor、attempt start、准确 terminal、ordinal 和 CAS successor。

### A-11 union subject 可跨主体拼装 ComputePolicy

行号：L5812–5832、L41360–41426。

`NoInfer`只阻止从后续参数推断，不能禁止锚点 `S`本身是 union；ReceiptRef subject 又是协变的。

以下混装 strict 编译为零诊断：

```text
subject = Subject<R1 | R2>
rights = Rights<R1>
network = Network<Subject<R2>>
billing = Billing<Subject<R1>>
dataBoundary = DataBoundary<Subject<R2>>
```

这直接反驳 L44551 的“cross-subject ComputePolicy 已被拒绝”。

最小修复：subject producer和binding拒绝 union `S`；使用 invariant private identity或 exact type-equality token；运行时逐 component 比较同一 canonical subject bytes；加入上述真实 compile-negative fixture。

### A-12 rights-blocked UX action 可跳到另一主体或产品

行号：L40000–40029、L40355–40375、L40513–40564。

domain subject的 authoritative state evidence与`RightsBlockedPrimaryActionReceiptV8<P,S,D,E>`没有类型连接；wrapper只让二者共享粗粒度状态 `S`。

最小反例：产品/主体 A 的 `rights_unknown` domain subject，可与产品/主体 B 的合法 migration或alternative action组合；内存 producer 调用为零诊断。

最小修复：domain subject参数化准确 `E/P/D`；`R`必须从 DS 内的 exact evidence派生；对 principal、credential family、realm、generation、expiry和distribution逐项 `NoInfer`绑定，并加入 cross-swap fixture。

### A-13 schema-invalid legacy child record 无法进入 quarantine

行号：L25960–26024。

失败原因包含 `legacy_record_schema_or_integrity_invalid`，但 raw inventory、成功分支和 quarantine分支都要求先拥有合法 `LegacyRuntimeChildOwnershipRecordV1`。

最小反例：缺少 `pid`、字段类型错误或 JSON 语法损坏的 `children/*.json`无法构造 raw inventory，因此既不能迁移，也不能产生承诺的 quarantine terminal。

最小修复：raw inventory使用 `{path,rawBytesDigest,readOutcome,decodeOutcome}` envelope；只有 parsed-valid 分支携带 V1；invalid、unreadable、duplicate均直接形成可审计 quarantine terminal。

### A-14 owner migration-only 被投影成 fresh onboarding，v19 qualifier 未接入 release

行号：L33712–33862、L36346–36417、L38639–38835、L41433–41569、L42369–42370。

owner输入允许 `existing_connection_migration_only`，但 availability/live dependency helper只识别固定 key `"hunyuan.cn"`。实测：

```ts
ReferenceOnboardingAvailabilityForRequirementV5<{
  requirementKey: "owner:acme:legacy"
}>
```

得到 `fresh_onboarding_default`。

新 v19 owner `live_or_migration` qualification没有被旧 V6 owner claim消费；release中的 migration positive/absence gate仍只覆盖固定 Hunyuan。

最小修复：由 owner输入的 availability/recipe判别而非 requirement key特判；每个 migration-only row生成准确 `[positive,absence]` tuple；owner claim只消费 exact v19 qualification；release对固定和owner migration keys做双射。

### A-15 signed BOM 与“持续 release gate”清单不是同一集合

行号：L42128–42140、L43538–43573。

两处都恰有32项，但集合机械差异为：

```text
持续门有、BOM 缺：
local-control-authorization.tck
runtime-child-registry-migration.model
transport-credential-boundary.tck
inference-funding-attempt.model
provider-test-account-pool.model

BOM 有、持续门缺：
provider-account-cleanup-operation-matrix.model
runtime-route-terminal-fold.model
owner-extension-fresh-consumer.tck
accessibility-rtl-cartesian.tck
release-distribution-cross-swap.model
```

因此跑满当前34行仍会漏掉五个明定的安全、迁移、资金与账号池 gate，却可生成 success terminal。

最小修复：只保留一个 canonical ordered tuple并由它生成文档表、BOM和计数；若37项均独立必需，则改为37-suite/39-row；若已有合并，必须删除虚假的独立 suite 名并机械证明覆盖映射。

### A-16 orchestrator 可把 D1 的全绿 terminals 洗成 D2

行号：L42198–42405。

BOM和step terminal只绑定 row/argv，没有 BOM instance、distribution、run identity或被测 artifact。successful orchestrator才首次接收独立的 `DistributionArtifactIdentityReceiptV19<D>`。

以下调用为零诊断：

```text
signed BOM = B
steps = 由 dist-A 运行得到的 34 个 passed terminals
distributionIdentity = dist-B
```

`typeContractCompileGate`、edge manifest、public contract compilation同样不带 D，却被 outer release声称属于同一发行物。

最小修复：BOM带 canonical instance/run digest；每个 step terminal和predecessor参数化 `B,D,Run`；compile gate、manifest、public compilation保存被测 artifact identity；orchestrator从 terminals派生唯一 D，而不是单独接受 D。

### A-17 官方 signed-BOM 输出不能直接进入官方 orchestrator

行号：L42198–42358。

用：

```ts
ReturnType<typeof commitAiSupplySignedExpectedBomV19>
```

作为 `AiSupplyPassedStepTupleV19<B>`和successful orchestrator的 B，TypeScript 5.9.3稳定产生两个 `TS2321 Excessive stack depth`。改用未 deep-frozen 的接口声明才可编译，但那丢失了public producer的准确返回身份。

最小修复：避免对包含34行递归tuple的完整 receipt再次递归 `DeepReadonly`展开；将已readonly的tuple保留为opaque branded BOM identity，step类型通过轻量 row index查找；加入“实际 producer ReturnType直接串接所有下游 producer”的正向fixture。

### A-18 performance baseline 可无前驱、无 owner 决策重新 bootstrap

行号：L27124–27173。

baseline receipt无条件宣称“replacement经过 predecessor gate与owner批准”，但 producer的：

- `predecessorBaseline`
- `predecessorCompileGate`
- `ownerReplacementDecision`

全部独立 optional。仅传 canonical bytes、policy和invocation evidence即可零诊断生成新的 signed baseline。

最小修复：使用严格判别联合：

- `bootstrap`：要求一次性 genesis authority和 predecessor absence proof；
- `replacement`：强制 exact predecessor、针对该 predecessor 的 passing gate、owner decision及 durable baseline cursor CAS。

输出必须保存分支、old/new digest和成功revision。

### A-19 a11y 972-cell closure没有合法 cell producer，并可通过对象展开洗 brand

行号：L36945–36976、L41684–41739、L42372–42395。

唯一 snapshot producer输出不含`exactRequiredCellKey`，distribution digest也只是宽 string；v19 map却要求每个值额外交叉：

```ts
{
  testedDistributionArtifactDigest: D;
  exactRequiredCellKey: K;
}
```

官方 snapshot直接赋值实测 `TS2322`。但：

```ts
{
  ...snapshot,
  testedDistributionArtifactDigest: "dist-a" as const,
  exactRequiredCellKey: K as const
}
```

被 TypeScript接受为合法 cell，因为对象展开携带了private brand；该新对象并非原 canonical committed body。若运行时 JCS verifier拒绝它，972-cell正向路径不可构造；若接受结构形状，则可伪造cell。

required matrix还未参数化 D，且producer输入的 TUF authorization和canonical bytes没有保存在输出图。

最小修复：新增唯一 `commitGaAccessibilityPassedCellV19<K,D,M>` producer，从准确 snapshot、matrix和distribution生成独立 branded cell；required matrix参数化 D并保存TUF target bytes/authorization；closure只消费准确的972-member tuple/map。

## 4. B 级发现

### B-01 current compile gate无法执行 handwritten source预算

行号：L27057–27251。

预算和baseline记录 handwritten bytes/lines，但 current gate及producer没有当前 handwritten/generated digest、bytes或lines。一个1.2 MiB handwritten schema、总合同仍低于4 MiB的构建，可以仅凭现有字段声称 absolute outcome pass。

最小修复：current gate输入/输出加入 handwritten/generated准确digest、bytes、lines、分类manifest及逐门结果；30% headroom也必须基于明确的目标集合。

### B-02 remote witness operational release丢失 release-time anchor

行号：L6724–6770。

producer输入 `releaseMonotonicAnchor`，输出却只留下“当前且未过期”的布尔结论，没有准确release time authority、anchor或与qualification `notAfter`的比较receipt。离线 verifier无法重放当时是否有效。

最小修复：输出保存准确time authority、monotonic anchor、qualification expiry comparison和最终distribution绑定。

### B-03 Codex command auth把 auth-retry 错建模为 expiry，refresh生命周期未闭合

行号：L41865–42120。

合同把 `refresh_interval_ms=0`映为`on_expiry`。当前官方定义是：默认300000毫秒主动刷新，设为0则只在一次authentication retry之后刷新；command stdout本身只输出token，并不提供expiry。[OpenAI Codex Configuration Reference](https://developers.openai.com/codex/config-reference)

现有图没有：

- authentication-failure/retry observation；
- branded refresh cursor receipt及唯一producer；
- single-winner CAS；
- refresh后的新process lease和旧credential retirement；
- fixed interval deadline relation。

最小修复：分支改为`on_authentication_retry | fixed_interval`；建立auth-failure observation → CAS refresh cursor → process lease/send/terminal → broker credential transition，并绑定旧新generation、deadline和concurrency winner。

### B-04 signed BOM把可执行 argv存成shell字符串

行号：L42144–42181、L43577。

BOM row中的argv是 `"pnpm exec vitest run ..."`单字符串，但runner又要求argv array和`spawn(...,{shell:false})`。直接执行会把整串当executable而失败；自行split则实际argv不再是被签名的精确值。

最小修复：存字面tuple，例如`["pnpm","exec","vitest","run",path]`，对canonical array做JCS digest；展示字符串只作为派生投影。

### B-05 ar-SA在typed a11y合同、交付树和DoD之间漂移

行号：L41645–41701、L42496–42498、L43431–43435、L43840。

typed合同要求`zh-CN/en-US/ar-SA`三个真实locale加`en-XA`，但预期代码树没有`ar-SA`，DoD又写“真实双用户locale”。

最小修复：交付树增加`ar-SA/`；DoD改为“三个真实用户locale”；目录、catalog和测试集合由`GA_ACCESSIBILITY_USER_LOCALES_V19`机械生成。

### B-06 Azure公开支持表宣称Chat，但73-row oracle只有Responses

行号：L34617–34620、L35083–35086、L42517、L42580。

四个Azure requirement全部是`openai_responses`并指向`/openai/v1/responses`；没有Azure Chat requirement、oracle或TCK。生态表却写“Chat/Responses”，且未标candidate或roadmap，与“未进入exact claim set不得展示支持”规则冲突。

最小修复：当前改成“Responses only”，或新增独立Azure Chat requirement、exact oracle和TCK并重算所有exact counts。

### B-07 冻结快照声称的14条compile-negative实际不存在

行号：L44551–44553。

机械结果：

```text
@ts-expect-error in 11 TypeScript blocks: 0
@ts-expect-error in whole document:       1
```

唯一出现位于L44553的“有14条”自述本身。并且其声称已拒绝的cross-subject ComputePolicy被本审查零诊断复现，fallback正向路径反而不能编译。

最小修复：把每条正反例放入真实、签名并纳入BOM的fixture模块；Compiler API检查预期错误位置、错误码、unused directive和fixture digest；不得用文档自述代替测试输入。

## 5. 覆盖矩阵

| 审查链 | 结果 |
|---|---|
| public export、deep-freeze、JCS、deserialize | `[fail]` A-01、A-02、A-17 |
| 53-root typed edge manifest、producer DAG | `[fail]` A-03、A-09、A-10 |
| 76 source / 89 constituent authority | `[fail]` 数量算术正确；A-07、A-09 |
| TUF role/time/high-water | `[fail]` A-03、A-08、B-02 |
| Rights/Billing/Network/DataBoundary/claim | `[fail]` A-08、A-11、A-12 |
| physical attempt/delivery unknown/retry/fallback | `[fail]` A-09、A-10 |
| Execution/plugin/external identity | `[fail]` A-01、A-05、A-06；plugin分支本身未发现额外独立根因 |
| provider账号/cleanup/legacy migration | `[fail]` A-07、A-13、A-14、A-15 |
| 73 requirement与exact oracle | `[ok]` 均为73且key集合双射；B-06是公开文案越过claim set |
| owner扩展与migration正反gate | `[fail]` A-05、A-14 |
| 四件支持产物 | `[fail]` owner migration和Azure公开投影不诚实 |
| non-union distribution | `[fail]` outer检查存在，但内层A-06、A-16仍可cross-swap |
| Codex command auth | `[fail]` B-03 |
| 19 UX states | `[ok]` 5 automatic + 12 user_required + 2 terminal_start，registry共19 |
| 3真实locale+pseudo、972格a11y | `[fail]` 轴乘积正确；A-19、B-05 |
| remote witness/三平台anchor | `[fail]` B-02；三平台枚举本身完整 |
| 32-suite/34-row BOM及orchestrator | `[fail]` 数量正确；A-15、A-16、A-17、B-04 |
| 五进程性能与签名baseline | `[fail]` 当前绝对编译门通过；A-18、B-01使签名/handwritten门不可信 |
| 冻结机械证据 | `[fail]` B-07 |

## 6. 最终判定

A、B均非零，不能判为`PASS`。必须修复上述根因、补齐真实正反fixture和唯一producer链，重新冻结准确SHA后再进行全新target-only终审。

最终复核SHA仍为：

```text
f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7
```