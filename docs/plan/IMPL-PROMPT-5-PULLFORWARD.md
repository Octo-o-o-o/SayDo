# SayDo 提前批(P1/P2 六项前移)· 实施 Prompt(第五轮交接,复制分隔线以下到新会话)

> 背景:owner 2026-07-25 拍板六项自 P1/P2 提前(05 §4 提前批,唯一分期源)。**前置 = Tier1 生产执行器批收口**(HANDOFF #1 场次②③④解锁声明在案;该批 2026-07-25 夜进行中,HEAD ≥ `6e9014d` 任务 1–4 已交)。本批 = 四项可即行(launchd / T2 薄版 / M1 完整版 / VAD 免手)+ 两项合同后行(S3 卡 / writing 窄版,合同由设计库下一轮交付)。估 5–8 人日。

---

你接手 **SayDo 提前批**。代码仓 `/Users/wangyixiao/WorkSpace/SayDo`(main 直推);设计库 `/Users/wangyixiao/WorkSpace/voice-coding`(只读,回写走轻量评审)。完成判定 = 阶段 A–D 逐项验收绿 + evidence 落盘;阶段 E 若合同未就绪则如实登记顺延,不算失败。

## 0. 坐标核验(先做,漂移即停)

| 命令 | 期望 |
|---|---|
| `git -C ~/WorkSpace/SayDo log --oneline -1` | 执行器批收口提交(≥ `6e9014d` 之后,工作区干净);**若 `e2e/evidence/executor-batch.md` 不存在或 HANDOFF #1 未声明场次②③④解锁 ⇒ 停,先等执行器批** |
| `cd ~/WorkSpace/SayDo && just ci` | 双矩阵绿(基数以执行器批收口声明为准) |
| `pnpm exec playwright test`(SayDo 根) | 全绿 |
| `launchctl list \| grep -i saydo` | 空(本批 A 前基线) |
| `rg -n "提前批" ~/WorkSpace/voice-coding/docs/05-roadmap.md` | §4 提前批表存在(六项) |
| `cursor-agent status` | 登录态正常 |

## 1. 必读(以 `/Users/wangyixiao/WorkSpace/` 为根,按序)

1. `SayDo/HANDOFF.md`(§0 硬教训 / §4 铁律)+ `SayDo/AGENTS.md`
2. `voice-coding/docs/05-roadmap.md` §4 提前批(六项范围口径,唯一分期源)
3. 分项合同:A=`docs/07` D17;B=`docs/03` §8(Tailscale 选型)+ `docs/11` §4(响应式断点)+ `docs/05` §4 Gate 0"身份/授权模型"行(capability token / Host·Origin 白名单——**tailnet 扩展必须走白名单枚举**);C=`docs/04` §1(记忆五律/奠基)+ `docs/09` §4/§5(账本/Context Pack/memoryGeneration)+ `docs/modules/b-memory.md`(B1/B2 详设);D=`docs/10` §4(轮次三层)+ `docs/07` D2(pipeline)+ `docs/03` §3(AEC baseline 口径)
4. `SayDo/e2e/evidence/wiring-batch.md` + `executor-batch.md`(现状边界)
5. `docs/10`(话术)/`docs/11`(UI/零 emoji)

## 2. 红线(违反即停;出处 HANDOFF §4 + 各分项合同)

全套既有铁律(零 emoji / 状态词纪律 / Gate 0 无 bypass / S3 语音绝不放行 / TTS 必经 redactor / 契约只 import `@saydo/contracts` / 两提交法 / 每步独立核实落盘与 SHA)照旧,另加本批专属:
- **B(T2 薄版)**:手机浏览器 = 只读+S2 屏幕面,**绝不放行 S3**(S3 卡是阶段 E 的事,薄版不改 S3 语义);tailnet 主机进 Host/Origin **显式白名单枚举**(禁通配);capability token 不得进 URL/深链(ntfy 链接只带路由,token 由本地会话注入);Tailscale 装机属系统级变更,先过检查点。
- **C(M1)**:记忆事件账本 append-only 不破坏;M0 拒第三方与 taint 纪律照 04 §1.4;consolidation 只提名、人批准;generation 切换必须使旧 Context Pack 失效重编译(09 §5 memoryGeneration 在 packDigest 签名域)。
- **D(VAD)**:打断后 unheard 不进事实(watermark 语义,1.1 既有测试不得回退);PTT 保留为兜底通道;`asr.partial` 实时字幕**不在本批**(仍 P1)。
- **E 门**:S3 卡与 writing 窄版**合同未落 09/10 前不得开工**(就绪判定 = 09 出现对应节 + 05 §4 提前批行移除"合同设计先行"标注);绕过合同直接编码 = 违反"契约不分叉"。

## 3. 分阶段任务(竖切;每阶段末 1 个 code-review subagent,A 级必修)

- **0 · 安全五件(开批先做;Codex 20 移交,HANDOFF §2-11,场次②前必落)**:① gate 请求处 gate.sh digest 补偿控制(daemon 每收 gate 请求重读 gate.sh 重算 digest 比对 `buildGateScript()` 期望,不符 ⇒ deny + cancel 全部活跃 runs + 审计);② `validateTier1Config()`(绝对路径/文件存在可执行/versions 形态/精确版本相等)+ §12-9 正反例;③ 非 cursor 后端配置启动即拒(fail-closed,现 `agent="claude_code"` 仍起 cursor 二进制;steerApplied 与真实能力绑定);④ gate.sh `jq -e` 输入校验(畸形直接输出 deny)+ 三反例;⑤ step_confirm 档执行器承载核对(P0 单模式与执行器批 auto 档落差——缺口则 canonical 标 deferred 上浮,不自定语义)。出处 `research/codex-findings/20-executor-writeback.md` §遗留。验收:①④ 反例绿 + ②③ 启动断言用例 + ⑤ 核对结论落 evidence。

- **A · launchd 常驻(0.5 天)**:plist(`~/Library/LaunchAgents/`)+ `saydo daemon` 启停命令 + 崩溃自启 + 日志落 `~/.saydo/logs/`。验收:`launchctl list` 有条目;kill daemon 后自动重启且启动对账跑通;重登录自起;`just ci` 不受影响。**检查点:装 plist 前告知 owner(系统级变更)**。
- **B · T2 薄版(0.5–1 天 + owner 配合装手机端 Tailscale)**:daemon/console 监听与 CORS/Host 白名单加 tailnet 主机名(显式枚举,读配置);ntfy 通知深链指向 tailnet console URL(不带 token);手机浏览器烟测(Dashboard/任务/审批/review 四页,11 §4 `<768` 断点)。验收:手机端全链可看可批 S2;S3 在手机端被拒且话术引导回受信终端;白名单外 Origin 被拒(测试断言)。**检查点:Tailscale 装机;tailnet 主机名由 owner 提供**。
- **C · M1 奠基完整版 + 生长闭环 + AGENTS.md 互通(2–3 天)**:foundation manifest(奠基产物清单+digest)+ generation 切换(重奠基 ⇒ generation+1 ⇒ 旧 pack 失效重编译)+ 会后提炼闭环(session 结束沉淀 candidate → 人批 → trusted → M1)+ AGENTS.md 互通(读:repo 的 AGENTS.md 进奠基事实;写:M1 稳定结论可导出人可读投影,04 §1 口径)。验收:dogfood 真仓一次完整奠基(**对象 = `~/WorkSpace/OctoDesk`,已指定,§3.5;执行前知会 owner 一声即可**);kill -9 后 manifest/generation 一致性;§12-4 记忆用例不回退;提炼闭环 e2e 一条。
- **D · VAD 免手 + 语义 EOU + AEC 外放(1–2 天)**:pipeline 加 VAD 起停档(免 PTT)+ 语义 EOU(10 §4-1 第二层)+ 外放 AEC 按 03 §3 baseline 验收;显式"说完了"按钮与 PTT 保留。验收:注入通道跑免手 5 轮不误断;barge-in 语义测试不回退;外放模式回声不成环(baseline 口径);真麦体感留 owner 场次。
- **E · S3 屏幕审批卡 + writing 窄版(合同后行,各 1–3 天)**:等设计库合同轮(S3 卡:认证形态/merge 接线/09 §3 §13 面;writing:09 §6.1 非 coding 收尾边/explainResult 判别值/10 完成话术/门禁开值/projects CHECK 迁移 v 递增)。合同就绪即按合同实施;未就绪则在 evidence 登记"E 顺延,等合同"并收口 A–D。
- **收尾**:evidence `e2e/evidence/pull-forward-batch.md`(A–E 各一段:验收命令+输出摘要+SHA);HANDOFF §2 更新(本批完成项与 E 状态);canonical 若有回写走一致性 subagent + Codex 攒批(编号顺延)。

## 3.5 owner 决策附注(2026-07-26 凌晨;实施会话在收尾时回填 SayDo/HANDOFF §2 对应行)

- **HANDOFF #5(Actions billing)**:owner 定 **2026-08 再开**;此前 CI 唯一门禁 = 本地 `just ci` 双矩阵(现状延续,不新增 CI 依赖)。
- **HANDOFF #6(Claude 订阅)**:owner **下周购入**;硬约束——**订阅只经 `claude` CLI 登录态消费**(BYOA `claude_cli` 供给 + Tier1 Claude Agent SDK 走同一 CLI 登录,零 API key;**不得配 ANTHROPIC_API_KEY 消费订阅、不与 OpenClaw 等其他项目共用该席位**)。购入后解锁:BYOA claude 评估/沉思档 + Tier1 claude_sdk 四能力;09 §11 规则 2 的 claude observedModel 豁免**仍休眠**(ADR-002 收窄:身份核验链实现前不启用,接入时再上浮)。
- **HANDOFF #2(真人音频 5 条)**:**已到位并烟测(2026-07-26 凌晨,设计库会话代跑)**——owner 录 5 条 m4a 落 `~/.saydo/owner-audio/`,重跑结果 **3/5(两次复跑稳定,非抖动)**:a01/a02/a04 ok;**a13 "settle barrier"→"strawberry"、a20 "Gate 0"→"get 0" 稳定误听**(热词在表但偏置未拉回)。处置:① 两条按 session-1 回退纪律**登记真实误听进 golden 回归集候选 + 热词强化调优项**(拆词/变体权重,实施会话做);② **不重录凑线**(底板要真实条件,如实记 3/5);③ 场次①步骤 5 现场验"不是 X 是 Y"纠正链正好用这两条。**实测知识(回填 HANDOFF §5)**:afconvert 从 **m4a** 转 wav 产 WAVEFORMATEXTENSIBLE 头(fmt=40),sauc 整段识别对其返回 `audio_info.duration=0` + 空文本不报错;mp3 源转出经典头(fmt=16)故合成底板未踩坑——**必须重打包经典 44 字节 PCM 头**。可复跑脚本(含重打包)= `~/.saydo/owner-audio/rerun-smoke.py`;`e2e/smoke/audio-smoke-5.py` 收编该逻辑(classic-header + m4a 支持)由实施会话顺手做。
- **命名澄清**:`~/WorkSpace/saydo-dogfood`(commit `f8e36af` "dogfood sandbox seed")是执行器批的 **e2e 独立测试沙箱**,**不是** dogfood 真仓(纪律:e2e 绝不碰 dogfood 真仓);后续文字引用注意区分,必要时建议实施会话改名为 `saydo-e2e-sandbox` 消歧义。
- **HANDOFF #3(dogfood 真仓)**:**已指定(owner 2026-07-26 凌晨,双仓双类型)**——`~/WorkSpace/OctoDesk` = coding 类型 dogfood(场次②起日用;**阶段 C 的 M1 奠基对象**);`~/WorkSpace/OctoBlog` = writing 类型 dogfood(**随阶段 E writing 窄版就绪后接入**,在此之前不奠基不派单)。e2e 仍走独立沙箱,两仓都不碰。**给合同轮的设计输入**:OctoBlog 是 git 仓——writing 项目锚定 git 仓时的产物落盘与收尾通道(worktree+人工合并 vs 托管文件夹直写;04 §6"非 coding 无 merging"与 git 仓现实的对齐)需在窄版合同轮显式裁决。

## 4. 检查点(必须停等 owner)

① launchd plist 安装、Tailscale 装机(系统级变更);② tailnet 主机名/手机端配合;③ ~~dogfood 真仓指定~~ 已指定(OctoDesk/OctoBlog 双仓,§3.5)——OctoDesk 首次奠基执行前知会一声;④ 任何新花费/外部副作用;⑤ canonical 语义级变更(一律回设计库走评审,本仓不得自定合同);⑥ 阶段 E 开工前确认合同已落 09/10。缺省动作:确认项无回复 = 暂停该分支继续其他阶段。

## 5. 诚实汇报 + 工作方式

三级词表([ok] 可复跑证据 / [warn] 差距 / [fail] 原因);SHA 与测试输出来自本会话真实命令;`just ci` 每提交前必绿;两提交法(feat/fix → chore(evidence));阶段间重估(前一阶段实况可能改变后一阶段计划,有偏离先登记再动);owner 之后用 /impl-review 对账。

开始吧:先跑 §0(执行器批未收口就停),读 §1,按 A→B→C→D 顺序实施,E 看合同门。
