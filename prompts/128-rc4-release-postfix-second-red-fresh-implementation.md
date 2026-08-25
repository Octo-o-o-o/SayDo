# RC4 发布线第二次红灯：全新实施会话修复单

你是实施者。仓库：`<repo>`；分支：`codex/rc4-release-second-red-rebuild`；精确基线提交：`704048f2ca026a03edf40b0932153fdacb256daa`。

这是同一发布线独立 readback 的第二次红灯。必须作为全新实施会话处理，不继承或辩护旧实现。只修改本修复单直接需要的发布脚本、测试和既有 canonical 计划/周审计生成物；不要碰 daemon、mobile、真实 Cloudflare/GitHub、远端、tag、release 或部署。不得 commit/push。使用 `apply_patch` 修改。

## 三项 P1（必须全部关闭）

1. 证据路径 TOCTOU / 双重部署：当前 `lstat(ENOENT)` 不是原子 fresh claim；两个并发 caller 都可部署（Wrangler 共 8 次）。`lstat` 后可把路径换成 symlink，随后 read 会跟随、rename 会覆盖。入口必须在任何 Cloudflare readback、Wrangler、persist/audit 外部动作前，对本次发布取得原子且可验证的独占 claim/lease。任何已存在目录项都不能被 fresh claim 覆盖；并发第二 caller 必须在外部动作前失败。既有恢复证据读取必须通过不跟随 symlink 的稳定对象完成，不能有 lstat→read 跟随竞态。持久化不能在 lstat→rename 窗口把后来出现的 symlink/目录/非普通目录项覆盖为普通文件。崩溃/未知状态必须 fail-closed，不能靠删除证据重试。

2. Cloudflare 不可信 result 污染耐久证据：deployment `id` 只校验非空；project `domains` 整体复制。合法 200 envelope 内构造 `Bearer <sentinel>` 的 id、额外恶意 domain，再令 audit 失败，可泄漏到 `audit_failed` evidence/stdout。必须做严格、有界、深层 schema 投影：deployment id 采用与实际 Cloudflare Pages 合同兼容的安全字符/长度验证（不要把未经证实的 Workers UUID 合同硬套到 Pages；可用官方 Pages 最大长度和仓库真实 fixture 设计），project 只持久化本地 expected exact-set 验证过的 canonical/official hosts，绝不复制额外 raw domains；任何 Cloudflare result/getter/Proxy/body/message/sentinel 均不得进入 Error、stdout 或耐久 evidence。`canonicalHost` 等 result 派生值也不得拼入错误文本。persist 边界在 JSON 序列化/输出前须对完整 evidence 做合同验证与 secret/sentinel fail-closed，而非只靠字符串替换。

3. 强制 bundle 门禁：最终必须让 `node scripts/week-audit.mjs --check` 与 `node scripts/week-audit.mjs --check-bundle` 在本 worktree 对本轮内容同时退出 0。按既有生成流程刷新需要的 canonical 周审计生成物，不手工伪造 digest，不新建重复 review 文档。

## 必须增加的反例

- 两个 caller 在同一缺失 evidence 路径并发，只有一个能取得 claim；总 Wrangler 调用不得超过一次完整发布（4 次），失败 caller 的 Wrangler/persist/audit 均为 0。
- fresh claim 前路径是 dangling/valid symlink、目录、FIFO/非普通文件：外部动作全为 0，目录项不被覆盖。
- 在旧实现的 `lstat→read` 与 `lstat→rename` 交错点替换成 symlink：不得读取 target、不得覆盖 symlink、不得部署；应使用真实 fs 反例，不只 mock 一个永远不变的 stat。
- `audit_pending`/`audit_failed` 正常恢复仍为 Wrangler 0，完整 project/deployment/HTTP readback，顺序 `audit_pending → audit → completed`；completed persist 失败不得倒退为已完成假象。
- 合法 Cloudflare v4 envelope 中，selected deployment id、canonical id、project domains 分别含 `Bearer <unique-token>`、唯一 body/id/domain fragment、getter/Proxy/toJSON 变形；无论 fresh/recovery/audit 失败，抛错文本、stdout、所有落盘 evidence、returned object 均不得含这些字符串。异常输入必须在第一次不可信值耐久化前 fail-closed。
- 普通合法 Pages id fixture 仍通过；malformed id（空、超长、空白、控制符、URL/token-like）拒绝且错误只用常量。
- project domains 必须先 exact-set 验证 expected official + canonical；返回投影只能包含可信 expected host 列表，raw extra domain 不得持久化。

## 验收门禁

至少运行并记录真实退出码：

```sh
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
node scripts/post-release-gate.mjs --check-candidate v0.1.0-rc.4
node scripts/week-audit.mjs --check
node scripts/week-audit.mjs --check-bundle
pnpm typecheck
pnpm lint
pnpm exec actionlint
bash scripts/check-doc-links.sh
bash scripts/check-emoji.sh
git diff --check 704048f2ca026a03edf40b0932153fdacb256daa --
```

按现有脚本实际名称调整 physical evidence 自测命令，但不得运行 daemon Vitest、`pnpm test` 或 `just ci`。若 bundle refresh 必须写生成物，先确认生成命令成功，再复跑两个 check。最后给出：改动文件 exact-set、每个门禁原始摘要与退出码、残余风险；不 commit。
