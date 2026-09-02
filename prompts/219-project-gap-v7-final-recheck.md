# SayDo 项目缺口治理 v7 最终对抗复查（fresh 219）

你是全新、零上下文、只读的实施就绪性与复杂度预算审查者。仓库是当前工作目录。
不要修改文件，不要运行产品测试、构建、真实账号、设备、connector、deploy 或网络访问。
不要创建 subagent；由你直接完成。优先形成最终 exact-set，再用最少的只读命令补证据，避免超时。

必读：`AGENTS.md`、`HANDOFF.md` 第 0 节、
`docs/plan/2026-08-28-project-gap-closure-program.md` v7（重点 9–17、20–22 节）、
`docs/plan/2026-08-28-project-gap-d17-import-spec.md`、
`docs/plan/2026-08-28-project-gap-owner-decisions.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md` 当前入口，
以及 `scripts/week-audit.mjs`、corpus rebuild/dry-run scripts 和方案直接点名的源码。

208–212、214 是旧版 `[fail]` 快照。213、215、216、217、218 只有 ignored 事件流、没有 report；
分别因版本取代、运行中语义回修、20 分钟硬时限、D17 错列不存在 report、以及并行 subagent 找到
PG-01A dry-run projection scope 缺口而停止。不得把它们写成通过。独立复核当前 bytes，尤其验证：

1. D17 从 semantic freeze、机械最终化、owner raw SHA、prospective index、I:path、I 三路复审、E、
   amend/恢复到 future full-E-OID ff-only；E 前是否重验 preexisting literal staged blobs；
2. PG-00 及所有代码批 E 是否在 index/worktree 全等后运行现役 week-audit writer、只 stage 固定输出的
   actual subset，并在 clean E 上 `--check-bundle`，且没有第三提交；
3. PG-01A 的实际 questions/contexts/contracts/04 projection、source-tree digest 改变时两份既有 dry-run
   派生文档的条件 rebuild、986 对象 Q0 report、path+RFC6901 identity、唯一 producer、I/tree/digest
   绑定和 mutation 是否可施工且不会假绿；
4. PG-01B remote denominator 与 PG-02 action denominator 是否覆盖实际 producer/consumer，越界时是否
   fail-closed，而非预建 route/report/receipt 平台；
5. PG-03–PG-06 的顺序、close/stop-loss/deferred、focused/full gate、证据、回滚，以及工程、初级/资深
   用户、AI subscription/API、工具/connector、模拟提问、回报和持续成本是否完整。

不要要求恢复自制 WAL/lease/CAS/digest DAG、持久化 986 个 source_id、通用 route/report 平台或默认全做。
只把有当前 `file:line`、可复现失败场景和最小修法的条目列为 finding。当前未实施、未跑产品测试、
未来 SHA 未填和签署前 dirty 本身不算 finding。

输出先给 `[pass]` 或 `[fail]`，再列 A/B/C。最后严格给：

```text
A_open_exact_set={...}
B_open_exact_set={...}
C_open_exact_set={...}
D17_SEMANTIC_FREEZE_READY=yes|no
D17_READY_AFTER_MECHANICAL_FINALIZATION=yes|no
owner_now_must_provide_exact_set={...}
OVERDESIGN_REGRESSION=no|yes
```

列出实际只读命令、静态门与未运行项。不要生成签署 SHA；SHA 必须在 report/journal 落盘后的机械阶段计算。
