# SayDo 项目缺口治理 v4 最终实施合同复评

你是全新、零上下文、只读的实施就绪性、事务恢复、证据可信度与最小范围对抗评审者。仓库为当前
工作目录。不要修改文件，不要运行产品测试、构建、真实账号、设备、connector、部署或网络访问；
允许只读检索、shell 语义探针和静态文档门。

## 必读

1. `AGENTS.md`
2. `docs/plan/2026-08-28-project-gap-closure-program.md`，重点 14.8、15–17、20 节
3. `docs/plan/2026-08-28-project-gap-owner-decisions.md`
4. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`
5. `docs/plan/IMPLEMENTATION-PLAN-2.md` 文首、W5、R-B/R-C、W6–W9、§6/§7
6. `HANDOFF.md` 的当前指针与最新快照
7. `research/codex-findings/212-project-gap-v4-transaction-and-wave-final-review.md`，仅作历史 `[fail]`
   快照；必须按当前 bytes 独立判断，不继承其结论。

## 当前版本要证明的核心合同

- D17 仍只授权 PG-00 五文件文档导入、零上下文一致性复审和 exact transaction support paths；不授权
  代码、commit/push/deploy、真实账号、产品外部调用、付费、条件包或既有/用户/产品/历史数据删除。
- PG-00 从 first-start bootstrap claim、initial ledger 原子 publish、lease fencing、reviewing、逐 target
  write-ahead stage，到 committed/rollback/cleanup/anchor 都应对每个合法 crash 窗口有唯一安全恢复；
  partial 自有 support 与未知外来路径必须可区分，owner quiescence 不能与 lease-absent anchor 死锁。
- focused/full/final registry 应具有唯一词法、command ID、required result 双射；PG-02 的 `just ci` 与
  Playwright 必须在 registry、marker、批卡和总结一致。
- Wave digest 图应为 environment seed → validation run → attempt → execution manifest → wave input →
  finalization invocation → receipt → finalization result 的单向 DAG。domain、JCS projection、64 位
  SHA-256 与 Git OID 不得混用。
- 普通 batch 与 PG-02 union 应有唯一 artifact subject；shared attempt/manifest/runs/logs 与各 subject
  input/receipt/finalization 路径必须一一对应。retry 不得被旧 result 占位。
- checker 必须实际拿到并解析 implementation scope manifest、readback receipt、finding disposition、
  full-tree/scope/tree projection 与 predecessor receipt，而不是只相信无 bytes 消费者的 digest。
- 完整覆盖与零过度必须同时成立：A 级 core 串行导入；条件包只登记触发线；owner 当前只需要一次
  D17，不因恢复正常路径、未来扩张或同一战略重复批准。

## 评审目标

1. 对 PG-00 从每个 `write/fsync/rename/ledger phase/lease takeover/cleanup` 边界做 crash table 推演，寻找
   丢失更新、双执行器、TOCTOU、错误删除、合法状态被 blocked、commit 后错误 rollback 或 anchor 永远
   不可构造的窗口。
2. 对 Wave registry、digest DAG、attempt retry、artifact path、readback/scope bytes consumer、PG-02 union
   与 selector promotion 做生产者→定位→解析→验证→消费者闭环检查，寻找自指、路径不一致、缺项/
   额外项假绿和不可重跑状态。
3. 对 PLAN-2/HANDOFF import projection 检查唯一 next、legacy disposition、A-ID close-set、full gate 与
   deferred exact-set 是否内部一致；不要把未来合同尚未实施误判成当前文档缺口。
4. 判断收益、持续成本、退出条件和“不做”边界是否足够支持 owner 决策，是否仍有无消费者字段、
   企业化过早实现或可以删除而不降低安全/可判定/可恢复性的机制。
5. 除最终 journal、dirty manifest/digest 回填和 owner D17 原话外，判断是否还有 owner 现在必须提供的
   信息或第二次战略确认。

`PENDING_FINAL_REVIEW` 是复评、journal 和最终静态门之后才回填的机械占位符。仅因占位符尚在不判
A/B；绑定机制不成立则按实际严重度报告。不要把“尚未实施/未跑产品测试”本身算 finding。

## 输出

先给 `[pass]` 或 `[fail]`。按 A/B/C 列 findings；每条必须含稳定 ID、真实 `file:line`、可复现失败
场景、最小修法与 disposition，并区分当前文档缺口和未来实施状态。

最后必须给：

1. `A_open`、`B_open`、`C_open` exact-set；
2. `D17_CONTENT_READY_EXCEPT_FINAL_RECORDS_DIGEST_AND_OWNER=yes/no`；
3. `D17_READY_AFTER_FINALIZATION=yes/no`；
4. `owner_now_must_provide_exact_set`；
5. 若可签，给含 `<最终64位SHA>` 与完整 quiescence 边界的最小签署文本；
6. 实际只读命令与明确未运行项。
