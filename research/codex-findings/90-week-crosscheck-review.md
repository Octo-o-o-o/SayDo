审查基线冻结为 `a26d5bf`。审查期间 `main` 又追加 `058090d`、`3bf3d10`；前者局部修复 A-1，后者修复 B-5，但都不倒灌为本轮 `a26d5bf` 的既成事实。复跑：`git log --oneline -5`。

## A 级（必修，阻断）

1. **Windows Claude 门合同未实现。** 双脚本写入本身正确，win32 两文件也都执行了 `restrictOwnerOnly`：`a26d5bf:packages/daemon/src/tier1/gateScript.ts:95-105`。但生成的 `gate-claude.mjs` 在 `:407-409` 拒绝所有非 Bash 工具，只发送 command，完全没有 Write/Edit/NotebookEdit/Read 与 `no_decision`，违反 `a26d5bf:docs/09-data-contracts.md:1167,1176`。`no_decision` 不会变成事实放行，而是落到 `:422-429` 的失败出口；结果是 fail-closed 但 Windows Claude 文件工具不可用。基线测试也未覆盖它：

   `git grep -n buildClaudeGateMjs a26d5bf -- packages/daemon/test packages/platform/test`

   该项由批后 `058090d` 修补，仍须纳入新 evidence 与合并态复审。

2. **Claude 首次武装存在闭环死锁，Windows 自检还检查错运输。** 启动资格先要求 identity：`a26d5bf:packages/daemon/src/tier1/validateConfig.ts:173-182`；gate 仅在资格通过后启动：`a26d5bf:packages/daemon/src/index.ts:3576-3643`；自检却要求 gate socket 可达后才写 identity：`a26d5bf:packages/daemon/src/tier1/selfTest.ts:195-244`。因此干净的 Claude-only 安装无法经受支持流程生成首份 identity。Windows 生产走 loopback/HMAC，自检仍调用 `which jq/curl` 并连接 Unix socket：`selfTest.ts:85-104,195-213`，在 Windows 必红。

3. **C1 强制的一发一收 init 物理断言未实现，evidence 反而声称已实现。** 验收锚明确要求版本、登录态、hook、init 断言及 identity：`a26d5bf:docs/plan/IMPL-PROMPT-15-W54B-WIRING.md:35-40`。源码明确把 init 断言推迟到 W5.4-c，检查词表也没有 tools/permission/apiKey 项：`a26d5bf:packages/daemon/src/tier1/selfTest.ts:1-5,33-40`；但 evidence 在 `a26d5bf:e2e/evidence/w54b-batch.md:19-27` 宣称已经实现。这是验收事实错误。

4. **`apiKeySource` 缺失时 fail-open。** 合同是字面条件 `apiKeySource !== "none"` 即终止：`a26d5bf:docs/09-data-contracts.md:1178`。解析器会把缺失/空串丢成 `undefined`：`packages/daemon/src/tier1/backends/claude.ts:137-148`；执行器却只有“是字符串且非 none”才杀：`packages/daemon/src/tier1/executor.ts:1652-1656`。缺字段、空字段或形状漂移都会被接受。现有测试仅覆盖显式 `ANTHROPIC_API_KEY`：`packages/daemon/test/tier1-executor.test.ts:1766-1792`。

5. **Claude binary identity 未按合同在每次 spawn 前核验。** 合同要求启动及每次 spawn 前重验：`a26d5bf:docs/09-data-contracts.md:1174`。生产调用仅在 daemon 启动装配处，spawn 直接使用已缓存路径：`packages/daemon/src/index.ts:3566`、`packages/daemon/src/tier1/executor.ts:1526-1542`。复跑：

   `git grep -n verifyClaudeIdentity a26d5bf -- packages/daemon/src`

   daemon 启动后二进制被替换，后续任务仍可 spawn，identity pin 失效。

6. **`tier1.run` 记账丢失 canonical 必填事实。** 合同要求 meta 含 `modelUsage/num_turns/total_cost_usd_estimate/usage_unavailable`：`a26d5bf:docs/09-data-contracts.md:874-877`。真实 fixture 带 `total_cost_usd:0.0473673`：`packages/daemon/test/fixtures/claude-cli/2.1.220/result_success.jsonl:1`；解析器 `packages/daemon/src/tier1/backends/claude.ts:204-222` 和事件类型 `backends/types.ts:21-32` 均丢弃该字段，`executor.ts:3011-3043` 无法落库。纯函数测试只是人工注入估值：`packages/daemon/test/tier1-claude-outcome.test.ts:65-82`，没有证明生产链。

7. **F1/F13 的官网翻转方向错误，Windows/Linux“现在可用”证据不足。** 官网已承诺两平台现在可用：`a26d5bf:deploy/saydo-octoooo-com/index.html:379,396-402,427,452`。Linux canonical 明确“不升正式 SKU、不作官网承诺”，并把 systemd、doctor/依赖列为阻断，禁止拿 `ubuntu-latest` 判可用：`docs/adr/design/ADR-004-windows-platform.md:20`、`docs/adr/ADR-003-os-adapters.md:176-193`、`docs/plan/LINUX-ALIGNMENT.md:23-42,61-63`。Windows 合并态又存在 A-1/A-2，且 hardening 后未复跑 Windows 全量：`e2e/evidence/windows-alignment.md:101-112`。披露“常驻和通知仍为 macOS”不能把“现在可用”的事实前提补足。

8. **PLAN-2 gate 串行红线确实被违反，不能用合入顺序重释为满足。** 原约束明确暂停 W5.4-b 且不得并行改 gate：`a26d5bf:docs/plan/WINDOWS-ALIGNMENT.md:17,218-221`。报告在 `docs/review/2026-08-22-week-crosscheck.md:49` 承认并行，却在 `:35` 和 `docs/plan/IMPLEMENTATION-PLAN-2.md:78` 称“满足串行意图”。拓扑证明双方从共同祖先并行分叉：

   ```sh
   git merge-base 5a73420 4c4bf96
   git merge-base --is-ancestor 5a73420 4c4bf96; echo $?
   git merge-base --is-ancestor 4c4bf96 5a73420; echo $?
   ```

   输出基点 `11e3653`，两个祖先判断均为 `1`。必须如实登记红线违反，并补合并态 Windows/POSIX 四工具三态测试、真 Claude hook 冒烟及 Windows 合并 HEAD 真机验证。

## B 级（应修）

1. **`gateBindExpected` 没有正常 tick 窗口，但存在可避免的基线投毒 TOCTOU。** 赋值确实发生在 `recover()/tick()` 前：`a26d5bf:packages/daemon/src/index.ts:3632-3644`，所以用户怀疑的普通首次触发窗口不成立；问题是平台已返回可信 `listened.bind`：`packages/platform/src/gate.ts:150-159`，装配层却从刚发布的可变 `gate-bind.json` 回读期望值：`index.ts:3635-3639`。同时期望未赋值时该漂移面被省略：`executor.ts:588-592`。应直接从 `listened.bind` 构造 expected。

2. **Windows mjs 对合法 JSON 的非法形状不能保证失败出口。** `JSON.parse("null")` 后在 `gateScript.ts:243-253` 直接访问 `bind.host`，Promise 会 reject；Cursor/Claude 顶层 `await postGate` 位于 `:340,415`，均无 catch。Claude 路径可能无 deny JSON、退出码也不是合同要求的 2。

3. **POSIX Cursor gate 未转义状态根中的单引号。** `a26d5bf:packages/daemon/src/tier1/gateScript.ts:15-20` 直接拼 `SOCK='...'`、`LOG='...'`；同文件 Claude 版本已经正确使用 `bashSingleQuoted`：`:115-134`。状态根校验 `packages/daemon/src/projects/workspace.ts:107-123` 并不禁止单引号，合法自定义路径会生成语法损坏脚本。

4. **文件“圈内”边界错误地以 hook 当前 cwd 为根，而非 run worktree。** run 匹配允许 cwd 位于 worktree 子目录：`executor.ts:928-945`；随后 `fileToolToEffect` 却收到 `req.cwd`：`executor.ts:798-925`、`fileToolEffect.ts:90-150`。在 `/wt/sub` 运行时访问 `/wt/README.md` 会被误判圈外。复跑：

   `node -e 'const {relative}=require("node:path"); console.log(relative("/wt/sub","/wt/README.md"))'`

5. **供给路径与 drift 基准在接口上可分叉。** guard 使用 `cfg.gateScriptPath`：`executor.ts:579-597`；backend 供给却从 `saydoHome` 重算 `gatePaths`：`executor.ts:1518-1523`。当前 index 恰好传入相同值，但接口没有机械不变量。批后 `3bf3d10` 已修，需补入正式证据。

6. **限流不是“只认明确拒绝态”，而是未锚定子串匹配。** `claudeOutcome.ts:21,38-42` 与 `executor.ts:3053-3058` 使用 `/limited/` 等子串；`unlimited`、`not_limited` 也会被强制改成 blocked。复跑：

   `node -e 'console.log(/rejected|exhausted|limited|exceeded|blocked/i.test("unlimited"))'`

7. **既有测试期望修改超白名单。** 红线只允许 `tier1-config-validate` 点名两处：`IMPL-PROMPT-15-W54B-WIRING.md:27-33`；实际把 `config-project-overrides.test.ts` 中“Claude override 拒绝”改成“接受”。复跑：

   `git diff --unified=5 4c4bf96^ 4c4bf96 -- packages/daemon/test/config-project-overrides.test.ts`

   `tier1-gate-socket` 原七例及 `tier1-executor` 原断言未发现期望改值，但这一个额外修改已构成停点未上浮。

8. **Gate 合同继续分叉。** `AGENTS.md:66` 要求 09 已有类型统一进 `@saydo/contracts`；实际 request/response 在 `gateServer.ts:12-60` 自建，platform 又在 `packages/platform/src/gate.ts:62-65` 重定义 response，contracts 中无对应类型。工程 ADR 仍写二态和“非 Bash deny”：`docs/adr/ADR-003-os-adapters.md:55-66`，与 09 三态/文件合同不一致。实现的无 kind legacy、未知 kind deny 本身正确：`gateServer.ts:39-52,90-103`。

9. **F1“已改稿”是假闭环。** 中文 Docs 仍同时写“macOS-only/其他系统未支持”和“Windows/Linux 支持”：`deploy/saydo-octoooo-com/docs/index.html:132,136,261,269,805,883,893`；英文对应 `en/docs/index.html:133,137,274,282,826,904,914`。源稿也冲突：`docs/site/2026-08-20-docs-page-content.fable.md:32,36,155,161,684,716,751,771`；首页稿 FAQ 仍只写 Mac：`2026-08-20-homepage-structure-copy.fable.md:153-154`。

10. **独立 canonical 扫描还漏了 Windows 通知实现差。** 04/07/ADR 写 Windows toast：`docs/04-key-mechanisms.md:124`、`docs/07-tech-stack-decisions.md:142`、`docs/adr/design/ADR-004-windows-platform.md:53`；实现却固定返回 false、从不 spawn：`packages/daemon/src/callback/desktop.ts:62-68`，测试还锁定此行为：`packages/daemon/test/callback-desktop.test.ts:79-91`。

11. **独立 canonical 扫描还漏了跨平台认证话术。** 10/11 要求“本机认证”、Windows Hello/PIN：`docs/10-voice-ux-spec.md:87`、`docs/11-ui-spec.md:347,355`；golden 仍强制“点一下 Touch ID”：`packages/daemon/src/brain/golden.ts:226-233`，UI 仍显示“批准指纹/注册批准指纹”：`packages/console/src/pages/TaskDetail.tsx:338-344,360,398-409`。

12. **W5.4-b 两提交法被破坏。** 规则见 `AGENTS.md:72-74`、`IMPL-PROMPT-15-W54B-WIRING.md:60`。代码是 `4c4bf96`，evidence 文件到混合 crosscheck 提交 `a26d5bf` 才出现，中间隔了三提交和 merge，且不是 `chore(evidence)`。复跑：

   `git log --all --follow --format='%h %P %s' -- e2e/evidence/w54b-batch.md`

13. **journal 撞号处置不符合现行“原始证据不重编号”规则。** 政策见 `history/README.md:7`、`history/DEV-VERSION-LEDGER.md:131-133`；Windows 的 R80/R81 实际被改为 R89/R90，却声称原文未改。复跑：

   ```sh
   git show 05bc91d:history/PROCESS-JOURNAL.md | rg -n '^## R8[01]\b'
   git diff 05bc91d..4d2824e -- history/PROCESS-JOURNAL.md | rg '^[-+]## R(80|81|89|90)'
   ```

14. **crosscheck 报告 owner 出口断裂。** `docs/review/2026-08-22-week-crosscheck.md:72-74` 指向不存在的 §5；复跑 `git show a26d5bf:docs/review/2026-08-22-week-crosscheck.md | rg '^## '` 只到 §4。发布口径、撞号例外等真实 owner 项没有列出。

## C 级（建议）

1. **漂移自愈不应统一使用脚本 writer。** `writeGateScriptAtomic` 固定 chmod `0755`：`gateScript.ts:73-77`；drift guard 对 `hooks.json`、`gate-bind.json` 也调用它：`executor.ts:635-644`。未证明形成 bypass，但会把 JSON 改成可执行文件，Windows 下也没有重走专用 ACL 写入函数。

2. **台账第五个新增行没有实际末码。** `history/DEV-VERSION-LEDGER.md:129` 仍写 `(本轮)`；前四行列出的提交/range 与祖先链相符。应由后续 evidence/评审提交回填 `a26d5bf`，避免自指。

## O 级（需 owner 裁决）

1. **“可前台从源码运行”是否等于“现在可用/正式支持”需要 owner 定义统一发布门槛。** 当前 ADR-004 同时存在“不作 Linux 官网承诺”(`:20`)、条件已达成(`:33`)和“不宣布产品已支持 Windows”(`:115`)三种口径。裁决前应按较保守 canonical 撤回外部承诺。

2. **如要允许 journal 为解决交叉引用而重编号，需 owner 明确修改 `history/README.md:7` 的保号政策。** 在政策修改前，当前 R89/R90 处置只能判不合规，不能靠“引用较多”自行创设例外。

核验未发现缺陷的部分：Cursor argv/parser/`kill_on_result`/`shell_started` 保持原语义（`packages/daemon/src/tier1/backends/cursor.ts:18-61`、`executor.ts:965-985`）；Claude argv、工具封闭、危险旗标、env 两键、live steer 与 `observedModelExempted=false` 静态接线符合红线（`backends/claude.ts:7-23,52-118`、`operations.ts:59-70`、`executor.ts:2993-3008`）；Claude `filesWritten` 只有全局门脚本，没有漏掉 worktree 漂移面（`backends/claude.ts:235-245`、`executor.ts:1499-1515`）；逐面审计、取消全部活跃 run、只修漂移面保留了双方安全属性（`executor.ts:604-646`）。`native_session_confirmed` 也有 v30 增量迁移、真实 v4 fixture 数据升级及动态 latest 断言：`storage/ddl.ts:770-818`、`test/fixtures/schema-v4-era.sql:76-82`、`test/storage-migration-v5.test.ts:41-49,114-115,313-363`。

总裁决：No-Go——被审批次同时存在 Windows Claude 不可用、首次武装闭环、订阅身份 fail-open、每次 spawn 身份核验缺失、成本合同丢字段及错误平台公开承诺；批后两个局部修复不足以消除其余阻断项。