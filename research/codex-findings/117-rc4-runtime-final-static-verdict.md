No-Go

1. A（阻断）`packages/daemon/src/runtimeChildRegistry.ts:198`、`:468`：同 PID successor 注册后，旧 generation 仍留在 `generationsById`，`generationIsCurrent` 因旧 id 存在直接放行；POSIX birth 缺失时继续执行 `kill(-pid)`（`:485-490`）。修复：注册时驱逐该 PID 旧 id；current 判定必须匹配 PID map 的完整 identity；birth 不可证时禁止 destructive signal。
2. A（阻断）`packages/platform/src/win32.ts:1263`：post-create rollback 忽略 `TerminateProcess` 成败及 `WaitForSingleObject` 返回值，随后无条件关闭全部资源（`:1276-1278`）；child 仍活、timeout 或 unknown 时会丢失终止 authority。修复：校验 terminate、wait、exit code；未证明退出时保留 process/thread/Job capability 和 durable owner，fail closed。
3. A（阻断）`packages/platform/src/jobIdentity.ts:45`、`packages/daemon/src/tier1/executor.ts:4217`、`packages/daemon/src/tier1/restartPolicy.ts:270`：Job 名只绑定 owner/run，未绑定 generation；agent owner writer 未持 HOME 锁，daemon reaper 也在锁外读取、kill、audit、unlink，且无锁内完整 identity CAS。修复：Job 名无歧义编码 generation；所有 publish/reap/release 在同一 `withHomeOwnerBoundary` 内重读完整 identity，audit 成功后再 unlink。
4. A（阻断）`packages/daemon/src/api/recoveryOnlyServer.ts:92`：invalid JSON 回 400 后仍 `resolveBody({})`（`:94-95`），请求继续进入业务路由。修复：返回显式 handled sentinel 或 reject，并在 handler 立即终止业务链。
5. A（阻断）`packages/daemon/src/api/recoveryOnlyServer.ts:182`、`:788`：真实 prebound 分支用 `sendFrame` 丢弃 ready IPC Promise（`:797-809`）；rejection 不进入 lifecycle fatal，bind Promise仍成功。修复：await `sendFrameAndWait`，将 rejection 汇入唯一 lifecycle，产生单一 fatal 和非零退出。
6. A（证明缺口）`packages/platform/test/home-lock.test.ts:96`、`packages/daemon/test/runtime-child-registry.test.ts:2151`、`packages/platform/test/process.test.ts:469`：现有相关项未形成“两真实进程 writer/reaper”、Windows native fault rollback/kill、真实 prebound ready rejection的完整证明。修复：增加对应 child-process 与 Windows-only native 门禁；保留 `startup-failure.test.ts:765` 的真实首次 shutdown 覆盖。

Prompt 196 台账：A[fail]；B[fail]；C[partial]；D[fail]；E[fail]。

本轮按约束未运行门禁；Windows native 项待真机验证

审查前 HEAD=2637d30ba5ffeedb6067555e9d816dd02d526e43；审查后 HEAD=2637d30ba5ffeedb6067555e9d816dd02d526e43；`git status --porcelain=v1 -z -uall | shasum -a 256`=29346af349b846b9159c8d0358d6045943e6440de99ce29494676dcd59efbb4c