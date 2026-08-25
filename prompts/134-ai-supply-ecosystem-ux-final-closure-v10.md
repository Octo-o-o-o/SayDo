# SayDo AI Supply 生态与体验最终闭包复核 v10

你是全新、零上下文的独立生态、产品与用户体验评审者。只评审下列唯一目标，不读取仓库里的源码、AGENTS、旧 prompt、旧 review、journal、计划索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 19,742 行；
- 1,182,440 bytes；
- SHA-256 `e5100062006a86b5828630a068f51b615c38aee2642229f572271b0b5e5a9cdc`。

先只读核对三项；不一致立即写`[fail] input drift`。完整读取1–19,742行，禁止抽样、读取旧评审或编辑目标。

从“普通用户本机已有任一常见AI服务、CLI、订阅、官方/三方API或自托管runtime时，是否可被动发现、主动配置并获得准确处方”出发构造最短反例。至少逐类检查：

1. OpenAI、Anthropic、Gemini、OpenRouter、OpenCode Zen/Go/Server、智谱BigModel/Z.AI、Kimi API/Code、DeepSeek、百炼、方舟/BytePlus、混元、千帆、MiniMax、SiliconFlow和全球长尾；
2. Codex ChatGPT login/Platform API key/Enterprise automation token、Claude Code、Kimi Code、Gemini CLI/Antigravity、OpenCode、Cursor、Grok、Qwen、Copilot等CLI/订阅的官方surface、rights、自动超额、API与Execution边界；
3. CC Switch、Claude Code Router、LiteLLM、OpenRouter BYOK、Portkey/Higress/Envoy/Kong、企业gateway/proxy和自定义Base URL的OpenAI Chat/Responses、Anthropic Messages、Google GenAI、公开/secret header、mTLS与未知计量；
4. Ollama/Ollama Cloud、LM Studio/LM Link、oMLX、vLLM、SGLang、llama.cpp、LocalAI、Docker Model Runner、Podman AI Lab、Foundry Local、Apple Foundation Models和LAN自有算力；
5. Bedrock API key/static/role/SSO、Google ADC/WIF、Azure key/Entra user/service principal/managed identity及企业未知价格；
6. provider-first预览、唯一主动作、自动发现、登录/MFA/离开返回、首启witness、离线/代理恢复、中国大陆可达性、双locale/a11y、冷启动、服务停止、迁移回滚和运行中处方；
7. required journey是否只能以connected+conversation/review、execution-ready或control-ready通过，blocked/action-required/advanced是否只能作为负向fixture；
8. 每条GA journey是否真实覆盖`not_enrolled/ready`两种anchor起点，并把witness前置与主旅程的SayDo动作、外部任务、手填、copy/paste、leave-return、错误恢复和raw/app elapsed完整合计；
9. reference profile是否机械包含matrix全部L0、固定全球/中国入口、逐realm/逐auth journey，owner是否只能增加不能缩减；
10. discovery安全与资源公平：不碰secret/history、不执行未知helper、不扫LAN、不静默enable/pull/load/start或发付费metadata，恶意publisher不能饿死核心detector或其他健康publisher；
11. 是否仍迫使用户猜Base URL、协议、region、套餐、模型、secret来源、内部槽位、anchor含义或恢复步骤；
12. inventory、安装、登录、权益、conformance、当前readiness、费用、数据边界和“本机计算但进程仍可外连”是否始终分开；
13. 被动提示、主动配置、错误回路、回到应用后的焦点/状态延续、屏幕阅读器与低认知负担是否都有唯一可执行处方；
14. 未获授权的消费订阅是否始终给官方API/其他来源替代，而不会暗用token、复用套餐或静默转按量。

严重度：A为核心主流journey不可达、误用订阅/API/凭据/费用/数据或reference-grade覆盖失真；B为常见用户仍明显苦恼配置、自动发现/恢复/提示缺关键步骤、主流入口缺失或扩展仍要改核心；C为非阻断建议。只有A=0且B=0可给`PASS`。

每条发现必须给编号、严重度、精确行号、具体用户旅程或最短反例、现有方案为何挡不住、根因级修法；同根因合并。报告包含读取完整性与最终SHA、A/B/C计数、生态/旅程覆盖矩阵和唯一verdict。

仅通过`apply_patch`将最终报告写入：

`research/codex-findings/134-ai-supply-ecosystem-ux-final-closure-v10.md`

写完后只读报告行数、bytes和SHA-256；不得修改其他文件。
