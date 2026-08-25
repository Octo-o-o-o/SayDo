## 结论

**No-Go。A=3，B=2，C=0。**

原 3A/4B 中，A2、B2、B4 的指定反例已关闭；A1、A3、B1、B3 仍未完全关闭。全程只读，未修改文件、未启动 subagent。

## Findings A

### A1：pending receipt 可被当作 active receipt，正常晋升也缺少可验证链

[cliRuntime.ts:299](~/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:299) 的审计明确记录 `target` 和 activation digest，但 [cliRuntime.ts:419](~/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:419) 重建 receipt 索引时只检查 `selfTestStatus` 和 evidence，完全忽略 `target`、activation 与 `setup.cli_runtime_promoted`。生产门 [cliRuntime.ts:409](~/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:409) 又只查询这个 `auditId -> digest` Map。

反例：

1. active config 使用 binding X，但尚无 active 登记。
2. stage 一个只改 budget、模型仍为 X 的 pending config。
3. `/api/setup/test` 产生 `target=pending` 的成功审计和 staged registry。
4. 在同一 `SAYDO_HOME` 把 `cli-runtime.pending.json` 复制为 `cli-runtime.json`。
5. resolver 会接受该行并武装 X，因为数据库中确有相同 `auditId/refDigest`，但它只是 pending receipt。

正常晋升也原样复制 pending row（[cliRuntime.ts:381](~/WorkSpace/SayDo/packages/daemon/src/config/cliRuntime.ts:381)）；晋升审计直到 active registry 发布、数据库打开、server listen 以后才补写（[index.ts:194](~/WorkSpace/SayDo/packages/daemon/src/index.ts:194)、[index.ts:2523](~/WorkSpace/SayDo/packages/daemon/src/index.ts:2523)），且 resolver 从不验证它。违反 [docs/09:1143](~/WorkSpace/SayDo/docs/09-data-contracts.md:1143) 的“待晋升证据不得写成已武装”。

现有复制测试只复制到没有原审计的新 HOME（[t18a-cli-slots.test.ts:687](~/WorkSpace/SayDo/packages/daemon/test/t18a-cli-slots.test.ts:687)），未覆盖同 HOME staged receipt。

最小修法：active resolver 只接受 `target=active` receipt，或验证包含 activation、源 receipt、槽位/binding/binary digest 的不可变 promotion chain；晋升审计必须先落，再原子发布 active registry。补同 HOME 复制、晋升审计前崩溃和正常 SQLite pending 晋升测试。

### A2：BYOA 只杀直接子进程，后代可泄漏或让 drain 永久挂起

[runner.ts:89](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/runner.ts:89) spawn 时没有建立独立进程组；SIGTERM/SIGKILL 都只调用直接 child 的 `kill`（[runner.ts:127](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/runner.ts:127)、[runner.ts:134](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/runner.ts:134)），settled 又只等直接 child 的 `close`（[runner.ts:229](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/runner.ts:229)）。

两个反例：

- CLI 启动 `stdio:"ignore"` 的长驻后代后退出：direct child settled，recovery restart 继续，但后代仍存活，新旧执行进程并存。
- 后代继承 stdout/stderr pipe：直接父进程退出后 pipe 仍被占用，`close` 不结算；三秒后的 SIGKILL 仍只打已退出的父 PID，`abortAllByoaInvocations()` 可永久等待。

recovery-only 的永久 draining、拒新调用、等待 direct child 的顺序已经接上（[recoveryOnlyServer.ts:148](~/WorkSpace/SayDo/packages/daemon/src/api/recoveryOnlyServer.ts:148)），但新 fixture 只持有一个直接进程（[fake-codex-hold.mjs:19](~/WorkSpace/SayDo/packages/daemon/test/fixtures/fake-codex-hold.mjs:19)），测试也只有 restart/SIGTERM（[recovery-only-process.test.ts:207](~/WorkSpace/SayDo/packages/daemon/test/recovery-only-process.test.ts:207)）。

最小修法：POSIX 下像现有 Tier 1 一样使用 `detached:true` 和负 PID 发送组信号（参考 [tier1/executor.ts:133](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:133)、[tier1/executor.ts:173](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:173)）。补启动真实孙进程的 restart、SIGINT、SIGTERM 测试，并分别覆盖继承 pipe 与忽略 stdio。

### A3：首轮安全状态不是 sticky，tripwire/异族模型可被后续请求洗成成功

有三条可复现路径：

- Codex tool event 携带异族 `model` 时，parser 正确得到 `family_mismatch`，但流式回调先按 `tool_call` 返回 `tripwire`（[provider.ts:275](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:275)），随后安全重试条件只看 `turn.safetyStop` 和正文标记（[provider.ts:416](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:416)），忽略 `consumed.voidReason="family_mismatch"`。第二次无 model 的干净响应可借 fixed-family 豁免成功。
- Claude 同一个 assistant event 同时包含非空 text 与 `tool_use` 时，[parsers.ts:114](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/parsers.ts:114) 直接返回 `tool_call`，丢掉该 event 的 text 和 model。实际纯函数输出为 `hadConsumableOutput:false`，因此错误获得“零消费”重试。
- Cursor 第一次纯 tripwire、第二次强化响应 schema 非法时，[provider.ts:449](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:449) 还会启动第三次 schema retry；合同只允许 tripwire 后一次强化重试。

此外强化 prompt 用另一个字符串替换了逐字硬头（[provider.ts:57](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:57)、[provider.ts:109](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:109)），不再以 canonical 指定句逐字起头；限流判定还优先于 safety stop（[provider.ts:426](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:426)），可把 tripwire 重标成 `retryable:true`。

最小修法：使用单一调用级重试预算；仅当 `safetyStop=tripwire`、`consumed.voidReason=tripwire`、无任何正文/model 冲突时允许一次重试；一旦安全重试发生，禁止 schema retry。ParsedEvent 应保留混合 event 的 `observedModel` 和“含非空正文”事实。safety stop 必须优先于限流分类。强化头应为精确基础头加附加句，而不是替换基础头。

## Findings B

### B1：限流 stderr 规则过宽，且分类晚于网络重试

[billing.ts:65](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/billing.ts:65) 使用裸 `rate limit`、`quota exceeded` 等模式扫描所有非零 stderr。实际执行纯函数反例：

```text
ENOSPC: Disk quota exceeded
```

三家均被判为 `subscription_rate_limited`。Codex/Cursor 还会把：

```text
authentication failed: login rate limit reached
network proxy rate limit reached
```

误判为订阅额度耗尽。

更严重的是，网络重试在 [runner.ts:63](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/runner.ts:63) 先决定，provider 直到整个 turn 返回后才分类。首轮 stderr 为 `network request rate limit reached`、第二轮成功时，生产缺省允许一次网络重试（[runner.ts:242](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/runner.ts:242)），最终会返回成功而不是 fail-fast。测试 helper 默认强制 `networkRetryLimit:0`（[byoa-fake-cli.e2e.test.ts:55](~/WorkSpace/SayDo/packages/daemon/test/byoa-fake-cli.e2e.test.ts:55)），掩盖了生产缺省交互。

最小修法：只接受已登记的供应商原生错误 code/envelope 或精确额度措辞；排除磁盘、登录和网络上下文。分类必须在网络重试决策前完成。补 stderr-only、磁盘 quota、登录 rate limit、网络与“首轮限流加 network 字样、第二轮成功”的测试。

### B2：session 取消没有退休 generation，排队控制轮可复活 suspended session

[dialog.ts:231](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:231) 的 `abortSession()` 只 abort controller，不递增 generation，也不标记 session 生命周期终止。当前用户轮的 finally 仍会在 [dialog.ts:526](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:526) 清状态并泵控制队列。

反例：用户轮运行时已有排队 control；该轮调用 `sessions.suspend()`，index 的 `onSuspend` abort 模型；用户轮 finally 随后泵起 control。`runControlTurn()` 调用 `ensureSession()`（[dialog.ts:379](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:379)），而 suspended session 会被重建为 talking（[voiceSessions.ts:129](~/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts:129)）。结果是刚挂起的 session 被控制轮复活。

最小修法：区分“新用户轮替换”和“session 生命周期终止”；终止时递增 lifecycle generation，并让 `pumpControlQueue` 在 dequeue 前确认 session 仍为 talking。控制轮不得自行 rebuild suspended session。补 explicit/idle suspend 加 queued control 的晚结算测试。

## 原 3A/4B 裁决

| 原项 | 裁决 | 证据 |
|---|---|---|
| A1 registry | Open | receipt 完整字段、旧版本拒绝、跨 HOME 复制已修；`target/promotion` 链仍缺失 |
| A2 旧轮竞态 | Fixed（指定反例） | generation/controller 双比较见 [dialog.ts:518](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:518)、[dialog.ts:526](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:526)；回归测试见 [control-turn-v04c.test.ts:233](~/WorkSpace/SayDo/packages/daemon/test/control-turn-v04c.test.ts:233)。session 终止边缘另见 B2 |
| A3 recovery drain | Open | direct child 顺序已修；进程树未收口 |
| B1 Codex model | Open | parser 的所有已知分支已携带 model（[parsers.ts:161](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/parsers.ts:161)），但 tool event 冲突可被安全重试洗掉，见 A3 |
| B2 evaluator 重解析 | Fixed | thinking 先执行、每槽重载 registry、登记后更新 receipt Map，见 [setup.ts:907](~/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:907)、[setup.ts:929](~/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:929)、[setup.ts:1040](~/WorkSpace/SayDo/packages/daemon/src/api/setup.ts:1040)；对应测试见 [t18a-cli-slots.test.ts:751](~/WorkSpace/SayDo/packages/daemon/test/t18a-cli-slots.test.ts:751) |
| B3 限流接线 | Open | 正向 code/retryable 已接入，但 stderr 假阳性与网络重试顺序仍错 |
| B4 fake NDJSON/idle | Fixed | 真非法 NDJSON 和持续输出后静默 fixture 见 [fake-byoa-cli.mjs:87](~/WorkSpace/SayDo/packages/daemon/test/fixtures/fake-byoa-cli.mjs:87)、[fake-byoa-cli.mjs:89](~/WorkSpace/SayDo/packages/daemon/test/fixtures/fake-byoa-cli.mjs:89)；测试见 [byoa-fake-cli.e2e.test.ts:138](~/WorkSpace/SayDo/packages/daemon/test/byoa-fake-cli.e2e.test.ts:138) |

并发 limiter、输入 cap、独立 schema 临时目录、空 cwd 与 finally 清理未发现新的 A/B 级退化；其中 cwd/schema 代码见 [provider.ts:198](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:198)、[provider.ts:472](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:472)。

## 实际验证与边界

执行结果：

- 完整读取 prompt；基线 diff 共 2269 行，按行分块读完，同时读取 AGENTS、原报告、docs/07、docs/09 及相关源码/测试。
- `pnpm --filter @saydo/daemon typecheck`：exit 0。
- `pnpm exec eslint packages/daemon/src ...相关测试文件`：exit 0；六个测试文件被 ESLint 配置明确忽略，因此只证明源码 lint。
- `git diff --check b31a5c34774cefe7cc148c40c4261438e1b06ccd`：exit 0。
- 三组 `node --import tsx --input-type=module -e ...` 纯函数反例：exit 0；确认 mixed Claude 正文被记成零消费、Codex tool/model 冲突满足当前重试条件、磁盘/认证/网络错误存在限流假阳性。
- 定向 Vitest：exit 1，`Tests no tests`；五个 worker 均因只读沙箱无法创建临时 `ssr` 目录而报 `EPERM`。这不是代码测试失败，也没有任何测试实际运行。
- `bash scripts/check-emoji.sh`：因 `mktemp EPERM` 未开始扫描，不能宣称门禁通过。
- `git diff --quiet ... -- packages/console`：exit 0。
- 未运行真实 Codex smoke，避免外部订阅调用；未运行 `just ci`。
- 结束时 `git status --short` 与评审开始时一致，本审没有写文件。

**OPEN QUESTION：**晋升凭据采用“为 active 重签 receipt”，还是让 resolver 验证完整 `setup.cli_runtime_promoted` chain，需要 owner 定型；两种方案都必须消除当前 target-blind Map，选择不影响本轮 No-Go。

## 回修 Triage 与最终复审（2026-08-11）

上文是首轮只读对抗审的历史 No-Go 快照，不删除、不改写。施工随后逐项复现、回修并沿同一
Codex thread 续审；最终裁决取本节，不把中间 No-Go 冒充终局。

### 首轮 findings 处置

| 首轮项 | 行动与反例 | 终局 |
|---|---|---|
| A1 pending receipt 可武装 active | receipt 绑定 target+activation；启动晋升只读取匹配当前 activation 的 pending receipt，先原子写 active 成功审计并重签 receipt，再发布 registry；补同 HOME 复制、旧 activation 与手写 registry 反例 | Fixed |
| A2 BYOA 后代泄漏 | POSIX spawn 建独立进程组，TERM/KILL 发往组并等待组消失；补继承 pipe、忽略 stdio/TERM 的真实孙进程，以及 recovery restart/SIGINT/SIGTERM 进程测试 | Fixed |
| A3 tripwire 状态可洗白 | model mismatch 优先；混合事件保留 model/正文消费事实；tripwire、网络与 Cursor schema 共用一次调用级重试预算；任一订阅记账失败 sticky；强化头保留精确基础硬头 | Fixed |
| B1 限流误报与网络重试抢跑 | 仅非零 stderr 或三家明确 failure event 参加分类；先按完整错误块/envelope 排除 auth/oauth/login/proxy/disk/filesystem/storage，再匹配供应商额度措辞；真限流在网络重试前截停 | Fixed |
| B2 suspend 后控制轮复活 | session retire 递增 generation、abort controller，pump 前核 durable `talking`；补 explicit/idle suspend 与 queued control 的晚结算反例 | Fixed |

### 续审新增 findings 处置

- 空 cwd 规格：cage cwd 与 schema 临时目录彻底分离，子进程启动时回传 `cwdEntries=[]`，finally
  独立清理两目录；真实 smoke 同步输出 `cwdEmptyAtSpawn` 与 `cwdCleaned`。
- recovery 并发 restart：路由响应前同步 claim `exitIntent` 并进入永久 drain；后续 restart/self-test
  拒绝，signal 与 restart 互斥；双 restart 真实进程反例只允许一个新实例。
- 成功正文含额度词：stdout 不再做 raw 全文 regex，只读取已确认 failure event；三家成功正文
  `rate/usage limit` 均不得误报。
- barge-in 竞态：barge 时退休旧用户轮并置 `speechPending`；control pump 等待非空、空或确认截获
  ASR final 结算，旧轮 finally 不得抢跑。
- 限流上下文分散：stderr 以完整块、结构事件以完整 envelope 判定；递归收集最终改为显式
  worklist，20,000 层且小于 512KB 的 failure envelope 不再造成调用栈溢出。

### 最终独立复核

- runtime/security 独立复核：A=0、B=0、C=0，Go；重查 receipt/activation、进程组 drain、
  tripwire/记账 sticky、限流分类与原 3A/4B，无未关闭反例。
- contract/test 独立复核：A=0、B=0、C=0，Go；逐项核对 setup/生产 resolver 一致性、空 cwd、
  recovery 退出、竞态测试与真实 smoke 证据，无未关闭反例。
- Codex 同线程末轮复审：**Go，A=0 / B=0 / C=0**。确认显式 worklist、failure-only gate、
  完整 envelope 负面语境排除与深层回归均闭环；原 3A/4B、tripwire、speechPending 未退化。

### 最终验证

- `pnpm ci:node`：exit 0；typecheck、lint、emoji gate 全绿；contracts 7 files/91 tests，console
  14 files/86 tests，daemon 94 files passed/2 skipped、1152 passed/4 skipped。
- `pnpm --filter @saydo/daemon exec tsx test/byoa-smoke.mjs`：exit 0；真实 Codex cheap self-test
  返回 `ok=true`、`resultOk=true`、`schemaValid=true`、`toolCallCount=0`、`voided=false`、
  `cwdEmptyAtSpawn=true`、`cwdUnderTmp=true`、`cwdCleaned=true`、
  `observedModelSource=verified_binary_default`，耗时 15222ms。
- 最终 Codex 末轮可执行门禁：daemon typecheck、源码 ESLint、`git diff --check` 与 console 越界
  diff check 均 exit 0。它的只读沙箱内 Vitest 因系统临时 `ssr` 目录 `EPERM` 未进入用例；不将
  该次写成测试通过。上面的全量 CI 与真实 smoke 均由主流程在沙箱外实跑。
- 本节复核的代码/canonical/测试提交为
  `d88fc7f91067624780d7dff9c62e8a4db7674312`；证据提交不自指。
- `packages/console` 相对基线无 diff；未 push、未部署、未改常驻 runtime。

## 最终裁决

**Go。A=0，B=0，C=0，OPEN QUESTION=0。**
