# RC4 runtime 第二轮独立复审红灯后的全新重做

当前工作树以 checkpoint `2637d30d361ed3835711418697d427fe2ec9e987` 为基线。上一实施会话已经经过第二轮独立 readback，两个零上下文审查者与一个外部 Codex 对抗审查均裁决 `No-Go`。这是第二次独立红灯，按项目制度必须放弃旧实施会话并用全新会话重做；禁止 resume 任何旧 session。

只修改当前 `<runtime-worktree>`。不要提交、推送、打 tag、发布、联网或触碰其他 worktree。禁止读取 `logs/**`、`history/**`、`research/**`、本文件之外的 `prompts/**`，也不要采信旧实施总结。只以本文件、仓库 `AGENTS.md`、当前源码/测试、`docs/09-data-contracts.md`、`docs/adr/ADR-003-os-adapters.md` 及本机已安装依赖的官方类型/源码为输入。

当前 checkpoint 是为防止重复施工而固化的失败实现，不是批准基线。允许删除错误设计、增加窄模块、修改 `lifecycleDisposition` 及其测试、更新 package lock；不要为缩小 diff 保留已知错误。不得削弱 canonical、删除门禁、用 skip 或宽松断言换绿。

## 总验收目标

交付一个可进入下一轮独立 readback 的 runtime trust-boundary 实现，同时满足：

1. Windows 原生 spawn 在 ABI、stdio、permit、Job、退出码和 HANDLE 生命周期上真实成立。
2. 任意 delayed signal/release/timer/reaper 都只能作用于其捕获的唯一 generation，不能按裸 PID 动态命中 successor。
3. owner writer/reaper 的 boundary 是跨进程原子边界；audit 与完整 identity CAS 在同一临界区内。
4. shutdown 在 bind/recover 任意 await 窗口都立即接管唯一 lifecycle，之后不能继续 recover、spawn 或 tick。
5. fatal > signal > restart；直到最终 terminal frame 前仍允许 fatal 升级，不能把后到 fatal 投影为 stopped/exit 0。
6. 普通入口与 recovery-only 的 unknown、IPC rejection、清理 deadline 均 trap-free、脱敏、有界且无 unhandled rejection。
7. 测试必须能杀死本文件列出的旧缺陷，并在 Windows 真机形成可执行门禁。

## A. Windows native spawn 必须从 ABI 到退出语义完整重做

### A1. Koffi typed ABI 与结构体

当前 `CreatePipe`、`CreateProcessW` 把结构体参数声明为 `void *` 却传 plain object，Koffi 3.1.6 会拒绝 `Unexpected Object value, expected void *`。必须：

- 为 `SECURITY_ATTRIBUTES *`、`STARTUPINFOEXW *`、`PROCESS_INFORMATION *`、`OVERLAPPED *` 等使用真实 typed pointer/buffer；输出结构由 Koffi 正确回填，不把 object 传给裸 `void *`。
- `lpCommandLine` 使用可写 UTF-16 buffer；PID、DWORD、SIZE_T、HANDLE、ULONG_PTR 按真实 pointer width 定义。
- 非支持架构显式 fail closed；不得静默按 x64 硬解释 ARM64/x86。
- 采用完整 Windows CRT argv 逆算法，覆盖空参数、Unicode、空格、quote、quote 前连续反斜杠和 trailing backslash。

### A2. 精确 handle inheritance 与 permit

必须使用 `STARTUPINFOEXW`、`PROC_THREAD_ATTRIBUTE_HANDLE_LIST` 和 `EXTENDED_STARTUPINFO_PRESENT`，只继承明确列出的 stdin/stdout/stderr/permit handle；并发 spawn 不得交叉继承其他临时 inheritable handle。

permit 有两条允许路线，只能选择并完整证明其中一条：

- 保留 fd3：严格镜像当前 Node/libuv Windows CRT `lpReserved2` 约定，以 32-bit count 开头，随后 flags，再按真实 pointer width 放 HANDLE；不得手写未经源码核对的 1-byte count/固定 offset。
- 移除 Windows fd3：改成唯一 generation 绑定的显式 permit channel，但仍须保证 `CREATE_SUSPENDED -> 同一 process HANDLE assign Job -> membership/birth proof -> durable owner -> ResumeThread -> permit -> wrapper 执行 target`。permit 不可复用、不可被 successor 消费，失败必须保持 target 未执行。

不得以普通 unsuspended `child_process.spawn()` 绕过 durable-owner-before-execute 合同。

### A3. 真实退出码、stdio drain 与事件顺序

- 使用同一 process HANDLE 的 `WaitForSingleObject`/`GetExitCodeProcess` 或等价权威机制取得真实 exit code；exit 0 不能再硬编码为 1，unknown 不能伪装成功。
- `exit` 只表示进程真实退出；`close` 只在 stdout/stderr/stdin/permit 相关流按 Node 语义收口后发出，尾部输出不得截断。
- 精确覆盖 exit 0、exit 7、Job terminate、stream error、长尾 stdout/stderr；同一 child 的 `exit`/`close` 各一次且顺序确定。

### A4. 单一资源 ownership 状态机

为 pipe HANDLE、CRT fd、stream、attribute list、thread HANDLE、process HANDLE、Job HANDLE 建立显式 ownership-transfer 状态机：

- `CreateProcessW` 成功后的每个失败点都要终止并等待 suspended child，随后各资源 exactly-once close。
- `_open_osfhandle` 接管 HANDLE 后只能由 CRT fd/stream owner 关闭，原 HANDLE owner 立即失效；不得 double-close。
- 正常 generation 必须保留 process HANDLE，不能由 `jobGeneration()` 丢弃；正常退出、rollback、late release 均闭合。
- rollback 不得把未初始化 exit code 当作已退出；最终 unknown/live/timeout 一律保留 owner 并 fail closed。

为每个 transfer/failure point 增加可注入单测，并提供 Windows 真机 handle-count/零 suspended child 门禁。

## B. 唯一 generation、strict identity 与跨进程 CAS

### B1. 不可复用 generation

- 每次 spawn 生成独立 UUID generation；command token 只接受完整、版本化的 `saydo-child-<uuid>` grammar，`t`、`tok`、`token`、trim 后才合法的字符串全部 invalid/fail closed。
- Job name、owner record、pending record、内存 map 绑定同一 generation；parser 校验类型、格式及 ownerInstanceId/runId/generation 的互相绑定，不接受任意 truthy jobName。
- immutable identity 至少包含 `pid`、process birth、`ownerPid`、`ownerInstanceId`、`runId`、`jobName`、`binary`、`kind`、`commandToken`、generation；Windows 活跃 capability 还要持有同一 Job/process HANDLE。

### B2. 捕获 capability，禁止延迟裸 PID 查询

- signal、grace timer、hard-kill timer、release、teardown、recovery 都捕获创建时的 immutable generation/Job/process capability。
- 禁止 delayed callback 到执行时再用 PID 从全局 map 取“当前 generation”；PID reuse 或 successor registration 后旧 callback 必须 no-op/fail closed，绝不能触碰新一代。
- Windows destructive kill 只用已验证的 Job/process capability；无 `taskkill`、裸 PID kill 或重新 open PID 的回落。

### B3. 真正的跨进程 home boundary

现有 Promise `Map` 只在单 JS 进程内串行，不能保护 CLI 与 daemon。实现一个本地文件系统上的、由 OS 在进程退出时释放的跨进程 advisory lock：

- POSIX 使用受控 lock file + `flock` 等价；Windows 使用 `LockFileEx` 等价。可经现有 Koffi 适配，但 ABI 与 HANDLE ownership 同样要有测试。
- 锁路径基于规范化后的 home；获取有明确 deadline，失败保留 owner 并 fail closed。不要使用会在 crash 后永久遗留或依靠不安全 stale-delete 的裸 lockfile/mkdir 协议。
- 所有 runtime/agent/prior-generation writer、release、CLI emergency reaper、daemon restart policy 必须共享同一 boundary；不能只包 reaper 而 writer 不加锁。

### B4. 锁内 audit-before-delete + 完整 identity CAS

- 在同一跨进程临界区内重读当前 owner，按完整 immutable identity 比较，先写脱敏 durable audit，audit 成功后才 unlink。
- identity changed、读取异常、membership unknown、birth unknown/mismatch、Job 仍 active、audit 失败均保留 owner；不得报告成功 reap。
- 正常 runtime owner release 也必须写真实 audit，不能传空 callback。
- 补两个真实进程并发 writer/reaper 的测试，强制 successor 在旧 generation 的 kill 与 delete 之间发布，证明 successor owner 不会被删。

## C. shutdown/recover/lifecycle 必须可取消且单一

### C1. shutdown signal 贯穿所有 startup await

同一个 shutdown `AbortSignal` 必须进入并控制：

- prior-generation owner recovery；
- production call site 的 recover hold；
- executor-disabled/inactive drain；
- `Tier1Executor.recover()` 内部 await、active 注册、recoverAttempt/spawn；
- recover 返回后的 tick 注册。

每个 await 后、active/owner 注册前、spawn/permit 前、tick 注册前都复核 signal。首次 shutdown 到达时立即建立并缓存唯一 lifecycle Promise，不能只记 pending reason 等 `startupLifecycleReady`。取消本身也受统一 deadline 约束，late settle/reject 全部消费。

### C2. 真实 recover-window 门禁

测试 seam 保持模块局部、显式 composition，生产默认 no-op；禁止 `globalThis.__SAYDO*`、`SAYDO_TEST_*` 或其他 ambient switch。

真实 child-process 测试必须走同一个 `src/index.ts`，并在 production `Tier1Executor.recover()` 内部真正进入 await/hold 后才发 `recover-entered`。测试确认该 frame 后发送 shutdown，之后不得人工发送 release；必须在 deadline 内：

- 精确 exit 0；
- 唯一 `stopped`，零 `fatal`；
- recover-attempt/spawn/tick marker 为 0；
- runtime/Tier1 owner 集不增加；
- 无残留 daemon/child。

prior-generation 顺序测试同时捕获 ready，精确断言旧 owner 处理在唯一 ready 前完成；shutdown 到达时则不得继续 ready。

### C3. disposition 优先级与冻结点

当前 signal claim 会立即 freeze，后到 fatal 被错误降级。改为：

- 优先级恒为 `fatal > signal > restart`；signal 可取消 restart grace，但不能阻止 drain/cleanup/gate/IPC 的后到 fatal 升级。
- 只有在即将发送唯一 terminal frame/确定 exit code 时才冻结；drain 完成后重新读取最终 disposition。
- signal -> gate failure、signal -> cleanup failure、signal -> ready IPC failure 必须是唯一 fatal、零 stopped、非零退出；无故障 signal 才是唯一 stopped、exit 0。
- 现有“signal 后 fatal claim=false”的错误测试必须改为 canonical，而不是删除。

## D. hostile unknown、IPC 与有界清理

### D1. 普通入口和 recovery-only 共用 trap-free 投影

所有 startup、recover、gate listen、HTTP setup、fatal、DB close、audit、日志、supervisor frame 路径不得直接使用 `String(unknown)`、`instanceof Error`、`.message`、`.code` 或 raw cause。统一使用固定 code/常量投影：

- native Error/AggregateError、primitive、function、Symbol/BigInt、accessor、Proxy、revoked Proxy 都不能泄漏 `SECRET`、完整路径或击穿 catch；
- HTTP 仅返回固定错误码/文本；日志/audit/IPC 同样脱敏；
- catch handler 自身不得再 reject 后无人消费。

保留并复核已经实现的 branded lifecycle Error、私有 immutable snapshot、explicit `cause: undefined` leaf 和 error-graph budget；不得重新扩大到信任任意 native Error message。

### D2. supervisor IPC Promise 必须进入 lifecycle

普通 ready、recovery-only ready、fatal、stopped 的同步 throw、callback error、channel disconnect/rejection 都必须 await 或显式接入唯一 lifecycle；不得 `void` 丢弃。ready 失败必须受控 fatal、非零退出、零 unhandled rejection。

### D3. cleanup 独立硬截止

startup/recover/emergency cleanup、DB close、gate close、active completion 与 `proc.wait()` 不能无限阻塞。fatal cleanup 必须有不依赖被清理 Promise 的独立单调 deadline：到时保留未知 owner、发脱敏 fatal、非零退出；late resolve/reject 全部消费且不产生第二 terminal frame。

## E. 测试杀伤力

- failure leaf 对完整数组做精确 length、顺序、message/code 和对象 identity 断言；同一 origin 去重、不同 TERM/KILL failure 各保留一叶。禁止 `toBeGreaterThan*`、宽松 `some/includes` 代替结构合同。
- 每个 invalid owner/token hostile 样本只改变一个字段，其他字段完整有效，保证测试命中目标 parser 分支；不要被 `ownerPid=1`、缺 jobName 等更早分支短路。
- close/terminate/audit/unlink/IPC 的次数全部精确，能杀死 double-close、漏 close、额外 terminal frame。
- Windows 真机新增：typed ABI 回填、argv 矩阵、stdio/permit、handle whitelist 并发、每个 rollback fault、exit/close 矩阵、handle count、KILL_ON_JOB_CLOSE、unknown membership/final active 保留 owner、两进程 CAS。
- Mac/Linux policy 测试不能冒充 Windows native 证明；Windows-only 用例可在非 Windows skip，但必须是真正可执行且将由 host 在 Windows 跑。

## 必跑门禁

先为每个 finding 写能在旧实现失败的最小回归，再严格串行运行；daemon Vitest 之间不得并发：

```text
pnpm --filter @saydo/platform test
pnpm --filter @saydo/cli test
pnpm --filter @saydo/daemon exec vitest run test/lifecycle-disposition.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts test/byoa.test.ts test/restart-policy.test.ts test/startup-failure.test.ts test/tier1-gate-socket.test.ts test/shutdown-deadline.test.ts test/recovery-only-process.test.ts
pnpm --filter @saydo/daemon test
pnpm typecheck
pnpm lint
bash scripts/check-emoji.sh
git diff --check
```

门禁后机械检索生产代码中是否出现 ambient test switch、`taskkill`/裸 PID destructive fallback、未消费 IPC Promise、当前工作树残留 daemon/test child。若 sandbox 阻止某项系统探针，如实列为 host 待验，不得用缩小门禁换绿。

## 交付格式

保持工作树未提交。最终报告必须列：

1. 每个根因与最终设计；
2. 每个验收项的真实 `file:line`；
3. 每条门禁的真实命令、exit、通过/跳过计数与 wall time；
4. Windows 真机待运行用例清单；
5. `git status --short` 与残留进程检查。

测试全绿不等于自动通过；实现完成后仍要接受新的零上下文双路 readback 与外部 Codex 对抗审查。
