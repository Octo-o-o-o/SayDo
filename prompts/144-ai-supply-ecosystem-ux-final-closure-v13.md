# AI 供给生态与零配置体验终审 v13

你是一个全新、零上下文、只读的产品生态与 UX 终审者。不要读取 `prompts/`、`research/codex-findings/`、`history/` 或旧评审结论。只读当前生产代码、canonical 约束与下述冻结方案；需要核查易变事实时只采用官方文档、官方仓库或原始规范，不拿搜索摘要或品牌名称代替支持证据。

目标文件：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结身份必须先独立核对：

- SHA-256：`ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743`
- `wc -l`：`28097`
- bytes：`1679137`

若任一不符，立即输出 `FAIL` 并列为 A 级；不得修改目标、生产代码或 canonical。

请从“本地已有任何主流 AI 服务的普通用户是否真的能少配置并安全使用”出发，至少逐项审计：

1. 当前实现事实：智谱、Kimi、OpenCode、7 个 wired CLI、自定义 Base URL、OpenAI Chat/Responses、Anthropic Messages 的结论是否与源码一致。
2. 中国大陆与全球：官方 API、第三方 gateway、Coding/Token Plan、消费/企业订阅、realm/region/key/rights/费用是否分开；是否漏掉会改变总体架构的主流类别。
3. CLI 与 Agent：Codex、Claude、Gemini/Antigravity、Kimi、OpenCode、Cursor、Grok、Qwen、Copilot，以及通用 stdio/ACP/App Server 的探测到激活路径是否真实，不把任意 stdout、IDE credential 或登录态冒充可嵌入权益。
4. 本地与自托管：Ollama、LM Studio、oMLX、llama.cpp、vLLM、SGLang、LocalAI、Jan、Xinference/TGI/MLX-LM、Docker Model Runner、Podman AI Lab及任意兼容端点，覆盖 ready/cold/stopped/no-model/cloud/LAN/unknown，不要求假 key、不静默下载或转云。
5. bridge/开源工具：CC Switch Desktop 与 CLI fork、LiteLLM、One API/New API、企业 gateway、OpenCode Server/ACP、Claude Code Router类工具是否有可执行边界、route/failover/secret/rights 证明，而非 logo wall。
6. 自动探测与主动配置：首次引导、状态卡、唯一主动作、返回恢复、错误处方、付费确认、a11y、zh-CN/en-US/en-XA、三平台路径是否在每种阻断状态都能走通。
7. 扩展与长期维护：新 provider、订阅、CLI、本地 runtime 或新协议能否只新增最小 pack/profile/detector/driver；支持页、picker、测试矩阵和 release note 是否由同一机器真相生成。
8. 对“一次做好”的诚实边界：哪些是 L0/L1/L2/inventory，哪些必须由官方 rights 或 owner 决策解锁；方案是否对用户清楚说明而不把未获授权的订阅说成可用。

严重级别：A 为会导致费用/权益/隐私/安全错误、虚假支持或核心路径不可用；B 为主流生态、关键 journey、平台/语言、自动探测或扩展机制的重大缺口；C 为不阻断开箱目标的优化。

报告必须写入 `research/codex-findings/144-ai-supply-ecosystem-ux-final-closure-v13.md`，包含冻结身份核对、覆盖判定、逐条发现（级别、准确锚点、用户反例、根因修复、验收方式）、A/B/C 计数和最终 `PASS`/`FAIL`。只有 A=0 且 B=0 才能 `PASS`。
