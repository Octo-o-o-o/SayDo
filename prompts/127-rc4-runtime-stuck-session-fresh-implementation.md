# RC4 runtime 卡死会话替换：最终生命周期闭环

你是全新的零上下文实施会话。工作区为本文件所在 worktree。

前一 Grok resume 会话连续 18 分钟停在 `session_create`、零模型事件，已按规则终止。当前工作树已有未提交实施，不得 reset、checkout、丢弃或覆盖；先读仓库 `AGENTS.md`、prompts 111/113/116/120/123、当前 7 文件 diff，以及以下精确问题。不得新开分支、commit、push、发布、部署或访问外部写 API。

## 当前必须完成的验收

### 1. AggregateError 递归分类与真实循环

- `isProcessGroupLifecycleError` 必须递归识别任意嵌套 `AggregateError.errors` 中的 `ProcessGroupLifecycleError`，普通 aggregate 保持 false，畸形 getter/Proxy/cycle 不得抛错或死循环。
- 当前测试 `new AggregateError(cycleBag); cycleBag.push(cycle)` 不是真循环：构造器复制 iterable。必须直接变更该 `AggregateError` 实例自己的 `errors` 数组来形成 self-cycle / nested-cycle，并证明分类器退出。

### 2. Windows Job signal failure 不能假成功，也不能重复同一错误叶

- `TerminateJobObject` 在 signal path 抛错时，当前 `execRuntimeChild` 无论工作最终 code=0、code!=0、timeout/abort/overflow，都必须以 lifecycle 错误 reject；业务失败与生命周期失败同时存在时两者都保留。
- 当前 `signalFailure` 会在 success 分支抛出后被 catch，再次 SIGKILL，并在 `settleWithLeaseRelease` 中与同一个 map failure 重复聚合。同一错误对象/同一 signal failure 在最终错误树只能出现一次；不得得到 `[signal, signal]` 或 `[work, signal, signal]`。
- 可在 `combineLifecycleFailures` / `settleWithLeaseRelease` 做 cycle-safe、identity-safe 的扁平/去重，但不得丢不同的 work/release 错误，不得改变普通单错语义。
- Job/owner 与全局 contamination 必须维持 fail-closed next-spawn barrier；测试 reset 仍能精确回收，不能靠清污染让测试假绿。

### 3. BYOA 真实调用路径

- 增加直接走 `runSpawnTurn` / `killProcessTree` 的 Windows fake Job 反例：signal-path `TerminateJobObject` 抛错并且 work/timeout 等业务字段同时存在时，结果必须保留 work 字段并含 `lifecycleError=process_group_not_reaped`；共享 barrier 后下一次 spawn 被拒。
- 不只单测 `signalRuntimeChildTree` helper。

### 4. Tier1 双错分类

- real-agent 与 managed command 的 work+lease-release 双错必须被分类为 lifecycle，不能落普通 `blocked` / `ready_for_review` / `done`。
- 断言最终错误叶 exact-set，避免仅用 `some()` 掩盖重复 signal failure。

## 实施约束

- 只改当前 7 个 tracked 文件；除非必须，不新增文件。
- 不弱化进程组 drain、exact-empty、owner registry、shared contamination、SIGTERM→SIGKILL 或 listener-cleanup 合同。
- 不跑完整 daemon suite，不跑会在 workspace sandbox 启动大量真实 daemon/子进程的测试。只跑 typecheck 和最小 deterministic fake/分类器测试；宿主会在无 sandbox 环境跑 focused/full gates。
- 不以 sandbox 的 owner-home/EPERM 红灯修改产品逻辑。

最低门禁：

```bash
pnpm --filter @saydo/daemon typecheck
pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts -t '递归|循环' --pool=forks --maxWorkers=1 --minWorkers=1
pnpm --filter @saydo/daemon exec vitest run test/runtime-child-registry.test.ts -t 'signal-path|TerminateJob|BYOA' --pool=forks --maxWorkers=1 --minWorkers=1
pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts -t '双错' --pool=forks --maxWorkers=1 --minWorkers=1
git diff --check
```

若 sandbox 令某聚焦测试出现 owner-home/EPERM，保留真实失败并停止该类测试，不扩大运行。最终报告改动、精确反例、命令与真实退出码；保留工作树给宿主复核。
