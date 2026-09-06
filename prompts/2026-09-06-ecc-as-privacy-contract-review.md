# 归档说明

只移除了本机绝对根路径；原派发输入保存在 ignored 控制目录，归档副本不可直接派发。

# AS 隐私批 contract/c1 独立只读评审 · ordinal 4

你是全新零上下文 Codex reviewer，task_mode=review_only。只评合同阶段，不实施、不修改源/测试、不派 subagent/reviewer、不读取实施日志/实施者自述/父会话或其它历史 reviewer 推理。你不是 supervisor。AGENTS.md 的只读评审例外适用，不升格监督交付。

固定 detached snapshot：[review-snapshot-root]
candidate_head=99d51106c9caaefcf55f72bff1a17a78abf58be9
diff_fingerprint=8bac0d916e0ff14464b28ad19fb5a42fcda79369ce8901879f107083963ede84
task=ecc-as01-as02-privacy; stage=contract; cycle=c1; review_ordinal=4; review_scope=step。

首尾执行 candidate_fingerprint.py --expect 上述 fingerprint。工作区是 detached HEAD + 固定未提交 diff，与父候选 bytes/fingerprint 已机械比对；未授权 commit，所以不要要求先提交。所有 read 都针对这份 snapshot，不切 ref、不 checkout/merge。不得写产品、测试或控制面；报告由 CLI -o 输出到父控制目录 review-4.md。不要手工覆盖此文件，直接把完整报告作为最终回答。

只读输入：
- snapshot AGENTS.md / .octoworkflow/project-profile.md。
- 原 owner acceptance：[implementation-root]/docs/plan/ecc-as01-as02-privacy-contract/implementation.md 中 AS-C1–AS-C4，以及其引用统一方案 §3（当前 snapshot 中有）。这不是实施自述，禁止读取 contract-result.md 或 implementation-1.log。
- 机器冻结 acceptance：[implementation-root]/docs/plan/ecc-as01-as02-privacy-contract/acceptance.frozen.json；coverage.json；scope.json。仅这四个 A-ID。
- 候选正式执行卡 docs/plan/IMPL-PROMPT-ecc-as01-as02-privacy.md；touched canonical(03/04/09/10/11/modules-b)、PLAN-2、owner-decision 第10节、HANDOFF、schedule-pointer、共享 knowledgePrivacy schema/test。
- 可读取与写入/失败恢复生产路径相关的当前代码来验证合同可实施和范围完整，不能把尚未进入 implementation 的行为缺失本身当本阶段失败。
- 允许的原始 focused 证据：[implementation-root]/docs/plan/ecc-as01-as02-privacy-contract/repair-3-focused.log（SHA 63c24e7cdb29db4391e025facaefaedce1c440fadfa4aa6d9a523e6ff3f9a888）。该日志是文档/排产与 contracts typecheck、schemas18 + privacy13 的命令输出，不能当产品 CI。完整阶段门由父 supervisor 在 GREEN 后通过 record-gate 执行。
- PG-01B 前置只核 I/E 祖先和 e2e/evidence/pg-01b-20260905.md、journal R129 的 owner 已知情合并说明；不读其旧 reviewer 报告，不重开已合并 PG产品；不把历史 finalize 债当新授权或消失。

固定三个判断维度（禁止开放式 fuzz/扩审）：
1. privacy_contract：AS-C1。统一方案§3声明的 ledger.add/supersedes/remember、新 generation 所有 raw 来源(包括现场 rules、package scripts、justfile)、私有 Git write-set 与允许/拒绝边界是否完整进入 canonical；声明凭据 grammar、占位符和非凭据引用口径一致；不能截断扫描却允许落下未扫描原文。
2. compatibility_recovery：AS-C2/C3。默认私有与人工共享/既有 tracked 数据同时保持；根外 symlink、非 Git/.git文件、保护未知/失败、三类失败/旧generation/首次无底座及现有重试有明确可判定结果；共享 schema 与文档严格一致，现有成功兼容/新元数据 runtime parse、实际实现白名单/新增测试/成本上限足以覆盖 M1–M8；不要求本阶段已接 daemon/UI。
3. schedule_evidence：AS-C4/C3。前置可验证、授权登记准确且不改旧 D17原话，PG后AS前PG02链、批卡/指针/引用/有限self-test一致；没有共享设置/DDL/provider/runtime/无关审计/全目录 linter 扩张。事实引用与所谓当前代码上限需能读到，不把任意参数关联写成实测。

P0/P1 前必须证明当前 canonical/正式入口/声明 grammar 可达的矛盾或验收失败，并写 file:line 与具体结果。超声明grammar、手改受管模板才出现且正式路径不受影响的启发式局限默认 P2。每个candidate一名reviewer，不为 review 再派 reviewer。不得降低验收；也不得把下一阶段尚未写代码作为当前RED。

报告简体中文、零emoji，先 verdict 与可复现 blocker，再按 AS-C1–C4 对账与未运行边界。末尾唯一 review-manifest：
- verdict GREEN/RED；review_ordinal=4；candidate_head/fingerprint 精确如上；review_scope=step。
- blockers 每条含 id,severity(P0/P1),summary,evidence(单个仓内 file:line),in_scope,needs_owner_decision,acceptance_item(AS-C1..AS-C4)。GREEN时空数组；真实范围内可修RED时 stop_reason=null。
- p2_ledger_delta 仅登记；无则[]，不当轮修。
- focused_gates 仅 name/exit_code/summary，没跑别造输出。可据已核hash原始日志标明复用而非自跑。
- stop_reason=null，除非真实需owner且简短具体；不要输出任何建议执行命令字段。

正式CLI已固定 gpt-5.6-sol/max；请结束在完整报告，不调用其它语义CLI。

## 父任务冻结预算(本会话只读)

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```

## 必须逐字遵守的输出格式

最终只输出简短评审正文和唯一 fenced block。block opening 必须是三个反引号紧接 review-manifest，不能用 json 语言标签，也不能只写 review-manifest 标题。下列形状仅为格式模板，所有 verdict/blockers 都由你独立取证填写。

```review-manifest
{"verdict":"RED","review_ordinal":4,"candidate_head":"99d51106c9caaefcf55f72bff1a17a78abf58be9","diff_fingerprint":"8bac0d916e0ff14464b28ad19fb5a42fcda79369ce8901879f107083963ede84","review_scope":"step","blockers":[],"p2_ledger_delta":[],"focused_gates":[],"stop_reason":null}
```

检查最终文字是否真的包含 opening fence 的 review-manifest 标签；如果RED，blockers不能空。不要读取任何review-*.md(含replacement)或旧review日志。不要在报告正文放绝对路径Markdown链接，证据用仓内 file:line。报告建议2500中文字符以内，保留可达路径与具体反例即可。

前次有效 blocker 仅给 ID 与摘要，禁止读旧推理；对当前候选独立核验：
- AS-C1-PLACEHOLDER-OVERLAP-BYPASS：占位符任意重叠豁免漏掉合法长凭据。
- AS-C3-SAFE-SOURCE-LIMIT-CONFLICT：声明支持的规则文件名与相对来源长度上限冲突，无法表示安全定位。
禁止开放式 fuzz 或扩大原4项验收面。
