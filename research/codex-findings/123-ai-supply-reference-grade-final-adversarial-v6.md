# SayDo AI Supply 参考实现级最终对抗复核 v6

## 输入完整性

- 初检：8,219 行，638,999 bytes。
- 完整审阅范围：L1–L8219。
- 初检 SHA-256：`fc4454fc6ac05c545d90b0780a5298a16f0a021c5e972da1f4df3de460da4c0e`。
- 末检：8,219 行，638,999 bytes，SHA-256 未漂移。

## 严重度统计

| 严重度 | 数量 |
|---|---:|
| A | 8 |
| B | 3 |
| C | 0 |

## 发现

### F-01 — A — 首字节所依赖的 credential/local-compute 闭包没有进入持久 receipt DAG

- 精确行号：L1845–L1889、L2093–L2110、L2260–L2311、L5525–L5621、L5955、L5963、L6495。
- 最短反例：本地 conformance attempt 已生成 `ConformancePhysicalAttemptLeaseReceipt`，随后生成当前 `LocalComputeLeaseReceipt`。发送时 `PhysicalSendIntentReceipt`只引用前者及 request/wire digest，不引用 local-compute lease 或 `PreparedAttemptDescriptor`。省略该 lease，或换成相同请求字节下的旧 model-load/config lease，持久 receipt 图仍不变。
- 现有合同/门禁不能阻断：`PreparedAttemptDescriptor`不是 `ReceiptRef`，发送 intent 没有 descriptor ref/digest；edge manifest 因而无法遍历它。conformance physical lease又必须先于反向引用它的 compute/credential lease产生，不能靠自身 `securityReceiptClosureDigest`纳入后生对象而不形成摘要环。内存态 host 校验无法成为崩溃恢复和离线 verifier 的证据。
- 根因级最小修法：为 conformance 增加不具发送权的 attempt intent；credential、peer、compute、proxy-attestation随后引用该 intent；再生成带强类型引用的最终 send lease和 `PreparedAttemptDescriptorReceipt`，并让 `PhysicalSendIntentReceipt`强制引用该 descriptor。

### F-02 — A — ConformanceResult 可以脱离权威 success terminal 构造并进入激活链

- 精确行号：L2120–L2210、L3328–L3351、L3353–L3379、L3382–L3408、L5258、L7172–L7173。
- 最短反例：某 conformance physical lease最终得到 `non_retryable_failure` terminal；构造者仍可填写任意 `terminalEventDigest`、request/response evidence及非空 ledger refs，生成 `ConformanceResultReceipt`，再把它放入 staged/live completion。结果本身没有任何强类型 terminal 外键。
- 现有合同/门禁不能阻断：`terminalEventDigest`只是字符串，edge manifest不能验证目标 kind、同一 lease/cursor/revision或 `outcome=success`；`ConformanceJourneyCompletionReceipt`也没有 staged/live typed terminal，只保存结果、报告和一个证明字符串。未来测试若要拒绝该反例，必须自行发明当前合同不存在的关联规则。
- 根因级最小修法：在结果中加入 `physicalAttemptTerminal: Extract<PhysicalAttemptTerminalReceipt,{phase:"conformance";outcome:"success"}>`；completion显式引用两个 round terminal，并逐字段验证 lease、cursor、round、request、ledger range和结果一致。

### F-03 — A — 一次两轮 conformance 授权只签收了一个 round 的披露

- 精确行号：L1586–L1615、L1688–L1706、L2778–L2800、L2901–L2917、L6495–L6496。
- 最短反例：proposal和最终授权包含 `[staged, live]`两个 `ConformanceAuthorizedRound`，但唯一 `AuthorizationDisclosureReceipt.round`选择 `staged`，唯一 `UserDecisionReceipt`只签这份披露；live预算随后仍由同一授权消费。
- 现有合同/门禁不能阻断：priced authorization和unknown-metering consent都只有一个 `authorizationDisclosure`字段，类型中不存在第二份披露或“该披露精确覆盖两个 round”的结构。选择 `live`只会反过来让 staged未披露。
- 根因级最小修法：把 conformance disclosure改成严格双分支 tuple，分别携带 staged/live的IR、序列、请求、token和逐单位额度；一次 user decision签整个 tuple及总上限，authorization要求双分支无漏无重相等。

### F-04 — A — official unknown-metering 在结果闭包处退化为 custom/generic，正式路径不可构造或可换挂

- 精确行号：L1251–L1268、L2731–L2776、L3115–L3126、L3353–L3379、L5258、L5981。
- 最短反例：官方企业 endpoint具备 `OfficialEnterpriseUnknownMeteringRightsReceipt`，但价格和hard cap不可权威读取。到 `ExternallyMeteredOperationClosureReceipt`时只有 `customRights: ReceiptRef`；使用custom rights会换挂权益，使用official rights又丢失类型判别并与字段及L5258的“custom candidate”要求冲突。
- 现有合同/门禁不能阻断：candidate层区分custom/official，result和operation closure却合并为一个 `externally_metered_unknown`分支并使用通用引用；这与L5981要求的candidate/conformance/runtime/report全链判别直接矛盾。
- 根因级最小修法：把 consent、operation closure、result和runtime funding全部拆成 `custom_unknown | official_unknown`严格联合；每支使用对应的typed rights、candidate billing、endpoint、principal和policy binding，删除 `customRights: ReceiptRef`及其他通用外键。

### F-05 — A — credentialed metadata 成功路径允许零 terminal ledger和无权威 ledger range

- 精确行号：L6142–L6177、L6193–L6208、L6220–L6253、L6480、L7272。
- 最短反例：选择 `user_initiated_established_binding_metadata`并提供非空 reservation；随后构造 `outcome:"succeeded"`且 `ledgerTerminalRefs:[]`，最终 `MetadataProbeResultReceipt`省略 `authoritativeLedgerRange`。全部字段形状仍合法。
- 现有合同/门禁不能阻断：成功 terminal没有按 admission kind区分，ledger refs允许任意长度；result中的ledger range是全局可选。L6480和Phase gate虽要求连续账本，但没有可供schema或edge verifier执行的判别联合。
- 根因级最小修法：将 terminal/result按 `automatic_zero_cost | established_credentialed | bootstrap_credentialed`判别；后两支成功、after-send和delivery-unknown均要求与reservation逐项对应的非空terminal refs及强制权威ledger range，自动零费用支才允许空集合。

### F-06 — A — Execution session 的 spawn/connect 副作用没有 durable intent、terminal和恢复结算

- 精确行号：L4278–L4339、L4341–L4382、L5950、L5964、L7318–L7320、L7913。
- 最短反例：远程或本地付费Agent取得 `ExecutionSessionAdmissionReceipt`并完成spawn/connect/session-create；进程在生成 `ExecutionSessionLeaseReceipt`前崩溃。恢复后无法判定session是否已创建、费用是否可能发生、进程是否为orphan；重试可能创建第二个session。
- 现有合同/门禁不能阻断：admission虽然标记 `singleUse`，但没有session-start cursor、commit token、effect intent、send/process intent或失败/delivery-unknown terminal。现有session cursor只在session lease已经存在后才出现。
- 根因级最小修法：增加 `ExecutionSessionStartCursor → StartLease → StartIntent → StartTerminal`；terminal严格表达not-started、started、delivery-unknown、cancel/hard-stop，并结算session-start ledger。`ExecutionSessionLeaseReceipt`只能由成功terminal产生，恢复必须按稳定session/process identity调和或清理。

### F-07 — A — Execution tool 可以遗漏子调用并在无外部terminal时宣称副作用已提交

- 精确行号：L4499–L4512、L4571–L4599、L4768–L4784、L4903–L4989、L5096–L5110、L5967、L7323–L7326。
- 最短反例：模型响应登记工具调用A和B，只为A创建 `ToolInvocationReceipt`；再为A的external side effect构造 `ExecutionToolEffectTerminalReceipt(outcome="committed")`，省略可选的 `externalRequestTerminal`。`ExecutionToolResultsAppliedReceipt.completedToolTerminals=[A]`后即可推进，turn terminal再填写 `provesAllChildCursorsTerminal:true`。
- 现有合同/门禁不能阻断：physical terminal没有权威、可枚举的expected tool-call set；results-applied只要求任意非空完成集合。effect terminal也未按commit lease的local/external effect class判别，外部terminal为可选。遗漏B不会产生缺失edge，布尔“证明”也不可重算。
- 根因级最小修法：由physical terminal生成强类型 `RegisteredToolInvocationSetReceipt`；每个tool invocation与该集合一一对应，results-applied要求精确集合覆盖。effect terminal按local/external严格联合，external分支强制引用同一request terminal、账务terminal和commit lease，并成为唯一cursor successor。

### F-08 — A — 全局承诺的terminal代数未在各层闭合，deadline及OAuth失败路径无真实终态

- 精确行号：L667–L790、L1090–L1184、L2174–L2195、L2213–L2227、L3969–L4034、L4499–L4558、L4903–L4964、L5847、L5959。
- 最短反例：runtime physical attempt在首字节前命中deadline，可合法生成 `deadline_before_send` physical terminal；但 `RuntimeRouteSequenceTerminalReceipt.outcome`没有 `deadline`，外层fallback terminal也没有该分支。只能伪报cancel/exhausted或让cursor无法收口。
- 同根症状：Execution physical/tool terminal缺deadline；OAuth flow-start、callback及OpenRouter browser/callback只定义成功receipt，没有launch失败、用户取消、listener expiry或callback timeout terminal，in-flight cursor无法按合同恢复到ready或terminal。
- 现有合同/门禁不能阻断：L5959明确要求以独立 `deadline`关闭，但下游枚举不存在对应值，也没有规范化映射。OAuth gate覆盖成功、防劫持和重放，却没有可构造的负向terminal类型。
- 根因级最小修法：定义共享、严格判别的terminal reason/transport/billing三轴及每层无损fold；补齐deadline、cancelled-after-send、expired和delivery-unknown。OAuth/OpenRouter为start、callback和等待阶段增加writer-fenced负向terminal及明确的retry/close edge。

### F-09 — B — LocalPreload 的“single-use、全局并发1”没有可线性化状态机

- 精确行号：L2403–L2444、L5265、L5839、L7240、L7253。
- 最短反例：两个daemon同时读取同一 `LocalPreloadAuthorizationReceipt(singleUse=true)`，各自按grant时的available memory启动同一模型加载；两次都没有需要竞争的writer epoch/cursor revision/commit token，可共同突破全局并发1和内存上限。
- 现有合同/门禁不能阻断：authorization没有writer lease、epoch、not-after、preload ordinal或消费terminal；result也不是判别联合，甚至 `terminal:"loaded"`时 `loadedArtifactDigest`仍可省略。预算算术测试不能替代跨进程消费CAS。
- 根因级最小修法：增加全局preload balance/cursor和per-preload lease、effect intent、terminal；在同一writer epoch原子预留内存及全局slot，所有退出路径释放。loaded分支强制artifact identity，其他分支禁止携带loaded evidence。

### F-10 — B — Plugin资源预算存在两套冲突口径，且单实例限制没有机器对象

- 精确行号：L5840–L5841、L6021–L6042、L6981、L7478。
- 最短反例：某publisher在t=0附近连续崩溃3次，t=5分30秒再次崩溃。L5840的“5分钟最多3次”允许第4次重启；`maxRestartsPerPublisherPerHour:3`要求拒绝。
- 现有合同/门禁不能阻断：`HostWorkerBudgetProfileV1`只编码宿主聚合值，缺少单plugin的RSS 256 MiB、CPU 1核、进程树2、双向队列各4 MiB、prepared attempt 16和5分钟窗口；甚至全局CPU 2核也未进入对象。L6981又规定全部数值只能来自唯一机器对象，Phase 8清单仍只枚举全局值，无法确定应执行哪一套。
- 根因级最小修法：新增release-fixed `PluginWorkerBudgetProfileV1`，编码全部单实例值和明确的restart sliding-window；`HostWorkerBudgetProfileV1`补齐全局CPU等字段。删除L5840的第二套literal，snapshot、sandbox、TCK和报告只引用两份profile digest。

### F-11 — B — GA journey/gate信任边仍是通用引用，无法生成唯一机械验收合同

- 精确行号：L5893–L5942、L6392–L6445、L6486、L6962、L7182、L7486。
- 最短反例：构造 `GaJourneyRunPayloadV1(outcome="completed_fail")`，外层仍填写 `gateOutcome:"completed_pass"`；`reportAttestation`、entry级 `gateReport`和 `gateAttestation`均可指向任意 `ReceiptRef`。
- 现有合同/门禁不能阻断：正文要求拒绝非pass和不受信报告，但没有定义 `GaJourneyGateReportReceipt`、`GaJourneyGateAttestationReceipt`或它们的issuer/repository/workflow/builder/payload subject字段。现有 `ConformanceAttestation`和`ReleaseConformanceBinding`又不是 `ReceiptRef`类型，无法直接成为L5955所要求的精确edge target。实现方必须自行发明包装、target kind和信任fold。
- 根因级最小修法：定义receipt化、判别明确的journey report、gate report和attestation；release evidence的payload使用 `Extract<...,{outcome:"completed_pass"}>`，gate report强制绑定其digest、完整fixture、当前distribution和verifier policy，entry gate由这些typed refs确定性fold，不接受通用ref或可填写的pass布尔。

## 覆盖矩阵

| 覆盖面 | 结果 | 对应发现 |
|---|---|---|
| Receipt DAG、producer顺序、首字节闭包 | 阻断 | F-01、F-02 |
| Cursor、lease、terminal、崩溃恢复 | 阻断 | F-06、F-08、F-09 |
| 网络、凭据、数据边界与secret读取顺序 | 阻断 | F-01、F-04 |
| 费用授权、账务连续性与hold释放 | 阻断 | F-03、F-05、F-06、F-07、F-08 |
| OAuth、OpenRouter、workload identity、metadata producer | 阻断 | F-01、F-05、F-08 |
| Custom与official unknown-metering | 阻断 | F-04 |
| Retry、fallback顺序与预算终态 | 阻断 | F-08 |
| Execution session、physical request与tool effect-once | 阻断 | F-06、F-07、F-08 |
| 本地runtime、preload、资源恢复 | 阻断 | F-01、F-09、F-10 |
| 性能、背压与故障隔离机器门 | 阻断 | F-10 |
| GA自证、借报告与当前distribution绑定 | 阻断 | F-11 |
| 主流API/CLI/订阅旅程 | 阻断于状态合同；未发现独立的额外配置猜测缺口 | F-03、F-04、F-08 |
| 扩展与供应链边界 | 资源及release信任门仍不闭合；未发现其他独立A/B | F-10、F-11 |
| 正文合同进入Phase gate | 多处清单声明无法从现有类型机械生成 | F-01、F-02、F-03、F-05、F-10、F-11 |

## 唯一结论

**FAIL**

A=8、B=3、C=0；存在费用、数据、外部副作用、合同不可构造及核心旅程终态缺口，不满足参考实现级合同的通过条件。