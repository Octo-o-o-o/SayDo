# AI 供给生态与零配置体验终审 v16

## 结论

`FAIL`

- A：4
- B：1
- C：0
- 放行条件：A=0 且 B=0；当前不满足。

冻结方案已经把 73 行、公开 claim、live qualification、UX 事件和发行物绑定做得很深，但仍存在四个 release-blocking 根因：云身份/PKCE 的“精确认证 oracle”与真实凭据取得协议不一致；rights 迁移目的地可以跨产品/realm 换挂；静态 UI registry 内嵌了逐会话、一次性动作能力；旧 Hunyuan 的 migration-only 行仍被机械展开为 fresh guided-key 旅程。另有一个 optional-auth 的重要类型闭包缺口。

## 冻结身份与审查边界

实测目标：

```text
path   docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
sha256 8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da
lines  36595
bytes  2340853
git    ??（目标在当前 worktree 中未跟踪，但内容身份与冻结值逐项一致）
```

身份核对原始输出：

```text
8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
   36595 2340853 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

审查只读取指定 prompt、冻结目标、相关 canonical、当前仓库只读状态，以及必要的一手官方资料；未读取其他 prompt、`research/codex-findings/` 既有内容、`history/` 或旧评审报告。唯一写入是本报告。

全文按字节读取；目标中的 11 个 TypeScript 合同块合并后，以 TypeScript 5.9.3、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、ES2023/NodeNext、`noEmit` 做了真实语义编译：

```json
{"typescript":"5.9.3","blocks":11,"sourceLines":33705,"sourceBytes":1672600,"diagnostics":0}
```

随后追加 8 个只读审计断言，验证下述异常形状确实属于当前类型系统可接受形状：

```json
{"typescript":"5.9.3","tsBlocks":11,"appendedAuditAssertions":8,"diagnostics":0}
```

这两个结果只证明合同能编译；后面的反例证明“零 diagnostics”没有封闭事实错误和证据换挂。

## 十二项覆盖判定

1. `[fail]` 产品、surface、rights、协议、key namespace 与资金在 73 行及生态表中大体分开；但 `OfficialApiMigrationJourneyReceipt` 的目的产品/claim/realm 不依赖源产品，Kimi blocked source 可以接受 OpenAI destination，破坏同产品 rights 分界，见 A-02。
2. `[fail]` Chat、Responses、Messages、Gemini、Vertex global/regional、Bedrock、BigModel、Kimi、TokenHub 与 custom Base URL 的业务 wire 多数有逐行 oracle；但 WIF、Azure Managed Identity、OpenRouter PKCE 的凭据取得 oracle 与官方协议矛盾，见 A-01。
3. `[ok]` TokenHub 两站业务/模型认证与 fallback identity 已准确拆开：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:30194`、`:30199`、`:30287`、`:30315`、`:30654`；Kimi Code 的业务请求绑定真实 SayDo 签名发行物 User-Agent 并禁止冒充，见 `:28826`、`:30299`、`:30675`。
4. `[fail]` 中国大陆、全球 API、订阅、bridge 和 inventory 覆盖面充分，One API/New API 等也未冒充正式 minimum；但旧 Hunyuan 的 machine row、旅程和公开 claim 自相矛盾，见 A-04。
5. `[ok]` Ollama、LM Studio、oMLX、Docker Model Runner、Podman AI Lab 是分协议 formal rows；llama.cpp、vLLM、SGLang、LocalAI、Jan、Xinference、TGI、Foundry Local、Apple Foundation Models 保持 inventory/后续专用 runtime 边界。loopback、LAN/cloud compute、可选 auth、冷态与高影响动作也有独立约束，见 `:29946`、`:29955`、`:33951`、`:33981`、`:34763`、`:34777`。
6. `[fail]` 8 个 conditional field binding 确实从 row recipe/graph 派生，但 optional-auth resolver 丢失 challenge discriminant、准确 field tuple 与 endpoint/generation 等式，错误 branch/cross-row receipt 仍可进入提交边界，见 B-01。
7. `[ok]` OpenCode Go 的 Go-only 与 Zen balance overage、TokenHub free-only/free-then-payg/plan/reserved/dedicated 由独立 funding variant 和 release closure 承载，见 `:28961`、`:29025`、`:29094`、`:29123`、`:33025`。
8. `[ok]` CC Switch 仅承诺公开 loopback Anthropic Messages opaque proxy；不读私有 Tauri/SQLite，不承诺 route pin/control，并要求未来 control 另增 row，见 `:30217`、`:33984`、`:33991`、`:34781`。
9. `[fail]` static/passive/explicit-active discovery 边界及 automatic state 无 primary action 的 registry 形状已建立；但用户动作把一次性、逐会话 capability 固化进全局 state registry，不能保证每次提示只有一个当前可执行动作，见 A-03。
10. `[fail]` rights destination 类型未封闭同产品/realm，且所有 user-required/terminal 动作的 session/nonce/generation 生命周期被静态 registry 破坏，见 A-02、A-03。
11. `[fail]` 73 行、claim set、支持页、picker、测试矩阵、release note 和 distribution 的双射合同存在；但 migration-only Hunyuan 被同一 deriver 展开为 fresh user runs，导致 machine truth、公开 availability 和 release evidence 无法同时为真，见 A-04。
12. `[fail]` 双 locale、pseudo locale、desktop light/dark、mobile paper、账号池、双周期 live qualification、预算/cleanup/reset 等均有显式合同；但 required cartesian run set 包含被禁止的 Hunyuan fresh flow，且动作模型接受跨会话执行，整套确定性验收仍不可重复闭合，见 A-03、A-04。

## A-01 精确认证 oracle 没有绑定真实凭据取得协议

级别：A

### 准确锚点

- WIF profile 把唯一的 provider/STS audience 写成带 `https://` 的模板：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2045`、`:2061`；`ReferenceExactAuthFlowV7` 与固定 `AUTH_VERTEX_WIF_V7` 重复该值，见 `:28764`、`:28772`、`:30242`、`:30252`。
- Azure Managed Identity 的 workload metadata 分支明确是 `azure_managed_identity_credential_get`，见 `:2298`、`:2304`、`:2331`、`:2336`；但其 exact auth oracle 又强制 `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`，见 `:28784`、`:28793`、`:30263`、`:30265`。
- `azure.managed-identity` 同时声明 `platformScope:"all_desktop"`，见 `:29907`；而 `all_desktop` 被展开为 macOS/Linux/Windows，见 `:30405`、`:30408`。
- OpenRouter PKCE 是 L0 `builtin_stable` row，见 `:29913`；但它复用 `STATIC_REQUEST_CREDENTIAL_FLOW_V7`，该 flow 声明 `tokenExchangeNetworkRequest:"not_applicable"`，见 `:30082`、`:30086`、`:30280`。
- 方案的官方证据基线没有 Google WIF/STS 或 Azure Managed Identity 的精确凭据取得资料；现有 Vertex/Azure链接只覆盖最终推理 API，见 `:35961`、`:35962`。

一手事实：

- Google 的 [deployment pipeline WIF 配置](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) 把外部账号配置的 `audience` 写为 `//iam.googleapis.com/projects/...`，而 IdP token 自身的 `aud` 才使用 `https://iam.googleapis.com/...`；两者不是同一个字段。
- Google 的 [AWS/Azure WIF STS 示例](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-clouds) 明确要求 STS 请求 `audience=//iam.googleapis.com/...`，并明确说明该 audience 不得含 `https:` scheme。
- Microsoft 的 [Managed Identity VM 协议](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-managed-identities-work-vm) 要求客户端向本机 `http://169.254.169.254/metadata/identity/oauth2/token` 取 token，而不是向 tenant `/oauth2/v2.0/token` 直接提交无凭据请求。
- OpenRouter 的 [OAuth PKCE 官方流程](https://openrouter.ai/docs/guides/overview/auth/oauth) 要求浏览器返回 code 后真实 `POST https://openrouter.ai/api/v1/auth/keys` 交换用户控制 API key。

只读类型断言实测还确认：Azure MI oracle 固定 tenant endpoint、Azure MI 被要求生成 macOS run、OpenRouter PKCE 声称无 exchange，这三个断言同时 `diagnostics:0`：

```json
{"typescript":"5.9.3","assertions":["azure MI tenant endpoint","azure MI macOS required run","OpenRouter PKCE no exchange"],"diagnostics":0}
```

### 真实用户反例

1. 用户导入标准 Google `external_account` WIF 文件。SayDo 若把合同唯一的 `https://iam...` audience 放进 STS exchange，STS 拒绝；若自行改用 `//iam...`，则实际请求不再符合 signed exact auth oracle，发布证据失真。
2. 用户在 Azure VM 上选择 Managed Identity。若按 exact oracle 请求 tenant token endpoint，没有 client credential，认证失败；若按 metadata 分支调用 IMDS，又与 exact oracle 的 endpoint/flow 不一致。macOS required run 更没有可用的本机 Azure MI endpoint。
3. OpenRouter 用户完成浏览器授权并返回 code。oracle 声称无需 exchange，因此既拿不到新 key，也无法完成 `key_committed`；私下调用 `/api/v1/auth/keys` 又绕过逐物理请求 oracle 和 release claim。

### 根因修复

把“最终业务请求 auth header”与“credential acquisition/exchange graph”拆成两个都必须存在的判别合同，并由 row semantic compiler 一起绑定：

- WIF 同时表示 `subjectTokenAudience` 与 `stsExchangeAudience`，后者精确为 `//iam.googleapis.com/...`；从经过验证的 `external_account` profile 读取 `token_url`、`subject_token_type`、credential source 和可选 impersonation，不手拼一个通用 JWT flow。
- Azure MI 单独建 VM IMDS、App Service `IDENTITY_ENDPOINT` 等受支持 source profile；该 branch 的 tenant token endpoint 必须为 `never`，资源 audience/query/header 由 source profile 决定。把平台范围改成真实 Azure-hosted runtime 范围，不生成 macOS desktop 正向 run。
- OpenRouter 建独立 `api_key_pkce_exchange` operation graph，固定 authorize URL、callback/state/verifier 和 `POST /api/v1/auth/keys`，并与既有 key-family winner/recovery cursor 及最终 Bearer 使用绑定。
- 每一条 acquisition physical request 都进入 exact operation graph、endpoint identity、send intent/terminal、evidence lock 和 published claim digest。

### 可机械验收

1. 从官方示例生成 WIF、Azure VM MI、OpenRouter PKCE golden captures；逐 method/origin/path/query/header/body 编译为 exact physical operation graph。
2. mutation 必须拒绝：STS audience 带 `https://`、把 IdP `aud` 与 STS audience 对调、MI 走 tenant token endpoint、macOS 伪造 MI positive run、PKCE 无 exchange/错 verifier/错 exchange recipient。
3. `vertex.wif`、`azure.managed-identity`、`openrouter.pkce-key` 的 required live journey 分别使用真实发行物跑两周期；报告绑定同一 acquisition graph 和最终 API graph。
4. 增加编译期反例，确保本次三个 `diagnostics:0` 断言转为预期编译失败。

## A-02 Rights 官方 API 迁移目的地可以跨产品和 realm 换挂

级别：A

### 准确锚点

- `OfficialApiMigrationJourneyReceipt<P,S>` 的源产品受 `P` 约束，但 `destinationEntryKey`、`destinationProviderProductId`、`destinationPublishedClaim`、`destinationJourneyAndAuthQualification`、`destinationRealm` 和 `protocolProfile` 都是宽类型，见 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:34073`、`:34100`。
- `commitOfficialApiMigrationJourneyV7` 直接接受上述宽字段；`provesClaimProductRealmProtocolAndQualifiedJourneyEqualTheExactDestination:true` 只是调用者可填写的布尔量，不是编译器产生的关系收据，见 `:34123`、`:34137`。
- 后续 resolver 只保证外层 destination receipt 使用相同 `P,S`，没有重新证明 receipt 内部的 destination claim/realm/product 与 `P` 的允许迁移关系，见 `:34166`、`:34199`。
- state map 又把 rights action 泛型扩大为 `RightsBlockedPrimaryActionReceipt<string,...>`，见 `:34356`、`:34363`。

实测反例把 source 写为 `kimi-code-membership`，destination 写为 `openai-platform`，并注入一个宽 `PublishedSupportClaimV6`；当前合同完整编译通过：

```json
{"typescript":"5.9.3","witness":"Kimi rights source -> OpenAI destination","diagnostics":0}
```

### 真实用户反例

用户的 Kimi Code 会员 entitlement 被判 `forbidden`。UI 显示“切换到官方 API”，但 committed destination 实际指向 OpenAI Platform 的 claim、realm 和 onboarding journey。类型和 receipt constructor 都接受；用户既没有回到同产品官方 API，也无法从文案判断已经跨供应商，rights、费用和数据地域全部变了。

### 根因修复

- 新增固定、签名、版本化的 `OfficialMigrationDestinationMap<SourceProduct,SourceRightsState>`；每个源产品只能解析到同 provider/product family 的已发布官方 API row，或明确 absence。
- destination 类型直接携带 `PublishedProductProtocolClaimForRowV6<DestinationRow,D>`、该 row 精确 realm、协议、auth journey 与 release gate；不再用 `string`、宽 union 和自报 `true` 表示相等。
- destination compiler receipt 的 canonical subject 必须包含源 rights receipt、源 product/realm、目的 row/claim/realm、generation、expiry 和发行物；resolver 只能消费这份 branded relationship receipt。
- `SupplyPrimaryActionStateMapV7`、domain subject/event、view model 全程保留 `P,S,D`，不得在 registry 边界扩大成 `string`。

### 可机械验收

1. TypeScript negative fixtures：Kimi→OpenAI、同品牌错 realm、错 edition、过期 claim、错发行物、official destination 与 journey row 不同，全部 `@ts-expect-error` 且运行时 mutation 也拒绝。
2. 对 73 行和 inventory source 生成 source→destination/absence 的 exact total map；每个 blocked source 恰有一个可执行 destination 或一个权威 absence proof。
3. UI E2E 从 `rights_unknown`/`rights_forbidden` 点击后，核对源产品、目的产品 family、realm、claim、journey、generation、expiry 与回返 state digest；任何字段换挂，点击前 fail closed。

## A-03 静态状态 registry 内嵌逐会话、一次性动作能力

级别：A

### 准确锚点

- `LocalControlSessionReceipt` 绑定 OS principal、local user session、daemon、origin/host/channel、创建与过期时间，见 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:7904`。
- 每个 `SupplyExecutablePrimaryActionDestinationV7` 内嵌具体 `LocalControlSessionReceipt`、`singleUseActionNonceDigest`、`hardStopGeneration` 与 `expiresAt`，见 `:34306`、`:34324`。
- 这些动态对象却被放进一个全局 `SUPPLY_VIEW_PRIMARY_ACTIONS_V7`，再嵌入模块级 `SUPPLY_VIEW_STATE_REGISTRY_V6`，并整体 commit 为 registry artifact，见 `:34380`、`:34433`、`:34457`、`:34463`。
- `SupplyViewModelForStateV7` 直接等于静态 registry row；reducer 没有按 domain subject/session 物化新 action，见 `:34576`、`:34591`。
- `executeSupplyViewPrimaryActionV7` 另收一个当前 `localControlSession`，但类型没有要求它等于 view model destination 内嵌 session，也没有把 generation/expiry evidence 与该 destination 相关联，见 `:34593`、`:34603`。

真实只读编译见证：把 session A 的 login view model 与 session B 的 `LocalControlSessionReceipt` 一起传入 execute，当前类型系统接受：

```json
{"typescript":"5.9.3","witness":"session-A view model + session-B control receipt","diagnostics":0}
```

### 真实用户反例

同一 daemon 上，用户 A 打开“登录”卡后，registry 中动作带着 A 的 session 和一次性 nonce。用户 B 随后进入同一状态，拿到同一静态动作：要么 B 点击时因 session/expiry/nonce 不匹配而永远失败；要么执行器只看单独传入的 B session，从而把 A 的 subject/route/nonce 与 B 的授权混用。即使只有一个用户，刷新、重连或第一次消费 nonce 后，静态 registry 也只能继续给出过期/已消费动作。

### 根因修复

- 静态 registry 只保存 action descriptor/factory schema：state、action ID、label key、destination kind、handler schema，不保存任何 receipt、session、subject、nonce、generation 或 expiry。
- domain reducer 针对每个 candidate/solution/authorization subject 和当前 `LocalControlSessionReceipt` 动态 commit fresh destination/action；view model 泛型同时携带 subject ID、session ID、generation 与 nonce。
- execute 输入使用同一个 dependent generic/opaque capability，不能再把 view action和另一个任意 session receipt并列传入；单次消费结果 CAS 绑定 exact nonce、subject、session、generation。
- rights actions也走相同动态 capability factory，而不是作为宽类型静态例外。

### 可机械验收

1. 编译期 negative fixtures：session A view + session B、candidate A action + candidate B、stale generation、expired action、已消费 nonce，全部不可构造。
2. 两用户/两窗口 E2E 并发进入同一 state，每个动作的 subject/session/nonce 均不同；A 的点击不能影响 B。
3. 对每个 user-required/terminal state执行 refresh、daemon restart、nonce replay、expiry boundary；旧动作 fail closed，新 render 自动得到 fresh 动作。
4. 静态 registry 的序列化快照中，程序化断言 `ReceiptRef`、session、nonce、generation、expiry occurrence 都为 0。

## A-04 Hunyuan migration-only 行仍被展开为 fresh guided-key 旅程

级别：A

### 准确锚点

- 类型映射把 `hunyuan.cn` 标为 `existing_connection_migration_only`，见 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:29186`、`:29189`。
- 同一 row 却仍是 `journeyTier:"guided_key"`、`onboardingRecipe:RECIPE_GUIDED_KEY_V1`、`releaseMaturity:"builtin_stable"`，见 `:29942`。
- guided-key graph 的 starting states 包含 `no_account`，且明确执行 create account、billing、create provider credential，见 `:27549`、`:27577`。
- `deriveReferenceRequirementsV4` 无条件从 recipe 复制 `requiredStartingAccountStates` 与 `journeyGraph`；`onboardingAvailability` 只是另一个并列字段，见 `:29870`、`:29893`。
- user run subject 按 row 的 starting account state 构造，随后 deriver 声称对 requirement/platform/locale/anchor/account state 做精确笛卡尔积，见 `:30418`、`:30440`、`:30552`、`:30595`。
- 公开 claim 虽携带 availability，却仍要求 completed journey evidence 并固定 `claimStatus:"released_and_evidence_bound"`，见 `:33064`、`:33104`。
- 方案 prose 同时明确“禁止 fresh journey”和“新建连接不可选择旧入口”，见 `:33829`、`:34698`。

追加类型断言同时证明以下三件事，仍为 `diagnostics:0`：

```text
hunyuan.cn onboardingAvailability = existing_connection_migration_only
hunyuan.cn requiredStartingAccountStates includes no_account
hunyuan.cn onboardingRecipe.recipeClass = guided_static_key
```

### 真实用户反例

新用户没有旧 Hunyuan 连接。required journey 却要求从 `no_account` 出发创建账号、开通计费、创建 key 并做 live activation；这与产品 UI“旧入口不可新建”冲突。若测试遵守 migration-only，GA exact cartesian run 永远缺项；若测试按 graph 完成，则产品实际重新开放了被明确禁止的 fresh connector。两条路径都不能生成诚实的 73-row release claim。

### 根因修复

- 建立判别式 migration-only requirement/recipe：starting state 只能是例如 `existing_connection_present`，输入只能来自只读旧连接元数据/既有 broker handle；graph 只允许 inspect→validate existing→offer TokenHub migration→retire/retain read-only，不含 account creation、billing activation、credential creation 或 fresh picker。
- `deriveReferenceRequirementsV4`、run subject deriver、live qualification、claim publisher 与 picker generator 都必须按 `onboardingAvailability` 分支；migration-only 不进入 fresh account-state cartesian set。
- 公开 claim 将“可迁移既有连接”作为独立 disclosure class，不得以普通 builtin stable fresh support 展示。

### 可机械验收

1. 类型不变量：`existing_connection_migration_only` 与 `no_account`、`guided_static_key`、create-account/create-credential step、fresh picker CTA 两两互斥。
2. Hunyuan 正向 fixture 只从真实既有连接开始；无旧连接时产生权威 `not_applicable_no_existing_connection` terminal，而不是 pass 或引导开新 key。
3. support page/picker/release note DOM fixture 均不存在 fresh Hunyuan 按钮；仅在发现既有连接后显示一次迁移动作。
4. 重新计算 exact run counts、73-row claim set 和 release gate，证明没有靠跳过 expected run 关门。

## B-01 Optional-auth resolver 丢失 challenge 与字段的依赖关系

级别：B

### 准确锚点

- challenge receipt 对 OpenCode/LM Studio/LiteLLM 的 observed scheme 有正确条件类型，见 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28393`、`:28406`。
- `ResolvedOptionalServerAuthReceiptV6` 的 `selectedScheme` union 与 `challengeEvidence.observedScheme` 没有分支依赖；Basic branch 内的 evidence 仍是 `none | http_basic`，Bearer branch 仍是 `none | authorization_bearer`，见 `:28408`、`:28452`。
- resolver 输入把 conditional field events 降为 `readonly ReceiptRef[]`，credential principal 也只是宽 `ReceiptRef`，见 `:28454`、`:28460`。
- 虽然 row recipe 派生了准确的 8 个 binding 和正负 fixture，见 `:26128`、`:26258`，该 dependent binding 没有进入 resolver 的参数或返回类型。

审计断言证明 Basic 返回 branch 的 challenge evidence 仍可为 `none`，TypeScript 5.9.3 下 `diagnostics:0`。

### 真实用户反例

OpenCode Server 的 credential-free probe 返回 `none`，但 resolver 仍可提交 `selectedScheme:"http_basic"` 并消费任意宽 field receipt；反向也可以在 `password_required` 时选择 none。LM Studio/LiteLLM 同样可把 no-auth observation 与 Bearer secret 组合。结果要么认证失败，要么把本不需要的 secret 发给当前本机进程；cross-row/cross-run field receipt 在 resolver 边界也没有类型阻拦。

### 根因修复

- 让返回类型分发于具体 `challengeEvidence`：`selectedScheme` 必须精确等于 `E["observedScheme"]`。
- resolver 输入使用从 `ReferenceConditionalRecipeFieldBindingForRequirementV7<K>` 派生的 exact tuple；none branch 强制空 tuple和零 credential，Basic/Bearer branch 强制对应 positive observation、字段、endpoint/process/generation 和 secret principal/version。
- 把 challenge、field events、endpoint、process generation、credential recipient 组成一个 branded resolver subject，由唯一 producer commit，不能靠宽 `ReceiptRef[]` 和自报证明。

### 可机械验收

1. 编译期拒绝 none→Basic、none→Bearer、required→none、错 field ID、错 discriminator、cross-row、cross-run、cross-endpoint/process-generation。
2. 每个 OpenCode 2 分支、LM Studio 三协议各 2 分支、LiteLLM 三协议各 2 分支跑 positive/negative live fixture。
3. mutation gate 核对零 challenge 时 application credential byte count 为 0；required challenge 时缺一个准确 field 就不能进入 staged conformance。

## 正向复核摘要

以下闭包未发现新的 A/B：

- 73 个 fixed requirement key 数量为 73，且 11 个 TypeScript 块在当前冻结文件上零 diagnostics。
- TokenHub 广州/新加坡 Chat、Responses、Messages 的站点、业务 auth、models Bearer 与官方 fallback origin 分开，fallback 强制新 endpoint identity/physical lease。
- Kimi Platform、Kimi Code inference、Kimi Server/ACP；OpenCode Zen、Go、Server、ACP；Codex App Server；BigModel/Z.AI 等没有在 fixed rows 中合并 product/key namespace。
- OpenCode Server 的公开 `POST /session/{sessionId}/message`、默认 Basic username `opencode`；Gemini `x-goog-api-key`、Vertex global/regional origin、Bedrock SigV4/Converse stream、BigModel Chat/Messages、Kimi Code Chat/Messages 的业务 wire 与查到的一手资料一致。
- CC Switch Desktop 只作为公开 Messages opaque proxy，未来 control profile 必须另增 row。
- funding variants、owner append-only namespace、support claim 四件套与 distribution binding 的总体设计方向成立；本报告没有把“尚未施工”本身计为缺陷。

## 落盘后复核

- 定向运行 `bash scripts/check-emoji.sh research/codex-findings/153-ai-supply-ecosystem-ux-final-closure-v16.md`，原始结果为 `[ok] emoji gate: clean`，退出码 0。
- 再次核对目标仍为 SHA-256 `8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da`、36595 行、2340853 bytes；与审查开始时及 prompt 冻结身份完全一致。
- 本轮没有修改目标、生产代码或 canonical。

## 最终判定

`FAIL — A=4, B=1, C=0`

只有 A-01 至 A-04 和 B-01 的根因修复全部完成，并按各自机械验收重跑到 A=0、B=0，才可对该冻结方案给出 `PASS`。
