[fail]

210 的原 `3A/2B` 失败场景均已关闭，但当前 bytes 暴露了新的 `3A/3B`。仅回填 `PENDING_FINAL_REVIEW`、journal 和 digest 不能进入 D17 签署。

## 210 逐项对账

| 历史 ID | 结论 | 当前依据 |
|---|---|---|
| `A-PG00-STRUCTURE-GATE-02` | `[closed]` | 七条完整 marker、前缀总数、旧链负门及 18 项 disposition 已固定于 [program:1466](docs/plan/2026-08-28-project-gap-closure-program.md:1466)。 |
| `A-WAVE-GENESIS-01` | `[closed]` | PG-01A 明确 `predecessor_receipt_exact_set=[]`，PG-00 Markdown 不作为 receipt，见 [program:1558](docs/plan/2026-08-28-project-gap-closure-program.md:1558)。 |
| `A-WAVE-VALIDATION-SNAPSHOT-01` | `[closed]` | 已绑定 validation tree、完整 Git tree、detached worktree，并要求 PG-02 在同一 tree 重跑两批 focused gate、`just ci` 和 Playwright，见 [program:1528](docs/plan/2026-08-28-project-gap-closure-program.md:1528)、[program:1543](docs/plan/2026-08-28-project-gap-closure-program.md:1543)。 |
| `B-PG00-PARTIAL-ROLLBACK-CAS-01` | `[closed]` | 五路径先全量三态分类，任一 `other` 零回滚写入，见 [import spec:266](docs/plan/2026-08-28-project-gap-d17-import-spec.md:266)。 |
| `B-PG05-SAFE-DEFAULT-01` | `[closed]` | 唯一缺省已收敛为 immutable probe 后拒绝不兼容库，见 [program:1774](docs/plan/2026-08-28-project-gap-closure-program.md:1774)。 |

## A findings

### A-PG00-REVIEW-SEAL-CYCLE-01

- 证据：journal 和 evidence 都必须记录独立复审及其输出 digest，[import spec:215](docs/plan/2026-08-28-project-gap-d17-import-spec.md:215)；复审必须核对“实际 diff”，[import spec:247](docs/plan/2026-08-28-project-gap-d17-import-spec.md:247)；evidence 又必须最后写，[import spec:258](docs/plan/2026-08-28-project-gap-d17-import-spec.md:258)。
- 失败场景：先复审则未审最终 journal/evidence；后复审再回填输出 digest，又改变被复审 bytes。现有 WAL checkpoint 只消除了 ledger/evidence 自指，没有消除 review-output 封印循环。
- 最小修法：定义 domain-separated `review_input_projection`，覆盖五个 desired postimage，只排除 review-result seal 字段；复审输出绑定该 projection digest，最终 postimage 重算投影必须全等。也可将最终复审 receipt 独立为第六个只读锚点，但范围更大。
- disposition：`[open]`，阻断 D17。

### A-PG00-WAL-CAS-TOCTOU-01

- 证据：dirty-base equality 只在事务前检查，[import spec:32](docs/plan/2026-08-28-project-gap-d17-import-spec.md:32)；正向写只规定 WAL prepared 后替换目标，[import spec:250](docs/plan/2026-08-28-project-gap-d17-import-spec.md:250)；回滚也只在第一相分类，第二相写前不再 CAS，[import spec:266](docs/plan/2026-08-28-project-gap-d17-import-spec.md:266)。
- 失败场景：preflight 后 owner 修改 README，事务按旧 preimage 覆盖；或回滚分类后 owner 再编辑，第二相恢复旧 bytes，均会丢失 owner 新改动。
- 最小修法：定义事务级独占/quiescence lease，并在每次正向 replace、反向 restore/delete 前重新比较当前 digest；lease 或比较失败立即停。目标写还须明确 `fsync staged target → rename → fsync target parent`。
- disposition：`[open]`，现有用户 bytes 存在不可逆覆盖风险。

### A-WAVE-EXECUTION-INPUT-BINDING-01

- 证据：当前只明确记录工具版本、lockfile digest、provision command/result，[program:1534](docs/plan/2026-08-28-project-gap-closure-program.md:1534)，同时声称未登记执行输入会门红，[program:1540](docs/plan/2026-08-28-project-gap-closure-program.md:1540)，但没有定义执行输入 exact manifest。`node_modules`、`.venv`、`.env*` 都被忽略，[.gitignore:1](.gitignore:1)，测试子进程也实际继承 `process.env`，[daemonProcess.ts:89](packages/daemon/test/helpers/daemonProcess.ts:89)。
- 失败场景：clean detached tree 中使用 `NODE_OPTIONS`、PATH shim、外部 browser binary，或 provision 后修改 ignored 依赖；Git tree、lockfile、版本和 provision log 不变，receipt 仍可假绿。
- 最小修法：定义并绑定 JCS `execution_input_manifest_digest`：净化后的 env allowlist、OS/arch、argv/cwd、隔离 HOME/store/cache、解析后工具路径及 identity、package-manager 配置、browser/runtime identity、provision 后依赖完整性；补 PATH/env/ignored-dependency mutation。
- disposition：`[open]`，阻断所有 final receipt。

## B findings

### B-WAVE-READBACK-REVISION-BINDING-01

- 证据：readback 在锁定 validation revision 前发生，[program:1510](docs/plan/2026-08-28-project-gap-closure-program.md:1510)、[program:1538](docs/plan/2026-08-28-project-gap-closure-program.md:1538)；input 仅绑定不透明的 `readback digest`，[program:1528](docs/plan/2026-08-28-project-gap-closure-program.md:1528)。
- 失败场景：旧 revision 的 readback digest 可被带入较新的 validation tree，特别是 PG-02 为三批升级 receipt 时；checker 无法机械证明 reviewer 看过哪棵树。
- 最小修法：定义 `readback_receipt`，绑定 `reviewed_revision/full_tree_digest/scope_digest/verdict`；PG-02 对最终 union tree 绑定一次升级 readback，或机械证明后续 diff 均被相邻批 readback 覆盖。
- disposition：`[open]`。

### B-PG00-WAL-RECOVERY-SCHEMA-01

- 证据：授权面声称只有五个目标和一个固定 sidecar，[import spec:47](docs/plan/2026-08-28-project-gap-d17-import-spec.md:47)，但算法还需要 staged desired files 和临时 ledger，[import spec:252](docs/plan/2026-08-28-project-gap-d17-import-spec.md:252)。只定义了 `prepared`，写后状态为“可更新”，且未定义成功终态或 all-intended 恢复规则。
- 失败场景：evidence 已 rename 后中断，恢复者无法唯一判断确认成功还是回滚；崩溃还可能留下未授权 temp 路径。`transaction delta digest` 没有 projection/domain/消费者。
- 最小修法：定义唯一 v1 JCS schema、commit point、状态机和 all-preimage/mixed/all-intended/other 恢复表；授权 txid 派生的临时 namespace、digest-owned cleanup 和 postflight exact-set。无消费者的 delta digest应直接删除。
- disposition：`[open]`。这是当前唯一明确可删、且不降低可判定性的机制。

### B-WAVE-GENESIS-TERMINOLOGY-01

- 证据：旧实施段仍要求“把 receipt 写入 journal”，[program:1099](docs/plan/2026-08-28-project-gap-closure-program.md:1099)；第 20 节却明确 PG-00 无 checker、finalization 为 `N/A`，[program:1513](docs/plan/2026-08-28-project-gap-closure-program.md:1513)，而 PG-00 批又要求严格照 §14.8 实施，[program:1643](docs/plan/2026-08-28-project-gap-closure-program.md:1643)。
- 失败场景：施工者可能重新发明 PG-00 receipt，或把 Markdown/evidence anchor 错标成 receipt。
- 最小修法：把 1099 行的 `receipt` 改成 `PG-00 evidence/readback record`，并明确“不产生 PG-00 final receipt”。
- disposition：`[open]`；不需 owner 决策。

## C findings

`C_open=∅`。

## D17 边界与最小性

D17 没有暗授代码实施、commit、push、deploy、真实账号、connector、产品晋级、条件包或 D1–D16 战略选择；这些边界写得明确。

但它目前不能字面声称“只有唯一 sidecar、无删除”：原子协议还需要临时路径，回滚会 CAS 删除本事务新建的 evidence。应把“禁止删除”收窄为禁止既有、用户、产品和历史数据删除，并显式授权事务自有 temp/evidence 清理。独立复审也应明确是只读治理动作，不是产品/live/connector 调用。

七条 exact marker、detached validation worktree 和 domain-separated WAL checkpoint 都有独立判定作用，不能删除；可删除的是当前无消费者且未定义 projection 的 `transaction delta digest`。

## 最终 exact-set

```text
A_open={A-PG00-REVIEW-SEAL-CYCLE-01,A-PG00-WAL-CAS-TOCTOU-01,A-WAVE-EXECUTION-INPUT-BINDING-01}
B_open={B-WAVE-READBACK-REVISION-BINDING-01,B-PG00-WAL-RECOVERY-SCHEMA-01,B-WAVE-GENESIS-TERMINOLOGY-01}
C_open=∅
D17_CONTENT_READY_EXCEPT_FINAL_RECORDS_DIGEST_AND_OWNER=no
D17_READY_AFTER_FINALIZATION=no
owner_now_must_provide_exact_set=∅
```

除最终 journal、dirty manifest/digest 回填和 D17 原话外，没有其他 owner 信息或战略选择需要提供。当前应先回修上述机制；回修、重新零上下文复评和最终化后，owner 才提供唯一签署消息。

可签时的最小文本：

```text
批准 D17；绑定 import spec SHA-256=<最终64位SHA>；仅授权 PG-00 文档原子导入、只读一致性复审，以及 import spec 明示的 WAL/临时文件写入和事务自有新文件 CAS 回滚清理；不授权代码实施、提交、推送、部署、真实账号/connector/产品外部调用、既有或用户数据删除、条件包。
```

## 当前快照与实际命令

快照：HEAD `280b0cfa1594a8963bed2a4b730734915a3762b0`；program SHA-256 `d2fcdd6bd27f1b220071f060f89707cdafc20805ec30212d01329c2217fea250`；D17 spec SHA-256 `e777e487eacdc063403cb3f810a586fbb437f6ae2877b3d9eab4a641f597b117`。`PENDING_FINAL_REVIEW` 为 12 次、分布在 10 行，未计 finding。

实际运行：

- `pwd`、`git status --short --branch`、`git rev-parse HEAD`
- `wc -l/-c`、`nl -ba`、`sed -n`、`rg --files`、多组 `rg -n/-F/-c/-o`
- `shasum -a 256`、`git check-ignore -v`、路径存在性与 worktree 静态检查
- `bash -n <(sed -n '1466,1507p' ...)` → exit 0；七条 exact batch assertion
- `bash scripts/check-emoji.sh` → `[ok] emoji gate: clean`
- `node scripts/check-doc-links.mjs` → `[ok] active document links: files=117 broken=0`
- `git diff --check` → exit 0
- 两个零上下文、只读、互补角度的独立复核

未运行：产品测试、`just ci`、lint、typecheck、构建、Playwright、真实账号、设备、connector、部署、网络访问、外部 `codex exec`、commit 或 push。未修改任何文件。