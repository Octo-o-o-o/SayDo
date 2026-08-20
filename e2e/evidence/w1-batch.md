# W1 批(收尾与 dogfood 起步)—— 验收证据(2026-07-26)

> 排产源 = voice-coding `IMPLEMENTATION-PLAN-2.md` §1-W1(九项);交接 prompt = IMPL-PROMPT-6。
> 三级词表:[ok] 可复跑证据 / [warn] 差距 / [fail] 原因。边做边落盘,SHA 均为本会话 git log 真实输出。
> 开批坐标:HEAD `65559c2`,`just ci` 双矩阵绿(contracts 66 + daemon 452 passed | 2 skipped + python 11)。

## 0. 开批环境事件登记(如实)

- 开批时工作区有 14 个 e2e 截图 png 字节级微差(上次 e2e 渲染副产品),`git checkout -- e2e/screenshots/` 恢复。
- **并发写者事件**:执行器批 /impl-review 对账会话(owner 侧,报告
  `research/2026-07-26-saydo-executor-impl-readback.fable.md`)与本批开批时间重叠,
  其对 HANDOFF(451→452 勘误)与 executor-batch.md(Codex 攒批编号 19 撞号改 20)的未提交修改
  覆盖了本批对 HANDOFF 开工先读链的首次编辑(已重放)。两处勘误内容经本会话独立核实
  (CI 亲测 452;撞号对照 codex-findings/19-plan2-review.md 在案)后随 1.9 落账。
  该对账会话另有 Codex 20(只读)与质量复审 subagent 在途,收口前需再对表其潜在回修。
  **此事件正是 1.9 批次指针机制要防的裸窗口并发——指针建立后不再有此窗口。**
- 收口前对表(第二轮):Codex 20 报告 11:02 落盘(`codex-findings/20-executor-writeback.md`,
  总判 A 必修经 triage 修正为"canonical 已修 + 代码 5 项移交 W 批场次②前落");对账会话顺手修的
  `tier1-conformance.md` 两处(A1 改口 + B7 补全)按其 triage 表指定由本批收编(见 §4)。
- 对账报告结论(对 1.4 的输入):执行器批六项任务全部证实,门禁亲测绿——诚实清单声明与实况一致成立。

## 1. 任务九项 ↔ 证据

### 1.9 排产源移交落账 [ok](先做:开批仪式)

- HANDOFF 开工先读链切 `IMPLEMENTATION-PLAN-2.md`(唯一排产源,首发计划降为出处索引):HANDOFF:7。
- HANDOFF §1 建"当前批次指针"行并写入 W1(开批写入/收口清除,PLAN-2 §2 互斥协议):HANDOFF:21。
- 验收锚"HANDOFF 两处在案":`rg -n "IMPLEMENTATION-PLAN-2|当前批次指针" HANDOFF.md` → 7/21 两行命中。
- 代码提交 `8f77e0b`(含执行器批 readback 两处勘误落账,归属注明)。

### 1.1 audio-smoke 收编 [ok]

- `e2e/smoke/audio-smoke-5.py` 收编 `~/.saydo/owner-audio/rerun-smoke.py` 逻辑:
  `to_classic_wav()` 经典 44 字节 PCM 头重打包(fmt=16, tag=1;防 WAVEFORMATEXTENSIBLE fmt=40 陷阱)+
  多格式源查找(.m4a/.wav/.mp3)+ `--profile owner|synthetic` 与 `--audio-dir` 参数化 +
  OWNER_KNOWN_MISSES(R45 两条稳定误听;miss 如实标 [known-miss],命中标 [recovered])。
- 验收锚"真人底板直跑 3/5 一致"(本会话真实输出):

```
$ pipeline/.venv/bin/python e2e/smoke/audio-smoke-5.py --profile owner
[ok] a01: "帮我把 package 底下 contracts 包的 digest 测试跑一遍。" 术语命中 2/2
[ok] a02: "嗯,这个任务卡的 ready for review 的状态还没到,先别叫我。" 术语命中 1/1
[ok] a04: "嗯,用 PNPM install 装一下依赖。嗯,别用 NPM。" 术语命中 1/1
[known-miss] a13: "uh strawberry 没过就不许回,叫 proof 缺一不叫。" 术语命中 1/2
[known-miss] a20: "嗯,get 0没关的话 dispatch 一律拒绝,没有 by pass。" 术语命中 1/2
[ok] 音频烟测 3/5(真人底板;known-miss 2 条,基线 = 非 known-miss 全过)  exit=0
```

- 合成底板回归(缺省 profile):5/5,exit=0(a13 "settle barrier 没过就不许回家。proof 缺一补交。" 2/2)。
- WAVEFORMATEXTENSIBLE 实测知识写入 HANDOFF §5(HANDOFF:62)。
- 代码提交 `2e9833a`。

### 1.2 误听种子入 golden 回归集 + 热词调优 [ok](调优实验如实:无变体拉回)

- `e2e/golden/asr-regression.mjs`:ASR 误听回归集(07 D4 换 provider 门禁资产起点;与 readiness corpus
  两套独立资产,Codex 19 A-8),登记形式照 corpus.mjs + 误听字段(misheard/missedTerm/source/audio/status);
  种子两条 r001(settle barrier→strawberry)/ r002(Gate 0→get 0),status=open。
- 热词调优实验(/tmp 脚本,ASR 分钟级花费,批内已声明;本会话真实输出):

```
[baseline]      a13 命中 1/2("uh strawberry…")   a20 命中 1/2("get 0…")
[split]         a13 1/2  a20 1/2   (+ "settle","barrier" 拆词)
[variant]       a13 1/2  a20 1/2   (+ "Gate zero","gate 零" 变体)
[scale2]        a13 1/2  a20 1/2   (settle barrier/Gate 0 scale=2 加权;config 未被拒但无效果)
[split+variant] a13 1/2  a20 1/2
```

- 结论:五组变体转写逐字不变——两条误听对热词偏置不敏感(声学置信压过偏置),与 R45"热词在表未拉回"一致。
  处置:known-miss 维持;拉回路径 = 用户纠错链(10 #8/#9)入 M0 热词后复验,场次①步骤 5 现场验证;
  scale 字段 sauc 静默收下但无实测效果,不采信为可用机制(不写入生产)。
- 代码提交 `2e9833a`。

### 1.3 项目层配置生产加载 [ok](HANDOFF §2-8-② 清账)

- `config/project.ts`:独立 project schema(禁复用全局 configSchema——types.ts C3 注记病灶 =
  privacy.prefault 注入键致白名单恒误报);顶层白名单 `[project]/[git]/[verify]/[setup]` 自有域 +
  budget/dnd/params 覆盖域,白名单外键(models/providers/gate0/hopper/privacy/voice/pricing/tier1)
  出现即拒收(拒键不拒文件);`applyProjectOverrides` 复用 mergeConfig(params 全局专属键剥除)。
- 执行器接线 `applyProjectFullConfig`(认领 runAttempt + 恢复 recoverAttempt 双链,恢复不消费 =
  恢复 run 丢项目保护面):拒收留痕 audit `project_config.rejected_keys` + `[git].protected` 并集进
  `run.protectedBranches`,gate 决策消费 run 级保护面(engine 内再并 main/master 缺省,只增不减)。
- 验收锚"§12-9 项目层反例绿"(本会话真实输出):`config-project.test.ts` **6 passed**(全域正例/
  八禁键拒收/backup_retention_days 剥除/坏 TOML 抛/缺失合法/并集公式清不掉 main+master)+
  `config.test.ts` **26 passed** 复跑 + `tier1-executor.test.ts` 集成锚(项目追加保护分支 push 判
  S3 deny + main 恒 S3 + 拒收 audit meta 含 models)。
- 代码提交 `6bc48dc`。

### 1.4 挂账核实与清偿 [ok](对照 executor-batch.md §5 诚实清单逐条)

前置:执行器批 /impl-review 对账报告(2026-07-26)已独立证实六项任务与实况一致——
诚实清单声明可信,不触发检查点④。逐条处置:

- **verify config 文件面 / verify env HOME**(两条 P1):引证据免做——已登记 W5.10(PLAN-2),
  conformance §3/§4 [warn] 在案,本批不动。
- **深评 live 触发装配**(接线批/执行器批两度登记"随 dogfood 期"):本批装配触发管道——
  liveTools `readiness` deps(evaluator 异族档 + DeepReviewGovernor(09 §11 规则 6 调用律)+
  `maybeDeepAssess`)+ assessReadiness 工具深评分支 + **proposeStart 前深评门**(verdict 非 ready
  fail-closed 拒组包,09 §13"评估未通过不得提议开始"的机械强制)。**诚实边界**:dims 生产语义
  (对话/记忆 → Claim[] 构造规则)canonical 留白 ⇒ 生产装配恒空 dims(零触发零成本),语义随
  dogfood/R 轮定,落定后只需替换 index.ts 的 dims 回调。
  验收锚"深评触发 e2e":`live-wiring.e2e.test.ts` +2——注入 critical 无证据 dims ⇒ evaluator
  真被调 1 次 ⇒ gap_critical ⇒ proposeStart 拒(零决策包)+ readiness_assessments 落 deep 行
  (layer/verdict/evaluator_model 全断言);governor 同 digest 去重不重复花钱。
  发现的既有行为顺带证实:错误码 "readiness_gap_critical"(长 snake_case)被 TTS redactor 按
  疑似凭据脱敏——红线"TTS 必经 redactor"在真实链上生效。
- **seedTerms 偏置**:index.ts `pushHotwords` 接 `FoundationBuilder.warmup().seedTerms`(active
  项目 git diff 词元;M0 纠错热词全保,种子限量 50 补位防稀释;biasTerms extraSeeds 预留位清账)。
- **0.0(a) setup/push 钩子覆盖**(计划 0.0(a) 验收句①):门控 live e2e 新用例——真 cursor-agent
  多步任务实测:`pnpm install --prefer-offline` 经门 S2 上浮 → 屏幕批准 → **allow**;
  `git push origin main` 经门 **S3 deny**(agent 如实报被拒不绕)。audit gate_decision:
  `install_dependency/S2/allow` + `push_branch/S3/deny` 双在案(52.4s,1 passed)。
  首跑被 `no dispatch turn_ref (fail-closed deny)` 拦下——顺带证实"无拍板轮任务签不出 S2 收据"
  纪律真实生效(修 fixture 种 dispatch 收据后过)。
- **0.0(a) --resume 精确恢复**(验收句②):实现 = `system.init.session_id` 采集落
  `tier1_runs.native_session_id` 列(§12-7 恢复钥匙 canonical 落位,recovery/reconciler 按列判
  resumable;IS NULL 守卫只写首采)+ recover 链 spawn 带 `resumeChatId`(spawner `--resume` 口
  执行器批已预埋)+ audit `tier1.recover_resume_native`。
  证据两层:确定性单元锚(采集→崩溃→恢复带 resumeChatId 全链,fake spawner)+ 门控 live 外部
  事实(cursor-agent `--resume <chatId>` 双跑 **session_id 同一** + 续会话取回上文暗号)。
  诚实边界:未伪造"daemon 崩溃 + 全链 recover"的 live 复合场景(进程内做不干净,executor 会
  自行结算)——单元锚 + 外部事实合起来闭合验收句,不假装跑了全链崩溃恢复。
- 门控 live e2e 总计:**3 passed**(全闭环回归 + hooks + resume;
  `SAYDO_LIVE_E2E=1 pnpm --filter @saydo/daemon exec vitest run test/tier1-live.e2e.test.ts`)。
- 代码提交 `e5274b1` + `6d1c99e`(钥匙落位对齐:runDir 文件改 canonical 列)。

### 1.5 周报增量 [ok](声明恒持:建议性、只观察,不作 stop/go 门,不改 canonical 北极星)

- 北极星② proxy(主动人类分钟/outcome):机器组分(会话时长 + 审批等待,SQL 直出)+ 手工自报
  分钟;review 跨度组分无独立时刻源,如实入 gap(不编数)。
- 两手工字段(05 §4):自报分钟 + 自发选择率(opportunitiesSeen/Used),承载 =
  `~/.saydo/value-manual.jsonl`(运行时观测文件,**不入 09 DDL 契约面,零 canonical 触碰**)+
  `POST /api/value-report/manual` 写口(G1 token 门内;day 格式校验,坏行读取宽容跳过)。
- 矩阵补全(05 §4 全列):first-pass acceptance 正向行 / time-to-dispatch(包创建→任务入队均值)/
  S2 每任务比率 / trusted 记忆 vs 任务创建并列计数(沉淀占比待会话关联,不编分母)。
- **W9 触发线读数固定栏**(只报数不裁决):shadow 样本累计(≥200 线)/ golden 语料纠错事件累计
  (300–500 线,人工标注条目在 e2e/golden 仓内资产另计)/ 回叫接通率累计(电话解锁数据成分)+
  回叫撞车/检索 miss/离机时段三项**无数据源 0 值列位并注明**(不编数)。
- 验收锚"周报含新栏,SQL 直出":`value-report.test.ts` **5 passed**(手工字段写读闭环 + 自报分钟
  进北极星② + 触发线栏 0 值列位断言 + md 渲染含固定栏)。
- 代码提交 `6d22cf8`。

### 1.6 TTS 尾项 [ok](听感拍板 = owner 待办登记,不阻塞)

- **分句策略首包核对**:phase-1.md 的 p50=202ms/p90=382ms 出处 = `e2e/spikes/asr-1.0/synth.mjs`
  (60 句逐句合成,`doubao-tts.mjs` 每句独立连接)——与生产管线分句形态(daemon sendTtsSay 按句
  → pipeline 每句一连接)同型,**分句策略首包已覆盖,07 D5 500ms SLO 达标,引证据免补测**。
- **音色候选**:实测验证(每 ID 合成同一句话术,/tmp 脚本):现用 `zh_female_jitangmei_uranus_bigtts`
  + 5 个有效候选(shuangkuaisisi/roumeinvyou/tianmeiyueyue 女声、yuanboxiaoshu/wennuanahu 男声);
  试听样本落 `~/.saydo/tts-voice-candidates/`(6 个 mp3)。owner 听感拍板登记 HANDOFF §2-10
  (挂下次场次顺做);拍板后改 doubao_tts.py voice 缺省一行。
- **实测知识**(HANDOFF §5 新条):seed-tts-2.0 资源包只认 uranus 系音色,moon 系报
  `resource ID is mismatched`——换音色先确认后缀系别。
- 无代码变更(实验走 /tmp,样本落 ~/.saydo)。

### 1.7 HANDOFF §2 回填 [ok](IMPL-5 §3.5 五项 ↔ HANDOFF 逐行一致)

- #2 真人音频:已到位烟测 3/5(两条稳定误听处置链全引)——**音频 evidence 可复跑**:
  `pipeline/.venv/bin/python e2e/smoke/audio-smoke-5.py --profile owner`(输出见 §1.1);
  底板文件 digest(本会话 `shasum -a 256` 真实输出):

```
072ce2594e3f0c5453e227638f46840b989228fdfe9d00869d11c708d3f653ba  a01.m4a
00c1db64812568a05388eee850e8bd6fc8376b9f9390b5bedfc2eae92c1fc53d  a02.m4a
8af7a0eea891162c70cbf1cc90fe252bdfc70c4d966862e2f1bd6c15a92a7f5f  a04.m4a
d2a5d5cc24f0f68be117652f204558b3a1ff09ce4ebaee9568392d6a2c9229cf  a13.m4a
8acba3e6b99cb6a83cb5144863ef3a0f06273a432c6dbd211165c471d0383338  a20.m4a
```

- #3 dogfood 双仓(OctoDesk coding / OctoBlog writing)+ saydo-dogfood 命名澄清(e2e 沙箱);
- #5 Actions billing = 2026-08 再开(本地 just ci 延续);#6 Claude 订阅 = 下周购入 + CLI-only
  硬约束 + observedModel 豁免仍休眠;#8-② 项目层配置随 1.3 清账标完成;新增 #10 音色拍板待办。
- HANDOFF §5 补两条实测知识(WAVEFORMATEXTENSIBLE 随 1.1;TTS 资源包系别随 1.6)。

### 1.8 转写 ref 口径统一 [ok](Codex 18 A-2;红线"不改 09"守住)

- 09 现文定形:`SourceRef.ref`(§4)= **裸 turnId**;`snapshotLocator`(§4.1)=
  `transcript:<sessionId>#<turnId>`(快照器产出)——两个不同字段,病灶 = liveTools 把 locator
  形态写进 ref,快照器按 §4 裸 turnId 扫描永 miss。
- 统一:liveTools `remember`/`addHotword` 自取 ref = 裸 `ctx.turnId`(ULID 全局唯一可定位);
  snapshotter 对 locator 形态 ref **处方化拒收**(不静默兼容双形态);verify readLive 现状已合
  口径零改;api/fixture 示例同步;`captureNegation` 无生产调用点且测试已裸形态,免改。
- 验收锚:§12 反例(evaluator.test:locator 形态拒 + 正确形态产 locator)**17 passed**;
  user_utterance claim 回读抽查 e2e(live-wiring:remember 自取 → capture 命中转写行 →
  snapshotLocator 形态断言 → verifyBinding intact+fresh+match 闭环)过。
- 代码提交 `178411c`。

## 2. 测试命令与尾行输出(收口全量复跑,本会话真实输出)

- `just ci`(收口终值,回修批后复跑,ci-exit=0 独立核实):双矩阵绿——contracts **66 passed** +
  daemon **467 passed | 4 skipped**(452→467,+15 本批;4 skipped = SAYDO_SLOW_E2E 1 +
  SAYDO_LIVE_E2E 3,后者含本批新增 2 个门控)+ python **11 passed**;emoji 门禁 clean + 自测 4/4。
- `pnpm exec playwright test` → **10 passed**(12.7s)。
- 门控真 agent(手动,耗订阅额度,本会话实跑):
  `SAYDO_LIVE_E2E=1 pnpm --filter @saydo/daemon exec vitest run test/tier1-live.e2e.test.ts`
  → **3 passed**(全闭环 + W1.4 hooks 52.4s + W1.4 resume)。
- 本批新增测试(逐文件计数):`config-project` 6 / `tier1-executor` +2(19→21:W1.3 集成锚 +
  W1.4 resume 单元锚)/ `live-wiring` +3(6→9:W1.4 深评 2 + W1.8 回读 1)/ `evaluator` +1
  (16→17:W1.8 反例)/ `value-report` +2(3→5)/ `tier1-live` +2(1→3,门控)。
- ASR 侧(非 CI,分钟级花费批内声明):真人底板 `--profile owner` 3/5(known-miss 口径 exit 0)
  + 合成底板 5/5 + 热词调优矩阵 5 组 x 2 条 + TTS 音色实测 10 次合成(4 fail 为 ID 系别探测)。

## 3. 评审(批末 code-review subagent,A 级必修;总判"1 A 必修,其余通过"——已回修)

- **A1(必修,已修 `e745f9a`)**:深评门"一次性",重试即绕过——`governor.admit` 拒
  (duplicate/cap/cooldown)被 `maybeDeepAssess` 当放行;且 admit 在评估**前**烧键,`assessDeep`
  抛错后重试撞 duplicate 同样绕门;maxPerSession 耗尽后门对会话永久失效。评审如实定界:生产
  dims 恒空,本批无实际触发面,落 dims 的批即引爆;原 live-wiring 第二用例把绕过行为固化成预期。
  **修**:governor 改 verdict 缓存三段合同(admit 只读判断 / 评估成功 commit 才烧键+计数+冷却 /
  duplicate 返回缓存裁决**照拒**);maybeDeepAssess 三态化(not_armed/evaluated/throttled),
  throttled(cap/cooldown 无缓存)在 proposeStart 侧 fail-closed 拒(readiness_throttled),
  assessReadiness(信息性工具)如实回落规则层。回归锚:live-wiring 重写两用例(同 digest 连发
  重试零决策包 + cap=0 throttled 拒)+ evaluator.test governor 合同更新(`ffadec6`)。
- **B1(择要吸收,已修 `e745f9a`)**:evaluator 异族约束(09 §11 规则 5)无生产强制点——
  `validateConfig` 只有测试调用,W1.4 的 resolveEvaluatorProvider 是 evaluator 槽位第一个生产
  消费点。修:provider 内 familyFromModelName 与 dialog/thinking 比对,同族拒装配(warn + null)。
- **C1(顺手修,已修 `e745f9a`)**:project.toml 读取 catch-all 把 EACCES 当缺失——改仅 ENOENT
  空合法,其余 rethrow(fail-closed,防 [git].protected 静默丢失)。
- **C2/C3/C4(登记不修)**:system 行双 JSON.parse(整洁项)/ budget/dnd 覆盖域无形状校验
  (applyProjectOverrides 生产零调用,接消费前定独立 schema)/ live-wiring 测试临时目录泄漏
  (既有模式)。
- 重点面全过:白名单无绕过(大小写/点键/重复键均 fail-closed)、protectedBranches 双链消费无
  竞态窗口(同步段)、--resume IS NULL 守卫语义正确(返工新行不受旧行影响)、valueReport 无
  JSONL 注入面(JSON.stringify 转义)、ref 生产写点全裸 turnId、种收据 SQL 与生产链形状一致、
  全批零 emoji、契约零分叉。
- **过程事故如实登记**:`e745f9a` 提交时 CI 实有 1 红(governor 旧单元测试按旧合同断言)——
  提交命令用 `just ci | rg` 管道,rg 退出码掩盖了 ci 失败,违反"提交前必绿"。发现后立即修复
  (`ffadec6`)并独立核实 ci-exit=0;教训:门禁命令不得经管道取尾,退出码必须显式核查。

## 4. 偏离与差距(诚实清单)

- [warn] 1.2 热词调优:五组变体(拆词/变体/scale 加权/组合)全部无改善,两条误听未拉回——
  非工程缺陷,是 sauc 偏置能力边界;已登记回归集 status=open,依赖纠错链闭环(10 #8/#9)。
- [warn] 1.4 深评装配的 dims 生产语义留白(canonical 未定义 live 对话/记忆 → Claim[] 构造规则):
  生产 dims 恒空 = 深评零触发;管道(触发/调用律/fail-closed 消费)已就绪并有 e2e 锚,
  语义落定(dogfood/R 轮)后替换 index.ts dims 回调即可。
- [warn] 1.4 --resume:未伪造"daemon 崩溃 + 全链 recover"的 live 复合场景(进程内伪造不干净)——
  单元锚(fake 全链)+ 外部事实(真 agent --resume session_id 同一)合起来闭合 0.0(a) 验收句。
- [warn] 1.5 北极星② review 跨度组分未计(无独立时刻源);回叫撞车/检索 miss/离机时段三读数
  无数据源,0 值列位如实注明。
- [warn] **Codex 20 triage 移交项(对账会话 2026-07-26 划定"W 批,场次②前落";本批不越权抢跑,
  登记待排产)**:① A1 补偿控制(gate 请求处 gate.sh digest 校验,不符 deny + cancel 活跃 runs)
  ② B2 validateTier1Config(存在/可执行/versions 形态/精确版本)+ §12-9 反例 ③ B3 非 cursor
  后端启动即拒 ④ B5 gate.sh jq -e 输入校验 ⑤ B6 前半 step_confirm 档执行器承载核对。
  出处:`research/codex-findings/20-executor-writeback.md` §遗留。
- 并发对账会话第二轮修改收编:`tier1-conformance.md`(Codex 20 A1 门完整性行改口 [warn] +
  B7 提交清单补全)——对账会话产出、triage 表明确"由 W1 收编提交",内容经本会话核对无误。

## 5. 代码提交(SHA 均为本会话 git log 真实输出)

- `8f77e0b` chore(w1): 1.9 排产源移交 + 执行器批 readback 勘误落账
- `2e9833a` feat(w1): 1.1 audio-smoke 收编真人底板 + 1.2 ASR 误听回归集种子
- `6bc48dc` feat(w1): 1.3 项目层配置生产加载
- `178411c` fix(w1): 1.8 转写 ref 口径统一
- `e5274b1` feat(w1): 1.4 挂账清偿(深评装配 + seedTerms + 0.0(a))
- `6d1c99e` fix(w1): 1.4 对齐(恢复钥匙落 native_session_id 列)
- `6d22cf8` feat(w1): 1.5 周报增量
- `a11b59c` chore(w1): 1.6/1.7 收口(HANDOFF 回填 + evidence 落盘)
- `e745f9a` fix(w1): code-review 回修批(A1 深评门重试绕过 + B1 异族强制 + C1 读错误面)
- `ffadec6` fix(w1): governor 旧单元测试按 A1 后合同更新
- 基线 `65559c2`;本文件与收口更新随末次 `chore(evidence)` 提交(SHA 见 git log,不自指)。
