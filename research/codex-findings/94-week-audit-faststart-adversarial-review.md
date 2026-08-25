# 最近一周双向审计、快速启动与发布收口对抗评审

## 结论

独立求得审计基线为 `8a8247a347238b6bf6ad649f1162f1934540eafd`，当前 `HEAD/main/origin/main` 均为 `3fccf4a704ad9a5d8e013baaefb67c66a5737cba`。

冻结提交范围内的台账可以机械重建，但它没有覆盖当前工作树；同时，待发布 tarball 含过期 daemon，任务详情页还会把没有逐条证据的验收标准显示为通过。共确认 3 项 A 级阻断、5 项 B 级缺陷、1 项 C 级改进。当前发布收口不成立。

## A 级发现

### A-1 当前工作树完全游离于审计台账之外

- 严重级别：A
- 位置：
  - `~/WorkSpace/SayDo/scripts/week-audit.mjs:8`
  - `~/WorkSpace/SayDo/scripts/week-audit.mjs:84`
  - `~/WorkSpace/SayDo/scripts/week-audit.mjs:91`
  - `~/WorkSpace/SayDo/scripts/week-audit.mjs:273`
  - `~/WorkSpace/SayDo/docs/review/2026-08-23-week-audit-faststart-release.md:9`
- 实际证据：

```text
$ git rev-list -1 --before='2026-08-15 00:00:00 +0800' main
8a8247a347238b6bf6ad649f1162f1934540eafd

$ node -e '<统计 git status --porcelain=v1 -z>'
worktree_rows=101 tracked=81 untracked=20

$ node scripts/week-audit.mjs --check
[ok] week audit ledger verified: main=115 all_refs=131 extra=16 paths=434 docs=219
```

生成器只读取硬编码的 `base..rangeEnd`、截至 `refsFrozenAt` 的 refs 和两个已生成文件，不读取 `git status`、暂存区、未暂存 diff 或未跟踪文件。机器账本中：

```text
scripts/week-audit.mjs=false
docs/review/2026-08-23-week-audit-faststart-release.md=false
packages/console/src/pages/TaskDetail.tsx=true
```

第三项仅表示该路径历史上出现过，不表示当前内容已入账。

- 影响：最终报告声称“全部进入可复现台账”，但审计生成器、最终报告及大量当前实现本身都不在审计内容中；任何当前工作树缺陷均可在门禁绿色时漏过。
- 最小修复：在账本中增加当前工作树清单，记录每个 staged、unstaged、untracked 路径及内容 digest；`--check` 必须在任一当前状态记录未入账或 digest 漂移时退出非零。随后从稳定快照重新生成报告。

### A-2 发布物校验对过期 daemon 假绿

- 严重级别：A
- 位置：
  - `~/WorkSpace/SayDo/scripts/build-release-artifacts.mjs:36`
  - `~/WorkSpace/SayDo/scripts/build-release-artifacts.mjs:50`
  - `~/WorkSpace/SayDo/scripts/build-release-artifacts.mjs:91`
- 实际证据：

```text
$ shasum -a 256 packages/cli/dist/runtime/daemon.mjs
2c461b229de6680cf98984f9f55ce5f4f34ba41dda2a11c14edc06330c982d74

$ tar -xOf artifacts/release/github/v0.1.0-rc.2/saydo-cli-0.1.0-rc.2.tgz \
    package/dist/runtime/daemon.mjs | shasum -a 256
cec6d2f85cbcfd8e4ea3922b99422fbe138cc8d86784d31dd7ed45585dc09d86

$ node scripts/build-release-artifacts.mjs --check
[ok] release artifact verified: saydo-cli-0.1.0-rc.2.tgz bytes=1119751 sha256=e1f8d5761406f546d01cc244692586ecd413fccf9a743564b74a974318c25d82
```

`--check` 只证明 tarball、SHA256SUMS 和 metadata 三者自洽；它不重建实现、不检查包内文件列表，也不把包内文件与当前构建产物比较。

- 影响：最终上传的 rc.2 可能运行未经本轮评审的旧 daemon，当前修复和安全变更不会随包交付。
- 最小修复：在所有代码变更收口后重新构建 tarball；让 `--check` 在隔离临时目录重建并逐文件比较 tar 内容，至少校验 `cli.mjs`、`runtime/daemon.mjs`、console 资产及构建身份。

### A-3 coding 任务的验收标准由任务状态伪造为全通过

- 严重级别：A
- 位置：
  - `~/WorkSpace/SayDo/packages/console/src/pages/TaskDetail.tsx:64`
  - `~/WorkSpace/SayDo/packages/console/src/pages/TaskDetail.tsx:143`
  - `~/WorkSpace/SayDo/packages/console/src/pages/TaskDetail.tsx:147`
  - `~/WorkSpace/SayDo/packages/daemon/src/api/console.ts:219`
  - `~/WorkSpace/SayDo/docs/09-data-contracts.md:1434`
  - `~/WorkSpace/SayDo/docs/11-ui-spec.md:352`
- 实际证据：

```typescript
const settled =
  status === "ready_for_review" ||
  status === "review_approved_waiting_merge";

const state: "pass" | "fail" | "unknown" =
  settled ? "pass" : String(task["status"]) === "failed" ? "fail" : "unknown";
```

Console API 仅返回 task、package、runs、approvals、costs、decisions 和 writingProof，没有 coding `AcceptanceCheck[]`。现有 `~/WorkSpace/SayDo/packages/console/src/pages/TaskDetail.test.tsx:1` 只测试错误码文案，没有验收证据真实性测试。

Canonical 明确规定每条 criterion 必须绑定 `pass/fail/unknown` 和证据，无法绑定时显示 `unknown`；`ready_for_review` 不等于逐项全绿。

- 影响：用户可能依据虚构的绿色验收项批准甚至合并代码，违反独立 acceptance oracle 合同。
- 最小修复：daemon 持久化并返回逐项 coding `AcceptanceCheck[]`；UI 仅消费显式 status，缺失项一律显示“未验证”。增加 settled 状态下混合 pass、fail、unknown 及无证据 criterion 的测试。

## B 级发现

### B-1 审计关系和“已评审”状态由字符串规则直接宣告

- 严重级别：B
- 位置：
  - `~/WorkSpace/SayDo/scripts/week-audit.mjs:116`
  - `~/WorkSpace/SayDo/scripts/week-audit.mjs:125`
  - `~/WorkSpace/SayDo/scripts/week-audit.mjs:153`
  - `~/WorkSpace/SayDo/scripts/week-audit.mjs:210`
- 实际证据：只要提交标题匹配 `from internal <sha>`，就直接标为 `public_snapshot`；非档案类纯文档也直接标为 `document_only_reviewed`，没有机械评审输入。

```text
f090078 internal=6365513 tree_equal=true
4f8dba1 internal=088b8f0 tree_equal=true
84af899 internal=11e3653 tree_equal=true
2bb9101 internal=6d98a6e tree_equal=false
57cc94b internal=3fccf4a tree_equal=false
```

后两对当前实际差异均为 8 个 `artifacts/release/copyright/` 文件被删除，没有发现隐藏实现；但生成器没有执行或验证这一差异。

- 影响：未来提交只需伪造标题即可被归为公开快照；纯文档也会在没有裁决记录时显示为已评审。
- 最小修复：快照必须验证同树，或验证一份显式允许的公开过滤 diff 及 digest；人工语义裁决应进入按 SHA/path 键控的受检文件，禁止由文件类型自动生成 `reviewed`。

### B-2 分发 verifier 没有执行文档承诺的安装入口

- 严重级别：B
- 位置：
  - `~/WorkSpace/SayDo/packages/cli/scripts/verify-distribution.mjs:118`
  - `~/WorkSpace/SayDo/packages/cli/scripts/verify-distribution.mjs:136`
  - `~/WorkSpace/SayDo/packages/cli/scripts/verify-distribution.mjs:142`
  - `~/WorkSpace/SayDo/packages/cli/scripts/verify-distribution.mjs:151`
  - `~/WorkSpace/SayDo/docs/plan/2026-08-22-week-audit-faststart-release.fable.md:76`
- 实际证据：verifier 测试本地 `npm pack` 后的前缀安装，不测试 GitHub 固定 URL，也不是 `npm install --global`。Windows 只检查 `saydo.cmd` 存在，实际运行时绕过 shim，直接调用 Node 加 `dist/cli.mjs`。本地标签命令退出 0，但仅返回：

```text
v0.1.0-rc.1
```

rc.2 远端 URL 因网络受限未验证，不能据此断言远端不存在。

- 影响：URL 下载、GitHub 重定向、npm cache、全局 bin、Windows `.cmd` 引号和路径问题均可在 verifier 绿色时失效。
- 最小修复：发布后在空 npm cache、空全局 prefix、空 `SAYDO_HOME` 下，从最终固定 URL 安装，并在三端执行真实 `saydo` 或 `saydo.cmd`，不得绕过 shim。

### B-3 中英文官网同时存在状态、环境和跨平台话术漂移

- 严重级别：B
- 位置：
  - `~/WorkSpace/SayDo/deploy/saydo-octoooo-com/docs/index.html:515`
  - `~/WorkSpace/SayDo/deploy/saydo-octoooo-com/docs/index.html:522`
  - `~/WorkSpace/SayDo/deploy/saydo-octoooo-com/docs/index.html:533`
  - `~/WorkSpace/SayDo/deploy/saydo-octoooo-com/docs/index.html:566`
  - `~/WorkSpace/SayDo/deploy/saydo-octoooo-com/docs/index.html:851`
  - `~/WorkSpace/SayDo/deploy/saydo-octoooo-com/en/docs/index.html:533`
  - `~/WorkSpace/SayDo/deploy/saydo-octoooo-com/en/docs/index.html:540`
  - `~/WorkSpace/SayDo/packages/daemon/src/tier1/validateConfig.ts:198`
  - `~/WorkSpace/SayDo/packages/daemon/src/tier1/agentEnv.ts:2`
  - `~/WorkSpace/SayDo/docs/11-ui-spec.md:347`
- 实际证据：
  - 同一中文页面先称“只有 cursor 有生产实现，其他配置会被拒”，稍后又称 Claude 的生产执行主流程已接线；实现 `tier1StartupVerdict()` 明确接受 `claude_code`。
  - 中英文页面称环境“只有十个变量”，实际 allowlist 有 23 个跨平台变量。
  - 中文和英文源稿及生成页仍大量使用 “Touch ID / passkey”“合并要 Touch ID”；canonical 要求平台中立的“用本机认证批准”，Windows 显示 Windows Hello。
  - 页面把固定 GitHub rc.2 包写成“现在可用”，但最终 URL、公开 Actions 和部署均尚未取得本次可复现证据。
- 影响：Claude 用户会得到互相冲突的配置说明；安全边界描述不准确；Windows 用户会误以为必须具备 Touch ID；发布状态领先于已验证事实。
- 最小修复：以 canonical 状态矩阵生成中英文源稿和页面；统一更新执行器、完整环境 allowlist、平台中立认证措辞。固定 URL 验证通过前，将包状态标为待发布或暂不部署该文案。

### B-4 Playwright 通过直接写 localStorage 绕过桌面首启逃生口

- 严重级别：B
- 位置：
  - `~/WorkSpace/SayDo/e2e/console/console.spec.ts:26`
  - `~/WorkSpace/SayDo/e2e/console/console.spec.ts:115`
  - `~/WorkSpace/SayDo/e2e/console/console.spec.ts:338`
  - `~/WorkSpace/SayDo/packages/console/src/components/SetupGate.tsx:381`
- 实际证据：

```text
e2e/console/console.spec.ts:29:
  localStorage.setItem("saydo.setup.peeked", "1")

e2e/console/console.spec.ts:374:
  localStorage.setItem("saydo.setup.peeked", "1")

e2e/console/console.spec.ts:394:
  localStorage.setItem("saydo.setup.peeked", "1")
```

产品按钮是 `[data-action="peek-anyway"]`，但 E2E 没有定位或点击该按钮。11 路由及 first-run 回放均在预写状态后测试；真正 fresh-origin 用例只覆盖远程移动端开场白。

- 影响：按钮点击、持久化或向导退出逻辑损坏时，现有 35/35 仍可能全绿。
- 最小修复：增加桌面 fresh-origin E2E：看到向导，点击 `peek-anyway`，进入正式页面，并在整页重载后验证选择仍生效。通用路由测试可继续使用 helper，但不能作为首启链证据。

### B-5 并发 Tier1 自检共享同一个临时身份文件名

- 严重级别：B
- 位置：
  - `~/WorkSpace/SayDo/packages/daemon/src/tier1/claudeIdentity.ts:44`
  - `~/WorkSpace/SayDo/packages/daemon/src/tier1/claudeIdentity.ts:48`
  - `~/WorkSpace/SayDo/packages/daemon/src/index.ts:1299`
- 实际证据：临时文件固定为 `${target}.tmp-${process.pid}`。同一 daemon 内并发的两个 setup self-test 使用相同 PID；HTTP 路径直接启动 `runSetupTest()`，没有按 `SAYDO_HOME` 串行化。现有 identity 测试没有并发用例。
- 影响：两个合法自检可能相互覆盖临时内容，导致其中一次 `renameSync` 报 `ENOENT`，或返回回执与最终登记文件不对应。
- 最小修复：临时文件加入随机唯一后缀，并按 identity target 对自检写入加互斥；补两个并发自检均有确定结果且最终文件可解析的测试。

## C 级发现

### C-1 活跃链接门禁覆盖范围和语法过窄

- 严重级别：C
- 位置：
  - `~/WorkSpace/SayDo/scripts/check-doc-links.mjs:11`
  - `~/WorkSpace/SayDo/scripts/check-doc-links.mjs:17`
  - `~/WorkSpace/SayDo/scripts/check-doc-links.mjs:28`
- 实际证据：

```text
$ node scripts/check-doc-links.mjs
[ok] active document links: files=56 broken=0
```

过滤器只包含根部少数文件及 `docs/01-11`、modules、adr、plan，跳过 `docs/site`、`docs/review`、package README 和部署 HTML；正则只识别内联 Markdown 链接，不识别引用式链接或 HTML `href/src`。本轮没有据此确认实际断链。

- 影响：官网或发布文档未来出现断链时，门禁仍可绿色。
- 最小修复：用显式活跃资产清单覆盖发布文档、站点源稿、package README 和生成 HTML，并用 Markdown/HTML 解析器检查引用式链接及 `href/src`。

## 补充核验结果

- tarball 列表命令退出 0，共 15 个条目，仅含 `dist/`、`package.json`、README、LICENSE、NOTICE；包内 README 在 `~/WorkSpace/SayDo/packages/cli/README.md:20` 如实说明只含 daemon 和 Web 控制台。
- 根许可证与包内 LICENSE、NOTICE 的两次 `cmp -s` 均退出 0。
- 对 tar 内容执行绝对用户路径、常见私钥和 token 格式的定向扫描，`rg` 退出 1且无输出，表示这些模式未命中；这不是完整秘密扫描，且发布物重建后必须重跑。
- 两个非同树 public snapshot 与对应 internal commit 的实际差异都只有 8 个版权登记资产删除，未发现额外代码实现。
- 官网移动端文案明确写着“开发中、尚未上架、当前无可下载版本”，未发现移动 App 已发布的误导。

## 实际执行的门禁

| 命令 | 退出结果 | 结论 |
|---|---:|---|
| `node scripts/week-audit.mjs --check` | 0 | 固定提交账本自洽，但存在 A-1 假绿 |
| `node scripts/check-doc-links.mjs` | 0 | 56 个文件、broken 0；存在 C-1 覆盖缺口 |
| `node scripts/build-release-artifacts.mjs --check` | 0 | metadata 与旧 tar 自洽，但存在 A-2 假绿 |
| `git diff --check` | 0 | 无输出 |
| `bash scripts/check-emoji.sh` | 0 | `[ok] emoji gate: clean` |
| `cmp -s LICENSE packages/cli/LICENSE` | 0 | 一致 |
| `cmp -s NOTICE packages/cli/NOTICE` | 0 | 一致 |
| `pnpm typecheck` | 0 | 6 个项目完成 |
| `pnpm lint` | 0 | ESLint 完成 |
| `pnpm --filter @saydo/daemon test` | 1 | sandbox 拒绝写 `node_modules/.vite-temp`，测试未收集 |
| `pnpm --filter @saydo/console test` | 1 | sandbox 拒绝写 `node_modules/.vite-temp`，测试未收集 |
| `pnpm --filter @saydo/cli test` | 1 | sandbox 拒绝写 `node_modules/.vite-temp`，测试未收集 |
| 上述三包改用 `vitest run --configLoader runner` 重试 | 各 1 | sandbox 拒绝创建系统临时目录，仍未收集测试 |

## 未验证

- `just ci` 全量 Node/Python 双矩阵：未验证。
- 单元测试、契约测试真实结果：未验证；上述失败发生在测试收集前，不能作为产品测试失败或通过的证据。
- Playwright 35/35 及截图重跑：未验证。
- `pnpm --filter @saydo/cli verify:distribution`、ownership、端口冲突、退出、恢复运行态：未验证。
- 最终 GitHub rc.2 URL、全局安装及 macOS、Windows、Linux 真实启动：未验证。
- GitHub Release、公开 Actions、官网部署：未验证。
- 真 Claude init、PreToolUse/PostToolUse、订阅凭据环境和 observed-model 全链：未验证。
- S3 真人本机认证、四场语音体验及移动真机安装：未验证。

## 裁决

不可以发布