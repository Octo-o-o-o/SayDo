# 零上下文对抗评审:两份流程方案(SayDo PROC-01 / OctoWorkFlow 收口方案)

你是零上下文的只读 reviewer。你没有参与这两份方案的写作,不要相信方案里的任何断言,只相信你在本会话里实际读到的文件和实际跑出的命令。不要修改任何文件,不要 commit,不要跑 `just ci`、`npm test`、`pnpm test` 这类重门禁;允许 `git log`、`git show`、`grep`、`sed -n`、`ls`、`wc`、`shasum` 与 Python 只读脚本。时间预算 25 分钟,超时前先落结论。

## 评审对象(两个仓库,两份方案)

1. SayDo 方案:`docs/plan/2026-09-02-process-convergence-plan.fable.md`(当前仓库 `~/WorkSpace/SayDo`,main `b32e878`)。
2. OctoWorkFlow 方案:`~/WorkSpace/OctoWorkFlow/docs/2026-09-02-workflow-v2-outcome-lifecycle-plan.fable.md`(该仓 main `0b93139`)。

两仓的定位刻意不同:SayDo 是给人类用户的完整产品,方案要收敛它的工程流程;OctoWorkFlow 是加载进 Claude Code / Codex / Cursor 会话的开发纪律(全局指令 + skill + 只读校验器),方案要让它用结果数据证明自己、对自己适用、保持轻与可携带。

## 只评这五个维度,每条发现给 A/B/C 级、file:line 与可复现命令

1. **事实核验**:两份方案 §1 的每条事实(行号、数字、命令结果、提交 SHA)是否与当前仓库一致。抽样不算数,§1 逐条过;错的写出实际值。
2. **同质化**:是否有条目把 SayDo 做成了流程平台,或把 OctoWorkFlow 做成了产品/服务;是否有内容在两份方案里重复而只该在一处;§5 分工表是否自洽。
3. **与既有纪律的冲突**:SayDo 方案是否违反 `docs/plan/IMPLEMENTATION-PLAN-2.md` 的唯一串行链、`docs/plan/2026-08-28-project-gap-closure-program.md` §20.2 的 I/E 纪律、`AGENTS.md` 硬规则(零 emoji、契约不分叉、Gate 0 等);OctoWorkFlow 方案是否与 `workflow/v2-policy.json`、`workflow/supervised-delivery.md`、冻结 policy 不追溯原则冲突。
4. **过度设计与可裁项**:哪些条目回报低于成本、应删或降级;哪些估算不可信。
5. **阻断性遗漏**:缺了什么会让 PROC-01 或 OctoWorkFlow 阶段 A–D 无法按写明的验收通过。

## 输出格式(写到 `-o` 指定的文件,Markdown,零 emoji,状态词只用 [pass] / [fail] / [warn])

```
[pass|fail] 总结一句;A/B/C 计数
## SayDo 方案
| id | 级别 | 位置 | 复现命令 | 实际结果 | 修改建议 |
## OctoWorkFlow 方案
(同表)
## 同质化与分工
(逐条)
## 未核验项(写明原因)
```

A 级 = 事实错误、纪律冲突或阻断性遗漏;B 级 = 会导致返工的不足;C 级 = 措辞与体量。不要提出增加 reviewer 数量、追补历史 receipt 或建常驻服务的建议。
