# AI Supply 生态与体验终审闭包复核 v8

## 结论

**Verdict：PASS**

- A：0
- B：0
- C：0

在本轮限定的生态与普通用户体验视角下，没有发现即使完全照当前方案实施仍可复现的 A/B/C 级缺口。当前文本已经把“发现了某个名字”“装了某个 CLI”“登录过某个订阅”“协议看似兼容”“当前可发送请求”“不会新增费用”“数据留在本机”拆成彼此独立、可失效、可机械验收的证据和状态；未通过权益、费用、数据、身份、协议或运行时闭包的候选只能停在 inventory、candidate、action_required 或 blocked，不能进入推荐、自动调用或正式覆盖声明。

本结论只评价冻结目标中的方案是否形成可实施且可验收的生态/体验闭包，不表示相关生产代码、provider preset、真实账号 journey 或 release evidence 已经实现和通过。目标自身在 14122–14148、14502 对这一区分保持了明确口径。

## 输入与读取完整性

- 唯一目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 提示给定冻结值：14,502 行；945,084 bytes；SHA-256 `5ae8c540fe32e67cc6bae3788f22b90126223e3914dce5f236d273d0f2e51d65`
- 读取前复核：14,502 行；945,084 bytes；SHA-256 与给定值一致。
- 读取方式：从第 1 行连续读到第 14,502 行；长段输出中被截断的区间均以更小范围补读，没有以关键词抽样替代全文读取。
- 读取后复核：14,502 行；945,084 bytes；SHA-256 仍为 `5ae8c540fe32e67cc6bae3788f22b90126223e3914dce5f236d273d0f2e51d65`。
- 范围纪律：除评审提示与上述冻结目标外，没有读取其他仓库文件；没有使用旧报告、实现代码或外部网页补充结论；只新增本报告，没有修改冻结目标或其他文件。

## 生态与旅程对账矩阵

| 评审面 | 冻结方案中的可执行落点 | 反例复核 | 结论 |
|---|---|---|---|
| 全球官方 API | OpenAI Responses、Anthropic Messages、Gemini API、OpenRouter、OpenCode Zen/Go 与全球长尾按产品、协议、realm、auth、funding 分开；L0/L1/L2 不等于当前 readiness（12077–12135、12948–12963、13003–13027、13324–13409） | Chat 兼容报告不能借给 Responses/Messages/GenAI；普通 key、PKCE key、BYOK management authority 和 gateway credits 不能互借 | [ok] |
| 中国大陆与华语来源 | Kimi 普通 API/Coding Plan/Server-ACP、BigModel/Z.AI、DeepSeek、百炼、方舟/BytePlus、混元、千帆、MiniMax、SiliconFlow 逐产品与 realm 建模；受限 Coding Plan 明确 inventory/forbidden（12965–13001、13124–13130、13324–13328、14052–14074） | 中国/国际 key、endpoint、费用和数据证据换挂为零 secret read/零 packet；套餐 key 不会被当普通 API key | [ok] |
| CLI、订阅与 Execution | installed、authenticated、entitled、conformant 四级分开；Codex App Server、Claude Code、Kimi Code、Gemini/Antigravity、OpenCode、Cursor、Grok、Qwen、Copilot、Vibe 各有准确 surface/rights/overage 处方，Inference 与 Execution 不混用（12705–12742、13029–13048、13501–13547） | 已登录但 rights unknown/forbidden 不推荐、不发 prompt；额度耗尽不静默转 payg；CLI credential store 不被抽 token | [ok] |
| Bridge、router 与 custom | CC Switch Desktop/CLI fork、Claude Code Router、LiteLLM、OpenRouter BYOK、企业 proxy/gateway 与 custom Base URL 独立处理；Chat/Responses/Messages、公开 header、`custom_secret_header`、mTLS-only 与 unknown metering 均有严格分支（11429–11434、12129–12135、12679–12688、13062–13075） | route/failover 不可冻结时只 route-pinned/inventory；proxy 可见处理方进入披露；secret header 不能伪装成公开 header；custom unknown 不冒充 official/settled/no-new-spend | [ok] |
| 本地与自托管 | Ollama/Cloud、LM Studio/LM Link、oMLX/MLX-LM、vLLM、SGLang、llama.cpp、LocalAI、Docker Model Runner、Podman AI Lab及 LAN/self-owned compute 均区分 transport、compute、loaded state、egress 与费用（12611–12619、12744–12770、13050–13060、14107–14116） | loopback 不等于本机计算；cloud alias/LM Link 不冒充 local；cold/stopped/no-model/API-off/port-conflict 有状态和唯一处方；不自动 enable/pull/load/start | [ok] |
| 系统级本机模型 | Windows Foundry Local 与 Apple Foundation Models 是具名 L2；要求专用 runtime/native helper、OS availability、entitlement 与能力 TCK，不假设 OpenAI-compatible HTTP（13050–13060、14115） | 没有 native helper/TCK 时保持 L2/inventory，不生成协议或本机能力假证明 | [ok] |
| AWS/GCP/Azure 企业身份 | Bedrock API key、named static profile、role profile、SSO；Vertex ADC/WIF；Azure API key、Entra user、service principal、managed identity 分别列为独立 entry 和 journey（11428、12080–12093、12142–12153、12668–12678、13612–13647） | 不执行无界 default chain/helper；不要求复制长期 secret；每个 auth、principal、account/project/tenant、region/deployment 不能借报 | [ok] |
| Provider-first 主路径 | 默认页隐藏四槽，按 candidate→connected_verified→conversation_ready→review_ready 展示；key/OAuth/local/custom/payg 分别计算动作上限，连接成功不冒充整套可用（12630–12637、12898–12921、13561–13610、13829–13840） | 首次 payg 在无持久预算时允许诚实的三动作；rights 未清先不给 key/付费动作；每个状态只有一个机器可读主动作 | [ok] |
| 登录返回与失败恢复 | 浏览器/设备登录有 start、callback、exchange、cancel、deadline、denial、delivery-unknown 和 family 恢复状态；UI 记录 MFA、离开返回、外部任务、错误循环和恢复动作（11424–11428、11949–12023、12634–12637、13829–13840） | 登录返回自动续接原卡；取消/超时/响应丢失不伪造成功或盲目重试；外部步骤不被隐藏在“点击数”之外 | [ok] |
| 离线、中国网络与平台恢复 | release-bundled snapshot 支持离线 candidate；remote witness 明确中国/全球/企业 realm、proxy、数据边界、rotation 与恢复；不可用时只降级为 boot-scoped 匿名本机 plain-dialog（10774–10780、12616–12619、13889–13890） | fresh install、offline、proxy blocked、threshold partial、continuity lost 都有确定状态；离线降级不能借文件锁获得全功能 pass | [ok] |
| 双 locale、可访问性与平台实跑 | `zh-CN/en-US` 是用户 locale，`en-XA` 是独立 pseudo suite；逐 journey 物化 platform×用户 locale 笛卡尔积，记录窄屏、200%、键盘、screen reader 与 ICU 对等（11949–12020、12315–12495、12933–12946、13831–13842） | 单平台、单 locale、pseudo locale、generic report 或布尔 coverage 均不能借给缺失 run | [ok] |
| Discovery 安全与边界 | static filesystem 零 packet；passive loopback 只执行 release-bundled 固定 capability；explicit active 需用户同意和 OS sandbox；有全局预算、公平调度、peer identity、sentinel 与 LAN 默认关闭（12611–12619、12692–12703、13423–13500） | 不执行 PATH 程序、不读 token/session/history、不扫 LAN、不由在线 catalog 添加 probe、不按端口或 401/403 猜服务 | [ok] |
| `ReferenceGradeProfileV2` | 固定具名 entry、协议、realm、funding tier、custom/local/cloud/platform journey、类别最低数和两个有限 replacement slot；replacement 明确不能替代 fixed entry（12077–12248） | Azure/Vertex/Bedrock 逐 auth 独立；Kimi 三产品互斥；oMLX、mTLS、Docker/Podman、anchor witness 均为固定要求；删 minimum 会更名并撤徽章 | [ok] |
| GA evidence 与防借报 | run→journey aggregate→entry→ecosystem gate逐层重算 exact set，绑定当前 distribution、runner、fixture、原始证据、attestation 与 UX metrics；baseline 给出中国/全球/local/cloud/execution/bridge/custom/platform类别（12315–12607、13120–13140、13693–13698） | 旧 binary、另一 realm/auth/platform/locale、generic protocol report、failed/incomplete report、owner 临时批准均不能使 gate 变绿 | [ok] |
| 覆盖语义与公开声明 | 发布成熟度、协议/能力 conformance、运行健康、权益可用性四轴独立；再计算 connection/solution readiness，官网范围与设备当前可用性分开（11915–11923、12950–12963、13927–13947） | inventory、installed、logged-in、rights、conformance、readiness、费用和数据任一单轴都不能冒充“支持/可用” | [ok] |

## 关键普通用户反例复核

1. **已有 CLI 且已登录，但第三方嵌入权利不明。** 方案先停在 `rights_unknown`，主动作由 typed official destination resolver 给出“改用官方 API”或“选择其他来源”；不会先索取 secret，也不会发真实 prompt（12709–12712、12885–12911）。
2. **订阅额度耗尽，同时存在按量余额。** funding/overage 与 connection 分离；OpenCode Go→Zen、Kimi Extra Usage、订阅→payg 都需新的、与当前 route/component/cap 相等的决定，错误恢复或重启不能代替授权（10841–10858、13375–13378、13534–13538）。
3. **OpenRouter BYOK 的 A key 超时后 B key 成功。** 完整 key 顺序、filters、shared fallback、revision、各 biller/account component 和最坏序列预算均冻结；A 保持 `charge_unknown`，B 单独结算，不会只按成功成员或 `max(A,B)` 计费（13377–13387）。
4. **企业私有 gateway 使用 `X-Auth-Token`、mTLS 和检查型 proxy。** secret header、mTLS client identity、proxy credential、origin application auth 与可见 processor 分组件授权；redirect、大小写碰撞、reserved header、proxy 泄漏和 endpoint 漂移均在 secret read/首字节前拒绝（11429–11434）。
5. **Ollama loopback 实际调用 cloud model，或 LM Studio 通过 LM Link 使用另一台设备。** endpoint 的 loopback 属性不会生成 local compute/data-locality/no-new-spend 证明，实际 compute principal、费用与数据去向必须重新闭合（10712–10714、12746–12770、14107–14112）。
6. **Docker/Podman 已安装但 AI 服务停止、API 未开启或没有模型。** 自动阶段只看安装迹象；用户确认后才只读检查，产品级 journey 输出准确状态和单一处方，不启动、拉取、创建或加载（12611–12613、13592–13597）。
7. **Windows Foundry Local 或 Apple Foundation Models 用户期待被当普通兼容端点。** 方案明确要求专用 runtime/native helper、OS/entitlement/availability/capability TCK；缺证据时不宣称协议兼容或 GA 支持（13050–13060、14115）。
8. **企业账号使用 AWS role/SSO、Google WIF 或 Azure managed identity。** 方案为每种 auth 建独立 issuance/journey，禁默认凭据链和 credential helper 自动执行，也不要求用户把长期 secret 复制进 SayDo（11428、12142–12153、13626–13636）。
9. **fresh install 离线或中国网络无法联系 witness。** UI 给出 offline/proxy/realm/recovery 的唯一动作；安全锚不可用时只开放匿名本机基础对话，明确告知登录/API/工具为何不可用，不会静默用可回滚文件状态获得全功能（12616–12619）。
10. **一个平台或语言跑通后试图借给其他平台/语言。** V2 journey 强制 macOS/Linux/Windows × `zh-CN/en-US` 独立用户 run，并另跑 `en-XA`；exact-set gate 拒绝遗漏、重复、替代和旧 distribution（12007–12020、12315–12577）。

## Findings

没有 A/B/C 级 finding。

当前方案已经为本轮要求的主流、长尾、订阅、CLI、bridge、custom、local、三云身份和普通用户恢复路径提供了明确的产品身份、状态、处方、费用/数据边界与机械 gate。对未完成的 L1/L2、无官方 rights、无强 peer/sandbox、无可冻结 route、unknown metering 或系统级 native runtime，方案选择如实降级或保持 inventory，而不是用品牌名、兼容端点、登录态或人工成功冒充正式支持。因此本轮没有可复现的 false-green、静默付费、secret 误投、数据去向误报或重要主路径缺失。

## 单一最终判定

**PASS — A=0，B=0，C=0。**
