# Codex 攒批评审 20:Tier1 执行器批 canonical 回写复核(补 19 号撞号欠账)

你是 SayDo 项目的 canonical 一致性评审(AGENTS.md 制度:canonical 回写 = 一致性 subagent + Codex 攒批;实施会话原声称编号 19,但 19 已被 plan2 评审占用且未落盘——本次补账,编号 20)。只读,不改文件。

## 评审对象

Tier1 生产执行器批(SayDo `2f657ed..65559c2`)对 voice-coding canonical 的回写:

1. `docs/09-data-contracts.md` §9:`task_messages` DDL(kind 含 steer)与 tier1_runs `(新建)→reserved` 认领边;
2. `docs/09` §11 D8/cursor 段(约 743-746 行):**[tier1] 版本 pin 承载**(cursor_agent_bin 绝对路径 + pinned_version,缺任一不认领 fail-closed)+ **审批门实现形态补录**(gate 脚本 `curl --unix-socket` 回连 daemon HTTP 审批服务,`~/.saydo/tier1/gate.sh` + `~/.saydo/tier1-gate.sock`;自注"比 spike 原型的轮询决策文件更直接,语义同");
3. `docs/09` §13 `steerTask` 应答语义(cursor 无 live steer ⇒ queued_delta 落 task_messages kind='steer');
4. `docs/09` §6.3(如有执行器相关改动,自查 git 区间不可用——voice-coding 非 git 仓,以文内 2026-07-25 执行器批注记为准)。

## 核对维度(逐项给证据与结论)

a. **文实一致**:上述每条 canonical 语句与 SayDo 实现(`packages/daemon/src/tier1/executor*.ts`/`gate*`/`scheduler`/`operations.ts`/`config`)是否逐字对得上?文档写超实现或实现超文档的地方列出。
b. **"语义同"的断言**:§11 说 socket 阻塞等决策与 spike 的轮询决策文件"语义同"——从 fail-closed 四律逐条判(超时=deny/独立审批/只依赖 deny/jq),该等价断言成立吗?
c. **与既有合同的冲突**:[tier1] 两键与 §11 校验规则/§12-9 配置反例是否需要补测试锚?task_messages kind='steer' 与 §6.2/§13 的 steer 语义是否自洽?tier1_runs reserved 边与 §9 转换表其余行是否冲突?
d. **诚实分层**:三条 P1 差距(verify 框架 config 文件在冻结外/verify env 保留 HOME/§12-7 恢复=摘要+diff 非精确 resume)在 canonical 里是否有承载(或至少不与 canonical 的承诺冲突——如 09 是否写了"精确 resume"?写了就是文实矛盾)?
e. 措辞:日期/署名/出处(executor-batch evidence/conformance)引用是否准确。

## 输出

总判(通过/A 必修/仅 B-C)+ 分级清单([A]/[B]/[C]:位置|问题|证据|一句修法)+ 五维度显式结论(干净也要说)。读不到的文件列名。
