# 66 向导快速配置 UX 重构方案对抗审(codex gpt-5.6-sol xhigh,2026-08-13)

结论：**需修订，当前不可直接派工。** 主要阻断是 Loading 门层级与移动 LAN 合同未闭合，以及“8 秒串行 confirm、整体 ≤15 秒”在协议和时延上均不成立。

## Findings

### A-1 Loading 门放在 `AppContent` 以下堵不住；移动 LAN 也无法执行“同规则”

根因已定位：

- `SetupProvider` 初始 `loading=true`，probe 完成后才置 false。[SetupContext.tsx](~/WorkSpace/SayDo/packages/console/src/shell/SetupContext.tsx:43)
- 桌面端先挂载 `Layout`、导航、页面，再在其中叠 `SetupGate`。[App.tsx](~/WorkSpace/SayDo/packages/console/src/App.tsx:118)
- `SetupGate` 在 `loading` 时主动返回空，因此今天页/裸壳先出现。[SetupGate.tsx](~/WorkSpace/SayDo/packages/console/src/components/SetupGate.tsx:88)
- 移动分支直接返回 `MobileApp`，完全不挂 `SetupGate/Banner`。[App.tsx](~/WorkSpace/SayDo/packages/console/src/App.tsx:141)
- probe 失败时 `probe=null` 被视为 `dialogReady=true`，方案缺少“判定失败”第三态。[setupApi.ts](~/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:391)

真正能堵住的层是：

`SetupProvider → SetupBootstrapBoundary → AppContent`

其中 boundary 必须先消费 `loading/probeError/dialogReady/peeked`：

1. `loading`：只渲染全屏 Loading，不挂载桌面或移动壳。
2. probe 失败：明确错误/重试态，或明确沿用现有 fail-open；不能写成“已配好”。
3. 未就绪且未 peek：直接渲染 `SetupGate`，不要先挂 `Layout/Today`。
4. 已就绪或已 peek：才挂载 `AppContent`；桌面 peek 后保留 Banner。

移动端另有协议阻断：真实 `mobile_lan` 只放行少量只读接口，不含 `GET /api/setup/probe`，[mobileLan.ts](~/WorkSpace/SayDo/packages/daemon/src/net/mobileLan.ts:11)；请求会在总路由处 403。[index.ts](~/WorkSpace/SayDo/packages/daemon/src/index.ts:874) 因此“移动壳同规则”必须拆清：

- 本机窄视口/原生强制移动壳：可共用上述 boundary。
- 真实手机 LAN：要么保持 setup fail-open，只做连接 Loading；要么另行评审一个最小只读 readiness 投影。不能直接开放完整 setup probe/向导。

### A-2 自动重试的 8 秒/15 秒预算不成立，confirm 端点不等价于二次 probe

方案要求“失败家串行重试，每家 8 秒，整体 ≤15 秒”。[方案](~/WorkSpace/OctoAgent/docs/product/2026-08-13-向导快速配置UX重构方案-v1.md:51)

现状：

- 首轮 capability probe 是全家并行、单家 3.5 秒、整体约 4 秒。[cliCapability.ts](~/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:299) [cliCapability.ts](~/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:1267)
- GET 端点等待 `Promise.all` 全部结束后才返回整份 JSON，不支持逐家增量显示。[index.ts](~/WorkSpace/SayDo/packages/daemon/src/index.ts:1026)
- confirm 会先绕缓存重探，再真实发起一次模型调用。[setup.ts](~/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:1394)
- 真实调用预算是 wall 90 秒、idle 45 秒，不是 8 秒。[setup.ts](~/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:1430)
- 按评审输入的一发约 20 秒实测，单家就已超过方案整体预算。
- 即使真有 8 秒超时，串行两家已经是 `3.5 + 8 + 8 > 15`。

裁决：**禁止把 confirm 当自动二次 probe 复用。**

可行修订二选一：

1. 推荐：新增逐家、`bypassCache` 的轻量 capability retry；失败家并行重探 8 秒，并设全局 deadline。confirm 保留为用户显式点击的真实一发，标明约 15–25 秒。
2. 若坚持自动 confirm：删除“≤15 秒”，承认可能几十秒到数分钟，并评审自动消耗 CLI 额度的授权语义。

“先 probe 快照，再逐家 confirm”也无法满足首轮“完成一家亮一家”；若保留增量要求，需要逐家 GET、SSE 或等价的新协议。

### A-3 方案直接推翻当前 canonical，按仓库纪律不能先派代码

当前 `docs/11-ui-spec.md` 仍强制基础层最多三张一键卡、mixed/one-key、失败后降级 mixed。[docs/11-ui-spec.md](~/WorkSpace/SayDo/docs/11-ui-spec.md:240)

本方案则要求推荐卡全部取消、mixed 只进高级视图。[方案](~/WorkSpace/OctoAgent/docs/product/2026-08-13-向导快速配置UX重构方案-v1.md:28)

此外 canonical 要求 300ms 内不展示 Loading、禁全屏 spinner；方案需要说明品牌呼吸 Loading 是否作为该规则的例外。[docs/11-ui-spec.md](~/WorkSpace/SayDo/docs/11-ui-spec.md:246)

按仓库约定，必须先回写 canonical 并完成一致性评审，再派实现。

### B-1 去掉弹窗本身安全，但方案漏了弹窗当前承担的状态职责

现有快速流机械顺序正确：

- 双 ack 先检查。[SetupWizard.tsx](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:991)
- 两项 ack 显式传给 `saveSlotSupplies`。[SetupWizard.tsx](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1018)
- ack 被写进 `models`，不是临时请求字段。[setupApi.ts](~/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:1229)
- 保存只写 pending，不动活动配置。[setup.ts](~/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:725)
- staged self-test 失败不重启；通过后才重启并跑 live self-test。[SetupWizard.tsx](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1018)
- daemon 重启端点还会再次检查 pending CLI self-test receipt。[index.ts](~/WorkSpace/SayDo/packages/daemon/src/index.ts:1305)

所以改成内联不会天然破坏 T17/T18，条件是继续复用这条链，不能改成普通 `save → restart`。

但当前弹窗还负责：

- busy 时禁止换方案/关闭；
- 固定本次提交快照；
- 持续展示四步进度和失败详情；
- all-CLI 失败后切换到 mixed fallback。[SetupWizard.tsx](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1031)

方案需补：启动后锁定供给行和四槽草稿；进度留在原选中行；失败后如何进入高级 mixed。当前 fallback 直接生成 mixed 快速方案，与“快速视图只做全用一家”冲突。

### B-2 模型选择的数据基本具备，但方案对来源和 provider 契约描述不准确

- `models` 已有 `id/label/source/seen`，来源支持 listed/used/configured/alias。[setupApi.ts](~/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:824)
- Codex 候选来自会话 used、当前配置 configured。[cliCapability.ts](~/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:1187)
- Claude 当前只有 used + 官方 alias，没有 configured 来源。[cliCapability.ts](~/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:1176)
- 没有通用“recommended model”字段；只有 used 次数、列表顺序及 Grok 的 default label。
- OpenCode 虽能枚举，但 `provider:null`，属于 inventory-only，不能出现在快速可用供给列表。[cliCapability.ts](~/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:190)
- 批 B 契约表仍把 Codex、Claude、Grok 标为 `modelEditable:false`。[setupApi.ts](~/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:766) 新快速选择器必须同步修改该单源，不能组件内另写 provider 名单。

性能上，201 项字符串过滤本身只是 O(n)，没有实质风险；但现有 `ModelCombo` 会把所有匹配项直接渲染为按钮。[SupplyPicker.tsx](~/WorkSpace/SayDo/packages/console/src/components/SupplyPicker.tsx:139) 四槽若同时展开约 804 行。建议做真正的按需 popover，一次只展开一个槽；不需要虚拟化，但不要常驻四份列表。

### B-3 “已存有效 key”无法由现协议判断，API 入列与 key 表单没有闭环

setup probe 的 secret 信息只有 `Record<string, boolean>`，表示 active/pending env 中存在，不代表 key 有效。[setupApi.ts](~/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:38) daemon 也只是调用 `secretPresent`。[setup.ts](~/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:480)

因此主列表只能写“已存 key”，不能写“有效 key”；有效性要等真实 self-test。

现有无 key 表单仅在“没有计划且没有 OpenRouter key”时出现，并独立于 API 卡。[SetupWizard.tsx](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1111) 推荐卡删除后必须明确：

- 空态中保留“添加 API 直连”伪行/动作；
- 选中后在哪里填写 baseURL、key、模型；
- key 提交后是先写 dialog pending 再回列表，还是一次构造完整四槽 pending；
- 已存 key 的 API 行如何取得 baseURL/via。当前 probe 没有投影完整 provider 配置。

### B-4 `resourcePlans` 退役面不止 `generateResourcePlans`

`generateResourcePlans` 确实只负责三席推荐槽。[resourcePlans.ts](~/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:208)

但：

- `allCliPlan` 可继续作为“选中供给 → 四槽方案”factory。
- `mixedPlan` 仍被 `fallbackResourcePlan` 使用。[resourcePlans.ts](~/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:223)
- SetupWizard 自检失败会调用 fallback。[SetupWizard.tsx](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1040)

方案必须裁决：mixed fallback 是转入高级视图并预填草稿，还是彻底取消自动降级。不能只写“推荐槽生成逻辑退役”。

### B-5 逃生门在移动壳没有返回入口，`peeked` 生命周期也未定义

`peeked` 持久化在 localStorage。[SetupContext.tsx](~/WorkSpace/SayDo/packages/console/src/shell/SetupContext.tsx:30) 桌面通过 `SetupBanner` 返回向导，但该 Banner 只挂在桌面 Layout。[SetupGate.tsx](~/WorkSpace/SayDo/packages/console/src/components/SetupGate.tsx:16) [App.tsx](~/WorkSpace/SayDo/packages/console/src/App.tsx:118)

若新门覆盖本机移动壳：

- 点击“先随便看看”后需要移动端返回配置入口；
- 配置成功后应明确是否清除 `peeked`，否则未来配置失效仍会永久绕过 gate；
- “配置已完成用户不受影响”应改成“不误进向导、不改配置”，因为所有用户仍会看到首载 Loading。

### C-1 `dev` 文案是局部硬编码，不需要接入四槽模型状态

“留空 · missing”直接写死在 `PlanSlotList`。[SetupWizard.tsx](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:608)

修文案即可，但应明确“留空”表示省略整个 `[models.dev]`；`DevAgentBinding` 一旦存在，`model` 必须是非空字符串。[modelbinding.ts](~/WorkSpace/SayDo/packages/contracts/src/types/modelbinding.ts:48)

## 终裁

**需修订。满足以下条件后可派工：**

1. 将 Loading/向导判定明确放到 `SetupProvider` 内、`AppContent` 外，并补 probe-error 第三态。
2. 单独裁决本机移动壳与真实 mobile LAN；不得静默开放完整 setup API。
3. 删除“串行 confirm 8 秒、整体 ≤15 秒”的组合；改成并行轻量 re-probe，confirm 保持显式长调用。
4. 补齐增量探测协议，或删除“完成一家亮一家”。
5. 明确内联确认后的 busy 锁、进度、失败及 mixed fallback 去向。
6. 校正模型来源/provider 契约及 API key 表单闭环。
7. 先更新 `docs/11-ui-spec.md` canonical，再派实现。

本次只读核验基于 `main aa8034e`；未修改文件、未运行测试。工作树原有 `packages/console/src/styles/tokens.css` 修改保持未触碰。