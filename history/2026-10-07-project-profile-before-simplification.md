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

2026-10-07 起以根 package.json 的现役命令为准；旧批卡中的 truth-plane、RF-00 库存、迁移冻结、排产指针、gate parity 和固定宣传句检查退役，历史结果不升级。

- `just ci`：Node/Python 日常基线。
- `pnpm test:tools`：保留工具变更的专项自测。
- `pnpm test:release`：安装、发布与证据工具专项回归。
- `pnpm exec playwright test`：真实浏览器行为。
- `just precommit`：emoji、活跃文档链接、工作区隐私扫描（已有本地私有探针一并使用）。
- `git diff --check`：改动卫生。

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

## 本批具名例外:VOICE-MEASURE-01 / CODEX-AS-SPIKE-01(2026-09-23)

上面的 `roles_runtime` 与 `pinned_policy_revision` 仍是历史通用默认,本节省不改它们,也不把缺失的 `~/.octoworkflow/v2-policy.json` 当成现存文件使用。旧任务额度与冻结配置不迁移。

只对 `VOICE-MEASURE-01` 和现役施工的 `CODEX-AS-SPIKE-01` 适用 owner 2026-09-23 采纳的 v3 来源。2026-09-23「确认，请你继续实施」只把该原型推进到未装配生产的施工,不改本段角色、limits 或旧任务额度。`~/.octoworkflow/policy.json` 的 SHA-256 是 `788c2f591856fdbd3099171edfe973cfa99b64b41c52fafc9b0fc9dc372456f4`(`schema_version=1`,`workflow=v3`)。`~/.octoworkflow/roles.override.json` 的 SHA-256 是 `67cda8dbc8ed84a5bb75af4d22711e5720fe0490f65335d19c37b22fbabe97fa`。实施为 Grok `grok-4.7` / `xhigh`,独立只读 review 为 Codex `gpt-6-astra` / `medium`。limits 以该 policy 的 `limits` 对象为准。细节与批范围见 `docs/plan/2026-09-23-voice-measure-app-server.md`。

## 历史任务窗口说明（2026-10-03 整合保全）

以下 2026-09-23 至 2026-09-27 记录来自旧候选冻结快照，保留当时 RED、角色与已消耗额度；“当前”“本次”“进行中”等词只指原时点，不构成新调用额度或本轮授权。后续任务不得据此重新开旧窗口。

## 续接附录:PG-02(2026-09-23)

本附录只覆盖 PG-02 续接。上一节的 VOICE-MEASURE-01 / CODEX-AS-SPIKE-01 例外原文不改。`roles_runtime`、`pinned_policy_revision` 与 `~/.octoworkflow/policy.json` 不改。旧 PG-02 任务账不因本附录清零。

owner 2026-09-23 确认:保留旧账,迁移到当前有效配置,追加最多 3 次修复和 3 次复审。任务目录 `~/.codex/tasks/saydo-pg02-resumption-20260923/policy.frozen.json` 与 `roles.override.frozen.json` 跟上面两个 SHA-256 字节相同(policy 4484 字节)。当前角色是实施 Grok `grok-4.7` / `xhigh`,只读评审 Codex `gpt-6-astra` / `medium`。2026-09-06 执行卡里的 Grok `grok-4.6` / Codex `gpt-5.6-sol` 不是这次续接的角色。

追加窗口的用法:合同迁移准备占修复 1/3;合同通过后的实现占修复 2/3;保留修复 3/3。canonical 一致性的两个独立视角占评审 1/3 与 2/3;实现之后的独立产品评审占评审 3/3。合同评审未通过时不得开始实现。没有 commit、merge、push、部署或真实付费探针授权。

owner 同日后续授权:「按你的建议继续实施,追加 5 次以内都不需要和我确认」。这是另一个窗口,合计最多 5 次实施或复审调用,不替换、不抵销上面的 3 次修复和 3 次复审。旧 RED、误绿和消耗不清零。角色仍是实施 Grok `grok-4.7` / `xhigh`,只读评审 Codex `gpt-6-astra` / `medium`。`~/.octoworkflow/policy.json` 与 `roles.override.json` 不改。新窗口第 1 次是合同复审 `contract-review-4`,结论 RED。新窗口第 2 次只补合同。合同复审尚未 GREEN 时不得开始实现。将来本窗口内的合同复审 GREEN 之后,剩余次数可以用于原本已授权的 PG-02 实现和必要测试。没有 commit、merge、push、部署或真实付费探针授权。

2026-09-24 新授权:按建议继续实施,再追加最多 5 次实施或复审,不逐次确认。本次是该窗口的产品实施 1/5。`contract-review-6` 已对 HEAD `7a90e614a220e088d342d9d748c2a778bf936df5` + git-diff-v1 `680997c5596ec5e17d2c2ce77d167b8fdbd3dced163429e8204305330226dc22` 独立合同 GREEN。续接修复累计 6,独立 review 累计仍是 6。旧产品 RED 不清零。上面各段里「合同未 GREEN 不得实现」「schema、ledger、checker 未写」是当时冻结原文,保留,不再阻挡这一次已授权的实现。本次候选未 commit,产品实施未独立验收,不是产品 GREEN。不改 `roles_runtime`、`pinned_policy_revision` 或 `~/.octoworkflow/policy.json`。没有 commit、merge、push、部署或真实付费探针授权。

## 2026-09-27 整合授权:最近两周双向审计（历史快照）

owner 本次要求当前宿主完成本地整合、文档与 commit 双向核查和可裁决修复，实施后调用一名 subagent 交叉 review，通过后提交到 GitHub 并清理已合入的本地工作区。对于唯一未合入的 PG-02 RED 候选，owner 另回复“授权继续，修复并验收后合入”：保留旧修复 8 次 / 复审 8 次，最多追加 3 次修复和 3 次同一 subagent 复审。该授权覆盖本次提交、main 合并与私有归档 push，不包含公开快照、版本发布、官网部署或真实服务验收。

本次由当前宿主实施，固定候选后由同一名零上下文 subagent 进行合同一致性与产品交叉核验；核验必须包含合同→实现和实现→合同两个视角。上文 2026-09-23/24 的角色、无提交授权等段落保留为历史账，不用于撤销本次明确授权，也不重置旧 RED。全局 policy 不改。当前第 1 次追加修复进行中、复审 0；账目在本次宿主任务记录中，候选尚未验收。

2026-09-27 owner 后续回复“均同意”:SC-51 保留旧两次 RED,另追加一次修复并纳入本次最终同一 reviewer;PG-02 在原追加3/3预算内,允许为实际动作补具名服务/DAO有限证明。不得改成通用全程序调用图,不增加 reviewer 数或重置旧账。

## 本任务具名例外:saydo-modular-foundation-20260929 / RF-00～RF-11 链(2026-09-29)

上面的 `roles_runtime` 与 `pinned_policy_revision` 仍是历史通用默认,本节省不改它们。`~/.octoworkflow/v2-policy.json` 已核实不存在(ls: No such file or directory),不把缺失文件当现存配置使用;不创建假 v2 文件,不改全局配置,不迁移旧任务预算。

只对任务 `saydo-modular-foundation-20260929`(执行授权 `docs/plan/IMPL-PROMPT-2026-09-29-modular-foundation.md`)适用现行 `~/.octoworkflow/policy.json` 与 overlay 快照:policy.json SHA-256 为 `b9feb5a71070cccf11a03d4c4690ff1aa7d4890bebe301fe8fa93673aa692180`,roles.override.json SHA-256 为 `0475688daefc6d44df96df92aa18e76e6bbee05dba4434af26b2b9eb54d6a1eb`(2026-09-29 本机实测,与上节 2026-09-23 快照值不同属预期——两节各记各时点)。角色与限额以宿主冻结 `~/.codex/tasks/saydo-modular-foundation-20260929/task.json` 为准:implementation = devin `swe-2-max`,review = codex `gpt-6-astra`/`medium`,supervisor = codex `gpt-6-astra`;`effective_limits` 为该 task.json 内限值(reviewers_per_candidate=1、max_repair_rounds=8、max_rereview_rounds=15、max_same_root_cause_repairs=2、max_procedure_retries=2、max_same_procedure_cause_retries=1),只在初始化本任务账本时生效,不回改在途旧任务限额。required gate 与 owner checkpoint 继续有效;本例外仅取消本范围内日常推进的重复询问。
