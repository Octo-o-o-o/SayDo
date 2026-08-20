# Codex 28 · 项目状态归档发布前回修复评

请对 `/Users/wangyixiao/WorkSpace/SayDo` 做只读对抗性复评，不修改文件。

## 背景

Codex 27 的报告在 `research/codex-findings/27-project-status-archive-review.md`。本轮已针对其
A/B/C 发现和两路独立评审意见做回修，重点包括：

- 生产备份覆盖 SQLite、全局 session JSONL 与所有 active workspace knowledge；
- 快照在 `.partial` 中复制并校验后原子发布，manifest v2 记录 completed、来源角色、项目、
  SHA-256 与字节数，必需项目 knowledge 缺失时 fail-closed；
- 手工与定时备份统一读取 `backup_retention_days`，定时任务同步异常也进入 catch；
- owner session 1–4 改为锁定 runtime 的 fail-fast preflight，补持久运行记录、S3 Touch ID
  主路径与人工 fallback 分界；
- 新增 `e2e/owner-sessions/runtime-deploy.md` 和 `scripts/runtime-preflight.sh`；
- 修正文档中 writing effective、A3 provider 形状、当前 runtime、已实施/未实施及授权边界；
- 新增 `history/2026-07-29-migration-and-implementation-status.md`。

真实生产快照 `/Users/wangyixiao/.saydo/backups/20260729T143851Z` 已生成；只读核对
manifest v2 completed、SQLite quick_check、session 与 OctoDesk knowledge 逐文件 diff。

## 复评范围

1. 上述新增和修改文件的当前未提交 diff；
2. `research/codex-findings/27-project-status-archive-review.md` 的每个 A/B/C 发现；
3. 备份实现及 `packages/daemon/test/backup.test.ts`；
4. 状态归档、HANDOFF、PLAN-2、docs/05、docs/09、四场运行册与部署运行册；
5. 当前 Git/runtime/launchd/health/tag 与非敏感数据库聚合状态。

迁移 manifest 会在所有报告和 journal 最终静止后统一刷新，因此“当前中途清单尚未刷新”不是
独立缺陷；但请检查最终刷新前是否还存在会令清单无法闭合的内容错误。

## 评审问题

1. Codex 27 的 A 级项是否都已被正确关闭，是否引入新的安全、契约或数据丢失级问题？
2. 快照是否能明确判定完整/半成品，active workspace 路径与恢复映射是否充分？
3. owner 是否可能验错 runtime，或把 fallback/自动化误记为真人主路径通过？
4. 归档的当前阶段、owner/Codex 分工是否与真实代码、运行现场和发布门一致？
5. 在刷新派生清单、写 journal、跑 `just ci` 之外，是否仍有收口前必修项？

## 输出格式

- 先给 Go / Conditional Go / No-Go。
- 按 A/B/C 分级；每条给事实、证据、影响和最小修法。
- 单独列出 Codex 27 A-1 至 A-5 的关闭状态。
- 最后给一句话阶段判断及 owner/Codex 各自最近一步。
- 无法核实的内容明确写未验证，不得推断。
