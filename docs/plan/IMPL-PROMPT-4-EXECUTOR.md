# SayDo Tier1 生产执行器批 · 实施 Prompt(第四轮交接,复制分隔线以下到新会话)

> 背景:接线批已收口(evidence `wiring-batch.md`;回收批 2 `bf4b956`)。**当前唯一硬缺口 = Tier1 生产执行器**:任务能被语音派进队列(queued),但没有任何生产循环去认领执行——场次①已解锁,场次②③④与"完整试用"全部等本批。库层全部就绪(adapter/gate/verifyFreeze/operations/task_messages/回叫 engine),本批是把它们接成生产执行循环。估 3–5 人日。

---

你接手 **SayDo Tier1 生产执行器批**。代码仓 `~/WorkSpace/SayDo`(main 直推);设计库 `~/WorkSpace/voice-coding`(只读,回写走轻量评审)。完成判定 = 故事一真实全闭环:语音派单 → 执行器认领 → cursor-agent 真跑 → S2 语音上浮审批 → settle → 回叫"等你验收" → 验收三态 → 人工合并 → task_done。

## 0. 坐标核验(先做,漂移即停)

| 命令 | 期望(2026-07-25 21:45 实测) |
|---|---|
| `git -C ~/WorkSpace/SayDo log --oneline -1` | `2f657ed`(或其后 evidence 提交;工作区应干净) |
| `cd ~/WorkSpace/SayDo && just ci` | 双矩阵绿(contracts 66 + daemon 393 passed \| 1 skipped + pytest 11) |
| `pnpm exec playwright test` | 10 passed |
| `cursor-agent status` | 登录态正常(dev 缺省执行后端) |
| `rg -rn "from \"./tier1/adapter" packages/daemon/src --glob '!**/*.test.ts'` | 空(接线前基线;接完不应再空) |
| `git -C ~/.saydo/hopper-dist rev-parse HEAD` | `bdd1e548…`(路径二资产,本批不动) |

## 1. 必读(以 `~/WorkSpace/` 为根)

1. `SayDo/HANDOFF.md`(§0 硬教训/§4 铁律)+ `SayDo/e2e/evidence/wiring-batch.md` §5/§7(挂账清单=本批输入)
2. `voice-coding/docs/09-data-contracts.md` §9(tier1_runs 状态机/Tier1SettleProof/Tier1CancelProof/tier1MinimalProof)、§6.3(outbox/settle)、§13(steer/approveAction/explainResult)——照抄源
3. `voice-coding/IMPL-PROMPT.md` 文末"Tier 1 执行后端"节(cursor_cli fail-closed 四律 + 门完整性,原始出处)+ 计划 4.1 行(`voice-coding/IMPLEMENTATION-PLAN.md`)
4. `SayDo/research/spikes` 无此目录——spike 资产在 `voice-coding/research/spikes/cursor-cli-tier1/`(hooks.json/gate.sh/run.sh,已实测三例)
5. `SayDo/packages/daemon/src/tier1/`(adapter/gate/verifyFreeze/operations——库层现状)+ `src/live/scheduler.ts`(定时器样板)
6. `docs/10`(#19 S2 播报/#29-31 回叫话术)/`docs/11`(UI/零 emoji)

## 2. 红线(违反即停;出处 HANDOFF §4 + IMPL-PROMPT 附录)

cursor hooks **fail-closed 四律**(只依赖 deny/jq 构造 JSON/超时=deny/每条命令独立审批禁便车)· **门完整性**(gate 落 agent 不可写目录/tool_call 无 hook 回调 canary ⇒ 立即 cancel/`cursor-agent` 版本 pin=锁定副本+启动断言)· G4 worktree 供给剥离凭据+setup `--ignore-scripts` · G3 verify 白名单+内容冻结重校 · S2 播报=E2 签名 spokenForm 经 redactor,barge-in 作废 · 三熔断(活跃墙钟停表/回合/成本)· settle proof 齐备才写 outbox(§6.3)· 状态词纪律(settle 后="执行和检查都跑完了,等你验收")· Gate 0 无 bypass · 契约只 import @saydo/contracts · 零 emoji · 每步独立核实落盘/SHA · 两提交法。

## 3. 任务清单(竖切;每项接完即测)

1. **认领循环**:15s 级 scheduler(样板 index.ts 既有定时器):`queued ∧ route=tier1` 认领 → `tier1_runs` reserve(CAS)→ worktree 供给(git worktree + setup --ignore-scripts + 凭据剥离)→ 起 cursor-agent(`-p --force` + 每任务 worktree `.cursor/hooks.json`,gate 脚本回连 daemon 审批 socket)。同仓串行(一仓一活跃 run)。
2. **S2 审批 live 上浮**:hooks 阻塞 → daemon 收审批请求 → `approveAction` 工具注册 + 语音播报(E2 spokenForm 经 redactor;presentation barge-in 作废——词表环复用 live/confirm)+ console 审批页可点;超时按档终局(逐步确认档=转 blocked 停靠,scheduler 既有)。
3. **执行中骨架**:三熔断接线(活跃墙钟停表在审批/停靠期/回合数/成本上限 → cancel+blocked 叫人);steer(`queued_delta/cancel_resume` 按 §13);`task_messages` 消费口(retry/返工原文进下次 run 编译上下文——认领时 readTaskMessages 注入)。
4. **settle 与回叫**:run 终态 → verify 白名单执行(冻结 argv/digest 重校)→ `Tier1SettleProof` 产出(§9 四字段+verify digest)→ `ready_for_review` 转态 → C4 outbox enqueue(engine 既有,minimalProof 门已在);blocked/failed 同链(最小 proof)。取消链:cancelTask → 进程终止 → `Tier1CancelProof` → cancel_settled。
5. **e2e 收口**:故事一真实版(真 cursor-agent 跑一个小仓单:改文件→verify→settle→回叫→approve→人工合并→task_done)+ 审批门 e2e(deny 拦截/阻塞放行/canary 触发 cancel——复用 spike run.sh 语义)+ 熔断注入 + §12-7 Tier1 恢复(kill -9 → 按 (adapter,nativeSessionId,cwd) 恢复或降级"摘要+diff 注入新会话")。
6. **收尾**:conformance 报告(计划 4.0/4.1 挂账清偿);sheets 回填(session-2 §0 执行器边界解除);HANDOFF #1 场次②③④解锁声明;evidence `executor-batch.md` 六段;canonical 若有回写走一致性 subagent + Codex 攒批(编号 17)。

可选尾项(不阻塞收口,评估后做或登记):深评 live 触发装配(assessReadiness 完整链)、seedTerms 偏置(dogfood 期既定)。

## 4. 检查点(必须停等 owner)

① 真实 agent 跑单的目标仓选择(用 PoC 独立测试仓,**绝不**用 dogfood 真仓做 e2e);② 任何新花费/外部副作用;③ canonical 语义级变更;④ 场次②③④本身(备好即通知可约)。缺省动作:必须确认项无回复=暂停该分支继续其他。

## 5. 诚实汇报 + 工作方式

三级词表([ok] 可复跑证据/[warn] 差距/[fail] 原因);SHA 与测试输出来自本会话真实命令;`just ci` 每提交前必绿;纯代码每阶段 1 code-review subagent(A 必修);两提交法;owner 之后用 /impl-review 对账。

开始吧:先跑 §0,读 §1,按 §3 顺序实施。
