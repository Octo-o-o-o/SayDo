结论：`No-Go`。在 `afd31b4` 上，6 项中仅 B-3 完整修好；另有 1 个新引入的 A 级 workspace 身份回退。

## 问题一

1. **A-5：`STILL_BROKEN`（运行时代码已修，回归证明未成立）**

   - 新增位置正确：catch 分支在 `active.delete` 前 resolve 并立即 return，不会执行函数末尾第二次 resolve：`packages/daemon/src/tier1/executor.ts:2375-2404`。
   - `resolveClaim` 先清空回调再调用，重复调用幂等：`packages/daemon/src/tier1/executor.ts:571-575`。
   - 逐个检查 `active.delete`：`:2452-2453`、`:2497-2498` 均先 resolve；`:2029` 的现有调用方已分别在 `:1510`、`:2854`、`:2869-2874`、`:3222` 释放 claim；shutdown 的无 completion 分支对应的 completion 在 `:1245-1246`、`:2729-2732` 同步赋值，没有当前可达的漏放路径。
   - 但新测试完全未进入该分支：它在 tick 前把任务改成 `cancelled`（测试 `:2011-2016`），而认领 SQL 只选 `queued/running`（生产 `:1100-1113`）；`spawned=0` 只证明没有认领，审计断言 `count >= 0` 恒真（测试 `:2018-2026`）。

2. **B-3：`CONFIRMED_FIXED`**

   - POSIX 转义是正确的 shell 单引号算法，独立 `/bin/sh` round-trip 对含空格及 `'` 的路径恢复了原值：`packages/daemon/src/tier1/adapter.ts:50-53`。
   - Cursor 的 `hooks.json` 与 Claude 的 `--settings` 都把它放在 command 字段：`adapter.ts:56-63`、`backends/claude.ts:102-114`。
   - 对 `cursorHookCommand` 的全仓检索仅有这两个生产消费方及测试，没有第三方把返回值当文件路径使用。

3. **B-6：`STILL_BROKEN`**

   - `not_cached_but_limited` 与 `rate_limited_not_cached` 判 true 是对的。
   - 但紧邻前词规则仍把 `not_rate_limited`、`not_quota_exceeded` 错判为 true：`packages/daemon/src/tier1/claudeOutcome.ts:31-36`；现有测试只覆盖了更简单的相邻否定：`packages/daemon/test/tier1-claude-outcome.test.ts:122-130`。
   - 仓库真实 fixture 的 `rate_limit_info.status` 只出现 `allowed`；`rejected` 出现在另一个 `overageStatus` 字段：`packages/daemon/test/fixtures/claude-cli/2.1.220/rate_limit.jsonl:1`。因此没有证据支撑这套自然语言分词；应按已观测 vendor 枚举精确匹配。

4. **C-1：`STILL_BROKEN`**

   - POSIX 上条件恒不进入，没有副作用：`packages/daemon/src/tier1/gateScript.ts:81-99`。
   - Windows 的 ACL 收紧及 readback 会抛错：`packages/platform/src/win32.ts:336-413`。
   - drift 自愈会捕获异常并拒绝当前请求，但 rename 已完成；下一请求只比较内容，因内容已正确而不会重试 ACL，随后继续处理 gate：`packages/daemon/src/tier1/executor.ts:616-666`。因此失败没有持续 fail-closed。
   - 台账声称删除的重复调用仍存在：`gateScript.ts:117-126` 对照 `e2e/evidence/w54b-batch.md:125`。

5. **A-2：`STILL_BROKEN`**

   - 多出的纯 TCP connect 不会进入 HTTP request/HMAC handler，因此不会增加 `gateSeq`、审批审计或应用层请求日志；只是一个最长 2 秒的连接：`selfTest.ts:133-143` 对照 `packages/platform/src/gate.ts:88-129`。
   - 也正因没有发送 HMAC 请求，它只能证明“某个进程监听该端口”，不能证明 bind、secret 与当前 daemon 配对。
   - 端口没有校验 `<=65535`：`selfTest.ts:125-129`；非法大端口会让 Promise reject，进而使整个自检抛出。
   - `hadUsableIdentityBefore` 不能代表当前 daemon 是否已武装。首次写登记后、未重启时第二次自检会取消重启处方，测试甚至固化了这个错误：`selfTest.ts:289-337`、`tier1-self-test.test.ts:190-211`；启动资格实际只在 `index.ts:3551-3577` 计算一次。
   - `verifyClaudeIdentity` 会填充 mtime/size digest 缓存：`providers/binaryIdentity.ts:29-37`。正常路径下新登记使用 uncached hash（`selfTest.ts:292-305`），不会改变本次结果；同 mtime/size 漂移仍是既有 D12 缓存风险，不是该位置的新影响。

6. **A-1/B-4 回滚：`STILL_BROKEN`**

   - 脚本以 hook `cwd` 为圈根：`gateScript.ts:194-207`、`:438-460`；daemon 则以 `run.worktree` 为权威根，并明确接受子目录 cwd：`executor.ts:843-909`、`:948-965`。
   - 保留预筛是 fail-closed 过拒，不是安全放行；但仍违反 worktree 圈合同。当前 vendor 行为“通常上报根 cwd”不是仓库机械保证。
   - “否则只剩 daemon 单层”和“要改 7 个受保护测试”都不能证明实现正确。若测试红线不允许修改，应停点上浮或明确延期；不能据此保留已知错误并称修好。

## 问题二：新问题

**A 级**

- Workspace 身份校验删除 `dev` 比较，只剩 path+inode：`packages/daemon/src/projects/workspace.ts:243-273`。inode 仅在单一 filesystem 内唯一，换卷后同 inode 可碰撞，导致错误 workspace 被接受；同时直接分叉 canonical 的 `realpath + (dev,ino)` 合同：`docs/09-data-contracts.md:100-110`、`:155-158`。应先设计稳定卷身份及迁移并回写 canonical，不能全平台直接忽略 `dev`。

**B 级**

- `restartRequiredToArm` 以登记文件状态替代 daemon 当前武装状态，第二次自检会错误撤销必要处方：`selfTest.ts:289-337`。
- 新 TCP 探针缺端口上界，畸形 bind 可让整个自检 reject：`selfTest.ts:125-143`。
- `claudeOutcome` 的否定修复未闭合，仍可能把健康态错误转成 blocked：`claudeOutcome.ts:31-36`。

**C 级**

- Windows ACL 自愈失败未锁存、后续不重试；`ensureGateScript` 还留下重复 ACL 调用：`executor.ts:616-666`、`gateScript.ts:117-126`。
- A-5 测试未认领任务且使用恒真断言：`tier1-executor.test.ts:2003-2026`。
- 新增缺成本字段测试用 `if (cost)` 跳过核心断言，成本行完全没写也会绿：`tier1-executor.test.ts:1987-2001`。
- B-3 两个消费方测试都拿同一个 helper 生成期望值，没有真正执行含空格/单引号的命令：`tier1-claude-backend.test.ts:83-109`、`tier1-cursor-backend.test.ts:54-65`。

**总裁决：`No-Go`。** 至少先修 workspace 身份 A 级回退、按真实运行态报告重新武装、让 Windows 自愈 ACL 失败持续 fail-closed、收敛 rate-limit 枚举，并补上非空转的 A-5/成本测试；A-1/B-4 必须真正对齐或明确作为未实施项上浮接受。C3 与 init 断言继续如实登记即可，它们不是本次 No-Go 的新增根因。

以上行号全部取自 `afd31b4` 冻结快照；未把后来推进到的 `1d1d822` 纳入结论。