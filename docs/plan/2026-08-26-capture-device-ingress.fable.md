# 口袋采集设备接入方案(capture ingress)v2

> 日期:2026-08-26(v2,同日 Codex 对抗评审回修版;v1 见本文件 git 前一版本)。状态:方案定稿候选,待 owner 批准。
> 对象硬件:FoloToy AI Passport 一类口袋开源硬件(ESP32-C3 / 8MB Flash / 无 PSRAM / ES8311 I2S 全双工 / Wi-Fi / 三键 + 240x320 屏),约一个月后到货;本方案只做 daemon 侧可行性与最小落地,不写设备固件。
> supersede 关系:本文修订并取代 2026-08-26 Cursor 会话产出的同题方案(该方案未落仓,原文见会话记录);v2 按 `research/codex-findings/100-capture-device-ingress-adversarial-review.md` 回修,结构性变化见 §10 评审记录。
> 核验声明:本文引用的 file:line 与行为断言,均在 2026-08-26 会话内对照仓内实际代码核验;未能核验的事实一律标 unknown 或 Unverified。

---

## 0. 结论与 owner 九问速答

**一句话结论(三档之二):要加一条窄的设备采集入口才能接。** 现有生产进线在角色、令牌、来源面三层都封死了"第三类对端":hello 只接受 `pipeline`/`console` 两种 role(`packages/daemon/src/voice/hub.ts:318`),G1 身份门只有单一 owner 主体(`packages/daemon/src/net/identity.ts:137`),mobile_lan 面上行白名单无音频且二进制帧直接丢弃(`hub.ts:141-146`、`hub.ts:573-576`)。封锁全部是白名单形态,additive 加一个 `capture` 角色不破任何既有合同。**v2 关键修正**:令牌 scope 若只做在传输层,进入 Brain 后 capture 轮仍是 owner 语义输入(可触达免确认写工具与 5 秒自动接受)——因此 scope 必须贯穿到工具环(§2.6/§2.7),这是 v1 与 Codex 评审共同确认的最大结构缺口。

| # | owner 问题 | 答案 | 证据 |
|---|---|---|---|
| 1 | 现有进线能否直接接远端音频 | 不能。console role 需 owner 令牌(等于交出全部确认权);mobile_lan 拒二进制;tailnet 无 Origin 即过 G1 后自称 console 就是完整 owner | `hub.ts:318`、`identity.ts:90-91`、`hub.ts:573` |
| 2 | 最小增量 | 新 role=`capture` + 第二枚令牌 + daemon 侧聚轮转发(store-and-forward)+ `origin:"capture"` 贯穿到工具环 + capture 轮工具三档权限 | 本文 §2 |
| 3 | /dev/inject、/dev/say 能否当原型 | 只能当本机测试脚手架,绝不能进生产:`/dev/*` 仅 via=local(`index.ts:779-793`),且 injectPipelineMsg 走 inject 通道豁免角色白名单、可注入伪造 `asr.final`(`hub.ts:465`、`hub.ts:900`)。capture 令牌必须连 /dev 一起拒 | `index.ts:801-841` |
| 4 | 音频合同 | 16 kHz / mono / PCM16LE,帧 `0x01 + 4B BE seq + payload`(建议 20ms/640B);结束信号 = 二进制 `0x03` 空帧;设备端不做 VAD,纯 PTT;单轮 <3200B 出空 final(轮次守恒) | `useVoiceChannel.ts:119-120,236-248`、`hub_client.py:169,450`、§4 |
| 5 | 会话怎么挂 | 挂在连 Console 最近登记的会话,**逐轮**由 daemon 现场解析;设备零会话概念。**第一刀要求该会话有 local Console 在连**——无 Console 的独立成轮会把没人听到的 AI 句记成 heard=true,违反 unheard 纪律(`docs/09:1039`),移 PR3(设备有喇叭后,播放端语义才能闭合) | §2.3 |
| 6 | 回放 / 设备喇叭 | 第一、二刀没有下行。现网 0x02 是 mp3 且只广播 console(`hub.ts:602`、`hub_client.py:515`);设备端 mp3 解码能力 unknown。留 PR3 | §6 PR3 |
| 7 | 确认是否被迫上设备 | 不会,且必须反向加固:capture 来源的轮不进确认词表环、不享受 5 秒自动接受、建卡类工具产生的卡只能由屏幕裁决(§2.6/§2.7)。S3/WebAuthn 仍只在本机浏览器,零改动 | §2.6 |
| 8 | 丢卡令牌的攻击面 | 是新攻击面。v2 如实口径:capture 令牌拿不到协议面(confirm.click/decision/dispatch/HTTP API)与工具面(写状态工具、自动接受),**但"说话"本身仍是对话输入权**——能问、能让 Brain 建待屏幕确认的卡、能污染转写与 M0 候选。完整威胁模型见 §3.4 | §3 |
| 9 | 三档结论 | **要加一条窄的设备采集入口才能接**,证据同上 | — |

---

## 1. 对前案(Cursor 方案)的评审

前案的问题定位、三档结论、令牌双文件、PR 分刀、Build/Host/Device 分档汇报纪律,方向正确,骨架保留。以下是核验中**证伪或需要修订**的点,按严重度排列。(v2 注:本节只评 Cursor 前案;本方案 v1 自身被两轮 subagent 评审与 Codex 评审修订的记录见 §10。)

### 1.1 [A 级证伪] "Console 抢锁后发 voice.mode 清 `_mic_buf`" 建立在错误前提上

前案 A.2/B.6 的并发方案依赖"向 pipeline 发 `voice.mode {mode:"ptt", sessionId}` 即清 mic 缓冲"。实际代码:`hub_client.py:296` 的清账条件是 `if new_mode != self._mode or new_sid != self._active_sid`——**mode 与 sid 都未变化时重发 voice.mode 是 no-op**,缓冲不清。而抢锁场景恰恰是 Console 已处于 ptt + 同一 sessionId,清账必然不触发;capture 已转发的半轮 PCM 残留在 `_mic_buf`,Console 的帧拼在其后,松开后混流识别成一条 `asr.final`——直接污染"所闻即所签"的上游。同理,"capture 断线时发 voice.mode 清残留"也是 no-op。前案的锁方案整体不可用,本方案改用 store-and-forward(§2.2)。

### 1.2 [A 级遗漏] Console 会"冒领"设备轮的 asr.final

前案让 capture 轮的 `asr.final` 照常广播给 console,并把"console 能收到广播"写进验收。实际 Console 生产采集路径(`Chat.tsx:311,331` 用 `pttDown`/`endCaptureSend`)维护采集意图 FIFO 队列,`asr.final` 到达时**无条件 shift 队列且不校验 sessionId**(`useVoiceChannel.ts:502`);PTT 档下队空的 final 直接丢弃(`useVoiceChannel.ts:506`)。后果:Console 用户自己的轮在途时,设备轮的 final 先回(pipeline PTT 识别是链式 FIFO,`hub_client.py:423-438`)→ 设备的转写文本顶进 Console 用户自己的占位气泡;队空时设备轮的 final 被静默丢弃。修订:daemon 对 `origin:"capture"` 的 final 不广播 console(§2.4),Console 正确展示留 PR3。

### 1.3 [A 级修订] hello.ack 绑定 sessionId 的设计天然过期,设备不应有会话概念

前案让 hello.ack 下发 sessionId、设备后续每轮带它、不一致即丢。口袋卡连接可能挂数天,而会话是易变的(Console 刷新换新 ses_、idle 挂起、收尾 closed)。"连接期解析一次"必然漂移,且把漂移后果做成静默丢轮。修订:会话解析移到每轮 flush 时刻由 daemon 现场执行(§2.3);设备协议零会话概念(v2 进一步:结束信号改二进制 `0x03`,设备上行零 JSON,§2.2)。

### 1.4 [A 级修订] "hello 后立刻向 pipeline 发 voice.mode ptt" 会踩坏 Console 状态

前案 B.4 让 daemon 在 capture 接入时向 pipeline 发 `voice.mode ptt` 预绑会话。后果:(a) Console 免手档下 pipeline 被掰回 ptt 而 Console UI 仍是 hands_free,状态分裂,常开麦帧进 `_mic_buf` 无限积累;(b) 发不同 sessionId 会触发 `hub_client.py:296` 清账,Console 按住中的半轮被清掉。修订:capture 接入对 pipeline 什么都不发;免手互斥由 shadow mode 弃轮承载(§2.5)。

### 1.5 [B 级修订] 会话解析引用的现成查询会选中 closed 会话

前案引用 `getRecentTranscript` 的查询做兜底,但该查询不过滤状态(`recentTranscript.ts:38-44`),最新一条可以是 closed,而 closed 会话 rebuild 会 throw(`voiceSessions.ts:125-129`)。v2 修订后此问题被更强的收窄覆盖:第一刀不做 DB 兜底解析(§2.3)。

### 1.6 [B 级遗漏] 上行零限额

`_mic_buf` 是无上限 append(`hub_client.py:176`)。capture 是"会丢的卡"持有的新攻击面,前案实时转发架构下恶意帧流直达 pipeline 内存。store-and-forward 给了限额位:单轮字节上限、单帧上限、单在途轮闸(§3.4)。

### 1.7 [B 级修订] 白名单还能再窄

前案允许设备发 `voice.mode(仅 ptt)` 与 JSON done。v2 收敛为:设备上行零 JSON(hello 除外),仅二进制 `0x01`/`0x03`;`ROLE_ALLOWED.capture` 为空集。

### 1.8 [B 级修订] "确认词表环第一刀不挡"应改为第一刀就挡

前案把"卡上说'好'会进词表环"列为风险但按"已锁产品形状"放行。核验:pending 确认存在时,普通文本的 asr.final 会进 `handleConfirmReply`(`dialog.ts:660,673-676`),而语音确认是 S2 放行通道(`confirmVocab.ts:2-3`)。既然产品裁决是"这张卡不替用户点确认",设备来源的语音必须在确认窗口整体失效。v2 进一步(Codex A-1):仅拦"到达时已存在的 pending"不够——capture 轮自己让 Brain 新建的卡若带 5 秒自动接受(`dialog.ts:1318-1340` `scheduleAutoAccept` 到点 `consumeAutoAccept`),同一轮就能自助闭环。所以拦截必须扩展到"capture 轮禁用自动接受"(§2.6)。

### 1.9 [C 级] 其余保留项的核验结果

以下前案断言逐条核验为真,直接沿用:帧格式与 320 samples/20ms(`useVoiceChannel.ts:119-120`);<3200B 空 final 轮次守恒(`hub_client.py:450`,合同 `docs/09-data-contracts.md:1018`);seq 现网不校验、按到达序拼接(`hub_client.py:176`);capture 不算 console ⇒ cancelIdle/L0 回叫/hasTailnetConsole 语义自然保持(`hub.ts:732-740,922-926`、`index.ts:3024-3034`、`docs/04-key-mechanisms.md:124`);`/api/pairing-info` 仅 local(`index.ts:942-954`);`just t2-pair` 的 owner token URL 严禁给设备(`pairUrl.ts:34`);mp3 整段尾截断、ASR 只吃 WAV/PCM(`hub_client.py:56`,ADR-101);opus/amr 仓内无解码器;`.cap-token` 生成原语 randomBytes(24) base64url + 0600(`capToken.ts:18-21`)。

---

## 2. 修订后架构:store-and-forward 聚轮 + 贯穿式来源权限

### 2.1 设计原则

1. **设备是纯采集器**:零会话概念、零档位控制、零确认权、零下行(第一刀)、零上行 JSON(hello 除外)。固件协议 = "推 `0x01` 帧 + 一条 `0x03` 结束帧"。
2. **pipeline 只见完整轮**:设备网络抖动、断线、半轮全部消化在 daemon 侧缓冲;不改 pipeline 的并发语义。
3. **typed provenance 贯穿到工具环**:设备来源的轮全链路带 `origin:"capture"`(daemon 盖章,不信设备自报),从 WS 层一直传到 `ToolContext`——scope 不是传输层装饰,而是 Brain 工具执行时的硬约束(§2.7)。与 `turn.text` 的 `typed:true` 同一哲学(`docs/09:1021`)。
4. **Console 恒优先(数据面绝对,时延面如实)**:任何并发冲突下弃 capture 轮;Console 的帧流、状态、hold 旗、speechPending 在任何时序不被 capture 触碰。时延面如实声明:Console 按下 PTT 到首帧到达前的毫秒级窗口内,一个已 flush 的 capture 轮可先进 pipeline FIFO,使 Console 该轮识别最多排队一个 capture ASR(上限 90s 超时);单用户单人场景(卡和 Console 是同一个人)接受此排队,不做抢占取消。
5. **第一刀 = "Console 在场时的第二麦克风"**:capture 成轮要求该会话有 local Console 在连。无 Console 的独立对话在设备没有播放端时无法满足 unheard 纪律(AI 句无人听却会被结算为 heard=true,`voiceSessions.ts:222-258,315-336`、`docs/09:1039`),移 PR3 与喇叭下行同批(届时设备自己是播放端)。

### 2.2 一轮的生命周期(数据流)

```
设备                daemon(VoiceHub)                      pipeline
 |--0x01 帧-------->| 累积到 capture peer 缓冲(不转发)       |
 |--0x01 帧-------->| (单帧<=64KB、payload 偶数、单轮上限)     |
 |--0x03 结束帧----->| flush 判定(顺序执行,任一不过=弃轮):      |
 |                  |  a 缓冲非 overflow 且 >0              |
 |                  |  b pipeline peer 可用 且 其            |
 |                  |    protocolVersion minor >= 1(§2.4)   |
 |                  |  c lifecycle 开(非 draining/startup)   |
 |                  |  d shadow mode == ptt                |
 |                  |  e 会话解析成功(§2.3)→ sid             |
 |                  |  f 该 sid 无在途用户轮(§2.6)           |
 |                  |  g console 采集账为零(§2.5)            |
 |                  |  h captureInFlight == 0(单在途闸)      |
 |                  |--0x01 合并单帧(整轮 PCM,seq=0)--------->| _mic_buf 累积
 |                  |--done_speaking{sid,origin:"capture"}-->| flush → ASR
 |                  |<--asr.final{sid,turnId,text,origin}----|
 |                  | origin=capture ⇒ 不广播 console;
 |                  | 独立 handler(§2.6),不进 console 主链
```

要点:

- **红线一:capture peer 的任何上行都不进既有 dispatch/routeBinary 转发路径**。routeBinary 对 `role=capture` 在最前分流(先于 mobile_lan 检查):`0x01` 入缓冲、`0x03` 触发 flush、其余 tag 丢弃;routeJson 对 capture 一律丢弃(白名单空集)。若把 capture 消息放进普通 dispatch,done 会当场 flush 掉 Console 按住中的半轮(`hub_client.py:287-289`)。测试断言"pipeline 收到的每条 done_speaking 都是 daemon capture flush 构造的或 console 转发的,无第三来源"(§7.1)。
- **红线二:转发给 pipeline 的 `turn.done_speaking{origin:"capture"}` 只能由 daemon 的 capture flush 构造**——console 来源的 done 若带 origin 一律剥除(§2.4)。
- **提交形态(两消息,同连接 FIFO)**:flush = 一条合并 `0x01` 帧(整轮 PCM 拼成单帧,seq 填 0——pipeline 只按到达序 append payload、不消费 seq 语义,`hub_client.py:167-176`)+ 一条 done_speaking,连续两次 `ws.send`。诚实措辞:这是**同连接 FIFO 入队**,不是事务——任一 send 抛错则弃轮 + `markPipelineUnavailable`(沿用现网 error 路径,pipeline 重连时 `_reset_connection_tasks` 清缓冲,`hub_client.py:215-234`,半帧残留被清);ws 对同一 socket 的 send 保序,Node 单线程保证 console 消息不插入两次 send 之间。合并单帧把失败面从 N 帧收敛到 2 条消息(pipeline `websockets.connect max_size=None`,`hub_client.py:148`,1.92MB 单帧可接收)。
- **弃轮语义**:判定不过 → 缓冲清空 + 结构化日志(reason 枚举:`no_pipeline` / `pipeline_incompatible` / `lifecycle` / `hands_free_active` / `no_session` / `user_turn_in_flight` / `console_residual` / `console_busy` / `capture_busy` / `overflow` / `empty`)。第一刀设备收不到弃轮反馈(无下行),固件按本地状态机提示"已发送",不承诺已受理(§4)。
- **设备断线**:daemon 缓冲直接丢弃,pipeline 从未见过任何字节。

### 2.3 会话解析:每轮 flush 时现场执行,单一来源,纯只读

解析规则(单一函数 `resolveCaptureSession`,daemon 侧注入;只读,零状态副作用):

- 取**在连、via=local、已发过 voice.mode** 的 console peer 的 `lastVoiceModeSessionId`(hub 为 console peer 新记该字段;不能用 `Peer.sessionIds`——那是累积 Set,切换会话后旧 sid 仍在,`hub.ts:448-457`)。多个 console peer 时取 voice.mode 最近到达者。无任何合格 console peer → 弃轮 `no_session`。
- **第一刀没有 DB 兜底解析**(v1 的 talking/suspended 库查询已删):它只服务"无 Console 独立成轮"场景,而该场景因 unheard 纪律移 PR3(§2.1 原则 5);删除后同时消掉 closed 选中、悬置 talking、多候选歧义三族问题。
- 多标签页歧义面很小:Console 的 sessionId 存 localStorage 单 key(`VoiceContext.tsx:16,26-32`),同浏览器多 tab 共享同一 sid;跨浏览器才会出现多 sid,取 voice.mode 最近者是单用户下的合理规则,不做 fail-closed(过度)。
- **该 sid 可以尚未入库**:新开的 Console 页 sid 本地生成、说第一句话才入库(`ensureSession` created 路径,`voiceSessions.ts:108-124`)。capture 轮此时到达会触发 created——这**不违反**"不默默建会话":Console 在连、UI 在看(会收到 session.project 广播并导航),语义等价"用户用另一个麦克风说了本会话第一句话"。"默默"被禁止的是无任何 UI 的暗建,已由"必须有 console 在连"排除。
- suspended 场景(Console 开着但 idle 挂起):解析照常返回 sid,rebuild 留给 asr.final 到达后的既有链(`runUserTurn` → `ensureSession`,`dialog.ts:630`)——flush 时刻不 rebuild。理由:flush 时 rebuild 的空 final 轮会把会话无声拉回 talking(rebuild 内即 `setState("talking")`,`session/manager.ts:145`)且零 idle 定时器(`touchIdle` 只在 `onUserTurn` 走);且 final 到达时 `ensureSession` 会因已 rebuild 返回 `rebuilt=false`,`dialog.ts:633` 的门不触发,**readinessAssemble 被跳过**,与 Console 同场景行为分叉。
- 竞态兜底:flush 与 final 之间会话被收尾为 closed → capture 独立 handler(§2.6)在进主链前只读复查 state,closed 即丢轮;复查后仍存在的微秒级 TOCTOU 窗口残留一次 `onUserTurnBegin` 的 L0 回叫 ack(`dialog.ts:617-621` → `index.ts:2774-2780` durable ack)——v2 对 capture 轮把 `ensureSession` 提到 `onUserTurnBegin` 之前(仅 capture 分支调序,console 主链不动),把该残留也消掉;测试覆盖(§7.1)。

Console 事后重连时,pending 卡经 **onVoiceMode 回放**重推(console 重连在 hello.ack 后必发 `voice.mode`,`useVoiceChannel.ts:482`;daemon 的 onVoiceMode 查 `confirmLoop.pending` 并重发 confirm.card,`index.ts:2959-2973`;boot 时另有一次性 `restoreFromDb`,`index.ts:3039`,两者不同机制)。

### 2.4 来源标注:`origin:"capture"` 贯穿全链,版本门保证透传

contracts additive(`packages/contracts/src/types/pipeline.ts` 全部为 `z.strictObject`,额外字段被拒——任何 additive 都必须改 schema + docs/09 §10):

- `turn.done_speaking` 增加 `origin?: "capture"`(与既有 `holdForConfirm?: true` 同款,`pipeline.ts:58`);
- `asr.partial | asr.final` 增加 `origin?: "capture"`。

流转规则:

- daemon 在 capture flush 时构造 `{t:"turn.done_speaking", sessionId:<解析值>, origin:"capture"}` 发 pipeline;
- console 来源的 done_speaking 若带 origin 一律剥除(在 `hub.ts:493-501` 现有 holdForConfirm 剥离处同点处理,防伪造);
- pipeline 透传:`_handle` 的 done_speaking 分支把 origin 传入 `_spawn_ptt_flush` → `_flush_mic`,回发的 asr.final 原样带上(约 3 行;对不带 origin 的现网消息零行为差异);
- daemon 收到 `origin:"capture"` 的 asr.*:不 `broadcast("console")`(§1.2 冒领防御),进 capture 独立 handler(§2.6);
- `asr.final` 只信 pipeline 的 B8 铁律不放宽(`hub.ts:109-139`);
- **版本门替代猜测(v2)**:v1 的"captureInFlight 配对猜无 origin final 来源"后备已删——Codex 证明它双向误归因(Console 切 sid 清计数后,旧 Console final 会被吞成 capture;偏斜叠加免手切换时 capture final 会放行进词表环)。替代:`RUNTIME_PROTOCOL_VERSION` 从 `1.0.0` bump 到 `1.1.0`(contracts 与 pipeline 同步,additive capability 的语义化表达);hello 兼容仍按 major(`runtime.ts:128-133` 不动,旧 pipeline 照常可连、现网功能不受影响),但 capture flush 判定 b 要求 pipeline identity 的 minor >= 1,否则弃轮 `pipeline_incompatible`。**fail-closed:不确定透传能力就不发**,零猜测、零误归因。(注:canonical `docs/09:986-988` 要求握手 runtimeSha 三方一致而实现只比 protocol major——该既有分叉不由本方案修,如实记录于 §9。)

### 2.5 与 Console 的并发互斥:机械账本而非启发式

不引入抢占锁(§1.1 已证伪)。判定用三个**机械维护**的影子值(v1 的"最近 1s 有 console 帧"启发式已删——tailnet console 帧间隔可超 1s、console 断线残留无 done 兜底,两条时序都会破"pipeline 只见完整轮"):

- **shadow mode**:VoiceHub 在向 pipeline 转发 `voice.mode` 的分支(`hub.ts:543-546`,mobile_lan 的 voice.mode 不转发、不计入)记录最近生效 (mode, sid) 二元组;`onPipelineJoined` 重置为 ptt(pipeline 重连清态回 ptt,`hub_client.py:232`)。hands_free ⇒ 弃轮 `hands_free_active`(capture 帧进免手档会被 `_feed_vad` 当作 Console 语音段,`hub_client.py:170-175`)。已知边界(如实):pipeline 单独重连后 Console 不会重发 voice.mode(Console 只在自己 hello.ack 或用户切档时发,`useVoiceChannel.ts:478-484,722-745`)——此时 Console UI 免手、pipeline/shadow 已回 ptt,Console 常开麦帧持续进 `_mic_buf`;这是**现网既有缺陷**(与 capture 无关,今天就存在),对 capture 的影响方向安全:console 帧会把 `consoleMicResidual` 置 true,capture 持续弃轮直到状态收敛。该现网缺陷另行立项修复,不进本方案改动面。
- **consoleMicResidual(布尔,`_mic_buf` 是否可能含 console 数据的精确影子)**:routeBinary 向 pipeline 转发 console 0x01 时置 true;三处置 false——console done_speaking 转发时(缓冲快照即清,`hub_client.py:287-289`)、`onPipelineJoined`(重连清缓冲,`hub_client.py:228`)、(mode,sid) 实变的 voice.mode 转发时(该条件下 pipeline 真清账,`hub_client.py:296`)。true ⇒ 弃轮 `console_residual`。
- **consolePttInFlight(计数,console 轮在 ASR 中)**:console done 转发时 +1;**无 origin** 的 asr.final 到达时 -1(带 origin 的属 capture 轮,不得偷减);增减读仅在 shadow=ptt 执行;`onPipelineLeft`/`onPipelineJoined` 清零(断线取消在途 ASR,final 永不回,不清零则 capture 永久 `console_busy`);(mode,sid) 实变清零;clamp >= 0。>0 ⇒ 弃轮 `console_busy`(此时插入 capture 轮虽不混数据,但 final 侧必被 f 判定丢弃,提前弃省一次 ASR)。
- **captureInFlight(计数,capture 轮在 ASR 中;v2 语义=纯并发闸,不做来源猜测)**:capture flush 成功 +1;带 origin 的 final 到达 -1;`onPipelineLeft`/`onPipelineJoined` 清零。>0 ⇒ 弃轮 `capture_busy`——**单在途上限 1**,这同时是资源上限(pipeline 任意时刻至多持有一份 capture PCM + 一个识别任务,自然限速为每 ASR 周期一轮,90s 超时封顶),Codex A-3 的无界队列风险由此闭合,无需 token bucket。

### 2.6 capture 轮的独立 final handler:不进 Console 主链

`origin:"capture"` 的 asr.final 在 `index.ts` onAsrFinal **入口最前分流进独立 handler 并 return**——不 fall through 到主链(v1 的"通过检查后走下方主链"被 Codex A-6 证伪:主链最前消费 Console 的 hold 旗队列,capture final 会吞掉 Console 双动作的 hold 标记):

```
if (msg.origin === "capture") { handleCaptureFinal(msg); return; }   // 主链对 capture 零感知

handleCaptureFinal:
  1 空文本 → log,return(不触碰 settlePendingSpeech——那面旗是 Console barge-in 语义,dialog.ts:557,563-568);
  2 只读复查会话 state,closed → 丢轮 + log(§2.3 竞态);
  3 confirmLoop.pending(sid) 存在 → audit(confirm.capture_turn_ignored)+ return(不进词表环不进 Brain);
  4 liveDialog.hasUserTurnInFlight(sid) → log,return(flush 判定 f 的 final 侧兜底);
  5 通过 → liveDialog.onAsrFinal(sid, turnId, text, {origin:"capture"})
```

- **hold 旗、speechPending、Console 采集 FIFO:capture 路径零读零写**。
- **capture 轮不打断在途回答**:onAsrFinal 主链入口即 abort 在途模型轮("用户开口优先",`dialog.ts:571-579`)——对口袋误触是事故。flush 判定 f + handler 第 4 步双层拦截;代价"设备无法打断 AI 说话"如实接受(设备无播放,打断需求不存在)。已知残余(如实):`hasUserTurnInFlight` 只覆盖用户模型轮(`dialog.ts:210-213`),不覆盖控制轮与 TTS 播放中——capture 轮会像普通用户轮一样打断控制轮(控制轮本就设计为可被用户打断,`dialog.ts:576` ctl.cancelled)并在 Console 播放中触发新轮;单用户场景(说话的就是本人)接受,不引入 captureIngressBusy 大机制。
- **禁用自动接受(v2 新增,Codex A-1 核心子项)**:capture 轮的模型轮期间,`scheduleAutoAccept`(`dialog.ts:1318-1340`)必须不生效——AI 提议的 5 秒倒计时到点 `consumeAutoAccept` 是一条不经人手的 accept 路径,capture 轮触发的新卡若走它,设备说话即可自助完成确认闭环。实现:LiveDialog 按当前轮 origin 抑制调度(卡照建、confirm.card 照发 Console,只是不挂倒计时,等人裁决)。
- 被 handler 第 3 步拦截轮的话音**不落转写正文**,仅 audit 记事件——第一刀取舍:落盘要么牵动 `onUserTurn` 副作用链要么扩 TranscriptTurn 契约;诚实代价是确认窗口内设备说的话零正文痕迹,PR3 补。
- 词法直通裁量(v2 收紧):收尾("先到这里"→suspend,`dialog.ts:681`)对 capture 轮**保留**(可逆、低危、产品自然);撤销(`dialog.ts:651`,回滚 Focus 直通操作)对 capture 轮**关闭**——它是状态写操作,归入 §2.7 的 deny 档。

### 2.7 capture 轮的工具三档权限(v2 新增,Codex A-1)

**问题**:传输层白名单挡不住自然语言。capture 轮进 Brain 后,现网工具环里存在大量**免确认写工具**——`cancelTask` / `reviewTask` / `retryTask` / `steerTask`(`liveTools.ts:1111-1204`)、`remember`(可把当前轮标为 `user_utterance` 甚至 `user_stated/user_approved` 写记忆,`liveTools.ts:1275-1333`)、项目转正、热词、Focus 直通等。origin 不进工具环,"scope 受限"就是假的:丢卡者对着卡说"取消任务 X"就真取消了。

**机制**:`origin` 经 `liveDialog.onAsrFinal(..., {origin})` → `runUserTurn` → 工具执行上下文(`ToolContext`,`brain/registry.ts`)透传为 `ingressOrigin?: "capture"`。注册器在工具执行前按**三档分类表**检查:

| 档 | 语义 | capture 轮行为 | 例 |
|---|---|---|---|
| read | 只读查询 | 放行 | getStatus、查任务、查转写 |
| propose | 产生 pending 确认卡,由屏幕裁决 | 放行,但该轮禁自动接受(§2.6)——卡去 Console,人批 | 建 Focus/义务、proposeStart |
| deny | 免确认直接改状态 | 拒绝,工具返回固定话术("这个操作需要你在屏幕上做") | cancelTask/reviewTask/retryTask/steerTask、remember、项目转正、热词、undo |

- **fail-closed:未分类工具对 capture 轮一律按 deny**。分类表为代码常量 + docs/09 §13 回写;实施时从 `liveTools.ts` 全量枚举逐个分类(方案不抄工具名清单——会漂移;验收用测试断言"注册器中每个工具都被显式分类,否则 capture 轮调用被拒",§7.1)。
- 这个三档正是产品形状的机械化:"设备采集、屏幕确认"——设备可以**发起**任何需要确认的事(卡到屏幕),不能**完成**任何改状态的事。
- console/typed 轮 `ingressOrigin` 为空,三档检查不触发,现网行为零变化。

---

## 3. 鉴权与安全模型

### 3.1 第二枚令牌:`~/.saydo/.capture-token`

- 生成:daemon 启动时 `loadOrCreateCaptureToken(SAYDO_HOME)`,参照 `capToken.ts`(randomBytes(24).toString("base64url") + 0600 + `restrictOwnerOnly`),并加两条 v2 校验(Codex C-2):装载既有文件时校验值为 32 字符 base64url,非法即轮换新值 + audit(现网 capToken 对任意非空旧值原样接受,`capToken.ts:13-17`,capture 面不继承这个宽松);与 `.cap-token` 同值则重抽。两枚令牌由装载校验保证恒等长,`tokenEqual` 的长度早退(`identity.ts:109-115`)无泄露面。
- 存放:仅本机 state root;不进 ntfy、不进 Git、不进 Console localStorage、不出现在日志。
- TTL:与 `.cap-token` 同语义——无过期,删文件重启即轮换。第一刀不做在线吊销。
- 不发明 Noise / 短码 / 逐设备身份:那是 canonical 已规划的 M2 商店配对原语(`docs/09:1207`、`docs/site/2026-08-20-docs-page-content.fable.md:677-679`),capture 面与 mobile_lan 同属"dogfood 临时边界"叙事,不抢跑。

### 3.2 principal=capture 的机械判定

principal 与 via **正交**(v2,Codex B-10:`IdentityVia` 是网络位置 `local|tailnet|mobile_lan`,`identity.ts:12`,不得混入身份主体;不新增 `via=capture`):

1. `verifyIdentity` 增加 `expectedCaptureToken` 入参;命中哪枚令牌决定 verdict 的 `principal: "owner" | "capture"`(现网恒 "owner",`identity.ts:137`;不传新入参的调用方行为不变,含 `recoveryOnlyServer.ts:278`);
2. hello `role` 必须恰为 `"capture"` ⇔ principal=capture(错配即 4003);
3. hub 对 `role=capture` 的上行在 via 检查**之前**按 role 分流(§2.2 红线一):JSON 白名单空集、二进制仅 `0x01`/`0x03`;mobile_lan 的上行/下行白名单只约束 console role,不与 capture 分流交叠。

授权判定一律基于 `(via, principal, role)` 三元组:第一刀允许 `(local, capture, capture)`;PR2 增 `(mobile_lan, capture, capture)`(位置语义如实:LAN 明文);`(tailnet, capture, *)` 恒拒。

### 3.3 准入矩阵

| 场景 | 结果 | 码 |
|---|---|---|
| capture 令牌 + HTTP `/api/*` 或 `/dev/*` | 403 | `token_scope_rejected`(新) |
| capture 令牌 + hello role=console 或 pipeline | 拒连 4003 | `token_scope_rejected`(新) |
| owner 令牌 + hello role=capture | 拒连 4003 | `capture_token_required`(新) |
| principal=capture 且 via=tailnet(PR2 前也含 mobile_lan) | 拒连 4003 | `capture_via_rejected`(新) |
| 第二个 capture peer | 拒连 4003 | `capture already connected`(对齐 pipeline 单 owner,`hub.ts:340-344`) |
| capture 发任何 JSON / 0x01、0x03 之外的二进制 | 丢弃 + 节流日志 | — |
| Host/Origin/token 既有失败 | WS 身份拒绝统一 close 4003 + reason(`hub.ts:183-191`);HTTP 面 403 | `host_rejected` / `origin_rejected` / `token_missing` / `token_mismatch` |
| 版本/hello 超时(既有,与身份无关) | 4001 = 协议版本或 runtime 失配;4002 = hello 超时 | — |

`/health`、`/readyz` 本就在身份门外,保持无 token 语义(`index.ts:707,734`)。

两点显式声明:(a) 错误码区分令牌身份(`capture_token_required` vs `token_scope_rejected`)是可接受的诊断换损;(b) `SAYDO_DISABLE_CAP_TOKEN=1`(dev 显式关闭)时 capture 面同禁,不存在"owner 门关了 capture 门还开"。

### 3.4 攻击面与限额(v2 重写威胁模型)

丢卡(令牌泄露 + 同网段)后攻击者**能做**的,如实分层:

- 推音频、对 Brain **说话**——这是对话输入权,不可再压缩(压缩即设备无用)。具体能做到:提问并获取 Brain 口头回答中不涉密的信息(TTS 本身有脱敏层,`hub.ts:798-801`);让 Brain **建立**待确认卡(propose 档)——卡出现在 owner 的 Console 上,等 owner 裁决,攻击面=骚扰/社工;污染对话史与转写;向 M0 提名候选记忆(candidate 档,M0 拒第三方 + candidate→trusted 人工闸承接,AGENTS.md 硬规则 4)。
- **做不到**(每条有机械拦截):完成任何确认(词表环拦截 §2.6 / 自动接受禁用 §2.6 / confirm.click、confirm.decision 不在白名单);调用任何 deny 档写工具(§2.7 fail-closed);dispatch(经确认链,不可达);伪造转写(asr.* 白名单外 + B8);读任何 API / 打 /dev 注入(`token_scope_rejected`);冒充 pipeline(`hub.ts:325-329` + principal 错配拒);影响 S3(`hasTailnetConsole` 只看 console role,`hub.ts:922-926`);无 Console 在连时连成轮都不行(§2.3)。
- 与现网基线对比:mobile_lan 面 owner 令牌可发 turn.text(完整 owner 语义轮,`docs/09:1207`);capture 面的"说话权"经 §2.6/§2.7 约束后**严格小于** mobile_lan 文本轮。删 `.capture-token` 重启即全域失效。

限额(全部在 daemon 缓冲层):

- 单在途轮 1(`captureInFlight`,§2.5——pipeline 任意时刻至多一份 capture PCM + 一个识别任务);
- 单轮字节上限 `CAPTURE_TURN_MAX_BYTES = 1_920_000`(60s @ 16k PCM16;sauc 超长上限 unknown,60s 保守首值);超限 overflow,`0x03` 时弃轮;
- 单帧上限 64 KB(应用层,防单帧进缓冲;如实声明:transport 层 `ws` 未设 maxPayload、缺省近 100MB 的消息聚合内存分配是**现网既有暴露**(`hub.ts:175`),与 console/pipeline 面同构,PR1 不动全局值——pipeline 的 0x02 上行 mp3 帧合法可达数百 KB,全局收紧会误杀;PR2 独立 LAN listener 时对 capture 连接单独设 maxPayload);
- 帧长下限:合法帧总长 >= 7 且 `(len - 5)` 为偶数(tag 1B + seq 4B + 至少一个 PCM16 采样 2B;v1 写 >= 6 是算术错误——Codex C-3);`0x03` 帧恰为 5 字节头;注意这比 console 分支的 >= 5(`hub.ts:588`)更严,实现勿照抄;
- 同时仅一个 capture peer。

### 3.5 审计与可观测

- audit 事件(append-only):`capture.token_created` / `capture.token_rotated_invalid`(装载校验轮换)、`capture.peer_joined` / `capture.peer_left`、`capture.turn_dropped {reason}`(同 reason 连续发生按窗口聚合计数,防 burst 刷审计)、`confirm.capture_turn_ignored`、`capture.tool_denied {tool}`(§2.7 deny 档触发)。转写正文不进 audit(digest 纪律,AGENTS.md 硬规则 6)。
- 结构化日志:弃轮 reason、scope 拒绝、overflow;沿用 `safeWarn` 节流风格(`hub.ts:592-599`)。

---

## 4. 设备侧对接合同(daemon 承诺的稳定面)

| 项 | 值 |
|---|---|
| WS URL | 第一刀 `ws://127.0.0.1:<port>/ws/voice?token=<capture-token>`;PR2 真机 `ws://<rfc1918>:<port>/ws/voice?token=<capture-token>`。port 缺省 47100。严禁使用 `just t2-pair` / 手机配对的 `http://...?token=` URL(那是 owner 令牌) |
| 鉴权 | query `?token=` 或头 `x-saydo-token`(`identity.ts:162-172`),值 = `.capture-token` 内容;不带 Origin 头(非浏览器客户端) |
| hello | 首条 JSON `{"v":1,"role":"capture"}`,5s 超时(4002);无 identity 字段。这是设备唯一一条上行 JSON |
| hello.ack | `{"t":"hello.ack","v":1}`——与现网完全一致;设备收到即可采麦 |
| 上行·音频 | 二进制 `0x01 + 4B BE seq + PCM16LE 16k mono`;建议 320 samples/20ms/640B payload(与 Console 同参);seq 从 0 单调递增(daemon 不校验 seq 序,如实声明);合法帧总长 >= 7 且 payload 偶数字节,单帧 <= 64KB |
| 上行·结束 | 每轮一条二进制 `0x03 + 4B BE seq`(共 5 字节,零 payload)= "本轮说完"。**不再有任何上行 JSON 轮次信号**(v2 简化:设备零会话概念、零占位 id) |
| 上行·禁止 | 一切 JSON(hello 除外)与 `0x01`/`0x03` 外的二进制 tag;发了即丢,连发不断连 |
| PTT 边界 | 按下只推 `0x01`;松开发一条 `0x03`;设备端不做 VAD、不做端点检测 |
| 单轮上限 | 60s(1_920_000 字节 payload);超限整轮作废 |
| 短轮语义 | pipeline 侧 <3200B(约 100ms)出空 final,不进 Brain(轮次守恒,`hub_client.py:450`) |
| 成轮前提 | daemon 侧要求该会话有本机 Console 在连(§2.3);Console 全关时设备轮被静默弃掉——固件 UI 措辞用"已发送",不承诺已受理 |
| 下行 | **没有。** 不会收到任何 JSON 广播或 0x02 帧;固件不要解析下行,未知数据忽略。`capture.turn_result` 回执与喇叭下行同批留 PR3 |
| 失败码 | 4001 版本 / 4002 hello 超时 / 4003 + reason(§3.3);HTTP 面误用 403 `token_scope_rejected` |
| 重连 | 建议指数退避(1s 起,cap 30s,与 pipeline 客户端同策略,`hub_client.py:124-145`);重连后从 hello 重新开始 |

带宽佐证(工程判断,非仓内证据):裸 PCM 上行 32 KB/s ≈ 256 kbps,ESP32-C3 802.11n 承载充裕;第一刀不引入压缩(仓内 ASR 只吃 WAV/PCM,opus/amr 无解码器,ADR-101)。

---

## 5. 契约与 canonical 回写清单(全部 additive)

| 文件 | 改动 |
|---|---|
| `packages/contracts/src/types/pipeline.ts` | `turn.done_speaking` 与 `asr.partial|asr.final` 各加 `origin: z.literal("capture").optional()` |
| `packages/contracts/src/runtime.ts` 相关常量 | `RUNTIME_PROTOCOL_VERSION` 1.0.0 → 1.1.0(capture origin 透传的 capability 语义;major 兼容不变) |
| `docs/09-data-contracts.md` §10 | PipelineMsg 同步 origin 字段;二进制帧段补 `0x03`(采集结束,工程自决区回写);新增 capture role 段:上行空白名单、B8 不放宽、origin 盖章/剥离、单 capture owner、版本门、工具三档;措辞参照 M1 mobile_lan 段(`docs/09:1207`)"dogfood 临时边界"口径 |
| `docs/09-data-contracts.md` §11 | 文件布局加 `~/.saydo/.capture-token`(0600 条目援引 `docs/09:123` 句式) |
| `docs/09-data-contracts.md` §13 | 工具三档分类表(read / propose / deny)与 fail-closed 规则 |
| `docs/03-architecture.md` / `docs/04-key-mechanisms.md` | 如触及,仅加注 capture 采集面一句话与指针(AGENTS.md canonical 纪律,文档与实现同工作单元) |

不新增独立 WS 协议版本:capture 仍走 `v:1`;`VOICE_WS_PROTOCOL_VERSION` 不动(runtime protocol minor 才是 capability 载体)。

---

## 6. PR 切片

### PR1 — 第一刀:本机假 peer 打通(无板子必须能合)

生产改动文件(全部列出,超出即越界):

| 包/文件 | 改动 |
|---|---|
| `packages/contracts/src/types/pipeline.ts` | origin 双字段(§5) |
| `packages/contracts/src/runtime.ts`(或版本常量所在文件) | RUNTIME_PROTOCOL_VERSION → 1.1.0 |
| `packages/daemon/src/net/captureToken.ts`(新) | `loadOrCreateCaptureToken`:生成 + 装载校验(32 字符 base64url,非法轮换 + audit)+ 与 owner 令牌同值重抽 |
| `packages/daemon/src/net/identity.ts` | `expectedCaptureToken` 入参;verdict `principal: "owner" | "capture"`;两枚令牌顺序各一次 timingSafeEqual |
| `packages/daemon/src/voice/hub.ts` | `PeerRole` 加 `"capture"`;hello 接受 capture(principal 校验、单 owner、不启 console 心跳、不登记 sessionIds);**红线:capture 上行在 routeJson/routeBinary 最前按 role 分流,绝不进 dispatch/转发路径(§2.2)**;capture 缓冲(累积/单帧 64KB/帧长 >=7 偶 payload/overflow/断线清弃);`0x03` 触发 flush(判定 a-h)+ 合并单帧两消息提交;§2.5 四影子值维护(shadow (mode,sid) / consoleMicResidual / consolePttInFlight / captureInFlight,置零点全按该节);console peer 新记 `lastVoiceModeSessionId`;console 来源 done_speaking 剥 origin;origin=capture 的 asr.* 不广播 console 且经独立回调上抛;`verifyUpgrade` 透传 principal;`resolveCaptureSession` 回调注入;pipeline minor 版本门 |
| `packages/daemon/src/index.ts` | 装载 capture token(`SAYDO_DISABLE_CAP_TOKEN=1` 同禁);checkIdentity 透传 principal;`/api/*` `/dev/*` 对 principal=capture 403 `token_scope_rejected`;`resolveCaptureSession` 实现(§2.3);`handleCaptureFinal` 独立 handler(§2.6 五步);audit 事件。注:RECOVERY_ONLY 走 `recoveryOnlyServer.ts` 独立组装(不构造 VoiceHub、不装载 capture token),capture 面自然不存在;但 `recoveryOnlyServer.ts:278` 也调 `verifyIdentity`,verdict 类型加宽须过该文件 typecheck(不传新入参,capture 令牌在恢复面恒 `token_mismatch`,行为安全) |
| `packages/daemon/src/live/dialog.ts` | `onAsrFinal`/`runUserTurn` 接受 `{origin}`;capture 轮:`ensureSession` 先于 `onUserTurnBegin`(仅 capture 分支调序);`scheduleAutoAccept` 按轮 origin 抑制;撤销词法直通对 capture 轮关闭、收尾保留(§2.6) |
| `packages/daemon/src/brain/registry.ts` | `ToolContext` 加 `ingressOrigin?: "capture"`;执行前三档检查 + 未分类 fail-closed(§2.7) |
| `packages/daemon/src/brain/liveTools.ts` | 全量工具三档分类常量(read/propose/deny;实施时逐个枚举,评审逐个过) |
| `pipeline/src/saydo_pipeline/hub_client.py` | done_speaking → asr.final 的 origin 透传(约 3 行)+ RUNTIME_PROTOCOL_VERSION 缺省值同步 1.1.0 |
| `docs/09-data-contracts.md` | §10/§11/§13 回写(§5) |

测试与脚手架文件(同 PR 交付):`packages/daemon/test/voice-hub-capture.test.ts`、`capture-identity.test.ts`、`capture-session.test.ts`、`capture-tools.test.ts`(新四件);`packages/contracts/test/schemas.test.ts`(origin/版本常量断言追加);pipeline 侧 origin 透传 pytest;`e2e/smoke/fake-capture-peer.mjs`(新,参照 `asr-loop.mjs`)。

**明确不改**:`packages/console` 全部、`packages/cli`(仍 up|status|open)、`confirmVocab.ts`、`live/confirm.ts` 词表与收据语义、S3/`s3Guard.ts`/WebAuthn、`/dev/*` 语义(仅叠加 capture 令牌拒绝)、`mobileLan.ts`、回叫引擎(`callback/`)、pipeline 除 origin 透传与版本常量外的一切。

**验收标准与门禁(可判定)**:

1. `pnpm -r typecheck && pnpm -r lint` 绿;
2. `pnpm --filter @saydo/daemon test` 与 `pnpm --filter @saydo/contracts test` 绿;pipeline `pytest` 绿;
3. `just ci` 双矩阵绿;`scripts/check-emoji.sh` 过;
4. 冒烟(真 pipeline,需 VOLC 凭据):`just dev` 起全栈,**前置:开一个本机 Console 页并进入对话页(成轮要求 console 在连,§2.3;库空且无 console 时必弃轮 `no_session`,冒烟必红)**;然后 `node e2e/smoke/fake-capture-peer.mjs <16k-wav>` → 退出码 0,判定依据 = `GET /api/sessions/recent-transcript`(owner 令牌,local)最新用户轮 text 含语料关键词(闭环走生产转写落盘,不靠日志 grep);
5. 反向冒烟:同脚本以 capture 令牌发 `confirm.click` 与 `asr.final`(JSON)→ daemon 全部丢弃,无 pending 消费、无 Brain 触发;
6. 工具面冒烟:capture 轮语料说"取消任务 <已知 taskId>" → 任务状态不变 + audit 出现 `capture.tool_denied`。

### PR2 — 真机 LAN(板到货前可全部写完,Device tests 到货后跑)

- `identity.ts`:**不新增 IdentityVia 值**(principal 与 via 正交,§3.2)。但判定顺序仍需结构性重排:现网合同 Host → Origin → token(`identity.ts:142-158`),而 (mobile_lan, capture) 组合要求令牌先证 principal、再按 principal 选 Origin 规则——设备无 Origin 无 Referer,现网 mobile_lan 无 Origin 分支要求同 Host Referer(`identity.ts:88-97`)会拒;capture principal 须豁免浏览器门(它不是浏览器,CSRF 面不存在)。实施前先写出新判定顺序表(Host 归位置 → token 归 principal → 按 (位置,principal) 选 Origin 规则),并对 mobile_lan 面做全量回归矩阵(两开关 x 两令牌 x 有无 Origin/Referer);
- hub:capture 分流在 via 检查之前已是 PR1 形态,PR2 仅放开 `(mobile_lan, capture, capture)` 准入;
- 监听单源:`SAYDO_CAPTURE_LAN=1` 新开关,与 `SAYDO_MOBILE_LAN` 独立,任一开启才绑 `0.0.0.0`(`mobileLan.ts:7-9`、`index.ts:283`);
- capture 连接的接收侧设 maxPayload(独立 listener 或按连接,§3.4);
- `GET /api/capture-pairing`(via=local only,复用 `pairing_local_only`):返回 `{ wsUrl, lanIp, port }`,body 只含 capture 令牌;与手机配对的 `http://...?token=<owner>` 严格分列。**配对最后一公里是 PR2 开放设计项**:ESP32-C3 无摄像头,二维码对设备无用;令牌进设备的通道大概率是固件侧 AP 配网页/BLE/串口(仓外),但可能反过来约束 daemon API 形态(短时效配对码是新原语,与 §3.1 不抢跑 M2 的纪律要平衡)。PR2 开工前与固件侧对齐后定案;
- 测试:LAN + owner 令牌仍走 mobile_lan 浏览器门(回归);LAN + capture 令牌 + role=capture 才过;mobile_lan console 的二进制仍拒;tailnet + capture 令牌拒。

### PR3 及以后(不承诺排期,按到货实测反哺)

- **无 Console 独立成轮**:依赖喇叭下行落地(设备成为播放端,AI 句 heard 语义闭合)+ delivery-aware 结算设计;届时重开 §2.3 的 DB 兜底解析并解决 v1 已识别的 closed/悬置/歧义问题。**部署前提如实**:"无 Console"指浏览器界面全关、人不在屏幕前——daemon+pipeline 仍常驻在 owner 的 Mac 上(执行面=本机,产品既定架构),Mac 必须开机在线且与设备同一 LAN;笔记本合盖睡眠即全链失效。把执行面搬到常开小主机是独立的部署形态决策,不属本方案;
- Console 正确展示 capture 轮:`useVoiceChannel.ts` asr.final 分支按 origin 分流(顺手补 sessionId 过滤,修 §1.2 既有冒领缺陷),届时放开广播过滤;同批处理 B 级已知项"capture 轮回答仍会上屏出声而问题气泡缺失"(第一刀如实接受:Console 在场,回答可听可见,唯问题文本不上屏,PR3 补齐来源标注展示);
- `capture.turn_result` 下行回执(设备屏显示受理/弃轮原因);
- 喇叭下行探索:0x02 是 mp3(`hub_client.py:515`),ES8311/ESP32-C3 解码能力 unknown,可能需 pipeline 转 PCM 下行新 tag;
- 确认窗口内被拦轮的转写落盘(TranscriptTurn origin 扩展);
- capture 轮排队(console 在途时延后而非弃轮)、在线吊销 API、Noise 配对(并入 M2 商店配对线)。

---

## 7. 测试计划

### 7.1 Host tests(vitest,仿 `packages/daemon/test/voice-hub.test.ts` 假 peer 形态)

hub 层(`voice-hub-capture.test.ts`):

1. capture hello → ack `{t,v}`;推 0x01 若干 + 0x03 → 假 pipeline 收到**一条**合并 0x01 帧(payload = 各帧 payload 按序拼接)+ 一条 `done_speaking{sessionId:<解析值>,origin:"capture"}`;
2. 红线断言:全流程 pipeline 收到的 done_speaking 仅此一条(无第三来源);capture 发任何 JSON(含合法形状的 done_speaking/confirm.click/asr.final)→ 全部丢弃,dispatch 零触发;
3. 假 pipeline 回 `asr.final{origin:"capture"}` → capture handler 触发,console 假 peer 收不到(冒领防御);无 origin 的 final 照常广播(回归);
4. console 采集在途:console 0x01 已转发未发 done(consoleMicResidual)→ 弃轮 `console_residual`;console done 已转发 final 未回(consolePttInFlight)→ 弃轮 `console_busy`;pipeline 均未收到 capture 字节;
5. 清零点:console 按住中断线 → residual 保持 true、capture 持续弃,pipeline 重连(onPipelineJoined)后恢复;console done 后 pipeline 断线 → onPipelineLeft 清零计数,capture 不永久卡死;capture 的带 origin final 不减 consolePttInFlight;
6. 单在途闸:第一轮 flush 后 final 未回,第二轮 0x03 → 弃轮 `capture_busy`;final 回来后恢复;burst 连打 N 轮 → pipeline 任意时刻至多持有一份 capture PCM;
7. 版本门:假 pipeline hello 报 protocolVersion 1.0.0 → capture flush 弃轮 `pipeline_incompatible`(连接与现网功能不受影响);报 1.1.0 → 放行;
8. shadow mode=hands_free → 弃轮 `hands_free_active`;切回 ptt 恢复;pipeline 重连后 shadow 重置 ptt;
9. 无 pipeline peer → 帧仅入缓冲,flush 弃轮 `no_pipeline`;超限(>1_920_000B)→ overflow 弃轮;单帧 >64KB / 总长 <7 / payload 奇数 → 丢帧;下一轮从零正常;
10. capture 断线(按住中)→ 缓冲清弃,pipeline 零字节;
11. console 发带 origin 的 done_speaking → origin 被剥;第二个 capture peer → 4003;断开后新 peer 可入;
12. 回归:console 0x01 照常转发、pipeline/console 伪造 asr.final 仍丢、console 空 final 仍走 settlePendingSpeech、mobile_lan 白名单不变(既有用例不红)。

身份层(`capture-identity.test.ts`,仿 `tier1-security.test.ts`):

13. capture 令牌 + 环回 Host + 无 Origin → verdict ok principal=capture;
14. capture 令牌打 `/api/attention`、`/dev/inject` → 403 `token_scope_rejected`(/dev 尤其:防用采集票注入伪造 asr.final);
15. owner 令牌 + role=capture → 4003 `capture_token_required`;capture 令牌 + role=console|pipeline → 4003 `token_scope_rejected`;
16. 令牌装载:两枚同值 → 重抽;`.capture-token` 内容非 32 字符 base64url → 轮换新值 + audit;
17. `recoveryOnlyServer` typecheck 面:verdict 类型加宽后既有测试不红。

会话与对话环(`capture-session.test.ts`):

18. 有 local console peer(已发 voice.mode)→ 取其 lastVoiceModeSessionId;切换会话(两次 voice.mode 不同 sid)→ 取新 sid;跨 console 多 peer → 取 voice.mode 最近者;
19. 无 console peer(或有 peer 但从未发 voice.mode)→ 弃轮 `no_session`,零会话创建;
20. sid 未入库 + console 在连 → final 经 ensureSession created 成轮(转写落盘),console 收到 session.project;
21. suspended + console 在连 → flush 不 rebuild(状态原样),final 到达经 runUserTurn rebuild 且 `rebuilt=true`(readinessAssemble 触发);flush 后 final 前被收尾 closed → handler 只读复查丢轮,进程不炸,无 L0 ack 残留(capture 分支 ensureSession 先于 onUserTurnBegin);
22. pending 确认存在 → capture final 不进词表环不进 Brain,audit `confirm.capture_turn_ignored`;console 同文本 final 照常进词表环(对照);
23. capture 空 final → 不触碰 settlePendingSpeech;capture final 到达时 console hold 旗在队 → hold 队列长度不变(capture 不消费 hold);
24. 在途用户轮 → flush 弃轮 `user_turn_in_flight`;flush 后 final 前 console 开新轮 → handler 第 4 步丢弃,console 模型轮未被 abort;
25. capture 轮触发 Brain 建卡 → confirm.card 发 Console 且**无**自动接受倒计时(`scheduleAutoAccept` 被抑制);console 轮建卡 → 倒计时照常(对照)。

工具三档(`capture-tools.test.ts`):

26. 分类完备性:注册器全部工具都有显式三档标注,新增未分类工具时 capture 轮调用被拒(fail-closed 断言);
27. capture 轮调用 deny 档(cancelTask/remember/undo 词法)→ 拒 + 固定话术 + `capture.tool_denied`,状态零变化;console 轮同工具照常(对照);
28. capture 轮调用 read 档 → 放行;propose 档 → 卡照建、无倒计时。

### 7.2 冒烟与真机

- `e2e/smoke/fake-capture-peer.mjs`:见 PR1 验收 4/5/6;正弦波音频出空 final 也算合法轮(轮次守恒,与 PROCESS-JOURNAL 既有探针口径一致)。
- **Device tests(到货后,当前 NOT RUN)**:capture 令牌能连/owner 令牌不能当采集;PTT 一轮一条 final 且转写落盘;弃轮场景(无 Console/免手/console 按住/连按两轮)设备侧无异常;JSON 全拒;断电/断网中途半轮零污染;Wi-Fi 弱信号下的实际转写质量;固件按 §4 合同的实际产出(布局/字节序/采样率/0x03 时序)。

---

## 8. 生态定位与移动端延伸(2026-08-26 外部调研)

### 8.1 移动端"弱客户端"模式:成立,且零新增合同

"弱客户端推原始音频"对所有现代移动端技术上成立——桌面 Console 采集本就是浏览器 `getUserMedia → AudioWorklet → PCM16 16k → 0x01 帧`(`useVoiceChannel.ts:236-300`),手机浏览器/WebView/原生壳同构可跑。现网手机走"系统语音识别 + turn.text"、mobile_lan 拒二进制(`docs/09:1207`)是产品决策而非技术限制。给用户开弱客户端选项的真实价值:设备端 ASR 质量参差(Android WebView 无 SpeechRecognition API),而 daemon 管线独有热词偏置(`asr.hotwords`,用户术语表)、轮次守恒、latency 埋点与成本记账。代价:约 256 kbps 上行带宽、电量,及手机浏览器后台/锁屏采音受限(可用形态是原生壳)。

架构结论:capture 面是设备无关合同——手机走弱客户端 = "又一个 capture 设备":持 capture 令牌开第二条 WS 推音频,原有 mobile_lan console 连接(看卡/确认/文本)并存,双连接双角色在连接级天然隔离,零新增合同。手机场景还天然满足 §2.1 原则 5(它自己就是在连的 console/播放端)。第一刀不实施手机接入,但合同不需为它改动。

### 8.2 通用化:不自研通用网关,通用性放协议适配层

外部调研结论(2026-08-26;来源见文末 Sources):"让外部设备语音调用 AI 服务"的通用生态位已被成熟占据——

| 项目 | 形态 | 与本方案关系 |
|---|---|---|
| Wyoming protocol(Home Assistant / Rhasspy / OHF-Voice) | TCP + JSONL 事件头 + PCM 载荷;卫星标准;16k/16bit/mono | 音频参数与 capture 面完全一致;传输层不同(TCP 裸流 vs WS) |
| 小智 xiaozhi-esp32 + xiaozhi-esp32-server | WS + opus(兼容 PCM/G.711);服务端 Python/Java 双实现,MCP 接入点 | 中文圈事实标准,即"通用语音网关"本体;协议含 TTS 下行/IoT 指令等 SayDo 不需要的面 |
| pipecat-esp32 / LiveKit ESP32 SDK | WebRTC | SayDo pipeline 即 Pipecat 框架;但 WebRTC 栈官方在 ESP32-S3 验证,无 PSRAM 的 C3 上紧张 |

三层分工(裁量):

1. **daemon 内**:只做本方案的窄 capture 面(权威层必须内置——§1 三死穴 + §2.7 工具权限只有权威层能执行);
2. **协议适配放仓外 bridge**:接 Wyoming 卫星/小智固件设备/其他现成硬件时,写百行级转换器(如 Wyoming TCP→capture WS、opus 解码→PCM),持 **capture 令牌、零特权**——与被否掉的"owner token 代持 bridge"(§8.3)本质不同:那是权限代持,这是纯协议翻译;
3. **不自研通用网关项目**:生态位已满,单人 dogfood 产品做通用服务属偏航。

摆一个反向选项供 owner 否决:daemon 直接实现小智或 Wyoming 服务端子集,现成固件即插即用。代价:opus 解码器进管线(仓内 ASR 只吃 WAV/PCM,ADR-101)、外来协议状态机远宽于自家窄面、B8/轮次守恒需适配层——侵入远大于收益,不采。未来固件若选择直接跑小智固件,以 bridge 承接。

另一调研发现修正了一个前提:**FoloToy ai-passport 仓库是"开发基线 + demo 集合"**(ESP-IDF/FreeRTOS/MIT,仅 Wi-Fi 扫描、BLE 广播等 demo),无既定云端协议、无默认服务端——联网语音应用层固件本就要自己写,"不改固件"实际指不动硬件层。§4 合同表即固件实现规格,不存在"必须适配既有协议"的约束;固件侧可反向借小智生态的成熟模块(音频驱动/AEC/屏幕 UI),属仓外事务。

### 8.3 外挂 bridge(owner token 代持)形态:不可作为生产通道(对抗评审结论)

独立评审对"bridge 持 owner 令牌以 console role 代推"的机制级否定,要点存档:(a) bridge 入场即获 console 全量白名单(`hub.ts:126-138`),且发一条 voice.mode 登记 session 后 `sendConsoleEvent` 会把含 digest 的 confirm.card 定向投给它(`hub.ts:804-820`)——攻破 bridge 即可凭 digest 发 confirm.click 完成 S2 放行;(b) bridge 轮与真 console 轮在 daemon 侧不可区分,词表环旁路无法关闭;(c) 混流与冒领全额回归(§1.1/§1.2 机制原样);(d) bridge 常驻使 `hasConsolePeerForSession` 恒真(`hub.ts:732-752`),K2 幽灵收尾防护、S1 上屏话术门、确认卡投递三条链的"console 在场"语义全部被污染;(e) 部署两难:同机则设备→bridge 段鉴权自造(违背不抢跑 M2 纪律),异机则 mobile_lan 拒二进制推不进音频。唯一可接受形态:降格为 `e2e/` 手工试音脚本(等价 `asr-loop.mjs` 地位),无真 console 在连、无 pending 确认时人工执行,不常驻、不进生产文档。

---

## 9. 风险与开放问题

| 风险 | 状态 |
|---|---|
| 语音注入 Brain(丢卡残余风险) | 残余=对话输入权(§3.4 v2 口径:可问、可建待批卡、可污染转写与 M0 候选);经 §2.6/§2.7 约束后严格小于 mobile_lan 文本轮;LAN 面默认关(`SAYDO_CAPTURE_LAN` 显式开) |
| capture 轮问题气泡 Console 不可见(回答仍上屏出声) | 有意限制:防冒领优先;Console 在场故回答可听;PR3 补来源标注展示 |
| 弃轮设备无感(第一刀无下行) | 有意限制:固件本地提示"已发送"不承诺受理;PR3 回执 |
| 无 Console 不成轮(第一刀) | 有意收窄(unheard 纪律,`docs/09:1039`):设备无播放端时"对话"不闭合;PR3 与喇叭同批重开 |
| Console 轮可能排队最多一个 capture ASR(<=90s) | 有意接受(§2.1 原则 4 时延面):单用户单人场景;单在途闸限幅 |
| 收尾词法直通对 capture 生效;撤销已关闭 | 有意裁量(§2.6),owner 可否决 |
| capture 打断控制轮 / TTS 播放中触发新轮 | 有意接受(§2.6 已知残余):控制轮本就可被用户打断;单用户场景 |
| 确认窗口内被拦轮不落转写正文 | 有意取舍(§2.6),PR3 补 |
| 工具三档分类漂移 | fail-closed(未分类即 deny)+ §7.1 用例 26 完备性断言兜底 |
| pipeline 单独重连后 Console 不重发 voice.mode(现网既有缺陷) | 对 capture 方向安全(residual 弃轮);缺陷本体另行立项,不进本方案改动面(§2.5) |
| canonical"握手 runtimeSha 三方一致"与实现只比 protocol major 的既有分叉(`docs/09:986-988` vs `runtime.ts:128-133`) | 不由本方案修;capture 版本门用 minor 判定,独立于该分叉;如实上浮 owner |
| transport 层 ws 无 maxPayload(近 100MB 消息聚合) | 现网既有暴露,与 console/pipeline 同构;PR1 应用层 64KB 兜 capture 缓冲,PR2 独立 listener 收紧 |
| sauc 超长 PTT 上限 | unknown;60s 首值保守,到货实测校准 |
| FoloToy 固件按 §4 合同的实际产出 / USB 网卡是否 RFC1918 | Unverified,到货后验(§8.2 已确认固件本就自写;USB NCM 若得 RFC1918 则按 (位置,principal) 复用,不另开协议) |
| 卡的跨网远程接入(owner 2026-08-26 问) | 不走公网直连(docs/09:1207 红线)。首选路径(owner 同日追问后定向):**手机壳作随身 bridge**——卡经手机热点(Wi-Fi,卡固件与 §4 家用同一套,仅地址不同)或 BLE GATT(iOS 后台友好,需卡侧 ADPCM/opus 轻压缩、壳内解回 PCM)连壳,壳持 capture 令牌经自身 Tailscale 通道转发回家,完全落在 §8.2 协议 bridge 框架内,daemon 侧仅需日后放开 (tailnet,capture) 一格 + 安全评审。次选:卡自跑裸 WireGuard(trombik/esp_wireguard 支持 c3,但 320KB SRAM 与音频并行余量 unknown、无 Tailscale 打洞、需家侧公网入口)。排除:卡做蓝牙耳机(C3 无经典 BT/HFP)。归 M2/PR4;unknown:iOS 热点下游不经宿主 VPN 故必须壳内收转、iOS 后台监听挂起(热点桥)vs bluetooth-central 豁免(BLE 桥)、BLE 实际吞吐,均待真机实测 |
| ES8311/ESP32-C3 的 mp3 解码 | unknown;喇叭下行留 PR3 |
| seq 乱序/丢帧 | daemon 不校验(如实);TCP 保序,乱序仅固件 bug;合并单帧后 pipeline 侧 seq 不再有意义 |
| 记忆提名污染 | capture 轮进对话史即进 M0 候选源;M0 拒第三方 + candidate→trusted 人工闸(AGENTS.md 硬规则 4)+ remember 工具对 capture 轮 deny(§2.7) |

排除项(维持):设备本地 ASR 后传文字(owner 明确排除)、新云 ASR、做成 MCP/DSH 插件主线(仓里已否)、`/dev/*` 生产化、设备固件设计。

---

## 10. 评审记录与诚实分档声明

**评审闭环(2026-08-26)**:

1. subagent 事实核验评审:约 60 处 file:line 全量核对,1 B 级归因错误(restoreFromDb → onVoiceMode 回放)+ 3 C 级措辞,已回修;
2. subagent 架构安全对抗评审:4 A + 6 B + 10 C,A/B 全吸收(store-and-forward 判定机械化、会话解析去副作用、dispatch 红线、入口分流),其对外挂 bridge 的机制级否定存档 §8.3;
3. **Codex 对抗评审(`research/codex-findings/100-capture-device-ingress-adversarial-review.md`,gpt-5.6-sol,判定"需回修后可")**:6 A + 10 B + 4 C。v2 按其回修的结构性变化——(A-1) origin 贯穿工具环 + 三档权限 + 禁自动接受(§2.6/§2.7),威胁模型重写(§3.4);(A-2/C-4.2) 删猜测式版本后备,改 protocol minor 能力门(§2.4);(A-3) 单在途轮闸(§2.5);(A-4/A-5) 第一刀收窄为"Console 在场的第二麦克风",删 DB 兜底解析(§2.1/§2.3);(A-6) 独立 final handler 不进主链、capture 分支 ensureSession 先于 onUserTurnBegin(§2.6/§2.3);(C-4.1) 设备上行零 JSON、0x03 结束帧,删占位 sid 机制;(C-4.3/B-4) 合并单帧两消息提交,"原子"措辞如实降级(§2.2);(B-2/B-3/B-9) 过强承诺全部降级为如实声明(§2.1/§2.6/§9);(B-10) principal/via 正交,不新增 IdentityVia 值(§3.2);(B-1/B-5/B-6/B-7/B-8/C-1/C-2/C-3) 逐条吸收于 §3/§6/§7。Codex 报告中的行号断言经本会话抽查关键四项(scheduleAutoAccept、cancelTask、onUserTurnBegin ack、protocolCompatible)全部属实。

**分档**:

- **Build**:本会话只产出方案文档,未改任何代码,未跑 `just ci`。
- **Host tests**:§7.1 全部用例为待实施计划;现网基线 `voice-hub.test.ts` / `tier1-security.test.ts` / `mobile-lan-process.test.ts` / `live-voice-sessions.test.ts` 作为回归锚(文件存在性已核验,内容未逐条读)。
- **Device tests**:NOT RUN(无板);清单见 §7.2。
- **Unverified**:§9 表内标注项。

---

Sources(§8 外部调研,2026-08-26 检索):

- FoloToy ai-passport: https://github.com/FoloToy/ai-passport
- Wyoming protocol: https://github.com/OHF-Voice/wyoming 、 https://github.com/rhasspy/wyoming-satellite 、 https://www.home-assistant.io/integrations/wyoming/
- 小智协议与服务端: https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket_zh.md 、 https://github.com/xinnan-tech/xiaozhi-esp32-server 、 https://docs.espressif.com/projects/esp-iot-solution/zh_CN/latest/ai/xiaozhi.html
- pipecat-esp32: https://github.com/pipecat-ai/pipecat-esp32 ;LiveKit ESP32 SDK: https://livekit.com/blog/livekit-sdk-for-esp32-bringing-voice-ai-to-embedded-devices
