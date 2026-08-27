# DeepSeek Harness 借鉴评估

> 对方 repo:`~/WorkSpace/Reference/deepseek-harness`
> 对方版本:git `47f943859bef60e4160492346772ded9b24f765a`(`0.1.0-rc.5`, 2026-08-13, `Merge pull request #2519 ... feat/npm-public`)  
> 对方 license:**MIT**(`LICENSE` 原文, Copyright (c) 2026 DeepSeek);第三方声明见对方 `THIRD_PARTY_NOTICES.md`(Cordis 全家 MIT;ACP SDK Apache-2.0;Claude Agent SDK 见其 README)。  
> 本产品基线:SayDo `c5148ab597ba08bd07aff7045418326ce263a180`(`feat/t20-fusion-layout`, 与 `main` 同 tip)  
> 既有评估:仓内无 deepseek-harness 评估;同类基线为 `research/local-projects-borrowing-assessment.md`(Hopper / OpenClaw-Kit / OctoDesk, 2026-07-22)。本文为**新评估**,不 supersede 那份「执行后端首选 Hopper」结论。  
> 互联网补充:官方 GitHub `deepseek-ai/deepseek-harness`(开源当日约 2.6 万 star);DeepSeek API 更新日志 2026-07-31 写明 V4-Flash 公开基准的 Code Agent 任务用 **DeepSeek Harness 极简模式**测试(max 档, topp=0.95, temperature=1.0);2026-08-13 与 V4-Pro GA 同日开源。勿与第三方同名仓(HenryZ838978 的协议探针库、tylerbuilds 的本地 CLI)混淆。

## TL;DR（值不值得借 + 第一刀是什么）

**值得借理念与工程纪律,不值得借框架本体,更不值得拿它替换 Hopper 或 voiced daemon。**

DeepSeek Harness(DSH)是 DeepSeek 官方的 coding-agent 运行时:把模型接到文件系统、终端、网页、技能、子代理,并用 Cordis 把「模型适配器 / 工具注册 / Session 日志 / Agent Loop 本身」全部做成可卸载插件。它是 Claude Code / Codex 这一档的**工作台**,不是语音前脑。SayDo 已经选定「语音前脑 + 控制面桥 + Hopper 执行后端」(`docs/03-architecture.md` §1);DSH 与 Hopper 是同类下游,与 Brain/daemon 不是同类产品。

第一刀(最小价值闭环,不新开执行后端批):

1. **模型可见 ⟺ 已登录**:给 Brain 对话环加「发给 LLM 的 messages 必须能从 session transcript 重建」的运行时断言。
2. **组装后 transcript snapshot**:Brain 工具环 / Gate0 / 审批路径用真实入口的 keyless 回放钉死,禁止只靠手挂 mock 绿测。
3. **工具管线单调 deny + 诚实报告笼子强度**:对话工具与 BYOA cage 把「声称只读 / 零工具」写成可断言的 enforcement 报告,deny 不可被后续步骤翻回。
4. **子进程环境变量 scrub**:spawn CLI 时剥离 `KEY|PASSWORD|SECRET|TOKEN` 与 SayDo 内部密钥,显式传入除外。

这四条都不接 Cordis、不改 Hopper 锁版本、不碰 Gate 0 / S0–S3 / M0–M3。是否把 `dsh --profile headless` 收成第三个 BYOA cage,上浮 owner,且排在 PLAN-2 的 W5 剩余与 R-B 之后。

裁决计数:**A×5 / B×15 / C×22**(共 42 条)。

## 对方是什么(亮点,先于清单)

读代码与官方文档后,DSH 的真正亮点不在「又一个能改文件的 agent」,而在下面几条**做成硬不变量的设计**:

1. **一切皆插件,包括循环本身。** `docs/architecture.md:9-13` 写明:没有特权核心可打补丁;模型适配器、工具注册、Session 日志、Agent Loop 都是 Cordis 插件,卸载即回滚 effect。同一套脊柱可组装成 Web UI(`npx @deepseek-ai/dsh web`)、Headless、ACP、JSON-RPC/Python SDK;TUI 刻意外置为 `turtle-ui` 插件。这是「时空可组合」论文([cordiverse/paper](https://github.com/cordiverse/paper))在产品里的落地:注册是可逆 effect,不是全局单例。
2. **Model-visible ⟺ logged。** 任何进入模型请求的内容必须能从 append-only `SessionEvent` 重建;`packages/core/agent-loop/src/invariant.ts:19-54` 在 `llm/stream` 上 prepend 断言:请求冻结、`deriveMessages()` 与实发 messages 字节级一致、header 字段与 `request/header` 事件一致。这比「我们有 JSONL 日志」严一个数量级。
3. **Capability seam 三角色。** 一项能力 = Service Definition + Provider + Consumer,缺一不称 seam(`docs/glossary.md:7-9`)。换文件系统/子进程 provider,Bash、PTY、LSP 跟着走,不必为每个工具分叉。这是「换执行世界」而不是「换一个函数」。
4. **沙箱 fail-closed,并诚实报告 partial。** `SandboxMode` 只有 `read-only | workspace-write | danger-full-access`(`packages/sandbox/sandbox/src/index.ts:24-29`);无 backend 抛错而非放行;Windows ACL / 旧 Landlock ABI 标 `enforcement: 'partial'`,不假装与 bwrap 同等。词汇表明确**只管文件写效应**,不管网/进程——边界写进类型,而不是注释里道歉。
5. **测试政策把「绿单测、坏产品」写成事故。** `docs/postmortem/0001-*.md`:ACP 178 个单测全绿、100% 行覆盖,Zed 一连就炸,因为测试手挂插件绕过了 Loader。此后强制:真实入口、已构建产物、keyless 组装 snapshot、e2e 断言外部世界(重读文件)而非模型自报(`docs/testing.md:21-35,47-49`)。
6. **它是模型公司自己的 harness。** 2026-07-31 API 更新日志用 DSH 极简模式跑 V4-Flash 的 Code Agent 公开基准。开源的是他们内部打榜与产品化的同一套运行时,不是演示包装。Developer Preview 同时意味着**破坏性变更是官方承诺**,不能当稳定下游。

理念上,DSH 把「agent 产品 = 模型 + 一组可替换缝」写到了配置文件(`cordis.yml` / profile / bundle / `--patch`)。SayDo 把「agent 产品 = 语音前脑合同 + 不可 bypass 的安全门 + 锁版本执行后端」。两者都反「神秘核心」,但约束对象不同:DSH 约束的是**可组合性**,SayDo 约束的是**不可越权**。

## 能力登记表

状态口径:已有 / 已有可增强 / 部分有 / 没有 / 文档有代码无。裁决:A 直接借 / B 改造借 / C 不借。对方位置与本产品证据均为本会话实读。

| 编号 | 能力/设计 | 对方位置 | 本产品现状 | 裁决 | 理由 |
|---|---|---|---|---|---|
| D-01 | 模型可见 ⟺ 已登录;LLM 请求必须能从 session log 重建 | `packages/core/agent-loop/src/invariant.ts:19-54`;`docs/architecture.md:92-96` | 部分有。`SessionManager` 落盘 `TranscriptTurn` JSONL(`packages/daemon/src/session/manager.ts:1-10,94+`),但 `runDialogTurnWithTools` 在内存数组上续跑(`dialogLoop.ts:623-649`),**没有**「实发 messages == 由 transcript 派生」的断言 | **A** | 与契约/审计纪律同向;不引 Cordis;可在 daemon 对话环加重建检查 |
| D-02 | 工具管线 pre-execute → 单调 guard → execute → post;deny 不可翻回 allow | `packages/core/tools/src/index.ts:1100-1183,1459-1598`;`docs/tool-execution-pipeline.md` | 部分有。`ToolRegistry.dispatch` + `decideCommand` 已 fail-closed(`registry.ts`,`tier1/gate.ts:36-70`),但对话工具没有瀑布拦截点,也没有「后序 listener 不得翻 deny」的显式单调性 | **A** | 把现有 fail-closed 写成管线不变量,防止以后挂 hook 时出现「先拒后放」 |
| D-03 | Inbox 三类输入:followup 醒下一 turn、steer 醒下一 step、inject 不醒 | `packages/core/agent/src/inbox.ts:25-50`;`agent-loop/.../agent.ts:113-132` | 部分有。执行侧有 `steer_task`(queued_delta / kill_and_resume);对话侧没有 durable inbox 投影 | **B** | 语义可映射到语音「插一句 / 改当前步 / 塞上下文」,须适配会话短命/任务长命,不能照搬双队列 |
| D-04 | Agent 接口与 Loop 可替换;消费者只依赖 `ctx.agents` | `packages/core/agent/src/index.ts:183-214`;`agent-loop/src/index.ts:296-350` | 部分有。执行后端是受控矩阵 `tier1 \| hopper`(`capabilityMatrix.ts:5-29`),不是开放 driver 插件 | **C** | 框架本体。SayDo 的可替换点是锁版本 CLI/Hopper,不是换循环实现 |
| D-05 | 组装后 keyless snapshot;测真实入口与外部世界,不测自报 | `docs/testing.md:8-35,47-49`;`docs/postmortem/0001-*.md` | 已有可增强。契约测试 + `HOPPER_FAKE_SPEC` + golden 话术已有;几乎没有组装后 transcript snapshot,也没有「重读文件」式世界断言覆盖对话环 | **A** | 直接加强现有测试文化,不引入对方 runner |
| D-06 | System prompt 分段注册 + assemble waterfall + 变量插值 | `packages/core/system-prompt/src/index.ts:337-542` | 已有。`buildInstructions` + Context Pack + 归属轮状态(`instructions.ts:77-138`,`live/pack.ts:68-115`) | **C** | 重复建设。分段插件化对 Brain 固定人格/状态词没有收益 |
| D-07 | Session 为 append-only 类型化事件;fork 深拷贝到 boundary | `packages/core/session/src/types.ts:58-244`;`index.ts:1081-1137` | 部分有。transcript JSONL + focus timeline;`forked_from` 仅 DDL(`storage/ddl.ts:905-909`),无写路径 | **B** | fork 对「同一项目开平行焦点」有用,须接 focus 合同,不能当通用 session 克隆 |
| D-08 | Capability seam:Definition / Provider / Consumer 分包,Provider 与 Consumer 互不依赖 | `docs/glossary.md:7-9`;`docs/architecture.md:98-100` | 部分有。工具在 daemon 内注册,执行世界(Hopper/CLI)在桥对岸,已是某种 seam,但新能力(若有)容易在 daemon 里揉成一团 | **B** | 作以后新能力的设计纪律(尤其 P1 `network_fetch`),不接 Cordis 服务容器 |
| D-09 | 子进程环境 scrub:剥 KEY/PASSWORD/SECRET/TOKEN 与内部前缀 | `packages/subprocess/subprocess/src/index.ts:44-66`;`docs/defensive-patterns.md:28-29` | ~~没有(spawn CLI 路径未做启发式剥离)~~ **勘误(2026-08-27 月度审计):本评估基线 `c5148ab` 上已有——BYOA spawn 走 `buildSpawnEnv` 白名单(默认剥离、仅透传显式给定,07-24 `ca102ea` 起),tier1 executor 有 `AGENT_ENV_ALLOWLIST`;白名单形态强于本条建议的启发式剥离**。密钥本身已走 `~/.saydo/.env` 0600 白名单(`config/envFile.ts:7-15`) | ~~A~~ **C(已满足)** | 现状已强于建议目标,无需动作 |
| D-10 | 凭据引用 `CredentialRef`,配置不内联密钥;分层 env > yaml > .env | `packages/credentials/credentials/src/index.ts:16-99`;`credentials-local` | 已有。secret 白名单 + 0600 + 不进 audit | **C** | 重复建设。对方多一层 yaml 存储对 SayDo 单用户本地无增量 |
| D-11 | 审批 `allowed-once`;缺 answerer fail-closed;`never` 在 dispatch 前拒;asked/decided 成对且不进模型 transcript | `packages/interaction/user-approval/src/index.ts:84-343` | 已有可增强。收据单次消费 + S2 超时 deny + S3 语音永不放行(`gate.ts:36-70`,`approvals/issue.ts`)已是更强合同;缺的是「asked/decided 成对事件」形状 | **B** | 借事件成对与「审批不进模型可见历史」,不借 `allowed-once` 替代 S0–S3 |
| D-12 | 沙箱升级:先审批再执行,只允许加宽,拒绝有独立文案 | `packages/sandbox/sandbox/src/escalation.ts:28-188`;`tool-bash` 消费 | 没有对等 choreography(执行在 Hopper/CLI 内) | **B** | 若未来 daemon 自跑 bash 才需要;现在不要在语音路径做「升到 danger-full-access」 |
| D-13 | OS 沙箱链:bwrap / Landlock / Seatbelt / Windows ACL,探测失败 closed | `packages/sandbox/sandbox-local/src/index.ts:159-333`;`native/landlock-run` | 没有 OS sandbox。有 worktree(`tier1/adapter.ts:58-103`)与 CLI 软笼(`cage.ts:50-86`) | **B** | 只在「SayDo 自己 spawn 可写 shell」时改造借设计;不要 vendor 对方 native addon;执行域仍归 Hopper/CLI |
| D-14 | `enforcement: full \| partial` 诚实报告;unavailable 抛错不静默放行 | `packages/sandbox/sandbox/src/index.ts:118-176`;Windows 标 partial | 部分有。cage 分档写在注释与 09 §11,运行时没有把「codex 只限写 / cursor 仅 tripwire」编成可断言字段 | **A** | 把已有分档从文档变成 capabilities/probe 字段,防止 UI/话术夸大笼子 |
| D-15 | Permission preset 是 UX 捆绑,执法仍读各自 knob | `packages/interaction/permission-presets/src/index.ts:159-429` | 已有。`direct_to_review` / `step_confirm` 是模式捆绑(`capabilityMatrix.ts`) | **C** | 重复。对方 preset 更偏 IDE 工作台 |
| D-16 | fs 进程内 fence 明确**不是**内核边界;observation CAS 可选 | `packages/fs/fs-sandbox/src/index.ts:10-28` | 没有自研 fs 工具面(文件改写在执行后端) | **C** | 越界。Brain 不应直接写工作区 |
| D-17 | Compaction:保工具配对、pressure + overflow 重试、shadow-price 协议 | `packages/compaction/compaction-basic/src/index.ts:106-194`;`types.ts:16-80` | 部分有。记忆预算截断 + `HISTORY_WINDOW` + 摘要器(`memory/compiler.ts`,`voiceSessions.ts:92`,`summary/summarizer.ts`) | **B** | 长对话可借「溢出时压缩并保持 tool_call 配对」;语音场景优先摘要器,不要默认 LLM 压缩烧钱 |
| D-18 | Spill:过大 tool result 落盘,模型只见 locator | `packages/spill/spill/src/types.ts:18-73`;`spill-policy` | 部分有。摘要器压执行事件,原始流不进 Brain(`docs/03` §2) | **B** | 可作摘要器的落盘补充(大 diff 文件 locator),不要让 Brain 直接 `read` 回环 |
| D-19 | Token-meter:从日志折叠压力;区分 billed / projected / 组成 | `packages/llm/token-meter/README.md` | 已有成本账本(`cost_entries`,`bridge/cost.ts`),无「下一请求 projectedTokens」 | **B** | 改造接到成本页/口播「这段对话大概还剩多少上下文」,启发式即可,勿抄 4 字符/token 当账 |
| D-20 | Skills:分层发现、rank 决胜、`modelInvocable` vs `userInvocable` | `packages/skill/skill/src/index.ts:48-93`;`skill-filesystem` | 没有 Skills 宿主。有 `.saydo/knowledge` 分层记忆 | **B** | 只借「模型不可调用、仅用户手势可调用」的调用策略,用来保护 M0/第三方技能;不建技能市场 |
| D-21 | MCP client 桥,工具名加服务器前缀 | `packages/mcp/mcp-client` | 没有;且主动关 MCP(`cage.ts:74-79` `--strict-mcp-config`) | **C** | 护城河。开 MCP 宿主等于把用户第三方工具绕过 Gate 0 |
| D-22 | 进程内 subagent spawn/fork + 外部委托 Claude/Codex/ACP/dsh-sdk | `packages/subagent/*` | 没有产品 subagent。多 agent 是评审流程,不是 runtime | **C** | 执行编排归 Hopper;对话域再养一层子代理会 split-brain |
| D-23 | Workflow / Ralph:worker-thread 跑脚本,每轮 fresh 子代理 | `packages/workflow/tool-ralph/src/index.ts:23-177` | 没有 | **C** | 对方的打榜/长循环形态;与「会话短命、任务长命、人验收」冲突 |
| D-24 | Plan mode + todo_write 整表替换 | `packages/plan/plan-mode`;`packages/todo/tool-todo` | 已有 DecisionPackage + 逐步确认 + Focus 义务(`factory.ts`,`liveTools.ts:737-842`) | **C** | 重复。对方是 IDE 内协作状态,我方是决策包合同 |
| D-25 | Goal:同会话目标 + 进程本地 activation,resume 后必须人再授权 | `packages/goal/goal/src/types.ts:44-83` | 部分有。就绪/Gate0 是跨会话硬门,不是 session-local goal | **C** | 对方 goal 比我方 Gate0 **更松**(进程本地 activation);不能用它削弱就绪 |
| D-26 | Jobs 后台 + 会话围栏 | `packages/jobs` | 已有 daemon 任务 + outbox + recovery(`recovery/reconciler.ts:25-92`) | **C** | 重复。对方 jobs 绑单会话,我方任务跨会话 |
| D-27 | LSP 四操作 seam | `packages/lsp` | 没有(也不该有)。编码导航在 CLI agent 内 | **C** | 越界到执行世界 |
| D-28 | Code Mode:`run_code` 呈现,子调用仍走同一工具管线 | `packages/core/agent-tool-presentation`;`packages/code-runtime` | 没有 | **C** | Brain 精确参数走 Structured Outputs,不给语音模型一个通用代码运行时 |
| D-29 | 自指 Cordis:agent 改自己的插件树 | `packages/extensions/tool-cordis` | 没有 | **C** | 开发演示;与 Gate 0 / 不可变审计冲突 |
| D-30 | 同一脊柱多表面:Web / Headless / ACP / JSON-RPC / Python SDK | `packages/bundle/*`;`packages/acp`;`packages/sdk`;`python/` | 部分有。Console + 移动 WebView + daemon HTTP/WS;ACP **P0 拒启动**(`config/validate.ts:158-159`);无对外 JSON-RPC agent 协议 | **B** | ACP/JSON-RPC 作 P1 自动化入口可再评,首发不借;Web UI/TUI 不借 |
| D-31 | `dsh --profile headless` 作为 coding agent 运行时 | `packages/bundle/headless`;`BENCHMARK.md`;API changelog 2026-07-31 | 执行后端是 Hopper + Tier1 CLI cage,矩阵无 `dsh`(`cage.ts:8-15`,`capabilityMatrix.ts:5`) | **B** | ~~**owner 决策**:W5 之后是否把 DSH 收成 BYOA cage(与 claude/codex 并列)。现在不接;Preview 破坏性变更 + 与 Hopper 职责重叠~~ **本条已 supersede,见 `2026-08-15-default-runner-decision.md`**:两处定位偏差——① DSH 的同位物是 **Tier1 执行器**不是 BYOA cage(后者是零工具纯推理笼);② "与 Hopper 职责重叠"不成立(DSH 无 durable 任务流水线),且 Hopper 生产绑定本就 dormant。新裁决:不作默认 Runner,推荐自建 `native_api` adapter |
| D-32 | 真实 Loader/已构建产物测试;package `./invariant`;generated catalog `--check` | `docs/testing.md:31-35`;`packages/AGENTS.md:19`;`scripts/gen-*-catalog.ts` | 部分有。emoji 门禁 + 契约测试 + journal;无 generated tool catalog,无每包 runtime invariant 插件 | **B** | 借「从 `@saydo/contracts` 生成工具目录并 --check」与「模块关系不变量」;不借 100% 行覆盖 |
| D-33 | `--dump-config` 打印实际启动的插件树 | `docs/architecture.md:29-35` | 部分有。配置合并 + validate,无「运行时决议树」转储 | **B** | 改造为 `saydo dump-config`(脱敏后),利于现场排障 |
| D-34 | Agent Notes 生命周期 + 格式门禁;archived 冻结 | `.agents/notes/README.md`;`AGENTS.md:122` | 已有 ADR + PROCESS-JOURNAL + prompts/research 三分 | **C** | 重复。对方 Notes 是给仓库内 coding agent 看的操作记忆,我方已有更强 canonical 分层 |
| D-35 | 双语文档配对 hash + 字数预算 | `docs/i18n/README.md`;`scripts/verify-doc-budgets.ts` | 没有产品 i18n;文档中文 + 标识符英文 | **C** | 投入产出不成比。零 emoji 已是我方文档硬门 |
| D-36 | per-file 100% 覆盖率门禁 | `docs/testing.md:10`;`vitest.config.ts` | 没有(也不该有) | **C** | 对方用覆盖率删死代码;我方阶段门是 lint+typecheck+契约。100% 会把精力从合同测试挤走 |
| D-37 | Cordis 微内核 + vendor 钉死 + 一切皆插件运行时 | `vendor/`;`docs/cordis-primer.md` | 没有,也不引入 | **C** | **框架本体**。红线:借模式不接 runtime |
| D-38 | Web search/fetch 工具 seam | `packages/web/*` | 文档有代码无:`network_fetch` P1 reserved(`docs/09` §6);cage 关 `web_search` | **C** | 开值撞 Gate0/egress。不是缺口 |
| D-39 | E2B 远程同世界(fs+subprocess 一起换) | `packages/e2b` | 没有 | **C** | 部署拓扑越界;执行隔离用 Hopper worktree |
| D-40 | Hooks 桥接 Claude Code / Codex hooks.json | `packages/hooks/*` | 已有 Cursor CLI `beforeShellExecution` 路径(07 D8) | **C** | 我方 hooks 是审批回连,对方是兼容层;勿混 |
| D-41 | 并行工具调度:有界池、abort 给未启动调用写合成错误 | `packages/core/agent-loop/src/tool-calls.ts:1-119` | 部分有。对话环基本串行 `maxSteps`(`dialogLoop.ts:643`) | **B** | 可借 abort 合成错误保重放;并行不是语音 Brain 的缺省 |
| D-42 | Repeat-tool-reminder(连续同参提醒,不 veto) | `packages/guard/repeat-tool-reminder` | 没有 | **C** | 对方标 advisory,非安全边界;Brain 步数上限已覆盖失控环 |

## 红线记录（license 判定 + 护城河/边界冲突项）

**License**

- 主许可证 MIT,允许复制代码与再分发。本评估仍执行「框架本体不接 runtime」:不把 `@deepseek-ai/cordis` / `@deepseek-ai/dsh-*` 加进 SayDo 依赖,不 vendor 其插件树。
- 若未来某条 A/B 需要对照实现,只复述算法/协议并在本栈重写;复制文件必须保留 Copyright 与 MIT 通知。
- 第三方:ACP SDK Apache-2.0(可接受);Claude Agent SDK 许可证以对方 README 为准——SayDo 若只借设计则不引入该依赖。
- Developer Preview:官方 README 明示破坏性变更。DSH **不能**替换 09 §11 锁定的 Hopper commit。

**护城河(只加强不放松)**

对方没有、因而绝不能借「更简洁」来削弱的:

1. Gate 0 无 bypass — `packages/contracts/src/effects.ts:162-164`
2. S0–S3 + 收据;S3 语音永不放行 — `packages/daemon/src/tier1/gate.ts:36-70`
3. 记忆 M0 拒第三方、candidate→trusted — `packages/daemon/src/memory/classify.ts`
4. 状态词纪律 + TTS 脱敏 + 零 emoji — `instructions.ts` + `scripts/check-emoji.sh`
5. 契约单源 `@saydo/contracts`
6. 审计不可变 vs 日志可轮转 — `obs/audit.ts` + DDL 触发器
7. 语音前脑所有权(会话短命 / 任务长命 / 回叫 outbox)
8. 执行后端 fail-closed 能力握手(Hopper pin / CLI pin)

**边界冲突(C 的产品原因)**

- DSH 是人在 IDE/浏览器里操作的 coding harness;SayDo 是语音指挥 + 后台任务。把 DSH 当 daemon 会丢掉语音合同。
- DSH 的 MCP/Skills/Web/自改插件,默认扩大模型可达面;SayDo 默认收缩。
- DSH goal activation 是进程本地、resume 后再授权;SayDo Gate0 是跨重启硬门。取对方等于放松就绪。
- `network_fetch` / ACP / MCP 在本仓是 reserved 或拒启动,不是「漏做了」。

## 承重现状盘点（本产品已有能力清单——防后续评估者重复误判）

评估 DSH 时最容易犯的错,是把 SayDo 已经做完的控制面当成「还缺一个 harness」。下列在本仓**已经落地**(证据见上表与代码):

- 对话工具环:`runDialogTurnWithTools`(`dialogLoop.ts:623-722`)
- 工具注册 fail-closed:`brain/registry.ts`
- System prompt 多源组装:`instructions.ts` + `live/pack.ts`
- Gate 0 / 就绪评估器 / 决策包工厂
- S0–S3 命令门 + 审批收据 + S3 专用面
- 分层记忆 M0–M3 编译器(live 已接线;勿把 `contextPack.ts` stub 误判为未做)
- 语音级联管线:`voice/hub.ts` + `pipeline/`
- Hopper 桥:capabilities / drop / events / fake-runner e2e
- Tier1 worktree + BYOA 多 CLI 软笼(含主动关 MCP/web_search)
- Durable SQLite + outbox + 启动 reconciler
- 成本账本 + Hopper usage 对账
- 审计/日志分流
- Console 多页 + iOS/Android/Harmony WebView 壳
- 契约测试 + golden 话术 + Hopper fake-runner
- 配置全局+项目白名单合并(无自由多层 profile 引擎,是有意的)

**文档有、代码无或拒启动(不要当成借鉴缺口):** ACP 供给、`network_fetch`、Focus `forked_from` 写路径、OS seatbelt/landlock、Skills/MCP 宿主、产品 Subagent、就绪语料 ≥200。

**进行中工作冲突**

- PLAN-2 当前顺序:先首发阻断与真人验收,下一工程批仍是 **W5 剩余(5.4 挂 Claude 订阅)** → R-B → A5-armed。单仓同时只开一个批。
- `HANDOFF.md` 批次指针为空,可开新批,但战略上 DSH 集成不应插队。
- 工作区同时有上架文案、移动壳、本评估草稿;借 UI/时间旅行会撞 redesign,借执行环会撞 Hopper 桥。

## 第一刀建议（优先级 + 依赖 + owner 决策点）

建议批次名(若开):`borrow-dsh-invariants`(纯 daemon/测试,不改 canonical 合同形状则走轻量代码评审)。排在 W5 剩余之后,或作为 W5 间隙的小加固,不上浮为战略批。

| 序 | 条目 | 依赖 | 验收锚 |
|---|---|---|---|
| 1 | D-01 对话环请求重建不变量 | 现有 `TranscriptTurn` schema;可能要在 09 补「模型可见消息可重建」一句(合同轮攒批) | 单测:篡改内存 messages 不写 transcript ⇒ 断言失败;正常路径 messages digest == transcript 派生 digest |
| 2 | D-05 Brain 工具环组装 snapshot | 现有 golden / fake LLM | 至少 1 条 keyless 场景走真实 `runDialogTurnWithTools` 入口,钉工具顺序与脱敏后口播,不手挂 registry |
| 3 | D-02 + D-14 单调 deny + cage enforcement 字段 | `cage.ts` 分档表、`cliCapability` | probe/capabilities JSON 含 `enforcement: full\|partial\|unavailable`;单测:deny 后同一调用不可变 allow |
| 4 | ~~D-09 spawn env scrub~~(2026-08-27 勘误划去:白名单形态已存在,见上表 D-09 勘误) | — | — |

> **状态注(2026-08-27 月度审计)**:上表 `borrow-dsh-invariants` 第一刀建议(D-01 / D-05 / D-02+D-14)截至今日**未开批、未实施、亦未标注放弃**——IMPLEMENTATION-PLAN-2 与 HANDOFF 对其零命中,dialogLoop 无重建断言,daemon 全源无 `enforcement` 分档字段。是否开批/放弃/并入后续批待 owner 裁决;D-09 因勘误所述已天然满足,不在待决之列。

**owner 决策点(本评估不代拍)**

1. 是否在 W5 之后把 `dsh` 列为 BYOA cage 候选(D-31)。建议默认 **否**:Preview 不稳定,且与 Hopper 功能重叠;若 DeepSeek 模型要当 coding agent,优先走现有 `codex_cli` Responses API 适配,而不是再锁一个 harness 二进制。
2. ACP 是否在某 P1 作为「机器驱 daemon」入口(D-30)。与「P0 拒 ACP」不冲突,但要单独合同,不能因为 DSH 有 ACP 就解禁。
3. 长对话 compaction(D-17)是否允许廉价模型摘要进 Brain 历史。默认仍用规则截断 + 摘要器,LLM 压缩需成本账本条目。

**与进行中工作:** 不改 `capabilityMatrix` 的 `tier1|hopper` 二元;不改 Gate0;不新增 `network_fetch`。

## 不借清单（C 项汇总——同样有档案价值）

D-04 可替换 Loop 运行时 / D-06 prompt 分段插件 / D-10 凭据 yaml 层 / D-15 permission preset 产品 / D-16 进程内 fs 工具 / D-21 MCP 宿主 / D-22 产品 subagent / D-23 Ralph/workflow / D-24 plan+todo 模式 / D-25 session goal(会放松 Gate0) / D-26 会话内 jobs / D-27 LSP / D-28 Code Mode / D-29 自指插件树 / D-34 Agent Notes 制度 / D-35 双语预算机器 / D-36 100% 覆盖率 / D-37 Cordis 框架 / D-38 Web fetch / D-39 E2B / D-40 hooks 兼容层 / D-42 重复工具提醒。

一句话:凡是让模型**更自由地碰到世界**,或让 SayDo **再养一条执行真相源**的,都不借。

## 互联网对照(非代码,只作定位)

- 官方定位:Agent Harness,不是新模型、不是 API 客户端。入口 `npx @deepseek-ai/dsh web`(默认 `127.0.0.1:3080`)。
- 2026-07-31 起它就是 V4 系列 Code Agent 公开基准的官方架子;2026-08-13 开源与 V4-Pro GA 同一天,属于「模型 + 官方工作台」一起出货。
- 社区报道强调「不是 DeepSeek 版 Claude Code 那么简单」,因为 Loop 本身可替换。对 SayDo 而言这句话的推论是:**它是平台,不是一个可 drop-in 的 runner**。当 runner 用会被迫吞下整个插件宇宙。
- 同名第三方仓(协议探针 / 本地 batch CLI)与官方 DSH 无关,评估时已排除。

## 来源可靠度

| 来源 | 角色 | 备注 |
|---|---|---|
| 对方源码 + `docs/architecture.md` / subsystems / postmortem / testing.md | 主证据 | 本会话实读;核心不变量与沙箱/测试政策已抽查 file:line |
| 对方 README / LICENSE / THIRD_PARTY_NOTICES / package.json `0.1.0-rc.5` | 版本与 license | 实读 |
| api-docs.deepseek.com/updates | 官方基准声明 | 确认 harness 用于 V4-Flash 打榜 |
| 新浪/网易等转述 | 仅作开源日舆论定位 | 不引用其架构细节;以源码为准 |
| SayDo 源码 + PLAN-2 + 03 架构 | 承重盘点 | 实读;记忆 stub 未误判为未做 |
