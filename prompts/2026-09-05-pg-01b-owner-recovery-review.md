# PG-01B owner-recovery-3 零上下文复审（ordinal 2）

你是全新、零上下文、只读 reviewer。工作目录固定为
`<repo>`（一个独立 clone，不是主树）。

先完整读取该仓库的 `AGENTS.md`，再严格做 implementation readback。

## 禁止事项（硬约束）

- 不得读取任何 `logs/**/review-*.md`、任何 `*.events.jsonl`、任何 `*-handoff.md`、任何
  `carry-in-*.md`、任何实施模型自述或父会话记录。你只看仓库代码、canonical 文档、验收合同、
  focused 证据日志与 git 事实。
- 不得修改产品代码或测试，不得 `git commit` / `git push` / `git merge` / `git checkout` 切换
  分支、不得删除目录、不得启动服务、不得改任何 `logs/` 之外的文件。
- 不得运行完整 `just ci` 或 `pnpm exec playwright test`：按冻结 policy，这两项只在 semantic
  GREEN 后由 supervisor 在同一 clean I 上运行；它们尚未重跑不构成 blocker，不得据此判 RED。
- 唯一允许的写操作：把你的复审报告写到
  `logs/pg01b-owner-recovery-3-20260905/review-2.md`。

## 独立核验坐标

- task=`project-gap-closure`; stage=`PG-01B`; cycle=`pg01b-owner-recovery-3`; review ordinal=`2`; scope=`step`
- P=`bcf8ea855f25b177888d9159f75e49214f3dd892`
- candidate I=`ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb`
- expected tree=`20e3303197f602d27548a4ab7d4490263fb85272`
- expected fingerprint=`e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727`
- 上一 candidate（本轮修复的基线）=`c1e7f5bc4d539aa9e591e5b61f7355f63243e048`
- frozen acceptance=`logs/pg01b-cycle-20260904/acceptance.frozen.json`
- coverage matrix=`logs/pg01b-cycle-20260904/coverage.json`
- original implementation contract=`logs/pg01b-implementation-20260904/implementation-prompt.md`
- unique P2 ledger=`docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md`

先用真实命令验证 HEAD/tree/parent、工作树与 index clean、
`python3 ~/.octoworkflow/candidate_fingerprint.py --expect <expected fingerprint>`、
`git rev-list --count P..I` 必须为 1、P..I 完整 diff 与 exact pathset。
candidate 必须是 parent=P 的单一 implementation commit。

本轮相对上一 candidate `c1e7f5bc4d539aa9e591e5b61f7355f63243e048` **只允许**修改这 2 个测试文件：

- `packages/daemon/test/voice-hub.test.ts`
- `e2e/console/console.spec.ts`

任何产品代码（`packages/**/src/**`、`pipeline/**`、`scripts/**`）在这一段 delta 里被改动都是越界，
必须报 P0/P1。

P..I 的完整 pathset 共 44 项，超出 `logs/pg01b-implementation-20260904/implementation-prompt.md`
声明的 must/may 集合。supervisor 认为这些越界项都是冻结 acceptance 反向强制的机械后果。
**请你自己独立判断**；若认为构成范围扩张，照实报出并把 `needs_owner_decision` 设为 `true`。

## 本轮修复必须独立验证

本轮补回三处此前被移除、且没有等价替代的守护。产品代码未改，缺的只是证明它们仍然正确的测试。

**缺口 1（最重要，触碰 AGENTS.md 硬规则 4：TTS 脱敏）**

`packages/daemon/src/voice/hub.ts` 的 `sendTtsSay` 会先 `redactText(msg.text, redactSpans)` 再下发。
此前 `packages/daemon/test/voice-hub.test.ts` 里唯一的 `tts.say` 样本不含任何可脱敏内容，因此把
产品里的 `redactText(...)` 整个删掉，测试仍会全绿。本轮新增了针对该接线的集成断言。

你必须独立回答这个问题：**如果把 `hub.ts` 里的 `redactText(...)` 换成直接透传 `msg.text`，
新增的断言会不会失败？** 具体核查：

1. 新用例的样本文本，是否真的是 `packages/daemon/src/voice/redactor.ts` 会改写的形态？
   去读 redactor 的实现与 `packages/daemon/test/redactor.test.ts`，确认该形态确实被处理。
   如果样本是一种 redactor 其实不碰的形态，那断言就是永真的，等于换了一层假绿——必须报 P0/P1。
2. 断言是否真的绑定到「脱敏后」的结果（例如断言不含敏感字面量、且含脱敏后的标记），
   还是只做了某种恒成立的弱断言。
3. `redactSpans` 那条路径是否也被覆盖。

**不得**为验证而修改任何产品代码。用代码路径论证，不要做变异实验，也不要暗示你做过。

**缺口 2、3**

`packages/console/src/mobile/MobileApp.tsx` 的 `queueText`：成功路径（清草稿、
`setSuppressFirstRun(true)`、跳 `#/m/chat`、发送 toast）与 catch 分支（失败 toast 且**不清草稿**）
此前端到端无覆盖。本轮新增了本机用例。请核查：

1. 这两条用例是否走**本机路径**（localhost baseURL / 既有 `open()` 辅助），而不是
   `runtime.lanAddress`。PG-01B 关掉了远程业务面，用 LAN 地址写这两条会立刻失效。
2. 断言是否对准 `MobileApp.tsx` 里真实的 toast 文案与 DOM 结构，而不是自造的字符串。
3. 失败路径的猴补是否真的能命中发送路径（`"t":"turn.text"`），还是可能因为条件写错而
   根本没触发异常、于是走了成功路径却仍然「通过」。
4. 断言草稿保留，是否确实断言了输入框的值仍等于原草稿。

**你必须自己跑这三项**，并在报告里给出计数行原文与 exit code：

- `pnpm --filter @saydo/daemon exec vitest run`（daemon 全量）
- `pnpm --filter @saydo/console exec vitest run`（console 全量）
- `pnpm exec playwright test`（Playwright 全量）

直接前台跑完，不要用会因 stdout 静默而提前打断它的包装器；被中断就重跑。

Playwright 会改写 `e2e/screenshots/**` 下的 tracked 截图。你可以直接用仓内已冻结的入口脚本
`bash logs/pg01b-owner-recovery-3-20260905/gate-entries/playwright.sh`，它会先清理
47188/47189/47120 上的残留监听与 `/private/tmp/saydo-playwright-home-*`，跑完自动
`git checkout -- e2e/screenshots` 并保留原 exit code。若你选择直接跑 `pnpm exec playwright test`，
则必须自己还原截图。无论哪种，报告里都要写明你怎么处理的，并用 `git status --short` 佐证工作树干净。

## 完整验收逐项 readback

冻结 acceptance 的 7 项都要独立取证，不得因为「上一轮已经绿」而跳过（你没有上一轮的信息）：

1. `PG01B-DIRECT-HIDDEN`：底层 schema/存储兼容可保留但须在 canonical 里 designed/deferred；
   现役 UI、Brain、tool enum/default route、active golden 与 canonical 只开放 `step_confirm`；
   旧 direct package fail-closed。
2. `PG01B-ABANDON-SEPARATE`：UI 独立 endpoint；server 端 trim 后拒绝纯空白且 lifecycle 不变；
   正常写 `abandoned` + 独立 `focus.abandoned` audit；该 audit 不落自由文本 reason 原文，关联
   只用仓内 canonical digest；trim 后 reason 确实进入 `lifecycle_changed` payload 且有测试断言；
   archive 兼容不变。
3. `PG01B-BUDGET-UNKNOWN`：无来源显式 unknown；`ExpectationGroup` 与 `ProgressAlignCard` 不显示
   零值或 0% track；已知预算正常；SSR 测试真测 DOM。
4. `PG01B-REMOTE-BUSINESS-403`（P0）：main/recovery 的 remote `/api/**` 与 remote WS fail-closed，
   local 不回归；仅放行 health/readiness/static shell/safe redirect；核对 handler/upgrade/guard
   的实际顺序，guard 必须在业务 handler 之前。
5. `PG01B-REMOTE-DENOMINATOR`：`scripts/remote-surface-inventory.json` 每条有精确 method/via/
   outcome；`scripts/check-remote-surface-inventory.mjs` 对 HTTP method+path、WS、Unix listener
   与 via/outcome 双向对账；mutation self-test 覆盖 omission、guard bypass、WS、method、via、
   outcome。
6. `PG01B-SP2D-COMPAT`：abandon 是 additive runtime parse、bundled client 已使用、旧 `/archive`
   N/N-1 兼容，无破坏性 schema/数据库迁移。
7. `PG01B-GIT-POINTER`：`node scripts/schedule-pointer.mjs --check` 与 HANDOFF 同步。

另外核对安全红线未被放宽：Gate 0 无 bypass、S0-S3、audit 不可变、TTS 脱敏；`docs/plan/
2026-08-28-project-gap-owner-decisions.md` 里 D3/D6 未签不得被当作已放开。

## Review Value Boundary（必须遵守）

P0/P1 必须绑定当前 canonical / 正式入口 / 声明 grammar 内**实际可达**的失败。手工篡改受管模板、
超出声明 grammar 的变体、或要求启发式 linter 对无限语言完备，一律默认 Deferred P2。linter 是
defense-in-depth，不是 security boundary。不做重复的开放式 fuzz。

## 可用的既有 focused 证据（只读，可自行重跑纯只读检查）

- `logs/pg01b-repair-1-20260905/`：console 45 tests、daemon 63 tests、pairing corpus 216、
  inventory 119 exact-set + mutations、pointer/privacy/emoji/diff
- `logs/pg01b-fullgate-repair-2-20260905/`：voice-hub 与 mobile-lan
- `logs/pg01b-repair-3-20260905/`：daemon typecheck、console-actions
- `logs/pg01b-owner-recovery-3-repair-1-20260905/`：本轮 5 条门禁

这些日志是他人产出的证据，**不是**结论。你应当自己重算 SHA-256 并读真实输出；能只读重跑的
检查（inventory checker、self-test、schedule-pointer、public-tree-privacy、emoji、diff-check、
以及 daemon/console vitest）请自己跑一遍，把真实 exit code 写进报告。运行会写 temp/cache 的
suite 时注意不要污染工作树——跑完用 `git status --short` 确认仍然 clean，若被污染必须在报告里
说明并恢复。

## 输出格式

把报告写到 `logs/pg01b-owner-recovery-3-20260905/review-2.md`，用简体中文。全仓禁 emoji 与
pictographic 符号，状态标记只用 `[ok]` / `[warn]` / `[fail]` / `[divergent]`（文本箭头 `→` 合法）。

报告内容：candidate 身份与 exact pathset、逐项 readback 表、代码证据（file:line）、你实际运行
的 focused 证据（命令 + exit code）、P0/P1 blocker、完整 P2 delta。

报告末尾**只能有一个** ```review-manifest 代码块，JSON 形如：

```json
{
  "verdict": "GREEN 或 RED",
  "review_ordinal": 2,
  "candidate_head": "ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb",
  "diff_fingerprint": "e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727",
  "review_scope": "step",
  "blockers": [],
  "p2_ledger_delta": [],
  "focused_gates": [{"name": "...", "exit_code": 0, "summary": "..."}],
  "stop_reason": null
}
```

- GREEN 时 `blockers` 必须是 `[]`、`stop_reason` 必须是 `null`、所有 `focused_gates` 的
  `exit_code` 必须是 0。
- RED 时每个 blocker 给完整字段：`id`、`severity`（P0/P1）、`summary`、`evidence`（带 file:line）、
  `in_scope`（bool）、`needs_owner_decision`（bool）、`acceptance_item`（冻结 acceptance 的 ID）。
- `focused_gates` 每项只含 `name` / `exit_code` / `summary` 三个键。
- P2 项写进 `p2_ledger_delta`。不要因为 P2 把结论判成 RED。**每一条 P2 都必须给全这 8 个字段，
  一个都不能少**（缺字段会被机器校验器判为无效评审）：`id`、`first_seen_candidate`、`location`、
  `evidence`、`impact`、`status`、`last_validated_candidate`、`resolution`。其中
  `first_seen_candidate` 与 `last_validated_candidate` 填你观察到该项时的 candidate head 完整
  40 位 SHA；`status` 用 `open`。
- `stop_reason` 是控制信号，不是 RED 的原因说明：**非 `null` 表示「停止自动修复循环、必须上浮
  owner 决策」**。RED 的原因完整写在 `blockers[]` 里即可。只有当你认为确实需要 owner 拍板时才
  填 `stop_reason`，且此时对应 blocker 的 `needs_owner_decision` 必须一并为 `true`；两者必须一致。
  正常的、范围内可自动修的 RED，`stop_reason` 应为 `null`。

绝不编造命令输出、SHA 或测试结果。没跑的就写没跑。你的结论会被机器校验器
`validate_review_manifest.py` 消费，字段不合规会被判为无效评审。

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```
```roles
{"implementation":{"cli":"grok","model":"grok-4.6","provider":"xai","reasoning_effort":"xhigh"},"review":{"cli":"claude","model":"claude-opus-5","provider":"anthropic","reasoning_effort":"max"},"supervisor":{"cli":"claude","model":"claude-opus-5","provider":"anthropic","reasoning_effort":"xhigh"}}
```
