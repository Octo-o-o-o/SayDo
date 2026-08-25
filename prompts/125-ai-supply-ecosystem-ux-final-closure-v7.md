# SayDo AI Supply 生态与体验最终闭包复核 v7

你是全新、零上下文的独立生态、产品与用户体验评审者。只评审下列唯一目标，不读取仓库里的源码、旧 prompt、旧 review、journal、计划索引或其他文件：

`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结输入必须同时满足：

- 12,330 行；
- 833,246 bytes；
- SHA-256 `c0d36de218f4a6db475f000d09eb1fe5d26e57ebaab0f9224ce1bc05fb6b2b72`。

先以只读命令核对三项；不一致立即写 `[fail] input drift`。完整读取 1–12,330 行，禁止只按关键词抽样，禁止读取旧评审或其他仓库材料，禁止编辑目标。

请从“本地已有任何常见AI服务、CLI、订阅、官方/第三方API或自托管runtime的普通用户，安装后是否能被动发现、主动配置并获得准确处方”的角度构造反例。至少逐类检查：

1. OpenAI、Anthropic、Gemini、OpenRouter、OpenCode Zen/Go/Server/ACP、智谱BigModel/Z.AI、Kimi API/Code、DeepSeek、百炼、方舟/BytePlus、混元、千帆、MiniMax、SiliconFlow与全球长尾官方API；
2. Codex App Server、Claude Code、Kimi Code、Gemini CLI、Antigravity、OpenCode、Cursor、Grok、Qwen、Copilot、Vibe等订阅/CLI，权益、自动超额、API与Execution边界是否准确；
3. CC Switch Desktop/CLI、Claude Code Router、LiteLLM、OpenRouter BYOK、企业proxy/gateway、自定义Base URL，Chat/Responses/Messages、公开header、未知计量与恢复是否可配置且不要求用户猜；
4. Ollama/Ollama Cloud、LM Studio/LM Link、oMLX/MLX-LM、vLLM、SGLang、llama.cpp、LocalAI、Docker Model Runner、Podman AI Lab、Foundry Local、Apple Foundation Models、LAN/远程自有算力是否能正确发现且不误报本机隐私或零新增费用；
5. AWS/GCP/Azure的static profile、role/SSO/workload/managed identity、企业未知价格、realm/region与长尾签名认证是否有独立可达journey；
6. 无技术背景用户的provider-first预览、唯一主动作、主动/被动入口、登录跳转与回来、MFA、取消/超时/不确定状态、离线中国大陆场景、双locale/a11y、冷启动、本地服务未启动、迁移/回滚是否足够友好；
7. reference-grade具名minimum和GA journey是否真实覆盖每个auth/product/platform/locale路径，失败payload、generic protocol报告、另一平台、另一账号或旧binary是否还能借用；
8. 自动探测是否安全、有界、有处方，不碰secret/history、不执行helper、不扫描LAN，也不静默enable/pull/load/start或发付费metadata；
9. 计划是否遗漏会迫使用户查文档、猜Base URL/协议/region/套餐、复制长期secret、理解内部槽位或手工诊断的主流路径。

严重度：

- A：核心主流journey不可达、会误用订阅/API/凭据/费用/数据边界、静默付费或reference-grade覆盖声明不成立；
- B：常见用户仍需明显苦恼配置，自动发现/恢复/提示缺关键步骤，重要中国大陆或全球主流入口缺失，或扩展仍要改核心；
- C：不影响主路径和正确性的增强建议。

只有 A=0 且 B=0 才能给 `PASS`。每条发现必须有严重度与编号、精确行号、具体用户旅程/最短反例、现有方案为何挡不住、根因级修法；同根因合并。

将最终报告写入：

`research/codex-findings/125-ai-supply-ecosystem-ux-final-closure-v7.md`

报告包含读取完整性与最终SHA、A/B/C计数、生态/旅程覆盖矩阵和单一 verdict。写完后报告文件行数、bytes与SHA-256；不得修改其他文件。
