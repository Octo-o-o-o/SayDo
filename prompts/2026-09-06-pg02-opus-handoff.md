# SayDo 续推 Prompt · Claude Code / Opus 5.0 · PG-02 起按 PLAN-2 链继续

你是 owner 在 Claude Code 新开的唯一 Opus 5.0 监督会话（supervisor 宿主由 Opus 5.0 承接，这是 owner 例外；实施与语义 review 角色不变）。AS-01-AS-02 隐私批已于 2026-09-06 收口并合并推送，排产指针 `active=none / next=PG-02 / last_closed=AS-01-AS-02`。你的任务：按 `docs/plan/IMPLEMENTATION-PLAN-2.md` 唯一串行链从 **PG-02 · minimal-truth-gate-bootstrap** 开始做到可审查候选并收口，收口后按链进入 PG-03…PG-06 直到 `owner-stop`。不要重做 AS 或 PG-01A/PG-01B，不从旧指针开工，不改写历史 evidence。路径占位：`<repo>` = 主树根目录（你的工作目录）；`<worktrees>` = `~/.codex/worktrees`。

## 0. 原样生成的 Workflow V2 contract 与 owner 授权

以下是 `validate_handoff.py --print-contract` 的原始输出（不手写预算或角色块）：

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```
```roles
{"implementation":{"cli":"grok","model":"grok-4.6","provider":"xai","reasoning_effort":"xhigh"},"review":{"cli":"codex","model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"max"},"supervisor":{"model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"xhigh"}}
```

owner 2026-09-06 原话（AS 收口后）：「都确认，然后请做一个prompt我去新的会话使用Opus 5.0继续推进PG-02和其他应该实施的部分，因为你的，也就是Fable 5.1的限额快要用完了。」

解读边界（不要扩大）：
1. PG-02 的 contract 与 implementation 两阶段已由该消息具名授权；PG-03…PG-06 是 PLAN-2 已写明范围/验收/门禁的 preaccepted next stage，前批收口后可按链进入，链尾 `owner-stop` 仍成立。
2. 每批的 commit/push/公开快照都是当次 checkpoint：AS 批的先例是 owner 分别说「授权提交」「按建议继续」「都确认」后才执行。没有当次确认不 commit/push/merge/install/deploy/公开快照。
3. 本消息没有解除修复/复审次数限制。默认每 cycle 3 次产品修复、3 次复审、1 次策略重置；耗尽且 validator 仅因次数停止时停下向 owner 报告，只有 owner 当次消息明确说明才按 unbounded_review 精确 override 校验并新建恢复 cycle（形态见 AS 的 owner-authorization.json）。
4. 角色不变：实施 Grok `grok-4.6/xhigh`，正式语义 review Codex `gpt-5.6-sol/max`；只有配额/可用性信号才按 `~/.octoworkflow/cli-forms.md` 回落，普通失败不换供应方或降档。不改全局 policy/CLI 配置。

## 0A. 先核验坐标，读到什么就按什么处理

```bash
cd '<repo>'
git branch --show-current; git status --short | wc -l
git rev-parse main origin/main; git ls-remote origin refs/heads/main
git log --oneline -6 main
git ls-remote public refs/heads/main
```

期望（写稿时实测）：`main = origin/main` = 本 prompt 归档所在的 R140 提交（以 `git rev-parse main` 为准，其父为 `5d3c25ef4592323a6b76b68126d2bd09be560973`）；main 最近提交依次为 R140 journal + 本 prompt 归档、`5d3c25e`（R139）、`d7193b8`（关批）、`21ed284`（AS E）、`7ab7ab3`（AS I）、`99d5110`（PG-01B E）。公开快照 `public/main = 7909afc4a9c715a8b7293a2c75ac4c0b344274d4`（`snapshot: 2026-09-06 from internal 5d3c25e…`，无标签；R140 提交本身尚未再做公开快照）。主树检出的是其它任务分支（`codex/ecc-research-20260905`，约 32 项 dirty，只读、不施工、不清理）；施工一律用独立 clone。若坐标漂移，先对账再动，不 reset/覆盖别人工作。

建 PG-02 施工 clone（对象共享、分支 `codex/` 前缀）：

```bash
git clone --shared '<repo>' '<worktrees>/saydo-pg02-<date>'
cd '<worktrees>/saydo-pg02-<date>' && git checkout -q -b codex/pg02-<date> main
cp -p '<repo>/.git/info/saydo-private-probes' .git/info/saydo-private-probes   # 缺它 just ci 末项 check-public-tree-privacy --ref 必红
python3 ~/.octoworkflow/candidate_fingerprint.py                              # 干净树 fingerprint 是常量，候选身份靠 head+fingerprint
```

## 1. 必读顺序与事实优先级

1. `AGENTS.md`、`.octoworkflow/project-profile.md`：零 emoji（[ok]/[warn]/[fail]）、状态词、契约不分叉、审计只记 digest、L3 红线、owner_checkpoints。
2. `docs/plan/IMPLEMENTATION-PLAN-2.md`：顶部 schedule-pointer 块（由 `scripts/schedule-pointer.mjs` 守护，`--check`/`--self-test`/`--render`）、唯一串行链、`### PG-02 · minimal-truth-gate-bootstrap` 批卡与 PG-03…PG-06 批卡。
3. `docs/plan/2026-08-28-project-gap-closure-program.md` §20.1–20.5：标准 Git 生命周期、focused gate 表（`FG-PG02-BOOTSTRAP` 等）、PG-02 批卡正文（用户结果、必做、回滚）、G-A3 定义（第 103/667/926/1010 行附近）。
4. `docs/plan/2026-08-28-project-gap-owner-decisions.md`：D17 只覆盖 PG-00 导入；第 10 节是 AS 授权登记。PG-02 授权来自本 prompt §0 原话，登记方式参照第 10 节（不编造逐字引语、不改旧原话）。
5. 上一批的形态参考：`docs/plan/IMPL-PROMPT-ecc-as01-as02-privacy.md`（执行卡结构：四行回报/成本、正反例表、exact-set、成本上限、真实 gates、角色合同）、`e2e/evidence/as-01-as-02-privacy.md`（证据文档结构）、`history/PROCESS-JOURNAL.md` R138–R140（轮次与收口写法；下一编号 **R141**）、`prompts/2026-09-06-ecc-as-privacy-implementation-*.md`（评审 brief 形状）。
6. canonical 按 symbol 定位：`docs/06-references.md` 术语表、`docs/09-data-contracts.md`、`docs/11-ui-spec.md`；contracts 现有 schema 只 import，不另造 DTO。
7. 工程入口：`~/.octoworkflow/supervised-delivery.md`、`cli-forms.md`、`cycle-state.md`、`autonomous-recovery.md`、`context-budget.md`；每个 CLI 先看 `--help` 与 `--print-schema`。

## 2. PG-02 合同要点（来自 PLAN-2 批卡与 program §20.4，实施前先冻结成执行卡）

- 批类型：runtime safety/bootstrap，规模 M，`canonical_change=yes`；**canonical 独立一致性复审是进入 schema/checker 实现的前置**，因此沿用 AS 的两阶段：`contract`（canonical 增量 + 有限共享 schema + 执行卡冻结，一名只读设计 reviewer + 文档门）→ `implementation`（checker/projection/tests，一名全新代码 reviewer + 完整门）。
- `close_set=[G-A3]`，`stop_loss_set=[]`，`deferred_exact_set=[DF-CLAIM-GENERATOR,DF-AI-DRAFT-FULL,DF-SP4-FORMATIVE,DF-SP5-READ,DF-SP7-CALIBRATE]`，`safe_default=unregistered_not_claimable + evidence_bound_to_git_commit`。
- 用户结果：一个公开能力可以从 claim 追到合同、入口、门、证据与限制；未登记能力默认不可宣称。
- scope roots：`docs/06-references.md`、`docs/09-data-contracts.md`、`docs/11-ui-spec.md`、`packages/contracts/**`、最小 release/support projection、`scripts/{check-capability-ledger.mjs,check-action-reachability.mjs,check-support-matrix.mjs}` 及对应 `test-*.mjs` mutation self-tests；`ai-supply-scope` 只重分类，不下沉 45k 行草案。先列实际文件白名单（exact-set），越界即无效。
- 必做：最小 capability/action/scope schema；手工维护的 scoped ledger；claim/gate/support checker；inventory/deferred 只填最小字段；建立供 PG-03–PG-06 消费的稳定 gate-ID registry，但不建通用 wave-exit 执行/receipt 平台。**action checker 必须枚举默认 UI 与 Brain 全部可调用动作、目标 transition、receipt/错误形状，并对遗漏动作和错 transition 的 mutation 转红**——它是 G-A3 从 stop-loss 到 repo_closed 的唯一分母。Q1/Q2/journey 延到选中真实 slice。
- focused gate `FG-PG02-BOOTSTRAP`：`pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts`；`[new] node scripts/check-capability-ledger.mjs`；`[new] node scripts/test-capability-ledger.mjs`；`[new] node scripts/check-action-reachability.mjs`；`[new] node scripts/test-action-reachability.mjs`；`[new] node scripts/check-support-matrix.mjs`；`[new] node scripts/test-support-matrix.mjs`。`[new]` 脚本建立前不得当现役门禁。有类型边界的改动把受影响包 typecheck 加进 focused。
- 完整门：`just ci`；`pnpm exec playwright test`；并在本批 implementation commit 上重跑 `FG-PG01A-CLAIM`（只跑 read-only validator/mutation 与 Q0 `--check` 子集，**排除** Q0 `--write` E-artifact producer，不改绑报告 identity）与 `FG-PG01B-RUNTIME`，证明当前 revision 无回归；PG-01A/PG-01B 历史 evidence 不改写。
- 回滚上限：checker/projector 失败即阻断新 claim，不回退为人工口头对账。evidence：`e2e/evidence/project-gap-pg-02.md`。
- 每阶段执行副本必须填四行回报/成本（用户可见回报 / 增量成本上限 / 用户负担 / 维护与停止扩展），收口时按实测更新。

## 3. 监督机制（与 AS 相同的可复用做法，按需照抄）

控制目录：`docs/plan/<task>-contract/`、`docs/plan/<task>-implementation/`（各自 `cycle.json`；先写 `.gitignore` 内容 `*`，再算 fingerprint）。task id 建议 `pg02-truth-gate`；唯一 Deferred P2 ledger 放 contract 目录，整个任务最终交付前只 sweep 一次。

固定顺序（每条 CLI 只一个动作；全部由工具产出，不手改六个计数）：
1. acceptance.json（stage、required_dimensions 三维、P0/P1 items、required_gates）、gates.json（每门 `bash` + 仓内 wrapper 脚本；`just ci`/playwright 需要 wrapper；playwright wrapper 先识别 47188/47189/47120 占用者不杀进程、备份 `e2e/screenshots` 跑后按原始 bytes 恢复）、coverage.json（每 item 至少一正一反，坐标向量唯一）、owner 授权 sidecar。
2. `cycle_state.py --init --followup-authorized --policy ~/.octoworkflow/v2-policy.json` → `cycle_control.py --freeze-policy`（绑定 acceptance + gate spec）→ `--verify-freeze`。
3. 实施输入（含唯一 workflow-v2 + roles 块）→ `validate_handoff.py` exit 0 → `--check-coverage-matrix` → `--preflight`（ordinal=当前 state ordinal，BEFORE 身份）。
4. Grok：`python3 ~/.octoworkflow/await_external_cli.py --timeout-seconds <hard> --idle-timeout-seconds 900 --log … --summary … --cwd <clone> grok --prompt-file <输入.md> --cwd <clone> --output-format streaming-json --model grok-4.6 --reasoning-effort xhigh --no-subagents --verbatim --always-approve --sandbox workspace --disable-web-search`。历史：M 规模首次实施 1811 s，修复 620–1550 s；hard 用 3600–5400 s。退出后核 `stopReason=end_turn`、`modelUsage` 为 `grok-4.6-build`、真实 diff 与 exact-set 机械对账；supervisor 在正常环境复跑冻结 focused 作为原始证据（Grok sandbox 本轮未阻塞 vitest，但 ps/IPC 类测试可能假红）。
5. 首次候选迁移：`bootstrap.md` 机械占位（RED、`initial-unreviewed-bootstrap`、BEFORE 身份）+ `action=implement / cost_kind=none` 收据 → `cycle_state.py --advance`（expected=CURRENT）→ 更新 coverage 身份 → `--check-coverage-matrix` → `--preflight`。
6. 评审快照：`git clone --shared` + `git diff --binary | git apply` + tar 复制 untracked + symlink 各包 `node_modules`，并把 `node_modules` 写进快照 `.git/info/exclude`（目录模式不匹配 symlink），首尾 `candidate_fingerprint.py --expect`。
7. Codex：`await_external_cli.py --timeout-seconds 3600 --idle-timeout-seconds 900 … codex exec -s read-only -C <snapshot> -m gpt-5.6-sol -c 'model_reasoning_effort="max"' -c 'mcp_servers.openaiDeveloperDocs.enabled=false' -c 'mcp_servers.node_repl.enabled=false' -c 'mcp_servers.obsidian.enabled=false' -c 'mcp_servers.playwright.enabled=false' --json -o <review.md> "$(cat brief.md)"`（stdin 由工具接 /dev/null）。历史 680–1180 s。
8. 评审 brief 必含（AS 两次无效评审的教训）：(a) 逐字闭合 manifest 键集合（`verdict, review_ordinal, candidate_head, diff_fingerprint, review_scope, blockers[], p2_ledger_delta, focused_gates[], stop_reason`；blocker 键 `id, severity, summary, evidence, in_scope, needs_owner_decision, acceptance_item`），声明 `head/fingerprint/task/stage/cycle/p2_findings/unrun_gates` 等别名会被拒；(b) 若执行卡含 owner 例外文字，写明 supervisor 已用 `validate_handoff.py … --allow-owner-override '<理由>' --override-rule <rule>` 校验且记录文件在哪，reviewer 自跑时必须带同一参数，不得据此拒审或包装成 RED；(c) 三个维度以内、上一轮 blocker 只给 ID+摘要、不给实施自述与旧 review 全文、原始 focused 日志 SHA。
9. 消费：先 `rereview` 收据 `--advance`（ordinal 1 cost none；修后 `consumed.rereview=true, cost product`），再 `validate_review_manifest.py … --cycle-state --expected-task/stage/cycle --control-dir`（advance 前跑会报 `cycle_state_review_ordinal_mismatch`）。只按 `next_action` 流转：`auto_repair_once` / `auto_repair_within_budget` → `--reserve repair`+`--start repair` → Grok 修复 → `action=repair` 收据绑定那份 RED；`diagnose_and_repair_fresh` → 只预留 repair（strategy_reset 不能在 repair 悬挂时单独 `--reserve`，由收据 `consumed.strategy_reset=true` 结算）；新旧 blocker ID 同时消失/出现时收据必须给非空 `blocker_id_map`（保守沿用根因）并写 blocker-reconcile-N.md；无效评审（缺 manifest/键名不合/坐标不符）走 `plan_recovery.py`（`review_invalid` → `retry_procedure_once`，每 cycle 最多 2 次、同因 1 次），不占产品预算、不覆盖旧 RED。
10. GREEN 后：`--record-gate` 逐门（只传 `--gate-name` 与 identity）→ gate-evidence（name/exit_code/log_sha256/attempt）→ `--finalize`（`--expected-ordinal` = 当时 state ordinal，需同 ordinal 的 runtime receipt）。

收口（AS 先例，均需 owner 当次确认）：I/E 两提交（explicit pathspec；E 记 I 的 SHA 不自指；原始 .log 只留 ignored 控制目录，仓内只记 bytes/SHA；prompts/research 归档副本脱敏本机绝对路径）→ 在 release HEAD 的干净 `--shared` clone（symlink node_modules、cp 隐私探针、补 `main` ref 否则指针门失败）重跑 `just ci` + playwright + 文档/指针门 → 关批提交（指针 revision+1、`last_closed=PG-02`、`active=none`、`next=PG-03`，批卡标「状态:已收口」记 I/E，`schedule-pointer.mjs --render` 同步 HANDOFF）→ 主树被占用时用 ref-only 快进 `git -C '<repo>' fetch <clone> <branch>:main` → `git -C '<repo>' push origin main` → journal 追补 → 公开快照 `bash scripts/publish-public-snapshot.sh public "" <main-sha>`（必须在 clean main 检出、upstream origin/main、含未跟踪文件全干净、origin/main 已等于该 SHA 的独立 clone 里跑；probe 文件 owner-only 权限）。

## 4. 红线

1. 全仓与沟通零 emoji；执行状态不说「完成」，settle 后说「执行和检查都跑完了，等你验收」，合并后才说「交付了」。
2. Gate 0 无 bypass、S3 语音不放行、TTS 脱敏、记忆 candidate→trusted、审计只记 digest；契约不分叉，09 已有类型一律 import `@saydo/contracts`。
3. 不改 AS 已收口的产品行为与其 evidence；不重放 PG-01A/PG-01B；不动 `deferred_exact_set` 内候选；不建通用平台/通知中心；不改 provider/runtime/安装器。
4. 施工只在独立 clone；主树只读收口；不 `git add -A`、不 `reset --hard`；一次授权不延续到下一次不可逆动作。
5. supervisor 只编排：不写产品代码、不自判 GREEN、不执行 reviewer 输出的任意命令；同一时间最多一个语义子会话；长任务用 `await_external_cli.py` 后台等待完成通知，不轮询。
6. 只报告实际验证的行为；未跑的标 not_run；commit hash 必须来自本会话 `git log`。

## 5. 本会话终点与报告

PG-02：可审查候选 → 独立 GREEN → 完整门与回归门 → finalize → （owner 确认后）I/E、干净 HEAD 重跑、关批、合并推送、公开快照 → 按链进入 PG-03。每批结束给：四行回报/成本实测、workspace/head/fingerprint、review verdict 与报告路径、focused/full 原始输出摘要、P2 ledger、not_run、未提交/未推送边界、下一动作。owner 只在真实范围/架构/外部权限/次数耗尽时被询问；soft context、首次 compaction、跨日不重复问许可。
