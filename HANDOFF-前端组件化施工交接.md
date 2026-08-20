# 前端组件化施工交接(给 demo 作者 AI · 2026-08-08)

> **已交付归档(2026-08-09)**:本合同对应的组件库批已施工完毕并验收合并入 main;本文件仅留痕,不再是活合同。后续批次见新 HANDOFF。


> 你此前产出的 `demo/saydo-console-redesign-proposal.html` 已通过评审并定为**视觉与交互唯一规范**;现在请你把它做成本仓的实际 React 前端组件。本文档是唯一交接合同:**分工=你做呈现层组件(presentational),接线(API/ws/语音/状态管理)由另一条施工线做**。demo 是 mock,真实系统的数据合同与 demo 有若干处已定的不同(见 §4 修正清单),以本文档为准,不要照 demo 硬抄那些点。

## 1. 工程坐标

- 仓库:本仓(SayDo-console-build 克隆),分支 `feature/console-redesign-b1`(已含新壳+今天页+daemon ack/openByOwner 增量)。
- 前端包:`packages/console`(React 19 + TS + Vite + tokens.css 设计变量体系;现有组件风格=函数组件+CSS 变量内联/类)。
- 已实施(勿重做):路由 #/today、#/chat-new、侧栏新树、今天页四色收件箱(`src/pages/Today.tsx`,可作风格参照)。
- 设计 canonical:`docs/11-ui-spec.md`(§0 十五条原则/§3 布局/§5.1 新组件登记表)、`docs/08-module-design.md` §6、`docs/09-data-contracts.md` §15。

## 2. 你的任务:组件库(纯呈现,数据全走 props)

按 demo 对应区域组件化,每个组件=`src/components/redesign/` 下一个文件 + 同名 fixture(mock 数据,形状按 §3 合同):

| 组件 | demo 参照 | 备注 |
|---|---|---|
| FocusStateCard | .statecard | 标题/lifecycle/rN/方向/球权文字(你 N 件·我 N 件) |
| TimelineNote / SessionSegmentCard | .tl-note | **P0 无逐轮历史**:历史会话呈现为「会话段」卡(第 N 次会话·时间段·轮数),点开由容器懒加载(onExpand prop) |
| ConfirmCard | .confirm-card | kind 按 §3 真实枚举分组文案;倒计时值由 props 传入 |
| DecisionPackageCard | pkgHtml | 六节结构照 demo;「怎么跑」二选一无默认预选 |
| ProgressAlignCard | progressHtml | 进度对齐 |
| StandbyCard | standbyHtml | 待命:在等什么/叫醒条件/到期兜底 |
| InterviewCard | interviewHtml | 一次一问;推荐徽章不占预选位 |
| TaskCard | taskCardHtml | 16 呈现态全覆盖,状态 chip 用 §3 CHIP_TABLE;动作按钮全部 onAction prop 回调 |
| FocusRail | railHtml | 右栏四组(安排/产物/涉及项目/记住的事);**只读**,点击回调定位;条目状态只留 chip 不双写文字 |
| ReviewPanel | renderReview | 验收面:左标准右证据;**agent_claim 的 pass 用空心勾+虚线边**(与机器验区分);讲给我听三层;判断可推翻;S3 独立按钮区 |
| BoardLaneGroup | renderBoard | 泳道=Focus 分组+4 列+lanes 子泳道+组折叠+格子折叠(CELL_CAP 4) |
| RecordsPanel | renderRecords | 事件流+归档/放弃/重开/fork 按钮区(回调) |
| 弹窗族 | openApprovalModal 等 | 审批(含 S2 改后批准 textarea 流)/义务/产物/HP 详情+DecisionRequest/S3 说明/tailnet 预览/新 Focus 表单 |
| 停机 Composer 条 | composerFor | closed/abandoned/archived 三种文案+fork 按钮 |

**明确不做**(接线线的活):fetch/ws、语音(VoiceContext)、路由注册、全局状态、真实倒计时定时器、TaskModal 替换。

## 3. Props 数据合同(与 daemon 真实一致,不得自创字段)

- AttentionItem:`{ id, color:'orange'|'blue'|'green'|'gray', title, focusId, focusTitle, action:'open_confirm'|'open_task_modal'|'open_focus', updatedAt, sessionId?, projectId?, needs?, laneId?, sourceKind?:'confirmation'|'obligation'|'task', refId?, ackedAt? }`
- FocusObligation:七态 open/in_progress/waiting/deferred/blocked/resolved/superseded;owner 'human'|'agent'|'external';字段详见 `packages/contracts/src/types/focus.ts`(**权威**,写 props 类型时 import 或对齐它)。
- Task 呈现:消费 `viewStatus`(16 态,见 demo CHIP_TABLE——文案/颜色/图标四联映射照抄 demo,这部分 demo 就是规范)。
- 确认卡 kind 真实枚举:`focus_anchor / focus_obligation / focus_obligation_resolve / focus_create_anchor / focus_revision / focus_lane_split / dispatch / runtime_effect / readiness`(**没有独立 memory 类型**;close settlement 不在此内)。
- TimelineItem(P0):`{ seq, ts, kind } & ( {kind:'event',…} | {kind:'session_segment', sessionRef, turnCount, startTs, endTs, transcriptAvailable:boolean} | {kind:'task', taskRef} | {kind:'entity',…} | {kind:'pkg',…} | {kind:'progress',…} | {kind:'standby', obligationRef} )`——**没有 confirm 历史成员、没有逐轮 turn 成员**(活跃会话走 live 通道,不经此)。
- 产物:role expected→deliverable;`producedBy?/realizedAt?` 为只读派生字段。

## 4. demo 与定稿的差异修正清单(踩过四轮评审定下的,照此改)

1. 确认卡超时**不自动「记」**:倒计时归零的行为由容器决定,组件只展示;文案不写"倒计时结束按记处理"。
2. 右栏条目状态**只留 chip**,sub 不再重复状态文字(demo 的 railItemTask 双写是已判定的毛边)。
3. 验收面 agent_claim 与机器验**视觉区分**(空心勾+虚线 vs 实心绿勾)。
4. 数字徽章**全站单源=attention**;openByOwner 只以文字形态出现("你 N 件·我 N 件"),任何组件不得把它渲染成数字角标。
5. 历史时间线**无逐轮对话**(见 §3 TimelineItem);demo 的 TIMELINES 逐轮形态仅适用于活跃会话区(不归你)。
6. 「新 Focus」表单文案不说"没有建项表单",说"不必先立项,开口即可"。
7. 邮件推送/电话升级仍是 P1 提案:组件可做(EmailPreviewModal),挂 stage-tag,但不接任何真实通道。

## 5. 纪律门禁(commit 前自查)

- 零 emoji(`bash scripts/check-emoji.sh`);状态词三级(执行态永不"完成/做完");S3 按钮永不出现在语音/远程语境的组件变体里;成本 unknown 显示"还没有确切数字"禁 0;拍板类二选一无默认选中。
- `pnpm --filter @saydo/console exec tsc --noEmit`、`pnpm --filter @saydo/console test`、`pnpm --filter @saydo/console build` 三绿。
- 每组件一个 fixture 导出 + 汇总预览页 `#/dev-components`(dev-only 路由,平铺渲染全组件全状态,供走查验收;可仿 demo 的数据造 fixture,但形状必须符合 §3)。
- commit 中文、分主题;不 push;不碰 packages/daemon、packages/contracts(类型 import 除外)、src/shell/VoiceContext.tsx、src/pages/Chat.tsx、src/pages/Today.tsx。

## 6. 验收与后续

你交付组件库+fixture+预览页 → 门禁走查(既白)→ 接线线把容器/数据灌进你的组件(批次③④⑤)→ 整体验证。有任何合同疑问,在 commit message 或代码注释中明确标注 OPEN QUESTION,不要自行发明数据结构。
