# PG-01A 夜间恢复 fresh readback 1 实施对账报告

> 归档：本报告是 cycle=owner-night-recovery-20260901 的第一次 fresh readback，覆盖此前报告对当前 dirty candidate 的适用性，但不改写旧 RED。原始报告 logs/pg01a-night-20260901.V1D8er/review-1.md 为 15649 bytes，SHA-256=8b16487bc4fdfe3b509bf60391513ed2e51a5a15effc1a8143a9a3fa536467e7；日志为 885258 bytes，SHA-256=f692b9f7644b16f5ba10b3600c62780fb07f7041d3606df654f40924f88a34ac。supervisor 按冻结 V2.3 与完整 cycle-state 验证为 valid/diagnose_and_repair_fresh；没有改写为 GREEN。归档只移除 Markdown 行尾空格，唯一 manifest 的 JSON 内容保持不变。


> task=`project-gap-closure`
> stage=`PG-01A/C1`
> cycle=`owner-night-recovery-20260901`
> task_mode=`review_only`
> review_scope=`step`
> review_ordinal=`2`
> reviewer=`fresh zero-context / read-only`
> verdict=`RED`

本轮全程只读，未修改产品、控制文档、历史报告或 P2 ledger，未提交、fetch、stash、合并或发布，也未派任何子会话。

## TL;DR

[fail] 当前 candidate 未满足 C1-N 语义验收：

- C1-N-1、C1-N-2 未满足。
- C1-N-3、C1-N-4、C1-N-5 满足。
- 上轮点名的中文/英文 FAQ、Markdown 设备内承诺、on-device speech、浏览器语音免费和 API key 立即变快等旧句式已经收紧。
- 但完整核对 31 个 required roots 后，仍发现 7 条现役实际文案违反同一声明上限；当前 checker 对这 7 条全部返回空命中，`active claims roots=31` 因而仍是语义假绿。
- 保留稳定 blocker `B1/P1`、`B2/P1`。两者均在 C1-N 既有范围内，不需要 owner 产品决策。
- 本轮无 P2 delta。

## 一、固定坐标、contract 与状态核验

### Candidate

[ok] 本会话实测：

- HEAD：`2b5517d322f062297d25806b02c4106e2ecc60e8`
- tree：`c5cae2f04ee907328b672e3099c865f1c3f83552`
- parent/P：`79211f6fec5c6eb092419c1871e35d8eedc4e3e5`
- `git-diff-v1`：`563fe14d69c19ca1b2c09dc7ac249214f25df94ad4e1b1e4bed14d4b68655fe3`
- HEAD 为 detached 状态；`git stash list` 为空。
- P..HEAD 只有一个提交：

> `2b5517d322f062297d25806b02c4106e2ecc60e8 79211f6fec5c6eb092419c1871e35d8eedc4e3e5 fix(pg-01a): 收紧公开承诺并校验语料真相`

最终重新计算 fingerprint 后，HEAD、fingerprint 和 8 个 dirty 路径均未变化。

### 固定输入

[ok] SHA-256 与派发一致：

- `docs/plan/IMPL-PROMPT-PG-01A.md`：`7bf0a7aa06040584a6349aaf1524224030c097c83c33c45cd5a556947e1dd6b0`
- `docs/plan/2026-08-28-project-gap-owner-decisions.md`：`983452a68e35a793b9394ced759e5b8ded43f83a00ae72b4925d30c45a75d9a6`
- `logs/pg01a-night-20260901.V1D8er/v2-policy.json`：`785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a`
- 唯一 P2 ledger：`4a9274b9308a98c55d5152d06daedc8b6760d0fd088cdbc25cabb5a87f4fdae8`
- `focused-1.log`：6409 bytes，`4a9ba81209148286be2f655b4dc28e030ada4fcff428b0da99dcddc07f07f3f6`

[ok] 使用冻结 policy 显式校验 handoff：

> `validate_handoff.py --policy .../v2-policy.json docs/plan/IMPL-PROMPT-PG-01A.md`
> exit 0；`status=valid`、`contract_errors=[]`、`risk_violations=[]`

[ok] cycle-state 坐标一致：

- `repair_rounds_used/reserved=1/1`
- `rereview_rounds_used/reserved=1/1`
- `review_ordinal=2`
- `followup_authorized=true`
- 初始 `current_blockers=B1/B2`
- 未把 ordinal 2 机械转成 `second_red`

最终 manifest 使用同一冻结 policy、cycle-state 和 expected task/stage/cycle/HEAD/fingerprint/ordinal 校验，exit 0：

> `{"status":"valid","rule_ids":[],"next_action":"diagnose_and_repair_fresh"}`

该结果只供 supervisor 流转；本 reviewer 未启动返工。

## 二、范围核验

[ok] 当前 dirty delta 恰为 8 个产品路径：

- `deploy/saydo-octoooo-com/docs/index.html`
- `deploy/saydo-octoooo-com/en/docs/index.html`
- `docs/release/2026-08-13-app-materials.md`
- `docs/release/metadata.json`
- `packages/console/src/pages/Chat.tsx`
- `scripts/check-active-claims.mjs`
- `scripts/test-active-claims.mjs`
- `templates/saydo.env.example`

程序化与 C1-N 合同对比：

> `must_count=5`
> `may_count=34`
> `dirty_count=8`
> `missing_must=[]`
> `outside_may=[]`

Diff 为 41 insertions、17 deletions。公开页面、release、metadata、Chat 和模板仅改文案或注释；scanner/test 的变更限定为声明检查和回归测试。未见布局、权限、数据流、运行时控制流或 AI provider 行为扩张。

[ok] 净新增 scanner/test 行检查：

> `added_lines=28`
> `bypass_hits=[]`

未新增 `fromCharCode`、`eslint-disable`、`@ts-ignore`、测试 `.skip/.only`。

[ok] 31 个 required roots 已按 exact set 全量枚举，共 14,231 行、911,681 bytes；checker 与测试中的两份 31-root 列表逐项相等，每个 root 均重新计算 SHA-256。

## 三、C1-N-1 至 C1-N-5 对账

| 验收项 | 状态 | 结论 |
|---|---|---|
| C1-N-1：31-root 公开声明对齐 | [fail] | 上轮点名句式已修，但其他现役 root 仍把登录或订阅直接推成可调用、把 API 写成“秒回”，并保留“不上传任何用户数据”的绝对声明。 |
| C1-N-2：实际逃逸独立回归 | [fail] | 新增的 11 条负例和合法正例本身有效，但 checker 对当前仍在 root 中的 7 条实际反例全部空命中，测试也未覆盖这些现役句式。 |
| C1-N-3：有限护栏、不做通用 NLP | [ok] | roots 未缩减；原五类、missing-root、假 LIVE 均保留；合法 conditional/preview、零 key 不等于免费、配置决定外发/费用、观察时延均允许；未把所有文字一律判红。 |
| C1-N-4：Q0/B3 bytes 保持 | [ok] | `git diff --quiet HEAD -- research/customer-question-corpus` exit 0；`docs/06-references.md`、`docs/11-ui-spec.md` 也与 HEAD 相同。未重开 Q0、986 source、48 authority input、renderer/oracle 或投影审计。 |
| C1-N-5：未提交 candidate 与边界 | [ok] | HEAD+dirty fingerprint 与派发一致，5 个 night must-change 全出现，无 34-path exact-set 外变化；没有伪造新 implementation SHA。 |

## 四、质量复审发现

### B1 · P1 · C1-N-1：31-root 仍有现役过度承诺

上轮原始证据对应的修复有效：

- `deploy/saydo-octoooo-com/docs/index.html:839` 不再称浏览器系统语音免费。
- `deploy/saydo-octoooo-com/docs/index.html:892` 与英文 `:915` 已明确 wired、自检、登录不等于免费。
- `docs/release/2026-08-13-app-materials.md:59`、`:70`、`:114`、`:119`、`:170` 已收紧数据、语音和登录态边界。
- `packages/console/src/pages/Chat.tsx:487` 已改为时延以服务商为准。
- `templates/saydo.env.example:5` 和 metadata 对应文案也已补充接线、自检与外发条件。

但下列当前实际文字仍违反 `docs/06-references.md:157`、`:161` 及 `docs/11-ui-spec.md:573-576`：

1. `packages/console/src/components/SetupGate.tsx:279`

   仍写“已登录的本机 CLI 可以零 key 慢速开聊”，直接从 logged-in 推到可调用。

2. `deploy/saydo-octoooo-com/index.html:370` 与英文 `en/index.html:370`

   仍写“已登录哪家用哪家”或 “It can use a CLI already signed in”，未附 wired+self-test 条件。

3. `deploy/saydo-octoooo-com/index.html:475` 与英文 `en/index.html:478`

   对“是否需要另一份订阅”直接回答“不用”，并称“已订阅哪家用哪家 / Whichever you subscribe to, it uses”。

4. `deploy/saydo-octoooo-com/docs/index.html:374` 与英文 `en/docs/index.html:392`

   仍把“已经登录”写成推理供给，并直接声称走订阅额度；登录态本身不能证明订阅权益、额度或可调用。

5. `docs/site/style-demos/11-hybrid.html:556`、`:627`

   重复现役首页的“已登录哪家用哪家 / 已订阅哪家用哪家”。

6. `packages/console/src/components/SetupWizard.tsx:759`

   用户可见文案仍为“API 秒回”，直接违反“禁止 API 秒级返回或固定秒数 SLA”。

7. `docs/release/2026-08-13-app-materials.md:63`

   仍称“本应用……不上传任何用户数据”，与同文件 `:59`、`:70`、`:78` 已承认的系统语音、AI 上游和第三方外发相冲突。若 intended meaning 仅为“开发者不收集”，当前主语和绝对措辞仍超出该边界。

这些均是当前 31-root 中的实际文字，不是构造尚未出现的任意同义句。

影响：用户仍可能把登录态误认成可用供给或已有权益，把 API 当成保证秒回，并误判第三方数据外发边界。

- `in_scope=true`
- `needs_owner_decision=false`
- `acceptance_item=C1-N-1`

### B2 · P1 · C1-N-2：checker 对当前现役反例继续假绿

[ok] 本次新增机制本身可工作：

- `scripts/check-active-claims.mjs:71-84` 新增六类 pattern。
- `scripts/check-active-claims.mjs:108-113` 加入 Markdown bold/underline 归一化。
- `scripts/test-active-claims.mjs:96-107` 保留原五类并加入本夜六类实际反例。
- 纯内存复核结果：原五类及本夜六类负例均命中预期 ID；四类合法文案均零命中。

但对 B1 中当前实际行执行相同 pattern/surface 逻辑，结果为：

> `[fail] setup-gate-login ... expected=logged-in-implies-ready hits=[]`
> `[fail] homepage-zh-login ... hits=[]`
> `[fail] homepage-en-login ... hits=[]`
> `[fail] docs-zh-login ... hits=[]`
> `[fail] docs-en-login ... hits=[]`
> `[fail] setup-api-seconds ... expected=fixed-seconds hits=[]`
> `[fail] release-no-upload ... expected=data-never-leaves hits=[]`
> `[fail] current active-root semantic counterexamples missed=7/7`

与此同时，当前实际 checker 输出：

> `[ok] active claims roots=31`
> exit 0

因此 checker 的绿色结果不能证明 active roots 已符合 canonical。修复无需扩成通用 NLP，只需覆盖这些已经存在的实际行为反例，并把它们逐条加入独立回归。

- `in_scope=true`
- `needs_owner_decision=false`
- `acceptance_item=C1-N-2`

### B3/Q0

[ok] 不重开。

整个 `research/customer-question-corpus` 相对 HEAD 无字节变化，沿用上一独立 readback 对 B3 的关闭结论。本轮未把旧 Q0 结果冒充重新运行。

## 五、门禁结果

### 本会话实际运行

| 门禁 | Exit | 原始输出摘录 |
|---|---:|---|
| 冻结 V2.3 handoff | 0 | `status=valid` |
| `pnpm --filter @saydo/console typecheck` | 0 | `@saydo/console`；`tsc --noEmit` |
| active claims | 0 | `[ok] active claims roots=31`，但被当前实际反例证明为假绿 |
| active mutation 尝试 | 1 | `EPERM: operation not permitted, mkdtemp .../pg01a-claims-XXXXXX`；未放宽 sandbox、未重试 |
| 合同负例/合法正例纯内存检查 | 0 | 11 条负例均命中；4 条合法文案均不命中 |
| 当前现役反例纯内存检查 | 1 | `missed=7/7` |
| public-text-redaction | 0 | `pass=28 fail=0` |
| emoji | 0 | `[ok] emoji gate: clean` |
| doc links | 0 | `files=117 broken=0` |
| `git diff --check HEAD` | 0 | 无输出 |
| metadata JSON | 0 | `jq empty` 无输出 |
| B3/Q0 bytes | 0 | `git diff --quiet HEAD -- research/customer-question-corpus` |
| canonical bytes | 0 | `git diff --quiet HEAD -- docs/06-references.md docs/11-ui-spec.md` |

### 同 candidate 固定原始日志

[ok] `focused-1.log` 已验证 SHA-256、字节数及内部 JSON 事件：

- start 与 summary 均绑定本轮 HEAD/fingerprint。
- 9 个 `gate-start` 与 9 个 `gate-end` 一一存在。
- summary：`total=9`、`passed=9`、`failed=0`、`candidate_unchanged=true`。
- mutation：`active-claim mutations 18 passed`。
- console Vitest：`33 passed`、`279 passed`。
- ESLint、typecheck、redaction、emoji、doc-links、diff-check 均记录 exit 0。

这些是同一 candidate 的既有原始测试输出，不冒充本会话重新运行。当前 mutation 重跑因只读 sandbox 的 `mkdtemp` 被拒一事已如实保留。

## 六、Deferred P2 ledger delta

本轮没有独立 P2 发现，唯一 ledger 保持只读。

`p2_ledger_delta=[]`

## 七、按合同未运行

- `just ci`
- 中英文页面 headless Chrome 渲染检查
- 正式 Q0 `--write` / report `--check`
- 986 source 与 48 authority input 大审计
- E evidence、week-audit writer、PG-01B
- 真实账号、CLI 登录、AI/connector、跨平台、设备、签名或商店测试
- push、merge、deploy、commit/amend

按 C1-N 顺序，完整门禁与页面检查应在语义 GREEN 后由 supervisor 对同一锁定 candidate 执行；它们尚未运行不是本轮新增漏交。

## 八、修复清单与返工去向

1. `[P1/B1]` 收紧上述当前实际 root 文案：登录或订阅必须同时写明 wired+self-test 条件；API 时延改为服务商边界；隐私文字区分“开发者不收集”和按配置发生的第三方外发。
2. `[P1/B2]` 把上述 7 条现役实际形式分别加入独立行为回归，并让有限 checker 拒绝它们；保留现有 31-root exact-set、missing-root、假 LIVE、原五类负例和合法正例。
3. `[ok/B3]` 不返工、不重开 Q0。

返工权交还 supervisor。两项 blocker 均在既有 C1-N 34-path 范围内且不需要 owner 决策；本 reviewer 不施工、不启动实施 CLI，也不因 ordinal 2 自行设置停止原因。

## Review Manifest

```review-manifest
{
  "verdict": "RED",
  "review_ordinal": 2,
  "candidate_head": "2b5517d322f062297d25806b02c4106e2ecc60e8",
  "diff_fingerprint": "563fe14d69c19ca1b2c09dc7ac249214f25df94ad4e1b1e4bed14d4b68655fe3",
  "review_scope": "step",
  "blockers": [
    {
      "id": "B1",
      "severity": "P1",
      "summary": "31 个 required active roots 仍有现役文案把 logged_in 或订阅直接推成可用、把 API 写成秒回，并保留不上传任何用户数据的绝对声明",
      "evidence": "packages/console/src/components/SetupGate.tsx:279; deploy/saydo-octoooo-com/index.html:370; deploy/saydo-octoooo-com/en/index.html:370; packages/console/src/components/SetupWizard.tsx:759; docs/release/2026-08-13-app-materials.md:63",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "C1-N-1"
    },
    {
      "id": "B2",
      "severity": "P1",
      "summary": "active-claim checker 和 mutation 覆盖了本轮点名旧变体，但对七条现役行为反例仍全部空命中，live checker 因而假绿",
      "evidence": "scripts/check-active-claims.mjs:52; scripts/test-active-claims.mjs:96; packages/console/src/components/SetupGate.tsx:279; packages/console/src/components/SetupWizard.tsx:759; docs/release/2026-08-13-app-materials.md:63",
      "in_scope": true,
      "needs_owner_decision": false,
      "acceptance_item": "C1-N-2"
    }
  ],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "frozen-v2.3-handoff",
      "exit_code": 0,
      "summary": "冻结 policy 2.3 校验 valid"
    },
    {
      "name": "same-candidate-focused-log-9",
      "exit_code": 0,
      "summary": "原始日志绑定同一 HEAD/fingerprint，9/9 exit 0 且 candidate_unchanged=true"
    },
    {
      "name": "current-console-typecheck",
      "exit_code": 0,
      "summary": "@saydo/console tsc --noEmit 通过"
    },
    {
      "name": "current-active-claims",
      "exit_code": 0,
      "summary": "roots=31；语义反例证明该结果为假绿"
    },
    {
      "name": "current-active-claim-mutations-attempt",
      "exit_code": 1,
      "summary": "只读 sandbox 在 mkdtemp 处 EPERM；未重试，使用已校验同候选原始日志归属 18 passed"
    },
    {
      "name": "in-memory-contracted-cases",
      "exit_code": 0,
      "summary": "原五类、本夜六类负例均命中；四类合法文案均不命中"
    },
    {
      "name": "in-memory-current-live-counterexamples",
      "exit_code": 1,
      "summary": "七条现役违规文案预期分类全部 hits=[]"
    },
    {
      "name": "current-public-text-redaction",
      "exit_code": 0,
      "summary": "pass=28 fail=0"
    },
    {
      "name": "current-emoji",
      "exit_code": 0,
      "summary": "emoji gate clean"
    },
    {
      "name": "current-doc-links",
      "exit_code": 0,
      "summary": "files=117 broken=0"
    },
    {
      "name": "current-diff-check",
      "exit_code": 0,
      "summary": "无输出"
    }
  ],
  "stop_reason": null
}
```
