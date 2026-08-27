# RC4 运行时：完整三文件门禁重复 lifecycle leaf 返工

继续原 implementation session，只修改当前 worktree；不要 commit、push、联网或调用 subagent。

## 主机真实红灯

主机会话独立运行：

```text
pnpm --filter @saydo/daemon exec vitest run \
  test/process-group-lifecycle.test.ts \
  test/runtime-child-registry.test.ts \
  test/tier1-executor.test.ts
```

结果：exit 1；`208 passed | 1 skipped | 4 failed`。失败均是完整聚合路径把同一个 signal lifecycle leaf 再追加一次：

1. `real-agent business+two signals+unreaped 四叶顺序`：期望 4，实际 5，末尾再次出现 `TerminateJobObject failed in signal path`。
2. `real-agent signal+unreaped 无 business`：期望 2，实际 3，同一个 TerminateJob leaf 再出现。
3. `managed two distinct signals 保真`：期望两个不同 signal errors，实际第三叶又重复第一个 TerminateJob leaf。
4. `managed business+two signals+unreaped 四叶`：期望 4，实际 5。

聚焦 `-t` 门禁此前通过，说明它没有覆盖完整三文件运行下的所有聚合/settle 阶段，不能据此放行。

## 必须满足的合同

- 同一错误对象或同一已投影 leaf 被多个聚合阶段重复携带时，只出现一次，顺序保持首次出现的位置。
- 两个不同错误对象即使 message 完全相同也必须都保留；严禁按 message、name、stack 或序列化文本去重。
- `RuntimeInvocationError` 业务 leaf、每次不同 Job signal failure、fallback kill failure、unreaped/release failure 都要各自保真。
- hostile getter/revoked Proxy 仍只能产生稳定受控 leaf，不得为了 identity 去重重新读取不可信属性。
- 不允许删改上述四项期望来掩盖实现重复；先定位重复从哪个 aggregate/rethrow/release 阶段被重新展开，再在公共组合 primitive 中根因修复。
- 保持之前合同：纯业务失败不污染 lifecycle；业务+signal 污染；延迟 `wait()` 无 unhandled rejection；managed stdoutTail 保留；同一 Job 两次不同失败均保留。

## 回归与门禁

1. 必须新增/调整最小组合 primitive 回归，显式验证：
   - 同一 object 在 nested AggregateError 多次出现仅一次；
   - 两个 distinct Error 使用相同 message 仍为两个；
   - hostile/revoked 首参数加 lifecycle release 不覆盖真实 lifecycle leaf。
2. 先运行上述四项相关聚焦测试。
3. 再完整运行三文件命令，必须 `0 failed`，不得只跑 `-t`。
4. 再运行完整 daemon suite；若 teardown 受其它 worktree 并发污染，保留原始 exit 与证据，不得写成通过。
5. `pnpm --filter @saydo/daemon typecheck`
6. 对六个改动文件运行 ESLint。
7. `git diff --check`

最终逐条报告真实 exit code、pass/skip/fail 计数和是否出现 unhandled rejection。
