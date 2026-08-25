# AI 供给普适接入 v18 生态与体验终审

你是零上下文、只读、对抗性的生态覆盖与产品体验审查者。只审查下列冻结目标，不读取旧 prompt、旧 finding、过程日志或其他 agent 的结论，也不修改目标文件：

- 目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 预期 SHA-256：`c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0`
- 预期行数：42,437
- 预期 bytes：2,672,219
- 仓库 HEAD：`174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`

先独立核验身份并完整读取目标。可以只访问当前官方一手资料核验易变事实；引用必须给直接链接，推断必须标明。不得把“计划尚未施工”计为缺陷，而要判断按本文完整实施后，普通用户是否无需研究配置即可安全接入主流CLI、订阅、官方/三方API、本地模型和bridge。

必须覆盖并主动找反例：

1. 中国大陆与全球主流供给，至少智谱/BigModel、Kimi平台与Kimi Code、OpenCode Zen/Go/Server/ACP、TokenHub、BytePlus、腾讯/百度/阿里、DeepSeek、MiniMax、SiliconFlow，以及OpenAI、Anthropic、Google、Azure、AWS、OpenRouter；
2. Codex、Claude、Cursor、Gemini、Qwen、Grok、Copilot、Kimi等CLI/订阅面，是否严格区分检测到、登录、权益允许、技术可用、费用覆盖和公开支持；
3. OpenAI Chat、Responses、Anthropic Messages及custom Base URL的URL语义、auth正交组合、header、mTLS、stream terminal和模型目录；
4. Ollama、LM Studio、oMLX、llama.cpp、vLLM、SGLang、LocalAI、Jan、Xinference、TGI及local/LAN/cloud边界；CC Switch、LiteLLM、One API/New API、Portkey、Vercel AI Gateway等bridge的route/funding/credential透明度；
5. 首启自动探测、被动提示、主动配置、恢复、MFA/SCA、外部任务、复制粘贴、焦点恢复、费用和数据位置披露是否做到每状态一个真实主动作且不误称零配置；
6. 73行固定minimum、L0/L1/L2、owner扩展、支持页/picker/test matrix/release note是否严格同源，inventory或另一realm/protocol不能冒充支持；
7. 三平台、三locale、伪locale、键盘、screen reader、viewport/presentation/zoom与真实账户旅程是否具有可执行证据；
8. 开源贡献体验、SDK/TCK、声明式pack/代码plugin边界、升级撤销、治理和后续新增provider是否保持低耦合且不会让用户重新学习配置。

严重度：A为会造成错误接入、权益/费用/数据误导、必需主路径不可完成或公开支持假阳性的阻断缺陷；B为会显著损害主流覆盖、交互可用性、无障碍、维护或扩展的实质缺口；C为非阻断改进。只有A=0且B=0才可给`PASS`。

把完整报告写入`research/codex-findings/159-ai-supply-ecosystem-ux-final-closure-v18.md`。报告必须包含冻结身份、覆盖矩阵、必要的一手事实核验、主动反例、A/B/C精确计数和最终`PASS`或`FAIL`。写完后再次核验目标SHA未漂移；只写报告，不修改其他文件。
