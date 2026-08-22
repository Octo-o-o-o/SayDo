# 88 · 版本记录对账评审(version-records-audit)· Codex 对抗评审 prompt

## 角色与任务

你是零上下文对抗评审员。评审对象 = 一份「全仓版本记录对账报告」的发现清单(F1-F9)与修复方案(P1-P8)。owner 已授权按该方案实施记录层修复;实施前须经你证伪。你的职责:逐条核实发现是否成立、方案是否恰当、有无遗漏的更重要问题。只读评审,不改任何文件。

## 评审纪律

1. 每条结论必须给出你自己取证的依据(文件路径 + 行号/内容摘录,或命令 + 输出摘录),不得采信本 prompt 的陈述本身。
2. 输出分级:A = 发现不成立/方案会造成错误记录或数据丢失,必须修;B = 方案次优或有遗漏,建议改;C = 可忽略。
3. 全文零 emoji(勾/叉/警告符同禁),状态词遵守仓库纪律(见 AGENTS.md)。
4. 背景警示:本仓当前有并行会话在工作(deploy/ 与 docs/release/ 有未提交改动,journal 已被并行会话追加 R80 ICP 备案节)。你取证时以文件现状为准,注意区分「已提交」与「工作区未提交」。

## 仓库坐标

- 过程档案:`history/PROCESS-JOURNAL.md`(轮次 R1-R80;头部有「版本时间线(速览)」表)
- 实施状态:`HANDOFF.md`;排产源:`docs/plan/IMPLEMENTATION-PLAN-2.md`(§7-9 = journal 纪律:实施批收口后补一行索引)
- 证据:`e2e/evidence/*.md`;评审报告:`research/codex-findings/`(01-87);评审输入:`prompts/`(顶层)与 `research/codex-findings/prompts/`(早期体系)
- 交接 prompt:`docs/plan/IMPL-PROMPT-*.md`

## 发现清单(请逐条证伪)

- F1 status-alignment 批入库动作未记录:journal R78/R79 与 `e2e/evidence/status-alignment-20260821.md` 结论均写「未 commit、未 push」;但 git 实况 = 代码 `1679078` + 证据 `920af91` + merge `11e3653` 已落 main 且与 origin(SayDo-archive)同步。`HANDOFF.md` §1「当前快照」行仍写活动树 HEAD `088b8f0`(落后 3 个提交)并写「本批不以提交收口」。
- F2 cmdeffect-hardening 批 journal 轮次欠账:提交 `cb2fba8`(2026-08-19)撤回了已写好的 R75 节,提交信息与 `e2e/evidence/cmdeffect-hardening.md` §8 登记「待官网会话入库后补记」;至今未补。原节全文可从 `cb2fba8^:history/PROCESS-JOURNAL.md` 行 1594-1622 恢复。
- F3 2026-08-20 收口的四批(public-readiness / s1-demo-wiring / s2-callback-channels / w54a-claude-cli)均无 journal 轮次,违反 PLAN-2 §7-9;四批的 evidence、HANDOFF/PLAN-2 状态行、评审报告(78/79、80、81/83、82/84/85)齐全。
- F4 journal 两段空洞:(a) R63(07-31)至 R64(08-11)之间的 Focus Contract 时代(focus M1-M3、批 0-4、v0.4 批、E2 修复、console redesign、HANDOFF-2/3/4 批、onboarding 向导,约百余提交)无任何轮次,记录散在根目录 `HANDOFF-2/3/4-*.md` 与 `e2e/evidence/focus-contract-batch.md`;(b) 08-12 至 08-15 的多批(M2 三端壳 57/58/59、voice-fix 63/64、CLI 扩容 65、向导 UX 66、T19-polish 67、融合布局 68、全端 UI 标准化、品牌朱印、上架备案材料首批、应用定名、DeepSeek 默认 runner 72)只有 D1 修复一条无编号条目与 R69-R71,其余无轮次。
- F5 IMPL-PROMPT-11 撞号:`IMPL-PROMPT-11-PUBLIC-READINESS.md` 与 `IMPL-PROMPT-11-STATUS-ALIGNMENT.md` 都自称「第十一轮交接」,而 12/13 已被 S1/S2 占用;状态对齐批按序应为第 14 轮。无撞号补记。
- F6 journal 编号与元信息:R70 撞号(两条不同主题同编 R70,无顺延说明);设计序列缺 R35(R34 后直接 R36);文件头「覆盖范围 2026-07-18 ~ 2026-07-22 共 16 轮」过时;「版本时间线(速览)」表止于 R25。
- F7 评审 75/76 报告欠账:journal R75/R76 登记 Codex 因「额度尽 / model at capacity」未产出,报告位 `research/codex-findings/75-*.md`、`76-*.md` 预留待补跑;至今未补,也未销案。
- F8 评审编号杂项:findings 60 号缺失(59 后直接 61,且 61 有两份 d1 文件);顶层 `prompts/` 缺 01-11、13-15、20、56-60、62-64;早期 prompt 存在 `research/codex-findings/prompts/`(01-23),其中 12/15/16 与顶层 prompts/ 同号不同义(12=atelier-demo vs canonical-writeback-batch1;15=phone-call-design vs 无;16=phone-call-plan vs wiring-batch-writeback)。
- F9 stash 残留(已销项):`safety/pre-grok-status-alignment-20260821` stash 在 2026-08-21 09:34 存在、09:48 已消失(被 owner 或并行会话清理,stash reflog 为空)。仅需在补记中留一句痕迹。

## 修复方案(请评估恰当性,尤其带「裁决点」的条目)

- P1 journal 补记三轮(编号在落盘时取当时下一可用号,当前预计 R81 起;并行会话已占 R80):
  - 补记轮甲:cmdeffect-hardening 批——恢复 `cb2fba8^` 的原 R75 节全文,标题改用新号并注明「2026-08-19 事件,2026-08-21 补记;原拟 R75/R76 因官网会话占号顺延」。
  - 补记轮乙:8 月批次时代索引——一轮覆盖 F4(a)(b) 与 F3 四批,每批一行索引(日期/末码/evidence/评审编号),不重写叙事;正文声明「详情以 evidence 与 git log 为真相源」。
  - 补记轮丙:status-alignment 入库动作(三提交 SHA、merge、push origin、stash 清理)+ 本次对账与修复(评审 88)。
- P2 HANDOFF §1 刷新:「当前快照」行 HEAD 更新为 `11e3653`,「本批不以提交收口」句改为如实描述(已于 08-21 三提交收口合并入库);不动批次指针(保持为空)。裁决点:HANDOFF 是否还有其他行需要同步(请检查 §1 全节)。
- P3 新文档 `history/DEV-VERSION-LEDGER.md`(开发版本台账,本次核心交付):
  - 定位 = 内部开发版本记录(非对外 release notes),批次级结构化索引;与 journal(叙事)/HANDOFF(现状)/PLAN-2(排产)分工互补。
  - 结构:§1 版本线速览(方案 v1.0-v1.14 / docs v2.0 / tag v0.1.0-rc.1 / DDL schema 版本线 / 知识底座 generation 多线说明);§2 批次台账主表(每批一行:批次名、日期、代码末码、evidence、journal 轮次、评审编号、备注),覆盖设计期至今全部批次含 8 月空洞期;§3 编号勘误登记(把 F5/F6/F8 全部历史撞号/缺号一处收口,journal 原文不重编号——沿 history/README.md 既有裁决「为保持原始证据不重编号」);§4 对外版本对照(tag/商店/备案一句话指向 docs/release/)。
  - 维护纪律:每批收口时与 PLAN-2 §7-9 的 journal 一行索引同时各追加一行。
  - 同步动作:`history/README.md` 索引表登记新文件;journal「版本时间线(速览)」表尾加一行指针指向台账,注明「速览表定格于设计期 R25,后续批次级索引见台账」。
  - 裁决点 1:归档判断 = 不归档任何现有文档(journal 继续作叙事真相源)。是否同意。
  - 裁决点 2:「私有化保存」解读 = 内容层面(内部档案,与 journal 同待遇,随公开快照发布);不改 `scripts/publish-public-snapshot.sh` 加发布排除。若你认为应做快照层隔离,给出理由与最小方案。
- P4 IMPL-PROMPT-11-STATUS-ALIGNMENT 顶部加撞号补记(与 public-readiness 撞 11 号,按序实为第 14 轮交接;文件名不改保引用稳定),public-readiness 文件不动。
- P5 评审 75/76 销案(不补跑):理由 = 其评审对象(官网 v1/v2 当时版本)已被 86 四路 + 87 三路 + 迟到回收全链评审 supersede,补跑无增量价值。落地 = 在 `research/codex-findings/` 建 75/76 两个销案占位文件(内容 = 销案裁决 + 指向 86/87 系列),journal 补记轮丙记录裁决。裁决点:销案 vs 补跑,你的独立判断。
- P6 journal 头部刷新:覆盖范围句改为「2026-07-18 起持续追加(当前至 R8x)」;速览表处理见 P3。不重建全量速览表。
- P7 findings 60/61 与 prompts 双体系:只在台账 §3 登记勘误,不改名不移动任何既有文件。裁决点:61 号两份是否应认定其一为 60(仅登记推断,不改文件名)。
- P8 全部落盘后跑 `scripts/check-emoji.sh` 覆盖本次新增/修改文件;本次不 commit、不 push、不部署(owner 未授权提交)。

## 你要输出的内容

1. F1-F9 逐条:成立 / 不成立 / 部分成立,附你的取证依据。
2. P1-P8 逐条:同意 / 建议修改(给出具体修改)/ 反对(给出理由),裁决点必须表态。
3. 对账遗漏补查:你自己抽查 git log、evidence、journal、findings 至少各 3 处,报告本 prompt 未覆盖的记录缺口(若有)。
4. 总评:Go / 修改后 Go / No-Go。
