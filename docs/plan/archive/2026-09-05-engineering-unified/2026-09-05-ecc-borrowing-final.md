# ECC 借鉴终稿：SayDo

> **状态：范围修订，独立评审结果见本仓交付记录。本轮未实施产品代码。** 不是排产、不是合同变更、不是施工授权。
> **上一版历史证据（不得误认为本修订范围已评审）：** R3 完整语义 GREEN；门禁后单行格式修正经 R4 复核 GREEN；十二项文档门禁 exit 0，ContextView 148 tests OK。那些结果验收的是修订前文档。
> **性质：** 本仓唯一 final SoT。旧 Fable / Astra / Codex 方案只作归档证据，实施不得再依赖它们。
> **基线：** SayDo `bcf8ea855f25b177888d9159f75e49214f3dd892`；ECC 源码 `e04ea0b9cc8248686edf5ac751cadff550e162b8`（`VERSION`/`package.json` = `2.2.1`，不等于已发布 npm）；npm `ecc-universal@2.2.0`（registry 2026-09-05，`has_2_2_1=false`，发布于 2026-08-27T17:34:09Z）。annotated tag `v2.2.0` 对象 `a1d9b395e207ae80945ec9d7a7e24163b0013847`，指向提交 `5eddf1a3ffd311423be2d4ba7d26f7209c91b033`；`git rev-list --count v2.2.0..HEAD` = 147；`git describe` = `v2.2.0-147-ge04ea0b9`。
> **排产（只读）：** `docs/plan/IMPLEMENTATION-PLAN-2.md` 指针 `active=none`、`next=PG-01B`、唯一链 `PROC-01 → PG-01B → PG-02 → … → owner-stop`。本文不改指针。
> **配套：** 同目录 [未来实施合同](2026-09-05-ecc-implementation-prompt.md)；统一研究维护源 `research/ecc/2026-09-05-ecc-unified-research.md`（ContextView 保存逐字节镜像）。本文件自洽，不靠跨仓相对链接才能打开。
> **结构基础：** Astra 边界与可判定验收；吸收 Fable consolidated 的 G-B12 触发、来源清单、Codex 三列与发布双坐标。不是模型排行。

## 1. 结论、已实现、差异终裁

**不借 ECC 任何运行时，不把 ECC 装进 SayDo 派出的 agent，不让 ECC 成为第二套 daemon、执行控制或排产源。** Tier1 用 `--setting-sources "" --strict-mcp-config --settings <本批 hooks>` 起 `claude -p`（`packages/daemon/src/tier1/backends/claude.ts:66-90`），用户装的 ECC hooks 在这条路径上不会加载。这是护城河，不是缺口。

ECC 把纪律放进用户交互式 harness（hooks / skills / instincts，模型可关）；SayDo 把纪律放在 daemon 外部门（Gate 0、S0–S3、verify 冻结、ledger provenance，模型关不掉）。可借的是少量工程机制，不是目录膨胀的内容包。

**已具备（不得再当缺口）：**

1. 外部审批门：`tier1/gate.ts` fail-closed；Gate 0 无 bypass（`AGENTS.md` 硬规则 3）。
2. verify 白名单 + 内容冻结含 runner config 闭包（`tier1/verifyFreeze.ts:1-15,86-96`）。
3. 效果分级：`policy/engine.ts`；`cmdEffect.ts:1-14` 不可判上浮 S2；`fileToolEffect.ts:8-9` 敏感文件升 S2；`cmdEffect.ts:988-1003` 把 `GIT_LOCAL_SUB`（含普通 `commit`）判 `write_worktree`。缺的是 git 绕过旗标的子命令 grammar 与有限 heredoc 反例。
4. 记忆 provenance：append-only ledger、五级 trust、taint、forget 传播、compiler 规则（`memory/compiler.ts:1-8,23-29,91-93`）。`classifyTrust` 先信 `user_stated`/`user_approved`（`memory/classify.ts:63-77`）；`import` 属 `THIRD_PARTY_KINDS`，返回 `candidate`（`:23-74`）。Ledger 不信调用方自报（`ledger.ts:88-95`）。
5. 工作区身份 BigInt `dev/ino`（`projects/workspace.ts:229-240`），拒 reparse point。
6. TTS 脱敏（`voice/redactor.ts:22-47`）只覆盖口播出口，不是持久化闸。该表含 `env:NAME`、`sha256:` digest、路径、11–19 位数字、>=20 字符泛长串，**不得整表搬进记忆拒写**。
7. 三熔断墙钟/回合/成本（`approvals/circuitBreakers.ts:1-12`），无工具循环信号。
8. run 级 usage/cost 已解析（`backends/claude.ts:204-225`），不是当前 context occupancy，无 remaining% 输入时不造数据。
9. CI：workflow `uses:` 钉 40 位 SHA，checkout `persist-credentials: false`（`.github/workflows/ci.yml:16-18`）；`package.json:6,24-30` 锁 `pnpm@10.33.1`、Node `>=22`、`allowBuilds` 放行 `esbuild`/`koffi`、禁 `better-sqlite3`。无 `--ignore-scripts`，无 `pnpm audit` 证据绑定。
10. 能力 ledger 由 PG-02 规划，不另造。
11. 分发脚本已存在：`deploy/saydo-octoooo-com/install.sh` 与 `install.ps1`（pin `v0.1.0-rc.12`）。Fable consolidated 写「仓内没有 `scripts/install`」不能推翻这两份安装器。缺的是 G-B12 的所有权收据 / doctor / 升级卸载生命周期（`docs/plan/2026-08-28-project-gap-closure-program.md:136,951`）。`RuntimeIdentity.sourceRevision` 已是 7–64 位裸 hex（`packages/contracts/src/runtime.ts:6`）。
12. Cursor hooks.json 由 `tier1/adapter.ts` 每 run 写入任务作用域，只挂 `beforeShellExecution`。没有「安装时 hook 同意」这一步。

**真实缺口（本终稿覆盖）：**

- 任何新持久化工件在信任分级之前没有凭据字面量检测：`ledger.ts:89-116` 的 `add`（含 `supersedes`）直接 `classify -> insert`；`foundation.ts:243-268` 把 excerpts 写入 staging 再 publish；`foundation.ts:327-403` 把 AGENTS/CLAUDE、现场读取的 `.cursor/rules`（`:392-397`）、`package.json` scripts（`:368-377`）与 justfile 任务（`:378-385`）原文写入 knowledge。
- `docs/03-architecture.md:143` 写知识库默认 gitignore、可显式团队共享；`packages/daemon/src` 无 gitignore 读写。既有约定是用户可手工提交以共享，不是本批要落地的 `knowledgeShare` schema/UI。
- 凭据命中或 Git 保护不足时，失败与新鲜度没有可判定的三类区分：单条记忆未保存、更新失败仍用旧有效知识、首次构建失败暂无底座。现有入口已有项目设置奠基/重奠基（`packages/console/src/pages/ProjectSettings.tsx`）与错误卡，缺的是安全元数据与去重，不是新通知中心。
- 笼子测试把「输出无哨兵」误写成读隔离；`providers/byoa/cage.ts:1-5,47-98` 分档与 Cursor 无隔离 HOME 未被测试合同吸收。不进本批施工。

**差异终裁（相对 Fable / Astra / 旧 Codex）：**

| 争议 | 终裁 |
| --- | --- |
| 第一刀范围 | 只做 AS-01/AS-02：凭据写前拒绝 + 私有生成物 Git 保护 + 同批失败可见/恢复。笼子、循环、效果词表、CI advisory 写成有限机制，不进本批施工。 |
| secret 检测 | 窄凭据字面量，不复制整张 TTS regex，不按泛长串 / env 引用 / digest / 路径 / 业务 ID 拦截。 |
| foundation 命中 | 首次 raw staging 写之前终止**本次新 generation 发布**；不改旧 `status`/`current.json`；不能同时承诺 partial 发布和整次拒绝。 |
| gitignore | 声明私有 write set 的语义验证，非整个 `.saydo` 字节全等 `*\n!.gitignore\n`。不借删除共享开关改成全目录一律封禁。`knowledgeShare` enabled/allowlist、`projectOverridesSchema` 共享字段、共享设置 UI 全部延期。 |
| 安装器 | 已有 `deploy/saydo-octoooo-com/install.sh`；G-B12 仍 deferred。 |
| S-02 hookConsent 默认 declined | 撤回。必要审批门没有可选关闭。 |
| S-03 记忆导入 / S-05 MCP 清点 | 不实施；无消费者。未来 importer 合同保留：`import -> candidate+taint`，不是 `third_party`。 |
| S-06 remaining% | 无输入不造数据。 |
| AS-03 笼子 | Codex `-s read-only` 不限制读；无哨兵输出不证明读不到；阳性控制 / `denied` / `leak_observed` / `unverified` 分列。live 需凭据与费用授权，不在第一批。 |
| AS-04 循环 | 先诊断，不自动新增 blocked。 |
| AS-05 Git grammar | 保留 Astra R1：`commit`/`am` 的 `-n`、`push -n` 是 dry-run、参数值不误判、风险只上浮不降已有 S3。 |
| AS-06 audit | 有时间/锁文件坐标的 advisory；网络错误 unknown；不默认 `ignore-scripts`/`minimumReleaseAge`。 |
| AS-07 披露 | 不提供关闭必要审批。 |
| 排产 | 默认 PG-01B 合并后独立隐私批，再回 PG-02。当前未合并则只完成可审查准备，不动在建树，不谎称前置通过。 |

许可：MIT。借设计不 vendor `ecc-universal`，不把 ECC 装进 runtime 树或用户 Tier1 worktree。若复制 ECC 模式文本，必须经 `scripts/third-party-notices.mjs` 来源登记后再生成 `packages/cli/THIRD_PARTY_NOTICES.md`。本轮不改该生成器。

## 2. ECC 可借机制（本文件自洽）

ECC 坐标钉 SHA `e04ea0b9`。permalink 形如 `https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/<path>`。

| 机制 | ECC 坐标 | 对本产品的真实含义 |
| --- | --- | --- |
| 记忆写前 secret 形态拒绝 | `scripts/lib/memory-vault.js:319-325` 调 `findPotentialSecrets`（`memory-vault-format.js:49-60`） | 方向对；ECC 自己的 key 前缀表不能当 SayDo 安全证明。只借「写前拒绝、审计不回显原文」。 |
| project 作用域 create-only gitignore | `memory-vault.js:37,243-262`，内容必须恰为 `*\n!.gitignore\n` | 保护语义可借；字节全等 `*` 覆盖整个 `.saydo` 与 03:143 团队共享冲突。 |
| hook 六类能力披露 | `scripts/lib/install/hook-consent.js:12-36` | 只借披露词表作探针文案；SayDo 审批门没有「缺省 declined」。 |
| 5 次相同 tool+参数 | `scripts/hooks/ecc-context-monitor.js:18-28,97-115` | 可作诊断信号，不能直接改 blocked 合同。 |
| `--no-verify` / `core.hooksPath` | `scripts/hooks/block-no-verify.js:1-30,250-267` | 须按 git 子命令 grammar 收紧；`git commit -n`/`-an` 是绕过，`git push -n` 不是。 |
| heredoc 被动 sink | `scripts/hooks/gateguard-heredoc.js:1-25` | 只作正反例输入；`cat <<EOF \| sh` 不是天然 S3。 |
| 笼子哨兵 | `skills/council-multi-model/SKILL.md:78-125` | 测试思想可借；须按本仓 provider 分档。 |
| 安装态账本 / doctor | `schemas/install-state.schema.json`、lifecycle doctor | G-B12 候选，不是本轮第一刀。无收据时 `doctor.js:60,111` `results=[]` 且无 issue 则 exit 0。 |
| fail-open 缺省 | `.claude-plugin/plugin.json:26-30` default true；`check-hook-enabled.js:6-8` 无 id 即 `yes`；metrics bridge `:201` failing open | 对照用：SayDo 门是 fail-closed，不借缺省放行。 |
| MCP 清点脱敏 | `scripts/lib/mcp-inventory/canonical-mcp.js` | 本期撤回；诊断需求出现再开。 |

## 3. 第一批：AS-01 与 AS-02

推荐默认：同一 daemon 隐私小批。投入 M（跨 ledger / foundation / canonical，不是单模块一日小改）。scope 不含 `packages/daemon/src/net/**`（PG-01B roots）。失败可见与恢复和保护一起交付，不另开第三阶段，不另建管理产品。

### AS-01 持久化入口的窄凭据字面量检测

**机制：** 抽纯函数 `findCredentialLiterals(text) -> {kind, spanDigest}[]`，与 TTS 展示策略分离。只复用凭据子集：PEM 私钥块、明确 token literal（`sk-` / `ghp_` / `github_pat_` / `xox[baprs]-` / `AKIA` / `ASIA` + 声明长度）。**不**纳入 TTS 表其余项（`voice/redactor.ts:30-47`）：`env:NAME`、`sha256:` digest、ULID/Crockford 业务 id、路径、客户数字、>=20 字符泛长串、熵估计。保护层在 `classifyTrust` 与任何 `requestedTrust` 豁免之前。扫描只绑在下列写入/构建边界，不无条件在每轮对话全量扫描。

**声明 write set（命中只拒这次写入或这次新 generation）：**

1. `MemoryLedger.add`（`ledger.ts:89-116`），含 supersedes。命中：不 insert，账本无原文，audit 只记 digest+kind。
2. `liveTools` `remember`（`brain/liveTools.ts:1273-1318`）。`user_stated` / `requestedTrust` 不能绕过。
3. foundation 构建：在读 KEY_FILES 原文进 excerpts 之后、**首次 raw 写入 staging 之前**扫描。`:262-268` 会 `mkdirSync(staging)` 再 `writeKnowledgeDocs`。`:327-403` 不是单一敏感面：`core.md` 含 AGENTS/CLAUDE 摘录；`conventions.md` 含 AGENTS/CLAUDE 与现场读取的 `.cursor/rules`（`:392-397`，不经 excerpts map）；`build-test-run.md` 含 `package.json` scripts（`:368-377`）与 justfile 任务（`:378-385`）。规则读取、package scripts 与 justfile 进入 staging 的路径必须在首次 raw 写入前覆盖。
4. 本批若触及其它新持久化知识投影正文，同一函数，禁止第二套规则。

**foundation 唯一合同：** 本次构建任一声明敏感面命中，则在首次 raw 写入 staging 之前终止「本次新 generation 发布」。旧已验证 generation 及 `current.json` pointer 不变；不得把旧 manifest 改成 `partial`；不得写 partial 新版；不得同时承诺发布新 generation。只返回本次构建受限/未发布的结构化结果（建议码 `foundation_build_restricted`，名称在回写 09 时定）。项目登记与其它对话不因此停；用户原文件不改。预算超限的既有 `partial` 续跑合同不套用到凭据命中。

**正例：**

- claim 含 PEM 或 `ghp_` literal -> `add` 抛 `memory_secret_literal`，账本无原文，audit 只记 digest+kind。
- foundation 任一声明敏感面命中 -> 本次不创建 staging、不 publish、不改 `current.json`、旧 generation 保持原 status。
- `env:OPENAI_API_KEY`、`sha256:` 64 hex、SayDo id、常见明确占位符（如 `sk-test` 文档夹具、`ghp_fixture_not_a_real_secret`）可过。
- 合法引用（env 名、digest、路径、业务 ID、泛长串）不误拦。

**反例：**

- `requestedTrust=user_stated` 绕过。
- 先写入 staging 再告警。
- 把旧 manifest 改成 `partial` 同时发布新 generation。
- 错误信息、TTS 或日志回显命中原文。
- 因一个 excerpt 含 token 拒绝整个项目登记。
- 改用户 AGENTS.md 原文件。
- 每轮对话无条件全仓扫描。

**失效：** 新供应商 token 形态不在声明 grammar 内 = 已知漏检，不是「已证明无 secret」。格式与真实凭据相同的假 token 不承诺可以准确区分。

**回退：** 方案尚未上线时可撤回本提案。上线后遇误伤：优先停受影响的新写入，保留旧有效数据与保护策略，按有证据的修订/回退合同恢复。不回放被拒 secret，不自动删库/改 Git 历史。不得「删除检测函数即可」使已经选择的保护要求静默失效。

**canonical：**

- ledger/`remember`：09 §13 增建议码 `memory_secret_literal`；§12-4 正反例。不改 trust 枚举。foundation 错误不得只塞进 remember 工具码。
- foundation：`docs/modules/b-memory.md` B3；`docs/09-data-contracts.md` §11 / §12；`docs/04-key-mechanisms.md` §1.2（刷新失败保留旧 generation）。

### AS-02 `.saydo` Git 保护语义

**机制：** 保护声明私有生成物，验证**实际保护语义**。不是停掉 Git 防护，也不能借删除共享开关改成整个 `.saydo` 全目录一律封禁。`docs/03-architecture.md:143` 既有约定是「知识库默认 gitignore，可显式选择提交以团队共享」；当时 `packages/daemon/src` 无 gitignore 读写。本批落实默认忽略与语义验证，不覆盖现有用户文件，不自动取消既有人工共享配置。

| 路径 | 本批默认 | 本批不做什么 |
| --- | --- | --- |
| `<workspace>/.saydo/foundation/`（含 `staging-gen-*`） | 忽略；永不当作可共享目标 | 不新增 schema 豁免 |
| knowledge 投影 | 忽略；已跟踪/用户已提交的文件当作用户数据保留 | 不把已有共享文件无条件当作安全豁免去继续写入新私有投影 |
| 转写 / token | 不因本批落工作区；`~/.saydo/sessions` 本就不进仓 | 不随共享讨论放开 |

新托管 ignore **create-only**：无文件则写最小规则，只覆盖声明私有 write set；已有合法等价规则（覆盖声明 write set）接受、不覆盖用户文件。已跟踪文件不受 gitignore 影响。当前不能安全生成到已跟踪或未保护目标时：保留用户数据与配置，**只停本次受影响私有投影**并给处方（可由用户 `git rm --cached`，daemon 不执行）；不阻塞其它项目工作。不自动 `git rm`、不清理历史、不删用户文件。

Git 必须支持：非 Git 仓、worktree 的 `.git` 文件、等价 ignore、tracked 检查、根外 symlink、写失败。查询绑在相关写入/构建边界，不每轮对话全量扫描。

**本批明确延期（不是验收项，也不为此新增承载）：** `knowledgeShare` enabled/allowlist、`projectOverridesSchema` 共享字段、共享设置 UI、DDL/`project_settings` 新字段。`projectOverrides.ts:18-33` 目前 strictObject 仅 `models`/`budget`，保持不变。`project.toml` 仍不得放松保护。未来真正存在合法共享消费者时单独设计。

**正例：**

- 非 git 仓 -> 跳过 Git 查询，仍写本地文件并记录 `not_git`。
- worktree 的 `.git` 文件 -> 用 `git -C <workspace>` 查询，不把 `.git` 当目录读。
- 已有 ignore 等价覆盖 foundation -> 不覆盖文件。
- 用户先前手工 tracked 的 knowledge 文件 -> 保留该文件与配置；本次新私有投影若无法安全写入则停这次投影并给处方，不自动 untrack。

**反例：**

- 只读目录创建 ignore 失败 -> 停敏感投影，不清空用户 ignore。
- symlink 指向根外 -> 拒写。
- 已跟踪的 `foundation/core.md` -> 不新增该投影，给出处方。
- 因延期共享开关，改成整个 `.saydo` 字节全等 `*`。
- 把已有共享文件当作无条件安全豁免，继续往里面写新私有生成物。
- 本批新增 DDL / 设置页 / `projectOverrides` 字段承载延期能力。

**证据：** 对声明 write set 跑 `git check-ignore -v` 与 `git ls-files`，不是无限语法 linter。linter 不是安全边界。

**回退：** 方案尚未上线时可撤回「自动创建 ignore」提案。上线后：可停止后续 ignore 自动创建；已建保护保留；不覆盖用户文件；不重新写未保护私有目标。不回放 rejected 内容或历史提交，不自动 `git rm --cached` / 改 Git 历史。

**canonical：** `docs/03-architecture.md:143` 保持「默认可忽略、用户可手工共享」的既有表述，不在本批改成 `knowledgeShare` 开关；`docs/09` foundation/ledger 错误码；`docs/04` §1.2；`docs/modules/b-memory.md` B3；`docs/10` 复用既有处方话术（blocked 原因本轮不改）。建议处方码 `git_protection_insufficient`。02 §5.1、11 项目设置行、`projectOverridesSchema` 共享字段不进本批。

### 失败可见与恢复（与保护同批）

不新建通知中心、持久化遥测平台或新 blocked 状态。复用既有错误卡、项目详情与奠基/重试入口（`ProjectSettings.tsx` 奠基/重奠基、`ErrorCard`）。新鲜度不得静默伪装成成功。

必须可判定区分：

1. **单条记忆未保存：** ledger/`remember` 命中；该片段不落盘；其它对话继续。
2. **更新失败仍用旧有效知识：** foundation 命中且已有已验证 generation；pointer/status 不变；界面明确「未更新」，不得把旧知识说成本次成功刷新。
3. **首次构建失败暂无底座：** 没有旧 generation 时不得假称保留成功。

现有可视界面可给安全的来源定位、原因分类和具体恢复动作：相对来源与行号仅作脱敏元数据给现有 UI；禁止回显命中原文；不得把完整路径送 TTS 或把敏感片段写日志。审计/日志仍只保留允许的 kind/digest。

同一未解决问题避免反复通知：优先用既有 callback `dedupeKey` / occurrence 去重；若该路径没有现成去重，只做本次流程内最小去重，不建设跨服务状态。

修复源文件或 Git 保护后，走既有 refresh/retry（项目设置奠基/重奠基）可以发布新一代；无需重装、无需关闭保护或自动删除用户文件。

**正例：** 三类失败可区分；旧知识仍可用但明确未更新；首次无旧知识不假称保留成功；恢复后实际更新；同一问题不重复轰炸；source metadata 脱敏；合法引用不误拦。

**反例：** 把未更新显示成成功；TTS 读出完整路径或命中原文；为去重新建通知中心；要求用户关闭保护才能恢复。

开销只用定向测量说明（绑定写入/构建边界的扫描与 Git 查询），不编造毫秒/收益比例，不增加持续上报。

### 失败、迁移、依赖

| 文件 | 合法变更 |
| --- | --- |
| `docs/09-data-contracts.md` §13 / §12-4 | `memory_secret_literal`；审计只记 kind+digest；三类失败语义 |
| `docs/09` foundation 段 | 凭据命中 = 本次未发布；旧 generation/pointer 不变；首次无旧知识不假称保留 |
| `docs/modules/b-memory.md` B3 | generation 未切换前旧底座可用；失败可见 |
| `docs/04-key-mechanisms.md` §1.2 | 刷新失败保留旧 generation，不得伪装成功 |
| `docs/03-architecture.md:143` | 可澄清默忽略私有生成物；**不**改成 `knowledgeShare` 开关或覆盖用户手工共享 |
| `docs/10-voice-ux-spec.md` | 复用既有处方话术；blocked 原因本轮不改；不把完整路径送 TTS |
| `docs/11-ui-spec.md` | 复用既有错误卡/项目详情/重试；不新增共享设置行；AS-07 才动 §5.8a |
| `docs/02` §5.1 / `projectOverrides.ts` / DDL | **本批不改** |

- 凭据命中（ledger）：该片段不落盘；ledger 不 insert；项目登记与用户原文件继续。
- 凭据命中（foundation）：本次新 generation 不发布；staging 不写；旧 generation 与 pointer 不变。
- ignore 创建失败 / 已跟踪 / 保护不足：只停这一次敏感投影。
- 已有明文 secret 不自动 forget、不 `git filter-repo`；用户走既有 forget 两阶段（`docs/10` #38）。
- 未来门禁：canonical / daemon 改动须 `just ci` + 必要定向测试（ledger/foundation）。四个文档门（emoji / doc-links / privacy / schedule-pointer）不能代替。

## 4. 后续项（有限机制，不是本批自动施工）

### AS-03 笼子 conformance（S；撰写阶段未执行 live）

`cage.ts:1-5,47-98`：`claude`/`grok` = tool-deny；`codex` = write-sandbox 限写不限读（`-s read-only`）；`cursor` = ask+tripwire，因鉴权不进隔离 HOME。

测试列分列，不得合成一个「逃逸/未逃逸」：

| 列 | 含义 | 失败条件 |
| --- | --- | --- |
| tool_denied / write_denied / tripwire_fired | 与现有 enforcement 合同一致 | 合同要求的事件未出现 |
| leak_observed | 输出或工具结果含哨兵 | 观测到泄漏（检测型笼子可发生，结果标 `enforcement: partial`） |
| unverified | 超时、未发起访问、无凭据未启动 | 不得记 PASS |

阳性控制：故意允许的读（`readonlyFoundation` 下 claude 的 Read）必须读到哨兵，否则测试本身无效。模型自述不算证据。读成功不是现有 read-only 合同违约。live 有凭据/网络/费用：未来明确授权与标签。回退：删除测试文件，不改 cage argv。触发：BYOA/conformance 测试窗口；`SAYDO_SLOW_E2E` 门控。

### AS-04 工具循环：重复指纹 + 进展信号（先诊断，S）

事件消费侧对 `tool+参数` 做 digest。连续 N 次（推荐默认 N=5，观察值不是合同常数）且无进展才记诊断：`tool_repeat_no_progress` 审计。进展 = 结果 digest 变、写入路径集变、错误码变、cwd 变。本轮不把该信号接入 `blocked`。若未来要停止：只改既有 `circuitBreakers` + `packages/contracts/src/tier1Presentation.ts:12-19` + `docs/10-voice-ux-spec.md:119` 一条 canonical 路径。正例：5 次相同 `cat README` 且正文未变 -> 诊断。反例：直接 `tool_loop_detected` blocked 而不改 10:119。

### AS-05 效果词表：有限正反例，不重写 shell parser（S）

1. verifyFreeze 闭包内 config 被 file 工具写入 -> PreToolUse 升 S2 候选，仍不可解冻 verify。
2. git 有限 grammar（正式路径 `cmdEffect.ts:988-1003`）。只对确实支持 `--no-verify` 的子命令列该旗标：
   - `commit`：`--no-verify` 与短选项 `-n`；组合短选项含 `n`（如 `-an`）同等，升至少 S2。簇从左扫描；遇取值短选项（如 `-m`）则其余字符是值（`-mn` 的 `n` 是 message 文本）。
   - `merge` / `rebase` / `push`：仅长选项 `--no-verify` 升至少 S2。
   - `am`：`--no-verify` 与 `-n` 升至少 S2。
   - **不是**同义绕过：`push -n` / `push --dry-run` 是 dry-run；`cherry-pick -n` 是 `--no-commit`；`rebase -n` 是 `--no-stat`。
   - 提交 message 引号内出现 `-n` 不误判。
   - `git config core.hooksPath ...` 升 S2；`git -c core.hooksPath=...` 与全局 `-c` 其它键区分。
   - 效果计算必须 `max(existingRisk, proposedFloor)`。不得把现有根外 `core.hooksPath` / 受保护操作的 S3 降成 S2。现测已锁：`git -c core.hooksPath=/tmp/hooks commit -m x` → S3（`test/tier1-cmd-effect.test.ts:316`）；`git --git-dir=/etc/.git commit -am x` → S3（`:278`）；保护分支 `git push origin main` → S3。
3. 引号/heredoc：先补 §12 反例。`cat <<EOF > worktree-file` 圈内写 S1。`bash <<EOF` / `python <<EOF` 不可判 -> 既有未知 S2。`cat <<EOF | sh` **不是** 天然 S3。

canonical：04 §5.1 例子表；§12 反例。verify 冻结不改。

### AS-06 CI advisory 扫描（S）

保留现有 SHA pin、`persist-credentials: false`、`allowBuilds`。只提议：在锁定 pnpm 10.33.1 与 Node 22 的发布包平台上，对 runtime prod 依赖跑 `pnpm audit --prod`，证据绑定 `pnpm-lock.yaml` digest + advisory 数据库时间 + 退出原因。网络错误/数据库过期 = `indeterminate`，不得当「无漏洞」绿。不默认加 `--ignore-scripts`（以免破坏 `esbuild`/`koffi`）。`minimumReleaseAge` 推迟。跟随 PG-02 registry / PG-03 control graph。

### AS-07 探针/新增数据外发的披露文案（文档项，S，非控制项）

借 ECC 六类词表骨架，写入 `docs/11-ui-spec.md` §5.8a 与 `docs/10` 话术。不建第二套 consent 存储；审批门保持 fail-closed。不提供关闭必要审批。

### 长期 deferred（触发才开，不是自动施工）

| ID | 项 | 触发 |
| --- | --- | --- |
| S-01 / G-B12 / P2-10 | 安装收据 + doctor / uninstall dry-run | owner 立 G-B12 产品级分发批。形状：`saydo.install.v1`，`managed[]` path+sha256+origin，`sourceRevision` 复用裸 hex，`hookConsent` 仅 not-applicable。doctor 只对照收据。不 vendor ECC 安装器。 |
| S-03 / P2-11 | 记忆 importer | 任何第三方记忆导入需求。合同：只经 `MemoryLedger.add`；`source.kind=import`；不传 `requestedTrust`；`trust=candidate` + taint；不是 `third_party`；不绑 `readinessKey`；升格只走 `approveCandidate`。 |
| S-04 | adapter 诚实表 | 只跟随 PG-02，不另造 ledger。 |
| S-05 | MCP 脱敏 inventory | 有诊断 ticket 再开。 |
| S-06 / P2-12 | host-reported remaining% | Tier1 接入带 statusline 的交互式后端。不读私人日志。 |
| S-07 / P2-01 | worktree 观测 / TCAS | 默认不做；W6 时再评。 |
| P2-02 | remote URL 跨机器 id | T3；只作关联 hint，不替换 inode。 |
| P2-05 | 披露词表 | AS-07 窗口。 |
| P2-06 | competing golden | docs/10 §6 扩容。 |
| P2-07 | 任务卡 importer 提示 | `taskCard.ts` 修订；非控制项。 |
| P2-08 | >=2 项目晋升 | 提名信号，不自动 promotion。 |
| P2-09 | Codex rollout 解析 | codex Tier1 后端开批。 |
| P2-03 | E-70 系数 | 不进真值；随 D-19。 |
| P2-04 | Windows python 桩 | 语音管线上 Windows 时。 |

## 5. 不借清单与红线

不借：替换 daemon/console；ECC orch/ecc2 替换 Tier1；instinct 注入与 auto-prune；默认 hooks 进 `~/.claude`；286 skills 整包；模型降档当优化；`ecc ito`/Nasiko 赞助桥；`ecc-memory-mcp` 作 Brain 工具；跟随 HEAD 做 submodule；第二套排产源；GateGuard 作为门；Stop 时阻止结束；harness-audit 总分；控制面/看板；MCP 宿主；`permission-mode` / `--dangerously-skip-permissions` 替代审批 socket。

红线：

1. Tier1 剥离用户配置：`--setting-sources ""`、`--strict-mcp-config`、`claudeEnvOverrides` 禁自更新。
2. Gate 0 无 bypass、S3 语音绝不放行。
3. 记忆写路径 candidate → trusted、M0 拒第三方。任何 importer 都走 `ledger.add`，不传 `requestedTrust`，不 DAO 旁路，不绑 readiness。
4. 审计不可变、敏感只记 digest。
5. 零 emoji、状态词纪律。搬任何 ECC 文案前过 `check-emoji.sh`。
6. 不做 MCP 宿主、不做控制面/看板/多 agent 编排。
7. 排产单源与 exact-set。本文不是排产源。
8. `project.toml` 是不可信输入。
9. 不引入 `ecc-universal`；不跟随 ECC HEAD。
10. 锁版本执行后端不照搬 auto-update。

## 6. 源码证据（本轮实读）

本仓 HEAD `bcf8ea85`：`packages/daemon/src/memory/{ledger,classify,foundation,compiler}.ts`、`voice/redactor.ts`、`providers/byoa/cage.ts`、`tier1/{backends/claude.ts,cmdEffect.ts,verifyFreeze.ts,fileToolEffect.ts}`、`approvals/circuitBreakers.ts`、`config/projectOverrides.ts`、`storage/ddl.ts`、`brain/liveTools.ts`、`projects/workspace.ts`、`packages/contracts/src/{tier1Presentation,runtime}.ts`、`docs/03-architecture.md:143`、`docs/09-data-contracts.md:524`、`docs/10-voice-ux-spec.md:119`、`package.json:6,24-30`、`.github/workflows/ci.yml:16-18`、`justfile` `ci`/`ci-node`/`ci-python`、`deploy/saydo-octoooo-com/install.sh:1-18`、`docs/plan/IMPLEMENTATION-PLAN-2.md:13-14,25`、`docs/plan/2026-08-28-project-gap-closure-program.md:136,951`。

ECC permalink 示例：[`memory-vault.js`](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/scripts/lib/memory-vault.js)、[`hook-consent.js`](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/scripts/lib/install/hook-consent.js)、[`block-no-verify.js`](https://github.com/affaan-m/ECC/blob/e04ea0b9cc8248686edf5ac751cadff550e162b8/scripts/hooks/block-no-verify.js)。

本轮未跑产品 runtime/live、笼子或 `pnpm audit`。未改产品代码、canonical 或 schedule-pointer。

## 7. 映射附录（稳定 ID + 能力名）

行号会因 supersede banner 漂移，下表用 E 编号。覆盖原 Fable 65 行、旧 Codex S-01..S-07 / S-C1..C10、Fable deferred P2-01..P2-09、以及 Fable consolidated 相对评估稿的改动。不能读成「其余全部不借」一句了事。

### 7.1 Fable 65 行 → 终裁

| E | 能力名 | Fable | 终裁 |
| --- | --- | --- | --- |
| E-17 | GateGuard 门 | C | 不借；质量 deny 污染 canary |
| E-17b | 任务卡提示 | B | 延后；非控制项；触发 `taskCard.ts` |
| E-18 | config 写入升 S2 | B | AS-05：只升 S2，不解冻 verify |
| E-106 | `--no-verify` | B | AS-05：commit/am `-n` 升 S2；push `-n` 不是绕过；S3 不降级 |
| E-107 | heredoc | B | AS-05：有限反例，非天然 S3 |
| E-20 | 工具循环 | B | AS-04：先诊断，不直接 blocked |
| E-19 | usage occupancy | C | 已有 run 级 usage |
| E-22 | statusline cost | C | 09 订阅行 amount NULL 更严 |
| E-29 | 披露词表 | B | AS-07 文案；撤回 consent 存储 |
| E-68 | 哨兵测试 | B | AS-03 分档 conformance |
| E-13 | Prompt Defense | C | 已有 UNTRUSTED 栅栏 |
| E-82 | safety-guard | C | 运行时强制已覆盖 |
| E-72 | 进程组 kill | C | 已有身份 CAS 回收 |
| E-34 secret | 记忆写前拒写 | A | AS-01 窄凭据字面量 |
| E-26 | 事件侧检测 | B | 并入 AS-01；只审计 digest |
| E-34 gitignore | project gitignore | A | AS-02 实际保护语义（声明私有 write set；共享 schema/UI 延期） |
| E-34 BigInt | 文件身份 | C | `workspace.ts:229` 已有 |
| E-34 symlink | 不跟 symlink | C | 已有 |
| E-33 | ecc.memory.v1 | C | ledger 更强；导入见延后 S-03 |
| E-37 | instincts 晋升 | B | >=2 项目只是提名；hash 只是 hint |
| E-25 | SessionStart 注入 | C | Context Pack 已更强 |
| E-24 | haiku 摘要 | C | 已有 summarizer 纪律 |
| E-36 | handoff | C | 任务卡 + native_session_id |
| E-39 | session.tmp | C | 私有格式不借 |
| E-41 | Codex rollout | B | 延后；codex Tier1 后端 |
| E-06 | 矩阵渲染 | C | PG-02 ledger；渲染作实施备注 |
| E-07 | 平台状态词 | C | D-14 / PG-02 |
| E-67 | competing golden | B | 延后；docs/10 §6 |
| E-66 | pass@k | C | 确定性测试不需要 |
| E-55 | 总分 | C | 与 11 §0 冲突 |
| E-56 | 缺失不绿 | C | 已有 |
| E-60 | Plan Canvas | C | 决策包已覆盖 |
| E-61 | TCAS | B deferred | 触发 W6 |
| E-62/E-63 | worktree 编排 | C | 已有任务 worktree |
| E-65 | loop 红线 | C | verify 冻结即实例 |
| E-64 | orch-review | C | 单 reviewer 制度 |
| E-58 | status 导出 | C | HANDOFF + pointer |
| E-75 | Actions 加固 | B | 钉 SHA 已有；AS-06 不加 ignore-scripts |
| E-73/E-74 | audit/IOC | B | AS-06 advisory；不借 IOC 清单 |
| E-84 | 多 PM 矩阵 | C | 只 pnpm+Node22 |
| E-85 | 打包生命周期 | C | 已有更严 |
| E-89 | 发布 tag | C | 已有 |
| E-76 | 个人路径 | C | 公开树隐私门 |
| E-77 | Unicode/emoji | C | check-emoji |
| E-78/E-79 | 原子写/loopback | C | 已有更强 |
| E-87 | GIT_DIR 剥离 | C | 不宣称风险为零；不立项 |
| E-08 | 目录计数 | C | claims/gate parity |
| E-92 | Windows python 桩 | C | 延后；语音管线上 Windows |
| E-91 | 历史坑回归 | C | DDL fixture |
| E-09/E-10/E-11 | 流程台账 | C | PLAN-2 / journal |
| E-12/E-48 | 迁移/双路径 | C | MIGRATION.md |
| E-01 | 三份指南 | C | 不借教程文体 |
| E-02–E-05 | 能力面/MCP/skill | C | 不做 MCP 宿主、不生产 skill |
| E-14–E-16/E-28/E-30/E-31/E-32/E-98/E-108 | hooks 装入宿主 | C | 不装进用户 Claude/Cursor/Codex |
| E-21/E-23/E-27 | statusline/session-end/MCP probe | C | 不观察用户私人会话、不主动探 MCP |
| E-35 | memory MCP | C | 不做 MCP 宿主 |
| E-38 | homunculus 路径 | C | 数据在 SayDo 自己的目录 |
| E-40/E-42/E-43 | ECC 内部 store | C | 不借 |
| E-44–E-54/E-99–E-105 | 安装目标/账本/清点 | C | 安装账本延后 G-B12；MCP 清点本期撤回。**Fable 把整组判 C 漏了 SayDo 自身分发面**，见下 consolidated 改动 |
| E-57/E-59 | 控制面看板 | C | 不替换 console |
| E-69 | ecc2 | C | 审计触发器已有 |
| E-70/E-71 | 预算系数/降档 | C | 系数不进真值；不降档 |
| E-80/E-81/E-83 | 官方源/AgentShield/AURA | C | 不扫用户 Claude 配置 |
| E-86/E-88/E-90 | 组件校验/c8/Python | C | 栈不同 |
| E-93–E-97 | 业务/商业/dashboard | C | 越界 |

### 7.2 旧 Codex S-01..S-07 与 S-C1..C10

| ID | 原裁决 | 终裁 |
| --- | --- | --- |
| S-01 | A 安装收据+doctor | 延后 G-B12；非第一刀。角度成立：对象是 SayDo 自己的 `saydo up` 分发面 |
| S-02 | A hookConsent 默认 declined | 撤回；披露改 AS-07 |
| S-03 | B ECC 记忆导入 | 延后；合同形状保留；本轮不施工 |
| S-04 | A adapter 诚实表 | 只跟随 PG-02 |
| S-05 | B MCP 脱敏 inventory | 本期撤回 |
| S-06 | B remaining% | 区分 run cost 与 occupancy；无输入不造数据 |
| S-07 | C 执行 / B 排障 | 默认不做 |
| S-C1..C10 | 不借 | 全部保留不借（替换 daemon、ecc2/orch、instinct 自动注入、默认 hooks 进全局、286 skills、模型降档、ito/Nasiko、ecc-memory-mcp、跟随 HEAD submodule、第二套排产） |

### 7.3 Fable consolidated 相对评估稿的改动

| 改动 | 终裁是否吸收 |
| --- | --- |
| 新增 G-B12 分发面（S-01），纠正 E-44–E-54 整组 C | 吸收为 deferred_with_trigger；第一刀仍不做 |
| 写仓内无 `scripts/install` | **纠正**：真实文件是 `deploy/saydo-octoooo-com/install.sh` 与 `install.ps1`。缺的是收据/doctor/升级卸载，不是安装器本身 |
| 第一刀含笼子/CI/循环/效果词表 | 不吸收进第一批；改为 AS-03..06 后续项 |
| 循环作 blocked 原因 | 收紧为 AS-04 先诊断 |
| gitignore 字节全等 `*` | 收紧为 AS-02 语义验证；不改成全目录一律封禁 |
| 团队共享经 `project_settings` 开关 | **本批不吸收为验收项**；共享字段/UI 延期，现有手工共享配置不覆盖 |
| secret 复用 redactor 全表 | 收紧为凭据子集 |
| `RuntimeIdentity.sourceRevision` 裸 hex 不得另造前缀 | 吸收 |
| 发布双坐标 npm 2.2.0 ≠ 源码 2.2.1 | 吸收 |
| Codex 三列（native plugin / legacy sync / 项目配置） | 吸收为对照事实；SayDo 不装 Codex plugin |

## 8. 实施触发

1. 用户在新任务明确启动 [未来实施合同](2026-09-05-ecc-implementation-prompt.md)，才授权产品施工。本轮不启动。
2. 启动后先核验 PLAN-2 指针。若 `next=PG-01B` 且 PG-01B 未 `last_closed`：只做可审查准备（坐标核验、write set 冻结、覆盖矩阵草稿、未完成前置声明），不改 `packages/daemon` / canonical / schedule-pointer，不把在建 worktree 当已合并。
3. PG-01B 合并后，supervisor 按 D17 把本隐私批插入指针（推荐 `PG-01B` 之后、`PG-02` 之前）。实施范围仅 AS-01/AS-02（含同批恢复），不含共享设置/schema。然后返回 PG-02。长期 deferred 不算自动施工。
4. 交付时写清：未完成前置 / 已验收范围 / 可继续阶段。不凭模型自述判 GREEN。

### 8.0 实际回报、维护与用户成本（不编造量化收益）

- **回报：** 凭据字面量不进 ledger/foundation；私有生成物默认不被 Git 跟踪；失败时用户能看见「没记下 / 仍用旧知识 / 还没有底座」，并能在修源文件或 Git 保护后用既有重试发布新一代。
- **持续维护：** 声明 grammar 外的新 token 形态是已知漏检；占位符可过，同格式假 token 不承诺可分。Git 规则只验证声明 write set，不是无限 linter。
- **用户成本：** 扫描与 Git 查询只发生在相关写入/构建边界；失败只停本次受影响写入/投影，不拦项目登记或其它对话。不新增设置页、不要求重装、不自动删用户文件。
- **触发：** 新任务明确引用未来实施合同；PG-01B 未合并则只准备。

### 8.1 OctoWorkFlow（紧凑；全文在统一研究）

三分：主仓 HEAD `0b93139c7ce9f14f537ac50c8bb2ef11509d68be`；已提交 outcome 工作树 HEAD `e06a62ac0e73d779d58687bad5d920f8a89d3ef8`（代码 release `eb3703826833ba6b141a36fdb4aaae2dcd786ff6`）；已安装 runtime 25 个公开文件。`e06` 不是主仓 HEAD 祖先（`git merge-base` exit 1）。`policy_revision` 同 2.4.2，但关键 Python 实现 hash 不同。不要重造 collector/receipt/doctor/adopt/`report_conventions`。顺序：先收敛来源再优化。本轮 probe：完成 cycle `repair_rounds_used=2` 且 `current_blockers=[]` 时 `review_yield_from_state` 返回 false；7 个 `*-summary.json` 不被只识别 `*.summary.json` 的 discovery 读到。这是 observability 缺口，不是控制失效。本轮不为 OWF 写实施任务。

### 8.2 其它项目初筛（紧凑；全文在统一研究）

扫描范围：WorkSpace 直层、Reference 直层、Reference/_borrow-peers、OctoSkill 直层的 README/目录/本地 HEAD。`workspace-inventory.json` 列 190 个 git 目录（含 worktree/clone/同源副本），不是 190 个独立产品；identity 去重 175。7 个优先候选：beforedone、compound-engineering-plugin、pi-mono、agent-compose、OpenViking、ReMe、voicebox。次级：opentag、synara、codex_manager、TokenTracker、autoresearch。已有深研的 deepseek-harness、tailcat、swarm-forge 及 `_borrow-peers` 不再排首位。第一方 Hopper/Aindle/OctoMonitor/YoUsage 先复用自己的证据。初筛不是可抄结论。

<!-- ecc-final:delivery-status -->
> 范围修订，独立评审结果见本仓交付记录。上一版历史证据：R3 完整语义 GREEN；R4 复核 GREEN；十二项文档门禁 exit 0，ContextView 148 tests OK——仅证明修订前文档，不预填本范围 GREEN/PASS。
