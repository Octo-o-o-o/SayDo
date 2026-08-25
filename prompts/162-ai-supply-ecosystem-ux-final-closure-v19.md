# AI 供给普适接入 v19 生态与体验终审

你是全新零上下文、只读、对抗性的生态覆盖与产品体验审查者。只审查下列冻结目标，不读取任何旧 prompt、旧 finding、过程日志、journal 或其他 agent 的结论，也不修改目标文件：

- 目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 预期 SHA-256：`f965ee3e63fdd0c0242d8fe58cc4574dbfcc04962322851e434d6195378d5ea7`
- 预期行数：44,555
- 预期 bytes：2,797,930
- 仓库 HEAD：`174ab48895aa1e4a6c6b42b9c74187f20efc3cfd`

先独立核验身份并完整读取目标。可以只访问当前官方一手资料核验易变事实；引用必须给直接链接，推断必须标明。不得把“计划尚未施工”计为缺陷，而要判断按本文完整实施后，普通用户是否无需研究配置即可安全接入主流CLI、订阅、官方/三方API、本地模型和bridge。目标文件很长，不得抽样或只读摘要。

必须覆盖并主动找反例：

1. 中国大陆与全球主流供给，至少智谱/BigModel、Kimi平台与Kimi Code、OpenCode Zen/Go/Server/ACP、TokenHub、BytePlus、腾讯混元、百度千帆、阿里百炼、DeepSeek、MiniMax、SiliconFlow，以及OpenAI、Anthropic、Google、Azure、AWS、OpenRouter；产品、realm、协议和权益不可互相冒充；
2. Codex、Claude、Cursor、Gemini、Qwen、Grok、Copilot、Kimi、OpenCode等CLI/订阅面，是否严格区分发现、安装、登录、权益允许、技术可用、费用覆盖、overage和官方公开支持；command-backed auth是否默认零执行并要求逐次知情授权；
3. OpenAI Chat Completions、OpenAI Responses、Anthropic Messages及custom Base URL的URL拼接、auth正交组合、header、mTLS、stream terminal、error、model catalog和能力适配；不得用“OpenAI兼容”掩盖Messages或Responses差异；
4. Ollama、LM Studio、oMLX、llama.cpp/llamafile、vLLM、SGLang、LocalAI、Jan、Xinference、TGI、GPT4All Local API及local/LAN/cloud边界；AnythingLLM、Msty、Cherry Studio、Chatbox、LobeChat、Open WebUI等客户端配置只能作为显式导入候选，不能冒充运行时支持；
5. CC Switch、LiteLLM、One API/New API、Portkey、Vercel AI Gateway、Helicone及Envoy/Kong/Higress/APISIX等bridge/gateway的route、funding、credential、数据边界和漂移透明度；无公开authority时是否诚实降级；
6. 首启自动探测、被动提示、主动配置、恢复、MFA/SCA、外部任务、复制粘贴、焦点恢复、费用和数据位置披露是否做到每个状态一个真实主动作；自动阶段是否安全、安静、可取消且不执行未知程序或读取secret；
7. 73行固定minimum、L0/L1/L2、owner append-only扩展、支持页/picker/test matrix/release note是否严格同源，inventory、客户端配置或另一realm/protocol不能冒充GA支持；
8. macOS/Linux/Windows、`zh-CN`/`en-US`/真实RTL `ar-SA`、独立`en-XA`、键盘、screen reader、3 viewport/presentation/zoom/modality形成的972格矩阵以及真实账户旅程是否具有可执行证据；
9. 开源贡献体验、Connector SDK/TCK、声明式pack/代码plugin边界、升级撤销、治理、性能隔离和后续新增provider是否低耦合；实现者是否能从本文直接生成preset、文案、发现规则和support claim，而不是重新手工配置；
10. 最终承诺是否同时满足“常见服务最方便使用”和“未知/禁止权益不误导”，推荐、fallback和no-new-spend是否在订阅、本地和API混用时保持费用诚实。

严重度：A为会造成错误接入、权益/费用/数据误导、必需主路径不可完成或公开支持假阳性的阻断缺陷；B为会显著损害主流覆盖、交互可用性、无障碍、维护或扩展的实质缺口；C为非阻断改进。只有A=0且B=0才可给`PASS`。每个finding必须引用准确行号、给出真实用户反例并说明最小根因修复；不要把“未来可增加更多长尾名字”本身当成B。

把完整报告写入`research/codex-findings/162-ai-supply-ecosystem-ux-final-closure-v19.md`。报告必须包含冻结身份、覆盖矩阵、必要的一手事实核验、主动反例、A/B/C精确计数和最终`PASS`或`FAIL`。写完后再次核验目标SHA未漂移；只写报告，不修改其他文件。
