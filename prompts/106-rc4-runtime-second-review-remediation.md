# RC4 运行时第二轮独立复审返工实施单

## 1. 会话与基线

这是第二轮独立复审红灯后的全新实施会话。不得读取或继承此前实施会话的推理、自报或日志；
只以当前工作树代码、本文件和仓库 canonical 文档为输入。

- 基线 commit：`a5016920d93a8b5e71b9a879ae4daa4b7cb4b094`
- 工作分支：`codex/rc4-runtime-review2-fix`
- 本轮只处理运行时、CLI、platform 及其直接测试，不修改发布产物、版本、证据结论或部署状态。
- 不 commit、push、tag、release 或 deploy；宿主在独立复审和门禁后负责固化。

以下十项是冻结清单。不得用放宽断言、增加 skip、吞错、提前清理残留、改快照文字或删除反例的方式过门禁。
若代码结构与行号漂移，以描述的行为合同为准。

## 2. P1-1：Windows Job 是唯一权威且正常退出回收孙进程

当前有 handle/jobName 时仍可能先看 birth/PID，或者在 Job active=0 后回退到复用 PID；wrapper、main、managed
正常 close 后也可能只保留 mapping/武装 deadline，不主动终止 Job 内残余成员。

必须实现：

- 只要 durable owner 已绑定 Windows Job，先读取 Job active process count；该读回是成员存活的唯一权威。
- active=0 必须判 gone，不能再由 leader PID 或 birth identity 覆盖为 alive/unknown。
- active>0 的 teardown 必须先 TerminateJob，再用单调截止轮询到 0，最后 checked-close handle。
- query/terminate/close 任一失败必须判 unknown、污染共享 lifecycle、保留可恢复 owner/map，不能报成功。
- wrapper/direct/main/managed 正常 exit/close 也必须主动回收 Job 内剩余孙进程。

新增或加强回归：active=0+复用 PID、PID 不可访问、正常退出后真实孙进程、query/terminate/close 失败。
Windows 专用真实孙进程用例必须在 Windows 执行；非 Windows 可保留有理由的条件 skip，但不能把行为只交给 mock。

## 3. P1-2：spawn 到 owner 的完整事务与 checked native cleanup

当前 create Job 后若 spawn 返回 pid undefined、同步抛错或 assign/register 失败，可能泄漏 Job handle、wrapper、pipe；
abandon 路径吞 kill/CloseHandle 且不等待 terminal，Win32 多个临时 handle 的 CloseHandle 返回值未检查。

必须实现：

- create Job、spawn、assign、register/pending-owner、pipe ownership 是一个可回滚事务。
- pid undefined、同步 spawn throw、assign/register/persist 失败都必须消费 pipes、关闭 permit、kill 并有界等待
  exit/close，再 checked-close 所有 native handles。
- cleanup 中 query/terminate/close 失败必须污染共享 lifecycle，并保留足以恢复/诊断的 durable owner/map；
  不能因为清理尝试本身失败而返回干净成功。
- 所有 Win32 临时 handle 的 CloseHandle 返回值必须检查并传播 typed lifecycle error。

新增故障注入：pid undefined、sync spawn throw、assign 失败、kill 失败、close 二次失败，逐项断言无静默泄漏。

## 4. P1-3：任何 stop 原因都有独立单调 close deadline

当前 `execRuntimeChild` 只在 exit 回调后武装 close deadline；Abort、timeout、overflow、pipe error 后若 child
永不发 exit/close，Promise 可永久不 settle。

必须实现：首次 `requestStop` 即武装独立的单调 close/stdio-terminal 总截止；到期后 SIGKILL，污染共享
lifecycle、保留 owner，并以 typed error reject。后续 exit/close 不能重置或延长总截止。

新增直接反例：abort、timeout、pipe error 三种情况下 child 永不发 exit/close，虚拟单调时钟推进后都必须有界 settle，
且 owner/污染状态符合合同。

## 5. P1-4：全局 ownership barrier 与 release/establish 互斥

必须实现：

- `beginRuntimeChild.release()` 一进入就不可逆地 latch `closing/released`；owner 是否可删除另由 authoritative-gone
  状态决定，不能用“仍 alive/unknown”让进行中的 establish 继续写 owner/permit。
- release 与未完成 establish 竞态时，release 胜出，最终不能残留新 permit 或宣告已建立。
- runtime child、BYOA、Tier1 任一 typed lifecycle/ownership barrier 失败都同步写同一个共享 contamination；
  之后所有 `spawnRuntimeChild` 统一拒绝新进入。
- shutdown 的成功条件是 owner/map/permit/job exact-empty；unknown 不能被当 empty。

新增回归：release-vs-establish、三子系统任一污染后另一路拒新、shutdown exact-empty。

## 6. P1-5：主 agent pipe failure 在所有 disposition 前终结

当前 pipe failure 可能只折为 exitCode=1/诊断文本，再被 Claude stderr 的 `No conversation found` 分类成
`resume_not_found` 并触发第二次 spawn。

必须实现：

- `AgentProcessHandle`/wait 结果携带 durable typed `terminationCause` 或等价结构化 `pipeFailed`。
- pipe failure 在 rate limit、auth、resume-not-found、安全分类和任何 retry/resume 分支之前占优。
- pipe failure 一律 failed、不可重试，不清 owner 后二次 spawn；审计原因稳定且不依赖 stderr 文案。

新增集成回归：同一退出同时含 EPIPE 与 `No conversation found`，断言 attempts=1、failed、无第二 spawn。

## 7. P1-6：全部硬截止使用单调时钟

- runtime wrapper TERM/KILL/drain 不得使用 `Date.now()` 计算 deadline，改用 `performance.now()` 或现有单调抽象。
- native resume claim 不得使用 `Date.now()` 控制有界等待，改用 `runtimeNow()`/单调 timer。
- 全仓本轮触及的 lifecycle deadline 不得混用 wall clock。

新增回拨/冻结 wall clock 反例：descendant 永不 settle、claim 永不 settle 时都必须按单调时钟有界结束。

## 8. P1-7：recovery-only restart/signal/fatal 共用一次性 lifecycle

当前 unsupervised restart 与 signal shutdown 可能各起一个 Promise，两个 continuation 同时 close，一个 spawn 新 daemon，
另一个发 stopped/exit。

必须实现：restart、signal、fatal 共用单一 once Promise 和单一总截止；signal/fatal 优先于尚未完成的 restart，
不能出现重复 drain/close、restart 后抢跑 spawn 或互相覆盖最终 disposition。

新增真实 server 集成回归：触发 restart 后同步 signal，断言 drain/close 各一次、spawn=0，且最终 fatal/stopped
与优先级合同一致；不能只测裸 deadline helper。

## 9. P1-8：CLI owner 读取必须区分 absent/invalid/valid

必须实现：

- owner read 为明确三态 absent/invalid/valid；JSON/shape/version/state invalid 一律 fail-closed 并保留文件。
- Windows durable agent/runtime owner 缺 jobName 一律红，不能因 leader dead 或无 legacy PID 静默 continue/删除。
- 仅 owner absent 且无 legacy PID 才是 absent；存在未验证 legacy PID 必须 ownership-unverified。
- valid-dead 只有经 Job/平台权威确认后才可清理。

新增 agent/runtime 组合矩阵：absent、invalid、valid-dead、missing-job，逐项断言返回、文件保留/删除和污染状态。

## 10. P2-1：测试门禁不能先清掉泄漏再判绿

- `exact-test-roots` 或等价断言必须先记录并对任何已存在 root/map/handle 失败。
- 如需清扫只能在报告失败后的独立 finally 中做，清扫成功不能把本次断言改成通过，清扫失败也不能吞。
- test reset 不得直接 `runtimeJobs.clear()`；必须先 assert exact-empty，或逐项 checked-close 后仍报告原始泄漏。
- Windows worker 退出后逐项验证路径、map、permit、Job handle exact absence。

新增回归：预置泄漏路径时 assert 必须 throw；清扫后仍能继续测试，但本次结果保持失败。

## 11. P1-9：证据冻结边界

本轮不要修改、重写或宣告既有 F106/F107/F108、artifact、manifest、Mac/Linux/Windows 证据有效；它们仍绑定旧源码。
代码稳定后由宿主重新 freeze 并在三平台复测。测试中若需要临时产物，只能放忽略目录并在结束前清理。

## 12. 必跑门禁

先跑每个新增直接反例，再跑以下全量门禁。任何红灯都必须保留原始输出并继续修到绿，不能改成 skip。

1. `pnpm --filter @saydo/platform test`
2. `pnpm --filter @saydo/cli test`
3. `pnpm --filter @saydo/daemon test`
4. `pnpm --filter @saydo/platform typecheck`
5. `pnpm --filter @saydo/cli typecheck`
6. `pnpm --filter @saydo/daemon typecheck`
7. `pnpm lint`
8. `git diff --check`
9. `bash scripts/check-emoji.sh`

若某 workspace 没有对应 script，先从 `package.json`/`justfile` 找仓库等价命令并报告替代关系；不要把命令不存在写成通过。
最终返回：改动文件清单、十项逐条实现映射、每条真实门禁的命令/退出码/摘要、仍需真实 Windows 才能证明的项目。
