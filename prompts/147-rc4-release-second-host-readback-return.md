# RC4 发布线第二次主会话 readback 退回

你是原发布实施会话。只在当前 worktree 修复，不提交、不推送、不部署，不改无关文件。继续遵守原计划、仓库 AGENTS.md 与本会话既有约束；禁止 subagent。

## 本轮可判定验收目标

### R1 不可信证据必须是真正的字段白名单投影

当前 `projectDurableEvidence` 及所有子 projector 先调用 `jsonSnapshot(value) = JSON.parse(JSON.stringify(value))`。这会在投影前遍历未知字段，并执行未知字段 getter / `toJSON`，与此前“从可信字段逐字段重建、未知字段不得触碰”的验收目标冲突。

主会话刚刚实测得到：

```text
{"projectionOk":true,"rootGetter":1,"releaseGetter":1,"siteGetter":2}
{"unknownToJsonCalls":1}
```

要求：

1. 删除 durable evidence、release、public CI、site/stage/deployment、production check/project/error 等白名单投影路径中的整对象 JSON snapshot。
2. 只读取合同列出的已知字段；不得枚举、rest-copy 或序列化原始对象。优先用 own data-property descriptor 读取字段，拒绝 accessor/inherited 值，且所有反射异常只抛稳定常量错误，不携带攻击者文本。
3. 未知根字段、未知嵌套字段及其 getter / `toJSON` 必须完全不被调用；返回对象与落盘 JSON 均不得保留未知字段。
4. 对允许字段上的 accessor、会抛错的 descriptor/Proxy、循环对象、恶意 `toJSON` 增加对抗测试：不得泄漏唯一片段、token、对象正文或原始 stack/message；不得执行未知 getter/`toJSON`。
5. Cloudflare API readback 的 projector 同样不得先整对象 JSON 序列化；只读取实际合同需要的字段。

### R2 关闭失败也必须 fail-closed

当前 `replaceRegularFileInPlace` 在 truncate/write/fsync 成功后无条件吞掉 `close` 错误。主会话实测：

```text
{"closeFailureAccepted":true,"fileAfterCloseFailure":"after"}
```

要求：

1. 若此前没有更早错误，`close` 失败必须让调用者收到稳定的“部署证据写入失败”，不得报告持久化成功。
2. 若此前已有写入/fsync 错误，仍需尝试关闭，但不得用原始 close 错覆盖或泄漏；保持稳定 fail-closed 错误。
3. 增加成功关闭、关闭失败、写入失败且关闭也失败三类确定性测试。
4. 保留现有 inode 租约、O_NOFOLLOW、partial-write 循环与 zero-progress 拒绝语义。

## 必跑门禁

逐条运行并记录真实退出码与摘要：

```text
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
node scripts/week-audit.mjs --check
node scripts/week-audit.mjs --check-bundle
node scripts/check-emoji.mjs
pnpm typecheck
pnpm lint
git diff --check 704048f2ca026a03edf40b0932153fdacb256daa --
```

另外新增并执行一条等价的对抗测试，证明 unknown root/release/site getter 计数均为 0，unknown `toJSON` 计数为 0，close failure 被拒绝。完成后只报告改动文件、关键设计、逐条门禁退出码、剩余风险；不要宣称发布完成。
