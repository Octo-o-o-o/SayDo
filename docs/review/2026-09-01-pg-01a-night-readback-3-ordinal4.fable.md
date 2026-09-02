# PG-01A 夜间恢复 fresh readback 3（ordinal 4）实施对账报告

> 归档：本报告是 cycle=owner-night-recovery-20260901 的第三次 fresh readback（review ordinal 4），不覆盖前三份 RED。原始报告 `logs/pg01a-night-20260901.V1D8er/review-ordinal-4.md` 为 10836 bytes，SHA-256=`7f1134248f36cc0e24271b9efec76de7cb833cd1b0292c311f7e14b6783ab85a`；日志为 561852 bytes，SHA-256=`d71acb83c2a9958b9e7ebe6e2f4b599b52a33e581a8f3a6242a8ea1e4441ff04`。runner exit=0，存在唯一 `thread.started` 与唯一 `turn.completed`，session=`01a059e3-8a15-7190-8976-1e838a5ccf43`。supervisor 将 cycle-state 的 current blockers 按报告机械同步为空后，使用冻结 V2.3 与 expected task/stage/cycle/HEAD/fingerprint/ordinal 校验为 `valid/full_gate`；没有改写 reviewer 的 GREEN。

# PG-01A C1-N fresh readback ordinal 4

[ok] 语义结论：`GREEN`。B1、B2 均已关闭；这只表示 ordinal 4 的 step readback 通过，不代表完整门禁、页面 QA 或最终交付已完成。

本会话为 `review_only`，未施工、未派 agent、未写报告文件、未改 ledger，也未执行 fetch/commit/stash。

## 身份与固定输入

- `task=project-gap-closure`
- `stage=PG-01A/C1`
- `cycle=owner-night-recovery-20260901`
- `review_ordinal=4`
- `review_scope=step`
- HEAD：`2b5517d322f062297d25806b02c4106e2ecc60e8`
- HEAD tree：`c5cae2f04ee907328b672e3099c865f1c3f83552`
- 当前为 detached HEAD。
- 初始与最终 `git-diff-v1` 均为 `8455d6c5d42142b36cd7104e3b74989c64a2db6d2871af771610e598aa9fda49`。
- `git log -1` 实读 subject：`fix(pg-01a): 收紧公开承诺并校验语料真相`。

固定输入均从 source/control 目录读取：

- IMPL-PROMPT：`1acd33ba471f71209bbceb7d10fec1bb1f0162f677ab5c6a8967076268ebaa8d`
- owner decisions：`983452a68e35a793b9394ced759e5b8ded43f83a00ae72b4925d30c45a75d9a6`
- V2.3 policy：`785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a`
- last-slot：`4611029bf3b02c350751b15f2d5e41b1a930c51399810ed23ff2f72b27cc8e0b`
- P2 ledger：`4a9274b9308a98c55d5152d06daedc8b6760d0fd088cdbc25cabb5a87f4fdae8`
- focused receipt：1117 bytes，`9b9e5e326be915318eeaab2a2643d2d2d0a048f4c9d763702fb5a223eb2490a8`

`validate_handoff.py` 显式传冻结 policy 后 exit 0，输出 `status=valid`、无 contract/risk violation。C1-N、C1-N-L 和 owner decisions 已完整读取。只读取了上一报告的 B1/B2；未读取 Grok transcript、repair prompt 或 implementation log。

## 31 个 required roots 全量枚举

| # | required root | 当前正文核对 |
|---:|---|---|
| 1 | `AGENTS.md` | [ok] 无目标逃逸族现役声明 |
| 2 | `README.md` | [ok] 仅安装入口，无目标逃逸族 |
| 3 | `deploy/saydo-octoooo-com/docs/index.html` | [ok] 供给均以接线、调用/自检通过为条件；费用归服务商 |
| 4 | `deploy/saydo-octoooo-com/en/docs/index.html` | [ok] 与中文边界一致 |
| 5 | `deploy/saydo-octoooo-com/en/index.html` | [ok] wired + call check；不从 sign-in/subscription 推出权益 |
| 6 | `deploy/saydo-octoooo-com/en/privacy/index.html` | [ok] 无目标逃逸族 |
| 7 | `deploy/saydo-octoooo-com/en/support/index.html` | [ok] 无目标逃逸族 |
| 8 | `deploy/saydo-octoooo-com/en/terms/index.html` | [ok] 无目标逃逸族 |
| 9 | `deploy/saydo-octoooo-com/index.html` | [ok] 接线、调用验证和厂商费用限定齐全 |
| 10 | `deploy/saydo-octoooo-com/privacy/index.html` | [ok] 无目标逃逸族 |
| 11 | `deploy/saydo-octoooo-com/support/index.html` | [ok] 无目标逃逸族 |
| 12 | `deploy/saydo-octoooo-com/terms/index.html` | [ok] 无目标逃逸族 |
| 13 | `docs/06-references.md` | [ok] canonical 明确禁止由 `logged_in` 推断权益、费用或可调用 |
| 14 | `docs/11-ui-spec.md` | [ok] canonical 明确规定供给与费用禁推 |
| 15 | `docs/release/2026-08-13-app-materials.md` | [ok] 已登录不等于可调用，须接线并自检 |
| 16 | `docs/release/metadata.json` | [ok] 商店正文使用相同条件边界 |
| 17 | `docs/release/v0.1.0-rc.12.md` | [ok] 无目标逃逸族 |
| 18 | `docs/site/style-demos/11-hybrid.html` | [ok] 接线、调用验证和厂商费用限定齐全 |
| 19 | `justfile` | [ok] 无用户可见目标声明 |
| 20 | `packages/console/src/components/SetupGate.tsx` | [ok] 明确要求接线和调用验证 |
| 21 | `packages/console/src/components/SetupWizard.tsx` | [ok] 本次只收紧 API 时延文案 |
| 22 | `packages/console/src/components/SupplyPicker.tsx` | [ok] 未见用户可见逃逸；源码约束含 self-test |
| 23 | `packages/console/src/lib/resourcePlans.ts` | [ok] 费用文案依据探测 provenance，不由登录代填免费 |
| 24 | `packages/console/src/lib/setupApi.ts` | [ok] 无用户可见逃逸；供给需 wired provider |
| 25 | `packages/console/src/pages/Chat.tsx` | [ok] 只保留非保证性时延说明 |
| 26 | `packages/console/src/pages/GlobalSettings.tsx` | [ok] 接线、调用验证和服务商费用限定齐全 |
| 27 | `packages/console/src/voice/useVoiceChannel.ts` | [ok] 无目标逃逸族 |
| 28 | `research/customer-question-corpus/README.md` | [ok] 保留 unresolved requirement 标记 |
| 29 | `templates/saydo.config.dev.example.toml` | [ok] 已接线 CLI、零 key 不推断免费 |
| 30 | `templates/saydo.config.example.toml` | [ok] 明确要求接线并通过调用验证 |
| 31 | `templates/saydo.env.example` | [ok] 明确要求接线且自检通过 |

“一个订阅”方案与 CLI 支持目标被保留；其现行上下文要求 wired/self-test，并没有把“登录不等于可调用或免费”误判成过度承诺。

## 五条 ordinal 3 残留复验

| 对象 | 当前证据 | 结果 |
|---|---|---|
| 中文 docs 原 `:158` | `deploy/.../docs/index.html:158` 要求已接线并通过调用验证，并声明登录/订阅不等于可调用 | [ok] |
| 中文 docs 原 `:837` | `deploy/.../docs/index.html:837` 明确登录不证明权益、额度、免费，账本不从登录态写“订阅额度内” | [ok] |
| 英文 docs 原 `:159` | `deploy/.../en/docs/index.html:159` 使用 wired + passed call check，并否定 sign-in/subscription 自动可调用 | [ok] |
| 英文 docs 原 `:860` | `deploy/.../en/docs/index.html:860` 否定登录证明 callable path、rights、quota 或 free usage | [ok] |
| 英文 docs 原 `:862` | `deploy/.../en/docs/index.html:862` 只声明 SayDo 不收费，系统、浏览器或网络识别费用归对应厂商 | [ok] |

B1/P1 已关闭。其余 30 个 current roots 未发现保留同根因的无条件登录、额度或浏览器语音免费声明。

## B2 与有限 scanner

[ok] `scripts/check-active-claims.mjs:12-44` 固定 31-root 集合；测试在 `scripts/test-active-claims.mjs:13-66` 维护独立 exact-set。

[ok] 五个真实逃逸均有独立 injection：

- 中文登录态供给：`scripts/test-active-claims.mjs:118-121`
- 英文 subscription login 供给：`:122`
- 中文登录态推出额度：`:123-126`
- 英文 existing login 推出 quota：`:127-131`
- 英文 browser voice free：`:132`

循环在 `:134-143` 为每个 mutation 单独重建候选并要求精确错误 ID，不靠另一错误遮蔽。missing-root 位于 `:86-94`；假 LIVE 位于 `:159-170`；原负例保留。

[ok] scanner 仅新增有限词形规则，位于 `scripts/check-active-claims.mjs:87-94`；没有通用 NLP、全词判红或宽泛豁免。

[ok] 本会话内存反例 exit 0：

- 五个非法实例分别命中预期 `subscription-login-as-supply`、`login-implies-quota` 或 `browser-voice-free`。
- 四个合法实例“登录不等于可调用或免费”“不从登录推断订阅额度”“SayDo 不收费但厂商可能收费”“已接线并通过调用验证的条件供给”均 `hits=[]`。

[ok] `fromCharCode`、`codePointAt`、`eslint-disable`、`@ts-ignore`、test `skip/only` 和新增 Unicode escape 检索均无输出。测试 diff 为新增行为回归，没有删除或弱化原负例。

## 范围和不变量

- 最终 `git status --porcelain` 仍恰为 15 个 `M` 文件，无新增、删除或未跟踪文件。
- 程序化对照 C1-N 34-path exact-set：`changed_count=15`、`outside=[]`。
- repair 3 的 pre/post scope 对照：`total=2053`、`protected_count=2049`、protected SHA 与 status paths 均不变；唯一改变的是两份 docs 和 checker/test 四个允许路径。
- 四个当前文件 SHA 与 post-scope 记录完全一致。
- source/control 与被审目录的 15 个产品文件逐项 byte compare，15/15 exit 0。
- HTML、Markdown、JSON、TOML 与 TSX 改动均是正文或字符串替换；没有布局、权限、数据流、运行时控制流或 provider 能力扩张。其余代码变化只在 active checker/test。
- `git diff --quiet HEAD -- research/customer-question-corpus` exit 0。
- `git diff --quiet HEAD -- docs/06-references.md` exit 0。
- `git diff --quiet HEAD -- docs/11-ui-spec.md` exit 0。
- 上述三处限定 `git status` 为空；Q0/B3 bytes 未变，未重开 986/48 authority 审计。

## 门禁证据

- `node scripts/check-active-claims.mjs`：exit 0，原始输出 `[ok] active claims roots=31`。
- 五负例与四合法反例内存检查：exit 0，九项均 `[ok]`。
- `git diff --check`：exit 0，无输出。
- focused receipt 身份匹配同一 HEAD/fingerprint，记录 6/6 exit 0：roots=31、mutations=33、redaction=28、doc-links 117/0 broken。
- `node scripts/test-active-claims.mjs` 在本只读 sandbox 中未成功复跑：先输出四项 `[ok]`，随后因 `mkdtemp` 返回 `EPERM`，exit 1。未降低 sandbox；mutation 结果采用已核身份的同候选直接工具回执，并补做无写入内存反例。
- 草拟 manifest 不带 cycle-state 校验时 exit 0，`status=valid`、`next_action=full_gate`。
- 带固定 cycle-state 预校验时 exit 5，`inconsistent_current_blockers`：该 state 仍预载 ordinal 3 的 B1/B2。按固定输入声明，这是程序性 reconcile 问题，不是产品 RED，也未据此篡改 verdict 或 `stop_reason`。

## Deferred P2 ledger delta

`[]`

本轮无新 P2，不修改唯一 ledger，不做 final sweep。

## 未运行

- `just ci`
- 中英文 docs 隔离 headless Chrome 页面检查
- 正式 Q0、E、PG-01B
- console typecheck/lint/vitest
- 真实 AI、connector、账号登录、订阅权益、额度或付费验证
- push、merge、deploy、commit/amend

因此本结论不得推广为所有本地、云端、订阅或 API AI 服务均已开箱可用。语义 GREEN 后的完整门禁与页面 QA 仍由 supervisor 对同一候选执行。

```review-manifest
{
  "verdict": "GREEN",
  "review_ordinal": 4,
  "candidate_head": "2b5517d322f062297d25806b02c4106e2ecc60e8",
  "diff_fingerprint": "8455d6c5d42142b36cd7104e3b74989c64a2db6d2871af771610e598aa9fda49",
  "review_scope": "step",
  "blockers": [],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "active-claims",
      "exit_code": 0,
      "summary": "同候选回执通过；本会话无写入复跑 roots=31"
    },
    {
      "name": "active-claim-mutations",
      "exit_code": 0,
      "summary": "同候选回执记录 33 个行为变异通过"
    },
    {
      "name": "public-text-redaction",
      "exit_code": 0,
      "summary": "同候选回执记录 28 项通过"
    },
    {
      "name": "emoji",
      "exit_code": 0,
      "summary": "同候选回执通过"
    },
    {
      "name": "doc-links",
      "exit_code": 0,
      "summary": "同候选回执检查 117 个文件且 broken=0"
    },
    {
      "name": "diff-check",
      "exit_code": 0,
      "summary": "同候选回执与本会话复跑均通过"
    }
  ],
  "stop_reason": null
}
```
