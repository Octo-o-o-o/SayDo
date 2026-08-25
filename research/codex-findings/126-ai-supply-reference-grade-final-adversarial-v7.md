# SayDo AI Supply 参考实现级最终对抗复核 v7

**唯一结论：`FAIL`**

严重度计数：**A=7，B=0，C=0**。

## 输入完整性

- 完整读取范围：`1–12,330` 行。
- 初检与终检一致：
  - 行数：`12,330`
  - 字节数：`833,246`
  - SHA-256：`c0d36de218f4a6db475f000d09eb1fe5d26e57ebaab0f9224ce1bc05fb6b2b72`

## 发现

### F-01 [A] macOS 强锚依赖远程见证，但远程见证注册本身没有合法网络自举路径

- 精确行号：`L2198–2212`、`L2239–2303`、`L9508–9519`、`L10479`、`L11031`、`L11555`。
- 最短反例：fresh macOS 安装只有 `BootScopedEphemeralLocalAnchorReceipt`，其 `nonLoopbackNetworkCap` 为 `0`；macOS 唯一合格持久 backend 是 `remote_transparency_witness`。注册该 witness 必须完成远程 challenge/attestation，但任何网络首字节又必须先有 admission lease，相关 writer/lease 必须绑定 `SecurityMonotonicAnchorReceipt`，而该 anchor 又依赖尚未完成的 enrollment。结果形成“先联网注册 anchor，联网前先有 anchor”的生产者环。
- 为何现有合同/门禁不能阻断：安全门只能拒绝无锚网络或 witness mock；它不能从当前合同构造真实 enrollment。若遵守合同，macOS 永久只能匿名本机 `plain_dialog`；若绕过合同联网，则违反统一首字节不变量。Phase 8 的真实 producer/TCK 只会把该不可构造性变成永久红灯。
- 根因级最小修法：增加专用、单向的 `AnchorBootstrapCursor → Lease → SendIntent → Terminal → Enrollment` 状态机，仅允许由 release 内置 trust root 固定的 witness endpoint、TLS、请求体、字节/时间预算，禁止应用 secret、费用及任意重定向；允许 boot anchor 唯一执行该 operation。或者为 macOS 固化并实现可验证的本地 rollback-resistant backend。两种方案都必须进入 Phase 实施项和 bootstrap/recovery TCK。

### F-02 [A] hosted-tool 授权没有进入 durable pre-send 前驱，首字节可在线性化授权之前发出

- 精确行号：`L3360–3413`、`L3420–3501`、`L3765–3828`、`L5462–5508`、`L9085–9183`、`L9515`、`L10495`。
- 最短反例：构造带 hosted web search occurrence 的请求，依次提交 attempt intent、`PreparedAttemptDescriptorReceipt`、final physical lease 和 `PhysicalSendIntentReceipt`，但不生成任何 `HostedToolAuthorizationReceipt`。send intent 只引用 final lease和早期 descriptor，因此类型上仍可发送并产生费用、数据外发或 provider state effect。
- 为何现有合同/门禁不能阻断：两种 hosted-tool authorization 都反向引用 final physical lease，因而无法进入 final lease之前的 descriptor；send intent又没有 hosted authorization 或后置授权 bundle 字段。`exactOrderedSecurityReceiptSetDigest`不能引用尚未存在的 receipt，且 `L9515`明确禁止用裸 digest 代替可遍历边。`L9085–9183`的同名 `PreparedAttemptDescriptor`不是 `ReceiptRef`，同时包含 lease/auth digest，也没有被 send intent引用，不能形成 durable target-before-owner 证明。
- 根因级最小修法：新增 final lease之后、send intent之前的强类型 `PhysicalSendAuthorizationBundleReceipt`，无漏无重引用 final lease及全部 hosted-tool authorization；send intent必须消费该 bundle。真正授予发送权的对象应改为 bundle，原 physical lease只授予条件性发送权，并补“缺授权、错 occurrence、错 member、错 attempt、重复授权”负例。

### F-03 [A] local conformance 的 physical lease/compute descriptor 顺序在正文和 Phase gate 中互相矛盾

- 精确行号：`L3317–3375`、`L3445–3446`、`L9524`、`L10495`、`L11222`、`L11313`、`L11991`。
- 最短反例：首次连接本机 Ollama。类型要求 peer/compute closure 在 intent之后、final lease之前生成，descriptor包含该 closure，final conformance lease又强引用 descriptor；但 `L9524`和 Phase 4 验收 `L11313`要求先生成 physical lease，再生成 peer、LocalCompute和 isolation lease并放入 descriptor。
- 为何现有合同/门禁不能阻断：按 `L10495/L11222/L11991`实现会违反 Phase 4 明文验收；按 `L9524/L11313`实现则 final lease无法引用尚未存在的 descriptor/compute closure，并违反 target-before-owner。不存在同时满足两套顺序的 receipt DAG。
- 根因级最小修法：统一改为 `ready → no-send intent → held-socket peer → compute/isolation closure → descriptor → final physical lease → send intent`；删除所有“physical lease先生成”的文字，并让 Phase 3、Phase 4及 producer-DAG gate复用同一顺序常量和同一 mutation fixture。

### F-04 [A] ledger correction不会回写 persistent budget，迟到 usage 可突破用户总预算

- 精确行号：`L2940–3078`、`L4880–5035`、`L9517`、`L9527`、`L11226–11227`、`L11736–11737`。
- 最短反例：持久预算总额为10。调用A预留10，初始账本报告实际1；settlement释放9并产生余额9的 ready cursor。调用B立即消费这9。随后A的迟到 usage经 correction改为实际10。最终实际费用为19，但预算状态机仍认为两次调用均合法，没有任何 transition可以扣回差额、冻结预算或进入 deficit。
- 为何现有合同/门禁不能阻断：`PersistentBudgetChildSettlementReceipt`只读取结算当时的 ledger range并释放余额；ledger correction只推进独立的 `LedgerReportCursorReceipt`。两个状态机之间没有 correction-impact lease、CAS或 hard-stop generation边。现有两个 model gate只分别要求“结算不超当前余额”和“correction可重放”，没有覆盖“settle→再次授权→迟到上调”的交错。
- 根因级最小修法：只有取得提供方权威 finality 证明后才释放 unused reservation；否则保留最坏 hold。另增加按 policy/child绑定的 budget-correction事务，先冻结新 child lease，再原子应用 correction delta，余额不足时进入 `deficit_hard_stopped`并撤销相关 generation。补上述三步交错及多 child并发模型反例。

### F-05 [A] Execution turn 的 `delivery_unknown`仍会把 session恢复为 ready

- 精确行号：`L7328–7347`、`L7374–7383`、`L7713–7743`、`L9525`、`L11381`。
- 最短反例：物理 Execution 请求进入 `delivery_unknown`，随后构造 outcome同为 `delivery_unknown`的 `ExecutionTurnTerminalReceipt`。其基类固定写入 `resultingSessionCursorState: "ready"`；`ExecutionSessionReadyCursorReceipt`接受任意 turn terminal，下一份 `ExecutionTurnLeaseReceipt`即可从该 ready cursor取 lease。
- 为何现有合同/门禁不能阻断：类型直接允许“未知投递→ready→下一 turn”，与 `L9525`的“绝不恢复为ready”及 `L11381`的“只进入人工/权威调和”冲突。CAS只能防 sibling，不能阻止这条被类型认可的顺序路径。
- 根因级最小修法：把 turn terminal按 outcome判别：仅确定性可继续结果进入 `ready`；`delivery_unknown`进入专属 `reconciliation_required`或直接 terminal cursor。新的 turn lease必须排除该状态，session terminal或人工调和直接消费该非ready前驱。

### F-06 [A] session-start recovery 的 `still_unknown`一旦落盘便永久不可恢复

- 精确行号：`L7195–7266`、`L11375–11376`、`L11743`。
- 最短反例：remote session-create发生 `delivery_unknown`，第一次权威查询因控制面暂时不可用而提交 `still_unknown_hold_retained`。该分支写死 `retryPermitted: false`，同时 recovery receipt声明 `subjectScopedSingleSuccessorCasCommitted: true`。之后即使远端恢复并能证明 session存在或不存在，也不能再提交 adopted、absent或closed-orphan successor。
- 为何现有合同/门禁不能阻断：没有 recovery cursor、next revision或session-start人工调和收据；唯一 recovery successor已被 `still_unknown`消费。现有 TCK要求四个结果严格相交，却未要求 unknown之后可再次查询并最终收口，因此可以把永久 hold/孤儿状态验成“合法 unknown”。
- 根因级最小修法：改为独立 recovery 状态机：`recovery_ready → query_in_flight → adopted/absent/closed terminal`，临时 unknown则携带backoff返回新的 `recovery_ready`，始终保留原 stable identity和费用hold；另设有本地单次决定的人工处置终端，禁止重新执行原 start。

### F-07 [A] `completed_without_work`没有合法 ToolInvocation final transition，零工作工具无法回填结果

- 精确行号：`L7679–7697`、`L8118–8150`、`L8519–8534`、`L8594–8664`、`L11385`、`L11744`。
- 最短反例：已登记的只读或纯计算工具直接从缓存/本地确定性逻辑得到结果，无 external request、无 effect。它可以生成 `ExecutionToolZeroWorkTerminalReceipt{outcome:"completed_without_work"}`及 terminal tool cursor，但 transition union中：
  - `record_result`只允许 `executed → result_recorded`；
  - `executed`只能由要求 committed effect terminal的 `commit`产生；
  - abort只能得到 `aborted`。
  
  因而不存在可引用该零工作 terminal并携带结果的 `ToolInvocationFinalTransitionReceipt`，`ExecutionToolResultsAppliedReceipt`无法构造，整个 turn永久停在 awaiting-tool-results。
- 为何现有合同/门禁不能阻断：现有 gate只要求存在 zero-tool-work terminal和最终 transition接受 terminal cursor，没有要求 `completed_without_work`可达 `result_recorded`；类型本身缺少该边，测试无法通过实现细节补出合法 receipt。
- 根因级最小修法：增加严格的 `complete_without_external_work: executing → result_recorded`分支，强引用 `completed_without_work` terminal、result digest、零发送/零effect ledger closure；cancel/hard-stop/deadline零工作分支则只能进入 `aborted`。补纯工具、缓存结果及零工作取消三类端到端 fixture。

## 覆盖矩阵

| 攻击面 | 结果 | 对应发现 |
|---|---|---|
| receipt DAG可构造性、目标先提交、生产者环 | 失败 | F-01、F-02、F-03 |
| intent→descriptor→final lease→send intent顺序 | 失败 | F-02、F-03 |
| 首字节、权限、数据与副作用线性化 | 失败 | F-02 |
| 状态专属cursor、错误状态取lease/terminal | 失败 | F-05、F-06 |
| persistent budget、ledger correction与超额 | 失败 | F-04 |
| Execution recovery、delivery unknown、zero-work | 失败 | F-05、F-06、F-07 |
| macOS/API/OAuth/工具等主流全功能旅程 | 失败 | F-01 |
| OAuth refresh不确定态复用 | 未发现独立可复现缺口 | 当前类型将after-send/unknown导向access-only reauthorization |
| workload identity、metadata、local preload producer | 未发现除强锚自举外的独立缺口 | F-01覆盖共同持久authority前置条件 |
| custom/official unknown计量分流 | 未发现独立可复现缺口 | 两条分支在admission/report/funding中保持判别 |
| fallback越过未终结inner runtime | 未发现独立可复现缺口 | outer terminal强引用`RuntimeRouteSequenceTerminalReceipt` |
| staged/live错round与失败结果借用 | 未发现独立可复现缺口 | typed completion与同round terminal/report约束完整 |
| GA失败payload、自签、降级与release binding | 未发现独立可复现缺口 | pass/fail/incomplete及detached verifier链已判别 |
| 正文合同进入Phase gate | 失败 | F-03存在互相冲突的Phase验收；F-06/F-07的gate未覆盖后继可达性 |
| 性能、资源上限、供应链与扩展预算 | 未发现独立可复现缺口 | 数值profile与release qualification已有机械门 |