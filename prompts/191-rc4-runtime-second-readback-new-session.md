# RC4 runtime 第二次 readback 红灯后的全新实施

这是实施会话 `01a0323b-5f8f-7f43-9997-7e386c52a622` 的第二次零上下文 readback 红灯。按仓库制度，旧会话已经弃用，禁止 resume；本轮必须是全新的 Grok 实施会话。当前已将旧会话落地固化为本地检查点 `c3f8aa5`，未推送。

只修改 `<runtime-worktree>`。不要提交、推送、联网，不触碰用户原始 dirty worktree，不读取 `logs/**` 或旧 review 报告，不为通过测试而删除、skip、弱化断言或反向钉住错误合同。以本 prompt、当前代码、canonical 文档和真实测试为输入；保留 `prompts/189-rc4-runtime-second-red-fresh-trust-boundary-implementation.md` 与 `prompts/190-rc4-runtime-fresh-trust-boundary-first-readback-return.md` 已要求且已通过的安全合同。

当前 host 已真实通过 platform 32 passed/2 skipped、CLI 43 passed/1 skipped、runtime child 66 passed/1 skipped、BYOA 77 passed、process lifecycle 36 passed、Tier1 executor 150 passed、restart/startup/shutdown 31 passed、四文件合计 329 passed/1 skipped、daemon 全量 2089 passed/6 skipped、typecheck、lint、emoji 与 diff 门禁。但两路全新、零上下文静态复审仍各确认 4 个 P1；测试全绿不能覆盖这些缺口。

## Windows P1-1：restart policy 不能把活进程的 empty/missing Job 当作已退出

当前 `restartPolicy.ts` 在 owner birth 与 live PID 精确匹配后，若 Job active count 为 0，会让 `processGroupAlive` 返回 false；`verifiedOwnedAgent` 随后返回 null，绕过 `killOwnedTree` 的 live fail-closed 路径，上层可能把执行标为 `already_exited` 并生成重复 agent。

要求：

- owner/run/job/PID/birth 精确匹配且 leader 仍活时，empty/missing/不可观测 Job 一律是污染或观测失败，不是 `already_exited`；必须保留 owner、拒绝重启并进入受控失败。
- `already_exited` 只能在 leader birth identity 可证明已不存在且 Job 已可证明 drain 时成立；未知不能投影为不存在。
- restart-policy 真实走 platform verifier/kill primitive，不能用整段 kill hook 绕开生产边界。
- 增加“birth exact + live PID + active=0/missing/unknown”的生产路径回归，断言不 dispatch、不删 owner、不报 reaped。

## Windows P1-2：Job 创建与回收必须绑定同一个内核对象实例

当前 `CreateJobObjectW` 成功后没有立即检查 `GetLastError() === ERROR_ALREADY_EXISTS`；恢复时 active count、PID membership、terminate 又各自按名字打开不同 handle。攻击者或竞态可让同名 Job 被复用/替换，最终终止非本次所有权对象。

要求：

- 新建 Job 时，`CreateJobObjectW` 返回非空后立即读取 last-error；若为 `ERROR_ALREADY_EXISTS`，关闭 handle 并 fail-closed，绝不 attach、assign 或继续登记。
- 运行期持有创建所得 Job handle；恢复期只打开一次 Job handle，并在该同一 handle 生命周期内完成 active count、PID membership、termination 与 drain 判定。不得以名称重新打开多个 handle 拼接证据。
- 同时打开并持有 leader process handle，先用该 handle 读取/核对 process birth，再用同一 process handle + 同一 Job handle 做 membership；直到 destructive action 与判定完成前不释放，以阻断 PID/Job 复用 TOCTOU。
- Job name 必须严格等于 canonical `SayDoJob-<ownerInstanceId>-<runId>`；ownerInstanceId、runId、PID、birth、Job handle、process handle、membership 任一缺失、畸形、错配或不可观测均 fail-closed。
- platform 暴露一个原子的 verified-owned-Job 操作，CLI、restart policy、runtime registry 与 daemon reaper 复用它，不允许调用方自行组合三个按名探针。
- 增加 `ERROR_ALREADY_EXISTS`、同名 Job 替换、PID 不属于 Job、wrong-run、birth mismatch、query/close/terminate 失败及成功 drain 的精确回归。非 Windows 可走 native seam；Windows 真机测试必须经过真实 handle API。

## Windows P1-3：CLI 对已确认死亡的 owner 必须 audit-before-delete

当前 CLI emergency reaper 在 agent/runtime owner 的 leader birth 已确认死亡或不存在时直接 `continue`，既不写审计也不删除；Windows `KILL_ON_JOB_CLOSE` 在 daemon 死亡后很容易进入该状态，陈旧 owner 会跨 generation 永久遗留并阻塞 stopped 判定。

要求：

- 对“leader 已确认死亡且 Job 已确认 drain”的 owner，写受控、可验证的 orphan/reap audit，audit 成功后才删除 owner。
- audit 失败、Job 非空、Job 不可观测或 identity 不完整时保留 owner并非零失败；不能静默跳过。
- agent 与 runtime owner 使用同一状态机；覆盖 Windows daemon-crash + `KILL_ON_JOB_CLOSE`、generation mismatch、audit failure、Job still active 和 clean stale owner。

## Windows P1-4：runtime owner 的 binary 与 command token 必须可用于可信锚定

当前 runtime owner reader 允许空字符串或相对 `binary`，且非 pending 记录可缺 `commandToken`；POSIX 的 `command.includes("")` 对所有命令恒真，可误杀无关进程组。CLI runtime reader也未复用 agent reader 的绝对路径校验。

要求：

- 所有可进入 destructive recovery 的 runtime owner 必须有非空绝对 `binary`、非空且状态适用的 `commandToken`，以及完整 ownerInstanceId/runId/PID/birth；读取时 trap-free 校验。
- 空、相对、NUL、畸形、accessor、Proxy/revoked、缺字段记录均 fail-closed，保留文件且不 kill、不 audit reaped、不删除。
- CLI 与 daemon 复用同一 owner schema/reader，禁止第三套宽松 parser；补空串恒真、相对路径、缺 token 与 hostile record 回归。

## 生命周期 P1-1：POSIX gate 启动必须等待 bind 完成并可取消

当前 `startGateServer()` 调用 `server.listen(sockPath)` 后立即返回，未等待 `listening`，也未接住异步 `error`。若随后 recovery 失败，cleanup 可在 `listening === false` 时清空引用，之后 listener 才成功绑定并成为失联资源；`EACCES`/`EADDRINUSE` 也可能成为未处理 EventEmitter error。

要求：

- `startGateServer()` 只有在 `listening` 成功后才 resolve；异步 `error` 受控 reject，监听器在 settle 后可靠移除。
- bind 进行中收到 close/abort 时必须等待或取消 bind，最终不能留下无引用 listener/socket；所有竞态只 settle 一次且零 unhandled error/rejection。
- production startup 只能在 gate 已绑定后进入 recovery；bind 失败进入统一 startup-fatal 清理。
- 增加真实 socket child-process 回归：延迟 bind + recovery reject、`EADDRINUSE`、`EACCES`/受控 bind error、bind-close 竞态、正常 bind/shutdown；断言进程有界退出且路径可重新绑定。

## 生命周期 P1-2：gate close 必须纳入同一个独立 hard deadline

当前 hard deadline 只包 executor cleanup；`closeGate()` 在其后无截止等待，且 rejection 被两层 catch 吞掉。活跃连接可令 `server.close()` 永不 settle，close callback error 也可能仍返回 `executor-disabled` 并继续运行。

要求：

- startup emergency cleanup 的 hard deadline 覆盖 executor drain、gate close 及其必要收口，而不是只覆盖其中一段；deadline 不依赖被清理 Promise，timer 在裁决前保持 referenced。
- executor 或 gate 任一 reject/timeout 都是受控 fatal：保留 owner、不伪报 reaped、不继续启动、向 supervisor 发受控 fatal 后非零退出。
- late resolve/reject 必须消费，零 unhandled；不得用 catch 吞掉资源关闭失败。
- 覆盖活跃连接导致 close 不 settle、close callback/rejection、executor 成功但 gate 失败、gate 成功但 executor 失败、deadline 边界竞态和 late settle。

## 生命周期 P1-3：数据库 close 失败不得发送 stopped 或 exit 0

当前正常 shutdown 中 `closeDurables()` 失败后只记录日志，随后仍向 supervisor 发送 `stopped` 并 `exit(0)`。

要求：

- 只有 gate/HTTP/Tier1/runtime/数据库等所有 canonical drain 步骤成功后才允许发送 `stopped` 和零退出。
- 数据库 close reject/timeout 必须走受控 shutdown-fatal/nonzero；不得发送 `stopped`，不得把 `dbClosed=false` 投影为成功。
- supervisor send 自身无论成功/失败都必须有界 settle；错误文本使用受控投影。
- 用真实入口 child-process harness 注入 database close failure，断言无 `stopped`、有受控 fatal 或确定的非零终态、零 SECRET、owner 留存符合 canonical。

## 生命周期 P1-4：startup activation/rollback catch 不得泄漏 unknown 原文

生产配置 activation/rollback catch 仍使用 `String(err)`，结果进入 logger/audit。`Error("SECRET=...")`、Proxy、revoked Proxy 或 hostile accessor 可泄漏或在 catch 中二次抛。

要求：

- 所有 startup activation、rollback、gate、recover、database-close、supervisor IPC catch 统一使用 trap-free 的受控 code/常量；不读取 unknown message/code/toString，不把 raw cause 放入可枚举/inspectable 对象。
- logger、不可变 audit、fatal IPC/frame、stack、JSON、`util.inspect` 中 exact hostile marker 均为零；catch 自身不能再抛。
- ordinary Error、AggregateError、Proxy、revoked Proxy、accessor、function、Symbol、BigInt、null/undefined 等真实 production-path hostile 全覆盖。

## 验证 P2：真实入口与真实边界必须可证明上述合同

现有 startup-fatal harness 直接调用 helper，没有启动 daemon 入口，覆盖不到真实 gate bind、数据库关闭、logger/audit/supervisor wiring。现有 Windows native 测试也未覆盖非成员 PID、同名对象复用与真实 restart-policy kill 路径。

要求：

- 新增最小可控的 daemon 入口 child-process harness，使用生产 wiring，只通过显式测试 seam 注入故障；不得复制 helper 逻辑伪装成入口测试。
- 非 Windows 单测以窄 native seam 精确模拟同一 handle 生命周期；Windows 真机增加真实 `CreateJobObjectW`/process handle/membership/terminate 回归。
- 所有测试断言业务结果与副作用：dispatch、owner 文件、audit、supervisor frame、exit code、listener 可重绑、真实进程是否存活；不能只断言 helper 返回值。

## 必须保留的既有合同

- arbitrary native Error/Aggregate/Proxy/revoked/accessor/primitive 原文在 lifecycle、audit、日志、IPC 中为零；raw unknown 不在公开 `.cause`。
- 显式 `cause: undefined` 仍是 opaque 叶；多叶 Aggregate root identity 稳定；图预算/cycle 使用 graph sentinel。
- Tier1BinaryIdentityError 只读私有不可变快照；distinct signal、business + signals + unreaped 顺序和去重不回归。
- Windows destructive recovery 始终要求 exact owner/run/job/PID/birth/membership；audit-before-delete；unknown fail-closed。
- emergency hard deadline referenced、有界，late settle 已消费；正常与 fatal shutdown 不伪报 `stopped`。

## 必跑门禁

先写并串行运行每个缺口的最小回归，再严格串行执行：

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

不得并行运行 daemon Vitest。若 sandbox 禁止真实 OS/进程探针，停止重复堆叠同类环境红灯，如实列为 host 复验；纯函数和可控 seam 必须在会话内通过。最终报告逐项列出根因、实际修改文件、每条真实 exit/摘要、Windows 真机未验证项；保持工作树未提交。
