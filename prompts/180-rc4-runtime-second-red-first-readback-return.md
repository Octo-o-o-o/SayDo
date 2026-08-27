# RC4 runtime 第二次红灯新会话：第一次独立 readback 返工

继续当前实施会话 `01a030e9-9245-7e22-97bf-9702863c4df7`，不要新开实施会话。不要读取
任何 `logs/`、旧评审报告或其他会话解释；只以本文件、`prompts/178-rc4-runtime-second-red-fresh-hostile-implementation.md`
和当前代码为输入。不要提交、推送、联网或改动用户原始 dirty worktree，只在本文件所在 worktree 施工。

宿主机已真实跑绿聚焦测试和 daemon 全量测试，但独立 zero-context hostile readback 稳定复现以下四个
P1。必须全部关闭，并把每个复现固化成精确回归；常规绿灯不能替代这些 hostile 验收。

## 1. pipe Error 原文仍会泄漏

当前 `inspectUntrustedPipeFailure()` 对 own-data `code="EIO"` 的原生 `Error("SECRET")`：

- `projected` 仍是原始 Error identity；
- `diagnostic.message` 读取原始 `message`；
- `execRuntimeChild` 最终 Error 的 message/stack 与 Tier1 diagnostic 均可出现 `SECRET`。

修复要求：

- pipe 专用 canonical projection 对所有 object/function 按原始 identity 稳定 intern，但投影的
  `message`、`stack`、`name` 等可观察文本必须完全受控；不得返回或包裹原始 Error，也不得把原始
  `message`/`stack`/`cause` 带入投影。
- primitive/null/undefined 使用受控 opaque pipe projection；不得与 object/function identity 合并。
- 只允许以 trap-free own-data 方式提取白名单 Node errno `code`；即使 code 可信，诊断 message 也只能是
  固定受控文本，不得读取原始 message。
- plain object、Error、accessor、function、原型链含 Proxy、non-revoked/revoked Proxy 的 getter、
  `toString`、`valueOf`、`ownKeys`、`getPrototypeOf` trap 次数均为 0。
- 在 helper、`execRuntimeChild`、Tier1/readline 和 BYOA 真实 listener/final result 上断言：
  `SECRET` 不进入 message、stack、日志、stderrTail 或最终 diagnostic；同 identity 重复只消费一次，
  不同 object identity 不合并。
- 不得改变全局 `projectUnknownFailure()` 对 raw Error/wrapper 的既有 first-seen/canonical 合同；pipe
  sanitization 应与通用 error graph 语义分离。

## 2. 第二个 distinct pipe failure 被 `??=` 吞掉

`execRuntimeChild` 当前只锁存第一个 `pipeError`，第二个不同 identity 的 pipe failure 不再出现在当前调用
结果中，违反 prompt 178 的 distinct identity 次数/顺序合同。

修复要求：

- 当前调用按 first-seen identity 保存每个 distinct pipe failure；同一 identity 从 stream/readline
  重复 emit 只记一次，两个不同 identity 必须都可从最终受控结果机械观察，顺序固定。
- 不得仅按 code/message 去重；不同 Error 即使同 code 也要保留，primitive opaque 按既有明确合同处理。
- 结果可以采用有序受控诊断/业务失败聚合，但不得把普通 pipe business failure 误标成进程组未回收，
  也不得重新引入原始对象文本。
- 至少增加 first/second distinct、same identity duplicate、同 code 不同 identity、跨 stdout/stderr，以及
  其中一个为 revoked Proxy 的 exact 回归；禁止 `>= 1` 之类弱断言。

## 3. work=`undefined` + signal failure 丢掉 opaque work 叶

`execRuntimeChild.rejectIfSignaled(workError?: unknown)` 用 `workError !== undefined` 判断“是否有 work”，
导致 lease establish/work 真正以 `undefined` reject 且 signal 同时失败时，只剩 signal 叶。

修复要求：

- 用显式 presence bit 或不可碰撞的内部 sentinel 区分“没有 work 参数”和“work rejection 恰好为
  undefined”；不得再用 nullish/value equality 判存在性。
- exact hostile 回归必须得到两叶：第一叶是 `OPAQUE_ERROR_GRAPH_VALUE`，第二叶是 `signal-first`，顺序
  work-first；不得只断言 contains。
- 同时复核 null、其他 primitive、work-only undefined、signal-only、同 identity 去重和两个 distinct
  signal failure，不能回归 prompt 178 已建立的 exact 合同。

## 4. Windows assignPidToJob revoked Proxy 绕过回滚

`spawnRuntimeChildImpl()` 外层 catch 对未知 `err` 直接执行
`err instanceof ProcessGroupLifecycleError`。当 `assignPidToJob` 抛 revoked Proxy 时，该检查先抛
`TypeError`，`rollbackAndThrow()` 没有执行，wrapper 未杀、Job 未关闭。

修复要求：

- unknown 路径不得直接使用 `instanceof`；在任何 Proxy 判别之前不得触发其 trap。
- 同步清扫 `packages/daemon/src/tier1/executor.ts` 中三个对不可信 catch 值直接执行
  `Tier1BinaryIdentityError instanceof` 的相邻路径（独立 readback 定位在约 2070、3938、4352 行）；
  revoked/non-revoked Proxy 同样必须 trap-free 且进入受控失败，而不是二次 `TypeError`。
- 必须可靠区分“本调用已经启动 rollback 后抛出的错误”和“尚未 rollback 的 assign/close 错误”，避免
  重复回滚，同时不依赖读取不可信错误。
- revoked/non-revoked Proxy、accessor、primitive、普通 Error 均不得产生意外 `TypeError`；wrapper 精确
  收口、Job 精确关闭、owner/registry 无残留，且最终错误形状受控、无 `SECRET`。
- 保留普通 `assign fail` 的现有行为和 Windows/POSIX ownership/barrier 合同。

## 必跑门禁

1. 上述四组新增 hostile 聚焦测试；
2. `pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts test/byoa.test.ts`；
3. `pnpm --filter @saydo/daemon test`；
4. `pnpm --filter @saydo/daemon typecheck`；
5. 根 `pnpm lint`、`bash scripts/check-emoji.sh`、`git diff --check`。

若 workspace sandbox 的 `/bin/ps` 限制导致测试红灯，必须原样报告并列出宿主复跑命令，不得把它写成
通过。结束前清理你自己的测试进程组与 ignored 临时根；不要改历史文档或生成提交。
