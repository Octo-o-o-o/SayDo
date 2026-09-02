# IMPL-PROMPT · PG-01A FG-1 ownership 生命周期恢复

## 1. 固定身份与前序证据

- `task=project-gap-closure`
- `stage=PG-01A/FG-1`
- `cycle=owner-night-fg1-recovery-20260901`
- validation：`<validation-worktree>`
- source 映射：`<worktree>`
- 起始 HEAD：`2b5517d322f062297d25806b02c4106e2ecc60e8`
- 起始 `git-diff-v1`：`8455d6c5d42142b36cd7104e3b74989c64a2db6d2871af771610e598aa9fda49`

owner 当前消息明确授权这个新的、有界 FG-1 恢复周期。旧 `owner-night-recovery-20260901` 的 ordinal 4 语义 GREEN、两次完整门禁 RED、repair/rereview=3/3、strategy reset=1/1、日志和 candidate 坐标全部保留；本 cycle 不改写或清零旧 cycle。

当前会话是 Grok `grok-4.6/xhigh` 独立实施线，只诊断和修复本文件定义的 FG-1。不得派 subagent、调用 reviewer、自判 GREEN、修改 cycle state 或提交 Git。独立 readback 由 fresh Codex `gpt-5.6-sol/max` 只读会话完成。

已核验的前序事实：

- `packages/daemon/test/tier1-executor.test.ts:6404` 在两次完整 `just ci` 中均为 expected true / received false；两次 daemon 汇总均为 2176 passed、1 failed、6 skipped。
- 同一测试的 isolated 运行曾 1 passed；isolated pass 不等于完整门禁通过。
- 该测试文件 worktree 与 HEAD blob 在起始 candidate 均为 `0826a48756d7748815d7e003beb3c33f03163603`，不在既有 15 项 dirty set 中。
- ordinal 4 对公开承诺与 scanner 的 GREEN 只绑定上述起始 candidate；本 cycle 不重做那部分施工。

## 2. 允许范围

实施目标：找出 ownership durable publication、进程终态清理与测试观察之间的确定根因，作最小修复，使 FG-1 的安全不变量在定向测试、完整 tier1 executor 文件、daemon package suite 和最终完整 `just ci` 中可靠成立。

产品 may-change exact-set：

- `packages/daemon/src/tier1/executor.ts`
- `packages/daemon/src/tier1/restartPolicy.ts`
- `packages/daemon/test/tier1-executor.test.ts`

至少一个路径必须有真实、可解释的最小 delta。若证据要求修改其他产品路径、改变 ownership 架构或新增业务决策，停止并返回 blocker，不先改后报。

既有 15 项 PG-01A dirty 路径必须保持逐字节不变。本 cycle 的产品 delta 先落 validation；supervisor 只可把已核验的同一精确 delta 机械同步到 source 映射。canonical、公开声明/scanner、provider、权限、数据库 schema、网络、UI 和页面布局均不在范围内。

禁止通过以下方式过门：删除或 skip/only 测试；放宽核心断言；增加重试循环；仅扩大 wait/timeout；用 sleep 掩盖竞态；让 owner marker 在不安全时延长存活；绕过 durable terminal、进程身份或清理规则。测试修订必须继续直接证明 `ownershipEstablished` 不会早于 durable owner publication，同时避免对 publication 之后合法清理的非确定观察。

## 3. 验收项目

### FG1-1 · 根因与不变量

输出具体 happens-before：owner 记录何时发布、callback 何时触发、agent exit/settle 何时允许清理。修复应消除测试与生产生命周期之间的错误同步假设，或修正真实生产时序缺陷；不得把 isolated pass 当作根因证明。

### FG1-2 · 最小实现

只改为恢复 FG-1 必需的代码或测试。若是 test-only 修复，必须保留 callback 内对 durable owner 已存在的直接断言，并解释为何 callback 返回后的文件存在性不再是合法稳定状态。若改生产代码，必须证明不会延迟必要清理、泄漏 owner marker 或允许二次 spawn。

### FG1-3 · 受影响门禁

实施者在 validation 只运行以下 focused gates，不运行全仓 `just ci`：

1. `pnpm --dir packages/daemon exec vitest run --passWithNoTests test/tier1-executor.test.ts -t 'ownershipEstablished 必须在 durable owner 写完之后'`
2. `pnpm --dir packages/daemon exec vitest run --passWithNoTests test/tier1-executor.test.ts`
3. `pnpm --dir packages/daemon test`
4. `pnpm --dir packages/daemon typecheck`
5. `pnpm exec eslint packages/daemon/src/tier1/executor.ts packages/daemon/src/tier1/restartPolicy.ts packages/daemon/test/tier1-executor.test.ts`
6. `git diff --check`

每项记录真实 argv、exit code 和简短汇总。任何非零都不得记为通过。

### FG1-4 · 独立复审与最终门禁

focused 全绿且 candidate 未漂移后，supervisor 对新 fingerprint 派一名 fresh zero-context Codex `gpt-5.6-sol/max` reviewer，ordinal 1。review 只判断 FG1-1 至 FG1-3、exact scope、测试是否被弱化、production lifecycle 是否安全；P2 仅给出 ledger delta，不在本步骤 sweep。

只有 manifest validator 对当前 candidate 返回 `valid/full_gate`，supervisor 才运行一次 `just ci`。完整门禁若暴露与本次改动直接相关的 P0/P1，按同 cycle 剩余产品预算修复，candidate 改变后重新执行 focused 和一名 fresh reviewer；旧 candidate 的 GREEN 不得套用。无关范围、owner 决策或预算耗尽按 V2.4 停止。

### FG1-5 · 页面视觉欠账

只有最终同 candidate 的完整 `just ci` exit 0，supervisor 才对以下既有页面执行隔离 headless Chrome QA：

- `deploy/saydo-octoooo-com/docs/index.html`
- `deploy/saydo-octoooo-com/en/docs/index.html`

检查页面可加载、无页面级脚本错误、目标文案可见、主要布局无明显溢出或遮挡；保存中英文截图与真实浏览器日志。该 QA 不访问账号、真实 AI、网络产品服务，也不重新设计页面。

## 4. 状态、证据与禁止项

- V2.4 control：`docs/plan/project-gap-closure/`
- V2.4 cycle-state：`docs/plan/project-gap-closure-cycle.json`
- 唯一 P2 ledger：`docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md`
- 旧证据继续位于 `e2e/evidence/project-gap-pg-01a.md`、`history/PROCESS-JOURNAL.md` 与 `logs/pg01a-night-20260901.V1D8er/`。

本 cycle 最多三次产品修复、三次复审；同根因最多两次修复、最多一次 strategy reset，六个计数只由 `cycle_state.py` 机械更新。每次 Grok/Codex 语义启动前必须通过 `cycle_control.py --preflight`。

禁止 commit、amend、push、merge、deploy、E、PG-01B、真实产品 AI、账号登录、付费、读取本机 AI 凭据、切换 provider/model、降低沙箱或关闭 CI。临时测试数据只能放隔离 TMPDIR。

```workflow-v2
{"policy_version":2,"policy_revision":"2.4","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```
