# rc.4 发布新实施会话第一次独立复审返工

你必须 resume 同一 Grok 实施会话 `<session-id>`，继续在：

`<repo>`

当前代码提交：

`e22be466b206002fd5ab270d41471f7cbc72bc5e fix(release): 闭合审计终态与凭证回读`

这是该全新实施会话完成后的第一次零上下文独立复审红灯，按仓库规则退回同一会话。先完整重读
`prompts/112-rc4-release-second-red-new-session.md`、当前代码、测试和本文件。不要读取旧 Grok 日志或
用旧自报代替实现判断。不提交、不推送、不 tag、不发布、不部署；不得运行会写 Cloudflare/GitHub 的命令。

独立复审结论为 No-Go：P1 两项、P2 一项。三项都须用恶意/跨调用直接反例闭合。

## P1-1：audit 非终态必须可恢复，且绝不重部署

当前首轮已保证 audit 前耐久态为 `audit_pending`，但 `existingEvidence` 一律拒绝。真实反例：

```json
{
  "firstIsAggregate": true,
  "firstPersistFailed": true,
  "lastDurableStatus": "audit_pending",
  "retryError": "既有部署证据 status=audit_pending，拒绝盲目覆盖部分部署事实",
  "retryAuditCalls": 0,
  "retryExternalCalls": 0
}
```

必须实现一个明确的 audit-only recovery 状态机：

- 只允许 `existingEvidence.status` 为 `audit_pending` 或 `audit_failed` 进入恢复；`started`、deploying、
  `partial_failed`、畸形、未知和 `completed` 继续 fail-closed，不得盲目覆盖或重新部署。
- existing evidence 是不可信输入。精确验证 schema/version、release/publicMain/publicCi 与当前 seed、
  两站 project/directory/planned branch exact-set、preview/production 已验证 identity、deployment id/url、
  environment、branch、commit=`publicMain`、dirty=false、success stage、completedSites exact-set；不得只看 status。
- 恢复时 `wrangler` 调用必须恒为 0；不得重新 preview/production deploy。使用只读 API 重新列出并唯一绑定
  两站既有 preview 与 production deployment，重读 canonical project/domain ownership，逐个读取既有部署 URL、
  全部正式域名及 availability marker。任何漂移都 fail-closed 并保留既有 evidence。
- 所有 readback 全匹配后先耐久化新的 `audit_pending` 快照，再运行 audit；audit 成功后才持久化
  `completed`。audit 失败写 `audit_failed` 并让当前调用失败。
- audit_failed persist 首次失败 emergency retry；持续失败聚合 audit 原错与两次 persist 错，最后耐久态
  仍非 completed。completed persist 失败保留 audit_pending，下一次调用可重新 readback+audit 后完成。
- 增加三种真实跨调用反例：既有 `audit_pending`、既有 `audit_failed`、completed persist failed 后的
  `audit_pending`；修复持久层后恢复均零 redeploy、重读外部事实、最终 completed。再补 seed/site/deployment/域名/
  HTTP marker 任一漂移拒绝，断言 audit=0、wrangler=0、原 evidence 不被覆盖。

## P1-2：Cloudflare 任意恶意异常都不能绕过脱敏

当前有三个已实证逃逸边界：

1. URL/query 构造前的 `JSON.stringify(query)` 位于统一 try 外；getter/Proxy 可抛含 token 的错误。
2. catch 中直接读 `error.message` 或 `String(error)`；恶意 getter/toString 可二次抛出含 token 的错误。
3. 导出的 `assertCloudflareApiEnvelope()` 把 `errors[].message` 原文写进异常。

真实反例均出现 `leakedExactToken=true` 与 `leakedBearer=true`。

必须实现：

- 从 path/query 检查、URL/URLSearchParams 构造、fetch、body 读取、JSON parse、envelope 校验到最终错误转换，
  全部进入同一不抛脱敏边界；try 外不得触碰不可信 getter、iterator、toString 或 JSON 序列化。
- 新建 `safeErrorText`（或等价 helper）只接受最终安全字符串；对 message getter、toString、Proxy、自定义
  primitive 转换再次抛错时返回常量错误，绝不能继续解释/拼接那个异常对象。
- `redactSecrets` 自身不得对不可信对象调用 `String()`；只处理已经确认的 primitive string。
- envelope 的错误不得回显 Cloudflare body 中的 `errors[].message`、result 或原 body。导出 helper 若保留，
  对 arbitrary object/Proxy 也只能产生常量/可信字段错误，不得泄漏 payload 文本。
- 增加 query getter/Proxy、URL value toString、fetch 非 Error、message getter、恶意 toString、body reader、
  JSON/envelope errors Bearer 等直接反例；逐例断言裸 token、Bearer token、原 body 片段均不出现在异常。
- 普通 HTTP status、success=false、missing/non-array/nonempty errors、result shape 仍 fail-closed；既有真实
  Cloudflare REST readback不能回退。

## P2：计划文档同步新终态顺序

最小修改 `docs/plan/2026-08-22-week-audit-faststart-release.fable.md` 的部署顺序：

- 两站 production + 正式域名全绿后写 `audit_pending`，不是 `completed`；
- audit refresh 成功后才写 `completed`；失败写 `audit_failed`；
- 明确 `audit_pending/audit_failed` 只读恢复、零 redeploy，其余部分部署状态继续 fail-closed。

不要重排或重写整份计划；只修这段合同。后续最终边界仍由宿主统一重生七个 audit 输出。

## 验收门禁

先逐个运行新增直接反例，再真实运行：

```sh
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.4
node scripts/build-release-artifacts.mjs --check
pnpm typecheck
pnpm lint
actionlint .github/workflows/*.yml
node scripts/check-doc-links.mjs
bash scripts/check-emoji.sh
git diff --check
```

不得为过测试删除外部 readback、放宽 existing evidence shape、重部署、回显 untrusted body、吞 audit/persist 错误，
或提前重生/宣告最终 audit evidence。交付只列实际改动与真实命令/退出码；宿主会再做干净 worktree 独立验收。
