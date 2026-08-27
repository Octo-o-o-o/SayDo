# RC4 runtime trust-boundary 最终对抗审查

你是零上下文、只读的外部对抗审查者。仓库当前 HEAD 是本地检查点 `c3f8aa58c37be854b7fe4e79e34cc21f6ac598c3`；请审查该 commit 到当前未提交工作树的实际代码与测试 diff。

禁止读取 `logs/**`、`prompts/**`、`research/**`、历史 review、自述或过程日志。禁止修改、暂存、提交、推送文件；禁止运行 Vitest、typecheck、lint 或其它会写工作区的门禁。只以 canonical 文档和生产代码调用链为证据。

## 审查范围

对照：

- `docs/09-data-contracts.md`，重点 §16.3–16.4；
- `docs/adr/ADR-003-os-adapters.md`；
- 当前 diff 涉及的 platform、CLI、daemon lifecycle 与测试。

必须逐项验证：

1. Windows `CreateJobObjectW` 后是否立即识别并拒绝 `ERROR_ALREADY_EXISTS`，不会 attach 到已有同名 Job。
2. 恢复/回收是否用同一个 Job handle 与同一个 process handle 贯穿 birth、membership、active count、terminate、drain，是否仍有按名重新打开或 PID/Job reuse TOCTOU。
3. live PID + empty/missing/unknown Job 是否始终 fail-closed，绝不投影 `already_exited`、reaped 或允许重复 dispatch。
4. leader 已确认死亡且 Job 已确认 drain 时，CLI agent/runtime owner 是否 audit-before-delete；audit failure、generation mismatch、identity 不完整是否保留 owner。
5. runtime owner parser 是否 trap-free 严格要求非空绝对 binary、非空 commandToken、完整 owner/run/PID/birth，是否仍存在 `command.includes("")` 误杀路径。
6. CLI、restart policy、runtime registry、daemon reaper、`killOwnedTree` 是否真实复用同一原子 primitive，调用方是否还能自行拼装宽松探针。
7. gate server 是否等待真实 bind、受控处理异步 error、close/abort 竞态不会留下无引用 listener；gate close 与 executor drain 是否处于同一个 referenced independent hard deadline。
8. executor/gate/database/supervisor 任一 cleanup reject/timeout 是否受控 fatal、非零且不伪报 stopped/reaped；late settle 是否被消费。
9. startup activation、rollback、gate、recover、database close、supervisor IPC 的 hostile unknown 是否 trap-free，原文不进入 logger、audit、IPC、stack、JSON/inspect。
10. 新增 child-process/native seam 测试是否真实穿过生产 wiring 并断言副作用，还是复制 helper/绕开真实边界造成假绿。

同时检查本次 diff 引入的其它 P0/P1/P2 回归：句柄泄漏、double close、错误状态折叠、异常吞噬、退出竞态、平台分支错误、测试与生产不一致。

## 输出格式

先给唯一结论 `Go` 或 `No-Go`。随后按 P0、P1、P2 排列 findings；每项必须包含：

- 绝对文件路径和尽量紧凑的行号；
- 确定的可复现调用路径；
- 具体违反的合同；
- 最小正确修复方向。

没有某级 finding 时明确写“无”。不要给风格偏好或纯推测。最后列出已核对且未发现缺陷的关键边界，以及因为当前主机不是 Windows 而只能留待真机验证的项目。
