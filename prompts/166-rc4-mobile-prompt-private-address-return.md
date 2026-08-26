# RC4 移动端：prompt 私网地址门禁返工

你在原 `grok-4.6` 移动端实施会话继续施工。只修改当前 worktree；不要 commit、push、发布、部署、联网或安装设备，不要改用户原始 dirty worktree。

第二轮独立复审已确认上一轮 IPv6 实现、105,200 例 fuzz、Harmony 当前/历史口径与安装器合同都成立；唯一剩余 P1 是 prompt 隐私门假绿。

## 已验证红灯

- 12 个准备提交的 rc4-mobile prompt 中，`prompts/163-rc4-mobile-final-review-findings-return.md` 仍有 1 个完整 bracketed ULA pairing URL。不要在答复或本 prompt 中回显该值。
- 独立 home/UUID/device-path 扫描为 0，但独立 RFC1918/ULA 扫描为 1。
- `node scripts/test-mobile-release-contract.mjs` 仍报 131 passed，因为 `privacyIssues()` 与 prompt 扫描没有覆盖 RFC1918/ULA；这是假阴性。
- `scripts/pairing-url-fixtures.mjs` 已把完整 RFC1918/ULA 当作隐私命中，两个 helper 的合同发生分叉。

## 必须完成

1. 只在 `prompts/163-rc4-mobile-final-review-findings-return.md` 把完整私网 URL 改成不含完整地址的语义描述或 parts 组装说明；保持复现含义，不能换成另一条完整私网地址。
2. 让 `scripts/test-mobile-release-contract.mjs` 的待提交 prompt 隐私检查覆盖与权威 fixture helper 一致的类别，至少包含：macOS/Linux/Windows home、operational UUID/device path、file URL、RFC1918 三段、loopback 与 ULA（含 bracketed URL）。优先复用/导入单一权威 helper，避免复制第三套正则；若因错误信息需要包装，只能在一个核心 detector 上投影。
3. 回归 fixture 本身不得提交完整私网地址：用 host parts 在运行时组装正例；断言每个私网类别都产生命中，语义占位符/拆分 parts 不命中。
4. 增加隔离 prompt-tree 回归：含完整 RFC1918 或 ULA 的未跟踪 rc4-mobile prompt 必须使合同门失败；脱敏后通过。不能只直接调用 helper 后宣称整棵 prompt 扫描有效。
5. 扫描全部 12 个准备提交 rc4-mobile prompts 与本轮新增 166，home、UUID、device path、file URL、RFC1918、loopback、ULA 命中均为 0；不要回显命中原文。

## 门禁

逐条运行并真实报告 exit code/摘要：

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

无需重跑已由独立复审通过的长时 iOS/Android/Harmony 原生构建；主控会在最终集成树重跑。必须另报告新的 detector 类别测试数、隔离 prompt-tree 负例、全部 prompts 零命中。

## 边界

- 不放宽“完整私网地址不得进入待提交 prompt/fixture”的仓库合同。
- 不改战略/商业计划，不处理设备现场。
- 不使用 `git add -A`，不 commit。
