# Codex 23:A3-armed 设计方案评审(就绪门证据绑定语义)

你是独立评审员。评审对象:`research/2026-07-28-a3-armed-design.md`(A3-armed 设计方案 v1.0)。

## 背景

- 项目:SayDo 语音编排系统。canonical 设计文档在 `docs/`(09=数据契约、02=产品、04=关键机制、10=话术)。
- 实施仓在 `~/WorkSpace/SayDo`(可读:`packages/contracts/src/readiness.ts`、`packages/daemon/src/evaluator/readinessGate.ts`、`packages/daemon/src/live/liveTools.ts`、`packages/daemon/src/memory/`)。
- 前情:W4 已实施 readinessSkeleton 机制链(单源骨架/fail-closed/readinessRef 拍板门),但 evidence.covered 判定语义是 canonical 留白,生产未 armed。你的前任(Codex 22 报告 `research/codex-findings/22-*.md` §7.1-2)把 A3-armed 列为 A 级关闭条件:①covered 确定性映射+证据版本/撤销语义;②生产强制注入 provider,未注入/出错也 gap_critical;③会话建立第三消费点(已实施);④删除 ready,dims:[] 回退;⑤生产路径反例。
- owner 首日 dogfood 真实复现"零采访出包 + 编造调研内容"。

## 你的任务

对方案做防御性评审,重点:

1. **设计漏洞**:显式绑定(remember 带 readinessKey + 三闸)能否被绕过?Brain 有没有办法在用户没给信息时把 critical key 刷成 covered?(注意三闸:词表/source.kind=user_utterance/trust 人背书;深评抽查兜底)
2. **撤销传导完备性**:forget/generation 失效 → key 回 unknown → 已 proposed 包被拍板门拦——这条链有没有缝(如 dispatch 后才 forget、拍板与 forget 并发)?
3. **armed 收口破坏面**:删 null 旁路 + 删 ready,dims:[] 回退,对既有生产路径(coding 项目现有流程)和测试的影响是否被低估?
4. **与 Codex 22 五条关闭条件逐条对照**:方案是否全覆盖?
5. **开放点 1-4**(方案 §6):给出你的裁决建议。
6. **canonical 落文风险**:§2 变更清单有没有漏改的文件/节(如 06 术语表、§12 测试清单编号)?

## 输出要求

写报告到 `research/codex-findings/23-a3-armed-design-review.md`,结构:结论(方案可行/需修) / A 级硬伤(必修,逐条:问题-证据-修法) / B 级(应修) / C 级(可选) / 开放点裁决 / 关闭条件对照表。全部简体中文。只写报告,不改任何其他文件。
