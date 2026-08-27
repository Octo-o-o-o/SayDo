# 审计报告 · Line 5「W5.4 claude-cli Tier1 + AI 供给专题」commit↔文档双向对照

- 审计日期:2026-08-27(零上下文独立会话)
- 审计对象:main @ `f723ab7`(本会话 `git branch --show-current` = main;`git status --porcelain` 对 docs/plan、docs/review、e2e、history 全部干净,工作树 = 提交态)
- commit 清单:scratchpad/line5-w54-aisupply.txt,23 条;本会话逐条 `git merge-base --is-ancestor` 核验 **23/23 均在 main**,且收口 commit `728eeb6` 已包含在 `origin/main`(= `12ba011`,SayDo-archive)中
- 纪律:只读,未修改/新建任何仓库正式文件,未 git add/commit;所有 hash 与 file:line 来自本会话真实命令输出;未核实处显式标注

## 结论摘要

- **A 级 1 / B 级 5 / C 级 6**。
- 主线状态判定(三方对照后):W5.4-a 收口(2026-08-20)与 W5.4-b 收口(2026-08-27,四轮零上下文复审 + 三轮返工)的文档叙事与当前代码**总体吻合**,抽查的全部关键代码坐标实证在位,六文件定向门禁本会话复跑 342 passed / EXIT=0;四项 owner 决策(1/2/6/7)均已落实或显式标记待做;IMPL-PROMPT-16 启用前置警告存在且与决策 1 同向;journal R98-R108 重编号后全仓引用无残留错误。
- 主要问题集中在:一处 canonical 文档的过时事实断言(A-1)、w54a readback 修复清单三项在 w54b 收口时既未兑现也未入遗留清单(B-1)、收口依据的四轮复审报告未入库(B-2)、审计 commit 清单本身漏了 ≥14 个本线 commit(B-3)、IMPL-PROMPT-16 执行完毕后警告未更新(B-4)、关批前置一条未满足即关批(B-5)。

---

## 1. A 向:文档 → commit → 当前代码

### 1.1 W5.4-a:方案 §6 验收锚 vs readback 声称 vs 当前代码(三方对照)

方案 = `docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` v3.1(422 行,本会话全文读);readback = `docs/review/2026-08-21-w54a-impl-readback.fable.md`(133 行,台账 22 条 [ok]19/[warn]2/[divergent]1/[fail]0)。

**readback 的结构性断言逐条独立复核(本会话命令,全部吻合):**

| readback 断言 | 本会话复核 | 结论 |
|---|---|---|
| 分支提交 15 个(`0649107` → `f04b898`) | `git log 7fb3fa1^1..7fb3fa1^2 \| wc -l` = 15 | [ok] |
| 10 个代码提交 hash 名单 | 实测名单 ed8b0f3/5195164/0ae8692/16d24eb/f1a5d28/70ef24a/6313766/56f0731/2d7e363/54b981c,逐个一致 | [ok] |
| 分支基点 `354b028`(`0649107^`) | `git rev-parse --short 0649107^` = 354b028 | [ok] |
| merge diff 37 文件 +4936/-41 | `git diff --shortstat 7fb3fa1^1 7fb3fa1` = 37 files, +4936/-41 | [ok] |
| 六文件定向 vitest 321 passed | 本会话复跑同六文件:**342 passed / EXIT=0**(claude-backend 19、cmd-effect 251、claude-outcome 20、cursor-backend 5、gate-socket 29、file-tool-effect 18;增量来自 w54b/返工新增锚,与 evidence §4/§15-§17 记录的增量一致) | [ok],当前更多 |
| spike `run.sh` 1498 行、fixture 七件 | `wc -l e2e/spikes/claude-cli-tier1/run.sh` = 1498;`ls packages/daemon/test/fixtures/claude-cli/2.1.220/` 恰七件(init/rate_limit/result_max_turns/result_success/resume_fail/tool_result/tool_use_multi) | [ok] |

**方案关键决策在当前代码的落地抽查(全部实证):**

| 方案条款 | 当前代码证据(本会话 Read/grep) | 结论 |
|---|---|---|
| D3/v3.1 `--permission-mode default` | `packages/daemon/src/tier1/backends/claude.ts:69-70`(`"--permission-mode","default"`),:73 `--disallowedTools`、:75 `--setting-sources ""`、:77 `--strict-mcp-config` | [ok] |
| §3.1 `Tier1Backend` 八员接口 | `backends/types.ts`(接口成员与决策 2 影响面分析引文一致);`claudeBackend()` `claude.ts:235-259`:`finishPolicy:"wait_exit_then_kill"`、`canaryLeft:"tool_result"` | [ok] |
| readback B-1 修复(AdapterKind 分叉) | `backends/types.ts:5` = `export type AdapterKind = Extract<Adapter, "cursor" \| "claude_code">`,注释「readback B-1 清偿:契约不分叉」 | [ok] 已在 w54b 兑现 |
| B-10prime [divergent] 处置 | RESULT 保留 [fail] 原判、方案升 v3.1、X1-X5 补测——readback 判「合理处置」;终版实现即上行 `default` | [ok] 叙事自洽 |

### 1.2 W5.4-b:IMPL-PROMPT-15 §3 锚 vs evidence 声称 vs 当前代码

evidence = `e2e/evidence/w54b-batch.md`(608 行,本会话全文读)。该文件按「阶段快照不回改、后节 supersede 前节」写法:§1-§9 是 2026-08-22 快照(C3 [fail]),§10 是 2026-08-23 补证(C3 转 [ok]),§14-§18 是 2026-08-26/27 收口批与四轮复审/三轮返工全账。

**当前代码抽查(全部实证,本会话 grep/Read):**

| 声称 | 当前代码证据 | 结论 |
|---|---|---|
| C1 `[tier1]` 四键 schema | `packages/daemon/src/config/types.ts:74-82`(claude_bin/claude_pinned_version/model/claude_max_turns,cursor 两键并存) | [ok] |
| C1 claude 启动裁决分支 | `packages/daemon/src/tier1/validateConfig.ts:130` `claudeStartupVerdict`(bin/pinned/model 缺失 → not_configured 处方) | [ok] |
| C1 生效 adapter 单源 | `tier1/resolveAdapter.ts:9` `resolveTier1Adapter`;`index.ts` 三处消费(:2144/:2513/:3591,:2508 注明「W5.4-b C1」) | [ok] |
| C3 任务详情 | `packages/console/src/pages/TaskDetail.tsx:224`(`data-adapter`)、`:241`(`observed_model ?? "未观测"`)——与 evidence §14.1 实测表逐字一致 | [ok] |
| C3 设置页 Tier1 卡 | `grep -c 'Tier1SelfTestReport' GlobalSettings.tsx` = 5(evidence §14.1 记 5,IMPL-16 §0.3 预期 ≥3) | [ok] |
| 返工 A-1(resume 持久化) | `executor.ts:2485` `applySessionIdentity`、`:2288/:2501` `overwriteTier1RunNativeSession`(`run.isResume` 条件) | [ok] |
| 返工 A-2(敏感基名 symlink 降级) | `tier1/fileToolEffect.ts:154-155`:敏感正则同时测请求原路径与 `resolved.abs` | [ok] |
| 返工 A-3(BYOA 身份核验缓存) | `providers/byoa/provider.ts:243` `{ forceRehash: true, hashFile: … }`;`binaryIdentity.ts:4-5/:98` 头注已改为如实区分缓存与安全门 | [ok] |
| 返工 A(只读备份)+ 第三轮 B-1 | `storage/dao/projects.ts:62-67` `dbConnectionWritable`:`db.readonly` 短路 + `queryOnly !== 1 && queryOnly !== 1n`(含 BigInt 注释) | [ok] |
| 返工 C-3(夹具位置) | `packages/daemon/test/workspace-identity-remount.test.ts:24` `ownerTempRoot()` | [ok] |
| 门禁数字 | evidence §17.3 记 daemon 2174/6 skipped、playwright 36 passed(该两项本会话未复跑,标注:未复核,仅六文件定向已复跑) | [warn] 部分未复核 |

**W5.4-c 边界**:方案 §6 W5.4-c(live 冒烟 + conformance + canonical 收口)在 HANDOFF §2-6、PLAN-2 W5 行、evidence §14.4/§15.5、journal R110 中一致标注**未做**,无任何文档把自检 init 探针写成 hook 链已验。[ok]

### 1.3 四项 owner 决策(`docs/plan/2026-08-24-ai-supply-owner-decisions.md`)落实核验

决策单共**十项**,owner 2026-08-25 签署其中**四项**(1/2/6/7);3/4/5/8/9 为「Claude 预填草案,待 owner 确认」,10 建议暂缓——此状态在主方案头部「owner 决策状态(2026-08-25)」表与 PLAN-2 红线 3 中口径一致。

| 决策 | 裁决 | 落实/标记核验 | 结论 |
|---|---|---|---|
| 1 排产坐标 | 先收口 w54b C3 再排本专题 | C3 经四轮复审收口(evidence §15-§18);`728eeb6` 关批:HANDOFF:46 指针**置空**、收口 SHA `9417b6d`(代码 `8941e1c`);PLAN-2:137 `ai-supply` 具名坐标,基线 HEAD `9417b6d…`,主方案 SHA-256 `6641d2b2…`(本会话 `shasum` 复算**一致**)、决策单 SHA-256 `bb61b24b…`(**一致**) | [ok] 已落实 |
| 2 Codex/ACP | 引入 ACP 适配层;Codex 沿用 `codex exec` | 主方案头表 + Phase 5 重组提示已改「决策 2 已签…应执行」(1706 行起);PLAN-2:153-154 与子批 `ai-supply-p*`「Phase 5 按决策 2 重组」;重组本身**显式标记待做**(排产后子批执行) | [ok] 已反映+待做标记 |
| 6 secret/付费边界 | 采纳默认(双双关闭) | PLAN-2:155「按方案原文,无额外动作」;方案 §4.6/§7.3/§12 原文即默认形态 | [ok] |
| 7 扩展交付边界 | 首发只开放内置受信 connector | 主方案头部:§4.10 整节/§9.8/决策 8 TUF/Connector SDK「本轮不落地…读作后续阶段的设计存档」;PLAN-2:156-160 范围收缩;决策 8/9/10 已加连带影响注记(决策单 :259-261/:287-289/:315-317) | [ok] 已落实 |

决策 2 的证据链(影响面分析 `2026-08-24-decision-2-impact-analysis.md` + ACP 实测 `2026-08-25-agent-cli-acp-capability-survey.md`)与决策单引文互相一致;影响面分析引用的代码坐标(`task.ts:12` adapterSchema 含 codex、`backends/types.ts:5` Extract 两员)本会话实测仍准确。

### 1.4 主方案 §10 定位说明与 Phase 5 重组提示(87c9326 / 95a68a0)自洽性

- §10 定位说明(:1278-1298,87c9326 加入)声称「327 条 `- [ ]`」——本会话 `sed §10 范围 | grep -c '^- \[ \]'` = **327,精确一致**;「唯一验收入口 = §12.3 的 `run-ai-supply-phase-gate.mjs --phase <id> --json`」——§12.3(:2192-2194)确有「每个Phase只公开一个…入口」条款,各 Phase 尾部门禁块(:1365/:1429/…/:1771)命令形态一致。[ok]
- Phase 5 重组提示(:1706-1717):87c9326 时写「决策 2 未拍板前不执行重组」(journal R106 记述),95a68a0 签署决策 2 后同批把提示改为「已从『待定』转为『应执行』」「决策 2 已于 2026-08-25 裁决采用本方向」——与决策单签署内容(含连带条款「§10 Phase 5 应按协议重组,取代现有九个品牌子批」)一致。九个品牌子批保留为「重组的输入清单」,与 PLAN-2 子批安排衔接。[ok](时点措辞的微小出入见 C-4)

### 1.5 IMPL-PROMPT-16 启用前置警告(3d7f202)核验

- 警告**存在**:`docs/plan/IMPL-PROMPT-16-W54B-CLOSEOUT.md:3-27`「本 Prompt 当前不可执行(2026-08-25 复核)」+ 五条阻断 + 正确启用时机;与 journal R108 的记述逐条对应(五条阻断同文)。
- 与决策**一致**:警告方向(先 RC4 收口、再核对 w54b 收口)与决策 1(先收口 w54b C3 再排专题)同向不冲突;后续实际路径(rc.12 收口 → 阻断解除 → 阶段 A/C 执行)与警告「正确的启用时机」预言吻合(evidence §14.3:「IMPL-16 启用前置②已解除」)。
- 但警告**未随执行状态更新**——见 B-4。

---

## 2. B 向:commit → 文档(23 条逐条)

### 2.1 逐条核对表

日期/subject 均为本会话 `git log --no-walk` 实测;「归属文档」为本会话读到的对应记录;FP = main first-parent,branch = 经 merge 进入。

| # | hash | 位置 | 归属与一致性核验 | 结论 |
|---|---|---|---|---|
| 23 | `0649107` 08-20 开批 w54a | branch | 仅 HANDOFF.md 1 行改动(+1/-1,开批指针);HANDOFF §1 历史批次记录「`w54a-claude-cli` 2026-08-20 开批/已收口」与之一致 | [ok] |
| 22 | `c384687` 08-20 evidence 初版 | branch | 新建 `e2e/evidence/w54a-claude-cli.md`(206 行)+ HANDOFF | [ok] |
| 21 | `0642260` 08-20 评审 1 返工 | branch | evidence +60/-8;对应评审 82 → A-1(悬空 symlink)返工链,readback「批内评审线复核」节独立核对过 | [ok] |
| 20 | `a6a79ec` 08-20 评审 2 返工 | branch | evidence +41/-3;对应评审 84 → A-2(`..` 穿 symlink)返工链 | [ok] |
| 19 | `7fb3fa1` 08-20 merge w54a | FP | 合并结构(15 提交/基点/37 文件 +4936/-41)与 readback 头部断言逐项吻合(§1.1 表) | [ok] |
| 18 | `4c4bf96` 08-22 feat C1/C2 | branch | 文件面(config/types、validateConfig、resolveAdapter、selfTest、claudeIdentity、gateServer、ledger、ddl、binaryIdentity…)与 evidence §2/§3 锚表一致;当前代码抽查在位(§1.2 表) | [ok] |
| 17 | `ad8adb1` 08-22 records | branch | 入库 IMPL-PROMPT-15(60 行,实测在位)、w54a readback 报告(133 行)、DEV-VERSION-LEDGER、journal R80-R88、评审 88/89 prompt/报告 | [ok] |
| 16 | `4d2824e` 08-22 merge w54b-wiring | FP | 分支 5 提交 = `5036bee`(canonical 前置)/`4c4bf96`/`479634c`/`cdf49f2`(备案/官网)/`ad8adb1`;merge subject 五个成分与分支内容一一对应。注意 `5036bee` 不在 23 条清单(见 B-3) | [ok] |
| 15 | `1d6680c` 08-22 评审 90 回修 | FP | 28 文件 +658/-101,含 11 个 packages/ 文件(executor +102、selfTest +89、gateScript +36…);与 evidence §7 台账(A 级八条+B/C)对应;A-1 的 win32 四路修复在**清单外** commit `058090d`,B-5 在清单外 `3bf3d10`(evidence §7 自己点名) | [ok],关联 commit 缺口见 B-3 |
| 14 | `92d5b55` 08-22 门禁数字回填 | FP | 仅 evidence 3 行;subject 的 daemon 1786 / 定向十一文件 208 与 evidence §4 当前文本一致 | [ok] |
| 13 | `afd31b4` 08-22 评审 91 回修 | FP | 文件面(adapter/claudeOutcome/executor/gateScript/selfTest + docs/ADR-003/ADR-004/02/03)与 evidence §8 台账吻合;「含我自己引入的一处退化」= §8 A-5 REGRESSED(finalizeFailure 漏 resolveClaim) | [ok] |
| 12 | `a971519` 08-22 评审 92 回修 | FP | 文件面(workspace.ts、claudeOutcome、executor、gateScript、selfTest + docs/09 + research/codex-findings/92)与 evidence §9 吻合;「静默双改契约的 A 级回退」= §9 新 A(workspace 身份锚按平台分叉 + 同批回写 09 §规则 1,docs/09 +8 行在 diff 中) | [ok] |
| 11 | `c620a39` 08-25 预填五项决策 | branch | 决策单 +69、影响面分析新建 154 行、journal R102(+74);「五项」= 3/4/5/8/9 预填,与 R102 分类一致 | [ok] |
| 10 | `5074142` 08-25 exec/app-server 实证 | branch | 影响面分析 +73(§4.1/4.2/4.3)、决策单 +7、journal R103;95/10/70 方法数与决策单引文一致 | [ok] |
| 9 | `690fc64` 08-25 ACP 实证 | branch | 新建 ACP survey(195 行,实测在位)、主方案 §6.2 +20、决策单决策 2 两问改三问 +33、journal R104 | [ok] |
| 8 | `f6bbc6e` 08-25 复检修四处 | branch | 主方案 +17(四处不一致:§6.2/§9.4 driver 矛盾、§4.1 形态表、Goose 条目、§14 决策 10 注)、journal R105;R105 同时记录两项未动的结构问题(→ 87c9326) | [ok] |
| 7 | `87c9326` 08-25 §10 定位+Phase5 提示 | branch | 主方案 +36、journal R106;327 条计数本会话复核精确一致(§1.4) | [ok] |
| 6 | `95a68a0` 08-25 签四项决策+IMPL-16 | branch | 决策单 +50(四项签署)、主方案 +27(头部决策状态节 + Phase 5 提示转「应执行」)、新建 IMPL-PROMPT-16(195 行)、journal R107 | [ok] |
| 5 | `3d7f202` 08-25 IMPL-16 不可执行警告 | branch | IMPL-16 +26(头部警告块,195→221 行,当前 221 行实测)、journal R108(五条阻断同文) | [ok],现势更新缺口见 B-4 |
| 4 | `9e9afee` 08-26 续接 prompt | FP | 新建 `prompts/204-ai-supply-post-rc4-continuation.md`(经本会话 `git log -- prompts/204…` 证实);R109 记述「9e9afee 新增 prompts/204(139 行)」 | [ok];与 A-1 相关 |
| 3 | `52119ff` 08-27 纠正 C3 记述 | FP | HANDOFF 3 行 + evidence §14(+75 行,收口批对账/ios 门禁回归定位/门禁实测);§14.1 的 C3 grep 实测值与当前代码一致(本会话复测同值) | [ok] |
| 2 | `8941e1c` 08-27 修五条 A 级 | FP | 文件面(executor/fileToolEffect/byoa provider/binaryIdentity/dao projects/anchor/GlobalSettings/TaskDetail/console.spec + 4 个测试文件)与 evidence §15.3/§16.2/§17.2 返工表吻合;当前代码抽查全部在位(§1.2 表) | [ok] |
| 1 | `728eeb6` 08-27 关批+开坐标 | FP | HANDOFF 指针置空(:46)、PLAN-2 W5/5.4 行改已收口(:55 区域实测)、PLAN-2 §1 `ai-supply` 坐标(:137-184,两个 SHA-256 复算一致)、journal R110、台账时代 VII;commit message 如实标注 IMPL-15 §3.5 第 2/3 条未见确认 | [ok],前置偏离见 B-5,「204/205 未入库」错误见 A-1 |

### 2.2 journal R 编号重编号核查(6467076,不在清单内)

- 重编号 commit `6467076`(08-26 01:28,on main):AI 供给线 R94-R104 → R98-R108(+4),避开 main 已入库的 RC4 线 R94-R97。
- 当前 journal 实测:R94-R97 = RC4 线(双向审计/rc.2/rc.3/rc.4,:2040-:2150),R98-R108 = AI 供给线(:2180-:2692),R109-R113 顺延,**区段内编号连续无重复**。
- 全仓引用 grep(`\bR9[4-7]\b`,排除 journal 本体):唯一命中 `prompts/204:54`「R94–R97 是同期的 RC4 线,两者无关」——指向**正确**。
- `\bR9[89]\b|\bR10[0-8]\b` 引用:诊断报告 4 处(R98/R99,已由 6467076 从旧 R94/R95 同步更新,diff 实测)、PLAN-2:184「R98–R108」——均指向 AI 供给线**正确**条目。
- **结论:重编号后无引用残留错误。**(6467076 自述「诊断报告 5 处」,本会话 grep 到 4 处 R98/R99 命中,第 5 处为标题「与 R98 的关系」类改动,存在于 diff;非问题。)

### 2.3 清单覆盖缺口(详见 B-3)

清单同时含 FP 与 branch 提交(无一致选取规则),但漏掉本线至少 14 个 main 上的 commit,其中 `5036bee`(canonical 前置 P-1..P-5)与 `9417b6d`(收口 SHA/evidence §15-§18 全账)是关键节点。

---

## 3. 发现清单

### A 级(错误/不一致)

**A-1 · PLAN-2 与 journal R110 声称 prompts/204、205「未入库/未跟踪」,与 git 事实矛盾**
- 主张:`docs/plan/IMPLEMENTATION-PLAN-2.md:170`「摘自 `prompts/204-ai-supply-post-rc4-continuation.md` §4,**该文件未入库**,故要点在此固化」;`history/PROCESS-JOURNAL.md` R110(:2795-2797)「依据 `prompts/205` 的坐标刷新与 `prompts/204` 的任务主体,**两者均为未跟踪工作文件**」。两处均由 `728eeb6`(08-27 15:36)写入。
- 证据:`git ls-tree 728eeb6^ --name-only -- prompts/204-… prompts/205-ai-supply-activation-refresh.md` **两个文件都在树中**(rc=0);prompts/204 由 `9e9afee`(08-26 01:35,清单第 4 条)入库,prompts/205 由 `88ac8a2`(08-26 22:49)入库、`61ce050`(08-26 23:14)更新——均早于 728eeb6 且是其祖先。即写入时点该断言已过时(在 R110 会话**起点**做启用门检查时 205 确实未跟踪,但落盘时状态已变)。
- 影响:低——红线要点已就地固化进 PLAN-2,不依赖 204/205;但会误导后续会话以为这两份 prompt 是易失工作文件而不去仓内查阅。
- 建议处置:PLAN-2:170 与 journal R110 各改一句(「已于 08-26 入库(`9e9afee`/`88ac8a2`),此处固化要点以自足」),journal 按保号惯例可用追注而非改史。

### B 级(疏漏/不足)

**B-1 · w54a readback 修复清单三项在 w54b 收口时未兑现,也未入收口遗留清单**
- 主张:`docs/review/2026-08-21-w54a-impl-readback.fable.md` 修复清单(:123-133)中,注明去向为 W5.4-b 的三项未做,且不在 `e2e/evidence/w54b-batch.md` §18.4 遗留清单(L-1..L-7)中:
  1. 第 5 条 [C-3]「W5.4-b 接线时把 `claudeIsTerminalResult` 收紧为 parse 后判 `type === "result"`」——当前 `packages/daemon/src/tier1/backends/claude.ts:231-233` 仍是宽正则 `/"type"\s*:\s*"result"/`;全仓 grep 该符号仅 readback 自身两处命中,零追踪。
  2. 第 4 条 [C-2]「evidence §9 复跑位回填(或补指针)」——`e2e/evidence/w54a-claude-cli.md:287-289` 仍是空槽(`just ci` EXIT=_ / daemon Tests _ passed / pytest _)。
  3. 第 6 条 [C-5] 子项「claude-backend init 测试补 `permissionMode` 断言」——`grep -c permissionMode packages/daemon/test/tier1-claude-backend.test.ts` = 0。
- 对照:同清单其余各项已兑现——第 1 条 B-1(AdapterKind)已修(`backends/types.ts:5`);第 2 条(gate-claude.sh 圈判定)经评审 92 真对齐(`6d98a6e`)收敛;第 3 条 [C-1](cache 第四键)以映射方式落地(`claudeOutcome.ts:137` 产 `cache_creation_input_tokens`,`cost/ledger.ts:131-138` 落库映射为 `cache_write_input_tokens`,09:900-901 有两态口径);第 6 条另两子项已由接线解决(executor.ts:2263-2273 单源提取 settingsJson;毒路径经评审 91 B-3 的 `/bin/sh` 真解析测试覆盖);第 7 条 [C-6] 归 W5.4-c,PLAN-2 W5 剩余行仍开口。
- 影响:C-3 是行为面(assistant 文本含 `"type":"result"` 字样会提前 arm finish 计时器,readback 原文已述);其余两项是证据完备性。均为小项,但「修复清单 → 下批 IMPL → 收口遗留清单」的闭环在这三项上断链。
- 建议处置:三项补录进 W5.4-c 或独立小批;evidence 空槽可按 readback 给的替代方案补一行指针。

**B-2 · 2026-08-26/27 四轮独立复审(Codex)报告未入库,且未记 SHA-256**
- 主张:w54b 收口依据的四轮复审(evidence §15.1/§16.1/§17.1/§18.1,各记事件流行数、`turn.completed`、报告字节/行数)在仓内无对应文件。
- 证据:`ls research/codex-findings/` 止于 89-92(08-22 轮,全入库)与 95-99 等 ai-supply 轮;`grep -rln 'w54b' research/ prompts/` 无 08-26/27 收口轮的 prompt/报告文件。与本线先例(评审 82/84/85 入 `7fb3fa1` 分支、89-92 入库)不一致;且 evidence 只记了字节/行数,未记 SHA-256(对比 R98/R99 对每份报告记 SHA 的惯例)。
- 标注:报告可能存于仓外 scratchpad(**未核实**);evidence 对每条 A 级都做了「调度方逐条独立核验」并给出可复核的代码级证据,收口结论本身不依赖报告原文。
- 建议处置:按 89-92 先例把四轮 prompt+报告入库(或在 evidence 补 SHA-256 与存放路径)。

**B-3 · 审计 commit 清单覆盖缺口:本线至少 14 个 main 上的 commit 不在 23 条中**
- 主张与证据(均本会话 `git log`/`merge-base` 实测,全部 on main):
  - `5036bee` 08-22 canonical 前置回写(07 D8 supersede/ADR-001 附注/ADR-002 状态更正/09 §11+§9)——**方案 §5 左栏 P-1..P-5 的落地 commit**,与 4c4bf96 同分支经 4d2824e 合入,清单收了同分支的 4c4bf96/ad8adb1 却漏它;
  - `058090d` 08-22 win32 claude 门脚本四路三态(evidence §7 A-1 的处置 commit);
  - `3bf3d10` 08-22 门脚本路径单源(evidence §7 B-5);
  - `1d1d822` 08-22 settleAttempt resolveClaim 同族防御(评审 91 A-5 关联);
  - `6d98a6e` 08-22 门脚本与 daemon 圈根真对齐(评审 92 A-1/B-4 的终局处置 + owner 解除红线;亦是常驻 runtime 部署 SHA);
  - `57819ad`/`109dacc` 08-25 v1-v20 保全 + 三份产物结构手术(R101/R102 的落地 commit,本专题文档形态的转折点);
  - `6467076` 08-26 R 编号重排(本审计任务点名的事件本身);
  - `1edd3d0`/`85b0470`/`ef0ddd0` 08-26 合并/脱敏(604 处绝对路径)/R109;
  - `88ac8a2`/`61ce050` 08-26 prompts/205 及其门 2 更新(「IMPL-16 五条阻断已复核基本解除」——IMPL-16 现势的唯一书面更新处);
  - `9417b6d` 08-27 evidence §15-§18 全账回填(+305 行)——**HANDOFF/PLAN-2 记录的收口 SHA 本身**。
- 边缘归属(可归他线,列出备查):`479634c`/`cdf49f2`(备案/官网)、`d406387`(backup 身份锚,评审 92 新 A 的肇因)、`9a3e180`(ios 门禁删除,owner 裁决经 w54b 对账发现)、`c383bc0`/`5e27796`(账本重生成)、w54a/w54b 分支内代码提交(经 merge 已覆盖)。
- 影响:仅基于 23 条做 commit→文档审计会漏掉 canonical 回写与收口证据两大节点的核对面。
- 建议处置:清单生成规则改为「first-parent 主线 + 点名分支关键 commit」,或按 subject/路径双过滤后人工补录。

**B-4 · IMPL-PROMPT-16 执行完毕后,头部「当前不可执行」警告未更新**
- 主张:`docs/plan/IMPL-PROMPT-16-W54B-CLOSEOUT.md:3` 仍写「本 Prompt 当前**不可执行**(2026-08-25 复核)」;但其阶段 A 已于 08-26 执行(evidence §14 首句「依据 IMPL-PROMPT-16 §3 阶段 A」)、阶段 C 已于 08-27 执行(`728eeb6` message 首句「IMPL-PROMPT-16 阶段 C」),批已关。
- 证据:`git log --all -- docs/plan/IMPL-PROMPT-16…` 显示 3d7f202 后仅 85b0470(脱敏)触过该文件,无状态更新;grep 该文件无 2026-08-26/27 或「已启用/已收口」字样。五条阻断中第 3 条(「三份均只存在于 codex/week-audit-… 分支」)在 1edd3d0 合并后已不成立;第 5 条(20 个 worktree)也已变化。阻断解除的书面记录只在 prompts/205 门 2(`61ce050`)与 HANDOFF/PLAN-2。
- 影响:零上下文读者读该 prompt 会得到「不可执行」的过时结论;虽然其 §1 必读第 1 条会引导去 HANDOFF(指针已空),误导可自愈,但与本仓「supersede 标注」惯例不符。
- 建议处置:头部警告块加一行终态注記(「五条阻断已于 08-26 复核解除(prompts/205 门 2);本 Prompt 阶段 A/C 已于 08-26/27 执行完毕,批已收口(HANDOFF:46,`728eeb6`),本文件转为历史存档」)。

**B-5 · 关批时 IMPL-16 §3 阶段 C 前置第三条未满足,未见 owner 对该条的明示豁免**
- 主张:IMPL-16:162-165 阶段 C 前置断言(「任一不成立即停」)含「`IMPL-PROMPT-15` §3.5 的四条 owner 决策附注位**均有处置记录**」;实际关批时第 2 条(方案 §8 残余形式确认)与第 3 条(ADR-002 状态更正确认)无书面确认。
- 证据:`728eeb6` commit message「**未见书面确认**如实标注:IMPL-PROMPT-15 §3.5 第 2 条…与第 3 条…在代码与文档中均无痕迹,不当作已处置」;HANDOFF:46 末尾同文;IMPL-PROMPT-15:47-50(§3.5 原文四条);owner 08-27 三项裁决(evidence §18.5)为「停止返工进关批/L-1 独立线/合入 main」,未点名豁免 §3.5 第 2/3 条。
- 缓解:处理方式透明(如实标注「未决」,未涂绿),且 §3.5 第 2 条自述「W5.4-a 的实施已隐含方案主体接受,此处为形式确认位」,实质风险低;owner「进关批流程」裁决可宽泛解读为覆盖。但按 prompt 字面,这是一次「前置不满足仍执行」的偏离,豁免未落到条目粒度。
- 建议处置:请 owner 对 §3.5 第 2/3 条补一句书面确认(或明示豁免),回填 HANDOFF:46 的「未决」标注即闭环。

### C 级(观察)

**C-1 · 行数/计数口径微漂(无实质矛盾,均可对账)**
- 归档文件:主方案头表(:16)记 review-loop-archive「(741 行)」,实际文件 757 行(741 = 原 §17 内容行数,见归档头「共 741 行」;+16 行归档说明头);journal R101(:2321)又写「742 行原样移出」,与 741 差 1。
- 合同草案行数三口径:主方案头(:15)与 IMPL-16(:219)记「45,696 行 TypeScript」(= R101 的净提取行);PLAN-2:149 记「10 个 `.ts` + README,合计 45,734 行」——本会话实测 `.ts` `wc -l` 合计恰 45,734,但**不含** README(87 行;含 README 为 45,821),「合计」措辞不准;R101(:2323)自账 45,744 = 45,696+32 注释+16 尾空行(与 wc -l 差 10 = 10 个文件尾无换行)。
- 建议处置:顺手统一时以「`.ts` wc -l 45,734 + README 87」为准;不必专批。

**C-2 · 会话日期与 commit 日期错位**
- journal R109 标题「(2026-08-25)」(:2742),其五个 commit(6467076/1edd3d0/85b0470/9e9afee/ef0ddd0)实际均在 08-26 01:28-01:36(跨零点会话);evidence §14 标题「2026-08-26」而其 commit `52119ff` 在 08-27 09:38。均为「按会话起始日记账」惯例,读者跨查 git 时需知晓。

**C-3 · 未签决策使用已勾选 checkbox 表达「预填待确认」**
- `2026-08-24-ai-supply-owner-decisions.md` 决策 3/4/5/8/9 的「[x] 采纳上述默认推荐 ← Claude 预填草案,待 owner 确认」为勾选态但签署人/日期栏空;速读易误当已签。主方案头部与 PLAN-2 红线 3 的「未签六项」口径一致,故无实际不一致;建议未签项改用 [ ] + 预填标注。

**C-4 · Phase 5 重组的执行时点两处措辞略有出入**
- 主方案 :1716-1717「由本专题**正式排产时**(决策 1:w54b-wiring C3 收口之后)执行重组」;PLAN-2 子批表把重组落在 `ai-supply-p*`(scope → contracts 之后的第三级子批)。排产(08-27)已完成而重组未做,按 PLAN-2 口径无问题;按主方案字面「排产时」已到点。意图(实施 Phase 5 前完成重组)一致,建议主方案改为「正式实施 §10 时」。

**C-5 · 第四轮复审字面结论 No-Go,关批以 owner 裁决 + 归属核验满足「A 级 0」前置**
- IMPL-16:163 前置为「独立复审结论为 A 级 0(或 A 级已全部回修并经复审确认)」;第四轮(evidence §18.1)结论 No-Go + 1 条 A 级新问题。该 A 级经调度方归属核验(`git show 5036bee:…/byoa/{provider,runner}.ts`,§18.2 表)判为基线既有缺陷,owner 裁决「以 W5.4-b 自身 A 级 0 为准,停止返工进关批」并将 L-1 转独立安全线。链路透明、证据在案,属 owner 权限内的裁决;记录备查。

**C-6 · prompts 编号 205 撞号**
- `prompts/205-ai-supply-activation-refresh.md` 与 `prompts/205-capture-device-ingress-adversarial-review.md`(另一工作线)共用 205 前缀。本仓曾因 IMPL-PROMPT-11 撞号做过勘误(IMPL-15:5 自注),prompt 序号同样值得建唯一性约定。

---

## 4. 复核基线与命令要点(可重放)

- 分支/状态:`git branch --show-current` = main;`git status --porcelain -- docs/plan docs/review e2e history` 空。
- 23 条在 main:逐条 `git merge-base --is-ancestor <h> main` 全部通过;`origin/main` = `12ba011`(含 `728eeb6`)。
- 门禁复跑(本会话):`pnpm --filter @saydo/daemon exec vitest run test/tier1-claude-backend.test.ts test/tier1-claude-outcome.test.ts test/tier1-file-tool-effect.test.ts test/tier1-cursor-backend.test.ts test/tier1-cmd-effect.test.ts test/tier1-gate-socket.test.ts` → **6 files / 342 passed / EXIT=0**。
- SHA-256 复算:主方案 `6641d2b2…fbd0`、决策单 `bb61b24b…2ea` 与 PLAN-2:147-148 记录一致。
- 未核实项(如实):w54b 收口全量门禁数字(daemon 2174/6、playwright 36)未在本会话复跑,采信 evidence §17.3 记录;四轮复审报告原文在仓外,未读到;`~/.saydo/runtime` 现场状态未探活。

