# 零上下文对抗评审(第二次派发,范围收窄):两份流程方案

你是零上下文的只读 reviewer。不相信方案里的任何断言,只相信本会话实际读到的文件与实际跑出的只读命令。不要修改任何文件,不要 commit,不要跑 `just ci` / `npm test` / `pnpm test` / `bash scripts/check.sh`;允许 `git log`、`git show`、`grep`、`rg`、`sed -n`、`ls`、`wc`、`shasum`。

时间预算 20 分钟,硬性要求:开始后 15 分钟内必须开始写最终报告;报告不超过 120 行。上一次同题派发因范围过宽在 1800 秒硬超时前未产出结论,本次不要重复那条路。

## 对象

1. SayDo 方案:`docs/plan/2026-09-02-process-convergence-plan.fable.md`(当前仓库,main `b32e878`)。
2. OctoWorkFlow 方案:`~/WorkSpace/OctoWorkFlow/docs/2026-09-02-workflow-v2-outcome-lifecycle-plan.fable.md`(该仓 main `0b93139`)。

两仓定位不同:SayDo 是给人类用户的完整产品;OctoWorkFlow 是加载进 Claude Code / Codex / Cursor 会话的开发纪律(全局指令 + skill + 只读校验器)。

## 不要做的事

- 不要重新核验两份方案 §1 的事实与数字:另一名独立 reviewer 已按固定清单核验 12 条,12 条一致。
- 不要展开阅读两仓的产品代码、journal 全文或历史评审;只读下面列出的参照文件。

## 参照文件(只读这些)

SayDo:`docs/plan/IMPLEMENTATION-PLAN-2.md`(1–60 行)、`docs/plan/2026-08-28-project-gap-closure-program.md`(1447–1530 行)、`AGENTS.md`、`HANDOFF.md`(1–60 行)、`scripts/check-public-tree-privacy.mjs`(60–100、236–262 行)。
OctoWorkFlow:`workflow/v2-policy.json`、`workflow/supervised-delivery.md`、`workflow/cycle-state.md`(1–60 行)、`workflow/project-profile-template.md`、`scripts/install.sh`、`README.md`(第四节、第七节)。

## 只回答三个问题,每条发现给 A/B/C 级、file:line、复现命令

1. **纪律冲突**:SayDo 方案(尤其 §3.1 P1 的排产指针设计与 §3.1 头部的 I/E 说明)是否违反 PLAN-2 顶部"唯一排产源 / 不得保留第二个 active/next"与 program §20.2 的九条;OctoWorkFlow 方案(尤其阶段 A 的 control_dir 过渡、阶段 C 的安装收据与 doctor、阶段 D 的 profile 前置)是否与 policy、supervised-delivery 与"冻结 policy 不追溯"冲突。
2. **同质化**:两份方案 §5 分工表是否自洽;有没有同一件事两边都认领、或一边认领另一边无消费者;有没有条目把 SayDo 做成流程平台、把 OctoWorkFlow 做成产品。
3. **验收可判定性**:每个阶段的验收与 focused gate 是否是可直接执行、可判红绿的命令与断言;引用的脚本、flag、字段是否存在(存在性用 `ls` / `grep` 核)。

## 输出格式(写到 `-o` 指定文件;Markdown;零 emoji;状态词只用 [pass] / [fail] / [warn])

```
[pass|fail] 一句总结;A/B/C 计数
## SayDo 方案
| id | 级别 | 位置 | 复现命令 | 实际结果 | 修改建议 |
## OctoWorkFlow 方案
(同表)
## 分工与同质化
(逐条)
## 未核验项(写明原因)
```

A 级 = 纪律冲突或阻断性遗漏;B 级 = 会导致返工的不足;C 级 = 措辞。不要建议增加 reviewer 数量、追补历史 receipt 或新建常驻服务。宁可少报,不可虚报。
