# SayDo 项目缺口治理 v7 最终对抗复查

你是全新、零上下文、只读的实施就绪性、复杂度预算、Git 恢复、产品覆盖与 owner 决策审查者。
仓库是当前工作目录。不要修改文件，不要运行产品测试、构建、真实账号、设备、connector、deploy
或网络访问；允许只读 Git/text 检索、Git 能力确认与静态文档门。

## 必读

1. `AGENTS.md`
2. `HANDOFF.md` 第 0 节与当前 active/next
3. `docs/plan/2026-08-28-project-gap-closure-program.md`，重点 0、3、9–17、20–22 节
4. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`
5. `docs/plan/2026-08-28-project-gap-owner-decisions.md`
6. `docs/plan/README.md`
7. `docs/plan/IMPLEMENTATION-PLAN-2.md` 文首、W5、R-B/R-C、W6–W9、§6/§7
8. `research/codex-findings/214-project-gap-v6-standard-git-final-review.md`
9. `scripts/week-audit.mjs` 与 `scripts/release-file-transaction.mjs` 的现役输出集合

208–212、214 都是其评审快照的 `[fail]` 历史证据；213 在 v5 重写前被主动终止，只有 ignored
日志。不要继承结论，逐条从当前 bytes 重验。不要要求恢复 v4 的 WAL/lease/digest DAG，或 v5 的
B0/core-ref/CAS/O/E_abort。

## v7 必须复查的闭合项

逐条判定 214 的 7A/8B 是否已闭合，尤其攻击：

1. PG-00 的 E 是否先 stage required evidence，再运行现有 `week-audit --write`，只纳入七项固定
   allowlist 的实际 changed subset；writer 读取 working tree 而 commit 读取 index，因此 E 前是否强制
   index↔working-tree 全等且无非 ignored untracked path，E 后是否只在 clean committed bytes 上跑
   `--check-bundle`；不得增加第三提交。
2. owner 消息中的最终 spec raw SHA 是否同时绑定 prospective index 与 committed `I:path`；program
   frozen digest/dirty bindings 是否可复核；spec/program 返工是否强制重新复审和签署。
3. 未来集成是否绑定完整已复审 E OID、验证 source tip 恰为 E、按 OID ff-only 并回读目标 tip=E。
4. PG-01A 是否有固定 986 对象 Q0 truth report 路径、有限 schema、I commit/tree 绑定、缺失/漏项/
   mutation fail 门；focused gate 记录的 report digest 是否与 E blob 全等并在 clean E 重跑 checker；
   unresolved 是否只能降级而不能冒充 connector readiness。不要要求本批修全 986。
5. G-A3 是否在 PG-01B 只 stop-loss、到 PG-02 完整 action denominator 才关闭；历史 evidence 是否不被
   追溯改写。
6. PG-01B 是否枚举全部 HTTP/WS/Unix composition root 与真实 local/mobile_lan/tailnet via，明确
   recovery 是 server mode 而非 IdentityVia，
   local-only 排除，且有遗漏路由、guard bypass、WS message mutation；不要要求动态 route 平台。
7. PG-05 是否要求 live sidecar 一致读取、只对 quiesced/checkpointed 副本用 immutable、每次 production
   migration（含 additive）前建立恢复点，并覆盖 WAL-only future/gap 与故障后原文件 exact-set/digest。
8. 每条 gate/readback 是否各自绑定同一 implementation SHA/tree；PG-00 I/E gate 是否分相位；amend
   staged diff 是否始终相对 locked HEAD。
9. 中断恢复是否只允许两个可证明的 `HEAD + staged exact-set`，只对字面路径 unstage 且不动 worktree；
   finalization 是否逐个扫描 untracked whitespace，并正确区分 no-index exit 1 与 whitespace exit 3。
10. W5.3-tail、SP2d 与 Q1/Q2 是否各有唯一且不过度的归属：W5.3-tail 全量 deferred 到 PLAN-2 §6.10；
    SP2d 是每批 `triggered|N/A(reason)` 规则；首个实际获批 SP4/SP5 slice 在批内唯一初始化
    `Q1Q2-CORE`，不另开施工批。

## 整体攻击

- 从 D17 semantic freeze、report/journal、机械最终化、owner 原始批准、I、I 三路复审、E、owner stop
  完整推演一遍，找自指、未授权路径、可移动 identity、旧证据复用或不可判定恢复。
- 复核 PG-01A–PG-06 的顺序、close/stop-loss/deferred、focused/full gate、evidence 与回滚是否能生成
  独立 IMPL prompt；当前未实施/未跑产品测试/未部署/占位 SHA 未填本身不算 finding。
- 复核工程、初级与资深用户、AI subscription/API、工具/connector、模拟提问五线，以及回报、持续
  成本、退出条件；不得以“标准完整”为名默认全做或预建企业化/通用平台。
- 比较更小方案：如果指出缺口，只能给能消除现实失败场景的最小修法；说明是否出现过度设计回归。

## 输出合同

先给 `[pass]` 或 `[fail]`。按 A/B/C 列 finding；每条含稳定 ID、当前真实 `file:line`、可复现失败
场景、最小修法与 disposition。若某条 214 finding 已闭合，给 concise closed 证据；不要制造 finding。

最后严格给：

```text
A_open_exact_set={...}
B_open_exact_set={...}
C_open_exact_set={...}
D17_SEMANTIC_FREEZE_READY=yes|no
D17_READY_AFTER_MECHANICAL_FINALIZATION=yes|no
owner_now_must_provide_exact_set={...}
OVERDESIGN_REGRESSION=no|yes
```

列出实际只读命令、静态门输出与明确未运行项。不要生成签署 SHA；最终 SHA 必须在本报告与 journal
落盘后的机械阶段计算。
