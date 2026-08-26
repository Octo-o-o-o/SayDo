# RC4 移动端：prompt 隐私门全新会话重做

你是新的 `grok-4.6` 实施会话。上一实施会话在同一 P1 上第二次独立复审仍红，按仓库制度已废弃；不要继承或替上一会话辩护。只以当前 worktree 的实际代码、下述复现和验收目标施工。

只修改当前 `<repo>` worktree；不要 commit、push、联网、发布、部署或安装设备，不要修改用户原始 dirty worktree，不要启动 subagent。

## 已独立验证的现状

- 当前 13 个 `*rc4-mobile*.md` 经独立宽扫描为 0 命中；本次修的是门禁可绕过，不是宣称当前文件仍有泄漏。
- `privacyHits` 目前是唯一核心 detector，release contract 与 pairing corpus 都直接导入它；这个单一来源原则必须保留。
- 当前 pairing corpus 216、移动安装器 128、release contract 150 项自测均绿，但 release contract 的 150 项存在以下假绿。
- 上一轮三端解析器、安装器、Harmony 证据与 CI 已独立确认未退化；不要改这些文件。

## 必修 P1

1. `listRc4MobilePrompts()` 只扫描 `promptDir` 顶层。独立隔离复现把同类文件放进 `prompts/nested/` 后，完整 release contract 错误退出 0。
2. `loopback` 只覆盖 IPv4；完整 IPv6 loopback 当前命中 0。
3. Windows home 与 `file:` URI detector 大小写敏感；Windows 路径大小写变体和大写 URI scheme 当前命中 0。
4. `test-mobile-release-contract.mjs` 的隔离红绿测试只直接调用 helper、只写顶层文件，没有执行完整 release-contract 入口，不满足 prompt 166 的验收目标。

## 必须实现

### A. 整棵 prompt tree

- 递归扫描给定 `prompts/` 根下全部目录，只选择 basename 含 `rc4-mobile` 且扩展名为 `.md` 的普通文件。
- 不跟随任何 symlink。遇到扫描范围内的 symlink、非普通候选文件、无法读取目录或无法判型时必须 fail-closed，不能静默跳过后返回干净。
- 返回稳定、相对 prompt 根的排序路径；同名嵌套文件不能互相覆盖。
- 增加深层嵌套、symlink 文件、symlink 目录、读取/判型失败和正常空目录回归；不得制造会逃逸临时根的写入。

### B. 单一 detector 的完整类别

- 保持一个权威 `privacyHits`；release contract 和 pairing corpus 只能复用或投影它，不能复制另一组正则。
- 至少覆盖：RFC1918 三段、IPv4 loopback、IPv6 loopback（bracketed URL 与裸 host 形态）、ULA、macOS/Linux/Windows home、file URI、UUID-like ID、device path。
- Windows home 与 URI scheme 按协议/平台语义处理大小写；补混合大小写正例。
- 保持语义占位符与 split-parts 负例不命中，不能用过宽正则把文档中的类别描述当成泄漏。
- 正例必须运行时用 parts 组装，任何准备提交的 fixture/prompt 不得含完整私网地址、完整本机 home、operational UUID 或 device path。

### C. 真正的完整入口红绿测试

- 用隔离 prompt tree 运行与正常命令相同的完整 release-contract 入口，而不是只直接调用 helper 后宣称通过。
- 必须证明：顶层完整私网类别使完整命令非 0；深层嵌套完整私网类别也使完整命令非 0；脱敏后完整命令回到 0。
- 不能留下可被普通 ambient env/CLI 参数用来跳过真实仓库 prompt 扫描的旁路。若为测试注入 root，必须是不可递归、显式 test-only 的受控入口，且正常命令始终绑定仓库 `prompts/`。
- 子进程输出和失败摘要不得回显被测隐私值。

### D. 当前候选与边界

- 扫描所有准备提交的 rc4-mobile prompts，包括新增 167，所有类别命中总数必须为 0。
- 不修改三端解析器、安装器、Harmony 构建/证据、CI 或官网文案；若确需改动超出 detector、release-contract 自测和本 prompt，先停止并报告。
- 不以提高计数替代红灯证明；报告必须给出 nested 红、顶层红、脱敏绿三个完整入口的退出码。

## 门禁

逐条运行并真实报告退出码与摘要：

```text
node scripts/test-pairing-url-corpus.mjs
node scripts/test-mobile-installers.mjs
node scripts/test-mobile-release-contract.mjs
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
node scripts/check-doc-links.mjs
git diff --check
actionlint .github/workflows/ci.yml
```

另报告：detector 类别正例数、占位/parts 负例数、递归/symlink fail-closed 用例数、三个完整入口红绿退出码、当前 rc4-mobile prompt 文件数与零命中总数。不得回显任何敏感样例原文。
