# AGENTS.md — 本项目协作约定(owner 定,长期有效)

## 评审制度(2026-07-23 起,owner 明确要求,适用于后续所有沟通)

每轮重要沟通的产出(新文档、结构性修改、关键决策、Demo 变更),完成后**必须**提交独立评审再收口:

1. **2 个 subagent**(互补角度,如"产品与一致性"×"架构安全与集成"),foreground 并行;
2. **1 个 Codex**(`codex exec -m gpt-5.6-sol -c model_reasoning_effort=max`,后台),报告落 `research/codex-findings/NN-*.md`,prompt 存 `prompts/`、日志存 `logs/`;
3. 收到评审后 triage(A 硬伤必修,B/C 择要吸收),回修文档,并把"输入/行动/产出/结论"记入 `history/PROCESS-JOURNAL.md`(轮次编号递增)。

理由:防"相关错误链"——生成方不能自评(docs/04 §2.3);owner 原话:"听着其他的声音,综合思考,能把这个项目做得更扎实"。

**实施期(写代码阶段)适用轻量版**(owner 已批准,supersede 上述重制度用于代码实施):按改动类型分级——纯代码 = 每 Phase 末 1 个 code-review subagent(A 级=安全/契约/数据丢失,必修);**回写 canonical 文档(docs/09/10/ADR 等)= 1 个一致性 subagent + 攒批 1 次 Codex**;spike ADR = Codex 一次或 owner 直批;journal/证据 = 免评审;战略/范围 = 上浮 owner。细则见 `IMPLEMENTATION-PLAN.md` 每 Phase 收尾仪式。重制度仍用于**设计文档轮次**(非代码)。

## 文档结构纪律

- `docs/` 是唯一 canonical(**01–11 + modules/ + adr/**;09 数据契约、10 话术、11 UI 规范是实施照抄源,modules/a–e 是分域实施导航,与 01–08 同为 canonical);`research/` 是证据源;`history/` 是过程档案;`archive/` 是快照。改设计先改 docs,证据入 research,过程记 journal。
- 术语与状态口径以 `docs/06` 术语表为准(M0–M3 记忆 / S0–S3 风险 / `ready_for_review` ≠ 完成 / 直达验收·逐步确认),全套一致,禁止再造同义词。
- `demo/saydo-console-demo.html` 与 `docs/08 §6` 信息架构保持同步;Demo 中超出 P0 的元素必须标注分期;Demo 不得夹带文档没有的功能(先回填文档或删)。
- 修改后如涉及渲染(Demo/SVG),用本机 headless Chrome 截图验证。

## 语言与身份

- 全部沟通与文档使用简体中文;owner = 唯一决策人,战略/商业取舍永远上浮,不代拍板。
