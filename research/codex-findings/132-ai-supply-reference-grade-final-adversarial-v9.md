# SayDo AI Supply 参考实现级最终对抗复核 v9

## 输入完整性

首检与末检一致：

- 行数：16,355
- 字节数：1,025,192
- SHA-256：`ae6175a7195411f6878f4317ef4413f354df0763e3be6a80e7c54fc2c0c6980e`
- 输入漂移：无

## 发现汇总

| 严重度 | 数量 |
|---|---:|
| A | 13 |
| B | 3 |
| C | 0 |

## A 级发现

### A-01 Public SDK 的 prepared descriptor 与 final lease 构成摘要环

- 精确行号：L5722–5861、L6085–6125、L12574–12648、L15189。
- 最短反例：生产顺序要求先提交 descriptor `D`，再签 final lease `L`；但 public `PreparedAttemptDescriptor.attemptAuthorization` 又必填 `conformancePhysicalAttemptLeaseDigest` 或 `upstreamAttemptLeaseDigest`，即 `D` 需要 `digest(L)`，而 `L` 同时强引用 `D`。
- 现有合同为何不能阻断：receipt 类型采用正确的 `D → L` 单向关系，public SDK 同名对象却要求 `L → D`。当前没有独立的 post-lease envelope，因而无法同时满足 SDK、target-before-owner 和 L15189 的无环要求。
- 根因级最小修法：从 `PreparedAttemptDescriptor` 删除 `leaseDigest`、`conformancePhysicalAttemptLeaseDigest`、`upstreamAttemptLeaseDigest`；若发送器需要 final lease 上下文，新增位于 final lease 之后的 `AuthorizedSendEnvelope`，并加入实例 DAG 环检测。

### A-02 网络状态机没有统一闭合 lease 后、intent 前的状态

- 精确行号：L1287–1391、L2398–2434、L2972–3029、L5784–5857、L6085–6125、L6221–6279、L6773–6845、L9679–9794、L10341–10420、L11218–11280、L13075、L15697。
- 最短反例：
  1. API-key retirement lease 落盘后 DNS 失败、零字节发送；terminal 必填 `authoritativeProviderEvidence`，却没有 `failed_before_send` 分支，cursor 永久停在 in-flight。
  2. inference final lease 落盘后 hard-stop generation 增长、尚未生成 send intent；所有 physical terminal 都要求 send intent。签发新 intent 会违反撤销，拒绝签发则无法释放 cursor 和费用 hold。
  3. device-authorization request 已发出但响应前崩溃；start 链没有 durable send intent，恢复方仅凭 in-flight lease 无法区分未发送与可能已发送。
- 现有合同为何不能阻断：OAuth exchange/workload step 已有 `sendIntent?: never` 的零字节终态，但 device start、API-key query/revoke 以及多条 inference、preload、Execution 链没有采用同一状态模型；“before send”在部分链中实际仍要求已有 intent。
- 根因级最小修法：统一为 `ready → lease_in_flight → intent_committed → first_byte → terminal`，并为每条链增加从 `lease_in_flight` 出发的 `pre_intent_aborted/not_sent` terminal；API-key status、revoke 和 device authorization 各自使用独立物理请求联合，不能把 query/revoke 合并成一个摘要字段。

### A-03 独立执法与 LAN no-new-spend 权威仍可被裸 `ReceiptRef` 换挂

- 精确行号：L5333–5347、L5887–5946、L8073–8134、L13055–13056。
- 最短反例：把普通 funding/evidence receipt 填入 `PhysicalEnforcementDecisionReceipt.authorityAttestation`，或填入 LAN `authorityPolicy`/`independentAuthorityAttestation`，即可按现有结构声明 independent authority 或 no-third-party-charge。
- 现有合同为何不能阻断：虽然定义了 `RouteEnforcementAuthorityPolicyReceipt`、`EnforcementAuthorityAttestationReceipt` 和 `LanComputeAuthorityPolicyReceipt`，实际关键边仍降级为 `ReceiptRef`。目标文件没有给出这些字段的具体 edge-manifest target-kind 行，Phase 0 生成器无法从裸类型机械推出唯一目标和同值关系。
- 根因级最小修法：把所有 policy、attestation 和 LAN authority 字段改成具名强类型；显式固化 policy→attestation→attempt 的 trust domain、protected subject、nonce、commit token、generation、route/surface 同值边，并加入任意 receipt、自签 authority、跨域换挂负例。

### A-04 Workload/IMDSv2 physical step 缺少 `(issuance, ordinal)` 的 lease 级唯一 CAS

- 精确行号：L651–724、L725–794、L13078、L15067。
- 最短反例：两个 daemon 对同一 issuance 同时生成两个 ordinal 1 的 `aws_imds_v2_token_put` lease；每张 lease 都是各自 `singleUse`，随后均可生成 intent 并向 IMDS 发送。
- 现有合同为何不能阻断：lease 没有 keyed step cursor、predecessor revision 或 `subjectScopedSingleSuccessorCasCommitted`；terminal 的 CAS 发生在两个 intent 已可能发送之后。`singleUse` 只能防止同一张 lease 重用，不能排除 sibling lease。
- 根因级最小修法：增加以 `(issuanceRequestLease digest, physicalStepOrdinal)` 分区的 `step_ready → step_in_flight → terminal` cursor；lease 创建时完成唯一 successor CAS，第二步只能消费第一步的准确 success cursor。

### A-05 Persistent correction 没有当前 child escrow/finality cursor，可重复消费或在释放后复用 escrow

- 精确行号：L4699–4770、L5061–5179、L5182–5295、L13068。
- 最短反例：保留 correction escrow 10，第一次 correction 增加 8，impact 产出 remaining 2；第二张 lease 再引用原始 provisional apply，并再次声明 retained 10、delta 8，累计增加 16。
- 现有合同为何不能阻断：后继 correction lease 不引用前一 impact 或当前 child settlement cursor；`remainingCorrectionEscrowBillingVectorDigest` 只存在于 impact，下一 lease 可以重新引用旧 provisional apply。相同缺口还允许 correction-horizon 已关闭、unused reservation 已释放并移除 outstanding child 后，再使用旧 provisional apply 申请 correction。breach 联合也没有“bounded horizon closed 后上调”分支。
- 根因级最小修法：建立逐 child 的 correction/finality cursor；首次 correction 消费 `nonfinal_hold_retained` 状态，后续 correction 必须消费上一 impact 的 remaining escrow；finalization 与 correction 原子竞争同一 child cursor，并加入累计超限及 horizon-closed late correction breach。

### A-06 Hosted side-effect authorization 缺少逐 occurrence Gate 前驱

- 精确行号：L7918–7998、L12729、L13064、L15116–15129。
- 最短反例：构造 `effectClass: "external_side_effect"` 的 `HostedToolAuthorizationReceipt`，加入 final authorization bundle 后发送；provider 可执行外部副作用，但链上不存在绑定该 occurrence 的 Gate decision 或 pre-effect callback。
- 现有合同为何不能阻断：policy、conformance authorization、runtime authorization 和 bundle 都允许 `provider_state_write | external_side_effect`，但没有 Gate consumption 字段；这与 L12729“无法逐次 Gate 则首字节前拒绝”直接冲突。
- 根因级最小修法：把 hosted authorization 拆成 read-only 与 side-effect 判别联合；side-effect 分支必须强引用本 occurrence 的 accepted Gate consumption 和不可绕过的 pre-effect callback authority，否则该分支为 `never`。

### A-07 Fallback 的完整四槽 solution 仅为 opaque digest，可跨方案、跨槽拼接

- 精确行号：L9045–9060、L9085–9097、L9170–9188、L12868、L13063、L15221。
- 最短反例：attempt 使用方案 A 的 `fullSupplySolutionDigest`、方案 B 的 `fundingDecision`、方案 C 的 route fence/policy refs；所有组成件各自有效，但不属于同一四槽方案。
- 现有合同为何不能阻断：目标中没有可遍历的 `SupplySolutionReceipt`；alternative 使用未分槽的 ref 数组和字符串 digest，admission 的 funding decisions 同样未按 solution/slot 键控，attempt 最终只靠生产者布尔值声称组合正确。
- 根因级最小修法：定义恰好包含 dialog/thinking/cheap/evaluator 四槽的 canonical `SupplySolutionReceipt`；每槽绑定 binding、funding、rights、data、fence 和 evaluator independence。admission 与 attempt 只能引用所选 alternative 的具名槽，并加入 cross-solution/cross-slot mutation。

### A-08 Restart barrier 不能证明旧进程终止，也未绑定 live 实际 compute process

- 精确行号：L5524–5598、L5703–5709、L15188–15190。
- 最短反例：不终止旧进程，填入任意 `oldProcessTerminationEvidenceDigest` 和新 loaded digest，提交 `restarted_and_loaded`；live attempt 再把 compute closure 的 `runtimeProcessAndGenerationDigest` 指向旧进程。
- 现有合同为何不能阻断：termination、loaded process 和 barrier 都是不可遍历字符串；`ConformanceRoundRestartBinding` 仅带生产者布尔证明，未把 loaded PID-start/artifact/snapshot/config generation 与 live compute closure 建立强类型同值边。
- 根因级最小修法：定义 typed old-process termination 与 loaded-process receipts，绑定 PID-start、artifact file identity、snapshot、distribution 和 config generation；live descriptor/compute closure 必须逐字段等于 loaded receipt，且新旧进程身份必须按策略不等。

### A-09 Execution stable external identity 没有全局生命周期 fence

- 精确行号：L9679–9794、L9809–10000、L10528–10547、L10670–10736、L10758–10831、L13066。
- 最短反例：start identity `X` 进入 `delivery_unknown`，operator 选择永久封锁并保留 hold；随后新建 admission/start cursor，再签发 identity 仍为 `X` 的 StartLease。
- 现有合同为何不能阻断：永久封锁只存在于旧 recovery receipt 的布尔字段或裸 block receipt；StartLease 不消费按 endpoint/surface+stable identity 分区的全局 cursor。`session_closed_before_request` 还可从零请求 terminal 直接声明，权威关闭仅表现为后续裸 `ReceiptRef`，没有 close delivery-unknown/hold 状态机。
- 根因级最小修法：新增全局 identity lifecycle cursor，所有 start/adopt/query/close/block 操作都消费它；typed close 链必须区分 not-sent、confirmed-closed、delivery-unknown，只有权威关闭或不存在才能释放 fence，永久 block 的 identity 永不可再次取 lease。

### A-10 `hard_stopped` 可折回 session ready，甚至最终改写成 completed

- 精确行号：L10068–10087、L10203–10222、L10563–10612、L10778–10795、L13066。
- 最短反例：physical request terminal 为 `hard_stopped_after_send`；构造 TurnTerminal `outcome:"completed"` 或 `"hard_stopped"`，两者均允许 `resultingSessionCursorState:"ready"`；随后 Ready cursor 签发新 turn，SessionTerminal 最终选择 `completed`。
- 现有合同为何不能阻断：physical→turn→session 之间只有 `terminalReasonFoldDigest` 和生产者布尔，没有判别型映射；TurnLease 本身也没有独立 hard-stop generation 字段。
- 根因级最小修法：建立封闭的 physical→request→turn→session outcome fold；任何 hard-stop 必须生成 closing/terminal cursor并使相关 generation 失效，禁止 ready/completed 分支，补对应不可赋值断言和实例 mutation。

### A-11 Execution 本地 effect 与人工 committed-result 均缺少权威结果来源

- 精确行号：L11412–11458、L11653–11670、L11714、L11745–11758、L11824–11839、L12250–12256。
- 最短反例：
  1. 对同一 local transaction，把任意 receipt 填入 `localTransactionTerminal`，任选 `committed` 或 `not_committed`。
  2. owner 只确认 `effect_committed`，该 decision 明确禁止 `resultDigest`；随后普通 `record_result` 可填任意摘要并完成 tool。
- 现有合同为何不能阻断：没有 typed local transaction terminal；人工 committed 决定也未提供结果。最终路径仅用布尔值声称 effect evidence 与新增 result 相等，且 L12250–12256 明确要求这条无结果来源的路径可达。
- 根因级最小修法：引入绑定 transaction ID、mutation digest、commit token 和 durable store outcome 的本地 transaction terminal；`effect_committed` 只能停在 `executed`，进入 `result_recorded` 必须另行消费包含准确 result digest 的权威 result evidence 或 `result_recorded` 人工决定。

### A-12 Conformance core 缺少强类型 semantic subject，可跨 plane/product/endpoint 拼接

- 精确行号：L12930–12989、L14338–14360。
- 最短反例：构造 capability core，保留通过的模型 fixture/result digest，却把 `protocolId`、wire profile 或 connector digest 换成 Execution ACP 实现或另一 provider endpoint；当前 capability 分支没有 `plane` 或具名 implementation/endpoint/model subject ref。
- 现有合同为何不能阻断：`ConformanceResultCore` 只由彼此独立的字符串组成；现有断言仅验证四个分支非 `never` 以及禁止少数异类字段，未证明 protocol implementation、plane、provider product、endpoint、model、SUT artifact 是同一个 canonical semantic subject。
- 根因级最小修法：定义判别型 `ConformanceSemanticSubjectReceipt`；protocol 分 inference/execution，capability 仅接受 inference implementation+endpoint+model subject，execution 使用独立 surface subject。报告、runner SUT、registry implementation 和 release binding 必须强引用同一 subject，并加入跨 plane/product/endpoint 换挂负例。

### A-13 GA gate 可用自写的 blocked、advanced 和宽松 UX 计划获得 pass

- 精确行号：L13585–13688、L13733–13752、L13906–13916、L14038–14068、L14131–14155、L14378–14404、L14451、L15014。
- 最短反例：required journey 设置 `journeyTier:"advanced"`、expected connection/solution readiness 均为 `blocked`，并把 Base URL、protocol、手填字段和动作上限设为任意大值；actual 与该自写计划相等，即可构造 `completed_pass` 及后续 run/entry/ecosystem gate。
- 现有合同为何不能阻断：pass mapped type遍历全部 readiness 值，只校验 expected=actual；profile/baseline仅保存 journey 自身的 `plannedUxMetricsDigest`，没有独立规范上限，也没有禁止 required journey 使用 `advanced`。现有负例只拒绝 readiness mismatch，不拒绝 expected blocked，与 L14451、L15014 的文字要求冲突。
- 根因级最小修法：定义 release-pass 专用 positive readiness 子集和 `GaRequiredJourneyDefinition`；required 主流 journey 禁止 `advanced`，按 journey class 在 `ReferenceGradeProfileV2` 中固化独立 UX 数值上限。blocked/action-required 场景应使用独立负向 fixture report，不能进入 release-pass payload。

## B 级发现

### B-01 Fresh witness 前置旅程没有计入首次 onboarding 的总动作预算

- 精确行号：L57、L3351–3374、L3480–3500、L13598–13688、L13848–13858、L14442–14459、L15639–15640。
- 最短反例：fresh macOS、无硬件 anchor 的 payg 用户必须先批准 remote witness，再处理凭据、conformance 成本和 runtime 预算，至少形成四个独立 SayDo 决定；公开上限仍为三个。
- 现有合同为何不能阻断：anchor 被建模为独立 `control.anchor-witness` journey；provider journey subject/metrics 没有 starting anchor state、prerequisite digest 或跨 journey action fold，因此可从“anchor 已 ready”开始单独报三步并假绿。
- 根因级最小修法：增加 `startingAnchorState` 和组合 onboarding journey；fresh-HOME 门禁必须从无 persistent anchor 一直计数到 `conversation_ready`，跨 control/provider journey 汇总动作、外部任务和恢复事件。

### B-02 Publisher 最低公平保证与 host 总容量不可同时满足

- 精确行号：L13124–13158、L14409–14431。
- 最短反例：四个健康 publisher 各要求至少一个 worker slot，已占满 `maxParserWorkers:4`；同一规范又要求 core detector 保留 50% worker slots。四个 publisher 各 250 permille 的最低 dispatch share 也已合计 100%，未给 core 留出份额。
- 现有合同为何不能阻断：machine profile 没有 core/plugin 分池、core reserve 字段、share denominator 或享受最低保证的 publisher 上限；现有 ContractAssert 也未校验 250 permille 与 core reserve 的可满足性。
- 根因级最小修法：明确拆分 core/plugin worker 和 queue pool，固化 share basis、eligible publisher 上限、core reserve 及超额 admission 规则；增加 `coreReserve + ΣminimumShare <= capacity` 和 N=1…4 的调度可满足性模型。

### B-03 `ReceiptRef` canonical 字段名自相矛盾

- 精确行号：L285–292、L13056。
- 最短反例：schema/JCS 按 `dependencyDomainDigest` 序列化，edge verifier 按规范文字读取 `dependencyDomain`；同一引用产生不同 canonical tuple，或 verifier 找不到字段。
- 现有合同为何不能阻断：目标文本没有字段别名、迁移规则或唯一命名裁决，而 L13056 明确把另一名称列为 canonical 固定字段。
- 根因级最小修法：统一唯一字段名并拒绝另一名称；增加 exact-key、未知键拒绝及跨 serializer/verifier 的 JCS digest fixture。

## 覆盖矩阵

| 复核主题 | 覆盖结论 |
|---|---|
| receipt 不可构造、必填 `never`、摘要环 | A-01 |
| cursor 取 lease/terminal、single-successor | A-02、A-04、A-09、A-10 |
| no-authority lease、conditional lease、descriptor、hosted bundle 顺序 | A-01、A-03、A-06 |
| 首字节、effect、账务线性化 | A-02、A-05、A-11 |
| 权限、凭据、网络、费用、数据、产品换挂 | A-03、A-06、A-07、A-12 |
| workload metadata 与 IMDSv2 | A-04 |
| OAuth access-only、device pending、refresh/API-key unknown | access-only/pending/refresh 联合未形成独立发现；device start 与 API-key query/revoke 由 A-02 阻断 |
| fresh witness bootstrap 与共享动作预算 | B-01 |
| persistent correction escrow、physical/outstanding 守恒 | A-05 |
| fallback inner→outer 与完整 solution 映射 | inner→outer outcome fold本身闭合；跨 solution/slot 映射由 A-07 阻断 |
| staged→restart→loaded generation→live | A-08 |
| Execution local effect、manual result、turn unknown、remote closed | A-09、A-10、A-11 |
| conformance semantic subject | A-12 |
| GA maturity/readiness/UX exact gate | A-13 |
| publisher 公平与 Phase 0 语义门 | B-02、B-03；A-01、A-03、A-12、A-13 证明拟议语义门当前覆盖不足 |
| 主流 API/CLI/订阅/本地 runtime 是否仍需猜配置 | A-13、B-01；现有 GA 允许 advanced/自写宽松手填上限 |

## 唯一结论

[fail] **FAIL**

当前文本存在 **13 个 A 级、3 个 B 级、0 个 C 级**发现，包含不可构造的 descriptor 顺序、可绕过或无法恢复的网络/effect/费用状态、可重复消费的预算 escrow、缺失的 session identity fence，以及可自写 blocked/advanced/宽松 UX 后通过的 GA gate。该方案尚不能作为一次到位、可机械验证的顶级开源参考实现合同。