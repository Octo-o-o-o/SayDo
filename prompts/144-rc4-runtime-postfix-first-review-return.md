# RC4 runtime fresh-session 第一次独立复审退回

继续 resume 同一 Grok 实施会话
`01a02f72-54aa-7660-883f-212c8ae549c6`，工作区为本文件所在 worktree。

当前提交 `77d6cb417cfe577101ae401d079b2e84e5454c7c` 是 prompt 127 新实施会话的交付；本次
是该 fresh session 的第一次零上下文独立复审红灯，按仓库规则退回同一会话。不得读取 reviewer
临时 clone 或其实现细节；以下复现事实是唯一 review 输入。只改当前 7 个 tracked runtime/test
文件，禁止 commit、push、release、deploy、联网或改发布/mobile/docs。

## P1-1：错误图遍历必须全局有界、迭代器不可卡死、深层仍 fail-closed

当前 `processGroupLifecycle.ts` 的递归只按 depth 计数，并对 `AggregateError.errors` 使用
`for...of`。独立 reviewer 的两个真实反例：

- 把 `errors` 数组的 iterator 替换为无限 iterator 后，
  `isProcessGroupLifecycleError` 与 `lifecycleFailureLeaves` 都被 `gtimeout 2s` 杀死，exit 124。
- 66 层 `AggregateError` 包裹一个 lifecycle leaf 时，分类为 false，扁平叶只剩深度边界外层
  `AggregateError`。

重做为统一的、非递归或栈安全的 error-graph walker：

1. 不调用不可信 `Symbol.iterator`，对真正 Array 只按有界 numeric index 读取；`errors` getter、
   `length`/index Proxy trap、revoked Proxy、稀疏/自引用/nested cycle 均不得抛出或挂住。
2. 预算必须限制“总访问节点数 + 总 child slot 数”，不是每个递归分支自己的 depth。选择足够覆盖
   正常深层（至少 256 层）的明确常量；任何超预算/无法安全枚举的 error graph 必须保守分类为
   lifecycle contamination，不能降格普通业务错误。
3. `lifecycleFailureLeaves` 必须在同一预算内确定性结束、identity 去重、保持可到达的真实叶；
   遇到超预算/畸形图时加入一个稳定的 `ProcessGroupLifecycleError` 哨兵叶，而不是静默丢失或把
   外层普通 AggregateError 当唯一业务叶。
4. `combineLifecycleFailures`/`settleWithLeaseRelease` 继续保持不同 work/release 错误的顺序、身份
   与单次出现；不得因 fail-closed 哨兵把真实业务叶丢掉。
5. 正式测试必须包含：无限 iterator（并证明 iterator 未被调用/函数同步有界返回）、66/256 层
   lifecycle leaf、超过预算、self/nested cycle、errors getter/index/length/iterator Proxy、普通深层
   aggregate。测试自身不能用会让 Vitest 挂死的无上限等待；用调用计数/可判定 trap 直接证明。

## P1-2：Tier1 signal failure 不得覆盖已经知道的业务失败

独立 reviewer 在 real-agent 与 managed command 路径分别注入业务失败和 Windows
`TerminateJobObject` signal-path 失败；最终 leaves 都只剩
`TerminateJobObject failed in signal path`，原错误 result/exit/pipe 身份丢失。两条路径虽正确
污染 lifecycle、保留 job/owner、阻断下一 spawn，却违反双错保真合同。

修复要求：

1. `realAgentSpawner` 与 `runManagedCommand` 的 `signalTree` 不得在 signal 异常瞬间把 invocation
   直接置 settled 并只 reject lifecycle。signal failure 应进入 invocation-local、identity-deduped
   latch；timer/事件回调内不产生 unhandled rejection，仍按有界 drain/close 收集已知业务终态。
2. settle 时构造精确组合：
   - 已知 nonzero exit/result error + signal failure：保留 exit code、termination cause、原错误
     message/对象（若已有 Error）和唯一 signal lifecycle leaf；
   - pipe EIO/stdio failure + signal failure：保留 pipe 错误 identity/code/stream 或现有结构化字段；
   - timeout/abort/overflow + signal failure：保留相应业务 cause/字段；
   - 原工作成功 + signal failure：只需 lifecycle reject，但不得假成功；
   - 后续 lease release 另失败：作为第三个不同叶保留，同一 signal 对象仍只出现一次。
3. 如果当前 API 用 resolved `AgentWaitResult` / `{exitCode}` 表示业务失败，新增最小的 typed/structured
   Error 投影来承载原结果字段，再与 signal error 聚合；不得只拼接 message。调用方仍必须能把
   整体识别为 lifecycle，且 task/run 不得写 `blocked`、`done`、`ready_for_review` 等普通终态。
4. signal 异常后的 fallback `child.kill`、drain deadline、Job/owner 保留、shared contamination 与
   next-spawn barrier 不得回退。若 signal error 导致无法证明 exact-gone，不得为等待业务结果而
   无限延迟，仍由唯一现有 deadline 收口。
5. 正式定向测试至少覆盖：
   - real-agent error result/nonzero + signal failure；
   - real-agent pipe failure + signal failure；
   - managed nonzero、timeout、pipe EIO 各自 + signal failure；
   - work success + signal failure；
   - work + signal + distinct release failure 三错。
   对每例断言 `lifecycleFailureLeaves` exact leaf set/关键字段与 identity 去重、lifecycle=true、无
   unhandled rejection、job/owner 保留、下一 spawn 被 barrier 拒；清理后 registry roots 为 0。

## 门禁

先跑新增直接反例，再真实运行并报告退出码/计数：

```sh
pnpm --filter @saydo/daemon exec vitest run \
  test/process-group-lifecycle.test.ts \
  test/runtime-child-registry.test.ts \
  --pool=forks --maxWorkers=1 --minWorkers=1

pnpm --filter @saydo/daemon exec vitest run \
  test/tier1-executor.test.ts \
  -t '双错|三错|signal|release 失败' \
  --pool=forks --maxWorkers=1 --minWorkers=1

pnpm --filter @saydo/daemon typecheck
pnpm lint
bash scripts/check-emoji.sh
git diff --check 77d6cb417cfe577101ae401d079b2e84e5454c7c --
```

不要在 Grok workspace sandbox 跑完整 daemon suite；宿主会在无 sandbox 环境复跑 focused 与
full suite。最终只列 exact changed files、两项合同映射、真实命令摘要/退出码和残余风险；不要提交。
