# SayDo 项目缺口治理总案独立对抗评审

你是新的、只读的对抗评审会话。请在仓库 `<repo>` 中审查：

- 主对象：`docs/plan/2026-08-28-project-gap-closure-program.md`
- 排产与边界：`AGENTS.md`、`docs/plan/README.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md`
- 产品与合同：`docs/01-vision-and-problem.md`、`docs/02-product-definition.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`
- AI 供给：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`、`docs/plan/2026-08-24-ai-supply-owner-decisions.md`、`docs/plan/ai-supply-contracts-draft/README.md`
- 用户语料：`research/customer-question-corpus/README.md`、`research/customer-question-corpus/00-能力边界.md`、`research/customer-question-corpus/01-设计与分布.md`、`research/customer-question-corpus/simulations/01-schema.md`、`research/codex-findings/178-customer-question-corpus-final-independent-review-v8.md`
- 与计划发现直接相关的当前生产代码、发布文案、CI/just/package 配置和移动端 README。

约束：

1. 只读。不要修改文件、不要 commit、不要联网、不要运行构建或产品测试。
2. 可以使用 `rg`、`sed`、`git status`、`git diff`、`wc` 等静态读取命令。
3. 不重新审查 `docs/plan/ai-supply-contracts-draft/*.ts` 的 45,000 多行类型草案；只检查总案有没有错误引用其当前地位、范围和 owner 决策。
4. 不能依据旧评审的结论直接断言当前代码状态；关键事实要回到当前文件核验。
5. 不把未来验收规格或尚不存在的 gate 命令写成当前已通过证据。

请对抗性回答：

1. 总案是否完整覆盖工程质量、初级/资深/非开发/移动/无障碍/团队用户、AI 订阅与 API、Execution Agent、外部工具/connector、模拟提问与长会话。
2. 是否遗漏任何会导致安全、数据损失、权限/账单失真、默认 UI 伪动作、发布假绿或 evidence truth 失真的 A 级问题。
3. 每条 A/B 级证据是否来自当前文件，file:line 是否准确，严重级别是否合理；指出过度断言或把条件能力写成普遍能力的地方。
4. 计划是否把 AI inference/Execution、Tool/Connector、MCP/ACP/A2A 混在一起，或把 inventory/mock/合同草案冒充 production support。
5. owner 已签的 Codex/ACP 与首发只做内置受信 connector 的决策，是否真正约束了范围、排期和验收。
6. Wave 依赖是否正确，是否缺少必须前置的移动信任、数据库迁移恢复、订阅/费用文案、endpoint-secret-principal 绑定、自动发现安全和默认 UI 真值。
7. 每阶段验收是否足够可机械判定；若不够，给出最小增补，不要扩写成另一份无限计划。
8. 是否真正回应了用户的“先计划、暂不实际测试”，同时给未来实施留下了明确验收与门禁。

严重级别：

- A：不修就会导致安全/授权/数据/合同/evidence truth 失真、发布假绿，或使本计划不可合法开工。
- B：显著阻断目标用户旅程、恢复、维护或平台一致性，但可在相邻 phase 收口。
- C：优化项或后续触发线。

输出到最终消息，使用以下结构：

1. 最终裁决：`[pass]` 或 `[fail]`，以及 A/B/C 数量。
2. Findings：按 A→B→C，每条给 ID、准确 file:line、风险、最小修改。
3. 五角覆盖复核：工程、用户、AI 供给、工具、语料各给 `[ok]`/`[partial]`/`[fail]` 和一句理由。
4. 依赖与机械验收复核。
5. 若 A=0，明确写“A 级 0”；不要为了显得严格而制造 finding。
