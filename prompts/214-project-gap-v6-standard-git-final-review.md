# SayDo 项目缺口治理 v6 标准 Git 最终对抗复审

你是全新、零上下文、只读的实施就绪性、复杂度预算、Git 恢复、产品覆盖与 owner 决策审查者。
仓库是当前工作目录。不要修改文件，不要运行产品测试、构建、真实账号、设备、connector、deploy
或网络访问；允许只读 Git/text 检索、Git 能力确认与静态文档门。

## 必读

1. `AGENTS.md`
2. `docs/plan/2026-08-28-project-gap-closure-program.md`，重点 0、3、9–17、20、21 节
3. `docs/plan/2026-08-28-project-gap-d17-import-spec.md`
4. `docs/plan/2026-08-28-project-gap-owner-decisions.md`
5. `docs/plan/README.md`
6. `docs/plan/IMPLEMENTATION-PLAN-2.md` 文首、W5、R-B/R-C、W6–W9、§6/§7
7. `HANDOFF.md` 当前 active/next

208–212 是旧 v4 finding 快照；213 在 v5 重写前被主动终止，只有 ignored 日志，没有报告。不要继承
旧结论，也不要要求恢复 v4 的 WAL/lease/digest DAG，或 v5 的 B0/core-ref/CAS/O/E_abort。

## v6 的设计边界

- PG-00 只在 owner 签 D17 后，在当前专用 feature branch 上用 explicit pathspec 创建普通 plan/import
  commit `I` 和 evidence commit `E`。`parent(I)=locked HEAD,parent(E)=I`；I 的 clean validation
  worktree 承担门禁和三路只读复审。完成后停在 owner，不 push/merge/deploy。
- D17 自身由 owner 原始消息中的最终 spec SHA 绑定；owner decision `[x]` 是 post-signature 留档。
  semantic freeze 先评审，再只机械填具名占位符；非白名单正文变化必须重审。
- PG-01A–PG-06 使用标准 branch/worktree：`P predecessor → I implementation → E evidence`。owner
  单一 dispatch 保证串行；晋升只允许目标 tip 仍等于 P 时 `merge --ff-only`。误开的第二支失效，取消
  只需不采用 candidate，不设全局 active 锁。
- Git commit/tree/branch 是版本与 predecessor 身份；不得建议重建 B0、recovery/core ref、手写
  `update-ref` CAS、O/E_abort、execution manifest、validation attempt、mutable selector、WAL/lease/
  fencing 或 retrospective receipt upgrade，除非先证明一个当前方案无法处理的真实高损害场景。
- A 必修；`verdict=pass && A_open=empty` 是硬门。B/C 必须逐项 disposition，但不以清空所有 C 作为
  无限复评条件。
- 当前只做方案文档；未实施、未跑产品测试、未部署、占位 SHA 未最终化本身不算 finding。

## 必须攻击的场景

1. 按 PG-00 顺序推演：输入/dirty exact-set → owner 留档 → explicit staged set → I → clean-worktree
   gates/review → E → E 后 readback → owner stop。寻找自指、未授权 path、preexisting staged change、
   review 绑定错误、返工后复用旧证据或取消/恢复不成立。
2. 检查 semantic freeze → report/journal → 白名单机械最终化 → owner 原话 → decision 留档 → I 的顺序
   是否存在签名/输入锁循环；区分签名真相源与留档。
3. 检查普通批 P/I/E 的 exact scope、direct parent、同 SHA gates、独立 readback、E 后文档门和
   `merge --ff-only` 晋升是否可执行；特别攻击两支从同一 P 误开、review red、取消、目标 tip 漂移。
4. 做替代方案比较：是否仍有比 v6 更小、同时保持本仓独立评审、两提交、脏树保护与回滚纪律的标准
   Git 形态；不能因协议内部自洽就放过过度设计，也不能为理论风险恢复已删除的平台化机制。
5. 检查 PG-01A–PG-06 的 close/stop-loss/deferred、工程/初级与资深用户、AI subscription/API、工具/
   connector、模拟提问五线是否都有唯一归属与触发线，同时没有默认全做、企业化过早或无消费者平台。
6. 检查回报、非开发持续成本、退出条件和 owner 决策是否足够。判断 owner 当前除 D17 的一次本地
   I/E commit 授权外，是否还必须提供信息。

## 输出合同

先给 `[pass]` 或 `[fail]`。按 A/B/C 列 finding；每条含稳定 ID、当前真实 `file:line`、可复现失败场景、
最小修法与 disposition。不要把未来实现状态当当前文档 finding。

最后给：

```text
A_open_exact_set={...}
B_open_exact_set={...}
C_open_exact_set={...}
D17_SEMANTIC_FREEZE_READY=yes|no
D17_READY_AFTER_MECHANICAL_FINALIZATION=yes|no
owner_now_must_provide_exact_set={...}
OVERDESIGN_REGRESSION=no|yes
```

若 `verdict=pass` 且 A 为空但仍有 B/C，逐条给最终 disposition，并说明是否阻断 D17。列实际只读命令、
静态门输出和明确未运行项。不要生成签署 SHA；最终 SHA 在 report/journal 落盘后的机械阶段计算。
