# AI 供给方案最终门复核

你是零上下文、只读、对抗性评审者。不要修改任何文件，不要启动 subagent，不要做网络检索。

主输入：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- `research/codex-findings/97-ai-supply-universal-onboarding-final-closure-review.md`

只复核 Codex 97 的两个 A 级问题是否被机械关闭，并检查这些回修是否引入新的 A 级合同矛盾。不要重新做生态调研，不要评价代码尚未实施，不要把 owner 已被明确上浮的六项决策或排产开工门本身判为缺口。

逐项攻击：

1. canonical 一致性门：方案是否要求在 `docs/08-module-design.md`、`docs/07-tech-stack-decisions.md` D8、`docs/09-data-contracts.md`、`docs/modules/c-control-bridge.md` C2/C5 写入同一机器可读投影；字段是否足以判定 placement、connection kind、dispatch Gate、逐工具 Gate、unknown-event 行为、proof owner、state owner 与 schema anchor；是否有专用脚本解析并逐字段/anchor 对账，而非关键词或普通链接检查；是否有隔离自测分别只漂移五处任一文件，并覆盖 undecided、缺字段、重复 marker、错 anchor、不存在 section；Phase 0 的真实门禁命令是否明确执行该自测和脚本。
2. 跨计费单位预算：CandidateBilling、ConformanceAuthorization、RuntimeSpendAuthorization、持久预算和 ledger 是否统一使用 canonical per-billing-unit vector；canonical unit、整数金额、唯一排序、非法值和溢出是否可判定；动态 RouteSet 是否对每个单位分别计算最坏 invocation sequence 总和；缺失分量是否只有在明确证明不会以该单位收费时才能视为零；reserve/sent/settled/charge_unknown/调和是否逐单位且禁止跨币种或 provider credits 净额化；首版是否明确禁止隐式 FX；界面是否逐单位展示；是否有 `A=CNY 1.00 sent→timeout，B=USD 1.00 success` 的 ingress 前向量预留与账本 fixture，以及未知单位、重复单位、舍入和溢出反例。

输出规则：

- 两项都已关闭且无回修引入的新 A 级时，第一行严格输出 `PASS`，随后用不超过 12 条简短证据说明关闭点。
- 只要仍有 A 级，第一行严格输出 `FAIL`，只列可复现的 A 级问题；每项给位置、反例、最小修复。
- 不列 B/C 级建议，不重写方案，不评论代码实施完成度。
