# 实施计划索引

`docs/plan/` 是排产与交接档案，不属于合同 canonical。合同形状仍以 `docs/09–11` 和 `docs/adr/` 为准。

## 当前入口

- `IMPLEMENTATION-PLAN-2.md`:当前唯一排产源。
- `MIGRATION.md`:2026-07-29 双目录合并的执行记录、路径映射与回滚说明。
- `REPO-MERGE-PROPOSAL.md`:2026-07-25 的 v2 前置方案;已由 `MIGRATION.md` 的实况执行记录 supersede。

## 专题方案

### AI 供给普适接入（2026-08-23 起）

本专题拆成三份各自可验证的产物，合起来才是完整方案：

- `2026-08-23-ai-supply-universal-onboarding-final.fable.md`（约 2,400 行）：主方案。审计结论、
  用户旅程、架构决策、协议与自动发现设计、生态覆盖清单、分阶段计划、验收总表与风险决策点。
  该文档不是排产源；须先解除其 §0 开工门、完成 owner 决策，并由 `IMPLEMENTATION-PLAN-2.md`
  建立唯一批次坐标后才能实施。
- `ai-supply-contracts-draft/`（45,696 行 TypeScript）：合同草案，原为主方案 §4/§8 的内嵌代码块。
  可被 `tsc` 直接检查（当前 strict/NodeNext 零诊断），但**不参与构建、不是生产合同**；
  下沉 `packages/contracts` 的前置条件见该目录 README。
- `2026-08-24-ai-supply-owner-decisions.md`：主方案 §14 十项 owner 决策的可签署副本
  （原文逐字引用 + 耦合注解 + 签署栏）。这十项是当前专题的关键路径，未签前施工方不得推断。

相关评审材料在 `docs/review/`：

- `2026-08-24-ai-supply-v20-loop-diagnosis.md`：对 v1–v20 评审循环的路线诊断，
  结论为该循环不收敛，建议停止 v21（`prompts/167`）并按上述三分法改道。
- `2026-08-24-ai-supply-review-loop-archive.md`：v1–v20 共 20 轮「终审 + 回修」的过程记账，
  原为主方案 §17，已归档为过程证据，不再随方案演进。

## 历史锁版

`IMPLEMENTATION-PLAN.md` 与 `IMPL-PROMPT*.md` 均是已发生批次的锁版交接材料。文件内出现的旧绝对路径、
双仓措辞与当时状态只用于追溯，不再构成当前操作指令;当前开工链以根 `HANDOFF.md` 为准。
