# PG-01A 夜间恢复 fresh readback 2 实施对账报告

> 归档：本报告是 cycle=owner-night-recovery-20260901 的第二次 fresh readback，不覆盖旧 RED。原始报告 `logs/pg01a-night-20260901.V1D8er/review-2.md` 为 10548 bytes，SHA-256=`0bf883ab89043c619cbf4491acde0feeb652490f3b161de668884d215d47fe33`；日志为 874910 bytes，SHA-256=`3aed12e71421435831cdcb0824468e832ff60f3df71341932a3ff67eed252707`。runner exit=0，存在唯一 `turn.completed`，session=`01a059c1-e2fb-7820-a2f4-2d191650e8fb`。supervisor 使用冻结 V2.3、完整 cycle-state 与 expected task/stage/cycle/HEAD/fingerprint/ordinal 校验为 `valid/stop_for_owner`；没有改写 reviewer 的 RED。

# PG-01A C1-N fresh readback 2

`[fail]` 结论为 `RED`。上一报告点名的旧句式已经移除，但 31-root 全量复核发现同一 B1/B2 根因仍有 5 条现役残留：中英文 docs 仍由登录态推出推理供给或订阅额度，英文 docs 仍称浏览器系统语音免费。现有 checker 对这 5 条全部空命中，回归测试也未覆盖。

## 固定身份与输入

- `task=project-gap-closure`
- `stage=PG-01A/C1`
- `cycle=owner-night-recovery-20260901`
- `task_mode=review_only`
- `review_scope=step`
- `review_ordinal=3`
- 最终 HEAD：`2b5517d322f062297d25806b02c4106e2ecc60e8`
- HEAD tree：`c5cae2f04ee907328b672e3099c865f1c3f83552`
- parent：`79211f6fec5c6eb092419c1871e35d8eedc4e3e5`
- 最终 `git-diff-v1`：`32ff760d7da4d797230267342b70b4f88999fa1f6e76df1daf0d9ad14f224964`

`[ok]` 固定输入 SHA-256 均与派发值一致：

- IMPL-PROMPT：`7bf0a7aa06040584a6349aaf1524224030c097c83c33c45cd5a556947e1dd6b0`
- owner 决策单：`983452a68e35a793b9394ced759e5b8ded43f83a00ae72b4925d30c45a75d9a6`
- 冻结 V2.3 policy：`785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a`
- 唯一 P2 ledger：`4a9274b9308a98c55d5152d06daedc8b6760d0fd088cdbc25cabb5a87f4fdae8`
- focused receipt：`3463ae67397c25f59666b9184d8c48083f30d15ab177522213cc467d45e1ecb1`，1613 bytes

`validate_handoff.py` 显式使用冻结 policy，exit 0，输出 `status=valid`，无 contract/risk violation。cycle-state 坐标、ordinal、repair/rereview=`2/2`、strategy reset=`1` 均核对通过。本结论不因同根因次数上限改写，后续流转不由 reviewer 决定。

`[ok]` dirty exact-set：

- `dirty_count=15`
- `night_scope_count=34`
- `scope_dirty_intersection_count=15`
- `dirty_not_in_scope` 为空

最终 `git status --porcelain=v1` 仍恰为派发指定的 15 个文件。总 diff 为 83 insertions、45 deletions；13 个产品文件只改公开文案，另外 2 个文件改有限 scanner/test。未发现布局、权限、数据流、运行时控制流或 AI provider 能力扩张，也无文件模式变化。

## 七类现役文案复验

| 类别 | 结论 | 实证 |
|---|---|---|
| 1. SetupGate 登录态不能直接推出可聊 | `[ok]` | `packages/console/src/components/SetupGate.tsx:279` 已要求“已接线并通过调用验证”，并明确登录不等于可调用或免费。 |
| 2. 中英文首页须写 wired+self-test | `[ok]` | 中文首页 `:370`、英文首页 `:370` 均写明 wired/call check；不再由登录态直接推出供给。 |
| 3. 首页/style 不得把订阅推出可用或免另一订阅 | `[ok]` | 中文首页 `:475`、英文首页 `:478`、style demo `:556,:627` 均明确登录或订阅不等于可调用，权益和费用以服务商为准。 |
| 4. 中英文 docs 不得由登录态推出供给或额度 | `[fail]` | `deploy/saydo-octoooo-com/docs/index.html:158,837` 与英文 `en/docs/index.html:159,860` 仍存在直接推导，构成 B1。 |
| 5. SetupWizard 不承诺 API 秒回 | `[ok]` | `packages/console/src/components/SetupWizard.tsx:759` 已改为“时延以服务商和网络为准”。 |
| 6. release 区分开发者不收集与第三方处理 | `[ok]` | `docs/release/2026-08-13-app-materials.md:59,63,70,170` 已区分开发者不收集、配置决定的 AI/语音第三方处理及设备端/联网识别。 |
| 7. 中英文与元数据变体一致 | `[fail]` | metadata 当前已对齐；但英文 docs `:862` 仍称 “browser system voice is free”，与中文及服务商费用边界不一致。 |

上一报告的 10 个旧 exact needles，包括“已登录哪家用哪家”“API 秒回”“不上传任何用户数据”等，已在全部 claim roots 中实测为零命中，说明候选存在真实修复进展。

## C1-N 对账

| 验收项 | 结论 |
|---|---|
| C1-N-1 | `[fail]` B1：31-root 仍有现役登录态、订阅额度和英文系统语音免费过度承诺。 |
| C1-N-2 | `[fail]` B2：上述 5 条实际形式均未进入对应独立行为回归。 |
| C1-N-3 | `[warn]` 部分满足：scanner 仍是有限规则，没有通用 NLP、宽泛豁免或所有文字一律红；原五类、exact-set、missing-root、假 LIVE 与合法正例均保留。但“针对当前现役正文和真实逃逸”的要求未满足。 |
| C1-N-4 | `[ok]` `research/customer-question-corpus`、`docs/06-references.md`、`docs/11-ui-spec.md` 相对 HEAD 的 `git diff --quiet` 均 exit 0。未重开 B3/Q0。 |
| C1-N-5 | `[ok]` 最终 HEAD、fingerprint、15-path delta 和 34-path 边界均吻合；未冒充新 implementation SHA。 |

## B1 / B2

### B1 · P1 · C1-N-1

`[fail]` 以下均为现役原文：

- `deploy/saydo-octoooo-com/docs/index.html:158`：称推理槽位“可用……订阅登录态”。
- `deploy/saydo-octoooo-com/en/docs/index.html:159`：称 reasoning slots can use the providers’ “subscription login”。
- 中文 docs `:837`：从现有 CLI 登录态直接写到账本显示“订阅额度内”。
- 英文 docs `:860`：从 existing login 直接写到 “within subscription quota”。
- 英文 docs `:862`：仍称 “browser system voice is free”。

这些文字没有在同一声明中绑定 wired+self-test 或已验证订阅 provenance；费用以服务商为准也不能证明登录态对应订阅权益。影响是用户仍可能把登录误认成供给与订阅额度，并把系统/网络语音识别误认成确定免费。

`in_scope=true`，`needs_owner_decision=false`。

### B2 · P1 · C1-N-2/C1-N-3

`[fail]` corrected in-memory probe 对上述 5 条逐行运行当前 `FORBIDDEN_CLAIM_PATTERNS`，全部返回 `scanner_hits=[]`。`scripts/test-active-claims.mjs` 对以下现役 needle 也全部 `present=false`：

- `订阅登录态`
- `subscription login`
- 中文现有登录态到订阅额度句式
- 英文 existing login 到 quota 句式
- `browser system voice is free`

与此同时，`node scripts/check-active-claims.mjs` 仍 exit 0 并输出 `[ok] active claims roots=31`，因此该绿色结果不能证明 C1-N-1 已成立。

`[ok]` scanner 没有通过删测试或全量误杀造绿：

- 原五类负例仍在 `scripts/test-active-claims.mjs:97-101`。
- 独立 31-root exact-set、missing-root、假 LIVE 仍保留。
- conditional/preview、零 key 不等于免费、配置决定外发与费用、约 15–25 秒观察值的内存扫描均为零命中。
- 未发现 `fromCharCode`、`eslint-disable`、`@ts-ignore`、`.skip(` 或 `.only(`。

`in_scope=true`，`needs_owner_decision=false`。

## 命令与门禁证据

| 命令/证据 | Exit | 摘录与结论 |
|---|---:|---|
| `candidate_fingerprint.py <reviewed>`，初始与最终各一次 | 0 | 最终仍为指定 HEAD 与 fingerprint。 |
| `validate_handoff.py ... --policy <frozen-v2.3>` | 0 | `status: valid`。 |
| `pnpm --filter @saydo/console typecheck` | 0 | `> tsc --noEmit`。 |
| `node scripts/check-active-claims.mjs` | 0 | `[ok] active claims roots=31`；语义复核证明是假阴性。 |
| `node scripts/test-active-claims.mjs` | 1 | 在跑完最初几项断言后，`mkdtemp` 返回 `EPERM`；本会话未成功重跑 mutation，未降低 sandbox。 |
| focused receipt 哈希、大小、candidate 与 9 项结果的 `jq -e` 断言 | 0 | `true`；同候选记录 9/9、mutations=28、console=33 files/279 tests、candidate unchanged。 |
| 当前 5 条实际文案的无写入内存探针 | 0 | 5 条均 `scanner_hits=[]`，对应 test needles 均不存在。 |
| `git diff --check` | 0 | 无 whitespace error。 |
| 三项 protected-byte `git diff --quiet` | 0 | corpus、docs/06、docs/11 均未变。 |

`[warn]` 非产品诊断插曲：首次固定输入哈希查询误在被审目录执行，因控制文件位于 source/control 而 exit 1，随后在正确目录重跑并全部吻合；内存探针前两种封装分别因转义 `SyntaxError` 和 heredoc 临时文件 `EPERM` 失败，最终改为纯单行、无写入调用后 exit 0。未使用这些失败调用支撑产品结论。

## Deferred P2 ledger delta

`[]`

本轮没有新增、更新、提升或关闭 P2；唯一 ledger 保持只读。

## 未运行

- `just ci`
- 页面渲染与 headless Chrome 检查
- 正式 Q0、986-source/48-authority 大审计
- E、PG-01B
- 真实 AI、connector、账号登录、付费或产品服务调用
- fetch、commit、stash、push、merge、deploy
- Grok transcript、repair prompt 或实施日志

本轮未修改产品、报告、ledger、控制文档或 Git。B1/B2 的后续预算和流转留给 supervisor 按冻结 policy 与 manifest validator 判定。

```review-manifest
{
  "verdict": "RED",
  "review_ordinal": 3,
  "candidate_head": "2b5517d322f062297d25806b02c4106e2ecc60e8",
  "diff_fingerprint": "32ff760d7da4d797230267342b70b4f88999fa1f6e76df1daf0d9ad14f224964",
  "review_scope": "step",
  "blockers": [
    {
      "id": "B1",
      "severity": "P1",
      "summary": "中英文 docs 仍把订阅登录态或现有登录直接写成推理供给与订阅额度，且英文仍无条件声称浏览器系统语音免费",
      "evidence": "deploy/saydo-octoooo-com/docs/index.html:158,837; deploy/saydo-octoooo-com/en/docs/index.html:159,860,862; docs/06-references.md:157,161; docs/11-ui-spec.md:575,576",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "C1-N-1"
    },
    {
      "id": "B2",
      "severity": "P1",
      "summary": "checker 与独立行为回归仍漏掉当前真实的订阅登录态、登录到额度及英文系统语音免费形式",
      "evidence": "scripts/check-active-claims.mjs:52; scripts/test-active-claims.mjs:96; node scripts/check-active-claims.mjs exit 0 while corrected in-memory probe reports scanner_hits=[] and current_needles_in_tests=false for all five current variants",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "C1-N-2/C1-N-3"
    }
  ],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "focused-2-receipt",
      "exit_code": 0,
      "summary": "SHA-256、1613-byte 大小及同一 HEAD/fingerprint 已核验；结构化回执记录 9/9、mutations=28、console=33 files/279 tests、candidate unchanged"
    },
    {
      "name": "console-typecheck-fresh",
      "exit_code": 0,
      "summary": "pnpm --filter @saydo/console typecheck；tsc --noEmit"
    },
    {
      "name": "active-claims-fresh",
      "exit_code": 0,
      "summary": "当前 checker 输出 [ok] active claims roots=31；本次语义 readback 证明其仍漏检 B1 当前真实形式"
    }
  ],
  "stop_reason": null
}
```
