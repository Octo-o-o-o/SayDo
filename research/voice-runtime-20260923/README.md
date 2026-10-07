# 语音运行时调研:本轮实验记录

基线:d0b7edce648fe7b54713bc19fa8af143f9d81628。2026-09-23。

## 结果

- TTS 取消交错探针:执行 2 场景,对照满足、交错反例不满足,exit=1。证明生产 HubClient 会下发旧句;未测试真实声音。
- Python 定向回归:4 文件,62 collected/executed/passed,0 failed/skipped,无重试,exit=0。不能掩盖新增反例。
- 既有 Pipecat 1.6.0 spike:执行 1 场景,3 断言 true,exit=0。打断前/后模拟播放水位均 800ms,残余 0ms;不是麦克风或真实播放器证据。
- spike 的 B 断言只比较总水位,未逐句证明第二句零帧;不可扩大成完整 heard-history/生产集成验收。
- just ci、Playwright、真实 provider、真人/设备、SLO、独立 review:not_run。
- 无产品代码修改,无依赖安装,无供应商调用,未 commit/push/merge/deploy。

## 可复跑命令

在本候选根目录执行,使用已安装的本地 Python 环境:

```sh
PYTHONPATH=pipeline/src ~/WorkSpace/SayDo/pipeline/.venv/bin/python research/voice-runtime-20260923/probe_tts_interruption.py
PYTHONPATH=pipeline/src ~/WorkSpace/SayDo/pipeline/.venv/bin/python -m pytest pipeline/tests/test_voice_measure_eou_tts.py pipeline/tests/test_hf_owned_asr.py pipeline/tests/test_hf_record_order.py pipeline/tests/test_ptt_mode_terminal.py -q
~/WorkSpace/SayDo/pipeline/.venv/bin/python pipeline/spikes/pipecat_interrupt_spike.py
```

第一条在未修复基线上预期 exit=1,不是成功标记。每次运行紧跟读取退出码。

## 原始日志

原始日志保存在 `~/.codex/tasks/saydo-voice-runtime-research-20260923/`,不入 Git。仓内 JSON 为从日志提取的结构化结果,不替代原始日志。

| 日志 | 字节 | SHA-256 | exit |
|---|---:|---|---:|
| probe-result.log | 980 | `9d0ed653268d00545ca039bedfac1de6867fb323ba35e8115c6fac588f34e891` | 1 |
| baseline-tests.log | 99 | `582530ff0de2514b8de5cc863fda1503b16dbcef0eab3a616a87c51615efd653` | 0 |
| pipecat-spike.log | 5439 | `4ee8675663ec65cccfb20eb660489b59fb7aca32cf453e31a2e67f29f569bae1` | 0 |

## 附件完整性

- `02_SayDo_Voice_Runtime_Recommendation_2026-09-23.md`: 54615 bytes, SHA-256 `83415f3cda73e1a8ca653b1311d15256b511e34e81854aff83d5b1a36a9b8041`。
- `SayDo_Voice_Runtime_Integration_2026-09-23.md`: 51476 bytes, SHA-256 `f0a9b0a35d5177e2dc04c44c2fa08cc51a830f4e1ce55692edc42e21204f30e6`。

## 2026-09-27 审计候选复核

09-23 的 exit 1 和 JSON 原样保留。当前候选上原探针再次复现旧句下发(exit 1)后，修复 pipeline 输出失效令牌；同一探针修后 exit 0，仅新句下发。增加连续打断、跨会话、空音频重试、吞取消 provider/reset、latency 发送让出期间打断的交错测试，五个相关测试文件 79 passed。首轮 Ruff 报循环闭包绑定，修正后 exit 0。

这只是本轮离线生产代码/fixture 证据，不覆盖已发网络帧过滤、真实扬声器、provider、独立验收或部署。定向日志 `tts-cancel-regression-1.log` 位于 `~/.codex/tasks/saydo-fortnight-audit-20260927/`，179 字节、SHA-256 `9cfd8be9f5bd73e21d9bb535528c3a3c7c4cb3b6c80e191e6915ce8cbd0842f7`、exit 0；当前候选完整门禁尚未运行。
