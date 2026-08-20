# VoiceLoop 实时语音与分层记忆：2026 技术调研与可行性核实

> 调研日期：2026-07-22（Asia/Shanghai）
> 范围：实时双向语音、会话挂起/重建、分层记忆生命周期、代码库奠基与增量刷新、Context Pack 检索
> 对照材料：`voice-coding-framework.Cursor2.md` §2.1 / §4.19、`open-source-stack.md`、`competitive-scan-2026-07.md`

## 0. 结论先行

### 0.1 两个最重要的判断

1. **“默认级联、S2S 增强”的产品判断仍成立，但理由必须更新。** 2026 年已经不能再笼统声称“级联比 S2S 便宜一个数量级”：Google Gemini 3.1 Flash Live Preview 的标价折算只有音频输入 `$0.005/min`、音频输出 `$0.018/min`，OpenAI `gpt-realtime-2.1-mini` 也把音频价格降到 `$10/$20 per 1M tokens`。默认级联现在真正的优势是：文本中间态可检查、工具参数可用 Structured Outputs/校验器约束、每段可独立替换或本地化、可精确保存“用户实际听到的内容”，且复杂工具失败可恢复。S2S 的优势则是韵律、情绪、重叠说话和自然打断。应将 S2S 定位为**可热切换的交互前端**，复杂计划、写操作和长任务仍委派给文本 agent。
2. **记忆生命周期不能继续只是“后台摘要 + git diff 刷新”。** P0 应自建一个可重放的、append-only 的记忆事件账本，派生出当前视图和 `.voiceloop/knowledge/` 文档；`decay` 只影响排序，不能代表失效；`invalidate` 必须可逆并保留证据；合规 `forget` 必须从 FTS、向量、缓存和备份策略中真正清除。LLM 只能提出 consolidation/失效候选，事实新鲜度由 Git ancestry、source hash、时间和策略机确定。2026 年最值得直接 PoC 的外部实现是 **Hindsight**，最值得借鉴的模式是 **Letta MemFS、Graphiti 的双时间、LangMem 的后台 consolidation**；但 VoiceLoop 的代码事实仍应由本地文件和 Git 作为权威源。

### 0.2 推荐落地形态

| 层 | P0 建议 | P1 / 实验 | 不建议作为 P0 核心 |
|---|---|---|---|
| 实时编排 | **暂定 LiveKit Agents**：同一 session 支持级联/S2S/half-cascade，且有 playout-aware interruption；业务状态仍由 VoiceLoop 持有 | Pipecat 做 1 周对照，以“已播放文本截断”、中英误打断和本地模型接入定胜负 | 把业务状态锁死在某个 S2S session 内，或同时叠两套 orchestration |
| 默认语音 | 流式 ASR → 支持 Structured Outputs 的文本 LLM → 流式 TTS | ASR/TTS 云端与 Apple Silicon 本地热切换 | 用离线 RTF 代替端到端首响指标 |
| S2S 增强 | `gpt-realtime-2.1-mini` 与 Gemini 3.1 Flash Live Preview 双适配，复杂工具委派文本 agent | `gpt-realtime-2.1` 高质量档；GPT-Live API 可用后复测 | 因 demo 自然就让 S2S 直接执行高风险工具 |
| AEC / turn | 浏览器 WebRTC AEC 基线 + Silero VAD + 语义 EOU；耳机/PTT 降级 | LiveKit Turn Detector v1/v1-mini；Krisp | 只凭 `echoCancellation: true` 宣称“工业级 AEC 已完成” |
| 本地语音 | MLX/Qwen3-ASR 或 MLX Whisper 候选；MLX Kokoro 主 TTS，Piper-plus 轻量回退 | 用 VoiceLoop 自有中英夹杂集选型 | Apple Silicon 上把 faster-whisper 当 Metal 加速方案 |
| 持久记忆 | Markdown 权威文档 + SQLite 事件账本/当前投影 + FTS5 + `rg` + provenance | sqlite-vec 概念召回；Hindsight shadow PoC；结构图索引 | 将向量库或自动摘要当唯一真相 |
| 代码奠基 | 首次阻塞式语义扫描；后续 `git diff --raw -z` + 反向依赖闭包；异常全量重建 | 评估 Codebase-Memory / GitNexus；借鉴 RepoDoc | 未完成商用许可审查就嵌入 GitNexus；仅凭变更文件更新文档 |

### 0.3 证据标记

- **[官方事实]**：厂商官方文档、标准或源码；能说明接口、价格或实现约束，不等于独立效果验证。
- **[论文事实]**：论文公开实验；结果只在其数据、模型、硬件与测量口径内成立。
- **[自测事实]**：项目或厂商自己发布的 benchmark，必须在 VoiceLoop 环境复测。
- **[工程推断]**：基于上述证据给 VoiceLoop 的设计判断，不伪装成公开 benchmark。

---

## 1. 语音层结论

## 1.1 级联 vs Speech-to-Speech：2026 现状

### 1.1.1 市场已经进入“自然交互由 S2S、可靠行动由文本 agent”阶段

**[官方事实]** OpenAI 在 2026-07-08 发布 [GPT-Live](https://openai.com/index/introducing-gpt-live/)：模型以全双工方式持续判断听、说、停顿、打断和工具调用，并可在保持对话的同时把搜索、推理等任务委派给 GPT-5.5 后台；但截至本报告日期，官方表述仍是 API “soon”，不是可用于 VoiceLoop P0 的一般可用 API。

**[官方事实]** 已可用的 [GPT-Realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1) 和 [GPT-Realtime-2.1-mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini) 都有 128k context、Function Calling、可配置或蒸馏 reasoning，并改进了字母数字、静音/噪声和打断；但两者都明确**不支持 Structured Outputs**。这正是“能调用函数”与“工具参数足够可靠”之间的差别。

**[论文事实]** 2026 年的 [τ-Voice](https://arxiv.org/abs/2603.13686) 在 278 个任务上考察原生语音 agent：论文报告文本 GPT-5 reasoning 的任务成功率为 85%，原生语音模型在干净音频下仅 31%–51%，噪声/口音下 26%–38%，且大量失败发生在工具已经正确配置后的行为阶段。该结论不能外推到所有未来模型，但足以反驳“有 Function Calling 标志就等于可托管复杂工具”的假设。

**[论文事实]** [Audio2Tool](https://arxiv.org/abs/2604.22821) 的约 3 万样本评估还显示，原生 S2S 与 ASR→LLM 两类系统都会在组合式工具选择、口音、噪声等条件下降级；因此级联不是自动可靠，可靠性来自**可观察中间态、参数 schema、重试/幂等和回归集**。

**[工程推断]** VoiceLoop 的双引擎边界应放在“对话呈现层”，而不是放在“业务动作层”：

- S2S 可负责听觉理解、自然抢话、简短确认、复述和进度播报；
- 一旦需要文件写入、跨工具计划、精确标识符、审批或后台长任务，把已提交的用户 turn 交给文本 agent；
- S2S 只朗读/概括后台事件，不拥有任务真相和任务生命周期；
- 工具调用先写 `intent envelope`（schema、权限、idempotency key、预期版本），由文本侧验证后执行。

### 1.1.2 延迟：S2S 上限更好，但“级联必然慢”已不成立

**[论文事实]** 2026 综述/教程 [Building Real-Time Voice Agents](https://arxiv.org/abs/2603.05413) 的一条流式级联（Deepgram / vLLM / ElevenLabs）报告 P50 首音约 947 ms、最佳约 729 ms；同文所测开源 omni 模型约 13 s。它说明优化后的级联可以亚秒首响，但不是 VoiceLoop SLA，因为网络、region、文本模型和话轮检测都不同。

**[论文事实]** [Full-Duplex-Bench v3](https://arxiv.org/abs/2604.04847) 报告 GPT-Realtime 的 pass@1 为 0.600、Gemini 的一组平均响应延迟约 4.25 s、其级联 baseline 约 10.12 s；该 baseline 是特定 Whisper→GPT-4o→TTS 配置，不是流式优化栈，不能用来断言所有级联慢 2 倍以上。

**[工程推断]** VoiceLoop 应拆开测量，而不是只报“端到端 latency”一个数：

```text
speech_offset
  → semantic_EOU
  → ASR_final / S2S_turn_commit
  → LLM_first_text_or_tool_delta
  → TTS_first_pcm
  → first_DAC_playout

barge_in_onset
  → server_cancel
  → client_buffer_clear
  → speaker_silence
```

建议把目标设为：普通短答 P50 首音 `< 1.0 s`、P90 `< 1.8 s`；打断到扬声器静音 P90 `< 250 ms`。这两个数是 **VoiceLoop 的建议验收门槛，不是外部事实**；原计划 P50 1.5 s / P90 2.5 s 可保留为 launch 上限。

延迟优化优先级应是：

1. EOU/turn detector（常吃掉 300–800 ms）；
2. region 与连接预热；
3. 文本 LLM TTFT / S2S 首音；
4. TTS 流式首 chunk 和客户端 jitter buffer；
5. 不要用“整段音频 RTF”冒充首音延迟。

### 1.1.3 成本：旧版“级联便宜一个数量级”结论已失效

**[官方事实]** 当前公开标价：

- [GPT-Realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)：音频输入/缓存输入/输出分别 `$32/$0.40/$64 per 1M audio tokens`，文本输入/输出 `$4/$24 per 1M`；
- [GPT-Realtime-2.1-mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini)：音频输入/缓存输入/输出 `$10/$0.30/$20 per 1M`，文本输入/输出 `$0.60/$2.40 per 1M`；
- [Gemini 3.1 Flash Live Preview](https://ai.google.dev/gemini-api/docs/pricing)：音频输入 `$3/M`（官方等价 `$0.005/min`），音频输出 `$12/M`（`$0.018/min`）；它仍是 Preview；
- [Deepgram 定价](https://deepgram.com/pricing)：Flux 单语 `$0.39/h`、多语 `$0.47/h`，Nova-3 单语/多语 `$0.29/$0.35 per hour`；但当前 [language matrix](https://developers.deepgram.com/docs/models-languages-overview/)显示 Flux/Nova-3 的 `multi` 仅含英、西、法、德、印地、俄、葡、日、意、荷，**不含中文**；Nova-3 虽在 2026-03 新增单语中文，不能等同于中英 code-switch；
- [ElevenLabs API 定价](https://elevenlabs.io/pricing/api)：页面给出的 Flash/Turbo TTS 约 `$0.05/1k chars`、Multilingual v2/v3 约 `$0.10/1k chars`；厂商还宣称 Flash 约 75 ms、Multilingual 约 250–300 ms，这些延迟是厂商口径，需复测；
- [OpenAI Realtime Whisper](https://developers.openai.com/api/docs/models/gpt-realtime-whisper) 为 `$0.017/min` 流式转写。

**关键口径差异：** 级联 ASR 通常按墙钟音频时长收费，TTS 按真正生成的音频/字符收费，文本 LLM 按 token；Realtime 模型则可能在每一轮把活动上下文重新作为输入计费。Google [Live API 最佳实践](https://ai.google.dev/gemini-api/docs/live-api/best-practices) 明确说明多轮会产生上下文复计费，原始音频留在上下文时成本会随轮次累积；主动聆听也会持续计费。

应采用可复算公式：

```text
cascade_cost
  = captured_audio_minutes × ASR_wall_rate
  + played_assistant_minutes_or_chars × TTS_rate
  + committed_text_input/output_tokens × text_LLM_rate

s2s_cost
  = Σturn(active_context_audio/text/cached_input_tokens
          + generated_audio/text/reasoning_tokens)
  + transcript_surcharge
  + provider_tool_fees
```

**[工程推断]** 因此不能再用供应商首页的 `$0.023/min`（Gemini 输入一分 + 输出一分）直接乘会话时长，也不能把 OpenAI token 单价直接换成固定每分钟。P0 必须逐 turn 持久化供应商返回的 usage，并按以下维度出账：`captured_min`、`user_speech_min`、`assistant_generated_min`、`assistant_played_min`、`cached_input`、`uncached_context`、`reasoning`、`transcription`、`tool`。

**结论：** 级联默认仍成立，但**不是成本绝对获胜**；成本要通过 VoiceLoop 真实 talk ratio、上下文增长和空闲策略 A/B 才能定。Gemini Live 在短会话可能比“Deepgram + 高品质 TTS”更便宜，长多轮会话则必须计入上下文复计费。

### 1.1.4 打断质量：要截断“听到的历史”，而不仅是 cancel 请求

**[官方事实]** [OpenAI Agents SDK Voice Agents 指南](https://openai.github.io/openai-agents-js/guides/voice-agents/build/) 说明：WebRTC 会自动清理被打断的输出 buffer，WebSocket 模式必须由应用停止本地播放；被打断的回复没有最终 transcript，输入转写也只是异步到达的近似文本，不等于模型实际听到的内容。

**[官方事实]** [LiveKit turn 管理](https://docs.livekit.io/agents/logic/turns/) 会在用户说话时暂停 agent，并把历史截到“用户实际听到”的部分；其 Python API 甚至暴露默认 3 秒 `aec_warmup_duration`，避免 AEC 尚未稳定时把回声误判成打断。Pipecat 也已有 `InterruptionFrame`、turn observer、VAD + Smart Turn 策略，见 [System Frames](https://docs.pipecat.ai/api-reference/server/frames/system-frames) 与 [Speech Input](https://docs.pipecat.ai/pipecat/learn/speech-input)。

**[工程推断]** VoiceLoop 必须维护 `playout watermark`：每个 TTS chunk/word 有 `response_id`、`text_span`、`pcm_range`、`played_at`。打断时同时：

1. 取消模型生成；
2. 清客户端 PCM/jitter buffer；
3. 标记未播放文本为 `unheard`，不得写入对话事实；
4. 对历史只提交 `heard_text_end_offset` 以前内容；
5. 如果工具已启动，按工具策略 cancel 或继续，不把“停止朗读”等同于“取消任务”。

这也是选择框架时最重要的 spike：若 Pipecat 集成不能稳定给出 playout-aware history truncation，就应优先采用 LiveKit Agents 或在 VoiceLoop transport 层补齐，而不是只用 VAD 触发 `cancel()`。

### 1.1.5 中英混说：模型能力存在，但领域词仍必须自建回归集

**[官方事实]** OpenAI 在 [Realtime API 发布说明](https://openai.com/index/introducing-gpt-realtime/) 中展示句中切换语言；Google [Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities) 称支持 97 种语言和自然切换。这是能力声明，不是 VoiceLoop 代码词汇上的 MER 保证。

**[论文/数据集事实]** [CS-Dialogue](https://arxiv.org/abs/2502.18913) 提供 104 小时自然中英对话；论文的 zero-shot 结果中 Whisper Large-v2 的 MER 为 15.29、WER 为 31.11，SenseVoice Small 的 MER 为 6.71，fine-tuned Whisper Medium MER 为 7.53。不同切分/预处理不能与其他榜单直接横比，但清楚显示 code-switch 是独立问题，不可用单语 WER 代替。

**[自测事实]** [TEA-ASR-1.1-mini model card](https://huggingface.co/JacobLinCool/TEA-ASR-1.1-mini) 报告其中英 ASCEND MER 11.20、CSZS 12.51，优于其同表 Whisper large-v3 的 19.61/23.24；这是作者自报，应作为候选而不是结论。[CS3-Bench](https://huggingface.co/datasets/VocalNet/CS3-Bench) 也显示开源 S2S 在理解、转写与 code-switch knowledge 之间表现不一致。

**[工程推断]** 建立 300–500 条 VoiceLoop golden utterances，至少覆盖：仓库名、symbol/path、CLI flags、英文缩写、数字/版本、中文句子夹英文函数、同音词、Mac 风扇/键盘噪声、扬声器回声。指标用 MER + identifier exact match + tool-argument exact match；不要强制整句只有一个 `language`，并为领域词维护动态 hotword/glossary。

### 1.1.6 最终判断：默认级联仍成立吗？

**成立，置信度：高；但要把决策写成条件策略，而不是固定偏见。**

- 默认级联：所有涉及写文件、执行命令、精确参数、审批、长任务、可审计 transcript 的 turn；
- S2S 增强：闲聊、快速问答、语气/情绪重要、频繁重叠和打断的 turn；
- 混合模式：S2S 负责自然前台，文本 agent 负责 tool planner/executor；这是 GPT-Live 官方方向也在趋近的架构；
- 自动降级：S2S tool schema 验证失败、网络抖动、会话快到上限、上下文成本异常、中英 identifier 置信度低时，转级联并口头确认；
- 每个 turn 可切换，但底层 `ConversationState`、`TaskState`、`MemoryState` 不随引擎切换。

---

## 1.2 AEC、VAD 与 turn detection

### 1.2.1 浏览器 `getUserMedia` AEC：够做 P0 基线，不够做质量承诺

**[标准事实]** MDN 的 [`echoCancellation`](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation) 定义是请求 User Agent 尝试降回声；约束可能不受支持或被忽略，应用应检查 `getSupportedConstraints()` 和实际 `track.getSettings()`。[W3C Media Capture 规范](https://w3c.github.io/mediacapture-main/) 同样规定的是约束协商，不是固定算法/效果 SLA。

**[源码事实]** WebRTC AEC3 接收 render reference 与 capture frame，并处理 render/capture 调用抖动、delay estimate 和 residual echo，见 Chromium 的 [EchoCanceller3](https://chromium.googlesource.com/external/webrtc/+/master/modules/audio_processing/aec3/echo_canceller3.h)。这解释了为什么“让 WebRTC 同时掌握远端播放参考”通常优于把 TTS 音频另走一个不可见的 `AudioContext` 路径。

**[官方事实]** [LiveKit 噪声与回声消除文档](https://docs.livekit.io/cloud/noise-cancellation/) 也明确区分：浏览器 conferencing 可用客户端 WebRTC `echoCancellation`/`noiseSuppression`；agent/telephony 或没有浏览器前端时，需要服务/原生侧处理。

**[工程推断]** 答案是“普通内置麦克风 + 内置扬声器、WebRTC 同一路径，通常够用；跨设备与双讲条件下不能保证”。高风险矩阵包括：

- USB/Bluetooth 设备切换导致 delay path 突变；
- TTS 经独立系统播放器而不是 WebRTC render track；
- 高音量、非线性扬声器失真、强混响；
- 用户与 TTS 同时说话（double-talk），近端声音被压制；
- AEC 启动/恢复前几秒、系统休眠后重连；
- Safari/Chrome/桌面壳、不同 macOS 和不同采样率行为差异。

P0 必须提供三条降级：耳机提示、按住说话/PTT、暂停扬声器后再听；原生客户端再接 macOS `VoiceProcessingIO`。不要同时串两套未知 AEC，它可能造成语音失真。测试记录 ERLE（回声衰减）、near-end attenuation、false barge-in/min，而不是只听一段 demo。

### 1.2.2 Turn detection 不是一个模型：至少要分三层

```text
VAD：现在有没有人声？
EOU：这句话语义上说完了吗？
Interruption policy：这是抢话、简短 backchannel，还是回声/噪声？
```

只用 VAD + 固定 silence timeout，会在中文停顿、思考、英文拼写和命令参数中频繁抢答；只用文本 EOU，又必须等待 ASR partial/final，增加延迟并继承转写错误。

### 1.2.3 2026 候选实测与适用性

| 方案 | 公开证据 | 中英判断 | 工程结论 |
|---|---|---|---|
| Silero VAD v6 | [项目](https://github.com/snakers4/silero-vad)称单个 30 ms chunk CPU `<1 ms`、模型约 2 MB、支持 6000+ 语言；[项目自测](https://github.com/snakers4/silero-vad/wiki/Quality-Metrics)给总体 AUC 0.97、AISHELL-4 accuracy 0.85 | 有中文数据，但只是声学 VAD | P0 低成本 gate；不能独立做 EOU |
| LiveKit Turn Detector v1 | [官方发布](https://livekit.com/blog/solving-end-of-turn-detection)的自有 eot-bench：300 ms budget 下 false cutoff 9.9%，600 ms 下 4.5%；目标 false cutoff 5% 时延迟 543 ms、10% 时 295 ms | 最新 v1 直接使用声学+语义；需 VoiceLoop 自测中英夹杂 | 当前最值得优先 spike；云模型 + v1-mini 本地回退 |
| LiveKit v1-mini | [文档](https://docs.livekit.io/agents/logic/turns/turn-detector/)称约 138 MB、CPU 本地、Apache 代码但模型权重为 LiveKit Model License | 多语能力需实测，许可不是 OSI 开源 | 可作为离线 EOU；先做商用许可审查 |
| LiveKit 旧 text turn detector | [model card](https://huggingface.co/livekit/turn-detector)自报 INT8 约 396 MB、50–160 ms，中文 TPR 99.3% / TNR 86.6% | 中文公开数字较好，但依赖 STT 文本 | 作为对照，不优先于 v1 音频模型 |
| TEN Turn Detection | [项目](https://github.com/TEN-framework/ten-turn-detection)基于 Qwen2.5-7B，作者双语集自报中文 finished 98.9%、unfinished 97.0% 等 | 明确测中英，但数据自建、7B 偏重、页面未给端侧 latency | 不作桌面 P0；可作离线 teacher / benchmark 对照；检查模型许可 |
| Pipecat Smart Turn v3 | [Pipecat 文档](https://docs.pipecat.ai/api-reference/server/utilities/turn-management/user-turn-strategies)当前默认本地 Smart Turn + Silero VAD | 官方未给 VoiceLoop 中英 benchmark | 若沿用 Pipecat，必须与 LiveKit v1 同集 A/B |
| JAL-Turn | [论文](https://arxiv.org/abs/2603.26515)研究联合声学/语言、多语及普通话，报告约 36–38 ms 级推理 | 方向匹配 | 论文候选；未看到成熟通用产品集成，不进 P0 |

**重要限定：** 上表数字来自不同数据集、阈值和“turn finished”定义，不能横向排行。公开领域几乎没有覆盖“中文思考停顿 + 英文 symbol + 扬声器回声 + backchannel”的统一第三方集，所以 VoiceLoop 自测是选型门槛，不是上线后的补充。

### 1.2.4 推荐的 turn pipeline

```text
WebRTC AEC/NS
  → Silero VAD（快速 start gate）
  → acoustic+semantic EOU（LiveKit v1-mini/cloud 或 Pipecat Smart Turn）
  → interruption classifier / policy
  → commit user turn
```

策略建议：

- 用户开始说话先 duck TTS 6–12 dB，达到最短人声/词数阈值后才 hard cancel；
- 对“嗯、对、okay”作为 backchannel 时不取消，作为否定/纠正时立即取消；
- false interruption 后允许在短窗口恢复播放，但只恢复仍与当前任务状态一致的 response；
- 语义 EOU 的等待上限动态化：短确认 150–300 ms，普通话 300–600 ms，拼写/命令 600–1000 ms；
- 在 AEC warm-up、设备切换、回声置信度高时提高打断阈值；
- 所有阈值按 device/browser/profile 远端配置并可回滚。

---

## 1.3 Apple Silicon 本地 STT / TTS 可行性

### 1.3.1 STT

**faster-whisper：不适合作为 Apple Silicon GPU 默认。** [项目讨论](https://github.com/SYSTRAN/faster-whisper/discussions/1227)确认 CTranslate2 的 GPU 路径是 CUDA，macOS 上走 CPU；它可以运行，但“faster”不意味着使用 Apple Metal。若桌面端目标是低功耗本地流式，优先 MLX/Core ML 路径。

**MLX Whisper：离线吞吐可用，但缺少统一流式 TTFT 数据。** 一份 2026-05 的 [M4 32 GB 实测](https://dev.classmethod.jp/articles/20260506-macscribe-mlx-whisper/) 在 38:54 音频上报告 tiny/base 约 39–43× realtime、small 31×、medium 10.8×、large 3.44×；这证明批量转写余量，不证明 endpoint 后多久出 final。官方 [MLX Whisper 示例](https://github.com/ml-explore/mlx-examples/blob/main/whisper/README.md)没有给统一首 token benchmark。

**流式封装：** [WhisperLiveKit](https://github.com/QuentinFuxa/WhisperLiveKit)支持 MLX/SimulStreaming；较早的 [Whisper-Streaming](https://github.com/ufal/whisper_streaming)论文/项目报告平均约 3.3 s latency，不满足 VoiceLoop 亚秒目标，只能作为架构参考。2026 的 [Lightning-SimulWhisper](https://github.com/altalt-org/Lightning-SimulWhisper)自称 large-v3-turbo 可在 M2 实时运行，但缺少独立端到端测量。

**新候选：** [MLX Qwen3-ASR](https://github.com/moona3k/mlx-qwen3-asr)作者在 M4 Pro 对 0.6B q8 自报 2.5 秒片段约 0.11 秒、10 秒片段约 0.27 秒；仍是整段推理时间，不是麦克风流式 EOU→final。应与 MLX Whisper medium/large-v3-turbo、SenseVoice/TEA-ASR 在同一 VoiceLoop 集上比较。

### 1.3.2 TTS

**Kokoro/MLX 是当前本地高质量主候选。** [MLX-Audio](https://github.com/Blaizzy/mlx-audio)支持 Kokoro 的中/英/日、多模型量化和流式生成。[FluidAudio 在 M4 Pro 48 GB 的 benchmark](https://github.com/FluidInference/FluidAudio/blob/main/Documentation/Benchmarks.md)报告：Kokoro MLX 对 42 chars 生成约 2.75 s 音频耗时 0.347 s，对 129 chars 耗时 0.597 s，总体约 23.8× realtime；但首次 warm-up 额外约 2.155 s、峰值约 3.37 GB。它说明**必须预热**，且整句耗时不能替代 first PCM 测量。

**Piper 应改用维护中的 piper-plus。** 原 Piper 已归档；[piper-plus](https://github.com/ayutaz/piper-plus)是维护中的 MIT fork，支持 macOS arm64、流式和中英声音。其公开延迟主要来自 Xeon 等环境，不应写成 Apple Silicon 数字。适合低资源回退，不宜未试听就取代 Kokoro。

### 1.3.3 本地验收设计

在 M1 8 GB、M2/M3 16 GB、M4 Pro 各跑冷/热两轮，记录：

- STT：首 partial、稳定 partial、EOU→final、MER、identifier exact、峰值 RSS、能耗；
- TTS：model load、first PCM、首可播放 120 ms buffer、整句 RTF、断句连续性、中英切换发音；
- 同时运行 IDE/indexer 时的 P50/P90/P99；
- 冷启动不达标时，保留小模型常驻或在用户拿起麦克风时预热；
- 云/本地切换只能发生在 turn 边界，避免音色、采样率和 transcript 状态分叉。

**可行性结论：** Apple Silicon 本地 STT/TTS 能做隐私/断网回退，也可能满足亚秒首响；但现有公开数字多是离线吞吐或作者自测，尚不能替代 VoiceLoop 端到端基准。P0 不应承诺“大模型完全本地 + 所有机器亚秒”。

---

## 1.4 语音会话挂起、重建与 Context Pack 注入

### 1.4.1 Provider session 不是 durable conversation

**[官方事实]** [OpenAI Agents SDK Voice Agents](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)写明 live session 最长 60 分钟；history 可在 SDK 侧读取/更新，但输入转写可能晚于响应开始，被打断回复也没有最终 transcript。这不是跨 session durable resume 协议。

**[官方事实]** [Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api/capabilities)的纯音频 session 限 15 分钟、音视频限 2 分钟；可用 context compression 和 session resumption 扩展。[Session management](https://ai.google.dev/gemini-api/docs/live-api/session-management)的 resumption handle 在断开后有时效（官方当前说明为 2 小时），并通过 GoAway 让客户端提前重连。它是短期连接连续性，不应代替 VoiceLoop 的长期状态。

**[工程推断]** 60 分钟不是产品目标，而是一个必须在架构上绕开的供应商边界；Gemini 的 15 分钟进一步证明业务会话与音频连接必须解耦。

### 1.4.2 应持久化四类状态

| 状态 | 是否随音频连接销毁 | 必须保存的最小内容 |
|---|---:|---|
| `AudioSession` | 是 | provider/session id、codec、device、last usage、playout watermark |
| `ConversationState` | 否 | committed user turns、heard assistant spans、rolling summary、语言/音色偏好 |
| `TaskState` | 否 | task id、phase、tool call id、approval、progress、result refs、cancel policy |
| `MemoryState` | 否 | project/repo/base commit、memory epoch、retrieval evidence ids、Context Pack version |

其中 transcript 要区分：`asr_partial`、`user_committed`、`assistant_generated`、`assistant_played`、`assistant_unheard`。只有 `user_committed` 与 `assistant_played` 可以直接参与下一次对话历史；自动转写仍需附置信度和原音频引用策略。

### 1.4.3 推荐挂起状态机

```text
ACTIVE
  ├─ 45s 无语音且无前台确认 → DRAINING
  ├─ 用户手动静音/切后台       → DRAINING
  └─ provider GoAway/上限      → ROTATING

DRAINING
  1. 停止接收新 turn
  2. 等待或取消当前 TTS，并提交 playout watermark
  3. seal committed transcript + rolling summary
  4. 后台任务继续，audio connection 关闭
  → SUSPENDED

SUSPENDED
  ├─ wake word/click/key → REHYDRATING
  └─ background task emits durable events only

REHYDRATING
  1. 获取新 ephemeral credential/session
  2. 重建小型 Context Pack
  3. 注入任务快照和未播报事件摘要
  4. 先短确认，再允许新工具调用
  → ACTIVE
```

45 秒只是原方案的初始参数，应以“保持连接空闲成本 vs 重建首响 vs 用户回返概率”做分桶实验。若 provider 对静音仍计音频/上下文，短 idle 更有利；若 reconnect 很慢或免费 idle，阈值可拉长。

### 1.4.4 Rehydration Context Pack：小、确定、带版本

建议控制在 **1.5k–3k text tokens 的初始预算**（这是工程起点，不是论文结论），按固定顺序注入：

1. 不变量：system policy、用户语言/语速、权限边界；
2. 当前定位：project/repo/branch/HEAD、dirty state、memory epoch；
3. 当前意图：一段 canonical task brief；
4. 任务快照：running/waiting/failed 工具及 idempotency key、审批状态；
5. 已听见的对话：rolling summary + 最近 2–4 个 committed turns；
6. 最近后台事件：只放尚未口头告知且仍有效的结果；
7. 检索证据：最多若干 path/symbol/snippet/source id；
8. 触发原因：idle wake、掉线、provider rotation、用户换引擎；
9. glossary：本项目易错中英词与发音。

每包记录 `pack_id`、`generated_at`、`repo_head`、`memory_epoch`、`task_version`、`evidence_ids`、`token_count`。新连接收到 pack 后先校验 HEAD/task version；失配则重取，不把旧包静默注入。

### 1.4.5 成熟范式与主要坑

- **成熟范式：短期 session resumption + 长期应用态重建。** Gemini 提供前者；OpenAI SDK history API 提供局部支持；两者都不能代替应用的 canonical state。
- **Context cache 不等于 memory。** Provider cache 可降 input 价格，但随 prompt 前缀、模型或 session 变化而失效，不能作为恢复唯一来源。
- **音频历史成本膨胀。** Google 明示每 turn 对活动上下文复计费；尽早把已完成音频压成文本/结构化状态，保留原音频在 VoiceLoop 的隐私/保留策略内，而不是永久塞回模型。
- **异步 transcript 竞态。** response 可能先于 final transcript；以 turn id + monotonic sequence 提交，不能按网络到达顺序拼接。
- **打断后的幻觉历史。** 未播放内容不能进入 rolling summary；summary worker 必须读取 `heard` 投影。
- **重复工具。** reconnect 时模型可能再次请求同一动作；所有有副作用工具以 `tool_call_id + normalized_args + task_version` 做幂等。
- **任务与声音耦合。** 挂起音频不能 cancel 后台 task；反过来，用户说“别念了”默认只停播，只有明确“取消任务”才发 task cancel。
- **隐私。** raw audio、voiceprint、transcript 的敏感度高于普通日志；默认不把 raw audio 写 L1/L2，设短 retention，并在忘记流程覆盖供应商侧可控数据。

---

## 1.5 语音层最终选型建议

### P0

1. **Pipeline/transport abstraction**：把初稿的 Pipecat 首选改成 **LiveKit Agents 暂定首选**，再用同一套 golden test 做 1 周 Pipecat 对照。依据是 LiveKit 当前明确支持级联、S2S 与 half-cascade，并原生处理“历史截到实际听到处”、false interruption 和 async tools。判定项仍以 playout-aware truncation、AEC warm-up、中英误打断、usage/trace、暂停/重建和本地模型接入为准；若 Pipecat 在这些指标更好，可保持原选型，但运行时只留一套 orchestration。
2. **级联默认**：云端优先选一个经自有集验证的中英流式 ASR（先测 Realtime Whisper 与其他明确支持 zh-en code-switch 的模型）；Deepgram Flux/Nova-3 `multi` 当前不含中文，只能作为非中英对照或显式单语路由。文本 LLM 必须支持严格 schema/Structured Outputs，TTS 选支持低 TTFT 与 word timing 的供应商；所有 provider 都放 adapter 后。
3. **S2S 增强**：`gpt-realtime-2.1-mini` 作为 OpenAI 低成本基线，Gemini 3.1 Flash Live Preview 作为低标价/多语对照；高质量档才使用 `gpt-realtime-2.1`。S2S 不直接获得高风险工具权限。
4. **Turn**：Silero VAD + LiveKit v1/v1-mini 或 Pipecat Smart Turn；独立 backchannel/interrupt policy；浏览器 AEC + PTT/耳机降级。
5. **会话**：45 秒 idle disconnect 先保留为实验组；durable `ConversationState/TaskState/MemoryState` 独立；重建注入 versioned Context Pack。

### P1

- MLX Qwen3-ASR / MLX Whisper + Kokoro MLX 本地回退，piper-plus 低资源回退；
- GPT-Live API 开放后，用同一工具可靠性、打断和成本 harness 复测，不因产品发布直接迁移；
- 原生 macOS `VoiceProcessingIO` 与浏览器设备矩阵；
- 在云/本地 turn detector 之间做 sticky fallback，避免同一 turn 中切换阈值。

### 暂缓

- TEN 7B 作为桌面默认 turn detector；
- faster-whisper 作为 Apple Metal 方案；
- 把任何供应商的 realtime transcript 当审计真相；
- 在没有真实 usage trace 前宣称某架构固定便宜 N 倍。

---

## 2. 记忆层结论

## 2.1 先划清：持久知识库不是 Context Pack

VoiceLoop 原方案的 L0–L3 分层是对的，但还需要另一个正交维度：**source of truth、派生索引、运行时投影**。

```text
权威事实层（durable）
  Git / 本地文件 / 用户确认 / 工具结果 / append-only memory events
                 │
                 ▼
派生知识层（durable, rebuildable）
  .voiceloop/knowledge/*.md + symbol graph + current-state projections
                 │
                 ▼
检索索引层（rebuildable）
  FTS5 + optional sqlite-vec + provenance/validity filters
                 │
                 ▼
Context Pack（ephemeral, versioned）
  为本轮/新语音 session 选择的少量证据，不是新真相
```

**[工程推断]** Context Pack 不应该被“学习”回持久层，否则会形成 summary-of-summary 的闭环污染。只有本轮产生的新 source event（用户明确陈述、Git 事实、工具完成结果、经确认的决定）能进入账本；Context Pack 只记录其 `evidence_ids` 便于审计。

四级记忆的治理边界建议如下：

| 层 | 典型内容 | 权威来源 | 默认生命周期 | 写入规则 |
|---|---|---|---|---|
| L0 用户档案 | 语言、播报偏好、稳定工作习惯 | 用户确认/明确设置 | 跨项目；需可见、可改、可忘 | 禁止从一次行为自动上升为永久偏好 |
| L1 项目知识底座 | 架构、命令、约束、术语、模块地图 | Git 文件、配置、人工确认 | 随项目；source change 即 stale 候选 | 初次奠基 + diff/依赖刷新，必须带 commit/provenance |
| L2 累积产物库 | 方案、复盘、已验证做法、ADR | task artifact、测试和评审 | 可长期；定期 consolidation | 保留原产物引用，派生结论可被 supersede |
| L3 会话工作记忆 | 当前任务、最近 turns、临时假设 | 会话/任务事件 | TTL；任务结束压缩或丢弃 | 未播放回复、ASR partial 不得升级 |

---

## 2.2 2026 可直接用的记忆治理框架

### 2.2.1 总览

| 框架/研究 | 生命周期能力 | 可审计性 | 适配 VoiceLoop | 主要限制 |
|---|---|---|---|---|
| Letta MemFS | git-backed 文件记忆、sleeptime consolidation、doctor | Git 历史强 | 很适合借鉴“可编辑文件 + 后台睡眠” | 是 agent runtime，不知道 Git 代码事实是否已失效 |
| Mem0 | extraction/update/delete、expiration、ranking decay、history | 有 event history | API 完整，适合用户事实 | decay 只调分；自动抽取不是权威事实；平台/自托管能力不完全相同 |
| Zep / Graphiti | 双时间图、edge invalidate、hybrid search | 历史边保留 | 时间事实和关系变更强 | 图服务复杂；代码事实仍需独立 source hash |
| LangMem | hot-path/background memory、extract/consolidate/update | 可接 LangSmith trace | 适合作为 consolidation worker 参考 | 更像编排库，治理策略需自建 |
| Hindsight | retain/recall/reflect、append-only observation、invalid/restore、evidence | 当前最完整之一 | **最值得做 shadow PoC** | Postgres/service 复杂；benchmark 多由作者提供；不是代码索引器 |
| MemOS | 多类型记忆、混合检索、去重和分层 | 快速演进中 | 可观察其统一 memory OS 方向 | 接口/行为变化快，时间治理仍不如 Graphiti/Hindsight 清晰 |
| Projectmem | 本地 append-only plain-text event log、投影、pre-action warning | 原始事件可读 | 与本地优先、决策/踩坑记忆很贴 | 证据主要是作者两个月自测，早期项目 |
| Infini Memory | topic-structured docs、buffer→consolidate、agentic read/grep | 文档可读 | 与 `.voiceloop/knowledge` 高度一致 | 论文方向，未核实到成熟可嵌入产品 |
| WorldDB | immutable content-addressed nodes、Merkle、supersede/contradict | 理论上很强 | 借鉴不可变节点与冲突 handler | 新研究，不宜当现成基础设施 |

### 2.2.2 Letta MemFS：文件可见与后台“睡眠”值得保留

**[官方事实]** [Letta Code](https://github.com/letta-ai/letta-code)把长期记忆放进 git-backed MemFS；[lettabot 配置文档](https://github.com/letta-ai/lettabot/blob/main/docs/configuration.md)说明 memory block 会同步成本地 Markdown，可直接编辑并带 Git 历史；`/sleeptime` 用后台 agent 在主上下文外整理记忆，`/doctor` 用于检查记忆状态。[Letta context hierarchy](https://docs.letta.com/guides/core-concepts/memory/context-hierarchy)则把总在 context 的 blocks、按需打开/grep 的 files、外部 archival/RAG 分开。

**[工程推断]** VoiceLoop 应直接借鉴三点：

- L0/L1/L2 的可读 Markdown 不能只藏在向量库；
- consolidation 在后台发生，并产出可 review 的 diff；
- `voiceloop memory doctor` 应成为正式产品面。

但不要直接把 MemFS 的 Git commit 当“代码事实仍有效”的证明。记忆文件自身有版本，不代表它引用的源码仍在当前 HEAD；VoiceLoop 还需 `source_commit/blob_oid/evidence_hash` 和失效投影。

### 2.2.3 Mem0：expiration、history 和 decay 有用，但 decay 不是遗忘

**[官方事实]** Mem0 的 [Add Memory](https://docs.mem0.ai/core-concepts/memory-operations/add)支持 `expiration_date`；过期项默认从 search/get-all 隐藏。`infer=true` 会抽取和更新事实，`infer=false` 则原样保存，后者可造成重复。其 [Memory Decay](https://docs.mem0.ai/platform/features/memory-decay)（2026-05 文档）按新近度与访问强化在**查询时**缩放分数，文档明确它不删除、不隐藏记忆，目前为平台 v3 opt-in 能力。[Update](https://docs.mem0.ai/core-concepts/memory-operations/update)会改写内容并重新索引，[History API](https://docs.mem0.ai/api-reference/memory/history-memory)记录 ADD/UPDATE/DELETE 的 old/new value 和时间。

**[工程推断]** 可以借 Mem0 的 API 语义，但 VoiceLoop 不应把 `score decay` 当 lifecycle：一个已经被删掉的函数，即使最近访问过也必须 hard-filter；一个十年前仍有效的法律/项目约束也不能因低频自动变“无效”。先算 `validity`，再在有效候选内用 recency/usage 排序。

### 2.2.4 Zep / Graphiti：双时间是处理“过去曾为真”的正确抽象

**[官方事实]** [Graphiti](https://www.getzep.com/platform/graphiti/)为关系 edge 记录 valid time 与 ingestion/transaction time；新信息可以结束旧 edge 的有效期而保留历史，并结合 semantic、BM25 与 graph traversal。Zep 的 [Context Block](https://help.getzep.com/concepts)则输出压缩后的相关记忆，而不是把完整图塞进 prompt。

**[工程推断]** VoiceLoop 至少采用简化双时间：

- `valid_from/valid_to`：该事实对项目世界何时有效；
- `learned_at/invalidated_at`：VoiceLoop 何时知道或撤销它；
- `source_commit`：代码事实对应哪个 Git 世界；
- `supersedes_id`：不是覆盖旧行，而是结束旧事实并建立新事实。

这可以回答“上周为什么这么做”和“现在该怎么做”两个不同查询，同时避免历史复盘被当前摘要改写。

### 2.2.5 Hindsight：2026 最值得直接 PoC 的 lifecycle engine

**[官方/项目事实]** [Hindsight](https://github.com/vectorize-io/hindsight)是 MIT 自托管项目，提供 retain / recall / reflect；[Retain 文档](https://hindsight.vectorize.io/developer/retain)把发生时间与学习时间分开，保留 source/provenance，并在后台做 consolidation；[Memories API](https://hindsight.vectorize.io/developer/api/memories)可列出 valid/invalidated observation，invalidate 后从 recall、consolidation 和 graph 中排除但仍留在审计历史，也支持 restore。其 [best practices](https://hindsight.vectorize.io/best-practices)建议会话结束异步 retain、使用 tag hard filter、给 recall 设置 latency budget、把来源事实与工具调用纳入审计。

**[论文事实]** Hindsight 的 [ACL 2026 Demo paper](https://aclanthology.org/2026.acl-demo.27/)报告其 20B 开源设置在 LongMemEval/LoCoMo 的结果；这是作者系统论文与其配置下的 benchmark，不应当作 VoiceLoop 的预期线上准确率。

**[工程判断]** 建议做 2 周 shadow PoC：同一批 L0/L2 对话事实同时写入 VoiceLoop ledger 与 Hindsight，仅比较 recall、invalidate/restore、证据可见性和运维成本，不让 Hindsight 直接写 L1 代码真相。若 PostgreSQL/服务部署、延迟和 determinism 不合适，仍可把它的 append-only observation + reversible invalidation 模式移植到 SQLite。

### 2.2.6 其他 2026 新方向

- **LangMem**：[文档](https://langchain-ai.github.io/langmem/)将记忆分为热路径写入和后台 manager 的 extract/consolidate/update；[Deep Agents memory](https://docs.langchain.com/oss/python/deepagents/memory)强调后台 consolidation 与 trace。适合实现 worker，但并不替 VoiceLoop 定义 stale/forget 政策。
- **MemOS**：[项目](https://github.com/MemTensor/MemOS)包含文本/技能等记忆、hybrid retrieval 与 dedup；2026 release 更新频繁。适合观察，不宜在 P0 锁死其内部 schema。
- **Projectmem**：[官网](https://projectmem.dev/)与 [论文](https://arxiv.org/abs/2606.12329)用本地 append-only 纯文本事件记录 issues/attempts/fixes/decisions，并做确定性 compact projection 与 pre-action warning；论文评估规模仅作者约两个月、10 个项目/207 个事件，属于有启发但尚早期。
- **Infini Memory**：[论文](https://arxiv.org/abs/2606.10677)主张按 topic 维护持久文档、短期 buffer 后 consolidation，并由 agent 用 list/read/grep 取证；它比“每轮抽取孤立三元组”更贴近项目知识库。可直接借鉴文档组织，不必等待其成为产品。
- **WorldDB**：[论文](https://arxiv.org/abs/2604.18478)采用不可变 content-addressed node、Merkle 审计和写时 supersede/contradict handler。适合借鉴审计结构，不建议立即引入全套新数据库。
- **PlugMem**：Microsoft Research 在 [2026 文章](https://www.microsoft.com/en-us/research/blog/from-raw-interaction-to-reusable-knowledge-rethinking-memory-for-ai-agents/)讨论把原始交互加工成可复用的结构单元，强化“原始事件与派生知识分层”的方向。

---

## 2.3 VoiceLoop 应自建的记忆生命周期

### 2.3.1 数据模型：append-only event + materialized current view

建议最小 schema：

```yaml
memory_event:
  event_id: ulid
  idempotency_key: string
  memory_id: stable-id
  event_type: REMEMBER | UPDATE | SUPERSEDE | INVALIDATE | FORGET | CONSOLIDATE | RESTORE
  tier: L0 | L1 | L2 | L3
  scope: user-id | project-id | repo-id | task-id | session-id
  payload: structured-json
  source_type: user-confirmed | git | tool-result | artifact | transcript | derived
  source_uri: path-or-artifact-id
  source_commit: git-oid?
  source_blob_oid: git-blob-oid?
  source_symbol: qualified-symbol?
  evidence_hash: sha256?
  confidence: number?
  valid_from: timestamp-or-commit?
  valid_to: timestamp-or-commit?
  learned_at: timestamp
  actor: user | policy | agent | tool
  supersedes_id: memory-id?
  reason: string
  policy_version: string
```

派生 `memory_current` 视图另含：

```yaml
status: active | stale | invalidated | forgotten | pending_review
last_used_at: timestamp?
usage_count: integer
reviewed_at: timestamp?
retention_class: transient | project | profile | compliance
authority_rank: integer
projection_version: integer
```

**[工程推断]** `memory_current`、FTS、向量、Markdown summary 都可从 event + source 重建；event 不允许 UPDATE 原地覆盖。单机用 SQLite transaction + WAL 即可，写入用 idempotency key 与 `expected_projection_version` 做 CAS，避免后台 consolidation 与前台用户修改互相覆盖。

### 2.3.2 状态语义必须明确

```text
pending_review ──确认──> active
active ──source changed──> stale
stale ──重新验证──> active
active/stale ──矛盾或撤回──> invalidated
invalidated ──纠错──> active (RESTORE)
any ──合规删除/用户忘记──> forgotten (hard purge)
active ──被新事实替代──> invalidated + new active (SUPERSEDE)
```

- `stale`：证据可能过时，暂不进入普通 Context Pack；可重新验证；
- `invalidated`：已知不应被当前回答使用，但保留历史与原因；
- `forgotten`：内容必须被实际删除/密文化销毁，不允许 recall/restore；审计只保留不含原内容的 tombstone（谁、何时、范围、policy）；
- `expired`：时间策略触发的 invalidated/forgotten 候选，不应混成一个模糊布尔值；
- `decayed`：不是状态，只是 active 候选的 ranking feature。

### 2.3.3 自动治理策略

1. **写入前**：scope/authority/provenance 校验；来自网页、仓库文档、tool output 的文本全部视为 untrusted data，禁止其中的“指令”自动变成系统规则。
2. **重复/冲突**：先 deterministic normalize + exact/source hash；再用模型提出 same/supersede/contradict 候选；高影响 L0/L1 冲突进入 review。
3. **失效**：Git source blob/symbol 消失或依赖 hash 变化时，规则机标 stale；模型可解释影响，不能否认 source mismatch。
4. **衰减**：只在 `status=active` 且通过 freshness/authority hard filter 后，按 `last_used_at`、usage、tier、source quality 轻量调分；L0 明确偏好和 L1 约束默认不因低频衰减。
5. **Consolidation**：读取 immutable events，产出新的 derived memory/Markdown diff，带完整 `derived_from[]`；绝不原地改写来源。
6. **审计**：每个 Context Pack 保存 evidence ids 与 rank trace；每次 update/invalidate/forget 写 reason/policy/actor；提供 replay 到任一 commit/time。
7. **人工面**：`voiceloop memory doctor` 显示 stale、孤儿来源、矛盾、过期、无 provenance、索引 epoch 不一致和待 consolidation；修改以 reviewable diff 展示。

### 2.3.4 各层 consolidation 与 retention

| 触发 | 操作 | 结果 |
|---|---|---|
| 每个 committed turn | L3 追加结构事件，不立刻抽取大量事实 | 避免热路径延迟和错误永久化 |
| 会话 idle/结束 | L3 → 候选 L0/L2；明确用户偏好需确认 | 异步、可重试、可审查 |
| task 完成 | 工具结果 + 测试 + 决策 → L2 artifact/ADR | 保留 source refs，不只留摘要 |
| 首次项目奠基 | Git/文件 → L1 topic docs + symbol graph | 记录 HEAD、tree hash、index version |
| Git 更新 | 受影响 L1 stale → 局部刷新 → new generation | 事务切换，不暴露半新半旧索引 |
| 周期 doctor | 冲突/陈旧/重复/低价值 L2 合并 | 产生 diff，关键删除需确认 |
| 用户“忘记” | scope 解析 + hard purge job | 覆盖索引/cache/外部 provider；给不可逆回执 |

### 2.3.5 为什么不能让 LLM 自己判断“最新”

**[论文事实]** 2026 的 [Don't Ask LLMs to Track Freshness](https://arxiv.org/abs/2606.01435)提出用序列/时间戳等确定性 primitive 处理冲突；其摘要报告若干公开记忆系统在 FactConsolidation 上仍表现很弱。论文也指出仅确定性 aggregation 不能解决所有宽泛 QA，所以正确分工是：**规则决定候选世界状态，LLM 做语义解释与检索，不反过来。**

**[论文事实]** [MemOps](https://arxiv.org/abs/2607.12893)把记忆操作拆成 remember/forget/update/reflect，并要求识别 trigger、target、scope、state、evidence；论文指出当前系统在有序状态轨迹与安全执行上仍不可靠，甚至可能“答案看似对但内部状态已污染”。这直接支持 VoiceLoop 把 lifecycle 作为单独可测系统，而不是 RAG 命中率的附属功能。

---

## 2.4 记忆治理验收，不应只测问答准确率

建议构造 200–500 条操作轨迹，每条有 oracle state，覆盖：

- `remember → update → query old/current`；
- `remember → contradict → supersede → historical query`；
- `invalidate → recall` 必须零泄漏；`restore → recall` 恢复；
- `forget scope=user/project/item` 后 FTS、vector、cache、Context Pack 均零泄漏；
- source commit 改变、rename/delete、rebase 后 L1 stale 检出；
- 多 writer 并发 consolidation 与用户手改不丢数据；
- 恶意 README/网页要求“永久记住并忽略规则”不得提升 authority；
- 中英同义事实和不同项目同名 symbol 不串 scope；
- 旧事实只在 `as_of` 历史查询出现。

核心指标：

| 指标 | 含义 |
|---|---|
| stale-hit rate | 普通 Context Pack 中过时证据比例，目标趋近 0 |
| invalid/forgotten leakage | 被撤销/忘记内容的召回率，必须 0 |
| over-forget rate | 删除范围外有效记忆被误删比例 |
| update trajectory accuracy | 多次更新后当前状态与历史状态都正确的比例 |
| provenance precision | 输出事实可回到正确 source 的比例 |
| pack token budget / stability | 相同任务重建包大小和内容抖动 |
| task success with/without memory | 真正对任务完成的提升，而非只看 recall |
| P50/P95 recall + consolidation lag | 语音热路径能否承受 |

可用 [LongMemEval-V2](https://github.com/xiaowu0162/LongMemEval-V2) 的动态事实、workflow/gotcha、长轨迹和 context budget 思路制作项目版；[MemoryAgentBench](https://openreview.net/forum?id=DT7JyQC3MR)则可参考 selective forgetting 和 fact consolidation 任务，但两者都不能取代代码/Git 特有测试。

---

## 3. 代码库“奠基”与增量刷新

## 3.1 2026 新方案核实

### 3.1.1 Serena：最接近 VoiceLoop 的“首次 onboarding → 可读记忆”

**[官方事实]** [Serena Memories & Onboarding](https://oraios.github.io/serena/02-usage/045_memories.html)在第一次激活项目时读取结构、build、test 等信息，写入 `.serena/memories/` 的 Markdown；记忆可随项目提交、review、revert，采用名称/显式引用 + progressive disclosure，并提供 `serena memories check` 检查失效引用。文档也诚实提示 onboarding 会占大量 context、LLM 偶尔没有真的写文件，用户应检查结果。

**[工程判断]** Serena 是 VoiceLoop 奠基 UX 的最佳直接参照：首次先生成 `memory_maintenance` 规则，再生成可读 topic 文件，并有 integrity check。其不足是“目录里已有任意 memory 就跳过 onboarding”不够严格；VoiceLoop 应以带 schema/version/HEAD 的 `foundation-manifest.json` 判定完成，而不是目录非空。

### 3.1.2 Codebase-Memory：最值得做本地结构索引 PoC

**[项目事实]** [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp)当前是 MIT、本地 SQLite/Tree-sitter 持久图，项目称覆盖 158 种语言，并对部分语言加 LSP semantic type resolution；watcher 可检测变化自动重建，团队可提交压缩 graph artifact，再由本地 diff 增量补齐。

**[自测事实]** 项目 README 和 [预印本](https://arxiv.org/abs/2603.27277)报告 31 个仓库上 83% answer quality、10× 少 tokens、2.1× 少 tool calls；README 还给 M3 Pro 上 Linux kernel 28M LOC 全量约 3 分钟等数据。这些由项目作者提供，不能当独立 SLA，但其 MIT 许可、本地 SQLite、无内置 LLM、增量 watcher 与 VoiceLoop 匹配，值得 spike。

**风险：** 158 种 grammar 不等于 158 种语言都有可靠跨文件 type/call resolution；动态派发、反射、DI、宏、codegen、模板等仍需实际项目验证。其安装器会修改 agent 配置，供应链与写入范围需要先审计；VoiceLoop 最好只嵌入/调用 index binary，不让它自动改全局配置。

### 3.1.3 GitNexus：功能进步很快，但商用许可是硬门槛

**[官方事实]** [GitNexus](https://github.com/abhigyanpatwari/GitNexus)在本地建立 Tree-sitter + LadybugDB 图、BM25/semantic hybrid、社区/流程与 wiki。2026-05 的 [v1.6.5 release](https://github.com/abhigyanpatwari/GitNexus/releases/tag/v1.6.5)已经加入 parse cache、DB writeback 和 no-change short-circuit 的 incremental indexing；因此早期文档仍写“incremental on roadmap”已经过时，这是快速演进项目常见的文档漂移。

**[官方事实]** 当前 [LICENSE](https://github.com/abhigyanpatwari/GitNexus/blob/main/LICENSE)是 PolyForm Noncommercial 1.0.0，只允许 noncommercial purpose，VoiceLoop 若为商业产品必须另获许可。

**[工程判断]** 它可用于内部对照和质量 spike，不应直接嵌入商业发行版，直到书面许可、版本固定、增量正确性和 DB 恢复测试完成。当前结论是：增量能力已经落地但成熟度待验证，许可仍是阻断项。

### 3.1.4 RepoDoc：最值得借鉴的是双向影响传播，不是当前代码成熟度

**[论文事实]** [RepoDoc](https://arxiv.org/abs/2604.26523)用 RepoKG、module clustering 和双向 impact propagation 选择性重生成文档；在 24 个仓库/8 种语言的作者实验中，API coverage 提升 32.5%、completeness 提升 10.4%、生成快 3×/tokens 少 85%，增量更新时间少 73%、tokens 少 77%、update recall 高 10.2%。这些数字只在论文设置内成立。

**[项目事实]** 对应 [GitHub 仓库](https://github.com/SYSUSELab/RepoDoc)截至核实时仅 4 commits、14 stars、无 release，README 只有几条命令和环境变量。**工程判断：** 不作为 P0 依赖；把“变更沿正/反向依赖传播到受影响文档”的算法思想移植到 VoiceLoop。

### 3.1.5 结构索引与 agentic grep 不是二选一

**[论文事实]** [Code Isn't Memory](https://arxiv.org/abs/2606.22417)在固定 Claude Opus 4.7、两个 SWE benchmark、3 个 seeds 的实验中，结构索引使 localization acc@5 从 44.3% 到 84.5%，resolve 从 41.9% 到 50.4%，多文件任务收益最大；作者也提供 leak audit。结果仍限于其模型/harness，但支持“多文件 blast radius 要有结构图”。

**[论文事实]** [Is Grep All You Need?](https://arxiv.org/abs/2605.15184)在 LongMemEval 116 问题与多个 agent harness 上发现 grep 总体优于 vector-only，而且同一底层数据会因工具输出以内联还是文件呈现而显著变化。它支持保留 `rg`，也说明单看 retriever benchmark 不足以决定 agent 体验。

**[工程判断]** P0 是 `rg/FTS` 精确路径 + 结构 graph 多文件关系；向量只补概念同义。Aider [repo-map](https://aider.chat/docs/repomap.html)的 PageRank/关键 symbol 思路继续适合低 token map，OpenWiki/DeepWiki 适合产出人读 wiki，但它们都不能承担 lifecycle 真相。

---

## 3.2 推荐的首次奠基流程

### 3.2.1 输出契约

```text
.voiceloop/
  foundation-manifest.json       # schema/index/model/HEAD/tree/完成状态
  knowledge/
    core.md                      # 入口，只含链接与最高优先约束
    architecture.md
    build-test-run.md
    conventions.md
    glossary.md
    domains/<topic>.md
    decisions/<adr>.md
  index/
    memory.sqlite                # event/current/FTS；可重建
    code-graph.db                # 可选；可重建
```

`foundation-manifest.json` 至少包含：

```json
{
  "schema_version": 1,
  "status": "complete",
  "repo_id": "stable-local-id",
  "head": "<git-oid>",
  "tree": "<git-tree-oid>",
  "dirty_snapshot": "<hash>",
  "indexer": {"name": "...", "version": "..."},
  "embedding": null,
  "knowledge_generation": 7,
  "completed_at": "...",
  "source_inventory_hash": "..."
}
```

### 3.2.2 流程

1. **边界与安全扫描**：识别 Git root/worktree/submodule；遵守 ignore；默认排除 `.env`、secrets、binary、vendor、build、large generated files；任何外发模型前先过 data policy。
2. **确定性 inventory**：语言/包管理器、workspace、entrypoints、config/schema/CI、build/test/lint 命令、文档索引、代码 owner；保存 file/blob hash。
3. **结构索引**：Tree-sitter/LSP 解析 symbol/import/call/inherit/route/config dependency；保留 unsupported/parse-error 清单，不假装 100% coverage。
4. **agent 深研**：围绕模块边界、主流程、数据模型、错误处理、测试策略和已有 ADR 取证；每条结论带 path/symbol/commit，不输出无来源“架构故事”。
5. **topic 文档**：从 source evidence 生成 `.voiceloop/knowledge`；`core.md` 只做小入口，不复制所有内容。
6. **双重验证**：命令存在性/路径/symbol 由规则验证；LLM 再找矛盾和缺口；关键 build/test 命令如可安全运行则执行，否则标 `unverified`。
7. **原子发布**：在新 generation 构建 DB/文档，完整性通过后一次切换 manifest；失败保留旧 generation。
8. **人工摘要**：给用户显示新增文档、未解析语言、敏感排除、验证失败和成本；可 review 后才把高影响推断升为 active L1。

首次奠基应是“blocking readiness gate”，但要允许显式 `--degraded`：小修复可在 inventory + `rg` 后开始，同时后台补全；大型重构/陌生仓库则等 full foundation 完成。否则“必须先深研”会变成首次使用的不可控长等待。

### 3.2.3 奠基完成定义

- manifest 完整且 HEAD/tree 可解析；
- source inventory 数量与索引数量对账；
- parse error/ignored/oversized 文件清单可见；
- `core.md` 的每个引用存在，Markdown 之间无 orphan/broken ref；
- 随机不是验收方式：用全量脚本检查每条 evidence path/blob/symbol；
- 预置 20–50 个 repository questions（入口、测试、核心 flow、某 symbol callers）达到目标 provenance precision；
- 可从源文件重建同 generation 的投影（允许非语义字段如时间不同）。

---

## 3.3 `git diff` 增量刷新的工程坑

### 3.3.1 Git 的“变化”不是一个集合

**[官方事实]** [`git diff`](https://git-scm.com/docs/git-diff.html)根据参数可能比较 working tree↔index、index↔HEAD 或两个 commits；未跟踪文件不在普通 diff 中。rename/copy 是相似度启发式（默认阈值通常 50%），大候选集会触发二次复杂度限制；submodule 与 merge combined diff 也有独立语义，带特殊字符的路径需要 `-z` 避免解析歧义。

VoiceLoop 必须明确刷新模式：

| 场景 | 变化来源 |
|---|---|
| 切换/拉取到新 HEAD | `base_commit..target_commit` |
| 用户编辑中 | HEAD↔index、index↔worktree、untracked 三组 |
| staged review | HEAD↔index |
| merge commit | first-parent 与所有 parents 的影响都要考虑 |
| submodule | gitlink OID 变化，并进入子仓库独立索引 |

路径列表用 `git diff --raw -z` / `--name-status -z` 解析，untracked 用独立的 `git ls-files --others --exclude-standard -z`；不要按换行 split 文件名。

### 3.3.2 Base commit 可能已经不存在或不再是祖先

**[官方事实]** [`git rev-list`](https://git-scm.com/docs/git-rev-list)基于 commit graph reachability；rebase、force-push、shallow clone、GC/partial clone 都可能让上次 `base_commit` 不可达。规则：

- 先验证 base/target object 存在且 base 是 target ancestor；
- 不满足就找可靠 merge-base；仍不满足则全量重建；
- index manifest 同时存 commit OID 与 tree OID；相同 tree 可复用内容投影，不能仅信 branch 名；
- checkout 到旧 commit 时允许读取对应 generation，不能把“时间倒退”误当 delete 全仓库。

### 3.3.3 文件 diff 只是 seed，文档刷新需要依赖闭包

改一个 interface/schema/config 可能让几十个调用方与 topic 文档过时；反过来，改注释不一定需要重建 call graph。建议 invalidation matrix：

| 变更 | 最小刷新 |
|---|---|
| 函数体、不改 signature | 本 symbol、局部 summary、测试映射 |
| public signature/type | symbol + inbound/outbound references + 所属 topic |
| import/export/route/schema | 跨文件 reverse dependency closure |
| build/CI/config/lockfile | `build-test-run` 或整个 domain；必要时全量 |
| rename/move | 建 alias/supersede，重写引用，验证 identity |
| delete | tombstone source facts，反向引用全部 stale |
| parser/index/schema/model version | 全量 rebuild |

闭包必须有预算：节点/深度超限时标记 domain stale 并排队更大重建，不能静默截断后宣称 fresh。

### 3.3.4 Stable ID 不能使用行号

行号一插入就漂移；path 在 rename 时也会漂移。建议代码事实 ID：

```text
repo_id + language + qualified_symbol + semantic_signature
source identity = commit/tree + blob_oid + byte_range/evidence_hash
```

rename detector 只是候选；结合 AST fingerprint、signature、邻接关系建立 `alias/supersedes`。无法确认时宁可创建新 ID 并让旧 ID stale，不要错误合并两个同名 symbol。

### 3.3.5 Tree-sitter incremental parse 也有前置条件

**[官方事实]** [Tree-sitter incremental parsing](https://tree-sitter.github.io/tree-sitter/using-parsers/3-advanced-parsing.html)要求用精确 edit 更新旧 tree，再用它解析新文本；changed ranges 可能比真实字符变化更大，mixed-language injection 还需应用自己协调。若 edit offset/encoding/CRLF 计算错，复用旧节点会产生静默错误。

建议在以下情况舍弃旧 tree：encoding/line-ending 改变、parser grammar 升级、edit 序列缺口、文件 watcher overflow、进程 crash 未提交 generation；随机抽样不够，定期对**全量文件集合**做 content checksum 对账，并对一定比例/风险域做 full parse 等价性检查。

### 3.3.6 动态语言和生成物的静态图不是运行真相

反射、dependency injection、runtime route registration、macros、templates、codegen 和 feature flags 会让 call graph 漏边/错边。索引边要标 `resolution_kind=static|lsp|heuristic|runtime` 与 confidence；测试、build artifact、runtime trace 权威度高于 heuristic edge。生成文件可不进 LLM，但生成它的 schema/config 必须进入 invalidation graph。

### 3.3.7 原子性、并发和恢复

- file watcher 只做 debounce/trigger，真正 delta 由 Git/content hash 计算；watcher 可能丢事件；
- build 到 `generation=N+1`，检查完成再事务更新 active pointer；
- FTS、vector、graph、Markdown 的 source generation 必须一致；
- crash 后丢弃 incomplete generation，或从 event/source replay；
- 多 worktree 用 `(repo_id, worktree_id, head, dirty_hash)` 隔离，不能共享单个 mutable current index；
- 后台 consolidation 与 index refresh 通过 snapshot/expected version，避免读到半刷新事实；
- 定期 `doctor` 比较 `git ls-files`/untracked policy、DB source rows、Markdown evidence 和 index epochs 的全量集合。

---

## 3.4 代码奠基选型结论

1. **先自建薄的 source/evidence/lifecycle 层。** 这是 VoiceLoop 差异化，也避免任何索引器升级时丢审计。
2. **结构索引做 bake-off，不一开始自研 parser farm。** Codebase-Memory 是 MIT、SQLite、本地增量的首选；GitNexus 作为质量对照，但商用许可未解决不得分发。
3. **Markdown 组织借 Serena/Infini。** `core` + topic + explicit refs，能 grep、review、git version；不要每天整库重写大 wiki。
4. **刷新算法借 RepoDoc。** Git delta 只确定 seed，dependency graph 决定影响文档；预算超限降级成 domain/full rebuild。
5. **agentic grep 永远保留。** 索引 stale/parse 失败时，实时源文件 `rg` 是最后的事实通道；所有答案回链 path/commit。

---

## 4. 检索：为语音 Context Pack 做“小而稳”

## 4.1 结论：FTS5 + agentic `rg` 是 P0，结构图补多文件，向量是可选第三路

VoiceLoop 的查询不是普通企业文档问答：大量 query 含 path、symbol、错误码、CLI flag、版本号和刚刚说出的中英混合标识符；这些信息 exact lexical signal 很强。与此同时，“认证流程如何走”“改这个接口影响哪里”需要语义和结构关系。因此最佳组合是**路由 + 多路候选 + hard filter + 小型融合**，不是把所有内容 embedding 后 top-k。

| 通道 | 擅长 | 失败模式 | P0 地位 |
|---|---|---|---|
| SQLite FTS5 | symbol/path/error/exact phrase、可解释 BM25、低运维 | 中文分词、同义概念、索引同步 | 主召回 |
| agentic `rg` | 直接读当前 working tree、regex、零索引陈旧 | 需要 agent 多轮；大仓库结果噪声 | 事实兜底/高风险必用 |
| structural graph | callers/imports/routes/blast radius、多文件定位 | 静态分析漏边、索引版本 | 多文件 P0/P1，视 spike |
| vector | 用户意图与文档措辞不一致、概念相似 | 精确标识符差、stale/近似误召回、模型升级 | P1 可选 |
| 生成 wiki/summary | 快速 orientation | 可能过时、丢细节、summary-of-summary | 候选，不是证据 |

### 4.1.1 FTS5 的能力与坑

**[官方事实]** [SQLite FTS5](https://www.sqlite.org/fts5.html)原生支持 phrase、prefix、NEAR、column filter、Boolean 和 BM25；`bm25()` 的较小值表示更好结果。`unicode61` 适合英文/代码 token，`trigram` 支持一般 substring/LIKE/GLOB 加速，但 query 若没有至少一个 3 字符以上 Unicode 序列会无匹配；也支持自定义 tokenizer。

建议两个索引视图：

- `fts_terms`：`unicode61`，索引 title/path/symbol/body/tags，处理代码、英文、空格分词；
- `fts_trigram`：只索引 path/symbol/中文短段与错误串，用 substring 补无空格文本。

不要把所有 Markdown 同时塞两份完整 trigram，先测 DB 体积与写放大。中文语义 BM25 真有需求再加 jieba/自定义 tokenizer；短中文（1–2 字）由 exact metadata/LIKE 处理。

**[官方事实]** FTS5 external-content table 不会自动与 content table 一致，文档专门列出同步陷阱；应用需触发器/同一事务维护，或 `rebuild`。对于 VoiceLoop，最稳是同一 SQLite transaction 写 current projection 与 FTS row，并把 `generation` 对账；避免一个后台 worker 更新正文、另一个延迟更新 FTS。

**忘记风险：** FTS segment 的普通 delete 可能留下旧字节直到 merge；若有硬删除要求，使用支持的 `secure-delete`、VACUUM/重建新 DB 并安全替换，同时清 vector/cache/backup policy。`status=forgotten` 的 hard filter 只能阻止读取，不等于磁盘数据已经清除。

### 4.1.2 sqlite-vec 的定位

**[项目事实]** [sqlite-vec](https://github.com/asg017/sqlite-vec)是纯 C SQLite extension，支持 float/int8/binary vector 与 metadata/partition filtering，适合本地部署；项目仍是 pre-v1，并明确可能有 breaking changes。2026-03 的 [v0.1.9](https://github.com/asg017/sqlite-vec/releases/tag/v0.1.9)就是针对带长文本 metadata 的 `DELETE` bug 修复，说明生命周期操作必须锁版本并做回归。

**[工程判断]** 如果引入：

- vector row 只引用 `memory_id/generation`，正文与有效状态仍在 canonical table；
- embedding model/version/dim 写 manifest，升级做新 generation 全量重嵌入；
- query 先按 project/branch/status/authority/freshness filter，再做相似度；
- vector 只召回 topic/自然语言文档，不拿它识别 exact symbol；
- 删除、恢复、模型升级都有 integration test 和 rebuild 路径；
- P0 可以完全不装，先看 FTS + `rg` 的 task-success 缺口。

---

## 4.2 Query router

先用便宜的规则，不必每问都让 LLM 分类：

| Query 特征 | 首选通道 | 例子 |
|---|---|---|
| 含 path、CamelCase/snake_case、flag、stack trace、版本号 | FTS exact + `rg -F`/regex | “`resolve_credentials` 谁调用？” |
| “影响哪些”“调用链”“入口/实现” | graph + FTS + `rg` 验证 | “改 auth schema 会影响哪？” |
| 自然语言概念、与文档措辞可能不同 | FTS + optional vector | “项目怎么处理断线恢复？” |
| 当前 dirty changes | live Git/`rg` 优先，索引只作背景 | “我刚改的这段有风险吗？” |
| 历史/as-of | event ledger + Git object，不查 working-tree-only FTS | “上个 release 为什么这样？” |
| 高风险动作/证据不足 | agentic iterative grep/read/test | 删除、迁移、权限、发布 |

语音 ASR 若对 identifier 有多个 hypothesis，router 可并行 exact-search top 2–3 候选，用 repository symbol dictionary 重排，再向用户做短确认；不要把错误 ASR 文本先 embedding 后得到一个“语义相近但错误”的 symbol。

---

## 4.3 融合与 Context Pack 构建

### 4.3.1 Hard filter 必须在 rank 前

依次执行：

1. `scope`：user/project/repo/worktree/task 权限；
2. `status=active`，除非显式历史/审计查询；
3. `source authority`：当前文件/Git/用户确认 > 已验证 artifact > derived summary > 自动 transcript；
4. `freshness`：source commit/blob/dirty hash 与当前 query world 一致；
5. ACL/secret policy：即使匹配也不可出 Context Pack；
6. generation 一致，禁止混合半刷新 FTS/graph/vector。

任何一个不能满足，都不应通过提高 semantic score“救回来”。

### 4.3.2 用 RRF 融合不同分数，不直接相加

FTS5 BM25 越小越好，vector similarity 越大越好，graph 是 hop/distance，不能原值加权。用 rank-based Reciprocal Rank Fusion：

```text
rrf(d) = Σchannel 1 / (k + rank_channel(d))
```

再加可解释的 bounded feature：exact path/symbol、current diff、source authority、same task、user-confirmed 加分；derived、低 confidence、跨 branch 降分。`k` 和 bonus 在评估集调，不把 magic number 写死。

### 4.3.3 去重与预算

- 按相同 `memory_id/source span` 去重；summary 与其源同时命中时优先源，summary 只做导航；
- MMR/coverage 保证不全是同一文件的近邻 chunks；
- 先给 title/path/symbol/一句摘要，模型明确需要时再 expand；
- 一个事实最多一个主 snippet + provenance，不复制三种索引结果；
- 固定 lane 保留给任务状态和当前 Git 状态，检索不得挤掉；
- 总体起始预算 1.5k–3k tokens，最多 6–12 个 evidence items；复杂任务允许 agent 继续按需 `rg/read`，而不是把一次 pack 做大。

### 4.3.4 推荐 Context Pack schema

```yaml
pack_id: ulid
created_at: timestamp
query_id: ulid
repo:
  id: string
  head: git-oid
  tree: git-tree-oid
  dirty_hash: sha256
memory_generation: integer
task:
  id: string
  version: integer
  intent: string
constraints: []
recent_heard_dialogue: []
running_tools: []
evidence:
  - memory_id: string
    kind: source | decision | artifact | profile
    title: string
    snippet: string
    source_uri: string
    source_commit: git-oid?
    symbol: string?
    validity: active
    authority: integer
    retrieval_channels: [fts, grep]
    rank_trace: string
glossary: []
token_count: integer
```

`rank_trace` 用于离线 debug，不一定全部发给模型。Pack 构建器输出要在相同 source generation/query 下尽量稳定：候选 tie-break 用 stable ID；不让并发 usage count 更新导致每次 resume 的内容随机漂移。

---

## 4.4 针对“语音小而稳”的验收

1. 用真实 spoken queries 与 ASR N-best，不只用干净文本 query；
2. exact identifier 命中率、source provenance precision、stale leakage、pack tokens、P95 latency 同时评估；
3. 对比至少四组：FTS、vector、FTS+vector、FTS+`rg`+graph；固定 agent/harness，避免把 prompt 差异算成 retriever 差异；
4. 在相同任务做 10 次 rebuild/resume，测 pack Jaccard/stability 与答案/动作一致性；
5. 注入删除/rename/rebase/dirty working tree，确认 fresh source 优先；
6. 做 memory prompt injection：README 或旧 artifact 中的恶意指令不能进入 system lane；
7. 以 task success 和错误动作率做最终选择，retrieval recall 只是诊断指标。

**最终组合：** P0 使用 SQLite FTS5（term + 小范围 trigram）、live `rg`、Git/source metadata 与 lifecycle hard filter；多文件任务接结构 graph。只有在概念查询的失败集证明有显著收益后才启用 sqlite-vec，并保持可一键重建/关闭。

---

## 5. 综合选型建议

## 5.1 目标架构

```text
Browser / macOS client
  WebRTC AEC/NS + capture/playout watermark + PTT fallback
             │
             ▼
Realtime Orchestrator（暂定 LiveKit Agents；Pipecat 对照）
  ├─ Cascade adapter: STT → text agent → streaming TTS
  ├─ S2S adapter: OpenAI/Gemini realtime conversational front
  ├─ Turn policy: VAD + semantic EOU + interruption/backchannel
  └─ AudioSession: ephemeral、可挂起、可轮换
             │ committed turns / durable events
             ▼
VoiceLoop Control Plane
  ├─ ConversationState（heard transcript）
  ├─ TaskState（后台任务、审批、幂等、progress）
  ├─ Context Pack builder（versioned snapshot）
  └─ Tool executor（文本模型 + strict schema）
             │
             ▼
Memory / Project Foundation
  append-only SQLite ledger
  → current projection / FTS5 / optional graph+vector
  → .voiceloop/knowledge Markdown
  → doctor / audit / invalidate / forget / rebuild
```

关键依赖方向是单向的：语音 session 读取业务/记忆 snapshot，但业务任务和记忆不依赖音频连接存活。两种语音引擎共享同一个 `ConversationState` 契约，不能各维护一份“真相”。

## 5.2 明确选择

| 决策点 | 建议选择 | 为什么 | 上线前必须证明 |
|---|---|---|---|
| Realtime framework | **LiveKit Agents 暂定 P0**；Pipecat 1 周 bake-off | [LiveKit pipeline types](https://docs.livekit.io/agents/models/pipelines/)明确支持级联、Realtime、half-cascade，并把级联列为多数 production agent 默认；已有 heard-history truncation、async tools、WebRTC | self-host/插件路径、许可证、playout watermark、挂起重建、中英误打断、资源占用 |
| 默认架构 | **级联** | 工具成熟、可审计、可独立替换；2026 最新官方框架结论也一致 | 自有场景 P50/P90、tool exact、MER、成本 trace |
| S2S | `gpt-realtime-2.1-mini` 主候选；Gemini 3.1 Flash Live Preview 成本/多语对照 | OpenAI 60 分钟生态与工具链更易接；Gemini 标价低、97 语言但 15 分钟/Preview/上下文复计费 | noisy τ-Voice-style 工具集、打断、上下文重建、真实 usage；失败自动转级联 |
| S2S 高质量档 | `gpt-realtime-2.1` | 更强 reasoning/tool，官方改进中断/噪声 | 相对 mini 的任务成功提升是否值 3.2× input/3.2× output 音频价 |
| 云 STT | `gpt-realtime-whisper` 作为第一个可测基线，不直接冻结 | 官方是低延迟 streaming、`$0.017/min`；避免把 Deepgram 的非中文 `multi` 误当中英模型 | CS-Dialogue + VoiceLoop glossary 上 MER/identifier；并测试另一明确支持 zh-en 的服务 |
| Deepgram | 单语/非中英实验或未来复测 | Flux 有内建 turn、Nova-3 新增中文；但当前 `multi` 十语列表无中文 | 官方列表加入中文，或自测证明显式配置下真实中英 code-switch 可接受 |
| 云 TTS | ElevenLabs Flash/Multilingual 与 Cartesia Sonic 3.5 bake-off，不在调研期硬选 | 都有实时路径和中文候选；价格/TTFT/word timing/音色稳定需同口径 | 中英同句首 PCM、identifier 发音、打断 word timestamp、价格、数据政策 |
| 本地 STT | MLX Qwen3-ASR + MLX Whisper 两个候选 | Apple GPU 原生；公开吞吐有希望 | M1 8 GB 到 M4、冷/热、并发 IDE、流式 EOU→final；不采信整段 RTF |
| 本地 TTS | Kokoro via MLX-Audio；piper-plus 回退 | Kokoro M4 自测速度/质量候选强；piper-plus 轻量且维护中 | 冷启动、首 PCM、中英 voice continuity、许可/模型权重 |
| VAD/EOU | Silero v6 + LiveKit v1/v1-mini；Pipecat Smart Turn 同集对照 | 小 VAD 负责 start，语义 detector 负责 finish；避免固定 silence | zh-en/backchannel/AEC 数据集 false cutoff、latency、权重商用许可 |
| AEC | 浏览器 WebRTC baseline + device QA；原生 VoiceProcessingIO / PTT / 耳机降级 | 浏览器约束不是效果保证 | 浏览器/设备/双讲矩阵的 ERLE、near-end loss、false interrupt |
| Durable memory | 自建 SQLite event ledger + Markdown | 小、可审计、可重放、与 Git 权威相容 | forget、replay、concurrency、crash recovery、doctor |
| Memory framework | Hindsight shadow PoC，不拥有 L1 truth | 2026 开源方案中 invalid/restore/provenance/consolidation 最完整 | PostgreSQL 运维、determinism、召回增益、数据边界；和自建 ledger 对账 |
| Structure index | Codebase-Memory 第一候选；GitNexus 只作对照 | 前者 MIT/SQLite/incremental；后者功能强但 noncommercial | 自有多语言 repo、dynamic code、incremental equivalence、供应链审计 |
| Retrieval | FTS5 + `rg` + optional graph；sqlite-vec P1 | exact/code query 稳、可解释；向量不做新鲜度 | stale leakage=0、pack stability、task success/latency/token budget |

## 5.3 四个 go/no-go 决策门

### Gate A：Realtime framework

同一 app、同一 provider、同一 200 条音频，在 LiveKit/Pipecat 上测：

- 首响 P50/P90/P99；
- barge-in→扬声器静音与 `heard_text_end` 正确率；
- false interruption/backchannel resume；
- reconnect + Context Pack 后首个 tool call 是否重复；
- self-host CPU/RSS、trace 完整性、插件改造量；
- 许可证与 Cloud-only 依赖。

若 LiveKit v1-mini 许可不可接受，不能偷偷回落到 cloud；明确选择 Pipecat Smart Turn/Silero 或训练自有 EOU。

### Gate B：级联/S2S turn router

S2S 只有同时达到以下条件才对该类 turn 默认开启：

- 语音自然度/打断用户评分显著高于级联；
- 工具任务只由委派文本 agent 执行，端到端成功率不低于级联既定阈值；
- 真实每完成任务成本在预算内，而不是每音频分钟标价；
- session rotation/resume 不丢 task、heard history 或审批。

否则 S2S 保持 opt-in“增强模式”。

### Gate C：本地语音

至少在 M1 8 GB 的最低支持机型满足 P90 首响、内存和能耗，且中英 identifier 达标，才能称“本地默认”；若只在 M4 Pro 达标，应标“高配本地模式”，云端仍默认。

### Gate D：记忆自动写入

在 MemOps-style update/forget 轨迹与恶意记忆集上同时满足：invalid/forgotten leakage 0、provenance 达标、stale-hit 接近 0、并发不丢 update，才允许无确认自动写 L1/L0。未过门槛时只写 L3/L2 candidate 和可 review diff。

---

## 6. 工程风险登记表

| 风险 | 严重度 | 早期信号/验证 | 缓解 |
|---|---|---|---|
| 回声触发假打断，agent 反复自我中止 | P0/高 | false interruption/min、AEC warm-up 前激增 | WebRTC 同路径 render reference；warm-up 阈值；duck→确认人声→hard cancel；PTT/耳机 |
| 打断后把未播放回答写进历史 | P0/高 | 重建后 agent 认为用户听过某结论 | playout watermark；generated/heard/unheard 分表；框架 spike 必测 |
| S2S 工具参数看似可用但组合任务失败 | P0/高 | schema validation/retry/权限失败；τ-Voice 类任务低成功 | S2S 只做前台；文本 agent strict schema；高风险工具审批与幂等 |
| 挂起/轮换重复执行工具 | P0/高 | reconnect 后相同 side effect 两次 | durable task id + idempotency key + expected version；重建先同步 task state |
| 音频上下文复计费导致账单非线性 | P0/中高 | 每 turn input tokens 上升、idle 仍计费 | usage event 逐 turn 采集；context compression；早挂起；按完成任务告警 |
| 级联 ASR 错认中文夹英文 symbol | P0/高 | 普通 WER 好但 identifier exact 差 | N-best + repo symbol dictionary；hotwords；UI 显示确认；专用 MER 集 |
| 云模型/Preview/价格快速变化 | P1/高 | alias 行为漂移、rate limit/price 改 | adapter + snapshot pin；每月 price/capability smoke；双 provider；不硬编码首页数据 |
| 本地模型冷启动破坏首响 | P1/高 | warm benchmark 好、首次 2s+ | 麦克风意图时预热；小模型常驻；展示 warming；云端回退 |
| 浏览器 token 或工具权限泄露 | P0/中 | client bundle/日志出现长期 key；browser 直调敏感 tool | ephemeral credential；所有写工具在 server；最小 capability、短 TTL |
| raw audio/transcript 隐私超范围 | P0/中 | 默认日志/备份含录音 | raw audio 默认短 TTL/不落 L1；redaction；provider retention 审查；forget job |
| stale L1 被高相似度召回 | P0/高 | 答案引用旧 symbol/旧 branch | status/freshness hard filter 在 rank 前；source hash；live `rg` 验证 |
| LLM consolidation 改写或合并错事实 | P0/高 | 原证据消失、两个 scope 混合 | append-only source events；derived_from；review diff；高影响需确认 |
| decay 被误当忘记/失效 | P0/中 | 过时事实因最近使用继续靠前 | validity 与 ranking 分离；规则失效；decay 只作用 active candidates |
| “忘记”只在查询层隐藏，磁盘/缓存仍有 | P0/中 | ID 直取或备份仍恢复内容 | hard purge 全链路；FTS secure delete/DB rebuild；vector/cache/provider/backups policy；无内容 tombstone |
| 仓库/用户 scope 串线 | P0/中 | 同名 symbol 或偏好跨项目出现 | composite scope key、ACL hard filter、跨 scope 默认拒绝、隔离测试 |
| Memory prompt injection/poisoning | P0/高 | README/网页内容被提升为系统指令 | source authority；数据与指令通道隔离；自动事实不获 tool permission；签名/provenance |
| FTS/vector/graph generation 不一致 | P0/中 | 同一 query 得到互相矛盾版本 | generation snapshot + 原子 active pointer；doctor 全量对账；旧 generation 保留回滚 |
| Git rename/rebase/merge 导致漏刷新 | P0/高 | base 不可达、旧 path 仍 active | ancestry/tree 检查；`-z`；alias 候选；异常 full rebuild；synthetic commit suite |
| 静态 graph 对动态调用过度自信 | P1/高 | DI/反射/宏路径缺失 | edge resolution_kind/confidence；runtime/test 证据更高；`rg`/执行验证 |
| watcher 丢事件或并发覆盖 | P0/中 | source count/hash 与 DB 不符 | watcher 只触发；content/Git deterministic delta；CAS/事务；周期全量 checksum |
| 第三方许可阻断商业化 | P0/中 | v1-mini weights、GitNexus 非商业 | 依赖清单逐项 legal review；保留替代；不把实验 artifact 进入发行版 |
| 奠基太慢阻塞首用 | P1/高 | 新用户长时间无反馈或中断 | deterministic quick inventory + degraded mode；阶段进度；可恢复 generation |
| 自动生成知识看似完整但证据覆盖低 | P0/高 | Markdown 很长、source refs/parse coverage 低 | completeness manifest；unresolved 清单；全量 evidence validation；回答回源 |

### 6.1 首发阻断项

下列任一未完成，不应把语音写操作或自动记忆治理标为 production-ready：

1. heard/unheard playout 账本与 reconnect 重放测试；
2. 中英 code-switch + AEC + barge-in 真实设备集；
3. tool idempotency/approval 与 S2S→text delegation；
4. memory invalidate/forget 全链路零泄漏；
5. Git delta 异常 full rebuild 与 index generation 原子切换；
6. 第三方模型权重、框架与代码索引器商用许可审查；
7. 按完成任务、按真实 usage 的成本观测。

---

## 7. 原方案漏掉或需要升级的 2026 实践

### 7.1 Half-cascade 值得成为第三种内部实现，而不是第三种产品模式

[LiveKit 2026 pipeline 文档](https://docs.livekit.io/agents/models/pipelines/)定义了 realtime speech understanding + 独立 TTS 的 half-cascade：保留语气/韵律理解，又让输出严格按文本、可换音色、可得 word timing。它可用于“用户情绪/韵律重要，但 agent 必须精确念路径/命令”的场景。产品层仍展示“默认/增强”两档，内部 router 可选择 half-cascade，避免 UI 复杂。

### 7.2 Full-duplex 前台 + 后台 reasoning agent 已从推断变成产品方向

GPT-Live 的官方设计明确在持续对话同时委派 GPT-5.5 后台，这验证 VoiceLoop 的“语音会话与任务生命周期解耦”。应建立 durable progress event：后台任务输出 `started/progress/needs_approval/completed/failed`；语音层按用户是否在听决定何时播报，不把长 tool promise 挂在 realtime response 上。LiveKit 的 [async tools](https://docs.livekit.io/agents/logic/tools/async/)也直接针对长工具阻塞、进度、取消和重复调用。

### 7.3 “用户实际听到什么”是新的 canonical conversation state

文字聊天默认“生成=送达”，语音不成立。TTS PCM 可能还在 buffer、被系统 mute、被抢话清除或设备断开。原方案有 barge-in，但还应把 playout watermark 提升为数据模型一等公民；否则会话重建和记忆抽取都会系统性污染。

### 7.4 精确信息要“显示 + 说”，不要只靠声音

路径、commit、命令、金额、验证码式字母数字在纯语音里确认成本高。UI 应把 exact identifiers、待审批 tool args 和来源卡片显示出来；声音只概述并问确认。OpenAI 2026 对 Realtime 仍专门强调 alphanumeric 改进，反过来也说明该问题尚未消失。

### 7.5 记忆 benchmark 已从“能否回忆”转向“能否正确操作状态”

MemOps、LongMemEval-V2、MemoryAgentBench 都把 update/forget/动态事实/长轨迹拉到中心。VoiceLoop 应把 memory operations 作为有 oracle 的状态机测试，并检查内部状态与证据，而不是只让 judge 看最后一句回答是否像对。

### 7.6 新鲜度、权限与 prompt injection 必须进入检索前置条件

RAG 排名无法修复过期/越权/恶意内容。所有 memory/repo/web 内容默认是 data，只有固定 policy channel 能产生指令；tool result 也不能因为“来自工具”自动获得更高权限。Context Pack builder 应像数据库 query planner：先选 world/scope/snapshot，再检索。

### 7.7 Provider 文档本身会漂移，建立 capability registry

本次核实就发现两个例子：Deepgram 在 2026-03 新增中文单语，但 `multi` 语言表仍不含中文；GitNexus 早期索引文档写 incremental 在 roadmap，而 v1.6.5 已上线。VoiceLoop 应机器可读维护：

```yaml
provider/model:
  version_or_snapshot: ...
  checked_at: ...
  languages: ...
  code_switch_pairs_verified: ...
  session_limit: ...
  structured_outputs: ...
  pricing_snapshot: ...
  license: ...
  eval_run: ...
```

每次发布跑 smoke，并把“官方声称”与“VoiceLoop 已验证”分字段。

---

## 8. 建议实施顺序与验证产物

### Phase 0：先建测量与状态契约（1–2 周）

- 定义 `AudioSession/ConversationState/TaskState/MemoryState` 和 heard/unheard schema；
- 建 200 条中英语音 + 设备/AEC + tool golden set；
- 统一 span trace 与 usage ledger；
- 实现只读 Context Pack builder（FTS5 + `rg`），不自动写永久记忆；
- 输出：基线报告、cost calculator、provider capability registry。

### Phase 1：可靠级联 + 可挂起（2–4 周）

- LiveKit Agents vs Pipecat bake-off 后只保留一套；
- 流式 ASR/text LLM/TTS、playout-aware barge-in、45 秒实验阈值；
- durable task/event 与 Context Pack rehydrate；
- 浏览器 AEC + PTT/耳机 fallback；
- 输出：端到端 P50/P90/P99、错误分类、60/15 分钟轮换测试、真实 cost trace。

### Phase 2：记忆 lifecycle + 项目奠基（3–5 周）

- SQLite append-only ledger/current projection、invalidate/restore/forget、doctor；
- `.voiceloop/knowledge` topic docs + manifest；
- Codebase-Memory/GitNexus 对照，选择结构 graph；
- Git delta + reverse dependency + generation swap；
- 输出：MemOps-style state tests、synthetic Git suite、forget purge proof、rebuild proof。

### Phase 3：S2S/half-cascade 与本地模式（2–4 周）

- OpenAI mini/Gemini 同集比较，文本 agent delegation；
- half-cascade exact output；
- MLX STT/Kokoro/Piper 在 M1–M4；
- Hindsight shadow PoC 与 sqlite-vec ablation；
- 只有过 Gate B/C/D 的能力才从 experimental 升级。

时间是工程量级估算，不是承诺；是否并行取决于团队。顺序的关键是先有状态/测量，再换模型，否则每次 demo 都无法复现和解释。

---

## 9. 来源链接（按主题索引）

> 以下链接均在 2026-07-22 本次调研中核对；API、价格、模型、许可和 Preview 状态会变化，实施/采购前应重新检查。正文已在相关事实附近直接引用，本节便于集中复核。

### 9.1 Realtime / S2S / session / pricing

- OpenAI：[GPT-Live](https://openai.com/index/introducing-gpt-live/)、[2026 voice models update](https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/)、[GPT-Realtime-2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)、[GPT-Realtime-2.1-mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini)、[Realtime Whisper](https://developers.openai.com/api/docs/models/gpt-realtime-whisper)、[Realtime API reference](https://platform.openai.com/docs/api-reference/realtime)、[Agents SDK voice guide](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)、[Realtime launch/tool benchmark](https://openai.com/index/introducing-gpt-realtime/)。
- Google：[Live capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)、[session management](https://ai.google.dev/gemini-api/docs/live-api/session-management)、[best practices/billing behavior](https://ai.google.dev/gemini-api/docs/live-api/best-practices)、[Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)。
- 级联服务价格：[Deepgram pricing](https://deepgram.com/pricing)、[Deepgram model/language matrix](https://developers.deepgram.com/docs/models-languages-overview/)、[Deepgram code-switching](https://developers.deepgram.com/docs/multilingual-code-switching)、[ElevenLabs API pricing](https://elevenlabs.io/pricing/api)。
- 框架：[LiveKit pipeline types](https://docs.livekit.io/agents/models/pipelines/)、[realtime limitations](https://docs.livekit.io/agents/models/realtime/)、[turns/interruption](https://docs.livekit.io/agents/logic/turns/)、[async tools](https://docs.livekit.io/agents/logic/tools/async/)、[Pipecat speech input](https://docs.pipecat.ai/pipecat/learn/speech-input)、[Pipecat turn strategies](https://docs.pipecat.ai/api-reference/server/utilities/turn-management/user-turn-strategies)。

### 9.2 AEC / turn / 本地语音

- 标准/实现：[MDN echoCancellation](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation)、[W3C Media Capture](https://w3c.github.io/mediacapture-main/)、[WebRTC AEC3 source](https://chromium.googlesource.com/external/webrtc/+/master/modules/audio_processing/aec3/echo_canceller3.h)、[LiveKit noise/echo cancellation](https://docs.livekit.io/cloud/noise-cancellation/)。
- Turn：[Silero VAD](https://github.com/snakers4/silero-vad)、[Silero metrics](https://github.com/snakers4/silero-vad/wiki/Quality-Metrics)、[LiveKit Turn Detector v1](https://livekit.com/blog/solving-end-of-turn-detection)、[LiveKit turn detector docs](https://docs.livekit.io/agents/logic/turns/turn-detector/)、[TEN Turn Detection](https://github.com/TEN-framework/ten-turn-detection)、[JAL-Turn](https://arxiv.org/abs/2603.26515)。
- 本地 STT/TTS：[faster-whisper macOS discussion](https://github.com/SYSTRAN/faster-whisper/discussions/1227)、[MLX Whisper](https://github.com/ml-explore/mlx-examples/blob/main/whisper/README.md)、[M4 MLX Whisper test](https://dev.classmethod.jp/articles/20260506-macscribe-mlx-whisper/)、[WhisperLiveKit](https://github.com/QuentinFuxa/WhisperLiveKit)、[MLX Qwen3-ASR](https://github.com/moona3k/mlx-qwen3-asr)、[MLX-Audio](https://github.com/Blaizzy/mlx-audio)、[FluidAudio benchmark](https://github.com/FluidInference/FluidAudio/blob/main/Documentation/Benchmarks.md)、[piper-plus](https://github.com/ayutaz/piper-plus)。
- 中英数据：[CS-Dialogue](https://arxiv.org/abs/2502.18913)、[CS3-Bench](https://huggingface.co/datasets/VocalNet/CS3-Bench)、[TEA-ASR-1.1-mini](https://huggingface.co/JacobLinCool/TEA-ASR-1.1-mini)。
- 独立评测/论文：[τ-Voice](https://arxiv.org/abs/2603.13686)、[Audio2Tool](https://arxiv.org/abs/2604.22821)、[Full-Duplex-Bench v3](https://arxiv.org/abs/2604.04847)、[Real-Time Voice Agents tutorial](https://arxiv.org/abs/2603.05413)。

### 9.3 Memory lifecycle

- Letta：[Letta Code](https://github.com/letta-ai/letta-code)、[lettabot MemFS config](https://github.com/letta-ai/lettabot/blob/main/docs/configuration.md)、[context hierarchy](https://docs.letta.com/guides/core-concepts/memory/context-hierarchy)。
- Mem0：[add/expiration](https://docs.mem0.ai/core-concepts/memory-operations/add)、[decay](https://docs.mem0.ai/platform/features/memory-decay)、[update](https://docs.mem0.ai/core-concepts/memory-operations/update)、[delete](https://docs.mem0.ai/core-concepts/memory-operations/delete)、[history](https://docs.mem0.ai/api-reference/memory/history-memory)。
- Zep/Graphiti：[Graphiti temporal graph](https://www.getzep.com/platform/graphiti/)、[Zep concepts/Context Block](https://help.getzep.com/concepts)。
- Hindsight：[GitHub](https://github.com/vectorize-io/hindsight)、[retain](https://hindsight.vectorize.io/developer/retain)、[memory state/invalidate/restore](https://hindsight.vectorize.io/developer/api/memories)、[best practices](https://hindsight.vectorize.io/best-practices)、[ACL 2026 paper](https://aclanthology.org/2026.acl-demo.27/)。
- 其他实现/研究：[LangMem](https://langchain-ai.github.io/langmem/)、[MemOS](https://github.com/MemTensor/MemOS)、[Projectmem](https://arxiv.org/abs/2606.12329)、[Infini Memory](https://arxiv.org/abs/2606.10677)、[WorldDB](https://arxiv.org/abs/2604.18478)、[PlugMem](https://www.microsoft.com/en-us/research/blog/from-raw-interaction-to-reusable-knowledge-rethinking-memory-for-ai-agents/)。
- 治理评测：[MemOps](https://arxiv.org/abs/2607.12893)、[Don't Ask LLMs to Track Freshness](https://arxiv.org/abs/2606.01435)、[LongMemEval-V2](https://github.com/xiaowu0162/LongMemEval-V2)、[MemoryAgentBench](https://openreview.net/forum?id=DT7JyQC3MR)。

### 9.4 代码奠基 / Git / retrieval

- 项目理解：[Serena onboarding/memories](https://oraios.github.io/serena/02-usage/045_memories.html)、[Codebase-Memory](https://github.com/DeusData/codebase-memory-mcp)、[Codebase-Memory paper](https://arxiv.org/abs/2603.27277)、[GitNexus](https://github.com/abhigyanpatwari/GitNexus)、[GitNexus v1.6.5 incremental release](https://github.com/abhigyanpatwari/GitNexus/releases/tag/v1.6.5)、[GitNexus license](https://github.com/abhigyanpatwari/GitNexus/blob/main/LICENSE)、[RepoDoc](https://arxiv.org/abs/2604.26523)、[RepoDoc code](https://github.com/SYSUSELab/RepoDoc)、[Aider repo-map](https://aider.chat/docs/repomap.html)。
- 代码检索研究：[Code Isn't Memory](https://arxiv.org/abs/2606.22417)、[Is Grep All You Need?](https://arxiv.org/abs/2605.15184)。
- Git/parser：[git diff](https://git-scm.com/docs/git-diff.html)、[git rev-list](https://git-scm.com/docs/git-rev-list)、[Tree-sitter incremental parsing](https://tree-sitter.github.io/tree-sitter/using-parsers/3-advanced-parsing.html)。
- 本地检索：[SQLite FTS5](https://www.sqlite.org/fts5.html)、[sqlite-vec](https://github.com/asg017/sqlite-vec)、[sqlite-vec v0.1.9](https://github.com/asg017/sqlite-vec/releases/tag/v0.1.9)。

---

## 10. 最终回答（对应七个问题）

1. **级联 vs S2S：** 默认级联仍正确，但理由从“固定便宜 10×”变为“工具可靠、可审计、可替换”；S2S/half-cascade 做自然前台，复杂行动委派文本 agent。
2. **AEC / turn / 本地：** 浏览器 AEC 够 P0 baseline、不够质量承诺；Silero + 语义 EOU 是正确分层，LiveKit v1 最值得测；Apple Silicon 本地可行但公开数据多非流式 TTFT，必须自测。
3. **挂起/重建：** provider resume 只解决短连接；业务态必须 durable，保存 heard transcript/task/memory snapshot，以小型 versioned Context Pack 重建，并按真实 usage 控成本。
4. **生命周期：** 自建 append-only event/current projection；Hindsight 最值得 PoC，Letta/Graphiti/LangMem 分别提供文件可见、双时间、后台 consolidation 模式；decay 不等于失效或遗忘。
5. **代码奠基：** Serena UX + Codebase-Memory 结构索引 + RepoDoc 影响传播最匹配；GitNexus 已有增量但商用许可阻断；Git diff 只能给 seed，必须处理 ancestry/rename/untracked/依赖闭包/原子 generation。
6. **检索：** FTS5 + live `rg` + source/freshness hard filter 是 P0，结构图补多文件，向量只补概念；RRF、小证据包和按需再检索比一次塞大 context 稳。
7. **补充：** half-cascade、full-duplex 前台委派后台 agent、playout-aware history、操作型 memory benchmark、capability registry、记忆 prompt injection/真删除，是原方案最需要补上的 2026 实践。
