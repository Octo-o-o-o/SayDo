# SayDo 600 条潜在客户生产力提问语料 · 对抗性评审

你是与素材生成会话零上下文隔离的独立评审者。工作区为 SayDo 仓库；只读审查，不修改任何文件，不信任目录内自报的计数或结论。

## 审查对象

- `research/customer-question-corpus/README.md`
- `research/customer-question-corpus/00-能力边界.md`
- `research/customer-question-corpus/01-设计与分布.md`
- `research/customer-question-corpus/questions/*.md`
- `research/customer-question-corpus/contexts/**`
- `research/customer-question-corpus/validate.mjs`

必要时回读项目能力真相源：`README.md`、`HANDOFF.md`、`docs/01-vision-and-problem.md`、`docs/02-product-definition.md`、`docs/03-architecture.md`、`docs/04-key-mechanisms.md`、`docs/05-roadmap.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/plan/IMPLEMENTATION-PLAN-2.md`。

## 目标与验收

用户要求设计潜在客户在 600 个不同生产力情境中的自然提问与目的，按合理的可能性分布覆盖领域和场景，包含生活生产力但排除娱乐；每条要有复杂度、耗时周期、交互轮次、工具需求与风险等分档；需要上下文/RAG 的场景尽量附配套文件；完成后仔细 review，确保人物、场景、工具与能力边界覆盖全面。

请先独立运行结构门禁并读取真实输出，再做语义审查。不要只抽查最大的文件或每个文件头几条；至少程序化遍历全部 600 行，并对每个领域的 H/M/L 三段分别做语义检查。

重点攻击以下问题：

1. 恰好 600 条是否真实成立；ID、概率配额、字段、工具深度和 RAG 引用是否可机械复核；
2. 600 条是否真是不同情境，还是同一动作换角色、换名词的模板化扩写；
3. H/M/L 及领域权重是否有清楚、诚实、合理的依据，是否把启发式先验冒充市场统计；
4. C/D/R/K/S/F 标签是否与题面语义相符，是否系统性高估或低估复杂度、工具数和风险；
5. `F1`–`F4` 是否符合 SayDo 当前实现、条件能力、路线图和非目标，尤其外部 connector、长时 workflow、mobile、research/marketing/planning、S3、医疗/法律/金融；
6. 角色、人群、组织规模、职业层级、项目生命周期、新项目/续接/状态/改需求/验收/失败恢复是否有盲区；
7. 生活场景是否足够生产力导向、非娱乐，且不是职业场景简单换皮；
8. 工具族是否覆盖本地 repo、文件、shell/test/git、Web/PDF/RAG、文档/表格/演示、邮箱/日历/任务/CRM、数据/BI/财务、移动/通知/自动化等，同时没有为了凑 K 档硬塞工具；
9. 16 个 RAG 包是否足以支撑被引用问题，manifest 的权威顺序、新鲜度、冲突与推断边界是否自洽，是否存在断链、错误复用或过度理想化；
10. 验证器是否存在可绕过的假绿，例如只识别特定表格格式、漏检重复、只设极低覆盖阈值或无法发现语义模板化；
11. 是否有违反 SayDo 状态词、安全、零 emoji、记忆来源和“就绪不等于授权”等 hard rule 的问题设计；
12. 交付是否真正适合后续产品研究与评测，而非只有阅读价值。

## 输出格式

将最终报告直接写入命令指定的输出文件。先给总判定：`通过`、`有条件通过` 或 `不通过`。随后按严重度列：

- A：会让语料数量、核心覆盖、能力真相、安全或可用性结论失真的阻断问题；
- B：显著削弱代表性、自然度、分档可信度或 RAG 质量的问题；
- C：可选改进。

每条发现必须包含具体文件和 ID/行号、真实证据、影响和最小修复建议。最后给覆盖盲区矩阵、建议门禁增量和“必须修后才可收口”的清单。若未发现某级问题，明确写“无”，不要为了凑数虚构。
