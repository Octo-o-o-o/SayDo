# Tier1 selected-adapter conformance 报告(计划 4.0/4.1 出口挂账清偿)

> 选定后端 = **cursor_cli**(dev 机缺省,订阅态零 key);claude_sdk(产品缺省)顺延至订阅购入,**未选后端不触发停止**(计划风险表)。
> 本报告 = 计划 4.1 出口验收项"selected-adapter conformance 报告(4.0 挂账)"。三级词表:[ok] 带可复跑证据 / [warn] 附差距。
> 代码提交:`6e9014d`(任务1-4)/`b837fdc`(任务5 e2e)/`b9412aa`(code-review 回修)/`602aa09`(收口 evidence)/`47118a9`(一致性回修)/`65559c2`(evidence §4);基线 `2f657ed`(Codex 20 B7 补全,2026-07-26)。

## 0. 结论

cursor_cli 作 Tier1 执行后端,**canUseTool 语义等价物(beforeShellExecution 钩子回连 daemon 审批 socket)全链成立**——真 cursor-agent 端到端实测通过(`e2e/poc/tier1-live-executor/RESULT.md`,44.5s),fail-closed 四律 / 门完整性 / G3 / G4 / 三熔断 / settle barrier / §12-7 恢复逐项有测试或实测证据。GO(dev 机)。

## 1. fail-closed 四律(IMPL-PROMPT 附录 + spike 8 实证约束)

| 律 | 实现 | 证据 |
|---|---|---|
| ① 只依赖 deny(CLI 仅 deny 可靠;`--force` + 钩子"缺省 deny 批准才非 deny") | `gateScript.ts` 解析不出 `permission=="allow"` 一律吐 deny;daemon `handleGateRequest` 匹配不到 run / abort / 决策非 allow 均 deny | [ok] `tier1-gate-socket.test.ts`(daemon deny/不可达/畸形/未知路由全 deny 6 例,真 bash+curl+jq)|
| ② JSON 用 jq 构造(畸形 fail-open) | `gate.sh` 全程 `jq -nc` 构造响应;daemon 侧 `gateServer` 只吐结构化对象 | [ok] gate-socket 畸形响应=deny 例 |
| ③ 超时=deny | `approvalFlow` 收据超时 timer(receipt+2s)resolve(false);`gate.sh` curl `--max-time 110`;hooks `timeout 120` | [ok] `tier1-approval-live.test.ts` 超时 gate promise=false + sweep timeout_parked 例 |
| ④ 每条命令独立审批(禁便车) | gate `seq` 每命令递增;S2 收据 accept 即 consume(单次);canary shellStarted vs gateSeq 对账 | [ok] `tier1-executor.test.ts` canary 例 + approval-live 单次消费例 |

## 2. 门完整性(05 §4 Gate 0 / IMPL-PROMPT)

| 项 | 实现 | 证据 |
|---|---|---|
| gate 脚本落 worktree 外 daemon 供给目录 | `~/.saydo/tier1/gate.sh`(worktree 外);worktree 内仅 `.cursor/hooks.json` 指向绝对路径;settle 快照树 `:(exclude).cursor` | [warn] 原表述"agent 不可写目录"经 Codex 20 A1 改口:同 UID 下 agent 内置 write 工具可写该路径,无强制不可写;补偿控制(gate 请求处 digest 校验)登记 W 批,完整隔离 P1(09 §11 诚实口径) |
| tool_call 无 hook 回调 canary ⇒ cancel | `checkCanary`(两 tick 确认)+ 结算点硬检(shellStarted > gateSeq ⇒ abort=canary ⇒ task failed) | [ok] executor canary 例(shell started 无 gate 请求 ⇒ failed + 审计)|
| cursor-agent 版本 pin | `lockedBinary`=锁定副本绝对路径(`versions/<pinned>/`,非裸名 PATH)+ 认领前 `assertVersion`(includes 断言,漂移拒起) | [ok] executor 版本漂移拒起例;真实二进制 `2026.07.23-e383d2b` |

## 3. G3 verify 独立 oracle + 内容冻结

| 项 | 实现 | 证据 |
|---|---|---|
| 只认登记白名单模板 | `project.toml [[verify.entries]]`(package_script/justfile);`freezeVerify` 非登记拒冻;Brain 只选不拼 | [ok] `tier1-security.test.ts` 非白名单拒冻;executor 无登记=blocked 不伪 settle |
| 内容冻结重校(dispatch 冻结 argv+digest,执行前重算) | `freezeVerify` 冻结 **pre/main/post 三键闭包**(code-review A1:防注入 pretest 免门);`precheckVerify` 同闭包重算,不符=content_drift | [ok] security A1 pretest 注入 drift + Plan Delta 例 |
| Plan Delta:改验证脚本 ⇒ blocked 回叫重拍板 | executor settle 前 precheck,content_drift ⇒ finalizeFailure(blocked)+ planDeltaCallback 话术 | [ok] executor(story-e2e verify 真跑 exit0;security content_drift)|

> [ok] **框架 config 面已纳入冻结快照(W5a 3.1-①,修复 `7c4fe1b`)**:runner config 文件族(vitest/vite/playwright/jest/mocha/tsc/eslint/pytest/ruff)+ 命令内路径 token + justfile 一层递归 `package.json#scripts.*` 伪键,随 verify argv 冻结(缺席记 null,新建即漂移),执行前重校不符 = content_drift 转 blocked(Plan Delta)。取舍 = 方案 a"冻结快照"(config 变更走重拍板,可用性保留)而非方案 b"保守拒"。反例 6 例(`tier1-security.test.ts` W5a 3.1-① describe)。诚实残余(仍 P1 受控执行环境):node_modules/依赖树/monorepo 子包 config/tsconfig extends 链/TOCTOU 精确竞态。

## 4. G4 secret/egress 隔离

| 项 | 实现 | 证据 |
|---|---|---|
| worktree 供给凭据剥离 | `strippedAgentEnv` 白名单(PATH/HOME/USER/... 无任何 *_KEY/TOKEN);agent spawn + verify 执行均用之 | [ok] executor `strippedAgentEnv` 例(OPENROUTER/VOLC/AWS 全剥)|
| setup `--ignore-scripts` | `projectConfig.sanitizeSetupCommand` 强制 `--ignore-scripts`(已含不重复)+ 白名单仅 pnpm/npm/yarn install 形态,其余拒 | [ok] `adapter.setupArgv` + projectConfig(setup 非白名单拒)|
| egress 声明 | cursor `egress=uncontrolled` 如实(无法沙箱网络) | [ok] `adapter.ts` egress 声明 + security 例 |

> [ok] **verify 执行 env 已隔离(W5a 3.1-②,修复 `7c4fe1b`)**:`VERIFY_ENV_ALLOWLIST` 最小白名单(PATH/LANG/LC_*/TERM/TMPDIR,无 USER/SHELL/LOGNAME)+ HOME 指向任务专用空目录(`runDir/verify-home`,只建不删)+ COREPACK_HOME 定向透传(pnpm shim 发行版缓存面,非凭据面)。反例:verify 进程 `cat $HOME/.ssh/id_rsa` 失败 + 对照组真实 HOME 可读(证明断言有效);story-e2e 真实 pnpm verify 在隔离 env 下照常绿。诚实残余(仍 P1 容器/sandbox):绝对路径直读(/Users/<u>/.ssh)与网络出口不可挡(egress=uncontrolled 如实口径不变)。

## 5. S2 运行时审批 live 上浮(04 §5.1 逐步确认 + 10 #19 + 09 §3)

| 项 | 实现 | 证据 |
|---|---|---|
| 命令→effect 保守映射 | `cmdEffect`:未知一律 S2 上浮;force push/越界删/管道执行/写出 worktree 外/破坏词头(dd/mkfs/关机)/sudo 剥离=S3;管道拆段取最高;子 shell 上浮 | [ok] `tier1-cmd-effect.test.ts`(含 A2 管道/子 shell + A3 sudo/破坏词头回归)|
| S2 上浮播报经 redactor + 词表环 | `approvalFlow.request` 签 runtime_effect 收据(turn_ref=拍板轮,取不到=deny)→ 词表环 tryPresent(#19 播报 redactForSpeech)/无语音走 screen 张 | [ok] `tier1-approval-live.test.ts` 9 例(播报/accept/reject/超时/barge-in/无 turn_ref/screen/busy 转屏/重复裁决)|
| barge-in 作废 presentation | `confirm.invalidateOnBargeIn` + `canConsumeByBareYes`;裸肯定不消费必重播 | [ok] approval-live barge-in 例 |
| approveAction 工具 + console 审批页 | `liveTools.approveAction`(presentation 对账 fail-closed)+ `POST /api/approvals/:id/decide`(screen)+ Approvals.tsx 批准/拒绝按钮 | [ok] approval-live console decide 例;liveTools 注册 |

## 6. 三熔断 / settle barrier / 取消 / 恢复

| 项 | 实现 | 证据 |
|---|---|---|
| 三熔断(活跃墙钟审批期停表/回合/成本) | `enforceBudgets`(activeMs 扣 approvalWaitMs;toolCalls>maxTurns;SUM api 行>maxCost)⇒ kill+blocked | [ok] executor 回合熔断 + 墙钟熔断例 |
| settle barrier(proof 齐备才写 outbox) | `settleAttempt`:verify 绿 → write-tree → `Tier1SettleProof.parse` → settled_review → ready_for_review → enqueue(occurrenceKey=attempt);blocked/failed 最小 proof | [ok] executor settle 例(proof 四字段 + outbox);story-e2e 全闭环 |
| 取消链 Tier1CancelProof | `cancelWithAutoSettle` → reap kill → `settleCancel`(proof 齐备)→ cancel_settled;无活跃 run 即时 settled | [ok] executor 运行中取消例(proof processExited/worktreeLockReleased/lastEventId)|
| §12-7 恢复 | cancel_requested 重启补结算;reserved 重供给;running 降级"摘要+diff 注入新会话"同 run 续用;数据不一致落终态;起新前 killOrphanAgent | [ok] executor 恢复 3 例(running 降级/cancel 补结算/B2 不一致落终态)|
| 状态词纪律 | 回叫 "执行和检查都跑完了,等你验收";派发 "排进队列了,到验收点我叫你" | [ok] story-e2e checkStatusWords + golden 全绿 |

## 7. 真实 cursor-agent 端到端(4.1 全链复验)

一次通过(证据 `e2e/poc/tier1-live-executor/`):认领 → 真 agent(内置 write 改 GREETING.txt)→ `ls -la` 过审批门放行(gate decisions count=1)→ verify 真跑(`package_script:test` exit 0)→ Tier1SettleProof(真实 git write-tree)→ ready_for_review → approve → 人工合并(真 commit-tree 对账)→ task_done。

## 8. 计划 4.1 出口验收项逐项对照

| 4.1 验收项 | 证据 | 结论 |
|---|---|---|
| 改文件→verify 绿 | story-e2e + live e2e | [ok] |
| 白名单外拒绝 | security 非白名单拒冻;无登记=blocked | [ok] |
| 凭据不可见 + .env 升级 | strippedAgentEnv;cmdEffect .env 触碰升 S2 | [ok] |
| cursor_cli hooks 审批门 e2e(deny 拦截 + 阻塞放行) | gate-socket 物理链 + 真实 agent allow/deny | [ok] |
| 改 gate 后 canary 触发 cancel | executor canary ⇒ failed | [ok] |
| 改 test 脚本被 digest 拦→Plan Delta | security content_drift(含 pre/post) | [ok] |
| 跨站/DNS-rebinding 调 daemon 被拒 | `tier1-security.test.ts` G1 网络半边(既有) | [ok] |
