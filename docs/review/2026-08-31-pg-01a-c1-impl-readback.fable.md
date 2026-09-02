# PG-01A C1 首次独立只读实施对账报告

> 归档说明（supervisor）：这是 PG-01A C1 首次独立 readback，supersedes 此前“C1 尚未复审”的中间状态；不覆盖 C0 子阶段的历史 GREEN，也不将旧 cycle 记录清零。原始报告为 logs/pg01a-recovery-20260831.fWhCEM/c1-review-1.md，13423 bytes，SHA-256=c23c595d0a75ca8a91134ffe7b109f23b2b5651baa35a3eae8ea0173de64f615。下方独立结论及 manifest 保持原文。

> task=`project-gap-closure`
> stage=`PG-01A/C1`
> cycle=`owner-recovery-20260831-1`
> review_mode=`review_only`
> review_scope=`step`
> review_ordinal=`1`
> predecessor=`79211f6fec5c6eb092419c1871e35d8eedc4e3e5`
> candidate HEAD=`004b226db0b9a6fb0347d60dc790c97293d11635`
> candidate tree=`578f45078cde3e920912d108d1158dfefc7dc051`
> git-diff-v1 fingerprint=`e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727`
> candidate ref=`refs/heads/codex/pg-01a-20260831`
> 提交数=`1`
> 计划=`docs/plan/IMPL-PROMPT-PG-01A.md`
> P2 ledger=`docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md`

## TL;DR

`verdict=RED`。C1-1 至 C1-8 中 `[ok]=5`、`[fail]=3`、`[warn]=0`、`[divergent]=0`。

三个 P1 均可复现：

1. 现役公开根仍保留 canonical 明令禁止的绝对隐私、零费用、任意兼容 API 与固定时延声明。
2. active-claim checker 和现有 mutation 对这些残留产生假绿。
3. Q0 checker 会接受 `reason`、`locator_check`、`required_field_check` 被伪造后的报告。

既有同候选 focused 日志为 16/16 退出 0，但不能覆盖上述真实反例。当前 cycle 的唯一 repair 已使用，因此本轮停止于 `repair_budget_exhausted`，不自动施工或复审。

## 固定坐标与合同验证

[ok] `validate_handoff.py` exit 0：

```text
status=valid
contract_errors=[]
risk_violations=[]
unapproved_violations=[]
policy_version=2
```

[ok] 外部控制文件 SHA-256 全部匹配：

- `IMPL-PROMPT-PG-01A.md`：`7ef0233ed1e7204789f86d40e871216fff66ee8eb729a5e428ac5177ce53da16`
- owner decisions：`f7dbb21aca5e935c2738ce00c6ed34b218099b89331a2b20b77c0cc70ea65463`
- Deferred P2 ledger：`4a9274b9308a98c55d5152d06daedc8b6760d0fd088cdbc25cabb5a87f4fdae8`
- focused 原始日志：`afde1697194a55978b5064f5c4c6a47ecba3a6733bda33af5396a2047dd06264`

[ok] 本会话 `git log` 原始坐标：

```text
004b226db0b9a6fb0347d60dc790c97293d11635 578f45078cde3e920912d108d1158dfefc7dc051 79211f6fec5c6eb092419c1871e35d8eedc4e3e5 fix(pg-01a): 收紧公开承诺并校验语料真相
```

`git rev-list --count P..I` 输出 `1`。工作树审查前后 `git status --porcelain=v1 --untracked-files=all` 均为空。worktree 为 detached HEAD，但候选对象已由指定 ref 固化，因此未 fetch、未创建或移动 ref。

[ok] 实际 diff 为 31 路径、827 insertions、78 deletions。程序化 exact-set 对账结果：

```json
{"actual_count":31,"must_count":15,"missing_must":[],"outside_allowed":[]}
```

## C1-1 至 C1-8 对账

| 验收项 | 状态 | 取证与结论 |
|---|---|---|
| C1-1 公开声明止损 | [fail] | 多数文案已收紧，但仍有现役残留。`deploy/saydo-octoooo-com/en/index.html:202`、`:203`、`:416`、`:521` 仍宣称数据绝不离开设备；`deploy/saydo-octoooo-com/docs/index.html:368` 仍写任意 OpenAI 兼容端点，`:894` 仍写订阅调用不产生费用；`deploy/saydo-octoooo-com/en/docs/index.html:389`、`:444`、`:445`、`:919` 仍写 sub-second/fixed latency，`:917` 仍写 subscription calls cost nothing。违反 `docs/11-ui-spec.md:566`、`:575`、`:576`。 |
| C1-2 active-claim manifest/checker/mutation | [fail] | 31 个 required roots 存在，删除 root 与 deferred connector 反例在同 I 日志中能红；但禁词表 `scripts/check-active-claims.mjs:52`–`:59` 未覆盖上述现役英文及中文变体。`scripts/test-active-claims.mjs:98` 把“无需额外付费”和“全面支持任意 CLI”合并注入，却只在 `:101` 断言 `zero-extra-cost`，未独立证明 full-support 会红。独立反例门 exit 1：`[fail] checker accepted current forbidden English privacy and Chinese zero-cost claims`。 |
| C1-3 Q0 producer/checker/mutation | [fail] | producer 全量收集 986 个唯一 source_id，得到 `valid=0/unresolved=986`，三项 disposition 均为 `owner_downgraded_with_public_limit`。但 checker 在 `check-q0-truth-report.mjs:193`–`:199` 只把 `source_kind/entity/reader` 与 producer 对齐；独立把 `reason/locator_check/required_field_check` 改成伪造值后仍返回零错误。违反 `docs/06-references.md:191`、`:205`、`:208` 的字段合同。 |
| C1-4 I/E producer 时序 | [ok] | `git ls-tree` 对 I 中正式 Q0 report 路径输出为空；I 未预置自绑定报告。正式 writer/checker 留在语义 GREEN 后的 E 阶段，当前未运行。 |
| C1-5 源摘要与投影 | [ok] | `source_tree_sha256=0c2a1f...b2da6`；48 项 authority input 在 P/I 间 `changed_count=0`；当前 `authority_sha256=e62d211...ab98`。两份投影均与现役 renderer byte-exact，SHA-256 分别为 `36255565...5863` 与 `de04f8c6...4aad`。符合 owner 第 7 节精确例外。 |
| C1-6 copy-only/runtime 不变 | [ok] | 无 `packages/daemon`、`packages/contracts`、`pipeline`、`docs/09`、`docs/10`、workflow 或依赖锁变更。console 生产 diff 仅字符串或注释，未见权限、网络、状态机、布局或控制流变更。 |
| C1-7 HANDOFF 与 I 边界 | [ok] | `HANDOFF.md:49` 为 `active=PG-01A,next=none`，明确 C1 readback/full gate 待执行且 Q0 E report 不在 I。 |
| C1-8 三文件恢复 | [ok] | `setupWizardUx.test.tsx` 仅替换两条失真文案断言，周边结构断言仍保留，见 `:238`–`:274`；两份投影只更新 authority digest。净新增 `fromCharCode`、`eslint-disable`、`@ts-ignore`、`skip`、`only` 扫描无命中。 |

## P0/P1 质量发现

### B1 · P1 · C1-1：公开声明止损不完整

当前中英文官网和文档仍公开承诺 canonical 禁止的事实，包含：

- 绝对数据不出设备；
- CLI 订阅调用不产生费用；
- 任意 OpenAI-compatible 端点可用；
- API sub-second/fixed latency。

这些不是历史档案或测试 fixture，而是 `REQUIRED_ROOTS` 覆盖的现役公开页面。影响是用户可能据此作出隐私、费用和兼容性判断；属于本批直接目标和验收失败。

`in_scope=true`，`needs_owner_decision=false`。

### B2 · P1 · C1-2：active-claim 门禁假绿

本会话实测：

```text
node scripts/check-active-claims.mjs
exit 0
[ok] active claims roots=31
```

同一树同时确认：

```json
{
  "live_errors": [],
  "english_blanket_present": true,
  "zh_zero_cost_present": true,
  "full_support_phrase_matched": false
}
```

现有 mutation 的“free/full-support”名称与实际断言条件不一致：只要免费短语被捕获，即使 full-support 完全不受保护也会绿。这正是门禁通过但验收条件未被测到的假绿。

`in_scope=true`，`needs_owner_decision=false`。

### B3 · P1 · C1-3：Q0 最小对象字段可漂移

独立纯函数反例输出：

```json
{
  "baseline_errors": [],
  "mutated_errors": [],
  "mutated_fields": {
    "reason": "fabricated_reason",
    "locator_check": "fabricated_check",
    "required_field_check": "fabricated_check"
  }
}
```

三个值均不符合 producer 或合同词表，但 checker 接受。现有 mutation 只检查 `source_kind` 漂移；它在 false-valid 用例里修改两个 check 字段，但失败原因是 `status=valid`，没有独立证明字段漂移会红。

`in_scope=true`，`needs_owner_decision=false`。

## Deferred P2 ledger delta

本轮没有独立 P2 发现，也没有 ledger 状态更新：

```json
[]
```

既有 simulation validator 的 28 条 payload richness warning 不属于本批新增实现，未搬入本任务 ledger。

## 门禁结果

| 门禁 | 结果 | 原始输出摘录 |
|---|---:|---|
| corpus validator，本会话实跑 | 0 | `records=600`、`liveObjectSources=986`、`[ok] ...已知语义反例门通过` |
| simulation validator，本会话实跑 | 0 | `sessions=72`、`A=0 warn=28`、`[ok] A-level checks passed` |
| dry-run validator，本会话实跑 | 0 | `[ok] three-pass dry run validated`；source/authority digest 均匹配 |
| simulation mutation，本会话实跑 | 0 | 6 类反例全部 rejected，official tree unchanged |
| dry-run mutation，本会话实跑 | 0 | 全部声明的 row/summary/authority mutation rejected |
| public-text-redaction，本会话实跑 | 0 | `pass=28 fail=0` |
| console typecheck，本会话实跑 | 0 | 实际命令覆盖 `packages/console`，底层为 `tsc --noEmit` |
| console eslint，本会话实跑 | 0 | `pnpm exec eslint packages/console/src`，无输出 |
| console Vitest，同 I 原始日志 | 0 | `33 passed` test files、`279 passed` tests，其中 `setupWizardUx.test.tsx` 23 tests |
| corpus/active/Q0 mutation，同 I 原始日志 | 0 | corpus 77 类、active 7 项、Q0 15 项均记录通过 |
| active-claim 独立语义反例 | 1 | `[fail] checker accepted current forbidden English privacy and Chinese zero-cost claims` |
| Q0 独立字段漂移反例 | 1 | `[fail] q0 checker accepted reason/locator_check/required_field_check drift` |
| diff check，本会话实跑 | 0 | 无输出 |
| 最终 clean/fingerprint 回读 | 0 | status 空；fingerprint 仍为 `e42dd19c...f9727` |

只读沙箱不允许创建临时目录或 Vite `.vite-temp`。因此本会话直接重跑 corpus/active/Q0 临时 fixture 与 Vitest 时得到 `EPERM`；这不是产品失败。对应 exact argv 的同 I 原始日志已逐行读取并核验 SHA-256，记录 16/16 exit 0、`clean_after=true`。本报告没有把这些项伪装成本会话直接复跑。

## not_run

以下项目依 R/G/E 时序未运行，不记绿：

- `just ci`：仅语义 GREEN 后运行；当前为 RED。
- HTML 中文/英文渲染检查：仅语义 GREEN 后运行。
- 正式 Q0 E report writer/checker：I 中应无该 artifact。
- E evidence、week-audit writer、本地 E commit。
- 真实账号、connector、产品 AI、live 服务、跨平台/真机、push、merge、deploy。

## 修复清单与下一动作

1. 收紧上述现役中英文公开文案，移除绝对隐私、零费用、任意兼容和固定时延承诺。
2. 让 active-claim checker 覆盖这些真实变体；将免费、full-support、兼容性、时延、数据边界分别做独立反例，避免组合测试互相遮蔽。
3. 让 Q0 checker 对齐全部八个对象字段及字段词表，并为 `reason`、`locator_check`、`required_field_check` 分别增加独立漂移反例。

三个 blocker 均在既有 exact scope 内且不需新的产品决策。但本 cycle `repair_rounds_used=1`，不得自动再修或再审。报告交回 supervisor，停止并由 owner 决定是否授权新 cycle。

```review-manifest
{
  "verdict": "RED",
  "review_ordinal": 1,
  "candidate_head": "004b226db0b9a6fb0347d60dc790c97293d11635",
  "diff_fingerprint": "e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727",
  "review_scope": "step",
  "blockers": [
    {
      "id": "B1",
      "severity": "P1",
      "summary": "现役公开根仍发布 canonical 禁止的绝对隐私、费用、兼容性和时延声明",
      "evidence": "deploy/saydo-octoooo-com/en/index.html:202; deploy/saydo-octoooo-com/docs/index.html:894; deploy/saydo-octoooo-com/en/docs/index.html:389",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "C1-1"
    },
    {
      "id": "B2",
      "severity": "P1",
      "summary": "active-claim checker 与组合 mutation 对现存禁用声明产生假绿",
      "evidence": "scripts/check-active-claims.mjs:52; scripts/test-active-claims.mjs:98",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "C1-2"
    },
    {
      "id": "B3",
      "severity": "P1",
      "summary": "Q0 checker 接受 reason、locator_check、required_field_check 漂移",
      "evidence": "research/customer-question-corpus/check-q0-truth-report.mjs:193; research/customer-question-corpus/check-q0-truth-report.mjs:197",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "C1-3"
    }
  ],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "handoff-contract",
      "exit_code": 0,
      "summary": "Workflow V2.2 contract valid，无违规"
    },
    {
      "name": "candidate-scope-and-cleanliness",
      "exit_code": 0,
      "summary": "HEAD/tree/fingerprint 匹配；31 路径；15 个 must 全部存在；无越界；前后 clean"
    },
    {
      "name": "corpus-readonly-validation",
      "exit_code": 0,
      "summary": "600 records 与 986 LIVE source objects 通过；dry-run byte-exact"
    },
    {
      "name": "simulation-and-dry-run-mutations",
      "exit_code": 0,
      "summary": "本会话实跑的两组反例均被拒绝"
    },
    {
      "name": "console-typecheck-eslint",
      "exit_code": 0,
      "summary": "本会话实跑 tsc --noEmit 与 packages/console/src eslint 通过"
    },
    {
      "name": "console-vitest-same-candidate-log",
      "exit_code": 0,
      "summary": "同 I 原始日志为 33 files、279 tests 通过；本会话复跑受只读沙箱阻断"
    },
    {
      "name": "active-claim-semantic-negative-probe",
      "exit_code": 1,
      "summary": "checker 接受当前英文绝对隐私与中文零费用声明"
    },
    {
      "name": "q0-object-field-negative-probe",
      "exit_code": 1,
      "summary": "checker 接受伪造的 reason、locator_check、required_field_check"
    },
    {
      "name": "diff-check",
      "exit_code": 0,
      "summary": "候选 diff 无 whitespace error"
    }
  ],
  "stop_reason": "repair_budget_exhausted"
}
```
