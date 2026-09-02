# SayDo 项目缺口治理 v7 最终对抗复查（fresh 216）

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

208–212、214 是各自旧快照的 `[fail]` 证据。213 与 215 都因语义方案重写/修订而主动终止，只有
ignored 事件流、没有 report；不要把它们写成通过或伪造报告。逐条从当前 bytes 重验，不得要求恢复
v4 的 WAL/lease/digest DAG 或 v5 的 B0/core-ref/CAS/O/E_abort。

## 必须复查的闭合项

1. PG-00 的 E 是否先 stage 23 个 required evidence path，验证 required index=working tree，再运行
   现有 `week-audit --write`，只纳入七项固定 allowlist 的实际 changed subset，writer 后再次验证
   全 tracked index=working tree 且无非 ignored untracked；E 后是否只在 clean committed bytes 上跑
   `--check-bundle`。不得增加第三提交。
2. E 后门红时，是否只允许在 I/review byte-exact 不变时用 explicit pathspec amend 未发布 E 并全量
   重跑 E 门；需要改 I/spec/program 时是否停止并取得对应重新授权/重审重签。
3. owner 消息中的最终 spec raw SHA 是否同时绑定 prospective index 与 committed `I:path`；program
   frozen digest/dirty bindings 是否可复核；spec/program 返工是否强制重新复审和签署。
4. 未来集成是否绑定完整已复审 E OID、验证 source tip 恰为 E、按 OID ff-only 并回读目标 tip=E。
5. PG-01A 是否固定 986 对象 Q0 truth report 的唯一 producer argv、路径、有限 schema、I commit/tree、
   缺失/漏项/mutation 门；gate report digest 是否与 E blob 全等并在 clean E 重跑 checker；unresolved
   是否只能降级而不能冒充 connector readiness。不要要求本批修全 986 或建设通用 report 平台。
6. G-A3 是否在 PG-01B 只 stop-loss、到 PG-02 完整 action denominator 才关闭；历史 evidence 不追溯改写。
7. PG-01B 是否枚举全部 main/recovery/voice/tier1 composition root、HTTP/WS/Unix 与真实
   local/mobile_lan/tailnet via，明确 recovery 是 server mode 而非 IdentityVia，并与实际 handler/
   message/listener 源 exact-set 对账；不要要求不存在的 route registry 或动态路由平台。
8. PG-05 是否要求 live sidecar 一致读取、只对 quiesced/checkpointed 副本用 immutable、每次 production
   migration（含 additive）前建立恢复点，并覆盖 WAL-only future/gap 与故障后原文件 exact-set/digest。
9. 每条 gate/readback 是否各自绑定同一 implementation SHA/tree；PG-00 I/E gate 是否分相位；amend
   staged diff 是否始终相对 locked HEAD；中断恢复是否只有两个可证明 staged 状态。
10. finalization 是否逐个扫描 untracked whitespace，正确区分 no-index exit 1 与 whitespace exit 3；
    W5.3-tail、SP2d、`Q1Q2-CORE` 是否唯一归属且没有另造批或平台。

## 整体攻击

- 从 semantic freeze、report/journal、机械最终化、owner 原始批准、I、I 三路复审、E、owner stop
  完整推演 D17，找自指、未授权 path、可移动 identity、旧证据复用、dirty 假绿与恢复死路。
- 复核 PG-01A–PG-06 是否能分别生成独立 IMPL prompt：顺序、close/stop-loss/deferred、唯一 producer、
  scope roots、focused/full gate、evidence、回滚和不做边界必须足够；占位 SHA 未填、当前未实施/
  未跑产品测试/未部署本身不算 finding。
- 复核工程、初级与资深用户、AI subscription/API、工具/connector、模拟提问五线，以及回报、持续
  成本、继续/暂停/降级/退出条件；不得用“标准完整”掩护默认全做或企业化/通用平台预建。
- 比较更小方案：finding 只允许针对可复现失败给最小修法；明确是否出现过度设计回归。

## 输出合同

先给 `[pass]` 或 `[fail]`。按 A/B/C 列 finding；每条含稳定 ID、当前真实 `file:line`、可复现失败
场景、最小修法与 disposition。若 214/两路 subagent finding 已闭合，给 concise closed 证据；不要
为了显得严格制造 finding。

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
