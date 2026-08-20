你是一名语音 AI + agent 记忆方向的技术调研员。请对 VoiceLoop 的两块自建核心能力做**深度技术调研 + 可行性核实**,联网获取 2026 最新证据(附链接),给出选型与工程风险。

## 背景
VoiceLoop 只自建三块"语音前脑"能力,其中两块是本次调研重点:
- **① 实时双向语音对话**:做成可插拔双引擎——级联(流式 ASR + 文本 LLM + 流式 TTS,默认)/ Speech-to-Speech(增强)。要求:能打断(barge-in)、亚秒首响、外放需 AEC、中英混说、语音会话与后台任务生命周期解耦(会话可挂起省钱)。
- **③ 分层记忆 + 项目奠基**:L0 用户档案 / L1 项目知识底座(本地文件 .voiceloop/knowledge/)/ L2 累积产物库 / L3 会话工作记忆;区分"持久知识库"与"每次拼接的 Context Pack";全新项目先做"奠基"(深研代码库/领域→持久化)、后续 git diff 增量刷新;知识库需生命周期治理(遗忘/失效/审计)。

## 必读(可选)
- `~/WorkSpace/voice-coding/voice-coding-framework.Cursor2.md` §2.1(双引擎)、§4.19(记忆架构)
- `~/WorkSpace/voice-coding/open-source-stack.md`(已有选型初稿)、`competitive-scan-2026-07.md`

## 你的调研问题(逐条,联网附链接)
1. **级联 vs S2S 的 2026 现状**:延迟/成本/打断质量/中英混说/function-calling 可靠性,最新数据。VoiceLoop 默认级联的判断还成立吗?
2. **AEC / turn-detection**:浏览器 getUserMedia AEC 够用吗?开源 turn detector(TEN/LiveKit/Silero)在中英语境的实测表现?本地 STT/TTS(faster-whisper/MLX Whisper / Kokoro/Piper)在 Apple Silicon 的延迟?
3. **语音会话挂起/重建 + 上下文重建**:成本模型(音频 token vs 文本)、60 分钟上限、"挂起省钱后重建注入 Context Pack"的最佳实践,有没有成熟范式或坑?
4. **记忆生命周期治理**(方案已识别为头号缺口):2026 有哪些可直接用的做法/框架(失效标记/衰减/consolidation/审计)?Letta MemFS、Mem0、Zep 之外还有什么新东西?
5. **代码库奠基**:OpenWiki/DeepWiki/Aider repo-map 之外,2026 最新的"代码库理解并持久化+增量刷新"方案?git diff 增量刷新的工程坑?
6. **检索**:SQLite FTS5 vs 向量 vs agentic grep,针对"语音场景 Context Pack 要小而稳"的最佳组合?
7. **补充**:方案在这两块可能漏掉的最新产品/论文/工程实践。

## 输出要求
- 报告写入 `~/WorkSpace/voice-coding/codex-findings/03-voice-memory-tech.md`(结构化:语音层结论 / 记忆层结论 / 选型建议 / 工程风险 / 来源链接)。
- 区分事实与推断,联网结论附链接。
- stdout 回一句话:报告已写入 + 对"默认级联"和"记忆生命周期治理"两点的最关键结论。
