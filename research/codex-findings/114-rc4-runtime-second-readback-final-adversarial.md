# RC4 runtime 第二轮独立对抗审查

## TL;DR

结论：`No-Go`。

本轮确认：

- P0：0
- P1：7
- P2：3
- P3：0

主要阻断项：

- Windows native spawn 的 Koffi ABI、CRT fd 继承块和参数引用不正确，真机 happy path 本身不可置信。
- Windows child 适配把所有实际退出硬编码为 exit code 1，并在 stdio 收口前发出 `close`。
- suspended spawn 失败回滚会遗留进程或 HANDLE，不满足 exactly-once close。
- durable owner 删除的所谓 CAS 不是跨进程原子操作，可删除 PID successor 的 owner。
- command token parser 接受普通 `token`/`tok`，破坏不可复用 ownership。
- shutdown 到达实际 `recover()` await 窗口后仍可继续 recover、spawn 和安排 tick。
- recovery-only 仍用 `String(err)` 投影 hostile unknown，并丢弃 supervisor IPC rejection。

三个测试门禁均因当前只读沙箱阻止 Vitest 写入 `.vite-temp` 而未进入测试收集；`typecheck`、`lint`、emoji gate 和 `git diff --check` 通过。门禁后 `lsof` 仍看到 73 个 cwd 位于本工作区 package 目录的 Node 进程，因进程参数枚举被沙箱拒绝，不能证明“无残留”。

## 审查基线与改动集合

- HEAD：`c3f8aa58c37be854b7fe4e79e34cc21f6ac598c3`
- 分支：`codex/rc4-runtime-recovery-rebuild`
- 暂存区：空
- tracked dirty diff：27 个文件，`3286 insertions / 371 deletions`
- 当前源码/测试范围另有 5 个 untracked 文件。
- `git status` 还列出 27 个 `prompts/**` untracked 文件，其中仅按要求读取本轮 `195`；其余 26 个 prompt 和 1 个 `research/**` 文件均未读取、未引用。
- 未读取 `logs/**`、`history/**` 或任何旧 finding。

本轮完整 product/test 改动集合：

- CLI：`packages/cli/src/emergencyReaper.ts`、`packages/cli/test/emergency-reaper.test.ts`
- daemon source：`api/recoveryOnlyServer.ts`、`config/cliRuntime.ts`、`config/pending.ts`、`index.ts`、`providers/byoa/runner.ts`、`runtimeChildRegistry.ts`、`startupFailure.ts`、`supervisorIpc.ts`、`tier1/executor.ts`、`tier1/gateServer.ts`、`tier1/restartPolicy.ts`
- daemon 新 source：`daemonStartupHooks.ts`
- daemon tests：`byoa.test.ts`、`helpers/daemonProcess.ts`、`recovery-only-process.test.ts`、`restart-policy.test.ts`、`runtime-child-registry.test.ts`、`startup-failure.test.ts`、`tier1-executor.test.ts`、`tier1-gate-socket.test.ts`
- daemon 新 fixtures：`close-durables-reject.ts`、`gate-bind-harness.ts`、`recover-hold.ts`、`startup-entry-harness.ts`
- platform：`src/gate.ts`、`src/index.ts`、`src/jobIdentity.ts`、`src/process.ts`、`src/win32.ts`、`test/process.test.ts`

对账依据是 canonical 的进程 ownership、shutdown/fatal 和审计条款，尤其是 [docs/09-data-contracts.md:1616](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/docs/09-data-contracts.md:1616)、[docs/09-data-contracts.md:1618](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/docs/09-data-contracts.md:1618)、[docs/09-data-contracts.md:1622](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/docs/09-data-contracts.md:1622) 和 [ADR-003-os-adapters.md:43](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/docs/adr/ADR-003-os-adapters.md:43)。

## 不变量对账

### A. Windows native / Job / process identity

- [fail] A1：`CreatePipe` 的 security attributes 和 `CreateProcessW` 的 `STARTUPINFO/PROCESS_INFORMATION` 均绑定成无类型 `void *`，调用处却传 plain object；CRT fd block 从 1-byte count 开始，引用规则也不符合 Windows CRT。[win32.ts:328](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:328)、[win32.ts:334](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:334)、[win32.ts:1005](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1005)
- [fail] A2：CreateProcess 成功后的异常只关闭 pipe，不终止 suspended child，也不关闭 process/thread HANDLE；rollback 判断又会把未初始化的 `exitCode` 当成已退出。[win32.ts:1057](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1057)、[win32.ts:1102](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1102)、[runtimeChildRegistry.ts:890](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:890)
- [fail] A3：`commandToken` 除 UUID grammar 外还接受任意 identity token，例如 `t`、`tok` 和 `token`。[jobIdentity.ts:22](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:22)
- [fail] A4：内存 Job generation 有捕获，但 durable owner 的检查与删除不是原子 CAS；跨进程 successor 可在检查后、unlink 前替换同一路径。[jobIdentity.ts:295](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:295)
- [ok] A5：当前 Windows destructive kill 主路径要求 Job、birth、ownerInstanceId 和 runId，不存在 `taskkill` 回落；runtime signal 缺 Job 时直接 fail closed。[process.ts:809](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:809)、[runtimeChildRegistry.ts:432](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:432)
- [fail] A6：home boundary 只是单进程内的 `Map`；正常 runtime owner 删除还把 audit callback 设为空操作。[jobIdentity.ts:318](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:318)、[runtimeChildRegistry.ts:819](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:819)

### B. daemon lifecycle / composition / hostile unknown

- [fail] B1：startup shutdown 只设置 flag/AbortSignal；prior-generation recovery 和实际 `tier1Executor.recover()` 不接收 signal，且 recover 返回后仍无条件安排 tick。[index.ts:3573](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3573)、[index.ts:3673](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3673)
- [fail] B2：普通 gate post-bind failure 和 deadline late promise 已消费，但 recovery-only 的 ready frame 发送 rejection 被直接丢弃，可产生 unhandled rejection。[recoveryOnlyServer.ts:179](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:179)
- [fail] B3：recovery-only 多处直接 `String(err)`，既能泄漏 `SECRET`/路径，也会被 revoked Proxy 或 hostile coercion 击穿 catch。[recoveryOnlyServer.ts:330](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:330)、[recoveryOnlyServer.ts:478](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:478)
- [fail] B4：pending parser 已拒绝缺字段，但 generic token 和非原子 owner 删除仍使 prior-generation/CLI cleanup 不满足严格 ownership。
- [ok] B5：新增 hook 是模块局部显式 composition，生产默认空；机械检索未发现 `globalThis.__SAYDO*` 或 `SAYDO_TEST_*`。[daemonStartupHooks.ts:13](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/daemonStartupHooks.ts:13)
- [fail] B6：真实入口 recover-hold 测试等待的是 fixture import 时立即发送的帧，而不是生产代码真正进入 recover 调用前 hold。[recover-hold.ts:17](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/fixtures/recover-hold.ts:17)、[startup-failure.test.ts:730](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/startup-failure.test.ts:730)
- [fail] B7：相关新增/修改测试仍有 `toBeGreaterThanOrEqual`、`toBeGreaterThan(0)` 等宽松 close/kill 断言，且 strict owner 测试被更早的 `ownerPid=1`/缺 Job 分支短路。[runtime-child-registry.test.ts:1273](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/runtime-child-registry.test.ts:1273)、[emergency-reaper.test.ts:782](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/test/emergency-reaper.test.ts:782)

### C. 普通正确性与回归

- [fail] 确认存在 Windows happy-path 恒报失败、输出截断、suspended child/HANDLE 泄漏、successor owner 误删、shutdown 后继续 recover/tick、未消费 IPC promise 和测试无法杀死旧缺陷等确定性问题。
- [warn] 当前 macOS 只读环境无法执行 Vitest，也无法代替 Windows 真机证明 native ABI。
- [warn] 门禁后当前工作区存在 73 个 package-cwd Node 进程；无法取得 argv 或门禁前同口径基线，因此不能归因，但“无残留”断言不成立。

## Findings

### P0

无确认的 P0。

### P1

#### P1-1 Windows native spawn 的 Koffi ABI、CRT fd block 和 argv 引用均不正确

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:328](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:328)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:334](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:334)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:922](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:922)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1005](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1005)
- 可复现路径：Windows 调用 `createSuspendedOwnedWindowsProcess()`。Koffi 只知道最后两个参数是 `void *`，没有结构布局可把 `si`/`pi` plain object 编码为结构体；`CreatePipe` 的 `SECURITY_ATTRIBUTES` 同理。即使绕过该错误，当前 reserved block 是 37 bytes，count 写在 offset 0 的单字节，handle 从 offset 5 开始；正确的四 fd CRT block 应从 32-bit count 开始，handle 从 offset 8 开始。带空格且以反斜杠结尾的 argv 还会把 closing quote 转成 literal quote。
- 合同影响：无法可信获得 process/thread HANDLE、PID 或 fd3 permit，Windows runtime/Tier1/BYOA native happy path不成立，违反 ADR 的 “CreateProcess→Assign→permit” 顺序。
- 最小修复：保留并使用 `SECURITY_ATTRIBUTES`、`STARTUPINFOW/STARTUPINFOEXW`、`PROCESS_INFORMATION` 的 typed pointer binding；用明确分配的结构体/输出缓冲区；按 `int count + flags[count] + intptr_t handles[count]` 构造 CRT block；采用完整 Windows CRT argv 引用算法。增加真实 stdin/stdout/stderr/fd3 往返测试。

#### P1-2 suspended spawn 的失败回滚不终止 child，也不 exactly-once close HANDLE

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1043](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1043)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1062](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1062)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1102](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:1102)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:909](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:909)
- 可复现路径：让 `CreateProcessW` 成功，再令任一 child-end `CloseHandle`、`_open_osfhandle` 或 stream construction 失败。catch 只执行 `closeAll()`，没有 `TerminateProcess`，也没有关闭 `pi.hProcess/pi.hThread`；child 保持 suspended。daemon rollback 的 process-handle 分支只 terminate，不 close，且 `waitChildTerminal()` 会把未初始化的 `exitCode` 误判为 terminal。
- 合同影响：遗留 suspended child、泄漏 HANDLE/CRT fd，并可能提前关闭 Job 后丢失精确 generation；违反任一失败都完整回滚和 exactly-once close 的要求。
- 最小修复：把 process、thread、pipe、CRT fd 和 stream 纳入单一资源状态机；每个状态转换后更新 ownership，统一 `finally` 中 terminate、等待 handle-backed exit、关闭 thread/process/job 各一次。失败路径必须保留完整 generation，不能用默认 generation 覆盖。

#### P1-3 Windows child adapter 把成功退出硬编码为 code 1，并提前发 `close`

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:1028](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:1028)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:1043](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:1043)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:1051](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:1051)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:1462](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:1462)
- 可复现路径：在 Windows 执行任意 `process.exit(0)` runtime child。poll 只查询是否仍 active；一旦退出便执行 `finish(1)`。`execRuntimeChild()` 随后必定抛出 exit-code-1 failure。`exit` 和 `close` 在同一个同步函数中发出，未等待 stdout/stderr EOF，最后一段输出可被截断。
- 合同影响：Windows 上所有正常 runtime command 被投影为失败，结果/日志可丢失；业务恢复、setup/verify/git 和 BYOA 均可能误判。
- 最小修复：从同一 process HANDLE 读取真实 exit code；初始化并维护 `exitCode`/`signalCode`；`exit` 在进程退出时发，`close` 只在全部 stdio 收口后发。为 exit 0、非零、长尾输出和 stream error 增加真机断言。

#### P1-4 durable owner 删除不是跨进程 identity CAS，可误删 successor

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:295](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:295)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:318](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:318)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/src/emergencyReaper.ts:153](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/src/emergencyReaper.ts:153)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/tier1/restartPolicy.ts:306](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/tier1/restartPolicy.ts:306)
- 可复现路径：reaper A 读取旧 owner 并通过 identity 比对；writer B 在 A 的 read 和 remove 之间用 rename 发布同 PID 路径的新 generation；A 先记旧 audit，再 `rmSync(path)`，删除 B 的 owner。`withHomeOwnerBoundary` 只能串行化当前 JS 进程，CLI 与 daemon 互不协调。agent owner 路径甚至没有删除前 identity reread。
- 合同影响：successor 失去 durable owner，后续可能成为孤儿或被错误投影为 exact-empty；违反 late release/PID reuse/successor registration 必须 identity CAS。
- 最小修复：所有 owner writer 和 reaper 共用跨进程 filesystem lock；锁内重读完整 immutable generation，包括 pid、birth、ownerPid、ownerInstanceId、runId、jobName、binary、commandToken，再 audit 和 unlink。agent/runtime/prior-generation 统一使用同一原语。

#### P1-5 command token grammar 接受可复用普通 token

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:22](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:22)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:26](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:26)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:168](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:168)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/src/emergencyReaper.ts:329](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/src/emergencyReaper.ts:329)
- 可复现路径：parser 接受 `t`、`tok`、`token`。一个 stale pending POSIX owner 若 PID 已复用，只要新 PG leader 的命令恰好包含该普通参数和相同 binary，`readOwnedProcessBirth()` 就返回新 birth，CLI pending 分支会对新进程组执行 destructive kill。
- 合同影响：不可复用 token 被降级为普通字符串匹配，PID reuse 边界不再安全。
- 最小修复：只接受完整 `saydo-child-<UUID>` 且禁止 trim 后接受；旧 generic token owner 必须保留并 fail closed。测试使用真实 token factory，并增加 `t`、`tok`、`token` 必须 invalid 的反例。

#### P1-6 shutdown 到达 recover await 后仍可继续 recover、spawn 和安排 tick

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:308](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:308)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3573](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3573)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3673](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3673)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3969](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3969)
- 可复现路径：让 `tier1Executor.recover()` 在内部 await；调用真正开始后发送 `prepareShutdown`。listener 只设置 `runtimeDraining` 和 abort gate bind。recover 不接收 signal，可能继续 spawn；返回后代码仍执行 `scheduleRuntimeInterval(...tick...)`。startup 未 ready 时 shutdown lifecycle 只记录 pending reason，不立即接管。
- 合同影响：shutdown 后可产生新 agent/owner/tick，与唯一 draining lifecycle 和 exact-empty 语义冲突。
- 最小修复：把 AbortSignal 贯穿 prior-generation recovery、Tier1 recover、reap 和 spawn；每个破坏性动作前后检查；shutdown 应立即启动 lifecycle，并等待 recovery 的受控取消收口。recover 返回后再次检查 signal，禁止 schedule tick。

#### P1-7 recovery-only 未共享 trap-free projection，且 ready IPC rejection 未消费

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:179](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:179)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:330](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:330)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:348](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:348)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:478](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:478)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:811](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:811)
- 可复现路径：让 setup probe、fatal、DB close 或 listen 抛出 `new Error("SECRET=/full/path")`，原文会进入 HTTP、log 或 supervisor frame；传 revoked Proxy 时，`instanceof Error`/`String()` 自身可抛。受监管 ready send 失败时，`sendFrame()` 对 rejected Promise 不附 handler，形成 unhandled rejection。
- 合同影响：敏感内容泄漏，hostile unknown 可击穿 catch，fatal/stopped 语义不确定。
- 最小修复：所有 recovery-only catch 统一使用普通入口的常量投影函数；HTTP 也只返回固定错误码/文本。所有 IPC send 必须 await 或显式消费 rejection；ready send 失败应进入唯一 fatal lifecycle。

### P2

#### P2-1 正常 runtime owner 删除没有 durable audit

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:819](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:819)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:827](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:827)
- 可复现路径：runtime child 确认 gone 后调用 lease release；`commitOwnerReapIfIdentity()` 的 audit callback 是 `() => undefined`，随后 owner 被删除。
- 合同影响：违反“一切状态转换落 audit”和 audit-before-delete，无法追溯 owner 正常消失。
- 最小修复：删除前写脱敏 audit；audit 失败必须保留 owner。

#### P2-2 recover-hold 和 prior-generation 顺序测试没有证明其标题所称窗口

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/fixtures/recover-hold.ts:17](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/fixtures/recover-hold.ts:17)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/helpers/daemonProcess.ts:117](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/helpers/daemonProcess.ts:117)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/startup-failure.test.ts:746](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/startup-failure.test.ts:746)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/startup-failure.test.ts:789](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/startup-failure.test.ts:789)
- 可复现路径：fixture 作为 `--import` 在 production entry 前立即发送 `test-recover-hold`。父测试随后只等待 `phase=starting` 的 `/health`，因此 shutdown 可以在 DB/startup 早期发送，尚未到达 line 3674 的 hold。prior-generation 测试同样只等待 starting health 和 owner 消失，没有观测 `ready` 的相对顺序。
- 合同影响：旧代码即使在实际 recover await 中继续 spawn，也可能通过新增测试。
- 最小修复：把 hook 改为在 production call site 被调用并返回 Promise；进入该回调时才发送 hold-entered frame。测试必须先证明进入该点，再发送 shutdown。prior-generation 测试需同时捕获 ready frame，断言 owner 删除严格先于唯一 ready。

#### P2-3 strict owner、hostile 和 exact-close 测试存在短路或宽断言

- 绝对定位：[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/test/emergency-reaper.test.ts:799](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/test/emergency-reaper.test.ts:799)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/test/emergency-reaper.test.ts:811](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/test/emergency-reaper.test.ts:811)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/test/emergency-reaper.test.ts:817](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/test/emergency-reaper.test.ts:817)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/test/process.test.ts:813](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/test/process.test.ts:813)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/test/process.test.ts:909](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/test/process.test.ts:909)、[~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/runtime-child-registry.test.ts:2050](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/runtime-child-registry.test.ts:2050)
- 可复现路径：CLI invalid samples 全部带 `ownerPid:1`，Windows 又缺 jobName，因此会在目标 binary/token 检查前失败；构造的 accessor `rec` 从未写入文件。platform parser 基线把普通 `"token"` 当作 valid。handle close/successor 测试只断言 `>0` 或 `>=1`，双关、漏关、额外 close 都可通过。
- 合同影响：新增测试无法杀死 generic token、hostile accessor 和 double-close 等旧缺陷。
- 最小修复：每个非法字段只改变一个维度，其他字段保持完整有效；真实序列化 hostile 样本；close/terminate/audit/leaf 全部断言精确数量、身份和顺序。

### P3

无确认的 P3。

## 门禁结果

| 顺序 | 命令 | Exit | 总计 | Wall time | 结果 |
|---|---|---:|---|---:|---|
| 1 | `pnpm --filter @saydo/platform test` | 1 | 未生成；未进入收集 | 0.44s | `.vite-temp/vitest.config...mjs` 写入被只读沙箱拒绝，`EPERM` |
| 2 | `pnpm --filter @saydo/cli test` | 1 | 未生成；未进入收集 | 0.39s | 同上 |
| 3 | `pnpm --filter @saydo/daemon test -- test/runtime-child-registry.test.ts test/tier1-executor.test.ts test/byoa.test.ts test/restart-policy.test.ts test/startup-failure.test.ts test/tier1-gate-socket.test.ts test/shutdown-deadline.test.ts test/recovery-only-process.test.ts` | 1 | 未生成；未进入收集 | 0.39s | 同上 |
| 4 | `pnpm typecheck` | 0 | 5 个 package typecheck 脚本均 `Done`；输出为 `Scope: 6 of 7` | 4.60s | [ok] |
| 5 | `pnpm lint` | 0 | 0 条诊断 | 3.26s | [ok] |
| 6 | `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` | 0.30s | [ok] |
| 7 | `git diff --check` | 0 | 0 个 whitespace error | 0.02s | [ok] |

补充诊断：

- 尝试用 `--configLoader runner` 避免仓库内 `.vite-temp`，仍因系统临时目录不可写失败：4 个 test files、0 tests、4 个 `EPERM` unhandled errors，exit 1，real 0.91s。它不替代固定门禁。
- `ps`、`pgrep` 和 `sysctl kern.procargs2` 均被沙箱拒绝。
- `lsof -a -d cwd` 成功返回 73 个 package-cwd Node 进程：CLI 20、platform 10、daemon 43。由于没有门禁前同口径基线且无法读取 argv，不能确认其来源，也不能声明无残留。本只读审查未终止这些进程。
- 门禁后 `git status`、HEAD 和 diff stat 与审查基线一致；暂存区仍为空。

## Windows 真机待验清单

当前已有但必须在 Windows 真机执行的 skip：

- `active=0` 且 PID 仍活时拒绝并保留：[process.test.ts:162](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/test/process.test.ts:162)
- 真实孙进程在 `TerminateJob` 后不可存活：[process.test.ts:193](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/test/process.test.ts:193)
- 重名 Job 必须报 `ERROR_ALREADY_EXISTS`：[process.test.ts:990](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/test/process.test.ts:990)
- suspended CreateProcess/assign/birth/membership/close：[process.test.ts:1001](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/test/process.test.ts:1001)
- runtime Job 孙进程回收：[runtime-child-registry.test.ts:586](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/runtime-child-registry.test.ts:586)

修复后还必须补充以下真机矩阵：

1. Koffi typed struct pointer 能真实回填 `PROCESS_INFORMATION`，PID/HANDLE 宽度正确。
2. Unicode、空参数、空格、quote、连续反斜杠和 trailing backslash argv 保真。
3. stdin/stdout/stderr/fd3 permit 双向往返，长尾输出不截断。
4. `STARTUPINFOEXW` handle list 之外的 inheritable handle 不进入 child。
5. 在 CreateProcess 后每一步注入失败，断言零 suspended child、Job/HANDLE/fd 精确归零。
6. exit 0、exit 7、terminate、stdio error 的 `exit`/`close` 代码与顺序精确。
7. daemon 硬崩后 KILL_ON_JOB_CLOSE 真正收掉 wrapper、目标与孙进程。
8. CLI/restart/prior-generation 对 membership unknown、query error、EPERM、timeout、final-observe-active 全部保留 owner。
9. 两个真实进程并发执行 owner writer/reaper，证明 successor owner 不会被旧 generation 删除。
10. recovery-only supervisor disconnect/ready-send failure 无 unhandled rejection，hostile unknown 不泄漏。
11. Windows owner 机运行完整 `just ci`，并从发行闭包真加载 Node 22 `koffi` 与 `better-sqlite3`。

## 独立结论

`No-Go`。

确认的 7 个 P1 已足以阻断 RC4 runtime trust-boundary 收口；其中 Windows native happy path、owner successor CAS、shutdown/recover 竞态和 recovery-only hostile unknown 都是生产语义问题，不是单纯测试缺口。

本审查零落地：没有修改、暂存、提交、推送、创建 tag 或写入任何仓库报告文件。测试门禁本轮因只读沙箱未实际运行；即使后续全部测试通过，也不能把测试通过当成不存在上述代码缺陷。