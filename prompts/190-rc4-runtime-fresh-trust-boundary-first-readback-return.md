# RC4 runtime 全新 trust-boundary 实施第一次 readback 返工

继续同一 Grok 实施会话 `01a0323b-5f8f-7f43-9997-7e386c52a622`。这是该全新实施会话的第一次零上下文 readback 红灯，必须在原会话内返工；不要另起会话，不要提交、推送、联网，不触碰用户原始 dirty worktree。只修改 `~/WorkSpace/SayDo-rc4-runtime-recovery-rebuild-20260823`。

当前 host 已真实通过四文件 326 passed/1 skipped、restart+startup 17 passed、daemon 全量 2079 passed/6 skipped、platform 24 passed/2 skipped、typecheck、lint、emoji 与 diff 门禁，但两路独立审查仍复现以下 7 类缺口。测试全绿不等于合同闭合；不得删除、skip、弱化断言或把错误行为反向钉成正确。

## P1-1：Windows Job、run 与 PID membership 必须形成同一 identity

当前 Job 名由 `ownerInstanceId-commandToken` 生成，owner 恢复只做 `jobName.includes(ownerInstanceId)`，缺 ownerInstanceId 时甚至接受任意格式合法 Job；这与 `docs/adr/ADR-003-os-adapters.md` 规定的 `SayDoJob-<ownerInstanceId>-<runId>` 冲突。`killOwnedTree` 只知道同名 Job 有成员，却没有证明 birth-matched PID 属于该 Job。

要求：

- 以 canonical 为准，把 Job 的创建、运行期登记、`agent-owner.json` 持久化、恢复校验统一为精确的 ownerInstanceId + runId identity；禁止 substring、truthy、可省略 identity 与 commandToken 替代 runId。
- 如 spawn 边界当前拿不到 runId，收紧接口把稳定 run identity 显式传入，不要再造第二套映射；commandToken 仍可作为 POSIX 命令锚，但不能冒充 Windows run identity。
- platform 增加真实 native PID-in-Job membership 查询；destructive TerminateJob 前必须同时证明 job identity 精确、PID birth 精确、expected PID 是该 Job 成员。不能用 ActiveProcesses > 0 代替 membership。
- ownerInstanceId、runId、jobName、PID、birth 任一缺失、畸形、错配、不可观测、Proxy/accessor/revoked 均 fail-closed，不 TerminateJob，不报 reaped，不删 owner。
- 覆盖 birth exact + wrong-run Job、owner substring 碰撞、缺 ownerInstanceId、缺 runId、同名/复用 Job、PID 不属于 Job。

## P1-2：empty/missing Job + live PID 不能成功

`packages/platform/src/process.ts` 当前在 birth exact 后遇到 Job `missing` 或 active=0 直接成功，上层随后 audit `tier1.orphan_agent_reaped` 并删除 owner。hostile 生产路径已得到 `terminateCalls=0, aliveCalls=0, ownerExists=false`，而 PID 仍活。

要求：

- empty/missing Job 时复核 PID；birth 非空且 PID 仍活必须 fail-closed、保留 owner。
- TerminateJob 后同时验证 Job 已 drain 且 birth-matched leader 已不存活；未知 probe 失败，不能投影为成功。
- 只有身份匹配且整组确实不可存活后，才允许 audit-before-delete；audit 失败继续保留 owner。
- 把 `packages/platform/test/process.test.ts` 中“active=0 但 PID 仍活也成功”的错误 Windows 真机断言改为拒绝并保留，不是删除测试。

## P1-3：CLI emergency reaper 不得保留平行的未加固实现

`packages/cli/src/emergencyReaper.ts` 仍直接 `instanceof`、`.message`、`String(unknown)`、不可信 `.code`；POSIX 忽略 binary/commandToken 锚；Windows 只看 jobName 存在，不校验格式与 owner/run/PID membership；runtime owner 回收后直接删除，没有 audit-before-delete。

要求：

- CLI 与 daemon 复用同一受控 owner reader、identity verifier、trap-free errno 与 reaper primitive；若包边界不允许直接 import，抽到现有共享包，不能复制第三套近似逻辑。
- ordinary Error SECRET、Aggregate、Proxy、revoked Proxy、accessor、primitive 在 CLI 日志/输出/audit 中均为零原文，catch 自身不再抛。
- POSIX 必须保留 PGID + binary/commandToken + birth 锚；Windows 使用 P1-1 的完整 owner/run/job/PID membership 合同。
- CLI 删除任何 owner 前必须先写入可验证的 reap audit；audit 失败或证据不足时保留 owner并非零失败。
- 补 CLI production-path tests，不用整段 mock `killOwnedTree` 绕过 platform。

## P1-4：真实 startup/fatal trust boundary 必须闭合

`packages/daemon/src/index.ts` 的 supervisor IPC callback/catch 与 database-close fatal 分支仍直接 `String(err)` / `String(closeError)`。ordinary Error SECRET 可进日志，revoked Proxy 可在 catch 内二次抛；IPC callback 二次失败还会跳过 `resolveSend()` 并永久等待。现有 `startup-failure.test.ts` 只测纯 helper，没有经过真实 logger、audit、supervisor frame、inactive drain 与 owner 留存。

要求：

- 这些生产 catch 全部使用统一、trap-free、受控投影；不读取 unknown 的 message/code/toString，不泄漏原文。
- supervisor send 的 settle 必须放在不可跳过的 `finally`，投影、logger 或 callback 自身失败也不能留下悬挂 Promise。
- 增加真实 child-process/startup/fatal harness，覆盖 ordinary Error SECRET、Aggregate、Proxy、revoked Proxy、accessor、function、Symbol/BigInt/primitive；逐项断言日志、audit、IPC frame 零 SECRET，deadline 时非零退出且 owner 留存。

## P1-5：emergency cleanup 的任何失败都必须 fatal

`tier1Executor.emergencyShutdown()` 的 active completion/proc wait 任一 reject 时，`index.ts` 只处理 `IndependentDeadlineError`，其他 rejection 被静默丢弃并继续启动。

要求：

- deadline 前只有完整 drain 成功才可继续；任何非 deadline rejection 同样走受控 fatal、非零退出、owner 保留，不得把 executor 置空后继续。
- late resolve/reject 必须被消费，零 unhandled rejection；不得伪报 reaped 或删除 owner。
- 增加 active completion reject、proc.wait reject、cleanup aggregate、late reject 的真实路径回归。

## P1-6：独立硬截止 timer 必须保证进程存活到判决

`packages/daemon/src/independentDeadline.ts` 对唯一 timer 调用 `unref()`；在 unsupervised 且被清理 Promise 不持有 handle 时，Node 可在 deadline 前自然零退出。

要求：

- 真正的 hard deadline timer 在裁决前保持 referenced；裁决并完成受控收口后再释放，不能依赖 Vitest 常驻 handle。
- 用独立 Node child-process harness 验证永不 settle 且无其他活跃 handle 时仍等待 deadline、发 fatal、保留 owner并以非零退出；同时覆盖 deadline 前成功、边界竞态、late resolve/reject。

## P1-7：原型预算耗尽必须产生图级 sentinel

`processGroupLifecycle.ts` 的原型探测在 budget 耗尽时返回与“发现 hostile Proxy”相同的布尔值，随后生成普通 hostile identity 叶；收尾也没有把 `budget.exhausted` 投影为 `UNSAFE_ERROR_GRAPH_SENTINEL`。这违反 prompt 178 的 cycle/budget sentinel 合同。

要求：

- 原型探测返回可区分的结果，budget exhausted、cycle 与真实 hostile identity 不得混淆。
- 任意节点/原型/容器遍历耗尽全图预算时，canonical 结果包含且只按合同放置图级 `UNSAFE_ERROR_GRAPH_SENTINEL`；保持 first-seen、origin 去重与稳定 root intern。
- 补深原型链、循环原型/图、恰好 budget 边界、Proxy/revoked 与重复投影 exact-leaf 测试，不只断言“有界”。

## P2：消除测试假绿并保留上一轮已修合同

- restart-policy 组合 harness 只能替换 OS 观测，必须真实穿过 platform `killOwnedTree`；不得用整段 kill hook 绕过生产边界。
- Windows 真机覆盖 PID membership、empty/missing Job、wrong-run Job；非 Windows 以 native seam 精确模拟同合同。
- 保持上一轮已验证的：native Error/Aggregate 零 SECRET、显式 `cause: undefined` 叶、多叶 Aggregate root identity、Tier1BinaryIdentityError 私有快照、distinct signal 顺序、business + signals + unreaped、audit-before-delete。

## 必跑门禁

先写并运行每个 hostile 的最小回归，然后严格串行执行：

```text
pnpm --filter @saydo/platform test
pnpm --filter @saydo/cli test
pnpm --filter @saydo/daemon exec vitest run test/process-group-lifecycle.test.ts test/runtime-child-registry.test.ts test/tier1-executor.test.ts test/byoa.test.ts
pnpm --filter @saydo/daemon exec vitest run test/restart-policy.test.ts test/startup-failure.test.ts test/shutdown-deadline.test.ts
pnpm --filter @saydo/daemon test
pnpm typecheck
pnpm lint
bash scripts/check-emoji.sh
git diff --check
```

不得并行运行 daemon Vitest。若 sandbox 禁止 OS/进程探针，停止堆叠同类环境红灯，如实列出并交给 host 复验；纯函数 hostile 必须在会话内通过。最终报告逐项列根因、修改文件、真实 exit/摘要、未验证项，保持工作树未提交。
