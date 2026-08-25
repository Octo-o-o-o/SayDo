# AI 供给生态与零配置体验闭包复审 v2

VERDICT: FAIL

开始 SHA-256：`7bfe7457b88bf909d9a9d85e4a0f2e0668675aa4bd38e4d8c421ef20645fb576`，与期望值一致。

结束 SHA-256：`7bfe7457b88bf909d9a9d85e4a0f2e0668675aa4bd38e4d8c421ef20645fb576`，与期望值一致。

核对命令：`shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。全程只读，未修改文件。

## A

### A1. 付费首次接入的请求披露、授权分离与两次点击 SLO 不能同时成立

位置：

- L156–157：一次确认后要完成 staged 与 live 两轮。
- L1745–1755：`ConformanceAuthorization` 与 `RuntimeSpendAuthorization` 严格分离，前者不得派生后者；付费 connector 可停在 `paid_dispatch_locked`。
- L2426–2428：`spend_consent` 固定宣称“1 次入口请求”，另有运行时预算动作。
- L2970–2977、L3169–3170：复用 staged → 自检 → restart → live 两轮，同时要求首次 candidate 最多两次 SayDo 点击完成自检并进入 `conversation_ready`。
- L3264：缺当前 `FundingDecision` 时 readiness 必须是 `action_required/blocked`。

用户反例：

新用户填写一个按量 API key，点击提交，再点击“确认并验证”。方案随后必须执行 staged 自检和 restart 后的 live 再自检，但界面只披露“1 次入口请求”。若两轮各发送一次真实请求，披露少算；若第二轮再次要求确认，则点击 SLO 已经失败。即使两轮自检都通过，合同仍要求独立的运行时费用同意，connector 只能是 `paid_dispatch_locked`，用户还要点击“确认本次使用”或“设置预算”才能真正进入可对话状态。把这个动作并入自检确认又违反“单次授权与持久预算分开操作”和“ConformanceAuthorization 不得派生 RuntimeSpendAuthorization”。

现有条款为何挡不住：

账本和 `BillingLimitVector` 可以约束真实费用，但不能修复 UI 明示的入口请求数错误；`conversation_ready`、`paid_dispatch_locked`、两轮自检和两次点击是互斥的验收合同，没有任何实现可以同时满足。

最小修订：

1. 从准确的 `ConformanceAuthorization` attempt/ingress 图派生自检文案，明确披露 staged/live 的入口请求总数、所有可能上游物理 attempt 和逐主体最坏费用，禁止硬编码“1 次入口请求”。
2. 把首次旅程拆成 `connected_verified` 与 `conversation_ready` 两个可度量终点。付费来源若仍坚持自检、运行时授权分离，应如实给出额外一次主动作，不能继续声称两次点击已“启动”。
3. 增加 Playwright + ledger 门：渲染的入口/物理请求上限必须与实际 `sent` 集合一致；缺独立 `FundingDecision` 时绝不能记录为 `conversation_ready`。

### A2. OAuth 收据缺少 client identity 和 token exchange 前的凭据出站授权，可能接受错误客户端的授权码或把 code/verifier 发往未授权端点

位置：

- L231–267：`AuthSource` 接受 `oauth_pkce | oauth_device`，但 `OAuthGrantReceipt` 没有 `client_id`、客户端注册/分发身份或 grant type。
- L1602：catalog、TLS、dialer 不能单独授权 secret 出站。
- L1604：声称已闭合 issuer、endpoint、callback、state、PKCE、code 与结果 credential，但仍未绑定 OAuth client。
- L2695–2697、L2798–2800、L3209：测试覆盖 endpoint、issuer、callback、state/code/verifier replay，却没有 client substitution、client registration drift 或 token exchange 前授权换挂。

用户反例：

同一 issuer 下存在两个 public client，授权端点、token 端点、scope 和 callback 形状相同。授权码实际签发给 client B，但 SayDo 的 receipt 没有 client identity，无法机械证明该 code 属于 SayDo 登记的 client A。另一个反例是 catalog 或 flow 状态把 token endpoint 换到另一个合法 HTTPS origin：当前设计只有事后 `tokenEndpointDigest`，却没有在发送 authorization code 与 PKCE verifier 前生成、消费一个绑定 client、endpoint、request body 和单次 lease 的授权收据。

这不是单纯的审计字段问题。OAuth 2.0 要求 token endpoint 把 authorization code 与其签发 client 对上；未认证 public client 也要提交 `client_id`。[RFC 6749 §4.1.3](https://www.rfc-editor.org/rfc/rfc6749#section-4.1.3) 对此有明确要求。Native app 的客户端注册、redirect URI 与 PKCE 边界见 [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252)。若返回 OIDC ID Token，还必须验证 `aud`/`azp` 与当前 client，见 [OpenID Connect Core 的 ID Token validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)。

现有条款为何挡不住：

`issuerIdentityDigest` 和 endpoint digest 只说明观察到了什么，不能证明当前 client registration 获准使用这些 endpoint，也不能在 token exchange 前授权 code/verifier 出站。`resultingCredentialSourceDigest` 是交换后的结果，无法倒过来授权已经发生的敏感发送。

最小修订：

1. 新增交换前的 `OAuthFlowAuthorizationReceipt`，绑定 issuer metadata、精确 authorization/device/token endpoint、`clientId` 或 `clientRegistrationDigest`、public/confidential client type、SayDo app/distribution identity、redirect registration、grant/response type、scope/audience、PKCE 参数、单次 token request body digest 和 egress lease。
2. 交换后的 `OAuthGrantReceipt` 再绑定 granted scopes、token issuer、`aud/azp`（若存在）、subject、credential/version 与前述授权。
3. 增加 client ID、client registration、token endpoint、grant type、granted scope 和 `aud/azp` 的逐字段 mutation fixture；任一不等必须做到零 code/verifier 出站或拒绝结果 credential。

## B

### B1. `oauth_device` 无法由当前 PKCE-only 收据诚实表示

位置：

- L234：公开接受 `oauth_device`。
- L246–267、L1604：唯一 `OAuthGrantReceipt` 强制要求 redirect URI、state、S256 challenge/verifier 和 authorization code。
- L2697、L2800：验收也只覆盖 PKCE callback/code 语义。

用户反例：

Microsoft Entra 等设备码登录会产生 device authorization endpoint、`device_code`、`user_code`、verification URI、expiry 和 polling interval；它没有浏览器 redirect callback、state、PKCE verifier 或 authorization code。该 flow 要么无法生成当前 receipt，要么只能伪造必填字段。设备授权的正式合同见 [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628)。

现有条款为何挡不住：

把 `oauth_pkce | oauth_device` 合并到一个 tag 不会消除两种 grant 的不同状态机；现有 replay/issuer 测试也无法覆盖 `authorization_pending`、`slow_down`、device code expiry 和 polling replay。

最小修订：

拆成严格判别的 `OAuthAuthorizationCodeGrantReceipt` 与 `OAuthDeviceGrantReceipt`。设备分支绑定 client、device authorization/token endpoint、device-code handle digest、展示给用户的 verification URI/user-code evidence、expiry、interval、有界 polling 序列及终态；增加 pending、slow-down、过期、取消、重复消费和端点/client 换挂 fixture。

### B2. “完全自定义端点”与 ProductEligibility/费用闭包形成认证死锁

位置：

- L139、L145：把“完全自定义”列为普通接入来源。
- L1602–1603、L1698：只有有有效 programmatic-surface 证据且 `eligible` 的产品才能展示/保存 credential。
- L1737、L1755：rights 或费用/overage unknown 时不能推荐、fallback 或创建授权。
- L2233–2242：承诺 authenticated custom endpoint 的协议探测。
- L2695、L2799：custom consent 只补 credential-egress，不补 product eligibility 和 billing。

用户反例：

企业有一个只在内网文档中登记的 OpenAI-compatible gateway，使用 Bearer key，费用由企业内部 chargeback 或既有基础设施结算，没有公开 provider product/rights/price 页面。它会保持 `ProductEligibility=unknown`，因此连 key 输入都不能出现；即便管理员明确授权，未知价格又使自检授权无法生成。“完全自定义”实际只支持已经进入 SayDo policy registry 且价格已知的 preset，并不支持真正的自定义认证端点。

现有条款为何挡不住：

精确 host/product 的 custom egress consent 只允许凭据发往该地址；它不能把 ProductEligibility 改成 eligible，也不能形成费用上限。Execution 已有 `externally_metered_unknown` 的显式 session consent，Inference 没有对应路径。

最小修订：

增加明确隔离的 `user_or_admin_attested_custom` 路径，绑定组织/管理员 principal、精确 endpoint/product、用途、TTL、数据披露和不可冒充官方的标签；为企业/自托管 inference 增加与 Execution 对称的 `externally_metered_unknown` 单次同意。该路径永远不能进入 no-new-spend、自动推荐或 fallback。若不接受此风险模型，就应把“完全自定义”改名并明确仅支持有受信 rights/billing 证据的自定义 deployment。增加一个私有 Bearer gateway + 外部计量 fixture。

### B3. 新 wire protocol 插件在 closed `Protocol` union 中不可表示，外部贡献者仍需修改核心合同

位置：

- L200–205：`Protocol` 封闭为五个值。
- L1820–1835：插件可声明 string profile 和 `ProtocolAdapter`，但没有可进入 connection/route/receipt 的 namespaced extension protocol identity。
- L1910：承诺 third-party code plugin 用于新 wire protocol。
- L2115–2124、L3438：承诺外部 reference connector 不改 daemon 核心。
- L2231：Cohere 原生 Chat 被列为 L2。
- L2608：新的 wire protocol 又被规定必须发布“核心版本”。

贡献者反例：

贡献者实现 Cohere 原生 Chat 或一个企业专有 wire adapter。插件即使通过 TCK，也无法让 `InferenceConnection.protocol` 合法表达该协议；它只能冒充现有五种协议，或等待修改 `@saydo/contracts` 并发布核心版本。这样“third-party plugin 支持新 wire protocol”不是可独立安装的扩展点。

现有条款为何挡不住：

`ProtocolAdapter.id` 和 `protocolProfiles: string[]` 只是 adapter 元数据；所有 endpoint identity、route、binding 和 receipt 仍要穿过封闭 `Protocol`。TCK、签名和 sandbox 不能弥补值域不可表示。

最小修订：

引入受约束的 `ProtocolId = BuiltinProtocol | ext:${publisher}.${name}@${major}`，并把 publisher/artifact/profile/schema/TCK digest 一并绑定到 endpoint、route、receipt 和 activation。新增仓外 fresh consumer 测试：安装一个真正使用新 protocol ID 的插件，daemon/core source diff 为零。若设计上坚持新协议必须 core release，则删除“第三方 code plugin 用于新 wire protocol”的承诺，并把可扩展范围明确限制为既有协议 profile/provider pack。

### B4. Docker-only 停止态没有从安全发现进入用户确认探测的可达旅程

位置：

- L2248–2256：自动阶段仅 static 文件与正在监听的 loopback；管理命令只能在 `explicit_active` 后运行。
- L2297–2315：冷态逻辑要求先已有 candidate。
- L2548–2550：Docker Model Runner 仅列 L2，Docker/Podman metadata 只在用户确认后读取。
- L2987：机器可读 journey report 只强制每个 L0 product。
- L3210：Discovery 测试没有 stopped container/image 或 Docker Model Runner 未启用场景。

用户反例：

用户已经用 Docker 部署 Ollama、vLLM 或 Docker Model Runner，但容器当前停止，宿主没有对应 CLI/runtime 配置且没有监听端口。static 阶段看不到可用服务，passive loopback 也没有结果；方案没有定义哪个无副作用证据会产生“查找容器中的 AI 服务”候选，因此也没有可点击的动作来取得 `explicit_active` 同意。用户必须先知道 Docker、容器和端口，再进入高级配置。

Docker 官方的 `docker container ls -a` 能枚举停止容器，见 [Docker CLI 文档](https://docs.docker.com/reference/cli/docker/container/ls/)；Docker Model Runner 本身也是明确的本地模型部署面，见 [Docker Model Runner 文档](https://docs.docker.com/ai/model-runner/)。

现有条款为何挡不住：

“管理 metadata 只能用户确认后调用”正确规定了安全边界，却没有定义如何从零信息状态向普通用户展示该确认动作；冷态 preload 只能处理已经发现的 candidate，不能发现停止容器。

最小修订：

1. static 阶段只用签名/安装路径等零执行证据识别 Docker Desktop/Engine/Podman 是否存在。
2. 存在时展示唯一主动作“查找容器中的 AI 服务”；确认后才运行有界、结构化、只读的容器/模型 metadata 查询，覆盖停止容器，且绝不自动 start/pull/load。
3. 启动或加载模型仍是下一次独立知情动作。
4. 增加 macOS/Linux/Windows 的 stopped container、engine 未运行、Docker Model Runner disabled、无匹配镜像和输出超限 fixture，并为 Docker-only 建机器可读 journey report。

## C

### C1. “一个主动作”仍被多处 `或` 动作表破坏

位置：

- L163–172：本地服务停止和额度耗尽各给两个“主动作”。
- L2421、L2425、L2426：`rights_unknown`、`quota_limited`、`paid_dispatch_locked` 各给两个并列动作。
- L2986：验收又要求所有被动提示只有一个主动作。

用户反例：

额度耗尽卡可以按当前表直接渲染“等待恢复”和“确认改走付费来源”两个同级按钮；screen reader 与键盘用户无法获得唯一推荐路径，且第二个动作会改变资金来源。

现有条款为何挡不住：

文档没有把其中一个标成 secondary link，也没有按 reset time、当前策略或用户意图选择唯一 primary 的规则；L2986 只是断言，不能约束组件输入。

最小修订：

定义机器可读的 `primaryAction` 单值和可选 `secondaryLink`，按状态给出确定性选择规则；测试 DOM role、tab order、视觉层级和同状态只存在一个 primary button。

### C2. 多语言只有一句实施意图，没有可判定的完整性门

位置：

- L2973：仅要求中文 golden，英文与“其他 locale”使用同 schema。
- L3204–3218：必测矩阵没有 locale 集合、翻译 key 完整性、fallback、伪本地化、数字/货币格式或 RTL 条目。

用户反例：

非中文 locale 缺失费用、rights 或数据边界文案时，组件可能回退为 raw provider ID/英文 key；长翻译也可能把唯一主动作挤出窄屏。当前“同 schema”无法判断是否全部关键安全文案已翻译。

现有条款为何挡不住：

schema 一致只保证结构，不保证消息 key 齐全、变量类型、复数/数字格式、布局或 screen-reader 输出。

最小修订：

列出首发 locale 与 fallback 规则；为全部 rights/billing/data/action 文案建立 typed ICU message key parity 门，加入 pseudo-locale、长文本、locale-aware `BillingUnit` 展示、窄屏与 screen-reader 快照。仅在正式声明支持 RTL locale 时要求 RTL 门，否则应明确不在首发范围。
