# Codex 独立裁决:首发收口后四件 owner 决策(对抗面板第 5 路)

> 模型 gpt-5.6-sol / max / read-only;prompt = prompts/15-owner-decisions-panel.md;日志 logs/15-owner-decisions-panel.log(其自发嵌套的 g3p 交叉复核未计入,主裁决即本文)。

---

以下为独立裁决。八组必读材料均已读到；收口文档中的 `just ci` 等结果按文档记录引用，本轮未重跑全量门禁；代码与 CLI 抽查为本会话实测。

## Q1 tag

**结论：两段式——现在在当前 HEAD 打并推送 `v0.1.0-rc.1`；场次④通过后，再把通过后的首个 commit 打为 `v0.1.0`，不移动或覆盖 `rc.1`。**

关键理由：

1. 首发判定明确是 `final-readback + owner 场次④`，不是工程侧收口本身（`SayDo/e2e/evidence/final-readback.md:73-76`；`voice-coding/IMPLEMENTATION-PLAN.md:129-142`）。
2. 本会话实测 SayDo 当前为 `628f7e4`、`main...origin/main`、尚无 tag；交付复核也记录“tag 待 owner 确认后打、未打未推”（`voice-coding/research/2026-07-25-saydo-closeout-impl-readback.fable.md:49-52`）。`rc.1` 能把已收口工程证据锚在一个不可变候选点。
3. 若场次④发现需修复，保留 `rc.1` 作为可回溯候选，必要时另打 `rc.2`；稳定版只指向真人验收后的状态，回退和归因成本最低。

最强反方：等场次④后再打任何 tag，可避免候选版本被误当成可用发布物。

置信度：高

## Q2 ADR-002 条款去留

**结论：收窄改写；当前豁免继续休眠，`api`/`cursor_cli` 的严格口径不变。**

建议将 09 §11 规则 2 改为：

> `codex_cli`/`claude_cli` 仅在每次调用前解析到预登记的绝对可执行路径，且版本与内容 digest 核验一致时，才可把缺失 `observedModel` 按恒定族处理；任一身份核验缺失、漂移或失败，缺失一律按 `observed_model_missing` 作废并审计。流内有 `observedModel` 仍必须执行 `familyOf` 校验；`cursor_cli`/`api` 缺失一律作废。

当前实现没有这条身份核验链，所以该前提目前**未证实且不满足**，不能立即启用豁免。

关键理由：

1. `familyFixed` 只由 provider 标签决定，缺失模型会直接跳过作废（`SayDo/packages/daemon/src/providers/byoa/provider.ts:60-67`；`consume.ts:74-81`）。
2. Cage 返回的是裸的 `codex`/`claude` 名称，runner 通过 `PATH` 启动，真实 binary probe 也未接入（`cage.ts:19-23,25-73`；`runner.ts:36-43`；`config/probe.ts:1-3`）。Node `spawn` 不走 shell alias，但 PATH 中的同名 shim 或被替换的二进制会生效；只要输出可解析、无 `model` 的事件流，就可能通过当前豁免。
3. owner 当前只用 cursor，且 cursor 仍要求流内模型字段（`SayDo/docs/adr/ADR-002-byoa-observed-model.md:38-44`；`voice-coding/docs/09-data-contracts.md:728-729`），所以收窄不会改变当前 dev 行为，同时避免删除后使未来 codex/claude evaluator 永久不可用。

最强反方：直接删除豁免最简单，也不会留下当前尚未实现的身份证明承诺。

置信度：高

## Q3 三件上浮排期

**结论：①场次②前必做；②dogfood 期完成且先于首个依赖项目配置的真实 dispatch；③放 P1，并将 `retryTask` 定义为重派发，不补 `failed→running` 边。**

关键理由：

1. ① 当前只是库函数，没有生产调度调用；30 秒 `paused_step_boundary→blocked` 和 72 小时停靠老化都不会自动发生，审批超时任务会继续占住 worktree/队列，既不进入 `cancel_requested`，也不会触发 draft 回落（`SayDo/packages/daemon/src/approvals/parkAging.ts:9-18,20-47`；`packages/contracts/src/statemachines/task.ts:23-35`；`packages/daemon/src/index.ts:362-381`）。
2. ② `mergeConfig` 只有库层 helper，schema 没有 `project/git/verify/setup` 生产字段，daemon 运行时只加载全局配置；当前无运行时暴露，适合在 dogfood 首个真实仓阶段接入（`SayDo/packages/daemon/src/config/types.ts:6-62`；`config/load.ts:1-49`；`index.ts:350-367`；`SayDo/HANDOFF.md:38-39`）。
3. ③ 当前实现计算了 attempt，却无 CAS、无新 `tier1_run`、不保存 message，并对 failed 直接无条件置 `running`；这与失败 run 终态和 §6.1 的 attempt 规则不自洽（`operations.ts:246-261`；`contracts/src/statemachines/task.ts:28-56`；`contracts/src/statemachines/tier1run.ts:3,7-15`；`voice-coding/docs/09-data-contracts.md:573`）。

③ 的 canonical 处置应是：旧 failed run 保持终态，重派发创建 `attempt+1` 的新 run，沿 re-drop/queue/既有门禁路径进入执行；`blocked→running` 仅保留给用户应答注入。不要把失败重试伪装成直接状态边；失败来源需要在 P1 明确定义其重派发命令/边，而不是偷偷补一条 `failed→running`。

最强反方：补一条 `failed→running` 是最小改动，能让场次②立即支持重试。

置信度：高

## Q4 场次编排与人工测试

**结论：不合并，严格按①→②→③→④执行，时长分别约 15–20、30–40、30、45–60 分钟；第一次上手只跑“耳机/PTT→一个低风险任务→逐步确认→approve→人工 merge”的最短路径。**

关键理由：

1. 依赖图明确是 Phase 1→Phase 4→Phase 5，且场次③前置要求场次①②已过；场次④是唯一真人首发交付门，合并会混淆失败归因（`voice-coding/IMPLEMENTATION-PLAN.md:147-153`；`SayDo/e2e/owner-sessions/session-3.md:7-10`；`final-readback.md:73-76`）。
2. 当前 `dialogLoop` 明确仍是纯对话，live tool loop 随场次②增量；BrainTools 只注册三个早期 handler，SessionManager、Tier1 操作和停靠调度没有生产调用方。因此 session-1/2 的业务预期尚不能按 sheet 直接宣称可跑（`SayDo/packages/daemon/src/brain/dialogLoop.ts:1-8`；`brain/tools.ts:1-4`；`session/manager.ts:14-22,33-46,92-109`；`SayDo/HANDOFF.md:39`）。
3. 命令本身大多存在，但有现场卡点：`just dev`、ASR 脚本和音频路径存在（`SayDo/justfile:3-25`；`session-1.md:9-13`）；本会话实测 `cursor-agent status` 报 `SecItemCopyMatching failed -50`，`hopper capabilities --json` 裸调用命中全局 baseline.1 与 `~/Hopper`，而锁定调用才是 baseline.2 与 `~/.saydo/hopper-vault`；`hopper show --json` 还会报缺少 `task-id`（`session-4.md:23,30,34-54`；`~/.saydo/config.toml:50-55`；`voice-coding/docs/09-data-contracts.md:654-666`）。

owner 前置准备应收敛为：

- ①：耳机、ASR 凭据、`just dev`。
- ②：指定小型低风险仓、Gate0 `enabled=true/bypass=false`、live wiring 就绪；当前 `retryTask` 不进入生产入口。
- ③：①②通过，真麦至少形成约 20 轮延迟样本。
- ④：独立测试仓、专用 vault、锁定 Hopper 调用、runner 登录、`just ci`。

最强反方：把①/③或②/③合并，可以减少 owner 占用时间。

置信度：高

## 跨题一致性检查

四个结论组合一致：

1. `rc.1` 是工程候选证据锚，不宣称首发交付；`v0.1.0` 等场次④通过后再打，与交付判定不冲突。
2. Q2 的收窄条款当前仍休眠；Q4 的 cursor 环境故障不会被豁免掩盖，仍须按严格口径处理。
3. Q3 的停靠调度前置直接支撑场次②；项目配置在 dogfood 期接入，retry 则明确留到 P1，因此场次②不调用当前绕状态机的 `retryTask`。
4. 场次④必须在③之后，才能保持“P0 总验收”和“P0.5 唯一真人交付门”的独立性。

## 事实前提核验表

| 代码前提 | 实读结论 | 证据 |
|---|---|---|
| `parkAging.ts` 就绪度与未接调度风险 | 老化函数只扫描 `ready_for_review/blocked`，CAS 到 `cancel_requested`；package fallback 明确交给调用方。生产代码未找到调用，30 秒转 `blocked` 也只有状态表、没有生产调度。因此超时停靠任务会继续停靠，不会自动取消或回落 draft。 | `SayDo/packages/daemon/src/approvals/parkAging.ts:9-18,20-47`；`SayDo/packages/contracts/src/statemachines/task.ts:23-35`；`SayDo/packages/daemon/src/index.ts:362-381` |
| `retryTask` 是否绕状态机 | 允许 failed/blocked，计算 next attempt 后对 task 做无条件 `UPDATE`；failed 无合法出边，旧 `tier1_run` 仍是终态，message 只记 `hasMessage`。当前行为不符合 §6.1 的新 run/证据隔离语义。 | `SayDo/packages/daemon/src/tier1/operations.ts:246-261`；`packages/contracts/src/statemachines/task.ts:28-56`；`packages/contracts/src/statemachines/tier1run.ts:3,7-15`；`packages/daemon/src/storage/dao/tasks.ts:172-175` |
| `familyFixed` 是否有“零谎报面” | **未证实；当前实现不成立。** 豁免由 provider 字符串触发，binary 是裸名并经 PATH 启动；shell alias 本身不影响 `spawn`，但 PATH shim/同名替换会影响。当前没有实际 executable identity attestation。 | `SayDo/packages/daemon/src/providers/byoa/provider.ts:60-67`；`consume.ts:74-81`；`cage.ts:19-23,25-73`；`runner.ts:36-43`；`config/probe.ts:1-3` |
| session-1..4 命令与路径 | `just dev`、ASR/音频脚本、虚拟环境路径真实存在；但 session②的 cursor 认证当前实测失败。Hopper 命令不是不存在，而是裸调用指向错误安装/ vault，`show` 缺 task id；locked binary + dedicated vault 的调用才与契约一致。session①的 transcript 路径在当前 live SessionManager 未接线前**未证实**。 | `SayDo/justfile:3-25`；`e2e/owner-sessions/session-1.md:9-13,29-34`；`session-2.md:12-16`；`session-4.md:12-17,23,30,34-54`；`~/.saydo/config.toml:50-55`；本会话实测 CLI 输出 |
