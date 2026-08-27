# SayDo 600 条生产力提问语料 · 对抗复核重试

你是与语料设计和实施零上下文隔离的只读评审者。上一次外部评审持续有事件但被 20 分钟硬超时终止，没有产出报告；本次是全新 session，不要读取或续接任何旧日志、旧报告、`research/customer-question-corpus/review/`、`research/codex-findings/`、其他 `prompts/` 或过程记录。

## 审查对象

- `research/customer-question-corpus/README.md`
- `research/customer-question-corpus/00-能力边界.md`
- `research/customer-question-corpus/01-设计与分布.md`
- `research/customer-question-corpus/02-覆盖索引.md`
- `research/customer-question-corpus/questions/*.md`
- `research/customer-question-corpus/contexts/**`
- `research/customer-question-corpus/rebuild.mjs`
- `research/customer-question-corpus/validate.mjs`
- 必要的能力真相源：根 `README.md`、`HANDOFF.md`、`docs/02-product-definition.md`、`docs/04-key-mechanisms.md`、`docs/05-roadmap.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`

## 用户验收目标

恰好 600 个不同的潜在客户生产力场景，包含生活生产力、排除娱乐；问题自然且目的真实；H/M/L 大致反映目标人群在 12 个月内主动提出该类需求的相对可能性；覆盖 C/D/H/R/K/S、工具、人物、组织和生命周期；需要上下文或 RAG 的问题有足以支撑关键 claim 的合成材料；标签不夸大 SayDo 当前能力，也不低标副作用。

目录定位是场景层，不要求完整 transcript 或自动评测 oracle。

## 必查项

1. 运行 `node research/customer-question-corpus/validate.mjs`，记录退出码；程序化遍历 600 条和 179,700 对近重复，但不要逐文件打印整份正文。
2. 检查 H/M/L 是否存在明显同域倒挂；检查自然口语是否过度像预写 oracle；人工复核最高近重复候选。
3. 攻击明显的 C/D/H/R/K/S/F/B 错标，重点是 LIVE 与 K0、真实外部 effect 与 S0/S1、F1 是否依赖未验证 connector。
4. 程序化遍历全部 CTX 引用和 manifest/source 闭合；对 CTX-only 边逐条核对必要 claim，LIVE/USER 能补足的要区分说明。
5. 检查工具遗漏、强塞与词面误判；检查 F4、S3、授权边界及 SayDo hard rules。
6. 检查领域、人群、生活、非娱乐和生命周期是否实质覆盖。

## 时间与输出纪律

总时限 15 分钟。优先在 10 分钟内结束检查并写结论，不要为了附加统计拖延报告。最终报告控制在 220 行以内，直接写入命令指定的输出文件。

先给 `通过`、`有条件通过` 或 `不通过`。随后按 A/B/C 列具体文件、ID/行号、证据、影响和最小修复。最后给通过项、覆盖盲区、validator 假绿面和“必须修后才可收口”清单。若某级无问题写“无”，不要虚构。
