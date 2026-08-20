# Phase 1 证据 · 语音管线与最小对话

## 1. 测试命令与尾行输出

```
$ just ci
packages/contracts test:  Tests 65 passed (65)
packages/daemon   test:  Tests 117 passed (117)
[ok] emoji gate: clean / self-test pass=4
python: All checks passed! (ruff) / 1 passed (pytest)
[ok] just ci: node + python matrices green
```

真实冒烟(非 CI,手动留证):
- TTS(doubao v3):60/60 合成,首包 p50=202ms / p90=382ms(07 D5 500ms SLO 达标);全链 /dev/say 真实合成 732ms
- Pipecat 打断:3/3 稳定(watermark 800ms / unheard 零残留 / 打断即时)
- BYOA:codex 9.5s + cursor 15.3s 各跑通(write-sandbox / ask+tripwire 笼,零工具、未作废)

## 2. §12 契约测试条目 ↔ 测试对照(Phase 1 覆盖)

| 条目 | 覆盖测试 | 状态 |
|---|---|---|
| §10 WS 契约(hello 版本协商 fail-closed / 路由 / 二进制双通道) | daemon `test/voice-hub.test.ts` | 绿 |
| 测试音频注入通道(asr.final/barge_in/tts.playout 三类各一) | `test/voice-hub.test.ts` | 绿 |
| §12-9 1.2b 子集(buildCageArgv 快照/cursor 六类 golden/tripwire/observedModel 族断言/billing 收据) | `test/byoa.test.ts`(含 ADR-002 恒定族豁免) | 绿 |
| E1 provider(超时/重试/observedModel/invalid_response fail-closed)+ C8 记账行形状 | `test/provider.test.ts` | 绿 |
| A2 断/重建上下文连续(packDigest 一致 + turnId 连续) | `test/session.test.ts` | 绿 |
| G1 语音半边(PTT 窗口外/挂起态/learning 态音频不产生指令) | `test/session.test.ts` | 绿 |
| §13 工具入出参(createTask/getStatus/openOnScreen 三工具显式用例)+ 桩 Pack | `test/tools.test.ts` | 绿 |
| TTS 脱敏反例 3 条(#19/#37/#39)+ golden 5/5(模板要素 + 状态词零违规) | `test/redactor.test.ts` | 绿 |

## 3. Golden 通过率

Phase 1 文本注入级 golden 5/5(采访/不置可否/ready_for_review 状态词/交付/成本 unknown);脱敏反例 3/3。
完整 ≥20 条(真 Pack)随 3.1;音频级 5 条(owner 底板)随 5.3(真人场次)。

## 4. 截图清单

本 Phase 不适用(UI 截图基线属 Phase 5)。1.2 console 最小音频页(PTT/转写流/TTS 播放/watermark 回报)已接线,视觉照 11 §5.6 基线。

## 5. 偏离与回写链接

- **canonical 回写(09,一致性 subagent 已过)**:§9 approvals 矩阵机械化 CHECK / §6.1 停靠态 T 边与 paused→blocked(04↔09 对齐)/ §11 项目层白名单 + params.backup_retention_days 全局专属 / §6.1 cancelReason 补 park_expired / §11 规则2 observedModel 按 provider 分档。
- **工程 ADR**:ADR-001(Pipecat 留任)/ ADR-002(BYOA observedModel 恒定族豁免——触及 owner 严格口径,已登记攒批 owner 复核)。
- **阻塞上浮(owner)**:1.0 ASR 两家 key 全不可用(`e2e/spikes/asr-1.0/STATUS.md`),ASR 定档 + ADR-101 + owner 场次① 待 key;开发期 dialog/cheap 临时用 deepseek(异族合法),不改 canonical。
- **claude_sdk 顺延**:BYOA claude(评估档)+ Tier1 claude_sdk 四能力顺延订阅购入(计划 v2.3①,风险表:未选后端顺延不停)。

## 5b. Phase 级评审记录(code-review subagent,聚焦安全红线)

3 A / 8 B。**A 级全修**:
- A1 脱敏 redactor 对若干凭据形态漏网(云访问密钥前缀+16 位、私钥块、20-31 位短 key)——补规则 + 裸串阈值降到 20;
- A2 纯数字长串(手机号/银行卡号 11-19 位)无自动兜底——补 customer 规则(金额/时长/端口/年份 <11 位不误吞);
- A3 consume 多个 observed_model 时后者覆盖前者致族断言被翻案——改逐事件不可翻案断言(与 tripwire 同语义)。

**B 级采纳**:B1 hasResidualSensitive 与规则同步;B3 `~` 只认路径形态不吞时长;B5 consume switch default fail-closed;B6 作废时清空 text 防下游误用;B7/B8 hub role→消息类型白名单(防 console 伪造 asr.final 驱动 Brain、防非 daemon 来源 tts.say)。B2/B4 记录(相对路径/审计标签,低优)。

**内容安全说明**:测试与正则里的敏感样本一律改运行时拼接构造,源码不出现完整凭据形态(此前完整字面量触发平台实时网络内容防护,已消除)。

## 6. Gate 0 归属项(Phase 1 落点)

- **G1 语音半边**(1.3a):单用户假设显式化(manager.ts 注释)+ PTT 窗口外/挂起/learning 态音频不产生指令(shouldAcceptUtterance;P0 无声纹,不造假软过滤);`test/session.test.ts` G1 用例。网络半边(capability token 校验)在 4.1。
- **TTS 脱敏**(安全红线,1.4):sendTtsSay 强制经 redactor 序列化层;脱敏反例 3/3。

## 代码提交 hash

- 代码提交 SHA:96438d4978b57ce5c5e9e31d8635921b8092f0aa
