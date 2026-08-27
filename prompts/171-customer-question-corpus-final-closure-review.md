# SayDo 600 条生产力提问语料 · 最终收口对抗审查

你是与语料设计、实施、修复和既往评审零上下文隔离的只读审查者。不要读取 `research/customer-question-corpus/review/`、`research/codex-findings/`、其他 `prompts/`、`history/`、`logs/` 或 Git diff；不要继承任何旧结论。

## 审查对象

- `research/customer-question-corpus/README.md`
- `research/customer-question-corpus/00-能力边界.md`
- `research/customer-question-corpus/01-设计与分布.md`
- `research/customer-question-corpus/02-覆盖索引.md`
- `research/customer-question-corpus/03-频率与语义校准.md`
- `research/customer-question-corpus/questions/*.md`
- `research/customer-question-corpus/contexts/**`
- `research/customer-question-corpus/rebuild.mjs`
- `research/customer-question-corpus/validate.mjs`
- 必要的能力真相源：根 `README.md`、`HANDOFF.md`、`docs/02-product-definition.md`、`docs/04-key-mechanisms.md`、`docs/05-roadmap.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`

## 用户验收目标

恰好 600 个不同的潜在客户生产力场景，包含生活生产力、排除娱乐；问题自然且目的真实；H/M/L 大致反映合格目标人群在未来 12 个月主动提出该类需求的相对可能性；覆盖复杂度、首个可审阅结果时延、现实周期、轮次、工具深度、风险、人物、组织与生命周期；需要上下文或 RAG 的问题具有能支撑关键 claim 的合成材料；标签不夸大 SayDo 当前能力，也不低标现实副作用。

目录定位是场景层素材，不要求完整 transcript 或自动评测 oracle，H/M/L 也不是实测市场概率。

## 必查项

1. 运行 `node research/customer-question-corpus/validate.mjs` 并记录退出码；独立程序化遍历全部 600 条、12 个领域和 179,700 对问题，不要用抽样替代全量构成结论。
2. 检查 H/M/L 的领域内语义顺序及高低频锚点，重点寻找“罕见战略题高于日常题”的倒挂；检查频率是否又被 C/R/K 机械决定。
3. 检查自然口语、同构场景、跨领域重复和预写 oracle 腔；人工核对最高相似候选。
4. 逐条攻击 C/D/H/R/K/S/F/B，重点检查 LIVE 与 K0、真实外部 effect 与 S0/S1、敏感读取与 S0、F1 依赖条件 connector、F4 和专业边界。
5. 程序化遍历全部 CTX 引用、16 个 manifest、全部来源和 required claims；对每条 CTX-only 边核对关键事实，对 CTX+USER/LIVE 分清 fixture 与补充输入。
6. 检查工具遗漏、强塞和词面误判，以及领域、人群、组织规模、50 条生活生产力、非娱乐边界和任务生命周期覆盖。
7. 审查构建与验证是否 fail-closed，至少在临时副本上做几项 mutation test；不得修改正式语料。

## 输出纪律

总时限 15 分钟，优先在 10 分钟内完成检查并写结论。报告控制在 220 行内，直接写入命令指定的输出文件。

先给 `通过`、`有条件通过` 或 `不通过`。随后按 A/B/C 列具体文件、ID/行号、证据、影响和最小修复；若某级无问题写“无”。最后给通过项、覆盖盲区、validator 仍可能假绿的范围，以及“必须修后才可收口”清单。不要虚构命令输出、市场事实或当前能力。
