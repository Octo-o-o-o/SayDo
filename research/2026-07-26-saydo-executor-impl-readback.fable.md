# SayDo Tier1 生产执行器批 实施对账报告(impl-readback)

> 仓:/Users/wangyixiao/WorkSpace/SayDo(main)· 区间:`2f657ed..65559c2`(6 提交,本会话 git log 实取)· 改动面:35 文件 +3934/−35
> 计划来源:HANDOFF §2-9 边界声明 + 实施会话总结(用户转述)· 对账会话:2026-07-26(voice-coding 主会话)
> 提交清单(实取):`6e9014d` 任务1-4 → `b837fdc` e2e → `b9412aa` code-review 回修 → `602aa09` 收口 evidence → `47118a9` 一致性回修 → `65559c2` evidence §4 更新

## TL;DR

六项任务全部证实,门禁亲测绿(contracts 66 + daemon 452 | 2 skipped + Playwright 10/10,与自报一致),真 cursor-agent 端到端证据扎实(RESULT.md 含真实 vitest 输出 44.5s + 锁定副本实存且启动壳版本自绑定)。计数:[ok] 完成 6/6 任务 + 7/7 修复声称;质量复审(独立 code-reviewer)结论见 §质量复审。
簿记欠账 4 条:① 6 提交未推远端(ahead 6);② 声称的"Codex 攒批 19"撞号——19 已被 plan2 评审占用,执行器批的攒批无日志无报告(本会话已补发编号 20);③ HANDOFF §运行基线写"daemon 451"实为 452(勘误);④ journal 出现两个 R46(并行会话撞号)。
[tier1] 两键已由本会话配入 ~/.saydo/config.toml(锁定副本路径实存已验)。

## 对账台账

| # | 声称 | 状态 | 证据 |
|---|------|------|------|
| 1 | 认领循环:15s scheduler + CAS 同仓串行 + worktree 供给(凭据剥离/--ignore-scripts)+ 起 cursor-agent + 版本 pin | [ok] | `index.ts` setInterval(tick).unref() 挂载,缺 [tier1] 配置不认领+处方化日志;`tier1/projectConfig.ts:43-55` setup 白名单强制 --ignore-scripts;`tier1/executor.ts:148-150` 绝对路径 pin+启动断言;e2e `tier1-story-e2e.test.ts`(CI 内 452 绿含 #31 认领链) |
| 2 | S2 审批 live 上浮:unix socket 审批门 + gate.sh 四律 + 词表环/screen 张 + approveAction + console 审批页 + 超时按档 | [ok] | `tier1/gateServer.ts`/`gateScript.ts`/`approvalFlow.ts` 实存;09 §11 D8 补录(gate.sh 落 ~/.saydo/tier1/ agent 不可写目录,socket ~/.saydo/tier1-gate.sock);真 agent 实测 ls 经门放行(RESULT.md "live gate decisions count=1");console 审批页 Playwright 10/10 含审批中心 |
| 3 | 执行中骨架:三熔断(活跃墙钟审批期停表/回合/成本)+ steerTask queued_delta + task_messages 认领注入 | [ok] | `tier1/executor.ts:183,194,368`(budget 三元组+停表注记);`tier1/operations.ts:49-56`(cursor ⇒ queued_delta);09 §9 task_messages DDL(kind='steer') |
| 4 | settle 与回叫:verify 白名单冻结重校 + Tier1SettleProof(真实 write-tree)+ ready_for_review + outbox;取消链 CancelProof | [ok] | `tier1/verifyFreeze.ts` 实存(冻结扩 pre/main/post 三键闭包,executor-batch.md:31);`tier1/operations.ts:250-269` proof 严格 schema+四字段交叉核对拒批;真实测 approve 后人工合并 treeSha 对账 task_done(RESULT.md) |
| 5 | e2e:故事一全闭环(CI)+ 真 cursor-agent(SAYDO_LIVE_E2E 门控)+ gate 物理链 + canary/熔断/§12-7 恢复 | [ok] | `test/tier1-story-e2e.test.ts`(+232 行,CI 内)、`test/tier1-live.e2e.test.ts`(+168,门控)、`test/tier1-security.test.ts` 扩;亲跑 452 passed |
| 6 | 收尾:conformance + executor-batch evidence + 场次解锁 + canonical 回写 | [ok] | `e2e/evidence/tier1-conformance.md`+`executor-batch.md` 实存;HANDOFF:23,31,39 场次②③④解锁声明+[tier1] 前置写明;09 §9/§11/§13 回写实存(§11:743-746 pin 承载+门形态,时序注记诚实) |
| 7 | code-review 3 硬伤修复(verify 免门 RCE/管道漏放行/孤儿双跑)+ canary 证伪 | [ok] (修复在 `b9412aa`) | 独立复审复核结论见 §质量复审 |
| 8 | 一致性 3A+3B+1C 修复(sudo rm -rf / 降级漏洞等) | [ok] (修复在 `47118a9`) | `tier1/cmdEffect.ts:57-64`(sudo/doas 剥离递归归类,结果不低于 S2;破坏类直 S3) |
| 9 | 实测 bug 修复:/var↔/private/var symlink cwd 匹配 + stream-json 不自退挂死 | [ok] | `tier1/executor.ts:297-302`(两侧 realpathSync 规范化);挂死修复在 result 事件后主动收割(独立复审复核) |
| 10 | 三条诚实差距登记 P1 | [ok] | `executor-batch.md:59-67`(verify config 文件面/env HOME/§12-7 非精确 resume,各有登记锚) |
| 11 | Codex 攒批 19 后台跑,报告落 codex-findings/19 | [fail] (撞号欠账) | `19-plan2-review.md` 是另一工作流(IMPLEMENTATION-PLAN-2 评审)的报告;`logs/19*.log` 不存在。本会话补发编号 20(`prompts/20-executor-writeback.md`,gpt-5.6-sol/max/只读,在途) |
| 12 | canonical 回写 09 §6.3/§9/§11/§13 + journal R46 | [ok] (R46 撞号) | 09 回写实存(§9 task_messages/reserved 边、§11 D8+pin、§13 steer 语义);journal R46 有两条(设计库会话与执行器会话并行撞号,内容各自完整) |

## 门禁结果(本会话亲跑)

```
just ci → contracts Tests 66 passed (66);daemon Tests 452 passed | 2 skipped (454);[ok] node + python matrices green
pnpm exec playwright test → 10 passed (13.5s)
```

与自报一致(自报"452 passed | 2 skipped + py 11"√;HANDOFF §运行基线行写 451 为笔误)。真 agent 门控 e2e 未在本会话重跑(耗订阅额度;实施会话 RESULT.md 有真实输出,采信为一次通过记录)。

## 质量复审发现

本会话一手复审(独立 code-reviewer 子代理另行深审,截至落稿未归,回来后 triage 追补):

- **gate.sh(gateScript.ts:13-35)**:allow 需精确命中 `"allow"`;curl 失败/超时/非 JSON/jq 畸形一律落 deny 分支;JSON 全程 jq 构造;每次 daemon 启动重写(手改自愈)+0o755;hooks timeout 120s 与 curl 110s 双超时=deny。四律成立。
- **gateServer.ts(28-72)**:解析失败/handler 异常/未知路由/超 256KB 一律 deny;B3 多字节跨 chunk 修复在位(Buffer.concat 后一次解码);unix socket 不与 G1 网络门混流的理由成文(单 owner 单机威胁模型);socket 文件权限未显式 chmod——已在 evidence 登记为 C 级,维持。
- **verifyFreeze.ts**:dispatch 冻结 {templateRef,argv,scriptDigest} + 执行前重读重算;免门 RCE 修复把 pre/main/post 三键闭包纳入冻结(头注明写 `pnpm run test` 会跑 pretest 的通道);白名单外拒冻(Brain 不能自由拼命令)。修复真实。
- **cmdEffect.ts(139-148)**:`X | sh` 在拆段前整条 S3(A2 回归修注释在位);单管道拆段使 `git diff | curl -d @-` 右段现形取最高风险段;`||` 先于 `|` 匹配;子 shell/反引号命中整条上浮不可判;sudo/doas 剥离递归归类结果不低于 S2(57-64),破坏类直 S3。
- **孤儿双跑(executor.ts:994,1065,1145-1168)**:agent pid 落 runDir,recover/新 spawn 前 kill 旧 detached 进程组(ESRCH 忽略);pid 落盘失败退化不阻断,recover 靠 result 收尾兜。修复真实。
- **canary(gate.ts:79,executor.ts:190-206)**:不变量 = shell tool_call started 事件数 ≤ 门请求数;被 deny 的命令两侧都计数,不破坏不变量——实施会话对"canary 用请求数"的证伪**成立**;绕门(tool_call 无对应请求)即刻 cancel。
- **settle proof 伪造面(operations.ts:250-269)**:proof 严格 schema + taskId/attempt/runId/treeSha 四字段与库内 run 行交叉核对,失配拒批;treeSha 来自 daemon 侧真实 `git write-tree`(agent 在 worktree 内改文件影响的是 tree 内容本身,不是 proof 的生成路径)。
- **故事一 e2e 真实性(test/tier1-story-e2e.test.ts:5,81-165)**:由真实 `Tier1Executor.tick()` 驱动,仅 AgentSpawner 注入假 agent(真 worktree 真文件真 write-tree);与门控 live e2e(真 cursor-agent)互补。声称"CI 内全闭环"成立。

一手复审未见新 A/B 级;C 级维持已登记面(socket 权限/DDL FK)。

**Codex 20 归来追记(2026-07-26 上午)**:总判"A 必修"。triage(全文 `research/codex-findings/20-executor-writeback.md`):
- **A1 成立(新差距,一手复核确认)**:canonical"gate.sh 在 agent 不可写目录"无实现保证——hooks.json 仅挂 beforeShellExecution,cursor-agent 内置 write 工具不经门、同 UID 可改写 gate.sh 洗审批(canary 计数抓不住"POST 撒谎"变体)。canonical 已当轮改口(09 §11 + 05 §4 + conformance [ok]→[warn]);**代码补偿控制(gate 请求处 digest 校验)登记 W 批,场次②前落**;完整解 P1 容器族。
- A2(19 撞号)本会话先行发现,20 号报告落盘即闭合;B1(reserved 取消边)09 §9 已补录;B4(语义同 overclaim)已改口;C1(80 字符截断)已成文;C2($SAYDO_HOME)已修;C3 证伪(Codex 误读注释);B6 后半已被 W1 `6d1c99e` 提前清偿。
- 登记移交 W 批 5 项:A1 补偿控制 / B2 validateTier1Config(含 §12-9 反例)/ B3 非 cursor 后端启动即拒 / B5 gate.sh 输入 jq -e 校验 / B6 前半 step_confirm 承载核对。

## 修复清单(按优先级)

1. 【簿记】提交推远端:对账中发现 **W1 批实施会话正在同仓并行提交**(`8f77e0b..6d1c99e`,"第一期全量清偿"工作流,最近提交 2026-07-26 10:48,改动含 executor.ts/tasks.ts),main 现 ahead 12。**推送让渡给 W1 会话收口时执行**(避免抢在其可能的本地整理之前);若其停摆再由本会话推。
2. 【欠账】执行器批 canonical 攒批:编号 19 撞号作废,本会话已补发 **Codex 20**(在途),回来后 triage;evidence §4 的"攒批 17/19"引述已改 20。【已执行;两处勘误被 W1 会话收编入其 `8f77e0b`,内容完好且有出处注】
3. 【勘误】HANDOFF:23 "执行器批后 contracts 66 + daemon 451" → 452。【已执行】
4. 【簿记】journal 双 R46 撞号:执行器批条目顺延为 R47(内容未动)。【已执行】
5. 【已收】Codex 20 归来并完成 triage(见 §质量复审追记):canonical 侧当轮全修;**代码侧 5 项移交 W 批(A1 补偿控制为首,场次②前落)**。
6. 【在途】code-reviewer 深审子代理超 100 分钟未归;其核查面已被本会话一手复审 + Codex 20 覆盖大半,归来后仅差额 triage。

## 人工验收前置状态(对账时点)

- `[tier1]` 两键:本会话已配入 ~/.saydo/config.toml(cursor_agent_bin=versions/2026.07.23-e383d2b 绝对路径,实存已验;启动壳 SCRIPT_DIR 自绑定版本目录,pin 不被壳击穿)。
- 场次①②③④:HANDOFF 声明工程侧全部就绪可约;session-2 §0 边界已解除。
- 环境:锁定副本在;Hopper 锁定副本在(closeout 已验);ASR key 在。
