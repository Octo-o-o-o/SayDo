# AI 供给普适接入 v19 生态与体验终审

## 结论

`FAIL`

- A：1
- B：0
- C：0

阻断原因只有一个共同根因：腾讯云当前 Token Plan 个人版被错误地压入普通 TokenHub API 的资金叠加层。该错误同时造成 wire、Key namespace、协议集合、允许用途和额度耗尽行为失真。除这个根因外，本次覆盖的其余九个审查面未发现 A/B/C 级缺口。

## 冻结身份与审查边界

| 项目 | 实测值 | 结论 |
|---|---|---|
| 目标 | `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md` | [ok] |
| 初始 SHA-256 | `f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7` | 与 prompt 一致 |
| 初始行数 | `44,555` | 与 prompt 一致 |
| 初始 bytes | `2,797,930` | 与 prompt 一致 |
| 仓库 HEAD | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` | 与 prompt 一致 |
| 完整读取 | 第 1–44,555 行 | [ok]，不是抽样 |
| 写后目标 SHA-256 | `f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7` | [ok]，目标未漂移 |

本次只读取了指定 prompt、冻结目标和当前官方一手网页；未打开旧 prompt、旧 finding、日志、`history/PROCESS-JOURNAL.md` 或其他审查结论，也未修改冻结目标或其他文件。

## 机械核验

直接从冻结目标的 canonical 常量重算得到：

- `REFERENCE_REQUIREMENT_INPUTS_V3` 恰有 73 个 requirement key；无重复。
- `REFERENCE_EXACT_CONNECTION_ORACLE_V6` 恰有 73 个 key；无重复；与 requirement key 集合双向差集均为空。
- surface 分布为 inference 63、execution 5、bridge 4、control plane 1，总计 73。
- a11y 轴为 3 平台 ×（3 个真实 locale + 1 个 pseudo locale）× 3 presentation × 3 viewport × 3 zoom × 3 modality = 972；`ar-SA` 是真实 RTL，`en-XA` 独立。
- release suite ID 恰有 32 个，加 open/close 两个 preflight 后 BOM 恰有 34 行。

这些结果验证了数量、集合闭包和固定矩阵，没有验证当前生态事实本身；后者见下文的一手资料核验。

## 十轴覆盖矩阵

| 审查轴 | 目标内可判定合同 | 主动反例结果 | 判定 |
|---|---|---|---|
| 1. 中国大陆与全球主流供给 | 73 行 minimum 在目标 34610–34683 逐 product/realm/protocol/auth 分行；中国与全球清单在 42519–42583；Hunyuan 仅迁移 | BigModel Chat/Messages、Kimi Platform/Code、MiniMax 中国/国际、百炼北京/新加坡、TokenHub 两站等不能跨行借 key 或证据；仅腾讯 Token Plan 反例失败 | [fail] A-01 |
| 2. CLI、订阅与 command auth | CLI/订阅清单在 42585–42604；Codex command auth 的 candidate、逐次决定、process lease、send intent、terminal 和 broker receipt 在 41905–42126 | 被动发现未知 command、用户拒绝、超时、刷新、stdout secret 等路径均不会在同意前执行或把 token 落 UI/日志 | [ok] |
| 3. 三核心协议与 custom endpoint | custom app auth 与 transport mTLS 正交合同在 15702–15738；三协议 × 四种 app auth × 两种 transport 验收在 27049–27050；73 个 exact oracle 在 35076–35149 | `/v1` 拼接、Chat/Responses/Messages auth 差异、custom secret header 禁止冒充 Authorization、mTLS 与 app auth 同时存在、SSE terminal 与 model catalog 分离均有可拒绝反例 | [ok] |
| 4. 本地运行时与客户端配置 | 本地/自托管分级在 42606–42618；Ollama、LM Studio、oMLX 是 L0，Jan/llama.cpp/vLLM/SGLang/LocalAI 是 L1，其他长尾诚实降级 | Cherry Studio、Chatbox、LobeChat、Open WebUI、AnythingLLM、Msty 只能经用户显式选择导入非秘密 metadata，不能扫描 secret/history 或冒充 runtime | [ok] |
| 5. bridge/gateway | bridge/client 表在 42620–42634；CC Switch 与 LiteLLM 固定行在 34674–34677；无 authority 的 gateway 保持 L1/L2/inventory | route/funding/failover 透明度不足时不会生成费用或支持声明；CC Switch public Messages proxy 不被虚构为稳定 control API | [ok] |
| 6. UX、MFA、恢复、费用与数据 | provider-first、外部任务、焦点恢复、窄屏、键盘和 ICU/RTL 合同在 42386–42498；状态图和收据在前述 typed contract 中闭合 | 自动步骤没有伪主动作；MFA/SCA 离开后返回、复制粘贴、取消、错误恢复、数据外发确认与费用未知均能停在一个真实用户动作 | [ok] |
| 7. 固定 73 行与支持声明同源 | requirement/oracle 一一对应；支持页、picker、test matrix、release note 只从 claim set 生成的约束在 39391、42517 和 42721 | inventory、另一 realm、另一 protocol、owner 非 namespaced 覆盖和只改表格均不能进入固定 claim set | [ok] |
| 8. 平台、locale、无障碍与真实账户 | canonical 972-cell key map 在 41645–41730；真实账户采用有界 set cover、租约、reset、cleanup 和 quarantine | 缺 cell、重复、跨 distribution 借证据、LTR 冒充 RTL、light 冒充 dark、调用方缩小 expected matrix 均不能通过 | [ok] |
| 9. OSS SDK/TCK 与扩展治理 | SDK/TCK、声明式 pack、代码 plugin、TUF、两个外部 consumer 和公开导出要求在 42636–42678 及 Phase 5/8 | 普通新增 provider 不改 daemon switch；代码 plugin 不能越过 sandbox/permission/performance/secret 边界；撤销与 anti-rollback 可机械判定 | [ok] |
| 10. 方便使用与费用诚实 | 本地优先、provider-first、fallback fence、逐计费单位预算、no-new-spend 和 charge-unknown 合同整体充分 | Kimi Extra Usage、OpenCode Go→Zen、OpenRouter BYOK/shared fallback 均需当前权威状态与明确预算；腾讯 Token Plan 的 wire/overage 错位仍会误导或阻断主路径 | [fail] A-01 |

## 当前官方一手事实核验

核验日期：2026-08-24。以下只列会影响本轮判定的动态事实。

| 事实 | 当前官方证据 | 与目标对账 |
|---|---|---|
| Codex custom provider 公开 `auth.command/args/cwd/refresh_interval_ms/timeout_ms`，`wire_api` 仍只允许 Responses | [OpenAI Codex Configuration Reference](https://developers.openai.com/codex/config-reference/) | 目标的 command-backed auth surface 和 Responses-only 限制准确；额外的零执行/逐次同意是 SayDo 安全策略，不冒充 Codex 默认行为 |
| Kimi Code Extra Usage 只有启用后才在会员额度耗尽时接续，且 monthly cap 可选、未设置时无 cap | [Kimi Code Membership Benefits](https://www.kimi.com/code/docs/en/kimi-code/membership.html) | 目标把 enabled、cap、余额和费用组件分开，准确 |
| Kimi For Coding 的 Codex 接法需要针对 Responses 不兼容问题使用 CC Switch 路由 | [Using Kimi in Codex](https://www.kimi.com/code/docs/en/third-party-tools/codex.html) | 目标没有把 Kimi Chat API 直接冒充 Codex Responses，准确 |
| OpenCode Zen 与 Go 的模型目录逐模型分配 Chat、Responses 或 Messages endpoint；Go 只有用户开启 Use balance 后才在限额后落到 Zen balance | [OpenCode Zen](https://opencode.ai/docs/zen/)、[OpenCode Go](https://opencode.ai/docs/go/) | 三协议分行与 Go/Zen 双费用组件准确 |
| 个人 Gemini CLI Pro/Ultra/free 已在 2026-06-18 转到 Antigravity CLI，Gemini CLI 保留企业/Cloud/API-key 路径 | [Google Gemini CLI 官方公告](https://github.com/google-gemini/gemini-cli/discussions/27274) | 目标把 Gemini API、企业 CLI 与 Antigravity inventory 分开，准确 |
| 未经批准的第三方不得向自己的产品提供 claude.ai 登录或 rate limits，应使用 API key | [Anthropic Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) | 目标没有把 Claude 订阅登录当通用 inference 凭据，准确 |
| OpenRouter PKCE 换回的是用户控制 API key；BYOK 还有独立 upstream key、路由顺序、shared fallback 和费用 | [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth)、[OpenRouter BYOK](https://openrouter.ai/docs/guides/overview/auth/byok) | 目标把 PKCE key、credits、BYOK upstream charge 和 shared capacity 分开，准确 |
| 普通 TokenHub API 的广州/新加坡 origin、站点 key、`GET /v1/models` Bearer 与跨站禁止 | [Tencent TokenHub API 使用说明](https://cloud.tencent.com/document/product/1823/130078) | 普通 TokenHub 六行本身准确 |
| Token Plan 个人版使用独立 `https://api.lkeap.cloud.tencent.com/plan/v3` 与 `/plan/anthropic`，有套餐专用 API Key，只允许列明 AI 工具且禁止自定义应用/backend；额度耗尽不转按量 | [Tencent Token Plan 个人版套餐概览](https://cloud.tencent.com/document/product/1823/130060/)、[Tencent Token Plan 个人版常见问题](https://cloud.tencent.com/document/product/1823/130076) | 与目标冲突，形成 A-01 |

## 主动反例清单

1. Kimi Code 用户已开启 Extra Usage 但未设 cap：目标不会宣称 no-new-spend，且需把 subscription 与 Extra Usage 分组件，反例被拒绝。
2. OpenCode Go 用户额度耗尽、Use balance 关闭：目标 hard stop；开启后也必须新建 Zen payg funding decision，反例被拒绝。
3. Codex 配置含未知 `auth.command`：被动探测只生成 candidate，不执行；没有逐次接受 decision、lease 和 send intent 就不能启动，反例被拒绝。
4. custom Anthropic Messages 同时要求 `x-api-key` 与 mTLS：application auth 与 transport auth 正交组合，不会被简化成 Bearer 或二选一，反例被拒绝。
5. 本机只发现 Cherry Studio 配置：只能展示显式 metadata import 候选，不能读取 secret/history 或发布为 local runtime，反例被拒绝。
6. CC Switch 可代理 Messages 但 route/funding/failover 不透明：只形成 opaque bridge claim，不生成 direct-provider/no-new-spend 结论，反例被拒绝。
7. owner 扩展行试图复用固定 key 或只修改 support page：append-only namespace 与 claim-set 同源门拒绝，反例被拒绝。
8. `en-XA` 被当成真实 RTL，或用 macOS VoiceOver 报告冒充 Linux Orca：972 exact key map 的 locale/platform/screen-reader 键不相等，反例被拒绝。
9. 腾讯 Token Plan 个人版用户粘贴套餐 Key并选择当前套餐：反例未被正确表达，见 A-01。

## Findings

### A-01：腾讯 Token Plan 被错误建模为普通 TokenHub 两站六协议上的 `plan_then_payg` 资金叠加

证据：

- 目标 33032–33114 将 `token_plan_subscription` 挂在普通 TokenHub 广州/新加坡的 Chat、Responses、Messages 六个 requirement 上，并固定普通站点 origin、site key、`/v1/*` 路径。
- 目标 33641–33645、33759–33784 只提供 `tokenhub_plan_then_payg`，且把它注册到两站六行；目标 33837–33841 还要求该分支具有 payg component。
- 目标 42544 明说 Token Plan“不是另一套 wire、provider 或 API 授权”，仍走对应 TokenHub 站点；目标 42932、42980 和 44382 把这一点写成实施及收口门。
- 目标 43772 已知道个人套餐只允许列明 AI 工具并限制自定义应用/backend，却没有让该 rights 事实改变 product/wire/GA 建模。
- 当前腾讯云官方套餐概览明确给出独立 OpenAI Base URL `https://api.lkeap.cloud.tencent.com/plan/v3`、Anthropic Base URL `https://api.lkeap.cloud.tencent.com/plan/anthropic`、套餐 API Key 和受限工具用途；没有普通 TokenHub 两站或 Responses surface。[官方套餐概览](https://cloud.tencent.com/document/product/1823/130060/)
- 当前官方 FAQ 明确说明 Token Plan 是独立订阅计费体系，额度耗尽后调用失败，不会自动转按量付费。[官方 FAQ](https://cloud.tencent.com/document/product/1823/130076)

真实用户反例：一位购买腾讯 Token Plan 个人版的中国用户在 SayDo 里选择该套餐并粘贴套餐 Key。按本文完整实施，系统只有两个结果：其一，把 Key 套到 `tokenhub.tencentmaas.com` 或 `tokenhub-intl.tencentmaas.com` 的普通 `/v1/chat/completions`、`/v1/responses`、`/v1/messages`，连接因 recipient/endpoint/rights 不匹配而失败；其二，为使“Token Plan funding”路径可达而接受它，又会错误展示/授权 `plan_then_payg`，而官方产品在额度耗尽时硬停止，且 SayDo 并非当前列明工具。前者让常见订阅主路径不可完成，后者产生权益和费用误导。

推断说明：官方资料直接证明的是独立 endpoint、Key、协议范围、允许用途和 hard stop；“按当前目标实现将失败或误导”是由目标把该套餐强制投影到普通六行及 `plan_then_payg` 后得出的实现推断。

最小根因修复：

1. 从 `TokenHubRequirementKeyV5` 的普通六行 funding variant registry 中删除个人 Token Plan 和 `tokenhub_plan_then_payg`；TPM 预留/模型单元是否仍可作为普通 API funding overlay，须各自凭当前官方合同独立核实，不能与个人 Token Plan 共用结论。
2. 把 Token Plan 个人版建成独立 product/credential namespace/wire profile：至少分别表达当前官方 OpenAI Chat 与 Anthropic Messages base/path，明确无 Responses，不得复用广州/新加坡普通 TokenHub key 或 models-route 结论。
3. 把当前个人版 exhaustion 固定为 hard stop，删除强制 paid component；通用/Hy 套餐可共享其套餐 Key，但不能据此推导普通 TokenHub payg fallback。
4. rights 默认保持 `forbidden` 或 `unknown`，直到腾讯官方明确把 SayDo 列为允许工具或另有可审计合同。若暂不具备该授权，picker 只能作为不可调用 inventory；若未来要发布支持，则必须按本文 append-only 规则新增逐协议 requirement/oracle/journey/live evidence/claim，而非覆盖原六行。

## 最终计数

- A：1
- B：0
- C：0
- 最终判定：`FAIL`

只有修复 A-01、重新冻结目标并在新的零上下文终审中得到 A=0、B=0，才可转为 `PASS`。
