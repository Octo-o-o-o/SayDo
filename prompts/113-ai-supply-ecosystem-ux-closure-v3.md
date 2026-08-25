# AI 供给生态与零配置体验闭包复审 v3

你是一个全新、零上下文、只读的生态、产品、交互与开源扩展评审者。不要编辑仓库，也不要相信此前结论。

唯一评审对象：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453`

开始和结束时都核对 SHA；任一不匹配立即停止。必须通读完整文件。可只读核对当前代码，可查厂商官方文档、标准原文或官方仓库固定 commit；当前产品事实不要依赖二手文章。不要因生产代码未实施而报错，评审的是完整实施后的真实用户与贡献者结果。

重点覆盖：

1. 中国大陆普通 API、Token/Coding Plan、国内/国际产品严格分流：智谱 BigModel/Z.AI、Kimi、MiniMax、DeepSeek、百炼、方舟、腾讯、百度、硅基流动等。
2. OpenAI、Anthropic、Gemini API、OpenRouter、OpenCode Zen/Go/Server、xAI/Mistral、AWS/Azure/GCP 等全球 API/IAM；Gemini API 是否有明确 phase/gate。
3. Codex、Claude Code、Gemini/Antigravity、Kimi、OpenCode、Cursor/Grok/Qwen/Copilot 及区域型 CLI/IDE 的 subscription、API、Execution surface 和 rights 是否诚实。
4. CC Switch Desktop/CLI fork、LiteLLM、One API/New API、Portkey、Vercel/Envoy/Kong/Higress/APISIX 等 bridge 的 route、费用、secret 和漂移。
5. Ollama、LM Studio、oMLX、llama.cpp、vLLM、SGLang、LocalAI、Jan、Docker Model Runner、Xinference/TGI/Open WebUI：运行、停止容器、冷态、cloud alias、LM Link、LAN owned capacity、端口抢占和有认证 local route。
6. OpenAI Chat/Responses、Anthropic Messages、Google GenAI 与完全 custom Base URL；private gateway 能否在不冒充官方、不进入推荐/fallback的前提下真正接入。
7. 自动发现是否不会被 signed catalog 变成 local CSRF；Docker/Podman stopped journey、detector fair scheduling和 explicit-active sandbox 是否普通用户可达。
8. `connected_verified`/`conversation_ready`/`review_ready`、payg 最多三动作、费用 renderer=ledger sent、唯一 primaryAction、zh-CN/en-US ICU parity、pseudo locale、无障碍是否一致。
9. `ga-ecosystem-matrix.json`、L0/L1/L2/inventory、SDK/TCK/namespaced protocol、provider pack、治理/晋升/sunset是否让新增主流产品无需修改 daemon core。

分级：

- A：完整实施后主流用户仍可能被错误扣费、误用订阅/secret、错误获得本机/合规承诺，或主路径因合同矛盾不可用。
- B：遗漏重要主流协议/产品/部署形态，普通用户仍需理解本应自动处理的 URL/key/protocol/route，扩展仍须改核心，或体验验收不可判定。
- C：不阻断首发主路径的长尾覆盖、证据卫生或文案改进。

输出格式：

1. 第一行 `VERDICT: PASS` 或 `VERDICT: FAIL`。存在任何 A/B 必须 FAIL；只有无 A/B 才 PASS。
2. 报告开始/结束 SHA 与实际读取范围。
3. 按 A/B/C 分节；每项给准确位置、用户/贡献者反例、现有条款为何挡不住、最小修订；依赖当前事实时附官方链接。
4. 不要为凑数重复当前 SHA 已明确关闭的问题；若无某级写“无”。
