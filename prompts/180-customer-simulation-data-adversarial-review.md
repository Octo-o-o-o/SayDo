# 任务：72 组模拟用户会话的一次性对抗终审

你是与实现过程零上下文的只读评审者。仓库位于 `~/WorkSpace/SayDo`。

评审对象：

- `research/customer-question-corpus/simulations/00-simulation-plan.md`
- `research/customer-question-corpus/simulations/01-schema.md`
- `research/customer-question-corpus/simulations/02-coverage.md`
- `research/customer-question-corpus/simulations/README.md`
- `research/customer-question-corpus/simulations/simulation-spec.mjs`
- `research/customer-question-corpus/simulations/rebuild-simulations.mjs`
- `research/customer-question-corpus/simulations/validate-simulations.mjs`
- `research/customer-question-corpus/simulations/sessions/*.md`
- `research/customer-question-corpus/simulations/fixtures/*.md`

背景与验收尺度：

- 上游 600 条主问题已经冻结。本轮新增 72 组代表性多轮模拟，用于访谈演练、对话设计、提示词回放和人工评测。
- 这不是生产 connector 合同、真实用户日志或能力证明。不要因为 mock payload 不够接近真实 API schema、locator 不能真实执行、措辞可继续润色而判 A。
- 用户明确要求适当放松标准并停止无限复审。只有会破坏模拟用途的硬问题判 A；B/C 记录即可，不阻塞交付。

请完整检查 72 个会话，不得用少量抽样推断整体。可以用脚本辅助。重点找：

1. 数量、领域、H/M/L、source ID 与标签映射是否真实一致；
2. 每组至少三轮且后续轮有实质补充、纠正、改约束、确认、拒绝或恢复，而非只换措辞；
3. 72 组是否覆盖不同生产力与生活场景、复杂度、周期和工具组合，是否存在大面积模板复刻；
4. CTX、USER、LIVE 的事实归因是否越界，RAG 冲突/时效是否 fail-closed；
5. 全部 S3/F4 是否只预览、挑战、拒绝或安全降级，是否伪造授权、发送、支付、部署、发布、删除或签署；
6. fixture 与会话能否对位，失败变体能否恢复，oracle 是否足以判定核心行为；
7. 构建器是否可重复，验证器是否有会放过明显 A 级问题的漏洞；
8. 是否遵守零 emoji，以及终态不把 `ready_for_review` 写成完成或交付。

分级：

- A：安全越界、事实/RAG 编造、数量或映射错误、会话并非实质多轮、fixture 无法对位、验证器虚绿、严重覆盖失真。A 阻塞。
- B：局部代表性、自然度、oracle 或 payload 可增强，但不破坏现有用途。B 不阻塞。
- C：措辞、导航、轻微文档体验。C 不阻塞。

请运行并记录真实证据：

```bash
node research/customer-question-corpus/simulations/validate-simulations.mjs
```

emoji 门禁需要把文件逐个传入，不能直接传目录。

最终只输出一份 Markdown 报告正文，结构至少包括：结论 `[pass]` 或 `[fail]`、A/B/C 数量、发现（带文件和行号或 SIM ID）、全量检查方法、门禁原始摘要、是否建议交付。不得修改仓库，不得使用 emoji，不得把 B/C 升成 A。
