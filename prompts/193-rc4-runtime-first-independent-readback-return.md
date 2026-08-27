# RC4 runtime 第一轮独立 readback 返工

这是当前实施会话的第一轮独立 readback 返工。继续在当前工作树施工；不要另开 worktree，不要提交、推送、打 tag 或发布。

当前 HEAD 仍是检查点 `c3f8aa58c37be854b7fe4e79e34cc21f6ac598c3`，其后的未提交 product/test diff 是你上一轮的实施。两路零上下文独立审查与一次外部 Codex 对抗审查均给出 No-Go。不要读取 `logs/**`、`prompts/**`、`research/**` 或历史 review；下面已经是去重后的完整返工清单。先核对 canonical 与生产调用链，再做最小且完整的修复。

## 验收目标

### A. Windows Job / process identity 原子性

1. `killOwnedTree` 终止前必须证明当前同一 process handle 确实属于当前同一 Job handle。`IsProcessInJob=false` 时不得用 Job 内 PID 数组做数值回退；leader 已死且 active Job 的 membership 不是明确 `true` 时一律 fail-closed、保留 owner。
2. `TerminateJobObject` 和 drain 后，最终观测只有完整证明 `after.kind === "already_exited"` 才能成功。birth、membership、active count 任一 unknown/mismatch、Job 再次 active、leader 仍活等均抛受控 lifecycle error；调用方不得 audit/delete owner。
3. Windows 子进程从创建到 Job assignment、birth、membership 与 durable owner 发布必须使用同一个原始 process handle，不得在 `spawn -> PID -> OpenProcess -> close -> PID -> OpenProcess` 间留下 PID reuse 窗口。需要 suspended spawn/native creation 或等价、可证明的同 handle 方案；不得用前后按 PID 探测伪装成原子性。保持现有 wrapper permit、stdio、rollback 与 handle close 语义，所有失败 fail-closed。
4. Windows 的 soft/hard termination 均只能操作 lease 捕获的精确 Job generation。禁止 `process.kill(pid)`、`child.kill(signal)` 或其它裸 PID destructive fallback；Job 缺失、操作失败或 identity 不完整时污染 lifecycle、保留 owner、进入 fatal。退出至 close、迟到 timer 等窗口也不得再发信号命中复用 PID。
5. `runtimeJobs` 不能仅以 PID 表示 generation。每个 lease 必须捕获精确 `{ownerInstanceId, runId, processStart, jobName, job/process handle}` 或等价不可复用身份；map replacement、teardown、close、owner delete 都做 identity CAS。A 的迟到 `release()` 绝不能 teardown B 的 Job 或删除 B 的 owner。
6. destructive runtime owner parser 必须 trap-free 且只接受：正整数 pid、`ownerPid > 1`、非空有界 kind、非空 ownerInstanceId/runId、非空 birth、绝对且非空 binary、trim 后非空并符合生成 grammar 的 commandToken，以及严格 Job identity。pending owner 如需 `processStart:null`，使用独立的不可 destructive schema。原生 `GetProcessTimes` 失败必须投影 unknown/throw，不能折叠为 process absence。POSIX command identity 按 argv/token 边界匹配，不能依赖宽松 substring；纯空白 token 必须拒绝。
7. 保留并回归验证 `CreateJobObjectW` 后立即读取 `GetLastError`、遇 `ERROR_ALREADY_EXISTS` 关闭 handle 并拒绝 attach 的现有正确行为。

### B. owner generation、恢复与条件删除

8. CLI emergency reaper、restart policy、daemon runtime registry 统一复用上面的原子 primitive，不得自行拼装宽松探针。引入 home-scoped、daemon 启动与 reaper 都遵守的互斥/租约，使 owner 读取、generation 验证、回收、audit、条件删除处于可证明的临界区；删除前必须 identity CAS，不能删除新一代同路径 owner。
9. 新 daemon 在 ready、recover、claim/dispatch 前，持有该边界并扫描所有 prior-generation runtime owners；只在旧 owner generation 已确认死亡且精确 identity 可验证时回收，audit 成功后条件删除。unknown、audit failure、generation 仍活或不完整一律保留 owner并 fail-closed。

### C. startup / shutdown / gate / IPC 的真实受控收口

10. startup 收到 `prepareShutdown`、signal 或 disconnect 时必须立即原子进入 draining、停止 claim/dispatch，并启动同一个有界收口；gate bind、recover 及其内部 spawn 接入同一 `AbortSignal`。每个 startup await 后及任何 recover/tick/spawn 前重检，不能在 shutdown intent 后新建 Tier1 owner/进程，也不能等 recover 永久返回后才启动 deadline。
11. POSIX 与 Windows gate handle 都要暴露受控的 post-bind failure（例如 referenced `failed` promise）；异步 error 不能由永久空 handler 吞掉。初始化失败必须等待 listener close；close/abort/post-bind error 竞态只能 settle 一次且不留无引用 listener。request/handler/close 的 hostile unknown 必须通过共享 trap-free 固定投影，不能 `String(err)`、`instanceof Error` 或读取 hostile `.message`，原文不能进入 JSON、日志、audit、IPC 或 stack。
12. supervised 模式的 supervisor IPC 缺 channel、同步 throw、callback error 都必须是 branded rejection。`stopped` 未真实发送成功不得 exit 0，必须转 fatal/nonzero；late callback/rejection 被消费。recovery-only 入口复用同一严格 sender、共享 projector 与 bounded cleanup，不再复制宽松 helper；reaper、DB close、logger、fatal frame 遇普通 Error secret、accessor/Proxy/revoked Proxy 都不得泄漏或二次 trap。
13. `promotePendingCliRuntime` 的 pending registry 清理失败在产生 `cleanupError` 的 catch 内即投影成固定受控错误；日志/audit 只包含 stage、code allowlist 或 path digest，不含原始文件错误、secret、用户名或完整路径。
14. 删除生产入口中的 `SAYDO_TEST_RECOVER`、`SAYDO_TEST_CLOSE_DURABLES` 等 ambient test switch。测试注入必须通过明确的 composition/dependency injection，生产默认 wiring 不接受环境变量改变语义。

### D. 真实测试门禁

15. 删除或明确降级任何复制 lifecycle helper 的伪“entry” harness。新增 child-process/composition 测试必须调用真实共享生产 composition，覆盖并断言副作用：
    - bind/recover 期间收到 shutdown 后不 recover、不 spawn、受 deadline 收口；
    - recovery-only hostile reaper/DB/IPC failure trap-free、无原文、fatal/nonzero；
    - 真实 DB adapter close failure不发送 stopped、不 exit 0；
    - gate post-bind error、close/abort race、listener 清理；
    - final observe unknown/再次 active；
    - membership=false 的同名活跃 Job；
    - PID successor 与旧 lease 迟到 release；
    - Windows SIGTERM、TerminateJob failure、exit-to-close timer 均无裸 PID fallback；
    - generation 替换期间旧 reaper 不能删除新 owner；
    - prior-generation owners 在 ready 前恢复。
16. Windows-only native tests 不得因只设置 `processBirth` 就切换整个 virtual Job seam。seam 单测可保留，但必须清楚标成 wiring test；另加无 partial hooks、直接穿过 Koffi/native API 的 Windows 真机用例，供后续 Windows SSH 门禁运行。Mac 上允许明确 skip，不得伪报 native 已验证。

## 实施约束

- 不得回退当前已正确的 `ERROR_ALREADY_EXISTS`、同 handle recovery session、audit-before-delete、independent hard deadline、activation/rollback/database fixed projection 等行为。
- 所有 unknown 边界都要 trap-free；不扩大对任意 native `Error.message` 的信任面。
- 不用 sleep 拉长测试；使用确定性 barrier/fake clock/child IPC。
- 不做与上述问题无关的重构。
- 如果同一原始 process handle 的 Windows 创建方案确实需要新增 native adapter，就完整实现并验证 handle ownership/close 次数；不要留下“稍后再做”的 PID 方案。

## 必跑门禁

先跑直接相关的精确用例，再跑：

1. `pnpm --filter @saydo/platform test`
2. `pnpm --filter @saydo/cli test`
3. daemon 的 runtime child registry、Tier1 executor、BYOA、restart policy、startup failure、gate socket、shutdown lifecycle、recovery-only 精确测试
4. `pnpm --filter @saydo/daemon test`
5. `pnpm typecheck`
6. `pnpm lint`
7. `bash scripts/check-emoji.sh`
8. `git diff --check`

任何失败都要定位并修到绿，不得删测试或放宽断言换绿。结束时报告：逐项修复映射、实际命令及 exit code/测试计数、Windows 真机仍待跑的用例、`git status --short`。保持所有修改未提交，等下一轮独立 readback。
