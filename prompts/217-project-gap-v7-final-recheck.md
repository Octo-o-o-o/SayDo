# SayDo 项目缺口治理 v7 最终对抗复查（fresh 217）

你是全新、零上下文、只读的实施就绪性与复杂度预算审查者。仓库是当前工作目录。
不要修改文件，不要运行产品测试、构建、真实账号、设备、connector、deploy 或网络访问。
不要创建 subagent；由你直接完成。先形成最终 exact-set，再用最少的只读命令补证据，避免超时。

必读：

1. `AGENTS.md` 与 `HANDOFF.md` 第 0 节；
2. `docs/plan/2026-08-28-project-gap-closure-program.md` v7，重点 9–17、20–22 节；
3. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`；
4. `docs/plan/2026-08-28-project-gap-owner-decisions.md`；
5. `docs/plan/IMPLEMENTATION-PLAN-2.md` 的当前排产入口与相关 W5/W6–W9；
6. `scripts/week-audit.mjs`、`scripts/release-file-transaction.mjs` 及方案直接点名的源码。

背景边界：208–212、214 是旧版本 `[fail]` 快照；213、215、216 都因方案变更或运行时限中断，
没有最终 report，不能当作通过。216 在中断前称保留了 3A/1B，但没有给出条目；只能把以下方向当
作待独立验证的线索，不能继承结论：

- I 复审后到 E 提交前，frozen dirty bindings 是否仍逐 blob 受约束；
- 任意代码批 E 与现役 `week-audit --write` / `--check-bundle` 是否相容；
- PG-01A 的 truth report、生成投影路径与 source identity 是否可施工且不会假绿；
- PG-01B 的远程面语义轴，以及 PG-02 action denominator 是否有实际消费者遗漏。

同时复核但不要扩大设计：

- D17 的 owner raw SHA、prospective index、I:path、I 三路独立复审、E、amend、恢复和未来按完整 E OID
  ff-only 集成是否闭合；
- PG-01A–PG-06 是否各自足以生成独立 IMPL prompt，是否明确 close/stop-loss/deferred、focused/full
  gate、证据与回滚；
- 工程、初级/资深用户、AI subscription/API、工具/connector、模拟提问、回报与持续成本是否完整；
- 是否重新出现自制 WAL/lease/CAS/digest DAG、通用 route/report 平台或默认全做等过度设计。

只把有当前 `file:line`、可复现失败场景和最小修法的条目列为 finding。当前未实施、未跑产品测试、
未填未来 commit SHA、签署前 dirty 本身不算 finding。不要为了显得严格制造 finding。

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
