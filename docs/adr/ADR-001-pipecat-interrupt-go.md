# ADR-001(工程)· D2 打断语义 spike:Pipecat 留任

- 状态:已定(2026-07-24,计划 1.1;判定为"不切",无后续切换 ADR)
- 依据:`docs/07-tech-stack-decisions.md` D2(显式反向裁决 + 同一判定实验:"打断即截断已听到的历史"做不到即切 LiveKit)

## 判定实验(pipeline/spikes/pipecat_interrupt_spike.py,3/3 稳定)

Pipecat 1.6.0,最小管线 MockTTS(每句 2s 确定性音频)-> WatermarkOutput(write 按实时 sleep 模拟播放):
两句入队,t=1s 注入 `InterruptionFrame`,断言:

| 断言 | 结果 |
|---|---|
| A watermark 可维护(输出侧逐帧累计已播毫秒) | 过:打断时刻 watermark=800ms(chunk 粒度 400ms 下与 1s 注入点吻合) |
| B unheard 不下发(打断后第一句剩余与第二句零帧写出) | 过:watermark_after == watermark_at_interrupt |
| C 打断即时(残余写出 <= 一个 chunk) | 过:残余 0ms |

机制依据(Pipecat 1.6 源码核对):
- `BaseOutputTransport.MediaSender.handle_interruptions` 取消 audio task 并清 buffer(未播帧丢弃);
- TTSService 有 PTS(presentation timestamp)机制,TTSTextFrame 按实际播出时刻下发——句级 heard/unheard 映射
  (09 §10 `tts.playout.watermarkMs` + `barge_in.truncatedSentenceId`)在 1.2 实现时由 WatermarkOutput 同款计数承载。

## 结论与后续

- **Pipecat 留任**(BSD-2、部署轻、打断语义验证成立);LiveKit Agents 切换条款关闭。
- 本地兜底链:macOS `say` 可用(18 个中文音色)——"回叫永远发得出声"的应急兜底成立;Kokoro MLX 按需再验。
- 注意事项:1.6 的 `PipelineTask/PipelineRunner` 标记 deprecated(2.0 将移除,替代 PipelineWorker/WorkerRunner)——
  1.2 实现直接用新 API,避免搭在弃用面上;`text_aggregation_mode` 词表 = sentence/token/word。
- TTS 首包延迟已在 1.0 spike 顺测:doubao v3 p50=202ms / p90=382ms(07 D5 500ms SLO 达标)。

## 后记(2026-07-25,readback 诚实注记)

实际 1.2 落地形态与本 ADR 的隐含预期有一处偏离,如实记录:**P0 管线未启用 Pipecat 运行时**——
ADR-101 定档 sauc 后,P0 语音输入 = **PTT 松手后整段识别**(无流式 partial),流式打断截断的
管线级需求消失;实现为自建轻量 WS 管线(pipeline/hub_client.py + daemon hub),打断语义
(watermark + unheard + barge_in 截断)由 hub 层承载并有注入级测试(voice-hub.test)。
Pipecat"留任"判定**保留有效但未消费**:其价值点(流式打断/VAD 管线)对应 P1 开放麦/实时
partial 场景,届时按本 ADR 判定实验直接接入;spike 代码在 pipeline/spikes/ 可复跑。
此偏离不触发 LiveKit 切换条款(切换条款针对"Pipecat 打断语义不成立",实测成立)。
