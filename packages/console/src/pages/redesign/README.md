# redesign 页面拼装 — view-model 对接合同

> 读者:接线线(数据 hook / 容器)。本目录四个页面是纯呈现拼装(HANDOFF-2),**数据全部经每页单一 view-model props 传入**;页面不 import api/fetch/router,跳转走 `onNavigate(PageNavTarget)`(见 `nav.ts`),其余动作走各页 `onAction` 判别联合。本 README 说明接线实现:页面字段由导出的 TypeScript 类型定义,业务合同以 `docs/09-data-contracts.md` 为准,这里给逐字段语义。
>
> 复用组件库视图模型(`src/components/redesign/types.ts`)的字段不重复解释——那里已对齐 daemon 真实形状(HANDOFF-1 §3)。**缺引用/缺字段时页面渲染诚实占位,不伪造内容**;所有可选字段(`?`)接线侧可安全缺省。

## 回调总览(四页共用约定)

- `onNavigate(target: PageNavTarget)` — 页面间跳转:`focus / records / review / board / today`。接线线映射到真实 hash(如 `#/focus/:id`)。
- `onAction(union)` — 页内一切非跳转动作(卡片按钮、定位、拍板、fork…),逐页联合类型见下。接线线据此发命令/开弹窗。
- `onExpandSegment(sessionRef) => Promise<string[] | null> | string[] | null` — 会话段转写懒加载(FocusPage/RecordsPage);返回 `null` 或抛错表示读取失败(组件显式可重试,不画成空转写);返回 `[]` 才是真空转写。

## FocusPageView(FocusPage.tsx)

| 字段 | 语义 |
|---|---|
| `focus` | FocusView:标题/lifecycle/rN/方向/球权文字(statecard 与停机判定都用它) |
| `timeline` | TimelineItem[](P0:无 confirm 历史成员、无逐轮 turn 成员),按 seq 渲染卡流 |
| `rail.obligations` | 右栏「安排」组的全量义务(组件内部按 owner/status 分需要你/我在做/等外部) |
| `rail.tasks` | 右栏「安排」组里「我在做」的任务投影(活跃态才进组) |
| `rail.artifacts` | 右栏「产物」组(expected/deliverable/input/reference,含 superseded 徽标) |
| `rail.projects` | 右栏「涉及项目」组 `{id,title,path}`;空数组=不渲染该组 |
| `rail.memories` | 右栏「记住的事」组 `{id,tier,trust,text}`;空数组=不渲染该组 |
| `expectations?` | ExpectationView[](期待派生视图),渲染为右栏「期待」组、排在产物组之后;缺省=不出现 |
| `lookups.tasks?` | taskRef → TaskView,供 timeline `kind:"task"` 查卡;缺 key 渲染占位 |
| `lookups.packages?` | packageRef → DecisionPackageView,供 `kind:"pkg"`;缺 key 渲染占位 |
| `lookups.obligations?` | obligationRef → ObligationView,供 `kind:"standby"`(在等/叫醒条件从 waitingOn/dueOrTrigger 映射);缺 key 渲染占位 |
| `lookups.progress?` | expectationRef → `{expectation?, nextStepText?, pkgSteps?}`,供 `kind:"progress"` 对账卡;三个子字段全可选 |
| `interview?` | 已归属当前 Focus 的 live 采访投影,渲染在时间线末尾;身份含 session/turn/focus/锚定代次,应答经 `deliverInterviewPick` 复核后走 `turn.text`,不把草稿视为应答(09 §15.2.3) |
| (prop)`composerSlot?` | 活跃态输入区插槽(语音 composer 由接线线挂载);停机态(closed/abandoned/archived)忽略插槽、渲染 ComposerHaltBar |

`FocusPageAction`:`task`(任务卡动作透传)｜`pkg`(决策包 select_mode/approve/revise/edit_expectation)｜`standby`(simulate_wake)｜`interview_pick`｜`locate`(安排打开 TaskModal;产物/项目仅当 `data-locate` 节点存在才滚动,否则 toast,不跳到空位置)｜`expect` / `expectation_edit`(只带 Focus 进对话草稿,不自动发送,不写 durable expectationId)｜`dep_add` / `dep_undo`(调用 waiting-on 写口;解除前确认)｜`fork`(询问新方向后调用 `/api/focuses/:id/fork`,成功后跳转新 Focus)。statecard「记录」走 `onNavigate({page:"records"})`。

Focus 页使用对话/产物/泳道/依赖/上下文按需页签,记录跳独立记录页;状态摘要条常驻,上下文不再是宽屏常驻右栏(08 §6、11 §3)。viewport <768 切独立 MobileApp Focus/泳道/安排卡。

## ReviewPageView(ReviewPage.tsx)

| 字段 | 语义 |
|---|---|
| `ctx` | ReviewTaskContext(组件库类型):task + packageRefText + acceptance[](标准/状态/来源/证据) + decisions[](可推翻) + runs[](尝试记录) + writing?/s3?/explain?(三层)/manualVerdicts? |
| `focusTitle?` | 所属 Focus 标题,用于返回条文案「回到『X』」;缺省=「回到所属 Focus」 |

返回条(`back_to_focus`)由页面映射为 `onNavigate({page:"focus", focusId: ctx.task.focusId})`;其余 `ReviewAction`(select_ac/verdict/approve/rework/reject/s3_merge/overrule/explain)原样经 `onAction` 透传。裁决后果(合并/返工命令)归接线线。

## BoardPageView(BoardPage.tsx)

| 字段 | 语义 |
|---|---|
| `groups` | BoardLaneGroupData[](组件库类型):每组 = 一个 Focus 的 `{focus, lanes, tasksByLane, obligationsByLane, needCount, collapsed?}`;空数组=渲染空态文案 |
| `detailErrors?` | `Record<focusId, string>`:detail 拉失败的 Focus(VIEW-01)。该组仍在 `groups` 里(义务/支线缺席,attention 任务照挂主线),组头下渲染占位错误 + 「重试」(`onRetryDetail(focusId)`);不得把它从看板上抹掉 |
| `approxStatusTaskIds?` | `string[]`:`viewStatus` 只是按 attention 颜色近似的任务 id;卡片旁加「状态待核实」标签,不伪装成确定状态 |

页面行为:列头四列固定(队列/进行中/需要你/已收尾);组折叠是页面级呈现状态,初始取 `collapsed`,缺省休眠(dormant)收起。卡片点击经 `onAction`(`open_task`/`open_obligation`,弹窗归接线线);组头 `onOpenFocus` 走 `onNavigate({page:"focus"})`(当前组头点击优先折叠,与 demo 一致)。

## RecordsPageView(RecordsPage.tsx)

| 字段 | 语义 |
|---|---|
| `focus` | FocusView:lifecycle 决定按钮区(活跃=归档/放弃,archived=重开/放弃,closed=fork);放弃走独立 /abandon |
| `lanes` | 支线航迹 `{id,title,eventCount,retired?}`:eventCount 渲染圆点数,retired 不亮当前水位 |
| `dependencies` | ObligationView[](waiting 态依赖):展示「X 等 Y」,解除依赖走 onAction |
| `segments` | 会话段 `{sessionRef,label,turnCount,closed,transcriptAvailable}`;closed=false=中断缺尾,transcriptAvailable=false=未存转写占位 |
| `events` | FocusEvent 事件流 `{seq,type,text}`(append-only,照传照渲染) |

返回条(`back`)映射为 `onNavigate({page:"focus"})`;其余 `RecordsAction`(archive/abandon/reopen/fork/lane_op/dependency_undo/redo_preview)经 `onAction` 透传——归档/放弃理由必填的表单、redo preview 两步确认都归接线线。`lane_op.continue` 必须传真实 `laneTitle`,禁止把 `laneId` 当标题(缺标题或标题等于 id 时省略)。

## 接线实况(2026-09-27 源码复核)

2026-10-03 状态补注：本节所述旧候选已吸收入本地 main `53be7405`。接线事实按对应源码解释；本次完整运行基线与独立交叉核验另记，不将入 main 当作产品通过。

四页 hook 与正式路由已接(`#/focus/:id`、`#/records/:id`、`#/board`、`#/review/:id`)。Focus 安排 / 看板卡片走 TaskModal;期待与「在这件事里开口」走 `pendingAnchor` + `#/chat-new`,Focus 页仍未内嵌完整 ChatComposer。`rail.tasks` 与 task/package lookups 来自 Focus、任务详情与 live 确认卡;批准只打开匹配 session/package/revision 的确认面,其它决策包动作进入锚定草稿。fork REST 与依赖设置/解除已接。standby 模拟叫醒仍只提示排障边界,不从页面触发。预览:`#/dev-pages`(dev-only,四页 fixture 可切换,亮/暗 × 宽/窄自查)。
