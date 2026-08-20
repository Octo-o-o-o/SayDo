# 65 CLI 供给扩容方案对抗审(codex gpt-5.6-sol xhigh,2026-08-13)

结论：**需修订，当前不可直接派工。** 整体架构方向可行，但有 4 个阻断项：family/模型证据语义未定义、计费来源误判、安全笼不足、探测与可选状态可能死锁。

本次只读核验确认 SayDo 位于 `main`，HEAD 为 `4196613c82d05d6bb642ca2fdc012fffb6776e6e`；结束时 `git status --short --branch` 仍为 `## main...origin/main`，无文件改动。未运行全量测试。

## Findings

### 1. [A] 新增 provider 值之前，必须先定义 family、model 字段和模型证据语义

方案只写“contracts 增 5 个 provider 值”，没有规定每个 binding 的字段形状、family 如何解析、什么情况下允许 `verified_binary_default`。

当前有三层闭合逻辑：

- contracts 只允许 `api/codex_cli/claude_cli/cursor_cli/grok_cli/acp`，且各 CLI 对 `model` 的必填性不同：[modelbinding.ts:9](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/modelbinding.ts:9)。
- daemon 又复制了一份闭合 binding union：[validate.ts:18](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/validate.ts:18)。
- `resolveFamily` 逐家分支后直接进入 API 的 `b.via` 处理：[validate.ts:100](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/validate.ts:100)、[validate.ts:145](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/validate.ts:145)。若只扩 contracts，新值不是编译失败，就是在补 union 后错误落入 API 分支。

尤其 qwen、kimi、opencode 等是可连接不同上游模型的传输 CLI，不能按二进制名固定 family。方案必须逐家决定：

- `model` 是否必填；
- family 来自显式模型名、流中 `observedModel`，还是可信二进制默认值；
- 不得验证的模型是否允许进入 dialog/thinking/cheap/evaluator。

现有 `verified_binary_default` 只给 codex/claude：[cliRuntime.ts:79](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:79)。而且方案称“unknown 永不武装 evaluator”不准确：[方案:32](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-13-CLI供给扩容与画像融合方案-v1.md:32)；setup 对所有非 API CLI 都要求非 unknown 模型证据，unknown 会阻断全部槽位自检：[setup.ts:1226](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:1226)。

应先在 docs/09 固化五家的 binding shape 和 family/evidence 规则，再改代码。

### 2. [A] “五件套”确实漏了真实存在的第六件：billing 与费用来源

`billing.ts` 不是可选配套：

- 限额特征表是 `Record<CageProvider, ...>`，新增 CageProvider 后编译期就要求补齐：[billing.ts:65](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/billing.ts:65)。
- 结构化失败分类也有 provider 分支：[billing.ts:127](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/billing.ts:127)。
- 每次 CLI 调用都会无条件记为 subscription usage：[provider.ts:422](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:422)、[ledger.ts:17](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/cost/ledger.ts:17)。
- 前端 all-CLI 方案又固定宣称“订阅内零成本”：[resourcePlans.ts:139](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:139)。

但 CLI 传输不等于订阅计费。方案自己已经承认 Kimi 有 provider 面；本机 Qwen 也支持多类上游认证。若用户通过 API key 使用这些 CLI，当前代码会把真实 API 成本错误记成订阅，并向用户显示零增量成本。

因此第六件至少应命名为“billing/quota/cost provenance”，逐家定义 `subscription/external_api/unknown`。只有确认订阅来源时才能显示“订阅内零成本”。

### 3. [A] Gemini/Qwen 的 `plan` 模式不是 tool-deny；空 cwd 加 prompt 禁令不足以构成安全笼

方案将 Gemini/Qwen 预判为 tool-deny 档：[方案:19](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-13-CLI供给扩容与画像融合方案-v1.md:19)。这个结论不成立：

- Gemini 官方说明 Plan Mode 仍可使用读文件、列目录、搜索、Web 和只读 MCP 等工具；真正的拒绝策略来自 policy engine。[Gemini Plan Mode](https://geminicli.com/docs/cli/plan-mode/)、[Gemini Policy Engine](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/policy-engine.md)
- Qwen 官方同样把 plan 定义为允许只读分析；其明确的零工具机制是 `model.maxToolCalls=0`，另有 `excludeTools`。[Qwen settings](https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md)、[Qwen approval mode](https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/approval-mode.md)

现有 cage 的“空 cwd”只创建工作目录：[provider.ts:204](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:204)，但 runner 仍把真实 `HOME` 传给子进程：[runner.ts:47](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/runner.ts:47)。这意味着 CLI 仍可发现用户配置、插件、hooks、MCP、全局 instructions，并可能读取 HOME 下文件。

现有 tripwire 在流事件出现后才终止：[provider.ts:300](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:300)，不能证明工具在被观察前尚未执行。Codex/Cursor 的检测型先例不能自动成为五家 CLI 的安全证明。

最低要求：

- Gemini 使用强制 deny policy，并隔离扩展、MCP、hooks 与用户配置；
- Qwen 使用 `maxToolCalls=0`，同时启用 bare/排除工具配置；
- Copilot 使用明确的 available/deny tools 白名单；
- Kimi/OpenCode 若找不到执行前 tool-deny，必须使用隔离 HOME 加 OS sandbox，或暂不升 wired；
- 每家增加“诱导执行读文件/命令但实际零执行”的负向 tripwire 测试。

### 4. [A] 探测结果可能永久停在 unknown，导致“列表即菜单”没有可操作入口

探测不是简单扩两个 enum。当前需要同时修改：

- `CliProvider` 闭合 union：[cliCapability.ts:38](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:38)；
- `authStrategy/modelStrategy`：[cliCapability.ts:53](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:53)；
- auth 参数分派：[cliCapability.ts:519](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:519)；
- provider-specific auth/model 探测分支：[cliCapability.ts:754](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:754)；
- 可枚举模型判定：[cliCapability.ts:722](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:722)；
- 二进制身份指纹：[cliCapability.ts:691](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:691)。

本会话执行本机 help 还发现：

- Gemini 0.46.0 没有当前目录登记的 `gemini auth login` 子命令；
- Qwen 0.18.0 的 `qwen auth --help` 明确表示该命令已移除。

而目录目前仍给出这两个登录提示：[cliCapability.ts:194](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:194)、[cliCapability.ts:214](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:214)。

前端方案又要求只有 `logged_in + wired + 有可用模型` 才显示“全用它”，当前资源计划同样只把 `logged_in` 视为可用：[resourcePlans.ts:97](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:97)。如果探测只能返回 unknown，用户既不能点击配置，也拿不到正确登录命令。

方案应增加版本化探测矩阵，并明确 unknown 的恢复路径，例如允许用户发起一次受控自检来确认，而不是永久禁用入口。

### 5. [B] 新增五个 provider 值的真实闭合点远多于方案清单

需要逐项纳入派工清单：

- 契约与 family：  
  [modelbinding.ts:9](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/modelbinding.ts:9)、[validate.ts:18](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/validate.ts:18)、[validate.ts:218](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/validate.ts:218)、[providers/types.ts:80](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/types.ts:80)。

- 目录与 runtime registry：  
  [cliCapability.ts:38](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliCapability.ts:38)、[cliRuntime.ts:13](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:13)、registry 反序列化白名单 [cliRuntime.ts:195](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:195)、审计 receipt 白名单 [cliRuntime.ts:507](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:507)、旧 probe union [probe.ts:5](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/probe.ts:5)。

- BYOA 执行层：  
  `CageProvider` 与参数 switch [cage.ts:8](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/cage.ts:8)、parser dispatcher [parsers.ts:281](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/parsers.ts:281)、模型证据与 stdin/special case [provider.ts:281](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:281)、审计 cage label switch [provider.ts:397](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:397)、billing 两处分支、runner 的配置环境隔离。

- resolver 与 readiness：  
  [slotResolvers.ts:56](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/config/slotResolvers.ts:56)、evaluator 默认模型豁免 [readiness.ts:238](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/evaluator/readiness.ts:238)。

- setup：  
  pending self-test provider 白名单 [setup.ts:970](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:970)、provider 到 CLI 名映射 [setup.ts:1035](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:1035)、CLI 判定 [setup.ts:1056](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:1056)、registry cast [setup.ts:1149](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:1149)。

- console setup contract：  
  binding union [setupApi.ts:71](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:71)、dialog CLI 判定 [setupApi.ts:375](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:375)、provider union [setupApi.ts:742](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:742)、wired 名单 [setupApi.ts:774](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:774)、响应 parser [setupApi.ts:849](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:849)、`SLOT_POLICY` [setupApi.ts:1005](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/setupApi.ts:1005)。

其中 `SLOT_POLICY` 实际位于 console 的 `setupApi.ts`，不在 daemon `validate.ts`；两边都要改，但职责不能混写。

### 6. [B] “复用 envelope 零改动”只对协议层成立，对完整 oneshot 路径不成立

成立的部分：

- `dialogLoop` 的 oneshot envelope 接收通用 `LlmProvider`，不需要五家分支：[dialogLoop.ts:495](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/brain/dialogLoop.ts:495)。
- live dispatch 只区分 API 与非 API：[dialog.ts:468](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:468)。
- `FirstRunCoordinator` 状态机本身 provider-neutral：[firstRun.ts:6](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/firstRun.ts:6)。

不成立的部分是 setup registry、自检映射、模型证据和 console readiness，见 Finding 5。它们未更新时，新 provider 即使能跑 CLI，也无法完成 setup 晋升，first-run 会继续被 SetupGate 挡住。

建议把排除项改成：“oneshot envelope 与 dialogLoop 无 schema 改动；setup/self-test/registry/readiness 必须扩展。”

### 7. [B] “列表即菜单”可以复用确认流，但当前组件并非直接支持

可复用部分：

- `choosePlan` 和 `selectedPlan` 已经是通用 plan 状态：[SetupWizard.tsx:886](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/setup/SetupWizard.tsx:886)。
- 确认卡也是通用 `QuickConfigPlan` 流：[SetupWizard.tsx:1160](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/setup/SetupWizard.tsx:1160)。

必须修改的部分：

- `ResourcePortrait` 当前是纯展示组件，没有 action callback：[SetupWizard.tsx:364](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/setup/SetupWizard.tsx:364)。
- `allCliPlan` 是 `resourcePlans.ts` 内部私有构造器：[resourcePlans.ts:139](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:139)，行内按钮需要复用或抽出公共 factory。
- 模型可编辑性只认 API/Cursor，标签也只特判 Codex/Claude：[SetupWizard.tsx:509](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/setup/SetupWizard.tsx:509)。
- 应用计划时也只要求 API/Cursor 有 model：[SetupWizard.tsx:894](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/setup/SetupWizard.tsx:894)。
- `SupplyPicker` 的 model label 和 readiness 同样硬编码旧 provider：[SupplyPicker.tsx:480](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/setup/SupplyPicker.tsx:480)、[SupplyPicker.tsx:565](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/components/setup/SupplyPicker.tsx:565)。

所以答案是：**确认流可以复用，但需增加行内 plan factory/callback，并把 model 规则改为由 provider contract 驱动。**

### 8. [B] 当前“三张上限”与“推荐位”语义直接冲突；fallback 本身不冲突

`generateResourcePlans` 先为所有可用 CLI 生成 all-CLI 卡，然后再追加 mixed/API，最后统一 `slice(0, 3)`：[resourcePlans.ts:180](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:180)。

因此当有 3 家以上可用 CLI 时，三张全是 all-CLI，mixed 和 one-key 都会被截掉。现有测试还明确锁定了这个行为：[resourcePlans.test.ts:77](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.test.ts:77)。

要实现方案语义，应改成显式推荐槽：

1. 排序第一的 all-CLI；
2. 有 key 时放 mixed；
3. 有 key 时放 one-key；
4. 其他 CLI 只从画像行进入。

`fallbackResourcePlan` 是自检失败后的独立回退构造，不依赖卡片是否展示：[resourcePlans.ts:193](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:193)，因此与“推荐位”没有根本冲突。但 `fallbackPlanId` 当前没有消费方，建议同步清理或明确用途，避免形成第二套计划关系。

### 9. [B] 测试 fixture 和真实链验收范围不足以宣称五家 wired

必须扩展的闭合 fixture 至少包括：

- fake CLI 只识别 codex/claude/cursor，其余会落入既有默认行为：[fake-byoa-cli.mjs:11](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/fixtures/fake-byoa-cli.mjs:11)。
- cage、parser、billing 快照矩阵：[byoa.test.ts:23](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/byoa.test.ts:23)、[byoa.test.ts:451](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/byoa.test.ts:451)。
- fake CLI E2E 的 provider/model 构造：[byoa-fake-cli.e2e.test.ts:46](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/byoa-fake-cli.e2e.test.ts:46)。
- capability inventory/probe：[cli-capability.test.ts:139](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/cli-capability.test.ts:139)。
- setup capability 映射：[t18a-cli-slots.test.ts:50](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/t18a-cli-slots.test.ts:50)、[setup-onboarding.test.ts:729](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/setup-onboarding.test.ts:729)。
- console provider、SLOT_POLICY 和 probe parser 表：[setupApi.test.ts:660](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/setupApi.test.ts:660)、[setupApi.test.ts:869](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/setupApi.test.ts:869)。
- 推荐卡顺序断言：[resourcePlans.test.ts:77](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.test.ts:77)。

此外，本会话检索 `packages/contracts/test` 未发现针对 `modelBindingSchema` 的专门 accept/reject fixture。扩 provider 时应补齐五家 model 必填性、额外字段拒绝、family 解析和 round-trip 测试。

方案要求“五家 wired”，但真实成功链只要求至少 2 家：[方案:58](/Users/wangyixiao/WorkSpace/OctoAgent/docs/product/2026-08-13-CLI供给扩容与画像融合方案-v1.md:58)。这不足以验证其余三家的成功输出 parser、模型证据和计费错误分类。每家至少要有一条经过脱敏的真实成功输出样本及对应 parser/cage 自证；否则只能标 experimental 或继续 inventory。

## 整体裁决

**需修订，不可按 v1 直接派工。**

修订到以下条件后可以派工：

1. docs/09 明确五家 binding、model、family 和 evidence 规则；
2. “五件套”增补 billing/cost provenance，并纳入 provider orchestrator 与 runner 配置隔离；
3. Gemini/Qwen 从 plan 档改为真实 tool-deny 策略，Kimi/OpenCode 无执行前阻断则暂缓 wired；
4. 定义 auth/model unknown 的恢复路径，修正失效登录提示；
5. 把“oneshot 零改动”收窄为 envelope/dialogLoop 零改动；
6. 重写推荐卡生成顺序，行内动作复用统一 plan factory；
7. 五家各自具备成功 fixture、负向安全测试和真实一发一收证据。