# 68 左右分栏融合布局方案对抗审(grok 4.6 只读代审,2026-08-13;codex sol/luna 上游满载留痕)

先读评审对象和相关实现，只核验「v3.0 追加」节，不改任何文件。方案已读完。接下来对照现有 validate、SupplyPicker 和品牌落点逐项核验。核心契约在 `setupApi` 与 `SupplyPicker`。我先把 mixed 校验、ack 和退役面读完整。接着核 daemon 侧 validate 与向导里 ack 的显隐来源。**终裁:需修订后再派工。** 左右分栏把快速/高级收成同一页,方向对;但 v3.0 把「换家」当成 mixed,而现网 ack/validate 认的是 **家族** 不是 **供给家**,再加上 720px 内容列、切左栏是否覆盖混搭、SupplyPicker 退役去向四处空白,按原文施工会做出「UI 能配、保存 422 或评估槽静默 unarmed」。

下面先给完整矩阵,再列 findings。

---

## 现网规则(方案未写清的那张表)

判定来源**不是**一张 `setupApi` 契约表,而是三套口径叠在一起:

| 层 | 文件 | 实际做什么 |
|---|---|---|
| 方案形状 | `resourcePlans.ts:255,271,283` | `all-cli`/`mixed` **静态**双 ack;`all-api` 零 ack。不看真实槽组合 |
| 槽政策 | `setupApi.ts:1245-1258` | 仅 evaluator 的 CLI isolation 勾选(`cliAckRequiredFor`=全部已接线 CLI)。**不管同族** |
| daemon | `validate.ts:236-304` + `slotResolvers.ts:337-372` | CLI evaluator:**永远**要双 ack,缺则 **unarmed**(hint,不 422);API evaluator:**仅当家族撞 dialog/thinking** 才 422(`evaluator_same_family`) |

`saveSlotSupplies` 自己写明 console **不能**可靠推断同族(`setupApi.ts:1332-1334`)。`familyFromModelName` / `evaluatorFamilyContext` 只在 daemon,contracts 包零导出。thinking 无可用 API key 时,比较对象回落 dialog 家族(`validate.ts:81-84`)。

**换家 ≠ 换族。** Codex CLI 与 OpenAI API 是两家,但是同一个 `gpt` 族。

### 任意逐槽混搭 × ack / 放行

| 对话 | 沉思 | 评估 | 形状 | isolation | same-family | 保存 | 评估生效 |
|---|---|---|---|---|---|---|---|
| 家A CLI | 家A CLI | 家A CLI | all-cli | 要 | 要(即使真异族也要) | 过(缺 ack 也过) | 双 ack + 自检才 armed |
| 家A CLI | 家A CLI | 家B CLI(真异族,如 Claude vs Codex) | mixed | 要 | **仍要** | 过 | 同上。异家不能免 same-family |
| 家A CLI | 家A CLI | 家B CLI(同族,如 Codex vs OpenAI-via-copilot) | mixed | 要 | 要 | 过 | 同上 |
| 家A CLI | 家A CLI | API 异族 | mixed | 不要 | 不要 | 过 | active(自检过) |
| 家A CLI | 家A CLI | API 同族(例:左栏 Codex,评估改 `openai/gpt-5.6-sol`) | mixed | 不要 | **要,否则 422** | **拒** | — |
| API | 家A CLI | 家A CLI | 今 `mixedPlan` | 要 | 要 | 过 | CLI 双 ack |
| API gpt | 家A CLI gpt | API gpt | mixed | 不要 | **要,否则 422** | **拒** | — |
| 四槽全 API 且评估异族 | — | — | all-api | 不要 | 不要 | 过;daemon 还会清掉旧 ack(`setup.ts:655-703`) | active |
| 四槽全 API 且评估同族 | — | — | all-api | 不要 | **要,否则 422** | **拒** | ack 后才 active |
| dialog=CLI | 任意 | 任意 | — | — | — | 不拒 | dialog=`oneshot`,不是禁配(`09` T18b;`SLOT_POLICY.dialog` 只有 caveat) |

**UI 让配、validate 必拒的死角**只有一类:**评估是 API,且家族撞上实际消费的 dialog/thinking,又没写 `evaluator_same_family_ack`。**

更阴的是第二类:**评估是 CLI 时,UI 若按「异家」藏 same-family ack,保存会成功,评估槽保持 unarmed。** 用户以为配好了。

dialog 换 API 的 key:现成 `mixedPlan` 写死 OpenRouter,并**伪造** `presentKeyNames:["OPENROUTER_API_KEY"]`(`resourcePlans.ts:72-79,270`),与 probe 里真正有没有这把 key 无关。无 OR key、只有 OpenAI/Anthropic key 时,界面会当成「已可提交」。

---

## Findings

### A-1 融合语义把「换家」当成 mixed,ack 动态显隐没有单源,死角组合未裁决

方案原文:`2026-08-13-向导快速配置UX重构方案-v1.md:195`「异家=mixed…ack 需求按现规则动态显隐」。

现规则如上表,且 **console 算不出同族**。方案没说动态显隐读哪份表:

- 抄 `requiredAcks` 形状表 → 任一槽换家就双勾,评估已改成异族 API 时仍逼 isolation(过度,不致命)
- 按「换了家」藏 same-family → **A 级死角**:评估改 API 却与沉思同族 → 422;评估改异家 CLI → 静默 unarmed
- 想做对 → 必须移植 `familyFromModelName`+`evaluatorFamilyContext`(含 thinking 回落),这是新面,和「语义与校验零新面」矛盾

方案举例该写死、但没写:

- evaluator 换到与 thinking **异家 CLI**:仍要 **isolation + same-family** 两勾。文案「同家族时一起犯错」(`SetupWizard.tsx:1386`)在真异族时是谎。
- dialog 换 API:要走完整 API 表单(baseURL/key/模型)+ `presentKeyNames` / `writtenKeyBaseURL` 复用规则(`SupplyPicker.tsx:154-159`);**禁止**复用 `mixedPlan` 那份假 OR key。已存 key 按 `probe.secrets` 选,没有就展开「添加 API 直连」表单。

派工前必须落一个 **纯函数** `requiredAcksForSupplies(supplies) → PlanAcks`(建议放 `resourcePlans.ts`,单测锁上表)。本批不要在 console 推断家族:CLI 评估恒双 ack;API 评估要么预勾 same-family、要么保留高级路径的「先存、422 再摊开」(`SetupWizard.tsx:984-987`)。

### A-2 左栏切家 vs 已混搭槽:覆盖还是保留,方案零字

`G1`:`:192` 点左栏 → 右栏四槽**整体切换**为该家预置。现实现 `chooseSupply` 已经是整表重置:`setPlanModels({})` + 新 `allCliPlan`(`SetupWizard.tsx:1080-1089`)。

融合后左栏仍是单选主供给,右栏又能逐槽换家。两种合法读法互斥:

1. 切左栏=新预置,混搭全部丢掉(现状,无提示)
2. 切左栏只改未手动换过的槽(v2.4 曾有「手动改过不跟随」,随预置表废掉)

不写就是实施者二选一。混搭是用户显式劳动,静默覆盖是数据丢失;静默保留则左栏选中不再描述页面。

**裁决(写进方案再派):**

- 左栏切到**另一家**:若存在任一「混搭」槽,先确认「覆盖这套混搭,四槽改用 \<新家\> 预置 / 取消」。确认才调用现 `chooseSupply` 语义。无混搭则直接覆盖。
- 「跟回 \<左栏家\>」=`:193`:只恢复**这一槽**到左栏家的 `defaultSlotModels` 预置(模型+provider),不是跟对话槽、也不是整页重置。四槽都跟回后,撤混搭徽、按钮改回「全用它,启动」。
- 再点**当前**左栏家:no-op,不清混搭。清混搭只走「跟回」或切到别家后确认覆盖。

依据:v2.4 已取消四槽跟随,预置是初值不是绑定;混搭是比选家更深的显式编辑,覆盖必须可见确认。

### A-3 ≥1000px 分栏与现行 720px 内容列冲突,断点坐标系未定

`G2`:`:199-200` 左栏固定 300px,≥1000 分栏。现行合同与实现:

- `docs/11-ui-spec.md:457` / `SetupGate.tsx:33,228`:向导内容列 **max-width 720px**
- 供给网格断点是 **1100 / 720**(`globals.css:92-129`,`SetupWizard.tsx:423-426`)

未决:

1. 1000 看 viewport 还是内容容器?容器 720 则 SetupGate **永远分不了栏**,只有 `GlobalSettings` 内嵌(无 720 帽)偶尔分栏。
2. viewport≥1000 时在 720 列里塞 300+420:和「屏幕不窄所以左右放」相反,右栏五区+ack+启动会挤爆。
3. `<1000` 回落「现有上下布局」=网格 1100/720 与分栏 1000 **两套编排长期并存**。`GlobalSettings` 在带侧栏的 1200 视口下内容约 960,会在分栏/回落之间抖。

派工前必须写:内容列加宽到多少(建议分栏态 ≥1080,左 300 + 右自适应)、断点用容器查询还是视口、`GlobalSettings` 内嵌是否永远走上下回落(设置页不是「屏幕不窄的配置步骤」)。

---

### B-4 SupplyPicker 退役面远不止四步流,去向未列

方案把「SupplyPicker 四步流」整段退役(`:194`)。实现里 SupplyPicker 不是四步,四步是 `SetupWizard` 高级视图(`:1563` 起 step 1–4)。组件本身还独立承担:

| 职责 | 现位置 | 退役后 |
|---|---|---|
| 逐槽 CLI/API/跳过 | `SupplyPicker.tsx:204-308` | 槽行「换家」要重生,或降级为 popover 复用该组件 |
| API 表单 + key 复用 | `:452-509` | 融合方案未提 |
| evaluator isolation 勾选 | `:329-367` + `cliNeedsAck` | 与方案级双 ack 会重复或漏 |
| 未登录行内重探 | `:261-281` | 左栏未就绪入口有整区重探,槽内换家没有 |
| dialog oneshot caveat | `SLOT_POLICY.dialog` | G1 只说「保留如实提示」 |
| 跳过其余槽 | `SetupWizard.tsx:1654-1662,1755` | 融合页是否还允许 skip |
| 语音步 | step 3 | 快速链本来就不配语音;高级退役后入口消失 |
| **撤销评估豁免** | `GlobalSettings.tsx:285-288` → `advancedNotice` 强制高级 step 2,评估必须改 API(`SetupWizard.tsx:945-954`) | 高级视图没了,这条设置页路径断了 |
| 存量 dialog=CLI 时「重新配置」 | `openDialogEditorRequest` → 高级 step 1(`:802-807`) | 去向未写 |
| 「在上方向导展开高级配置」 | `GlobalSettings.tsx:232-235` | 文案与入口都废 |

「转高级配置(已按对话走 API 预填)」(`SetupWizard.tsx:1115-1129,1425-1428`)今天跳高级并预填 `mixedPlan`。融合后应改成**原地**:对话槽切 API、标混搭、展开 key 表单(见 A-1)、按钮改「按这套配置,启动」。不能再写「转高级」,也不能静默套用假 OR key。

### B-5 开发槽被写进「五用途区」,换家范围含糊

`G1`:`:191` 五个用途区含「开发」;同段又写「右栏四槽整体切换」+「每槽换家」。现网开发槽只读:「留空 · 稍后在设置里配」,语义=省略 `[models.dev]`(`SetupWizard.tsx:657-661`,`docs/11:432`)。

若第五区也换家,是新配置面,违 11。方案应写死:开发只展示、无换家、无预置。

### B-6 双布局维护面与移动壳/内嵌形态

`<1000` 回落现网格(`G2:200`)「只换容器编排」偏乐观:分栏是「左列表 / 右五区」,回落是「卡网格 + 下方配置」。两套 DOM 或一套 DOM 两套 CSS,busy 锁、滚动锚点、骨架、未就绪入口、aria radiogroup 都要双测。

- 移动壳不挂向导,只有「完成配置 → 请用更宽的窗口」(`MobileChrome.tsx:164-174`)。布局零改动成立。
- `GlobalSettings` 内嵌同一 `SetupWizard`、无页头页尾、无 720 帽(`docs/11:455`,`SetupGate.tsx:209-210`)。内嵌宽度随设置栏变,会误触分栏。建议内嵌**强制**上下回落,分栏只给 `SetupGate` 向导页。

### B-7 「说到 SayDo」消费点与上架线文件交集

方案 `G3:206-207` 写 Web 先行、壳侧避开。

Web 真实落点(无任何 `document.title` 赋值,全仓 grep 为零):

| 落点 | 文件 |
|---|---|
| `<title>` | `packages/console/index.html:11`(`SayDo`) |
| 向导页头 / Loading 字标 | `SetupGate.tsx:35-56` `SayDoBrandLockup`(Loading 复用) |
| 桌面侧栏 | `Layout.tsx:389` |
| 向导副文自称 | `SetupGate.tsx:247`「没有对话模型,SayDo 聊不了天」 |
| docs/11 | `:407,:457` 字标;`:528`「产品名 SayDo」也要回写 |

`MobileChrome.tsx:156` `<strong>SayDo</strong>` 是 **Web 移动菜单**,不是 `apps/`。G2 说移动壳零改动、G3 说 Web 品牌全部改——要写明菜单字标改不改。

上架线已改/在改:`apps/ios/SayDo/Info.plist:8`、`apps/ios/project.yml:26`、`apps/android/.../strings.xml:2`、`apps/harmonyos/.../string.json:5`,显示名已是「说到」。与 `packages/console/**`、`docs/11` **零文件交集**,G3 避让成立。不要为了对齐去碰 `apps/`。

自称范围请收口:lockup / title / 侧栏用「说到 SayDo」;`apiError.ts`「连不上 SayDo 服务」这类技术自称本批不动,避免和错误合同缠在一起。

### C-8 用词:「SupplyPicker 四步流」不准确

四步=高级 `SetupWizard` 的 dialog→其余槽→语音→重启。SupplyPicker 是槽内供给卡。退役对象写「高级独立视图 + 右上切换」,组件能否在换家 popover 里复用应明示,否则施工会删掉唯一可用的 API 表单。

### C-9 门禁单测范围偏窄

`G3` 门禁:「单槽换家→mixed ack 显隐/跟回」。至少要锁 A-1 表里两条反例:评估改同族 API 必须出现 same-family(或 422 后出现);评估改异家 CLI 仍要双 ack。再加:切左栏在有混搭时不静默覆盖;dialog 换 API 在无 OR key 时不得 `supplyReady===true`。

---

## 终裁条件

**不可按原文派工。** 修订最小集:

1. 写入 A-1 矩阵 + `requiredAcksForSupplies` 单源;本批不在 UI 推断家族。
2. 写入 A-2 切左栏确认覆盖 + 「跟回」只恢复单槽预置。
3. 写入 A-3:向导页内容列加宽、断点坐标系、`GlobalSettings` 强制回落。
4. 把 B-4 表写成退役清单:撤销豁免、转高级预填、API 表单、语音步各去哪。
5. 开发槽只读;dialog→API 的 key 来源写死。
6. G3 列出 console 四个字标落点 + `docs/11` §10;声明不碰 `apps/`。

可复用、且方案判断正确的部分:启动链(staged→自检→重启)不动;dialog CLI=oneshot 只提示不禁配;壳显示名让上架线收口;融合页替代双视图这个 IA。这四条不用改。