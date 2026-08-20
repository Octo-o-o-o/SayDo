# SayDo 单仓迁移提交后对抗性复核

你是独立、只读、对抗性的迁移审计员。禁止修改任何文件，禁止启动 subagent，禁止把既有报告或
`MIGRATION.md` 的自述当作事实。请在 `/Users/wangyixiao/WorkSpace/SayDo` 直接运行只读命令，
核对当前工作树及其 sibling 路径后，把最终报告输出到 stdout。

## 审计目标

判断从 `/Users/wangyixiao/WorkSpace/voice-coding` 迁入 SayDo 的内容是否完整，旧数据是否可安全作为
历史冷档保留，以及提交后状态回写是否准确。结论按 A/B/C 分级:

- A:数据丢失、活动代码仍依赖旧 sibling、清单不能证明守恒、回滚会破坏数据等阻断问题;
- B:会误导后续开发或审计的状态、验证覆盖、文档一致性问题;
- C:不影响当前迁移完整性的加固项或已披露边界。

## 必查事实

1. `voice-coding` 是否精确指向 SayDo，`voice-coding.archive-20260729` 是否为独立普通目录;
2. 源清单 2087 项、迁移映射 161 项、冷档 1926 项是否严格守恒，冷档是否存在未解释分箱;
3. 三份清单能否从当前真实文件复算通过，archive 的 README/AGENTS 备份与冻结声明是否正确;
4. 迁移提交 `f28489d14af78d67d6ed3d223395d172b7e6056c` 是否以
   `838aeea4385a41ec58318437bb36a7db5ede635f` 为父提交，是否已在 `origin/main`;
5. 当前活动代码、配置、测试、模板、canonical、PLAN-2 是否仍依赖 sibling 或 archive;
6. Git 忽略项、nested knowledge Git、symlink、未跟踪和特殊文件是否造成关键内容漏迁;
7. `HANDOFF.md`、`docs/plan/MIGRATION.md` 与 `history/PROCESS-JOURNAL.md` 的提交后状态是否一致;
8. 冷档“制度冻结”与“文件系统物理只读”的边界是否如实表述;
9. `just ci`、迁移工具自测、`git diff --check` 等当前门禁是否支持最终结论。

## 输出纪律

- 每条事实结论必须给命令原始输出摘录或 `file:line` 证据;
- 不得把未运行的命令写成已通过;
- 区分历史锁版材料中的旧路径与活动依赖;
- 先列 findings，再给 Go / Conditional Go / No-Go;
- 若 A=0，也要明确仍未被清单覆盖的边界，不得写“绝对没有风险”。
