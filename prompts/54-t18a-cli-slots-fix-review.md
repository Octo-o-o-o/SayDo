# T18a-fix 补位审回修对抗性评审

你是 SayDo T18a-fix 的对抗性只读评审者。仓库
`/Users/wangyixiao/WorkSpace/SayDo`，修复基线
`b31a5c34774cefe7cc148c40c4261438e1b06ccd`，当前分支
`feat/t18a-cli-slots`。不要修改文件，不要启动 subagent。

先完整阅读 `AGENTS.md`、当前 `git diff b31a5c3`、
`research/codex-findings/53-t18a-cli-slots-review.md`、
`docs/07-tech-stack-decisions.md`、`docs/09-data-contracts.md` 与所有相关源码和测试。

逐项寻找可复现反例：

1. A1 runtime registry 是否只能由成功 self-test 发布；receipt 是否覆盖 binding、binary digest、
   observedModel 四字段和 testedAt，并由生产 resolver 回查不可变成功审计；手写/复制 registry、
   旧版本 registry、伪造 `verified_binary_default+observedModel` 是否 fail-closed。
2. A2 旧用户轮先结算时是否仍可能清掉新用户轮的 in-flight 状态、泵起 control queue 并 abort
   新输入；generation/controller 所有异常和取消路径是否正确。
3. A3 recovery-only 的 restart、SIGINT、SIGTERM 是否先永久 draining、拒绝新 CLI 调用、abort
   并等待子进程 settled，再关闭连接、spawn/exit；是否仍有 120 秒等待、后代泄漏或新旧并存。
4. B1 Codex 所有白名单事件上的 `model` 是否都按 stream 校验，固定族豁免能否覆盖流内冲突。
5. B2 setup 是否在 thinking 自检/登记后按候选 runtime 实况重新解析 evaluator；结果是否与随后
   probe/生产 resolver 一致，尤其 thinking=Claude CLI、evaluator=Claude API、无 same-family ack。
6. B3 各供应商 stderr/结构化事件中的订阅/额度/速率限制是否在通用非零退出前归类为
   `subscription_rate_limited`，普通认证/网络/进程错误是否会误分类，retryable 与 canonical 是否一致。
7. B4 fake CLI 是否真的从 spawn 边界写非法 NDJSON，并有持续输出后静默触发 idle watchdog 的
   进程反例，而非只测终态正文 JSON 或 wall timeout。
8. cheap/tripwire 根因是否全关：thinking/cheap/evaluator 的 self-test 与生产一发一收 prompt 头部
   是否逐字硬禁命令/读文件，默认 cwd 是否逐调用空目录且 finally 清理，不传仓库/HOME；tripwire
   且零消费是否只强化重试一次，再触发如实失败；输出侧 tripwire 是否仍 fail-closed。
9. 检查新增 receipt registry 迁移、SQLite audit 读取、pending activation 晋升、并发 limiter、输入 cap、
   schema 文件与 cwd 清理是否引入新安全退化、数据丢失、死锁、资源泄漏、合同分叉或不可编译问题。

按 A（安全/合同/数据丢失/错误武装，必修）、B（重要）、C（建议）分级；每项给精确
`file:line`、具体反例和最小修法。若原 3A/4B 已关闭，逐项给 Fixed 证据。明确列出实际执行的
命令及验证边界。最终输出 Go/No-Go、A/B/C 数量、OPEN QUESTION。不要把沙箱权限失败写成代码
失败，也不要把未运行的测试写成通过。

## 同线程续审输入摘要

初审报告落盘后，沿同一 Codex thread
`019ff12e-4026-71a2-9962-a02e83271581` 逐轮续审；逐字输入与完整 JSONL 见
`logs/54-t18a-cli-slots-fix-review.log`。续审始终保持只读、禁止 subagent，并要求每轮重查原
3A/4B、tripwire 三点与相邻安全链：

1. 复核 active/pending receipt 的 activation 绑定与重签顺序、POSIX 进程组 drain、tripwire
   sticky 状态/唯一重试预算、订阅记账 sticky、限流误报和 session suspend 生命周期。
2. 回修后复核 barge-in 到 ASR final 间的 speech gate，以及 stderr/失败 envelope 跨字段、跨行
   负面语境；要求给出新的可复现反例，否则明确 A/B/C=0。
3. 发现失败 envelope 漏收 `result`/字符串 `error` 后，复核“只对 failure event 收集整个
   envelope 字符串叶、先排除 auth/proxy/disk 再匹配额度”的修法及三家正反例。
4. 发现递归深度缺口后，复核显式 worklist、逐项 push 与 20,000 层且小于 512KB 的反例；并
   再次确认原 3A/4B、tripwire、speechPending 未退化，输出最终 Go/No-Go 与验证边界。
