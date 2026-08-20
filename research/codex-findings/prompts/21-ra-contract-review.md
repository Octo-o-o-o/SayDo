# R-A 合同轮独立 Codex 复核

你是只读的对抗性评审员。请审查仓库：

- canonical 设计文档：`/Users/wangyixiao/WorkSpace/voice-coding/docs/01–11`
- 实施仓（只读参照）：`/Users/wangyixiao/WorkSpace/SayDo`，以 `HANDOFF.md`、`e2e/evidence/`、实际 contracts/daemon 代码为现状真相。

本轮变更（2026-07-26）：

1. S3 屏幕审批卡：WebAuthn platform authenticator；`docs/04 §5.1`、`docs/09 §3.3/§13/§9`、`docs/11 §5.4–5.5`。
2. writing 窄版：worktree 交付；`docs/09 §6.1a`、`§13 content_done`、`§11 enabled_project_types`、`docs/02 §5.0`、`docs/05` 分期。
3. 场次①补丁：`readinessSkeleton` 空账本 fail-closed、`proposed` TTL/supersede、桌面采集与输入区、step_confirm deferred、tailnet S2 口径等。

请重点回答：

- WebAuthn challenge/credential schema 是否能防重放、克隆、origin/rpId 混淆、远程 tailnet S3、单次消费与 signCount 回退；`requestManualMerge` 是否成为永久弱旁路；无 S3 receipt 是否被状态机/DDL/工具机械阻断。
- 空账本规则是否真实堵住生产漏洞，是否与 Quick 车道/Brain instructions 同源冲突或矫枉过正。
- writing 与 `04 §6` “非 coding 无 merging”是否冲突；WritingSettleProof、Tier1SettleProof、tasks/DDL/validator/test 是否完备。
- 新 schema 是否有 DDL/迁移/§12 测试落点；proposed TTL 与 digest 排除 expiresAt 是否自洽。
- `enabled_project_types` 开 writing 与实施仓未实现的中间态；HANDOFF 红线是否被突破。

只读核验，绝不修改 canonical 或实施代码。输出简体中文，按“一句话结论 → A 级硬伤（修法）→ B 级 → C 级 → 免修确认”组织，并给出实际 `file:line` 证据。将结果写入：
`/Users/wangyixiao/WorkSpace/voice-coding/research/codex-findings/21-ra-codex-review.md`
