# 95 · AI 供给普适接入最终方案对抗评审

你是零上下文、只读的对抗评审者。请审查：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`

并按需对照以下当前真相源和实现：

- `AGENTS.md`
- `docs/07-tech-stack-decisions.md` D18
- `docs/09-data-contracts.md` §11
- `docs/10-voice-ux-spec.md`
- `docs/11-ui-spec.md`
- `docs/plan/README.md`
- `docs/plan/IMPLEMENTATION-PLAN-2.md`
- `packages/contracts/src/types/modelbinding.ts`
- `packages/daemon/src/config/cliCapability.ts`
- `packages/daemon/src/config/family.ts`
- `packages/daemon/src/providers/openaiCompat.ts`
- `packages/daemon/src/api/setup.ts`
- `packages/console/src/lib/setupApi.ts`
- `packages/console/src/lib/resourcePlans.ts`
- `packages/console/src/components/SetupWizard.tsx`
- `packages/console/src/components/SupplyPicker.tsx`

目标不是润色，而是尽力证明方案不能安全、合规、可执行地实现以下承诺：用户已有的常见 CLI、获授权订阅、官方/三方 API、本地模型与桥接工具能被自动发现并尽量一键接入；主动配置和被动提示都友好；不得误投 secret、越权复用订阅或静默切付费。

重点攻击面：

1. 方案是否误把 Inference Supply 与 Execution Agent 混用，或遗漏 Gate 0/S1–S3 边界。
2. endpoint identity、SecretRef、SSRF/DNS rebinding/redirect/LAN、credential inheritance 是否仍有漏洞。
3. Chat、Responses、Messages、Gemini/云 IAM 的合同是否足以承载 streaming、tools、structured output、reasoning、usage 和 observed model。
4. rights/entitlement/billing 是否能处理 Coding Plan allowlist、消费订阅限制、自动超额、条款变化和分发形态。
5. 自动发现是否会产生费用、泄露数据、卡住首启、误识别服务或读取第三方 token。
6. 推荐器、fallback 与 evaluator 独立性是否有绕过；默认体验是否真的少配置。
7. 中国大陆、全球、云、本地、CLI、OpenCode、CC Switch 的覆盖与分级是否有关键遗漏或过度承诺。
8. Phase 顺序、验收目标、测试命令、迁移和回滚是否足以让施工方判定完成，是否与当前唯一排产源/dirty worktree 冲突。
9. 文档内部是否有顺序、数字、状态或术语矛盾。

输出要求：

- 先给最终 verdict：`PASS`、`PASS WITH FIXES` 或 `FAIL`。
- 发现按 A/B/C 分级；A=开工前必修，B=应修，C=可选。
- 每条包含：方案章节或文件行、问题、能复现的反例、最小修复建议。
- 区分“代码当前尚未实现”（方案本就要解决）与“方案本身遗漏/不可验收”，不要把前者误报成方案缺陷。
- 如果无 A 级问题，明确写“无 A 级问题”。
- 不修改任何文件，不执行外部写操作，不编造测试结果或官方条款。
