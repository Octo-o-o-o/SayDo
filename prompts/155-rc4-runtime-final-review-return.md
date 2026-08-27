# RC4 runtime 最终独立复审返工

继续当前 implementation session，只改当前 worktree，不 commit、不 push、不联网、不调用 subagent。当前 5 个 tracked 文件的实现被零上下文复审判定 No-Go；必须做根因修复并补主链测试，不能只改断言。

## P0：纯业务失败被错误改成 Promise rejection，Tier1 主链误污染 lifecycle

`realAgentSpawner().wait()` / managed wait 当前对普通 nonzero、pipe failure、取消后的正常 signal exit 也 reject `RuntimeInvocationError`。真实 `Tier1Executor` 的主要调用方只在 resolve 路径设置 `processGroupVerifiedExited`、执行 `settleAttempt` 和清理 owner；rejection 会进入 `finalizeFailure`，随后被“finalize without ESRCH”误判为 lifecycle 污染，跳过正常 failed/cancel_settled 和 owner 清理。恢复、shutdown 路径同样受影响。快速 nonzero 在调用方延迟取得 `wait()` 时还触发 `unhandledRejection`。

修复合同：

1. 纯业务失败且进程组已确认 gone 时，仍应 resolve 原 `AgentWaitResult` / managed `{exitCode, stdoutTail}`，让既有业务结算路径消费 nonzero、pipe/timedOut/cancel；`RuntimeInvocationError` 只作为“业务失败 + signal/unreaped/release lifecycle 失败”的聚合叶，不得单独把正常失败改成 lifecycle rejection。
2. 任一 signal failure、unreaped 或 release failure 时必须 reject，并按业务错误（若有）→ distinct signal failures → unreaped → distinct release 的顺序保真；同一对象按 identity 去重。
3. Promise 从创建时就不得产生未处理 rejection；调用方稍后调用 `wait()` 仍能收到同一 rejection。
4. 补真实 `Tier1Executor` 主链回归：普通 nonzero、pipe failure、运行中取消各自完成正确业务终态、`processGroupVerifiedExited=true`、owner/lease 清理且零 lifecycle contamination；业务+signal/unreaped 才污染并聚合。
5. managed 普通 nonzero 必须保留真实 `stdoutTail`，不能被 `String(err)` 的泛化文本替换。

## P1：hostile error graph 仍执行 getter/instanceof，且可覆盖真实 lifecycle 错误

当前直接读取 `leaf.message`、数组 `length/index`，并在 walker 外再次执行不受保护的 `instanceof Error` / `.message`；`settleWithLeaseRelease` 也对 release error 做不受保护的 `instanceof`。主机反例已证实：

- `Error.message` getter 会被调用并把动态敏感文本写入 AggregateError；throwing getter 直接逃逸。
- `AggregateError.errors` 的 index accessor 被执行，分类可假阴性。
- revoked Proxy 作为 work error + 真实 lifecycle release error 时，`getPrototypeOf` TypeError 覆盖后者，最终 `isProcessGroupLifecycleError=false`。
- `asProcessGroupLifecycleError(revokedProxy)` 与 `combineLifecycleFailureList([revokedProxy, lifecycle])` 直接抛 Proxy TypeError。

修复要求：

1. walker/normalizer/combiner 全链不得调用未知 getter、iterator、`toString`、custom inspect；数组 length/index 只读 own data descriptor，hole/accessor/Proxy trap/撤销/畸形均转稳定、不可变 sentinel。
2. 所有 `instanceof` / descriptor / WeakMap 操作都必须有稳定 fail-closed 边界；未知/撤销对象不得覆盖或删除已经存在的 lifecycle 叶。
3. AggregateError message 只能由已安全投影的内部字符串生成；不得在 walker 外重新读取原始叶 `.message`。返回的 leaves 也不能保留会在消费者读取时再次执行攻击 getter 的对象。
4. cycle、node/child budget、identity 去重和至少 256 层正常链仍成立；不安全图必须 `sawLifecycle=true` 且恰有稳定 sentinel。
5. 补上述四类真实反例测试，断言 getter/index/toString 调用次数为 0、攻击文本不出现、真实 release lifecycle 叶仍保留。

## P1：连续 distinct Job signal failures 被 first-wins 全局污染覆盖

`contaminateRuntimeChildLifecycle()` 当前返回全局 first-wins contamination，而不是当前错误；同一 PID 两次 `TerminateJobObject` 分别失败时，第二次仍映射成第一错误。修复为：全局/daemon contamination 可以 first-wins，但本次调用必须返回当前安全投影的错误，per-PID signal map 和 real-agent/managed 聚合必须保留每个 distinct failure。增加“同一 Job 两次不同 TerminateJobObject 失败”的用例，不能用 Job + fallback child.kill 代替。

## P1：POSIX/Windows signal 路径只允许明确 ESRCH 被当作 gone

`signalRuntimeChildTree()` 的 POSIX 分支当前 catch 全吞，Windows 非 Job 分支也把异常一概当 ESRCH/EINVAL。硬合同是“进程组未明确 ESRCH 时污染”：仅 own-data `code === "ESRCH"` 可忽略；EPERM、EINVAL、未知/throwing/revoked 错误都必须稳定投影为 lifecycle failure。增加可注入 process-kill hook，分别覆盖 ESRCH 绿、EPERM/未知/Proxy 红，并贯通 real-agent/managed 聚合。

## P2/P3：证据与测试时序

- 修复 managed stdout 证据丢失；普通失败 resolve 后调用方必须拿到真实 `stdoutTail`。
- 新增 managed 用例不能继续真实等待固定 5 秒。让 executor 使用可注入的 drain/close deadline 与 timer；相关测试使用虚拟/短门限，保持生产默认不变，移除 5.1 秒脆弱等待。

## 主机门禁

在本 worktree 运行并如实回报退出码/计数：

1. `pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts`
2. 新增 focused Tier1 主链、hostile graph、two Job failures、POSIX signal、unhandled rejection、managed stdout/短时序反例都必须绿。
3. `pnpm --filter @saydo/daemon typecheck`
4. `pnpm exec eslint packages/daemon/src/processGroupLifecycle.ts packages/daemon/src/runtimeChildRegistry.ts packages/daemon/src/tier1/executor.ts`
5. `git diff --check`

完整 daemon 测试由主会话在其他并行测试停止后隔离重跑；沙箱内 host process identity 假红不得写成产品失败，也不得把 teardown 并发污染写成通过。
