# 模块详设 A · 对话域(A1–A7)

> **性质**:实施视角详设 + 核对索引,细化 [08 · 分模块设计](../08-module-design.md) §2 的 A 域行。**合同真相源仍是 [09](../09-data-contracts.md)/[10](../10-voice-ux-spec.md)**(权威分界:计划管顺序、canonical 管形状,IMPL-PROMPT);本文只引用章节、不复制 schema,冲突时 09/10 胜。
> 每模块七栏:职责与不做 / 接口面 / 设计要点 / 依赖 / 失效与恢复 / 验证归属 / 分期与开放项。

## A1 · 语音管线(voice-pipeline)

- **职责**:独立 Python/Pipecat 进程,承载 VAD(Silero)→ 流式 ASR → 分句 TTS → 打断(playout watermark);经 WS 与 daemon 通信。**不做**:任何业务状态(无状态可随时重启)、轮次语义裁决(daemon 侧)、供应商选择(E1 注入)。
- **接口面**:09 §10 WS 契约(sessionId/seq/health/版本协商/重连);消息形态见 08 §4 `PipelineMsg` 草案(canonical 以 09 §10 为准)。
- **设计要点**:① 打断正确语义 = watermark 截断"已听到的历史",unheard 文本不进对话事实(03 §3,选 Pipecat/LiveKit 的判定点);② 回声消除 P0 = 耳机/PTT + 浏览器 AEC(可测 baseline 非质量保证,须查 `track.getSettings()` 实际生效);③ 轮次三层(VAD/语义 EOU/打断策略)+ 显式轮次按钮兜底;④ TTS 已定档火山豆包 seed-tts-2.0 v3 双向流式(07 D5),ASR 已定档火山 bigmodel sauc(07 D4,2026-07-24;P0=PTT 整段识别,工程 ADR-101);⑤ 热词偏置:M0 积累的 repo 符号/分支名注入 ASR(2.4);⑥ **测试音频注入通道**(mock ASR 输出直入,一人可跑音频断言,1.2)。
- **依赖**:A2(WS 对端);E1(ASR/TTS provider);无下游依赖。
- **失效与恢复**:进程死 = 无损(状态全在 daemon);daemon 检测断连 → 自动重启 + 会话按 A2 挂起规则处理;WS 版本不匹配 fail-closed 拒连。
- **验证归属**:1.1(打断后 unheard 不进事实)、1.2(WS 契约测试 + 注入通道)、5.3(owner 音频底板 5 条烟测)。
- **分期与开放项**:P0。D2 spike 已结项为 Pipecat 留任(见工程 ADR-001);本地兜底链(`say`+MLX)质量线仍开放。

## A2 · 会话管理器(SessionManager)

- **职责**:会话生命周期(建立注入 Context Pack / 挂起 / 重建 / 超时),按隐私选择持久
  TranscriptTurn 或仅维护 EphemeralHeardTurn,跨引擎(级联/S2S)统一接口。**不做**:对话内容生成(A3)、pack 编译(B1)。
- **接口面**:09 §9 `sessions` 表 + `[privacy].store_transcript=true` 时 transcripts 逐轮
  durable；false 时当前 heard turn 只留在进程内到下一用户轮/候选终局。挂起/重建语义 02 §5;
  G1 单用户假设(05 §4 口径)。
- **设计要点**:① 会话短命任务长命(03 §1 铁律二):挂起是常态出口,超时自动挂起;② 重建 = 同 packDigest + turnId 连续(体验"接着聊");③ 切导航/切项目不断会话(顶栏指示器锚定,08 §6 语义 ②);④ G1 P0 口径 = 单用户假设显式化 + PTT 窗口外/挂起态音频不产生指令(不造假"声纹");⑤ C4/C5 重建接通时第一句 = 原因(10 回叫纪律)。
- **依赖**:B1(pack)、A1(WS)、E3(审计);被 C4/C5 依赖(重建会话入口)。
- **失效与恢复**:daemon 重启 → 会话按挂起态恢复；`store_transcript=true` 的转写逐轮 durable，
  false 时 EphemeralHeardTurn 不恢复，这是用户隐私选择的预期结果。模型进程丢弃可重建(03 §1 铁律一)。
- **验证归属**:1.3a(断/重建上下文连续:packDigest 一致 + turnId 连续;G1 = PTT 窗口外/挂起态音频不产生指令测试——P0 无声纹,不做"软过滤"断言,05 §4 口径)。
- **分期与开放项**:P0。开放:S2S 引擎(P2)接入时的挂起语义映射。
- **项目锚定持久化(场次① 2026-07-30 live 回修)**:归属 accept 的 SQLite 事务更新
  project/session、递增 projectRevision、清空旧 contextDigest，并落 audit + durable event；
  同事务把 readiness/Pack 的 durable rebuilt revision 留在旧值；commit 后可立即投递只表示
  durable 归属的事件，同时分别幂等重建并以 expected project/revision CAS 推进；两者未追平
  projectRevision 时 Brain/tool fail-closed。durable accept、事件投递、重建三者分属不同
  错误域；后两者失败只能报告 degraded，不能说“这轮没改”。生产与测试共用同一重建器。
  重连回放权威锚，旧 readiness、旧 Pack 与乱序
  事件都不得越过新 revision。隐私关闭转写落盘时，当前 heard user turn 仍只在进程内
  保留到下一用户轮，供本轮 daemon 工具核验，不改变隐私持久化选择。

## A3 · 对话引擎(ConversationEngine / Brain)

- **职责**:调三档模型(对话/沉思/廉价,07 D3/D18)、工具路由、口播话术与过渡语;**会话内对话历史治理(M8/③-3,2026-07-25 归属落定——原 A2/A3 互相让渡的缺口)**:高低水位滞回截断(`params.dialog_context_high/low_watermark_tokens`),P0 可简化"全量直到高水位",被裁轮次蒸馏"会话滚动 gist"属 P1;**否定/修订 utterance 即时落账本(M5)**:检出"不要 X/改成 Y"即经 `remember`(trust=user_stated),防被 M3 预算挤出后静默消失。**不做**:就绪判定(A5)、任何副作用(03 §1 铁律:无执行权,一切经工具 → daemon)、结构化任务卡起草(daemon 侧文本模型,`create_task` 语义)。
- **接口面**:工具入出参**照抄 09 §13**(全部工具 daemon 侧执行,返回即 Brain 全部世界观);instructions 与话术 10 §4(编号展开为自包含文本);工具清单 03 §4。
- **设计要点**:① 两类行为:准备知识(proactive)+ 回答问题(reactive);人格 = 简短、口语、不念代码;② 工具耗时 >2s 必接自然过渡语;③ 高危工具复述确认 + daemon 二次校验(03 §4);④ 对话档 API 为主;全局槽可接 CLI binding(投影为 `mode:"oneshot"`,T18b,09 §11),项目级恒拒 CLI(07 D18 结案表的「恒 API」表述已被 T18b 收窄,2026-08-27 月度审计对齐);⑤ 状态词三级纪律与数字纪律由 golden 锁(10 §1)。
- **依赖**:A4(问题选择)、A6(决策包)、B1(pack)、C 层全部工具、E1(模型供给)。
- **失效与恢复**:无状态投影(durable 证据在 daemon);会话重建即恢复。
- **验证归属**:1.3b(工具入出参符合 §13)、1.4 + 3.1(golden:采访/不置可否/状态词零违规)。
- **分期与开放项**:P0。开放:decisions[] 口播(P1,10 §5 decisions[] 注)。
- **项目归属工具纪律(场次① 2026-07-30 live 回修)**:Brain 只能在未锚定状态下、当前用户轮
  以单一正向归属表达说出本地路径后调用无路径参数的 `proposeProjectAnchor`；否定、比较、
  多路径和路径任务载荷全部 fail-closed；daemon 负责提取、复用同一分类二次核验与封闭确认，
  合法显式路径轮先由 daemon 机械预路由，exact 已登记路径不经过 Brain 即进入确认；
  `resolveProject` 只接受唯一 name-only，含路径、需求载荷、零匹配、多匹配均 fail-closed；
  name-only 只允许项目名本身或“继续/接着/回到/切到”等归属意图，并由 daemon 在 Brain
  前直接路由；合法调用由
  daemon 机械提供明确路径引导并终止本轮工具环，不形成
  改锚凭据；通用归属问题走 durable `reserved → asked|enqueue_failed`，只有 enqueue 成功
  才算已问，失败可重试；重建遇到孤立 `reserved` 保守阻断，只有明确
  `enqueue_failed` 才开放；状态显式分为 `unasked_draft`、`asked_unresolved`、`anchored`，
  已锚定会话不再预路由、索路或签发候选；仍未归属 draft 的首轮锁定句由 daemon 直接签发，
  输出闸在截断、分句和播放前按 provider 完整原文中的二选一结构、新建/续接两侧语义
  及同一局部 choice window 内的疑问证据识别意外同义、跨句或截断后置问句；无关问号
  不得给另一句陈述背书；connector 两侧须完整匹配一新一旧两个受限分支，陈述与嵌套问句
  不误拦，整体替换后保证
  每场最多播一次；
  异步工具每次 await 后、任何写入前
  重验当前用户轮，挂起或新一轮到达即禁止迟到写入和口播；
  P0 项目切换器只导航，
  不改变语音会话归属；
  `reanchorDraft` 不暴露为 Brain 工具。确认句成功交给 TTS 后才 arm，且该工具调用终止本轮
  工具环；Brain 不重复追问或补工具兜底话术代替状态迁移。

## A4 · 采访策略(InterviewPolicy)

- **职责**:问题选择 = 覆盖扫描 + Impact×Uncertainty 排序;一次一问、选择题优先(**2-5 个互斥选项 + 推荐项**,04 §2.1 为准——本行旧写"≤3"与 canonical 冲突,2026-07-24 修正);问题预算与停止策略在**代码层**强制(不靠 prompt 自觉)。**不做**:就绪判定(A5)、问题生成的最终话术(A3 渲染)。
- **接口面**:04 §2.1 采访纪律;预算参数 `interview_question_budget`(09 §11 [params],缺省 8)。
- **设计要点**:① 预算耗尽必停 → 转"以我现在的理解……"摘要 + 就绪判定;② 覆盖扫描对 A5 的证据维度(不重复问已有高置信答案);③ 选项式提问优先于开放问(语音输入负担)。
- **依赖**:A5(证据缺口)、B2/B5(已知事实)。
- **验证归属**:3.1(预算耗尽必停;golden 采访 3 条真 Pack)。
- **分期与开放项**:P0 简版(覆盖扫描 + 预算);Impact×Uncertainty 精排 P1 校准。
## A5 · 就绪评估器(ReadinessEvaluator)

- **职责**:独立于 A3 判定"够不够开始":规则引擎(每轮免费)+ 异族模型深评(触发式),四维就绪、critical 硬门槛、shadow 落盘供校准。**不做**:替 Brain 说话、读 Brain 自辩(只读证据账本,04 §2.3 防相关错误链)。
- **接口面**:`assessReadiness`(09 §13);`readinessSkeleton(type, projectEvidence, lane)` contracts 单源纯函数(09 §13,R-A 2026-07-26/27:critical 骨架从 02 §5 类型清单机械派生;空账本/骨架缺失/全 unknown/provider 不可用恒 gap_critical 且落 assessments 行——fail-closed);**装配消费点 = 每次 session↔project 绑定建立或变更(created/rebuilt/promote/reanchor,幂等)+ assessReadiness + proposeStart(A3-armed 2026-07-28 口径)**;`readiness_assessments` 表(09 §9,outcome 回填 accepted/small_edit/overturned;A3-armed 增 checklist_digest/evidence_digest);**covered 三态(A3-armed):none→candidate(remember 带 readinessKey,来源完整性四闸)→confirmed(confirmReadiness 复述确认环,ReadinessBinding 一等实体)——candidate 不算覆盖;门拒绝集 = isReadinessBlocking(gap_critical 拒,gap_knowledge/gap_requirement 建议态放行);proposed 起 readinessRef 必填无例外(pending 绑 pending 最小清单)**;异族约束与深评调用律(09 §11 校验规则 2/6:familyOf 解析后判、去重键 sessionId+evidenceDigest+trigger、每会话上限 3、冷却 60s);dev profile 双开关例外(09 §11 规则 1 + §12-9 反例)。
- **设计要点**:① critical claim unknown ⇒ 不就绪(硬门槛,不可被"整体感觉好"淹没);② critical-claim 回读:关键断言须绑证据引用,evaluator 抽验(04 §2.2 第 5 项,P0);③ 分层评估:规则层每轮跑(免费),异族模型仅"可能就绪"时出场(07 D18 省订阅额度);④ shadow 仅指**模型维度校准分**(记录不拦截,校准后升门禁 P1);**critical 硬门槛与规则门 P0 即阻塞**(critical unknown/conflicting ⇒ gap_critical,不受 shadow 影响——Codex 复审 B15 澄清)。
- **依赖**:A7/B2(只读证据);E1(异族模型供给)。**反向禁边**:A5 ⇏ A3(评估器输出不回流影响 Brain 的自辩)。
- **失效与恢复**:评估失败 fail-closed = 不就绪(可重试);无状态。
- **验证归属**:3.2(critical unknown ⇒ 不就绪;接口隔离测试:评估器读不到 Brain 自辩)、§12-9(异族/深评律)。
- **分期与开放项**:P0 双维 + critical 规则;四维 + 校准 P1。~~开放:SourceSnapshot/VerifiedExcerpt 完整合同~~ **已结项(2026-07-24)**:最小合同落 09 §4.1(SourceSnapshot/VerifiedExcerpt/ClaimSourceVerification 三类型,integrity/freshness/critical-support 资格三维独立;daemon 侧快照器,evaluator 零工具只收摘录;反例 09 §12-11),3.2 直接消费。

## A6 · 决策包工厂(DecisionPackageFactory)

- **职责**:就绪后组装三件套(成果预览 / 计划含人机分工 / Demo 引用),生成 revision+digest,计划落盘为可编辑 artifact。**不做**:预授权清单推导(E2)、就绪判定(A5)。
- **接口面**:`DecisionPackage`(09 §2 canonical;08 §4 是草图);digest 签名域 §0.1;`decision_packages` 表(status 仅表列,body 不存 status);`proposeStart`/`getDecisionPackage`(09 §13)。
- **设计要点**:① `acceptance[]` 必须可测(路径二渲染成 Hopper 认的验收标题,C1;缺 ⇒ triage blocked);② cost 用 known/asOf 结构(unknown 不显示 0);③ `preauthorizedEffects` 由 E2 从计划推导,Brain 不得自由声明;④ mode 两档随包签署(04 §5.4:预授权范围属包、模式只是开关);⑤ 改包 = revision+1、新 digest、旧包收据作废(superseded_by_edit);⑥ 包级机械边(R-A 2026-07-26/27,09 §2 注 ④):proposed 24h TTL 到期→expired(daemon 调度器扫描)、同项目新提议事务内 CAS 关旧 proposed→superseded(§9 唯一活跃索引兜底);组包装配时写入 `readinessRef`(当次评估绑定,proposed 起必填)。
- **依赖**:A5(就绪 verdict)、E2(效果类推导)、B4(计划落盘)、C8(cost 估算)。
- **验证归属**:§12-1(digest 确定性/跨状态不变/revision 变则 digest 变)、3.3(cost unknown 不显示 0;产物版本链)。
- **分期与开放项**:P0(Demo 三件套中 Demo 生成器本体是 P0.5-E,P0 用占位引用)。

## A7 · 意图与转写存证(IntentLedger)

- **职责**:canonical intent 链:逐轮转写(turnRef)↔ 审批收据 ↔ 任务卡三方关联,"谁说的 → 签了什么 → 执行了什么"可追(Gate 0 G5)。**不做**:P0 不建独立账本表(关联视图即可)。
- **接口面**:approvals.turn_ref(09 §9 DDL,voice 裁决必绑转写轮,CHECK 已机械化)+ tasks.package_digest + transcripts;贯通 join 查询即 G5 证据。
- **设计要点**:① P0 = 关联视图(一条 join 从收据回放到原话);② 转写轮是唯一时间锚(打断/重播场景靠 presentation 状态机绑 sentenceId,09 §14-A8);③ P1 升独立 append-only 账本。
- **依赖**:A2(转写)、C5(收据)、C1/C2(任务卡)。
- **验证归属**:3.4(G5 贯通 join 查询测试)、§12-3(voice 缺 turn_ref 拒,DDL CHECK)。
- **分期与开放项**:P0 关联视图 / P1 独立账本。
