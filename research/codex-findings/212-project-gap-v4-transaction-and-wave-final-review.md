[fail]

当前 D17 不可签。`PENDING_FINAL_REVIEW`、PG-00/Wave 尚未实施及产品测试未运行均未计入 finding；阻断项均是当前文档合同本身的矛盾、不可判定或不可恢复窗口。

## Codex 211 对账

| 211 finding | 当前结论 | 证据 |
|---|---|---|
| `A-PG00-REVIEW-SEAL-CYCLE-01` | `[closed]` | normalized projection、review seal、最终重投影与 seal equality 已闭合：[D17:323](docs/plan/2026-08-28-project-gap-d17-import-spec.md:323)、[D17:359](docs/plan/2026-08-28-project-gap-d17-import-spec.md:359)。 |
| `A-PG00-WAL-CAS-TOCTOU-01` | `[closed]`，限 cooperative lease 模型 | owner quiescence、正向/反向每次写前 CAS 已定义：[D17:81](docs/plan/2026-08-28-project-gap-d17-import-spec.md:81)、[D17:345](docs/plan/2026-08-28-project-gap-d17-import-spec.md:345)、[D17:407](docs/plan/2026-08-28-project-gap-d17-import-spec.md:407)。 |
| `A-WAVE-EXECUTION-INPUT-BINDING-01` | `[partial]` | 字段面已补，但 registry→manifest→result 双射、实际受控执行和 result full-tree 绑定未闭合。 |
| `B-WAVE-READBACK-REVISION-BINDING-01` | 核心 `[closed]` | receipt 已绑定 reviewed revision/full tree/scope，PG-02 有 union readback：[program:1512](docs/plan/2026-08-28-project-gap-closure-program.md:1512)、[program:1581](docs/plan/2026-08-28-project-gap-closure-program.md:1581)。相邻 gate-result/readback-consumer 缺口见下文。 |
| `B-PG00-WAL-RECOVERY-SCHEMA-01` | `[partial]` | JCS schema、commit point、分类矩阵已补；bootstrap、终态、lease takeover 与 durability 仍有缺口。 |
| `B-WAVE-GENESIS-TERMINOLOGY-01` | `[closed]` | PG-00 明确为 evidence/readback record，不产生 final receipt：[D17:244](docs/plan/2026-08-28-project-gap-d17-import-spec.md:244)、[program:1099](docs/plan/2026-08-28-project-gap-closure-program.md:1099)。 |

内部新增检查结论：

- commit-anchor：`[partial/open]`
- seal equality：`[closed]`
- gate-run cardinality：`[open]`
- `preimage=intended=current` equivalent/no-op：`[closed]`，见 [D17:398](docs/plan/2026-08-28-project-gap-d17-import-spec.md:398)

## A findings

### A-PG00-FUTURE-WAVE-GATE-CONFLATION-01

- 位置：[D17:253](docs/plan/2026-08-28-project-gap-d17-import-spec.md:253)、[D17:264](docs/plan/2026-08-28-project-gap-d17-import-spec.md:264)、[program:1518](docs/plan/2026-08-28-project-gap-closure-program.md:1518)、[program:1692](docs/plan/2026-08-28-project-gap-closure-program.md:1692)。
- 失败场景：D17 §7 把 PG-02–PG-06 的真实 gate exit 和完整 receipt 链列为“PG-00 必须同时满足”，但 program 明确 PG-00 receipt-finalization=`N/A`、只跑 `FG-PG00-DOC`。PG-00 因而要么永远不能 commit，要么只能伪填未来 receipt。
- 最小修法：第 7.5 项只验 PLAN-2 是否完整登记未来验收合同；明确 PG-00 不运行、不签发 PG-01A–PG-06 的 gate/receipt。
- disposition：`[open][当前文档缺口][blocks D17]`

### A-PG00-ANCHOR-REVIEW-PROJECTION-01

- 位置：[D17:331](docs/plan/2026-08-28-project-gap-d17-import-spec.md:331)、[D17:359](docs/plan/2026-08-28-project-gap-d17-import-spec.md:359)、[D17:365](docs/plan/2026-08-28-project-gap-d17-import-spec.md:365)、[program:1601](docs/plan/2026-08-28-project-gap-closure-program.md:1601)。
- 失败场景：commit 时会重投影，但后续 anchor 只检查 committed、target equality 和两组 seal；没有解析 retained review-input/output 并把其中的 projection 与当前重投影四向比较。commit 后若 target、ledger、checkpoint/seal 被协调改写，review-output 仍绑定旧投影，anchor 却可接受未被 reviewer 看过的 bytes。
- 最小修法：anchor checker 强制
  `computed(review-input projection) == parsed(review-output projection) == ledger.review_input_projection_digest == recomputed(current targets projection)`；继续复用现有 seal，无需新增一套 seal。
- disposition：`[open][当前文档缺口][evidence truth]`

### A-PG00-TEMP-PATH-CONFINEMENT-01

- 位置：[.gitignore:37](.gitignore:37)、[D17:57](docs/plan/2026-08-28-project-gap-d17-import-spec.md:57)、[D17:283](docs/plan/2026-08-28-project-gap-d17-import-spec.md:283)、[D17:413](docs/plan/2026-08-28-project-gap-d17-import-spec.md:413)。
- 失败场景：事务路径全部位于 ignored `logs/`，但协议未锁定祖先目录的 realpath/type/device，也没有 no-follow 语义。预存或竞态 symlink 可把 ledger/stage/review 写到仓外；随后字符串路径清理可能删除授权范围外数据。
- 最小修法：锁定每级祖先的 canonical identity；拒绝 symlink/reparse/cross-device；用固定目录句柄和 no-follow 相对操作；清理只逐个 unlink exact owned file，再对空目录 `rmdir`，禁止递归或通配删除。
- disposition：`[open][当前文档缺口][authorization/data boundary]`

### A-WAVE-GATE-RUN-BIJECTION-01

- 位置：[program:1447](docs/plan/2026-08-28-project-gap-closure-program.md:1447)、[program:1558](docs/plan/2026-08-28-project-gap-closure-program.md:1558)、[program:1591](docs/plan/2026-08-28-project-gap-closure-program.md:1591)。
- 失败场景：当前只要求 manifest ID 唯一、每个 result 命中一个 manifest 项；未要求 registry required commands、manifest runs、results 三者 exact-set 全等，也未要求 result ID 唯一。语义探针实证：遗漏一个 required result 和复制绿色 result 均返回 `true`。一个 manifest 内多命令也没有 ordinal/dependency。
- 最小修法：为 registry 每个 argv 固定 `gate_command_id`，确定性展开 manifest；断言 registry↔manifest↔result 双射、result ID 唯一且基数相等；为多命令增加 ordinal/dependency，并只允许受控 launcher 生成绑定实际 env 的 result。
- disposition：`[open][当前文档缺口][false-green]`

### A-WAVE-GATE-RESULT-FULL-TREE-BINDING-01

- 位置：[program:1533](docs/plan/2026-08-28-project-gap-closure-program.md:1533)、[program:1545](docs/plan/2026-08-28-project-gap-closure-program.md:1545)、[program:1590](docs/plan/2026-08-28-project-gap-closure-program.md:1590)。
- 失败场景：input/readback 绑定完整 Git tree，但 result 只明确绑定 validation scope/tree、manifest 和未定义的 `detached-worktree identity`。scope 外的 tracked checker/driver 在 R2 改变时，R1 的旧绿 result 可因 scope digest 未变而被复用。
- 最小修法：每个 result 强制绑定并核等 `validation_revision`、完整 Git tree digest、scope exact-set/tree digest、manifest digest、gate-run ID。把 `detached-worktree identity` 定义为确切投影并消费；否则删除该模糊字段。
- disposition：`[open][当前文档缺口][old-tree false-green]`

## B findings

### B-PG00-RECOVERY-LIFECYCLE-01

- 位置：[D17:23](docs/plan/2026-08-28-project-gap-d17-import-spec.md:23)、[D17:283](docs/plan/2026-08-28-project-gap-d17-import-spec.md:283)、[D17:318](docs/plan/2026-08-28-project-gap-d17-import-spec.md:318)、[D17:383](docs/plan/2026-08-28-project-gap-d17-import-spec.md:383)。
- 失败场景：崩溃可发生在 namespace/lease 已创建而 ledger 尚不存在，此后 preflight 因路径存在拒绝、recovery 因 ledger 缺失 blocked；成功清 lease 后 recovery 又无条件要求 lease digest。矩阵也没有 cleaned committed、`rolled_back`、`blocked` 终态行。stale takeover 先换 lease、后写 ledger，二者之间崩溃会留下永久 digest mismatch。
- 最小修法：定义每个 phase 的 required/optional/forbidden support-path exact-set、bootstrap 与全部终态行；lease takeover 使用 generation/fencing 的可恢复状态转换；为同一已签事务规定可判定的 retry/archive 路径。
- disposition：`[open][当前文档缺口][crash recovery]`

### B-PG00-AUXILIARY-DURABILITY-01

- 位置：[D17:315](docs/plan/2026-08-28-project-gap-d17-import-spec.md:315)、[D17:331](docs/plan/2026-08-28-project-gap-d17-import-spec.md:331)、[D17:363](docs/plan/2026-08-28-project-gap-d17-import-spec.md:363)、[D17:407](docs/plan/2026-08-28-project-gap-d17-import-spec.md:407)。
- 失败场景：`ledger.next` 跨目录 rename 却只 fsync destination parent；review-input/output 未规定 file/rename/parent fsync；commit cleanup 未 fsync parent。掉电后可能保留 committed ledger，却丢失 review-output，或复现 lease/stage 目录项。
- 最小修法：review 文件使用同目录 temp→file fsync→rename→parent fsync；ledger rename 同时 fsync source/destination parent，或把 temp 移到 ledger 同目录；所有 unlink/rmdir 后 fsync parent，并定义幂等 cleanup recovery。
- disposition：`[open][当前文档缺口]`

### B-PG00-DIGEST-BYTE-CONTRACT-01

- 位置：[D17:65](docs/plan/2026-08-28-project-gap-d17-import-spec.md:65)、[D17:287](docs/plan/2026-08-28-project-gap-d17-import-spec.md:287)、[D17:336](docs/plan/2026-08-28-project-gap-d17-import-spec.md:336)、[D17:354](docs/plan/2026-08-28-project-gap-d17-import-spec.md:354)、[program:1558](docs/plan/2026-08-28-project-gap-closure-program.md:1558)。
- 失败场景：同一规格同时使用 raw `\0` 与 `\\0`，且未说明相邻 SHA 是 64 位 hex UTF-8 还是 32-byte digest。两个合理实现会得到不同 txid、checkpoint 或 manifest digest，导致路径、lease 和恢复互不兼容。
- 最小修法：逐式定义 byte grammar，例如 `UTF8(domain) || 0x00 || UTF8(lowercase_hex)` 或 raw digest，并统一全部公式。
- disposition：`[open][当前文档缺口][determinism]`

### B-PG00-TARGET-METADATA-01

- 位置：[D17:299](docs/plan/2026-08-28-project-gap-d17-import-spec.md:299)、[D17:345](docs/plan/2026-08-28-project-gap-d17-import-spec.md:345)、[D17:407](docs/plan/2026-08-28-project-gap-d17-import-spec.md:407)。
- 失败场景：ledger 只保存 bytes/kind/digest；stage rename 会换 inode，但未锁定或恢复 mode/ACL/xattr。当前 `docs/plan/README.md` 实际带 `com.apple.provenance` xattr；不同 umask 还可把 `0644` 改成其他 mode，rollback 的 base64 bytes 无法还原。
- 最小修法：至少锁定 regular-file/no-symlink 与 POSIX/Git mode；明确需保留的 ACL/xattr 投影，在 stage fsync 前复制并在 rename 后验证。若允许归一化，必须在授权合同中明确。
- disposition：`[open][当前文档缺口]`

### B-WAVE-ARTIFACT-LIFECYCLE-01

- 位置：[program:1527](docs/plan/2026-08-28-project-gap-closure-program.md:1527)、[program:1540](docs/plan/2026-08-28-project-gap-closure-program.md:1540)、[program:1544](docs/plan/2026-08-28-project-gap-closure-program.md:1544)、[program:1592](docs/plan/2026-08-28-project-gap-closure-program.md:1592)。
- 失败场景：finalizer 的 input/receipt 是相对路径，命令要求在 detached worktree 运行，但产物又要写回源批路径；两者不可同时成立。固定 receipt 路径加“已有不同 bytes 绝不覆盖”还会使返工后的新 revision 被旧 receipt 永久占位。
- 最小修法：定义唯一绝对 artifact root；checker executable/cwd 固定在 detached revision；input/receipt 使用 input-digest 派生的 content-addressed 路径，并以原子、digest-verified promotion 更新源树 current selector。
- disposition：`[open][当前文档缺口][reproducibility/retry]`

### B-WAVE-READBACK-CONSUMER-SCHEMA-01

- 位置：[program:1551](docs/plan/2026-08-28-project-gap-closure-program.md:1551)、[program:1554](docs/plan/2026-08-28-project-gap-closure-program.md:1554)、[program:1586](docs/plan/2026-08-28-project-gap-closure-program.md:1586)。
- 失败场景：B/C finding 可按“批卡明示 disposition”放行，但 input/批卡没有 finding-ID disposition map；checker只能全部拒绝或猜测。PG-02 union receipt 又只有单数 `batch` 字段，却供三个 batch input 消费，匹配规则不确定。
- 最小修法：增加按 finding ID 的 exact disposition map；明确 union review subject exact-set，或定义 `batch=PG-02 + review_kind=pg02-upgrade-union` 的唯一三-input 匹配规则及反例。
- disposition：`[open][当前文档缺口]`

## C finding

### C-D17-SIGNATURE-LITERAL-01

- 位置：[D17:76](docs/plan/2026-08-28-project-gap-d17-import-spec.md:76)、[owner decisions:58](docs/plan/2026-08-28-project-gap-owner-decisions.md:58)。
- 失败场景：规格要求原文含无包裹的 `import spec SHA-256=<64hex>`，推荐文本却在 hash 外加反引号。字符串探针结果为 `signature_literal_match: false`；owner 照抄会被 preflight 拒绝并被迫再签。
- 最小修法：推荐文本移除 hash 两侧反引号。
- disposition：`[open][当前文档缺口][机械修订]`

## Exact-set 与 readiness

```text
A_open={A-PG00-FUTURE-WAVE-GATE-CONFLATION-01,A-PG00-ANCHOR-REVIEW-PROJECTION-01,A-PG00-TEMP-PATH-CONFINEMENT-01,A-WAVE-GATE-RUN-BIJECTION-01,A-WAVE-GATE-RESULT-FULL-TREE-BINDING-01}
B_open={B-PG00-RECOVERY-LIFECYCLE-01,B-PG00-AUXILIARY-DURABILITY-01,B-PG00-DIGEST-BYTE-CONTRACT-01,B-PG00-TARGET-METADATA-01,B-WAVE-ARTIFACT-LIFECYCLE-01,B-WAVE-READBACK-CONSUMER-SCHEMA-01}
C_open={C-D17-SIGNATURE-LITERAL-01}
D17_CONTENT_READY_EXCEPT_FINAL_RECORDS_DIGEST_AND_OWNER=no
D17_READY_AFTER_FINALIZATION=no
owner_now_must_provide_exact_set=∅
```

当前 D17 SHA-256 为 `efe43985734221ea24c5c0009216fbf26beeb076e2c3bcf4f3c611f15d0ef71e`，但它不是可签最终值。

D17 的意图仍是一次最小治理授权：修复以上文档缺口、完成最终记录/digest 和零上下文复评后，owner 只需一次 D17 原话；当前无需提供新的产品选择、账号、环境、预算、数据删除或条件包信息。后续各批正常停点不等于重签 D17。

可签时最小原文应为：

```text
批准 D17；绑定 import spec SHA-256=<最终64位SHA>；仅授权 PG-00 文档原子导入、只读一致性复审，以及 import spec 明示的 WAL/临时/复审文件写入和事务自有新文件 CAS 回滚清理；PG-00 持 lease 期间我不并发修改五个 target；不授权代码实施、提交、推送、部署、真实账号/connector/产品外部调用、既有、用户、产品或历史数据删除、条件包。
```

## 标准完整与零过度

现有 `input_lock_digest`、`lease_digest`、review projection/output digest、WAL checkpoint、final ledger digest、validation revision/full-tree/scope 三轴均有独立消费者，不建议删除。未定义的 `detached-worktree identity` 在补齐 result 的 revision/full-tree equality 后可以删除；若保留则必须定义 exact projection 和 checker equality，不能继续作为模糊标签。

未把以下事项计为 finding：

- `PENDING_FINAL_REVIEW` 尚未回填；
- PG-00 ledger/evidence/support paths 当前不存在；
- `check-wave-exit.mjs` 和未来 receipts 尚未实施；
- HANDOFF/PLAN-2 尚未导入 PG 链；
- 产品测试、构建和真实环境证据尚未运行。

## 实际只读命令与未运行项

当前锁定证据：

- HEAD：`280b0cfa1594a8963bed2a4b730734915a3762b0`
- program SHA-256：`c7fd732151931457558d3398733acc8d273a810c2130b8a64c258535452c5198`
- D17 SHA-256：`efe43985734221ea24c5c0009216fbf26beeb076e2c3bcf4f3c611f15d0ef71e`
- ledger、lease、tx namespace：均 `ABSENT`
- 评审前后 `git status --short --branch` 一致，未修改文件。

实际运行：

```text
pwd
rg --files -g 'AGENTS.md'
wc -l / wc -c <七份必读文件>
nl -ba <必读文件> | sed -n '<相关范围>p'
rg -n / rg -F <projection、anchor、lease、phase、receipt、gate_run、detached 等>
git status --short --branch
git log -5 --oneline --decorate
git rev-parse HEAD
git ls-files -s <五个 target>
shasum -a 256 <必读文件>
ls -le@ <四个既有 target>
od -An -tx1 <digest 公式相关行>
bash scripts/check-emoji.sh
node scripts/check-doc-links.mjs
git diff --check
bash -n <(sed -n '1468,1509p' docs/plan/2026-08-28-project-gap-closure-program.md)
node -e '<gate-run cardinality、signature literal、digest byte 语义探针>'
```

静态门真实输出：

```text
[ok] emoji gate: clean
[ok] active document links: files=117 broken=0
git diff --check: exit 0
PG-00 断言块 bash -n: exit 0
gate probe: { complete: true, missing_required: true, duplicate_result: true }
signature probe: { signature_literal_match: false }
```

第一次 heredoc 形式的 Node 探针因只读 sandbox 无法创建临时 heredoc 文件而未执行；随后改用 `node -e` 成功复现，未创建文件。

未运行：产品测试、`just ci`、lint、typecheck、构建、Playwright、真实账号、设备、connector、部署、网络访问、外部 `codex exec`、commit、push。按 `impl-review` 的 readback 纪律，只采用了本会话真实命令输出和当前文件行号；因用户要求只读，未落盘 review 报告。
