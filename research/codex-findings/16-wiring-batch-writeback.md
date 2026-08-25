# Codex 攒批评审 16:接线增量批 canonical 回写复核(2026-07-25)

> 模型 gpt-5.6-sol / max / read-only(50 分钟,1.22M tokens);prompt = `prompts/16-wiring-batch-writeback.md`;
> 日志 `logs/16-wiring-batch-writeback.log`。评审对象 = 接线批 canonical 回写(09 §10 补录/ADR-002 附则)
> + 实现-合同一致性抽查(SayDo `4e97ae1`+`5769ae9`+`0111d5f`,HEAD `2292a37` 时点)。

## Triage 总结(接线批会话,2026-07-25 晚;逐条独立核实后处置)

| # | 级 | 核实 | 处置 |
|---|---|---|---|
| 2 BYOA"休眠"声明 vs familyFixed 代码路径仍在 | A(潜在) | 属实但**生产不可达**(resolve.ts 只解析 api,BYOA provider 无生产构造点;Codex 自注"potential path"),且"保留代码供 claude_cli 接入复用"是 owner 2026-07-25 明示决策(ADR-002 owner 裁定节);byoa.test 的恒定族用例是 familyFixed 现行为锚 | **登记不改代码**(身份核验链实现时一并改写 familyFixed 门与测试——ADR-002 附则第 2/4 条已是该义务的 canonical 承载);evidence §5 补记 |
| 5.1 全角问号护栏失效("可以?"误 accept) | A | **属实**(python 读码点证实字符类是两个 ASCII ?;node 复现 accept)——存量 bug(M6④),接线批把词表环接入生产消费后影响放大 | **已修** `confirmVocab.ts` 显式 `[?\uFF1F]` + 全角反例 3 条 |
| 3.2/4.3 retry message/返工 comments 原文无 durable 落点 | A | 属实(audit 只记 digest 是 E3 纪律,但审计≠功能存储;用户答复静默蒸发) | **已修** DDL v3 `task_messages` 表(additive)+ retryTask/reviewTask 事务内持久化 + `readTaskMessages` 消费口 + 断言 |
| 4.2 approve proof 只做 truthy 检查 | A(潜在) | 属实(结构残缺 JSON/settled_failed 的 proof 可过) | **已修** `tier1SettleProofSchema.parse` + run state=settled_review 断言 + taskId/attempt/runId/treeSha 交叉核对 |
| 6.2 blocked 回叫缺 09 §9 最小 settle proof | A | 属实(enqueue 对 blocked/failed 零 proof 门) | **已修** engine.enqueue fail-closed(blocked/failed 须 `tier1MinimalProofSchema` 过)+ contracts settleProof 加可选 minimalProof 字段(additive)+ scheduler 传步界超时锚 + callback.test 正反例 |
| 5.5 accept/consume/建任务非原子 | A | 属实(崩溃可留"收据已消费无任务") | **已修** dispatchApprovedPackage 全链同 SQLite 事务 |
| 3.3 retry 不验旧 run 终态 | B | 属实 | **已修** failed 分支断言无活跃 run + 反例 |
| 3.4 retry 状态/冻结/审计非原子 | B | 属实 | **已修** 同事务 |
| 5.2 direct_to_review 确认句未念 grant 清单 | B(潜在) | 属实(P0 live 组包恒 step_confirm+空 grants,但工具面可接直达包) | **已修** issueDispatchReceipt 对 direct 包/带 grants 包 fail-closed 拒(P0.5-C 接 renderGrantChecklist 时放开) |
| 5.3 转屏后 voice 收据无机械终局 | B | 属实(canonical:按超时档终局) | **已修** scheduler 收据超时 sweep(未决→timeout 按档;accept 未消费→expire)+ 正例 |
| 5.4 审批答复进 Brain history | B | 属实(语义污染) | **已修** 裁决轮 excludeFromHistory(转写照落,史不进) |
| 6.3 老化链非原子 + revise 失败仍发"转成草稿"回叫 | B | 属实 | **已修**(revise 失败不入队 #35,audit 告警锚保留);全链事务化评估后不做(revise 含文件 IO,拆半事务价值低——audit 锚 + 幂等已兜) |
| 6.4 transitionTier1Run 无 CAS | B | 属实 | **已修** WHERE state=@from + changes=0 抛 |
| 1/§10 时序措辞、4.1 evidenceDigest 映射句、2/版本-digest 措辞 | C | 采纳/采纳/登记 | 前两条**已修**(09 §10 时序拆分注/§13 Tier1-Hopper evidenceDigest 同名不同物注);"版本是否独立字段"随身份核验链实施时定 |
| 6.5 15s 轮询精度/catch 吞 | C | 如实 | 注记接受(30s/72h 语义容忍 0-15s 迟延;单机 P0) |

**A 级处置口径**:5 条 A 级中 4 条当轮修复(全角问号/message 持久化/proof 严格校验/最小 proof + 事务化),
1 条(BYOA familyFixed)经核实为生产不可达 + owner 已有决策承载,登记至身份核验链批。
回修提交:SayDo `git log` 见 evidence wiring-batch.md §6(回修批 2)。门禁:`just ci` 双矩阵绿 + Playwright 10/10。

## 原始报告(全文)

结论先行：本次只读复核，未修改文件。两处 canonical 回写的文字大体诚实，但不能判“全批通过”。

主要硬伤：

- A：BYOA 附则写成“豁免休眠”，但仍有代码路径按 `familyFixed` 放行缺失 `observedModel`，且没有 `observed_model_exempted` 审计标记。
- A：确认词表对全角 `？` 的问句护栏失效，`可以？` 会被判为 accept。
- A：`retryTask` 与 `reviewTask(request_changes)` 接受的原文没有持久化，新 attempt/run 也没有在当前实现中落库。
- A：`reviewTask(approve)` 未严格解析/绑定 `Tier1SettleProof`。
- A：30 秒转 `blocked` 的回叫缺 canonical 要求的最小 settle proof。
- B/A：确认消费、包批准、任务入队不是一个事务，崩溃窗口可能出现“收据已消费但没有任务”。

## 1. §10 PipelineMsg 两条 additive 扩展

裁决：C（合同形状通过；只建议把时序措辞写得更精确）。

### 形状一致

- canonical 的 `latency.stage` 是五段枚举、`sessionId`、`turnId`、`atMs`：[09-data-contracts.md:588](~/WorkSpace/voice-coding/docs/09-data-contracts.md:588)。
- TypeScript schema 使用同一五段枚举和非负 `atMs`：[pipeline.ts:38](~/WorkSpace/SayDo/packages/contracts/src/types/pipeline.ts:38)、[pipeline.ts:43](~/WorkSpace/SayDo/packages/contracts/src/types/pipeline.ts:43)。
- Python pipeline 发送 `vad_end`、`asr_final`、`tts_first_byte`，时间来自 `time.monotonic()`：[hub_client.py:159](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/hub_client.py:159)、[hub_client.py:174](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/hub_client.py:174)。
- daemon 明确忽略发送方 `atMs`，用到达时刻记录：[index.ts:451](~/WorkSpace/SayDo/packages/daemon/src/index.ts:451)。

- canonical 的 `asr.hotwords` 是 `{ t, words }`，单向 daemon→pipeline，元素非空、最多 1000：[09-data-contracts.md:590](~/WorkSpace/voice-coding/docs/09-data-contracts.md:590)。
- schema 同样是非空字符串数组、最多 1000：[pipeline.ts:50](~/WorkSpace/SayDo/packages/contracts/src/types/pipeline.ts:50)。
- peer 不能直接发送该消息，只有 daemon 的 `sendHotwords` 可发：[hub.ts:165](~/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:165)、[hub.ts:207](~/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:207)、[hub.ts:259](~/WorkSpace/SayDo/packages/daemon/src/voice/hub.ts:259)。
- pipeline 收到后传给 ASR，ASR 放入 `corpus.context`：[hub_client.py:143](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/hub_client.py:143)、[hub_client.py:162](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/hub_client.py:162)、[doubao_asr.py:91](~/WorkSpace/SayDo/pipeline/src/saydo_pipeline/doubao_asr.py:91)。

### 与 §5、§13、§12 无冲突

- §5 的 `topicTerms` 仍是当轮 ASR 分词与会话热词并集：[09-data-contracts.md:272](~/WorkSpace/voice-coding/docs/09-data-contracts.md:272)；编译器会 trim、去重、排序：[compiler.ts:84](~/WorkSpace/SayDo/packages/daemon/src/memory/compiler.ts:84)。
- §13 的 `addHotword` 输入仍只有 `term/canonical`：[09-data-contracts.md:818](~/WorkSpace/voice-coding/docs/09-data-contracts.md:818)；实现把它写成 M0 热词并立即推送下一轮偏置：[liveTools.ts:487](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:487)。
- `term ∪ canonical`、`seedTerms` 仅预留、dogfood 未接通的说明，与 `HotwordStore.biasTerms(extraSeeds)` 的实际状态一致：[hotwords.ts:53](~/WorkSpace/SayDo/packages/daemon/src/memory/hotwords.ts:53)。

### 措辞

“工程侧 additive 扩展的回写补录”是诚实的：[09-data-contracts.md:587](~/WorkSpace/voice-coding/docs/09-data-contracts.md:587)。

建议把“实现自 M3/接线批”拆成更精确的时序说明：`latency.stage` 来自较早的 M3 埋点提交，`asr.hotwords` 随接线批接通。SayDo 的实际 git 记录能看到这一先后，但 canonical 根目录没有 `.git`，无法从设计库本身核验写回 commit。

最小改法：只改注释措辞，不改 schema。

## 2. ADR-002 附则与 §11 规则 2

裁决分两层：

- 附则文字：C/通过，四条没有漏项或语义漂移。
- BYOA 实现状态：A（潜在安全硬伤，当前主 daemon 路径暂未证明已接通）。

### 四条逐句对照

| 条款 | ADR 附则 | canonical / Codex 15 | 裁决 |
|---|---|---|---|
| 封闭枚举 | `{codex_cli, claude_cli}`：[ADR-002:54](~/WorkSpace/SayDo/docs/adr/ADR-002-byoa-observed-model.md:54) | §11 同句：[09-data-contracts.md:735](~/WorkSpace/voice-coding/docs/09-data-contracts.md:735) | 一致 |
| 身份核验前提 | 预登记绝对路径 + 内容 digest，失败按 missing+audit：[ADR-002:55](~/WorkSpace/SayDo/docs/adr/ADR-002-byoa-observed-model.md:55) | §11 同句；Codex 15 也要求身份链未实现前不能启用：[15-owner-decisions-panel.md:29](~/WorkSpace/voice-coding/research/codex-findings/15-owner-decisions-panel.md:29) | 一致 |
| exempted 审计标记 | 每次实际豁免必须记 `observed_model_exempted=true`，流内有 model 仍验族：[ADR-002:57](~/WorkSpace/SayDo/docs/adr/ADR-002-byoa-observed-model.md:57) | §11 同句：[09-data-contracts.md:735](~/WorkSpace/voice-coding/docs/09-data-contracts.md:735) | 一致 |
| 豁免休眠 | dev 只用 cursor，身份链未实现，本批不实现：[ADR-002:59](~/WorkSpace/SayDo/docs/adr/ADR-002-byoa-observed-model.md:59) | Codex 15 明确“当前实现没有这条身份核验链”： [15-owner-decisions-panel.md:31](~/WorkSpace/voice-coding/research/codex-findings/15-owner-decisions-panel.md:31) | 一致 |

旧决策表不是额外冲突，因为 ADR 已明确标为 superseded，附则优先：[ADR-002:3](~/WorkSpace/SayDo/docs/adr/ADR-002-byoa-observed-model.md:3)、[ADR-002:63](~/WorkSpace/SayDo/docs/adr/ADR-002-byoa-observed-model.md:63)。

### 实现与“休眠”声明相反

- `familyFixed` 仍然只按 provider 名称开启：[provider.ts:60](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:60)。
- `consumeByoaEvents` 在 `familyFixed` 时允许缺失 `observedModel`：[consume.ts:74](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/consume.ts:74)。
- cage 返回裸的 `codex`/`claude` 名称：[cage.ts:19](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/cage.ts:19)；runner 通过 `PATH` 启动：[runner.ts:39](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/runner.ts:39)。
- invocation 审计字段没有 `observed_model_exempted`：[provider.ts:70](~/WorkSpace/SayDo/packages/daemon/src/providers/byoa/provider.ts:70)。
- binary probe 代码自己注明真实探测器尚未接线：[config/probe.ts:1](~/WorkSpace/SayDo/packages/daemon/src/config/probe.ts:1)。
- 仓库内检索 `observed_model_exempted` 没有实现命中；只有文档提及。
- 反例测试仍要求“恒定族缺 model 通过”：[byoa.test.ts:102](~/WorkSpace/SayDo/packages/daemon/test/byoa.test.ts:102)。

当前主 daemon 的 provider resolver 只处理 API，BYOA resolver 会直接抛错：[resolve.ts:14](~/WorkSpace/SayDo/packages/daemon/src/providers/resolve.ts:14)、[resolve.ts:26](~/WorkSpace/SayDo/packages/daemon/src/providers/resolve.ts:26)。所以我把它定性为“潜在路径”，没有声称当前 main 已经能从生产入口触发；但一旦直接调用 BYOA adapter，附则安全前提没有被兑现。

最小改法：

1. 身份链完成前，关闭 `familyFixed` 豁免，或统一要求 `observedModel`，并改写上述测试。
2. 以后启用时，必须用已登记绝对路径启动、核验 digest，再写 `observed_model_exempted=true`。
3. Codex 15 Q2 的建议文字还写了“版本 + 内容 digest”，而 09/ADR 只写内容 digest。这不是当前安全放宽，但属于 C 级文案未统一；应明确“版本是否独立字段，还是由内容 digest 覆盖”。

## 3. `failed → queued (U)` 与 `retryTask`

### 3.1 状态边本身

裁决：C（当前 failed→queued 路径基本正确）。

- 合同边定义为 `failed → queued`、触发者 U，并注明旧 run/证据隔离、重过派发前置、冻结 `trigger=failed`：[task.ts:49](~/WorkSpace/SayDo/packages/contracts/src/statemachines/task.ts:49)、[09-data-contracts.md:330](~/WorkSpace/voice-coding/docs/09-data-contracts.md:330)。
- `retryTask` 明确调用 `canTransitionTask`：[operations.ts:321](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:321)。
- SQL 使用 `WHERE status=?` CAS：[operations.ts:325](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:325)。
- 离开 failed 后冻结 `trigger=failed`：[operations.ts:329](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:329)。

因此，没有发现一个“failed 直接进 running”或完全绕过 `canTransitionTask` 的 failed→queued 路径。问题是它没有统一调用 `transitionTask`，而是各处复制“守卫 + UPDATE + CAS”；这会造成未来状态表漂移，属于 B/C 级维护风险，不是当前已证实的 failed 边越权。

### 3.2 A：retry message 和新 attempt 没有 durable 落点

- canonical 明确要求 retry/返工 `INSERT 新行、attempt+1`：[09-data-contracts.md:574](~/WorkSpace/voice-coding/docs/09-data-contracts.md:574)。
- `retryTask` 只查询 `MAX(attempt)`：[operations.ts:319](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:319)，返回一个数字，没有 `insertTier1Run`。
- `nextAttempt` 只在 DAO 和测试中出现，生产操作代码没有调用：[tasks.ts:202](~/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:202)。
- API 收到的原文确实传进 `retryTask`：[actions.ts:75](~/WorkSpace/SayDo/packages/daemon/src/api/actions.ts:75)；但实现只存 `messageDigest`：[operations.ts:332](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:332)。
- `tier1_runs` 表没有 retry instruction/context 字段：[ddl.ts:98](~/WorkSpace/SayDo/packages/daemon/src/storage/ddl.ts:98)。
- HANDOFF 也承认“原文只落 digest，消费点随执行器批接线”：[wiring-batch.md:62](~/WorkSpace/SayDo/e2e/evidence/wiring-batch.md:62)。

所以当前函数会把用户的“换个思路”“补上连接串”等原文丢掉；未来执行器无法从 digest 还原它。这是 A 级契约/数据丢失。

最小改法：增加受保护的 attempt-input/retry-instruction 持久化（原文或受控 artifact + digest + taskId/attempt/run 绑定），与新 run/入队写入同一事务；不要把原文塞进不可变 audit。若执行器暂不实现，应拒绝带 `message` 的 retry，而不是返回成功的 attempt 预告。

### 3.3 B：旧 run 终态和派发前置没有在 `retryTask` 内验证

canonical 要求旧 run 终态、attempt 隔离，并重过 worktree、预算、Gate 0 等前置：[09-data-contracts.md:330](~/WorkSpace/voice-coding/docs/09-data-contracts.md:330)。

当前代码只取最大 attempt，不检查该行的 `state`：[operations.ts:319](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:319)。执行器尚未接线是已声明范围边界：[HANDOFF.md:39](~/WorkSpace/SayDo/HANDOFF.md:39)，因此这里是“接入即暴露”的 B 级缺口：可能在旧 run 尚未终态时把任务重新排队，也没有在本函数内重跑派发门禁。

最小改法：在同一事务中锁定/核验最新 run 为允许的终态，写入新的 attempt/run reservation，并在 queued→running 认领时再次执行全部 preflight。

### 3.4 B：状态、冻结、审计不是原子操作

状态 CAS、冻结 outbox、写 audit 是三个相邻但独立的动作：[operations.ts:325](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:325)、[operations.ts:330](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:330)、[operations.ts:332](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:332)。

进程在状态已变成 queued、但冻结尚未完成时退出，会留下旧 failed 回叫。最小改法是同库事务，或把“离开 failed 待冻结”写成可恢复 outbox intent。

## 4. `reviewTask` approve 的 evidenceDigest 与返工路径

### 4.1 approve 自取 evidenceDigest：不是偏离，而是合同收紧

裁决：C/通过，且属于合理的 fail-closed 收紧。

- §13 的入参只有 `taskId/verdict/comments/expectedAttempt`，没有外部 `evidenceDigest`：[09-data-contracts.md:792](~/WorkSpace/voice-coding/docs/09-data-contracts.md:792)。
- canonical 只要求 approve 把 evidenceDigest 绑定到 audit：[09-data-contracts.md:794](~/WorkSpace/voice-coding/docs/09-data-contracts.md:794)。
- 实现从当前 attempt 的 settle proof 库内取 `tier1VerifyDigest`，再写入审计：[operations.ts:184](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:184)、[operations.ts:194](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:194)、[operations.ts:201](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:201)。
- 测试源码也断言 audit 的 digest 等于 proof 内 digest：[tier1-operations.test.ts:185](~/WorkSpace/SayDo/packages/daemon/test/tier1-operations.test.ts:185)。

因此“settle proof 库内自取、拒外部注入”是合同收紧，不改变“approve→绑定 evidenceDigest→audit_log”的原义。建议仅在 §13 增加一句显式映射，避免未来把 Hopper 的 evidenceDigest 与 Tier1 的 `tier1VerifyDigest` 混用。

### 4.2 A：proof 只做类型断言，没有严格验证

- 代码对 JSON 只做 TypeScript cast，并检查字段是否 truthy：[operations.ts:185](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:185)、[operations.ts:189](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:189)。
- 合同已有严格 schema，要求 `taskId/runId/attempt/packageRevision/treeSha/tier1VerifyDigest/transcriptCursor/settledAt` 全部存在：[task.ts:75](~/WorkSpace/SayDo/packages/contracts/src/types/task.ts:75)。
- 代码查询甚至没有读取 run 的 `id`、`state`、`packageRevision`，也没有要求 `state=settled_review`；Tier1 run 的终态表明确区分 `settled_review` 与 `settled_failed`：[tier1run.ts:12](~/WorkSpace/SayDo/packages/contracts/src/statemachines/tier1run.ts:12)。

因此，一个结构不完整但含非空 `tier1VerifyDigest` 的 JSON，或来自 `settled_failed` 的 proof，理论上可能通过 approve。这是 A 级内部合同 fail-open（当前生产执行器尚未接通，故标注为潜在）。

最小改法：`tier1SettleProofSchema.parse`；要求 run 状态为 `settled_review`；交叉核对 proof 的 taskId、runId、attempt、packageRevision、treeSha 与数据库当前行/任务完全一致。

### 4.3 A：request_changes 同样丢失原文且没有立即创建新 run

- canonical 要求返工进入同 task 新 attempt、旧证据隔离：[09-data-contracts.md:319](~/WorkSpace/voice-coding/docs/09-data-contracts.md:319)、[09-data-contracts.md:574](~/WorkSpace/voice-coding/docs/09-data-contracts.md:574)。
- 实现只把任务改为 running、计算并返回 `currentAttempt+1`：[operations.ts:208](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:208)、[operations.ts:218](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:218)。
- `comments` 原文只产生 digest：[operations.ts:221](~/WorkSpace/SayDo/packages/daemon/src/tier1/operations.ts:221)，没有新 `tier1_runs` 行或受保护的返工上下文。

这与第 3 项的 retry message 丢失是同一根因，但在 review path 上构成独立的 A 级合同缺口。最小改法同上：持久化 comments/context，事务内插入新 attempt/run；审计只保留 digest。

## 5. §2.5 确认词表环、pending、barge-in

### 已对齐的部分

- 肯定/否定词表逐字一致：[10-voice-ux-spec.md:94](~/WorkSpace/voice-coding/docs/10-voice-ux-spec.md:94)、[confirmVocab.ts:5](~/WorkSpace/SayDo/packages/daemon/src/approvals/confirmVocab.ts:5)。
- 否定优先、整句封闭匹配、首次复读/二次转屏的实现逻辑存在：[confirmVocab.ts:15](~/WorkSpace/SayDo/packages/daemon/src/approvals/confirmVocab.ts:15)、[confirmVocab.ts:36](~/WorkSpace/SayDo/packages/daemon/src/approvals/confirmVocab.ts:36)、[confirmVocab.ts:39](~/WorkSpace/SayDo/packages/daemon/src/approvals/confirmVocab.ts:39)、[confirm.ts:55](~/WorkSpace/SayDo/packages/daemon/src/live/confirm.ts:55)。
- 有 pending 时当前 ASR 轮不会调用 Brain：[dialog.ts:61](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:61)、[dialog.ts:66](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:66)。
- barge-in 会使 presentation 失效，裸“好”不能消费，必须重播：[dialog.ts:54](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:54)、[presentation.ts:33](~/WorkSpace/SayDo/packages/daemon/src/approvals/presentation.ts:33)。
- 测试源码覆盖了第一次复读、第二次转屏、barge-in 后裸肯定不消费：[live-wiring.e2e.test.ts:230](~/WorkSpace/SayDo/packages/daemon/test/live-wiring.e2e.test.ts:230)、[live-wiring.e2e.test.ts:252](~/WorkSpace/SayDo/packages/daemon/test/live-wiring.e2e.test.ts:252)。

### 5.1 A：全角问号可误放行

canonical 要求疑问句收尾 unmatched：[10-voice-ux-spec.md:97](~/WorkSpace/voice-coding/docs/10-voice-ux-spec.md:97)。

但实现：

- `norm` 会删除全角 `？`：[confirmVocab.ts:11](~/WorkSpace/SayDo/packages/daemon/src/approvals/confirmVocab.ts:11)；
- 问句护栏只匹配 ASCII `?`，没有匹配 `？`：[confirmVocab.ts:36](~/WorkSpace/SayDo/packages/daemon/src/approvals/confirmVocab.ts:36)。

对源码同构正则做的只读复现输出为：

```json
{"reply":"可以？","guard":false,"norm":"可以","accept":true}
```

而仓库真实 ASR 样本确实带全角问号：[results-volc-sauc.json:505](~/WorkSpace/SayDo/e2e/spikes/asr-1.0/results-volc-sauc.json:505)。

这是当前确认路径的 A 级误放行。最小改法：护栏改为同时识别 `[?？]`，并增加 `可以？`、`可以？ `、混合标点的单测；canonical 也应把 `?/ ?` 的重复 ASCII 写法明确为 `?/？`。`docs/11` 还规定中文标点全角：[11-ui-spec.md:233](~/WorkSpace/voice-coding/docs/11-ui-spec.md:233)。

### 5.2 A（潜在）：direct_to_review 没有使用 E2 grant spokenForm

canonical 要求 S2/预授权确认复述任务、效果、目标，并使用 E2 `spokenForm`：[10-voice-ux-spec.md:93](~/WorkSpace/voice-coding/docs/10-voice-ux-spec.md:93)、[10-voice-ux-spec.md:129](~/WorkSpace/voice-coding/docs/10-voice-ux-spec.md:129)。

实现的 dispatch 确认句只用了 `outcomePreview` 和金额：[liveTools.ts:286](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:286)，而已有的 `renderGrantChecklist` 没有被调用：[directMode.ts:141](~/WorkSpace/SayDo/packages/daemon/src/approvals/directMode.ts:141)。

当前 P0 live `createTask` 固定 `step_confirm` 且 grants 为空：[liveTools.ts:234](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:234)，所以这是 direct mode 的潜在路径，不是当前默认路径。但 `confirmAndDispatch` 接口仍接受 `direct_to_review`：[liveTools.ts:303](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:303)。一旦有带 grants 的 direct package，用户只听到泛化成果句后说“好”，可能未明确授权每一项出圈动作。

最小改法：当前 P0 直接拒绝 direct mode；启用时必须调用 `renderGrantChecklist`，超过三项转屏，并把渲染结果绑定到 package digest。

### 5.3 B：二次未匹配转屏后，voice receipt 没有终局

canonical 要求二次 unmatched 转屏后，原 voice receipt 按超时档终局：[10-voice-ux-spec.md:95](~/WorkSpace/voice-coding/docs/10-voice-ux-spec.md:95)、[09-data-contracts.md:165](~/WorkSpace/voice-coding/docs/09-data-contracts.md:165)。

实现只删除内存 pending 并播“放屏幕上了”：[confirm.ts:81](~/WorkSpace/SayDo/packages/daemon/src/live/confirm.ts:81)、[dialog.ts:171](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:171)。虽然 receipt 状态机支持 `timeout_parked/timeout_rejected`：[receipt.ts:56](~/WorkSpace/SayDo/packages/contracts/src/statemachines/receipt.ts:56)，但生产源码没有 receipt timeout 调用；测试源码反而明确断言转屏后仍是 `pending`：[live-wiring.e2e.test.ts:243](~/WorkSpace/SayDo/packages/daemon/test/live-wiring.e2e.test.ts:243)。

这会留下长期 pending receipt，且没有“旧张终局、回来签新张”的机械保证。最小改法：增加按 `expiresAt` 扫描的 receipt timeout worker，或在转屏时立即按 mode 应用 `timeout` 并另签屏幕收据；同步修改测试。

### 5.4 B：确认答复写入普通 Brain history

虽然当前轮确实没有调用 Brain，但 `onAsrFinal` 先调用 `onUserTurn`：[dialog.ts:63](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:63)，而 `onUserTurn` 把答复放进普通 history：[voiceSessions.ts:95](~/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts:95)、[voiceSessions.ts:105](~/WorkSpace/SayDo/packages/daemon/src/live/voiceSessions.ts:105)。

下一次普通对话会把“好/可以/不要”等审批答复作为历史上下文看到。它不是当前轮误放行，但属于 B 级语义污染。最小改法：确认轮单独落审计/转写，不进入普通 Brain history；或者在历史构造时过滤 `approval_turn`。

### 5.5 A（潜在数据丢失）：accept、consume、建任务非原子

确认 accept 后先写 `user_accept`：[dialog.ts:130](~/WorkSpace/SayDo/packages/daemon/src/live/dialog.ts:130)；随后 `dispatchApprovedPackage` 依次消费 receipt、批准 package、插入 task、推进 queued：[liveTools.ts:121](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:121)、[liveTools.ts:126](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:126)。

这些步骤没有一个共同事务。中途崩溃或数据库错误可能留下：

- receipt 已 `consumed`，但没有 task；
- package 已 `approved`，但没有 queued task；
- 内存 pending 已删除，用户无法再次确认同一张 receipt。

这是确认后的 durable 状态可能丢失，按 A 级数据一致性处理。最小改法：把 consume、package approve、TaskCard 插入、queued transition 放进同一 SQLite transaction，或引入可重放的 dispatch intent/idempotency key。

## 6. `transitionTask`、parked 字段与 30s/72h T 调度

### 6.1 核心 CAS/parked 语义

裁决：C（核心实现与 canonical 边表一致）。

- `PARKED_STATES` 只含 `blocked` 和 `ready_for_review`，与 `paused` 先转 `blocked` 的规则一致：[tasks.ts:65](~/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:65)。
- `transitionTask` 先读状态、调用 `canTransitionTask`，再以 `WHERE status=@from` CAS 更新：[tasks.ts:81](~/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:81)、[tasks.ts:83](~/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:83)、[tasks.ts:95](~/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:95)、[tasks.ts:111](~/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:111)。
- 进入 `blocked/ready_for_review` 写入 `parked_at/deadline`，离开清空，符合 TaskCard 语义：[09-data-contracts.md:302](~/WorkSpace/voice-coding/docs/09-data-contracts.md:302)。
- 30 秒边由 T 触发 `paused_step_boundary → blocked`：[scheduler.ts:18](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:18)、[scheduler.ts:50](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:50)。
- 72 小时边由 T 触发 `blocked/ready_for_review → cancel_requested`，回叫 trigger 为 `parked_expired`：[scheduler.ts:70](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:70)、[scheduler.ts:114](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:114)。
- `parkAging` 自己虽未复用 `transitionTask`，但有 `canTransitionTask` 和状态 CAS：[parkAging.ts:36](~/WorkSpace/SayDo/packages/daemon/src/approvals/parkAging.ts:36)、[parkAging.ts:38](~/WorkSpace/SayDo/packages/daemon/src/approvals/parkAging.ts:38)。
- 15 秒轮询覆盖 30 秒和 72 小时阈值：[index.ts:503](~/WorkSpace/SayDo/packages/daemon/src/index.ts:503)、[index.ts:523](~/WorkSpace/SayDo/packages/daemon/src/index.ts:523)。

这与 canonical 的 30 秒/72 小时语义：[04-key-mechanisms.md:182](~/WorkSpace/voice-coding/docs/04-key-mechanisms.md:182)、[04-key-mechanisms.md:190](~/WorkSpace/voice-coding/docs/04-key-mechanisms.md:190)，以及 §6.1 的 T 边：[09-data-contracts.md:315](~/WorkSpace/voice-coding/docs/09-data-contracts.md:315)、[09-data-contracts.md:331](~/WorkSpace/voice-coding/docs/09-data-contracts.md:331)，一致。

### 6.2 A：blocked 回叫缺 canonical 最小 settle proof

canonical 明确规定 blocked/failed 回叫至少要有 `questionId 或 exitEvidence + transcriptCursor`：[09-data-contracts.md:574](~/WorkSpace/voice-coding/docs/09-data-contracts.md:574)。实现也已有对应 schema：[task.ts:97](~/WorkSpace/SayDo/packages/contracts/src/types/task.ts:97)。

但：

- `CallbackEngine.enqueue` 只对 `ready_for_review` 检查 proof，明确把 blocked/failed 列为“不需 settle proof”：[engine.ts:55](~/WorkSpace/SayDo/packages/daemon/src/callback/engine.ts:55)。
- 30 秒 scheduler 的 blocked 回叫只传 `projectionCursor` 和空 `artifactChecks`：[scheduler.ts:60](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:60)。

所以实际 T 回叫可以在没有 question/exit evidence/transcript cursor 的情况下落 outbox，违反 §9 的最小证据要求。这是 A 级契约硬伤：可能外呼一个没有可定位证据的问题。

最小改法：blocked/failed 入队强制解析 `tier1MinimalProofSchema`，把最小 proof 作为结构化字段持久化；scheduler 必须生成稳定的 question/cursor，拿不到就不入队而进入可恢复告警。

### 6.3 B：72h 老化的任务、包回落、回叫不是原子链

`ageOutParkedTasks` 的事务只覆盖 task 状态更新：[parkAging.ts:33](~/WorkSpace/SayDo/packages/daemon/src/approvals/parkAging.ts:33)、[parkAging.ts:49](~/WorkSpace/SayDo/packages/daemon/src/approvals/parkAging.ts:49)。之后 scheduler 才冻结回叫、结算、改 package、入队回叫：[scheduler.ts:73](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:73)、[scheduler.ts:97](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:97)、[scheduler.ts:114](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:114)。

如果在中间退出，task 已清掉 `parked_deadline`，下一轮不会再次扫描，可能留下：

- task 已取消但 package 没有 revision+1 draft；
- 活跃旧回叫未冻结；
- `parked_expired` 回叫未入队。

另外 package revise 失败会被记录后继续发送回叫：[scheduler.ts:104](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:104)、[scheduler.ts:113](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:113)，用户可能收到“已转草稿”但实际没有新 draft。

最小改法：同库事务覆盖 task/package/outbox intent；若跨域不能同事务，则为 `cancel_reason=park_expired` 建启动/定时 reconciliation，且 revise 失败时不要发送成功语义的回叫。

### 6.4 B（相邻执行域）：`transitionTier1Run` 没有 CAS

任务层的 CAS 是正确的，但同一 DAO 中 Tier1 run 的转换仍是“先读状态，再按 id 更新”，没有 `WHERE state=@from` 或 changes 检查：[tasks.ts:177](~/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:177)、[tasks.ts:182](~/WorkSpace/SayDo/packages/daemon/src/storage/dao/tasks.ts:182)。

两个并发 settle/失败调用都读到 `running` 时，后写者可能覆盖先写者的终态和 proof。当前生产执行器未接通，因此这是接入即暴露的并发数据完整性风险。最小改法：为 run transition 增加 from-state CAS，并在 changes=0 时重读拒绝。

### 6.5 C：轮询精度

15 秒轮询意味着“30 秒”或“72 小时”实际可能晚约 0–15 秒。若这是可接受的调度精度，应在合同/测试中写明；否则使用 deadline 驱动的更细粒度 timer。另，scheduler 的宽泛 catch 会把异常压成一次日志：[scheduler.ts:49](~/WorkSpace/SayDo/packages/daemon/src/live/scheduler.ts:49)、[index.ts:529](~/WorkSpace/SayDo/packages/daemon/src/index.ts:529)，建议增加失败任务的 durable retry/reconciliation。

## 事实前提核验表

| 类别 | 本次实读内容 | 结论性质 |
|---|---|---|
| canonical 规则 | `voice-coding/AGENTS.md`、`docs/09-data-contracts.md`、`docs/10-voice-ux-spec.md`、`docs/04-key-mechanisms.md`、`docs/06-references.md`、`docs/11-ui-spec.md`、`research/codex-findings/15-owner-decisions-panel.md` | 直接来自文件 |
| ADR/范围声明 | `SayDo/AGENTS.md`、`SayDo/docs/adr/ADR-002-byoa-observed-model.md`、`HANDOFF.md`、`e2e/evidence/wiring-batch.md` | 直接来自文件；其中 HANDOFF/evidence 只作为范围自报，不当作独立运行证明 |
| Pipeline/记忆 | `packages/contracts/src/types/pipeline.ts`、`daemon/src/voice/hub.ts`、`daemon/src/index.ts`、`daemon/src/live/pack.ts`、`daemon/src/memory/compiler.ts`、`daemon/src/memory/hotwords.ts`、`pipeline/src/saydo_pipeline/hub_client.py`、`doubao_asr.py` | 直接来自代码 |
| 状态/执行/审批 | `contracts/src/statemachines/task.ts`、`tier1run.ts`、`receipt.ts`、`types/task.ts`、`types/outbox.ts`；`daemon/src/storage/dao/tasks.ts`、`storage/ddl.ts`、`tier1/operations.ts`、`live/scheduler.ts`、`approvals/parkAging.ts`、`callback/engine.ts`、`brain/liveTools.ts` | 直接来自代码 |
| BYOA | `providers/byoa/provider.ts`、`consume.ts`、`runner.ts`、`cage.ts`、`config/probe.ts`、`providers/resolve.ts`、`daemon/index.ts`、`byoa.test.ts` | 代码直接事实；“潜在可达、当前 main API-only”由入口检索得出 |
| 确认环 | `approvals/confirmVocab.ts`、`live/confirm.ts`、`live/dialog.ts`、`live/voiceSessions.ts`、`approvals/presentation.ts`、相关测试源码、ASR 结果 JSON | 代码/文档直接事实；`可以？` 的 accept 是按源码正则做的只读复现 |
| 仓库状态 | `git -C SayDo status --short --branch` 输出 `## main...origin/main`；HEAD 为 `2292a37`；最近提交含 `4e97ae1`、`5769ae9`、`0111d5f` | 直接命令输出 |
| 限制 | canonical 根目录没有 `.git`；未运行项目测试。尝试 `pnpm exec tsx` 时返回 `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "tsx" not found` | 直接命令结果 |
| 推断项 | 崩溃窗口、未来执行器接入后的 BYOA/Run CAS 风险、确认答复污染下一轮 history、15 秒迟延 | 基于已读控制流的静态推断，未做 crash injection 或完整 E2E 运行 |
