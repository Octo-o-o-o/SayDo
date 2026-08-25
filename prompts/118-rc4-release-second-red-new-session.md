# RC4 Release 第二次同类红灯：全新实施会话重做

你是全新的 Grok 实施会话。不得读取或继承上一实施会话的推理、自辩或 resume 状态；只以本文件、仓库代码和测试为输入。

工作目录：`<repo>`

精确起点：

- HEAD `89cdc228780be471ca2cef4f72af167d07d1c8cd`
- parent `e22be466b206002fd5ab270d41471f7cbc72bc5e`
- 当前分支已含 audit 恢复及第一轮脱敏修复，但连续两轮独立 review 在同类安全边界上判红。按仓库制度，本轮必须由全新实施会话重做，不能 resume 旧 session。

## 1. 必修问题

### P1-A：存在但为 falsy 的证据会被当作“不存在”并 fresh deploy

真实入口 `scripts/post-release-gate.mjs` 会在 evidence 文件存在时执行 `JSON.parse`。当前 `scripts/release-pages-deploy.mjs` 用 truthy 判断 `existingEvidence`，所以文件根为合法 JSON `0`、`false`、`""` 时会进入 fresh deploy；`null` 也必须与“文件不存在”区分。

要求：

1. 从 caller 到状态机显式传递“证据文件是否存在”，不得用任意 JSON 值的 truthiness 推断。
2. 文件存在时，根为 `null`、`0`、`false`、`""`、数组或任何非合同对象，必须 fail-closed。
3. 上述畸形证据必须在任何外部/耐久 mutation 前拒绝：`wranglerCalls=0`、`persistCalls=0`、`auditCalls=0`；不得部署，也不得删除/覆盖既有证据。
4. 只有明确“不存在证据文件”才允许走 fresh deploy。
5. 合法 `audit_pending` / `audit_failed` 继续走只读恢复且 `wranglerCalls=0`；既有 drift/partial 状态的拒绝语义不得回退。

### P1-B：Cloudflare 脱敏边界仍有 Proxy/body 逃逸

当前独立反例已证实：

1. `cloudflareRequest` 的参数在 `try` 之前解构；参数对象 Proxy 的 `query` getter 抛出 `Bearer <token>` 会原样逃逸。
2. 导出的 envelope helper 同样在函数体外解构 options；`errors` 数组 Proxy 的 `length` getter 也可抛出并泄漏。
3. `response.text()` 自身抛出的 message 可能包含任意响应 body 片段，当前会回显该片段。

要求：

1. 真正的统一边界必须从“接收未可信参数对象”之前开始：不要在受保护函数形参中解构；所有属性访问、序列化、URL/query 构造、fetch、状态/body 读取、envelope 校验、错误取文案都在不会二次抛出的统一安全边界内。
2. 如果导出的 envelope helper 无必要，优先收回为内部实现；若保留导出，它自身也必须对任意 Proxy/恶意 getter fail-safe，不得把 untrusted message 带出。
3. 任何响应 body、`response.text()` 异常 message、Cloudflare `errors[].message`、Proxy getter/toString/message 都不得进入最终错误文本。普通 HTTP 状态、`success=false`、缺字段、畸形 JSON仍应返回可定位但仅由常量/可信状态码组成的语义。
4. 不允许只做 token 正则替换后继续回显 body fragment；本合同要求 body 内容根本不进入错误。

## 2. 必须新增的反例

在仓库正式自测中逐项覆盖，至少包括：

- evidence 文件存在且 JSON 根分别为 `null`、`0`、`false`、`""`、`[]`：全部在零 mutation 下拒绝。
- 参数对象 Proxy 的 `query` getter 抛 `Bearer <unique-token>`。
- envelope options Proxy getter 抛 `Bearer <unique-token>`。
- `errors` 数组 Proxy 的 `length` getter 抛 `Bearer <unique-token>`。
- `response.text()` 抛出唯一 body fragment（不一定是 token）：最终错误不得包含该 fragment。
- 既有 query Proxy、异常 `message` / `toString`、payload Proxy、Bearer 和 exact token 反例继续保留。
- 真正没有 evidence 时 fresh deploy 仍可达；合法 `audit_pending` / `audit_failed` 恢复仍零 Wrangler 并按 `audit_pending -> audit -> completed` 收口。

每个泄漏反例同时断言：不含 exact token、不含 `Bearer`、不含唯一 body fragment，并且错误对象稳定可捕获。

## 3. 范围与禁令

- 最小修改 `scripts/release-pages-deploy.mjs`、`scripts/post-release-gate.mjs`、`scripts/release-cloudflare-pages.mjs` 及对应正式自测/必要计划文字。
- 不改 daemon runtime，不运行任何 daemon Vitest，不碰发布证据冻结值、manifest、tag、GitHub、Cloudflare 写 API。
- 不提交、不 push、不部署；完成后保留工作树给宿主复核。
- 不读取旧 Grok session 日志；不得以“常规调用方不会传 Proxy”为理由降低合同。

## 4. 门禁

实施后真实运行并报告退出码：

1. `node scripts/test-release-provenance.mjs`
2. `node scripts/test-release-physical-evidence.mjs`
3. `node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.4`
4. `node scripts/build-release-artifacts.mjs --check --version v0.1.0-rc.4`
5. `pnpm typecheck`
6. `pnpm lint`
7. `actionlint .github/workflows/*.yml`
8. `node scripts/check-doc-links.mjs`
9. `bash scripts/check-emoji.sh`
10. `git diff --check`

若 artifact `--check` 只因 ignored tgz 在当前 worktree 缺失而红，明确记录，不得为了假绿篡改冻结值；宿主会在隔离树执行 `--write -> --check`。

最终只汇报：改了什么、每条反例如何闭合、真实门禁结果、未解决阻断。不要 commit。
