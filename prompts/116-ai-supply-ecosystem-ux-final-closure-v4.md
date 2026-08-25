# AI 供给生态与零配置体验最终闭包复审 v4

你是一个全新、零上下文、只读的生态、产品、交互与开源扩展评审者。不要编辑仓库，不要读取目标文档之外的既往评审报告，也不要相信作者在目标文档中的“已回修”表述。

唯一评审对象：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`79ad953a4dbb200100ff5362079928b0e8f0e03837cae1401e6b8b6fe19c27dd`

开始和结束时都核对 SHA；任一不匹配立即停止。必须通读完整文件。可只读核对当前代码，可查厂商官方文档、标准原文或官方仓库固定 commit；当前产品事实不要依赖二手文章。不要因生产代码未实施而报错，评审的是完整实施后的真实用户与贡献者结果。

重点覆盖：

1. 中国大陆普通 API、Token/Coding Plan、国内/国际产品严格分流：智谱 BigModel/Z.AI、Kimi、MiniMax、DeepSeek、百炼、方舟、腾讯、百度、硅基流动等。
2. OpenAI、Anthropic、Gemini API、OpenRouter、OpenCode Zen/Go/Server、xAI/Mistral、AWS/Azure/GCP 等全球 API/IAM；订阅、API、Execution surface 和 rights 是否诚实分开。
3. Codex、Claude Code、Gemini/Antigravity、Kimi、OpenCode、Cursor/Grok/Qwen/Copilot 及区域型 CLI/IDE 是否能被安全自动发现，并在不能合规复用订阅时给出可操作而不误导的下一步。
4. CC Switch Desktop/CLI fork、LiteLLM、One API/New API、Portkey、Vercel/Envoy/Kong/Higress/APISIX 等 bridge 的 route、费用、secret、fallback 与漂移。
5. Ollama、LM Studio、oMLX、llama.cpp、vLLM、SGLang、LocalAI、Jan、Docker Model Runner、Xinference/TGI/Open WebUI：运行、停止容器、冷态、cloud alias、LM Link、LAN owned capacity、端口抢占、有认证 local route和无法 sandbox 的既存进程。
6. OpenAI Chat/Responses、Anthropic Messages、Google GenAI 与完全 custom Base URL；private gateway 未知计量是否能真的连通但不获得官方、隐私、推荐或结算徽章。
7. 自动发现是否不会变成 local CSRF；Docker/Podman stopped journey、detector fair scheduling和 explicit-active sandbox 是否普通用户可达。
8. `connected_verified`/`conversation_ready`/`review_ready`、付费旅程动作上限、事前授权披露与事后 ledger 报告、唯一 primaryAction、zh-CN/en-US ICU parity、pseudo locale、窄屏与无障碍是否一致。
9. `ga-ecosystem-matrix.json` 是否有不可删除的 mandatory baseline、生态层级/发布成熟度、多 auth journey、受信 gate 与无自引用 release binding；新增 provider/protocol/plugin 是否不改 daemon core。

分级：

- A：完整实施后主流用户仍可能被错误扣费、误用订阅/secret、错误获得本机/合规承诺，或主路径因合同矛盾不可用。
- B：遗漏重要主流协议/产品/部署形态，普通用户仍需理解本应自动处理的 URL/key/protocol/route，扩展仍须改核心，或体验验收不可判定。
- C：不阻断首发主路径的长尾覆盖、证据卫生或文案改进。

输出格式：

1. 第一行 `VERDICT: PASS` 或 `VERDICT: FAIL`。存在任何 A/B 必须 FAIL；只有无 A/B 才 PASS。
2. 报告开始/结束 SHA 与实际读取范围。
3. 按 A/B/C 分节；每项给准确位置、用户/贡献者反例、现有条款为何挡不住、最小修订；依赖当前事实时附官方链接。
4. 不要为凑数重复当前 SHA 已明确关闭的问题；若无某级写“无”。
