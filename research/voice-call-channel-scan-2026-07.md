# 通话式交互调研:ChatGPT(GPT-Live)与 Grok 的"打电话"功能(2026-07)

> **性质**:证据文档(research;实施期轻量制度下证据类免评审)。触发:owner 2026-07-24 提问——"能不能直接给 AI 打电话说事,随时挂断/继续打;AI 做完 push 汇报,需要确认时打电话给我,电话里给下一步指令?"随后要求调研 ChatGPT/Grok 新出的通话功能。
> **方法**:2026-07-24 web 调研(OpenAI/xAI 官方公告 + 官方 API 文档 + TechCrunch/The Verge/36kr 报道 + Twilio/Voximplant 集成教程)。
> **结论去向**:借鉴取舍归 owner(战略/范围);本文档不改 canonical。相关既有设计:`docs/02 §7`(CallKit 来电式汇报)、`docs/03 §8`(iOS 原生外壳)、`docs/04 §3/§4/§5.2`(会话经济学/回叫升级链/远程通道封顶)、`docs/05 §4`(分期)。

## 1. 事实清单(已核实)

### 1.1 OpenAI GPT-Live(2026-07-08 发布)

出处:[openai.com/index/introducing-gpt-live](https://openai.com/index/introducing-gpt-live/)、[TechCrunch 2026-07-08](https://techcrunch.com/2026/07/08/openai-releases-new-voice-models-for-more-natural-live-conversations/)、[The Verge](https://www.theverge.com/ai-artificial-intelligence/962856/chatgpt-upgraded-voice-mode-gpt-live)、[36kr 中文报道](https://36kr.com/p/3887622015138564)。

- **全双工(full-duplex)架构**:边听边说,不再是回合制;模型每秒多次决策"该说/该听/该停/该打断/该调工具"。取代 Advanced Voice Mode 成为 ChatGPT Voice 默认(付费 GPT-Live-1,免费 mini)。
- **对话质感的新标杆**:倾听回应("mhmm/嗯嗯/got it"垫话)、用户卡壳时安静等待、可要求"只听不说直到被点名"、语速可调、实时翻译(边说边译)。
- **智能路由**:语音模型自己不硬扛深度推理——需要推理/查资料时自动把 query 委托给 GPT-5.5 级文本旗舰,再回到语音播报。
- **长对话设计**:产品负责人自述散步时 30–40 分钟连续对话。
- **官方方向宣言**:"这项研究将逐步解锁用语音完成更复杂、更长时程、更具 Agent 属性的工作"(36kr 译文;OpenAI 明确否认做 AI 伴侣定位)。
- **首发限制**:不支持视频/屏幕共享(需切回旧模式);**API 未开放**(T客邦:未来将开放 API)。

### 1.2 1-800-ChatGPT(2024-12 上线,持续运营中)

出处:[OpenAI Help Center](https://help.openai.com/en/articles/10193193-1-800-chatgpt-calling-and-messaging-chatgpt-with-your-phone)、[Ars Technica](https://arstechnica.com/information-technology/2024/12/openai-launches-free-phone-hotline-to-let-anyone-call-chatgpt/)。

- 美加用户拨打 1-800-242-8478 即可与 ChatGPT 语音对话,**无需账号、无需智能机/网络**(翻盖机、转盘电话都行);现行额度 30 分钟/月(上线时 15 分钟)。
- 同一号码在 WhatsApp 上提供全球文本通道(GPT-4o mini)。
- **身份 = 来电号码**(对话历史按号码关联;弱认证,但对低敏场景够用)。
- 技术底座:Realtime API。开场白即声明"对话可能被审查以保证安全"。

### 1.3 Grok Voice Agent Builder(xAI,2026-07-01 beta)

出处:[x.ai/news/grok-voice-agent-builder](https://x.ai/news/grok-voice-agent-builder)、[x.ai/voice](https://x.ai/voice)、[DataCamp 实测教程](https://www.datacamp.com/tutorial/grok-voice-agent-builder)。

- **no-code 生产级语音 agent 平台**:一段自然语言描述通话流程 + 挂知识库/工具/护栏,约 2 分钟上线。
- **电话是一等公民**:每账号送一个免费电话号码(呼入呼出都支持);自有号码经 direct SIP 接入;也可自建客户端走 WebSocket。
- **一体化 speech-to-speech**(非三段拼接),官方理由与 SayDo 03 §3 记录的级联痛点相同(每跳加延迟/成本/故障点);τ-voice Bench 67.3%(grok-voice-think-fast-1.0)。
- **通话中工具调用**:remote MCP(Gmail/Calendar/Outlook/Notion/Linear)、知识库检索、web/X 搜索;通话中当场办事("边接电话边订位")。
- **转人工 handoff**:通话需要人时移交。
- **定价透明**:$0.05/min 音频全包(含语音、无平台费)+ 自送号码 $0.01/min;**30 分钟单会话上限、100 并发/团队**。
- 语音克隆(2 分钟音频)、25+ 语言、通话中跟随用户切语言、浏览器内免电话测试。
- Grok Voice Agent API(`wss://api.x.ai/v1/realtime`)**兼容大部分 OpenAI Realtime 事件模型**(官方列出命名差异清单)。

### 1.4 电话接入的技术路径(实现层,已工程成熟)

出处:[OpenAI Realtime SIP 官方文档](https://developers.openai.com/api/docs/guides/realtime-sip)、[sideband 控制文档](https://developers.openai.com/api/docs/guides/realtime-server-controls)、[Twilio 官方教程](https://www.twilio.com/en-us/blog/developers/tutorials/product/openai-realtime-api-elastic-sip-trunking)、[Voximplant Grok 集成](https://voximplant.com/blog/grok-voice-agent-api-now-available-in-voximplant)。

- **呼入(用户 → AI)**:买号码(Twilio 等)→ SIP trunk 指向 `sip:proj_<id>@sip.api.openai.com;transport=tls` → OpenAI webhook `realtime.call.incoming` → 服务端 REST `accept`(带 instructions/voice/tools)→ **sideband WebSocket**(`wss://…?call_id=`)全程监控/改 instructions/答工具调用。另有 reject/refer(转接)/hangup 端点。Azure 有对应版本。
- **呼出(AI → 用户)**:SIP provider 的管理 API 发起呼叫(Twilio/Voximplant),接通后桥接到 Realtime SIP endpoint 或任意 WebSocket 语音 agent。Grok 平台原生含呼出。
- **sideband 架构要点**:同一通话两条连接——用户的音频腿 + 应用服务器的控制腿;业务逻辑/工具/审批全留在服务端,电话只是音频 I/O。
- 已知工程坑:OpenAI 侧账户余额不足时 SIP 握手静默变 404(社区案例 2026-05);电话音频路径(编解码/8kHz)与浏览器干净音频表现不同,须用真实电话线路测试。

## 2. 与 SayDo 现有设计逐条对照

### 2.1 被行业印证的既有设计(不用改,记为证据)

| SayDo 既有设计 | 行业印证 |
|---|---|
| 级联默认、"S2S 只做呈现层,认知交给文本旗舰"(03 §3) | GPT-Live 官方架构同款:语音模型把深推理委托给 GPT-5.5;xAI 也把"电话循环"与"办事工具"分层 |
| 语音会话短命/任务长命、挂断 ≠ 丢上下文(04 §3) | 1-800-ChatGPT 按号码跨通话关联对话;Grok 30 分钟会话上限证明"长任务不能靠不挂线"是行业共识 |
| 供应商会话上限必须架构绕开(04 §3) | Grok 30 min/会话、1-800 30 min/月,均为硬上限 |
| 回叫升级链含电话档、CallKit 来电式汇报为理想形态(02 §7、04 §4) | AI 呼出已是成熟商品能力(Grok 原生、Twilio 桥接) |
| 通话中细节转屏幕、口播只承载决策与摘要(02 §3) | GPT-Live 首发不支持屏幕共享恰证明纯语音承载不了细节;Grok 用"转人工"处理语音说不清的事 |
| τ-voice 类基准显示纯语音 agent 任务成功率有限(03 §3) | grok-voice 最新 67.3%,仍显著低于文本 agent |

### 2.2 值得借鉴的增量(理念/功能/实现三层)

**理念层**

1. **"通话"升为交互隐喻,而不只是通知通道**。GPT-Live 的定位语("不再是对讲机,而是一部真正的电话")与 owner 的直觉一致:给 AI 打电话说事、挂断、它做完打回来——这是"幕僚长"心智模型(01 §4)在移动端的最自然投影。SayDo 现文档把电话放在升级链末端(P1)+ SIP 呼入(P2),**缺"用户主动呼入"的产品化表述**。
2. **对话质感新标杆:倾听回应与安静等待**。GPT-Live 的垫话("嗯嗯")、卡壳等待、"只听不说"模式,直接对应 SayDo 的采访体验(02 §2:像播客主持人)。级联管线做不了真全双工,但可以规则化近似(见 §3 建议 B4)。
3. **SayDo 的差异化恰在"通话背后有活在跑"**。ChatGPT/Grok 的通话都是"通话结束 = 交互结束";SayDo 的通话挂断后任务照跑、做完回叫——这是竞品没有的闭环,是宣传语级的差异点("和一个一直在干活的同事通话,不是和一个只在通话时存在的助手通话")。

**功能层**

4. **呼入热线形态**(1-800-ChatGPT/Grok 免费号码 → SayDo"给你的项目打电话"):锁屏/开车/走路时不开 App,打过去就是自己项目的 Brain(继续采访、查状态、口头 steer)。P1 可用 VoIP 形态实现(见 §3),PSTN 真号码排 P2。
5. **来电确认闭环**(owner 设想的核心):blocked/approval_request 走"AI 来电"而非仅推送——接起即听到"卡在哪 + 要你决定什么",电话里口头给下一步指令。**与既有安全模型的接缝**:04 §4 已有 urgency 两档(验收=低→push;卡住审批=高→电话),04 §5.2 已有"远程通道封顶 S2、需已配对设备"。需补的是把"电话"拆成两档认证强度:**VoIP 来电(CallKit,已配对设备通道,可承载 S2 语音确认)≠ PSTN 来电(弱认证,只 ack/snooze/拒绝,维持现状)**。S3 永远屏幕强认证,不动。
6. **通话中当场办事**(Grok:边接电话边查日历订位):对应 SayDo 通话中调 `get_status`/`steer_task`/`answer_agent_question`——工具集已有,电话只是新前端,sideband 架构天然支持。
7. **免电话测试通道**(Grok 浏览器内测 agent):SayDo 若做电话链路,必须有不打真电话的注入测试通道(与实施计划 1.2 测试音频注入通道同思路,扩到电话腿)。
8. **按号码限额/会话上限**:电话通道的成本熔断参数(呼入单次时长上限、每日呼入分钟额度)应进全链成本账本(04 §3)与三熔断族谱。

**实现层**

9. **sideband 模式与 SayDo 架构同构**:daemon 就是"application server",电话腿只是音频 I/O;Brain 进程可丢弃、副作用全在 daemon 的铁律(03 §1)不需要为电话破例。接入点在语音引擎层(统一 `say()/on_user_utterance()/interrupt()` 接口后再加一种 transport),Brain 无感知。
10. **呼出实现三选**:① ntfy 自带电话(03 §9 已选型,纯通知级,零增量)→ ② Twilio 呼出 + 桥接自家级联管线(电话内对话,P1/P2)→ ③ Grok/OpenAI 平台托管 agent(不适合——SayDo 的 Brain/记忆/审批必须自持,只可借电话腿)。
11. **成本量级**:Grok 全包 $0.06/min(≈¥0.4/min);OpenAI Realtime 按 token + Twilio 号码/分钟费。对"每天几通、每通几分钟"的 SayDo 场景是零头,不构成路线约束。
12. **国内现实(owner 主用环境)**:Twilio 无国内号码、PSTN 呼入涉信管合规;**VoIP(CallKit + Tailscale 直连自家 daemon)才是 P1 主形态**——体感完全是"打电话/接电话",但走自家加密通道、已配对设备认证、零电信费。PSTN 真号码是"没网/没装 App"的兜底,排 P2 合理(现 05 §4 P2"远程语音回叫(SIP 呼入为主)"不用动,可补一句呼入方向)。

### 2.3 明确不借鉴的

- **语音克隆/人格化音色**(Grok companions 路线):与幕僚长定位无关,且 OpenAI 都刻意否认伴侣定位;不做。
- **no-code 面向他人发布 agent**:SayDo 是自用控制面,不是 agent 分发平台。
- **通话内完成全部交互的假设**:两家的通话都试图"通话内闭环",SayDo 恰恰相反——通话是长任务的间歇性接口;坚持细节转屏幕。
- **把 Brain 托管到供应商语音平台**:记忆/审批/留痕必须自持(Gate 0 门禁不可外包)。

## 3. 建议(供 owner 取舍,不代拍板)

**A. 不动的**:P0 范围不动(电话在"明确不做"清单);S3 屏幕强认证、电话弱认证封顶等安全红线全部不动;级联默认不动(GPT-Live 无 API,且可控性理由未变)。

**B. 建议吸收(按分期)**

| # | 内容 | 落点 | 工作量感 |
|---|---|---|---|
| B1 | "通话"升为 T2 的核心交互隐喻:App 内"呼叫 SayDo"(呼入)+ CallKit 来电(呼出)成对出现;文档补"用户主动呼入"的产品表述 | 02 §7/03 §8 各加一句;P1 | 文档级 |
| B2 | 电话通道认证两档化:VoIP 已配对设备(承载 S2 语音确认)≠ PSTN(仅 ack/snooze/拒绝) | 04 §5.2 细化;P1 设计、P2 用到 PSTN 档 | 文档级 |
| B3 | blocked/approval 的呼出升级为"来电内对话式确认"(接起→听卡点→口头 steer/答疑;涉 S2 走已配对设备档) | 04 §4 升级链注记;P1 | 中 |
| B4 | 采访质感对齐 GPT-Live:规则化垫话(ASR 部分转写时低音量"嗯")+ 卡壳静默等待阈值 + "只听模式"口令 | 10 话术 + Phase 1 管线参数;P0 可顺带试、不达标不强求 | 小(实验性) |
| B5 | GPT-Live API 开放列为引擎 B 重评触发条件(07 **D6** 触发条件补一条;初稿误写 D2,2026-07-24 subagent 评审勘误) | 07 D6;被动等待 | 文档级 |
| B6 | 电话腿测试注入通道 + 呼入时长/日额度熔断,随电话功能一起做 | P1/P2 实施项 | 随 B1 |

**C. 差异化宣传点(留营销备用)**:"挂了电话,活还在干;干完了,它打给你"——竞品通话是即时问答,SayDo 通话是异步委派的接口。承诺口径仍守 01 §5(不暗示无人值守完成)。

## 4. 不确定性与复核点

- GPT-Live **API 未开放**,其全双工能力暂不可复用;开放后按 B5 重评(届时对比对话档 API 成本)。
- Grok Voice Agent Builder 处 **beta**,定价("preview 价")、30 分钟会话上限、并发额度都可能变;引用数字以 2026-07-24 为准。
- 1-800-ChatGPT 仅美加呼入;国内 PSTN 路径(号码资质/录音合规)未调研,P2 前须补(涉合规,上浮 owner)。
- 本文档为单轮 web 调研,未做上手实测;若 owner 拍板推进 B1/B3,建议 P1 前对 CallKit 呼入呼出做 1 天 spike(iOS PushKit 5 秒 reportNewIncomingCall 约束在 03 §8 已记录)。
