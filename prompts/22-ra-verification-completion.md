# 22 · R-A 落盘核验复核 + 补完方案对抗审(2026-07-27)

## 背景(事实,均可实读验证)

- 项目 canonical = `/Users/wangyixiao/WorkSpace/voice-coding/docs/`(01–11 + modules/ + adr/);过程档案 = `history/PROCESS-JOURNAL.md`;实施仓(只读参照)= `/Users/wangyixiao/WorkSpace/SayDo`(以 `HANDOFF.md` 与 e2e evidence 为实施现状真相)。
- 2026-07-27 凌晨 R-A 合同轮:某会话把三块合同(S3 卡 WebAuthn / writing 窄版 / 场次①补丁)回写 canonical。该会话期间多次在文本中臆想工具执行结果,今晨由无污染新会话完成独立核验,结论见 journal 的「R50 · R-A 落盘状态独立核验」段(约 753 行起)。
- 你(Codex)上一轮的对抗评审报告 = `research/codex-findings/21-ra-contract-review.md`(结论 A6/B6/C3,`not ready_for_review`)。本轮将以它的 A1–A6 为唯一补完清单继续实施。
- `docs.bak-r-a-20260727/` 是今晨核验前的 docs 快照(与当前 docs 应一致,可用于 diff 佐证「核验过程未改文件」)。

## 任务(全部基于实读,禁止臆想;每条引用一律给 `文件:行号`)

1. **复核 R50 结论**:逐项抽验 journal R50 声称的「已落盘清单 / 未落盘清单 / 两处损伤(09:971 孤立围栏、09:953 `stateःunknown` 非法字符)」,给出确认/推翻。重点抽验:09 §3.3(约 185–221)、§9 两新表(约 549–556)、§13 四工具(约 906–909)、§6.1a(约 382 起)、09:108 TTL 实施同步注记、09:164 tailnet 对表行;以及「approveMerge CAS / S3MergeReceipt / executor 按类型分叉」确实不在文件中。
2. **对 21 号报告 A1–A6 逐条给出 canonical 侧最小充分修法的文本级意见**:插入位置(节/锚点)、措辞要点、schema/DDL 增量、§12 反例清单;明确区分「canonical 本轮必须落」与「实施仓 W4 挂账登记」。特别裁决 A4 的二选一:W4 前 `enabled_project_types` 缺省是否应回收 `writing`(注意 owner 已拍板 writing=worktree 交付、实施=W4——回收开值是否与拍板冲突,给出你的裁决与理由)。
3. **B/C 级三分**:B1–B6、C1–C3 按「canonical 本轮落 / W4 挂账 / 不做」分类,每条一句理由。
4. **给出实施后可机械核验的断言清单**:grep/sqlite3/python 可直接执行的命令级断言(将被逐条实跑用于收口)。

## 状态更新(2026-07-27 晚;因容量/登录故障延迟至此补跑,任务口径随实调整)

原任务 2 的「给 A1–A6 修法意见」已被超越:A1–A6 已于 07-27 上午全量落盘(journal R51,4 subagent 检查 + 每步 grep 复验 + sqlite3 行为级反例),且 W5a/W4 两批已实施收口并经 /impl-review 对账(报告 `research/2026-07-27-saydo-w5a-impl-readback.fable.md` 与 `research/2026-07-27-saydo-w4-impl-readback.fable.md`;W4 readback 抓出 B-3:writing verify-fail ⇒ 不 settle 无机械检查,翻值 gate;B-4:readinessSkeleton 三处同源实为两处)。**你的任务改为终局追认**:
1. 抽验当前 `docs/09` 的 A1–A6 落盘是否忠实于你 21 号报告的修法(S3MergeReceipt 判别/approveMerge 五步 CAS/assertS3LocalAndBound/synced passkey 条款/readinessSkeleton+readinessRef/proposedAt+唯一活跃索引/writingSettleBarrier/enabled_project_types 回收);
2. 检查 07-27 全天多轮回写(R-A 补完 + W5a 8 条 + W4 8 条)之间有无互相矛盾或漏同步;
3. 对照 SayDo 当前 HEAD(`b5d45e9`,W4 收口)抽验 canonical"已实施"状态注是否与代码真实状态一致;
4. 给出你的 not ready_for_review 判定是否可以翻转为 ready(R-A 域),及翻转/不翻转的剩余条件清单。

## 纪律

- 只读 `docs/` 与 SayDo;**不修改任何 canonical 文件**。
- 报告写入 `research/codex-findings/22-ra-verification-completion.md`。
- 无法验证的点如实标注「未验证」,不推断成结论。
