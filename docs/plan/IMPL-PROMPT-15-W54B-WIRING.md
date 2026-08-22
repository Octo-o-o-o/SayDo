# SayDo W5.4-b 生产执行主流程接线批(w54b-wiring)· 实施 Prompt(第十五轮交接;2026-08-21,owner 停点已确认)

> 方案正本 = `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` v3.1(下称「方案」;已过 77 号对抗评审 + 阶段 A 终版 spike 定档)。本 prompt 只做批级裁剪与坐标锚定,**细节冲突一律以方案 §3(机制)与 09 canonical 为准**;方案与 09 冲突以 09 为准(AGENTS.md 契约纪律)。
> 调度分工：实施 = Grok CLI `grok-4.6`、`--reasoning-effort xhigh`、`--always-approve --sandbox workspace --no-memory --disable-web-search --max-turns 60`；评估 = 独立只读会话；实施与评估会话隔离。C2a 派发正文见 `prompts/w54b-c2a-grok-implementation.md`(已收口:daemon 1737 passed / 4 skipped,`just ci` 0);C2b 见 `prompts/w54b-c2b-grok-implementation.md`。
> 编号注:IMPL-PROMPT 序列 11 号曾撞号(public-readiness 与 status-alignment,后者实为第 14 轮,勘误见 `history/DEV-VERSION-LEDGER.md` §3),本批顺延为第 15 轮。
> 范围一句话:把 W5.4-a 已收口的 claude 纯函数层(backends/门脚本/effect/终态/记账纯对象)**接进生产执行主流程**——配置、审批门、恢复、记账、自检、console;live 冒烟与 conformance 归 W5.4-c,不在本批。

## §0 开工前置断言(逐条实测,任一红 = 停,报告调度方;禁止"应该已就绪")

1. canonical 前置已入库:`rg -c "tier1\.run|claude_bin|native_session_confirmed|GateWireRequest" docs/09-data-contracts.md` ≥ 4 处命中;`rg -c "supersede 2026-08-21" docs/07-tech-stack-decisions.md` ≥ 1;ADR-002 文末有「状态更正(2026-08-21」节。这些是 w54b-canonical-preface 批(评审 89)的产出,若只在工作区未提交 ⇒ 询问 owner 是否先入库或授权基于工作区实施。
2. `HANDOFF.md` §1 批次指针 = 空或 `w54b-wiring`(开批时写入 `w54b-wiring`);若为其他值 ⇒ 停。
3. w54a readback 处置在案:`docs/review/` 存在 w54a impl-readback 报告,或 owner 书面豁免记录(HANDOFF §1 / journal);两者皆无 ⇒ 停,上浮。
4. 基线绿:`just ci` exit 0(记录各包用例数作为本批基线);`git log -1` 记录开批 HEAD。
5. 代码锚在位(W5.4-a 产物;行号自行实测,漂移不算红、锚缺失才算红):`packages/daemon/src/tier1/backends/{claude,cursor,types}.ts`;`fileToolToEffect`(`tier1/fileToolEffect.ts`)、`buildClaudeHooksSettings`/`parseClaudeTier1Line`(`backends/claude.ts`)、`buildClaudeGateScript`(`tier1/gateScript.ts`)、`classifyClaudeRunOutcome`/`buildTier1SubscriptionCostEntry`(`tier1/claudeOutcome.ts`)、`readDevAdapter`(`index.ts`,三处消费)。
6. 本机 `claude` CLI 登录态与版本:`claude --version` 与 `claude auth status`(loggedIn=true);版本若 ≠ 2.1.220 ⇒ 不停批,但登记差异并在 C1 的 pinned_version 用实测值,fixture 兼容性问题如实上报。

## §1 必读(顺序)

1. `HANDOFF.md` §0(两条硬教训)+ §4(铁律速查)+ §2-6(Claude 硬约束)。
2. 方案 §3 全节(机制设计,照抄源)+ §6「W5.4-b · 接线」节(任务清单正本)+ §4(安全矩阵)+ §2 D2-D14(决策边界)。
3. `docs/09-data-contracts.md` §11「claude_code 后端配置承载与门合同」bullet(本批的合同正本)+ §11 门段 claude_code 行 + §9 cost_entries kind 注 `tier1.run` + tier1_runs DDL `native_session_confirmed` 注。
4. `e2e/evidence/w54a-claude-cli.md`(前批继承约束,尤其 §9 评审 2 返工与终版 argv)。

## §2 红线(违者算 bug;恒律 = AGENTS.md 六硬规则 + HANDOFF §4 全文)

批专属:
1. **cursor 路径零行为变化**:cursor argv/事件解析/`kill_on_result`/canary 左值 `shellStarted` 不变(快照断言);`checkCanaries` 的 cursor 分支禁改。
2. **权限模式终版 = `--permission-mode default`**;不启用 `bypassPermissions`/`dontAsk`/`acceptEdits`/`--dangerously-skip-permissions`;工具面封闭 `Bash,Read,Write,Edit,NotebookEdit` + `--disallowedTools "WebFetch,WebSearch"`;`Task` 不开。
3. **圈外写永不 allow、永不 S2**(deny 无通道);圈内敏感基名走 S2;圈外 Read deny;hook 失败路径 = deny JSON + `exit 2`,curl `--max-time 100` < hook `timeout 120`。
4. **Tier1 `claude_code` 恒 `observedModelExempted=false`**;`apiKeySource !== "none"` ⇒ 立即终止 + failed `subscription_auth_violation`;订阅只经 `claude` CLI 登录态,env 恒剔除 `ANTHROPIC_*`/`CLAUDE_CODE_OAUTH_TOKEN`,显式注入仅 `DISABLE_AUTOUPDATER=1` + `SHELL=/bin/sh`(09 G4 例外两键)。
5. **live steer 不放开**(`steerApplied` 不改);限流只对明确拒绝态动作,绝不静默转 api 计费。
6. 不部署常驻、不碰 BYOA 四槽、不动 Hopper 路径、不改 live `~/.saydo/config.toml`。
7. 既有测试期望值改动白名单:`tier1-config-validate` 仅允许方案 §3.9 点名的两处;`tier1-gate-socket` 既有 7 例零改动;`tier1-executor` 既有用例零改动;超白名单的期望值改动 = 停,上浮。

## §3 分阶段任务与验收锚(正本 = 方案 §6 W5.4-b 节,此处为批级裁剪;每项完成即跑门禁)

- **C1 配置与自检**:`[tier1]` schema 四键(claude_bin/claude_pinned_version/model/claude_max_turns)+ `tier1StartupVerdict` claude 分支(先按生效 adapter 分叉)+ `resolveTier1Adapter`(替换 `readDevAdapter` 三处消费,缺省仍 cursor 直到 W5.4-c 收口)+ projectOverrides `dev.agent` 放开 claude_code 但不匹配即忽略+审计 + setup 自检 `scope=tier1`(版本/登录态/hook 链物理自检/一发一收 init 断言/identity 登记写入)+ `claude-identity.json` 承载 + `DISABLE_AUTOUPDATER`/`SHELL` 注入 + adapter 切换 reap。
  锚:`tier1-config-validate.test.ts` 新增 ≥ 10(含 claude 分支 not_configured 处方/版本断言/identity 缺失);project-overrides 正反例;setup 自检测试;既有用例只动白名单两处。
- **C2 executor 接 backend**(最大不确定项,预算 2-3 人日):gateServer `GateWireRequest` union(无 kind 不注入键)+ handler 三态响应 + file kind 审计与收据(edit 第四动作不适用)+ 并发 S2 串行化(第二张直接 deny + 提示)+ session 身份(`native_session_confirmed` 列增量迁移 + `expectedSessionIdentity`/`isResume` 重构)+ observedModels 集合族校验 + 四字段审计 meta + canary 左值按 backend(claude = 门后 `tool_result` 计数;三方对账进审计只记不 trip)+ `apiKeySource` 断言 + stderrTail 有界环形缓冲 + `finishPolicy` 分叉 + 记账落库(`recordTier1SubscriptionRun` 消费 W5.4-a 纯对象;cursor 同步补)+ 限流 blocked + enqueue(slot=tier1/kind=tier1_run)+ replayer=retryTask + 恢复/续跑四元组 `--resume` 规则 + resume_not_found 降级重试一次。
  锚:`tier1-executor.test.ts` 新增 ≥ 12(方案 §6 点名清单:认领→argv→事件→settle / canary 不误 trip / resume mismatch / rate limited blocked + 审计 + sweep 重认领 / auth_required / apiKeySource 拒 / resume_not_found 降级一次 / adapter mismatch reap),既有用例零改动;`tier1-gate-socket` 新增真 bash/jq/curl 用例按方案 §6 B2 锚(若 W5.4-a 已覆盖则引用);迁移测试:老库(v4-era fixture)升级后 `native_session_confirmed` 缺省 0 且既有行不损。
- **C3 console 与话术**:设置页 Tier1 卡(后端/模型/版本/登录态/自检/五小时窗观测)+ 任务详情 adapter+observedModel + 语音 S2 文件工具文案分支 + 新 blocked 原因人话(限流/登录过期/身份漂移/max_turns,不说"完成")+ prompt 执行约定按 backend(claude 改 "不要改动 .claude/ 目录")+ 10/11 回写**草案**(正式回写归 W5.4-c 攒批)。
  锚:console 单测 + Playwright 定向 ≥ 2(点名文件)。
- 门禁:每阶段末 `just ci` 双矩阵绿(退出码显式核查,禁止管道取尾);C 阶段末零上下文 code-review subagent(A 级必修)。

## §3.5 owner 决策附注位(开批确认时逐项过)

1. w54a readback:补跑(owner 独立会话 /impl-review)或书面豁免——二选一,记录进 HANDOFF §1 指针行。
2. 方案 §8 残余确认:D5/D9(live steer 与 streaming input 本批不实现的范围缩水)、D13(两 env 键)、D14(圈外 Read deny,P1 再放 S2)、D7/D8(model=opus 缺省、claude_max_turns=200)。W5.4-a 的实施已隐含方案主体接受,此处为形式确认位。
3. ADR-002 状态更正的 owner 确认(P-3 尾句所挂)。
4. evidence 命名:本批 `e2e/evidence/w54b-batch.md`(PLAN-2 通则④ w{N} 模式);收口回填 HANDOFF §2-6 与 PLAN-2 §1 5.4 行。

## §4 检查点与缺省动作

- C1 末、C2 末各一次:阶段小结(改动文件清单 + 测试计数 diff + 门禁退出码)贴给调度方;**无回复 = 暂停该分支继续其他项**(PLAN-2 §7-3 缺省动作)。
- 撞 canonical 缺口(实现发现 09 形状不够用)= 停该项、上浮,禁止实现侧自定语义;其他项继续。
- 撞 Claude CLI 版本行为差异(与 2.1.220 fixture 不符)= 记录差异 + 重跑对应 spike 项,不得静默适配。

## §5 诚实汇报纪律

三级词表(已实现+测试绿 / 已实现未验 / 未做);每个 SHA 来自真实 `git log` 输出;两提交法待 owner 授权(feat(w54b) → chore(evidence),evidence 记代码 SHA 不自指);门禁退出码显式核查;journal 一行索引 + `history/DEV-VERSION-LEDGER.md` §2 时代 VII 追加一行随收口同批。
