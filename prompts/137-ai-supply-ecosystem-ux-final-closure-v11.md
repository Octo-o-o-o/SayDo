# SayDo AI Supply 生态与体验最终闭包复核 v11

你是全新、零上下文的独立生态、产品与用户体验评审者。除本prompt外，只评审下列唯一目标，不读取仓库源码、AGENTS、旧prompt、旧review、journal、索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 22,507 行；
- 1,363,124 bytes；
- SHA-256 `3b93808d641a6f2a59a1938ae6526280da1d7746dc8acf4197d030cdc6bf8ed1`。

先只读核对三项；不一致立即写`[fail] input drift`。完整读取1–22,507行，禁止抽样、读取旧评审或编辑目标。

从“普通用户本机已有任一常见AI服务、CLI、订阅、官方/三方API或自托管runtime时，是否可被动发现、主动配置并获得准确处方”出发构造最短反例。至少逐类检查：

1. OpenAI、Anthropic、Gemini、OpenRouter、OpenCode Zen/Go、智谱BigModel/Z.AI、Kimi Platform/Code、DeepSeek、百炼、方舟/BytePlus、混元、千帆、MiniMax、SiliconFlow和全球长尾；
2. Codex ChatGPT login/Platform key/Enterprise automation token、Claude Code、Kimi Code、Gemini CLI/Antigravity、OpenCode、Cursor、Grok、Qwen、Copilot的官方surface、rights、超额与Inference/Execution边界；
3. OpenCode Zen/Go各自Chat/Responses/Messages、Server HTTP/ACP，Kimi Code双协议，LM Studio/oMLX三协议，BytePlus及Azure/Vertex/Bedrock逐auth是否都有独立最小requirement与真实recipe；
4. CC Switch、Claude Code Router、LiteLLM、OpenRouter BYOK、Portkey/Higress/Envoy/Kong、企业gateway/proxy和自定义Base URL的Chat/Responses/Messages、公开/secret header、mTLS与未知计量；
5. Ollama/Ollama Cloud、LM Studio/LM Link、oMLX、vLLM、SGLang、llama.cpp、LocalAI、Docker Model Runner、Podman AI Lab、Foundry Local、Apple Foundation Models和LAN自有算力；
6. Bedrock API key/static/role/SSO、Google ADC/WIF、Azure key/Entra user/service principal/managed identity及企业未知价格；
7. provider-first预览、唯一主动作、自动发现、登录/MFA/离开返回、首次witness、离线/代理/大陆可达性、双locale/a11y、冷启动、服务停止、迁移回滚和运行中提示；
8. 每条required journey是否从`not_enrolled/ready`两种anchor起点达到准确可用终态，并把前置与主旅程的动作、外部任务、手填、MFA、copy/paste、leave-return、错误恢复、raw/app elapsed完整合计；
9. zero-config、guided-key、guided-oauth/subscription、enterprise/execution、anchor是否各用自己的per-class限额，`manualFieldCount`是否机械求和，外出返回后是否恢复准确card/control焦点；
10. 61行reference requirements是否是唯一最低真相，删除/合并protocol row、替换recipe、借另一平台/locale/report或将V2复活是否必红；
11. passive/static/explicit discovery是否不碰secret/history、不执行未知helper、不扫LAN、不静默enable/pull/load/start或发付费metadata，并给用户一个清楚的下一动作；
12. 远程witness首次动作、数据处理方、代理/离线恢复以及production资格失败时的降级是否对非技术用户清楚且不产生死路；
13. inventory、安装、登录、权益、conformance、当前readiness、费用、数据边界和“模型本机计算但服务仍可外连”是否始终分开；
14. 未获授权的消费订阅是否始终给官方API/受支持surface替代，不暗用token、复用套餐或静默转按量。

严重度：A为核心主流journey不可达、误用订阅/API/凭据/费用/数据或reference-grade覆盖失真；B为常见用户仍明显苦恼配置、自动发现/恢复/提示缺关键步骤、主流入口缺失或扩展仍要改核心；C为非阻断建议。只有A=0且B=0可给`PASS`。

每条发现必须给编号、严重度、精确行号、具体用户旅程或最短反例、现有方案为何挡不住、根因级修法；同根因合并。报告包含读取完整性与最终SHA、A/B/C计数、生态/旅程覆盖矩阵和唯一verdict。

仅通过`apply_patch`将最终报告写入：

`research/codex-findings/137-ai-supply-ecosystem-ux-final-closure-v11.md`

写完后只读报告行数、bytes和SHA-256；不得修改其他文件。
