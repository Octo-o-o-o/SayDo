No-Go。

基线核验为 `feat/m2-ios-shell-spike` 的 `08fd26731b198987937776f9128e896bc5b02fd9`，评审对象为当前未提交工作树。发现 A 级 6 项、B 级 7 项、C 级 2 项。现有绿测不足以覆盖这些竞态。

## A 级（6）

1. **启动状态机未闭合：bind 失败者可先写 durable 状态，`ready` 也可能早于停机处理器。**

   - 位置：[index.ts:2641](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:2641)、[index.ts:2793](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:2793)、[index.ts:3090](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:3090)、[index.ts:3223](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:3223)
   - 触发：两个同 HOME 的 `saydo up` 同时探测到空闲端口。两边在 bind 结果返回前都运行 merge/Tier1 恢复；败者随后才收到 `EADDRINUSE`。若 `recover()` 正在等待旧进程组，listener 可先发送 `ready`，supervisor 随即发送的 `prepareShutdown` 因 message handler 尚未安装而丢失。
   - 最小修法：最先安装 IPC/signal handler并缓存 pre-ready shutdown intent；await bind 成功后才允许任何领域恢复；Tier1 恢复完成并注册到 shutdown scope 后才能发 `ready`。最好同时加入 HOME 单实例锁。

2. **pipeline 的同 HOME 校验只影响灯色，不是接入门。**

   - 位置：[hub.ts:318](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:318)、[hub.ts:340](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:340)、[hub.ts:382](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:382)、[hub.ts:421](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:421)
   - 触发：使用目标 daemon 的有效 capability token，以兼容协议 hello 后上报另一 HOME 的 `stateRootDigest`，或在 health 前直接发送 `asr.final`。peer 已在 hello 时成为 `currentPipelinePeer`；digest 不同不会关连接，ASR 仍进入对话控制流。
   - 最小修法：把 daemon 预期 digest 传给 VoiceHub；首个 health 验证协议、identity、digest 前不得标记 available，也不得接受其他 pipeline 消息；digest 不同立即关闭连接。

3. **`agent.pid` 与 `agent-owner.json` 的 fail-open 更新可启动同 run 的第二个 agent。**

   - 位置：[executor.ts:1841](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1841)、[restartPolicy.ts:55](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/restartPolicy.ts:55)、[restartPolicy.ts:109](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/restartPolicy.ts:109)
   - 触发：旧 owner 记录指向已死的 A；新 B 启动并写入 `agent.pid` 后，进程在覆盖 owner 前崩溃或 `ps` 查询失败。下次恢复优先读取旧 owner，因 A 已死而返回“无孤儿”，忽略仍存活的 B，再启动 C。
   - 最小修法：owner 使用临时文件加原子 rename；capture/write 失败必须立即杀并等待刚启动的进程组，不能继续执行；legacy PID 与 owner 不一致且任一存活时 fail-closed。

4. **`--resume` 没有验证实际恢复到原 native session，却过早清 marker。**

   - 位置：[executor.ts:1780](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1780)、[executor.ts:1800](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1800)、[executor.ts:1017](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1017)、[tasks.ts:211](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:211)
   - 触发：数据库保存 session A，恢复进程接受 `--resume A` 但实际创建 session B，并输出正常 result。`native_session_id IS NULL` 令 B 被静默忽略；代码在进程刚 spawn 时就清 marker、记录 `restart_resumed`，最终仍可进入 review。
   - 最小修法：将首个 `system.init.session_id` 作为恢复确认门，必须等于 A 后才能清 marker和记 resumed；不一致或缺失必须显式 fail-closed，不能宣称续接。

5. **desktop、prepare 与真实 recovery 使用不同的 recoverability predicate。**

   - 位置：[desktop.ts:14](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/desktop.ts:14)、[restartPolicy.ts:39](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/restartPolicy.ts:39)、[executor.ts:1914](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1914)、[executor.ts:1651](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1651)
   - 触发：active run 启动后，项目目录被替换、删除或 inode 漂移。summary 因 workspace 验证失败报告 0；prepare 的 SQL 仍写 marker并在 `stopped` 报 1；重启后真实 recovery 又拒绝该 run。
   - 最小修法：提取唯一 classification API，供 summary、active prepare、inactive drain、stopped 计数和 recover 共用；只有通过完整前提的 run 才可写 marker。

6. **强制退出只按时间和 daemon PID收口，不能保证 agent 进程树已消失。**

   - 位置：[supervisor.ts:27](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/src/supervisor.ts:27)、[supervisor.ts:151](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/src/supervisor.ts:151)、[index.ts:3167](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:3167)、[recoveryOnlyServer.ts:215](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:215)
   - 触发：Tier1/子进程组 drain 卡住，或 provider 不结算。daemon fatal 等 6.5 秒后无条件 `process.exit`；supervisor 22 秒超时只 `child.kill("SIGKILL")`。第二次同类信号因 `once` listener 已移除，还可直接杀掉 supervisor。
   - 最小修法：持久信号状态机：首次 prepare、第二次显式升级；fatal/超时必须按经过 start-time/binary 验证的 ownership 清理并等待所有进程组 ESRCH，不能只杀 daemon PID。

## B 级（7）

1. **构建 identity 可碰撞或错标 dirty 输入。**

   - 位置：[build.mjs:14](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/scripts/build.mjs:14)、[build.mjs:35](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/scripts/build.mjs:35)、[build.mjs:37](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/scripts/build.mjs:37)
   - 触发：两个不同 dirty tree 都设置相同 `SAYDO_SOURCE_REVISION`，会得到相同默认 buildId；或分别以协议 `1.0.0`、`2.3.0` 构建，protocol 改变 artifact，但默认 buildId不变。显式 `SAYDO_BUILD_ID` 还能完全抹掉 dirty 差异。
   - 最小修法：dirty 时 sourceRevision 使用真实内容摘要；buildId纳入内容摘要、协议和有效构建配置。release label可单列，不能替代不可碰撞的 artifact identity。

2. **supervisor 对 setup restart 没有次数限制或熔断。**

   - 位置：[supervisor.ts:96](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/src/supervisor.ts:96)、[supervisor.ts:180](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/src/supervisor.ts:180)
   - 触发：daemon 每次 ready 后都请求 restart；外层无限循环持续 fork，并反复挂起/恢复 Tier1。
   - 最小修法：加入滚动时间窗计数、backoff和稳定运行复位；超过阈值停止重拉并输出明确 fatal。

3. **recovery-only 在 pre-ready stop 后仍可能启动 listener。**

   - 位置：[recoveryOnlyServer.ts:193](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:193)、[recoveryOnlyServer.ts:624](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:624)、[recoveryOnlyServer.ts:653](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:653)
   - 触发：Tier1 reaping 尚未结束时收到 stop。`closeAfterDrain` 因当时尚未 listening 而跳过 close；原先登记的 `.then(listen)` 在 drain resolve 后仍执行，可能与 `stopped`/DB close 交错。
   - 最小修法：listen 前检查 draining/fatal；将 bind promise纳入 lifecycle，stop 必须取消或等待它。

4. **已收到 agent terminal result 时的 shutdown 仍会写 restart marker并重复执行。**

   - 位置：[executor.ts:1025](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1025)、[executor.ts:1119](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1119)、[executor.ts:1914](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1914)
   - 触发：agent 已输出有效 result，但后代仍占 PGID，`proc.wait()` 尚未 resolve；此时 Ctrl+C。prepare 写 marker，后续 settle 因 `restartPending` 直接返回，重启后再次拉 agent。
   - 最小修法：durable 记录执行阶段；terminal result已到时优先结算或从 verify 阶段续跑，不得回退成 agent restart。

5. **恢复前置失败进入终态时不清 restart marker。**

   - 位置：[executor.ts:1463](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1463)、[executor.ts:1750](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1750)、[executor.ts:1816](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1816)
   - 触发：planned restart 后修改为非法 `project.toml`，或令 worktree provision 失败。`finalizeFailure` 将 run/task转终态，但 `restart_pending_at/reason` 永久保留。
   - 最小修法：所有 terminal transition统一在同一事务中清 marker，不要只在成功 spawn 或少数取消分支清理。

6. **正常与 recovery-only 的 shutdown scope 都漏掉在途 setup request；LiveDialog 自有 timer 也未停止。**

   - 位置：[index.ts:982](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:982)、[index.ts:3126](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/index.ts:3126)、[recoveryOnlyServer.ts:549](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:549)、[dialog.ts:594](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:594)、[dialog.ts:1299](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:1299)
   - 触发：API/CLI capability self-test 正在等待时 Ctrl+C；请求 Promise不在 `runtimeJobs`，连接可被强关后先 close DB/发 stopped。与此同时，5 秒 auto-accept timer仍可在 draining 阶段消费确认并写账。
   - 最小修法：所有 setup 请求进入统一 abort/drain registry；provider忽略 abort时必须走 fatal而非 stopped；`prepareShutdown` 清理并等待 `autoTimers`。

7. **distribution 门仍会对多条合同路径产生假阳性，失败清理也不闭合。**

   - 位置：[verify-distribution.mjs:72](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/scripts/verify-distribution.mjs:72)、[verify-distribution.mjs:360](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/scripts/verify-distribution.mjs:360)、[verify-distribution.mjs:446](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/scripts/verify-distribution.mjs:446)、[verify-distribution.mjs:491](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/scripts/verify-distribution.mjs:491)
   - 触发：破坏默认 47100、setup `restartRequested`、native session 等值校验、active BYOA drain、pre-ready/second-signal或 bind race，当前脚本仍可绿：所有启动都显式随机端口且 `--no-open`，restart是手工 stop/start，成功路径不查 session等值。首帧前失败时 daemon PID尚未登记，finally 最多杀 supervisor，然后删除 HOME，可能丢失孤儿 ownership 证据。
   - 最小修法：补真实 47100、normal/recovery setup restart、session等值、BYOA、双 supervisor bind race、pre-ready/二次信号/fatal 场景；清理按 PID、start-time、binary和进程组验证，全部 ESRCH 后才能删 scratch。

## C 级（2）

1. **重复 `--home`/`--port` 被接受且静默取第一次。**

   - 位置：[options.ts:18](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/src/options.ts:18)、[options.ts:31](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/src/options.ts:31)
   - 触发：`saydo up --port 47100 --port 48100`，扫描认为合法，`indexOf` 只读取 47100。
   - 最小修法：单次顺序解析并拒绝重复 flag。

2. **浏览器 opener 启动失败会产生未处理的 child `error`。**

   - 位置：[open.ts:7](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/src/open.ts:7)、[supervisor.ts:135](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/src/supervisor.ts:135)
   - 触发：Linux 无 `xdg-open`，或受限 PATH中无 `open`。异步 `error` 无 listener，默认 `saydo up` 可因此异常退出；分发脚本恒用 `--no-open` 看不到。
   - 最小修法：监听 `error`/异常 exit，将打开失败降为明确警告，不影响 daemon ownership。

已核实并未列为问题：分发脚本确实从安装目录调用生成的 `.bin/saydo`，`better-sqlite3` 是唯一 external 且脚本真实开库；tarball范围、hash asset、HOME优先级、同 HOME attach及不同 HOME/未知服务不杀的主路径实现均成立。

本轮严格只读，未修改文件、未联网、未运行会写临时产物的测试或构建命令。

OPEN QUESTION：0