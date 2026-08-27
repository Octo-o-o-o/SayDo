No-Go

已核对基线：`GIT_OPTIONAL_LOCKS=0 git rev-parse HEAD` 返回 `c3f8aa58c37be854b7fe4e79e34cc21f6ac598c3`。

## P0

1. Windows 在途子进程终止仍可绕过 Job，按复用 PID 杀错进程。

   - 路径：[runtimeChildRegistry.ts:379](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:379) 对 Windows 仅 `SIGKILL` 使用已持有 Job；`SIGTERM` 在 392–396 行调用 `process.kill(pid)`。Tier1 与 managed executor 在 [executor.ts:331](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/tier1/executor.ts:331) 和 [executor.ts:1878](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/tier1/executor.ts:1878) 遇 Job primitive 失败还会回退到 `child.kill(pid)`；BYOA 同样见 [runner.ts:204](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/providers/byoa/runner.ts:204)。
   - 复现路径：原 leader 退出、Job 映射尚未 release，PID 被无关进程复用；shutdown/timeout 发 `SIGTERM`，直接命中新进程。或者 `TerminateJobObject` 失败后 fallback 命中复用 PID。
   - 违反：[09 §16.3:1618](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/docs/09-data-contracts.md:1618) 的 identity-matched 整组回收与 fail-closed，以及 [ADR-003:42](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/docs/adr/ADR-003-os-adapters.md:42) 的 Windows Job-only 边界。
   - 最小修复：Windows 所有 TERM/KILL 都只操作原始 Job handle；Job 不存在或操作失败即污染 lifecycle、保留 owner、fatal，禁止 `process.kill`/`child.kill` fallback。

2. `killOwnedTree` 会终止明确不包含该 process handle 的活跃同名 Job。

   - 路径：[process.ts:356](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:356) 在 `IsProcessInJob` 为 false 后回退数值 PID 列表；[process.ts:472](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:472) 对 `leader dead + birth exact + active>0` 不检查 `member===true`，仍返回 `live-owned`；随后 [process.ts:798](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:798) 终止该 Job。
   - 可确定复现：native seam 返回 `birth=expected`、`alive=false`、`active=1`、`member=false`，生产 `killOwnedTree` 会调用 `terminateJob`。真实场景是旧 Job 消亡后同名 Job 被重建。
   - 违反：§16.3 只允许回收 identity 仍匹配的整组；数值 PID 和同名 Job 均不是 generation proof。
   - 最小修复：删除 PID-list membership 回退；活跃 Job 只有在同一 process/job handle 上 `IsProcessInJob===true` 才可终止。leader 已死而 membership 无法证明时必须保留 owner。

## P1

1. Windows spawn、Job assignment、birth 持久化跨了不同 process handle，仍有 PID-reuse TOCTOU。

   - 路径：[runtimeChildRegistry.ts:872](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:872) 用 Node `spawn`，随后只传 PID 到 [runtimeChildRegistry.ts:925](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:925)；[win32.ts:594](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:594) 重新 `OpenProcess`、assign 后关闭；birth 又在 [runtimeChildRegistry.ts:627](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:627) 按 PID 重开查询。
   - 复现路径：wrapper 在 assign 前退出并发生 PID 复用；新进程会被 assign，随后其 birth 被持久化为 SayDo owner。
   - 违反：§16.3 的 durable identity 与本次验收要求的同一 process handle。
   - 最小修复：Windows 使用能返回原始 process handle 的 suspended spawn；同一 handle 完成 assign、birth、membership、owner 持久化后再 resume/permit。

2. runtime owner 的不完整 birth 和原生 birth 探测失败仍可进入删除或杀进程路径。

   - [jobIdentity.ts:173](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/jobIdentity.ts:173) 接受 `processStart:null`，也接受空 `kind` 和非正 `ownerPid`。
   - [emergencyReaper.ts:296](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/src/emergencyReaper.ts:296) 对 null birth 读取“当前”birth，再把它当 `expectedBirth` 执行 kill；这不是 durable birth proof。
   - [win32.ts:714](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:714) 将 `GetProcessTimes` 失败折叠成 `null`；[process.ts:501](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:501) 会把 `alive=false + birth=null + Job empty/missing` 投影为 `already_exited`。
   - 违反：§16.3 要求完整 birth/owner/runtime identity，任何探测错误均保留 owner。
   - 最小修复：destructive parser 只接受非空 birth、`ownerPid>1`、非空有界 `kind`；pending 使用独立、不可 destructive 的 schema。`GetProcessTimes` 失败返回 `unknown`/throw，不能返回 absence。

3. TerminateJob 后的 fail-closed 复核被当作成功。

   - 路径：[process.ts:820](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:820) drain 后再次 `observe()`；[process.ts:825](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:825) 只拒绝 reason 含 `still alive` 的 fail-closed。birth/membership/active probe unknown 或 mismatch 会静默成功，调用方随后 audit 并删 owner。
   - 违反：§16.3 的 probe error/drain uncertainty 必须保留 owner。
   - 最小修复：终止后仅接受完整 `already_exited` 证明；任何 `after.kind==="fail-closed"` 都应抛出并保留 owner。

4. generation 校验与 owner 删除未串行化，可删除下一代 owner。

   - 路径：[emergencyReaper.ts:239](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/src/emergencyReaper.ts:239) 和 [emergencyReaper.ts:292](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/src/emergencyReaper.ts:292) 只校验首次读取的内存快照；[emergencyReaper.ts:150](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/src/emergencyReaper.ts:150) audit 后无条件 `rmSync(path)`。
   - 复现路径：旧 reaper 完成校验后，新 daemon 在同一路径写入新 generation owner；旧 reaper 随后删除新文件。[supervisor.ts:175](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/src/supervisor.ts:175) 的 lock 校验 helper 没有生产调用。
   - 违反：generation mismatch/identity incomplete 必须保留 owner。
   - 最小修复：引入 daemon 启动也遵守的 home-scoped reaper lock，把读取、验证、回收、audit、条件删除置于同一临界区；单纯删除前重读仍存在 check/unlink 竞态。

5. 上一代 runtime owners 没有启动恢复入口。

   - 路径：[index.ts:300](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:300) 取得 instance lock 后只调用 `configureRuntimeChildRegistry`；该函数在 [runtimeChildRegistry.ts:485](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:485) 仅赋全局变量。supervisor reaper 始终传当前 generation，而 CLI 在 292–293 行跳过旧 generation。
   - 复现路径：旧 supervisor 与 daemon 同时崩溃，留下 `runtime/children/*.json`；新 daemon 可以继续走到 ready，POSIX 子树也可能仍活着。直到 shutdown 的 exact-empty 才在 [runtimeChildRegistry.ts:474](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/runtimeChildRegistry.ts:474) 失败。
   - 违反：§16.3 的异常出口扫描同一 registry，以及 §16.4 的 recover 先清理旧进程组。
   - 最小修复：持有新 instance/reaper lock 后、ready 与任何 dispatch 前扫描全部 prior-generation owners；逐条验证旧 generation 已死，用原子 primitive 收口并 audit 后条件删除。

6. startup 收到 shutdown 后仍可能执行 `Tier1Executor.recover()` 并拉起 agent。

   - 路径：[index.ts:3891](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3891) 在 startup 未 ready 时只登记 intent；Tier1 只在 [index.ts:3567](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3567) 检查一次 `runtimeDraining`。若 shutdown 在随后 gate bind await 期间到达，[index.ts:3639](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3639) 无二次检查，仍执行 `recover()`。
   - 违反：[09 §16.4:1629](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/docs/09-data-contracts.md:1629) 要求 draining 首先停止 claim/dispatch。
   - 最小修复：startup 使用单一 `AbortController`；prepare/signal 立即 abort；传给 gate/recover，并在每个 startup `await` 后及任何 spawn 前复核。

7. gate 的 post-bind error、初始化 close 与 hostile unknown 没有形成受控 fatal 边界。

   - POSIX 在 [gateServer.ts:140](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/tier1/gateServer.ts:140) 用永久空 handler 吞掉异步 error。
   - Windows 在 [gate.ts:131](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/gate.ts:131) bind 后移除唯一 error listener；写 bind/secret 失败时 [gate.ts:151](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/gate.ts:151) 只调用未等待的 `server.close()`。
   - Windows request/handler catch 在 [gate.ts:114](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/gate.ts:114) 直接 `String(err)`，revoked Proxy 可再次抛错，错误原文也会进入 JSON。
   - 生产确实从 [index.ts:3624](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3624) 使用这些路径。
   - 违反：§16.3 的 listener 受控清理、fatal/nonzero，以及 hostile unknown 不进入 JSON/日志。
   - 最小修复：gate handle 暴露永久 `failed` promise；post-bind error 原子关闭 ingress 并触发 fatal lifecycle；初始化 reject 前等待 close；所有 unknown 使用 trap-free 固定投影。

8. supervisor IPC 失败被折叠为成功；recovery-only 同时仍有 hostile unknown 泄漏和二次 trap。

   - [supervisorIpc.ts:10](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/supervisorIpc.ts:10) 对缺失 channel、callback error、同步 throw 全部 resolve；因此 [index.ts:3839](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3839) 可以在 `stopped` 实际发送失败后 `exit(0)`。
   - recovery-only 复制了宽松 sender，并在 [recoveryOnlyServer.ts:182](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:182) 和 [recoveryOnlyServer.ts:334](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/api/recoveryOnlyServer.ts:334) 直接 `String`、`instanceof Error`、`.message`；revoked/accessor Proxy 会在 fatal handler 内再次抛出，原文也可进入 logger/IPC。
   - 违反：§16.3 的 stopped/fatal 真实性和题设 hostile unknown 边界。
   - 最小修复：受监管模式将 send error/missing channel 作为 branded rejection；正常 shutdown 转 fatal/nonzero。recovery-only 复用同一个严格 sender 和 trap-free projector。

## P2

1. 新增测试没有完整覆盖其声称的生产 wiring。

   - [startup-failure.test.ts:513](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/startup-failure.test.ts:513) 的“真实 gate bind + recover 失败”启动的是 fixture，不是 `src/index.ts`；fixture 在 [startup-entry-harness.ts:106](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/fixtures/startup-entry-harness.ts:106) 手工抛错，并在 133–154 行复制 cleanup/exit 编排，没有调用真实 `Tier1Executor.recover()`。
   - Windows “leader dead” 测试在 [emergency-reaper.test.ts:328](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/cli/test/emergency-reaper.test.ts:328) 只注入 `processBirth`；但 [process.ts:199](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:199) 会因此把整个 Job 操作切到 virtual seam，缺少 `jobActive` 后直接 unknown，无法验证真实 native Job。
   - runtime Job 测试只覆盖 `SIGKILL`，见 [runtime-child-registry.test.ts:619](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/test/runtime-child-registry.test.ts:619)，未覆盖本次 P0 的 Windows `SIGTERM`/fallback。
   - 最小修复：child-process 测试启动真实 `src/index.ts` composition；补 Windows native SIGTERM、Job failure、PID reuse、副作用测试。fixture 测试只能标为函数级集成。

2. 为测试新增的 ambient env 开关直接进入生产入口。

   - [index.ts:3636](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3636) 的 `SAYDO_TEST_RECOVER=reject` 可在生产禁用 executor；[index.ts:3738](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/daemon/src/index.ts:3738) 的 `SAYDO_TEST_CLOSE_DURABLES=reject` 可强制正常 shutdown 失败。
   - 复现只需 supervisor 环境中存在相应变量；其中 recover 开关并未被新增真实入口测试使用。
   - 违反：生产与测试 wiring 隔离，构成确定的可用性回归。
   - 最小修复：通过测试专用 composition/dependency injection 注入失败，不在生产入口读取 `SAYDO_TEST_*`。

## 已核对且未发现缺陷的关键边界

- `CreateJobObjectW` 前清空 LastError，并在返回后立即读取；`ERROR_ALREADY_EXISTS` 会先关闭 handle 再拒绝 attach：[win32.ts:571](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/win32.ts:571)。
- `killOwnedTree` 单次 session 确实只打开一对 process/Job handles，birth、active、membership、terminate、drain 均使用该对 handles，finally 关闭；未发现 destructive path 再按名 reopen。缺陷在 membership/终止后的裁决逻辑，而不是 handle 保存方式。
- live PID 遇 Job missing、active=0、membership unknown/false、birth unknown/mismatch时，初次 observation 能 fail-closed：[process.ts:441](~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823/packages/platform/src/process.ts:441)。
- binary 必须非空绝对路径，commandToken 必须非空；`readOwnedProcessBirth` 在 `command.includes` 前先验证二者，不存在 `command.includes("")` 路径。
- 对同一未被替换的 owner 文件，CLI 与 restart policy 都是 audit 调用在 delete 前；audit throw 会阻止 delete。
- main daemon 的 activation、rollback、database-close 投影已改为固定、trap-free 文本；正常 gate/executor/database cleanup reject/timeout进入 fatal/nonzero，独立 deadline 是 referenced，late settlement 已消费。例外是上述 supervisor IPC 与 recovery-only 路径。
- POSIX/Windows gate 都等待真实 `listening` 后才返回；正常 shutdown 中 gate close、executor、BYOA、runtime jobs、HTTP 共处同一个外层硬截止。
- 新增 platform native seam 测试确实调用了生产 `killOwnedTree`，没有复制其核心 helper；它只能证明 JavaScript wiring，不能证明 Koffi/Windows 行为。

## 仅能留待 Windows 真机验证

- Koffi ABI、`SetLastError/GetLastError` 保留行为以及 `ERROR_ALREADY_EXISTS` 实际关闭结果。
- `IsProcessInJob` 对已退出 process handle 的语义、Job DACL/访问权、同名 Job 重建与 PID reuse。
- `AssignProcessToJobObject`、`KILL_ON_JOB_CLOSE`、后代继承、active count、PID list、Terminate/drain、CloseHandle/double-close。
- 真实 spawn→assign 窗口，以及 SIGTERM/Job failure 下是否会命中复用 PID。
- Windows loopback gate 的 HMAC/ACL 落盘、post-bind error、abort/close 竞态和 listener 回收。
- 当前 Windows-only 测试的 partial-hook seam 问题修复后，仍需无 hooks 的 native 测试复核。

按指令未运行 Vitest、typecheck、lint 或其它门禁，未执行任何写、暂存、提交或推送操作。最后一次 `git status` 仅枚举到了 `prompts/**` 路径名；未打开其文件内容，也未读取 `logs/**` 或 `research/**`。