# Deferred P2 ledger

> workflow: SayDo project-gap supervised delivery
> plan: docs/plan/IMPLEMENTATION-PLAN-2.md
> final_sweep_status: not_started
> final_sweep_candidate: n/a
> final_sweep_completed_at: n/a

## 使用规则

- 本文件是后续 PG 监督实施任务的唯一 P2 台账；跨会话只传路径与未结 ID，不复制台账。
- 既有 G-B 清单保留于项目缺口总案，若独立评审确认相同根因则沿用原 ID；不在未复验时批量搬入或改级。
- 新 ID 从 P2-001 递增；相同根因与代码位置保持稳定 ID。
- 单阶段 review 只新增或更新条目，不修代码、不触发返工或复审；P3 不进本表。
- 状态只用 open、absorbed、promoted、fixed、deferred。
- 整个任务最终交付前只进行一次 final sweep；在途 PG 阶段不扫。reviewer 输出 delta，supervisor 按原字段机械合并。

## 条目

| id | first_seen_candidate | location | evidence | impact | status | last_validated_candidate | resolution |
|---|---|---|---|---|---|---|---|
| P2-001 | `2b5517d322f062297d25806b02c4106e2ecc60e8/d324b59bce25b1c3eedb0110c77e520f160f57bc44c2ad3e6b51552ac26444e8` | `eslint.config.mjs:7`; `logs/pg01a-night-20260901.V1D8er/fg1-focused-1.log:445-452` | focused ESLint argv 包含本次改动的测试文件，但 ESLint 报告该文件因无匹配配置而被忽略。 | 当前 delta 已由 TypeScript typecheck 和 Vitest 覆盖，不构成当前验收失败；但 lint 组件未覆盖 test-only 改动。 | open | `2b5517d322f062297d25806b02c4106e2ecc60e8/d324b59bce25b1c3eedb0110c77e520f160f57bc44c2ad3e6b51552ac26444e8` | step scope 仅登记此覆盖缺口；未修改产品或测试代码。 |
