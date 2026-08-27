# RC4 运行时最终 sweep 首轮红灯返工单

## 1. 输入与事实边界

继续使用原实施会话和当前未提交工作树。先完整重读当前最新版
`prompts/100-rc4-runtime-review-redlights-implementation.md`，尤其是上一轮启动后才追加的第 140--153 行。
不得以此前自报 A--G 完成为依据；以下是宿主只读核对与独立评审的最终残差。

上一轮日志真实结束于 `stopReason=end_turn`，模型为 `grok-4.6-build`，但门禁仍红：

- CLI supervisor：15/16，真实 birth 探针在 Grok workspace sandbox 内不可用；
- runtime-child/BYOA：163/170，6 红、1 Windows-only skip，同因 sandbox 内 birth 不可用；
- Tier1：25/113，88 红。首批真实 child 因 birth/permit 失败后，长串用例停在 reserved/timeout；
- daemon、CLI、platform typecheck 最终均为 0；
- `git diff --check` 仍因三个测试文件 EOF 多空行返回 2。

Grok sandbox 的 `ps`/birth EPERM 不是产品失败证据，也不是可以弱化 ownership identity 的理由。不得为让 sandbox
变绿而绕过 birth、permit 或 owner 校验。宿主稍后会在 sandbox 外重跑完整门禁；本轮应使用注入 hook 做确定性单测。

## 2. 尚未实施的必修合同

1. `packages/daemon/src/providers/byoa/runner.ts` 仍在 `child.stdin.on("error", () => {})` 无条件吞错。
   stdin 是承载 prompt 的业务 pipe，必须与 stdout/stderr 使用同一 durable `pipeFailure`：只有 terminating 窗口内
   ECONNRESET 可忽略；活动期 ECONNRESET 与任何阶段 EPIPE/EIO/unknown 都覆盖 exit 0，最终 `pipe_failed`、attempts=1、
   `retryable=false`，脱敏审计，不得进入 safety/network/schema/unknown 等第二次尝试。
2. `execRuntimeChild` 的 AbortSignal 当前只 `requestStop()`，没有锁存 aborted；pre-aborted 仍会先 spawn。
   修为 pre-aborted 零 spawn，active abort 即使目标捕获 TERM 后 exit 0 也 reject，同时仍 bounded drain/exact cleanup。
3. `runManagedCommand` timeout callback 仍只有 `handle.kill()`，没有 durable timeout reason。命令捕获 TERM 后 exit 0
   不能交付为成功；timeout 必须覆盖 exit 0，并与 shutdown/cancel 区分，typed lifecycle 仍优先传播。
4. `packages/daemon/src/api/recoveryOnlyServer.ts` 的 unsupervised restart 仍裸 await
   `closeAfterDrain("restart")`，没有一次性单调总 deadline、全局 contamination 与 registry/Job exact-empty 关卡。
   它必须与 normal composition root 使用同一 deadline/失败语义：超时或污染时 fatal/nonzero、不 stopped、不 spawn。
5. `packages/daemon/src/tier1/restartPolicy.ts` Windows 分支调用 Job-first `killOwnedTree` 后仍执行基于 PID 的
   `Date.now()` process-group loop。去掉这段 Windows PID 二次判定；Windows Job active count 是权威，避免 PID reuse
   误超时/误杀。owner 缺 jobName、owner 内容 invalid 都不得降为 absent/already_exited；保留并 fail-closed。
6. normal 与 recovery-only 两个 composition root 都必须在 stopped/新代 spawn 前核对 runtime-child/BYOA/Tier1
   contamination 及当前 generation registry/Windows Jobs exact empty。测试 reset 只能是明确的 test hook，并在每个测试
   做隔离；生产路径不得自动清 contamination。补一个污染测试后再运行正常测试的隔离回归，避免 suite 顺序导致假红。
7. 修复 `git diff --check` 指出的三个 EOF 多空行：
   `packages/cli/test/supervisor.test.ts`、`packages/daemon/test/byoa.test.ts`、
   `packages/daemon/test/runtime-child-registry.test.ts`。

## 3. 必须补的确定性反例

- BYOA stdin：活动期 EPIPE 和 exit 后 close 前 EIO 均失败；terminating ECONNRESET 可成功；三者都断言 attempts 与审计。
- exec：pre-aborted 零 spawn；active abort + `trap TERM -> exit 0` 仍 reject，owner/registry exact clean。
- managed：timeout + 捕获 TERM 后 exit 0 仍失败；shutdown/cancel kill 不误标 timeout。
- recovery-only：冻结/回拨 wall clock且 drain 永不 settle，单调 hard deadline 触发 fatal、不 stopped、不 spawn；正常完成清 timer。
- Windows restart reaper：Job 已 exact empty 但 wrapper PID 被复用时不再做 PID loop；missing/invalid owner fail-closed。

## 4. 门禁与交付

先运行受 sandbox 限制不影响的 typecheck、确定性反例和 `git diff --check`。可以记录真实 birth 集成测试因 Grok sandbox
EPERM 而红，但不得把它写成通过；也不要重复耗时 12 分钟的整套 Tier1 来证明已知 sandbox 限制。宿主会在本轮后独立
跑完整套件。

不得 commit、push、deploy、改版本、发布文档或证据。最终逐项列出本返工单 1--7 的实际实现位置和真实门禁退出码。
