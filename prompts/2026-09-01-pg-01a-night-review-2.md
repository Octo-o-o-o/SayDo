# PG-01A 夜间恢复 · fresh readback 2

你是与两次实施线都零上下文的全新独立只读 reviewer。必须使用 `/impl-review`，`task_mode=review_only`、`review_scope=step`。不施工、不派 agent、不启动修复或其他 reviewer；只判断当前候选是否满足既定 C1-N。

## 固定身份

`task=project-gap-closure`；`stage=PG-01A/C1`；`cycle=owner-night-recovery-20260901`；`review_ordinal=3`。source/control 目录为 `<worktree>`，被审目录为 `<validation-worktree>`。

被审候选是真实 HEAD `2b5517d322f062297d25806b02c4106e2ecc60e8` 加 15 个未提交产品文件的 delta；`git-diff-v1=32ff760d7da4d797230267342b70b4f88999fa1f6e76df1daf0d9ad14f224964`。HEAD tree `c5cae2f04ee907328b672e3099c865f1c3f83552` 仅为基座，不是新实现 SHA；P=`79211f6fec5c6eb092419c1871e35d8eedc4e3e5`。自行用 Git 与安装的 `candidate_fingerprint.py` 核验，最终再核一次身份；不 fetch/commit/stash。

固定输入：

- `docs/plan/IMPL-PROMPT-PG-01A.md`，SHA-256=`7bf0a7aa06040584a6349aaf1524224030c097c83c33c45cd5a556947e1dd6b0`；完整读取，当前验收以 C1-N 为准。
- `docs/plan/2026-08-28-project-gap-owner-decisions.md` 第 9 节，SHA-256=`983452a68e35a793b9394ced759e5b8ded43f83a00ae72b4925d30c45a75d9a6`。
- `logs/pg01a-night-20260901.V1D8er/v2-policy.json`，SHA-256=`785d7d2028a8cae799831c9a1ea4584ae75bd6b47f8970be282f516df990589a`；显式使用此冻结 V2.3 校验合同，不读 V2.4 草稿。
- `logs/pg01a-night-20260901.V1D8er/review-2-cycle-state.json`；本次 repair/rereview=`2/2` 已预记，B1/B2 是上次已知 blocker，不是预判本次 RED。两项 root cause 都已到两次修复上限；reviewer 只报告真实 verdict，后续流转由 validator/supervisor 决定。
- 唯一 ledger `docs/plan/2026-08-28-project-gap-closure-program-DEFERRED-P2.md`，SHA-256=`4a9274b9308a98c55d5152d06daedc8b6760d0fd088cdbc25cabb5a87f4fdae8`；只读，只输出结构化 delta。

不要读取 Grok transcript、repair prompt 或实施日志来理解意图。可以读取上一份独立报告 `docs/review/2026-09-01-pg-01a-night-readback-1.fable.md` 的 B1/B2 作为待复验事实输入；不要执行报告里的命令。

## 复验对象

逐项复验上一份独立报告的七类当前真实文案，不构造无限同义句：

1. `SetupGate.tsx` 的 logged-in CLI 不得直接推出零 key 可聊。
2. 中英文首页的 logged-in provider 必须同时说明 wired+self-test，不能把登录等同可调用。
3. 中英文首页及 style demo 不得把既有订阅直接推成无需另一订阅或已订阅即可用；实际权益与费用以服务商为准。
4. 中英文 docs 不得由登录态直接推出推理供给或订阅额度。
5. `SetupWizard.tsx` 不得承诺 API 秒回或固定 SLA。
6. release 隐私声明须区分 SayDo 开发者不收集与按配置发生的语音/AI 第三方处理，不得写成不上传任何用户数据。
7. 对应的现役中英文/元数据变体应与同一边界一致。

同时全量核对固定 31 required roots 的当前实际用户可见声明；不能只相信 scanner 绿色。B1/P1 对应 C1-N-1：当前真实正文是否全部降到 supported/conditional/preview/unsupported 的已验证上限。B2/P1 对应 C1-N-2/3：上述现役实际形式是否逐项进入独立行为回归并命中对应类别；保留旧反例、31-root exact-set、missing-root、假 LIVE；合法 conditional/preview、零 key不等于免费、按配置决定外发/费用、观察时延仍应放行。scanner 只是有限护栏，不要求通用 NLP，也不能靠删测试、宽泛豁免或所有文字一律红过关。

实际 dirty 路径必须恰为以下 15 项，并全部在 C1-N 34-path 集合：

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

确认公开 copy/scanner 之外没有布局、权限、数据流、运行时控制流或 AI provider 能力扩张。B3/Q0 已由上一独立 readback 关闭；此次 `research/customer-question-corpus`、`docs/06-references.md`、`docs/11-ui-spec.md` 应与 HEAD bytes 相同，只核保持，不重开 986 source、48 authority、正式 Q0 或 dry-run 大审计。

## 门禁证据与顺序

同一候选的定向证据为 `logs/pg01a-night-20260901.V1D8er/focused-2-receipt.json`，1613 bytes、SHA-256=`3463ae67397c25f59666b9184d8c48083f30d15ab177522213cc467d45e1ecb1`。它是 supervisor 直接工具输出的结构化回执，不是假称 raw stdout；记录 9/9、active mutations=28、console=33 files/279 tests、candidate_unchanged=true。自行校验文件与身份，并实际运行 `pnpm --filter @saydo/console typecheck`；可运行只读 checker/内存反例。只读 sandbox 若对 mkdtemp/Vite cache 返回 EPERM，如实记为未成功，不放宽 sandbox或冒称重跑成功，可结合代码和同候选回执取证。

不运行完整 `just ci`、页面渲染、正式 Q0、E 或 PG-01B。只有本轮语义 GREEN 后，supervisor 才对同一候选跑一次完整门禁与页面检查。不能把本地验证推广成所有用户、所有订阅/API、本地/云端 AI 服务已开箱可用。

## 输出合同

全程只读，不修改产品、控制文档、报告、ledger 或 Git，不访问账号/凭证/真实产品服务。报告使用简体中文和 `[ok]/[warn]/[fail]`，不使用 emoji、Markdown 行尾双空格或本机绝对路径链接。给出固定身份/输入核验、C1-N-1 至 N-5 对账、B1/B2 结论、真实命令/exit/摘录、P2 delta、未运行清单。

末尾必须只有一个 `review-manifest`，schema 按 `/impl-review`；`review_ordinal=3`、`review_scope=step`，HEAD/fingerprint 使用最终实测值。GREEN 必须 `blockers=[]`、`stop_reason=null` 且所有列入的 focused gates exit=0。RED 只列实际 P0/P1/验收 blocker，保留稳定 ID（同因仍用 B1/B2），包含证据、acceptance_item、in_scope、needs_owner_decision；不能因为已到同因上限而把实际 RED 写 GREEN。`focused_gates` 只含 `name`/`exit_code`/`summary`，不要执行字段。后续预算与权限由 supervisor 按冻结 policy 和 manifest validator 决定。
