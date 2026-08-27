# RC4 公开快照边界：merge 泄漏绕过返工

你在同一实施会话中继续施工。只修改当前 worktree；不要 commit、push、发布或部署，不要改用户原始 dirty worktree。

## 已验证红灯

主机在真实仓库运行：

```text
merge=4d2824ef896e5ace49cb8f86e48b3c7a64bf7602
git diff-tree --no-commit-id --name-only -r <merge> | wc -l => 0
git diff-tree -m --no-commit-id --name-only -r <merge> | wc -l => 210
```

当前 `scripts/implementation-boundary.mjs` 的 `commitPaths` 与
`leakedImplementationAfterBoundary` 都用未展开 merge parents 的 `git diff-tree`。
因此边界后的 merge commit 可以携带实施路径却被读成空路径。现有 42 项自测只验证
“引入边界证据的 commit 本身不能是 merge”和 full-history 二次修改，没有验证
“边界之后的 merge 引入实施变更必须被拒绝”。

## 必须完成

1. 修复 commit 路径枚举：普通、root、merge（含 octopus）都必须 fail-closed；不得把命令失败读成空集合。
2. 对 merge commit，要按每个 parent 比较并取完整路径并集；若同一 merge 相对任一 parent 含非证据路径，该 commit 必须列入 leaked implementation。不得依赖只看 first-parent、默认 combined diff 或 rename 猜测。
3. `assertEvidencePaths` 也要使用同一套安全枚举；不要留下两份不同逻辑。
4. 在 `scripts/test-week-audit-boundary.mjs` 增加真实 Git 图回归：
   - 边界证据之后，两个分支各为 docs-only，但 merge resolution 新增/修改 `scripts/` 文件，必须拒绝；
   - 边界证据之后，docs-only merge 必须允许；
   - 至少覆盖一个多 parent merge 或等价的逐 parent 并集断言；
   - Git 子命令失败必须抛错，不能当成无变更。
5. 不得放宽 evidence path；四个 availability HTML 仍是唯一允许的 deploy 页面。
6. 运行并真实报告：
   - `node scripts/test-week-audit-boundary.mjs`
   - `node scripts/test-public-text-redaction.mjs`
   - `node scripts/test-public-tree-privacy.mjs`
   - `node scripts/test-journal-digests.mjs`
   - `node scripts/check-journal-digests.mjs`
   - `node scripts/test-ios-build-and-install.mjs`
   - `node scripts/test-release-provenance.mjs`
   - `node scripts/check-doc-links.mjs`
   - `pnpm typecheck`
   - `pnpm lint`
   - `node scripts/check-emoji.mjs`
   - `git diff --check`

## 边界

- 不创建最终 implementation-boundary JSON；它只能在实际代码 commit 后由紧随其后的证据 commit 一次性引入。
- 不把代理自述当证据；保留命令 exit code 与摘要。
- 不处理 AI supply 商业/战略计划。
