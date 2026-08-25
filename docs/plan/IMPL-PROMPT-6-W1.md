# SayDo W1 收尾与 dogfood 起步批 · 实施 Prompt(第六轮交接,复制分隔线以下到新会话)

> 背景:排产源已切换到 [IMPLEMENTATION-PLAN-2.md](IMPLEMENTATION-PLAN-2.md)(v1.2,经 4 subagent + Codex 19 评审回修)。本批 = 其 W1(九项,2–3 天):执行器批小尾巴清偿 + dogfood 起步件 + 排产源移交落账。W2(提前批)在本批后按 IMPL-PROMPT-5 执行;R-A 合同轮由设计库并行推进,与本批无文件面冲突。

---

你接手 **SayDo W1 批**。代码仓 `~/WorkSpace/SayDo`(main 直推);设计库 `~/WorkSpace/voice-coding`(只读;canonical 回写按批攒、走轻量评审)。完成判定 = W1 九项验收锚全绿 + evidence `e2e/evidence/w1-batch.md` 落盘 + HANDOFF 回填。

## 0. 坐标核验(先做,漂移即停)

| 命令 | 期望(2026-07-26 04:00 实测) |
|---|---|
| `git -C ~/WorkSpace/SayDo log --oneline -1` | `602aa09`(执行器批收口)或其后 evidence 提交;工作区干净 |
| `ls ~/WorkSpace/SayDo/e2e/evidence/executor-batch.md` | 存在(前批 evidence 在案) |
| `cd ~/WorkSpace/SayDo && just ci` | 双矩阵绿(contracts 66 + daemon 451± + pytest;以 executor-batch.md 声明为基数) |
| `ls ~/.saydo/owner-audio/` | a01/a02/a04/a13/a20.m4a + rerun-smoke.py(R45 真人底板) |
| `rg -n "W1" ~/WorkSpace/voice-coding/IMPLEMENTATION-PLAN-2.md \| head -3` | §1 W1 表存在 |
| `rg -n "当前批次指针" ~/WorkSpace/SayDo/HANDOFF.md` | **空**(指针机制由本批 1.9 建立;若已有指针且非本批 ⇒ 停) |

## 1. 必读(按序)

1. `SayDo/HANDOFF.md`(§0 硬教训/§4 铁律)+ `SayDo/AGENTS.md`
2. `voice-coding/IMPLEMENTATION-PLAN-2.md` §1-W1(九项与验收锚,唯一任务源)+ §4 通则 + §7 规程
3. `voice-coding/IMPL-PROMPT-5-PULLFORWARD.md` §3.5(owner 决策附注——1.7 的回填输入)
4. `voice-coding/history/PROCESS-JOURNAL.md` R45(音频排查链与 3/5 结果——1.1/1.7 的输入)
5. 分项合同:1.3=`SayDo/HANDOFF.md` #8-② + 09 §11 白名单;1.4=`e2e/evidence/executor-batch.md` 诚实清单 + `wiring-batch.md` §5/§7;1.5=`docs/05` §4 价值证据轨 + `SayDo/packages/daemon/src/obs/valueReport.ts` 现状;1.8=`research/codex-findings/18-writing-flow-review.md` A-2(实施仓证据段)

## 2. 红线(违反即停)

HANDOFF §4 全套(零 emoji/状态词纪律/Gate 0 无 bypass/S3 语音不放行/TTS redactor/契约只 import `@saydo/contracts`/两提交法/每步独立核实 SHA)· **canonical 语义级变更一律回设计库**(本批预期零 canonical 变更;1.8 是实施仓内 bug 修复,ref 形状以 09 §4/§4.1 现文为准,不改 09)· 周报**建议性、不作 stop/go 门**(1.5)· 敏感样本运行时拼接。

## 3. 任务清单(按 PLAN-2 §1-W1;每项验收锚见该表,此处补执行要点)

1. **1.1 audio-smoke 收编**:把 `~/.saydo/owner-audio/rerun-smoke.py` 的 classic-header 重打包 + 多格式支持并入 `e2e/smoke/audio-smoke-5.py`(AUDIO_DIR 可参数化:合成/真人两底板);WAVEFORMATEXTENSIBLE 实测知识写入 HANDOFF §5。
2. **1.2 误听种子**:两条稳定误听入 golden 回归集(登记形式照 07 D4 golden 机制);热词调优实验(`settle barrier` 拆词/`Gate 0` 变体权重)——ASR 分钟花费极小(≈分钟级),在既定预算内,无需新授权。
3. **1.3 项目层配置生产加载**:独立 project schema(禁复用全局 schema,`config/types.ts` 防踩注记);§12-9 项目层白名单反例复跑绿。
4. **1.4 挂账核实与清偿**:对照 `executor-batch.md` 诚实清单逐条——深评 live 触发装配、seedTerms 偏置、0.0(a)(setup/push 钩子覆盖/`--resume` 精确恢复);已做的引证据免做,缺的补齐。
5. **1.5 周报增量**:北极星②代理 + 两手工字段 + 05 §4 全指标矩阵 + **触发线读数栏**(shadow 样本/golden 语料计数/回叫撞车/检索 miss/离机时段占比——后两者无数据源就先落 0 值列位,不编数)。
6. **1.6 TTS 尾项**:核对 `phase-1.md` 是否覆盖分句策略首包,缺则补测;音色候选列 3 个给 owner(听感拍板可挂在 owner 下次场次顺做,不阻塞收口——登记待办即可)。
7. **1.7 HANDOFF §2 回填**:IMPL-5 §3.5 五项决策 + 音频 3/5 结果(真实命令输出 + 文件 digest 入 evidence)。
8. **1.8 转写 ref 口径统一**:`liveTools.ts` 的 `transcript:<sessionId>#<turnId>` 与 `snapshotter.ts` 裸 turnId 断裂——统一为 09 §4.1 的 `snapshotLocator` 口径(读 09 现文定形状,三处 liveTools/snapshotter/verify 一致)+ §12 反例 + user_utterance claim 回读 e2e。
9. **1.9 排产源移交**:HANDOFF"开工先读"链插入 PLAN-2(位于 IMPLEMENTATION-PLAN.md 之前,注"首发已收口,排产看 PLAN-2");HANDOFF §1 加"当前批次指针"行并写入 `W1`(收口时清除并留机制说明)。

## 4. 检查点(必须停等 owner)

① 任何新花费/外部副作用(本批预期无——ASR 分钟级调用除外,已在 §3-2 声明);② canonical 语义级变更(预期零;撞到即停回设计库);③ 音色拍板与 TTS 听感 = owner 参与项,登记待办不阻塞;④ 若 1.4 核实发现执行器批声明与实况不符 ⇒ 停,报告差异。缺省动作:无回复 = 暂停该分支继续其他。

## 5. 诚实汇报 + 工作方式

三级词表([ok] 可复跑证据/[warn] 差距/[fail] 原因);SHA 与测试输出来自本会话真实命令;`just ci` 每提交前必绿;两提交法(feat/fix → chore(evidence),evidence = `e2e/evidence/w1-batch.md` 九项各一段);批末 1 个 code-review subagent(A 级必修);收口后 owner 用 /impl-review 对账;下一批(W2)按 IMPL-PROMPT-5 开工前先跑其 §0 并确认本批指针已清。

开始吧:先跑 §0,读 §1,按 §3 顺序实施(1.8/1.9 可穿插提前,1.1–1.5 竖切逐项收)。
