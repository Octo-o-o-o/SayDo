# RC4 runtime 第二轮独立对抗 readback

你是 SayDo RC4 runtime trust-boundary 修复的第二轮、零上下文、只读对抗审查者。

## 隔离与证据规则

- 当前仓库由 `-C` 指定；先现场确认 HEAD、分支、`git status --short`、完整 dirty diff 与改动文件集合。
- 待审实现是当前 HEAD 相对工作区的未提交 product/test diff，不采信 commit message、实施者总结或任何“已通过”表述。
- 禁止读取 `prompts/**` 中除本文件外的任何文件，禁止读取 `research/**`、`logs/**`、`history/**`、旧评审、旧报告或 PROCESS-JOURNAL。
- 只读：不得修改、暂存、提交、推送、创建 tag、发布或启动 subagent。
- 事实结论必须来自本会话真实源码、canonical 与命令输出；测试失败不得缩小覆盖换绿。

先完整阅读仓库 `AGENTS.md`，并阅读与本轮直接相关的 canonical：

- `docs/09-data-contracts.md` 中 runtime identity、不可复用 ownership、回收、fatal/shutdown、审计脱敏等条款；
- `docs/adr/ADR-003-os-adapters.md`；
- 当前 dirty diff 涉及的 CLI、daemon、platform 源码和测试完整上下文。

## 必审不变量

### A. Windows native / Job / process identity

1. `CreateProcessW` Koffi ABI、UTF-16 mutable command line、`STARTUPINFO(EX)`、stdio 与 handle inheritance、`CREATE_SUSPENDED`、返回 handle/ID 的类型宽度与生命周期均正确。
2. 必须用同一 process handle 完成 birth、Job 绑定或 membership 证明、持久化与 `ResumeThread`；任一失败要完整回滚并 exactly-once close，不能留下 suspended child 或 Job。
3. Job name、owner record、command token、generation grammar 严格且不可复用；`ERROR_ALREADY_EXISTS`、unknown membership、query error、timeout、final observe 仍 active 均 fail closed，只有确定 drained/exited 才成功。
4. runtime lease 捕获精确 generation 与 Job handle；late release、PID reuse、successor registration、map/owner 删除和 teardown 均 identity CAS，不能动态按 PID 命中新一代。
5. Windows 所有 Tier1/BYOA/runtime/CLI/restart/prior-generation 回收链不得有裸 PID destructive fallback；graceful 与 hard kill 都不能在 exit/close 窗口误杀复用 PID。
6. audit-before-delete、home boundary、birth/job identity、未知态留 owner。macOS partial-hook 不得伪装 native 证明；明确列出必须留待 Windows 真机执行的 skip。

### B. daemon lifecycle / composition / hostile unknown

1. shutdown 在 gate bind/recover 任意 await 窗口到达后，必须立即进入唯一 draining/lifecycle，AbortSignal 生效，绝不继续 recover、spawn 或 tick；deadline 与 disposition 竞态确定。
2. gate post-bind failure、startup/recover/emergency cleanup、DB close、fatalShutdown late rejection 均被消费并有有界收口；`fatal`/nonzero/`stopped` 语义与合同一致，无 unhandled rejection。
3. recovery-only 与普通生产入口共享 trap-free hostile unknown 投影、supervisor IPC helper、审计/日志脱敏；native Error、AggregateError、primitive、accessor、Proxy、revoked Proxy 均不能泄漏 SECRET/完整路径或击穿 catch。
4. pending CLI cleanup、strict owner parser、supervisor IPC、prior-generation recovery 同样满足 trap-free、audit-before-delete、失败保留 owner。
5. 测试 seam 必须是显式模块局部 composition，生产默认无 hook；不得读取 `globalThis.__SAYDO*`、`SAYDO_TEST_*` 等 ambient switch。
6. 真实 child-process 测试必须经过同一个 `src/index.ts` production composition。recover-hold 必须真配置 Tier1、真进入调用前 hold，并精确证明 shutdown 后 recover-attempt 为 0、owner 集不增加、exit 0、唯一 stopped、无 fatal。
7. Tier1/managed/runtime failure leaf 必须精确断言数量、身份、顺序与 canonical 去重；不得以 `at least`、宽松 `some/includes` 掩盖结构变化，也不得期待裸 PID fallback 叶。

### C. 普通正确性与回归

- 查找 ABI 错误、资源泄漏、悬空 child、竞态、重复 lifecycle、错误成功投影、owner 误删、审计缺口、未消费 promise、测试残留进程、生产 seam 被误用、或新增测试无法杀死旧缺陷。
- 检查所有改动，不限于上述清单；发现确定性问题按 P0/P1/P2/P3 分级。

## 本会话必须真实运行的门禁

按顺序运行并记录命令、exit、总计与 wall time：

1. `pnpm --filter @saydo/platform test`
2. `pnpm --filter @saydo/cli test`
3. daemon RC4 精确 8 文件：`runtime-child-registry`、`tier1-executor`、`byoa`、`restart-policy`、`startup-failure`、`tier1-gate-socket`、`shutdown-deadline`、`recovery-only-process`
4. `pnpm typecheck`
5. `pnpm lint`
6. `bash scripts/check-emoji.sh`
7. `git diff --check`

daemon 全套不要求重复运行。门禁后确认没有本工作区残留 daemon/测试进程。

## 输出

输出完整 Markdown 报告，结构：

1. `# RC4 runtime 第二轮独立对抗审查`
2. `## TL;DR`
3. `## 审查基线与改动集合`
4. `## 不变量对账`，逐项给 `[ok]`、`[warn]`、`[fail]` 与真实 `file:line`
5. `## Findings`，按 P0/P1/P2/P3；每条含绝对 `file:line`、可复现路径、合同影响、最小修复
6. `## 门禁结果`，真实命令、exit、总计、wall time
7. `## Windows 真机待验清单`
8. `## 独立结论`

结论规则：任何确认的 P0/P1 都是 `No-Go`；没有 P0/P1 才可 `Go`，但 P2/P3 仍须完整列出。最后声明本审查零落地，不把测试通过当成没有代码缺陷。
