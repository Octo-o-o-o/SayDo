# RC4 runtime 第二次红灯后换新会话：managed timeout 回归

你是全新的实施会话。不要 resume 任何旧会话，不要读取 `logs/`、旧 Grok 输出或实施解释。不要提交、
推送、联网或改动用户原始 dirty worktree。只在本文件所在 worktree 施工。

先完整读取适用 `AGENTS.md`、`prompts/178-rc4-runtime-second-red-fresh-hostile-implementation.md` 和
`prompts/180-rc4-runtime-second-red-first-readback-return.md`，再逐项核对当前 diff。prompt 180 的四个 P1
刚完成第一次返工，但宿主机门禁稳定发现新的 managed timeout 回归；这是同一实施会话第二次红灯，
所以本轮必须由你这个零上下文新会话接手。

## 宿主机真实红灯

完整聚焦命令：

```bash
pnpm --filter @saydo/daemon exec vitest run \
  test/process-group-lifecycle.test.ts \
  test/runtime-child-registry.test.ts \
  test/tier1-executor.test.ts \
  test/byoa.test.ts
```

结果：`exit 1`，`314 passed / 1 failed / 1 skipped`。唯一失败：

```text
managed lifecycle 不得降成 blocked > timeout + 捕获 TERM 后 exit 0 仍失败
packages/daemon/test/tier1-executor.test.ts:4807
Expected: "blocked"
Received: "running"
```

宿主又单独运行：

```bash
pnpm --filter @saydo/daemon exec vitest run test/tier1-executor.test.ts \
  -t 'timeout \+ 捕获 TERM 后 exit 0 仍失败'
```

结果仍为 `exit 1`，`1 failed / 146 skipped`，同样在约 1.2 秒后得到 `running`。这不是并发噪声或沙箱
`/bin/ps` 限制。

## 必须修复的合同

- managed setup/verify command 到达 timeout 后，即使目标捕获 TERM 并以 exit 0/close 0 收口，也必须保持
  timeout business failure；setup 调用方必须把 task 结算为 `blocked`，不得继续启动 agent 或停在
  `running`。
- timeout、pipe failure、nonzero exit 都是普通业务失败；没有 signal/release/unreaped failure 时不得污染
  lifecycle barrier。
- signal/release/unreaped 与业务失败同时存在时仍须按 prompt 178/180 的 first-seen exact 叶保真。
- 必须定位生产根因，不能放宽/删除/延长现有测试，也不能只在测试里多等。增加或加强断言，机械证明：
  timeout latch 在 TERM→exit0→close0 后仍为真，managed result 对调用方是 exit nonzero 或受控 business
  reject，task 最终 blocked、agent spawn=0、`lifecycleContamination() === null`。
- 重新审视 `finalizeInvocationWait()`、`runManagedCommand()` 和 `settleWithLeaseRelease()` 的责任分界；若
  `businessOf` 只在 release failure 路径消费或导致正常 release 时 business latch 丢失，必须修正合同并
  为 success/nonzero/timeout/pipe/release 组合补 exact 回归。不要仅根据这条提示下结论，先用代码和测试
  证明真实根因。
- prompt 180 四项 hostile 修复必须全部保留：pipe SECRET 零泄漏、distinct pipe identity 有序、
  undefined work + signal 双叶、revoked Proxy Windows rollback 与 Tier1 catch trap-free。

## 必跑门禁

1. 先跑上述单项失败测试，必须真实 exit 0；
2. 跑 timeout/nonzero/pipe/release/signal 相邻聚焦用例；
3. 跑四文件聚焦命令，宿主验收目标为 `315 tests` 中除既有平台 skip 外零失败；
4. `pnpm --filter @saydo/daemon test`；
5. `pnpm --filter @saydo/daemon typecheck`、根 `pnpm lint`、`bash scripts/check-emoji.sh`、
   `git diff --check`。

若 workspace sandbox 的 `/bin/ps` 被拒，原样报告并列出宿主复跑命令；不得把沙箱失败写成通过。结束前
清理你自己的测试进程组和 ignored 临时根，不要生成 commit。
