结论：**No-Go**。共发现 **A=2、B=1、C=1**。两个 A 均涉及错误激活，终批前必须修复。

## 分级发现

### A-1：config、`.env` 与 CLI runtime receipt 不是原子激活单元

证据：

- [pending.ts:161](~/WorkSpace/SayDo/packages/daemon/src/config/pending.ts:161) 依次、独立晋升 config 与 `.env`；config gate 不约束 `.env`。
- [index.ts:177](~/WorkSpace/SayDo/packages/daemon/src/index.ts:177) 启动时先验证，再分别执行文件与 runtime 晋升。
- [cliRuntime.ts:382](~/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:382) 对 staged receipt 逐槽跳过失败项、晋升成功子集，随后删除 pending 文件。
- 这与 [docs/09-data-contracts.md:1175](~/WorkSpace/SayDo/docs/09-data-contracts.md:1175) 的“缺一拒绝晋升、活动配置保持不动”不一致。

可复现反例：

1. 同时存在 `config.toml.pending` 和 `.env.pending`。
2. config 因缺失 CLI self-test receipt 被 gate 拒绝。
3. `promoteAllPending()` 仍会晋升 `.env.pending`。
4. 结果是旧 config 配上新密钥，候选虽被拒绝却已发生部分激活。

第二条路径是 config/env rename 后崩溃；重启前某 CLI binary 漂移。runtime recovery 会晋升其余 receipt、跳过漂移项并删除 pending evidence，得到与原 self-test 候选不同的活动集合。

影响：可能切断原本可工作的 provider，产生错误激活、半激活和恢复证据丢失。

最小修法：先完整预检 config、env、全部 CLI receipts，再进入统一 activation transaction；任何一项失败都不 rename、不合并 runtime、不删除 pending。若第二次 rename/runtime merge 失败，应通过 journal/backup 回滚。补两类重启测试：config gate 失败时 `.env` 不变；post-rename crash 后任一 receipt 漂移时全部拒绝并保留证据。

### A-2：高级逐槽流程只检查 `dialog`，其余三槽失败仍会重启激活

证据：

- [SetupWizard.tsx:611](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:611) 的 `runRestartAndTest` 只判断 `results["dialog"]`。
- [SetupWizard.tsx:1242](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:1242) 的高级步骤直接使用该流程。
- daemon 的 restart gate 主要补充 CLI receipt 校验，见 [index.ts:865](~/WorkSpace/SayDo/packages/daemon/src/index.ts:865)，无法替 API-only 槽补齐全绿门。

可复现反例：配置四个 API 槽，使 `dialog=ok`、`thinking=fail`，在高级步骤执行测试并重启。前端仍请求 restart，结构合法的 pending config 可被启动晋升。

影响：self-test 未全绿的配置成为 active，属于错误激活。

最小修法：高级流程复用基础流程的统一 activation helper，要求 `dialog/thinking/cheap/evaluator` 全部为 `ok`；失败时列出失败槽且绝不请求 restart。增加“dialog 成功、任一其他槽失败时 restart 调用次数为 0”的组件测试。

### B-1：关键反例主要停留在纯函数测试，未覆盖真实 UI 编排

证据：

- [setupApi.test.ts:255](~/WorkSpace/SayDo/packages/console/src/lib/setupApi.test.ts:255) 验证 helper，但没有渲染高级流程或验证实际 restart 调用。
- [resourcePlans.test.ts:21](~/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.test.ts:21) 只测卡片生成函数。
- [Chat.test.tsx:50](~/WorkSpace/SayDo/packages/console/src/components/Chat.test.tsx:50) 主要覆盖 availability helper 和独立按钮，没有完整验证模式切换、文本输入及 thinking 呈现。
- [byoa-fake-cli.e2e.test.ts:114](~/WorkSpace/SayDo/packages/daemon/test/byoa-fake-cli.e2e.test.ts:114) 有禁用工具代表例，但未逐类覆盖执行、授权、删除、会话、文件、屏幕工具及 optional-null 往返。

具体反例：当前 A-2 已存在，却不会被这些 helper 级断言捕获；同理，把 L26 保存 hash 的调用移动到 restart 之后，route helper 测试仍不能发现调用顺序退化。

影响：激活门、L26、双 ack、voice fail-closed 等关键集成行为容易回归。

最小修法：增加 SetupWizard/Chat 组件级测试，mock API 与上下文，覆盖四槽全绿、失败不重启、hash 调用顺序、重载失败导航、三形态卡、双 ack、voice 三类不可用以及文本仍可发送；daemon 增加 forbidden-tool 表驱动测试和 optional-null dispatch 往返测试。

### C-1：资源画像会把不可用的 Cursor 描述为可承担四槽

证据：

- [SetupWizard.tsx:229](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:229) 对任意 `logged_in` CLI 都追加“可承担四个推理槽”。
- [resourcePlans.ts:153](~/WorkSpace/SayDo/packages/console/src/lib/resourcePlans.ts:153) 则正确排除没有非 `auto` 模型的 Cursor。

可复现反例：Cursor 为 `found=true、logged_in=true、models=["auto"]`。资源画像宣称可承担四槽，但卡片生成器不会生成 Cursor 方案。

影响：文案自相矛盾，可能误导用户排障；不会直接错误激活。

最小修法：画像与卡片生成共用同一个 `usableCapability` 判定；只有找到首个非 `auto` 模型时才宣称可用。

## 八项逐项裁决

1. **Canonical：无。** [docs/09-data-contracts.md:1138](~/WorkSpace/SayDo/docs/09-data-contracts.md:1138) 已集中定义 oneshot、恒拒 project override、allowlist、上限、单 pending、await、失败丢 reply、零应用重试、B4 cap 与 self-test 门；旧段落也明确被当前补充取代。

2. **生产运行时：无。** [dialogLoop.ts:47](~/WorkSpace/SayDo/packages/daemon/src/brain/dialogLoop.ts:47) 使用精确 allowlist，[dialogLoop.ts:79](~/WorkSpace/SayDo/packages/daemon/src/brain/dialogLoop.ts:79) 严格校验 envelope/cap，[dialogLoop.ts:493](~/WorkSpace/SayDo/packages/daemon/src/brain/dialogLoop.ts:493) 按序 dispatch，并在失败或 await 后停止。未找到禁用工具进入、部分应用后重跑或真实 pending 不返回 `await_user` 的反例。现有 nullable 可选字段中，`null` 与省略在 handler 内语义相同。

3. **BYOA：无。** prompt 截断顺序、固定 instructions/current turn/action manifest、逐调用空 cwd、identity/tripwire、脱敏和全调用共享预算均闭合。provider 返回 `attemptsMade`，dialog retry 按剩余预算调用；未发现第三次进程路径。

4. **Binding、probe 与启动：A-1。** ModelBinding 到 oneshot 的自然投影、probe/setup resolver、project override 恒拒以及无 pipeline 的文本 reply/确认卡均未发现反例；激活原子性不成立。

5. **三形态卡与激活：A-2、C-1。** 实际卡片生成满足 found+logged_in、一家一张、排序、最多三张、Cursor 首个非 auto、双 ack、失败 fallback 和三卡占满时降级。高级全绿门和画像文案存在上述问题。

6. **基础卡、高级槽与 L26：除 A-2 外无。** 基础区置顶三列，高级逐槽仍保留；实际 UI 未显示“接入开发中”；15–25 秒文案正确。[SetupWizard.tsx:593](~/WorkSpace/SayDo/packages/console/src/components/SetupWizard.tsx:593) 在 restart 前保存 hash，失败或重载仍落到错误导航。

7. **Chat 与 voice fail-closed：实现无，测试见 B-1。** [Chat.tsx:14](~/WorkSpace/SayDo/packages/console/src/components/Chat.tsx:14) 的固定文案与 canonical 一致；key 缺失、ASR down、peer 离线都会在动作前禁用按钮和模式切换，键盘入口也有 guard，文本输入仍可用。按秒进度只消费既有 thinking/turn 状态，没有伪造 assistant。

8. **测试与 smoke：B-1。** fake CLI 已覆盖多数核心分支，包括预算第三发反例。真实 smoke 的代码确实创建真实 Codex provider，并解析其返回 envelope、验证 `remember` action，见 [byoa-smoke.mjs:18](~/WorkSpace/SayDo/packages/daemon/test/byoa-smoke.mjs:18)；不是手写 JSON。但本次未实际运行，因此不宣称 smoke 通过。

## OPEN QUESTION

当前测试在 [t18a-cli-slots.test.ts:359](~/WorkSpace/SayDo/packages/daemon/test/t18a-cli-slots.test.ts:359) 刻意接受 runtime receipt 的部分晋升，但 canonical 表述是全候选缺一即拒。需要 owner 明确 recovery 是否允许逐槽部分恢复；在 canonical 改写前，本评审按全有或全无判定 A-1。

## 实际只读验证边界

基线核对：`HEAD` 与 `9a6e767^{commit}` 均为 `9a6e767013e5c11a04f70eaed47c9bddf0123185`。

已实际执行：

- `git diff --check 9a6e767`：exit 0，无输出。
- daemon、console `tsc --noEmit --incremental false`：均 exit 0，无输出。
- `eslint packages/daemon/src packages/console/src`：exit 0，无输出。
- 两个 `.mjs` 的 `node --check`：均 exit 0，无输出。

未形成测试结论：

- `scripts/check-emoji.sh` 在 `mktemp` 时被只读沙箱拒绝，不能记为通过或代码失败。
- Vitest 在启动阶段因无法创建 `.vite-temp` 被拒，**没有任何测试体执行**。
- fake CLI 进程测试、真实 Codex smoke、网络调用及 headless 截图均未运行。
- 未修改任何文件，未启动 subagent；前后工作树状态一致。