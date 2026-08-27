# research/ — 调研与评审原始报告

本目录是 `../docs/` 各结论的**证据源**,按产生时间保留原貌。文内引用的相对路径可能基于重组前的旧目录结构;迁前全量冷档的位置与校验方式见 [`docs/plan/MIGRATION.md`](../docs/plan/MIGRATION.md)。

| 文档 | 主题 | 被引用于 |
|---|---|---|
| `competitive-scan-2026-07.md` | 6 路竞品与能力调研综合 | docs/01 §2、docs/05 §1、docs/06 |
| `open-source-stack.md` | 开源选型清单 + P0 最小栈 | docs/03 §9 |
| `local-projects-borrowing-assessment.md` | Hopper / OpenClaw-Kit / OctoDesk 借鉴评估与落地映射 | docs/03 §1、docs/05 §1 |
| `ecosystem-analysis-and-fusion.md` | 三方生态对照与战略选项 | docs/05 §2 |
| `mobile-desktop-connectivity.md` | 手机↔桌面连接选型(业界 + OctoDesk 评估) | docs/03 §7–§8 |
| `business-flows.md` / `.html` | 业务流程说明 + 8 张 SVG 流程图 | docs/02 §2 |
| `codex-findings/` | Codex(gpt-5.6-sol max)对抗性审查:01–04 方案深评 + 05 文档集重写评审 + OctoDesk 连接调查 + prompts/logs | docs/04、docs/05;05 号报告的 A 级问题已回修进 docs/ |
| `highlight-features-brainstorm.md` | 亮点功能头脑风暴(4 subagent × 4 角度,80 条候选,允许想错、逐条标风险与置信度)——**非正式设计,供 owner 挑选** | (待 owner 挑选后进 docs/) |
| `hopper-integration-request.md` | 给 Hopper 会话的对接需求 prompt(v2,16 项;经 2 subagent 评审修订) | 设计 ADR-001 `docs/adr/design/ADR-001-execution-layer.md` |
| `customer-question-corpus/` | 600 条潜在客户生产力提问语料库(questions/contexts/contracts/simulations/dry-runs + 校验工具链) | prompts/168–190;docs/review/2026-08-26/27 两份 readback |
