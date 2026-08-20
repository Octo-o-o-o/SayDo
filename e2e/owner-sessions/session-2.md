# 场次② 现场清单 · 受控 dogfood gate(Phase 4 出口挂账)

> 目的:轻任务 Tier1 全闭环(不依赖 Hopper)真人过一遍,之后 owner **在受控范围开始每天自用**。
> 非正式交付;所有 Gate 0 项已关闭(dogfood 合法,证据 `e2e/evidence/gate0-checklist.md` 每门绑测试名)。
> 本场次同时是 Brain live 工具环(function-call 采访/拍板)的 dogfood 增量起点(p0-readback staged 第 2 条)。
> 时长预估:30-40 分钟。
> **发布证据锁**:本场 runtime SHA 必须与场次①相同；任一场通过后若代码、有效配置或 SHA
> 改变，四场发布证据失效，须从场次①重新开始。

## 0. 修订(2026-07-25 五路面板走查;接线批 + 执行器批完成后修订——step 2-4 边界解除)

- **硬前置**:HANDOFF §2-9 接线增量批**已完成**(live 工具环/tier1 操作面/SessionManager/停靠调度/
  console 写口;e2e 覆盖:语音派单全链/审批词表消费/验收三态/取消/retry 重派发/停靠老化)。
- **执行器批已完成(2026-07-25)**:**Tier1 生产执行器边界已解除**——认领 queued 任务起 cursor-agent 进程、
  S2 审批门 live 上浮、settle 回叫链全落,真 cursor-agent 端到端实测通过(`e2e/poc/tier1-live-executor/RESULT.md`;
  conformance `e2e/evidence/tier1-conformance.md`;evidence `e2e/evidence/executor-batch.md`)。
  **本场 step 2-4(后台执行 + 逐条审批 + settle 回叫)现已就绪可走查**,全 6 步端到端可跑。
  约场前仍确认 `~/.saydo/config.toml` 有 `[tier1]` 两键(`cursor_agent_bin` 锁定副本绝对路径 +
  `cursor_agent_pinned_version`)——缺配置执行器不认领(queued 任务停队列,处方化日志提示)。
- **A3-armed 后置修订(2026-07-29)**:生产库 active readiness binding 仍为 0，OctoDesk
  新提议会先 fail-closed 到四项 critical 清单的采访与复述确认，不能再按旧口径直接 Quick
  直通。owner 须在本场开始前确认门语义：`gap_critical` 拒绝，`gap_knowledge` /
  `gap_requirement` 作为建议态放行；不接受则先停场回修，不能边验收边默许。
- **owner 手机前置**:装 ntfy app 并订阅 `~/.saydo/.env` 里 `NTFY_TOPIC` 的主题(step 3 升级链要用)。
- 建议插入 10 分钟安全拦截演示(安全路建议):(a) 说"直接 push 到 main"→ 语音拒 + 导屏;(b) 一回合两条 shell,第二条独立上浮(禁便车);(c) 临时置 Gate 0 未关 → dispatch 拒 + 处方化报错(演示后改回;接线批 e2e 已含 Gate 0 拒 dispatch 断言)。

## 前置

| 检查 | 命令/动作 | 期望 |
|---|---|---|
| **dogfood 仓** | 使用 owner 已指定的 OctoDesk coding 项目 | 不在现场另换仓；从低风险小改动起 |
| runtime 服务 | `scripts/runtime-preflight.sh <开场前记录的40位-runtime-SHA>` | 单条 fail-fast 同时断言磁盘与两进程 loaded SHA、clean、runtime 路径及 fresh readyz；禁止另起 `just dev` 验到开发树 |
| Tier1 后端 | `cursor-agent status` | 订阅态可用(dev 机缺省 cursor_cli,审批门 e2e 已绿) |
| Gate 0 | console 全局设置页看 gate0 状态 | enabled=true / bypass=false(显式配置) |
| A3 readiness | 先完成 OctoDesk 四项 critical 的采访与逐项复述确认 | active binding 从 0 升到 4；新包带 readinessRef |

## 步骤与预期

1. **语音派单**:PTT 说一个真实轻任务(如"把 README 的安装一节补个 pnpm 说明")。
   - 预期:若四项 critical 尚未确认，先采访并逐项复述确认；绑定齐全后，信息足够才 Quick
     直通 → 决策包播报(任务+效果+预算)→ 逐步确认档拍板。
2. **后台执行 + 逐条审批**:任务进 worktree 执行;S2 效果(如写文件外的 shell)逐条语音上浮。
   - 预期:每条命令独立审批(禁便车);确认播报**复述关键参数**;答复须命中封闭肯定词表("可以/批准/……"),含糊词不消费;打断后裸"好"不消费(重播才可)。
3. **走开等回叫**:owner 离开电脑做别的事。
   - 预期:settle 四项俱备才回叫(不叫早);升级链 语音→桌面→ntfy;DND 窗口尊重。
4. **回叫接通**:听 one_liner 摘要。
   - 预期:第一句 = 原因;数字来自规则统计(不编数);口径 = "执行和检查都跑完了,等你验收"(**绝不说"完成"**)。
5. **验收三态现场各过一次**(可用小任务重复;owner 触发动作定稿——接线批 2026-07-25 回填):
   - approve:语音说"**验收通过**"(Brain 调 reviewTask approve,evidenceDigest 从 settle proof 库内自取)
     或屏幕:任务详情 → 操作行 → "**验收通过**"按钮;→ 状态转"已批准·待合并";
   - request_changes:语音说"**不行,改 X**"(X = 修改点,Brain 带 comments 调 reviewTask)
     或屏幕:"**提修改(这轮不作废)**"按钮(弹输入框填修改意见)→ 同任务新 attempt 复用 worktree,旧证据不串线;
   - reject:语音说"**算了,这轮不要了**" 或屏幕:"**作废这轮**"按钮(二次确认)→ 走取消链,
     话术 "停了,这轮作废"(worktree 留存可捡回)。
6. **S3 Touch ID 主路径 + 人工 fallback 分开验**:
   - 主路径:approve 后从 `http://localhost:47100` 打开任务详情；首次先注册批准指纹，再点
     "用 Touch ID 批准合并"。记录 challenge/receipt id 与消费结果；成功后经 approveMerge
     进入 merging → task_done。
   - fallback:另起一条任务，屏幕走 requestManualMerge 交接 → 去受信终端亲手合并 →
     回屏幕点 "我已合并,核验"；daemon 现读 treeSha 对账 MergeProof 后进 task_done。
   - 语音说"合并吧"只可给 fallback 指引，S3 绝无语音直批。两条路径证据不得互相替代。
   - Touch ID 是 W4 真人触点，不另行改写场次④“首发交付最终发布裁决点”的定义。若主路径失败，
     可用人工 fallback 继续诊断后续链，但本场 overall 不得记 `pass`、场次③不得解锁；若 owner
     要把 Touch ID 延至首发后，必须先显式修改发布标准。若暴露安全或收据绑定问题则立即停场。
7. **价值证据轨周报挂起**:`GET /api/value-report`(带 token)看周报口径(lane 占比/返工率/接通率)——本场次起积累,**不作 stop/go 门**。

## 失败回退

- 审批门异常(该拦没拦/canary 误触)→ **立即停 dogfood**,保留 worktree 与 audit_log,回会话排查(安全红线优先);
- 回叫吵/漏 → 查 outbox 状态机(dedupe/settle 缺一不叫),调 DND 窗口;
- 执行质量差 → 属模型面非管线面,记 dogfood 反馈异步攒批(不阻塞 P0.5 已收口事实);
- 一次针对性返工后复验;再不过 ⇒ 上浮拍板(降级验收线/换后端),不进入无限返工循环。

## 运行记录

| 字段 | 当前值 |
|---|---|
| overall status | `not_run` |
| Touch ID 主路径 status | `not_run` |
| 人工 fallback status | `not_run` |
| 日期 | 待约 |
| runtime SHA | 待开场记录 |
| release config digest | 待从本场 preflight 原样记录；须与场次①相同 |
| owner verdict | 待 owner |
| A3 前置 | owner 门语义待确认；active binding 当前 0，场内目标 4 |
| 证据来源 | 待注明 `live` / `fixture` / `test`，不可互相替代 |
| 主路径证据 | 待填写 task/package/challenge/S3MergeReceipt/merge result 引用；不使用 MergeProof |
| fallback 证据 | 待填写独立 task/manual handoff/MergeProof 引用 |
