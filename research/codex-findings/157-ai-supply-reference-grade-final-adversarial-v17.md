# AI 供给普适接入 reference-grade 对抗终审 v17

## 冻结身份与方法

审计对象记为 `P`：[2026-08-23-ai-supply-universal-onboarding-final.fable.md](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md)。

冻结检查在审计前、报告收口前各执行一次，结果一致：

```text
$ shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
1fa73d595c2b898637e5e9b573aa01c0e2cbfe7517d45c9e9104bfe4929aec93  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

$ wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
39300 2494649 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

冻结身份与用户指定值完全相等，因此继续审计。另独立程序化计数得到：

```text
REFERENCE_REQUIREMENT_INPUTS_V3 physical rows = 73
REFERENCE_EXACT_CONNECTION_ORACLE_V6 entries = 73
```

方法与边界：

- 全文读取并审计 `P` 的规范主体 §1–§16。§17 是嵌入目标文件的旧评审归档，依用户“禁止读取旧评审”约束排除，不作为证据。
- 对照当前 `docs/03`、`04`、`08`、`09`、`10`、`11` canonical，以及 `packages/contracts`、`packages/daemon` 的 provider、setup、runtime-child 现状。
- 当前生产代码仍是计划实施前基线；没有把“尚未施工”本身列为缺陷。
- 逐项构造 TypeScript 结构赋值、状态机 kill-point、跨 receipt 换挂、跨 realm/generation、并发 sibling、流式错误与发布门删除反例。
- 必要 provider 事实只采用官方一手资料。OpenRouter PKCE、Gemini key、Bedrock、LM Studio 基础认证、Azure hosted endpoint 等抽查中未发现新的独立事实错误；这不等于实施已通过真实账号验证。
- 独立 TypeScript 5.9.3 最小反例得到：

```text
BundledPretenderAssignableToPluginExactSource=true
AuditInjectedPrivilege="allowed"
AuditKnownNoDestination=never
AuditReviewProjectionTarget="review_ready"
AuditReviewReturnFrozen=false
AuditQualificationReturnFrozen=false
diagnostics=0
```

全程只读，未修改仓库文件。

## 结论

`FAIL`。

冻结文件的 73 行与 exact-oracle 表在数量上闭合，但 receipt 权威来源、rights、迁移、动态 capability、恢复状态机、release 证明链和若干 provider exact protocol 仍存在可执行的最小反例。

按原样施工至少会允许：

- 换挂或自行声明 authority/rights/review-ready/release receipt；
- `delivery_unknown` 被重新折叠成可 retry/fallback；
- 已退休 external identity generation 被直接重新签出；
- cleanup、TUF、账号池和 legacy migration 在崩溃点失去安全闭包；
- Google WIF、Azure Entra/Managed Identity、TokenHub Chat、BytePlus 主路径与官方协议不一致；
- 旧 Hunyuan 在 destination 不存在或过期时仍无法进入诚实的无目的地/保留路径；
- 静态 UI 状态和旧 render capability 被重放；
- 删除门禁步骤后仍可生成全绿 release 结果。

精确计数：A=24，B=4，C=0。

## A发现

### A-01 反序列化允许调用方自行指定 receipt body 类型

- **目标位置**：P:474–487，`deserializeAndVerifyDeepFrozenReceiptV7<K,S,B>`。
- **最小反例**：decoder 只绑定 `[K,S]`，调用方显式指定 `B={injectedPrivilege:"allowed"}` 后，返回类型公开该字段；实测 TypeScript 5.9.3 零 diagnostics。即便运行时 decoder 拒绝该字段，下游类型门已经可以把幽灵字段当作 authority/decision 使用。
- **根因级修复**：删除公开泛型 `B`，由生成的 `ReceiptBodyByKindAndSchema<K,S>` 唯一决定 body；decoder brand 同时绑定 kind、schema artifact digest、版本和 exact body type。
- **机器验收**：调用方无法显式提供 `B`；同一 envelope 不能反序列化为两个 body；kind/schema/version/body 任一换挂在 TS、Rust、Python 均失败；返回对象的可读字段必须与 JCS payload 字段全集精确相等。

### A-02 83 个 authority constituent 中 82 个的真实 source lease 被擦除

- **目标位置**：P:1428–1454、1456–1465、1487–1522，`ExactAuthorityRegistryLeaseV6`。
- **最小反例**：给 bundled `ExecutionDispatchAdmissionLeaseReceipt` 结构性交叉一个 plugin 的字面量 `authoritySourceTypeName`，即可赋给 plugin constituent 的 `exactSourceLease`；真实 `pluginRuntime.kind`、IPC、process tree、artifact handle 均未进入映射。实测 `BundledPretenderAssignableToPluginExactSource=true`。
- **根因级修复**：codegen 生成 `AuthoritySourceLeaseForConstituentV7<K>`，从真实 source union 按 discriminant `Extract`；action、terminal、release tuple 同样引用真实类型，禁止通用 `AuthorityInventoryBearingLease & {typeName}` 包装。
- **机器验收**：83 个正例可达；83×82 交叉换挂全部 compile-negative；每个 key 的真实 discriminant、operation identity、release tuple mutation 均 runtime-negative；新增 constituent 未提供真实映射时 codegen 和 Compiler API 必须失败。

### A-03 同一 plugin dispatch lease 可以并发生成多个 runtime admission

- **目标位置**：P:15255–15305，`commitExecutionPluginRuntimeAuthorityAdmissionV8`。
- **最小反例**：两个线程以同一 `dispatchAdmissionLease`、activation closure 和 process/session identity 调用 producer，可得到两个 committed admission。输入没有 `unused→consumed` cursor、expected revision、CAS 或唯一 admission token，却声明 `maximumSessionUseCount:1`。
- **根因级修复**：增加 dispatch-scoped one-shot runtime cursor；spawn 前原子执行 `unused→consumed`，admission 绑定唯一 resulting cursor，失败 sibling 永远没有 spawn/IPC/artifact-read authority。
- **机器验收**：同一 lease 100 路并发、崩溃重启和旧 epoch 重放只能生成一个 admission、一个进程和一个 IPC session；其余尝试的 process、IPC、artifact handle effect count 均为 0。

### A-04 provider cleanup 会做外部破坏性操作，却没有精确 network/effect authority

- **目标位置**：P:26764–26987，`ProviderTestAccountCleanupStartReceiptV6`、cleanup evidence 和 terminal。
- **最小反例**：cleanup worker 必须执行 DELETE resource、revoke credential/session、billing reconcile；start receipt 不是含精确 network/effect authority 的 lease，也没有逐 operation send intent。严格 reference monitor 会令 cleanup 不可执行；直接发送则绕过事前权限和 `delivery_unknown` 约束。
- **根因级修复**：每个 cleanup physical operation 增加 exact network/effect lease、before-byte intent、credential egress、budget/recipient binding 和 typed terminal；响应未知必须 query/reconcile，禁止盲目 DELETE/revoke retry。
- **机器验收**：无 exact lease 时所有 kill point 的 secret read/network byte 为 0；response loss 只进入 query/unknown hold；跨 endpoint/account/credential 换挂拒绝；release barrier 只有全部 typed cleanup terminals 闭合后可达。

### A-05 principal-bound Rights 没有 `forbidden|unknown` 决定类型

- **目标位置**：P:5390–5436、22781、22879、36406–36417、37057–37067。
- **最小反例**：某 product/region 可以合法展示并保存 credential，故 `ProductEligibility.status="eligible"`；形成 principal 后，精确 surface/operation/use case 对该 principal 是 forbidden。现有 `AllowedRightsReceipt` 只有 `allowed|official_surface_only`，UI/migration 又把 `ProductEligibilityReceipt` 当 `sourceRightsEvidence`，无法表达该状态。
- **根因级修复**：新增 exact `RightsDecisionReceipt<S>` 四分支 union；eligibility 只控制凭据入口，rights 单独绑定 principal、surface、operation、use case、realm、region、distribution、generation 和 expiry。
- **机器验收**：`eligibility=eligible + Rights=forbidden` 必须可构造；用 ProductEligibility 代替 Rights compile-negative；跨 principal/surface/operation/generation/expiry 换挂均拒绝。

### A-06 use-case restriction floor 忽略 surface、operation 和 evaluator 维度

- **目标位置**：P:5438–5511，`USE_CASE_RESTRICTION_FLOOR_ROWS_V8`、`ExactUseCaseEntitlementDecisionReceiptV8`。
- **最小反例**：令 product 为 `openai-codex-app-server`，但伪造 inference surface，operation 为 `chat`，use case 为 `software_development`。条件类型只按 product 和 use case 查表，仍得到 `allowed_by_restriction_floor`；`surfaceClass:"execution"` 和 `evaluatorUseAllowed:false` 没有参与决定。
- **根因级修复**：按 exact `(product,surfaceClass,surfaceId,operation,useCase,evaluatorRole,realm,distribution)` 解析 restriction floor。
- **机器验收**：完整笛卡尔矩阵；execution→inference、operation swap、evaluator-role swap、跨 realm/distribution mutation 全部在 secret read 和 dispatch 前失败。

### A-07 unknown-metering conformance 仍强制嵌入不相干的正向 AllowedRights

- **目标位置**：P:5599–5641、8196–8217、12187–12209、12337–12380、12498–12603。
- **最小反例**：custom unknown target 携带 `UserAdminAttestedCustomRightsReceipt`，但其 `candidatePolicyBinding` 仍必须是 `ConformancePolicyBindingReceipt`，后者又包含 `CandidateRightsGrantReceipt → AllowedRightsReceipt`。可以换挂另一 official product 的 allowed binding；否则 exact custom 分支不可构造。
- **根因级修复**：把 conformance policy binding 改为按 billing/rights kind 判别的 union；priced、custom unknown、official unknown 各自只接受对应 rights 类型，并在 target/member/billing/data/route 间逐字段同值。
- **机器验收**：三类 policy binding 正例分别可达；custom↔official↔priced、endpoint/product/principal/surface/operation swap 全部拒绝；unknown 分支不得包含任何 `AllowedRightsReceipt` 或 settled/no-new-spend projection。

### A-08 official migration 的“无合格目的地”分支由静态 source 表决定，当前 claim/realm/generation/expiry 无法改变结果

- **目标位置**：P:27415–27440、29240–29268、31988、36330–36630，`OfficialApiDestinationResolutionReceiptV8`。
- **最小反例**：source 位于静态 policy 表，但当前 destination claim 缺失、过期、realm/distribution 不符或 journey 不可用。条件类型只判断 `OfficialApiMigrationPolicyForSourceV8<P> extends never`；已登记 source 的 `no_qualified_official_destination` 为 `never`，实测 `AuditKnownNoDestination=never`。Hunyuan 的“迁移或只读保留”图也在选择后无条件进入 destination qualification。腾讯官方公告还规定旧平台于 2026-09-30 全面停服，不能把静态 policy 当实时可用性证明。[腾讯云下线公告](https://cloud.tencent.com/announce/detail/2287)
- **根因级修复**：对所有 source 返回 runtime qualification union；qualified 分支消费当前 destination claim、realm、generation、expiry、journey、distribution，另设 explicit retain/no-destination/sunset branch。
- **机器验收**：逐 policy row 删除、过期或换挂 claim/realm/generation/journey/distribution，必须进入安全 alternative picker；Hunyuan fresh 无既有连接永远没有 CTA；停服后旧 API 不得生成可调用 terminal。

### A-09 optional-auth resolution 是孤立 receipt，没有进入 activation、PreparedAttempt 或最终 header closure

- **目标位置**：P:30140–30408、32358–32361、32453–32469，`ResolvedOptionalServerAuthReceiptV6`；§1–§16 consumer census 为 0。
- **最小反例**：LM Studio G1 process 要求 bearer，重启到 G2 后变为 no-auth；physical request 不要求消费当前 resolver receipt，可以重放 G1 header，或反向跳过 G2 的 credential challenge。LM Studio 官方说明 authentication 默认关闭、启用后使用 Bearer，正说明该状态必须运行时绑定。[LM Studio Authentication](https://lmstudio.ai/docs/developer/core/authentication)
- **根因级修复**：resolver receipt 必须进入 endpoint identity、activation closure、PreparedAttempt credential tuple、header/no-header proof及首字节前 generation/expiry 检查。
- **机器验收**：challenge→resolution→credential/header→descriptor→physical lease→intent 成为强制 DAG；endpoint/process generation/scheme/header/expiry 任一 swap 都是 0 secret read、0 network byte；consumer census 禁止 resolver orphan。

### A-10 TUF 非 root role high-watermark 只读不写，可接受 rollback

- **目标位置**：P:7902–8010，`verifyAndCommitTufRootRotationLineageV3`、`verifyAndCommitTufTargetAuthorizationV2`。
- **最小反例**：先接受 timestamp/snapshot/targets/delegated v2，重启后提供签名有效的 v1。target verifier 只读取 `highWatermarkCursor`，没有 writer lease、expected revision 或 resulting cursor；规范主体没有其他非-root role watermark writer。
- **根因级修复**：target verification 与 `(repo,role,version,digest,expiry)` high-watermark 更新原子 CAS；authorization 绑定 resulting cursor。
- **机器验收**：每个 role 接受 v2 后，重启/离线环境中的 v1、同版本不同 digest、跨 repo/role cursor 全部拒绝；并发 v2/v3 只能形成一条线性 successor。[TUF Specification](https://theupdateframework.github.io/specification/latest/)

### A-11 external identity 标记 generation 已退休后，又把同一 subject 放回 available

- **目标位置**：P:16965–17129，`ExecutionExternalIdentityAvailableCursorReceipt`、`ExecutionExternalIdentityStartReleaseCommitReceipt`。
- **最小反例**：start after-intent 最终权威确认未创建 identity，release commit 写入 `priorStableIdentityGenerationRetired:true`，successor 却是同一 `identitySubject` 的 `state:"available"`；下一次 start 可直接再次消费该 cursor。
- **根因级修复**：release 后进入 retired/closed cursor；fresh start 必须提供新 `ExecutionExternalIdentitySubjectReceipt` 和严格递增 generation，不得返回旧 subject 的 available。
- **机器验收**：release 后同 subject/generation 的 start compile/runtime-negative；新 generation 正例可达；并发 release/restart/旧 cursor replay 只有一个 successor。

### A-12 side-effect terminal 和最终 commit transition 可跨 request 换挂 commit lease

- **目标位置**：P:20382–20457、20925–21183、21265–21301、21553–21602。
- **最小反例**：取 request A 的 sent terminal 和 request B 的 `ExecutorCommitLeaseReceipt`，构造 committed 或 delivery-unknown effect terminal；类型只有可自填的 `exactRequestLeaseCommitLeaseAndTerminalEquality:true`。最终 `ToolInvocationTransitionReceipt.transition="commit"` 同样接受宽 `ExecutorCommitLeaseReceipt`。
- **根因级修复**：所有 effect terminal 泛型化为 `<E,C extends E.externalRequestLease.requestEffect.commitLease>`；commit transition 只消费 exact terminal 中的 commit lease、tool invocation、cursor revision 和 funding closure。
- **机器验收**：两个 tool invocation、request ordinal、endpoint、prepared request、commit token、session lease 的全交叉 swap 均失败；一个 commit lease 只能产生一个 effect terminal和一个 transition。

### A-13 `RuntimeRouteSequenceTerminalReceipt` 可以把 `delivery_unknown` 重新标成 success/exhausted/not-sent

- **目标位置**：P:11464–11477、11616–11658，`RuntimeRouteWithPhysicalTerminalFields`、`RuntimeRouteSequenceTerminalReceipt`。
- **最小反例**：physical terminal 为 `delivery_unknown`，但 sequence receipt 独立选择 `outcome:"success"` 或 `outcome:"exhausted"`，甚至 `sentAggregate:"not_sent"`；相关字段间只有布尔声明，规范主体不存在私有 fold producer。
- **根因级修复**：以 final cursor 和 exact ordered physical terminal tuple 为唯一输入，由私有 `fallback-inner-fold-v1` total function 生成 outcome、sent aggregate、billing disposition、fallback disposition。
- **机器验收**：枚举 physical terminal 序列并与 reference fold 比较；修改任一 outcome/sent/billing/fallback 字段必须失败；unknown 永远 terminal，不能生成 retry/fallback edge。

### A-14 provider 测试账号池声明了 `lease_in_flight`，但没有对应 cursor 和恢复路径

- **目标位置**：P:26567–26753，`ProviderTestAccountAssetLifecycleStateV6`、cursor union、`leaseProviderTestAccountAssetV6`。
- **最小反例**：进程在 `available→lease_in_flight` CAS 后、`lease_in_flight→leased` CAS 前崩溃。状态枚举含 `lease_in_flight`，但具体 cursor union没有该分支，也没有 TTL/recovery terminal；资产既不能安全回收，也可能被再次 lease。
- **根因级修复**：增加 typed in-flight cursor、intent terminal、expiry/recovery/reconcile/quarantine 状态和 single-successor CAS。
- **机器验收**：在 intent 前后、两次 CAS 之间、commit 前后逐点 kill；每个点只能恢复为唯一 leased、available-after-authoritative-absence 或 quarantined；双 lease 永远只有一个 winner。

### A-15 legacy JSON/SQLite 五态迁移允许跳过 cutover 前置条件，且没有 operation×kill-point exact oracle

- **目标位置**：P:24409–24419、24640–24884、25120–25285。
- **最小反例**：处于 `sqlite_authoritative_dual_write` 时直接签 `advance_sqlite_only`，提交通用 `outcome:"completed"` 和 opaque evidence 即可进入 `sqlite_only`；没有类型要求上一正式版降级演练、rollback window close、兼容期 expiry、零 in-flight、零 unresolved quarantine。`RuntimeChildRegistryMigrationOperationStepSequenceV1` 还是 ambient declaration，completion 只按 kill-point 全局计数，不是 operation×kill-point。
- **根因级修复**：建立 operation-specific prerequisite map 和 literal per-operation step oracle；`advance_sqlite_only` 必须消费全部精确 committed prerequisites。
- **机器验收**：状态模型逐项删除/换挂前置 receipt 均不可晋级；每个 physical operation×每个 kill point 都有唯一 recovery successor；rollback window 未关闭时 legacy projection 永远保留。

### A-16 Google ADC/WIF 的声明范围与 exact auth oracle 互相矛盾

- **目标位置**：P:1916–1946、2067–2168、2718–2739、30685–30725、32273–32303、32407–32408。
- **最小反例**：
  - profile 允许 `credentialSource.kind="aws_environment"`，但 subject token type 被限制为 `urn:ietf:params:oauth:token-type:*`；官方 AWS token type 是 `urn:ietf:params:aws:token-type:aws4_request`。
  - profile 允许 service-account impersonation，exact oracle 却固定 `serviceAccountImpersonation:{kind:"none"}`，无法表达 STS 后的 IAM Credentials `generateAccessToken` operation。
  - token URL 被固定为 global STS，计划声明的 external-account 通用形态无法接受官方 regional/X.509 变体。
- **根因级修复**：按 OIDC/SAML/AWS/X.509 source 生成 credential-acquisition DAG；token URL 从验证后的 config 解析并进入 allowlist；impersonation 增加独立 IAM Credentials physical operation。
- **机器验收**：OIDC、SAML、AWS、X.509；global/regional/mTLS STS；impersonation on/off 全组合正例；source/type/token URL/audience/impersonation 交叉换挂在 credential read/DNS 前失败。Google 官方明确支持 AWS、OIDC、SAML、X.509、regional STS 和 service-account impersonation。[WIF 概览](https://docs.cloud.google.com/iam/docs/workload-identity-federation)、[WIF 最佳实践](https://docs.cloud.google.com/iam/docs/best-practices-for-using-workload-identity-federation)

### A-17 Azure 三条非 key 认证缺少 provider-exact acquisition oracle

- **目标位置**：P:2170–2218、2368–2414、30678–30768、32305–32325、32410–32412。
- **最小反例**：
  - `azure.entra-user` 只有 `/token` endpoint，缺 `/devicecode`、client ID、起始表单，以及 poll 与 start 的 tenant/client/device_code 同值关系。
  - service principal 缺 `grant_type=client_credentials`、client ID，以及 secret/certificate/federated assertion 判别请求。
  - Managed Identity 多 UAMI 场景没有 exactly-one `client_id|object_id|msi_res_id|principal_id` selector，无法证明最终 token 属于声明 principal。
- **根因级修复**：Device flow 拆 start/poll 两个 exact operations；service principal 建立三类 assertion union；Managed Identity 建立 `system_assigned|user_assigned`，后者强制一个 typed selector。
- **机器验收**：device start/poll、三类 service-principal、VM/App Service system/UAMI golden captures；tenant/client/scope/device_code/grant/assertion/selector/resource/api-version/header 任一换挂均在首字节前失败。官方流程见 [Device Authorization Grant](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code)、[Client Credentials](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)、[VM Managed Identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-use-vm-token)、[App Service Managed Identity](https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity)。

### A-18 TokenHub 两条 Chat row 丢失流内 SSE 错误 terminal

- **目标位置**：P:30463–30499、32240–32245、32441、32444。
- **最小反例**：

```text
HTTP 200
data: <一个或多个正常 delta>
data: {"error":{...}}
data: [DONE]
```

  Responses/Messages 显式使用 `http_status_or_typed_sse_error_terminal`，广州/新加坡 Chat 却继承通用 OpenAI policy。实现可能把尾随 `[DONE]` 误判成功、挂起或对部分输出重放。
- **根因级修复**：两条 Chat wire 显式采用 typed SSE error terminal；错误优先于 DONE，partial usage/billing 进入准确 failure/hold，流开始后禁止 host fallback/replay。
- **机器验收**：2 realm×3 protocol×primary/fallback；首包前 HTTP error、delta 后 SSE error、连接直接关闭分别恰好一个 terminal，不能 success、retry 或 replay。腾讯官方明确要求解析流中间 SSE 错误帧。[TokenHub 调用概览](https://cloud.tencent.com/document/product/1823/130079)

### A-19 `review_ready` 可由任意 receipt 投影，四槽 producer 又违反 deep-frozen boundary

- **目标位置**：P:34372–34438、36928–36948。
- **最小反例**：以 `receipt:unrelated@1` 调 `compileSupplyViewDomainSubjectV8({targetState:"review_ready"})`，返回类型即 review-ready subject；实测 `AuditReviewProjectionTarget="review_ready"`。`commitGaReviewSolutionQualificationV4` 与 `commitReviewReadySupplySolutionV5` 返回 raw receipt，实测 frozen 判定为 false。
- **根因级修复**：建立 state→authoritative receipt exact map；review-ready 只接受当前 solution 的四槽 qualification、distribution、generation/expiry；两个 producer 返回 `DeepFrozenCommittedReceiptV1`。
- **机器验收**：全部 state×错误 receipt 交叉换挂失败；漏槽、重复槽、跨 solution/evaluator proof/distribution/activation pointer mutation 均失败；exported unfrozen producer count 为 0。

### A-20 capability 没有 render instance/revision，旧 render 可重放且一次 render 可多次 mint

- **目标位置**：P:37071–37271，`SupplySingleUseActionNonceReceiptV8`、`mintSupplyExecutablePrimaryActionCapabilityV8`。
- **最小反例**：同一 state/domain/session/control epoch 调 mint 两次，可得到两个未消费 capability；或 rerender 后继续执行前一次 capability。类型没有 render instance、render revision 或 mint CAS。
- **根因级修复**：每次 render 创建 `RenderInstanceReceipt`；capability 和 nonce绑定 render ID/revision；mint 原子执行 `render_unminted→minted`，execute 原子执行 `unused→consumed`，新 render 使旧 capability 失效。
- **机器验收**：同一 render 100 路 mint 仅一胜者；rerender、state revision、domain receipt、session、generation、expiry 任一变化使旧 capability 在 effect 前拒绝。

### A-21 accessibility pass 可与失败布尔事实共存

- **目标位置**：P:33989–34093，`GaAccessibilitySnapshotEvidenceBaseV6`、`commitGaUiQualificationPassV4`。
- **最小反例**：构造 `outcome:"pass"`，同时令 `keyboardTraversalComplete:false` 或 `focusNeverLostOrTrapped:false`；类型允许，pass producer输入也只要求 raw snapshot union。required/actual keyed digest 名称没有把 presentation profile 明确纳入主矩阵键。
- **根因级修复**：pass snapshot 使用全部必需断言为 literal `true` 的判别子类型；矩阵键显式包含 platform、locale、viewport、presentation、zoom、modality、screen reader；producer 必须 deep-frozen。
- **机器验收**：每个布尔单点翻转、presentation 删除/重复/替换、locale/zoom/screen-reader 换挂都失败；完整笛卡尔矩阵才能生成 pass。

### A-22 多个 release-critical receipt 仍可由调用方结构性自填

- **目标位置**：P:7362–7410、14926–15224、33665–33852、35676–35812。
- **最小反例**：
  - 直接组装 `ThirdPartyExecutionProtocolImplementationReceipt` 或 `ExecutionThirdPartyPluginActivationClosureV6`；
  - owner approve receipt 的 `approvedSubjectCoreDigest` 与 proposal 的 `subjectCoreDigest` 不同；
  - 直接声明 native-helper qualification 已通过；
  - 为四类 support artifact 填入任意 bytes digest，再自填 set、release binding 和 attestation。
  这些节点缺少各自 private brand/producer 或 exact relation，尾部 `proves...:true` 不能形成 provenance。
- **根因级修复**：所有进入 GA/release 的 derived node 必须有不可构造 private brand和唯一 producer；producer 从 raw verified evidence/bytes 计算 equality、set digest、owner decision consumption、artifact set及 binding attestation。
- **机器验收**：release-critical receipt producer/consumer census；直接 object construction compile-negative；owner digest、plugin artifact/publisher/TUF、helper platform/distribution、四 artifact bytes/claim set 任一换挂均失败；缺 producer 的新 release node 阻断 codegen。

### A-23 三个 remote witness realm 可以复用同一 operator、endpoint 和基础设施

- **目标位置**：P:7480–7703，`RemoteWitnessProductionRealmTupleV7`、`PlatformSecurityProductionClosureV6`。
- **最小反例**：global、china_mainland、enterprise_private 三个 closure 分别填写不同 realm literal，但使用相同 operator trust domain、endpoint set、IaC、coordinator/member identity。每个 realm 内部可自洽，tuple 没有 pairwise independence relation，却声称三个 independent deployments。
- **根因级修复**：增加 cross-realm independence receipt，至少约束 manifest、operator/trust domain、endpoint、store、deployment generation、distribution 和 observer failure domain 的允许共享/必须分离矩阵。
- **机器验收**：三个 realm 任意两项 alias operator/endpoint/store/IaC/member identity 时失败；跨 distribution、旧 generation 和 realm target-path 换挂失败；三个独立正例可达。

### A-24 fail-fast orchestrator 不知道每个 Phase“应该有哪些步骤”

- **目标位置**：P:38392–38414、38640–38668。
- **最小反例**：从版本化 manifest 删除 `provider-test-account-pool.model`、TUF 或 platform report step。orchestrator 仍会顺序执行剩余 argv，全部 exit 0 后报告 pass；当前规范只定义 fail-fast 行为，没有 canonical expected-step set 与 Definition Complete 的双射。
- **根因级修复**：从 canonical phase/suite 表生成签名 manifest BOM；orchestrator 开始执行前比较 exact phase ID、step ID、argv digest、predecessor、持续启用范围及 Definition Complete coverage。
- **机器验收**：逐个删除、重复、改名、换 argv、调序、提前停用每一步都使顶层非零；每条 Definition Complete 要求必须映射到至少一个不可删除 release step，且无未映射 manifest step。

## B发现

### B-01 BytePlus 把资源 Region ID 当作 DNS label 直接代入

- **目标位置**：P:31971、32232、32430，`WIRE_BYTEPLUS_RESPONSES_V6`。
- **最小反例**：资源 Region ID `ap-southeast-1` 代入模板得到 `https://ark.ap-southeast-1.bytepluses.com`；官方 Base URL 是 `https://ark.ap-southeast.bytepluses.com/api/v3`。[BytePlus ModelArk Region Availability](https://docs.byteplus.com/en/docs/ModelArk/2191806)
- **根因级修复**：用 release-signed `{resourceRegionId, exactOrigin}` 映射替代字符串模板，并绑定 key region、resource region 和 endpoint origin。
- **机器验收**：至少固定 `ap-southeast-1→ark.ap-southeast.bytepluses.com`、`eu-west-1→ark.eu-west.bytepluses.com`；raw ID 直代、未知 region、跨 region key/endpoint 在 secret read/DNS 前失败。

### B-02 graph 派生 UX 上限仍依赖 opaque digest，无法机械重算

- **目标位置**：P:27655–28333，`GaVersionedJourneyGraphUxBudgetInputV5`、`deriveGaJourneyUxLimitsFromVersionedGraphsV5`。
- **最小反例**：deriver只得到 `typedStepActionAndExternalTaskProfilesDigest:string` 和 `anchorPrerequisiteProfiles:ReceiptRef[]`，没有 typed profile 的数值、类别和 conditional expansion；实现可以任意填 `derivedScalarLimits`，外部 verifier 无法从 digest 本身重算。
- **根因级修复**：输入改为版本化、判别型 step/task/anchor profile tuple；算法对实际结构做 total path fold，digest 仅作为派生输出。
- **机器验收**：独立 verifier 从 graph/profile 原始对象重算每条 scalar/per-class limit；修改任一步类别、持续时间、条件分支或 anchor composition 必须得到确定变化；自填更宽上限失败。

### B-03 MFA/SCA 只挂在 login/credential creation，billing activation 和 admin approval 没有条件变体

- **目标位置**：P:29200–29344，`REFERENCE_LOGIN_MFA_VARIANTS_V3` 及 guided/enterprise journey graphs。
- **最小反例**：账号已登录但激活付费时触发银行 SCA，或 enterprise administrator approval 再次要求 MFA。对应 external task 没有 `conditionalNestedExternalTasks`，无法记录 required/absent challenge、返回焦点、耗时和恢复。
- **根因级修复**：把 MFA/SCA 作为适用于每个可触发认证挑战的 external-task profile variant，而不是 login 专属常量。
- **机器验收**：billing activation、admin approval、login、credential creation 分别有 challenge present/absent fixture；required 时恰好一个 nested task，absent 时为 0；取消、失败、leave-return 和恢复进入准确 terminal。

### B-04 相对性能门没有机械约束 current runner/hardware 与 signed baseline 可比

- **目标位置**：P:25307–25414，`TypeContractCompileBaselineReceiptV1`、`TypeContractCompileGateReceiptV1`。
- **最小反例**：baseline 在较慢硬件生成，current 在更快硬件执行；即使类型复杂度和真实耗时回退超过阈值，gate 仍可填 `signedBaselineRegressionOutcome:"pass"`。类型保存两个 runner/hardware digest，却没有 equality、校准或 replacement lineage。
- **根因级修复**：相对门要求 compiler/argv/lock/runner image/hardware profile exact equality；确需换环境时，使用 owner 批准、双环境重叠样本和签名校准 lineage 建立新 baseline。
- **机器验收**：runner、hardware、compiler、argv、lockfile 任一 swap 默认失败；相同环境下超过 RSS/instantiation/source 15% 或 wall 20% 必失败；仅提高 baseline 或换快硬件不能恢复 pass。

## C发现

无。C=0。

## 主流供给/协议/安全/UX/工程覆盖矩阵

| 覆盖域 | 审计结果 | 关联发现 |
|---|---|---|
| receipt/JCS/反序列化 | JCS profile本身未发现独立错误；反序列化 body 类型来源不可信 | A-01 |
| producer DAG、83 authority constituent、post-intent/release | 数量声明为83，但 source lease 类型擦除；plugin admission可重复消费 | A-02、A-03 |
| product/surface/operation/use-case rights | eligibility 与 principal Rights 混用；restriction floor 漏 surface/operation/evaluator | A-05、A-06 |
| credential custody/acquisition/wire/challenge | optional-auth resolver未进入最终发送闭包；Google/Azure acquisition不 exact | A-09、A-16、A-17 |
| funding/billing/unknown metering | unknown rights 与正向 candidate policy binding 可拼接 | A-07 |
| TUF/supply chain | root rotation形状存在，但非-root role watermark不推进 | A-10 |
| proxy/network/data/compute | custom proxy、processor、mTLS、data/compute基础形状未发现独立高置信反例；cleanup缺外部操作authority | A-04 |
| fallback/automatic retry | physical terminal本身禁止 unknown retry，但 route fold可重新标记；side-effect可跨request拼接 | A-12、A-13 |
| official migration | source eligibility、destination claim、realm、generation、expiry没有形成运行时双分支；Hunyuan retain路径不闭合 | A-08 |
| 静态 UI descriptor/动态 capability | 静态 descriptor未发现动态字段污染；domain state可任意投影，capability没有render identity | A-19、A-20 |
| accessibility | pass receipt与失败布尔事实可共存 | A-21 |
| OpenAI Chat/Responses、Anthropic Messages、Gemini API key | 逐 physical-operation wire/auth 抽查未发现独立阻断项 | 无新增 |
| Vertex global/regional、ADC/WIF | inference endpoint形状未发现新增问题；WIF source/STS/impersonation exact flow不闭合 | A-16 |
| Azure key/Entra/SP/Managed Identity | key header与VM/App Service基础 endpoint正确；三条非-key acquisition不完整 | A-17 |
| Bedrock API key/static/role/SSO | Converse、Bearer API key、SigV4基础事实未发现独立反例 | 无新增 |
| BigModel、Kimi Platform/Code、OpenCode | Chat/Messages auth分离和订阅/payg隔离未发现新增高置信反例 | 无新增 |
| TokenHub operation/models双认证、两站realm | models Bearer与Messages `x-api-key`闭合；Chat遗漏流内SSE错误 | A-18 |
| Hunyuan migration-only | requirement标记为 migration-only，但 live destination/retain/sunset决定不闭合 | A-08 |
| LM Studio Messages none/`x-api-key`/Bearer | 73行 oracle组合存在且双header负例有声明；动态 resolution 没有强制 consumer | A-09 |
| CC Switch、LiteLLM、local runtime | 基础 wire/auth/realm抽查未发现新事实错误；optional-auth世代绑定仍受A-09影响 | A-09 |
| custom Base URL/relative path/三协议×auth×mTLS | RFC 3986 directory语义、relative path及正交认证矩阵未发现独立高置信反例 | 无新增 |
| 自动发现、主动配置、被动提示、automatic零主动作 | 自动状态零主动作声明基本闭合；render capability、MFA和graph UX oracle不闭合 | A-20、B-02、B-03 |
| deterministic/live qualification与账号池 | 73行 deterministic 形状存在；live lease crash和cleanup authority不闭合 | A-04、A-14 |
| legacy JSON/SQLite五态和逐kill-point恢复 | 可跳过cutover前置；缺 operation×kill exact oracle | A-15 |
| 三平台helper/installer、三realm witness | helper qualification可自填；realm部署缺pairwise independence | A-22、A-23 |
| 四槽 review-ready | 四槽 tuple形状存在，但任意receipt可投影review-ready且producer不deep-frozen | A-19 |
| Connector SDK、第三方Execution、registry开源扩展 | protocol core存在；plugin implementation/activation/release证明链可结构性伪造 | A-22 |
| 四类发布产物与owner support claim | support page/picker/test matrix/release note接口存在，但生成、owner批准和release binding缺唯一可信producer | A-22 |
| strict编译与相对性能回退 | absolute数字明确；环境可比性未机械闭合 | B-04 |
| fail-fast Phase门与Definition Complete | fail-fast执行语义存在；删除manifest步骤仍可全绿 | A-24 |
| 当前生产代码/canonical | 确认仍是旧硬编码 provider/runtime-child 基线；未以“尚未实施”计缺陷 | 不计数 |

## A/B/C精确计数

| 等级 | 数量 |
|---|---:|
| A | 24 |
| B | 4 |
| C | 0 |
| 总计 | 28 |

# FAIL