# Codex 评审 24：双目录合并迁移终审

你是独立对抗性评审者。请在 `/Users/wangyixiao/WorkSpace/SayDo` 中只读检查当前未提交工作树相对
`838aeea` 的迁移改动，并将完整评审写入：

`research/codex-findings/24-repo-merge-migration-review.md`

除该报告外不要修改任何文件，不要提交、推送，不要启动 subagent。

## 背景

- 历史上设计/研究资料在相邻的 `voice-coding` 非 Git 目录，实现代码在 `SayDo` Git 仓库。
- 本轮目标是把今后的唯一开发入口收敛为 `SayDo`，同时保留可验证、可回滚的旧目录冷档。
- 当前分支为 `codex/merge-voice-coding-20260729`，尚未提交。
- 迁移方案与证据入口为 `docs/plan/MIGRATION.md`。
- 源目录完整清单为 `docs/plan/migration/source-prearchive-manifest.tsv`。
- 迁入文件双端校验清单为 `docs/plan/migration/migrated-files.tsv`；它会在最终回修后重生成。
- 当前 canonical 是 `docs/01–11 + docs/modules/ + docs/adr/`，当前排产源是
  `docs/plan/IMPLEMENTATION-PLAN-2.md`。
- 设计 ADR 位于 `docs/adr/design/`，工程 ADR 位于 `docs/adr/` 根目录。
- 旧目录尚未归档/切换；只有通过本轮终审和回修后才会执行原子重命名与兼容 symlink。

## 必查问题

1. 数据丢失与可回滚性：源清单、迁入映射、冷档边界是否足够证明未静默丢文件；脚本是否会漏检路径、类型、mode、内容或 symlink。
2. 单仓闭合：活动 README、AGENTS、HANDOFF、当前计划、canonical、工程代码和测试是否仍依赖相邻旧目录。
3. 权威关系：canonical、计划、research、history、设计 ADR 与工程 ADR 的边界和引用是否自洽，是否产生双真相源。
4. 运行集成：模板默认路径、FTS spike 文档路径、emoji gate 的 cwd、knowledge foundation 指针是否能在仅有 SayDo 的环境工作。
5. 迁移说明：`docs/plan/MIGRATION.md` 的命令、数字、回滚步骤和未完成状态是否真实，是否会误导执行者。
6. 安全：是否把 token、密钥、日志、依赖缓存或不应入 Git 的大文件迁入；是否存在路径穿越、覆盖或破坏性操作风险。
7. 验证充分性：结合本工作树的实际测试与文件状态，指出收口前还必须补的证据。

## 输出格式

- 先给总体结论：`通过` / `有条件通过` / `不通过`。
- 按严重度列出发现：
  - A：数据丢失、安全、合同/状态机破坏、单仓目标未达成，必须修。
  - B：一致性、集成或可维护性风险，建议本轮修。
  - C：非阻断改进。
- 每条必须给出真实 `file:line` 或实际命令输出证据，说明影响与最小修复建议。
- 单列“已核验无问题”与“仍需最终执行后复核”。
- 不要使用 emoji；状态标记使用 `[ok]`、`[warn]`、`[fail]`。
