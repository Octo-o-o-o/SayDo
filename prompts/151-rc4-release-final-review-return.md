# RC4 发布链最终独立复审退回

你是本轮发布链的原实施会话。独立零上下文评审对提交
`b9fb7deddf50356c3af83b97f63b5fa32798a25e`（基线
`704048f2ca026a03edf40b0932153fdacb256daa`）判定 No-Go。请继续在当前 worktree
修复，不能通过降低门禁、串行化规避、删测试或把失败改写成文档说明来收口。

## 必修 P1

1. 真实发布 bundle 门失败：`node scripts/week-audit.mjs --check-bundle` 报
   `审计后工作树内容漂移:docs/plan/2026-08-22-week-audit-faststart-release.fable.md`。
   本轮文档、`scripts/week-audit.mjs`、多个 release 脚本与 publication manifest / working-tree
   snapshot 漂移或缺席。修复生成与校验逻辑并重生冻结输出，使候选 SHA 上真实门禁通过；不能只在测试里绕开。
2. `scripts/release-pages-deploy.mjs` 的 claim/read/lease-check 路径吞掉 `closeSync`
   失败。评审在“先真实关闭再抛错”注入下仍拿到 fresh lease。所有公共读取、claim、lease
   校验和持久化路径都必须在 close 结果不可信时 fail-closed；补公共入口级测试。
3. 恶意或 revoked Proxy 能伪造可信错误并逃逸攻击文本：
   - `release-cloudflare-pages.mjs` 不得仅靠攻击者可拦截的 `name` 判断并原样返回对象；
   - `release-pages-deploy.mjs` 不得凭 Proxy 可伪造的 symbol/message descriptor 原样重抛；
   - `isEnoent` 不得直接读取 revoked Proxy 的 `.code`。
   未知 caught value 必须统一生成新的、受控常量错误；补 forged/revoked Proxy 回归，证明对象身份和攻击文本都不逸出。

## 必修 P2

4. publication exact-set 目前在比较前主动过滤 `isPublicExcluded(path)`，导致私有路径对
   `--check-bundle` 不可见。让“全树精确集”本身能证明公开候选没有私有路径，同时保留 workflow
   的第二道防线；补至少一个私有路径注入回归。
5. `O_NOFOLLOW` 只保护最终目录项，父目录 symlink 仍可把 claim 写到树外。对整条父目录链做
   锚定/验证，`inside/redirect -> outside` 时必须在写入前拒绝且 outside 不产生文件；补回归。

## 同步修正

- 修正文档/证据中超过真实覆盖范围的断言。
- 当前“公共入口接线”测试仅做源码字符串检查；为本轮修改涉及的实际公共入口增加至少一个真实执行接线测试。
- 不得打印或落盘凭证、完整私有路径或攻击文本。
- 保持最小改动，不碰与发布链无关的代码；已有 `research/week-audit/*.json` 修改必须以干净候选真实重生结果为准。

## 必须原样执行并回报退出码

```sh
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
node scripts/week-audit.mjs --check-bundle
pnpm typecheck
pnpm lint
pnpm test
node scripts/check-emoji.mjs
git diff --check 704048f2ca026a03edf40b0932153fdacb256daa --
```

另外重跑独立评审的五个攻击复现等价用例：claim close、伪造 Cloudflare public error、
伪造 durable projection error、revoked Proxy、父目录 symlink，以及 publication 私有路径注入。
完成后给出改动文件清单、每条发现到代码/测试的映射、真实测试计数和所有退出码。不要 commit、push、
tag、release 或 deploy；不要调用 subagent。
