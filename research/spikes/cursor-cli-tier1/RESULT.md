# Spike 8(CLI 变体)· Cursor CLI 作 Tier 1 执行后端 —— 实测通过

**日期**:2026-07-23 · **账号**:(订阅账号邮箱私存)(`cursor-agent status` [ok] 订阅登录,**零 API key**)· **版本**:cursor-agent 2026.07.20-8cc9c0b
**动机**:owner 要求本机开发走 Cursor **CLI 订阅额度**(而非 `CURSOR_API_KEY`——该账号 CLI 有额度、API key 无额度),接受较慢延迟先跑通。

## 结论:CLI 可承载 Tier 1 审批门(canUseTool 等价物)—— GO(dev 机)

`cursor-agent -p --force --trust` + 任务 worktree 内 `.cursor/hooks.json` 的 `beforeShellExecution` 钩子,可在**无头模式**下对每条 shell 命令**同步阻塞、等 daemon 决策、可靠拦截**。这是 Tier 1 安全模型(S2 动作执行前阻塞等批准)的物理前提,已验证成立。

## 三项实测(本目录 hooks.json + hooks/gate.sh 为通过版原件)

| 测试 | 方法 | 结果 |
|---|---|---|
| A · deny 拦截 | 决策信箱缺省=deny,让 agent `touch PWNED_A.txt` | [ok] 钩子触发(hook-fired.log 有记录);**文件未创建**;agent 如实报告"被拦截、不绕过"。**`--force` 下 deny 仍生效**(关键) |
| B · allow 放行 | 决策=allow,让 agent `touch notes_b.txt` | [ok] 钩子触发;文件创建成功;agent 报告退出码 0 |
| C · 阻塞等待(canUseTool 真语义) | 钩子轮询决策文件;后台"daemon"在钩子触发 +3~4s 后写 allow | [ok] 钩子同步挂起 ~3.4–4.4s 后拿到 allow → 命令放行(约束单命令 prompt 下稳定复现 3/3);证明"阻塞→等用户→再继续"闭环 |

> **C 的一个诚实观察**:开放式 prompt 下,agent 首条命令被门控放行后,可能自行追加多条探索命令(读 `.cursor/hooks.json`、翻目录等)——每条都被钩子正确门控,但会搅乱"单命令是否落地"的判定,曾致一次批量跑 C 误判 FAIL。约束成"只执行这一条、别的都不要"后 3/3 稳定通过。**对实现的提醒**:审批门要按"每条 shell 命令一次决策"设计(agent 一个回合可能发多条),daemon 决策信箱不能一次 allow 长期有效——每条命令独立审批(否则第二条搭第一条的便车)。

## 关键约束(来自官方文档 + 社区实证 forum.cursor.com,2026-07)

1. **CLI 只有工具级钩子生效**:`beforeShellExecution`/`afterShellExecution`/`preToolUse`/`postToolUse`/`beforeReadFile`/`afterFileEdit`;生命周期钩子(afterAgentResponse 等)CLI 不触发。**对 Tier 1 足够**——S2(装依赖/push)都是 shell 命令,被 beforeShellExecution 覆盖;worktree 内文件写隔离无害。
2. **只有 `deny` 被可靠执行**,`ask`/`allow` 当前有 bug 被忽略/被 allowlist 抢占。**正好契合 fail-closed**:用 `--force`(除非显式 deny 否则放行)+ 钩子"默认 deny、批准才不 deny",**只依赖已验证的 deny 语义**;审批表达 = daemon 决策后钩子返回非 deny。
3. **JSON 必须用 `jq` 构造**:畸形 JSON 会 fail-open 静默放行(安全隐患,近期修复但坚持 jq)。gate.sh 已全程 jq。
4. **无 live steer**:CLI 无流中注入 → steerTask 应答 `queued_delta`/`cancel_resume`(09 §13 三态本就预留)。
5. **观测到的鲁棒性事件(适配器需处理)**:① Fable-5 命中安全过滤会自动切 Opus 4.8(命令措辞"PWNED"触发,无关但要吞掉切换提示);② 偶发 `Connection lost, reconnecting`(自动重连成功)。适配器:墙钟超时 120s + 吞模型切换/重连提示 + 未知事件 fail-closed。
6. **延迟**:每轮 30–46s(含重连/切换)——owner 接受(dev 期);执行档非对话档,后台任务可容。

## 落地映射(→ 07 D8 / 09 §11 已回填)

- dev 机 Tier 1 缺省 = **cursor CLI 订阅**:`[models.dev] agent="cursor", transport="cli"`;执行器每建一个任务 worktree,写入 `.cursor/hooks.json`(gate 回连 daemon 的审批 socket),`cursor-agent -p --force --trust [--resume <chatId>]` 驱动。
- resume:`--resume <chatId>` / `create-chat`(订阅态,已存在)。
- API/SDK 路径(`@cursor/sdk` + `CURSOR_API_KEY`)= **后续优化**,脚本备于 `../cursor-sdk-tier1/`;等 owner 想用 API 或需要更低延迟/更强流式时再切,接口同一层(canUseTool 语义抽象)。

## 复现

```bash
# 前提:cursor-agent 已登录(cursor-agent status);jq 已装
bash run.sh   # 见本目录 run.sh(A/B/C 三测)
```
