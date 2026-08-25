# RC4 Release 新实施会话首次独立终审回修

继续 resume 同一 Grok 实施会话 `<session-id>`，工作区：
`<repo>`。

当前代码提交为 `43cb7ff2d61137e954a7d662edb27baf7bb62f13`。这是该新实施会话的第一次独立终审红灯，必须在同一会话原路修复。先读取 prompt 118、当前提交和本文件。不得读取 reviewer 临时 clone，不得提交、push、发布、部署或访问任何写 API。不要运行 daemon Vitest；另一条运行时施工正在运行。

## P1-1：证据路径只有真实 ENOENT 才能进入 fresh deploy

独立 reviewer 已证明：`existsSync()` 会把 dangling symlink 当成不存在，随后原子 rename 覆盖该目录项并真实进入四次 Wrangler。相关位置：

- `scripts/release-pages-deploy.mjs` 的 evidence 读取；
- `scripts/post-release-gate.mjs` 的 evidence 装载；
- `scripts/release-file-transaction.mjs` 的原子写入。

修复合同：

1. 使用 `lstat` 或等价不跟随链接的读取。只有路径本身返回 `ENOENT` 才是 `evidenceFileExists=false`。
2. dangling/有效 symlink、目录、FIFO/socket/设备等非普通文件、权限错误和其他 I/O 错误全部 fail-closed，且在任何 Wrangler、persist、audit 之前拒绝。
3. 既有 evidence 必须是非 symlink regular file，再读取与解析；不得由写事务把异常目录项覆盖成普通文件。
4. 原子持久化入口自身也要拒绝覆盖 symlink/非普通目标，避免调用方遗漏检查时再次产生同类边界。
5. 增加确定性反例：dangling symlink 至少覆盖真实状态机入口；同时覆盖目录、有效 symlink和非 ENOENT I/O 失败。断言零 Wrangler、零持久化、零审计，且异常目录项未被替换。

## P1-2：Cloudflare result 字段不得进入错误或耐久证据

独立 reviewer 已证明 `canonical_deployment.id` 可携带 Bearer/token/任意响应片段；当前 mismatch 错误会拼接该字段，fresh 路径还会把片段写入 `partial_failed.errorMessage`。

修复合同：

1. 所有来自 Cloudflare envelope/result/body 的字段仅用于形状验证与恒等比较，不得拼进 Error message、日志或耐久 evidence。
2. canonical deployment id 不匹配、缺失或类型错误使用稳定常量错误；恢复与 fresh 两条路径都不得含实际值。
3. 外层不得重新包装并拼接原始异常 message；最终抛错和 `partial_failed.errorMessage` 都只能来自稳定、无不可信片段的语义错误。
4. 增加 reviewer 同型反例：合法 envelope + 恶意 `canonical_deployment.id`，分别覆盖恢复与 fresh；断言抛错、耐久 evidence、控制台输出均不含 Bearer、精确 token、唯一 body/result 片段。

## P2：导出 wrapper、credential 和 result snapshot 的 Proxy 边界

1. `getPagesProject()`、`listPagesDeployments()`、`requireCloudflareCredentials()` 等导出入口不得在安全边界前做参数解构或读取 getter；参数对象 Proxy/getter 抛错必须变成稳定常量，不能泄漏 message。
2. result 必须先形成安全快照，再对快照做最终形状验证；如果 `toJSON`/getter/iterator 让 object 变 array 或 array 变 object，必须 fail-closed，不能返回形状翻转结果。
3. 补参数 Proxy、credential options Proxy、result `toJSON` 形状翻转与 snapshot getter 抛错反例。所有输出断言不含 token/Bearer/唯一片段。
4. 普通 HTTP 403、非 JSON、`success=false`、缺 errors 等既有可诊断常量语义不得回退。

## 门禁

真实运行并报告退出码：

```bash
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.4
node scripts/build-release-artifacts.mjs --check --version v0.1.0-rc.4
pnpm --filter @saydo/cli verify:distribution
actionlint .github/workflows/*.yml
pnpm typecheck
pnpm lint
node scripts/check-doc-links.mjs
bash scripts/check-emoji.sh
git diff --check
```

若 artifact check 需要现有 ignored 产物，只验证，不改版本或发布状态。最终交付列出改动、每个反例、真实门禁和剩余阻断；不要 commit。
