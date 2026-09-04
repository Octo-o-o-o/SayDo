# SayDo 项目接入契约

按 OctoWorkFlow 项目模板十个字段填写。这是文档契约,不执行 shell,不重写宿主设置。

```project-profile-fields
[
  "risk_path",
  "acceptance_entry",
  "focused_gates",
  "full_gate",
  "ci_mode",
  "owner_checkpoints",
  "roles_runtime",
  "pinned_policy_revision",
  "cycle_control_path",
  "cycle_state_path"
]
```

## risk_path

本仓 L3 / 领域红线(不因流程收敛放宽):

- Gate 0 无 bypass:`Gate 0 未关 => 拒 dispatch`
- S3 语音绝不放行
- TTS 脱敏:token / secret / 完整路径不进语音
- 记忆写路径 candidate→trusted,M0 拒第三方
- 审计不可变;敏感 payload 只记 digest
- 公开快照隐私:写入端脱敏,stage 前 fail-closed
- 发布合同:tag / SemVer / 安装入口 / availability 不得假绿
- DDL 迁移铁律:生产迁移前可恢复点,不做未验证逆向 DDL

分级方法见 OctoWorkFlow `risk-tiers.md`;L 只改 review scope / coverage matrix / owner checkpoint,不改 reviewer 数量。

## acceptance_entry

阶段验收合同 = 当前任务 IMPL-PROMPT §3 分阶段表。IMPL-PROMPT 由 supervisor 生成;review-manifest 由零上下文 reviewer 产出,supervisor 经 `python3 ~/.octoworkflow/validate_review_manifest.py` 消费。本仓排产源仍是 `docs/plan/IMPLEMENTATION-PLAN-2.md`。

## focused_gates

迭代期受影响门禁以 `docs/plan/IMPLEMENTATION-PLAN-2.md` 当前批卡的 `FG-*` argv 为准。现役 ID:

- `FG-PROC01-P1` … `FG-PROC01-P5`
- `FG-PG01A-CLAIM`
- `FG-PG01B-RUNTIME`
- `FG-PG02-BOOTSTRAP`
- `FG-PG03-CONTROL`
- `FG-PG04-AUDIT`
- `FG-PG05-DB`
- `FG-PG06-ADMISSION`

当前仓内已存在、可被 `ls` / `grep` 核到的共享入口:

- `bash scripts/check-emoji.sh`
- `node scripts/check-doc-links.mjs`
- `git diff --check`
- `node scripts/schedule-pointer.mjs --check`
- `node scripts/check-active-claims.mjs`
- `node scripts/check-public-tree-privacy.mjs`
- `just ci`
- `pnpm exec playwright test`

批卡里标 `[new]` 的脚本由对应 PG 批落地前不得当现役门禁调用。

## full_gate

本地必须覆盖:`just ci`;`pnpm exec playwright test`。远端覆盖只有公开快照仓 CI。私有归档 CI 停摆期间标 `LOCAL_GREEN_REMOTE_PENDING`,不得用本地绿掩盖远端产品 RED。

## ci_mode

`local_first`。远端信号 = 公开快照仓 CI。无 GitHub CI 不是本地失败。私有归档 CI 因账户付款/额度停摆时标 `LOCAL_GREEN_REMOTE_PENDING`。

## owner_checkpoints

必须停下等 owner:

- rc bump / 发布
- npm publish
- 官网部署
- 公开快照
- 常驻 runtime deploy
- 真人场次

普通 focused 失败不是 checkpoint。

## roles_runtime

角色与预算以 `~/.octoworkflow/v2-policy.json` 为准。本仓 runtime = 本机 Node 22 + Python 管线;不在此探测或改写 `~/.codex/config.toml` / `~/.claude/settings.json`。

## pinned_policy_revision

`2.4.2`

## cycle_control_path

`docs/plan/<task>/`

内含 `policy.frozen.json` 与 `control.json`。不要把私有证据自动提交。

## cycle_state_path

`docs/plan/<task>-cycle.json`

用 `cycle_state.py` 演进,不要手改六个计数。

## 项目附加节:报告约定

模板尚无 `report_conventions` 字段;下列约定先写在本附加节,待模板字段落地后迁入。

- 状态词:`[ok]` / `[warn]` / `[fail]` / `[divergent]`
- 对抗评审落 `research/codex-findings/`
- readback 落 `docs/review/`
- 命名:`YYYY-MM-DD-<slug>[-review|-repair|-retry].md`
