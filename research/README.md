# research/ — 调研与评审原始报告

本目录是 `../docs/` 各结论的**证据源**,按产生时间保留原貌。文内引用的相对路径可能基于重组前的旧目录结构;迁前全量冷档的位置与校验方式见 [`docs/plan/MIGRATION.md`](../docs/plan/MIGRATION.md)。

当前工程缺口与 ECC 的产品方案/实施入口已统一到 [工程改进统一方案](../docs/plan/2026-09-05-engineering-unified.astra.md) / [统一 Prompt](../docs/plan/IMPL-PROMPT-engineering-unified.astra.md)。下列旧路径、脚本与 review 是原候选的证据，不再派发；归档路径与摘要见 [本次来源清单](engineering-unified/source-manifest.json)。旧证据按其当时文件摘要解释，不覆盖统一稿。

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
| `ecc/2026-09-05-ecc-project-research.md` | ECC(`affaan-m/ECC`)调研：宣称/源码/实测分层、运行时入口追踪、夹具坐标 | 候选方案 `docs/plan/2026-09-05-ecc-borrowing-plan.md`；非 canonical |
| `ecc/2026-09-05-contextview-ecc-borrowing-plan.md` | 供 Contexpect 接收的 ECC 夹具/overlay 借鉴档案 | ContextView `docs/research/` 接收方案、配套报告及证据索引；非排产 |
| `ecc/evidence-index.json` | 本轮源码行号与实测日志 SHA | 上两份 + SayDo 候选方案 |
| `codex-findings/2026-09-05-ecc-astra-review.md` | Fable / 旧 Codex 比较、Astra 两方案独立复审与 12 项冻结文档门禁；证据摘要在 `ecc-astra/2026-09-05-delivery-evidence.json` | 两仓 `2026-09-05-ecc-borrowing-assessment.astra.md`，非产品验收 |
| `astra-gap/` / `astra-gap-synthesis/` / `engineering-unified/` / `ecc-final/` | 2026-09-05 Astra 缺口评估、工程缺口综合与成本收窄、统一交接、ECC 终稿各轮的探针、P2 ledger 与 delivery-evidence(原始日志留各目录 ignored `.local/`,不入 Git) | `docs/review/2026-09-05-project-gaps-Astra.md`、`docs/plan/2026-09-05-engineering-unified.astra.md`;journal R151–R158 |

- [ECC 统一研究报告](ecc/2026-09-05-ecc-unified-research.md)：双方研究的唯一维护正文（E-01–E-110、118 条旧证据、12 条历史测试原记录保留）；当前建议范围已收窄，含 OctoWorkFlow 优化判断和其它项目初筛。
- [ECC 最终评审与交付记录](codex-findings/2026-09-05-ecc-final-review.md)：上一版独立复审、文档门禁与历史记录；不是本范围修订的评审结论。
