# 1.0 ASR 定档 spike · 状态(2026-07-24)

> **[已解锁 2026-07-24 晚]** owner 提供 ASR 账号三元组(VOLC_APP_ID/VOLC_ACCESS_TOKEN)后阻塞解除,
> 定档完成:**火山 sauc 流式,热词档术语召回 65.3%(+10 点实证)**——结论见 `RESULT.md` 与
> `docs/adr/ADR-101-asr-volc.md`。下方为历史阻塞记录(排查过程留档)。

## 已完成

- 种子语料 60 条(corpus.mjs:repo 术语混说 20 / 通用编码 15 / 数字 10 / CLI 与路径 10 / 纯中文 5)。
- TTS 合成 60/60(doubao seed-tts-2.0 v3 双向流式;40 常速 + 20 提速 25%),音频在 `audio/`。
- **TTS 首包延迟(D5 调参顺做):p50=202ms / p90=382ms / max=935ms —— 07 D5 的 500ms SLO(p50 口径)达标**;
  协议实现移植自 repo-demo-recorder(07 D5 指定来源),接入 1.2 时同款可用。见 synth-report.json。

## 阻塞:两家 ASR 候选 key 全不可用(Phase -1 A③ 阻塞档,已上浮 owner)

实测记录(2026-07-24):

| 通道 | 结果 | 证据 |
|---|---|---|
| 火山 flash ASR + VOLC_API_KEY | key 为空(.env 该行只有注释,Phase -1 检查被行内注释误报"已填") | `.env` 逐行盘点 len=0 |
| 火山 flash ASR + DOUBAO_TTS key | 鉴权通过但资源未授权:`45000030 requested resource not granted`(bigasr.auc_turbo / bigasr.auc / seedasr.auc 三个 resource id 皆同) | curl 实测 |
| OpenAI 直连(gpt-4o-transcribe / whisper-1) | OPENAI_API_KEY 为空 | `.env` 盘点 |
| OpenRouter 音频输入(gemini-2.5-flash/lite/pro) | `The request is prohibited due to a violation of provider Terms Of Service`(google/openai 系全拒;**deepseek 文本调用正常、账号有余额** => key 有效,是 OpenRouter 账号对 openai/google provider 的数据政策/设置问题) | curl 实测;/auth/key usage=0;/credits 45-16.2 |

## 解锁路径(任一家到位即可先跑单家,两家到位定档)

1. 火山控制台给现有 API Key(同 DOUBAO_TTS_API_KEY)开通"大模型录音文件识别"资源(volc.bigasr.auc_turbo)——X-Api-Key 鉴权已验证打通,只差资源授权;
2. OpenRouter Settings -> Privacy 允许 openai/google provider(顺带解锁 dialog 档缺省 gemini),或补 OPENAI_API_KEY。

## 缺省动作(已执行)

- 1.0 跑分与 ADR-101 定档暂停,标 [待 owner 补 key];种子语料与打分脚本就绪,key 到位即跑。
- dialog/cheap 档开发期临时用 `deepseek/deepseek-chat-v3-0324`(OpenRouter 可用;evaluator=GPT 异族合法),正式缺省等 owner 解锁后回归 config 所配 gemini;不改 canonical、不改 owner config。
