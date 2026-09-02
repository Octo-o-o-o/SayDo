# SayDo 项目缺口治理 v4 最终实施就绪复评

你是全新、零上下文、只读的实施就绪性、证据可信度与范围克制评审者。仓库为当前工作目录。
不要修改文件，不要运行产品测试、构建、真实账号、设备、connector、部署或网络访问；允许只读
检索、shell 语义探针和静态文档门。

## 必读

1. `AGENTS.md`
2. `docs/plan/2026-08-28-project-gap-closure-program.md`，重点 14.6–14.8、20 节
3. `docs/plan/2026-08-28-project-gap-owner-decisions.md`
4. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`
5. `docs/plan/IMPLEMENTATION-PLAN-2.md` 文首、W5、R-B/R-C、W6–W9、§6/§7
6. `HANDOFF.md` 的开工先读、当前指针与最新快照
7. `research/codex-findings/208-project-gap-v4-implementation-readiness-review.md` 与
   `research/codex-findings/209-project-gap-v4-finalization-review.md`，两者都只是历史失败快照；
   必须按当前磁盘 bytes 独立判断 findings 是否已关闭

## 当前方案声称的最小闭环

- owner 目前只需最终签 D17；原始批准消息必须逐字包含最终 64 位 import spec SHA；
- D17 只授权 PG-00 把七个 A 级 core 批导入 PLAN-2/HANDOFF，不授权代码、commit、push、deploy、
  外部调用、数据删除或任何条件包；
- PG-00 只用 D17 的 dirty-base manifest；PG-01A–PG-06 各批开批时另锁 batch-local manifest；
- PG-01A 先撤销 G-A2 假绿 claim，PG-03 唯一最终关闭 G-A2；
- focused gate 只有一个 Gate-ID registry，并明确区分现有命令与 `[new]` 交付物；
- PG-01A/PG-01B 只产 provisional；PG-02 重跑并按
  `wave-exit-input -> deterministic write-or-verify receipt -> Markdown evidence` 升级 receipts；
- 每个后续批只消费直接前驱 receipt digest，input/receipt 不含自身 digest 或自身 exit；
- legacy、deferred、safe default、close/stop-loss set 均可机械复制；条件包只登记、不进入 D17
  denominator；
- repo/deployed、local/hosted/platform/live/release 证据边界分开。

## 评审目标

请从零对当前 bytes 做对抗复评，尤其判断：

1. 208 的 3A/4B、209 的 2A/1B，以及后续发现的
   `A-PREFLIGHT-MANIFEST-LIFETIME-01` 是否全部真实关闭；
2. PG-00 preflight、事务、静态门、dirty-base CAS 回滚和旧排产处置能否由独立会话机械执行；
3. PG-01A–PG-06 是否各有唯一依赖、A-ID ownership、scope roots、现有/新增 gate、验收、证据、
   rollback、deferred exact-set 与 safe default，不要求施工者重新发明完成定义；
4. receipt 协议是否无自指、无预写 pass、无旧 revision 复用、无漏前驱、无只改 Markdown 假绿；
5. D17 是否仍暗含实施或战略授权，条件包是否被误排为当前工作；
6. 为机械闭环新增的 marker、ID、manifest、receipt 约束是否是必要最小机制；是否还有可以删除而
   不降低可判定性的过度要求；
7. 除最终 digest 回填与 owner D17 原话外，owner 现在是否还必须提供任何信息。

`PENDING_FINAL_REVIEW` 是本轮复评、journal 与最终静态门后才回填的机械占位符。仅因占位符尚在，
不要判内容 A/B；若绑定机制本身不成立，仍按实际严重度报告。

## 输出

先给 `[pass]` 或 `[fail]`，再按 A/B/C 列 findings。每条必须含稳定 ID、真实 `file:line`、失败
场景、最小修法和 disposition。A = 越权/双排产/安全数据合同/evidence 假绿或不可验收；
B = 边界、成本、依赖或用户结果显著不清；C = 可读性维护建议。不要把“尚未实施/没跑产品测试”
本身算 finding。

最后必须给：

1. `A_open` 与 `B_open` exact-set；
2. `D17_CONTENT_READY_EXCEPT_DIGEST_AND_OWNER=yes/no`；
3. `D17_READY_AFTER_FINALIZATION=yes/no`；
4. owner 现在必须提供的 exact-set；
5. 可签时含 `<最终64位SHA>` 的最小签署文本；
6. 实际只读命令与未运行项。
