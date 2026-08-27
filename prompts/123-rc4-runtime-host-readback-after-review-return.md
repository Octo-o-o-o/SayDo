# RC4 Runtime 首次独立 review 回修后的宿主 readback

继续 resume 同一 Grok 实施会话 `01a02eb2-91fb-7171-8453-8b72f55b639c`，工作区为本文件所在 worktree。

这是 prompt 120 实施后的宿主反馈，不是第二次独立 review。不得新开分支、提交、push、发布或部署。先重读 prompt 120、当前七文件 diff 和本文件。

宿主已真实运行：

- `pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts`：exit 0，2 files passed，56 passed / 1 skipped。
- `pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts -t '双错|release 失败'`：exit 0，5 passed / 116 skipped。
- `pnpm --filter @saydo/daemon typecheck`：exit 0。

你在 workspace sandbox 中启动的全量 daemon suite 因沙箱禁止宿主进程身份探测和 owner-home 写入，出现 `processBirth=null`、`EPERM ~/.saydo-wsid-*`，随后 shared lifecycle 污染让大量无关用例 timeout。宿主已中止该无效门禁并收掉精确 PGID；不得在 workspace sandbox 中重复跑全量 suite。最终全量由宿主在非该沙箱环境运行。

## P1：循环 AggregateError 测试当前没有真的形成循环

当前测试先 `new AggregateError(cycleBag)`，再 `cycleBag.push(cycle)`；构造器会复制 iterable，因此 `cycle.errors` 仍是空数组，测试没有覆盖递归环。

- 修改测试，让 `AggregateError.errors` 的实际数组直接包含自身，或用等价真实循环；nested cycle 也必须真实可达。
- 断言分类器有界返回且不抛；包含 lifecycle leaf 的真实循环仍应返回 true。
- 保留 getter/Proxy 迭代异常与普通 aggregate 的现有覆盖。

## P1：补 BYOA signal failure + work failure 的直接合同测试

prompt 120 明确要求 managed、real-agent、BYOA 双错覆盖。当前新增测试只覆盖 runtime exec、managed 和 real-agent；`runner.ts` 的 `killProcessTree()` 改动没有新的直接反例。

- 使用现有 runner 测试 seam 构造 Windows Job：`terminateNamedJob` 抛错，同时保留一个可观察的 work failure（例如 nonzero、timeout、pipe/output limit 中适合现有夹具的一种）。
- 断言结果保留 work 失败字段，同时 `lifecycleError === "process_group_not_reaped"`；不得 resolve 成成功，也不得出现未处理拒绝。
- 断言 shared/BYOA contamination 已写入，下一次受管 spawn 被 barrier 拒绝；清理后 exact roots/监听数不泄漏。
- 不要只测试 `contaminateByoaLifecycle()` helper；必须经过 `killProcessTree()` 对 `signalRuntimeChildTree()` 抛错的真实控制流。

## P2：避免同一 signal failure 被无意义重复聚合

readback 发现当前 `execRuntimeChild()` 可先在 success 尾部 `rejectIfSignaled()` 抛 `signalFailure`，随即被本层 catch 捕获，再把同一个对象与自身 combine；lease release 又可能从 `jobSignalKillFailures` 抛同一个错误。请检查真实错误树：

- work 成功 + signal failure 最终至少是 lifecycle reject，不应产生多个完全相同的重复 leaf。
- work failure + signal failure 必须恰好保留可辨认的 work failure和至少一个 lifecycle failure；不要因去重丢掉 work error。
- 可在 `combineLifecycleFailures()` 做 identity 去重/扁平化，或调整 `execRuntimeChild()` 控制流；保持既有真实 work+release 两个不同错误的顺序和语义。
- 增加精确断言，不能只用 `some()` 让重复树蒙混过关。

## 收口门禁

只跑受影响的定向门禁并报告真实退出码；不要再跑 sandbox 全量 daemon suite：

```bash
pnpm --filter @saydo/daemon typecheck
pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts
pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts -t '双错|release 失败'
# 新增 BYOA 定向测试所在文件或精确 test-name
git diff --check
```

最终列出代码、真实循环测试、BYOA 控制流反例、去重语义和每项门禁；不要 commit。
