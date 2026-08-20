# 1.0 ASR 定档 spike · 结果(2026-07-24 晚)

阻塞解除:owner 提供开通了 ASR 资源的火山账号经典三元组(APP ID + Access Token,填 `~/.saydo/.env`
的 `VOLC_APP_ID`/`VOLC_ACCESS_TOKEN`);鉴权走 `X-Api-App-Key`/`X-Api-Access-Key` header(v3 大模型
接口,Secret Key 不需要)。授权体检:`bash check-asr-auth.sh`(流式 sauc + 录音 auc 双资源全通)。

## 定档:火山豆包 bigmodel 流式(sauc),P0 单家起步

- 端点 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel`,resource `volc.bigasr.sauc.duration`,
  v3 二进制流式(与 TTS 同族协议,方向相反);录音文件 auc(`volc.bigasr.auc`/`volc.seedasr.auc`)同账号可用(批量跑分用)。
- 第二家对比(gpt-4o-transcribe)待 OpenAI key,非阻塞——计划 1.0 允许"流式单家先定档起步";
  golden 集(本 spike 语料 + dogfood 真实误听)此后作为换 provider 门禁,单语 WER 不作数。

## 跑分(60 条中英混说合成语料;40 常速 + 20 提速 25%)

| 配置 | exact | 术语召回 | 平均耗时 | 错误 |
|---|---|---|---|---|
| 裸跑(无热词) | 15/60 = 25% | 56/101 = 55.4% | ~2.1s/条 | 1 条服务端偶发超时 |
| **+ 热词偏置(97 词,`request.corpus.context` 内联)** | **19/60 = 31.7%** | **66/101 = 65.3%** | ~2.2s/条 | 0(重试 1 次兜底) |

- **热词偏置实证 +10 点术语召回**——07 D4 选型理由("级联相对 S2S 最便宜见效最快的可控性优势")成立;
  2.4 HotwordStore.biasTerms 的消费链路(词表 -> `request.corpus.context`)同型可接。
- 评分口径:unicode 规范化(去标点/空白/大小写)后 exact;术语按归一化子串命中。
  教训:mp3 整段直发会尾截断(服务器解码缓冲),**必须 wav/pcm**;全半角标点须 unicode 类别归一化。

## 附:sauc 不回置信度(09 §10 confidence 可选化的实测依据)

最终帧完整 payload 实测(2026-07-24,log_id `202607241856286C04360ED8271C05D22C`):`result` 仅含
`text`/`utterances[](definite/start_time/end_time/words[])`/`additions.log_id`——**无 confidence 字段**
(utterances/words 级同样没有)。故 09 §10 `asr.partial/final` 的 confidence 改为可选,10 #7 低置信复述
在缺省配置下停用(误听兜底走 #8/#9 用户纠正)。

## 剩余 miss 定性(35%)

短英文缩写/命令为主(sh/curl/tail/chmod/SQL/zod/vite/jsonl...),每词多为 1 次——TTS 合成音念英文
缩写发音失真是主因(合成语料固有局限)。真人语音预期更好;真实误听在 dogfood 期积累进热词 + golden
回归集(计划 1.0:"完整 300-500 条推迟到 dogfood 用真实误听积累")。

## 复现

1. `node synth.mjs`(合成 60 条到 audio/;TTS 首包 p50=202ms 顺测,synth-report.json)
2. mp3 批量转 16k wav(afconvert)-> 跑分脚本(sauc 流式逐条,3 并发)
3. 明细:`results-volc-sauc.json`(裸跑)/ `results-volc-sauc-hotwords.json`(热词)

## ADR

`docs/adr/ADR-101-asr-volc.md`(定档 + 鉴权形态 + 热词接线约定)。
