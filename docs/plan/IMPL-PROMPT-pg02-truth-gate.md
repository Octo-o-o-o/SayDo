# IMPL-PROMPT · PG-02 最小真相控制面(2026-09-23 续接)

> 2026-10-03 索引注：本卡记录 2026-09-23/24 的历史执行与授权。下文“当前”、revision 17、文件尚不存在与预算剩余均只对当时有效，旧账原文保留。现役合同读 [09 §17/18](../09-data-contracts.md)，唯一排产入口读 [PLAN-2 顶部与 PG-02 批卡](IMPLEMENTATION-PLAN-2.md)。当前 PG-02 仍为 RED，本轮整合不重开旧预算；本轮审计记录见 [2026-10-03 整合审计](../../e2e/evidence/fortnight-audit-2026-10-03.md)。

这是当前 PG-02 的唯一执行卡。它替换 2026-09-06 那张卡里已经失效的行号、旧角色和旧链坐标。产品合同只在 `docs/06-references.md` §8、`docs/09-data-contracts.md` §17、`docs/11-ui-spec.md` §12.1。本卡不成为第二份形状源。

2026-09-24 产品实施 1/5: `contract-review-6` 对 HEAD `7a90e614a220e088d342d9d748c2a778bf936df5` + git-diff-v1 `680997c5596ec5e17d2c2ce77d167b8fdbd3dced163429e8204305330226dc22` 独立合同 GREEN。续接修复累计 6,独立 review 累计 6。旧产品 RED 不清零。本段以下直到预算表是复审前冻结原文,保留,不再充当「不得实现」的许可。schema、ledger、registry、checker 与 mutation 现已写入未提交候选。action checker 9 条可定位 RED。capability HEAD 绑定因 canonical 文档未提交而为 `product_source_mismatch`。support checker 通过,公开态保持 unsupported。产品实施未独立验收,不是产品 GREEN。未 commit。不启动 PG-03。没有 commit、merge、push、部署或真实付费探针授权。

当前阶段仍是合同候选,未 GREEN。schema、ledger、checker 不在本次。旧追加窗口的 3 次修复和 3 次复审都已发生,三份复审都是 RED,那些账不清零。新窗口合计最多 5 次实施或复审。第 1 次 `contract-review-4` 为 RED,唯一 P1 是 `CONTRACT-STATUS-PARAMETER-BINDING`。第 2 次只补了状态值占位符与实参位置。第 3 次 `contract-review-5` 为 RED,唯一 P1 是 `CONTRACT-UNKNOWN-WRITE-ZERO-FALLBACK`。本次是新窗口第 4 次,只补这种 transition 参数赋值在写入无法证明时保持阻断,仍只改合同,待最后一次独立复审。不得把本次写成合同 GREEN,也不得把预算用尽写成通过。收口后不自动开 PG-03。

## 1. 授权与预算

owner 2026-09-23 确认保留旧账,迁移到当前配置,追加最多 3 次修复和 3 次复审。旧 PG-02 的 RED、误绿和消耗不清零。该窗口的三次修复都只做了合同,三次复审都是 RED。那个窗口已经用完,不因新窗口重开。

owner 同日后续授权「按你的建议继续实施,追加 5 次以内都不需要和我确认」。新窗口合计最多 5 次实施或复审调用,不替换、不抵销旧的 3 次修复和 3 次复审。本次是新窗口第 4 次,仍只做合同。新窗口还剩 1 次,只留作最后一次独立复审。合同未 GREEN 前,这一次不得用来实现。本次不提前实现。

旧追加窗口,账完整保留:

| 次序 | 用途 | 状态 |
|---|---|---|
| 修复 1 | 合同迁移 | 已写入,未 GREEN |
| 评审 1 | 合同复审,任务目录 `contract-review-1.md` | RED。两条 P1:`CONTRACT-CALLSITE-VARIANT-CARDINALITY`、`CONTRACT-SHARED-EVIDENCE-UNREPRESENTABLE` |
| 评审 2 | 合同复审,任务目录 `contract-review-2.md` | RED。三条 P1:`PG02-CONTRACT-EVIDENCE-REGION`、`PG02-CONTRACT-SETUP-DENOMINATOR`、`PG02-CONTRACT-GIT-EVIDENCE-BINDING` |
| 修复 2 | 吸收上面五条,仍只改合同 | 已写入,未 GREEN |
| 评审 3 | 合同复审,任务目录 `contract-review-3.md` | RED。一条 P1:`CONTRACT-SHARED-BINDING-CONTRADICTION` |
| 修复 3 | 只补假臂有限域和参数关联,仍只改合同 | 已写入,未 GREEN。写入时旧窗口已经没有下一次复审 |

新窗口,合计最多 5 次:

| 次序 | 用途 | 状态 |
|---|---|---|
| 1 | 合同复审,任务目录 `contract-review-4.md` | RED。一条 P1:`CONTRACT-STATUS-PARAMETER-BINDING` |
| 2 | 只补 `SET status=?` 与实参位置,仍只改合同 | 已写入。随后由第 3 次复审吸收为 RED |
| 3 | 合同复审,任务目录 `contract-review-5.md` | RED。一条 P1:`CONTRACT-UNKNOWN-WRITE-ZERO-FALLBACK` |
| 4 | 只补写入无法证明时不得退回赋值行,仍只改合同 | 本次。待最后一次独立复审 |
| 5 | 未使用 | 只留作最后一次独立复审。合同未 GREEN 前不得用来实现 |

角色只对这次续接有效:实施 Grok `grok-4.7` / `xhigh`;只读评审 Codex `gpt-6-astra` / `medium`。`~/.octoworkflow/policy.json` 与 `roles.override.json` 不改。profile 只追加续接附录。2026-09-06 的 `grok-4.6` / `gpt-5.6-sol` 不是本次角色。

没有 commit、merge、push、部署、安装、全量测试或真实付费探针授权。不派 agent 或其它模型。

旧事实必须保留,不得写成 GREEN:

- `pg02-truth-gate-contract-recovery-2` 的 review-1 曾是 GREEN。那只说明当时的合同文本通过了那一次评审。
- `pg02-truth-gate-impl-recovery-2` 的 review-1 是 RED。两条 P1 是 `EVIDENCE-BINDING-VARIANT` 与 `ACTION-SCOPE-GLOBAL-FALLBACK`。
- 最新 implementation cycle 的 `current_blockers=[]` 不能当成产品 GREEN。

## 2. 现势坐标

- clone 基线 `7a90e614a220e088d342d9d748c2a778bf936df5`。
- PLAN-2 revision 17:`active=PG-02`,`next=PG-03`,`last_closed=CODEX-AS-SPIKE-01`。
- `evidence_ref` 仍是 `e2e/evidence/codex-as-spike-01.md`。`e2e/evidence/project-gap-pg-02.md` 还没有。
- 链上 PG-02 的后继是 PG-03。本卡不改 PG-03 的 A-ID、scope 或 gate。
- JOURNEY-01 与 White Edition 的已入库变化保留。本批不回退公开页面,也不做全仓换肤。

PLAN-2 批卡里的 A-ID、scope roots、focused gate 保持 program 导入原文。现势验收以本卡和 09 §17 为准。`close_set` 仍是 `[G-A3]`。`deferred exact-set` 仍是 `[DF-CLAIM-GENERATOR, DF-AI-DRAFT-FULL, DF-SP4-FORMATIVE, DF-SP5-READ, DF-SP7-CALIBRATE]`。

## 3. 本阶段 exact-set

修复 3 已经写入,没有重做下面这份修复 2 清单。它只改了 09 §17.3 与 §17.4 里和共享绑定矛盾有关的句子、06 §8 的一条指针,以及当时的预算句。journal 称报告为 clone 根的 `CONTRACT-REPAIR-3.md`。本工作区现在没有 `CONTRACT-REPAIR-2.md` 和 `CONTRACT-REPAIR-3.md`,本次不补写旧报告。profile 附录里的原始 3 次修复和 3 次复审分配保持不动。

修复 4 是新窗口第 2 次,仍只改合同。它只补 09 §17.4 的同一调用链和 `SET status=?` 实参位置,以及 §17.5 里对应的 fail-closed mutation。06 §8 只加一句指针,不另写判定。执行卡、HANDOFF、PLAN-2 只更新当时的预算句并保留旧窗口。profile 在原附录后追加新窗口,不改原始分配,也不改全局配置。报告是 clone 根的 `CONTRACT-REPAIR-4.md`。journal 记了那一轮。那次没有写 truthPlane、ledger、checker 或产品代码。

修复 5 是新窗口第 4 次,仍只改合同。它只补 09 §17.4 与 §17.5:这种 transition 参数赋值必须有已证实写入;调用链认不出、动态 SQL、实参错位或实参不含 S,包括叠成三项为零,都不得退回只登记赋值行。现役 `retryTask` 的常量链写入,以及没有这种赋值的共享三元审计和 result,保持可用。06 §8 已有指针,本次不另写判定。11 不改。执行卡、HANDOFF、PLAN-2 只更新当前预算句并保留旧窗口和修复 4 的账。profile 附录历史不改,全局配置不改。报告是 clone 根的 `CONTRACT-REPAIR-5.md`。journal 记下一轮。本次不写 truthPlane、ledger、checker 或产品代码。

`must_change`:

1. `docs/06-references.md` §7 导语与 §8
2. `docs/09-data-contracts.md` §17
3. `docs/11-ui-spec.md` §12.1 与 §13 索引
4. `docs/plan/IMPLEMENTATION-PLAN-2.md` 的指针与 PG-02 状态句
5. `HANDOFF.md` 的生成块与当前状态句
6. `.octoworkflow/project-profile.md` 的续接附录
7. 本执行卡
8. 修复 1 的报告是任务目录里的 `CURRENT-PG02-CONTRACT.md`,已不在 clone 内。journal 把修复 2、修复 3 的报告写成 `CONTRACT-REPAIR-2.md` 与 `CONTRACT-REPAIR-3.md`;这两个文件现在不在本工作区,本次不补写,也不改写成通过
9. 修复 4 的报告是 clone 根的 `CONTRACT-REPAIR-4.md`。修复 5 的报告是 clone 根的 `CONTRACT-REPAIR-5.md`
10. `history/PROCESS-JOURNAL.md` 的下一轮

上面 1–8 记录本续接已经写入过的范围。修复 4 不再改 §7 导语、11 §12.1 和 §13。修复 4 当时只改 §8 的一句指针、09 §17.4 与 §17.5、4–6 的当时状态句,以及当时的报告和 journal。修复 5 不改 06、11 和 profile。本次只改 09 §17.4 与 §17.5、PLAN-2 与 HANDOFF 的当前预算句、本执行卡,以及第 9、10 项里的修复 5 报告和 journal。

`must_not_change`:

- `packages/**`、`pipeline/**`、`apps/**`、`scripts/**`(不含本阶段不该出现的新 checker)
- `packages/contracts/src/types/truthPlane.ts` 以及任何 ledger、checker、vocab、self-test
- README、`deploy/**`、release 页面与 `docs/plan/2026-08-28-project-gap-owner-decisions.md`
- program 原文、PG-03 及之后批卡的 A-ID / scope / gate
- 旧 policy 记录、VOICE / CODEX-AS-SPIKE 附录原文

不得 `git add`、commit、merge、push。

## 4. 分母与漂移

09 §17.2 是分母谓词。2026-09-23 对基线的静态检索只证明下面这些差异,不是闭合清单。实现时必须重扫。检索日志在 `/tmp/saydo-pg02-resumption-20260923/contract-1/`。

- `lib/api.ts` 的 `api` 对象有 31 个成员,其中 18 个调用 `apiPost`,名字与 2026-09-06 的写成员名单相同。另有只读成员 `artifactDiff`、`getArtifactContent`、`exportArtifacts`。`api` 对象内没有 `apiDelete` 成员。
- 直接 `apiPost` / `apiDelete` 还出现在 `lib/chatAnchor.ts`、`lib/taskModalContext.ts`(`apiDelete`)、`lib/voiceAnchorFlow.ts`、`mobile/pages/CardPage.tsx`、`pages/Archive.tsx`、`pages/Arrangements.tsx`、`pages/Board.tsx`、`pages/FocusDetail.tsx`、`pages/Today.tsx`、`pages/redesign/FocusPageRoute.tsx`、`pages/redesign/RecordsPageRoute.tsx`、`components/TaskModal.tsx`。这些行号只属于这次检索,不能写进 ledger 当永久坐标。
- catalog 写成员的引用见过 `TaskDetail.tsx`、`ReviewPageRoute.tsx`、`Approvals.tsx`、`Memory.tsx`、`Notify.tsx`、`ProjectSettings.tsx`、`TaskModal.tsx`。`ReviewPageRoute.tsx` 含 `api.reviewTask` 的 approve、request_changes、reject 字面量。
- `Chat.tsx` 与 `mobile/pages/ChatPage.tsx` 调用 `postFirstRunQuery`。`SetupWizard.tsx` 调用 `postSetupRestart` 与 `postSetupTest`。`GlobalSettings.tsx` 调用 `postSetupTest`。`SetupGate.tsx` 调用 `postClearInvalidProjectOverrides`。修复 1 的检索没有把 setup 可达图走完。分母改以 09 §17.2 的端点、helper 与组合导出为准,这次仍然不是闭合清单。
- Brain:`liveTools.ts` 有 32 处 `reg.register`。这次检索在其它 daemon 源文件没有见到 `reg.register`。`listFocusToolSpecs` 含 `proposeFocusClose`,`liveTools.ts` 没有注册这个名字。
- WebSocket `.send(` 的生产命中仍是 `useVoiceChannel.ts` 与 `mobile/confirmDecision.ts`。`t` 集合相对旧清单至少要重扫;`voice.quiesced_transcript_ack` 与 `voice.anchor_prepare` 是这次在 send 附近见到的新增字面量,不是闭合集。
- `scripts/check-active-claims.mjs` 的 `REQUIRED_ROOTS` 这次读到 34 项。slice 仍是 README 与中英文首页三根。其余 31 项实现时进 `excluded_roots`。数字会随导出变化,checker 读导出,不读本句。

实现更新 ledger 时至少要覆盖:新的直接写文件、JOURNEY 的 `ReviewPageRoute` 三态、setup 的端点导出与组合导出、未注册的 `proposeFocusClose`、新的 WS `t`、以及 34 项 `REQUIRED_ROOTS` 的排除理由。本次没有生成那份 ledger。

追加修复 2 只改合同谓词,不把下面这些符号收成闭合分母。行号仍以当时源码为准,实现必须重扫:

- `Approvals.tsx` 的 `decide` 把 `accept` / `reject` 送进同一次 `api.decideApproval`。基数按 09 §17.3 的可证明判别值,不是恰好 1。`editApproval` 另计。
- `approvalFlow.decide` 的 `decision === "accept"` 假臂,只在参数联合 `"accept" | "reject"` 排除 accept 后唯一剩余 `reject` 时绑定 reject。`retryTask` 赋给 `to` 的那一行必须和后来同一条 `.prepare(...).run(...)` 上的状态参数写入组成符号段同为 `to` 的参数关联。`to` 必须是 `SET status=?` 的那个实参;只出现在 `updated_at=?` 或 `WHERE` 的 `status=?` 上不是状态变更。调用链认不出并且实参不含 `to` 时,不得因三项为零只登记赋值行。赋值锚点含 `queued` 或 `running`,写入锚点含 `to` 且不必再含 token。公共返回仍按 09 §17.4。单 transition 的 config 审计在路由成功续行,不要求 `variant.value` 分支。判定只以 09 为准,本条不是第二份形状。
- `setupApi.ts` 的 `setupFetch` 是传输 helper。端点导出包括 `postSetupConfig` 与 `postSetupSecret`。`saveDialogApiConfig`、`saveSlotSupplies`、`saveVoiceSecrets` 是组合导出。未知调用不得按裸名扫仓库。
- 产品源 Git 身份是 09 §17.6 的 `source_binding`。ledger 不记录自身提交 SHA。

这些句子不是 ledger,也不是已经点清的动作清单。

## 5. 两条必须转红的旧缺陷

合同反例是 09 §17.4 的 R-VARIANT 与 R-CALLEE。实现若仍用 HTTP method/path 作为整段证据范围,或在 callee 解析失败后按裸函数名扫描整个 daemon,即未完成。`shared_bound`、有限域假臂、参数关联、单 transition 区域和 setup 端点规则都不放松这两条:同路由的 approve 证据改指 `request_changes` 仍红;config 证据改指 secret,或按裸名回退,仍红。未知域或更大域不能由 `!= accept` 推出 reject。参数证据缺写入坐标、写入行被同名遮蔽或再赋值,仍红。S 的实参位置不是 `SET status=?`,`.prepare` 与 `.run` 不是同一调用链,或常量 SQL 的占位符证不到,仍红,并且不得退回只登记赋值行。模板字符串与实参不含 S 叠在一起,三项都是零,仍红。不把这套核对扩成通用 SQL 分析器、执行平台、claim 生成器、通用数据流或字符串存在性检查。

## 6. Linux 与公开页

旧实现曾把 Linux 公开文案降成 preview。该补丁对当前 README 与中英文首页 `git apply --check` 失败,见任务目录 `migration-check.txt`。当前 README 仍写 developer/preview,并把 macOS、Windows、Linux 放在同一句「六项 smoke」和「该包支持」里。version-matrix §1 写明 Linux 由 CI 六项 fixed-URL smoke 覆盖,不是真机;Mac/Windows 才有实体门真机证据。`release-profile.yaml` 的 `version_sot` 指向 matrix,文件头注释仍写 rc.12,不能拿这句注释升档。

本阶段不改这些页面。实现阶段的 support 记录不得把 Linux 真机写成可得;`not_run` 要记下非真机。若现势句子不能在不高于 matrix 的前提下通过,实现停在红并回报,不得覆盖当前公开页。

## 7. 门禁

修复 1 的文档门日志在 `/tmp/saydo-pg02-resumption-20260923/contract-1/`。修复 2 的文档门日志在 `/tmp/saydo-pg02-resumption-20260923/contract-2/`。修复 3 的文档门日志在 `/tmp/saydo-pg02-resumption-20260923/contract-3/`。修复 4 的文档门日志在 `/tmp/saydo-pg02-resumption-20260923/contract-4/`。修复 5 的文档门日志在 `/tmp/saydo-pg02-resumption-20260923/contract-5/`。本阶段要跑的命令:

- `node scripts/schedule-pointer.mjs --render`
- `node scripts/schedule-pointer.mjs --check`
- `node scripts/schedule-pointer.mjs --self-test`
- `bash scripts/check-emoji.sh`
- `node scripts/check-doc-links.mjs`
- `git diff --check`

下列命令本阶段不得当成通过,也不得为了让它们存在而提前实现:

- `FG-PG02-BOOTSTRAP` 里标 `[new]` 的六个 ledger / checker / self-test
- `pnpm --filter @saydo/contracts exec vitest run test/truth-plane.test.ts`
- `just ci`
- `pnpm exec playwright test`

实现阶段的 focused gate 仍是 program §20.2.2 的 `FG-PG02-BOOTSTRAP`,另加受影响的 typecheck 与文档门。完整门仍是 `just ci` 与 `pnpm exec playwright test`,并在实现提交上重跑 `FG-PG01A-CLAIM` 的只读子集(排除 Q0 `--write`)与 `FG-PG01B-RUNTIME`。那些命令不属于本次。

## 8. 阻断

- 新窗口第 4 次仍是合同修复,待最后一次独立复审:本次不得写 truthPlane、ledger 或 checker,也不得把本修复写成合同 GREEN。余下 1 次只用于这次复审,合同未 GREEN 前不得用来实现。
- R-VARIANT 或 R-CALLEE 的 mutation 不红:实现不得 GREEN。`shared_bound` 把兄弟分支放行,假臂在域不唯一时放行,参数关联只凭赋值行放行,S 没有对上 `SET status=?` 仍放行,或调用链认不出并且实参不含 S 仍退回赋值行,同样不得 GREEN。
- 出现执行平台、claim 生成器、通用 SQL 分析器,或只检查字符串是否存在:范围错误。
- 改了 PG-03、公开页、daemon/console 行为,或旧 policy 记录:范围错误。
- 把合同候选、旧 contract-recovery-2 的 GREEN,或未跑的门写成通过:记录错误。
