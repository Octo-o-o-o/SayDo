# IMPLEMENTATION-PLAN-2 · 补充实施方案(第一期 · 全量清偿)v1.2

> **owner 指令(2026-07-26 凌晨)**:完整检查全部文档,把所有"后续会做"的待实施项收进第一期,全部完成。
> **与首发计划的关系**:[IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)(P0+P0.5 主体历史实现与 evidence 已收口；当前仍须把发布前回修 commit/deploy，再跑 owner 场次①–④与 v0.1.0 发布门);本方案接管其后**全部**已梳理未实施项(原 P1/P2 全量 + 提前批 + 合同债 + 数据触发轨),**取代原 P1/P2/P3 分期作为唯一排产源**(05 §4 原分期行保留作出处索引;移交回写见 W1.9 与本方案收口动作)。
> **纪律继承**:AGENTS.md 评审制度(设计文档轮次=重制度;实施期轻量版)、HANDOFF §4 铁律、IMPL-PROMPT 系列交接模式、本仓实施会话串行。
> **v1.1(2026-07-26)**:经自审 + 四路 subagent 评审(完整性对账/架构契约/范围克制/可操作性)回修。**v1.2(同日)**:叠加 Codex 19(报告 `research/codex-findings/19-plan2-review.md`,评的是 v1.0,与 subagent 重叠项已在 v1.1 修)——最重发现:电话形态已有**锁定实施计划**(`research/phone-call-impl-plan-2026-07.md` v3,40–55 工程日、自带解锁触发与四道前置门),从 W7 摘出为指针;另修 S3 merge 措辞(候选方案而非既定语义)、corpus 双资产拆分、planning 出缺省集、APNs/FCM 等 B 级十余项。

## 当前唯一排产链 · PG-00 导入（2026-08-29）

<!-- schedule-pointer:begin -->
schema_version=1
revision=5
active=none
next=PG-02
last_closed=AS-01-AS-02
evidence_ref=e2e/evidence/as-01-as-02-privacy.md
updated_at=2026-09-06
<!-- schedule-pointer:end -->

> 本节是 2026-08-29 起 PLAN-2 的唯一当前排产坐标。下方 §0 现状锚点与 §1 W1–W9 / 合同轮 / `ai-supply` 为历史原文，只增加 superseded/disposition，不删除历史节点、不重写既有 evidence。当前现势指针见本节顶部 schedule-pointer 块,由 `scripts/schedule-pointer.mjs` 守护;不得手写第二套 active/next。字段原逐字来自 `docs/plan/2026-08-28-project-gap-closure-program.md` §20 批卡与 D17 §4.2；2026-09-06 在 PG-01B 与 PG-02 之间插入唯一批 ID `AS-01-AS-02`（owner 决策单第 10 节，不是 D17 扩权）。不新增功能平台。`PLAN2-default-all` 已 `superseded`；未被 exact 选入的未来项一律 deferred，取消“未回复则缺省全做”。

### 唯一串行链

```text
PROC-01 → PG-01B → AS-01-AS-02 → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop
```

断言形态：`PLAN2_chain == PROC-01>PG-01B>AS-01-AS-02>PG-02>PG-03>PG-04>PG-05>PG-06>owner-stop`。

PG-00 只是把本链导入唯一排产源的本地文档批，不是产品代码批，也不占用 active/next。

### legacy disposition exact-set

`PLAN2_legacy_disposition_id_exact_set` 必须与下表 18 行全等；缺项、重复、删除历史节点或保留第二个 active/next 都失败。

| legacy node | disposition |
|---|---|
| `AI-ACTIVE` | `superseded_by_PG-00_chain` |
| `AI-DRAFT` | `archive_deferred` |
| `W5.4-c` | `conditional_release_evidence` |
| `W5.3-tail` | `inventory_deferred(trigger=PLAN-2 §6.10)` |
| `W5.6` | `inventory_deferred` |
| `W5.8` | `inventory_deferred` |
| `W5.9` | `inventory_deferred` |
| `W5.11-rest-six` | `inventory_deferred` |
| `R-B` | `split_deferred` |
| `R-C` | `inventory_deferred` |
| `A5-armed` | `not_authorized` |
| `A5-UI` | `not_authorized` |
| `W6` | `inventory_deferred` |
| `W7` | `inventory_deferred` |
| `W8` | `inventory_deferred` |
| `W9` | `preserved_trigger_track` |
| `PLAN2-default-all` | `superseded` |
| `Codex-app-server` | `deferred_by_AI_decision_2` |

### PROC-01 · process-convergence——**状态:已收口(2026-09-03;I `289cb384`,evidence `e2e/evidence/process-convergence-proc-01.md`)**

- depends_on：PG-01A evidence commit
- A-ID exact-set：`close_set=[]`；`stop_loss_set=[]`
- deferred exact-set：本批不做 `check-review-index.mjs`、journal 按月拆分、HANDOFF 历史行搬迁、根目录文件搬迁(全部 PROC-02);不对既有 PG 批卡改 A-ID / scope / gate;PG-07 / PG-08 与仓外清单不在本批
- scope roots：`docs/plan/IMPLEMENTATION-PLAN-2.md`、`HANDOFF.md`、`docs/plan/2026-08-28-project-gap-closure-program.md`、`docs/plan/2026-08-28-project-gap-d17-import-spec.md`、`scripts/schedule-pointer.mjs`、`docs/plan/project-gap-closure/README.md`、`AGENTS.md`、`.octoworkflow/project-profile.md`、`docs/README.md`、`docs/plan/OWNER-DECISIONS.md`、`docs/plan/README.md`、`justfile`、`package.json`、`.github/workflows/ci.yml`、`.github/workflows/release.yml`、`scripts/check-gate-list-parity.mjs`、`docs/adr/design/ADR-005-execution-single-route.md`、`docs/adr/README.md`、`docs/03-architecture.md`、`docs/05-roadmap.md`、`docs/09-data-contracts.md`(仅 §6.1 route 行注释)、`templates/saydo.config.example.toml`、`docs/adr/design/ADR-001-execution-layer.md`
- focused gate：`FG-PROC01-P1` = `node scripts/schedule-pointer.mjs --check`；`node scripts/schedule-pointer.mjs --self-test`；`bash scripts/check-emoji.sh`；`node scripts/check-doc-links.mjs`；`git diff --check`。`FG-PROC01-P2` = `bash scripts/check-emoji.sh`；`node scripts/check-doc-links.mjs`；`git diff --check`。`FG-PROC01-P3` = `node scripts/check-gate-list-parity.mjs`；`node scripts/check-public-tree-privacy.mjs --ref "$(git rev-parse HEAD)"`；`node scripts/check-active-claims.mjs`；`python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/ci.yml`；同命令对 `.github/workflows/release.yml`；`bash scripts/check-emoji.sh`。`FG-PROC01-P4` = `bash scripts/check-emoji.sh`；`node scripts/check-doc-links.mjs`；`pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts`；`git diff --check`。`FG-PROC01-P5` = `just precommit`
- full gate：`just ci`
- evidence path：`e2e/evidence/process-convergence-proc-01.md`
- 回滚上限：只能回退流程文档、检查器与指针块,不能改产品代码,不能改 09 schema/DDL,不能放宽 Gate 0 / S0–S3 / 审计不可变 / TTS 脱敏。`safe_default=I-form pointer + no_product_code`
- 批卡摘要（方案 §3.1）：正式小批(脚本、门禁、workflow 与文档,不改产品代码),排在 PG-01B 之前。P1 现势单源;P2 规则迁移;P3 候选门补位;P4 执行层 canonical(L3);P5 证据卫生。I 指针 `active=PROC-01,next=none`;E 指针 `active=none,next=PG-01B`。legacy disposition 表与其他 PG 批卡 A-ID / scope / gate 字段不改。

### PG-01A · public-claim-corpus-stoploss——**状态:已收口(2026-09-02;I `2a786ed`,evidence `e2e/evidence/project-gap-pg-01a.md`;G-A1 按 D2 安全缺省 `repo_downgraded`(986 source 全部 unresolved),G-A4 `repo_closed`,G-A2 stop-loss 已落;deployed_status 均 `blocks_expansion` 待部署授权)**

- depends_on：PG-00 evidence commit
- A-ID exact-set：`close_set=[G-A1,G-A4]`；`stop_loss_set=[G-A2]`
- deferred exact-set：`[DF-CLAIM-SOURCE-FULL,DF-CLAIM-GENERATOR,DF-SP3B-DIST,DF-SP4-FORMATIVE,DF-SP5-READ]`
- scope roots：`AGENTS.md`、`justfile`、`README*`、`docs/site/**`、`docs/release/**`、`deploy/saydo-octoooo-com/**`、`templates/**`、与受影响 claim 直接对应的 console copy、`research/customer-question-corpus/{README.md,contracts/**,questions/**,contexts/**,04-live-source-contracts.md,validate.mjs,rebuild.mjs,test-mutations.mjs,dry-runs/rebuild-three-pass-dry-run.mjs,dry-runs/01-three-pass-dry-run-result.md,dry-runs/02-dry-run-remediation-plan.md,check-q0-truth-report.mjs,test-q0-truth-mutations.mjs,review/23-pg01a-q0-truth-report.json}`、`docs/06-references.md`、`docs/11-ui-spec.md`、`scripts/{check-active-claims.mjs,test-active-claims.mjs}`
- focused gate：`FG-PG01A-CLAIM` = `node research/customer-question-corpus/validate.mjs`；`node research/customer-question-corpus/test-mutations.mjs`；`node research/customer-question-corpus/simulations/validate-simulations.mjs`；`node research/customer-question-corpus/simulations/test-simulation-mutations.mjs`；`node research/customer-question-corpus/dry-runs/validate-three-pass-dry-run.mjs`；`node research/customer-question-corpus/dry-runs/test-dry-run-mutations.mjs`；`node scripts/test-public-text-redaction.mjs`；`[new] node scripts/check-active-claims.mjs`；`[new] node scripts/test-active-claims.mjs`；`[E-artifact producer, after all read-only I gates] node research/customer-question-corpus/check-q0-truth-report.mjs --write --output research/customer-question-corpus/review/23-pg01a-q0-truth-report.json --implementation-sha <full-I-OID> --implementation-tree <full-I-tree>`；`[new] node research/customer-question-corpus/check-q0-truth-report.mjs --check research/customer-question-corpus/review/23-pg01a-q0-truth-report.json`；`[new] node research/customer-question-corpus/test-q0-truth-mutations.mjs`
- full gate：`just ci`
- evidence path：`e2e/evidence/project-gap-pg-01a.md`
- 回滚上限：只能回到更保守文案或关闭投影，不能恢复已证伪 claim。`safe_default=unsupported_or_conditional + repo_closed_only + no_deploy`
- 批卡摘要（program §20.4）：claim-only，规模 S；canonical_change=yes。按 D2 安全缺省先降级 986 source 合同与 connector-readiness 引用，不逐条修 986 个 source；只修 active claim roots 和生成真相，不新增 generator 平台。G-A2 在本批只做 stop-loss（删除“本地 CI 等效”总括说法，改成“本地 Node/Python 基线”），由 PG-03 唯一关闭。

### PG-01B · runtime-entry-stoploss——**状态:已收口(2026-09-05;I `ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb`,evidence `e2e/evidence/pg-01b-20260905.md`;无 `--finalize` 记录,owner 知情合并见 R129,不伪称 finalized)**

- depends_on：PG-01A evidence commit
- A-ID exact-set：`close_set=[G-A6]`；`stop_loss_set=[G-A3]`
- deferred exact-set：`[DF-DIRECT-REVIEW-FULL,DF-REMOTE-REOPEN,DF-SP2B1-LIVE,DF-SP2C1-HISTORY]`
- scope roots：`packages/daemon/src/net/**`、`packages/daemon/src/index.ts`、`packages/daemon/src/voice/hub.ts`、`packages/daemon/src/api/recoveryOnlyServer.ts`、`packages/daemon/src/tier1/gateServer.ts`（仅证明 Unix socket 不属于远程面）、对应 remote/mobile/console/recovery/voice WS API tests、`packages/daemon/src/brain/liveTools.ts`、`packages/console/src/**` 中 action/budget/remote 消费点、`packages/daemon/src/api/**` 的 touched exact-set、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/11-ui-spec.md`、`scripts/{pairing-url-corpus.json,remote-surface-inventory.json,check-remote-surface-inventory.mjs,test-remote-surface-inventory.mjs}`
- focused gate：`FG-PG01B-RUNTIME` = `pnpm --filter @saydo/console exec vitest run src/hooks/redesign/mappers.test.ts src/components/redesign/DecisionPackageCard.test.tsx src/lib/apiError.test.ts`；`pnpm --filter @saydo/daemon exec vitest run test/console-actions.test.ts test/console-api.test.ts test/p05c-direct-mode.test.ts test/mobile-lan-process.test.ts test/pairing-info.test.ts test/t2-thin.test.ts test/logger.test.ts`；`node scripts/test-pairing-url-corpus.mjs`；`[new] node scripts/check-remote-surface-inventory.mjs`；`[new] node scripts/test-remote-surface-inventory.mjs`
- full gate：`just ci`；`pnpm exec playwright test`
- evidence path：`e2e/evidence/pg-01b-20260905.md`
- 回滚上限：保持入口 hidden/403/unknown；如兼容客户端失败，返回稳定 typed unsupported/error，不恢复不安全读取。`safe_default=hidden + remote_business_403 + budget_unknown`
- 批卡摘要（program §20.4）：runtime safety，规模 M；canonical_change=yes。`direct_to_review` 保留设计合同并标 `designed/deferred`，从 active selector/default route/public claim 移除，不删 schema。remote business API 统一 fail-closed；只保留无业务 payload health/static shell 与安全跳转；abandon 不再映射 archive；0/0 改 unknown。G-A9 不在本批关闭。G-A3 本批只记 stop-loss，由 PG-02 关闭。

### AS-01-AS-02 · privacy-write-guard——**状态:已收口(2026-09-06;I `7ab7ab394f97a9c1e9a666d218ac41cee3d2ef45`,E `21ed2840b11d824f970528b94f1366f8300206a8`,evidence `e2e/evidence/as-01-as-02-privacy.md`;contract 与 implementation 两阶段均有 `--finalize`,独立零上下文 GREEN 与 I 干净 HEAD 完整门见证据)**

- depends_on：PG-01B evidence commit（实际路径 `e2e/evidence/pg-01b-20260905.md`；I `ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb`；E `99d51106c9caaefcf55f72bff1a17a78abf58be9`；无 `--finalize`，不清旧账）
- A-ID exact-set：`close_set=[M1,M2,M3,M4,M5,M6,M7,M8]`；`stop_loss_set=[]`
- deferred exact-set：`[DF-KNOWLEDGE-SHARE,DF-AS-03,DF-AS-04,DF-AS-05,DF-AS-06,DF-AS-07]`
- scope roots：见 `docs/plan/IMPL-PROMPT-ecc-as01-as02-privacy.md` implementation exact-set；canonical 限 03/04/09/10/11 与 `docs/modules/b-memory.md`。不含 `packages/daemon/src/net/**`、`knowledgeShare`、`projectOverrides` 新字段、DDL
- focused gate：`FG-AS01AS02-PRIVACY` = `pnpm --filter @saydo/daemon exec vitest run test/memory.test.ts test/memory-foundation.test.ts test/credential-literals.test.ts test/git-protection.test.ts test/live-tools-remember-privacy.test.ts test/projects-lifecycle.test.ts test/memory-growth.test.ts`；`pnpm --filter @saydo/contracts typecheck`；`pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts test/knowledge-privacy.test.ts`；`pnpm --filter @saydo/console typecheck`；`pnpm --filter @saydo/console exec vitest run src/pages/ProjectSettings.test.tsx`。与唯一执行卡 `docs/plan/IMPL-PROMPT-ecc-as01-as02-privacy.md` §7 同一 exact 测试集（含 reanchor / nomination 恢复路径）。其中 `credential-literals.test.ts` / `git-protection.test.ts` / `live-tools-remember-privacy.test.ts` / `ProjectSettings.test.tsx` 标 `[new]`，建立前不得当现役门禁调用
- full gate：`just ci`；`pnpm exec playwright test`
- evidence path：`e2e/evidence/as-01-as-02-privacy.md`
- 回滚上限：停受影响新写入/新 generation/本次私有投影；保留旧有效数据、用户文件与已建保护。不回放被拒原文，不自动删库/改 Git 历史。`safe_default=refuse_new_secret_write + keep_old_generation + create_only_ignore`
- 批卡摘要（统一方案 §3）：daemon 隐私批，规模 M；canonical_change=yes。凭据写前拒绝、Git 私有 write set create-only、三类失败可见与恢复同一批交付。合同阶段不改 daemon 行为。收口后接回 PG-02，不自动开 PG-02。

### PG-02 · minimal-truth-gate-bootstrap

- depends_on：AS-01-AS-02 evidence commit
- A-ID exact-set：`close_set=[G-A3]`；`stop_loss_set=[]`
- deferred exact-set：`[DF-CLAIM-GENERATOR,DF-AI-DRAFT-FULL,DF-SP4-FORMATIVE,DF-SP5-READ,DF-SP7-CALIBRATE]`
- scope roots：`docs/06-references.md`、`docs/09-data-contracts.md`、`docs/11-ui-spec.md`、`packages/contracts/**`、最小 release/support projection、`scripts/{check-capability-ledger.mjs,check-action-reachability.mjs,check-support-matrix.mjs}` 及对应 mutation self-tests；`ai-supply-scope` 在本批重分类，不下沉全部 45k 行草案
- focused gate：`FG-PG02-BOOTSTRAP` = `pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts`；`[new] node scripts/check-capability-ledger.mjs`；`[new] node scripts/test-capability-ledger.mjs`；`[new] node scripts/check-action-reachability.mjs`；`[new] node scripts/test-action-reachability.mjs`；`[new] node scripts/check-support-matrix.mjs`；`[new] node scripts/test-support-matrix.mjs`
- full gate：`just ci`；`pnpm exec playwright test`。本批 implementation commit 上重跑 `FG-PG01A-CLAIM`、`FG-PG01B-RUNTIME`；其中 `FG-PG01A-CLAIM` 回归只运行 read-only validator/mutation 与 Q0 `--check` 子集，明确排除 Q0 `--write` E-artifact producer
- evidence path：`e2e/evidence/project-gap-pg-02.md`
- 回滚上限：checker/projector 失败即阻断新 claim，不回退为人工口头对账。`safe_default=unregistered_not_claimable + evidence_bound_to_git_commit`
- 批卡摘要（program §20.4）：runtime safety/bootstrap，规模 M；canonical_change=yes。最小 capability/action/scope schema、手工维护 scoped ledger、claim/gate/support checker；inventory/deferred 只填最小字段；建立供 PG-03–PG-06 消费的稳定 gate-ID registry，但不建设通用 wave-exit 执行/receipt 平台。

### PG-03 · gate-truth

- depends_on：PG-02 evidence commit
- A-ID exact-set：`close_set=[G-A2]`；`stop_loss_set=[]`
- deferred exact-set：`[DF-SP3A1-RELEASE,DF-SP3B-DIST,DF-SP3C-VOICE]`
- scope roots：`AGENTS.md`、`justfile`、根/各 package scripts、`.github/workflows/**`、与当前公开 claim 相关的 release/gate scripts、`docs/09-data-contracts.md`、PG-02 的 gate registry/schema、`scripts/{check-gate-manifest.mjs,test-gate-manifest.mjs}`；不做 candidate identity 参数化
- focused gate：`FG-PG03-CONTROL` = `node scripts/test-release-provenance.mjs`；`node scripts/test-release-physical-evidence.mjs`；`node scripts/check-doc-links.mjs`；`node scripts/third-party-notices.mjs --check`；`pnpm --filter @saydo/cli verify:distribution`；`[new] node scripts/check-gate-manifest.mjs`；`[new] node scripts/test-gate-manifest.mjs`；说明：I 阶段不运行 predecessor 的 `week-audit --check-bundle`，该门只在通用 E writer 后的 clean E 执行，gate-manifest mutation 负责证明 workflow 可达该 E 门
- full gate：`just ci`；`pnpm exec playwright test`
- evidence path：`e2e/evidence/project-gap-pg-03.md`
- 回滚上限：gate checker 故障时阻断新 claim/RC，不恢复“本地 CI 等效”总括声明。`safe_default=unwitnessed_required_gate_nonzero + local_baseline_not_hosted_or_release`
- 批卡摘要（program §20.5）：runtime safety，规模 S/M；canonical_change=yes。只关闭 G-A2，不做下一 RC。现役 gate/workflow control graph；required/optional 与平台 exact-set；删除 matrix、恒假 if、`continue-on-error`、断 needs、required skip mutations；缺当前 commit 的 gate evidence/freshness 时 overall nonzero。托管 CI、跨平台与 live 的未运行状态必须单独记录，不能由本机 exit 0 填绿。

### PG-04 · audit-new-write-safety

- depends_on：PG-03 evidence commit
- A-ID exact-set：`close_set=[G-A9]`；`stop_loss_set=[]`
- deferred exact-set：`[DF-SP2C1-HISTORY,DF-SP2C2-LOGGER,DF-SP3B-DIST]`
- scope roots：`packages/daemon/src/obs/**`、audit SQLite sink、`audit.record(...)` 全 callsite exact-set、`packages/contracts/**` 的 selected audit schema、`docs/09-data-contracts.md`、`docs/modules/e-crosscutting.md`、logger/audit tests、`scripts/{audit-sensitive-inventory.mjs,test-audit-sensitive-inventory.mjs}`
- focused gate：`FG-PG04-AUDIT` = `[new] pnpm --filter @saydo/daemon exec vitest run test/logger.test.ts test/audit.test.ts`；`[new] node scripts/audit-sensitive-inventory.mjs`；`[new] node scripts/test-audit-sensitive-inventory.mjs`
- full gate：`just ci`
- evidence path：`e2e/evidence/project-gap-pg-04.md`
- 回滚上限：保持 stop-write 与最小 safe envelope；sink 可 fail-closed/告警，不能恢复原文。`safe_default=stop_unsafe_write + safe_envelope + history_inventory_only`
- 批卡摘要（program §20.5）：runtime safety，规模 M；canonical_change=yes。D13 只阻塞历史处置，不阻塞本批。稳定 event ID + typed envelope；已知事件 exact schema；未知 meta 仅允许 safe scalar allowlist 或 digest；对 DB、备份、副本生成逐对象 history inventory 与隔离状态，不做不可逆变换。普通 logger/correlation/capacity 不在本批。

### PG-05 · db-safety

- depends_on：PG-04 evidence commit
- A-ID exact-set：`close_set=[G-A5]`；`stop_loss_set=[]`
- deferred exact-set：`[DF-SP2A1-DATA]`
- scope roots：`packages/daemon/src/storage/**`、`packages/daemon/src/backup/**`、直接迁移入口与 storage/backup tests、`docs/09-data-contracts.md`；config/receipt/client 只在被现役 DB schema 直接触及时列入 exact-set
- focused gate：`FG-PG05-DB` = `pnpm --filter @saydo/daemon exec vitest run test/storage-migration-v5.test.ts test/storage-checks.test.ts test/storage-crash.test.ts test/storage-roundtrip.test.ts test/backup.test.ts`；同组测试必须包含 live main+WAL/SHM 一致读取、quiesced copy immutable probe、WAL-only future/gap、每种生产 migration（含 additive）恢复点及故障点反例
- full gate：`just ci`
- evidence path：`e2e/evidence/project-gap-pg-05.md`
- 回滚上限：保留迁移前 snapshot；固定旧 compatible artifact，只读/拒绝不兼容库；不做未验证逆向 DDL。`safe_default=consistent_read_then_refuse_incompatible + snapshot_before_every_production_migrate + no_reverse_DDL`
- 批卡摘要（program §20.5）：runtime safety，规模 M；canonical_change=yes。只关闭 G-A5，不顺带兑现 G-B3 的所有 workspace/RPO/RTO 支持。open/inspect/migrate 分离；backup 只读不迁移；每一次 production migration 前建立可恢复点。

### PG-06 · admission-discovery-tightening

- depends_on：PG-05 evidence commit
- A-ID exact-set：`close_set=[G-A7,G-A8]`；`stop_loss_set=[]`
- deferred exact-set：`[DF-SP2B1-LIVE,DF-AI-DRAFT-FULL,DF-SP4-FORMATIVE,DF-SP5-READ,DF-SP6-EXPAND]`
- scope roots：`packages/contracts/**` 的 selected admission schema、daemon config/provider/resolver/discovery/executor 边界、console setup 对应 surface、`docs/09-data-contracts.md`；AI 草案只提取 exact safety types，不整包下沉；新增 test 路径为 `packages/daemon/test/provider-admission.test.ts`
- focused gate：`FG-PG06-ADMISSION` = `[new] pnpm --filter @saydo/daemon exec vitest run test/cli-capability.test.ts test/provider.test.ts test/setup-onboarding.test.ts test/tier1-security.test.ts test/provider-admission.test.ts`；`pnpm --filter @saydo/console exec vitest run src/lib/setupApi.test.ts`
- full gate：`just ci`
- evidence path：`e2e/evidence/project-gap-pg-06.md`
- 回滚上限：保持 static inventory 与 provider route disabled；不能回到页面加载即探测。`safe_default=unknown_deny + static_inventory_only + zero_probe`
- 批卡摘要（program §20.5）：runtime safety，规模 M；canonical_change=yes。只关闭 G-A7/A8。AI 决策 4/5、D12 未签不阻塞本批，也不在本批实现 live ProbeGrant cage。static inventory 与 production admission 分离；field-aware pre-send gate；自动 probe hard-disable。收口后停在 owner-stop。

## 0. 现状锚点(2026-07-26 00:50 定稿时刻快照;开批时现状以 `HANDOFF.md` 为准)

> **2026-08-21 当前(覆盖下表过期现时态):**Claude 订阅已就位；W5.4-a 纯函数层已收口；**W-Win Windows 原生对齐已收口**(2026-08-22,真机全量门禁 + Linux CI 双 job 绿;evidence `windows-alignment.md`),gate 运输面串行约束随之解除,W5.4-b 的 C1/C2 已在其后合入 `4d2824e`(协议仍是现网 `{cwd, command?}` 超集,可选 `kind`,未知 deny)。官网 FAQ 已按 owner 本轮授权翻转为「Windows/Linux 已开放,常驻安装与系统通知暂为 macOS 实现」。Actions billing 已恢复且 workflow pnpm 版本冲突已由 `3279c0f` 修复,公开仓两 job 已绿。场次 1 = `failed` @ `ada7981c`，待 owner 复验；场次 2–4 = `not_run`。T2 = 组网已就绪，待手机烟测；结论只对 `ada7981c`，不得外推当前 HEAD。T19 × tailnet 合同拍板并回写 canonical + 备份恢复可用，二者都是任何升常驻动作的前置。活动树 / 常驻 runtime / release config 的当前三层坐标唯一以 `HANDOFF.md` §1「当前快照」行为准，本计划不复制第二套现时坐标。

| 面 | 状态 | 证据 |
|---|---|---|
| P0+P0.5 工程 | 收口(rc.1 @ `628f7e4`);P0.5-A 含 presentation 完整形态(§14-A2/A8)已交付 | `e2e/evidence/final-readback.md`/`closeout-verification.md`/`p05.md` |
| 接线批 / 执行器批 | 完成 | `wiring-batch.md`;`executor-batch.md`/`tier1-conformance.md`;2026-07-26 历史证据提交 `602aa09`（不是当前 HEAD） |
| 场次①②③④ | **2026-08-21:**场次 1 = `failed` @ `ada7981c`，待 owner 从步骤 1 复验；场次 2–4 = `not_run`。2026-08-21 00:20 `[t2]` / `listen` 已使旧锁再次作废 | HANDOFF §2-1；`e2e/owner-sessions/session-1..4.md` |
| 真人音频底板 | 已录并烟测 3/5(两条稳定误听登记) | `~/.saydo/owner-audio/` + rerun-smoke.py;journal R45 |
| dogfood 仓 | OctoDesk(coding)+ OctoBlog(writing,窄版后接入) | IMPL-PROMPT-5 §3.5 |
| 外部解锁 | Claude 订阅已就位(CLI-only,Max);Actions billing 已恢复(剩 pnpm 版本键,走公开快照仓);OpenAI key=可选;CURSOR_API_KEY=无额度(购入才解锁 5.9) | HANDOFF §2-5/§2-6;IMPL-PROMPT-5 §3.5 |

## 1. 工作流总表(W1–W9 + 合同轮 R-A/R-B/R-C)——**历史保留；当前唯一串行链见「当前唯一排产链 · PG-00 导入」节**

> 排序原则:dogfood 价值优先,合同轮先行于对应实施批;工期为工程量粗估(墙钟另见 §4)。
> **通则(全 W 适用)**:① 批级 IMPL prompt 生成时每项必须给出**可判定验收锚**,给不出锚 = 合同不熟 = 回 canonical 文件面,不得带模糊项开批;② 合同门机械判定 = 09/10 出现对应节 + 本方案对应行标"合同已落"(照 IMPL-5 §2 E 门模式);③ 合同增量随批走轻量评审,**语义级变更一律先回写本仓 canonical**,批中途撞缺口 = 停该项继续其他;④ 每批收口:evidence 落盘(命名 `w{N}-batch.md`)+ HANDOFF §2 回填 + 本方案 §1 行标状态 + /impl-review readback + **下一批前重估**(继承首发收尾仪式第 4 条)+ W9 触发线巡检一节。

### W1 · 收尾与 dogfood 起步(2–3 天;前置=无,立即可开)——**状态:已收口(2026-07-26,`65559c2→ce24c14` 11 提交;evidence `w1-batch.md`;/impl-review 通过,报告 `research/2026-07-26-saydo-w1-impl-readback.fable.md`)**

| # | 项 | 出处 | 验收锚 |
|---|---|---|---|
| 1.1 | `audio-smoke-5.py` 收编 classic-header 重打包 + m4a 支持;WAVEFORMATEXTENSIBLE 实测知识回填 HANDOFF §5 | R45;IMPL-5 §3.5 | 真人底板直跑 3/5 一致 |
| 1.2 | 两条真实误听("settle barrier→strawberry"/"Gate 0→get 0")入 golden 回归集种子 + 热词调优(拆词/变体权重实验) | R45 | 回归集含两条;调优前后对比记录 |
| 1.3 | 项目层配置生产加载(独立 project schema,白名单反例复跑) | HANDOFF #8-②(owner 已拍:dogfood 第一周) | §12-9 项目层反例绿 |
| 1.4 | 深评 live 触发装配 + 奠基 seedTerms 偏置生产接线;核实 conformance 是否覆盖 0.0(a) 补验(setup/push 钩子覆盖 + `--resume`),缺则补 | IMPL-4 可选尾项;计划 0.0(a) | 深评触发 e2e;seedTerms 进 biasTerms;0.0(a) 证据在案 |
| 1.5 | 价值证据轨周报**增量**:北极星②代理(主动人类分钟)+ 两个手工字段(自报分钟/自发选择率)接入既有 `/api/value-report`;指标矩阵按 05 §4 列全(first-pass/包修改率/readiness outcome 分布/time-to-dispatch/每 outcome 成本/S2 次数/误听纠正/lane 占比);**加"W9 触发线读数"固定栏**(shadow 样本数/golden 语料数/回叫撞车数/检索 miss 数/离机时段占比)。**声明:建议性、只观察,不作 stop/go 门,不改 canonical 北极星** | 05 §4 价值证据轨;`obs/valueReport.ts` 已有北极星① | 周报含新栏,SQL 直出 |
| 1.6 | TTS 调参尾项:核对 phase-1 实测是否已覆盖分句策略首包,缺则补;音色主观选型(owner 听感) | 07 D5 剩余 spike;`phase-1.md` | owner 听感拍板记录 |
| 1.7 | IMPL-5 §3.5 owner 决策回填 HANDOFF §2(billing 8 月/Claude CLI-only/音频 3/5/双 dogfood 仓);音频结果连同真实命令与文件 digest 落 evidence(回填前 3/5 口径以 journal R45 为准) | IMPL-5 §3.5 | HANDOFF §2 与 §3.5 一致;音频 evidence 可复跑 |
| 1.8 | **转写引证 ref 口径统一**:`liveTools.ts` 写 `transcript:<sessionId>#<turnId>` 而 `snapshotter.ts` 要求裸 turnId——user_utterance 类 critical claim 回读必失败;三处(liveTools/snapshotter/verify)统一 + §12 反例 | Codex 18 A-2 实现侧证据;writing 就绪的"核心论点用户亲口确认"依赖此链 | 反例绿;user_utterance claim 回读抽查 e2e 过 |
| 1.9 | **排产源移交落账**:HANDOFF"开工先读"链加 PLAN-2;HANDOFF §1 加"当前批次指针"行(开批写入/收口清除) | 本方案 §4 互斥协议 | HANDOFF 两处在案 |

### W2 · 提前批四项 + 安全五件(4–7 天)——**状态:已收口(2026-07-26,`ce24c14→086001d` 13 提交 + 场次①修复九项;evidence `pull-forward-batch.md`;/impl-review 通过,报告 `research/2026-07-26-saydo-w2-impl-readback.fable.md`;E 阶段按合同门正确顺延至 W4)**。owner 补验待办:**2026-08-21** T2 组网已就绪(`ada7981c`,结论不外推 HEAD)→待手机烟测、TTS live 音色仍由 owner 另定、场次①已 `failed` 待从步骤 1 复验(细则 = [IMPL-PROMPT-5](IMPL-PROMPT-5-PULLFORWARD.md))

launchd 常驻(A)→ T2 薄版切片(B;顺手评估 ntfy X-Call 电话 TTS 作电话形态解锁前的零成本过渡层,07 D11"自带")→ M1 奠基完整版+生长闭环+AGENTS.md 互通(C:OctoDesk 首次真奠基;consolidation 只提名、人批准)→ VAD 免手+语义 EOU+AEC 外放(D;D2 打断语义 spike 已由 SayDo 仓 ADR 结项,07 状态行回写挂 R-C sweep)。

### R-A · 合同轮(本仓 canonical 文件面,重制度;1–2 天+评审)——**状态:已收口。合同已落 + Codex 22 终局追认已回(2026-07-28,报告 `research/codex-findings/22-ra-verification-completion.md`);A1/A5/A6 核心先关闭，原 `not ready_for_review` 的三项翻转条件随后由 RA-closeout 与 A3-armed 关闭：A2 challenge 绑定固化、A3 covered 证据语义与生产恒 armed、pending 生命周期 × capability gate。owner 仍需确认 A3 门拒绝集收窄的产品语义，但不再把旧翻转条件记为在途。canonical 漂移十余处已随 triage 修(开值口径统一/S3 字段勘误/未来时态回收/readinessRef+WebauthnCredential schema 对齐/TTL"投影即锚"裁决/os_biometric 语义收窄/reviewTask acceptanceVerdicts 同步+人评等价承载声明)。W4 合同门不受影响(已收口)**。扩容(2026-07-26):并入场次① canonical 补丁包——dims 最小构造语义 + 空账本 fail-closed(04 §2.2/09 §13)、结果类话术仅回叫链硬规则(10)、桌面录音交互重做(点击起停/键盘长按/录制中反馈,10 §3/11 §5)、语音条+可编辑转写入输入区(10/11)、proposed 包终态语义(09 §2 缺口)、tailnet S2 收据口径对表(04 §5.2)、step_confirm 承载 deferred 裁决(上浮 owner):S3 卡 + writing 窄版

| 项 | 必须裁决的内容 |
|---|---|
| S3 屏幕审批卡合同 | 认证形态选型(WebAuthn platform authenticator/passkey vs macOS LocalAuthentication 辅助,07 补决策,**形态归 owner 拍板**);S3 收据 `auth_strength` 签发链;**merge 接线语义(裁决门,非既定结论)**:候选 = Tier1 卡授权后 daemon 本地合并(相容性论证:人以强认证签发收据、daemon 单次消费执行,须与 04 §5"由人触发"、09 §6.1 requestManualMerge+MergeProof 现契约、08 §6 跨域所有权逐一对齐并回写)——**缺省保持 requestManualMerge + MergeProof 直到合同落**;Hopper 路径 `hopper merge` 解禁边界(保守缺省=仍人工交接,单列裁决);**turn_ref 过约束 CHECK 放宽**(09 §9 注:screen/push 的 runtime_effect P0 过约束,随 additive 迁移放宽);09 §3/§13 面 + §12 反例;**回写面五件**:04 §5.1 措辞精化、09 §6.1 merging 边收据消费触发、10 S3 卡话术、11 §5.4/5.5 审批卡组件(合并按钮语义、"我已合并,核验"降级)、HANDOFF §4 铁律行同步(W4 收尾做) |
| writing 窄版合同 | 09 §6.1 非 coding 收尾边;`explainResult` 判别值(`content_done` 类);10 完成/回叫话术;`enabled_project_types` 开值流程;projects CHECK 迁移(zod+DDL+存量重建同批);写作就绪清单模板落 Brain instructions(02 §5.0 照抄);**git 仓 writing 落盘通道**(OctoBlog 输入;**缺省假设 = 非 coding 无 merging(04 §6),不复用 coding MergeProof**——若 git 仓现实确需合并语义,属 canonical 非 coding 所有权变更,owner 拍板后另行回写,不在窄版内自定);**窄版 settle proof 形态**(最小 = 文章 artifact digest 落盘对账 + writing 的 verify 模板口径;引用覆盖留 R-C)+ **逐节停靠语义**(step_confirm 步界映射大纲节)+ §12 反例落点;窄版不含类型演化通道(parentProjectId 留 R-C) |

### W4 · 实施批:S3 卡 + writing 窄版落地(3–5 天;前置=R-A 合同已落 + W2-C 奠基能力)——**状态:已收口(2026-07-27,`eabc5ac→b5d45e9` 9 提交,含增量 3.7/3.8/3.9 全做;evidence `w4-batch.md`;/impl-review 有条件通过,报告 `research/2026-07-27-saydo-w4-impl-readback.fable.md`)**。readback 三修复项:P0 = 收口 evidence 的 [ok] 字符撞 emoji 门禁致 HEAD 上 `just ci` 红(一分钟修,阻塞下一批开批断言);B-3 = writing verify-fail ⇒ 不 settle 无机械检查(**当时是翻值 enabled_project_types 的 gate，现已关闭并生效**);B-4 = readinessSkeleton"会话建立"第三消费点未接线(随 armed 批)。owner 触点只剩:S3 真人过卡 / OctoBlog 首篇逐节验收

S3 卡(console 卡+认证+收据+合并链;requestManualMerge 降级路径)→ writing 窄版(门禁开值+收尾边+话术+迁移+OctoBlog 奠基接入)→ 10 golden 覆盖扩 writing/S3 卡场景 → **双项目最小并行切片**(双 dogfood 项目各一队列/并发 2 + 同项目串行守恒 + 排队可见——防 OctoBlog 长文任务把 OctoDesk 编码任务挡在单队列里;冲突状态机/黑板完整版留 W6)→ E2E:OctoBlog 一篇真实文章"聊→开始写→成稿→逐节验收→定稿"全链(**选材避开外部网页引证依赖**——窄版无引证合同)+ S3 卡真人过一次。

### W5 · 体验完善批(5–8 天;前置=W4;Claude 订阅已就位;合同增量按通则③)——**W5a 前段批已收口(2026-07-27,`086001d→eabc5ac` 12 提交;evidence `w5a-batch.md`;/impl-review 通过,报告 `research/2026-07-27-saydo-w5a-impl-readback.fable.md`;canonical 待回写 8 条已随后落盘)**:5.1 / 5.2 / 5.3(cancel_resume 档+capabilities 分级)/ 5.5 / 5.7 / 5.10 + 5.11 篮内两项(订阅限流 durable 重放、11 §3 紧凑模式)+ TTS 音色落地已交付;**W5.4-a** 纯函数层已收口(2026-08-20),**W5.4-b** 生产执行主流程与 console/话术**已收口(2026-08-27,收口 SHA `9417b6d`;代码 `8941e1c`)**——经四轮零上下文独立复审(Codex `gpt-5.6-sol`+max)+ 三轮独立返工(Grok `grok-4.6`+xhigh),自身 A 级 0,遗留 6 条 B/C 见 `e2e/evidence/w54b-batch.md` §18.4;**W5 剩余** = **5.4-c 真 Claude hook 冒烟、live conformance 与 canonical 收口**· 5.6/5.8/5.9(挂 §6 二次确认)· 5.3 尾(Tier2 步序循环挂 §6-10)· 5.11 篮剩余六项(批容量顺延,evidence 登记)。**PG-00 disposition（exact-set 见当前唯一排产链节，原文保留）:** `W5.4-c`=`conditional_release_evidence`；`W5.3-tail`=`inventory_deferred(trigger=PLAN-2 §6.10)`；`W5.6`=`inventory_deferred`；`W5.8`=`inventory_deferred`；`W5.9`=`inventory_deferred`；`W5.11-rest-six`=`inventory_deferred`。上述剩余项不再构成当前 next

| # | 项 | 出处 |
|---|---|---|
| 5.1 | decisions[] 摘要层 + `open_on_screen` 打通编辑器 | 05 P1 |
| 5.2 | edit 审批(第四动作:修改后重签)——09 §3 已有骨架(`decision:"edit"`/`superseded_by_edit`/重签句/§12-3 测试项);refDigest/revision 联动细则若超骨架 ⇒ 回 canonical 文件面(R-B 收) | 09 §3(P1) |
| 5.3 | steer 矩阵**增量**:`queued_delta` 已 live(执行器批);本项收窄为 cancel_resume 档落地 + Hopper capabilities 握手消费(steer 能力分级)——**Hopper 桥本体已收口(P0.5-B),不重复排**;Hopper `step_confirm` 缺省仍 unsupported(04 §5.4 矩阵),Tier2 步序循环**先做轻决策**(dogfood 中 route=hopper 且需 S2 的任务出现频次)再实施 | 05 P1;03 §5;04 §5.4;`p05.md` |
| 5.4 | **Claude Code CLI (`claude -p`) Tier1 主档接入**:订阅已就位。**5.4-a**(spike + 审批门纯函数层)已收口。**5.4-b**=生产执行主流程接线——**已收口(2026-08-27)**。C1/C2 首批入库 `4c4bf96`;C1 有界 `system/init` 探针与 C3(console Tier1 卡、任务详情 adapter/observedModel、跨平台话术、backend prompt 保护)于 2026-08-23 补齐;2026-08-27 经四轮独立复审 + 三轮返工修完五条 A 级(含两条安全:圈内 symlink 敏感基名降级、BYOA 身份核验被 mtime/size 缓存绕过)与四条 B/C,收口 SHA `9417b6d`,`just ci` exit 0(daemon 2174 passed/6 skipped)、`playwright` 36 passed。**5.4-c** 仍只承接真 Claude hook 冒烟、live conformance 与最终 canonical 收口,不得把自检 init 探针写成 hook 链已验。CLI 方案本轮不实现 streaming input / live steer，仍使用 `queued_delta` / `cancel_resume`；BYOA `claude_cli` 的条件豁免已随 T18 落地，Tier1 `claude_code` 不使用该豁免 | 计划 0.0(b);HANDOFF #4/#6;evidence `w54a-claude-cli.md`、`w54b-batch.md`;方案 `2026-08-19-w54-claude-cli-tier1.fable.md` |
| 5.5 | 项目级模型/预算覆盖(设置页,08 §6 路由表·项目设置行)——**承载 = daemon 受控设置表,不落 project.toml**(09 §11 白名单:项目层出现 models/providers 等禁键即拒,反例已有,不得放宽)+ `cache_write_input_tokens` 列位;成本三档预设 → §6 二次确认 | 02 §5.1;09 §9 注/§11 白名单 |
| 5.6 | §14-A6 遗留项处置:hard-forget 独立 deletion job 表/per-store progress——canonical 自注"低价值维护负担(owner 反空壳判据)" → **§6 二次确认**(presentation 完整形态 = §14-A2/A8,**已于 P0.5-A 交付**,不在本期) | 09 §14-A6/§9 注 |
| 5.7 | 产物库控制面(时间线/diff/子集导出);sqlite-vec → §6 二次确认(FTS5 不足有记录时) | modules/b B4/B5 |
| 5.8 | Hopper Console 只读投影切 API/SSE → §6 二次确认(现轮询文件在工作) | 08 §5.1 末句;modules/d |
| 5.9 | Cursor SDK transport → §6 二次确认(**CURSOR_API_KEY 无额度,购入才解锁**) | 07 D8;计划 v2.2⑧ |
| 5.10 | **verify oracle 两条 P1 安全债**:① 框架 config(vitest.config.ts 类)在冻结面外,agent 改 config 可绕验证;② verify 执行 env 带 HOME,文件系统凭据面(~/.ssh)未隔离——给受控执行环境方案 + §12 反例 | `tier1-conformance.md` [warn]×2(登记 P1);Gate 0 G3/G4 域 |
| 5.11 | 微项篮(逐项一句验收):会话滚动 gist 蒸馏(modules/a A3"P0 简化"注)· A7 IntentLedger 独立账本(08 §2)· 采访选题 Impact×Uncertainty 校准(modules/a A4 P1)· Context Pack 按模型档自适应 token budget(modules/b B3)· 评估档"读禁闭 spike"(07 D18/09 §11 规则 1——codex/cursor 产品缺省评估资格前置)· 订阅限流 durable 排队重放(09 §11-5"P0.5 再议"清偿)· C8 成本表盘 + E3 指标完整版(08 §2;Langfuse 可选)· cursor BYOA 笼两处"P0.5 实测后补"变量(09 §11 规则 3/4)· acp 供给口径消解(按 07 D18 结案表:进矩阵门槛=六项实测,09"P1 支持"字样悬空)· D9 中文分词/预分词真实语料 spike(07 与 modules 的 sqlite-vec P1/P2 标注冲突一并消解)· `[pricing.llm]` 三键分列(候 owner 价签)· 10 §6 音频级 golden 其余项 · 11 §3 紧凑模式 | 各行内注 |

### remote-mobile-w0 · 8 月临时轨道(2026-08-16 已收口;插在 W5.4 之前)——**状态:已收口(代码 `addfd1965a5144223df3bfa3f7c407976664929a`)**

LAN `remote-mobile` 第 0 步(处方 `docs/review/2026-08-13-mobile-shell-strategy-final.fable.md` §3;范围 `docs/review/2026-08-16-now-vs-later.md`)。完成定义=代码 + 临时 Chromium/LAN 证据,不部署常驻、不宣称真机 WKWebView 狗粮。`just ci` 双矩阵绿;定向 Playwright 6/6;canonical Codex 74 B 已吸收。后续工程顺序现为 **W5.4-c 真 hook 冒烟 / live conformance → R-B 合同轮**。（此句为 2026-08-16 当时顺序；2026-08-29 PG-00 导入后不再是当前 next，`W5.4-c`/`R-B` 见 legacy exact-set）。四场真人验收为 owner 并行轨,不进本代码批。T19 × tailnet 合同已拍板并回写 canonical,备份也已恢复并实测;发布锁仍须 owner 基于新 runtime 重新声明。

### W-Win · Windows 原生对齐(2026-08-21 开;owner 当场授权)

合同:[设计 ADR-004](../adr/design/ADR-004-windows-platform.md)、[工程 ADR-003](../adr/ADR-003-os-adapters.md)。任务级计划:[WINDOWS-ALIGNMENT.md](WINDOWS-ALIGNMENT.md)。
**与 W5.4-b 串行于 gate 运输**(2026-08-22 结项;**红线实际被违反,登记不掩饰**):本批要求独占 `handleGateRequest` / `gate-*.mjs`、W5.4-b 暂停改该面直到本批收口;实际两批从 `11e3653` 并行分叉、同时改门面,合并顺序不构成「满足串行」。门面十处冲突按语义合并(裁决表 `docs/review/2026-08-22-week-crosscheck.md` §2)。协议超集现网 `{cwd, command?}` 不变,可选 `kind`,未知 deny——合并后由 `parseGateWireRequest` 判别联合承载,无 `kind` 走 legacy、未知 `kind` 抛错即 deny。**W5.4-b 关批欠账**:合并态门面复审、Windows 真机复跑四工具三态。**真 Claude hook 冒烟不属于 b 的关批条件**:依 2026-08-19 任务级方案 §6 明确由 W5.4-c 承接;本轮真实 init 只证明零工具身份探针,不得偷换成 hook 已验。

| # | 项 | 验收锚 |
|---|---|---|
| Win.0 | 合同回写 02/03/04/07/09/10/11 + ADR 索引 | 形状以 09 为准;官网 FAQ 仍"暂不支持";目标面+工程对齐进行中 |
| Win.1 | `@saydo/platform` 内核 | 身份/ACL/birth/`killOwnedTree` 单测绿;koffi 失败 fail-closed |
| Win.2 | 工程入口去 bash 硬依赖 | PowerShell 下 Node 门禁 + `scripts/dev.mjs` |
| Win.3 | workspace / 路径词法 / 状态根 | `C:\` 口语可登记;先拒 URI;win32 不再跳过 owner;本地固定 NTFS |
| Win.4 | 实例锁 + supervisor + reaper | 消灭 win32 throw;`alive1`/`pgrep` 退出生产 |
| Win.5 | 具名 Job Object + env 白名单 | verify 隔离 USERPROFILE/HOMEDRIVE/HOMEPATH/APPDATA/LOCALAPPDATA |
| Win.6 | 环回+HMAC 审批门 + `gate-cursor.mjs`/`gate-claude.mjs` | 四律在 win32 绿;macOS gate.sh 零回归 |
| Win.7 | pipeline 信号 + 通知 + 编辑器探测 | pipeline 在 win32 起得来 |
| Win.8 | 本机 `just ci`/`pnpm ci:node` | 非 darwin 用例绿;skip 名单入 evidence |

P1(Scheduled Task、Actions windows-latest、SAPI、官网翻转)不在本行完成定义内。

### R-B · 合同轮(本仓 canonical 文件面,重制度;1 天+评审;W5 收口后串行):规模与通道合同——**PG-00 disposition=`split_deferred`；非当前 next**

edit 审批细则(若 5.2 撞缺口)· **共享黑板实体 + 并发预检**(09 零承载,全新实体)· **回叫聚合摘要合同**(聚合 digest/升级链交互)· **T2 配对/信任五件套的 09 承载面**(一次性票据/Ed25519 JWS/opaque push payload + token digest/Keychain/Noise XX·WS 密文中继/跨设备 resume 的契约化,modules/d 采 OctoDesk 设计;APNs/FCM 直连凭据面按 07 D11)。
**注:电话合同不在 R-B**——电话形态归锁定计划所有(`research/phone-call-impl-plan-2026-07.md` v3 自带 canonical 回写与 Gate 0 addendum 阶段),R-B 不得与其双写。

### W6 · 并行与规模批(4–6 天;前置=W5 主体 + R-B 合同已落)——**PG-00 disposition=`inventory_deferred`；非当前 next**

多任务跨仓并行完整版(合并冲突状态机 + 共享黑板显式化;最小切片已于 W4 前移)→ 回叫聚合 digest(防召回风暴)→ 一句话拆多任务(候选分组确认后 dispatch;10 §2.4 多任务指代消歧话术随做)→ 应急/事故车道(跳过采访姿态的专用车道)。

### W7 · 语音与移动完整版(6–10 天不含 7.2 电话——电话为指针另计;**按项拆估偏乐观、开批时拆子批重估**;前置=W2-B/D + R-B;7.3 与 W6 可并批)——**PG-00 disposition=`inventory_deferred`；非当前 next**

| # | 项 | 出处 |
|---|---|---|
| 7.1 | `asr.partial` 实时分片流式 + 实时字幕(若 W2-D 免手后误听摩擦上升,允许前移) | 工程 ADR-101 注(P1) |
| 7.2 | **电话形态 = 指针,不入本批工程量**:已有锁定实施计划(`research/phone-call-impl-plan-2026-07.md` v3,owner 2026-07-25 定稿——串行 40–55 工程日/关键路径 34–47 日,四道前置门,DTMF 仅 ack/snooze/拒绝红线自带);**解锁触发(其 v3 原文)= 场次②/③ dogfood 跑 1–2 周 + owner 体感"离机只收文字推送"缺口 + 接通率/离机时段数据 → Phase 0 spike**;触发线读数入 W1.5 周报;解锁前的过渡 = ntfy X-Call 评估(W2-B 顺手,不动 canonical) | 锁定计划 v3;04 §4 |
| 7.3 | T2 原生外壳完整版:Capacitor + APNs/FCM 直连(07 D11:JWT/OAuth 凭据面、opaque payload、device token digest、投递表验收)+ PushKit/CallKit 来电式汇报 + 配对/信任五件套(R-B 契约化)+ 原生 VoiceProcessingIO AEC 降级链(07 D12)+ 移动 review(**深度先 owner 选型,05 §6-4 未决——transport/外壳基础先行,review 形态选定后排产**)+ Live Activity 评估(README 点名,docs 无设计——先评估后实施);**开工前置:owner 拍设计 ADR-003 载体**(modules/d 预留 OctoDesk 复用路径)+ **Apple Developer 账号(新花费 $99/年,检查点)** | 05 P1;03 §8;07 D11/D12;modules/d;05 §6-4 |
| 7.4 | S2S 引擎选项(OpenAI Realtime,仅对话呈现层)——**挂 OpenAI key** → §6 二次确认 | 07 D6(P2) |
| 7.5 | 全本地语音栈(MLX)+ 唤醒词常驻 → §6 二次确认(唤醒词与"默认不常听"隐私姿态相逆) | 05 P2;04 §3 |
| 7.6 | ASR 第二家对比门禁(gpt-4o-transcribe;golden 语料计数源=纠错事件+人工标注,300–500 条)——挂 OpenAI key | 07 D4;计划 1.0 |
| 7.7 | G1 说话人标签软过滤升级(视 ASR 能力,条件项,升级后回写 Gate 0 行) | 05 §4 Gate 0 |

### R-C · 合同轮(本仓 canonical 文件面,重制度;1–2 天+评审;启动锚 = R-A 收口 + W4 OctoBlog 首篇有真实反馈):通用化合同——**PG-00 disposition=`inventory_deferred`；非当前 next**

类型抽象(**缺省 = 05 词表四类型 research/writing/marketing/general 执行器合同**;planning 不在缺省集——其完整流程属 P3 场景 2,提前须 owner 在 §6-5 显式勾选并另立范围合同)+ `explainResult` 判别联合扩展 + 统一产物库扩展 + writing 全量(ArticleCitation/引用级引证消费面/归属合同 user_authored·user_quoted/parentProjectId lineage/paper 子档 WritingSpec)+ 类型演化派生子项目通道(05 §6-7 拍板落契约)+ **network_fetch EffectGrant 合同**(枚举+约束表:来源白名单/SSRF·DNS-rebinding 防护/快照留痕/riskLevel/运行时 grant;**按后端能力分行:cursor_cli `egress=uncontrolled` 禁 network_fetch 类预授权,Hopper route preauthorizedEffects 恒空**,Gate 0 G4)+ canonical sweep 攒批(Codex 18 B-4/B-5 尾项:02 research 边界措辞、03/modules-b 产物目录 article 补注、06 §5 术语行、07 D2 状态回写"spike 已结"、产品载体统一使用设计 ADR-003，与工程 ADR-002 observedModel 决策消歧)。
**出口纪律(Codex 19 B-11)**:R-C 每个合同条目必须绑定 schema/validator/正反例/迁移策略/证据路径才算"合同已落";给不出出口的条目留设计 backlog,不得算 W8 范围。

### W8 · 通用化与治理完整版(6–10 天,开批时拆子批重估;前置=R-C 合同已落)——**PG-00 disposition=`inventory_deferred`；非当前 next**

四类型执行器 + writing 全量 + network_fetch 落地 → 记忆治理完整版(自动 consolidation 提名流水/审计/衰减)→ 主动巡检(窄版先行:每晨一次/只读/草稿卡上限;完整版挂使用率)→ remote_repo workspace → 菜单栏分发 → Codex app-server 交互审批评估(spike)。**PG-00：**`Codex-app-server`=`deferred_by_AI_decision_2`（原文 spike 保留，不再构成当前 next）。
**挂起轨(不入批收口判定;每项 = bounded spike + owner gate,外部条件未到保持 deferred 不计欠账)**:Hopper capabilities 演进消费(steer/settle/merge 升级时 bridge 按握手分级升级,设计 ADR-001;bounded = 每次握手能力变化做一次消费评估,不无限跟随)· T3 服务端执行(挂 owner 服务器)· 多人旁听 discovery(合规/说话人分离/授权模型预研+被动旁听实验,owner 触发才开)。

### W9 · 数据触发与校准(持续轨;执行载体 = W1.5 周报"触发线读数"栏 + 每批收口巡检节)——**PG-00 disposition=`preserved_trigger_track`；不是 active/next batch**

| 项 | 触发线(裸数字,可判定) | 宿主批 |
|---|---|---|
| 就绪评估器**四维扩展**(+可执行性+可验证性,04 §2.2 升级清单-1;09 §13 P1 注)+ false-ready 阈值校准 | readiness shadow 样本 ≥200 | 达线后独立小批 |
| **ASR golden 语料**(换 provider 门禁用,07 D4)——与 readiness corpus 是**两套独立资产,不共用**(Codex 19 A-8) | 纠错事件+人工标注累计 300–500 条;每周策展一次 | 7.6 专用 |
| **readiness/safety replay corpus**(≥200 条分层,05 §4 E2 轨) | shadow 样本量同第一行;独立 schema/分层/去重/证据 | 四维校准专用 |
| 奠基"足够"判定门 / 收敛的度(05 §6-2/3) | dogfood 奠基 ≥5 次 / 采访 ≥20 场后各调一轮 | 随 W5/W7 顺做 |
| review 检错仪式(3–5 个植入已知缺陷任务) | 场次②后第 2 周执行一次 | 独立半日 |
| **电话形态解锁**(锁定计划 v3 原文触发) | 场次②/③ dogfood 1–2 周 + 离机缺口体感 + 接通率/离机时段数据 | 触发后按锁定计划独立立项(40–55 日另计) |
| E1/E2 完整实验机器(三臂消融/外部用户轨/预注册非劣检验/盲评,05 §4 登记) | **第二用户出现 或 对外发布前**(05 原文触发) | 触发后立项 |

### ai-supply · AI 供给普适接入与零配置引导(2026-08-27 开坐标;前置 = `w54b-wiring` 已收口)——**PG-00：`AI-ACTIVE`=`superseded_by_PG-00_chain`；`AI-DRAFT`=`archive_deferred`；非当前 next**

**开坐标依据**:`docs/plan/2026-08-24-ai-supply-owner-decisions.md` 决策 1
(owner 2026-08-25 签:「先收口 `w54b-wiring` C3,再排本专题」)。该前置已于 2026-08-27 满足。

**基线锚**(开批时实测,后续会话据此判断坐标是否漂移):

| 锚 | 值 |
|---|---|
| 基线 HEAD | `9417b6decd85cd59157a76c6429752e92e6803df` |
| 主方案 `2026-08-23-ai-supply-universal-onboarding-final.fable.md` SHA-256 | `6641d2b2462fb9e7548f61ad1af9de228dedefcfa7c23b55bd31f0105d69fbd0`(2,484 行) |
| 决策单 `2026-08-24-ai-supply-owner-decisions.md` SHA-256 | `bb61b24be934eb3307abc9ab1cb173c6dfa9ca850b8ab9aca6e0c339db69c2ea`(349 行) |
| 合同草案 `docs/plan/ai-supply-contracts-draft/` | 10 个 `.ts` 合计 45,734 行(wc -l) + README 87 行 |

**范围**已按 owner 已签的四项决策收缩,**不按方案原文 Phase 0–8 全量排**:

- **决策 2**(引入 ACP 适配层;Codex 沿用 `codex exec`,不为其单独建平面)⇒
  §10 Phase 5 按协议(`acp` / `app_server` / `cli_stdio`)重组,取代原九个品牌子批。
- **决策 6**(付费边界双双关闭)⇒ 按方案原文,无额外动作。
- **决策 7**(首发只开放内置受信 connector;第三方声明式 pack 一并推迟)⇒ **本轮最大减重**,
  连带推迟:§4.10 参考实现级扩展内核**整节**、决策 8 的 TUF 双 root registry、
  Connector SDK 对外发布(决策 9 的 `v1alpha1` 顺延)、§9.8 生态包与扩展成本策略,
  以及草案中 `03-extension-points.ts` / `06-sdk-compat.ts` / `08-wire-budget.ts` 的相当部分。
  **这些本轮不做,也不收敛其合同。**

**子批**(A/B 为文档与判断工作;C 起才碰代码;D 的子批待 B 的清单产出后细化,此处不预编):

| 子批 | 内容 | 验收 | 前置 |
|---|---|---|---|
| `ai-supply-scope` | 逐个判定 `ai-supply-contracts-draft/*.ts` 本轮是否需要下沉;核对 v20 十一条 A 级 finding 中哪些因决策 7 而本轮无关 | 「本轮下沉清单 + 仍需修复的 A 级清单」落盘 `docs/plan/`;每个「本轮不下沉」写明依据的决策号 | 本坐标 |
| `ai-supply-contracts` | 按上批清单逐条修仍适用的 A 级 finding(**修的是合同草案,不是再写文档评审**) | 草案在 strict/NodeNext 下 `tsc` 零诊断;每条 finding 的修复有类型级反例(负例编译失败)或测试 | `ai-supply-scope` + **owner 确认清单** |
| `ai-supply-p*` | 下沉 `packages/contracts` 并按方案 §10 各 Phase 实施(Phase 5 按决策 2 重组) | 遵循 §10 各 Phase 的「验收标准」——先读该节开头的定位说明,那 327 条是 gate 脚本规格,不是人工 checklist | `ai-supply-contracts` |

**红线**(摘自 `prompts/204-ai-supply-post-rc4-continuation.md` §4;该文件已于 08-26 入库(`9e9afee`),写入本节时误记为未入库——2026-08-27 月度审计勘误;要点在此固化以自足):

1. **不再起新一轮「三路零上下文终审」**——诊断报告 `docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md`
   已证明该路线不收敛(20 轮、A 级计数在 1–9 间随机游走、零次 PASS)。需要评审时,
   评审对象是**真实代码 + 测试**,不是 Markdown 里的类型体操。
2. **不收敛决策 7 已推迟的部分**(见上「范围」)。
3. **未签的决策不由施工方推断**:决策 3/4/5/8/9 是 Claude 预填草案、决策 10 建议暂缓,
   需要时先上浮 owner。
4. 不动主方案 §17 与 `docs/review/2026-08-24-ai-supply-review-loop-archive.md`(v1–v20 过程存档)。

**必读**(按序):主方案的「本文档的组成」与「owner 决策状态」两节 → 决策单 →
`docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md`(为何停止 v21)→
`docs/plan/ai-supply-contracts-draft/README.md` →
`docs/review/2026-08-25-agent-cli-acp-capability-survey.md`(ACP 生态实证,决策 2 依据)→
`docs/review/2026-08-24-decision-2-impact-analysis.md`。过程记录见 `history/PROCESS-JOURNAL.md` R98–R108。

## 2. 依赖与解锁图

```
W1 ──────────────┐
W2(A/B/C/D)────┼──> 场次②③④/v0.1.0(owner)──> dogfood 常态化
R-A(canonical 文件面;已收口)──────────> W4 ──> W5 ──> W6 ──> W7(7.2 独立)
R-B(canonical 文件面;W5 后串行)─────────────> W6/W7.2/7.3
R-C(canonical 文件面,锚=R-A 收口+W4 首篇反馈)──> W8
外部解锁:Claude 订阅已就位→剩余 5.4-b 接线;OpenAI key→7.4/7.6;CURSOR_API_KEY 购入→5.9;服务器→W8 挂起轨 T3;Actions billing 已恢复(剩 pnpm 版本键,走公开快照仓);Apple Developer($99/年)→7.3
升常驻前置(2026-08-21):T19 × tailnet 合同拍板并回写 09/11 + 备份 `workspace_identity_changed` 恢复可用;二者都未关之前禁止 `just daemon deploy` 灌 HEAD / 加 `SAYDO_MOBILE_LAN`
```

**单仓单批规则(2026-07-29 迁移后)**:本仓任何时刻只允许一个活动批次，合同轮、纯实现批、A5-armed 与 UI 批均按当前指针串行，不以文件集不重叠为例外。互斥靠 HANDOFF §1“当前批次指针”——开批断言指针为空并写入批号，收口清除;非空时其他批一律停。**PG-00：**`A5-armed`=`not_authorized`；`A5-UI`=`not_authorized`。二者不得作为当前 next。
**交接锚(Codex 19 B-4,单仓改写)**:每批开批 pin 本仓 HEAD + 本批依赖的 09/10 关键节 SHA-256;批级 prompt 附“输入 SHA → 改动文件 → 测试/证据 SHA → canonical 回写 SHA”四段链;合同轮回写未经实施会话核验(§0 断言)前，依赖该合同的批保持 blocked。

## 3. 显式边界(本期不含;防过度设计)

1. **P3 未设计项**:多人旁听产品化、场景 2 全流程(阶段流水/拆任务批量派单/协同审阅界面——planning 仅到 R-C 执行器合同为止)、非技术用户模式、文字轮次通道(owner"非目标"表态延续)——docs 无合同无交互设计,"列入即完成"不成立;owner 可随时点设计轮启动。
2. **亮点脑暴 80 条**(05 §6-6):候选池待 owner 挑选,选中者按类型并入对应工作流。
3. **仓库合并已执行(2026-07-29)**;剩余决策线只有**产品载体设计 ADR-003**，非工程排产。T2 外壳按“独立产品”缺省推进，载体决策建议在 7.3 开工前拍板(§5)。工程 ADR-002 = observedModel 豁免收窄条款，勿与产品载体决策混读。
4. **不新增机制**:全部项以 docs/01–11 + modules 既有设计为合同源;合同缺口一律先回写本仓 canonical 并走评审(通则③),不得实现侧自定语义(HANDOFF §4"契约不分叉")。

## 4. 工期、关键路径与风险

- **工程量粗估 30–49 人日**(W1:2-3 / W2:4-7 / W4:3-5 / W5:5-8 / W6:4-6 / W7:6-10 / W8:6-10;W7/W8 相对 W2 刻度偏乐观 2–3 倍,开批拆子批重估)+ 合同轮三轮(各 1–2 天 + 重制度评审)。**电话形态(40–55 工程日)与 E1/E2 实验机器不计入本量**——前者是触发解锁的独立锁定计划,后者挂"第二用户/对外发布"触发;所有"挂触发/挂解锁/§6 二次确认"项**不计入"全部完成"欠账**,其状态以 W1.5 周报触发线读数与 §6 勾选记录为准(Codex 19 B-1 口径)。
- **真实关键路径不是工程量**,是:owner 触点(场次①已 `failed`@`ada7981c` 待复验 / 听感 / 真人过卡 / 手机烟测 / 账号开通)、外部解锁(Claude 订阅已就位、剩 5.4-b 接线;OpenAI key/Apple Dev/服务器;Actions billing 已恢复、剩 pnpm 版本键)、升常驻前置(T19 × tailnet 合同 + 备份恢复)、每批评审来回(经验:readback+回收批 ≈ 批本体等量,journal R38/R39 实证)、W9 数据积累节拍。**墙钟粗估 4–8 周**(参照:首发 34–47 人日估算实际 ≈1.5 墙钟日/批交付,批间隔主要耗在评审与 owner 触点)。
- **大批拆分授权**:W7/W8 预授权拆多个实施子批,每子批独立 prompt+evidence+readback(范围不变的拆批实施侧可自决;范围增删上浮 owner)。
- **风险表**:① 长周期漂移 ⇒ 通则①②④ + 批次指针 + 每批坐标核验;② S3 认证选型 spike 失败 ⇒ R-A 给双方案降级;③ 多任务竞态 ⇒ §12 反例 + CAS 纪律;④ SIP/PushKit 外部审核 ⇒ 账号在 W5 期间开通(§5);⑤ dogfood 与实施同仓干扰 ⇒ 派单走 OctoDesk/OctoBlog,实施走 SayDo,天然隔离;⑥ **实施批与 dogfood 共用 cursor/Claude 订阅时窗** ⇒ 07 D18 纪律 3 并发预检已有,W5.4 前尤其注意;⑦ 价值证据显示某项无用 ⇒ 上浮 owner,不自作主张砍。
- **评审制度**:每批末 code-review subagent(A 级必修);canonical 回写=一致性 subagent+Codex 攒批;合同轮=重制度;readback 用 /impl-review(责任方=owner 在本仓独立会话触发)。

## 5. owner 触点(按推进时点;每项带缺省动作)

| 时点 | 触点 | 缺省动作(无回复时) |
|---|---|---|
| 最近停点 | 场次① `failed` @ `ada7981c` 待 owner 从步骤 1 复验;场次②–④ `not_run`;T2 组网已就绪(只对 `ada7981c`)待手机烟测;W5.4-b 接线;T19 × tailnet 合同 + 备份恢复 = 升常驻前置 | 未授权 commit/deploy=不升常驻;T19 未拍板=禁止灌 HEAD / 加 `SAYDO_MOBILE_LAN` |
| 首发验收 | 场次③④ → `v0.1.0`;W4 S3 卡真人过卡 + OctoBlog 首篇文章验收;周报开始阅读(含触发线读数)+ 两个手工字段自报 | 场次顺延=首发维持未交付；除验收暴露的 A 级问题外不扩 W5 |
| 首发后 | 设计 ADR-003 载体拍板(7.3 开工前);Apple Developer 账号($99/年)与 SIP/ntfy 付费档开通决定;OpenAI key 给/不给(7.4/7.6);CURSOR_API_KEY 购/不购(5.9);§6 二次确认清单勾选 | 未拍设计 ADR-003 ⇒ 7.3 顺延、先做 W7 其余;key 不给 ⇒ 对应项转"挂解锁"不计欠账 |
| 持续 | 每批 readback 触发(/impl-review);多人旁听 discovery/T3 服务器(想启动时说) | 无 |

## 6. owner 二次确认清单(范围克制评审产出;**缺省=全做**,勾"挂触发线"即移出缺省完成集)

> **PG-00：**`PLAN2-default-all`=`superseded`。本表历史原文保留。未被 D17 exact-set 选入的未来项一律 deferred；取消“未回复则缺省全做”。

| # | 项 | 评审建议的触发线 | 现在做的价值 vs 等待代价 |
|---|---|---|---|
| 6.1 | 7.4 S2S 引擎 | 周报"对话体感"连续两周列 top 摩擦 | 级联 TTS 首包 202ms 已达标;03 §3 记录原生语音任务成功率低于文本 |
| 6.2 | 7.5 全本地栈+唤醒词 | 离线场景实际发生/云成本超阈 | 唤醒词与"默认不常听"隐私姿态相逆(04 §3) |
| 6.3 | W8 菜单栏 | owner 点名 | launchd 已解决常驻;自带未做的 Swift/Tauri 选型 |
| 6.4 | W8 remote_repo | 第一个远程仓需求出现 | 双 dogfood 仓均本地 |
| 6.5 | W8 marketing/general/planning 执行器(**research 保留缺省做**) | 类型门禁 `project_type_not_enabled` 首次真实拦截即为该类型排产信号(零建设成本) | owner 日用=coding+writing;research 有真实调研需求 |
| 6.6 | W8 记忆治理完整版 | M1/M2 条目数或提名积压超阈 | W2-C"提名+人批"已兜底;治理先于体量是倒置 |
| 6.7 | 5.7 sqlite-vec | 检索 miss 有记录证据 | FTS5 trigram 实测中英混说召回好(HANDOFF §5) |
| 6.8 | 5.9 Cursor SDK | owner 购 API 额度且要更低延迟 | 当前账号 API key 无额度,死项 |
| 6.9 | 5.8 Console 投影 SSE | 轮询开销可测或 Hopper 顺手提供 | 现轮询在工作,owner 不可感 |
| 6.10 | 5.3 中 Tier2 步序循环 | route=hopper 且需 S2 的任务实际出现 | 04 §5.4 原文"P1 再评"非"P1 做" |
| 6.11 | 5.5 中成本三档预设 | owner 点名 | 单用户直接改 config 即可;项目级覆盖保留缺省做 |
| 6.12 | W6 黑板显式化+聚合完整版 | 一周回叫撞车 ≥2 次或并发 ≥3 常态 | 双 dogfood 项目并发上限 ≈2–3,P0 兜底在案;跨项目并行本体已前移 W4 |
| 6.13 | 5.6 A6 deletion job 表 | owner 点名 | canonical 自注"低价值维护负担" |
| 6.14 | W8 主动巡检完整版(窄版缺省做) | 窄版使用率 | 晨间草稿卡有真实价值,完整形态偏重 |

## 7. 排产驾驶规程(分步执行的机制;可操作性评审裁决:不用静态 driver 驱动九批,**每批临生成独立 prompt**)

1. **源与优先级**:本方案 = 唯一排产源;docs/01–11 + modules + adr = 合同源;HANDOFF = 实施状态真相;冲突即停上浮 owner。
2. **批生命周期**:开批前置断言(前批 evidence + readback 在案 / HANDOFF 批次指针为空 / 本批合同门已落)→ **本仓计划会话临生成批级 prompt**(坐标当场实测)→ owner 停点确认 → 实施会话执行 → 收口(evidence `w{N}-batch.md` + HANDOFF §2 回填 + 本方案 §1 行标状态 + canonical 回写攒批)→ /impl-review readback → 关批(清指针)→ 下一批前重估。
3. **批级 prompt 模板(继承 IMPL-4/5 七件套)**:§0 生成时实测坐标+漂移即停 / §1 必读(HANDOFF §0§4 恒列 + 本批合同节 + 本方案对应 W 节)/ §2 红线(恒律 + 批专属)/ §3 分阶段任务·**每项带可判定验收锚**(给不出锚 = 合同不熟 = 回 canonical 文件面)/ §3.5 owner 决策附注位(批间决策收纳)/ §4 检查点 + 缺省动作("无回复 = 暂停该分支继续其他")/ §5 诚实汇报(三级词表/真实 SHA/两提交法/**门禁退出码显式核查、不得管道取尾——W1 事故教训 2026-07-26**)。
4. **合同门机械判定**:09/10 出现对应节 + 本方案合同轮行标"合同已落";实施批 §0 断言之。
5. **交接锚**:§2 依赖图注的四段 SHA 链;合同轮进行中其他会话不得写相同 canonical 文件。
6. **拆批授权**:W7/W8 预授权拆子批(范围不变自决,范围增删上浮);每子批独立 prompt+evidence+readback。
7. **W9 巡检**:每批收口仪式含"触发线读数"一节(数据来自 W1.5 周报);达线项由本仓计划会话立即立项。
8. **执行顺序(历史;2026-08-29 PG-00 导入后当前唯一链见「当前唯一排产链」节,唯一 next=`PG-01A`)**:IMPL-PROMPT-6(W1)→ IMPL-PROMPT-5(W2)→ IMPL-PROMPT-7(W5a)→ IMPL-PROMPT-8(W4)→ **RA-closeout(2026-07-28 已收口,evidence `ra-closeout-batch.md`:pending 裁决 (a) 案 + promoteProject 接线 + A2 挑战绑定固化 v12 + 迁移框架 FK 合规 + tailnet 对表等六小项;deploy @ `c59edd1`,writing 已翻值)** → **A3-armed(2026-07-28 已收口,`2f2f7d8→103e2f6` 5 提交,随后语音稳定性与双动作修复继续部署，2026-07-29 runtime clean @ `838aeea`;活动仓迁移提交 `f28489d` 尚待部署时窗;方案 `research/2026-07-28-a3-armed-design.md` v1.2,评审链 = 双 SA + Codex 23 5A/7B 全吸收;canonical 09 covered 块等 18 处已落;核心 = 候选绑定→复述确认升格(人在环)、ReadinessBinding 一等实体(v13)、checklist/evidence 双 digest 版本、dispatch 消费事务内权威复核、pending 最小清单、门拒绝集收窄 isReadinessBlocking([warn] owner 声明项)、生产恒 armed;§12-15 反例 22 例,批末 review 1A/2B 全修;Codex 22 五条关闭条件全闭——R-A ready 翻转条件仅剩 owner 对门语义收窄的确认;evidence `e2e/evidence/a3-armed-batch.md`,journal R55)** → **W5.4-a**(2026-08-20 已收口,纯函数层,evidence `w54a-claude-cli.md`) → **W5.4-b**(2026-08-23 收口候选,C1/C2/C3 已落,双向审计回修与复审进行中)。**8 月体验工程**(T16–T20/M1/D1/上架)已合入 main,此前未映射进本表;2026-08-16 owner 停点确认插入 **`remote-mobile-w0`**(LAN 进壳第 0 步,处方 `docs/review/2026-08-13-mobile-shell-strategy-final.fable.md` §3;**已收口,代码 `addfd1965a5144223df3bfa3f7c407976664929a`**)。该批不取代 W5 剩余、**完成定义仍是不部署常驻**。下一工程批是 **先关 W5.4-b 复审 → W5.4-c 真 hook 冒烟 / live conformance**,随后 **R-B 合同轮 → A5-armed → 就绪确认卡 UI 批**,每次只开一个批。（此「下一工程批」为历史指针，2026-08-29 PG-00 已 supersede；`W5.4-c`/`R-B`/`A5-armed`/`A5-UI` 见 legacy exact-set，不得作为第二个 next。）四场真人验收为 owner 并行轨:场次 1 已 `failed` @ `ada7981c` 待复验,场次 2–4 `not_run`;不进本代码批、也不排到全部工程之后。
9. **journal 纪律**:合同轮按 AGENTS.md 记轮次;实施批收口后在本仓 journal 补一行索引(R44/R45 模式)。
