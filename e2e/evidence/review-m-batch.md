# 外部评审必做清单 M1-M11 对账(2026-07-25)

> 来源:`research/saydo-improvement-scan-2026-07.md`(4 subagent 深挖)+ owner 转交 prompt(转发即批准必做清单)。
> 进度自查:接收时实施已完成 Phase 0-4(git `319ba22`=4.5),M 各项的消费窗口(0.3/1.2/1.4/2.2/3.3)**均已过**。
> 返工评估结论:本仓为一次性建成、**零生产数据**(全部表只有测试 fixture)——空表改 DDL/契约是干净重写而非数据迁移,
> 逐项返工成本低,故全部落地(未搁置);不触发"迁移方案先报 owner"(无数据可迁)。
> `[pricing.llm]` 三键分列等 §5 不做清单未碰。

## 逐项对账

| # | 状态 | 窗口 | 落点 | 提交 | 证据 |
|---|---|---|---|---|---|
| M1 | [done] | 已过(0.3);零数据重写 | 09 §9 拆 `context_snapshots`(内容表,幂等 upsert)+ `context_snapshot_uses`(session/used_at/rebuild);SayDo ddl.ts + dao/snapshots.ts 单实现(misc.ts 委托) | `07db363` | memory-compiler.test"M1 拆表":同 digest 二次落盘内容 1 行、双会话 uses 各记、rebuild 标记回读 [ok] |
| M2 | [done] | 已过(0.4);配置层直接做 | openaiCompat `providerPinning{order,allowFallbacks}` 请求体带 `provider` 路由控制;响应回显 `routedProvider` 入 ChatResponse | `fabba38` | improvements-m.test:钉路由 body 断言 + 无 pinning 不带 provider [ok] |
| M3 | [done|部分](接线三段,余两段随 5.x Brain 环——如实分期) | 已过(1.2) | WS 契约 `latency.stage` 五段枚举;pipeline 发 vad_end(PTT 松开)/asr_final/tts_first_byte(首句);daemon LatencyCollector 聚合 + `GET /dev/latency-report` 出 P50/P90 分解表(EOU 单列;SLO 内标 1.0s/发布上限 1.5s);llm_first_token/playout_start 由 Brain 环自记(5.x 接,P0 总验收 5.4 跑 >=20 条注入语料出表) | `fabba38`,`1d83658` | improvements-m.test:分段数学 + 分解表 + SLO 判定 [ok] |
| M4 | [done] | 已过(1.2 C8);零历史行,无回填问题 | 09 §9 cost_entries 注释定型 `{model,input_tokens,cached_input_tokens,output_tokens,routed_provider?}`;recordLlmUsage 断言 cached<=input,source 参数化(订阅行 tokens 照记);ChatUsage.cachedPromptTokens(OpenAI `prompt_tokens_details.cached_tokens` 提取,Anthropic `cache_read_input_tokens` 留映射位);**未动 [pricing.llm] 单价合一**(B6 定稿) | `fabba38` | provider.test:meta 四键断言 + cached>input 拒 [ok] |
| M5 | [done] | 1.3b/2.x | memory/negation.ts:检出"不要 X/改成 Y/别用 Z"即时 `remember`(trust=user_stated);疑问句不落;修订优先于否定 | `fabba38` | improvements-m.test:检出/不落/落账 user_stated [ok] |
| M6 | [done] | 已过(1.4 golden);golden 追加式,零返工 | docs/10 回写四件:①§4-2 承接层(<=半句复述再问);②#42b 深评等待(起/心跳超 50% 改口/插话应答;触发按可感时长与供给方式解耦);③§1 变体三档(锁定/结构锁定/自由池);④新 §2.5 封闭肯定词表(复述关键参数+封闭匹配,未匹配默认拒绝复读、二次转屏,否定优先,S3 不适用)。SayDo:approvals/confirmVocab.ts(状态机侧同词表单源;单字"不"精确匹配防"不错"误伤、否定邻接防护防"我不太好"误放;**方向纪律:误拒可接受误放不可接受**)+ golden M6_GOLDEN 4 条 + checkNoRepeatedOpeners | `07db363` | confirm-vocab.test 7 条全过(含词表重叠消解"行/不行") [ok] |
| M7 | [done] | 已过(2.2);编译器纯函数重写,零迁移 | 09 §5 规则⑥装配序恒定+⑦驱逐纪律+§0.1 签名域;契约 parentPackDigest/segment/form/prefixDigest(prefixDigest 派生值**不入签名**防自指涉);compiler 0.3.0(稳定段 id 字典序渲染、易变段后置、M3 form、累积 prefixDigest);**prefix-diff 验收落测试**:相邻两次编译稳定段 prefixDigest 不变、易变字段在公共前缀后 | `07db363` | memory-compiler.test"M7 前缀稳定性"3 条 [ok] |
| M8 | [done] | 随 09 回写捎带 | 09 §11 [params] + PARAM_DEFAULTS:`session_idle_suspend_sec=45`/`dialog_context_high(6000)/low(3000)_watermark_tokens`(P0 简化"全量直到高水位",契约先落)/`audio_retention_days=0` | `fabba38` | config/types.ts;04 §3 注记归文档会话未碰 |
| M9 | [done] | 随 3.3 回写捎带 | 09 §11 [pricing] 单位词表注释:llm=tokens+cached_tokens/asr=audio_min/tts=chars/P2 预留 messages+wallclock_min;每 kind 恒定 unit(现 pricing.ts 已按 kind 恒定单位计算,免 P2 迁移) | 文档批 | 09 §11 |
| M10 | [done] | Phase 1 收尾任意点 | voice/driftSentinel.ts:固定 4 句 golden 文本基线,比对时长(15%)/响度包络(L2 0.25)/ASR 回转归一化一致;周期跑接 CI/cron(真实合成注入化) | `fabba38` | improvements-m.test:三类漂移检出 [ok] |
| M11 | [done] | 随转写合同 | 09 §1 + contracts TranscriptTurn.audioSegmentRef?{path,startMs,endMs}(utterance<->音频段关联,P1 diarize 审计留口);保留期 `audio_retention_days` 参数化(P0 缺省 0 不留) | `fabba38` | contracts schema + 09 §1 |

## 候选清单(§4)到步评估

| 项 | 评估 | 理由 |
|---|---|---|
| 思考沉默与空闲分开计时(90s/30s 安抚) | **到步再评**(5.x 语音环) | 参数已具备接口(session_idle_suspend_sec 参数化),分开计时逻辑属 Brain 环轮次管理,5.x 落语音环时评 |
| earcon 最小集三件 | **到步再评**(5.x console) | 需真实音频资产与播放通道;P0 console 文本先行,不阻验收 |
| 回叫接通口头推迟 + 30s 无应答收尾句 | **采纳话术位,实现随 C4 增量** | outbox snooze 机制已在(4.4 dnd/snoozed_until),口头推迟=snooze 的语音入口,话术随 5.x golden 补 |
| 验收对话收口三件 | **采纳**(5.x/P0.5-C 直达验收档一起落) | walkthrough 按 AC 对齐与直达验收念清单同一处实现,窗口正好 |
| 垫话细则(仅耳机) | **不采纳(P0)** | 实验性 + 需通道检测;PTT 模式下价值低,P1 开放麦再评 |
| TTS 语速口令入 M0 | **不采纳(P0)** | M0 偏好机制在,但语速控制需 TTS 参数化接口,收益小;记 backlog |

## 评审记录(轻量制度:一致性 subagent + Codex 攒批;2026-07-25 收口)

- **Codex 攒批(gpt-5.6-sol)**:13 全量(25min 超时截断,分析完成结论 No-Go)→ 13b 聚焦复核完整输出
  **3A+7B,全部按最小改法回修**——订阅 meta 形状矛盾(§11-5 并集)/prefixDigest 签名域表述(§0.1 明确排除)/
  10 §2.5 旧文法(重写封闭文法)+ kind 前缀词表/audio_retention_days 双源归 [privacy]/§12 补 M1+成本+params 条目/
  invocation 补 routed_provider。报告:`research/codex-findings/13-canonical-writeback-m-batch.md`。
- **code-review subagent(Phase4/5+P0.5 综合)**:3A+6B+4C——A1 confirmVocab 误放行("确认不了/可以吗?"被判 accept,
  改整句封闭文法+疑问句护栏+"不"子串 reject)/A2 静态服务路径穿越(补 path.sep)/A3 /dev GET 绕身份门(不限方法);
  B1 M3 跨进程时钟混算(统一 daemon 到达时刻+playout_start 从 tts.playout 派生)/B2 过期 grant 遮蔽/B4 conflict
  双来源分流/B5 reviewTask 过状态机守卫(暴露 §6.1 无 failed 边 ⇒ reject 落取消链)/B6 uses 表去 PK。
  回修提交:`e8e9876` + 后续 13b 批。
- **迟到批回收(2026-07-25 凌晨;两份后台评审在总汇报后送达,当轮全部 triage 回修,提交 `e50668e`)**:
  - **Phase 4 code-review(独立,3A+7B)**:A1 MergeProof 自证对账(批准落库 approved_tree_sha,对账取库值——
    伪造 proof 回归例)/ A2 protectedBranches 空数组顶掉安全默认(push main 现恒 S3 deny)/
    A3 取消/返工未联动 outbox 冻结(幽灵升级,已接线);B 级:reserved 取消边/晚到事件变长 id 误判/
    canary 同 seq 搭便车/verify TOCTOU 如实注记/不可达误 snooze/CAS 幂等——全修,测试 +3。
  - **一致性 subagent(2A+10B,"有条件 Go")**:A-1 音频保留期双源(已随 Codex 13b 修)/
    A-2 重建比对口径缺裁决(已补:按存档签名域原样重算,父链仅限在线连续编译);
    B-1 ④/⑦合成规则、B-2 segment 按 tier 定稿、B-6 provider_order 注记、B-7 modules/b-memory
    七规则+拆表+prefix-diff+计划 2.2 行、B-8/B-9 §2.5 收据语义/适用范围、B-10 A3 职责、
    C-7 术语表 5 新词——全落;C-2..C-6/C-8/C-9 登记攒批(纯风格;C-5 已因 uses 表去 PK 而 moot,
    C-6 的 04 §3 注记归文档会话)。
- **终态:五路评审(一致性 + code-review x2 + Codex 13/13b)A 级累计 9 项全部修复,
  CI 全绿(contracts 65 + daemon 331),Go。**

## 提交序列

- `fabba38` M2/M3(数学)/M4/M5/M8/M10/M11 + canonical 回写
- `07db363` M1 拆表 + M6 四话术(含封闭词表) + M7 前缀稳定性
- `1d83658` M3 埋点接线(WS/pipeline/collector/report)
