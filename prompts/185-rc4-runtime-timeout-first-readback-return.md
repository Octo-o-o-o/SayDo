# RC4 runtime 新会话第一次 readback 返工

继续当前 fresh 实施会话 `01a03177-ea3a-7262-b246-3d0299c2004e`，只在本文件所在 worktree 施工。不要读取 `logs/`、旧 review/report 或其他实施会话解释；不要提交、推送、联网或触碰用户原始 dirty worktree。以 `prompts/181-rc4-runtime-second-red-new-session-timeout-regression.md`、`prompts/182-rc4-runtime-timeout-host-diagnosis-correction.md` 和当前代码为输入。宿主常规门禁已绿，但第一次零上下文 hostile readback 稳定复现以下四个 P1；全部关闭并补不能由产品常量自证的回归。

## P1-1：错误图的总预算必须覆盖所有入口与原型步

当前 `protoExists` / `protoChainHasProxy` 的原型链遍历不计入 `MAX_GRAPH_NODES=512`，`mergeWalkedLeaves` 又给每个顶层 input 重建预算。稳定反例：

```text
deep ordinary prototype chain: getPrototypeOfCalls=12018, leaves=[deep-proto]
combine 10000 top-level errors: aggregateErrors=10000
```

- 一次 `projectUnknownFailure` / `walkErrorGraph` / `combineLifecycleFailureList` / `combineLifecycleFailures` 必须共享同一个不可重置预算，至少统一计数：访问节点、child slot、原型步、顶层 input 与输出 leaf。
- `safeInstanceof`、native brand 前置原型检查、`protoChainHasProxy` 也必须消费这份预算；不能在预算外走任意深链。
- 超预算只追加一次稳定 sentinel；预算范围内的 identity、cycle、first-seen 顺序保持；输出叶数量也有硬上限。
- hostile 回归必须独立计数 trap/getPrototypeOf：12k 深链的总探测不超过合同上限附近；10k 顶层 input 的最终 leaves 不超过上限+单 sentinel，不能返回 10k AggregateError children。

## P1-2：业务 + 多个 signal + 未退出必须保留最后一叶

`runtimeChildRegistry.ts` 当前 drain catch 在已有 latched/signal 时把最终 `err` 替换掉。真实形状为业务 pipe EIO、3 个 distinct signal failure、随后 `runtime child process group did not exit:<pid>`；当前只剩前四叶。

- 组合完整 `[latchedBusinessFailure, signalFailure, finalDrainError]`，再按 canonical origin identity 去重；不得因 `isProcessGroupLifecycleError(err)` 分支丢最后一叶。
- 精确顺序：业务 first-seen → 每个 distinct signal first-seen → 最终未退出；同 identity 重复一次。
- 增加真实 fake-child listener 回归，断言五叶 exact message/identity/order；普通单错、work undefined/null、close deadline、timeout/cancel 不回归。

## P1-3：进程 probe/kill/restart 统一只读 own-data errno

仍有直接 `(err as NodeJS.ErrnoException).code`：

- `packages/daemon/src/runtimeChildRegistry.ts` 的 POSIX/Windows process state；
- `packages/platform/src/process.ts` 的 `processAlive` / group / kill；
- `packages/daemon/src/tier1/restartPolicy.ts` 的 group probe/reap kill。

稳定反例包括：继承来的 `ESRCH` 被当成功回收并删除 durable owner；non-revoked Proxy 触发 get trap；revoked Proxy 逃逸为 `TypeError` 或原对象。

- 在无循环依赖的最低公共层提供一个 canonical trap-free own-data errno reader；daemon/runtime/restart/platform 全部复用，禁止复制不同语义。
- reader 先拒 Proxy/revoked/accessor，再用 own property descriptor；继承 code 一律不算。仅 own-data `ESRCH` 可忽略；own-data `EPERM` 只在“存在性探测”语义视为 alive，在 kill/reap 语义必须失败并保留 owner、污染 lifecycle。
- 其它 unknown 不得原样跨边界泄漏；投影为受控类别，同时保留 durable owner/barrier，不能审计 `reaped`。
- 增加 inherited/proxied/revoked/accessor/primitive hostile：traps=0；owner 删除=0；错误投影无 SECRET；后续 spawn 被 barrier 拒。platform 自测也必须覆盖，不只 daemon hook。

## P1-4：Tier1/Windows 相邻 catch 不得 `instanceof`/`String(cause)`

至少清扫并回归：

- `Tier1CostLedgerError` 构造中的 `String(cause)`；
- review settlement stage 与 finalize transaction 中对 unknown 的 `instanceof`；
- `packages/platform/src/win32.ts` 的 bind catch；
- `packages/platform/src/process.ts` Windows Job query/terminate/missing catch 的 `instanceof` / `.message` / `String(err)`。

稳定 hostile：普通 Proxy 的 `getPrototypeOf`/string conversion trap 会执行；revoked Proxy 抛 `TypeError`；原始 `Error("SECRET")` 进入受控错误文本。

- 内部自有错误类型用不可伪造的内部品牌（如模块私有 WeakSet/显式控制流）判别，不能对不可信 unknown 做 `instanceof`。
- 未知 cause 不读 `.message`、不调用 `String`、不拼进日志/stack/final message；只使用稳定受控类别。内部已知字段可通过品牌后读取。
- revoked 与计数型 non-revoked Proxy 回归：所有 trap=0，SECRET 在日志/message/stack/审计均为 0；Windows Job rollback/owner/handle 语义不回归。

## 不变量

- 不得放宽 POSIX kill 的 EPERM/Proxy barrier，不得恢复原始 pipe message，不得减少 distinct signal/pipe identity。
- timeout 测试继续只用 fake `killProcess`，绝不碰宿主真实 PID/PGID；TERM 后 exit 0 仍失败，EPERM 不得伪装 blocked。
- shared lifecycle contamination first-wins、birth/Job ownership、restart/cancel/close deadline 与普通 nullish settle保持。

## 必跑门禁

至少运行并如实报告：新增四组 hostile 回归；`process-group-lifecycle`、`runtime-child-registry`、`tier1-executor`、`byoa` 四文件；`packages/platform` 全量；daemon 全量；daemon/platform typecheck；根 lint；`bash scripts/check-emoji.sh`；`git diff --check`。Grok sandbox 若拒绝真实 `/bin/ps`，明确交给宿主复核，不能编绿。完成后逐项给出 P1 的代码、测试、真实命令摘要；不要提交。
