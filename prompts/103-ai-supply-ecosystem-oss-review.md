# AI 供给生态、开源治理与交互复核

你是只读评审者。不要修改任何文件，不要沿用此前对该方案的 PASS。请独立读取：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 文档 §15 引用的、与你的判断直接相关的官方规范或上游项目资料
- 当前 UI/setup、CLI discovery 与 provider 实现，只用于核对现状和迁移可行性

待评草案 SHA-256 必须是：`7fb98df5defe9f96dcc917067f645e4e7c1cac0148691c0e9f0633a5f964884c`。不一致就停止并报告。

目标是判断：若完整实施，普通用户是否能以最少配置安全使用中国大陆和全球主流官方/三方 API、订阅/CLI、bridge、企业云以及本地部署，同时让外部维护者能够可信扩展生态。

重点攻击：

1. 智谱、Kimi、OpenCode、Codex、Claude、Gemini/Antigravity、CC Switch，以及中国 Coding Plan 的 product/surface/rights 是否仍有误接或越权路径。
2. OpenAI Chat、OpenAI Responses、Anthropic Messages、自定义 Base URL 和本地多协议服务的自动判断/主动配置是否让非技术用户陷入协议、假 key 或模型名猜测。
3. Ollama cloud、LM Studio LM Link、oMLX、vLLM、llama.cpp、SGLang、LocalAI、gateway/bridge 的 transport 与真实 compute/data/billing 是否不会混淆。
4. 对标 Vercel AI SDK、OpenCode/models.dev、LiteLLM、Envoy/Gateway API、Cline、HashiCorp/WASI、ACP、OpenTelemetry、TUF/SLSA/Sigstore 后，采用和不照搬的裁决是否准确且足以支撑长期维护。
5. maturity、conformance、runtime health、rights 四轴和生成式支持清单是否会误导用户；自动发现、被动提示、付费/数据边界、失败恢复是否真正友好。
6. 声明式 pack、第三方 code plugin、TUF 双信任域、SBOM/provenance/signature 和社区贡献材料是否完整、不过度承诺。

仅报告“即使实施完全照文档执行也可复现”的问题。每项用 `A/B/C`、短标题、准确 `file:line`、用户或贡献者反例、为什么现有条款挡不住、最小修订建议。A 级包括明确越权/付费/数据去向误导、主流入口无法开箱、扩展信任边界失效或验收无法判定。若无 A 级，明确给出 `PASS`，并列出仍可作为 B/C 改良但不阻断实施的内容。
