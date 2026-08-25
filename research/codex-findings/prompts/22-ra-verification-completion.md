# 22 · R-A 落盘核验复核 + 补完方案对抗审

你是独立对抗审查者。只读 `~/WorkSpace/voice-coding/docs/`、`history/PROCESS-JOURNAL.md`、`research/codex-findings/21-ra-contract-review.md`、`docs.bak-r-a-20260727/` 与 `~/WorkSpace/SayDo`，不得修改任何文件。

请逐项核对 journal 的 R50（约 753 行起）所称已落盘/未落盘清单和两处损伤，尤其是 docs/09 的 §3.3、§9 两表、§13 四工具、§6.1a、TTL 注记、tailnet 对表行，以及 approveMerge CAS、S3MergeReceipt、executor 按类型分叉是否存在。再对 21 号报告 A1-A6 给出 canonical 侧最小充分修法（插入锚点、关键措辞、DDL/Schema 增量、§12 反例）并区分 canonical 本轮落盘与 SayDo W4 挂账；裁决 A4 是否回收 writing 默认开值。最后把 B1-B6、C1-C3 分为 canonical/W4/不做，并给出可机械执行的 grep/sqlite3/python 断言。所有事实必须带文件:行号；无法验证明确写“未验证”。输出一份简洁但具体的审查意见，不要声称运行了未运行的命令。

## 终局追认口径（2026-07-27 晚，supersede 上述“给修法”阶段）

A1–A6 已在 journal R51 所述补完，SayDo W5a/W4 也已实施到当前 HEAD
`b5d45e9f7df66f2dad218112edefec0a0af1ddb9`；W4 独立 readback 是
`research/2026-07-27-saydo-w4-impl-readback.fable.md`。请以当前文件实态回答：

1. `docs/09-data-contracts.md` 的 A1–A6 补完是否忠实于 21 号报告，尤其核验
   S3MergeReceipt、approveMerge 五步 CAS、assertS3LocalAndBound、synced-passkey
   条款、readinessSkeleton/readinessRef、proposedAt/唯一活跃索引、
   writingSettleBarrier、enabled_project_types 回收。
2. 07-27 的 R-A、W5a 八条回写、W4 八条回写之间是否仍有矛盾或漏同步。
3. 用 `git show HEAD:<path>` 或先证明工作树文件与 HEAD 相同，抽验 canonical 的
   “已实施”注记；重点追查 readback 的 CI emoji 红灯、writing verify-fail 不
   settle、readiness 第三消费点/生产未 armed，以及任何新发现的契约—实现偏差。
4. 裁决 21 号 `not ready_for_review` 能否翻为 `ready`（R-A 域）；不能则只列
   真正剩余条件，区分 canonical 修订、代码修复、owner 真人触点。

只读，不修改任何文件。每个事实给 `文件:行号`；命令证据给命令、退出码和关键
原始输出。输出控制在 2500 个中文字符以内，先列 A 级，再给终局裁决。
