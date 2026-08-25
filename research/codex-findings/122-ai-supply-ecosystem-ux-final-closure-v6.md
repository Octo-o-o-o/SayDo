# AI Supply 生态与体验最终闭包复核 v6

## 结论

**FAIL**。

发现数：A=2，B=5，C=0。

冻结目标已经覆盖很广，尤其是中外官方 API、订阅与 CLI、企业云身份、本地运行时、桥接、发现安全、费用与数据边界。但当前版本仍不能作为“生态完整、用户路径闭合、reference-grade/GA 可机械证明”的最终实施输入：GA journey 的证据合同允许报告未证明实际产品路径或最终可用状态便声明通过；同时，所有可发送事务依赖的数据库外单调锚没有三平台可达实现或支持前置条件。这两项会分别造成错误 GA 声明和正式支持环境中的主路径不可达。

在 A/B 级问题关闭前，不建议进入最终实施或授予 reference-grade/GA 标识。

## 输入与完整性

- 评审指令：`prompts/122-ai-supply-ecosystem-ux-final-closure-v6.md`
  - 行数：39
  - bytes：3,447
  - SHA-256：`2189ecebdd227118466990c4c1172ebf7de8ad3d7ad62e9e536b3ae3b9da4784`
- 唯一冻结目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
  - 行数：8,219
  - bytes：638,999
  - SHA-256：`fc4454fc6ac05c545d90b0780a5298a16f0a021c5e972da1f4df3de460da4c0e`
- 已完整读取目标第 1–8,219 行；对分块输出中发生截断的区间逐段补读后再作结论。
- 本报告只引用上述冻结目标；未读取源码、旧评审或其他仓库文件。

## 覆盖矩阵

| 评审面 | 目标中已有覆盖 | 闭包结果 |
|---|---|---|
| 中国大陆与全球官方 API | 产品 realm、协议、key namespace、费用与数据边界均有专章和 GA 行 | 设计覆盖充分；最终 GA 证明仍受 A-1 影响 |
| 订阅、CLI 与 Execution Agent | Codex、Claude、Gemini、Kimi、OpenCode、Cursor、Copilot 等按产品与 surface 拆分 | rights 阻断后的主动作没有可解析目的地，见 B-2 |
| 本地与自托管 | Ollama、LM Studio、oMLX、Docker Model Runner 及大量 L1/L2 runtime | 新机单调锚不可达、无工具模型普通对话矛盾、Podman AI Lab 缺具名路径，见 A-2、B-3、B-4 |
| 企业云身份 | Bedrock、Vertex、Azure 的静态与 workload identity 均有实施说明 | GA baseline 允许 auth 路径借位，见 A-1 |
| 桥接与 custom gateway | CC Switch、LiteLLM、custom endpoint、SSRF、route pin、unknown metering 均有约束 | 常见非秘密租户/部署 header 无自助路径，见 B-1 |
| 自动发现与用户控制 | static、passive loopback、explicit-active 三档及零副作用约束清楚 | 通用容器发现不能替代 Podman AI Lab 产品 journey，见 B-4 |
| UX、国际化与无障碍 | 主动作、恢复、窄屏、`zh-CN/en-US/en-XA` 与 a11y evidence 均有字段 | journey pass 与 readiness/a11y 门没有类型级闭包，见 A-1；rights 主动作会落入死路，见 B-2 |
| 扩展与长期生态 | declarative pack、code plugin、TUF/TCK、sandbox 边界完整 | DSL 越界认证的两处规则互相冲突，见 B-5 |

## A 级发现

### A-1 GA journey 与 baseline 不能机械证明“实际产品路径已可用”，并明确允许企业云 auth 借位

**证据**

- `GaJourneyDefinitionV1` 只有 `journeyKey/journeyId/authKind/authProfileDigest/journeyTier`，没有 product、realm、surface、protocol、funding、platform、locale 或 principal/account 主题（第 6265–6271 行）。
- `GaMandatoryBaselineV1` 只保存三组扁平 key 和按 category 聚合的 funding/auth 最小值，不能表达“这个产品的这个 realm、surface、protocol、auth、funding、platform、locale 必须由同一条 journey 证明”的复合基数（第 6299–6315 行）。
- `GaJourneyRunPayloadV1` 虽记录 entry/journey/auth、platform/locale、动作计数和两个 readiness，但不记录实际 product、realm、surface、protocol、funding、principal/account；`outcome` 还是独立可填的联合值，没有约束 `completed_pass` 必须对应 `connected_verified` 或 `conversation_ready/review_ready`（第 6392–6415 行）。
- journey 和 entry 外层分别用泛型 `ReceiptRef` 作为 attestation/gate report，并各自再保存一个字面量 `gateOutcome: "completed_pass"`；类型合同没有具名 gate report 或其判定输入（第 6418–6433 行）。
- prose 声称 verifier 会校验 report kind、surface、protocol、auth、realm、category 全等，并拒绝另一平台借用（第 6962 行），但前述 payload 没有其中多数 observed 字段，泛型 receipt 也没有规定可从何处取得这些字段。
- 企业云产品定义要求 Bedrock named static、role/SSO/session、Bedrock API key 分别成 journey，并要求 Azure API key、Entra、Managed Identity（第 6846–6847、7412–7414 行）；GA baseline 却只要求 Bedrock named static 与 role/SSO、Vertex ADC、以及 Azure “Entra **或** Managed Identity”，还没有 Bedrock API key 与 Azure API key 的最低 journey（第 6956 行）。这不是实现遗漏推测，而是 baseline 本身允许少测一个 auth path。
- reference profile 的必需 key 是 `execution.kimi-cli`（第 6341 行），而产品级说明始终命名为 Kimi Code Server/ACP（第 6582、6793、6859、7295 行）；没有给出二者的规范映射，进一步削弱“具名最低项”的精确身份。

**受影响用户旅程**

发布负责人完成 GA evidence；企业用户在 Azure Managed Identity、Azure API key 或 Bedrock API key 下首次连接；用户依赖支持页上的 reference-grade 标识选择连接方式。

**最短反例**

1. 发布矩阵只纳入 Azure Entra journey，不纳入 Managed Identity；按第 6956 行的“或”仍满足该 category。
2. journey report 填入正确的 `entryKey/journeyKey/authKind`，把 `outcome` 与外层 `gateOutcome` 填为 `completed_pass`，但把 `finalConnectionReadiness` 和 `finalSolutionReadiness` 都填为 `blocked`。当前公开类型仍成立。
3. 报告没有 observed product/surface/protocol/realm/funding/principal 字段，因而无法证明测试实际命中了 matrix 中声称的那一产品路径，而不是只复用了相同 auth/profile 的通用 fixture。

结果是 release verifier 可接受“GA 已通过”的结构，同时一个被宣传的 auth/product path 没有通过，或者 journey 根本没有达到可用状态。这正是无效 reference-grade/GA 声明。

**为何现有方案不够**

第 6486、6962、7485–7486 行的 verifier prose 描述了正确意图，但 prose 不能补出 payload 中不存在的观测字段，也不能消除第 6956 行的显式析取。`completedFixtureSetDigest`、泛型 `ReceiptRef` 与字面量 pass 只能证明“有一个摘要/收据”，不能证明其 payload 满足产品 journey 的具体不变量。

**根因修复**

1. 定义唯一的 typed `GaJourneySubjectV1`，至少包含 `entryKey/productId/realm/surface/protocol/authProfile/fundingTier/principalOrAccount/platform/locale/distribution`；definition、run payload、gate report 与 attestation 都引用同一 subject digest。
2. 用具名 `GaJourneyGateReportV1` 代替泛型 `ReceiptRef`，把 fixture 身份、实际 endpoint/product identity、动作计数阈值、a11y/ICU、最终 readiness 和各子门结果列为可验证字段；`completed_pass` 必须由 verifier 推导，不能由生产者自由填写。
3. baseline 使用必需的复合 journey tuple，而不是仅用扁平 key/category 汇总。明确列出 Azure API key、Entra、Managed Identity；Bedrock named static、role/SSO/session、API key；Vertex ADC。若某路径不属于 GA，必须从支持声明中降级，而不是用“或”借报告。
4. 统一 Kimi Execution entry 的规范身份；若 `execution.kimi-cli` 就是 Server/ACP，必须给出唯一 surface/wire 映射并让产品表、profile、matrix 与 evidence 使用同一 key。
5. 增加 mutation：`pass + blocked readiness`、同 auth 换 product/surface/protocol/realm、Azure Entra 代 Managed Identity、Bedrock role 代 API key、Kimi CLI key 代 Server/ACP，均必须使 release gate 非零。

### A-2 所有发送链强制依赖数据库外单调锚，但三平台 GA 没有可达 producer、前置条件或降级边界

**证据**

- `SecurityMonotonicAnchorReceipt.authorityKind` 只有 `os_protected_counter | hardware_counter | remote_transparency_witness`（第 1329–1341 行）。
- 每个 reference-monitor writer lease 都必须持有该 anchor，并在 continuity loss 时 fail closed（第 1519–1533 行）。
- 所有 cursor、lease、ledger、OAuth、send/effect writer 的 epoch、高水位与消费位都必须绑定数据库外 anchor；无法证明无回滚时全部 spend/OAuth/send/effect lease 撤销并要求重新授权（第 5958 行）。
- 网络不可用只允许沿“已有且未回滚”的 high-watermark 推进；anchor 连续性丢失不能以 wall clock 兜底（第 6479 行）。
- GA 同时要求 Ollama、LM Studio、oMLX 的 local zero-config，以及 macOS arm64、Linux x64、Windows x64 的正式 journey（第 6954、6960、7006、7460 行）。公开最低硬件只要求 4 个逻辑核、8 GiB、SSD，没有受保护计数器或联网见证前置条件（第 7631 行）。目标全文也没有为三平台定义任一 anchor producer、初始化/恢复流程或不具备该能力时的支持降级。

**受影响用户旅程**

一台符合公开最低规格的新 Linux x64 电脑，已经安装 Ollama 和模型，但离线且没有 SayDo 可访问的 OS/硬件保护计数器。用户期待“发现本地模型并开始普通对话”。同类问题也适用于更换主板、系统恢复或企业策略禁止远程见证后的 macOS/Windows 环境。

**最短反例**

静态发现可以找到 Ollama；但首次 conformance 和实际 inference 都需要创建 cursor、writer lease 与 send intent。设备没有本地 anchor，离线又无法取得 remote witness，因此 writer lease 不存在，首字节必须 fail closed。反复“重新授权”不会创建缺失的 authority，用户也没有可执行处方；`local_zero_config` 永远到不了 `conversation_ready`。

**为何现有方案不够**

这不是恢复旧快照时的罕见安全分支，而是当前支持矩阵允许的 fresh-install 状态。计划同时给出“必须有 anchor”和“这些平台/最低硬件必须正式通过”，却没有把两者用平台能力合同连接起来。实现方只能自行放宽安全规则、偷偷依赖在线服务，或让主路径永久阻断。

**根因修复**

1. Phase 0 固化 `MonotonicAnchorBackendProfileV1`，为每个正式 OS/runner 指定真实 authority、初始化、持久化、迁移、备份恢复、休眠、重装与 continuity-loss 行为，并用独立 TCK 证明数据库回滚不能伪造 counter。
2. 将 anchor 能力加入正式平台最低条件和 GA evidence；若某平台/硬件没有合格 backend，就明确降级该 platform profile，不能继续标正式支持。
3. 若产品决定支持无 anchor 的离线本地模式，只能定义独立、明显标识且机械受限的 capability：无 secret、无付费/远程网络、无 OAuth、无工具副作用、无持久预算继承，并证明它不能换挂到正常 send/effect lease。若无法证明，宁可不提供该降级。
4. 增加 fresh offline、无硬件 counter、remote witness 不可达、系统恢复、主板更换、双 writer 与 re-auth 后仍无 authority 的三平台 journey；每个状态必须有可执行处方或明确的支持边界。

## B 级发现

### B-1 custom gateway 禁止用户录入任何非秘密公共 header，常见企业端点必须先造受信 pack

**证据**

- `PublicRequestHeader.source` 只允许 builtin profile 或 signed registry profile（第 3554–3562 行）。
- 计划明确拒绝用户自由 header；动态 credential header 只能由 broker 产生（第 5343 行）。
- GA 又把 OpenAI Chat、Responses、Anthropic Messages 与 mTLS-only private gateway 的 custom endpoint 作为必需类别，并承诺 header broker 与 provider-first 预览（第 6959 行）。

**受影响用户旅程**

企业用户粘贴一个兼容网关 URL。网关除 Bearer credential 外，还要求非秘密常量，例如 `X-Tenant-ID: acme` 或 `X-Deployment: prod`。

**最短反例**

该 header 不是 secret，也不具有 `Authorization/Cookie/Forwarded/Host` 等保留语义，但没有 builtin/TUF pack。用户无法在向导中表达它，conformance 必然失败；唯一出路是离开产品制作并签发 registry pack。于是“custom endpoint”对一个常见配置不再是自助 onboarding。

**为何现有方案不够**

secret broker 只解决秘密值，signed registry 只解决预先收录产品；二者都不能表达用户组织自己的公开租户/部署常量。把全部 header 一刀切为不可信，安全边界清楚，却把私有 gateway 的常见合法形态排除在产品路径之外。

**根因修复**

增加严格的 `user_attested_public_constant` 分支：header name 使用小型 allowlist/denylist 和规范化规则，值有长度与字符集上限，永久禁止 credential、cookie、forwarding、routing override 与 hop-by-hop 名称；逐项进入预览、request-profile digest、data-processor disclosure 和 exact endpoint consent。任何秘密仍只能由 broker handle 产生。为允许/拒绝 header 加正反 TCK。

### B-2 `rights_unknown/rights_forbidden` 的统一“改用官方 API”主动作没有产品级、可解析的目的地

**证据**

- 两种 rights 阻断状态都固定使用 `switch_to_official_api`，文案分别为“改用官方 API”和“使用官方 API”（第 6731、6733 行）。
- CLI/订阅表中，Cursor、Antigravity、Copilot、Vibe 以及大量 IDE 只处于 unknown/inventory；有些必须改接模型厂商 API，有些只有另一种 Execution surface，有些只能等待授权或选择其他来源（第 6855–6871 行）。这些不是同一个产品、账号、费用或数据处理路径。

**受影响用户旅程**

SayDo 检测到 Cursor 订阅但 rights=unknown。用户点击唯一主动作“改用官方 API”。

**最短反例**

状态模型没有 destination entry/product、所需新账号、费用边界或返回目标；“官方”既可能指 Cursor，也可能指底层模型厂商。实现者只能自行猜测打开哪个向导。若跳到 OpenAI/Anthropic API，则这是新的独立付费产品，不是把现有 Cursor 订阅换成“官方模式”；若没有选择，则按钮成为死路。

**为何现有方案不够**

一个 action id 无法为异构产品推导唯一替代路径，rights evidence 也不能凭空决定用户愿意新购哪个厂商。现有文案掩盖了身份、费用和数据边界改变。

**根因修复**

定义 typed `AlternativeJourney`：来源 product/surface、目的 `entryKey/journeyKey`、是否需要新账号/credential/付费、rights 与 data-boundary 摘要、返回点和不可用原因。没有唯一替代时，主动作应是“选择其他来源”或“保留为 inventory”，而不是虚构单一官方 API。门禁逐一验证每个阻断状态的 primary action 都解析到当前 distribution 中可启动的 journey。

### B-3 无工具调用能力的本地文本模型无法与 `conversation_ready` 的普通对话承诺同时成立

**证据**

- 四槽硬需求把 dialog 定义为必须具备流式、取消和工具往返（第 5294–5301 行）。
- `conversation_ready` 又定义为只要一条通过基础 conformance 的普通对话供给即可，允许单来源降级启动（第 5311–5315 行）。
- 本地生态规则明确说不支持工具的模型只能用于 thinking/cheap，不能进入 dialog 工具环（第 6874–6880 行）。
- `InferenceBinding` 的 slot 只有 `dialog | thinking | cheap | evaluator`，没有 plain-chat/reduced-dialog 形态（第 3793–3821 行）。

**受影响用户旅程**

新用户的 Ollama 中已有一个支持流式文本但不支持 tool call 的模型。用户只想进行普通文字对话，不需要工具或独立复核。

**最短反例**

模型可以通过普通 Chat 文本 conformance，却不能满足 dialog 的工具往返硬门；它也不能以 thinking/cheap slot 驱动普通会话。求解器只能阻断，或违反硬需求把它标为 dialog。两种结果都与“基础普通对话可达到 `conversation_ready`”冲突。

**为何现有方案不够**

`conversation_ready` 是 solution readiness，不会自动创造一个可执行 binding。现有 slot 联合没有承载“普通文本对话但禁工具”的能力边界，UI 也没有可据以关闭工具/副作用入口的机器状态。

**根因修复**

增加明确的 `plain_dialog`/`basic_conversation` operation profile，要求流式与取消但不要求工具；activation manifest 和 UI 必须机械关闭工具、Execution 与依赖 tool roundtrip 的工作流，并清楚显示受限能力。或者收窄“任何本地模型/普通对话”的承诺。增加 Ollama 文本-only 模型从发现到首轮对话的 GA fixture。

### B-4 Podman 只有通用容器检查，没有 Podman AI Lab 的具名产品 journey

**证据**

- 目标全文没有出现“Podman AI Lab”。Podman 只出现在通用容器安装痕迹、只读容器枚举、停止服务处方和通用测试项中（第 6476、6560、6730、6874、7237、7250、7267、7390、7643 行）。
- 同一段为 Docker Model Runner 明确定义了具名 L2 journey 和 stopped/disabled/model/endpoint 行为（第 6476、6874、6955 行），Podman 没有对等的 product identity、状态机、endpoint 解析或处方。

**受影响用户旅程**

用户已经安装 Podman AI Lab，但其服务处于 API 未启用、未加载模型、停止或端口冲突状态，希望 SayDo 自动识别并给出一个主动作。

**最短反例**

静态层只能显示“检测到 Podman”；授权后也只能枚举容器和 published loopback port。没有 Podman AI Lab product entry 或状态判别时，UI 无法区分普通容器与 AI Lab，无法稳定给出产品级 endpoint/profile，也无法对“API 未启用”和“无模型”提供不同处方。用户必须理解容器、端口和协议才能继续。

**为何现有方案不够**

通用容器发现是底层证据能力，不等于产品 onboarding。计划已经用 Docker Model Runner 证明具名 journey 是必要抽象，却没有对提示中要求核对的重要 Podman 路径做同等闭包。

**根因修复**

把 Podman AI Lab 加为具名 L2 local-runtime entry：定义安装/版本证据、AI service 与普通容器的区分、API disabled/no model/stopped/ready/port conflict 状态、endpoint/protocol profile、唯一主动作和返回恢复。保持 static 零 CLI/socket、explicit-active 只读且不 start/pull/load，并增加三平台适用范围与 fixture。

### B-5 非 DSL 的 secret-dependent 认证被同时指定为 trusted signer 和 code plugin，扩展路径不可实现

**证据**

- AuthStrategy 规定第三方插件永远看不到 secret bytes；超出 declarative signing DSL 的密码协议只能由审核过的 bundled trusted signer 维护，并特别禁止把它描述成不受信 code plugin 可扩展（第 5632 行）。
- code plugin 没有 transport/auth host RPC，只能返回纯 wire plan（第 5637 行）；第三方 code plugin 只处理新 wire 或 agent event，新的 secret-dependent auth 仍受 trusted signer 边界约束（第 5643 行）。
- Phase 7 验收却规定“超出 DSL 的 provider 必须使用受沙箱约束的 code plugin”（第 7429 行）；最终回修摘要也写成“越界转 code plugin”（第 8209 行）。

**受影响用户旅程**

社区贡献一个协议兼容但签名算法无法由有限 hash/HMAC DSL 表达的长尾企业 provider。

**最短反例**

按第 7429/8209 行实现 code plugin：插件拿不到 secret，也没有 auth RPC，无法生成签名。若新增 secret/auth RPC 让它工作，则直接违反第 5632/5637/5643 行的安全边界。按第 5632 行实现 bundled trusted signer，则该 provider 并非“越界转 plugin”，仍需核心受信代码与发布流程。两条路径不能同时成立。

**为何现有方案不够**

sandbox 只能限制插件权限，不能让它在既看不到 secret、又没有受限签名操作的情况下完成 secret-dependent 计算。该矛盾会让贡献者卡死，或诱使实现者临时扩大 broker 接口并破坏凭据隔离。

**根因修复**

做唯一裁决并统一第 5632、5643、7429、8209 行：

1. 若 DSL 越界必须进入 bundled trusted signer，就明确这是受信核心改动，列出审计、owner、release 与 TCK 路径，code plugin 只负责 wire/event。
2. 若确实要支持第三方扩展，则先设计独立的受限 signer capability：host 执行固定、可审计的 cryptographic operation，插件只提交有界公开参数和 opaque component refs；证明它不能成为任意签名 oracle、不能改变 endpoint/body 后重放，再经 TUF/TCK 晋升。没有这套合同前不得写“越界转 code plugin”。

## 修复优先级与复验条件

1. 先关闭 A-1：把 GA subject、journey evidence、pass 推导与企业云逐 auth baseline 收成一份可执行 schema；这是所有生态覆盖声明的可信根。
2. 再关闭 A-2：给三平台明确 anchor backend 或收窄正式支持矩阵；在此之前，本地零配置和离线 journey 不可判定为可实施。
3. 同批关闭 B-1、B-2、B-3、B-4、B-5，避免实现阶段分别发明 custom header、rights 替代路径、文本-only 模式、Podman AI Lab 和 signer 越界方案。
4. 下一轮必须使用新的冻结 SHA，逐项运行最短反例；只有 A=0、B=0，且 GA mutation、fresh-offline anchor、custom public header、rights alternative、tool-less local chat、Podman AI Lab、non-DSL signer 七组门禁全部可机械判定，才可给出 PASS。

## 最终判定

[fail] 当前冻结目标尚未完成生态与体验最终闭包。

