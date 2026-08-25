# 冻结身份与方法

审计目标：[2026-08-23-ai-supply-universal-onboarding-final.fable.md](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md)

冻结身份在审计开始和结束时分别核验，两次结果一致：

| 属性 | 期望值 | 实际值 | 结果 |
|---|---:|---:|---|
| SHA-256 | `8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da` | `8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da` | `[pass]` |
| 行数 | `36595` | `36595` | `[pass]` |
| bytes | `2340853` | `2340853` | `[pass]` |

仓库 `HEAD` 为 `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`。审计期间未修改仓库文件。

审计方法：

- 顺序完整读取目标第 1–36595 行。目标正文内包含的旧评审说明被视为目标内容，但未打开其中指向 `prompts/`、`research/codex-findings/`、`history/` 或旧报告的链接。
- 只读对照当前 canonical，包括 [docs/09-data-contracts.md](docs/09-data-contracts.md)、[JCS 实现](packages/contracts/src/jcs.ts)、[model binding](packages/contracts/src/types/modelbinding.ts)、[当前 OpenAI-compatible adapter](packages/daemon/src/providers/openaiCompat.ts:113)、CLI capability 与 console setup。生产代码尚未实施本方案的部分没有被计为缺陷。
- 抽取全部 11 个 TypeScript 合同块，以 TypeScript 5.9.3、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、ES2023/NodeNext、零 stub 编译。实测：`diagnostics=0`、`wallMs=4243`、`rssBytes=648609792`。
- Compiler API 审计得到：requirements 73、exact oracle 73、重复 0、缺失 0、额外 0；authority expected 72，但最终程序中三个后置 authority-bearing lease 未进入 expected/registry 闭包。
- 三组无 `any` 严格类型反例均得到 `diagnostics=0`：跨 attempt retry safety、Execution 无 safety 的 retry、空 rights destination/未登记 preferred auth、rights use-case/operation cross-swap。
- 对易变且决定结论的一手事实重新核对了 LM Studio、Kimi、TokenHub、Vertex/WIF、Bedrock、OpenAI、Anthropic 官方资料。

# 结论

`FAIL`。精确计数为 A=4、B=1、C=0。

按方案原样实施后，仍存在四个机器级阻断根因：

1. 最终 authority census 漏掉三个实际 authority-bearing lease；严格执行自身门会无法发布，绕过门则会留下不可完整回收的 authority。
2. retry/fallback safety 丢失 exact attempt 绑定，并未覆盖 Execution 的 sent-retry 分支；首字节、费用或外部 effect 后仍可重复请求。
3. runtime rights 丢失 `useCase`，且 operation 没有与嵌套 rights receipt 做依赖相等绑定；可误用编程订阅或跨 operation 授权。
4. rights blocked 的“直接目标”仍由任意字符串和调用方自填证明构造；空地址、错误产品和未登记认证路径均可通过严格类型检查。

另有一个主流路径协议错误：LM Studio Anthropic Messages 的 optional-auth oracle 错复用了 Bearer，而官方 Messages wire 使用 `x-api-key`。

# A发现

## A-01 最终 authority census 漏掉三个具体 lease，release barrier 不完备

**目标定位**

- `AUTHORITY_LEASE_EXPECTED_TYPE_NAMES_V3` 仅列出 72 个名字：[L849–922](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:849)。
- `AUTHORITY_LIFECYCLE_SOURCE_GROUPS_V6` 及其 policy 由上述闭包派生：[L1240](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1240)。
- 后续新增的 `ExecutionPluginRuntimeAuthorityLeaseReceiptV7`：[L14756–14780](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:14756)。
- 后续新增的 `RuntimeChildRegistryMigrationOperationLeaseV7`：[L23312](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:23312)。
- 后续新增的 `RuntimeChildRegistryMigrationRecoveryLeaseV7`：[L23463](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:23463)。
- 最终声明仍声称 census 与最终联合完全一致：[L36555](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:36555)。

**最小反例**

Compiler API 对最终 11 个合同块做全程序 census，结果为：

```text
authorityExpectedCount=72
authorityIncludesPluginRuntime=false
authorityIncludesMigrationOperation=false
authorityIncludesMigrationRecovery=false
```

三个类型均为具体 authority-bearing lease。其中 plugin runtime lease 在继承的 gate/cursor 之外，还控制 artifact open handle、plugin process tree 和 broker IPC session。严格类型探针证明该类型可作为普通 `AuthorityInventoryBearingLease` 使用，但其精确 release tuple 只看见继承 inventory。

因此只有两种结果：

- 真正对最终 AST 做对称集合门：发现三个 extra，方案自己的发布门失败，无法发布。
- 仍以旧 expected/source group 为真相：plugin 进程、IPC 或 migration cursor 可在 restart sweep/release barrier 中不可见；继承的 gate/cursor 释放后，系统可直接重新发 lease，而旧进程或恢复 authority 仍存活。

**根因级修复**

- 从最终拼接完成的 TypeScript program AST 生成 census 和 registry，禁止在后续合同块仍可新增 lease 时冻结 expected list。
- 所有 field-adding authority subtype/intersection 必须拥有独立 exact constituent policy，不能复用父类 inventory。
- plugin runtime 至少显式纳入 `process_or_session`、`worker_ownership`、`broker_handle`、artifact/resource 与 cursor/gate constituent；migration operation/recovery 分别登记其 resource、writer/cursor、terminal、restart sweep 和 exact release producer。
- release barrier 必须消费最终 registry 的逐 constituent terminal，而不是消费类型名白名单或父类型 release tuple。

**机器验收**

1. 对最终 program 的所有 alias、interface、intersection 和判别联合展开后做 registry symmetric diff，结果必须为 `missing=0, extra=0`。
2. 添加“在 registry 定义之后新增 authority subtype”的 mutation，门必须失败。
3. 分别在 plugin spawn、artifact open、IPC 建立、migration operation intent、migration recovery intent 后 kill；重启后断言所有 lease 可被 census 找到。
4. 在 descendant、IPC、open handle 或 migration authority 未 terminal 前，重新租用必须失败；完成后断言进程、IPC、handle 和逐 constituent authority 均为零。

## A-02 retry/fallback safety 可跨 attempt 换挂，Execution sent-retry 完全缺 safety

**目标定位**

- `AutomaticRetrySafetyReceiptV7<P>` 本应绑定 exact physical attempt：[L10800–10831](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:10800)。
- sent terminal 把字段降成未参数化的 `AutomaticRetrySafetyReceiptV7`：[L10981–11031](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:10981)。
- `ExactAutomaticRetrySafetyTupleV7` 只提取已经擦除 subject 的 receipt：[L15549–15583](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:15549)。
- Execution response/result occurrence 并未把 provider failure 限定为零 publication/effect：[L17930–17983](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:17930)。
- Execution physical sent-retry 只有裸 `retryEdge`：[L18087–18099](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:18087)。
- Execution tool read-only sent-retry 同样没有 safety receipt：[L19462–19475](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:19462)。

**最小反例**

反例一：构造属于 `attempt-A` 的 `AutomaticRetrySafetyReceiptV7<AttemptA>`，挂到 `attempt-B` 的 sent terminal。由于 terminal 字段使用默认宽泛参数，TypeScript 5.9.3 strict 编译为 0 diagnostics。

反例二：Execution 的 `command`、`write` 或 `network` 请求已经在外部执行、收费或发布结果，但 transport 最终给出 provider failure。sent-retry 分支不要求 no-first-byte、no-publication、no-usage、no-tool-effect、no-delivery 证明，仅凭 `retryEdge` 即可推进第二个 physical request，导致重复写入、重复外部 effect 或重复收费。

这是同一个根因：推进 successor cursor 时没有携带与 exact physical attempt 同值的 effect-safety closure。

**根因级修复**

- terminal、cursor 和 retry edge 全部参数化 exact physical attempt subject；`AutomaticRetrySafetyReceiptV7<P>` 不得擦除 `P`。
- receipt 同值绑定 candidate id/body digest、attempt id、sequence、funding reservation、raw response、delivery state、first byte、publication、usage 和 effect terminal。
- 所有 Execution sent-retry 分支必须进入同一安全闭包。
- 对可能产生外部 effect 的 operation，除非有上游 idempotency contract 且能证明 exact effect terminal，否则 automatic retry 固定为 `never`；delivery unknown 一律不得自动 retry/fallback。

**机器验收**

1. attempt A safety 挂到 attempt B、candidate/body/id/sequence swap 均必须 compile-negative。
2. 对每个 inference、Execution、tool operation 的 sent-retry 分支做 AST key-presence 门，必须携带 exact safety closure。
3. 在 first byte、首个 decoded result、UI publication、usage 记账、tool effect、外部 delivery unknown 六个 kill point 后，断言 successor/fallback advance count 为 0。
4. 只有 exact attempt 的全部 no-effect/no-publication/no-charge 证明成立时，第二个 physical request 才能出现。

## A-03 runtime rights 丢失 use-case 和 dependent operation，可误用受限订阅

**目标定位**

- `RightsSubjectV2` 原本包含 `operation` 和 `useCase`：[L5270–5299](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:5270)。
- `RuntimeRightsGrantReceipt` 外层只有 `exactOperation`，没有 `exactUseCase`，嵌套 rights 又是宽类型：[L11795–11818](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:11795)。
- inference/Execution `PolicySubject` 均省略 use-case：[L14865–14890](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:14865)。
- `ExecutionRightsGrantReceipt` 也没有 use-case：[L14906–14918](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:14906)。
- capability slot binding 没有 use-case dependent equality：[L15064–15079](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:15064)。
- Kimi Code subscription 固定行：[L29929–29930](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:29929)。

**最小反例**

一个只授权 `operation="chat"`、`useCase="programming_only"` 的 `AllowedRightsReceipt`，可装入外层声称 `exactOperation="tool_roundtrip"` 的 `RuntimeRightsGrantReceipt`。随后 ingress `PolicySubject` 根本没有 use-case 可供 reference monitor 比较。无 `any` 严格探针得到 0 diagnostics。

Kimi 官方明确允许第三方开发工具使用 Kimi Code，但同时限定其会员权益面向编程场景；自有产品集成应使用 Kimi Platform，并要求保留真实 User-Agent。[Kimi Code 官方说明](https://www.kimi.com/code/docs/en/) 因此，方案中正确的 User-Agent 不能弥补 use-case 在 runtime rights 链上的丢失：一般对话、独立 evaluator 或非编程产品请求仍可消费编程订阅。

**根因级修复**

- 为 inference 和 Execution 建立闭合 `UseCaseId`，并贯穿 ingress、`PolicySubject`、rights subject、grant、slot、physical attempt、fallback 和 funding。
- 改为依赖类型 `RuntimeRightsGrantReceipt<S>`，强制外层 product/operation/use-case/realm/surface 与内部 `AllowedRightsReceipt<S>` 同值。
- Kimi Code、OpenCode Go 等受限权益只可绑定其官方允许的 use-case 和工具 surface；其他场景必须选择官方 API/PAYG 或被拒绝。
- User-Agent 身份、订阅 use-case 权利和资金来源分别验收，禁止用正确身份替代权益判断。

**机器验收**

1. cross-product、cross-operation、cross-use-case、cross-surface、cross-realm rights swap 均 compile-negative。
2. 将 Kimi Code 编程 receipt 注入一般对话或产品集成 request，必须在 credential read 和 network send 前拒绝。
3. 拒绝路径的 secret-read、send、funding-reservation 和 usage occurrence 均为 0。
4. 相同编程请求使用真实已签名 SayDo User-Agent 时仍可通过，证明修复没有靠伪装客户端绕过。

## A-04 rights blocked 的直接目标仍可为空、错产品或使用未登记 auth

**目标定位**

- `OfficialApiMigrationJourneyReceipt` 的 entry、product、journey key、preferred key、route/resume digest 全是普通 `string`：[L34073–34100](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:34073)。
- safe alternative 的 route/resume 同样是普通字符串：[L34102–34121](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:34102)。
- 两个 producer 接受调用方提供的完整 `Omit<...>` body：[L34123–34137](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:34123)。
- 最终自审却断言空目的地已不可构造：[L36593](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:36593)。

**最小反例**

以下值可以同时进入受信 producer，TypeScript strict 为 0 diagnostics：

- `destinationEntryKey=""`
- `destinationProviderProductId=""`
- `supportedAuthJourneys=[{journeyKey:"", ...}]`
- `preferredAuthJourneyKey="not-in-supported-list"`
- `primaryActionDestinationRouteDigest=""`
- `returnAndResumeStateDigest=""`

同样可以把 source product、`PublishedSupportClaimV6`、realm 和 journey qualification 换成互不相关的合法 receipt，再由调用方填写 `proves...: true`。输出 private brand 不能修复未经约束的 producer 输入。

结果是 rights blocked 主按钮仍可能打开空页面、错误产品、错误 realm，或进入没有可执行认证路径的配置页。

**根因级修复**

- entry、product、journey、route、resume 和 digest 使用私有 producer 构造的 canonical non-empty 类型，拒绝空白、控制字符和非规范形式。
- `preferredAuthJourneyKey` 依赖于 exact `supportedAuthJourneys` tuple，类型上只能取其成员。
- journey producer 不再接收调用方自填的证明布尔值和目标字符串；它应消费 source rights subject、compiled destination search、published claim 和 GA qualification，并机械派生目标。
- product、realm、protocol、claim、auth journey 和 route resolver 必须以同一 dependent generic 绑定。
- 无官方目的地时，只能从非空、已发布且排除被阻断 principal/credential family 的 alternative claim set 派生 picker。

**机器验收**

1. 空字符串、纯空白、NUL、confusable、未登记 preferred key 均 schema-negative 和 compile-negative。
2. product/realm/protocol/claim/journey/route 任一 cross-swap，producer 必须拒绝。
3. 对每个 `unknown`/`forbidden` 状态执行真实 click 测试：目标必须解析到 exact non-empty route；否则只能得到经过 absence proof 的非空 alternative picker。
4. 点击前后不得进行字符串查表或 fallback 到通用高级配置页。

# B发现

## B-01 LM Studio Messages 的 optional-auth wire 错复用 Bearer

**目标定位**

- LM Studio 三条 local row 的 graph 统一使用 `bearer_required`：[L26209–26211](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:26209)。
- auth profile 将 Chat、Responses、Messages 合并处理：[L28308–28320](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28308)。
- optional challenge policy：[L28343–28370](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28343)。
- `AUTH_LMSTUDIO_OPTIONAL_V6` 只定义 `Authorization: Bearer`：[L30283](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:30283)。
- 三行 oracle 复用该 auth：[L30368–30370](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:30368)。

**最小反例**

在 LM Studio 开启 Require Authentication，调用 Anthropic-compatible `POST /v1/messages`。方案只发送：

```http
Authorization: Bearer <token>
```

LM Studio 的 Messages 官方文档给出的协议 wire 是：

```http
x-api-key: <token>
```

并明确说明只有在未开启 Require Authentication 时该 header 才可省略。[LM Studio Messages](https://lmstudio.ai/docs/developer/anthropic-compat/messages) 与其 native REST API 使用 Bearer 的说明是不同 wire：[LM Studio Authentication](https://lmstudio.ai/docs/developer/core/authentication)。

即使特定版本可能兼容额外 header，当前方案也无法按 reference-grade exact oracle 证明 auth-enabled Messages 行，且可能使该主流本地路径在不同版本直接失败。

**根因级修复**

- 拆出 `AUTH_LMSTUDIO_MESSAGES_OPTIONAL_X_API_KEY_V7`。
- Messages challenge profile 只能在 `none` 与 `x-api-key` 间切换。
- Chat/Responses 保留各自官方 OpenAI-compatible Bearer oracle。
- positive/negative auth event 由逐 row auth profile 生成，不得从产品级公共 auth 常量继承。

**机器验收**

1. LM Studio auth-on + Messages capture：必须恰有一个 `x-api-key`，且 `Authorization` 为零。
2. auth-off + Messages capture：两个 secret header 均为零。
3. Chat/Responses auth-on：保持其官方 Bearer wire。
4. 把三行任意两个 auth header 交换的 mutation 必须使 exact-oracle gate 失败；auth challenge 正负 typed event 必须逐行齐全。

# C发现

无独立 C 级根因。未把 A/B 的次生表现重复计数，也未把尚未施工、文案偏好或已有安全闭包的非问题降格计为 C。

# 主流供给/协议/安全/UX/工程覆盖矩阵

下表的 `[pass]` 仅表示没有找到独立的“照方案实施仍失败”反例，不表示当前生产代码已经实施完成。

| 覆盖域 | 实际对抗检查 | 结论 |
|---|---|---|
| Canonical receipt、commit envelope、JCS、反序列化 | candidate body/id/digest/sequence/token/CAS/epoch swap；序列化后品牌恢复；当前 [JCS canonical](packages/contracts/src/jcs.ts) 对照 | `[pass]`，未找到独立换挂 |
| Producer DAG、逐 constituent authority/cursor/recovery | 最终 AST census、late subtype、plugin process/IPC/open handle、migration operation/recovery | `[fail:A-01]` |
| Provider cleanup/reset/re-lease | 五类残留成功、baseline 漂移、cleanup 后直接重租、`T → A → retryStart` pending cycle | provider account 局部模型 `[pass]`；全局 registry/release barrier 受 A-01 阻断 |
| 四槽 review-ready | dialog/coding/quick/evaluator terminal、solution/generation/distribution/evaluator proof cross-swap | `[pass]` |
| Retry、fallback、first byte/effect | 跨 attempt safety、first byte、publication、usage、tool effect、delivery unknown、Execution sent retry | `[fail:A-02]` |
| Rights、subscription、credential custody | product/operation/use-case/surface swap；secret read 前门；Kimi 编程订阅 | `[fail:A-03]` |
| Rights blocked UX | 空目标、错误 claim/realm、未登记 auth、absence alternative、click route | `[fail:A-04]` |
| Funding/billing/unknown metering | TokenHub/OpenCode/Execution funding cross-swap、free-only、PAYG、unknown usage、reservation/release | `[pass]`，未找到新的资金闭包缺口 |
| TUF、proxy、network/data/compute | third-party core `never`/bundled 伪装、artifact/decision 换挂、proxy recipient、egress、data boundary、compute authority | TUF/credential/network 本身 `[pass]`；plugin runtime authority 受 A-01 阻断 |
| 73 行 exact oracle | AST：requirements=73、oracle=73、duplicate/missing/extra=0；逐 physical operation method/path/auth/stream swap | 结构 `[pass]`；LM Studio Messages 事实 `[fail:B-01]` |
| OpenAI、Anthropic、Gemini、Azure | Chat/Responses/Messages method/path/body/stream/auth 与 row wire；当前生产 fixed Chat adapter 仅作起点对照 | `[pass]`；未把尚未施工计为缺陷。官方参照：[OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create)、[OpenAI Chat](https://developers.openai.com/api/reference/resources/chat/subresources/completions)、[Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create) |
| Vertex global/regional、ADC/WIF | global host、regional host、project/model/location binding、WIF audience、ADC/WIF recipient swap | `[pass]`；global/regional 与 provider-URL audience 未发现反例。[Google WIF](https://docs.cloud.google.com/iam/docs/best-practices-for-using-workload-identity-federation)、[Google locations](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations) |
| Bedrock unary/stream、SigV4 | `/model/{modelId}/converse` 与 `/converse-stream`、signing recipient、stream framing | `[pass]`。[AWS ConverseStream](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html) |
| BigModel、Kimi、TokenHub | Kimi 真实 User-Agent、两协议；TokenHub operation/models 双认证、两站点；funding/site cross-swap | Kimi wire、TokenHub oracle `[pass]`；Kimi use-case rights `[fail:A-03]`。[Kimi](https://www.kimi.com/code/docs/en/)、[TokenHub](https://cloud.tencent.com/document/product/1823/130079) |
| CC Switch、LiteLLM、本地 runtime | opaque bridge、auth realm、stream、local peer、none/secret challenge、伪装本地 | 除 LM Studio Messages 外 `[pass]`；LM Studio `[fail:B-01]` |
| Custom Base URL | 安全 base directory、无前导斜杠 relative path、Chat/Responses/Messages × none/Bearer/x-api-key/custom header × none/mTLS | `[pass]`，未找到新的 base/path/auth cross-swap |
| Optional auth 与 typed event 全集 | positive/negative challenge、field occurrence、realm/step/polarity swap | 一般模型 `[pass]`；LM Studio Messages profile `[fail:B-01]` |
| 自动发现、主动配置、被动提示、UX/a11y | automatic 零主动作、逐 row recovery、graph 派生 UI、账户起点、MFA、费用披露、theme/mobile/a11y | 除 rights destination 外 `[pass]`；目标闭包 `[fail:A-04]` |
| Deterministic/live qualification、资产池、remote witness | remote live N/A、两 cycle 证据复用、账号租约集合不相交、三平台 helper/installer、三 realm/distribution witness | `[pass]`；未找到新的 cross-realm/distribution witness |
| Legacy JSON/SQLite 五态 | 每个半写状态、JSON rename/fsync、SQLite prepare/commit/WAL、permit/cutover/rollback/cleanup kill point、公平恢复 | 状态机本身 `[pass]`；operation/recovery lease 未入全局 census `[fail:A-01]` |
| Fixed/owner public support、四类发布物 | owner 自填 compiled fact、row/oracle/qualification/distribution cross-swap、support page/picker/test matrix/release note 同源 | `[pass]` |
| Evaluator 与 Execution extension | proof 跨 solution/generation/slot、无关 decision/artifact、Connector SDK、第三方 Execution/registry 开源扩展 | evaluator/closure `[pass]`；plugin runtime release `[fail:A-01]` |
| Strict compile、readonly/required-never、资源预算、Phase/Definition Complete | 11 blocks、零 stub strict compile；预算、fail-fast、供应链、Phase dependency 与发布门 | 编译/预算 `[pass]`；最终 authority symmetric gate 必然 `[fail:A-01]` |

# A/B/C精确计数

| 级别 | 精确计数 |
|---|---:|
| A | 4 |
| B | 1 |
| C | 0 |

通过条件是 A=0 且 B=0；本次实际为 A=4、B=1。

# FAIL