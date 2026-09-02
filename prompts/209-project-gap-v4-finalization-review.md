# SayDo 项目缺口治理 v4 最终化复评

你是全新、零上下文、只读的实施就绪性与范围克制评审者。仓库为当前工作目录。不要修改文件，
不要运行产品测试、构建、真实账号、设备、connector、部署或网络访问；允许只读检索、shell 语义
探针和静态文档门。

## 必读

1. `AGENTS.md`
2. `docs/plan/2026-08-28-project-gap-closure-program.md`，重点 14.6–14.8、20 节
3. `docs/plan/2026-08-28-project-gap-owner-decisions.md`
4. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`
5. `docs/plan/IMPLEMENTATION-PLAN-2.md` 文首、W5、R-B/R-C、W6–W9、§6/§7
6. `HANDOFF.md` 的开工先读、当前指针与最新快照
7. `research/codex-findings/208-project-gap-v4-implementation-readiness-review.md`，仅把它当历史失败
   快照；必须按当前磁盘字节独立判断其 3A/4B 是否已关闭

## 评审目标

owner 要的是“标准完整的对应，同时零过度设计、零过度实施”。当前方案声称：

- D17 一次签署且批准原文直接含最终 64 位 import spec SHA；只授权 PG-00 文档事务；
- D17 只导入 PG-01A–PG-06 七个 A 级 core 批，随后 owner stop；
- PG-01A 先撤销 G-A2 假绿 claim，PG-03 仍唯一最终关闭 G-A2；
- focused gate 只有一个 Gate-ID registry，含 pre/post-evidence 两相；
- PG-01A/01B 只产 provisional，PG-02 重跑并升级 v1 receipts；PG-02–PG-06 必须消费 wave-exit；
- legacy、deferred、safe default、close/stop-loss set 均可机械复制；
- 条件包只消费 selected surface 的 applicable decisions，不进入 D17 denominator；
- repo/deployed、local/hosted/platform/live/release 证据边界分开。

请对当前 bytes 做对抗复评，尤其判断：

1. 208 的 A-D17-BIND、A-GATE-SOT、A-GA2-STOPLOSS 与四个 B 是否真实关闭；
2. `FG-PG00-DOC` shell 块是否 fail-fast，能证明 HANDOFF/PLAN-2 可见正文、markers、唯一 chain、
   18 个 legacy ID 与 expected status 一致，并拒绝未知/重复项；
3. pre/post-evidence gate 是否有循环、无消费 checker、receipt 假升级或 evidence 自指；
4. 每批能否由独立施工会话直接生成 prompt；是否仍要它重新发明 scope/gate/deferred/验收；
5. D17 是否仍暗含代码、commit、push、deploy、外部调用、数据删除、条件包或默认全做；
6. 为关闭 finding 新增的 marker/ID/receipt 约束是否属于必要最小机制，还是引入显著过度；
7. 除最终 digest 回填与 owner D17 原话外，是否还缺 owner 现在必须提供的信息。

`PENDING_FINAL_REVIEW` 是本次复评、journal 和最终静态门之后才回填的机械占位符。仅因占位符尚在，
不要判内容 A；若 digest 绑定机制本身不成立，仍按 A。

## 输出

先给 `[pass]` 或 `[fail]`，再按 A/B/C 列 findings。每条必须含稳定 ID、真实 `file:line`、失败
场景、最小修法和 disposition。A = 越权/双排产/安全数据合同或 evidence 假绿/循环/不可验收；
B = 边界、成本或用户结果显著不清；C = 可读性维护建议。不要把“尚未实施/没跑产品测试”本身
算 finding。

最后必须给：

1. `D17_CONTENT_READY_EXCEPT_DIGEST_AND_OWNER=yes/no`；
2. `D17_READY_AFTER_FINALIZATION=yes/no`；
3. owner 现在必须提供的 exact-set；
4. 可签时含 `<最终64位SHA>` 的最小签署文本；
5. 实际只读命令与未运行项。
