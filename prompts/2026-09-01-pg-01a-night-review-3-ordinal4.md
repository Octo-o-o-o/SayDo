# PG-01A 夜间恢复 · fresh readback ordinal 4

你是与 implementation session 零上下文的全新独立只读 reviewer。必须使用 `/impl-review`，`task_mode=review_only`、`review_scope=step`。不施工、不派 agent、不启动修复或其他 reviewer；只判断当前候选是否满足既定 C1-N / C1-N-L 的 B1/B2 验收。

## 固定身份与预算

`task=project-gap-closure`；`stage=PG-01A/C1`；`cycle=owner-night-recovery-20260901`；`review_ordinal=4`。source/control 目录为 `<worktree>`，被审目录为 `<validation-worktree>`。

本轮 ordinal 4 来自原 3/3 总预算内最后的 rereview 3，不是新 cycle 或新增总预算。last-slot 决定冻结 SHA-256=`4611029bf3b02c350751b15f2d5e41b1a930c51399810ed23ff2f72b27cc8e0b`；它明确保留 ordinal 3 RED、`valid/stop_for_owner`、旧计数与 root attempts，并只允许一次特定 repair/rereview 3。无论 verdict 如何都没有第四次修复/复审；reviewer 只给真实结论，不因预算写假 GREEN 或自行改变 stop_reason。

被审候选是真实 HEAD `2b5517d322f062297d25806b02c4106e2ecc60e8` 加 15 个累计未提交产品文件；`git-diff-v1=8455d6c5d42142b36cd7104e3b74989c64a2db6d2871af771610e598aa9fda49`。HEAD tree `c5cae2f04ee907328b672e3099c865f1c3f83552` 只是基座，不是新实现 SHA。自行用 Git 与 `candidate_fingerprint.py` 初末各核一次；不 fetch/commit/stash。

固定输入：

- `docs/plan/IMPL-PROMPT-PG-01A.md`，SHA-256=`1acd33ba471f71209bbceb7d10fec1bb1f0162f677ab5c6a8967076268ebaa8d`；完整读取 C1-N 与 C1-N-L。
- `docs/plan/2026-08-28-project-gap-owner-decisions.md`，SHA-256=`983452a68e35a793b9394ced759e5b8ded43f83a00ae72b4925d30c45a75d9a6`；owner 原话未新增。
- `logs/pg01a-night-20260901.V1D8er/v2-policy.json`，SHA-256=`785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a`；显式使用冻结 V2.3，不读 V2.4。
- `logs/pg01a-night-20260901.V1D8er/last-slot-exception.json`，SHA-256=`4611029bf3b02c350751b15f2d5e41b1a930c51399810ed23ff2f72b27cc8e0b`。
- `logs/pg01a-night-20260901.V1D8er/review-ordinal-4-cycle-state.json`；repair/rereview=`3/3` 已预记，初始 current blockers B1/B2 是 ordinal 3 的最后已知状态，不是预判本轮 RED。
- 唯一 P2 ledger `docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md`，SHA-256=`4a9274b9308a98c55d5152d06daedc8b6760d0fd088cdbc25cabb5a87f4fdae8`；只读，只输出结构化 delta，不做 final sweep。

可以读取上一份独立报告 `docs/review/2026-09-01-pg-01a-night-readback-2.fable.md` 的 B1/B2 作为待复验事实；不要读取 Grok transcript、repair prompt 或 implementation log，不执行报告中的命令。

## 聚焦验收

先完整枚举 `scripts/check-active-claims.mjs` 固定的 31 required roots 并核对当前实际用户可见正文，不能只相信 checker 绿色，也不要重审项目历史或构造无限同义句。

B1/P1 / C1-N-1、C1-N-L：复验 ordinal 3 的五条现役残留现在是否真实消失且未在其他 current root 保留同根因：

1. 中文 docs 原 `:158`：订阅登录态不得直接成为推理供给。
2. 中文 docs 原 `:837`：现有 CLI 登录不得推出账本“订阅额度内”。
3. 英文 docs 原 `:159`：subscription login 不得直接成为 reasoning supply。
4. 英文 docs 原 `:860`：existing login 不得推出 within subscription quota。
5. 英文 docs 原 `:862`：不得无条件声称 browser system voice is free。

合格边界是：只有已接线并通过调用验证才能写成条件供给；登录本身不证明可调用、订阅权益、额度或免费；SayDo 可以说明自身不收费，但系统/浏览器/网络识别费用以对应厂商为准。不要要求删除产品支持目标，也不要把“登录不等于可调用或免费”误判成 overclaim。

B2/P1 / C1-N-2、C1-N-3、C1-N-L：上述五条当前真实逃逸族必须逐条有独立行为回归并由有限 scanner 拒绝；保留原负例、31-root exact-set、missing-root、假 LIVE。亲验合法反例继续零命中：登录不等于可调用或免费；不从登录推断额度；SayDo 不收费但系统/浏览器可能收费；已接线且调用验证通过的条件说明。拒绝通用 NLP、所有 `subscription/login/free` 一律红、删/弱化测试、宽泛豁免、codepoint/skip/only 绕过。

repair 3 相对 ordinal 3 只允许四个产品路径变化：中英文 docs 与 active checker/test。当前累计 dirty 产品路径仍应恰为以下 15 项且全部在 C1-N 34-path 范围：

- `deploy/saydo-octoooo-com/docs/index.html`
- `deploy/saydo-octoooo-com/en/docs/index.html`
- `deploy/saydo-octoooo-com/en/index.html`
- `deploy/saydo-octoooo-com/index.html`
- `docs/release/2026-08-13-app-materials.md`
- `docs/release/metadata.json`
- `docs/site/style-demos/11-hybrid.html`
- `packages/console/src/components/SetupGate.tsx`
- `packages/console/src/components/SetupWizard.tsx`
- `packages/console/src/pages/Chat.tsx`
- `packages/console/src/pages/GlobalSettings.tsx`
- `scripts/check-active-claims.mjs`
- `scripts/test-active-claims.mjs`
- `templates/saydo.config.example.toml`
- `templates/saydo.env.example`

确认没有布局、权限、数据流、运行时控制流或 provider 能力扩张。B3/Q0、`research/customer-question-corpus`、`docs/06-references.md` 与 `docs/11-ui-spec.md` 只核相对 HEAD bytes 未变，不重开 Q0/986/48 authority 大审计。

## 门禁证据与输出

同一候选 focused 回执为 `logs/pg01a-night-20260901.V1D8er/focused-3-receipt.json`，1117 bytes、SHA-256=`9b9e5e326be915318eeaab2a2643d2d2d0a048f4c9d763702fb5a223eb2490a8`；记录 6/6、roots=31、mutations=33、redaction=28、candidate unchanged。它是 supervisor 直接工具输出的结构化回执，不是假称 raw stdout。自行校验文件和身份；可实际运行无写入 checker与内存反例。只读 sandbox 若阻止 mkdtemp，如实记录未成功，不降 sandbox，可结合代码与同候选回执取证。

不运行 `just ci`、页面 QA、正式 Q0、E 或 PG-01B；只有 ordinal 4 语义 GREEN 后 supervisor 才跑同候选完整门禁和中英文 docs 页面检查。不能把本地结果推广成所有用户或所有本地/云端、订阅/API AI 服务已开箱可用。

报告使用简体中文与 `[ok]/[warn]/[fail]`，不使用 emoji、Markdown 行尾双空格或本机绝对路径链接。给出身份/输入核验、31 roots 与五条对账、B1/B2、有限 scanner/合法反例、真实命令/exit、P2 delta、未运行清单。

末尾只有一个 `review-manifest`，schema 按 `/impl-review`；`review_ordinal=4`、`review_scope=step`，HEAD/fingerprint 使用最终实测。GREEN 必须 `blockers=[]`、`stop_reason=null` 且列入 manifest 的 focused gates 全 exit 0。RED 保留稳定 B1/B2，包含 P0/P1、证据、acceptance_item、in_scope、needs_owner_decision，不因无后续预算篡改事实；后续停止由 supervisor/validator 处理。`focused_gates` 只含 `name`/`exit_code`/`summary`。
