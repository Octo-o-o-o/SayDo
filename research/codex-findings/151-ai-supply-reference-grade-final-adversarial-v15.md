# 冻结身份与方法

审计目标：[2026-08-23-ai-supply-universal-onboarding-final.fable.md](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1)。下文“目标 Lx–Ly”均指该文件。

## 冻结身份

执行：

```text
shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

结果：

```text
SHA-256  7fbc0a8ba767d90d84e26a49f83a357d57c5a269f1cf0c43b54c2e6a4d832967
lines    33210
bytes    2146263
```

三项与用户冻结值完全一致，继续审计的是唯一目标版本。

## 审计边界与实际检查

- 完整扫描目标全部 33210 行、11 个 TypeScript fence、当前 canonical 和必要生产代码。
- 未读取 `prompts/`、`research/codex-findings/`、`history/` 或旧评审；未修改任何仓库文件。
- 当前真实 legacy 输入与 [runtimeChildRegistry.ts](packages/daemon/src/runtimeChildRegistry.ts:17) L17–27 一致，不是假设出的格式。
- 11 个 TypeScript fence 使用 TypeScript 5.9.3、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`noEmit` 内存编译：`0 diagnostics`。
- `REFERENCE_REQUIREMENT_INPUTS_V3` 与 `REFERENCE_EXACT_CONNECTION_ORACLE_V6` 均为 73 key，排序差集为空；表面构成为 63 inference、5 execution、4 bridge、1 control。
- authority census：72 个预期名称、64 个 concrete、8 个 alias，名称集合无缺失、重复或额外项；随后逐 constituent 检查 cursor/action/terminal/recovery 的语义适配。
- 定向类型反例包括：
  - 第三方 inference/execution 类型断言为 `never`，编译仍为 0 diagnostics；
  - 带真实残留资源的 `cleanup_succeeded` fixture 编译为 0 diagnostics；
  - 把 `openai.chat.key` 换成 Anthropic Messages wire/auth 后，73-row derivation 仍为 0 diagnostics；
  - 对 Go 跨协议 funding 和 bundled-wrapper 内嵌 third-party core 加入“必须为 never”的断言，均触发 TS2344，证明错误组合实际可居住。
- OpenAI 产品事实按 OpenAI Docs 规则只采用 OpenAI 官方资料；其余协议仅采用供应商一手资料。

# 结论

**FAIL。**

发现 **A 级 12 项、B 级 2 项、C 级 0 项**。这些不是“尚未施工”，而是合同按当前形状原样实施后仍会：

- 让 receipt 证明对象与消费对象分离；
- 误报账号 cleanup 成功，或使 cleanup retry 无法构造；
- 在首字节或不可逆 effect 后自动 fallback；
- 使第三方 Connector/Execution 正式路径成为 `never`，同时允许其伪装 bundled；
- 复用无关授权激活第三方 Execution；
- 洗白 TokenHub、OpenCode Go 和 Execution funding；
- 用 deterministic/N/A 或复用证据替代真实远程资格；
- 签出与 row、operation、streaming、auth 不一致的 exact oracle；
- 跨 distribution/realm 换挂 remote witness；
- 用未经同等级资格验证的 owner row 发布支持声明；
- 跨 solution 复用 evaluator 独立性证明；
- 在 legacy 双写崩溃后没有可执行恢复后继。

# A发现

## A-01 Receipt candidate、commit 与 JCS 不是确定性双射

**位置**

目标 L303–320 `ReceiptRef`、L331–350 `ReceiptCandidateV6`、L352–418 `ReceiptCanonicalSerializationProfileV6`、L426–440 `verifyJcsAndCommitDeepFrozenReceiptV6`、L442–453 interop gate。

**最小反例**

candidate 的 `canonicalBody` 是：

```json
{"allowed": false}
```

调用方提供的 `materializeCommittedReceiptBody` 返回同一目标类型但内容为：

```json
{"allowed": true}
```

JCS/digest 证明的是 `false`，最终 branded receipt 被消费者读取的却是 `true`。根部 `id`、`committedSequence`、`commitTokenDigest` 也没有进入同一 candidate JCS 边界；序列化后 unique-symbol 上的 canonical subject/token 又不可恢复。

**根因级修复**

取消自由 materializer。由 schema 生成唯一的 candidate→commit 双射，持久化单一 canonical commit envelope，同时绑定 canonical subject/body、id、digest、sequence、commit token、CAS identity、writer epoch 和 anchor。反序列化必须 exact roundtrip 验证后才能恢复 brand。

**机器验收**

- 恶意 materializer body swap 必须拒绝。
- TS/Rust/Python candidate→commit→JSON→deserialize 深相等。
- 分别修改 body、id、sequence、token、CAS、epoch、anchor 均拒绝。
- 同一 candidate 不得提交成两个不同 body 或 sequence。
- 普通结构化 JSON 不能自行恢复 producer brand。

## A-02 Provider cleanup 可以在真实残留和 baseline drift 下报成功，且恢复域错误

**位置**

目标 L797–870 authority registry、L1245、L1292–1308 domain mapping、L23511–23536 `ProviderTestAccountAssetLeaseReceiptV6`、L23621–23710 cleanup evidence/terminal。

**最小反例**

构造：

- `providerResources.residualResourceCount = 7`
- `providerSessions.residualActiveSessionCount = 2`
- `credentialVersions.residualActiveCredentialCount = 3`
- `billingAndUsage.residualUnreconciledBillingHoldCount = 4`
- `baselineReset.baselineEqual = false`
- `baselineReset.resultingBaselineDigest != lease.startingResetBaselineDigest`

同时把 cleanup terminal 顶层四个重复计数写为 `0`，选择 `outcome:"cleanup_succeeded"`。该 fixture 在严格编译探针中为 `0 diagnostics`。

此外，账号资产 lease 被放入 `inference_transport_and_compute`；该域的 action/terminal 只认识 invocation、route fence、send/compute，不认识 provider resource deletion、session/credential revoke、billing reconciliation 或 baseline reset。

**根因级修复**

增加独立 `provider_test_account_cleanup` authority domain。成功分支直接 refine 五份嵌套 evidence，要求全部残留为零、`baselineEqual:true`，且 resulting baseline 精确等于 lease 的 starting baseline；删除可独立伪填的顶层摘要计数。

**机器验收**

- 7/2/3/4、`false`、wrong baseline digest 任一 mutation 在 compile/schema/producer 三层失败。
- 每个 cleanup step 后逐点 kill，重启只能收敛到 verified `available` 或 `quarantined`。
- 未闭合资源、credential、session、billing hold 或 baseline 时，live cycle 和 release gate 恒红。
- authority census 必须显示专属 cleanup action/terminal/recovery，而非 inference terminal。

## A-03 Cleanup pending 与 retry authority 构成不可构造的 digest 环

**位置**

目标 L23574–23584 `ProviderTestAccountCleanupRetryAuthorityReceiptV6`、L23650–23710 `ProviderTestAccountCleanupTerminalReceiptV6` / `commitProviderTestAccountCleanupV6`。

**最小反例**

首次 cleanup 留下一项残余，应提交 `cleanup_pending`。该 terminal 必须内嵌 `retryAuthority`；authority 又必须保存 predecessor cleanup terminal 的 id/digest。于是：

```text
terminal digest → nested retryAuthority → predecessor terminal digest
```

首个 immutable pending terminal 没有有限、确定的 JCS 构造顺序。`commitProviderTestAccountCleanupV6` 的输入也没有已提交 authority 可供引用。

**根因级修复**

拆为有向两步：

```text
commit pending terminal T
→ producer emits retry authority A referencing committed T
→ retry start consumes T + A
```

terminal 不得内嵌指向自身 digest 的 authority；retry cursor 另做单后继 CAS。

**机器验收**

- 故意产生 pending，必须得到稳定的 `T → A → retryStart` DAG。
- placeholder digest、自引用、digest mutation 和 authority-before-terminal 均拒绝。
- 在 T commit 后、A commit 后、retry CAS 前后分别崩溃，重启均有唯一后继。
- retry 不得重复释放资产或产生第二条 cleanup successor。

## A-04 Fallback 可在首字节或不可逆 effect 后自动切换供应商

**位置**

目标 L10242–10250 `PhysicalAttemptTerminalBase`、L10399–10424 sent retryable、L10625–10629 inner fold、L12308–12559 effect terminal/closure、L14643–14720 outer fallback；与 L21183–21185 的首字节安全承诺冲突。

**最小反例**

供应商 A 已向 UI 发布一个 SSE `content_delta` 后断线。物理终态仍可被包装为 `sent/retryable/exhausted`，随后 `FallbackAdvanceTransitionReceipt` 切到 B，形成 A+B 混合响应和双重计费。

同样，hosted tool effect 已 `committed` 或 `delivery_unknown` 时，effect 层虽声明 `automaticRetryForbidden:true`，外层 fallback 仍可 advance。

**根因级修复**

增加 producer-only `RetrySafetyReceipt`，绑定 send intent、raw response inventory、首响应字节、已发布 IR 数量、usage/tool events 以及 exact effect closure。只有零响应字节、零 publication 且 effect 全部确定未发生时，才允许自动 advance；其余只能进入 partial/unknown terminal。

**机器验收**

在 request 前、headers 后、首 SSE token 后、usage 后、effect committed 后、effect unknown 后逐点 kill。只有第一种安全情形的 successor request count 可为 1，其余必须为 0；opaque/self-reported evidence 替换必须拒绝。

## A-05 第三方 protocol core 既成为 `never`，又能伪装 bundled/declarative

**位置**

目标 L13827–13839 `ProtocolImplementationCoreReceipt`、L13868–14026 implementation types、L19524–19547 activation manifest。

**最小反例**

`implementationClass` 被写成 plane constituent 内的字符串联合。TypeScript 的：

```ts
Extract<
  ProtocolImplementationCoreReceipt,
  { plane: "execution"; implementationClass: "third_party_code_plugin" }
>
```

不会把属性联合进一步分布，因此结果为 `never`。审计断言 inference/execution third-party core、implementation、activation 为 `never`，严格编译仍为 0 diagnostics。

反方向上，L13930–13933 的 bundled/declarative execution wrapper 没有限定 `implementationCore.implementationClass`。一个 core 可写 `third_party_code_plugin`，外层却写 `bundled_trusted`，随后进入 `pluginMode:"not_applicable_bundled_or_declarative"`。定向“该交集必须为 never”的断言触发 TS2344，证明换挂可居住。

**根因级修复**

把 core 展开成真正按 `plane × implementationClass` 分布的判别联合；wrapper 的顶层 class 必须与 inner core exact equality。为 inference、execution 第三方正例增加构造性断言。

**机器验收**

- 两类 third-party 正例必须 `NonNever`。
- 跨 plane/class、inner/outer class mismatch 必须 `never`。
- fresh-consumer 第三方 connector/driver 能从公开 SDK 正向构造。
- bundled/declarative activation 内出现 third-party core 时，schema、producer、runtime admission 全部拒绝。

## A-06 Execution 插件授权缺 provenance、用途绑定和可恢复 runtime authority

**位置**

目标 L7442–7665 `AuthorizationProposalReceipt`、L11752–11949 disclosure、L13948–13973 `ExecutionPluginPolicyReceipt`、L14007–14066 activation/admission、L19551–19563 runtime admission；对照 L14773–14805 inference plugin policy。

**最小反例**

proposal/disclosure union 没有 `execution_plugin_activation` 分支。policy 却接受任意 `AcceptedUserDecisionReceipt` 和若干裸 digest。因此可复用一次 `custom_public_header` 等无关 accepted decision，填入任意 publisher/artifact/permission digest 后激活 Execution 插件；decision 也没有 consumption commit，可再次重放。

若 producer拒绝无关 decision，则合法 Execution plugin consent 在当前联合中根本无来源。即使修活路径，`singleSessionUseLease` 仍只是裸 `ReceiptRef`，未进入 L797–870 authority registry；插件进程加载后、session admission 前崩溃没有注册的终止/reconcile 后继。

**根因级修复**

新增准确的 `execution_plugin_activation` proposal/disclosure/decision branch，绑定 TUF target、signed manifest、publisher、artifact、permissions、processor/data scope、workspace/egress、sandbox/IPC、预算、distribution、generation/expiry，并消费 `UserDecisionConsumptionCommitReceipt`。runtime lease 必须成为注册的 `AuthorityInventoryBearingLease`。

**机器验收**

- 无关 decision、同一 decision 二次激活均拒绝。
- artifact、publisher、permission、data、egress、generation、distribution 任一换挂拒绝。
- unsigned、untrusted、revoked artifact 拒绝。
- spawn 后、session start 前各 kill-point 可唯一 terminate 或 quarantine worker/IPC。
- 正向 single-use activation 流程可从公开 SDK 构造。

## A-07 Funding evidence 是可换挂的笛卡尔积

**位置**

目标 L15172–15192 `ExecutionNoNewSpendProofReceipt`、L26596–26660 funding mapping、L26708–26798 TokenHub registry/closure、L28763–28845 OpenCode Go 与 `SpecialFundingVariantEvidenceV6`。

**最小反例**

以下错误组合均可通过当前结构类型：

1. `requirementKey:"tokenhub.gz.messages"`、`variantId:"tokenhub_free_only"`，却挂 Singapore/chat、`fundingMode:"free_then_payg"`、`paymentEnabled:true` closure。
2. `requirementKey:"opencode.go.chat"`，closure 内 `protocolProfile:"anthropic_messages"`；定向 never 断言触发 TS2344。
3. 外层 `variantId:"go_limit_only"`，内层使用 `go_plus_zen_balance` 和 paid dispatch authorization。
4. Execution 顶层声称 no-new-spend，内嵌任意无关 `ReceiptRef` 作为 entitlement/overage-disabled proof。

`SpecialFundingReleaseClosureV6` 又只有自报 count/boolean，目标中没有命名的 special-funding commit producer。

**根因级修复**

定义 `SpecialFundingVariantEvidenceFor<K,V>` 判别映射，由 requirement/registry 推导 site、protocol、fundingMode、payment/overage；禁止调用方重复填写自由标签。Execution entitlement/overage proof 改为 producer-only typed receipt，参数化 exact funding template、principal、surface、operation、generation。

**机器验收**

- 穷举全部 36 个合法 requirement/variant pair。
- requirement、site、protocol、principal、model、variant、fundingMode、payment、overage 任一 cross-swap 在 compile/schema/producer/release 四层失败。
- free-only 和 go-limit fixture 的 paid send、Zen balance dispatch 数恒为 0。
- 任意裸 `ReceiptRef` 不能充当 Execution no-new-spend proof。

## A-08 Live qualification 把远程 Execution/bridge 判为 N/A，且“两轮”可复用同一证据

**位置**

目标 L23712–23941 live execution/cycle/closure、L26662–26676 classifier、L27563–27571 execution/bridge rows、L29514–29533 deterministic journey。

**最小反例**

classifier 对所有 execution 固定返回 `not_applicable_execution_surface`，对所有 bridge 固定返回 `not_applicable_bridge_surface`。但 Codex app-server、Kimi ACP、OpenCode server/ACP、LiteLLM 等仍依赖外部登录、订阅权益、上游 credential、真实网络或外部计量。deterministic journey 又明确为零真实账号、零 Internet、零 provider side effect，因此上游 entitlement/wire 已失效仍可发布支持声明。Kimi 官方明确说明 CLI/插件调用消耗 membership quota，并可能进入 Extra Usage；ACP 只是 stdio 协议表面，不会把上游依赖变成本地资源。[Kimi membership](https://www.kimi.com/code/docs/kimi-code/membership.html)、[Kimi ACP](https://www.kimi.com/code/docs/en/kimi-code-cli/reference/kimi-acp)。

此外，live run 没有 `cycleId/cycleOrdinal`；cycle 1 和 cycle 2 可引用完全相同的 run、lease、raw evidence 和 cursor chain，只改变 wrapper 的 `cycleOrdinal`。L23930 的布尔值不能产生独立性。

**根因级修复**

按真实 `liveDependencyClass` 推导资格模式，而不是按 surface kind：纯本地 runtime 才 N/A；任何外部账号、entitlement、network、billing/upstream dependency 都必须 live。每个 run 绑定 cycle identity、唯一 occurrence、账号 revision、时间窗口；两 cycle 的 receipt/evidence/lease/cursor 集必须不相交。

**机器验收**

- 把 Codex/Kimi/OpenCode remote-backed row 改成 N/A 必须失败。
- 真实 session start+turn 必须使用非个人受管账号并验证 entitlement、MFA、费用与 wire。
- 将 cycle 1 任一 run/evidence/lease/cursor 复制到 cycle 2 必须失败。
- 登录失效、权益失效、上游 route/auth 失败时 public claim gate 必须红。

## A-09 73-key exact oracle 只有键双射，没有 row/operation/auth/stream 语义闭包

**位置**

目标 L13243–13269 capability、L26465–26588 exact wire/auth shape、L26805–26818 row、L27482–27500 deriver、L27670–27745 wire/auth constants、L27746–27819 oracle。

**最小反例**

1. `ReferenceExactConnectionOracleForInputsV6` 只约束相同 `requirementKey`。把 `openai.chat.key` 换成 Anthropic Messages wire 和 `x-api-key`，完整 11 fence 仍为 0 diagnostics。
2. TokenHub Messages 行只有一个 row-level `x-api-key` auth，但同一 wire 的 GET `/v1/models` 必须使用 Bearer；按 oracle 调 models 得 401，暗中改 Bearer 又偏离 signed oracle。primary/official-backup origin 也没有独立 oracle identity。[腾讯模型列表](https://cloud.tencent.com/document/product/1823/130078)、[腾讯 Messages 接口](https://cloud.tencent.com/document/product/1823/135874)。
3. Gemini/Vertex exact wire 只编码 `:generateContent`，Bedrock 只编码 `/converse`；目标的 Capability 又要求 streaming verified。官方 streaming 是不同 operation：Gemini/Vertex `:streamGenerateContent`，Bedrock `/converse-stream`。[Gemini generate/stream](https://ai.google.dev/api/generate-content)、[Vertex streamGenerateContent](https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1beta1/projects.locations.publishers.models/streamGenerateContent)、[Bedrock ConverseStream](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html)。
4. `credentialHeaderName:"SigV4"` 被当成请求头名；官方 SigV4 实际通过 `Authorization: AWS4-HMAC-SHA256 ...`、`X-Amz-Date`、SignedHeaders 及可选 session token 构造签名。[AWS SigV4](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-authentication-methods.html)。
5. Vertex ADC 与 WIF 共用单一 `tokenResourceOrAudience:"https://aiplatform.googleapis.com/"`，无法分别表达 OAuth scope、STS audience 和 external-account flow。[Google ADC](https://docs.cloud.google.com/docs/authentication/application-default-credentials)。

**根因级修复**

建立由 row `protocolProfile/authKind/surfaceKind` 推导的 `OperationOracle` 判别图：inference、models discovery、unary、stream 各自绑定 method/path/query/framing/auth/header/recipient；ADC/WIF/SigV4 使用不同 auth-flow constituent；primary/backup endpoint 使用独立 identity。deriver必须证明 row 与 oracle 语义兼容，而非只索引同名 key。

**机器验收**

- 73-key 双射继续保留，同时逐 row 运行 protocol/auth semantic compatibility。
- GET TokenHub models 只能 Bearer，POST Messages 只能 `x-api-key`；互换、缺失、跨站和 backup identity 重用均在 secret read 前拒绝。
- Gemini/Vertex/Bedrock unary 与 stream 抓包逐字节匹配；没有 stream oracle 时禁止 advertising streaming。
- literal `SigV4` header、错 scope/audience、ADC/WIF 互换均拒绝。
- OpenAI Chat `/v1/chat/completions`、Responses `/v1/responses` 与 Anthropic Messages `/v1/messages` 继续按官方协议做 golden capture：[OpenAI Chat](https://platform.openai.com/docs/api-reference/chat/create)、[OpenAI Responses](https://platform.openai.com/docs/api-reference/responses/create)、[Anthropic Messages](https://docs.anthropic.com/en/api/messages)。

## A-10 Remote witness 可跨 distribution 换挂，且一个 realm 冒充三套生产部署

**位置**

目标 L5124–5145 bootstrap authorization、L5460–5626 qualification/release/service、L6788–6937 platform/witness production closure；三 realm 要求见 L31649、L31661–31664、L32622。

**最小反例**

`RemoteWitnessProductionClosureV6<D,S,P>` 的 `D` 只出现在顶层 `testedDistributionArtifactDigest`；`S`、`P`、service、operational qualification 并未参数化 distribution。构造器可传入发行物 B 的字符串，同时挂发行物 A 已资格化的 witness deployment/service。

进一步，只提交一个 `realm:"global"` 的 service 和一个 remote witness closure，即可构造包含三 OS helper 的 `PlatformSecurityProductionClosureV6`；类型没有要求 China Mainland 与 enterprise 的独立 endpoint、IaC、operator、data boundary、24h corpus。

**根因级修复**

将 witness 体系参数化为 `WitnessClosure<D,R,S,P>`，让 bootstrap target、manifest、operational release、service、deployment、qualification 全部携带同一 distribution。平台发布闭包要求准确 realm-keyed tuple：

```text
global × china_mainland × enterprise_private
```

每个 realm 独立绑定 operator、endpoint、IaC、data boundary 和 production qualification。

**机器验收**

- A qualification + B distribution 交叉组合在 compile/schema/producer 层失败。
- 删除、重复或换挂任一 realm、deployment、threshold set、bootstrap target 均失败。
- 三 realm 分别运行 production 24h replay/fault corpus。
- platform/witness 旧 release evidence 不能进入新 distribution binding。

## A-11 Owner 扩展可以自填派生事实，且没有同等级 typed qualification producer

**位置**

目标 L28674–28694 `OwnerAdditionalRequirementV4`、L30317–30417 owner qualification/claim/support set。

**最小反例**

`OwnerAdditionalRequirementV4` 直接 `Omit<ReferenceRequirementV3,"requirementKey">`，意味着 owner 自己提供 connection oracle、auth、live mode、availability、journey graph、state plan 等本应由 compiler 派生的字段。namespace compiler 只验证名称冲突。

可提交一个 global inference owner row，却写 N/A live、错误 auth/wire，再用 L30317–30334 中的 digest/count/boolean qualification声称已通过。该 branded qualification没有命名 producer：若实现接受结构化替身，则可绕过；若拒绝，则 owner extension 公共路径不可构造。

**根因级修复**

owner 只能提交 raw input；fixed 与 owner 必须经过同一个泛型 semantic compiler。owner qualification 参数化 exact row，并直接携带 typed journey gates、live disposition、platform/funding closure、mutation gate 与 distribution，不接受 digest-only 替身。

**机器验收**

- owner row 的 wire/auth/protocol 错配、global remote row N/A、错误 realm/funding 均失败。
- 漏掉或换挂 journey/live/platform/funding/distribution receipt 任一项均失败。
- fresh-consumer owner connector 可正向产生 qualification。
- fixed+owner claim set 与 canonical rows 逐 key 精确双射，owner 不能 shadow fixed row。

## A-12 `review_ready` 的 evaluator 独立性 proof 可跨 solution 换挂

**位置**

目标 L13296–13311 `EvaluatorIndependenceProofReceiptV2`、L14304–14320 evaluator binding、L14352–14385 solution constructor、L29368–29434 review qualification/commit。

**最小反例**

independence proof 不包含 solution ID/generation、四槽 tuple 或 binding identity；目标中也没有命名的 proof producer。`commitUnqualifiedSupplySolutionV5` 接受宽 `SupplySolutionSlotTuple` 和另一份宽 proof，没有要求它等于 evaluator slot 内的 proof。

因此可把 solution A 的 evaluator proof 复用到相同 provider/model 的 solution B；后续 qualification 只复用 B 已存的 cross-slot proof，即可得到 `review_ready`。

**根因级修复**

把 proof 参数化为准确四槽 tuple、solution ID/generation、四个 binding/model/route/raw occurrence；由单一私有 producer 生成。solution constructor 强制 proof 与 evaluator slot proof 为同一 receipt identity，并保留输入 tuple 的 literal identity。

**机器验收**

跨 solution、跨 generation、跨 slot、同 provider/model、复用 evaluator 自身 raw occurrence 任一 mutation 均失败；全仓只能由一个 producer 生成 proof 和 `review_ready`。

# B发现

## B-01 Legacy JSON/SQLite 五态迁移没有完整可执行 transition/recovery 合同

**位置**

目标 L21930–22159；Definition Complete L32636。当前真实 v1 生产形状见 [runtimeChildRegistry.ts](packages/daemon/src/runtimeChildRegistry.ts:17)。

**最小反例**

`reconciled_dual_write` 中 JSON 已 rename+directory-fsync，SQLite 尚未 commit 时崩溃。journal 可描述 `resume_missing_sqlite_step`，但目标没有该状态的 recovery lease/action/terminal producer；唯一 dual-write commit 函数要求两边已 durable/published。

五个 migration state 的推进、shadow import、cutover、rollback、旧 JSON cleanup、`unliftable_quarantined` resolution 同样没有状态专属 producer。系统只能永久 fail-closed，或由施工者在合同外发明 authority。

**根因级修复**

为五态补完整 transition table，以及状态专属 lease、intent、terminal、recovery、repair、cutover、rollback、cleanup producer。冲突/unliftable 使用持久 quarantine terminal，并提供安全自然退出或 operator resolution。

**机器验收**

对 JSON temp/write/rename/fsync、SQLite prepare/commit/WAL、permit、cutover、cleanup 每一边界逐点 kill；每态必须只有一个恢复后继。旧 writer 不得推进，冲突不得 signal/delete，满足安全条件后必须最终到 `sqlite_only`。

## B-02 Rights blocked 的 typed destination 没有进入唯一 UX registry/reducer

**位置**

目标 L31046–31081 `RightsBlockedPrimaryActionReceipt`、L31116–31204 registry、L31249–31254 reducer。

**最小反例**

`rights_unknown`/`rights_forbidden` registry row 只携带字符串：

```text
resolve_rights_blocked_primary_action
```

reducer 又接受宽 `domainEvent: ReceiptRef`，返回值没有 `RightsBlockedPrimaryActionReceipt`。因此 blocked view 可在没有安全官方目的地或 absence proof 时生成；点击只能依赖环境查找/string switch，可能进入空白页或错误 realm 的配置页。

**根因级修复**

定义 `PrimaryActionForState<S>` 判别映射。blocked 两态必须携带完整 `RightsBlockedPrimaryActionReceipt`；reducer 返回按 state 参数化的 view model。其余 user-required/terminal 状态也携带各自 typed executable target。

**机器验收**

仅字符串 action、缺 destination/absence proof、过期或跨 product/realm/auth receipt 全部在 compile/schema/UI handler 层失败。每个 user-required 状态恰有一个可执行 typed target；automatic 状态仍保持零主动作。

# C发现

无独立 C 级发现。可选改进未从上述阻断根因中拆分计数。

# 主流供给/协议/安全/UX/工程覆盖矩阵

| 覆盖域 | 实际核对范围 | 终审结果 |
|---|---|---|
| Receipt/JCS/producer DAG | candidate、commit、deep-readonly、JCS、brand、producer DAG、authority census | 集合/编译表面完整；A-01 破坏证明对象与消费对象同一性 |
| Authority/cursor/recovery/cleanup | 64 concrete、8 alias、逐 constituent domain/action/terminal，provider account pool 与 retry | A-02、A-03；cleanup success、恢复域和 retry DAG 不闭合 |
| Rights/credential/funding/billing | custody、wire、challenge、MFA、subscription、unknown metering、TokenHub、Go、Execution no-new-spend | A-06、A-07；其余 rights/funding 基础分支未发现独立高置信缺陷 |
| TUF/proxy/network/data/compute | root/role/delegation/high-watermark、proxy hop、processor/region、peer、compute、custom consent | TUF L6993–7247 和 proxy/data/compute 主形状未发现独立 blocker；witness release 见 A-10 |
| Fallback/首字节/effect-once | physical sent state、usage、SSE、hosted tool、outer solution fallback | A-04 |
| 73 行固定 reference | 中国/全球 API、CLI、订阅、官方/第三方 gateway、本地 runtime；63/5/4/1 | 73/73 key 双射通过；A-08、A-09 证明语义闭包不成立 |
| OpenAI/Anthropic/Azure/BigModel/Kimi/TokenHub/OpenCode | Chat、Responses、Messages、Azure key/Entra、BigModel、Kimi Code、TokenHub 两站、OpenCode Zen/Go/server/ACP | OpenAI/Anthropic 主要路径未发现独立错误；TokenHub operation auth、Kimi remote-live、Go funding 分别见 A-09/A-08/A-07 |
| Gemini/Vertex/Bedrock | unary/stream path、ADC/WIF、SigV4、模型路径与 framing | A-09 |
| Custom Base URL | safe base、RFC3986 relative path、三协议、secret header、mTLS-only、recipient/credential-version identity | L13577–13737、L22170–22171 的 base/path 禁止项较完整；未发现独立 safe-relative-path 字符串伪造反例 |
| CC Switch/LiteLLM | public inference route、control-plane 禁止、route-pin/fallback/evaluator 声明 | L30963–30970、L31937–31938 的 opaque route/control 限界成立；remote bridge live 分类仍受 A-08 影响 |
| 自动发现/主动配置/被动提示/UX | automatic 零主动作、账户起点、MFA、费用披露、逐 row recovery、locale/a11y、graph 派生 | automatic 状态零主动作结构成立；rights blocked typed target 丢失见 B-02 |
| Deterministic/live/account pool | deterministic fixture、两 live cycle、账号资产 lease、cleanup/reset | A-02、A-03、A-08 |
| 三平台 helper/installer/witness | macOS/Linux/Windows、TPM/remote witness、production closure、realm/IaC | A-10 |
| Legacy migration | 真实 v1 JSON、五态 SQLite cutover、rollback/cleanup | B-01 |
| Public claim/四件套 | 73 fixed claim、owner extension、support page/picker/test matrix/release note、distribution `D` | fixed 四件套的 `D` 泛型链较完整；owner qualification 见 A-11，witness 跨 release 见 A-10 |
| Connector SDK/第三方 Execution | inference/Execution plugin、registry、TUF/provenance、sandbox/runtime lease | A-05、A-06 |
| 四槽 review-ready | dialog/thinking/cheap/evaluator、逐槽 activation/journey/distribution、independent evaluator | 逐槽 tuple 主链存在；evaluator proof 可跨 solution，见 A-12 |
| Strict/readonly/required-never | TS 5.9.3 strict、11 fences、构造性/negative assertions | 基线 0 diagnostics；定向反例证明“能编译”掩盖 `never`、错误可居住和 false-success |
| 资源预算/供应链/Phase/DC | compiler budget、platform closure、release gate、Phase 依赖、Definition Complete | 逻辑阻断使 Definition Complete 不可达；关键点为 A-03、A-05、A-09、A-10、B-01 |

# A/B/C精确计数

| 等级 | 数量 |
|---|---:|
| A | 12 |
| B | 2 |
| C | 0 |
| 合计 | 14 |

# FAIL