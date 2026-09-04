# SayDo 流程收敛方案（PROC-01）:一份现势、一套评审、一张门禁表、执行层单路线

> 日期:2026-09-02 · fable · 状态:待 owner 批准导入(本文不是排产源;唯一排产源仍是 `IMPLEMENTATION-PLAN-2.md`)。
> 定位:SayDo 是给人类用户的完整产品。本方案只做一件事——让工程流程为"把可信的产品交到用户手里"服务:收敛状态、评审、门禁、证据与执行层,不给流程加重量。SayDo 消费 OctoWorkFlow 的 policy 与 skill,但不复制它的工具;SayDo 自己的门禁、状态与证据是产品工程资产,以本仓 canonical 为准。
> 输入:(1) 2026-09-02 只读会话对 SayDo / OctoWorkFlow / Hopper / OpenClaw-MultiAgent-Kit 的实读与命令核验(坐标 SayDo `main=b32e878`);(2) 同日 Codex 独立审计(owner 转交,锚 `6c6b8c4`);(3) owner 同日决定:Hopper 提交后冻结、OpenClaw 事务线不再保留、`native_api` 按本文 §3.3 排。
> 关系:owner 批准本方案后,PLAN-2 的唯一串行链改为 `PROC-01 → PG-01B → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop`。PROC-01 是一个正式的小批(改脚本、门禁、workflow 与文档,不改产品代码),按 program §20.2 的九条完整执行 I/E 与 HANDOFF 指针转换,不做任何豁免;其余 PG 批卡不改。本方案的落地形态是三部分:PROC-01 批、对既有 PG 批卡的验收补丁、一份仓外配套清单。补充 `2026-08-28-project-gap-closure-program.md` §20.2 与 D17 import spec 的执行方式,不替代它们;supersede 关系:无。
> 证据纪律:§1 每条事实都来自本会话真实命令输出或文件实读;数字不来自记忆。

## 0. 结论

SayDo 的工程能力(跨平台发布、负向测试、隐私探针、两提交法)已经强于它的流程形态。现在拖慢批次的不是能力,而是五处"多源":排产状态多源、评审制度新旧并存、门禁清单四处复制、证据过量且隐私靠事后发现、执行层两条路线只有一条在跑。本方案把它们各收敛成一个正本:

| 收敛点 | 现在 | 目标 |
|---|---|---|
| 排产现势 | PLAN-2 头部、PLAN-2 批卡、HANDOFF §1.1 三处手写,已出现互相矛盾 | PLAN-2 顶部一个机器可读的 `schedule-pointer` 块是唯一可写的现势指针(active / next / last_closed / revision,不含任何提交 OID);HANDOFF §1.1 的指针行由它渲染,批卡状态行不得与它矛盾,检查器守。不新增第二个文件,不新增第二个排产源 |
| 评审制度 | AGENTS.md 要求"2 个 subagent + 1 次 Codex",与 V2 的每 candidate 1 名 reviewer 冲突,每份 IMPL-PROMPT 手工覆盖 | AGENTS.md 一次性迁到 V2:风险等级只改 review scope、coverage matrix 与 owner checkpoint,不改 reviewer 数量;设计文档评审设轮次上限 |
| 门禁 | `justfile` / `package.json` / `ci.yml` / `release.yml` 各维护一份近似清单;候选树隐私探针与 active-claims 检查不在任何 candidate gate 里 | PROC-01 只补两个候选门,加一段只比命令名集合的短脚本;完整 gate registry 仍由 PG-02 / PG-03 建,本文只给它们补验收 |
| 证据与隐私 | 月内 86 个 `chore(evidence)` 提交;raw prompt/report 曾带入 13 个文件 290 处本机路径;`logs/` 被 journal 与 cycle-state 引用却在 gitignore | 写入端脱敏、stage 前 fail-closed;Git 只留 canonical、合同、最终 manifest、精简 ledger;raw 走私有分层保留 |
| 执行层 | Tier1 是唯一生产路线;Hopper 桥 dormant、锁副本停在 07-24、专用 vault 零事件;codex 在词表里没有后端;`native_api` 未开 | 设计 ADR-005 定 Tier1 单路线,Hopper 桥标 `designed/deferred`;codex 后端与 `native_api` 作为 PG 链之后的两个候选批 |

三件明确不做的事:不再增加 reviewer 数量;不为历史批次追补 workflow receipt;不在 SayDo 里建跨仓的流程平台。

## 1. 现势与问题(每条带证据)

### 1.1 排产现势多源

- `docs/plan/IMPLEMENTATION-PLAN-2.md:10` 仍写"当前 HANDOFF active=none;唯一 next=PG-01A(未开工)";同文件 `:47` 写 PG-01A 已于 2026-09-02 收口;`HANDOFF.md:49` 写 `active=none, next=PG-01B`。三处手写,已经互相矛盾。
- `scripts/check-active-claims.mjs:12` 的 `REQUIRED_ROOTS` 只管公开承诺文案,不负责 PLAN / HANDOFF 的排产一致性,所以它绿不代表排产一致。
- `docs/plan/project-gap-closure-cycle.json` 是 PG-01A 一个 cycle 的机械记账,收口后没有被标为只读历史,读者容易把它当第三个现势源。

### 1.2 评审制度新旧并存

- `AGENTS.md:23-36`:重要产出后"两个互补角度的 subagent 独立评审 + 一次 Codex 对抗评审";实施期轻量版仍未提 Workflow V2、supervised-delivery、预算或 project-profile。
- 全局 policy(`~/.octoworkflow/v2-policy.json`)是每 candidate 1 名零上下文 reviewer、最多 3 修复 / 3 复审。`docs/plan/IMPL-PROMPT-PG-01A.md` §1–§2 因此要手写"项目旧多 reviewer 条款不增加本轮评审数量""旧周期一次修复上限与机械第二次 RED 停止不适用"。
- 设计文档评审没有轮次上限:AI 供给专题 v1–v20 二十轮"终审 + 回修"不收敛,见 `docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md`。
- 本仓无 `.octoworkflow/project-profile.md`;OctoWorkFlow 的模板存在但零采用。

### 1.3 新旧流程并存,V2 只在 PG-01A 局部生效

- PG-01A 有冻结 policy、cycle-state 与 receipt(`docs/plan/project-gap-closure/`);同日的快速启动分发线仍走旧式 A/B/C 报告:Codex 223 → 修复 `01ab5cf` → 224 复审 → 修复 `3630edf` → 225 复审 → 修复 `560f5ff`。三次复审均为 RED(7A → 2A → 2A),第三次修复 `560f5ff` 没有再派 fresh review;journal R127 追补如实记录了"产品修复 3/3、零上下文复审 3/3、最终候选上的第 3 次修复未再派复审",而官网 production 部署已绑定 `560f5ff`,用户此刻就能 `curl | sh` 跑到它。
- 已提交的 `docs/plan/project-gap-closure/control.json` 因入库前脱敏把 `control_dir` 写成 `<worktree>/...`,本会话对它跑 `cycle_control.py --verify-freeze` 得到 `control_dir_mismatch`,exit 5。根因在 OctoWorkFlow 侧记录了绝对路径(其方案已列修法);SayDo 侧的问题是 E 门没有跑这一项。

### 1.4 门禁清单四处复制,候选检查缺位

- `justfile` ci-node 16 步、`package.json` `ci:node`、`.github/workflows/ci.yml` node job、`release.yml` quality-node 各自维护一份近似清单;2026-09-02 对账报告 C-02 记录过 release.yml 漏挂安装脚本自测。
- `scripts/check-active-claims.mjs` 与 `scripts/check-public-tree-privacy.mjs` 不在 `justfile` / `package.json` / `ci.yml` / `release.yml` 任何一处;`just ci` 跑的是隐私探针的自测 `test-public-tree-privacy.mjs`,不是对候选树的扫描;探针只在 `scripts/publish-public-snapshot.sh` 推快照前运行。PG-00 E 因此把 13 个含本机绝对路径的文件入了库(对账报告 A-1)。
- `release.yml:3-5` 触发器钉死 `v0.1.0-rc.12`;仓内没有 bump 脚本;README 锚句替换表、安装脚本版本钉住、version-matrix 各自手改(对账报告 C-1)。

### 1.5 证据生产过重,隐私靠事后发现

- 2026-08-02 以来 577 个提交中 86 个是 `chore(evidence)`;tracked Markdown 962 份;`history/PROCESS-JOURNAL.md` 3,483 行、434 KB(`b32e878`),已需要一套正式"撞号政策";`prompts/` 315 个 tracked 文件中 86 个数字前缀重复,`research/codex-findings/` 213 个 tracked 文件中 14 个重复(`git ls-files` 口径),另有 `research/codex-findings/prompts/` 第三处 prompt 目录。
- `logs/` 123 个文件(ls 口径)被 gitignore,但 journal R120–R127 与 `project-gap-closure-cycle.json` 的 `evidence_refs` 直接引用 `logs/pg01a-…/…`;换机器后这些引用只剩 SHA。
- 本会话读取期间主树有另一会话在提交并派发 Codex;memory 与 R113/R114 记录过"清理前抢救未入库产物"。AGENTS.md 没有"施工只在独立 worktree/clone"这一条。
- owner 待决项跨轮累积:R114 尾部九项到 R127 仍"原样保留",对账报告 §5 新增三项,另有 D1–D19、AI 决策 1–10、PLAN-2 §5/§6,没有单一索引。

### 1.6 执行层:两条路线只有一条在跑

- 合同:`packages/contracts/src/types/task.ts:8,12` 定义 `route ∈ {tier1, hopper}`、`adapter ∈ {claude_code, cursor, codex}`。
- 实现:`packages/daemon/src/tier1/*.ts` 与 `backends/*.ts` 合计 11,743 行(不含 `webauthn/` 子目录),后端只有 `backends/claude.ts` 与 `backends/cursor.ts`;codex 没有后端;`native_api` 在代码里不存在(08-15 决策文档 `2026-08-15-default-runner-decision.md` 推荐但未开)。
- Hopper 桥:`focus/stage.ts` 的 `isHopperFocusBindingEnabled` 缺省 false;`bridge/` + `contracts/src/types/hopper.ts` 共 1,141 行,测试 677 行,最后改动 2026-08-04;`~/.saydo/hopper-dist` 锁在 2026-07-24 `bdd1e54`;`~/.saydo/hopper-vault/.hopper/events.jsonl` 为 0 字节。PLAN-2 §6.10 已把 Hopper 相关项挂在"route=hopper 且需 S2 的任务实际出现"触发线后。
- Hopper 仓自身:main 最后提交 2026-07-31;07-08 dogfood 决策门 deadline 2026-08-08 后无记录,按其自定规则等于"转内部";08-31/09-01 一轮 supervised delivery 的 27 个修改文件加 14 个未跟踪文件(7 份文档、1 个脚本、2 个源码、4 个测试)未提交,合计 888 行插入。owner 2026-09-02 决定:提交后冻结。
- OpenClaw:SayDo 代码目录零引用(仅 docs 9、research 9、history 3 个文件提到,均为设计谱系)。owner 2026-09-02 决定:事务线不再保留。

### 1.7 评审派发的无效启动是可修的流程缺口

- journal 与 HANDOFF 明确记录的无结论 Codex 派发有 8 次(108、112、207 首跑、215、216、217、218、222);2026-09-02 为本方案派的第一次 Codex 评审又在 1800 s 硬超时前未产出结论(事件流 2.1 MB、153 条命令执行、无 `turn.completed`),原因同 222:prompt 要求"§1 逐条核验 + 五个维度 + 两个仓库"。同一天,对同两份方案给出固定 12 条核验清单和 3 个判断维度的零上下文 subagent 评审约 15 分钟完成,12 条事实全部核验一致。
- 三类根因:prompt 维度过宽、候选未冻结(R119 的 215 因"运行中 semantic bytes 被回修"exit 143)、超时值低于宽 prompt 的真实需要。修法是纪律,不是工具:固定核验清单、判断维度不超过 3–4 个、候选先冻结、派发前后各算一次 fingerprint、超时按历史 p90 定、无结论启动按 OctoWorkFlow `telemetry-convention.md` 记为无效 CLI 启动。

## 2. 目标形态(不基于现状推)

产品仓的流程只保留四个正本,其他一切都是投影或可再生物:

1. **canonical**:`docs/01–11 + modules + adr`。不变。
2. **排产**:只有 `IMPLEMENTATION-PLAN-2.md`。它顶部的机器可读 `schedule-pointer` 块是唯一可写的现势指针;HANDOFF §1.1 的指针行由脚本从该块渲染;批卡状态行不得与它矛盾,检查器守。不新增第二个文件,不新增第二个排产源。
3. **证据**:`e2e/evidence/*.md`(批级)+ 唯一 Deferred P2 ledger + 最终 review manifest。raw prompt/report/log 按私有分层保留,入 Git 的先经写入端脱敏。
4. **过程**:`history/PROCESS-JOURNAL.md`,按月拆文件,撞号政策随之弱化。

评审只有一套:实施、修复、交付走 supervised delivery(1 reviewer / candidate,3 修复 / 3 复审,fresh zero-context 复审);设计文档评审保留互补双视角,但每个版本最多 2 轮对抗 + 1 轮回修,第 3 轮需 owner 当前消息明示;风险等级(L1/L2/L3)只改变 review scope、coverage matrix 与 owner checkpoint,不改变 reviewer 数量。派发纪律:候选先冻结(commit 或 detached worktree),reviewer 只读该 ref,派发前后各算一次 `candidate_fingerprint.py`;评审 prompt 给固定核验清单与不超过 3–4 个判断维度,超时按历史 p90 定;无结论的启动记为无效 CLI 启动。

门禁只有一张表:每项标类别(candidate validator / checker self-test / artifact producer / focused、PR、full、release、platform、live overlay),justfile、package.json、CI、release 从同一张表展开。这张表由 PG-02 / PG-03 建(它们的批卡已包含 gate-ID registry 与 `check-gate-manifest.mjs`);PROC-01 只做两件事:把缺位的候选门补进现有四处清单,并加一段只比较四处命令名集合的短脚本(无自测,registry 落地即删除)。

执行层只有一条路线:Tier1。用户说 → Brain → 决策包 → Tier1 在 worktree 里驱动 coding CLI → settle / verify / S3 合并。三个后端:`cursor`、`claude_code`(已有),`codex`(待补,`codex exec --json` 预授权模式或 app-server 审批回调)。`native_api` 是给"只有一个 OpenAI-compatible API key、没有任何 coding CLI"的用户的执行器:SayDo 自己在 daemon 内跑最小 agent loop,工具面只有结构化读写、git 状态、登记 verify 与经风险门的受限 shell,key 留在 daemon 进程不进子进程环境,Gate 0 / S0–S3 / S3 合并语义与 CLI 后端完全一致。它解决的是"任意 API 服务的用户也能让 SayDo 执行任务",不只是对话。Hopper 桥保留 schema、标 `designed/deferred`,不再维护。

## 3. 落地切分

### 3.1 PROC-01 · 流程收敛(正式小批:脚本、门禁、workflow 与文档;不改产品代码;排在 PG-01B 之前)

从当前 `main` 建 `codex/proc-01-process-convergence` 分支与独立 worktree,唯一 I 提交 + 唯一 E 提交,explicit pathspec,clean validation worktree 跑门禁,收口 `node scripts/week-audit.mjs --write` 随 E 入库,完整遵守 program §20.2 的 9 条,不做豁免:I 中指针块与 HANDOFF 生成块为 `active=PROC-01,next=none`,E 中为 `active=none,next=PG-01B`;PROC-01 的批卡(本节的 must_change / gate / evidence 字段)由 I 一并写入 PLAN-2,串行链与断言字符串同步改为 `PROC-01 → PG-01B → …`,legacy disposition 表不动。不改 `packages/**` 与 `pipeline/**` 产品代码;`.github/workflows/*.yml` 只增加步骤,本地用 `python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' <file>` 解析通过(本机 PyYAML 6.0.3)。

| 阶段 | 做什么 | 验收 | focused gate |
|---|---|---|---|
| P1 现势单源 | 在 PLAN-2「当前唯一排产链」节顶部加一个机器可读的 `schedule-pointer` 围栏块(`schema_version`、单调 `revision`、`active`、`next`、`last_closed`、`evidence_ref`、`updated_at`;不含任何提交 OID),它是唯一可写的现势指针;串行链与断言字符串改为 `PROC-01 → PG-01B → …`,并把 PROC-01 批卡加进 PLAN-2;新增 `scripts/schedule-pointer.mjs --check|--render|--self-test`:`--render` 把 HANDOFF §1.1 的指针行改写为带标记的生成块;`--check` 断言 PLAN-2 块合法、HANDOFF 生成块与之一致、PLAN-2 批卡状态行不与 `active` / `next` 矛盾、`revision` 不低于 `git show main:` 中的值;`--self-test` 在临时 worktree 上依次制造四种坏例(HANDOFF 生成块改坏、`revision` 回退、`active` 与 `next` 同时非空、把已收口批卡状态行改成"未开工")并断言 `--check` 各自非零;修正 PLAN-2 `:10` 的过期表述;新增 `docs/plan/project-gap-closure/README.md` 一段说明"PG-01A 历史收据,只读";program §20.2 第 4 / 7 条与 D17 §4.2 各加一行补注"HANDOFF 指针由 `schedule-pointer.mjs --render` 生成,语义不变" | `node scripts/schedule-pointer.mjs --check` exit 0;`node scripts/schedule-pointer.mjs --self-test` exit 0 且输出列出四个坏例各自的非零 exit | `node scripts/schedule-pointer.mjs --check`;`node scripts/schedule-pointer.mjs --self-test`;`bash scripts/check-emoji.sh`;`node scripts/check-doc-links.mjs` |
| P2 规则迁移 | AGENTS.md「评审制度」改写为 V2 对接版(实施 / 修复 / 交付走 supervised delivery;设计文档每版最多 2 轮对抗 + 1 轮回修;风险等级不改 reviewer 数;派发纪律:候选先冻结、派发前后各算一次 `candidate_fingerprint.py`、评审 prompt 固定核验清单 + 不超过 3–4 个判断维度、超时按历史 p90);新增"施工与评审只在独立 worktree/clone,主树只合并、只读与收口"一条;报告落点、状态词、命名规则只写一处——`.octoworkflow/project-profile.md`,AGENTS.md 只留一句指针("报告状态词、落点与命名以 `.octoworkflow/project-profile.md` 为准;OctoWorkFlow 阶段 D 落地前,全局 skill 的默认状态词与路径不适用于本仓,派发 prompt 须重述");前置:OctoWorkFlow 阶段 A 的模板字段;新增 `.octoworkflow/project-profile.md`(模板现有 10 个字段全部填写;`report_conventions` 若模板尚未提供,先写在文件末尾"项目附加节",待 OctoWorkFlow 模板落地后迁入);新增 `docs/README.md` 一页索引;新增 `docs/plan/OWNER-DECISIONS.md`(只做索引:ID、提出日期、原文位置、缺省动作、触发线、状态;不复制原文,不代签) | profile 字段齐全且门禁命令来自本仓真实入口;AGENTS.md 不再出现"两个 subagent"作为实施期要求,也不重复 profile 里的约定;OWNER-DECISIONS 覆盖 R114 1–9、对账 §5 1–3、D1–D19、AI 决策 1–10 的指针 | `bash scripts/check-emoji.sh`;`node scripts/check-doc-links.mjs`;`git diff --check` |
| P3 候选门补位 | `justfile` ci-node、`package.json` `ci:node`、`ci.yml` node job、`release.yml` quality-node 四处同时加入 `node scripts/check-active-claims.mjs` 与隐私探针对候选树的扫描:本地两处用 `node scripts/check-public-tree-privacy.mjs --ref "$(git rev-parse HEAD)"`(探针要求 40 位 SHA,并读取本机 `.git/info/saydo-private-probes`);托管 CI 两处再加 `--allow-missing-probes`(runner 上没有私有探针文件,私有探针层只在本地与公开快照前生效,验收里写明这一分层);新增 `scripts/check-gate-list-parity.mjs`:解析四处清单,只比较候选步骤的命令名集合是否相等(允许的 flag 差异白名单化),无 mutation 自测,PG-02 registry 落地后删除 | 对当前树四处命令名集合相等,脚本 exit 0;本地探针对 HEAD exit 0;`python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/ci.yml` 与对 `release.yml` 各 exit 0 | `node scripts/check-gate-list-parity.mjs`;`node scripts/check-public-tree-privacy.mjs --ref "$(git rev-parse HEAD)"`;`node scripts/check-active-claims.mjs` |
| P4 执行层 canonical | 新增 `docs/adr/design/ADR-005-execution-single-route.md`:Tier1 为唯一生产路线;Hopper 桥 `designed/deferred`(保留 schema 与 dormant 代码,不再维护,`~/.saydo/hopper-dist` 与 `hopper-vault` 可删);codex 后端与 `native_api` 为 PG 链之后候选;supersede ADR-001「附注(2026-07-23 交付顺序)」中"首发 = 完整双路径"的交付定义,不 supersede 其架构决策正文。`docs/03-architecture.md` §5、`docs/05-roadmap.md` §1–§2、`docs/09-data-contracts.md` §6.1 route 行、`templates/saydo.config.example.toml` `[hopper]` 节各加一行状态注(指向 ADR-005);`docs/adr/README.md` 登记 | 机械断言:`grep -c '设计 ADR-005'` 对 `docs/03-architecture.md`、`docs/05-roadmap.md`、`docs/09-data-contracts.md`、`templates/saydo.config.example.toml`、`docs/adr/design/ADR-001-execution-layer.md` 每个文件 ≥ 1,`grep -c '^## '` 对 ADR-005 ≥ 4(决策 / 证据 / 后果 / 关联);语义一致性由 supervisor 派的 fresh reviewer 复核(不另加 reviewer);`docs/09` 的 DDL CHECK 与 zod schema 不改 | `bash scripts/check-emoji.sh`;`node scripts/check-doc-links.mjs`;`pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts`(证明合同未变) |
| P5 证据卫生 | 新增 `just precommit` = `check-emoji.sh` + `check-doc-links.mjs` + `check-public-tree-privacy.mjs --fs` + `schedule-pointer.mjs --check`;命名规则(新建 prompt / report 一律 `YYYY-MM-DD-<slug>[-review|-repair|-retry].md`,不再顺序号)写入 profile 的报告约定;`check-review-index.mjs` 工具与 journal 按月拆分移到 PROC-02,本批不做 | `just precommit` 在当前树 exit 0,并把耗时写进 evidence | `just precommit` |
full gate:`just ci` 在 clean I worktree 上 exit 0(P4 的合同测试证明 schema 未变;其余为文档与脚本)。E 后在 clean E 上按 §20.2 第 7 条重跑 emoji、doc-links、`week-audit --check-bundle`、`git diff --check <P>..<E>`,并新增 `node scripts/check-public-tree-privacy.mjs --ref <E 完整 OID>` 与 `node scripts/schedule-pointer.mjs --check`。

L 分级:P1–P3、P5 为 L2(流程与门禁);P4 为 L3(canonical 变更、触及执行层承诺),需一次独立方案审查,由 supervised delivery 的 fresh reviewer 承担,不另加 reviewer。

### 3.2 对既有 PG 批卡的验收补丁(不改顺序,不新增批次)

- **PG-01B**:P = PROC-01 的 E;PG-01B 开批时从已存在的 PROC-01 E 读取完整 OID 写进 PG-01B 的 prompt 与 evidence(E 不写自身 SHA,指针块不含 OID)。作为第一个完整 prospective 2.4.2 cycle:`cycle_control.py --freeze-policy` 冻结 2.4.2 + 闭合 acceptance contract,preflight 带 coverage matrix,收口 `--finalize`;派 reviewer 前后各跑一次 `python3 ~/.octoworkflow/candidate_fingerprint.py`,不等即视为无效评审并按 `plan_recovery.py` 路由,两次结果写进 evidence;E 门增加 `--verify-freeze`——前置是 `~/.octoworkflow/cycle_control.py` 已含 `--rebind-control-dir`(OctoWorkFlow 方案阶段 A);若届时未落地,则在脱敏前的 I worktree 上跑 `--verify-freeze` 记录 exit,入库副本标 `pending-rebind`,不把 exit 5 写成绿。
- **PG-02 / PG-03(gate registry 与 gate-truth)**:registry 每项必须带类别字段(candidate validator / checker self-test / artifact producer / overlay);`justfile`、`package.json`、`ci.yml`、`release.yml` 从 registry 展开或由 `check-gate-manifest.mjs` 校验;PROC-01 的 `check-gate-list-parity.mjs` 在 registry 落地后删除。
- **PG-03 追加**:release 坐标单源——`docs/release/release-candidate.json`(或扩展 `release-profile.yaml`)+ `scripts/bump-release-candidate.mjs --check|--write`,统一 `release.yml` 触发器、README 与官网锚句、安装脚本版本钉住、version-matrix、`post-release-gate.mjs` 替换表;`release.yml` 改宽触发 `v0.1.0-rc.*`,第一步校验 SemVer、tag、package version、manifest、docs、assets 身份一致;历史 fixture 继续静态钉死。追加 `scripts/repro-test.mjs <file>[:line] --runs N --isolated|--suite`,只输出 pass/fail 计数与日志 SHA;targeted reproduction 的收据形态仍由 OctoWorkFlow 的 cycle_state 机制记录,SayDo 不自定收据格式。
- **PG-04(审计写安全)**:把"写入端脱敏"落成 `scripts/redact-write.mjs`(复用 `public-text-redaction.mjs`),供派发脚本在写 prompt/report/receipt 时调用;stage 前 fail-closed 由 PROC-01 的 `just precommit` 先顶上。

### 3.3 执行层后续批(候选,进入 PLAN-2 须走 D17 同型导入)

- **PG-07 · codex Tier1 后端**:`backends/codex.ts`,`codex exec --json` 预授权模式(S2 效果类随决策包预授权,S3 硬拒),恢复走 `codex exec resume`;规模 S–M。它先于 `native_api`,因为覆盖的是已经登录 ChatGPT / Codex 的用户,成本最低。
- **PG-08 · `native_api` 执行器**:按 `2026-08-15-default-runner-decision.md` §四的六步:词表与 canonical → Tier1Runner seam → 执行域 ToolRegistry → 安全门内建 → durable run state → 一键 DeepSeek onboarding;08-15 估算 19–29 人天(±40%),是 L3 承重改动,排在 PG-06 关闭 A 级风险之后。它服务的是"只有 API key、没有 CLI"的用户,是普适接入方案里最后一块执行面。

### 3.4 owner 决策点(本文不代拍;每项给缺省)

1. 快速启动分发线:三次复审均 RED,第三次修复 `560f5ff` 未经 fresh review,且已部署到官网 production。缺省:立即(不等 rc.13)开一个新 cycle,只对 `deploy/saydo-octoooo-com/install.sh` 与 `install.ps1` 做一次 fresh review;安装脚本是用户 `curl | sh` 直接执行的入口,按 `risk-tiers.md` 属 L3,不宜以"owner 接受的未复审例外"收尾。RED 则按现役发布合同回滚官网上的两个脚本到上一个 GREEN 版本或下线入口。
2. 是否减少 prompt / report 入 Git、是否重写历史。缺省:不重写历史,继续入 Git,但只入写入端脱敏后的版本;raw 日志维持机器本地,或另建私有 R2 前缀归档并在 journal 记 URL + SHA。
3. HANDOFF 瘦身(§1.1 只留当前行,历史行移 journal)与 journal 按月拆历史。缺省:PROC-02,PG-01B 收口后再做,避免与 PG-01B 的 HANDOFF must-change 冲突。

### 3.5 仓外配套清单(不在 PROC-01 内;owner 或独立小会话执行,每步先报告再动手)

**Hopper(owner 已决定:提交后冻结)**

1. 在 `~/WorkSpace/Hopper` 的 `codex/readiness-hardening-20260831` 上以 explicit pathspec 提交 27 个修改文件与 14 个未跟踪文件(7 份文档、1 个脚本、2 个源码、4 个测试;先 `git status --porcelain` 全列,逐路径确认属于该轮);在 post-commit HEAD 上跑 `npm test`,exit 0 才继续。
2. `docs/review-log.md`「dogfood 决策记录」节补写:决策门 2026-08-08 到期无记录,按预注册规则记为"转内部";2026-09-02 owner 决定冻结。
3. README 顶部加冻结横幅(冻结日期、原因、可复用设计清单:verification 冻结与 base 还原重跑、trust report、跨厂商 usage 中枢);`git merge --ff-only` 进 main;打 tag `archive/frozen-20260902`;push 到 origin。
4. 本机 `~/.saydo/hopper-dist` 与 `~/.saydo/hopper-vault` 在 SayDo ADR-005 落地后删除(先确认 `~/.saydo/config.toml` `[hopper]` 节已按 P4 标 deprecated)。

**OpenClaw / Kit(owner 已决定:事务线不再保留)**

1. 先定位夜间任务的调度源(用户 crontab 为空;`ai.openclaw.gateway` 在 launchd 已 disabled;`openclaw.json` cron 为 0 个 job):`sudo crontab -l`、`sudo launchctl print system | grep -i -E 'openclaw|remediate|intake'`;找到后禁用,并核对 `~/.openclaw/logs/budget/` 次日不再新增文件。
2. Kit 定性为设计档案:`PROJECT-GENESIS-SPEC.md`、`STATE-SEMANTICS.md`、Spec Triad 与 Readiness 原文归档到 OctoWorkFlow `docs/archive/`;Kit README 顶部加冻结横幅,打 tag;`git rm --cached config/profile.json` 并加入 `.gitignore`。
3. `~/.openclaw` 先备份(既有 `My-OpenClaw-Bak` 机制)再禁用或卸载 OpenClaw 2026.7.1;`~/.saydo` 与 SayDo 仓不受影响(零耦合已核验)。

## 4. 价值、成本与边界

- 价值:批次不再因状态矛盾、评审口径、门禁漏项返工;隐私问题在写入端而非公开快照时发现;执行层承诺与实现一致,对外口径只说 Tier1 能做到的事。
- 成本:PROC-01 约 3–4 个工作日(P1 一个检查器加渲染器、P2 五份文档、P3 四处清单加一段短脚本、P4 一份 ADR 加五处状态注、P5 一个 just 配方),零产品代码;若 fresh review 用满 3 修复 / 3 复审,按 5–6 天算;可按 P1–P3 / P4–P5 拆成两个同型批。PG 批卡补丁不增加批次数;PG-07 / PG-08 是新的工程批,需 owner 另行导入。
- 边界:不改 Gate 0 / S0–S3 / 审计不可变等硬规则;不改 09 的 schema 与 DDL;不因流程收敛放宽任何安全缺省;不在本方案里做真人验收、发布或部署。

## 5. 与 OctoWorkFlow 的分工(防止两仓同质化)

| 事项 | 归 SayDo | 归 OctoWorkFlow |
|---|---|---|
| 预算、状态机、review manifest、cycle-state 工具 | 只消费,不复制 | 维护 |
| 项目红线、门禁命令、owner checkpoint、报告约定 | `.octoworkflow/project-profile.md` | 提供模板字段(含 `report_conventions`) |
| control.json 绝对路径缺陷 | E 门加 `--verify-freeze` 发现 | 改为相对路径并提供 rebind |
| 候选冻结 / fingerprint 断言 | 已在实践;PG-01B 起派发前后各算一次 fingerprint 并入 evidence | 写进 impl-review 与 supervised-delivery,`candidate_fingerprint.py` 加 `--expect` |
| 结果型 telemetry | 不改 evidence 模板;采集器直接读 cycle-state / receipt / runner summary | 采集器与口径 |
| 门禁瞬态复现 | `repro-test.mjs` 只出计数与日志 SHA | 收据形态归 cycle_state |
| 排产现势、门禁表、证据与隐私 | 产品工程资产,本仓自建 | 不介入 |

## 6. 证据索引

- 排产矛盾:`docs/plan/IMPLEMENTATION-PLAN-2.md:10,47`;`HANDOFF.md:49`。
- 评审制度:`AGENTS.md:23-36`;`docs/plan/IMPL-PROMPT-PG-01A.md` §1–§2;`docs/review/2026-08-24-ai-supply-v20-loop-diagnosis.md`。
- 快速启动评审链:`docs/review/2026-09-02-monthly-docs-commit-crosscheck.md` §6.3;journal R127 追补(`history/PROCESS-JOURNAL.md:3471-3473`);`research/codex-findings/223|224|225-*.md`;提交 `01ab5cf`、`3630edf`、`560f5ff`。
- 门禁缺位:`justfile`、`package.json`、`.github/workflows/ci.yml`、`.github/workflows/release.yml` 对 `check-active-claims` 与 `check-public-tree-privacy` 的 grep 为空;`release.yml:3-5`。
- 证据与隐私:对账报告 A-1;`.gitignore` 的 `logs/`;`project-gap-closure-cycle.json` `evidence_refs`。
- 执行层:`packages/contracts/src/types/task.ts:8,12`;`packages/daemon/src/tier1/backends/`;`packages/daemon/src/focus/stage.ts`;`~/.saydo/config.toml` `[tier1]` / `[hopper]`;`~/.saydo/hopper-vault/.hopper/events.jsonl`(0 字节)。
- Hopper:`~/WorkSpace/Hopper/docs/review-log.md:130-142`;`git status` 27 文件 / 888 行;`docs/review/2026-09-01-readiness-hardening-night-impl-readback.fable.md`。
- OpenClaw:`grep -rIl openclaw` 在 packages / pipeline / apps / deploy / templates / scripts 为 0;`launchctl print gui/<uid>` 中 `ai.openclaw.gateway => disabled`;`~/.openclaw/logs/budget/` 每日 23:55 与 00:10 新增文件。

## 7. 评审与修订记录

- 第 1 轮(2026-09-02,零上下文 subagent,只读,固定 12 条核验清单 + 3 个判断维度):12 条事实全部一致(1 处行号差 1);发现 A1 / B6 / C3 与四条同质化提醒。全部吸收:排产指针改为 PLAN-2 内的机器可读块而非新文件(回应"第二套排产状态"的风险);隐私探针改用 40 位 SHA 并为托管 CI 加 `--allow-missing-probes`;§20.2 第 4 / 7 条与 D17 §4.2 补注;PG-01B 定义 P 与 rebind 落空缺省;parity 脚本降级、`check-review-index` 移 PROC-02;约定只写 profile 一处;数字改为 tracked 口径;估算改 3–4 天;删除两边都认领的 evidence 小表;repro-test 不自定收据。
- Codex 第 1 次派发(同日,`gpt-5.6-sol/max`,只读):1800 s 硬超时前未产出结论(事件流 2.1 MB,无 `turn.completed`),按纪律不 resume,已作为 §1.7 的样本;第 2 次派发以收窄 prompt 重派,结论见本节追加。
- Codex 第 2 次派发(同日,收窄 prompt,606 s 完成,`turn.completed` 1 次):`[fail]` A4 / B5 / C0(SayDo A3 / B1,OctoWorkFlow A1 / B3,跨仓 B1)。全部吸收:PROC-01 改为正式小批并按 §20.2 做标准 I/E 指针转换(不再豁免第 4 / 7 条);删除自引用的 `next_parent`;E 门与退役对象的脚本名统一为 `schedule-pointer.mjs` 与 `check-gate-list-parity.mjs`;P1 增加 `--self-test` 固定四个坏例;YAML 解析命令写死;P4 增加机械 grep 断言;P2 写明对 OctoWorkFlow 阶段 A 的前置与阶段 D 前的重述规则。报告 `research/codex-findings/2026-09-02-process-convergence-plans-review-retry.md`(7,078 B,SHA-256 前 16 位 `72513f34aa4c0723`),事件流 `logs/2026-09-02-process-convergence-plans-review-retry.jsonl`(314,291 B,SHA-256 `4eca9de23e47c51f74c79c5dffd46e63e1fb2785dc649915a4e8a8d063fad11d`,本地 ignored)。
