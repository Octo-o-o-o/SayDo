# RC4 运行时独立复审回修：signal-path Job 错误与双错生命周期分类

继续同一运行时实施会话。工作目录为本文件所在 worktree。

目标提交 `a4915d1f45d4032df6313b9581e375c75caec621` 的第一次零上下文独立复审发现两个 P1，均属于验收合同 4。不得提交、push、发布或部署；完成后保留工作树给宿主复核。不得读取 `prompts/`、`logs/` 中既有内容，本 prompt 除外。

## 1. Windows signal-path Job 终止失败必须进入当前 invocation 的结果

当前 `signalRuntimeChildTree()` 在 `terminateNamedJob` 抛错时只调用
`contaminateRuntimeChildLifecycle(err)` 后返回；`execRuntimeChild()` 的 `signalTree()` 又吞掉 signal 异常。若随后 `namedJobActiveCount()` 恰好返回 0，当前 exec 会正常 resolve，尽管全局 lifecycle 已污染。

独立复审的确定性反例真实得到：

```json
{
  "outcome": {"status":"resolved","value":{"stdout":"","stderr":""}},
  "contamination":"TerminateJobObject failed in signal path",
  "active":0
}
```

要求：

1. `terminateNamedJob` 的错误仍污染共享 lifecycle，但还必须被当前 `execRuntimeChild` invocation 锁存并最终 reject；不得依赖 Job 后续 active count、PID 状态或 lease release 再次失败才能暴露。
2. 覆盖所有触发 signal 的当前调用路径：timeout、abort、maxBuffer、pipe error、非零退出后的兜底 SIGKILL、close withheld，以及 work catch 中的兜底 kill。若 signal 错误与原 work 错误同时存在，二者都必须保留，且整体仍被 lifecycle 分类器识别。
3. timer callback 内不得产生未处理 rejection/exception；使用 invocation-local latch 或等价安全机制，并在 settle 前确定性读取。
4. 直接调用 `signalRuntimeChildTree` 的既有合同不得静默回退；如果调整返回值/抛错形状，所有调用方与测试同步明确处理。
5. 增加最小 Windows-hook 反例：`terminateNamedJob` 抛错后 `namedJobActiveCount` 立即为 0，当前调用仍 reject 为 lifecycle，owner/job 保留且后续 spawn 被 barrier 拒绝。至少覆盖一个原 work 成功形状和一个原 work 同时失败形状。

## 2. work + release 双错的 AggregateError 必须递归识别 lifecycle

当前 `combineLifecycleFailures()` 返回普通 `AggregateError`，而
`isProcessGroupLifecycleError()` 只检查外层。独立反例中 errors 数组含
`ProcessGroupLifecycleError("CloseHandle failed")`，但分类结果为 false，managed task 因而可能降级成普通 `blocked`。

要求：

1. `isProcessGroupLifecycleError()` 必须递归识别 `AggregateError.errors` 中任意层级的 lifecycle error；保留既有 message-based 兼容判断。
2. 递归必须有循环保护，且读取畸形/Proxy `errors` 失败时不得让分类器自身抛出新异常。
3. `combineLifecycleFailures()` 必须继续保留原 work error 与 release error，不能用一条拼接 message 覆盖结构化原因。
4. 增加单元测试：单层与嵌套 AggregateError、循环/畸形 errors、不含 lifecycle 的普通 aggregate。
5. 增加 managed executor 与 real-agent（或项目中对应真实 agent 执行入口）的 work+release 双错测试：最终必须走 lifecycle contamination/restart 语义，不得落普通 `blocked`、`ready_for_review` 或成功。

## 3. 回归与门禁

改动保持最小，不得弱化重启窗口冻结、唯一 lifecycle、owner/job exact-set、teardown 与 SIGTERM cleanup。真实运行并报告退出码/计数：

1. 直接覆盖上述两个复审反例的 focused Vitest。
2. `pnpm --filter @saydo/daemon test -- --runInBand` 不适用于 Vitest；请使用项目现有、可验证的 Vitest 运行方式，必要时按文件聚焦，不要伪造参数。
3. `pnpm --filter @saydo/daemon test`
4. `pnpm --filter @saydo/daemon typecheck`
5. `pnpm --filter @saydo/cli test` 与 typecheck。
6. `pnpm --filter @saydo/platform test` 与 typecheck。
7. `pnpm lint`
8. `bash scripts/check-emoji.sh`
9. `git diff --check`
10. 前后精确核对 runtime process registry roots 为 0；若有遗留，先报告并安全收口，不得把 all-skipped 当绿。

最终只汇报：最小修复、两个反例、每项真实门禁、registry roots 前后数量和剩余阻断。不要 commit。
