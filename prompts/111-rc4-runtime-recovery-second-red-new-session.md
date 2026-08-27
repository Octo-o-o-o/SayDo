# rc.4 recovery lifecycle 第二次红灯：新实施会话重做

你是全新的 Grok 实施会话，不得 resume 旧会话。工作区为本文件所在 worktree。

当前基线 commit：

`29c273b455558744d82bf03b6b4b3a921a853417 chore(runtime): 固化生命周期二次返工检查点`

先完整读取以下两个既有输入，再读当前实现和测试：

- `prompts/106-rc4-runtime-second-review-remediation.md`
- `prompts/109-rc4-runtime-host-gate-return.md`

这是同一 recovery 优先级条目第二次仍红；旧实施会话已按仓库规则弃用。不要读取旧 Grok 日志或自报，不要为旧设计辩护。保留已经通过的其余九项 P1/P2 修复，只重做这个失败边界及其必要公共抽象。

## 两次宿主真实失败

第一次定向集：`1 failed / 278 passed / 2 skipped`。

旧会话返工后，宿主再次独立运行：

```sh
pnpm --filter @saydo/daemon exec vitest run \
  test/recovery-only-process.test.ts \
  test/lifecycle-disposition.test.ts
```

结果仍为 `exit 1`：

```text
test/lifecycle-disposition.test.ts: 5 passed
test/recovery-only-process.test.ts: 1 failed / 6 passed

restart 后同步 signal：drain/close 各一次、spawn=0、signal 优先
expected reason=supervisor_stop
received reason=restart
packages/daemon/test/recovery-only-process.test.ts:382
```

当前 `afterClientGone(req.socket)` 在 server 端 socket close 后只让出两个 `setImmediate`；宿主反复证明，这个边界仍可能早于父进程收到 HTTP body 并立即发送 `SIGTERM`。因此“再多让出一轮事件循环”不是可判定合同。

## 必须重做的合同

1. `/api/setup/restart` 返回 200 后，调用方紧接着发送的 `SIGINT`/`SIGTERM`、supervisor disconnect 或 fatal 必须能在不可逆动作前覆盖 restart。优先级固定为 fatal > signal/supervisor stop > restart。
2. 明确定义一个可测试的 restart override grace 边界，或实现等价的确定性握手。若使用 grace：
   - 它必须是命名常量/可注入调度器控制的产品合同，不是测试中的碰运气 sleep；
   - 使用单调时钟/定时器；时钟冻结或回拨不得无限延长；
   - 纳入原有单一 shutdown 总截止；
   - grace 内 signal/fatal 可升级，freeze 后不可改，并有精确边界测试。
3. drain、server close、audit、DB close、sendFrame、spawn/exit 仍共享唯一 lifecycle Promise，各自最多一次。
4. signal 胜出：唯一 audit `reason=supervisor_stop`，stopped，exit 0，spawn=0。fatal 胜出：fatal，exit 1，spawn=0。restart 胜出：只在 freeze 后 audit/release lock/spawn。
5. real-process 集成测试必须稳定证明“await restart HTTP response 后立即 kill(SIGTERM)”；可重复多轮验证，但不得在测试中加入 sleep 来制造通过。
6. 检查主 daemon `packages/daemon/src/index.ts` 对同一 disposition 抽象的使用，不能为修 recovery 引入主 daemon 双重 drain、重复 audit、双 spawn 或额外 wall-clock deadline。
7. 不删除/弱化现有测试，不修改发布、文档、证据或版本，不提交、不推送、不发布、不部署。

## 验收门禁

按顺序真实运行，失败就继续修，不得只报告自测意图：

```sh
pnpm --filter @saydo/daemon exec vitest run \
  test/recovery-only-process.test.ts \
  test/lifecycle-disposition.test.ts

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
  test/recovery-only-process.test.ts \
  test/lifecycle-disposition.test.ts

pnpm --filter @saydo/daemon typecheck
pnpm --filter @saydo/cli test
pnpm --filter @saydo/cli typecheck
pnpm --filter @saydo/platform test
pnpm --filter @saydo/platform typecheck
bash scripts/check-emoji.sh
git diff --check
```

交付时只陈述改动、真实命令与真实退出码；实施会话自报不构成最终验收。
