# 语音模型技术扫描:ChatGPT/OpenAI 与 Grok/xAI 当前可用模型 vs SayDo 级联方案(2026-07-24)

> **性质**:证据文档(research;实施期轻量制度下证据类免评审)。触发:owner 2026-07-24 提问——"两家技术实现上是否有新的模型可以使用?与当前方案相比有什么更先进(体验/响应/省上下文)的技术优势?"
> **方法**:web 调研(OpenAI/xAI 官方 API 文档与 pricing 页、官方博客、社区一手反馈、第三方横向对比),对照 `docs/03 §3`、`docs/04 §3`、`docs/07`(D2/D4/D5/D6/D18)逐项分析。姊妹篇:`voice-call-channel-scan-2026-07.md`(通话交互形态,同日)。
> **红线**:本轮不改 canonical、不改代码(实施在其他会话进行中);第 6 节列"若采纳应改哪里"供 owner/后续轻量评审消费。

## 1. OpenAI 侧:当前 API 可用的模型全景

### 1.1 S2S 主线:gpt-realtime-2.1 家族(GA,API 可用)

出处:[模型页](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)、[定价页](https://developers.openai.com/api/docs/pricing)、[成本管理指南](https://developers.openai.com/api/docs/guides/realtime-costs)。

| 模型 | 音频 in/cached/out(每 1M token) | 文本 in/cached/out | 说明 |
|---|---|---|---|
| `gpt-realtime-2.1` | $32.00 / **$0.40** / $64.00 | $4.00 / $0.40 / $24.00 | 128k context、32k max output;**可配置 reasoning effort(minimal/low/medium/high/xhigh,默认 low)**;支持图像输入 |
| `gpt-realtime-2.1-mini` | $10.00 / $0.30 / $20.00 | $0.60 / $0.06 / $2.40 | 约 1/3 价;仍支持 function calling/打断/自然轮次 |
| `gpt-realtime-translate` | 按分钟 $0.034/min | — | 专用流式翻译 |
| `gpt-realtime-whisper` | 按分钟 $0.017/min(≈$1.02/hr) | — | Realtime API 上的流式转写专用模型 |

**能力更新(相对 docs 记载的 gpt-realtime 一代)**:

- 2.1 改进**字母数字识别**(对中英混说代码术语直接相关)、静音/噪声处理、**打断行为**;
- **remote MCP 工具已支持**([文档](https://developers.openai.com/api/docs/guides/realtime-mcp)):`type:"mcp"` + `server_url`/`connector_id`(内置 Gmail/Calendar 等 connector),由 Realtime API 侧直接执行,带 `require_approval` 审批回调与 `allowed_tools` 白名单;
- **Structured Outputs 仍不支持**(Agents SDK 官方文档明确"Structured outputs are not supported")——`docs/03 §3` 级联可控性论据**继续成立**;
- **turn detection 增加 `semantic_vad`**(语义轮次检测已产品化,可配 `interrupt_response`);
- **上下文管理新机制(直接回答"省上下文")**:
  - `session.truncation.retention_ratio`:超上下文时**多丢一点旧消息**(如保 0.8),避免"每轮都截断→每轮都打掉前缀缓存"的缓存失效螺旋;
  - `token_limits.post_instructions`:限定每次 Response 的输入 token 上限(instructions 之外),客户端可主动收窄上下文窗;
  - cached input 大折扣:音频 $32→$0.40(**1.25%,80 倍折扣**),文本 $4→$0.40;
  - 官方 cookbook 建议长会话周期性摘要压缩对话状态。

### 1.2 级联组件模型:2025-12-15 代 snapshot(API 可用)

出处:[官方博客 updates-audio-models](https://developers.openai.com/blog/updates-audio-models)、[STT 指南](https://developers.openai.com/api/docs/guides/speech-to-text)、社区一手反馈。

- **ASR**:`gpt-4o-mini-transcribe-2025-12-15`——比 whisper-1 **减少约 89% 幻觉**(噪声/静音场景),比前代 gpt-4o-transcribe 减少约 70%;官方声明**中文等语言显著加强**;为短语句/嘈杂背景的真实对话优化;支持 prompt 偏置与 logprobs。
- **TTS**:`gpt-4o-mini-tts-2025-12-15`——WER 降约 35%;**社区一手反馈警示**:音质随时间波动(同一 snapshot 不同日期输出音质不同、音色区分度下降),有开发者回退 2025-03-20 版——"最新不等于最好,换版须过 golden"。
- **说话人分离**:`gpt-4o-transcribe-diarize`——`diarized_json` 返回 segment 级 `speaker/start/end`;可提供**最多 4 人、每人 2–10 秒参考音频**(`known_speaker_names[]`/`known_speaker_references[]`)把匿名段映射到已知说话人;**仅 `/v1/audio/transcriptions` 批式端点,Realtime API 不支持**(>30s 音频必须 `chunking_strategy`;不支持 prompt/logprobs);Azure 侧实现另有"不回 segments"的未解 issue。
- `gpt-audio-mini-2025-12-15`:Chat Completions API 上的原生语音进出(非 Realtime 通道)。

### 1.3 GPT-Live(2026-07-08):无 API,waitlist 状态

- 全双工是 ChatGPT **消费端独占**;开发者只有登记表单(`openai.com/form/gpt-live-1-in-the-api/`),无 endpoint/型号/定价/时间表;Business/Enterprise/Edu 工作区、桌面 App、Codex 首发都不含。
- 第三方按 OpenAI 历史节奏(AVM 2024-07 → Realtime API 2024-10)推测 API 落地 2026 底–2027 初,**仅为推测**。
- 架构情报:GPT-Live 的深推理**委托后台 GPT-5.5**(现 GPT-5.6 Sol/Terra/Luna 已 GA,1.05M context)——与 SayDo"S2S 只做呈现层、认知交文本旗舰"(03 §3)同构,行业印证。
- 当前全双工 API 替代:ElevenLabs、Hume AI EVI 3(48kHz、韵律/情感侧信道)。

## 2. xAI/Grok 侧:Voice API(GA,API 可用)

出处:[docs.x.ai voice 参考](https://docs.x.ai/developers/rest-api-reference/inference/voice)、[能力页](https://docs.x.ai/developers/model-capabilities/audio/voice)、[定价](https://docs.x.ai/developers/pricing)、[x.ai/api/voice](https://x.ai/api/voice)。

- **模型**:`grok-voice-latest` / `grok-voice-think-fast-1.0` / `grok-voice-fast-1.0`;`reasoning.effort` 仅 `high|none` 两档(默认 high,仅前两个模型支持)。τ-voice Bench 67.3%(think-fast-1.0,xAI 自报)。
- **端点**:`wss://api.x.ai/v1/realtime`,**兼容大部分 OpenAI Realtime 事件模型**(官方列命名差异清单);浏览器/移动端走 ephemeral token;**SIP 原生**(`call_id` 绑定呼入,详见姊妹篇)。
- **定价模型是根本差异:墙钟计分钟,非 token**——Realtime $0.05/min($3/hr,含语音,idle 也计费,有 `one_turn` 模式避免空转计费);文本注入 $0.004/条(每次 `conversation.item.create`);TTS $15/1M 字符;**STT $0.10/hr(REST)/ $0.20/hr(流式)——显著低价**;电话号码 +$0.01/min。
- **工具**:web/X 搜索、文件检索、remote MCP、自定义 function;25+ 语言、通话中切换;语音克隆(2 分钟样本)。
- **会话**:上限 3600s;**无原生 resume**(transcript replay,客户端重喂历史);并发 100/团队(Builder)。
- **隐私声明**:音频"不存储、不用于训练"(zero-retention 姿态,企业合规 SOC 2/HIPAA eligible/GDPR)。

## 3. 横向速览(含第三方对比佐证)

第三方运行时(dotsimulate LOPs)实测口径:

| 维度 | OpenAI Realtime | xAI Grok Voice | Gemini Live | Hume EVI 3 |
|---|---|---|---|---|
| 计费 | token(cached 大折扣) | **墙钟 $0.05/min** | token | 订阅/分钟 |
| 会话上限 | 3600s | 3600s | **900s(最紧)** | 1800s |
| 会话恢复 | transcript replay | transcript replay | **原生 resume handle** | 原生 handle |
| 工具 | function + **MCP + connectors** | function + MCP + X/web 搜索 | 同步(3.x) | streamed |
| 特色 | semantic_vad、reasoning 五档、图像输入 | SIP 原生、低价 STT、语音克隆 | 视频输入、Search grounding | 韵律/情感侧信道、48kHz |

## 4. 与 SayDo 当前方案对比:它们先进在哪、我们立场是否要变

SayDo 现状(07 定稿):级联 = Pipecat(待 spike)+ 火山 sauc ASR(定档,热词 +10pt 术语召回)+ 文本 LLM(api)+ 火山 seed-tts-2.0 v3(定档);S2S = P2 增强呈现层(D6);对话档恒 api(D18)。

### 4.1 它们确实更先进的(承认并吸收)

1. **全双工对话质感(GPT-Live)**:垫话/安静等待/边听边说是 UX 新标杆——**但无 API,当前不可复用**;级联能规则化近似的部分(垫话音效、EOU 等待阈值、"只听模式"口令)已记入姊妹篇 B4。**级联做不了真全双工是结构性差距,接受**;GPT-Live API 开放为 D6 重评触发点。
2. **S2S 的可控性差距在收窄**:2.1 有 reasoning 分档、MCP + require_approval、semantic_vad、改进打断与字母数字识别——但 **Structured Outputs 仍缺**,τ-voice 67.3% 仍显著低于文本 agent,「S2S=呈现层」边界不需要动,只是 P2 接入时的能力假设要按 2.1 刷新。
3. **上下文经济学有了官方工具**:retention_ratio + post_instructions + 80 倍 cached 音频折扣,直接缓解 04 §3"每 Response 重带 conversation 越来越贵"的痛点(该节成本事实写于一代 realtime)。**对级联的镜像启示**:我们的 ContextCompiler(04 §1.1/实施计划 2.2)应把**跨轮次前缀稳定性**(prompt-cache 友好)列为显式设计目标——同输入同 digest 只保证确定性,不保证"轮与轮之间前缀不动";会话挂起→重建若前缀漂移,每次重建都是全价 token。
4. **ASR 组件的代际进步**:gpt-4o-mini-transcribe-2025-12-15 的抗幻觉(静音/噪声下 -89%)与中文增强,恰对准 SayDo 的两个已知风险(VAD 兜底、嘈杂环境);它就是 D4 预留的"第二家对比"最佳具体候选(且支持 prompt 偏置,可对齐火山热词机制打平对比)。
5. **说话人分离可用了(批式)**:diarize + known_speaker_references(2–10s 参考音频锚定 owner 声音)给 Gate 0 G1"真软过滤"升级提供了第一个具体技术路径——**但仅批式、无实时**,故 P0 口径(PTT 窗口外不产生指令、不承诺说话人区分)不变;可行的是 P1+ 用批式做**转写事后标注/审计**(如"这段是不是 owner 说的"复核)。
6. **Grok 的成本与电话形态**:墙钟计费全包 $0.05/min 对"长时间在线小声聊"场景比 token 计费可预测;STT $0.10–0.20/hr 是当前调研所见最低价档;SIP 原生 + OpenAI 事件模型兼容使其成为 P2 S2S/电话腿的**平价候选**。

### 4.2 我们不落后、甚至被印证的(立场不变)

1. **级联默认**:Structured Outputs 缺失未变、τ-voice 差距未变、文本中间态可审计的价值未变;GPT-Live 自己都把深推理外包给文本旗舰。
2. **会话短命/任务长命 + Context Pack 重建**:OpenAI/Grok 都没有原生 resume(transcript replay 与我们的重建同思路,我们的 Context Pack 还更结构化、带版本校验);会话上限(900–3600s)全行业存在。
3. **对话档恒 api、S2S 分期 P2**:新情报没有推翻 D18/D6 的任何裁决;Grok 平价化只是让 P2 候选池更好。
4. **火山 TTS 定档**:OpenAI TTS 新 snapshot 有音质漂移的社区实证,反而强化"锁版本 + golden 门禁"纪律(07 D5 不重开)。
5. **热词偏置**:ADR-101 实测 +10pt 术语召回,是级联独有的可控性优势;S2S 侧无对等机制(2.1 只有 instructions 级偏置)。

### 4.3 逐维度直答 owner 三问

- **用户体验更好?** 是,GPT-Live 全双工质感当前无 API 不可复用;可规则化近似的三件(垫话/安静等待/只听模式)已列 B4。Grok 的 UX 优势主要在电话形态(姊妹篇)而非对话质感。
- **响应更快?** S2S 原生比级联少一跳,sub-second 是真的;但 SayDo 对话档 SLO(P50≤1.5s)经组件优化可达,且换来文本中间态可控性。2.1-mini 的低价让"P2 用 S2S 做呈现层"的成本顾虑进一步下降。
- **更省上下文?** OpenAI 给了 truncation/retention_ratio/post_instructions + cached 折扣(S2S 场景);**级联侧我们本就自管上下文(Context Pack 1.5k–3k token),结构上更省**;新增行动项是把 prompt-cache 前缀稳定性做成 ContextCompiler 显式目标(见 §6-3)。

## 5. 值得单列的工程细节(实施期可直接消费)

- Realtime API 计费/缓存机制:truncation 从最旧消息丢起;截断即打缓存 → retention_ratio<1 用"多丢"换"缓存命中";`token_limits.post_instructions` 是硬顶。
- 2.1 reasoning effort 与延迟正相关(官方注明 high/xhigh 增加时延与输出 token)——若 P2 接入,对话呈现层应锁 minimal/low。
- diarize 模型约束:>30s 必须 chunking_strategy;`diarized_json` 才出 speaker;流式模式按 segment 完成才出说话人(非逐 delta)。
- Grok 文本注入按条计费($0.004/条)——Context Pack 若在 Grok S2S 上逐条 `conversation.item.create` 注入,成本模型与 token 计费完全不同,需按条数预算。
- Grok `one_turn` 模式可避免墙钟 idle 计费——与 SayDo 45s 挂起策略互补。
- OpenAI Realtime 有独立 transcription_sessions 通道(gpt-realtime-whisper $0.017/min)——级联 ASR 的又一云端候选(与火山按量价对比待实测)。

## 6. 若采纳,影响 canonical 的信息更新清单(本轮不改,供 owner 定夺后走轻量评审回写)

| # | 目标 | 更新内容 | 性质 |
|---|---|---|---|
| 6-1 | 03 §3 | 补 2.1 代情报:MCP+require_approval、semantic_vad、reasoning 分档、图像输入;Structured Outputs 缺失论据**刷新出处后保留**;补"GPT-Live 委托文本旗舰"的架构印证 | 信息刷新,不改结论 |
| 6-2 | 04 §3 | 成本事实补 truncation/retention_ratio/cached 折扣机制;"后续 turn 越来越贵"表述加"供应商已给缓解工具"注记 | 信息刷新 |
| 6-3 | 04 §1.1 + 实施计划 2.2(ContextCompiler) | **前缀稳定性(prompt-cache 友好)列为编译契约显式目标**:分层拼接顺序固定、易变项(时间戳/游标)后置、重建会话尽量复用上轮前缀 | 设计增补(小) |
| 6-4 | 07 D4 | 第二家对比具体化 = gpt-4o-mini-transcribe-2025-12-15(抗幻觉/中文/prompt 偏置对齐热词打平测);gpt-realtime-whisper 入候选池 | 待 spike 项刷新 |
| 6-5 | 07 D6 | P2 S2S 候选池扩为 gpt-realtime-2.1(-mini) / grok-voice-latest / 火山 S2S-Omni 三家;记录 Grok 墙钟计费/one_turn/文本按条/SIP 原生/事件模型兼容 | 候选池刷新 |
| 6-6 | 05 §4 Gate 0 G1 | "真软过滤待 ASR 具备说话人标签"补具体路径:diarize 批式(known_speaker_references 锚定 owner)可先做**事后审计**;实时仍无方案,P0 口径不变 | 升级路径情报 |
| 6-7 | 07 D2 | semantic_vad 已产品化(OpenAI);Pipecat/LiveKit spike 时把"语义 EOU 三层"对照该实现校准 | spike 参照 |
| 6-8 | 07 D5 | 不动(反例证据:OpenAI TTS snapshot 音质漂移社区实证,支持锁版 + golden 门禁纪律) | 立场确认 |
| 6-9 | roadmap 触发器 | GPT-Live API waitlist 登记(表单);API 开放 = D6 重评触发(姊妹篇 B5 同条) | 触发器 |

## 7. 不确定性与诚实注记

- 各家定价/额度为 2026-07-24 快照,Grok Builder 标注 beta、价格标注"当前";
- τ-voice 67.3% 为 xAI 自报;gpt-4o-mini-transcribe 的中文提升未见独立中文基准,D4 对比须自测(60 条种子语料复用);
- "S2S 比级联快"的幅度未做本机实测(P50 对比属 P2 接入时的验收项);
- diarize 在 Azure 通道有"不回 segments"的未解 issue,OpenAI 直连通道社区反馈正常;
- GPT-Live API 时间表纯属第三方推测。
