# AS-01/AS-02 implementation c1 ordinal 3 评审

结论：RED。首尾 fingerprint 均匹配指定 HEAD；contracts 三文件 SHA-256 与 baseline 一致。上一轮 `P1-M3-01`、`P1-M6-01` 已闭合，但新发现 2 项范围内 P1。

## M1–M8 对账

- [ok] M1：`MemoryLedger.add` 在 classify、`requestedTrust`、supersedes 与 insert 前扫描 claim/source；remember、addHotword、nominate、reanchor、approve、onFact 均有逐条恢复。
- [ok] M2：五件文档组装后扫描，首次 staging 创建在扫描及保护检查之后；core 使用固定工作区标签。
- [ok] M3：create-only ignore、tracked 检测与叶子 `lstat`/`O_NOFOLLOW` 守卫成立。`P1-M3-01` 已闭合：正式 approve 投影不会跟随根外或根内 `m1-notes.md` symlink。
- [fail] M4：并非所有私有写失败都映射为 `write_failed`。
- [warn] M5：凭据和 Git 保护失败的三态 DTO/UI 正常，但 P1-M4-01 的 staging 写失败仍降为无 failureClass 的泛化失败。
- [ok] M6：safeHits 经 contracts schema 和 rules 安全来源关系。`P1-M6-01` 已闭合：同一 literal 的每个原始 span 独立计算行号，测试断言第 1、5 行。
- [fail] M7：原文行号定位新增了未计入总量的完整 KEY_FILE 重扫。
- [warn] M8：正式路由、schema baseline、implementation exact-set 与主要反例测试一致；现有测试未覆盖下列两个新反例。

## P1

- `P1-M4-01`：正式 bootstrap 中，若 Git ignore 已保护 write set，但 `.saydo/foundation` 不可写，预检会把不存在的目标叶子视为 protected，随后裸 `mkdirSync(staging)` 抛错并被返回为 `bootstrap_failed`，没有 `git_protection_insufficient`、`write_failed` 或旧/首次 generation failureClass。证据：`packages/daemon/src/memory/foundation.ts:369`。
- `P1-M7-01`：一个合法的 524288 字符 KEY_FILE 在持久化摘录中命中时，组装文档扫描通过总量检查后，又对完整原文调用凭据扫描；仅一个最大文件便使本次 scanner 输入总量超过 524288。证据：`packages/daemon/src/memory/foundation.ts:613`。

## 门禁与未运行项

核验 `focused-supervisor-3.log` SHA-256 一致后复用，非本 reviewer 自跑：daemon typecheck 与 7 文件 96 tests、contracts typecheck 与 39 tests、console typecheck 与 7 tests，以及静态文档门均通过。本 reviewer 自跑 `git diff --check`，exit 0。

未运行：`just ci`、Playwright，按合同仅在语义 GREEN 后运行；只读约束下未做破坏性 mutation 验证。P2 ledger 无新增。

```review-manifest
{"verdict":"RED","review_ordinal":3,"candidate_head":"99d51106c9caaefcf55f72bff1a17a78abf58be9","diff_fingerprint":"6b367d2a90ca7313e2be9d8d295b4b8935ffd163044bd02edac67a63da54f93d","review_scope":"step","blockers":[{"id":"P1-M4-01","severity":"P1","summary":"正式 bootstrap 的 staging 目录写失败绕过 GitProtectionResult 映射，返回 bootstrap_failed 而非 write_failed 及对应 failureClass","evidence":"packages/daemon/src/memory/foundation.ts:369","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M4"},{"id":"P1-M7-01","severity":"P1","summary":"safeHit 行号定位会在组装文档扫描后完整重扫原始 KEY_FILE，使单次 foundation 扫描字符合计可突破 524288","evidence":"packages/daemon/src/memory/foundation.ts:613","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M7"}],"p2_ledger_delta":[],"focused_gates":[{"name":"focused-privacy","exit_code":0,"summary":"已核 SHA-256 的 supervisor 原始证据：daemon typecheck 与 96 tests、contracts typecheck 与 39 tests、console typecheck 与 7 tests、静态门通过；本 reviewer 另核 git diff --check exit 0"}],"stop_reason":null}
```