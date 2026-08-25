# SayDo AI 供给生态与零配置体验终审 v15

## 1. 冻结身份与审查边界

- 审查目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 审查前 SHA-256：`7fbc0a8ba767d90d84e26a49f83a357d57c5a269f1cf0c43b54c2e6a4d832967`
- 审查前行数：`33210`
- 审查前字节数：`2146263`
- 当前代码基线：`174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`
- 身份核对命令与原始输出：

```text
$ shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
7fbc0a8ba767d90d84e26a49f83a357d57c5a269f1cf0c43b54c2e6a4d832967  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

$ wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
   33210 2146263 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

$ git rev-parse HEAD
174ab48895aa1e4a6c6b42b9c74187f20efc3cfd
```

我完整读取了上述 33210 行冻结目标，并按需读取当前实现与 canonical。审查没有读取 `prompts/`、`research/codex-findings/` 内的旧报告、`history/` 或其他旧评审。除本报告外没有写入任何文件；未修改目标、生产代码或 canonical。外部事实只使用厂商当前一手资料。

本报告评的是方案在完成施工后是否事实准确、旅程可执行、合同自洽且可机械验收。当前尚未施工的功能本身不计为缺陷。

## 2. 最终结论

**FAIL**

| 级别 | 数量 | 判定 |
|---|---:|---|
| A | 3 | 存在必测 row 无法构造诚实 exact evidence 或官方认证请求的阻断 |
| B | 2 | 存在官方有效配置不可用或重要厂商请求约束不能从同源 oracle 验收的问题 |
| C | 0 | 无 |

按终审规则，A/B 任一非零即 FAIL。本轮不是因为功能尚未施工而失败，而是冻结目标自身仍有类型不可达、exact oracle 降格和官方协议事实错误。

## 3. 覆盖判定

### 3.1 已逐项覆盖

- 中国与全球供给：CLI、API、订阅、Coding Plan、官方与第三方 API、网关、本地 runtime。
- 具名产品：BigModel/Z.AI、Kimi Platform/Code/Server、OpenCode Zen/Go/Server/ACP、Codex、Claude、Gemini、Qwen、Cursor、Grok、Copilot。
- 协议面：OpenAI Chat Completions、OpenAI Responses、Anthropic Messages、Google GenAI、Azure、Vertex、Bedrock 与 custom exact wire。
- 中国与全球网关/API：DeepSeek、百炼、方舟、BytePlus、千帆、硅基流动、MiniMax、TokenHub、OpenRouter、LiteLLM、CC Switch、One API、New API。
- 本地运行时：Ollama、LM Studio、oMLX、Docker Model Runner、Podman AI Lab、llama.cpp、vLLM、SGLang、LocalAI、Jan、Xinference、TGI、Foundry Local、Apple Foundation Models。
- 体验与发布：自动检测、主动配置、被动提示、逐 row recovery、条件 MFA、optional auth、automatic 零主动作、真实账号起点与 principal/MFA/admin set-cover、cleanup retry、desktop light/dark、mobile paper，以及非技术用户首用文案与单一主动作。

### 3.2 机械覆盖核对

- `REFERENCE_REQUIREMENT_INPUTS_V3` 为精确 73 行；`REFERENCE_EXACT_CONNECTION_ORACLE_V6` 也为精确 73 个 key，无缺失、重复或额外 key。
- surface 分布为 inference 63、execution 5、bridge 4、control_plane 1。
- 四类公开产物精确为 `support_page`、`connection_picker`、`test_matrix`、`release_note`，并绑定同一 claim-set digest。
- custom 矩阵明确覆盖三协议乘四种 application auth 乘两种 mTLS 状态；五条具名 custom row 仅作为代表性发布 fixture。
- OpenCode Go 的 `go_limit_only` 与 `go_plus_zen_balance` 资金分支已分离；Go 转 Zen balance 需要新资金决策。
- TokenHub `tokenhub_free_only` 明确要求 `paymentEnabled:false` 且免费额度耗尽后在付费发送前停止。
- CC Switch 仅声明签名 desktop 的公开 loopback Anthropic Messages opaque proxy：`127.0.0.1:15721`、`POST /v1/messages`、route/failover/funding opaque、每次主动确认；未扩张 control、自动推荐、fallback、evaluator、tool 或 background 能力。
- safe custom base、协议乘 application auth 乘 mTLS、真实账号排他 lease、MFA attendance、admin 维度、cleanup retry/quarantine、两轮 release set-cover、desktop light/dark 与 mobile paper 的可访问性矩阵均已有明确合同和门禁。
- local ready 的 automatic 步骤无 `primaryActionId`；负向 runtime state 走独立 recovery graph，不把恢复动作伪装成零配置通过。

上述通过项不能抵消以下 A/B 级发现。

## 4. A 级发现

### A-01 条件认证字段的 typed event 联合无法表示 LM Studio Bearer 与 OpenCode username

**准确锚点**

- 第 24107-24118 行的 `GaConditionalRecipeFieldObservationReceiptV1` 把 `conditionalFieldId` 限死为 `"server_password" | "api_key"`，把 `discriminator` 限死为 `"password_required" | "secret_required"`，并且负态只有 `no_password_required | no_secret_required`。
- 第 24196-24199 行的 `manual_field_committed` 条件分支再次把正态限死为 `password_required | secret_required`。
- 第 25646 行的 LM Studio journey graph 实际使用 `challengeDiscriminator:"bearer_required"`。
- 第 27043 行的 OpenCode Server recipe 要求在 `password_required` 时提交 `server_username`；第 27064 行的 LM Studio recipe 要求在 `bearer_required` 时提交 `api_key`。
- 第 32323 行要求 required/conditional field ID 事件无漏无重；第 32361 行要求 recipe 条件成立时恰有一个 typed event、条件不成立时为零，并让 OpenCode 与 LM Studio 通过 requirement 到 ecosystem gate 的完整链。

**真实用户反例**

1. 用户在 LM Studio 0.4+ 打开 Require Authentication。官方要求每个请求发送 `Authorization: Bearer <token>`；未打开时默认无认证。[LM Studio Authentication](https://lmstudio.ai/docs/developer/core/authentication)
2. journey 正确观察到 `bearer_required` 后，producer 必须为 `api_key` 生成条件字段观察与提交事件。但冻结联合不接受 `bearer_required`，也没有 `no_bearer_required`。如果改填 `secret_required`，又与 graph 的 exact discriminator 不相等。因此 LM Studio 三条 required row 的认证开启与关闭 fixture 都不能产生合法且诚实的事件集。
3. 用户给 OpenCode Server 设置 `OPENCODE_SERVER_PASSWORD`，并把用户名从默认 `opencode` 改为组织用户名。官方明确支持该 Basic username/password 组合。[OpenCode Server](https://dev.opencode.ai/docs/server/)
4. recipe 同时要求 `server_username` 与 `server_password`，但观察 receipt 不能把 `server_username` 作为 `conditionalFieldId`。缺字段会违反 exact recipe，伪用 `server_password` receipt 又会违反 field ID 双射。

**根因与修复**

条件字段 evidence 被手写成只覆盖旧的 password/secret 两种情况，而 graph、recipe 与 optional-auth policy 已扩到 Basic 和 Bearer。不要继续扩一个彼此独立的字符串联合；应由当前 requirement 的 recipe `requiredWhen` 与 graph challenge 定义生成映射型 discriminated union，并把以下值作为同一编译源：

- `observationStepId`
- `fieldId`
- 正向 discriminator
- 与该 discriminator 对应的负向 state
- `fieldMustBeCommittedBeforeValidation` 或 `fieldMustBeAbsent`

至少必须能精确表示 OpenCode 的 `server_username/server_password + password_required/no_password_required`，以及 LM Studio 的 `api_key + bearer_required/no_bearer_required`。LiteLLM 的 secret 分支不能被破坏。

**机器验收**

1. 增加编译期全量断言：73 行每个 `requiredWhen` tuple 都能由条件观察 receipt 精确表示，且 receipt 可表示的 tuple 集合与 recipe/graph 派生集合完全相等。
2. LM Studio Chat/Responses/Messages 各运行认证关闭与 Bearer 开启两个 golden；OpenCode Server 运行无密码、默认用户名密码、自定义用户名密码三个 golden。
3. 对每个 golden 做漏字段、重复字段、错 field ID、错 discriminator、正负态互换、跨 row/step receipt 换挂 mutation，全部必须非零。
4. 保持 `realm-and-ga-binding.tck` 对实际 typed event reducer 的验证，禁止用测试侧字符串特判绕开合同。

### A-02 TokenHub Messages 的业务请求与模型目录需要不同认证，但 V6 exact oracle 只有一份 row 级 auth

**准确锚点**

- 第 26369 行开始的 `ReferenceProviderWireProfileForRequirementV5` 已知道 TokenHub 需要独立 `modelsWireAuth: authorization_bearer`，但该 V5 类型只在此定义，未进入最终 row 派生。
- 第 26465-26483 行的 active `ReferenceExactWirePolicyV6` 把 `modelsRequest` 仅建模为 method/path，没有目录请求自己的 auth/header policy。
- 第 26582-26591 行的 `ReferenceExactConnectionOracleEntryV6` 每个 requirement 只有一个 `auth`。
- 第 27496 行明确把最终 `providerWireProfile` 派生自 V6 `connectionOracle.wire`，不是上述 V5 profile。
- 第 27701、27704 行的 TokenHub 广州/新加坡 Messages wire 从 Anthropic wire 继承 `GET /v1/models`；第 27787、27790 行则把两个 row 的唯一 auth 固定为 `x-api-key`。
- 第 31783、32316、32349 行又明确要求：Messages 业务请求发送 `x-api-key`，`GET /v1/models` 始终发送 Bearer，并从 73 行 exact oracle 生成回归测试。

**真实用户反例**

腾讯云当前一手文档明确规定：TokenHub 的 `GET /v1/models` 使用 `Authorization: Bearer <API KEY>`；Anthropic `POST /v1/messages` 使用 `x-api-key` 和 `anthropic-version`。[TokenHub API 使用说明](https://cloud.tencent.com/document/product/1823/130078)、[TokenHub Anthropic Messages](https://cloud.tencent.com/document/product/1823/135874)

对于 `tokenhub.gz.messages`：

- 若 producer 按 row 唯一 auth 生成所有请求，模型目录会错误发送 `x-api-key`，官方返回 401。
- 若 producer 在目录请求里硬编码 Bearer，则该 header 不在 V6 exact oracle 中，`provider-wire-auth-regression.tck` 无法从同源 oracle 证明或 mutation 它；四类公开 claim 可以在目录认证回归时继续假通过。

新加坡 Messages row 同样不可达。这不是施工缺口，而是冻结 exact schema 无法表达它自己声称必须验收的请求。

**根因与修复**

V6 将 operation auth 误提升为整条 connection 的唯一 auth，丢掉了 V5 已有的 per-operation auth 区分。应让每个物理 request operation 携带自己的 exact request profile，例如：

- `operationRequest.authProfile`
- `modelsRequest.authProfile`
- 各自公开常量 header 与 credential recipient
- 二者绑定同一 site key version、site realm 与 endpoint identity，但不强迫 header scheme 相同

TokenHub Messages 的 operation profile 固定 `x-api-key`，models profile 固定 `Authorization: Bearer`；Chat/Responses 两个 profile都可为 Bearer。删除或迁移未参与最终派生的 V5 死声明，避免形成第二真相源。

**机器验收**

1. 广州/新加坡各跑 Chat、Responses、Messages 的业务请求与 models 请求 exact golden；Messages golden 必须出现两种不同 header scheme。
2. 对 models 请求做 `Bearer -> x-api-key`、漏 header、双 header、站点 key 互换、主/备用 origin identity 复用 mutation，均在发送前失败。
3. 对 Messages operation 做 `x-api-key -> Bearer` mutation，同样在发送前失败。
4. 从最终 73-row oracle AST 重算全部 physical-operation auth tuple；测试侧不得再补 TokenHub 特判。

### A-03 Vertex ADC 与 WIF 共用一个错误的 token resource/audience 常量，无法生成官方认证交换

**准确锚点**

- 第 1702-1746 行的 `WorkloadIdentityProfileReceipt` 只区分 `adc_file | workload_identity_federation | metadata_identity`，没有结构化的 OAuth scope、WIF provider audience、STS exchange 或 impersonation 字段。
- 第 27509-27510 行将 `vertex.adc` 与 `vertex.wif` 作为两个 required row。
- 第 27732 行的唯一 `AUTH_VERTEX_WORKLOAD_V6` 写死 `tokenResourceOrAudience:"https://aiplatform.googleapis.com/"`。
- 第 27751-27752 行让 ADC 与 WIF 两行共用该 auth oracle。
- 第 32036 行要求每个 workload credential lease 精确绑定 source、audience、principal、region 与 expiry；第 32349 行要求从 73 行生成准确 auth oracle 回归。

**真实用户反例**

Google 的 Vertex API 使用 OAuth scope `https://www.googleapis.com/auth/cloud-platform`，不是 `https://aiplatform.googleapis.com/`。[Vertex AI RPC authorization scopes](https://docs.cloud.google.com/vertex-ai/docs/reference/rpc/google.cloud.aiplatform.v1)

Google WIF 默认要求外部 subject token 的 audience 为具体 provider URL：`https://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`。这是防 confused-deputy 的安全边界，也不是 Vertex service URL。[Google WIF best practices](https://docs.cloud.google.com/iam/docs/best-practices-for-using-workload-identity-federation?hl=en)

因此真实 WIF 用户把官方 external-account 配置交给 SayDo 时，冻结 oracle 有两种失败方式：

- 把 `aiplatform.googleapis.com` 当 WIF audience，subject-token/STS 校验失败。
- 把它当 OAuth scope，得到的交换请求不符合 Vertex 所需的 cloud-platform scope。

ADC 也无法与 WIF 共用这个含混字符串并诚实满足“exact audience binding”。两个 required row 的 live qualification 不能由当前 oracle产生。

**根因与修复**

`tokenResourceOrAudience: string` 把 OAuth scope、OIDC/SAML audience、STS audience、service recipient 混成一个无判别字段，又让 ADC 与 WIF 复用同一 profile。应拆成至少两套精确 auth oracle：

- ADC：明确 credential source 子类与 access-token scope 集，Vertex 至少包含 cloud-platform scope；若接受 user ADC、service-account ADC、external-account ADC，还需分别派生，不得用一个 `adc_file` 标签吞并。
- WIF：明确 provider resource audience、STS endpoint、requested OAuth scope、subject-token type，以及可选 service-account impersonation 链。
- 最终 API credential recipient 单独绑定 Vertex endpoint identity，不能拿它替代 OAuth/WIF audience。

**机器验收**

1. 用官方 ADC fixture 与官方 external-account WIF fixture记录 credential worker 的逐物理请求，重算 audience、scope、STS endpoint、principal 与最终 recipient。
2. `aiplatform.googleapis.com` 被放入 OAuth scope 或 WIF provider audience时必须在首个认证网络字节前失败。
3. ADC/WIF profile、provider audience、project、pool/provider、scope、impersonation target 任意交叉换挂均失败。
4. 两个 row 各自完成 staged 与 live credential renewal；不得由相同 opaque digest 或测试侧 helper 自报通过。

## 5. B 级发现

### B-01 Vertex 的 `global` location 会被模板拼成不存在的 host

**准确锚点**

- 第 1731-1741 行允许 Google workload profile 的 `location` 为任意 `string`。
- 第 27674 行的 `WIRE_VERTEX_GENERATE_V6` 无条件使用 `https://{location}-aiplatform.googleapis.com`。
- 该 wire 没有 `global` 特例、location enum 或从模型能力证据派生 endpoint family 的判别联合。

**真实用户反例**

Google 当前 Vertex Gemini quickstart 直接推荐 `GOOGLE_CLOUD_LOCATION=global`，对应 endpoint 是 `https://aiplatform.googleapis.com`。[Vertex Gemini quickstart](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart)

用户照官方 quickstart 输入 `project + location=global + model` 后，冻结模板生成 `https://global-aiplatform.googleapis.com`。这是错误 host；用户会在一个官方首选配置上得到网络或 DNS 失败，而处方可能误导其检查凭据、配额或模型。

**根因与修复**

Vertex endpoint origin 被建成单一字符串插值，忽略 global endpoint 的特殊命名规则。改为由 location family 判别的 exact origin：

- `location = global` 时为 `https://aiplatform.googleapis.com`
- regional location 时才为 `https://{location}-aiplatform.googleapis.com`

location 本身应来自签名 region/model availability evidence，不接受任意字符串直接形成 host。

**机器验收**

1. `global` golden 精确得到无前缀 host；`us-central1` golden 精确得到 regional host。
2. `global-aiplatform.googleapis.com`、未知 location、模型不支持 location、location/model 跨 evidence 换挂均在 DNS 前失败。
3. endpoint identity、data boundary、credential recipient 与 qualification receipt 必须绑定分支后的最终 origin。

### B-02 Kimi Code 的真实 User-Agent 约束未进入 active V6 oracle，Chat row 甚至不要求对应 runtime state

**准确锚点**

- 第 20395 行要求 Kimi 真实 `User-Agent` 等非秘密常量进入版本化 `RequestProfile`，不得冒充其他客户端。
- 第 26369 行开始的 V5 provider profile 为 Kimi Chat/Messages 都声明 `realClientUserAgentPreservedAndImpersonationForbidden:true`，但该类型没有被最终 row 派生引用。
- 第 26465-26490 行的 active V6 fixed HTTPS wire 只有 `publicConstantHeaders`；没有动态真实客户端身份策略或 required public header policy。
- 第 27496 行最终 row 只使用 V6 `connectionOracle.wire`。
- 第 27536 行 `kimi.code.chat` 的 required runtime states 缺少 `real_user_agent_preserved`；第 27537 行仅 Messages row 有该 state。
- 第 27695-27696 行两个 Kimi Code V6 wire 都没有 User-Agent 约束。
- 第 31778、32316 行又要求 Chat 与 Messages 都保留真实 User-Agent，并做 HTTP 回归。

**真实用户反例**

Kimi 当前官方说明要求第三方工具保留真实客户端身份；篡改 User-Agent 可能导致会员权益被暂停。[Kimi third-party Coding Agents](https://www.kimi.com/en/help/kimi-code/third-party-agents)

一个严格按 active V6 oracle 实现的 producer 可以：

- 不显式提供 SayDo 的真实产品身份；或
- 发送借来的 `claude-cli/...`、`opencode/...` 身份。

Kimi Chat row 仍可满足它的全部 required states；V6 wire/header exact test 也没有可对比的期望值。于是四类同源公开产物可能声明 Chat 已通过，而真实账号面临会员权益处置。Messages 多了一个字符串 state，但 active wire oracle 仍不能证明实际 header 与当前 SayDo distribution/version相等。

**根因与修复**

V5 特化约束在 V6 exact oracle 切换时丢失，且 Chat/Messages 的 required state 不对称。应在 active wire schema 中增加由当前签名 distribution manifest 派生的 required public dynamic header profile，至少绑定：

- header 名称 `User-Agent`
- 当前 SayDo product token 与版本/发行物身份
- 禁止冒充其他客户端的规则
- request profile digest 与 endpoint identity

两个 Kimi Code row 都必须从该 wire约束派生同一个 `real_user_agent_preserved` assertion；不能只给 Messages 手写 state。

**机器验收**

1. Chat 与 Messages 各跑当前 distribution 的真实 User-Agent golden。
2. 漏 header、空值、旧版本、伪装 Claude/OpenCode、大小写重复、测试自报 state 但物理请求不同等 mutation 均在发送前失败。
3. requirement、connection oracle、RequestProfile、physical request evidence、runtime state 与四类 claim 必须从同一身份常量派生。

## 6. 其余专项终审结论

以下专项没有发现新的 A/B/C；这是对冻结目标合同的判定，不表示尚未施工的代码已经完成：

- OpenCode Go 资金边界与 Zen balance fallback：通过。
- TokenHub free-only：通过；本报告 A-02 仅针对 Messages row 的 models auth exactness。
- CC Switch 公开 loopback Messages opaque proxy 边界：通过。
- custom safe base、三协议乘四种 application auth 乘 mTLS：通过。
- 73 row、exact oracle key 集、public claims 与四类发布产物同源关系：集合层通过；A-02/B-02 是单 row 物理请求字段在 active oracle 中丢失。
- 自动检测、主动配置、被动提示、逐 row recovery、MFA、automatic 零主动作：总体通过；A-01 是 optional-auth typed event 的不可表示例外。
- 真实账号 starting flow、principal/MFA/admin set-cover、cleanup retry/quarantine：通过。
- desktop light/dark、mobile paper、200% 字号、窄屏与 screen reader 矩阵：通过。
- 面向非技术用户的首用信息架构：provider 命名、状态解释、技术细节折叠、单一卡片单一主动作与 recovery 返回点总体可执行；未发现独立于上述协议阻断之外的新问题。

## 7. 收口复核

报告落盘后的目标冻结身份与报告 emoji 门由独立命令复核。最终原始结果记录如下：

```text
$ shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
7fbc0a8ba767d90d84e26a49f83a357d57c5a269f1cf0c43b54c2e6a4d832967  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

$ wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
   33210 2146263 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

$ scripts/check-emoji.sh research/codex-findings/150-ai-supply-ecosystem-ux-final-closure-v15.md
zsh:1: permission denied: scripts/check-emoji.sh
exit 126

$ bash scripts/check-emoji.sh research/codex-findings/150-ai-supply-ecosystem-ux-final-closure-v15.md
[ok] emoji gate: clean
exit 0
```

仓库中的脚本文件当前没有直接执行权限；使用其 Bash 入口执行同一门禁后通过。目标在报告落盘后 SHA-256、行数与字节数均未漂移。

最终判定保持：**FAIL，A=3，B=2，C=0**。
