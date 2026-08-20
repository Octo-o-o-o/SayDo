# 61 号对抗评审：D1 可分发运行时地基

你是独立对抗评审员。只读检查当前仓库未提交工作树，不修改任何文件。基线是
`feat/m2-ios-shell-spike` 的 `08fd26731b198987937776f9128e896bc5b02fd9`；评审对象是 D1
可分发运行时地基的全部 diff。禁止把测试名或注释当实现证据，必须抽查真实控制流、SQL、进程时序与
分发脚本。最终报告用简体中文，先给 Go/No-Go，再按 A/B/C 严重度列出 file:line、可复现触发与最小修法；
若某级为零要明确写 0。不要执行写操作、联网、commit 或 push。

权威合同：

1. `docs/09-data-contracts.md` 新增 §16，尤其 identity/readiness/HOME/47100 ownership、五事件 IPC、
   prepareShutdown 与 9 条验收。
2. 用户补充合同：daemon 必须是无源码树、无 `.git`、无 tsx/pnpm 的预编译 JS；console 同源；
   CLI 有 `saydo up/status/open`；pipeline 缺席 core 仍绿；同 home attach，异 home/未知服务不杀；
   Tier1 退出不落 failed、重启续接；BYOA 不冒充可恢复；Ctrl+C 后无 daemon/agent 孤儿；
   Node 22 native addon 真开库；npm tarball 可安装。
3. 不评 Electron 壳；不得要求修改 `apps/*`。

重点证伪：

- build 注入的 `{sourceRevision,buildId,protocolVersion}` 是否对应真实构建输入，dirty/untracked 是否会错标；
  artifact 是否仍暗依赖源码、`.git`、tsx、pnpm；`better-sqlite3` external 与 tarball 闭包是否真实。
- `coreReady` 是否真的包括 daemon/DB/console artifact；pipeline protocol 是否只看注入 identity；console
  是否明示“文本与控制面可用、语音未启用”。
- CLI HOME 三态、空值、默认 47100、显式 `--port`、未知参数、受保护 ownership probe、bind TOCTOU、
  attached Ctrl+C、owned Ctrl+C、setup restart 的 IPC 状态机是否有竞态或误杀。
- normal 与 recovery-only 是否都满足 `ready/restartRequested/stopped/fatal`；supervised 缺 IPC 是否 fail-closed；
  stopped 是否严格晚于 timer、S2、dialog、BYOA、Tier1、WS、HTTP、DB 的收口；fatal 是否会留下旧进程树。
- Tier1 `prepareShutdown` 是否 drain 全部 active，但只给可恢复 run 打 marker；cancel/steer/canary/budget 等
  终局事实是否优先；marker 是否在所有终态清理；恢复是否复用同 run/session 且不落 failed。
- `packages/cli/scripts/verify-distribution.mjs` 是否存在假阳性：是否真走 npm 安装生成的 `.bin/saydo`，
  是否真在安装目录启动，是否验证 hash asset、HOME 读回、attach/异 home/未知服务保活、真实 Tier1
  父子进程、重启续接、PID/孤儿与 Node 22 native addon；失败清理本身是否会造孤儿。
- `/api/desktop/summary` 的 active-work、DND、四色 attention 与 prepare 的 recoverability predicate 是否同源，
  normal/recovery-only 是否都可作为受保护探针。

这是 #61 回修后的最终收口复审。首轮报告中的 A6/B7/C2 均已有针对性修改；不要复述已失效行号，
必须按当前代码重新追踪。已执行但仍须独立判断覆盖是否充分的本会话证据（以当前工作树为准）：

- `pnpm ci:node` 当前完整通过：contracts 97、CLI 18、console 106、daemon 1208，另 4 个既有 live
  测试按条件 skip；emoji 门与默认协议 tarball 验收同命令通过。
- D1 负路径含真实 setup 卡死、git clean-filter 卡死、组长先退但孙进程仍占 PGID、legacy
  `agent.pid` 无法验证时 fail-closed；定向测试均通过。
- distribution 输出：Node v22.23.1；tarball 6 entries；identity 三元组；静态 index/asset 200；
  core true/voice false/pipeline_absent；显式 HOME 与默认 `~/.saydo` 均真建库重启读回；same-home attach；
  different-home/unknown-service 保活；recovery-only 由 CLI 持有且 core false；Tier1
  restart_pending→settled_review；初始/恢复 agent 与 descendant PID 均退出。
- `SAYDO_PROTOCOL_VERSION=2.3.0 pnpm --filter @saydo/cli verify:distribution` exit 0，安装包内
  daemon/CLI 的 status、attach、重启均使用 2.3.0。
- pipeline `pytest -q` 33 passed；ruff clean。

首轮后新增的关键形状包括：startup signal/IPC intent 在 bind 前登记，normal 在 Tier1 两阶段 recover/reaper
之后才 bind+ready；pipeline 首个 health 通过 identity+home digest 前不收 ASR；agent legacy PID 先落、owner
原子发布、birth identity/PGID fail-closed，CLI fatal/timeout 也按 owner 清树；native resume 要求返回同 session；
summary/prepare/recover 共用 workspace prerequisite；setup/dialog/timer/runtime jobs 纳入 drain；BYOA abort 返回真实
起始计数；recovery-only pre-ready stop 不再反向 listen；supervisor 有重复信号升级、restart fuse 与 bind-race probe。
所有 detached runtime child 还统一走 durable ownership wrapper：registry 的 birth identity 原子发布后才发
fd3 permit，wrapper 在目标退出后清同 PGID 后代；registry 根损坏会在 spawn 前拒绝，写入竞态则收口未获
permit 的 wrapper。对抗测试覆盖组长先退、legacy owner、pending token、argv/process.title 伪装 ps 探针与
registry 根为普通文件。

最后一轮又补齐：ownership probe 先用 HMAC nonce 证明目标持有该 HOME capability，再发送 bearer token，且
proof 绑定 port/pid/start/identity/home；HOME lock、Tier1 owner 与 runtime child owner 都携带同一次 daemon
instance generation，旧 supervisor 不得 HOME-wide 回收新实例；build 的 sourceRevision 固定为 canonical
build-input content digest，构建前后重算并在输入变化时删掉产物失败；fatal 清理与 IPC 都有独立硬 deadline。
分发验收现真实覆盖默认 47100（占用时证明冲突保留）、同 HOME 不同端口 lock conflict、同 HOME 并发
owned+attached、异 HOME bind race 在建库前失败，以及活跃 Tier1 时旧 supervisor 不误杀另一实例。
最后冻结前又修复两条退出竞态：daemon 已发 fatal 并先释放 HOME lock 时，supervisor 仍在 child
确认退出后按精确 generation 扫 durable owner；AI 已入队但尚无播放水位证明的 pending/迟到句在
关库前持久化为 `heard=false`，重启只从 transcript 读回已听事实。对应 CLI 18/18 与语音会话 12/12
定向测试通过。Tier1 `agent.pid` 先于完整 owner 发布的窗口也已覆盖：generation reaper 会先收口
精确 runtime owner，再复核未知 legacy 锚；无 generation 的旧路径仍立即 fail-closed。

请特别寻找“happy-path 测试虽绿，但 fatal/restart/second signal/DB close/async provider 忽略 abort/进程组复用”等
竞态。最后给 OPEN QUESTION 数量；没有 owner 战略取舍就写 0。
