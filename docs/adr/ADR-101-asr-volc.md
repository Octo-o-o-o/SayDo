# ADR-101(工程)· ASR 定档:火山豆包 bigmodel 流式(sauc)

- 状态:已定(2026-07-24;计划 1.0,07 D4"待 spike"结项)
- 依据:60 条中英混说合成语料跑分(`e2e/spikes/asr-1.0/RESULT.md`)

## 决策

P0 ASR 定档**火山豆包 bigmodel 流式**,单家起步:

1. **运行时 = 流式 sauc**:`wss://openspeech.bytedance.com/api/v3/sauc/bigmodel`,
   resource `volc.bigasr.sauc.duration`,v3 二进制流式(与 TTS D5 同族协议);
   录音文件 auc(`volc.bigasr.auc`)留批量跑分用。
2. **鉴权 = 经典三元组**:`X-Api-App-Key`(APP ID)+ `X-Api-Access-Key`(Access Token),
   env 承载 `VOLC_APP_ID`/`VOLC_ACCESS_TOKEN`(owner 的 ASR 资源开在此账号;TTS 继续走
   `DOUBAO_TTS_API_KEY` 单 key,两账号并存)。授权体检脚本 `e2e/spikes/asr-1.0/check-asr-auth.sh`。
3. **热词偏置 = `request.corpus.context` 内联**(`{"hotwords":[{"word":...}]}`):
   实证 +10 点术语召回(55.4% -> 65.3%);消费源 = 2.4 `HotwordStore.biasTerms()`
   (M0 热词 ∪ 奠基 seedTerms),接线在 pipeline sauc 客户端。
4. **音频形态**:wav/pcm 16k mono(mp3 整段直发会尾截断——服务器解码缓冲,已实测);
   PTT 整段识别 P0,实时分片流式 P1(VAD 免手)。

## 跑分基线(合成语料,裸测)

exact 31.7% / 术语召回 65.3%(热词档)。剩余 miss 主因 = TTS 合成音的英文缩写发音失真
(合成语料固有局限);真人 dogfood 的真实误听进热词 + golden 回归集,作为换 provider 门禁。

## 降级/后续

- 第二家对比(gpt-4o-transcribe)待 owner 补 OpenAI key(非阻塞);
- 本地兜底 = MLX Whisper(07 D4;P0 不引);
- 若 dogfood 中文/术语召回不达标:先热词扩表,再评估双发对比。
