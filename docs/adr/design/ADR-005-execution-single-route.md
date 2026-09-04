# ADR-005 · 执行层单路线

- **状态**:已决策(owner 2026-09-02)
- **决策范围**:执行路线。不含产品载体(独立 vs 并入千手,仍归预留的设计 ADR-003)。不含 09 的 schema / DDL / 状态机文字(词表 `route ∈ {tier1, hopper}` 与 `adapter ∈ {claude_code, cursor, codex}` 保留)。
- **关系**:不 supersede [设计 ADR-001](ADR-001-execution-layer.md) 的架构决策正文;只 supersede 其「附注(2026-07-23,交付顺序)」中「首发 = 完整双路径」的交付定义。

## 决策

1. **Tier1 是唯一生产执行路线**。用户说 → Brain → 决策包 → Tier1 在 worktree 里驱动 coding CLI → settle / verify / S3 合并。
2. **当前生产后端**为 `cursor`、`claude_code`(已有实现)。`codex` 延后到 PG-07,不是当前生产后端。
3. **Hopper 桥状态为 `designed/deferred`**:保留 schema 与 dormant 代码,不再维护;锁定副本(`~/.saydo/hopper-dist`)与专用 vault(`~/.saydo/hopper-vault`)可删除。
4. **`native_api` 执行器是 PG-08 候选**,不是本批承诺落地。用途、边界与估算见 `docs/plan/2026-08-15-default-runner-decision.md` §四。

## 证据

坐标取自 `docs/plan/2026-09-02-process-convergence-plan.fable.md` §1.6:

- 合同:`packages/contracts/src/types/task.ts:8,12` 定义 `route ∈ {tier1, hopper}`、`adapter ∈ {claude_code, cursor, codex}`。
- 实现:`packages/daemon/src/tier1/*.ts` 与 `backends/*.ts` 合计 11,743 行(不含 `webauthn/` 子目录);后端只有 `backends/claude.ts` 与 `backends/cursor.ts`;codex 没有后端;`native_api` 在代码里不存在。
- Hopper 桥:`focus/stage.ts` 的 `isHopperFocusBindingEnabled` 缺省 false;`packages/daemon/src/bridge/*.ts` 770 行 + `packages/contracts/src/types/hopper.ts` 79 行 + `packages/daemon/src/focus/binding.ts` 292 行,合计 1,141 行;测试 `packages/daemon/test/p05b-bridge.test.ts` 236 行、`p05b-fake-runner.e2e.test.ts` 201 行、`p05a-contracts.test.ts` 176 行、`p05b-recovery.e2e.test.ts` 64 行,合计 677 行;最后改动 2026-08-05;`~/.saydo/hopper-dist` 锁在 2026-07-24 `bdd1e54`;`~/.saydo/hopper-vault/.hopper/events.jsonl` 为 0 字节。PLAN-2 §6.10 已把 Hopper 相关项挂在「route=hopper 且需 S2 的任务实际出现」触发线后。

## 后果

少维护 1,141 行 Hopper 桥、677 行测试与一个外部二进制。对外口径只说 Tier1 能做到的事;不把 Hopper 说成生产执行路线,不把双路径说成仍有效的首发定义,不把 `codex` 说成当前生产后端,不把 `native_api` 说成已承诺落地。

## 关联

- 设计 ADR-001:架构决策正文保留;交付附注中「首发 = 完整双路径」由本 ADR supersede。
- PG-07:codex Tier1 后端候选。
- PG-08:`native_api` 执行器候选,细节以 `2026-08-15-default-runner-decision.md` §四为准。
