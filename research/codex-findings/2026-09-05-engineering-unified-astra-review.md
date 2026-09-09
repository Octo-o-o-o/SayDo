# 统一工程方案与 ECC 交接独立复审 R2

结论：`GREEN`。本轮只按 `scope`、`contracts`、`handoff` 三个维度验收 U1–U4；P0/P1 blocker 为 0，P2 delta 为 0。

## scope

[ok] U1 通过。统一方案明确给出 `PG-01B → AS-01/AS-02 → PG-02` 的产品串行顺序，并以远程 business API/WS 止损与 ledger/foundation 私有持久化的故障面、验收面不同解释分批理由；原 PG-03–PG-06 与 owner-stop 保留（`docs/plan/2026-09-05-engineering-unified.astra.md:9`、`:11`、`:13`）。

[ok] 当前现势与未来建议没有混写。PLAN-2 实际仍为 `active=none,next=PG-01B,last_closed=PROC-01`，唯一链未改；统一稿要求未来收到“按统一 Prompt 实施”的新具名授权后才采纳近期组合，并在 PG-01B 的合并及 evidence 前置成立后登记 AS。它同时明确旧 D17 不是 blanket 授权、不要求 owner 手改指针、已闭合范围按 evidence/祖先关系跳过，且 commit/merge/push/install/deploy 与后续候选不被默认授权（方案 `:21`–`:23`；Prompt `:9`–`:18`）。源码中的 D17 原文只覆盖 PG-00，和该约束一致。

## contracts

[ok] U2 通过。AS-01/AS-02 保留窄凭据 grammar、`classifyTrust`/`requestedTrust` 之前拒写、ledger/remember/foundation 的完整声明 write set，以及首次 raw staging 前整次拒绝新 generation、旧 generation/status/pointer 不变的唯一合同（方案 `:51`–`:88`）。Git 保护按声明私有 write set 验证实际语义，create-only、等价 ignore、tracked 文件、worktree `.git`、非 Git、根外 symlink 与写失败均有正反例；人工共享不被覆盖，延期 schema/UI/DDL 不被偷带入（方案 `:90`–`:126`）。

[ok] 三类失败、脱敏定位、现有 refresh/retry、有限去重、无自动删除和写入边界成本限制均保留（方案 `:128`–`:167`）。Prompt 将整批分为统一 contract 与统一 implementation 两个预先接受阶段，不按 AS ID 拆四轮；`#/p/:id/settings` 经 `packages/console/src/lib/router.ts:69` 到 `packages/console/src/App.tsx:68`，实际进入带奠基/重奠基及错误展示的 `ProjectSettings`。错误语义归 canonical；若改共享 schema 或 UI，合同要求相应 contracts/console 定向门，并在语义 GREEN 后运行 `just ci` 与 Playwright，文档门不能替代产品门（Prompt `:88`–`:116`）。

[ok] U3 通过。活动方案和 Prompt 均保留每批四行回报/成本/用户负担/维护停止条件；VOBS 的有界 pending、失败分母及日志频率/容量/期限，VIEW 的事件优先、有界兜底、新鲜度与请求预算且不固定 5 秒，VOICE 的据证据择一、完整输出/取消/计费边界，HOST 的被动诊断及无收据时 ownership 未验证，以及 READ/CONTEXT/其余 AS 的具名触发和近期范围限制均可从正式入口到达（方案 `:32`、`:169`–`:246`；Prompt `:32`–`:39`、`:118`–`:135`）。

## handoff

[ok] U4 通过。`docs/plan/README.md` 只列统一方案和统一 Prompt 为当前工程缺口/ECC 入口；9 个旧路径都是短跳转页，不含 workflow block，归档索引明确旧 SoT、授权、顺序和 GREEN 仅为历史。来源清单的 9 组 bytes/SHA-256 与归档正文相符；其中两份 ECC final/prompt 和两份工程缺口 final/prompt 的哈希也与各自既有 delivery evidence 一致。PLAN-2、owner decision、docs/09 与只读历史报告的冻结摘要未变。

[ok] 上轮 `U4-review-artifact-path-conflict` 已关闭。Prompt `:157` 规定 reviewer 原始报告只写本阶段已忽略的 `$CONTROL_DIR`，`:159` 规定仅在有效 GREEN、完整门禁及 finalize 后由 supervisor 归档到 `research/codex-findings/`；冻结期间不存在两个并行写入目标。统一 Prompt 含唯一有效 workflow-v2 block，能独立完成 Grok 实施、fresh Codex review、candidate identity 迁移、receipt 绑定、预算与两个预先接受 AS 阶段的交接，不依赖归档命令，也没有预填语义 GREEN/P1。

## 验证边界

- 起始身份：HEAD `bcf8ea855f25b177888d9159f75e49214f3dd892`；`git-diff-v1` fingerprint `dcf9d16d9892df7cb983ad7305d1992e0ad8e32afaefce28793df8d9caa23ba0`，与派发身份一致。
- `bash docs/plan/engineering-unified-control/docs-gate.sh`：exit 0；handoff valid、emoji clean、活动链接 `files=150 broken=0`、9 份归档与跳转/冻结输入/唯一 workflow contract 检查通过。
- 按 brief 未运行产品 CLI、Grok、provider、`just ci`、Playwright 或历史归档 helper；本结论不宣称产品实现或产品门禁通过。

```review-manifest
{"verdict":"GREEN","review_ordinal":2,"candidate_head":"bcf8ea855f25b177888d9159f75e49214f3dd892","diff_fingerprint":"dcf9d16d9892df7cb983ad7305d1992e0ad8e32afaefce28793df8d9caa23ba0","review_scope":"workflow-final","blockers":[],"p2_ledger_delta":[],"focused_gates":[{"name":"unified-docs","exit_code":0,"summary":"handoff valid; emoji, active links, archive hashes and redirects, frozen inputs, unique workflow contract, and diff checks passed"}],"stop_reason":null}
```


## Supervisor 机械收口记录（独立报告之后追加）

本节只记录实际消费和文档门禁，不替代上方 reviewer 判断。R1 曾检出 1 个 P1：冻结期间报告落点冲突；原始 RED 保存在 [R1 原始报告](../engineering-unified/review-r1.md)。同一 task/stage/cycle 消耗 1 次修复、1 次全新零上下文复审，R2 GREEN，0 blocker/0 P2；预算未重置。

- 实际候选 HEAD：`bcf8ea855f25b177888d9159f75e49214f3dd892`；fingerprint：`dcf9d16d9892df7cb983ad7305d1992e0ad8e32afaefce28793df8d9caa23ba0`。
- 登记真实 review completion 后，`validate_review_manifest.py` 返回 `valid/full_gate`；随后 `cycle_control.py --record-gate` 的 `unified-docs` exit 0，`--finalize` 返回 `finalized`。
- 文档门包含 handoff 校验、emoji、活动文档链接、九份原文归档及跳转完整性、冻结输入和 `git diff --check`。原始输出及日志摘要见 [交付证据](../engineering-unified/delivery-evidence.json)。
- 日志 `unified-docs.log`：563 bytes，SHA-256 `8ef5aeba972dfc876a42844da7fc7341b78ca79e27f58f8941ebb1a755dc84a6`；原文仅存 ignored `.local/`。
- 最终 P2 sweep 仅一次，无待处理项；26 份实际交接文件仍与被审字节一致。长期评审归档在 finalize 之后执行，未用于改变已审候选或给新产品候选放行。
- 本次仅合并方案/Prompt 与归档索引。产品实施、产品全量 `just ci`/Playwright、provider/runtime、commit/push/merge/install/deploy 均未运行。PLAN-2 与 canonical 未变；主工作区接收另记逐文件对账。
