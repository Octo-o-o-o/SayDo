结论：RED。上一轮 `P1-M4-01`、`P1-M7-01` 已闭合；新发现 1 项正式路径可达的 M6 P1。无 P0、无 P2。

逐项对账：

- `[ok] M1`：`ledger.ts:90-134` 在 classify、writable 检查和 insert 前扫描全部待落盘字段；remember、hotword、nominate、reanchor、approve、onFact 均按条隔离并映射安全错误。
- `[ok] M2`：五件文档在创建 staging 前完成组装和扫描；workspace 使用固定非路径标签，拒绝时不发布 generation。
- `[ok] M3`：Git ignore 为 create-only；等价规则不覆盖；tracked 目标返回 insufficient，不改索引或历史。
- `[ok] M4`：`foundation.ts:718-734` 已将 staging mkdir 写失败经 `mapPrivateDirWriteError` 映射；`foundationOps.ts:117-153` 返回 write_failed 及对应 failureClass。`P1-M4-01` 闭合。
- `[ok] M5`：三类失败 DTO、HTTP、console runtime schema 一致；同一按钮可重试并显示新 generation。
- `[fail] M6`：rules 文件名中的凭据字面量仍被原样组装进标题，safeHit 错误定位为未发布的 `conventions.md`，未使用实际规则文件的安全编码定位。
- `[ok] M7`：safeHit 行号改用已扫描文档偏移及受限 persisted slice，不再完整重扫原始 KEY_FILE；opendir、读取和 Git 数量上限符合冻结合同。`P1-M7-01` 闭合。
- `[fail] M8`：正式路由、contracts 导出面、exact-set 和禁止修改面一致；但 daemon 测试没有覆盖 M6 明列的“凭据字面量位于 rules 文件名”生产归属案例，归并到同一 blocker。

`P1-M6-02` 反例：在合法直系 rules 文件名中使用冻结 OpenAI grammar 构造串、正文仅为普通文本，然后从项目设置执行正式 bootstrap。`foundation.ts:579` 已计算安全定位，但 `foundation.ts:580` 仍把原始名称写进待落盘标题。实际生产组装/扫描函数的无写入复现返回 `safeSources=["conventions.md"]`、`hasExpectedEncoded=false`；返回未泄露原文，但用户无法按处方定位和修复真实源文件。该项在范围内，不需 owner 决策。

证据：

- 起止 fingerprint 均 exit 0，HEAD 与 fingerprint 保持指定值。
- handoff 带授权 override 校验 exit 0，`status=owner_override`、无未批准违规。
- contracts 三文件 SHA-256 均匹配 baseline。
- daemon、contracts、console typecheck 本会话分别 exit 0，输出均为 `tsc --noEmit`；`git diff --check` exit 0、无输出。
- focused supervisor 日志 SHA-256 匹配；其中 daemon 102、contracts 39、console 7 tests 及仓库检查通过。该证据为复用，非本 reviewer 自跑。
- `just ci`、Playwright/local-browser、托管 CI、live provider、Windows 真机均为 `not_run`；落盘式定向复现受只读沙箱 EPERM 限制，未作为证据。

```review-manifest
{"verdict":"RED","review_ordinal":4,"candidate_head":"99d51106c9caaefcf55f72bff1a17a78abf58be9","diff_fingerprint":"6f3e46af1f8c421c83dcbb62338a6cc3df3c1c64ddbdccc0d305bbeff4f69e3a","review_scope":"step","blockers":[{"id":"P1-M6-02","severity":"P1","summary":"正式 foundation 组装仍将 rules 原始文件名写入标题，凭据字面量文件名的 safeHit 被误定位为未发布的 conventions.md，而非共享安全表示生成的真实规则来源，导致恢复处方不可执行","evidence":"packages/daemon/src/memory/foundation.ts:580","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M6"}],"p2_ledger_delta":[],"focused_gates":[{"name":"focused-privacy","exit_code":0,"summary":"复用 supervisor 原始 focused.sh 证据且 SHA-256 已核；daemon 102、contracts 39、console 7 tests 及 emoji、doc-links、public-tree-privacy、schedule-pointer、git diff 检查通过，非本 reviewer 自跑"}],"stop_reason":null}
```