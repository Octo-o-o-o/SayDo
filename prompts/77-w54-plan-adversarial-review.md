# 77 · W5.4 方案 v2(Claude Code CLI 作 Tier1 执行器)对抗评审

> 通道:review 链头 Codex `gpt-5.6-sol` 于 2026-08-20 01:29 实测配额耗尽(`You've hit your usage limit … try again at 11:29 AM`),按职能回落链改用 Grok `grok-4.6`+`xhigh` 只读会话执行;Codex 配额恢复后可再补一轮。

你是对抗性评审员,只读仓库 `~/WorkSpace/SayDo`(或其 clone)。被审对象:`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md`(方案 v2 全文)与 `docs/plan/IMPL-PROMPT-10-W54A-CLAUDE-CLI.md`(W5.4-a 实施 prompt)。目标:在开批前找出会导致返工或安全退化的问题。

必须对照的事实源:`packages/daemon/src/tier1/{executor,gate,gateScript,gateServer,adapter,approvalFlow,cmdEffect,validateConfig}.ts`、`packages/daemon/src/providers/byoa/{parsers,processFailure,billing,cage}.ts`、`packages/contracts/src/types/{task,modelbinding}.ts`、`docs/09-data-contracts.md` §11 `[tier1]` 段与规则 2/3、§12-9、`docs/04-key-mechanisms.md` §5/§6、`docs/03-architecture.md` §5、`docs/07-tech-stack-decisions.md` D8/D18、`docs/adr/design/ADR-001-execution-layer.md`、工程 ADR-002、`e2e/poc/tier1-live-executor/RESULT.md`、`e2e/evidence/cmdeffect-hardening.md`。

评审角度(找问题不给好评):
- A 级:安全退化(hook 超时落回 Claude 自身权限流被误当成门;`--settings` 内联 hooks 可被 worktree 内配置覆盖;文件工具圈判断绕过;`acceptEdits` 与 `*` matcher 的交互;凭据进 agent 环境;`--resume` 跨 cwd;订阅 ToS)、与 canonical 的硬冲突(09 `[tier1]` 键形状、DevAgentBinding 词表、cost_entries CHECK、状态机)、IMPL-PROMPT 里不可判定或互相矛盾的验收锚、方案 §1.2 实测结论被后续条款误用。
- B 级:实施顺序 / 拆批不合理、遗漏的 spike、纯函数边界不清、测试锚数量与覆盖面不匹配、与 cursor 后端抽取(B1-a)零行为变化承诺冲突的点。
- C 级:措辞与可维护性。

产出:按 A/B/C 分级的发现列表,每条含 文件:行、问题、证据、建议修法;末尾一段总评(能否开 W5.4-a;哪些必须先改)。用简体中文写,零 emoji,文本标记用 [ok]/[warn]/[fail]。把报告全文作为最终回复输出(调度方会落盘到 research/codex-findings/77-w54-plan-adversarial-review.md)。
