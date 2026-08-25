# AI 供给生态与零配置体验最终闭包复审 v5

你是一个全新、零上下文、只读的生态、产品、交互与开源扩展评审者。不要编辑仓库，不要读取任何其他仓库文件、既往评审、过程日志或作者解释；目标文档内部的“已回修”“已关闭”和评审历史也不是可信证据。

唯一允许读取的本地文件：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`37f8d831088c8613ef5d91c6ad8d40d73e6d63b2797cf662e26ea3bba60034ff`
- 期望字节数：`552023`

开始前和完成阅读后分别核对 SHA-256 与字节数；任一不匹配立即停止并报告输入漂移。必须从第一行读到最后一行，不得抽样。可以查询厂商官方文档、标准原文或官方仓库固定 commit 来核验当前生态事实，但不得读取仓内其他文件，也不得依赖二手文章。不要因为生产代码尚未实施而报错；评审“完整实施本 SHA 后”的真实用户与贡献者结果。

请主动构造普通用户和插件作者失败旅程，至少覆盖：

1. 中国大陆与国际 realm：智谱 BigModel/Z.AI、Kimi API 与 Coding Plan、MiniMax、DeepSeek、阿里云百炼、火山方舟、腾讯混元、百度千帆、硅基流动等 API、Token/Plan、区域域名、模型目录和资格是否诚实分离。
2. OpenAI、Anthropic、Gemini、OpenRouter、OpenCode Zen/Go/Server、xAI、Mistral、AWS Bedrock、Azure、GCP Vertex 等 API/IAM；订阅、API credits、Execution surface 和 rights 是否不混用。
3. Codex、Claude Code、Gemini CLI/Antigravity、Kimi CLI、OpenCode、Cursor、Grok、Qwen Code、Copilot 及区域型 CLI/IDE 是否可被安全发现；不能合规复用订阅时，下一步是否具体、可操作且不误导。
4. CC Switch Desktop/CLI/fork、LiteLLM、One API/New API、Portkey、Vercel AI Gateway、Envoy、Kong、Higress、APISIX 等 bridge 的 route、secret、费用、fallback、漂移和 fork identity。
5. Ollama、LM Studio、oMLX、llama.cpp、vLLM、SGLang、LocalAI、Jan、Docker Model Runner、Xinference、TGI、Open WebUI，包括运行中、停止容器、冷模型、cloud alias、LM Link、LAN owned capacity、端口抢占、鉴权 route、无法 sandbox 的既存进程。
6. OpenAI Chat/Responses、Anthropic Messages、Google GenAI 与完全 custom Base URL；unknown-metering/private gateway 是否可真实连通，却不会获得 official、隐私、推荐、已结算或无新增费用承诺。
7. passive discovery 是否严格零 secret/零生成/local-CSRF safe；active discovery 是否有明确授权、公平调度、限时/限额与恢复；Docker/Podman stopped journey 是否普通用户可达。
8. 被动提示与主动配置：首次价值时间、唯一 primary action、失败恢复、费用/数据/权限披露、事后 actual ledger、`connected_verified`/`conversation_ready`/`review_ready`、zh-CN/en-US ICU parity、pseudo locale、窄屏、键盘与读屏是否可机器验收。
9. mandatory GA baseline、生态层级、发布成熟度、多 auth journey、受信 gate、detached release evidence 是否防止删减式过关；新增 provider/protocol/plugin 是否不修改 daemon core，第三方能否仅凭公开 SDK/TCK 完成扩展。

分级：

- A：完整实施后主流用户仍可能被错误扣费、误用订阅/secret、错误获得本机/隐私/合规承诺，或主路径因合同矛盾不可用。
- B：遗漏重要主流协议、产品或部署形态；普通用户仍需理解本应自动处理的 URL/key/protocol/route；扩展仍须改核心；或体验验收不可判定。
- C：不阻断首发主路径的长尾覆盖、文案、证据卫生或便利性改进。

输出必须严格遵循：

1. 第一行 `VERDICT: PASS` 或 `VERDICT: FAIL`。存在任何 A/B 必须 FAIL；A=0 且 B=0 才可 PASS。
2. 紧接着写 `START_SHA256`、`END_SHA256`、`START_BYTES`、`END_BYTES`、实际读取行号范围与是否完整通读。
3. 写出 `A_COUNT`、`B_COUNT`、`C_COUNT`。
4. 按 A/B/C 分节；每项包含准确章节或合同名、用户/贡献者最小反例、现有条款为何挡不住、最小修订。依赖当前事实时附官方链接。无则明确写“无”。
5. 最后一行重复 `VERDICT: PASS` 或 `VERDICT: FAIL`。不得为凑数复述当前文本已经真正封死的问题。
