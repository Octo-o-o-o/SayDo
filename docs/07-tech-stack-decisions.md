# 07 · 技术选型决策记录(Tech Stack Decisions)

> 本篇把 [03 · 架构](03-architecture.md) §9 的选型表展开为**逐项决策记录**:每项给出候选对比、定稿理由、风险与降级路径、状态。候选池与 license 证据见 `../research/open-source-stack.md`;涉及本地项目的证据见 `../research/local-projects-borrowing-assessment.md`。
> 状态标记:**定稿**(可直接按此实施)/ **待 spike**(方向定了,P0 第一周动手验证)/ **分期**(P1/P2 才引入)。

## 0. 选型原则

1. **复用而非自建**:下游有现成实现(尤其自家 Hopper)就不重写;自建只留三块独特能力 + 控制面桥。
2. **本地优先、可替换**:桌面执行面 = macOS **与** Windows(设计 ADR-004;机制见工程 ADR-003);云服务全部走 provider 抽象,能一行换供应商;每个云组件都要有本地/降级选项。(2026-08-22:W-Win 已收口,官网口径同步翻转为「Windows/Linux 已开放,常驻安装与系统通知暂为 macOS 实现」;此前「官网在 W-Win 收口前仍可写 Windows 暂不支持」的过渡条款作废。)不得倒逼合同只承认 macOS。
3. **license 卫生**:MIT/BSD/Apache 可直接集成;AGPL/GPL(Claude Squad、cmux)只抄机制、不引代码。
4. **能力按运行时探测**:不按模型名/版本假设 agent 能力(steer/审批),探测失败走降级路径。
5. **每引入一个依赖都要有明确回报**:不上编排框架全家桶、不为"以后可能用到"引库。
6. **成本可归因**:每个花钱组件(模型/语音/执行)都要能对账到 project → task → run。

## 1. 总表

| # | 域 | 定稿 | 状态 |
|---|---|---|---|
| D1 | daemon 运行时 | TypeScript / Node 22+ | 定稿 |
| D2 | 语音管线 | Pipecat(独立 Python 进程)+ Silero VAD | 待 spike(打断语义) |
| D3 | 模型分档 | 对话档 / 沉思档 / 廉价档三档 + 异族 evaluator | 定稿(具体模型可配置) |
| D4 | ASR | **火山豆包 bigmodel 流式(sauc)+ 热词偏置**(定档;MLX Whisper 本地选项) | 定稿(2026-07-24;工程 ADR-101) |
| D5 | TTS | **火山豆包 seed-tts-2.0 大模型 · v3 双向流式 WebSocket**(定档)+ 本地兜底按 OS(macOS:Kokoro MLX/`say`;Windows P0:无本地则 ntfy,P1:SAPI/piper) | 定稿(2026-07-23;Windows 投影 2026-08-21 设计 ADR-004) |
| D6 | S2S 引擎 | OpenAI Realtime,仅对话呈现层 | 分期(P2) |
| D7 | 执行后端 | Hopper(现状 task 粒度起步) | 定稿 |
| D8 | agent 接入 | Claude=**CLI `-p` + PreToolUse hooks**(Tier 1,产品目标缺省;原"Agent SDK"传输 2026-08-21 supersede,生产主流程已接线、live conformance 收口中);**Cursor=CLI hooks(Tier 1,当前稳定/dev 缺省;SDK=P1)**;Codex=经 Hopper exec(Tier 2)→ 评估 app-server | 定稿(传输形态 2026-08-21 修订) |
| D9 | 记忆存储与检索 | Markdown 真相 + append-only 账本 + SQLite FTS5 | 待 spike(中文分词) |
| D10 | 审批持久化 | 自建 SQLite 表,抄 LangGraph interrupt 语义 | 定稿 |
| D11 | 通知/推送 | P0 ntfy + 桌面通知 → P1 APNs/FCM 直连 + PushKit/CallKit | 定稿 |
| D12 | 移动外壳 | Capacitor + 自写薄原生模块(音频/推送) | 分期(P1) |
| D13 | 移动连接 | Tailscale(T2)/ 自建 WS 密文中继(T3),不用 WebRTC P2P | 定稿 |
| D14 | 控制台前端 | Vite + React 单页,daemon 静态托管,不用 Electron | 定稿 |
| D15 | 成本与观测 | Hopper usage 中枢 + daemon 会话账本;LiteLLM/Langfuse 按需后引 | 定稿 |
| D16 | 存储 | SQLite(better-sqlite3)+ JSONL 事件流 | 定稿 |
| D17 | 分发形态 | CLI + daemon 手动起步 → macOS launchd(已提前) / Windows CLI supervisor(P0)+ Scheduled Task(P1) → 菜单栏(P2) | 定稿(Windows 投影设计 ADR-004) |
| D18 | 模型供给 | API 直连 + 本地 Agent CLI 订阅复用;thinking/cheap/evaluator 的 CLI 无状态一发一收与 `dialog_cli_oneshot` 文本单发均为正式形态 | 已实施(T18 三轮精化;对话 CLI 仅判死语音实时环与完整多轮工具环,2026-08-11) |

## 2. 运行时与存储

### D1 daemon:TypeScript / Node 22+(定稿)

- **候选**:TS/Node · Python · Go/Rust。
- **理由(历史选型依据)**:Claude Agent SDK 与 `@cursor/sdk` 都是 TS 一等公民;执行后端 Hopper 同为 TS/Node≥22(同栈缝合成本最低);WS/HTTP 生态成熟。**2026-08-21 传输 supersede 后,现行 Claude 走 CLI hooks,本条只解释 daemon 仍选 TypeScript 的原始依据,不声明 SDK 已接线。**Python 的优势集中在语音生态,用 D2 的独立进程解决,不为此把 daemon 换语言。Go/Rust 的纯性能在本场景不是瓶颈。

### D16 存储:SQLite + JSONL + Markdown(定稿)

- **候选**:SQLite · Postgres · 向量库(Chroma/LanceDB)。
- **理由**:单用户本地系统,SQLite(better-sqlite3,同步 API 简单可靠)+ JSONL 事件流(append-only、人可读、崩溃可对账)+ Markdown 知识文件(人可编辑)零运维。Postgres/向量库是服务端思维,P0/P1 不引;T3 服务端形态时再评估。
- **红线**:执行域数据(任务状态/事件)归 Hopper 所有,daemon 不共库(03 §1 所有权矩阵)。

### D17 分发:先 CLI,后常驻(定稿)

P0 `voiced` / `saydo up` 手动启动(开发迭代快);macOS P1 launchd 常驻 + 开机自启;Windows P0 同 CLI supervisor,P1 当前用户 Scheduled Task(设计 ADR-004,不模拟 plist);P2 才考虑菜单栏原生壳(届时评估 Swift menubar vs Tauri,不用 Electron——一个常驻语音 daemon 不需要 300MB 的壳)。

**状态(W2 提前批 #1 已实施,2026-07-26)**:macOS launchd 常驻落地(`com.saydo.daemon` plist:RunAtLoad 重登录自起 + KeepAlive.SuccessfulExit=false 崩溃自启;`just daemon <install|…|deploy>` 命令面);**运行时/开发树分离**(场次① C2):常驻从 `~/.saydo/runtime` 独立树跑收口 SHA(`just daemon deploy`),开发树改码/测试不打断在场语音会话。菜单栏仍 P2。Windows 常驻安装器属 W-Win P1,不在 W2 范围。

**无源码分发决策(2026-08-23)**:预发布先以不可移动 GitHub Release 的版本化 npm tarball 为
唯一字节源,同时提供一次运行(`npm exec --package=<固定 URL>`)与全局安装两种入口。这样三平台
共用一份包、Node 22 负责平台选择,native external(`better-sqlite3`、`koffi`)仍能走 npm 的成熟
安装闭包；Release 同附 SHA-256、npm SHA-512 integrity、条目数和源码构建身份,发布后再在三个
系统从空 cache/home 真安装。npm registry 是同一包的后续便捷别名,由 owner 手动发布后才能写
`npx @saydo/cli@<version>`。Homebrew/Scoop/winget 当前只会重复包装 Node 与同一 tarball、增加撤回
和签名维护面,留到常驻安装器成形后再做；Docker 会隔开本机仓库、登录态 CLI、审批 hooks 与
localhost 控制台,不适合作为默认桌面入口；原生 `.dmg/.msi/.deb` 则等菜单栏/常驻服务和代码签名
一起设计。rc.2 包只含 daemon + Web 控制台,Windows/Linux 前台运行；语音 pipeline 与系统常驻
不在该包内。

## 3. 语音链路

### D2 语音管线:Pipecat 独立进程(待 spike)

- **候选**:**Pipecat**(BSD-2,13k stars,Python)· **LiveKit Agents**(Apache-2.0,11k stars)· 自研薄管线(浏览器采集 → WS → daemon 直调流式 API)。
- **暂定**:P0 用 **Pipecat 作为独立 Python 语音进程**,经 WS 与 TS daemon 通信(daemon 是唯一状态持有者,语音进程无状态可随时重启)。理由:级联集成最全、provider 一行可换、BSD-2 干净;P0 单机 localhost 不需要 LiveKit 的 WebRTC SFU 底座。自研薄管线看似省一个进程,实际要重写 VAD 对齐、分句 TTS、打断管线,省不了。
- **透明声明**:Codex 技术调研(`../research/codex-findings/03-voice-memory-tech.md` §1.5/§5.2)的建议是"LiveKit Agents 暂定 + Pipecat 一周 bake-off"(理由:heard-history truncation 原生、async tools、多管线)。本篇取相反的起点(Pipecat 先行)是**显式反向裁决**,理由是部署更轻、license 更干净、P0 无 WebRTC 需求;**但接受同一判定实验**——spike 用同一套 golden 测试跑双方,输了就换,不为先行选择辩护。
- **spike(定去留的关键)**:验证 Pipecat 能否实现"**打断即截断已听到的历史**"——维护 playout watermark、未播放文本标 unheard 不进对话事实(03 §3)。**若做不到,P0/P1 即换 LiveKit Agents**;切换成本被"语音进程无状态 + 统一 WS 契约"控制在管线层内。
- VAD:Silero(约 30ms,两家框架都内置);语义 EOU 检测 P1 叠加(TEN / LiveKit turn detector 可单抽)。
- **实施状态注(W2 提前批 #6,2026-07-26)**:免手档已落地,但当前管线为自写 WS client(非 Pipecat 框架),P0 VAD 引擎 = **能量 RMS + hangover 状态机**(零依赖、确定性可测;900ms 静音断轮中英混说延长口径)+ 语义 EOU 机械词表(接续词收尾判未完)+ 显式"说完了"按钮三层(10 §3-1);Silero/webrtcvad 升级与阈值调优挂 R-C sweep(条目随该轮登记),嘈杂环境走 PTT/按钮兜底。

### D4 ASR:云端流式 + 热词偏置优先(定档 2026-07-24)

- **候选**:火山引擎流式(中文强、支持热词)· gpt-4o-transcribe · Paraformer/FunASR(开源)· MLX Whisper(本地)。
- **定档 = 火山豆包 bigmodel 流式(sauc),单家起步**(工程 ADR-101 `docs/adr/ADR-101-asr-volc.md`,2026-07-24):60 条中英混说合成语料跑分,热词偏置(`request.corpus.context` 内联)实证 +10 点术语召回(55.4%→65.3%)——"级联相对 S2S 最便宜见效最快的可控性优势"成立;鉴权 = 经典三元组 App ID + Access Token;音频须 wav/pcm(mp3 整段直发尾截断);sauc 大模型不回置信度(09 §10 confidence 已可选化)。本地选项走 MLX 路径(**不用 faster-whisper,它在 Mac 走 CPU 不走 Metal**)。
- **spike 后续**:第二家对比(gpt-4o-transcribe)待 OpenAI key,非阻塞;完整 300–500 条 golden 回归集由 dogfood 真实误听积累,此后作为换 provider 的门禁,单语 WER 不作数。

### D5 TTS:火山豆包 seed-tts-2.0 大模型 · v3 双向流式(定稿 2026-07-23)

- **要求**:流式分句合成(首句先播)、首包 < 500ms、可随时打断、中文自然度可接受。
- **定档 = 火山「语音合成大模型」seed-tts-2.0,v3 双向流式 WebSocket**(2026-07-23 调研 + owner 已有实现验证):
  - 端点 `wss://openspeech.bytedance.com/api/v3/tts/bidirection`(**v3 双向流式**;火山官方已把 v1 `api/v1/tts/ws_binary` 标注"不推荐",v3 为当前最优,边发文本边收音频、最低时延,契合级联对话档打断需求)。
  - **鉴权走 HTTP header**(新方案,区别于旧 appid-in-JSON):`X-Api-Key: <DOUBAO_TTS_API_KEY>`、`X-Api-Resource-Id: seed-tts-2.0`、`X-Api-Connect-Id: <uuid>`——**不再用 `VOLC_API_KEY`+`VOLC_APP_ID` 那套**。
  - 模型 `seed-tts-2.0-expressive`(高表现力,对话/播报首选)或 `seed-tts-2.0-standard`;音频 24kHz;二进制事件帧 ConnectionStarted→SessionStarted→TTSResponse(多包)→SessionFinished→ConnectionFinished。
  - **复用现成实现**:owner 的 `repo-demo-recorder` 技能 `scripts/add-tts-narration.mjs`(`engine=doubao-tts-v3`)已是这套协议的可运行实现(编码/解帧/事件机、`ws` 包 header 注入)——SayDo 的 TTS adapter(E1/A2 语音链)直接移植其 `encodeDoubaoMessage`/`decodeDoubaoMessage`/session 循环,砍掉录屏混音部分即可。
  - 本地兜底链按 OS:macOS = Kokoro MLX(需预热)→ piper → `say`;Windows = 云端主路径,P0 无本地引擎时 TTS=disabled 且回叫降 ntfy(诚实),P1 = piper win 或 SAPI(设计 ADR-004 §4)。"回叫永远发得出声"在 Windows P0 由 ntfy/桌面通知承接,不假装 `say`。
- **端到端 S2S 备选(P2)**:火山另有「豆包端到端实时语音大模型」(S2S-Omni,`api/v3` 端到端)——与 D6 的 S2S 呈现层同归 P2,P0 级联不用。
- **剩余 spike(不阻塞定档,仅调参)**:分句策略下的真实首包延迟、`speech_rate`/`loudness_rate`/音色选型(如 `zh_female_*_bigtts`)的主观质量。

### D6 S2S:OpenAI Realtime,仅作对话呈现层(分期 P2)

- 级联为默认的理由不再主要是成本(S2S 仅贵 5–6 倍),而是**可控性**:GPT-Realtime 不支持 Structured Outputs,τ-Voice 显示原生语音 agent 任务成功率远低于文本(06 §2)。
- P2 接入时的架构红线:S2S 只做听/说/打断,**一旦涉及写文件/精确参数/审批,turn 交给文本 agent**;浏览器 WebRTC 直连 + ephemeral key;60 分钟上限由会话重建机制吸收(04 §3)。Gemini Live 作备选(15 分钟上限更紧)。

## 4. 模型分档

### D3 三档模型 + 异族 evaluator(定稿;具体型号可配置)

| 档 | 用途 | 要求 | 候选(不锁定,配置项) |
|---|---|---|---|
| **对话档** | Brain 实时轮次:采访/答疑/播报 | 流式低延迟、中文口语好、工具调用纪律强;reasoning 低/中 | GPT-5.6 SOL / Fable 5 / Claude Sonnet 5(同行产品实证用 gpt-5.6-sol-max 做采访 Host) |
| **沉思档** | 任务卡起草、决策包/计划生成、奠基提炼、就绪证据账本 | 深推理,异步不阻塞对话;reasoning 高/max | 同上旗舰的 max/thinking 档 |
| **廉价档** | 摘要器叙事、热词抽取、事件打标 | 便宜、快 | mini 级(如 gpt-5-mini 档) |

- **为什么分档**:对话档要的是延迟(用户在等出声),沉思档要的是质量(产出是"合同"),摘要档要的是成本(高频调用)。一个模型通吃三档要么慢、要么贵、要么笨。
- **异族 evaluator(防相关错误链,04 §2.3 的落地)**:readiness 独立评估器与 Brain **用不同模型家族**(Brain 用 GPT 系则 evaluator 用 Claude 系,反之亦然)+ 规则引擎(critical 项硬门槛),只读证据账本、不读 Brain 自辩。**异族判定按"解析后的模型家族"而非供给方式**(BYOA 见 D18:codex_cli 恒 GPT 族;acp 供给族由所选模型决定)。
- 所有模型走统一 provider 抽象(带超时/重试/降级);模型名进配置不进代码。thinking/cheap/evaluator 可消费 API 或 D18 的 agent_cli 一发一收形态;全局 dialog 绑定 CLI 时消费 `dialog_cli_oneshot`,API 绑定仍走完整工具环。

## 5. 执行与适配

### D7 执行后端:Hopper(定稿)

- **候选**:Hopper · 自建薄下游 · OctoDesk ExternalAgentBridge 桥接 · OpenHands Agent Canvas · OpenClaw-Kit CLI 桥。
- **理由**(详见 `../research/local-projects-borrowing-assessment.md`):同栈 TS/MIT、1076 单测全绿、作者唯一在推;runners/worktree/事件溯源/预算/恢复/审批 schema 全有。OpenClaw-Kit 编排正整体并入 Hopper(短期桥接可行、长期没有意义);OctoDesk 无库边界不能当内核;OpenHands 是重载体,与"薄缝合"定位冲突;自建薄下游 = 把 Hopper 已测试过的东西重写一遍。
- **风险与降级**:Hopper 流式 steer(M3b)/ workflow executor(M3d)未实现 → P0 按现状 task 粒度集成,steer 走 kill_and_resume 并由 Brain 如实告知;"隔夜交活"表述为"离席执行到 review 点"(04 §6)。
- **前置动作**:owner 拍板路线后**先出 ADR**(所有权矩阵 + 数据模型归属)再写代码(05 §6)。

### D8 agent 接入路径(定稿)

| Agent | P0 | 演进 |
|---|---|---|
| Claude Code | **CLI `claude -p` 子进程 + `PreToolUse` hooks**(Tier 1:hook allow/deny 裁决 S1-S3、S2 hook 内同步等审批 = canUseTool 等价物;`ask` 在 `-p` 下等同 deny,不可用作 S2 通道;hook 超时 = 落回 Claude 自身权限流,门脚本自返 deny 先于超时);**产品缺省后端**。**supersede 2026-08-21(W5.4 方案 v3.1 §1.2,Claude Code 2.1.220 实测)**:原「不走 CLI(Claude CLI 无 canUseTool,一手实测)」中"无 canUseTool 回调"仍为真,但 CLI 现有 hooks 等价承载;live steer/streaming input 仍 SDK 独有,W5.4 不做 | — |
| Cursor | **Tier 1 dev 机缺省后端 = CLI 订阅态(2026-07-23 实测通过,`research/spikes/cursor-cli-tier1/`)**:`cursor-agent -p --force --trust [--resume <chatId>]` + 任务 worktree 内 `.cursor/hooks.json` 的 `beforeShellExecution` 钩子——无头下钩子**同步阻塞、回连 daemon 等决策、可靠拦截**(canUseTool 等价物,三测 A/B/C 全过);**零 API key、走 Cursor 订阅额度**(owner 该账号 CLI 有额度、API key 无额度)。**关键约束**:CLI 仅工具级钩子生效、**仅 `deny` 可靠**(故 `--force`+"默认 deny 批准才放行",只依赖已验证语义)、JSON **必用 JSON 解析器**(POSIX=`jq`;Windows=Node `JSON.parse`;防 fail-open)、无 live steer(→ 09 `queued_delta`/`cancel_resume`) | `@cursor/sdk`(API key,更强流式/更低延迟)= **后续优化**,脚本备于 `research/spikes/cursor-sdk-tier1/`,owner 想用 API 时切,接口同层(canUseTool 语义抽象,tier1_runs.adapter 预留) |
| Codex | 经 Hopper 现状 `codex exec` adapter(Tier 2) | P1/P2 评估 **app-server**(`turn/steer` + 审批回调)——官方正道,待 Hopper M3b 或缝合层直连 |

适配器模式借 spawner / ai-ide-cli(四方法 + 能力矩阵);Tier 1 执行器接口按 **canUseTool 语义**抽象,后端(claude_code(CLI,2026-08-21 起;原写 claude_sdk)/ cursor_cli / 未来 cursor_sdk)可换,`tier1_runs.adapter` 字段承载;**ACP(Agent Client Protocol)持续跟进不押注**——Zed/JetBrains 共建、25+ agent,若成事实标准则适配层整体切 ACP。

## 6. 记忆与检索

### D9 Markdown 真相 + 账本 + FTS5(待 spike)

- **存储**:M1/M2 记忆域以 **append-only 记忆事件账本**为真相源,Markdown 文件(人可读可编辑)与索引都是派生投影(可重放、可审计,04 §1.3);知识库目录 git 版本化(抄 Letta MemFS:commit message + `/doctor` 审计 + 后台整理)。
- **检索**:SQLite **FTS5(BM25)起步**,零运维;语义召回 P2 再叠 sqlite-vec + RRF。**代码事实永远 agentic grep 现读、不进知识库**(无陈旧税)。
- **奠基**:抄 OpenWiki——git diff 增量刷新 + AGENTS.md 幂等指针块 + 反向吸收既有约定文件。
- **刻意不用**:Mem0/Zep/Cognee 等服务型记忆平台(P0 本地优先,引入 Postgres/图谱违反轻量原则;Graphiti 的 bi-temporal 只抄"失效标记不删除"概念)。
- **spike**:FTS5 默认 tokenizer 对中文不分词——验证 trigram tokenizer vs simple/jieba 分词扩展 vs 入库前预分词,用真实 M1/M2 语料测召回。

## 7. 审批、通知与移动

### D10 审批持久化:自建表 + 抄 interrupt 语义(定稿)

自建 SQLite `approvals` 表实现 LangGraph interrupt 的语义(中断落盘、恢复继续、超时默认终局、四动作 schema)——**不引入 LangGraph 依赖**(我们没有图编排运行时,为一个语义引全家桶违反原则 5)。digest 绑定/单次消费/执行前重校抄 OctoDesk EffectIntent + Hopper DecisionRequest(04 §5.2)。

### D11 通知/推送:ntfy 起步,直连收尾(定稿)

- P0:**ntfy**(自托管,32k stars,自带 `X-Call` 电话 TTS)+ OS 桌面通知(macOS=`osascript`;Windows=toast,失败同构降 ntfy;工程 ADR-003)——一天接通。
- P1(随移动端):**自建 APNs(JWT ES256 HTTP/2)/ FCM(OAuth)直连**,抄 OctoDesk 推送隐私契约(payload 只带 opaque id + meta 白名单、token 只存 digest);PushKit/CallKit 承载"来电式汇报"。
- P2:电话回叫用 Realtime SIP **呼入**模型(外呼要 Twilio + 自建媒体桥,成本运维高,进阶可选)。

### D12 移动外壳:Capacitor + 薄原生模块(分期 P1)

- **候选**:Capacitor · React Native · Swift 全原生。
- **定稿**:Capacitor 起步——最大化复用 web 控制台;PushKit/CallKit/AVAudioSession/原生 WebRTC 以**自写薄原生插件**承载(这几样必须原生,PWA 已被证伪,03 §8)。
- **降级/升级路径**:若音频质量(AEC/路由切换/double-talk)不达标,P2 把**传输与音频层整体换 Swift 原生**(参照 OctoDesk 的做法:原生壳 own 传输,WebView 只渲染),UI 层继续复用 web。
- RN 不选:等于同时维护第三种 UI 技术栈,而我们的 UI 主体已是 web。

### D13 移动连接(定稿,详见 `../research/mobile-desktop-connectivity.md`)

T2 用 **Tailscale**;需要"QR 配对 + LAN 直连"体验或 T3 时,按 **OctoDesk 协议模板重实现瘦身版**(LAN WS 直连优先 + WS 密文中继兜底 + Noise XX E2E,配对/信任/resume/推送隐私五件套照抄设计);**不用 WebRTC P2P/TURN**(OctoDesk 与 Happy 两个产线实现都刻意不用);跨设备 sync/流 resume 自建(OctoDesk 该处是 503 stub,无现成可抄)。

## 8. 前端与观测

### D14 控制台:Vite + React 单页(定稿)

daemon 静态托管的单页应用(麦克风采集、任务看板、决策包/Demo 展示、审批卡片、diff 链接跳转)。选 React 纯因生态与组件供给,无框架偏好负担;**不用 Electron**——浏览器已解决麦克风权限/AEC/渲染,桌面壳不带来新能力。Demo HTML 由决策包工厂(08 A6)按包内容确定性渲染、iframe 沙箱(`srcdoc` + 零 allow)内渲染;沉思档生成为后续增强(2026-08-20 S1 批对齐 08 §R4)。

### D15 成本与观测(定稿)

- 成本:执行域用 **Hopper usage 中枢**(真实额度窗口 + cost-aware 派发);对话域 daemon 自记会话账本(ASR 分钟/LLM token/TTS 字符),汇成 04 §3 的全链账本。**LiteLLM 网关 P0 不引**(链路少,直连 provider 即可),多 provider 计费混乱时再上。
- 观测:P0 结构化日志(JSONL)+ SQLite 查询就够;P1 可选 Langfuse(MIT,本地 docker)做 trace/成本归因。不上 OTel 全家桶。

## 9. 刻意不用的技术(反向清单)

| 技术 | 为什么不用 |
|---|---|
| WebRTC P2P / TURN(移动连接) | 两个产线实现(OctoDesk/Happy)都刻意不用;自建 WS 密文中继更简单可控 |
| 向量数据库(起步) | FTS5 够用且零运维;代码事实 grep 现读无陈旧税;P2 按需叠 sqlite-vec |
| LangGraph / 编排框架 | 只需要 interrupt 语义,不需要图运行时;自建表 + 抄语义 |
| Electron | 浏览器页已覆盖能力;常驻 daemon 不需要重壳 |
| AGPL/GPL 库直接集成(Claude Squad、cmux) | license 传染;只抄机制 |
| faster-whisper(Mac) | 走 CPU 不走 Metal;本地 STT 走 MLX 路径 |
| MCP 作语音 UI 通道 | 同类项目(TalkiTo)实证结论:延迟不适合实时语音交互 |
| 自托管全双工模型(Moshi 类) | VAD 轮替 + barge-in 已满足对话感;工程成熟度不足 |
| Claude CLI 作需 `canUseTool` 的 Tier 1 开发档适配路径 | **本行已 supersede(2026-08-21,W5.4 方案 v3.1)**:2.1.220 的 `-p` 下 `PreToolUse` hooks 可做 S1-S3 裁决(canUseTool 等价物),Claude CLI 已定为 Tier 1 产品缺省传输(D8 行);原弃选理由「CLI 无 canUseTool」的"无回调"仍为真但不再构成弃选依据;live steer 仍 SDK 独有 |
| PWA 承载 iOS 语音 | 后台杀音频、无 VoIP push(已证伪,03 §8) |

### D18 模型供给:API 直连 + 本地 Agent CLI 订阅复用(BYOA)(T18 三轮精化)

> 动机(owner 提出):目标用户多半**已订阅** ChatGPT(Codex)/ Claude(Claude Code)/ Cursor;沉思/评估类调用走这些订阅 CLI,可以把"配 3–4 个 API key + 按 token 计费"降到"1 个 LLM key + 语音 key,重头调用走订阅包月"。Codex 官方支持订阅登录跑 `codex exec`(本机一手实证:`codex login status` → *Logged in using ChatGPT*)。

> **T18 三轮精化合同(2026-08-11,覆盖 T17 现势)**:thinking/cheap/evaluator 的 agent_cli 采用无状态一发一收,是真实可消费的正式供给形态;只有逐槽 self-test 通过后才投影 `active`。全局 dialog 绑定 CLI 时采用文本单发结构化形态 `dialog_cli_oneshot`,按 09 的版本化有序 action envelope 逐项交给 daemon registry;此前“BYOA 对话档判死”只判死语音实时环与完整多轮工具环。项目级 dialog override 仍只允许 API。

**两种供给方式**(E1 Provider 抽象):

| 供给 | 通道 | auth | 适用 |
|---|---|---|---|
| `api` | 直连 HTTP(流式、工具协议可控);**OpenAI 兼容三方 base_url 可配**(`[providers.api.<name>]` 命名端点,多家对比调试;09 §11) | API key(env 引用) | 延迟敏感、高频、需要我方工具协议的调用 |
| `agent_cli`(BYOA) | 无头 CLI **一发一收、无状态**(刻意不用 resume,见纪律 1):`codex exec --json` / `claude -p --output-format stream-json` / `cursor-agent -p --output-format stream-json`(2026-07-23 一手实测:`-p`/`--mode ask`/`--trust`/stream-json 全可用);ACP **常驻协议** P1 再开 | **用户已有订阅登录态**,零 key | 异步、低频、重推理的调用 |

**槽位矩阵(P0 定稿)**:

| 槽位 | api | agent_cli | 说明 |
|---|---|---|---|
| 对话档 | [ok] | [ok] `dialog_cli_oneshot` | CLI 只进入文本单发结构化 action envelope,不进入语音实时环或完整多轮工具环 |
| 沉思档 | [ok] | [ok] T18a 正式形态 | 逐槽真实 self-test 通过才 `active`;失败不伪装成功 |
| 廉价档 | [ok] | [ok] T18a 正式形态 | 结构化请求必须走 schema 通道并严格解析 |
| 评估档 | [ok] | [ok] T18a 有条件武装 | 双 ack 齐备、self-test 通过且 observedModel 合同成立才 `active`;unknown 永不武装 |
| 开发档 | —(本来就是 agent) | [ok] 已是 | Tier 1 后端可换:产品缺省 Claude Code(**CLI hooks 等价,2026-08-21 supersede**;原"Agent SDK"传输作废)/ **dev 缺省 Cursor CLI hooks(订阅态,2026-07-23 实测)**;接口按 canUseTool 语义抽象(D8) |

调用方 → 槽位对照(防实施自造槽位):奠基提炼/任务卡起草/决策包/Demo 生成 → 沉思;摘要叙事/热词/事件打标 → 廉价;就绪深评 → 评估;采访/答疑/播报 → 对话;Hopper 任务卡渲染 = 确定性代码,不占槽。

**对话档 BYOA spike(2026-07-23 本机一手实测;T18 收窄判死范围)**:

| 通道 | 场景 | 实测延迟 |
|---|---|---|
| `codex exec`(gpt-5.6-luna) | 一发一收,effort=low | 13–21s/轮 |
| `codex exec`(gpt-5.6-luna) | 一发一收,effort=max | ~17s/轮 |
| `codex exec resume --last` | **暖会话第二轮** | 17.7s(相对冷启动无收益) |
| `cursor-agent -p`(claude-fable-5-max) | 一发一收 | ~18s/轮;流式首 token 17.6s |
| `cursor-agent -p`(claude-fable-5-thinking-max) | 一发一收 | ~23s/轮 |
| `cursor-agent create-chat + --resume` | **暖会话第二轮** | 78.8s(含一次网络重试;偶发项见下"实现路径"的 cursor 适配注意) |

结论(按 T18 第三轮精化收窄):实测只判死 **CLI 进入语音实时环** 与 **CLI 承担完整多轮工具环**——每轮 13–23s 且 warm session 不改善,不能满足实时口播和 daemon 工具协议。文本单发结构化模式 `dialog_cli_oneshot` 已实施,thinking/cheap/evaluator 的无状态一发一收由 T18a 接线。常驻协议仍只是未来矩阵候选:codex app-server、Cursor SDK/ACP 进入矩阵前须实测首 token/p95/取消/并发/额度/隔离六项。

### D18 实施合同:三槽 CLI 与对话单发

本节的 thinking/cheap/evaluator 条款是 T18a 合同;dialog 文本单发与三形态 console 卡由 T18b 实施。

**本机开发 profile 的 BYOA 配对参考**:

- **缺省配对**:thinking = `cursor_cli`(claude-fable-5-thinking-max,族=Claude)+ evaluator = `codex_cli`(gpt-5.6-luna,effort=max,族=GPT)——异族天然成立,且两档不共享同一家时窗。**互换必须成对**(thinking=codex_cli ⇔ evaluator=cursor_cli fable),否则异族校验拒启动。全 Cursor 配对(fable+luna)异族也成立,但两档共享一家时窗且供给单点,不作缺省。
- dialog 全局绑定 CLI 时走 `dialog_cli_oneshot`,绑定 API 时仍走完整工具环;项目级 dialog override 恒拒 CLI。cheap 可走 CLI schema 通道,不得因其历史口播用途继续强制回落 API。
- evaluator CLI 按双 ack+self-test+observedModel 合同武装;`profile="dev"` 不构成绕过。Gate 0/S3/收据/tripwire 审批安全链不放宽。
- 开发档(Tier 1)接口按 canUseTool 语义抽象:产品目标缺省 Claude Code CLI hooks(**2026-08-21 supersede,原"Agent SDK"传输作废**;生产主流程已接线、最终 live conformance 收口中),**当前稳定/dev 缺省 Cursor CLI hooks 已实测可等价审批(2026-07-23,`research/spikes/cursor-cli-tier1/`)**;live steer/streaming input 是 SDK 独有能力,两后端均以 `queued_delta`/`cancel_resume` 代偿,W5.4 不实现。

**实现路径(T18a 对抗审裁决)**:补强 SayDo 已有 `providers/byoa/` 五层骨架(`cage/runner/parsers/consume/provider`),不搬 OctoDesk 的 Electron bridge 结构。OctoDesk 只读借鉴三项安全细节:取消链、wall+idle 双 watchdog、stderr 与 output cap。cursor 使用独立 raw NDJSON parser,识别顶层 tool_call 与未知事件;未知事件、provider 自报失败或解析失败使该次结果作废。tripwire 必须在流式读到工具事件时立即终止,不得等进程自然退出;已触发 tripwire/unknown/解析或家族失败的 attempt 不得借网络重试洗白。Claude schema 方言使用 `--output-format json --json-schema '<inline JSON>'`,从 envelope 的 `structured_output` 取值;Codex 使用临时 schema 文件,Cursor 使用 prompt 内嵌。探测不能只靠 `cursor-agent status`,必须结合真实一发一收 self-test。

**CLI 适配器验收纪律(fail-closed;T18a 当前合同)**:
1. **笼子(allow 式,canonical argv 见 09 §11 规则 4)——三家不是同一安全等级,按能力分档(2026-07-23 复评 A2/C 采纳,不再统称"纯推理笼")**:

| 供给 | 笼等级 | 语义 | 评估档资格 |
|---|---|---|---|
| claude_cli | **tool-deny(可证零工具)** | `--safe-mode --tools "" --strict-mcp-config --setting-sources "" --permission-mode dontAsk --no-session-persistence`——allow 式全禁、隔离用户 MCP/hooks/settings、会话不落盘 | 双 ack+self-test+observedModel 合同齐备才武装 |
| codex_cli | **write-sandbox(限写不限读)** | `--ignore-user-config --ignore-rules -s read-only --ephemeral -c tools.web_search=false -c model_reasoning_effort=<档> -C <空目录>`——隔离用户 config 的 MCP/feature、关服务端搜索、会话不落盘;**读盘不可挡** | 双 ack+self-test+身份登记豁免齐备才武装 |
| cursor_cli | **ask+tripwire(检测型,最弱档)** | `-p --mode ask --trust` + 空目录 cwd——ask 只读但可读盘、无零工具旗标;**tripwire 是事后检测非事前防止**(tool_call 完成事件里内容已回给模型) | 双 ack+self-test+流内 observedModel 齐备才武装 |

**每次 BYOA/api 调用须落不可变 invocation 记录**(生效 profile、provider、argv digest、cwd、笼档、requestedModel、observedModel、observedModelSource、observedModelExempted、tool 事件计数、所引证据 digest)——审计可证"实际调用与声明绑定一致"。无状态一发一收,刻意砍 resume。唯一例外:奠基/调研任务显式传只读仓 cwd。配置面不提供解笼开关。thinking/cheap/evaluator 的生产与 self-test 调用统一使用逐次新建并清理的空目录 cwd,prompt 头部硬禁命令与读文件;tripwire 在流式读到任何 tool_call 事件时仍立即终止并作废,仅当零正文消费且无 model 冲突时允许在全调用唯一重试预算内用强化禁令重试一次;首发 unknown_event 允许同参再发一次,与 tripwire 共用该预算;再次触发或 schema 仍非法即失败,不得再发第三次请求。POSIX 子进程用独立进程组,直接父进程退出或生命周期 abort 时均收口整个进程树。
2. **异族按模型家族判**:API 与 CLI evaluator 都按实际模型家族判定。CLI evaluator 还须同族 ack 与隔离 ack 双齐、真实 self-test 通过;`observedModelSource="unknown"` 永不武装。familyFixed 供给只有绝对路径与内容 digest 登记一致、且落豁免审计时才可用 `verified_binary_default` 代替流内 model。

下列订阅额度与记账行为随 T18a 三槽 CLI 生效:
3. **额度诚实**:订阅调用记账 `cost_entries.source='subscription'`、`amount=NULL`、`meta_json={provider, plan_window?, requests}`,**显示"订阅额度内(已用 N 次)"**,不显示 ¥0 / "未知" / 剩余额度预测;`[budget].monthly` 与任务 maxCost 只约束 api 计费部分,订阅调用靠墙钟 + 回合数熔断兜底。**限流 = 停下询问,绝不静默转计费,且确认必须有可执行收据**(复评 A5 采纳):触发订阅限流(周/5h 时窗)→ 调用返回 `subscription_rate_limited`(可重试),该槽位进入 `waiting_confirmation`;Brain 按 10 话术问用户"切按量计费(有 key 时)还是等重置",确认落一张**一次性 billing-switch 收据**(绑 sessionId+槽位+目标端点+有效期,单次消费)——**无收据不得产生任何 `source='api'` 计费行**,E1 通用重试/降级禁止跨计费源。限流分类只读取非零退出 stderr 错误块或供应商明确失败 envelope,先按整个错误块/envelope 排除 auth/oauth/login/unauthorized/proxy/disk/filesystem/storage 语境,不得把分散在不同字段/行的普通错误或成功正文误报为订阅额度。P0 不做自动排队重放(P0.5 再议 durable 排队)。**同订阅争用**:当前缺省下 evaluator(codex_cli)与实施期 Codex 评审共享 ChatGPT 时窗,thinking(cursor_cli)占 Cursor 时窗;若按上文成对互换,争用关系随之互换。Phase -1 A② 的额度实测含"执行+评估并发"场景。
4. **ToS 观察项**(不阻塞):订阅授权范围以各家现行条款为准,owner 已确认接受;若条款收紧,一行配置切回 api。Claude Code CLI `-p` 使用本机订阅登录态,额度与限流按真实事件记账,不自动切 API 计费。

**刻意不做**:CLI 不进入语音实时环或完整多轮工具环;不自建订阅额度预测;acp 常驻供给与 resume 暂不做(cursor_cli 无头一发一收不是 acp)。

## 10. P0 第一周 spike 清单(按风险排序)

1. **Pipecat 打断 watermark**:能否截断"已听到的历史"、未播文本标 unheard——定 Pipecat vs LiveKit Agents(D2 的去留开关);
2. **Claude Agent SDK 实测**:streaming input + canUseTool 阻塞审批 + steer 全链路(Tier 1 成立的前提)——**状态注(2026-08-21)**:已改道 CLI 路径结项,`-p` + PreToolUse hooks 的 S1-S3 裁决/同步等待/超时语义均经 W5.4 方案 §1.2 十七项 spike 实证(2.1.220);streaming input 仅可行性 spike(B-6),live steer 不实现;
3. **Hopper 对接现状**:task drop 格式、events.jsonl 消费(cursor/gap/重放幂等)、NotificationIntent 挂语音 transport;
4. ~~ASR golden 集跑分~~ **已结项(2026-07-24,D4 定档)**:60 条种子语料火山单家定档(工程 ADR-101);第二家对比与 300–500 条真实 golden = 换 provider 门禁,非开工门;
5. **TTS 调参(D5 已定档=豆包 seed-tts-2.0 v3,仅调参)**:分句策略下真实首包延迟、音色/speech_rate/loudness_rate 主观质量;
6. **FTS5 中文分词**:trigram vs 分词扩展,用真实知识库语料测召回——定 D9 索引方案;
7. **浏览器 AEC 边界**:外放 + USB/蓝牙麦切换下的回声实测(P0 用耳机/PTT 兜底,但要知道 P1 外放的真实起点);
8. **Cursor 当 Tier 1 后端**(D8,dev 机去 Claude 的前提)——**CLI 变体 2026-07-23 已实测通过**(`research/spikes/cursor-cli-tier1/`:beforeShellExecution 钩子无头触发+deny 拦截+阻塞等待三测全过,零 API key 走订阅);剩余待测项 = ① 真实多步执行任务里 setup(装依赖)/push 的钩子覆盖面 ② `--resume` 崩溃恢复上下文完整性 ③ SDK/API 变体(`research/spikes/cursor-sdk-tier1/`,后续要用 API 时跑,验计费口径)。

## 11. 与分期的映射

| 阶段 | 本篇引入项 |
|---|---|
| P0 | D1/D16/D17(基座)· D2/D4/D5(级联语音)· D3(三档模型)· D18(thinking/cheap/evaluator CLI 一发一收、`dialog_cli_oneshot`、BYOA 三形态 UI)· D7/D8(Hopper + Claude 接入,传输 2026-08-21 改 CLI)· D9(FTS5 起步)· D10(审批表)· D11(ntfy)· D14(控制台)· D15(账本) |
| P1 | D8(Cursor SDK、评估 Codex app-server)· D11(APNs/FCM 直连)· D12(Capacitor 外壳)· D13(Tailscale)· Langfuse 可选 |
| P2 | D6(S2S 呈现层)· D9(sqlite-vec)· D13(WS 密文中继/T3)· 电话回叫(SIP 呼入)· 菜单栏壳评估 |
