# RC4 运行时复审红灯整改实施单

## 1. 目标与基线

在当前工作树继续实施。基线提交为
`30d37999846255ec507af6c139478c34cd64010a`，工作树还包含
`prompts/99-rc4-f107-readline-error-review-fix.md` 对应的未提交 readline 修复；必须保留并把它纳入本轮完整修正。

本轮只处理已经由独立运行时复审证明的进程生命周期、pipe error、Windows 测试真实性和 signal 去重红灯。
不得改版本、发布文档、workflow、证据，不得 commit、push 或 deploy。

## 2. 必修合同

### A. 移除 Windows 测试假绿

- 删除 `packages/daemon/test/setup.ts` 中全局注册的 `uncaughtException` / `unhandledRejection`
  ECONNRESET/EPIPE 吞错逻辑。测试不得靠进程级 blanket handler 变绿。
- `setup.ts` 的 Windows cleanup 第二轮仍为 EBUSY 时必须 rethrow 令 suite 红灯，不能静默返回。真实 Windows 外层门
  记录本轮唯一 testRoot/tmpRoot exact-set，并在测试 worker 退出后断言全部不存在，不能只信 in-process afterAll。
- `tier1-executor.test.ts` 的 OWNER_TEST_ROOT cleanup 与 `test/global-tmp-cleanup.ts`/teardown 也不得 catch-all 吞删除失败；
  cleanup 失败必须使对应 suite/外层门红。外层按本轮唯一前缀/显式路径逐项做进程退出后的 exact absence 断言，
  禁止清扫器把资源泄漏伪装成测试通过。
- 相关生产对象必须各自在 ownership boundary 消费预期 pipe error；未预期错误必须进入可观察、可判定的失败结果。
- `packages/daemon/test/tier1-executor.test.ts` 的 Windows `pnpm.cmd` 不得手写标准 shim 内容。
  测试必须从一个本地 fixture package 通过本机 npm 的正常 install/link 流程生成实际 `node_modules/.bin/*.cmd`，
  再让生产解析/启动路径执行该 shim；禁止联网，fixture 与安装结果随测试回收。Windows 不得用
  `execFileSync("npm", ...)` 假设 `.cmd` 可直接执行，应复用仓库已有 `process.execPath + npm-cli.js` 的可靠调用形态。

### B. main agent 与 managed command 的 terminal ordering

- main agent 的 `readline.Interface`、stdout、stderr 同一个底层 Error 要幂等消费；不得 uncaught、重复诊断或重复 settle。
- 只有终止/退出收口窗口内的 `ECONNRESET` 可以忽略；活动期 ECONNRESET 失败，任何阶段的
  EPIPE/EIO/未知错误都必须留下脱敏有界诊断并使最终结果失败。
- pipe failure 必须是 durable latch。成功不得只等待 child `exit`：至少同时等待 child `close`/stdio terminal
  与 process group `gone`，然后再由 pipe failure latch 覆盖最终 exit code。
- 等待 child `close`/stdio terminal 自身也必须有独立单调 hard deadline；wrapper 已 exit 但后代继承 pipe 时 close
  可能永久不来，不能因此永远到不了 group drain。超时须 typed lifecycle contamination、保留 owner、fatal/nonzero，
  并清 timer/listener；对 exec/main/managed/BYOA 各适用路径注入 `exit emitted, close withheld` 反例。
- 必须以真实顺序注入回归：`exit -> EPIPE/EIO -> close` 最终失败；
  `exit -> ECONNRESET -> close` 最终成功；活动期错误最终失败。不得只直接单测 helper 冒充端到端收口。
- `runManagedCommand(captureStdout=false)` 的业务层不得给不存在/ignore 的 stdout 再挂 `data` 或 error handler，
  不得收集 tail；ignore stdio 的底层 pipe/permit 防护只由 `spawnRuntimeChild` ownership boundary 负责。
- `captureStdout=true` 使用与上述相同的 durable terminal 判定。

### C. kill 与 command timeout 必须是真正硬上界

- main agent handle `kill()` 和 `runManagedCommand` 在 TERM -> KILL 后，即使 direct child 永远不发
  `exit`/`close`，`wait()` 也必须在有界 drain deadline 内 reject `ProcessGroupLifecycleError`，不得永久占用 active run、
  并发槽或让 `options.timeoutMs` 失真。
- deadline 到达时必须清 timer/listener；process group 非 `gone` 时不得删 durable owner，留给 reaper。
- agent、managed、BYOA、exec helper 与 wrapper 的 kill/drain 硬上界统一使用单调时间源或独立 deadline timer latch；
  系统 wall clock 回拨不得延长收口。补 now 回拨/注入 timer 反例。
- `beginRuntimeChild.establish`、`establishAgentOwnership` 的 birth/ownership wait 以及 resume claim wait 也使用同一
  单调 deadline；birth probe 永远 null + wall clock 回拨时仍须有界拒绝，随后完成 kill/drain，并按权威 group 状态
  保留或清理 owner，不能卡在已 spawn 但 permit/owner 未完成的半事务。
- managed lifecycle failure 不得被 provision/snapshot/verify 的普通 catch 降成 blocked/exit1。`runManagedCommand`
  必须先污染 Tier1 lifecycle，或所有调用边界对 typed error 立即 rethrow；contamination 后 `tick/claim` 拒绝新工作，
  shutdown 进入既有 fatal，不能写正常业务终态。补 managed drain timeout 后不落正常终态、不再 spawn 的断言。
- `establishAgentOwnership` 失败清理不得用 `proc.wait().catch(() => undefined)` 吞 typed drain failure；若 wait 返回
  `ProcessGroupLifecycleError`，它必须优先上浮/污染 lifecycle。只有 wait 已证明 group gone 才可重抛原始 ownership 错误。
  补 ownership 建立失败 + wait lifecycle fail 反例。
- 补可注入反例覆盖“TERM、KILL 都发出但 child 不发 exit/close”的最终有界失败。不能靠真实悬挂 5 秒拖慢套件，
  应使用注入 clock/timer/group probe 或项目既有可控夹具。

### D. `execRuntimeChild` 的 exit-to-close 窗口

- 新增 `exiting` 状态，child `exit` 后、`close` 前属于 terminating；该窗口 ECONNRESET 可忽略。
- 同窗口 EPIPE/EIO/未知错误仍由 pipe failure latch 令最终 Promise reject。
- 覆盖 `exit -> ECONNRESET -> close` 成功和 `exit -> EPIPE/EIO -> close` 失败；活动期 ECONNRESET 失败。
- group drain alive/unknown/Job readback failure 必须抛 typed runtime lifecycle failure，并设置 durable/global runtime-child
  contamination；即使 self-test/setup/memory 等业务入口捕获并返回业务失败，也不能清掉 contamination。
- contamination 后拒绝新 runtime jobs；daemon shutdown 在发 `stopped` 前必须同时核对 contamination 与 registry/Job
  exact empty/all gone，失败走 fatal/nonzero 并保留 owner。不能因 shadow promise `allSettled` 后从集合移除就宣称收口。
- 补 helper 忽略 TERM/KILL 及 group unknown 反例：业务层可返回 fail，但 lifecycle 已污染、后续拒新 job、shutdown
  不发 `stopped`；正常 helper close + group gone 后 registry/Job exact empty。

### E. BYOA 必须有界且分类正确

- `packages/daemon/src/providers/byoa/runner.ts` 对所有 `runtimeProcessGroupState(pid) !== "gone"`
  （包括 `alive` 和 `unknown`）使用统一 drain deadline；TERM/KILL 后仍不 gone 时必须 fail-closed 收口为独立
  lifecycle failure，清除 wall/idle/kill/drain timer、Abort listener和占用的并发槽。
- state 非 gone 时调用 `lease.release()` 必须保留 durable ownership record，交给 reaper；不得谎报 group 已消失。
- BYOA drain deadline/unknown 不能只转成普通 `SpawnAttemptResult` 后让全局 drain 误认为已 settle。必须用 typed
  lifecycle failure/全局 BYOA contamination 向 `abortAllByoaInvocations()` 与 daemon shutdown 传播：存在仍存活或
  unknown 的 durable BYOA owner 时绝不发送 `stopped`，必须进入既有 fatal/nonzero 收口；正常请求侧也要锁住后续
  新运行并触发受管重启/恢复，不能一边留下未知进程一边继续成功服务。
- BYOA `child.on("error")` 只有在可证明 never-spawned/pidless 时可直接 finish；已经有 pid/ownership 后的 error
  只 latch fault + requestStop，最终仍须等待 close 与 all-state bounded group drain，并传播 typed contamination。
  覆盖“spawn 后 child error + group alive/unknown”反例。
- 活动 pipe error 使用独立字段/类别，不得复用 `spawnError`。它不属于启动或网络错误：最终 API
  `retryable:false`、attempts=1、审计 `voidReason="pipe_failed"`，且审计不得记录不受信原始错误文本。
- 分别注入 `alive`、`unknown` deadline 反例，以及活动 pipe error 反例；断言 Promise 有界 settle、槽释放、
  durable owner 保留、不可重试分类与审计正确；并断言随后 shutdown 不会发 `stopped`。

### F. `SignalQueue` 使用单调时间

- 默认 clock 使用单调时间源，不能用 wall clock `Date.now()`。
- 即使注入时钟回拨，负 delta 也不得把真实第二次 signal 无限吞掉；只对
  `0 <= delta < OS_SIGNAL_DEDUP_WINDOW_MS` 去重。
- 保留现有 50ms 合同，并补时钟回拨后第二次 signal 被保留的回归。
- 修复启动期双消费者：当前首个 signal 胜出后外层预取一次 `signals.next()`，而 `shutdownDuringStartup()`
  又读取一次，导致真正第二个原因被一个不参与任何 race 的 Promise 吞掉。启动分支只能由
  `shutdownDuringStartup` 唯一消费第二原因；同步排入首/次原因后，次原因必须触发 emergency。
- 分别覆盖不同 OS signal、超过 50ms 的同 signal、以及 cli-stop/control 作为第二原因；测试要制造
  “首个 pending 已 resolve、启动分支尚未处理”窗口，证明第二原因没有被预取丢失。
- CLI `probeStartupRace` 的启动 retry deadline 与 restart fuse 也使用同一可注入单调时钟；wall clock 回拨/前跳
  不得让启动探测无限循环，也不得清空真实 restart storm 或长期保留过期记录。分别补 rollback/forward-jump 回归。

### G. 同类边界巡检

- 对本轮触及的 `createInterface`、child stdout/stderr/stdin、`exit`/`close`、TERM/KILL/group probe
  同类路径完整检索；发现相同的 uncaught、terminal ordering、无界 drain 或错误重试分类时一并做最小修正并补测试。
- Windows `spawnRuntimeChild` 的 spawn -> named job assign -> durable owner 登记前段必须事务式收口：若
  `assignPidToJob`/OpenProcess/AssignProcessToJobObject 抛错，先给 stdio/permit 安装本地 error consumer，再关闭无数据
  pipe、kill wrapper、close job，并确保没有 wrapper、handle 或 owner 残留。补 Windows 可注入 assign failure 回归；
  不得依赖测试进程级 exception handler。
- `runtimeProcessGroupState()` 的 Windows 分支必须把非权威 probe 异常收敛为 `"unknown"`，不得让 timer drain 或
  `lease.release()` 的回调抛出未捕获异常；EPERM 仍按现有权威语义视为 alive。注入 processAlive/native probe 异常，
  断言不 uncaught、durable owner 保留并在 deadline 后 fail-closed。
- Windows 的 group state / lease release 不得只看 wrapper PID：以 named Job active-process readback 为权威，
  wrapper 已退但目标/孙进程仍在 Job 时仍是 alive。不得先删 durable owner 再 `closeNamedJob()`；必须先终止/关闭并
  有界确认 Job/PID 全归零，最后才删 owner。Job readback/close/native 异常时返回 unknown/lifecycle failure 并保留
  durable owner。补 Windows 真实夹具持有孙进程，断言命令结果/stopped 返回时全部相关 PID 已不可存活；并补 native
  异常保留 owner 反例。
- Windows SIGKILL/stop 不得以“先 CloseHandle 并删除 runtimeJobs mapping”冒充 group gone；应在保留可查询 Job handle
  与 owner 的前提下 terminate Job，再轮询 active-process=0，之后按上条顺序 close/delete。若只能 close 才能触发
  KILL_ON_JOB_CLOSE，则必须另保留可权威 readback 的句柄/锚并确认后代归零，不能退回只查已退出 wrapper PID。
- 防止 wrapper PID 复用覆盖仍有孙进程的旧 Job/owner：发布 `runtimeJobs` entry 与 owner 前必须检测同 PID 旧 entry；
  旧 Job 未权威 empty 时拒绝新 spawn、保留旧 handle/owner并污染 lifecycle，或者改用 commandToken/jobName 主键且 PID
  只作受校验索引，禁止 silent overwrite。`closeJobHandleWin32` 也只能在 `CloseHandle` 明确成功后把 handle 置空；
  close 失败保留可重试句柄与 owner并抛 typed lifecycle failure。补 PID reuse/CloseHandle failure 注入回归。
- Windows Job 权威必须贯穿 CLI `emergencyReaper` / platform `killOwnedTree`：owner 含 jobName 时以 Job
  active-process readback 为权威，wrapper PID/birth 仅作辅助；dead leader PID 被复用时不得因此拒绝清理合法旧 Job。
  terminate 后等待 Job exact empty 才删 owner，query unknown 保留 owner并红。真实 Windows 覆盖 wrapper 退、孙进程留
  Job、PID probe dead/模拟 reused：reaper 返回时孙进程 gone、owner 删除；query unknown 时不删。
- daemon 非 supervised self-restart 与正常 shutdown 共用单一单调、一次性总 deadline；unsupervised restart 不得裸
  `await drainRuntime("restart")` 永久停在 draining。任何 dialog/BYOA/runtime job/agent completion 不 settle 或总 deadline
  到期都统一 fatal/nonzero、不发 stopped、不 spawn 新代。总 deadline 不得在每阶段用 `Date.now()` 重算，且 work
  先完成时要清 timer。测试冻结/回拨 wall clock 与永不 settle drain，断言硬上界。
- BYOA 的 stdin 是承载 prompt 的业务 pipe，不能无条件吞 `child.stdin` error。它必须与 stdout/stderr 使用同一 durable
  规则：只有 terminating 窗口的 ECONNRESET 可忽略；活动期 ECONNRESET 与任何阶段 EPIPE/EIO/未知错误都锁存
  `pipeFailure`，覆盖 child exit 0，并走 `pipe_failed`、attempts=1、不可重试、脱敏审计。pipe failure 的分类优先于
  safety/network/schema/unknown 及 `resume_not_found` 等所有 retry 分支，不能先启动第二个进程再发现 latch。
- `execRuntimeChild` 的 AbortSignal 必须 durable 锁存：pre-aborted 时零 spawn；active abort 后即使目标捕获 TERM 并 exit 0
  也必须拒绝，且仍完成 bounded close/group drain 与 exact cleanup。补 `trap TERM -> exit 0` 反例。
- `runManagedCommand` 的 timeout 回调不能只调用 `handle.kill()`；必须单独锁存 `timedOut`，命令捕获 TERM 后 exit 0 仍按
  timeout 失败，且与 shutdown/cancel 的 kill reason 区分。补捕获 TERM 后 exit 0 的 setup/verify 反例。
- daemon `restartPolicy.reapOwnedTier1Agent` 在 Windows 必须 Job-first；`killOwnedTree` 已按 Job 收口后不得再按 PID 循环，
  以免 PID reuse 误超时或误杀。owner 含 jobName 时由 Job active count 权威判定；Windows owner 缺 jobName、或 owner
  文件存在但内容 invalid 时不得当作 absent/already_exited，必须保留并 fail-closed。
- lifecycle contamination 与总 deadline 必须同时接入 normal composition root 和 recovery-only composition root；尤其
  `recoveryOnlyServer.ts` 的 unsupervised restart 也不能裸 await `closeAfterDrain`。两条路径都要在发送 stopped/启动新代前
  核对当前 generation registry 与 Windows Jobs exact empty，失败统一 fatal/nonzero。
- 不扩展到无关重构。

## 3. 验收门禁

以下命令必须在当前工作树真实执行并以退出码 0 收口；某项若因 sandbox 的真实平台限制失败，保留完整输出并明确报告，
不得把失败写成通过：

1. `pnpm --filter @saydo/cli exec vitest run test/supervisor.test.ts --reporter=dot`
2. `pnpm --filter @saydo/cli typecheck`
3. `pnpm --filter @saydo/daemon exec vitest run test/runtime-child-registry.test.ts test/byoa.test.ts test/byoa-fake-cli.e2e.test.ts --reporter=dot`
4. `pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts --reporter=dot`
5. `pnpm --filter @saydo/daemon typecheck`
6. `rg -n 'uncaughtException|unhandledRejection' packages/daemon/test/setup.ts` 必须无匹配；先确认 `rg` 自身成功执行，
   无匹配退出码 1 是本条预期。
7. 程序化确认本轮所有新增 deadline 反例真实执行而非 skip。

## 4. 交付要求

- 直接实施；不提交、不推送、不部署。
- 最终列出真实改动文件、每条门禁命令、退出码与未经美化的通过/失败摘要。
- 若任何合同无法在不改变产品语义的前提下判定，停止该项并报告精确冲突；不得静默选择。
