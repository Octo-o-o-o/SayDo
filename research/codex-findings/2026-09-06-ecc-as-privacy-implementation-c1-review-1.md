结论：RED。发现 5 项范围内 P1，无 P0、无新增 P2。

M1–M8 对账：

- [fail] M1：`MemoryLedger.add` 的扫描顺序及覆盖字段正确；但正式 `remember` 路径会先执行 readiness/trust 校验，凭据命中不保证返回 `memory_secret_literal`。
- [ok] M2：五份组装文档均在首次 staging 写入前扫描；拒绝时无 manifest、partial 或 generation 切换，持久化内容不含绝对 workspace。
- [fail] M3：foundation 的 Git 保护正确，但 approve 后的 `projectM1Notes` 私有投影直接写入，绕过 create-only、tracked 与 symlink 检查。
- [fail] M4：Git helper 的六类结果、超时及查询失败分类正确；但上述投影绕过使 tracked/outside-root 恢复合同并未覆盖全部正式写路径。
- [fail] M5：记忆拒绝没有输出 `memory_item_not_saved`；foundation 刷新失败时 UI 又优先按 Git code 分类，丢失“继续使用上一代”语义。
- [fail] M6：safeHits 本身经共享 schema 且不含原文，但行号按组装后文档计算，不能准确定位其 `relativeSource`。
- [fail] M7：rules 使用 `opendir`、先 stat 后限读；17 文件、65537B、33 dirent、第六次查询边界均有测试。私有投影保护边界仍不完整。
- [fail] M8：正式路由、contracts 三项 hash、implementation exact-set 及禁改面均一致；现有测试未贯穿真实错误解析/分类与来源行号计算，无法发现上述偏差。

P1 及正式反例：

1. `remember` 的声明 grammar 输入同时含凭据 claim 与触发 readiness/trust 校验的参数时，先返回其他错误码，而非凭据拒绝。证据：`packages/daemon/src/brain/liveTools.ts:1327`。
2. 正式 approve 路由成功写 ledger 后，若目标已 tracked 或 `.saydo` 经 symlink 指向根外，`projectM1Notes` 仍直接写入。证据：`packages/daemon/src/memory/growth.ts:170`。
3. 正式 `remember` 凭据拒绝只生成 code/message，缺少 `failureClass=memory_item_not_saved`。证据：`packages/daemon/src/brain/liveTools.ts:1368`。
4. 已有 generation 的 foundation 重试因 Git 保护失败时，API 的 refresh failureClass 被 UI 的 Git-code 分支遮蔽。证据：`packages/console/src/pages/ProjectSettings.tsx:39`。
5. 例如凭据位于 AGENTS.md 第 N 行时，safeHit 来源虽为 AGENTS.md，行号却取组装后 core/conventions 的偏移。证据：`packages/daemon/src/memory/foundation.ts:573`。

证据与未运行项：首尾 fingerprint 均匹配固定 HEAD 与 fingerprint；focused 日志 hash 匹配，复用其 typecheck、78/39/5 tests 及静态门禁结果，非 reviewer 自跑。Reviewer 自跑 `git diff --check` 为 exit 0。未运行 `just ci`、Playwright、Windows 实机或 live provider。handoff 校验无结构错误，但风险检查将执行卡第 17 行标作 `unbounded_review`；本次实际评审已明确限定三个维度，作为流程注记，不计产品 blocker。

```review-manifest
{"verdict":"RED","review_ordinal":1,"candidate_head":"99d51106c9caaefcf55f72bff1a17a78abf58be9","diff_fingerprint":"8ac2ebf8e05ccc80b11b538ae53cd8189419f88f57ccf3657bad28570bc58d4c","review_scope":"step","blockers":[{"id":"P1-M1-01","severity":"P1","summary":"remember 在凭据扫描前执行 readiness/trust 校验，声明 grammar 内的凭据命中不保证返回 memory_secret_literal","evidence":"packages/daemon/src/brain/liveTools.ts:1327","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M1"},{"id":"P1-M3-01","severity":"P1","summary":"approve 后的 projectM1Notes 私有投影绕过 Git 保护，可覆盖 tracked 目标或跟随根外 symlink","evidence":"packages/daemon/src/memory/growth.ts:170","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M3"},{"id":"P1-M5-01","severity":"P1","summary":"正式记忆凭据拒绝未返回 memory_item_not_saved failureClass","evidence":"packages/daemon/src/brain/liveTools.ts:1368","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M5"},{"id":"P1-M5-02","severity":"P1","summary":"foundation 刷新失败的 failureClass 被 UI Git-code 分支遮蔽，未呈现继续使用上一代语义","evidence":"packages/console/src/pages/ProjectSettings.tsx:39","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M5"},{"id":"P1-M6-01","severity":"P1","summary":"safeHit 行号按组装文档计算，与 relativeSource 的实际行号不一致","evidence":"packages/daemon/src/memory/foundation.ts:573","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M6"}],"p2_ledger_delta":[],"focused_gates":[{"name":"focused-privacy-supervisor","exit_code":0,"summary":"复用已核 SHA-256 的 supervisor 原始证据：daemon typecheck 与 78 tests、contracts typecheck 与 39 tests、console typecheck 与 5 tests、静态门禁均通过；非 reviewer 自跑"},{"name":"git-diff-check-reviewer","exit_code":0,"summary":"reviewer 在固定 snapshot 自跑，输出为空"}],"stop_reason":null}
```

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```

```roles
{"implementation":{"cli":"grok","model":"grok-4.6","provider":"xai","reasoning_effort":"xhigh"},"review":{"cli":"codex","model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"max"},"supervisor":{"model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"xhigh"}}
```