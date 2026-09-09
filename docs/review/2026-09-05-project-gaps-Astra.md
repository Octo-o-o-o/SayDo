# SayDo 当前缺口与投入判断 · Astra

日期：2026-09-05。性质：代码与架构的只读评估；建议不构成实施授权，不改现役排产。

取证基线：`bcf8ea855f25b177888d9159f75e49214f3dd892`，来自本次 `git log -1 --format='%H %s'`。在 detached worktree 中阅读生产代码并运行合成探针；主工作区当时的未提交内容是 ECC 研究、索引与 journal，未把这些研究文件当成产品实现。没有访问真实凭据、生产数据库或常驻实例。

## 1. 我的判断

**当前最值得投入的是：把现有能力变成可信的操作闭环，补齐数据与连接的安全边界，再把语音关键路径做成可测、可控的低延迟链。** 现在没有充分依据支持重做整套架构、再增加一层 agent 编排、换数据库或同时扩很多连接器。

项目已经有明确的状态所有权、共享 contracts、独立就绪评估、审批收据、恢复逻辑和备份实现。这些基础值得保留。真正的落差发生在跨层连接处：页面上的动作与数据库状态不完全对应；页面快照与后台变化脱节；“有备份”没有覆盖迁移前恢复点；“有延迟统计”没有完整守住延迟合同；“能调用模型”没有等同于“能可靠处理外部资料”。

本次对照了既有[项目缺口总案](../plan/2026-08-28-project-gap-closure-program.md)、[当前计划](../plan/IMPLEMENTATION-PLAN-2.md)和[执行单路线 ADR](../adr/design/ADR-005-execution-single-route.md)。已有问题沿用原编号，不重新包装成一套大计划。**这次最有增量价值的发现，是看板的刷新/部分失败语义，以及语音延迟判定与实际处理方式的落差。**

| 投入方向 | 当前判断 | 建议时机 | 与现有安排的关系 |
|---|---|---|---|
| 现役操作、状态与预算准确性 | 直接影响人能否正确操作，优先级高 | 继续现役链 | G-A3，PG-01B 止损、PG-02 关闭 |
| 远程凭据、请求准入、审计隐私 | 扩能力前必须收住的边界 | 继续现役链 | G-A6/A7/A8/A9，PG-01B/04/06 |
| 数据升级与恢复 | 出错时会损伤长期积累，优先级高 | 升级安全由现役链关闭 | G-A5，PG-05 |
| 页面实时性与业务读模型 | 本次重点增量；与 UI 闭环一起考虑 | 后续候选，实现前由 owner 显式入排产 | PG-02 只核对 action denominator；不包含新增聚合读口和失效刷新 |
| 语音延迟与流式处理 | 核心体验的技术缺口，值得独立小批 | 安全链后另立获批切片 | 补充现有 SLO；SP3c 只承担 voice restart 共同门，不承载流式化实现 |
| 工具与外部资料处理 | 缺的是一条可靠能力链 | 一个明确选定的能力切片 | G-B1/B11、SP5/SP6 条件包 |
| 诊断、安装后的维护 | 能降低后续支持和排错成本 | 下一次实际分发变化时 | G-B12/B13；复用现有 status/health |

当前计划指针是 `active=none,next=PG-01B,last_closed=PROC-01`；串行链为 `PROC-01 → PG-01B → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop`。本表不改变这个顺序。

## 2. UI 首先需要修的是操作含义和状态来源

**这是现在最容易把“页面已经做出来”误当成“功能已经可用”的地方。**

本次读到的正式路径：

- `App.tsx:80–88` 把 Focus、Review、Records 指向 redesign 页面，不是仅供演示的组件。
- `pages/redesign/RecordsPageRoute.tsx:70–82` 的“放弃”调用 `/archive`，只在理由前加 `abandon:`。服务端 `api/focuses.ts:143–153` 实际写入 `archived`，返回的也是 `archived`。这是动作语义错误，不是文案偏好。
- `hooks/redesign/mappers.ts:260–277` 在缺少 Focus 预算读口时构造 `{spent:0,max:0,currency:"CNY"}`。合成探针复现了这个结果。未知金额因此被转换成了有确定含义的数字。
- `FocusPageRoute.tsx:88–96` 的决策包、模拟叫醒、采访选项仍返回“接线后续批”；`ReviewPageRoute.tsx:117–119` 的推翻判断也只提示。**不能据这些分支推断所有任务操作都没接**：同页的一些任务动作会打开真正的 `TaskModal`，其写口需要按具体动作分别核对。
- `brain/liveTools.ts:983–989` 的 `issueDispatchReceipt` 对直达验收语音确认仍返回 `direct_mode_not_wired`。这是有意的保守拒绝，应与入口、能力说明保持一致，不能把拒绝删除来“补功能”。

上述路径均位于 `packages/console/src/` 或 `packages/daemon/src/`。已有 G-A3 对此登记正确，当前代码仍能找到相应问题。

**最小有效投入**：沿 PG-01B/PG-02，为每个现役动作对齐“界面入口 → 请求 → durable 状态变化 → 重新打开页面后的结果”。无实现的动作禁用并说明原因；未知值保留 unknown；已有真正写口的动作复用，不再新增一套按钮后端。

验收要看具体结果：放弃不能落成归档；缺预算不能显示为零；点击确认后刷新仍保持相同结果；无后端的动作不能呈现为可执行。视觉层保持现有设计语言即可，重新换皮的回报明显低于这一轮接线。

## 3. 正式页面还缺可靠的更新与部分失败语义

**建议把这一项作为本次最值得追加核对的内容。** SayDo 的任务会在后台继续推进，页面仅在进入时读取一次，无法充分承担控制台职责。

`hooks/redesign/useBoardPageData.ts:49–69` 先取 focuses 和 attention，再为每个 Focus 单独取 detail，即 `N+2` 个请求；`:65–66` 将详情请求失败转换为 `null`，`:99–100` 随后跳过该 Focus。`:150` 的 effect 只依赖手动递增的 `tick`。正式 `BoardPageRoute.tsx:83–89` 在本页弹窗操作成功后会 reload，但没有因此覆盖独立发生的后台变化。

`useReviewPageData.ts:87` 同样只随 `taskId/tick` 更新；`useFocusPageData.ts:142` 随 `focusId/tick/currentSessionId` 更新。**这里的结论限定于这些正式 redesign 数据钩子，不泛化成全站没有 WS 或重连**；项目的语音 WS 与移动重连实现确实存在。

本次用 headless Chromium 运行生产 `useBoardPageData`，所有 API 都被合成 fixture 截获：

```text
initialFocuses: 20
initialRequests: 22
observationMs: 2000
automaticRefreshRequests: 0
retainedOldGeneration: true
afterOneDetailFailure: { visibleFocuses: 19, pageError: null }
```

这证明了请求扇出和详情失败被隐藏。两秒观察本身不能证明永远不刷新；“没有自动失效来源”的判断还依赖上述 effect 与调用点代码。**22 次请求也不是慢页面的性能实测，不能据此宣称已造成卡顿。**

更深一层的问题在读模型：`useBoardPageData.ts:73–91` 用 attention 项目及其颜色近似任务状态；`useFocusPageData.ts:101–123` 因缺少相应列表读口，将 tasks、memories 留空。通知投影不能长期代替业务对象的状态来源。

**最小有效投入**：作为后续候选能力，由 daemon 提供页面真正需要的、带 revision 的聚合读口；前端通过现有事件或有界轮询让快照失效，回到前台时刷新。先解决“后台变了、页面不知道”和“请求失败、事项消失”。新增实现不扩大 PG-02 的既定范围，也无需为此引入独立 CQRS 平台或新数据库。

建议验收：后台把任务从 running 推到待验收，停留页面能在约定时限内更新；一个 Focus 详情失败时保留该项并显示重试；请求量不随列表项数逐项增长；任务状态取任务读口而非颜色猜测。刷新时限和容量数字需在该批合同中明确，本报告不替产品新增默认承诺。

## 4. 架构最该补的是信任边界与数据生命周期

### 4.1 远程连接、模型请求与审计，沿已有链收口

| 已确认的代码事实 | 为什么值得投入 | 最小收口方向 |
|---|---|---|
| `net/capToken.ts:11–21` 复用持久全局 token；`net/pairUrl.ts:25–34` 放入 URL；Console `lib/api.ts:20–26,47–50` 存 localStorage，并用于 WS query | 缺逐设备隔离与撤销粒度，泄漏后影响面过大 | 按 PG-01B 关闭正式远程业务面；重开仍走 D18/ADR，不顺手引入第二套组网协议 |
| `lib/setupApi.ts:1334–1343` 让未知 API 端点共用 `OPENROUTER_API_KEY` 名；daemon `providers/resolve.ts:80–89` 按 env 名取 key，`openaiCompat.ts:113–117` 带 Bearer 发请求 | 端点、凭据与权限没有形成独立绑定，增加多个端点会放大配置耦合 | 按 PG-06 建请求前准入与独立凭据绑定；先阻断不明确的路径，再扩接入 |
| `SetupWizard.tsx:1096–1101` 首载取 CLI capability；`config/cliCapability.ts:899–909` 的发现会执行 `--version` | 自动展示配置页与主动执行第三方程序之间缺清楚边界 | PG-06 区分静态发现与明确触发的受控探测 |
| `live/dialog.ts:1015–1021` 把模型句子片段写入 audit；`storage/dao/misc.ts:83–99` 原样序列化 meta | 不可变审计里一旦进入敏感原文，事后治理困难 | PG-04 先阻断新增原文；审计字段白名单、digest、受控元数据分别处理 |

这里没有声称公网匿名可利用、没有做真实攻击，也没有读取私有 token。`setupApi.ts:1346–1359` 已限制未知端点复用既存 key，所以**不能把共享 env 名的问题写成“UI 无条件偷用旧 key”**。当前问题是后续绑定仍共用槽位。

审计探针只向临时数据库写入合成句子，输出 `rawSentencePersisted: true`；结合生产调用点，证明 sink 没有把这类原文改为 digest。TTS 脱敏与 Git 隐私扫描都不能替代写入端约束。

### 4.2 备份已存在，但升级前的恢复保障还没有闭合

`storage/db.ts:11–24` 打开即迁移；`:39–45` 根据已应用版本求差，没有先拒绝超前版本。`backup/cli.ts:21` 先调用这个会迁移的 `openDb`，再在 `:26–30` 做备份。

本次临时库实际含 31 个迁移版本，最大版本 31。加入合成超前标记 `9999` 后重新调用生产 `openDb`，输出：

```text
futureSchema: { opened: true, futureMarker: { version: 9999 } }
```

这是“未知 schema 未被拒绝”的结构性复现，**不是发生了数据损坏的证据**。`backup/snapshot.ts:156–164,304` 已有快照检查和 SQLite backup 调用，不应建议再造一个备份系统。

**最小有效投入**：按 PG-05 把只读版本检查、迁移前恢复点、复制库演练与失败停机接进现有入口；backup 入口不能为备份而先升级。验收包括旧 binary 拒绝新 schema、缺口版本拒绝、迁移失败后从恢复点启动，以及审批/任务/记忆引用仍一致。SQLite 的官方 [Online Backup API](https://www.sqlite.org/backup.html) 支持一致快照，项目已有这个基础；缺口主要在调用时序和恢复验证。

## 5. 语音性能：先修测量口径，再做关键路径流式化

**这里值得投入，但目前不能给真实端到端速度打分。** 本次没有运行真实 ASR、LLM、TTS，也没有把合成探针的时长冒充实际体验。

发现三个具体落差：

1. **SLO 判定缺尾部约束。** `docs/03-architecture.md:62` 要求 P50 ≤ 1.5 秒、P90 ≤ 2.5 秒；`obs/latency.ts:123–133` 虽计算 P90，`passPublish` 却仅判断 P50。20 条合成 trace，16 条 1 秒、4 条 10 秒，返回 `p50=1000,p90=10000,passPublish=true`。这证明统计出口会漏掉 P90 超限，**不等于整个发布流水线已被证明假绿**。
2. **首 token/首字节名称超过当前测量含义。** `openaiCompat.ts:113–131` 等完整 JSON；`brain/dialogLoop.ts:643–649` 在第一次 chat 返回后记 arrived。`pipeline/hub_client.py:493–511` 等 `tts.synthesize` 返回整句音频后才发送 `tts_first_byte`；`doubao_tts.py:148–158` 收集 chunks 后 join。对这条 API 级联路径，当前是整次响应/整句合成的近似时间。`index.ts:2906–2908` 已统一跨进程时基，应保留，不重复报旧时钟问题。
3. **失败与缺段轮次缺乏同等可见性。** `obs/latency.ts:75–101` 只有五段齐全才进 completed；partial Map 没看到超时淘汰，completed 则有 500 条上界。只看完整 trace 的分位数容易漏掉无声、被中断或未合成成功的轮次。这里是代码层的观测缺口，未测量真实泄漏速率。

**建议分两刀，规模可控：**

- 第一刀修准确性：P50/P90 同时守门，样本不足明确标记；记录成功/超时/取消/缺段的分母；近似指标如实命名；partial 有界回收。用固定输入证明“尾部变坏会红、缺段不会伪装成功”。
- 第二刀只覆盖一个现役 API 级联路径：LLM 输出增量进入受控分句，TTS 首音频块可以前推；跨层取消与 playout watermark 一起验证。保留“未听到的文本不变成对话事实”和“工具参数完整校验后才执行”的红线。

不要先用更贵的模型、更多 provider 或换语音框架解释所有延迟。先记录转写完成、模型首字/最终响应、工具耗时、TTS 首块/完整句、实际出声，区分聊天轮与工具轮，才能定位时间花在哪里。工具轮的长操作应有真实状态反馈，不能用一句过渡语替代整体耗时统计。

## 6. 容量与架构维护：有针对性测量，避免过早拆系统

除看板请求扇出外，`obs/logger.ts:55–60` 每条日志同步 `appendFileSync`，未隔离写失败；因此磁盘慢或日志写入错误可能进入业务关键路径。这与 G-B14 一致，值得在长期运行批次中验证。它不构成“SQLite 已经成为瓶颈”的证据。

建议先跑一个有限负载面：在声明支持的并发内执行任务，同时打开 20/100 个 Focus 的看板、读取长时间线、产生受控日志量；测 API P95、主线程延迟、请求数、RSS 和失败比例。20/100 是建议的工程样本规模，不是新增产品支持承诺。可复用 Node 内置 [monitorEventLoopDelay](https://nodejs.org/api/perf_hooks.html#perf_hooksmonitoreventloopdelayoptions) 观测事件循环，不必先引入外部观测平台。

若日志故障可阻断业务，优先做有界写队列、容量/保留期与失败隔离；**不可变审计的持久性不能跟普通日志一起改成可丢弃**。若热点是看板读放大，先修聚合读口；若热点是真实检索，才考虑索引或检索升级。

代码模块确实较大：本次 `wc -l` 得到 `index.ts=4055`、`brain/liveTools.ts=2564`。但行数不是投入理由。更合理的是让新增/改变的跨层读口进入 `@saydo/contracts`，服务端与客户端都做 runtime parse，触达哪个边界就收敛哪个边界。保留 daemon 为状态唯一持有者、pipeline 可重启、Tier1 唯一生产执行路线。不要恢复已 deferred 的 Hopper 双轨维护，也不建议新建微服务平台。

## 7. 工具与外部连接：补一条可信资料链，别先造连接器平台

**现在的主要限制，是外部资料缺少可引用、可复核、可验收的生产路径。**

本次读到的 `brain/liveTools.ts` 注册面以项目、本地文件、任务、审批、记忆和 Focus 为主；`evaluator/snapshotter.ts:60–72` 只接 `repo_file/user_edit/user_utterance`，`web/artifact` 明确 unsupported。即使新增一个“搜索网页”按钮，外部事实也不会因此自动获得可验证的来源链。

模型供给也要分清协议：`providers/openaiCompat.ts:113–131` 固定 Bearer + `/chat/completions` + 完整 JSON 解析。不同供应方出现在选择器里，不等于所有协议、工具调用、取消、usage 与错误恢复均兼容。PG-01A 已收窄公共 claim，本报告不把旧文案问题重复算作尚未修复。

**最小有效投入**：在 PG 安全链之后，按已有条件包选一个只读能力；如果目标是资料分析，先做“读入一种资料 → 保存不可变内容快照与出处/时间 → 引用可回读 → 产物可导出并验收”。从一个文件类型或一个受控 Web 来源开始即可。没有选定能力之前，不预建十几个 provider、OAuth 控制台或通用连接器市场。

这条切片的验收应包含正常读取、分页/截断、授权失效、限流、资料变化、恶意工具输出，以及引用失效后的诚实降级。若继续接入一个 SaaS 来源，仍须满足 SP6 的具名 owner 选择与维护能力条件；条件未成立时保持候选。先读后写，写能力另需副作用判定、幂等键、操作收据和结果未知时的对账，不能套用模型请求的通用重试。

这是 G-B1/B11 的具体最小化方向。报告未替 owner 选择业务领域，也没有验证任何未接入供应商的当日兼容性。

## 8. 使用与维护工具：复用已有诊断，做一个可解释的入口

README 已准确说明一键包含 daemon/console、不含 pipeline；`packages/cli/src/options.ts:4–5,30–33` 当前命令集合是 `up/status/open`。因此不该再建议“先做一键安装”，也不能把这一包当完整语音分发。

值得投入的是一次分发变化时顺手形成最小 doctor/诊断入口：汇总已安装版本、实际运行版本、state root 的脱敏标识、daemon/pipeline 可用性、配置生效世代、哪些能力不可用以及下一步怎么恢复。复用现有 status、health、setup 与 provider diagnostics，不另造大向导；默认不读取凭据原文、不触发模型请求、不执行第三方探测。

验收是同一诊断能区分“服务没起”“旧版本还在运行”“pipeline 未安装”“配置待生效”“仅某个上游不可用”，输出可安全分享。升级/卸载/跨平台常驻的完整生命周期仍按 G-B12 的分发条件启动，不因本报告扩大支持承诺。

键盘与读屏支持也应在触达真实组件时补。当前正式 `TaskModal.tsx:425` 有 `role="dialog"` 和 `aria-modal`，本次文件读取未见 focus trap、Escape 关闭或焦点回到触发按钮的实现。建议对正式入口做一次定向键盘验证，再随该组件修订补齐；这比全站视觉重做更有针对性。判定标准可采用 [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)，本次没有运行读屏测试，不下全站无障碍评级。

## 9. 现在不建议投入的方向

- **更大规模的架构替换**：没有证明单用户 daemon + SQLite 的容量不足。先修读模型、边界和恢复时序。
- **继续扩合同草案体量**：`docs/plan/ai-supply-contracts-draft/README.md` 已明确草案不参与生产构建。下一个产出应是一个能运行、能判定的切片，不是再扩一轮通用协议设计。
- **一次接全模型/工具/平台**：会同时引入协议、认证、撤权、计费、升级和测试成本；先保证一个现役组合。
- **立即换向量数据库或延长所有上下文**：已有 `memory/compiler.ts` 的 token budget 和稳定/话题分段；`live/voiceSessions.ts:79–92` 已按 heard 恢复历史。没有定向漏检证据时，不应把“项目有记忆”直接等价成“需要更复杂 RAG”。
- **单纯增加测试数量或流程轮次**：PG-03 已安排 gate truth；这次探针说明还应测状态语义和统计边界。数量多不替代断言正确。

## 10. 本次证据与复核边界

取证阅读覆盖：README、canonical 架构与 UI/数据合同的相关段落、PLAN-2、既有缺口方案、Tier1 路线 ADR，以及 Console 路由/数据钩子、daemon 工具与 provider/审计/数据库/备份、语音统计与 Python TTS 路径。不是全仓逐行审计。

可复跑探针保存在 [structural-probes.mts](../../research/astra-gap/structural-probes.mts) 和 [board-hook-probe.mjs](../../research/astra-gap/board-hook-probe.mjs)。本次命令与原始输出摘录：

```text
node --version
v22.23.1

packages/daemon/node_modules/.bin/tsx research/astra-gap/structural-probes.mts
exit 0
"latency": { "n": 20, "p50": 1000, "p90": 10000, "passPublish": true }
"unknownBudgetProjection": { "spent": 0, "max": 0, "currency": "CNY" }
"schema": { "count": 31, "max": 31 }
"futureSchema": { "opened": true, "futureMarker": { "version": 9999 } }
"audit": { "rawSentencePersisted": true, "syntheticOnly": true }

node research/astra-gap/board-hook-probe.mjs
exit 0
"initialFocuses": 20, "initialRequests": 22
"observationMs": 2000, "automaticRefreshRequests": 0
"retainedOldGeneration": true
"afterOneDetailFailure": { "visibleFocuses": 19, "pageError": null }
```

探针 `exit 0` 表示断言复现了当前行为，不表示产品满足建议中的验收目标。浏览器探针是生产 hook + 合成 API 的组件级验证；没有把它算成真实 daemon E2E。没有运行本轮全量 `just ci`、真实 provider 调用、真机或生产升级；本轮只新增评估与证据文件，不提供产品发布 GREEN。

## 11. 独立复审与最终收口

一名零上下文 reviewer（`gpt-5.6-sol / max`）对 A1 事实、A2 价值、A3 范围、A4 证据独立取证，结论 **GREEN，0 个 blocker，1 条 P2 措辞意见**；没有主要方向被判定为应删除。完整[复审记录](../../research/codex-findings/2026-09-05-project-gaps-Astra-review.md)保留原貌。

复审绑定的是修订前报告（SHA-256 `cd5507a0449561b2653c8fa931c73ef3d5bed11eb63f3519abb8f11b043a055b`）。其 manifest 经校验返回 `status=valid`；两项冻结报告门禁 `report-docs/report-probes` 均 `exit_code=0`，控制工具返回 `status=finalized`。这些状态只评价建议文档及其探针。

随后执行本任务唯一一次最终 P2 sweep：按 `ASTRA-P2-001` 明确 PG-02 不承载新增看板读模型、SP3c 不承载流式化、SaaS 接入仍须满足 SP6 条件。仅收窄措辞并补入本节，未改建议的事实和探针；没有另开通用复审。修订后重跑受影响的文档检查。最终文件摘要、检查结果和本地日志的文件名/字节数/SHA-256 见[收口证据](../../research/astra-gap/delivery-evidence.json)；唯一 [P2 ledger](../../research/astra-gap/deferred-p2.json)已记录处置。

## 12. 核验状态(2026-09-09,Fable 于 main `25a9924` 逐项复核;已修复与核验无价值项不必再复查)

| 节 | 原发现 | 现状 | 去向 |
|---|---|---|---|
| §2 | 放弃落成归档 | **已修复**(PG-01B):`RecordsPageRoute.tsx:70-80` 调 `/abandon`,`daemon/api/focuses.ts:170-221` 独立 abandoned | 关闭 |
| §2 | 预算缺口显示 0/0 | **已修复**:`mappers.ts:276` `budget:{known:false}`,`types.ts:216-221` 判别联合 | 关闭 |
| §2 | Focus/Review 页占位分支 | 仍成立:Focus 页 8 处 toast(`FocusPageRoute.tsx:88-107,193-199`),Review 页仅剩 `overrule`(`:117-119`) | 归 PG-02(G-A3 action reachability),不另立 |
| §2 | `direct_mode_not_wired` 保守拒绝 | 仍如此,且为 PG-01B 有意标 designed/deferred | 关闭(非缺口) |
| §3 | N+2 扇出 / detail 失败静默丢项 / 只靠 tick 刷新 | 仍成立(`useBoardPageData.ts:49-69,66-67,99-100,150`;Review/Focus/Records hook 同);WS 仅 `focus.entity`→侧栏一处 | 有价值:Prompt §2.5 VIEW-01(不做聚合读口) |
| §4.1 | cap token localStorage + WS query | 部分收敛:HTTP 已改 header(`lib/api.ts:53-55,129`),WS 仍 `?token=` | PG-01B deferred `DF-REMOTE-REOPEN`,本地环回下不动 |
| §4.1 | 远程业务面 | **已修复**(PG-01B `net/remoteSurface.ts:40-53`,四处调用点) | 关闭 |
| §4.1 | 未知端点共用 `OPENROUTER_API_KEY`、`--version` 探测 | 本次未复核,归 PG-06 批卡 | 不另立 |
| §4.1 | 审计写模型句子原文 | 仍成立,仅剩 `live/dialog.ts:1030` 一处 | 止损:Prompt §2.3;系统性归 PG-04 |
| §4.2 | 超前 schema 未拒 / backup 先迁移 / 无恢复点 | 仍成立(`storage/db.ts:41-44`,`backup/cli.ts:21`) | 归 PG-05 批卡,不另立 |
| §5 | SLO 只判 P50;partial 无界;无失败分母 | 仍成立(`obs/latency.ts:132-133,76,88,126`);completed 500 上界已有 | 有价值:Prompt §2.4 VOBS-01 |
| §5 | 流式化第二刀 | 未开始 | 等 VOBS-01 分段证据,不预排 |
| §6 | logger 同步 appendFileSync 无隔离 | 仍成立(`obs/logger.ts:59`) | 有价值(小):Prompt §2.8 |
| §6 | 容量负载面测量 | 未做 | 无触发证据,不另立 |
| §7 | 可信资料链 | 无具名消费者 | 核验无近期价值(READ-01),关闭 |
| §8 | doctor 诊断入口 | 仍成立(`cli/src/options.ts:5,32` 仅 up/status/open) | 有价值:Prompt §2.7 HOST-01 |
| §8 | TaskModal 键盘闭环 | 部分:role/aria-modal 有,无 Escape/trap/焦点归还;`redesign/Modals.tsx:23` 缺 aria-modal | 有价值(小):Prompt §2.6 |
| §9 | 五条“不建议投入” | **核验同意**,维持 | 关闭 |
