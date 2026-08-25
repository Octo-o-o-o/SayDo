# SayDo AI Supply 生态与体验最终闭包复核 v9

你是全新、零上下文的独立生态、产品与用户体验评审者。只评审下列唯一目标，不读取仓库里的源码、AGENTS、旧 prompt、旧 review、journal、计划索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 16,355 行；
- 1,025,192 bytes；
- SHA-256 `ae6175a7195411f6878f4317ef4413f354df0763e3be6a80e7c54fc2c0c6980e`。

先只读核对三项；不一致立即写`[fail] input drift`。完整读取1–16,355行，禁止抽样、读取旧评审或编辑目标。

从“普通用户本机已有任一常见AI服务、CLI、订阅、官方/三方API或自托管runtime时，是否可被动发现、主动配置并获得准确处方”出发构造最短反例。至少逐类检查：

1. OpenAI、Anthropic、Gemini、OpenRouter、OpenCode Zen/Go/Server、智谱BigModel/Z.AI、Kimi API/Code、DeepSeek、百炼、方舟/BytePlus、混元、千帆、MiniMax、SiliconFlow和全球长尾；
2. Codex App Server、Claude Code、Kimi Code、Gemini CLI、OpenCode、Cursor、Grok、Qwen、Copilot等CLI/订阅的官方surface、权益、自动超额、API与Execution边界；
3. CC Switch、Claude Code Router、LiteLLM、OpenRouter BYOK、企业gateway/proxy和自定义Base URL的OpenAI Chat/Responses、Anthropic Messages、公开header、secret header、mTLS与未知计量；
4. Ollama/Ollama Cloud、LM Studio/LM Link、oMLX、vLLM、SGLang、llama.cpp、LocalAI、Docker Model Runner、Podman AI Lab、Foundry Local、Apple Foundation Models和LAN自有算力；
5. Bedrock API key/static/role/SSO、Google ADC/WIF、Azure key/Entra user/service principal/managed identity及企业未知价格；
6. provider-first预览、唯一主动作、自动发现、登录/MFA/离开返回、首启witness、离线与中国大陆、双locale/a11y、冷启动、服务停止、迁移回滚和运行中处方；
7. GA具名entry、category minimum、maturity/tier、逐auth journey、platform×双用户locale、独立pseudo run、expected/final readiness和copy/paste/leave-return上限；
8. discovery安全与资源公平：不碰secret/history、不执行未知helper、不扫LAN、不静默enable/pull/load/start或发付费metadata，恶意publisher不能饿死核心detector；
9. 是否仍迫使用户猜Base URL、协议、region、套餐、模型、secret来源、内部槽位或恢复步骤；
10. inventory、安装、登录、权益、conformance、当前readiness、费用与数据边界是否始终分开。

严重度：A为核心主流journey不可达、误用订阅/API/凭据/费用/数据或reference-grade覆盖失真；B为常见用户仍明显苦恼配置、自动发现/恢复/提示缺关键步骤、主流入口缺失或扩展仍要改核心；C为非阻断建议。只有A=0且B=0可给`PASS`。

每条发现必须给编号、严重度、精确行号、具体用户旅程或最短反例、现有方案为何挡不住、根因级修法；同根因合并。报告包含读取完整性与最终SHA、A/B/C计数、生态/旅程覆盖矩阵和唯一verdict。

将最终报告写入：

`research/codex-findings/131-ai-supply-ecosystem-ux-final-closure-v9.md`

写完后只读报告行数、bytes和SHA-256；不得修改其他文件。
