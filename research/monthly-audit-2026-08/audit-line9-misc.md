# 第 9 线兜底审计报告:杂项/早期提交(178 条)

- 日期:2026-08-27
- 审计员:零上下文兜底线(line9-misc)
- 基线:`main` @ `f723ab7`(本会话 `git branch --show-current` = main;`git log -1` 实测)
- 输入:`scratchpad/line9-misc.txt`(178 条,hash|日期|subject;本会话逐条生成 footprint 于 `scratchpad/line9-footprint.txt`)
- 方法:① 逐 hash 对 `history/PROCESS-JOURNAL.md`、`history/DEV-VERSION-LEDGER.md`、`docs/review/`、`docs/plan/`、`e2e/evidence/`、`docs/release/`、`history/reviews/` 做全文交叉引用(结果 `scratchpad/line9-refs.txt`:106 条有直接引用,72 条无);② 无直接引用者用 `git merge-base --is-ancestor` 对台账登记的批次末码验证批次隶属;③ 锚定文档结论逐条对代码/后续历史核验;④ merge 用分支 ahead 计数与 R113 盘点记录核对。
- 只读纪律:本会话未修改/新建仓库正式文件,未 git add/commit;仅写 scratchpad。

## 结论速览

| 级别 | 数量 |
|---|---|
| A(错误/不一致) | 1 |
| B(疏漏/不足) | 3 |
| C(观察) | 5 |

178 条提交在簇级**全部有归属**(依托 journal R 节、DEV-VERSION-LEDGER §2 批次台账、R84 补录索引与各 evidence/readback 文档);未发现"实质性改动簇完全无文档"的情形。主要疏漏集中在:08-23~08-26 各线的双轨登记(journal 一行索引 + 台账行)断档、两组编号撞号未按制度登记、以及 08-13 DSH 借鉴评估的一处事实性错误与其"第一刀"建议的悬空。

---

## §1 分簇归纳(任务 A)

台账(`history/DEV-VERSION-LEDGER.md` §2)与 journal R84(`history/PROCESS-JOURNAL.md:1793`,8 月批次补录索引)是簇级归属的两大载体;R84 结论明言"上述批次的完成度口径以各自 evidence 为准,本节只做索引"。下表 178 条全覆盖(提交数相加 = 178)。

| # | 簇 | 条数 | 代表提交 | 记录载体(本会话实读) | 归属 |
|---|---|---|---|---|---|
| 1 | W4 批 + RA-closeout + dogfood 语音修复(07-27~28) | 13 | `c108c42` 开批、`af1af36` S3 卡全链、`3962a72` ra-closeout、`31e42e2`/`7c7b68b` dogfood | journal R52/R53/R54/R55(+补记)/R56(+补记)/R57;`e2e/evidence/w4-batch.md`、`ra-closeout-batch.md`;台账时代 III 行(末码 `b5d45e9`/`c59edd1`/`838aeea`) | 有 |
| 2 | voice-coding 单仓合并(07-29) | 1 | `f28489d`(202 文件) | journal R58-R61;`docs/plan/MIGRATION.md`;台账时代 IV;Codex 24/25/26 | 有 |
| 3 | 发布前 + 场次①返工(07-30~31) | 2 | `97b01f7`、`ada7981`(88 文件) | journal R62/R63;台账时代 IV 行("场次①返工…`ada7981`(常驻锚)");`97b01f7` 被 phase-gap:61 与 now-vs-later:17 引用 | 有 |
| 4 | Focus Contract 时代(08-04~08-10):E2 追修串、批 0-4、redesign B1、v0.4 批①-④(confirm/dialog 线)、L1-L5、onboarding、HANDOFF/DEPLOY docs、demo | 21 | `4272c0a` 批3 交互层、`c100ce6`/`f6f9e29` expectation_ack/remainingIntent、`e108fff` injectControlTurn、`80fcdc2` 批次⓪ canonical、`862d921` onboarding、`4d41775` L1-L5 | journal R84 补录(该时代逐批末码:`c00f09f`/`820218d`/`4ce320b`/`12d3474`/`4d41775`/`862d921`);台账时代 V;`e2e/evidence/focus-contract-batch.md`;HANDOFF-前端组件化/2/3;09 §15 回写 `9b8c7e9` | 有(索引级) |
| 5 | 资源画像向导批 HANDOFF-4(08-11) | 2 | `da77150`、`675c969` | 台账时代 V 末行(末码 `e0bb23a`,载体 HANDOFF-4) | 有 |
| 6 | T17/T17b 如实化 + 首跑(08-11) | 9 | `bc93b4b`、`8631daa`、`415df2a` | journal R64/R65;findings 47/48;台账时代 VI | 有 |
| 7 | M1 移动 Web 纸账本(08-11) | 2 | `f3170c7`、`f98cc78` | journal R66;findings 49-52 | 有 |
| 8 | T18a/T18b 三槽 CLI 运行时(08-11~12) | 9 | `b31a5c3`、`e33f412`、`197d4f1` | journal R67/R68;findings 53-56;台账(末码 `9a6e767`/`197d4f1`) | 有 |
| 9 | M2 三端壳 + iOS 原生语音层 + iPad/记忆修复(08-12) | 11 | `660846c`/`1f96f24`/`369cb66` 三壳、`2f49597` 语音闭环、`60d96ca` iPad | R84 索引 + 台账(末码 `381798d`/`2f49597`/`60d96ca`);findings 57/58/59 | 有 |
| 10 | D1 桌面地基 + 测试基建(08-12) | 8 | `f2e80bd` saydo CLI、`84132c7` lifecycle、`5811fc5` 临时目录 | journal 无编号条目"2026-08-12 — D1 终审 findings 修复(62 号自审)"(:1396);台账(末码 `b74a00b`);findings 61 双份/62 | 有 |
| 11 | voice-fix 前后端批(08-12) | 3 | merge `6cd362d`/`a7d517c`、`de0e667` | R84 索引;台账;findings 63/64 | 有 |
| 12 | DEPLOY 清单演进(08-12) | 1 | `b0278c3` | 台账时代 V 行载体列(`dfdf1d7`/`14d16ac` 同线) | 有 |
| 13 | 08-13 五批:CLI 供给扩容 / 向导 T19+polish / 融合布局 / 全端 UI 标准化+品牌朱印 / 上架材料(含 65-68 号评审入库) | 27 | merge `aa8034e`、`4196613`(36 文件)、`ecdd1d2` 朱印、`6194046` store、`05f714c` 色值门禁 | R84 索引逐批(末码 `aa8034e`/`1b59da2` 段/`013d84b` 段/`af80b26` 段/`05f714c` 段/`6194046`);`docs/plan/2026-08-13-ui-standardization-audit.md`;findings 65/66/67/68 | 有(索引级) |
| 14 | 08-14~15 尾批:死代码清理、emoji icns、定名「说到」、DeepSeek 直连、默认 Runner 决策、R69-71 材料 | 6 | `789b76d`、`af5d0b1`、`b13b744`、`35604be` | R84 索引;台账;findings 69-72;`docs/plan/2026-08-15-default-runner-decision.md` | 有 |
| 15 | cmdeffect-hardening 开批 + DSH 插件线评估 + W5.4 方案(08-19) | 4 | `de6d685`、`15de970`、`29f33cf`、`cb2fba8` | journal R83(2026-08-21 补记,含 `cb2fba8` 撤回-恢复经过);`e2e/evidence/cmdeffect-hardening.md`;`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md` | 有 |
| 16 | 08-20 四批:public-readiness(templates/launchd)、s1-demo-wiring、s2-callback、w54a spike + canonical 注记 + 评审入库 | 15 | `f69ea43`/`66412d6`/`5827de2` launchd、`122d101`/`e88d9d1` templates、`3c9c52b`/`8e6c819` demo、`ed8b0f3` spike、merges `1a41b45`/`aa2dffc` | R84 索引;`e2e/evidence/public-readiness.md`、`s1-demo-wiring.md`、`s2-callback-channels.md`、`w54a-claude-cli.md`;findings 78-85;`docs/review/2026-08-21-w54a-impl-readback.fable.md` | 有 |
| 17 | status-alignment 合并(08-21) | 1 | merge `11e3653` | journal R77/R78/R79/R85;`e2e/evidence/status-alignment-20260821.md` | 有 |
| 18 | 08-22 批:Windows 对齐移植 + POSIX/Linux 门 + 一周双向对账 + 备份修复 + W5.4-b 前置 + 收口 | 15 | `1482510`(118 文件)、`058090d`、`0cad56e`、`a26d5bf`、`d406387`、`5036bee`、`6d98a6e`、`3fccf4a` | journal R89-R93、R86;`e2e/evidence/windows-alignment.md`、`w54b-batch.md`;`docs/review/2026-08-22-week-crosscheck.md`(F1-F17);台账时代 VII 六行 | 有 |
| 19 | 08-23~26 发布线:faststart 周审计 + rc.2~rc.12 链 + rc4 runtime 两轮红灯检查点与重实施 + 复盘回写 | 19 | `a15b5de`(104 文件)、`a501692`、`29c273b`/`2637d30`/`848cf38` 检查点、`b768089`、rc.7-12 回写 `84a55d0`/`4811968`/`d46f13a`/`21b365d`、merge `aa3fe34`、revert `dd8a12a` | journal R94-R97(至 rc.4);`docs/review/2026-08-23-week-audit-faststart-release.md`、`2026-08-23-remediation-ledger.md`、`2026-08-24-rc4-runtime-fresh-final-readback.md`(审查 HEAD=`2637d30`)、`2026-08-25-rc4-runtime-final-reimplementation-readback.md` §10-§17(rc.5/rc.6 于 :609,rc.7-12 于 §14-§17);`e2e/evidence/2026-08-23-rc*` 与 `2026-08-26-rc1[0-2]*` | 有(文档级;**台账/journal 索引缺,见 B-1**) |
| 20 | AI 供给文档线(08-25~26) | 8 | `109dacc`、`57819ad`(144 文件保全)、`6467076` 重编号、merge `1edd3d0`、`61ce050`/`88ac8a2` prompts 205 | journal R98-R109(R109 详记合并三问题);`docs/plan/2026-08-23-ai-supply-*` 系 | 有(**台账行缺,见 B-1**) |
| 21 | journal 回填(08-27) | 1 | `12ba011`(R113 回填) | R113 自身 | 有 |

**无归属判定:0 簇。** 72 条无直接 hash 引用的提交经 ancestry 核验全部落在台账登记的批次末码之内(见 §2),或本身就是记录载体(评审入库/回写类 docs 提交)。

## §2 无归属核查与代表性 diff(任务 B)

对 72 条 NOREF 提交的处置:

1. **批次隶属核验(本会话 `git merge-base --is-ancestor` 实测,30 项全过)**,示例:
   - `4272c0a`/`0ec441c` → E2 追修串末码 `c00f09f` 的祖先;
   - `c100ce6`/`f6f9e29`/`e108fff`(confirm/dialog 线)→ v0.4 批①-④末码 `12d3474` 的祖先;
   - `80fcdc2` → redesign B1 末码 `4ce320b` 的祖先;`d3df4ae` → L1-L5 末码 `4d41775` 的祖先;
   - `4196613` → CLI 供给扩容 merge `aa8034e` 的祖先;
   - `f2e80bd`/`84132c7`/`2ecad20`/`5811fc5`/`7632aea`/`299c9ec` → D1 末码 `b74a00b` 的祖先;
   - `ea0acb0`/`b31a5c3`/`d88fc7f`/`5950aec` → T18a 末码 `9a6e767` 的祖先;`e33f412`/`ff427bf`/`ac5d9b4` → T18b 末码 `197d4f1` 的祖先;
   - `660846c`/`1f96f24`/`369cb66` → M2 壳末码 `381798d` 的祖先;`c8aef12`/`6aa49e7` → iPad 批末码 `60d96ca` 的祖先。
2. **代表性 diff 抽读**:`4272c0a`(7 文件:console TaskModal/Chat/FocusDetail/VoiceContext + daemon index/live dialog/voiceSessions,+128/-7)与提交信息逐项吻合;`29c273b`(生命周期二次返工检查点:emergencyReaper/recoveryOnlyServer/lifecycleDisposition 等 25 文件)与 rc4 runtime 线 readback 叙事吻合(08-24 readback 明言"封存当前实现并换全新实施会话重做",检查点提交即该封存动作)。
3. **自记录类**:65/66/67/68 号评审入库、rc.7-12 复盘回写、journal 回填等 docs 提交,其内容本身就是记录,无需另立文档。
4. **残余零散小修**(`bfe9c2f`、`5b28bc2`、`ccb5cff`、`dd8a12a`)见 C-3。

## §3 锚定文档抽查(任务 C)

### 3.1 `docs/plan/2026-08-15-default-runner-decision.md` — 一致,无悬空

- 决策"不把 DSH 当默认 Runner"与后续历史一致:W5.4 走 Claude Code CLI(`docs/plan/2026-08-19-w54-claude-cli-tier1.fable.md:6` 明示与决策点 2"正交,不取代、不预设";:327"native_api 另立战役")。
- 文中"已实施"断言逐条对当前代码核验属实:解释器/`just` 移出 S1(`packages/daemon/src/tier1/cmdEffect.ts:28-37` 注释与词表)、`SLOT_TIMEOUT_MS`(`packages/daemon/src/providers/resolve.ts:26`)、`DEEPSEEK_API_KEY` 白名单(`packages/daemon/src/config/envFile.ts:12,28`)、finish=length 空回答显形(`packages/daemon/src/providers/openaiCompat.ts:192-196`)。
- 决策点 2(是否立 `native_api` 执行器批)至今无 owner 裁决记录 → C-2。

### 3.2 `docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md` — 1 处事实错误 + 第一刀悬空

- **D-09 现状断言错误**(→ A-1):doc :54 称本产品"没有(spawn CLI 路径未做启发式剥离)",但其自述基线 `c5148ab` 上,BYOA spawn 已走白名单剥离(`git show c5148ab:packages/daemon/src/providers/byoa/runner.ts`,:50 `buildSpawnEnv` 定义、:113 spawn 处 `env: buildSpawnEnv(opts.passEnv)`,注释"spawn env 默认剥离,只透传显式给定的";该函数 `git log -S` 溯源至 07-24 `ca102ea` phase-1),tier1 executor 亦有 `AGENT_ENV_ALLOWLIST`(c5148ab 版 2 处命中)。白名单严于启发式剥离,"没有"不成立。
- **第一刀/`borrow-dsh-invariants` 悬空**(→ B-3):doc 文末建议批次(D-01 对话环重建不变量 / D-05 组装 snapshot / D-02+D-14 单调 deny+enforcement 字段 / D-09)。核验:`IMPLEMENTATION-PLAN-2.md` 与 `HANDOFF.md` 对 "D-01/第一刀/deepseek-harness/DSH" 零命中;`packages/daemon/src/brain/dialogLoop.ts` 无重建断言(重建/rebuild/derive 零命中);daemon 全源无 `enforcement` 分档字段(唯一命中是 focus flag 注释);journal 亦无该批开批/放弃记录。唯 D-09 因既有白名单而实质已满足。

### 3.3 `docs/plan/2026-08-17-dsh-plugin-line-assessment.fable.md` — 一致

- 自我定位为仓外实验("不占 SayDo 批次指针",遵守 now-vs-later:55 边界),不对 SayDo 产生实施义务。其对 SayDo 代码的引证抽查属实(`packages/console/src/components/redesign/BoardLaneGroup.tsx:1-3` 原文与引文一致)。v0.7 主轴建议属外部仓(memory 亦证 lanes v0.7 已在外部落地)。无悬空。

### 3.4 `docs/review/2026-08-14-saydo-phase-gap-analysis.md` — 快照准确,遗留两点

- 快照锚定纪律好(全部数字带时点)。其缺口清单的后续状态逐项核验:B2 移动进壳 → remote-mobile-w0 已实施收口(now-vs-later §6,代码 `addfd19`,R71-R73);B4 排产权威 → HANDOFF 指针制度恢复(R86 起有据);B5 emoji icns 误扫 → `2402143`(08-15)修复;B6 软著/备案 → R87/R88、R80-R82 落地;B1 四场真人验收 → 仍 not_run 但被持续跟踪(HANDOFF:49,68;faststart 计划 :18"v0.1.0 仍受四场真人验收门约束";R110"四场真人验收…未触及")→ C-5。
- **B0(v0.1.0 范围裁决)无显式裁决记录** → C-1:该文要求"需显式裁决记录确认或推翻";其后 rc.2~rc.12 候选链从当期 main 切出(事实上把 8 月工作纳入 v0.1.0 候选),faststart 计划为 owner 批准的载体,但全仓 "v0.2" 仅存于 phase-gap 自身与 journal:1495 的转述,无一处回指 B0 说明其已被 supersede。

### 3.5 `docs/review/2026-08-16-now-vs-later.md` — 一致,已实施

- §6 实施状态自证(基线 `3197fd8`,代码 `addfd19`),与台账时代 VII "remote-mobile-w0" 行(R71/R72/R73、Codex 73/74)一致。"§2 先不做"清单各项均有明确理由与去向(native_api 见 C-2)。无悬空。

### 3.6 `docs/review/2026-08-25-agent-cli-acp-capability-survey.md` — 已被消费

- 结论"ACP 触发条件已满足"被 `docs/plan/2026-08-24-ai-supply-owner-decisions.md` 决策 2 全文引用并纳入裁决材料(:52-111);`docs/07-tech-stack-decisions.md` ACP"跟进不押注"句仍在(§5 表后段,本会话实读),与决策文引用的原文一致。其 11 CLI 实测矩阵为本机一次性实测,本审计未复跑(标注:未核实,不影响归属判定)。无悬空。

## §4 merge 审计(任务 D)

本线 11 个 merge(`254491d`、`6d3c050`、`6cd362d`、`a7d517c`、`aa8034e`、`1a41b45`、`aa2dffc`、`11e3653`、`1edd3d0`、`aa3fe34`;另 `f28489d` 是单亲迁移提交非 merge):

1. **combined diff 形态**:多数为干净 merge(combined diff 0 文件);`aa2dffc`(s2)含 4 文件冲突解决(docs/09 + console + daemon,与 s1/s2 相邻批冲突相符)、`1edd3d0` 含 1 文件(journal,R109 明记编号重排冲突处置)、`aa3fe34` 含 2 文件(scripts,release 线合并)。均有对应记录,无未解释的 evil-merge。
2. **原线有始有终**:当前本地分支仅 3 条(实测 `git branch -vv`):`claude/trusting-panini-f5d41b` ahead=0(已由 `f723ab7` 并入)、`codex/week-audit-faststart-20260822` ahead=0、`codex/week-audit-evidence-20260823` ahead=1(`6624299` 旧账本冻结)。该 1 条未并入是 R113 盘点明文裁决的"不该合并"项("main 上的账本更新…合并会用旧版覆盖新版");R113 记录 17 本地分支 15 条 `git cherry`=0、2 条留存有因。远端 `origin/feature/focus-contract-v0`(tip=`6d3c050`)ahead-of-main=0,仅为陈旧引用。
3. **结论**:merge 线闭合状况良好,唯陈旧远端分支 `origin/feature/focus-contract-v0` 可删(C-4)。

## §5 发现清单

### A-1(A 级)· DSH 借鉴评估 D-09"现状=没有"与其自身基线代码不符

- **主张**:`docs/plan/2026-08-13-deepseek-harness-borrowing-assessment.fable.md:54` 断言 SayDo "没有(spawn CLI 路径未做启发式剥离)"并据此给 D-09 判"A 直接借";但该文自述基线 `c5148ab` 上 BYOA spawn 已用白名单构造子进程环境(默认剥离、仅透传显式白名单),tier1 executor 亦有 `AGENT_ENV_ALLOWLIST`。评估的"现状=没有"为事实错误(实际现状强于其建议目标)。
- **证据**:`git show c5148ab:packages/daemon/src/providers/byoa/runner.ts` :50/:113(`buildSpawnEnv` 定义与 spawn 处使用,注释"spawn env 默认剥离,只透传显式给定的");`git log -S "BYOA spawn env 白名单"` → `ca102ea 2026-07-24 feat(phase-1)`;`git show c5148ab:packages/daemon/src/tier1/executor.ts | grep -c AGENT_ENV_ALLOWLIST` = 2;doc 原文 :54、:155(第一刀第 4 行)。
- **影响**:低(方向保守——建议做的事已存在,不构成生产风险);但属锚定文档的结论性事实错误,且导致第一刀清单含一条已满足项。
- **建议处置**:在该 doc D-09 行加勘误注(现状改"已有,白名单形态强于启发式剥离",裁决改 C/已满足),并在第一刀表同步划去第 4 项。

### B-1(B 级)· 双轨登记断档:08-23~08-26 各线无台账行、发布链 rc.5-rc.12 无 journal 一行索引

- **主张**:R84 结论承诺"后续批次收口按 PLAN-2 §7-9 一行索引 + 台账 §2 追加行双轨登记,不再欠账"(journal:1819)。实测台账 §2 时代 VII 的批次行从 08-22(:129-132)直接跳到 08-27(:133-135),缺:faststart 周审计与 rc.2~rc.12 发布链(R94-R97 只到 rc.4)、rc4 runtime 两轮红灯与全新重实施(记录在 2026-08-24/25 两份 readback)、AI 供给文档线(R98-R109)、capture ingress(R111)、600 条 dry run(R112)、R113 保全批。journal 侧 rc.5-rc.12 亦无任何 R 节(grep "rc\.5|…|rc\.12" 仅命中 R113 区域 3 行),该段唯一记录载体是 `docs/review/2026-08-25-rc4-runtime-final-reimplementation-readback.md` §10-§17。
- **证据**:`history/DEV-VERSION-LEDGER.md` §2 行号 129-135(本会话结构 grep);`history/PROCESS-JOURNAL.md:1819`;journal 全文 rc.5-12 grep 仅 :2796/:2803-2804/:2921-2940(均 R113 语境);readback §14 :609("rc.4(漏 freeze)→ rc.5(doc-links)→ rc.6(e2e 偶发…)")与 §14-§17 标题。
- **影响**:中。记录存在但索引断档,与 R84 明示的制度承诺不符;月度审计从台账/journal 双入口都找不到 08-23~26 发布链与 runtime 重实施的批次行。
- **建议处置**:按 R84 同款"一行索引补录"格式,为上述各线补台账 §2 行 + journal 一行索引(或在 R110 后追加一节补录);记录载体指向既有 readback/review 文档即可,不重写叙事。

### B-2(B 级)· 编号撞号未登记:prompts/205 x2、research/codex-findings/100 x2

- **主张**:台账 §3 自述为"唯一勘误登记处",但两组新撞号未登记:`prompts/205-ai-supply-activation-refresh.md` vs `prompts/205-capture-device-ingress-adversarial-review.md`(分别由 AI 供给线 `88ac8a2`/`61ce050` 与 capture 线 R111 产出);`research/codex-findings/100-ai-supply-universal-onboarding-final-billing-gate-review.md` vs `100-capture-device-ingress-adversarial-review.md`。journal 引用两个"prompts/205"时(R110 "prompts/205 的坐标刷新" vs R111 产出清单)如不带全名会歧义。
- **证据**:`ls prompts/ | grep -E "^20[45]"` 与 `ls research/codex-findings/ | grep -E "^10[05]"` 本会话实测各出两份;台账 §3 grep "205-|100-" 零命中(登记停在 88 号双主题)。
- **建议处置**:台账 §3 各加一行登记(同线历史重复不重编号,只登记);journal/文档引用处补全名。

### B-3(B 级)· `borrow-dsh-invariants` 第一刀建议悬空:未开批、未落地、未标注放弃

- **主张**:2026-08-13 借鉴评估文末给出可开批建议(批名、四条目、依赖、验收锚),其中 D-01(对话环"实发 messages 可由 transcript 重建"不变量)、D-05(组装后 snapshot 覆盖对话环)、D-02+D-14(单调 deny + cage `enforcement` 字段)至今:无实现痕迹、无排产行、无 owner 采纳/放弃记录。这正是"文档写了计划但从未实施、也从未标注放弃"的悬空形态(D-09 一条因 A-1 所述已天然满足,不在此列)。
- **证据**:`grep -n "D-01|D-02|D-09|D-14|第一刀|deepseek-harness|DSH" docs/plan/IMPLEMENTATION-PLAN-2.md HANDOFF.md` 零命中;`packages/daemon/src/brain/dialogLoop.ts` 对 重建/rebuild/derive 零命中;daemon 全源 `enforcement` 仅 focus flag 注释一处;journal 对"借鉴评估/第一刀"零命中(仅 R13 的另一份 7 月评估)。
- **建议处置**:owner 三选一并留痕:开 `borrow-dsh-invariants` 小批 / 显式放弃(在 doc 文末加状态注)/ 并入某后续批(如 W5.4-c)的顺带项清单。

### C-1(C 级)· phase-gap B0(v0.1.0 范围)被事实 supersede 但无显式裁决回指

- 2026-08-14 phase-gap 要求对"8 月=v0.2 还是纳入 v0.1.0"落显式裁决记录;此后 faststart 线(owner 批准的 `docs/plan/2026-08-22-week-audit-faststart-release.fable.md`:18 "v0.1.0 仍受四场真人验收门约束…只发布不可移动预发布标签")以 rc.2~rc.12 从当期 main 切候选,事实上采纳"8 月工作进 v0.1.0 候选"。实质已解,但无任何文档回指 B0 宣告其关闭。建议在 phase-gap 文头或台账 §3 补一句 supersede 注。

### C-2(C 级)· `native_api` 执行器决策点(默认 Runner 决策 §6.2)长期无裁决、不在任何排产篮

- 三份文档一致将其留给 owner(决策文 §6.2、w54 计划 :327"另立战役"、now-vs-later §2"需 owner 另立战役"),AI 供给终稿仅在供给层收编 `global_native_api` protocol profile(:1264),执行器层问题仍未答。不构成悬空承诺(明示待拍板),但已跨 6 份文档 12 天无去向;建议进 owner 决策清单一并处置(做/不做/并入 AI 供给 Phase)。

### C-3(C 级)· rc 链上 4 个零散小提交无任何文档引用(可随 B-1 一并消化)

- `bfe9c2f`(e2e 启动诊断)、`5b28bc2`(cli-reap 等待窗;主题与 `261c32b` 回写的"等待窗四处修复"同源)、`ccb5cff`(rc.4 说明改引用)、`dd8a12a`(revert `358c451`,同线自我修正,revert 目标存在于同分支历史,本会话 `git log --grep` 实证)。均为 rc 链内自洽小修,补 B-1 索引行后即随线归档,无需单独文档。

### C-4(C 级)· 陈旧远端分支 `origin/feature/focus-contract-v0` 可清理

- tip=`6d3c050`(08-09 merge),ahead-of-main=0(本会话实测)。该线已于 08 月经 R84/台账收口,远端引用留存无害但易误导,建议随下次清理删除。

### C-5(C 级)· 四场真人验收自 07-31 悬置至今,但跟踪链完好(非疏漏,登记事实)

- ①failed@`ada7981c`、②③④ not_run 的状态自 07-31 起未变;HANDOFF(:49 "owner 需重新声明四场基线"、:68)、faststart 计划(:18/:263)、R110("四场真人验收…未触及")持续如实跟踪。属 owner 真人时间瓶颈的已知事实,非记录缺口;月度视角提示:发布锁已因 08-21/08-22 两次变更两度前移,四场基线重声明仍待 owner。

## §6 方法边界与未核实项

- 锚定文档中的**外部事实**(DSH 仓 file:line、11 个 CLI 的 ACP 实测、npm 1211 包计数)未复跑,以原文自述为准,不影响本审计的归属与一致性结论。
- rc.2~rc.12 的公开仓 tag/Release 实体未远端复核(本地仅 `v0.1.0-rc.1` tag + `public/release-v0.1.0-rc.10/11/12` 远端分支引用,实测 `git tag`/`git branch -r`);rc 链事实以 readback 文档与 evidence JSON 为准。
- 台账/journal 的 07 月早期条目(R1-R63)未逐条复核,仅核到与本线 178 条相关的节。
- 本会话所有断言的证据命令与输出摘录散见各节;中间产物:`scratchpad/line9-footprint.txt`(178 条 footprint)、`scratchpad/line9-refs.txt`(REF/NOREF 交叉引用表)。
