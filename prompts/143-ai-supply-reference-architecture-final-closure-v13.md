# AI 供给普适接入方案架构闭包终审 v13

你是一个全新、零上下文、只读的架构终审者。不要读取 `prompts/`、`research/codex-findings/`、`history/` 或其他旧评审材料，也不要猜测作者意图。只以当前仓库实际代码、canonical 约束和下述冻结方案为证据。

目标文件：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

冻结身份必须先独立核对：

- SHA-256：`ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743`
- `wc -l`：`28097`
- bytes：`1679137`

若任一不符，立即输出 `FAIL` 并把漂移列为 A 级；不得评审另一版本。不得修改目标文件、生产代码或 canonical。

请做对抗性而非摘要式评审，至少覆盖：

1. 两平面划分、三核心推理协议、Execution/bridge/control 语义是否互斥且完整。
2. receipt edge、租约 authority、durable cursor、首字节/副作用前授权、崩溃恢复是否存在循环、双持权、漏终态或不可构造分支。
3. auth、rights、billing/funding、data/compute/network boundary 是否能机械阻止套餐误用、隐式超额、跨 realm/key/route 换挂和本地伪装。
4. connector SDK、detector、registry、TUF、plugin sandbox、conformance report、release binding 是否能在 macOS/Linux/Windows 上实现，是否把声明当证明。
5. 63 条 requirements、run/journey/evidence/GA 投影与四槽 `review_ready` 是否存在 `never`、宽联合、自证闭环、漏行或可借报告通过。
6. TypeScript 合同是否能在合理资源内编译，开放扩展是否造成组合爆炸；性能、稳定性、可观测性、回滚和迁移门是否足够。
7. Phase 0–8 的依赖、owner 决策、canonical 回写、测试门、完成定义是否可判定，是否出现边施工边定义完成。

严重级别：

- A：安全、权益、费用、数据丢失、协议错误、不可构造/不可发布、机器门可绕过或根本架构矛盾，必须冻结前修。
- B：会造成主流路径不可用、开箱承诺失真、重大维护/性能/平台缺口或验收不可判定，必须冻结前修。
- C：不阻断正确实现的表达、组织或后续优化建议。

报告必须写入 `research/codex-findings/143-ai-supply-reference-architecture-final-closure-v13.md`，包含：冻结身份核对、逐条发现（级别、准确锚点、反例、根因修复、机械验收）、A/B/C 计数、最终 `PASS` 或 `FAIL`。只有 A=0 且 B=0 才能 `PASS`；不得为了给出结论而降级发现。
