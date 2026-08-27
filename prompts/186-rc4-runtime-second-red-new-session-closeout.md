# RC4 runtime 第二次红灯：全新实施会话收口

你是全新的 Grok 实施会话。禁止 resume 已废弃会话 `01a03177-ea3a-7262-b246-3d0299c2004e`，不要读取 `logs/`、旧 review/report 或其他实施会话解释；不要提交、推送、联网或触碰用户原始 dirty worktree。只在本文件所在 worktree 施工。先完整读取适用 `AGENTS.md`、`prompts/181-rc4-runtime-second-red-new-session-timeout-regression.md`、`prompts/182-rc4-runtime-timeout-host-diagnosis-correction.md` 与当前全部 dirty diff。当前代码是已固化的部分实现，不得 reset、checkout、覆盖或重做已正确落地的部分，只修以下稳定红灯及紧邻回归。

上一实施会话在第一次 hostile readback 后返工，但宿主与第二次零上下文 readback 仍稳定复现下列 P1。按制度该会话已废弃；本会话必须从代码和验收事实独立判断，不能沿用旧自辩。

## P1-1：close deadline lifecycle 被业务错误覆盖

宿主单文件真实结果：`runtime-child-registry` 为 `62 passed / 1 skipped / 4 failed`，exit 1；四文件为 `315 passed / 1 skipped / 4 failed`，exit 1。四个失败分别是 abort、timeout、pipe error、以及迟到 exit/close，实际只返回 `AbortError`、timeout Error 或 `RuntimeInvocationError`，而共享 contamination 已写入，teardown 随后又报告残留。

根因包括 `isGroupUnreapedFailure` 只认 `did not exit` / `state unknown`，排除了 `runtime child close withheld`；catch 内等待到 drain deadline 后也没有把仍未 close/仍未 gone 机械提升为最终 lifecycle leaf。

- final drain/close failure 不得被 latched business 或 abort 覆盖。
- 精确组合顺序继续为 business first-seen → distinct signal first-seen → final close/unreaped；同 canonical origin 只一次。
- `close withheld`、`state unknown`、`did not exit` 都是 lifecycle；保留 owner/barrier，禁止新 spawn。
- 恢复上述四个已有测试并保留五叶 exact、timeout 双 signal、TERM 后 exit 0、close 总截止单调不回归。

## P1-2：顶层 error list 本身也必须 trap-free、有界

`combineLifecycleFailureList` 当前直接读 `errors.length` 并 `for...of`。稳定仓外反例：普通 Proxy 返回但触发 `gets=7, iteratorGets=1, indexGets=2`；revoked Proxy 直接抛 `TypeError`。

- 顶层容器视为不可信 unknown：先拒 Proxy/revoked，不能调用 iterator、getter、`for...of` 或直接 `.length`。
- 对普通 Array 也用 own-data descriptor + index descriptor 按同一不可重置 budget 读取；稀疏/accessor/Proxy child fail-closed。
- 一次 project/walk/combine 的节点、child slot、原型步、顶层 input 与输出 leaf 都消耗共享总预算；不能为每项重置。12k 深原型与 10k 顶层输入必须在固定硬上限内结束，只追加一个 sentinel，输出不超过 leaf cap + sentinel。
- hostile 测试使用独立字面上限，不得导入产品常量形成同义自证；普通与 revoked 顶层 Proxy 的 trap 必须为 0 且不得抛原始对象/TypeError。

## P1-3：Tier1BinaryIdentityError 必须是不可伪造内部品牌

当前原型链判别可被 `Object.create(Tier1BinaryIdentityError.prototype)` 伪造，再通过 own accessor `.message` 把 `SECRET-BINARY` 写进终态文本。稳定反例为 `classified=true, msgGets=1, finalizedText=SECRET-BINARY`。

- 与 Cost/Review 错误一样用模块私有 WeakSet 或等价不可伪造品牌。
- finalize helper 只接受品牌通过的内部实例；未知对象不读 `.message`、不调用 `String`。
- 伪造原型、accessor、普通 Proxy、revoked Proxy、primitive 全部 trap=0，SECRET 在 final message/stack/log/audit 为 0。

## P1-4：restart、daemon 启动和 Windows handle 不得原样抛 unknown

- `restartPolicy.ts` 外层 catch 的非 ESRCH/EPERM 分支仍 `throw err`。hook 抛 counting Proxy、revoked Proxy、字符串时原对象原样逃逸；owner 虽保留但边界泄漏。投影为稳定受控错误，仍保留 owner/barrier 且不记录 reaped。
- `packages/daemon/src/index.ts` 的 instance-lock 与 listen catch 仍直接读 `.code` / `String(err)`；统一复用 canonical own-data errno reader，只允许 own `EEXIST` / `EADDRINUSE` 控制分支，其余消息受控，Proxy/revoked/accessor/primitive 零 trap、零 SECRET。
- `packages/platform/src/win32.ts` 的 `withCheckedHandle` 保存并原样抛 callback unknown，且 `if (workError)` 会吞 `0`、`false`、空字符串。使用显式失败标志与内部品牌投影；work 与 close 的优先级保持，但任意 falsy rejection 也必须失败，不能返回未初始化 result。
- 为三处增加可直接执行的 hostile 回归，不以静态 grep 代替行为测试。

## P1-5：通用 unknown 投影不得保留普通 Error 的 SECRET

稳定仓外反例：`safeFailureText(new Error("SECRET-PLAIN"))` 返回原文，`projectUnknownFailure` 返回同一 Error，stack 也含 SECRET。该文本已进入 Tier1 日志/审计调用面。

- 不可信普通 Error 必须按 canonical origin identity intern 成受控叶；distinct origin 仍 distinct，同 origin 去重，不能返回原 Error。
- 只有模块内部不可伪造品牌的 lifecycle/business 类型可以保留已控制字段；Aggregate 的 message/stack 也不能拼入未知原文。
- `safeFailureText`、project/combine/leaves、Tier1 log/audit 都断言 SECRET 为 0；同时保留 five-leaf 中内部 `RuntimeInvocationError` 与 `ProcessGroupLifecycleError` 的字段、顺序和 identity 合同。
- 清理重复的 `ErrorGraphFrame` union 项和已无引用 helper，但不要做无关重构。

## 不变量

- own-data ESRCH/EPERM 语义、POSIX PID/PGID birth identity、Windows Job ownership、shared contamination first-wins 不得放宽。
- timeout 测试只用 fake kill/process，不得向宿主真实 PID/PGID 发信号。
- work=null/undefined、cycle、256 层正常图、pipe allowlist、distinct signal/pipe identity、cancel/restart/close deadline 与普通成功路径不回归。
- daemon 全量曾另出现一次 `writing-narrow` 并发失败，但隔离重跑通过；不要据此改产品逻辑。最终必须以本会话重跑的稳定结果为准。

## 必跑门禁

至少如实运行并报告：上述五组新增 hostile；`process-group-lifecycle`、`runtime-child-registry`、`tier1-executor`、`byoa` 四文件；`restart-policy`；packages/platform 全量；daemon 全量；daemon/platform/root typecheck；根 lint；`bash scripts/check-emoji.sh`；`git diff --check`。Grok sandbox 若拒绝真实 `/bin/ps`，明确交给宿主复核，不能编绿。完成后列每个 P1 的生产代码、非同义回归与真实退出码；不要提交。
