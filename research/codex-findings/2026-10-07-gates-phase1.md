# 2026-10-07 门禁精简第一阶段

## 授权与结果边界

owner 要求完整检查门禁和测试，先激进精简，经两个 subagent 对抗审查后实施并完整提交，再审查值得补足的缺口。本阶段只删除和分离已评审的负担，不补新证明体系或新测试。基线为 `9686d7f91be9620ce1a219d324fc9e79c44a127f`，施工在独立 worktree，未修改主树、未 push 或发布。

方案经两名 reviewer 审查；实际 canonical 差异复核曾发现 Windows stdio 安全合同混在退役章末，已逐字迁到 09 §16 末尾，二人回修核验后才继续入口施工。旧 PG-02 静态证明失败、平台/设备/provider 未验结论不改成通过。

## 已实施范围

- 完整删除 71 个文件，其中 scripts 67 个，scripts 总行数从 51,606 降至 20,952。truth-plane 解释器、ledger/registry、专用合同类型与测试整体退役（46 个脚本文件，22,724 行）；没有产品运行时消费者。
- 删除 RF-00 库存/离线自证七件（5,466 行）、历史迁移六件、gate parity、元测试 test-gate-temp-cleanup、排产指针、固定宣传句检查及其专用测试。研究原始夹具与历史文档保留。
- 删除独立 refine-week-audit、audit-local-week 及其自测。week-audit/publication、post-release 调用、发布闭包与原子写接口保留；仅解除普通 CI/release quality 的固定历史 check-bundle，取消每次开发提交重生成历史账本的义务。
- 删除手写话术对象与自身 mustContain 自比的 golden 库存、场景计数测试及无消费者常量。保留真实输出的 checkStatusWords、checkNoRepeatedOpeners、确认词匹配、脱敏、Context Pack 编译与其余产品行为测试。
- 删除 console 五处文件内纯源码形状断言、wrapper 的两个 regex 用例和长度断言、Claude backend 与 App Server 原型的源码不含字符串断言。wrapper 真实 node --check 与 Linux 无 procps 子进程探针保留；移动端点的真实函数断言保留。删除 Python 仅断言版本存在的 skeleton 测试。
- 日常命令统一在根 package.json：ci:node = typecheck + lint + pnpm test + emoji 实扫 + 工作区隐私实扫；justfile 和 hosted CI 直接调用。Python 与浏览器测试保持各自入口。
- 工具自测移入 test:tools；安装/发布安全回归与 notices 移入 test:release，release workflow 调用。默认不跑颜色全扫描、scanner 自测、发布安装探针或 distribution 打包。三平台 distribution、Android、iOS 移入 platform-checks.yml 的 workflow_dispatch；release 原三平台矩阵保留。
- 文档链接默认只看根/包 README、HANDOFF、01–11 canonical、modules、ADR 和站点；`node scripts/check-doc-links.mjs --all` 可手工检查更广 docs。历史 plan/review 不再阻断开发。已删 tracked 文件不作为活跃文档读取。

## 当前命令与覆盖边界

| 场景 | 命令/入口 | 边界 |
|---|---|---|
| 日常 Node/Python | `just ci` | 真实产品测试与轻量扫描，不代表托管/原生平台已验 |
| 工具自身变更 | `pnpm test:tools` | emoji/颜色 scanner、dev 生命周期、隐私工具自测 |
| 安装/发布变更 | `pnpm test:release` | provenance、原子写、移动安装、配对、脱敏和安装器回归 |
| 浏览器 | `pnpm exec playwright test` | 真实页面交互；CI 独立 job |
| 原生壳/三平台安装 | platform-checks workflow_dispatch | 手动触发；没有把未执行计为成功 |
| 本地提交卫生 | `just precommit` | emoji、活跃链接、原有 --fs 隐私语义 |

隐私 --fs 保留原行为：本机有私有 probes 时读取，缺失不因该模式拒绝；本阶段未增加 require-private-probes。发布 --ref 的既有严格/hosted allow-missing 参数差异保留。大规模删除在 stage 后执行工作区扫描，避免 Git index 仍枚举已删除路径。运行时 Gate 0/S3/授权/预算/审计/恢复/脱敏及 SC-51 原生所有权合同未降级。

## 验证

实施者已运行：`pnpm lint` exit 0；活跃文档链接检查 exit 0（41 文件、0 broken）；`git diff --check` exit 0；保留 scripts/packages 运行源码不再引用退役工具，删除 golden 的导出无剩余消费者。emoji 全扫首次因删除尚未 stage 而读取已删 truthPlane.ts 失败（非通过）；需 stage 后复跑。完整日常基线、浏览器、专项工具和发布测试由主控在固定候选执行并记录；本报告不提前授予通过，不将未运行/skip 当 pass。

主控提供的改前基线：Node 3,983 pass、21 skip，81.10 秒；Python 160 pass。该数据只用于前后比较，不是本候选验证结果。平台/真机/provider 与托管 CI 尚未运行。本阶段无新增补足测试；有价值缺口在第一阶段提交之后另作两人交叉评审。

## 固定候选验证与本地提交

代码提交：`23fb170d66877d7637e7774f339f8a07750a7e12`。Node 3957 pass / 21 skip，Python 159 pass；`just ci` exit 0（98.556秒），`pnpm test:tools` exit 0（4.019秒），`pnpm test:release` exit 0（47.311秒），Playwright 66 pass（237.308秒）。浏览器使用本任务独立目录中与锁定Playwright版本匹配的Chromium。`just precommit` 的三项扫描通过；38个保留脚本相对静态import全部存在，已用TypeScript AST排除脚本内嵌字符串后核验。

首次typecheck因误删共享readFileSync导入失败，恢复后通过；首次发布专项因旧CI位置文本断言失败，删除这些过时断言后通过。首次浏览器缺对应浏览器制品，安装到任务目录后66项通过。最初正则式import检查误将内嵌脚本字符串当模块入口，改用一次性AST检查后无缺失；该检查没有加入仓库门禁。失败日志保留，不改写为通过。

两名方案reviewer及实际候选核验均已完成；canonical首次发现误删SC-51，完整561字节原文迁入§16并双人核验。实际候选核验A/B无阻塞。最后只按B建议校正profile的隐私扫描文案，没有改运行逻辑。原历史未决、平台/真机/provider/托管CI状态不因本次通过而改变；本次未运行distribution打包、Android/iOS真机或远端发布。

原始日志/评审保存于本任务候选外目录，日志不入Git。以下摘要绑定实际字节：

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `baseline-tests.log` | 91039 | `69ca03f6696e8103f858cebd86f85666de68074eda69d4b41cca58b505e64544` |
| `baseline-python.log` | 444 | `9345b3e26beeec46ffd089ab952afc7323dc935c6819ca6e94d0d4e4a6ecf9d9` |
| `phase1-ci.log` | 1221 | `c5b8108f96b06c2db44077757aa734a10d2e841484f914483da60a90705a4157` |
| `phase1-tools.log` | 4504 | `ed7f5190ea0b2bf7b1f4c6d92e60923e122e82d508bc4dacde77c936563cac0b` |
| `phase1-release.log` | 33489 | `56283712de44b733a39667220ae444faa14184fdaa0f68f8af0f8ffe63534117` |
| `phase1-browser.log` | 113564 | `7a9f472823e441b158d443a76a7f3a5eb44d94834fc9ee64608369e056cf4470` |
| `phase1-ci-retry.log` | 94147 | `aa3076c59dfd8a293a660bf3f97de1a3794602dfe8440f97e97d3570a973402b` |
| `phase1-release-retry.log` | 32979 | `7dc40665f08c20e0e174f92410120019a928b2fdbae82396813f779d389df149` |
| `phase1-browser-retry.log` | 8446 | `9b19b2b4fbfd9c8816e54acfa0bbd8f4fa27adb4d4536bcb72256250283a08d4` |
| `browser-install.log` | 4615 | `7d628d0f81e57c7c0c4a1aaa8926f1afabf23c72e40eb06c44dbc572254b9013` |
| `phase1-review-a.md` | 6320 | `f86afb6d7ae29882c812452e59c40bff74254f1d45b2cd4bb8994b023012363a` |
| `phase1-review-b.md` | 6758 | `b4817e0ec0b89bdd9d5263d0bc9673b937c8c64e6389f9154e48fac64cfe91b4` |
| `phase1-canonical-a.md` | 3715 | `ceaa3f733e02a28993ac4437bcf7cbf0eec4b1745ab3ce282ca56c7a30043ebf` |
| `phase1-canonical-b.md` | 3489 | `e14c7a0a43436e3611fa05c7c27ef9806de14391c47946cefe4431bbe71d4961` |
| `phase1-implementation-a.md` | 3596 | `43286964776529e02a1d26741d59637d8d18c205db88a3a0cfb2be85ec41b6b3` |
| `phase1-implementation-b.md` | 3556 | `0bed024766a0a5613705247e6c70e1bba6ac023b3480d2a01112537adf39451b` |
