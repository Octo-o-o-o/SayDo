# AI 供给生态与零配置体验终审 v17

你是一个全新、零上下文、只读的生态与用户体验终审者。不要读取`prompts/`、`research/codex-findings/`、`history/`或任何旧评审材料，也不要猜测作者意图。只以当前仓库实现、canonical、必要的一手官方资料和下述冻结方案为证据。

目标文件：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

先独立核对冻结身份：

- SHA-256：`1fa73d595c2b898637e5e9b573aa01c0e2cbfe7517d45c9e9104bfe4929aec93`
- `wc -l`：`39300`
- bytes：`2494649`

任一不符立即`FAIL`并列A；不得评审另一版本。不得修改目标、生产代码或canonical。只允许把报告写入`research/codex-findings/156-ai-supply-ecosystem-ux-final-closure-v17.md`。

请完整读取目标，必要时只查一手官方文档，做事实与旅程级对抗评审：

1. 智谱BigModel/Z.AI、Kimi Platform/Kimi Code/Server、OpenCode Zen/Go/Server/ACP、Codex、Claude、Gemini、Qwen、Cursor、Grok、Copilot及通用用户CLI是否按产品、surface、rights、协议、key namespace、用途与资金来源分开。
2. OpenAI Chat/Responses、Anthropic Messages、Google GenAI、Azure、Vertex、Bedrock及custom Base URL是否有准确origin/base语义、relative path、method/header/auth、模型目录、stream/error与迁移路径；逐行核对OpenCode、Gemini、Vertex global/regional与WIF、Azure Managed Identity、Bedrock、BigModel、Kimi和TokenHub。
3. 中国大陆与全球主流官方/三方API、订阅/Coding Plan、网关与bridge是否覆盖且不误用：DeepSeek、百炼、方舟/BytePlus、千帆、硅基流动、MiniMax、TokenHub、OpenRouter、LiteLLM、CC Switch、One API/New API等。
4. Ollama、LM Studio、oMLX、Docker Model Runner、Podman AI Lab、llama.cpp、vLLM、SGLang、LocalAI、Jan、Xinference、TGI、Foundry Local、Apple Foundation Models等本地/自托管供给是否准确区分inventory、正式minimum、loopback/LAN/cloud compute、无key/可选auth、冷态和高影响动作。
5. LM Studio当前三类公开API是否被准确分开：OpenAI-compatible Chat/Responses按权威Bearer挑战，Anthropic-compatible Messages在Require Authentication关闭时none、开启时同时接受`x-api-key`和Bearer；两个header并存、跨native REST借认证或跨process generation复用都应失败。
6. OpenCode Server的username/password、LM Studio三协议和LiteLLM三协议的required/absent分支是否从当前row recipe和graph同源生成typed event；漏字段、错discriminator、错scheme或跨row/run receipt能否被拒绝。
7. OpenCode Go的Go-only与Zen余额overage、TokenHub free-only及其他套餐/API资金是否严格分开；任何套餐名、登录态或技术成功都不能冒充可调用资金或订阅权益。
8. CC Switch是否只承诺当前公开loopback Anthropic Messages opaque proxy，不依赖私有Tauri IPC、GUI route freeze或不可观测供应商归因；未来control profile是否必须另增row。
9. 自动发现是否做到static零副作用、passive同socket验证、explicit-active知情授权；本机安装但未运行、冷态、无模型、端口冲突、API关闭、认证开启等状态是否给出准确恢复处方而不自动start/pull/load。
10. 被动提示、主动配置、首次引导、恢复、费用/数据/rights披露是否让非技术用户无需理解Base URL、协议或四槽；每个user-required/terminal状态是否只有一个可直接执行主动作，automatic是否零主动作。
11. rights unknown/forbidden是否总能产生同provider intent、准确source eligibility/realm/generation/expiry、可执行的官方API journey，或带权威absence proof且排除原principal/credential family的安全替代picker。
12. Hunyuan旧API是否只允许existing-connection migration；无既有连接是否只显示not-applicable而没有开户、建key、开计费或fresh CTA。
13. 73行机器真相、公开support claim、L0/L1/L2、支持页、picker、测试矩阵、release note与released distribution是否严格同源；deterministic fixture、bounded live set-cover、账号池cleanup、双locale/pseudo locale及可访问性是否能重复执行。

对每个发现给出级别、准确锚点、真实用户反例、根因修复和可机械验收方式。方案尚未施工不是独立缺陷；但计划缺少可交付来源、错误事实、不可执行旅程、类型不可达、证据可换挂或自相矛盾必须计入。A/B任一非零即`FAIL`。报告包含冻结身份、十三项覆盖判定、A/B/C计数和最终结论，落盘后再次核对目标未漂移。
