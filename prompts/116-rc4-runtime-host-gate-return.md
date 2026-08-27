# RC4 运行时返工后的主机门禁红灯回传

你是上一轮运行时实施会话。继续在当前 worktree 修复，不要新开分支，不要提交，不要改写已经通过的运行时语义。

## 已核验事实

- 当前返工代码的 focused tests、daemon/cli/platform typecheck、lint、emoji、diff-check 均已通过。
- 当前完整 daemon 测试的 129 个文件、1991 个测试中，127 文件通过、2 文件跳过；1985 测试通过、6 测试跳过。所有测试断言通过，但 global teardown 因恰好两对 `testRoot/tmpRoot` 未回收而退出 1。
- `--maxWorkers=1` 仍恰好两对根，排除并发竞态。
- 在干净基线 `a2ed17386615b54dcb8410fe13a9a339fcc3fc45` 独占重跑，1972/1978 测试通过、6 跳过，也因同样两对根退出 1。这是已有测试基础设施缺陷，不是本轮运行时逻辑回归。
- 两对根对应两个整文件条件跳过：`p05b-recovery.e2e.test.ts` 与 `tier1-live.e2e.test.ts`。Vitest 会运行 `setupFiles` 创建并登记根，但整文件全跳过时不运行 `afterAll`；tinypool 用 SIGTERM 结束 worker，普通 `exit` 钩子没有执行。
- 已在一次性基线 worktree 实证：仅把 suite skip 改成逐 test skip 仍红；在 `test/setup.ts` 给 SIGTERM 增加 `cleanup()`，随后移除 SIGTERM listeners 并向自身重新发送 SIGTERM，两个全跳过文件的独立命令退出 0。

## 必须修复

在正式当前 worktree 中做最小、通用、fail-closed 的清理修复：

1. worker 被 SIGTERM 终止时必须同步执行既有 `cleanup()`；用 `try/finally` 保证即使清理抛错也恢复默认 SIGTERM 终止语义，不能吞掉终止信号或让 worker 挂住。
2. 不得把整文件 skip 改成哨兵假测试，不要逐文件打补丁；修复应覆盖今后任何全跳过文件。
3. 不得放宽 exact-set，不得把 2 秒等待调大，不得在断言前清扫，不得把真实泄漏改成通过。
4. 若需要测试，保持最小；不要带入一次性基线 worktree 的实验改动。

## 门禁

依次执行并给出真实退出码与摘要：

```bash
pnpm --filter @saydo/daemon exec vitest run test/p05b-recovery.e2e.test.ts test/tier1-live.e2e.test.ts
pnpm --filter @saydo/daemon test
pnpm --filter @saydo/daemon typecheck
pnpm --filter @saydo/daemon exec vitest run test/lifecycle-disposition.test.ts test/recovery-only-process.test.ts test/restart-policy.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts test/tier1-claude-outcome.test.ts test/byoa.test.ts
pnpm lint
node scripts/check-emoji.mjs
git diff --check
```

完整测试期间不要并行运行另一个 daemon Vitest；exact-root registry 是全机共享的。不要提交。
