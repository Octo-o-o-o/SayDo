# 2026-10-07 门禁精简第二阶段

## 范围与依据

第一阶段已提交代码 `23fb170d` 与证据 `af4bb892`，该阶段报告保持历史。owner 授权提交后只补确有价值的缺口；两名 fresh reviewer 独立审查并互相 challenge 后一致采纳以下三项。没有恢复静态证明、台账、源码形状门或测试数量清单。

## 实施

1. **合法删除不再产生假红。** emoji 默认扫描与 privacy --fs 先取 `git ls-files --deleted -z` 的已知删除集合，再枚举 cached/others 并排除这些路径。新增 Git 查询失败仍拒绝；不捕获全部 ENOENT，也不使用 existsSync 跳过未知缺失。显式文件参数、读取失败与发布 --ref 逻辑未改。此修复不承诺并发修改的全局快照一致性。
2. **保留的专项回归在相关改动自动运行。** 新建 tools-release-checks.yml：PR 与 main push 使用相同简短 paths 并集，并保留 workflow_dispatch。一个 Ubuntu 24.04 job、15 分钟上限、contents read、现有固定 action SHA、Node 22、冻结 lockfile，一次安装后顺序调用 test:tools 和 test:release。覆盖 scripts/workflow/依赖清单/apps/发布站点和发布文档/具名安装证据/prompts；仓库无 patches 目录。该集合是相关变更触发范围，不宣称覆盖测试所读的所有全仓文本。日常 CI 不增加路径过滤，原生平台矩阵不恢复为全 PR 默认；新路径专项不新增全 PR required check。
3. **已有测试包拒绝零测试假绿。** cli、console、contracts、daemon、platform 的 test 命令移除 --passWithNoTests。根 --if-present 保持；不为无测试包凑测试。该约束只拒绝整个包零测试，不保证检测到单个测试误删。

README 补充简短入口说明。未修改产品业务逻辑、浏览器配置、第一阶段历史报告或安装/发布安全合同；没有 commit、push、发布或远端执行。

## Focused 验证

- emoji 既有自测：13 pass、0 fail。真实临时 Git 仓复制 scanner 到 scripts，合法未暂存删除通过；tracked 修改与 untracked emoji 均断言实际 exit 1、违规类别及文件。原显式缺失、不可读文件测试保留。
- privacy 既有自测：31 pass、0 fail。合法删除通过；tracked 修改与 untracked 私有路径均断言实际 exit 1 与类别；删除前旧 commit 的 --ref 仍报真实 home-macos 违规，并确认日志不回显私密值。
- `git diff --check` 通过。完整 just ci、tools/release 与 workflow 一次性解析/路径检查由主控在固定候选验证；不提前授予通过。产品/浏览器未变，第一阶段浏览器 66 pass 仅作为其原绑定范围的证据。原生、远端 workflow 触发、真机/provider 未验边界不变。

Focused 原始日志保存在候选外同一任务目录，文件名、字节数和 SHA-256 见下方；不提交日志内容。

| 日志 | bytes | SHA-256 |
|---|---:|---|
| phase2-emoji-focused.log | 647 | 953ede4b070e39b4a33479e529718f8e483c14efd37aab489280ad59709dd7b1 |
| phase2-privacy-focused.log | 1028 | 2f4359628d1744dba7cd9d5e9f334b45a19619cc56b730b8e1bf98fd12a5a338 |

## 固定候选验证与提交

代码提交：`a4aca55d79091ad3ecb14016d3289b209aa56bb6`。本轮实际 `just ci` exit 0（87.499秒）：Node 3957 pass / 21 skip、Python 159 pass；`pnpm test:tools` exit 0（4.021秒），`pnpm test:release` exit 0（39.316秒）。两位fresh reviewer完成独立方案评审、相互challenge和实际实现核验，均无残余阻塞。实际实现派发与收回 git-diff-v1 指纹均为 `2c3461aea49a21e17f95290d033e440b184f5f3a151f6eabcfc5c665e5fa2793`；raw diff SHA与该算法不同的疑点已由两人独立核验关闭，没有候选漂移。

额外一次性验证：新workflow YAML解析、PR/main paths相同、只读权限与单job命令核验通过；13个应触发路径和6个普通产品/历史文档不触发样例匹配通过。该检查未加入仓库门禁。真实临时空目录Vitest返回1且明确No test files found，证明无测试不再被放行；没有新增测试数量门。`just precommit`三项扫描通过（活跃链接41文件0broken、隐私0hit）。

浏览器/产品源码及Playwright配置相对第一阶段代码未变化，本轮沿用第一阶段66pass证据，没有重复运行；不把沿用写成本轮重跑。Windows/macOS/Linux实际distribution、Android/iOS原生构建、真机/provider和托管workflow执行未验。本次仅本地提交，未push、未修改远端规则、未发布。只读查询archive和公开快照main时，两仓classic required status接口均为Branch not protected，rulesets required_status_checks均为空；这不是远端CI通过证明。

原始日志和review保存候选外，日志不入Git：

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `phase2-repro-before.json` | 285 | `8307bdbd2b712e8692f412cbd306247c45b5d5f75f5664f20b684c49be596bc5` |
| `phase2-emoji-focused.log` | 647 | `953ede4b070e39b4a33479e529718f8e483c14efd37aab489280ad59709dd7b1` |
| `phase2-privacy-focused.log` | 1028 | `2f4359628d1744dba7cd9d5e9f334b45a19619cc56b730b8e1bf98fd12a5a338` |
| `phase2-ci.log` | 90212 | `bf1e47d8c84247b1895215af45689df2c2f1998282d6b2fb43bacec553da1f87` |
| `phase2-tools.log` | 4827 | `35f6b1d818b71e8215e78bf39116eecba2b09986d8ca813d25b01641fc096d88` |
| `phase2-release.log` | 32979 | `7dc40665f08c20e0e174f92410120019a928b2fdbae82396813f779d389df149` |
| `phase2-empty-tests.log` | 645 | `1452b57648a12eff476b294a2271b9900cec8a4c2fcb883a25591d3bf42a05e2` |
| `phase2-auxiliary-checks.json` | 243 | `73ac174cccf80fd488b18ec24b65e2c39f717f08c354f7ee9c4ede6bd9c33071` |
| `remote-required-checks.md` | 442 | `b5580c1fc3fdf2cee402bc03ef010ad021ac571794e5241938de3a3c560e2c6b` |
| `phase2-review-a.md` | 6520 | `1971a7e032968b11454c98da774c0a1537454555edfce1c0ac957d2a8faa27f0` |
| `phase2-review-b.md` | 6543 | `8351f8ad56144d32cb74902dc069abb90f5c03215726ca7abca10b7c2ca237a0` |
| `phase2-implementation-a.md` | 3158 | `c3fdf9cf64048f19441651a5ddc2b4ffc9749e64d0ee4eb6ccd083f987f3f24e` |
| `phase2-implementation-b.md` | 2745 | `4ef368466be4a1b3830b9050578923b9a7c736a3c4eab498db1298496289ecc3` |
