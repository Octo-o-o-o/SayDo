# RC4 runtime 第二次红灯后的全新 trust-boundary 实施

这是上一实施会话第一次 host readback 返工后再次出现的独立 No-Go。按项目制度，禁止 resume 旧实施会话；禁止读取 `logs/**`、旧 review 报告正文、其他实施 prompt 或旧施工自辩。你是一个全新实施会话，只以本 prompt、`prompts/178-rc4-runtime-second-red-fresh-hostile-implementation.md`、当前工作树代码、canonical 文档与真实测试为输入。

只修改 `~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823`。不要提交、推送、联网，不触碰用户原始 dirty worktree。不得削弱、删除、跳过或反向钉住错误合同。当前 host 虽然已有四文件 323 passed/1 skipped、restart 11 passed、daemon 2069 passed/6 skipped、platform 18 passed/2 skipped，但两路零上下文审查仍确认以下安全缺口；测试全绿不能覆盖它们。

## P1-1：不能以信任所有 native Error 修复第二个 signal

当前 `asProcessGroupLifecycleError` 对任意 native `Error` 复制 own-data `message`，使 `Error("SECRET")` 进入 branded lifecycle message、stack、shared barrier 和 `tier1.process_group_lifecycle_contaminated` audit。native `AggregateError` 还被放进公开、enumerable 的 raw `.cause`，`util.inspect` 可展示 SECRET。

此前需要保留的合法第二叶 `fallback SIGKILL failed` / `kill EPERM` 必须在**可信创建点**转成受控 branded 叶：catch site 知道正在执行哪个 signal/operation、已 trap-free 识别哪个 errno，才能赋受控常量或结构化 code。不得依据不可信 Error message 判断可信；不得扩大到所有 native Error。要求：

- arbitrary native Error、AggregateError、Proxy、revoked Proxy、accessor、primitive、伪造 prototype 的原文不进入 message、stack、audit、supervisor/fatal frame；
- distinct 可信 signal 仍按 first-seen identity/order 全保留，同 origin 去重；business + signals + unreaped 顺序不回归；
- 不把 raw unknown 放入公开/可枚举 `.cause`，内部 origin/identity 用 WeakMap/private side table；`util.inspect`、JSON、stack 均不能看到 raw SECRET；
- `projectUnknownFailure`、`safeFailureText` 与 lifecycle contamination 的安全合同一致。

新增 hostile 至少覆盖 native Error、native AggregateError、raw cause inspect、signal catch、shared barrier、Tier1 audit，断言 exact SECRET 在全部输出为零。

## P1-2：显式 `cause: undefined` 不得丢叶

walker 当前只在 `causeValue !== undefined` 时入栈，导致：

```text
cause:null      => opaque leaf present
cause:undefined => opaque leaf missing
```

必须按 own-property presence 区分“无 cause 属性”和“显式 cause: undefined”。`null`、`undefined`、其他 primitive 均为 opaque 叶，不得被 nullish/truthy 过滤；transparent wrapper 分支同样修复。补普通 Error、Aggregate、transparent wrapper、嵌套/循环组合的 exact leaf 回归。

## P1-3：Windows recovery/killOwnedTree 必须校验 birth identity

当前 win32 路径只看 `jobName` truthy，跳过 `record.processStart` 与 `processBirth(pid)` 对比；`killOwnedTree` 的 Windows 分支也不比 birth。现有测试甚至要求 mismatch 仍 TerminateJob，这与 `docs/adr/ADR-003-os-adapters.md` 和 `docs/09-data-contracts.md` 的 identity-matched 回收合同冲突。

要求：

- Windows 与 POSIX 都在 destructive kill/reap 前比对 expected birth；mismatch、unavailable、Proxy/畸形 identity 均拒绝终止，保留 owner 并 fail-closed；
- 校验 jobName 的类型/格式及与 owner/run 的既有绑定合同，不接受任意 truthy；
- 只有 birth exact match 且 Job identity/状态可证明时才 TerminateJob、audit、删除 owner；
- 把现有 mismatch-仍-kill 的错误测试改成 canonical 合同，不是简单删除；加 PID reuse、same-name Job reuse、owner 污染与 audit failure hostile。

## P1-4：daemon startup/fatal 的 unknown 投影必须 trap-free

`packages/daemon/src/index.ts` 的 Tier1 启动、gate listen、recover/fatal 路径仍有 `String(err)`、`err instanceof Error`、直接 `.message`。revoked Proxy 可在 catch 内再次抛错，普通 Error SECRET 会进入日志、audit 或 supervisor frame，并可能阻止 inactive drain 建立。

要求统一走受控、trap-free、无原文投影；catch 自身绝不再抛；日志、不可变 audit、fatal IPC/supervisor frame 都使用稳定 code/常量，不读 unknown message。补 ordinary Error SECRET、Proxy、revoked Proxy、accessor、function、Symbol/BigInt/primitive 的真实 startup/fatal harness。

## P1-5：Tier1 启动失败 emergency cleanup 必须有独立硬截止

当前 `index.ts` 无限等待 `tier1Executor.emergencyShutdown()`；其内部 `Promise.all(active completion, proc.wait())` 也可永久不 settle。canonical 要求 fatal 清理有独立 hard deadline：到时保留 owner、发受控 fatal、非零退出，不能永久挂住。

实现一个不依赖被清理 Promise 的单调/独立截止控制，处理 late settle/reject 且零 unhandled rejection。deadline 前成功仍完整 drain；deadline 到达不伪报 reaped、不删 owner、不等待后台完成。用永不 settle、deadline 边界竞态、late resolve/reject、fake/real timer 验证有界。

## P1-6：Tier1BinaryIdentityError 必须使用不可变私有快照

当前真实 branded 实例只是 WeakSet 登记，公开字段可被改成 getter/data SECRET；fallback 又直接读 `err.code`，实测 code getter 被调用一次并把 SECRET 返回终态。

要求构造时将受控 code/text 存入 WeakMap/private snapshot，后续分类与 durable failure 只读该快照，不再读可变公开属性；可同时冻结公开字段，但冻结不能替代私有快照。真实实例被重定义 message/code、getter、Proxy/revoked 包裹时必须零 getter、零 SECRET、稳定受控文本。

## P2：多叶 Aggregate projection 必须按 root identity 稳定 intern

同一两叶 AggregateError 连续 `projectUnknownFailure` 当前返回不同容器，虽叶相同但 root identity 不稳定。按 object/root identity intern canonical container；同时保持预算、cycle、origin 去重、raw cause 不公开与 SECRET 安全。

## 必跑门禁

先写/跑上述每个 hostile 的最小回归，再严格串行运行：

```text
pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts test/byoa.test.ts
pnpm --filter @saydo/daemon exec vitest run test/restart-policy.test.ts test/startup-failure.test.ts
pnpm --filter @saydo/daemon test
pnpm --filter @saydo/platform test
pnpm typecheck
pnpm lint
bash scripts/check-emoji.sh
git diff --check
```

不得并行运行任何 daemon Vitest；若系统探针在 Grok workspace sandbox 被拒，停止继续堆叠环境红灯，如实标注并让 host 复验，但所有纯函数 hostile 必须在会话内通过。最终报告列根因、实际文件、每条真实 exit/摘要、未验证项；保持工作树未提交。
