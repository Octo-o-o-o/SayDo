# SayDo 项目缺口治理 v4 闭环复评

你是全新、零上下文、只读的实施就绪性、证据可信度与最小范围评审者。仓库为当前工作目录。
不要修改文件，不要运行产品测试、构建、真实账号、设备、connector、部署或网络访问；允许只读
检索、shell 语义探针和静态文档门。

## 必读

1. `AGENTS.md`
2. `docs/plan/2026-08-28-project-gap-closure-program.md`，重点 20 节
3. `docs/plan/2026-08-28-project-gap-owner-decisions.md`
4. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`
5. `docs/plan/IMPLEMENTATION-PLAN-2.md` 文首、W5、R-B/R-C、W6–W9、§6/§7
6. `HANDOFF.md` 的当前指针与最新快照
7. `research/codex-findings/210-project-gap-v4-final-readiness-review.md`，仅作历史 `[fail]` 快照；
   必须按当前 bytes 独立判断其 3A/2B 及后续相邻问题是否关闭

## 当前回修声称

- `FG-PG00-DOC` 拒绝全部已知现在时旧链；七条 exact batch marker 总数为 7，逐条固定唯一依赖、
  A-ID sets、scope ref、gate/full gate、evidence、rollback、deferred 与 safe default；
- PG-01A 是 `predecessor_receipt_exact_set=[]` 的 genesis；非自指 PG-00 evidence anchor 只在所有
  输入最终化后由 PG-01A input 构造；PG-00 Markdown 不冒充 receipt；
- receipt gates 在锁定 validation revision 的 disposable clean detached worktree 运行，绑定完整 Git
  tree、三批 upgrade scope union、lockfiles/toolchain/provision receipt；源 dirty tree 与未登记执行输入
  均拒绝；
- PG-00 的五目标 rollback 由固定 ignored WAL 做 write-ahead ownership：目标写前先持久化 intended
  digest；失败时先全量三态分类，任一 other 零回滚写入；
- evidence 最后写，只引用在 evidence prepared entry 前冻结且排除 evidence/self/later-state 的
  domain-separated WAL checkpoint；final ledger 不回写 evidence、不进入 receipt anchor；
- PG-05 唯一安全缺省为 immutable probe 后拒绝不兼容库。

## 评审目标

1. 逐条复核 Codex 210 的 3A/2B 是否关闭；
2. 攻击七 marker、旧链负门、PG-00 WAL/CAS、genesis/anchor、validation detached worktree 与 PG-02
   三批 receipt 升级，寻找自指、崩溃窗口、未锁执行输入、假绿或不可复制步骤；
3. 判断 D17 是否仍只授权 PG-00 文档原子导入与其唯一 ignored transaction sidecar，是否暗含代码、
   commit、push、deploy、外部调用、数据删除、条件包或战略选择；
4. 判断新增 marker、detached validation、WAL/checkpoint 是否是关闭已证实风险的最小充分机制，
   是否还能删除任何机制而不降低可判定性；
5. 除最终 journal、dirty manifest/digest 回填与 owner D17 原话外，是否还有 owner 必须提供的信息。

`PENDING_FINAL_REVIEW` 是本轮复评与最终记录完成后才回填的机械占位符。仅因占位符尚在，不判
A/B；若绑定机制本身不成立，照实际严重度报告。

## 输出

先给 `[pass]` 或 `[fail]`。按 A/B/C 列 findings；每条含稳定 ID、真实 `file:line`、失败场景、最小
修法与 disposition。不要把“尚未实施/没跑产品测试”本身算 finding。

最后必须给：

1. `A_open`、`B_open`、`C_open` exact-set；
2. `D17_CONTENT_READY_EXCEPT_FINAL_RECORDS_DIGEST_AND_OWNER=yes/no`；
3. `D17_READY_AFTER_FINALIZATION=yes/no`；
4. owner 现在必须提供的 exact-set；
5. 可签时含 `<最终64位SHA>` 的最小签署文本；
6. 实际只读命令与未运行项。
