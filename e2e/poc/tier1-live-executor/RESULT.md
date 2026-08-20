# Tier1 生产执行器 · 真 cursor-agent 端到端 —— 实测通过

**日期**:2026-07-25 · **账号**:(订阅账号邮箱私存)(cursor-agent 订阅登录,零 API key)· **二进制**:`cursor-agent 2026.07.23-e383d2b`(锁定副本 `~/.local/share/cursor-agent/versions/2026.07.23-e383d2b/cursor-agent`)· **模型**:sonnet-4.5(流内 `system.init.model="Sonnet 4.5"`,familyOf→claude,严格档满足)

## 结论:执行器全闭环成立 —— GO(dev 机)

故事一真实版一次通过(44.5s):**语音派单产出的 queued 任务 → 执行器认领 → git worktree 供给 + 审批钩子 → 起真 cursor-agent(`-p --force --trust --output-format stream-json`)→ agent 真实改文件(内置 write 工具)+ 跑 shell(`ls -la` 经审批门放行)→ daemon 独立跑 verify(白名单冻结重校,真跑 `package_script:test`)→ Tier1SettleProof(treeSha=真实 `git write-tree`)→ ready_for_review → reviewTask approve(evidenceDigest 库内自取)→ 人工合并(受信终端 `git commit-tree` 产出恰为批准 tree)→ verify-merge treeSha 对账 → task_done**。

门控运行(不进 CI 双矩阵,外部 LLM 有延迟/耗订阅额度/不确定性):
```bash
SAYDO_LIVE_E2E=1 pnpm --filter @saydo/daemon exec vitest run test/tier1-live.e2e.test.ts
```
测试源:`packages/daemon/test/tier1-live.e2e.test.ts`(检查点①遵守:PoC 独立临时 git 仓,绝不碰 dogfood 真仓)。

## 本会话真实输出(vitest)

```
level=info msg="live agent produced GREETING" content="hello from saydo tier1"
level=info msg="live gate decisions" count=1
[pass] test/tier1-live.e2e.test.ts (1 test) 44461ms
       认领 -> 真 agent 改文件 -> verify -> settle -> ready_for_review -> approve -> 人工合并 -> task_done
Test Files  1 passed (1) | Tests  1 passed (1)
```

> 注:`evidence/events.jsonl` 是 cursor-agent 原始事件流,agent 自然语言回复里含 emoji(勾/警告符);
> 为过零 emoji 门禁(11 §12,agent 输出非我方呈现层),这些字符按 JSON `\uXXXX` 转义存储——
> `JSON.parse` 后与原 emoji 完全等价(同一数据的等价序列化,非篡改;check-emoji.sh 注释既定做法)。

## 证据文件(evidence/)

| 文件 | 内容 |
|---|---|
| `events.jsonl` | 真 cursor-agent 事件流 83 行:`system.init`(model)→ thinking → `editToolCall`(写 GREETING.txt)→ `shellToolCall`(ls -la)→ `result`(is_error=false,含 usage tokens)|
| `verify.json` | daemon 独立跑 verify:`package_script:test` exitCode=0(真跑 `node -e`,worktree 内)|
| `frozen-verify.json` | dispatch 冻结的 verify argv + 脚本 digest(执行前重校基准)|
| `gate-fired.log.txt` | 审批门触发记录:`ls -la` 经 hook 回连 daemon socket(cwd 匹配 worktree)——`.txt` 后缀入库(避 `*.log` gitignore)|
| `00-cursor-version.txt` | 锁定二进制版本 |

## 校准过的实测事实(后续会话免重踩)

1. **cursor-agent stream-json 顶层事件**:`tool_call` 的 subtype=`started`/`completed`,shell 命令在 `tool_call.shellToolCall`、文件编辑在 `tool_call.editToolCall`(嵌套);`system.init.model` 顶层带模型名("Sonnet 4.5" 首字母大写,familyOf 已 toLowerCase 兜);`result` 事件 `is_error` + `usage{inputTokens,outputTokens,cacheReadTokens,cacheWriteTokens}`。
2. **内置 write 工具改文件不过 `beforeShellExecution`**(worktree 内文件写隔离,S0,spike 结论坐实);只有 shell 命令过审批门 —— 故事一改文件全自动无需人工审批,S2 上浮只在 agent 主动跑 install/push 类 shell 时触发。
3. **两个实现 bug(本会话修复,commit 见 evidence executor-batch)**:
   - **cwd 匹配**:hook 上报的 cwd 经内核规范化为 `/private/var/...`,而 `mkdtemp` 的 worktree 是 `/var/...`(macOS symlink),字符串不等 ⇒ `findRunByCwd` 失败 ⇒ 对所有 shell fail-closed deny(连 S0 的 ls 都拦,是安全过严 bug)。修:两侧 `realpathSync` 规范化(`executor.ts` canon)。**首跑即被此 bug 拦下,agent 如实报告"命令被 hook 阻止、不绕过"——deny 语义在真实 agent 下生效的意外强证据**。
   - **进程不退出**:`--output-format stream-json` 模式 cursor-agent 发完 `result` 事件常不自退,`proc.wait()` 永挂。修:`result` 事件 = 权威完成信号,收到即收尾 + hardKill 释放进程组(`realAgentSpawner`)。

## 审批门 deny/放行的多层覆盖(非本 live e2e 单点)

- **物理链**(deny 缺省/allow 放行/daemon 不可达=deny/畸形响应=deny/未知路由=deny):`tier1-gate-socket.test.ts` 6 例,真 bash + 真 curl `--unix-socket` + 真 jq。
- **真实 agent gate allow**:本 e2e `gate decisions count=1`(ls -la 过门)。
- **真实 agent gate deny**:cwd bug 首跑时 ls 被 deny,agent 如实"被拦截不绕过"(+ spike 8 `research/spikes/cursor-cli-tier1/` A/B/C 三测)。
- **canary/S2 上浮/超时/barge-in**:`tier1-executor.test.ts` + `tier1-approval-live.test.ts`(fake gate,确定性)。
