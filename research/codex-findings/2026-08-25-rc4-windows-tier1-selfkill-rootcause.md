# RC4 Windows Tier1 自杀链根因定位（Codex gpt-5.6-sol / max，零上下文只读）

- 日期：2026-08-25
- 触发：Windows 真机 `verify:distribution` 在 `:961`「同 HOME 不同端口 lock loser 误杀现役 Tier1 进程组」失败
- 结论已由 Windows 真机验证：修复后整条 `verify:distribution` exit 0
- 调用形态：`codex exec -s read-only -m gpt-5.6-sol --json`（本机 macOS，未做 Windows 真机复跑）

---

结论：**contender 没有直接杀现役 Job。真正的杀手是现役 daemon 自己。**

Windows synthetic `ChildProcess` 把健康进程的 `WAIT_TIMEOUT` 误解释成“运行超过 5 秒仍未退出”，发出 `error`；Tier1 executor 收到该错误后立即对现役 generation 执行 `TerminateJobObject`。contender 只是制造了约 15 秒等待，让这个 5 秒定时缺陷稳定暴露。

## 1. 确切调用链

这里不存在“contender 调用某函数杀现役实例”的直接调用边；实际是两条链并发交叉。

### contender 链：制造约 15 秒等待

`startContender`  
→ [verify-distribution.mjs:300](packages/cli/scripts/verify-distribution.mjs:300)  
→ CLI 先探测不同的空闲端口，得到 `available`：[cli.ts:12](packages/cli/src/cli.ts:12)  
→ `runOwned`：[cli.ts:37](packages/cli/src/cli.ts:37)  
→ fork contender daemon：[supervisor.ts:328](packages/cli/src/supervisor.ts:328)  
→ contender 竞争 HOME instance lock：[index.ts:258](packages/daemon/src/index.ts:258)  
→ 现役 owner 的 pid/birth 匹配，抛 `home_owned`：[index.ts:286](packages/daemon/src/index.ts:286)  
→ 发送 `fatal/home_owned` 后退出：[index.ts:312](packages/daemon/src/index.ts:312)  
→ supervisor 只终止自己 fork 的 loser daemon：[supervisor.ts:380](packages/cli/src/supervisor.ts:380)  
→ 对 `activeOtherPort` 调 `probeStartupRace`：[supervisor.ts:386](packages/cli/src/supervisor.ts:386)  
→ 空闲端口持续返回 `available`：[probe.ts:72](packages/cli/src/probe.ts:72)  
→ 每 50ms 重试至默认 15 秒 deadline：[supervisor.ts:223](packages/cli/src/supervisor.ts:223)、[supervisor.ts:239](packages/cli/src/supervisor.ts:239)。

只读 seam 的实际输出：

```json
{"outcome":{"kind":"available"},"elapsedMs":15000,"calls":301}
```

### 现役 Tier1 链：约 5 秒时主动杀自己的 Job

`realAgentSpawner.spawn`  
→ [executor.ts:293](packages/daemon/src/tier1/executor.ts:293)  
→ Windows native spawn 分支：[runtimeChildRegistry.ts:1600](packages/daemon/src/runtimeChildRegistry.ts:1600)  
→ `createSuspendedOwnedWindowsProcess`：[runtimeChildRegistry.ts:1620](packages/daemon/src/runtimeChildRegistry.ts:1620)  
→ `childFromOwnedWindows`：[runtimeChildRegistry.ts:1627](packages/daemon/src/runtimeChildRegistry.ts:1627)  
→ **spawn 时即固定** `waitDeadlineAt = now + 5000`：[runtimeChildRegistry.ts:1474](packages/daemon/src/runtimeChildRegistry.ts:1474)  
→ 每 20ms 调 `owned.waitForExit(0)`：[runtimeChildRegistry.ts:1476](packages/daemon/src/runtimeChildRegistry.ts:1476)  
→ `WaitForSingleObject(handle, 0)` 对仍在运行的进程返回 `WAIT_TIMEOUT`，本地映射为 `"timeout"`：[win32.ts:1218](packages/platform/src/win32.ts:1218)  
→ 5 秒后代码却进入 `finishUnknown`：[runtimeChildRegistry.ts:1493](packages/daemon/src/runtimeChildRegistry.ts:1493)  
→ `child.emit("error")`：[runtimeChildRegistry.ts:1482](packages/daemon/src/runtimeChildRegistry.ts:1482)  
→ `child.on("error", () => beginFinish(127))`：[executor.ts:491](packages/daemon/src/tier1/executor.ts:491)  
→ `beginFinish` 立即 `hardKill()`：[executor.ts:427](packages/daemon/src/tier1/executor.ts:427)、[executor.ts:433](packages/daemon/src/tier1/executor.ts:433)  
→ captured generation signal：[runtimeChildRegistry.ts:1819](packages/daemon/src/runtimeChildRegistry.ts:1819)  
→ Windows 分支：[runtimeChildRegistry.ts:647](packages/daemon/src/runtimeChildRegistry.ts:647)  
→ `terminateNamedJobHandle`：[process.ts:1071](packages/platform/src/process.ts:1071)  
→ **直接调用 `TerminateJobObject`**：[win32.ts:910](packages/platform/src/win32.ts:910)。

Microsoft 的定义也明确：零超时只检查当前状态，未 signaled 返回 `WAIT_TIMEOUT`；这不是错误。[WaitForSingleObject](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject)

`TerminateJobObject` 会终止 Job 内全部进程。[TerminateJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-terminatejobobject)

wrapper 在 resume 前已经被加入 Job：[runtimeChildRegistry.ts:1689](packages/daemon/src/runtimeChildRegistry.ts:1689)、[runtimeChildRegistry.ts:1776](packages/daemon/src/runtimeChildRegistry.ts:1776)。之后 wrapper 启动 agent，agent 再启动 fixture child：[runtimeChildRegistry.ts:525](packages/daemon/src/runtimeChildRegistry.ts:525)、[verify-distribution.mjs:538](packages/cli/scripts/verify-distribution.mjs:538)。Windows 默认将这些后代纳入同一 Job，因此父子一起死亡。[Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)

所以即使删除 contender，只要让该 Windows Tier1 长驻超过 5 秒，也会沿同一路径自杀。

## 2. 为什么 macOS 不触发

macOS 上 `nativeWindows === false`，走普通 Node `spawn`：[runtimeChildRegistry.ts:1628](packages/daemon/src/runtimeChildRegistry.ts:1628)。

该分支没有 `childFromOwnedWindows`，也没有从 spawn 开始计算的 5 秒 polling deadline。即使 contender 等待 15 秒，真实 `ChildProcess` 也不会凭空产生 `error`，所以不会进入 `beginFinish → hardKill`。

## 3. 最小修复

只修改 `childFromOwnedWindows` 的 wait 状态机即可：

- `waitForExit(0) === "timeout"` 表示进程仍存活，应持续轮询，不能应用任何“从 spawn 起算”的 deadline。
- `readExitCode() === "live"` 同理。
- 删除 `waitStartedAt/waitDeadlineAt` 对正常 `"timeout"`/`"live"` 的限制。
- 对真正的 `WAIT_FAILED/"unknown"`，若仍需有界重试，应从“首次异常结果”开始计时，而不是从进程启动开始。
- 保留 executor 已有的终止期 close deadline；它已经只在请求 kill 或收到 exit 后武装：[executor.ts:438](packages/daemon/src/tier1/executor.ts:438)、[executor.ts:481](packages/daemon/src/tier1/executor.ts:481)。

补一条回归测试：`waitForExit()` 持续返回 `"timeout"`，虚拟时间跨过 5 秒，断言零 `error`、零 `exit`、零 Job terminate；随后切换为 `"signaled"`/exit 0，才正常发出 `exit/close`。现有测试名写着 “unknown/timeout”，但 stub 实际只返回 `"unknown"`：[runtime-child-registry.test.ts:2729](packages/daemon/test/runtime-child-registry.test.ts:2729)、[runtime-child-registry.test.ts:2751](packages/daemon/test/runtime-child-registry.test.ts:2751)。

补充排除：这次不是 `KILL_ON_JOB_CLOSE`。Job handle 没有传给子进程，显式 `HANDLE_LIST` 只有三个 stdio client handle：[win32.ts:1842](packages/platform/src/win32.ts:1842)。也没有 `taskkill /T` 或 `CREATE_NEW_PROCESS_GROUP` 进入这条链；命名管道只负责 stdio/permit。实际第一条破坏性调用就是现役 daemon 自己的 `TerminateJobObject`。

本次未修改任何文件。行号对应当前未提交工作树；本机为 macOS，未做 Windows 真机复跑，但两条只读 seam 分别复现了 15 秒 contender 延迟，以及健康 `"timeout"` 被错误转成 `error`。