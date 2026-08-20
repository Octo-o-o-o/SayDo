# Codex 攒批 19 · SayDo Tier1 生产执行器批 —— 只读实证复核

> 编号说明:接线批用 16;owner 交接 prompt 说"编号 17",但 voice-coding `research/codex-findings/`
> 全局编号 17/18 已被其他主题(repo-merge/writing-flow)占用,本批用下一个可用编号 **19**。
> 模型 `gpt-5.6-sol` / `model_reasoning_effort=max` / 只读。报告落 `research/codex-findings/19-tier1-executor-batch.md`。

## 背景

SayDo(`/Users/wangyixiao/WorkSpace/SayDo`,main HEAD=602aa09,基线 2f657ed)把已就绪的 Tier1 库层
(adapter/gate/verifyFreeze/operations)接成**生产执行循环**:15s scheduler 认领 `queued∧route=tier1`
任务 → git worktree 供给 → 起真实 `cursor-agent`(`-p --force --trust --output-format stream-json`,
worktree 内 `.cursor/hooks.json` 的 beforeShellExecution 钩子回连 daemon unix socket 审批门)→ 事件流
消费 → verify 白名单执行 → Tier1SettleProof → ready_for_review → 回叫 outbox → 验收 approve → 人工合并 →
task_done。真 cursor-agent 端到端已实测通过(`SayDo/e2e/poc/tier1-live-executor/RESULT.md`)。

本批代码提交:`6e9014d`(任务1-4)/`b837fdc`(任务5 e2e + cwd/进程退出两 bug)/`b9412aa`(code-review
回修:A1 verify 三键冻结 / A2 管道拆段 / A3 孤儿清理 / B2 / B3)。conformance `SayDo/e2e/evidence/tier1-conformance.md`;
六段 evidence `executor-batch.md`。canonical 回写一处:`voice-coding/docs/09-data-contracts.md` §11
版本 pin 配置承载(additive)。

## 你的任务(只读,不改文件,不跑测试)

以**证伪立场**实证复核本批,重点安全承重(生成方不能自评,防相关错误链)。逐项给裁决 + `file:line` 证据 +
严重度 + 是否可达(潜在/生产可达)。报告落 `research/codex-findings/19-tier1-executor-batch.md`,含 triage 表。

### 必读
- 实现:`SayDo/packages/daemon/src/tier1/{executor,gateServer,gateScript,cmdEffect,approvalFlow,projectConfig,operations,verifyFreeze,gate,adapter}.ts`、`src/index.ts`(执行器/gateServer/审批装配 + console 决策端点)、`src/live/{dialog,confirm}.ts`、`src/storage/ddl.ts`(DDL v4)。
- canonical:`voice-coding/docs/09-data-contracts.md`(§6 任务/outbox/settle、§9 DDL/proof、§11 config/Tier1 审批门、§13 Brain 工具)、`docs/04`(§5.1 风险分级/§5.4 三熔断不变量)、`docs/10`(#19/#29/#31 话术)、`IMPLEMENTATION-PLAN.md` 4.1 行、`IMPL-PROMPT.md` 文末 Tier1 节。
- 实测证据:`SayDo/e2e/poc/tier1-live-executor/`(真 agent 事件流 + verify + gate 日志)。

### 重点安全红线(逐条实证成立/证伪)
1. **fail-closed 四律**:① gate 只依赖 deny(handleGateRequest 所有异常路径/匹配不到 run/abort/非 allow 决策是否都 deny;gateScript 解析不出 permission 是否 deny)② JSON 全程 jq(gate.sh)③ 超时=deny(approvalFlow timer + gate curl --max-time + hooks timeout,三处覆盖是否无空窗)④ 每命令独立审批(S2 收据 accept 即 consume 单次;是否存在第二条命令搭第一条便车的路径)。
2. **门完整性**:canary(cmdEffect + executor 的 shellStarted vs gateSeq 对账;两 tick 巡检 + 结算点硬检——是否有真实绕门被漏判的构造;注意 events.jsonl 实证:被 deny 的 shell 命令也产生 shellStarted 事件)。gate 脚本落 agent 不可写目录。版本 pin(锁定副本绝对路径 + assertVersion;自更新是否有生效路径)。
3. **cmdEffect 保守映射**:是否有命令被误判为低危而漏放行 S2/S3(尤其管道 `|`、子 shell `$(…)`/反引号、写出 worktree 外的重定向、force push、越界 rm、外发 curl/ssh)。未知命令是否一律 S2 上浮(不落 S1 以下)。
4. **G3 verify**:白名单冻结重校(pre/main/post 三键闭包是否覆盖 lifecycle 注入;config 文件可执行代码的残留面已登记 P1,确认登记诚实);Plan Delta content_drift → blocked。
5. **G4**:strippedAgentEnv 白名单(agent spawn + verify 执行是否都剥离凭据;HOME 残留面已登记)。setup --ignore-scripts 强制。
6. **三熔断**(04 §5.4 不变量):活跃墙钟(审批期停表 approvalWaitMs;并发门请求 approvalWaitingSince 单字段覆盖的 B1 缺口是否影响正确性)、回合(tool_call started 计数)、成本(SUM api 行)。
7. **settle barrier**:proof 齐备才写 outbox(Tier1SettleProof.parse + treeSha 交叉核对);blocked/failed 最小 proof;返工 attempt+1 dedupeKey 变化。
8. **取消 + §12-7 恢复**:cancelTask → reap kill → Tier1CancelProof → cancel_settled;晚到事件;daemon 重启 recover(running 降级新会话 + killOrphanAgent 清旧;数据不一致落终态)——是否丢任务/重复执行/双跑。
9. **状态机**:task/tier1_run 转换是否都走 canTransitionTask/canTransitionTier1Run + CAS(WHERE status=from);有无裸 UPDATE 绕过。
10. **契约一致**:实现 proof/状态/工具签名与 canonical 09 §6/§9/§13 是否一致(冲突以 09 为准,静默双改=A)。**canonical 回写**(09 §11 版本 pin 配置承载条)文字是否与实现相符、有无过度声称。
11. **零 emoji / 状态词纪律**:源码/evidence 零 emoji(events.jsonl 是 agent 产物已 \u 转义,豁免);回叫话术守"执行和检查都跑完了,等你验收",不说"完成"。

### 已知 code-review 结论(供交叉,不必重复除非你有新证据推翻)
- A1 verify 免门(pre/post 已修三键冻结,config 面登记 P1)/A2 管道漏放行(已修拆段+pipe-to-shell)/A3 孤儿双跑(已修 killOrphanAgent + shutdown)已回修 `b9412aa`。
- A4(canary 用请求数)经 events.jsonl 证伪(deny 命令也有 shellStarted,gateSeq 基准正确)——若你认为仍有洞请给新构造。

诚实纪律:结论必须有 `file:line` 或证据文件锚;区分"生产可达"与"潜在";不确定标不确定。
