# ADR-001 · 执行层:复用 Hopper 现状、锁版本、不等待、双路径

- **状态**:已决策(owner 拍板,2026-07-23)
- **决策范围**:SayDo"拍板之后"的执行层怎么做。**不含**产品载体路线(独立 vs 并入千手,仍开放,见 05 §2/§6)。
- **背景**:Hopper 与 OpenClaw-Kit 均在活跃改造中(Hopper:M3a 平台 schema 已冻结、Console/WS lane 在途;Kit:平台化 lane 流向 Hopper)。评估详见 `../../../history/PROCESS-JOURNAL.md` R22 与 `../../../research/codex-findings/02-hopper-integration.md`。

## 附注(2026-07-23,交付顺序)

**架构决策不变;交付定义按 owner 2026-07-23 裁定更新**:**首发交付 = 完整双路径**(owner 原话:"第一次能做的更完整,不用担心判断错误浪费工作量和时间")。开发**顺序**仍是路径一(Tier 1 全闭环)先行——这是依赖顺序使然(语音/记忆/决策核心两条路径共用,且 Hopper 桥前置 = 09 §14 封闭 + Hopper 裁决回填);但**发布定义不再是"Tier1 交付即首发完成"**:Hopper 桥、直达验收档、Demo 生成器属于同一次首发,契约落地后接续建完才算首发交付。原"P0.5"标签在计划中保留作**阶段序号**(P0.5-A/B/C/D/E + 收尾 = 首发的后半程),不再表示"第二次交付"。配套动作:对接 prompt(v4)立即发 Hopper 拿裁决;窄闭环 PoC 前移至 Phase 0 并行(用 Hopper 现状 CLI 即可做,验证"前脑+批式后端"假设)。**这是交付决策,不是架构变更,不 supersede 本 ADR 主体。**

## 决策

1. **复用现状**:重任务执行复用 Hopper **今天已跑通的任务流水线**(drop→triage→compile→调度→worktree→执行→verification→acceptance→review→merge→reconcile;MVP Phase 0–7 完成、测试全绿)。不依赖其未实现的平台控制面(M3b 流式/steer、M3c 命令服务、M3d workflow executor、WS4 通知 transport)——落地一块换一块。
2. **锁版本**:把 Hopper 当**外部系统**对接——只走文件契约(drop 文件 + `events.jsonl` 只读消费)与官方写入口(CLI/mutation 队列);不 import 内部模块、不共库。锁定 commit/tag(**裁决定稿 2026-07-23:`ea3fb31fd04946a66229022782b43daf57bf3fe4`** = c4c29c6 生产代码 + 两个 docs commit,tag `v0.1.0-saydo-baseline.1`;裁决 §2.6.1。**2026-07-25 已按 X1 条件切锁 baseline.2 = `bdd1e548…`(tag `v0.1.0-saydo-baseline.2`),现锁以 09 §11 [hopper] 为准,baseline.1 降级为过渡兜底路径**)。**同机隔离**:Hopper 在本机 main 活跃开发,锁定版本以**独立安装副本 + 专用 vault** 运行,bridge 启动时断言版本/schema digest,防 dev 版进程污染。升级走显式仪式:换版本 → 跑契约测试(golden fixtures + drop 四种 outcome + schema v2 fail-closed + MutationResult 词表)→ 才切。
3. **不等待**:Hopper 平台化(自估 10–12 周)不阻塞 SayDo。语音前脑三块(语音管线/记忆奠基/采访决断)与其完全正交,立即可开工;窄闭环 PoC 只依赖现状能力。
4. **双路径**(架构层保留两条;**交付定义见 §附注:两条同属首发,路径一先行、路径二契约落地后接续**):
   - **路径一 · Claude SDK 薄执行器**(daemon 进程内,由执行客户端 C2 持有——Brain 仍无执行权,副作用经 C 层,08 §3 规则不变):轻任务/逐步确认档/需运行中交互审批(Tier 1);不经 Hopper。**开发顺序上先做这条。** **[addendum 2026-07-24]** 后端抽象为 **Tier 1 薄执行器**(接口=canUseTool 语义;后端 claude_sdk 产品缺省 / cursor_cli dev 缺省,07 D8;执行层决策未变,仅记录后端可换);取消/改需求语义以 09 §6.1 为准(`cancel_settled→queued`=同卡修订 / `→superseded`=显式换卡)。
   - **路径二 · Hopper 现状流水线**(首发后半程,阶段号 P0.5;前置 = 09 §14 封闭 + Hopper 裁决):重任务;drop 进 Hopper,消费事件回叫,验收决策经官方入口提交。届时该路径只有直达验收形态(步序循环排 P1)——**派重任务必须让用户在拍板时显式确认切直达验收档并念清单,禁止静默升档**(默认档是逐步确认,静默切换 = 静默扩权)。

## 任务进度可见性与操作归属(路径二)

**原则:用户日常全程留在 SayDo;Hopper Console 是工程排障面,普通流程不需要去。** 真相源不变:执行状态归 Hopper,SayDo 展示的是投影。

### 看(读路径)

- SayDo 任务卡显示 Hopper 状态的**用户语言投影**(粗阶段条 + 可展开的事件时间线):

> 投影规范(**按 Hopper projector 实际语义核对**;task 粗状态与 attempt 状态是两层,SayDo 视图由"task status + 最新 run/attempt 事件"共同推导,唯一映射表维护在 `../../09-data-contracts.md` §7):

| Hopper 侧(真实层级) | SayDo 显示 |
|---|---|
| task=received(分诊前)/ task=ready(可执行) | 已接单·分诊中 / 排队中(**"排队"只许说 ready**;draft/plan_needed/research/deferred/conflict 是"等人"的分诊出口,话术见 09 §7——裁决 §2.3.4) |
| task=running(自 RunReserved/WorktreeCreated/PromptCompiled 起,attempt N) | 执行中(第 N 次尝试)——**P0 如实降级**:批式 runner 中途无事件,"当前活动/已花"待 M3b/M3c 后才有(不编数据;成本 unknown 显示"未知"而非 ¥0) |
| verification/acceptance/docs 闸门事件流 | 在过验证闸门 |
| task=review + **settle 确认**(见 09 §7 settle barrier) | `ready_for_review`(等你验收)→ 触发回叫 |
| task=blocked(triage/守门级) | 卡住等你:{问题文本,来自结构化 blocked 合同} |
| merge 流程 → done / failed(含 attempt cancelled 投影为 failed+cancelled_by_user) | 合并中 → 已交付 / 失败(取消由该 run 取消终态派生,**task 无 cancelled 状态**) |

- 语音 `get_status` 走同一投影("到哪了?"→"第二步跑完了,正在过验证闸门")。
- **诚实进度**:不做假百分比,只展示"阶段 + 当前活动 + 已花预算"(agent 步数 ≠ 进度)。
- 实现:P0 文件轮询 `events.jsonl`(cursor + gap 处理);P1 切 Hopper Console 的 localhost 只读投影 API/SSE(更稳、免锁)。

### 操作(写路径)——每个动作一个归属

用户操作**全部在 SayDo 完成**,SayDo 翻译成 Hopper 官方写入口(幂等、带 `origin=saydo-bridge`——审计标注非信任依据,裁决 §3.1;批次 A 落地前该旗标缺位,先靠 caller_context=automation 区分),绝不直接写 `events.jsonl`/frontmatter:

| 用户动作(语音/屏幕) | SayDo → Hopper(现状事实已核对) |
|---|---|
| 取消任务 | cancel 命令 |
| 改需求(路径二无原生 steer) | cancel + 重新 drop 修订任务卡(supersede 关联、幂等 key 不复用;旧 run 竞态完成时旧回叫由 bridge CAS 抑制;Brain 如实说明"正在跑的这轮会作废") |
| 补充信息 / 处置 blocked | **裁决已定(§3.4)**:分诊缺信息=改卡正文补信息 → re-drop(updated_draft)→ `unblock` 放行;答案注入=`retry --message`(一答一 run,留痕,不复注;副通道:最后一条 request-changes message 会一并进上下文,勿当一次性答案信道);**守门级 blocked 不可 unblock 洗白**——必须改方案或人工处置。**retry 闸门(X3,09 §6.2)**:`hopper retry` 不查风险白名单直连执行——bridge 自动 retry 前重读投影 risk,high 不自动 retry;分诊 blocked 恢复只走 re-drop→unblock,不走 retry。**retry 默认复用 worktree**:base 落后只告警不重建,进度展示须注明"本轮在旧 base 上跑"(Hopper 反馈 §2.5) |
| 验收通过 / 打回 | review decision(approve 附 S3 收据编号 / reject + 意见文本);**打回后重跑走 `retry --message`** |
| 合并 | **Hopper 现状 approve 不触发 merge(merge 是独立命令)**——流程:用户 S3 屏幕强认证 → 提交 approve → **SayDo 随后调用 `merge`(S3 收据绑定 merge 动作本身)**;冲突/verify 失败按结构化返回转 merge_failed。**保守缺省收窄(R-A 2026-07-26,09 §3.3 红线③)**:P0/P1 SayDo 不自动调 `hopper merge`,先人工交接;本行"SayDo 调用 merge"的解禁待 owner 单独裁决(需先解决 Hopper 侧 merge origin 归属与 split-brain,登记 09 §14-A9)——落定前按人工交接实施 |
| 看 diff/日志全文 | **P0 首选:自包含 trust-report HTML 直读**(Hopper 反馈 §4.3):`<vault>/20-Runs/Summaries/<runId>.html` 零外链单文件——**注意 `RunSettled.summary_path` 指向的是同 basename 的 `.md`**(Codex 复审 A2 实测):校验 .md 在受信 vault 内后受控映射到 `.html` 再嵌入,越界路径/缺文件按证据缺失;**报告内含 emoji,SayDo 呈现层做确定性转换**(11 §5.5,原始文件与 digest 不动)。SayDo 拥有专用 vault ⇒ 直接读文件嵌 iframe——不经 Console,绕开整个 token 问题,砍掉路径二证据视图大半自建。Console 深链保留为工程排障面:**深链凭据待对接裁决**(Console 现状 read/write 共用 token,token 随进程存亡、无轮换 ⇒ **深链 URL 不可缓存,每次现取 tokenFile**)——需只读 scope token + 官方 URL 获取方式 + Console 未运行时的拉起归属,落定前深链不上线 |

### 双入口防 split-brain(目标语义,需 Hopper 微调承载)

Hopper Console 与 SayDo 都可提交 review 决策——**决策真相源 = Hopper 状态机,先到先得、后到拒绝**。**现状事实**:Hopper approve 后任务仍停在 review,重复 approve 甚至 approve 后 reject 都会被接受(可翻转)。**裁决落点(§3.2)**:正式 first-wins=M3b Command 的 per-subject CAS(主键 task_id+run_id+evidence_digest);过渡=`--expect-status/--expect-last-event` 旗标(批次 A)对**全局尾** CAS——专用 vault 低流量下即"先到先得"的可用近似,conflict 时重读对账;approve→reject 人工翻转保留,SayDo 消费到他端终局即收据 `voided_by_conflict`。事件记录 decision origin(saydo-bridge/console/cli;origin 随批次 A 落地);SayDo 消费到"决策已在别处做出"时同步自身状态并告知用户,**本地已采集未提交的收据标记 `voided_by_conflict` 留痕,永不重试提交**。SayDo 的审批收据是**授权留痕**(谁、凭什么批的),不是第二份状态。

## 协调点(需两项目对齐,已写入对接 prompt v2)

> **2026-07-23 全部裁决(终稿:Hopper 仓 `docs/plan/2026-07-23-saydo-integration-adjudication.fable.md`)**,逐项落点标注如下。

1. 事件 schema 冻结纪律(additive-only + schema_version;M3a 已冻结,利好)——**已成文**(SCHEMA-FREEZE-M3A,v1 生命期不轮转事件文件);
2. Console 只读投影 API + **只读 scope token** 给 SayDo 官方消费口(优于裸读文件)——**排 WS4**(落定前深链不上线,P0 轮询文件);
3. review 决策冲突拒绝语义(`expects` CAS 暴露)——**过渡=expects 旗标(批次 A,全局尾语义),正式=M3b per-subject CAS**;
4. **merge / retry --message 写入口**——**现状已有且核实**,origin/receipt 审计透传随批次 A;
5. blocked 事件带结构化问题文本——**现状已有三来源**(missing_information[]/findings/reason;question_id/选项=M3b DecisionRequest);
6. "review 就绪已 settle"的官方判定口径——**RunSettled 已提前实施(随批次 A,不等 M3b)**:主判据=消费 RunSettled+廉价复核,§2.4.2 机械判定降级为事件缺失时的对账兜底(09 §6.3);
7. 执行触发方式与 project/vault 映射、专用 vault 初始化——**维持 bridge-driven(drop→scan→queue explain→`hopper run <task-id>`,baseline.1 过渡用 `drain --max 1`)**;Hopper 侧已评估并**否决「daemon 为主」**(daemon 只跑 low 而我们的任务高频 medium;且"投递面=授权面":drop 即武装、撤回变竞态、bridge 死 daemon 活)。**daemon 是 P1 优化项,且其预算护栏不是硬护栏**(`daily_budget_usd` 缺省 5、不配也启动;`hard_budget_enabled` 默认 false=只告警;订阅 runner 成本估算可能低估;实际熔断只剩 per-run 超时)——若未来启用:`hard_budget_enabled=true` 必配 + 专用 vault 外部 intake 恒关 + "drop=不可撤回授权"纳入念读 + 声明 bridge/daemon 存活解耦(Hopper 反馈 §2.2)。

## 现状/目标标签(防把 ADR 当 current API 清单读)

上文操作归属与投影设计中:**CURRENT**(Hopper 今天就有)= drop/事件流/worktree/闸门/review 三命令/merge/cancel/unblock/retry/Console read 路由 + **裁决核实新增**:blocked 结构化三来源、cancel settled 机械判据、settle §2.4.2 机械判定;**SAYDO-OWNED**(我方自建)= settle barrier 兜底、CAS 预检、收据体系、回叫 outbox、supersede 状态机、投影转译;**HOPPER-CHANGE**(裁决已分箱排期)= **批次 A:已交付(2026-07-24,`v0.1.0-saydo-baseline.2` 已打;切锁 commit = `bdd1e548…`——tag 对象 SHA ff6cee28… 不可用作断言,Codex 复审 A1;diff 面清单与词表/harness 附录已落 research/)**——capabilities/vault.json/project show/run \<task-id\>/--req-id/--expect-*/--origin/--receipt/last_run_cost,**且 RunSettled 提前落地(不等 M3b,`capabilities.settle_event='runtime'`)**;切换开关(SayDo 侧契约测试对 baseline.2 全绿)**已于 2026-07-25 达成并切锁**(09 §11 [hopper] 现锁 `bdd1e548…`;baseline.1 过渡兜底保留为降级路径非缺省);**M3b**:per-subject CAS/cancel 两态/DecisionRequest/voice channel 字段位/受信 token;**WS4**:只读 scope token/交付证据版本化读口/NotificationIntent transport;**FUTURE** = effect enforcement/steer。未切换前 HOPPER-CHANGE 项均以 SAYDO-OWNED 兜底运行(裁决 §5 批次 D 与我方清单一致,无重复建设)。

## 后果

- **正**:不重建 Hopper 的既有成熟度(**`c4c29c6` 提交记录的门禁数为 unit 1076 / golden 48 / e2e 198;此为锁定快照口径,升级时由契约 CI 重跑,非本项目实测**);吃到 Hopper 在途改造红利(交付合同/逐 AC 证据/回执与 SayDo review 证据视图同构、Console API);与"Kit 汇入 Hopper"的平台化战略同向。
- **负/代价**:活跃改造期有格式漂移风险(对策:锁版本 + 契约测试,不追 main);路径二 P0 无运行中 steer(降级 cancel+重 drop,如实告知);Hopper 侧需按对接 prompt 做少量微调(幂等/origin/settle 口径)。
- **契约测试清单(SayDo 侧维护)**:drop 字段映射往返、事件重放幂等、gap/损坏行、settle 判定、cancel/review/unblock 幂等、cost 对账——引用 Hopper golden fixtures,升级版本必跑。

## 关联

- 对接需求 prompt(粘贴到 Hopper 会话用):`../../../research/hopper-integration-request.md`
- OpenClaw-Kit:不作运行时依赖(其工程增量流向 Hopper),仅抄规格(Genesis/Spec Triad/Readiness/cancel 原语设计)——无需对接 prompt。
