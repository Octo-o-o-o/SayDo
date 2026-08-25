# 任务:完整 review VoiceLoop 全新重写的文档集

你是一名严苛的文档评审员。VoiceLoop 项目刚把"逐步调研累积"的旧文档集,按标准结构全新重写为一套正式文档。请你完整 review 这套新文档,产出一份中文评审报告。

## 待评审文档(全部,按序读)

工作目录:`~/WorkSpace/voice-coding/`

1. `README.md`(入口)
2. `docs/01-vision-and-problem.md`(背景与问题)
3. `docs/02-product-definition.md`(产品定义)
4. `docs/03-architecture.md`(系统架构)
5. `docs/04-key-mechanisms.md`(关键机制)
6. `docs/05-roadmap.md`(落地与路线)
7. `docs/06-references.md`(参考资料)
8. 辅助导读:`research/README.md`、`history/README.md`、`archive/README.md`

## 对照材料(用于核实新文档是否忠实、有无遗漏)

- `history/voice-coding-framework.Cursor2.md`:旧主方案 v1.14(1100+ 行,新文档集的前身)。**重点核对:新文档是否丢失了 v1.14 中的关键设计与事实纠正**(尤其 §4.7 L3 认证、§4.8 隔夜两层 workflow、§4.9 steer、§17 Codex 结构性发现、附录 A 事实清单)。
- `research/` 下各调研报告:核对新文档引用它们的结论是否被忠实转述(competitive-scan、local-projects-borrowing-assessment、mobile-desktop-connectivity、open-source-stack、codex-findings/01-04 与 octodesk-mobile)。
- `history/scenarios/`:需求基线,核对 docs/02 是否覆盖三场景 + 三横切 + 设计哲学。

## 评审维度(逐项给结论)

1. **完整性**:相对 v1.14 与调研报告,新文档有没有丢失关键设计、关键事实纠正、关键风险?列出遗漏清单(标注来源位置)。
2. **正确性**:有没有与对照材料矛盾的表述、过时的说法、被 v1.14 已纠正却在新文档中复活的错误?
3. **内部一致性**:七个文件之间有没有互相矛盾(术语、数字、优先级、分期、状态)?交叉引用(如"见 03 §8")是否指向正确章节?相对路径链接是否有效?
4. **逻辑清晰度**:从 01 读到 06,叙事是否自洽、层次是否清楚、有没有前后依赖倒置?
5. **简洁与可读性**:有没有冗余重复、过程黑话(如轮次编号、版本号残留)、对新读者不可理解的指代?
6. **AI 可读性**:作为未来 AI 会话的上下文底座,这套文档是否结构化良好、易检索、无歧义?

## 输出要求

- 把完整评审报告写入 `~/WorkSpace/voice-coding/research/codex-findings/05-docs-review.md`(中文)。
- 报告结构:① 总评(一段话 + 是否达到"可交人工验证"标准);② 问题清单,按严重度分级:**A 硬伤**(事实错误/丢失关键内容/自相矛盾)、**B 应改**(逻辑/一致性/链接问题)、**C 建议**(表述优化)。每条问题给出:文件 + 章节位置、问题描述、修改建议。③ 遗漏对照表(v1.14 或调研报告中有、新文档没有且应该有的内容)。
- 区分【事实】(你核对过对照材料)与【judgement】(你的主观评审意见)。
- 不要修改任何文档,只写评审报告。
