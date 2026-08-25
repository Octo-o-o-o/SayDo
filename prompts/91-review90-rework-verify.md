# 评审 91 · 评审 90 回修的复核(零上下文;只验回修,不重复原审)

你是独立复核方。只读仓库 `~/WorkSpace/SayDo`,分支 `main`,HEAD = `1d6680c`。

上一轮(评审 90,报告在 `research/codex-findings/90-week-crosscheck-review.md`)裁决 **No-Go**,
列了 A 级 8 条 / B 级 14 条 / C 级 2 条 / O 级 2 条。本轮**只做一件事**:验证这些条目的回修是否真的成立,
以及**回修本身有没有引入新问题**。

回修台账在 `e2e/evidence/w54b-batch.md` §7,回修提交:
- `058090d` win32 claude 门补四路分支 + 三态 + 圈外预筛(A-1)
- `3bf3d10` 门脚本路径单源(B-5)
- `1d6680c` 其余 A/B/C 级 + 文档 + owner 二次裁决落地

## 逐条复核清单(每条给 CONFIRMED_FIXED / STILL_BROKEN / REGRESSED,附 file:line 或可复跑命令)

**A-1** `buildClaudeGateMjs` 现在是否与 POSIX `buildClaudeGateScript` 真的同分支?
逐项对比:四工具映射、三 kind、三态、圈外预筛语义。`pathOutside` 的 Windows 路径处理正确吗
(盘符 / UNC / 大小写 / `..` 分量 / 前缀陷阱如 `wt2` 不搭 `wt` 便车)?生成的脚本是合法 JS 吗?
测试 `packages/daemon/test/tier1-gate-claude-mjs.test.ts` 是否真的能抓住回归,还是只做了字符串包含断言?

**A-2** identity 把门是否真的与 hook 链解耦?闭环死锁是否真的解开(请从 `validateConfig.ts` 的启动资格 →
`index.ts` 的 gate 启动 → `selfTest.ts` 的 identity 写入,把干净 claude-only 安装的首次武装路径走一遍)?
把 hook 链移出把门集**有没有削弱安全属性**——identity 记录被写入时 gate 可能是关的,这会不会让某个消费点误判"门已就绪"?
win32 分支的 `gateAssetsPresent` 探针够不够(只查文件存在,不验 HMAC/端口)?
`status` 从 `every(ok)` 改成 `some(fail)` 有没有让某种"全 skipped"的病理输入变成假绿?

**A-3** evidence 现在的表述与源码是否一致?`selfTest.ts` 是否仍未实现 init 断言?
C1 判为 [warn] 是否恰当,还是应判 [fail]?

**A-4** `apiKeySource` 严格化只对 `claude_code` 生效。cursor 的 `parseLine` 真的从不产出 `init` 事件吗?
如果将来产出了会怎样?严格化有没有把 fixture 之外的合法形态误杀(例如 CLI 版本升级后改字段名)?

**A-5** `assertClaudeBinaryIdentity` 是否覆盖了**全部** spawn 路径?
`git grep -n 'spawnAgent(' packages/daemon/src` 逐个确认。
抛出的 `Tier1BinaryIdentityError` 在三处调用点是否都被正确结算成 blocked、且**不留半开状态**
(worktree 已供给、tier1_run 已 running、ownership 未建立)?`finalizeFailure` 在此时调用安全吗?
mtime/size 缓存会不会让"内容变但 mtime+size 不变"逃逸——这是方案 D12 明确接受的取舍还是新引入的?

**A-6** `total_cost_usd` 贯通链是否完整(fixture → parseLine → resultEvent → recordTier1SubscriptionRun → cost_entries.meta)?
`result_max_turns.jsonl` 无该字段时行为是否正确(不编数)?新测试断言的 0.0473673 是否真来自 fixture?

**A-7 / B-13** owner 二次裁决已落 canonical(ADR-004 §20/§115 解除注、LINUX-ALIGNMENT §3 边界注、
`history/README.md` 编号政策改写)。判断:改写后的条款**是否自洽**、有没有留下新的自相矛盾?
"解除官网承诺但不解除 SKU 判定"这个切分在文本上站得住吗?

**A-8** gate 串行红线现在登记为"违反"。`docs/plan/IMPLEMENTATION-PLAN-2.md` 与
`docs/review/2026-08-22-week-crosscheck.md` 的措辞是否还有残留的自我开脱?欠账三件写清楚了吗?

**B-1** `gateBindExpected` 由 `listened.bind` 构造。序列化形态与 `writeGateBindAndSecret` 是否**逐字**一致
(`${JSON.stringify(bind)}\n`)?不一致就会恒漂移。请实际比对两处代码。

**B-2** 两个 mjs 的顶层兜底是否真的覆盖?`process.on("uncaughtException")` 在 top-level await 的
ESM 模块里对同步抛出/异步 reject 都生效吗?claude 侧 `emitFail` 的退出码是否仍是 2?

**B-3** `buildGateScript` 现在用 `bashSingleQuoted`。有没有别的地方还在裸拼路径进 shell?

**B-4** `fileToolToEffect` 的 `worktreeRoot` 缺省回落 `cwd`——这个缺省会不会让某个调用点悄悄保留旧的错误行为?
`git grep -n 'fileToolToEffect(' packages/daemon` 逐个确认。边界是否被放宽(圈外的东西现在会不会变圈内)?

**B-6** `isRateRejectStatus` 按 `/[^a-z]+/` 切词。`not_limited` 被判为拒绝(fail-closed 一侧)——
这个选择正确吗?有没有真实 status 枚举会被误伤?请查 fixture 与 `claudeOutcome.ts` 的消费点。

**C-1** `writeDataSurfaceAtomic` 用于非脚本漂移面。判定 `isScript` 用的是路径相等比较——
`hooks.json` 与 `gate-bind.json` 会走对分支吗?win32 下自愈重写后是否**丢了 ACL**
(原路径经 `restrictOwnerOnly`,自愈只 chmod 0600,在 Windows 上 chmod 近乎无效)?

## 另外

- 独立扫一遍这三个回修提交的 diff,报告**回修引入的新问题**(不限于上述清单)。
  `git diff 4d2824e..1d6680c -- packages/`
- `just ci` 我方实测 exit 0、daemon 1783 passed / 5 skipped。若你认为某条回修**没有测试真正锁住**,点名指出。

## 输出

- 每条:编号 + `CONFIRMED_FIXED` / `STILL_BROKEN` / `REGRESSED` + 一句理由 + file:line。
- 然后单列「回修引入的新问题」(按 A/B/C 分级)。
- 最后一句总裁决:`Go` / `修正后 Go` / `No-Go`。
不要复述代码,只写判断与证据。我说的事实与仓库不符就直接指出。
