# 三个本地项目借鉴评估(综合)

> 日期:2026-07-22。基于 3 个 subagent 对 `Hopper` / `OpenClaw-MultiAgent-Kit` / `OctoDesk`(Work Steward)的实读(读源码/文档/git,Hopper 还实跑了测试套件 1076 单测全过)。综合结论 + VoiceLoop 落地映射 + 对生态重定位(主方案 §13)的修正建议。**战略取舍归 owner;本文给证据与建议。**

## 0. 一句话结论

**三个项目一致证明:VoiceLoop 设计里"倾向复用而非自建"的整个下游(agent 适配器 / 任务流真相源 / 崩溃恢复 / 预算熔断 / 审批 / context 装配 / 回叫),你自己的项目里已经有可运行、测试全绿的现成实现——尤其 Hopper。VoiceLoop 应把自建范围收缩到三块独特能力(实时语音 / 奠基+分层记忆 / 采访+就绪决断),下游对接 Hopper 为执行底盘。** 这修正了 §13 一个盲点:之前说"重型后端 = OpenClaw(可选)",但 OpenClaw-Kit 的编排正被整体并入 Hopper——**那个"重型后端"的终局形态就是 Hopper**,而 VoiceLoop 文档集此前对 Hopper 零提及。

## 1. 三者定位与相互关系(关键:它们不是并列候选,有演进线)

```
OpenClaw-MultiAgent-Kit ──(编排能力整体并入)──▶  Hopper 统一自动化平台
（多 Agent 编排工作流,作者已冻结加码、迁出）      （交付验收 + 预算中枢 + 编排底盘;作者唯一在推的 program）

OctoDesk / Work Steward （另一条线:桌面工作台里的编排薄层,深耦合 Electron 基建）
```

- **Hopper**:本地不出网的"AI 代码交付验收流水线 + 跨厂商预算中枢",TS/Node≥22、MIT、`@octoooo/hopper` v0.1.0;drop→triage→compiler→调度→worktree→runner→四道验收闸门→人 review→merge;文件系统为真相 + 事件溯源 + 崩溃对账。**实测 1076 单测全过、真实 Claude runner 冒烟通过、活跃开发中**。正在把 OpenClaw-Kit 编排并入(M3a schema 已冻结合入 main)。→ [Hopper 调研](8e59d87e-fa01-4df8-adb5-7a96bfd12f68)
- **OpenClaw-MultiAgent-Kit**:基于 OpenClaw 自研的多 Agent 编排工作流(合同驱动派发 / append-only 账本状态机 / 三级恢复链 / 自适应质量门 / Spec Triad / Readiness Score / Genesis 大项目文档流程),真机踩坑反复加固;但单用户单机、深绑 `~/.openclaw` 运行时,**作者 2026-07-17 已裁决工程线增量全部流向 Hopper**。→ [OpenClaw-Kit 调研](a1d81346-e454-43ae-a222-570f46429815)
- **OctoDesk / Work Steward**:桌面工作台里的编排薄层(intake→understand→contextPack→draftWorkPlan→clarification→executionPlan→materialize),与 VoiceLoop"采访→就绪→决策包→派发"高度同构、坑踩得最透;但深耦合 OctoDesk 基建(capabilityIndex/ToolRuntime/DirectEngine/SQLite v109+),无可抽取库边界。→ [OctoDesk Work Steward 调研](52a154a2-884e-4654-b3db-ae1ef9225e49)

## 2. 逐项目结论(简明;细节见各 subagent)

| 项目 | 对 VoiceLoop 的角色 | 借鉴方式 | 能否当下游载体 |
|---|---|---|---|
| **Hopper** | **下游"复用而非自建"的现成自家实现** | **代码级直接复用**(runners/events/locks/recovery/usage/worktree/schemas)+ 部分改造(适配器要加流式+steer) | **可,且是首选**(同栈 MIT、测试全绿、作者在推);对接为"语音前脑 + Hopper 后端" |
| **OpenClaw-Kit** | 编排设计 + 数据结构 + 踩坑记录的"金矿" | **抄骨架不接身体**(合同/账本/状态机/回叫链/Spec Triad/Readiness/Genesis 规格);实现按 VoiceLoop 栈重写 | 短期 CLI 桥接可行,长期不建议(作者在迁出,终局是 Hopper) |
| **OctoDesk Work Steward** | 与 VoiceLoop 上游最同构的"已流过血的流水线" | 抄设计、搬契约、移植低耦合模块(contextPack.ts / ExternalAgentBridge 四 adapter / planRunner 判定表 / understand-clarification-planner 三段) | 无库边界不能当内核;可选路线 = VoiceLoop 做 OctoDesk 的语音入口(绑桌面形态) |

## 3. 跨三者的共识(独立验证了 VoiceLoop 方向)

1. **下游设计全部被印证且已有实现**:agent 适配器(三者都有:Hopper runners / OctoDesk ExternalAgentBridge / Kit helpers 直调 CLI)、任务流真相源+崩溃恢复(Hopper events.jsonl / Kit tasks.jsonl 都是 append-only+对账)、预算熔断(Hopper usage 中枢最完整)、context 装配防注入(OctoDesk contextPack / Hopper compiler 都把"任务正文是数据不是指令"做成硬纪律)、审批物化(OctoDesk EffectIntent + 反向 MCP / Hopper M3a DecisionRequest)。
2. **三者都没有 VoiceLoop 的三块独特能力**(实时语音 / 奠基+分层记忆 / 采访+就绪决断)——**零冲突**,再次印证自建范围应收缩到这三块。
3. **三者踩过的坑高度一致**,是给 VoiceLoop 的免费学费:失败必须一等可见(不能静默,OctoDesk/Kit 都因此翻过车)、"建成了≠用户可达"(有字段无消费者/内存态冒充持久态)、异步审批中断点必须物化持久(内存 Map 应用退出全 resolve false)、加第三个 runner 不是配置小事(Hopper 自食狗粮失败)、L3 自动外发/信任毕业制被独立否决(永远保留人批)。

## 4. VoiceLoop 落地映射(核心:每块下游 → 复用谁)

| VoiceLoop 组件 | 首选复用 | 备选/补充 | 改造点 |
|---|---|---|---|
| Agent 适配器(§4.4) | **Hopper `src/runners/`**(claude/codex adapter+executor+capability) | OctoDesk ExternalAgentBridge 四 adapter(ACP/StreamJson/CodexJsonl/OpenAICompat) | Hopper 是"单发+终报",VoiceLoop 需**流式 stream-json + 运行中 steer/answer**;会话内打断 |
| 任务流真相源 + 崩溃恢复(§4.8) | **Hopper events.jsonl + locks + recovery** | Kit tasks.jsonl 状态机(抄 schema/失败可见态) | 直接复用,语义基本对齐 |
| 预算/成本熔断(§4.8) | **Hopper `src/usage/`**(真实额度窗口+gate+cost-aware 选 runner) | LiteLLM 网关(开源选型) | Claude usage 是未公开 API,连降级纪律一起借 |
| worktree 隔离(§4.8) | **Hopper `src/worktree/`**(隔离+push 拦截+凭证剥离) | Claude Squad/Nimbalyst | coding 类型专属 |
| Context Pack 装配(§4.19) | **OctoDesk `contextPack.ts`**(意图门控多源/双预算/扫描链/excluded 诚实记录/源绑定/taint) | Hopper compiler(不可信输入纪律) | 加"对话转写"作为语音场景的第七源;骨架直接移植 |
| 采访→就绪→决策包(§4.3/§4.20) | **OctoDesk understand→clarification→planner 三段**(结构同构原型:facts/assumptions 三分类源标注、clarifications↔steps 互斥、全快照持久化) | Kit Spec Triad/Readiness/自适应 Gate(评分→动态调门骨架) | 表单式一问一答 → 实时语音采访;就绪从"planner 是否返回 clarifications"扩展为双维主动判断 |
| 审批/物化/安全(§4.7) | **OctoDesk EffectIntent(digest 绑定/所见即所签/单次消费 grant/执行前重校)+ 反向 MCP 五层** | **Hopper M3a DecisionRequest**(统一审批模型,到期只 reject/pause 无自动放行,语音可直接挂) | "所见即所签"→语音场景"所闻即所签"(可朗读摘要 + digest 绑完整 payload) |
| 回叫(§4.6) | **Hopper NotificationIntent**(immediate/digest+去重,"transport 只消费"——**语音回叫=一个 transport**) | Kit worker finish 自动回叫链(重试+兜底文件+dedup) | verdict/事件 → 语音回叫回调位 |
| 编排推进内核 | **OctoDesk `assessPlanRunProgress` 无进展判定表**(纯函数 verdict) | Hopper scheduler | verdict 到终局/停靠 = 回叫触发点 |
| 大项目文档流程(场景2) | **Kit Genesis 规格全文**(G0-G5,单 Writer/异构 Reviewer/2+1 轮/specdoc 轻量档) | — | 角色×引擎做成可配置,别绑具名 agent |

**结论**:VoiceLoop 真正要自己写的,只剩三块独特能力 + 一个把它们和 Hopper 下游缝起来的薄编排层。其余全有现成。

## 5. 对生态重定位(主方案 §13)的修正建议(待 owner 确认)

§13 当时(未纳入 Hopper)判断:载体=OctoDesk / 交互记忆=VoiceLoop / 重型后端=OpenClaw(可选)。据本轮:

- **修正一(事实性)**:重型编排后端的终局不是 OpenClaw-Kit,而是 **Hopper**(Kit 编排正被并入,作者唯一在推)。§13 的"以 OpenClaw 为可选重型后端"应更新为"以 Hopper 为执行底盘"。
- **修正二(架构)**:最自然形态浮现为 **"VoiceLoop 语音前脑 + Hopper 执行后端"**——VoiceLoop 做奠基/采访/就绪决断,产出任务卡 drop 进 Hopper,消费其 events.jsonl / NotificationIntent 做语音回叫、用 DecisionRequest 承接语音审批。这比"并入 OctoDesk 桌面"更轻、更同栈(都是 TS/Node/本地/MIT)。
- **修正三(战略选项)**:§13 给的 A/B/C/D 选项应新增/改写一条:**"VoiceLoop + Hopper 组合"**(前脑+底盘),很可能比"并入千手"更契合"复用而非自建"的定位。
- **时间线风险**:Hopper 平台 program 尚早(M3a schema 冻结,执行器 M3d 未实现,自估 10-12 周)。若现在对接,要么接受这条时间线,要么先按 Hopper 现状(task 粒度 + 现有 runners)集成。

> 这三条是**待你确认的战略修正**。确认后我再更新 §13、`ecosystem-analysis-and-fusion.md` 与落地映射;在你确认前不擅改主方案的战略结论。

## 6. 建议的下一步(供你在"沟通下一步"时选择)

1. **确认 SVG 业务流程图**(`business-flows.html`,上一步已产出)——业务理解对齐是一切的前提。
2. **拍板战略路线**:VoiceLoop + Hopper(前脑+底盘,本轮新证据倾向此)/ 并入 OctoDesk / 独立自建薄下游。
3. 若走 VoiceLoop+Hopper:先做一个**最小对接验证**——语音产出一张任务卡 drop 进 Hopper 现状版 → 跑通 → 消费完成事件做一次语音回叫。用最小闭环验证"前脑+底盘"假设,再决定投入。
