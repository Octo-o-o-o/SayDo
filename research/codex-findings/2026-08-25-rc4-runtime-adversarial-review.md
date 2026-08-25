# RC4 runtime 线对抗评审（Codex gpt-5.6-sol / max，零上下文只读）

- 日期：2026-08-25
- 评审范围：`git diff main...HEAD`（`codex/rc4-runtime-final-reimplementation-20260824`，HEAD `1d632cc`）
- 结论：**不建议发布**，6 个 A 级、8 个 B 级
- 调用形态：`codex exec -s read-only -m gpt-5.6-sol --json`
- 说明：prompt 中主动要求它质疑本会话两处核心修复，并点名两个作者自己没把握的方向
  （取消 deadline 后是否存在无法收口的挂起、attach 论证的前提是否成立）——两处均被证实有问题。

---

结论：不建议发布。基于 `main 8602c732...` 到当前 `HEAD 1d632cc0...`，发现 6 个 A 级、8 个 B 级问题。

## A 级：发布前必须修

1. **退出码 259 会把已退出进程永久判成存活**

   - **file:line**：[runtimeChildRegistry.ts:1527](packages/daemon/src/runtimeChildRegistry.ts:1527)、[win32.ts:1226](packages/platform/src/win32.ts:1226)、[win32.ts:1003](packages/platform/src/win32.ts:1003)
   - **失效场景**：Windows 目标或 wrapper 真实以 `259` 退出。`WaitForSingleObject` 已返回 `signaled`，但 `GetExitCodeProcess` 的 259 被无条件映射为 `"live"`；状态机清空异常计时并每 20ms 永久续期。
   - **错误结果**：永远没有 `exit/close`，lease、process HANDLE、Job 和 owner 记录无法正常释放；reaper 同样会把退出码 259 的 leader 当成活进程而拒绝清理。
   - Microsoft 明确警告：若进程把 `STILL_ACTIVE` 作为实际退出码，按 259 判活会造成无限循环。[GetExitCodeProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getexitcodeprocess)、[WaitForSingleObject](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject)

2. **wait/exit authority probe 抛异常时直接打崩 daemon**

   - **file:line**：[runtimeChildRegistry.ts:1483](packages/daemon/src/runtimeChildRegistry.ts:1483)、[runtimeChildRegistry.ts:1527](packages/daemon/src/runtimeChildRegistry.ts:1527)、[win32.ts:2015](packages/platform/src/win32.ts:2015)
   - **失效场景**：`waitForExit()` 或 `readExitCode()` 因 Koffi/native 异常抛出；平台层甚至为这两处定义了 `"wait-process"`、`"exit-code"` fault seam。
   - **错误结果**：异常从 microtask/timer 回调成为未捕获异常。daemon 没有总兜底，因此进程直接退出；不会 contamination、不会 child error/close、不会走 lease、审计和 HANDLE 收口。

3. **`SpawnRollbackRetainedError` 被调用方丢弃，可能留下未登记的 suspended child**

   - **file:line**：[win32.ts:1708](packages/platform/src/win32.ts:1708)、[win32.ts:1770](packages/platform/src/win32.ts:1770)、[runtimeChildRegistry.ts:1644](packages/daemon/src/runtimeChildRegistry.ts:1644)、[runtimeChildRegistry.ts:1698](packages/daemon/src/runtimeChildRegistry.ts:1698)
   - **失效场景**：`CreateProcessW` 成功后在 `wrap-stdio` 等点失败；rollback 的 `TerminateProcess`/wait/exit 证明又失败，于是平台抛出携带 pid 和 process HANDLE 的 `SpawnRollbackRetainedError`。
   - **错误结果**：daemon catch 只关闭 permit 和尚为空的 SayDo Job，然后原样重抛；它不读取 retained pid/HANDLE，也没有 durable owner。该 suspended 进程及 HANDLE 因而完全失联。进程此时尚未执行后面的 `AssignProcessToJobObject`，关闭空 Job 不会杀它；Job 只作用于已关联进程。[Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)

4. **`home_owned` 分支没有证明 loser daemon 已退出**

   - **file:line**：[supervisor.ts:244](packages/cli/src/supervisor.ts:244)、[supervisor.ts:380](packages/cli/src/supervisor.ts:380)、[supervisor.ts:388](packages/cli/src/supervisor.ts:388)
   - **失效场景**：loser 发出 `fatal/home_owned` 后被暂停，或 `child.kill("SIGKILL")` 返回 false；2 秒后 `waitForChildExit` 无条件返回，分支不复核 `exitCode/signalCode`，随即探到同端口 owner 并输出 `mode:"attached"`。
   - **错误结果**：loser child/IPC 仍存活；attached CLI 收到退出信号后可能因 child handle 不退出，强退 supervisor 后还可能留下孤儿。对照 `emergencyStop` 已有“2 秒后仍活即失败”的复核，这里缺失。
   - “探到的服务属于他人”仍成立；不成立的是“loser 已收口”。

5. **新的 `runtime/owner.lock` 与 ownership 目录可跟随 junction，且没有 Windows ACL 回读**

   - **file:line**：[homeLock.ts:80](packages/platform/src/homeLock.ts:80)、[homeLock.ts:98](packages/platform/src/homeLock.ts:98)、[runtimeChildRegistry.ts:917](packages/daemon/src/runtimeChildRegistry.ts:917)
   - **失效场景**：合法 `SAYDO_HOME` 下预置 `runtime` junction，指向外部可写 NTFS 目录。`ensureStateRoot` 只验证状态根本身；`mkdirSync/openSync/LockFileEx` 和 `runtime/children` 都跟随该 junction。
   - **错误结果**：`owner.lock` 和 durable ownership 记录落到信任边界外，控制目标目录的进程可抢锁、替换记录或制造错误 CAS/reap。Windows 的 `mode:0o600/700` 也没有替代 `restrictOwnerOnly` 和 DACL readback。
   - 直接违反 [ADR-004:54](docs/adr/design/ADR-004-windows-platform.md:54) 与 [ADR-004:75](docs/adr/design/ADR-004-windows-platform.md:75) 的锁文件 owner-only P0 条款。

6. **Windows 单测门没有成立，却能由 happy-path distribution 给出绿灯**

   - **file:line**：[ci.yml:13](.github/workflows/ci.yml:13)、[ci.yml:75](.github/workflows/ci.yml:75)、[ADR-004:79](docs/adr/design/ADR-004-windows-platform.md:79)、[ADR-003:174](docs/adr/ADR-003-os-adapters.md:174)
   - **失效场景**：按题设现场事实，Windows daemon 单测在加载期失败；CI 的 `pnpm test` 只在 Ubuntu 运行，Windows 只跑 `verify:distribution`。
   - **错误结果**：退出码 259、wait/exit throw、post-spawn rollback、permit abort/timeout、leader-dead Job recovery、ACL/junction 等回归均可在 CI 维持绿色。现有 fault test [process.test.ts:1272](packages/platform/test/process.test.ts:1272) 只覆盖到 `resume-thread`，定义出来的 `terminate-process/wait-process/exit-code/close-handle` 四个故障点没有测试。
   - GitHub Windows matrix本身在 ADR 中是 P1；A 级冲突来自“Windows P0 单测必须绿”与“平台分支必须在目标 OS 跑门”没有兑现。

## B 级：可登记为已知限制

1. **一次 transient `unknown` 会永久污染全局，所谓恢复只清 timer**

   - **file:line**：[runtimeChildRegistry.ts:1485](packages/daemon/src/runtimeChildRegistry.ts:1485)、[runtimeChildRegistry.ts:1518](packages/daemon/src/runtimeChildRegistry.ts:1518)、[runtimeChildRegistry.ts:1840](packages/daemon/src/runtimeChildRegistry.ts:1840)
   - **失效场景**：`unknown → timeout → signaled/exit 0`。
   - **错误结果**：child 最终发出成功 `exit:0`，但首次 unknown 已永久 contamination；后续所有 runtime spawn 都被拒绝到 daemon 重启。“有界重试”只延迟 child error，并没有提供可恢复窗口。
   - `unknown—正常—unknown` 会重置异常计时，这是连续异常窗口的合理语义；没有另一个独立的无限延长缺陷，真正的问题是首次 unknown 已经不可逆污染。

2. **同 HOME 不同端口固定空等约 15 秒，并延迟信号响应**

   - **file:line**：[supervisor.ts:223](packages/cli/src/supervisor.ts:223)、[supervisor.ts:388](packages/cli/src/supervisor.ts:388)
   - **失效场景**：owner 在端口 A，contender 指定同 HOME 的空闲端口 B。B 持续返回 `available`，直到 15 秒 deadline。
   - **错误结果**：本可立即报告的 `home_owned` 被延迟约 15 秒；这段等待没有与 `pendingSignal` race，Ctrl+C 也要等探测结束。反向地，合法 owner 持锁但启动超过 15 秒、尚未超过自身 30 秒启动门时，同端口 contender 会过早失败。
   - distribution 只断言最终非零与 owner 存活，没有延迟断言。

3. **任何首帧前退出都可能被误报为 `home_owned`**

   - **file:line**：[supervisor.ts:361](packages/cli/src/supervisor.ts:361)、[index.ts:237](packages/daemon/src/index.ts:237)
   - **失效场景**：Windows Koffi 缺失、ABI/bind 失败或 unsupported arch，使 daemon 在取得 HOME 锁和发送 fatal frame前退出。
   - **错误结果**：`homeLockAllowsReap === false` 被直接解释成可信 `home_owned`，用户得到“已有实例占用”而非 native startup failure，真实故障被掩盖。

4. **`CreateProcessW` 环境块未按 Windows 要求排序**

   - **file:line**：[win32.ts:1308](packages/platform/src/win32.ts:1308)、[runtimeChildRegistry.ts:1624](packages/daemon/src/runtimeChildRegistry.ts:1624)
   - **失效场景**：传入 `{Z:"1", A:"2"}`，或在继承环境尾部追加 `SAYDO_PERMIT_PIPE`；生成顺序保持插入序，而不是 Windows 要求的 case-insensitive Unicode 名称排序。
   - **错误结果**：`CreateProcessW` 收到不符合合同的环境块；极端情况下 wrapper 无法可靠取得 permit 变量并以 125 退出。微软要求环境块按变量名排序。[Changing Environment Variables](https://learn.microsoft.com/en-us/windows/win32/procthread/changing-environment-variables)

5. **生产 wrapper 无条件向固定 `%TEMP%` 文件同步追加调试日志**

   - **file:line**：[runtimeChildRegistry.ts:379](packages/daemon/src/runtimeChildRegistry.ts:379)、[runtimeChildRegistry.ts:546](packages/daemon/src/runtimeChildRegistry.ts:546)
   - **失效场景**：任一 Windows managed child 输出数据。
   - **错误结果**：每个 stdout/stderr chunk 都同步 append 到固定 `saydo-wrapper-permit.txt`；没有 debug 开关、轮转或清理，并在 SAYDO_HOME/logger 之外遗留 fd 与 permit pipe 名称。长期任务会持续增长文件并增加同步 I/O。

6. **Windows stdout flush 没有自身 liveness 截止**

   - **file:line**：[runtimeChildRegistry.ts:447](packages/daemon/src/runtimeChildRegistry.ts:447)
   - **失效场景**：目标成功退出 0，但父端仍持有管道且停止完成读取，`writableLength/writeQueueSize` 始终非零。
   - **错误结果**：wrapper 在 `setTimeout(wait, 0)` 中永久轮询且不退出；上层最终只能按命令 wall timeout 或 `close withheld` 杀 Job，把成功目标报告成失败。

7. **多条新增测试具有假杀伤力**

   - **file:line**：
     - [supervisor.test.ts:58](packages/cli/test/supervisor.test.ts:58)：所谓 reap no-op 没有 owner 记录或可杀进程；删掉生产早退、始终调用 reaper 仍可通过。
     - [runtime-child-registry.test.ts:768](packages/daemon/test/runtime-child-registry.test.ts:768)：只统计 mock `terminateNamedJob` 调用，真实 child 最后由测试代码手动 kill，不能证明 Job 终止副作用。
     - [runtime-child-wrapper-syntax.test.ts:25](packages/daemon/test/runtime-child-wrapper-syntax.test.ts:25)：Windows stdout/permit/flush 全是源码正则；把片段放进死代码仍会绿。
     - [runtime-child-registry.test.ts:2044](packages/daemon/test/runtime-child-registry.test.ts:2044)：只禁止字面量 `Date.now(` 并要求任意位置出现 `performance.now(`；改成 `new Date().getTime()` 仍会绿。
     - [verify-distribution.mjs:1046](packages/cli/scripts/verify-distribution.mjs:1046)：`orphanCheck` 是固定字符串；fatal loser PID 从未记录，最终 cleanup 还会掩盖此前未收口的 contender。

8. **`packages/platform` 越过 ADR 的“无业务”边界，并已出现 ownership 类型分叉**

   - **file:line**：[ADR-003:14](docs/adr/ADR-003-os-adapters.md:14)、[jobIdentity.ts:121](packages/platform/src/jobIdentity.ts:121)、[restartPolicy.ts:60](packages/daemon/src/tier1/restartPolicy.ts:60)
   - **失效场景**：agent owner 记录缺 `worktree`。
   - **错误结果**：platform parser 将其视为 valid，CLI emergency reaper 可据此杀 Job；daemon 的 `AgentOwnershipRecord` 要求 `worktree`，同一记录会被判 invalid。两个消费者对同一个 durable 文件给出不同结论。
   - platform 还负责 agent/runtime 领域记录、durable JSON 和 reap audit，已超出 ADR-003 的“纯 Node、无业务”授权范围。

## 已查、无发现

- 新增的 [健康 timeout 回归测试:2784](packages/daemon/test/runtime-child-registry.test.ts:2784) **确实有杀伤力**：`closeDeadlineMs=0` 会让旧实现首轮即失败；测试跨过多轮 poll，再切换到 `signaled/0` 并验证只在真实退出后发出 exit。它没有覆盖 `"live"`、259、close/HANDLE 释放，但不是“恰好为绿”。
- 取消健康路径 spawn deadline 本身正确。长驻健康进程持续 `"timeout"` 是预期状态；除 259 和 wrapper flush 外，未发现数值终态后继续主动续期。
- `home_owned` 探测到的服务确实属于他人：daemon 在取得 HOME 锁失败后于 [index.ts:312](packages/daemon/src/index.ts:312) 退出，端口 listen 在其后；问题仅是 loser 未被证明死亡。
- Job digest grammar、generation 绑定、assign-before-permit、禁止 `taskkill /T` 与审批门 loopback/HMAC 路径，已查未发现与 ADR 的直接冲突。

全程只读，工作树未修改。未运行 Vitest；当前沙箱会阻止其写 `.vite-temp`。要求的外部 Codex 对抗审查也因 `Operation not permitted` 未能初始化；两路零上下文独立审查均已取得并交叉核验。