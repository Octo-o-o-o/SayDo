# AI 供给普适接入最终方案闭环对抗评审

你是零上下文、只读的最终评审者。请完整阅读：

1. `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
2. `research/codex-findings/95-ai-supply-universal-onboarding-adversarial-review.md`
3. `AGENTS.md`
4. 方案引用的 canonical、当前排产/HANDOFF 与关键实现文件

目标不是检查代码是否已经实现，而是判断修订后的**实施方案本身**是否已经可判定、可排期、可安全施工。逐项核对上一份报告 A-1 至 A-13 是否已被合同、机械验收或明确 owner 硬阻断关闭，并寻找新的 A 级问题。

特别攻击：

- inference/Execution Agent 判别联合是否仍允许非法组合；
- route/slot/operation、auth principal、resource scope、policy receipt 是否可缺失或宽泛兜底；
- endpoint/secret/adapter/receipt/activation 的绑定、CAS、降级与 hard-stop；
- 自动发现是否会执行投毒程序、打开历史或越过费用/网络预算；
- rights、billing、SpendAuthorization、data boundary、gateway/CC Switch failover 是否能在调用前判定；
- 旧 CLI inference 迁移、Gate 0 与逐工具 gate 是否仍有绕过；
- Phase 依赖、planned gate 和唯一排产坐标是否存在循环；
- Gemini/Antigravity、Kimi、GLM/百炼/百度/腾讯套餐、CC Switch Desktop/CLI fork 等当前事实是否被错误合并。

输出规则：

- 第一行只写 `PASS` 或 `FAIL`。
- `PASS` 只表示“方案无未处置 A 级，可以进入 owner 审批”；不表示代码已经支持这些生态，也不表示当前允许开工。
- 若 `FAIL`，只列 A 级，每项给出精确段落、可复现反例和最小修复；不要用 B/C 噪声阻止收口。
- 若 `PASS`，列出上一轮 A-1 至 A-13 的关闭映射，并明确仍需 owner 解除的阻断。
- 不修改任何文件，不运行真实 provider 请求，不执行破坏性命令。
