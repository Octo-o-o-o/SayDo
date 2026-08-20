# VoiceLoop 开源实施选型清单(2026-07-22)

> 目的:为"具体开始实施"准备好每块能力的**可用开源实现 + 权威介绍文章**,并给出选型建议。数据来自 2026-07 联网调研(附链接),star/license 以调研当时为准,实施前请复核。
> 选型立场(结合 VoiceLoop 定位):**macOS 本地优先、能自托管、下游复用现成实现而非自建、TS/Node daemon 为主**。每块标注"直接可用(用库)/ 抄机制(读实现)/ 仅参考(闭源商业)"。

---

## 1. 语音层(级联 / S2S / VAD / 本地 STT-TTS)

| 项目 | License | Star(约) | 一句话 | 自托管 | 建议 |
|---|---|---|---|---|---|
| **Pipecat** | BSD-2 | 13.4k | 语音 agent 框架第一梯队,级联+S2S 都支持,集成库最全 | [ok] | **首选级联底座**(直接用) |
| **LiveKit Agents** | Apache-2.0 | 11.4k | WebRTC 底座,自带 turn detection/降噪/打断 | [ok] (含自托管 media server) | 备选(要 WebRTC 规模化时) |
| TEN Framework | Apache-2.0(hybrid,有附加限制) | 10.9k | 图编排多模态,TEN VAD / Turn Detection 可单抽 | [ok] (依赖 Agora RTC) | 抄机制(VAD/turn detector) |
| Kyutai Unmute / Moshi | MIT | — | 全自托管级联(Unmute)/ 全双工模型(Moshi) | [ok] | 全本地路线备选 |
| 本地 STT | — | — | faster-whisper / MLX Whisper(Apple Silicon)/ FunASR | [ok] | 本地 STT 直接用 |
| 本地 TTS | — | — | Kokoro / Piper;应急 macOS `say` | [ok] | 本地 TTS 直接用 |
| VAD / turn | — | — | Silero VAD、TEN Turn Detection、LiveKit turn detector | [ok] | 直接用 |
| **OpenAI Realtime / Gemini Live** | 闭源 API | — | S2S 增强引擎 | [fail] (API) | 增强选项(P2) |

**介绍文章**:[6 Best Open-Source Voice Agent Frameworks 2026](https://techsy.io/en/blog/best-open-source-voice-agent-frameworks) · [Pipecat 文档](https://docs.pipecat.ai/pipecat/get-started/introduction) · [LiveKit Agents](https://github.com/livekit/agents)
**小结**:级联首选 **Pipecat**(BSD-2,可 `uv add pipecat-ai`,一行换 STT/TTS 供应商;内置多 agent 消息总线正好对应本方案的共享黑板)。turn detection 抄 TEN/LiveKit 的现成模型。S2S 作增强,不作 P0。

## 2. 语音驱动 coding + 回叫(与 VoiceLoop 最直接同类,优先"抄机制")

| 项目 | License | Star(约) | 一句话 | 建议 |
|---|---|---|---|---|
| **Happy** | 开源 | 23k | Claude Code/Codex 的手机/网页遥控 + 实时语音,E2E 加密,语音层"翻译器"定位 | **重点读**(架构/语音层解耦) |
| VoiceMode(mbailey) | 开源 | ~1.3k | Claude Code 的 MCP 语音对话,可全本地(Whisper.cpp+Kokoro) | 抄机制/可直接试 |
| VoiceClaw | 开源 | 较新 | 薄语音前台 + `ask_brain` 委托任意 agent 大脑 | **抄架构**(前台/后台解耦) |
| agentcomms / better-call-claude | 开源 | — | 任务完成/卡住时打电话/多渠道叫人,等待期 agent 继续干活 | 抄回叫机制 |
| TalkiTo | 开源 | — | 包装终端 I/O 的语音+多渠道层(论点:MCP 做语音 UI 太慢) | 参考 |

**小结**:这块**不建议直接用某个库当底座**,而是精读 Happy(最成熟)+ VoiceClaw(架构最贴合"薄前台+委托后台")的实现,吸收其交互与解耦模式。

## 3. 编排 / 无头驱动 CLI agent + worktree 隔离

| 项目 | License | Star(约) | 一句话 | 建议 |
|---|---|---|---|---|
| **Claude Squad** | AGPL-3.0 | 8.1k | tmux+worktree 管多个 Claude/Codex/Aider/Gemini,后台 yolo | **抄机制**(AGPL 慎直接集成) |
| **Nimbalyst**(原 Crystal) | MIT | — | 桌面 App 并行跑,恢复含完整对话历史,iOS 伴侣远程 resume | **可借鉴/MIT 可用** |
| Emdash | 开源(Electron) | — | ~22 个 CLI provider 统一(Claude/Codex/Gemini/Cursor/Kiro…) | 参考广度 |
| **OpenHands Agent Canvas** | 开源自托管 | — | 自托管开发控制中心,跑任意 ACP agent(本地/Docker/VM/云),含 Automation Server | **重点评估**(可作载体/后端) |
| Sculptor(Imbue) | MIT | — | 用 Docker 容器(非 worktree)隔离每个 agent + 双向同步 | 抄"容器隔离"后端口子 |
| cmux | GPL | 22k | Ghostty 内核终端,OSC 转义+`cmux notify` 给 agent 加通知 | 抄通知机制 |
| **spawner / ai-ide-cli** | 开源 | — | TS 统一适配 Claude/Codex/OpenCode(adapter 四方法 + 能力矩阵) | **直接借鉴适配器层** |
| coder/agentapi | 开源 | — | 把任意终端 agent 变 HTTP API(SSE 事件流) | 备选适配思路 |
| **ACP(Agent Client Protocol)** | 开放标准 | — | Zed/JetBrains 共建,25+ agent,公共 Registry | **跟进标准**(未来适配层) |

**介绍文章**:[9 Open-Source Agent Orchestrators 2026](https://www.augmentcode.com/tools/open-source-agent-orchestrators) · [Best Multi-Agent Desktop Apps 2026](https://nimbalyst.com/blog/best-multi-agent-desktop-apps-claude-code-codex-2026/)
**小结**:适配器层直接借 **spawner/ai-ide-cli** 的模式(别从零写);编排/worktree 抄 Claude Squad + Nimbalyst;**若走"复用现成载体"路线,OpenHands Agent Canvas(自托管 + ACP + Automation)最值得深评**——它和本方案"下游复用"的定位天然契合。注意 Claude Squad(AGPL)、cmux(GPL)传染性 license,直接集成需谨慎,抄机制无妨。

## 4. 需求获取 / 采访 / conversation-to-spec

| 项目 | License | Star(约) | 一句话 | 建议 |
|---|---|---|---|---|
| **GitHub Spec Kit** | 开源(MIT) | 115k+ | SDD 工具链:Spec→Clarify→Plan→Tasks→Implement,30+ agent,138 扩展 | **重点借鉴**(`/clarify` 机制、可自托管 catalog) |
| superpowers brainstorming(obra) | 开源 | 267k 安装 | 设计获批前禁写码的硬门:一次一问、多选优先、逐节批准 | **抄采访纪律** |
| MySpec / SpecTalk / vibe-to-prd | 开源(部分) | — | 采访式 idea→spec;SpecTalk 是纯语音、一次≤3 问 | 抄"一次一问+选项" |
| AWS Kiro | 闭源 | — | 类型决定文档集(feature 三件套/bugfix 单文件)+ 分级门控 | 仅参考(类型模板+深浅档) |

**介绍文章**:[Spec Kit 文档](https://github.github.com/spec-kit/) · [Spec Kit Review 2026](https://vibecoding.app/blog/spec-kit-review)
**小结**:采访/spec 不必自研——**精读 Spec Kit 的 `/speckit.clarify`**(覆盖扫描+Impact×Uncertainty 选题+每题带选项)和 superpowers 的采访纪律,把"规格是 AI 产物"落成 Spec Kit 式的 Q→A 回写 + 版本化 artifact。

## 5. 记忆 / 奠基 / 知识库(与 §4.19 直接对应)

| 项目 | License | Star(约) | 一句话 | 建议 |
|---|---|---|---|---|
| **Letta(MemGPT)** | Apache-2.0 | ~21k | OS 式分层记忆;**MemFS=记忆即 git 仓库** + `/init` 奠基 + `/doctor` 审计 + dreaming 整理 | **最直接对标,重点抄** |
| Mem0 | Apache-2.0 | ~47k | 通用记忆层,ADD-only+检索期衰减,自托管(Postgres+向量) | 可直接用(个性化/L0) |
| Zep / Graphiti | Graphiti 开源 / Zep SaaS | — | 时间知识图谱,失效标记而非删除(bi-temporal) | 抄"失效不删"机制 |
| Cognee 1.0 | Apache-2.0(open core) | ~12k | ECL 图谱管道,单 Postgres,原生 MCP(Claude/Cursor/Codex) | 备选(结构化知识) |
| LangMem | MIT | — | LangGraph 原生轻量记忆 | 仅 LangGraph 栈时 |
| **OpenWiki**(LangChain) | 开源 | 13k | 代码库文档奠基 + **git diff 增量刷新** + AGENTS.md 幂等指针块 | **重点抄**(奠基+增量) |
| DeepWiki(Devin) | 闭源 | — | 代码库自动 wiki + 可引导奠基(`.devin/wiki.json`) | 仅参考(可引导奠基) |
| Aider repo-map / RepoAgent / OpenDeepWiki | 开源 | — | tree-sitter+PageRank 代码地图 / git hook 增量文档 | 抄代码奠基 |
| 检索 | — | — | SQLite FTS5(BM25)+ 可选 sqlite-vec + RRF | **本地检索直接用** |

**介绍文章**:[Best Open-Source Memory Platforms 2026](https://www.opensourceaireview.com/blog/best-open-source-memory-platforms-for-production-ai-agents-2026) · [Mem0 vs Letta vs Zep vs Cognee](https://mcp.directory/blog/mem0-vs-letta-vs-zep-vs-cognee-2026) · [Letta MemFS](https://www.letta.com/blog/context-repositories) · [OpenWiki](https://github.com/langchain-ai/openwiki)
**小结**:VoiceLoop 的分层记忆/奠基与 **Letta MemFS**(记忆即 git 仓库)几乎同构——重点抄它的生命周期(奠基/审计/整理);代码库奠基+增量抄 **OpenWiki**;检索用 **SQLite FTS5** 起步、代码事实永远 agentic grep 现读。这块是"抄机制 + 选用 Mem0/FTS5 组件"混合。

## 6. HITL / 回叫 / 审批 / 熔断 / 通知

| 项目 | License | Star(约) | 一句话 | 建议 |
|---|---|---|---|---|
| **LangGraph interrupt** | 开源 | — | 中断落盘可恢复的原语(`interrupt()`+`Command(resume)`)+ Agent Inbox 四动作 schema | **抄审批持久化模型** |
| Deliberate | 开源(v0.1) | — | LangGraph 审批层:多渠道通知+YAML 策略+超时升级+审计账本 | 参考完整审批层 |
| pushary-langgraph / The Handover | 开源/SaaS | — | 把审批送到手机、fail-closed、durable ledger | 抄"手机审批+fail-closed" |
| HumanLayer(→CodeLayer) | 开源(SDK 停滞) | — | `require_approval` 装饰器拦工具调用 | 仅参考 |
| **ntfy** | 开源 | 32k | 自托管推送,5 级优先级,自带 `X-Call` 电话 TTS | **推送直接用** |
| AgentPing | SaaS(免费档) | — | agent 专用电话告警,chat-first then escalate,DTMF 闭环 | 抄升级链/电话闭环 |
| LiteLLM | 开源 | — | 网关级预算硬顶(`max_budget`+fail-closed) | **成本熔断可直接用** |
| Langfuse | 开源(MIT) | — | agent 可观测/成本归因,有 Claude Code/Codex hooks | 可观测直接用 |
| MCP Elicitation | 协议 | — | 协议级"服务器向用户要输入"(form/url) | 跟进标准 |

**介绍文章**:[LangGraph HITL 教程](https://thehandover.xyz/blog/langgraph-human-in-the-loop-tutorial) · [PagerDuty escalation(范式参照)](https://support.pagerduty.com/main/docs/escalation-policies) · [ntfy publish](https://docs.ntfy.sh/publish/)
**小结**:审批持久化/四动作抄 **LangGraph interrupt + Agent Inbox**(直接对应 §15 缺口 G2);推送用 **ntfy**(自托管、自带电话);成本熔断用 **LiteLLM** 网关;升级链范式抄 PagerDuty/AgentPing。

## 7. 规划 / Demo / 就绪 / 原型

| 项目 | License | Star(约) | 一句话 | 建议 |
|---|---|---|---|---|
| **OpenHands Agent Canvas** | 开源自托管 | — | plan mode + 自托管控制台 + ACP;可作载体 | **重点评估** |
| bolt.diy / Open Lovable / Dyad | 开源 | — | prompt→可交互 app 预览(bolt.new 的开源版) | 抄 demo-first 生成 |
| agent-ready | 开源(早期) | — | 50ms 判定"工单够不够格开工"的确定性 linter | **抄就绪清单**(§4.20) |
| Open Deep Research(LangChain) | 开源 | — | `clarify_with_user` 节点输出 need_clarification 布尔,防澄清死循环 | 抄收敛机制 |
| Vibe Architect | 开源(早期) | — | 语音输入→Propose/Refine/Lock 分阶段收敛→spec+预览 | **形态最像,重点读** |
| Dify / Flowise | 开源 | — | 可视化 LLM 应用/流程编排 | 备选(可视化) |
| v0 / Replit / Stitch / Lovable / Figma Make | 闭源 | — | 原型优先、隔离预演→批准合并、diff 确认 | 仅参考(Demo 与实现同源思路) |

**介绍文章**:[OpenHands Agent Canvas](https://docs.openhands.dev/openhands/usage/agent-canvas/overview) · [8 Best Open Source AI App Builders 2026](https://www.totalum.app/blog/open-source-ai-app-builder-self-hosted-alternatives)
**小结**:就绪清单抄 **agent-ready**;收敛机制抄 **Open Deep Research**;Demo 生成可复用 **bolt.diy** 类;**Vibe Architect** 形态最像本方案(语音+分阶段收敛+预览),值得精读。

---

## 8. P0 最小可跑技术栈(起步推荐)

一个能在 macOS 本地跑通"语音对话 → 派 Claude Code → 回叫"闭环的最小组合,尽量用成熟开源、少自研:

| 层 | 选型 | 理由 |
|---|---|---|
| daemon | Node/TS(或 Python) | 与 Claude Agent SDK / Cursor SDK 一等公民对齐 |
| 语音引擎 | **Pipecat**(级联)+ 本地/云 STT-TTS + Silero VAD | BSD-2、集成最全、一行换供应商 |
| 语音前台形态 | 浏览器控制台(getUserMedia 借浏览器 AEC) | 免原生开发、天然解决回声 |
| Agent 适配器 | 借 **spawner/ai-ide-cli** 模式,先只接 Claude Code(SDK streaming) | 下游复用,不自研 |
| worktree/隔离 | 抄 **Claude Squad/Nimbalyst** 的 worktree 供给 | 成熟答案 |
| 记忆/奠基 | `.voiceloop/knowledge/` + **SQLite FTS5**;奠基抄 **OpenWiki**,生命周期抄 **Letta MemFS** | 本地、可 git、防陈旧 |
| 审批/中断 | 抄 **LangGraph interrupt** 的落盘可恢复模型 | 补 §15 缺口 G2 |
| 回叫/推送 | **ntfy**(自托管,含电话) | 一步到位 |
| 成本熔断 | **LiteLLM** 网关 `max_budget` | 防无人值守烧钱 |
| 采访/就绪 | 抄 **Spec Kit `/clarify`** + **agent-ready** 就绪清单 | 不自研 |

**一句话**:VoiceLoop 的三块独特能力(语音/记忆奠基/采访决断)需要自己设计整合,但**每一块的底层组件和参考实现都已开源可用**——P0 更多是"选型 + 集成 + 抄机制",而非从零造轮子。这也再次印证 §13/§15 的重定位判断。

## 附:开源 vs 闭源快速判定

- **可直接用(开源库/自托管)**:Pipecat、LiveKit Agents、本地 STT/TTS、Mem0、Cognee、Letta、ntfy、LiteLLM、Langfuse、SQLite FTS5、spec-kit、OpenHands Agent Canvas、bolt.diy、Nimbalyst(MIT)。
- **抄机制(读实现,license 传染慎集成)**:Claude Squad(AGPL)、cmux(GPL)、Happy、VoiceClaw、OpenWiki、Letta MemFS、agent-ready、Open Deep Research、Vibe Architect、LangGraph interrupt。
- **仅参考(闭源商业)**:OpenAI Realtime/Gemini Live、Kiro、DeepWiki、Devin、v0/Replit/Stitch/Lovable/Figma Make、Cursor/Codex 云。
