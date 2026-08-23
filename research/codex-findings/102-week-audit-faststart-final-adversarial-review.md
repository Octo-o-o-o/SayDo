No-Go

[A] 失败终态不是事务原子提交，可形成永久半状态。

位置：`packages/daemon/src/tier1/executor.ts:2358-2424`、`packages/daemon/src/tier1/executor.ts:1239-1248`、`packages/daemon/src/callback/engine.ts:111-130`、`packages/daemon/src/storage/dao/tasks.ts:81-85`、`docs/09-data-contracts.md:670,1301`。

触发条件：`finalizeFailure()` 中 run 转态、task 转态、失败回叫入队或终态审计任一发生 SQLite 非唯一约束错误、磁盘错误或审计 sink 异常。

影响：失败路径依次独立写 run、task、outbox、audit，且 run 转态异常还会被吞掉。若 outbox 写失败，首次调用已经把 run/task 提交为 `settled_failed/failed`；外层 catch 再次调用时，`failed → failed` 被状态机拒绝并提前返回，最终可能缺回叫和 `tier1.failed` 审计。若终态审计失败，则可能已有失败回叫但永久缺终态审计；若 run 转态失败，则可能出现 running run 配 terminal task/outbox/audit。

实际证据：成功 settle 在 `executor.ts:2308-2337` 有单事务，失败 settle 没有。现有注入测试 `packages/daemon/test/tier1-executor.test.ts:417-477` 只验证“成功 settle 写失败后，正常失败收口”，没有在失败收口自身的 run/task/outbox/audit 各点注入故障。

最小修复：将失败 run 转态、task CAS、失败/阻塞 outbox 和 canonical 终态审计放进同一 SQLite 事务；重放时按完整四元组收敛，而不是再次执行非法同态转移。为四个写点分别加故障注入，断言全回滚或四项全在，且无双叫。

[A] 当前实际 Review 页面仍会用任务终态伪造逐条 AcceptanceCheck，并破坏 writing criterion。

位置：`packages/contracts/src/types/package.ts:46`、`packages/daemon/src/api/console.ts:225-245`、`packages/console/src/hooks/redesign/mappers.ts:414-424,480-507`、`packages/console/src/pages/redesign/ReviewPageRoute.tsx:28-29`、`packages/console/src/App.tsx:86`、`docs/09-data-contracts.md:1448`、`docs/11-ui-spec.md:350-354`。

触发条件：打开任一 coding `ready_for_review`/`failed` 任务，或打开任一 writing 验收任务。

影响：

- mapper 的载荷类型和逻辑完全忽略 daemon 已返回的 `acceptanceChecks`，没有 proof 行时直接把 `ready_for_review` 批量投影为 pass、`failed` 批量投影为 fail；这正是 canonical 明文禁止的“终态代替逐条证据”。
- `DecisionPackage.acceptance` 实际是 `string[]`，mapper 却按对象读取 `a.text/a.criterion`，回退到 `JSON.stringify(a)`，把 `条目` 变成带引号的 `"条目"`。writing proof 因 criterion 对不上而被忽略，UI 显示伪 pass；批准时又把带引号 criterion 发送给 daemon，服务端会按幽灵 criterion 拒绝。

实际证据：`mappers.ts:501-505` 明确包含 `else if (settled) statusAc = "pass"`；生产路由确实使用该 mapper，不是闲置 fixture。

最小修复：在 `TaskDetailPayload` 中加入并消费 daemon 的 `acceptanceChecks`；对 `string[]` 做原值映射；pass/fail 必须同时具备匹配 criterion、合法 source 和非空 `evidenceRef`，否则 unknown；删除所有由 task 状态推导 AC 的分支，并补 coding/manual/missing-evidence/writing approve 端到端测试。

[A] coding/writing approve 没有在批准事务内重新读取 DecisionPackage；writing barrier ①也完全没有重验。

位置：`packages/daemon/src/tier1/operations.ts:273-365,418-496`、`docs/09-data-contracts.md:594,1415-1423,1448`。

触发条件：settle 后、owner approve 前，成稿文件或 artifact 行发生漂移/删除，或另一连接在包读取与 task CAS 之间改变 task 的 package 绑定。

影响：`packageBodyForReview()` 在事务开始前执行；writing 批准只核对旧 proof、旧 package body 和人工 exact-set，没有重新读取 article artifact、当前 worktree 字节/digest 或 tree membership。系统因此能批准不再满足 canonical ①②③的旧证据。coding 分支同样在事务外读取 package，事务内只 CAS task 状态。

实际证据：writing 的事务到 `operations.ts:461` 才开始，而 proof/package/manual 校验在 `431-459`；函数没有 ArtifactStore、worktree 或 article path 输入。canonical 明确要求 approve 事务内断言 barrier ①②③仍成立。

最小修复：批准时持有 worktree 排他锁，重验当前文件 digest/tree membership；在同一 DB 事务内重新读取并 CAS task/run/package/artifact 的 project、revision、digest、version 和 criterion exact-set，再写审计、冻结 outbox、转态。补文件漂移、artifact 删除、package 竞态三类反例。

[A] 公开快照会主动发布隐私探针字面量，且探针执行错误会被当成“未命中”。

位置：`scripts/publish-public-snapshot.sh:66-101`、`research/week-audit/2026-08-23-publication-manifest.json:9215-9219`。

触发条件：执行公开快照发布。

影响：脚本包含多组明确标注为私有账号、订单、通知邮箱及第三方实名的探针字面量。`exclude_pathspec` 只让 grep 不扫描该脚本，但公开树裁剪仅删除 `artifacts/release/copyright`，因此脚本及这些字面量本身会进入公开仓。另有 `git grep ... 2>/dev/null` 放在 `if` 中，退出码 2/128 等执行错误与“无命中”走同一分支，发布继续。

实际证据：冻结提交的 `git ls-tree` 含该脚本；publication manifest 也登记其 mode、bytes、SHA-256，证明预期公开 exact-set 包含它。

最小修复：把具体探针放到私有配置/CI secret 管理的文件中，公开脚本只保留通用规则；对最终 staged public tree 执行扫描，并显式区分 grep 退出码 0、1和其他错误，其他错误必须中止。publication manifest 不得再包含任何具体私有探针值。

[A] immutable release 的失败处置仍是 fail-open。

位置：`.github/workflows/release.yml:156-224,250-277`、`docs/plan/2026-08-22-week-audit-faststart-release.fable.md:78-84,117-126`。

触发条件：release 已发布但 immutable 查询失败/超时，或 fixed-URL smoke 失败后 `gh release edit` 因权限、API 或网络问题失败；也包括 publish 命令远端已生效但本地返回失败的模糊终态。

影响：workflow 先以正常标题/正文公开 release，再尝试加 `UNAVAILABLE`。一旦修改失败，release 仍以正常可用外观公开。`mark-failed-release` 又要求 `needs.publish.result == 'success'`，不会处理 publish job 在公开后失败的情况；smoke 失败分支也没有修改后的回读确认。已有已发布 release 的拒绝替换逻辑本身正确，缺口集中在“已经公开后的失败”。

GitHub 的 immutable release 会锁定 tag 与 assets，但标题和正文仍可编辑，因此“标记 unavailable”技术上可行；问题是当前流程把安全状态依赖于一次可能失败且未复核的后置编辑。[GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)、[Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)。

最小修复：首次 publish 就使用 `UNAVAILABLE / PENDING SMOKE` 标题和正文；immutable 与六项 smoke 全绿后，再改为 available 并回读验证。这样任何查询或编辑失败都保持安全默认状态；`always()` 收尾同时覆盖 publish 的模糊失败。

[A] Windows writing 的不可信 `article_path` 可越出 worktree并先被 daemon 读取。

位置：`packages/daemon/src/tier1/projectConfig.ts:5-8,31-32,75-77`、`packages/daemon/src/tier1/executor.ts:2152-2184`。

触发条件：Windows 仓库在 `.saydo/project.toml` 中设置 `article_path="..\\..\\secret.md"`。

影响：消毒逻辑只按 `/` 拆分，反斜杠 `..` 原样保留；`join(worktree, articlePath)` 可解析到工作树外。daemon 在执行 git tree membership 前先 `existsSync/readFileSync`，所以即使随后拒绝 settle，越界读取已经发生，并形成文件存在/空值 oracle。

实际证据：使用同一消毒算法和 `path.win32`，输入 `..\..\secret.md` 得到 `C:\secret.md`，命令退出 0。

最小修复：拒绝绝对路径、盘符、UNC、空段及两种分隔符下的任何 `..`；用平台路径解析后通过 `relative()` 断言目标位于 worktree 内；先验证规范化 git tree path，再读取文件。补 `path.win32` 穿越、盘符和 UNC 测试。

[A] 发布入口允许推送与当前 release workflow 不匹配的合法 rc tag。

位置：`scripts/publish-public-snapshot.sh:47-55,109-114`、`.github/workflows/release.yml:3-6`、`scripts/post-release-gate.mjs:16-20`。

触发条件：操作时误传例如另一个格式合法的 rc tag。

影响：发布脚本只校验通用 rc 正则，会把错误 tag 与 public/main 原子推送；workflow 和 post-release gate 却只接受 `v0.1.0-rc.2`，因此错误 tag 不触发构建、Release、smoke 或 unavailable 处置，留下意外公开 tag。

最小修复：发布脚本从 `packages/cli/package.json` 推导唯一预期 tag并要求精确相等，同时机械确认 workflow 触发器覆盖该 tag；或将 workflow 改为统一 rc 模式并在首个 job 中严格对账 package version。

[B] Windows `.cmd/.bat` 解析被宣称支持，但 Tier 1 Claude 实际必然无法启动。

位置：`packages/daemon/src/config/executable.ts:16-27`、`packages/daemon/src/runtimeChildRegistry.ts:148-160`、`packages/daemon/src/tier1/backends/claude.ts:52-85`、`packages/daemon/src/tier1/executor.ts:1661-1695`、`packages/daemon/test/executable.test.ts:16-31`。

触发条件：Windows 上配置 npm 常见的 `claude.cmd`/`.bat` shim。

影响：resolver 会发现 `.CMD/.BAT`，但 wrapper 对 shell 参数中的引号、括号或换行直接退出 126。Claude argv 必含带引号的 settings JSON，prompt 也固定为多行，所以这不是边缘输入，而是确定失败。现有测试只证明能找到 `.cmd` 和元字符会被拒，没有真实代表性 spawn。

最小修复：解析 npm shim 指向的 JS 文件并用 `node.exe` 直接执行，或采用不经 shell argv 传递 prompt/settings 的 stdin/临时文件协议；增加真实 Windows `.cmd`、含空格路径和多行 prompt 测试。Windows 实机执行在本会话未验证。

[B] 账本仍含机械生成的“reviewed”状态，报告标题继续把机械覆盖称为“逐项裁决”。

位置：`scripts/week-audit.mjs:695-713`、`docs/plan/2026-08-22-week-audit-faststart-release.fable.md:38-46`、`docs/review/2026-08-23-week-audit-faststart-release.md:27-30,53-55,103-105`、`research/week-audit/2026-08-23-review-finding-anchor.json:5-13`。

触发条件：机器或读者以 ledger `status` 或章节标题判断人工评审覆盖。

影响：17份文档仅因“无实现/测试且不是 archive 类”被机械标为 `document_only_reviewed`；报告又称115个提交和219份文档“逐项裁决”。尽管正文明确声明空 finding 不等于判绿，这两个结构化/标题信号仍制造了人工完成感。当前 anchor 实际有92个 commit和209份文档的 finding 链为空。

实际证据：`week-audit --check` 确实逐一反查 blob、bytes、内容 SHA-256和真实 diff hunk，机械身份门不是伪造；问题仅在它给机械结果命名为人工 reviewed/裁决。

最小修复：将状态改为 `document_only` 或 `manual_review_not_recorded`；报告标题改为“机械覆盖”，人工裁决只列有独立 disposition/finding 记录的项。门禁禁止生成器产生 `reviewed/pass/ok` 等人工语义状态。

[B] writing 人工裁决的合同等价证据存在，但批准后没有投影回逐条 AcceptanceCheck。

位置：`packages/daemon/src/tier1/operations.ts:461-486`、`packages/daemon/src/api/console.ts:225-245`、`packages/console/src/pages/TaskDetail.tsx:155-170`、`docs/09-data-contracts.md:1415-1422`。

触发条件：owner 对 writing 全部 manual AC 判 pass并批准，随后刷新任务详情。

影响：`decided` 只是在批准事务内构造的临时数组；持久化审计只存 proof digest、attempt 和通过数量，API继续返回原 settle proof 的 unknown。UI因此在“已批准·待合并”状态下仍把这些 AC显示为“未验证”。这不是人工 verdict 数据丢失：canonical 已明确接受 proof digest、exact-set fail-closed和不可变审计的合取作为等价收据；缺口是消费者没有重建该证据投影。

最小修复：API仅在最新 `task.review_approve` 的 actor、proof digest、attempt、count和 exact-set全部匹配时，将 manual 项重建为 pass并绑定 `audit:<id>`；否则保持 unknown。若 owner不接受这种派生形态，再引入独立 WritingReviewReceipt。

[B] 发布 tar exact-set、许可证闭包及真实跨平台安装在本会话未验证。

位置：`scripts/build-release-artifacts.mjs:54-131,195-228`、`docs/review/2026-08-23-week-audit-faststart-release.md:190-199,204-213`。

触发条件：仅依据报告中的既往 `[ok]` 声明批准发布。

影响：源码中的 tar member exact-set、mode、内容、hash和 metadata 校验逻辑静态上存在，workflow也调用它；但当前冻结审阅环境没有 `node_modules`、`packages/cli/dist` 或 release tgz，独立 exact-set 命令在构建阶段失败。许可证闭包、daemon针对性测试、Mac/Windows/Linux固定URL安装、实际公开 bundle、GitHub Release和Pages因此均不能在本会话写成通过。

最小修复：在 clean clone/CI中安装冻结 lockfile，保留 source-bound tgz、三项 release assets、完整日志和三平台六项 smoke结果；提供真实 public snapshot后再跑 `--check-bundle` 与 post-release `--verify/--deploy`。

[C] 周审计报告的链接门计数已陈旧。

位置：`docs/review/2026-08-23-week-audit-faststart-release.md:43,145,189`。

触发条件：按当前工作树重跑链接门。

影响：报告写“96份活跃文档”，实际输出为 `files=95 broken=0`。链接没有断，但审计数字不可逐字复现。

最小修复：更新为实际计数，或删除易漂移的硬编码数量，只保留命令和机器输出证据。

## 实际执行的门禁与判定命令

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `git rev-parse HEAD` | 0 | `a15b5dea02dc7d8da438c86f5d3cdf89da8eeeda` |
| `git rev-parse 3fccf4a` | 0 | `3fccf4a704ad9a5d8e013baaefb67c66a5737cba` |
| `git diff --shortstat 3fccf4a..a15b5dea02dc7d8da438c86f5d3cdf89da8eeeda` | 0 | 104 files，8029 insertions，524 deletions |
| `node scripts/week-audit.mjs --check` | 0 | `main=115 all_refs=131 extra=16 paths=434 docs=219` |
| `node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.2` | 0 | 11个文案锚均为 candidate |
| `actionlint .github/workflows/ci.yml .github/workflows/release.yml` | 0 | 无静态错误输出 |
| `node scripts/check-doc-links.mjs` | 0 | `files=95 broken=0` |
| `git diff --check` | 0 | 无输出 |
| `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `bash -n scripts/publish-public-snapshot.sh` | 0 | shell语法通过 |
| `node scripts/build-release-artifacts.mjs --check` | 1 | 缺 `better-sqlite3`/`node_modules`；tar exact-set未验证 |
| `node scripts/week-audit.mjs --check-bundle` | 1 | 当前是内部树，仍含私有排除路径；真实公开bundle未验证 |
| `pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts test/writing-narrow.test.ts` | 254 | `vitest`不存在；针对性运行测试未验证 |
| `node scripts/third-party-notices.mjs --check` | 1 | 缺 `better-sqlite3`；许可证闭包未验证 |
| `npm pack --dry-run --ignore-scripts --json`（`packages/cli`） | 255 | 只读环境中的 npm cache `EPERM`；包内容未由此命令验证 |
| `test -f artifacts/release/github/v0.1.0-rc.2/saydo-cli-0.1.0-rc.2.tgz` | 1 | release tgz不存在 |
| `test -d packages/cli/dist` | 1 | CLI dist不存在 |
| `git ls-tree -r --name-only a15b5de -- scripts/publish-public-snapshot.sh` | 0 | 冻结树包含公开发布脚本 |
| publication manifest 对该脚本的 `jq -e` 查询 | 0 | manifest包含该文件，mode 493、bytes 5449 |
| `path.win32` article path与 `.cmd` 参数判定探针 | 0 | 路径解析到 `C:\secret.md`；代表性多行prompt被拒 |
| ledger/anchor finding与status计数 `jq` 查询 | 0 | `document_only_reviewed=17`；空 finding为 commit 92、document 209 |
| `git status --short --branch` | 0 | detached HEAD；仍为评审开始时已有的证据/截图修改与未跟踪审计文件 |
