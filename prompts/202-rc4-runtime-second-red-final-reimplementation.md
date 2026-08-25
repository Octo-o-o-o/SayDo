# RC4 runtime 第二次红灯后的最终全新重实施

你是全新的实施会话，不是评审会话。当前工作区：

- worktree：`SayDo-rc4-runtime-final-reimplementation-20260824`
- 分支：`codex/rc4-runtime-final-reimplementation-20260824`
- 起始 checkpoint：`848cf38642db487348f284623042345f77f9dec3`

该 checkpoint 只是为防重复施工而封存的失败实现，不是批准基线。旧实施 session
`01a03397-9ddf-7870-93b9-6c68101a1201` 已因第二次独立红灯永久弃用，禁止 resume 或复制其推理。
历史 prompt 中出现过错误展开的 checkpoint hash；本文件的 `848cf38642db487348f284623042345f77f9dec3`
是唯一正确坐标。

只修改当前 worktree。不得提交、推送、打 tag、发布、部署、联网或触碰其他 worktree。不得读取
`logs/**`、`history/**`、`research/**`、`docs/review/**` 或本文件之外的 `prompts/**`；不要采信旧实施
总结。输入仅限本文件、仓库 `AGENTS.md`、当前源码/测试、`docs/09-data-contracts.md`、
`docs/adr/ADR-003-os-adapters.md`、`docs/adr/design/ADR-004-windows-platform.md`，以及本机已安装依赖的
官方类型/源码。

允许删除 checkpoint 中的错误设计、增加窄模块、调整 package lock。不得削弱 canonical、删除门禁、
增加 ambient test switch、用 skip/放宽 timeout/主动 release/宽松断言换绿。所有新注释、文档和交付
报告使用简体中文；标识符保持英文。

## 0. 可判定完成标准

只有同时满足以下条件才可交付：

1. 下列 R1-R11 每项都有一个在 checkpoint 上会失败、修复后会通过的最小回归。
2. Windows native spawn 的 ABI、stdio、permit、Job、exit 和 HANDLE ownership 形成单一显式状态机；
   本机无法执行的 Windows 用例必须是真正可在 Windows 运行的测试，明确列为待真机，不得冒充通过。
3. 每次 spawn 的 generation capability 不可复用；任何旧 timer/signal/release/reaper 对 successor 都
   no-op/fail closed。
4. runtime 与 agent 的所有 writer/reaper/release 共用同一跨进程 HOME boundary；锁内重读完整身份，
   durable audit 成功后才 CAS unlink。
5. 首次 shutdown 在第一个 bind 前就拥有唯一 lifecycle；同一 AbortSignal/deadline 贯穿全部 startup
   await，shutdown 后不再 recover、注册、spawn、permit 或 tick。
6. `fatal > signal > restart` 一直到唯一 terminal frame 前保持可升级；ready/terminal IPC Promise
   全部被 await 或并入唯一 lifecycle，零 unhandled rejection。
7. hostile unknown 投影 trap-free、固定、脱敏；invalid JSON 回复后不再进入业务路由。
8. 本文件末尾全部门禁严格串行通过，生产检索与残留进程检查无红灯。

## 1. 先修 canonical：generation-bound、无歧义 Job 名

工程 ADR 当前的 `Global\\SayDoJob-<ownerInstanceId>-<runId>` 有确定性字段拼接碰撞，也没有绑定
generation。先最小修改 `docs/adr/ADR-003-os-adapters.md`，把机制合同定为：

```text
<scope>\\SayDoJob-v1-<digest>
scope  = Local | Global
digest = lowercase hex SHA-256(
  UTF-8("saydo-job-v1\\0" + ownerInstanceId + "\\0" + runId + "\\0" + generation)
)
```

`ownerInstanceId` / `runId` 继续走现有 ASCII identity token 约束，generation 必须是完整 UUID；三者都
不允许 NUL，因此该编码无歧义。`formatSayDoJobName`、matcher、owner parser、pending record、Job map、
reaper 与所有调用点必须同步要求同一 generation。相同 owner/run 的不同 generation 必须得到不同名；
`(a-b,c)` 与 `(a,b-c)` 必须不同。不要另造第二套 grammar，也不要把完整原始字段写入 Job 名。

除这一处机制 hardening 外，其余实现对齐现有 canonical，不改产品范围。

## 2. 已确认的根因与实施要求

### R1：旧 generation 延迟信号误杀 successor

当前 `registerGeneration` 覆盖 PID map，却保留旧 `generationsById`；`generationIsCurrent` 仅因旧 id
存在就返回真。POSIX birth 缺失时又直接 `kill(-pid)`。

必须：

- 注册同 PID 新 generation 时原子淘汰旧 id，并安全释放旧的非破坏性 bookkeeping；
- current 判定必须要求 PID map 精确指向同一完整 generation/capability；
- POSIX destructive signal 必须有非空 captured birth，现场复核一致；unknown/mismatch 直接拒绝；
- 删除延迟回调按裸 PID重新查“当前 generation”的 fallback；signal/grace/hard-kill/release/teardown
  全部捕获创建时 capability；
- 回归覆盖 POSIX null-birth、同 PID 两代、旧 `SIGTERM`/`SIGKILL`/timer/release 均不触碰 successor。

### R2：writer/reaper 没有共享 HOME boundary 与完整 CAS

当前 runtime pending writer、agent writer/clear、daemon restart reaper、CLI emergency reaper 和正常
release 没有全部进入同一跨进程临界区；agent schema 还允许 generation/token/job/owner 字段缺失。

必须：

- POSIX advisory lock 使用 OS 在进程退出时自动释放的 `flock` 等价；Windows 使用 `LockFileEx` 等价；
  锁路径基于规范 home，获取有单调 deadline，ABI/HANDLE ownership fail closed；
- runtime/agent/prior-generation 的 pending、durable publish、normal clear/release、daemon reaper、CLI
  reaper 全部调用同一 boundary；不能只锁 reaper；
- agent/runtime owner 的 destructive parser 强制完整 immutable identity：`version`、`pid`、birth、
  `ownerPid`、`ownerInstanceId`、`runId`、`jobName`、`binary`、`kind`、`commandToken`、`generation`；
- kill/terminate 在锁外使用已捕获 capability；回到锁内后重读当前 owner，完整 identity exact compare，
  写脱敏 durable audit，audit 成功后才 CAS unlink；identity changed 为 no-op，其余 read/lock/audit/unlink
  异常必须保留 owner并向上传播；
- normal release 不得传空 audit callback；registry 缺失不得返回 permit-granting no-op；
- durable replace/append 要有 file 与 parent-directory fsync 证据，durable owner 成功前禁止 Resume/permit；
- 真正 spawn 两个独立 Node 进程复现 writer/reaper race；successor 在旧 kill 与 delete 之间发布后不得被删，
  writer 在另一进程持锁时必须等待或按 deadline fail closed，进程崩溃后锁自动释放。

### R3：Job/generation capability 不唯一

除 §1 的新 grammar 外，必须把 spawn 时捕获的 generation、Job name、process HANDLE/Job HANDLE 直接传入
`AgentProcessHandle` 和 durable owner writer。禁止 agent publish 时按裸 PID动态查询当前 Job。修复现有
不可达的 capability comparison 分支。Windows destructive action 只接受同代 captured capability；
不得回落到 `taskkill`、裸 PID kill 或重新打开 successor PID。

### R4：Windows rollback 把未初始化状态当 terminal并丢 capability

当前 synthetic child 没有把 `exitCode` / `signalCode` 初始化为 `null`；底层 rollback 忽略
`TerminateProcess`、`WaitForSingleObject` 的返回值后无条件关闭资源。

必须：

- synthetic child 明确初始化 Node 语义字段；
- 为 pipe HANDLE、CRT fd、stream、attribute list、thread HANDLE、process HANDLE、Job HANDLE 建立单一
  ownership-transfer 状态机；
- CreateProcessW 后每个 fault point 都走同一 rollback：请求终止、权威 wait、读取 exit，再按状态转移；
- `unknown` / `live` / `timeout` / terminate failure / wait failure 一律保留 process+Job capability 与 durable
  owner，污染 lifecycle，不能 forget generation 或报告成功；
- `_open_osfhandle` 接管后原 HANDLE owner 立即失效，禁止 double-close；正常 generation 保留同一
  process HANDLE 到真实 terminal；
- Terminate、Wait、GetExitCode、Resume、Assign、membership/birth、owner publish、每次 transfer/Close 都有
  fault seam 与 exact-count 测试。

### R5：真实 exit/close/stdout/stderr 语义

必须以同一 process HANDLE 的权威 wait 与 exit code 为准；unknown 不得伪造 `exit(1)`。分别追踪：

- process terminal；
- stdout/stderr readable EOF 与底层 close；
- stdin/permit writable finish/error/close；
- thread/process/Job/CRT fd/HANDLE ownership。

`exit` 与 `close` 各最多一次，`close` 仅在进程 terminal 且所有相关流按 Node 语义收口后发出，尾部输出
不得截断。覆盖 exit 0、exit 7、Job terminate、wait unknown、stream error、长尾 stdout/stderr。

### R6：首次 shutdown 与 disposition freeze

当前早期 handler 只记 reason/abort，真正 lifecycle 在首次 bind 后很晚才建立；freeze 又早于 audit、DB
close、restart IPC 和 terminal send。

必须：

- 第一个 bind 前创建唯一 lifecycle coordinator、AbortController 与独立单调 deadline；第一次 signal/
  supervisor shutdown 立即 claim 并返回同一 Promise；
- bind 自身接收 signal/deadline；每个 startup await 后以及 scheduler/boot/tick 注册前复核 draining；
- prior owner recovery、recover hold、`Tier1Executor.recover()` 内部 kill/provision/active registration/spawn、
  inactive drain、permit 与 tick 使用同一 signal；
- `fatal > signal > restart` 始终可升级，直到所有 fallible pre-terminal work 收口后才 freeze；freeze 与唯一
  terminal frame/exit code 决策相邻；
- signal 后 gate/cleanup/ready IPC 失败必须唯一 fatal、零 stopped、非零退出；无故障 signal 才唯一
  stopped、exit 0；late settle/reject 全部消费。

### R7：recovery-only HTTP 与 ready IPC

当前 invalid JSON 写 400 后 resolve `{}`，业务链继续；真实 prebound ready 分支又 `void` 丢弃 send Promise。

必须：

- body parser 返回显式 handled/failed 判别，400 后 handler 立即 return；同一请求只写一次响应；
- normal 与 recovery-only、prebound 与 self-bind 统一 await 同一 ready sender；同步 throw、callback error、
  disconnect/rejection 全部进入唯一 lifecycle fatal；
- terminal frame 同样不得 fire-and-forget；IPC 失败零 unhandled rejection；
- 真实 `src/index.ts` child-process 测试覆盖 prebound ready rejection：恰好一个 fatal、零 stopped、非零退出、
  零残留进程。

### R8：recover AbortSignal 窗口

在 `killOrphanAgent`、`provisionWorktree`、inactive drain 等每个生产 await 后立即检查同一 signal；active/
owner 注册前、recoverAttempt/spawn/permit/tick 前再检查，并回滚预注册的非破坏性资源。测试 hold 必须放在
真实生产 await 内，确认 `recover-entered` 后发 shutdown，不得由测试主动 release 来帮助退出。

### R9：hostile unknown 统一投影

所有 startup、recover、gate listen、HTTP setup、fatal、DB close、audit、log、supervisor frame 路径禁止
直接 `String(unknown)`、`instanceof Error`、`.message`、`.code` 或 raw cause。复用 trap-free 固定 projector；
native Error/AggregateError、primitive、function、Symbol/BigInt、accessor、Proxy、revoked Proxy 均不能泄漏
`SECRET`、完整路径或在 catch 内二次抛错。保留 branded lifecycle Error 的私有 immutable snapshot，不能
扩大为信任任意 native Error message。

### R10：测试必须有真实杀伤力

除各节回归外，必须新增：

- 真实双进程 POSIX `flock` writer/reaper 与 crash release；Windows-only `LockFileEx` 对等测试；
- POSIX 同 PID 两代、null birth、旧 timer/signal/release；
- 真实 bind hold、recover 内部 hold、prior-owner-before-ready 顺序与 shutdown 后零 marker；
- real prebound ready rejection 与 invalid JSON 单响应/零业务调用；
- Windows x64/ARM64 typed ABI/sizeof/offset，实际 Node/UCRT argv，stdin/stdout/stderr/fd3 permit，并发
  handle whitelist，全部 rollback fault，exit/close 矩阵，handle-count 归零、零 suspended child、
  KILL_ON_JOB_CLOSE、membership unknown/final active 保留 owner；
- failure leaf、close/terminate/audit/unlink/IPC 使用完整数组和 exact count/order/identity；禁止
  `toBeGreaterThan*` 或宽松 `some/includes` 冒充结构合同。

Mac/Linux policy 或 Koffi mock 不能冒充 Windows native 通过；非 Windows 可以 skip 真机用例，但测试必须
在 Windows host 真正执行生产适配层。

### R11：NUL fail closed

Windows file、argv、cwd、env 和 command-line buffer 边界统一拒绝嵌入 NUL；加入纯函数与实际 native
negative case，证明输入不会被 CreateProcessW 截断。

## 3. Windows ABI 与 permit 原合同仍全部有效

不得只修 review finding 而回退已有要求：

1. Koffi 对 `SECURITY_ATTRIBUTES *`、`STARTUPINFOEXW *`、`PROCESS_INFORMATION *`、`OVERLAPPED *`
   等使用真实 typed pointer/buffer；可写 UTF-16 command line；DWORD/SIZE_T/HANDLE/ULONG_PTR 宽度正确。
2. 非支持架构 fail closed，不按 x64 硬解释 ARM64/x86。
3. `STARTUPINFOEXW` + `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` + `EXTENDED_STARTUPINFO_PRESENT` 只继承明确
   stdin/stdout/stderr/permit HANDLE；并发 spawn 不交叉继承 sentinel。
4. 若保留 fd3，严格镜像 Node 22/libuv/UCRT 的 32-bit count、flags、pointer-width HANDLE reserved2
   layout；若改 permit channel，仍必须 generation-bound 且保持
   `CREATE_SUSPENDED -> assign same Job -> membership/birth -> durable owner -> ResumeThread -> permit`。
5. permit 前 target 零执行，失败不可被 successor 消费。
6. Windows argv 使用完整 CRT 逆算法，覆盖空参数、Unicode、空格、quote、quote 前连续反斜杠和 trailing
   backslash，并叠加 R11 的 NUL 拒绝。

## 4. 回归优先顺序

按以下顺序施工，先让测试在 checkpoint 上真实红，再做最小实现使其绿：

1. R1/R3 generation + Job grammar/capability；
2. R2 跨进程 lock、完整 owner schema、audit/CAS；
3. R4/R5 Windows resource/exit 状态机；
4. R6/R8 lifecycle/abort/freeze；
5. R7/R9 IPC/HTTP/hostile projection；
6. R10/R11 真机门禁与 NUL；
7. 全量门禁与机械检索。

如果旧实现妨碍正确状态机，可以删除重写窄模块；不要在错误抽象上继续打补丁。每批编辑后逐项程序化
确认改动落盘，并检查测试确实会杀死对应旧缺陷。

## 5. 必跑门禁

严格串行；daemon Vitest 之间不得并发：

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

门禁后还要机械检索：

- 生产代码中的 ambient test switch；
- `taskkill`、裸 PID destructive fallback、延迟动态 PID capability 查询；
- 未消费的 ready/terminal IPC Promise；
- writer/reaper/release 绕过 shared HOME boundary；
- `String(err)`、`instanceof Error`、raw `.message/.code/cause` 等 hostile unknown 泄漏面；
- 当前 worktree 残留 daemon、fixture 或 test child。

任何命令失败先诊断根因；非配额失败不得换实现通道，不得缩小门禁。系统探针若在当前 macOS 无法执行，
如实标为“待 Windows host 验证”，同时确保 Windows-only 测试已真实接入生产路径。

## 6. 交付格式

保持工作树未提交。最终只报告：

1. R1-R11 的根因、最终设计与精确 `file:line`；
2. canonical 变更及 grammar 机械反例；
3. 每个回归在 checkpoint 的失败证据和修复后的通过证据；
4. 每条门禁的真实命令、exit、passed/skipped/failed 计数与 wall time；
5. Windows 真机待跑清单；
6. `git status --short`、完整 changed-file 清单与残留进程检查。

测试全绿不等于自动通过。交付后还要接受两个全新零上下文 subagent 与一个 Codex
`gpt-5.6-sol`/`max` 对抗评审；本会话不得自行宣称发布 Go。
