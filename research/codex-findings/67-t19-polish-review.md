# 67 T19-polish 方案对抗审(codex gpt-5.6-sol xhigh,2026-08-13)

注:评审将待实施方案误读为已实施收口态,但 findings 实质有效——A-5 证伪 -f 旗标方向(安全回退)、A-6 cursor HOME 暴露、A-4 busy 锁漏面、C-12 tsc 基线红。cursor 退出码 1 真因经手测=订阅月用量上限(ActionRequiredError),接线无 bug。v2.2 已按此修订。

只读核验范围：SayDo `HEAD a333f3e`，未修改文件，工作树保持 clean。终裁：`NO-GO`，v2.1 P1-P7 当前不能作为可派工收口态。

1. **A-1（P1 未实施；遮罩仍在）**  
   [SetupGate.tsx:92-107](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupGate.tsx:92) 仍是 `role=dialog`、`aria-modal=true`、`position:fixed; inset:0`，并使用 `var(--scrim, rgba(8,10,16,0.72))`。  
   [SetupBootstrapBoundary.tsx:143-151](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupBootstrapBoundary.tsx:143) 的 wizard 路径仍挂这层 Gate，P1 所说的“向导态不渲染遮罩”尚未落地。

   Peek 形态本身不会因“只移除 boundary wizard 遮罩”而破坏：`SetupGate` 在 [SetupGate.tsx:88-90](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupGate.tsx:88) 对 `peeked` 返回 `null`，Banner 点击在 [SetupGate.tsx:17-25](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupGate.tsx:17) 只做 `setPeeked(false)`。当前代码也没有另一个“peek 后 Gate 叠加”消费形态，因此文档中的“保留另一种遮罩语义”需要明确实现边界。

2. **A-2（P2 未实施；滚动仍在 Gate 内）**  
   [SetupGate.tsx:98-107](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupGate.tsx:98) 的 fixed 根节点设置 `overflowY: "auto"`，滚动容器仍是 Gate，不是 body。页面级自然滚动、“一页纸”结构尚未成立。

   `GlobalSettings` 确实是第二个 `SetupWizard` 消费点：[GlobalSettings.tsx:83-112](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/pages/GlobalSettings.tsx:83)。它当前是 Layout 内嵌形态，`SetupWizard` 自身没有 fixed/overflow 容器；P1/P2 修复必须限定在 `SetupGate`，不能把 modal 样式下沉到 `SetupWizard` 根组件。

3. **A-3（P3 未实施；网格与配置区 DOM 仍是旧结构）**  
   [SetupWizard.tsx:1122-1246](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1122) 只有 `display: grid; gap: 8`，没有 3/2/1 响应式列定义。每个供给仍是单列整宽 row，选中后的 `PlanSlotList`、ack、进度、启动按钮仍嵌在该 row 内（[SetupWizard.tsx:1157-1242](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1157)）。

   “添加 API 直连”也仍是网格外按钮和表单：[SetupWizard.tsx:1248-1314](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1248)，不是网格一员。

4. **A-4（P3/P2；busy 锁不完整，会隐藏进度并允许竞态操作）**  
   快速列表按钮和部分模型/ack 控件确实用 `busy` 禁用，但右上视图切换在 [SetupWizard.tsx:1049-1058](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1049) 未禁用。启动后从 quick 切到 advanced 会立即卸载 quick 选中行内的进度；此时 `step` 仍可能是 1，advanced 进度只在 step 4 渲染（[SetupWizard.tsx:1626-1628](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1626)）。

   另外，添加 API、未就绪入口、部分 reprobe/confirm 操作未统一受 busy 保护（[SetupWizard.tsx:1261-1378](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1261)）；高级路径调用 `SupplyPicker` 时也没有 disabled 参数（[SetupWizard.tsx:1426-1506](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1426)；[SupplyPicker.tsx:120-140](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SupplyPicker.tsx:120) 的 props 根本没有 `disabled`）。

5. **A-5（P6 旗标结论相反；不能把 `-f` 当 trust-only）**  
   当前 [cage.ts:88-92](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/cage.ts:88) 已经传了 `--trust`。本机 `cursor-agent --help` 的真实语义是：

   - `-f/--force`：Force allow commands；
   - `--yolo`：`--force` 的 alias；
   - `--trust`：Trust the current workspace without prompting。

   因此文档提出的“用最窄的 `-f`/等价 trust-only 旗标”是危险表述：`-f` 和 `--yolo` 不是 trust-only。Tier1 执行器使用 `--force --trust` 是另一条有 hooks/default-deny 审批门的路径（[executor.ts:148-155](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:148)），不能移植到 BYOA 的 ask+tripwire 笼。把 `-f` 加进 cage 会把笼等级从 ask+tripwire 升成可放行命令，属于安全回退。

6. **A-6（P6；真实 HOME/store 暴露才是当前安全阻断）**  
   [runner.ts:47-68](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/runner.ts:47) 在未传隔离 HOME 时回退到真实 `process.env.HOME`，并沿用 Cursor store 相关变量；[cliProviders.ts:29-31](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliProviders.ts:29) 也明确 cursor 不在 `requiresIsolatedHome` 集合内。BYOA 虽在 [provider.ts:217-229](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:217) 创建空临时 cwd，但这不能隔离全局配置、插件、MCP、hooks 或 instructions。

   `tripwire` 只在流中收到 `tool_call` 后才触发（[provider.ts:299-315](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:299)），无法撤回已经读出或送给远端的 HOME 内容。这直接违背当前合同 [docs/09-data-contracts.md:1165-1182](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1165) 和 [docs/07-tech-stack-decisions.md:241-243](/Users/wangyixiao/WorkSpace/SayDo/docs/07-tech-stack-decisions.md:241)。

   本仓可核验的 T18a staged 测试使用 fake CLI（[t18a-cli-slots.test.ts:31-62](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/t18a-cli-slots.test.ts:31)；调用见 [t18a-cli-slots.test.ts:134-145](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/t18a-cli-slots.test.ts:134)），不会验证真实 cursor-agent 的旗标、HOME 或 store；cage 单测也只是快照断言 `--trust`（[byoa.test.ts:98-101](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/byoa.test.ts:98)）。真实 self-test 的 cwd 是 `mkdtemp /tmp/saydo-byoa-*`，不是 staged 配置目录或仓库（[provider.ts:217-218](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:217)）。

7. **B-7（P3/P2；单选与模型选择器的可及性语义不足）**  
   供给卡只是普通 button，选中状态仅写 `data-selected` 和边框（[SetupWizard.tsx:1125-1156](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1125)），没有 `radiogroup`、`role=radio`、`aria-checked/aria-selected`。键盘可以 Tab/Enter，但读屏无法得到单选组及当前选择。

   `ModelCombo` 也只有 input `role=combobox`，列表是普通 div+button，没有 listbox/option、`aria-controls`、上下箭头、Enter/Escape 处理（[ModelCombo.tsx:47-127](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/ModelCombo.tsx:47)）。

8. **B-8（P3/P5；滚动锚点没有设计或实现）**  
   `chooseSupply` 只改状态，没有滚动锚点（[SetupWizard.tsx:901-911](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:901)）。将配置区从 row 内移到网格下方后，切换选中会改变网格后方高度；方案没有规定保持选中卡、配置区还是进度区的视口锚点，存在滚动跳动风险。

   P5 要求启动后 `scrollIntoView`，但 [SetupWizard.tsx:947-1007](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:947) 没有任何 `scrollIntoView`。当前进度仍只在选中 row 内渲染（[SetupWizard.tsx:1199-1201](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1199)）。

9. **B-9（P4 未实施；候选仍粘连）**  
   [ModelCombo.tsx:113-117](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/ModelCombo.tsx:113) 把 model id 与 label 放在同一行，仅用 `marginLeft: 8`，没有“主行 id / 次行 label”的两行排版；也没有搜索命中高亮逻辑。P4 尚未收口。

10. **B-10（P7 仅第三项保持，前两项仍旧文案）**  
    检测文案仍是“第二轮轻量重探”（[SetupWizard.tsx:1115-1118](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1115)）。语音失败仍返回 `语音密钥未配置(VOLC_*/DOUBAO_TTS_API_KEY)`（[setup.ts:1184-1188](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:1184)），并由表格直接展示错误文本（[SetupWizard.tsx:394-396](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:394)）。只有候选说明仍保留了文档认可的人话版本（[ModelCombo.tsx:128-135](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/ModelCombo.tsx:128)）。

11. **B-11（GlobalSettings 第二消费点口径未收口）**  
    [GlobalSettings.tsx:83-101](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/pages/GlobalSettings.tsx:83) 把 `showWizardEntry` 直接当作 `showWizard`，虽然 `SetupContext` 注释称其为“应展示向导入口”（[SetupContext.tsx:18-23](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/shell/SetupContext.tsx:18)）。用户 peek 后，AppContent 和 `SetupBanner` 已经存在；进入设置页又会同时出现内嵌完整向导和 Banner。若这是有意双入口，应在方案和走查中明确；若 peek 后应只保留 Banner，则当前条件错误。

12. **C-12（门禁证据不能按当前仓复核为全绿）**  
    执行 `pnpm --filter @saydo/daemon exec tsc --noEmit` 返回错误：

    - `cliCapability.ts:817`：TS2375，`note: string | undefined` 不符合 `exactOptionalPropertyTypes`；
    - `cliCapability.ts:1319`：TS2379，`signal: AbortSignal | undefined` 不符合目标类型。

    这看起来是基线问题，不能归因于 P1-P7，但意味着文档中的“全测绿”在本会话中不能被诚实确认。

**终裁：不通过。**  
P1/P2/P3 仍是旧实现，P3 还缺完整 busy 锁、单选语义和滚动锚点；P4/P5/P7 的低风险 polish 也有明确未落地项。P6 不应按 `-f/--yolo` 修，必须保留 `--trust` 的 ask+tripwire 语义，优先修复 cursor 的 HOME/store 隔离，并补真实 cursor-agent 的版本、argv digest、临时 cwd、tripwire 与 staged self-test 证据。