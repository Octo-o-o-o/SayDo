VERDICT: FAIL

## 完整性与读取范围

- START SHA-256：`37f8d831088c8613ef5d91c6ad8d40d73e6d63b2797cf662e26ea3bba60034ff`
- START bytes：`552023`
- END SHA-256：`37f8d831088c8613ef5d91c6ad8d40d73e6d63b2797cf662e26ea3bba60034ff`
- END bytes：`552023`
- 目标共 `6580` 行，已从第 1 行连续通读至第 6580 行；被工具截断的区段已缩小窗口补读，未抽样、未跳段。
- 读取 prompt 后，本地仅读取目标文件 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`；未读取旧报告、过程日志、代码或其他仓库文件，未编辑任何文件。
- 外部仅查阅官方一手资料：OpenRouter OAuth、AWS shared config/credentials、Google Gemini CLI 官方讨论、OpenCode Go/server/permissions、Huawei ModelArts API Reference、OCI Generative AI authentication/application 文档。OpenAI Codex App Server 官方页曾打开但输出截断，未作为结论证据。
- START 与 END 完全一致，评审期间目标未变化。

## 计数

- A：2
- B：3
- C：1

A/B 不为零，因此不能 PASS。

## A 级发现

### A-1：强制 GA 的 OpenRouter OAuth 旅程无法生成合法的 OAuth 合同链

涉及章节与合同：

- §4.2 的 `OAuthClientRegistrationReceipt`、`OAuthFlowAuthorizationBase`、`OAuthPkceGrantReceipt` 及 credential transition
- §4.16.2 OAuth 受信流
- §9.9 全球网关
- Phase 3 的 OpenRouter credits key 与 OpenRouter OAuth 独立 GA 旅程

最小反例：

1. 用户选择 OpenRouter OAuth。
2. 按 OpenRouter 官方流程，客户端携带 `callback_url` 与 PKCE challenge 打开 `/auth`。
3. 回调取得 `code` 后，向 `/api/v1/auth/keys` 提交 code 与 verifier。
4. 服务返回 API key。
5. 该流程没有目标合同强制要求的 OAuth `client_id`、requested/granted scopes，也不返回标准 access/refresh token。

现有条款为何挡不住：

- `OAuthFlowAuthorizationBase` 强制绑定 client registration receipt、`clientIdDigest` 和非空 requested scopes。
- grant/transition 又要求 granted scopes 与 token issuer/response 语义。
- OpenRouter 官方流程没有这些事实。实现只能伪造 client registration、scope 或 token receipt，或者绕过强类型合同。
- §4.16.2 只允许标准 authorization-code + PKCE、device 与 refresh 分支，没有能表达“PKCE 授权后换取 API key”的分支。
- 该旅程同时被列为强制 GA，因而不是长尾缺口，而是必达主路径的合同矛盾。

后果：

- 合同照抄实现时，OpenRouter OAuth 无法合法激活。
- 若为通过 schema 而伪造证据，会破坏凭据来源、授权范围与审计真实性。

最小修订：

- 增加严格、命名明确的 `api_key_pkce_exchange` union，或增加 namespaced OpenRouter auth profile。
- 合同只记录官方流程实际存在的 `callback_url`、challenge/method、verifier、authorization code、精确 exchange endpoint/request，以及返回 API-key credential 的版本化 transition。
- 明确该分支没有 client registration、scope、OAuth access token、refresh token语义。
- 增加成功、state/PKCE 不匹配、重复 code、回调漂移、exchange endpoint 漂移等 TCK。
- 如果不增加该合同，应从强制 GA 中移除 OpenRouter OAuth，不能保留必达承诺。

所需一手来源：

- [OpenRouter OAuth 官方流程](https://openrouter.ai/docs/guides/overview/auth/oauth)
- [OpenRouter Python SDK OAuth API Reference](https://openrouter.ai/docs/client-sdks/python/api-reference/oauth)

### A-2：最后一次 retryable/发送前失败无法关闭 durable cursor，全失败主路径可永久停在测试中

涉及章节与合同：

- §4.2 的 `PhysicalAttemptTerminalReceipt`
- `FallbackSolutionTerminalReceipt`
- `ExecutionAttemptTerminalReceipt`
- §4.16.1 durable cursor 与 physical-attempt 约束
- §5.3 fallback
- §8.2 测试与运行时状态

最小反例：

1. 一个自定义 Base URL 探测获得两个已授权 physical attempts。
2. 第一次请求发送后返回 503，生成 `retryable_failure`。
3. 第二次也是最后一次，仍返回 503。
4. 合同把 `retryable_failure` 固定为 `closesCursor:false`，但 envelope 已没有下一条允许的 edge/ordinal。
5. 当前 union 中又没有 `exhausted`、`no_successor` 或独立 cursor-finalization receipt。

同样的问题发生在：

- 最后一个 fallback alternative 仍为 retryable failure；
- 唯一尝试在发送前 DNS/TLS/credential preparation 失败；
- 用户在发送前取消，而 union 只有发送后取消的闭合形态。

现有条款为何挡不住：

- “只有登记 edge 才能继续”可以禁止非法 successor，却不能产生一个合法终态。
- 尝试结果和 cursor disposition 被绑死：retryable 与 failed-before-send 永远不闭合。
- attempt budget、ordinal 与 edge 检查只能证明“不能再试”，不能把未闭合 cursor 转成 terminal。
- 全文未给出可在 budget/edge 耗尽时关闭这些 cursor 的另一份强类型 receipt。

后果：

- 普通的“所有候选都失败” onboarding 会一直停留在 `testing`。
- reservation、actual report、fallback 结论及 UI 恢复动作无法稳定 settle。
- 这是常见失败路径的不可终止状态机，而不是单纯缺少展示文案。

最小修订：

- 将传输结果与 cursor disposition 分离，例如：
  - `outcome: retryable_failure | failed_before_send | cancelled_before_send`
  - `continuation: advance | exhausted | cancelled`
  - `closesCursor: boolean`
- verifier 必须结合 envelope edge、attempt budget 和 ordinal 校验 disposition。
- 或增加独立的 durable `AttemptCursorExhaustedReceipt` / `AttemptCursorCancelledReceipt`，明确归属最后 attempt、未消费请求数、reservation 释放及最终 readiness。
- 增加“最后一次 503”“唯一尝试发送前失败”“发送前取消”“fallback 最后一项失败”的固定 TCK。

该项是目标内部合同反例，不依赖外部生态资料。

## B 级发现

### B-1：unknown-metering 只允许非官方 custom 权限，官方企业云的未知计费端点没有可连接路径

涉及章节与合同：

- `CandidateBillingReceipt`
- `ConformanceResult`
- `RuntimeBillingReceipt`
- `UserAdminAttestedCustomRightsReceipt`
- custom Base URL / unknown metering gateway
- Phase 7 云厂商路径

最小反例：

企业通过 Azure OpenAI、Bedrock 或 Vertex AI 的官方 endpoint 与 IAM 身份访问模型，但真实费率来自企业协议、credits、成本中心或平台侧账单，桌面端拿不到可证明的逐单位价格。管理员愿意：

- 明确承认费用未知；
- 限定 endpoint、身份、region、请求数与 physical cap；
- 每次主动确认；
- 不要求“已结算”“无新增支出”或自动推荐。

现有条款为何挡不住：

- `CandidateBillingReceipt` 只有可定价 candidate 与 `externally_metered_unknown_custom`。
- unknown custom 分支要求 `UserAdminAttestedCustomRightsReceipt`，其语义明确是非官方 custom 权限。
- 官方 IAM endpoint 不能诚实地被声明成非官方 custom。
- `RuntimeBillingReceipt` 即使允许 generic unknown，也缺少从官方 candidate/conformance 合法进入该状态的生产链。
- 因而真正“费用未知但权利、数据边界和请求上限明确”的官方企业部署仍然不能连接。

最小修订：

- 增加 `externally_metered_unknown_official` 的 candidate、conformance 与 runtime 分支。
- 要求官方 eligibility、rights、egress/data-boundary、精确 endpoint/request 与 physical cap。
- 固定禁止 settled/no-new-spend、自动推荐、fallback、evaluator、后台运行和无人值守。
- 保留独立的 custom unknown 分支，不把两者混成同一 rights attestation。

该项主要是合同封闭性反例，不需要依赖某一家云厂商的可变价格表。

### B-2：Bedrock “profile” 承诺不能表示常见的 named static credentials profile

涉及章节与合同：

- `ApplicationAuth`
- `WorkloadIdentityProfileReceipt`
- `WorkloadIdentityCredentialLeaseReceipt`
- Phase 7 Bedrock `profile/SSO/role/session or API key`
- GA baseline 的 Bedrock profile/role

最小反例：

用户已有标准 AWS named profile，其中 credentials 文件包含 `aws_access_key_id`、`aws_secret_access_key`，可能还有 `aws_session_token`。用户选择该 profile 连接 Bedrock。

现有条款为何挡不住：

- `ApplicationAuth` 没有 AWS SigV4/static access-key composite 分支。
- profile 路径最终要求 temporary credential lease，并记录 issuance endpoint/request 与允许的 token/STS endpoint。
- 静态 named profile 没有该 issuance 事件，不能诚实生成 temporary lease。
- 用户只能被迫改成 role/SSO/API key，或由实现伪造 issuance receipt。
- UI 与 GA 文案写的是未限定的 `profile`，普通用户无法从该承诺判断静态 profile 实际不受支持。

最小修订：

- 增加严格的 `aws_static_profile_sigv4` broker source：
  - 只引用明确选择的 named profile；
  - broker 内分别管理 access key、secret key 与可选 session token；
  - 每个 physical attempt 生成 signing lease，而不是虚构 issuance lease；
  - 绑定 account/principal/resource/region，禁止 default chain、helper 与 metadata 漂移；
  - 轮换或 profile 内容变化立即 hard stop。
- 或将所有 UI、baseline 和验收文本明确收窄为 role/SSO/temporary-session profile，并给出静态 profile 的可执行迁移路径。

所需一手来源：

- [AWS shared config and credentials files](https://docs.aws.amazon.com/sdkref/latest/guide/file-format.html)

### B-3：需要新型 secret-dependent request signing 的第三方 provider 仍必须修改 trusted core

涉及章节与合同：

- `ConnectorDefinition.kind`
- §4.10.2 trusted signer 边界
- public SDK/TCK 与 provider/protocol/plugin 扩展目标
- L2 provider inventory 中的 AK/SK 类生态

最小反例：

社区贡献一个官方 provider pack。该 provider 使用 AK/SK 对 canonical method、path、query、headers 与 body digest 做厂商请求签名。贡献者可以声明 endpoint、模型、计费和 capability，但现有 signer core 不认识这种签名算法。

现有条款为何挡不住：

- `ConnectorDefinition.kind` 只有 provider pack、inference driver 与 execution-agent driver，没有 auth/signing strategy 扩展点。
- §4.10.2 要求新的 secret-dependent challenge/signature 进入 bundled trusted signer core。
- 因而第三方不能仅靠公开 SDK/TCK 增加该 provider；必须修改 daemon/trusted core。
- 这直接命中终审 B 级定义中的“扩展仍须改核心”，与文档对开放 provider/protocol 扩展的表述不一致。

最小修订：

两种修订任选其一：

1. 增加受限、声明式 `SigningProfile`：
   - 输入只允许 canonical method/path/query/header/body digest 与 opaque broker key components；
   - 禁止插件读取原始 secret、任意网络或文件系统；
   - 由宿主执行签名并用确定性 TCK 验证。
2. 对无法声明式表示的算法提供经审核、隔离进程的 signer extension class，并保持相同 policy/audit 约束。

如果安全边界决定永远不开放 signer，则必须收窄“第三方无需修改 core 即可扩展 provider”的承诺，并把这类 provider 明确归入 core-maintained inventory。

所需一手来源：

- [Huawei ModelArts API Reference](https://support.huaweicloud.com/intl/en-us/api-modelarts/03%20ModelArts%20API%20Reference-pdf.pdf)，官方说明 AK/SK 请求签名及 signing SDK，用于证明这不是假设性的长尾认证形态。

## C 级发现

### C-1：推荐解释示例把 Codex subscription 写成 thinking/inference 路径，与已定角色边界冲突

涉及章节：

- §7.1 推荐解释示例
- Codex App Server / execution-agent 角色约束
- inference supply 与 execution supply 的分离规则

最小反例：

推荐卡片告诉用户“thinking uses Codex subscription”，但同一文档把 Codex App Server 定义为 Execution Agent，并禁止 legacy CLI 在缺少未来 OS read-deny 等条件时冒充 inference connector。

现有条款为何挡不住：

- 强类型 solver 可以阻止实际错误 dispatch，但不能让这条解释文本变真。
- 普通用户会把订阅执行面误解为模型推理供应面，形成错误的成本与权限心智模型。
- 这是示例/文案层冲突，当前不会绕过强制运行时安全合同，因此归 C。

最小修订：

- 将示例替换为已存在且合法的 inference source，例如 OpenAI Responses API、Kimi API 或本地 inference runtime。
- 若要保留 Codex，应明确写为 code execution/verification agent，而不是 thinking/model route。
- 只有未来独立 conformance 的 subscription inference connector 落地后，才允许对应表述。

## 结论

目标在覆盖面、合同细度、供应面分层、秘密隔离和验收资产方面已经很完整，但仍有两个会阻断必达旅程或令 durable 状态无法终止的 A 级问题，以及三个涉及官方企业云、主流 AWS profile 和开放扩展边界的 B 级缺口。按照 prompt 的硬门槛，本轮不得判定 PASS。

VERDICT: FAIL
