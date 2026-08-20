# P0 readback 对账(5.4;实现 vs docs/09/10,偏离逐项标注)

> 口径:逐域核对实现与 canonical 契约;[match]=一致;[deviation]=偏离(附处置);[staged]=如实分期(canonical 已注明或计划挂账)。
> 运行证据:`just ci` 全绿(contracts 65 + daemon 292);Playwright 8/8;故事一 x3(story-acceptance);live 对话环冒烟(qwen via OpenRouter/DeepInfra 钉路由)。

## 09 数据契约逐域

| 域 | 实现 | 状态 |
|---|---|---|
| §0 数字/Money/digest 纪律 | contracts/money.ts(unknown 不显 0)、jcsDigest(JCS RFC 8785) | [match] |
| §0.1 digest 签名域 | computePackageDigest/computePackDigest(M7 加 parentPackDigest;prefixDigest 派生值不入签名——防自指涉,严格说是签名域注释的精化) | [match](精化已回写 09) |
| §1 Project/Session/TranscriptTurn | dao/projects、session.ts(A2 生命周期+转写落盘)、transcriptTurn schema(M11 audioSegmentRef) | [match] |
| §2 DecisionPackage/EffectGrant | contracts/package.ts + A6 工厂(签名/修订/产物持久化)+ E2 renderSpoken | [match] |
| §3 ApprovalReceipt 矩阵 | approvals/issue.ts + DDL CHECK(词表/S3 屏幕强认证/voice 必带 turn_ref)+ storage-checks | [match] |
| §4 记忆账本/遗忘 | memory/ledger.ts(append-only+投影)、snapshotForget(硬删传播+备份例外)、M0 红线 | [match] |
| §4.1 源快照/重验 | daemon-snapshotter + sourceverify(evidence binding/重验终局) | [match] |
| §5 Context Pack | compiler.ts(规则①-⑦,M7 段位/形态/前缀)+ M1 拆表落盘 | [match] |
| §6.1 任务状态机 | contracts/task.ts canTransitionTask + tier1/operations(取消全链/返工/合并证明) | [match] |
| §6.3 settle barrier | 路径一 Tier1SettleProof(settle 缺一不叫,callback.test);路径二 RunSettled 消费 | [staged:路径二 P0.5-B] |
| §7 投影词表 | api/console.ts 派生态(parked)不写回;StatusChip 单源映射 | [match] |
| §9 DDL | storage/ddl.ts 与 09 §9 同步(M1 拆表/M4 meta 注释已回写) | [match] |
| §10 WS 契约 | contracts/pipeline.ts + voice/hub.ts(role 白名单/watermark/注入通道;M3 latency.stage) | [match];**asr.partial P0 不发**(ADR-101 PTT 整段,canonical 已注明) | 
| §11 模型/配置 | config/types+load(项目层白名单)、providers/resolve(M2 钉路由)、observedModel 提取 | [match];observedModel familyOf 运行时断言在 evaluator 侧强制,dialog 侧记录不拦(09 §11 规则 2 的 P0 精度——评审跟踪) |
| §12 测试门禁 | 292 tests:崩溃注入/CHECK 反例/重放幂等/fail-closed 全在 | [match] |
| §13 Brain 工具 | brain/tools.ts 契约 + 工具测试;**live 工具环(remember/propose 经真实 LLM function-call)未接** | [staged:场次② dogfood 增量;工具语义由契约测试承载] |
| §14 A2/A8 | A2 会话挂起/重建;A8 最小版 presentation 打断作废(4.2) | [match(A8 完整状态机 P0.5-A)] |

## 10 语音 UX 逐域

| 域 | 实现 | 状态 |
|---|---|---|
| §1 全局纪律 | TTS 脱敏 redactor(出口统一);状态词纪律(golden 断言);变体三档(M6③) | [match] |
| §2 话术表 | golden 39 条覆盖 P0 场景(含逆风);#12/#39 P0.5 如实排期 | [match] |
| §2.5 封闭肯定词表 | confirmVocab.ts(否定优先/邻接防护/unmatched 拒);**4.2 stepConfirm 消费词表的语音接线随场次②**(状态机侧函数就绪) | [match(接线 staged)] |
| §3 轮次打断 | barge-in watermark 截断 + unheard(hub);S2 打断作废(presentation) | [match] |
| §4 骨架 | instructions.ts(含 M6① 承接层) | [match] |
| §5 摘要器 | summarizer(数字纪律/unknown 不编) | [match] |
| §6 golden | 文本注入级 39>=20;音频烟测 5/5(合成底板;owner 真人底板待录) | [match(底板 owner 侧)] |

## 5.4 验收项

| 项 | 结果 |
|---|---|
| 故事一 Tier1 版全闭环 x3(注入通道) | story-acceptance.test 1/1:三轮 confirmed->语音收据->approved->run->ready_for_review->approve->人工合并 MergeProof->task_done;审计链 approval.issue x3/transition x6/package.approve x3/review_approve x3/task.done x3 | 
| 除 S3 与开麦不碰键盘 | 链路全结构化事件驱动;S3 合并=屏幕强认证收据(CHECK 强制);真麦体感归场次③(owner) |
| live 对话环(可日用前提) | asr.final->qwen3-32b(OpenRouter 钉 DeepInfra)->分句 tts.say(脱敏出口);记账 meta 定型含 cached/routed;llm_first_token 埋点(非流式=响应到达,如实) |
| readback 零未解释偏离 | 上表全部 [match]/[staged](staged 均有 canonical 或计划挂账出处,无静默偏离) |

## 已知 staged 清单(全部有出处,非偏离)

1. 路径二(Hopper)全链 = P0.5-B/C/D/E;
2. Brain live 工具环(function-call 采访/记忆/拍板)= 场次② dogfood 增量(工具契约与策略层已测);
3. A8 完整 presentation 状态机 = P0.5-A;
4. asr.partial 实时字幕 = P1(ADR-101);
5. owner 真人音频底板 5 条 = owner 侧资产,补录后重跑 audio-smoke-5;
6. M3 五段全链 P50/P90 实测表(>=20 条)= 场次③ 真麦会话时出(采集器/报表端点就绪)。
