# SayDo ECC 第一批（AS-01/AS-02：凭据拒写 + Git 保护 + 失败可见）实施合同

> **状态：范围修订，独立评审结果见本仓交付记录。本轮未实施产品代码。** 本文是未来任务的实施合同，本轮不启动。
> **上一版历史证据（不得误认为本修订范围已评审）：** R3 完整语义 GREEN；R4 复核 GREEN；十二项文档门禁 exit 0。那些结果验收的是修订前文档。

仅当用户在**新任务**中明确引用本文并授权实施时，才允许改产品代码。本文不是比较循环。方案 SoT：[2026-09-05-ecc-borrowing-final.md](2026-09-05-ecc-borrowing-final.md)。范围只覆盖第一批 AS-01/AS-02（含同批恢复），不含 `knowledgeShare` schema/UI，不等于自动执行 AS-03..07 或长期 deferred。

## 0. Workflow V2 contract（原样保留，不得被后文放宽）

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```
```roles
{"implementation":{"cli":"grok","model":"grok-4.6","provider":"xai","reasoning_effort":"xhigh"},"review":{"cli":"codex","model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"max"},"supervisor":{"model":"gpt-5.6-sol","provider":"openai","reasoning_effort":"xhigh"}}
```

**刷新规则：** 上列两块来自撰写时 `control/CONTRACT.md` / `python3 ~/.octoworkflow/validate_handoff.py --print-contract`。新 cycle 必须读取**当时** live `~/.octoworkflow/v2-policy.json`，再 `--print-contract` 生成唯一合同替换本节；活动 cycle 使用已冻结 `policy.frozen.json`，不盲用过期块覆盖政策。`policy_revision` 或 roles 与冻结/live 有效源不一致时停下来报告，不得手写合同、不得降模型/预算、不得把旧 prompt 的双 reviewer / 无限返工写回来。正文 `post_green_continue=preaccepted_next_stage_only` 与上列唯一块一致：用户明确启动本文即授权下列两个具体阶段；未授权长远候选不自动进来。

## 0A. 坐标核验（旧 SHA 只是历史证据；实质范围冲突才停）

撰写时 SHA / 指针是历史证据，不是「与下表字节全等否则停工」的冻结条件。启动后用本会话真实命令记录**当时** HEAD 与 `git-diff-v1` fingerprint，对照下表差异与前置。HEAD 相对撰写时前进是预期情况（尤其 PG-01B 合并后），不得仅因 SHA 不同就停。

先核：`git rev-parse HEAD`；`python3 ~/.octoworkflow/candidate_fingerprint.py`（算法 `git-diff-v1`）；读 PLAN-2 指针；确认 PG-01B 是否 `last_closed`；打开终稿 §3 与源码核 write set。

只有实质范围冲突才报告并停，例如：声明 write set 被无关改动侵占或与 `packages/daemon/src/net/**`（PG-01B roots）重叠；Gate 0 / S3 / trust 枚举 / blocked 原因被破坏；PLAN-2 出现无法按 D17 把本批插到「PG-01B 之后、PG-02 之前」的真实冲突。普通前进、指针仍停在 PG-01B、或 PG-01B 已合并而 HEAD 已变，都不是停工理由。

| 项 | 撰写时值（历史证据） | 核验命令 |
| --- | --- | --- |
| 基线 commit | `bcf8ea855f25b177888d9159f75e49214f3dd892` | `git rev-parse HEAD`；记录新 HEAD，对照差异与前置，不因前进自动停 |
| PLAN-2 指针 | `active=none` `next=PG-01B` | 读 `docs/plan/IMPLEMENTATION-PLAN-2.md` 顶部；需要时 `node scripts/schedule-pointer.mjs --check` |
| PG-01B scope | `packages/daemon/src/net/**`、`index.ts` | 读缺口治理总案 PG-01B 批卡 |
| AS-01 write set | `ledger.ts` `add`、`liveTools.ts` `remember`、`foundation.ts` excerpts 之后首次 staging 写之前（含 `.cursor/rules` 与 package scripts） | 打开终稿 §3 与源码 |
| `projectOverridesSchema` | 仅 `models`/`budget`；本批不得增共享字段 | `packages/daemon/src/config/projectOverrides.ts:18-33` |
| 安装器 | `deploy/saydo-octoooo-com/install.sh` 存在 | `test -f`；本批不改分发 |

**启动即采纳：** 用户在新任务明确引用并授权实施本文，即采纳第一批 AS-01/AS-02 及推荐顺序（同一 daemon 隐私小批，插在 PG-01B 之后、PG-02 之前），并授权下列两个预先接受阶段。本文撰写轮不向 PLAN-2 登记。

**前置闸：**

- PG-01B 未合并（`next` 仍为 `PG-01B` 且未 `last_closed`）：只做可审查准备（坐标核验、write set 冻结、覆盖矩阵草稿、未完成前置声明），**不改** `packages/daemon` / canonical / `schedule-pointer`，不动在建树，不谎称前置通过。
- PG-01B 已合并：supervisor 按 D17 把 AS-01/AS-02 登记到唯一排产源 `docs/plan/IMPLEMENTATION-PLAN-2.md`（推荐 `PG-01B` 之后、`PG-02` 之前）。**不再次要求 owner 先手动改指针。** 登记编辑属未来任务 supervisor 范围；commit / push 仍不得自动执行，除非该新任务用户当前消息明确要求。长期 deferred（AS-03..07、G-B12）不算自动施工。

## 1. 必读文档（阅读顺序）

1. [2026-09-05-ecc-borrowing-final.md](2026-09-05-ecc-borrowing-final.md) — 唯一方案 SoT：第一批正反例、失败/回滚、映射。
2. `AGENTS.md` — Gate 0、S3、记忆写路径、零 emoji、`just ci`。
3. `docs/09-data-contracts.md` §4/§5/§9/§11/§12/§13；`docs/03-architecture.md` 知识库 gitignore 句（既有手工共享约定，不是本批新开关）；`docs/04-key-mechanisms.md` §1.2；`docs/modules/b-memory.md` B3；`docs/10-voice-ux-spec.md` 处方话术段；`docs/11-ui-spec.md` 既有错误卡/项目详情（复用，不新增共享设置行）。
4. 源码：`packages/daemon/src/memory/{ledger,classify,foundation,compiler}.ts`、`brain/liveTools.ts` `remember`、`voice/redactor.ts`（只对照凭据子集，不整表搬）、`config/projectOverrides.ts`（本批保持仅 `models`/`budget`）、`projects/workspace.ts`、`packages/console/src/pages/ProjectSettings.tsx` 既有奠基/重试。
5. `docs/plan/IMPLEMENTATION-PLAN-2.md` 指针与链。
6. `~/.octoworkflow/cli-forms.md`、`supervised-delivery.md`、`risk-tiers.md`、`deferred-p2-ledger-template.md`、`cycle-state.md`。

不要再去比较 Fable/Astra/Codex 旧方案。旧文只是归档。

## 2. 红线摘要（违反即停）

1. 不把 ECC hooks/skills/rules 引入 SayDo 派出的 agent；不改 `--setting-sources ""` / `--strict-mcp-config` 护城河。
2. 不复制整张 TTS regex；不按泛长串 / `env:NAME` / digest / 路径 / 业务 ID 拦截。
3. `requestedTrust` / `user_stated` 不能绕过凭据检测。
4. foundation 命中：首次 raw staging 写之前终止本次新 generation 发布；不改旧 `status`/`current.json`；不能同时承诺 partial 发布和整次拒绝。
5. 不因凭据命中拒绝整个项目登记，不改用户原文件。
6. gitignore 是声明私有 write set 的语义验证，不是整个 `.saydo` 字节全等；不得借延期共享改成全目录一律封禁。
7. 本批不新增 `knowledgeShare` / DDL / 设置页 / `projectOverrides` 共享字段。`project.toml` 不得放松保护。不覆盖用户 ignore，不自动取消既有人工共享配置；不能把已有共享文件无条件当作安全豁免。
8. 失败只停本次写入或本次受影响私有投影；不自动 `git rm`、不清理历史、不删用户文件。
9. 错误信息、TTS 与审计不回显 secret 原文，只记 kind+digest。相对来源/行号仅作脱敏元数据给现有可视界面，不得把完整路径送 TTS。
10. 本批不改 Gate 0 / S3 / trust 枚举 / blocked 原因。不新建通知中心、遥测平台或新 blocked 状态。schedule-pointer 仅在 PG-01B 已合并后由 supervisor 按 D17 把本批写入唯一排产源时改动；不另开第二套指针。本文撰写轮不登记。
11. 不得自动 `git commit` / `git push` / 安装到用户机器 / live 付费探针 / 外部安装。长期候选不自动执行。提交仅当该新任务用户当前消息明确要求。
12. 同一时刻最多 1 个语义子会话。实施默认 Grok CLI `grok-4.6` / `xhigh`；reviewer 为全新零上下文 Codex `gpt-5.6-sol` / `max`。不得降级。
13. 不凭模型自述判 GREEN。
14. 四个文档门（emoji / doc-links / privacy / schedule-pointer）不能代替 `just ci` 与定向测试。
15. 不得把 AS-01 设计-代码再切到 AS-02 设计-代码；恢复纳入同一两阶段，不新增第三阶段。本批先统一设计、再统一实现。不得把多次 canonical review 与多次代码 review 放进同一 stage/cycle。
16. 扫描/Git 查询只绑相关写入/构建边界。三类失败必须可判定；新鲜度不得伪装成功。不编造毫秒/收益比例，不增加持续上报。

## 3. 分阶段任务

`gate_mode=local_first`。风险分级：本批改持久化隐私闸，按 `~/.octoworkflow/risk-tiers.md` 至少 L2（安全相关写入；L 不是 P 严重度，不减免隔离）。

用户明确启动本文，即授权且仅授权这两个预先接受阶段（统一设计，再统一实现；恢复纳入同一范围，不新增第三阶段）。每个阶段自带固定 acceptance / coverage / gates / control / cycle-state / 预算；不因 RED 或 fingerprint 变化新开阶段或清零计数。同一时刻 1 个语义子会话。每阶段 1 次初审 + 最多 3 次复审（全绿则各 1 次语义评审，两阶段合计 2 次）。编号任务只是实施步骤，不再按 AS 小节强制单独 review。`post_green_continue=preaccepted_next_stage_only`：`contract` 有效 GREEN+该阶段门禁后进入 `implementation`；`implementation` GREEN 后不自动开工 AS-03..07、共享设置或 PG-02。

| 阶段 | `$STAGE` / `$CYCLE` | 做什么 | 本阶段一次语义评审 | 本阶段门禁 |
| --- | --- | --- | --- | --- |
| contract | `contract` / `c1` | 统一完成本批 AS-01 **和** AS-02 的全部 canonical/schema 设计 | 一次设计一致性 review（`review_scope=step`） | 该阶段文档 gate 收口（四个文档门的仓内包装入口；不能代替 `just ci`） |
| implementation | `implementation` / `c1` | 在 contract 有效 GREEN+门禁后，统一实现 AS-01 **和** AS-02 代码与测试 | 一次代码 review（本任务最后阶段可用 `review_scope=workflow-final`） | 本批完整产品 gate：`just ci` + 定向测试 |

建议默认标识（须符合 `^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$`，长度 ≤64）：`$TASK=ecc-as01-as02-privacy`。路径相对未来 SayDo 仓根：

- contract：`$CONTROL_DIR=docs/plan/ecc-as01-as02-privacy-contract`，`$CYCLE_STATE=$CONTROL_DIR/cycle.json`
- implementation：`$CONTROL_DIR=docs/plan/ecc-as01-as02-privacy-implementation`，`$CYCLE_STATE=$CONTROL_DIR/cycle.json`

`$HANDOFF` 为本 prompt。新 cycle 的 `$POLICY` 取当时 live `~/.octoworkflow/v2-policy.json`；**freeze 成功后**把 `$POLICY` 绑定到 `$CONTROL_DIR/policy.frozen.json`，本 cycle 后续全部命令显式传该冻结路径。

### 3.1 每阶段机械顺序（现有 API；不得跳步、不得合并互斥动作、不得新增 runtime）

`cycle_control.py` 每次调用必须恰好一个动作（`--print-schema` / `--freeze-policy` / `--verify-freeze` / `--preflight` / `--check-coverage-matrix` / `--record-gate` / `--finalize` 等互斥）。`cycle_state.py` 每次调用必须恰好一个动作（`--init` / `--reserve` / `--start` / `--release` / `--advance`）。禁止把 `--preflight` 与 `--freeze-policy` 写在同一条命令里，禁止裸调用无动作的 `cycle_state.py`，禁止手改六个计数或 cycle-state 身份。

下列 `$NAME` 由 supervisor 在**启动现场**用真实命令填入后再执行；未替换的模板字符串不是可复制命令。现场生成后对照 `python3 ~/.octoworkflow/cycle_control.py --help`、`cycle_state.py --help`、`validate_review_manifest.py --help` 与 `--print-schema` 核验。本批用到的现有动作：`--init`、`--freeze-policy`、`--check-coverage-matrix`、`--preflight`、`--advance`、`--reserve`/`--start`/`--release`、`--record-gate`、`--finalize`，以及独立 `validate_review_manifest.py`。

**身份变量（必须区分，不得混用）：**

- `$HEAD_BEFORE` / `$FP_BEFORE`：init/freeze/首次 preflight 时的观测身份（实施写入前）。
- `$HEAD_CURRENT` / `$FP_CURRENT`：实施或修复写入后 `candidate_fingerprint.py` 的新身份。
- `$ORDINAL_STATE`：当时 cycle-state 的 `review_ordinal`。`--preflight`、`action=implement` / `repair` 收据的 `review_ordinal`、以及 `--expected-ordinal`（当命令校验的是 state 而不是待派 report）都用它。
- `$ORDINAL_REVIEW`：即将派发的 fresh review 报告的 `review_ordinal`。初审为 1；修后复审为当时 `$ORDINAL_STATE + 1`。不得跳号，不得因 fingerprint 变化清零预算。

**真实顺序：**

1. **准备 ignore 再 RECONCILE：** 先创建 `$CONTROL_DIR/.gitignore` 内容为 `*`（freeze 会幂等补全），再 `python3 ~/.octoworkflow/candidate_fingerprint.py`。这样 `$HEAD_BEFORE`/`$FP_BEFORE` 在 freeze 前后不变。控制产物、收据、报告、coverage、gate-evidence 都写在 `$CONTROL_DIR` 内，不得 `git add` 成 tracked；否则 `--record-gate` 会按观测 fingerprint 报 `diff_fingerprint_mismatch`。
2. **准备本阶段冻结构（真实文件，不是占位字符串）：**
   - acceptance contract：`schema_version`（1）、`task`、`stage`、`cycle`、`required_dimensions`、`acceptance_items[]`（`id`+`severity`∈P0/P1/P2）、`required_gates`。禁止 `command` / `run` / `prompt` / stdout / secret 字段。每个阶段一份，stage 名与 `$STAGE` 一致。
   - coverage matrix：`schema_version`、`task`、`stage`、`cycle`、`candidate_head`、`diff_fingerprint`、`dimensions`（精确等于合同 `required_dimensions`）、`acceptance_ids`、`cases[]`（`id`、`acceptance_id`、`kind`∈positive/negative、`coordinates`、`expected_outcome`、`evidence_ref`）。每个 P0/P1 item 至少一正一负；`kind=positive` 只能 `pass`，`kind=negative` 只能 `fail`；坐标向量不重复。覆盖至少：ledger 拒写、remember 不绕过、foundation 整次不发布、gitignore 语义（非全目录封禁）、已跟踪停投影且保留用户文件、非 git / worktree `.git` 文件 / 根外 symlink / 写失败、三类失败可区分、旧知识未更新不伪装成功、首次无旧知识不假称保留、恢复后实际更新、同一问题不重复轰炸、source metadata 脱敏、负例 `env:`/digest/路径/长串/明确占位符可过。不把 `knowledgeShare` schema 当本批必测项。
   - gate spec：`schema_version`、`task`、`stage`、`cycle`、`gates[]`（`name` + `argv`）。`argv` 只能是长度为 2 的列表：`python3` 或 `bash` + **仓库内已存在**的相对入口。`just ci` 本身不是合法 argv。若要把产品门禁纳入 `--record-gate`，supervisor 须先写入真实可执行的仓内包装入口（包装必须实际调用下方产品命令，不得 echo 假绿），再冻结。`entry_sha256` 由 freeze 写入。
3. **init（必须 `--output`；freeze 要求 cycle-state 文件已存在）：**
   `python3 ~/.octoworkflow/cycle_state.py --init --task "$TASK" --stage "$STAGE" --cycle "$CYCLE" --expected-head "$HEAD_BEFORE" --expected-fingerprint "$FP_BEFORE" --output "$CYCLE_STATE" --policy "$POLICY" --followup-authorized`
4. **freeze（2.4.2 还必须绑定 acceptance contract 与 gate spec）：**
   `python3 ~/.octoworkflow/cycle_control.py --freeze-policy --policy "$POLICY" --control-dir "$CONTROL_DIR" --task "$TASK" --cycle-state "$CYCLE_STATE" --acceptance-contract "$ACCEPTANCE_CONTRACT" --gate-spec "$GATE_SPEC"`
   冻结产物 gitignore，不得 tracked。成功后 `$POLICY="$CONTROL_DIR/policy.frozen.json"`。
5. **coverage 核验，然后 preflight（两条分开；身份仍是 BEFORE，ordinal 为 `$ORDINAL_STATE`，初值为 1）：**
   `python3 ~/.octoworkflow/cycle_control.py --check-coverage-matrix --coverage-matrix "$COVERAGE_MATRIX" --acceptance-contract "$ACCEPTANCE_CONTRACT" --expected-head "$HEAD_BEFORE" --expected-fingerprint "$FP_BEFORE" --expected-task "$TASK" --expected-stage "$STAGE" --expected-cycle "$CYCLE" --policy "$POLICY"`
   `python3 ~/.octoworkflow/cycle_control.py --preflight --control-dir "$CONTROL_DIR" --cycle-state "$CYCLE_STATE" --handoff "$HANDOFF" --coverage-matrix "$COVERAGE_MATRIX" --expected-head "$HEAD_BEFORE" --expected-fingerprint "$FP_BEFORE" --expected-task "$TASK" --expected-stage "$STAGE" --expected-cycle "$CYCLE" --expected-ordinal "$ORDINAL_STATE" --policy "$POLICY"`
6. **实施本阶段产品写入**（contract：只改范围内 canonical/schema；implementation：只改代码与测试）。未启动的无效预留用 `--release <kind> --reason preflight_invalid`。
7. **首次免费 implement 候选迁移（写入后、fresh review 前，强制）：** 再测 `$HEAD_CURRENT`/`$FP_CURRENT`。用 `action=implement`、`terminal=completed`、`cost_kind=none`、`consumed` 全 false、`review_ordinal=$ORDINAL_STATE` 的收据，把 cycle-state 从 BEFORE 迁到 CURRENT。这不是语义评审，不计 rereview 预算。`--advance` 的 `--expected-head`/`--expected-fingerprint` 用 **CURRENT**；绑定的 manifest 必须是 **BEFORE** 身份上的非 GREEN。
   CLI 要求 implement 绑定前一候选的非 GREEN manifest。空 `blockers=[]` 的 RED 会被 `validate_manifest` 以 `red_without_blockers` 拒绝（不得当作可执行占位）。当前工具已支持的初始登记方法：一份**机械未评审占位**，只为 `--advance action=implement` 记录「尚未评审不得放行」，字段为 `verdict=RED`、`stop_reason=initial-unreviewed-bootstrap`、`review_ordinal=1`、BEFORE 的 HEAD/fp、`review_scope=workflow-final`、空 `focused_gates`/`p2_ledger_delta`，以及 **一条 schema 所需的 P0/P1 blocker**（`id=initial-unreviewed-bootstrap`，`severity` 与冻结合同某一已有 P0/P1 `acceptance_item` 一致，`evidence` 用闭合 `file:line`，`in_scope=true`，`needs_owner_decision=false`）。这不是任何 reviewer 结论，不伪造产品 P1，不计语义评审，**不得**送到 `validate_review_manifest.py` 消费闸去授权行动，不给已发生 review 的 cycle 使用，不跨 cycle 冒用。`action=implement` 不会把该 blocker 写入 `current_blockers`。不得改全局脚本、不得裸手改 state、不得复用 GREEN 去 implement。连续免费 implement 换 candidate 会被拒绝。
   收据还须含 `schema_version`、`receipt_id`、`blocker_id_map=[]`、`evidence_refs`（闭合 `scheme:token`）、`task`/`stage`/`cycle`、`control_sha256`（`control.json` 原始字节 SHA-256）、`manifest_sha256`（解析出的 manifest 按工具 canonical JSON）。然后：
   `python3 ~/.octoworkflow/cycle_state.py --advance --previous "$CYCLE_STATE" --manifest "$BOOTSTRAP_REPORT" --receipt "$IMPLEMENT_RECEIPT" --expected-head "$HEAD_CURRENT" --expected-fingerprint "$FP_CURRENT" --expected-task "$TASK" --expected-stage "$STAGE" --expected-cycle "$CYCLE" --control-dir "$CONTROL_DIR" --output "$CYCLE_STATE" --policy "$POLICY"`
8. **更新 coverage 身份并 preflight 新候选：** 把 coverage 的 `candidate_head`/`diff_fingerprint` 改成 CURRENT，`--check-coverage-matrix` 与 `--preflight` 都用 CURRENT 与 `$ORDINAL_STATE`（此时仍为 1，rereview 尚未消费）。
9. **fresh review：** 实施线停止。supervisor 派**一名**全新零上下文 Codex reviewer，报告 `review_ordinal=$ORDINAL_REVIEW`（初审为 1），身份为 CURRENT。同时最多 1 个语义子会话。
10. **同一 candidate 的 `action=rereview` 收据，再独立 validate：** 初审收据 `review_ordinal=1`、`consumed.rereview=false`、`cost_kind=none`、`terminal=completed`。先 `--advance`（机械记账，尚不采用 GREEN），`--expected-head`/`--expected-fingerprint` 为 CURRENT。再：
    `python3 ~/.octoworkflow/validate_review_manifest.py "$REVIEW_REPORT" --expected-head "$HEAD_CURRENT" --expected-fingerprint "$FP_CURRENT" --expected-ordinal "$ORDINAL_REVIEW" --cycle-state "$CYCLE_STATE" --expected-task "$TASK" --expected-stage "$STAGE" --expected-cycle "$CYCLE" --control-dir "$CONTROL_DIR" --policy "$POLICY"`
    消费闸非零即不采用评审结论、不派发下一步，按 `plan_recovery.py` 处理。不能要求新 RED 先与尚未登记的 `current_blockers=[]` 一致。两命令任一失败都保留证据，不手改 blockers 或换 policy。
11. **RED 修复（不得跳号、不得按 fp 清预算）：** 先 `--reserve repair` 再 `--start repair`（`--expected-*` 仍为当时 CURRENT）。修复写入后得到新 CURRENT。`action=repair`、`terminal=completed`、`consumed.repair=true`、`cost_kind=product`、`review_ordinal=$ORDINAL_STATE` 的收据更新 candidate；绑定的是**刚登记的那份 RED 评审 manifest**（不是 bootstrap，不是 GREEN）。然后更新 coverage 并按 `$ORDINAL_STATE` preflight 新候选。再 `--reserve rereview` / `--start rereview`，派 fresh report，`review_ordinal=$ORDINAL_STATE+1`，收据 `action=rereview`、`consumed.rereview=true`、`cost_kind=product`。独立 validate 用新 ordinal。有可核验进展时可在最多 3 次产品修复、最多 3 次复审内继续。
12. **final gates / finalize：** 语义 GREEN 之后。`--finalize` 的 `--expected-ordinal` 必须等于当时 cycle-state `review_ordinal`。若第 11 步刚把 ordinal 推进，须对同一 CURRENT 再用新 ordinal `--preflight` 一次以写出对应 runtime receipt。然后对冻结合同 `required_gates` 逐个 `--record-gate`（只传 `--gate-name` 与 identity，禁止调用方 `--gate-log` / `--gate-exit`），再 `--finalize --control-dir --cycle-state --manifest --gate-evidence` 加完整 expected identity 与 `--expected-ordinal`。产品门禁义项见 3.3；文档门不能冒充 `just ci`。

临时合成 workflow smoke 只用于核验本顺序，**不是生产 review**，不得当作本任务 GREEN。

隔离：独立 clone 或 worktree 上的分支 `codex/ecc-as01-as02-privacy`（默认 `codex/` 前缀），基线为 **PG-01B 合并后的 main**（若前置未满足则停在准备，不建施工分支改 daemon）。Grok 施工：`grok --model grok-4.6 --reasoning-effort xhigh --always-approve --sandbox workspace --no-subagents`（见 `cli-forms.md`）。优先独立 clone；worktree 的 admin 目录在父仓时 sandbox 无法 commit。

**source / candidate / delivery dependency manifest**（写入 `docs/plan/ecc-as01-as02-manifests/`，本任务创建，不把 ECC 源码放进产品 diff）：

- source：终稿、上列 canonical、write set 源码、PLAN-2 指针、ECC SHA `e04ea0b9` 只作只读夹具。
- candidate：隔离分支 HEAD + fingerprint。
- delivery：AS-01/AS-02 代码与同批 canonical/测试（含失败可见/恢复）；不含 `knowledgeShare` schema/UI、不含 G-B12 安装器重写、不含 AS-03..07。
- 只读依赖：ECC permalink，不 vendor。

### 3.2 阶段 contract — 统一 AS-01/AS-02 设计

先完成范围内全部 canonical（终稿 §3：AS-01 的 `docs/09-data-contracts.md` §13/§12-4、`docs/modules/b-memory.md` B3、`docs/04-key-mechanisms.md` §1.2；AS-02 的 `docs/03-architecture.md:143` 既有手工共享约定澄清、`docs/09` foundation/ledger 错误码、`docs/10-voice-ux-spec.md` 复用既有处方、三类失败可见语义）。**不**把 `docs/02` §5.1 knowledgeShare、`docs/11` 共享设置行、`projectOverridesSchema` 新字段、DDL 列入本阶段必交。再对该**整批设计**（含恢复，不含共享设置）做一次全新零上下文一致性评审。GREEN+本阶段文档门后才进入 implementation。该阶段同时最多 1 个语义子会话。不在本阶段改 daemon 代码。

### 3.3 阶段 implementation — 统一 AS-01/AS-02 代码与测试

仅在 contract 有效 GREEN+门禁后改代码。同时最多 1 个语义子会话。

AS-01 文件：`packages/daemon/src/memory/ledger.ts`、`foundation.ts`、`brain/liveTools.ts`；纯函数宜放 daemon 内可测模块，不进 `voice/redactor.ts` 展示层。验收：终稿 AS-01 正反例全部有测试。命中不 insert、不写 staging、不改 `current.json`。扫描只在这些写入/构建边界。

AS-02 文件：foundation/workspace 登记路径的 create-only ignore 与 `git -C` 查询。**不**改 `projectOverrides.ts` / DDL / 设置页。验收：终稿 AS-02 正反例。等价规则不覆盖；已跟踪停本次受影响私有投影并保留用户文件；非 git / worktree `.git` 文件 / 根外 symlink / 写失败；不自动 `git rm`。

恢复：复用既有 `ProjectSettings` 奠基/重试与错误卡；三类失败可区分；不新建通知中心或 blocked 原因。审计只记 kind+digest。

产品门禁（必须真实跑过；四个文档门不能代替）：

```bash
just ci
```

以及与改动直接相关的定向测试（daemon memory/foundation/ledger；本批不改 contracts schema 则不为此扩测）。`just ci` 含 `ci-node`（typecheck/lint/test + 仓库卫生脚本）与 `ci-python`。缺 GitHub CI 不是本地失败；远端产品 RED 不能用本地绿掩盖。不要把不存在的临时脚本路径写成已可执行的 freeze gate spec。

长测试用 `python3 ~/.octoworkflow/await_external_cli.py` 设 hard timeout，由 runner 在工具层阻塞等待完成通知；完成前不由模型查状态。不要写「每 N 秒检查」。

候选完成后实施线停止，不自审、不派 reviewer。由 supervisor `/supervised-delivery` 再 `RECONCILE`，启动**一名**全新零上下文 Codex reviewer（`-m gpt-5.6-sol -c 'model_reasoning_effort="max"'`，`-s read-only`）。消费流程见 3.1 第 9–12 步。不执行 reviewer 输出的任意命令。门禁命令只来自本合同。不凭模型自述判 GREEN。完整门禁在语义 GREEN 之后跑一次；仅相关变更后才重跑。单阶段 P2 只登记。

## 4. 节奏与检查点

必须停下等用户当前消息的检查点：

1. PG-01B 未合并：只准备，不施工。已合并则 supervisor 按 D17 登记本批，不再因指针尚未被 owner 手改而停。
2. 不可逆操作（commit/push/install、改 Git 历史、删用户文件、外部安装）——默认不做。
3. 偏离终稿：partial 发布、整表 TTS、全目录一律封禁、新增 `knowledgeShare`/DDL/设置页、改 blocked 合同、把未更新伪装成成功。
4. live 凭据/付费探针。
5. 要把 AS-03..07 或 G-B12 扩进本批。

## 5. 诚实汇报

完成度用 `[ok]/[warn]/[fail]/[divergent]`。每个「完成」给本会话 `git log` 的 commit hash（若已提交）+ 测试原始输出摘要。没做的明说。负向需求：未改 `net/**`；PG-01B 未合并时未改 schedule-pointer；已合并后仅按 D17 登记本批、未另造第二套排产源；未 vendor ECC；未自动 commit/push/install；未新增 `knowledgeShare`/DDL/共享设置；未新建通知中心或 blocked 状态。收尾自检留证据。

交付必须写清三栏：**未完成前置 / 已验收范围 / 可继续阶段**。语义 GREEN 后若 PG-02 已是 next，不自动开工 PG-02，除非用户授权的下一阶段已 preaccepted。长期候选不自动执行。

收口日志：`history/PROCESS-JOURNAL.md` 追加本轮输入/行动/产出/结论；cycle-state 由 `cycle_state.py --advance`（或 init/reserve/start/release）演进，不手改六个计数，不裸调用无动作入口。

## 6. 工作方式

- 实施：Grok `grok-4.6`/`xhigh`；`--no-subagents`。分支默认前缀 `codex/`。
- Review：fresh 零上下文 Codex；每 candidate 1 名；同时最多 1 个语义子会话。contract 设计评审与 implementation 代码评审分属两个预先接受阶段，串行，不得并行。
- 修复后重新派一名全新零上下文 reviewer 对新 candidate 复审。
- 不得 reviewer 对自己修过的 candidate 判 GREEN。
- P2 ledger：`docs/plan/2026-09-05-ecc-as01-as02-DEFERRED-P2.md`；首次发现时复制 `~/.octoworkflow/deferred-p2-ledger-template.md`。最终 P2 sweep 只在整个任务最终交付前一次。
- 上下文 soft/首次 compaction/跨日/unknown usage 不强制 RECONCILE；hard 或真实 context-limit 才 checkpoint/`RECONCILE`。

## 6A. Deferred P2 ledger

路径见上。单阶段 P2 只登记不返工。P3 不进 sweep。

<!-- ecc-final:delivery-status -->
> 范围修订，独立评审结果见本仓交付记录。上一版历史证据：R3 完整语义 GREEN；R4 复核 GREEN；十二项文档门禁 exit 0——仅证明修订前文档，不预填本范围 GREEN/PASS。
