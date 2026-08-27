# RC4 runtime 第二轮独立 readback 前的验收自校正

继续 resume 当前实施会话。上一轮已经完成大部分修复并跑绿门禁，但在正式第二轮独立 readback 前仍有三处明确不满足原验收单。只修下面项目；不要提交、推送、打 tag 或发布，不读取 `logs/**`、`prompts/**`、`research/**`。

## 1. 删除生产入口的 ambient global test switch

当前 `daemonStartupHooks.ts` 仍读取 `globalThis.__SAYDO_TEST_DAEMON_HOOKS__`。这只是把环境变量 test switch 换成 ambient global，生产入口仍会被任意 preload 改变语义，不满足“显式 composition/dependency injection”。

要求：

- 删除生产代码对任何 `globalThis.__SAYDO*`、`SAYDO_TEST_*`、hostile ambient key 的读取。
- 保留模块局部、显式的 `setDaemonStartupHooks`/composition seam 即可；测试 child process 必须先 `--import` tsx loader，再 `--import` fixture，fixture 显式 import 该 composition 模块并调用 setter。生产默认 wiring 无 test hook。
- 将 `importBeforeTsx` 更名或重构成真实顺序语义，不能再靠“fixture 先写 global、tsx 后加载入口”。
- close-durables 与 recover-hold 仍必须真实进入同一个 `src/index.ts` production composition。

## 2. recover-during-shutdown 测试必须证明没有继续 recover

当前真实入口测试在 shutdown 后立即 release hold，最终只断言 `code` 有定义、看到 hold frame 和零 SECRET；这不能证明 `tier1Executor.recover()` 未继续，也没有断言正确退出状态。

要求：

- 给显式 composition hook 增加窄的 `beforeRecover`/`onRecoverAttempt` 观测点，位置必须紧贴真实 `tier1Executor.recover()` 调用前；生产默认 no-op。
- fixture 在 recover 真正尝试前发送独立 frame/写独立 marker。测试先确认 daemon 已经进入真实 hold，再发送 shutdown、release hold，随后断言 recovery-attempt frame/marker 为零、没有新 runtime/Tier1 owner、在期限内退出。
- 对该正常 supervisor shutdown 断言精确 exit code 和 supervisor frame：应为受控 `stopped`/0；若 canonical 明确要求 fatal，则按 canonical 给出对应精确非零/fatal，不能只 `toBeDefined()`。
- 用例必须走真实 `src/index.ts` 和共享 production composition，不复制 lifecycle helper。

## 3. 恢复精确 failure-leaf 合同，禁止弱化断言

本轮多处把旧的精确数组/长度断言改成 `toBeGreaterThanOrEqual(1)`、`some/includes`。删除裸 PID fallback 后，正确做法是更新成新的精确叶集合和顺序，而不是把断言放宽。

要求：

- Tier1、managed、runtime registry 的 pipe/business + TERM/KILL Job failure + unreaped 用例恢复精确 leaf 数量、类型、消息、顺序与 identity 去重断言。
- 不再期待任何 `fallback SIGKILL failed` 叶；同时必须精确证明它不存在。
- 需要证明 TERM 与 KILL 两次精确 Job 操作的 distinct failure 时，让 hook 按调用次序返回两个不同的受控 branded error，断言两个对象/消息都保真且顺序稳定；同一 failure identity 重复出现时断言 canonical 去重为一叶。
- 不得使用 `at least`、模糊 `some/includes` 代替原先的结构门禁，不得删除测试或放宽断言换绿。

## 同步复核

- `tier1GateServer.failed` 的生产消费不得为空 handler；`fatalShutdown` 自身的 late rejection 必须被消费，零 unhandled rejection。
- 删除已被真实 composition 测试替代且没有独立价值的重复 fixture；若保留函数级 harness，名称与 describe 必须明确不能证明生产入口。

## 必跑门禁

依次执行：

1. 受影响的 startup-failure、gate、runtime-child-registry、Tier1 executor、BYOA 精确用例。
2. `pnpm --filter @saydo/platform test`
3. `pnpm --filter @saydo/cli test`
4. daemon RC4 精确 8 文件。
5. `pnpm --filter @saydo/daemon test`（单独运行，不与其它门禁并发）。
6. `pnpm typecheck`
7. `pnpm lint`
8. `bash scripts/check-emoji.sh`
9. `git diff --check`

最后报告真实 exit code/计数、三个自校正项目的 file:line 映射与 `git status --short`；保持未提交，等待正式第二轮独立 readback。
