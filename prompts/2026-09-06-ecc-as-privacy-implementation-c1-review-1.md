<!-- 归档副本:本机绝对路径已脱敏为 <worktrees>/ -->
# AS-01/AS-02 implementation 阶段独立只读评审 / c1 ordinal 1

你是全新零上下文 reviewer，task_mode=review_only：不实施、不修改产品/测试/控制文件、不派子 agent 或其它 CLI、不读实施日志/实施自述（result-*.md、implementation-*.log/.md、bootstrap.md 一律不读）、不读旧 review。只评本 implementation 阶段的 M1–M8。

固定 detached snapshot（只读）：<worktrees>/saydo-as-impl-c1-review-1-20260906
HEAD=99d51106c9caaefcf55f72bff1a17a78abf58be9
fingerprint=8ac2ebf8e05ccc80b11b538ae53cd8189419f88f57ccf3657bad28570bc58d4c
task=ecc-as01-as02-privacy；stage=implementation；cycle=c1；review_ordinal=1；review_scope=step。
开头与结尾各运行一次 `python3 ~/.octoworkflow/candidate_fingerprint.py --expect 8ac2ebf8e05ccc80b11b538ae53cd8189419f88f57ccf3657bad28570bc58d4c`（在 snapshot 目录）。未授权提交，故 dirty snapshot 即审查 ref。报告由 CLI `-o` 写到父控制目录 review-1.md；最终输出即完整简短报告，不手写文件。

## 候选构成

snapshot 的 dirty 集合 = 已 finalized 的 contract 阶段增量（canonical 03/04/09/10/11/b-memory、PLAN-2/HANDOFF/指针、`packages/contracts/src/types/knowledgePrivacy.ts` + index export + `knowledge-privacy.test.ts`、执行卡与只读方案来源）+ 本阶段 implementation 增量。contract 增量已经独立 GREEN 并 finalized，本轮不重审其设计，只核实代码与它一致；contracts 三文件 SHA-256 应与 baseline 一致：knowledgePrivacy.ts=9cc1f84df6581eeb81e89158613d72261ddcf5c7785eac84efeb0122f4d07542，index.ts=7d6a438e96ff4330a121e42f4de69f9313d67e0ae9233749b7106a1e9399866a，knowledge-privacy.test.ts=e3a3eb2246310dbaab6fa0ccd7b7059330ec112f24980b38047e4c2075af5742。

本阶段 implementation 增量（exact-set，越界即 P1）：
- 修改：`packages/daemon/src/memory/{ledger,foundation,foundationOps,growth,hotwords}.ts`、`packages/daemon/src/brain/liveTools.ts`、`packages/daemon/src/index.ts`、`packages/daemon/src/projects/lifecycle.ts`、`packages/console/src/{lib/api.ts,lib/apiError.ts,pages/ProjectSettings.tsx}`、`packages/daemon/test/{memory,memory-foundation,memory-growth,projects-lifecycle}.test.ts`
- 新增：`packages/daemon/src/memory/{credentialLiterals,gitProtection}.ts`、`packages/daemon/test/{credential-literals,git-protection,live-tools-remember-privacy}.test.ts`、`packages/console/src/pages/ProjectSettings.test.tsx`

## 只读输入

- snapshot 内：`AGENTS.md`、`.octoworkflow/project-profile.md`；唯一执行卡 `docs/plan/IMPL-PROMPT-ecc-as01-as02-privacy.md`（§3.1、§4 M1–M8 正反例表、§4.1、§4.2 消费者恢复协议、§5 成本上限、§6 exact-set、§7 gates）；canonical 按 symbol 定位（09「凭据字面量闸」段与 §11 `[params]` AS 注释块、§13 remember/addHotword 签名；04 §1.2 两段；11「项目设置奠基(正式路径)」；10 三类失败话术；b-memory B2/B3）；contracts `knowledgePrivacy.ts` 导出面；上述 exact-set 全部源码与测试；`packages/console/src/App.tsx` 的 `psettings` 路由。
- 冻结合同（父控制目录，只读）：<worktrees>/saydo-as-privacy-20260906/docs/plan/ecc-as01-as02-privacy-implementation/acceptance.frozen.json、coverage.json、implementation-scope.json、cost-limits.json。
- 原始 focused 证据（supervisor 在正常本地环境运行冻结 focused.sh 的输出）：<worktrees>/saydo-as-privacy-20260906/docs/plan/ecc-as01-as02-privacy-implementation/focused-supervisor-1.log，SHA-256=86264397fee0f7465f697f3c1062ad078c9f281de26bdb743a0e27b2e850b44b。核 hash 后可复用并注明非自跑：daemon typecheck + 7 文件 78 tests、contracts typecheck + 39 tests、console typecheck + ProjectSettings 5 tests、emoji/doc-links/public-tree-privacy/schedule-pointer/`git diff --check`。这不是 `just ci`/Playwright；完整门由父 supervisor 在 GREEN 后 record-gate。你可以在 snapshot 内只读运行 typecheck、grep、`git diff`；沙箱不允许写时不要为跑测试改动任何文件。

## 有限三个维度（不超出）

1. write_rejection（M1、M2、M6、M7）：daemon 只 import contracts 的 grammar/上限/安全表示，没有第二套规则；`MemoryLedger.add` 的扫描严格早于 classify/assertWritable/insert 且覆盖 claim、`source.ref`、`source.quote`、supersedes、requestedTrust；foundation 在首次 `mkdirSync(staging)` 前扫描组装后的五件落盘文档，命中不写 staging/manifest、`current.json` 与旧 generation 不动、不 partial；`core.md`/manifest 无原始绝对 workspace；safeHits 只含相对来源/行号/kind/处方并过 `knowledgePrivacySafeHitSchema`，rules 来源经 `foundationRulesRelativeSource`；错误/日志/审计/UI 不携带命中原文或绝对路径；`.cursor/rules` 用 opendir 逐条 + 先 stat 再有限读 + `classifyRulesReadBound`，不 `readdirSync`/`readFileSync` 整读后再截；Git 子进程带 timeout/maxBuffer、边界总数 ≤16、保护查询 ≤5、封闭集不变。
2. failure_recovery（M3、M4、M5）：create-only `.saydo/.gitignore`，等价规则不覆盖，tracked 目标 `insufficient` 且不 untrack、不清历史；`not_git`/`protected`/`insufficient`/`outside_root`/`query_failed`/`write_failed` 结果确定，timeout/buffer/非 not-a-repo 失败不得当 `not_git` 或 `protected`；非 Git 仍做凭据检测可写本地；根外 symlink 拒写；三类 failureClass 互不冒充成功且 HTTP/DTO/console runtime parse 同一 contracts schema；`remember`/`addHotword` 命中返回 `memory_secret_literal` toolError、对话继续；`nominateFromSession` 逐条、`reanchorDraft` 事务内逐条（其余并入、draft archive、merged 只计成功）、approve 路由映射、`onFact` 逐条；修复后同一按钮/现有奠基重试真实可发布新一代。
3. evidence_consistency（M8）：canonical/schema/代码/正式路由 `#/p/:id/settings → psettings → ProjectSettings` 一致；测试实际断言上述行为而不是镜像实现，且覆盖执行卡 §4 表中的必红反例（至少：requestedTrust 绕过、reanchor 整事务回滚、先写 staging、写入 this.workspace、17 文件/65537B/33 dirent、第 6 次保护查询、timeout 当 not_git、UI 显示新 generation 成功行）；exact-set 外零改动；未动 net/DDL/knowledgeShare/projectOverrides/Gate 0/S3/trust 词表/通知中心。

P0/P1 前必须证明可从正式路径或声明 grammar 到达并给出具体反例与单个仓内 file:line；超出声明 grammar 的构造、手工篡改受管文件、要求启发式对无限语言完备的发现默认 P2 登记，不触发返工。不开放式 fuzz，不扩审 AS-03..07/PG-02。P2 只登记不修。你不评预算策略、不增派 reviewer。

## 输出

最终中文、零 emoji（文本标记只用 [ok]/[warn]/[fail]），正文建议 2500 中文字符以内：按 M1–M8 逐项对账、列 P1 与未运行项。唯一 fence 必须逐字用 review-manifest 标签（不是 json）。模板（verdict 由你独立取证填写）：

```review-manifest
{"verdict":"RED","review_ordinal":1,"candidate_head":"99d51106c9caaefcf55f72bff1a17a78abf58be9","diff_fingerprint":"8ac2ebf8e05ccc80b11b538ae53cd8189419f88f57ccf3657bad28570bc58d4c","review_scope":"step","blockers":[],"p2_ledger_delta":[],"focused_gates":[],"stop_reason":null}
```

RED 时 blockers 不能为空，每条只用 id/severity(P0 或 P1)/summary/evidence(仓内相对 file:line)/in_scope/needs_owner_decision/acceptance_item(M1..M8)。GREEN 时 blockers=[]。focused_gates 只 name/exit_code/summary，不造未跑输出，不输出任意命令字段。范围内可修的 RED 用 stop_reason=null。报告证据不放本机绝对路径、不放命中原文。

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```
```roles
{"implementation":{"cli":"grok","model":"grok-4.6","provider":"xai","reasoning_effort":"xhigh"},"review":{"cli":"codex","model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"max"},"supervisor":{"model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"xhigh"}}
```
