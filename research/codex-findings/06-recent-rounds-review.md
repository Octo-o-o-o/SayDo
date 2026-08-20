# R21–R23 最近三轮改动对抗性评审

> 评审日期：2026-07-23
> 范围：用户指定的 10 个 VoiceLoop 文件、既有 `05-docs-review.md` / `02-hopper-integration.md`，以及本机 Hopper 当前 `main` 的相关源码与文档。
> 标记：**【事实】**表示已对照当前文件、源码或本轮命令输出；**【judgement】**表示由事实推导出的风险判断或修改优先级。

## ① 总评

【事实】执行模式的产品原则本身已经写得相当完整：`04 §5.4` 明说模式不是安全参数，S3、blocked、三类熔断、Plan Delta、`ready_for_review`、两把钥匙与 Gate 0 均不因档位改变，02/03/05/08 和 Demo 也大体复述了这些约束；全局区/项目区、`workspace`、M/S 命名的主体重排同样基本一致。Hopper 当前为 `main@ea3fb31`，`c4c29c6..HEAD` 只有三处文档/归档变化、没有生产源码变化，因此 `02-hopper-integration.md` 对当前执行代码仍可作为有效基线；但 VoiceLoop 目录没有 `.git`，本轮只能按当前文件与用户给出的 R21–R23 背景做内容差分，不能伪称拿到了逐轮 commit diff。【judgement】本轮结论是：**方向可继续，按现文档直接实现 P0 仍是 No-Go**。核心原因不是“直达验收”文字上明说绕过 Gate 0——正文恰恰明确禁止——而是该安全语义在跨 Hopper 的真实合同处丢失；同时 ADR 宣称的 review first-wins、授权收据、cancel+重 drop 顺序和若干写入口均不是 Hopper 现状。信息架构只有局部路由漂移；ADR 的决策理由自洽，但进度投影和操作表把目标能力写成了现状；13 项 prompt 没有多余的大项，却有两项里程碑事实错误，并缺少安全授权、CAS/错误码、项目映射、锁/频率与取消终结等 P0 合同。关闭下列 **5 个 A 级硬伤**后，才适合让 Hopper 侧据此出可实施契约。

## ② 问题清单

### A 硬伤

#### A-01 “直达验收”的安全语义在 Dispatch/Hopper 边界被丢掉

- **文件 + 位置**：`docs/04-key-mechanisms.md:153-164`；`docs/03-architecture.md:93,119`；`docs/08-module-design.md:85-110`；`research/hopper-integration-request.md:34`；`demo/voiceloop-console-demo.html:298-312,352-355`。
- **问题**：
  - 【事实】04 要求直达验收只自动放行“决策包中逐项念出、带目标约束、随 digest 签署”的 S2；03 又说 Tier 2 要把清单编译进后端配置。
  - 【事实】08 的 `preauthorizedEffects: EffectClass[]` 中，`EffectClass` 在整套待评审文件里没有定义，无法表达 registry 白名单、目标分支、环境、金额、凭据、下游触发、有效期等约束；`ApprovalReceipt` 也没有 receipt id、principal/auth strength、nonce、issued/consumed time 或约束实例。`singleUse: true` 只是一个常量字段，不是原子消费协议。
  - 【事实】同一文件的 `DispatchEnvelope` 只有 `taskCardId/packageDigest/idempotencyKey`；对接 prompt 的 drop 字段清单也漏掉 `package id/revision/digest`、`mode`、`preauthorizedEffects`、授权收据与 effect-policy 版本。Hopper 当前 Task Card 没有这些一等字段，当前 batch runner/CLI 也没有运行中 S2 effect broker（基线 `02-hopper-integration.md:171-188,255-319,458-463`）。
  - 【judgement】因此核心文案虽没有给 Gate 0 留口子，**实现合同却留了更危险的口子**：工程师只能把“直达验收”退化成宽权限 runner、项目 setup/push 配置或一段不被执行点验证的文本。Demo 中“安装依赖 + push 自动放行”在 Hopper 现状路径上没有与文案等价的 enforcement。
- **改法**：
  1. 把 `EffectClass[]` 改成规范化 `EffectGrant[]`，至少包含 `effect/target/constraints/dataClass/credentialScope/downstreamTriggers/maxCost/environment/expiresAt/policyVersion`；任何未知字段或约束不匹配均 fail closed。
  2. `DispatchEnvelope` 必须绑定 `voiceTaskId ↔ hopperProject/task/run ↔ packageId/revision/digest ↔ mode ↔ effectGrantDigest ↔ dispatchReceiptId`，并规定 Hopper/adapter 的“接受、拒绝、降级”回执。
  3. 在 Hopper 没有执行点复验前，把路径二 P0 明确收紧为 **S0/S1 only**；需要 S2 的任务要么走 Tier 1 的真实回调，要么在每个 S2 前停靠，不得用“预授权天然形态”代替能力。
  4. 契约测试增加反例：未知 S2、目标分支变化、postinstall、CI/部署触发、过期/重复 receipt、package revision 漂移、Gate 0 未关闭时，直达验收全部必须拒绝。

#### A-02 ADR 的 review “先到先得”与 S3 收据当前既不原子，也不可认证

- **文件 + 位置**：`docs/adr/ADR-001-execution-layer.md:46-52`；`docs/08-module-design.md:99-107,137,143`；`research/hopper-integration-request.md:25,28,37,45`。
- **问题**：
  - 【事实】ADR 把 “Hopper 状态机先到先得、二次提交幂等拒绝、记录 decision origin”写成既定规则；prompt 的“我方承诺”也把它当成 VoiceLoop 已能遵守的现状。
  - 【事实】Hopper 当前 `review approve` 只接受处于 `review/conflict` 的任务并追加 `ReviewApproved`（`Hopper/src/scheduler/mutation/handlers/review.ts:36-119`），projector 对 `ReviewApproved` 不改变 task status（`Hopper/src/core/state/projector.ts:210-215`）；`reviewReject` 没有当前状态或既有决策检查，直接追加 `ReviewRejected` 并写 `rejected`（同 handler `:183-190`）。review CLI 没有 `expects`、receipt 或 origin 参数（`Hopper/src/cli/register/review.ts:47-72`；`Hopper/src/cli/commands/review.ts:123-150`）。
  - 【事实】通用 mutation schema 虽有可选 `expected_status/expected_last_event_id`，当前 review CLI 不填写；`expected_last_event_id` 对的是全局日志尾事件，不是 review subject 的 per-run/per-evidence CAS（`Hopper/src/schemas/mutation.ts:47-64`；`Hopper/src/scheduler/mutation/queue.ts:169-186`）。事件 `actor/source` 和未来 Command `submitted_via` 枚举中也没有 `voiceloop`（`Hopper/src/schemas/common.ts:20-24`；`Hopper/src/schemas/platform/command.ts:30-48`）。
  - 【事实】VoiceLoop 以非 TTY 子进程调用 CLI 会被判为 `automation`；裸设 `trusted_channel` 仍被主动降权，直到带 token 的 bridge 存在（`Hopper/src/core/caller-context.ts:21-34`）。当前入口不能验证 VoiceLoop 所称的 S3 强认证收据。
  - 【judgement】按当前代码，重复 approve 会继续追加；approve 后再 reject 也可追加并把投影改成 rejected。ADR 的 first-wins、origin 和 receipt 都是**目标态**而非已存在约束，外部两个入口会产生真正的 split-brain，而不只是 UI 延迟。
- **改法**：在 Hopper 侧增加所有入口共用的原子 review-decision command，CAS 主键至少绑定 `task_id + run_id + evidence_digest + tree_sha + decision_epoch`；第一个终局决策落账，后续同 payload 返回 `duplicate_same`，不同 payload 返回结构化 `decision_conflict` 并回显 winner/origin。VoiceLoop receipt 必须经过受信 bridge 验证，含 `receipt_id/principal/auth_method/auth_strength/presentation_digest/subject/revision/nonce/expires_at`，执行点原子消费；Console/CLI/VoiceLoop 不得各自绕过这条命令。ADR 与 08 在实现前应把整段标成“目标合同，现状缺口”。

#### A-03 `cancel + 重 drop` 没有终结屏障，会让旧 run 与新 revision 并行或串线

- **文件 + 位置**：`docs/adr/ADR-001-execution-layer.md:43-45,65-66`；`docs/08-module-design.md:143`；`demo/voiceloop-console-demo.html:382`；`research/hopper-integration-request.md:37,61`。
- **问题**：
  - 【事实】ADR 把“改需求”写成一个相邻的 `cancel + 重新 drop`，没有中间状态、run 绑定、终结条件或旧事件隔离规则；Demo 又写成“Tier2 终止本轮续跑”，容易被理解为同一会话/同一 run 的连续 steer。
  - 【事实】Hopper 当前 cancel 在 owner 仍存活时只追加 `CancelRequested` 就返回 applied；真正的 kill、`RunnerCancelled/RunnerFinished{cancelled}` 与 lock 释放由执行 owner 稍后完成（`Hopper/src/scheduler/mutation/handlers/control.ts:34-104`）。其 `findActiveRun` 只倒序找最后一个 `RunReserved`，没有先排除已完成 run（同文件 `:123-131`）。
  - 【judgement】若 VoiceLoop 收到 cancel command 的“已受理”即 drop 修订卡，旧 runner 仍可能写 worktree、闸门、review 候选与成本事件；新 revision 也可能开始排队。回叫、预算、验收证据和用户刚改的意图会跨 run 串线。这正是 ADR 应解决、但目前跳过的中间态。
- **改法**：定义 `supersede_requested → cancel_requested → cancel_settled → redrop_pending → new_revision_dropped` 状态机。cancel 必须显式传 `task_id + run_id + expected attempt/event`；只有观察到该 run 的权威取消终态、进程退出、repo/runner lock 释放并完成事件对账后才能重投。若旧 run 在竞态中自然结束，结果转历史且禁止触发当前 callback；新 revision 必须产生新的 dispatch id，并保留 supersedes 链。prompt P0 必须要求 cancel receipt 的 `requested` 与 `settled` 两态、超时/崩溃恢复、重复命令与旧 run 晚到事件语义。

#### A-04 `ready_for_review` 的状态词纪律发生实质回归

- **文件 + 位置**：`README.md:3`；`docs/02-product-definition.md:19,34-35,45`；`docs/05-roadmap.md:49-53`；`research/hopper-integration-request.md:12`；`demo/voiceloop-console-demo.html:322`。正确定义在 `docs/04-key-mechanisms.md:103-111` 和 `docs/06-references.md:86-87`。
- **问题**：
  - 【事实】04 已把状态词称为“状态机硬约束”：`run.completed` 不播完成，settle 后才是 `ready_for_review`，合并/归档后才是 `task.done`。
  - 【事实】高频入口仍写“做完叫你”“完成/卡住主动叫你”；05 的 PoC 时序甚至仍是“跑到 review → 消费完成事件 → 回叫”，下一段才否定这种口径；复制给 Hopper 的 prompt 开场也写“完成后回叫”。Demo 看板同样写“完成/卡住会主动回叫”。
  - 【judgement】这不是无害营销词：同一文档集一边禁止“完成事件”，一边在入口、实施时序与跨项目 prompt 中重复它，最容易让实现者把 `RunnerFinished` 或 task `review` 当 callback 触发器，重新引入 `05-docs-review.md` 的 A-02 false-complete。
- **改法**：入口统一为“执行和检查结束、等你验收时叫你”；05 时序改为“候选事件 → state/artifact reconciliation → settle barrier → durable callback outbox → 一次回叫”；prompt 改成“跑到 `ready_for_review` 后回叫”。泛指最终成果时可以说“交付”，但任何执行状态、事件名、回叫条件不得再用裸“完成/做完”。增加全文 lint，禁止 `完成事件|完成后回叫|做完叫你|完成/卡住` 出现在状态与 callback 语境。

#### A-05 ADR 已拍板，但 README/03/05 仍把同一执行层写成待拍板

- **文件 + 位置**：`README.md:7-8`；`docs/03-architecture.md:4,8`；`docs/05-roadmap.md:31-40,120-124`；对照 `docs/adr/ADR-001-execution-layer.md:3-14`。
- **问题**：
  - 【事实】ADR-001 的状态是 owner 已决策，范围明确为“拍板后的执行层”；05 §2 与 README:8 也说执行层已定、只有产品载体路线开放。
  - 【事实】README:7 仍把“VoiceLoop + Hopper 执行后端”整体标成“推荐，待拍板”；03:4 更明确说“以 Hopper 为执行后端尚待 owner 正式拍板并出 ADR”；05:124 又要求战略路线拍板后先出 ADR、拍板前 03 保持 proposed，未区分“已出的执行层 ADR”和“未来可能需要的产品载体 ADR”。
  - 【judgement】这部分回归了 `05-docs-review.md` A-10：工程师无法判断 Hopper 对接是否已有实施授权，可能重复等待、重复起 ADR，或相反把尚未决定的产品载体也当成已批准。
- **改法**：所有状态拆成两行：`Execution backend = approved by ADR-001`；`Product carrier/topology = proposed, owner decision pending`。03 的架构状态应写“执行层边界 approved；载体与部署组合 proposed”；05:124 应明确“这里要出的新 ADR 只覆盖产品载体/所有权调整，不 supersede ADR-001，除非明确另案”。README:7 不再把 Hopper 执行层放进“待拍板”的名词短语。

### B 应改

#### B-01 “执行模式是正交参数”与 ADR 的后端分流规则冲突

- **文件 + 位置**：`docs/02-product-definition.md:32,83`；`docs/04-key-mechanisms.md:155-164`；`docs/05-roadmap.md:77`；`docs/adr/ADR-001-execution-layer.md:12-14`。
- **问题**：
  - 【事实】02/04 说用户在拍板时独立选择两档，04 还定义 Tier 1 两档共用 adapter、Tier 2 也有直达与步序循环两种映射。
  - 【事实】ADR 的 P0 双路径却用斜线把“轻任务/逐步确认/Tier 1”绑定到 Claude SDK，把“重任务/直达验收/Tier 2”绑定到 Hopper；05 又说 Tier 1 两档均 P0，而 Tier 2 的逐步确认排 P1。
  - 【judgement】目前没有回答两个必然出现的组合：重任务选择逐步确认怎么办，轻任务选择直达验收怎么办。若选择档位会暗中换后端，模式就不是正交 dispatch 参数；若不换，P0 又没有承诺的能力。
- **改法**：新增 `workload × requested mode × backend capability × phase` 支持矩阵。后端路由必须先按能力探测，再明确返回 `supported/degraded/unsupported`；P0 对“重任务 + 逐步确认”应显示“只能步骤边界停靠，动作级确认暂不支持”，而不是静默切成直达或假装 live approval。ADR 的“双路径”写成默认路由，不写成模式定义。

#### B-02 ADR 进度投影混用了 TaskStatus、AttemptStatus 和尚不存在的遥测

- **文件 + 位置**：`docs/adr/ADR-001-execution-layer.md:24-35`；`docs/08-module-design.md:143`；`research/hopper-integration-request.md:39`。
- **问题**：
  - 【事实】ADR 把 `compile` 归入“排队中”，但 Hopper projector 从 `RunReserved/RunClaimed/WorktreeCreated/PromptCompiled` 起都投影为 `running`（`Hopper/src/core/state/projector.ts:143-151`）。
  - 【事实】Hopper task 粗状态是 `review`，没有 `needs_review` 或 `cancelled`；后两者分别属于 attempt status，且 cancelled attempt 当前投影为 task `failed` + `cancelled_by_user`（`Hopper/src/schemas/common.ts:27-57`；projector `:153-168,200-205`）。ADR 的表把三个层级写在同一列，未给推导规则。
  - 【事实】当前 `TaskState` 只有 task/project/status/risk/run/attempt/update/reason，没有“当前活动”或 live cost（projector `:16-28`）；current usage 还允许未知 cost。ADR 却把“当前活动 X、已花 ¥y”写成 P0 诚实进度的固定组成。
  - 【judgement】UI 若照表实现，会显示错误阶段，或把未知成本伪装成 0/确定值；`needs_review` 也会让 bridge 监听一个并不存在的 task 状态。
- **改法**：给 ADR 增加唯一 `HopperProjection → VoiceLoopTaskView` 规范，逐项列源事件、run/attempt 绑定、settle 条件和 `unknown`。当前活动只可由最后一个受支持事件保守推导，成本必须是 `{known,value,currency,asOf}`；没有数据就显示“暂不可得”。取消显示应由该 run 的取消终态派生，而不是假设 task status 有 `cancelled`。

#### B-03 七类操作没有 current/target 分栏，三个动作的真实语义写错或写少

- **文件 + 位置**：`docs/adr/ADR-001-execution-layer.md:37-48`；`docs/08-module-design.md:143`；`research/hopper-integration-request.md:37`；`demo/voiceloop-console-demo.html:378-383,600-607`。
- **问题**：
  - 【事实】cancel 存在，但只是请求/终结两态，见 A-03；`unblock <task-id>` 当前没有 `--answer`，handler 也只写 `TaskTriaged{ready}`，不保存答案（`Hopper/src/cli/register/control.ts:15-30`；control handler `:16-31`）。
  - 【事实】实际命令是 `review approve <task-id>`、`review request-changes <task-id> --message`、`review reject <task-id> --message`，merge 是独立的 `merge <task-id>`（`Hopper/src/cli/register/review.ts:47-88`），不是 prompt 写的单一 `review <id> approve|reject --comment`。
  - 【事实】ADR“approve 后由 Hopper 执行 merge”和 Demo 的一个“合并到 main”按钮没有说明两个命令之间的部分成功态：approve 成功、merge 失败或进程崩溃后，到底由谁重试、是否要重新认证、UI 显示什么。

  七类用户操作逐项核对如下（【事实】）：

  | 操作 | Hopper 当前可用性 | ADR 缺口 |
  |---|---|---|
  | 取消 | 有 `cancel [task-id] --run <run-id>` | 返回受理不等于进程/lock 已终结；缺 settled receipt。 |
  | 改需求 | 可先 cancel，再 drop revision 或 retry | 没有原生 steer；ADR 缺取消屏障、新 dispatch/run 与旧回叫隔离。 |
  | 回答 blocked | 只有 `unblock <task-id>` | 无 question id/answer 参数或持久答案，信息会丢。 |
  | 验收通过 | 有 `review approve`，会绑定当前 run/evidence/tree | 无 VoiceLoop S3 receipt/origin/per-decision CAS；重复提交未 first-wins。 |
  | 打回/拒绝 | 有 request-changes/reject + message | reject 无既有终局决策检查，可覆盖 approve 后投影。 |
  | 合并 | 有独立 `merge <task-id>` 与硬门 | 与 approve 非原子；缺“已批准待合并/合并失败”的 VoiceLoop 对账和 receipt 重试规则。 |
  | 看 diff/日志 | Console/review 读面存在 | deep link 依赖随机 port/token/Console 生命周期；尚非稳定外部链接/API 合同。 |

  - 【judgement】把“由 Hopper 执行”与“当前已有一个原子入口”混在一起，会使 VoiceLoop 丢掉 answer 文本、重复 merge，或在已 approve 未 merge 时错误显示 done。
- **改法**：操作表增 `current API / target API / requested / settled / idempotency key / failure reconciliation` 六列。blocked 答案要成为绑定 question id/revision 的持久 artifact/event；approve 与 merge保持两个状态，至少暴露 `review_approved_waiting_merge`，merge receipt 绑定同一 evidence/tree，并单独处理 conflict、verify 重跑失败和重复请求。

#### B-04 prompt 把错误码、CAS、重试与读文件礼仪留成开放问句，P0 无法据此编码

- **文件 + 位置**：`research/hopper-integration-request.md:22-28,34-40,54-61`；`docs/adr/ADR-001-execution-layer.md:54-66`。
- **问题**：
  - 【事实】prompt P0 七项没有要求 machine-readable error code、retryability、冲突时 current state/winner、请求 timeout、`Retry-After`、per-subject CAS 或 command settlement；仅在最后让 Hopper “反向约束”频率、锁和重试规范。
  - 【事实】Hopper 当前 mutation result 只有 `applied/rejected/conflict/expired/failed` 与自由文本 `reason`（`Hopper/src/schemas/mutation.ts:67-82`）；默认排队等待 30 秒、150ms 轮询（`Hopper/src/scheduler/mutation/queue.ts:37-76`）。这些不足以让 bridge 区分“命令仍在执行、可安全重试、永久拒绝、状态竞态”。
  - 【事实】raw `events.jsonl` 没有 seq；增量 reader 必须保留半行、容忍增长/截断/损坏，append 受 scheduler 单写者纪律约束（`Hopper/src/core/events/log.ts:54-62,105-172`）。Console SSE 又有 100ms await-write、150ms debounce、64 客户端上限（`Hopper/src/console/watch.ts:13-14,34,57,86-88`）。
  - 【judgement】这些不是 Hopper 可随意回答的“偏好”，而是 VoiceLoop durable bridge 的正确性前提；放在最后开放问句里，Hopper 会给出建议而不是可测试合同。
- **改法**：把它们升为 P0 第 8 项“mutation/read operational contract”：稳定错误码与 exit/HTTP 映射、请求/结算两态、per-task/run CAS、相同 key 的重放规则、冲突回显、timeout 后对账、指数退避/上限、最大调用频率、SSE reconnect/backfill、文件 cursor/半行/截断/轮转、只读无需抢锁且绝不自行清 corrupt 行。每条必须有契约测试。

#### B-05 task↔project↔package 映射与 Hopper project preflight 缺席

- **文件 + 位置**：`research/hopper-integration-request.md:34`；`docs/08-module-design.md:109-112`；`docs/adr/ADR-001-execution-layer.md:10,66`。
- **问题**：
  - 【事实】Hopper 的 repo、default branch、runner 与 trusted verification 由 project config 决定，不由 Task Card 正文权威覆盖；`drop` 需要显式 project，返回还可能是 `created/updated_draft/new_revision/duplicate_ignored`（基线 `02-hopper-integration.md:56-63,120-128,179-188,509-555`）。
  - 【事实】prompt item 1 只列任务字段与 task id，没有要求 project registry/resolve、repo/base/verify 回读、四种 drop outcome 或 `voice_task_id ↔ dispatch_id ↔ hopper_project/task/revision/run ↔ package_digest` 的 durable mapping。08 的三字段 envelope 也不够承载这些关系。
  - 【judgement】相同 Task Card 可以被投到错误 project/base，或因 body dedup 把授权已变化的 dispatch 当重复；回叫也可能对应旧 revision/run。这是 `02-hopper-integration.md` 已点名的 R7/R10/R23，prompt 没有吸收。
- **改法**：P0 新增 project preflight 与 mapping 合同：dispatch 前解析并回读 project snapshot，把 repo/base/runner/verification config ref 纳入 package/dispatch digest；原子保存映射；对四种 drop outcome 分别规定是否可执行、是否需新授权、如何关联 callback；旧 run/revision 的事件只进历史，不得打断当前会话。

#### B-06 localhost API 与安全边界描述不准确，也缺少最小安全合同

- **文件 + 位置**：`research/hopper-integration-request.md:44-46,50-52,61`；`docs/adr/ADR-001-execution-layer.md:35,48`；`docs/04-key-mechanisms.md:127-151`。
- **问题**：
  - 【事实】Console 的只读 API/SSE 已存在，不是“正在做完后才提供”：当前有 `/api/status`、`/api/events?after=`、`/api/stream`、`/api/review/...` 等路由（`Hopper/src/console/server.ts:223-305`）。但它默认随机 port/token、生命周期跟 Console 进程绑定，尚未声明为版本化 bridge API。
  - 【事实】prompt item 8 写“token + Origin 校验”，实际 GET/SSE 只验 Bearer、不验 Origin；写请求才同时验 Bearer 与精确 Origin（`Hopper/src/console/auth.ts:19-39`）。token 通过 0600 临时文件/一次性 launch nonce 管理，不能让另一个 daemon 猜端口或抓浏览器 fragment（server `:68-141`）。
  - 【事实】prompt 没要求 token/service discovery/rotation、最小权限、读取 scope、artifact 大小/分页、敏感路径与 raw log 禁读、事件/证据/TTS 脱敏、Task Card 不可信输入、secret/egress/network policy 或安全日志保留。基线已明确 raw log 与 callback 泄密风险（`02-hopper-integration.md:496,633,650-661`）。
  - 【judgement】“只监听 localhost”不等于安全 API；如果直接复用 Console token 或把完整 evidence/日志送进语音层，会扩大本机跨进程与隐私暴露面。
- **改法**：把 item 8 改为“将现有内部 Console read routes 提炼为版本化、最小权限的 machine client surface”，明确服务发现、独立短期 token、scope、轮换、Host/Bearer/Origin 的逐方法规则、响应上限/分页、redaction 与 audit。P0 另加 security appendix：允许的 project/path/runner/network/secret 范围、Task Card canonicalization、artifact/TTS allowlist、receipt 验证失败和 credential compromise 的 fail-closed 行为。

#### B-07 M3b/M3c 里程碑映射写反，且把 M3b 误写成必然提供 steer

- **文件 + 位置**：`docs/adr/ADR-001-execution-layer.md:9`；`docs/06-references.md:93`；`docs/08-module-design.md:137,139`；`research/hopper-integration-request.md:51-52`；另见 `docs/03-architecture.md:58,119`、`docs/05-roadmap.md:25,114`。
- **问题**：
  - 【事实】Hopper 当前冻结文档把 Decision 执行点与 command store 分配给 **M3b**，usage/adjustment 记账给 **M3c**，workflow 给 **M3d**；Decision 的 Console 侧还涉及 WS4（`Hopper/docs/SCHEMA-FREEZE-M3A.md:43-54`）。
  - 【事实】VoiceLoop 术语表却定义 M3b=流式 runtime、M3c=命令服务；08 和 prompt item 12 又把 DecisionRequest runtime 写成 M3c。prompt item 13 进一步假设“M3b 接入后就有原生 steer”。
  - 【事实】当前未来 Command verb 只有 pause/stop/interrupt/cancel/retry/resume/approve/reject 等，没有 `steer`；`ExecutorHandle.capabilities` 也只有 pause/stop/interrupt/checkpoint_resume（`Hopper/src/schemas/platform/command.ts:11-23,64-85`）。
  - 【judgement】M3b 可能为未来 streaming/steer 打基础，但当前冻结合同没有保证它；按里程碑名承诺功能会再次把路线图当 runtime/capability。
- **改法**：全套统一为 `M3a=schema；M3b=command/executor + decision enforcement；M3c=usage accounting；M3d=workflow；WS4=Console/decision/notification surface`。item 12 改成 M3b+WS4；item 13 改成“能力握手报告 `stream/steer` 强度且存在 durable command/ack/native effect 后才升级，否则保持 cancel-and-new-run”，不要用里程碑号替代 capability。

#### B-08 canonical schema 状态与章节引用自相矛盾

- **文件 + 位置**：`docs/04-key-mechanisms.md:85`；`docs/08-module-design.md:85-107`；`docs/05-roadmap.md:59-61`。
- **问题**：
  - 【事实】04 仍写“实施前必须补齐 DecisionPackage schema”，08 却把自己的 interface 标为“canonical schema 的 P0 最小集”。后者又有 A-01 所述未定义/缺字段，实际上只能算 draft，不是已关闭缺口。
  - 【事实】05 Gate 0 开头说“§6.5 列出的六类缺口”，当前 05 只有 §6，没有 §6.5；六项已移动到当前 §4 表。程序化检查未发现失效的相对 Markdown 文件链接，但这处逻辑章节引用确实失效。
  - 【judgement】工程师会分别得出“schema 还没有”“schema 已 canonical”两种相反结论，也可能找不到 Gate 0 来源。
- **改法**：指定唯一 canonical 文件/版本；在字段和安全语义补齐前，08 明标 `Draft DecisionPackage v0`，04 改成“已有 draft，尚缺 EffectGrant/receipt/dispatch binding，见 08 §4”；05:61 改为“下表六类 Gate 0 缺口（原评审 §6.5 已迁入本节）”。

#### B-09 信息架构主体一致，但 Demo 的项目设置路由违背 08 的 canonical 路由

- **文件 + 位置**：`docs/08-module-design.md:145-173,190`；`demo/voiceloop-console-demo.html:142,503-505,628-637`。
- **问题**：
  - 【事实】02/03/08/Demo 对 Dashboard 主入口、项目切换器、项目区/全局区、M0 与 M1–M3 的归属、`workspace` 名称和切导航不断会话基本一致；待评审正式文档里也没有遗留 `projects.repo`，M/S 只在 04/06 的历史命名说明里提到 L0–L3。
  - 【事实】08 的项目设置路由是 `#/p/:id/settings`，Demo 实际使用 `#/p/reporting/psettings` 和内部 route `psettings`，但 08:145 又声称其结构与 Demo 一致。
  - 【judgement】这是局部 IA 漂移，不推翻重排；但若 Demo 被当成实现验收样板，会生成两套 router key，也破坏“切项目保留同名页”的合同。
- **改法**：Demo 统一改用 `#/p/:id/settings`；内部若必须区分全局/项目设置，使用完整 route scope 而非对外 URL 改名。给 08 的路由表加一个自动化链接/route fixture，Demo 由同一 fixture 生成或测试。

#### B-10 Demo 没有把 Gate 0、Tier 2 修订与 merge 部分失败画出来

- **文件 + 位置**：`demo/voiceloop-console-demo.html:298-312,322,378-383,600-607`；对照 `docs/04-key-mechanisms.md:155-164` 与 ADR `:43-47`。
- **问题**：
  - 【事实】Demo 的决策包按钮可直接“现在开工”，旁边只有一句“模式不降安全门槛”，没有展示 Gate 0 未关闭时按钮禁用/拒绝。核心文档没有文字绕过 Gate 0，但这个最具体的交互证据没有证明不变量。
  - 【事实】Tier 2 修订写成“终止本轮续跑”，没有显示取消终结屏障、新 revision/new run 与旧回叫隔离；S3 弹层则在认证后直接显示 `merging → verify → task.done`，没有 approve 已落账但 merge conflict/verify fail 的中间态。
  - 【judgement】Demo 是未来实现者最容易照抄的材料；只写原则、不画失败态，会让 A-03/B-03 的错误在 UI 状态机中固化。
- **改法**：加一个 Gate 0 未闭合的禁用/拒绝样例；把 Tier 2 文案改为“取消旧 run 并等待终结，再以新 revision 开新 run”；S3 流程显示 `auth receipt → review approved → merge requested → merging → done | merge_failed`，失败后不重复消费原 receipt。另把“预计 1 次 S2 确认”明确成“本次拍板一次确认 2 项 S2 effect”，避免把确认次数与 effect 数量混淆。

### C 建议

#### C-01 把 ADR 的“现状、目标、依赖 Hopper 裁决”做成显式能力矩阵

- **文件 + 位置**：`docs/adr/ADR-001-execution-layer.md:9-18,24-60`；`docs/08-module-design.md:131-143`。
- **问题**：【事实】ADR 的决定部分清楚区分了“复用现状/不等平台化”，后半却把 origin、answer、receipt、first-wins、稳定 API 等目标能力直接写成操作设计；只有“协调点”暗示仍需 Hopper 改动。【judgement】读者很容易把 ADR 的 normative decision 当成 current API inventory。
- **改法**：每项标 `CURRENT / VOICELOOP-OWNED / HOPPER-CHANGE / FUTURE`，并给 fallback。这样“决策已定”与“接口待协调”不会互相抵消。

#### C-02 “测试全绿/1076+48+198”应锚定证据快照，而不是写成无时态现状

- **文件 + 位置**：`docs/03-architecture.md:175`；`docs/05-roadmap.md:7,25`；`docs/adr/ADR-001-execution-layer.md:9,64`。
- **问题**：【事实】Hopper `c4c29c6` 的 commit message 记录 gate 为 unit 1076 / golden 48 / e2e 198，当前 `ea3fb31` 相对它没有生产代码变化；但本轮没有重跑全量测试，既有 `02-hopper-integration.md:45,784` 也只实际跑过相关 4 文件、58 tests。【judgement】数字可作为锁定快照的来源，不能写成未经日期/hash限定的当前测试结论。
- **改法**：统一写“`c4c29c6` 提交记录的 gate 数为 1076/48/198；本集成审计实跑 58 个相关测试；升级时由契约 CI 重新验证”，并记录 test command/artifact，而非泛称“测试全绿”。

#### C-03 settle 事件建议采用 run/attempt 终结语义，不另造模糊的 `review_ready_settled`

- **文件 + 位置**：`research/hopper-integration-request.md:36`；`docs/adr/ADR-001-execution-layer.md:29,35`。
- **问题**：【事实】prompt 正确要求 Hopper 给 settle 官方口径，但示例名没有 task/run/attempt scope，也没要求 artifact/evidence digest 和 projection cursor。【judgement】仅一个布尔式复合事件仍可能被旧 revision 或部分 artifact 落盘误触发。
- **改法**：要求事件/查询返回 `task_id/run_id/attempt_id/revision/final_state_digest/evidence_digest/projection_cursor/settled_at`，并定义其一定发生在所有必需 artifacts fsync/rename 与 projection 更新之后。名称可由 Hopper 裁决为 `RunFinalized`/`AttemptFinished`，VoiceLoop 只依赖语义合同。

#### C-04 保留成本案例的条件语气，并删掉仍过强的标题式结论

- **文件 + 位置**：`docs/04-key-mechanisms.md:97`；对照 `docs/03-architecture.md:70`、`docs/06-references.md:28`。
- **问题**：【事实】03/06 已把 5–6×限定为某个 OpenAI 代表性 mix，明确不是普适固定倍数；04 虽加入“代表性组合”，仍以“真实成本大头不是语音”作普遍结论。【judgement】任务很短、语音很长或模型组合不同，这个结论可以反转，属于上次 A-06 的残余而非完整回归。
- **改法**：改成“在当前代表性 mix 中，成本大头预计来自 foundation/agent/verify；以真实 usage trace 决策”，不要把一次估算升级成产品常量。

## ③ 对接 prompt 的 13 项逐项核对

符合度口径：**高**＝对 Hopper 现状判断准确，需求只需定契约；**中**＝已有部分能力，但 prompt 对接口/边界有重要遗漏；**低**＝把目标态当现状、里程碑写错，或按原文无法实现。

| # | prompt 需求 | 符合度 | Hopper 当前事实（本轮核对） | 结论与必要修改 |
|---:|---|---|---|---|
| 1 | drop 字段、幂等 key、返回 task id | **中** | 【事实】已有 `--json drop --stdin --project` 和结构化 DropResult；按显式 id/body hash/source path 去重，结果有 `created/updated_draft/new_revision/duplicate_ignored`。repo/base/trusted verify 归 project config；无外部 dispatch key、package digest、mode/effect grants/receipt 一等字段（基线 `02-hopper-integration.md:56-63,112-188`）。 | 方向正确但远不够。加入 A-01/B-05 的完整 dispatch、project snapshot、四 outcome 与业务幂等合同；不能把 Hopper body dedup 当 VoiceLoop dispatch 幂等。 |
| 2 | event additive-only、顺序/gap/损坏行/cursor | **中—高** | 【事实】M3a envelope `schema_version='1'`，冻结范围内 additive optional；状态归约权威顺序是 append order（`Hopper/docs/SCHEMA-FREEZE-M3A.md:3,10,23-34`）。raw JSONL 无 seq；reader 能收集 corrupt、保留增量半行并处理截断重建（event log `:54-62,105-190`）。 | 假设与基线一致。需把“additive-only”的**冻结范围与版本升级**说清，并要求 raw byte/line cursor、半行、truncation/rotation、未知 event type、backfill 的机器语义；不可直接照搬 Console 派生 seq。 |
| 3 | review-ready settle 官方判定 | **高（缺口判断准确）** | 【事实】当前没有 `RunFinalized/review_ready_settled`；`RunnerFinished` 会先把 task 暂投影到 review，后续 verification/acceptance/docs 仍能覆盖，artifact 也在后续落盘（projector `:153-197`；基线 `:193-235`）。 | 这是 13 项里最重要且最准确的一项。按 C-03 补 run/attempt/revision、artifact digest、projection cursor 和严格 ordering；在 Hopper 给出前，PoC 保留机械 settle barrier。 |
| 4 | cancel / review / blocked-answer 写入口，幂等+origin+receipt | **低** | 【事实】cancel 存在但异步终结；实际 review 是 `review approve|request-changes|reject`，merge 独立；`unblock` 无 answer；CLI 无 origin/外部 receipt；review first-wins 未实现（详见 A-02/A-03/B-03）。 | 需求必要，但原文命令形状与现状不符，且把 4 类能力揉成一句。拆成 command contract；每个有 request/settlement、CAS、error code、origin、receipt、重复/竞态语义。 |
| 5 | blocked 结构化问题 + options | **中** | 【事实】triage 的 `missing_information`/`TaskTriaged` 可提供部分缺口；当前通用 runner result 只有 blocked reason，`unblock` 也没有 question/answer artifact，未形成统一 question id/revision/options 协议（基线 `02-hopper-integration.md:199-202,565,661-662`）。 | gap 判断准确。合同需覆盖来源、question id、是否仍 current、敏感信息、自由文本/选项、answer digest、超时与一个答案只能消费一次。 |
| 6 | 按 task id 查状态/attempt/activity/cost | **中** | 【事实】`hopper status` 支持 JSON 全量输出，但命令没有 task-id 参数（`Hopper/src/cli/register/task.ts:49-54`）；TaskState 有 run/attempt/status/risk/reason，没有 current activity/live cost。未知 cost 可能没有值，不能显示 0。 | 改成“已有全量粗投影，需 task filter 或 API query，并新增可选 telemetry”。返回值必须显式 `unknown`、币种与 as-of；活动用枚举/证据 ref，不接受模型自由文本冒充实时状态。 |
| 7 | 稳定 tag/commit + golden fixtures | **中—高** | 【事实】`c4c29c6` 存在；当前 `ea3fb31` 相对它仅文档/归档变化，核心代码基线未漂移。本轮 `git tag --contains c4c29c6` 无输出，即没有可用 tag。commit message 记录 1076/48/198 gates，但本轮未重跑。 | 需求正确。先 pin 完整 commit SHA 与安装产物/依赖 lock integrity；是否新打 tag 由 Hopper owner 决定。golden 可引用，但要明确 license、fixture version、consumer snapshot 和升级失败回滚。 |
| 8 | localhost read API + SSE | **中** | 【事实】这些 routes 今天已经存在，并要求 Bearer；GET/SSE 不查 Origin，writes 才查精确 Origin。server 默认随机 port/token，token 有 0600 临时文件与一次性 launch nonce，仍是 Console 内部生命周期（server/auth 见 B-06）。 | 不是“新增 read API”，而是“把现有内部面提炼为稳定 machine surface”。先解决服务发现、独立 client credential、版本、scope、backfill、redaction、pagination/SLA；纠正 Origin 描述。 |
| 9 | Console 显示 decision origin | **低** | 【事实】当前 review events 固定 `source='cli'`；actor/source/submitted_via 均无 voiceloop，review 命令也无 origin。first-wins 不存在。 | 只改 UI 没用。先在统一决策 command/event 中增加受校验的 origin 与 CAS winner，再由 Console 展示；origin 是审计字段，不是客户端可任意伪造的字符串。 |
| 10 | delivery contract / per-AC evidence / completion receipt read API | **中—高** | 【事实】交付合同、`ac-evidence.json`、attestation/receipt 与 review 聚合已有实现；Console `/api/review/...` 有读取面，但当前并非一个已版本化、完整返回逐 AC assertion/receipt 的外部合同（Hopper review handler `:122-170`；基线 `:323-325,443-463`）。 | 现状假设基本准确，需求有价值。要求 canonical schema/version、run/tree/contract digest binding、redaction、分页/体积、缺证据和 stale evidence 语义；“completion receipt”不得等同 task done。 |
| 11 | NotificationIntent transport 挂接 | **高（未来留位准确）** | 【事实】NotificationIntent schema 已冻结，transport/producer/dedup/ack 尚未实现，属于未来 WS4；当前 VoiceLoop 必须自有 durable outbox（基线 `:222,458-463,656`）。 | 保留。补 transport registration/auth、intent dedup key、ack vs resolved、retry/DND/fallback、payload redaction 和 VoiceLoop down 时的积压上限；现在不能写成 Hopper 已会发 intent。 |
| 12 | DecisionRequest runtime bridge（原文称 M3c） | **低** | 【事实】Decision schema 存在，runtime/enforcement 不存在；其落点是 M3b command/decision enforcement + WS4 inbox/channel，不是 M3c。当前 schema 也缺 voice channel、presentation/auth receipt/nonce 的完整闭环（freeze `:46-47`；基线 `:255-325,458-460`）。 | 需求本身应保留，但纠正里程碑与安全合同。正式接入前需 digest/revision/expiry/options 四复验、受信 channel、nonce/replay 防护、presentation evidence 与 command settlement。 |
| 13 | M3b 后把 cancel+重 drop 升级为 steer | **低** | 【事实】当前 runner 是 batch、stdin 关闭、无 live steer；M3b schema 的 Command/ExecutorHandle 也没有 steer verb/capability，只定义 interrupt/cancel/resume/checkpoint 等（command schema `:11-23,64-85`；基线 `:29,357-415`）。 | 不能把“M3b 完成”当 steer 保证。改成 capability-negotiated future item：只有 `steer=hard|coop`、durable request/ack、turn/session binding、backpressure、重启对账与安全门都存在时才升级；否则永久保留 cancel-and-new-run。 |

### prompt 的缺失项与“多余项”结论

【judgement】13 项里**没有应直接删除的业务需求**；需要重写的是 8、9、12、13：8 已部分存在，应从“新增”改为“稳定化”；9 不能只做 UI；12 里程碑写错；13 不能预设 M3b 必有 steer。真正缺失、且应在复制给 Hopper 会话前提升为 P0 的合同有六组：

1. **决策包与 effect enforcement**：mode、受约束 EffectGrant、package/receipt binding、执行点复验与降级规则（A-01）。
2. **并发与终结**：per-subject CAS、review first-wins、cancel requested/settled、旧 run 晚到事件、approve→merge 部分成功（A-02/A-03/B-03）。
3. **错误与运维**：稳定错误码、retryability、timeout 后 reconcile、频率/退避、SSE backfill、文件半行/截断/锁礼仪（B-04）。
4. **身份与安全**：trusted channel 建立、receipt 验签/nonce、防重放、token service discovery/scope、secret/egress/network、artifact/event/TTS redaction（A-02/B-06）。
5. **project 与关联映射**：project registry、repo/base/verify snapshot、四类 drop outcome、voice/dispatch/package/Hopper task-run-revision 对账（B-05）。
6. **能力与版本握手**：`schema_only/runtime`、batch/stream/steer/permission 强度、API/schema version、commit/build identity、contract fixture version 与升级回滚。

### “我方承诺”的可执行性

| 承诺 | 当前可执行性 | 核对结论 |
|---|---|---|
| 只读 events/API，绝不写 event/frontmatter | **可执行** | 【事实】与 Hopper 单写者/投影纪律一致；PoC 文件 reader 仍须遵守半行/截断/cursor 规则。 |
| 写操作只走官方入口，全部幂等且有 `origin=voiceloop` | **部分可执行** | 【事实】官方 CLI/mutation 可用；origin 不可表达，多个 handler 没有业务 first-wins/CAS。相同 req_id 的文件结果幂等也不等于 dispatch/review 业务幂等。 |
| 锁 tag/commit，升级跑契约测试 | **可执行但未闭环** | 【事实】commit 可 pin、当前无 tag；契约清单尚缺 A/B 项，测试产物与回滚条件未定义。 |
| 不 import、不共库、不共数据库 | **可执行** | 【事实】CLI/文件/API 路径均允许这个边界。注意直接深链/读 artifacts 仍需版本化读合同，不能反向依赖 Hopper 私有目录布局。 |
| review 真相源 Hopper、first-wins、附 S3 收据 | **当前不可执行** | 【事实】真相源原则正确；first-wins/origin/receipt verification/trusted channel 当前均未落实，详见 A-02。应改成“我方要求并将在 Hopper 合同提供后遵守”，不能写成既成承诺。 |

## ④ 回归检查结论

### 对 `05-docs-review.md` 十个 A 级问题逐项复查

| 既有问题 | 本轮结果 | 【事实】当前证据 | 【judgement】回归结论 |
|---|---|---|---|
| A-01 Hopper schema-only 被写成 runtime | **主体通过，边界局部漂移** | 03:29-33、05:7-14/25、08:139 都明确 Decision/Notification/Command/workflow 是 schema-only；ADR 后半和 08:143 却把 origin/answer/receipt/first-wins 按现行操作口吻书写。 | 没有把整套平台控制面重新说成已上线，但 current/target 标签不足；属 B/C 漂移，不是原 A-01 的全面回潮。 |
| A-02 review / ready / done 混用 | **明确回归** | 04:103-111 与 06:86-87 正确；README:3、02:19/34/45、05:50、prompt:12、Demo:322 又出现“做完/完成事件/完成后回叫”。 | 原硬伤重新出现在最高频入口与实施时序，按本报告 A-04 处理。 |
| A-03 P0 记忆承诺冲突 | **通过** | 04:34 明确 P0 append-only ledger；03:128-139 有 `memory_events/current_projection` 与 M0–M3 路径；05:79 把最小可信记忆纳入 P0。 | 未发现本三轮改动把它改回只读预研或推迟到账本之后。 |
| A-04 动作名风险 / 电话批准 | **机制通过，执行边界未闭环** | 04:127-145 已改为 effect-based S0–S3、DTMF 只 ack/snooze/reject、S3 屏幕强认证；两档不降低风险。08/prompt 又没有可执行的 EffectGrant/receipt/enforcement 合同。 | 产品机制没有回改，但直达验收的跨域实现会绕空机制；按 A-01/A-02 视为边界层部分回归。 |
| A-05 浏览器 AEC “工业级” | **通过** | 03:78、06:30 均写 browser AEC 只是可测 baseline、无效果保证并有降级链。 | 未回归。 |
| A-06 固定 5–6× 成本 | **大体通过，留一处残余** | 03:70、06:28 已明确代表性 mix、非普适；04:97 仍写“真实成本大头不是语音”。 | 固定倍数硬伤未回归，但结论标题仍过强，按 C-04 收口。 |
| A-07 DecisionPackage/审批 owner 不完整 | **部分完成** | 08:85-107 已拆 DecisionPackage 与两类 ApprovalReceipt，04:89-91 明确两把钥匙/两个 owner；但 `EffectClass` 未定义、receipt/Dispatch 字段不足，04:85 又说 schema 未补。 | 比上轮明显进步，但未达到可签署/可执行 canonical contract；A-01/A-02/B-08 仍阻断。 |
| A-08 Gate 0 未进入 P0 | **通过，引用有误** | 05:59-77 已把六类工程安全门禁放入 Gate 0，并两次写明直达验收不豁免；P0 验收 05:84 要求全部关闭。05:61 的 `§6.5` 已失效。 | 实质修复保留；只需修 B-08 的章节号，并在 Demo 加可视状态。 |
| A-09 Brain “无状态” | **通过** | 03:37-40 明确只有模型进程可丢弃，对话域有 durable evidence/intent/readiness/package refs。 | 未回归。 |
| A-10 设计已定 vs 路线待拍板 | **明确回归** | ADR/05/README:8 说执行层已定；README:7、03:4、05:124 又说 Hopper 执行仍待拍板/出 ADR。 | 原问题在“执行层 vs 产品载体”新边界上重现，按本报告 A-05 处理。 |

### 本轮专项一致性结论

| 焦点 | 结论 | 依据 |
|---|---|---|
| 执行模式两档 | **原则一致，合同不一致；No-Go** | 【事实】04:155-164、02:32/83、05:61/77 明确 Gate 0/S3/blocked/熔断/Plan Delta/`ready_for_review` 不变，故**没有一条 canonical 正文明说直达验收可绕 Gate 0**。但 08/prompt 丢失 mode/effect/receipt enforcement，ADR 又把模式与后端绑定；实际实现仍有绕空风险。 |
| 信息架构 | **基本通过** | 【事实】全局/项目分区、Dashboard、draft/re-anchor、`workspace`、M0 vs M1–M3 在 02/03/08/Demo 一致；正式文档未发现 `projects.repo` 遗留，M/S 命名无新 L0–L3 混用。唯一明确漂移是 `settings` vs `psettings`；`ready_for_review` 又被裸“完成”文案污染。 |
| 交叉引用 | **文件链接通过，逻辑锚点一处失败** | 【事实】本轮程序化检查 9 个 Markdown 文件的相对链接，没有 missing target；05:61 的 `§6.5` 不存在，04/08 对 canonical schema 状态也互相矛盾。 |
| ADR-001 | **决策理由通过，操作/竞态设计不通过** | 【事实】“复用现状、锁版本、不等待、双路径”的理由—后果链自洽；但进度投影混状态层，cancel+重投无终结屏障，approve/reject 无 first-wins，approve→merge 无部分失败态，receipt 只有概念边界没有验证/消费协议。 |
| Hopper prompt | **不宜按现稿直接粘贴** | 【事实】13 项方向均有价值，但 4/8/9/12/13 对当前接口或里程碑的描述需重写，且六组 P0 合同缺失。“我方承诺”中只有 read-only、pin/no-import 可直接履行。 |
| 上轮 A 级回归 | **2 项明确回归，2 项边界层未闭合** | 【事实】A-02 状态词、A-10 决策状态明确回归；A-04 安全在跨 Hopper 合同处被绕空，A-07 schema/receipt 只完成一半；A-03/A-05/A-09 保持修复，A-01 主体保持 current/schema-only 边界。 |

### 最终门槛

【judgement】建议处理顺序不是先润色文案，而是：**(1)** 先把 prompt 的 item 1/4 与六组缺失合同改成可执行 P0 请求；**(2)** 与 Hopper 侧共同定出 review CAS/receipt、cancel settlement、project mapping、settle/error/security 合同；**(3)** 回填 ADR/08 的 CURRENT/TARGET 矩阵；**(4)** 最后统一状态词、决策状态、M3 术语、路由和交叉引用。A-01～A-03 未关闭前，不应在 Demo 或路线图里演示路径二自动放行 S2；A-04/A-05 未关闭前，不应把文档标成“可直接开工”。完成这些后，ADR 的战略选择可以保留，无需推翻“复用现状、锁版本、不等待”的主决策。
