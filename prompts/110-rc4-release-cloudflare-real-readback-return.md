# rc.4 发布宿主真实 Cloudflare 回读返工

继续复用当前 release 实施会话和 worktree：

`<repo>`

这是第一次 readback 红灯返工的宿主补充，不是新一轮 review。只修本文列出的真实问题；不提交、不推送、不创建 tag/Release、不部署 Cloudflare，也不要伪造线上成功证据。

## P1：当前 Wrangler JSON 不是 Cloudflare API 原始对象

宿主在固定依赖 `wrangler 4.112.0` 上真实运行：

```sh
wrangler pages project list --json
wrangler pages deployment list --project-name saydo --environment production --json
```

两条均 exit 0，但实际对象键分别是：

```text
Project Name, Project Domains, Git Provider, Last Modified
Id, Environment, Branch, Source, Deployment, Status, Build
```

真实 deployment 例的形状为：

```json
{
  "Id": "<deployment-id>",
  "Environment": "Production",
  "Branch": "main",
  "Source": "6d98a6e",
  "Deployment": "https://<deployment-id>.saydo-3xb.pages.dev"
}
```

因此当前 `post-release-gate.mjs` 把这两条输出交给 `projectPagesDeployment()` / `readProject()` 时，无法得到 `project_name`、40 位 `commit_hash`、`commit_dirty`、`latest_stage`、`canonical_deployment`，真实部署必然失败。并且 project `saydo` 的 canonical host 是 `saydo-3xb.pages.dev`，当前 `parseWranglerDeploymentUrl(output, "saydo")` 假定 `*.saydo.pages.dev` 也错误。升级到 Wrangler 4.125.0 后实测仍是相同展示形状，不能靠升级修复。

## 已验证的可用真相源

同一 Wrangler OAuth Bearer token 调用 Cloudflare v4 REST API，以下只读请求均真实返回 HTTP 200 / `success=true`：

```text
GET /client/v4/accounts/<account>/pages/projects/saydo
GET /client/v4/accounts/<account>/pages/projects/saydo/deployments?env=production&per_page=2
```

项目对象包含 `name`、`domains`、`canonical_deployment.id/url`；deployment 对象包含完整的 `id/project_name/environment/url/deployment_trigger.metadata.branch/commit_hash/commit_dirty/latest_stage.status`。真实 `commit_hash` 为 40 位，`latest_stage.status=success`。

## 必须实施

1. Wrangler 只负责 `pages deploy`；部署身份与 project 生产指针一律改由 Cloudflare v4 REST API 回读，不再把 Wrangler 展示 JSON 冒充原始 API 对象。
2. REST 客户端必须显式接收 account id 与 Bearer token（建议 `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`），启动前验证存在；token 不得进入日志、错误、证据、argv、文件或测试快照。不得在仓库中读取或提交本机 token。
3. 完整验证 HTTP status、顶层 `success`、`errors`、结果类型与分页；project 必须精确等于 `saydo` / `saydo-link`，deployment 必须唯一匹配本次 Wrangler 输出 URL、environment、branch、40 位 `publicMain`、`commit_dirty=false`、`latest_stage.status=success`。
4. URL 归属必须绑定 project readback 的 canonical `pages.dev` host（例如 `saydo-3xb.pages.dev`），不得假定 canonical host 等于 project 名；同时保留错误 project/错误 canonical host/多个 URL 的拒绝测试。
5. production 后再次读取 project，证明 `canonical_deployment.id`（或 API 当前等价的生产指针）精确等于本次 deployment id，并证明全部官方域名属于对应 project。
6. 为 Cloudflare REST client 加生产形状 fixture：API error、分页、错误项目、错误 host、错误 SHA、dirty、非 success、旧 production pointer 都必须 fail-closed。再加一个真实 Wrangler 4.112 展示 JSON fixture，证明它不能被当作 API 原始对象接受。
7. 删除 `deploySites()` 对象字面量中重复的 `fetchHttp` 键，只保留会返回真实 body 的实现。
8. `docs/07-tech-stack-decisions.md` 的当前包说明仍写 `rc.2 包只含...`，改成不会随候选版本过期的“当前预发布包只含...”，保持最小 diff。
9. 不改变 preview→production 顺序、持久化状态机、availability 回滚、GitHub Release/规则集合同，也不运行真实部署。

## 宿主门禁

至少运行并报告退出码：

```sh
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
node scripts/week-audit.mjs --write
node scripts/week-audit.mjs --check
node scripts/build-release-artifacts.mjs --check
actionlint .github/workflows/ci.yml .github/workflows/release.yml
pnpm lint
pnpm typecheck
bash scripts/check-emoji.sh
git diff --check
```

`week-audit --check-bundle` 只能在剔除 `artifacts/release/copyright/` 的公开快照树运行；不要在 internal worktree 把它的预期拒绝误报成发布通过或实现失败。最终公开 bundle 会由主会话在稳定 commit 后单独构造并实跑。
