# 4.0 selected-adapter 脚本级预检 · cursor_cli(dev 缺省)

日期 2026-07-25 · 账号 (订阅账号邮箱私存)(订阅登录,零 API key)· **cursor-agent 版本 2026.07.23-e383d2b**(spike 8 时为 2026.07.20-8cc9c0b,+1 版本)。

## 结论:GO(dev 机)——钩子门在当前版本仍 fail-closed 生效

复现:`bash e2e/spikes/cursor-precheck/run.sh`(版本断言 + 钩子门双向)。实测:

| 方向 | 决策 | 结果 |
|---|---|---|
| allow | 决策文件置 allow | 钩子触发,`touch` 执行成功,退出码 0(27.8s) |
| deny | 无决策 -> gate.sh 轮询超时拒 | 钩子触发,文件未创建,agent 如实报"被 hook 拦截、没绕过"(88.9s,含一次 `Connection lost` 自动重连) |

fail-closed 由 gate.sh 构造保证:超时/无决策/畸形一律 deny,jq 构造 JSON 防 fail-open,每条命令独立读决策(禁便车)。

## 观测(适配器 4.1 须处理,与 spike 8 一致)

- **冷启动偶发无工具调用**:开放式 prompt 下 cursor-agent 偶尔快速返回不发起 shell(hook 不触发)——非门失效,是 agent 未执行;run.sh 已加至多 3 次重试。适配器侧按"每条 shell 命令一次决策"设计,不受影响。
- **偶发 `Connection lost, reconnecting`**:自动重连成功(本次 deny 跑命中一次);适配器吞重连提示。
- **延迟**:单轮 28–89s(含重连)——dev 期 owner 接受,执行档非对话档。

## 顺延项(未选后端,不阻塞,计划 v2.3①)

claude_sdk 四能力(streaming/canUseTool/resume/live-steer)顺延至 Claude 订阅购入,不预设"已冒烟"。

## 全链复验归属

真实 worktree + daemon 审批 socket 闭环的 conformance 报告 = **4.1 出口验收项**(本步只做脚本级前置)。
