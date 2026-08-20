# 62 号自审：D1 终审(4A/9B/2C) findings 修复

日期:2026-08-12  
分支:`feat/m2-ios-shell-spike`  
基线:HEAD `6d80c77`（D1 五 commit 已在）  
门禁:本会话 `pnpm ci:node` exit 0（含 typecheck / lint / 全量单测 / emoji / `verify:distribution`）

## 结论

**GO（修复后）。** 终审 A×4 / B×9 / C×2 均按判词最小修法落地，并配针对性测试或门禁断言。无 DISPUTED 项。

## 逐条对账

| ID | 状态 | 修法摘要 | 测试/证据 |
|----|------|----------|-----------|
| A1 | 完成 | `ProcessGroupLifecycleError` 污染 lifecycle；`proc.wait` 组未 ESRCH 不落业务 failed；`lifecycleContamination` 阻断 stopped；未验证 ESRCH 禁止写 cancel proof | `process-group-lifecycle.test.ts`；executor prepare 路径 `allSettled` 后抛 contamination |
| A2 | 完成 | `shutdownEpoch`/`restartEpoch`/`resumeMarkerEpoch`；`markRestartResumed` 遇新代 `restartPending` 拒清；`recoverAttempt` 在 session 缺失判定前先处理新 suspension | `tier1-executor` D1 prepare/resume 用例 |
| A3 | 完成 | `recover()` await 每条 run 的 claim barrier；`/readyz` 与 IPC ready 依赖 `startupLifecycleReady && !runtimeDraining` | executor recover claim；readyz 同源字段 |
| A4 | 完成 | dead leader + 组仍存活 → fail-closed，禁止数值 PGID 盲杀；live identity 补 pgrep/token 回退 | `emergency-reaper` A4 用例；`restart-policy` leader 死测 |
| B1 | 完成 | `git ls-files -z` + 单一 snapshot + metafile 闭包；缺文件拒绝 | `packages/cli/scripts/build.mjs` |
| B2 | 完成 | supervisor 对 signal/restartRequested 统一 30s deadline；第二信号 emergency；daemon deadline 覆盖 drain/DB/IPC | supervisor 代码路径 |
| B3 | 完成 | settle 中 terminal result 先于 restart suspension；graceful prior-running 仅 exact native 可挂 marker/恢复 | executor + distribution fixture 精确 `--resume` ID |
| B4 | 完成 | 单一 lifecycle intent CAS；signal/fatal 优先 restart；spawn 前释放 HOME lock；recovery-only 去掉 200ms 固定延迟 | `index.ts` / `recoveryOnlyServer.ts` |
| B5 | 完成 | `classifyActiveWork` 同源：recoverable Tier1 / unrecoverable Tier1 / BYOA | `active-work-classifier.test.ts`；desktop summary |
| B6 | 完成 | 登记 shutdown intent 即 `armShutdownIngress`；ASR/confirm/text 入口检查 draining/ready | `index.ts` voice 入口 |
| B7 | 完成 | identity 与 contracts protocol 对账；fixture 精确 resume ID；COUNT=1/同 session；bundle 无仓绝对路径；47100 占用前后 liveness | `verify-distribution.mjs` |
| B8 | 完成 | cleanup `allSettled` 独立捕获；全员 ESRCH 后才删 scratch；`AggregateError` | `verify-distribution.mjs` finally |
| B9 | 完成 | bind 后 starting `/health`；probe 对 starting/unknown 有界重试 | `index.ts` early health；`probe.ts`/`supervisor.ts` |
| C1 | 完成 | `eslint.config.mjs` + 单文件存在性断言 | `build.mjs` |
| C2 | 完成 | `homedir` 空时回退 `userInfo().homedir`，仍失败则明确 OS home unavailable | `options.test.ts` |

## 附带硬化（支撑 A4/可测性，非扩 scope）

- runtime wrapper 组员枚举改 `pgrep -g`（禁 setuid `ps` 环境仍可收孙进程）。
- agent ownership 建立时带 wrapper `commandToken`（`-e` 超长导致 pgrep 截断的 identity 缺口）。
- 测试 fixture 根从 `$HOME` 迁到 owner-home 可写子树 / 仓内临时区，避免沙箱 EPERM 假红。

## 门禁证据（本会话）

- `pnpm ci:node` → exit 0  
  - typecheck / lint 绿  
  - contracts + cli + console + daemon 测试绿（daemon 约 100 files / 1211 passed / 4 skipped）  
  - emoji gate: clean  
  - `verify:distribution` → `ok: true`，lifecycle `prepareShutdown: restart_pending` → `resumed: settled_review`

## 残余风险 / 观察

- process identity 在禁 `ps` 环境降级为 `pgrep`/`token1`/`alive1`：生产 macOS 仍优先 `ps lstart`；降级路径以 commandToken + generation 防误杀。
- `alive1:${pid}` 对 HOME lock 仅作存活锚，配合 `instanceId` 使用；不单独作为跨 PID 复用的充分证明。

## 裁决

| 项 | 结果 |
|----|------|
| A 级 | 0 遗留 |
| B 级 | 0 遗留 |
| C 级 | 0 遗留 |
| DISPUTED | 无 |
| Go/No-Go | **Go** |
