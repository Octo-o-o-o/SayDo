# FAIL

方案仍有 13 个 A 级缺口。主要问题不是“代码尚未实现”，而是关键安全合同、权益判定、回滚与排产条件尚未写到可判定、可测试的程度；施工方即使完全照方案执行，也可能交付出会泄露凭据、错误复用订阅、静默付费或绕过 evaluator 隔离的实现。

## A 级：开工前必修

### A-1 Inference Supply 与 Execution Agent 仍可混装

位置：[§4.1](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:163)、[Connector 草案](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:181)、[Phase 5](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:772)、[D18 沙箱事实](docs/07-tech-stack-decisions.md:235)。

问题：`plane`、`transport`、`protocol` 是彼此独立的枚举，类型上允许 `plane=inference + protocol=acp + transport=app_server`。Phase 5 又允许 Kimi/OpenCode 在“一次无 tool 事件”后升级为 inference，但无 tool 事件不能证明进程没有隐式读取磁盘。现有 D18 已明确 Codex/Cursor 的隔离只能限制写入或事后检测，不能阻止读取。

可复现反例：CLI 在测试中不发 tool event，却启动时读取 workspace、`~/.saydo` 或会话历史；它通过 inference 自测，随后获得不经过 Execution Agent 审批的上下文。另一个合法通过草案 schema 的 connector 可直接把 ACP 声明成 inference。

最小修复：把 Connector 改成 discriminated union；纯 inference 只允许纯 HTTP/local inference，或具有操作系统级“不可读 workspace、隔离 HOME、关闭非目标网络”的 CLI。其他 CLI/ACP/App Server 一律进入 `execution_agent` 或 inventory-only。同步修改 D7/D8、控制桥和审批所有权，并增加 Gate 0 关闭、S3 语音拒绝、tool/read 逃逸的验收用例。

### A-2 多协议合同没有定义到能够实现和验收

位置：[能力回执](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:226)、[P0 协议](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:295)、[统一 ChatEvent](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:318)、[Phase 2](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:676)。

问题：方案只列出概念映射，没有定义 `ChatEvent` schema、事件顺序状态机、tool delta 拼接、thinking/signature 保真、usage 权威来源、未知事件、部分响应重试和幂等边界。

可复现反例：服务端把 tool arguments 拆在多个 UTF-8/SSE chunk 中，发出 tool call 后断线。当前验收无法判断应拼接、失败还是重试；若重试，可能重复执行工具或重复收费。Anthropic thinking 元数据或 Responses item 状态也可能在统一成文本时丢失。

最小修复：在 `docs/09` 定义版本化 Request/Event/Terminal/Usage schema 和合法状态转换；逐协议列出无损映射、丢失标记、大小与顺序限制。默认只允许在收到任何响应字节前重试，之后必须有供应商幂等保证。加入逐字节分片、重复事件、乱序、半流断开和 cancel 的 fixtures。

### A-3 endpoint identity、SecretRef 和 receipt 没有形成不可拆分绑定

位置：[Connector 字段](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:195)、[SecretRef 规则](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:263)、[回执失效键](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1002)。

问题：随机 UUID 不是 endpoint identity；`SecretRef` 也没有 secret version、credential principal 或 connector revision 绑定。`custom_header` 没有禁止 `Host`、`Proxy-Authorization` 等危险头。回执失效条件不包含 secret 内容版本或身份主体变化。

可复现反例：保留 connector UUID 和 SecretRef，只把 endpoint 从可信域改到攻击者域，真实自测就会把旧 key 发到新域。或者 keychain 中同一个 ref 被覆盖成另一账号，旧 rights/capability receipt 仍被复用。

最小修复：定义规范化 `EndpointIdentity`，覆盖 scheme、IDNA host、port、path、protocol、TLS policy、auth kind、connector revision、secret version/principal；激活时进行原子 CAS。禁止 URL userinfo/query/fragment 及危险自定义头。endpoint、secret 或 principal 任一变化均应失效并要求显式重新绑定。

### A-4 SSRF/DNS rebinding 规则存在 TOCTOU 空洞

位置：[网络规则](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:269)、[Phase 1 验收](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:655)、[测试矩阵](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:949)。

问题：“解析后检查、每次连接重新检查”没有规定解析与 socket connect 必须使用同一结果，也没有处理混合 A/AAAA、CNAME、IPv4-mapped IPv6、NAT64、系统代理和 DNS 变化。`networkScope` 也可能被当作配置输入而非运行时推导事实。

可复现反例：域名第一次解析为公网 IP，通过检查；HTTP 客户端再次解析时返回 `169.254.169.254`。或者 AAAA 是公网、A 是私网，检查器只检查首个地址。`HTTPS_PROXY` 还可能直接收到 Authorization。

最小修复：实现唯一网络 dialer：每跳只解析一次，检查全部地址后把 socket 固定到已批准 IP，同时保留 Host/SNI；redirect 每跳重新执行同一流程。默认禁用环境代理，代理必须成为显式 connector。测试覆盖 metadata IP、混合解析、CNAME、IPv4-mapped、TTL/rebinding 和代理环境变量。

### A-5 云凭据继承会执行未授权代码或选错身份

位置：[AuthSource](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:199)、[云环境发现](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:423)、[Phase 7](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:846)。

问题：`aws_profile` 可选、AWS default chain、ADC 和 `DefaultAzureCredential` 会继承环境、配置文件或托管身份；方案没有禁止 discovery 阶段执行 credential helper，也没有把最终 principal/role/tenant 绑定进 receipt。

可复现反例：默认 AWS profile 含 `credential_process=/tmp/exfil`。首启的“只列身份/模型”会执行该程序。另一种情况是 DefaultAzureCredential 选中与用户预期不同的 tenant 或 managed identity。

最小修复：自动发现只读取静态元数据，不运行 helper、不访问 metadata service。用户必须选择精确 credential source、account/principal、region 和 role；只允许列明的 credential provider。receipt 绑定 principal、scope、source digest，并测试自动阶段绝不触发 `credential_process` 或 metadata endpoint。

### A-6 自动发现仍可能执行 PATH 投毒程序并读取第三方历史

位置：[首启自动探测](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:112)、[发现边界](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:344)、[CLI 分级](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:364)。当前实现会先执行 PATH 二进制：[cliCapability.ts](packages/daemon/src/config/cliCapability.ts:898)，并扫描会话文件内容：[cliCapability.ts](packages/daemon/src/config/cliCapability.ts:423)。

问题：方案称 detector “只读”，但运行 `--version/status/list` 不是无副作用操作；签名校验只在部分条目中出现。方案虽禁止默认读取 conversation history，却没有把“不得打开这些文件”写入 Phase 4 门禁，无法确保现有扫描逻辑被真正移除。

可复现反例：恶意 `codex` 位于 PATH 前端，首启运行 `--version` 即外传环境变量。或者第三方 session 文件中含 prompt/secret，scanner 为提取 model 打开并读取它。

最小修复：执行前先静态解析路径并检查 owner、mode、签名/package/digest；未知二进制只能 inventory。子进程关闭 stdin，使用隔离 HOME/cwd/env/network、严格超时和进程树回收。增加 sentinel 测试，证明恶意二进制未执行、session/token 文件从未被打开。

### A-7 RightsReceipt 缺少时效、分发形态和精确授权主体

位置：[rights 字段](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:273)、[registry rights 数据](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:252)、[失效条件](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1011)。

问题：`sourceURL + checkedAt + termsDigest` 没有 `expiresAt/maxAge`、产品/应用 ID、分发渠道、edition、允许的第三方形态、审核主体和政策版本。签过一次 `allowed` 后，可以无限期沿用。

可复现反例：根据接口技术文档签发 `allowed`，数月后条款、地区或 Coding Plan allowlist 已变化，但因为系统不知道新 digest，旧回执永不失效。

最小修复：RightsReceipt 必须绑定 provider、surface 精确版本、产品/应用身份、edition、region、use case、distribution channel、证据定位、审核者、policy version、`checkedAt/expiresAt`。过期一律降为 `unknown`；技术 registry 不得自行把 `unknown/forbidden` 升为 `allowed`。

官方资料也说明“技术可用”与“可分发权益”必须拆开：OpenAI 文档分别说明 Codex 可使用订阅/API key，以及 App Server 可嵌入产品，但这两项本身并不能推出 SayDo 可复用某订阅权益；这是基于文档范围的推论，不是对 OpenAI 条款的额外断言。[OpenAI authentication](https://learn.chatgpt.com/docs/auth)、[OpenAI App Server](https://learn.chatgpt.com/docs/app-server)。Anthropic 则明确指出，未经批准的第三方不能提供 claude.ai 登录或其 rate limits。[Anthropic Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)

### A-8 BillingMode 可绕过“不得新增费用”

位置：[BillingMode](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:204)、[no-new-spend 过滤](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:282)、[fallback](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:463)、[owner 决策](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1040)。

问题：`gateway` 被设计成与 `payg/mixed_auto_overage` 互斥的 billing value，但 gateway 背后完全可能是 PAYG 或自动切换上游。no-new-spend 规则没有过滤 `gateway`。此外，正文要求“一次性回执”，owner 建议却是“可持续、可撤销的额度回执”，语义冲突。

可复现反例：LiteLLM/OpenRouter connector 标为 `gateway`，其上游 fallback 到 PAYG；no-new-spend 模式仍会自动选择它。Kimi Extra Usage 可自动扣费，且月度 cap 可以不设置，正是不能仅靠 `mixed_auto_overage` 标签解决的情况。[Kimi Code membership](https://www.kimi.com/code/docs/en/kimi-code/membership.html)

最小修复：把支付拆成正交字段：funding source、overage state、upstream fallback、cap enforcement、价格时效、currency/account。任何未知或不可强制限制的路径都不能用于 no-new-spend。分别定义单次付费回执和持久预算策略，包含额度、期限、作用域、原子扣减与撤销语义。

### A-9 evaluator 独立性可被自报 family 和 gateway 路由绕过

位置：[slot 要求](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:242)、[硬过滤](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:431)、[fallback](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:463)、[本地模型 family](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:592)。

问题：本地模型允许用户选择 family；gateway 的实际 upstream 也可能不可观测。由用户输入或静态配置得到的不同 family/route 不能证明模型独立。fallback 后也没有明确要求重新求解整个四槽硬约束。与此同时，当前 canonical 允许单供应商同 family 的显式确认路径：[docs/09](docs/09-data-contracts.md:1218)、[docs/11](docs/11-ui-spec.md:441)，而新方案把它改成硬禁止，却未列入 owner 决策。

可复现反例：同一组 Llama 权重通过两个端口暴露，用户分别命名为 `foo`、`bar`，系统认定独立。或者 evaluator gateway 在故障时回落到 thinking 使用的同一上游。

最小修复：只有可验证的模型 artifact/provider/upstream identity 能参与独立性判定，用户 family 不能作为 evaluator 证据。每次 fallback 都用 observed route/model 重新求解全部槽位；不满足时停用 evaluator。由 owner 明确裁决“同 family 降级模式是否保留”，并区分“可聊天”与“具备独立验收”两种 readiness。

### A-10 升级迁移不等于可降级回滚

位置：[Phase 1](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:644)、[迁移策略](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:924)、[feature flag 回滚](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:985)。

问题：“新版本继续读旧 ModelBinding 一个 release”只解决向前迁移；一旦新版本写入 connector ID、把 secret 迁入 keychain，旧二进制未必能读新配置或找到原 secret。新版本里的 feature flag 也无法帮助已经降级的旧版本。

可复现反例：升级后激活 connector，随后降级到上一正式版本；旧版本只认识 `providers.api`/env key，进入 recovery 或报告缺 key。

最小修复：设计版本化双写或可恢复快照、迁移 journal 和原子 promotion。验收必须实际用“上一正式发布二进制”打开迁移后的 HOME，并验证配置、secret 和 active binding 都可恢复。保留 legacy 数据到回滚窗口结束，再安全清理。

### A-11 Phase 0 与唯一排产源、当前 active batch 冲突

位置：[前置规则](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:10)、[Phase 0 排产动作](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:614)、[dirty tree 建议](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1038)、[唯一 active batch 规则](docs/plan/IMPLEMENTATION-PLAN-2.md:149)、[当前 HANDOFF pointer](HANDOFF.md:21)。

问题：Phase 0 内才“把批准后的批次写入 PLAN2”，形成先开工、后获得排产权的循环。当前 HANDOFF 仍指向 `w54b-wiring`；只开新 branch/clone 不会绕过“全仓只能一个 active batch”的规则。

可复现反例：现在按方案在 clone 中开始 Phase 0，会同时修改正处于 dirty/review 状态的 `docs/07`、`docs/09`、`docs/10`、`docs/11` 和 PLAN2。合并时既违反单批次规则，又无法判断 canonical 冲突属于哪一批。

本会话的 `git status --short` 实际看到上述 canonical 和 PLAN2 均为 `M`，目标方案自身为 `??`。

最小修复：Phase 0 之前先关闭并清空当前 pointer，处理相关 dirty 文件；由 owner 在 PLAN2 中指定确切批次位置、依赖和验收，再开启新 pointer。记录基线 HEAD 及输入 canonical 的 SHA-256。删除“branch/clone 可解决并发冲突”的暗示。

### A-12 签名 registry 没有抗回放、轮换和撤销合同

位置：[registry](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:252)、[Phase 3](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:706)。

问题：只写“签名快照、增量、LKG”，没有离线 trust root、key ID、轮换/撤销、单调序号、签发与过期时间、抗降级规则。registry 又同时承载 endpoint 和 rights，影响 secret 投递与付费决策。

可复现反例：攻击者回放一份仍能验签、但包含旧 endpoint 或旧 rights 的快照；LKG 和签名校验都会接受它。

最小修复：定义固定 trust root、key rotation/revocation、单调版本、`issuedAt/expiresAt` 和本地 anti-rollback 状态。rights 更新使用独立签名域与审核流程；registry 更新不得自动激活 connector 或扩大权益。

### A-13 “数据去哪”无法由现有 schema 计算

位置：[体验承诺](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:44)、[Connector schema](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:181)、[推荐硬过滤](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:431)。

问题：方案承诺展示和过滤数据去向，但 Connector 没有数据处理地区、operator、subprocessor、retention、gateway effective route 或可信度字段，推荐器无数据可过滤。

可复现反例：用户要求数据仅在中国大陆处理；两个兼容 endpoint 能力相同，但 schema 无法区分实际处理地区。gateway 切换海外上游后，卡片仍可能显示原有地域。

最小修复：增加版本化 DataBoundaryReceipt，至少绑定 operator、处理地区、保留策略、subprocessor、effective route、证据来源和时效。未知数据去向不得满足地域硬偏好。同步修正当前 UI 中“本机运行、数据不出这台电脑”这类不能覆盖云 API 的文案：[docs/11](docs/11-ui-spec.md:471)。

## B 级：应修

### B-1 首启推荐与“必须先有真实 receipt”互相卡死

位置：[一键承诺](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:52)、[8 秒首屏](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:112)、[无 receipt 不推荐](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:242)、[发现不得 generation](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:739)。

反例：全新安装检测到 Ollama，但从未做真实 generation，因此没有 receipt。系统要么无法在 8 秒内给推荐，要么违反“无真实 receipt 不推荐”。

最小修复：区分“候选卡”“可激活推荐”“已验证推荐”，并明确自测点击是否计入“一键/两键”指标。

### B-2 Conformance Lab 放得过晚

位置：[Phase 2](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:676)、[Phase 8](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:868)。

反例：Phase 2/3 已需判定流式、tool、usage 和协议一致性，但统一 harness 到 Phase 8 才完成，不同 adapter 会先各自发明判据。

最小修复：把确定性 fixture harness 移到 Phase 2；Phase 8 仅负责真实服务漂移与发布矩阵。真实调用必须使用单独测试账号和明确费用授权，不进入普通 CI。

### B-3 时延指标存在多个相互冲突的完成标准

位置：[首屏 8 秒](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:112)、[探测预算](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:344)、[指标](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:933)。

反例：实现以 9 秒显示推荐，满足指标表 P95 10 秒，却违反前文 8 秒硬预算；缓存结果 200 ms 又可能同时满足 300 ms、违反 100/150 ms。

最小修复：建立唯一 SLO 表，区分 hard deadline、P50/P95、冷启动和缓存；其他章节只引用该表。

### B-4 UI 动作没有服从 rights 状态优先级

位置：[被动提示文案](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:471)、[大陆覆盖表](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:533)。

反例：GLM Coding Plan 被标为 inventory/rights gate，但示例直接提示“还差套餐 key”。这会诱导用户提交 secret，却尚未证明 SayDo 有权使用该 surface。

最小修复：规定状态优先级：`forbidden/unknown rights` 必须先于 credential 缺失；rights 未通过时不展示输入 secret 作为主动作。

### B-5 observed model 的全局 fail-closed 过度限制兼容服务

位置：[Phase 2 验收](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:688)。

反例：某 OpenAI-compatible 本地服务完整支持流式和 tools，但响应不含 `model`，或返回规范化后的 alias。它会被整体拒绝，和“普适接入”承诺冲突。

最小修复：定义 `exact/alias-verified/unverified` 身份等级。`unverified` 可在用户明确选择后用于普通主对话，但不得用于 evaluator、静默 fallback 或自动迁移。

## C 级：可选

### C-1 当前实现事实描述少了 `provider_order`

位置：[现状描述](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:35)、[实际 ModelBinding](packages/contracts/src/types/modelbinding.ts:64)。

问题：方案称 named API 只有 `base_url/api_key/optional family`，实际还有 `provider_order`。

反例：迁移设计若据此建立旧字段清单，可能漏迁排序信息。

最小修复：补全现状描述和迁移 fixture。

### C-2 “末四位指纹”语义不清

位置：[secret 展示](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:263)。

问题：无法判断是显示 secret 原始末四位，还是显示不可逆摘要的末四位；前者会泄露少量 secret 且容易碰撞。

最小修复：明确为设备本地密钥参与计算的截断 HMAC fingerprint，不展示 secret 原文的任何字符。

## 未误报为方案缺陷的当前实现差距

以下只是方案计划要解决的既有实现状态，本评审没有把它们单独列为缺陷：

- 当前 `openaiCompat.ts` 固定 `/chat/completions`、Bearer 且非真正 streaming。
- 当前 setup API 仍有 hostname/env key 推导。
- 当前 family、CLI catalog 和资源推荐仍较硬编码。
- 当前 Console 尚未实现新 connector/receipt UI。

只有当方案缺少迁移、禁止条件或可执行验收时，上述现状才被用作反例，例如 PATH 二进制执行和第三方历史扫描。

本次未修改任何文件，未运行测试或真实 provider 调用；结论来自只读代码/文档检查、`git status --short` 和只读官方资料核对。