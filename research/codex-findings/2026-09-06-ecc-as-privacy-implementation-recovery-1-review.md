结论：[ok] GREEN。M1–M8 均符合冻结合同，P1-M6-02 已闭合。

- M1 [ok] `ledger.ts:90` 在 classify/insert 前扫描落盘字符串；remember、hotword、nominate、reanchor、approve、onFact 均按条隔离。
- M2 [ok] `foundation.ts:366` 先组装并扫描五件文档，`foundation.ts:399` 后才创建 staging；core 使用固定本地标签，拒写测试验证旧 generation 与 pointer 不变。
- M3 [ok] `gitProtection.ts:344` 实现 create-only ignore、实际 Git 验证及 tracked `insufficient`，不覆盖、不 untrack。
- M4 [ok] `not_git/protected/insufficient/outside_root/query_failed/write_failed` 分流明确；非 Git 可本地写，根外 symlink 与 timeout 均 fail-closed。
- M5 [ok] `foundationOps.ts:117`、`apiError.ts:145`、`ProjectSettings.tsx:45` 闭合三类失败与同按钮重试；失败不显示新 generation。
- M6 [ok] P1-M6-02 已修复：`foundation.ts:580` 令 rules 标题与正文同属 `foundationRulesRelativeSource`；`memory-foundation.test.ts:472` 验证凭据文件名映射到可逆编码来源、无行号、无原文、无 staging 且旧 pointer 不变。
- M7 [ok] `foundation.ts:788` 使用 opendir、先 stat、再有限读；Git timeout/maxBuffer、保护查询 5 次和总数 16 均受 contracts 上限约束。
- M8 [ok] contracts 三文件 hash 与 baseline 一致；正式路由 `router.ts:69 → App.tsx:68 → ProjectSettings` 可达。implementation 产品文件为 21/21，missing/extras/forbidden 均为空。

P1：无。P2 ledger delta：无。

门禁：复用且未冒充自跑的 supervisor focused 日志，SHA-256 匹配；daemon 104、contracts 39、console 7 项测试及三包 typecheck、静态门均通过。本会话另行只读执行 `git diff --check`，exit 0。开头与结尾 fingerprint 均匹配。

未运行：本 reviewer 未自跑 focused tests；`just ci`、Playwright 留待本次语义 GREEN 后由 supervisor 执行。Windows 真机、live provider、发行与外部操作未运行，均属合同排除面。

```review-manifest
{"verdict":"GREEN","review_ordinal":1,"candidate_head":"99d51106c9caaefcf55f72bff1a17a78abf58be9","diff_fingerprint":"1d0050bce5fc81953fdebcf75f240b8784fb9f5da3676858028f5d259fc728a8","review_scope":"step","blockers":[],"p2_ledger_delta":[],"focused_gates":[{"name":"focused-privacy","exit_code":0,"summary":"SHA-256 匹配；复用、非本会话自跑：daemon typecheck 与 104 tests、contracts typecheck 与 39 tests、console typecheck 与 7 tests，以及 emoji/doc-links/public-tree-privacy/schedule-pointer/git diff check 通过"}],"stop_reason":null}
```