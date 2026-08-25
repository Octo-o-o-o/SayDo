# RC4 发布线第三次主会话 readback 退回：Proxy 稳定错误

你是原发布实施会话。只在当前 worktree 修复，不提交、不推送、不部署，不改无关文件；禁止 subagent。

上一轮主体已通过，但主会话等价反例仍得到：

```text
accessorError="既有部署证据非法"
proxyDescriptorError="既有部署证据非法"
revokedProxyError="Cannot perform 'IsArray' on a proxy that has been revoked"
```

根因是 `assertRecordObject` 直接调用 `Array.isArray(value)`；revoked Proxy 会抛原生错误。此前 prompt 147 明确要求 descriptor/Proxy 反射异常只抛稳定常量，不携带攻击者文本。

## 验收目标

1. `assertRecordObject` 对 revoked Proxy、会抛的 Proxy/反射对象统一抛调用方指定的稳定合同错误（默认 `既有部署证据非法`），不得透传引擎错误。
2. 审计 `readOwnData` catch 中对 `caught instanceof Error` / `.message` 的再次反射风险。Proxy trap 若抛出 revoked Proxy 或带恶意 message/getter 的对象，也必须稳定收敛，不执行其 getter、不泄漏正文。
3. durable evidence 根、release/publicCi/site/planned/stage/deployment/assets/productionChecks/productionProjects/error，以及 Cloudflare deployment/project readback 的 revoked/throwing Proxy 反例都至少覆盖其公共入口；错误类别按入口保持既有稳定常量。
4. 未知 root/release/site getter 与未知 `toJSON` 的计数必须分别为 0；测试本身不得用 spread/JSON 序列化被测原对象而误触 getter。
5. 不回退上一轮 own-data-only 白名单、partial-write、close fail-closed、inode lease 与脱敏错误。

逐条重跑并记录：

```text
node scripts/test-release-provenance.mjs
node scripts/test-release-physical-evidence.mjs
pnpm typecheck
pnpm lint
node scripts/check-emoji.mjs
git diff --check 704048f2ca026a03edf40b0932153fdacb256daa --
```

完成后只报告改动文件、对抗用例计数与真实退出码；不要宣称发布完成。
