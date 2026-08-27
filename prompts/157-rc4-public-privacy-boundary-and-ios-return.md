# RC4 公共隐私线返工：一次性实施边界证据与 iOS 门禁正名

你是本轮施工方，继续 session `<session-id>`，只在当前 worktree 内修改。不要提交、推送、发布或部署。先读当前实际 diff 和相关测试，不要相信旧报告中的完成断言。

## 已确认红灯

1. 仓库原有、权威的 iOS 安装门禁是 `scripts/test-ios-build-and-install.mjs`。当前施工误建了 `scripts/test-ios-build-install.mjs` 包装器，并把 CI、justfile、package.json 改到错误名称。
2. `scripts/week-audit.mjs` 把 `remediationEnd` 直接写死在实施脚本中。任何修复该脚本的新代码提交都会位于旧边界之后，导致边界立即过期；再修改脚本中的 SHA 又会制造新的实施提交，形成循环。
3. 边界文件若可被反复修改来前移，也会允许“先提交未审实施、再改边界文件洗白”，不可接受。

## 必须实施

### A. 恢复权威 iOS 门禁

- 删除本轮误建的 `scripts/test-ios-build-install.mjs`。
- `.github/workflows/ci.yml`、`justfile`、`package.json` 全部调用现有 `scripts/test-ios-build-and-install.mjs`。
- 不得留下错误文件名的引用。

### B. 一次性、非自引用的实施边界证据

将实施边界从 `scripts/week-audit.mjs` 的源码常量移到一个专用、机器可读的证据文件，例如：

`research/week-audit/2026-08-24-implementation-boundary.json`

采用以下可判定协议（字段名可小幅调整，但语义不得削弱）：

1. 代码提交先落地，证据提交紧随其后；证据 JSON 记录代码提交的完整 40 位 SHA，而不是记录自身证据提交 SHA。因此无 SHA 自引用。
2. Git 历史中该边界证据路径必须恰好只出现于一个提交中（首次新增后永不修改）。
3. 引入该文件的提交，其第一父提交必须恰好等于 JSON 记录的实施边界 SHA；引入提交本身必须仅含明确允许的文档/证据载体，不得含实现代码、测试、CI、package/lock/config 等实施路径。
4. 当前工作树中的边界证据文件必须与 HEAD 中的 blob 完全一致，不能靠未提交修改临时前移。
5. `--check` 与 `--check-bundle` 都必须校验上述历史协议，并继续枚举边界后的每个提交；任何非允许证据路径都报错。不能只做 `merge-base`。
6. 一旦该路径被第二次提交修改，即使内容合法，也必须 fail closed；不能把新的实施提交“重新冻结”为合法。
7. 脚本和测试在“代码提交已存在、证据提交尚未创建”的中间态可以明确 fail closed；这不妨碍主代理随后创建独立证据提交。不要为了让中间态变绿而回退到源码硬编码 SHA。
8. 生成的 ledger/integrity/manifest 只记录实施边界代码 SHA；不要声称记录尚未知的证据提交 SHA，不要制造哈希自引用或伪造发布身份。

请抽出纯函数或可测试 helper，并用临时 Git 仓库覆盖至少这些情形：

- 一次性证据提交的 parent 等于记录边界，且提交只含允许证据文件，验收通过；
- 边界后只有文档/证据提交，验收通过；
- 边界后出现 `scripts/` 或任一实施路径提交，必定被检测；
- 第二次修改边界证据文件，必定失败；
- 边界证据提交的 parent 与 JSON SHA 不一致，必定失败；
- 边界证据提交混入实现/测试/CI/config，必定失败；
- 工作树未提交修改边界 JSON，必定失败；
- 缺失、非法 JSON、非 40 位 SHA、非祖先均 fail closed。

边界证据文件现在不要伪造一个未来 SHA。若当前未提交状态无法生成最终文件，可提交一个明确的模板 fixture 到测试临时目录，真实证据文件由主代理在实际代码提交后创建；但生产脚本必须明确指向唯一固定路径，且缺失时清晰失败。

### C. 保持既有修复不倒退

- 公共树隐私扫描仍需覆盖文件名和二进制可见内容，输出只给摘要/哈希，不回显敏感原文。
- journal digest、链接修复、redaction 等当前改动不得静默回退；若发现其事实错误则最小修正并说明。
- 不改与本轮无关的产品实现。

## 必跑门禁

在当前未提交中间态，除明确依赖真实边界证据提交的命令可按设计 fail closed 外，其余必须真实运行：

```text
node scripts/test-public-text-redaction.mjs
node scripts/test-public-tree-privacy.mjs
node scripts/test-journal-digests.mjs
node scripts/check-journal-digests.mjs
node scripts/test-week-audit-boundary.mjs
node scripts/test-ios-build-and-install.mjs
node scripts/check-doc-links.mjs
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
git diff --check
```

另外明确运行并报告 `node scripts/week-audit.mjs --check-bundle` 在当前阶段的真实结果；若它仅因真实边界证据尚未创建而 fail closed，报告为“等待代码提交后的证据提交”，不得写成通过。

最后输出：修改文件、协议说明、逐条命令与真实退出码、仍待主代理在代码提交后执行的精确步骤。不要自行 commit。
