# RC4 runtime 全新实施第二轮终审 readback

- 日期：2026-08-24
- 分支：`codex/rc4-runtime-recovery-rebuild`
- 审查 HEAD：`2637d30ba5ffeedb6067555e9d816dd02d526e43`
- 验收合同：`prompts/196-rc4-runtime-second-readback-red-fresh-reimplementation.md`
- 结论：`No-Go`，这是本轮全新实施的第二次独立红灯，必须封存当前实现并换全新实施会话重做。

## 1. 范围与工作树指纹

本轮审查覆盖相对 HEAD 的 20 个 tracked 产品/测试文件和 5 个 untracked 产品/测试文件。tracked diff 为
`1412 insertions / 475 deletions`；按 `git diff --binary HEAD -- packages` 计算的 SHA-256 为：

```text
193ea65ced51a45029ecac5e61fb1031cb4a21477c2cac2e2e022f96785642a4
```

5 个新增文件及 SHA-256：

```text
f707482d2b5e172d17855a70712b6a10a0b02699d0a4ed3cf5da32cea577ddcc  packages/daemon/test/helpers/runtimeOwner.ts
dcfc3492b005b882b25b48cf374e1900b9725cd2d0d2decd4b5c796a1823bb09  packages/platform/src/homeLock.ts
24e113a7b5fb6227662fb6a181161f98374fb560587660c6e976a4af2ffe9b62  packages/platform/src/win32Quote.ts
4e3ff0586dce302c8288aaaf77f9cf4a0e12644a26c9fb0dd20e8cdc2587e6e8  packages/platform/test/home-lock.test.ts
034a399f13a6fc2dee4f3c57b056dfb49795fa662f9113d42f6b372680c76c76  packages/platform/test/win32-quote.test.ts
```

审查期间没有 tracked 产品落地。历史 prompt、旧报告和日志不属于代码 checkpoint，不得与失败实现一并暂存。

## 2. 宿主门禁

| 门禁 | 真实结果 | 判定 |
|---|---|---|
| `pnpm --filter @saydo/platform test` | exit 0；6 files；47 passed，5 skipped | `[ok]`，Windows 条件项仍待真机 |
| `pnpm --filter @saydo/cli test` | exit 0；4 files；45 passed，1 skipped | `[ok]`，Windows 条件项仍待真机 |
| `pnpm --filter @saydo/daemon test` | exit 0；128 files passed，2 skipped；2108 passed，6 skipped | `[ok]` |
| recover-hold 定向用例 | exit 0 | `[ok]` |
| `startup-failure.test.ts` | exit 0；19 passed | `[ok]` |
| `pnpm typecheck` | exit 0 | `[ok]` |
| `pnpm lint` | exit 0 | `[ok]` |
| `bash scripts/check-emoji.sh` | exit 0 | `[ok]` |
| `git diff --check` | exit 0 | `[ok]` |

这些绿灯只证明现有测试集通过，不能覆盖审查动态复现出的 generation 误杀、跨进程竞态和 Windows
capability 丢失。

## 3. 三路独立评审

### 3.1 lifecycle / trust-boundary 独立评审

零上下文审查者 `rc4_runtime_lifecycle_fresh_final_review` 判 `No-Go`：5 个 P0、3 个 P1、1 个
P2。它通过安全测试钩子动态复现了两条发布阻断缺陷：

1. 同 PID 注册 successor 后，旧 generation 的延迟 `SIGKILL` 仍命中 successor 进程组。
2. 持有 home owner boundary 时，runtime pending writer 仍能发布 owner，证明 writer 与 reaper 没有
   共用同一跨进程临界区。

该评审另确认首次 shutdown、terminal freeze、recovery-only ready IPC、recover AbortSignal 和 hostile
unknown 投影均未闭合。

### 3.2 Windows / resource-state 独立评审

零上下文审查者 `rc4_runtime_windows_fresh_final_review` 判 `No-Go`：3 个 P0、3 个 P1、1 个 P2。
它静态复现：

1. synthetic child 的 `exitCode` / `signalCode` 未初始化，rollback 可把 `undefined` 当 terminal。
2. `(owner=a-b, run=c)` 与 `(owner=a, run=b-c)` 生成相同 Job 名；Job 名也没有绑定 generation。
3. Windows rollback 忽略 terminate/wait 结果，并在 unknown/live/timeout 时丢弃唯一 process capability。

该评审还确认 agent owner writer/reaper 没有完整 identity CAS、exit/close 语义可伪造，以及 Windows
native fault/handle/stdio/permit 测试远未覆盖验收合同。

### 3.3 Codex `gpt-5.6-sol` 对抗评审

模型与档位由进程参数现场确认：`gpt-5.6-sol`、`model_reasoning_effort=max`、`read-only`。

前两次会话持续产生事件但分别触及外部 30 分钟和 15 分钟上限，均 exit 124，未生成最终报告，故不计
作正式结论：

```text
390 lines / 1763213 bytes / SHA-256 f456ab7840bf085a213ac24fee0c2242358ff93aa501734760bc3a482739904b
285 lines / 1433245 bytes / SHA-256 dce66d9bdc87d7c5324b330ed0b893762cf2603e46ced774de0befa7ef0d8c46
```

第三次使用窄化静态 verdict prompt，exit 0 且事件流包含 `turn.completed`。正式产物：

```text
prompt: 32 lines / 3497 bytes / SHA-256 93d250db20ef7f7009cc70db8bcc4feb61594317e63ddd2f83faa8bf04477bcc
log:    32 lines / 915020 bytes / SHA-256 87f7465ff3399b04362cb9ac399a8ba83922f20b0141002e891185f60b9b544a
report: 13 lines / 2763 bytes / SHA-256 e7fdad9eb1e4ba9daaf8cab1cabd558769a40db9711fa0e53ed03e48f1dc6dfa
```

报告 `research/codex-findings/117-rc4-runtime-final-static-verdict.md` 判 `No-Go`，6 条 A 级发现与两路
subagent 结论一致。该会话按约束未运行门禁，审查前后 HEAD 相同。

## 4. 合并 finding 与修复判定

| ID | 级别 | 合并结论 | 当前状态 | 下一实施的最小合同 |
|---|---|---|---|---|
| R1 | A | 旧 generation 可对同 PID successor 发破坏性信号 | `[fail]` | 注册 successor 时淘汰旧 id；current 必须精确匹配 PID map；无 birth proof 禁止 POSIX destructive signal；删除延迟裸 PID fallback |
| R2 | A | runtime/agent writer、reaper、release 未共用 HOME boundary 与完整 CAS | `[fail]` | 所有 publish/reap/release 共用 OS advisory lock；锁内重读完整必填 identity；audit 成功后 CAS unlink；异常向上传播 |
| R3 | A | Job 名有字段拼接碰撞且未绑定 generation | `[fail]` | 使用无歧义、generation-bound grammar；owner record、pending、map、Job/process capability 同代绑定 |
| R4 | A | Windows rollback/terminal/handle ownership 状态机不成立 | `[fail]` | 初始化 terminal 状态；校验 terminate/wait/exit；unknown/live/timeout 保留 Job/process capability 与 owner；exactly-once transfer/close |
| R5 | A | exit/close 可伪造，unknown 被投影为 `exit(1)` | `[fail]` | 只有权威 wait 才发 exit；分别追踪 process terminal、stream EOF/finish 与底层 close；尾部输出完整 |
| R6 | A | 第一次 shutdown 未立即拥有唯一 lifecycle，freeze 早于所有 fallible pre-terminal work | `[fail]` | 首次 bind 前建立 coordinator；同一 AbortSignal/deadline 贯穿全部 startup await；freeze 紧邻唯一 terminal frame |
| R7 | A | recovery-only real prebound ready fire-and-forget；invalid JSON 回 400 后继续业务链 | `[fail]` | 所有 ready/terminal Promise await 并接入唯一 lifecycle；解析失败返回 handled sentinel 并立即停止路由 |
| R8 | B | recover、provision、inactive drain 等 await 后仍有取消窗口 | `[fail]` | 同一 signal 贯穿并在每个 await 后、注册/spawn/permit/tick 前复核 |
| R9 | B | 若干 catch 仍 `String(err)` / `.message`，可泄密或被 hostile coercion 击穿 | `[fail]` | 全部入口复用 trap-free 固定投影，禁止回显 native message/path/secret |
| R10 | B | 测试标题强于杀伤力，Windows native 与真实双进程证据不足 | `[fail]` | 加真实双进程锁竞态、POSIX 同 PID 两代、bind hold、prebound ready rejection，以及 Windows ABI/stdio/permit/fault/handle-count/Job 门禁 |
| R11 | C | Windows argv 接受嵌入 NUL | `[fail]` | file/argv/cwd/env 边界统一拒绝 NUL并补 native negative case |

## 5. 文档与实施对齐裁决

`docs/adr/ADR-003-os-adapters.md` 当前把 Windows Job 名写成
`Global\\SayDoJob-<ownerInstanceId>-<runId>`。这既允许连字符拼接碰撞，也无法满足本轮已批准的“每次
spawn 唯一 generation capability”安全合同。

本项应对齐 canonical，而不是让新实现迁就旧字符串：下一实施工作单元先最小修订工程 ADR，将 Job 名
改为无歧义且显式绑定 generation 的 grammar，再同步 parser、writer、reaper、owner schema 和测试。
设计 ADR 的跨 OS 不变量不变；这是机制层 hardening，不改变产品范围。

其余不一致均应让实现对齐现有 canonical：`fatal > signal > restart`、identity-matched 回收、
audit-before-delete、durable owner、shutdown 后零新工作和 hostile unknown 脱敏均不需要 owner 新裁决。

## 6. 第二次红灯处置

1. 旧实施 session `01a03397-9ddf-7870-93b9-6c68101a1201` 永久弃用，禁止 resume。
2. 只把当前 25 个产品/测试文件作为“失败实现 checkpoint”精确暂存并提交；该提交不表示通过。
3. 从 checkpoint 创建全新分支与 worktree；新 Grok 会话只读取新的完整验收 prompt、canonical、源码和测试。
4. 先写能在当前实现上失败的回归，再修代码；不得用 skip、放宽 timeout、主动 release 或 mock 冒充真实证明。
5. 实施后严格串行运行 platform、CLI、daemon focused、daemon full、typecheck、lint、emoji 和 diff-check；
   Windows-only 项在实体 Windows 补跑。
6. 收口后重新启动两个零上下文 subagent 与一次全新 Codex 对抗评审。任何 A 级 finding 仍为
   `No-Go`，不得进入 privacy、集成、发布、部署或真机分发。

## 7. 当前结论

当前 runtime 不是发布候选。Release 与 mobile 两线虽已独立 Go，但仍须等待 runtime 与 privacy 全部
Go 后才能集成；push、tag、GitHub Release、官网/常驻部署、Mac/Windows/Linux 快启验证、移动真机安装
和 worktree 清理继续冻结。
