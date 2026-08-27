# SayDo 开发版本台账(内部)

> 定位:**内部开发版本记录**——按批次/时代收录全部开发工作单元的结构化索引,非对外发布记录(对外版本 = git tag / 商店提审 / 备案,见 §4 与 `docs/release/`)。
> 分工:`history/PROCESS-JOURNAL.md` = 轮次叙事真相源;`HANDOFF.md` = 当前实施状态;`docs/plan/IMPLEMENTATION-PLAN-2.md` = 排产源;**本文件 = 批次级结构化索引**,四者互补,不互相取代。
> 维护纪律:每个批次收口时,与 PLAN-2 §7-9 的 journal 一行索引同时,在 §2 对应时代表尾追加一行;历史行只读不改(勘误走 §3 登记)。
> 真相源声明:各行「代码」列 = 批次收口/合并提交(末码),批内全部提交以 `git log` 为准;evidence 列的裸文件名均位于 `e2e/evidence/`,其余引用写全路径;详情以 evidence 文件为准。本表建立于 2026-08-21(评审 88 对账轮),此前批次为回溯补录。
> 公开边界注意:本仓过程档案(含本文件)当前会随公开快照仓(`scripts/publish-public-snapshot.sh` 推整树)发布;「档案公开边界与既有承诺(README §隐私 / MIGRATION 脱敏注)的冲突」已作为评审 88 的 A 级裁决点上浮 owner,裁决前本文件不承诺快照层私有,也不得写入本机绝对路径与会话私密。

## 1. 版本线速览(多条版本号线并存)

| 版本线 | 范围 | 说明 |
|---|---|---|
| 方案版本 v1.0 → v1.14 | 2026-07-18 ~ 07-22 | 设计期主方案演进,终版 `history/voice-coding-framework.Cursor2.md`;逐版变化见 journal R1-R16 与「版本时间线(速览)」表 |
| 文档集 docs v2.0 | 2026-07-22 起 | 方案重写为正式 canonical(docs/01-11 + modules + adr),此后按评审轮次持续修订,不再打整册版本号 |
| 实施批次制 | 2026-07-24 起 | 版本推进单位从「方案版本」切换为「批次」(Phase N → W 系列 → 专项批),本文件 §2 为全量台账 |
| git tag | v0.1.0-rc.1 @ `628f7e4`(2026-07-25) | 唯一 tag;`v0.1.0` 待场次④通过后由 owner 授权打;返工走 rc.N+1,旧 rc 不移动 |
| DDL schema 版本 | v1 → v26+(持续) | daemon SQLite 迁移链;铁律 = 改 DDL_V1 必配增量迁移(HANDOFF §4) |
| 知识底座 generation | generation 5(AGENTS.md 知识块所记) | 底座文件在本机运行时目录(不在仓内);仓内可复核出处 = AGENTS.md 知识块与 `docs/plan/MIGRATION.md` 迁移快照 |

## 2. 批次台账

### 时代 I · 设计期(2026-07-18 ~ 07-23;无代码)

| 工作单元 | 日期 | 产物 | journal | 评审 |
|---|---|---|---|---|
| 方案 v1.0 → v1.14(可行性 → 竞品 → 形态 → 深评) | 07-18 ~ 07-22 | `history/voice-coding-framework.Cursor2.md` | R1-R16 | findings 01-04(R15 四会话深评:架构/Hopper/语音记忆/交互) |
| 文档集标准化重写 docs v2.0 + 选型 ADR | 07-22 | docs/01-08、工程 ADR-001 | R17-R23 | findings 05(docs 全量,R17) |
| 评审制度立规 + 开工前补文档(09/10)+ 实施计划 + IMPL-PROMPT | 07-23 | AGENTS.md、docs/09/10、IMPLEMENTATION-PLAN、IMPL-PROMPT | R24-R31 | findings 06-11(制度轮/合同/计划/BYOA/价值/计划 v2.5) |
| 通话形态调研与方案锁定(不实施) | 07-23 | `research/phone-call-impl-plan-2026-07.md` v3 | R32-R37(设计序列;R35 缺号见 §3) | prompt 在 findings 子目录 15/16;报告未单独入 findings,评审结论并入 `research/phone-call-*.md` 方案文档(v3 自带评审吸收) |

### 时代 II · 首发实施期(2026-07-24 ~ 07-25)

| 批次 | 日期 | 代码(末码) | evidence | journal | 评审 |
|---|---|---|---|---|---|
| Phase 0(脚手架 + 契约包 + 窄闭环 PoC) | 07-24 | `0632a6a` | `phase-0.md` | —(HANDOFF/evidence 承载) | 自审 2A/8B |
| Phase 1(语音中枢全链 + BYOA + 会话/工具路由;ASR 定档 `d3d4d71`) | 07-24 | `d3d4d71` | `phase-1.md` | — | 工程 ADR-101 |
| Phase 2(记忆账本 + 上下文编译 + 奠基器 + 热词) | 07-24 | `795dd66` | `phase-2.md` | — | 评审回修 2A/6B/3C |
| Phase 3(含 3-pre 源快照合同) | 07-24 ~ 07-25 | `5d2522c` | `phase-3.md` | R33(实施序列) | Codex No-Go 回修(`43fd741`) |
| Phase 4(执行器适配 + 审批 + 回叫 + steer) | 07-25 | `319ba22` | `phase-4.md` | — | 迟到批回修 `e50668e` |
| M 批(外部评审 M1-M11 代码项) | 07-25 | `1d83658` | `review-m-batch.md` | R34 | Codex 13/13b |
| Phase 5(P0 总验收 + Gate 0 证据 + golden) | 07-25 | `1d1552f` | `phase-5.md`、`gate0-checklist.md` | — | — |
| P0.5-A/B/C/E(契约封闭 + Hopper 桥 + 直达验收 + Demo 生成器) | 07-25 | `922f6e6` | `p05.md` | — | — |
| 收口对账(独立复核 + Gate 0 证据修复 + HANDOFF 重写 + rc.1 tag) | 07-25 | `628f7e4`(tag) | `closeout-verification.md`、`final-readback.md`、`p0-readback.md` | R35/R36 | Codex 14/15 |
| 五路对抗面板(owner 四项拍板) | 07-25 | `4307358` | — | R37 | findings 15 |
| 接线增量批(HANDOFF §2-9 六项) | 07-25 | `2292a37`(+回收 `cd9f893`/`2f657ed`) | `wiring-batch.md` | R38/R39 | Codex 16 |
| Tier1 生产执行器批 | 07-25 | `602aa09`(+勘误 `65559c2`) | `executor-batch.md`、`tier1-conformance.md` | R47(原 R46 撞号顺延)/R48 | Codex 19(tier1-executor) |

### 时代 III · PLAN-2 补充实施期(2026-07-26 ~ 07-28)

| 批次 | 日期 | 代码(末码) | evidence | journal | 评审 |
|---|---|---|---|---|---|
| W1(收尾与 dogfood 起步,九项) | 07-26 | `ce24c14` | `w1-batch.md` | R47(对账) | 批末 review 1A2B |
| W2(提前批四项 + 安全五件 + 场次①修复) | 07-26 | `086001d`(含迟到回收 `fd3918d`) | `pull-forward-batch.md` | R48 | 终审 + 一致性 + 迟到三路 |
| R-A 合同轮(canonical 文件面) | 07-27 | (文件面,无独立代码段) | — | R49 x2/R50/R51 | Codex 21/22 |
| W5a(W5 合同就绪子集 + TTS 拍板) | 07-27 | `eabc5ac` | `w5a-batch.md` | R51 补记 | 批末 review 0A1B |
| W4(S3 卡 + writing 窄版 + 增量) | 07-27 | `b5d45e9`(+readback 回修 `edac8d0`) | `w4-batch.md` | R52/R53 | 批末 review 2A |
| RA-closeout(pending 裁决 + A2 固化 + 六小项) | 07-28 | `c59edd1` | `ra-closeout-batch.md` | R54 | Codex 22 终局追认 |
| A3-armed(就绪门证据绑定全链) | 07-28 | `103e2f6` | `a3-armed-batch.md` | R55 | Codex 23 + 批末 review |
| dogfood 语音修复串(冻结尸检 + 长语音 + 双动作) | 07-28 | `838aeea` | — | R54 补记 x2/R56/R57 | 批末 review |

### 时代 IV · 单仓迁移与发布前(2026-07-29 ~ 07-31)

| 批次 | 日期 | 代码(末码) | evidence | journal | 评审 |
|---|---|---|---|---|---|
| voice-coding 并入 SayDo 单仓迁移 | 07-29 | `f28489d` | `docs/plan/MIGRATION.md`、`history/2026-07-29-migration-and-implementation-status.md` | R58-R61 | Codex 24/25/26 |
| 发布前回修 + 部署(A3 语义拍板) | 07-30 | `b201514` | `e2e/owner-sessions/runtime-deploy.md` | R62 | Codex 27-31(项目状态归档系列) |
| 场次①返工 + voice/runtime 真相复核 | 07-30 ~ 07-31 | `ada7981`(常驻锚)/`f7f9e9c` | `e2e/owner-sessions/session-1.md` | R63 | Codex 32-46(session1 锚定系列,39-44 aborted) |

### 时代 V · Focus Contract 时代(2026-08-04 ~ 08-10;journal 空洞段,2026-08-21 评审 88 补录)

> 本时代记录载体 = 根目录 `HANDOFF-前端组件化施工交接.md` / `HANDOFF-2/3/4-*.md` + `e2e/evidence/focus-contract-batch.md` + docs/09 §15;施工模式 = grok/子代理施工 + 既白(义骁侧评审员)验收,未走 Codex 轮次。journal 无轮次(见 §3 勘误)。

| 批次 | 日期 | 代码(末码) | 记录载体 |
|---|---|---|---|
| Focus Contract M1-M3(库层/服务层/live 接缝) | 08-04 | 代码 `3a0afc0`;evidence 提交 `1074ca2`/`bbfcbb3` | `e2e/evidence/focus-contract-batch.md` |
| E2 dogfood 修复批(12 刀)+ 追修串(F/J/K/L/M/N/W 系列) | 08-04 ~ 08-06 | `c00f09f` | `fe8a85e`(E2 证据)+ 各提交信息 |
| focus 批 0-4(术语人话化/确认环 DB 权威/lanes/看板/实体卡流) | 08-05 | `820218d` | 提交信息(grok 施工/既白验收) |
| console redesign B1(组件库 + 四页拼装 + dev 走查路由) | 08-08 | `4ce320b`(merge `254491d`/`6d3c050`) | `HANDOFF-前端组件化施工交接.md`、`HANDOFF-2`;评审与四轮对抗方案档在 OctoAgent 仓(`4f2d918` 提交注) |
| focus v0.4 批①-④(ledger/saga/控制轮/expectation/screen_text) | 08-09 | `12d3474`(+lint `c432b14`) | 09 §15.1 回写 `9b8c7e9` |
| L1-L5 UI 修正批 | 08-09 | `4d41775` | `HANDOFF-3` |
| first-run onboarding + 部署清单纯用户化 | 08-08 ~ 08-10 | `862d921` | `dfdf1d7`/`14d16ac` |
| 资源画像向导批(L16-L19 并批) | 08-11 | `e0bb23a` | `HANDOFF-4` |

### 时代 VI · 8 月体验工程(2026-08-11 ~ 08-15;评审档在 findings 47-72,journal 覆盖不全,缺口 2026-08-21 评审 88 补录)

| 批次 | 日期 | 代码(末码) | journal | 评审 |
|---|---|---|---|---|
| T17/T17b 全面如实化 + 首跑引导(T16 形状并入,无独立批) | 08-11 | `415df2a` | R64/R65 | findings 47/48 |
| M1 console 移动 Web 纸账本 | 08-11 | `d1bde0d` | R66 | findings 49-52 |
| T18a 三槽 CLI 运行时 | 08-11 | `9a6e767` | R67 | findings 53/54 |
| T18b dialog CLI oneshot 三形态 | 08-12 | `197d4f1` | R68 | findings 55/56 |
| M2 三端壳 spike(iOS/Android/HarmonyOS)+ iOS 原生语音层 | 08-12 | `381798d`/`2f49597` | — | findings 57/58/59 |
| D1 桌面地基(可分发运行时 + saydo CLI supervisor) | 08-12 | `b74a00b`(终审修复自审) | 无编号条目(08-12) | findings 61 x2/62 |
| voice-fix 前端/后端批(义骁真机反馈五件) | 08-12 | `0c4969c`/`de0e667`(merge `6cd362d`/`a7d517c`) | — | findings 63/64 |
| iPad 强制移动壳 + 移动记忆可见性修复 | 08-12 | `60d96ca` | — | — |
| CLI 供给扩容(gemini/qwen/copilot 六件套) | 08-13 | `aa8034e`(merge) | — | findings 65 |
| 向导 UX 重构(T19 供给选择器)+ 启动链 | 08-13 | `1b59da2` 段 | — | findings 66 |
| T19-polish(死因透传/HOME 隔离实测) | 08-13 | `013d84b` 段 | — | findings 67 |
| 融合布局批(向导左右分栏 + 混搭快照) | 08-13 | `af80b26` 段 | — | findings 68 |
| 全端 UI 标准化(token 三层归一 + 写死色值门禁) | 08-13 | `05f714c` 段 | — | `docs/plan/2026-08-13-ui-standardization-audit.md` |
| 品牌朱印全端 + 纸上账本 Light 换芯 + 应用定名「说到」 | 08-13 ~ 08-15 | `ecdd1d2`/`55d61d2`/`b13b744` | — | — |
| 上架与备案材料首批 + release 归并 | 08-13 ~ 08-15 | `6194046`/`aac3d60` | — | — |
| DeepSeek 单家直连 + 默认 Runner 决策 + 两安全修复 | 08-15 | `789b76d`/`03c6d54` | — | findings 72 + `2026-08-15-default-runner-decision.md` |
| 移动外壳战略 + 阶段缺口分析(纯评审轮) | 08-13 ~ 08-14 | (无生产代码;材料入库 `35604be`) | R69 x2/R70 x2(撞号见 §3) | findings 69/70/71 |
| 站点与深链部署源入仓 | 08-15 | `3197fd8` | — | — |

### 时代 VII · 收敛与公开(2026-08-16 ~ 至今)

| 批次 | 日期 | 代码(末码) | evidence | journal | 评审 |
|---|---|---|---|---|---|
| remote-mobile-w0(LAN 进壳第 0 步) | 08-16 | `addfd19` | `remote-mobile-w0.md` | R71/R72/R73 | Codex 73/74 |
| 全量测试验收(live + 夹具对照) | 08-16 | `26d32e8`(evidence 提交) | `2026-08-16-full-acceptance/` | R74 | — |
| cmdeffect-hardening(tier1 词表加固,回哺 dsh) | 08-19 | `1ee5622`(代码 `e79d1d8`+两轮返工+O-1 `adc2b9a`) | `cmdeffect-hardening.md` | R83(2026-08-21 补记;原节曾撤回 `cb2fba8`,补记时与备案线两度撞号顺延) | dsh 两轮零上下文评审 |
| W5.4 方案定稿 + IMPL-PROMPT-10 | 08-19 ~ 08-20 | v2 `29f33cf` → v3 `33c5cf1` → v3.1 `f104563` | `2026-08-19-w54-claude-cli-tier1.fable.md` | — | Codex 77 |
| 官网重建 v1 + 双语 Docs 长文页(部署先行,HTML 随 08-21 `1679078` 入库) | 08-19 ~ 08-20 | (部署 Cloudflare Pages;git 入库见状态对齐行) | — | R75/R76 | findings 75/76(销案,见 §3) |
| Apache-2.0 开源 + 隐私脱敏三连 | 08-20 | `354b028`/`6365513` | — | — | — |
| public-readiness(模板/DEPLOY/launchd 修补) | 08-20 | merge `f7d7492` | `public-readiness.md` | R84(2026-08-21 补记;HANDOFF/PLAN-2 无状态行,缺口已登记) | findings 78/79 |
| s1-demo-wiring(决策包 Demo 小样接线) | 08-20 | merge `1a41b45` | `s1-demo-wiring.md` | R84(同上,无状态行) | findings 80 |
| s2-callback-channels(回叫分级选路) | 08-20 | merge `aa2dffc` | `s2-callback-channels.md` | R84(同上,无状态行) | findings 81/83 |
| w54a-claude-cli(W5.4-a 纯函数层) | 08-20 | merge `7fb3fa1` | `w54a-claude-cli.md` | R84(HANDOFF §1/PLAN-2 有状态行) | findings 82/84/85 |
| 官网 v2 + 三层状态对齐(Grok 实施 + 三路后验 + 迟到回收) | 08-20 ~ 08-21 | `1679078`(evidence `920af91`,merge `11e3653`;owner 授权合并推送,见 evidence §10) | `status-alignment-20260821.md` | R77/R78/R79 + R85(入库补记) | findings 86 x5/87 x5 |
| ICP App 备案通过回写 + 公安单按现网重交 | 08-21 | `479634c`(2026-08-22 入库) | `docs/release/2026-08-13-store-submission-status.md` | R80-R82 | — |
| 版本记录对账与补记批 | 08-21 | `ad8adb1`(2026-08-22 入库) | 本文件 | R85 | findings 88(记录对账;与 Windows 线同号,见 §3) |
| w54b-canonical-preface(W5.4-b 前置 canonical 回写:P-1…P-5) | 08-21 | `5036bee`(2026-08-22 入库;07 五处 supersede / ADR-001 addendum / ADR-002 状态更正 / 09 七处 + Codex 89 五 A 十 B 回修) | `docs/plan/IMPL-PROMPT-15-W54B-WIRING.md`(本批交接) | R86 | findings 89 + 一致性 subagent |
| 说到软著 R11 普通通道填报 + 签章提交 | 08-21 | `479634c`(同上;`scripts/gen-copyright-docs.mjs` + `artifacts/release/copyright/`) | `artifacts/release/copyright/r11-form-prefill.md` | R87/R88 | — |
| W-Win 原生 Windows P0 对齐(公开快照线 `feat/windows-alignment`) | 08-21 ~ 08-22 | 公开线 `be82f98`→`d427716`,merge `721385c`;内部线移植 `1482510`→`3279c0f` | `windows-alignment.md` | R89/R90(原以 R80/R81 写就,撞号顺延,见 §3) | findings 88 x4(Windows 线,与记录对账同号) |
| POSIX 组长锚 + cmd/bat fail-closed 门 + Linux 后代回收去 procps 化 | 08-22 | 公开线 `175dfe0`→`4627107`,merge `7838479`;内部线 `316f031`→`5a73420` | `windows-alignment.md`(同批追加) | R91 | 无独立评审(承 88 triage) |
| w54b-wiring(W5.4-b C1 配置自检 + C2 executor 接线;**C3 未做,本批未收口**) | 08-21 ~ 08-22 | 代码 `4c4bf96`,merge `4d2824e` | `w54b-batch.md` | R92 | 待批末零上下文评审 |
| 三轮评审收口 + 全量部署 + 分支清理 | 08-22 | `6d98a6e`(公开快照 `2bb9101`;常驻同 SHA) | `w54b-batch.md` §7-§9 + `2026-08-22-mobile-shells-device-build.md` | R93 | Codex 90/91/92 三轮(均 No-Go,逐条回修) |
| 一周文档 x 实施双向对账 + 全分支合并 + 评审 90 回修 | 08-22 | `a26d5bf`(对账回修)/ `058090d`(win32 门四路)/ `3bf3d10`(门路径单源)+ 评审 90 回修批 | `docs/review/2026-08-22-week-crosscheck.md` + `w54b-batch.md` §7 | R92 | Codex 90(裁决 No-Go;A 级八条 + B 级代码项已回修) |
| 备份 workspace 身份锚去 st_dev(部署门前置清偿) | 08-22 | `d406387`(+ HANDOFF 回写 `fb16fb8`) | 见 `docs/review/2026-08-22-week-crosscheck.md` F17 | R92 | 随评审 90/91 轮 |
| 三端移动壳真机构建与装机 | 08-22 | `82c77e3` | `2026-08-22-mobile-shells-device-build.md` | R92 | — |
| ios 安装器门禁合并回归修复(main 转绿) | 08-27 | `9a3e180` | `w54b-batch.md` §14.2 | R110 | — |
| w54b-wiring 收口(四轮独立复审 + 三轮返工;自身 A 级 0) | 08-27 | `8941e1c`(证据 `9417b6d`) | `w54b-batch.md` §15–§18 | R110 | Codex 四轮 `gpt-5.6-sol`+max |
| AI 供给专题开具名坐标(PLAN-2 §1 `ai-supply`) | 08-27 | `9417b6d` 为基线锚 | PLAN-2 §1 | R110 | — |

## 3. 编号勘误登记(原始文件不重编号,统一在此收口)

沿 `history/README.md` 的编号政策(2026-08-22 刷新):**正文一律不改**;标题编号按情形分——
**同线历史重复不重编号**(只登记),**并线撞号**由改号成本低的一方顺延标题号(正文不动 + 加编号注 + 在此登记)。
本节为唯一勘误登记处。

### journal 轮次(history/PROCESS-JOURNAL.md)

> 统计口径:按 `##` 级标题计;标题含「补记」的为合法补记条目,不计撞号(R55/R56 的补记为 `##` 级但带「补记」字样,同口径;R34/R41/R43/R47/R51/R54 另有补记)。

| 现象 | 说明 |
|---|---|
| R12/R13 顺序颠倒 | R13 节在 R12 前,内容各自成立 |
| 设计序列缺 R35 | 设计序列 R34 之后直接 R36(07-23),R35 号在该序列未使用;实施序列(07-25 起)存在 R35(首发收口),两序列撞号以日期区分 |
| R33-R37 双序列 | 设计期(v1.x 时代)与实施期(07-25 起)各用一遍,以日期区分 |
| R46 → R47 顺延 | 执行器批原记 R46 撞号,已在原文标注顺延,内容未动 |
| R47/R48/R49/R54 多条同号 | `##` 级各 x2(R47/R48/R49/R54;R49 = A 级回修 / 对抗性评审两条;R54 另有 `###` 级补记两条),以日期与主题区分 |
| R69/R70 各两条 | R69 + R69 补记(合法);R70 两条为不同主题(第 0 步同批范围 / 阶段缺口分析)撞号,均为 2026-08-13 |
| 「2026-08-12 — D1 终审 findings 修复」 | 无 R 编号条目,居 R68 与 R69 之间 |
| R75 撤回重用 | cmdeffect 批曾写 R75 节,因官网会话占号撤回(`cb2fba8`);R75/R76 终由官网两轮使用;cmdeffect 节于 2026-08-21 补记恢复时再与并行备案会话连续撞号(其 R81 腾讯云对账、R82 公安重交),按当时表述的「先落盘者为准、后者顺延」定格为 R83(附 provenance 注)。**注(评审 91 B-13)**:该表述已于 2026-08-22 校正为「改号成本低的一方顺延」——R83 当时两个判据同时成立故未暴露差异,原文不改 |
| R80/R81 双占(2026-08-22) | Windows 线在公开快照 clone `feat/windows-alignment` 独立写作,各以 R80/R81 落盘;并入内部主线时与备案/记录链 R80-R88 撞号。备案/记录链被本台账 §2 与 HANDOFF §1 多处引用,保号;Windows 两节的**标题编号**顺延为 **R89/R90**、正文逐字未改并附编号注(沿 R83 已开的「先落盘者为准、后者顺延」先例)。**处置依据 = 2026-08-22 owner 裁决的并线撞号政策**(`history/README.md`:正文不改、由**改号成本低的一方**顺延标题号、台账登记)。判据是改号成本不是落盘先后——Windows 侧 `05bc91d`(10:15)其实早于记录链 `ad8adb1`(12:48),仍由 Windows 侧顺延(评审 91 B-13 校正) |
| 头部元信息定格 | 文件头「覆盖范围 ~07-22 共 16 轮」与「版本时间线(速览)」表定格于设计期 R25,已于 2026-08-21 修正说明;批次级索引以本台账为准 |

### 评审编号(research/codex-findings/ 与 prompts/)

| 现象 | 说明 |
|---|---|
| findings 11/19/61/71 各两份 | 11(implementation-plan-v25 / post-review-reassessment)、19(plan2 / tier1-executor)、61(d1-desktop-foundation / d1-distributable-runtime)、71(正式报告 / attempt1,后者为 Codex 沙箱受阻首跑,journal R70 有说明)各为两份文件共用编号 |
| findings 60 缺失 | 59 之后直接 61;60 号未分配。两份 61 均保留,无证据判定其一本应为 60,不作推断 |
| findings 39-44 合并 | session1 锚定系列 aborted,六号合并为一个文件(文内有说明) |
| findings 75/76 销案 | 官网 v1/Docs 评审因 Codex 额度/容量未产出(journal R75/R76 登记);2026-08-21 评审 88 轮裁决销案不补跑(owner 验收本轮即追认)。理由与覆盖差异:75/76 原范围含视觉/可访问性/SEO/性能/链接/移动端与双语内容逐项;86/87 系列覆盖其中状态承诺、数据路径与档案一致性维度,视觉/性能维度未逐项复评——差异如实登记于销案文件,不写「全链 supersede」 |
| findings 88 两主题五文件(2026-08-22) | `88-version-records-audit-review.md`(版本记录对账,内部线)与 `88-windows-alignment-{codex,consistency,implementation,triage}.md`(Windows 线,四份)共用 88 号;两线并行、互不可见所致。沿「原始证据不重编号」只登记不改名,引用时必须带完整文件名 |
| prompts 88 双主题(2026-08-22) | `prompts/88-version-records-audit-review.md` 与 `prompts/88-windows-alignment-{codex,consistency,implementation}-review.md` 同号,同上处置 |
| findings 86/87 各五份 | 多路交叉评审(有意),同号多文件 |
| prompt 双体系 | 早期 prompt 存 `research/codex-findings/prompts/`(01-23,其中 15 号也有两份:owner-decisions-panel / phone-call-design),后期制度改为顶层 `prompts/`(12 起);编号 12/15/16 两套不同义(子目录 12=atelier-demo、16=phone-call-plan;顶层 12=canonical-writeback-batch1、16=wiring-batch-writeback)。引用时必须带路径 |
| 顶层 prompts 缺号与双份 | 缺 01-11(早期无顶层制度)、13-15、20、56-60、62-64(多为 fix-review/自审轮,当时未存 prompt);18/19 各两份(writing-flow 两路 / plan2 与 tier1-executor)。仅登记,不补造 |

### canonical 条款锚点(2026-08-21 评审 89/一致性轮登记)

| 现象 | 说明 |
|---|---|
| 09 §11「规则 2」锚点漂移 | observedModel 豁免/四字段条款的历史锚为「§11 规则 2」(ADR-002 全文、HANDOFF §2-4、09 §12 多处沿用);T18b 规则列表演进后该条款现序为**规则 3**(规则 2 现为 runtime 登记条款)。历史引用不改,2026-08-21 起新增引用带双锚注 |
| project.toml 白名单 vs dev 域 | 白名单枚举(09 §11)不含 dev 域,而 dev.agent 项目级 override 走 `project_settings` 受控表(console 写口)——两承载条款并行不矛盾;规则 4「dev-only 覆盖」的历史表述未区分承载,09 §11 claude_code 承载段已加区分注(2026-08-21) |

### 交接 prompt(docs/plan/IMPL-PROMPT-*)

| 现象 | 说明 |
|---|---|
| IMPL-PROMPT-11 撞号 | `IMPL-PROMPT-11-PUBLIC-READINESS.md` 与 `IMPL-PROMPT-11-STATUS-ALIGNMENT.md` 都自称「第十一轮交接」;12/13 已被 S1/S2 占用,状态对齐批按时间序实为第 14 轮。处置(2026-08-21 评审 88):两份文件顶部各加事后勘误注(原始派发正文与自称不改,post-run ordinal erratum),文件名不改保引用稳定 |

## 4. 对外版本对照(一句话索引)

- git tag:`v0.1.0-rc.1` @ `628f7e4`(2026-07-25;annotated,已推远端);`v0.1.0` 待场次④通过后 owner 授权。
- 商店/备案线:App 备案 2026-08-21 通过(京ICP备2025153079号-4A);商店提审关键路径 = 软著 + 生产壳;全部状态以 `docs/release/2026-08-13-store-submission-status.md` 为 SoT。
- 官网:saydo.octoooo.com(Cloudflare Pages,部署与 git 入库时点见 §2 时代 VII)。
- 仓库:origin = 私有归档 `SayDo-archive`(全史);public = 公开快照仓 `SayDo`(树快照,经 `scripts/publish-public-snapshot.sh`)。
