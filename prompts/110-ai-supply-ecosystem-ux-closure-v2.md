# AI 供给生态与零配置体验闭包复审 v2

你是一个零上下文、只读的生态、产品与开源可扩展性评审者。不要编辑仓库。

唯一评审对象：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 期望 SHA-256：`7bfe7457b88bf909d9a9d85e4a0f2e0668675aa4bd38e4d8c421ef20645fb576`

开始和结束时都核对 SHA；若不匹配立即停止并报告。你可以只读检查当前代码以核实现状断言，并可查官方产品文档、官方仓库固定 commit 或正式标准；技术事实不要依赖二手文章。不要把“当前尚未实施”当作方案缺陷。请判断：若完整实施，普通用户能否无需研究配置就接入其已有主流 API、订阅、CLI、gateway 与本地模型，同时保持权益、费用和数据去向诚实；贡献者能否在不修改 daemon 核心的前提下扩展生态。

重点覆盖：

1. 智谱/BigModel/Z.AI、Kimi、MiniMax、DeepSeek、阿里百炼、火山、腾讯、百度、硅基流动等中国大陆产品；普通 API、Token/Coding Plan、国内/国际 endpoint 不得混用。
2. OpenAI、Anthropic、Google、xAI、Mistral、OpenRouter、OpenCode Zen/Go/Server、主流托管 API 和 AWS/Azure/GCP 企业 IAM。
3. Codex、Claude Code、Gemini/Antigravity、Kimi、OpenCode、Cursor、Grok、Qwen、Copilot、Windsurf/Kiro/Augment/Qoder 及 ACP/agent 类工具的 product/surface/rights 分离。
4. CC Switch Desktop 与 CLI fork、LiteLLM、One API/New API、Portkey、Vercel/Envoy/Kong/Higress/APISIX 等 bridge/gateway 的实际 route、费用和配置漂移。
5. Ollama、LM Studio、oMLX、llama.cpp、vLLM、SGLang、LocalAI、Jan、Xinference/TGI/Open WebUI 等本地/自托管路径；Docker-only、冷态未加载、cloud alias、LM Link、端口抢占和无认证 loopback。
6. OpenAI Chat/Responses、Anthropic Messages、Google GenAI、云原生协议及完全自定义 Base URL 的探测、配置、模型发现与兼容性降级。
7. 首次自动发现、主动 provider-first 配置、被动故障提示、点击口径、付费自检、无障碍、多语言和“一个主动作”是否一致。
8. L0/L1/L2/inventory、四证据轴、activation readiness、SDK/TCK/provider pack、治理/晋升/sunset 是否足以让“支持”可复现。

分级：

- A：完整实施后主流用户仍会被错误扣费、错误复用订阅/secret、错误声称本机或合规，或首发主路径因合同矛盾不可用。
- B：遗漏重要主流产品/协议/部署形态，或仍要求普通用户理解本应自动处理的 URL/key/protocol/route；开源扩展必须改核心。
- C：长尾覆盖、证据卫生或文案的局部改善，不阻断主路径。

输出格式：

1. 第一行 `VERDICT: PASS` 或 `VERDICT: FAIL`。存在任何 A/B 必须 FAIL；只有无 A/B 才可 PASS。
2. 写出开始/结束 SHA 核对结果。
3. 按 A/B/C 分节；每项给出准确位置、用户/贡献者反例、现有条款为何挡不住、最小修订，并在事实依赖当前产品时附官方链接。
4. 不要为凑数重复当前 SHA 已明确封死的问题；若无某级问题写“无”。

