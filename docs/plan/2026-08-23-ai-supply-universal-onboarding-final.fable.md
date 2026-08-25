# AI 供给普适接入与零配置引导最终方案

> 日期：2026-08-23
> 状态：最终方案；验收结论以绑定本文件冻结 SHA 的 detached 三路终审报告为准；排产指针冲突和 owner 决策未解除前禁止开工
> 范围：SayDo 四个 LLM 推理槽、Execution Agent surface、Agent CLI/订阅、官方与三方 API、本地模型服务、桥接工具、首次引导与运行中提示
> 不含：本轮不修改生产代码、不代替 `docs/plan/IMPLEMENTATION-PLAN-2.md` 排期、不承诺复用上游未授权的消费级订阅；embedding、rerank、图像/视频生成、STT、TTS 等 operation profile 留待后续独立合同，不冒充本版已覆盖

## 本文档的组成

2026-08-24 起，本专题拆成三份各自可验证的产物；三者内容互补，合起来才是完整方案：

| 产物 | 内容 | 怎么验证 |
|---|---|---|
| **本文件**（约 2,400 行） | 审计结论、用户旅程、架构决策、协议与发现设计、生态清单、分阶段计划、验收与风险 | 人读；对抗评审 |
| `ai-supply-contracts-draft/`（45,696 行 TypeScript） | §4 与 §8 的合同草案，原为本文档内嵌代码块 | `tsc` strict/NodeNext；当前零诊断 |
| `../review/2026-08-24-ai-supply-review-loop-archive.md`（741 行） | v1–v20 评审循环的过程记账，原为本文档 §17 | 过程证据，不再随方案演进 |

## owner 决策状态（2026-08-25）

§14 十项决策的签署状态见
[`2026-08-24-ai-supply-owner-decisions.md`](2026-08-24-ai-supply-owner-decisions.md)。
**已签四项直接改变本方案的范围**，阅读下文时以本节为准：

| 决策 | 裁决 | 对本文的影响 |
|---|---|---|
| **1 排产坐标** | 先收口 `w54b-wiring` C3，再排本专题 | §0 开工门维持；本专题在 C3 收口并关闭 active pointer 前**不排产、不开工** |
| **2 Codex/ACP** | **引入 ACP 适配层**；Codex 沿用 `codex exec`，不为其单独建平面 | §10 Phase 5 应按协议（`acp` / `app_server` / `cli_stdio`）重组；`claude_code`/`cursor` 保持 hook 形态不变 |
| **6 secret/付费边界** | 采纳默认：双双关闭 | §4.6、§7.3、§12 相关约束按原文执行 |
| **7 扩展交付边界** | **首发只开放内置受信 connector**，第三方声明式 pack 一并推迟 | **§4.10 整节、§9.8、决策 8 的 TUF registry、Connector SDK 对外发布本轮不落地**；合同草案对应部分不下沉 |

未签六项中，3/4/5/8/9 已有 Claude 预填的推荐草案待确认；**决策 10 建议暂缓**
（其编译预算的设定前提已因草案外移与决策 7 缩减范围而失效）。

**决策 7 的范围收缩是本轮最大的减重**：§4.10 参考实现级扩展内核（含三种扩展交付级别、
plugin sandbox、TCK 分发信任）整节推迟，意味着草案中 `03-extension-points.ts`、
`06-sdk-compat.ts` 及 `08-wire-budget.ts` 的相当部分本轮无需收敛。
下文凡涉及第三方 connector 分发、TUF registry、plugin capability 的内容，
**读作「后续阶段的设计存档」，不是本轮实施范围**。

拆分原因见 [`../review/2026-08-24-ai-supply-v20-loop-diagnosis.md`](../review/2026-08-24-ai-supply-v20-loop-diagnosis.md)：
合同草案连续 20 轮未能通过零上下文对抗评审，而 45,696 行 TypeScript 不是人读评审能收敛的对象。
草案现已可被 `tsc` 直接检查，后续应逐块下沉 `packages/contracts` 并由测试锁定，不再靠评审轮次逼近。

§14 的十项 owner 决策另有可签署副本：[`2026-08-24-ai-supply-owner-decisions.md`](2026-08-24-ai-supply-owner-decisions.md)。

## 0. 文档关系与开工纪律

1. `docs/plan/IMPLEMENTATION-PLAN-2.md` 仍是当前唯一排产源；本文是等待并入该排产源的专题实施方案，不创建第二套当前状态。
2. 当前存在必须先处理的排产冲突：`HANDOFF.md` 与 `IMPLEMENTATION-PLAN-2.md` 对活动批次状态不一致，且目标 canonical 文件处于其他任务的 dirty 状态。**这不是 Phase 0 的工作，而是 Phase 0 之前的开工门**。
3. 开工门必须按顺序完成：关闭并清空现有 active pointer → 对账并处理相关 dirty 文件 → owner 在 PLAN-2 指定本专题的具名批次、准确插入位置、依赖和验收 → 记录基线 HEAD 与输入 canonical 的 SHA-256 → 再开启新 pointer。任一步未完成都不得创建施工会话。
4. 新 branch、worktree 或 clone 只能隔离文件，不能绕过“全仓只有一个活动批次”的治理规则。
5. Phase 0 需要先更新 `docs/07-tech-stack-decisions.md` D7、D8、D18，`docs/09-data-contracts.md` §6/§9/§11/§12/§13，`docs/modules/c-control-bridge.md` C2/C5、`docs/10-voice-ux-spec.md` 与 `docs/11-ui-spec.md`，再改代码。合同形状冲突时始终以 `docs/09-data-contracts.md` 为准。
6. 本文获批并完成 canonical 回写后，才 supersede 以下局部旧假设：
   - “自定义 Base URL 等于 OpenAI Chat Completions”；
   - “安装且登录 CLI 等于订阅可被 SayDo 使用”；
   - “第一条可用供给等于推荐供给”；
   - “API 一律要求 key，且四个槽共用同一端点和模型”；
   - “端点身份和 secret 名可由 hostname 推导”。
7. 当前工作树有其他任务正在修改 canonical 与主排产文档；本文不覆盖或整理那些并行改动。

## 1. 最终结论

### 1.1 对本轮问题的直接回答

截至本次代码快照，现状不是“已经覆盖主流，只差补几个名字”，而是仍有四个阻断开箱体验的结构性缺口：

现状审计基线为仓库 `HEAD 174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`；下列结论来自该快照中的实际源码，不从计划或旧报告反推实现状态。

| 问题 | 当前事实 | 结论 |
|---|---|---|
| 智谱、Kimi、OpenCode | Kimi 与 OpenCode 只出现在 inventory catalog，`provider=null`，不能写入模型槽；智谱没有 CLI 或 API 一键接入 | 尚未形成可用接入 |
| 自定义 Base URL | 唯一 HTTP 适配器固定请求 `POST /chat/completions`、固定 Bearer、固定 `choices` 解析 | 只支持 OpenAI Chat Completions 的一个子集 |
| Anthropic 与 OpenAI 两种调用方式 | 没有原生 Anthropic Messages，也没有 OpenAI Responses；Anthropic 官方 key 虽可被表单保存，但会被错误地按 OpenAI Chat 调用 | 当前不支持这两套原生协议 |
| 用户自己的 CLI 与订阅 | 7 个 CLI 可写入模型槽，Kimi/OpenCode/Aider/Pi 仅盘点；CLI 登录态、具体订阅权益、上游 API 转发和自动超额计费未被可靠分开 | “检测到”不等于“可合规自动使用” |

现有代码证据：

- [`modelbinding.ts`](../../packages/contracts/src/types/modelbinding.ts) 的 `WIRED_CLI_PROVIDERS` 只有 Codex、Claude、Cursor、Grok、Gemini、Qwen、Copilot；命名 API 端点只有 `base_url`、`api_key`、可选 `family` 与 `provider_order`。
- [`cliCapability.ts`](../../packages/daemon/src/config/cliCapability.ts) 将 Kimi、OpenCode 标成 `provider:null`。
- [`openaiCompat.ts`](../../packages/daemon/src/providers/openaiCompat.ts) 固定调用 `/chat/completions`，没有 Responses、Messages 或原生 Gemini/云 IAM 适配。
- [`setupApi.ts`](../../packages/console/src/lib/setupApi.ts) 用 hostname 推导端点名；未知三方端点共用 `OPENROUTER_API_KEY` secret 槽。
- [`SetupWizard.tsx`](../../packages/console/src/components/SetupWizard.tsx) 只自动探测 CLI；添加 API 必填 Base URL、key、模型，并默认把同一个端点铺到四槽。
- [`SupplyPicker.tsx`](../../packages/console/src/components/SupplyPicker.tsx) 的用户文案仍承诺“任意兼容 OpenAI 协议”，实际能力与文案不一致。
- [`resourcePlans.ts`](../../packages/console/src/lib/resourcePlans.ts) 的默认方案按列表顺序和使用记录排列，“全用同一 CLI”并不等于按槽能力最优。

### 1.2 本方案落地后的产品承诺

最终承诺应改成下面这句话：

> SayDo 会自动发现本机已有且可安全识别的 AI 供给，为用户生成一套可直接启动的推荐配置；需要登录、填 key 或确认费用时，每个需要用户介入的状态只给一个明确主动作，安全自动推进的状态不伪造按钮，并诚实显示完整旅程还剩几步。只有上游明确允许的程序化接口、订阅面或本地服务才会自动启用；权限未知或禁止的来源只展示合规替代路径，绝不偷取 token、模拟私有接口或静默切到按量付费。

具体体验目标：

- 用户第一次打开时先看到“已经找到什么、推荐用哪一套、是否会新增费用”，而不是先理解 Base URL、协议和四个内部槽位。
- 已有未过期receipt且不产生新按量费用的健康供给，主路径最多一次点击启动；运行中的local候选自动验证。停止、未安装、未加载模型或端口冲突属于独立恢复旅程，不能冒充零配置成功。`signed_in_ready` 的guided key主路径最多两次SayDo动作；缺billing最多三次；`no_account`或`signed_out`且还缺billing时诚实放宽到四次，包含创建/登录账号、确认权益或billing、在厂商侧创建凭据及录入凭据。guided OAuth即使厂商网页已登录也必须真正完成本应用的授权/兑换，不能因账户状态良好而跳过。enterprise/custom严格采用各自签名上限，不借窄路径文案。费用确认由独立authorization合同约束，不把它藏进点击计数；外部登录、MFA、凭据创建、复制粘贴和离开返回逐项计数并在开始前展示。
- 自定义 API 默认由 provider preset 填好协议、URL、认证和模型列表；“完全自定义端点”放到高级入口。
- 已验证 local-only compute 的 Ollama、LM Studio、oMLX 等 loopback 服务可免 key 接入；不要求用户伪造 `ollama` 之类占位 key。loopback 只证明首跳传输，Ollama cloud model、LM Studio LM Link 等远程计算必须按云/LAN 供给单独建模。
- 运行中健康时不打扰；只有登录过期、服务停止、额度耗尽、协议能力不足或费用边界改变时给出一条可执行提示。
- 订阅或本地供给失败时不静默转付费 API。任何会新增费用的 fallback 都必须受单次授权或持久预算策略约束，并可撤销、可原子扣减。

### 1.3 “任意 AI 服务都能用”的真实边界

“任意”通过协议和注册表覆盖，不通过宣称每个消费级账号都可复用：

- [ok] 官方 API、获授权的第三方兼容 API、本地运行时、用户主动配置的网关，可以接入。
- [ok] 厂商提供明确 programmatic surface，且其条款允许当前分发形态时，订阅可以接入。
- [warn] 只允许特定工具或交互式编程场景的 Coding Plan，只能在该 allowlist 与用途内启用。
- [fail] 厂商明确禁止第三方产品提供其消费级登录或复用限额时，不接入该订阅登录；提供官方 API、云 IAM 或受支持工具作为替代。

这里的“任意 AI 服务”在 v1 精确指向 SayDo 当前四个 LLM 推理槽和 Execution Agent surface。Connector SDK、registry、policy、receipt 与 TCK 必须允许未来增加新的 `OperationProfile`，但 embedding、rerank、图像/视频、STT、TTS 各自需要独立输入输出 IR、内容安全、费用单位、数据边界、流式状态机和 conformance profile；在这些合同进入 canonical 并过门前，README、官网和 UI 不得把“连接已发现”写成这些能力已经受支持。这个边界避免为追求名单完整而把完全不同的 AI 操作塞进 LLM 最小公分母。

例如，OpenAI 官方同时提供 Codex 订阅登录与 App Server 嵌入协议；Anthropic 当前文档则明确要求未获批准的第三方产品使用 API key，而不是提供 claude.ai 登录与订阅限额。两者不能用同一条“本机登录即复用”的规则处理。

## 2. 本次完整审计结果

### 2.1 当前已经可保留的基础

| 能力 | 当前状态 | 本方案动作 |
|---|---|---|
| CLI 安装、版本、登录态探测 | 已有目录、超时与重探机制 | 保留并统一进 Discovery Engine |
| staged → 自检 → restart → live 再自检 | 已有安全闭环，失败不会替换 active config | 原样保留，扩展到协议、local、bridge 与 cloud connector |
| CLI observed model 与 family 校验 | 已有 receipt、审计与 fail-closed | 从硬编码前缀升级为 registry identity + conformance receipt |
| CLI 无工具自检与 evaluator 隔离确认 | 已有安全骨架 | 按 connector capability 复用，不按品牌写分支 |
| 登录失败、探测超时、重试入口 | 已有人话提示与显式重测 | 扩展为统一处方化状态机 |
| API key 不回显 | 表单提交后清空，日志有脱敏 | 升级成每端点独立 SecretRef 与重定向防泄漏 |

### 2.2 必须先修的 A 级缺口

| 编号 | 缺口 | 风险 | 必须结果 |
|---|---|---|---|
| A1 | 排产指针、PLAN-2 与 dirty canonical 冲突 | 无合法施工坐标，Phase 0 会与当前批次抢真相源 | 先关闭旧 pointer、owner 插入具名批次并记录基线 digest |
| A2 | 单一 connector 混装 connection/model/agent/receipt | 类型允许 inference+ACP 等非法组合，四槽无法选不同模型 | 拆判别联合、per-slot binding、Execution Agent 与 immutable receipt |
| A3 | 自定义 URL 固定走 OpenAI Chat | Anthropic key、Responses 和本地 Messages 被错误调用 | 三核心协议及 event 状态机独立实现和验收 |
| A4 | endpoint、secret 与 principal 未绑定 | 同 UUID 改 host 或覆盖 key 后可复用旧 receipt 并误投 secret | 分平面的 EndpointIdentity + secret version/principal + CAS 原子绑定 |
| A5 | `0600`、SSRF、隐式 proxy/云 metadata 边界不足 | 同 UID Agent 可读 key；DNS TOCTOU 或 proxy 可截获凭据 | secret broker、唯一安全 dialer、DNS-to-socket pin、显式 credential egress |
| A6 | 自动探测会执行 PATH 程序或读取历史 | 首启可被投毒二进制或含 secret 的 session 文件利用 | 自动阶段纯静态，执行进入 cage，sentinel 证明文件未打开 |
| A7 | 登录态、订阅授权与 API 技术可用混同 | 违反厂商条款，尤其中国 Coding Plan 与消费订阅 | 精确 product/surface/useCase/operation 的限时 RightsReceipt |
| A8 | route、费用、overage、数据位置混成文案 | gateway 可绕过 no-new-spend，地域提示无法计算 | Billing/DataBoundary receipt + 原子 SpendAuthorization |
| A9 | evaluator family/route 可自报 | 同一权重或动态 gateway 被误判为独立复核 | 只认可验证 artifact/effective route；fallback 全槽重算 |
| A10 | migration 非原子且不能真实降级 | config/SQLite/Keychain 半迁移，旧版本找不到 secret | inactive dual-read、activation journal、CAS、上一版降级演练 |
| A11 | registry 只有签名没有抗回放/撤销 | 旧 endpoint 或旧权益可凭有效旧签名重新生效 | trust root、generation/expiry/revoke/anti-rollback、rights 独立审核域 |
| A12 | App Server/ACP 与现有 D8/Gate 合同冲突 | Agent 可能绕过 dispatch 或逐工具审批 | owner 裁决执行面归属；Gate 0 和每种副作用前 gate 都须可证明 |
| A13 | 生态事实和计费自检不精确 | Gemini/Kimi/CC Switch 错路由，或一次点击触发多次付费请求 | 拆产品与 surface；候选/验证分层；显示请求/token/最坏费用上限 |
| A14 | 现有 `ChatRequest/ChatResult` 是最低公分母合同 | Responses item、Anthropic content block、reasoning signature、并行工具和流式 terminal 会被丢失或猜测 | 建立无品牌、可保真的 Inference IR 与显式 adaptation-loss gate |
| A15 | provider、协议、发现、认证和执行仍靠核心目录内分支扩展 | 新增长尾接入必须修改 daemon 核心，贡献者难以独立验证，回归面随 provider 数线性扩大 | 公共 Connector SDK、声明式 provider pack、单向包依赖与 Connector TCK |
| A16 | discovery/config/policy 与请求执行没有编译边界 | 数据库、目录刷新、在线 registry 或昂贵校验可能进入热路径，拖慢首 token 并放大故障 | 控制面编译不可变 ActiveSupplySnapshot，数据面只消费已钉住计划与有界 admission transaction |
| A17 | 第三方可执行扩展尚无隔离与发布信任模型 | 动态 import/npm 插件可读 daemon 内存和 secret，崩溃可拖垮主进程，更新可被回放或替换 | GA 只开放内置驱动和 TUF 分发的声明式 pack；代码插件走签名、版本化、无环境权限的进程外 RPC |

### 2.3 重要但可分期的 B 级缺口

- 没有 OpenAI Responses、Anthropic Messages、Google GenAI、Bedrock Converse、Azure/Vertex IAM。
- 没有 provider/model 在线目录、离线快照、废弃模型迁移与地域端点策略；现有 DeepSeek 模型名已依赖手工常量，容易随上游更新失真。
- 没有 Ollama、LM Studio、oMLX、llama.cpp、vLLM、SGLang、LocalAI、Jan、Xinference、TGI 等本地服务探测。
- 没有 CC Switch、OpenCode Server/ACP、Kimi Server/ACP、LiteLLM、One API/New API、Portkey、Vercel AI Gateway 等桥接层概念。
- 没有 AWS profile、Google ADC、Azure Entra/Managed Identity 等非静态 key 认证。
- 没有按协议与模型做 capability conformance，当前主要靠品牌名和模型名前缀推断 tools、structured output、reasoning、vision。
- 没有配置漂移检测；CC Switch 或 CLI 配置切换后，SayDo 可能继续显示旧画像。
- 设置页没有稳定的“来源、权益、费用、健康、上次验证、实际模型”状态中心。
- 首次引导仍把内部四槽和技术字段放在用户主路径上，且“添加 API”会把一个模型铺满四槽。
- 没有独立的 connector maturity、protocol conformance、运行时健康和 rights 状态四条轴；一个含糊的“支持”标签无法说明到底证明了什么。
- 没有 parser chunk-boundary property test、协议 fuzz、activation/ledger model-based crash test、故障注入、热路径基准和 connector 机器可读认证报告。
- 公开版本尚未形成 Connector SDK 兼容政策、reference connector、脚手架、贡献者 TCK、SBOM、构建 provenance 与签名发布的完整开源供给链。

## 3. 目标用户旅程

### 3.1 首次打开：系统先工作，用户后选择

首次打开按下面顺序进行，界面不阻塞：

1. 立即显示缓存画像，文案为“正在确认你本机已有的 AI 服务”。
2. 后台并行探测 CLI、官方 agent surface、loopback 服务、已启用 bridge、既存 SayDo connector 和凭据是否存在。
3. 按 §12.1 的唯一 SLO 形成首轮结果；慢探测继续后台更新，不让主界面一直 skeleton。
4. 卡片必须区分“发现的候选”“可激活推荐”“已验证推荐”，不能把只看见端口或二进制的候选写成已经可用。
5. 如果存在至少一套满足硬约束的组合，直接显示一张主卡：
   - 标题：“已为你配好”；
   - 主按钮：“用这套开始”；
   - 三条事实：“使用哪些来源”“是否可能新增费用”“数据会去哪里”。
6. 备选只提供四种意图，不要求懂模型槽：最快、尽量不新增费用、本地优先、质量优先。
7. 没有可用组合时，先按 rights 状态过滤，再按“只差一个动作”排序：登录已有且允许的 CLI → 打开已安装本地服务或查看启动方法 → 填一个已识别 provider 的 key → 添加完全自定义端点。`unknown/forbidden` 权益必须先于缺 credential 显示，不能诱导用户先交 secret。

### 3.2 主动配置：provider first，而不是 URL first

添加服务的默认流程：

1. 选择来源：官方 API、Coding Plan/订阅、本地服务、云账号、桥接工具、完全自定义。
2. 选择 provider 或让已检测结果预选。
3. 系统自动填 protocol、Base URL、auth 类型、region 与 model catalog。
4. 只显示该来源真正需要的字段：
   - 官方 Bearer API：只填 key，URL 和协议折叠；
   - Anthropic Messages：只填 key，自动带 `anthropic-version`；
   - Ollama/无认证 oMLX：不显示 key；
   - Bedrock：选named static profile或role/SSO/temporary-session profile、region、model，不要求复制AWS secret；两类走不同签名/issuance合同；
   - Vertex：复用 ADC，只显示 project 与 location；
   - CC Switch/OpenCode bridge：连接公开proxy/server surface，不复制其上游token；没有公开authority时明确标route/funding opaque。
5. 系统列出模型并标注能力；无法列模型时才允许手填，并在自检后钉住 observed model。
6. 用户确认一次最小真实自检；provider-first view model、proposal、disclosure 与 Gate 必须共用同一个费用判别：
   - `priced_candidate`：先列本轮 provider/model、最大请求数、输入/输出 token 上限，并把最坏费用按计费单位逐行展示；任一 component、overage 或 worst-case 无法确定时禁止创建该分支的测试授权；
   - `externally_metered_unknown_custom`：只接受 exact owner/admin private rights，明确展示“SayDo 无法读取价格或硬上限”、外部计量主体、请求数、输入/输出 token 与 physical request cap，并逐次确认；
   - `externally_metered_unknown_official`：只接受官方企业 unknown rights，以独立措辞展示协议价、credits、成本中心或 hard cap 不可权威读取及外部计量主体，同样冻结请求/token/physical cap并逐次确认。两条 unknown 正向旅程不得被 `priced_candidate` 的前置拒绝条件误伤，也不得进入推荐、fallback、后台或无人值守调用。
7. staged 与 live 两轮都通过后激活；失败保留旧配置并给出一个最可能的修复动作。

### 3.3 被动使用：健康时安静，变化时有处方

运行中只在用户需要动作时出现提示：

| 场景 | 主提示 | 主动作 | 禁止行为 |
|---|---|---|---|
| CLI 登录过期 | “Codex 需要重新登录” | “打开登录” | 不展示原始 OAuth token |
| 本地桌面服务停止且有受信启动入口 | “Ollama 已停止，对话暂不可用” | “打开 Ollama” | 用户点击后才交给系统打开；不自动切付费 API |
| 本地 headless/容器服务停止 | “本机 AI 服务已停止，对话暂不可用” | “查看启动方法” | 复制命令是次级链接；不自动启动、拉取或加载 |
| 订阅额度耗尽且恢复时间已知 | “本期额度已用尽，预计在…恢复” | “等待恢复” | “改走付费来源”只能是次级入口，进入独立费用确认 |
| 自动超额可能开启 | “这个来源可能在套餐用尽后扣余额” | “查看费用边界” | 不显示“订阅内零成本” |
| 模型或协议能力不足 | “当前模型不能稳定返回工具结果” | “换成已验证模型” | 不用含糊的“上游错误” |
| bridge 配置漂移 | “本地代理配置已经改变，原验证结果已失效” | “重新验证本地代理” | 没有公开route authority的代理不得提供“保留旧路由”；只能按新的opaque-route限制重新验证 |
| 权益规则变为 unknown/forbidden | “该订阅暂不能继续由 SayDo 使用” | 当前domain subject与session上动态生成的rights capability | 不继续消费旧 token；只有`resolveRightsBlockedPrimaryActionV8`解析出同provider intent、准确realm、未过期且auth journey可执行的官方目的地才显示“改用官方 API”，否则显示“选择其他来源” |
| 自定义端点证书或 host 改变 | “端点身份发生变化，需要重新确认” | “查看变化并重测” | 不沿用旧 receipt |

设置页保留一个“AI 服务”状态中心，每个 connector 只展示：来源、实际模型、健康、费用类型、数据位置、上次验证、需要动作。协议、header、SecretRef 等技术细节默认折叠。

## 4. 目标架构

### 4.1 两条供给平面必须拆开

#### A. Inference Supply

服务于 `dialog`、`thinking`、`cheap`、`evaluator`。合同目标是受控的文本/多模态推理、工具调用、结构化输出、流式和取消，不允许 provider 自主读写工作区。

#### B. Execution Agent

服务于开发执行。它与现有 Tier 1/Hopper 的落点由 owner 在 Phase 0 裁决；在裁决前只定义安全边界，不擅自改 D8。Codex App Server、Claude Code、Cursor、OpenCode ACP 等属于此类候选，因为它们拥有自己的 agent loop、工具和审批语义。

这些候选**不是同一种协议形态**，接入成本相差一个数量级（2026-08-25 实测，详见 §6.2 与
[`../review/2026-08-25-agent-cli-acp-capability-survey.md`](../review/2026-08-25-agent-cli-acp-capability-survey.md)）：

| 形态 | 代表 | 接入方式 |
|---|---|---|
| **ACP**（互操作标准） | goose、opencode、kimi、gemini、copilot、qwen —— 实测 6 家应答同构 `initialize` | 一个共享 ACP driver + 一套 TCK 覆盖全部；按各家声明的 `agentCapabilities` 降级，不按品牌写分支 |
| **专有双向协议** | Codex `app-server`（仍 `[experimental]`，v1/v2 并存） | 独立 driver；与 ACP driver 共用同一双向会话抽象 |
| **无回话通道的 CLI** | Claude Code、Cursor | 只能靠写 hook 配置文件同步阻塞拦截（D8 现状），不具备协议级审批回调 |

第三类正是 SayDo 现有两个 Tier 1 后端所属的形态；前两类需要的双向会话抽象是同一种东西，
本方案不预设应否引入——那属于 §14 决策 2。

一个产品可以同时出现在两条平面，但必须是两个 connector definition 和两份 conformance receipt。例如：

- Kimi API 可作为 Inference Supply；Kimi ACP/Server 可作为 Execution Agent。
- OpenCode Zen/Go API 是两个不同资金模型的 Inference Supply；OpenCode Server/ACP 是 Execution Agent 或 bridge，不因为它能连接模型就自动成为无工具 Inference Supply。
- Codex App Server 是 Execution Agent；OpenAI Responses API 是 Inference Supply。

### 4.2 合同必须拆成连接、绑定、执行器与不可变收据

Phase 0 在 `@saydo/contracts` 增加严格判别联合。以下是语义草图，不是允许施工方自由扩展的属性袋：

> **合同草案**：见 [`ai-supply-contracts-draft/01-core-contracts.ts`](ai-supply-contracts-draft/01-core-contracts.ts)（24,283 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


合同硬约束：

- `BuiltinInferenceProtocol` 是保留的稳定 ID 集，不等于同一 Phase全部已交付。Phase 2 mandatory只有 `openai_chat_completions/openai_responses/anthropic_messages`；`google_genai` 随 Phase 3 的 Gemini垂直切片首次可激活，`bedrock_converse` 随 Phase 7云连接首次可激活。某 ID 在对应 implementation、TCK、feature flag和GA entry完成前只能出现在registry candidate，不能生成 `ProtocolImplementationReceipt`、Activation或支持徽章；release manifest明确列 `implementedBuiltinProtocolIds`，未列项 fail-closed。
- 一个 inference connection 可以在同一 credential/account/topology 下提供多个协议 route；每个 route 有独立 `InferenceEndpointIdentity`，四槽分别绑定模型，不再把 connection 与单一 model/path 锁成一个对象。Execution 使用独立 `ExecutionEndpointIdentity`，把 surface、ACP/Agent HTTP wire profile 纳入身份；同 host/path 的 inference 与 execution 永远不是同一池、receipt 或 hard-stop subject。
- `auth=none` 只允许经运行时验证的 loopback；Internet 必须有受支持认证。`networkScope` 是 dialer 的验证结果，不是用户可自报字段；loopback 不是 local compute 证明。
- 远程服务若只用双向TLS认证，必须选择`transport_mtls_only`，并让transport中恰好一份client-identity component、证书principal/version、TLS layer、recipient、egress与ACL全部命中；不能为通过schema伪填Bearer。`upstream_managed_credential`只允许具名官方Execution surface。AWS role/SSO/web/instance identity、GCP与Azure workload identity走独立issuance cursor和每请求短期credential lease；AWS named static profile走`aws_static_profile_sigv4`与每请求signing lease，不伪造STS issuance。两者都禁用隐式default chain、credential-process、CLI helper、未授权metadata endpoint和SDK隐藏retry。
- `app_server_stdio`、ACP、agent HTTP 不能出现在 inference union。CLI 只有在操作系统级证明“不可读工作区、隔离 HOME、关闭非目标网络”时才可能作为 inference；否则一律进入 execution 或 inventory。
- `ResourceScopeReceipt` 是不可变判别联合：loopback transport、local/LAN compute device、provider/cloud 资源与 execution workspace 是不同 kind，不得互换。云资源按 provider kind 强制 account/project-or-subscription/region/deployment-or-resource 的全部必填键；普通 API 绑定具名 providerResource/apiProduct 和 `explicit_region | provider_managed | global_endpoint | unknown` 判别型 region scope，不允许用任意字符串制造身份差异，也不能把 endpoint scope 冒充 processing-region 证明。执行资源只允许解析后仍在具名 workspace root 内的路径与登记 egress。`/`、HOME、通配符、空 roots、symlink 越界、缺任一云资源键和无界默认云凭据链均拒绝。本地路径授权必须使用 handle/file-identity 约束的 resolve-and-contain，禁止 check-then-open 的 symlink 竞态。
- `superRefine` 封死缺 endpoint、缺稳定 AuthSubject/resource scope、危险 auth/network、协议/transport 错配、只按 operation 的宽泛 policy、重复/冲突 binding、空 receipt、空 `processingRegions` 和 `unknown/global` 与具体地域混装等非法组合。无可靠地域时只能规范化成唯一 `[{scheme:"unknown"}]`，所有地域子集谓词先拒绝空集，不能利用 vacuous truth 满足中国大陆或其他硬约束。
- 技术 catalog、TLS 与 dialer 不能单独授权 secret 出站。官方 preset 必须取得 `policy.tuf/credential-egress` 独立 delegation 签发的 `EndpointCredentialEgressReceipt`；完全自定义端点则必须显示精确 host/product 不再宣称“官方”，由用户生成范围相同的显式 egress consent。secret broker 只有在 endpoint/TLS/RequestProfile、provider product/resource/region、auth primitive、principal、credential source/version 全部相等时才取 key；只改 endpoint 的负例必须做到零 secret read、零网络字节。
- `ProductEligibilityReceipt` 只回答“这个 product/region/use-case/distribution 是否允许展示凭据入口”，不授权存储之外的任何行为；`permitsCredentialInput=true` 只允许 `eligible`，或精确绑定 endpoint/product/use/distribution/attesting principal/TTL 且显式标为非官方的 `user_or_admin_attested_custom`。`unknown/forbidden` 必须为 false。它取得 secret 后也不能替代 principal-bound Rights、credential-egress decision 或费用授权。
- `oauth_pkce/oauth_device` 共同先引用不可变 `OAuthFlowAuthorizationReceipt` 和逐 exchange 的 single-use lease，但最终 grant 是严格判别联合：PKCE 绑定 callback/state/S256 verifier/code；device grant 绑定 device code/user code/verification URI/poll ordinal，绝不伪造 callback 或 authorization code。client registration、SayDo app/distribution、issuer、精确授权/device/token endpoint、audience/authorized party、最终 subject/credential version 与每次敏感出站必须逐项绑定；规范化后的 granted scope 必须是 requested scope 的子集且覆盖该 connector 的 minimum scope，出现额外 scope、空缺 minimum scope 或大小写/分隔歧义均拒绝，不能错误要求所有 provider 必须原样返回相等 scope。并发 flow、poll sibling、callback 注入、code replay、issuer mix-up 或账号不等均不能生成 AuthSubject。
- 首测前只冻结不含 observed model 的 candidate route digest；首测响应后，每个 runtime inference route 才生成不可变 `EffectiveRouteReceipt`。direct/local 使用指向自身 `InferenceEndpointIdentity` 的 self-route，gateway/bridge 使用完整实际上游身份。上游不返回 model 时必须生成 `ObservedModelEvidence.kind=absent`，不能把 requested model 伪填成 observed；它只能形成 `unverified` 普通对话能力，禁止 evaluator、自动迁移、静默 fallback，且动态 gateway 若不能另证 route/model 则保持 inventory。该收据不反向引用 capability、compute policy 或 activation，避免引入新的 digest 环。
- receipt 是独立、版本化、不可变实体，引用必须带 `{id,generation,digest}`，且外键必须校验真实 receipt kind；endpoint、request profile、secret principal/version、credential source、resource scope、compute boundary、route 或 connector revision 改变时不能复用。Inference 使用 `InferenceResourceSubject` 同时钉住 transport endpoint/principal/credential/scope 与 compute principal/credential/scope、connection revision、model identity 和 hard-stop generation；`ComputeBoundaryCoreReceipt.resourceSubjectDigest` 必须与它完全相等。
- connection auth、对应的 `InferenceEndpointIdentity`、`InferenceResourceSubject.transport` 与 RouteSet 的 transport principal/credential/scope 必须完全相等；`InferenceResourceSubject.compute` 独立绑定实际推理 principal/credential/scope，不能由 transport 字段推导。首次首测的 producer 顺序固定为 endpoint/auth/scopes/requested model/candidate route → ConformanceAttemptSubject → ConformanceBoundary → conformance PolicySubject → 四份 policy receipt → ConformancePolicyBinding/ConformanceRouteSet/ConformanceAuthorization → 发出首测。响应后才按 observed model/effective route/model identity → InferenceResourceSubject → `ComputeBoundaryCoreReceipt` → runtime PolicySubject → 四份 runtime policy receipts → `ComputePolicyBindingReceipt` → ConformanceBillingMatch 或不可激活 anomaly → 按 operation 的 OperationBillingClosure 集合 → ConformanceResult → Capability/RouteSet/InferenceBinding/RuntimeSpend/Activation 生成最终闭包；anomaly 分支在 OperationBillingClosure/ConformanceResult 前终止，任何后继都不反向引用前驱，两段都保持可重算的无环 DAG。
- conformance 链也禁止松散换挂：Boundary 的 attempt digest、PolicySubject 的 attempt/boundary、ConformancePolicyBinding 的 subject/attempt/boundary/四份 candidate policy refs、CandidateRouteFence、ConformanceRouteSet member 与 Authorization attempt 必须逐项相等，且每个 attempt/ordinal 恰好出现一次。Dynamic CandidateDataBoundary 不反向引用 ConformanceRouteSet；它先独立冻结 bridge config、InvocationEnvelope，并为每个 member/attempt 保存完整 `DataBoundaryAlternative` 元组，随后 ConformanceRouteSet 必须与这些 alternative 的 ordinal/attempt/fence/boundary 集合逐项相等。runtime operator/region/retention/training/subprocessor/evidence 必须整体命中同一个 alternative；把 A 的 operator 与 B 的 region/retention 拼接，即使各列都出现过也必须拒绝。每个首测发送 lease 在安全 dialer 写出首字节前再验证 fence 未过期、generation/config/token 未变；SayDo 直连由 endpoint/auth/credential dialer lease 保证，本地 immutable process config 必须绑定同一 process identity，上游管理路由必须在 request admission 强制 token 或同步 callback。`unknown` boundary、无可执行 fence、0 条/多条 policy 命中、旧 candidate route 或其他模型的 evidence 均 deny。
- `ConformanceResultReceipt` 是候选链与 runtime 链的唯一接缝：公共 base 必须引用实际已消费 Authorization/UnknownConsent 的准确 attempt ordinal、CandidateRouteFence、Boundary/PolicyBinding、全部持久 sent/terminal ledger、真实 request/response/唯一 terminal digest、逐字段 authority extraction，以及由该响应派生的 EffectiveRoute/ModelIdentity/resource subject/core/runtime DataBoundary/adapter。billing 分支严格判别：`priced` 必须引用 candidate/runtime Billing、成功 Match 与按 operation 的 billing closure；`externally_metered_unknown` 必须引用 exact conformance consent、custom candidate 与按 operation 的 unknown closure，并永久标为 not covered/not settled。两支 receipt 不可互换。
- ConformanceBillingMatch **不保存也不信任任何金额向量副本**；严格 schema 拒绝额外的 candidate/auth/reserve/runtime/settled/terminal summary 字段。构造、Result verify、promote 和每次 dispatch 都按固定 `billing-limit-fold-v1` 从 typed refs 重新解析并重算：`candidateWorst = CandidateBilling.conformanceWorstCaseLimit`；`authorizedAttempt/authorizedAggregate = Authorization[attemptOrdinal].child/aggregate`；`attemptReserved/ingressReserved =` 两份准确 reservation ledger 的 canonical vector；有 conformance runtime Billing 时 `effectiveRuntimeWorst = conformanceRuntimeBilling.worstCaseLimit`，否则失败 member 使用 candidate worst；`memberTerminalTotal =` 对该 coverage 全部且仅有的 sent request 当前权威 `settled | charge_unknown` 状态逐单位去重 fold，其中 settled 取实账、charge_unknown 取仍被 hold 的最坏分量。任何 UI/审计 summary 都只能由相同 fold 生成并绑定 source digest，不能参与授权判断。
- fixed 的 coverageSources 必须恰好一项。dynamic 的有序 coverageSources 必须与本次 ingress ledger 中全部 sent attempt 一一相等，attemptOrdinal 唯一连续，member ordinal 序列必须是 InvocationEnvelope 登记的一条实际执行序列；每个 source 再按 `componentId + billerId + accountDigest + fundingSourceDigest` 无漏无重地覆盖全部可能 charge component。验证器先对**每个** component 的 CandidateBilling、runtime Billing、attempt reservation 与 terminal entries 逐单位检查 `componentTerminalTotal <= effectiveRuntimeWorst <= candidateWorst <= componentReserved <= componentAuthorized`，再按 attempt/member 和 ingress 分别聚合；不能把同为 USD 的上游 provider 费用与 gateway fee 合成一个主体，也不能用 B 的 runtime Billing 或 summary 覆盖 A。coverage/ledger 漏项、重复、错序、错 member/component、非权威 terminal、ref kind/digest 不等、fold 溢出或任一不等式失败都只能生成 anomaly；`runtime_worst_case_exceeded` 与 `ledger_coverage_mismatch` 不能降级为普通 price drift。
- priced CandidateBilling 包含对计划支持的每个 runtime `InferenceOperation` 的有序唯一 charge component 投影；每个 component 精确绑定 biller/account/funding/overage/价格/单位。每份 `OperationBillingClosureReceipt` 按同一 attempt/member/effective route/resource subject 钉住准确 ComputePolicyBinding，以及全部 component 的 runtime Billing、candidate projection 与成功 Match。unknown custom 则为相同 operation 集合生成 `ExternallyMeteredOperationClosureReceipt`，钉住 exact endpoint/custom rights/ComputePolicyBinding，但不生成金额或 covered 声明。任一分支的 operation closure 集合与 fixed Binding 或 RouteSetCore 对应 member 的 `computePolicyBindings` 必须完全相等；Capability 表明 tools 时必须同时有 `chat` 与 `tool_roundtrip`，静态对话则只允许其能力要求的集合。跨分支、漏项、重复 operation/component 或拿 B 的 Billing/rights 覆盖 A，都在 Result 构造、verify、promote 和首字节前拒绝。
- 新增 biller/account/component/unit、price version、funding/overage 漂移，runtime worst 被 settled/held 击穿，或任一 child/aggregate/reservation/ledger cap 超限时只能生成 `ConformanceBillingAnomalyReceipt`，零 OperationBillingClosure、零 ConformanceResult、零 Capability、零激活并 hard stop；已知新单位以独立 `charge_unknown` 分量记录，非规范单位以 opaque evidence 隔离并把该 account/route 锁到人工调和，绝不能用 FX 或其他单位余额抵扣。runtime 数据属性必须整体命中事前同一个 `DataBoundaryAlternative`；跨 member 拼接或超出 alternative 同样零激活、hard stop 和审计事件。Candidate receipt 永远不能满足 runtime 地域/本机承诺。Capability、fixed InferenceBinding、RouteSet member 与 ActivationManifest 必须引用同一结果；A 的结果挂给 B、candidate/effective data 或 candidate/runtime billing 换挂、未发送 attempt、失败 terminal、不同 adapter、fence、BillingMatch、operation closure 或 ledger 不匹配均拒绝。
- `ConformanceBoundary.kind=local_device` 与 runtime `ComputeBoundaryCore.kind=local_device` 必须引用同一 `LocalComputeEvidenceReceipt`；它在首测前同时绑定精确 attempt、route、requested model、candidate route、本机 device/runtime process、`LocalInferencePeerPolicyReceipt`、OS 观察的 conformance peer receipt、已加载 artifact、本机计算模式、route→artifact 映射和 runtime network-egress assurance。Activation 冻结相同 peer policy，且 `localInferencePeerPolicies` 必须与全部 `local_device` endpoint 按 endpoint identity 无漏无重相等，不因 endpoint 使用 Basic/Bearer/mTLS 就免除本机身份验证。**每个物理 dispatch**必须先在 connected socket 上生成 single-use `LocalInferencePeerLeaseReceipt`，再生成绑定当前 RuntimeRouteFenceLease/RuntimeUpstreamAttemptLease、当前 config/model-load generation、loaded artifact content+file identity、route→artifact、device 与 egress assurance 的 `LocalComputeLeaseReceipt`，两者都进入 PreparedAttemptDescriptor；有 secret 时 broker 只能在这两份 lease 成功后读取。端口、health、旧 conformance peer 和 runtime 自报 metadata 都不能替代本次 lease；服务重启、重载模型、改配置或抢占端口时旧 lease不可重放。平台不能强绑定时先提供 SayDo-managed 启动处方，否则只 inventory。
- 本机计算与数据出口受限是两份证据。已加载且能证明 artifact 映射的用户自启 runtime 可以得到 local compute，但它的 `RuntimeNetworkEgressAssuranceReceipt.kind=egress_unknown` 时，DataBoundary/data-egress graph 必须显示“模型在本机运行；该服务的外连未被 SayDo 限制”，不能进入本机数据局部性承诺。只有覆盖同一 process generation 的 OS network deny/具名 allowlist、完整文件同步/IPC/helper出口证明和上游受信等价证明，才可显示“本轮仅使用本机处理，已限制已知数据出口”；现有进程不能被事后追溯圈禁时，UI 提供经用户确认的 SayDo-managed isolated restart，而不是伪造 attestation。即使该证明通过，也必须另列设备级残余：swap、hibernation、core/crash dump、GPU/VRAM残留、虚拟机/容器快照、系统备份和管理员/物理访问不由进程 sandbox 自动消除；未有平台级加密、清理和备份排除证明时，禁止使用绝对“不会留下副本”或“完全不出机”文案。
- 对默认会卸载模型的冷态，本机已安装 artifact 不能冒充 loaded evidence。`local-preload-v1` 先从 artifact/runtime 受信 metadata取得内存估算；默认 `protectedSystemReserveBytes=max(2 GiB, physicalMemoryBytes*20%)`，`maxResidentBytes=min(userCapBytes, availableMemoryBytesAtGrant-protectedSystemReserveBytes)`，默认墙钟 120 秒、全局仅一个 preload、零下载字节和零外网。估算缺失、超过 cap 或可用内存不足时为 `action_required`，用户可对显示的精确 cap/最长 10 分钟作一次覆盖，但不能取消系统保留、网络 deny 或下载禁止。只有 SayDo 管理且隔离的 daemon，或提供可原子证明 no-download/local-only admission 的上游，才能取得 `LocalPreloadAuthorizationReceipt`；不能把限制 helper 误写成限制目标 daemon。成功结果才生成 loaded evidence，OOM/取消/route 变云/LAN/发生外联均零 conformance。首测后 `LocalModelIdentityBindingReceipt` 还要把 observed evidence/model identity映射到同一 artifact；任一换挂在下一首字节前 hard stop。
- `PolicyBinding.computePolicyBinding` 仍是一条 operation 精确收据；fixed InferenceBinding 与每个 RouteSetCore member 保存按 `InferenceOperation` 键控、非空且无重复的 `computePolicyBindings` 集合，ActivationManifest 冻结完整集合。每次 dispatch 按当前 operation 必须恰好选中一项，并与对应 PolicyBinding、当次费用授权引用同一外层 `{id,generation,digest}`；集合缺项、重复项或跨 operation 复用都 deny。它们引用的 `computeBoundaryCore` 也必须与外层收据逐项相等。四份 policy receipt 的 subject digest 必须等于外层 `policySubjectDigest`。
- conformance 的 `CandidateRouteFenceReceipt` 永远不能充当日常流量 fence。ConformanceResult/Binding/RouteSet 完成后，先对“不含 fence ref 的 canonical binding/RouteSet identity projection”生成每 operation 的 `RuntimeRouteFenceTemplateReceipt` 与 `RuntimeInvocationEnvelopeReceipt`，再让 fixed binding、RouteSetCore、FundingPolicyTemplate、ActivationManifest 和 snapshot 全部引用同一对象；由共同 identity digest 对账而不制造 digest 环。template 的 `fixed | route_set` target 必须判别明确，`enforcementByRoute` 与非空 allowed-effective-route 集合逐项相等；fixed 无重试序列是 `[fixed]`，每次可计费重试必须作为新的 repeated fixed ordinal 进入 envelope、reservation 和 terminal fold，route-set 同理。每次调用的 ingress admission 原子生成 single-use `RuntimeRouteFenceLeaseReceipt` 和 durable cursor；direct/managed local 由 SayDo reference monitor 落实，gateway/bridge 只接受独立不可绕过 enforcement authority 的单次 admission 或同步 callback。**包括 direct 在内的每个物理上游请求**都取得 cursor successor CAS 的 `RuntimeUpstreamAttemptLeaseReceipt`；首项 predecessor 为空，后续项精确指向前一 ordinal，两个 sibling 或未列出的隐藏 retry 零字节。只读一次配置、自签 attestation、仅 aggregate cap 或响应后才报告路由都不是 fence；做不到的 gateway 只能 route-pinned/inventory。
- 动态队列在首测前只生成 `ConformanceRouteSetReceipt`，其中每个有限成员绑定独立 attempt subject、候选计算边界与 conformance policy；不含 observed model、Capability 或 runtime binding。它还必须引用 `RouteInvocationEnvelopeReceipt`，冻结一次 ingress 内全部可能的上游 ordinal 序列、bridge retry/failover 次数，并由 SayDo-owned dispatch、上游 single-use sequence token 或每次首字节前 callback 之一执行；只提供 aggregate hard cap 不能证明序列。无法证明有限完整序列或上限时只能 route-pinned/inventory。全部需要的成员完成首测后，才生成引用同一 invocation envelope 的 `RouteSetCoreReceipt` 与最终 `RouteSetReceipt`。最终收据必须引用同一 core，并按 ordinal/resourceSubjectDigest 一一绑定各成员 ConformanceResult 与 Capability；不得漏项、增项、重排或换挂。route_set 分支的 InferenceBinding 只引用最终 RouteSet，不得再携带单值 route/model/core/capability 冒充成员证据；dispatch 按实际 ordinal 从 RouteSetCore+RouteSet 解析完整闭包。`provider_cloud` core 的 effectiveRoute、InferenceResourceSubject 的 effectiveRoute、CapabilityReceipt 的 effectiveRoute/modelIdentity/resourceSubject/core 与 Binding/RouteSet/Activation 中的引用也必须逐项相等。任一不等、旧 local core 复用、跨成员 capability 复用、上下游 principal/scope 互换或 gateway 隐藏实际 compute subject 都 deny。
- InvocationEnvelope 的序列集和每条序列都必须非空、有限、成员 ordinal 全部存在，显式包含 provider retry 和 bridge failover，且 `maxUpstreamInvocations` 等于最长序列；执行证明只能是 SayDo 自己拥有完整 dispatch 且证明无隐藏 retry、上游 single-use sequence token，或每个上游首字节前同步 callback，单独的 aggregate hard cap 不能证明路由序列。`route-set-v1` 固定上限为 16 members、64 sequences、单序列 16 次 upstream invocation、1024 个 receipt graph node、16 层深度和 1 MiB canonical JSON，不能由 receipt 自报放宽，也不能用“有限”接受指数对象图。空序列、未知重试、运行时可追加成员、超限对象或仅声明“最多一个实际成员”均拒绝。callback/admission attestation 改变属于 route hard stop；未来增大上限必须发布新 profile、做内存/CPU 基准并重新授权，不静默改 v1。
- Execution Agent 使用逐 operation、逐 session 的独立费用闭包。`ExecutionAgentConnection.fundingTemplates` 与 execution policy binding 在 operation 上必须非空、唯一且完全相等；known-metering template 强制给出 session worst-case 与 physical request cap，不能 optional。`ExecutionSessionConsentReceipt` 公共部分精确绑定 pre-session admission subject、session、operation、template/component set、总 physical count、披露/用户决定、generation、expiry、撤销、turn 与墙钟 cap；known 分支另绑定逐单位金额向量，unknown 分支明确承认没有权威 price/hard cap而不伪填金额。admission 中的 aggregate cap 必须逐项等于或小于 consent，不能独立填大。`session_authorization` 的 reservation 必须与 template全部 component 一一对应；每个物理模型请求形成 coverage source，按固定 fold 核对。只有 covered match 可写 `settled`；漏项、重复、迟到 usage、route/account 漂移或无权威 usage 一律 `charge_unknown`/anomaly。`externally_metered_unknown` 只保留为用户逐 session 明示的独立 terminal，不得包装成 settled、no-new-spend、自动推荐或 fallback。
- 每个 Execution tool intent 先由 host 按持久 workflow intent 分配跨恢复稳定的 `logicalToolInvocationId`；`idempotencyKey` 只由该 logical ID、tool semantic version、arguments、resource scope、execution subject 与用户意图 generation 规范化生成，attempt/toolCallId 只作 lineage refs，不得改变 durable identity。恢复后的新 tool call 必须携带受 conformance 证明的 replay lineage 指回既有 logical ID；无法证明时停在人工调和，不按相同 arguments 猜测。状态由 append-only CAS transition 追加；正常路径为 `none→authorized→executing→executed→result_recorded`，hard stop 在 commit lease 前且能证明无 effect 时允许 `authorized|executing→aborted`，绑定 abort evidence和准确费用释放/hold 决定；effect 不能排除时只能 `executing_unknown`。从 unknown 返回必须有权威 effect evidence 与 owner decision。每次 transition 引用 session lease、execution subject、准确 Gate/approval、generation 和工具自己的 funding decision。工具 consent 还精确绑定 component set、逐单位金额、最大外部 physical calls 与披露，session 泛化同意不能代替；无外部费用也要有 no-external-charge proof。
- 不可逆工具提交使用短生命周期 `ExecutorCommitLeaseReceipt`。撤销先进入 `revoking_requested` 并阻断新 commit lease，通知所有 in-flight executor；尚未提交者必须在 rename、外部 commit 或 process/network side effect 紧前取得 lease。撤销只有在旧 lease 已提交并持久记录，或明确 abort/进入 `executing_unknown` 后，才线性化增加 generation 并宣告生效；因此生效点之后不会发生旧 generation 的本机提交。无法提供 prepare/commit、上游 idempotency 或可验证查询的外部动作发生不确定崩溃时只能人工调和，绝不自动重放。
- Execution 激活只冻结`ExecutionPeerIdentityPolicyReceipt`与`ExecutionSandboxPolicyTemplateReceipt`，不能伪造尚未存在的PID/runtime receipt。任何spawn/connect/session-create字节之前先取得`ExecutionSessionAdmissionReceipt`，再经`ExecutionSessionStartCursor → StartLease → StartIntent → StartTerminal`；start intent在任何process/network/stdio字节前持久化stable external session/process identity与费用reservation，success terminal才允许生成`ExecutionSessionLeaseReceipt`。delivery unknown保留费用hold且不得盲重试，恢复只能权威查询并adopt既存session、清理orphan或继续unknown；本地进程和远程session都不能重复创建。loopback ACP/agent HTTP随后另取`LocalExecutionPeerReceipt`，CLI/App Server/ACP stdio则从no-follow已打开对象执行，或先复制到SayDo控制的content-addressed immutable staging，并在spawn后核对实际image identity。runtime sandbox覆盖root PID-start、完整process tree、workspace/mount、继承FD/HANDLE、filesystem/sync/temp/log、IPC/shared memory、egress和直接syscall report；driver sandbox不能代替Agent sandbox。既存peer无法重新圈禁，或Agent不能把所有网络及写/命令/副作用交回host broker/Gate时只inventory。远程官方Agent surface不能伪填本地PID；只有不同信任域的enforcement authority证明不可绕过sandbox、网络broker与每个副作用前callback时才能走`upstream_attested_agent`，服务自报只作inventory。
- Inference 与 Execution 都用完整 `PolicySubject` 精确匹配。ComputeBoundary core 只绑定 resource subject，避免反向引用；ComputePolicyBinding/Network/Rights/Billing/DataBoundary/Spend/Gate 等后继收据必须内含对应 policy/resource subject digest。调度时必须**恰好一条** binding 命中且所有 digest 相等。0 条、多条或任一换挂一律 deny，不能用 connection 级 `allowed` 兜底。
- mutation 使用 `expectedRevision` 做 CAS；ID 使用 `con_` ULID，不为 connector 另造 UUID 例外。

### 4.3 能力而不是品牌决定能否进槽

`CapabilityReceipt` 不是可跨路由复用的“模型能力卡”。它必须先绑定 `ConformanceResultReceipt`、`resourceSubjectDigest`、`computeBoundaryCore`、`effectiveRoute` 与 `modelIdentity` 的完整 `{id,generation,digest}`，再记录：

- streaming 与首 token；
- text、vision；
- tool definitions、tool choice、tool result continuation；
- JSON mode、JSON Schema strictness；
- reasoning input/output 字段；
- usage 与 cache usage；
- model listing、requested model、observed model；
- cancel/timeout；
- 最大已验证 context/output；
- receipt 生成时的 endpoint identity、connector revision、adapter version 和模型。

`CapabilityReceipt` 只证明上述精确 subject 上的功能，不单独证明计算位置。每个可激活 inference binding 还必须有模型级组合证明：`ComputeBoundaryCoreReceipt` 描述位置，`ComputePolicyBindingReceipt` 无环绑定其 Network/Rights/Billing/DataBoundary。`local_device` core 必须同时绑定本机 device、runtime process、OS 观察的 peer、已加载本地 artifact、route→artifact 映射和 `RuntimeNetworkEgressAssuranceReceipt`；`lan_device`/`provider_cloud` 必须绑定实际 route、principal、Billing/DataBoundary；`unknown` 不得进入本地优先、no-new-spend 或“数据不出本机”。

四槽硬需求：

| 槽 | 必需能力 | 推荐倾向 |
|---|---|---|
| dialog | `plain_dialog` 只要求文本、流式与取消；需要工具的工作流再要求 `tool_dialog` 的完整工具往返 | 当前健康且最快；受限能力要明示 |
| thinking | 长超时、reasoning、长上下文 | 质量优先，不要求最低延迟 |
| cheap | 稳定短输出、结构化结果、低费用 | 本地或低价 API 优先 |
| evaluator | strict schema、observed model、与主推理不同 family/route、隔离合格 | 独立错误链优先 |

未知能力不能由 provider 名猜成支持。registry 只给候选；真正进入“已验证推荐”前必须有版本化 conformance receipt。

`plain_dialog` 是正式的基础对话profile，不是失败降级或隐藏旁路。它可以让文本-only Ollama、llama.cpp或其他本地模型进入`conversation_ready`，但该source的Activation必须机械只开放`chat`，隐藏并拒绝工具按钮、Execution编排和依赖tool roundtrip的工作流；若同一解决方案另有独立`tool_dialog`/Execution source，可在其准确source边界单独开放。UI显示“可聊天；此模型不支持工具操作”，并提供次级“换用支持工具的模型”。只有`tool_dialog`通过tool definitions、choice、delta拼装、result continuation与费用/副作用TCK后，才可把工具入口指向该source。

模型身份分三档：`exact`、`alias_verified`、`unverified`。`unverified` 经用户明确选择后只能用于普通对话降级模式，不能用于 evaluator、静默 fallback 或自动模型迁移。用户手填 family 只帮助展示，不能成为 evaluator 独立性证据；只有 artifact/provider/effective-upstream 的可验证身份才能参与独立性判定。

动态 gateway/bridge 不能用“调用后再看实际路由”代替调用前决策。只有取得 §4.2 的不可变 `RouteSetReceipt` 才能激活：有序成员必须非空、无重复且是完整可能集合，每个成员的 endpoint、principal、protocol、model/family、capability、compute boundary、network、rights、billing 与 data boundary 都有独立收据。求解每个槽位时要对**全部成员**验证硬约束；evaluator 还要对集合中每个 family/route 与其他已激活槽做独立性笛卡尔积检查。请求发出前必须原子 pin RouteSet、RouteSetCore、InvocationEnvelope、FundingPolicyTemplate 的 generation 与 bridge config digest，且 bridge 必须在 request admission 时强制同一 fencing token；只读一次配置再发请求不算冻结。集合不完整、不能冻结或任一 generation CAS 失败时只保留 inventory，不发请求。

Phase 0 还必须在 `docs/09-data-contracts.md` 定义版本化 Request/Event/Terminal/Usage 联合与状态机：事件序号、唯一 terminal、tool delta 拼装、thinking/signature 保真、usage 权威来源、未知事件、大小上限、cancel/error 优先级都要可判定。默认只允许在收到任何响应字节前重试；收到部分响应后，除非上游有明确幂等键且适配器已经验证，否则失败终止，避免重复工具执行和重复计费。

readiness 分成三层：

- `connected_verified`：某一连接的 staged/live conformance 已通过，但尚不代表推荐解已具备预算、槽位能力或可启动状态；
- `conversation_ready`：至少一条允许且通过基础 conformance 的普通对话供给可用；可以单来源降级启动。
- `review_ready`：四槽硬约束和 evaluator 独立性都满足，才允许宣称具备独立复核。

当前 canonical 允许同 family 显式降级，而本文建议独立 evaluator 优先。是否保留该降级路径必须由 owner 在 Phase 0 裁决；即使保留，也只能标为 `conversation_ready` 或“缺独立复核”，不能伪装成完整验收能力。

### 4.4 Provider Registry

内置 registry 是“数据”，不是可执行插件：

- 随版本发布一份由 release digest 覆盖的离线技术快照，保证中国大陆网络受限或完全离线时仍能生成常见来源候选。它可长期用于 inventory/candidate，但过期事实必须显示 stale，不能越过当前 rights、conformance 或 endpoint 自检直接激活。
- 在线分发不自造“一个签名 + generation”协议，而采用 The Update Framework。`catalog.tuf` 与 `policy.tuf` 使用不同初始 root、key set、threshold 和发布权限；客户端随正式 release 固定可信初始 root，按 TUF root → timestamp → snapshot → delegated targets 工作流校验版本、期限、hash、length、consistent snapshot、rotation/revocation 与 rollback/freeze/mix-and-match。
- 技术 targets 包含 provider、地域、endpoint、协议、认证、模型 alias、能力候选、弃用日期、计费/权益/数据文档链接和声明式 provider pack。`policy.tuf` 在独立 root 下再使用互不重叠的 delegated roles：`credential-egress`、`rights`、`billing`、`data-boundary`、`emergency-deny`；各 role 有独立 key/threshold/path namespace，不能互签。每份 policy/extractor receipt 记录 root、timestamp、snapshot、逐级 delegated metadata 的 version+digest，target path/hash/length、consistent-snapshot identity、threshold、anti-rollback high-watermark 与 verifier generation；审查者可重放 rotation、revocation、rollback 和 mix-and-match 判定。技术 catalog 及被攻破的链接不能自动生成 secret egress、Rights/Billing/DataBoundary 真值；法律/权益判断必须带 `decisionSource=vendor_explicit|owner_review|legal_review` 与证据摘要，credential endpoint、价格和数据政策同样需要对应授权链。
- Node 客户端优先评估 CNCF TUF 组织维护的 `tuf-js`，固定精确版本并跑上游 TUF conformance corpus、Windows path、恶意 metadata、过大 targets、过期/断网/错误时钟和缓存损坏测试。若它的 Node engine 或安全修复节奏不满足 SayDo release 窗口，Phase 0 ADR 才能选择另一维护中实现；禁止手写第二套 verifier。
- 在线刷新验签失败、schema 不兼容、过期、回放或内容异常时，不覆盖当前 cache/active。技术 catalog 可回到 release-bundled candidate snapshot；rights cache 过期即 `unknown`，不能用旧 LKG 继续授权。任何 LKG 都不能覆盖 emergency deny 或 rights 撤销。
- models.dev 可作为模型元数据输入之一，但不能直接决定权益、SecretRef、SSRF 放行或 conformance 结论。
- registry 不保存用户 key，不执行 shell，不下发 JavaScript/Wasm，不允许任意 header 模板引用本机文件。target 解压/解析使用总文件数、单文件/总字节、路径深度和 schema complexity 上限，拒绝 archive traversal、duplicate key 与 Unicode confusable ID。
- provider 更新后先产生“可用更新”，不自动迁移 active model；模型废弃时给出迁移预览与自检。任何展示名称、model label 和错误说明都按不可信文本转义，不允许 registry 内容形成 HTML、命令或路径注入。

### 4.5 Secret 与 endpoint 身份

1. `Connector.id` 使用稳定 `con_` ULID；同一 credential/account/topology 下可有多个 route。同一 host 的不同 port 通常是不同 connection；不同 path/protocol 至少是不同 `ProtocolRoute` 与 `InferenceEndpointIdentity`，Execution surface 使用 `ExecutionEndpointIdentity`，两平面不能共用 receipt。ID 本身不等于 endpoint identity。
2. 两类 endpoint identity 共用严格规范化基类，并分别绑定 scheme、IDNA host、显式 port、规范 path、inference protocol 或 execution surface/wire profile、TLS policy、auth kind、connector revision、secret version、credential principal 与 `RequestProfile.digest`；拒绝 URL userinfo、fragment、**全部自定义 URL query**、非 HTTP(S) 和异常 IP 表示。确需 `api-version`、deployment 等公开参数时，只能由 registry 或受限高级表单写入版本化 `RequestProfile`：参数名/值按 UTF-8 和 percent-encoding 规范化、唯一键拒绝重复、按名排序，不允许 secret。其 digest 同时进入 endpoint identity、全部 receipt、activation manifest 与 hard-stop 键。
3. SecretRef 至少精确到 connector 与 secret version，不再复用 `OPENROUTER_API_KEY` 兜底槽。UI 的“指纹”是设备本地密钥参与计算的截断 HMAC，不显示 secret 原文的任何字符。
4. secret 只能由 daemon 或独立 secret broker 取用，Execution Agent 的 env、HOME、cwd 和 stdin 永远不含 connector secret。OS keychain 只有在能证明进程/签名 ACL 或独立服务身份时才算 Agent 隔离；`0600` 文件只提供静态权限，不能抵抗同 UID Agent，不得作为安全 fallback。平台无法提供可证明隔离时，相关远程 connector 保持不可激活。
5. 旧 env key 迁移前保留只读快照；新旧 secret 的创建、绑定、activation、回滚与清理由同一 activation journal 管理。导出/诊断包默认永不包含 secret；备份若包含只能使用独立加密和显式用户动作。
6. HTTP redirect 默认关闭；若 provider 明确需要，只允许 registry 固定的同源路径跳转。每跳手动重验，host/scheme/port 变化不转发 Authorization、Cookie 或其他 credential。
7. 所有请求走唯一安全 dialer：一次解析并检查全部 A/AAAA/CNAME、IPv4-mapped IPv6 与 NAT64 结果，任何禁区命中即拒；socket 固定到已批准 IP，同时保留 Host/SNI 和正常 PKI hostname 校验，消除二次解析 TOCTOU。禁区来自随 release签名的 IANA special-purpose address snapshot加SayDo明确的云metadata/link-local/loopback/LAN policy，不靠手写几段CIDR；snapshot版本、NAT64前缀发现证据和企业私网例外进入 Network receipt。IANA更新只扩大阻断可 emergency hard stop，放宽必须新policy与用户/管理员授权。
8. 默认不继承 `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`。企业 proxy、custom CA、mTLS、PrivateLink/VPC endpoint 都是显式 connector/profile，有独立身份、凭据和 network receipt，不能暗中旁路。
9. Internet endpoint 默认 HTTPS；HTTP 只允许 loopback。LAN HTTP 需要用户显式开启。连接限制响应字节、header 数、总时长和并发；`networkScope` 由解析与 dial 结果产生。
10. `RequestProfile` 不接受任意 `Record<string,string>` 或用户自由 header。它只包含 builtin protocol profile或受信 registry target签发的 public constant，逐项绑定规范 name/value、来源和完整 set digest；动态 credential header只能由 secret broker产生。`Host`、`Connection`、`Content-Length`、`Cookie`、`Authorization`、`Proxy-*`、转发身份/路由覆盖等保留或有凭据语义的名称永远拒绝。Kimi真实 `User-Agent`、Anthropic版本头等非秘密常量进入版本化 profile，不得冒充其他客户端。
11. 自动读取第三方配置前校验 owner、mode、regular file、symlink target、大小与 schema；world-writable、越界 symlink、异常大文件或未知格式只 inventory，不打开 token/session/history 内容。

### 4.6 Rights 与费用策略

权益不是 connector 上的静态文案字段，而是每次调度按 operation 解析的硬约束。首次录入不能制造“没有 key 就没有 principal、没有 principal-bound Rights 就不许显示 key 输入”的死锁：先由不含 credential 的 `ProductEligibilityReceipt` 按 provider product/region/use case/distribution 判断 `eligible|user_or_admin_attested_custom|unknown|forbidden`。官方 `eligible` 与精确 custom attestation 都可只在本机 broker 保存 secret，但 custom 必须显式显示非官方和 TTL；二者都不允许 egress或生成调用。principal 可先由 broker 对 credential source 生成设备内稳定伪名，若官方提供无生成、无费用的账号识别 endpoint，则另取得有界 bootstrap+EndpointCredentialEgress 授权后再补强账号 identity。随后才生成版本化、principal-bound `RightsReceipt`，至少绑定 provider、精确 product/surface/version、SayDo app/distribution identity、edition、region、use case、operation、distribution channel、第三方形态、credential principal、`status=allowed|official_surface_only|forbidden|unknown`、证据定位、审核主体、policy version、`checkedAt`、`expiresAt` 与 terms digest。真正私有/custom 资源没有厂商权威证据时，不能伪造 `allowed`；只有资源 owner/组织管理员另签的 `UserAdminAttestedCustomRightsReceipt` 可为同一 exact endpoint/product/principal/use/distribution 建立“用户自有资源私用”分支。它不是法律/厂商 Rights，禁止第三方消费者订阅复用、推荐、fallback 与 evaluator，并在 UI 保留非官方标签。

首测 conformance 使用的四份 candidate policy 与 runtime policy 是不同 receipt kind。CandidateNetwork 只批准已 fence 的 endpoint/transport；CandidateRights 精确到 `conformance_test` 与候选 product/surface。`CandidateBillingReceipt` 是严格联合：`priced_candidate` 对每个 route/member 保存非空、无重复的 charge components，逐项绑定 biller/account/funding/overage、单位、price version、首测最坏金额和每个 runtime operation 投影；`externally_metered_unknown_custom` 只接受上段 exact custom eligibility+rights，明确没有权威 price/usage/hard cap，并要求独立 conformance unknown-metering consent。二者都不声称首测前已知实际 usage，也不授予日常调用；CandidateDataBoundary 见 §4.7。响应后才能为实际 EffectiveRoute/resource subject 生成 runtime Network/Rights/Billing/DataBoundary。priced 分支必须形成 BillingMatch；custom unknown 分支只能形成 `explicitlyNotCoveredOrSettled` 的 ConformanceResult 与 unknown operation closure。candidate receipt 不能被 PolicyBinding、FundingPolicyTemplate 或 ActivationManifest 当成 runtime receipt，外键 kind 不符直接拒绝。priced 首测在首字节前复核全部价格证据；unknown custom则复核 exact consent、endpoint/request/physical cap 与 generation。

所有金额合同都使用按计费单位分量化的向量，不使用一个 `currency + amount` 标量，也不把不同单位相加：

> **合同草案**：见 [`ai-supply-contracts-draft/02-rights-billing.ts`](ai-supply-contracts-draft/02-rights-billing.ts)（10 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


`iso4217.code` 必须是 registry 允许的三位大写代码并匹配当时版本的 exponent；provider credit 必须绑定 provider、稳定 unitId、版本化 exponent 与价格证据。未知单位、重复 canonical key、负数、非整数、溢出、非规范表示或未经证明的舍入一律 fail-closed。首版禁止隐式 FX，也禁止用用户界面汇率把 CNY、USD 或 provider credits 净额化；若未来支持换汇，必须另有不可变 FX receipt，绑定来源、货币对、rate、查询与到期时间、保守舍入规则及授权，本方案首版不实现。

usage 也不是“input/output token 两个可选数字”。每个 protocol/provider 由版本化 `UsageProfileReceipt` 声明完整维度、canonical unit、权威 raw occurrence、correction fold 与对应 billing component；内置维度覆盖 input/output/cache-read/cache-write/reasoning token、request、hosted-tool call、image、audio seconds 与 compute seconds，新增语义使用 namespaced `ext:usage:*`。decoder 必须保存所有 raw usage occurrence 并证明一一覆盖；报告出现 profile外维度、重复 correction、负增量、精度溢出或无法映射的 billing component 时，保留原始 digest并把受影响 component置为 `charge_unknown`，不能安静丢字段或折进 output token。

响应后生成的 runtime Billing 不能仅因“也是一份有效 receipt”就进入 runtime policy。`ConformanceBillingMatchReceipt` 必须在不反向引用 Capability/Binding/Activation 的前提下，只保存同一 ingress 的 Authorization、InvocationEnvelope、ingress reservation 和全部 attempt/member/component 的 typed coverage source refs，不保存可伪造的金额 summary。`billing-limit-fold-v1` 在构造、verify、promote、dispatch 四处从这些 refs 重算 component candidate/child/attempt reserve/runtime worst/terminal hold-or-settlement，再按 attempt/member/ingress 聚合；先逐 component 执行完整不等式，再执行聚合不等式。fixed 必须恰好一个 attempt source，dynamic 必须覆盖本次 InvocationEnvelope 的完整实际 sent 序列，且每个 source 内全部 biller/account/funding component 无漏无重；任一来源 ref 或 derived projection 不等都不是可接受输入。随后每个 runtime operation 还要生成一份 `OperationBillingClosureReceipt`，把准确 ComputePolicyBinding 与全部 runtime Billing component、CandidateBilling operation 投影钉在一起；这些 closure 与最终 fixed Binding 或 RouteSetCore member 的 operation→binding 集合必须完全相等。只有 conformance match 为 `covered` 且 operation/component 集合闭合，才能继续构造 ConformanceResult。任何新增 biller/account/component/unit、价格或资金语义漂移、runtime worst 被实账击穿、ledger coverage 不等式失败、operation 换挂或超 child/aggregate cap 都是费用异常：已发生请求仍按 component 和可识别单位独立记 `charge_unknown`，不可识别单位只保存脱敏证据 digest 并锁定 account/route，向用户逐主体逐单位提示人工调和；异常 receipt 永远不能被 OperationBillingClosure、ConformanceResult、Capability 或 Activation 引用。

路由和费用必须正交建模，不能把 gateway 当作费用类型：

- `routingTopology`：direct、gateway、bridge；
- `fundingSource`：local、subscription、payg、unknown；
- `overageCapable`、`overageEnabled`、`overageState=verified|disabled|unknown`；
- `upstreamFallback`：disabled、route_pinned、dynamic_known、dynamic_unknown；
- `capEnforcement`：provider、SayDo、none、unknown；
- account、`BillingUnit`/priceCheckedAt 与费用主体。

Kimi Extra Usage 等能力不能由套餐名静态推断：只有查到当前用户已启用状态及 cap 时，才能标 `verified`；查不到就是 `unknown`。OpenRouter BYOK 与 OpenRouter credits必须分别记录资金来源和逐请求effective route。CC Switch Desktop公开代理当前不能提供可依赖的上游route/funding authority，因此固定标为opaque，绝不把其内部subscription/payg failover猜成已验证资金来源。

OpenRouter 普通 inference key或PKCE换取的API key不等于BYOK management authority。若无法用独立、最小权限management credential读取并fence BYOK key顺序、全部provider account、shared-capacity fallback和完整配置revision，BYOK只标inventory，并给用户direct-provider-key或关闭BYOK的处方；不得把OpenRouter L0 credits路径的结论外推到BYOK。完整revision必须规范化绑定本次gateway API key hash、workspace/member/user、requested model、每把BYOK的`allowed_models/allowed_api_key_hashes/allowed_user_ids`及null/omission语义、顺序、provider account和shared fallback；任一过滤器改变即route/billing hard stop。正式支持时，每把顺序key与OpenRouter gateway fee/credits都是独立`BillingChargeComponent`，一次成功请求可同时结算多个component；自检、runtime、提示和ledger按最长可执行key/fallback序列与全部计费主体预留，不能只记最终provider或一个USD总额。

调度规则：

1. `forbidden` 永不发起请求。
2. `unknown` 可展示为“已检测，需确认支持范围”，不得进入推荐或自动 fallback；它本身不能发送。具名 `UserAdminAttestedCustomRightsReceipt` 是独立私有资源分支，不把 unknown 改写为 allowed，并且只允许用户主动的 exact custom 流程。
3. `official_surface_only` 只能通过登记的 CLI/App Server/工具调用，不能抽取 token 后直连私有 API。
4. 用户选择“尽量不新增费用”时，只允许已验证 subscription 且 overage disabled/cap enforcement 可执行，或有 `owned_capacity` 证明的用户自有本机/LAN 计算。本机分支由 SayDo reference monitor 的 peer+sandbox+compute lease证明；LAN 分支必须由 SayDo-managed remote agent 或不同信任域的 `LanComputeAuthorityPolicyReceipt` 产生，并在每个 physical attempt 取得 `LanComputeLeaseReceipt`，冻结远端 peer/process/artifact/config/model-load/route→artifact/egress 与无第三方逐调用收费。LAN 服务自报、loopback、无 key、本机登录或任意 self-hosted 标签都不能代替这些证据；无法构造时统一降为 unknown/provider-cloud。LAN 自有算力只显示“使用你已有的设备容量”，不能说“数据不出这台设备”。
5. 从 subscription/local 切到 payg，或 gateway/bridge 改变资金来源，必须有匹配当前 FundingPolicyTemplate 的 `RuntimeSpendAuthorization`；重启、重试、限流恢复不能代替授权。
6. “订阅内零成本”文案删除。替换为“计入你的某某套餐额度”；只有 provider 明确无自动超额且已识别权益时才显示“不会新增按量费用”。

费用决策分成没有 producer 环的四类，不能用一份“通用同意”混过不同阶段。Capability/Binding 形成后，先为每个 operation 生成不可变 `FundingPolicyTemplateReceipt`：它冻结 fixed identity closure 或完整 RouteSet closure、当前 Billing/price version、同 operation 的 `RuntimeRouteFenceTemplate`、全部 hosted-tool authorization/component、允许的资金模式，以及 `no_new_spend | runtime_authorization_required`。它不是用户同意，也没有可消费余额。

- 首次真实自检使用一次性 `ConformanceAuthorization`。顶层只保存总请求/token 上限、`BillingLimitVector` 聚合上限、到期时间与撤销版本；每个有序 attempt 自己绑定 `operation=conformance_test`、完整 `ConformanceAttemptSubject`、CandidateRouteFence、ConformanceBoundary、ConformancePolicyBinding 与四份 policy receipt、上下游 principal/account、price version、hard-stop generation 和子请求/token/分单位金额上限，**不引用尚未生成的 observed model、effective route、model identity、Capability、InferenceResourceSubject、ComputeBoundaryCore、InferenceBinding 或最终 RouteSet**。动态队列 attempt 改为引用 `ConformanceRouteSetReceipt`、InvocationEnvelope 与按 ordinal 的有限 `authorizedMembers`；每个成员各有上述候选闭包。对每个计费单位 `u`，发出一次 ingress 前分别预留 `max(possibleSequences.map(sequence => sum(sequence 中每次上游调用在 u 上的最坏金额)))`，请求/token 上限同样求最坏序列总和，不得只取最贵成员。某成员缺少 `u` 分量只能在其 CandidateBilling 明确证明该成员绝不会以 `u` 计费时按零处理；未知即禁止授权。自检响应才生成最终 effective route/model identity/resource subject/core、逐 subject 的 Capability，并据此组装最终 RouteSet 与 InferenceBinding。
- 激活后的付费调用使用当前 `RuntimeSpendAuthorization` 实例。每个实例必须引用匹配的 FundingPolicyTemplate，顶层只保存用户本次明确批准的请求/token 聚合上限、`BillingLimitVector` 聚合上限、期限和撤销版本；固定/pinned attempt 按实际 `InferenceOperation` 独立绑定完整 resource subject、ConformanceResult、core、operation-specific ComputePolicyBinding、Capability、effective route/model identity、fixed InferenceBinding digest 及全部 policy refs。动态 RouteSet 的一次 ingress attempt 则绑定 route_set InferenceBinding digest、完整 RouteSet/InvocationEnvelope 和全部成员的 ConformanceResult/Capability/policy 闭包，并在调用前按上述逐单位公式预留最坏**调用序列总和向量**；只有 bridge 能在每次上游首字节前同步调用 SayDo ledger，且同一分单位 aggregate cap 已锁定时，才可分段预留。双协议 r1→r2、chat→tool_roundtrip 与两个独立 ingress 都必须切换到对应 attempt 并另行原子预留，不能沿用上一项的 identity closure。
- 不会新增按量费用的 runtime 路径也不能缺省。它使用不可消费的 `NoNewSpendProofReceipt`，由对应 FundingPolicyTemplate 引用，按 operation 绑定相同的 fixed 或完整 RouteSet identity closure，并证明精确 subscription 且 overage disabled/cap enforcement 可执行，或精确 local/LAN route 具有当前 `owned_capacity` 证明和本物理请求的 local/LAN compute admission lease。任一成员/operation 为 payg、unknown、可能自动超额、LAN 缺独立 authority 或自托管费用状态未证明时不能生成该证明，必须改走有金额上限的 RuntimeSpendAuthorization 或逐次 `externally_metered_unknown` consent。
- 持久预算策略复用相同的 runtime per-attempt/per-member 模板，额外绑定来源/目标 connector、槽、family、region、`BillingLimitVector` 总额、请求数、TTL、逐单位剩余额度与撤销版本；任何模板内 receipt 或 hard-stop generation 变化立即失效，不能靠同一 connector ID 复用旧预算。
- 两类授权共用持久化原子账本，状态至少为 `reserved → sent → settled | charge_unknown`。ledger 的 reserve/sent/settled/charge_unknown、释放、调和与余额都逐 `BillingUnit` 保存和原子更新，禁止 CNY 与 USD、法币与 provider credit 互相抵扣。只有能证明一个请求尚未发出，或权威 usage/账单明确证明未计费，才能释放对应分量；已发送后的超时、取消、断线、usage 丢失或崩溃一律进入 `charge_unknown`，在每个可能计费单位保留最坏金额直到调和，不得立即释放。bridge 内 A 已发送后超时再调 B 时，A 保持 `charge_unknown`、B 独立结算，两者都必须落在调用前已锁定的序列聚合预算向量内。若上游报告事前未授权但可规范化的新增单位，该分量进入独立的费用异常账，不得伪装成已获 SpendAuthorization；非规范单位则以 opaque digest 建立不可消费的 `charge_unknown` 事件并阻断该 route。每个来源和单位必须有调和截止时间；截止时仍无权威结果时逐单位悲观提交最坏金额，不释放。重试需新预留，并绑定 provider request/idempotency ID；任一单位余额不足时在请求发出前拒绝，进程崩溃按 journal 恢复，不靠内存 Map。

确认界面和运行中费用提示都按计费单位逐行展示，例如 `CNY 1.00`、`USD 1.00` 与某 provider credits 各占一行；不得显示无意义的“合计 2.00”。只有所有分量都在同一 ISO 4217 单位时，才可额外显示该单位的小计。

每个 attempt 发出前都必须逐项解析并比对引用；每个 runtime operation 必须先恰好命中 ActivationManifest 中的一份 FundingPolicyTemplate，再命中严格 `InferenceFundingDecisionReceipt` 的一支：当前 `NoNewSpendProofReceipt`、当前 `RuntimeSpendAuthorization`，或 exact custom 的 single-use `ExternallyMeteredUnknownConsentReceipt`。具体 runtime authorization/consent 不进入 ActivationManifest：connector 可在 `paid_dispatch_locked` 状态完成激活；无授权、授权耗尽/过期/撤销只阻断 dispatch，不改 active pointer、不自动续签，也不要求重跑 staged→promote。ConformanceAuthorization/ConformanceUnknownConsent 不得派生或默认创建 runtime 授权。不存在可放宽的 `auto` 协议，也不存在顶层单一 subject 可覆盖多个 route/member/operation 的捷径。集合外路由、协议、成员或 operation 必须重新确认或由当前持久预算实例明确覆盖。

除 exact custom 的两段 `externally_metered_unknown` 主动同意路径外，价格或 overage 为 unknown、上游不返回可验证路由、或最坏费用无法封顶时，不得创建授权。custom unknown consent 也不能扩张到自动行为或宣称费用已覆盖。

### 4.7 数据边界与隐私收据

数据边界按阶段判别。首测前的 `CandidateDataBoundaryReceipt` 只用于“本次验证可能发送到哪里”的知情确认；每个 `DataBoundaryAlternative` 把 member/attempt/fence/boundary 与 operator identity、处理地区、存储/保留、训练用途、subprocessor、evidence 固定成不可拆元组。operator 使用受证据约束的 legal-entity receipt，region 使用规范化、非空的 `NonEmptyDataRegions` 并排序去重；无可靠地区只能是唯一 `unknown`，`global/unknown` 不得与具体地区混装。`provider-defined` region 没有受信 mapping evidence 时不能满足 ISO 国家/地区或 cloud-region 硬约束，空数组也不能利用 `every()` 真值满足任何地域。动态路径先冻结完整 alternatives，再由后置 ConformanceRouteSet 校验相同 ordinal/attempt 集合，避免 digest 环；不能将各字段拆成全局数组后逐列 membership。Candidate 只能披露完整最坏 alternatives，不能满足运行时“仅中国大陆”“仅本机”或指定地域承诺。首测响应后才生成版本化 runtime `DataBoundaryReceipt`，绑定实际 resource subject、ComputeBoundaryCore、effective route 与一个完整 alternative；不能由 provider 名猜测，也不能跨 alternative 拼接。

运行时以本轮 data-egress graph 求值：节点同时包含 inference route/RouteSet 成员的 runtime DataBoundary/ComputeBoundary、本地 runtime 进程自身的 network-egress assurance，以及 Execution Agent surface/tool/network egress，边由实际 dispatch 可达性决定。未知数据去向不能满足任何地域硬偏好；compute boundary、runtime egress、bridge 路由、Agent surface 或 tool egress 改变后必须重新计算。loopback transport、local compute 或“模型文件在本机”都不能单独产生“数据不出本机”证明。

### 4.8 Receipt 失效分级

| 变化 | 分级 | 行为 |
|---|---|---|
| host/TLS/request profile/auth principal/credential source/secret version/resource scope/compute boundary/account/region/RouteSet/effective route/rights/billing/data boundary | `hard_stop` | 立即停止 connector，重新确认和自检；不得用旧 LKG 维持 |
| binary digest 或执行协议/gate receipt 变化 | `hard_stop` | 停止 Execution Agent，重新做 dispatch 与逐工具门证明 |
| 会改变转换、认证、重试、事件或工具行为的 adapter digest/version | `hard_stop` | 新 adapter 重新 conformance；只有继续执行 digest 固定、仍受支持的旧 adapter artifact 才可沿用旧 receipt |
| 非行为性展示 catalog 漂移、性能 receipt 过期 | `soft_stale` | 可按有期限 grace policy 保持旧 active，同时后台重测 |
| emergency deny 或 rights 撤销 | `hard_stop` | 优先级高于签名 LKG 和可用性 |

`hard_stop` 不只阻断下一次发送。线性化事务先把 subject 置为 `revoking_requested`、关闭新发送/session/tool/commit lease，并通过持久 in-flight registry 向上传 body、响应 reader、socket、WebSocket、plugin/agent session、子进程树和待执行 tool gate 同步广播 abort；网络/流式路径随后原子增加 generation 形成发送屏障。屏障开始后不再向用户交付新输出、不再消费新工具 Gate；已发请求的所有费用 component 进入 `charge_unknown`，直到权威账单调和。撤销完成必须等待全部本机 handle 到 terminal 或超时后强杀并记审计，daemon 崩溃后按 registry 恢复继续；上游可能已经产生的费用不能用本地取消伪装成未发生。慢上传、首事件前后、SSE、WebSocket、Execution session 和工具副作用前各有竞态 fixture。

工具 commit 的线性化点遵守上一节更强的 commit-lease 顺序：先进入 `revoking_requested`、阻断新 commit lease并等待旧 lease 结束，再增加 generation 宣告 hard stop 生效；不能先宣告撤销再允许旧 rename/外部 commit 落下。远程请求已经发出且无法撤销的后果仍记 `charge_unknown/executing_unknown`，不伪称本机 abort 等于远端未执行。

所有会参与安全、权益、费用、数据、peer、sandbox、route、plugin 或 TUF 判断的 receipt 使用统一 temporal-validity 合同。`temporal-validity-fold-v1` 从 ActivationManifest 的规范传递安全闭包派生非空、排序、唯一的 receipt refs、closure digest、最早 `notAfter` 与 outcome；producer 不可挑选 refs或填写较晚副本，host 在 compile、promote 和每个 send/session/tool lease 前重算并要求与 manifest 完全相等。在线时优先取得签名时间或 OS secure-time 证明；离线只允许沿用持久高水位+同 boot monotonic anchor，正式 release 的签名时间是 fresh install 的最低可信下界。墙钟倒退到高水位之前、当前时间早于签名 release 下界或无法形成上下界时为 `clock_untrusted`，远程/付费/Execution 新 lease fail-closed；时钟跳前只会提前过期，不延长 receipt。当可信时间上界触达派生最早期限时，触发与 emergency deny 相同的 generation 屏障并中止跨 expiry 长流。重启、离线、漏掉最早 Rights/plugin/TUF receipt、时钟回拨和 expiry 前后竞态都有恢复 fixture，任何“允许五分钟宽限”都不能修改原始 `expiresAt`。

feature flag 明确分为 `drain_disable` 与 `revoke_disable`。纯展示或非安全实验可 drain；sandbox、protocol parser、credential signer、rights/billing/data、TUF verifier、Execution Gate 等安全 flag 关闭时默认 `revoke_disable`，原子增代并按上文撤销所有在途 session/plugin/Agent，不能只停止新调用。分类写进 flag schema，运行时管理员不能把 security flag 降成 drain。

任何 fallback 都要用实际 observed model/effective route 重新求解全部槽位；不满足 evaluator 独立性时停用 evaluator，并把 readiness 降为 `conversation_ready`。

### 4.9 权威存储与 activation 协议

默认推荐的 SoT 形状是：SQLite v31+ 持有 connection、binding、immutable receipt、active pointer 与 activation journal；secret broker/OS credential store 只持有 secret bytes 和版本；`config.toml` 保留非秘密全局设置与 legacy 只读投影。owner 若选择其他 SoT，必须仍满足同一崩溃/降级验收。

激活采用可恢复两阶段协议。其快照不是一组松散 digest，而是严格判别的 `InferenceActivationManifest | ExecutionActivationManifest`。Inference 分支冻结 connection/binding、严格 credential-state、AuthSubject/credential source、Endpoint/逐 hop transport security/RequestProfile 与逐 component egress/ACL、transport/compute scope、resource subject、ConformanceResult、adapter/response/field-specific extractor profile、model/Capability/ComputeBoundary/Policy、Rights/Billing/DataBoundary、按 operation 的 Funding/RuntimeInvocationEnvelope/RuntimeRouteFence template、已授权 fallback plan、RouteSet/hosted-tool policy/hard-stop/temporal refs。全部 local-device route冻结 endpoint 精确 peer policy和 runtime-isolation profile；只有宣称本机隐私的 route还必须无漏无重冻结 full sandbox policy。third-party code adapter冻结 `InferencePluginPolicyReceipt`。具体 peer/local-compute/isolation/plugin runtime lease只在每个物理 dispatch生成。credential与 no-credential互斥完备。Execution 分支冻结自身 surface/peer/sandbox/driver/Gate/funding/resource与严格 credential-state；具体 runtime身份只在 admission→session lease单向链中取得。两分支 temporal validity从传递安全闭包重算；permission、ACL、data scope、egress、plugin/Agent/driver、fallback或sandbox扩大都 hard stop并重新同意。

首次 ConformanceAuthorization 与 ledger 仅作为 ConformanceResult 的审计前驱；具体 RuntimeSpendAuthorization、RuntimeRouteFenceLease、ExecutionSessionConsent/Lease 都不进入 manifest，只能在 dispatch/session 现场引用并精确匹配 template。外部资源必须提供不可变版本或执行型 fencing token；只有“当前可查但不可冻结”的资源不得激活。

1. `prepare`：以 `activationId` 和 `expectedRevision` 写 pending connection/binding/receipt，创建 staged secret version，并保存完整 `ActivationManifest`；active pointer 不动。
2. `verify`：所有自检只引用该 activationId 和 manifest digest；任一资源 digest/generation/fencing token 改变或并发 revision 不符立即作废。
3. `promote`：daemon 先设置 activation barrier，禁止该 connector 新 dispatch；在与 active-pointer CAS 紧邻的最终事务中逐项复核 manifest 全部 generation/digest/fencing token、secret 存在与 broker ACL，全部一致才切 pointer 并记审计。开放流量前再校验 manifest digest 与 hard-stop generation。每次 dispatch 必须在同一线性化 policy store 中获取带 generation、可撤销、单次使用的发送 lease，登记进 in-flight registry；安全 dialer 在写出首个请求字节前再验 lease。撤销按 §4.8 原子加代、阻断新 lease并中止全部旧 generation handle。先查后发的非原子窗口或只挡新请求而不管在途流都不合格。
4. `recover`：任意一步进程终止后按 journal 幂等继续或回滚；未被 active/pending 引用的 secret 标 orphan，经过安全窗口再清理。
5. `downgrade`：保留升级前 config、active binding 和旧 secret 的只读快照到回滚窗口结束。验收用上一正式发布二进制打开同一 HOME，恢复升级前方案；新 connector 不强行降格写进旧格式。

任何阶段都不存在“SQLite 已激活但 secret 尚未提交”或“secret 被删除但 active 仍引用”的允许状态。

### 4.10 参考实现级扩展内核

#### 4.10.1 先分清五个不会同步变化的概念

扩展模型不得再把 `provider` 当成所有差异的总开关。以下五层拥有不同生命周期、版本和责任人：

| 层 | 例子 | 变化后影响 | 归属 |
|---|---|---|---|
| Wire Protocol | OpenAI Responses、Anthropic Messages、ACP | 编解码、事件状态机、幂等与 capability | protocol adapter |
| Deployment | 官方域名、Azure deployment、企业 gateway、本机端口 | endpoint/TLS/auth/region/route | connection + transport/auth |
| Product/Rights | 普通 API、Kimi Coding Plan、Codex 订阅、企业 edition | 可用 surface、用途、额度和自动超额 | Rights/Billing policy |
| Model Artifact | provider model、alias、GGUF/MLX artifact、LoRA | 能力、上下文、family、计算边界 | model identity + conformance |
| Execution Surface | HTTP inference、CLI、App Server、ACP | 工具、审批、workspace 与会话语义 | Inference 或 Execution Agent plane |

新增 provider 通常只新增声明式 deployment/product/model 数据；只有 wire、签名认证或 agent event 语义真的不同才新增代码。任何 `if (providerId === ...)` 进入通用 dispatch、ledger、policy、activation 或 UI 状态机，都必须在 review 中视为架构异味并要求说明为什么不能由一个有类型的扩展点表达。

#### 4.10.2 最小且封闭的扩展点

公共扩展合同只开放下列端口，不提供可随意触碰 daemon 的 service locator：

> **合同草案**：见 [`ai-supply-contracts-draft/03-extension-points.ts`](ai-supply-contracts-draft/03-extension-points.ts)（544 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


这些接口只表示责任边界，最终字段由 Phase 0 canonical 固化。硬约束如下：

- `ProtocolAdapter` 是确定性的纯转换器和增量 decoder：没有 `fetch`、环境变量、文件系统、clock、random、secret、重试或 provider fallback；ID、clock 与确定性随机源由 host 注入。相同输入、adapter digest 与 profile 必须得到相同 `WireRequestPlan` 和事件序列。
- Connector/extension ID 只允许规范化 ASCII `publisher.name` namespace，长度有界；新 inference wire 使用 `ext:inference:publisher.name@major`，Execution wire 使用 `ext:execution:publisher.name@major`，而不是修改核心 closed enum。`ProtocolImplementationReceipt`、TCK report kind 与 connector definition kind 必须命中同一 plane，跨平面 receipt 换挂直接拒绝。code plugin 先计算不含 policy ref 的 implementation core digest，`InferencePluginPolicyReceipt` 单向绑定该 core，最终 implementation receipt 再绑定 policy，禁止双向 digest 环。每个 extension protocol 绑定 adapter artifact、wire profile、SDK major、受信 protocol TCK attestation、被测 SUT distribution digest与 detached `ReleaseConformanceBinding`；implementation、TCK payload、binding 的 `sutDistributionArtifactDigest` 和当前实际加载 artifact 必须完全相等。该 implementation receipt只在 artifact digest确定并通过黑盒 TCK后签发，明确位于被测 SUT distribution manifest scope之外；随包 registry只携带无当前 release digest的 implementation core，避免 receipt把自己的摘要写回被测产物。fresh external connector 只新增 pack/plugin 与 registry entry，不修改 daemon switch、contracts builtin union 或 UI 分支。capability/profile/permission 列表去重并按 canonical key 排序后再签名；大小写、Unicode 近形、数组重排或重复项不能产生第二个逻辑身份。
- `Transport` 只负责 host 允许的 HTTP/SSE/WebSocket/stdio/ACP 字节流、DNS/TLS、连接池、deadline、取消与 backpressure；它不解释模型语义，不决定权益，不选择模型。
- `AuthStrategy` 只经 secret broker 的 opaque handle生成受限 header/signature；adapter和第三方插件永远看不到 secret bytes。broker开放审计过的declarative primitive（Bearer、API-key、Basic、OAuth token handle）以及受限`DeclarativeSigningProfileReceipt`：profile只能组合固定canonical method/path/query/header/body、hash/HMAC/编码/排序 primitive、opaque broker component，以及由host注入并有`TimeAuthorityReceipt`或single-use nonce receipt约束的可信时间/nonce；signer本身禁止网络、文件、直接clock、直接random、exec和读取secret bytes，并由确定性TCK与完整TUF lineage约束。常见AK/SK方言可仅新增`signing_profile_pack`，不修改daemon switch；AWS SigV4、Google/Azure workload identity等优先复用官方signer，但必须禁掉未知endpoint、隐式default credential chain和隐藏重试。超出声明式语言的secret-dependent密码协议只能进入经安全owner审核、作为SayDo正式发行物签名并经独立TUF role/TCK约束的bundled trusted signer；第三方code plugin仍只负责wire/event，不获得secret或任意签名oracle。
- `DiscoveryDetector` 只能产 evidence/candidate，不能写 active config、下载/加载模型、打开浏览器、执行未批准程序或发送真实 prompt。`static_filesystem`、宿主执行的 `passive_loopback_metadata` 与用户确认后的 `explicit_active` 是三个不同 capability，不能在内部升级。
- `CatalogSource` 只提供候选模型事实；`RightsEvidenceSource`、`BillingEvidenceSource` 与 `DataBoundaryEvidenceSource` 是独立签名和审核域。任何一个都不能替另一个作授权决定。
- `ExecutionAgentDriver` 只实现 session/event/approval adapter；workspace、进程、网络与逐工具 Gate 仍由 SayDo host 强制，不能把 driver 返回的“已批准”当作 host receipt。
- 扩展只能声明自己需要的 capability。host 对未声明、用户未授权或当前平台无法强制的调用返回 typed deny；没有万能 `host.call(name, args)` 或透传 shell。
- plugin 没有 transport/auth host RPC。它只接收已脱敏的编译上下文并返回纯 `WireRequestPlan`/decoder event；host 对 plan 做 schema、profile、method/path/header/body digest、admission、credential-egress 判别、route fence、reservation 与 lease 校验，内部签名后生成单次 `PreparedAttemptDescriptor` 并自行发送。含 credential 必须引用精确 EndpointCredentialEgress；`auth=none` 也必须引用当前 AuthSubject 的 no-credential proof，不能用字段缺失绕过。重复使用、跨 attempt/handle、授权后改 body、管理 endpoint 或保留 header 一律拒绝，插件永远不能请求 host 代它任意发包。

#### 4.10.3 三种扩展交付级别

1. **Bundled trusted driver**：三核心协议、官方云签名、L0 本地运行时和 L0 Execution Agent 由 SayDo release 一同构建、测试和签名，可在进程内执行。它们也只能通过同一 SDK 端口接入，不能拥有内部捷径。
2. **Declarative provider pack**：绝大多数兼容 API、模型目录、endpoint preset、公开 header、检测 signature 和帮助文案使用严格 schema 的数据包。pack 不含 JavaScript/Wasm、命令、SecretRef、任意文件路径或模板求值；通过 TUF targets 分发并在安装前完成 schema、digest、rights-domain 与 anti-rollback 校验。
3. **Third-party code plugin**：仅处理无法声明式表达的新 wire protocol 或 agent event surface；新的 secret-dependent 认证遵守上节 trusted signer 边界。GA 初期默认关闭，用户显式安装；“逐 capability”只有在当前平台存在经 TCK 证明的 OS-enforced deny-by-default sandbox backend 时才可显示。插件在该 sandbox 内以独立进程、版本化 framed RPC 运行，只能访问具名 broker IPC，默认无 filesystem、network、keychain/credential store、process inspection、exec、workspace 和其他 IPC 权限；临时 HOME、空环境、CPU/RSS/frame/进程数/重启预算只是附加限制，不是安全边界。macOS 使用独立 App Sandbox/XPC helper 身份，Linux 使用可验证的 namespace/seccomp/Landlock 等组合，Windows 使用 AppContainer/restricted process；任一正式平台无法机械证明所需 deny 时，该平台 code plugin 只能 inventory，不能降级成普通同 UID child。

code plugin 必须声明 `prompt_content | model_output | tool_metadata | public_endpoint_metadata` 数据访问范围；安装和首次选择 connector 时把插件 publisher 作为独立 data processor 展示。只有 dispatch 已选中且用户同意的数据才会发送给插件，discovery 阶段永远不给 prompt。签名只能证明 publisher/artifact 身份，不能把 native code 的环境权限包装成安全 capability；若用户选择“完全信任的本机代码”开发模式，UI 必须使用完整代码执行警告，且该模式永远不能取得 `community_verified`/`builtin_*` maturity、本机数据局部性或受限 capability badge。

plugin artifact、publisher、capability、permission、数据访问范围或 sandbox policy 任一变化都生成新 generation 并 `revoke_disable` 旧 in-flight；升级预览逐项展示增加/减少，只有重新显式同意才能激活扩大后的集合。自动更新只能下载和验证，不能自动扩大 permission/data scope；用户可继续 pin 未撤销的旧 artifact。Execution Agent 的 permission/data/egress scope 遵守同一规则。

握手校验 API version、publisher identity、artifact digest、受信 TCK attestation digest 和权限清单；超时、畸形 frame、越界 CPU/RSS/frame/process、违规 syscall、崩溃或重启风暴只隔离该插件，不能拖垮 daemon。TCK 必须直接尝试越界 `open/connect/exec/keychain/process-inspection/IPC`，不能只断言插件没有调用 SDK 方法。

代码插件不通过动态 `import()`、npm postinstall 或主进程内 `eval` 加载。进程外 RPC 只采用 HashiCorp go-plugin 的崩溃隔离和协议版本经验，不把其 handshake cookie 当安全沙箱；协议本身用 SayDo 的 zod/JSON-RPC framed schema，不把 Go/gRPC 变成 Node 产品的强制依赖。WASI Component 可在网络、流式 backpressure、调试和三平台运行时通过同一 TCK 后成为优先的无 ambient authority backend；在此之前，只有上述 OS sandbox 达到等价 deny 证明的 native backend 才能启用 capability 模式。

#### 4.10.4 自研、复用与外接的边界

| 能力 | 裁决 | 原因 |
|---|---|---|
| SayDo IR、receipt、policy、ledger、activation、recommendation | 自研并作为 canonical | 这是产品安全与可解释性的核心，不存在可直接复用的等价合同 |
| OpenAI/Anthropic/Google wire adapter | SayDo 合同自有；实现可复用官方 SDK/AI SDK 的纯转换部分 | 只有能注入唯一安全 transport、关闭隐藏 retry/fallback、保留 raw identity/event/usage 并通过 TCK 时才可复用 |
| AWS/GCP/Azure auth signer | 优先官方 SDK 的最小 signer 模块 | 不重写 SigV4/OAuth/Entra 密码学；credential discovery 与 egress 仍由 SayDo 收口 |
| models.dev | 作为 catalog 输入和离线生成源 | 模型元数据很有价值，但不是 rights、费用、endpoint 安全或 capability 证明 |
| Vercel AI SDK/community providers | 可作为候选实现或 fixture oracle，不作为 SayDo public contract | 它的 provider spec 是优秀先例，但第三方包成熟度和语义保真不能自动满足 SayDo 收据闭包 |
| LiteLLM/OpenRouter/Portkey/Higress/Envoy/Kong | 当作用户已有 gateway connector | 不内嵌第二套路由、secret、重试和费用系统；必须暴露或冻结实际 route 才能激活 |
| OpenTelemetry | 直接采用稳定 semantic conventions，经 compatibility shim 隔离 experimental 字段 | 避免自造不可互操作的 telemetry 词表 |
| TUF、Sigstore、SLSA、SPDX | 采用标准和维护中的实现 | 不自造软件更新签名、provenance 或 SBOM 格式 |

### 4.11 可保真的 Inference IR 与 adaptation-loss gate

内部合同不能以 OpenAI `messages: {role, content: string}[]` 为事实源，也不能把 Responses/Anthropic 强行压扁成当前 `ChatRequest`。`InferenceRequestIR` 至少表达：

- `system` 与 `developer` instruction 的有序块；
- text、image、audio、document、provider file reference 与 host-managed `{handle,digest,length,mime}` 等有类型 content part；大对象不以内联字节复制进插件 frame；
- assistant tool call、tool result、并行调用和稳定 item/call ID；
- reasoning text、opaque/signature block 与“可展示/只可回传”边界；
- citation、annotation、refusal/safety block 与 provider-hosted/server-tool request/result；
- JSON mode、JSON Schema、strict、grammar 等不同 response constraint；
- conversation continuation、previous response/server state 与显式 `store=false`；
- cache policy、sampling、deadline、output budget、metadata 和 provider-specific sealed options；
- requested model、operation 与调用方要求的 capability set。

`InferenceEventIR` 必须是版本化判别联合，至少覆盖 response/item/content/tool/reasoning/citation/annotation/refusal/hosted-tool 的 start-delta-end、usage correction、model/effective-route evidence、warning、唯一 terminal 和 typed error。事件保留 `sequence`、上游 request ID、attempt ID 与原协议 evidence digest。conformance 使用只绑定 candidate 链与 conformance physical lease 的 `ConformanceHostedToolAuthorizationReceipt`；成功响应后才允许派生并在激活中冻结 `HostedToolPolicyTemplateReceipt`。日常请求 IR 形成稳定 occurrence 后，每个 occurrence 才在 ingress 事务内取得 single-use `HostedToolAuthorizationReceipt`，精确绑定 policy/funding template、当前 FundingDecision、RuntimeRouteFenceLease、准确 upstream physical attempt/member/effective route/resource subject/ComputePolicyBinding、prepared request/adaptation plan、occurrence、rights/data receipt、可执行 `maxCalls`、逐 component reservation、hard-stop generation 与 expiry，并进入 ledger 和 terminal fold。上游必须提供 request-level 调用上限，或由 profile 对所有可能 call item 给出可执行的有限硬界；只能响应后报告次数而无法事前封顶时不授权。terminal 的实际 hosted-tool call item 与 authorization 在 occurrence/count/component 上无漏无重；未知 occurrence、超 maxCalls 或跨 member/attempt 换挂都进入费用异常并 hard stop。web search 等 read-only 外部工具仍需披露 query 去向和独立费用；code interpreter/file 等会写 provider state 或产生外部副作用、但上游不能在执行前停下来取得逐次 Gate 的，一律在请求首字节前拒绝。

host 先从 canonical IR 生成有序 `IrOccurrence[]`，每个 content part、tool call/result、reasoning block、citation/refusal constraint 和 provider option 都有稳定 `{path, kind, digest, requiredness}`，重复同类项也各占一项。adapter 在发请求前生成不可变 `AdaptationPlan`：

> **合同草案**：见 [`ai-supply-contracts-draft/04-inference-ir.ts`](ai-supply-contracts-draft/04-inference-ir.ts)（136 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


host 只通过`commitInferenceIrContentHandleV20`和`commitInferenceRequestIrV20`签发可进入adapter的IR；content digest、长度、mime、occurrence值、handle集合和request digest必须由同一组canonical bytes逐项重算，插件拿到handle但没有ambient path或直接字节读取权。host验证 coverage 与 `IrOccurrence[]` 是按 path/digest 无漏、无重、互斥且完备的一一分区，并由 protocol profile 验证每个 wire location 和最终 wire-plan digest；一条 feature 声明不能覆盖两个 occurrence。required occurrence 若为 `omitted`、translation 没有通过对应 TCK、wire pointer/digest不符，或adapter想发送schema外provider option，请求在任何网络字节发出前失败。只有明确标成optional的展示性字段可以降级，并把warning写进结果和UI；reasoning signature、tool identity、strict schema、citation/refusal、hosted-tool side effect、data boundary、usage/费用和route identity都不是可静默丢弃项。组合property/mutation fixture必须覆盖多个image、并行tool call、重复reasoning block和删除中间occurrence。

响应侧不能由decoder自己宣称“没有丢字段”。decoder只能返回未受信的`DecodedInferenceEventProposalV20`；host transport先保留有界raw frame/byte digest，再由`verifyAndCommitInferenceEventIrV20`把准确request pointer、attempt、sequence、typed value/handle与raw occurrence绑定成不可伪造事件。由bundled framing verifier或`policy.tuf`受信、严格声明式的response profile对每个event/field建立`RawResponseOccurrence`。第三方code plugin可以提出IR映射，但无权把raw field标成harmless、无权删除occurrence，也无权成为model/route/usage/data-boundary/terminal-side-effect的唯一事实源：


host 验证 response coverage 对 raw occurrence 无漏、无重、互斥且完备；已知 event 同时携带 text/signature/usage 等多个字段时，每个字段各占 occurrence，不能保留 text 后漏 signature。真正未知 event/field 默认立即产生 protocol terminal failure；只有受信 profile 预先具名、版本化且证明不含工具、费用、身份、usage correction、refusal 或 terminal 语义的 keepalive/展示字段才可 `ignored_optional`。ConformanceResult 必须引用 raw inventory、DecodingPlan、ResponseLoss 和全部 authoritative extraction；Capability/Activation 冻结相同 response/extractor profile，每个 runtime terminal 再产生本 attempt 的 loss receipt。不满足时零成功 terminal。

model、effective route/member、usage/billing、processing region、data processor 与 terminal side effect 只接受上面的 bundled verifier、受信声明式 extractor 或上游 attestation。每份 extraction 必须以唯一 `SecurityExtractionField` 同时命中 policy、raw occurrence、canonical typed value 与目标 subject；DataBoundary 只能聚合分别授权的 region 与 processor extraction，不能用宽泛字段跨域代签。第三方 decoder 的同字段只作 advisory；model 无权威证据按 `ObservedModelEvidence.absent` 降级，route/data unknown 阻断动态激活，usage 无权威证据使全部相关 reservation 保持最坏 `charge_unknown`，直到 provider bill/reconciliation。固定 TCK fixture 通过不能把条件式 code plugin 升格成安全权威。

IR 版本采用 additive-first：reader 必须拒绝未知 required feature，保留未知 optional extension；major 变更用双读/双写 fixture 和迁移 ADR。provider-native wire 类型可以 experimental，但稳定的 app-facing IR、错误分类和 TCK report 在宣布 stable 后遵循 SemVer 与弃用窗口。

### 4.12 控制面编译、数据面执行

借鉴成熟 gateway 的 control/data plane 分离，但保留 SayDo 单机 daemon 的部署简单性：逻辑分层和包依赖先分开，不为架构图强行拆成多个常驻服务。

**Control Plane** 负责 discovery、registry/TUF 更新、rights/billing/data evidence、用户配置、conformance、推荐、activation 与 drift。它可以访问 SQLite、受限文件和网络，但先编译纯 JSON、可 JCS 重算的描述符，再构造运行时对象：

> **合同草案**：见 [`ai-supply-contracts-draft/05-control-plane.ts`](ai-supply-contracts-draft/05-control-plane.ts)（32 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


`ActiveSupplySnapshotCore` 的数组按 canonical key 排序且 key 唯一，完整签入 entry key、identity、receipt/artifact 和 compiler version。runtime Map/handle 只由校验过的 core 构造，entry 必须逐项指回 core digest；构造后深冻结、关闭可变别名并保留私有引用计数。现有 JCS 不接受 `Map` 作为签名域；单 entry value/key、排序、compiler version 或 handle identity 变化必须改变 core digest，mutation fixture 直接证明。

Control Plane 在编译期完整解析 receipt graph 与 `billing-limit-fold-v1/execution-billing-fold-v1`，生成只含有界整数运算、typed ref offsets 和 generation guards 的 immutable authorization fold program；Data Plane 不逐请求遍历 1024-node 图，只校验 program/source digest、generation 并对本次实际 sequence/component执行固定程序。最大合法 RouteSet、generation churn 和 terminal fold 必须仍满足 §12.1 的 10 ms 硬上限。

自动 fallback 也只能来自 snapshot 内的有限 `FallbackPlanTemplateReceipt`。template 只冻结完整四槽 alternative、capability、evaluator 独立性、route fence、rights/billing/data 与 funding 模板，不携带任何未来调用的 authorization 或 disclosure。每次 ingress 必须另行生成 `FallbackInvocationEnvelopeReceipt`、全部当前 `InferenceFundingDecisionReceipt`、聚合 reservation、事前 disclosure 与 `FallbackAdmissionReceipt`，再创建 durable cursor。集合外错误终止本次请求，Control Plane 可异步为下一请求编译新 snapshot，Data Plane 不临时调用推荐器或拼接 B 的 binding。

**Data Plane** 只消费已验证 snapshot。一次 dispatch 固定为：

1. 原子 pin 当前 snapshot，并按 `slot + operation` 恰好解析一条 compiled binding；
2. 校验 request capability、AdaptationPlan、response/extractor profile 与当前有限 fallback plan，不查 provider catalog、不做 discovery、不刷新 rights或运行推荐器；
3. 取得 hard-stop lease，并执行一次有界 ingress admission transaction；Inference 付费路径在同一事务做 spend reserve，Execution session 做 dispatch Gate 和 session funding reserve，审计前驱需要 durable 时一并写入；
4. 进入 connector/route/principal 独立 bulkhead，获取已按完整平面 endpoint identity 分区的 transport；
5. 在安全 dialer 写出首个上游字节前复核 generation、temporal validity、EndpointCredentialEgress、secret version、RuntimeRouteFenceLease/upstream child lease 与 adapter digest；
6. 增量发送和解析 stream，持续传播 backpressure/cancel；每个工具动作回到 host，以独立有界 Gate transaction 创建/推进 `ToolInvocationReceipt` 后才执行，不能挤进尚未知参数的 ingress transaction；
7. 唯一 terminal 后结算 ledger、释放 queue/transport lease，并异步导出有界 telemetry。

Control Plane 只通过构造新 snapshot 并做一次原子指针交换改变 Data Plane。每个请求持有旧 snapshot 到 terminal，但它的发送 lease仍受 §4.8 可撤销屏障控制；旧 snapshot 在引用数归零后回收。emergency deny/secret revoke/rights hard stop 先在线性化 store 增加 generation、取消旧 generation in-flight，再发布新 snapshot；不能等待后台重编译才停止流量。配置发布失败继续使用完整旧 snapshot，不存在半新半旧对象图。

“热路径不查数据库”不能牺牲账本正确性。准确规则是：热路径不做 registry/discovery/config/rights/catalog 查询。纯 Inference 一次逻辑调用允许一个预编译 ingress admission transaction 和 terminal ledger transaction；Execution 另允许每个实际 tool invocation 一个预编译 Gate/idempotency transaction，因为参数事前未知。它们有独立队列、deadline、busy/fail-closed、吞吐/延迟 SLO 与恢复策略；SQLite busy、fsync 失败或 journal 不可持久化时，在对应网络/副作用首字节前 fail-closed。纯本地且无付费/副作用的路径可由 canonical 裁决是否只做内存 admission + 异步审计，但不能擅自放宽现有“审计不可变”合同。

Phase 2 只在 fake receipts 和 shadow compiler 上验证这条数据面、IR 与 SLO，不写 active pointer；第一个完整 Rights/Billing/DataBoundary/Funding/Activation 垂直切片到 Phase 3 才允许 production cutover，避免用伪造 manifest 提前上线 snapshot。

### 4.13 性能、背压与故障隔离

- Phase 0 固化版本化 `ResourceBudgetProfile v1`，所有数值进入 snapshot 和 TCK digest。一次自动组合轮分成两个互不越权的 mode：`static_filesystem` 最多调度 32 个已签 detector、并发 8、查看 256 个已登记路径属性、返回 32 候选、读取 1 MiB 公开 metadata、零子进程和零 packet，总墙钟 3 s；`passive_loopback_metadata` 由 host 而非 detector 执行，最多 16 个 registry 固定 probe、并发 8、仅 literal `127.0.0.1/::1`、GET/HEAD、无 query/body/auth/redirect/DNS、单响应 64 KiB、总 1 MiB、单请求 500 ms、总墙钟 2 s。单 detector 再受 64 paths、8 candidates、256 KiB 和 2 s 子上限。用户只对所选候选启动 `explicit_active`，合计最多 1 个受限子进程、8 个已登记 metadata 请求、1 MiB 响应、单动作 2 s 和总墙钟 5 s；模型 preload 是另受 `local-preload-v1` 约束的明确用户动作，不偷塞进 discovery timeout。超限只终止当前 detector；更大 catalog 必须发布新 profile并在执行前显示范围。
- 第三方 code plugin 的单实例限制只读取 release 固定的 `PluginWorkerBudgetProfileV1`，宿主聚合与公平限制只读取`HostWorkerBudgetProfileV1`及其内嵌`PublisherFairSchedulingProfileV1`；所有 profile digest同时进入sandbox admission、snapshot、TCK与报告。四个parser worker物理分为2个core detector专用slot与2个plugin pool slot，第三方不能借core保留容量。plugin pool按真实occupied-worker-millisecond而不是dispatch次数计费；公平主体是signer realm的唯一admission/debt/reservation group，同realm多个publisher alias不增加份额或容量。1至4个连续eligible debt group采用可回放的有界service-deficit调度，active组按12/6/4/3 twelfths分摊ideal service；整数递推、`-13..13`完整signed-truncate golden、240秒dispatch-start lag与240010 worker-millisecond债务界逐step验证，waiting组在active-cohort admission前share/accrual/service均为0。idle不积credit、new identity只获10毫秒，group identity、debt、reservation、cohort与epoch跨daemon重启保留，独立reference evaluator逐step核对实现。第5至第8个debt group进入只在job terminal发生的固定cohort轮换，600秒只保证进入active cohort，不保证等待期dispatch或25%份额；第9组及以后立即capacity unavailable。自动重启只采用profile中唯一的一小时滑动窗口；越过单实例、group、host或公平身份上限立即fail-closed并打开breaker。
- Wire、JSON/Schema、stream、worker、ContentHandle 与 registry archive 的全部规范数值只来自 §4.16.3 的 release 固定机器对象；本节不保留第二套 literal。同步 event-loop slice、何时转 worker、header/压缩/未闭合工具参数等遗漏字段也合并进同一 `wire-budget-v1` canonical schema。任何语义或数值改变都发布新 profile ID，CI 拒绝同一 profile ID 对应两个 JCS digest。
- 正式平台的 code plugin/Execution Driver sandbox 不是一条抽象承诺，而是 release matrix：macOS 使用签名的 App Sandbox/XPC helper、明确 entitlement 与 rlimit/task accounting；Linux 使用 user/mount/network namespace、seccomp、Landlock 与 cgroup v2/rlimit 的交集；Windows 使用 AppContainer/restricted token、Job Object 和显式 network capability。每个平台都要在真实 runner 上直接验证 `open/connect/exec/keychain-or-credential-store/process-inspection/foreign-IPC` 负例、CPU/RSS/进程数强制和进程树回收；某后端缺失或内核/策略不满足时，该平台只能 inventory，不能回落为同 UID 子进程。
- 每个 connector、route、principal 和 operation 都有独立 `maxInFlight/maxQueued/maxQueueBytes/deadline`；队列满立即返回有处方的 overload，不在内存无限等待。远程慢 provider、本地大模型和 Execution Agent 不能共享一个全局 semaphore。
- HTTP keep-alive/HTTP2 session 按完整 `InferenceEndpointIdentity | ExecutionEndpointIdentity`、TLS policy、proxy、auth isolation class 和 credential generation 分池，且两平面永不共池。redirect 不复用 credential；secret 轮换/endpoint drift 退休旧池。任何官方 SDK 只有使用 SayDo 注入的 transport 且关闭内部 retry/pool 时才能进入数据面。
- SSE/JSONL/WebSocket parser 按字节增量处理，正确跨 UTF-8 和 frame 边界；每行、每 frame、单 event、未完成 tool arguments、累计 metadata 与每 stream buffer 都有上限。正文不为日志或 schema validation 全量复制；消费者变慢时暂停上游读取，不能用无界数组吸收。
- 核心 SSE profile在收到任一响应字节后不自动重连，也不自行发送 `Last-Event-ID`：大多数生成 API没有可证明的幂等续流语义，重连可能重复生成、工具调用和计费。只有未来具名 provider profile同时定义稳定 resume token、服务端保留窗口、exactly-once事件去重、同一 physical lease/funding cap和TCK kill-point证明时，才可启用 namespaced resume capability；普通 HTTP retry/idempotency key不能冒充流恢复。
- deadline 是一个从 ingress 传到底层 socket/child process/tool gate 的绝对时间，不是每层重新开始的 timeout。取消要关闭 fetch/body reader/socket 或杀完整进程树，并在 §12.1 预算内可测。
- retry budget 属于一次物理 attempt 计划。只有首个上游请求字节尚未发送的 connect/DNS/TLS 安全错误，或上游提供且 adapter 已验证幂等键时才可重试；已收到响应字节、工具事件或 usage 后默认终止。跨 account、funding source、provider、route 或模型的 fallback 永远重新求解、重新授权和另记 attempt。
- circuit breaker 只影响当前 route 的可用性评分和 admission，不修改 active config、不代替 Rights/Billing hard stop。半开探测使用独立预算，不夹带真实用户 prompt。breaker、rate limiter 与 retry 以确定性 clock/random 注入测试，禁止依赖真实 sleep。
- bundled driver 进程内异常转 typed error；第三方 plugin 有独立进程、消息/CPU/RSS/重启预算和 per-plugin breaker。plugin crash 不允许 host 自动改走另一付费来源。
- Node 22 继续作为 daemon 基线。只有 §12 的 profile 证明 parser、crypto、SQLite 或事件循环是实际瓶颈，且纯 TS 优化仍未达标时，才能以 ADR 引入 worker thread、native addon 或 Wasm；不以语言重写代替边界和测试。

### 4.14 可观测性、错误合同与诊断

一次用户逻辑调用、每次物理 upstream attempt、每段 transport、每次 tool gate/execute 与 ledger transition 是不同 span/event，trace parent 关系必须能解释“为什么一次点击产生了几次请求”。优先采用当前稳定的 OpenTelemetry HTTP/RPC 与 GenAI semantic conventions；仍为 experimental 的 GenAI 属性经过 `telemetry-compat` 单点映射，不能散落全仓。稳定前 SayDo 自有字段使用 `saydo.ai.*` 低基数命名并有版本。

默认 telemetry **不记录** prompt、response、tool arguments/result、URL、query、header、账号、完整路径、model alias 原文或 secret fingerprint。只有用户在本机诊断流程中逐次 opt-in 才生成限时、加密、可预览的内容 bundle；远程导出仍需第二次确认。span/metric 只使用 connector kind、protocol profile、operation、result code、maturity、conformance level、耗时/bytes/token 桶和不可逆本机 keyed digest。provider/model/错误消息等无界字符串不做 metric label。

错误合同按责任层判别：`configuration | discovery | rights | billing | policy | auth | network | protocol | capability | upstream | overload | cancelled | internal`，每类再给稳定 code、retry/fix actor、是否可能计费、是否可继续旧 active。adapter 不能把所有异常改成 `provider_error`；UI 文案从 code + context 映射，日志原始异常只在脱敏后进入本地诊断。

状态中心和诊断包必须展示：逻辑调用 ID、实际 attempt 数、当前 snapshot/connector/adapter/profile digest 的短标识、健康变化时间、最近 TCK/live 验证版本、费用是否已结算、下一动作。诊断包先在 UI 列出将包含和排除的字段，再导出；测试 fixture 使用 canary secret/prompt/path 证明零泄漏。

### 4.15 开源贡献者与长期兼容性合同

项目是否“可借鉴”不由代码量决定，而由一个外部贡献者能否在不理解 daemon 全部状态机的情况下安全新增 connector 决定：

- `@saydo/connector-sdk` 只依赖 `@saydo/contracts`，提供 manifest、IR、adapter/driver 端口、RPC schema、错误类型和测试 helpers；不导出 daemon store、secret broker 实现或内部单例。
- `@saydo/connector-tck` 是唯一的 conformance runner、fake host、golden fixture、property/fuzz corpus 与故障注入实现；生产 runtime 只负责调度 live check 和验证既有报告，不能复制或依赖 TCK runner。
- `@saydo/connectors-builtin` 与第三方使用同一 SDK/TCK；禁止测试环境给内置 driver 私有后门。reference connector 同时给出最小 OpenAI-compatible provider pack、一个原生 protocol adapter 和一个 ACP driver 示例。
- `pnpm create saydo-connector` 只生成最小 manifest、测试和文档，不生成任意网络/文件权限。新 provider pack 在 fresh clone 下应能于 30 分钟内完成 schema 校验、离线 TCK 和文档预览；该时间由无项目经验的 maintainer dogfood 记录，不靠主观宣称。
- public API 只使用 `PublicApiStability=experimental | beta | stable | deprecated`；connector发布只使用 `ConnectorReleaseMaturity`，二者与 protocol conformance、runtime health、Rights state正交。用户当前结论只使用 `ConnectionReadiness=connected_verified | action_required | blocked` 和 `SolutionReadiness=conversation_ready | review_ready | blocked`，旧的混合 readiness字段由迁移器拒绝。`stable` SDK 的 breaking change 只能进下一个 major，至少跨一个 minor 提供 deprecation warning、迁移器和双版本 TCK；security hard stop 可立即撤销，但必须发 advisory。
- 支持清单、UI provider picker、官网表格和示例配置从 registry + TCK reports 生成。只有指定版本/mode/profile 的受信报告通过才显示协议能力 `core` 或 `extended`，且用户当前可用性必须同时展示 `ConnectionReadiness`/`SolutionReadiness`；`inventory`、`partial`、`stale` 或 `community_unverified` 不得显示成“支持”。
- 关键 admission、receipt verifier、安全 dialer、stream terminal 和 ledger 使用 decision-table + property/model-based + mutation testing；协议 parser 使用 chunk-boundary invariance 和 fuzz；activation/ledger 使用 kill-point recovery。所有失败 corpus 固化为回归 fixture。
- 包依赖由机器门禁保持单向：`contracts → connector-sdk → connector-runtime/connectors-builtin → daemon`；`connector-tck` 只依赖 public contract/SDK 和测试 host。daemon core 不被 connector 包反向 import，console 不 import driver 实现，provider ID 不出现在通用 policy/ledger/activation。
- release 产物生成 SPDX SBOM、SLSA provenance 和 Sigstore bundle，发布旁路可离线验证；GitHub Actions 最小权限、依赖 pin、CodeQL/依赖审计、OpenSSF Scorecard 与 SECURITY.md 进入 release gate。Connector pack/plugin 也携带 license、source、publisher、artifact digest、TCK report 与 provenance。
- `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`GOVERNANCE.md`、`CODEOWNERS` 与 DCO/CLA 裁决属于 GA 交付物。治理合同明确 SDK/协议/rights/billing/data/TUF 各自 review owner、两人或阈值批准、community→beta→stable 晋升、maintainer 转移、无人维护 sunset SLA、安全撤销和 TUF delegation 回收；不能让“材料齐全”仍没有可执行的审批路径。

TCK 的可重复签名域与一次运行环境严格分开：

> **合同草案**：见 [`ai-supply-contracts-draft/06-sdk-compat.ts`](ai-supply-contracts-draft/06-sdk-compat.ts)（674 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


CLI 和 library 对同一输入必须得到相同 `ConformanceResultCore` digest；时间、OS、硬件、runtime、seed、runner invocation、stdout/stderr 摘要与退出码只进入不含任何签名或 release-manifest 引用的 canonical `ConformanceRunPayload`，所以不会伪称两次完整运行字节相同，也不会产生 bundle 自引用。尤其discovery core只含稳定detector/mode/policy/profile/budget，held socket lease、accepted decision及其消费、sandbox canary实例、实际动作和terminal只进入由core kind决定的typed `runEvidence`；把任一live receipt写回core或把另一mode的run evidence换挂都拒绝。先 JCS payload 得到 `payloadDigest`，再让 SLSA provenance subject 与 DSSE/Sigstore payload 都精确绑定该 digest；detached `ConformanceAttestation` 只绑定 payload、provenance 与 bundle，最外层 `ReleaseConformanceBinding` 再单向绑定 attestation、被测 distribution 和实际发布的 immutable distribution payload。`releasedDistributionPayloadDigest` 的 manifest scope 明确排除该 detached binding、签名和所有会反向引用它的 release metadata；最外层 release manifest 只能引用 binding，binding 绝不引用包含自己的 archive digest。任何下层对象都不得反向引用外层 manifest。替换任何 payload 字段、签错 subject、互换 bundle/provenance/attestation、或 outcome 非 `completed_pass`、exitCode 非 0、expected/completed fixture digest 不等都拒绝。报告按 `reportKind` 使用严格判别联合：protocol/capability 要求各自的 provider、protocol 或 model identity，discovery 要求 detector/budget identity，execution 要求 agent surface/sandbox/Gate identity，bridge 则按 inference data-plane 与 route-control 两类分别绑定准确协议依赖、route/failover、费用、数据和 credential isolation，不填不适用的模型、detector 或 execution surface 字段。

公开 payload 只含版本化 environment class/digest、归一化失败码和脱敏摘要，不含 hostname、用户名、完整路径、账号、endpoint、prompt/output、tool arguments/result 或环境变量。含真实网络/账号的 live report 先在本机生成可预览 private evidence，再导出上述公共投影；两者 digest 链可核对但权限和保留期分开。

正式 `core/extended` 徽章只接受 registry verifier policy 允许的 builder/issuer。Sigstore 验证必须同时钉住 OIDC issuer、source repository、workflow path、受保护 ref/tag、environment、builder ID、source/material digest、provenance predicate 与 Rekor/checkpoint/trust-root 版本；项目 CI 从最终发货 tarball/binary 的黑盒 public entry 启动真实 runtime，并让 direct syscall、sandbox、transport、parser 与 Gate fixture命中该 `sutRuntimeArtifactDigest/sandboxHelper/policy/platform`，不能只测 fake host。把生产 host 换成普通同 UID child 的 mutation 必须红。publisher 自签或本地修改 runner 的结果最多是 `community_unverified`。verifier policy 与 trusted builder 变更走 `policy.tuf` 的独立 delegation、threshold 和 emergency revoke，不能由 connector 作者自己的 targets role 授权自己。

### 4.16 逐字节授权、证据权限与可扩展边界

本节是前述语义草图的规范性闭包。它不允许施工方把同名旧字段继续保留成第二条宽松路径；canonical 回写必须把本节合并到唯一判别联合、删除冲突分支，并由迁移器拒绝旧形状。任何网络、进程、文件、IPC、secret、费用或工具副作用都遵守同一不变量：**产生首个不可逆字节或 effect 之前，必须有绑定准确物理主体、完整策略、当前 generation、单次 cursor successor 和全部资源预算的 admission lease**。

#### 4.16.1 Reference monitor 与单次消费链

- provider、gateway、bridge、远程 Agent 或本地 daemon 的自报只能成为 inventory evidence。只有 SayDo 自己控制的 reference monitor，或与被测主体不同信任域、带受信 issuer/key/measurement/nonce/expiry 且能证明不可绕过 admission 的 enforcement plane，才能生成执行授权。authority policy 精确绑定受保护 endpoint/route/service principal 与双方 trust domain；template 只保存 policy。每个 session-create 或物理 lease 现场取得 `EnforcementAuthorityAttestationReceipt`，绑定对应 admission subject core、commit token、nonce、route/surface、measurement、generation 与 single-use admission。G1 的 authority、旧 nonce 或 template 内“fresh”字段都不能换挂给 G2 或另一 session。service identity、配置快照、响应后 route header、aggregate hard cap 或“由同一服务签名”的 attestation 都不能证明非绕过性。
- `ReceiptRef`在canonical JSON里永远只是固定`receiptKind/id/generation/digest/dependencyDomainDigest/committedSequence`指针，不内嵌目标payload；`dependencyDomain`是已拒绝的旧键，strict schema、迁移器、serializer和verifier都不得把它当别名。每个receipt字段都必须在随schema签名的`ReceiptEdgeManifestV1`中登记精确owner kind、JSON Pointer、非空target kind集合、cardinality与edge role，并同时给出可组合`orderingRules[]`、全部`sameValuePathPairs[]`、state-machine identity projection、版本化transition predicate和single-successor authority。通配target、未登记bare ref、运行时自选kind、嵌入目标body或只用producer自填的“CAS evidence digest”全部拒绝。外部TCK/TUF/法律证据先经当前verifier policy导入为无outgoing edge的`ImportedOpaqueEvidenceLeafReceipt`，生产receipt不得直接跨domain引用不可排序对象。
- store只在所有target digest已存在且`target.committedSequence < owner.committedSequence`后提交owner，JCS摘要包含完整link tuple；predecessor state还必须经manifest同时证明同一state-machine identity、subject/policy projection、writer epoch与anchor identity，revision恰少一，writer接管边则epoch严格递增。cursor类型模板可以递归描述多个revision，但实例图必须保持单向：revision N cursor只引用针对N-1提交的上一lease/terminal；针对N的当前lease直到N+1 cursor才作为历史边出现，绝不被N cursor反向包含。schema generator从同一manifest生成schema refine、store unique/CAS constraint、实例edge verifier和mutation fixture，门禁允许受该revision规则证明的类型级SCC，却拒绝任何实例级cycle、同序互引、successor反向引用、跨subject换挂或旧revision跳接。
- ledger range与actual-attempt report的迟到usage/settlement修正统一走`LedgerReportCursorReceipt → LedgerReportCorrectionLeaseReceipt → corrected range → AuthoritativeLedgerCorrectionReceipt → corrected report → next cursor`。cursor按完整`boundSubject` projection分区，lease创建与`(subject,cursorRevision)`唯一约束在同一writer/anchor事务CAS；commit只保存corrected report的无环core digest，corrected report再单向引用commit。两个revision N→N+1 sibling即使内容和签名都合法，也只有一个能成为权威successor；旧range/report保持不可变且所有supersede边可遍历。
- 所有能批准费用、凭据、网络、工具 effect、Gate、OAuth callback 或 owner decision 的本地控制 API 都先验证 `LocalControlSessionReceipt`：OS principal、应用 distribution、daemon实例、literal loopback/local IPC、HTTP Origin、Host、WebSocket Origin、channel binding和短期 CSRF session必须逐项相等。授权先生成不含决定的 immutable `AuthorizationProposalReceipt`，再生成只引用 proposal 的 `AuthorizationDisclosureReceipt`，随后由绑定 proposal、render、OS用户、本地 session、一次性 action nonce 与期限的 `UserDecisionReceipt`签收；最终 authorization/consent只能引用 accepted decision。恶意网页、DNS rebinding、CWSH、同 UID无 session进程、旧 nonce、换 render或事后补 disclosure均在任何 secret read、browser launch、首字节、spawn或 effect前拒绝。
- reference monitor 不是“某个 daemon进程自称自己是 writer”。每个会写 cursor、lease、ledger sent/terminal、OAuth exchange/credential commit 或 effect transition 的事务都必须携带由持久存储 authority签发的 `ReferenceMonitorWriterLeaseReceipt` 与单调 `writerEpoch`；存储层用 fencing token拒绝旧 epoch。writer epoch、预算余额、OAuth/effect消费位、时间高水位和TUF anti-rollback同时绑定数据库快照之外的 `SecurityMonotonicAnchorReceipt`，其来源只能是OS保护计数器、硬件计数器或远程透明见证。恢复旧SQLite/HOME快照、anchor不连续或无法证明无回滚时，全部 spend/OAuth/send/effect lease立即撤销并要求重新授权，绝不从旧余额继续消费。新实例接管前先让旧 lease过期或由 authority原子撤销，所有 in-flight lease、terminal、OAuth transition commit和 PreparedAttempt都绑定同一 epoch与anchor counter。两个 daemon实例、锁文件被复制、系统休眠后旧进程复活、数据库 failover或恢复旧快照时，最多一个 epoch能提交，败者在首字节/effect前停止。
- conformance、inference runtime、credential issuance、metadata probe 与 Execution runtime 各自有 durable cursor。创建 child lease 会在持有当前 writer lease的同一事务中把 cursor 从 `ready` 原子变成 `attempt_in_flight`，同时预留费用并提交唯一 commit token；首字节前再持久化绑定准确 lease/request/cursor/epoch的 send intent。terminal把 transport outcome、continuation和billing disposition分成正交判别轴：具名 edge允许 `advance`；最后一项、budget耗尽、发送前取消/hard-stop/deadline都能以 `exhausted|cancelled|hard_stopped|deadline`关闭cursor；首字节与durable sent之间崩溃写 `delivery_unknown`，保留最坏费用hold并禁止自动重试，除非有端到端幂等键或权威送达查询。后继 lease 只能在前驱 terminal与envelope edge共同允许时产生。两个 sibling、前驱未 terminal、成功后续发、跳号、旧 revision/epoch、重复 commit token、cursor 已 terminal 或 predecessor 不等都零字节。崩溃恢复只重读cursor/send-intent/terminal，不从日志文本猜测是否已发送。
- fixed route 也使用 `RuntimeInvocationEnvelopeReceipt`。安全重试表示显式序列 `fixed, fixed, ...`，每个物理请求占一个 ordinal、独立 reservation 和 terminal；`[fixed]` 只是无重试实例，不再与“可安全重试”规则矛盾。RouteSet 的 member 可以重复出现，但必须逐次列入有限序列；未列出的 SDK 隐藏 retry 一律关闭。
- 跨 SupplySolution fallback 不能拼接各自有效的 binding 和预算。每个`SupplySolutionReceipt`只有按`SupplySlotId`映射的规范`slots` tuple这一份槽位真相，不再保留`dialog/thinking/cheap/evaluator`命名副本；template、alternative、invocation envelope、逐solution admission、cursor、attempt lease、terminal与advance transition都用同一个`invokedSlot`泛型，只能引用该tuple的准确成员。`FallbackPlanTemplateReceipt` 必须进入 ActivationManifest/hard-stop closure，但其中绝不出现运行时 authorization、reservation 或 disclosure。每次 ingress 由当前 snapshot 先生成有限 `FallbackInvocationEnvelopeReceipt`，再取得全部 solution 的当前 FundingDecision、跨 solution逐单位aggregate funding/data graph、reservation与事前disclosure，最后原子签发 `FallbackAdmissionReceipt` 和 durable cursor。每个 solution内部必须先产生窄化的`RuntimeRouteSequenceTerminalReceipt`，由固定`fallback-inner-fold-v1`绑定最终内层cursor revision、全部physical terminal、sent aggregate、billing disposition、actual report和权威ledger range；外层`FallbackSolutionTerminalReceipt`不再复制sent/billing轴，只能按inner success/non-retryable/unknown/control-stop直接terminal，或让inner exhausted在具名`FallbackAdvanceTransitionReceipt`证明登记edge、相邻ordinal、同一slot、跨solution边与剩余总cap后advance。inner success或`delivery_unknown`永远不能被外层改写成retry/not-sent；A已sent且账务未知时即使合法转B，也由inner保留A的最坏预留。任何named-field与tuple双写、跨slot alternative、从A-slot拼到B-slot或用另一solution的admission均在类型、schema、CAS与mutation fixture四层拒绝。
- `ConformanceHostedToolAuthorizationReceipt` 只引用 candidate attempt、candidate Rights/DataBoundary/Billing、conformance authorization 与准确的 conformance physical lease；它不引用响应后才存在的 Capability、runtime template 或 FundingPolicy。响应后才能据 observed occurrence 生成 policy template。日常 `HostedToolAuthorizationReceipt` 必须额外绑定准确 `RuntimeUpstreamAttemptLeaseReceipt`、physical request、member/effective route/resource subject、ComputePolicyBinding、prepared request 与 adaptation plan。两条收据 kind 不可互换。final physical lease本身只给出条件式发送资格；随后生成的`PhysicalSendAuthorizationBundleReceipt`按request occurrence set无漏无重强引用该lease与全部 hosted-tool authorization，空occurrence必须使用严格空分支。只有bundle授予最终发送权，`PhysicalSendIntentReceipt`必须单次消费它。缺授权、错occurrence/profile/effect/component、跨member/attempt、重复授权或响应后补授权均无法产生send intent，从producer DAG上同时消除授权滞后、跨member换挂和摘要环。
- 所有 `local_device` 物理请求，不论 conformance/runtime，也不论 `auth=none`、Basic、Bearer 或 mTLS，都只使用一条 producer DAG：ready cursor → 不具发送权的 attempt intent → 在 held/connected socket 上取得 peer、local-or-LAN compute 与 isolation closure → 组成完整 `PreparedAttemptDescriptorReceipt` → 签发条件式 final physical lease → 闭合 hosted-tool authorization bundle并取得最终发送权 → durable send intent → 首字节。runtime用 `RuntimeAttemptIntentLeaseReceipt`冻结cursor、route、subject与prepared request，`NoNewSpendProofReceipt`只绑定当前compute lease；conformance使用`ConformanceAttemptIntentLeaseReceipt`并遵守完全相同的 compute-before-descriptor-before-final-lease 顺序。`LocalComputeLeaseReceipt`证明当前config/profile、已加载artifact content+file identity、model-load、route→artifact、device、network assurance与判别型runtime isolation。用户自启但无法圈禁的进程只能命中`observed_uncontained_process`，仍可证明“模型在本机计算”，但不具备本机隐私；只有full data-exit sandbox分支可进入“数据不出本机”。secret broker只能在完整descriptor与条件式final lease成功后读取凭据；任何 hosted-tool occurrence还必须在send intent前进入强类型authorization bundle。
- session-start 的`delivery_unknown`不是一次性死路：它创建独立`ExecutionSessionStartRecoveryCursorReceipt`，每轮按`recovery_ready → query_in_flight → still_unknown/recovery_ready | resolved_terminal`递增revision并保留原stable identity与费用hold；`still_unknown`只增加退避，之后仍可用当前authority和新时间证明再次查询。adopt、authoritatively absent与closed orphan才最终收口；无查询能力时只允许经typed本地proposal/disclosure/decision/consumption选择“独立operator证明不存在”或“永久封锁该identity并保留hold”，绝不重新执行原start。session建立后的状态机再分为`ExecutionSessionCursorReceipt → ExecutionTurnLeaseReceipt → ExecutionRequestSequenceCursorReceipt → ExecutionPhysicalRequestLeaseReceipt/send-intent/terminal`，且每条surface都通过映射型`ExecutionPeerOrProcessIdentityReceipt`绑定准确stdio进程、loopback peer或远程service identity，bare `ReceiptRef`不能充当peer。`ExecutionSessionCloseLeaseReceipt`与`ExecutionTurnLeaseReceipt`竞争同一session cursor revision的single-successor CAS：close未形成intent时通过准确pre-intent authority closure回到close-retry-ready，不能永久封锁也不能让独立close terminal再次提交同一CAS；已发生close delivery unknown时才可经具名查询/人工证据封锁该remote identity。每个模型响应都必须形成绑定准确physical lease、send intent与request的`ExecutionResponseEvidenceReceipt`，保存raw response inventory、解码计划、response-loss、权威与advisory extraction、result occurrence和tool occurrence；provider failure、partial/unknown、success-with-tools与success-without-tools严格判别。工具外部响应同样使用`ExecutionToolResponseEvidenceReceipt`，最终`ExecutionResultEvidenceReceipt`只能从普通权威结果、已提交effect的result material、zero-work result或绑定原unknown effect与独立authority的manual committed result生成，不能从摘要或普通manual decision补写成功。返回工具调用的模型success必须先生成`RegisteredToolInvocationSetReceipt`，从同一raw response inventory逐occurrence登记tool-call ID、名称、参数、resource scope与replay lineage；每个`ToolInvocationReceipt`只能对应其中一项。`ExecutionToolResultsAppliedReceipt`要求registered set、invocation set和final result/abort terminal set无漏无重完全相等，未知注入、漏一个child或重复结果都不能推进下一模型请求。物理请求`delivery_unknown`只能生成 outcome相同且`resultingSessionCursorState=reconciliation_required`的turn terminal，新的turn lease不接受该cursor；随后必须取得不授予任何动作的`ExecutionTurnUnknownReconciliationLeaseReceipt`，先按`authority_query`持久化query intent，若权威状态要求清理，再另取`effect_cleanup` intent与terminal；两种lease的before-intent分支都以准确authority inventory逐项释放。只有`authoritatively_resolved | cleanup_confirmed | permanently_blocked_with_hold`可以收口，`still_unknown`只回到可继续查询的reconciliation-required cursor，不能直接关闭session；人工分支强绑本地proposal/disclosure/decision/consumption，session terminal不能消费任意`ReceiptRef`。首请求前远端session关闭则投影为`session_closing`并终结旧lease，绝不回到ready；若要重连必须重新执行admission/start/recovery。turn/session都具有zero-request/zero-turn terminal，cancel、hard-stop、deadline、delivery-unknown从physical→request sequence→turn→session以及runtime→fallback无损fold，绝不把deadline改写成普通failed。任何层级都不能把“一个HTTP请求成功”偷换成“整个session完成”。所有Agent网络只能经过此broker，Agent不能持有可绕过broker的通用socket capability。
- Execution 的 no-new-spend 只接受 `ExecutionNoNewSpendProofReceipt`，它绑定 pre-session admission subject、surface、准确 operation、funding template、principal 与 generation；订阅硬 cap 或 spawn 前可取得的 owned-capacity admission 是两个严格分支。Inference 的 `NoNewSpendProofReceipt`、登录态、套餐名或调用方自报 `proofClass` 都不能换挂给 Execution。
- 持久预算不是 prose shortcut，也不把整份 policy 串行锁到最慢调用结束。`PersistentBudgetPolicyReceipt`由独立proposal/disclosure/decision建立，冻结binding/template/source/target/slot/family/region、逐单位总额度、请求数、TTL、撤销generation以及唯一`immutable_authoritative_final | bounded_correction_horizon`策略；余额cursor只在线性化 reservation、撤销/过期与 correction transaction 时短暂CAS。每个 child authorization在一个事务中扣除包含最大更正向量的最坏额度、更新有界 outstanding hold set，并立即生成新的`ready | exhausted`余额revision；child随后拥有独立 settlement cursor，因此同一policy可让已获预留的调用并发执行、乱序结算而总cap不超。只有不可再上调的权威final、权威关闭的correction horizon或权威未发送证明才能释放unused reservation；provisional usage、nonfinal usage、`charge_unknown`、断联和撤销/过期后的在途child都保留完整最坏hold。horizon内的`AuthoritativeLedgerCorrectionReceipt`只在既有escrow内调整actual分配，物理request cap、outstanding set/count、billing hold和physical hold与前驱逐字段相等，不制造新余额；超过声明最大值或immutable final后上调属于`PersistentBudgetAuthorityBreachReceipt`，立即撤销authority profile和永久hard-stop，但绝不扩张用户授权。100个同policy并发、乱序settlement、provisional→新授权被拒、horizon关闭后释放、escrow内更正、authority breach、revoke竞态、旧余额恢复、template/generation漂移和跨unit挪用全部由model gate覆盖。
- 每个 Execution tool 不只在逻辑 invocation层过Gate。先生成不含cursor的 immutable `ToolInvocationReceipt`，初始 `ExecutionToolRequestCursorReceipt`只单向引用它，禁止互含digest。每个真实外部请求先生成 `ExecutionToolExternalRequestPolicyBindingReceipt`，精确绑定endpoint/body、transport、network admission、Rights、DataBoundary、Billing、全部credential component/egress/ACL、tool consent、processor/region与generation；request lease必须引用同一binding。`read_only`分支需要GET/HEAD无副作用证明，只有它可以按已登记edge使用普通sent retry/terminal；最终success只能经`record_read_only_result: executing → result_recorded`绑定同一只读terminal与terminal cursor。`side_effect`分支必须在首字节前引用绑定同一externalRequestId/endpoint/body/effectOrdinal的`ExecutorCommitLeaseReceipt`；无论成功、5xx/4xx、after-send取消/超时或response loss，request terminal都只能进入`effect_in_flight`，再由typed provider idempotency/effect query生成`committed | authoritatively_not_committed | delivery_unknown`。只有权威未提交且命中预登记edge才回ready；unknown只能terminal并进入`executing_unknown`，effect terminal与账务hold在同一cursor CAS收口。`completed_without_work`可通过专属`complete_without_external_work: executing → result_recorded`强引用zero-work terminal、result与零发送/零effect ledger closure；zero-work cancel/hard-stop/deadline只能走`aborted`。所有final transition按read-only success、committed effect、zero-work success、zero-work abort、unknown人工调和与无effect abort六类严格绑定相容的terminal cursor，不能只靠通用布尔证明把不相容分支拼接。manual reconciliation同样经过typed本地proposal/disclosure/decision/consumption并逐分支绑定准确evidence与唯一target transition。预登记workflow允许一个tool顺序执行多个请求；最后成功、耗尽、取消和hard-stop都有合法terminal。`no_external_charge`只接受external request cap=0、billing component=0且网络/provider副作用出口被sandbox拒绝的机械证明。
- 本机数据局部性证明对 inference 与 Execution 分别覆盖真实模型/Agent 进程树及所有可达应用级出口：继承 FD/HANDLE、mount/同步目录、临时文件、日志、IPC、shared memory、named pipe、helper、子进程和现存 socket。`LocalInferenceSandboxPolicyTemplateReceipt/LocalInferenceRuntimeSandboxReceipt` 不能由 network-only assurance 代替，并同时进入 LocalComputeLease、DataBoundary 与 Activation。启动时只允许显式 handle allowlist，并使用 `close_range`/`posix_spawn` file actions/Windows handle list 等原子机制关闭 ambient handles；runtime receipt 记录 realized 与 closed set。每个平台 TCK 预置 canary sync file、pipe、socket、shared memory、helper 与 inherited handle，并直接从被测最终 distribution 尝试逃逸。任一出口既没有 OS deny，也没有逐出口本地证明时，不能显示“已限制已知数据出口”；swap/coredump/VRAM/snapshot/backup 等设备级残余总是由单独平台证明或明确提示覆盖，绝不被这份进程级 receipt暗示已解决。

当前生产实现的 `packages/daemon/src/runtimeChildRegistry.ts` 把受管子进程 ownership 逐项原子写入 `~/.saydo/runtime/children/<pid>.json`；本方案同时要求新 operation/lease authority 进入 SQLite。两者不能靠“升级时复制一次”衔接。Phase 1 必须先落一个具名 `runtime-child-registry-v1-to-v2` 迁移器：同一个不可复用 operation identity 同时包含 PID、process birth、command token、owner instance/writer epoch、PGID 或 Windows Job identity、binary identity与启动intent。迁移按 `legacy_json_only → dual_read_shadow_write → reconciled_dual_write → sqlite_authoritative_dual_write → sqlite_only` 单向推进，每次状态变化都由独立cursor CAS；进程回收器在整个降级窗口内读取两个store的精确并集，缺一边、内容冲突、旧epoch或无法证明birth identity时只 quarantine/hard-stop，绝不猜测后删除或发送信号。

`dual_read_shadow_write`只向SQLite写shadow且不改变旧版可见行为；全量reconcile把每个JSON对象和SQLite row按operation identity逐字段对账，零冲突后才能进入双写。`reconciled_dual_write`的每次spawn/establish/terminal/release必须取得一个双存储commit ordinal：两边都fsync成功才发布可执行permit；任一边失败时保留可恢复journal并拒绝目标进程执行。`sqlite_authoritative_dual_write`允许新版本以SQLite做CAS authority，但继续写旧JSON投影，直到上一正式版二进制在真实HOME副本上完成spawn、daemon kill、restart、reap和downgrade恢复演练。只有签名rollback window关闭、全部in-flight终结、旧版兼容承诺到期且零未对账对象时才能CAS到`sqlite_only`并清理旧投影；清理是独立、可审计且可重放的后续动作，不与authority切换混成一个事务。

> **合同草案**：见 [`ai-supply-contracts-draft/07-reference-monitor.ts`](ai-supply-contracts-draft/07-reference-monitor.ts)（1,196 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


#### 4.16.2 OAuth、复合传输身份与 Base URL

- OAuth authorization-code + PKCE与Device Authorization Grant使用两个严格flow-start kind。二者在外部动作前分别经过用途专属proposal/disclosure/accepted decision及`UserDecisionConsumptionCommitReceipt`；PKCE冻结redirect/state/S256 challenge/verifier handle与authorization request，device分支冻结endpoint/request/polling profile。随后才可消费同一writer epoch下的durable`OAuthFlowStartCursorReceipt`并取得single-use start lease。start、callback与exchange每一级都是含success、before-action/send failure、provider denial、cancel、hard-stop、deadline、expiry/state mismatch与delivery-unknown的严格terminal union，并逐分支提交resulting revision/state；任何失败都能诚实关闭，不能伪填code/device token或永久留在in-flight。两个daemon、两个sibling或旧epoch最多一个能执行外部动作。只有对应success terminal才能创建exchange cursor，绝不伪造另一分支字段或让另一flow消费code。client registration严格区分public/confidential以及none、client secret、private-key JWT、mTLS client auth；每个secret/cert都有独立component/ACL/egress。若请求`openid`，flow-start同时冻结nonce/issuer/audience/azp/alg/JWKS policy，只有签名、alg、iss、aud、azp、nonce、时间全部通过的`OidcIdTokenValidationReceipt`才能形成subject；纯OAuth flow禁止拿ID token作身份或授权。
- PKCE browser launch之后必须经过writer-fenced`OAuthAuthorizationCallbackCursorReceipt/Lease/Terminal`：真实loopback listener绑定callback Origin/Host、local control session、redirect URI、返回state、code broker handle、收到时间和单次消费；authorization-code exchange lease只接受success callback。每个OAuth/API-key/workload物理请求都按`lease(no send authority) → durable send intent → first byte → terminal`线性化；无intent才可权威判not-sent，已有intent而无terminal一律进入unknown。`authorization_pending/slow_down`只接受device-poll lease，authorization-code或refresh收到该类响应进入`unexpected_poll_response`并关闭/释放准确family。OAuth credential family严格分`refreshable`与`access_only`：初始token response无refresh token时直接生成可在access not-after内签发access lease的access-only cursor，refresh lease对其不可构造；有refresh token时才允许`OAuthRefreshFamilyLeaseReceipt`。refresh成功token response、credential transition、旧token disposition、exchange commit与family winner revision在同一事务提交；只有无send intent的零字节终态才保留refresh并要求新lease，任何已发送provider failure、after-send取消/超时或`delivery_unknown`都撤销refresh、进入`access_only_reauthorization_required`。通用HTTP状态、错误body或producer自填digest永远不能证明refresh token可复用。native desktop distribution只能是public client和`none_public`；client-secret/private-key/mTLS confidential分支必须绑定独立server authority或可证明不可导出的实例密钥。
- OpenRouter官方所称OAuth实际是“浏览器PKCE授权后向固定exchange endpoint换取用户控制API key”，没有标准OAuth client_id/scope/access token/refresh token语义。它使用独立`ApiKeyPkceFlowAuthorizationReceipt → durable flow cursor → browser start lease/terminal → callback lease/terminal → exchange lease/terminal → credential commit → ApiKeyPkceGrantReceipt`链；flow authorization同样强引用本地proposal/disclosure/accepted decision/consumption commit，所有browser/callback负向terminal与resulting revision/state均可恢复。UI写“OpenRouter登录（PKCE换取API key）”；不得伪造`OAuthClientRegistrationReceipt`、scope或token response。state/PKCE不匹配、重复code、callback/endpoint漂移、deadline、exchange delivery unknown和凭据轮换都有固定TCK。
- v1 OAuth profile明确只包含 authorization-code+PKCE、device authorization、refresh，以及 `none/client_secret/private_key_jwt/mTLS` client authentication和可选 OIDC ID Token校验。要求 PAR、JAR、JARM、OAuth Token Exchange、DPoP或其他 sender-constrained token机制的 provider必须声明不同 namespaced auth profile并保持inventory，直到对应 request object、nonce/replay、key lifecycle、token binding与TCK进入canonical；实现不得忽略必需扩展后仍显示OAuth已支持。
- AWS/GCP/Azure workload identity issuance是独立逻辑cursor和物理子请求序列：逻辑`RequestLease`不授予发送权，每个物理step再取得独立lease、durable send intent与terminal。`CredentialedWorkloadIdentityProfileReceipt`在类型层排除AWS instance identity、Google metadata identity和Azure managed identity；后三者只能走exact-empty component/egress/ACL的`no_credential_components`分支，并强引用同一profile/source/endpoint/request/generation的NoCredential proof与source-specific admission。AWS IMDSv2严格拆为token PUT与credential GET两个有序step，各有独立ordinal/lease/intent/terminal，GET强绑PUT success返回的broker handle，禁IMDSv1；Google/Azure各为自己的单步metadata请求。metadata endpoint使用release-pinned link-local/platform集合、专用dialer、SSRF/container-escape保护、零redirect/proxy/用户URL。只有最终物理step success才能提交临时credential；任一步after-send或unknown都不能重放整段序列。AWS named static profile继续走独立SigV4 signing authority，不伪装temporary issuance。
- endpoint 不是“host + 一个 auth kind”。`TransportSecurityProfileReceipt` 的每个有序 hop 都有独立 ordinal、DNS/socket 和可选 TLS layer；HTTPS proxy 的 TLS/SNI/trust/terminator/client identity 与 CONNECT 后 origin 的第二层 TLS 完全分开。proxy auth只发给对应 proxy hop，application auth只发给最终 origin，每个 mTLS/client/OAuth credential也绑定准确 layer/recipient。HTTP forward proxy 或企业 TLS interception 能看到的 prompt、response 与 application credential必须作为独立 `TransportObservableProcessorReceipt` 进入 DataBoundary、事前 disclosure 和 credential exposure decision，不能只把最终 origin列为 processor；可见 processor 集与用户授权集不相等即零 secret、零请求。CONNECT/SOCKS 的下一跳解析要么携带 SayDo钉住地址，要么由独立不可绕过的 proxy-resolution authority逐 attempt证明；后者必须现场生成`ProxyResolutionAttemptAttestationReceipt`，绑定proxy、请求hostname/port、实际resolved socket set、attempt、writer epoch、nonce、commit token、generation和短expiry，并进入`PreparedAttemptDescriptor`。静态`requiresPerAttemptAttestation`布尔值或普通remote-DNS自报不能绕过SSRF。`PreparedAttemptDescriptor`还携带按component ID/ordinal排序且与complete-set digest无漏无重的egress+ACL集；只有全集为空时才允许`no_credential`。每层TLS禁用TLS 1.3 0-RTT；公共CA leaf正常续期只要仍命中同一trust/SNI/terminator policy就不hard stop，显式pin/root/hop/terminator/mTLS identity或auth component改变则hard stop。
- Base URL 与 operation path 采用 RFC 3986 directory resolution，禁止字符串拼接和“看到 `/v1` 就猜”。`ApiBaseProfile` 明确 `baseSemantics=api_root | version_root`，保存规范化且以 `/` 结尾的 base directory，以及不以 `/` 开头、不能含 dot segment/encoded separator/query/fragment 的 `operationRelativePath`。`api_root` preset 可登记 `v1/chat/completions`、`v1/responses` 或 `v1/messages`；`version_root` 登记 `chat/completions`、`responses` 或 `messages`。解析后再做一次 percent-decode safety 检查，禁止 `%2f/%5c/%2e` 形成新边界。完全自定义入口先展示最终 method+origin+path 预览；无可信 metadata 时让用户选择“URL 已包含 API 版本”或“使用协议默认版本”，不静默删、加或重复 `/v1`。
- `ApiBaseProfile`本身只能由私有normalizer提交；canonical base directory和relative path都带不可伪造安全品牌，调用方不能把普通`string`强塞进Activation。自定义协议与认证是两条正交轴：OpenAI Chat、OpenAI Responses、Anthropic Messages都可显式选择`none | bearer | x_api_key | custom_secret_header`，mTLS client identity又可独立为`none | mutual_tls`，不得因协议名静默选择认证。`ResolvedCustomEndpointAuthenticationReceiptV6`把最终path、RequestProfile、application auth、mTLS、全部credential component、recipient、proxy可见processor、egress/ACL与secret version闭合；例如Messages+Bearer、Responses+`x-api-key`、Chat+无认证和任一协议+自定义秘密header/mTLS都是可构造组合。81行reference minimum中的五条custom row只是首发代表性release fixtures，不是运行时组合上限；一个额外组合只有完成同等级owner requirement、conformance和claim后才可出现在公开“已支持”列表，但用户仍可作为明确标注unknown-metering的自定义连接逐次主动使用。
- 用户可在“高级设置”自助添加最多16个非敏感常量header；每个header先经`custom-public-header-v1`名称/值长度、控制字符、confusable与secret classifier门禁，再显示名称和脱敏值预览并消费一次本地决定。组织私有gateway若使用`X-Auth-Token`、Azure风格`api-key`等秘密header，必须选择独立`custom_secret_header`认证而不能伪装成公开常量：`custom-secret-header-v1`对field-name做ASCII lowercase规范化，拒绝Authorization、Proxy-Authorization、Cookie、Host、Content-Length、Transfer-Encoding、Connection、Upgrade、Proxy/Forwarded前缀、hop-by-hop、控制字符与Unicode confusable；`api-key`在没有同名protocol/preset credential component时是合法正例，若selected profile已注入同名credential则按collision拒绝，不能覆盖。规范名与任何public/credential component碰撞或重复即拒绝。secret只保存broker handle+version，逐字段绑定endpoint、RequestProfile、principal、recipient、proxy可见processor、ACL、egress decision、local proposal/disclosure/decision/consumption、TTL和generation；redirect和proxy credential forwarding永久禁止。fixture覆盖`X-Auth-Token`与无冲突`api-key`正例，以及header大小写碰撞、重复、换行、confusable、redirect/proxy泄漏和secret/public或preset混装负例。
- `ProductEligibilityReceipt.status=user_or_admin_attested_custom` 只为精确 custom endpoint/product/use/distribution/attesting principal/TTL 打开本机凭据录入，并强制显示“非官方预设，SayDo 无法替你确认供应商条款”。credential principal 形成后，资源 owner/组织管理员可以签发精确 `UserAdminAttestedCustomRightsReceipt`；它只表示该主体授权 SayDo 对其自有/私有资源作所列用途，不冒充厂商或法律 Rights，也不能覆盖第三方消费者订阅。随后仍需逐 component credential egress。
- 真 custom/private gateway 若没有权威 price/usage/hard cap，candidate billing 使用严格 `externally_metered_unknown_custom` 分支，并在首测前取得绑定 exact attempt/endpoint/prepared request/physical cap/disclosure 的 `ConformanceExternallyMeteredUnknownConsentReceipt`；响应只能生成明确标记 unknown 的 ConformanceResult 与 operation closure，不能伪装 `covered/settled`。Binding/FundingTemplate 形成后，每次 runtime physical call 再使用 `ExternallyMeteredUnknownConsentReceipt`，并通过 `InferenceFundingDecisionReceipt` 的独立分支进入 sender。该路径只能用户主动逐次选择，永不进入 no-new-spend、自动推荐、自动 fallback、evaluator 或后台 health。这样既没有“先要 binding 才能首测”的 producer 环，也不会把愿意填 key 升级成官方支持。
- 官方企业云 endpoint/IAM若Rights与DataBoundary可证明、但企业协议价、credits、成本中心或平台hard cap无法权威读取，则使用独立`externally_metered_unknown_official`分支和`OfficialEnterpriseUnknownMeteringRightsReceipt`，不伪装成非官方custom。它仍逐次绑定exact endpoint/principal/resource/region/request/cap与accepted disclosure，允许人工连接，但禁止settled/no-new-spend、自动推荐、fallback、evaluator、后台和无人值守。custom与official unknown在candidate/conformance/runtime/report全链保持判别型，不得共享rights attestation。

#### 4.16.3 Wire、归档与宿主总预算

所有预算 profile 是 release 固定数据，不接受 registry/plugin 自报放宽。v1 数值如下；N-1/N/N+1、慢速流、chunk 边界、压缩炸弹和并发洪泛都必须有 fixture：

合同编译本身也属于产品资源预算。Phase 0先把手写的receipt/edge/state schema DSL与它生成的TypeScript artifact分成两项独立预算：手写SoT保持小而可审查，展开后的生成物允许更大但必须可复现；不能拿扩大生成物门限掩盖手写复杂度增长。锁定Node 22、单进程`--max-old-space-size=2048`、TypeScript 5.9.3、ES2023/NodeNext、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`和零`any` stub运行`--extendedDiagnostics`，并由跨平台runner记录wall time和peak RSS；heap上限是受测argv的一部分，不是事后调参，遗漏、重复、改宽或放到compiler entrypoint之后都使门非零。当前文档抽取编译只用于方案自检，不能替代未来artifact gate。完整generated contract和每个positive/negative fixture使用两个分开的measurement subject：前者每次只编译一份完整合同artifact，后者每次只增加一个fixture module；禁止把42个fixture拼成mega-module后用总结果掩盖单项爆炸，也禁止把完整合同拆成若干各自通过却无法共同加载的碎片。基线与当前版本都在无并发任务的同一受信runner上启动5个彼此隔离的cold process，wall取中位数、RSS取最大值，5次argv/source/lock/runner完全一致且全部零diagnostics；wall样本的`(max-min)/median`超过200 permille时判环境噪声、整组作废后另排队，不得挑样本。绝对门、至少30%剩余容量门与相对签名基线回退门是AND关系；更换runtime、compiler、runner image、hardware profile或baseline必须由固定canonical bytes、精确TUF target和owner批准的predecessor replacement producer生成，不允许被测代码自填更宽baseline。超过阈值只能先简化schema/生成器或按有向无环package/project-reference边界重构，不能提高heap或把一个必须共同加载的合同伪装为互不校验的编译单元。

> **合同草案**：见 [`ai-supply-contracts-draft/08-wire-budget.ts`](ai-supply-contracts-draft/08-wire-budget.ts)（12,630 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


- inline RPC frame 上限 1 MiB 与合法 32 MiB request 并不冲突：大内容只通过 host-owned `ContentHandle` 分块传输，handle 绑定总长度、chunk 序号、整体验证 digest、consumer、single-read capability、deadline 和 backpressure credit；插件拿不到路径或任意读取能力。创建 handle、预留 resident/spool/temp bytes、prepared attempt 与 publisher/session/attempt 四级配额在同一个 admission 事务中完成；慢读不能越过 host aggregate，进程崩溃后按持久 handle journal 在固定时限内清掉 orphan。解码器做 bounded incremental commitment，只保留当前窗口、未闭合结构与 rolling digest，不把整条 stream、全部 occurrence 或 raw JSON 同时复制多份。超过累计 bytes/nodes/events/occurrences/CPU/wall 任一上限立即取消 transport、回收 worker并写结构化 budget terminal。
- 宿主预算跨所有 connector、publisher 和 session 聚合；prepared attempt、ContentHandle 与 evidence raw/projection/temp ingest 都占独立且同时生效的固定额度。evidence admission还必须在同一事务验证 `aggregateTemporaryBytes + potentialOrphanBytesAfterAdmission <= maxCombinedTemporaryAndPotentialOrphanBytes`，不能让两个各为128 MiB的独立字段合计放行256 MiB；N-1/N/N+1、reservation释放和恢复重算口径进入fixture。四个 parser worker被物理拆成2个core detector专用slot与2个plugin dispatch pool slot，第三方绝不借用core的50% worker和queue保留。公平调度的唯一记账主体是`signerRealmAdmissionAndDebtGroupDigest`；同一signer realm下任意publisher ID都只是别名，共享一份admission、debt、reservation、cohort和epoch。plugin pool不承诺每publisher别名独占slot，而按真实occupied-worker-millisecond记账：连续healthy+runnable+backlogged且未越配额的至多4个debt group，各自长期目标份额为plugin pool的250 permille，非抢占最长job为120秒，服务债务上限240010 worker-millisecond，参考集合最迟240秒获得一次dispatch。`PublisherFairServiceCurveArithmeticV1`用有符号整数“十二分之一worker-millisecond”消除1/3舍入：每个无eligibility边界的半开区间先从真实occupied occurrence求pool service `C`与group service `S[g]`，active group数`n=1..4`对应理想权重`12,6,4,3`，逐group机械计算`D'[g]=clamp(D[g]+C*(12/n)-12*S[g],-2880120,2880120)`；pool idle或group仍在overload waiting cohort时理想增量均为0。`-13..13`的27个整数逐点golden固定向零截断。dispatch从`debt-reservation`最高的group选择其最老可运行publisher job，再按最早eligibility epoch与稳定identity排序；estimate只形成group selection reservation，job terminal清除reservation，公平费用始终来自interval中的actual service。每个accounting step的`tracked=active+waiting`由0–8的九个exact tuple表达，line再严格区分active和waiting；实现必须与独立reference evaluator逐state/decision digest相等并拒绝全部列举mutation。新debt group只获120个twelfths即10毫秒credit，group状态跨daemon重启原样恢复，停机不增credit。第5至第8个eligible group进入4成员overload cohort：只在job terminal按稳定admission ring轮换、不杀健康运行任务，480秒换代、最长600秒进入active cohort并用固定退避表；该600秒不承诺dispatch start或25%份额。第9个group立即返回capacity unavailable，不进入无界等待，也不伪称公平保证。随机 registry 顺序、1000 个恶意 detector、慢消费者、多 handle、多publisher别名合谋、signer-realm identity churn、第5至第9个group、窗口边界与崩溃恢复fixture必须证明核心Ollama/CLI detector和合法第三方都获得合同内服务，且每次运行结果相同。
- `ReleaseBundledPassiveProbeCapabilityCore`、`REFERENCE_REQUIREMENTS_V3`、`GaEcosystemMatrixCoreV3` 与 `GaMandatoryBaselineV3` 都不引用报告、attestation、distribution digest或外层 release。唯一最低真相是逐`(entry, product, protocol/surface, exact wire/auth, realm, platform, recipe)`的requirements tuple；matrix、journey与baseline只从它投影。先把这些稳定core连同registry snapshot打入distribution并按明确manifest scope取digest；黑盒测试该immutable payload后，发布工具生成detached `GaEcosystemReleaseEvidenceSetV3`，再由准确row/oracle/completed evidence/gate/live/funding/distribution提交81条不可伪造`PublishedProductProtocolClaimV6`。四类支持产物只从该claim set生成，最外层`ReleaseEcosystemBinding`单向绑定evidence、claim set、逐requirement与逐journey完整runs、registry snapshot、四件套exact bytes和distribution artifact；最后`ReleaseEcosystemBindingAttestation`只签binding core digest。manifest scope明确排除evidence set、claim set、generated artifacts、detached binding/attestation/signature和外层release metadata；替换或漏掉任一requirement、oracle、recipe、matrix、probe、binary、baseline、platform/user-locale/pseudo-suite run、报告、claim、产物或错误scope均使离线验证失败。

#### 4.16.4 Discovery、extractor、健康检查与时间

- 在线或被攻破但有效签名的 catalog 只能引用由 `ReleaseEcosystemBinding` 锁定的 immutable `PassiveProbeCapabilityId`；capability core固化literal loopback destination、method、path、header、预算、parser、peer与零费用policy。宿主先观察listener identity，但不能把该观察直接当发送授权：必须先建立尚未写应用字节的connected socket，再从该socket取得并复核peer owner、PID-start、binary content/file identity与publisher，生成single-use`PassiveLoopbackPeerAdmissionReceipt`并保持socket到probe send。合法listener退出后恶意进程抢占端口、进程换位、旧PID receipt或无法从connected socket证明peer时均为零应用字节；不支持该能力的平台只显示candidate并转用户确认的`explicit_active`。
- 自动阶段可以纯静态判断 Docker Desktop/Engine、Podman 是否安装及已知 socket文件是否存在，但不连接socket、不运行CLI。若发现容器运行时，UI只给一个主动作“检查本机容器服务”；确认后在OS-enforced discovery sandbox中使用只读、无网络、无secret、固定命令/参数或受限socket schema枚举running/stopped容器、image label、published loopback port。它绝不start/restart/pull/create/load model。Docker Model Runner作为具名L2 journey：静态阶段只识别Docker Desktop与模型运行组件的公开安装迹象；确认后只读枚举其公开model/runtime状态和loopback endpoint；running且peer/profile匹配时按OpenAI-compatible preset首测，stopped/未启用时唯一主动作是“查看Docker Model Runner启用方法”，拉取模型和启用服务始终是用户在Docker中完成的外部任务。Podman AI Lab同样是独立具名L2 journey，而不是“发现了Podman”的别名：受信product identity将普通容器与AI Lab service区分，状态严格分为`ready | api_disabled | no_model | stopped | port_conflict | unsupported_version`，每个状态解析准确loopback endpoint/protocol profile并只给一个处方主动作；static阶段仍为零CLI/socket，explicit-active只读且不start/pull/load。Ollama/vLLM/LocalAI等停止服务遵守同一处方规则。
- `explicit_active` 只有在当前 OS 的 discovery sandbox 通过直接 syscall canary 才允许执行 CLI。仅清理 env 不足；若无 backend，只保留静态 inventory 或打开官方 UI/文档的人工路径。
- security-critical policy使用可复用`TufTargetAuthorizationReceipt`保存root、timestamp、snapshot、top-level targets到最终role的有序完整delegation步骤；每步固定parent/child metadata、key IDs、threshold、path/hash-prefix、terminating/order，再绑定target path/hash/length、consistent snapshot、外部monotonic anchor与anti-rollback high-watermark。Extractor、Rights、Billing、DataBoundary、credential egress和Execution policy都必须引用该完整对象，不能只存一个最终delegated role或不可遍历evidence digest。model、route、usage、processor、region、terminal、billing component属于不重叠delegation；第三方decoder值只作advisory。
- `TimeSourceAttestationReceipt` 必须验证 issuer/key/trust policy/nonce/sample/uncertainty/issued/max-age 与同 boot monotonic lineage，并让`TimeAuthorityReceipt`引用数据库外的`SecurityMonotonicAnchorReceipt`。网络不可用时只能沿已验证且未回滚的high-watermark保守推进；anchor连续性丢失不能拿可回拨wall clock兜底，而是撤销相关lease并要求重新授权。假key、旧nonce、跨boot replay、旧快照、超过uncertainty/max-age、回拨和future sample均产生`clock_untrusted`。
- `MonotonicAnchorPlatformReleaseProfileV1`为macOS arm64、Linux x64与Windows x64列出真实producer，不把普通文件、SQLite、Keychain/DPAPI/libsecret secret或wall clock冒充防回滚计数器。Linux/Windows可选通过TCK与attestation的TPM2 NV counter；三平台统一可用阈值remote transparency witness。witness是显式一等控制面服务：`RemoteTransparencyWitnessServiceProfileV1`冻结service/operator/trust domain、中国大陆/全球/企业realm、threshold member、endpoint/TLS、发送字段、用途、保留、subprocessor、处理region、企业proxy支持、零应用credential、零费用、零redirect、撤销/rotation/continuity与TUF lineage；`AnchorWitnessDataBoundaryReceipt`及独立proposal/disclosure/accepted decision/consumption在首次联系前把这些事实呈现给用户。release不能只携带artifact、SLO或“已部署”摘要：`RemoteWitnessOperationalQualificationReceiptV1`必须精确绑定本次production deployment和threshold set，在至少24小时窗口内由至少两个独立observer trust domain对每个member最多每5分钟执行一次带唯一ordinal的真实append→read-after-write→inclusion/consistency验证，每member至少288个完成run；原始request/response capture、member signature、observer signature与单调时钟进入可重放corpus。qualification逐member重算availability与P50/P95/P99，并逐threshold ordinal证明同一statement达到quorum；timeout、坏签名、旧consistency proof、冲突statement、低于threshold、coordinator restart和observer restart七类shadow namespace注入都必须得到准确fail-closed或安全恢复。独立reference evaluator从raw signed corpus零退出重放，实际availability至少999 permille、threshold P95不超过2秒、所有注入零漏检，且qualification在release时未过期；否则该witness profile不得进入正式distribution。
- 上述producer必须由Phase 1A的真实产品面承载：host-neutral合同与client分别位于`packages/platform-security`和`packages/anchor-witness-client`，三平台最小权限helper位于`native/platform-security/{darwin,linux,windows}`，production witness、三realm IaC、installer和runbook分别位于`services/anchor-witness`、`infra/anchor-witness`、`installers/platform-security`与`ops/anchor-witness`。包名存在不等于能力可用；最终installer安装的helper、当前production deployment、threshold/IaC digest、直接syscall TCK、升级降级和24小时qualification必须共同进入release closure，daemon内条件分支、mock或staging都不能生成正式producer receipt。
- fresh安装只有`BootScopedEphemeralLocalAnchorReceipt`时，通用非loopback cap仍为0；witness profile只能由`ReleasePinnedBootstrapWitnessAuthorizationReceipt`验证当前distribution的immutable manifest、pinned initial root与exact target bytes，不依赖尚未生成的设备TUF high-watermark或持久强锚。特殊网络预算明确拆为`registrationRequestCap=1`与有限`statusQueryCap=N`，同一durable boot cursor累计扣除请求/响应字节、墙钟和退避。registration response-loss后永久保留稳定identity，只能查询status；每次query都有独立lease/send-intent/terminal，offline、proxy失败、before/after-send取消、deadline与response-loss均有诚实终态。只有带权威witness evidence的`found | absent | still_unknown`可更新状态；absent、query预算或生命周期耗尽都终结当前授权并永久禁止重复registration，必须重新经过本地授权和新boot budget。UI使用`AnchorWitnessEnrollmentViewStateReceipt`覆盖未注册、披露、enrolling、offline、proxy blocked、threshold partial、rotation、continuity lost与ready，每态唯一主动作，并为三平台、`zh-CN/en-US/ar-SA`及中国/全球可达性运行独立GA journey。
- 没有合格persistent backend、用户拒绝witness或fresh离线安装时，产品机械降级为当前boot内、匿名、零secret、literal loopback、零付费/unknown费用、无OAuth/工具/fallback的`plain_dialog`本地推理；重启后重新发现和确认。该模式只读取release内置已签registry/probe能力，不接受在线catalog或旧HOME中的TUF高水位。全功能模式不可用时UI明确写“当前仅可使用本机基础对话；登录、API与工具操作需要联网见证或受支持硬件”，并给出配置代理、切换realm、重试或查看数据处理方的typed处方，不能静默降到可回滚文件锁。
- circuit breaker的自动half-open只能使用`automatic_zero_cost_loopback`，同时持有connected peer admission与权威零费用policy。任何带application/proxy/mTLS/workload credential的metadata请求只能由用户发起：已有Binding使用`user_initiated_established_binding_metadata`；首次连接使用独立`user_initiated_bootstrap_metadata`，绑定ProductEligibility、candidate Rights/Billing/DataBoundary、exact egress、proposal/disclosure/decision和非生成endpoint，避免先要Binding的producer环。两者都必须走`MetadataProbeCursor → PhysicalLease → SendIntent → Terminal → Result`及连续ledger range，崩溃不确定态不自动重试；布尔`requiresSentAndTerminalLedgerFold`不能代替真实链。后台health的生成请求数、secret read数和付费ledger sent数始终为零。

#### 4.16.5 构建信任、证据锁与 GA 清单

- 第三方 connector 的 build/test job 是 hermetic、无网络、无 secret、无 OIDC/signing identity 的不受信域，只输出 immutable artifact digest、SBOM、raw TCK evidence 和 test payload。独立 verifier/signing job 只读该 digest，在最小权限环境黑盒运行最终 artifact，重新验证 raw evidence 与政策，才取得短期 OIDC 并签 detached attestation。构建脚本、fixture 或 connector code 永远接触不到签名身份；两个 job 的 runner、permission、environment 和 artifact handoff进入 SLSA provenance。
- `evidence-lock.json` 不只保存网页 digest。每条事实引用 content-addressed raw evidence artifact、raw digest、许可/访问级别、抓取时间、region/locale/account context、fetcher version、canonicalizer version、normalized projection digest、projection schema和 expiry。受版权或账号限制的原文进权限隔离 evidence store，公开仓只保存允许的摘要与可验证 digest；授权审查者仍可按同版本工具重放投影。URL 内容漂移、canonicalizer 升级、region/locale 不等或 raw artifact 缺失都不能生成新 policy receipt。
- release携带签名且digest固定的`ReferenceGradeProfileV3`、81行`REFERENCE_REQUIREMENTS_V3`和同digest的`ReferenceRequirementsDerivationReceiptV3`。deriver必须从literal tuple重算总数、排序键、entry/journey投影、复合subject唯一性、recipe字段分类/来源/持久化及恢复态，重复键、空recipe、错误field source或digest不等都直接失败；TypeScript静态断言同时钉住OpenAI Chat/Responses、Ollama Chat/Responses、TokenHub两realm各三协议及准确auth、腾讯企业Token Plan两realm各Chat/Messages及准确plan path/edition/funding、LiteLLM三协议、BytePlus、Azure Chat/Responses各四种auth、Bedrock四auth及SSO recipe、Kimi Code双协议、LM Studio三协议、OpenCode Zen/Go各三协议、Server HTTP/ACP两surface与普通`cli_stdio`，不能把缺行编译成`never`后继续发布。每一行同时冻结entry、产品、realm、platform、surface/protocol、auth、funding、journey tier、完整onboarding recipe、必测runtime states、tier和maturity；同一entry的Kimi双协议、TokenHub/OpenCode/LiteLLM/LM Studio/oMLX多协议、企业Token Plan双协议与HTTP/ACP必须逐行独立pass，不能用entry级布尔值或品牌级通用报告代替。`GaEcosystemMatrixCoreV3`与`GaMandatoryBaselineV3`只能机械投影这份digest固定的rows并追加owner namespaced rows，不能另建minimum；旧V1/V2明确只是迁移输入且`gaEligible=false`。删除、合并、替换或弱化任何固定row都会更名designation并撤销reference-grade/GA badge。
- matrix/journey/baseline稳定core不含owner decision ref；先对无证明core取digest，再经过`AuthorizationProposal → AuthorizationDisclosure → AcceptedUserDecision → UserDecisionConsumptionCommit → GaOwnerDecisionAttestationReceipt`批准。`requiredForGa:true`本身是判别分支，只允许ReferenceGrade profile冻结的`builtin_stable | builtin_beta | community_verified`与`L0 | L1 | L2`；非required分支在类型上排除L0，baseline又把全部matrix L0、fixed minima和owner additions做只增不减的sorted union。旧Hunyuan普通API只以`existing_connection_migration_only` requirement保留在fixed minima并禁止fresh journey；TokenHub两站、腾讯企业Token Plan两站、Qianfan API V2以及中国/国际MiniMax、Ark、SiliconFlow等具名fresh主路径进入fixed minima，不能靠降低category minimum或从matrix遗漏来绕过。required journey逐row只有`supply connected_verified+conversation_ready`、`supply migration_disposition_committed`、`execution connected_verified+execution_ready`或`control_plane control_ready`四类正向定义；单个requirement永远不能自报`review_ready`。全局`review_ready`只能由私有producer对同一`SupplySolutionReceipt.slots`四个tuple成员逐槽生成qualification：每槽必须绑定自己的当前Activation pointer、`chat`成功terminal、同一发行物的conversation-ready journey gate；evaluator槽还必须使用solution内同一份cross-slot独立性证明，最后再由准确的四元素qualification tuple提交全局收据。任一槽位、binding identity、pointer、runtime terminal、journey gate、distribution或independence proof换挂都不能生成`review_ready`。`blocked`、`action_required`与`advanced_configuration`只存在于独立负向fixture，永远没有pass payload。每条journey物化platform×`zh-CN/en-US/ar-SA`及独立`en-XA`run集合，并对`not_enrolled`与`ready`两种anchor起点分别运行；fresh enrollment的SayDo动作、外部任务、手填、provider step、copy/paste、leave-return、错误、恢复和raw/app elapsed全部与主journey事件做有序无重并集和逐分量求和。reference UX上限是profile冻结的精确数字tuple，journey class/tier、definition、run payload和gate按判别联合强绑定，任何自报更宽上限都被忽略。release还必须运行固定mutation gate，逐项证明blocked/action-required/advanced/wider-UX/错limit class/漏任一起点/漏前置事件/L0降级/rights替换、失败终态伪pass、单row伪`review_ready`均不能通过。通用`ConformanceResultCore.reportKind`不再允许`journey`，只有typed run report→run gate→journey aggregate gate→entry gate→ecosystem gate链可进入GA。所有payload/attestation/binding指向同一被测distribution；固定81条claim与requirements逐key双射，owner claim又与canonical append-only owner rows逐key双射并通过同等级qualification，两者合成`PublishedSupportClaimSetReceiptV6`。支持页、picker、测试矩阵和release note必须携带同一support claim set digest与完整生成收据，作为release binding的精确四件套；任何手写能力、漏owner row或四件套之间的claim差异都不能发布。
- Phase 0 增加独立 `preflight`，在任何 canonical edit 前验证 active pointer为空、目标文件无他人 dirty ownership、PLAN-2 有具名批次与依赖、基线 SHA 完整、十项 owner decision record 已签名且 schema 通过。Phase 0 收口再次运行同一 preflight 并比对 batch/decision digest；开工后 pointer 或 decision 漂移立即停止。普通 phase gate不能把这项前置治理检查藏在最后一步。
- strict parser/TCK 额外拒绝 duplicate JSON keys、非法 UTF-8、lone surrogate、NaN/Infinity、超安全整数、非 canonical number、ambiguous exponent、Unicode confusable ID、encoded separator 和 chunk 边界差异；成功解析的 canonical digest 在所有 chunking、CLI/library 与三平台上完全一致。

#### 4.16.6 UX 的机械真值

- readiness 至少分 `connected_verified` 与 `conversation_ready`：前者表示单连接已验证，后者表示当前推荐解已有可启动对话供给。不得把 staged conformance 成功直接写成整套方案可用，也不得在尚缺预算时显示“用这套开始”。
- 每个需要用户介入的界面状态恰有一个machine-readable `primaryAction`；标为自动推进的短暂状态必须为0个。帮助、官方范围、复制命令或高级设置只能是`secondaryLink[]`。状态→动作由纯函数决定，DOM/a11y test必须证明用户介入态不是0或2个主按钮、自动态没有主按钮；中文“或”、并列按钮文案不能绕过合同。
- 已有receipt且不产生新按量费用的主路径最多1个SayDo动作；`local_service_ready`候选自动验证为0动作。未安装、未运行、无模型、冷态、端口冲突或API关闭先进入独立`action_required`恢复scenario；按准确初态从install/start/load或enable/repair/load中的正确一步开始，最多3个主动作，恢复终态后仍必须完整经过live conformance、能力投影、activation commit与active-pointer commit，恢复前绝不能产出zero-config pass。guided key的`signed_in_ready`从详情到`conversation_ready`最多2个动作，缺billing最多3个，`no_account/account_exists_signed_out`且还缺billing最多4个；创建厂商凭据是独立外部任务，不能藏进“填key”。OAuth从所有已有账户起点都必须先完成本应用的授权或key exchange，再以当前principal的权威entitlement observation选择直接验证或billing分支。enterprise/custom只使用各自签名tier。费用授权以独立披露和总预算合同计量，不靠少算点击合并。journey report同时记录逐step触发方式、SayDo action、外部账号/登录/MFA/凭据创建/copy-paste/离开返回和恢复时间，不能只数应用内点击。
- 事前`AuthorizationDisclosureReceipt`完全从尚未包含用户决定的`AuthorizationProposalReceipt`与InvocationEnvelope渲染；`UserDecisionReceipt`再签proposal+render+local control session，最终authorization/consent逐引用相等。它按用途绑定conformance完整双轮tuple、runtime/fallback logical call、Execution session/turn和tool invocation，并显示全部允许序列、physical cap、token上限、processor/credential recipient与逐biller/account/unit最坏金额。真正发送时先创建无发送权`ConformanceAttemptIntentLeaseReceipt`或`RuntimeAttemptIntentLeaseReceipt`；credential、connected peer、本地/LAN compute、TLS/proxy解析attestation都绑定该intent，再组成可遍历`PreparedAttemptDescriptorReceipt`，最后才签发final physical lease和send intent。final admission/funding decision、descriptor、physical lease必须和proposal/disclosure/decision逐引用相等。事后`ActualAttemptReportReceipt`对priced与custom/official unknown统一引用严格`ConformanceAdmissionDecisionReceipt`，因此unknown首测也能形成事前/事后闭包且不宣称settled。ledger range绑定subject、writer epoch、连续sequence、Merkle root、as-of high-watermark、accounting state和report revision；迟到usage只能经subject-scoped report cursor产生single-successor correction/superseding report。sent entry与全部physical lease一一对应，实际序列必须是披露序列的合法前缀或成员且不超上限。
- staged与live不得各弹一次含糊同意，也不得让live偷用staged额度。一次conformance proposal、disclosure和accepted decision都携带同一严格`ConformanceAuthorizedRoundTuple=[staged,live]`；每轮事前固定attempt subject/target projection、canonical IR、fixture/no-user-content证明、envelope/sequence、adaptation、prepared/wire request、hosted-tool occurrence、credential/processor集合、请求/token/逐单位额度。staged success后必须经过writer-fenced`ConformanceRestartCursor`：`staged_passed → restart_in_flight`之后，直接成功进入`restart_commit_pending → live_ready`；失败则按`before_restart_intent | old_process_termination_requested | old_terminated_before_candidate_spawn | candidate_spawned_before_load | load_or_listener_readiness_unknown`记录准确stage。restart lease不授予signal/spawn/load/listener/credential/network authority，intent前失败使用逐项`PreIntentLeaseClosureReceipt`；已知stage只有在旧/新process、listener、credential、network和authority inventory全部形成`StageCleanup + SafeRetryBaseline`后进入`restart_retry_ready`。candidate或listener状态不确定时必须进入独立`restart_reconciliation_required → reconciliation_in_flight`查询链，只能由`candidate_recovered`进入commit pending、`authoritatively_safe_to_retry`进入retry ready，或`still_unknown`留在reconciliation；不允许直接重启、伪造none/both success evidence或丢弃旧process状态。restart commit只接受直接或reconciled的准确loaded success，并证明候选snapshot、distribution artifact、config generation、进程和listener generation一致；live intent、physical lease、result与completion全部强引用同一barrier。每个`ConformanceResultReceipt`强引用同一lease的typed success terminal和authoritative ledger range；两轮结果与restart barrier最终进入`ConformanceJourneyCompletionReceipt`，Capability、Binding、RouteSet和Activation只接受该completion。
- GA 用户 locale 固定 `zh-CN`、`en-US` 与 `ar-SA`，`en-XA`只作为独立 pseudo locale，禁止用于满足真实 locale 数量。所有 onboarding/status/error/action 使用 typed ICU message schema，CI 检查 key、变量名/类型、plural/select 分支与 billing unit formatting 完全对等；`ar-SA`必须通过 RTL layout、mirroring、双向文本、键盘顺序、输入光标、费用/日期格式和 screen-reader TCK，`en-XA`、最长 provider/model/error 字符串、200% 字号与窄屏继续进入门禁。

#### 4.16.7 受信导出、构建闭包与旧合同退役

- `@saydo/contracts/public`只导出本方案末尾`AI_SUPPLY_PUBLIC_PRODUCER_IDS_V19`列出的55个实际symbol及其53类根receipt。所有更早版本的ambient声明、V9 BOM和`commitReleaseEcosystemBindingV9`只保留为迁移fixture与schema/compiler输入，公开导出数固定为0；实现不能因为名称相似、版本更高或存在同形接口自行选择另一条producer。每个公开producer取得唯一`ai_supply_v19:<symbol>` canonical producer ID，返回同一种JCS验证、deep-frozen、committed品牌，consumer只接受该准确输出。
- Phase 0公共合同编译器从package export map和TypeScript resolved declaration/call-signature symbol graph生成实际导出清单，拒绝legacy、裸`ReceiptRef`、可写字段、非canonical JSON、未冻结返回值和未注册producer；它不以`Receipt`后缀、字段名或文档字符串猜类型。edge compiler再从相同schema symbol graph遍历全部53个根kind，生成owner property JSON Pointer、准确target kind/subject、cardinality、ordering与single-successor authority；commit、deserialize、DAG verifier与release gate消费同一manifest digest。编译器自身作为build-time meta root参与自举：先验证待导出图，再由固定bootstrap commit primitive提交编译receipt，下一次clean build必须重现相同清单与digest。
- authority registry的唯一真相从program AST、判别分支和准确source symbol生成；当前v19合同固定76个expected source、61个branch-free policy、28个branch constituent、合计89个lifecycle constituent。provider测试账号的五类cleanup与Codex command auth进程租约都在同一inventory、pre-intent、in-flight、terminal、restart和release barrier闭包内；任一未登记持权声明、额外source、重复分支或未关闭authority都使构建或发布非零。
- inference、Execution turn、read-only tool与side-effect tool共用准确物理尝试subject。before-send只能产生`failed_before_send`，send intent之后才能产生success、known failure或`delivery_unknown`；terminal、funding、effect、raw response和下一cursor均绑定同一subject。fallback必须按`subject → initial cursor → start receipt → exact physical terminal → advance → final terminal`单向推进；非空候选、当前ordinal与previous terminal逐步锁定，`delivery_unknown`永远没有自动retry/fallback edge，zero-attempt与physical-attempt terminal不能并存。
- Rights、Network、Billing和DataBoundary先从同一品牌化ComputePolicy subject分别生成，再由唯一binding producer逐项同值合并；pre-credential UX可以表达`forbidden/unknown/allowed`，公开support claim只在rights、journey与live证据之后生成，绝不反向作为这些前置条件。inference plugin从授权subject、proposal、disclosure、accepted decision、single-use consumption、policy、activation到runtime closure逐边闭合；Execution第三方条件使用分布式判别，不能因联合类型省掉authority。
- owner扩展只提交canonical namespace与非空签名raw source tuple；共享semantic compiler生成requirement、oracle、journey、funding、runtime state和qualification四类子receipt，outer qualification只接受该准确component set。fresh与`existing_connection_migration_only`均有合法原始判别、正向journey gate和absence gate；发布必须同时消费migration positive与absence exact set，不能把无既有连接伪成失败，也不能把迁移行强塞进conversation-ready路径。
- 每个公开claim、四件支持产物、平台闭包、a11y闭包、TUF trust root、性能基线和最外层release都锚定一个非联合`DistributionArtifactIdentityReceipt<D>`；其余输入使用`NoInfer<D>`并做canonical digest相等比较。三种真实locale为`zh-CN/en-US/ar-SA`，`en-XA`独立；正式a11y闭包逐键覆盖3平台×4 locale×3 presentation×3 viewport×3 zoom×3 modality×各平台screen reader的972个cell，不能由调用者缩小expected matrix。
- Codex custom provider的`auth.command`只在静态读取配置时形成candidate，passive discovery执行命令数固定为0。candidate逐字绑定所选definition、绝对executable、argv、空私有工作目录、environment allowlist、timeout、stdout cap和refresh判别；首次执行先向用户展示目的、网络、secret、刷新与输出限制，再消费单次决定并取得准确进程租约。spawn前必须提交pre-intent closure或durable send intent；只有`succeeded_and_imported`可把stdout直接导入broker，失败不持久化，delivery unknown隔离secret并进入人工调和，跨candidate、distribution、lease、intent、terminal或refresh cursor换挂均失败。
- release BOM由固定32个suite ID递归展开为`preflight_open + 32 suite + preflight_close`共34个有序row，每行固化argv与唯一predecessor。success orchestrator要求34个准确passed terminal；首次失败后只能生成一个failed和全部后继not-run，失败terminal的`releasePromotionEligible`固定为false。最外层v19 release producer必须消费公共合同编译、完整edge manifest、双migration gate、972-cell a11y闭包、性能门、三平台与witness闭包、support/evidence/claim同一发行物以及唯一successful orchestrator；旧V9 producer、结构性自填trust root或失败run都没有晋升路径。

#### 4.16.8 单一公共真相

v19终审证明“在旧public graph上继续局部收窄”会同时放大类型展开、发布换挂与双入口风险。v20因此采用一次明确的代际切换：v19及更早producer全部移出`@saydo/contracts/public`，只作为迁移decoder、负向fixture和历史读入类型；运行时、插件SDK、发布器与文档生成器只允许消费本节列出的v20 producer。任何旧producer名称即使仍能在内部编译，也不能进入package export map、receipt edge manifest、BOM或release binding。

以下第一组合同固定精确TUF target、单一distribution、非联合ComputePolicy主体和开放protocol literal。摘要字段只作索引；发布决定必须沿强类型receipt pointer重放canonical target bytes、root-to-target lineage、可信时间、高水位与同主体等值证明。

> **合同草案**：见 [`ai-supply-contracts-draft/09-public-truth.ts`](ai-supply-contracts-draft/09-public-truth.ts)（3,413 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


第二组合同统一物理尝试、authority release、fallback历史与Codex command auth刷新。每次retry都生成新的lease；`delivery_unknown`没有advance producer；`refresh_interval_ms=0`严格解释为authentication retry之后刷新，不伪造token expiry。


第三组合同把性能基线、三种真实locale、972-cell可访问性矩阵与owner migration-only资格收进同一发行物。性能基线只有受信genesis和经前任passing gate、owner批准、单胜cursor CAS的replacement两条互斥入口；当前测量同时保存手写与生成源的真实bytes/lines，不能再只检查总量。required matrix把确定性生成的972个cell receipt放入带digest的内容handle；每个a11y pass cell只能由逐键producer经受信resolver取回准确required cell后生成私有品牌，普通对象展开无法洗入闭包。随后`commitGaAccessibilityPassedCellSetV20`解析全部pointer并验证key集合、matrix back-pointer与distribution，release只消费紧凑set pointer；这样保持逐格闭包，同时避免一个TypeScript编译单元重复展开972棵深层receipt树。owner行则按compiler导出的onboarding availability分流，migration-only必须同时通过准确正向迁移和“无既有连接”absence gate，不能进入fresh onboarding。


第四组合同是唯一发布路径。固定81行与owner追加行先各自形成准确claim tuple，再组成一个不可漏项的集合；持续release gate与signed BOM只保留一份37-suite清单，递归展开为39行，argv始终是`shell:false`的参数数组。每个step terminal同时绑定准确BOM、row和distribution，不能用D1的成功终态晋升D2。公共npm入口只暴露wire/RPC facade与离线验证器；细粒度producer留在daemon内部受信模块，不能被插件或调用方直接构造。公共合同编译、edge manifest、真实正反fixture、BOM和最终release都消费同一合同artifact与distribution。


最终release把旧版内部细粒度证据只作为待复验输入，经过v20 distribution-bound closure后才可使用；这不是重新导出旧producer。所有release-critical字段保留准确receipt边，不能只留下digest。下载者从TUF预置root开始，离线验证发行物、合同、edge manifest、claims、支持四件套、a11y、性能、BOM、SBOM、provenance、签名和remote witness release-time比较后，才形成可安装结论。


## 5. 协议与认证实现

### 5.1 三核心协议

第一批必须原生实现三套协议，不能继续用一个“OpenAI compatible”布尔值代替：

#### OpenAI Chat Completions

- 路径：operation resource 是 `chat/completions`；最终是否出现 `/v1` 由 §4.16.2 的 `ApiBaseProfile.baseSemantics` 与明确 relative path 决定，normalizer 不猜、不删、不补版本段。
- 解析：非流式与 SSE、text、reasoning_content、tool_calls、usage、model、provider route。
- 结构化输出：区分 `json_object` 与 `json_schema`，不假定所有兼容端点支持 strict。
- 兼容差异通过 adapter quirk 数据表达，例如 stop 语义、reasoning 字段、usage 尾包，而不是 `if baseURL.includes(...)`。

#### OpenAI Responses

- 路径：operation resource 是 `responses`；`/v1` 与反向代理前缀完全由 `ApiBaseProfile` 解析，最终 URL 进入 endpoint identity。
- 解析 `input`/`output` item、function call、function result、reasoning、usage 与流式 event。
- 默认使用无服务端状态模式；只有 provider conformance 明确支持且用户允许时才使用 `previous_response_id` 或 conversation state。
- 适配器不能把 Responses 强行转换成 Chat 后丢失 item 类型、reasoning 或工具事件。

#### Anthropic Messages

- 路径：operation resource 是 `messages`；官方 preset 使用 api-root + `v1/messages`，兼容 preset 可登记其他明确 relative path，但不能由 host 猜测或字符串替换。
- 原生发送 `x-api-key` 或短期 Bearer，并带必需 `anthropic-version`；兼容 provider 可在 registry 中覆盖版本/header 名。
- 解析 content blocks、thinking、tool_use、tool_result、stop_reason、usage 与流式 event。
- 不把 Anthropic 官方 OpenAI SDK compatibility 当生产主路径。Anthropic 官方说明该兼容层主要用于测试和比较，完整能力应走原生 API。

三适配器统一输出 §4.11 的 `InferenceEvent`，保留可移植语义、`rawProtocol`、`requestId`、`observedModel` 与显式 `AdaptationPlan`；任何协议专属字段只能进入有上限、版本化、不含 secret 的 opaque extension，不能靠丢字段完成“归一”。

### 5.2 L1 原生协议与云认证

| 接入 | 协议/认证 | 原因 | 优先级 |
|---|---|---|---|
| Gemini API | Google GenAI + `x-goog-api-key`；project/key限制与轮换进入credential lifecycle | 避免把原生能力压成 OpenAI 子集 | L0 |
| Vertex AI | Google GenAI/兼容端点 + ADC | 企业用户已有 GCP 身份，无需复制 key | L1 |
| Azure OpenAI / Microsoft Foundry | Chat/Responses；`api-key`或Entra Bearer分别建auth profile | 企业主流，endpoint/deployment 与 OpenAI 官方不同 | API key L0；Entra/workload identity L1 |
| Amazon Bedrock | Converse/Stream、当前官方兼容的 Chat/Responses/Messages route + 明确 credential source 或 Bedrock API key | IAM、region、model/profile 和多协议语义不能塞进 Base URL | L1 |
| Cloudflare Workers AI | 官方 REST/兼容端点 + scoped token | 边缘部署与网关用户常见 | L2 |
| Cohere | 原生 Chat API | 其工具和 citation 语义不是 OpenAI Chat 的完整同构 | L2 |

### 5.3 Custom Endpoint 的协议判断

自定义端点提供“自动判断”，但必须诚实区分无成本识别与真实调用：

1. 先根据 URL、well-known provider preset、已安装 bridge metadata 判断候选协议。
2. 使用 release-bundled passive probe capability 做无推理请求探测，例如允许的 models、provider health、OpenAPI/Server identity；在线 catalog 不能创造或改变请求 path。401/403 只有同时带可信产品 signature 才能帮助识别，单独状态码不能证明服务类型。
3. 禁止仅凭 `/v1/models` 成功断言 Chat、Responses、Messages 的工具与流式能力。
4. 若仍有多个候选，界面先展示单次自检授权的有序尝试集合、逐项请求/token/分单位金额上限和逐计费单位的聚合最坏费用。用户确认后只能按授权中的 `(routeId, endpointDigest, model, protocol, requestProfileDigest)` 顺序逐一尝试，每项发送前原子消费子额度，成功即停；同一轮默认总生成请求不超过 2、响应总量不超过 32 KiB、总墙钟不超过 30 秒，任何集合外协议或更高预算都需二次确认。
5. 404/405 只说明该路径不可用；401/403 先指导认证；429 保留候选并显示额度问题；5xx 不自动切协议以免重复计费。
6. 自检结果形成 endpoint identity+transport path/credential component set+request profile+secret principal/version+model+protocol implementation/TCK receipt；改变 URL、Base URL semantics、受限公开 query、proxy/TLS/mTLS/application auth、principal、model、adapter version 任一项都使 receipt 失效。

## 6. 自动发现设计

### 6.1 Discovery Engine 总则

- 全部 detector 输出同一 `DiscoveryCandidate`，不得直接写 active config。
- 自动阶段分两轮：`static_filesystem` 枚举路径但不执行二进制，只读已登记公开 metadata/文件属性/签名，零 packet且不打开第三方 token、session、history 或 prompt；`passive_loopback_metadata` 只让宿主执行 release-bundled immutable probe capability，在线 detector/catalog 只能引用 capability ID，不能下发 destination/method/path/header/body。detector 本身没有 socket，结果中不含 secret/user content。运行 `--version/status/list`、容器枚举、生成请求、模型加载和服务管理都可能有副作用，只能进入用户同意后的 `explicit_active` 或独立 preload action。
- 执行 CLI 前先验证 owner、mode、publisher/package/digest；未知或 PATH shadow 二进制只 inventory。受限子进程关闭 stdin，使用空 cwd、隔离 HOME/env、禁用非目标网络、严格 timeout/maxBuffer 和进程树回收。
- 本地探测有总预算、单项 timeout、取消和 cache；一个 CLI 卡住不能拖死整个 onboarding。
- 第一屏优先使用最近成功 receipt；后台确认完成后无跳动地更新状态。
- 默认只扫描 PATH、官方已知配置位置和 loopback。LAN/mDNS 扫描默认关闭，用户在“查找局域网服务”中显式开启。
- Docker/Podman 自动阶段只静态识别安装痕迹和已知 socket 文件；不连 socket、不执行 CLI。用户点一次“检查本机容器服务”后，才在通过 syscall TCK 的 discovery sandbox 中以只读固定 schema 枚举 running/stopped 容器与已发布 loopback port；不自动 start/restart/pull/create 或加载模型。停止的服务只显示官方启动处方。
- 不读取浏览器 cookie，不复制第三方 OAuth refresh token，不解密 CC Switch/OpenCode 的 credential store，不把第三方 key 写进日志。
- `DiscoveryBudgetReceipt` 分别记录 static 的路径/文件集合，以及 passive-loopback 的完整 probe plan、实际 socket destination、method/path、请求/字节/墙钟；两种 mode 各自和组合总量都受 §4.13 的 `ResourceBudgetProfile` 数字上限。detector 不得通过分批、重启或递归候选规避预算，host 拒绝 DNS、LAN/Internet、query/body/auth/redirect 和未登记 path。
- sentinel 测试必须证明：恶意 PATH 程序在自动阶段未执行，第三方 session/token 文件从未被打开，未知 `:8000/:8080` 服务不会因端口或 401/403 被误认。

### 6.2 CLI 与官方 agent surface

探测分四级，不能把 `which` 成功直接当可用：

1. `installed`：解析真实二进制路径、版本、digest、平台与来源。
2. `authenticated`：只调用官方 status/list 命令；没有只读 status 时标 `unknown`，不自动发 prompt。
3. `entitled`：结合官方文档、edition、登录 provenance 与用途得出 rights；取不到即 `unknown`。
4. `conformant`：用户确认后跑有界无工具测试，记录 model、事件、费用 provenance、超时与工具泄漏。

当前 catalog 的改造方向：

| 来源 | 目标 surface | 自动动作 | 需要用户动作 |
|---|---|---|---|
| Codex | Execution Agent候选：App Server stdio；ChatGPT交互登录、Platform API key、Enterprise automation access token三条auth/rights/billing路径严格分离；现有CLI one-shot inference进入legacy迁移 | 静态检测版本与公开schema；不读取token。用户授权后只用`codex login status`确认auth method。Codex custom provider当前`wire_api`只允许Responses，不能把Chat或Messages端点冒充可直连 | owner先裁决其在Tier 1/Hopper/独立执行面的归属；API key按Platform计费，Enterprise access token只在管理员授权的可信自动化范围启用，普通ChatGPT登录不外推为通用API权限 |
| Gemini CLI 企业/API 路径 | 官方 enterprise/Cloud/API-key surface | 与个人账号分开检测版本与 auth provenance | 用户选择明确账号和授权来源 |
| Antigravity CLI 个人订阅 | 独立 Execution Agent 候选，不是 Gemini CLI alias | 检测 publisher/version，默认 inventory | 只有官方 programmatic surface、rights 与 gate conformance 都通过后才能启用 |
| Kimi Code 会员 API | Inference Supply：官方第三方 OpenAI/Anthropic endpoint、按当前会员档位可用的动态模型目录 | 识别 preset 与 key 是否存在，不读取 key；模型资格以当前官方目录/权益验证为准 | 填一次会员 API key并确认模型资格、共享额度与 Extra Usage 状态 |
| Kimi Code Server/ACP | Execution Agent 候选 | 检测 surface 元数据 | 通过逐工具 gate 后启用；不再试图靠一次 no-tool 测试塞进 inference |
| OpenCode Zen | Inference Supply：官方按量 AI gateway | 识别官方 preset 与 SayDo 自己的 key 是否存在，不读取 OpenCode auth store | 填一次 Zen key；按模型声明 Chat/Responses/Messages profile 与按量费用 |
| OpenCode Go | Inference Supply：官方订阅 API | 识别官方 preset 与 SayDo 自己的 Go key 是否存在，不读取 OpenCode auth store | 填一次 Go key；确认订阅限额、模型级数据条款以及是否允许用 Zen 余额补足 |
| OpenCode Server/ACP | Execution Agent：本机 HTTP/OpenAPI/ACP surface | 检测 4096 loopback、OpenAPI、ACP 与强 peer identity 能力 | 若未运行给出启动处方；只有逐工具 Gate、费用与 peer identity 都通过才启用 |
| Claude Code | API 默认；订阅 surface 按 rights gate | 检测但分发版不自动启用订阅 | 填 API key，或在获批 edition 下启用官方 surface |
| Cursor、Grok、Qwen、Copilot、Vibe | 保留版本化 CLI adapter | 只做安装/auth 画像 | 每版本 conformance 与 rights 未通过前不推荐 |
| Aider、Pi、其他 CLI | inventory 或 plugin connector | 检测安装和官方配置能力 | 安装受信 adapter 后才能启用 |

自 2026-06-18 起，Gemini CLI 不再服务 Google AI Pro/Ultra 与免费个人账号，个人终端路径迁到 Antigravity CLI；企业 Code Assist、Google Cloud 与 API key 路径保留。两者必须是不同 connector definition、adapter、rights receipt 与提示，不得共享裸二进制别名或假定相同 JSONL schema。

Execution Agent 的启用门不只是 Gate 0：receipt 必须分别证明 dispatch 前 Gate 0 和每一种副作用执行前的 `GateWireRequest`。未知工具、gate 不可达、协议未知都 deny 并 kill 整个进程组；S3 语音永不放行。无法在工具执行前机械拦截的 App Server/ACP/HTTP agent 只能 inventory。

OpenCode 不能再用一个品牌项混合三种产品：Zen 是按量 inference API，Go 是有订阅限额且可选用 Zen 余额补足的 inference API，Server/ACP 是会产生工具副作用的 Execution Agent。三者使用不同 connection/product/rights/billing/data receipts 和 secret namespace；Zen/Go 的官方“可用于任意 agent”不等于 SayDo 可以读取 OpenCode 本机 `auth.json`，用户仍在 SayDo secret broker 中单独录入或走未来经审核的官方授权流程。Go 的数据保留与隐私按模型分别记录，不能给整个品牌一个全局承诺。

Codex同样不能用一个`authenticated=true`混装三种入口。ChatGPT交互登录只证明当前Codex产品会话；Platform API key按标准API计费且不消费ChatGPT套餐额度；Enterprise automation access token只证明管理员授予的可信非交互Codex范围，普通OpenAI API仍应使用Platform key。Codex自定义`model_providers.<id>.base_url`不能被当成万能Base URL：当前`wire_api`唯一合法值是`responses`，内置Ollama/LM Studio与`--oss`也只是Codex自身provider选择。SayDo若发现这些非秘密配置，只把它们作为待核验candidate；Chat、Responses、Messages仍分别走本方案的协议TCK、endpoint identity、rights和费用闭包。

Codex command-backed auth的静态解析结果必须先经`commitCodexCommandAuthDefinitionBindingV20`把candidate与准确definition、argv、working directory、受限environment、timeout、stdout schema和refresh判别绑定；后续credential不能重新从宽candidate类型推导refresh模式。`refresh_interval_ms=0`准确表示`on_authentication_retry`，只有当前请求得到typed authentication failure且允许一次认证重试时才能争夺single-winner refresh cursor；正整数才进入`fixed_interval`并由acquisition monotonic time加配置间隔产生deadline。refresh进程重新取得完整process/network/broker/credential/cursor authority，typed terminal关闭全部authority，成功导入后先提交旧secret retirement再激活新generation；失败、未知投递、candidate改变或hard stop都没有credential transition。类型反例拒绝不同refresh mode、definition或lease的retirement/transition换挂；同一静态类型下不同runtime实例仍由每个producer的canonical pointer、definition identity digest和byte-equality verifier逐项拒绝，不能仅依靠TypeScript结构相等。

每次 Execution session 必须先从 ActivationManifest 读取 peer/sandbox/funding/ACL template，在任何启动、连接或 session-create 字节前生成 `ExecutionSessionAdmissionReceipt`；随后才启动或连接真实 peer，生成 session-specific peer/process identity、`ExecutionRuntimeSandboxReceipt`、durable request cursor 和 `ExecutionSessionLeaseReceipt`。receipt kind 必须与 local-process-tree/upstream-attested-agent 分支相同，permission/data/完整可达出口、继承 handle、Gate、driver/Agent artifact、credential ACL、hard-stop 与最早 expiry 全部冻结。每 turn 先取得 dispatch admission，每个物理模型/API request 再取得 cursor successor lease；能逐物理 request 计量或硬性封顶的 surface 对全部 component 原子预留并做 deterministic coverage。无法取得 usage/route/hard cap 的订阅 surface 只允许绑定本 session 的 `externally_metered_unknown` consent，不进入 no-new-spend、自动推荐或 fallback。每个工具使用 host 稳定 logical ID 与 append-only CAS transition；Agent 崩溃后换 attempt/toolCallId 但无 replay lineage 时等待人工确认，不能把新 ID 当新动作自动执行。

当前 `codex_cli`、`claude_cli`、`cursor_cli`、`grok_cli`、`gemini_cli`、`qwen_cli`、`copilot_cli` 都不能因既有 wired 状态而祖传为新 inference connection：现有 canonical 已承认部分笼只能限写或事后检测、不能阻止读取。新配置一律迁为 Execution Agent 或 inventory；只有未来某个 CLI 在目标 OS 上证明 selective read deny、隔离 HOME、关闭非目标网络，才可建立独立 inference adapter。

legacy active 用户在 Phase 5 切换点执行明确迁移：先静态盘点安全替代路径并生成 staged 方案；替代方案未通过时不偷偷继续调用旧 CLI，而是 hard stop 并提示“该旧连接不再满足读取隔离”，允许恢复上一正式版快照或选择 API/local/Execution Agent。旧 binding 只读保留用于诊断和降级窗口，不再接收新 prompt。

任何未来通过证明的 inference CLI 都必须逐调用执行空 cwd、隔离 HOME/config、stdin 关闭、tripwire、未知事件拒绝、唯一重试和进程组回收；一次 conformance 不能替代每次调用的 cage。

“普通 CLI stdio”是长尾开箱路径，不是“执行任意 PATH 程序并猜 stdout”。自动阶段只把二进制 identity、publisher、版本和公开配置能力产成 candidate；若 release-bundled 或已签名 extension driver 声明了机器可读 wire、auth/rights 观察、取消、费用与逐工具 Gate，并通过当前二进制 digest 的 execution TCK，已安装且已登录的 CLI 才可直接进入一次确认后的验证与激活。实现 ACP/App Server 等公开协议的 CLI 优先复用相应 driver；只有专有机器协议的 CLI 才新增版本化 driver。未知二进制、仅人类终端文本、无法关闭隐藏工具/网络、无法在副作用前拦截或无法证明订阅分发 rights 时只显示“检测到一个可能的 AI CLI”，唯一主动作是选择受信连接器或改用官方 API，不自动运行、不要求用户手写解析规则，也不把 `generic.cli.stdio` 的 reference fixture 冒充为品牌支持。这样新增 CLI 通常只增加 detector/driver pack，不改 daemon 热路径或权限模型。

**ACP 覆盖面实证（2026-08-25 补）**：上一段「实现 ACP/App Server 等公开协议的 CLI 优先复用相应 driver」
在当前生态下的实际权重，比本方案早期版本预估的高得多。本机实测 11 个 agent CLI，
其中 **6 个可直接作为 ACP server 启动并正确应答 `initialize`**——goose 1.37.0、opencode 1.18.21、
kimi 0.38.0、gemini 0.55.1、copilot 1.0.61、qwen 0.18.0——返回结构同构的
`protocolVersion: 1` + `agentCapabilities` + `authMethods`，可由同一个客户端实现对接；
Grok 1.0.5 的 `--output-format streaming-json` 定义即「NDJSON of the agent native ACP session updates」。
Codex 0.147.0 是唯一走专有 `app-server` 协议的（且仍标 `[experimental]`、v1/v2 并存），
而 SayDo 现有的两个 Tier 1 后端 `claude_code` 与 `cursor` 是唯二完全不沾 ACP 的。

据此，ACP 在本方案中应被视为**一条独立的接入路径**，而不是逐个 agent 的可选特性：
一个 ACP driver 加一套 TCK 即可覆盖 §9.4 中 kimi、opencode、goose、copilot、qwen 等多个条目，
不必各自新增版本化 driver。`docs/07-tech-stack-decisions.md:133` 对 ACP 的现有立场是
「持续跟进不押注……**若成事实标准则适配层整体切 ACP**」——该条自带的触发条件已经满足，
但适配层是否在本轮引入属 §14 决策 2，未拍板前不由本文推断。

完整实证与边界见 [`../review/2026-08-25-agent-cli-acp-capability-survey.md`](../review/2026-08-25-agent-cli-acp-capability-survey.md)。
另注：该实证同时取得 Gemini 个人订阅路径下线的官方报错原文
（`IneligibleTierError ... please migrate to the Antigravity suite`），
与本节上文关于 Gemini CLI 与 Antigravity CLI 分家的记述一致。

### 6.3 本地模型服务

默认 loopback 快探清单由 registry 管理，首批内置：

| 服务 | 常见入口 | 无成本识别 | 目标协议 |
|---|---|---|---|
| Ollama | `127.0.0.1:11434` | `/api/tags`、`/v1/models` | OpenAI Chat、Responses；本地 artifact 与 `*-cloud`/cloud offload 分别建模 |
| LM Studio | `127.0.0.1:1234` | `/v1/models`、LM Studio health | OpenAI Chat、Responses、Anthropic Messages；本机 runtime 与 LM Link 远程设备分别建模 |
| oMLX | `127.0.0.1:8000` | `/health`、`/v1/models` | OpenAI Chat、Responses、Anthropic Messages |
| OpenCode Server | `127.0.0.1:4096` | OpenAPI、health | Execution Agent HTTP，不冒充推理 API |
| llama.cpp server | 常见 `127.0.0.1:8080` | `/health`、`/v1/models` | OpenAI compatible，能力按 build |
| vLLM / SGLang | 常见 `127.0.0.1:8000` | `/health`、`/v1/models` | OpenAI compatible，按版本/参数 |
| LocalAI / Open WebUI | 常见 `127.0.0.1:8080` | 服务 identity + `/v1/models` | gateway，不以端口猜品牌 |
| Jan | 桌面本地 API server 的已知配置与 signature | health/model list | OpenAI-compatible，按版本 receipt；列 L1 主流桌面路径 |
| Xinference、TGI、MLX-LM | registry 端口与 API signature | health/model list | 由实际协议 receipt 决定 |

同一端口可能属于多个服务，识别必须依据响应 signature，不按端口定品牌。自动探测只由 host 走 `passive_loopback_metadata`，不加载/下载模型、不发生成请求。signature 只产生 candidate；发送真实 prompt 前还要由 `LocalInferencePeerReceipt` 把已连接 socket 绑定 OS 观察的 process/binary/config，防止恶意进程抢占常见端口。**loopback 只是 transport 属性，不是 compute boundary**：一个本机 daemon 可继续转发到云或 LAN 设备。

本地模型常处于“已安装但当前未加载”的正常冷态。candidate 必须区分 `managed_runtime | unmanaged_runtime | upstream_atomic_local_only`。SayDo-managed 或上游有原子 no-download/local-only admission 的路径可显示一次“在本机安全加载并自检”，按 `local-preload-v1` 同时约束目标 daemon 的网络、artifact、内存、deadline 与进程 identity；只限制请求 helper 不算。既存 unmanaged daemon 无法追溯施加网络 deny 时，不自动 preload：提供“停止后由 SayDo 隔离启动”处方，或等待用户在原服务内手工加载；后者即使随后证明 local compute，runtime egress 仍为 unknown，UI 不显示“数据不出本机”。OOM、取消、服务重启、route 变云/LAN 或发生下载都停止。Ollama 空请求与 LM Studio 显式加载各用受信产品 profile，不伪造成通用生成请求。

本地候选进入推荐前检查：

- 当前 server 只监听 loopback，或用户已显式允许 LAN；
- 模型已存在且不是 embedding/reranker-only；“已存在”还必须区分本地 artifact、cloud alias 与远程设备映射；
- 对话槽需要的 tool/stream conformance 通过；
- 当前硬件可用性由 server 自己报告，SayDo 不擅自拉取几十 GB 模型；
- 无认证服务只允许 loopback，LAN 暴露时必须提示加 auth 或改回 loopback。
- 身份只使用 runtime build、server 明确返回的 model revision/weight digest/template revision；上游不提供时标 `identity_stability=unknown`，不使用受采样影响的响应 fingerprint 伪造“同一权重”证明。
- 只有 OS peer identity + 受信 runtime/artifact 元数据能证明本机 process/device、已加载本地 artifact 与 route→artifact 映射时才签 `ComputeBoundaryCoreReceipt.kind=local_device`；runtime 自报身份不能单独充当证明。Ollama cloud、云 offload 与 LM Link 分别按 `provider_cloud/lan_device` 生成 core。network-egress assurance 另行进入 DataBoundary：local compute + egress unknown 可以按用户数据策略成为受限 ordinary path，但不能进入本机隐私承诺或无提示推荐。
- Ollama Cloud、LM Link 或其他 upstream-managed loopback 若不能在首测 request admission 强制 route/account/device generation，则只能 inventory 并提示用户使用可固定的本地模式或显式 direct API；不能为了“一键”接受 preflight→首字节 TOCTOU。

### 6.4 CC Switch 与其他 bridge

CC Switch 不是模型provider。当前可依赖的公开集成面是桌面版loopback Anthropic Messages代理；其Tauri `invoke`与私有数据库不是稳定外部control API。主流桌面项目与SaladDay的`cc-switch-cli` fork也不是同一个产品：

1. `cc_switch_desktop` 与 `cc_switch_cli_fork` 分开检测 publisher、版本、digest 和机器接口。`proxy show` 只能用于明确支持该命令的 CLI fork，不能外推给桌面版。
2. 桌面版只验证签名产品、固定loopback peer、默认`127.0.0.1:15721`与`POST /v1/messages`的真实Messages conformance；不读Tauri私有数据库、`cc-switch.db`、`~/.codex/auth.json`或任何上游secret，也不调用未承诺的管理接口。
3. 当前公开代理没有SayDo可依赖的逐请求effective provider、资金来源、完整failover queue或调用前route pin。因此该row固定产生`route_opaque + failover_opaque + externally_metered_unknown`，不能生成`RouteSetReceipt`、no-new-spend证明或evaluator独立性证明。
4. 这条opaque bridge只允许用户主动发起的普通对话：先展示“真实上游、费用和数据地域由CC Switch当前配置决定，SayDo无法验证”，再对这一次物理调用取得unknown-metering授权。它不能进入自动推荐、后台健康生成、自动fallback、evaluator、工具执行或“尽量不新增费用”方案。
5. 代理binary、listener/process identity、版本或公开proxy config generation变化都使旧conformance失效并停止新请求；重新验证后仍然是opaque bridge，不能显示“保留旧路由”。
6. 若未来CC Switch发布稳定、版本化的外部control API，另增独立control requirement与TCK后才可读取route metadata或实施pin/failover政策；不能在原public-proxy row上静默升级能力。LiteLLM、One API/New API、Portkey、Vercel AI Gateway和企业自建网关则按各自公开接口独立判断是否能冻结route与费用，不能从CC Switch或“OpenAI-compatible”互相外推。

### 6.5 环境与云凭据

- 只检测环境变量“是否存在”，不把值回传前端或写日志。
- 静态 key 只有在 provider 精确匹配且用户确认后绑定 connector；未知 endpoint 不借用通用 key。
- 自动发现只读取静态 credential metadata，不执行 AWS `credential_process`、浏览器登录、CLI helper、ADC helper 或 metadata service。未知 helper 只能提示，不运行。
- 用户动作阶段必须选择精确 credential source、principal/account、role、project、tenant、subscription、region/location 和 deployment；不使用无界 default chain 猜身份。
- 合法访问云 metadata 的 IAM 流程进入独立 credential-provider egress capability，只允许官方 SDK 的固定 origin/method/path，运行在隔离 worker；这个例外永远不能由 custom URL 触达。
- 云凭据自检默认只调用身份/模型列表等无推理接口；任何可能计费的部署创建、模型启用或生成调用都不自动执行。
- receipt 绑定最终 principal、资源 scope、credential source digest 与 region。多个账号不猜；最近成功 receipt 只能预选，仍须显示实际身份。

### 6.6 平台与企业网络

- macOS、Linux、Windows、WSL/container 分别维护发现路径和安全能力矩阵；Unix socket 与 Windows named pipe、Keychain/libsecret/DPAPI 或 broker 的差异不能用一个布尔值掩盖。
- connector 只有在当前平台完成 live matrix 才标正式支持；未实测平台显示 beta/inventory。
- 企业 proxy、custom CA、mTLS、PrivateLink/VPC endpoint 有 provider-first 高级入口，展示最终 origin、代理和证书身份；不得继承 shell 的隐式代理变量。
- 多用户机器按 OS principal 隔离 connector、receipt、audit 和 secret。配置导入只复制非秘密元数据，导出默认剔除账号、完整路径和 endpoint query。

## 7. 推荐器与 fallback

### 7.1 两阶段求解

第一阶段只筛硬约束：

- rights 为 allowed 或当前用途允许的 official_surface_only；
- connector 健康且 conformance receipt 未过期；
- 槽所需 capability 全部满足；
- evaluator family/route/隔离规则满足；
- 用户的费用与数据位置偏好满足；
- network scope 和 S0–S3 安全政策满足。
- rights、billing、data-boundary receipt 都未过期，且当前 operation/principal/edition/region 精确命中。

第二阶段才打分：

```text
score = 现成可用 + 最近成功 + 无新增费用 + 低延迟 + 本地隐私
      + 槽位质量匹配 + 既有使用偏好 - 不稳定 - 自动超额 - 冷启动
```

具体权重进入配置并有 golden test，不能依赖数组顺序。推荐结果必须附带可解释原因，例如“对话用已验证本机计算的 Ollama 模型，因为已运行且首 token 更快；沉思用 OpenAI Responses API，因为该 inference route 已验证且长上下文能力匹配；代码执行与检查用 Codex App Server，因为当前订阅只授权该 Execution surface；评估用 Anthropic API，因为与主模型不同族”。

### 7.2 用户意图模式

| 模式 | 硬偏好 | 允许的退化 |
|---|---|---|
| 平衡，默认 | 可用、低操作成本、对话低延迟 | 缺强 evaluator 时提示而非静默同族 |
| 尽量不新增费用 | local/subscription，排除 payg 和未知自动超额 | 可接受更慢 CLI；没有可用项则停下 |
| 本地优先 | `ComputeBoundary=local_device` 优先，loopback 本身不加分；云仅作用户批准 fallback | 本地能力不足时明确列出缺口 |
| 质量优先 | thinking/evaluator 质量与独立性最高 | 明确显示可能费用，不自动启用 |
| 低延迟 | dialog 首 token 与 stream 最优 | thinking 仍可用慢来源，不牺牲 evaluator 硬约束 |

### 7.3 Fallback 纪律

- 同 connector 的短暂 5xx/timeout 可按幂等策略重试；429 遵守 retry-after，不做多 provider 风暴。
- 同权益、同资金来源、同数据边界且 route-pinned 的已验证路径，才可按用户策略自动 fallback；每次使用 observed model/effective route 重算四槽并写审计 provenance。
- family、资金来源、overage、账号、region、数据地域或 bridge 上游任一变化，都需要新的 FundingPolicyTemplate、匹配的 FundingDecision 与新 receipt；不能用一次登录或旧确认替代。
- evaluator 不因主供给失败而回落到同family；独立性证据失效时，唯一降级是`review_ready → conversation_ready`，界面明确显示“可对话，独立深评暂不可用”，类型、状态机、UI 与支持材料都不得再造第二个同义状态。
- active connector 失败不会修改配置；recovery 只影响当前调用。持久切换走 staged/live 自检。
- gateway/bridge 无法提供逐请求上游身份时，不参加 evaluator、no-new-spend 或自动 fallback。

## 8. 交互与文案合同

### 8.1 首屏信息层级

首屏只保留四块：

1. 探测状态：“已检查本机 CLI、本地服务和已配置 API”。
2. 主推荐卡：“已为你配好”。
3. 一个主按钮：“用这套开始”。
4. “换一种方式”和“高级配置”两个次入口。

四个内部槽位默认不出现。用户展开“这套方案怎么工作”时，先显示“快速对话、深入思考、轻量任务、独立复核”四个用途，再显示具体 connector/model。

### 8.2 状态词与提示模板

`switch_to_official_api` 不是无目标的字符串动作。每个 blocked 状态必须先解析下面的 typed destination journey；没有同产品官方 API、准确地域和可执行 auth 路径时，主动作改为 `choose_another_source`，不能把用户送进空白配置页：

> **合同草案**：见 [`ai-supply-contracts-draft/10-ui-state-copy.ts`](ai-supply-contracts-draft/10-ui-state-copy.ts)（2,778 行）。
> 该草案在 strict/NodeNext 下 tsc 零诊断；**尚未下沉 `packages/contracts`，不是生产合同**。


状态、动作、ICU 文案、journey event、DOM 语义和无障碍快照只有下面一份 typed registry 真相；表格是其生成投影，不能手改：


| 内部状态 | `transitionMode` | 用户文案 | `primaryAction` | 可选控制或次入口 |
|---|---|---|---|---|
| `detecting` | `automatic` | “正在确认本机已有的 AI 服务” | 无 | “先看已有结果”是 secondary；检测继续运行 |
| `candidate_safe_auto` | `automatic` | “检测到可安全自动验证的本机服务” | 无 | “连接详情” |
| `candidate_requires_review` | `user_required` | “检测到一项需要你确认的服务” | `review_candidate`：“查看并验证” | “稍后处理” |
| `connected_verified_waiting_solution` | `automatic` | “这项服务已经验证；还在检查整套方案” | 无 | “连接详情”“查看进度” |
| `conversation_ready` | `terminal_start` | “已经有一套方案可以开始对话” | `start_solution`：“用这套开始” | “换一种方式”“高级配置” |
| `review_ready` | `terminal_start` | “这套方案可以开始，并且具备独立复核” | `start_review_ready_solution`：“用这套开始” | “查看独立复核来源”“换一种方式” |
| `action_required.login` | `user_required` | “检测到 Codex，只差登录” | `open_login`：“打开登录” | “改用其他来源” |
| `action_required.key` | `user_required` | “Kimi 会员 API 还需要填一次 Key” | `connect_product`：“连接 Kimi” | “Key 在哪里” |
| `action_required.start_local` | `user_required` | “检测到 Ollama，但服务没有启动” | `show_start_recipe`：“查看启动方法” | “复制命令” |
| `action_required.inspect_containers` | `user_required` | “检测到 Docker 或 Podman；可以检查已停止的本机 AI 服务” | `inspect_containers`：“检查本机容器服务” | “为什么需要确认” |
| `rights_unknown` | `user_required` | “已检测到该订阅，但暂不能确认 SayDo 是否在支持范围内” | 当前 domain subject/session 上动态物化的 `resolveRightsBlockedPrimaryActionV8` capability | “查看官方范围” |
| `custom_private_consent` | `user_required` | “这是你或组织管理的私有端点；费用由外部系统计量” | `review_custom_request`：“查看本次请求” | “数据去向”“高级配置” |
| `rights_forbidden` | `user_required` | “该订阅不允许由第三方产品接入” | 当前 domain subject/session 上动态物化的 `resolveRightsBlockedPrimaryActionV8` capability | “了解原因” |
| `testing` | `automatic` | “正在验证配置，不会替换当前可用方案” | 无 | “取消验证”是 cancel control；“查看已用预算” |
| `staged_failed` | `user_required` | “新配置没有通过，仍在使用原来的方案” | `apply_prescription`：一条处方化修复 | “技术详情” |
| `quota_limited_waiting_reset` | `automatic` | “本期额度已用尽，当前不会改走付费来源” | 无 | “更改费用策略” |
| `paid_dispatch_locked` | `user_required` | “服务已连接；开始付费调用前需要确认预算” | `authorize_once`：“确认本次使用” | “设置持久预算” |
| `spend_consent` | `user_required` | 从 `AuthorizationDisclosureReceipt` 渲染逐主体逐单位上限 | `confirm_conformance`：“确认并验证” | “查看费用依据” |
| `custom_protocol_probe` | `user_required` | “本次最多尝试 2 个已列明候选请求，成功即停” | `confirm_protocol_probe`：“确认并判断” | “手动选择协议” |

执行状态继续遵守 `docs/10-voice-ux-spec.md`：settle 前不说“完成/做完”；settle 后说“执行和检查都跑完了，等你验收”；合并后才说“交付了”。

权益状态优先级固定为 `forbidden → unknown/expired → credential missing → service health → capability`。前一层未通过时不展示后层的 secret 输入或付费动作。所有语音/TTS 提示继续脱敏 token、secret、账号和完整路径；S3 永不出现“允许执行”的语音动作。

### 8.3 错误解释顺序

错误卡按下面顺序组织，不把技术栈直接甩给用户：

1. 发生了什么：“模型列表没有读到”。
2. 影响是什么：“这项服务还没有加入推荐方案，原配置不受影响”。
3. 最可能的原因：“Key 与北京地域的 Base URL 不匹配”。
4. 一个主动作：“改用匹配的地域”。
5. 折叠技术详情：HTTP code、request id、adapter、endpoint fingerprint；全部脱敏。

### 8.4 可访问性与视觉验收

- 所有状态不只靠颜色；有文本和图标 label，但遵守全仓零 emoji。
- 自动更新结果使用 `aria-live=polite`，错误使用合适的 alert 语义，不抢走当前输入焦点。
- 探测中、真实自检、重启、live 确认均显示阶段和已用时；超过预期显示“仍在等待哪一项”。
- 键盘可走完 provider 选择、登录、model 选择、确认与错误恢复。
- 窄屏不展示横向四列表；用途详情纵向折叠。
- 改动后覆盖 light/dark、桌面/移动截图，并使用 headless Chrome 实际验证。

### 8.5 国际化合同

- GA 用户 locale 固定为 `zh-CN`、`en-US`与`ar-SA`，另有且只有独立 pseudo locale `en-XA`；所有用户可见 onboarding、状态、错误、动作、费用和可访问性名称都来自 typed ICU message catalog，禁止组件内散落字符串，`ar-SA`必须通过 RTL 专项门。
- CI 对三种真实 locale 做 key、变量名、变量类型、plural/select 分支和逐 BillingUnit 格式完全对账，并单独对`en-XA`验证同一schema；缺 key、变量换名、任一语言缺少金额主体或格式分支都非零。
- `en-XA` pseudo locale、最长 provider/model/error、200% 字号、窄屏、键盘顺序与 screen-reader snapshot 是固定门；`ar-SA`是第三个真实locale，必须通过RTL镜像布局、双向文本、输入光标、费用与日期格式、键盘顺序、screen-reader和截图TCK，不能由`en-XA`代替。

## 9. 生态覆盖清单

### 9.1 覆盖分级

覆盖的含义是“有 preset、能自动发现或一键配置、通过真实协议 conformance、权益边界明确、错误可处方”，不是 provider 名出现在下拉框里。

| 级别 | 定义 |
|---|---|
| L0 | 首发主路径；内置 registry、自动发现或 provider-first 一键接入、完整测试矩阵 |
| L1 | 主流企业/agent surface；有正式 adapter 与 conformance，但可在 L0 后独立交付 |
| L2 | 长尾 provider；优先通过 registry + 核心协议接入，使用量达到阈值后再做专用 adapter |
| inventory | 只告诉用户“检测到了”；不能进入推荐、不能调用 |

`L0/L1/L2` 只表示生态发布层级；“三核心协议”表示协议范围；“Phase 0–8”表示实施阶段，三者不再共用 `P0`。

上述级别也不等于用户当前可用。每个条目另展示四条证据轴和由完整当前闭包派生的 `ConnectionReadiness`；例如 L0 connector 在用户缺 key、价格证据过期或 route fence 不可得时仍是 `action_required/blocked`。

本节表格同时包含“当前固定reference minimum”和“后续roadmap inventory”，因此不能直接充当产品支持声明。对外支持页、连接picker、测试矩阵与release note只读取`PublishedSupportClaimSetReceiptV6`：其中固定reference集合恰好81条并逐条绑定准确product/realm/protocol/auth/wire/funding/live evidence与被测发行物；owner扩展只能以canonical namespaced append-only row、同等级qualification和独立claim追加，不能覆盖固定行。表格中写明“candidate”“roadmap”或“不在当前81行claim set”的条目绝不显示为已支持；未来新增一个协议也必须新增独立requirement row、重新跑门并生成新的support claim set，不能只改这张表或provider文案。

### 9.2 中国大陆与华语用户常见来源

| Provider/产品 | 目标入口 | 协议 | 权益默认 | 级别 |
|---|---|---|---|---|
| Moonshot/Kimi Open Platform | 普通官方 API preset | OpenAI Chat | payg API allowed | L0 |
| Kimi Code 会员 API | 官方第三方 API key；OpenAI/Anthropic 两个 preset；模型列表与档位资格由当前官方目录和权益验证产生，不硬编码单一 model ID | OpenAI Chat、Anthropic Messages | 会员额度 allowed；保留真实 `User-Agent`；Extra Usage 按用户当前 enabled/cap 状态判定 | L0 |
| Kimi Code Server/ACP | Execution Agent | agent protocol | 独立 rights 与逐工具 gate；不能代替会员 inference API | L1 |
| 智谱 BigModel 中国普通 API | 国内官方 API preset | OpenAI-compatible Chat 与独立 Anthropic Messages route；普通 key、endpoint/RequestProfile 分别过 TCK，不从 Coding Plan 外推 Responses | payg API allowed | L0 |
| Z.AI 国际普通 API | 国际官方 API preset | 当前证据只承诺官方 OpenAI-compatible Chat；Responses/Messages 不从 Coding Plan 或其他产品外推 | payg API allowed；与 BigModel 分 registry entry | L0 |
| GLM Coding Plan 个人套餐 | 仅官方 allowlist 工具 | 技术端点不等于分发授权 | 自建应用/backend inference 明确 `forbidden`；受支持工具间接使用另行核查 | inventory |
| MiniMax 中国 Open Platform | 中国站普通官方 API preset；`platform.minimaxi.com` realm | 当前固定发布行只承诺OpenAI Chat；Messages须新增独立row与TCK后才可发布 | 中国站账号/key namespace 的 payg API；与国际站收据不互借 | L0 Chat |
| MiniMax 国际 Open Platform | 国际站普通官方 API preset；`platform.minimax.io` realm | 当前固定发布行只承诺OpenAI Chat；Messages不从品牌文档外推 | 国际站账号/key namespace 的 payg API；与中国站独立 | L0 Chat |
| MiniMax 中国 Token Plan | 中国站官方支持的第三方工具 preset | 当前固定发布行只承诺OpenAI Chat与准确中国站endpoint | 逐edition/use case rights receipt，不能与普通API key或国际站混用 | L0 Chat，rights门 |
| MiniMax 国际 Token Plan | 国际站官方支持的第三方工具 preset | 当前固定发布行只承诺OpenAI Chat与准确国际站endpoint | 独立realm、key、计费与数据证据；不能由中国站报告外推 | L0 Chat，rights门 |
| DeepSeek | 官方 API preset | 当前固定发布行只承诺OpenAI Chat；Anthropic兼容须另建row与TCK | payg API allowed | L0 Chat |
| 阿里云百炼中国北京 | `cn-beijing` realm 官方 preset | 当前固定发布行只承诺OpenAI Chat；Responses/Messages是后续逐协议candidate | 中国大陆部署范围；北京账号/key/endpoint/模型后缀与费用证据整体绑定 | L0 Chat |
| 阿里云百炼新加坡 | `ap-southeast-1` realm 官方 preset | 当前固定发布行只承诺OpenAI Chat；其他协议不借北京或品牌级证据 | International部署范围；与北京key/endpoint/数据边界不互借 | L0 Chat |
| 阿里云百炼美国弗吉尼亚/德国法兰克福等 | 每个 region/deployment scope 独立 registry entry | 只启用该 region 当前公开协议与模型 | US/Global、EU/Global scope 和模型后缀逐项验证，不用品牌级报告 | L1 |
| 阿里云百炼 Coding Plan | 只通过受支持编程工具 | OpenAI/Anthropic endpoint | 禁止自定义应用后端与非交互批量调用；不得作为 SayDo inference supply | inventory |
| 火山引擎方舟/豆包中国 | 中国站Ark账号、endpoint与key namespace的官方preset | 当前固定发布行只承诺OpenAI Responses；Chat须独立row与TCK | 中国站payg、数据边界与资源endpoint receipt | L0 Responses |
| BytePlus ModelArk 国际 | 国际站独立 product realm 与官方 preset | 只启用 ModelArk 当前公开且已过 TCK 的协议 | 国际账号/key/billing/data独立；不得与火山方舟互借 | L1 |
| 火山方舟 Coding Plan | 独立套餐产品 | 仅登记公开支持面 | 授权文本不充分前 `unknown`，不收 key、不推荐 | inventory |
| 腾讯混元旧普通 API | 既有连接迁移入口，不再作为fresh onboarding默认 | OpenAI Chat | 只读导入旧配置并提示迁往TokenHub；新建连接不可选择旧入口 | inventory/迁移 |
| 腾讯云 TokenHub 广州站 | 中国大陆独立官方聚合API preset；主origin为`https://tokenhub.tencentmaas.com`，官方备用origin单独建endpoint identity | OpenAI Chat、OpenAI Responses、Anthropic Messages；Bearer认证的`GET /v1/models` | 默认按量后付费；广州站key、服务开通、计费模式与额度独立；OpenAI路径Bearer、Messages路径`x-api-key`；402和流中SSE错误均为正式terminal | L0 |
| 腾讯云 TokenHub 新加坡站 | 全球独立官方聚合API preset；主origin为`https://tokenhub-intl.tencentmaas.com`，官方备用origin单独建endpoint identity | OpenAI Chat、OpenAI Responses、Anthropic Messages；Bearer认证的`GET /v1/models` | 默认按量后付费；新加坡站key与广州站不互通；realm、billing、data evidence和模型开通状态独立 | L0 |
| 腾讯云 Token Plan 个人版 | 与TokenHub普通API完全分离的个人工具订阅；独立`sk-tp-*` key namespace | 仅独立`https://api.lkeap.cloud.tencent.com/plan/v3/chat/completions`与`https://api.lkeap.cloud.tencent.com/plan/anthropic/v1/messages`；不宣称Responses | 官方范围仅列明指定AI工具且限制自动脚本、自定义应用后端和非交互批量；SayDo未被列入时只做无secret inventory，直接接入为`forbidden`，提供官方范围说明而不读取或调用该key | inventory/rights hard block |
| 腾讯云 Token Plan 企业版专业/轻享 | 与个人版、TokenHub普通API分别建product/edition/realm/key/endpoint；专业版为积分池，轻享版为Token池 | 广州`https://tokenhub.tencentmaas.com/plan/v3/chat/completions`与`/plan/anthropic/v1/messages`、新加坡对应`tokenhub-intl` origin，共四条固定row；不宣称Responses或models目录 | 企业组织、套餐`enterprise`或`enterprise-auto`、地区、Key归属、可用模型、积分/Token池和过期时间逐项权威观察；Chat用Bearer，Messages首选`x-api-key`且可按官方约定选择Bearer，单请求恰好一个凭证header；个人版或普通TokenHub证据不得替代 | L0，四条固定row |
| 腾讯云 TPM预留与模型单元 | TokenHub普通API上的容量/资金权利，不是Token Plan，也不是另一套wire或API授权 | 仍通过对应TokenHub站点与该模型已发布的逐协议row调用 | 订单、模型覆盖、地域、超额和hard stop由当前账户权威观察；不能替代API rights、站点key、服务开通或协议证明 | funding层，不单建provider |
| 百度千帆普通 API | 官方API V2 preset | 当前固定发布行只承诺OpenAI Chat；Messages须独立row与TCK | payg API allowed | L0 Chat |
| 百度旧 Coding Plan | 迁移/停售 inventory | 只展示官方迁移信息，不建新 connector | 按产品当前停售/迁移状态 hard block | inventory |
| 百度 Token Plan 个人版 | 独立 product entry | 独立 key namespace/endpoint | 未核清 SayDo 分发用途前 `unknown` | inventory |
| 百度 Token Plan 企业版 | 独立 product entry | 独立 edition/account/endpoint | 合同或官方授权明确后再判 rights | inventory/L1 |
| 百度 Token 福利包 | 独立product entry | 当前固定发布行只承诺OpenAI Chat与该福利包准确endpoint | 独立Rights/Billing receipt，不与个人/企业Token Plan合并 | L0 Chat，rights门 |
| SiliconFlow 中国站 | `docs.siliconflow.cn` 对应中国 realm 的聚合 API preset | OpenAI Chat | 中国站 key/endpoint/payg；需要实际 routed provider/data receipt | L0 |
| SiliconFlow 国际站 | `docs.siliconflow.com` 对应国际 realm 的独立 preset | OpenAI Chat | 国际站 key/endpoint/payg与数据证据独立；不能拿中国站报告通过 | L0 |
| StepFun 阶跃星辰 | 官方 API preset | registry 声明的兼容协议 | payg API | L1 |
| 华为云 ModelArts/MaaS | 企业 cloud connector | 只走官方当前 IAM/endpoint/model deployment surface；账号、project、region与数据域判别 | 未形成真实 native-auth TCK 前只保留 inventory | L2 目标 |
| 百川、讯飞星火、商汤日日新、ModelScope 等 | registry preset | 以官方当前协议为准 | unknown 先不推荐 | L2 |

关键处理：Coding Plan key 即使长得像普通 API key，也不能因此当成通用 API。entitlement ID、Base URL、使用场景与 rights 必须一起校验。

### 9.3 全球官方 API、第三方 API 与云平台

| Provider/产品 | 目标入口 | 协议/认证 | 级别 |
|---|---|---|---|
| OpenAI API | 官方 preset | Responses 主路径、Chat 兼容；API key | L0 |
| Anthropic API | 官方 preset | 原生 Messages；x-api-key/短期 Bearer | L0 |
| OpenCode Zen | 官方按量 AI gateway preset | 模型级 Chat/Responses/Messages endpoint；Zen API key；逐模型价格与数据条款 | L0 |
| OpenCode Go | 官方订阅 API preset | 模型级 Chat/Responses/Messages endpoint；Go API key；订阅限额与可选 Zen 余额补足分开授权 | L0，rights/费用门 |
| Google Gemini API | 官方 preset | Google GenAI；`x-goog-api-key`，绑定Google Cloud project与key限制/轮换证据 | L0 |
| xAI | 官方preset候选 | 只有逐协议row、官方证据锁与live TCK进入发布声明 | roadmap inventory；不在当前81行claim set |
| Mistral | 官方preset候选 | Chat/Agents必须分Inference与Execution surface逐项验证 | roadmap inventory；不在当前81行claim set |
| Cohere | 官方 adapter | 原生 Chat/工具/citation | L2 |
| OpenRouter | gateway preset | 平台credits路径支持手填key或独立`api_key_pkce_exchange`；BYOK在普通inference key/PKCE key下只inventory，只有独立management authority能冻结全部key顺序、provider account、shared fallback与配置revision后才正式支持，并按上游费用与gateway fee分component记账 | credits L0；BYOK条件式 |
| Groq、Cerebras | 高速推理preset候选 | OpenAI-compatible品牌声明不能代替逐产品/realm/auth/model conformance | roadmap inventory；不在当前81行claim set |
| Together、Fireworks | 托管推理preset候选 | 逐provider pack、协议、费用与数据证据后再发布 | roadmap inventory；不在当前81行claim set |
| Hugging Face Inference Endpoints | endpoint preset | OpenAI-compatible 或专用 endpoint | L1 |
| NVIDIA NIM | endpoint preset | OpenAI-compatible，支持企业自托管 URL | L1 |
| Perplexity Sonar、GitHub Models | 官方 API preset | 只开放当前官方公开的协议/profile，逐模型 conformance | L1 |
| Replicate、Baseten、RunPod、Modal、Nebius、SambaNova | 托管/专用 inference endpoint | 优先 custom deployment + registry pack，不从品牌推断协议或模型能力 | L2 |
| Databricks Mosaic AI、Snowflake Cortex、IBM watsonx.ai | 企业 cloud connector | 原生身份、workspace/account/region 与数据边界；不要求用户降格复制长期 key | L2 |
| AI21、Aleph Alpha 与其他官方模型 API | registry/provider pack | 有稳定官方 programmatic surface 和 TCK 后进入，不靠 logo 声明支持 | L2 |
| Azure OpenAI/Microsoft Foundry | cloud connector | Chat/Responses；API key精确使用`api-key`，Entra/Managed Identity使用Bearer且绑定tenant/principal/resource/audience；resource/deployment 分离 | API key L0；Entra/workload identity L1 |
| Amazon Bedrock | cloud connector | Converse及官方兼容route；named static profile用SigV4 signing lease，role/SSO/session用temporary issuance，另有Bedrock API key | L1 |
| Google Vertex AI | cloud connector | Google GenAI/兼容端点 + 明确 ADC principal/project/location | L1 |
| Cloudflare Workers AI/AI Gateway | cloud/gateway connector | 官方 REST/兼容端点 + scoped token | L2 |

### 9.4 CLI、订阅与 Agent surface

| 来源 | 当前项目状态 | 最终策略 |
|---|---|---|
| Codex/ChatGPT/Enterprise access token | wired CLI one-shot | App Server stdio作为Execution Agent候选；ChatGPT交互登录、Platform API key、Enterprise automation access token分别出auth/rights/billing receipt，owner裁决D8归属后才启用。custom provider只认Responses wire，不把Chat/Messages Base URL伪装成Codex直连能力 |
| Claude Pro/Max/Team | wired CLI one-shot；当前个人本机路径有专项方案 | 分发产品默认禁用订阅登录；Anthropic 当前明确要求未获批准的第三方用 API key。只有书面批准或官方新 surface 才启用 |
| Gemini CLI 企业/Cloud/API key | wired CLI | 保留为独立 enterprise/API connector；不再承诺个人 Pro/Ultra/free 账号 |
| Antigravity CLI/Google AI Pro/Ultra | 当前被当成 gemini alias 候选 | 独立 inventory/Execution Agent 候选；只有官方 programmatic surface、rights 和逐工具 gate 通过才启用 |
| Kimi Code 会员 | inventory only | L0 优先接官方第三方 inference API；Server/ACP 单列 Execution Agent；显示共享额度、Extra Usage 当前状态与 cap |
| OpenCode Zen | inventory only | L0 按量 inference API；用户在 SayDo 单独录入 Zen key，按模型做协议/价格/数据边界 conformance |
| OpenCode Go | inventory only | L0 订阅 inference API；Go 限额与可选 Zen balance overage 是两个 funding component/决策，数据保留按模型显示，不读取 OpenCode `auth.json` |
| OpenCode Server/ACP | inventory only | L1 Execution Agent；由 OpenCode 持有其 provider 凭据，SayDo 不复制 token；缺强 peer identity、费用闭包或逐工具前置拦截时只 inventory |
| Cursor | wired CLI | 继续版本化 conformance；订阅权益没有当前官方产品嵌入证明时 rights=unknown，不作为全局默认 |
| Grok Build CLI | wired CLI | 继续版本化 conformance；区分官方 xAI 订阅、API key 与三方上游 |
| Qwen Code | wired CLI | 区分普通 API、Coding Plan 与三方 provider；Coding Plan 不用于 SayDo backend inference |
| GitHub Copilot CLI | wired CLI | 以官方程序化/订阅范围为准；每版本验证 no-tool 与 observed model，不从 GitHub credential store 抽 token |
| Windsurf/Codeium、Kiro、Augment、JetBrains AI/Junie、Amazon Q Developer、Sourcegraph Cody | 未收录或 inventory | 各自拆 product/edition/CLI/IDE surface；只有官方 programmatic protocol、分发 rights、费用与逐工具 Gate 可证明时进入 L1 Execution Agent，不提取 IDE credential |
| TRAE、腾讯 CodeBuddy、Qoder、通义灵码等区域型 IDE/订阅 | 未收录或 inventory | 按中国/国际 product、edition、region 和工具 allowlist 独立建模；没有第三方嵌入授权时只给官方 API/受支持工具处方 |
| Mistral Vibe | inventory/候选 | 有官方 headless 与 rights 证据后进入 L1 adapter |
| Goose、Zed Agent 等已实现 ACP 的 agent | inventory only | L1 Execution Agent；**复用共享 ACP driver 与同一 execution TCK**，不各自新增版本化 driver。Goose 1.37.0 实测同时提供 `goose acp`（stdio）与 `goose serve`（HTTP + WebSocket），两种传输分别对应 `acp_stdio`/`acp_http` kind |
| Aider、Pi、Droid、OpenHands、Cline/Kilo、Roo Code、Continue 等 | inventory 或未收录 | 优先视为 Execution Agent/plugin；实现 ACP 的复用共享 ACP driver，仅专有机器协议才新增版本化 driver，不把任意 CLI stdout 当安全 inference protocol |

### 9.5 本地与自托管

L0 自动发现 Ollama、LM Studio、oMLX；L1 覆盖 Jan、llama.cpp、vLLM、SGLang、LocalAI；L2 registry 覆盖 MLX-LM server、Xinference、TGI、Text Generation WebUI、Open WebUI proxy、GPT4All Local API、llamafile、Docker Model Runner、Podman AI Lab、KoboldCpp、llama-swap、TabbyAPI 与受管 Triton/TensorRT-LLM endpoint 等。Docker Model Runner 与 Podman AI Lab 都使用 §4.16.4 的具名 product journey，不再只是品牌行或通用容器枚举结果。Windows Foundry Local 作为 Windows具名 L2本机 runtime；Apple Foundation Models 只能通过随 SayDo签名发布、受 OS entitlement/availability/language/model能力约束的 native helper进入 L2，不能伪装成任意 OpenAI endpoint。Android AICore/Gemini Nano 等移动系统模型不在当前桌面 distribution scope，保留 registry inventory，不为“任何本地服务”营销承诺扩大边界。容器/服务管理器只在用户确认后的 `explicit_active` detector 调用 Docker/Podman/systemd/launchd/Windows service metadata，不在静态阶段执行管理命令。

本地“开箱即用”只对当前确实ready的服务成立：识别、peer绑定和验证均自动完成。已安装但未运行、没有模型或冷态的服务会自动识别缺口，但先进入可恢复的`action_required`状态；普通外部runtime给出准确的官方install/start/model-manager处方，SayDo-managed runtime才可在逐动作授权后enable/repair/load。两类恢复都保存用户原配置，不静默下载、启动或转云，也不在恢复终态前显示“自动接入成功”。

对“任何本地模型”的承诺由下面规则实现：

- 服务实现三核心协议之一且通过 conformance，即可接入，不要求模型名在硬编码 family 表中。
- 不支持工具的模型仍可用于 thinking/cheap 的受限场景，但不能进入 dialog 工具环或 evaluator strict schema。
- 模型 family 无法从 registry 确认时，用户可为普通对话补充展示标签；该标签不能作为 evaluator 独立性证据，也不扩散到其他 endpoint。
- 本地服务重启后若 runtime build、明确 model revision/weight digest/template revision 改变，旧 receipt 失效。没有上游身份材料时标 `unverified/identity_stability=unknown`，不使用响应 fingerprint 猜权重。
- v1 inference data plane只接受 HTTP(S) loopback/LAN endpoint；Unix domain socket 与 Windows named pipe只用于具名、最小 schema 的本地管理/发现 helper，不作为任意 custom inference Base URL。需要该 transport 的模型服务先通过受信本机 gateway或未来 `ext:inference:*` wire/TCK接入。这样不把 Docker socket或任意同 UID pipe误当安全模型协议；未来原生支持必须新增 endpoint identity、peer credential、ACL、cancellation/backpressure和三平台 TCK，而不是把路径塞进 URL。

### 9.6 桥接与开源管理工具

| 工具 | 定位 | 接入方式 | 禁止事项 |
|---|---|---|---|
| CC Switch Desktop公开代理 | 本机Anthropic Messages bridge，不是稳定外部控制面 | 验证签名产品、loopback peer、`127.0.0.1:15721`与`POST /v1/messages`；route/failover/funding固定opaque | 不借用`cc-switch-cli`命令、不读私有数据库、不声称pin route；只允许逐次确认的普通对话，不进自动推荐/fallback/evaluator/no-new-spend |
| CC Switch Desktop管理面 | 未来control inventory | 只有发布稳定、版本化外部API后另建control requirement | 当前Tauri `invoke`与私有数据库不算公共API，不从public proxy推断控制权 |
| cc-switch-cli fork | 独立 CLI 配置与代理控制面 | 按明确版本使用机器可读 status/proxy 命令 | 不把 fork 能力外推给桌面版，不读上游 secret |
| OpenCode Server/ACP | 开源 agent 与 provider hub 的执行面 | Server/ACP/HTTP SDK | 不复制 `auth.json`，不把 agent 权限降格成普通推理；Zen/Go 另走 inference product |
| Claude Code Router 等 CLI router | 本地协议路由/转换层 | 验证 loopback identity、route 与健康；作为 bridge | 不读取上游 credential 文件；无 effective route 不进 evaluator/no-new-spend |
| LiteLLM | gateway | OpenAI/Responses/Anthropic 路由，读取公开 model list/health | 不假定其 fallback、费用和实际 provider 固定 |
| One API/New API | gateway | 兼容 endpoint + route receipt | 不因 UI 名称相似共享 key |
| Portkey/Vercel AI Gateway | managed gateway | 官方 endpoint、headers、route metadata | 不丢失 routed provider 和 usage provenance |
| Envoy AI Gateway、Kong AI Gateway、Higress、Apache APISIX、Helicone Gateway | 企业/自托管 AI gateway | 声明式 route 或公开 request metadata；按 adapter profile 取得 effective route/usage | 不内嵌第二套路由控制面；不能冻结上游、费用、数据边界时只 route-pinned/inventory |
| Cherry Studio、Chatbox、LobeChat、Open WebUI、AnythingLLM、Msty 等本地客户端 | 配置来源或本地 gateway | 只导入用户明确选择的非秘密 endpoint/model metadata；若暴露稳定公开 server 则按协议自检 | 不扫描/复制其 token、聊天历史和私有数据库，不把 GUI 登录当 SayDo 权益 |
| 企业自建 proxy | custom gateway | provider-first custom flow + conformance | 未通过 network/secret/redirect 检查不得保存 |

### 9.7 开源项目与标准对标

本方案不以“支持多少个品牌名”为先进性指标，而以边界是否稳定、扩展是否独立、运行路径是否可证明、兼容性声明是否可复现来判断。调研结论如下；官方链接统一列在 §15。

| 项目或标准 | 值得采用的设计 | 明确不照搬的部分 | 在 SayDo 中的落点 |
|---|---|---|---|
| Vercel AI SDK | 公开 provider specification、社区 provider package、middleware 分层 | 只靠单次 SDK 调用抽象不能覆盖订阅权益、自动发现与执行代理安全 | `@saydo/connector-sdk`、纯 `ProtocolAdapter`、宿主持有 transport/auth |
| OpenCode 与 models.dev | deployment config 与 request behavior 分离；版本化离线 catalog；正常调用不依赖 catalog 网络 | 不把上游 catalog 直接当权益真相，不把实验性 wire type 变成稳定公共合同 | release-bundled snapshot、双 TUF 仓、候选元数据与 Rights 分离 |
| LiteLLM | 广泛协议归一、gateway/router、预算与观测经验 | 不继承隐藏自动 fallback；路由结果不能替代授权、资金来源与审计收据 | bridge connector、显式 `effectiveRoute`、SayDo 自己做 admission |
| Envoy AI Gateway | 控制面编译配置、数据面固定执行、扩展策略与转发路径分离 | 不为了架构相似度引入分布式控制面或 Kubernetes 依赖 | `ActiveSupplySnapshot` 原子发布；热路径无目录和发现访问 |
| Gateway API Inference Extension | model-aware endpoint selection、独立 endpoint picker、声明式策略 | endpoint 健康和负载不能越权改变模型、费用或数据边界 | 本地多副本/企业部署的候选选择器；策略仍由 Gate 0 决定 |
| Kubernetes Gateway API Conformance | profile、core/extended、机器可读报告和可比较兼容等级 | 不用单个“compatible”布尔值掩盖部分实现 | protocol profile、capability profile、TCK report、成熟度四轴和当前 activation readiness |
| Cline SDK | `llms`、agents、core 单向包依赖；后台发现与核心调用解耦 | 不把 agent SDK 和无工具推理入口混成一个 connector | Inference Supply 与 Execution Agent 两平面；包依赖门禁 |
| Open WebUI、Jan | protocol-first 自定义 endpoint，降低长尾接入成本 | 不把 `/models` 成功视为完整 conformance；不要求本地无认证服务填写假 key | provider-first custom flow；凭据字段依据探测结果显示；主动 probe 工具/流式/错误 |
| HashiCorp go-plugin | 子进程 RPC、握手、协议版本、崩溃隔离、校验与重连经验 | 不绑定 Go，不把 handshake/子进程当安全边界，不允许插件获得宿主进程环境和原始 secret | 第三方 code plugin 使用 OS-enforced sandbox + framed RPC；opaque handle；缺 sandbox backend 时只 inventory |
| WASI | capability-based sandbox 与可移植组件边界 | 不把尚未验证的 Wasm 网络、TLS、流式与 SDK 生态作为首发前提 | 作为未来高隔离宿主候选；达到等价 TCK 和性能门槛后再启用 |
| ACP 与 VS Code Agent Host | agent 作为长生命周期独立进程；双向权限与任务事件协议 | 不将其误称为普通 inference API，也不绕过逐工具 gate | Execution Agent driver、生命周期监督、权限事件和可取消任务 |
| OpenTelemetry GenAI 语义约定 | 统一模型、provider、operation、usage 与错误观测字段 | 不默认记录 prompt、response、secret、完整 endpoint 或高基数模型输入 | 低基数 telemetry；内容字段默认关闭；本地诊断包单独授权 |
| Ollama、LM Studio、oMLX、vLLM、llama.cpp、SGLang、LocalAI | 同一部署可能暴露多种兼容协议，适合协议优先与能力实测 | 不按品牌推断所有模型都支持工具、JSON Schema 或稳定流式 | detector 只产候选；逐 endpoint/model/profile 跑 conformance |

这组对标得到五条不可退让的工程结论：

1. catalog、policy、discovery 都属于控制面，不能进入每次请求热路径。
2. connector 必须是可单测的纯边界；网络、secret、重试、预算、审计由宿主统一控制。
3. “兼容 OpenAI/Anthropic”只能是 profile 声明，不能是品牌级永久结论。
4. 第三方扩展必须经过版本化 SDK、TCK、签名与故障隔离，不能 `dynamic import` 任意 npm 包。
5. 项目对外展示的是可下载的 conformance report，不是无法复核的 logo wall。

### 9.8 生态包与扩展成本策略

长期扩展只允许下面四种变化单位。评审新接入时先判断属于哪一种，禁止默认新建一个包含认证、网络、路由和 UI 的全能 provider 类。

| 变化单位 | 包含内容 | 何时需要代码 | 发布方式 |
|---|---|---|---|
| Protocol Profile | wire request/response、stream event、错误和能力探针 | 出现新的线协议或既有协议无法保真表达时 | builtin 随核心版本；extension 使用 namespaced major + artifact/profile/TCK，不改 daemon core |
| Provider Product Pack | endpoint 模板、header 声明、model/capability 候选、rights/billing 引用、区域与帮助链接 | 常规新增官方或三方 API 通常不需要核心代码 | 内置受信版本或 TUF 签名声明式包 |
| Deployment Detector | 只读安装迹象、loopback 端口、公开 status/version/model metadata | 出现新的本地 runtime、gateway 或 CLI surface 时 | 受限 detector；只产 candidate，不读取 secret |
| Execution Driver | 生命周期、任务事件、逐工具权限、取消与结果收据 | 出现新的 ACP/App Server/agent protocol 时 | 隔离进程 driver；通过 execution TCK |

按生态拆包时采用 `global-official`、`mainland-official`、`managed-gateway`、`local-runtime`、`enterprise-cloud`、`execution-agent` 六个 release bundle。它们只是交付和维护边界，不进入运行时策略分支；运行时只看协议、能力、rights、费用、数据边界与健康收据。

每个外部贡献必须同时提交：机器可读 manifest、最小 fixture、无秘密的录制响应、TCK 报告、官方证据链接、失效条件、维护 owner 与 sunset 规则。只提交品牌 preset 而没有这些材料，不进入 `community_verified` 或 `builtin_*`，最多进入 `inventory`。

### 9.9 GA mandatory baseline

GA baseline 不是示例清单，而是 release verifier 的固定输入。下列每一行都产生非空 `requiredEntryKeys`、`requiredJourneyKeys` 与 `categoryKeys`。`ReferenceGradeProfileV3.requiredEntryKeys`中的具名产品，包括`bridge.cc-switch-public-proxy`，不能被owner decision替换、删除或用同类产品顶替；owner只能增加required entry，或在没有具名minimum的category中选择额外实现，任何未来替换都必须发布新的reference-grade profile ID并撤销旧designation。任何category都不能用inventory、另一realm、另一auth或旧distribution报告占位：

| Mandatory category | 必须通过的最小 entry/journey | 机械要求 |
|---|---|---|
| `mainland_official_api` | 智谱 BigModel 中国普通 API、Kimi Open Platform、DeepSeek，均为 `guided_key` | 三个独立 product realm、key namespace、Chat profile与当前 distribution报告 |
| `mainland_subscription_api` | Kimi Code 会员 API 的 OpenAI 与 Anthropic 两个 protocol profile | 同一会员 principal下两份 protocol TCK；Extra Usage unknown不得冒充 no-new-spend |
| `mainland_realm_split` | MiniMax中国、SiliconFlow中国、百炼北京、火山方舟中国 | 四个 realm entry，不得由国际站或品牌级报告替代 |
| `global_realm_split` | MiniMax国际、SiliconFlow国际、百炼新加坡、BytePlus ModelArk | 四个国际 realm entry；跨 realm key负例必须零 secret read/零 packet |
| `global_native_api` | OpenAI Responses、Anthropic Messages、Gemini API | 三个原生 protocol profile；Chat compatibility不能替代 Responses/Messages/GenAI |
| `global_gateway_and_subscription` | OpenCode Zen、OpenCode Go、OpenRouter credits key、TokenHub广州/新加坡普通API、腾讯企业Token Plan广州/新加坡；OpenRouter PKCE换API key为独立journey | Zen payg、Go subscription/overage、OpenRouter手填key/PKCE key分别有funding与auth报告；TokenHub两站各自的Chat/Responses/Messages、site key、`/v1/models`、402与流中SSE错误独立pass；企业Token Plan四条Chat/Messages row另验专业积分池/轻享Token池、企业Key、plan path、region与单凭证header |
| `local_zero_config` | Ollama、LM Studio、oMLX | `auth=none`、peer admission、cold/warm、Chat/Responses/Messages按产品真实能力分别报告 |
| `local_managed_journey` | Docker Model Runner | disabled/API off/no model/cold/loaded/port-conflict状态机与唯一主动作 |
| `enterprise_cloud_identity` | Bedrock named static profile与role/SSO各自journey、Vertex ADC、Azure Entra或Managed Identity | 至少三云workload identity，并单独覆盖AWS静态profile；静态key、临时identity报告不能互借 |
| `execution_surface` | Codex App Server stdio、OpenCode ACP stdio或HTTP、一个普通 CLI stdio | 三个准确 wire kind，逐 session/physical/tool lease、Gate与no-secret证明 |
| `bridge` | 固定具名的CC Switch Desktop public Messages proxy，加上LiteLLM三协议 | CC Switch按公开代理能力验证，必须明确route/failover/funding opaque并限制为逐次确认普通对话；不得伪造control或route-pinned能力。LiteLLM Chat/Responses/Messages各自通过准确optional-auth、route/funding与drift TCK |
| `custom_endpoint` | OpenAI Chat、OpenAI Responses、Anthropic Messages、mTLS-only private gateway、custom secret-header gateway | provider-first预览、Base URL semantics、header broker、SSRF/proxy/data-processor与unknown-metering正反例；五条独立recipe与typed field event均需通过 |
| `ux_locales_platforms` | macOS arm64、Linux x64、Windows x64上的 `zh-CN/en-US/ar-SA`真实用户 journey 与独立`en-XA` pseudo suite | 当前发货物、相同baseline digest、逐auth点击/外部任务/恢复报告、RTL与a11y门 |

baseline verifier 还要求 detached evidence set自身的 `distributionArtifactDigest`、每个 required journey evidence的 `releaseConformanceBinding.sutDistributionArtifactDigest`、`releaseConformanceBinding.releasedDistributionPayloadDigest`、`testedDistributionArtifactDigest` 和外层 `ReleaseEcosystemBinding.distributionArtifactDigest` 五者相等；这里的 distribution digest都按同一 manifest scope计算，并排除 evidence set、detached binding/signature和 release metadata。verifier还校验 matrix definition与 evidence set的 entry/journey集合精确相等，并校验 report kind、surface/protocol/auth/realm/category全等。任何 required项缺失、重复/confusable key、`requiredForGa=false`、另一平台借用、旧 binary报告、只测 library或 report outcome非 `completed_pass` 都使 release gate非零。

## 10. 分阶段实施计划

### 本节各 Phase「验收标准」的定位

本节各 Phase 下的 `- [ ]` 条目共 327 条（88,174 字符，平均 269 字符/条，最长 902 字符），
**它们是 §12.3 那个 Phase gate 脚本要实现的规格，不是给人逐条打勾的 checklist。**

- **唯一的验收入口**是 §12.3 定义的 `run-ai-supply-phase-gate.mjs --phase <id> --json`；
  该命令的 exit code 才是「本 Phase 是否通过」的机械判据。
- 本节条目描述该脚本必须覆盖的性质与负例。一条条目往往对应脚本中的多个测试用例，
  因此长度远超常规验收项——这是规格的密度，不是验收项的密度。
- 涉及 owner 决策的条目，其验收形态是**决策已固化为 schema-valid record 且 digest 前后一致**，
  而不是「人确认过了」。例如 Phase 0 要求「owner 对 §14 的十项决策签字并生成 schema-valid
  batch/decision record；preflight 在开工和收口得到同一 digest」，以及 canonical 五处投影的
  「owner 已裁决 tuple 逐字段相等」——两者都由脚本判定。
- 真正需要人在环的只有两类，均在 Phase 8：connector 成熟度跃迁
  （`community_unverified → community_verified → builtin_beta → builtin_stable` 每次跃迁
  要求明确 owner 决策，不得隐式跨级）与性能 baseline 的 owner 批准替换。
- 可直接量化的目标见 §12.1 北极星指标（如「有 cache 的首张卡片 P95 不超过 150 ms，硬上限 300 ms」），
  那是本方案中可判定验收标准的样板；本节条目不重复它们。

施工方不得把本节条目当作「读一遍确认无误即可勾选」的清单；未被 gate 脚本覆盖的条目
视为**未验收**，不因文字已写入而算作完成。

### Phase 0：canonical 与 ADR 先行

目标：先决定合同和边界，禁止边施工边定义“支持”。

开工前置：§0 的排产指针、dirty canonical、PLAN-2 具名批次与基线 digest 全部解决，十项 owner decision 写入签名的机器可读 batch/decision record。任何 canonical edit 前先单独运行 `node scripts/check-ai-supply-preflight.mjs`；它核对空 pointer、文件 ownership、PLAN-2 批次/依赖、基线 SHA 和 decision digest，不能被普通 Phase 0 gate 的末项成功掩盖。Phase 0 收口再次运行并要求 digest 未漂移；Phase 0 不承担“先做再补排产”的权限。

改动范围：

- `docs/07-tech-stack-decisions.md`：同步更新 D7、D8、D18；owner 先裁决 Codex App Server/ACP 属 Tier 1 后端、Hopper 后端还是独立执行面。
- `docs/09-data-contracts.md`：更新 §6/§9/§11/§12/§13，新增 Connection 判别联合、InferenceBinding、可扩展 protocol ID、OAuth flow/grant/exchange、复合 transport/auth、ResourceScope、RequestProfile、Inference/Execution EndpointIdentity、三平面 durable cursor/physical lease、事件状态机、DiscoveryCandidate、Capability/ModelIdentity/ComputeBoundary/Rights/Billing/DataBoundary/Gate/Spend/Activation receipts。
- `docs/modules/c-control-bridge.md` C2/C5：写清 Execution Agent 的 dispatch Gate 0、逐工具前置审批、gate 不可达/未知事件 deny+kill、proof 与状态所有权；与 `docs/08-module-design.md` 索引、D8 和 09 做双向一致性检查，不新建第二份 C 域文档。
- 在 08、07/D8、09 与 C2/C5 各放一份由 09 合同驱动的机器可读 `ai-supply-execution-plane` 投影，字段至少为 `schemaVersion/placement/connectionKind/dispatchGate/perToolGate/unknownEvent/proofOwner/stateOwner/schemaAnchor`。新增 `scripts/check-ai-supply-canonical-consistency.mjs` 解析五处投影、要求逐字段完全相等并核对真实 section/link anchor；不得用关键词存在或链接未断代替语义一致。
- `docs/10-voice-ux-spec.md`：加入供给失效、额度、付费切换的可说/不可说规则，继续做完整路径与 secret 脱敏。
- `docs/11-ui-spec.md`：把首次引导改成自动发现 + 一键推荐 + provider-first 配置 + AI 服务状态中心；明确撤销全局固定的“数据不出这台电脑”承诺。固定页尾至多说明 SayDo 核心服务本机运行；只有本轮所有 active data-egress subject 均有可信本机处理和应用级出口限制证明时，才动态显示“本轮仅使用本机处理，已限制已知数据出口”，并始终提供 swap/coredump/VRAM/snapshot/backup 等设备级残余说明。data-egress subject 必须同时覆盖 inference route/RouteSet 全成员、Execution Agent surface 及其 tool/network egress；任一项远程或 unknown 即禁止本机承诺。
- 新增工程 ADR：协议 adapter 与 registry 边界、可保真 Inference IR/adaptation-loss gate、控制面编译与数据面不可变 snapshot、SecretRef/endpoint identity、rights fail-closed、Connector SDK/TCK 与包单向依赖、声明式包和 code plugin 的信任/隔离边界、catalog/policy 双 TUF 根与 delegated roles、Node 22 性能画像与引入 native/Wasm 的证据门。Phase 0 只冻结依赖图与禁区；包骨架和机械 import gate 在 Phase 1 创建并验收。
- 在 canonical 固化 `route-set-v1`、`wire-budget-v1`、`host-worker-budget-v1`、`registry-artifact-budget-v1`、`evidence-store-budget-v1`、`type-contract-compile-budget-v1`、detector budget、`BenchmarkWorkload v1`、三平台正式支持 profile 和 CI/nightly/release qualification 分层；全部数值只以 §4.16.3 的唯一机器对象为准，同一 profile ID 只能有一个 JCS digest，未来增大权限或资源上限必须新 profile。
- 明定 connector/receipt/secret/activation journal 的 SoT、跨介质 CAS、崩溃恢复、上一正式版降级策略和清理时点；现有`runtimeChildRegistry.ts`逐PID JSON与新SQLite operation authority必须采用§4.16.1的五态dual-read/shadow-write/reconcile/dual-write/cutover合同，不能一次复制后删旧文件。
- 定义 `evidence-lock.json` schema：content-addressed raw artifact/digest、访问级别、canonical URL、accessedAt、locale/region/account context、fetcher/canonicalizer version、normalized projection digest/schema、product/surface/useCase、reviewer、expiry 与替代关系；政策发布只接受审查者可按锁定版本重放的人工裁决，网页链接本身不是 receipt。
- 定义不可降级的81行`REFERENCE_REQUIREMENTS_V3`、逐行`REFERENCE_EXACT_CONNECTION_ORACLE_V6`、`ReferenceRequirementsDerivationReceiptV3`、`ReferenceGradeProfileV3`、无外层自引用的`GaEcosystemMatrixCoreV3`和`GaMandatoryBaselineV3`，以及测试后生成的detached owner-decision evidence、`GaEcosystemReleaseEvidenceSetV3`、固定`PublishedProductProtocolClaimSetReceiptV6`、聚合`PublishedSupportClaimSetReceiptV6`和`ReleaseEcosystemBinding`；稳定requirements逐row固定entry/product/protocol-or-surface/auth/origin/path/models-route/realm/platform/funding/journey/recipe/state/tier/maturity，deriver重算总数、digest、唯一键和全部投影。固定claim只从准确row+oracle+completed evidence+entry/ecosystem gate+live disposition+funding variant+被测distribution提交；owner扩展必须从canonical append-only row和同等级release qualification生成独立claim。支持页、picker、测试矩阵和release note再只从聚合support claim set生成，不能形成摘要环或手写额外能力。
- 建立紧凑schema DSL与确定性codegen，把重复的receipt body、producer签名、Zod/runtime validator、edge metadata、authority lifecycle、测试fixture和公开export map从同一canonical输入生成；生成物与手写源分别设source/type/instantiation/RSS/wall预算并固定generator、argv、lockfile和输出digest。v20公共受信面只导出5个wire/RPC/离线验证facade producer和5个根kind；细粒度lifecycle producer全部留在daemon内部受信模块，authority source与判别constituent从真实AST全量生成并写入签名manifest。v19及更早release/BOM/lifecycle producer只作迁移decoder和负向fixture，package public export、插件SDK与daemon外部边界中的导出数必须为0。

验收标准：

- [ ] clean build两次产生byte-identical的v20 public export map、5个producer ID、5个根kind、完整六字段pointer edge manifest、真实正反fixture清单与全量authority census；任一v19及更早producer导出、内部lifecycle producer外泄、名称猜测、额外/缺失/重复producer或authority、裸/unfrozen public receipt、未登记边、generator nondeterminism均使gate非零。只有`commitReleaseEcosystemBindingV20`可以形成发布晋升receipt。
- [ ] `AI_SUPPLY_CONTRACT_POSITIVE_FIXTURE_IDS_V20`的17个正向模块逐文件从真实producer输出直接串接，`AI_SUPPLY_CONTRACT_NEGATIVE_FIXTURE_IDS_V20`的25个负向模块逐文件命中签名的准确diagnostic；完整合同artifact与每个模块都使用Node 22、准确单次`--max-old-space-size=2048`前缀和锁定TypeScript 5.9.3 strict，分别在隔离cold process中满足900,000 instantiations、2.5 GiB peak RSS与60秒wall绝对门。组合mega-probe只作开发诊断，不是发布编译单元，不能用一个总结果掩盖单模块失败或类型爆炸；反过来也不能只测42个fixture而漏掉完整合同artifact。
- [ ] IR正向夹具从host-owned content bytes生成准确handle、typed occurrence、request、decoder proposal与同request/attempt的committed event，text、tool JSON及大内容handle都可由下游读取；跨request/attempt、value/digest不等、ambient path、漏/重handle或插件直接伪造committed event全部失败。旧runtime-child夹具以schema-invalid与unreadable raw envelope直接生成逐索引quarantine，未解析V1也能到达审计终态，跨索引结果换挂失败。
- [ ] 两条供给平面及其不可互换条件写入 canonical，D8 与 App Server/ACP 归属无冲突。
- [ ] 三协议、event 状态机、所有 AuthSubject/ResourceScope/PolicySubject/RequestProfile/RouteSet/ComputeBoundary、rights/billing/data boundary 与 network 验证结果有唯一 schema。
- [ ] `ReceiptRef`及其全部可达数据字段经Compiler API递归验证为`readonly`，所有持久/authority输入只接受`DeepFrozenCommittedReceiptV1`；producer在JCS重算、schema验证、去除可变alias并递归`Object.freeze`后才提交。嵌套数组/对象/tuple/Map投影的编译期可写mutation、提交后alias mutation、反序列化后digest漂移和浅冻结绕过fixture全部失败，不能仅靠顶层`Readonly`宣称不可变。
- [ ] canonical 把 application auth 固定为严格判别联合：标准 OAuth 使用 access/refresh credential family，OpenRouter 官方登录使用 `api_key_pkce_exchange`，AWS named static profile 使用独立 SigV4 authority，声明式 signer 只允许受限 hash/HMAC/编码原语；四者不得互借 token、client、scope、credential lease 或 report。
- [ ] 所有会导致 secret read、browser launch、首字节、spawn、tool effect、费用或 owner 裁决的本地控制动作都先经过 `LocalControlSessionReceipt → AuthorizationProposalReceipt → AuthorizationDisclosureReceipt → UserDecisionReceipt` 单向链；Origin/Host/WebSocket Origin、OS principal、channel binding、CSRF session、一次性 nonce 与期限任一不符均拒绝，决策不得反向进入被批准 core 的摘要。
- [ ] `SecurityPolicyAuthorityBinding`、durable writer lease、可信时间、TUF anti-rollback 与全部发送/副作用 cursor 绑定同一不可回退 monotonic anchor；TUF authorization 保存从 root、timestamp、snapshot、top-level targets 到 ordered delegated targets 的完整 lineage。失去 anchor 连续性、旧高水位或任一中间 metadata 被替换时 fail-closed。
- [ ] `MonotonicAnchorPlatformReleaseProfileV1` 对 macOS arm64、Linux x64、Windows x64 都有真实 producer 与 enrollment TCK；持久模式只能使用 TPM2 NV 或 remote transparency witness。fresh profile先用不依赖设备high-watermark/强锚的`ReleasePinnedBootstrapWitnessAuthorizationReceipt`离线验证当前distribution manifest、pinned initial root和exact target bytes；注册cap固定为1，status query另有有限N次cap，并由同一durable boot budget累计扣除字节、墙钟和退避。query的offline/proxy、before/after-send cancel/deadline、response-loss、found/absent/still-unknown与预算耗尽全部有typed terminal；absent或耗尽不得重复registration。正式witness release还必须绑定当前production deployment与threshold set的`RemoteWitnessOperationalQualificationReceiptV1`：至少24小时、每member至少288个签名run、至少两个独立observer domain、逐threshold quorum、availability/P50/P95/P99实测、七类故障注入和raw signed corpus的独立deterministic replay；mock、仅SLO摘要、过期qualification或artifact/deployment不等均不得发布。无合格 backend、用户拒绝见证或首次离线安装时只能进入 boot-scoped 匿名本机 `plain_dialog`，重启清空。
- [ ] schema同时生成field-level `receipt-edge-manifest`与instance graph verifier：每个字段的owner kind/JSON Pointer/target kinds/cardinality/edge role/ordering rule完整且无通配；目标先提交、predecessor revision/epoch严格递进、跨domain只经opaque imported leaf。cursor模板的受约束类型级递归不能掩盖实例环；conformance、runtime、fallback、Execution、OAuth、metadata、GA任一同序互引、successor反向引用、未登记bare ref或嵌入payload都使 Phase 0 gate 非零。
- [ ] edge manifest 还必须表达复合排序键、跨边同值路径对、状态机投影、分支谓词、single-successor CAS authority 与 consumed/released terminal；generator 同时产出 TypeScript/Zod refinement、实例图 verifier、producer DAG 和 mutation fixture。只登记字段 kind 却无法证明 `(subject, writerEpoch, revision, ordinal)` 顺序、同一 decision 只消费一次或 ledger correction 唯一后继的 manifest 不得通过。
- [ ] Phase 0 orchestrator真实执行`check-ai-supply-contract-semantics.mjs`：strict schema/TypeScript语义编译必须使用锁定TypeScript 5.9.3且内外部`any` stub均为0；全部type alias逐constituent必填`never`审计、已签正向fixture、逐文件预期失败的负向fixture、edge-manifest完整性、producer DAG和实例无环验证缺一不可。`TypeContractCompileGateReceiptV20`同时证明diagnostics=0，手写/生成/总source与instantiation/RSS/wall绝对门及签名基线回退门全过；故意注入stub、type explosion、cycle、未登记bare pointer、不可构造联合、错状态lease和通用ref旁路时orchestrator自身必须非零。Phase 1只增加store/CAS运行实现，不能把Phase 0已声称的合同语义门后移。
- [ ] `AUTHORITY_LEASE_REGISTRY_V3`由真实TypeScript compiler AST census、alias-only闭合联合、branch-free policy与逐constituent exact required-kind policy唯一派生；每个可构造且持有cursor/listener/process/socket/broker/credential/funding/budget/Gate/effect权限的声明都必须是登记的非空`AuthorityInventoryBearingLease`或纯alias。Execution start与recovery分别覆盖3种stdio和4种HTTP connection-mode constituent；新增租约、把最终发送bundle或hosted-tool effect permit改回非租约authority、空inventory、漏branch、漏kind、漏intent前closure、漏expiry/restart recovery、漏in-flight→terminal映射、proof-only持权和非`LeaseReceipt`持权逃逸逐类使门非零。每个registry constituent还生成准确after-intent action-intent类型、domain terminal类型和私有producer；restart sweep只能消费`RegisteredAfterIntentDomainTerminalReceiptV5<P>`，裸`ReceiptRef`、另一registry row的terminal或事后通用包装均不可构造。重启admission在`AuthorityLeaseRestartRecoverySweepReceiptV3`精确覆盖全部非终态租约前保持关闭。
- [ ] 物理发送producer DAG固定为descriptor-ready→final-lease CAS→credentialized envelope→hosted-tool bundle→send intent；descriptor与公共SDK对象不能含final lease、最终hosted authorization或bundle反向digest，envelope不能含bundle digest。bundle只拥有一次最终network send authority，side-effect Gate lease只拥有Gate authority，accepted Gate原子关闭准确Gate authority后另生成登记的single-use `HostedToolEffectPermitLeaseReceipt`；三者不得重复申领或相互代持。每个预签发Gate恰好进入四类终态之一：allow后permit再以committed/not-committed/delivery-unknown关闭准确effect authority，deny关闭Gate且零permit/effect，未调用关闭unused Gate；delivery-unknown永久禁自动重试并保留reconciliation hold。零occurrence、只读occurrence和非空side-effect正例都可构造；descriptor abort与final lease竞争同一revision并逐项关闭其非空owned-authority inventory。任一反向边、先materialize secret、空授权冒充非空、跨attempt/member authorization、Gate/effect outcome换挂、同permit二次effect、非租约effect permit或未关闭descriptor/bundle/Gate/effect lease的mutation均非零。
- [ ] 语义门直接编译发现三模式、Execution五类surface与loopback/remote子模式、四槽capability/funding、unknown-turn reconciliation和公平count/share的成对反拼接断言；每一合法分支另有正向可达fixture，防止用全部`never`制造假绿。
- [ ] 09 的 billing schema 将 CandidateBilling、conformance/runtime Billing、ConformanceAuthorization、RuntimeSpendAuthorization、持久预算与 ledger 统一到 canonical `BillingUnit`/`BillingLimitVector`；`ConformanceBillingMatchReceipt` 只保存 typed source refs 和固定 derivation algorithm，严格拒绝金额 summary 副本，由 refinement 从 refs 重算逐 member 数值链与 ingress aggregate；按 operation 的 `OperationBillingClosureReceipt` 连接准确 ComputePolicyBinding/runtime Billing，不可激活 anomaly 记录漂移。不存在顶层 `currency + amount`、跨单位求和或隐式 FX 路径。
- [ ] canonical 的 schema decision table 明确 inference policy 缺 route/slot、execution policy 缺 surface、auth 缺稳定 subject、connection 缺 transport scope、compute 缺独立 subject/scope、`/`/HOME/通配符范围、symlink 越界、重复/冲突 binding、账号漂移、跨 scope 换挂、多 route 复用 endpoint receipt 全部非法；实际 `superRefine` 与负例在 Phase 1 验收。
- [ ] canonical 用不可执行的规范示例和 producer DAG 分别描述首个 payg direct/gateway、`chat→tool_roundtrip`、两成员 RouteSet、runtime route fence、Execution session/tool/billing 与 local managed/unmanaged 流；每个例子明确列出应由 Phase 1 schema、Phase 2 protocol/runtime 和 Phase 3 policy/activation 哪条真实测试验收。Phase 0 不勾选 fake provider 激活、运行时 dispatch 或 verifier 已通过。
- [ ] canonical 定义 direct/gateway/bridge 的 transport/compute/credential-egress/route-fence 换挂反例矩阵，以及 `route-set-v1` 六项数值边界；本阶段只审查 schema shape、refinement 规则和阶段映射。实际 Zod 负例移到 Phase 1，fake/live runtime、receipt graph 和 activation 负例移到 Phase 3。
- [ ] `docs/08-module-design.md`、D8、09 与 `docs/modules/c-control-bridge.md` C2/C5 对 Execution Agent 归属、Gate 和 proof 无冲突；门禁显式检查这些真实文件，不因行内代码被链接检查器屏蔽而漏检。
- [ ] `scripts/check-ai-supply-canonical-consistency.test.mjs` 使用隔离 fixture，分别只漂移 08、D8、09、C2、C5 的 placement、dispatch gate、per-tool gate、proof owner 或 state owner；每个单文件漂移都让专用脚本非零，五处相同的 owner 已裁决 tuple 才通过。测试还证明 `undecided`、缺字段、重复 marker、错 schema anchor 与不存在 section 会红。
- [ ] 纯本地 inference、云 API、gateway route drift、本地 inference + 远程 Execution Agent 四种 DataBoundary 文案真值表写入 canonical；任一 data-egress subject 远程或 unknown 时都不能显示本机数据局部性文案；全本机时也只显示“已限制已知数据出口”并列设备级残余，不显示绝对“不会留下副本”。
- [ ] DataBoundary canonical 使用 legal-entity receipt 与 non-empty `DataRegionRef` tuple，并定义 `CN`/`cn`/自由文本同义词、空数组、provider-defined→ISO 无证据映射、global/unknown→具体地区、数组乱序/重复和跨 member 交换任一列的预期拒绝；实际 schema/refinement fixture 映射到 Phase 1/3。
- [ ] 明确 legacy config 迁移与 rollback，不破坏当前 active config。
- [ ] 明确 v31+ additive migration、activationId + 不可变 ActivationManifest、外部 fencing token、activation barrier/全资源 CAS、逐 dispatch hard-stop 复核、孤儿 secret 清理、回滚窗口与上一正式版真实降级验收。
- [ ] `contracts → connector-sdk → connector-runtime/connectors-builtin → daemon` 的单向依赖、禁止层、公共 API 稳定等级和协议兼容窗口写入 ADR；明确 Phase 1 要创建的机械 import graph 门和红/绿 fixture，Phase 0 不宣称尚不存在的门已通过。console 不直接依赖具体 connector 实现。
- [ ] `ActiveSupplySnapshot` 的编译输入、原子发布、generation、失效与回收规则有唯一合同；请求热路径不读取 registry、discovery cache、第三方 manifest 或远程 catalog。
- [ ] `ResourceBudgetProfile v1` 的 detector/plugin/frame/CPU/RSS/process/restart/queue 数字、`TypeContractCompileBudgetV1`的source/diagnostic/stub/instantiation/RSS/wall绝对与回退门，以及 `BenchmarkWorkload v1` 的 fixture/seed/采样/硬件口径有唯一合同；macOS arm64、Linux x64、Windows x64 是首版 GA release matrix，未提供真实报告的平台不标正式支持。
- [ ] `catalog.tuf` 与 `policy.tuf` 使用不同 root/threshold/签名权限；`policy.tuf` 至少委派五个路径隔离 role。root 更新必须从预置 root 或逐步双阈值 rotation chain开始，每一步保存旧/新 root 的完整 metadata evidence；每个 repository+role 独立保存 version/hash high-watermark，不能用一个全局最大值掩盖局部 rollback。Phase 0 只冻结 metadata/receipt 形状与 root-rotation/freeze/role-rollback/mix-and-match/时钟/archive/offline 测试向量；真实 verifier/receipt 行为门属于 Phase 3。
- [ ] `ReferenceGradeProfileV3`严格消费同digest的81行`REFERENCE_REQUIREMENTS_V3`、`ReferenceRequirementsDerivationReceiptV3`与`ReferenceRunSubjectDerivationReceiptV4`；deriver的count、排序键、复合subject、entry/journey投影、recipe字段来源和编译期critical-key/protocol/recipe断言全部通过。fresh row以`deterministic_fixture`物化准确platform×`zh-CN/en-US/ar-SA`×`not_enrolled/ready`×该row全部真实账户起点，并另跑不计入真实locale数的`en-XA` pseudo suite；`existing_connection_migration_only` row只物化`existing_connection_present`正向迁移run和唯一`not_applicable_no_existing_connection` absence run，绝不进入fresh账户笛卡尔集。两类run分别覆盖其合法外部任务、手填字段上限、leave-return焦点恢复和runtime states；远程真实账号另由bounded live set-cover计划连续两cycle验证，不能把确定性fixture解释成全量真实账号调用。pass只存在于相应正向ready或migration disposition终态；profile列举的全部readiness、UX、anchor、账户状态/graph entry、L0、rights、protocol/surface、recipe与custom auth mutation均使gate非零。只有完整`completed_pass` requirement→run→journey→entry→ecosystem+mutation链可发布。
- [ ] `PublishedProductProtocolClaimSetReceiptV6`与77个固定requirement key为排序后精确双射；`PublishedSupportClaimSetReceiptV6`还与baseline中全部owner append-only row逐key双射且零collision/shadow。每个claim的product/edition/realm/protocol/surface/auth/wire/funding/live qualification/maturity/limitation和distribution都由私有producer从同一row与已通过证据闭包生成。增加未列协议、漏owner row、把inventory写成supported、opaque route写成exact、换auth/realm/funding/旧distribution或让四类产物使用不同claim set的mutation全部阻断发布。
- [ ] `ReferenceRunSubjectDerivationReceiptV4`按`onboardingAvailability`判别展开：fresh requirement使用准确platform scope×`zh-CN/en-US/ar-SA`×`not_enrolled/ready`×全部`requiredStartingAccountStates`，`en-XA`在独立pseudo集合展开；migration-only requirement仅使用既有连接正向subject和无既有连接absence subject。每个合法起点强绑定同一journey graph里的唯一entry step、完整有序路径和compiler-selected state assertion plan。运行时再由不可伪造的assertion evidence set把每个required state逐键绑定为`observes_precondition | causes_transition | proves_postcondition`及其原始证据，负向前置观察不得伪装成恢复动作产出的成功状态。漏账户状态、漏migration absence、为Hunyuan生成fresh CTA、漏state assertion、错polarity/source、把本地runtime伪装为`signed_in_ready`、账户状态换挂错误entry、oMLX借Linux报告或pseudo locale用通用账户起点都使exact-set gate非零。
- [ ] field-specific extractor 的统一 field/value/metadata-lineage、可信时间 fold、release-bundled passive probe core+detached binding、custom eligibility/attested-private-rights/两段 unknown-metering consent 的 receipt 形状和拒绝矩阵进入 canonical；self-attestation、signed catalog 新 probe、假时钟、后台生成 probe 和 custom 自动推荐都不是可接受分支。
- [ ] canonical 只使用 `ConnectorReleaseMaturity`、`PublicApiStability`、协议 conformance、运行健康、Rights、`ConnectionReadiness` 与 `SolutionReadiness` 七个正交词表；未来 UI badge 必须追溯到受信 TCK payload/attestation，迁移器拒绝把成熟度、兼容性和来源揉成单个旧字段；Phase 0 不宣称尚未生成的报告或 UI 已通过。
- [ ] 每个阶段已有验收目标和真实门禁命令。
- [ ] 官方文档事实、开源 commit、rights/billing/data 裁决都有 `evidence-lock.json` schema 与过期策略；修改网页内容、只换 URL 未换 digest、同 URL 跨 region/product 复用和过期证据均不能生成新 policy receipt。
- [ ] owner 对 §14 的十项决策签字并生成 schema-valid batch/decision record；preflight 在开工和收口得到同一 digest。未签项保持 inventory/禁用，不由施工方代拍板。

门禁：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 0 --json
```

该 Node gate 是一个受测、无 shell 拼接的 fail-fast orchestrator：用`spawn`的argv数组逐步执行且`shell=false`，依次验证真实 C 域文件、禁止 legacy path、运行canonical consistency、strict schema/TypeScript语义编译及compile budget、required-`never`逐constituent审计、正向可达性fixture、edge-manifest、producer DAG、实例无环与mutation自测，再检查doc links和emoji，并为每步输出命令ID、开始/结束时间、exit code、stdout/stderr digest和跳过原因；任一步非零即自身非零且后继标为`not_run_due_to_predecessor_failure`。它的自测必须用“第一步失败、模拟最后一步本可成功”证明不能被末项exit 0掩盖，并逐个注入stub、budget overflow、cycle、bare ref和不可构造union。CI只调用这一个命令，不能复制子命令成松散shell块。

收口：2 个互补 subagent 独立评审 + 1 次 Codex 对抗评审 + triage/journal；一致性报告必须单独对账 08 索引、D8、09 与 C2/C5。回修且无未处置 A/B 级后才开 Phase 1。owner 若接受 B，必须生成具名 waiver、自动降低对应 matrix maturity 并撤销 reference-grade/GA 声明，不能仍算本门通过。

### Phase 1：安全合同、存储与 inactive 双读

目标：先消除 key 误投、端点碰撞、secret 隔离和 SSRF 风险；本阶段不切 active，不要求尚未存在的 rights/capability receipt。

实施项：

- 在 `@saydo/contracts` 落 connection/binding 判别联合、AuthSubject/ResourceScope/PolicySubject、immutable receipt envelope 与 migration schema。
- 建立 `@saydo/connector-sdk`、`@saydo/connector-runtime`、`@saydo/connector-tck` 最小包骨架和 API Extractor/依赖方向门；本阶段只落已批准的接口和测试宿主，不提前实现 provider。
- 引入 `con_` ULID、Inference/Execution EndpointIdentity、OAuth 判别型 flow-start/client-auth/durable exchange cursor/PKCE-device-refresh credential transition、ProductEligibility/custom private rights、逐 hop/layer credential-component EndpointCredentialEgress、LocalInference/ExecutionPeer、BinaryArtifactIdentity、per-connector/version SecretRef、唯一安全 dialer 和严格 URL/header/Base URL resolution policy。
- 建 daemon/secret broker 隔离证明；Activation/Execution session admission 冻结完整 application/proxy/mTLS component 与 broker ACL set，stdio 用 no-connector-secret proof；仅清空 Execution Agent 环境变量不算证明。
- 增加 v31+ additive storage、activation journal 和 inactive dual-read；legacy `providers.api` 只生成草稿，不切换、不双写 active。现有`~/.saydo/runtime/children/*.json`与新SQLite runtime-operation registry按§4.16.1五态迁移，复用同一operation identity、writer epoch和recovery sweep，不把配置迁移成功误当子进程authority已经迁移。
- 新增 `lint:all` 并覆盖 `packages/`、`e2e/`、`scripts/`，先放入可删除的故意违规 fixture 证明门会红，再移除 fixture 证明会绿。
- 移除 unknown endpoint → `OPENROUTER_API_KEY` 兜底；移除 hostname identity。
- secret audit 只留 connector ID、secret fingerprint 和 action，不留 URL query/key。
- redirect、DNS rebinding、metadata/link-local、跨域 credential 泄漏测试。
- 为未来第三方 code plugin 落 framed RPC 握手、协议版本、空环境、临时 HOME、资源上限和崩溃回收测试宿主；首发仍不加载任意第三方代码。

验收标准：

- [ ] 两个未知 endpoint 保存不同 key，任一请求都只收到自己的 key。
- [ ] `localhost:11434`、`:1234`、`:8000` 与同 host 不同 path 不碰撞。
- [ ] 同 host/path 的 `openai_chat_completions`、ACP 与 agent HTTP 分别产生不同 plane/wire identity、连接池与 hard-stop key；Execution endpoint 不能伪填 inference protocol。
- [ ] 自定义 URL 中任何 query 默认被拒；受限 `RequestProfile` 中参数值变化会生成不同 identity，参数重排会规范为同一 digest，重复参数被拒。
- [ ] `ApiBaseProfile`只能由私有normalizer生成安全品牌，按 RFC 3986 directory semantics 覆盖空 path、尾斜杠、已有 `/v1`、反向代理前缀与 Chat/Responses/Messages；普通`string`、leading slash、dot segment、encoded separator/双重编码、authority replacement和静默删加 `/v1` 全部拒绝。UI 显示最终 method+URL 预览。三协议分别运行`none/bearer/x-api-key/custom secret header`，并与`none/mTLS`做正交deterministic matrix；每格的path、认证注入位置、credential recipient、proxy可见性和secret version都必须由同一resolved receipt证明，任一协议替另一协议选auth、跨endpoint复用receipt或漏credential component都在secret read/首字节前失败。
- [ ] connection auth、`InferenceEndpointIdentity`、transport resource scope 与 `InferenceResourceSubject.transport` 精确相等；实际 compute principal/credential/scope 只能来自独立 `ComputeSubject`，gateway/bridge 无法证明时保持 inventory。
- [ ] ProductEligibility 的 official eligible 与精确 `user_or_admin_attested_custom` 都只允许本机录入、不允许 egress；custom 明示非官方/TTL，credential principal 形成后只有 exact owner/admin private-use receipt可继续，且它不冒充厂商/法律 Rights。缺该 receipt、跨 endpoint/product/principal/use/distribution 换挂或试图复用消费者订阅时均零 secret read/零 packet；custom unknown metering只允许两段逐次 consent且不推荐。
- [ ] 每个 endpoint 都有恰好一个判别型 credential-egress decision：含 credential 必须是 EndpointCredentialEgress，`auth=none` 必须是绑定当前 endpoint/AuthSubject/generation 的 NoCredentialEgressProof；空集合、两种并存或把 no-credential proof 挂到 Bearer route 均拒绝。
- [ ] OAuth PKCE 与 device flow-start 不是同一形状：PKCE 在打开浏览器前冻结 session/state/redirect/S256 challenge/verifier handle/request；device 在首个 authorization 字节前冻结 request 与 polling profile。public/confidential client及 none/client-secret/private-key-JWT/mTLS client auth严格判别。exchange cursor 要求 terminal 后才可下一 poll/refresh；refresh transition绑定 predecessor grant/family/旧新 access+refresh version/subject/scope/aud/azp/cnf 和并发 winner。callback hijack、poll sibling、slow-down 违规、refresh reuse/账号换挂、client auth/mTLS alias漂移、code/grant replay、issuer mix-up 与跨 connector 换挂全部拒绝。
- [ ] native public OAuth client只能使用 `none_public`；secret、private-key JWT或mTLS client auth只有经部署证明的 server-side confidential client或不可提取硬件 authority可用。PKCE loopback callback必须先在 held listener/socket上原子提交 callback cursor/lease/result，校验同一 flow/state/redirect/code/peer/session/nonce后才能 exchange；恶意网页抢回调、端口重绑、重复 callback与事后补 receipt均零 token request。
- [ ] OpenRouter `api_key_pkce_exchange`有独立 start/callback/exchange与跨flow `ApiKeyCredentialFamilyCursorReceipt`，不要求或伪造标准 OAuth client ID、scope、access token、refresh token。exchange前取得family rotation lease；成功key commit、family winner revision、active key version及旧key retire/revoke disposition原子提交，两个daemon/两条flow最多一个winner。possibly-created进入稳定provider exchange identity绑定的recovery cursor，反复查询`adopted_key | authoritatively_absent | revoked_orphan | still_unknown`，未知期间禁止新rotation；每次物理请求只消费当前family ready cursor签发的key lease。把结果挂入OAuth token family、借用标准OAuth报告、loser key不处置、response loss后再创建key或旧key重放均拒绝。
- [ ] 标准 PKCE、device flow 与 API-key PKCE 的 browser/device start 都在敏感动作前完成各自 local proposal→disclosure→accepted decision→single-use consumption；start、browser callback/device authorization、exchange/poll、provider rejection、state/origin mismatch、用户取消、hard stop、deadline 与 `delivery_unknown` 都有严格 terminal 和递增 revision。没有 accepted decision、decision 重放、browser 已打开后补 receipt、callback 已收字节后补 state 或任一未 terminal successor 都由 schema、reference monitor 和 kill-point fixture 三重拒绝。
- [ ] 三类浏览器/设备认证与标准 OAuth refresh 的每个 cursor 都使用状态专属判别联合，而非可选字段加宽状态字符串：lease 只能消费准确 ready/waiting cursor并原子产生 in-flight，terminal只能消费该 in-flight，成功只能进入 credential-commit-pending，commit后才到 terminal/ready family。对每个状态自动生成“从所有其他 sibling/terminal状态取 lease或commit”的负类型 fixture，TypeScript、Zod与持久 CAS 三层都必须拒绝。
- [ ] OAuth family按初始token response严格分`refreshable`与`access_only`：无refresh token的成功响应可形成access-only cursor并在access not-after内签发lease，但任何refresh-family lease对它都是不可构造；含refresh token才进入refreshable ready。`authorization_pending/slow_down`只接受device-poll lease，code/refresh收到同类body必须形成`unexpected_poll_response`并关闭准确exchange/family。OAuth、API-key PKCE与workload issuance每个物理请求都具备独立`lease(no send authority) → send intent → terminal`；只有无intent的权威not-sent才保留refresh并要求新lease，已有intent无terminal或after-send/unknown均不得重放。两个daemon同时refresh只允许一个winner。
- [ ] local-control accepted decision 的消费游标严格为 `available → consumption_in_flight → consumed`；lease只能来自available，commit必须等于in-flight的last lease并绑定最终动作core。任何已消费、in-flight、旧revision、跨proposal/disclosure/action或同decision双writer sibling都不能取得第二个敏感动作前驱。
- [ ] workload identity的逻辑issuance cursor与物理请求序列分离；`credentialed` profile在类型/Zod/CAS三层排除AWS instance identity、Google metadata identity和Azure managed identity，后三者只能携带exact-empty credential集合与source admission。AWS IMDSv2必须是token PUT→credential GET两个各自有lease/send-intent/terminal的有界step，GET强绑PUT success，Google/Azure各自单step。任一step after-send/unknown都不能伪装整段not-sent或自动重放；只有最终step success可产生temporary credential。
- [ ] 自定义 Base URL 的非秘密常量 header 只能经 `custom-public-header-v1` allowlist 和逐 header local proposal/disclosure/decision/consumption 加入 `RequestProfile`；Authorization、Proxy-Authorization、Cookie、签名/转发身份、Host、hop-by-hop、控制字符、confusable credential 名与疑似 secret value一律拒绝。非标准私有credential header只走`custom_secret_header`：规范化名称经过reserved/confusable/collision policy，secret仅以broker handle/version存在，并绑定endpoint/RequestProfile/principal/recipient/proxy可见性/ACL/egress/decision/TTL/generation。`X-Auth-Token`与无同名preset component的`api-key`正例可达；Authorization/Cookie/Proxy/Forwarded/hop-by-hop、preset+custom同名覆盖、大小写重复、public+secret碰撞、redirect和proxy泄漏均在secret read/首字节前拒绝。header 名值、endpoint、generation 或授权过期后必须重新确认，任何 header 不能旁路 secret broker。
- [ ] 每个 durable writer、cursor、lease、terminal与 credential transition都绑定 storage fencing epoch和不可回退 monotonic anchor；旧 daemon、存储回滚、旧 snapshot或旧 lease复活均无法赢得 CAS。所有真正发送的物理动作先持久化 send intent，再写首字节；崩溃后无法证明未发送时只进入 `delivery_unknown`并保留最坏账务，不得自动重放。
- [ ] 本地 UI/API授权端点用跨平台 fixture证明同源 Origin/Host/WebSocket Origin、OS principal、channel binding、短期 CSRF和一次性 action nonce；DNS rebinding、CWSH、同 UID恶意进程、旧 render和旧 nonce在任何 secret read/browser launch/network/spawn/effect前均失败。
- [ ] HTTPS proxy + Basic/private CA 后 CONNECT 到另一 SNI/CA 的 origin，再用 mTLS+Bearer 的组合 fixture证明每个 hop/layer的 DNS/socket/TLS/terminator与三份 credential component/egress/ACL 无漏无重；prepared descriptor 携带完整排序集合。把 proxy secret 发给 origin、应用 key发给 proxy、TLS identity换 layer/account、漏一份 egress、no-credential 与非空集合并存均零字节；每层公共 leaf正常续期和 trust/pin 改变分别得到正确 continue/hard-stop。
- [ ] remote HTTP 默认拒绝；loopback HTTP 可用；LAN HTTP 需显式确认。
- [ ] redirect 到不同 host/scheme/port 时 Authorization 不发送。
- [ ] 现有用户升级后仍只用旧 active config；本 Phase 不存在新 connector activation 路径。
- [ ] 自动阶段不执行 PATH 二进制、不打开第三方 session/token/history；sentinel 能证明。
- [ ] secret broker/Keychain ACL 无法在目标平台证明时，远程 connector 保持不可激活，测试不以 `0600` 冒充隔离。
- [ ] 混合 A/AAAA、CNAME、IPv4-mapped、NAT64、DNS rebinding 和代理环境变量全走 fail-closed fixture。
- [ ] v4-era HOME fixture 可升级生成 inactive 草稿；中途 kill 后幂等恢复，无 orphan secret。
- [ ] `runtime-child-registry-v1-to-v2`覆盖JSON-only、shadow-write、reconcile、dual-write、SQLite-authoritative和sqlite-only全部状态；在每次JSON temp write/rename/fsync、SQLite transaction/journal commit、spawn permit、establish、terminal、release和cutover边界kill，重启后从两store精确并集收敛。缺边、冲突、PID复用、birth/command-token/epoch不等只quarantine且零signal/零delete；上一正式版二进制在rollback window内真实spawn/reap/降级通过后才能清理JSON投影。
- [ ] Phase 0 decision table 的 Zod/superRefine 负例全部落地：缺 route/slot/surface/subject/scope、空或混装 processing regions、`/`/HOME/通配符、symlink 越界、重复 binding/operation、跨 scope/receipt 换挂、RouteSet 六项超限逐个非零。本 Phase 只验 schema/store，不伪称 runtime activation 已通过。
- [ ] BinaryArtifactIdentity 用 no-follow handle 或 immutable staging 消除 verify→spawn TOCTOU；测试在线程间替换 PATH/原路径，spawned image 仍等于已验证 content+file identity，否则零启动。
- [ ] package boundary fixture 证明 connector 无法 import daemon storage、secret 实体、HTTP client 或 UI；所有网络和凭据访问只能经宿主 capability handle。
- [ ] plugin test process hang/crash/超大帧/协议降级/伪造 credential handle 均被单独终止，不影响 daemon，也不会得到宿主环境变量或其他 connector secret。
- [ ] fresh external protocol 分别使用 `ext:inference:publisher.name@major` 与 `ext:execution:publisher.name@major`，并由 plane/connector kind/artifact/profile/TCK binding 接入，不修改 daemon core switch、builtin protocol union 或 UI provider 分支；把 Execution adapter/TCK 换挂到 inference、namespace confusable、缺 TCK 和 major 不兼容均拒绝。
- [ ] `pnpm check:connector-boundaries` 由真实 AST/module graph 检查 SDK/runtime/TCK/builtins/daemon/console 全部允许边；先加入每一种禁边 fixture 证明非零，再移除后证明通过。`connector-tck` 是唯一 runner，runtime 只能 import report contract/verifier，生产依赖图中不存在 TCK runner。

定向门禁：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 1 --json
```

Phase 末：`just ci`。

### Phase 1A：平台安全产品与 monotonic anchor/witness 生产化

目标：把文中的sandbox、secret broker、process containment、anti-rollback anchor和remote witness从合同名词变成可构建、可安装、可升级、可回滚、可值守的独立产品面。Phase 1A与Phase 1合同评审可并行准备，但任何远程credential、付费发送、Execution副作用、持久预算或正式`review_ready`路径都必须等本Phase通过后才可启用；未通过时只保留boot-scoped匿名本机`plain_dialog`降级。

交付边界固定如下，不能散落为daemon中的平台条件分支：

- `packages/platform-security`只暴露host-neutral、fail-closed的opaque handle API、capability negotiation、attestation verifier与deny reason；不得暴露原始secret、任意path/socket/process handle或“平台支持”布尔捷径。
- `native/platform-security/darwin`、`linux`、`windows`分别构建并签名最小权限helper。macOS候选backend必须以最终分发形态验证App Sandbox/seatbelt、Keychain ACL、audit token与process identity；Linux验证user/mount/network namespace、seccomp、Landlock、cgroup、pidfd与TPM2可选producer；Windows验证AppContainer或等价restricted token、Job Object、handle allowlist、DPAPI/Credential Manager ACL与TPM2可选producer。列出技术名不等于通过，只有最终安装包direct-syscall TCK和attestation能授予对应capability。
- `services/anchor-witness`实现append/read/inclusion/consistency、threshold coordinator、member独立签名、anti-equivocation和continuity API；`infra/anchor-witness/{global,china-mainland,enterprise}`持有IaC、区域隔离、DNS/TLS、KMS/HSM key ceremony、threshold member trust-domain分离、日志/指标/告警、容量与成本预算。应用永远不向witness发送provider credential、prompt、response或用户文件。
- `ops/anchor-witness`提供bootstrap、member加入/撤销、threshold rotation、key compromise、region outage、split-brain、proxy/offline、backup restore、连续性丢失与sunset runbook；所有runbook都有演练时间、operator、原始证据digest和回滚判据。
- `installers/platform-security`按macOS pkg/notarization、Linux deb/rpm/tarball、Windows MSI签名链交付helper、policy和最小服务账户；安装、升级、降级、卸载、权限扩大、helper缺失/损坏以及daemon/helper版本握手都走明确状态机。卸载必须先撤销lease和credential ACL，不能留下孤儿高权限服务。
- `release-evidence/platform-security`保存三平台最终安装包的SBOM/provenance/signature、direct-syscall corpus、anchor producer、升级/降级、重启/休眠/旧snapshot、helper crash/hang与rollback报告；`release-evidence/anchor-witness`保存production deployment、threshold set、24小时qualification和独立replay，不把staging或mock结果冒充生产证据。

责任边界不是口头“平台组负责”：项目owner对是否发布负责；platform-security maintainer对三个native helper及installer负责；witness operator对IaC、SLO、on-call、key ceremony和data-boundary负责；release engineering对最终分发物黑盒qualification和证据闭包负责；独立security reviewer只读复核威胁模型、权限清单和故障注入。任何角色缺席都使本Phase保持未通过，不能由daemon实现者自签替代。

验收标准：

- [ ] fresh install、上一版升级、当前版降级、卸载重装、helper版本不匹配、签名损坏、权限被管理员收窄、daemon crash、helper crash/hang与系统休眠恢复在三平台均有真实安装包报告；失败只撤销相关capability，不把整机置于不可恢复状态。
- [ ] 每个平台直接从最终被测helper尝试open/connect/exec/credential-store/process-inspection/IPC/inherited-handle逃逸；任一声明deny的syscall实际成功，或测试只经过mock/SDK wrapper，正式capability立即撤销。
- [ ] 本机anchor producer逐平台验证单调性、writer fencing、旧SQLite/HOME/VM snapshot恢复、双daemon和counter exhaustion；普通文件、SQLite、wall clock、Keychain/DPAPI/libsecret secret都不能冒充防回滚计数器。
- [ ] global、中国大陆和enterprise realm各自有清晰operator、endpoint、processing region、retention、subprocessor、proxy、threshold与撤销政策；首次网络联系前展示准确披露并消费single-use decision，拒绝时保持功能受限但可解释。
- [ ] production witness对每个member完成至少24小时、至少288个签名run、至少两个独立observer trust domain、逐threshold quorum和七类故障注入；raw signed corpus由独立evaluator重放，availability至少999 permille、threshold P95不超过2秒、注入零漏检。
- [ ] threshold member密钥轮换、一个member被攻破、一个region断网、coordinator与observer重启、旧consistency proof、冲突statement和恢复旧IaC state都得到唯一fail-closed或安全恢复结果；没有“人工看日志后当作通过”的分支。
- [ ] installer和helper的权限manifest、witness IaC plan、网络endpoint、月度基础成本上限、告警预算、密钥/证书到期与值班升级路径全部进入签名release manifest；超成本或无人值守时不自动放宽threshold。
- [ ] Phase 1A通过前，远程provider、Execution、persistent spend、OAuth credential commit和`review_ready`生产feature flag均机械保持关闭；匿名本机降级不得持久化高价值receipt或在重启后继承authority。

定向门禁只通过无shell拼接的统一orchestrator执行：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 1A --json
```

Phase末：三平台最终安装包、witness production deployment与上述证据闭包全部进入一次独立release-readiness评审；本Phase不以`just ci`代替24小时和真实平台资格验证。

### Phase 2：三核心协议与流式归一

目标：真正支持 OpenAI Chat、OpenAI Responses、Anthropic Messages，而不是只改表单文案。

实施项：

- 将 `openaiCompat.ts` 拆成 protocol adapters 和统一 event normalizer。
- 建立可保真 `InferenceRequest/InferenceEvent` IR、逐 occurrence `AdaptationPlan` 与响应侧 `DecodingPlan/ResponseLossReceipt`；不支持的语义必须在发送前得到 `exact/lossy_forbidden/lossy_confirmed` 结论，不能静默丢 tools、reasoning、JSON Schema、citation/annotation/refusal、server-hosted tool 或多模态内容。
- 实现控制面 `ActiveSupplySnapshotCompiler` 和数据面固定 dispatch pipeline。本阶段只用 fake receipts、隔离测试 ledger 与 shadow compiler 验证完整 pipeline，不写生产 active pointer、不替换 legacy live dispatch；生产 cutover 到 Phase 3 首个完整 Rights/Billing/DataBoundary/Funding/Activation 垂直切片。pipeline 仍按正式合同只读取一次 snapshot 并持有 admission handle，避免 Phase 3 另写一条路径。
- 实现 SSE parser、取消、timeout、retry-after、usage、request ID、model evidence。
- 实现 tools/tool results、JSON Schema、reasoning 与兼容性降级标记。
- setup minimal test 根据 connector protocol 调用，不再固定 `/chat/completions`。
- 在本阶段建立 deterministic conformance harness、fake providers 和逐事件 golden fixture；Phase 8 只扩真实版本矩阵，不再发明判据。
- 发布 protocol/capability TCK 的 `v1alpha1` profile，加入分片随机化、parser property/fuzz、状态机 model-based、adapter mutation 与背压测试；报告包含实现/协议/模型/fixture digest 和环境。
- 建立 `scripts/bench-ai-dispatch.mjs`，分别测 snapshot lookup、adapt、serialize、首流事件归一、取消传播、event-loop delay、每流缓冲和 RSS；保留 raw JSON 基线用于回归比较。

验收标准：

- [ ] 三协议的非流式/流式文本、工具一来一回、structured output、reasoning、citation/annotation、refusal/safety block、受支持 server-hosted tool item、usage 全有 fixture；无法逐次 Gate 的 hosted side effect 在请求前拒绝。
- [ ] 401/403/404/405/429/5xx、malformed SSE、半包 UTF-8、取消、超时均分因。
- [ ] observed model 明确不符时 fail-closed；字段缺失必须生成 `ObservedModelEvidence.absent`，只允许 `unverified` 普通对话并禁止 evaluator/自动迁移/静默 fallback，不能伪填 requested model，也不能一刀切拒绝所有 direct compatible 服务。错误优先级不被正文 parse 覆盖。
- [ ] provider 不支持 strict schema 时不会伪装支持；推荐器不把它放进 evaluator。
- [ ] `CapabilityReceipt`从raw occurrence和observed model逐项派生conversation/tools、reasoning强度、strict structured output、modalities、token limits、usage/cache与marginal-spend class；`RequiredCapabilityForSlot`对dialog/thinking/cheap/evaluator分别给出最小谓词，evaluator另需与前三槽独立的model/artifact/route证据。plain-dialog-only、无reasoning、无成本资格或非strict schema能力跨槽换挂的类型、schema与mutation fixture全部拒绝；四种满足条件的正例分别可构造。
- [ ] Anthropic key 从不被发送到 `/chat/completions`；OpenAI Responses 不经 Chat adapter。
- [ ] tool arguments 按逐字节/半 UTF-8 分片仍可无损拼装；重复、乱序、未知事件、半流断开和 cancel 有唯一 terminal。
- [ ] 一轮 `chat → tool_roundtrip` 在两个 fake compiled operation program 与隔离 ledger handle 下完成 wire/event/state-machine 正例；缺项、重复 operation 或拿 chat handle 执行 tool result continuation 均在写出首字节前拒绝。真实 policy/费用/Activation 闭包的 production 正例属于 Phase 3。
- [ ] 收到任何响应字节后默认不自动重试或SSE重连，也不发送 `Last-Event-ID`；有完整resume token、去重、费用和同一lease证明的provider必须使用独立namespaced profile与fixture，普通幂等key不够。
- [ ] `exact/alias_verified/unverified` 模型身份按 §4.3 限制使用，不因缺 `model` 字段把普通兼容服务一刀切拒绝。
- [ ] 同一个 IR fixture 经三协议 adapter 后，不可表达字段都有确定 adaptation loss；随机字段顺序和任意合法 SSE 分片不改变规范化事件序列与 terminal。
- [ ] TCK CLI 与 library 对相同 connector/profile/fixture 生成相同 `ConformanceResultCore` digest；不同 startedAt/OS/runner invocation 只改变各自 `ConformanceRunPayload`。把时间或 environment 混入 deterministic core、漏签 SDK/TCK/connector/profile/fixture digest、或让 runtime 复制 runner 的 fixture 均失败。
- [ ] response host 先建立 raw frame digest 与逐 field `RawResponseOccurrence`，再验 DecodingPlan 一一覆盖；删除 reasoning signature、usage correction、refusal、citation、tool identity、terminal 或中间重复 occurrence 的 mutation 均只能产生 fatal/明确 disclosed loss，不能生成成功 ConformanceResult。fake Activation 闭包引用同一 response/extractor profile，runtime terminal 也生成本 attempt 的 loss receipt。
- [ ] 恶意第三方 decoder 对 live bytes 伪报 observed-model/effective-route/usage/processing-region/data-processor/billing-component/terminal 的 fixture 不会成为权威来源；七种字段共用唯一 enum，每份 authority extraction 精确绑定 raw path/occurrence、typed canonical value/value digest、target subject 与完整 TUF metadata lineage。跨 field/value/product/profile/raw-path/metadata-generation 换挂均失败；缺权威时分别降级或逐 component `charge_unknown`。
- [ ] hosted web search 的每个 IR occurrence 都由 policy template 现场生成独立 authorization，绑定当前 funding decision、route lease、数据去向、调用上限和全部费用 component；authorization 漏项、跨请求重放、tool/profile/version/effect 改变均在首字节前拒绝。provider-state write 或外部副作用无法逐次 Gate 时，即使协议本身支持也不能发送。
- [ ] conformance hosted tool 使用只引用 candidate chain 与准确 conformance physical lease 的独立 authorization；runtime authorization 绑定准确 upstream physical lease/member/effective route/resource/ComputePolicyBinding/prepared request/adaptation。把响应后 template 反挂到 candidate、或 A member 的授权换给 B 都零 ConformanceResult。
- [ ] conformance/runtime send cursor 的 child lease先把状态置为 in-flight；只有前驱权威 terminal 与 envelope retry edge 同事务消费后才允许下一 ordinal，`success` 原子关闭。两个 sibling、前驱未 terminal、成功后续发、旧 revision、跳 ordinal或崩溃重放都零额外字节；首项成功、首项失败后第二项成功和 `charge_unknown` 保留正确 ledger terminal。
- [ ] third-party inference adapter 的 `InferencePluginPolicyReceipt` 从 implementation 贯穿 Activation、Snapshot 与 PreparedAttempt，精确绑定 manifest/publisher/artifact/capability/permission/data processor/sandbox/IPC/budget；只扩大 prompt data scope、降低 sandbox 或换 publisher但保持 adapter digest不变，都会增代、撤销在途并要求重新同意。
- [ ] WireBudget 负例覆盖 header/压缩/未闭合参数、累计 stream bytes、JSON depth/nodes/properties/array、事件/occurrence、Schema refs/regex、CPU/wall；host 门覆盖 worker/queue/RSS/prepared 以及 handle 的 host/publisher/session/attempt count、resident/spool/temp/lifetime/orphan recovery cap。1 MiB inline frame 通过 digest+backpressure `ContentHandle` 支持合法 32 MiB request，不复制整流。N-1/N/N+1、chunk 随机化、慢消费者、崩溃恢复和同 ID 双 digest 均得到确定 terminal。
- [ ] strict parser 拒绝 duplicate JSON keys、非法 UTF-8/lone surrogate、NaN/Infinity、超安全整数、非 canonical number、confusable ID 与 encoded separator；所有合法 chunking/CLI/library/三平台 canonical digest 一致。
- [ ] snapshot 在并发切换时每个请求只观察旧版或新版完整闭包，不出现混合 generation；registry/TUF/discovery 故障不增加已激活连接的热路径依赖。
- [ ] Phase 2 的 active pointer 与 legacy production dispatch 在全部测试前后字节一致；shadow snapshot 不含伪造为正式的 Rights/Billing/DataBoundary/Activation receipt，任何调用 production promote API 的 fixture 都失败。
- [ ] 流式消费者暂停时上游读取受背压，缓冲达到上限后产生有界错误；取消、客户端断开和 daemon shutdown 都在 §12.1 门槛内释放 socket、timer 和 reservation。

定向门禁：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 2 --json
```

Phase 末：`just ci`。

### Phase 3：Registry、权益费用与主流 API 垂直切片

目标：用户选择 provider 后只填真正缺少的信息，模型与协议自动配置。

产品按独立子批交付，不做“全部品牌一起过”的大批次：先 OpenAI/Anthropic/Kimi Code API/OpenCode Zen/OpenCode Go/DeepSeek，再 OpenRouter credits、BigModel/Z.AI、MiniMax、百炼、方舟、TokenHub广州/新加坡普通API、腾讯企业Token Plan广州/新加坡、千帆、硅基流动；Google Gemini API key作为本Phase具名L0 production vertical slice，Azure API key也作为独立L0 slice，Entra/workload identity仍为L1；旧腾讯混元入口只做existing-connection migration，不再接受fresh onboarding；最后 Groq/Cerebras/Together/Fireworks/xAI/Mistral。每个产品而非每个品牌有独立 feature flag、evidence、readback；未通过者保持 inventory，不阻塞已通过者。OpenRouter BYOK 是独立条件式子批，不借 credits 路径的 L0 结论。实际 mandatory 集合只以经 detached release binding 验证的 matrix core+baseline 为准。

实施项：

- 将 provider product packs 落到 `@saydo/connectors-builtin`；普通新增 provider 只增加声明式 manifest/fixture/evidence，不修改 daemon switch。
- 内置离线 registry snapshot，并以 `catalog.tuf`、`policy.tuf` 两个独立 TUF repository 做增量更新、撤销、anti-rollback、expiry 与 schema version；更新失败只影响新候选，不影响当前 pin 的已验证 artifact。
- provider/region/plan 选择，自动填 endpoint/protocol/auth。
- 模型列表、alias/deprecation、能力候选与 model migration preview。
- 落 Rights/Billing/DataBoundary/Spend receipt 与独立审核/时效；Coding Plan、会员 API、普通 API 的 key namespace、Base URL 和用途不可互换。
- 腾讯TokenHub普通API以广州、新加坡两个互不借key的realm实现；每站分别提供Chat、Responses、Messages三个protocol profile、Bearer认证的`GET /v1/models`和官方备用origin。基础requirement按默认后付费验收，只有TPM预留与模型单元可作为同principal/realm/model上的独立capacity/funding observation叠加，不能反向替代API key、服务开通、protocol或站点证据。
- 腾讯企业Token Plan另建广州/新加坡 × Chat/Messages四条固定requirement；精确使用`/plan/v3/chat/completions`与`/plan/anthropic/v1/messages`，不借普通TokenHub的Responses、models目录、key或funding。专业版`enterprise`积分池与轻享版`enterprise-auto` Token池分别形成权威funding closure；地区、企业组织、套餐、Key、模型权限、余额、到期与overage逐项同主体闭合。
- 腾讯个人Token Plan继续是独立product与`sk-tp-*` key namespace；SayDo不在官方工具allowlist时只做无secret inventory与rights hard block，不把个人订阅迁入企业或普通API路径。旧混元普通API只允许existing-connection inventory与迁移。
- 每个 product pack 同时提交并验证 `evidence-lock.json` 条目；在线目录只提供技术候选，不能覆盖人工审过的 rights/billing/data 锁文件。
- 落地 field-specific `ExtractorPolicyReceipt<F>` 与独立 TUF delegation；model/route/usage/region/data processor/terminal/billing component 不能共享宽泛 extractor authority。
- 落地可信时间 source attestation、高水位/monotonic lineage 与零费用 metadata health；v1 不实现自动生成型 probe，breaker 只能等待下一次正常已授权请求携带 half-open token，不能在后台偷发生成请求。
- TUF archive 按 `registry-artifact-budget-v1` 解析；GA matrix/probe core先进入 distribution并各自取 digest，黑盒测试后再生成 detached journey evidence set与 release binding，生成 UI/文档/测试；在线 target不能增加 passive probe capability，也不能造成 release摘要自引用。
- 按`eligibility/raw policy source → rights → ComputePolicy → conformance/live journey → published claim → support artifacts`固定单向producer DAG；运行时rights、credential前状态与journey prerequisite不得读取当前或历史support claim。migration-only row同时生成既有连接正向exact gate和无既有连接absence gate，二者与fresh journey集合严格分离并共同进入release。
- **在首个非本地 connector feature flag 可激活前**，先删除 `SetupGate` 固定“数据不出这台电脑”与锁定该错误的旧测试，落 data-egress graph 真值表渲染。本地/云 API/gateway drift 三组组件与 Playwright 反例为远程激活的同批硬门，不得留到 Phase 6。
- 完成 ActivationManifest + config/SQLite/secret/receipt journal、expectedRevision/全资源 generation fence、activation barrier 与 crash recovery；只有本 provider 的 protocol/capability/compute-boundary/network/rights/billing/data、transport/compute scope、resource subject 与 route-set receipt 全齐且交叉引用完全相等时才允许 staged → live。
- 提供最小 provider-first UI 垂直切片，让每个已过子批都能被用户真正添加、测试、回滚；完整推荐器仍在 Phase 6。
- 自定义 provider 仍可添加，但必须走高级流程与完整 conformance。

验收标准：

- [ ] 从空claim store可完成eligibility、pre-credential rights、ComputePolicy、fresh与migration journey并生成第一版claim；把任一claim重新喂给这些前置producer、跨subject拼接Rights/Network/Billing/DataBoundary、让migration-only进入fresh笛卡尔积、遗漏positive或absence gate均在类型、schema、DAG和黑盒mutation四层失败。
- [ ] L0 preset 在离线 snapshot 下都能渲染，不依赖访问境外目录。
- [ ] registry 更新验签失败、网络失败、回滚时 active config 不受影响。
- [ ] 旧签名快照回放、key 撤销、generation 回退、rights 域伪装都被拒；emergency deny 不被 LKG 覆盖。
- [ ] catalog signer 无法发布 Rights allow，policy signer 无法发布 executable adapter/code；不同 root 的 metadata 互换、过期 policy LKG 授权和超限 archive 全部 fail-closed。
- [ ] registry archive 对压缩/展开字节、files/single-file/path depth/ratio、metadata roles/delegations/targets/nodes/CPU/wall/temp 的 N-1/N/N+1 全部使用 `registry-artifact-budget-v1`；预算值不能由 target 自报，解压穿越、duplicate key 与压缩炸弹不覆盖旧 cache。
- [ ] `policy.tuf` 的 credential-egress、rights、billing、data-boundary、emergency-deny delegated role 只能写入各自 target path，使用独立 key/threshold；receipt 完整记录 root/timestamp/snapshot/delegated metadata version+digest、target path/hash/length、consistent snapshot、anti-rollback high-watermark与 verifier generation。跨 role targets、旧 metadata 拼接、rotation 后旧 key、rollback/mix-and-match 和 publisher 自签 policy均拒绝且可离线重放。
- [ ] TUF 首次信任只从 distribution 中预置的 root开始；每次 root rotation 同时验证旧阈值与新阈值并逐版本前进，不能跳步或只信当前下载的 root。`catalog.tuf`、`policy.tuf` 及每个 delegated role分别持久化 version+hash high-watermark；只回滚一个 role、把 catalog watermark 借给 policy、旋转后回放旧 key、删除中间 root evidence或在离线重启时降低 watermark都阻断新 candidate/policy receipt，且不破坏仍有效的已 pin active snapshot。
- [ ] 首次无 key 的 API preset 先凭 `ProductEligibilityReceipt` 决定是否展示并本地保存 secret；它绝不授权 egress 或请求。key/OAuth 形成稳定 principal 后才生成 principal-bound Rights 与 EndpointCredentialEgress；eligibility、rights、egress 任一跨 product/region/credential 换挂均零 secret read、零网络字节。
- [ ] 每个 official preset 的 EndpointCredentialEgress 由 credential-egress delegation 独立签发；catalog signer 单独把官方 endpoint/transport/TLS/RequestProfile 改到另一域，即使 Rights 仍 allowed，也无法让 broker 取 key。custom 正向 fixture 从本机录入→稳定 principal→exact owner/admin private-rights→逐 component egress→`ConformanceExternallyMeteredUnknownConsent`→unknown ConformanceResult/Binding→`connected_verified`→一次 runtime unknown consent完整可达；任一步跨 endpoint/product/principal/use/distribution/request/cap 换挂均零字节，且始终不进 no-new-spend/推荐/fallback/evaluator/background health。
- [ ] PKCE/device 的真实 provider fixture先绑定判别 flow-start与 client registration/auth；浏览器打开或device authorization首字节前先消费 durable start cursor lease，提交准确browser/device terminal后才创建exchange cursor，再逐exchange/poll消费lease。confidential client覆盖 secret basic/private-key-JWT/mTLS alias。refresh rotation fixture引用predecessor grant/family/旧credential source+version+subject，原子产生新access/refresh version、scope/issuer/aud/azp/cnf与唯一winner。两个daemon、start/exchange sibling、旧epoch、旧refresh重放、scope扩大、账号或client auth换挂全部拒绝；无法取得稳定账号身份时只使用不可跨key/version的credential fingerprint subject。
- [ ] OpenRouter官方登录正向 fixture严格执行“浏览器 PKCE → family rotation lease → 交换 API key → winner/旧key disposition原子commit → 当前family credential lease”，不虚构 OAuth client ID/scope/access/refresh token；手填 key 与 PKCE key是两个 auth journey、各自有 completion/live evidence。双flow、双daemon、response-loss、loser revoke、`still_unknown→later adopted/absent/revoked`、旧key重放及标准OAuth/手填key报告互借都使activation与GA journey gate失败。
- [ ] 每个 conformance round在授权时冻结精确 IR、无用户内容 fixture、adaptation、method/final URL/header/body digest、hosted-tool occurrence与 fixed/route-set成员全集；physical lease只能消费该 round的 prepared/wire request。实际 report引用同一 admission decision和真实 request/response/ledger，不能用“priced profile”或顶层 subject替代本次发送证明。
- [ ] conformance authorization对动态 route set逐成员保存 policy/fence/billing/data closure和最坏序列；staged success后必须经`ConformanceRestartCursor`提交旧进程终结与准确候选snapshot/distribution/config generation的loaded barrier，live intent/lease/result/completion全部强引用同一`live_ready`cursor。restart按intent前、已请求终止、旧进程已终止但未spawn、candidate已spawn未load、load/listener未知五stage分流；每条lease有准确authority inventory，intent前逐项释放，已知失败完成旧/新process、listener、credential、network清理与safe-retry baseline，未知只走独立query reconciliation并保持原ordinal。直接与reconciled success互斥且都能进入commit；只跑staged、未restart、旧generation、换live endpoint、跨成员借报告、清理不全、未知后直接重启或restart失败均不能产生Capability/Binding。
- [ ] 一次 accepted conformance decision 必须在 decision 前冻结 `[staged, live]` 两个完整 authorized round tuple，并由 single-use consumption commit 授权整条 journey；每轮再取得独立 intent lease、credential/compute closure、prepared descriptor和最终 physical send lease。复用同一 round、先生成 physical lease再补 credential/local-compute proof、把 staged result当 live、success terminal与实际 request/response/ledger不等或同一 decision启动第二条 journey都零 Capability/Binding。
- [ ] conformance与runtime共同执行唯一不可逆DAG：ready cursor → 无发送权attempt intent →完整prepared descriptor → 最终physical lease并把cursor置为in-flight → hosted-tool authorization bundle → durable send intent → 首字节 → terminal。每个会产生socket、network byte、secret read、credential/signature、browser、process、listener、tool effect或费用hold的lease都实现`AuthorityInventoryBearingLease`，inventory逐entry固定kind/ordinal/authority ref/subject digest；before-intent terminal必须携带同lease的`PreIntentLeaseClosureReceipt`与按映射类型无漏无重的release set，已发intent时该closure不可构造。descriptor不得反向引用尚未产生的final lease，final lease必须逐字段证明intent、descriptor、ready predecessor、route/member、funding、credential、compute与security closure相等；任一倒序、遗漏authority、用通用释放digest、跨round/member、从in-flight取第二个lease或descriptor后补证据都零字节。
- [ ] staged/live completion只能分别接受`validationRound: "staged"`与`"live"`的成功terminal、result、actual report及连续ledger range；live物理链还必须逐字段等于restart barrier的loaded process/distribution/snapshot/config generation。live-before-restart、旧进程仍存活、loaded generation漂移、failed/zero-attempt/unknown、错round或报告换挂均不能生成completion。
- [ ] custom unknown 与 official enterprise unknown 两条 conformance/runtime路径在 proposal、disclosure、decision、candidate billing、rights、actual report、funding decision和 operation closure上保持严格判别；二者都要求每个 physical request 单独确认，但 UI 明确区分“你管理的非官方私有端点”和“官方服务暂无可核对计量”。任一分支借用另一分支的 rights、措辞、report或 no-new-spend badge都使连接保持 `action_required`。
- [ ] official enterprise/cloud产品在无法获得权威价格或硬 cap时使用 `OfficialEnterpriseUnknownMeteringRightsReceipt`和逐请求 unknown-metering决定，不被 custom attestation替代，也不进入 no-new-spend、推荐或静默 fallback；custom与official unknown均能完成真实 conformance/actual report，但保持准确成熟度和提示。
- [ ] 自动供给、推荐、evaluator、后台health与fallback全链只接受`AutomatedInferenceFundingDecisionReceipt`，其闭合联合只有`no_new_spend`和有界`runtime_authorization_required`；两类unknown只能生成`ManualOnlyInferenceFundingDecisionReceipt`并绑定当前用户主动请求、逐次披露和准确physical cap。把manual-only decision挂入Supply slot、fallback admission、自动重试或后台请求的编译负例与运行mutation均在首字节前失败；用户主动单次unknown调用仍有一条完整正向terminal/ledger路径。
- [ ] 持久预算由 policy、durable balance cursor、逐child authorization lease与settlement/correction组成；policy必须选择不可上调final或有界correction horizon，child最坏预留包含最大更正向量。provisional usage在horizon关闭前完整保留escrow且不能变成可消费余额；只有immutable final、权威horizon close或权威not-sent释放unused hold。
- [ ] correction只能在retained escrow内发生；covered correction前后`remainingPhysicalRequestCap/outstandingChildHoldSetDigest/outstandingChildCount/aggregateOutstandingBillingHoldVectorDigest/aggregateOutstandingPhysicalRequestHold`逐字段相等，ready/exhausted/revoked/expired状态不能互换。超声明最大更正或immutable final后上调走独立authority-breach hard-stop并撤销profile，不扩张用户授权。余额0+一个outstanding child+covered correction仍为0，不能凭空变为1；100并发、乱序settlement、旧revision与cross-policy换挂均由model gate拒绝。
- [ ] 新增一个标准 OpenAI-compatible、一个 Anthropic-compatible provider 的验收 fixture 只改 product pack 与测试材料，daemon/console 核心业务文件 diff 必须为零；生成 UI 和文档支持清单与 report 同源。
- [ ] region 与 key 不匹配给出明确处方，不盲目轮询其他地域。
- [ ] 上游模型改名/下线时不静默替换 active model。
- [ ] 每个启用的 L0 provider 至少有 schema、model list、rights/billing/data 和 protocol conformance fixture。
- [ ] 每个启用的 product 的 endpoint/protocol/rights/billing/data 官方依据都有 canonical URL、`accessedAt`、content digest、region/surface/useCase 和 reviewer；证据过期只允许按当前 policy 重新审，不能从缓存网页或另一区域产品延续 allow。
- [ ] 每条 policy 依据还能解析到 content-addressed raw artifact、fetcher/canonicalizer version、locale/region/account context 与 normalized projection digest；raw artifact 缺失、版本变化或仅 URL 相同均不能重放 receipt。受限原文留在权限隔离 store，但审查者可重算公开投影。
- [ ] GA matrix core与mandatory baseline非空且无重复；唯一键覆盖product/region/surface/auth/protocol/deployment，逐entry分开ecosystem tier/maturity并定义逐auth journey。detached evidence set对required entry/journey无漏无重地绑定当前distribution的强类型journey payload、attestation和`completed_pass` gate。OpenRouter手填key/PKCE key、Azure key/Entra、一个inventory和一个L1 slice证明不可互借报告。移除reference-grade具名minimum会机械撤销designation；owner decision只能作为不嵌入core的detached attestation。
- [ ] Kimi Code API 的 OpenAI Chat固定到`https://api.kimi.com/coding/v1/chat/completions`并发送`Authorization: Bearer`，Anthropic Messages固定到`https://api.kimi.com/coding/v1/messages`并发送`x-api-key`；两者使用同一会员principal但各有独立RequestProfile/TCK，保留真实`User-Agent`。Kimi Platform按量key与`https://api.moonshot.cn/v1`另成产品，任一方向的key、endpoint、rights或funding都不能替换。Extra Usage 的 enabled/cap 未知时不进入 no-new-spend；GLM/百炼/腾讯等受限 Coding Plan 不能误用普通 API connector。
- [ ] OpenCode Zen、OpenCode Go 与 OpenCode Server/ACP 使用三个独立 product/surface 和 secret namespace。Zen 的按量 credits、auto-reload 与 workspace/member monthly limit 分开建模；auto-reload enabled 或限额不能形成可执行硬 cap 时不进 no-new-spend。Go fixture 分别覆盖订阅余量充足、限额耗尽且 Zen balance fallback 关闭、用户明确开启并有硬预算、模型数据条款变化四种状态；任何 Go→Zen 余额切换都重新生成 funding decision 并按 charge component 记账，不能由一次连接确认或 OpenCode 本机登录态默许。
- [ ] OpenRouter普通inference key或PKCE换取key下若检测到BYOK只标inventory并提示直连provider key或提供独立management授权；正式BYOK fixture冻结两把顺序key、全部provider account、shared fallback和配置revision，同时把upstream provider charge与OpenRouter fee/credits作为独立component预留/结算。Key A限流→Key B成功、再回shared capacity、配置并发改变均不会漏记、越界或沿用旧fence。
- [ ] OpenRouter BYOK revision 精确包含本次 gateway API key hash、workspace/member/user、requested model，以及每把 key 的 `allowed_models/allowed_api_key_hashes/allowed_user_ids`、顺序和 null/omission 语义；逐字段 mutation 都使 route fence、Billing 和当前 authorization 失效，不能只比较一个不透明 revision 字符串。
- [ ] BigModel 中国普通 API 同一 payg product 下分别实现`https://open.bigmodel.cn/api/paas/v4/chat/completions`的Chat route与`https://open.bigmodel.cn/api/anthropic/v1/messages`的Messages route；前者精确发送`Authorization: Bearer`，后者精确发送`x-api-key`。两者各自使用独立`InferenceEndpointIdentity`/RequestProfile/TCK/receipt，普通平台key不能与GLM Coding Plan key互换；Z.AI国际普通API仍只开放当前官方证据支持的Chat。Coding Plan、其他region/product的文档不得扩张二者声明。
- [ ] TokenHub广州与新加坡的六条requirement分别固定默认origin、官方备用origin、站点key namespace、model-service activation和准确protocol path；Chat/Responses必须发送`Authorization: Bearer`，Messages必须发送`x-api-key`，`GET /v1/models`始终使用Bearer。`401002`、`402`的“服务未开通或额度不足”、`429`和流已开始后的SSE error都进入准确typed terminal；备用origin切换必须重新验证endpoint identity、route fence和data boundary，绝不跨站尝试key。
- [ ] TokenHub基础六行的funding tier为默认`payg_postpaid`；若产品展示TPM预留或模型单元，则必须由`TokenHubFundingObservationReceiptV5`权威观察准确site/principal/key version/model/capacity order/overage后再生成独立funding closure。个人或企业Token Plan永远不进入该union；只检测到套餐名、工具配置、账户余额或API技术成功均不能生成subscription/no-new-spend结论，fresh onboarding不会再落到旧混元普通API。
- [ ] 个人版detector只读取非敏感定义与endpoint痕迹，绝不自动读取或试用`sk-tp-*`，并显示“检测到腾讯云个人Token Plan；SayDo当前不在官方支持工具范围，未读取Key”。企业版则按四条固定row提供guided onboarding：只有用户明确选择或批准导入后才读取企业Key，并同时验证广州/新加坡realm、企业组织、套餐product type、模型权限、过期与额度池；不得把个人版hard block错误套到企业API订阅。
- [ ] 企业Token Plan广州/新加坡各自固定Chat Bearer与Messages `x-api-key`/Bearer单选的准确plan path，不支持Responses或models目录；`enterprise_professional_points`与`enterprise_auto_token_pool`分别要求积分池和Token池closure。四个requirement × 两种edition共8个独立variant evidence逐项进入release，任一跨region、跨edition、跨protocol、个人版或普通TokenHub证据换挂都阻断连接与发布。
- [ ] 双协议首次自检必须用一份包含两个完整候选 identity closure 与有序子额度的 ConformanceAuthorization，或切换协议时再次确认；首协议 r1 失败、第二协议 r2 成功的 fixture 使用 r2 自己的 subject/policy/budget，不会沿用 r1 顶层 refs。
- [ ] 动态 gateway 的 ConformanceAuthorization 按 InvocationEnvelope 最坏调用序列总和预留；运行时 member A→B 使用各自 ConformanceResult/Capability/operation policy 闭包，跨成员复用或顶层单 subject 授权均拒绝。
- [ ] 同一计费单位的 bridge 内 A 已发送后 timeout、再调用 B 并成功的 fixture 在 ingress 前预留 A+B 的最坏序列总额；A 进入 `charge_unknown`、B 正常结算，该单位总额不超展示授权。只预留 `max(A,B)`、未知 retry 或 callback 失联都在首字节前拒绝。
- [ ] 跨计费单位 fixture 使用 A 最坏 `CNY 1.00`、B 最坏 `USD 1.00`：A sent 后 timeout、再调用 B 并成功时，ingress 首字节前必须原子预留 `{CNY: 1.00, USD: 1.00}`；A 的 CNY 分量进入 `charge_unknown`，B 的 USD 分量进入 `settled`，账本、确认界面与审计均不得生成标量“2.00”或做 FX/跨单位抵扣。
- [ ] `BillingLimitVector` 对未知/非规范 unit、重复 canonical key、负数、float/指数金额、整数溢出、错误 exponent、未经证明的舍入及缺失但未证明为零的币种分量全部拒绝；同单位序列求和与逐单位最大值使用有界整数并有边界 fixture。
- [ ] fixed 与 dynamic 各有 candidate→runtime Billing 接缝反例：CandidateBilling/授权只有 `CNY 1.00` 而 conformance/runtime Billing 新增 `USD 1.00`、price version 漂移、funding/overage 改变、实际/最坏金额超过 child 或 aggregate cap 时，只生成费用 anomaly，ConformanceResult 构造、verify 与 promote 均拒绝。已发生的已知新增单位单独进入 `charge_unknown` 异常账，非规范单位保留 opaque evidence 并锁 route；二者都不得借其他单位余额、FX 或旧 receipt 激活。
- [ ] fixed 与 dynamic 的数值链反例令真实 CandidateBilling/authorization/attempt+ingress reservation refs 为 `CNY 10.00`、conformance runtime Billing ref 为 `CNY 1.00`、权威 terminal ledger 为 `CNY 5.00`，必须由 `billing-limit-fold-v1` 重算后以 `runtime_worst_case_exceeded` 在 Match 构造、verify、promote 三处拒绝并逐单位提示；试图额外塞入 `settled=0/1`、`runtimeWorst=5` 或把真实 1 元 candidate/auth/reserve 抄成 10 元的 summary 字段由严格 schema 直接拒绝，UI cache summary 也不能参与判定。
- [ ] dynamic 反例中 A 的 runtime worst=`CNY 1.00`、held=`CNY 5.00`，B 的 runtime worst/settled 均为 `CNY 1.00`，即使全局 6 元小于 10 元 aggregate，仍因 A 的 member 链失败而零 `covered`；coverageSources 对全部 sent attempt 少一项、多一项、重复 attemptOrdinal、错序/错 member、使用 B runtime Billing 覆盖 A、terminal current-state fold 低报或逐单位总和大于 ingress reserve 时，均以 `ledger_coverage_mismatch` 在构造、verify、promote 三处拒绝。
- [ ] 两 operation 正向 fixture 的 CandidateBilling 同时投影 `chat` 与 `tool_roundtrip`，ConformanceResult 为二者各保存唯一 OperationBillingClosure，分别钉住准确 ComputePolicyBinding/runtime Billing，且与 fixed Binding 或 RouteSetCore member 集合完全相等；只用 chat/CNY Match 后把 tool_roundtrip/USD binding 换入激活闭包、漏项、重复 operation、跨成员 closure 或用 B 的 Billing 覆盖 A，均在 Result 构造、verify、promote 和首字节前拒绝。
- [ ] ConformanceResult 将已消费 attempt/authorization/ledger/真实 response 与最终 runtime identity 串联；A 结果→B subject、失败 terminal、未发送 attempt 或 adapter drift 在 verify、promote、首字节前三处均拒绝。
- [ ] 两成员 RouteSet 的 verify→promote 正向 fixture 冻结 final/core/invocation envelope 及所有 ordinal 闭包并能实际选择 A/B；漏成员、错 ordinal、把 A 闭包当 B 或在 route_set binding 塞单值证据均三时点拒绝。
- [ ] fixed、direct 与两成员 RouteSet 在每次 runtime ingress 原子生成 operation-specific fence lease、明确 invocation envelope 与 durable cursor；每个物理请求把 cursor置为 in-flight，只有权威 terminal命中 retry edge才允许 successor，success立即关闭。fixed retry表现为重复 fixed ordinal并逐次预留/结算。前驱未 terminal、成功后续发、首项 predecessor非空、后项错链、两个 sibling、同 lease重放、template/enforcement映射漏项或 config/member/route竞变都零上游字节。独立 authority attestation逐 physical lease绑定双方 trust domain、subject、nonce、lease core/commit token/route/measurement；G1/self-attestation不能挂给 G2。
- [ ] 每个 runtime ordinal先持久化不具发送权的 intent lease，再分别取得 funding、network/rights/billing/data、local/LAN compute lease并聚合成唯一 physical send lease；local/LAN的 no-new-spend proof只引用当前 compute lease，不反向引用最终 send lease。前驱 route sequence terminal未提交时，外层 fallback cursor不能 advance；`failed_before_send`、`delivery_unknown`、success、cancel/hard-stop/exhausted各有不可混装 terminal。
- [ ] runtime terminal按outcome与sent/billing fold形成真实判别constituent；fallback外层不重填billing/sent，只能读取inner。inner success/unknown强制terminal，inner exhausted只有具名登记edge、相邻ordinal与剩余总cap证明才advance；success→retry、unknown→not-sent、control outcome改名、outer billing换挂及inner尚未terminal均由model-based测试拒绝。
- [ ] `FallbackPlanTemplateReceipt` 随 Activation/Snapshot 只固化每个完整四槽 alternative、全部 policy/funding/fence/data graph、evaluator 独立性与有限 cross-solution envelope 模板；每个 ingress 另行生成当前 FundingDecision、aggregate reservation/disclosure、`FallbackAdmissionReceipt` 与 durable cursor。A sent 后 timeout 且账务 `charge_unknown` 时，A 的最坏预留不释放；只有命中已登记 terminal edge且 A+B 总预算已预留才可调 B。A success立即关闭。没有 cross envelope时只允许权威 failed-before-send 后为下一请求重编译。集合外 B、临时推荐器、拼单槽、把 runtime authorization 写进 activation 或旧 snapshot fallback 均失败。
- [ ] ConformanceResult、Capability 与 Activation 对 raw response inventory、decoding/response profile、loss receipt、security extractor policy 和 hosted-tool policy template 的引用完全闭合；response evidence还必须反向核对准确physical lease/send intent/request以及success/provider-failure/partial-unknown终态，结果与tool occurrence都从同一raw inventory逐项派生。response profile、authority 或 hosted-tool profile 漂移会 hard stop，不能只重跑展示层 parser或拿摘要补权威结果。
- [ ] `SupplySolutionReceipt.slots`是四槽唯一真相；fallback template、alternative、envelope、solution admission、cursor、attempt、terminal与advance transition都按同一`invokedSlot`映射到该tuple准确成员。故意加入命名槽副本、把dialog alternative挂到thinking、A solution admission挂到B或让跨slot advance继续的mutation均在类型/Zod/CAS/运行fold四层失败，不能仅靠外层digest或布尔anti-splice声明。
- [ ] 时间 source attestation 验 issuer/key/trust policy/nonce/sample/uncertainty/issued/max-age/boot-monotonic lineage；`temporal-validity-fold-v1` 从 manifest完整安全闭包重算非空排序 refs与最早 expiry。producer漏掉 12:00 Rights只保留18:00 Billing、假 key、旧 nonce、跨 boot replay、future sample、回拨或离线重启均 fail-closed；compile/promote/send三处重算一致。
- [ ] field-specific extractor policy逐统一 field/product/protocol/profile/raw path/rule和完整 TUF lineage绑定；authority extraction再绑定 occurrence、typed canonical value/value digest与 target subject。把 A route raw value变成B、model rule给usage、region delegation给processor、Chat path给Messages、旧 snapshot target或第三方 decoder自报 authority均不能生成受信 extraction。
- [ ] breaker half-open 自动请求仅允许已证明零生成/零费用 metadata；所有需要 generation 的恢复验证只能由下一次正常授权请求携带 token。后台恢复检查的生成请求数与付费 ledger `sent` 数必须为零，schema 也拒绝不存在的 `health_probe` operation。
- [ ] credentialed 或可能计费 metadata 的 bootstrap/established admission 使用各自严格 proposal/disclosure/decision和 NonEmpty reservation；send intent有 deadline与single-use，terminal把 before-send零账、sent结算/未知账与delivery-unknown hold严格相交，result只在用户发起分支引用非空权威 ledger range。空 reservation、自动分支携带 ledger、用户分支零 ledger、intent重放或过期后发送都失败。
- [ ] ledger 的 initial/corrected authoritative range、actual-attempt report和report cursor通过 correction lease 做 subject+writer epoch+revision 的 single-successor CAS；迟到 usage 只能生成一个 correction commit及其唯一 superseding report。两个 daemon并发修正、同一 predecessor产生两个后继、旧 as-of watermark、跨 subject range、空或不连续序列都不能更新费用视图或 GA evidence。
- [ ] ledger report cursor严格为initial/corrected ready→correction-in-flight→corrected ready或final；correction lease只来自ready，commit只消费其in-flight last lease并生成唯一superseding range/report。final、in-flight或旧revision不能再取lease，commit不能替换subject、旧新range、watermark、actual-attempt集合或报告outcome。
- [ ] 请求已发送后响应丢失、首 token 后取消、发送后 kill 和迟到 usage 均进入可调和的 `charge_unknown`；未取得未计费证明前不释放最坏预留，重试另行预留。
- [ ] verify 后分别撤销 rights、更换 scope/RouteSet、轮换 broker ACL 的并发 fixture 都使 promote 失败；在 barrier 解除前零请求可发出。
- [ ] 将仍有效的 ComputeBoundaryCore 换挂到另一 resource subject、仅替换 ComputePolicyBinding 的 network/rights/billing/data 任一 ref，或跨 compute member 复用 Capability 的 fixture，都会在 verify、promote 及首字节前被拒；不能靠“所有 receipt 各自都有效”通过。
- [ ] payg connector 无 runtime authorization 时可激活为 `paid_dispatch_locked`，但零付费请求；单次授权只消费所选 attempt，过期/耗尽后 connector 仍 active 但 dispatch deny。ConformanceAuthorization 不会派生、默认勾选或复用为 RuntimeSpendAuthorization。
- [ ] 第一个远程 connector 的 activation 依赖 DataBoundary UI 门：纯本地可动态显示本机承诺，云 API 和 gateway drift 只显示真实 operator/地域，全局页尾不得冲突。
- [ ] 首次 gateway 自检前展示 CandidateDataBoundary 的完整可能 operator/region/retention 集合；结果只在 runtime DataBoundary 落入该集合时进入激活。candidate/effective 换挂或实际超集均零激活并 hard stop。
- [ ] `processingRegions` 空 tuple、`unknown/global` 与具体地区混装、无证据 provider-defined→ISO 映射、CN 大小写/自由文本、乱序重复和 A operator+B region 拼接均拒绝；空集绝不能因 `every()` vacuous truth 满足“中国大陆内处理”。
- [ ] 新 connector 激活后可用上一正式发布二进制恢复 legacy snapshot、active binding 与 secret；回滚窗口结束前不清理旧数据。

定向门禁：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 3 --json
```

Phase 末：`just ci`。

### Phase 4：自动发现与本地服务

目标：已有 Ollama、LM Studio、oMLX 或其他兼容服务的用户无需理解 URL/key 即可形成候选并完成有界激活；完整自动推荐在 Phase 6。

实施项：

- Discovery Engine、cache、并发/timeout/cancel 和统一 candidate 状态。
- 所有 detector 通过 `DiscoveryDetector` SDK 注册，只返回带 provenance/TTL/budget 的候选；调度、并发、熔断、网络访问和文件读取由宿主控制。
- passive probe 只能引用 release-bundled immutable capability；宿主按 stable detector ID 做与 registry 顺序无关的 deterministic deficit round-robin，并为核心 detector 保留 worker/queue 份额。
- CLI 静态 inventory 移入 detector；二进制状态命令进入用户确认后的 cage，移除自动扫描第三方 session/history 的路径。
- 静态识别 Docker/Podman 安装迹象；用户一个明确动作后，才在 OS-enforced discovery sandbox 中只读枚举 running/stopped 容器与 loopback port，不 start/restart/pull/create/load。
- loopback signature detectors：Ollama、LM Studio、oMLX、OpenCode，随后加 llama.cpp/vLLM/SGLang/LocalAI。
- 将“服务已ready的零动作接入”与“服务未安装/停止/未加载/配置异常的恢复”拆成两套图：前者只有passive peer evidence→validation；后者按managed/unmanaged和准确runtime state选择install/start/load或enable/repair/load的首步。每个恢复run先提交负向precondition assertion，初始readiness只能是`action_required`，到独立recovery terminal后仍要执行完整post-graph success chain。
- loopback transport policy、任意 auth 的当前 peer、conformance/runtime 共用 physical-attempt binding、本次 `LocalComputeLeaseReceipt`、真实模型进程树 sandbox、模型列表、ComputeBoundary 与 capability self-test；不从端口位置或认证类型推导计算位置。
- 冷态本地模型使用独立 `LocalPreloadAuthorizationReceipt → GlobalCursor → Lease → EffectIntent → Terminal → ReleaseCommit → Result → LocalComputeEvidenceReceipt` 流程；preload content-free、禁止下载和外网、绑定 process/fence/artifact，全局并发和 resident reservation由同一 cursor做 single-successor CAS，OOM/取消/崩溃可恢复，不与付费 conformance 同意合并。
- Ollama local artifact/cloud model 与 LM Studio local runtime/LM Link 分流；云/LAN 路径进入 principal、Billing/overage、DataBoundary/Spend 与 drift 合同，不复用 local-only receipt。
- “查看局域网服务”单独 opt-in；默认无端口段扫描、无 mDNS 广播。
- 本地 server 停止/重启/model drift 的被动健康状态。

验收标准：

- [ ] 冷启动与 cache 指标统一引用 §12.1；本阶段验收候选卡，不提前声称推荐器已经完成。
- [ ] `local_service_ready`的自动图与全部runtime recovery scenario是互斥的typed subject集合；`not_installed/not_running/no_model/cold/disabled/api_off/port_conflict/unsupported_version`分别从compiler-selected first step开始。漏scenario、错首步、把precondition observation当recovery success、恢复前伪造zero-config pass、恢复后缺live/activation/pointer任一项都使门非零。
- [ ] 自动探测期间没有生成请求、模型加载、下载或付费调用。
- [ ] `static_filesystem` 与 `passive_loopback_metadata` 是两个独立签名 mode：前者零 packet/子进程，后者只由 host 执行 release-bundled capability 固定的 literal `127.0.0.1/::1` GET/HEAD，无 DNS/query/body/auth/redirect。在线 catalog 只能引用 capability ID；即使签名有效，新增/改变 destination/method/path/header/body 的恶意 target 也必须零 packet。请求数、单响应/总字节、并发和墙钟逐项达到预算；detector 自身拿不到 socket。
- [ ] discovery TCK按`static_filesystem | passive_loopback_metadata | explicit_active`三条完全独立的deterministic semantic subject、flat core与typed run-evidence分支运行：core只冻结policy/profile/budget，严禁写入live lease、用户decision、canary实例或时间；static run只能带allowlisted read inventory且packet/subprocess为0；passive run必须带同一次held loopback peer admission→probe intent→typed terminal、literal address、GET/HEAD、exact path和byte budget，terminal以准确`network_admission` entry的typed release关闭唯一socket/dial authority且无用户decision；explicit active run必须带当前accepted decision及single-use consumption、sandbox canary，以及逐动作绑定同一lease/inventory/intent/terminal和完整typed authority release set的非空closure集合，且不能借passive socket。三种两两换挂mode、core/run字段、environment、artifact/config generation、provider-specific profile或budget任一项都使report非零；漏/重/错kind、错lease或错subject的release也必须失败，同时每种正例可达且两次相同fixture的core digest相等。
- [ ] 默认只访问上述 loopback 与已知配置；packet/HTTP fixture 证明没有 LAN sweep、mDNS、DNS、Internet 或云 metadata 请求。自动阶段只静态识别 Docker/Podman；确认后的 sandbox 只读枚举 running/stopped 容器，停止的 Ollama/vLLM/LocalAI 显示一个启动处方和次级复制链接，绝不自动启动、拉镜像或加载模型。
- [ ] 无 key且在**首次真实自检前**已有同一份本机 device/runtime process、强 `LocalInferencePeerReceipt`、已加载 artifact、route→artifact 与 runtime egress assurance 的 Ollama/LM Studio/oMLX 能保存并通过两轮自检；模型已安装但未加载时，卡片显示一个“在本机加载并自检”动作，经独立 content-free preload 取得同等 loaded evidence 后再自检，不要求用户外部预热。只有 loopback、peer 身份不强或计算位置 unknown 的候选不得标为本地计算，也不得取得本机/no-new-spend 的首测授权。
- [ ] Ollama 默认冷态、LM Studio 未加载模型、preload OOM、用户取消、服务重启、artifact 被替换、cloud alias、LM Link 和 preload 期间出现外网/下载各有 fixture；失败不留下假 loaded receipt、僵尸进程或可消费 conformance authorization。
- [ ] `local-preload-v1` 对 estimate missing、`available-reserve` 小于零、默认 max(2 GiB,20%) 系统保留、用户 cap、120 s deadline、全局并发 1、最长 10 分钟显式覆盖逐项验收；预算计算使用饱和减法，整数溢出或不足直接 `action_required`，不能通过负值下溢放大上限。
- [ ] 两个 daemon、两个模型和同一模型双击并发 preload 时，global cursor/lease只能产生一个 winner；effect intent在任何模型加载字节前持久化，success/failure/OOM/cancel/hard-stop/deadline都经 terminal+release commit原子归还 resident reservation。旧 generation、同 intent重放、未 release就发第二份 lease、失败分支伪填 loaded artifact或 success result借用另一 artifact都不能生成 LocalComputeEvidence。
- [ ] 用户自启但可强绑定 peer/artifact 的 runtime 可获得 local-compute；若同 process generation 只能得到 `egress_unknown`，UI 精确显示“模型在本机运行；该服务的外连未被 SayDo 限制”，不得显示本机数据局部性承诺。只有 `LocalInferenceRuntimeSandboxReceipt` 同时证明 filesystem/sync/temp/log/IPC/shared-memory/helper/inherited-handle/socket 全出口，才可显示“本轮仅使用本机处理，已限制已知数据出口”，同时列明 swap/coredump/VRAM/snapshot/backup 残余；network-only assurance不够。经确认由 SayDo 隔离重启后才可生成应用级完整证明。
- [ ] 既存 Ollama/LM Studio 进程不能因限制发送 preload 的 helper 就获得 runtime sandbox 证明；只有 SayDo-managed daemon 或上游 atomic no-download/local-only admission 可一键 preload。无法圈禁时给出安全重启或保持 inventory，零下载/零外网由目标 runtime 的 OS 证据而非自报字段证明。
- [ ] 恶意进程抢占 `127.0.0.1:11434/:1234/:8000` 并复制 signature只能形成 candidate；conformance/runtime先生成无发送权 intent，再由该 intent 在 held/connected socket上生成 connected peer、LocalCompute与 runtime-isolation lease，三者全部进入 descriptor，随后才签发条件式 final physical lease、hosted-tool authorization bundle与send intent。descriptor绑定 PID-start、binary/artifact identity、config/model-load、route→artifact、device与数据出口；Basic/Bearer/mTLS也必须生成。先签final lease再补compute、descriptor漏 compute/isolation、conformance强塞 runtime fence、服务重启/重载/抢端口、跨 attempt或旧 lease重放均在 secret read/首字节前拒绝；uncontained isolation可显示本机计算但不能显示本机隐私。
- [ ] 用户自有 local/LAN 服务只有在精确 device/operator/route→artifact、无逐调用第三方费用和无自动超额都可证明时生成 `owned_capacity`。本机引用当前 peer/sandbox/compute admission；LAN 必须由 SayDo-managed remote agent或不同信任域 authority产生 policy，并在每个 attempt 取得绑定远端 peer/process/artifact/config/model-load/egress的 `LanComputeLeaseReceipt`。LAN gateway自报、旧 attestation、缺每请求 lease或暗转付费云均降为 unknown/provider-cloud；UI 只显示已有容量和真实数据去向。
- [ ] Ollama cloud model fixture 经 `localhost:11434` 仍被建模为 `provider_cloud`，绑定登录 principal、subscription/extra-usage 资金与云 DataBoundary；不进 no-new-spend 或本机隐私承诺。
- [ ] LM Studio LM Link fixture 经 loopback 仍被建模为 `lan_device`，远程设备身份/网络/DataBoundary 变化触发 hard stop；未知远程设备不自动激活。
- [ ] Ollama 登录账号、cloud model route 或 LM Link 远程设备改变后，旧 `local_device` core/旧 compute subject/旧 Capability/旧 FundingPolicyTemplate/授权实例全部失效；交换本机 transport 与云/LAN compute scope 或跨成员复用能力收据的反例不能通过。
- [ ] Ollama Cloud/LM Link 在第一次生成请求前已被 preflight 分类为 cloud/LAN，并展示相应数据与费用确认；把它伪装成 local、local evidence 缺项或 preflight/runtime boundary 不一致的 fixture 均零请求或重新确认，不允许先发后纠正。
- [ ] preflight→首字节之间切换 Ollama 账号/cloud route 或 LM Link 设备时，CandidateRouteFence generation/config/token 变化使零请求；不提供 admission fence 的 upstream-managed loopback 路径只 inventory/提示直连 API，不用事后 response 检查补救。
- [ ] runtime 阶段重复上述竞态时由 RuntimeRouteFenceTemplate/Lease 与每次物理 child lease阻断；不能把首测 CandidateRouteFence 复用成日常调用证明。
- [ ] Ollama Cloud/LM Link 首测卡显示候选云 operator/地域/保留范围，不显示 runtime 本机承诺；CandidateDataBoundary 未覆盖实际结果、或拿 local candidate 冒充 cloud/LAN runtime receipt 时零激活并 hard stop。
- [ ] 同一 Ollama process 已加载本地 llama 模型、但当前 attempt 请求 cloud model 的换挂 fixture 不能借用本地 evidence：attempt/route/requested model/route→artifact 任一不符即首字节前拒绝；响应后的 observed model/model identity 也必须绑定同一 artifact 才能激活。
- [ ] 同一 `:8000` 的 oMLX/vLLM/SGLang 依据 signature 正确区分，未知实现保留 custom 标识。
- [ ] 只支持 text+stream+cancel、明确不支持 tools 的本机模型可生成 `plain_dialog` Capability并进入 `conversation_ready`；该来源范围内工具按钮、tool roundtrip、Execution workflow和依赖工具的动作全部隐藏/禁用。把 text-only 报告伪装为 tool dialog、或因无 tools 把本来可对话的本机模型降为 blocked，二者测试都红。
- [ ] Podman AI Lab 使用独立 product identity和官方公开的 model-service metadata，不把任意 Podman container当作AI Lab；`ready/api_disabled/no_model/stopped/port_conflict/unsupported_version` 六态各有 fixture、唯一主动作和返回原卡恢复。explicit-active阶段只读检查 service/loopback endpoint，不安装 extension、不创建 Podman machine、不下载模型、不创建或启动 service。
- [ ] server 停止时不改 active config、不静默转云；提示唯一主动作“查看启动方法”，换来源只是次级链接。Docker/Podman stopped container journey 从静态提示到 explicit-active 只读确认和处方均有 UI/TCK report。
- [ ] 自动轮次的请求数、文件打开集合、字节和墙钟符合 DiscoveryBudgetReceipt；未知端口、401/403、PATH shadow 都不会被误认或执行。
- [ ] detector TCK 证明一个 detector hang、抛错、返回候选洪泛或越界读文件时被独立熔断；随机打乱 registry 顺序、1000 个恶意 detector 与多 publisher 洪泛时，deterministic fair scheduler 仍给核心 detector 固定最小份额，结果与输入顺序无关，其他 detector 与缓存首屏仍满足 §12.1。
- [ ] `explicit_active` CLI/容器 metadata 只有在当前 OS 的 discovery sandbox 通过直接 syscall canary 时运行；只有 env cleanup 的 backend fixture必须保持 static inventory/manual UI，零子进程。
- [ ] passive loopback metadata只在已经 accept/connect 的 held socket上核验 literal-loopback peer、listener owner、PID start identity、binary和零应用字节状态；验证后继续使用同一 socket。端口抢占、验证后重绑、HTTP库另开连接、未知平台或 peer漂移均零 packet，不允许“先查 PID 再重连”的 TOCTOU 路径。
- [ ] credentialed/可能计费 metadata使用完整 bootstrap或 established admission：bootstrap显式绑定 candidate rights/billing/data、proposal/disclosure/accepted decision，established绑定现有 active policy；两者都走 durable cursor、physical lease、send intent、terminal、result与 ledger。崩溃未知只到 `delivery_unknown`，不能借 metadata 名称绕过费用或凭据审计。
- [ ] `evidence-store-budget-v1` 对 active temp与 potential orphan使用同一个原子 admission余额；并发 writer、rename前崩溃、恢复扫描与清理的 N-1/N/N+1证明两者合计从未超过上限，不分别各吃一份 cap。
- [ ] 新增一个标准 loopback runtime detector 只增加 detector/manifest/fixture，不修改 discovery orchestrator 或 UI 分支。
- [ ] macOS/Linux/Windows 从最终 distribution 对本地 inference 模型进程运行 canary sync file、temp/log、pipe/shared memory、helper、既存 socket 与 inherited FD/HANDLE逃逸；任一可达出口没有 OS deny或逐出口证明时，本机隐私 gate非零，且 Activation不能引用 network-only sandbox替代品。

定向门禁：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 4 --json
```

Phase 末：`just ci`。

### Phase 5：订阅、Agent surface 与 bridge

目标：把用户已有订阅和开源工具接进来，同时不越过上游授权边界。

每个项目是独立子批与 feature flag，不共享“本 Phase 全开”状态：

1. Codex App Server stdio：owner 完成 D8 归属裁决后，生成并绑定当前版本 schema；WebSocket 实验路径不用于生产。旧 CLI one-shot inference 按 §6.2 迁移或 hard stop，不把“有订阅登录”直接推成分发授权。
2. OpenCode Server/ACP：接官方 HTTP/OpenAPI 或 ACP，审批和工具事件保留；loopback Basic auth 是一等 auth。无法逐工具执行前 gate 时只 inventory。
3. Kimi Code Server/ACP：只作为 Execution Agent 候选；Inference Supply 已在 Phase 3 使用官方会员 API，不再做 no-tool 猜测。
4. Google 分两批：Gemini CLI 只覆盖企业/Cloud/API key；Antigravity CLI 覆盖个人订阅候选，二者 adapter、rights 和提示完全独立。
5. CC Switch Desktop与`cc-switch-cli` fork分两批；桌面版只接公开Messages proxy并固定opaque限制，管理面只inventory。CLI fork只有其明确版本的机器接口通过独立TCK后才可获得对应control能力，绝不回填给桌面版。
6. Claude Code Router、LiteLLM 与本地客户端配置导入：只接公开 server/route 或用户选择的非秘密 metadata，不扫描历史和 credential store。
7. Cursor、Grok、Qwen、Copilot、Vibe：逐个做 binary provenance、rights、逐工具 gate 和 Execution Agent conformance；除非另有 OS 级 read-deny 证明，不再作为 inference 槽 adapter。
8. Claude：分发版保持 API-only，除非获得 Anthropic 批准或官方条款/接口明确改变；owner 本地专项不能外推成公开产品能力。
9. Codex custom provider的`auth.command`：仅静态解析受支持schema并显示candidate，passive discovery绝不执行。用户首次确认后在空私有工作目录、固定absolute executable/argv、environment allowlist、网络/sandbox、timeout与stdout cap下单次运行；stdout只可直送secret broker。refresh沿同一definition和cursor重新授权或按已签策略执行，失败、超限、输出无效与delivery unknown均不回显、不落日志、不自动重跑。

所有子批都实现为版本化 `ExecutionDriver`，通过同一 execution TCK、生命周期监督和逐事件权限桥；不得在 daemon 内为某个 CLI 新建绕开 Gate 0 的直连执行路径。

> **重组要求（2026-08-25，决策 2 已签，本提示已从「待定」转为「应执行」）**：上列九个子批按**品牌**切分，与本段「共用同一 execution TCK」的要求
> 存在张力。2026-08-25 实测（§6.2、[`../review/2026-08-25-agent-cli-acp-capability-survey.md`](../review/2026-08-25-agent-cli-acp-capability-survey.md)）
> 显示 goose、opencode、kimi、gemini、copilot、qwen 六家均可作为 ACP server 应答同构 `initialize`。
> **若 §14 决策 2 选择引入 ACP 适配层**，本 Phase 应改按**协议**分批：
>
> 1. `acp_stdio` / `acp_http`：一个共享 ACP driver + 一套 TCK，覆盖上述六家及 §9.4 中同类长尾条目；
> 2. `app_server_stdio`：Codex 专有协议，独立 driver，与 ACP driver 共用双向会话抽象；
> 3. `cli_stdio`：Claude Code、Cursor 等无回话通道的 CLI，沿用现有 hook 拦截形态。
>
> 重组后子批数与 TCK 套数都显著下降，且新增一个已实现 ACP 的 agent 通常只增加 registry 条目，
> 不再新增 driver。**决策 2 已于 2026-08-25 裁决采用本方向**；现有九个品牌子批保留为重组的输入清单，
> 由本专题正式排产时（决策 1：`w54b-wiring` C3 收口之后）执行重组。第三方 driver 只有在当前平台通过 §4.10/§4.13 的 OS-enforced sandbox 与直接 syscall 负例后才可运行；否则只 inventory。空环境、临时 HOME 或普通同 UID 子进程不能被称为限权。

Execution surface 使用互斥 kind：`cli_stdio | app_server_stdio | acp_stdio | acp_http | agent_http`。ACP 不能用一个含糊分支同时代表 stdio 与 HTTP；每个 kind 对应准确 binary 或 endpoint identity、wire profile、sandbox/peer producer 和 secret contract。

验收标准：

- [ ] Codex command auth从config snapshot到candidate、authorization subject、proposal/disclosure、single-use consumption、process lease、pre-intent或send intent、typed terminal、broker credential和refresh cursor形成无环DAG。静态发现命令执行数为0；跨definition/index/provider/distribution/lease/intent/terminal/cursor，shell字符串、relative executable、额外env、超时/超输出、失败输出持久化、delivery unknown自动重试或并发refresh sibling全部失败且secret不进入UI/语音/日志/普通receipt。
- [ ] 每个启用的 subscription connector 都有官方 source URL、审核主体、policy version、checkedAt/expiresAt、termsDigest、product/surface/distribution/edition/useCase/operation 和自动超额语义。
- [ ] 每个 Execution Agent surface 都有 auth principal、resource scope 与按 operation 命中的 Rights/Billing/DataBoundary policy；Kimi/Codex/OpenCode 等不因不占 inference 槽而跳过费用和数据去向提示。
- [ ] rights unknown/forbidden 的已登录 CLI 不进入推荐，不发真实 prompt。
- [ ] CLI/App Server/ACP 只通过其官方 surface，测试证明没有读取或转发本地 OAuth refresh token。
- [ ] App Server/ACP 的 dispatch Gate 0 与每个 tool/read/write/command 执行前 gate 都有 receipt；未知事件、gate 不可达或 S3 语音请求 deny+kill。
- [ ] loopback ACP/HTTP 逐 dispatch 验证 socket owner、PID start identity、binary/publisher、config generation 和一次性 challenge；只匹配端口、OpenAPI 或 health signature 的伪进程不能复用旧 `LocalExecutionPeerReceipt`。无法为用户已启动实例建立强身份时给出“由 SayDo 安全启动”处方或只 inventory。
- [ ] 同 host/path 的 `acp_http` 与 `agent_http` 分别使用绑定 surface/wire profile 的 `ExecutionEndpointIdentity`；`acp_stdio`/`app_server_stdio`/`cli_stdio` 绑定 binary identity。五种 kind 不与 inference Chat/Responses/Messages 或彼此共用 endpoint/process receipt、连接池、peer、hard-stop 键；模糊 `acp`、伪填 inference protocol 或 stdio 带 HTTP endpoint 的 schema直接拒绝。
- [ ] Activation 只冻结 peer/sandbox/funding/credential policy template；任何 spawn/connect/stdio handshake/session-create byte 前先生成 admission，冻结 aggregate turn/physical/funding cap、Gate与严格 `ExecutionCredentialStateReceipt`。stdio 恰好命中 empty/no-secret，HTTP credential surface恰好命中非空 component+egress+ACL；二者皆无、并存或伪造不存在 secret均由 schema拒绝。真实 peer/process与 runtime sandbox建立后才生成 session lease；把 admission放到 session start后必须由 canary证明已有字节并测试红。
- [ ] session start 本身使用 `StartCursor → StartLease → StartIntent → StartTerminal → SessionLease`；local spawn与remote connect分支严格区分，intent在任何process/network/stdio/session-create字节前持久化稳定外部session/process identity、credential/local-compute closure与费用reservation。started terminal才允许SessionLease，before-send失败释放，after-send/delivery-unknown保留hold并只允许权威adopt/cleanup/reconciliation；两个daemon、旧cursor、start双击、kill在五个边界或把事后sandbox证据补到intent均不能启动第二个Agent/session。
- [ ] start recovery使用独立`recovery_ready → query_in_flight → still_unknown/recovery_ready | resolved_terminal` cursor；权威采用既存session、权威证明不存在、关闭orphan、仍然unknown四个查询结果互斥。still-unknown保留stable identity与hold、递增revision/backoff并可再次查询；双query sibling、旧query迟到或绕过backoff失败。仅采用分支可产生SessionLease，且绑定原delivery-unknown terminal的peer与sandbox；absent/closed只允许新admission+新start identity。无查询authority时，single-use本地人工处置只能接受独立operator absence evidence，或永久封锁identity并保留hold，不能重新使用原start lease。no-new-spend分支账务为空，metered/unknown分支保留非空terminal ledger/hold。
- [ ] local 分支的真实 Agent进程树绑定已验 binary/file、spawn、root PID-start、全部子进程、workspace/mount、inherited handle与 ambient close、filesystem/sync/temp/log、IPC/shared memory、credential-store、permission/data scope与 egress；driver/helper sandbox不能代替。remote 分支的 authority policy精确绑定 endpoint/service principal和双方不同 trust domain；每个 session/physical lease现场取得绑定 nonce、lease core/commit token、route/surface、measurement与 generation的 single-use attestation。G1 attestation挂到G2、template复用“fresh”值或服务自签均零 session/零请求。
- [ ] CLI/stdio 从同一 no-follow 已打开对象启动，或从 SayDo 控制的 content-addressed immutable staging 启动并核对 spawned image。校验后并发替换 PATH、symlink 或原文件的 fixture 仍只能运行已验 content+file identity，否则零 session。
- [ ] 每个已启用 surface对每个 operation生成唯一 funding template。known meter template的 worst-case/physical cap必填；session consent公共字段绑定 admission subject、session/operation/template/component set、总 physical count、disclosure/user decision、generation/expiry/revocation/turn/wall cap，known分支另绑逐单位金额，unknown分支明确承认价格/hard cap不可得。admission上限只能等于或小于 consent。Execution no-new-spend只接受专属 proof的订阅硬 cap或 pre-spawn owned-capacity admission，Inference proof/套餐名/proofClass无效；unknown metering不进推荐/fallback。
- [ ] 每个 session有 durable request cursor；每 turn取得 dispatch admission，每个真实模型/API请求把 cursor置为 in-flight并与 reservation/sent原子提交，terminal CAS后才允许下一 request。`ExecutionSessionCloseLeaseReceipt`与`ExecutionTurnLeaseReceipt`竞争同一session cursor/revision的single-successor CAS，close terminal只观察物理结果而不再次提交独立CAS。close lease在intent前失败必须用准确authority inventory closure进入close-retry-ready；不得永久封锁identity，且下一次close可重新取lease。close intent后delivery unknown才可进入typed query/manual permanent-block路径。close/turn sibling、重复close commit、前驱未 terminal、超 consent或 admission turn/physical/金额 cap、Agent直连broker、旧 cursor replay或换 endpoint/route/body都在首字节前拒绝。
- [ ] Execution把session、turn与物理request分成三层durable状态。turn `delivery_unknown`进入`reconciliation_required → reconciliation_in_flight`；reconciliation lease先不授予任何动作，`authority_query`与`effect_cleanup`使用不同intent/terminal，cleanup只能消费权威query得到的cleanup-required disposition，两者before-intent都逐authority释放。只有具名`authoritatively_resolved | cleanup_confirmed | permanently_blocked_with_hold`terminal可被session terminal消费；`still_unknown`只能带同一identity/hold和退避返回required。人工cleanup/permanent-block必须消费专属local proposal/disclosure/decision。任意receipt、错action kind、query未证明cleanup、错turn、错identity、漏hold或still-unknown均不能终结session或取得下一turn。
- [ ] session、turn、request sequence与tool request各使用状态专属cursor：session仅在ready取turn lease并进入turn-in-flight；request仅在dispatch-admitted ready取physical lease并进入request-in-flight，tool call成功后只能进入awaiting-tool-results；tool request仅从initial/ready取得external-request或effect lease。每个lease、send/effect intent、terminal和results-applied逐字段等于predecessor last lease及revision，不能从宽泛union或可选字段构造非法笛卡尔积。
- [ ] 每个模型物理terminal都绑定准确lease/send intent/request及`ExecutionResponseEvidenceReceipt`：raw inventory、decoding plan、loss、权威/advisory extraction、result与tool occurrence在success-with-tools、success-without-tools、provider-failure、partial/unknown分支互斥。成功且产生tool calls时，先从同一raw inventory完整映射唯一`RegisteredToolInvocationSetReceipt`，再按精确 occurrence创建 `ToolInvocationReceipt`；`ExecutionToolResultsAppliedReceipt`证明 registered set、invocation set、全部 final transition和回填结果无漏无重无注入后，request cursor才回到ready。无tool成功分支显式记录count=0；遗漏raw字节、用摘要替代result、丢失response仍宣称成功、重复/乱序/伪造tool call、未terminal child或把上一轮set借来都不能继续下一模型请求。
- [ ] session/turn/request/tool external request/effect分别拥有 before-send、after-send、deadline、hard-stop、delivery-unknown和zero-work terminal；零turn/零request分支以权威零发送ledger closure收口，不能留下永远in-flight cursor。每个terminal都生成后继revision并被最终session terminal与terminal session cursor强绑定，deadline或取消不能靠省略terminal释放费用/资源。
- [ ] zero-turn、zero-request与zero-tool-work只能从各自initial cursor生成一次且证明无发送、无effect、零ledger；`session_closed_before_request`是独立窄化constituent并投影`session_closing/terminal`，旧session lease永不回ready，重连必须新admission/start。local state write的committed/not-committed分别是可`Extract`的真实constituent；正向fixture覆盖local committed→commit→record result、local not-committed→abort。人工`effect_committed`后可经专属final result分支收口，并强绑原unknown cursor、owner decision/effect evidence/result；与普通commit cursor交叉拼接必须失败。
- [ ] HTTP surface的 credential-state逐 hop冻结 application/proxy/mTLS/OAuth-client component与 broker ACL/egress完整集；stdio冻结空集合+no-secret proof。secret version、允许读者、ACL principal或 egress扩大立即 abort session；仅清 env、`0600`文件或 driver承诺看不到 key不能通过。
- [ ] `execution-billing-fold-v1` 的正反例覆盖 session/attempt reservation、每个物理请求、全部 component、权威 usage 与 terminal ledger；漏项、重复、错 account/funding、迟到 usage、route 漂移或 component 实账击穿 runtime worst 只能得到 `charge_unknown`/anomaly，不能构造 settled。崩溃恢复、续 turn 和再次 dispatch 前都重验同一 fold。
- [ ] host 为每个持久 workflow intent分配稳定 logical tool ID。正常链以 predecessor+revision CAS走 `none→authorized→executing→executed→result_recorded`；hard stop在 commit lease前且有 no-effect evidence时允许 `authorized|executing→aborted`，并记录费用释放/hold，四个 kill point均能收口。无法排除 effect时只能 `executing_unknown`；恢复 lineage不明时人工调和，不能按参数相似度新执行。
- [ ] 工具的 idempotency key 绑定 logical ID、tool semantic version、arguments、resource scope、execution subject 和用户意图 generation，不含 attempt/toolCallId；相同 key+不同 digest/scope hard stop。四个 kill point、两个并发重复事件、旧 generation Gate 和乱序 transition 均不能取得第二个执行权。
- [ ] 每个 irreversible rename/外部 commit/process/network effect 紧前取得短期 single-use `ExecutorCommitLeaseReceipt`；hard-stop 先阻断新 commit lease，旧 lease只有提交并持久记录或 abort/`executing_unknown` 后才线性化增代。没有 prepare/commit、上游 idempotency 或权威 effect query 的动作崩溃后只人工调和，不自动重放。
- [ ] 每个 tool external request在首字节前冻结准确 endpoint/method/body、network、Rights、DataBoundary、Billing、transport、credential、consent与readonly/side-effect分类；tool response以绑定同一lease/send intent/request的`ExecutionToolResponseEvidenceReceipt`保存raw inventory、decoding/loss和权威result occurrence，不能只留provider摘要。只有read-only可走普通sent retry/terminal。side-effect请求消费绑定同一request ordinal/policy closure的commit lease后，success、sent-500/4xx、response-loss、cancel/deadline-after-send全部只能进入`effect_in_flight`；typed idempotency/effect query再判`committed | authoritatively_not_committed | delivery_unknown`，只有权威未提交且预登记edge可回ready，unknown只到`executing_unknown`。普通成功result、committed-effect material、zero-work material与manual committed result四类`ExecutionResultEvidenceReceipt`严格互斥；manual committed必须绑定原unknown effect、独立authority且不存在普通committed terminal。effect terminal与账务一起CAS收口；不能把tool invocation receipt和request cursor互相引用形成摘要环。
- [ ] 人工调和也先经过local proposal/disclosure/accepted decision/single-use consumption；decision只允许`effect_committed/result_recorded/no_effect`等事前列明 outcome，并与准确logical tool/session/turn/subject/uncertainty绑定。两个操作者、重复点击、过期decision、选项外结果、decision已消费后重放或用“继续”泛化文案改写effect terminal均不能推进CAS。
- [ ] 工具自身调用第三方付费 API时使用独立 biller/account/component reservation与 terminal ledger；tool consent在参数/scope已知后绑定 component set、最大 physical calls、披露与用户决定，known分支另绑逐单位金额，unknown分支明确承认无权威金额。本地文件工具使用 no-external-charge proof。拿模型 session funding代替、漏 component、超过 tool cap、跨 tool重放或以 session泛化同意代替 unknown-metering tool consent均在副作用前拒绝。
- [ ] CC Switch Desktop public proxy只以`route_opaque/failover_opaque/externally_metered_unknown`通过：签名产品、loopback peer、Messages wire与逐次主动确认准确绑定；自动推荐/fallback/evaluator/tool/background/no-new-spend全部负例零请求。版本、process/listener或公开proxy generation变化立即停止并重测，不能保留或声称知道旧路由。
- [ ] 只有具备公开、不可绕过route authority的其他bridge才可冻结完整retry/failover ordinal序列；A sent→timeout→B success的费用与token按序列总和预留并分别记账。CC Switch当前公开代理不满足此分支，不能借generic bridge能力生成RouteSet或动态调用授权。
- [ ] 订阅型Codex/Kimi stdio使用账户创建/登录/billing/OAuth图；已安装的OpenCode Server/ACP与CC Switch使用独立本地surface图，只从installed/not-running起点走公开binary/loopback证据与验证，不凭空要求provider账户或billing。OpenCode HTTP有密码和无密码两条fixture并使用可容纳最多一个optional secret field的signed tier；ACP stdio与bridge不出现伪造password/key字段。跨挂OAuth图、本地图或错误tier均使requirement journey gate失败。
- [ ] bridge transport 账号与每个真实 compute 上游账号分别进入 resource subject；交换成员的上下游 principal/scope，或复用另一成员的 ComputeBoundaryCore、ComputePolicyBinding、Capability/费用授权时，调用前 generation CAS 与 policy match 均拒绝。
- [ ] Kimi Extra Usage 或其他自动超额无法关闭/确认时，不进入“尽量不新增费用”方案。
- [ ] 订阅限流与登录过期不静默转 payg；付费切换 receipt 可审计、可撤销。
- [ ] 本地 inference + 远程 Execution Agent、远程 Agent tool/network egress 与 unknown Agent surface 三组反例都使“本轮数据不出本机”不可显示；提示展示实际已知去向或“需确认”。
- [ ] 本机 Execution data-locality TCK 在最终 distribution 启动前预置可读 canary mount/sync dir/temp/log、pipe/named pipe、shared memory、Unix socket、network socket 与 inherited FD/HANDLE；Agent 进程树要么 OS deny 全部未授权出口，要么每个出口有本地证明。任一 canary 可达时不生成本机隐私 receipt，且不会因网络被禁就忽略文件同步/IPC 外泄。
- [ ] Gemini 个人账号只提示 Antigravity 路径；Gemini CLI 不再产生错误的 Pro/Ultra/free 登录主动作。
- [ ] 7 个现有 wired CLI binding 都有迁移 fixture：安全替代通过则 staged 切换；否则 hard stop、保留上一版恢复入口，不再发送 prompt。
- [ ] security/sandbox/protocol/Gate feature flag 的 `revoke_disable` 在 session 中途关闭时原子增代、阻断新 send/tool/commit lease并 abort plugin、Agent、socket 与完整子进程树；纯展示 `drain_disable` 才只挡新 session，运行时管理员不能改分类。
- [ ] session lease 的 `temporal-validity-fold-v1`从完整 Rights/Billing/Data/sandbox/Gate/authority/plugin/credential闭包重算最早 expiry；漏掉更早 receipt、可信时钟回拨或 daemon重启都 fail-closed并按 hard-stop恢复，不能让 producer自报较晚期限或把旧 consent延到新 session。
- [ ] permission、data access、egress、Agent/driver artifact 或 sandbox policy 更新只可下载/预览；任一扩大都使旧 generation在途撤销并要求新 consent，不能凭 publisher 相同自动激活。
- [ ] execution surface matrix逐一构造`cli_stdio/app_server_stdio/acp_stdio`三个local process-tree正例，以及`acp_http/agent_http`各自的`loopback_local`和`remote_service`正例；stdio只能取opened/staged binary+PID-start+stdio identity+local sandbox，loopback HTTP只能取held local peer+local process-tree sandbox，remote HTTP只能取remote service identity+independent authority+`upstream_attested_agent` sandbox并使用remote start kind。七个正例都可达，任意surface、connection mode、endpoint/binary、peer、sandbox或start kind两两换挂均在schema、strict TypeScript、CAS和黑盒TCK四层失败。
- [ ] turn unknown的`authoritatively_resolved | cleanup_confirmed`terminal先以其`resultingSessionCursorRevision`唯一生成新的`ExecutionSessionReconciledCloseReadyCursorReceipt`，close lease只能消费该新revision；reconciliation terminal和session close不得竞争同一in-flight revision或直接互相替代。`still_unknown`、query要求cleanup、cleanup delivery unknown和永久block分别有唯一后继。manual committed effect必须走`executing_unknown→manual_reconcile→executed→record_manual_committed_result→result_recorded`，并绑定原unknown effect、owner decision、独立result authority与raw occurrence；普通committed cursor不能借该分支。
- [ ] execution TCK 从实际发货 Agent/driver/sandbox入口覆盖 pre-session admission、五种 surface、严格 credential/no-secret联合、subject-bound authority、turn/physical terminal cursor、专属 no-new-spend proof、consent金额/physical cap、全 component fold、任务恢复、工具 abort/effect-once/commit lease、取消、未知事件、stdout/stderr洪泛、子进程树 kill、版本不兼容，以及三平台直接 `open/connect/exec/credential-store/process-inspection/foreign-IPC` 与继承 handle逃逸负例；换成普通同 UID child、漏 ambient handle close或让 Agent直连网络的 mutation必须红。

定向门禁：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 5 --json
```

Phase 末：`just ci`。

### Phase 6：推荐器、首次引导与被动提示

目标：把底层能力变成“不需要用户苦恼配置”的产品体验。

实施项：

- 硬约束 + 可解释打分推荐器，取代当前列表首项和“全用同一 CLI”。
- 首屏按 `candidate/connected_verified/conversation_ready/review_ready` 显示“一套推荐 + 四个意图模式”，连接验证与整套方案可启动不再混写，四槽移入展开详情。
- provider-first 添加服务、动态字段、model picker、custom advanced flow。
- AI 服务状态中心、健康 drift、额度、费用和 rights 提示。
- 登录动作通过本地 terminal/官方浏览器流程；给出一条可复制命令作为 fallback。
- 复用 staged → 自检 → restart → live 两轮进度，并显示取消/原配置仍可用。
- 自检前从实际 authorization/InvocationEnvelope 展示 ingress、全部物理请求、最大 token 和逐 biller/account/unit 金额；单次授权与持久预算分开操作，不用一个 checkbox 同时代表两者。
- 连接成功与日常付费授权分开呈现：payg 来源可以“已连接、付费调用未授权”；只有用户当前单次确认或另行建立持久预算后才发送日常请求，授权过期不要求重配连接。
- 对 `zh-CN/en-US/ar-SA` 建立 typed ICU 对等 catalog，另建`en-XA` pseudo locale、最长文本与 screen-reader golden；`ar-SA`通过 RTL layout/mirroring/input/bidi TCK，不让 provider ID 泄漏到主提示。
- 从canonical platform/locale/presentation/viewport/zoom/modality/screen-reader轴生成不可缩小的972-cell a11y key map；每个cell保存DOM、accessibility tree、focus、live region与截图证据，matrix root和actual closure均绑定当前distribution，禁止测试端自报expected subset。
- provider卡片、协议徽章、费用/route限制、主动配置字段与被动状态提示只消费当前发行物的`PublishedSupportClaimSetReceiptV6`和用户当前readiness；UI组件不得自带provider能力常量或用品牌名补全未发布协议。

验收标准：

- [ ] a11y release closure精确覆盖972个唯一key且全部pass；缺失、重复、额外、跨平台/locale/distribution借报、把`en-XA`当真实locale、复用light证据冒充dark、复用LTR冒充RTL或调用方缩小expected matrix均非零。
- [ ] 已有有效 receipt 且无新增按量费用的单供给最多 1 个 SayDo 动作进入 `conversation_ready`；`local_service_ready`候选自动验证为0个主动作，其他本地初态先显示一个准确处方入口，再按签名recovery scenario执行最多3个主动作，未到恢复终态绝不能通过。guided key在`signed_in_ready`起点最多2个主动作，`signed_in_no_billing`最多3个，`no_account/account_exists_signed_out`且缺billing最多4个；厂商侧凭据创建与SayDo侧secret录入分别计数。guided OAuth在所有已有账户起点都先执行授权/兑换，再做权威entitlement观察，不用网页登录态跳过credential exchange。费用确认由独立authorization与预算合同计量。enterprise/custom不借用上述窄上限，必须使用自己的签名tier。所有路径先经过`connected_verified`，单row都不伪装成`review_ready`。
- [ ] 只差登录时，主路径只出现一个“打开登录”，登录成功后自动回到原卡并重探。
- [ ] Ollama 无 key 卡片不出现 key 字段；Anthropic 不出现 OpenAI protocol 选项；Bedrock 不要求填 AWS secret。
- [ ] 默认视图不要求用户理解四槽；高级视图仍能逐槽覆盖并解释 evaluator 约束。
- [ ] 推荐结果不依赖输入数组顺序；相同画像产生相同方案和理由。
- [ ] 自动 fallback 只显示 snapshot 中已编译的有限完整 SupplySolution；集合外失败终止本次请求并为下一请求后台重编译。任何新增付费、数据去向或 evaluator 独立性变化都先给一个明确动作，绝不由被动错误处理器临时拼装。
- [ ] no-new-spend、本地优先、质量优先、低延迟四模式有正反例 golden。
- [ ] staged 失败时明确“仍在用原来的方案”；不会显示已激活。
- [ ] rights unknown/forbidden 时先显示权益动作，不出现 key 输入；no-new-spend 的任一费用/route/overage unknown 都会停下。
- [ ] 所有被动提示都只有一个主动作，技术详情默认折叠。
- [ ] 每个状态由纯函数返回唯一 machine-readable `primaryAction` 与可选 `secondaryLink[]`；DOM/a11y 测试证明同一卡没有两个 primary button，“A 或 B”文案也不能生成两个主动作。
- [ ] 事前费用 renderer 与 `AuthorizationDisclosureReceipt` 的全部允许序列/最坏上限逐项相等；事后 `ActualAttemptReportReceipt` 才与 ledger `sent` 一一相等。实际 sent 必须是已披露序列的合法前缀或成员序列且不超数量/逐 component-unit 上限；staged/live、custom 双协议、首项成功、失败后第二项成功、gateway retry/failover 与 `charge_unknown` 均不硬编码“1 次入口请求”。
- [ ] `review_ready` 有独立的纯函数 view model、唯一主动作和次级独立复核来源；其唯一producer必须消费按`dialog/thinking/cheap/evaluator`排序的四元素slot qualification tuple，每项逐一同值绑定solution tuple成员、当前Activation pointer、`chat`成功terminal、conversation-ready journey gate和同一distribution，evaluator项再与solution的cross-slot独立性proof同值。缺槽、重复槽、slot/binding/pointer/terminal/gate/distribution换挂、用单row自报或用另一份independence proof时类型、schema与release gate均失败。evaluator失效时确定性降级为`conversation_ready`并播报变化；`zh-CN/en-US/ar-SA`、独立`en-XA`、窄屏、200%、RTL与screen-reader snapshot都覆盖该组合状态。
- [ ] 每个fixed requirement的required正向journey必须使用该row准确的`zero_config | guided_oauth | guided_key | enterprise_managed | custom_endpoint`，control plane另按anchor-control profile投影，且class/tier机械选择受签profile中的唯一精确UX limit；`advanced_configuration`、`action_required`和`blocked`只作为独立负向fixture，不能生成pass report。每个graph step以`user_primary_action | automatic_after_predecessor_success`严格判别：实际访问的user-triggered step恰有一个带准确`journeyStepId+actionId`的event，automatic step不得带`primaryActionId`或产生点击event；最坏账户起点沿全部前向路径重算主动作上限。每条run对`not_enrolled/ready`分别执行，SayDo动作、外部任务分类、MFA、copy/paste、手填字段、provider step、离开/返回、错误恢复、raw/app time都从前置enrollment与主journey的完整typed event并集重算。登录步骤的MFA条件子任务必须同时跑有/无挑战fixture，nested event绑定父task nonce且共享一次离开/返回区间；0/1/2、边界超1、自报宽limit、漏事件、伪造automatic和快速多次往返均有mutation。任一actual越界、漏MFA分支或final readiness不等definition expected都只能fail/incomplete，GA gate非零。
- [ ] 每个required run直接携带由81行requirements派生的exact typed reference run subject，而不是只带一个泛化`startingAccountState`字符串；platform、locale、anchor起点、真实账户起点、graph entry、recipe、required field set、runtime states与compiler-selected assertion plan逐字段同值。guided key的`no_account/account_exists_signed_out/signed_in_no_billing/signed_in_ready`、OAuth、workload identity、existing profile、本地ready与独立recovery scenario、custom ready各走符合其认证语义的不同entry path；任何generic signed-in替换、跨recipe/graph entry换挂、把负向前置观察伪装为成功后置状态或路径所需动作超过本tier签名上限均失败。
- [ ] `GaUxMetricReducerReceiptV4`从单一按ordinal和monotonic clock排序的typed event log总函数派生全部指标：external task、administrator wait、foreground interval与leave/return均使用同nonce成对，copy/paste逐occurrence计数，raw time等于run terminal减start，app time等于run区间内foreground并集；手填字段以准确`fieldId`匹配当前run recipe，不信任UI自报class/count。漏terminal、clock boot不等、interval重叠、重复nonce、字段漏记/注入、后台时间压缩或被动刷新抢焦点任一mutation均失败。
- [ ] 完全自定义端点的OpenAI Chat、OpenAI Responses、Anthropic Messages、mTLS-only与custom secret header五条reference journey分别执行；它们作为representative fixtures之外，再由`ResolvedCustomEndpointAuthenticationReceiptV6`穷举三协议×四种application auth×两种mTLS状态的可达/不适用矩阵。`base_url/protocol/model_or_deployment`及所选auth的全部条件字段通过`recipe_field_group`展开为逐字段typed event，字段数和class命中`custom_endpoint`自己的signed limit。页面实时显示最终method+URL、认证注入位置、proxy可见性和首测费用状态；Anthropic不会出现OpenAI path，Responses不退回Chat，认证关闭时零旧credential，秘密header不能伪装public header，未知计量只能在用户主动逐次调用中出现。公开支持产物只列有requirement+claim的已验组合，不把通用自定义能力冒充厂商preset。
- [ ] 复验 Phase 3/5 已前移的 DataBoundary Playwright 门，并做完整 UX 打磨：只有纯本地且本轮所有 inference/Execution/tool/network data-egress subject 都有本机证明时可显示“本轮仅使用本机处理，已限制已知数据出口”，且同屏可达设备级残余说明；任一远程或 unknown 节点均禁止。
- [ ] 键盘、screen reader、light/dark、desktop/mobile 全部通过。
- [ ] 支持页、连接picker、测试矩阵、release note与运行中provider卡片对同一claim set digest逐字节投影；注入一个未列协议、把CC Switch opaque route写成已固定、把roadmap inventory写成已支持或让四个产物使用不同digest时，截图/生成器/release gate全部非零。
- [ ] `zh-CN/en-US/ar-SA` 的 ICU key、变量类型、plural/select、BillingUnit 格式完全对等；真实用户 locale 数必须恰为3且`en-XA`另计为1个 pseudo suite。缺 key/变量、pseudo locale 截断、200% 字号、最长错误/模型名、窄屏、RTL layout/mirroring/input/bidi或screen-reader snapshot任一失败使门非零。
- [ ] Docker/Podman stopped-service journey只有一个“检查本机容器服务”主动授权和一个“查看启动方法”主动作；自动阶段零CLI/socket，确认阶段不启动/拉取/加载，返回原卡后状态连续。Docker Model Runner与Podman AI Lab分别有具名entry和journey；后者逐项覆盖ready、API未启用、无模型、stopped、端口冲突和不支持版本，不能用普通Podman容器报告冒充。
- [ ] 缓存首屏、静态候选和完整推荐只引用 §12.1 的同一 SLO；基准样本、机器和 OS 可复现。

定向门禁：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 6 --json
```

视觉门禁：重新生成并人工核对 setup、AI 服务状态中心、登录过期、本地服务停止、额度耗尽五组 light/dark 与窄屏截图。

Phase 末：`just ci`。

### Phase 7：云 IAM 与长尾生态

目标：让已有 AWS/GCP/Azure 企业账号与更多本地/三方网关不用改成静态 key 才能接入。

实施项：

- Bedrock Converse/Stream与官方当前兼容route；named static profile、role/SSO/temporary session与Bedrock API key各自有独立auth journey，且不使用无界default chain。
- Vertex ADC + project/location/model discovery。
- Azure OpenAI/Foundry + API key/Entra/Managed Identity，deployment/model 分离。
- Cloudflare Workers AI/AI Gateway、Hugging Face Endpoint、NVIDIA NIM presets。
- registry L2 provider 与 local runtime 长尾；达到专用 adapter 触发条件再实现原生协议。

验收标准：

- [ ] 无需把 AWS/GCP/Azure 长期 secret 复制进 SayDo UI。
- [ ] 多 account/project/region 不猜；显示实际选择并纳入 receipt。
- [ ] IAM 403 与模型未启用、region 不支持、quota 429 分别提示。
- [ ] cloud connector 不自动创建部署、开通模型或修改 IAM。
- [ ] 企业 proxy/VPC endpoint 仍过 network policy，不因云 provider 身份跳过 SSRF 检查。
- [ ] 自动 discovery 的 sentinel 证明没有执行 `credential_process`、CLI/helper、浏览器登录或 metadata；显式 IAM 动作只在隔离 credential worker 访问固定官方 origin。
- [ ] principal/account/role/project/tenant/region/deployment 与 credential source digest 全部进入 receipt，身份改变 hard stop。
- [ ] workload identity在任何 STS/metadata/helper请求前创建持久 issuance cursor与single-use request lease，terminal后原子提交 credential family；每个物理 API请求再消费绑定 principal/source/role/session/audience/region/expiry的 credential lease。两个 daemon、旧 epoch、旧 source attestation、并发 issuance或 credential重放均零发送。
- [ ] AWS named static profile只读取用户明确选择的 shared credentials/config profile，并生成独立静态 SigV4 signing authority；role profile、SSO、web identity、credential process与metadata分别走 workload producer，自动发现阶段一律不执行。profile名、account、role、region、source文件identity或credential version漂移会 hard stop。
- [ ] declarative signature extension只有签名profile pack可用，表达式限制在固定method/path/query/header/body canonicalization、hash/HMAC/encoding原语、host提供的typed可信时间/nonce与其他有界公开输入，secret只以broker handle参与；profile经独立TUF delegated role和TCK签发。任意网络、文件、直接时钟、直接随机、循环、动态代码、任意加密或未声明credential component均拒绝；超出DSL的secret-dependent provider必须走bundled trusted signer安全评审、双人owner批准、独立TUF role、黑盒TCK与正式release流程，code plugin不得获得secret或auth RPC。
- [ ] workload/static/declarative signer的每次 signing lease都精确冻结 method、normalized path、canonical query、完整 signed-header集合、body digest、credential principal/version、host trusted time与nonce；漏签或重排规则不一致的任一字段、插件自报时间/随机数、nonce重放、跨endpoint/profile借signature、过期lease和同lease第二次签名均在网络首字节前拒绝。DSL表达不了的认证不能自动升级为通用code plugin；只有内置受信 signer完成独立评审、双owner decision、TUF发布和黑盒TCK后才可启用。

定向门禁：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 7 --json
```

每个 cloud adapter 使用官方 request signer/SDK fake、recorded schema fixture 和无网络单测；随后跑 `just ci`。真实云冒烟只在 owner 提供隔离账号并确认费用上限后进行，结果落独立 evidence，不作为普通 CI 前置。

### Phase 8：兼容性实验室、灰度与收口

目标：证明“主流开箱”是可持续能力，而不是一次性 demo。

实施项：

- 扩展 Phase 2 已建立的 conformance harness，加入版本化真实服务漂移矩阵和 fixture bundle。
- 发布 `@saydo/connector-sdk`、`@saydo/connector-tck`、连接器脚手架和两个外部参考 connector；公共面保持 `v1alpha1`，直到两个独立维护者的外部 connector 均通过兼容窗口与升级演练后才进入 stable SemVer。
- 对 SDK/TCK 执行真实发布形态验收：生成 tarball，在仓库外 fresh Node 22 ESM consumer 中只从 tarball 安装，运行 exports/types/CLI/reference connector/TCK；前一 minor 兼容测试同样消费已发布 tarball，不使用 workspace link 或 TS 源码路径。
- 生成 protocol/capability/discovery/execution/bridge 五类判别型机器可读 conformance report；不受信 hermetic build/test job 无网络、secret、OIDC 或签名身份，只交 immutable artifact/raw evidence/SBOM。独立 verifier/signing job 黑盒重跑该 digest，才取得短期 OIDC 并签 detached attestation；publisher 自签只标 `community_unverified`。官网、README 和 UI badge 只从受信 report、registry 与当前 readiness 投影生成。
- 对 parser/状态机持续 fuzz，对 snapshot 并发切换、plugin crash、registry 冻结、网络抖动、上游慢读、取消风暴和 secret broker 不可用运行 chaos/soak；保留可重放 seed。
- 每周 registry freshness 检查，只报告 drift，不自动写 active config。
- feature flag 按 protocol/connector/provider 细分；支持逐项回滚。
- 隐私安全 telemetry 只采 connector kind、结果码、耗时桶、capability，不采 URL、model prompt、key、账号或完整路径。
- 迁移仪表：legacy config 数、成功 staged 数、rollback 数、rights blocked 数、需要人工配置步骤数。
- 建立provider test-account asset pool：账号/组织principal/realm/auth/MFA/billing/reset baseline只以受管资产登记，credential保存在独立broker；allocator提供排他lease、逐原生单位预算、并发上限和TTL，terminal cleanup负责资源删除、session/credential撤销、usage/billing hold对账、baseline reset与quarantine。不得由release workflow临时读取maintainer个人账号。
- 把完整deterministic requirement笛卡尔矩阵与bounded live provider qualification拆成两个workflow和两套证据：前者零Internet/零账号lease，后者按product/realm/auth/protocol/funding及必要平台做set cover并连续两cycle通过。任何一套不能替代另一套。
- 先从reference requirements、exact connection oracle、completed journey/conformance evidence、entry/ecosystem gate、live qualification、special funding closure和被测distribution生成固定`PublishedProductProtocolClaimSetReceiptV6`；owner additions另由canonical namespace/compiler与同等级qualification生成claims，再合成`PublishedSupportClaimSetReceiptV6`。由这一聚合集合生成文档支持页、连接picker、测试矩阵与release note；`ReleaseEcosystemBinding`同时绑定support claim set与四件套准确bytes。UI运行时只在claim上叠加当前readiness，避免三套名单漂移；reference minima移除/替换会改变designation并撤销reference-grade/GA，不由owner签一份新baseline继续沿用旧徽章。
- 发布产物生成 SPDX SBOM、SLSA provenance 与 Sigstore 签名；CI 固定第三方 action digest，运行 OpenSSF Scorecard 关键检查并验证 release artifact 与 registry/package digest 闭包。
- 建立 `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`GOVERNANCE.md`、`CODEOWNERS` 与已裁决的 DCO/CLA 流程，公开 connector review owner、TUF delegation、晋升、交接、sunset 与安全撤销 SLA。
- 把普通 CI、nightly 与 release qualification 分开：CI 跑有界协议/沙箱/性能 smoke；nightly 跑三平台完整 TCK、fuzz corpus 与 60 分钟 chaos；release workflow 在 macOS arm64、Linux x64、Windows x64 的固定硬件 profile 上分别跑性能、sandbox 和耐久矩阵，24 小时 soak 使用独立长时任务。三个正式平台的原始报告、runner image/hardware digest、退出码和签名都进入 release digest 闭包，缺任一项阻断 GA。
- 由唯一`AI_SUPPLY_RELEASE_SUITE_IDS_V20`生成签名expected BOM与fail-fast orchestrator，不维护第二份持续release gate清单。37个suite递归展开为`preflight_open + 37 suite + preflight_close`共39行并绑定当前distribution；每行使用`shell:false`准确argv数组、predecessor、环境与raw terminal。只有同一BOM、同一distribution的39项完整passed tuple可进入v20 release producer，任何failed/not-run terminal都只能形成不可晋升的失败receipt。

GA 验收：

- [ ] L0 provider/runtime/agent 清单全过离线 fixture 和当前版本 live matrix；未实测项明确标 beta/inventory。
- [ ] 新用户主路径成功率、需要手填技术字段数、首次可用时间达到 §12 指标。
- [ ] 零 key 误投、零静默付费切换、零默认 LAN 扫描、零 rights unknown 自动调用。
- [ ] legacy 用户迁移有真实 rollback 演练。
- [ ] `runtime-child-registry-v1-to-v2`在上一正式版二进制上完成真实JSON/SQLite双读、spawn/reap、崩溃恢复和降级演练；rollback window关闭前仍保持旧JSON投影，sqlite-only cutover后零未对账operation、零冲突和零in-flight。
- [ ] `just ci`、完整 Playwright、emoji、link、color、migration 门禁全绿。
- [ ] 100 并发流、24 小时 soak、取消风暴、单 plugin crash 和 registry/TUF 离线场景达到 §12.1 工程 SLO，零未回收 socket/process/reservation，结果以 raw benchmark/chaos report 发布。
- [ ] SDK 前一 minor 编译的 fixture connector 可在当前 runtime 握手并通过兼容 TCK；不兼容 major 明确拒绝且给出升级处方。
- [ ] protocol/capability/discovery/execution/bridge五类report严格拒绝不适用身份和占位字段；bridge的inference data-plane与route-control协议依赖互斥且与`protocolId`同值。CC Switch public proxy作为Anthropic Messages inference data-plane正例，且route/funding opacity限制不可移除；LiteLLM三协议分别为inference data-plane正例；CC Switch control只作为负向inventory fixture。跨类、跨协议或用capability报告替代bridge报告的mutation必须红。修改本地runner让测试恒绿后自行签名只能得到`community_unverified`。只有verifier policy钉住的issuer/repo/workflow/ref/builder/provenance重跑结果可投影`core/extended`，policy或builder撤销后旧徽章立即消失。
- [ ] build/test 与 verifier/signing 是不同 runner、permission domain 和 job：前者无 OIDC/secret/network，后者只消费 immutable digest并黑盒重验。把签名 token 注入 build、让 connector workflow自选 verifier、签未经重跑 artifact或在 handoff 后替换 digest 的 mutation全部拒绝；SLSA provenance记录两段材料与 identity。
- [ ] canonical `ConformanceRunPayload` 不含任何 signature/bundle/provenance/release-manifest 反向引用；SLSA subject 与 DSSE/Sigstore payload 都等于其 digest，detached attestation 再绑定 provenance/bundle，最外层 release binding 单向绑定 attestation、SUT distribution 与明确排除 detached metadata的 released distribution payload。替换 payload 任一字段、签错 subject、互换 bundle/provenance/attestation、制造自引用、exitCode 非 0、incomplete outcome 或 fixture 集合未完成均拒绝。
- [ ] protocol/capability/discovery/execution/bridge 的正式 TCK 均从最终 tarball/binary 的 public entry 黑盒启动，payload 精确绑定 shipped runtime、distribution、sandbox helper/policy、platform profile、seed/invocation/exit/raw evidence；fake host 绿而生产 host 改成普通同 UID child 的 mutation 必须红。
- [ ] `pnpm pack` 产生的 SDK/TCK tarball 在仓外 fresh ESM consumer 可安装并直接运行，JS/types/exports/files/license/CLI/provenance 均正确；workspace 私有包、源码 export 或未打包 fixture 不能蒙混过关。
- [ ] macOS arm64、Linux x64、Windows x64 三份正式 sandbox/performance/soak 报告均由受信 runner 签名并进入 release manifest；任一平台缺报、只跑 distribution smoke 或 24 小时任务被普通 CI timeout 截断都阻断发布。
- [ ] Phase 1A的三个native helper/installer、`packages/platform-security`与production witness/IaC均以当前最终分发物重新qualification；package存在但installer未装、helper来自另一artifact、witness是staging/mock或IaC/deployment/threshold digest不等均阻断发布。
- [ ] 合同源以`type-contract-compile-budget-v1`重新生成`TypeContractCompileGateReceiptV20`：锁定compiler/argv/lock/runner下diagnostics与stub为0，手写source、生成source、总source、instantiation、RSS与wall绝对门及相对签名基线门同时通过；无genesis authority重新bootstrap、缺少前任passing gate或owner批准替换baseline、用`any`恢复编译均阻断发布。
- [ ] 最大合法 RouteSet 的 16 members/64 sequences/单序列 16/1024 nodes/1 MiB、全部分单位 fold 与 generation churn 在三平台 release benchmark 达到 §12.1；只测单成员不算。snapshot compiler 预编译 authorization fold，data plane 不逐请求遍历完整 receipt graph。
- [ ] code plugin 单实例和宿主全局预算全部有强制报告：最多 4 active、总 RSS 768 MiB、CPU 2 核、进程 8、双向队列 32 MiB、prepared attempt 32、同 publisher 2；超限新实例 fail-closed且不杀健康 connector。JSON/schema/stream 结构复杂度与 host validation CPU/event-rate 洪泛同样进入三平台 TCK。
- [ ] 上述值只来自唯一`PluginWorkerBudgetProfileV1`、`HostWorkerBudgetProfileV1`及其`PublisherFairSchedulingProfileV1` digest；4个worker严格拆为2个core专用slot与2个plugin slot，plugin不借core容量。公平身份是signer realm的唯一admission/debt/reservation group，多个publisher alias不能复制信用或容量。每个interval先从0–8 exact count tuple证明`tracked=active+waiting`：active为1/2/3/4组时ideal share分别为12/6/4/3 twelfths，waiting组的share、ideal accrual与actual service都必须为0；signed truncate对`-13..13`全部27点逐项golden。只有1–4个连续eligible debt group适用250 permille长期目标、240秒dispatch-start lag与240010 worker-millisecond债务界；第5至第8组进入480秒cohort轮换、600秒active-cohort admission与固定退避，不宣称等待期dispatch或25%份额；第9组立即capacity unavailable。accounting/dispatch/terminal/service-window/cohort/restart receipts必须与独立reference evaluator逐state digest一致；restart固定1小时sliding window，alias churn、边界重启和并发admission都不能重置预算、债务、reservation、cohort或epoch。profile扩大必须新ID、新policy、新consent和新release evidence。
- [ ] `wire-budget-v1`、`host-worker-budget-v1`、`registry-artifact-budget-v1` 与 `evidence-store-budget-v1` 全字段跑 N-1/N/N+1；ContentHandle 的 digest/chunk/backpressure/single-read、四级 aggregate handle/spool/orphan recovery、累计 bytes/nodes/events/occurrences/CPU/wall、archive 与 evidence raw/projection/temp 上限不可被插件/catalog放宽。
- [ ] `static_filesystem`、`passive_loopback_metadata` 与 `explicit_active` 三种 discovery report 的deterministic flat core与`DiscoveryConformanceSemanticSubject`逐字段相等，至少绑定detector identity、provider scope、mode、policy budget、provenance、environment class、detector artifact与configuration generation；live lease、accepted decision、canary instance和实际时间只在与core kind精确映射的`ConformanceRunPayload.runEvidence`。provider-agnostic/specific严格判别；前两者不能互相冒充，core/run换挂、换mode/environment/generation、漏provider profile、把live receipt写入core或任何detector越权网络、host probe越过literal-loopback/method/path/bytes/timeout均撤销该generation。
- [ ] 恶意 signed catalog 尝试新增passive destination/path时零packet；randomized registry order、detector flood、异长job、idle/rejoin、new-ID churn、daemon restart、4个持续publisher、第5至第8个overload publisher与第9个capacity拒绝下，deterministic bounded-service-deficit scheduler从完整occupied occurrence trace逐式回放整数债务、reservation、tie-break、service curve、start-lag、cohort wait与restart restore，每次实现和reference evaluator的state/decision digest一致且不以杀死健康运行job满足公平。三平台explicit-active discovery sandbox的直接syscall canary失败时只inventory。
- [ ] sandbox/protocol/signer/rights/billing/data/TUF/Gate security flag 在 session 中途 `revoke_disable` 的 release chaos 会中止全部在途句柄；只关闭新调用而保留旧 session 的实现阻断 GA。
- [ ] `community_unverified→community_verified→builtin_beta→builtin_stable` 的每次跃迁都要求明确 owner 决策且不得隐式跨级；maintainer 离任转移、恶意 connector/TCK report 紧急撤销、TUF delegated role 回收和无人维护 sunset 都做 tabletop/replay 演练，官网/UI 在撤销后不再展示旧徽章。
- [ ] release 下载者可离线验证二进制、SBOM、provenance、内置 registry snapshot 与 conformance report 的 digest 链；验证失败不安装更新。
- [ ] 81行reference requirements、derivation receipt、reference-grade profile、GA matrix core/baseline、detached decision/evidence/binding的digest、count、非空、唯一复合键、具名minimum、逐auth/protocol/surface journey、受信`completed_pass`、精确集合覆盖与artifact-scope校验通过；替换matrix/probe/binary/evidence、内嵌decision形成摘要环、删除/合并requirement仍保留旧designation、空recipe或把另一protocol/OAuth报告借给key journey均红。OpenAI Chat/Responses、Gemini API、Azure Chat/Responses各四种auth、智谱BigModel/Z.AI、Kimi Code双协议、TokenHub广州/新加坡各三协议、腾讯企业Token Plan广州/新加坡各Chat/Messages、OpenCode Zen/Go各三协议与Server HTTP/ACP、普通`cli_stdio`、Ollama Chat/Responses、LM Studio/oMLX各三协议、BytePlus、CC Switch、LiteLLM三协议和Execution surface各有可追溯requirement行。
- [ ] 81条`PublishedProductProtocolClaimV6`与requirements逐key双射，每条准确绑定oracle/evidence/gate/live/funding/distribution；四类生成产物的input、claim-set digest、generator、path和exact bytes均进入release binding。手写provider协议、错误auth/realm/edition、inventory冒充支持、opaque route冒充fixed、遗漏limitation或跨distribution复用claim/产物任一mutation都阻断发布。
- [ ] full deterministic matrix的每个run明确`executionMode=deterministic_fixture`且真实账号lease/Internet/provider side effect为0；bounded live计划覆盖每个必需远程product/realm/auth/protocol/funding unit和实际平台差异，连续两个cycle全部pass。每个live terminal都有同lease的cleanup，残留provider resource、active credential与unreconciled billing hold均为0；账号不可用只quarantine并使门失败，不缩小mandatory集合。
- [ ] GA required journey逐条使用完整 subject template和专用fixture runner：Azure Chat与Responses各自对API key、Entra user、service principal、managed identity四条独立pass；Vertex ADC与WIF独立；Bedrock API key、static profile、role profile、SSO四条独立且SSO必须使用`aws_sso` recipe；Kimi普通API、Coding Plan与Kimi Code Server/ACP使用一致但互斥的product identity。任何auth“OR”、generic product journey、只测protocol library、旧binary、平台/locale借报、fixture子集、recipe替换或owner approve但journey未pass都使requirement→journey→entry→ecosystem gate逐层非零。
- [ ] 每个正式remote witness都用本次production endpoint和release artifact跑至少24小时operational qualification：完整threshold member集合、每member至少288个签名append/read/consistency run、至少两个observer domain、逐quorum序列、实测availability和latency quantile、七类故障注入及raw corpus replay全部达标。只跑mock/staging、self-declared SLO、缺一member、observer同trust domain、旧artifact或qualification过期都阻断anchor与reference-grade/GA。
- [ ] macOS/Linux/Windows正式产物分别验证强monotonic anchor producer、TUF root rotation和逐role rollback；没有强anchor的offline fallback只能通过匿名本机plain-dialog限定journey，且绝不能作为全功能platform pass。任一平台只有文件锁、wall clock或未实际运行的远程witness mock都阻断reference-grade/GA。
- [ ] release verifier只从`REFERENCE_REQUIREMENTS_V3`及其typed run-subject derivation决定reference minimum，逐row验证maturity/tier、protocol-or-surface/auth/realm/platform、recipe字段来源、runtime states、journey-tier的scalar与per-class UX limit、两种anchor起点、全部真实账户起点/graph entry、exact reference run subject、required recipe field event和profile列举的完整mutation集；matrix/baseline不得另写required数组。inventory/community-unverified、blocked/action-required/advanced、错limit、漏row/起点/前置事件、账户状态/graph/recipe/run-subject换挂、漏/重/错class手填字段、rights替换或降级后沿用旧pass均失败。
- [ ] 安全 monotonic anchor、完整TUF root-to-target lineage、local-control proposal/disclosure/decision、OAuth callback与credential family、workload issuance、metadata admission、persistent budget/correction、runtime/fallback/Execution/tool terminal和所有 send/effect intent的正例、字段换挂、双writer、kill-point、旧epoch/旧distribution fixture都进入release qualification；自动生成的 receipt DAG必须无环且每个首字节/副作用都只有一个可消费前驱。
- [ ] release qualification从最终contracts artifact执行compiler API authority census并与`AUTHORITY_LEASE_REGISTRY_V3`逐type/alias/concrete constituent/discriminant/kind/terminal/recovery对账；hosted Gate、single-use effect permit与最终network send bundle分别只有`gate_lease/external_effect/network_admission`准确所有权。故意新增一个非`LeaseReceipt`持权类型、删除effect permit登记、把两个Execution surface constituent合并成字符串枚举、让空hosted bundle持有effect authority或在restart sweep漏一条in-flight lease时，发布门必须非零且runtime admission保持关闭。
- [ ] authority release gate从最终AST重算76个expected source name、61个branch-free policy和28个判别分支constituent，最终registry/lifecycle/generated artifact必须是同一组89个constituent；provider cleanup五类operation、Codex command auth process、plugin artifact open handle、broker IPC session、runtime-child migration operation/recovery任一漏项、重复项、空inventory或只改声明数字都必须失败。runtime admission只消费已提交dispatch authority，不能创建census外新lease。
- [ ] signed BOM从固定37个suite ID精确生成39个有序row，suite ID、argv数组、`shell:false`、predecessor、BOM identity、distribution和terminal逐项同值；删suite、重排、改成shell字符串、重复preflight、以末项成功遮蔽前项失败、跨distribution复用terminal、把失败terminal传给release、调用v19及更早producer或缺少public compiler/edge manifest/fixed+owner migration/972-cell a11y/type gate中的任一项都阻断晋升。
- [ ] rights-blocked官方迁移只能消费精确的`OfficialApiDestinationResolutionReceiptV8<E>`：`E`必须是当前source product/principal/credential family/use case/operation/realm的eligibility receipt，并与source realm、hard-stop generation和rights expiry逐字段同值；destination requirement/claim/realm/auth journey/distribution也必须仍有效。跨source eligibility、旧generation、过期rights、错realm或不存在合格官方目的地时不得物化迁移CTA，只能进入排除原principal/credential family的安全替代picker。
- [ ] supply UI静态registry序列化结果只含state/action/label/destination kind/factory descriptor，明确不含session、nonce、generation、expiry、`authoritativeDomainReceipt`、`exactDomainSubject`或`controlEpoch`。每次render必须针对当前domain subject与local control session动态生成single-use capability；refresh、daemon restart、session切换、expiry、旧epoch重放和双击并发下，只有当前capability的一次CAS可以执行准确destination。
- [ ] inference、Execution physical、Execution read-only tool与side-effect tool共同通过universal automatic-retry gate：每个advance edge绑定准确candidate/body、attempt ordinal、sequence、funding、raw terminal、delivery/first-byte/publication/usage及effect subject。任何`delivery_unknown`都无条件禁止直接automatic retry与fallback；side-effect sent retry还必须先取得绑定同一request terminal与commit lease的权威not-committed terminal。跨attempt、跨tool/effect、普通结构对象伪造安全receipt或绕开reconciliation的mutation全部失败。
- [ ] runtime rights gate把同一`UseCaseIdV8`与operation贯穿ingress、PolicySubject、entitlement decision、funding、solution slot、physical attempt、fallback和`ExecutionToolExternalRequestPolicyBindingReceipt`；product/surface/realm restriction floor不可被动态权益放宽。Kimi Code、OpenCode Go及任意订阅型服务的cross-product、cross-surface、cross-operation或cross-use-case换挂必须在secret read与首字节前拒绝。
- [ ] LM Studio三协议optional-auth分别覆盖Require Authentication关闭时的none与开启时的credential分支；Chat/Responses按其权威Bearer挑战，Messages分别捕获`x-api-key`和`Authorization: Bearer`两个正例，并证明每个物理请求恰有一种credential header，双header、无挑战提前读secret、把native REST认证借给OpenAI-compatible/Messages或跨process generation复用credential全部失败。
- [ ] 2 个互补 subagent 独立评审、1 次 Codex 对抗评审、triage/journal 后无未处置 A/B 级发现；具名 B waiver 会机械降级 maturity 并使 reference-grade/GA 门保持未通过。

定向门禁：

```sh
node scripts/run-ai-supply-phase-gate.mjs --phase 8 --json
```

Phase末由`run-ai-supply-release-gate.mjs --profile release --json`组合三平台、两个live cycle、production witness 24小时窗口与独立24小时soak的已签结果；长时workflow缺失或过期不能被本地短门替代。

## 11. 预期代码结构

具体文件名在 Phase 0 canonical 评审后确定，职责边界应保持如下：

```text
packages/contracts/src/ai-supply/
  connection.ts                 # 持久合同、判别联合与 receipt envelope
  oauth.ts                      # flow/client/grant/token-exchange 单向合同
  transport.ts                  # Base URL、proxy/TLS/mTLS/application auth 身份
  binding.ts
  executionAgent.ts
  admission.ts                  # conformance/runtime/execution durable cursor 与 physical lease
  inferenceIr.ts
  events.ts
  capabilities.ts
  policy.ts
  activation.ts
  conformance.ts                # 判别型 report core/run payload/detached attestation 与 verifier policy 合同

packages/connector-sdk/
  src/connectorDefinition.ts    # 唯一公共扩展接口；不暴露 daemon service locator
  src/protocolAdapter.ts
  src/wireEventDecoder.ts
  src/discoveryDetector.ts
  src/executionDriver.ts
  src/hostCapabilities.ts       # opaque transport/credential/audit handles
  api-report/                   # 公共 API 基线

packages/connector-runtime/
  src/plugin-host/              # framed RPC、版本握手、限权进程与熔断
  src/transport/                # 安全 dialer、SSE、背压、取消
  src/registry/                 # 双 TUF client、schema/limit 验证、离线 snapshot
  src/budgets/                  # wire/worker/archive/evidence 固定 profile 与 ContentHandle
  src/conformance/              # 生产 live-check orchestration 与报告 verifier；不含 TCK runner

packages/connectors-builtin/
  src/protocols/                # OpenAI Chat/Responses、Anthropic Messages 等
  packs/                        # global/mainland/gateway/local/cloud manifests
  detectors/
  passive-probes/               # release-bundled immutable probe capability；在线 catalog 只引用 ID
  execution-drivers/
  fixtures/

packages/connector-tck/
  profiles/                     # protocol/capability/discovery/execution/bridge profiles
  fixtures/
  src/runner/                   # 唯一 TCK runner/fake host/fuzz/fault injection
  src/report-builder/           # deterministic core、run payload 与 detached attestation 构造

packages/daemon/src/ai-supply/
  control-plane/                # discovery、policy、receipt、snapshot compiler
  data-plane/                   # 固定 dispatch pipeline，只读 ActiveSupplySnapshot
  activation/
  recommendation/
  secret-broker/
  provider-test-account-pool/  # live qualification专用租赁、MFA、预算、reset/revoke/cleanup

packages/platform-security/
  src/contracts/               # host-neutral opaque handles、capability negotiation、attestation verifier
  src/client/                  # daemon到native helper的版本化最小RPC；不承载原始secret

packages/anchor-witness-client/
  src/protocol/                # 无credential的append/read/consistency wire与typed terminal
  src/threshold-verifier/      # member signature、quorum、inclusion/consistency与continuity验证

native/platform-security/
  darwin/                      # signed/notarized helper与最终分发sandbox/Keychain/process backend
  linux/                       # namespace/seccomp/Landlock/cgroup/pidfd/TPM2可选backend
  windows/                     # AppContainer/restricted token/Job/handle/credential/TPM2可选backend

services/anchor-witness/
  api/                         # append/read/inclusion/consistency与typed terminal
  coordinator/                 # threshold协调；不持有member私钥
  member/                      # 独立trust-domain signer与anti-equivocation store
  observer/                    # production qualification与故障注入observer

infra/anchor-witness/
  global/                      # 全球realm IaC、DNS/TLS、KMS/HSM、监控与容量
  china-mainland/              # 中国大陆独立realm，不跨站共享key或数据
  enterprise/                  # 可审计的客户自管/私有realm模板

installers/platform-security/  # macOS pkg、Linux deb/rpm/tarball、Windows MSI与升级/降级/卸载
ops/anchor-witness/            # key ceremony、rotation、outage、compromise、continuity与sunset runbook

packages/console/src/features/ai-services/
  onboarding/
  recommendation/
  provider-form/
  status-center/
  copy/

registry/
  ga-ecosystem-matrix.json      # 无自引用 core；由 detached release binding 锁定
  reference-grade-profile.json # 不可降级的具名主流最低覆盖
  ga-mandatory-baseline.json    # 必须产品/类别真相源；不内嵌 decision
  ga-owner-decisions.json       # detached proposal/attestation evidence set
  evidence-lock.json            # raw artifact → normalized projection 可重放索引

release-evidence/               # 构建并黑盒测试 distribution 后生成，不进入被测 payload
  ga-ecosystem-release-evidence-set.json
  release-ecosystem-binding.json # 单向绑定 matrix/probe/registry/evidence/distribution
  release-ecosystem-binding-attestation.json # 只签 binding core digest
  platform-security/            # 三平台最终安装包direct-syscall、upgrade/downgrade、SBOM/provenance
  anchor-witness/               # production threshold deployment、24h qualification与独立replay
  provider-live-qualification/  # 两个连续cycle、账号lease、MFA、预算与零残留cleanup

packages/console/src/locales/
  zh-CN/
  en-US/
  ar-SA/                        # GA RTL用户locale
  en-XA/                        # CI pseudo locale，不作为 GA 用户 locale
```

允许的生产依赖方向只有：

```text
contracts → connector-sdk → connector-runtime → daemon
connector-sdk → connectors-builtin → daemon
connector-sdk → connector-tck
contracts → platform-security → daemon
contracts → anchor-witness-client → daemon
daemon → generated support metadata → console
```

箭头表示“右侧可以依赖左侧”。`connector-tck` 可以依赖 SDK 和 contracts，但任何生产包不能依赖 TCK runner；`connectors-builtin` 不能 import daemon；console 只能读公开合同和生成元数据，不能 import adapter/plugin。用依赖图测试和 lint rule 阻止逆向 import、循环依赖和通过相对路径越层访问。

迁移纪律：

- 不在新目录重定义 `@saydo/contracts` 已有类型。
- 公共 SDK 只稳定语义合同，不稳定 HTTP client、数据库实体、内部 receipt 存储布局或具体 provider 类；每个导出都必须有 stability annotation 和 API report。
- 旧 `openaiCompat.ts` 在 Phase 2 迁移期作为 facade，调用新 adapter；消费方迁完并过门禁后再删除。
- 旧 `ModelBinding` 在回滚窗口内保留可恢复快照/受控双写；新路径使用 connection + per-slot binding。清理前必须用上一正式版二进制完成真实降级演练，不能只承诺“兼容一个发布周期”。
- `SetupWizard` 分解组件时保持行为测试先行，不顺手重做全站视觉系统。

## 12. 产品与工程验收总表

### 12.1 北极星指标

本节是全方案唯一时延和点击口径，其他章节只能引用：

| 指标 | GA 目标 | 硬上限/失败条件 |
|---|---:|---:|
| 有 cache 的首张卡片出现，P95 | 不超过 150 ms | 300 ms |
| 无 cache 的静态 candidate 列表，P95 | 不超过 3 s | 5 s |
| 已有有效 receipt 的完整推荐，P95 | 不超过 8 s | 15 s 后不阻塞旧方案，慢项转后台 |
| 已有有效 receipt、健康且无新增按量费用的供给进入 `conversation_ready` | 不超过 1 个 SayDo 动作 | 超过 1 个失败 |
| 运行中的local candidate进入`conversation_ready` | 0个主动作 | passive/validation必须为automatic；伪造点击或把`connected_verified`冒充整套可用均失败 |
| 非ready本地candidate进入准确恢复态 | 首个处方入口不超过1个SayDo动作 | `not_installed/not_running/no_model/cold/port_conflict/API off`不得先报zero-config pass；完整恢复按场景最多3个主动作，外部产品任务另记 |
| `signed_in_ready`的guided key/subscription candidate进入`conversation_ready` | 不超过2个SayDo动作 | 缺billing最多3个；`no_account/signed_out`且缺billing最多4个；创建厂商凭据、录入secret与MFA逐项记账 |
| guided OAuth candidate进入`conversation_ready` | 已有账户至少完成1个本应用授权/兑换动作 | 所有账户起点授权后再观察entitlement；网页登录态不得跳过credential exchange |
| 常见 preset 需要手填的技术字段 | 仅 secret 或明确账号/region | 不要求填协议/Base URL |
| `local_zero_config` 且 `auth=none` 的本地 loopback 服务需要手填技术字段 | 0 | 任何 key/URL/protocol 必填都失败 |
| 已自动识别且启用认证的本地 loopback `guided_key` | secret 字段 1；URL/protocol/region 字段 0 | 要求手填 URL/protocol/region、超过 1 个 secret 字段或把 secret 当公开 header 均失败 |
| `ActiveSupplySnapshot` 编译 500 个 connector/model closure，P95 | 不超过 50 ms | 200 ms；编译期间既有数据面不得停顿 |
| warm dispatch 本地开销，P95 | 不超过 5 ms | 10 ms；不含上游网络和持久费用 admission |
| 本地持久 Spend admission，P95 | 不超过 15 ms | 30 ms；超时在首字节前拒绝 |
| 单个 Execution tool Gate/idempotency transaction，P95 | 不超过 15 ms | 30 ms；超时在副作用前拒绝 |
| 首个上游字节到首个规范化流事件，P95 | 不超过 10 ms | 25 ms |
| cancel 到上游 socket/driver 收到取消，P95 | 不超过 100 ms | 250 ms |
| 100 个并发流时 event-loop delay，P99 | 不超过 25 ms | 50 ms |
| 单流未消费 payload 缓冲 | 不超过 256 KiB | 512 KiB 后必须背压或有界终止 |
| 100 个并发流相对空闲基线的 RSS 增量 | 不超过 128 MiB | 256 MiB；不得随时长线性增长 |
| plugin hang/crash 到隔离并恢复宿主服务，P95 | 不超过 1 s | 2 s；其他 connector 零中断 |
| strict合同artifact编译 | Node 22且argv以单次`node --max-old-space-size=2048`开头；TypeScript 5.9.3、0 diagnostics、0内外部`any` stub；手写schema不超过1 MiB/20,000行，完整generated contract不超过4 MiB/80,000行且bytes/lines均至少保留30%容量；instantiations不超过900,000、peak RSS不超过2.5 GiB、wall不超过60 s | 完整合同与42个隔离fixture分别测量；绝对门、source headroom与相对签名基线门同时通过；RSS/instantiations回退超过15%、wall超过20%或source超过15%均失败 |
| 未经授权产生新增费用、secret 误投、rights unknown 调用、失败替换 active | 0 | 任一发生即 release blocker |

动作合同按旅程拆开，不能用“厂商网页不计入”掩盖实际负担：已有 key 的 preset 统计录入、conformance 确认与 runtime 预算；OAuth/订阅统计每次用户发起的外部任务，同时把厂商页面步骤与 MFA 如实列成外部任务；云 IAM 分别统计账号/region 选择与组织管理员动作；本地冷态只把明确标为`user_primary_action`的处方计为点击，passive discovery和允许自动执行的验证必须标为`automatic_after_predecessor_success`且不得产生点击event。Playwright按准确`journeyStepId+actionId`断言应用内动作，端到端dogfood另记外部任务、离开/返回和墙钟。每个可交互状态只有一个`primaryAction`，自动状态没有伪造按钮，次级帮助不能伪装成第二主按钮。连接首测通过只到`connected_verified`；推荐解有可用对话供给才到`conversation_ready`；`review_ready`另需evaluator独立性。

每个 GA matrix entry 的每条 `journeys[]` 都必须按独立 auth profile 选择并满足一个机器可判定的旅程级别，不能把同产品另一种认证或“两次 SayDo 点击”借来过门：

| 旅程级别 | SayDo 动作硬上限 | 外部任务与手填硬上限 | 时间与失败恢复 | 可用文案 |
|---|---:|---|---|---|
| `zero_config` | 主旅程1；含anchor前置3 | 0外部任务、0离开、0字段 | cache miss P95 8 s；失败只给1个处方 | 只有当前账户起点实际为0字段/0外部任务时可写“自动接入” |
| `guided_oauth` | 主旅程3；含anchor前置5 | 最多4个外部任务且逐class不超过1，包括条件式MFA；最多3次离开/返回；0 secret | 预配置测试账号端到端P95 180 s，返回后app-controlled P95 10 s；最多1次可恢复重试 | 已有账号路径可写“一步登录”；fresh路径必须显示完整剩余步骤 |
| `guided_key` | 主旅程4；含anchor前置6 | 最多4个外部任务、3次离开/返回、2个typed字段，其中secret最多1；最多2次copy/paste；0 Base URL/协议必填 | 预配置测试账号端到端P95 180 s，粘贴后app-controlled P95 30 s；最多1次可恢复重试 | 只有已有可用credential路径可写“填一次 key”；fresh路径必须显示账号、entitlement/billing、凭据创建与录入 |
| `enterprise_managed` | 主旅程4；含anchor前置6 | 最多5个外部任务、4次离开/返回、4个typed字段；逐class使用enterprise签名上限 | 管理员等待单列raw/app/wait时间，不承诺外部审批时长 | 只能准确写“需要组织或云身份配置” |
| `custom_endpoint` | 主旅程5；含anchor前置7 | 最多4个外部任务、3次离开/返回、6个typed字段；Base URL/协议/model/auth逐字段审计 | 首测前显示最终wire、数据、计量与认证去向；未知计量逐物理调用确认 | 只能写“自定义接入”，不能伪装零配置 |
| `anchor_control` | 2 | 最多1个受控外部任务、0字段 | 独立使用anchor-control profile，不借供应tier | 准确显示注册、离线、阈值与恢复状态 |
| `advanced` | 不承诺 | 超过对应签名tier任一上限 | 不进入L0易用性SLO | 只能写“需要配置”，状态为`action_required`/beta |

注册审批或人工组织管理员等待不可由 SayDo承诺时长，报告同时给出 raw wall time 与 app-controlled time，并自动降为 `advanced`，绝不继续展示“一键/零配置”。外部页面步骤、MFA、copy/paste、错误循环和离开次数全部进入 dogfood 分母。

性能门使用计划新增的 `scripts/bench-ai-discovery.mjs` 与 `scripts/bench-ai-dispatch.mjs`。Phase 0 必须固化 `BenchmarkWorkload v1`、seed、fixture digest、采样/预热/GC 规则和正式支持 profile；其中 dispatch 强制包含 16 members、64 sequences、单序列 16、1024 nodes、1 MiB 的最大合法 RouteSet、全部分单位 fold、generation churn，以及结构上限附近的 stream/schema，不能只测单成员 happy path。GA 最少覆盖 macOS arm64、Linux x64、Windows x64 三种独立 runner，每种公开最低档至少 4 个逻辑核、8 GiB 内存和 SSD，具体 CPU/runner image digest 写入 release manifest，WSL/container 另列 beta profile。每个正式 profile 至少 50 次冷启动和 50 次 cache/warm run；流式门至少 100 并发和 10,000 次取消，release 再跑独立 24 小时 soak。报告记录 CPU、内存、磁盘、OS、Node/runtime、sandbox backend、样本数、P50/P95/P99/max、原始 JSON、exit code 和基线 digest。硬绝对值与相对上一 GA 基线回退不超过 10% 两项都必须满足；若公开最低档无法达到，应在 Phase 0 调整支持档或基于 profile 证明局部替换，不能在热路径引入缓存不一致来换分数。

普通 CI 只跑小于 5 分钟的 deterministic smoke；nightly 跑完整 TCK/fuzz corpus 和 60 分钟 chaos；release qualification 在三平台跑完整 performance/sandbox，并用独立长时 workflow 跑 24 小时 soak。不能把 soak 塞进现有短 timeout job，也不能用 Ubuntu 的结果代表另外两个 OS。三平台报告与签名全部进入 release digest closure。

账户与真实服务验收明确拆成两层，禁止用同一份“E2E”标签混淆：

1. `deterministic_fixture`对81条reference requirement的准确platform scope、`zh-CN/en-US/ar-SA`真实locale、独立`en-XA` pseudo suite、两种anchor起点、每个真实账户起点、journey graph分支和全部runtime/recovery state做完整机械展开。它使用受签fixture与hermetic provider simulator，真实外部账号lease、Internet请求和provider副作用必须全为0；这一层负责穷尽路径、文案、动作、wire和失败状态，普通CI/nightly可稳定重放。
2. `live_provider_qualification`不执行上述全笛卡尔积。生成器按`product + realm + auth profile/wire scheme + protocol + funding tier`做最小确定性set cover；只有存在平台相关认证、helper或wire行为的产品才再乘平台。每个必需远程coverage unit至少一个真实run，每个release candidate连续两个cycle通过；locale、anchor起点或纯UI分支不能成为重复消耗真实账号的理由。计划固定每cycle最多192个live run；若机械最小cover超过上限或账号池容量不能覆盖并发lease，计划本身不可生成并要求owner拆分release profile，不能静默删coverage unit。
3. 真实run只能从项目维护的provider test-account asset pool取得排他lease。asset记录product/realm/principal class/auth/MFA/billing/reset baseline和broker handle digest，不保存原始secret，也不得使用maintainer个人账号。lease在发起任何外部动作前原子预留请求数、原生计费单位预算、TTL和MFA attendance；需要MFA时必须有同run、未过期的approved-operator attendance receipt，不需要MFA或只跑recovery fixture时类型上禁止伪造attendance。配额不足、MFA无人值守、账号被封、权益漂移或reset baseline不一致时将asset quarantine并换用另一已批准asset，不能临时借个人账号或放宽预算。
4. 每个live run无论pass、fail、timeout、worker crash或取消，都先生成typed terminal，并在lease释放前删除测试资源、撤销本轮credential/session、对账usage和billing hold、恢复baseline。cleanup不能完成时asset保持quarantined且发布失败；通过的cycle要求所有terminal run都有cleanup、quarantined asset为空，且残留资源、活跃credential和未对账billing hold为0。账号池容量、并发、MFA值守、预算、provider条款和清理SLA是release资产，不是测试脚本里的环境变量约定。

UX的所有scalar与per-class上限从版本化journey graph、typed step、conditional branch、external-task profile和anchor composition机械求最坏前向路径，release只消费`GaDerivedJourneyUxLimitSetReceiptV5`。正文表格是该对象的可读投影，不是第二真相源；例如guided key的`no_account`主旅程上限固定由图推导为4个SayDo主动作。修改图而未重生成limit、手改表格或release gate接受更宽自报数字都必须失败。

### 12.2 必测矩阵

| 维度 | 必测项 |
|---|---|
| 协议 | Chat/Responses/Messages；stream/non-stream；tools/tool results；逐 occurrence hosted-tool 权益/费用/数据/副作用授权；JSON Schema；reasoning/signature；citation/annotation；refusal/safety block；vision；usage；raw response occurrence 无漏无重、第三方伪报 model/route/usage、事件重复/乱序/半包/未知字段 fatal/唯一 terminal；request/response adaptation coverage |
| HTTP | 200、400、401、403、404、405、408、409、413、429、5xx；SSE断流；redirect；TLS；取消；收到响应后不重试；Gemini `x-goog-api-key`、Azure `api-key`/Entra Bearer；BigModel Chat Bearer与Messages `x-api-key`及普通平台/Coding Plan key隔离；Kimi Platform与Kimi Code endpoint/key/funding隔离、Kimi Code Chat Bearer、Messages `x-api-key`和真实`User-Agent`；TokenHub两站默认/备用origin、Chat/Responses Bearer、Messages `x-api-key`、Bearer `/v1/models`、401002、402未开通/额度不足、429与流中SSE error逐项terminal |
| 身份/计算边界 | requested=observed、ObservedModel absent、同族/异族/alias 漂移、gateway route变化、route/fallback fence与权威 terminal edge、完整 RouteSet、subject-bound enforcement、loopback peer抢占、conformance/runtime local peer+compute+sandbox descriptor、LAN独立 authority/逐 attempt lease、cloud/LAN换挂 |
| Secret/网络 | 双未知 endpoint、Inference/Execution与 ext protocol plane不碰撞、RFC3986三协议、自定义非秘密header allowlist/denylist与逐header授权、逐 hop DNS/socket与双层 proxy/origin TLS/SNI/trust/terminator、application/proxy/mTLS/OAuth-client component全集+ACL/egress、leaf rotation/pin drift、OAuth判别 flow-start/browser/device/callback/exchange全部terminal、family cursor/refresh winner+reuse/aud/azp/cnf、URL query、RequestProfile、redirect、DNS rebinding/NAT64、日志脱敏 |
| Discovery | CLI hang、binary shadow/spawn TOCTOU、假签名、history sentinel、端口冲突、无 signature 401/403；static/passive/explicit-active三种deterministic core与typed run evidence互斥，core无live lease/decision/canary/time，static零packet/process，passive同held socket admission→intent→terminal，explicit active decision consumption+syscall sandbox；release-bundled capability、恶意 signed catalog 零packet、Docker/Podman stopped journey、deterministic fair scheduling、cache stale、LAN 默认关闭、mDNS opt-in、全局路径/文件/request/bytes/process/candidate budget |
| 权益/费用 | allowed/official/unknown/forbidden、exact owner/admin private rights、custom conformance/runtime unknown-metering正向链与换挂拒绝、edition/terms/overage、双协议、跨单位向量、OpenRouter BYOK、OpenCode Go→Zen、candidate/runtime漂移、typed-ref fold、sent/component coverage、operation closure、Execution专属 no-new-spend与 consent金额/physical cap、fallback A+B总预算、禁止隐式 FX、`reserved/sent/settled/charge_unknown` |
| 推荐 | 单来源、多来源、同族 evaluator、无 strict schema、no-new-spend、本地优先、服务停止、数组乱序 |
| 配置 | inactive migration、staged pass/fail、restart/live fail、cancel、ActivationManifest 全资源 fence、verify→promote 撤销竞态、activation barrier、CAS 冲突、kill recovery、上一版降级、orphan secret、hard/soft invalidation；现有逐PID JSON child registry与SQLite operation authority五态dual-read/shadow-write/reconcile/dual-write/cutover、PID复用、单边fsync、冲突quarantine与真实降级 |
| UX | fresh HOME、登录/key/local/custom private、guided-key四动作最坏路径、OAuth不可跳过授权、connected/conversation/review readiness与降级、真实账户起点→exact graph entry/recipe/state assertion plan与证据集、逐step `user_primary_action/automatic`判别及准确step/action event、由versioned graph生成的`GaDerivedJourneyUxLimitSetReceiptV5`、required/conditional field ID事件无漏无重、事前 disclosure=允许序列/上限、事后 report=ledger sent且为已披露前缀、typed event reducer的wait/visibility/copy/leave-return/raw/app time、同window/route焦点恢复、可交互状态唯一primaryAction且自动状态无按钮、safe automatic candidate与review-required candidate互斥、local ready与独立runtime recovery、Docker stopped、cloud IAM、数据去向、zh-CN/en-US/ar-SA真实locale、独立en-XA pseudo、RTL/200%/窄屏/键盘/screen reader |
| Agent | pre-session admission→start cursor/lease/intent/terminal→runtime sandbox→session lease→turn/physical terminal cursor、zero-turn/zero-request与deadline terminal；三个stdio local分支和acp/agent HTTP各自loopback/remote七个exact binding正例、严格credential/no-secret、subject-bound remote authority、真实进程树/全数据出口、Execution专属no-new-spend、consent金额/physical cap、全component funding、Gate 0、registered tool-call set完整覆盖、logical tool/replay/CAS/commit/aborted/executing_unknown、unknown reconciliation terminal→独立close-ready revision→close、manual committed result链、工具独立费用/cap、人工调和single-use decision、kill-point、未知事件、S3、syscall逃逸、进程组kill |
| 云身份 | helper/metadata 自动阶段零调用、显式 principal/role/project/tenant、credential worker egress、企业 proxy/mTLS |
| 扩展隔离 | SDK major/minor 握手、manifest/schema、permission/data scope 升级重新同意、签名错误、插件 crash/hang/frame/结构复杂度/CPU/RSS/process/restart/global-budget 洪泛、越权 capability、三平台 `open/connect/exec/credential-store/process-inspection/IPC`、单 connector 熔断 |
| 性能与耐久 | snapshot原子切换、最大 RouteSet/fold/generation、唯一 wire profile、JSON/schema、host/publisher/session/attempt ContentHandle count+resident/spool/temp/lifetime/orphan recovery、evidence-store aggregate、100并发、慢消费者、取消风暴、event-loop/RSS、24h soak、plugin/TUF chaos；strict合同编译零stub/diagnostic及source/instantiation/RSS/wall绝对门与签名基线回退门 |
| 供应链 | TUF预置root与逐步双阈值rotation、逐repository+role high-watermark、完整root/timestamp/snapshot/top-level targets/ordered delegated targets lineage与exact target path/hash/length、五 roles与统一 field/value extractor、registry/evidence预算、freeze/role rollback/mix-and-match、隔离 build/sign、raw/projection replay、payload/bundle/provenance换挂、最终 SUT、GA完整subject+fixture/runner/platform/locale+typed journey/entry/ecosystem gates、detached release binding的自引用/替换/scope负例、receipt deep-freeze/JCS/alias mutation、SBOM/signature离线验证、tarball外部安装、三平台closure与真实anchor producer |

终审确认的安全性质不能只留在评审表中。以下 fixture suite 名称在 Phase 0 固化，达到对应 Phase 后成为持续 release gate；每套至少包含正例、字段换挂、并发 sibling、kill-point和旧 generation/旧 distribution负例：

| Suite | 首次强制 Phase | 必须证明的性质 |
|---|---:|---|
| `type-contract-compile-budget.model` | 0 | 锁定TypeScript/compiler argv/package lock/runner；零diagnostics、零内外部`any` stub，source bytes/lines、instantiations、peak RSS、wall同时通过绝对与签名基线回退门。伪造diagnostics summary、遗漏一个TS block、只测抽样、提高baseline、换runner或在统计后注入代码均失败；orchestrator首步失败不能被后续成功遮蔽 |
| `local-control-authorization.tck` | 1 | OS principal、Origin/Host/WebSocket Origin、channel binding、CSRF session、proposal→disclosure→decision→single-use consumption；OAuth/API-key browser、manual reconciliation、GA owner和custom header均在敏感动作前消费，DNS rebinding/CWSH/同 UID旁路与decision重放在secret/browser/send/spawn/effect前拒绝 |
| `runtime-child-registry-migration.model` | 1 | 现有逐PID JSON与SQLite operation authority共享不可复用identity、epoch和lifecycle revision；五态cursor单向CAS。逐JSON temp/rename/fsync、SQLite journal/commit、spawn permit、establish/terminal/release/cutover kill后按两store精确并集恢复；单边、冲突、PID复用、旧birth/token/epoch只quarantine。上一正式版真实降级通过且rollback window关闭前禁止sqlite-only和旧投影清理 |
| `oauth-state-machine.tck` | 1 | PKCE/device/API-key producer分离；OAuth/API-key每次exchange独立lease→send-intent→terminal。初始access-only与refreshable family均有正向fixture且access-only不能取refresh lease；pending/slow-down只接受device poll，code/refresh同body进入unexpected-poll terminal。kill在lease后/intent前与intent后/首字节后分别得到not-sent或unknown；双daemon refresh/key winner、旧credential处置与family互借均拒绝 |
| `transport-credential-boundary.tck` | 1 | public header不能伪造credential或转发身份；custom secret header只以broker handle/version存在并精确绑定endpoint/RequestProfile/principal/recipient/processor/ACL/egress/decision/TTL/generation，覆盖`X-Auth-Token`与无冲突`api-key`正例，以及Authorization/Cookie/Proxy/Forwarded/hop-by-hop/preset同名覆盖/大小写碰撞/redirect/proxy泄漏负例；mTLS-only、forward/intercept processor披露、CONNECT/SOCKS解析authority、最终origin hop、TLS 0-RTT禁用、版本化revocation policy |
| `receipt-dag-and-anchor.model` | 1 | edge manifest零通配并覆盖复合ordering/same-value/state-machine/predicate/CAS authority、目标先提交、revision/epoch顺序与instance graph无环；cursor类型级SCC只有在逐实例旧revision边下合法；writer/time/TUF高水位绑定不可回退anchor，旧snapshot、storage rollback、跨domain直引和bare-ref旁路拒绝 |
| `pre-intent-authority-closure.model` | 1 | 从最终contracts AST穷举所有`*LeaseReceipt`及任何结构上持权的非标准命名声明，与registry/alias/kind policy精确相等；每个可产生socket/network byte、secret read、credential/signature、browser、process/listener、tool effect或费用hold的lease都有非空kind+ordinal+subject inventory。hosted Gate lease、accepted Gate后的effect permit lease与final send bundle分别只持`gate_lease/external_effect/network_admission`；before-intent terminal以映射型release set逐项关闭同一lease全部authority且无send/effect intent，漏项、重复、错kind/subject/lease、非租约effect permit、空bundle持effect或已有intent后伪报not-sent均拒绝。after-intent路径只接受同registry constituent私有producer签发的action-intent/domain-terminal pair，裸`ReceiptRef`、跨row terminal和generic wrapper mutation均失败；restart sweep漏任何in-flight lease时admission不开放 |
| `tuf-root-role-rollback.tck` | 1 | pinned initial root、逐步旧/新双阈值rotation、catalog/policy与逐delegated-role version+hash high-watermark、offline restart；跳root、删中间evidence、局部role rollback、跨repo watermark与旧key回放全部拒绝 |
| `reference-monitor-writer-fence.model` | 2 | 双daemon、旧epoch复活、存储failover、cursor/ledger/effect sibling在首字节或effect前只能有一个winner |
| `inference-funding-attempt.model` | 3 | conformance/runtime都只允许ready cursor→无发送权intent→credential/peer/compute完整descriptor→条件式final physical lease/in-flight→无漏无重hosted-tool authorization bundle→send intent→terminal；只有bundle授予最终发送权，空occurrence严格空分支，缺/重/错occurrence、component、effect、member或attempt均零字节。每个side-effect Gate只有allow→single-use permit→committed/not-committed/delivery-unknown、deny→Gate retirement或not-invoked→unused retirement之一；Gate/effect/network三种authority逐层关闭，unknown保留hold且禁重试，同permit双effect及任何outcome换挂拒绝。descriptor无反向final-lease边，所有closure逐字段相等。`SupplySolutionReceipt.slots`是fallback唯一四槽tuple，template/alternative/envelope/admission/cursor/attempt/terminal/advance按同一slot映射；named副本、跨slot/solution拼接拒绝。retry与billing disposition正交，runtime/fallback零attempt具名terminal、fallback总预算、authoritative ledger range和完整sent report |
| `conformance-round-closure.model` | 3 | staged success→restart lease/intent/terminal→直接或reconciled commit→live-ready单向cursor；五个failure stage分别验证pre-intent authority closure、stage cleanup、safe-retry baseline或query-only reconciliation，unknown不能直接重启。live intent/lease/result/completion绑定准确loaded snapshot/distribution/process/listener/config generation；未restart、旧generation、清理漏项、none/both success evidence、错round/报告或跨member均零Capability/Binding |
| `persistent-budget-ledger.model` | 3 | 最坏reservation包含bounded correction；horizon open时escrow保持outstanding，不能供新child消费；immutable final/horizon close/not-sent才释放。escrow内correction保持physical cap、outstanding set/count与两类aggregate hold逐字段不变；余额0不能变1。超界更正成为authority breach并撤profile，不扩用户授权；100并发、乱序与旧cursor均拒绝 |
| `ledger-report-correction.model` | 3 | initial/corrected ready→correction-in-flight→corrected ready/final的subject-scoped cursor/lease/commit单后继；双writer、同predecessor双报告、in-flight/final取lease、旧watermark、断序、跨subject range或report outcome换挂不能覆盖权威视图 |
| `usage-dimension-fold.tck` | 3 | cache/reasoning/image/audio/request/tool/compute维度、correction、未知维度与逐component `charge_unknown` |
| `metadata-health-admission.tck` | 3 | 自动仅auth-none+peer-bound+零生成零费用；credentialed metadata必须用户授权并进入ledger |
| `provider-wire-auth-regression.tck` | 3 | 从81行requirement逐项生成准确origin/path/models path、custody、wire auth、challenge、principal/key namespace与公开常量header profile。至少固定Gemini `x-goog-api-key`、Azure Chat/Responses的`api-key`/Entra Bearer、BigModel Chat Bearer/Messages `x-api-key`、Kimi Platform与Kimi Code隔离及Kimi Code Chat Bearer/Messages `x-api-key`、TokenHub两realm三协议和Bearer models目录，以及腾讯企业Token Plan两realm的Chat Bearer、Messages `x-api-key`/Bearer单选和plan path；header大小写/名称、origin/path、key namespace、realm、产品、普通API/个人套餐/企业套餐或payg/会员交叉换挂全部在发送前失败 |
| `capability-slot-funding.tck` | 3 | capability从当前model raw evidence逐轴派生conversation/tools/reasoning/strict schema/modalities/token/usage/cache/vision/marginal-spend；dialog/thinking/cheap/evaluator四槽各自正例可达，plain-dialog、无reasoning、无cost qualification、非strict schema及同route/model/raw evidence evaluator跨槽换挂均拒绝。自动decision/template/slot/recommendation/fallback/background health只接受no-new-spend或有界runtime authorization；custom/official unknown仅用户主动逐物理调用且不能进入任何自动链 |
| `passive-loopback-peer.tck` | 4 | GET/HEAD前验证listener owner/PID-start/binary；端口抢占、进程换位、未知平台零packet |
| `discovery-conformance.tck` | 4 | static/passive/explicit-active使用三个互斥deterministic core和三个typed run-evidence分支；core无live lease/decision/canary/time。static只读allowlist且零packet/process；passive为同一held socket admission→intent→terminal并冻结literal loopback/method/path/bytes，以typed `network_admission` release关闭准确authority；explicit active消费当前decision并绑定sandbox canary与非空逐动作authority closure，每个closure都把同一lease/inventory/intent/terminal与完整typed release set闭合。core/run/mode/provider/environment/artifact/config/budget两两换挂，以及漏/重/错kind/lease/subject的release均失败，相同fixture重复运行core digest相同 |
| `local-preload-state-machine.model` | 4 | authorization/global cursor/lease/effect intent/terminal/release/result单向链、并发1与resident reservation CAS；双daemon、OOM/cancel/deadline、旧generation、重复effect和失败伪loaded均不能产出compute evidence |
| `local-product-journeys.tck` | 4 | Ollama text-only可plain-dialog ready但零tool surface；Docker Model Runner与Podman AI Lab product identity、六态处方、static零CLI/socket与explicit-active只读，不自动enable/pull/load/start |
| `execution-surface-chain.tck` | 5 | `cli/app-server/acp` stdio三个local process-tree及`acp/agent` HTTP各自loopback/remote共七个准确正例可达；surface→binary/endpoint→peer/process→local或upstream-attested sandbox→local/remote start kind逐项映射，bare ref与任意跨模式拼接拒绝。start与turn unknown各有独立可重复reconciliation cursor；turn query与cleanup使用不同intent，cleanup需权威disposition；resolved/cleanup terminal先生成独立新revision的reconciled-close-ready cursor，close lease再消费，不能和terminal竞争同一in-flight revision。still-unknown不得终结或取下一turn，permanent-block保持hold。close与turn竞争同一session CAS，close before-intent回retry-ready；session-closed-before-request投影closing/terminal且旧lease不可复用；每个physical terminal从准确lease/send intent/request/raw inventory/decoding/loss形成response evidence，manual committed严格走unknown→manual-reconcile→record-manual-result，跨cursor拼接失败 |
| `execution-tool-child-lease.model` | 5 | registered tool-call set从同一raw response inventory无漏无重派生；tool request严格initial/ready→external/effect-in-flight→ready/terminal，每个外部request/effect独立ordinal/reservation/terminal/commit lease和tool response evidence。read-only才可普通sent retry并以`record_read_only_result`绑定只读success terminal，side-effect的success/500/4xx/response-loss/after-send取消均先到effect-in-flight，只有typed authority证明not-committed且预登记edge可重试；普通result、committed-effect material、zero-work material、manual committed result四类evidence互斥，manual分支需原unknown effect+独立authority且无普通committed terminal。`completed_without_work→result_recorded`与zero-work cancel→aborted端到端可达，final transition交叉拼接、tool-results-applied漏/重/注入、delivery-unknown重试、两个effect与no-external-charge伪证明均拒绝 |
| `bridge-conformance.tck` | 5 | bridge使用独立`reportKind=bridge`，不借capability或execution报告。LiteLLM Chat/Responses/Messages与CC Switch public Messages proxy都走`inference_data_plane`并强绑准确`InferenceProtocolId`及implementation；CC Switch还必须闭合opaque route/failover/funding限制和逐次主动确认，且control分支不可构造。只有另有稳定公开control API的产品才走`bridge_control`。跨class/protocol/product、换dependency、伪造route pin/no-new-spend、填伪model/detector/execution surface或绕过私有producer全部失败 |
| `conformance-two-round-budget.model` | 6 | staged/live共享一个journey/authorization、分别消费子预算、共同受总cap约束，重跑必须重新确认 |
| `workload-identity-signing.tck` | 7 | workload issuance严格ready→request-in-flight→credential-commit-pending→terminal或失败terminal；credentialed分支在类型上排除AWS instance/Google metadata/Azure managed profile，无credential分支只接受这三类metadata profile。每个物理step独立lease→send-intent→terminal，before-send无intent，after-send/unknown必须有intent；AWS IMDSv2固定token PUT→credential GET两step且首step失败可诚实终结，Google/Azure各一step。成功/transition/commit逐字段相等、delivery-unknown禁重试；AWS static named profile与role/SSO分离，完整method/path/query/header/body、host time/nonce，声明式signer DSL越界、nonce重放和跨profile换挂拒绝 |
| `plugin-budget-state-machine.tck` | 8 | 唯一plugin/host/fair-scheduler profile digest、1小时restart window；2个core专用slot与2个plugin slot不可互借。同一signer realm的多publisher ID只形成一个admission/debt/reservation group。完整occupied occurrence trace按twelfths整数递推逐step回放actual service、debt、reservation、tie-break和service curve；`-13..13`逐点验证signed truncate，0–8 exact count tuple逐项验证`tracked=active+waiting`，waiting line必须零share/零service。1–4个持续eligible group验证250 permille、240秒start-lag与240010 worker-ms debt，第5–8个验证480秒cohort轮换/600秒active admission且无share/dispatch承诺，第9个立即capacity拒绝。全部列举mutation均使实现/reference evaluator state或decision digest不等并失败 |
| `realm-and-ga-binding.tck` | 8 | 81行requirements、requirements derivation与run-subject derivation的count/digest/唯一复合键/recipe来源严格重算；MiniMax/SiliconFlow/百炼/Ark-BytePlus/TokenHub与腾讯企业Token Plan跨realm key零secret/packet。`deterministic_fixture`按onboarding availability判别：fresh requirement精确等于platform scope×`zh-CN/en-US/ar-SA`与独立`en-XA`×`not_enrolled/ready`×全部真实账户起点；migration-only requirement只含`existing_connection_present`正向run和唯一无既有连接absence run。两类run都携带exact typed reference subject、同graph唯一entry step、recipe required field set和完整compiler-selected state assertion plan，且外部账号lease/Internet/provider副作用均为0；另一个bounded `live_provider_qualification` plan按product/realm/auth/protocol/funding及必要平台做set cover，连续两cycle从受管账号池排他lease并在每次terminal后完成资源删除、credential/session撤销、usage/billing对账和baseline reset，三类残留均为0。运行时assertion evidence set对每个required state按准确polarity/source与原始证据逐键双射。穷举每条合法起点的全部前向路径，user-triggered step恰有一个准确step/action event，automatic step没有`primaryActionId`和点击event，且路径在由versioned graph机械派生的signed scalar/per-class limit内可达terminal；guided OAuth的所有已有账户起点都经过授权/兑换与随后entitlement observation。每个负向runtime state另以准确recovery graph与first step运行且在recovery terminal前禁止zero-config pass。fresh enrollment与主journey事件/耗时有序无重并集，leave-return验证同window/route焦点恢复，每个unconditional或条件成立的recipe field恰有一个带field ID的typed event，条件不成立时字段必须为零；OpenCode Basic、LiteLLM Bearer和LM Studio三协议optional-auth都覆盖权威required与absent，LM Studio Messages额外分别capture `x-api-key`与Bearer且双header共存必须失败。TokenHub两站三协议及Bearer/x-api-key、腾讯企业Token Plan两站Chat/Messages和专业积分池/轻享Token池、Azure Chat/Responses各四种auth、Vertex两auth、Bedrock四auth/SSO、Kimi Code双协议、OpenCode Zen/Go三协议和HTTP/ACP、普通CLI、LiteLLM三协议、Ollama双协议、LM Studio/oMLX三协议分别通过requirement→run→journey→entry→ecosystem gate。全局`review_ready`另外要求四槽qualification tuple逐项同值绑定solution slot、Activation pointer、chat success terminal、conversation-ready gate和同一distribution，evaluator proof与solution同一；漏槽、重复槽及任一跨槽/跨发行物换挂均失败 |
| `provider-test-account-pool.model` | 8 | asset只能由项目账号池提供，个人维护者账号与raw secret均拒绝；排他lease原子预留请求数、逐原生单位预算、TTL和MFA attendance。pass/fail/timeout/cancel/worker crash每条都必须先delete resource、revoke session/credential、reconcile usage/billing hold、reset baseline再释放；cleanup失败quarantine。连续两个release cycle精确覆盖bounded set-cover计划且三类残留为0；用全笛卡尔live调用、跨realm key、双lease、超预算、MFA绕过或借旧cleanup均失败 |
| `platform-anchor-offline-mode.tck` | 8 | 三平台真实producer；fresh witness用distribution manifest+pinned root+exact target的独立bootstrap authorization，不引用设备high-watermark。共享boot budget为registration=1、有限status query N及累计bytes/time/backoff；覆盖query before/after-send失败、cancel、deadline、response-loss、found/absent/still-unknown、budget exhausted，且任何路径都不能重复registration。正式remote witness另跑当前production deployment至少24小时qualification：全member、每member至少288签名run、双observer domain、quorum/quantile、七类fault和raw corpus独立replay；mock、旧artifact、缺member或过期证据拒绝 |
| `local-data-locality.tck` | 8 | process-tree出口canary与swap/coredump/VRAM/snapshot/backup残余文案；绝对隐私声明永远不会由network-only proof产生 |
| `evidence-orphan-recovery.chaos` | 8 | admission时潜在orphan不超过128 MiB，crash后30 s内清理且temp aggregate永不越界 |

### 12.3 每阶段共同门禁

每个Phase只公开一个`run-ai-supply-phase-gate.mjs --phase <id> --json`入口；release只公开一个`run-ai-supply-release-gate.mjs --profile <profile> --json`入口。二者从版本化manifest读取argv数组，以`spawn(..., {shell:false})`顺序执行，继承并原样传播signal/exit code；每步输出step ID、argv digest、开始/结束单调时间、exit code、stdout/stderr artifact digest与`passed | failed | not_run_due_to_predecessor_failure`。第一项失败后后续项不得启动，顶层必为非零；超时、signal、找不到binary、输出截断或报告无法解析也都非零。orchestrator自身的mutation test把首项设为失败、末项设为成功，证明成功末项不能遮蔽失败。文中的具体测试命令只作为manifest内容说明，CI不得复制成多行shell、管道或`cmd1; cmd2`。

每个Phase gate通过后，再由release orchestrator组合当前已经存在的基线门：

```sh
node scripts/run-ai-supply-release-gate.mjs --profile ci --json
```

增量门按实现阶段启用，不能要求 Phase 0 运行不存在的命令，也不能用空壳脚本过门：

| 从哪个 Phase 开始 | 必须新增并持续运行的门 |
|---|---|
| Phase 0 开工前及收口 | `node scripts/check-ai-supply-preflight.mjs`，验证 pointer/ownership/PLAN-2 batch/基线 SHA/十项 owner decision digest；两次结果必须相同 |
| Phase 0 | strict TypeScript零stub、Compiler API语义/readonly/public-facade检查，以及`TypeContractCompileGateReceiptV20`的手写/生成/总source绝对门与签名基线回退门；记录准确argv、`--extendedDiagnostics`、peak RSS、wall和完整artifact digest |
| Phase 1 | `pnpm lint:all`，真实覆盖 `packages/`、`e2e/`、`scripts/`；先用故意违规 fixture 证明会红 |
| Phase 1 | `pnpm check:connector-boundaries`，验证公共 API report、单向依赖、禁止 import 和 framed RPC 宿主隔离 |
| Phase 1 | `runtime-child-registry-v1-to-v2` dual-store migration/kill-point/上一版真实降级门；JSON/SQLite冲突、PID复用或单边fsync时零spawn permit、零signal、零delete |
| Phase 1A | 三平台最终installer/native helper direct-syscall与升级/降级门；production witness 24小时qualification、threshold故障注入及独立replay是长时外部门，不得由普通CI mock替代 |
| Phase 2 | `pnpm --filter @saydo/connector-tck test` 与 `node scripts/bench-ai-dispatch.mjs --profile ci`，验证三协议、IR、流式和数据面 SLO |
| Phase 3 | `pnpm test:tuf-registry`，验证双 root、离线 snapshot、更新/撤销和 archive limits |
| Phase 4 | `node scripts/bench-ai-discovery.mjs --mode candidates --runs 50`，验证 cache/static candidate SLO |
| Phase 6 | `node scripts/bench-ai-discovery.mjs --mode recommendation --runs 50`，验证完整推荐和点击 SLO |
| Phase 8 | `pnpm test:connector-conformance`、`pnpm verify:connector-packages`、`pnpm verify:conformance-attestations`、`pnpm verify:authority-lease-registry`、`pnpm test:discovery-conformance`、`pnpm test:execution-conformance`、`pnpm test:ai-chaos`、`pnpm test:plugin-budget-state-machine`、`pnpm test:publisher-fair-reference-evaluator`、`pnpm test:platform-anchor-offline-mode`、`pnpm test:remote-witness-operational-qualification`、`pnpm verify:reference-requirements-derivation`、`pnpm verify:ga-journey-gates`、`pnpm verify:provider-live-qualification`、`pnpm verify:reference-grade-release`、`pnpm verify:supply-chain`；三平台release qualification、连续两个bounded live account cycle、witness 24h production window与独立24h soak workflow均须返回受信报告digest，账号/资源/credential/billing hold残留均为0 |

UI Phase 另跑：

```sh
node scripts/run-ai-supply-release-gate.mjs --profile ui-full --json
```

在这些增量门真实存在前不得伪报已通过。Phase 8 的本地命令只能证明本机 smoke，不能替代 macOS/Linux/Windows release workflow 或 24h soak；release manifest verifier 必须逐项检查三个正式平台报告、长时任务报告、受信签名和 digest。退出码必须紧跟命令记录，不能以截断后的尾部输出推断通过。证据文件记录命令、exit code、测试数、基准环境、代码 commit SHA；未授权 commit 时只记录工作树快照和明确的“未提交”。

### 12.4 Conformance 与成熟度证书

“是否支持”必须同时展示四条正交证据轴和一个由当前完整闭包计算的可激活结论，不能把其中一条通过折叠成总绿灯：

| 维度 | 典型值 | 证据 |
|---|---|---|
| 发布成熟度 | `builtin_stable`、`builtin_beta`、`community_verified`、`community_unverified`、`inventory` | 维护 owner、兼容窗口、发布和 sunset policy |
| 协议/能力 conformance | profile 的 `core`、`extended`、`not-tested`、`failed` | TCK report、fixture digest、实现和模型版本 |
| 运行健康 | `healthy`、`degraded`、`offline`、`drifted` | 当前平面 endpoint identity、checkedAt、有限期 health receipt |
| 权益可用性 | `allowed`、`official-surface-only`、`unknown`、`forbidden` | product/edition/use-case 对应 Rights receipt |

单连接另计算 `ConnectionReadiness=connected_verified | action_required | blocked`：它重新验证当前 endpoint/principal/secret generation、runtime health、compute/network/rights/billing/data、RouteSet、FundingDecision、Gate 与 sandbox closure。四轴历史证据全绿但价格过期、data unknown、route fence 不可得或缺当前付费同意时，仍必须是 `action_required/blocked`。求解器再对连接集合派生 `SolutionReadiness=conversation_ready | review_ready | blocked`；单连接 `connected_verified` 绝不自动变成整套 `conversation_ready`。官网只能声明 connector/profile 的测试支持范围；设备 UI 才显示当前用户的两层 readiness 和准确阻断项。

TCK report 使用 canonical JSON 严格判别联合，共享 §4.15 的 deterministic `ConformanceResultCore` 与 `ConformanceRunPayload`，再按 `reportKind` 增加适用身份：

- `protocol`：protocol/profile/adapter identity、wire fixtures、request/response loss coverage；
- `capability`：provider product、endpoint/model/artifact identity 与 capability results；
- `discovery`：detector/profile/budget identity、provenance 和 sentinel results；
- `execution`：agent surface、peer identity、sandbox backend、funding/Gate/idempotency results。
- `bridge`：准确inference data-plane或route-control protocol dependency、公开接口版本、peer/route opacity或route-fence、credential isolation、funding与data projection；两类互斥，不能填伪model或execution字段。

不同 kind 禁止填写占位 provider/model/surface。CLI 与 library 只要求 deterministic core digest 相同；时间、环境、runner、source commit、builder、SUT 和完成状态属于 canonical run payload，签名/provenance 属于 detached attestation，release manifest 再单向绑定二者。正式徽章还要求当前 verifier policy 接受 issuer/repository/workflow/ref/builder/provenance，且 report digest 与 release/registry/connector/TCK/fixture 闭包一致；普通 publisher 自签只显示 `community_unverified`。签名只证明“该受信构建在该版本和环境得到这些结果”，不把模型、价格、条款或用户当前可用性永久认证。

## 13. 发布、回滚与运维

### 13.1 Feature flags

最少按以下粒度开关：

- `connector_contract_v1`
- `protocol_openai_responses`
- `protocol_anthropic_messages`
- `provider_registry_online_update`
- `discovery_local_runtime`
- `discovery_cli_subscription`
- `provider_opencode_zen`
- `provider_opencode_go`
- `provider_tokenhub_guangzhou`
- `provider_tokenhub_singapore`
- `bridge_cc_switch`
- `agent_codex_app_server`
- `runtime_child_registry_sqlite_authority`
- `platform_security_helper_macos`、`platform_security_helper_linux`、`platform_security_helper_windows`
- `anchor_witness_global`、`anchor_witness_china_mainland`、`anchor_witness_enterprise`
- `code_plugin_os_sandbox_macos`、`code_plugin_os_sandbox_linux`、`code_plugin_os_sandbox_windows`
- `recommendation_engine_v2`
- `cloud_bedrock`、`cloud_vertex`、`cloud_azure`

关闭 connector 不删除配置，但动作取决于 flag class：`drain_disable` 只停止新调用并让既有安全 session有界结束；`revoke_disable` 立即增代、撤销全部在途并停止新调用，sandbox/protocol/credential/policy/Gate 安全开关默认属于后者。任何 LKG 候选都必须按**当前**策略重新验证 endpoint/request profile/EndpointCredentialEgress/network、principal/credential source/secret version、resource scope/compute boundary、adapter/extractor digest、rights、billing/FundingPolicyTemplate、data boundary、RuntimeRouteFence、family/model identity、capability、temporal 与 Gate receipts；完整不可变资源写入对应判别型 ActivationManifest，全部有效且 generation/revision CAS 未变才可激活。具体 FundingDecision 只在 dispatch 匹配，缺失时锁请求而不伪造授权。没有完整候选时停止对应供给并给出处方，不能自动回旧 active。

### 13.2 Receipt 与失效条件

receipt 在以下任一变化后失效：

- binary digest/version；
- endpoint scheme/host/port/path、RequestProfile 或 TLS identity；
- protocol/adapter version；
- auth kind、credential source、resource scope 或账号/region；
- model alias/observed model；
- compute boundary、OS 观察的 local peer、loaded artifact、runtime egress assurance 或远程设备身份；
- rights terms digest；
- capability-critical server version；
- 对可控bridge：active route、RouteSet或queue generation；对opaque public proxy：binary/process/listener/public config generation或其Messages conformance profile。
- Execution peer PID-start/binary/publisher/config generation、funding template 或 sandbox backend/policy；
- TCK verifier policy、trusted builder/issuer、connector provenance 或 delegated TUF role 撤销。

失效后的动作严格服从 §4.8：identity/security/rights/billing/data/route 与行为性 adapter 变化立即 hard stop；只有非行为性 catalog/performance 变化可在有期限 grace policy 下使用重新符合当前安全策略的 LKG。若运行时继续 pin digest 固定且仍受支持的旧 adapter artifact，则它不是“新 adapter 沿用旧 receipt”。CC Switch同一代理地址的binary/process/listener或公开config generation变化会撤销旧opaque-proxy conformance；SayDo本来就不持有其上游route证明，不能声称“旧路由仍在”。

### 13.3 数据保留

- Discovery cache 只存元数据和时间，不存 secret/prompt/response。
- Capability fixture 可保存结构和脱敏字段；真实文本只存 digest。
- Rights receipt 保存 URL、时间、摘要和人工/自动判定来源，不长篇复制受版权保护文档。
- 审计不可变，运行日志可轮转；敏感 payload 一律 digest。
- telemetry 可保存规范化 origin 的设备 keyed HMAC 作为误投调查关联键，不保存 URL、query 或原 origin。

### 13.4 平台服务、迁移与测试账号运维

- platform-security helper逐平台监控版本握手、签名/attestation失败、权限漂移、lease撤销延迟、crash/hang、升级/降级结果和capability降级原因；告警只携带opaque identity/digest，不含secret、路径或用户内容。helper不可用时对应远程credential、付费或Execution能力立即`revoke_disable`，匿名本机降级仍保持可解释。
- anchor witness按realm监控逐member availability、threshold quorum、append/read/consistency延迟、continuity gap、证书/密钥到期、observer独立性、容量和月度成本。失去threshold或连续性时撤销持久authority，不以单member或wall clock临时续命；global、中国大陆和enterprise分别值守、演练与发布。
- `runtime-child-registry-v1-to-v2`仪表按五态记录JSON-only、shadow、reconciled dual-write、SQLite authoritative dual-write与SQLite-only数量，以及单边写、identity冲突、quarantine、未关闭operation和上一版降级结果。任何冲突或in-flight无法对账时停止cutover和进程信号动作，不自动删除旧投影。
- provider test-account pool按product/realm/principal/auth/MFA/billing记录可用、leased、quarantined、cleanup pending和reset drift数量；对预算不足、MFA无人值守、凭据撤销失败、资源残留、billing hold未对账和连续两cycle coverage缺口分别告警。个人账号不得作为应急容量，quarantine不得通过缩小mandatory集合“恢复绿色”。
- strict合同编译每次保存compiler、argv、lockfile、runner/hardware、source、types、instantiations、peak RSS、wall、diagnostics与stub count的原始报告和签名baseline；靠提高baseline或换runner掩盖回退会触发release blocker和第10项owner决策，不由CI自动接受。

## 14. 风险与决策点

| 风险 | 处置 |
|---|---|
| 厂商协议快速变化 | signed registry + adapter version + fixture + weekly drift report |
| “兼容”只有部分字段 | capability receipt，不按营销词放行 |
| 订阅条款因 edition/地区变化 | rights receipt + 精确产品/分发形态 + expiresAt + 独立审核；unknown fail-closed |
| 自动发现拖慢首启 | cache-first、总预算、后台更新、单 detector 熔断 |
| 本地端口误识别 | response signature + OS 观察的 peer + 平面 endpoint identity，不按端口定品牌 |
| 自定义 URL SSRF/secret 泄漏 | 唯一安全 dialer、DNS-to-socket pin、显式 proxy、per-endpoint/version secret |
| 推荐器看似智能但不可解释 | 硬约束与打分分离、确定性 golden、显示三条理由 |
| provider 过多导致维护爆炸 | 三核心协议 + 数据 registry；只有非同构协议/认证才写 adapter |
| 最小公分母 IR 静默丢能力 | 可保真 IR + 显式 AdaptationPlan；loss 未授权则首字节前拒绝 |
| catalog/discovery 拖入热路径 | 控制面编译不可变 snapshot；数据面只做有界 lookup/admission/adapter pipeline |
| 第三方 plugin 崩溃或窃取 secret | 首发只接受声明式包；code plugin 只有在对应 OS 的 deny-by-default sandbox 和 syscall 负例通过后才开放 capability 模式，并叠加 opaque handle、TCK、签名、资源上限与熔断；普通同 UID 子进程不算隔离 |
| SDK 过早稳定形成兼容包袱 | `v1alpha1` + API report；两个外部参考实现和升级演练通过后再 stable SemVer |
| registry/policy/TCK 供应链被劫持 | catalog/policy 双 TUF root、rights/billing/data/emergency delegated roles、trusted builder verifier policy、threshold signing、anti-rollback/expiry/revoke、SBOM/SLSA/Sigstore |
| 自动付费 fallback | 正交 funding/overage/route + 原子 SpendAuthorization；任一 unknown 不进 no-new-spend |
| Agent surface 带工具越权 | 严格判别联合；dispatch Gate 0 + 每个副作用前 gate；不可证明即 inventory |
| 并行施工污染当前脏树 | 先解开唯一 active pointer 和 dirty canonical；分支/clone 不构成治理豁免 |

需要 owner 拍板的十项，本文给出默认推荐；未拍板项不由施工方推断：

1. 排产坐标：先对账 HANDOFF/PLAN-2 并关闭旧 pointer，再把本专题拆成具名子批；未完成前禁止 Phase 0。
2. Codex App Server/ACP 归属：推荐作为独立 Execution Agent plane，经控制桥接入；若并入 Tier 1/Hopper，必须同步 D8 与全部状态/proof 合同。
3. evaluator 同 family 降级：推荐保留“可聊天但缺独立复核”的显式降级，不允许其达到 `review_ready`。
4. 分发版 Claude 订阅接入：推荐默认禁止，只给 API；获 Anthropic 批准或官方明确 surface 后再开。
5. LAN 自动发现：推荐默认关闭，只探 loopback；用户主动开启一次且可撤销。
6. secret/付费边界：推荐无可证明 secret broker 隔离则禁用远程 agent+API 组合；付费 fallback 默认关闭，用户可分别建立单次授权或有硬上限的持久预算。
7. 扩展交付边界：推荐内置受信 connector 与 TUF 签名声明式 product pack 首发 `builtin_stable`；第三方 code plugin 只有在当前 OS 的 App Sandbox/namespace+seccomp+Landlock/AppContainer 等 deny-by-default backend 通过直接 syscall TCK 后才可进入 `community_verified` capability 模式。缺 backend 时只 `inventory`；“完全信任的本机代码”仅开发模式并永久不授 `community_verified`、`builtin_*` 或本机数据驻留 badge。WASI 只作为后续满足同等 TCK/性能后的宿主，不作为首发依赖。
8. Registry 信任域：推荐 `catalog.tuf` 与 `policy.tuf` 使用不同 root、threshold 和发布权限；`policy.tuf` 再委派 credential-egress、rights、billing、data-boundary、emergency-deny 五个路径隔离 role，TCK trusted-builder/verifier policy 也使用独立 delegation。技术 catalog 或 connector publisher永远不能给自己签发 secret egress、Rights allow、正式 conformance badge 或 emergency deny。
9. SDK 与运行时演进：推荐 Connector SDK 以 `v1alpha1` 发布，两个独立外部 reference connector 经过至少一个 minor 升级仍兼容后再 stable；保持 TypeScript/Node 22 主实现，只有 §12 profile 证明具体热点跨平台不达标且局部 native/Wasm 实现通过同一 TCK、故障隔离、供应链与回滚门，才允许引入，不接受无数据重写。
10. 合同编译资源基线（**2026-08-24 注：本项前提已变，建议暂缓签署**——该预算原为「Markdown 内嵌类型体操」设定，合同草案已外移为 `ai-supply-contracts-draft/` 下的真实 `.ts` 文件，下沉 `packages/contracts` 后须在新 profile ID 下重新推导，照签无效）：推荐采用`type-contract-compile-budget-v1`的Node 22、准确单次`--max-old-space-size=2048`、手写schema 1 MiB/20,000行、完整generated contract 4 MiB/80,000行且bytes/lines至少保留30%容量、2.5 GiB peak RSS、900,000 type instantiations、60秒wall和零stub绝对门，同时保留相对签名基线的RSS/instantiation不超过15%、wall不超过20%、source不超过15%的回退门；完整合同与每个fixture隔离测量。任何扩大heap/预算、换runtime或runner后重置基线、把共同加载合同伪拆成不相交单元，或为新增类型恢复`any` stub都必须由owner签名决定，并在新profile ID下解释为何不能通过生成代码、真实package边界或简化类型解决。

## 15. 官方证据基线

以下资料用于 2026-08-24 的协议、surface 与权益判断，本节链接的 `accessedAt=2026-08-24`。实现时必须生成 `evidence-lock.json`，保存 content-addressed raw evidence、canonical URL、`accessedAt`、locale/region/account context、fetcher/canonicalizer version、normalized projection digest/schema、适用 product/surface/use case、reviewer与 expiry；GitHub 架构证据尽量固定到本日读取的 commit permalink。动态厂商文档、价格和条款在每次 policy release 前重新核对，不能把本文快照永久当真。

### IETF 协议基础

- [RFC 3986 URI Generic Syntax](https://www.rfc-editor.org/info/rfc3986/)：Base URL 与 relative operation path 使用标准 reference resolution；SayDo 在其上增加禁止 dot segment、encoded separator、query/fragment 和歧义版本段的安全约束。
- [RFC 6749 OAuth 2.0](https://www.rfc-editor.org/info/rfc6749/)：public/confidential client、client authentication、authorization-code exchange 与 refresh grant 是不同状态和凭据转换；每次 token endpoint 请求只能采用一种 client authentication 方法，refresh 必须绑定原 grant 与输入凭据版本。
- [RFC 7636 PKCE](https://www.rfc-editor.org/info/rfc7636/) 与 [RFC 8628 Device Authorization Grant](https://www.rfc-editor.org/info/rfc8628/)：authorization-code + PKCE 和 device flow 是不同 grant；后者使用 device/user code、verification URI 与 token polling，不伪造 callback/state/code verifier。
- [RFC 8252 OAuth 2.0 for Native Apps](https://www.rfc-editor.org/info/rfc8252/)：桌面/public native client 不被视为能保守共享 secret；PKCE、外部 user-agent、完整 redirect URI 注册与 loopback redirect 例外进入 client registration 和 flow-start 合同。
- [RFC 8705 OAuth mTLS](https://www.rfc-editor.org/info/rfc8705/)：TLS client identity、client registration 与应用 Bearer/OAuth 身份是可组合但不同的凭据层，必须分别绑定和授权。
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0-18.html)：使用 ID Token 的产品必须校验 issuer、audience、authorized party、nonce、时间与签名；`aud`/`azp` 不是可由 provider label 或 UI account name 推导的装饰字段。

### OpenAI/Anthropic

- [OpenAI Codex authentication](https://developers.openai.com/codex/auth)：ChatGPT交互登录、Platform API key与Enterprise automation access token对应不同用途、计费和管理员治理；API key不消费ChatGPT套餐额度，automation token也不等于通用OpenAI API key。
- [OpenAI Codex configuration reference](https://developers.openai.com/codex/config-reference)：custom `model_providers.<id>.base_url`是一等配置，但当前`wire_api`唯一支持值为`responses`；内置`ollama/lmstudio`与`--oss`不能外推为Chat/Messages兼容能力。
- [Codex App Server](https://developers.openai.com/codex/app-server)：官方产品嵌入协议，包含认证、历史、审批和流式 agent event。
- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)：Responses 是独立的 `/responses` 资源，不是 Chat Completions 的 URL 别名。
- [Claude API overview](https://platform.claude.com/docs/en/api/overview)：原生 `POST /v1/messages`、`GET /v1/models`、`x-api-key`/短期 Bearer 与必需 `anthropic-version`。
- [Anthropic OpenAI SDK compatibility](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk)：官方建议完整生产能力使用原生 Claude API。
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)：未获批准的第三方不得向产品用户提供 claude.ai 登录或订阅限额，应使用 API key。

### 中国大陆与 Coding Plan

- [Kimi Code current English docs](https://www.kimi.com/code/docs/en/) 与 [Claude Code接入说明](https://www.kimi.com/code/docs/en/third-party-tools/claude-code.html)：会员编程服务、CLI/VS Code/ACP与第三方API是不同surface；第三方API明确给出OpenAI Base URL `https://api.kimi.com/coding/v1`及Chat endpoint、Anthropic Base URL `https://api.kimi.com/coding/`及`/v1/messages`，OpenAI SDK路径产生Bearer而Anthropic SDK路径由`ANTHROPIC_API_KEY`产生`x-api-key`，并要求保留真实`User-Agent`。实现必须逐协议登记requirement并从版本化官方目录/权益证据生成模型候选，不能固化旧model ID、把CLI登录态当API授权，或混用Kimi Platform按量key与Kimi Code会员key。
- [Kimi Code membership](https://www.kimi.com/code/docs/en/kimi-code/membership.html)：CLI、VS Code 和第三方工具共享会员额度；Extra Usage 只有用户启用后才自动扣余额，并可配置月度 cap。
- [Kimi providers and models](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/providers)：官方实现 Chat、Responses、Messages、Google GenAI、Vertex，使用 streaming，并有离线 model catalog snapshot。
- [Z.AI GLM Coding Plan quick start](https://docs.z.ai/devpack/quick-start)：国际产品的 Coding Plan 只覆盖官方页面列明的工具与产品；不能推导中国 BigModel 的 endpoint 或权益。
- [GLM 中国 Coding Plan 订阅协议](https://docs.bigmodel.cn/cn/terms/subscription-agreement) 与 [快速开始](https://docs.bigmodel.cn/cn/coding-plan/quick-start)：中国产品需独立判断自建应用/backend 使用边界。
- [智谱中国普通 API HTTP 调用](https://docs.bigmodel.cn/cn/guide/develop/http/introduction)、[对话补全](https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8) 与 [Claude API 兼容](https://docs.bigmodel.cn/cn/guide/develop/claude/introduction)：普通开放平台同时公开`/api/paas/v4/chat/completions`和Base URL `https://open.bigmodel.cn/api/anthropic`的`/v1/messages`；Chat精确使用`Authorization: Bearer`，Messages精确使用`x-api-key`。二者分别登记profile与普通平台key namespace，仍不能从Coding Plan外推Responses或借用套餐key。
- [Z.AI 普通 API HTTP 调用](https://docs.z.ai/guides/develop/http/introduction) 与 [Chat Completion](https://docs.z.ai/api-reference/llm/chat-completion)：国际普通 endpoint 与 Coding endpoint 分离，当前本方案只据官方 Chat 证据开放普通 API profile。
- [MiniMax 国际 Token Plan](https://platform.minimax.io/docs/token-plan/cursor) 与 [MiniMax 中国 Token Plan](https://platform.minimaxi.com/docs/token-plan/cursor)：国际站和中国站是不同账号域、文档域与产品 realm；registry、key、endpoint、计费和数据证据必须分开，不能只保留一条品牌级 preset。
- [MiniMax other tools](https://platform.minimax.io/docs/token-plan/other-tools)：官方给出 OpenAI/Anthropic 兼容 endpoint 和多种第三方工具接法。
- [Alibaba Cloud Coding Plan](https://help.aliyun.com/en/model-studio/coding-plan)：Coding Plan 与普通 API key/Base URL 分开，并限编程工具场景。
- [Alibaba Cloud Coding Plan FAQ](https://help.aliyun.com/zh/model-studio/coding-plan-faq)：明确禁止把 Coding Plan 用于自定义应用后端或非交互式批量 API。
- [Alibaba Cloud Anthropic-compatible Messages](https://help.aliyun.com/en/model-studio/anthropic-api-messages) 与 [Codex integration](https://help.aliyun.com/zh/model-studio/codex)：同一平台按 workspace/region/product 提供独立 Messages endpoint，且按模型区分 Responses 与 Chat；部分 Messages endpoint 不提供 `/v1/models`，证明 protocol、model discovery 与 `wire_api` 都必须是一等字段。
- [Alibaba Cloud Model Studio regions](https://help.aliyun.com/en/model-studio/regions/) 与 [API key guide](https://help.aliyun.com/zh/model-studio/get-api-key/)：中国北京、新加坡、美国弗吉尼亚、德国法兰克福等 region/deployment scope、API host与 key上下文不同，必须形成 realm级 entry与逐地域报告。
- [DeepSeek 首次调用](https://api-docs.deepseek.com/zh-cn/) 与 [Anthropic API](https://api-docs.deepseek.com/zh-cn/guides/anthropic_api)：当前普通 API 分别提供 OpenAI Chat 与 Anthropic Messages Base URL，并存在模型名映射/协议差异；模型、工具和 JSON 能力会更新，不能长期硬编码旧模型名。
- [Baidu Qianfan API V2](https://cloud.baidu.com/doc/qianfan/s/qmh4sv5vi)：官方兼容 OpenAI 认证和协议；Token 产品另提供 Anthropic compatible endpoint。
- [Baidu Token Plan 个人版](https://cloud.baidu.com/doc/qianfan/s/Dmrabu8b6)、[企业版](https://cloud.baidu.com/doc/qianfan/s/ymq8wwch2) 与 [Token 福利包](https://cloud.baidu.com/doc/qianfan/s/Smoghsq3g)：三者是不同产品/edition，不能与旧 Coding Plan 或普通 API 合并。
- [Tencent TokenHub API 使用说明](https://cloud.tencent.com/document/product/1823/130078)：广州`https://tokenhub.tencentmaas.com`与新加坡`https://tokenhub-intl.tencentmaas.com`是独立站点，key不跨站，并各有官方备用origin；`GET /v1/models`使用Bearer认证。实现把站点、key namespace、模型开通和资源调度范围绑定为同一realm证据，切换备用origin也重新生成endpoint identity与route fence。
- [Tencent TokenHub 语言模型调用概览](https://cloud.tencent.com/document/product/1823/130079)：官方同时公开Chat`/v1/chat/completions`、Responses`/v1/responses`和Messages`/v1/messages`；前两者使用`Authorization: Bearer`，Messages使用`x-api-key`，并定义401002、402、429以及流中SSE错误。三条protocol requirement与两站分别验收，模型服务开通和协议支持分别观察。
- [Tencent TokenHub 计费方式](https://cloud.tencent.com/document/product/1823/130054) 与 [推理模式介绍](https://cloud.tencent.com/document/product/1823/135900)：TokenHub普通语言模型API默认支持按量后付费，TPM预留和模型单元是其容量/资金权利。基础API requirement固定为payg；可选容量只经准确账户、地域、模型、订单与超额policy的独立funding receipt进入，不能由套餐名或API key推断，更不能把独立Token Plan并入这一资金union。
- [Tencent Hunyuan OpenAI compatibility](https://cloud.tencent.com/document/product/1729/111007)：旧OpenAI Chat入口只用于既有连接识别与迁移；fresh onboarding默认转向TokenHub，不能继续把旧入口列为新用户L0主路径。
- [Tencent Token Plan 个人版](https://cloud.tencent.com/document/product/1823/130060/)：个人套餐使用独立`sk-tp-*` key与`https://api.lkeap.cloud.tencent.com/plan/v3`、`https://api.lkeap.cloud.tencent.com/plan/anthropic`两个Base URL，只公开Chat Completions与Anthropic Messages，不包含Responses；套餐仅允许页面列出的AI工具，并限制自动化脚本、自定义应用后端与非交互批量。SayDo未列入allowlist时不得读取或直连该key。
- [Tencent Token Plan 企业版概述](https://cloud.tencent.com/document/product/1823/131172)、[快速入门](https://cloud.tencent.com/document/product/1823/130660)与[轻享套餐](https://cloud.tencent.com/document/product/1823/131173)：企业版是面向企业/团队的API月度订阅，专业套餐`enterprise`使用积分池，轻享套餐`enterprise-auto`使用Token池；广州与新加坡套餐、Key、模型权限和资源调度范围不能跨地域或跨站点替代。
- [Tencent Token Plan 企业版 Anthropic API](https://cloud.tencent.com/document/product/1823/135874)与[Claude Code接入](https://cloud.tencent.com/document/product/1823/130665)：广州使用`https://tokenhub.tencentmaas.com/plan/v3`和`/plan/anthropic`，新加坡使用对应`tokenhub-intl` origin，公开的完整操作只有Chat Completions与Messages；Messages按Anthropic惯例使用`x-api-key`，官方兼容层也接受Bearer，但一个物理请求只允许选择一种凭证header。本方案据此建立四条固定row，不从普通TokenHub外推Responses或models目录。
- [Volcengine Ark Responses](https://www.volcengine.com/docs/82379/1795150)：方舟提供 OpenAI Responses 入口，不能只按 Chat 接入。
- [BytePlus ModelArk](https://docs.byteplus.com/en/docs/modelark/1099455)：国际 ModelArk 与中国火山方舟分 product realm、账号/key、endpoint、计费和数据证据，不从同品牌外推。
- [SiliconFlow 中国 quickstart](https://docs.siliconflow.cn/cn/userguide/quickstart) 与 [SiliconFlow 国际 quickstart](https://docs.siliconflow.com/en/userguide/quickstart)：中国与国际站使用独立文档/服务 realm，GA matrix 分别验 key、endpoint、route、费用与数据边界。

### 全球 CLI 与订阅变更

- [Gemini API reference](https://ai.google.dev/api) 与 [Gemini API key guide](https://ai.google.dev/gemini-api/docs/api-key)：Gemini API 是独立的 Google GenAI programmatic surface，REST精确使用`x-goog-api-key`；key所属project、限制、轮换和删除生命周期进入credential receipt。Phase 3给出具名L0 API-key垂直切片，不与Gemini CLI/Antigravity权益合并。
- [Google Cloud deployment pipeline WIF](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines) 与 [AWS/Azure WIF token exchange](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-clouds)：外部账号配置里的STS `audience`精确为不带scheme的`//iam.googleapis.com/projects/.../providers/...`，而IdP token自己的`aud`可以是带`https://`的provider URL；两者是独立字段。实现只接受经schema与来源校验的`external_account` profile，逐项绑定`token_url`、subject token type/source、STS request和可选service-account impersonation，禁止用一个通用JWT模板互换。
- [Gemini CLI 迁往 Antigravity 公告](https://github.com/google-gemini/gemini-cli/discussions/27274) 与 [2026-06-18 切换完成公告](https://github.com/google-gemini/gemini-cli/discussions/28017)：个人 Pro/Ultra/free 账号迁到 Antigravity CLI，Gemini CLI 保留企业/Cloud/API-key 路径。
- [OpenRouter官方标为OAuth的PKCE key交换](https://openrouter.ai/docs/guides/overview/auth/oauth) 与 [BYOK](https://openrouter.ai/docs/guides/overview/auth/byok)：前者返回用户控制API key，不具标准client_id/scope/access/refresh token语义；它与BYOK/平台credits是不同认证、资金来源。
- [OpenRouter Management API keys](https://openrouter.ai/docs/guides/overview/auth/management-api-keys)：管理BYOK配置需要独立权限；普通inference key或PKCE换取key不能被视为可读取和冻结多key/fallback配置的authority。
- [OpenCode Go](https://opencode.ai/docs/go/)：Go 是可用于其他 agent 的独立订阅 API；当前官方model表逐模型分配`/v1/chat/completions`、`/v1/responses`或`/v1/messages`，另有`/v1/models`。5小时/周/月限额与模型目录会变化，限额耗尽后可由用户开启Zen balance fallback，数据保留与训练条款按模型不同。
- [OpenCode Zen](https://opencode.ai/docs/zen/)：Zen 是独立的按量 AI gateway/API key 产品；当前官方model表同样逐模型分配Chat、Responses、Messages或原生Google endpoint，价格、自动充值与月度限额不能与Go或OpenCode Server混合。

### 开源架构、扩展与供应链

- [Vercel AI SDK providers](https://github.com/vercel/ai/blob/ed857f50f112e23930b0c2dd8d532cc8bebbc911/content/docs/02-foundations/02-providers-and-models.mdx) 与 [Language Model Middleware](https://github.com/vercel/ai/blob/ed857f50f112e23930b0c2dd8d532cc8bebbc911/content/docs/07-reference/01-ai-sdk-core/65-language-model-v2-middleware.mdx)：公开 provider specification、独立 provider packages 与可组合 middleware 是 SDK 分层的重要参考。
- [OpenCode LLM design](https://github.com/anomalyco/opencode/blob/3a31c4ea801915c0b050df4b3842997ea62b6e93/packages/llm/DESIGN.md)、[provider/model v2 spec](https://github.com/anomalyco/opencode/blob/3a31c4ea801915c0b050df4b3842997ea62b6e93/specs/v2/provider-model.md)、[models.dev](https://github.com/anomalyco/models.dev/tree/409c845d2de6c1687d7e7c5692fa7e92bfe5ecdb) 与 [sync architecture](https://github.com/anomalyco/models.dev/blob/409c845d2de6c1687d7e7c5692fa7e92bfe5ecdb/sync.md)：deployment config/request behavior 分离、生成式离线 catalog 和同步流水线用于本方案的控制面设计；其 catalog 仍不能替代 Rights。
- [LiteLLM docs](https://docs.litellm.ai/)：协议归一、gateway/router、预算和观测可作为 bridge 经验；SayDo 不继承其隐藏 fallback 决策。
- [Envoy AI Gateway architecture](https://aigateway.envoyproxy.io/docs/concepts/architecture/) 与 [Gateway API Inference Extension](https://gateway-api-inference-extension.sigs.k8s.io/)：控制/数据面、model-aware routing 与 endpoint picker 的边界是 snapshot/data-plane 设计参考。
- [Gateway API conformance profiles](https://gateway-api.sigs.k8s.io/geps/gep-1709/) 与 [conformance overview](https://gateway-api.sigs.k8s.io/docs/concepts/conformance/)：命名 profile、core/extended 和机器可读报告用于 SayDo TCK，不使用单一 compatible 布尔值。
- [Cline SDK architecture](https://github.com/cline/cline/blob/2266fe8cf4d5b3e7f23e3083f0059c5e64c23264/sdk/ARCHITECTURE.md) 与 [packages overview](https://github.com/cline/cline/blob/2266fe8cf4d5b3e7f23e3083f0059c5e64c23264/sdk/packages/README.md)：LLM、agent、core 的包边界和后台发现用于单向依赖对标。
- [Open WebUI protocol-first provider guide](https://github.com/open-webui/docs/blob/1eea3847ca6c2b0f2ca79a300925592c0da7c8d0/docs/getting-started/quick-start/connect-a-provider/starting-with-openai-compatible.mdx) 与 [Jan custom endpoint](https://github.com/janhq/jan/blob/b06885c03109a5f243c6c9f1992656eb302f0754/docs/src/pages/docs/desktop/remote-models/custom-endpoint.mdx)：证明自定义兼容 endpoint 的需求广泛，也暴露只依赖 `/models` 和假 key 的体验缺口。
- [HashiCorp go-plugin](https://github.com/hashicorp/go-plugin/tree/dd3617ad0257b2e8fe63d5afe805b16a146c3ab9) 与 [WASI](https://wasi.dev/)：子进程 RPC/握手/崩溃隔离和 capability-based sandbox 是 code plugin 宿主参考；本方案不因此绑定 Go，也不把 RPC handshake 当作安全边界或提前承诺 Wasm 首发。
- [Agent Client Protocol architecture](https://agentclientprotocol.com/get-started/architecture) 与 [VS Code Agent Host](https://code.visualstudio.com/docs/agents/concepts/agent-host)：独立长生命周期 agent、双向权限和任务事件属于 Execution Agent plane，不是 inference adapter。
- [OpenTelemetry GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/) 与 [semantic conventions](https://opentelemetry.io/docs/specs/semconv/)：统一观测字段同时明确内容敏感性；SayDo 默认关闭 prompt/response 内容记录。
- [TUF specification](https://github.com/theupdateframework/specification/blob/59e601ed29c0d2e497264ae8b31c11b8ef07df1e/tuf-spec.md)、[tuf-js](https://github.com/theupdateframework/tuf-js/tree/a399ce87d8d908f64d53696a673420193424e0de) 与 [Sigstore root signing](https://github.com/sigstore/root-signing/tree/60cf2ce8b2e45d600dc17c4421e8c751e75772be)：用于双 registry trust domain、delegation/threshold、expiry、rollback/freeze 防护和 Node 客户端 Phase 0 spike，禁止自写简化验签器。
- [SLSA build requirements](https://slsa.dev/spec/v1.2/build-requirements)、[Sigstore verification](https://docs.sigstore.dev/cosign/verifying/verify/)、[SPDX scope](https://spdx.github.io/spdx-spec/v3.0.1/scope/) 与 [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/d1fab88f54636ff366076edfc5c239f97b3c8e66/docs/checks.md)：构成 release provenance、签名、SBOM 与仓库治理基线。
- [Apple App Sandbox](https://developer.apple.com/documentation/security/app-sandbox)、[Linux Landlock](https://www.kernel.org/doc/html/latest/userspace-api/landlock.html) 与 [Windows AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation)：三平台都提供限制 ambient authority 的系统能力，但语义不同；SayDo 必须分别构造 sandbox backend 和直接 syscall TCK，不能用子进程 RPC 代替。

### Open-source、本地与云

- [OpenCode providers](https://opencode.ai/docs/providers/)：provider catalog/custom provider、model级SDK与Base URL配置分离，不能由一个品牌推导统一wire protocol。
- [OpenCode Server](https://opencode.ai/docs/server/) 与 [OpenCode CLI/ACP](https://opencode.ai/docs/cli/)：提供 loopback HTTP Server、OpenAPI 与 ACP surface。
- [CC Switch Desktop proxy/failover](https://github.com/farion1231/cc-switch/blob/5ca9459d50ea4beea6a81bbc509de6ec5b6b09ca/docs/user-manual/en/4-proxy/4.3-failover.md)：桌面代理可自动切换备用 provider，不能只记录静态 active route。
- [cc-switch-cli README](https://github.com/SaladDay/cc-switch-cli/blob/c2831a47194edd9d9a0fe05782907e4ca6239a8a/README.md)：独立 CLI fork 提供机器命令；其能力不能外推给桌面项目。
- [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)：支持 `/v1/chat/completions`、`/v1/responses`、`/v1/models`，示例 key 仅为兼容占位。
- [Ollama Cloud](https://docs.ollama.com/cloud) 与 [Ollama Pricing](https://ollama.com/pricing)：loopback API 可调用 cloud model，且套餐/超额资金来源不能从“无 key”推导。
- [Ollama FAQ](https://docs.ollama.com/faq) 与 [running models API](https://docs.ollama.com/api/ps)：模型默认约五分钟后卸载，空请求可预加载，而 `/api/ps` 只证明当前 loaded 状态；因此冷态需要独立、禁止下载/外网的 preload 授权，不能要求用户手工预热。
- [LM Studio REST API](https://lmstudio.ai/docs/developer/rest)、[OpenAI compatibility](https://lmstudio.ai/docs/developer/openai-compat) 与 [Anthropic compatibility](https://lmstudio.ai/docs/developer/anthropic-compat)：当前明确同时提供native`/api/v1/*`、`/v1/chat/completions`、`/v1/responses`与`/v1/messages`，默认`localhost:1234`且可配置API token；Require Authentication关闭时Messages不发送credential header，开启时官方当前同时接受`x-api-key`和`Authorization: Bearer`，SayDo按签名oracle优先`x-api-key`、允许显式Bearer且每个物理请求恰好发送一种。native REST的Bearer示例不能被误当作Messages唯一wire。四类endpoint与全部auth分支逐项实测。
- [LM Studio LM Link](https://lmstudio.ai/docs/developer/core/lmlink)：本机入口可连到另一台设备，loopback 不等于本机计算。
- [oMLX](https://github.com/jundot/omlx/tree/2df39bfcdd9c8fb80847b2869d7f2d62a162f673)：Apple Silicon 本地服务，提供 Chat、Responses、Messages、models、streaming、tools 与 structured output。
- [Docker Model Runner](https://docs.docker.com/ai/model-runner/)、[API reference](https://docs.docker.com/ai/model-runner/api-reference/) 与 [get started](https://docs.docker.com/ai/model-runner/get-started/)：需要区分组件未启用、TCP/API未开放、无模型、冷态与已加载，不能由普通容器名猜成可用，也不能自动 enable/pull。
- [Podman AI Lab](https://podman-desktop.io/docs/ai-lab)、[starting an inference server](https://podman-desktop.io/docs/ai-lab/start-inference-server) 与 [official AI application tutorial](https://podman-desktop.io/tutorial/running-an-ai-application)：AI Lab 是独立 Podman Desktop extension；model service需要已下载模型并由用户创建/启动，随后暴露 OpenAI-compatible API。SayDo 因而只能静态识别、经确认只读检查既有 service并给出处方，不能把普通Podman容器、自动下载模型或自动创建service写成开箱能力。
- [Microsoft Foundry Local](https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-local/what-is-foundry-local) 与 [Apple Foundation Models](https://developer.apple.com/documentation/FoundationModels)：系统级本机模型需要专用 runtime/native helper、OS availability与能力 TCK，不能假设它们暴露 OpenAI-compatible HTTP。
- [vLLM OpenAI-compatible server](https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/)、[llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/3f545beccee69d9975f466ec7e45fd9aacd8ba90/tools/server/README.md)、[SGLang docs](https://docs.sglang.io/) 与 [LocalAI docs](https://localai.io/docs/index.html)：本地/自托管实现的兼容面、启动参数和模型能力并不等价，必须逐 endpoint/model/profile 实测。
- [Amazon Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html)：统一 messages/tool interface，使用 IAM action 和 model/profile 语义。
- [Bedrock API compatibility](https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html) 与 [Bedrock API keys](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html)：当前还存在兼容 route 与 Bearer API key，必须按 route/auth 分开。
- [Vertex AI OpenAI compatibility](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/call-vertex-using-openai-library)：Vertex 有兼容端点但官方仍建议新项目优先 Google Gen AI SDK。
- [Azure OpenAI Responses](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses)：API key路径精确使用`api-key`请求头，Microsoft Entra ID路径使用`Authorization: Bearer`；resource、deployment、tenant、principal和token audience分别进入身份合同，不能统一渲染为OpenAI Bearer key。
- [Azure VM Managed Identity token endpoint](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-use-vm-token) 与 [Azure App Service Managed Identity](https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity)：VM/VMSS必须向本机IMDS `http://169.254.169.254/metadata/identity/oauth2/token`发送`GET`、`Metadata: true`、resource与API version；App Service则使用受平台证明的`IDENTITY_ENDPOINT`和轮换的`IDENTITY_HEADER`作为`X-IDENTITY-HEADER`。Managed Identity不是无client credential地直连tenant `/oauth2/v2.0/token`，也不在普通macOS/Windows/Linux桌面上生成正向run；每种hosted source profile独立验endpoint、header、resource、principal与generation。

## 16. 定义完成

本专题只有同时满足以下条件才可说“交付”：

- canonical 与工程 ADR 已批准，PLAN-2 已有唯一排产坐标；
- v20公共合同是唯一外部受信面：5个准确wire/RPC/离线验证facade producer、5个根receipt、完整六字段pointer edge manifest和真实正反fixture在clean build中可重现；所有public producer返回JCS验证的deep-frozen committed receipt，细粒度lifecycle producer不对SDK开放，v19及更早producer公开导出为0。固定37-suite/39-row signed BOM只有同一BOM和非联合distribution上的完整successful orchestrator可晋升；public compiler、edge manifest、fixed与owner migration gate、972-cell a11y、手写/生成source type gate、平台/witness、evidence/claim/四件套全部被`commitReleaseEcosystemBindingV20`准确消费；
- connection/binding/五种 execution surface 判别联合、可扩展 protocol ID、三核心协议、OAuth 双 grant、复合 transport/auth、event 状态机、secret broker/ACL、安全 dialer、三平面 durable cursor/physical lease、compute/rights/billing/data policy 全部落地；
- 标准OAuth、OpenRouter API-key PKCE、AWS static profile/workload identity与声明式signer四类认证生产者严格分离；native public/confidential client边界、held callback、credential family/issuance、逐请求credential lease和refresh winner全部通过换挂、并发、kill-point与旧epoch测试；
- 所有本地高影响动作先经过可验证的local session、proposal、disclosure、accepted decision和durable single-use consumption；消费cursor严格为available→in-flight→consumed并把最终action core绑定到同一lease。OAuth/API-key browser、custom header、manual reconciliation与GA owner裁决都不能补签、从错误状态取lease或重放。所有writer/time/TUF高水位绑定不可回退anchor；`packages/platform-security`、三个native helper/installer、`packages/anchor-witness-client`、production witness及global/中国大陆/enterprise IaC都以最终分发形态通过，macOS/Linux/Windows才有真实producer；缺强anchor时只允许boot-scoped匿名本机plain-dialog降级。TUF从预置root逐步双阈值rotation、按repository+role防回滚并保留完整root-to-target lineage；
- 自动导出的receipt edge manifest完整表达复合ordering、same-value、state projection、branch predicate与CAS authority，同时生成refinement、producer DAG、instance graph verifier和mutation fixtures；OAuth、workload issuance、conformance、runtime、fallback、metadata、persistent budget、ledger correction、local preload、Execution和GA图均无环、无通用引用旁路且每个受保护动作只有一个可消费前驱；
- 可保真 Inference IR、控制面编译/不可变 snapshot、固定数据面 pipeline、逐 tool effect-once/fencing、背压/取消和 hard-stop in-flight abort 达到 §12.1 SLO；registry/discovery/plugin 故障不进入既有请求热路径；
- conformance与runtime严格按“ready cursor → 无发送权intent → credential/peer/compute完整descriptor → 条件式final physical lease并置in-flight → hosted-tool authorization bundle取得最终发送权 → durable send intent → 首字节 → 权威terminal”收口；fallback、metadata、Execution start/recovery/session/turn/request与tool external request/effect也都使用状态专属cursor和single-use lease。zero-attempt/zero-solution/zero-work均有可达的具名terminal与final transition；`delivery_unknown`、迟到usage、persistent budget correction和人工调和不会被自动重试、恢复ready、提前释放预留或伪装成settled；
- conformance一次decision精确授权staged/live两个完整round tuple，每轮在最终send intent前闭合credential/local-compute/prepared descriptor、条件式physical lease与hosted authorization bundle，并只以同round typed success terminal、actual report和连续ledger range完成；custom unknown与official unknown不混装。Execution从session start、可重复权威recovery、turn unknown reconciliation到zero-turn/zero-request/zero-tool-work final transition、registered tool-call set、tool-results-applied、side-effect authority terminal与人工调和全部可机械重放；persistent budget的余额预留可支持同policy并发，child settlement独立且只有finality可释放hold，ledger correction会回写预算并在不足时deficit hard-stop；
- `@saydo/connector-sdk`、runtime、builtins、唯一 TCK runner 和单向依赖门可供外部维护者使用；真实 tarball 在仓外 fresh consumer 可安装，至少两个独立 reference connector 不改 daemon 核心即可通过升级与 conformance 演练；
- `ga-ecosystem-matrix.json` 中 required 的中国大陆、全球 API、本地 runtime 与 Agent/bridge 产品按各自 gate 通过，包括 Gemini API、BigModel/Kimi/OpenCode/Ollama/oMLX、TokenHub广州/新加坡普通API、Docker Model Runner与Podman AI Lab；TokenHub普通API两站六协议行准确绑定站点key、Chat/Responses Bearer、Messages `x-api-key`、Bearer models目录、默认payg与可选TPM/模型单元funding。个人Token Plan使用独立`sk-tp-*`和plan endpoint，当前只表达Chat/Messages且因SayDo不在官方工具范围而保持inventory/rights hard block；企业版专业与轻享使用独立组织principal、key、广州/新加坡plan endpoint和逐地区TCK，不能借普通API的Responses、key或funding结论。OpenCode三产品、Kimi API/Coding Plan/Server-ACP没有共享rights/secret/funding/data closure；Azure Chat与Responses各自覆盖key/Entra user/service principal/managed identity，Vertex ADC/WIF、Bedrock API key/static/role/SSO分别有独立journey，custom三协议、secret-header与mTLS-only也分别实测；
- release verifier按不可降级的81行`REFERENCE_REQUIREMENTS_V3`与`ReferenceGradeProfileV3`逐row核对71条inference、5条execution、4条bridge和1条control plane的entry、protocol/surface、auth、realm、platform、funding、recipe、state和完整run集合；每个requirement的runtime recovery state、准确首步与证据从该row机械派生，不能借用通用场景报告。owner decision与测试evidence保持detached，不能删减minimum后沿用旧designation，也不能用generic protocol报告、另一row、单平台/单locale或`en-XA`替代三个真实用户locale的产品旅程；
- 固定`PublishedProductProtocolClaimSetReceiptV6`与81行逐key精确双射，聚合`PublishedSupportClaimSetReceiptV6`再与全部canonical owner additions逐keyappend-only闭合；所有claim绑定准确wire/auth/live/funding/evidence/distribution。官网支持页、连接picker、测试矩阵、release note和运行中provider卡片没有独立能力常量，全部消费同一support claim set digest与当前readiness。roadmap/inventory、未列协议、漏owner row、错误realm/edition、CC Switch control/route-pin、手写营销文案或旧distribution claim不能进入发布产物；
- 冷态 Ollama/LM Studio 能在一次知情动作内用禁止下载/外网、全局并发1且可崩溃恢复的preload状态机自举；text-only本机模型可进入plain-dialog conversation ready但绝不暴露tool workflow；loopback cloud/LAN不冒充本机计算；
- custom Base URL对OpenAI Chat、OpenAI Responses、Anthropic Messages分别原生解析，最终method+URL可预览；允许的非秘密常量header经过受限policy和逐项授权，credential/header/query不能绕过broker。workload/static/declarative signer精确签method/path/query/header/body和host time/nonce；DSL越界只进入bundled trusted signer发布链，不升级成持secret的code plugin；
- plugin单实例、publisher与host总预算都来自唯一profile digest，并以固定1小时sliding restart window、并发admission和三平台TCK验证；扩大预算、permission、data scope、signer或sandbox均要求新generation、同意与release evidence；
- 第三方 code plugin/Execution Driver 只有在对应正式 OS 通过 deny-by-default sandbox 与直接 syscall TCK 才能启用 capability 模式，任一平台缺 backend 时保持 inventory；
- 首次引导能按真实 journey tier 自动发现并给出推荐；所有scalar与per-class上限只从versioned journey graph生成的`GaDerivedJourneyUxLimitSetReceiptV5`读取，自动状态无主动作、用户介入态和terminal-start态恰有一个主动作，guided key的`no_account/signed_out`最坏路径如实允许4个SayDo主动作而不是继续显示“最多3步”；费用披露与物理 ledger 一致，`zh-CN/en-US/ar-SA`、独立`en-XA`、RTL、主动配置和被动提示均通过 UX/可访问性验收；
- 现有逐PID JSON child registry与SQLite operation authority已按五态迁移合同完成dual-read、shadow-write、reconcile、dual-write、cutover、kill-point和上一正式版降级；每个operation identity包含process birth/token/epoch/PGID或Job/binary/intent，冲突只quarantine，rollback window关闭前不删旧投影；
- strict合同artifact在锁定TypeScript 5.9.3、零diagnostics、零内外部`any` stub下同时通过手写source、生成source、总source、instantiation、RSS与wall绝对门及签名基线回退门；compiler、argv数组、lockfile、runner、原始extended diagnostics、peak RSS、wall与artifact digest进入release evidence。首次baseline只接受一次性受信genesis authority和零前驱证明；替换必须先有前任passing gate、owner批准和单胜cursor CAS，不能重新bootstrap掩盖退化；
- 81行完整路径由零Internet、零真实账号副作用的deterministic fixture穷举；真实provider只按最小set cover执行bounded live qualification，从非个人账号资产池排他lease并连续两个cycle通过。每个terminal完成资源删除、credential/session撤销、usage/billing hold对账和baseline reset，残留或quarantine未解决即阻断发布；
- 没有把 inventory、rights unknown、单次手工成功或“兼容”营销词写成正式支持；
- 全部门禁、两路独立评审和一次 Codex 对抗评审收口，无未处置 A/B 级问题；任何接受的 B 必须以具名 waiver 降级 maturity，且不得继续宣称 reference-grade/GA；
- release 的二进制、GA matrix、内置 registry、可重放 evidence artifact/projection、受信 TCK report、SDK/TCK tarball、三平台 sandbox/performance 报告、24h soak、SPDX SBOM、SLSA provenance 与 Sigstore 签名形成可离线验证的 digest 闭包；不受信 build 与独立 verifier/signing 的 identity/permission domain 可审计；
- CONTRIBUTING/CODE_OF_CONDUCT/GOVERNANCE/CODEOWNERS、TUF delegation、trusted builder、晋升/交接/sunset/紧急撤销流程已公开并完成演练；
- 每项未交付的 L1/L2 能力在 UI 和文档里如实标注，不用“支持任意服务”掩盖。

在此之前，准确状态只能表述为“方案已形成”或“某阶段实施并检查已跑完，等 owner 验收”，不能表述为这些生态已全部可用。

## 17. 评审历史

v1–v20 共 20 轮「终审 + 回修」的过程记账原为本文档 §17（741 行），
已归档至 [`../review/2026-08-24-ai-supply-review-loop-archive.md`](../review/2026-08-24-ai-supply-review-loop-archive.md)。

对该评审循环本身的路线诊断见
[`../review/2026-08-24-ai-supply-v20-loop-diagnosis.md`](../review/2026-08-24-ai-supply-v20-loop-diagnosis.md):
结论是该循环不收敛；建议停止 v21，先签 §14 十项 owner 决策，再决定合同草案的下沉路径。
