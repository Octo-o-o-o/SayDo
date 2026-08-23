# 05 · 落地方式与路线(Delivery & Roadmap)

> 本篇回答:怎么落地(复用什么、自建什么)、按什么顺序做、有哪些风险和待拍板事项。证据文档:`../research/local-projects-borrowing-assessment.md`(三本地项目评估)、`../research/ecosystem-analysis-and-fusion.md`(生态对照)、`../research/codex-findings/`(对抗性审查)。
>
> **[warn] 交付分期以 `plan/IMPLEMENTATION-PLAN-2.md` + `adr/design/ADR-001-execution-layer.md` 附注为唯一裁决**(owner 2026-07-23 裁定:**首发 = 完整双路径**,一次交付):开发顺序上 P0 阶段先做 Tier 1 全闭环,本篇 §6 P0 段中的 **Hopper 桥、直达验收档、Demo 生成器属 P0.5 阶段 = 首发后半程**,契约落地后接续建完才算首发交付(本篇文字未逐处回改,冲突时以计划步骤表为准)。

## 1. 落地策略:复用而非自建

外部调研 + 本地项目实读得出一致结论:SayDo 设计的**下游执行主干**(agent 适配、任务流真相源、崩溃恢复、预算熔断、worktree、验收闸门)在 owner 自己的 Hopper 里已有**可运行、测试全绿的现成实现**。**但要分清现状与蓝图**:审批(DecisionRequest)、通知(NotificationIntent)、命令/workflow 在 Hopper 目前**只有 schema、没有运行时**(其 M3b/M3c/M3d/WS4 里程碑未实现)——可直接复用的是"drop 任务 → worktree 执行 → 闸门 → review"这条现状流水线,控制面要 SayDo 侧自建。因此:

**自建范围收缩为"三块独特能力 + 一个控制面桥"**——经竞品调研与本地项目实读确认(样本截至 2026-07-22),市面产品与三个本地项目都不具备这三块的组合:

1. **实时语音双向对话**(级联/S2S 可插拔、AEC、barge-in、语音回叫);
2. **context 前置奠基 + 分层记忆 M0-M3**(显式范式:先备后答、持久生长);
3. **AI 主导采访 + 就绪决断 + 决策包**的收敛闭环;
4. (控制面桥)把三者与执行后端连接:任务卡渲染、drop、事件游标+settle 对账、回叫 outbox、两类审批收据、启动恢复——"薄"指不重复执行逻辑,不是"几行胶水"。

### 生态三项目的关系与分工

```
OpenClaw-MultiAgent-Kit ──(编排能力整体并入)──▶ Hopper(作者唯一在推的执行底盘)
OctoDesk / Work Steward(独立产品线:桌面工作台,提供协议模板与结构原型)
```

| 复用对象 | 拿什么 | 方式 |
|---|---|---|
| **Hopper**(TS/MIT,1076 单测全绿) | **现在可用**:runners 适配器 / worktree / events.jsonl 事件真相源 / 崩溃恢复 / usage 预算中枢 / 验收闸门。**只有 schema(设计对齐、运行时自建或等其落地)**:DecisionRequest 审批 / NotificationIntent 通知 / workflow executor | **代码级复用现状流水线**(执行后端首选);流式 + steer 等其 M3b;控制面 SayDo 自建 |
| **OpenClaw-Kit** | Genesis 大项目文档流程 / Spec Triad / Readiness Score / 自适应 Gate / 回叫链设计 | **抄骨架不接身体**(作者在迁出,终局是 Hopper) |
| **OctoDesk** | contextPack 装配蓝本 / understand-clarify-planner 三段结构 / EffectIntent 审批 / 反向 MCP 安全五层 / **手机↔桌面连接协议五件套** | **抄设计、搬契约,不 fork 代码**(深耦合其基建,无库边界) |

三个项目踩过的坑是免费学费,已固化为设计原则:失败必须一等可见;"建成了 ≠ 用户可达";异步审批中断点必须物化持久;加第三个 runner 不是配置小事;高危自动外发/信任毕业制被独立否决(永远保留人批)。

## 2. 战略路线

**执行层已拍板(2026-07-23,[设计 ADR-001](adr/design/ADR-001-execution-layer.md)):复用 Hopper 现状、锁版本、不等待、双路径**——重任务 drop 进 Hopper 当时已跑通的流水线(外部系统姿势、锁 commit、契约测试),轻任务/交互审批走 Tier 1 薄执行器(**当时方案为 Claude Agent SDK;Cursor CLI hooks 是已验证缺省**);不等 Hopper 平台化(M3b/M3c/M3d),落地一块换一块。进度可见性与操作归属(用户全程留在 SayDo,Hopper Console 是排障面)见设计 ADR-001。对接需求已成文:`../research/hopper-integration-request.md`;**裁决终稿已回(2026-07-23,Hopper 仓 `docs/plan/2026-07-23-saydo-integration-adjudication.fable.md`)**:17 项全裁决、最小阻塞集给到可照写代码的契约,已回填 09(§6/§7/§11/§14 A3/A4 关闭)与设计 ADR-001(锁定点/协调点落点)。

**现时态 supersede(2026-08-21,W5.4 方案 v3.1)**:Claude 产品路径已改为 `claude -p` + `PreToolUse` hooks,生产主流程已接线;Agent SDK 只保留 live steer/streaming input 的未来候选,不再是现行执行传输。Cursor CLI hooks 仍是当前稳定/dev 缺省。

**产品载体路线仍开放**(独立产品 vs 并入 OctoDesk 作能力面 vs 薄遥控器,归 owner):

| 选项 | 含义 | 评估 |
|---|---|---|
| A. 并入 OctoDesk(千手)作三个能力面 | 语音+奠基记忆+采访决断长在有 UI、有用户的产品上 | 复用产品化载体;受千手节奏约束 |
| B. 独立产品(执行层按设计 ADR-001) | 保留独立入口 | 当前文档集默认形态;与 A 不互斥(先独立跑通再并入) |
| C. 极薄语音遥控器 | 只做语音 I/O 桥 | 最省,但记忆/决断的独特价值被弱化 |

**Codex 对抗性审查总判定:战略方向 Conditional Go;"按方案直接做完整产品"No-Go——应先做窄闭环验证最脆弱的假设。**

## 3. 第一步:窄闭环 PoC(3–4 工程日)

按 [设计 ADR-001](adr/design/ADR-001-execution-layer.md) 锁定 Hopper 版本(**裁决定稿:`ea3fb31` / tag `v0.1.0-saydo-baseline.1`;2026-07-25 已按 X1 条件切锁 baseline.2 = `bdd1e548…`,现锁见 09 §11 [hopper]——本句保留为 PoC 时点历史**)。不改 Hopper 源码,SayDo 侧写四块胶水:**task-card renderer / CLI client / 只读 event bridge / durable callback outbox**,跑通:

```
语音拍板 → 任务卡 drop 进 Hopper → 跑到 ready_for_review(候选事件 → settle 对账 → durable outbox)→ 一次语音回叫
```

红线与验收(完整 8 条见 `../research/codex-findings/02-hopper-integration.md` §7):① 产品语义必须是"**执行和闸门已结束、等待验收**"(`ready_for_review`),不能说"任务已完成"(Hopper 的 code task 要 merge 后才 done);② 不能把电话里一句"好"直接转成 review approve + merge;③ 回叫必须等 **settle barrier**(runner 退出 ≠ 闸门/产物落盘完成,要等 summary/final snapshot 可读、投影确认为 review 再叫);④ 事件消费重放幂等、能处理 gap/损坏行;⑤ bridge 重启只回叫一次;⑥ verify 失败报"闸门阻断"而非"完成";⑦ PoC 期间禁止外部副作用(独立测试仓);⑧ 全链审计可追(谁说的→哪张卡→哪次 drop→哪个事件→哪次回叫)。

## 4. MVP 分期

> 纪律:范围是愿景,分期是克制。**P0 只做 `coding` 类型 + 场景 1**,把编码主线打穿;场景 2/3 依赖项目类型抽象与产物库,排 P2/P3。

### Gate 0(P0 前置门禁,不是可选项)

下表六类缺口(源自 Codex 评审识别,原编号 §6.5、已迁入本节)是**工程安全门禁**,不关闭不得开放自主 dispatch(区别于 §6 的商业未决事项);**两档执行模式共同前置,直达验收档不豁免任何一项**。P0 期间必须逐项有 owner、交付物与退出条件:

| 门禁 | P0 最低交付 |
|---|---|
| 身份/授权模型 | 单用户假设显式化:设备配对 + 屏幕认证承载 S3;多说话人 **P0 口径(2026-07-24 对齐)= PTT 窗口外/挂起态音频不产生指令**(不承诺说话人区分;"非 owner 发言不采纳"的真软过滤待所选 ASR 具备说话人标签能力后升级并回写本行——P0 不造假绿测)。**+ 本地 daemon HTTP/WS 调用方身份(安全复核 S2)**:每会话 capability token(SPA 注入 + 每请求/WS 握手校验)+ Host/Origin 白名单 + Host 头防 DNS rebinding + 写工具(confirmAndDispatch/issueDispatchReceipt/approveAction/merge)主体绑定——"localhost=secure context"只满足浏览器授麦,不提供调用方身份,否则恶意网页可绕语音授权直调 daemon(反例入 §12)。**+ selected-adapter 审批门完整性(安全复核 S1)**:决策通道走 daemon socket(非 worktree 文件)、gate 脚本在 worktree 外的 daemon 供给目录(**同 UID 下非强制不可写**——诚实口径与补偿控制见 09 §11 D8/Codex 20 A1:每请求 digest 校验待实施,完整隔离 P1)、**canary**(cursor stream-json 顶层 tool_call 无对应 hook 回调 ⇒ 立即 cancel+作废,唯一不依赖 vendor 语义的兜底、不可降级)、`cursor-agent` 版本 pin + 变更重跑门禁;未过 conformance 只许监督式研究 |
| 跨边界事务幂等 | bridge 的 outbox/inbox + 事件游标 + 重放测试(对应 PoC 验收 ③④⑤) |
| 独立 acceptance oracle | verify 白名单 + 与 Brain 无关的闸门判定(不让生成方自评通过)。**+ verify 内容冻结(安全复核 S3)**:白名单只冻结模板名不够——`package.json`/`Justfile` 是 agent 可写且不在 `projectSnapshotDigest` 内,改 `scripts.test` 即①命令注入②闸门恒绿(false-complete);dispatch 时冻结解析后 argv + 脚本内容 digest,执行前重校,不符 ⇒ fail-closed;agent 合法改 test 走 Plan Delta 重授权 |
| secret/egress 隔离 | agent 环境剥离凭据、`.env` 读取升 S2+、网络出口**按适配器如实声明**(cursor_cli 后端:hooks 只覆盖 shell 通道,内建 Read/web 工具读 `.env`/出网拦不住 ⇒ 能力表标 `egress=uncontrolled`、禁 `network_fetch` 类预授权,G4 证据**按后端分行**、不出"绿"掩盖不可控)。**+ setup 供应链脚本(安全复核 S4)**:建 worktree 缺省 `--ignore-scripts`(或沙箱),确需 lifecycle scripts 时按 S2 presentation 念 target+下游、签单次收据 |
| canonical intent 审计 | 转写 + 任务卡 + 审批收据的三方留痕链(谁说的→签了什么→执行了什么) |
| 删除/同意传播 | 用户显式 forget 的硬删通路 + 录音/转写分别同意(04 §1.3) |

### P0(约 21–27 工程日;唯一工期口径见 IMPLEMENTATION-PLAN,不含回修/owner 场次/评审):单 agent 全闭环

- 级联语音引擎(ASR 已定档火山 sauc,**P0 语音输入 = PTT 松手后整段识别,不承诺 `asr.partial` 实时字幕**——实时分片流式 P1,工程 ADR-101 2026-07-24;文本 LLM + 流式 TTS);音频用耳机/PTT 起步(绕开外放 AEC);显式轮次按钮
- voiced daemon:任务卡状态机、单队列、SQLite/JSONL 落盘、启动对账、电源断言
- ClaudeAdapter(**本段当时规划为 SDK streaming**;已由 2026-08-21 的 `claude -p` + `PreToolUse` hooks 现行路径 supersede)或走窄闭环 PoC 直连 Hopper(两条路径分别按各自 steer 语义验收,不共享"无条件闭环")
- **执行模式两档(Tier 1)**:逐步确认 = 现状缺省语义命名化;直达验收 = 决策包预授权清单(04 §5.4;Gate 0 不豁免);Tier 2 的逐步确认(步序循环,C2 自建)排 P1
- 失控防护:verify 白名单、任务三熔断
- **最小可信记忆**(与 04 §1.3 对齐,不是"只读预研":)immutable 转写/证据 + append-only 记忆事件账本与派生视图 + 只收"用户确认的决定/机械 repo 事实"的 M1 + source-bound Context Pack + delete 测试;自动 consolidation/丰富召回留 P1/P2
- Context 预研器(轻量版):派单前只读预研,概览注入 Context Pack(**不可砍**)
- 采访式澄清 instructions + 摘要器(one_liner + walkthrough)
- **review 面(最小版)**:按验收标准组织的证据视图(diff/测试结果/decisions[]/未验证项标记)——review 是异步执行的真实瓶颈,不留 P1;**路径二任务的证据主体直接嵌 Hopper 自包含 trust-report HTML**(`20-Runs/Summaries/<runId>.html`,零外链单文件,RunSettled.summary_path 定位,iframe 直读不经 Console/token,Hopper 反馈 §4.3)——自建部分收敛为 AcceptanceCheck 对账条 + Tier1 路径视图
- 回叫:在线语音回叫 + 桌面通知 + ntfy;审批 S0–S2(S3 一律拒绝并提示屏幕/终端)
- **验收**:完成 01 §5 故事一的完整闭环(终态口径 = `ready_for_review`,合并仍人触发),全程除 S3 审批和点击开麦外不碰键盘;Brain 澄清时能引用代码库事实;Gate 0 六项全部关闭
- **P0 保证(应急场景兜底)**:Quick 车道对**已奠基项目**不强制重研究——"就做 X、现在"这类明确指令即刻派单,不因采访/奠基姿态阻塞(专用应急车道排 P1)

> **盲区场景表态(owner 2026-07-23)**:① **无障碍 / 纯文字模式 = 非目标(P0)**(owner:不重要;但不架构性封死——文字轮次通道若 P1 做时再开,P2+ 视需要);② 应急车道、③ 回叫聚合 = P1(P0 各有上述兜底,见 P1 列)。

### 提前批(owner 2026-07-25 拍板:六项自 P1/P2 提前,执行器批收口后立即排产)

> 前置 = Tier1 生产执行器批收口(场次②③④解锁);实施交接 = `plan/IMPL-PROMPT-5-PULLFORWARD.md`。原分期行已逐条标注"已提前",未提前的部分(如 T2 原生外壳)留在原阶段。

| # | 项 | 原分期 | 范围口径 |
|---|---|---|---|
| 1 | launchd 常驻(07 D17) | P1 | daemon 开机自起 + 崩溃自启;菜单栏仍 P2 |
| 2 | T2 薄版切片 | P1 子集 | Tailscale 组网 + 手机浏览器 console(响应式已有,11 §4)+ ntfy 深链;**原生外壳/PushKit/CallKit 仍 P1**;S3 语义不变(手机浏览器不放行 S3) |
| 3 | S3 屏幕审批卡 | P1 | **合同已落(R-A 2026-07-26,09 §3.3)+ 已实施(W4 2026-07-27:v9 迁移/四工具/验签核/守卫/console 卡/§12-13 反例 32 例;requestManualMerge 降级路径保留)**;真人过卡待 owner 触点 |
| 4 | M1 奠基完整版 + 记忆生长闭环 + AGENTS.md 互通 | P1 | foundation manifest + generation 切换 + 会后提炼闭环;consolidation 提名仍人工批(自动化留 P2) |
| 5 | writing 窄版(02 §5.0) | P2 子集 | **合同已落(R-A 2026-07-26,worktree 交付)**:09 §6.1a 执行合同 + §3.3 合并链复用 + WritingSettleProof + content_done;引用级引证合同/归属合同/parentProjectId lineage 全量仍 P2(R-C)。**已实施(W4 2026-07-27)**:七项开值前置与 readback B-3 已收口；产品缺省仍 coding-only，本机 effective 已按 owner 授权打开 writing，现值见 HANDOFF/journal |
| 6 | VAD 免手对话 + 语义 EOU + AEC 外放 | P1 | 10 §4 三层轮次 + 03 §3 baseline 口径;`asr.partial` 实时字幕不在内(仍 P1) |

### P1(+3–4 周):三 agent + 移动端 + 体验补全

- Codex/Cursor 以 Tier 2 接入;~~VAD 免手对话 + 浏览器 AEC 外放~~(**已提前**,§4 提前批 #6;按 03 §3 的 baseline 口径验收)
- ~~S3 屏幕审批卡片~~(**已提前**,§4 提前批 #3,合同先行)、~~`open_on_screen` 打通编辑器、decisions[] 摘要层~~(**后两项已随 W5a 交付**,2026-07-27,PLAN-2 5.1;11 §5.5/09 §13 已标)
- 多任务并行(跨仓库)+ 合并冲突状态机、共享黑板显式化;一句话拆多任务(候选任务分组确认后才 dispatch)
- **回叫 digest / 聚合**(盲区表态,owner 2026-07-23):多任务并发后同时 blocked/ready 的回叫聚合成一条摘要,防"召回风暴";**P0 兜底 = 通知优先级排序 + 输出仲裁**(单仓串行下风暴罕见,足够),完整聚合排本阶段
- **应急 / 事故车道**(盲区表态,owner 2026-07-23):生产事故时的"直接派单、跳过采访姿态"专用车道;**P0 兜底 = Quick 车道对已奠基项目不强制重研究**(见 §4 P0 保证),专用车道排本阶段
- **T2 移动形态**:Capacitor 原生外壳 + Tailscale 连接 + PushKit/CallKit 回叫(来电式汇报)——**薄版切片已提前**(§4 提前批 #2:组网 + 手机浏览器 + ntfy 深链);原生外壳/CallKit 留本阶段
- ~~记忆:M1 奠基完整版(foundation manifest + generation 切换)+ 生长闭环 + AGENTS.md 互通~~(**已提前**,§4 提前批 #4)

### P2(按需):增强、私有化与通用化

- S2S 引擎(Realtime)作增强选项;全本地语音栈(MLX);唤醒词常驻
- 远程语音回叫(SIP 呼入为主);Codex app-server 交互审批评估
- 主动巡检;项目类型抽象 + 统一产物库(场景 3 接入 research/writing/marketing/general 执行器;writing=正式文章/论文,就绪清单与特有纪律见 02 §5.0;**writing 窄版已提前**,§4 提前批 #5)。**接入前须补齐非 coding 执行合同**(Codex 18 评审 A-4 登记;窄版所需子集随提前批合同轮先行):类型能力门禁开值、完成态判别与话术(09 §13 `explainResult` 已有 `content_done` 窄版值,其余类型判别值待全量)、内容评审收尾边(09 §6.1a 已落 writing 窄版,其余类型待全量)、writing 的 settle proof(文章 artifact digest / 引用覆盖 / 逐节停靠)与引用级引证合同、观点归属合同、类型演化语义(~~§6-7~~ 已拍板:派生子项目)
- T3 服务端执行;记忆生命周期治理完整版(自动 consolidation/审计/衰减)
- 多人/会议旁听 **discovery**(合规/说话人分离/授权模型预研 + 被动旁听实验)

### P3(愿景):对话驱动的项目协作平台

- 场景 2 全流程(planning 类型:采访 → 文档体系 → 协同审阅 → 批准 → 拆任务批量派单 → 实施)
- 非技术用户模式;文档协同审阅界面;多人/会议旁听**产品化**

### 价值证据轨(dogfood 期 · 建议性零阻塞 · owner 2026-07-24 采方案 B)

> 目的:不改 v2.3 范围、不设 stop/go 门,用近零成本证据回答"SayDo 是否真省注意力/少返工",喂给 §6 未决项与 P1 优先级。指标**全部从既有表 SQL 出**(09 §9 DDL),挂已有的 owner 场次②(Phase 4 出口 dogfood gate)与 P0.5 收尾 readback;**建议性、不阻塞任何 P0/P0.5 步骤**。

- **双北极星(proxy 口径;未升 canonical——待数据验证严格定义)**:① verified outcome rate = 独立验收通过数 / 全部 eligible dispatch(含 failed/cancelled/停靠老化,intent-to-treat 防幸存者偏差);② 主动人类分钟 / verified outcome(说+打字+判断+审批+review+失败返工全进分子;P0 用代理:会话语音时长 + 审批时延 + review 跨度 + 每任务一行自报)。目标"非劣基线 + 分钟下降",**界值 owner 看数据前预留、不预设**。
- **零新建设周报指标**(SQL 出自 tasks/tier1_runs/decision_packages/approvals/readiness_assessments/callback_outbox/cost_entries/memory_events/audit_log):first-pass acceptance / 返工率(attempt>1)、包修改率(revision>1)、readiness shadow 样本 + outcome 分布(false-ready 原始计数)、回叫接通率 / ack→resolve、time-to-dispatch、每 outcome 成本(api)+ 订阅次数、无派单但经确认沉淀占比、S2 次数/任务、误听纠正次数、车道(Quick/Guided/Explore)占比。
- **近零埋点**(随所在 Phase 顺做):sessions 记 lane;采访问题落"目标字段"标签(→无效问题率,04 §2.1);dogfood 登记表两个手工字段(主动分钟自报 + "适用机会用没用/弃用原因"=自发选择率)。
- **review 检错仪式**:dogfood 期 3–5 个任务植入已知缺陷(行为偏差/漏测/越界副作用),记录 `AcceptanceCheck` 证据视图是否让 owner 发现——检验"review 是瓶颈"判断的唯一直接手段。
- **诚实阅读纪律**:小样本(n=1、几十任务)不外推 `<1%` false-ready、不外推安全声明。

**完整 E1/E2 实验机器登记为 P1 触发项**(非工作量问题,而是 n=1 / 文字通道=P0 非目标下测不出或冲突,故诚实推迟):≥200 条分层 readiness/安全 replay corpus、三臂 intake 消融、外部 3–5 用户行为轨、预注册非劣检验/盲评——**触发 = 出现第二用户 或 对外发布前**。

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 中文+代码术语混说 ASR 误听 | 术语热词注入(实证 +10 点召回,工程 ADR-101)+ 用户纠错事件驱动(10 #8/#9;连续误听降级打字)+ 显式轮次;**低置信复述仅当 provider 回 confidence 时启用**(定档 sauc 不回,10 #7);300–500 条 golden 回归集由 dogfood 真实误听积累 |
| 相关错误链(奠基污染 → 错误决策包 → 自动化偏信) | readiness 与生成/执行解耦、独立 evaluator、记忆写路径审核(04 §1.4/§2.3) |
| 无人值守烧钱/危险命令 | 三熔断 + verify 白名单 + S3 强认证 + delivery preflight |
| Hopper 平台化时间线(M3b/M3d 未实现) | 先按现状 task 粒度集成;steer 降级 kill_and_resume 并如实告知;唯一所有权矩阵先行(ADR) |
| 三家 CLI/SDK 事件格式演进快 | 能力运行时探测 + 契约测试;适配层借 spawner/ai-ide-cli 模式 |
| agent 长任务质量不可控 | 验收标准强制、decisions[] 上浮、review 人工把关、独立 verify |
| 隐私(always-on 麦克风 / 持久记忆) | 默认不常听;记忆本地存储、trust 分级、删除传播 |
| 浏览器授权/自动播放限制导致回叫失败 | 探测失败自动走通知链路;首次使用引导授权 |

## 6. 未决事项(归 owner)

> 注意与 Gate 0 的区分:下面是**商业/产品取舍**,归 owner 拍板;工程安全门禁不在此列(它们已进 §4 Gate 0,不做就不能开自主 dispatch)。

1. **产品载体路线**(§2):独立产品 / 并入千手 / 薄遥控器?——商业取舍;拍板后如需另出**设计 ADR-003**(仅覆盖载体与部署组合,**不 supersede 设计 ADR-001 的执行层决策**)。
2. **奠基"足够"的判定门**:首次奠基可能要等几分钟,到什么程度可开聊,需真实体验校准。
3. **收敛的度**:何时主动收敛 vs 让用户继续发散,需真实对话数据调。
4. **review 面的形态深化**:P0 已含最小证据视图(§4);"手机 diff + 语音 resume"等移动 review 形态做多深、何时做,归 owner。
5. **多人/会议旁听**的推进节奏(现定 P2 discovery / P3 产品化;合规门槛高)。
6. **亮点脑暴的取舍**:`../research/highlight-features-brainstorm.md` 的 80 条候选挑哪些进正式设计。
7. ~~writing 类型演化语义~~ **已拍板(owner 2026-07-25 晚)**:`Project.type` 不可变 + 派生子项目(`parentProjectId` + artifact lineage,母项目不改型不作废;02 §5.0 已回写,09 §1 留注);合同细则(lineage 字段/旧产物重验)P2 随 writing 执行器接入时落 09。
