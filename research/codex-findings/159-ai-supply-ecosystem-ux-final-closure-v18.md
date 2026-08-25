# AI 供给普适接入 v18 生态与体验终审

## 结论

`FAIL`

- A：2
- B：1
- C：0

本轮发现不是“计划尚未施工”：两个 A 都是拟议 TypeScript 合同本身的不可构造路径；即使逐字实施，73 行 requirement 的公开支持证据链也无法完成。B 是终审输入明确要求的第三个真实 locale 缺失。只有修复后重新冻结并取得 A=0、B=0，才可给出 `PASS`。

## 冻结身份与审查边界

| 项目 | 核验结果 |
|---|---|
| 目标 | `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md` |
| SHA-256 | `c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0` |
| 行数 | 42,437 |
| bytes | 2,672,219 |
| 仓库 HEAD | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` |
| 完整读取 | 已读取目标第 1 至 42,437 行 |
| 只读边界 | 除本报告外未修改文件；未读取旧 prompt、旧 finding、history、日志或其他 agent 输出 |

身份在开始审查、落盘报告前及报告落盘后均重新核验；最终复核值见末节。

## 机械清点

从 `REFERENCE_REQUIREMENT_INPUTS_V3` 的 73 个实际对象逐行解析，不依据正文自报数字：

| 维度 | 实际分布 |
|---|---|
| 总数 | 73 |
| surface | inference 63；execution 5；bridge 4；control plane 1 |
| realm | global 37；china_mainland 17；local 19 |
| tier | L0 46；L1 19；L2 8 |
| maturity | builtin_stable 59；builtin_beta 13；community_verified 1 |
| protocol | Chat 32；Responses 16；Messages 12；Google GenAI 3；Bedrock Converse 4；Execution 5；control 1 |
| journey | guided_key 40；enterprise_managed 10；guided_oauth 3；migration_only 1；zero_config 14；custom_endpoint 5 |

目标内 11 个 TypeScript fence 使用 TypeScript 5.9.3、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、ES2023/NodeNext、零 stub 做内存语义编译，基线输出为：

```text
{"typescript":"5.9.3","blocks":11,"sourceLines":39475,"diagnostics":0}
```

基线编译只证明声明可被加载，不证明每个关键 producer 的输入可构造。本轮因此对发布链的两个关键 constituent 增加了不写文件的正向可达性探针；两者都暴露出基线未触发的 required-`never`。

## 覆盖矩阵

| 终审范围 | 目标中的可执行落点 | 结论 |
|---|---|---|
| 中国大陆与全球主流供给 | 73 行包含 OpenAI、Anthropic、Google、Azure、AWS、OpenRouter、OpenCode Zen/Go、Z.AI、BigModel、Kimi Platform/Code、DeepSeek、MiniMax、阿里、火山/BytePlus、TokenHub、混元迁移、千帆、SiliconFlow及本地产品；中外 realm 分行 | `[fail]` 清单覆盖充分，但 A-01 使所有行的 completed journey evidence 无法构造，不能形成真实公开支持闭包 |
| CLI、订阅与权益 | §6.2 明确拆分 installed、authenticated、entitled、conformant；Codex 三种 auth/计费路径、Gemini/Antigravity、Claude API 默认、Cursor/Grok/Qwen/Copilot inventory、Kimi Code/API/ACP 分离 | `[ok]` 未发现把安装或登录直接冒充权益、费用覆盖或公开支持的旁路 |
| Chat、Responses、Messages、custom Base URL | RFC 3986 相对解析、`api_root/version_root`、三协议、应用 auth 与 mTLS 正交、header 冲突、redirect、stream terminal、model list 均有 profile/TCK | `[ok]` 未发现协议或认证被一个“compatible”布尔值擦除 |
| 本地 runtime 与 bridge | Ollama、LM Studio、oMLX 为固定行；llama.cpp、vLLM、SGLang、LocalAI、Jan、Xinference、TGI按实际 profile/inventory分层；CC Switch 固定 opaque，LiteLLM三协议固定，其他 gateway 不外推 | `[ok]` loopback 不冒充本机计算，opaque route 不进入推荐、evaluator、fallback或 no-new-spend |
| 首启与恢复 UX | static/passive/explicit-active分层；MFA、外部任务、字段、copy/paste、leave-return、raw/app time进入 graph fold；automatic 无主动作，actionable state 恰一个动态 capability | `[ok]` 未发现多主动作、空目的地或恢复前伪 zero-config 的正文/类型旁路 |
| 73 行 SoT 与四件发布物 | requirement、oracle、claim、support page、picker、test matrix、release note与 distribution 设计为同源精确集合 | `[fail]` A-01/A-02 使必要 evidence/gate 不可达，因此“同源”无法落成可发布 claim set |
| 三平台、locale、无障碍与真实旅程 | macOS arm64、Linux x64、Windows x64；键盘、VoiceOver/NVDA/Orca、viewport、presentation、100/200/400% zoom、双 cycle账号池与 cleanup均有门 | `[fail]` 只有 `zh-CN`、`en-US` 两个真实用户 locale；`en-XA` 被明确标为 pseudo，未满足“三 locale + 伪 locale” |
| 开源扩展与治理 | declarative pack、受限 code plugin、TUF、SDK/TCK、撤销、回滚、owner append-only、fresh-consumer测试及“新增兼容 provider 核心 diff 为零”均有落点 | `[ok]` 未发现 inventory 可晋升 support 或 plugin 可越过 secret/authority 边界的设计旁路 |

## 当前官方一手事实核验

仅核验会影响本轮生态、权益、费用或协议结论的易变事实；以下均为厂商/项目官方页面，访问日为 2026-08-24。

| 事实 | 官方核验 | 对目标的判断 |
|---|---|---|
| Codex 登录与计费边界 | OpenAI 当前把 ChatGPT subscription access 与 API-key usage-based access 分开；Enterprise access token用于受信非交互 Codex 工作流，普通 API 仍用 Platform key。[OpenAI Authentication](https://learn.chatgpt.com/docs/auth) | §6.2 的三路径区分成立 |
| Codex custom provider | `model_providers.<id>.base_url`存在，但 `wire_api`当前唯一值为 `responses`。[OpenAI Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference) | 目标没有把 Codex custom provider 外推为 Chat/Messages |
| Claude 第三方产品登录 | 未经批准，第三方不得向其用户提供 claude.ai 登录或订阅限额，应使用 API-key auth。[Anthropic Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) | Claude 默认 API、订阅条件 gate 的处理成立 |
| Gemini CLI 个人账号迁移 | Google 官方仓库公告确认 2026-06-18 后 Gemini CLI 停止服务 Pro/Ultra/free 个人账号，Enterprise/Cloud/API-key保留。[迁移公告](https://github.com/google-gemini/gemini-cli/discussions/27274)、[切换完成公告](https://github.com/google-gemini/gemini-cli/discussions/28017) | Gemini CLI 与 Antigravity 分 connector 的处理成立 |
| Kimi Code surface 与费用 | Kimi Code 官方给出 OpenAI Base URL `https://api.kimi.com/coding/v1`、Anthropic Base URL `https://api.kimi.com/coding/`，第三方工具需独立 API key；CLI、VS Code和第三方工具共享会员额度，Extra Usage需开启且可设月度 cap。[Kimi Code Overview](https://www.kimi.com/code/docs/en/)、[Membership](https://www.kimi.com/code/docs/en/kimi-code/membership.html) | Kimi Platform、Kimi Code API、CLI/ACP与 Extra Usage 分层成立 |
| OpenCode Go 与 Zen | Go有 5 小时/周/月限额，达到上限后只有用户启用才回落 Zen balance；Zen为按量产品并有 auto-reload与 workspace/member月限额。[OpenCode Go](https://opencode.ai/docs/go/)、[OpenCode Zen](https://opencode.ai/docs/zen/) | Go/Zen/Server三产品与 overage 分支成立 |
| TokenHub 协议与 auth | 官方同时列出 Chat、Responses、Messages；前两者为 Bearer，Messages为 `x-api-key`，广州与新加坡站点分开。[TokenHub 语言模型调用概览](https://cloud.tencent.com/document/product/1823/130079) | 六个站点/协议 requirement 的拆分成立 |
| OpenRouter 浏览器授权 | 官方 PKCE 流把 code换成用户 API key；这不是标准 access/refresh token family。[OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth) | 与手填 key、BYOK、Management API权限分离成立 |
| LM Studio Messages auth | Require Authentication开启时同时接受 `x-api-key`与 Bearer，关闭时 key可省略。[LM Studio Anthropic compatibility](https://lmstudio.ai/docs/developer/anthropic-compat) | 三条可选 auth fixture 与单请求单header要求成立 |
| 混元旧平台迁移 | 腾讯云当前停止新购旧平台服务、存量服务迁向 TokenHub，并公告旧平台后续停服。[混元 OpenAI 兼容页](https://cloud.tencent.com/document/product/1729/111007)、[迁移公告](https://cloud.tencent.com/document/product/1729/131925) | 把 `hunyuan.cn`限制为 existing-connection migration 而非 fresh onboarding 是正确方向 |
| DeepSeek协议面 | 官方当前同时提供 OpenAI 与 Anthropic 格式，Anthropic Base URL为 `https://api.deepseek.com/anthropic`。[DeepSeek Anthropic API](https://api-docs.deepseek.com/guides/anthropic_api) | 固定 minimum 只发布 `deepseek.chat`，正文把 Messages留作未发布能力；未形成 false positive，本轮不计缺陷 |

以上核验没有发现新的事实性 A/B；最终失败来自下述合同可达性与明确验收范围差距。

## 主动反例

| 反例 | 结果 | 依据 |
|---|---|---|
| 把 PATH 中一个已登录 CLI直接当可用订阅供给 | 被拒绝 | §6.2 四级状态、rights/conformance gate及 generic CLI受签 driver要求 |
| 用 Claude consumer订阅给第三方 SayDo 自动供给 | 被拒绝 | Claude API默认、订阅条件 gate及官方限制 |
| 把 Kimi Code会员 key、Kimi Platform payg key和 Kimi ACP登录互借 | 被拒绝 | 独立 product/surface/secret namespace/rights/funding requirement |
| 把 OpenCode Go耗尽后自动扣 Zen | 被拒绝 | funding state明确分 hard stop 与用户预先开启且有预算的 fallback |
| 把 CC Switch loopback当作已知上游、已知费用、可自动 fallback | 被拒绝 | 固定 `route_opaque/failover_opaque/externally_metered_unknown` |
| 用 inventory、另一 realm或另一 protocol报告生成公开支持 | 被拒绝 | 73行 exact oracle、逐row claim、distribution与四件产物精确集合 |
| 为普通 `openai.chat.key`构造 journey evidence producer输入 | 未被合同正确支持 | A-01；index receipt和详细receipt被要求占用同一字段，`receiptKind`化为 `never` |
| 为 `hunyuan.cn`构造 migration-only run gate | 未被合同正确支持 | A-02；迁移 definition只允许 migration readiness，而统一 supply gate强制 conversation readiness |
| 为第三个真实用户 locale生成完整 journey/a11y证据 | 无法生成 | B-01；真实 locale联合只有两项，`en-XA`明确不是用户 locale |

## Findings

### A-01 逐 row journey evidence 的 `exactReferenceBinding` 同字段要求两种互斥 receipt，73 行发布证据链整体不可构造

目标在 36261-36264 定义详细 binding 的 `receiptKind`为`receipt:ga-exact-reference-run-subject-binding@4`，在 36293-36297 定义 index 的 `receiptKind`为`receipt:ga-exact-reference-run-subject-binding-index@9`；`GaJourneyRunSubjectV2.exactReferenceBinding`固定为 index（36319-36324）。但 semantic binding、release conformance binding和最终 journey evidence三个 producer又要求同一个 `runSubject.exactReferenceBinding`同时是详细 binding（37501-37505、37640-37644、37712-37716）。

因为 `ReceiptRef.receiptKind`是字面量判别字段，这个交集的 `receiptKind`为`never`。以固定行 `openai.chat.key`做正向可达性探针，编译器输出：

```text
{"blocks":11,"diagnostics":1}
39485:7 TS2322 Type 'false' is not assignable to type 'true'.
```

探针断言的是 `ReviewEvidenceRunSubject["exactReferenceBinding"]["receiptKind"]`不应为`never`；诊断证明它确实为`never`。该问题不是只影响一个 provider：三个 producer均泛化到任意 `ReferenceRequirementRowV3`。随后 `commitPublishedProductProtocolClaimV6`又强制消费 `CommittedGaJourneyRunEvidenceForRowReceiptV9<R,D>`（38020-38033），所以任一固定行都无法沿声明的受信 producer链形成 completed evidence和 released claim；73 claim精确集合也无法提交。

严重性为 A：按本文完整实施，公开支持发布的必需主路径不可完成；若实现绕过 producer直接填充摘要，则又会造成公开支持假阳性。

必须修复：详细 binding与 index必须是两个不同输入/字段。可让 `runSubject`继续持 index，同时让 producer另收详细 binding，并机械验证 index的`exactBindingReceiptId/exactBindingDigest`确由该详细 binding提交；或让 run subject持详细 binding并另设 index字段。门禁必须逐73行实例化 producer正例，并断言每个 required字段与 `receiptKind`均非`never`，不能只编译未实例化的泛型声明。

### A-02 `migration_only`已有 pass payload，却在统一 supply run gate中被重新强制为 conversation-ready，混元迁移行不可过 gate

`GaJourneyDefinitionV2`正确地把普通 supply和 migration-only拆开：迁移分支明确令 connection/solution readiness为`never`，只接受`expectedMigrationReadiness: "migration_disposition_committed"`（30388-30405）。`GaJourneyPassPayloadV2`也有对应 migration payload及 terminal（37200-37220）。

但 `GaJourneyRunGateReportReceipt`在 37362-37396 遍历整个 `GaSupplyJourneyTierV2`，没有排除 `migration_only`，并对每个 tier重新要求：

```text
expectedConnectionReadiness: "connected_verified"
expectedSolutionReadiness: "conversation_ready"
```

结果是 migration gate的 `journeyDefinition`成为`never`。单独的可达性探针输出：

```text
{"blocks":11,"diagnostics":1}
39479:7 TS2322 Type 'false' is not assignable to type 'true'.
```

探针断言 migration gate 的 `journeyDefinition`不应为`never`；诊断证明相反。该缺陷在修复 A-01 后仍独立存在。固定 `hunyuan.cn`要求完整 `completed_pass requirement -> run -> journey -> entry -> ecosystem`后才能发布，但没有可构造的 run gate。

此外，无既有连接分支目前只定义一个结构型 `GaReferenceMigrationOnlyAbsenceRunSubjectV8`及其 digest（34926-34969）；live qualification只把这个 subject作为`noExistingConnectionDispositionFixture`字段（29301-29325），没有与普通 run同等级的 report、attestation和 gate。因此修复正向 migration gate时，不能继续用“期望 subject + 布尔证明”代替 absence路径的可执行证据。

严重性为 A：固定 minimum中的必需迁移主路径不能完成，同时该行的“fresh picker隐藏、仅既有连接可迁移”公开限制没有完整的执行 gate。

必须修复：普通 supply gate只遍历 `Exclude<GaSupplyJourneyTierV2,"migration_only">`；新增显式 migration gate，比较 expected/actual migration readiness并绑定 `existing_connection_migration_disposition` terminal。再为 no-existing-connection absence run增加 committed report、attestation和 gate，验证零 fresh CTA、零 key/billing/network、正确唯一主动作。为 `hunyuan.cn`增加正向构造断言和两个运行 fixture，且让 published claim明确消费两者。

### B-01 只有两个真实用户 locale，不满足终审要求的“三 locale + 伪 locale”

目标多处把真实用户 locale固定为精确二元组 `readonly ["zh-CN","en-US"]`，例如 30286、30504、35818；run subject的用户 locale联合也只有这两项（36336-36345）。正文进一步明确“GA locale固定 `zh-CN`与`en-US`”（38903、40422），目录中 `en-XA`被标为“CI pseudo locale，不作为 GA 用户 locale”（41347-41350）。

因此 `en-XA`不能同时充当第三个真实 locale和伪 locale。现有 a11y笛卡尔即使完整，也只能证明两个本地化产品旅程加一个合成拉伸测试；第三个真实语言环境没有 ICU语义、费用格式、MFA/外部任务文案、键盘/screen-reader或真实账号旅程证据。

严重性为 B：这是终审输入第7项的明确范围，也是实质性本地化与无障碍覆盖缺口，但不会单独造成现有两种语言用户的错误计费或错误接入。

必须修复：由 owner在 canonical中选择第三个真实 GA locale，并将其作为与`en-XA`不同的用户 locale贯穿 profile、run subject derivation、ICU exact parity、73行 platform/account journey集合、viewport/presentation/zoom、键盘与screen-reader证据及release四件套。门禁需断言真实 user locale数恰为3、pseudo suite另为1，禁止用 pseudo满足真实 locale计数。

## 非 finding 说明

- 固定 minimum没有逐厂商穷尽所有当前协议。例如 DeepSeek固定发布Chat而官方现有Messages；但目标明确把未列协议留在未发布层，且该provider已有可执行主流Chat路径，所以本轮不把“未声称的额外协议”计为B，也不把它误报为支持。
- One API/New API、Portkey、Vercel AI Gateway等只作为按公开接口后续判定的bridge范围，没有进入73行 fixed claim；这符合“inventory不得冒充support”。
- “计划尚未施工”、Phase复选框未勾选、尚无生产报告均未计为缺陷。本轮只判断合同按文实施后是否可达。

## 最终判定与复核

精确计数：A=2、B=1、C=0。

最终判定：`FAIL`。

报告落盘后再次核验冻结目标：

```text
HEAD    174ab48895aa1e4a6c6b42b9c74187f20efc3cfd
SHA256  c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0
lines   42437
bytes   2672219
```

目标身份未漂移。
