# 06 · 来源、引用与参考资料(References)

> 本文档集的每个关键结论都有出处。本篇分四部分:内部研究文档(一手证据)、已核实的外部事实、外部项目与文献链接、本地项目引用。

## 1. 内部研究文档(`../research/`,按主题)

| 文档 | 内容 | 产生方式 |
|---|---|---|
| `competitive-scan-2026-07.md` | 6 路竞品调研综合:语音交互 / 异步编排 / 需求获取 / 记忆 / HITL 回叫 / 规划 Demo;6 个真缺口 + 抄作业清单 | 6 个 subagent 联网调研(约 100 次检索),2026-07-22 |
| `open-source-stack.md` | 各能力块开源选型(license/star/自托管)+ P0 最小栈 | 联网调研 |
| `local-projects-borrowing-assessment.md` | Hopper / OpenClaw-Kit / OctoDesk Work Steward 实读评估 + 落地映射 | 3 个 subagent 读源码/文档/git,Hopper 实跑测试(1076 单测全过) |
| `ecosystem-analysis-and-fusion.md` | 三方生态对照、能力重叠矩阵、战略选项 A–D | 实读两项目文档 |
| `mobile-desktop-connectivity.md` | 手机↔桌面/服务端连接:业界三路线 + OctoDesk 实现评估 + 选型定稿 | 联网调研 + subagent 读 OctoDesk 15 个核心文件 |
| `business-flows.md` / `.html` | 业务流程文字版 + 8 张 SVG 流程图(数据流/任务流/状态机/记忆装配/回叫审批/前后端分工/部署拓扑) | 按 v1.12–v1.13 方案绘制并经渲染验证 |
| `codex-findings/01-architecture-redteam.md` | 架构红队:相关错误链、就绪判定校准、记忆安全、所有权矩阵 | Codex(gpt-5.6-sol,reasoning max)对抗性审查 |
| `codex-findings/02-hopper-integration.md` | Hopper 集成:成熟度实测、窄闭环 PoC 步骤、字段映射、8 条验收 | Codex 读 Hopper 源码 |
| `codex-findings/03-voice-memory-tech.md` | 语音/记忆技术核实:S2S vs 级联价格、Structured Outputs 限制、打断语义、记忆账本 | Codex 联网核实官方文档 |
| `codex-findings/04-interaction-product.md` | 交互产品:两把钥匙(就绪≠授权)、渐进确认、Plan Delta | Codex 审查 |
| `codex-findings/05-docs-review.md` | 本文档集(2026-07-22 重写版)的完整评审:A/B/C 问题清单 + 遗漏对照表(A 级已回修,B/C 级部分吸收) | Codex 审查,2026-07-22 |
| `codex-findings/octodesk-mobile.md` | OctoDesk 手机↔桌面连接实现调查(证据到 文件:行) | subagent 实读,2026-07-22 |
| `highlight-features-brainstorm.md` | 亮点功能脑暴(80 条候选,允许想错,待 owner 挑选) | 4 subagent × 4 角度,2026-07-22 |

## 2. 已核实的外部事实(设计依据,均经官方文档或一手实测核实)

### 语音与实时 API

1. **OpenAI Realtime API**:speech-to-speech(gpt-realtime 系列)、WebRTC/WS/SIP 接入、单会话 **60 分钟上限**、function calling(`session.update` 注册 / `response.done` 取参)、浏览器需 ephemeral key;**连接/带宽不收费、VAD 过滤的静默不计费**,但每次 Response 重带整个 conversation(后续 turn 越来越贵);**不支持 Structured Outputs**。SIP 原生为呼入模型,外呼需 Twilio + 自建媒体桥。
2. **成本量级(2026-07,工程估算非普适事实)**:在一个 OpenAI 全量 S2S vs 低价级联的代表性用量组合下约 5–6 倍(非数量级);真实差距取决于说话占比/上下文重计费/缓存/模型档,mini 级 S2S 或 Gemini Live 可能接近甚至低于级联——不作固定倍数结论,决策依赖真实 usage trace。Gemini Live 单会话上限 15 分钟。
3. **τ-Voice 基准**:原生语音 agent 任务成功率 31–51%,远低于文本 agent 的 85%——支撑"S2S 只做呈现层、写操作交文本 agent"。
4. **浏览器 AEC**:`getUserMedia({echoCancellation:true})` 只是请求浏览器协商该约束,**无固定算法或效果保证**(可能不支持或被忽略;USB/蓝牙切换、double-talk、独立 TTS 播放路径会失效)——够 P0 baseline、不够质量承诺,需检查 `track.getSettings()` 实际生效;macOS 命令行链路(sounddevice/PortAudio)用不上 VoiceProcessingIO。
5. **Apple Silicon 本地栈**:faster-whisper 在 Mac 走 CPU 不走 Metal;本地 STT 应走 MLX(MLX Whisper / Qwen3-ASR),TTS 用 Kokoro MLX(需预热)。

### Coding Agent 接口

6. **Claude Code**:`claude -p --output-format stream-json`;Agent SDK streaming input mode 支持运行中注入、`interrupt()` 与 `canUseTool` 回调,但现行 SayDo 后端不采用 SDK。**2026-08-21 supersede 旧结论**:CLI 仍不暴露 `canUseTool` 回调,但 Claude Code 2.1.220 的 `PreToolUse` hooks 可对 Bash 与文件工具做 allow/deny,并在 hook 内同步等待 S2 审批,形成等价审批门;CLI 单向且无 live steer。`--resume` 会话按 cwd 约束,跨目录失败。
7. **Codex CLI**:`codex exec --json`(JSONL 事件流)、`--output-schema`、`codex exec resume`;exec 非交互下审批退化为 never、运行中无法注入;**app-server 协议支持 `turn/steer`(带 expectedTurnId)/ `turn/interrupt` / `thread/resume|fork` 与审批回调**——"Codex 不能 steer"的说法已过时,但执行后端是否接入需运行时探测;内置 OS 沙箱(Seatbelt/Landlock)。
8. **Cursor**:`@cursor/sdk`(TS)/ `cursor-sdk`(Python)公测;`Agent.prompt/create+send/resume`、`run.stream()/cancel()`;headless 官方路径为预授权,无审批事件流;本地与云(`bc-` 前缀)双运行时。

### 安全与移动端

9. **NIST SP 800-63B**:声纹不可作为认证因子——支撑"S3 语音绝不放行"(04 §5)。
10. **iOS**:PWA 后台/锁屏杀音频、无 VoIP push;语音 agent 正解是 **PushKit(5 秒内 reportNewIncomingCall)+ CallKit(接管 AVAudioSession 拿系统级 AEC)+ 原生 WebRTC**。
11. **OctoDesk 连接层**(一手实读,证据到 文件:行):LAN WS 直连优先 + 自建 WS 密文中继 + Noise XX E2E(X25519+HKDF-SHA256+AES-256-GCM);QR 一次性票据配对;Ed25519 JWS resume + 单次 nonce;APNs/FCM 直连、payload 只带 opaque id;其 desktop-remote 是只读面,跨设备 sync / AI 流 resume 为 503 stub。

### 同行实证

12. **InfiniSynapse "Podcast interview"**(一位同行实践者的已上线产品;界面事实源自其分享的产品截图——实名与截图获取细节 2026-08-20 移出公开稿):AI 为 Host 采访人;Setup 必填 Topic + Project;开聊前显式预研("Researching the project…");Done speaking 显式轮次;面板含 Library/Export;Backend=codex 且对话/编码模型分离——为"采访范式、context 前置、显式轮次、产出沉淀"提供产品实证。其落点是"聊出想法/内容",SayDo 落点是"把事做完并交付",同源不同游。

## 3. 外部项目与文献(按能力块,均为 2026-07 调研时状态)

### 语音框架
[Pipecat](https://github.com/pipecat-ai/pipecat)(BSD-2,级联首选)· [LiveKit Agents](https://github.com/livekit/agents)(Apache-2.0,打断语义原生)· [TEN Framework](https://github.com/TEN-framework/ten-framework)(VAD/turn detection 可单抽)· Kyutai Unmute/Moshi(全本地路线)· [Claude /voice](https://code.claude.com/docs/en/voice-dictation) · [Codex realtime](https://codex.danielvaughan.com/2026/03/31/codex-cli-realtime-sessions-voice-transcription/)

### 语音遥控 coding agent(同类/最危险近邻)
[Happy](https://github.com/slopus/happy)(23k stars,E2E 加密中继遥控 Claude Code/Codex,架构参照:[How it works](https://happy.engineering/docs/how-it-works/))· **Paseo**(Codex 红队补充识别的最接近近邻:本地 daemon + 多 runner + 语音 + 手机/桌面 + worktree + plan card + 通知恢复,见 `../research/codex-findings/01-architecture-redteam.md` §10.1)· VoiceClaw(薄前台 + `ask_brain` 委托)· VoiceMode · agentcomms / better-call-claude(电话回叫);另注意官方入口已商品化移动沟通与后台执行(Codex 云任务 / Claude Code 移动)

### 编排 / worktree / 适配
[Claude Squad](https://github.com/smtg-ai/claude-squad)(AGPL,抄机制)· Nimbalyst(MIT,iOS 伴侣远程 resume)· [cmux](https://github.com/manaflow-ai/cmux)(22k stars)· Sculptor(容器隔离)· [spawner](https://github.com/0xtiby/spawner) / ai-ide-cli(适配器模式)· [Codex app-server](https://developers.openai.com/codex/app-server) · [ACP(Agent Client Protocol)](https://zed.dev/acp)(Zed/JetBrains 共建标准,跟进)· OpenHands Agent Canvas(自托管控制中心)

### 需求获取 / 规划 / Demo
[GitHub Spec Kit](https://github.com/github/spec-kit)(`/speckit.clarify` 覆盖扫描 + Impact×Uncertainty 选题)· [Kiro](https://kiro.dev/docs/specs/)(类型模板深浅两档)· superpowers brainstorming(一次一问纪律)· [Ask-or-Assume](https://arxiv.org/html/2603.26233v2) / [ReqElicitGym](https://arxiv.org/abs/2602.18306)(学术)· [Devin 2.1](https://cognition.ai/blog/devin-2-1)(置信度绑定行为 + 校准曲线)· [Replit Agent 4](https://replit.com/blog/whats-changed-agent3-to-agent4)(隔离预演→批准合并)· [v0 Design Mode](https://v0.app/docs/design-mode) · agent-ready(就绪 linter)· Vibe Architect(语音+分阶段收敛,形态最像)

### 记忆 / 奠基
[Letta MemFS](https://www.letta.com/blog/context-repositories)(记忆即 git 仓库 + /init + /doctor,最直接对标)· [OpenWiki](https://github.com/langchain-ai/openwiki)(13k stars,git diff 增量 + AGENTS.md 幂等块)· [DeepWiki](https://docs.devin.ai/work-with-devin/deepwiki) · Mem0 / Zep / Graphiti(失效标记、读取期衰减)· [Claude Code memory](https://code.claude.com/docs/en/memory)(索引常驻+正文按需)· [AGENTS.md](https://agents.md/)(事实标准)

### HITL / 回叫 / 熔断
[LangGraph interrupt + Agent Inbox](https://github.com/langchain-ai/agent-inbox)(审批落盘四动作)· [AgentPing](https://agentping.me/)(电话 DTMF 闭环)· [PagerDuty escalation](https://support.pagerduty.com/main/docs/escalation-policies)(升级链范式)· [Claude Code auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode)(拦截≠叫人)· [ntfy](https://docs.ntfy.sh/publish/)(32k stars,自托管推送+电话)· LiteLLM(网关预算硬顶)· Langfuse(成本归因)

### 移动连接
[Tailscale + RustDesk](https://tailscale.com/blog/tailscale-rustdesk-remote-desktop-access)(mesh 直连)· [libretether](https://github.com/JoaaoVerona/libretether) / [freeremotedesk](https://github.com/Teylersf/freeremotedesk)(WebRTC P2P 参照)· [iOS CallKit+WebRTC 2026 指南](https://callsphere.ai/blog/vw4e-ios-callkit-webrtc-ai-voice-agents-2026.md) · [iOS PWA 限制](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)

## 4. 本地项目引用(一手证据源)

| 项目 | 路径 | 关键参考物 |
|---|---|---|
| **Hopper** | `~/WorkSpace/Hopper` | `src/runners/` `src/usage/` `src/worktree/` `src/schemas/platform/`(DecisionRequest/NotificationIntent schema);M3A 域模型设计文档;MIT |
| **OpenClaw-MultiAgent-Kit** | `~/WorkSpace/OpenClaw-MultiAgent-Kit` | Genesis Flow 规格、Spec Triad、Readiness Score、tasks.jsonl 状态机;注意:这是**基于 OpenClaw 的工作流集**,非 OpenClaw 本体;编排正并入 Hopper |
| **OctoDesk** | `~/WorkSpace/OctoDesk` | `electron/services/desktopRemoteHost/`(transport/noise-handshake/pairing)、`server/src/api/desktop-remote-relay/`、contextPack、Work Steward 三段结构、desktop-remote RFC(2026-05-13) |

## 5. 术语表(内部黑话速查)

| 术语 | 含义 |
|---|---|
| M0–M3 | 记忆四层:用户档案 / 项目知识底座 / 累积产物 / 会话工作记忆(04 §1;旧文献写作 L0–L3) |
| SourceSnapshot / VerifiedExcerpt / ClaimSourceVerification | 源快照与引证验证三合同(09 §4.1,2026-07-24):daemon 快照器捕获不可变源快照;摘录供 evaluator 语义判断(数据不是指令);claim 级验证三维独立(integrity 字节一致 / freshness 时效 / critical-support 资格)——服务 04 §2.2-5 critical claim 回读抽查 |
| S3 卡 / WebAuthn platform authenticator | S3 屏幕强认证的生产形态(R-A 2026-07-26,09 §3.3):本机认证(例如 macOS Touch ID/设备密码、Windows Hello 或 Linux passkey/安全密钥)过挑战-断言仪式签单次消费 `S3MergeReceipt`(判别型,generic screen 收据不构成),daemon 本地校验;仅本机受信终端(assertS3LocalAndBound 四断言);requestManualMerge 为无 passkey 降级路径 |
| WritingSettleProof / writingSettleBarrier | writing 窄版的 settle 证明与门(09 §6.1a,R-A 2026-07-26/27):proof 按 kind 判别(与 Tier1SettleProof 并列);barrier 五断言(成稿对账/节 exact-set/验收对账/人评终局在 approve/原子性),缺一不 settle |
| content_done / coding_done | explainResult·摘要判别联合的完成态两值(09 §13/10 §5):writing 成稿用 content_done 话术分支,coding 用 coding_done——完成态按类型判别,不共用句式 |
| readinessSkeleton | 就绪骨架 contracts 单源纯函数(09 §13,R-A 2026-07-26/27):从 02 §5 类型清单机械派生 claims(初值 unknown),会话绑定装配/assessReadiness/proposeStart 复用;空账本恒 gap_critical(fail-closed);covered 命中项 = verified(A3-armed:covered = 现役 confirmed 绑定 key 集,candidate 不计) |
| readinessKey | 就绪候选绑定 key(09 §13 covered 块,A3-armed 2026-07-28):remember 可选参数,带 key 时过来源完整性四闸(词表/来源 daemon 自取/trust 只可 user_stated/projectId 会话自取)落候选;四闸是完整性闸**不是人背书证明** |
| ReadinessBinding | 就绪确认绑定一等实体(09 §9 readiness_bindings,A3-armed):key↔账本 claim 的确认关系,经 confirmReadiness 复述确认环产生(receiptId=user_approved 机械承载,claimDigest=换证可测,snapshotId=§4.1 链,knowledge 轴带 foundationGeneration);同 key 再确认旧绑定自动 superseded |
| confirmReadiness | 就绪复述确认环(09 §13,A3-armed):daemon 机械渲染候选绑定清单(Brain 不得改写)→ TTS+屏幕卡 → 封闭肯定确认 → 事务内升格 confirmed;信息确认环 ≠ dispatch 授权环(10 两环差异);否认 ⇒ 环作废零升格 |
| readinessArmed | 就绪门生产武装态(09 §13,A3-armed):composition root 注入真实 evidence provider(required,缺失 fail-fast)+ 删 null 旁路与空 dims 回退;**armed = 硬门接线,≠ 语义校准完成**(校准回路 04 §2.2-4 独立);回退口径 fail-closed 维护,无 unarmed 回退 |
| 直接发送 / 转写编辑 | 手动档录音结束的双动作(10 §3-7/11 §5.10,2026-07-28 owner 拍板):直接发送=主路径,语音气泡先行进对话、转写异步补挂、Brain 即刻跑;转写编辑=纠错通道,转写只进输入框(AI 看不到),改字发送才进对话;取消=hold 语义零痕迹 |
| 轮次守恒(PTT) | PTT 下每个 turn.done_speaking 恰好产生一个 asr.final(可空;09 §10)——daemon hold 旗与 console 采集意图 FIFO 队列都依赖此配对,不守恒即旗滞留/队列错位(双动作评审 A1) |
| S0–S3 | 审批风险四级:读 / worktree 内写 / 出圈可逆 / 不可逆(04 §5;旧文献写作 L0–L3) |
| `ready_for_review` / `task.done` | 执行闸门结束等验收 / 人验收合并后的终态(04 §4,严禁混用为"完成") |
| settle barrier | 回叫前的状态/产物落盘对账——runner 退出 ≠ 可以叫人 |
| Context Pack | 每次建会话临时拼接的小上下文切片(≠ 持久知识库) |
| 决策包(DecisionPackage) | 就绪时给用户拍板的三件套:成果预览 + 计划(人机分工)+ Demo |
| 两把钥匙 | Epistemic(证据够了)与 Authority(有权者批准)分离(04 §2.5) |
| 直达验收 / 逐步确认 | 执行模式两档:拍板即授权整包(预授权清单)/ 每个出圈动作与步骤边界确认(04 §5.4;S3 门槛与档位无关) |
| taint / provenance | 记忆条目的污染标记 / 来源链(04 §1.4) |
| M3a/M3b/M3c/M3d/WS4 | Hopper 里程碑(以其 SCHEMA-FREEZE-M3A 为准):M3a=平台 schema(已冻结)/ **M3b=command/executor + decision enforcement** / **M3c=usage 记账** / M3d=workflow / **WS4=Console·decision·notification 面**(除 M3a 外均未实现;能力按运行时握手判断,不按里程碑名) |
| Tier 1 / Tier 2 | agent 集成两级按**执行中审批能力**分:Tier 1=交互式审批(Claude Code CLI `PreToolUse` hooks;Cursor CLI `beforeShellExecution` hooks,当前稳定缺省)/ Tier 2=预授权 + kill_and_resume(Codex 经 Hopper exec)(03 §5、07 D8) |
| 封闭肯定词表 | S2 语音确认的机械文法:整句=(语气引导)*(肯定词)+(语气尾)*,否定任意子串 reject、疑问句 unmatched(10 §2.5;sauc 无 confidence 的 P0 防线,2026-07-25) |
| 话术变体三档 | 锁定(逐字)/ 结构锁定表层可变 / 自由池轮换——防"照抄源"成逐字 IVR 又防授权类被自由发挥(10 §1,M6) |
| segment(stable/topical) | Context Pack 切片段位,按 tier 恒定:M0/M1=稳定前缀段、M2/M3=易变段后置(09 §5 规则⑥,M7) |
| parentPackDigest | 续编译时父 pack 入签名域(保纯函数性;重建按存档签名域原样重算,不新开父链)(09 §5,M7) |
| context_snapshot_uses | 快照使用记录表(哪个会话何时用了哪个 pack;与内容表拆分,M1 2026-07-25) |
| worktree | git 工作树,每任务一个隔离目录,主工作区永不被 agent 碰 |
| 公开声明四态 | 对用户/README/官网/console 的能力声明只许 `supported` / `conditional` / `preview` / `unsupported` 之一。不是 09 任务状态,也不是 09 §4.1 `semanticSupport`。定义见 §7 |
| 证据四事实 | `detected` / `logged_in` / `self-test` / 真实端到端 互不等价,不能互相推断,也不能单独把声明升到 `supported`。定义见 §7 |
| LIVE 来源 | 语料上下文模式:该题回放需要当前来源;不等于 connector 已实现。现役 986 个 source 对象本批按 unresolved requirement 安全降级,见 §7 |
| Q0 truth report | PG-01A 对 986 个 source 对象的逐条 machine report;最小字段与 identity 规则见 §7。产物路径 `research/customer-question-corpus/review/23-pg01a-q0-truth-report.json`(C1 的 E 才生成,C0 不预置) |

## 6. 过程与历史(`../history/`)

- `history/PROCESS-JOURNAL.md`:协作全过程档案(每轮的输入、行动、产出、结论)——**过程真相源**;
- `history/voice-coding-framework.Cursor2.md`:主方案 v1.14 终版(含 §8–§17 全部演进记录)——本文档集的前身,内容已重组进 docs/,保留供追溯;
- `history/scenarios/`:三场景 + 三横切 + 设计哲学的需求基线原文(含逐条 checklist);
- `history/legacy-archive/voice-agent-orchestrator.cursor.md`:已合并的同源独立方案(v1.4 时归档);
- 2026-07-22 文档重写前全量快照未进入主仓，保存在迁移冻结冷档;位置与 SHA-256 manifest 见
  `docs/plan/MIGRATION.md`。

## 7. 公开声明与语料证据词义(PG-01A C0,2026-08-31)

> 本节约束**公开声明与语料证据词义**。运行时任务状态、API、权限与模型行为仍以 [09 · 数据契约](09-data-contracts.md) 为唯一形状源;本批不得把下列词写成 09 新枚举,也不得改 CLI/网络/状态机。用户可见文案上限见 [11 §10.3](11-ui-spec.md)。升降级权、证据 TTL、capability ledger schema 归后续 PG-02/E0,本批不建账本平台。

### 7.1 公开声明四态(不是运行时任务枚举)

每条现役公开能力声明必须且只能取下列一态,并绑定**候选**(implementation commit/tree,未形成 I 时为 `n/a`)、**路径**(仓内根或入口)与**条件**(平台/账户/协议/权限/网络;无条件则显式写无)。禁止用 `detected`、`deferred`、`designed` 等词充当第五声明态。

| 状态 | 证据要求 | 公开含义 |
|---|---|---|
| `supported` | 默认入口可达、失败可恢复、required gate 与**真实端到端**证据均已绑定该候选/路径/条件且未过期 | 可称「支持」 |
| `conditional` | 在列明条件下可走通;条件外失败或拒绝有证据 | 必须同时写出条件;条件内可称「可用」,不得省略条件称支持 |
| `preview` | 有实现或可试用入口,但缺默认旅程、required gate 或真实端到端 | 可称「预览」;不得称支持、开箱即用、已通过目标人群验收 |
| `unsupported` | 未实现、未授权、费用 unknown、不安全,或证据不足 | 可称「不支持」或不出现在默认选择器;不得称可用/支持 |

总案 §1.3 的 `inventory_only` / `designed` / `contracted` / `implemented_hidden` / `deprecated` 是未来 capability ledger 候选词,不是本批公开声明。无权利/TCK/新鲜政策证据的 surface,公开声明不得高于 `conditional` 或 `preview`;更常见的安全缺省是 `unsupported`。

下列命名空间禁止混用:

- 09 任务状态(`queued` / `running` / `ready_for_review` / `task_done` 等);
- 09 §4.1 `semanticSupport`(`supported` / `unsupported` / `unclear`,引证语义判断);
- 11 §5.10 `VoiceTransport`(`cloud` / `system` / `unavailable`);
- 首启 probe 的检测/`logged_in`/self-test 结果。

### 7.2 证据四事实(互不等价)

下列是**事实种类**,不是声明态。任一事实不能代替另一种,也不能单独推出 `supported`。

| 事实 | 只证明 | 不证明 |
|---|---|---|
| `detected` | 本机发现名称、安装或配置痕迹 | 已登录、有权、可调用、已付费、已支持 |
| `logged_in` | CLI 或账号呈现登录态 | 订阅权益、零额外费用、工具/结构化输出、协议 TCK |
| `self-test` | 本机 staged/live 自检按当时配置跑过 | 托管 CI、跨平台、真实账户端到端、发布门 |
| 真实端到端 | 绑定该候选/路径/条件的真人、真实账户或真实外部旅程 | 未列出的平台、账户、协议或下一次发布 |

模型响应身份未知仍拒绝;不得把「能连上兼容端点」写成工具或 Structured Outputs 等价。不承诺固定秒数 SLA,也不承诺全本地或所有数据不出设备。

首批**目标**同时包含开发者与普通用户,完整语音非必需。目标人群不是 `supported` 的验收证据:未经真人验收,不得把普通用户写成已开箱即用。文本入口与语音部署分开取证;语音可选不降低 Gate 0、S3、授权或审计要求,也不把未安装/不健康的语音写成支持,更不把文本可用写成全本地离线。

### 7.3 LIVE 语料与 986 source 安全降级

`research/customer-question-corpus` 的 `LIVE` 上下文模式表示:**该题回放需要当前来源**(repo / 系统 / SaaS / 新鲜 Web),必须按对象登记 locator 与字段。这是需求合同,**不是** connector 已实现,也不是公开 `supported`。

现役分母: `research/customer-question-corpus/contracts/live/*.json` 中每一个含 `source_kind` 的 JSON 对象,计数必须为 **986**。本批按 D2 安全缺省把这 986 条降为 **unresolved requirement**,不得当作 connector readiness,不得逐条改写成 `valid`,不得改 600 题范围或标签来伪造通过。`simulations/` 与 CTX fixture 仍是模拟,同样不能升为 connector 证据。

v8 三条发现在本批的 disposition 安全缺省均为 `owner_downgraded_with_public_limit`,不得写成 `closed`:

- `A-RAG-01`:LIVE `required_fields` 含来源对象不可能提供的字段;
- `A-RAG-02`:占位 locator 与「每工具一个来源」被计作已闭合对象;
- `B-VAL-01`:validator/rebuild 只验形状并固化工具投影模板。

### 7.4 Q0 truth report 最小合同

唯一产物路径:`research/customer-question-corpus/review/23-pg01a-q0-truth-report.json`。C0 只定义合同;producer 在形成 I 且跑完 read-only I 门之后由 C1/E 生成,本批 I 不预置绑定自身 SHA 的报告。

顶层最小字段:

- `schema_version`:本报告合同版本,固定字符串 `"1"`。不得与 LIVE JSON 内数字 `schema_version` 混读。
- `implementation_sha`:完整 40 位 I commit OID。
- `implementation_tree`:完整 40 位 I tree OID。
- `expected_total`:整数 `986`。
- `objects`:长度恰好 986 的数组,按 `source_id` 的 UTF-8 字节序升序,无重复、无漏项。
- `aggregate`:`{valid_count, unresolved_count}`,二者之和必须等于 986。
- `dispositions`:恰好覆盖 `A-RAG-01`、`A-RAG-02`、`B-VAL-01`;词表仍是 `closed`、`owner_downgraded_with_public_limit`、`blocks_expansion`。当 `unresolved_count>0` 时,这三项的 `disposition` 必须均为字面 `owner_downgraded_with_public_limit`,不得为 `closed`,也不得为 `blocks_expansion`。

`objects[]` 每条最小字段(标识符英文):`source_id`、`status`(`valid` 或 `unresolved`)、`reason`、`source_kind`、`entity`、`reader`、`locator_check`、`required_field_check`。不得增删这八个键来改分母。

`source_id` 从输入位置确定性导出,公式为:

```text
<source_id> = <repo-relative-contract-path> + "#" + <RFC6901 JSON Pointer>
```

路径用 git 仓内 POSIX 相对路径(如 `research/customer-question-corpus/contracts/live/WRT.json`)。Pointer 指向该 `source_kind` 对象,按 RFC 6901 转义 `~`→`~0`、`/`→`~1`;例:`research/customer-question-corpus/contracts/live/WRT.json#/contracts/0/sources/0`。比较与排序一律用 UTF-8 字节序。现役 986 个对象没有持久化 `source_id`,**不得为了 ID 回写源对象**。

字段取值:

- `source_kind` / `reader`:从该对象抄录(`reader` 对齐 `reader_tools`;多项按 UTF-8 字节序以逗号拼接)。
- `entity`:所属合同 `id` 与 `source_kind` 的稳定拼接 `{contract.id}:{source_kind}`,供题面对账,不回写源。
- `locator_check` / `required_field_check`:`pass` 或 `fail` 或 `unresolved`。`pass` 仅当 locator 能定位具体现势对象(非 `USER-PROVIDED` 占位模板),且 `required_fields` 均可能由该 `source_kind` 提供并与题面实体/reader 相称。
- `status=valid` 仅当两个 check 均为 `pass`;否则 `unresolved`。本批允许对现役对象一律 `unresolved`(reason 可用 `unresolved_requirement_downgrade`);禁止为凑 `valid` 修改 986 对象或 600 题标签。

Q0 报告本身不写 `repo_status`。当 `unresolved_count>0` 时,G-A1 在批 evidence 中只允许 `owner_downgraded_with_public_limit`,禁止 `repo_status=closed`。报告缺失、ID 重复/漏项、总数不等于 986、字段与 validator 不一致时,同样不得把 G-A1 记为 closed。

C1 起,现役公开根按本节四态与 11 §10.3 收紧;Q0 producer/checker 为 `research/customer-question-corpus/check-q0-truth-report.mjs`,本批 I 不预置绑定自身 SHA 的报告。
