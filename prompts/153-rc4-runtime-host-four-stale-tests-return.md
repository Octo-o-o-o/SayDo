# RC4 运行时宿主四条陈旧断言退回

你是本轮运行时回修的原实施会话。主会话已在 Grok workspace sandbox 外，用当前 worktree
原样执行：

```sh
pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts
```

真实结果是 `process-group-lifecycle 9/9`、`runtime-child-registry 53 passed / 1 skipped`；
`tier1-executor 136 passed / 4 failed`，总计 `198 passed / 4 failed / 1 skipped`。这证明此前
`ownership identity unavailable` 的大面积级联是 Grok workspace sandbox 无权读取宿主进程身份，
不是当前宿主门禁结论；但下面四条失败是当前实现与旧测试合同的真实不一致，必须修：

1. `subtype=error 且缺 is_error 的 result 仍以非零退出收口`：旧断言期待 `wait()` resolve
   `{exitCode:1}`，当前按 R2 目标 reject `RuntimeInvocationError(exitCode=1, terminationCause=exit)`。
2. `wait_exit_then_kill: result 早于 ownership...`：旧断言期待非零 resolve，当前 reject
   `RuntimeInvocationError(exitCode=128, terminationCause=exit)`；原 5 秒时序断言仍必须保留。
3. `exit -> EPIPE -> close 最终失败且诊断一次`：旧断言期待 resolve，当前 reject
   `RuntimeInvocationError(exitCode=1, terminationCause=pipe_failed, pipeStream=stdout, pipeCode=EPIPE)`；
   单次诊断断言仍必须保留。
4. `活动期 EIO 最终失败`：同理应精确断言 reject 的结构字段，不能改成泛化 `rejects.toThrow()`。

R2 已明确要求 business failure 作为结构化叶参与 `business -> signal(s) -> unreaped/release`
聚合；因此这里应更新四条陈旧测试合同，而不是让实现重新把 business-only 非零结果 resolve，
也不能降低 signal/unreaped 的保真要求。使用现有 `flattenProcessGroupLifecycleErrors` 或等价公共
分类函数精确断言：单 business 叶的 identity/字段正确；若无 lifecycle 叶则不得凭空污染。

先仅修改 `packages/daemon/test/tier1-executor.test.ts`，除非读回证明实现另有真实 bug；不要扩大
到其他文件。必须执行并回报：

```sh
pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts -t "subtype=error 且缺 is_error|wait_exit_then_kill|exit -> EPIPE -> close|活动期 EIO"
pnpm --filter @saydo/daemon typecheck
pnpm lint
node scripts/check-emoji.mjs
git diff --check 77d6cb417cfe577101ae401d079b2e84e5454c7c --
```

不要再在 Grok workspace sandbox 内把真实进程身份探针失败写成产品结论；三文件和完整 daemon
门禁由主会话在宿主权限下复跑。不要 commit、push、deploy 或调用 subagent。
