# PG-02 现场恢复事实对账(本调用只对账,不修旧根因)

> 记录对象:旧候选现场、旧预算台账、归档 tag、历史 RED 与误读 GREEN。
> 本文件是事实登记,不改变任何旧文件,不洗预算,不把历史结论清零。

## 1. 旧候选现场(只读)

| 项 | 事实 |
|---|---|
| 旧 worktree | `~/.codex/worktrees/saydo-fortnight-audit/SayDo` |
| 状态 | 只读;存在大量他人 WIP(约 177 项 dirty),**不整包复制** |
| 归档 tag | `6404824a21c37670f274e8516681f061e53b542f`(git cat-file: commit,在场) |
| 既有 research 基线 | `d023ffcebfad38563bc988977192e77654d7e2a1`(候选当前 HEAD 同基点) |

处置:只读核对其存在性与引用价值;旧 WIP 不搬入本候选,旧根因不在本调用修复。

## 2. 旧预算台账(不改)

| 台账 | 文件 | 额度与用量 |
|---|---|---|
| 主账 | `~/.codex/tasks/saydo-pg02-resumption-20260923/continuation.json` | `repairs_started=8, reviews_started=8`(8 修复 8 评审,产品 RED);`repair_limit_additional=3, review_limit_additional=3` |
| 追加窗口 | `~/.codex/tasks/saydo-fortnight-audit-20260927/pg02-extension.json` | `additional_repairs=3, additional_rereviews=3`;`repairs_started=1, reviews_started=0`(已用 1/0) |

## 3. 历史结论保留

- 旧 PG-02 窗口存在 prior RED 评审结果与累计预算消耗;曾出现把合同级检查误读为
  GREEN 的记录。**保留历史原样**:RED 不归零、预算不重置、误读按"历史判断"登记。
- 旧 PG-02 实施卡曾指示"不声称合同 GREEN、不在该窗口实现 truth-plane
  ledger/checker"。本任务的新授权(modular-foundation consolidated-final +
  IMPL-PROMPT)允许做**合同与排产导入检查点**,但仍禁止生产行为变更;
  两者不冲突:本调用只落到 `contract` 层,不宣布任何产品验收。
- `pg02-extension.json` 的 `reviewer_count=1` 与 `owner_decisions_20260927`
  (具名链扩展、sc51 授权)为历史授权记录,不外溢为本任务额度。

## 4. 对账结论

- 本调用 PG-02 前置义务 = **对账**,已完成:旧现场只读核对、台账数字照录、
  归档 tag 在场、RED/预算/误读全部保留。
- 后续 PG-03~06 的"实施"仍需各自阶段授权;本文件不构成对它们的开始。
- 任何"本候选已通过 PG-02 验收"的说法都不成立——本次只到合同检查点,
  独立评审未发生。
