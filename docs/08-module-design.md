# 08 · 分模块设计(Module Design)

> 状态:**初版(proposed)**——目的有二:① 把 [03 · 架构](03-architecture.md) 的概念组件落到可开工的模块边界与接口契约;② 作为"反向校验器"——用模块视角回查整体文档,发现的问题与回改记录见 §7。粒度到"模块职责 + 关键接口 + 依赖 + 分期",不到类/函数级。
>
> **分域详设(2026-07-24 补充,实施与核对入口)**:每模块的七栏详设(职责边界/接口引用/设计要点/依赖/失效恢复/§12 测试归属/计划步骤映射)拆在 `modules/` 五份文档——[A 对话域](modules/a-dialogue.md) · [B 记忆域](modules/b-memory.md) · [C 控制面桥](modules/c-control-bridge.md) · [D 呈现域](modules/d-presentation.md) · [E 横切域](modules/e-crosscutting.md)。本篇保留总表/依赖图/信息架构与回改记录;**详设只引用 09/10/11 不复制合同**,冲突时 canonical 胜。视觉与交互合同见 [11 · UI 规范](11-ui-spec.md)。
>
> **[warn] 当前交付分期以 `plan/IMPLEMENTATION-PLAN-2.md` 为准**;`plan/IMPLEMENTATION-PLAN.md` 仅保留 2026-07-23 首发裁决的历史出处。首发 = 完整双路径，P0/P0.5 是阶段序号不是两次交付;本篇模块表的"分期"列早于该切分——**C1/C3(Hopper 桥)、Demo、Hopper usage 属 P0.5 阶段(首发后半程)**;§6 信息架构中 Hopper 相关页同理。P0 阶段只落 Tier 1 相关模块(见计划模块归属)。

## 1. 进程拓扑(P0 / T1 单机)

```
┌───────────────┐  WS(音频帧↑ / TTS句↓ / watermark事件)  ┌──────────────────────────┐
│ voice-pipeline │◀──────────────────────────────────▶│                          │
│ (Python/Pipecat│                                     │   voiced daemon (TS/Node) │
│  无状态,可重启) │                                     │   唯一 durable 状态持有者   │
└───────────────┘                                     │                          │
┌───────────────┐  HTTP/WS(页面/事件推送)               │  A 对话域 · B 记忆域        │
│ 浏览器控制台     │◀──────────────────────────────────▶│  C 控制面桥 · E 横切        │
└───────────────┘                                     └───────┬──────────────────┘
┌───────────────┐  SDK 进程内(Claude)                          │ drop / CLI / 文件事件
│ agent 子进程    │◀────────────────────────────────────────────┤
└───────────────┘                                     ┌───────▽──────────────────┐
                                                      │ Hopper(执行后端,独立进程)  │
                                                      │ worktree/闸门/events.jsonl │
                                                      └──────────────────────────┘
```

原则(承 03 §1):daemon 是对话域唯一 durable 状态持有者;voice-pipeline 与浏览器页随时可死;执行域状态归 Hopper,跨域只走 §5 的合同。

## 2. 模块总表(5 个子系统 + 横切)

| # | 模块 | 一句话职责 | 分期 |
|---|---|---|---|
| **A 对话域** | | | |
| A1 | 语音管线(voice-pipeline) | VAD/流式 ASR/分句 TTS/打断(playout watermark),经 WS 契约与 daemon 通信 | P0 |
| A2 | 会话管理器(SessionManager) | 会话生命周期:建立(注入 Context Pack)/挂起/重建/超时;跨引擎(级联/S2S)统一 | P0 |
| A3 | 对话引擎(ConversationEngine) | 调三档模型(07 D3)、工具路由、口播话术、过渡语;**不做就绪判定** | P0 |
| A4 | 采访策略(InterviewPolicy) | 问题选择(覆盖扫描 + Impact×Uncertainty)、一次一问/选项优先、**问题预算与停止策略(代码层)** | P0(简版) |
| A5 | 就绪评估器(ReadinessEvaluator) | **独立于 A3**:异族模型 + 规则引擎,只读证据账本判四维就绪;critical 硬门槛;shadow 记录供校准 | P0(双维+critical 规则)/P1(四维+校准) |
| A6 | 决策包工厂(DecisionPackageFactory) | 生成三件套(成果预览/计划含人机分工/Demo),计划落盘为可编辑 artifact,package 版本与 digest | P0 |
| A7 | 意图与转写存证(IntentLedger) | canonical intent 链:逐轮转写 + 任务卡 + 审批收据三方关联,"谁说的→签了什么→执行了什么"可追 | P0(关联视图)/P1(独立账本) |
| **B 记忆域** | | | |
| B1 | 上下文编译器(ContextCompiler) | 确定性编译 Context Pack:来源优先级/冲突与撤销规则/各层 token 预算/taint 过滤/pack digest 与版本 | P0(最小规则集) |
| B2 | 记忆账本(MemoryLedger) | append-only memory_events + 派生 current_projection;candidate→trusted 写路径;删除传播 | P0 |
| B3 | 奠基器(FoundationBuilder) | 项目奠基与会话预热;foundation manifest + generation 原子切换;AGENTS.md 双向互通 | P0(轻量)/P1(完整) |
| B4 | 产物库(ArtifactStore) | M2 全程写入、版本/lineage/supersedes、时间线与版本 diff、子集导出 | P0(写入+版本)/P1(控制面) |
| B5 | 检索(Retrieval) | FTS5(中文分词按 07 spike 定)+ live `rg` 组合;provenance/freshness 硬过滤 | P0 |
| **C 控制面桥** | | | |
| C1 | 任务卡渲染器(TaskCardRenderer) | DecisionPackage → Hopper drop 格式(现状 task 粒度);verify 白名单绑定 | P0 |
| C2 | 执行客户端(ExecutionClient) | drop / 状态查询 / cancel;能力探测(steer 可用性按运行时,不按型号) | P0 |
| C3 | 事件消费器(EventConsumer) | 消费 events.jsonl:游标 + gap/损坏行处理 + 重放幂等 + **settle barrier**(等闸门/产物落盘对账) | P0 |
| C4 | 回叫引擎(CallbackEngine) | PagerDuty 式升级链状态机、durable outbox(重启只叫一次)、免打扰/输出仲裁 | P0 |
| C5 | 审批服务(ApprovalService) | 两类审批(dispatch 包审批 / 运行中 effect 审批)、digest 绑定单次消费 receipt、超时默认终局、落盘可恢复;**执行模式策略承载点**(两档的 S2 姿态差异全在此,04 §5.4) | P0 |
| C6 | 摘要器(Summarizer) | 规则统计(实时免费)+ 模型叙事(惰性);one_liner/walkthrough/decisions[] | P0 |
| C7 | 对账与恢复(Reconciler) | 启动对账(孤儿进程/中断任务)、delivery preflight、电源断言 | P0 |
| C8 | 成本账本(CostLedger) | 全链:对话(ASR 分钟/token/TTS 字符)+ 执行(Hopper usage 读取);estimate→budget→actual | P0(记账)/P1(表盘) |
| **D 呈现域** | | | |
| D1 | Web 控制台(Console) | 页面结构见 §6(与 Demo HTML 一致):全局区(Dashboard/审批/通知/成本/设置)+ 项目区(对话/任务/记忆/产物/项目设置)+ 项目切换器 | P0 |
| D2 | 移动外壳(MobileShell) | Capacitor + 薄原生模块(PushKit/CallKit/AVAudioSession);连接走 Tailscale/中继 | P1 |
| **E 横切** | | | |
| E1 | Provider 抽象(ModelProviders) | 三档模型 + ASR/TTS 供应商可换;超时/重试/降级;模型名进配置;**双供给后端 api(含 `[providers.api.*]` 三方命名端点)/ agent_cli(BYOA 订阅复用:codex/claude/cursor,07 D18;适配器改造自 OctoDesk bridge 四件套)** | P0 |
| E2 | 安全策略引擎(PolicyEngine) | **effect-based 风险计算**(S0–S3):effect×目标×数据×身份×下游触发×成本;verify 白名单校验 | P0 |
| E3 | 审计与可观测(Audit/Obs) | 结构化日志(JSONL)、审计 sink(不记 payload 原文的敏感部分)、指标 | P0(日志)/P1(指标) |

## 3. 模块间依赖(允许的方向)

```
A1 ⇄ A2(WS 契约)          A3 → A4/A6(策略与工厂)     A3 ⇢ B1(要 Context Pack)
A3 →(工具调用)→ C1..C6     A5 ⇠ 只读 ⇠ A7/B2(证据)    A5 ⇏ A3(评估器不受 Brain 影响)
A6 → B4(计划落盘)          B1 → B2/B4/B5(取材)         B3 → B2(奠基产物入账本)
C1 → E2(风险标注)          C2/C3 ⇄ Hopper(合同 §5)     C3 → C4/C6(settle 后才触发)
C5 → E2(等级计算)          C4/C5 → A2(需要重建会话时)   全部 → E1/E3
```

三条硬规则:① **A5 只读证据、不读 A3 的自辩**,且与 A3 用不同模型家族(防相关错误链,04 §2.3);② **C4 只消费 settle 后的状态**,不消费原始事件(防假完成,04 §4);③ **A3 无执行权**,一切副作用经工具 → C 层命令服务(03 §1 铁律)。

## 4. 关键接口契约(签名级草案)

> **状态说明**:本节是模块视角的**草图**;字段级 canonical 合同(含 EffectGrant 约束、收据终局、取消状态机、投影映射、DDL)以 [09 · 数据契约](09-data-contracts.md) 为准,两处冲突时 09 胜。

```typescript
// A1⇄A2 语音管线 WS 契约(双向 JSON 帧 + 二进制音频)
type PipelineMsg =
  | { t: "audio.frame"; seq: number; pcm: ArrayBuffer }          // 上行
  | { t: "asr.partial" | "asr.final"; text: string; turnId: string }
  | { t: "tts.say"; sentenceId: string; text: string }            // 下行
  | { t: "tts.playout"; sentenceId: string; watermarkMs: number } // 已播进度(打断截断依据)
  | { t: "barge_in"; atMs: number }
  | { t: "turn.done_speaking" };                                  // 显式轮次按钮

// A6 决策包(canonical schema 的 P0 最小集,字段清单对齐 04 §2.4 缺口声明)
interface DecisionPackage {
  id: string; revision: number; digest: string; supersedes?: string;
  outcomePreview: string; inScope: string[]; outOfScope: string[];
  assumptions: Claim[];                    // 每条带 source/confidence/critical
  acceptance: string[];                    // 验收标准(review 证据视图按此组织)
  plan: { step: string; owner: "ai" | "human" }[];
  demoRef?: ArtifactRef;                   // 与实现同源,元素与 plan 编号互引
  cost: { expected: number; p95: number; max: number };
  risks: string[];
  mode: "direct_to_review" | "step_confirm";   // 底层两档 schema 保留(04 §5.4);现役仅 step_confirm。direct_to_review=designed/deferred(PG-01B,D3 未签),拍板不可选
  preauthorizedEffects: EffectClass[];         // 直达验收档预授权清单(designed/deferred);现役逐步确认恒空——必须可朗读、随包签署
}

// 预授权效果类:由 E2 从计划推导,Brain 不得自由声明;无约束参数的效果类不可预授权
interface EffectClass {
  classId: string;                          // 如 "install_dependency" / "push_branch"
  constraints: Record<string, string>;      // 如 {registry:"npm", packages:"papaparse"} / {branchPattern:"saydo/T-0042-*"}
  spokenForm: string;                       // 念读文案(类别+关键约束);digest 绑全量参数
}

// C5 审批(两类,不共用 approved=true)
// 注:类级预授权是 DecisionPackage 的属性(随 package digest 生效至 supersede/过期),不是可消费收据;
//    运行中每次命中落一张单次消费的实例子收据(Tier 1 执行点复验;批式路径事后从事件流回填,见 04 §5.4 诚实注记)。
interface ApprovalReceipt {
  kind: "dispatch_package" | "runtime_effect";
  refDigest: string;                        // package digest 或 effect payload digest
  parentPackageDigest?: string;             // runtime_effect(preauthorized)必填:父包引用
  effectClassId?: string;                   // 同上:命中的效果类
  riskLevel: "S0" | "S1" | "S2" | "S3";
  decidedVia: "voice" | "screen" | "push" | "preauthorized"; // S3 只允许 screen(已认证)
  singleUse: true; expiresAt: string;
  decision: "accept" | "edit" | "respond" | "ignore";        // 与 04 §5.2 四动作词表一致
  outcome?: "consumed" | "timeout_rejected" | "voided_by_conflict"; // 终局:消费/超时默认拒/他端已决策作废
}

// C2/C3 跨域合同(执行域边界,owner 见 03 §1 所有权矩阵)
interface DispatchEnvelope { taskCardId: string; packageDigest: string; idempotencyKey: string; }
interface ExecutionEvent  { cursor: string; type: string; payload: unknown; }   // 消费侧幂等
type SettledState = "ready_for_review" | "blocked" | "failed";                  // 回叫只认这三个

// B2 记忆事件(真相源;Markdown/索引是投影)
interface MemoryEvent {
  id: string; ts: string; op: "add" | "invalidate" | "correct" | "forget";
  tier: "M0" | "M1" | "M2" | "M3";
  claim: string; source: SourceRef;        // provenance 必填
  trust: "user_stated" | "user_approved" | "auto_low_impact" | "candidate";
  taint?: string[]; expiresAt?: string;
}

// B1 Context Pack(确定性编译产物)
interface ContextSnapshot {
  packDigest: string; compilerVersion: string;
  repoHead?: string; memoryGeneration: number;
  slices: { tier: string; refs: string[]; tokens: number }[];  // 各层预算与来源
}
```

## 5. 跨域合同与所有权(与 Hopper 的边界)

| 状态 | owner | SayDo 侧动作 |
|---|---|---|
| 任务执行状态 / events.jsonl / worktree / 闸门 | Hopper | 只读消费(C3),经 settle 对账 |
| dispatch 意图 / 决策包 / 审批收据 / 回叫 / 会话与记忆 | voiced daemon | 唯一写方 |
| 运行中 effect 审批(DecisionRequest) | 目标态归 Hopper(其 M3c);P0 由 C5 以"预授权 + Tier 1 SDK 回调"代替 | 落盘 receipt,执行点复验 |

P0 现实(05 §1):Hopper 的 DecisionRequest/NotificationIntent/Command/workflow 只有 schema——C3/C4/C5 是 SayDo 自建运行时,schema 尽量对齐 Hopper 定义,等其 M3b(command/decision enforcement)/WS4(通知面)落地后可平移;能力按运行时握手判断,不按里程碑名。

### 5.1 路径二(Hopper)的进度可见性与操作归属(设计 ADR-001 定稿)

**用户日常全程留在 SayDo;Hopper Console 是工程排障面。** 看 = 消费 `events.jsonl` 做用户语言投影(粗阶段条 + 事件时间线;诚实进度:阶段 + 当前活动 + 已花预算,不做假百分比;**retry 默认复用 worktree、base 落后只告警——进度展示对 retry 轮注明"在原快照基础上继续",不谎称已含主分支最新**;P1 切 Console 只读投影 API/SSE)。操作 = 全部在 SayDo 发起,翻译成 Hopper 官方写入口(幂等 + `origin=saydo-bridge`):取消→cancel;改需求→cancel+重 drop 修订卡(Brain 如实说明本轮作废);答 blocked→unblock+答案;验收→review decision(approve 附 S3 收据);合并由 Hopper 执行;diff/日志全文深链 Hopper Console。**双入口防 split-brain**:决策真相源 = Hopper 状态机(先到先得、二次幂等拒绝、记录 decision origin),SayDo 的审批收据是授权留痕不是第二份状态。完整表格见 [设计 ADR-001](adr/design/ADR-001-execution-layer.md)。

## 6. 控制台信息架构(D1,= Demo HTML 的结构;v2 按"全局 vs 项目"分区)

> **2026-08-08 修订(三面一栏 IA,console 重构方案 v2 §4+v4 收口,四轮对抗审后放行)**:主轴由 project 倒置为 Focus(project 降为承载边界资源);目标侧栏树=`[开口聊]主 CTA / 今天(徽章=attention 橙区,唯一"需要你"入口)/ 全景看板 / 正在持续的事(空间分组)/ 记录(记忆库·产物库·成本·设置)`;下表旧 IA **分批退役、先立后破**(批次②新树上线旧页降权入「旧版」折叠组→③d 起 Dashboard/Approvals/Notify/Focuses 退栏→④ Tasks/TaskDetail 退栏(由 #/review 验收面承载)→⑤删除文件与重定向)。14 页去向映射与 15 项功能承载对账表见方案 v2 §4-§5(OctoAgent docs/product/2026-08-08-console重构方案-v2.md);canonical 路由新增 `#/today`、`#/review/:tid`、`#/records/:fid`、`#/chat-new`;旧深链兼容矩阵按目标页 readiness 分批启用。批次⑤收口前,下表描述的旧 IA 对未迁移页面仍有效。
> **进度对齐(2026-08-09)**:新 IA 已全量上线(今天页/Focus 对话页/验收面/看板/记录页+接线);旧页保留于侧栏「旧版」折叠组与 #/legacy/* 路由,**文件删除与重定向矩阵移除(原批次⑤收口项)尚未执行**——留待 dogfood 稳定后收官。

**侧栏结构**(原则:账要全局记、看要就地看——只有"必须跨项目聚合才不误事"的才设全局页):

```
SayDo(logo → #/)
[项目切换器 ▾]        当前项目名 / "未选择项目";下拉 = 项目列表 + 「+ 从本地文件夹添加」
── 当前项目(随切换器切上下文)──
  对话 / 任务 / 记忆库(M1–M3)/ 产物 / 项目设置
── 全局(不受项目切换影响)──
  Dashboard / 审批中心 / 通知 / 成本 / 全局设置
顶栏:语音会话指示器(锚定项目 + 状态,切导航不断会话,点击跳回)· 通知铃 · 免打扰开关
```

| 路由 | 页面 | 归属 |
|---|---|---|
| `#/` | **Dashboard(主入口)**:开始区(「开始新对话」/「选择项目继续」;冷启动为 Hero 态)+「待你处理」聚合条(待验收/待审批/未读回叫,跨项目直达)+ 项目卡网格 | 全局 |
| `#/p/:id/chat` | 对话页:转写流(内联「就绪复述确认卡」:candidate 未确认不算 covered,确认后形成 confirmed ReadinessBinding)+ 右栏「任务卡草稿 + 就绪绑定」+ 决策包卡(现役仅逐步确认,无直达档 selector;direct_to_review=designed/deferred);内含会话历史(续接入口) | 项目 |
| `#/p/:id/tasks` | 任务看板(队列/执行中/等验收/已交付;熔断与预算进度) | 项目 |
| `#/p/:id/task/:tid` | 任务详情 = review 证据视图 → 合并(S3 屏幕强认证);内嵌该任务审批记录 | 项目 |
| `#/p/:id/memory` | 项目记忆(M1–M3;M0 用户档案在全局设置) | 项目 |
| `#/p/:id/artifacts` | 产物库(版本 lineage、召回) | 项目 |
| `#/p/:id/settings` | 项目设置(工作区、类型、setup 命令、verify 白名单、执行模式默认;P1 模型/预算覆盖) | 项目 |
| `#/approvals` | 审批中心(**全项目聚合**,每卡必带项目/任务上下文,支持项目筛选) | 全局 |
| `#/notify` | 回叫与通知时间线(升级链是 daemon 级机制,天然全局;可按项目筛选) | 全局 |
| `#/cost` | 成本账本(按项目分组下钻;任务级预算嵌在任务页) | 全局 |
| `#/settings` | 全局设置(引擎、**五槽位模型配置〔对话/沉思/廉价/评估/开发〕**+ 供给方式〔api/订阅 CLI BYOA,07 D18〕、评估器异族校验、预算默认、免打扰、审批说明、M0 用户档案) | 全局 |

关键语义:① 项目切换 = 替换路由 `:id`,项目区同名页切换、无法映射的页回退到该项目 tasks,全局区不动;② **切导航不断语音会话**(顶栏指示器承载,要和 B 项目对话需显式开麦,A 会话按挂起规则处理);③ 无项目选中时项目区置灰,引导回 Dashboard;④ project 实体**开口即建 draft**(占位名,AI 识别后回填,不出建项表单),支持 re-anchor 到已有项目;⑤ 原独立"项目列表页"取消,并入 Dashboard。

## 7. 反向校验:模块设计倒逼出的整体文档回改

> 这是本篇的第二个目的:按模块拆完再回看 01–07,发现以下问题并**已回改**(标 [ok])或**记录为待办**(标 [todo])。

| # | 发现 | 影响 | 处置 |
|---|---|---|---|
| R1 | **就绪评估器在 03 组件表里缺位**:04 §2.3 已立"判定与生成解耦"原则,但 03 的组件职责表只有 Brain,没有承载这条原则的组件——不单列模块,实现时必然写回 Brain 内部,原则落空 | 架构 | [ok] 03 §2 组件表补"就绪评估器(独立)"行;03 §4 工具表 `assess_readiness` 加注"Brain 只发起,判定由独立评估器执行" |
| R2 | **安全策略引擎缺位**:04 §5.1 说风险"由效果计算",但没有任何组件负责这个计算——按动作名硬编码的风险就是在这里回潮的 | 架构/安全 | [ok] 03 §2 组件表补"安全策略引擎(effect-based)"行 |
| R3 | **成本账本有机制无组件**:04 §3 要求全链账本,03 无落点 | 架构 | [ok] 03 §2 组件表补"成本账本"行 |
| R4 | **决策包的 Demo 是谁生成的没有归属**:02/04 都讲 Demo 三件套,生成职责悬空 | 架构 | [ok] 归入 A6 决策包工厂(本篇);03 组件表 Brain 行加注 |
| R5 | **语音管线 WS 契约此前只有一句话**(07 D2"统一 WS 契约"),watermark/打断语义没有接口载体 | 选型/实施 | [ok] 本篇 §4 给出契约草案;07 无需改(D2 的 spike 判定条件不变) |
| R6 | **IntentLedger(Gate 0 的 canonical intent)P0 形态待明确**:05 Gate 0 要"三方留痕链",但没有说 P0 是独立表还是关联视图 | 安全/实施 | [ok] 本篇 A7 明确:P0 = 转写+任务卡+审批收据的关联视图,P1 升独立账本;05 Gate 0 表述兼容,不改 |
| R7 | **定位/思路层面复查:无需调整**——模块拆解没有动摇"前脑+控制面桥+执行后端"三层、对话优先于指令、语音会话短命任务长命这三条骨架;反而验证了 03 §1 的所有权矩阵在模块级可执行(§5) | 定位 | 无需回改 |
| R8 | **技术选型复查:一处补充**——D1 控制台 11 个路由(带 `:projectId` 前缀的项目区 + 全局区),"Vite + React 单页"仍成立,但 07 D14 未提路由;属实现细节,记录不改 07。其余选型(Pipecat 暂定/三档模型/FTS5/自建审批表)与模块边界互洽 | 选型 | [todo] 实施期在 07 D14 补一句 hash/内存路由即可,不阻塞 |
| R10 | **(owner Demo 反馈轮新增)执行模式两档经评审落定**:模式是 dispatch 参数不是安全参数;预授权范围属决策包(所闻即所签),模式只是启用开关;S3/blocked/熔断/Plan Delta 与档位无关;墙钟改计活跃执行时间(独立 bug 一并修) | 机制/安全 | [ok] 已回改 04 §5.4/§5.1/§5.2/§4/§6、02 §2/§5、03、05、06 |
| R11 | **(同轮)信息架构按"全局 vs 项目"重排**:Dashboard 即首页(主入口两大动作+待处理聚合+项目卡);project 开口即建 draft(不出建项表单,支持 re-anchor);`projects.repo` 改 `workspace`(P0 本地文件夹,非代码项目系统管理);审批/成本/设置两层,通知全局,任务/产物/对话项目级;切导航不断语音会话 | IA/产品 | [ok] 已回改 §6 与 02/03;Demo 同步重排 |
| R9 | **02 的"边聊边长任务卡"呈现**:§6 信息架构把"任务卡草稿 + 就绪自省"放对话页右栏——这是 04 §2.2 证据账本的自然外显,与 02 §3"口播短、细节上屏"一致,不算新增功能;脑暴档里的同名条目(角度三 #8)属其加强版,仍待 owner 挑选 | 产品 | 无需回改(Demo 按此呈现) |

**结论**:反向校验发现的都是"原则有了、组件缺位"类问题(R1–R4 已回改 03),没有发现需要推翻的定位、思路或选型;架构三层与所有权矩阵经模块级推演仍然成立。
