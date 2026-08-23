# 03 · 系统架构(Architecture)

> 本篇给出总体架构、组件职责、执行层集成、数据存储、部署拓扑与技术选型。运行机制(记忆、就绪、审批、回叫、成本)见 [04 · 关键机制](04-key-mechanisms.md);模块级分解与接口契约见 [08 · 分模块设计](08-module-design.md);分期见 [05 · 落地与路线](05-roadmap.md)。
> **状态分三行**:**执行层边界 = 已批准**([设计 ADR-001](adr/design/ADR-001-execution-layer.md):以 Hopper 为执行后端,复用现状、锁版本、双路径);**桌面 OS 矩阵 = 已批准**([设计 ADR-004](adr/design/ADR-004-windows-platform.md):Windows 是正式执行面,**P0 工程对齐已收口(2026-08-22 真机全量门禁)**,机制走 [工程 ADR-003](adr/ADR-003-os-adapters.md) 适配层,不变量不放宽;对外口径已由 owner 授权翻转为「Windows / Linux 桌面服务已开放」,同句须披露常驻安装与系统通知仍为 macOS 实现;Linux 未升正式 SKU);**产品载体与部署组合 = proposed**(独立 vs 并入千手,待 owner 拍板,见 05 §2——未来设计 ADR-003 只覆盖载体,不 supersede 设计 ADR-001/004)。

## 1. 总体分层:语音前脑 + 控制面桥 + 执行后端

经三个本地项目(Hopper / OpenClaw-MultiAgent-Kit / OctoDesk)实读评估与 6 路竞品调研(证据见 `../research/`),SayDo **不从零造全栈**——自建范围收缩为三块独特能力 + 一层控制面桥,下游执行复用现成实现(首选 Hopper):

```
┌─────────────────────────────────────────────────────────────┐
│  人(说话 / 听 / 偶尔看屏幕;拍板 / 审批)                          │
└──────△──────────────────────────────────△───────────────────┘
   语音(流式/可打断)                    回叫(语音/桌面/推送/电话)
┌──────▽──────────────────────────────────┴───────────────────┐
│  沟通面(语音前脑)——自建                                        │
│  · 语音引擎:级联(默认)/ S2S(增强),可插拔                       │
│  · Brain(对话大脑):采访 / 就绪自省 / 决策包                     │
│  · 分层记忆 M0-M3 + 项目奠基 + Context Pack 装配                │
│  · 控制台:桌面浏览器页(P0)/ 手机原生外壳(P1)                    │
├──────────────────────────────────────────────────────────────┤
│  控制面桥(voiced daemon)——自建("薄"指不重复执行逻辑,             │
│  但它是一个完整的控制平面:命令服务 / 事件游标+重放 /              │
│  durable outbox/inbox / 审批收据 / 对账 / 启动恢复)             │
│  · Brain 工具执行 / 任务卡渲染 / drop 任务 → 执行后端             │
│  · 消费执行事件(settle 对账后)→ 摘要器 → 回叫策略引擎             │
├──────────────────────────────────────────────────────────────┤
│  执行面(执行后端)——复用,不自建                                  │
│  · 首选 Hopper。当前可用:runners(Claude/Codex)/ worktree      │
│    事件溯源(events.jsonl)/ 崩溃恢复 / usage 预算 / 验收闸门      │
│  · 仅有 schema、无运行时(Hopper M3b/M3c/M3d/WS4 未实现):       │
│    DecisionRequest / NotificationIntent / Command / workflow   │
│  · 借鉴移植:OctoDesk contextPack / OpenClaw-Kit Genesis 规格   │
└──────────────────────────────────────────────────────────────┘
```

**分层的两条铁律**:

1. **Brain 的模型进程可丢弃、无直接执行权。** 语音会话/推理进程随时可死掉重建(会话断了,任务照跑);所有副作用发生在 daemon/执行后端。但注意:**对话域本身不是无状态的**——daemon 持有 durable 的对话证据、意图账本、就绪评估与决策包引用,模型进程只是这些状态的可重建投影(把 Brain 说成"无状态"会漏掉恢复与审计设计)。
2. **语音会话短命,任务长命,生命周期彻底解耦。** 会话是事件驱动的窗口(用完挂起);任务在后台持续执行,靠回叫把人拉回来。

**所有权矩阵(防 split-brain,来自 Codex 红队审查的硬要求)**:task status / approval / budget / retry / notification 每项状态**只能有一个 owner**(执行域归 Hopper,对话域归 daemon);跨边界用 durable 协议连接(DispatchEnvelope + 事件 cursor + 幂等 key),不共用数据库、不直接改对方内部状态。

## 2. 组件职责

| 组件 | 职责 | 关键点 |
|---|---|---|
| **控制台** | **Dashboard(主入口:新对话/选项目继续 + 跨项目总览)**、对话页、任务看板、Demo/diff 展示、审批卡片;侧栏分"当前项目区(随项目切换)+ 全局区"两段(信息架构见 08 §6) | 桌面走 `http://localhost`(secure context 天然满足);手机必须 HTTPS,语音在 iOS 上必须原生外壳(§8);切换项目不打断进行中的语音会话(顶栏常驻会话指示器) |
| **语音引擎** | 双向实时语音,可插拔双引擎(§3) | 对上层暴露统一接口 `say() / on_user_utterance() / interrupt()`,Brain 不感知引擎差异 |
| **Brain(对话大脑)** | 采访式澄清/脑暴、调用工具、口播摘要、把细节推屏幕;决策包三件套由其下属的"决策包工厂"生成(含 Demo) | 两类行为:**准备知识(proactive)** + **回答问题(reactive)**;人格:简短、口语、不念代码 |
| **就绪评估器(独立)** | 只读证据账本判定"够不够开始"(四维 + critical 硬门槛),shadow 记录供校准 | **与 Brain 解耦**:不同模型家族 + 规则引擎,不读 Brain 自辩(04 §2.3 防相关错误链的组件载体) |
| **安全策略引擎** | effect-based 风险计算(S0–S3):effect × 目标 × 数据敏感度 × 身份 × 下游触发 × 成本;verify 白名单校验 | 04 §5.1 的"按效果计算"由此组件承载,禁止按动作名硬编码 |
| **成本账本** | 全链记账:对话(ASR 分钟/token/TTS 字符)+ 执行(读 Hopper usage);estimate → budget → actual | 04 §3 全链成本账本的组件落点 |
| **Context 预研器** | 项目奠基(一次性,重)+ 会话预热(每次,轻) | 让 Brain "开聊前已读过项目";预研只读、可缓存、带 commit 快照 |
| **voiced daemon(控制面桥)** | 执行 Brain 工具调用、组装 Context Pack、drop 任务、消费事件(settle 对账)、发回叫、持有对话域 durable 状态 | 常驻后台;语音会话断了它也活着 |
| **摘要器** | 把 agent 原始事件流压成三层口播摘要 | 统计走纯规则(免费实时);叙事走廉价文本模型(仅关键节点惰性生成);原始事件流**永不**直接进 Brain |
| **回叫策略引擎** | 事件 → 通知升级链 + 免打扰 + 输出仲裁 | 机制见 04 §4 |
| **执行后端(Hopper)** | worktree 隔离、agent 驱动、事件真相源、验收闸门、预算、恢复 | 复用现状能力;流式 steer 等待其 M3b(§5 有降级路径) |

## 3. 语音引擎:可插拔双引擎

"对话感"的判定标准与实现无关:**流式低延迟**(P50 ≤ 1.5s / P90 ≤ 2.5s)、**可打断**、**多轮澄清**。

**引擎 A · 级联管线(默认)**:`麦克风 → VAD → 流式 ASR → 文本 LLM(带工具)→ 流式 TTS → 扬声器`

**引擎 B · Speech-to-Speech(增强)**:OpenAI Realtime(gpt-realtime)原生语音进出、WebRTC 直连、服务端 VAD 与 barge-in;单会话 60 分钟上限,浏览器端须用 ephemeral key。

**为什么级联是默认**(2026-07 经 Codex 核实后的准确理由):

- 成本:在一个代表性用量组合下,OpenAI 全量 S2S 约为低价级联 **5–6 倍**(工程估算,非普适固定倍数——真实差距取决于说话占比/上下文重计费/缓存/模型档,mini 级 S2S 或 Gemini Live 可能接近甚至低于级联)——成本只是理由之一,不再是主要理由;
- **真正的决定性理由是可控性**:级联有**文本中间态**可检查,工具参数可用 Structured Outputs 约束(**GPT-Realtime 系列不支持 Structured Outputs**;τ-Voice 基准显示原生语音 agent 任务成功率 31–51%,远低于文本的 85%),还能精确保存"用户听到了什么"、每段可本地化;
- 正确架构:**S2S 只做"对话呈现层"(听/说/打断),一旦要写文件/精确参数/审批/长任务,把 turn 交给文本 agent**——这也是 GPT-Live 官方方向。

**语音工程硬点**(全部有成熟解法,详见 `../research/codex-findings/03-voice-memory-tech.md`):

| 硬点 | 解法 |
|---|---|
| 回声消除(外放自我打断) | 降级链:耳机/PTT(P0)→ 浏览器 `getUserMedia({echoCancellation:true})` AEC(**可测 baseline,非质量保证**——该约束只是请求浏览器协商,可能被忽略;USB/蓝牙切换、double-talk、独立 TTS 播放路径都会破功,需检查 `track.getSettings()` 实际生效)→ 原生 VoiceProcessingIO(P1 质量承诺)→ webrtc-apm(最后选项) |
| 打断的正确语义 | 不只 cancel:维护 playout watermark,**截断"已听到的历史"**,未播放文本标 unheard、不进对话事实(LiveKit Agents 原生支持,选框架关键点) |
| 轮次检测 | 三层:VAD / 语义 EOU / 打断策略;只用 VAD+固定静音会在中文停顿和英文标识符处抢答。另加**显式轮次边界按钮**兜底 |
| 中英混说 ASR | 术语热词注入(repo 符号/分支名做词汇偏置)+ 复述确认;自建 300–500 条 golden 回归集 |
| 本地化路线 | Apple Silicon 走 MLX 路径(MLX Whisper / Qwen3-ASR;TTS 用 Kokoro MLX);faster-whisper 在 Mac 走 CPU 不走 Metal |

## 4. Brain 工具集(function calling)

Brain 通过工具指挥 daemon,工具集与引擎无关:

| 工具 | 说明 |
|---|---|
| `assess_readiness` | 每轮末调用发起就绪判定;**Brain 只发起,判定由独立就绪评估器执行**(机制见 04 §2,模块见 08 A5) |
| `propose_start` | 就绪时产出决策包(成果预览 + 计划 + Demo),请求 go/no-go |
| `create_task` | 上交对话原话要点;**结构化任务卡由 daemon 侧文本模型起草**(语音模型的结构化输出不可靠,不让它写契约),Brain 拿复述稿逐点口头确认 |
| `confirm_and_dispatch` | 口头确认后派发(drop 进执行后端;参数含**执行模式两档与预授权效果清单**,04 §5.4) |
| `get_status` / `steer_task` / `cancel_task` | 查状态 / 中途追加指令 / 取消 |
| `answer_agent_question` / `approve_action` | 回答 agent 提问 / 审批(仅限 S2 风险,见 04 §5) |
| `explain_result` | 让摘要器按层级出稿(one_liner / walkthrough / decisions),Brain 朗读 |
| `open_on_screen` | 把 diff/日志/PR/文件推到屏幕 |
| `suspend_session` | 主动挂起语音会话 |

工程细节:工具执行可能耗时数秒,instructions 要求 Brain 调用后先接一句自然过渡语;高危工具一律要求复述确认,参数由 daemon 二次校验。

## 5. Agent 执行层:能力矩阵与两级集成

三家 headless 能力(已核实,出处见 06 §2):

| 能力 | Claude Code | Codex | Cursor |
|---|---|---|---|
| 无头执行 / 事件流 | `claude -p` + stream-json | `codex exec --json` | `cursor-agent -p` + stream-json |
| 运行中注入(steer) | [fail] CLI 单向;SDK streaming input 有原语但当前未采用 | [ok] app-server `turn/steer`(exec 不行) | [fail] (cancel 后重发) |
| 运行中交互审批 | [ok] **CLI `PreToolUse` hooks**(Bash + 文件工具统一裁决,S2 在 hook 内同步等待;2026-08-21 实测) | [fail] exec 退化为 never;app-server 有审批回调 | [ok] **CLI hooks**(`beforeShellExecution` deny-only + `--force`,2026-07-23 实测通过;仅 shell 通道,非 shell 出口不可拦——见 07 D8) |
| 跨进程恢复 | [ok] `--resume`(会话按 cwd 哈希存,跨目录失败需自建映射) | [ok] `codex exec resume` / `thread/resume` | [ok] `Agent.resume()` |
| OS 级沙箱 | [fail] (策略级) | [ok] 内置(Seatbelt/Landlock) | 本地无 |

**两级集成,不假装通用**:

- **Tier 1(交互式审批)**:① **Claude Code CLI `PreToolUse` hooks**——Bash 与文件工具统一回连 daemon 裁决,S2 在 hook 内同步等待,fail-closed;生产主流程已接线,最终 live conformance 收口中;② **Cursor CLI hooks(dev 机与当前稳定缺省,2026-07-23 实证)**——`beforeShellExecution` 钩子阻塞回连 daemon 审批(deny-only,fail-closed),仅 shell 通道可拦。两者都**无 live steer**(降级 `queued_delta`/`cancel_resume`,07 D8);
- **Tier 2(预授权 + 事后恢复)**:Codex(经 Hopper `codex exec`)——运行前权限配足,改需求走 `kill_and_resume`(退出后带新指令续接,续接模板强制先 `git status` 自查)。

三种恢复语义严格区分:`answer_permission`(进程不退出)/ `kill_and_resume`(退出续接)/ `cancel`(放弃,worktree 保留)。能力**按运行时探测**,不按模型名假设——例如 Codex 官方已支持 `turn/steer`,但若执行后端(Hopper 现状 runner 是 `codex exec` 一次性 adapter)未接入,实际仍是 kill_and_resume 降级,Brain 会如实提醒。(机械承载 = Hopper capabilities 握手 `steerLevel`,缺键缺省 none;steerTask 对 route=hopper 按分级诚实拒且不落 task_messages——runtime 档判定值自动翻转但 steerTask 仍如实拒,桥出站消费随能力升级批接线——W5a 2026-07-27 实施,09 §13 同口径。)执行模式两档(直达验收/逐步确认)在两个 Tier 上的映射见 04 §5.4——Tier 1 差异落在审批回调策略;Tier 2 的逐步确认 = 步序循环(每步一个 dispatch,步末确认续跑)。

**多 agent 红线**:agent 之间**不直接对话**(会互相附和、绕圈、不收敛),只通过共享黑板(带主题标签的结构化存储)交换信息,由编排器中转;跨 agent 协调决策一律上浮给人。

## 6. 数据与存储

```
执行域(Hopper 所有):任务状态 / events.jsonl 事件真相源 / worktree / 预算
对话域(daemon 所有,SQLite + JSONL):
  projects(id, type, status, workspace…)   # 类型决定执行与验收路径;workspace:{kind: local_folder(P0)|remote_repo(P2 clone 到本地), path}
                                            #   非代码项目默认系统管理文件夹 ~/.saydo/projects/<id>/
  phases(project_id, type, status, package_ref…)  # 规划类项目的阶段边界(S2 场景一等实体)
  sessions / transcripts                    # 会话与转写
  tasks(spec_json, native_session_id…)      # 任务卡=AI 沉淀的产物;native_session_id=恢复钥匙
  questions / approvals                     # 提问与审批(落盘可恢复;审批两类见 04 §2.5)
  memory_events / current_projection        # 记忆事件账本 + 派生视图(04 §1.3)
  artifacts(type, source, version, tags…)   # 统一产物库(记忆 M2)
记忆文件(人可读、人可编辑):
  <workspace>/.saydo/knowledge/   # M1:project/architecture/glossary/decisions + index
  <workspace>/.saydo/artifacts/   # M2:方案多版本/调研资料/报告/文章稿(writing,P2)
  <workspace>/.saydo/sessions/    # M3:会话转写
  ~/.saydo/profile.md             # M0:用户档案(跨项目)
```

真相源边界:执行域以 Hopper 事件溯源为真相;对话域以**记忆事件账本**为真相,Markdown 文件与 SQLite 索引都是可重建投影(源码/Git 永远是代码事实的最终权威,见 04 §1.4)。一切可恢复(daemon 重启后任务和会话都能接上);知识库默认 gitignore(可显式选择提交以团队共享)。

## 7. 部署拓扑与移动连接

三拓扑(产品定位见 02 §7):T1 单机(P0)→ T2 手机沟通 + 桌面执行(P1 主形态)→ T3 手机 + 服务端(P2)。

**手机 ↔ 桌面/服务端连接选型(已定稿,全部证据见 `../research/mobile-desktop-connectivity.md`)**:

1. **T2 自桌面**:优先 **Tailscale 直连**(免自建、最省心);要"QR 配对 + LAN 直连"体验或 T3/过防火墙时,**按 OctoDesk Desktop Remote 的协议模板重实现瘦身版**——LAN WebSocket 直连优先 + 自建 WS 密文中继兜底 + Noise XX E2E(服务端只见密文)。**不用 WebRTC P2P**(OctoDesk 与 Happy 两个产线实现都刻意不用)。
2. **配对/信任/resume/推送隐私五件套直接采用 OctoDesk 设计**(重实现、不 fork 代码):一次性票据带外分发公钥 → Noise XX 互认证 → 桌面人工确认 → 信任设备免确认重连;Ed25519 JWS 签名 resume + 单次 nonce 防重放;推送 payload 只带 opaque id + meta 白名单,token 只存 digest;私钥只在 OS 机密存储(macOS Keychain / Windows DPAPI 或 Credential Manager / 移动端 Keystore;设计 ADR-004)。
3. **注意方向差异**:OctoDesk 的 desktop-remote 是**只读面**;SayDo 要"手机下指令、桌面执行",capability 模型须自定义为双向(保留其 fail-closed + denylist 守门测试做法)。且 OctoDesk 自己的跨设备 sync / AI 流 resume 仍是 503 stub——这块**没有现成实现**,SayDo 要自建。
4. **记忆归属**:M1/M2 + 执行在执行端;手机只做 I/O + M3 会话缓存;M0 可云同步。

## 8. 移动端形态:iOS 语音必须原生外壳

**PWA 承载不了 iOS 语音**(Safari/PWA 后台杀音频、无 VoIP push、后台任务受限)。正解:

- **原生外壳(Capacitor 起步)** + iOS **CallKit + PushKit + 原生 WebRTC**:PushKit 从终止态唤醒(5 秒内必须 `reportNewIncomingCall`),CallKit 提供锁屏来电 UI 并接管音频会话(拿系统级 AEC);
- 回叫即"来电":PushKit 唤醒 → CallKit 锁屏来电 → 接起来就是 AI 语音汇报;
- Android PWA 尚可,但为统一体验同走原生外壳;桌面控制台仍是浏览器页。

## 9. 技术栈选型(P0 最小组合)

逐项决策记录(候选对比/理由/降级路径/spike 清单)见 [07 · 技术选型决策](07-tech-stack-decisions.md);开源候选池与 license 分析见 `../research/open-source-stack.md`。此处为速览:

| 层 | 选型 | 理由 |
|---|---|---|
| daemon | **TypeScript / Node 22+** | 两个 Tier 1 CLI 后端、控制台与 Hopper 桥均可复用同一 TS/Node 进程与协议栈 |
| 语音底座 | **Pipecat**(BSD-2,Python,独立语音进程)+ Silero VAD;**状态:暂定,待打断语义 spike**(Codex 技术报告倾向 LiveKit Agents,07 D2 记录了反向裁决理由与切换条件) | 级联集成最全,一行换 STT/TTS 供应商;经 WS 与 TS daemon 通信 |
| STT / TTS | 云(gpt-4o-transcribe / 火山等)或本地(MLX Whisper / Kokoro) | 可替换 Provider,本地兜底 |
| Brain / 摘要器 | 文本旗舰模型 / 廉价快速文本模型;**供给双后端:API 直连(支持三方 base_url 命名端点)或 本地订阅 CLI(BYOA:codex exec / claude -p / cursor-agent -p,07 D18)**——沉思/评估档推荐走用户已有订阅,省 key 省 token 计费 | 对话与摘要分开计费;对话档**恒 API**(BYOA 已实测判死:每轮 13–23s,07 D18 结案表) |
| 语音前台 | 桌面浏览器页(借浏览器 AEC);移动 Capacitor 外壳 | 零原生开发起步 |
| 执行后端 | **Hopper**(MIT,同栈,1076 单测全绿) | 复用 runners/worktree/事件/预算/恢复 |
| 记忆检索 | SQLite FTS5(BM25)起步,可叠 sqlite-vec | 零运维;代码事实永远 agentic grep 现读、不进知识库 |
| 审批持久化 | 抄 LangGraph interrupt 落盘模型 | 中断点可恢复 |
| 推送 | ntfy(自托管,自带电话)→ P1 迁 APNs/FCM 直连 | 一步到位起步 |
| 成本熔断 | Hopper usage 中枢(+ 可选 LiteLLM 网关) | 真实额度窗口 + cost-aware 派发 |
