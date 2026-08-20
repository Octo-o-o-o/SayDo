# SayDo 迁移/实施状态最终对抗性复评

你是只读的发布前对抗性审计员。仓库位于
`/Users/wangyixiao/WorkSpace/SayDo`。禁止修改任何仓库文件、运行时、数据库、快照或 Git
状态；禁止 commit/push/deploy/restart。不要启动 subagent。

背景：

- 迁移提交为 `f28489d14af78d67d6ed3d223395d172b7e6056c`；当前发布前回修仍未提交。
- Codex 27 初审、Codex 28 迟到报告和 Codex 29 窄复评均已落
  `research/codex-findings/`。其中 28 的四项 A 级是本轮主要关闭目标，29 不覆盖 28。
- 当前真实恢复候选点是
  `/Users/wangyixiao/.saydo/backups/20260729T163416Z`。
- 当前 runtime 仍是旧的 clean `838aeea`，未获授权部署；因此新 preflight 对旧 runtime
  失败是预期，不得误判成新实现已部署。

请独立审计以下内容：

1. Codex 28 A-R1：SQLite、global sessions、每个 active 项目的 foundation/knowledge 是否
   可判定恢复；foundation current pointer/manifest/generation 是否真闭环。
2. A-R2：备份失败、进程崩溃留下 partial、retentionDays=0、已有坏配置、daemon 高频重启时，
   保留期和启动 catch-up 是否 fail-closed。
3. A-R3：active workspace 列表是否从本轮 SQLite 副本派生，是否仍允许数据库与文件映射错点。
4. A-R4：daemon/pipeline 是否固化实际 loaded SHA，hello/health/readyz/preflight/deploy
   是否能证明两进程加载同一目标 SHA；ASR/TTS 与 freshness 是否足以支持真人场次。
5. strict snapshot verifier、运行册、session-1..4 的主路径/fallback/evidence origin/四场同 SHA
   和 commit→deploy→四场→tag/push 时序。
6. `history/2026-07-29-migration-and-implementation-status.md`、HANDOFF、PLAN-2、docs/09、
   journal R61 是否与真实 Git/runtime/生产库状态一致，没有把自动化、恢复点、未部署工作树或
   owner 验收写得过头。

可运行只读命令：`git status/diff/show/log`、`rg`、`sed`、`jq`、`shasum`、`wc`、
`node scripts/verify-snapshot.mjs <snapshot>`、SQLite immutable 只读 URI、typecheck、已有
单测与 `just ci`。若担心命令会写入快照或仓外状态，跳过并说明；不要再对快照执行会生成
WAL/SHM 的普通 SQLite 打开。

输出到 `research/codex-findings/30-project-status-final-adversarial-review.md`，格式：

1. 第一行 `# Go`、`# Conditional Go` 或 `# No-Go`。
2. A/B/C 分级发现；无发现明确写“无”。
3. Codex 28 四项 A 的逐项 closed/partial/open 表。
4. 真实运行的门禁与边界。
5. 最后一句给出当前阶段、Codex 下一步与 owner 下一步；不得把未 commit/deploy/真人验收
   说成已完成。
