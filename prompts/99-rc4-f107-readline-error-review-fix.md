# RC4 F107 `readline.Interface` error 复审修复单

## 1. 已验证红灯

目标基线为 `30d37999846255ec507af6c139478c34cd64010a`，其中最终实施边界暂为
`b768089585d710255d61a693c2489ccf425f446f`。零上下文运行时复审在
`packages/daemon/src/tier1/executor.ts` 的 `realAgentSpawner` 发现：

- `createInterface({ input: child.stdout })` 会把 input 的 `error` 再次 emit 到
  `readline.Interface`；
- 当前只有 `child.stdout.on("error", ...)`，没有 `rl.on("error", ...)`；
- Node 22.23.1 最小复现中，即使源 `PassThrough` 已有 error listener，给源流 emit 一个
  `ECONNRESET` 仍会触发 Interface 的未监听 `error`，进入 `uncaughtException` 并以非零退出。

因此 F107“收口期预期 pipe reset 不得越界成为进程级异常；活动期错误仍 fail-closed”的合同尚未闭环。

## 2. 实施范围

- 只修改 `realAgentSpawner` 的 readline/pipe error 处理及其直接测试；若测试证明必需才触及同文件相邻
  辅助函数。
- 为 `readline.Interface` 明确监听 `error`，复用现有 stdout pipe 的统一判定，不得静默吞活动期错误。
- 同一个底层 stdout error 可能同时到达 source stream 与 Interface；处理必须幂等，不能重复追加诊断、
  重复 finish 或改变退出结果。
- 收口期仅忽略 `shouldIgnoreTerminatingPipeError` 已登记的预期错误；其他错误仍留下有界诊断并失败。
- 不改 F108 signal 逻辑、发布版本、文档、workflow 或证据；不 commit。

## 3. 验收标准

1. 新增真实 `createInterface` 路径的回归，不以手工直接调用 handler 冒充：
   - 已进入权威结果/退出收口后，stdout `ECONNRESET` 同时经 source 与 Interface 传播，不出现
     uncaught/unhandled，不重复诊断，最终合同保持成功；
   - 活动期 stdout 非预期错误经两层传播时只形成一次有界诊断并 exit 1；
   - 活动期 `ECONNRESET` 也不得被吞，仍 exit 1。
2. `pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts --reporter=dot` exit 0。
3. `pnpm --filter @saydo/daemon typecheck` exit 0。
4. 运行与改动必须保持工作树内其他用户文件不变；最终报告真实文件、命令和输出摘要。

## 4. 交付

直接实施并跑第 2、3 项门禁，不提交、不推送、不部署。若发现现有测试夹具无法真实制造 Interface 转发，
先构造最小可判定夹具再修；不得仅在测试里注册空 listener 掩盖生产缺陷。
