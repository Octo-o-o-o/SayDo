# AI 供给生态与零配置体验终审 v13

## 1. 结论

`FAIL`

- A：1
- B：2
- C：1
- 判定规则：A、B 任一非零即不得 `PASS`。

冻结方案的覆盖广度、权限边界、运行时状态和扩展合同已经相当完整，但当前冻结字节仍有三项阻断开箱目标的问题：机器真相中的正式 provider 认证与发布层级不真实；腾讯当前 TokenHub 通用 API surface 没有进入产品/realm/protocol 真相；UX 的“自动态零主动作”与状态表、零动作本地 journey 互相冲突。

## 2. 冻结身份核对

目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

| 项目 | 期望 | 实测 | 判定 |
|---|---|---|---|
| SHA-256 | `ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743` | `ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743` | `[ok]` |
| 行数 | `28097` | `28097` | `[ok]` |
| bytes | `1679137` | `1679137` | `[ok]` |

核对命令与原始结果：

```text
$ shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

$ wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
   28097 1679137 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

冻结身份通过，因此继续终审。终审过程中未修改目标、canonical 或生产代码。

## 3. 审计边界与方法

- 只读冻结目标、当前生产源码和 canonical 约束；没有读取旧评审报告、过程日志或其他旧 prompt 内容。
- 易变产品事实只采用官方产品文档：Google Gemini API、Microsoft Azure OpenAI Responses、腾讯云 TokenHub。
- 对机器真相采用准确字段和行锚点审计，不以品牌行或营销名称代替可执行支持。
- 对“无此项”结论采用全文检索，而非抽样；对 63 行固定 requirements 采用闭区间 `23759..23821` 的实际计数。
- 本轮是冻结方案终审，不是实施验收；没有据方案中的自报门禁结果宣称生产测试通过。

## 4. 当前实现事实回读

冻结方案对当前实现债务的主要描述与源码一致：

1. `packages/contracts/src/types/modelbinding.ts:9-18` 的 `WIRED_CLI_PROVIDERS` 恰为 Codex、Claude、Cursor、Grok、Gemini、Qwen、Copilot 七个；Kimi 与 OpenCode 没有被冒充为 wired。
2. `packages/daemon/src/config/cliCapability.ts:179-199` 中 Kimi、OpenCode 的 `provider` 都是 `null`，仍为 inventory-only；方案要求后续通过受约束 Execution surface 激活，而不是拿任意 stdout 或登录态当权益。
3. `packages/daemon/src/providers/openaiCompat.ts:101-116` 当前只组装 `chat/completions`，并固定 `Authorization: Bearer`；生产尚无独立 OpenAI Responses、Anthropic Messages、Google GenAI 等原生发送路径。
4. `packages/console/src/components/SetupWizard.tsx:1073-1085` 当前 API 表单要求用户填写 Base URL、API key、model；`packages/console/src/components/SupplyPicker.tsx:272-278` 对外仍写“任意兼容 OpenAI 协议的端点”。
5. `packages/console/src/lib/setupApi.ts:1334-1343` 把未知 endpoint 的 key 借存到 `OPENROUTER_API_KEY`；`packages/console/src/lib/resourcePlans.ts:625-638` 和 `SetupWizard.tsx:1434-1442` 把四个推理槽统一指向同一 API。

这些事实说明冻结方案确实在解决真实实现缺口；本报告没有把“方案已写到”误判为“生产已具备”。

## 5. 八项覆盖判定

| 审计维度 | 判定 | 说明 |
|---|---|---|
| 1. 当前实现事实 | `[ok]` | 七个 wired CLI、Kimi/OpenCode inventory-only、自定义 Base URL 与单 Chat/Bearer 实现均与源码一致。 |
| 2. 中国大陆与全球产品 | `[fail]` | 大部分 API/gateway/订阅/realm 已拆分，但当前 TokenHub 通用 API surface 缺失，且固定 provider 认证字段有错误。 |
| 3. CLI 与 Agent | `[ok]` | Codex App Server、通用 stdio、ACP/HTTP 与各 CLI 的 discovery、rights、Execution、activation 边界清楚；未将 IDE credential 或 stdout 当嵌入权益。 |
| 4. 本地与自托管 | `[ok]` | Ollama、LM Studio、oMLX、llama.cpp、vLLM、SGLang、LocalAI、Jan、Xinference/TGI/MLX-LM、Docker、Podman 等按 L0/L1/L2 与 ready/recovery/cloud/LAN 分开；无假 key、静默下载或静默转云合同。 |
| 5. bridge/开源工具 | `[ok]` | CC Switch、LiteLLM、One API/New API、企业 gateway、OpenCode Server/ACP、Router 类工具均要求 route/failover/secret/rights 和可执行边界，不是 logo wall。 |
| 6. 自动探测与 UX | `[fail]` | 状态到主动作表与自动推进不变量、local zero-action 目标不能同时满足，见 B-2。 |
| 7. 扩展与长期维护 | `[ok]` | provider pack、protocol/auth profile、detector、Execution driver 和 owner namespaced requirement addition 的扩展面完整；支持页、picker、测试矩阵、release note 被要求同源生成。 |
| 8. L0/L1/L2/inventory 诚实边界 | `[fail]` | 总体 rights/owner 门设计保守，但 Gemini/Azure 的固定机器行与正文 L1 定义相冲突，机器产物会显示错误层级，见 A-1。 |

## 6. 发现

### A-1 固定机器真相会为 Gemini/Azure 生成错误认证和错误发布层级

级别：A

#### 准确锚点

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:242-267`：`ApplicationAuth` 把 `bearer`、`x_api_key` 与可具名的 `registry_header` 分成不同种类。
- 同文件 `:23761`：`google.genai.key` 被固定为 `authKind: "bearer"`、`ecosystemTier: "L0"`、`releaseMaturity: "builtin_stable"`。
- 同文件 `:23764`：`azure.key` 被固定为 `authKind: "x_api_key"`、`ecosystemTier: "L0"`、`releaseMaturity: "builtin_stable"`。
- 同文件 `:26090-26092` 与 `:26433,26446`：正文两处都把 Gemini API 与 Azure OpenAI/Microsoft Foundry 定为 L1。
- 同文件 `:26043-26044`、`:26586`：支持页、picker、测试矩阵和 release note 要从固定 requirements 机器真相生成；L0 又进入不可降级 mandatory baseline。因此不能把错误字段当成无害注释。

#### 官方事实

- [Gemini API reference](https://ai.google.dev/api) 明确要求每个请求携带 `x-goog-api-key`；它不是 `Authorization: Bearer`。
- [Gemini API key guide](https://ai.google.dev/gemini-api/docs/api-key) 进一步区分 standard key 与绑定 service account 的 authorization key；新 key 已默认是 authorization key，2026 年 9 月将拒绝 standard key。冻结方案只写通用 `guided_key` 和 `warm`，没有把临近迁移状态、key type、project/principal 变成该固定行的可验事实。
- [Azure OpenAI Responses API](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses) 的 REST API-key 示例使用 `api-key`，Entra 才使用 `Authorization: Bearer`。目标中的 `x_api_key` 在同一文档其他位置明确承载 Anthropic `x-api-key` 语义，不能代表 Azure 的 `api-key`。

#### 用户反例

普通用户在 Google AI Studio 创建当前默认 authorization key，选择文档宣称的 Gemini preset。机器行要求 Bearer，wire adapter 因而发送错误 header，用户只会得到 401，却看到 L0/builtin-stable 的正式支持标记。Azure 用户粘贴 resource API key 时，同理会收到错误的 `x-api-key` header；若实现者为了“兼容”把两种 header 都发出，还会扩大 secret 暴露面。即使 adapter 被人工特判，support/picker 仍会从固定行把两个正文 L1 产品发布成 L0，形成虚假支持。

#### 根因

固定 requirement 只冻结了过粗且部分错误的 `authKind`，没有冻结 provider/operation 对应的准确 credential component/profile；同时 tier 仍在 fixed tuple 与叙述表中维护两份真相。现有编译期断言只证明 literal 非空和形状成立，不能证明 header、key lifecycle 与生态层级符合官方事实。

#### 根因级修复

1. 将固定 requirement 的认证字段改为可解析到准确 wire component 的 `authProfileId` 或等价强类型引用；profile 必须固定 header 名、secret placement、适用 endpoint/operation、principal/project/resource 约束和禁发 header 集合。
2. Gemini API key profile 只注入 `x-goog-api-key`，并建模 standard/auth key 类型与 2026 年 9 月迁移/阻断状态；authorization key 的 service-account principal 和 Cloud project 进入 subject/rights/billing closure。
3. Azure API-key profile 只注入 `api-key`；Entra profile 单独注入 Bearer，二者不能共享 credential receipt 或互借通过报告。
4. 删除手写 tier 副本：Gemini、Azure 的页面、Phase、matrix、baseline 和 release artifacts 都从同一 requirement tier 派生。按当前正文意图应为 L1；若 owner 决定升为 L0，必须显式改唯一真相并补齐 L0 gate，不能由字面误写静默升级。

#### 验收方式

- 编译期断言逐 key 固定 `google.genai.key -> google_x_goog_api_key_v1`、`azure.key -> azure_api_key_header_v1`，并证明两者 tier 与生成页面完全同值。
- wire TCK 检查 Gemini 只出现 `x-goog-api-key`，Azure key 只出现 `api-key`，Azure Entra 只出现 `Authorization: Bearer`；其他三个敏感 header 在各自请求中必须为零，redirect/proxy/log 也不得出现 secret。
- 使用官方正向 fixture 和错 header 负向 fixture，覆盖 REST、streaming、retry/fallback 的每个 physical attempt，而不是只测 SDK 配置对象。
- Gemini journey 覆盖当前 authorization key、受限 standard key、unrestricted/blocked key、迁移前后时钟边界和错误 project/principal；Azure 覆盖 key、Entra user、service principal、managed identity 且报告不可互借。
- 生成 support page、picker、测试矩阵、release note 后，逐 artifact 断言 Gemini/Azure 的 tier、auth 文案、header profile 与 requirement digest 一致。

### B-1 腾讯当前 TokenHub 通用 API surface 未进入产品、realm 与协议机器真相

级别：B

#### 准确锚点

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:23796` 的固定行仍是 `cn.tencent-hunyuan.api`、单一 OpenAI Chat、旧式签名 journey、L1。
- 同文件 `:26409-26411` 只列“腾讯混元普通 API”、受限的 TokenHub 个人套餐及合同未知的团队/企业套餐。
- 同文件 `:27524-27525` 只引用旧混元兼容页与个人 Token Plan 权限页。
- 对冻结全文检索后，没有当前 TokenHub 广州/新加坡通用 API endpoint、三协议、逐协议认证或 `/v1/models` 状态的 product/realm/requirement 行。

#### 官方事实

- [腾讯云 TokenHub API 使用说明](https://cloud.tencent.com/document/product/1823/130078)（页面标注 2026-08-22 更新）给出两个互不跨站调用的 endpoint：广州 `https://tokenhub.tencentmaas.com` 对应中国大陆，新加坡 `https://tokenhub-intl.tencentmaas.com` 对应全球；API key 使用 Bearer，并可通过 `GET /v1/models` 获得 `online`、`pre-offline` 等状态。
- [腾讯云 TokenHub 语言模型调用概览](https://cloud.tencent.com/document/product/1823/130079) 给出 `/v1/chat/completions`、`/v1/responses`、`/v1/messages` 三个 surface；OpenAI Chat/Responses 使用 Bearer，Messages 使用 `x-api-key`；广州和新加坡 key 不互通，未开通模型或额度不足返回 402，流式错误可能出现在 SSE 中间帧。

这些页面证明“当前 TokenHub 通用 API”是独立且会改变 realm、protocol、auth、模型目录和错误恢复的主流架构类别。它不等于个人 Token Plan，也不能被旧混元单 Chat 行代表。官方调用文档本身不足以替代 SayDo 分发用途的 rights 与具体 funding 结论；这两项仍须按产品/edition 获取权威证据。

#### 用户反例

用户刚在 TokenHub 广州站开通模型并创建 API key。本方案只给他旧“混元普通 API”签名 preset，或把他归到“个人套餐 forbidden”。前者 endpoint/auth/protocol 都不匹配，后者混淆了通用 API 与套餐权益；改填新加坡 endpoint 又会因 key 不互通得到 401002。即使走 custom endpoint，用户还要手填本可由 preset 决定的 Base URL、协议和模型，且 402、`pre-offline`、SSE 中途错误没有产品处方，违背少配置目标。

#### 根因

生态枚举停留在旧混元 API 与 Token Plan edition 的二分，缺少“平台通用 API product + 两个站点 realm + 三个 protocol surface”的独立轴；迁移被写成展示文案，没有变成旧 entry 到新 product 的可执行状态机。

#### 根因级修复

1. 新增 TokenHub 通用 API product pack，并把广州中国大陆与新加坡全球建成两个不可互借 key/endpoint/billing/data receipt 的 realm；不要与个人、团队、企业 Token Plan 合并。
2. 为每个允许发布的 realm 分别建立 Chat、Responses、Messages requirement，绑定准确 auth profile、relative path、model catalog/status、SSE error parser 与 401002/402/429 处方。
3. 以官方条款或合同证据决定每个 edition 对 SayDo 的 rights 与 funding tier；证据不足时保持 inventory/unknown、不收 key、不推荐。不能从“文档能调用”外推第三方应用分发授权，也不能从个人套餐限制外推通用 API 一律 forbidden。
4. 将旧 `cn.tencent-hunyuan.api` 标注为 existing-only、deprecated 或 migration source，以官方当前迁移事实决定；新用户默认走当前 product，旧用户获得可恢复、可回退且不泄露 key 的迁移 journey。

#### 验收方式

- 两个 realm 各跑三协议的正向 TCK；cross-realm key、endpoint、billing receipt、data receipt 置换必须在 secret read/首包前失败。
- `/v1/models` 的 `online`、`pre-offline`、未知状态逐项测试；402 分拆为“模型未开通”与“额度不足”处方，SSE 中途错误不能被记为成功 terminal。
- fresh TokenHub 用户、旧混元用户、个人套餐、团队/企业合同未知四类 journey 分开；rights unknown/forbidden 不出现连接按钮，allowed 才进入 key/模型验证。
- support page、picker、测试矩阵与 release note 从新增 requirements 生成，显示准确站点、协议、rights、费用和迁移状态，不再让用户手填 preset 已知的 Base URL/协议。

### B-2 自动推进状态的零主动作合同与 UX 状态表、local zero-action journey 冲突

级别：B

#### 准确锚点

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:26051`：需要用户介入的状态恰有一个 `primaryAction`，自动推进的短暂状态必须是零个；帮助、复制、设置只能是 secondary。
- 同文件 `:26052`：`local_service_ready` 候选自动验证为零动作。
- 同文件 `:26322-26324,26334`：状态表却给 `detecting`、`connected_verified`、`testing` 分配唯一主动作；这些动作分别是看 cache、看进度、取消验证，实质都是可选控制而非推进所必需的用户决定。
- 同文件 `:26323`：所有 `candidate` 又统一要求 `review_candidate`，没有表达 ready local 的 automatic candidate 分支。
- 同文件 `:27256`：运行中的 local candidate 到 `conversation_ready` 必须零个主动作，passive/validation 必须 automatic。
- 同文件 `:27342`：release TCK 要求 automatic step 没有 `primaryActionId` 和点击事件。因此当前两个合同无法由同一个 reducer 和 DOM 同时满足。

#### 用户反例

用户机器上已有运行中的 Ollama 和可用模型。检测开始时页面出现“先看已有结果”主按钮；候选出现后又有“查看并验证”；验证时再有“取消验证”。若测试按状态表记录这些主按钮，zero-action journey 和 automatic-step TCK 失败；若实现为了通过零动作而不渲染它们，又违反状态表的“唯一 primaryAction”。同样，screen reader 会把可选的“取消/查看进度”宣读成完成任务的首要操作，误导用户以为必须点击。

#### 根因

`status` 同时承担了生命周期阶段、是否需用户决策和可选控制三个正交概念。状态表把“存在一个有用按钮”误当成“该状态需要用户介入”，又用未细分的 `candidate` 同时承载安全自动验证与必须人工确认的候选。

#### 根因级修复

1. 建立唯一的 discriminated view-state/action reducer，显式携带 `transitionMode: "automatic" | "user_required" | "terminal_start"`，或拆分 `candidate_safe_auto` 与 `candidate_requires_review`。
2. `detecting`、安全 local candidate、`testing`、等待整套方案的 `connected_verified` 在 automatic 分支中必须没有 primary action；“先看 cache”“取消验证”“查看进度”建模为 typed optional control/secondary link，不得计入主动作或 journey click。
3. 只有真正阻断推进的 login、key、start service、inspect containers、rights/custom consent、spend consent、staged failure 等状态恰有一个主动作；`conversation_ready`/`review_ready` 的 start action 则属于明确 terminal-start 类。
4. 状态文案、ICU schema、journey graph、action reducer、DOM/a11y snapshot 与计数器从同一 typed state definition 生成，删除手写表与图之间的双真相。

#### 验收方式

- 对 reducer 做穷举测试：每个 reachable state/transition mode 的 primary action 数只能是 0 或 1；automatic 必须 0，user-required 必须 1，任何按钮不得同时出现在 primary 与 secondary。
- macOS/Windows/Linux 上从运行中的 Ollama、LM Studio、oMLX ready 状态执行完整 journey，到 `conversation_ready` 的 `primaryActionId` 和用户点击事件都为零；passive discovery、staged/live validation、activation commit 仍有完整 receipt。
- 分别测试 stopped/no-model/cold/port-conflict/API-off，只进入准确处方态且恰有一个主动作，不能先生成 zero-config pass。
- Playwright 与 screen-reader snapshot 覆盖 `zh-CN`、`en-US`、`en-XA`、窄屏和 200% 字号；检测/测试中的可选取消或查看动作不得被宣读为继续任务所必需的 primary。

### C-1 v11 回修表仍写 61 行，与 v13 的 63 行机器真相不一致

级别：C

#### 准确锚点

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:23759-23821`：固定 tuple 实际是 63 行。
- 同文件 `:26043,26586,26616,27342`：当前有效合同与门禁均写 63 行。
- 同文件 `:28034`：历史回修表仍写“建立61行 `REFERENCE_REQUIREMENTS_V3`”。
- 同文件 `:28089,28095,28097`：后续 v13 段落又说明已经从 61 增为 63，并给出 63 行自审结果。

#### 用户反例

实施者从收尾回修表建立验收清单时按 61 行准备 fixtures，而 gate 与固定 tuple 要求 63 行；结果不是末尾才发现漏两个，就是误以为正文自审相互矛盾。当前机器合同仍明确为 63，因此它不直接阻断运行路径，定为 C。

#### 根因

历史问题表保留了前一轮数字，但没有标注“当时 61、v13 后续增为 63”的时态或 supersede 关系；行数仍被多处手写。

#### 根因级修复

把 `:28034` 改成“当时建立 61 行，v13 已按 `:28089` 增至 63 行”，或直接引用机器计算的当前 count；评审历史保留时必须显式标注旧值而不是写成现状。

#### 验收方式

- CI 从 literal tuple 计算 count，并校验所有声称“当前行数”的文案只引用生成值。
- 文档全文检索 `61行` 后，只允许带明确历史时态和指向 63 行 supersession 的语句；support/release artifacts 只消费 derivation receipt 的 count。

## 7. 未列为发现的关键闭包

为避免把“尚未施工”误报成“方案缺失”，下列方面已形成足以实施和机械验收的根因级闭包：

- CLI/Agent 没有把发现、登录、rights、Execution readiness、activation 混成一个布尔值；Kimi/OpenCode 当前 inventory 与未来 Server/ACP 路径分开。
- 本地 runtime 覆盖 ready、cold、stopped、no-model、API-off、port conflict、cloud/LAN/unknown；Docker/Podman 主动检查需用户授权，不静默启服务、下模型或转云。
- bridge 把 route、upstream、failover、secret recipient、费用主体、rights 和 drift/revalidation 分开；CC Switch、LiteLLM、One API/New API、企业 gateway 不因发现品牌就自动可信。
- custom endpoint 不再只等于 OpenAI Chat；Chat、Responses、Messages、mTLS、secret header 均有独立 profile/consent 边界。
- provider pack、protocol/auth profile、detector 与 driver 的扩展点和 owner namespaced requirement addition 能避免日后为每个品牌修改 daemon switch。
- 权益不足或官方证据不明的消费/企业订阅总体保持 `unknown`/inventory，不收 key、不推荐；本报告没有要求把未知 rights 放宽成可用。

## 8. 最终判定

```text
verdict=FAIL
A=1
B=2
C=1
```

阻断项为 A-1、B-1、B-2。修复后必须重新冻结准确字节，并以新的零上下文终审验证 A=0、B=0；不能在原 SHA 上以解释代替回修。
