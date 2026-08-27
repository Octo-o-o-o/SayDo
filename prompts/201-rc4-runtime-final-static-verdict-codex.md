# RC4 runtime final static verdict extraction

你是全新、零上下文、只读的 Codex 对抗评审。前两次审查因扩展取证超过外部时限，虽已发现问题但未形成最终报告。本轮只做“已定位问题的源码核验与 verdict 提取”，不是重新探索全仓。

规则：

- 不读取 `research/`、其它 prompt、日志或实施者自述。
- 不运行测试、构建、lint、typecheck、服务或产品代码；不 spawn/终止进程。
- 不编辑、暂存、提交、推送、tag、发布或部署。
- 最多执行 8 条只读命令；只读 `AGENTS.md`、`prompts/196-rc4-runtime-second-readback-red-fresh-reimplementation.md` 以及下列精确源码区域。
- 不发过程说明。核验后第一条 assistant 正文就是最终报告；总长不超过 1800 个汉字。

当前坐标：分支 `codex/rc4-runtime-recovery-rebuild`，HEAD `2637d30ba5ffeedb6067555e9d816dd02d526e43`，产品范围为相对 HEAD 的 `packages/**` tracked diff 加 5 个相关 untracked 产品/测试文件。

只核验以下 6 组候选阻断项；能由当前源码确定则保留，不能确定则删除，不要另开探索面：

1. `packages/daemon/src/runtimeChildRegistry.ts`：`registerGeneration` / `generationIsCurrent` / `signalRuntimeChildGeneration` 是否允许旧 generation 在同 PID successor 注册后继续 destructive signal，尤其 POSIX birth 缺失时的 `kill(-pid)`。
2. `packages/platform/src/win32.ts` 与 `packages/daemon/src/runtimeChildRegistry.ts`：native wait 为 unknown 是否被合成 `exit(1)`；post-create rollback 是否忽略 Terminate/Wait 结果并在 authority 未证明终止时丢失 process/thread/Job capability。
3. `packages/platform/src/jobIdentity.ts`、`packages/daemon/src/runtimeChildRegistry.ts`、`packages/daemon/src/tier1/executor.ts`、`packages/daemon/src/tier1/restartPolicy.ts`、`packages/cli/src/emergencyReaper.ts`：Job 名是否 generation-bound 且无歧义；所有 runtime/agent owner writer、reaper、release 是否都在同一跨进程 HOME 锁内重读并按必填完整 identity CAS，audit 失败是否会错误视为成功。
4. `packages/daemon/src/index.ts`、`packages/daemon/src/daemonStartupHooks.ts`、`packages/daemon/src/lifecycleDisposition.ts`：第一次 shutdown 是否立即取得 lifecycle ownership；启动 await、scheduler、fatal/restart/signal precedence 与 terminal freeze 是否满足 prompt 196。
5. `packages/daemon/src/api/recoveryOnlyServer.ts` 与 `packages/daemon/src/index.ts`：invalid JSON 回 400 后是否仍继续业务链；真实 prebound ready IPC 是否等待 rejection 并汇入 lifecycle fatal；hostile unknown 的错误投影是否仍可能泄漏原始路径/secret。
6. 相关测试是否确实证明跨进程锁、PID/generation successor、Windows fault rollback/native kill、first-shutdown-before-bind 与 real prebound ready rejection；macOS policy/mock 不得算 Windows native 证明。

最终报告格式固定：

1. 第一行 `No-Go` 或 `Go`。
2. 最多 6 条 finding；每条含严重级别、精确 `file:line`、触发路径、最小修复。
3. 一行 prompt 196 台账摘要，使用 `[ok]/[partial]/[fail]/[deviation]`。
4. 一行门禁声明：“本轮按约束未运行门禁；Windows native 项待真机验证”。
5. 最后一行给审查前后 HEAD 与 `git status --porcelain=v1 -z -uall | shasum -a 256`，证明零落地。

不要追加背景、计划或进一步命令。报告完成后立即结束。
