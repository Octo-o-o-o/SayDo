# redesign 页面拼装 — view-model 对接合同

> 读者:接线线(数据 hook / 容器)。本目录四个页面是纯呈现拼装(HANDOFF-2),**数据全部经每页单一 view-model props 传入**;页面不 import api/fetch/router,跳转走 `onNavigate(PageNavTarget)`(见 `nav.ts`),其余动作走各页 `onAction` 判别联合。本 README 是接线实现合同:字段名与形状以各页面导出的 TypeScript 类型为权威,这里给逐字段语义。
>
> 复用组件库视图模型(`src/components/redesign/types.ts`)的字段不重复解释——那里已对齐 daemon 真实形状(HANDOFF-1 §3)。**缺引用/缺字段时页面渲染诚实占位,不伪造内容**;所有可选字段(`?`)接线侧可安全缺省。

## 回调总览(四页共用约定)

- `onNavigate(target: PageNavTarget)` — 页面间跳转:`focus / records / review / board / today`。接线线映射到真实 hash(如 `#/focus/:id`)。
- `onAction(union)` — 页内一切非跳转动作(卡片按钮、定位、拍板、fork…),逐页联合类型见下。接线线据此发命令/开弹窗。
- `onExpandSegment(sessionRef) => Promise<string[] | null> | string[] | null` — 会话段转写懒加载(FocusPage/RecordsPage);返回 `null` 表示读不到,组件如实呈现空态。

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
| `interview?` | **OPEN QUESTION**:拼装清单含 Interview 卡但 §3 TimelineItem 无 interview 成员(疑似归 live 通道)。暂作页面级可选字段,渲染在时间线末尾;归位待拍板 |
| (prop)`composerSlot?` | 活跃态输入区插槽(语音 composer 由接线线挂载);停机态(closed/abandoned/archived)忽略插槽、渲染 ComposerHaltBar |

`FocusPageAction`:`task`(任务卡动作透传)｜`pkg`(决策包 select_mode/approve/revise/edit_expectation)｜`standby`(simulate_wake)｜`interview_pick`｜`locate`(右栏点条目定位,容器负责滚动+闪烁)｜`expect`(「我期待一个 X」)｜`expectation_edit`(期待组直改入口)｜`fork`(停机态)。statecard「记录」走 `onNavigate({page:"records"})`。

窄屏降级:<1100px 右栏折叠为 statecard 下方横向摘要条(只读计数),CSS 媒体查询自动生效;`rdp-force-narrow` 类可强制(dev-pages 的「窄」开关用它)。

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

页面行为:列头四列固定(队列/进行中/需要你/已收尾);组折叠是页面级呈现状态,初始取 `collapsed`,缺省休眠(dormant)收起。卡片点击经 `onAction`(`open_task`/`open_obligation`,弹窗归接线线);组头 `onOpenFocus` 走 `onNavigate({page:"focus"})`(当前组头点击优先折叠,与 demo 一致)。

## RecordsPageView(RecordsPage.tsx)

| 字段 | 语义 |
|---|---|
| `focus` | FocusView:lifecycle 决定按钮区(活跃=归档/放弃,archived=重开,closed=fork) |
| `lanes` | 支线航迹 `{id,title,eventCount,retired?}`:eventCount 渲染圆点数,retired 不亮当前水位 |
| `dependencies` | ObligationView[](waiting 态依赖):展示「X 等 Y」,解除依赖走 onAction |
| `segments` | 会话段 `{sessionRef,label,turnCount,closed,transcriptAvailable}`;closed=false=中断缺尾,transcriptAvailable=false=未存转写占位 |
| `events` | FocusEvent 事件流 `{seq,type,text}`(append-only,照传照渲染) |

返回条(`back`)映射为 `onNavigate({page:"focus"})`;其余 `RecordsAction`(archive/abandon/reopen/fork/lane_op/dependency_undo/redo_preview)经 `onAction` 透传——归档/放弃理由必填的表单、redo preview 两步确认都归接线线。

## 接线侧尚未建设(边界外,HANDOFF-2 §5)

timeline/转写段 API、数据 hook(useFocusPageData 等)、正式路由切换(#/focus/:id 指向新页)、TaskModal 替换、语音 composer 挂载、旧页退役。预览:`#/dev-pages`(dev-only,四页 fixture 可切换,亮/暗 × 宽/窄自查)。
