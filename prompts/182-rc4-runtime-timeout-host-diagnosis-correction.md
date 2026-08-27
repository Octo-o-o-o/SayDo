# RC4 runtime timeout：宿主诊断纠偏

继续会话 `01a03177-ea3a-7262-b246-3d0299c2004e`，不要再开新实施会话。不要读取 `logs/` 或其他
会话输出；只读本文件和当前代码。此前为诊断临时加进测试的 `DEBUG`/`console.error` 已由宿主移除，
不要恢复。不要提交、推送、联网或修改用户原始 dirty worktree。

## 已确定的真实根因

宿主诊断输出已证明：

```text
hanging=2 spawnCount=2 timers=[300000] now=0
fire 后 timers=[305000] now=300000
```

因此 timeout timer 确实已注册并触发，300000ms timeout latch 不是“没 fire”。红灯来自测试夹具使用假的
POSIX PID `72002`，却没有注入 `killProcess`：

- 当前强化实现只忽略 own-data `code=ESRCH`；
- macOS 对 `process.kill(-72002, "SIGTERM")` 可返回 EPERM；
- EPERM 必须是 lifecycle/ownership failure，不能降格为 timeout business failure；
- 旧 HEAD 吞掉所有 POSIX kill 错误的行为本来就是缺陷，不能为了旧测试恢复。

## 禁止方向

- 绝对禁止在生产 `signalRuntimeChildTree()` / `throwUnlessEsrch()` 中忽略 EPERM。
- 绝对禁止把 EPERM 当普通 timeout、exit 或 pipe business failure。
- 不要为了本测试改 `finalizeInvocationWait()` 或 `settleWithLeaseRelease()`，除非另有独立生产反例证明
  它们确实错误；本红灯已有明确夹具根因。

## 正确修复

- 在 `timeout + 捕获 TERM 后 exit 0 仍失败` 这个测试夹具里显式注入 signal 成功的
  `killProcess` hook，并记录收到的 signal；不要调用宿主真实 PID/PGID。
- TERM 后仍由测试 emit exit0/close0，生产 timeout latch 必须使 setup 结果非零或受控 business failure，
  task 最终 `blocked`。
- 补 exact 断言：signal 至少含预期 TERM；agent spawner 的 spawn 数为 0；task=`blocked`；
  `lifecycleContamination() === null`；不得只等待更久或放宽状态集合。
- 另保留/补一个独立 hostile 测试：`killProcess` 抛 own-data `code=EPERM` 时必须污染 lifecycle、task 不得
  假装 blocked business failure、后续 spawn 被 barrier 拒绝。这样可证明测试 hook 没削弱生产合同。
- 移除所有诊断日志和临时等待。不要修改测试标题、延长主断言超时或删除任何既有断言。
- prompt 180 四项修复必须原样保留。

## 门禁

先运行单项 timeout 测试和 EPERM hostile 测试；再运行四文件聚焦、daemon 全量、daemon typecheck、根
lint、emoji、`git diff --check`。沙箱 `/bin/ps` 限制必须如实报告，宿主会复跑。不要生成 commit。
