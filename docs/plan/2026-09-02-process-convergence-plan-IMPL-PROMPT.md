# PROC-01 流程收敛 实施 Prompt(SayDo)

> 交接对象:新会话的实施线(默认 Grok `grok-4.6/xhigh`),由 `/supervised-delivery` 派发与验收。本 prompt 是实施线的全部世界;它没有本会话的任何上下文。
> 方案:`docs/plan/2026-09-02-process-convergence-plan.fable.md`(下称"方案")。本 prompt 只覆盖方案 §3.1 的 PROC-01 五个阶段;§3.2 的批卡补丁、§3.3 的 PG-07 / PG-08、§3.5 的仓外清单都不在本 prompt 内。
> 状态词:全文与所有产出只用 `[ok]` / `[warn]` / `[fail]` / `[divergent]`,零 emoji(AGENTS.md 硬规则 1)。

## 0. Workflow V2 contract(原样保留,不得被后文放宽)

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```

## 0A. 坐标核验(先做,漂移即停)

逐项用命令核验,任一不符就停下向 supervisor 报告,不"应该差不多"地继续:

1. 仓库 `~/WorkSpace/SayDo`,`git rev-parse --abbrev-ref HEAD` 为 `main`,`git status --porcelain` 为空。P(本批 predecessor)= 派发时 `git rev-parse main` 的完整 OID;方案写作时为 `b32e878`,若已前移,以 supervisor 在派发消息里给出的 P 为准,并记录差异。
2. 方案文件存在且为方案 §7 已记录评审的版本:`shasum -a 256 docs/plan/2026-09-02-process-convergence-plan.fable.md` 与 supervisor 给出的值一致。
3. `docs/plan/IMPLEMENTATION-PLAN-2.md:10` 仍含"唯一 next=`PG-01A`(未开工)"(这是要修的过期表述);`HANDOFF.md:49` 含 `active=none`,`next=PG-01B`。
4. `grep -n 'check-active-claims\|check-public-tree-privacy' justfile package.json .github/workflows/ci.yml .github/workflows/release.yml` 为空。
5. `ls .octoworkflow/project-profile.md docs/README.md docs/plan/OWNER-DECISIONS.md docs/adr/design/ADR-005-execution-single-route.md scripts/schedule-pointer.mjs scripts/check-gate-list-parity.mjs` 全部不存在。
6. `sed -n '9,22p' ~/.octoworkflow/project-profile-template.md` 查看模板字段;若已含 `report_conventions`,P2 直接用它,否则按 P2 的"项目附加节"落法。
7. `python3 ~/.octoworkflow/cycle_control.py --help | grep -c rebind-control-dir`:为 0 时,本批的 control 目录按 §6 的 pending-rebind 落法处理。
8. `.git/info/saydo-private-probes` 存在(本地隐私探针);`node scripts/check-public-tree-privacy.mjs --ref "$(git rev-parse HEAD)"` 对当前 HEAD exit 0。
9. `python3 -c 'import yaml; print(yaml.__version__)'` 可用(P3 的 YAML 解析命令依赖 PyYAML;方案写作时为 6.0.3)。

## 1. 必读(按序完整读)

1. 方案全文(§0–§7):本批做什么、为什么、验收是什么。
2. `AGENTS.md`:硬规则与评审制度现文(P2 要改写它)。
3. `docs/plan/2026-08-28-project-gap-closure-program.md` §20.2(1447–1486 行):I/E 两提交纪律,九条对本批全部适用;PROC-01 是正式小批,I 中指针为 `active=PROC-01,next=none`,E 中为 `active=none,next=PG-01B`。
4. `docs/plan/IMPLEMENTATION-PLAN-2.md` 1–60 行与 `HANDOFF.md` 1–60 行:排产指针现状。
5. `~/.octoworkflow/project-profile-template.md`、`~/.octoworkflow/risk-tiers.md`、`~/.octoworkflow/supervised-delivery.md`:profile 字段、L 分级、派发纪律。
6. `docs/adr/design/ADR-001-execution-layer.md`、`docs/adr/design/ADR-004-windows-platform.md`(ADR 写法与状态行格式)、`docs/03-architecture.md` §5、`docs/05-roadmap.md` §1–§2、`docs/09-data-contracts.md` §6.1(526–560 行)、`docs/plan/2026-08-15-default-runner-decision.md` §四:P4 的 ADR-005 依据。
7. `scripts/check-public-tree-privacy.mjs` 60–100 与 236–262 行:`--ref` 要 40 位 SHA,缺私有探针时 `--ref` 模式必须带 `--allow-missing-probes`。
8. `history/README.md`(journal 编号政策)与 `docs/plan/README.md`(索引落法)。

## 2. 红线摘要(违反任何一条即停)

1. 零 emoji;所有新文件在写完后过 `bash scripts/check-emoji.sh <file>`。
2. 不改 `packages/**`、`pipeline/**`、`apps/**`、`deploy/**`;不改 `docs/09` 的 zod / DDL / 状态机文字;契约不分叉。
3. 只按 P1 把 PROC-01 加入 PLAN-2 串行链(链与断言字符串改为 `PROC-01 → PG-01B → …`)并写入 PROC-01 批卡;不改其他任何批卡的 A-ID / scope / gate 字段,不改 legacy disposition 表。
4. HANDOFF 的指针段只能由 `node scripts/schedule-pointer.mjs --render` 改写,不手写;I 中指针块与 HANDOFF 生成块为 `active=PROC-01,next=none`,E 中为 `active=none,next=PG-01B`;指针块不含任何提交 OID。
5. 不写任何本机绝对路径进受管文件(`/Users/...`);每次 commit 前 `node scripts/check-public-tree-privacy.mjs --fs` 必须 hits=0。
6. 不 `git add -A`;只用 explicit pathspec;不带入 preexisting dirty bytes;不顺手清债。
7. 不派 subagent、不调用 reviewer、不自评 GREEN、不 commit / amend 未经 supervisor 确认的 I、不 push、不 merge、不部署。
8. `.github/workflows/*.yml` 只增加步骤,不改触发器、权限与既有步骤顺序。
9. 不新增第二个排产状态文件;`schedule-pointer` 只存在于 PLAN-2 顶部一处。
10. Gate 0、S0–S3、审计不可变、TTS 脱敏等产品硬规则本批不触碰,也不在文档里放宽。

## 3. 分阶段任务(每阶段:做什么 / 改哪些文件 / 验收 / 门禁;`gate_mode=local_first`)

各项目门禁来自本项目阶段验收合同(即下表);本地必须覆盖全部 focused gate 与 full gate;远端覆盖只有公开快照仓 CI(不在本批范围,标 `LOCAL_GREEN_REMOTE_PENDING`)。无 GitHub CI 不是本地失败;远端产品 RED 不能用本地绿掩盖。有类型 / 编译边界的改动本批没有(零产品代码),focused 合同以脚本自身运行与文档门为主。

### P1 · 现势单源(L2)

- must_change:`docs/plan/IMPLEMENTATION-PLAN-2.md`(顶部加 `schedule-pointer` 围栏块;串行链与断言字符串改为 `PROC-01 → PG-01B → …`;新增 PROC-01 批卡,字段取自方案 §3.1;修 `:10` 的"唯一 next=PG-01A(未开工)"为指向指针块的一句)、`HANDOFF.md`(§1.1 指针行由 `--render` 生成;「开工先读」句中的串行链文字同步改为 `PROC-01 → PG-01B → …`)、`docs/plan/2026-08-28-project-gap-closure-program.md`(§20.2 第 4 / 7 条各加一行补注)、`docs/plan/2026-08-28-project-gap-d17-import-spec.md`(§4.2 加一行补注)、新增 `scripts/schedule-pointer.mjs`、新增 `docs/plan/project-gap-closure/README.md`。
- 指针块字段:`schema_version`(1)、`revision`(单调整数,首版 1)、`active`(`none` 或批 id)、`next`(批 id 或 `owner-stop`)、`last_closed`(`PG-01A`)、`evidence_ref`(`e2e/evidence/project-gap-pg-01a.md`)、`updated_at`(ISO 日期)。不含任何提交 OID(E 不写自身 SHA);下一批的 P 由下一批开批时从已存在的 E 读取。I 中写 `active=PROC-01,next=none`,E 中写 `active=none,next=PG-01B`。
- 检查器 `--check`:块可解析且字段齐全;`active` 与 `next` 不同时非空(`active=none` 时 `next` 必填);`revision` 不低于 `git show main:docs/plan/IMPLEMENTATION-PLAN-2.md` 中的值(main 上尚无块时视为 0);HANDOFF 生成块与 PLAN-2 块逐字段一致;PLAN-2 每张批卡标题里的"状态:已收口"与 `last_closed` / `active` 不矛盾。`--render`:只改写 HANDOFF 中带 `<!-- schedule-pointer:begin -->` / `end` 标记的段落。`--self-test`:在 `git worktree add --detach` 的临时目录里依次制造四种坏例(HANDOFF 生成块改坏、`revision` 回退、`active` 与 `next` 同时非空、把已收口批卡状态行改成"未开工"),对每例运行 `--check` 并断言非零,最后清理临时 worktree。
- 验收:`node scripts/schedule-pointer.mjs --check` 对候选树 exit 0;`node scripts/schedule-pointer.mjs --self-test` exit 0,输出列出四个坏例各自的非零 exit;两条命令的原始输出写进 evidence。
- focused gate:`node scripts/schedule-pointer.mjs --check`;`node scripts/schedule-pointer.mjs --self-test`;`bash scripts/check-emoji.sh`;`node scripts/check-doc-links.mjs`;`git diff --check`。

### P2 · 规则迁移(L2)

- must_change:`AGENTS.md`(「评审制度」节改写)、新增 `.octoworkflow/project-profile.md`、新增 `docs/README.md`、新增 `docs/plan/OWNER-DECISIONS.md`、`docs/plan/README.md`(索引加方案与本 prompt)。
- AGENTS.md「评审制度」改写要点:实施 / 修复 / 交付走 `/supervised-delivery`(每 candidate 一名零上下文 reviewer,预算按 `~/.octoworkflow/v2-policy.json`);设计文档评审保留互补双视角,但每个版本最多 2 轮对抗 + 1 轮回修,第 3 轮需 owner 当前消息明示;风险等级(L1/L2/L3)只改变 review scope、coverage matrix 与 owner checkpoint,不改变 reviewer 数量;派发纪律(候选先冻结、派发前后各算一次 `python3 ~/.octoworkflow/candidate_fingerprint.py`、评审 prompt 固定核验清单 + 判断维度不超过 3–4 个、超时按历史 p90);"施工与评审只在独立 worktree/clone,主树只合并、只读与收口";报告落点、状态词、命名规则只在 `.octoworkflow/project-profile.md` 一处定义,AGENTS.md 只留一句指针:"报告状态词、落点与命名以 `.octoworkflow/project-profile.md` 为准;OctoWorkFlow 阶段 D 落地前,全局 skill 的默认状态词与路径不适用于本仓,派发 prompt 须重述"。保留 AGENTS.md 其余全部内容与措辞。
- profile:模板现有 10 个字段全部填写(`risk_path` 列 Gate 0 / S3 语音 / TTS 脱敏 / 记忆写路径 / 审计不可变 / 公开快照隐私 / 发布合同 / DDL 迁移铁律;`focused_gates` 引用 PLAN-2 批卡的 FG-* argv;`full_gate` = `just ci` + `pnpm exec playwright test`;`ci_mode=local_first`,远端信号 = 公开快照仓 CI,私有归档 CI 停摆期间标 `LOCAL_GREEN_REMOTE_PENDING`;`owner_checkpoints` = rc bump / 发布、npm publish、官网部署、公开快照、常驻 runtime deploy、真人场次;`roles_runtime` 指向 `~/.octoworkflow/v2-policy.json`;`pinned_policy_revision=2.4.2`;`cycle_control_path=docs/plan/<task>/`;`cycle_state_path=docs/plan/<task>-cycle.json`)。报告约定(状态词 `[ok]/[warn]/[fail]/[divergent]`;对抗评审落 `research/codex-findings/`,readback 落 `docs/review/`;命名 `YYYY-MM-DD-<slug>[-review|-repair|-retry].md`):模板有 `report_conventions` 字段就写进字段,否则写在文件末尾"项目附加节:报告约定"并注明"待模板字段落地后迁入"。
- `docs/README.md`:一页索引,列 01–11、modules、adr(设计 / 工程两序列)、plan、review、release、site、store 各一行。`docs/plan/OWNER-DECISIONS.md`:只做索引表(ID、提出日期、原文位置、缺省动作、触发线、状态),覆盖 journal R114 尾部待决 1–9、`docs/review/2026-09-02-monthly-docs-commit-crosscheck.md` §5 的 1–3、`docs/plan/2026-08-28-project-gap-owner-decisions.md` D1–D19、`docs/plan/2026-08-24-ai-supply-owner-decisions.md` 1–10;不复制原文,不代签,不改任何决策单。
- 验收:profile 字段齐全且每条门禁命令在本仓真实存在(`ls` / `grep` 核);AGENTS.md 不再出现"两个互补角度的 subagent"作为实施期要求,不重复 profile 内的约定;OWNER-DECISIONS 条目数与四个来源逐一对得上。
- focused gate:`bash scripts/check-emoji.sh`;`node scripts/check-doc-links.mjs`;`git diff --check`。

### P3 · 候选门补位(L2)

- must_change:`justfile`、`package.json`、`.github/workflows/ci.yml`、`.github/workflows/release.yml`、新增 `scripts/check-gate-list-parity.mjs`。
- 四处同时加入两步:`node scripts/check-active-claims.mjs`;隐私探针对候选树扫描——`justfile` 与 `package.json` 用 `node scripts/check-public-tree-privacy.mjs --ref "$(git rev-parse HEAD)"`,`ci.yml` 与 `release.yml` 用 `node scripts/check-public-tree-privacy.mjs --ref "$GITHUB_SHA" --allow-missing-probes`(runner 无私有探针文件;私有探针层只在本地与公开快照前生效,在 evidence 写明这一分层)。
- parity 脚本:解析四处清单(justfile 的 `ci-node` 配方、package.json 的 `ci:node`、两份 YAML 的 node / quality-node job 的 `run` 步骤),只提取并比较两个候选门的命令名集合(`node scripts/check-active-claims.mjs` 与 `node scripts/check-public-tree-privacy.mjs`),断言四处相等;flag 差异白名单只允许本地 `--ref "$(git rev-parse HEAD)"` 与 hosted `--ref "$GITHUB_SHA"` 的参数形态,以及 hosted `--allow-missing-probes`。不做 mutation 自测;脚本头注明"PG-02 gate registry 落地后删除"。owner 2026-09-02 recovery:本句 supersede 此前把全部 `node scripts/` / `bash scripts/` / `pnpm` 命令纳入比较的误写,恢复方案「只比较候选步骤的命令名集合」。
- 验收:`node scripts/check-gate-list-parity.mjs` exit 0;本地探针对 HEAD exit 0;`python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/ci.yml` 与对 `.github/workflows/release.yml` 各 exit 0(本机 PyYAML 6.0.3;仓内无 hoisted 的 js-yaml / yaml 包)。
- focused gate:`node scripts/check-gate-list-parity.mjs`;`node scripts/check-public-tree-privacy.mjs --ref "$(git rev-parse HEAD)"`;`node scripts/check-active-claims.mjs`;`python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/ci.yml`;`python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/release.yml`;`bash scripts/check-emoji.sh`。

### P4 · 执行层 canonical(L3:canonical 变更,fresh reviewer 的 coverage matrix 必须含"ADR-005 与四处状态注不矛盾"的正反例)

- must_change:新增 `docs/adr/design/ADR-005-execution-single-route.md`;`docs/adr/README.md`(登记);`docs/03-architecture.md` §5(Tier 2 段末加一行状态注)、`docs/05-roadmap.md` §1–§2(Hopper 行加状态注)、`docs/09-data-contracts.md` §6.1(route 行注释加"route=hopper 见设计 ADR-005:designed/deferred",不改 schema 与 DDL 文字)、`templates/saydo.config.example.toml`(`[hopper]` 节加 deprecated 注释)、`docs/adr/design/ADR-001-execution-layer.md`(文首加一行"交付附注中'首发 = 完整双路径'由设计 ADR-005 supersede;架构决策正文不变")。
- ADR-005 内容:状态"已决策(owner 2026-09-02)";决策范围 = 执行路线;决策 = Tier1 为唯一生产路线(后端 `cursor`、`claude_code` 已有,`codex` 待 PG-07),Hopper 桥 `designed/deferred`(保留 schema 与 dormant 代码、不再维护、锁副本与专用 vault 可删),`native_api` 执行器为 PG-08 候选(用途、边界、估算引 `2026-08-15-default-runner-decision.md` §四);证据 = 方案 §1.6 的坐标;后果 = 少维护 1,141 行桥 + 677 行测试 + 一个外部二进制;不 supersede ADR-001 的架构决策正文,只 supersede其交付附注。
- 验收:机械断言——`grep -c '设计 ADR-005' <file>` 对 `docs/03-architecture.md`、`docs/05-roadmap.md`、`docs/09-data-contracts.md`、`templates/saydo.config.example.toml`、`docs/adr/design/ADR-001-execution-layer.md` 每个 ≥ 1,`grep -c '^## ' docs/adr/design/ADR-005-execution-single-route.md` ≥ 4;语义一致性由 supervisor 派的 fresh reviewer 复核(不另加 reviewer);`pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts` exit 0(证明 09 合同未变)。
- focused gate:`bash scripts/check-emoji.sh`;`node scripts/check-doc-links.mjs`;`pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts`;`git diff --check`。

### P5 · 证据卫生(L1)

- must_change:`justfile`(新增 `precommit` 配方 = `bash scripts/check-emoji.sh` + `node scripts/check-doc-links.mjs` + `node scripts/check-public-tree-privacy.mjs --fs` + `node scripts/schedule-pointer.mjs --check`);`.octoworkflow/project-profile.md`(命名规则已在 P2 写入,本阶段只核对)。
- 不做:`check-review-index.mjs`、journal 按月拆分、HANDOFF 历史行搬迁、根目录文件搬迁(全部 PROC-02)。
- 验收:`just precommit` 在候选树 exit 0,耗时写进 evidence。
- focused gate:`just precommit`。

### 收口(I / E 两提交,由 supervisor 主持)

- I:唯一一个 `parent(I)=P` 的 implementation commit(PLAN-2 指针块与 HANDOFF 生成块为 `active=PROC-01,next=none`),explicit pathspec,`must_change ⊆ changed ⊆ must_change ∪ may_change`,`changed ∩ must_not_change = ∅`;`may_change` 只有 `docs/plan/README.md` 与 `docs/adr/README.md`;`must_not_change` = 红线 2 的目录 + `docs/09` 的非注释行 + 所有 PG 批卡字段。
- full gate(clean I validation worktree,短路径 TMPDIR,`env -u SAYDO_LIVE_E2E -u SAYDO_SLOW_E2E`):`just ci` exit 0;再跑 P1–P5 全部 focused gate。
- E:evidence 文件 `e2e/evidence/process-convergence-proc-01.md`(§20.2.1 最小 schema:exact pathset、P / I OID 与 tree、focused / full gate 每条命令与 exit、readback 身份、四种坏例的命令与输出、`just precommit` 耗时、not_run exact-set);supervisor 在 E 中把指针块改为 `active=none,next=PG-01B`(`revision` +1)并 `--render`;`node scripts/week-audit.mjs --write` 的实际变化子集随 E 入库;clean E 上重跑 emoji、doc-links、`week-audit --check-bundle`、`git diff --check <P>..<E>`、`node scripts/check-public-tree-privacy.mjs --ref <E 完整 OID>`、`node scripts/schedule-pointer.mjs --check`。
- control 目录:`docs/plan/process-convergence/`(冻结 2.4.2 policy + acceptance contract),cycle-state `docs/plan/process-convergence-cycle.json`。若 0A 第 7 项为 0(工具尚无 `--rebind-control-dir`),control.json 会含本机绝对路径:入库前脱敏为 `<repo>/docs/plan/process-convergence`,同时在 evidence 记录脱敏前 `--verify-freeze` 的 exit 与 `pending-rebind` 标记;不把 exit 5 写成绿。

## 4. 节奏与检查点

自治推进 P1 → P5;每阶段收尾自测后停下等 supervisor 的 focused gate 与 fresh review,不自审、不派 reviewer。必须停下等 owner 的点:P4 的 ADR-005 决策文本(owner 2026-09-02 已授权方向,文本落地前给 owner 看一眼);E 之前;任何 push / merge / 部署(本 prompt 不授权)。偏离方案的决策(例如 profile 字段与模板不合、YAML 解析器不可用)先报告再动。

## 5. 诚实汇报要求

- 完成度用 `[ok]` / `[warn]` / `[fail]` / `[divergent]`;每个 `[ok]` 给证据:本会话真实 `git log` 的 commit hash + 门禁命令原始输出摘录。
- 跳过的步骤明说"跳过 + 原因";没做的明说没做;不得返回虚构 SHA、虚构测试计数。
- 列出负向需求与无关工作区并证明未越界:`git diff --stat <P>..HEAD` 与 must_change 逐项对照;`git status --porcelain` 无非 ignored untracked。
- 收尾自检并留证据,供 `/impl-review` 对账。

## 6. 工作方式约定

- 从 P 建 `codex/proc-01-process-convergence` 分支与独立 worktree(或独立 clone);主树不施工。`pnpm install --frozen-lockfile --offline` 取基线,不把依赖安装当门禁通过。
- 提交粒度:候选形成前不 commit;候选完成后停止实施线,把 diff 与 focused 结果交给 supervisor。由 supervisor 入口 `/supervised-delivery` 先 `RECONCILE` 再启动一名全新零上下文 reviewer;首次可复现 P0/P1 由 supervisor 自动返工一次并对新 candidate 做一次 fresh_zero_context 复审;有可核验进展时可在最多 3 次产品修复、最多 3 次复审内继续,第二次红灯不自动等于找 owner。
- 遇阻(命令不存在、门禁红且非本批引入、模板字段缺失):停下报告 exact cause 与证据,不绕过、不改宽。
- 工具层等待:长命令用 `~/.octoworkflow/await_external_cli.py` 设置 hard timeout,由 runner 在工具层阻塞等待完成通知;完成前不由模型查状态。

## 6A. Deferred P2 ledger

本任务唯一 ledger:`docs/plan/2026-09-02-process-convergence-plan-DEFERRED-P2.md`(首次出现 P2 时复制 `~/.octoworkflow/deferred-p2-ledger-template.md` 创建;没有 P2 不创建)。单阶段 P2 只登记不返工;最终交付前按最终 candidate 重验、去重并最多批量处理一次;P3 不进入该 sweep。跨会话只传路径与未结 ID。

## 7. 会话上下文预算

soft、首次 compaction、跨日与 unknown usage 不强制 RECONCILE,只短 checkpoint 并建议交接;hard 或真实 context-limit 才 checkpoint / `RECONCILE`;已授权自动推进时不重复确认。不因软阈值拒绝已授权下一步。细则:`~/.octoworkflow/context-budget.md`。不豁免零上下文独立 review 或质量预算。
