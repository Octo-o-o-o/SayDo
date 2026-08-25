# rc.4 运行时宿主门禁返工

你仍在同一实施会话与同一 worktree：

`<worktree>`

这是新实施会话完成后的第一次宿主门禁红灯。只修下面这个真实失败，不提交、不推送、不发布、不部署，也不要改发布脚本、审计证据或版本号。

## 宿主侧真实失败

命令：

```sh
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
  test/recovery-only-process.test.ts
```

结果：`exit 1`，`1 failed / 278 passed / 2 skipped`。

唯一失败：

```text
recovery-only 真实进程组合根 > restart 后同步 signal：drain/close 各一次、spawn=0、signal 优先
expected reason=supervisor_stop
received reason=restart
packages/daemon/test/recovery-only-process.test.ts:382
```

## 必须满足的合同

1. `/api/setup/restart` 已认领并启动共享 lifecycle 后，同步到达的 `SIGINT`、`SIGTERM`、supervisor disconnect 或 fatal 仍必须在不可逆动作前覆盖 restart intent；优先级为 fatal > signal/supervisor stop > restart。
2. drain、server close、durable shutdown audit、DB close 与退出仍只执行一次，共享单一 lifecycle Promise 与单一总截止。
3. signal 胜出时 audit 必须只有一条，reason 为 `supervisor_stop`，发送 stopped，退出码 0，且不得 spawn 自重启子进程。
4. fatal 胜出时不得被 restart/signal 降级；发送 fatal、退出码 1、不得 spawn。
5. 不得通过删测试、改弱断言、增加任意 sleep 或仅扩大超时让测试碰巧绿。需要建立可判定的 intent 冻结/不可逆边界，并用确定性测试证明优先级。
6. 保持此前第二轮九项 P1 与 P2 的修复不回退。

## 门禁

至少真实运行并报告退出码：

```sh
pnpm --filter @saydo/daemon exec vitest run test/recovery-only-process.test.ts
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
  test/recovery-only-process.test.ts
pnpm --filter @saydo/daemon typecheck
pnpm --filter @saydo/cli test
pnpm --filter @saydo/platform test
scripts/check-emoji.sh
git diff --check
```

若仍有红灯，继续修到绿；不要把实施会话输出当作独立验收。
