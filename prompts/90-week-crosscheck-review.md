# 评审 90 · 2026-08-22 一周合并与双向对账 交叉审(零上下文对抗评审)

你是独立评审方,**没有**参与本轮实施。只读仓库 `~/WorkSpace/SayDo`,分支 `main`。
目标不是复述,是**证伪**:找出本轮合并与对账中不成立、不标准、不一致、有遗漏的地方。

## 本轮做了什么(需你核验,不要采信)

1. 把工作区未提交工作分五组入库:`5036bee`(canonical 前置回写)、`4c4bf96`(W5.4-b C1+C2)、`479634c`(备案+软著)、`cdf49f2`(官网)、`ad8adb1`(记录层)。
2. `main` 由 `11e3653` 快进到 `5a73420`(W-Win Windows/Linux 对齐 + hardening 九提交),再合并批次分支得 `4d2824e`,**十处冲突全部人工语义合并**。
3. 双向对账并回修 `a26d5bf`,报告 `docs/review/2026-08-22-week-crosscheck.md`。

## 必读

- `docs/review/2026-08-22-week-crosscheck.md`(本轮结论,重点证伪 §1 裁决表与 §2 冲突裁决表)
- `e2e/evidence/w54b-batch.md`(W5.4-b 阶段性证据)
- `docs/09-data-contracts.md` §11「claude_code 后端配置承载与门合同」+ §9 cost_entries + tier1_runs DDL(**合同正本**)
- `docs/adr/ADR-003-os-adapters.md` §3 与 `docs/adr/design/ADR-004-windows-platform.md`(跨平台不变量)
- `docs/plan/IMPL-PROMPT-15-W54B-WIRING.md` §2 红线、§3 验收锚
- `AGENTS.md`、`HANDOFF.md` §0/§4(铁律)

## 重点审查面(按风险排序)

### A. 合并后的门面正确性(最高风险——两批并行改同一面)
`git show 4d2824e` 与 `git diff 5a73420 4d2824e -- packages/daemon/src/tier1/ packages/platform/`。逐项判:

1. `gateScript.ts` 的 `ensureGateScript` 现在 POSIX 与 win32 都写两份门脚本(`buildActiveGateScript` + `buildActiveClaudeGateScript`)。这是否引入回归?win32 下 `restrictOwnerOnly` 覆盖是否仍完整?POSIX 下多写一个 `gate-claude.sh` 是否与 ADR-003 §3 的门完整性口径冲突?
2. `gateServer.ts` 的 `parseGateWireRequest` 判别联合:无 `kind` ⇒ legacy、未知 `kind` ⇒ 抛错 ⇒ 服务端 deny。与 09 §11 门 wire 合同、与 ADR-003「现网 `{command,cwd}` 不变」是否**逐字**一致?cursor 现网 wire 是否真的零行为变化?
3. `executor.ts` 的 `gateIntegritySurfaces` 现在收编了 claude 门脚本;`provisionWorktree` 只在 `backend.adapter === "cursor"` 时登记 worktree 内 `hooks.json` 漂移面。claude 后端下 worktree 内是否**真的没有**需要登记的漂移面?`backend.provisionHooks` 对 claude 返回的 `filesWritten` 是什么,漏登记会不会开出洗审批的口子?
4. drift guard 改成「逐漂移面一条审计 + 只自愈漂移面」。W-Win 原实现是「首个漂移面一条审计(带 surfaces 数组)+ 自愈漂移面」,W5.4-b 原实现是「逐条审计 + 自愈全集」。合并版是否丢了任何一侧的安全属性?自愈时对 `hooks.json` 用 `writeGateScriptAtomic`(chmod 0755)是否恰当?
5. `@saydo/platform` 的 `GateHttpHandler` 由两态放开为三态 `allow|deny|no_decision`。win32 环回门(`gate-cursor.mjs`/`gate-claude.mjs`)与 `listenGateHttp` 收到 `no_decision` 时的行为是否 fail-closed?会不会在 Windows 上把 `no_decision` 变成事实放行?
6. `index.ts` 的 `executorCfg` 合成后,`gateBindExpected` 仍在 `assertVersion()` 之后赋值——赋值时机与 drift guard 首次触发的先后是否有窗口?

### B. W5.4-b 接线是否踩红线(IMPL-PROMPT-15 §2)
逐条判定并给 file:line:
- cursor 路径零行为变化(argv / 事件解析 / `kill_on_result` / canary 左值 `shellStarted` / `checkCanaries` cursor 分支)
- `--permission-mode default`;无 `bypassPermissions`/`acceptEdits`/`--dangerously-skip-permissions`;工具面封闭 + `--disallowedTools`
- 圈外写永不 allow 永不 S2;圈内敏感基名走 S2;圈外 Read deny;hook 失败 = deny JSON + `exit 2`;curl `--max-time 100` < hook `timeout 120`
- `observedModelExempted` 恒 false;`apiKeySource !== "none"` 立即终止;env 恒剔除 `ANTHROPIC_*`/`CLAUDE_CODE_OAUTH_TOKEN`,只注入 `DISABLE_AUTOUPDATER=1` + `SHELL=/bin/sh`
- live steer 未放开;限流只对明确拒绝态,绝不静默转 api 计费
- 既有测试期望值改动是否超出白名单(`tier1-config-validate` 仅方案 §3.9 点名两处;`tier1-gate-socket` 既有 7 例零改动;`tier1-executor` 既有用例零改动)

### C. 迁移铁律
`native_session_confirmed` 是 additive 列。核验:是否配了增量迁移而不是塞进 `DDL_V1` 原文;`test/storage-migration-v5.test.ts` 是否真的用 v4-era fixture 老库升级验证;测试有没有把「最新版本号」写死。

### D. 对账结论的证伪
逐条检查 `docs/review/2026-08-22-week-crosscheck.md` §1 的 F1-F16:
- 有没有**裁错方向**的(本该改实施却改了文档,或反之)?尤其 F1(官网翻转)、F13(ADR-004 约束 4)——真机/CI 证据是否**足以**支撑「Windows/Linux 现在可用」这个对外承诺?常驻安装缺失是否已在对外文案中充分披露?
- 有没有**该发现而没发现**的不一致?请自己独立扫一遍最近一周的 canonical(02/03/04/07/09/10/11 + ADR)与实现,报告对账遗漏项。
- journal 撞号处置(备案链保号、Windows 顺延 R89/R90)是否符合 `history/README.md` 与台账 §3 的既有裁决?
- 台账 §2 新增五行的末码是否与 `git log` 实际一致?

### E. 制度面
- 两提交法(feat/fix → chore(evidence))在本轮是否被破坏?`4c4bf96` 的 evidence 是本轮才补的 `e2e/evidence/w54b-batch.md`(在 `a26d5bf` 里),是否算违规?
- PLAN-2 曾要求 W-Win 与 W5.4-b 在 gate 运输面串行,实际并行。对账报告称「靠先收口后合入的次序满足串行意图」——这个说法是否成立,还是应判为红线违反并要求补做什么?

## 输出格式(严格)

按严重度分级,每条必须给 `file:line` 或可复跑命令:

- **A 级(必修,阻断)**:安全/正确性/合同冲突/事实错误
- **B 级(应修)**:一致性、标准性、遗漏
- **C 级(建议)**
- **O 级(需 owner 裁决)**

最后给一句总裁决:`Go` / `修正后 Go` / `No-Go`,并说明理由。
不要复述你读到的内容,只写判断与证据。发现我说的事实与仓库不符,直接指出。
