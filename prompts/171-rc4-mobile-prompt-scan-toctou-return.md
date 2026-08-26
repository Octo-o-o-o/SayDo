# RC4 移动端：prompt 扫描竞态返工

继续原 `grok-4.6` 移动端实施会话，只修改当前 `<repo>` worktree。不要 commit、push、联网、发布、部署或安装设备；不要修改用户原始 dirty worktree，不要启动 subagent。

零上下文独立复审确认上一轮的递归、IPv6 loopback、大小写与完整入口修复均已落地，但发现新的 P1，因此当前仍是 No-Go。

## 已验证 P1

`scanRc4MobilePromptPrivacy()` 先对候选执行 `lstatSync(full)`，随后再按同一路径 `readFileSync(full)`。两步没有绑定到同一个已打开文件对象，也没有 no-follow 约束。独立复审在普通候选文件与外部 symlink 之间做原子交换，2,842 次扫描中真实出现 1 次跟随外部链接并读取到应被 detector 命中的内容；另有 3 次按预期 fail-closed。稳定 symlink 用例全绿不能覆盖这个窗口。

目录递归当前同样是按路径 `readdirSync` 后再 `lstatSync` 子项，必须一并检查中间目录替换与路径逃逸，不能只修最后一个文件。

## 必须完成

1. 候选内容必须从已经安全打开且完成类型/身份校验的句柄读取，读取过程不得再次按可替换路径打开。POSIX 上必须 no-follow；Windows 上采用等价的 fail-closed 绑定。打开前后或读取前后的身份校验要覆盖你所采用方案仍存在的竞态。
2. 对文件入口证明：最终 symlink、普通文件与 symlink 的原子交换、读取期间替换、非普通文件、不可读/消失文件均不能造成范围外内容被接受或扫描为干净；可以抛出受控通用错误，错误不得回显路径或内容。
3. 对目录递归证明：根目录与任意中间目录被 symlink/普通目录交换、重命名或消失时，要么继续扫描同一个已绑定目录对象，要么 fail-closed；不得通过被替换的父路径打开范围外后代。不要用仅在读取前后比较 path-based realpath/lstat 的可回换检查伪装修复。
4. 保持正常命令始终扫描真实仓库 `prompts/`；test-only 扩展只能追加隔离树，不能替换/跳过真实树。不得引入普通环境变量或 CLI 参数旁路。
5. 保持上一轮单一 `privacyHits`、递归深层候选、IPv6 loopback、Windows home/file URI 大小写、顶层红/嵌套红/脱敏绿、当前全部 rc4-mobile prompts 零命中等合同不退化。
6. 测试必须稳定、有限时长且可跨 CI 平台运行。平台不支持某种原子交换原语时，产品实现仍须 fail-closed；测试可以使用能力探测并用等价确定性注入覆盖关键窗口，但不能把产品入口替换成只供测试的另一套实现。

## 必补回归

- 候选 `lstat`/open/read 窗口原子替换成 symlink：不得返回范围外内容；记录 fail-closed 或安全绑定结果。
- 中间目录在枚举/后代打开窗口被替换：不得扫描范围外内容。
- 已安全打开的普通候选即使路径随后被替换，读取只来自原已打开对象；读取后身份/类型仍满足合同。
- 稳定 symlink 文件、symlink 目录、非普通、不可读、消失、深层正常文件继续覆盖。
- 完整 release-contract 入口仍证明顶层红、深层红、脱敏绿；失败摘要不含隐私样例或绝对路径。

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

另报告：竞态测试次数/结果、文件与目录竞态的实际处理、递归/symlink fail-closed 数、三个完整入口退出码、当前候选文件数与总命中数。不要回显敏感样例、绝对路径或本机身份。
