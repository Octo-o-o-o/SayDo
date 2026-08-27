# RC4 运行时新实施会话第一次 readback 返工

你是本轮全新实施会话 `01a031e4-86b2-72f0-9fca-55c7dfdadea2`。这是该会话施工后的第一次 host readback 红灯，按制度必须在同一会话内修复。继续只修改当前工作树，不提交、不推送，不改验收目标，不削弱或跳过测试。

## 真实 host 结果

在确认没有其他 vitest/daemon 测试进程后，host 严格串行运行：

```text
pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts test/byoa.test.ts
```

结果：exit 1；4 个文件中 3 个通过、1 个失败；323 项中 315 passed、1 skipped、7 failed。`process-group-lifecycle` 29/29、`byoa` 77/77、`runtime-child-registry` 67 项仅 1 skipped，失败全部位于 `tier1-executor`。

7 个稳定失败均表明第二个合法、distinct 的 lifecycle signal 或合法 EPERM failure 被投影成：

```text
process group error graph contained a hostile value
```

而期望保留的叶分别是：

```text
fallback SIGKILL failed
kill EPERM
```

失败用例：

1. `real-agent two distinct signals 保真去重`
2. `real-agent business+two signals+unreaped 四叶顺序`
3. `real-agent business+two signals 无 unreaped`
4. `managed two distinct signals 保真`
5. `managed business+two signals+unreaped 四叶`
6. `managed business+two signals 无 unreaped`
7. `timeout 路径 killProcess EPERM 污染 lifecycle 不得假 blocked`

请重点审计 `appendLifecycleFailure`、`asProcessGroupLifecycleError`、`walkErrorGraph`、`projectNode`、identity/intern/WeakSet brand 以及共享 `GraphBudget` 的相互作用。必须同时满足：

- 本模块自己创建并已 brand 的每个 distinct `ProcessGroupLifecycleError` 按 first-seen identity 和顺序保留，不把第二个合法叶误判为 hostile；
- 同一对象仍去重；
- Proxy、revoked Proxy、accessor、primitive、伪造 prototype/native Error SECRET 仍不得触发 trap 或泄漏原文；
- 顶层输入与深图预算仍严格有界；
- 不靠改期望、删除用例或扩大信任面修绿。

## 必须执行的门禁

先定向修复并串行运行上面的四文件命令，必须 0 failed。然后至少串行运行：

```text
pnpm --filter @saydo/daemon exec vitest run test/restart-policy.test.ts
pnpm --filter @saydo/daemon test
pnpm --filter @saydo/platform test
pnpm typecheck
pnpm lint
bash scripts/check-emoji.sh
git diff --check
```

任何门禁失败都必须继续诊断，不得把红灯描述为完成。最终报告列出根因、实际修改文件、每条命令的真实 exit/摘要，并保持工作树未提交。
