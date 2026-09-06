# AS-01/AS-02 implementation c1 ordinal 2 复审

结论：RED。开头、结尾 fingerprint 均匹配指定 HEAD 与 diff；handoff 校验为 `owner_override`，无未批准违规。contracts 三文件及 focused 日志 SHA-256 均匹配基线。

## M1–M8 对账

- M1 [ok]：扫描已提前到 trust/readiness 检查之前，ledger 覆盖 claim、source 字段；remember、addHotword、nominate、reanchor、approve、onFact 均有逐条拒写恢复。P1-M1-01 已闭合。
- M2 [ok]：五件文档组装后扫描，扫描及 Git 保护均早于 staging；core 使用固定工作区标签，命中不改旧 pointer/manifest。
- M3 [fail]：tracked 目标及父目录根外 symlink 已拦截，但最终投影文件未做叶子校验。正式批准路径到达 `projectM1Notes` 后，若未跟踪的 `.saydo/knowledge/m1-notes.md` 是指向根外文件的 symlink，`writeFileSync` 会跟随并覆盖根外目标。P1-M3-01 未完全闭合。
- M4 [warn]：六种 Git 状态、非 Git、worktree、timeout/buffer 与父目录 symlink 分流正确；根外叶子写仍受 P1-M3-01 阻断。
- M5 [ok]：记忆拒写返回 `memory_item_not_saved`；UI 先按 failureClass 分流，刷新失败与 Git code 可同时呈现。P1-M5-01、P1-M5-02 已闭合。
- M6 [fail]：relativeSource 与 schema 使用正确，但行号通过 `original.indexOf(literal)` 回查。同一受支持 rules 文件在第 1、5 行出现同一 literal 时，两次命中都会得到第 1 行，随后被同 key 去重，第 5 行定位丢失。P1-M6-01 未完全闭合。
- M7 [ok]：rules 使用 opendir、先 stat 后有限读；16/65536/32/4096/131072 上限及 Git 5/16、timeout/maxBuffer 均有代码与 focused 测试证据。
- M8 [warn]：schema baseline、正式 `psettings → ProjectSettings` 路由、implementation exact-set 与排除面一致；现有测试未覆盖上述叶子 symlink 和重复 literal 行号反例。

## 门禁与未运行项

复用的 supervisor focused 证据并非本会话自跑：daemon 7 文件 88 tests、contracts 2 文件 39 tests、console 1 文件 7 tests 及四项文档检查均绿。本会话 `git diff --check` exit 0。动态补充复现因只读沙箱 `EPERM` 未进入产品代码，不计门禁证据。按合同，RED 前未运行 `just ci` 与 Playwright。

```review-manifest
{"verdict":"RED","review_ordinal":2,"candidate_head":"99d51106c9caaefcf55f72bff1a17a78abf58be9","diff_fingerprint":"056a72dff178c4ff4335d1e5a79f287ff5665818bb24e37e6c39c445199d428b","review_scope":"step","blockers":[{"id":"P1-M3-01","severity":"P1","summary":"正式 approve 投影路径只校验私有目录 symlink，未校验 m1-notes.md 叶子；未跟踪的根外叶子 symlink 会被 writeFileSync 跟随并覆盖。","evidence":"packages/daemon/src/memory/growth.ts:195","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M3"},{"id":"P1-M6-01","severity":"P1","summary":"safeHit 用 original.indexOf(literal) 定位；同一 literal 在同一 rules 来源多次出现时全部映射到首次行并被去重，后续实际行号丢失。","evidence":"packages/daemon/src/memory/foundation.ts:977","in_scope":true,"needs_owner_decision":false,"acceptance_item":"M6"}],"p2_ledger_delta":[],"focused_gates":[{"name":"FG-AS01AS02-PRIVACY supervisor evidence","exit_code":0,"summary":"SHA-256 已核；非自跑：daemon 7 文件 88 tests、contracts 2 文件 39 tests、console 1 文件 7 tests及文档检查通过"},{"name":"git diff --check","exit_code":0,"summary":"本会话自跑，无输出"}],"stop_reason":null}
```