# W5.4-b C1/C3 欠账清偿实施 Prompt

你是 SayDo 的独立实施会话。工作目录就是仓库施工分支。只实施，不做最终评审，不 commit、
不 push、不 deploy、不修改 live `~/.saydo` 配置，不使用 subagent 或 web。

## 必读

1. `AGENTS.md`
2. `docs/plan/2026-08-22-week-audit-faststart-release.fable.md` §3-B
3. `docs/plan/IMPL-PROMPT-15-W54B-WIRING.md` §0-§5，重点 C1/C3
4. `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` §3、§6
5. `docs/09-data-contracts.md` §11，`docs/10-voice-ux-spec.md`，`docs/11-ui-spec.md`
6. `e2e/evidence/w54b-batch.md` 当前欠账与评审 90-92 回修边界

## 当前真实基线

- 开工 HEAD `3fccf4a704ad9a5d8e013baaefb67c66a5737cba`。
- `just ci` 本会话刚通过：daemon 1791 passed / 5 skipped，console 264，contracts 103，
  cli 20 passed / 1 skipped，platform 12，pipeline 34。
- 现有 C1/C2 主体已实现；不要重构已通过评审的 gate/executor，也不要改既有测试期望来迁就实现。

## 任务 1：C1 init 物理断言

把 `IMPL-PROMPT-15` C1 明列但当前缺失的“一发一收 system/init 物理断言”落地到 Tier1 自检。

- 复用现有注入式 probe/self-test 架构；默认生产路径对 `claude_code` 发起有界、只读、单 turn
  `claude -p` 探针，只验证 init，不执行工具，不写项目，不持久化会话。
- 解析真实 stream-json `system/init`，验证版本/adapter、`apiKeySource=none`、模型族与预期身份；
  超时、非零退出、缺 init、身份不符、出现 API key 来源都 fail-closed，并给 setup 页可理解处方。
- 环境继续遵守订阅与 G4：不得传 `ANTHROPIC_*` 或 `CLAUDE_CODE_OAUTH_TOKEN`；只允许既有
  `DISABLE_AUTOUPDATER=1`、`SHELL=/bin/sh` 例外。
- 测试必须通过依赖注入使用 fake 进程/fixture；普通单测不得真实消耗 Claude 配额。
- 不把 live 冒烟或完整 conformance 偷换成本断言；它们仍归 W5.4-c。

## 任务 2：C3 console 与话术

按现有 UI 和 API 形状做最小聚焦实现：

- 设置/资源画像页增加 Tier1 卡：生效 backend、model、pinned/observed version、auth/self-test
  状态、最近五小时订阅运行观测。只展示现有 API 能真实提供的数据；缺字段先沿现有 setup/summary
  API 做最小扩展并补 schema/test，禁止前端 mock。
- 任务详情展示 adapter 与 observedModel；无值时如实显示未观测，不能猜。
- 为 `subscription_rate_limited`、`subscription_auth_required`/登录过期、binary identity drift、
  `max_turns`、文件工具 S2 增加人话。执行态仍不得说“完成/做完”。
- 把硬编码 Touch ID/批准指纹改为跨平台“本机认证”口径；只有平台能力明确时才可附具体机制。
- Claude backend prompt 增加“不要修改 `.claude/` 目录”的执行约定；cursor 行为不变。
- `docs/10`、`docs/11` 仅回写实际实现形状；不新增合同类型，不静默改 `docs/09`。

## 测试与交付

1. 先跑相关定向测试；新增/修改 console 单测，并补至少两条定向 Playwright 覆盖 Tier1 卡与
   task adapter/本机认证文案。若现有 e2e fixture 不足，做最小可复现 fixture，不连生产数据。
2. 跑 `pnpm typecheck`、`pnpm lint`、`pnpm --filter @saydo/daemon test -- tier1-self-test tier1-executor tier1-claude-backend`、
   `pnpm --filter @saydo/console test` 与新增 Playwright。
3. 更新 `e2e/evidence/w54b-batch.md` 的 C1/C3 状态，但不得先写“已收口”；最终独立评审未过前
   只能写“已实现并经本会话门禁，待独立评审”。
4. 最终回复列出改动文件、真实命令与退出码、测试计数、仍未做项。不要 commit。
