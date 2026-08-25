# 最近一周双向审计与快速启动发布收口复审

你是与实施会话零上下文的对抗评审者。仓库为
`~/WorkSpace/SayDo`，只读审查当前未提交工作树，不修改任何文件，不采信报告里的
“已通过”自述；结论必须来自你实际读到的代码、文档、Git 状态和可安全运行的只读命令。

冻结审计范围：北京时间 `2026-08-15 00:00:00` 至
`3fccf4a704ad9a5d8e013baaefb67c66a5737cba`。本轮目标是：115 个主线提交、131 个全引用提交、
额外 16 个提交、434 个路径、219 份文档型资产的双向逐项裁决；修复可判定漂移；提供
`v0.1.0-rc.2` 无源码 GitHub Release 快速启动；发布前后在 macOS/Windows/Linux 走真实安装入口；
官网中英文口径与实现一致。npm registry 与移动商店不在自动发布范围。

请重点对抗检查：

1. `scripts/week-audit.mjs`、四份 `research/week-audit/`/ledger 输出是否真正锁住冻结全集、人工语义裁决、
   当前工作树内容与公开 snapshot 允许差异；能否在公开快照缺私有 Git objects 时验证。
2. `packages/contracts/src/types/task.ts`、daemon executor/API、console TaskDetail 是否只消费显式
   `AcceptanceCheck`，缺证据恒 `unknown`，不得从 task 终态伪造 pass；DecisionPackage 缺失是否
   fail-closed，又不破坏合法重启恢复。
3. Claude 自检是否使用剥离环境、严格完整 init/result、realpath 身份、并发安全；Tier1 terminal action、
   blocked screen/spoken/callback 是否 canonical 单源且不泄密。
4. `scripts/build-release-artifacts.mjs` 是否把 tar 每个成员绑定到当前源码构建且可复现；第三方 notices
   是否覆盖分发依赖；package 清单是否最小且没有秘密/私有归档。
5. `.github/workflows/release.yml`、本地 distribution verifier 和 `scripts/verify-release-url.mjs` 是否分别
   覆盖发布前、发布后；Windows 是否真执行 `saydo.cmd`；固定 URL、空 cache/prefix/home、全局入口、
   健康/console/status/优雅停止/孤儿检查是否成立；标签/版本/仓库 URL 是否一致。
6. 中英首页、Docs、README、release notes、canonical 与计划是否准确区分：Cursor 稳定、Claude 收口中、
   Codex 执行器不可用；Windows/Linux 前台可运行但常驻/通知未承诺；移动端未上架；平台认证话术中立；
   rc.2 在 Release 真发布前不被部署成既成事实。
7. 链接门、fresh-origin E2E、分支/worktree/发布与部署顺序是否还存在能产生假绿的缺口。

首轮外部评审报告为 `research/codex-findings/94-week-audit-faststart-adversarial-review.md`。请逐条给
`CONFIRMED_FIXED / STILL_BROKEN / REGRESSED`，再独立寻找新问题。严重级别：A=发布阻断或安全/合同/数据
真实性，B=应在发布前修，C=可登记改进。每条必须给 file:line、实际证据、影响和最小修复。最后明确
`Go` 或 `No-Go`；如果 Go，也要列仍属人工/外部条件的边界。
