# rc.4 runtime 新实施会话第一次独立复审返工

你必须 resume 同一 Grok 实施会话 `01a02eb2-91fb-7171-8453-8b72f55b639c`，继续在本文件所在 worktree 施工。

当前代码提交：

`a2ed17386615b54dcb8410fe13a9a339fcc3fc45 fix(runtime): 固化重启信号覆盖窗口`

这是该全新实施会话完成后的第一次独立复审红灯，按仓库规则退回同一会话。先重读
`prompts/106-rc4-runtime-second-review-remediation.md`、
`prompts/109-rc4-runtime-host-gate-return.md`、
`prompts/111-rc4-runtime-recovery-second-red-new-session.md`，再读当前代码和测试。
不要读取旧 Grok 日志或用旧自报替代代码判断。不修改发布、审计证据、文档版本，不提交、不推送、
不发布、不部署。

独立复审在精确提交 `a2ed173…` 上得到 No-Go，P1 四项。四项都必须用直接反例闭合；不得只让旧测试变绿。

## P1-7a：500ms 到期必须原子关闭覆盖窗口

当前 `LifecycleDisposition` 的 timer 到期只 `completeGrace()`，没有 freeze；main/recovery 又在可能很慢的
drain 完成后才 freeze。真实探针：

```text
claim_restart=true
expired_signal_accepted=true
frozen={"kind":"signal","reason":"supervisor_stop"}
```

必须实现：

- `RESTART_OVERRIDE_GRACE_MS` 到期时原子提交当前 restart decision 并关闭 claim；不能只唤醒 waiter。
- `waitRestartOverrideGrace()` 发现单调时钟已到期或回拨时也走同一原子 freeze/expire 路径。
- grace 内 signal/fatal 按 `fatal > signal > restart` 覆盖；一旦非 restart 胜出，应停止 timer 并冻结最终 intent，
  不能等 drain 再让另一 intent 改写。
- drain 可以继续运行，但绝不能延长 500ms claim 窗口；总 shutdown deadline 仍是唯一外层硬截止。
- 补确定性虚拟时钟反例：保持 drain unresolved，推进 timer 到边界，再 claim signal/fatal 必须 false，最终 restart；
  边界前 signal/fatal 必须胜出且 timer 不再改写；时钟回拨不得延长。

## P1-7b：supervised restart 也必须走唯一 lifecycle promise

当前 main `performSelfRestart()` 和 recovery `restart()` 在 supervised 分支中先写
`setup.self_restart`、发送 `restartRequested` 后直接 return，绕过 `ensureLifecycleOnce()`。
supervisor 随后收到 signal 时因 `restartRequested=true` 进入 emergency stop。真实集成探针：

```text
supervised_restart_then_signal=Error: daemon shutdown forced by repeated signal
```

必须实现：

- main 与 recovery、supervised 与 unsupervised 的 restart 都先进入各自唯一 lifecycle promise；
  drain、listener close、freeze、shutdown audit、DB close、lock release、frame/spawn/exit 各最多一次。
- 只有最终 freeze 为 restart 后，才允许唯一 `setup.self_restart` audit。
- supervised 最终 restart：freeze 后发送唯一 `restartRequested`，等待 IPC send callback，再按现有 supervisor 合同退出；
  不 detached spawn。unsupervised 才允许唯一 spawn。
- HTTP 200 后、freeze 前同步 SIGINT/SIGTERM 或 fatal 到达时，signal/fatal 胜出；不得发送
  `restartRequested`、不得 spawn、不得触发 supervisor emergency stop。
- 正常 signal 应唯一 `runtime.prepare_shutdown(reason=supervisor_stop)`、唯一 stopped、exit 0；fatal 唯一 fatal、exit 1。
- main 与 recovery 均补 supervised/unsupervised 的 restart-only、restart+同步 signal、restart+fatal 竞态；
  至少保留真实进程集成层，不得全是裸 helper mock，也不得加任意 sleep 制造通过。

## P1-1 残余：Windows 有 Job 时不能先被 leader birth mismatch 阻断

当前 `verifiedOwnedAgent()` 在进入 Windows Job 回收前先校验 leader birth；live PID 已复用时直接抛
identity mismatch，`job_kill_calls=0`。真实探针：

```text
outcome=Error: tier1 agent ownership identity mismatch:run_reuse
actual_birth_present=true
job_kill_calls=0
```

必须实现：

- Windows durable owner 有合法 `jobName` 时，具名 Job active-process readback 是成员存活/回收的权威入口；
  leader PID/birth 只可作为诊断，不能阻止终止原 Job。
- active > 0：TerminateJob，单调有界轮询到 exact zero，checked-close 后才删除 owner；
  active = 0：checked-close 后才视为 gone；query/terminate/close 失败保留 owner 并 typed reject/污染。
- 没有 jobName 仍 fail-closed；非 Windows 的 birth/PGID 防 PID 复用合同不回退。
- 把现有不存在 PID `424242` 的假覆盖换成真正“live PID + birth 不匹配 + Job active > 0”的反例，
  断言 Job kill 被调用且 exact-empty 后 owner 才删除。另保留 Windows 真孙进程用例，最终会在真实 Windows 重跑。

## P1-4 残余：Job teardown 失败必须让当前调用失败

当前 `teardownRuntimeJob()` 对 query/terminate/drain/close 失败只污染全局并返回 `unknown/alive`；
lease release 仍 resolve。`execRuntimeChild` finally 因而返回成功；real agent 又以
`exitP.finally(() => childLease.release()).catch(() => undefined)` 丢弃 release rejection。真实探针：

```text
exec_outcome=resolved:ok
contaminated=true
jobs=1
owners=1
```

必须实现：

- Job query/terminate/drain/close 任一不能证明 exact-gone 时，teardown 必须污染共享 lifecycle、保留 Job/owner，
  并 reject typed `ProcessGroupLifecycleError`；不得用状态返回让 release resolve。
- `execRuntimeChild` 的主结果必须与 release 结果闭合：主逻辑成功但 release 失败时当前调用 reject；
  主逻辑与 release 同时失败时保留两个 cause（`AggregateError` 或项目一致的 typed cause），不能被 finally 覆盖或吞掉。
- Tier1 real agent、managed runtime child、BYOA/oneshot 的最终 promise 都必须纳入 release；
  不能 background `.finally(...).catch(() => undefined)` 后先向调用方 settle 成功。
- 补 query/terminate/drain/close 逐项故障注入，至少覆盖 exec、real agent、managed、BYOA 四入口：
  当前调用失败、不得 settle/ready_for_review 成功、owner/job 保留、共享 contamination 非空、后续 spawn 拒绝。
- 正常退出的成功路径、原 pipe-failure 优先级和 release-vs-establish latch 不回退。

## 验收门禁

先逐条运行新增直接反例，再运行：

```sh
pnpm --filter @saydo/daemon exec vitest run \
  test/lifecycle-disposition.test.ts \
  test/recovery-only-process.test.ts \
  test/restart-policy.test.ts \
  test/runtime-child-registry.test.ts \
  test/tier1-executor.test.ts \
  test/tier1-claude-outcome.test.ts \
  test/byoa.test.ts

pnpm --filter @saydo/daemon exec vitest run \
  test/runtime-child-registry.test.ts \
  test/exact-test-roots.test.ts \
  test/process-group-lifecycle.test.ts \
  test/shutdown-deadline.test.ts \
  test/runtime-child-wrapper-syntax.test.ts \
  test/restart-policy.test.ts \
  test/tier1-executor.test.ts \
  test/tier1-claude-outcome.test.ts \
  test/byoa.test.ts \
  test/recovery-only-process.test.ts \
  test/lifecycle-disposition.test.ts

pnpm --filter @saydo/daemon typecheck
pnpm --filter @saydo/cli test
pnpm --filter @saydo/cli typecheck
pnpm --filter @saydo/platform test
pnpm --filter @saydo/platform typecheck
pnpm lint
bash scripts/check-emoji.sh
git diff --check
```

不得减少测试、增加 skip、吞 release 错误、清 owner 后伪装成功，或把待真实 Windows 复测写成已验证。
交付仅报告实际改动、逐项合同映射和真实命令/退出码；宿主会重新独立验收。
