# DSH 插件线评估：泳道插件合适性 · SayDo（除语音）能否成为 DSH 插件 · 插件开发助手是否值得做

> 产出：Claude Fable 5（本会话实读三仓 + 6 路子代理：3 路本地探索、4 路互联网调研；下文标"实测"者为本会话独立命令核验，标"调研"者为子代理带 URL 的返回，标"推断"者为未验证判断）
> 评估对象：`~/WorkSpace/dsh-workflow-lanes` v0.6.0（HEAD `7256bfe`）；`~/WorkSpace/Reference/deepseek-harness`（`origin` = 官方 `deepseek-ai/deepseek-harness`，checkout 为 owner 桌面壳 fork，HEAD `d190efd6f7`；已装 profile 为 `~/.dsh/profiles/web`）；SayDo `main` @ `26d32e8`；类比对象 `~/WorkSpace/HarmonyOS_DevSpace`（`harmonyos-ai-workspace` v0.5.1）
> 关系声明：本文**不 supersede** `2026-08-13-deepseek-harness-borrowing-assessment.fable.md`（方向：SayDo 借鉴 DSH，SayDo 为宿主）与 `2026-08-15-default-runner-decision.md`（方向：DSH 作 SayDo 执行器，已否决）。本文回答的是第三个方向：**把 SayDo 的机制搬进 DSH 做插件（DSH 为宿主）**。三文并存，各答一问。`docs/review/2026-08-16-now-vs-later.md:55` 已把"DSH 插件线（dshp / 今日泳道插件）"定为仓外实验、不占 SayDo 批次指针——本文遵守该边界，不改 PLAN-2、不改 HANDOFF 指针。
> 文档纪律：本文遵守仓内零 emoji 门禁（`scripts/check-emoji.sh`），不使用勾叉符与图形符号。

## 0. TL;DR（四问四答）

| 问 | 答 | 一句话依据 |
|---|---|---|
| 1. `dsh-workflow-lanes` 合适吗 | **作为 DSH 插件：技术形态合适、工程质量合格；作为"SayDo 理念的移植"：语义错位，主轴该换；且要先看清生态里 08-15 之后冒出来的同类** | 走官方 `session-projection` seam、纯同步 fold、typecheck/test 实测绿；但它的"泳道"= 活动类型（调研/实施/运行/测试/评估/编排/等待），SayDo 的"泳道"= 一件事（Focus）× 状态列（队列/进行中/需要你/已收尾）× 四色球权。前者靠 tool-name 启发式猜"AI 在干嘛"，后者回答"哪件事现在需要我"。后者才是 SayDo 的理念，也更接近同类产品的通行做法（看板列 = 状态，不是活动类型；Claude Code Agent View 就按 Working / Needs input / Idle / Completed / Failed 分组）。npm 上 `dsh-plugin` 关键词已有 **1211** 个包（本会话 registry 实测），其中 `dsh-taskboard`（任务级五列看板 + 认领 + 验收）与 `dsh-traffic-light`（每会话桌面红绿灯：空闲/运行/需要关注/完成/失败）已经占了"状态"这一轴的两端；lanes 的差异化只剩"跨会话活动时间线 + 项目 × 会话矩阵"，改轴时要与它们错开 |
| 2. SayDo（除语音）能否做成更完整的 DSH 插件 | **能，但不是"一个 SayDo 插件"，而是一族分层插件；且它是"SayDo 的纪律层装进 DSH"，不是 SayDo 本身** | SayDo 的 B/C 级环节（采访、就绪门、决策包、S0–S3、settle、回叫、验收、合并收据、记忆账本、Focus 看板）都不依赖语音；DSH 宿主内插件可注册 tools/pre-execute 策略、消费完整 SessionEvent、走官方审批与 slot——比 08-15 否决的"DSH 当 SayDo 执行器"路径顺得多。代价：DSH 是 rc（`SESSION_FORMAT_VERSION=0`、无兼容承诺），且 DSH 用户就坐在键盘前，SayDo 最核心的"人不在场也能把事办成"在这里价值最弱 |
| 3. 这么写是否最合理、有无同类可借鉴 | **泳道插件的架构写法合理；产品定义可借鉴同类看板"状态列 + 需要你"范式；SayDo 式流程各环节业界都有先例，差异化在就绪门 + 分级审批 + 收据** | 见 §3 调研对照（子代理带 URL 返回，本会话未逐一打开每个链接） |
| 4. 是否该做一个 DSH 插件开发助手（类 HarmonyOS_DevSpace） | **值得，但形态要"薄"：不重写手册，做"官方文档 + 社区 skill + 社区工具之上的差量层"** | 官方仓已有 cordis-tutorial 七章 + cookbook + capability-seams + 每包 README（中英双语）+ `docs/user/develop/`（含打包发布指南）；社区已有 `dsh-plugin-development` skill v3.1.0（NanmiCoder，387 行执行清单）、`dsh-testkit`（真实宿主生命周期测试，Docker，只认 rc.6）、`dsh-plugin-vetting`、六个插件商店/索引。**官方缺口是 Client 侧**（`docs/user/` 全文无 `dsh.client` / `ctx.slots`）；社区缺口是：脚手架模板、真实踩坑账本（本仓 lanes/flowlanes 合并已攒下 25 条种子）、rc 版本契约表（rc.5 → rc.6 → rc.7 五天三跳）、本机秒级 doctor（testkit 太重）。HarmonyOS_DevSpace 的三份宪法 / skill 双向触发 / 稳定规则 ID / 反哺闭环 / doctor 端到端自检可直接复用 |

## 1. `dsh-workflow-lanes` 合适性裁决

### 1.1 事实底座（本会话实测）

- 版本 v0.6.0，MIT，unscoped npm 名 `dsh-workflow-lanes`，仓 `Octo-o-o-o/dsh-workflow-lanes`；`src/` 约 3900 行（`index.ts` 733 / `classifier.ts` 369 / `client/BoardOverlay.tsx` 1126 / css 706）。
- `npm run typecheck` EXIT=0；`npm test` EXIT=0（`test-host` 分类器 + fold 冒烟，`test-client` 模块加载 + 三插槽注册）。退出码各自紧跟命令取得。
- Host 侧：`WorkflowLanesService` 注册 projection unit `workflowLanes`（`stateVersion: 4`），`init/apply/view` 纯同步，未关心事件返回同引用（`src/index.ts:339-346, 461, 481, 586`）——与官方 `packages/session/session-projection/README.md` 的"framework drives, domain computes / same-reference means no work / stateVersion 是失效锚"三条契约逐条对得上。用结构化接口（`ObserverContext` / `ProjectionRegistryLike`）避免 import 运行时包，是对"public npm 版本与运行时 rc 不一致"的正确防守（`src/index.ts:60-91`）。
- Client 侧：三插槽 `sidebar.footer.action` / `settings.plugins.tab` / `conversation.view`（`src/client/index.ts:52-90`），body portal 看板，纠正/pin/冷缓存/尺寸都在 localStorage。
- 已吸收两个分叉实现（`dsh-flowlanes`、`dsh-lanes`），取舍有记录（`docs/MERGE-2026-08-17.md`）。
- 已装 profile 以 `link:` 方式挂着它（`~/.dsh/profiles/web/package.json`），与另外 9 个社区插件同栈。

### 1.2 作为 DSH 插件：形态合适

三条判据都过：

1. **走官方 seam 而不是旁路**。数据只经 `session-projection`（Host）+ Connection API（Client），不写会话事件、不注册模型工具、不注入 prompt。这正是官方对"只读观测类"插件的期望形态（projection 包 README 的 Role 段：domain 贡献 unit，carrier 消费 snapshot，互不相知）。
2. **对 rc 漂移有防守**。结构化类型 + `ctx.inject(['sessionProjections'], …)` 可选挂载 + `stateVersion` 随形状变更递增（2→3→4 有记录）。
3. **可测且真测了**。离线 fold 测试 + client 三插槽装配测试；不是只有类型检查。

### 1.3 需要修的事实性问题（不改方向也该修）

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| L-1 | **README 与代码矛盾**："no plugin-private HTTP surface"（`README.md:14`、`README.zh.md:12`）；但 Host 注册了两条 webServer 路由 `/api/workflow-lanes/warm`（v0.4.1 引入）与 `/api/workflow-lanes/reveal`（v0.5.1 引入） | `src/index.ts:315-330`；`git log -S` 定位到 `531ab5e`、`b1b5be2` | 二选一：README 改口为"两条 loopback-only 私有路由（回填写官方缓存 / Finder 定位）"，或把 warm 改走官方通道、reveal 下沉为 client 侧复制路径。当前状态是自我描述失真 |
| L-2 | `reveal` 路由执行 `open -R <path>` / `explorer.exe /select`，只校验 loopback + Host 头，无 CSRF 令牌，且 `readJsonBody` 不看 content-type | `src/index.ts:353-374, 696-719` | 在纯浏览器 `dsh web` 形态下依赖宿主对 `/api` 的准入守卫；桌面 fork 已把鉴权提到 webServer guard（fork 提交 `4a2dfad00f`），上游 `dsh web` 是否等价未核验。低危（只是弹 Finder），但"观测插件"不该带 OS 动作面 |
| L-3 | 分类器把**第三方插件的工具名**硬编码进 L1 映射（`mnemon_*`、`vision_*`、`cordis_*`、`x_search`…） | `src/classifier.ts:29-106` | 这是"本机装了什么就映射什么"，换一台机器就是死表。应改为：官方内置工具静态表 + 第三方按 `ctx.tools` 运行时清单的 description/tag 推断，或开放配置行让各插件自报 lane |
| L-4 | `engines.dsh >=0.1.0-rc.5`，而同栈社区插件 peer 已是 `^0.1.0-rc.6`（`@nanmicoder/dsh-agent-teams`、`dsh-mnemon`） | 各 `package.json` | rc.6 契约差异需登记（MERGE 文档已提到 rc.5 wire 变体归一），这正是 §4 "版本契约表"要管的事 |
| L-5 | 已知局限：单进程观测、不自动回填、纠正不回学、无子代理汇总 | `README.md:56-72` | 不算缺陷，但决定了它目前是"个人本机看板"而非"团队观测面" |

### 1.4 作为"SayDo 理念的移植"：语义错位，主轴该换

**这是本节最重要的一条。**

SayDo 仓内"泳道"的定义（本会话实读）：

- `packages/console/src/components/redesign/BoardLaneGroup.tsx:1-3`："泳道 = Focus 分组容器，多支线拆子泳道；4 列（队列 / 进行中 / 需要你 / 已收尾）"。`boardColumnOf()` 把 TaskCard 状态映射到列（同文件 :13-18）。
- `packages/console/src/pages/Board.tsx:11-17`：球权四色（橙 = 拍板/回答、蓝 = 你的动作、绿 = AI 在做、灰 = 等外部）。
- `packages/contracts/src/types/focus.ts:664-700`：lane 是一等实体（`lane_split` / `lane_retired` / `redo_from`），归属 Focus。
- `docs/08-module-design.md:165`：主轴由 project 倒置为 Focus。

`dsh-workflow-lanes` 的定义：泳道 = 活动类型（research / implementation / run / test / evaluation / orchestration / waiting），由 tool-name + bash 正则 + step 计分推断（`src/classifier.ts`），行 = 项目或会话。

两者用同一个词、指向正交的两个轴：SayDo 的泳道是**行（一件事）**、列是**状态**、色是**球权**；lanes 插件的泳道是**活动类别**。SayDo 理念里最有价值、也最能回答"用户为什么要打开这个面板"的问题是"**哪件事现在需要我、哪件事 AI 正在做、哪件事在等外部**"；而"AI 此刻在调研还是在跑测试"是次级信息，且天然只能是启发式猜测（插件自己也如实标了 confidence 与人工纠正）。

同类产品的通行范式与此一致：多 agent 会话看板的列几乎都是**状态**（排队 / 运行中 / 需要审批·输入 / 完成·失败），活动类型至多是卡片上的一枚 chip（§3 调研对照）。

**裁决**：不否定已有工程（fold、插槽、纠正、回填、产物 chips 都可保留），但建议 v0.7 起把主轴改为：

- **行** = 会话（或 goal / agent-teams 任务这类"一件事"的载体，可先用会话）；
- **列** = 状态：`排队/未开始 · AI 在做 · 需要你（approval/asked、ask_user_question、plan 待确认）· 等外部（job/background、subagent 未回）· 已收尾（turn/end 且无待办）`——这些信号 fold 里已经有（`approval/asked`、`turnOpen`、`lastTurnEndReason`、`job_*`），比活动类型可靠得多；
- **色** = 球权四色，直接借 SayDo 语义；
- **活动类型**降级为卡片 chip / 会话时间线的次级视图（现有七线时间线原样保留在 session view）。

这一改动让插件既忠于 SayDo 理念，又和业界范式对齐，还把最不可靠的推断从主轴上挪开。命名可以不动（`workflowLanes` 投影键、包名都不必换），只是"lane"从"活动类别"变成"一件事一条线"。

### 1.5 与生态的重叠核查（防重复造轮子）

已装 10 个社区插件里没有另一个会话看板（`dsh-context` 是上下文构成面板，`dsh-agent-teams` 有团队任务树监视但只覆盖它自己创建的团队）。但本会话直接查 npm registry（`keywords:dsh-plugin` 共 **1211** 包，search API 只取到前 100 条名称/描述；抽查的六个包均创建于 2026-08-14 至 08-16）后，发现三个必须正视的邻居（均按 npm 元数据 + README 头实读）：

| 插件 | 做什么 | 与 lanes 的关系 |
|---|---|---|
| `dsh-taskboard` 0.3.3（cloader，08-15） | **任务级**五列看板（待规划 / 待办 / 进行中 / 待验收 / 已完成 + 受阻）；人建卡 → agent 用 `taskboard_*` 八个工具认领执行 → 每次执行新建全新会话（可指定模型 / preset）→ 可选 git worktree 隔离 → 待验收列「完成 / 退回附原因」；agent 永远移不到 done；cron 定时 | 它是"任务 → 会话"方向的看板；lanes 是"会话 → 活动"方向的观测。互补而非同类，但**"状态列 + 需要你"这一轴它已经占了**（在任务粒度） |
| `dsh-traffic-light` 0.1.5（08-15） | 每 Session 一盏桌面悬浮红绿灯（Electron，`--allow-build=electron`）：空闲 → 运行中 → 需要关注 → 已完成 → 失败 | 会话粒度的"球权/需要你"信号，只是形态是桌面浮灯而非页内看板 |
| `@isomoes/dsh-ikanban` 0.4.8（08-15） | 整套 iKanban web 应用 bundle（自带 Vite 壳、独立 profile） | 是"用 DSH 跑一个看板产品"，与会话观测无关 |

结论修正：**"泳道/看板"坑位不是空的，但"页内、跨会话、按状态分组、带活动 chip、可回填历史"的会话观测面仍然没人做**——这正是 §1.4 建议改轴后的 lanes。改轴时应显式与上表错开：不做任务卡（taskboard 的事）、不做桌面浮灯（traffic-light 的事），并在 README 里互相指路。

### 1.6 owner「实施 / 评估双线分离」原则在 lanes 上的落点（2026-08-18 增补）

> 原则出处：owner 2026-08-17 表述，已于 08-18 写入 OctoWorkFlow 全局纪律（`~/.claude/CLAUDE.md` / `~/.codex/AGENTS.md`「实施 / 评估双线分离」节）：①实施与评估必须是彼此零上下文的独立会话，评估不得由继承实施上下文的侧会话 / fork 会话承担——会话隔离是底线，模型异族只是加分；②没有写明、可判定的验收目标不开始实施；③评估红灯首次退回原会话返工、同一条目二次仍红则弃会话另起新实施会话。本节回答：这三条哪些能落到 lanes（被动观测者），哪些不属于它。

**先划一条概念边界，防止把原则做歪。** lanes 的 `evaluation` 线是**活动类型**（`src/classifier.ts`：lint / tsc / typecheck / review / report 等工具足迹），一个施工会话自己跑门禁也会落进这条线；owner 原则里的"评估线"是**会话的角色**（谁在评估谁）。两者不是一回事：**不要把"评估会话"做成第八条泳道**，而应把"角色"作为会话的一个独立派生属性——这恰好也顺手拆开了 §3.2 指出的"七类混了活动 / 角色 / 生命周期三个维度"。

**能落到 lanes 的（全部是显示级观测，不改插件"不注册工具、不注入 prompt"的被动立场，可并入 N-2 改轴时的卡片 chip）**：

| # | 落点 | 数据依据（本会话实读） | 说明 |
|---|---|---|---|
| R-1 | **会话角色 chip**：`施工` / `只读` / `编排` | fold 已有 `perLane[lane].steps`；实施线的高置信足迹 = `write` / `edit` / `str_replace_editor` / `git add\|commit\|…`（`classifier.ts:57-59, 188-193`） | 纯 client 派生、零 fold 改动。**只认工具足迹，不认文本关键词**——`classifier.ts:199` 把"修改 / 修复 / fix"等词弱归实施线，评估会话的用户消息里天然会出现这些词，若计入会把评估会话误标成施工。标签用"施工足迹"这类事实措辞，不宣称"这是实施会话" |
| R-2 | **角色钉选 + 越界徽章** | 现有会话级 pin 机制（`dsh-workflow-lanes.pins.v1`，localStorage，pin 的是 lane） | 把 pin 语义扩到"角色"（施工 / 评估）。钉为评估的会话此后出现实施线高置信足迹 → 徽章"评估会话出现施工足迹"（原则①"评估 AI 不碰实施"的可见化）；钉为施工的会话跑门禁不报（那是它该做的）。与 v1"显示级纠正"同一层，不写会话日志 |
| R-3 | **血统徽章** | `SessionSummary.parentSessionId`（apiproxy `sessions.d.ts:193-194`，"fork/spawn lineage … absent for root sessions"；lanes client 已读同行的 `origin`，`BoardOverlay.tsx:219`）；子会话日志 `subagent/descriptor` 事件带 `provider` / `mode`（`packages/subagent/subagent/src/descriptor.ts:50-56`） | 卡片显示"派生自 <父会话>"；**钉为评估且有父会话** → 徽章"继承了父会话上下文"（原则①的核心：侧会话带主会话上下文）。fork 一定继承 seed 前缀（`sessions.d.ts:340-347`），spawn / acp 类子会话是否继承取决于 provider——fold 若多吃一个 `subagent/descriptor` 事件记下 `provider`，措辞就能分"fork：继承上下文" 与 "spawn：独立上下文"，需 bump `stateVersion` |

**待核验（本会话未验证，落 R-3 前必须先查）**：`SessionHeader.seedLength` 表示子会话日志前缀继承了多少父事件（`packages/core/session/src/types.ts:74-80`），而 lanes 的 fold 从 seq 0 折叠——**若 projection 对 fork 子会话也折叠了 seed 前缀，则父会话的施工步会被计入子会话的 `perLane`**，R-1 / R-2 会把一个干净的评估 fork 误标成"有施工足迹"。`session-projection` README 只提到 cache seed（`README.md:47`），没写 fork seed 前缀是否参与折叠；需用一次真实 fork 实测。若确有此问题，它本身就是 lanes 现存的一个计数偏差，与本节无关也该修。

**不属于 lanes 的（原则②③是门与流程，不是观测）**：

- 原则②"无可评估目标不派发"= `dsh-readiness`（N-5）的 `tools/pre-execute` deny 门；就绪骨架的 critical 项须含"验收 oracle 已登记"（SayDo `docs/04:65` 可验证性维已有此维度，移植时不得丢）。lanes 至多在卡片上显示"本会话尚无就绪确认"——且只有 readiness 插件真的存在并暴露投影后才做，不预先造壳。
- 原则③"红灯二次换新会话"= 派发 / 验收流程的事：`dsh-taskboard`（§1.5）已是"每次执行新建全新会话 + 待验收列退回附原因"，等于把该策略取到极端（每次都是新会话）；若日后 lanes 与 taskboard 联动，可在卡片上显示"第 N 次尝试 / 上次退回原因"，同样只读。
- 不做任何 enforcement（不拦 fork、不拦 evaluator 写文件）——那会把观测插件变成策略插件，与 §1.2 的形态判据冲突。

**结论**：原则①可以、也值得落进 lanes v0.7（R-1 → R-3 三步，都在改轴的卡片层内，成本小；R-3 前先做上面的 seed 前缀核验）；原则②③归 readiness / taskboard 侧，lanes 只做只读呈现。

## 2. SayDo（除语音）能否做成更完整的 DSH 插件

### 2.1 先把方向说清楚：这是第三条路，不是前两份文档的翻案

| 日期 | 文档 | 方向 | 结论 |
|---|---|---|---|
| 08-13 | borrowing-assessment | SayDo 为宿主，借 DSH 的模式 | 42 条 A/B/C；红线"借模式不接 Cordis runtime" |
| 08-15 | default-runner-decision | DSH 为 SayDo 的执行器（经 ACP/SDK） | 否决；三硬伤：`tools/pre-execute` 缺省 allow、hook 故障 non-blocking、ACP 审批帧信息不足 |
| 08-17（本文） | **DSH 为宿主，SayDo 的机制做成 DSH 插件** | 待裁决 | 见下 |

第三条路与第二条路的关键差别：08-15 的三硬伤是"站在 DSH 外面、隔着 ACP 看 DSH"时的硬伤；**站在 DSH 里面做插件，三条都可以自己兜住**——插件可注册 `tools/pre-execute` 瀑布拦截并返回 ask/deny（fail-closed 由插件保证，不依赖缺省）；插件在 Host 内直接消费完整 `SessionEvent`（含工具名、参数、结果），不经 ACP；hook 桥根本不需要用。剩下的真风险只有一条：**DSH 是 rc，`SESSION_FORMAT_VERSION=0`，无兼容承诺**（`packages/core/session/src/types.ts:33,40`；README "THERE WILL BE COMPATIBILITY-BREAKING CHANGES"），本地 checkout 220 包全 rc.5，社区插件 peer 已是 rc.6，npm `latest` 已是 rc.7（08-17 发布；子代理统计 + 本会话 registry 实测）。这意味着：插件线可以做，但每个插件都要有 §4 说的版本契约与 doctor 自检，且不能把 SayDo 主线的合同（09/10/11）绑死在 DSH 的事件形状上。

### 2.2 逐环节映射：SayDo 机制 → DSH 宿主内的落点

| SayDo 环节（语音耦合级） | DSH 已有对应物 | 空白 / 差距 | 插件落点建议 |
|---|---|---|---|
| Context Pack 装配（B） | `ctx.systemPrompt.section()` 分段 + order；`dsh-mnemon`（社区）项目记忆；`session_query` | DSH 没有"同输入同 digest、taint 过滤、分层预算"的编译器 | 可做但价值中等：`systemPrompt.section` 一段 + 一个 `context_pack` 只读工具；不要重写 mnemon |
| 采访（B） | `user-questions`（批量提问 + id 路由 + multiSelect）、`dsh-tool-ask-user` | `intent` 只有 `plan-review` 一种 tag 且"只改呈现"；无"一次一问、选择题优先、证据账本"策略 | Host 插件：`interview` 工具族 + 提示段（采访策略）；答案写入证据账本（下一行） |
| 就绪门（B） | plan mode 是**软引导**，明确"sandbox 与 approval 不读 plan 状态"；`goal` 是进程本地 activation；`agent/pre-step` 是通用拦截点 | **空白**：无 fail-closed 的"缺关键信息不派发"门 | Host 插件：`readiness` service（`readinessSkeleton` 纯函数直接从 `@saydo/contracts` 移植）+ `assess_readiness` / `confirm_readiness` 工具 + `tools/pre-execute` 对派发类工具（`subagent`、`workflow`、`bash` 的高危形态）返回 deny 直到 confirmed。这是 SayDo 最独特、DSH 最缺的一件 |
| 决策包（B） | `goal`（目标 + 阶段）、`todo_write`（整表）、`exit_plan_mode`（plan-review） | 无 durable 的"目标 + 验收标准 + 预算 + 预授权效果 + readinessRef + digest"聚合体 | Host：`decision_package` 实体（存工作区 `.dsh-saydo/` 或 storage seam）+ **Conversation Node**（`conversation.chat.node` keyed renderer，事件折叠可重放）把包卡片渲染进对话流 |
| S0–S3 分级审批 + 收据（B） | 官方 `approval`：`ask/never` 两档、`allowed-once`、fail-closed、asked/decided 成对；`permission-presets` 是 UX 捆绑。**社区已很挤**（npm 实测）：`dsh-smart-approval`（fail-closed LLM 辅助审批 reviewer）、`dsh-permission-rules`（Claude Code 式声明规则 + Codex 式网络策略）、`dsh-auto-classifier`（auto-mode 式分类器）、`dsh-auto-approve`、`@nanmicoder/dsh-auto-mode`、`dsh-builtin-toggles` | 基础的"策略 → ask/deny"已被多家覆盖；**仍空白的**是：按 effect 定级的封闭词表、收据 digest 绑定单次消费、S3 硬件强审批与合并收据 | Host：只做别人没做的——`EffectDescriptor` + `policy/engine` 移植为一个 `tools/pre-execute` 策略行，S1 放行、S2 走官方 `ctx.approval.request`（或委托给已装的 smart-approval/permission-rules，不重复做 UI）、S3 拒并要求客户端 WebAuthn 卡（Client 插槽 + Host 路由，rpId 绑 localhost）+ 收据。这是 08-15 文档说 DSH "缺省 allow" 的正解：**在插件里 fail-closed** |
| 派发执行（C） | `subagent` 多 provider（spawn/fork/acp/codex/claude-code/dsh-sdk）、`workflow` 脚本、`jobs` 后台、`@nanmicoder/dsh-agent-teams`（团队任务树）、**`dsh-taskboard`（人建卡 → agent 认领 → 新会话执行 → worktree 隔离 → 人验收「完成/退回」）** | DSH 的执行器比 SayDo 只有 cursor 一家的 Tier1 更丰富；taskboard 已经把"派发 + 验收"这一段做成了产品；SayDo 的 verify 冻结 argv + 三熔断在 DSH 里对应 `sandbox` + 插件自管 | **不重造执行器，也不重造派发看板**。SayDo 的 `Tier1Runner`（若按 08-15 建议抽出）可注册为一个 `subagent` provider；就绪门 / 决策包 / 收据应设计成能"挂在 taskboard 的卡片前后"的独立插件（例如：taskboard 卡片进入「进行中」前必须有 confirmed readiness；「完成」必须有 acceptance 三态 + 收据），而不是再做一块板 |
| settle barrier（C） | `workflow/end`、`turn/end`、`job` 完成通知；无"执行 + 自检都跑完才算"的语义 | 缺 settle 概念 | Host：projection unit `settle`（纯 fold：子代理 turn/end + verify 工具结果 + 无 pending approval → settled）——与 lanes 插件同 seam，可并入同一包 |
| 回叫（B） | `dsh-notification`（浏览器 Notification）、`dsh-dingo`（声音 + 系统通知 + 直达对话）、`dsh-traffic-light`（桌面浮灯）、`dsh-pocket` / `dsh-mobile`（手机扫码同屏）、`dsh-feishu-bot` / `dsh-lark-link` / `dsh-wechat` / `dsh-plugin-wechat`（IM 通道，后者由 OpenClaw 负责微信通道）、官方 `schedule`（followup） | 通知与手机面已被大量覆盖；无的是 durable outbox / dedupeKey / 升级链（L0→L1→L2）/ 回执 | **不做通知插件**。若要 SayDo 的升级链，做一个只管"outbox + 去重 + 升级"的薄 Host 行，投递交给已装的通知插件 |
| 验收三态 + 合并收据（C） | 无 acceptance 概念；git 由 bash 工具做；`plan-review` 是唯一"人裁决"呈现 | 空白 | Conversation Node：`acceptance` 卡（pass/fail/unknown 逐条裁决）+ `S3MergeReceipt` 门住 `git merge/push` 类命令（复用上一行的策略） |
| 记忆账本（C） | `dsh-mnemon`（跨 agent 记忆 + 文档检索 + 图谱）；**`dsh-memento`（PerryLink，Apache-2.0：`ctx.memory` 服务 + SQLite provider + 写入审批门在服务内部强制 + 从会话日志重建审计链，自述"卖接缝不卖仓库"）**；另有 nocturne / tdai / unified-agent-memory / soul-md 等六七家 | memento 已经做了 SayDo 记忆最核心的"写入过门 + 可审计"；未见的是 taint 分级与 forget_hard 级联传播（§3.3：产品界也只见论文） | **不做记忆插件**。若要 SayDo 的 trust/taint 语义，向 memento 提 PR 或写一个 memento 的 policy 行 |
| Focus / lane / 球权看板（C） | 无内置看板；`dsh-workflow-lanes` 就是这个坑位（邻居见 §1.5） | 见 §1.4 | 把 lanes 改成会话 × 状态 × 球权主轴（DSH 里没有 Focus 实体，先以会话为"一件事"的载体） |
| 审计不可变、成本账本（C） | `session-telemetry`、`token-meter`（token 数无金额） | 无金额账本 | 后置 |
| ASR/TTS/VAD/话术（A） | 无 | 本文明确排除 | 不做 |

**结论**：能做的不是"一个 SayDo 插件"，而是**三个各自独立可装、可单独有用、且生态里确实没有的插件**，共享一个 contracts 包；另外两件（回叫、记忆）在 08-14 之后已被社区覆盖，改为"提 PR / 写 policy 行"：

1. `dsh-workflow-lanes`（观测：会话 × 状态 × 球权 + 活动 chip + settle 投影）——已在做，改主轴，与 taskboard / traffic-light 错开；
2. `dsh-readiness`（采访 + 就绪门 + 决策包 Conversation Node）——SayDo 最独特的一件，官方内置与本会话扫到的前 100 个 `dsh-plugin` 包名/描述里都没看到同类（1211 包未全扫；§3.3 业界也只有 Devin 置信度与 Spec Kit clarify 近似）；
3. `dsh-approval-tiers`（effect 定级封闭词表 + 收据 digest 单次消费 + 可选 WebAuthn S3 卡 + 合并收据）——只做社区六家审批插件都没做的那一层，基础 ask/deny 委托给它们；验收三态可并入本插件而不单独立包。

顺序建议：1（改轴）→ 3 → 2。理由：3 是纯 Host 策略、最不受 client 契约漂移影响、且立刻对任何 DSH 用户有用；2 价值最大但工作量最大（要移植 readinessSkeleton + 证据账本 + Conversation Node）。**每一个都应先跑一遍 `dsh-store` / `dsh-find-plugin` 或 npm `keywords:dsh-plugin` 查重再动手**——本会话就是这样发现 taskboard / memento / traffic-light 的，生态每天在长。

### 2.3 必须诚实说的三件事

1. **它是"SayDo 的纪律层装进 DSH"，不是 SayDo。** SayDo 的核心价值主张是"人不在键盘前，靠对话把事说清楚，AI 主动提议、跑完叫你"（`docs/01:8`）；DSH 用户就坐在 Web UI 前敲字。在 DSH 里，采访/就绪门/审批分级的价值是"防 agent 没搞清楚就动手、防高危动作无人过目"，这是**纪律**价值，不是**替代在场**价值。定位写清楚，才不会做成一个在 DSH 里显得啰嗦的插件。
2. **DSH 主线目前明确不占 SayDo 批次指针**（`docs/review/2026-08-16-now-vs-later.md:55`）。若要开插件线，应作为独立仓（`Octo-o-o-o/dsh-*`），只从 `@saydo/contracts` 取纯函数与 schema，**不反向把 SayDo 主线合同绑到 DSH 事件形状上**——否则 rc 漂移会把 SayDo 主线拖下水。
3. **生态重叠要先看，而且要按天看**：npm `keywords:dsh-plugin` 已 1211 包（本会话实测；只扫了前 100 条名称/描述，抽查的六个包均创建于 08-14 至 08-16）。派发/验收 → `dsh-taskboard` + `dsh-agent-teams`；记忆 → `dsh-memento`（带审批门）+ `dsh-mnemon` 等；通知/手机 → `dsh-notification` / `dsh-dingo` / `dsh-traffic-light` / `dsh-pocket` / IM 桥；审批策略 → 六家。这些不该新造，该接或该提 PR。SayDo 独有的、生态里确实没有的，收窄为 **就绪门 + 决策包 + effect 分级收据 + S3 硬审批/合并收据 + 会话级球权看板**。

### 2.4 与 08-15 owner 决策点 3 的关系

08-15 §六 第 3 条留了"DSH 是否保留为实验 adapter（走 SDK sidecar 而非 ACP）"。本文的插件线与它**互补而非互斥**：若日后真做 SDK sidecar，DSH 侧装着 `dsh-approval-tiers` + `dsh-readiness` 的实例，恰好能把 08-15 的三硬伤在 DSH 内部堵上，SayDo daemon 只需消费收据与 settle 事件。这不改变 08-15 "不作默认 Runner" 的裁决。

## 3. 互联网调研对照

> 来源分三档：**实测** = 本会话直接 curl npm registry / GitHub raw；**调研** = 两路子代理带 URL 返回（同类看板 / SayDo 同类），本会话未逐一打开每个链接；**先例** = 两次 WebSearch 拿到的 URL + 未重新打开的已知稳定仓。原定第三、四路子代理（DSH 生态、插件手册先例）因账号周配额在 22:00 前耗尽而失败，其中 DSH 生态部分已由本会话直接查 registry 补齐（§3.1），手册先例部分只做了最小核验（§3.4）。GitHub API 本会话两次 504，`topic:dsh-plugin` 仓库计数与上游 star 数未取到。

### 3.1 DSH 生态现状（实测，2026-08-17 22:0x）

- npm `keywords:dsh-plugin` **1211** 包；`@deepseek-ai/dsh` dist-tags `latest = 0.1.0-rc.7`（**08-17 当天发布**），rc.6 08-13，rc.2/rc.3 08-13。本地 checkout / CLI 是 rc.5，社区插件 peer 多为 rc.6，`dsh-testkit` 只认 rc.6：**五天三跳**，版本契约不是纸上风险。
- 与本文四问直接相关的插件（元数据 + README 头实读）：
  - 看板/状态：`dsh-taskboard`（任务级五列 + 认领 + 验收 + worktree）、`dsh-traffic-light`（每会话桌面红绿灯）、`@isomoes/dsh-ikanban`（整套看板应用）、`dsh-codex-timeline`（回合时间线）；
  - 审批策略：`dsh-smart-approval`（fail-closed LLM reviewer）、`dsh-permission-rules`、`dsh-auto-classifier`、`dsh-auto-approve`、`@nanmicoder/dsh-auto-mode`、`dsh-builtin-toggles`；
  - 记忆：`dsh-memento`（写入审批门 + 审计链）、`dsh-mnemon`、`dsh-nocturne-memory`、`dsh-tdai-memory`、`dsh-unified-agent-memory`、`dsh-soul-md`；
  - 通知/远程/IM：`dsh-dingo`、`dsh-pocket`、`dsh-mobile`、`dsh-remote*`、`dsh-feishu-bot` / `dsh-lark-*`、`dsh-wechat`、`dsh-plugin-wechat`（OpenClaw 微信通道 + DSH 大脑）；
  - 编排：`@nanmicoder/dsh-agent-teams`、`@agentrq/dsh-plugin-agentrq`、`task-passport`；
  - **插件开发基础设施**：`dsh-testkit`（真实宿主生命周期测试，Docker，生成 `dsh-testkit.yaml` + GitHub workflow + `.agents/skills/dsh-testkit/SKILL.md`）、`dsh-plugin-vetting`（装前静态体检）、`upstream-radar`（依赖安全）、商店/索引 `dshmarket` / `dsh-store`（自述 550+ 插件 11 分类）/ `@dsh-suite/plugin-manager` / `dsh-plugin-marketplace` / `@1e0zj/dsh-plugin-mall` / `dsh-find-plugin`；迁移 `dsh-movein`（Claude Code 全套搬进 DSH）、`pi2dsh`；甚至有 `dsh-hdc-bridge`（DSH 原生鸿蒙开发助手插件）。
- 官方对外部插件的指引：`docs/user/develop/basic/publish.md` 是事实上的打包发布指南（bundle vs profile、层序、GitHub 安装 `prepare` + `allowBuilds`、范例 `deepseek-harness/turtle-ui`），已上官网（`website/docs.ts:170`）；**Client 侧为零**（`docs/user/` grep `dsh.client|ctx.slots|slots.register` 退出码 1，本会话实测）。未见官方 registry / marketplace / `create-dsh-plugin` 脚手架——上面的六个商店全是社区做的。

### 3.2 同类看板 / 阶段分类（调研，子代理带 URL）

- **业界产品几乎只展示生命周期状态，不展示活动类型**：Claude Code Agent View（2026-05-11 研究预览）按 Working / Needs input / Idle / Completed / Failed 分组（https://code.claude.com/docs/en/agent-view）；Jules session state QUEUED / PLANNING / AWAITING_PLAN_APPROVAL / AWAITING_USER_FEEDBACK / IN_PROGRESS / …（https://jules.google/docs/api/reference/types/）；Devin `status_enum` working / blocked / finished；Antigravity Idle / Running / Blocked；CCManager busy / waiting / idle + 状态耗时（https://github.com/kbwo/ccmanager）；vibe-kanban todo / inprogress / inreview / done（已宣布 sunsetting，https://github.com/BloopAI/vibe-kanban）；Gas Town 只做 stalled 检测（https://github.com/steveyegge/gastown）；OpenHands `AgentState` 全是状态。
- **按活动类型自动分类 tool-call 流在研究界有直接先例**，且用的正是 lanes 这种启发式：SWE-chat（Stanford 2026-04，6000 真实会话，Table 5 按工具名 + bash 首命令分 read / grep / glob / bash:file / bash:build / bash:net / git-gh / write / edit / web / agent / TodoWrite / AskUserQuestion / EnterPlanMode / ExitPlanMode，https://arxiv.org/abs/2604.20779）；Bouzenia & Pradel ASE'25 八类 Explore / Locate / Search / Reproduce / Generate fix / Run tests / Refactor / Explain，并画"归一化进度 × 类别占比"、发现失败轨迹陷入 fix–test 循环（https://arxiv.org/abs/2506.18824）；AWS 138k 轨迹用 Opus judge 把每个 tool call 归 explore / localize / implement / verify 画 Gantt（https://arxiv.org/abs/2606.17454）。Claude Code 自己只在 `/insights` 里用 Haiku 离线抽 facet，状态栏无活动字段。
- **"泳道"语义**：BPMN/UML 泳道 = 责任方（https://en.wikipedia.org/wiki/Swim_lane）；Kanban 列 = 阶段、泳道 = 工作类别（https://www.wrike.com/kanban-guide/faq/what-are-kanban-swimlanes/）；agent 观测面板里 "agent swim lane" = 每 agent 一道（https://github.com/disler/claude-code-hooks-multi-agent-observability）。lanes 把 lane 定为活动类型站得住但非主流，且七类混了活动（research…evaluation）/ 角色（orchestration）/ 生命周期（waiting）三个维度——这与 §1.4 的裁决一致。
- **最值得借鉴的三条**：①归一化进度上的阶段构成图 + implement–test 重复 n-gram 卡壳检测；②公开规则表 + 覆盖率（"other" 占比），把 EnterPlanMode / ExitPlanMode / AskUserQuestion / Task 当硬边界信号；③状态与活动分离 + 混合分类（低置信片段小模型兜底，把人工纠正沉淀为评测集）。

### 3.3 SayDo 同类流程（调研，子代理带 URL）

- **六环节业界都有成熟实现**，2026 上半年 Anthropic 已把"手机派单 → 本机执行 → 推送回叫 → 手机审批"做成产品：Claude Dispatch（Cowork，https://claude.com/docs/cowork/guide/dispatch）、Remote Control（推送两档 + QR 深链，https://code.claude.com/docs/en/remote-control）、Channels、Slack；OpenClaw（原 Clawdbot / Moltbot，消息网关 + ACP 派 Claude Code / Codex / Gemini CLI，exec approvals 五档，https://docs.openclaw.ai/tools/exec-approvals）；Cursor Cloud Agents（Approval Agents 按风险批低风险 PR）；Codex cloud（approval_policy × sandbox 双轴）；Devin（置信度绿黄红，非绿先问，https://cognition.com/blog/devin-2-1）；Copilot cloud agent（触发者不得批该 PR）；Jules；Claude Managed Agents（工具级 always_allow / always_ask）。
- **就绪门先例**：Kiro requirements(EARS) → design → tasks；GitHub Spec Kit constitution → specify → **clarify** → plan → tasks → analyze → **checklist** → implement（https://github.com/github/spec-kit）；Claude Code plan mode + AskUserQuestion；Devin 置信度。业界"就绪"几乎都是**产物式**（spec/plan 被批）或**置信度式**，**未找到"缺关键字段即拒派"的结构化硬门**——SayDo 的 readinessSkeleton 有差异化。
- **审批分级**：Claude Code 六档 + auto mode 分类器（用户手动批准 93% 提示、分类器抓 83% 越权，https://www.anthropic.com/engineering/claude-code-auto-mode）；OpenHands 每 Action LOW / MEDIUM / HIGH / UNKNOWN + `ConfirmRisky`；硬件强审批趋势有 Anthropic Trusted Devices（会话级）、YubiKey 5.8（2026-07-21，per-action 触键签名）、1Password Secure Agentic Autofill；**编码 agent 产品做 Touch ID per-action 审批：未找到**。反面：The Register 2026-08-06 报道人类在环漏掉约三分之一危险请求；Anthropic 数据老用户 auto-approve 20% → 40%+。
- **回叫 / settle**：hooks Stop / Notification → ntfy 已是社区标配；`claude-ntfy-hook` 用 ntfy 动作按钮 Allow / Deny 回调；Stop hook `decision: block` + agent teams `TaskCompleted` hook 就是现成的 settle barrier。
- **记忆**：candidate → trusted 有产品先例（Cursor Memories 先批后存、Devin Knowledge pending、dsh-mnemon acceptance gates、dsh-memento 审批门）；forget 级联传播只见论文（GovMem https://arxiv.org/abs/2607.02579、Dependency-Guided Rollback Repair https://arxiv.org/abs/2608.10502）。
- **子代理的综合判断**（本会话认同）：通行应复用——采访用执行器 plan mode / AskUserQuestion / Spec Kit clarify；S1/S2 映射到执行器原生权限，别自建第二套；多执行器用 ACP；settle 用 hook；回叫用推送 + ntfy；预算用 `--max-budget-usd` 类。SayDo 差异化有背书——结构化就绪门、决策包（把验收标准 + 预算 + 审批档位写进同一契约者未找到）、S3 per-action 生物审批 + 收据、forget 传播。疑似过度设计——三档审批全自建 UI（与执行器原生提示重复）、S2 处于审批疲劳区（应压到 S1 或分类器，保持稀少）、三态验收 + 收据若与 PR 状态并行会成双真相源（收据宜派生自 merge 事件 + 审计日志）。

### 3.4 插件生态手册 / 脚手架先例（先例，最小核验）

- **Koishi / Cordis**（同一作者，最直接先例）：开发指南 https://koishi.chat/zh-CN/guide/ ；`create-koishi` 脚手架自动加 `koishi-plugin-` 前缀（https://koishi.js.org/manual/cli/development.html）；插件市场发布后约 15 分钟可搜到。对 DSH 的映射：`dsh-` 前缀 + `keywords: dsh-plugin` 已经是事实约定（1211 包），但**没有官方 `create-dsh-plugin`、没有官方市场**——这两个空位正被六个社区商店和 `dsh-testkit` 填。
- **Claude Code plugins**：`.claude-plugin/plugin.json` + `marketplace.json`，官方目录 anthropics/claude-plugins-official，https://code.claude.com/docs/en/discover-plugins 。对 DevSpace 的启示：DevSpace 自身可以直接做成一个 Claude Code plugin（skills + hooks + 一份 CLAUDE.md），装进每个插件仓即可，不必自建安装器。
- 未重新打开但已知稳定的先例：Obsidian `obsidian-developer-docs` + `obsidian-sample-plugin`（手册与模板分仓、审核清单）；VS Code `vscode-extension-samples` + `yo code`（按能力分目录的样例仓 + 生成器）；Raycast `extensions` monorepo + `ray` CLI（提交即审核）。共同点：**手册（官方）+ 样例/模板仓 + 校验 CLI** 三件套；DSH 目前官方只有第一件的 Host 半边，社区补了第三件（testkit / vetting），第二件（模板）仍空。

## 4. 是否该做一个 DSH 插件开发助手（类 HarmonyOS_DevSpace）

### 4.1 先盘存量：官方 + 社区已经有什么（本会话实读）

| 层 | 已有 | 位置 | 覆盖度 |
|---|---|---|---|
| 官方外部作者教程 | 第一个插件 / 工具 / 配置 / **打包与安装**（bundle vs profile 两个 manifest、层序、GitHub 安装 `prepare` + `allowBuilds` 警告、三种免 build 分发、范例 `deepseek-harness/turtle-ui`）；framework（service / events）；practice（llm-adapter）；cordis-tutorial 01–07 | `docs/user/develop/**`、`docs/cordis-tutorial/**`；均上网站（`website/docs.ts:145-237`） | Host 侧够用；**Client 侧为零**：`docs/user/` 全文 grep 不到 `dsh.client` / `ctx.slots` / `slots.register`（本会话 grep 退出码 1） |
| 官方内部规范 | `packages/client/AGENTS.md:94-100` "New plugin package checklist"（按仓内路径写，外部包做不到其中两步）；`packages/extensions/cordis-client-runner/src/client/slot-catalog.ts`（generated，42 槽全清单，面向模型的动态插件） | 仓内 | 权威但不是给外部作者的 |
| 官方内部 skills | `.agents/skills/dsh-*` 十个（code-review / doc-standards / pre-push-checks / prose-standard / merging-stacked-prs …） | 官方仓 | 全是**仓内贡献者**用的，不是插件作者用的 |
| 社区 skill | `NanmiCoder/dsh-agent-teams` 的 `skills/dsh-plugin-development/SKILL.md` v3.1.0（2026-08-13，中文，387 行执行清单：形态判断 → 官方模板选择 → bundle/profile 契约 → Host（Service / 工具 / HTTP / 持久化）→ Client（slot 四步契约 / Conversation Node / portal 兜底）→ 双 tsconfig + client bundle 纯度 → GitHub 分发 / HMR 边界 → 验证矩阵（真实组合 + scratch profile + `--dump-config` + 从零安装）→ 完成标准） | `npx skills add NanmiCoder/dsh-agent-teams --skill dsh-plugin-development`（本会话已下载核对） | **质量高、覆盖广**，是事实上的社区标准清单；缺脚手架、缺踩坑账本、缺版本契约、缺 doctor 脚本、缺生态索引 |
| 社区插件实物 | 10 个已装（结构见 §4.3 表） | `~/.dsh/profiles/web/node_modules` | 是最好的"活模板"，但**互相不一致**（peerDeps 三流派、engines 缺席 40%、构建工具四分） |
| 本机踩坑 | lanes / flowlanes / dsh-lanes 三仓合并攒下的取舍记录 | `dsh-workflow-lanes/docs/MERGE-2026-08-17.md`、`P0-design.md` | 十几条真金白银的坑（z-index、file:// 私有路由、loader unwrap `Config`、rc.5 wire 变体、stateVersion、结构化类型…），**只存在于一个插件仓的 docs 里** |
| 社区插件开发工具（npm 实测） | `dsh-testkit` 0.3.1（真实宿主生命周期测试：打包 → 装精确版 DSH → 装插件 → 启动 → 探测 → 卸载 → 重启，Docker runner，`init` 生成 `dsh-testkit.yaml` + GitHub workflow + `.agents/skills/dsh-testkit/SKILL.md`；**只支持 rc.6**）；`dsh-plugin-vetting`（装前静态体检）；`upstream-radar`（依赖安全）；六个商店/索引（`dsh-store` 自述 550+ 插件 11 分类；`dsh-find-plugin` 在 agent 内搜 topic） | npm registry | 验证与发现两件事**社区已经在做**，DevSpace 应"接"不应"造"：testkit 当发布前重门禁，本机再配一个秒级 doctor；查重直接查 registry / 商店 |
| 上游版本 | `@deepseek-ai/dsh` latest **0.1.0-rc.7**（08-17 发布）；rc.6 08-13；本地 checkout / CLI rc.5 | npm registry（实测） | 五天三跳，是 K-4 版本契约表存在的全部理由 |

### 4.2 裁决：值得做，但做"差量层"不做"手册"

**不做的**（否则是重复建设 + 过时风险）：
- 不重写 Cordis / DSH 概念手册——官方 cordis-tutorial 七章 + 每包 README 中英双语已经比任何转述都准，且随 rc 变；
- 不复制官方 docs 进仓（DSH 是 npm/GitHub 英文文档 + 本机 `node_modules` 里就有源码与 README，与鸿蒙"官方文档只有 Gitee 中文、agent 训练数据稀缺"的处境完全不同，HarmonyOS_DevSpace 的 2.7 GB 上游镜像模式在这里没有对应物）；
- 不重写 `dsh-plugin-development` skill——它已经是执行清单，直接引用（`npx skills add`）并在其上叠差量；
- 不做多工具 fan-out（Cursor `.mdc` / Copilot）——插件线的执行 AI 是 Claude Code / Grok / Codex，按 owner 现行分工即可，`.agents/skills` 镜像一份给 Codex 就够。

**做的**（每一项都是当前生态里确实没有的）：

| # | 交付物 | 借自 | 说明 |
|---|---|---|---|
| K-1 | **三份宪法**：`AGENTS.md`（跨工具权威）+ `CLAUDE.md`（= AGENTS + Claude Code 扩展）+ `README.md`（人）+ `llms.txt`（扁平索引），写明冲突优先级与"agent 不要读"清单 | HarmonyOS_DevSpace | 规则少而硬：取证顺序（本机 `node_modules/@deepseek-ai/*` → checkout → 官方仓浅克隆）、rc 漂移纪律、fail-closed 纪律、"不 import 运行时包用结构化类型"等 |
| K-2 | **脚手架模板 ×3**：host-only / client-only / dual，各自 `package.json`（`dsh.bundle.patch` + `dsh.client` + exports 骨架 + peerDeps 写法）+ `cordis.patch.yml` + 双 tsconfig + tsdown client 构建 + `normalize-client-banner` + `preflight` + 离线 fold/slot 测试 | 社区 10 插件共同结构 + lanes 现成脚本 | 就是把 lanes 的 `scripts/{preflight,normalize-client-banner,test-host,test-client}.mjs` 与 tsdown 配置抽成模板；标注 `verified_against: dsh 0.1.0-rc.5`（或 rc.6） |
| K-3 | **踩坑账本**（稳定 ID，如 `DSH-CLIENT-001`），每条 = 现象 / 根因 / 修法 / 来源 commit；配 fixture 或断言脚本 | HarmonyOS_DevSpace 的稳定规则 ID + 反哺闭环 | 种子已有 25 条（本会话从 MERGE / P0 / 社区插件 / fork 提交 / 官方 README 汇总，见附录 A）。每个插件仓踩到新坑就回流一条，CHANGELOG 标溯源 |
| K-4 | **版本契约表**：`rc.5 → rc.6 → …` 每档的 wire 差异（`session.id` 变体、slot 增删、projection 帧、`dsh.client` 字段）、社区插件 peer 现状、推荐 engines/peer 写法 | HarmonyOS_DevSpace 的 Version Contract YAML | 每次上游发 rc 就更新一行；插件仓的 `engines.dsh` 从这里取值 |
| K-5 | **本机秒级 doctor**（不装 Docker）：manifest 一致性（exports ↔ files ↔ 产物）、`cordis.patch.yml` 顶层数组 + `@` 引号、scratch profile `dsh plugin add` + `--dump-config` 断言插件层出现、client roster 检查、（可选）喂一条已知坏 manifest 看是否被抓；**发布前重门禁直接接 `dsh-testkit`**（它已生成 workflow + SKILL.md），不重写生命周期测试 | HarmonyOS_DevSpace `doctor.sh` 端到端自检 + `dsh-plugin-development` §8 验证矩阵 + `dsh-testkit` | 秒级自检与分钟级真机测试分层；testkit 只认 rc.6 这件事本身就要进 K-4 |
| K-6 | **生态查重手册 + 官方内置能力边界表**：不再手维护社区插件清单（1211 包、每天在长，维护不过来），改为一条固定流程——`npm search keywords:dsh-plugin` / `dsh-store` / `dsh-find-plugin` 三查 + 一份"官方内置到哪一步"表（goal / plan / workflow / todo / user-questions / approval / jobs / subagent / schedule / session-projection 各自边界，本文 §2.2 与笔记已备） | 本文 §2.2 表 + §3.1 实测 | 目的只有一个：动手前先查"这个坑位有人占了没、官方内置到哪一步"。本会话就是靠这一步发现了 taskboard / memento / traffic-light / 六家审批插件——若不查，§2 的结论会错一半 |
| K-7 | **skills 差量**：在引用 `dsh-plugin-development` 之上，加 2–3 个窄 skill：`dsh-plugin-scaffold`（按形态生成模板 + 跑 doctor）、`dsh-plugin-release`（preflight → npm pack 校验 → 从零 profile 安装复核 → 双语 README 校对）、`dsh-plugin-pitfall-check`（对 diff 跑账本断言）；frontmatter 用 HarmonyOS_DevSpace 的"激活条件 + 不激活负面清单"写法 + `manifest.json` 机读 | HarmonyOS_DevSpace skills 结构 | 每个 skill 200 行以内 |
| K-8 | **分发**：独立仓 `Octo-o-o-o/dsh-plugin-devspace`，形态直接做成一个 **Claude Code plugin**（`.claude-plugin/plugin.json` + skills + 可选 hooks + 一份 CLAUDE.md），每个插件仓 `/plugin install` 或放一个薄 wrapper（`CLAUDE.md` 三行：指向 devspace 的 AGENTS + skill 名 + doctor 命令）；`.agents/skills` 镜像一份给 Codex；不做 npm 安装器（插件仓少、都是自己的） | HarmonyOS_DevSpace monorepo 薄 wrapper 模式 + Claude Code plugins（§3.4） | 若日后对外，再考虑 `npx skills add` 形态（NanmiCoder 与 testkit 都这么发） |

### 4.3 与 HarmonyOS_DevSpace 的对照（哪些搬、哪些不搬）

| HarmonyOS_DevSpace 设计 | 搬 / 不搬 | 理由 |
|---|---|---|
| 三份宪法分层 + "agent 不要读"清单 | 搬 | 直接适用 |
| skill 双向触发（激活条件 + 不激活） + `manifest.json` | 搬 | 直接适用 |
| 稳定规则 ID + inline-suppress + fixture 回归 | 搬（改成踩坑账本 + doctor 断言） | DSH 侧没有"32 条 grep 规则"这种东西，但坑是真的、可断言的（manifest/patch/exports 一致性） |
| PostToolUse 钩子 exit 2 注入 stderr | 可选 | 插件仓小，`npm run check` 足够；hook 留给"提交前 doctor" |
| 反哺闭环（下游踩坑 → 文档 + 规则 + fixture + CHANGELOG 溯源） | 搬 | 这是 DevSpace 存在的核心理由 |
| Version Contract YAML + `verified_against` | 搬 | rc 漂移是 DSH 插件的头号风险 |
| doctor 端到端自检 | 搬 | 见 K-5 |
| 2.7 GB 上游文档镜像 + bootstrap 脚本 | 不搬 | DSH 文档在 npm 包与 GitHub 里、英文为主、agent 训练数据不缺；本机 `Reference/deepseek-harness` checkout 就是镜像 |
| 多工具 fan-out（Cursor / Copilot） | 不搬 | 执行 AI 固定，fan-out 是纯负担；只镜像 `.agents/skills` 给 Codex |
| grep scanner 规则内容 / OHPM 黑白名单 / 签名上架 / dev-cycle 具体实现 | 不搬 | 领域语义不同；TS 生态用 tsc/eslint/vitest 即可 |
| 主推 npm 安装器 | 暂不搬 | 插件仓都是自己的，薄 wrapper 就够；对外再说 |

### 4.4 一个不该忽略的顺序问题

DevSpace 的价值随插件数线性增长，随 rc 漂移次数线性增长。现在只有 1 个插件（lanes）+ 0 次经历过的 rc 迁移。建议**不要一上来建满 K-1…K-8**，而是：

1. 先把 K-3 踩坑账本（附录 A 的 25 条）+ K-4 版本契约表（rc.5 / rc.6 一行）+ K-6 生态索引（§2.2 + §3.1）落成一个仓，加 K-1 的 AGENTS.md（几十行）；
2. 做第二个插件（建议 `dsh-approval-tiers`，纯 Host、最不受 client 漂移影响）时**顺手**抽 K-2 模板与 K-5 doctor——有两个真实消费方再抽象，才不会抽错；
3. K-7 skills 差量放到第三个插件之后。

这样 DevSpace 从第一天起就有真实内容，而不是空壳手册。

## 5. 建议的下一步（不代 owner 拍板，只列可选动作与代价）

| # | 动作 | 代价 | 依赖 |
|---|---|---|---|
| N-1 | lanes v0.6.x 修 §1.3 的 L-1（README 与两条路由对齐）、L-3（第三方工具名映射改运行时推断或配置行）、L-4（登记 rc.6/rc.7 差异） | 小（半天） | 无 |
| N-2 | lanes v0.7 改主轴：行 = 会话，列 = 状态（排队 / AI 在做 / 需要你 / 等外部 / 已收尾），色 = 球权，活动类型降为 chip；README 与 taskboard / traffic-light 互相指路 | 中（fold 已有信号，主要是 client 重排 + 测试） | N-1 |
| N-3 | 建 `dsh-plugin-devspace` 仓：先落 K-3 账本（附录 A 25 条）+ K-4 版本表（rc.5 / rc.6 / rc.7 三行）+ K-6 查重手册 + 几十行 AGENTS.md；引用 `dsh-plugin-development` skill 与 `dsh-testkit` | 小 | 无 |
| N-4 | 第二个插件 `dsh-approval-tiers`（纯 Host：effect 定级 + 收据；S3 卡后置） | 中 | N-3（顺手抽 K-2 模板 + K-5 doctor） |
| N-5 | `dsh-readiness`（采访 + 就绪门 + 决策包 Conversation Node） | 大（移植 readinessSkeleton + 证据账本 + Conversation Node） | N-4；且要先与 taskboard 作者确认"卡片前置门"的接法，避免各做一套 |
| N-6 | 是否把本文结论回写 `docs/review/2026-08-16-now-vs-later.md:55` 那一行（"仓外实验"不变，只补"插件线三件套 + devspace"指针） | 极小 | owner 决定 |

**实施记录（2026-08-18）**：N-3 由 owner 另一会话落成 `~/WorkSpace/DshPluginAssistant`（dsh-plugin-assistant 0.1.0，钉 rc.7 @ 99f6f02fecdb，11 条扫描规则 + 事实层 + install-into）；N-4 已按其流程做成 `~/WorkSpace/dsh-approval-tiers`（Host-only，7 个提交，实施 = Grok 4.6 headless，两轮零上下文 Grok 对抗评审 + 返工，独立 readback 见该仓 `docs/evidence/readback.md`；`npm run check` / 规则包 scan 全绿，rc.7 scratch profile 真装真启动通过）。评审 1 暴露的移植源词表洞（`env`/`find` 在只读表、`tee -a ~/`、`chmod`/`ln`/`cp`/`mv` 圈外、包管理器非 install 动词一律 S1、`$HOME`、`git -C`、`| /bin/sh` 变体等）**同样存在于 SayDo `packages/daemon/src/tier1/cmdEffect.ts`**，建议回哺主线（另立批次，不在本文范围）。
| N-7 | lanes v0.7 并入 §1.6 的 R-1 角色 chip / R-2 角色钉选 + 越界徽章 / R-3 血统徽章（先做 fork seed 前缀是否被折叠的实测） | 小（client 派生为主；R-3 若要区分 fork/spawn 需 fold 多吃 `subagent/descriptor` + bump stateVersion） | N-2（同一次卡片层重排） |

## 附录 A · 踩坑账本种子（25 条，供 K-3 起步；来源缩写：[M] lanes MERGE 文档 / [P0] lanes P0 设计 / [C] 社区插件实物 / [F] 桌面 fork 提交 / [O] 官方文档或源码 / [N] npm 实测）

| ID（暂） | 现象 / 根因 | 修法 | 来源 |
|---|---|---|---|
| DSH-CLIENT-001 | `shell.overlay` 处于 z-index 20 堆叠上下文，被第三方右侧栏（z-index 50）盖住 | 主入口用 `sidebar.footer.action` + `document.body` portal | [M] |
| DSH-CLIENT-002 | 插件私有 webServer 路由在 desktop `file://` 壳里 `fetch('/plugins/...')` 打不到 | 关键动作走官方 Connection API | [M] |
| DSH-HOST-003 | Cordis loader 会 unwrap default class，模块级 `Config` 导出不生效 | Service 上放 `static Config` | [M] |
| DSH-WIRE-004 | rc.5 wire 变体：live `session.id` / workspace `workspaceId` 需归一化 | fold 入口统一归一 | [M] |
| DSH-PROJ-005 | `user/message` 可能早于 `step/start` 到达，fold 若丢弃则文本兜底失效 | 保留到 `step/end` | [M] |
| DSH-PROJ-006 | projection 注册没包 `ctx.effect` → unload/HMR 泄漏 | `ctx.effect(() => registry.register(...))` | [M] |
| DSH-PROJ-007 | 状态形状变了不 bump `stateVersion` → 官方缓存把旧行 forward-apply 成垃圾 | 每次形状/语义变更 bump | [M][O] |
| DSH-CLIENT-008 | 官方图标 primitive 要在 `dsh.client.inject` 声明并在 client bundle 里保持 external | tsdown external 列表 | [M] |
| DSH-DEP-009 | public npm 的 `@deepseek-ai/dsh-session-projection` 等运行时包版本与运行中的 rc 不一致 | 结构化类型 + `ctx.get('sessionProjections')`，不 import 运行时包 | [P0] |
| DSH-PATCH-010 | `cordis.patch.yml` 里带 `@` 的包名不加引号 → YAML 指示符错误 | 加引号 | [C] |
| DSH-PATCH-011 | patch 按 id 覆盖时替换整段 `config` 不深合并 | 覆写行重述全部键 | [C][O] |
| DSH-DESK-012 | 桌面壳：插件 exact `/api` 路由曾导致启动失败（fork `4a2dfad00f` 前）；exact 路由会顶替同名 RPC 方法，仍是已知限制 | 避免与 RPC 方法同名；升级 fork | [F] |
| DSH-DIST-013 | GitHub 安装：作者需自包含 `prepare`；用户需 profile `pnpm-workspace.yaml` `allowBuilds`；应 pin commit | 按 `publish.md` | [O] |
| DSH-CLIENT-014 | `dsh.client.inject` 仅信息性，不排序激活；激活由 service inject 决定 | 依赖用 `export const inject` | [O] |
| DSH-META-015 | `dsh.plugin.json` 是社区自发元数据，仓库无任何读取代码 | 别以为它有效 | [C] |
| DSH-BUILD-016 | tsdown 客户端产物需包成 `window.__ModuleLoader__.load({id,factory})` 形态 | lanes `normalize-client-banner.mjs` | [C] |
| DSH-HMR-017 | 包元数据（含"不是 client 包"的否定判定）按名永久缓存 → 插件集变更需重启；只有 bundle 内容变化能 client HMR | 文档写明重启边界 | [O] |
| DSH-API-018 | 运行时 `session.list` 隐藏 cold subagent rows → 回填后需再 list 一次合并 | lanes `refreshCold` | [O][M] |
| DSH-POLICY-019 | `tools/pre-execute` 缺省决定 allow，只有策略返回 ask 才进 approval；hooks 桥故障 non-blocking | 需要 fail-closed 的门必须自己在插件里拒 | [O] |
| DSH-COMPAT-020 | `SessionEvent` 无兼容承诺（`SESSION_FORMAT_VERSION=0`）；`packages/README` 标 stable 与 `AGENTS.md` pre-release 条款冲突，按后者 | golden fixture + 拒未识别事件 | [O] |
| DSH-DOC-021 | `docs/user/` 全文无 `dsh.client` / `ctx.slots` 教程；client 权威只在 `packages/client/AGENTS.md:94-100` 与 generated `slot-catalog.ts`（42 槽） | 取证直接读这两处 | [O] |
| DSH-META-022 | peerDeps / engines 无统一约定（`^0.1.0-rc.6` / `"*"` / 不写；engines 缺席 40%） | K-4 给推荐写法 | [C] |
| DSH-CLIENT-023 | 直接向未声明 slot `register` 会抛错 | `ctx.slots.inject(key, () => register)` | [O] |
| DSH-PROJ-024 | projection `apply` 必须同步、纯 JSON、同引用免工作；异步 `view` 返回 Promise 会被 `schema.parse` 打爆 | 按 projection README 契约 | [O] |
| DSH-VER-025 | rc.5（本地）/ rc.6（社区 peer、testkit 唯一支持）/ rc.7（08-17 latest）五天三跳 | K-4 版本契约表 + `engines.dsh` 单源 | [N] |

## 附录 B · 核验账（哪些是本会话亲手做的，哪些不是）

- **实测（本会话命令 + 输出）**：lanes `npm run typecheck` / `npm test` 均 EXIT=0；lanes 源码 `src/index.ts`、`src/classifier.ts`、`src/client/index.ts`、`README*.md`、`docs/*.md`、`package.json`、`git log -S` 两条路由引入提交；SayDo `BoardLaneGroup.tsx:1-18`、`Board.tsx:11-17`、`docs/plan/2026-08-15-default-runner-decision.md`、`docs/review/2026-08-16-now-vs-later.md`、`docs/plan/README.md`、`scripts/check-emoji.sh`；DSH `packages/session/session-projection/README.md`、`docs/user/develop/basic/publish.md` 头部、`website/docs.ts` 映射、`docs/user/` grep（退出码 1）、fork 提交 `6c505a173d` / `4a2dfad00f` 信息、`apps/desktop/README.zh.md:127,142`；`~/.dsh/profiles/web/package.json` 与 10 个已装插件的 `package.json`；`NanmiCoder/dsh-agent-teams` 的 `skills/dsh-plugin-development/SKILL.md`（GitHub raw 下载 387 行）；npm registry `keywords:dsh-plugin` 总数 1211、`@deepseek-ai/dsh` dist-tags、`dsh-taskboard` / `@isomoes/dsh-ikanban` / `dsh-traffic-light` / `dsh-smart-approval` / `dsh-memento` / `dsh-testkit` 六包元数据与 README 头。
- **子代理返回（本会话未逐行复核其 file:line，但抽验一致）**：SayDo 流程与实体摘要（3 路本地探索之一）；DSH 插件模型 A–G（42 槽清单、内置能力边界、安装链、社区结构表、官方指引缺口）；HarmonyOS_DevSpace 形态；同类看板 / 阶段分类调研（51 条 URL）；SayDo 同类流程调研（69 条 URL）。
- **失败**：DSH 生态子代理与手册先例子代理因周配额中止（22:00 重置后由本会话直接补 §3.1，§3.4 只做两次 WebSearch）；GitHub API 两次 504，`topic:dsh-plugin` 计数与上游 star 数未取到。
- **未做**：没有跑 `dsh-testkit`；没有从零 profile 安装 lanes 复核；没有打开 §3.2 / §3.3 的每个 URL；没有核对 fork `packages/` 与上游是否逐字相同（沿用 08-15 文档的同一保留）。
