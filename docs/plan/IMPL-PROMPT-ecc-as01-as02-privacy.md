# IMPL-PROMPT · AS-01-AS-02 隐私批

日期：2026-09-06。任务标识 `ecc-as01-as02-privacy`。这是本批唯一执行卡。配套 canonical 已按统一方案 §3 回写；来源方案 `docs/plan/2026-09-05-engineering-unified.astra.md` 原字节不改。

当前阶段 = **contract / c1**（本文件冻结范围、正反例、exact-set、成本与 gates）。后续阶段 = **implementation / c1**。两阶段已预先接受；contract 语义 GREEN 且文档门通过后才改 daemon/console。收口后不自动实施 AS-03..07 或 PG-02。

父 supervisor 编排。实施者不派 subagent/reviewer、不自判 GREEN、不调用其它语义 CLI。

## 1. 授权、前置与坐标

- owner 于 2026-09-05 直接提交《SayDo 工程改进统一实施 Prompt · Astra》作为实施请求，默认近期组合 PG-01B → AS-01/AS-02。登记在 `docs/plan/2026-08-28-project-gap-owner-decisions.md` 第 10 节。不是 D17 扩权，不改写 D17 原话。
- PG-01B 已入 main：I `ebd449080bb0e476eb2dd3334ee0b152cb3a7eeb`，E `99d51106c9caaefcf55f72bff1a17a78abf58be9`，证据 `e2e/evidence/pg-01b-20260905.md`。无 `--finalize` 记录；R129 记 owner 知情合并。不清旧账、不伪称 finalized、不重做 PG-01B。
- 唯一批 ID = `AS-01-AS-02`（有限组合；单独 `AS-01` 或其它 AS 编号不是合法指针 id）。PLAN-2 链全等串：`PROC-01 → PG-01B → AS-01-AS-02 → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop`。
- 无 commit/push/merge/install/deploy、真实 provider、付费探针授权。不操作常驻 runtime、真实 `.saydo` 数据或用户 Git 历史。
- 风险 L3（持久化隐私与信任边界）。P2 用本任务唯一 ledger（contract 只登记，最终交付前一次 sweep）。

控制目录：`docs/plan/ecc-as01-as02-privacy-contract/` 与后续 `docs/plan/ecc-as01-as02-privacy-implementation/`，各自 `cycle.json`。当前恢复 cycle = `owner-recovery-1`，控制根 `docs/plan/ecc-as01-as02-privacy-contract-recovery-1/`。owner 授权继续修复直到验收通过，解除因产品修复/复审/同因次数耗尽而停止的限制；3/3 只是每个账本 cycle 的分段，耗尽后衔接新恢复 cycle，不是再次询问 owner 的停止条件。不降原三项：一名零上下文独立评审；语义 GREEN 后才跑完整门禁；最终交付前一次 P2 sweep。owner-recovery-1 先闭合 AS-C3-SAFE-SOURCE-GRAMMAR-CONFLICT。本修复闭合 review-1 的 AS-C1-PEM-EXEMPTION-OVERLAP 与 AS-C3-SAFE-SOURCE-DEL；不重做已符合的 AS-C2/C4，不改 daemon/Console runtime。

## 2. 四行回报/成本

- 用户可见回报：敏感片段不再进入新记忆/底座；Git 未保护时停本次私有投影；区分单条未保存、刷新失败仍用旧有效知识、首次暂无底座；现有奠基/重试能恢复。
- 增量成本上限：不新增模型请求、后台扫描、持续上报或服务。扫描只绑 `MemoryLedger.add` / foundation 构建 / 相关私有投影边界。具体数字见 §5；超界按所影响写入 fail-closed，不吞失败造成功。不得用全项目成本基线阻塞本批止损。
- 用户负担：可能需移除源文件凭据或手工修正 Git ignore/untrack（daemon 不执行），然后现有奠基重试。不重装、不关闭保护、不自动删历史。本地成功路径和旧知识保留。
- 维护与停止/扩展：由 memory/ledger/foundation 与现有 ProjectSettings 承接。本批止于声明凭据 grammar 和私有 write set；格式外漏检如实列限，不扩为全源审计/共享平台/通知中心。

## 3. 两阶段验收

| 阶段 | 范围与 acceptance | 门禁与继续 |
|---|---|---|
| contract / c1（当前） | AS-C1..C4：§3 语义进 canonical；默认私有与手工共享不冲突；本文件冻结 M1–M8/白名单/正反例/成本/gates；PLAN-2 登记真实、无多余共享设置 | 一名只读设计 reviewer；`bash docs/plan/ecc-as01-as02-privacy-contract/docs-gate.sh`。GREEN 后才进入 implementation；本阶段不改 daemon 行为 |
| implementation / c1 | 实现 M1–M8；先记录 contract GREEN/schema baseline，再写代码与测试 | 一名全新代码 reviewer；GREEN 后 `just ci` + `pnpm exec playwright test` |

### 3.1 contract 已冻结的共享 schema

本阶段允许并已写入：

- `packages/contracts/src/types/knowledgePrivacy.ts`（含 `CREDENTIAL_GRAMMAR` / `findCredentialLiteralSpans` / `isSafeRelativeSource` / `foundationRulesRelativeSource` / `decodeFoundationRulesRelativeSource`；`credentialKindSchema` 只是 kind 枚举）
- `packages/contracts/src/index.ts`（export）
- `packages/contracts/test/knowledge-privacy.test.ts`

未把 `foundationOps.BootstrapResult` 提升为共享 DTO。后续若共享新错误字段，必须让下列**全生产消费者**做同一 runtime parse，不能另造第二 DTO；旧成功 `{ok:true, generation, status, progressLine}` 兼容保持：

1. `packages/daemon/src/memory/foundationOps.ts`（本地 DTO 生产者）
2. `packages/daemon/src/index.ts`（`POST /api/projects/:id/foundation/bootstrap`，现 `r.ok?200:409` + `JSON.stringify(r)`）
3. `packages/console/src/lib/api.ts` `bootstrapFoundation`（今日类型只写了成功形）
4. `packages/console/src/pages/ProjectSettings.tsx`（成功拼 generation 行，失败 `catch` message）
5. `packages/daemon/test/memory-growth.test.ts`

`packages/daemon/src/config/defaultTemplate.ts` 的 `BootstrapResult` 是配置引导，禁止混用。

不新增 `knowledgeShare`、`projectOverrides` 字段或 DDL。`projectOverridesSchema` 仍仅 `models`/`budget`。

## 4. M1–M8（implementation 必须实现）

错误码（contracts `knowledgePrivacyErrorCodeSchema`）：`memory_secret_literal` / `foundation_build_restricted` / `git_protection_insufficient`。失败 class：`memory_item_not_saved` / `foundation_refresh_failed_kept_old` / `foundation_first_build_unavailable`。Git status：`not_git` / `protected` / `insufficient` / `outside_root` / `query_failed` / `write_failed`。

声明 grammar 唯一实现为 contracts `findCredentialLiteralSpans`（daemon 只 import，不得重写规则）。`credentialKindSchema` 不含长度/字符集。

- PEM：`-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----` … `-----END [A-Z ]{0,40}PRIVATE KEY-----`，内文 0..524288，非贪婪。
- 起始边界：前一字符不属于 `[A-Za-z0-9_]`（或文本开头）。
- `sk-` + `[A-Za-z0-9-]{16,256}` → `openai_sk`；结束不得仍属该字符集。
- `ghp_` + `[A-Za-z0-9]{16,256}` → `github_ghp`。
- `github_pat_` + `[A-Za-z0-9_]{16,256}` → `github_pat`。
- `xox[baprs]-` + `[A-Za-z0-9-]{16,256}` → `slack_xox`。
- `AKIA`/`ASIA` + 恰好 16 位 `[0-9A-Z]`，结束不得属于 `[A-Za-z0-9_]`。
- 有限豁免一律完整覆盖语义（`CREDENTIAL_EXEMPTION_SCOPE=covers_whole_span`，不按 PEM/token 分叉、不使用 any_overlap）：独立 `env:[A-Z][A-Z0-9_]{0,63}`；`sha256:`+64 hex；SayDo id；`${[A-Za-z_][A-Za-z0-9_]{0,63}}`；`(?<![A-Za-z0-9_])$[A-Za-z_][A-Za-z0-9_]{0,63}\b` 不作为凭据证据。仅当某豁免覆盖整段凭据跨度才跳过该命中；合法 ID 只覆盖 token 末尾、PEM 正文局部引用不得豁免（PEM 正文含 `env:OPENAI_API_KEY` 等声明豁免仍命中 `pem_private_key`；`sk-`+16 个 `A`+`-`+合法 mem_ id 仍命中 `openai_sk`）。已声明 kind × 已声明豁免只检查完整覆盖、无相交、仅局部相交三类；语法不可能交叉的组合标不适用。`CREDENTIAL_PLACEHOLDERS` 整串仅命中跨度与占位符起止相同才豁免；合法长 literal 含子串不得整段豁免。`sk-test` 后追加 13 个 `A` 使 body=17 仍命中 `openai_sk`。
- 不纳入：TTS 其余项、路径 kind、客户数字、泛长串、熵估计。同形假 token 仍命中。不是无限语言 linter。测试样本运行时拼接。

私有 write set：`.saydo/foundation/`（含 `staging-gen-*`）、`.saydo/knowledge/`。托管 ignore 建议路径 `<workspace>/.saydo/.gitignore`，create-only；根 `.gitignore` 已有等价覆盖则接受。本批新增保护查询封闭集 `GIT_PROTECTION_QUERIES`（5 次，`git -C <workspace>`）：`rev-parse --is-inside-work-tree`；对 `.saydo/foundation/` 与 `.saydo/knowledge/` 各一次 `check-ignore -v --` 与 `ls-files -z --`。`check-ignore` exit 1 = 未忽略，不是 `query_failed`。不做无限 gitignore linter。

### 4.1 将落盘 raw 来源（AS-C1）

扫描对象是**即将写入的字节**，不是「路径就是凭据」。foundation 在首次 `mkdirSync(staging)` 前组装并扫描：

| 落盘文件 | 现有写入内容 | 本批合同 |
|---|---|---|
| `knowledge/gen-N/core.md` | 含 `- 工作区:${this.workspace}`、status、repoHead、AGENTS/CLAUDE 首 20 行 | **消除**原始绝对 workspace 行（固定非路径标签或删行）。其余组装文本扫描 |
| `knowledge/gen-N/inventory.md` | 相对 KEY_FILES 路径/digest/skipped | 扫描组装文本 |
| `knowledge/gen-N/build-test-run.md` | package.json scripts、justfile 任务名 | 扫描组装文本 |
| `knowledge/gen-N/conventions.md` | AGENTS/CLAUDE excerpts、现场 `.cursor/rules/*.md|*.mdc`（先过 `classifyRulesReadBound`，通过后每文件最多 2000 字切片） | 扫描组装文本。2000 字是落盘切片，不是磁盘读取上限 |
| `.saydo/foundation/manifest-gen-N.json` | generation/status/repoHead/treeOid/inventory | 扫描 JSON 文本；不得新增绝对 workspace 字段 |
| `.saydo/foundation/current.json` | `{generation, manifest}` | 无用户原文，不扫 |
| `AGENTS.md` 指针块 | 相对 `.saydo/knowledge/current/core.md` | 不把用户 AGENTS 原文当本批拒 generation 的扫描面；不因凭据改用户原文件 |
| ledger `add` | claim + 将落盘 `source.quote`/`source.ref` | 扫描这些字符串 |
| `onFact` 入账 claim | publish 后经 `ledger.add` | 由 ledger 闸覆盖 |

反例：workspace 目录名含 `sk-`+16 位仍把绝对路径写入 core.md；只扫 KEY_FILES excerpts 却把未扫的 `this.workspace` 落盘；把整条路径标成凭据 kind。

正式 UI 路径：`#/p/:id/settings` → `App.tsx` `psettings` → `ProjectSettings`。implementation 仍须再核实该路径。

### 4.2 记忆拒写生产消费者与恢复（必须闭合）

中央 `ledger.add` 闸拒绝 ≠ 外层事务成功继续。implementation 必须逐条隔离；不得只靠闸抛错让 `db.transaction` 整段回滚。本阶段不改这些运行时文件，只冻结路径。

| 生产消费者 | 现况 | 必须恢复协议 |
|---|---|---|
| `brain/liveTools.ts` `remember` | `ledger.add` 无 catch | 捕获 `memory_secret_literal` → `toolError`（message 无原文）；对话继续 |
| `brain/liveTools.ts` `addHotword` | `hotwords.add` 无 catch | 同上；不得 `{ok:true}` |
| `memory/growth.ts` `nominateFromSession` | 一轮抛错会跳过同批剩余提名 | 每条 try/catch；跳过命中 claim，其余轮次继续；suspend 收尾不失败 |
| `projects/lifecycle.ts` `reanchorDraft` | 全部 `add` 在同一 `db.transaction` | 事务内逐条捕获；命中不复制；其余并入；仍 archive draft；`merged` 只计成功条；审计记 skipped；**禁止**整事务回滚后说「其它工作继续」 |
| `index.ts` `POST /api/memory/:id/approve` | 笼统 409 `memory_action_failed` | 命中映射 `memory_secret_literal`；候选不变 |
| `memory/foundationOps.ts` `onFact` | 已有逐条 catch | 保持；记 `factsFailed`；已发布 generation 不翻转失败 |
| `memory/negation.ts` `captureNegation` | 生产 src 未接线 | 本批不接线；若调用按单条隔离，禁止塞进外层事务 |

`relativeSource` 用 `isSafeRelativeSource` 校验定位串：接受 `.cursor/rules/demo.md`、`rules/foo..bar.md`、普通 rules 名的 identity（`.cursor/rules/`+最长 255B 普通名，最长 269 字符）。拒绝 `/tmp/outside.md`、`C:/windows/secret.env`、`C:secret.env`、`//fileserver/share/x`、`../secret.env`、定位串中的反斜杠/控制字符、超过 `relativeSourceMaxChars=784` 的来源。控制字符 = Unicode Cc 封闭集 `U+0000..U+001F ∪ U+007F ∪ U+0080..U+009F`（C0/DEL/C1），不含 `U+0020`/`U+007E`/`U+00A0`；不得只拒绝码点 `< 32`。rules 文件名不得直接拼进 schema：全生产消费者必须用 `foundationRulesRelativeSource`（plain 名 identity；其余名 `.cursor/rules/_enc/`+UTF-8 全字节百分号编码）。该关系覆盖声明 grammar 的完整输入域，包括 POSIX 合法 `a\b.md`、含该控制字符集的直系名、含凭据字面量的直系名；逆映射 `decodeFoundationRulesRelativeSource` 回到原名，不得把文件规范化成另一个文件，不得以含 `U+007F` 的 identity 进 safeHits。取消未登记的 240，不得为表示上限缩短 NAME_MAX 或拒绝声明支持的 rules 名。字符串合同，未测 Windows 真机。

| ID | 必须结果 | 正例 | 反例（必红） |
|---|---|---|---|
| M1 | contracts `findCredentialLiterals` 置于 `MemoryLedger.add` 的 classify/insert 之前；覆盖 supersedes 与 `remember`；§4.2 全部生产消费者按表隔离 | PEM/`ghp_`+16 构造串 ⇒ 抛/返回 `memory_secret_literal`，DB 无该 claim，audit 仅 kind+digest；reanchor 两条中一条命中 ⇒ 另一条并入且 draft 归档 | `requestedTrust=user_stated` 仍写入；错误/日志/TTS 含命中原文；一条拒写使整个 bootstrap/项目登记失败；reanchor 因一条命中整事务回滚 |
| M2 | 组装 §4.1 五件落盘文档并扫描后，才首次 `mkdirSync(staging)`；消除原始绝对 workspace | 命中后无 staging 目录、无新 `manifest-gen-N`、`current.json` 与旧 status 字节不变；core.md 无绝对路径 | 先写 staging 再告警；仍写入 `this.workspace`；只扫 excerpts 不扫组装文档；旧 manifest 被改 `partial` 且发布新 generation；预算 `partial` 合同套到凭据命中；首次无旧知识却报「仍用旧底座」 |
| M3 | create-only ignore + 实际保护验证 | 无 ignore 则写入最小规则覆盖 write set；已有 `.saydo/` 或等价规则不覆盖用户文件；tracked 目标停本次投影并保留文件 | 覆盖用户 ignore；自动 `git rm --cached`；把已跟踪共享文件当豁免继续写入新私有投影；强制整个 `.saydo` 字节全等 `*` |
| M4 | 非 Git / worktree `.git` 文件 / 根外 symlink / 写失败/保护不足各有确定结果 | 非 Git：`status=not_git`，跳过 Git 查询仍做凭据检测并可写本地；`.git` 文件用 `git -C <workspace>`，不把 `.git` 当目录读 | 根外 symlink 仍写入；`query_failed`/`write_failed` 当 `protected`；以「团队共享」无条件绕过 |
| M5 | 三类失败可区分；修复后现有重试能发布新一代 | 记忆拒写 class=`memory_item_not_saved`；有旧 generation 的 foundation 拒写 class=`foundation_refresh_failed_kept_old` 且 pointer 不变；无旧 generation class=`foundation_first_build_unavailable` | 未更新显示成 `ok:true`/generation 成功行；要求重装或关闭保护才能恢复；新建通知中心或跨服务去重库 |
| M6 | 现有 UI 只拿脱敏相对来源/行号/kind/处方 | `env:OPENAI_API_KEY`、`sha256:`+64 hex、SayDo id、整串占位符可过；PEM 内文含上述声明豁免仍命中 `pem_private_key`；`sk-`+16 个 `A`+`-`+合法 mem_ id 仍命中 `openai_sk`；`rules/foo..bar.md` 可过；`.cursor/rules/`+227B 普通名（241 字符）与 +255B 普通名（269 字符）identity 可过；POSIX `a\b.md` 经安全表示可过且定位串无反斜杠；含 U+0001/U+001F/U+007F/U+0080/U+009F 的直系名经安全表示可过且定位串无该控制字符；空格/U+007E/U+00A0 保持 identity；含凭据字面量的 rules 名定位串无该字面量；safeHits 无绝对/盘符/UNC | 整表搬 TTS regex（泛长串/路径/env 当凭据证据）；TTS 念完整路径或命中原文；`C:/windows/secret.env` 进 safeHits；`sk-test` 后加 13 个 A 被整段豁免；PEM 仅因内文含 `env:OPENAI_API_KEY` 变成零命中；`sk-`+16 个 `A`+`-`+合法 mem_ id 因 ID 局部重叠变成零命中；合法 255B rules 名因 240 上限无法进 safeHits；`a\b.md` 被读取入口接受却无法形成 safeHits；把 `a\b.md` 显示成 `ab.md`；`a`+U+007F+`b.md` 以含 DEL 的 identity 进 safeHits |
| M7 | 扫描/Git 只在写入/构建边界；遵守 §5 上限 | 单次 `add` 只扫该条落盘字符串；单次 bootstrap 只扫 §4.1 文档 + 现有 git + ≤5 次保护查询；总数 ≤16。rules 小输入（1 个 `a.md` 100B）通过；临界 16 文件合计 131072B / 单文件 65536B / 32 dirent / 名称 255B / 名称缓冲 4096B / `.cursor/rules/`+255B 普通名的 269 字符 identity 与 +255B 非普通名的 784 字符安全表示通过 | 每轮对话全仓扫；持续上报；日志留命中原文；超界仍写入成功；把新增保护算进旧「总共 8 次」。rules：`readFileSync` 全文再 `slice(0,2000)` 当读取上限；`readdirSync` 整目录装入再检查；第 17 个规则文件或 65537B 文件仍读；把 KEY_FILES `FILE_SIZE_LIMIT` oversized skip 套到 rules；合法 rules 名因 240 上限无法进 safeHits；为通过验收缩短 NAME_MAX 或拒 POSIX 合法 `a\b.md` |
| M8 | canonical/schema/代码/正式 UI/证据一致；恢复不静默取消保护 | 旧有效数据、用户文件、已建 ignore 保留；未测平台/live 标 `not_run` | 重放被拒内容；自动删库或改 Git 历史；删检测函数使保护静默失效；只用旧测试绿宣称 M1–M8 已覆盖 |

## 5. 成本上限（可判定数字与超界行为）

冻结在 `KNOWLEDGE_PRIVACY_LIMITS` / `KNOWLEDGE_PRIVACY_LIMIT_SOURCE` 与控制目录 `cost-limits.json`。已删除 ntfy HTTP timeout、`interview_question_budget` 等与 privacy 路径无关的映射。warmup 会话 git 不计入本批保护预算。

**现有实读（bootstrap 路径 `execFileSync("git")`，本阶段未改 foundation.ts）：**

- `FILE_SIZE_LIMIT=524288`（**仅 KEY_FILES**，oversized skip，不读正文）、`EXCERPT_LIMIT=6000`、`KEY_FILES.length=11`。
- 现 `.cursor/rules` 路径（`foundation.ts` conventions 循环）为 `readdirSync` 后对每个 `.md|.mdc` `readFileSync` 全文再 `slice(0,2000)`，**无数量/单文件/总量/枚举缓冲上限**（unmeasured）。`slice(0,2000)` 只是将落盘切片，**不是**磁盘读取上限。本阶段不改该运行时。
- 成功后续 dirty bootstrap = **8** 次：workspace `ls-files -z` + `rev-parse HEAD` 两次 + `rev-parse HEAD^{tree}` 两次（其中 2 次为重复读取）+ knowledge `add`/`status --porcelain`/`commit`。
- 首次 knowledge git = **11** 次：上述 workspace 5 + `init` + `config user.email` + `config user.name` + `add` + `status` + `commit`。
- 现 `foundation.git()` **无 timeout**（unmeasured）；未传 `maxBuffer` 时走 Node 22 `execFileSync` 缺省 1048576，异常一律 `undefined`（与 not_git 混用）。

**本批工程选择（新设计约束，不是测得旧上限）：**

- 新增保护查询 **5** 次，封闭集 `GIT_PROTECTION_QUERIES`，计入边界总数，不是「旧 8 次里挤进去」。
- 边界 Git 子进程总数 **16** = 现有峰值 11 + 新增 5。实施可缓存 HEAD/tree 重复读取，但不得把上限写回 8。
- `gitTimeoutMs=10000` 新加；`gitMaxBufferBytes=1048576` 显式传入；timeout/buffer/非「not a git repository」失败 → `query_failed`，不得标 `not_git` 或 `protected`。
- `maxScanCharsPerFoundationBuild=524288`、`maxMemoryClaimChars=524288`、`maxReportedHits=8`、`maxDedupeKeysPerFlow=8` 均为本批工程选择。
- `.cursor/rules` **实际读取**上限（本批工程选择，除名称 255B 为 POSIX NAME_MAX 实读）由 `classifyRulesReadBound` 唯一实现，daemon 只 import：单文件 **65536** bytes、接受文件数 **16**、dirent **32**、名称缓冲 **4096** bytes、读取合计 **131072** bytes。枚举必须 `opendir` 逐条，达到上限立即失败，禁止 `readdirSync` 整目录装入后再检查；每个规则文件必须 **先 stat 再读**，size 超限不得 `readFileSync`。缺目录跳过。超任一项 → `foundation_build_restricted`，首次 `mkdirSync(staging)` 前失败，旧 pointer/status 不动。不得把 KEY_FILES 或全仓 inventory 改成无界读再检查，不新增全仓扫描。
- `relativeSourceIdentityMaxChars=269`（engineering：`len(".cursor/rules/")` + NAME_MAX）。`relativeSourceMaxChars=784`（engineering：`len(".cursor/rules/_enc/")` + 3×NAME_MAX，覆盖百分号编码后的完整规则名域）。取消未登记 240。声明支持的 rules 文件经 `foundationRulesRelativeSource` 得到的完整相对来源必须能进 `knowledgePrivacySafeHitSchema`；超 784 则该条 safeHit 不合法，不得改短 NAME_MAX、不得拒绝 POSIX 合法直系名、不得改用绝对路径。

| 项 | 上限 | 出处 | 超界行为 |
|---|---|---|---|
| KEY_FILES 单文件读取 | 524288 bytes | existing_read | 该文件不进 excerpts（既有 oversized skip）；不得把未读正文写入 staging。**不**适用于 `.cursor/rules` |
| 单条记忆扫描 | 524288 chars | engineering | 拒写，等同凭据闸 fail-closed，不 insert |
| 单 excerpt / KEY_FILES 文本 | 6000 chars | existing_read | 只扫描将落盘的截断文本 |
| `.cursor/rules` 落盘切片 | 2000 chars | existing_read | 仅在读取上限通过后写入 conventions 的切片；**不能**代替磁盘读取上限 |
| `.cursor/rules` 单文件实际读取 | 65536 bytes | engineering | 先 stat；超则 `foundation_build_restricted`，不读该文件、不写 staging、旧 generation 不动 |
| `.cursor/rules` 接受文件数 | 16 | engineering | 超则同上；现循环无上限（unmeasured） |
| `.cursor/rules` dirent 数 | 32 | engineering | 含非 md；`opendir` 循环中超则停止，不把整目录读入后再检查 |
| `.cursor/rules` dirent 名称 | 255 bytes | existing_read POSIX NAME_MAX | 超则同上。字符串合同，未测 Windows MAX_PATH |
| safeHits `relativeSource` identity | 269 chars | engineering：`len(".cursor/rules/")`+NAME_MAX | 普通名显示保持兼容；未登记 240 已取消 |
| safeHits `relativeSource` | 784 chars | engineering：`len(".cursor/rules/_enc/")`+3×NAME_MAX | 超则该条 safeHit 不合法；不得缩短 NAME_MAX 或拒绝声明支持的 rules 名。非普通名必须走安全表示，定位串不得含反斜杠/控制字符(Unicode Cc:U+0000..U+001F ∪ U+007F ∪ U+0080..U+009F)/凭据原文 |
| `.cursor/rules` 枚举名称缓冲 | 4096 bytes | engineering | UTF-8 名称累计；超则停止 opendir。Node `readdirSync` 无 maxBuffer |
| `.cursor/rules` 实际读取合计 | 131072 bytes | engineering | 已接受文件 stat size 之和；将超则不读该文件。不是 `maxScanCharsPerFoundationBuild` |
| KEY_FILES 名数量 | 11 | existing_read | 不得另开第二套关键文件名单 |
| 单次 foundation 扫描字符合计 | 524288 | engineering | 超则 `foundation_build_restricted`，不写 staging |
| 现有 bootstrap Git（后续 dirty / 首次） | 8 / 11 | existing_read | 对照账用，不是保护查询预算 |
| 本批保护查询 / 每次私有投影边界 | 5 | engineering | 超则 `query_failed` → 停本次私有投影，不当保护 |
| Git 子进程 / 每次写入或构建边界（总数） | 16 | engineering | 超则 `query_failed` → 停本次私有投影，不当保护 |
| 单次 Git 超时 | 10000 ms | engineering（现路径 unmeasured） | 同上 |
| 单次 Git stdout+stderr | 1048576 bytes | existing_read 缺省 + 本批 fail-closed | 同上 |
| 报告给 UI 的 hit 条数 | 8 | engineering | 其余只计 overflow，仍导致本次写入/generation 失败 |
| 同一流程可见去重键 | 8 | engineering | 超出丢弃重复展示，不建通知中心 |
| 模型请求 / 后台周期扫描 / 持续上报 | 0 | engineering | 出现即范围漂移 |

反例：第 6 次保护查询或第 17 次边界 Git 仍标 `protected`；把 8+5 写成总共 8；timeout/buffer 当 `not_git`；扫描合计超 524288 仍 publish；claim 超长被截断后当无凭据写入；rules `readFileSync` 全文再截 2000 当已受限；17 个规则文件或 65537B 规则文件仍读取；`readdirSync` 装入 33+ dirent 再检查；把 KEY_FILES oversized skip 套到 rules；227B/255B 合法 rules 名拼成 `.cursor/rules/…` 后因 240 上限无法进 safeHits；POSIX 合法 `a\b.md` 被 `isFoundationRulesFileName`/`classifyRulesReadBound` 接受却无法进 safeHits；把该文件显示成 `ab.md` 或另一个已有文件。

## 6. implementation exact-set

must_change：

- `packages/daemon/src/memory/ledger.ts`
- `packages/daemon/src/memory/foundation.ts`（组装扫描、消除 `this.workspace` 落盘、`.cursor/rules` 改 `classifyRulesReadBound`+opendir/先 stat 再有限读、Git timeout/maxBuffer/计数）。本阶段不改此文件
- `packages/daemon/src/memory/foundationOps.ts`
- `packages/daemon/src/brain/liveTools.ts`（`remember`/`addHotword` 捕获凭据闸 → toolError，message 无原文）
- `packages/daemon/src/index.ts`（bootstrap HTTP：失败 409 + code/failureClass/safeHits；成功形不变；approve 映射 `memory_secret_literal`）
- `packages/daemon/src/projects/lifecycle.ts`（`reanchorDraft` 事务内逐条隔离，禁止整段回滚）
- `packages/daemon/src/memory/growth.ts`（`nominateFromSession` 逐条隔离）
- `packages/daemon/src/memory/hotwords.ts`（单条失败不得冒充 ok）
- `packages/console/src/pages/ProjectSettings.tsx`
- `packages/console/src/lib/api.ts`
- `packages/console/src/lib/apiError.ts`（可映射新人话，不把完整路径放主文案）

[new] 源：

- `packages/daemon/src/memory/credentialLiterals.ts`（import contracts `findCredentialLiterals`，禁止第二套 grammar）
- `packages/daemon/src/memory/gitProtection.ts`

[new] 测试（建立前不得当现役门禁）：

- `packages/daemon/test/credential-literals.test.ts`
- `packages/daemon/test/git-protection.test.ts`
- `packages/daemon/test/live-tools-remember-privacy.test.ts`
- `packages/console/src/pages/ProjectSettings.test.tsx`

可扩展既有：`packages/daemon/test/memory.test.ts`、`packages/daemon/test/memory-foundation.test.ts`、`packages/daemon/test/projects-lifecycle.test.ts`、`packages/daemon/test/memory-growth.test.ts`、`packages/contracts/test/knowledge-privacy.test.ts`。e2e `console.spec.ts` 的 psettings 探针可加三态，但正式路径断言以 `ProjectSettings.test.tsx` + `App.tsx` 路由为准。

`memory/negation.ts` 生产未接线，本批不改。禁止改 `packages/daemon/src/net/**`、DDL、Gate 0/S3/trust 枚举/blocked 原因、通知中心。

implementation 开始前把本 exact-set 抄入该阶段 `implementation-scope.json`。缺文件可在该白名单声明后创建，不得越出本表。

## 7. 真实 gates

contract（已开批核准，不是产品 CI）：

```text
bash docs/plan/ecc-as01-as02-privacy-contract/docs-gate.sh
```

内含：`bash scripts/check-emoji.sh`；`node scripts/check-doc-links.mjs`；`node scripts/check-public-tree-privacy.mjs --fs`；`node scripts/schedule-pointer.mjs --check`；`node scripts/schedule-pointer.mjs --self-test`；`git diff --check`；`pnpm --filter @saydo/contracts typecheck`；`pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts`；若存在则跑 `test/knowledge-privacy.test.ts`。

implementation focused（`FG-AS01AS02-PRIVACY`；与 PLAN-2 同 id 必须覆盖**同一 exact 测试集**，含 `projects-lifecycle.test.ts`（reanchor）与 `memory-growth.test.ts`（nomination）；`[new]` 文件建立后才能进 argv）：

```text
pnpm --filter @saydo/daemon exec vitest run test/memory.test.ts test/memory-foundation.test.ts test/credential-literals.test.ts test/git-protection.test.ts test/live-tools-remember-privacy.test.ts test/projects-lifecycle.test.ts test/memory-growth.test.ts
pnpm --filter @saydo/contracts typecheck
pnpm --filter @saydo/contracts exec vitest run test/schemas.test.ts test/knowledge-privacy.test.ts
pnpm --filter @saydo/console typecheck
pnpm --filter @saydo/console exec vitest run src/pages/ProjectSettings.test.tsx
```

implementation 完整门（语义 GREEN 后）：`just ci`；`pnpm exec playwright test`。这是本地 Node/Python 与浏览器基线，不外推托管 CI、真机、真实 provider 或发行物。未跑标 `not_run`。

## 8. 排除与已知漏检

排除：PG-01B net 范围；共享设置 UI；`knowledgeShare`；DDL；Gate 0/S3/trust/blocked 词表；通知中心；provider/runtime/安装器；AS-03..07。新增拒写事件只存 kind/digest，不宣称 PG-04 关闭。

已知漏检（不是「已证明无 secret」）：声明 grammar 外的新供应商 token；与真凭据同形的假 token。格式外不扩扫描。

## 9. 角色合同

```workflow-v2
{"policy_version":2,"policy_revision":"2.4.2","reviewers_per_candidate":1,"max_repair_rounds":3,"max_rereview_rounds":3,"max_semantic_children_per_parent":1,"second_red_action":"progress_gated_continue","full_gate_policy":"once_on_final_candidate_then_only_after_relevant_change","recursive_review_allowed":false,"p2_default_action":"record_and_defer_to_final_sweep","p2_immediate_fix_requires_owner":true,"max_final_p2_sweeps":1,"max_same_root_cause_repairs":2,"max_strategy_resets":1,"task_mode":"supervised_delivery","first_red_action":"auto_repair_once","rereview_context":"fresh_zero_context","full_gate_timing":"after_semantic_review_green","post_green_continue":"preaccepted_next_stage_only","reviewer_write_scope":"review_artifacts_only","review_manifest_validator_required":true}
```
