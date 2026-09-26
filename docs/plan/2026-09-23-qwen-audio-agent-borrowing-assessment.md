# SayDo 语音运行时接入评估与推进方案

日期:2026-09-23。状态:研究候选,未独立验收,未合并。本文件不替代 canonical,不创建第二套排产指针。

## 1. 结论与投入边界

值得投入连续语音协作,不值得把 Qwen-Audio-Agent 整套接入为 SayDo 主运行时。建议保留 daemon/Brain/就绪/决策/审批/Tier1 执行面,优先修现有媒体缺陷,再把 Pipecat 作为媒体组件候选做有边界的对照。LiveKit 为远端 RTC 候选,原生 S2S 为可选呈现能力。

理由不是品牌或星标:SayDo 已有的业务控制比通用语音助理更严格,目前可证实的问题落在媒体实现和证据口径。另加一个 TaskManager、权限策略与记忆源会增加一致性成本,并不能自动消除当前音频缓冲。

本轮已推进至源码复核、同类项目比选、离线故障复现、定向回归和既有 Pipecat spike 复跑。详细证据见 [本轮实验记录](../../research/voice-runtime-20260923/README.md)。具体第一刀为 TTS 合成代际隔离;其余阶段是有进入条件的方案,不是全部立即施工或工期承诺。

## 2. 输入、基线与证据等级

- 完整阅读用户粘贴文章,以及 Downloads 中 Recommendation 649 行、Integration 759 行两份材料。附件中的任务卡/命令/授权话术是参考材料,不作为本次授权来源。
- 当前授权来源为用户要求:调研、判断接入价值、合适则生成方案并开始推进。提交、发布、部署、真人场次不包含在本轮动作中。
- SayDo 现场主树干净,HEAD=`d0b7edce648fe7b54713bc19fa8af143f9d81628`。独立候选位于 `~/.codex/worktrees/saydo-voice-runtime-20260923`,分支 `codex/voice-runtime-assessment-20260923`。
- 附件的 SayDo 基线为 `d57fdb81bc98d4f543df20f6a02212b33a5be2d0`,不能代表今日私人主树。
- 本轮实际 clone Qwen HEAD=`f27aca5130d1985d6f28e3c4c5e8c2c9928a97fd`,package version=1.11.0;附件基线为 `2231a37bdc402356893dff3700a76c2a25fa9dd1`。本轮未安装/启动 Qwen 服务。
- 现有 Python 环境实际查询:Pipecat 1.6.0、websockets 16.1.1、pytest 9.1.1。依赖声明为范围,线上文档与 GitHub main 不能直接当作该已安装版本 API。
- 外部资料读取日为本日。Qwen 做了关键运行代码核查;Pipecat/LiveKit 补充了 TTS/活动代码阅读;Gander/FireRed/FastRTC/TEN 为官方资料与许可层筛选,未声称逐仓代码审计。
- 所有新实验为离线 mock/生产代码调用。无真实 ASR/TTS/LLM 调用、无真实麦克风或扬声器证据,无 SLO、跨端或用户验收结论。

## 3. 对两份 Pro 报告的现场裁决

两份报告的总方向可采纳,但首批任务卡必须重写。

| 论点 | 现场核对 | 裁决 |
|---|---|---|
| HF 在 WS 接收循环内等待完整 ASR | `hub_client.py:279` 创建连接所属任务;`:565` 使用 VAD 锁且 `wait_recognize=False`;`:596` spawn 识别;`:629` 起校验 speech generation | 旧缺陷描述不再适用;保留回归,不重写 HF 状态机 |
| 下一批是 JOURNEY-01 | PLAN-2 当前 revision=14,指向 CODEX-AS-SPIKE-01;VOICE-MEASURE-01 已本地收口 | 附件排产过时;本研究不改指针 |
| 回叫因语音会话一直连接而一直 busy | `index.ts:3662` 使用 `talking && hasUserTurnInFlight`,不是连接存在即 busy | 不能按注释宣布 bug;保护呈现与输出队列窗口仍需专测 |
| ASR/TTS 尚非端到端流式 | 入口仍装配 HubClient/Doubao;ASR 输入完整 WAV;TTS 累积 chunks 后返回;console 用整句 mp3 Blob 播放 | 仍成立,需要上下游一起改,不能只换 SDK |
| 旧合成可能被新句复活 | `hub_client.py:504` 清除 sid 取消标记;`:1244` 合成后只看该标记 | 本轮离线反例已证实旧音频下发,不再只是推测 |
| `tts_first_byte`/`llm_first_token` 是近似值 | 今日修复了 TTS 来源 turn,未改变整句合成/完整响应到达口径 | 保留修复,另设计真实端点,不能混合历史分布 |
| 已有 Pipecat 依赖意味着已接入 | 工程 ADR-001 后记明确“留任但未消费”;生产入口没有 Pipecat Pipeline | 报告对此提醒正确;不重开已定架构决定 |
| 审批需完整呈现、nonce/CAS/receipt | `presentationFull.ts:1`、`:82` 起 consume 规则存在 | 必须保留,不能用 playback.started 替代 |

另有未定量问题:`_say_queues` 是无界 asyncio.Queue,HF 每帧可生成待锁任务;需做资源压测后确定背压容量与满载处理,不把它混进第一刀。当前二进制下行没有媒体 generation,传输层与 console 的迟到帧过滤需要单独合同设计。

## 4. 文章与 Qwen 当前实现的差别

本轮依据固定源码 [Q1]–[Q4],不把文章作为 API 说明书。

1. “八工具”已变为核心工具与按配置开放的能力集合;没有必要追求相同数量。
2. BackendPort 的模型可见输入是单一 instruction,不再附第二份 ASR 描述。SayDo 仍须保存可信原话与修订证据;原话也不自动等于授权。
3. 结果为 content/artifacts,不是文章的 speech/inline。普通口播摘要与审批原文应分流。
4. 播报开始确认与播完分开;当前结果为避免重播使用客户端 playback.started。它不能映射成 SayDo 的完整 heard。
5. `TaskOperations.submit` 的 owner laneLimit=1 仍存在;它是 Qwen 调度选择,不是 SayDo 跨项目排队规范。
6. 状态查询读取 Task,不必再造隐藏控制任务。取消通过后台确认;直接执行重启失败与可重新挂接的委派有区分。
7. ACP 执行轮不设人为墙钟超时;SayDo 的预算/期限仍由自身规则控制。
8. Gateway 编排运行时本身不是额外的协调 LLM。某些 ACP 后台使用持久协调会话,不能因此把所有适配器都画成多一层模型。

## 5. 同类项目选型

### 5.1 Pipecat:默认优先试验的媒体组件

官方提供帧式流水线、TTS 音频上下文、中断处理、VAD 与轮次策略。[P1][P2] 上游 TTS 实现为响应建立 context ID,并协调音频/文本时序 [P3]。这正好对应当前取消标记过粗与整句缓冲问题。

建议用 `TTSSpeakFrame`/TTS provider/自定义 transport 做媒体样机,不加 Python 聊天 LLM、不导入完整业务 context aggregator。daemon 已确认的文本进入合成;识别 final 回到既有 HfRoundMachine 和 daemon。不能让框架与 SayDo 同时决定 final。

工具后台化文档不能直接解决 TypeScript `registry.dispatch` 等待。那是另一条业务受理链,无需搬迁工具到 Python。框架 BSD-2-Clause 原文已核;模型/插件许可另核 [P4]。

### 5.2 LiveKit Agents:有条件的第二候选

其 async tools 支持后台工作与 foreground 交互窗口;取消需选择开启,重复调用策略按工具名而非业务正文判定。[L1] 可借其前台交互互斥思路,但不把 asyncio 取消当作已撤销业务副作用,不把重复工具抑制当作 request 幂等。

跨公网弱网、原生移动端 RTC、多参与者或媒体运维需求经实测成立时,完整 LiveKit 才可能抵消新增 room/server/transport 成本。当前不为本地单人流程增加媒体服务。Agents 框架 Apache-2.0 已核;turn detector 权重、降噪服务与托管能力不能从框架许可推定 [L2]。

### 5.3 Qwen-Audio-Agent:机制参考,不作为生产依赖

可借任务受理/回流分离、后台事件归一化、结果租约、取消确认与 adapter conformance。其整体产品与 SayDo 重叠最大。默认不 fork、不常驻第二 Gateway、不共享数据库、不接 always 权限映射、不建第二份 USER/MEMORY。[Q1]–[Q4]

如果未来有实证收益,独立 Qwen PoC 仅允许只读状态说明或创建待核对提议。BackendPort 不是绕过 Gate 0 的 dispatch 接口。需隔离实例/数据目录,禁用可选记忆和任意 MCP;做不到轻接就退出。代码 Apache-2.0 LICENSE 已读取,不代表云服务、声音与模型同许可。

### 5.4 Gander:研究交互模型,不成为桌面依赖

官方设计有 trusted user turn、main 补充与 fork 只读旁问、execution generation。值得借的是“修改主目标后旧结果不能冒充新完成”的约束。发布配置为三 GPU 的 Thinker/Talker/ASR 分工,不能据此推断最低部署需求,但本轮无理由将其作为普通桌面首装项。[G1]

### 5.5 FastRTC:适合独立媒体验证台

可把 Python 函数接到 WebRTC/WS,并提供 Gradio/FastAPI 接入;MIT 原文已核。[F1][F2] 适合隔离验证 provider,不是 durable 业务/审批框架。SayDo 已有 console,引入第二 UI 和连接协议未见净收益,本轮不接。

### 5.6 FireRedChat:私有化声学能力备选

官方列出 pVAD、中文/英文 EoT,系统由 LiveKit、Redis、ASR、TTS、LLM 服务组合。[R1] 可用于后续私有化声学对照;未验证 Apple Silicon 消耗、中文混合代码词、延迟或权重分发条款。README 的隐私宣传不等于实际部署的数据边界证明,当前不接整套。

### 5.7 TEN:许可不满足默认纳入条件

根 LICENSE 在 Apache 基础上另加终端设备部署与竞争相关条件 [T1]。它不能按普通 Apache 包直接纳入 SayDo 桌面发行。本轮仅研究思路;独立 TEN VAD/turn detector 的许可不得由主仓推定,选择具体制品时再核。

### 5.8 原生实时模型:与框架选择正交

OpenAI 官方提供 Realtime 与服务器侧控制;工具执行/授权仍属于应用,媒体流与控制通道可拆 [O1][O2]。Qwen 官方同样提供 WS/WebRTC,型号、区域、转写与函数能力按具体配置核验 [A1]。

首次仅允许普通对话、已核实状态与结果解释;形成决策/更改范围/记忆写入/派发仍回 daemon。审批固定文本用受控 TTS 或屏幕卡。Provider 无可靠转写或音频对应关系时,降低能力而不是推断批准。本轮不选定付费型号,不承诺成本或账户可用性。

## 6. 有界借鉴清单

A=可直接采用的原则/评估方法,不是直接复制代码;B=结合现合同改造;C=本轮不借。共 14 项:A 2 / B 7 / C 5。

| ID | 内容 | 类别 | SayDo 承重现状与动作 |
|---|---|---|---|
| VR01 | 按运行源码而非 README 宣称流式 | A | 入口、provider、播放器逐层追踪,本轮已执行 |
| VR02 | 同一录音/设备/provider 的对照实验 | A | 复用现有 Pipecat spike,补真机对照,不跨口径比速度 |
| VR03 | 音频上下文/合成代际 | B | sid 取消标记不足,第一刀补失效令牌 |
| VR04 | 流式 TTS 帧及背压 | B | 整句 MP3 不能逐块直接当新句播放;新增协商合同后实施 |
| VR05 | 声学 VAD 与语义 EOU 分离 | B | 保留现 HfRoundMachine,detector 只提供候选边界 |
| VR06 | adapter conformance | B | 围绕身份/终态/取消/回收做媒体兼容测试,不引 BackendPort 业务权威 |
| VR07 | 安全插入窗口/结果租约 | B | 复用 callback outbox 与现 busy 判定,验证保护呈现与多端仲裁 |
| VR08 | 长工具真实受理 | B | 已有 dispatch 边界;逐工具评等待语义,不批量去 await |
| VR09 | 原生 S2S 呈现 | B | 新 provider 受限能力区,审批回受控文本 |
| VR10 | 完整 Qwen TaskManager/Gateway | C | 重复 daemon/任务状态,没有证明收益 |
| VR11 | owner 全局固定会话/FIFO | C | 不替代项目/工作线隔离 |
| VR12 | 自动 Markdown 长期记忆 | C | 保留 candidate→trusted,不新增第二事实源 |
| VR13 | started 即 heard / always 批准 | C | 冲突于现 presentation 与 S3 红线 |
| VR14 | TEN/Gander/FireRed/FastRTC 默认全栈 | C | 许可/部署/重复组件成本未获收益证据 |

## 7. 目标结构与所有权

```text
控制台/终端采集与播放器
          ↕ 授权后的音频与实际播放事实
VoiceHub:身份、session、来源、媒体绑定
          ↕ 当前协议兼容;新版能力显式协商
媒体进程:Legacy WS 或 Pipecat 媒体实现(一次一个)
          ↕ final/partial/播放水位/中断/健康
SayDo daemon:durable 对话证据、Brain、就绪、决策、审批
          ↕ 幂等命令与已验证执行事件
现有 Tier1 执行面 → settle → callback outbox → 安全窗口
```

图为职责关系,不是把音频绕回 daemon 两次。实际链仍经 VoiceHub 路由。任务、批准、预算只有既有 owner;媒体引擎不访问业务 SQLite,不创建任务状态副本。S2S 未来进入同一受限呈现端口,不与 Brain 并行解释和执行同一用户轮。

## 8. 第一刀:修 TTS 取消复活,不改 wire

### 8.1 本轮复现

探针见 [probe_tts_interruption.py](../../research/voice-runtime-20260923/probe_tts_interruption.py),输出见 [probe-result.json](../../research/voice-runtime-20260923/probe-result.json)。调用生产 HubClient,Fake TTS 使用 Event 卡住第一句:

1. 入队旧句,等待合成已启动。
2. 同 sid 发送 barge_in。
3. 在旧合成返回前入队新句。
4. 放开旧合成,观察 binary sentence ID。

对照组(无新句)不下发音频;实验组下发 old-sentence、new-sentence,违反旧句不得复活,探针 exit=1。它证明 pipeline 下发问题,不是实际扬声器播放测试。静态下游 `hub.ts:839` 转发、`useVoiceChannel.ts:590` 起按 binary 建 Blob,所读分支没有 response generation 过滤。

现有测试 `test_cancel_drops_inflight_and_later_sentence_stays_on_its_turn` 是先等待旧 worker 退出再加入新句,因此不能覆盖该交错。定向四文件 62 项通过与本反例失败不矛盾。

### 8.2 建议实现

- 每 sid 保持一个当前输出令牌;tts.say 在入队时捕获令牌,不是合成返回时读取最近 turn。
- barge_in 更换令牌并清除旧排队项;新句只能持新令牌。合成后的旧令牌永不重新有效。
- 连接 reset 退役所有令牌、取消并等待连接所属任务;不把重置后的编号复用成旧输出身份。内部对象令牌或连接 epoch + 单调序号均可,不必引新的持久化表。
- 合成返回、空音频二次合成、latency 事件与 binary send 前核验连接/输出令牌。只停止媒体,不得取消业务任务。
- 本刀不改 HF、不加流式 wire、不改审批、不迁移 Pipecat、不把底层取消成功当执行取消确认。
- 为避免新句仍等待旧供应商到超时,可单独评估取消在途 synthesize 子任务的安全性;最低正确性修复先保证旧输出不发送,时延优化另验。不盲取消整个队列 worker 而丢新句。

### 8.3 最小验收矩阵

| 场景 | 必须结果 |
|---|---|
| 打断后无新句 | 旧音频/旧指标均不发 |
| 打断后旧合成未返回即来新句 | 只发新句,旧 turn 不记首声 |
| 连续两次打断,最后一代合成 | 仅最后有效代输出 |
| A 会话中断、B 会话正常 | 仅 A 失效,不全局清空 |
| 空音频重试途中打断并入新句 | 重试结果不能复活旧句 |
| 断线/reset 后旧 provider 返回 | 无旧 socket 写出,新连接工作正常 |
| 同 turn 多句、系统 sentence ID | 保留今日 turn 绑定与去重,不虚构 turn |

固定候选须独立 reviewer 检查取消交错、作用域/资源回收、既有协议兼容三维。运行 Python 定向与完整回归、lint,再按仓库完整门禁执行 `just ci`、`pnpm exec playwright test`、`just precommit`。本轮尚未执行这些产品修复门禁。

## 9. 后续接入阶段

### R1:媒体测量合同

只新增缺失端点:真实 ASR 输入结束/最终转写、供应商 TTS 首帧、终端首个播放样本、末尾水位。保留既有 approximate 指标,同名字段不偷换口径。HF L5 未定状态保留,先映射 hfRoundId/recordSeq/turnId,禁止跨机器单调时钟直接相减。

必须先修改 docs/09 与 docs/10 的必要合同、完成一致性评审,再落 packages/contracts 和生产接线。不要先引入一整套通用 MediaEnginePort API,只定义真正需要的能力与帧。

### R2:同 provider 的真流式链

保留 Doubao 与文本 Brain,隔离变量。ASR 在采集时推送,partial 只展示,final 仍由现话轮状态机唯一结算。TTS 音频逐段输出需同时修改生产端/VoiceHub/console;现 0x02 表示整句 MP3,不能把每个 chunk 当独立完整 mp3。

候选 wire 至少绑定 session、connection/output epoch、sentence、sequence、format/sample rate 与明确终止/中断;最终名称以 docs/09 评审为准。能力协商失败保持整句旧链,不得伪造完整水位。PCM + AudioWorklet 或增量解码方案先做桌面实验,不可未经真机就推广到所有移动端。

背压按音频时长/字节、句数双限;满载明确失败或停止接收。审批正文不能截短/合并成普通进度。限值通过内存与延迟压测确定,不是照搬框架默认值。

### R3:Pipecat 媒体对照

固定版本与依赖树,保持同 provider、同播放器、同话轮合同。先单独接 TTS/输出或 VAD detector,再决定是否组成 Pipeline;不同时换 ASR、TTS、Brain 与 transport。

复用 ADR-001 的实验只说明模拟输出可截断,新增 slow-provider/new-turn race、late frame、disconnect、背压、审批 unheard 的一致性测试。若 Pipecat 没有降低实际延迟/误打断或维护复杂度,保留改良 Legacy,无需为名义统一迁移。

### R4:非阻塞业务与回流

逐个检查 registry 工具:轻查询有界同步;长只读准备/已授权执行写入现 durable 对象后返回真实 accepted;就绪/取消/审批仍等待必要事实;unknown 不重放。有 accepted 才能说已受理,完成声明仍经过现 ledger outcome 闸。

在 callback 现有链上增加必要的媒体忙/保护呈现信号,不重建通知中心。普通结果可部分播+卡片,审批中断必须失效重签。ACK、开始播放、播完和用户批准四种事实不合并。多端时同一结果只由有权设备领取,租约到期不得让迟到 ACK 消费新呈现。

### R5:受限 S2S 与用户分发

先一家供应商,明示媒体上传和成本,默认关闭新模式。失去可信输入、精确呈现或身份关联时退到文本/受控 TTS;断线不得重复执行。无需安装 Qwen 整套运行时才使用 Qwen 模型。

发行补 pipeline 可选安装、版本兼容、ASR/TTS 诊断、真实播放检查、回滚。doctor 的“进程活着”不能替代麦克风/供应商/扬声器可用。跨公网 RTC、Anyvia 和手机入口独立立项,不打开 mobile_lan allowlist 代替媒体授权。

## 10. 验收与退出

共同正确性为硬门:误批准/重复执行/串项目/旧代污染均零容忍;语音断连不改变执行生命周期;S3 语音绝不放行;审计不复制敏感正文;记忆 candidate→trusted。

性能建议使用至少 100 个普通轮、30 个中断/噪声场景,按 PTT/HF/工具轮、设备和网络分组;是本方案拟议实验规模,不是修改现 canonical 样本门槛。沿用当前 p50≤1.5s、p90≤2.5s 的有效回答目标;缺端点、失败、超时、取消均保留分母,不可用占比单列。打断到实际停音建议 p95≤250ms,需真人/声学测量,目前未验证。

语料覆盖中文停顿/否定词/英文标识符/嗯对等应答/背景人声/外放双讲。增加两项目交错、两设备抢播、审批中断裸“好”、ACK 丢失、provider 限流、重连旧帧、任务完成后目标已改。

同一候选比较首个有内容回答、误截断/误打断、CPU/内存、每成功目标总费用、重复轮数;不拿 filler 首声刷达标。跨设备延迟需可解释校准或物理回环,不能直接相减不同单调时钟。

进入默认安装的条件:正确性门通过、实际用户旅程达标、在相同条件至少一项核心体验或维护成本有可重复收益、其余关键指标无显著退化。无法满足则关闭新引擎开关,回 Legacy;不迁移业务数据库,不重发任务。切引擎时旧呈现失效,旧音频不跨 epoch。

## 11. 排产与必要 owner 决定

当前主线 next=CODEX-AS-SPIKE-01。本研究不把它偷偷替换成语音重构。建议第一刀以具名 VOICE-RUNTIME-01 进入后续修复工作,与 App Server 原型是不同目标。

产品代码施工受 AGENTS.md 的独立验收要求约束。project-profile 的通用配置引用 `~/.octoworkflow/v2-policy.json`,本机不存在;v3 具名例外仅覆盖 VOICE-MEASURE-01 与 CODEX-AS-SPIKE-01。本轮已提出一次必要选择:是否将当前 policy.json/roles.override.json 适用于新批,按其角色与预算推进独立 worktree 修复,不提交不部署。未获答复前不擅自扩展例外、不自选 reviewer、不声称独立 GREEN。

研究证据可以先交付;本文件是完整建议而非已批准 canonical。若采纳,先冻结当时有效配置与目标范围,按仓库制度实施及验收;需要调整 PLAN-2 位置时明确 owner 决定,只改唯一排产源。发布、常驻部署、真人场次仍为独立 checkpoint。

## 12. 来源索引

外部链接支持能力与许可事实,不支持 SayDo 已部署/性能通过的结论。

- [Q1](https://github.com/QwenAudio/qwen-audio-agent/blob/f27aca5130d1985d6f28e3c4c5e8c2c9928a97fd/docs/architecture/deep-dive.zh.md):当前架构,本轮阅读主要章节。
- [Q2](https://github.com/QwenAudio/qwen-audio-agent/blob/f27aca5130d1985d6f28e3c4c5e8c2c9928a97fd/server/src/orchestration/task-operations.mjs):submit owner lane、取消及 permission 方法。
- [Q3](https://github.com/QwenAudio/qwen-audio-agent/blob/f27aca5130d1985d6f28e3c4c5e8c2c9928a97fd/docs/reference/backend-adapter-sdk.zh.md):BackendPort/结果/归一化/conformance。
- [Q4](https://github.com/QwenAudio/qwen-audio-agent/blob/f27aca5130d1985d6f28e3c4c5e8c2c9928a97fd/server/src/voice/realtime-session-runtime.mjs#L1067):实际 playback.started/ended 处理。
- [Q5](https://github.com/QwenAudio/qwen-audio-agent/blob/f27aca5130d1985d6f28e3c4c5e8c2c9928a97fd/LICENSE):Apache-2.0 原文。
- [P1](https://docs.pipecat.ai/pipecat/learn/function-calling):同步/后台工具与中断,不能外推当前安装版本。
- [P2](https://docs.pipecat.ai/pipecat/learn/speech-input):VAD 与 user turn strategies。
- [P3](https://github.com/pipecat-ai/pipecat/blob/main/src/pipecat/services/tts_service.py):本轮抓取 main 的 TTS context、序列化与中断代码;非固定候选,正式实施前须锁 SHA。
- [P4](https://raw.githubusercontent.com/pipecat-ai/pipecat/main/LICENSE):BSD-2-Clause 原文。
- [L1](https://docs.livekit.io/agents/logic/tools/async/):foreground、取消与同名重复调用。
- [L2](https://github.com/livekit/agents/blob/main/LICENSE):Agents Apache-2.0;不包含权重授权推论。
- [L3](https://github.com/livekit/agents/blob/main/livekit-agents/livekit/agents/voice/agent_activity.py):补充读取活动/工具实现,未运行。
- [G1](https://github.com/Omni-Interaction-Gander/Omni-Interaction-Agent):trusted-turn/main/fork/generation/三 GPU 发布配置,属官方 README 事实。
- [F1](https://github.com/gradio-app/fastrtc):函数到 RTC/WS 的轻接入。
- [F2](https://github.com/gradio-app/fastrtc/blob/main/LICENSE):MIT 原文。
- [R1](https://github.com/FireRedTeam/FireRedChat):pVAD/EoT 与多服务部署形态。
- [T1](https://github.com/TEN-framework/ten-framework/blob/main/LICENSE):根许可附加条件原文。
- [O1](https://developers.openai.com/api/docs/guides/realtime):官方实时语音入口。
- [O2](https://developers.openai.com/api/docs/guides/voice-server-controls):服务器控制与应用授权边界。
- [A1](https://help.aliyun.com/en/model-studio/realtime):Qwen 实时服务,实际型号/地域/账户需另验。

本地关键证据:生产 `hub_client.py:255/504/565/1221`、`doubao_tts.py:101`、`dialogLoop.ts:762/802`、`index.ts:3662`、`presentationFull.ts:82`、`useVoiceChannel.ts:590`、工程 ADR-001 后记、PLAN-2 顶部、voice-measure-01 evidence。行号以本文件基线为准。
