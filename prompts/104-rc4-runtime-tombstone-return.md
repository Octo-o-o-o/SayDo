# RC4 Tier1 tombstone 首轮宿主红灯返工单

## 1. 宿主真实失败

上一轮后宿主环境（非 Grok workspace sandbox）已真实执行：

`pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts --reporter=dot`

退出码 1，115 项中 114 passed、1 failed。唯一失败：

`D1:agent 已退出但终态 marker 未落时，ownership 锚阻止二次 spawn 并保留真实事件行`

实际异常：

`ProcessGroupLifecycleError: tier1 agent ownership record invalid:run_01EXECREC0VERANCH0R000001`

## 2. 根因与合同

`restartPolicy.ts` 当前把 `verifiedOwnedAgent()` 返回 null 且 owner 文件存在的所有情形都当作内容 invalid。
但 null 同时表示两种不同事实：

1. 文件缺失或文件内容/字段不合法；
2. 文件语法与字段完全有效，但受锚定的进程/进程组已经权威退出。

第 1 类必须 fail-closed；第 2 类是 durable tombstone，必须返回 `already_exited`，阻止恢复时二次 spawn，并允许
Tier1 根据已落盘 events 收口。不得删除或弱化已有 Windows 缺 jobName、invalid JSON fail-closed 合同。

建议做最小、可判定的状态拆分：读取 owner 时明确区分 absent / invalid / valid；invalid 立即抛错，valid 继续身份与
存活验证。valid 且权威 gone 时 `verifiedOwnedAgent` 可返回 null，调用方根据 durable owner 存在返回
`already_exited`。不要继续用一个 null 同时代表 invalid 与 already exited。

## 3. 验收

- 新增或保留定向反例同时证明：valid-but-dead owner -> `already_exited`；invalid JSON -> reject；Windows valid owner
  缺 jobName -> reject；不存在 owner 且无 legacy pid -> `absent`。
- 运行上述唯一失败测试与 `restart-policy.test.ts`，均 exit 0。
- daemon typecheck 与 `git diff --check` 均 exit 0。
- 不改其它产品语义，不 commit、push、deploy、改版本或证据。
