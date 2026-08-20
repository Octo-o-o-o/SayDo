# HANDOFF-2:页面级静态拼装施工交接(给 demo 作者 AI · 2026-08-08 晚)

> **已交付归档(2026-08-09)**:本合同对应的页面拼装批已施工完毕并验收合并入 main;本文件仅留痕,不再是活合同。后续批次见新 HANDOFF。


> 你的组件库(391f21a→2e61319)已验收通过,汇报与独立核验一致——干得漂亮。本批任务:把你的组件拼成四个**页面级静态布局**。分工界线不变:页面=纯呈现拼装,数据经单一 view-model props 传入;fetch/ws/路由切换/语音由接线线(另一条并行施工线)灌入。两线并行的对接合同=每页导出的 view-model 类型(§3)。
> 基线:分支 `feature/console-redesign-b1` 最新 HEAD;HANDOFF-1(交接合同)全部纪律与 §3/§4 合同继续有效。

## 1. 拍板落实(此前 OPEN QUESTION 的裁决,义骁已授权)

- **ExpectationGroup 纳入本批**:作为 FocusPage 右栏第五组「期待」(排在产物组之后)呈现——数据形状=期待清单(来自验收标准+expected artifacts 的派生视图,view model 里给 `expectations?: ExpectationView[]`,可选容错)。
- **ExpectationDriftCard 暂不接入页面**:文件保留,期待漂移与直改机制归 v0.4(daemon 侧 expectation_adjusted 事件未建),届时另接。
- 你的三条建议处置:fixture 作接线契约测试种子=采纳(已进接线门禁);预览页活到批次⑤=采纳;期待归属=如上。

## 2. 本批页面(新文件 `src/pages/redesign/`,每页一个文件+一个 page-fixture)

| 页面 | 拼装内容 | demo 参照 |
|---|---|---|
| FocusPage | statecard(sticky,滚动态压缩单行——评审 U6 修正)+ 时间线(Note/SessionSegment/Task/Pkg/Progress/Standby/Interview 卡流)+ 右栏 FocusRail(含期待组)+ ComposerHaltBar(停机态)/composer 占位插槽(活跃态由接线线挂现有语音 composer,你留 `composerSlot?: ReactNode`)| .focus-layout 双栏独立滚动 |
| ReviewPage | 返回条 + 任务头卡 + ReviewPanel 整页化(左标准右证据+讲三层+判断可推翻+裁决区)| renderReview |
| BoardPage | 页头 + BoardLaneGroup 列表 + 列头 + 底注 | renderBoard |
| RecordsPage | 返回条 + 生命周期按钮区 + RecordsPanel(事件流/航迹/会话段)| renderRecords |

要求:①布局值(栅格/断点/双栏滚动行为)照 demo CSS;②每页顶部导出 view-model 类型(§3);③页面不 import api/fetch/router(跳转全部回调 props:`onNavigate(target)` 判别联合);④挂 `#/dev-pages` 预览路由(dev-only,四页 fixture 驱动可切换,含亮暗主题与 <1100px 窄屏三态截图自查——右栏窄屏降级:折叠为 statecard 下方的横向摘要条,方案开放问题 4 的 P0 解,做简单的)。

## 3. 两线并行的对接合同(view model,权威=你来定形状、接线线消费)

每页导出:`export interface FocusPageView { ... }` 等——字段全部来自你 types.ts 已有的视图模型组合(TimelineItem[]/FocusRailView/TaskCardView…),**不新增与 daemon 无对应的字段**(HANDOFF-1 §3 合同仍是底线);不确定的字段标 `?` 可选+组件内容错。完成后在 `src/pages/redesign/README.md` 列出四个 view model 的字段清单与语义一句话——这份 README 就是接线线的实现合同。

## 4. 门禁(同 HANDOFF-1 §5)

tsc/test/build 三绿+emoji gate+状态词三级;新增:四页在 #/dev-pages 亮暗×宽窄= 4 态截图自查无破版;commit 中文分主题,不 push,不碰 daemon/contracts/VoiceContext/Chat/Today/Layout/router(dev-pages 路由注册除外,单 commit 隔离)。

## 5. 边界外(接线线在并行做,你不要做)

timeline/转写段 API(daemon)、数据 hook(useFocusPageData 等)、正式路由切换(#/focus/:id 指向新页)、TaskModal 替换、语音 composer 挂载、旧页退役。
