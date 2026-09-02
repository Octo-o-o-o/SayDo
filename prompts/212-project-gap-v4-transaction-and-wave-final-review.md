# SayDo 项目缺口治理 v4 事务与 Wave 最终复评

你是全新、零上下文、只读的实施就绪性、证据可信度与最小范围对抗评审者。仓库为当前工作目录。
不要修改文件，不要运行产品测试、构建、真实账号、设备、connector、部署或网络访问；允许只读
检索、shell 语义探针和静态文档门。

## 必读

1. `AGENTS.md`
2. `docs/plan/2026-08-28-project-gap-closure-program.md`，重点 14.8、15–17、20 节
3. `docs/plan/2026-08-28-project-gap-owner-decisions.md`
4. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`
5. `docs/plan/IMPLEMENTATION-PLAN-2.md` 文首、W5、R-B/R-C、W6–W9、§6/§7
6. `HANDOFF.md` 的当前指针与最新快照
7. `research/codex-findings/211-project-gap-v4-closure-review.md`，仅作历史 `[fail]` 快照；必须按
   当前 bytes 独立判断其 3A/3B 及相邻新问题是否关闭

## 当前回修声称

- PG-00 使用五份 desired postimage 的 domain-separated review projection；journal/evidence 只归一化
  两个 review seal RHS 和一个 WAL checkpoint seal RHS；review output 绑定 projection，最终磁盘
  postimages 重投影必须相同，且 actual seals 必须等于 retained review output/ledger/recomputed
  checkpoint；
- fixed txid namespace、exclusive/quiescence lease、逐目标 write-ahead CAS、staged-target fsync/rename/
  parent-fsync、JCS v1 ledger 状态机、唯一 committed commit point 与 all-preimage/mixed/all-intended/
  other recovery matrix 已定义；每次正向和反向写前都重新比较 current digest；
- PG-00 evidence anchor 绑定 retained final ledger digest，并解析验证 committed、五 target applied、
  intended=observed=current 及 seal equality，因此 all-intended 未 committed 不能伪装成功；
- Wave readback 以 JCS receipt 绑定 reviewed revision/full tree/scope；PG-02 对最终 union tree 再做 upgrade
  readback；execution input manifest 绑定净化 env、隔离 HOME/cache/store、工具/browser identity、
  provision 后依赖内容及排序的 gate-run exact-set，每个 result 只按唯一 gate_run_id 命中一项；
- PG-00 不产生 final receipt；D17 只授权五文件文档事务、只读复审、exact transaction support paths、
  事务自有新文件 CAS 清理和 owner 在 lease 期间的 quiescence，不授权代码、commit/push/deploy、真实
  账号/connector/产品外部调用、既有/用户/产品/历史数据删除或条件包。

## 评审目标

1. 逐条复核 Codex 211 的 3A/3B 是否真实关闭，并检查内部复核新增的 commit-anchor、seal equality、
   gate-run cardinality、preimage=intended equivalent/no-op 是否闭合；
2. 攻击 review projection、WAL/lease/CAS、状态机/commit/recovery、PG-00 anchor，寻找自指、TOCTOU、
   崩溃歧义、未授权临时路径、错误删除或无法恢复窗口；
3. 攻击 readback receipt、execution input manifest、PG-02 union upgrade 与 wave-exit checker，寻找旧树
   复审、PATH/env/ignored dependency 假绿、一个 manifest 多命令歧义或不可复制步骤；
4. 判断 D17 是否仍为一次最小治理授权、owner 是否只需一次签署，新增机制是否都有实际消费者；
5. 检查“标准完整 + 零过度”：若能删除某字段/机制而不降低安全性、可判定性或可恢复性，明确指出；
6. 除最终 journal、dirty manifest/digest 回填与 owner D17 原话外，是否还有 owner 必须提供的信息。

`PENDING_FINAL_REVIEW` 是复评和最终过程记录完成后才回填的机械占位符。仅因占位符尚在，不判 A/B；
绑定机制本身不成立则按实际严重度报告。不要把“尚未实施/没跑产品测试”本身算 finding。

## 输出

先给 `[pass]` 或 `[fail]`。按 A/B/C 列 findings；每条含稳定 ID、真实 `file:line`、失败场景、最小修法
与 disposition。必须区分“当前文档缺口”与“未来实施尚未发生”。

最后必须给：

1. `A_open`、`B_open`、`C_open` exact-set；
2. `D17_CONTENT_READY_EXCEPT_FINAL_RECORDS_DIGEST_AND_OWNER=yes/no`；
3. `D17_READY_AFTER_FINALIZATION=yes/no`；
4. owner 现在必须提供的 exact-set；
5. 可签时含 `<最终64位SHA>` 与 lease 承诺的最小签署文本；
6. 实际只读命令与未运行项。
