# RC4 发布事务第二次红灯：新会话返工

## 1. 身份与边界

你是全新的实施会话。前一发布实施会话已经因同一轮第二次独立复审红灯被弃用；不得 resume，不得替旧实现辩护。

- 仓库：`<repo>`
- 基线提交：`3bafd53cf44e051bdc8ca5d2858d48823d71a6e4`
- 只实施本提示列出的发布事务、Cloudflare API 回读和相应机械测试；不得 push、tag、Release、部署、改线上、改真实凭证或改公开仓。
- 不提交 Git；调度方在宿主复核后提交。
- 不使用 subagent；无需联网。
- 保持全仓零 emoji，中文注释和测试名，最小聚焦 diff。

## 2. 已确认的第二轮 findings

### F1：`completed` 早于 audit 成功耐久化

`scripts/release-pages-deploy.mjs` 当前先把 `status=completed` 持久化，随后才运行 `audit()`。若 audit 失败且 `audit_failed` 持久化也失败，最后耐久状态仍会伪称 completed。

必须改成可恢复状态机：

1. 全部生产 readback 成功后先写非终态 `audit_pending`，且该状态持久化成功后才运行 audit。
2. audit 成功后才允许把状态改为 `completed` 并持久化；任何已耐久 snapshot 在 audit 返回成功前都不得出现 completed。
3. audit 失败时写 `audit_failed`；首次持久化失败必须做一次明确的 emergency retry。若持续失败，抛出同时保留 audit 原错与 persist 错的聚合错误，标记 `persistFailed=true`，最后已知耐久状态只能是 `audit_pending` 或更早的非成功态。
4. `audit_pending` 持久化失败时不得运行 audit；completed 持久化失败时抛 `persistFailed`，最后已知耐久状态保持 `audit_pending`。
5. 不把 partial failure、外部成功后的 persist 失败、existing evidence 拒覆盖等既有闭包降级。

必须新增机械反例，至少覆盖：audit_pending 正常落盘顺序、audit_pending persist 失败、audit 抛错且 audit_failed 首次 persist 失败后 retry 成功、audit 抛错且 audit_failed 持续 persist 失败、audit 成功但 completed persist 失败、audit 调用前的耐久快照绝无 completed。

### F2：Cloudflare 响应读取异常可能泄漏 token

`scripts/release-cloudflare-pages.mjs` 的 `response.text()` 位于 redaction 边界外。必须把 fetch、body 读取、JSON 解析、envelope 校验统一放入 secret-redacting 异常边界：

- 任何错误消息不得包含裸 `CLOUDFLARE_API_TOKEN`、`Bearer <token>` 或 token 自身。
- 不把完整响应 body 写入错误、日志或证据。
- 原始错误可作为 cause 保留，但 cause/message 同样不能暴露凭证；若无法保证则不要附原始对象。
- 增加 `fetchImpl` 抛错、`response.text()` 抛裸 token、抛 `Bearer token`、畸形 JSON、API error message 含 token 的反例。

### F3：Cloudflare v4 envelope 未 fail-closed

`assertCloudflareApiEnvelope` 必须强制：

- payload 是非数组对象；
- HTTP 200；`success === true`；
- `errors` 字段必须存在、必须是数组、必须为空；缺失、对象、字符串、非空数组全部拒绝；
- `result` 仍按 `expectArray` 严格区分数组/对象。

补齐上述每种畸形 envelope 的反例，确保 `{success:true, errors:{...}, result:{...}}` 不再被接受。

### F4：最终 audit bundle 仍需重建

基线提交中的 week-audit 7 个输出与稳定树漂移，真正过滤公开树的 `--check-bundle` 会失败。这不是让你手工篡改 manifest：

- 先确认 `node scripts/week-audit.mjs --write` 能从当前树重新生成全部 canonical audit 输出，再让 `--check` 通过。
- 用临时 index 精确排除 `artifacts/release/copyright/`，创建全新过滤公开树，在该树中运行 `node scripts/week-audit.mjs --check-bundle`，并确认私有路径为 0、工作树 clean、publication manifest 覆盖 trusted physical tools 的 13 文件闭包。
- 这些生成文件属于最终 evidence 边界；可以在工作树生成供验证，但不得用手改摘要绕过漂移，也不要提交。

## 3. 验收标准与门禁

实施前先读相关实现和现有测试。完成后按下列顺序真实运行并报告原始摘要与退出码：

1. `pnpm install --offline --frozen-lockfile`
2. `node scripts/test-release-provenance.mjs`
3. `node scripts/test-release-physical.mjs`
4. `node scripts/check-release-candidate.mjs`
5. `node scripts/check-release-artifact.mjs --check`
6. `node scripts/week-audit.mjs --write`，随后 `node scripts/week-audit.mjs --check`
7. 在全新过滤公开树运行 `node scripts/week-audit.mjs --check-bundle`，并程序化核对 exact-set 与 13 项实体闭包
8. `pnpm lint && pnpm typecheck`
9. `bash scripts/check-emoji.sh`
10. `git diff --check`

额外程序化扫描：

- 测试源码中必须出现 `audit_pending`、持续 audit persist failure、`response.text()` 抛 token、缺失/对象/非空 `errors` 的反例。
- 发布实现中不得出现任何真实 token、账户 ID、私网 IP 或本机绝对路径。
- 最终列出所有改动文件；明确区分代码/测试修改与 `--write` 生成的 evidence 文件。

若任一门禁失败，停下来诊断；不得把 sandbox 的权限限制包装成通过，不得伪造退出码或结果。
