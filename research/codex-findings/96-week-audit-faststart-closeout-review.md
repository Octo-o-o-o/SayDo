# 结论

**No-Go。**

冻结历史数字本身可独立复现：

```text
base=8a8247a347238b6bf6ad649f1162f1934540eafd
main=115
allRefs=131
extra=16
paths=434
documents=219
markdown=154
nonMarkdown=65
```

5 个声明为公开快照的提交实际差异数为 `0/0/0/8/8`，后两组 8 项均只删除 `artifacts/release/copyright/`；另外 11 个额外提交确实与主线同树。

但发布候选不成立：

- 最终观测时 `HEAD=3fccf4a...`，工作树有 126 条 `git status --short` 输出。
- 账本记录 119 个非生成路径，当前为 124 个；新增未入账 5 个，另有 3 个已记录文件内容漂移。
- `week-audit --check` 与 `--check-bundle` 均退出 1。
- 当前 630 个构建输入摘要为 `650469db...`，tgz metadata 仍是 `4c97de65...`。
- tgz 内 `build-metadata.json`、`THIRD_PARTY_NOTICES.md`、`runtime/daemon.mjs` 已与当前 package 树不同。
- 另有 4 个独立 A 级运行时/发布链缺陷：缺包批准 fail-open、settle 非原子、无证据仍可标 pass、发布脚本可发布旧 HEAD。

审查期间共享工作树持续变化；以下结论对应最后一次实际读取，任何后续修改都必须重跑。

## 首轮报告逐条裁决

| 原项 | 裁决 | 实际证据、影响与最小修复 |
|---|---|---|
| A-1 工作树游离台账 | `CONFIRMED_FIXED` | [week-audit.mjs:52](/Users/wangyixiao/WorkSpace/SayDo/scripts/week-audit.mjs:52)、[week-audit.mjs:155](/Users/wangyixiao/WorkSpace/SayDo/scripts/week-audit.mjs:155)、[week-audit.mjs:180](/Users/wangyixiao/WorkSpace/SayDo/scripts/week-audit.mjs:180) 已记录内容指纹、检测新增路径；本次确实把漂移打红，旧假绿已消失。当前候选仍红，须稳定工作树后重新冻结，见新 A-1。 |
| A-2 过期 daemon 假绿 | `CONFIRMED_FIXED` | [build-release-artifacts.mjs:50](/Users/wangyixiao/WorkSpace/SayDo/scripts/build-release-artifacts.mjs:50) 重建源码，[同文件:69](/Users/wangyixiao/WorkSpace/SayDo/scripts/build-release-artifacts.mjs:69) 逐成员比较，[同文件:149](/Users/wangyixiao/WorkSpace/SayDo/scripts/build-release-artifacts.mjs:149) 核对构建身份。只读约束下未执行这个会重建 dist 的命令；独立内存比较已证明当前包会被拒绝。现有包仍陈旧，见新 A-2。 |
| A-3 由终态伪造全绿 | `CONFIRMED_FIXED` | [task.ts:76](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/task.ts:76) 承载显式 checks；API 默认 unknown 且只接受 exact coverage，[console.ts:223](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:223)；UI 对缺失/重复均返回 unknown，[TaskDetail.tsx:29](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/pages/TaskDetail.tsx:29)。不再消费 task 终态。但 evidenceRef 可缺仍标 pass，见新 A-5。 |
| B-1 字符串宣告 snapshot/reviewed | `STILL_BROKEN` | snapshot 部分已修：[week-audit.mjs:278](/Users/wangyixiao/WorkSpace/SayDo/scripts/week-audit.mjs:278) 真正验证同树或允许删除集。语义部分仍只能检查非空字符串和路径存在，[week-audit.mjs:400](/Users/wangyixiao/WorkSpace/SayDo/scripts/week-audit.mjs:400)。115 条提交仅 13 种 rationale，219 份文档仅 9 种；例如 R11 表及多张互不相同截图复用同一大包实现/测试引用和同一句理由，[semantic-review.json:3035](/Users/wangyixiao/WorkSpace/SayDo/research/week-audit/2026-08-22-semantic-review.json:3035)、[同文件:3086](/Users/wangyixiao/WorkSpace/SayDo/research/week-audit/2026-08-22-semantic-review.json:3086)。影响是“逐项人工裁决”仍不可由这些字段实证。最小修复是每项写具体被核对的主张、相关行锚和裁决理由，禁止把同提交全部路径批量复制为语义证据。 |
| B-2 分发 verifier 绕过真实入口 | `CONFIRMED_FIXED` | Windows 本地 verifier 经 `cmd.exe` 执行真实 `saydo.cmd`，[verify-distribution.mjs:155](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/scripts/verify-distribution.mjs:155)。URL verifier 使用空 prefix/cache/home，执行 global/exec 两入口，并检查 health、console、status、优雅停止和 daemon 孤儿，[verify-release-url.mjs:21](/Users/wangyixiao/WorkSpace/SayDo/scripts/verify-release-url.mjs:21)、[同文件:94](/Users/wangyixiao/WorkSpace/SayDo/scripts/verify-release-url.mjs:94)、[同文件:167](/Users/wangyixiao/WorkSpace/SayDo/scripts/verify-release-url.mjs:167)。静态缺口已修；真实三系统运行仍是发布外部条件。 |
| B-3 官网口径漂移 | `STILL_BROKEN` | Cursor 稳定、Claude 收口中、Codex 拒起的矩阵已对齐，[Docs 源稿:423](/Users/wangyixiao/WorkSpace/SayDo/docs/site/2026-08-20-docs-page-content.fable.md:423)、[validateConfig.ts:197](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/validateConfig.ts:197)。但 FAQ 仍宣称 `agent` 必须是 Cursor，[源稿:786](/Users/wangyixiao/WorkSpace/SayDo/docs/site/2026-08-20-docs-page-content.fable.md:786)、[英文页:921](/Users/wangyixiao/WorkSpace/SayDo/deploy/saydo-octoooo-com/en/docs/index.html:921)；README 又把未取得发布证据的 rc.2 写成“当前预发布包”，[README.md:18](/Users/wangyixiao/WorkSpace/SayDo/README.md:18)。影响是错误排障及潜在 404。须按 adapter 分支写 FAQ，并在发布后 smoke 绿前保持“待发布”。 |
| B-4 fresh-origin 绕过 | `CONFIRMED_FIXED` | [global-setup.ts:59](/Users/wangyixiao/WorkSpace/SayDo/e2e/console/global-setup.ts:59) 使用独立 fresh HOME/daemon；[console.spec.ts:338](/Users/wangyixiao/WorkSpace/SayDo/e2e/console/console.spec.ts:338) 真点击 `peek-anyway`、核验 localStorage 并 reload。因会构建及写测试目录，本轮未执行 Playwright；仍须进入发布门。 |
| B-5 Claude 临时身份并发冲突 | `CONFIRMED_FIXED` | 共享剥离环境在 [agentEnv.ts:1](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/agentEnv.ts:1)；按 identity path 串行在 [selfTest.ts:35](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/selfTest.ts:35)；唯一 PID+UUID 临时文件在 [claudeIdentity.ts:45](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/claudeIdentity.ts:45)；realpath 身份核验在 [同文件:79](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/claudeIdentity.ts:79)；唯一首 init、唯一末 result、同 session、零工具和精确 OK 在 [selfTest.ts:470](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/selfTest.ts:470)。 |
| C-1 链接门过窄 | `STILL_BROKEN` | Markdown 引用式链接和 HTML `href/src` 已覆盖，[check-doc-links.mjs:67](/Users/wangyixiao/WorkSpace/SayDo/scripts/check-doc-links.mjs:67)。但资产过滤只纳入 `deploy/saydo-octoooo-com`，[同文件:19](/Users/wangyixiao/WorkSpace/SayDo/scripts/check-doc-links.mjs:19)，遗漏 `deploy/link-saydo-octoooo-com/index.html`，且 CI 未调用该门。最小修复是显式列出两个 Pages root，并接入 CI/release。 |

没有旧项判为 `REGRESSED`。

## 新发现

### A-1 当前冻结账本为红态

- 位置：[week-audit.mjs:52](/Users/wangyixiao/WorkSpace/SayDo/scripts/week-audit.mjs:52)、[week-audit.mjs:180](/Users/wangyixiao/WorkSpace/SayDo/scripts/week-audit.mjs:180)、[bundle-integrity.json:31](/Users/wangyixiao/WorkSpace/SayDo/research/week-audit/2026-08-22-bundle-integrity.json:31)。
- 证据：记录 119 个路径，当前非生成 dirty 路径 124；未入账为 `HANDOFF.md`、`api/setup.ts`、`cliCapability.ts`、`executable.ts`、`executable.test.ts`，另有 `release.yml`、两个 distribution verifier 内容漂移。两个审计命令均因 `release.yml` 漂移退出 1。
- 影响：当前实现、账本与最终报告不是同一冻结候选。
- 最小修复：停止所有写入者，确认唯一 HEAD/分支和 clean index，重新生成四份账本输出；随后在不再修改任何输入的情况下复跑两个模式。

### A-2 现有 rc.2 tgz 不是当前源码构建

- 位置：[release-metadata.json:11](/Users/wangyixiao/WorkSpace/SayDo/artifacts/release/github/v0.1.0-rc.2/release-metadata.json:11)、[build-release-artifacts.mjs:149](/Users/wangyixiao/WorkSpace/SayDo/scripts/build-release-artifacts.mjs:149)。
- 证据：当前 630 输入摘要 `650469db99f3...`，metadata 为 `4c97de6590e8...`；tar 中 3 个成员与当前 package 树不同。tgz SHA `b23f6787...` 与 metadata 自洽，只能证明旧包没被改。
- 影响：上传会交付未包含当前修复的 daemon/notices。
- 最小修复：全部代码和通知文件冻结后重新构建 tgz、SHA256SUMS、metadata，再做逐成员及源码摘要复核；不得沿用当前 tgz。

### A-3 coding approve 在 DecisionPackage 缯失时 fail-open

- 位置：[operations.ts:283](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:283)、[operations.ts:423](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:423)、[ddl.ts:112](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/storage/ddl.ts:112)、[tier1-operations.test.ts:78](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/test/tier1-operations.test.ts:78)。
- 证据：coding approve 只校验 task/run/proof；writing 才读取包。现有测试根本不插包。当前源码加内存 SQLite 实测：

```json
{"packageCount":{"c":0},"result":{"state":"review_approved_waiting_merge"},"task":{"status":"review_approved_waiting_merge"}}
```

- 影响：缺失、损坏或漂移的包仍可打开合并链，验收标准失去权威锚点。
- 最小修复：在同一 approve 事务中按 task 的 package 三元组读取并严格解析包，核对 digest/project/revision 和 acceptance exact-set；缺失或畸形一律拒绝。

### A-4 settle 非原子，合法重启可能重复执行

- 位置：[executor.ts:2282](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:2282)、[executor.ts:2347](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:2347)、[executor.ts:2512](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:2512)、[executor.ts:1097](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1097)、[tasks.ts:231](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:231)。
- 证据：run、task、outbox、audit 分别提交；recover 只读取 active run。构造“run 已 settled、task 仍 running”崩溃窗，当前 claim 谓词实测：

```json
{"crashWindow":{"task":"running","run":"settled_review"},"claimCandidate":{"id":"tsk_01AAAAAAAAAAAAAAAAAAAAAAAA"},"nextAttempt":2}
```

- 影响：重启后重复调用 agent，可能重复外部副作用，并分叉 proof/callback。
- 最小修复：run terminal proof、task transition、durable outbox 同一 DB 事务提交；启动时显式收敛 terminal-run/running-task，增加每个提交边界的 crash-injection 测试。

### A-5 缺 evidenceRef 仍能标记 pass

- 位置：[tools.ts:42](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/tools.ts:42)、[console.ts:237](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:237)、[TaskDetail.tsx:29](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/pages/TaskDetail.tsx:29)、[canonical:1436](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1436)。
- 证据：当前 schema 动态解析结果：

```json
{"passWithoutEvidence":true}
```

API exact-set 后直接返回该 status，UI 也只读 status，因此 `{status:"pass",source:"verify"}` 无证据仍显示通过。
- 影响：违反“缺证据恒 unknown”，可重新制造伪绿验收。
- 最小修复：schema 要求任何 `pass/fail` 都绑定非空、可验证的 evidenceRef；解析 legacy/畸形 proof 时降为 unknown，approve 再核对 evidence 的存在性和归属。

### A-6 发布脚本没有绑定已审候选和完整门禁

- 位置：[publish-public-snapshot.sh:12](/Users/wangyixiao/WorkSpace/SayDo/scripts/publish-public-snapshot.sh:12)、[同文件:38](/Users/wangyixiao/WorkSpace/SayDo/scripts/publish-public-snapshot.sh:38)、[同文件:50](/Users/wangyixiao/WorkSpace/SayDo/scripts/publish-public-snapshot.sh:50)、[release.yml:29](/Users/wangyixiao/WorkSpace/SayDo/.github/workflows/release.yml:29)、[ci.yml:21](/Users/wangyixiao/WorkSpace/SayDo/.github/workflows/ci.yml:21)。
- 证据：脚本只从 `HEAD` 构树，无 clean、branch、expected SHA 守卫，并允许任意 remote。当前 HEAD 仍是旧 `3fccf4a`，且 `release.yml`、三个发布脚本、week-audit 都不在 HEAD；现在执行会忽略全部未提交修复。release workflow 也不等待独立 main CI，未运行 week-audit、链接门或 fresh-origin Playwright。
- 影响：可围绕错误旧树或错误仓库产生“发布成功”；普通 CI 红时 tag workflow 仍可能创建 Release。
- 最小修复：强制 clean、完整 expected internal SHA、正确分支/upstream、remote URL 精确等于公开仓；从明确 SHA 构树。release 使用共享完整门禁或等待该 SHA 的 required checks 全绿后才能 publish。

### B-1 bundle 无法在缺私有 objects 时证明冻结全集真实性

- 位置：[week-audit.mjs:68](/Users/wangyixiao/WorkSpace/SayDo/scripts/week-audit.mjs:68)、[week-audit.mjs:237](/Users/wangyixiao/WorkSpace/SayDo/scripts/week-audit.mjs:237)、[bundle-integrity.json:26](/Users/wangyixiao/WorkSpace/SayDo/research/week-audit/2026-08-22-bundle-integrity.json:26)。
- 证据：`--check-bundle` 不访问私有 Git objects，能验证三份文件摘要、记录的 dirty 内容及 115/219 键集合；但不验证 16 个 extra 的真实关系、完整 public tree、clean 基线或外部信任锚。完整模式又以当前可变 `git log --all` 求 131，没有冻结 `refname → tip SHA`；16 个额外提交依赖 public refs 才可达。
- 影响：fresh archive clone 缺 public refs时无法重建 131；公开侧只能证明 bundle 自洽，不能独立证明历史事实。
- 最小修复：冻结 ref-tip manifest并保留审计 refs/Git bundle；记录 internal tree、过滤规则导出的完整 public tree manifest，并以签名或发布 SHA 作外部信任锚；公开 CI 对 HEAD 精确核验。

### B-2 artifact 可复现性与线上字节身份未闭合

- 位置：[build-release-artifacts.mjs:88](/Users/wangyixiao/WorkSpace/SayDo/scripts/build-release-artifacts.mjs:88)、[release.yml:68](/Users/wangyixiao/WorkSpace/SayDo/.github/workflows/release.yml:68)、[verify-release-url.mjs:94](/Users/wangyixiao/WorkSpace/SayDo/scripts/verify-release-url.mjs:94)。
- 证据：checker 明确跳过 tar 内 `package.json`；workflow 只构建一次；URL verifier 直接安装 URL，不下载并核对线上 SHA256SUMS/metadata。
- 影响：manifest 漂移、非确定性打包或线上资产替换，仍可能通过功能 smoke。
- 最小修复：比较 manifest；两个隔离环境独立构建并比较 tgz SHA；URL verifier 安装前下载 tgz、checksum、metadata，核对版本、大小、SHA 和 sourceRevision。

### B-3 third-party notices 漏实际许可证正文

- 位置：[third-party-notices.mjs:70](/Users/wangyixiao/WorkSpace/SayDo/scripts/third-party-notices.mjs:70)、[THIRD_PARTY_NOTICES.md:883](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/THIRD_PARTY_NOTICES.md:883)。
- 证据：正则只识别 `LICENSE` 后跟点号，漏掉真实存在的 `emoji-regex/LICENSE-MIT.txt`；生成文档却称“no standalone license text”。`--check` 仍退出 0。
- 影响：分发依赖的法律通知不完整。
- 最小修复：覆盖 `LICENSE-*`、`LICENCE-*` 等常见命名，并在包内存在候选文件而输出“无正文”时失败。

### B-4 文案领先发布事实且 Claude FAQ 自相矛盾

- 位置：[README.md:18](/Users/wangyixiao/WorkSpace/SayDo/README.md:18)、[中文首页:379](/Users/wangyixiao/WorkSpace/SayDo/deploy/saydo-octoooo-com/index.html:379)、[中文首页:383](/Users/wangyixiao/WorkSpace/SayDo/deploy/saydo-octoooo-com/index.html:383)、[Docs 源稿:786](/Users/wangyixiao/WorkSpace/SayDo/docs/site/2026-08-20-docs-page-content.fable.md:786)。
- 证据：本地只有 `v0.1.0-rc.1` 标签；外部 URL因网络限制未取得可达证据，不能据此断言远端不存在。但本候选已将 rc.2 写为“当前/现在可用”，同时 FAQ 仍排除已经接线的 Claude。
- 影响：Release 失败后 public main/Pages 可永久保留死链接；Claude 用户被错误引导。
- 最小修复：发布前统一为“rc.2 待发布”；post-release 三系统 smoke 绿后再推 availability 文案和部署 Pages；FAQ 分 Cursor/Claude 两条处方并明确 Codex 拒起。

其余口径已对齐：Windows/Linux 只承诺前台运行，不承诺常驻/系统通知；移动端明确未上架；认证措辞已平台中立；npm registry 和移动商店不在 workflow 中。

### B-5 Tier1 proof 判别键与 canonical 相反

- 位置：[canonical:951](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:951)、[task.ts:76](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/types/task.ts:76)、[executor.ts:2092](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:2092)。
- 证据：

```json
{"tier1WithoutKind":true,"tier1CanonicalWithKind":false}
```

- 影响：严格 schema 拒绝 canonical 数据，判别联合和跨版本 round-trip 会漂移。
- 最小修复：新 proof 写 `kind:"tier1"`；旧无 kind 数据仅经明确 legacy normalization 接受。

### B-6 链接、fresh-origin 和部署顺序仍可假绿

- 位置：[check-doc-links.mjs:19](/Users/wangyixiao/WorkSpace/SayDo/scripts/check-doc-links.mjs:19)、[ci.yml:21](/Users/wangyixiao/WorkSpace/SayDo/.github/workflows/ci.yml:21)、[release.yml:87](/Users/wangyixiao/WorkSpace/SayDo/.github/workflows/release.yml:87)、[发布计划:104](/Users/wangyixiao/WorkSpace/SayDo/docs/plan/2026-08-22-week-audit-faststart-release.fable.md:104)。
- 证据：链接门虽检查 95 个文件并退出 0，但漏第二 Pages 项目；fresh-origin 测试存在却不在 CI/release；计划只写推 public/main、等 Actions、部署 Pages，没有把“main+tag 原子推送 → published-smoke 全绿 → Pages”写成机械前置。
- 影响：首启或链接回归可随 Release 发布；官网可在固定 URL 生效前部署。
- 最小修复：两站链接门与定向 Playwright进入 pre-publish required checks；唯一顺序固定为 clean internal SHA → public main+tag → 全部 release smoke 绿 → 两个 Pages 部署 → 生产 URL/摘要复核。

### C-1 terminal action 和 AcceptanceCheck 类型仍未完全单源

- 位置：[tier1Presentation.ts:1](/Users/wangyixiao/WorkSpace/SayDo/packages/contracts/src/tier1Presentation.ts:1)、[console.ts:167](/Users/wangyixiao/WorkSpace/SayDo/packages/daemon/src/api/console.ts:167)、[TaskDetail.tsx:22](/Users/wangyixiao/WorkSpace/SayDo/packages/console/src/pages/TaskDetail.tsx:22)。
- 证据：用户可见 blocked reason mapper 已被共享，未知原因返回 null，未发现直接泄露原始错误；但 terminal audit action union 和 UI AcceptanceCheck 仍在消费者本地重定义。
- 影响：后续新增终态或字段时可能出现 screen/spoken/callback 漂移。
- 最小修复：contracts 导出 terminal action schema/type，UI 直接消费 `AcceptanceCheck`。

### C-2 canonical 少列一个 native external

- 位置：[canonical:1642](/Users/wangyixiao/WorkSpace/SayDo/docs/09-data-contracts.md:1642)、[build.mjs:125](/Users/wangyixiao/WorkSpace/SayDo/packages/cli/scripts/build.mjs:125)。
- 证据：canonical 称只 externalize `better-sqlite3`；实际 daemon 同时 externalize `koffi`，CLI/platform 也如此。
- 影响：分发闭包和跨平台 native 验收描述不准确。
- 最小修复：将 `koffi` 纳入 canonical 的 native external、许可证及三平台验收范围。

## 实际门禁

| 命令 | 结果 |
|---|---|
| 独立 Git/Node 冻结集合复算 | exit 0；115/131/16/434/219/154/65 精确成立 |
| `node scripts/week-audit.mjs --check` | exit 1；`release.yml` 内容漂移 |
| `node scripts/week-audit.mjs --check-bundle` | exit 1；同一漂移 |
| `pnpm typecheck` | exit 0；6 个项目 |
| `pnpm lint` | exit 0 |
| `node scripts/third-party-notices.mjs --check` | exit 0；存在上述许可证假绿 |
| `node scripts/check-doc-links.mjs` | exit 0；95 files、0 broken，存在覆盖缺口 |
| `bash scripts/check-emoji.sh` | exit 0 |
| `git diff --check` | exit 0 |
| 四个 Node 脚本 `node --check`、发布脚本 `bash -n` | 全部 exit 0 |
| tgz 定向秘密/私有归档路径扫描 | 未命中；17 个成员仅 package 文档和 dist |

因严格只读，本轮没有运行会创建临时目录或重建产物的 Vitest、Playwright、`just ci`、distribution verifier、`build-release-artifacts --check`。这些结果是“未验证”，不是失败或通过。

GitHub rc.2、固定下载 URL、公开 Actions 和生产 Pages 的外部读取均未成功，因此没有把不可达误判成“不存在”。发布放行至少还需：修完全部 A 项、冻结 clean SHA、双审计门绿色、重建 tgz/notices、完整 CI 与 fresh-origin、三系统发布前后真实入口绿色，再按 public snapshot+tag、published smoke、Pages 的顺序执行。