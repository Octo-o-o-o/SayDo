# AI 供给普适接入 v20 生态与体验终审

## 结论

`FAIL`

- A：1
- B：2
- C：1
- 通过条件：A=0 且 B=0；本轮不满足。

本结论只针对冻结目标 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。本轮没有读取旧 prompt、旧 finding、日志、journal 或其他审查者结论，也没有修改目标文件。

## 冻结身份

| 项目 | prompt 预期 | 审查前实测 | 审查后实测 |
|---|---|---|---|
| SHA-256 | `33afc197085f92355e12272a9c45a49ce4d560715b7b7992759dac8398c83531` | `33afc197085f92355e12272a9c45a49ce4d560715b7b7992759dac8398c83531` | `33afc197085f92355e12272a9c45a49ce4d560715b7b7992759dac8398c83531` |
| 行数 | 48,809 | 48,809 | 48,809 |
| bytes | 3,022,748 | 3,022,748 | 3,022,748 |
| 仓库 HEAD | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` |
| 工作树身份 | 不要求 tracked | `??`，目标为未跟踪文件 | `??`，目标仍为未跟踪文件 |

审查前四项与 prompt 完全一致，因此没有因身份漂移中止。

## 全量审查方法与机械读回

本轮完整读取 48,809 行目标，并以结构化遍历覆盖全部正文、表格和 16 个 TypeScript 合同块，不以摘要或抽样替代全量审查。

- 16 个 `ts` 块按文档约定精确抽取后为 45,728 个 split line、2,282,249 bytes，SHA-256 为 `234c5ff9a0c68d691eb7547a611e2604d45930ccbaa54a4d8a93874fb810be4e`，与目标第 48,805 行自述一致。
- TypeScript 5.9.3、ES2023/NodeNext、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`skipLibCheck=true`、零 stub 编译结果为 0 diagnostics；类型数 489,891，instantiations 809,365，与目标冻结证据一致。
- AST 全量遍历 206,563 个节点、24,806 个 property signature：可写 property 为 0，`any` keyword 为 0，非 computed 的必填 `never` 为 0，`@ts-expect-error` 为 0，parse diagnostics 为 0。
- Markdown 全量结构检查：62 个 fence 且平衡，806 个表格行，表头列数错误 0，尾随空白 0，重复 heading label 0。
- `REFERENCE_REQUIREMENT_INPUTS_V3` 全量解析为 81 个唯一 requirement key、61 个 entry、49 个 product；`REFERENCE_EXACT_CONNECTION_ORACLE_V6` 也恰为 81 个唯一 key，缺项 0、额外项 0、重复项 0。
- 81 行 surface 分布独立重算为 inference 71、execution 5、bridge 4、control plane 1；realm 分布为中国大陆 19、global 43、local 19。
- 官方证据基线 §15 的 132 个 Markdown 直链逐一发起当前访问：131 个请求干净返回 HTTP 200；OpenAI Responses 页面也已返回 HTTP 200，但客户端下载在 25 秒上限后退出。链接可达不替代下文的语义核验。

## 覆盖矩阵

| prompt 维度 | 全量检查结果 | 结论 |
|---|---|---|
| 1. 中国大陆与全球主流产品、edition、realm、协议、key namespace | 81 行和 81 个 exact oracle 已逐行核对；OpenAI、Anthropic、Google、Azure、AWS、OpenRouter、BigModel、Kimi、OpenCode、MiniMax、百炼、DeepSeek、BytePlus、TokenHub、百度、SiliconFlow均有明确分支。Tencent Cloud 中国站产品被错误泛化成全球产品，漏掉当前 International 产品/endpoint namespace，见 A-01。 | `[fail]` |
| 2. CLI、订阅、allowlist、费用与权益 | Codex/Claude/Gemini/Antigravity/Kimi/OpenCode/Cursor/Grok/Qwen/Copilot均区分 installed/authenticated/entitled/conformant；个人 Tencent Token Plan 在 SayDo 未列入时 hard block，企业广州/新加坡 Chat/Messages四行使用中国站当前准确端点。Kimi 的用户可见 surface 名称仍混合 Server/ACP，见 C-01。 | `[warn]` |
| 3. Chat、Responses、Messages、Azure 与 custom wire | 第 35,488–35,552 行逐协议冻结 method/origin/path/model/auth；第 27,500–27,504 行明确 RFC 3986 directory resolution、`api_root/version_root`、public/secret header、mTLS 与 unknown metering；第 43,637–43,684 行保留 stream/error/tool 语义且禁止协议猜测。未发现 A/B。 | `[ok]` |
| 4. 本地模型与 local/LAN/cloud | 第 43,746–43,775、46,808–46,820 行逐项覆盖 Ollama、LM Studio、oMLX、llama.cpp、llamafile、vLLM、SGLang、LocalAI、Jan、Xinference、TGI、GPT4All 等；客户端配置只能作为显式候选；loopback 不冒充本机计算。未发现 A/B。 | `[ok]` |
| 5. bridge/gateway 透明度 | 第 43,777–43,786、46,822–46,836 行区分 CC Switch Desktop、CLI fork、LiteLLM、One/New API、Portkey、Vercel、Helicone及企业网关；route/funding/data 无公开 authority 时降级为 opaque/unknown 且不进自动推荐。未发现 A/B。 | `[ok]` |
| 6. 首启、恢复、MFA、外部任务与单主动作 | 自动发现的零执行、零 secret、零远端主动探测、预算、取消和 LAN opt-in 合同完整；19 态 registry 为 5 automatic、12 user-required、2 terminal-start，automatic 主动作数为 0。但 UX hard limit 有两套互相冲突的真相，且 generic state 的静态文案/动作被具体 provider 名污染，见 B-01、B-02。 | `[fail]` |
| 7. 固定 minimum、分级、append-only 与支持材料同源 | 81 行、71/5/4/1、L0/L1/L2、owner append-only、claim set 与四件套闭包均可机械判定；inventory、migration-only、客户端配置和跨 realm/protocol 均有拒绝路径。A-01 会使 Tencent 的一部分“global”公开 claim 成为假阳性。 | `[fail]` |
| 8. 平台、locale、RTL、a11y 与真实旅程 | 3 平台、3 真实 locale、1 pseudo locale、3 presentation、3 viewport、3 zoom、3 modality及每平台 screen reader机械展开为 972 个唯一 cell；fresh/migration/absence、账户起点与 live set-cover分层明确。未发现 A/B。 | `[ok]` |
| 9. 开源贡献、SDK/TCK、pack/plugin 与扩展成本 | 第 46,866–46,879 行把变化限定为 Protocol Profile、Product Pack、Detector、Execution Driver；声明式包与代码插件、TUF、sandbox、撤销、预算和 fresh-consumer 均有门。81 行与 oracle 可直接生成大部分 preset/support claim，但 B-02 的文案绑定仍要求修复。 | `[warn]` |
| 10. 便利性与诚实性、fallback/evaluator/no-new-spend | rights、费用、数据、family、route、region 任一漂移均需新 receipt；unknown metering、opaque bridge、BYOK及订阅 overage不进入自动 fallback/evaluator/no-new-spend。本地 ready 为零动作、常见 preset 有明确旅程。B-01 使“实际外部负担”验收不可信。 | `[fail]` |

## 当前官方一手事实核验

以下事实均在 2026-08-24 从当前官方页面核验；没有使用二手报道。

| 事实 | 当前一手来源 | 与目标的关系 |
|---|---|---|
| Tencent Cloud 中国站产品 1823 的广州/新加坡端点分别为 `tokenhub.tencentmaas.com`、`tokenhub-intl.tencentmaas.com`，且不允许跨站点 | [中国站 TokenHub API 使用说明](https://cloud.tencent.com/document/product/1823/130078) | 目标第 35,518–35,527 行对这个产品本身是准确的。 |
| Tencent Cloud International 产品 1300 使用另一组 `tencentcloudmaas.com` endpoint，并同时列出新加坡、广州、Silicon Valley | [International API Usage Instructions](https://intl.cloud.tencent.com/document/product/1300/78941?lang=en) | 目标完全没有 `tencentcloudmaas`、`intl.cloud.tencent.com` 或 product 1300，不能把产品 1823 的新加坡资源调度范围泛化成 International 产品覆盖。 |
| International Enterprise Token Plan 同样使用 `tokenhub[-intl].tencentcloudmaas.com/plan/...` | [International Enterprise Pro Plan](https://intl.cloud.tencent.com/document/product/1300/81489) 与 [International Enterprise Quick Start](https://intl.cloud.tencent.com/document/product/1300/81491) | 目标四条 enterprise row 只覆盖 `tencentmaas.com` 这套产品域。 |
| 中国站个人 Token Plan 使用独立 key/plan endpoint且限制工具范围 | [中国站个人 Token Plan](https://cloud.tencent.com/document/product/1823/130060/) | 目标第 46,745 行在 SayDo 未列入时不读 key、不调用，处理正确。 |
| OpenCode Server 当前默认 4096、可选 Basic auth，发送消息为 `POST /session/:id/message`；Go/Zen按模型分 Chat/Responses/Messages | [OpenCode Server](https://opencode.ai/docs/server/)、[OpenCode Go](https://opencode.ai/docs/go/)、[OpenCode Zen](https://opencode.ai/docs/zen/) | 目标 exact oracle 与产品分离正确。 |
| Kimi 当前 ACP 是 `kimi acp` 的 stdio JSON-RPC；本地 HTTP/WS server 是独立的 `kimi web`；`kimi server` 已弃用 | [Kimi ACP](https://www.kimi.com/code/docs/en/kimi-code-cli/reference/kimi-acp)、[Kimi command](https://www.kimi.com/code/docs/en/kimi-code-cli/reference/kimi-command)、[Kimi local server](https://www.kimi.com/code/docs/en/kimi-code-cli/guides/server.html) | 目标机器 wire 写的是 `acp_stdio`，但 product/entry/用户文案仍写 Server/ACP，见 C-01。 |
| MiniMax Token Plan当前公开 OpenAI 与 Anthropic 两套入口；LM Studio、Ollama当前公开的本地协议与目标一致 | [MiniMax Other Tools](https://platform.minimax.io/docs/token-plan/other-tools)、[LM Studio Anthropic compatibility](https://lmstudio.ai/docs/developer/anthropic-compat)、[Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility) | 目标只把已完成独立 row/TCK 的协议列入 claim，并把其他协议留作后续 row，属于诚实渐进增强，不计缺陷。 |

推断说明：Tencent两套官方页面没有在所核页面中直接写“key namespace彼此独立”。本报告依据不同官方 product ID、控制台/文档域和互不相同的 endpoint catalog，结合目标自身“无权威同一性证明不得跨 product/realm复用credential recipient”的规则，推断它们必须先作为不同 account/control-plane product identity建模；在官方给出可验证的同一性证据前，不能假设key或support claim可互换。

## 主动反例与 findings

### A-01 Tencent “global” row 混淆中国站与 International 产品域，会产生错误 endpoint/credential recipient 和公开支持假阳性

准确位置：

- 第 35,253–35,259 行把 Singapore TokenHub 与企业计划命名为 `global.*`，但没有 account/control-plane product 维度。
- 第 35,521–35,527 行把这些 global row 全部固定到 `tokenhub-intl.tencentmaas.com`。
- 第 46,744、46,746 行向用户描述为“全球独立官方聚合 API preset”和全球企业套餐。
- 第 47,977、47,982–47,983 行只引用中国站 product 1823 的证据。
- 对整个目标执行 `rg "tencentcloudmaas|intl\\.cloud\\.tencent\\.com|product/1300"`，退出码为 1、命中数为 0。

真实用户反例：使用 Tencent Cloud International 控制台、在 Singapore 创建普通 TokenHub key 或 Enterprise Token Plan key 的用户，选择本文承诺的“全球 Tencent Singapore”后，会被 exact oracle 引导到 `tokenhub-intl.tencentmaas.com`；当前 International 官方入口实际是 `tokenhub-intl.tencentcloudmaas.com`。这不是长尾名称缺失，而是同品牌、同地区下两个现行产品入口被合并。最轻是必需主路径失败；更坏的是把 secret 发给错误的 credential recipient，并让支持页对 International 用户显示 L0 假阳性。

最小根因修复：把“账户/控制面产品”加入 product identity、realm 与 credential namespace，而不是只用资源调度地域。现有 product 1823 行应明确命名为中国站控制面的广州/新加坡产品；另为 International product 1300 建准确普通 API 与企业计划行，绑定 `tencentcloudmaas.com`、独立 key namespace、当前 region catalog和官方证据。若 International 不进本次 GA，就必须把它标为 inventory，并撤掉现有行的泛化“全球 Tencent”文案。增加两产品 endpoint/key 交叉负例，要求在 secret read/首字节前拒绝。

### B-01 旅程外部任务/MFA hard limit 同时存在两套不相容的机器真相

准确位置：

- 第 30,392–30,399 行允许 `guided_key` 与 `guided_oauth_or_subscription` 的 MFA class 各出现 3 次。
- 第 30,917、30,939、30,961、30,983 行的 scalar `maximumExternalTasks` 分别为 7、7、10、8。
- 第 32,019–32,023 行的 guided-key graph允许账号创建、登录、billing、credential creation各自携带条件式 MFA。
- 第 45,941–45,950 行明确推导 guided key/OAuth 最坏 MFA 为 3，并宣称展示的 scalar/per-class limit与推导结果相等。
- 第 47,706–47,709 行“验收总表”却把 guided OAuth/key、enterprise、custom的外部任务 hard limit分别写成 4、4、5、4；OAuth还要求逐 class 不超过 1，并称其中包含条件式 MFA。

真实用户反例：fresh guided-key 用户经历账号创建、billing activation、credential creation，三步各触发一次 MFA。按 versioned graph 与 class/scalar type，这是 6 个外部任务且仍在签名上限内；按验收总表，超过 4 就必须降为 `advanced`。同一 event log会被一个 gate判 pass、另一个 gate判 fail，支持页的剩余步骤、dogfood报告和GA资格无法同源。

最小根因修复：只保留一份 literal limit SoT，并从完整 graph fold生成 scalar、per-class、用户披露、GA表和测试断言。产品若坚持“最多4个”，就收紧 graph/class上限并把额外挑战路径机械降为 `advanced`；若接受最坏7/10/8，则同步修改用户承诺和资格分级。不得保留手写第二张表。

### B-02 全局 generic state 的唯一静态文案/动作被 Kimi、Codex、Ollama 产品名污染

准确位置：

- 第 44,260 行声称状态、动作、ICU 文案、journey event、DOM与a11y只有一份 typed registry 真相。
- 第 44,439–44,441 行的 `action_required.login/key/start_local` 只有 generic state ID和静态 message/action key，没有 requirement/product 参数或 typed message-argument schema。
- 第 46,658–46,661 行由这份 registry生成的唯一文案却分别固定为“检测到 Codex”“Kimi 会员 API”“检测到 Ollama”。
- 固定 minimum实际包含 44 个 `guided_key` journey与多个非 Ollama 本地 runtime；例如 OpenAI Responses第 35,209 行也是 `guided_key`。

真实用户反例：OpenAI Responses用户缺 API key 时，唯一 `action_required.key` 的合同文案是“Kimi会员API还需要填一次Key”，主动作是“连接Kimi”；LM Studio或oMLX未运行时，唯一 `action_required.start_local` 文案称检测到 Ollama。若实现者改成临时字符串绕过，则又违反 typed ICU、三语言对等和“唯一 truth”的发布门。

最小根因修复：让 state projection携带由准确 requirement row与onboarding recipe生成的 `productDisplayName`、目标 journey/action及typed ICU arguments；或机械生成 product-scoped state variant。message key、参数schema、action destination、DOM/a11y snapshot与三真实locale必须从同一 row展开，并对81行的每个相关runtime state做错品牌/错realm负例。

### C-01 Kimi 当前 ACP 与 Server 的名称仍混在一个支持身份中

准确位置：第 35,275、35,541、43,718、46,726 行。机器 wire明确为 `acp_stdio`，但 requirement key、product ID和用户表写成 `Kimi Code Server/ACP`。

真实用户反例：用户按“Server/ACP”寻找或启动 Server，当前 `kimi server` 已弃用；现行 ACP入口是 `kimi acp`，现行 HTTP/WS server则由 `kimi web`启动且是另一个实验性surface。机器协议正确，因此本项不单独阻断；但名称会增加首用和维护歧义。

最小根因修复：把当前固定行重命名为“Kimi Code CLI ACP”，锁定受信 binary + argv `kimi acp`与官方 ACP证据；若未来支持 `kimi web`，另建 `agent_http` product/surface row、Bearer/peer/origin/path oracle与独立TCK，不能沿用ACP claim。

## 未形成 finding 的重点反例

- Tencent个人 Token Plan：目标明确将独立 `sk-tp-*`、plan endpoint、工具allowlist与普通TokenHub/企业版分离；SayDo未列入时零 secret、零调用，未发现绕行。
- custom Base URL：leading slash、dot segment、encoded separator、query/fragment、版本段猜测、public/secret header冲突、mTLS与应用认证混装均有拒绝路径；unknown metering逐物理调用确认。
- 本地常见端口抢占、loopback云转发、LM Link/LAN、Ollama cloud alias、冷态预加载、下载与外联均不会自动升级为本机数据承诺。
- CC Switch公开代理没有route/funding authority时固定 opaque且禁止自动推荐/fallback/evaluator/no-new-spend；CLI fork能力不外推桌面版。
- inventory、roadmap、migration-only及owner追加行不能仅凭品牌表进入81行 claim set；支持页、picker、test matrix、release note绑定同一claim digest。
- 972格a11y矩阵不是用`en-XA`冒充真实locale；`ar-SA`为真实RTL，三平台screen reader各自固定。

## 精确计数与最终判定

| 严重度 | 数量 | finding |
|---|---:|---|
| A | 1 | A-01 |
| B | 2 | B-01、B-02 |
| C | 1 | C-01 |

最终判定：`FAIL`。A-01会造成主流现行产品的错误接入路径与公开支持假阳性；B-01、B-02分别破坏可执行UX验收和普通用户首用文案。三项A/B关闭前不能给出生态与体验终审通过结论。

## 审查后目标未漂移

报告初稿落盘后重新执行目标 SHA-256、`wc -l -c`、HEAD 与目标 pathspec 状态检查；结果仍为 `33afc197085f92355e12272a9c45a49ce4d560715b7b7992759dac8398c83531`、48,809 行、3,022,748 bytes、HEAD `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`、目标状态 `??`。与审查前及 prompt 四项身份完全一致，目标未漂移。
