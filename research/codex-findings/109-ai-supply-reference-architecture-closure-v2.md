# AI 供给参考架构闭包复审 v2

VERDICT: FAIL

开始 SHA-256：`7bfe7457b88bf909d9a9d85e4a0f2e0668675aa4bd38e4d8c421ef20645fb576`，与期望值一致。

结束 SHA-256：`7bfe7457b88bf909d9a9d85e4a0f2e0668675aa4bd38e4d8c421ef20645fb576`，与期望值一致。

复审全程只读，未修改目标文件。

## A

### A-1：Hosted tool 的 conformance 收据存在 producer 环

准确位置：

- §4.2 第 886–922 行：`HostedToolAuthorizationReceipt` 必须引用 `FundingPolicyTemplateReceipt`、`FundingDecision` 和 `RuntimeRouteFenceLeaseReceipt`。
- §4.2 第 924–957 行：`ConformanceResultReceipt` 又要求保存 `hostedToolAuthorizations`。
- §4.2 第 1607、1618 行及 §4.6 第 1743–1746 行：`RuntimeRouteFenceTemplate`、`FundingPolicyTemplate` 明确在 `ConformanceResult → Capability/Binding` 之后生成。
- §4.11 第 1947 行、Phase 2 第 2741、2754 行要求 hosted tool 获得逐 occurrence 的真实授权和 conformance 覆盖。

可复现反例：

1. 对支持收费 web search 的精确 provider/model 做首次 conformance。
2. 本次 conformance 必须在发送前授权该 hosted tool，并把授权写入 `ConformanceResultReceipt.hostedToolAuthorizations`。
3. 唯一定义的 `HostedToolAuthorizationReceipt` 需要 runtime funding template 和 runtime route fence lease。
4. 两者只有在该 `ConformanceResult` 生成 Capability/Binding 后才能生成。

因此形成：

`ConformanceResult → Capability/Binding → RuntimeRouteFence/FundingTemplate → HostedToolAuthorization → ConformanceResult`

现有条款为什么挡不住：

- 把 `hostedToolAuthorizations` 留空只能避开循环，不能证明精确 subject 上的 hosted-tool capability，也不满足文档要求的真实逐 occurrence conformance。
- `ConformanceAuthorization` 只覆盖候选 inference request、Candidate policy 和费用，没有 candidate 阶段的 hosted-tool authorization。
- runtime authorization 不能反向充当首测授权。

最小修订：

- 新增独立的 `ConformanceHostedToolAuthorizationReceipt`，只引用首测前已有的 `ConformanceAttemptSubject`、CandidateRouteFence、ConformanceAuthorization attempt、candidate Rights/DataBoundary/Billing、occurrence、调用上限、逐 component reservation、hard-stop generation 和 expiry。
- `ConformanceResult` 只能引用该 candidate 类型；runtime `HostedToolAuthorizationReceipt` 保持在 Binding/FundingTemplate 之后生成。
- 加入可拓扑排序的 hosted-web-search 正向 DAG fixture，以及 candidate/runtime authorization 互换必红的负例。

### A-2：Execution `session_start` 的 Gate 和 funding 发生在真实 session 之后

准确位置：

- §4.2 第 1023–1033 行：`session_start` 是正式 `ExecutionOperation`。
- 第 1267–1285 行：`ExecutionSessionLeaseReceipt` 必须引用已经存在的真实 peer/process 和 `ExecutionRuntimeSandboxReceipt`。
- 第 1331–1351 行：所有 `ExecutionSpendDecisionReceipt` 又必须引用 `sessionLease`。
- 第 1624 行和 Phase 5 第 2925 行明确规定：先启动或连接真实 peer、形成 runtime sandbox，最后才生成 session lease。
- §4.12 第 2076 行却要求 Execution session 在 ingress transaction 中先完成 dispatch Gate 和 session funding reserve。

可复现反例：

远程 Agent 的 `create session` 会创建 provider state 或计费；或者本地 Agent 一经 spawn 就能发起初始化网络行为。严格按 producer 顺序，必须先创建/连接真实 session，才能得到 `ExecutionSessionLease`，之后才能构造 spend decision。这样 session-start 的费用或副作用发生在 Gate 0 和资金授权之前。若反过来要求先有 spend decision，又因缺少 session lease 而无法构造。

现有条款为什么挡不住：

- Activation 中的 `dispatchGate` 和 funding template 只是静态模板，不是绑定本次 session、可单次消费的 Gate/funding decision。
- `ExecutionSessionConsentReceipt` 可预先生成，但当前合同没有允许它直接授权 session-start 的发送、spawn 或 reserve。
- 后续 per-tool Gate 无法追回 session 创建阶段已经发生的费用或状态写入。

最小修订：

- 新增 pre-session `ExecutionSessionAdmissionReceipt`，绑定预分配 `sessionId`、ActivationManifest、`session_start` subject、peer/sandbox policy template、credential-egress、Gate 0 decision、funding template、consent/reservations、hard-stop generation 和 expiry。
- 在任何 spawn、远程 connect/create-session 字节或可计费初始化之前，原子持久化并消费 admission。
- `ExecutionSessionLeaseReceipt` 必须引用并完成该 admission，将实际 peer/runtime attestation 与预期闭包逐项对账；不符时中止并按是否已发送进入零发送或 `charge_unknown`。
- 后续 read/write/command/network operation 才引用最终 session lease。

### A-3：RouteSet 下 hosted-tool 授权可跨物理 member 换挂

准确位置：

- §4.2 第 473–481 行：实际物理 member 只在 `RuntimeUpstreamAttemptLeaseReceipt` 中确定。
- 第 866–910 行：`HostedToolPolicyTemplateReceipt` 和 `HostedToolAuthorizationReceipt` 没有绑定 upstream attempt lease、physical attempt、member ordinal、effective route 或 resource subject。
- §4.11 第 1947 行只要求绑定 ingress 级 `RuntimeRouteFenceLease`。
- Phase 2 第 2754 行只覆盖跨请求重放和 tool/profile 漂移，没有 RouteSet member 换挂负例。

可复现反例：

RouteSet 有 A、B 两个成员。A 的 hosted search 由处理方 X 处理、费用主体 X；B 由处理方 Y 处理并另行收费。Ingress 先生成引用 A Rights/DataBoundary/Billing 的 hosted-tool authorization；随后 A 发送前失败，或受支持的 gateway sequence 选择 B。B 的 child lease 和 A 的 hosted-tool authorization都引用同一个 ingress route-fence lease，因此现有类型允许把 A 的授权放入 B 的 PreparedAttemptDescriptor。查询会被 Y 处理并收费，但用户只授权了 X。

现有条款为什么挡不住：

- `policySubjectDigest` 没有与物理 child lease建立类型化相等关系。
- RouteSet 级 FundingDecision 覆盖完整成员集合，不等于某一份单值 Rights/DataBoundary receipt 对每个成员都有效。
- terminal 的 occurrence/count/component 对账只能证明“调用了几次”，不能证明调用发生在被授权的 member。
- `upstream_single_use_admission` 路径允许 gateway 在 ingress 后选择成员，更不能假设授权生成时已经知道实际 member。

最小修订：

- 把 hosted-tool authorization 改成 fixed/route-set 判别联合。
- fixed 分支绑定准确 `RuntimeUpstreamAttemptLeaseReceipt`、physical attempt、effective route、resource subject、ComputePolicyBinding 和 request/AdaptationPlan digest。
- route-set 分支要么在每个 child 确定后生成对应单值授权，要么预先冻结按 member ordinal 完整无漏的授权向量，并在 child CAS 时原子消费唯一对应项。
- PreparedAttemptDescriptor、terminal fold 和审计均验证 hosted-tool authorization 与 child lease逐项相等。
- 增加“A 失败、B 成功但携带 A 的 tool Rights/Data/Billing”负例。

### A-4：本地每请求 peer lease 没有证明当前 config 与实际 loaded compute

准确位置：

- §4.2 第 503–513 行：peer policy 包含 `allowedConfigProfileDigest`。
- 第 488–532 行：conformance peer 和 runtime peer lease只记录 `configGeneration`，没有实际 config profile digest。
- 第 557–569、610–616 行：loaded artifact、route→artifact 和 model identity 只存在于首测时的 `LocalComputeEvidenceReceipt`/`LocalModelIdentityBindingReceipt`。
- 第 444–448 行：runtime immutable-process fence同样只有 process identity 和 config generation。
- 第 1614–1618 行要求每物理请求只重新生成 peer lease；Phase 4 第 2874、2877–2882 行虽要求检测 artifact/config drift，但没有对应的每请求证明对象。

可复现反例：

1. 首测时同一进程 P、配置 C、模型别名 M 指向本地 artifact A，生成 local-device core。
2. 激活后保持 PID-start、binary、socket owner 和数值 `configGeneration=n` 不变，在进程内部把 M 改指 artifact B、cloud alias 或 LAN route；也可修改实际配置内容但不改变未定义来源的 generation。
3. 每请求 `LocalInferencePeerLeaseReceipt` 仍全部匹配，因为它不含 observed config digest、loaded artifact、model-load generation、route→artifact 或当前 compute-mode attestation。
4. 旧 Capability、ComputeBoundary 和 NoNewSpend/DataBoundary 闭包可继续用于实际 B/cloud 请求。

现有条款为什么挡不住：

- “变化后 hard stop”没有定义能在线性化首字节前观察该变化的 producer。
- 文件替换 watcher不能覆盖 runtime 内存路由、alias 更新、卸载后重载或上游内部状态。
- peer 身份只证明“仍是同一个服务进程”，不能证明“本次仍由同一模型 artifact 在同一设备计算”。
- `allowedConfigProfileDigest` 与 lease 中不存在的 actual config digest无法做相等校验。

最小修订：

- 新增每物理请求的 `LocalComputeLeaseReceipt`，或扩展 peer lease，使其绑定当前 child lease、observed config profile digest及其权威 generation、loaded artifact content/file identity、model-load generation、route→artifact/local-only attestation、compute device以及同一 process generation 的 network-egress assurance。
- 该证明必须在连接本次 socket后、首字节前原子取得；仅有 preflight 查询不合格。
- 无法提供原子 local-only/model binding 的 unmanaged runtime只能保持 inventory，或降级为不带本机计算、no-new-spend和隐私承诺的路径。
- 增加“同 PID、同 binary、同自报 generation，仅内部 alias/artifact/compute mode 改变”的负例。

## B

### B-1：`oauth_device` 被强塞进 PKCE authorization-code receipt，合同不可实现

准确位置：

- §4.2 第 231–267 行：`AuthSource` 同时声明 `oauth_pkce | oauth_device`，但唯一 `OAuthGrantReceipt` 强制要求 redirect URI、state、S256 challenge/verifier、authorization code。
- 第 1604 行又明确要求两者都引用该同一形状。
- Phase 1/3 只有 PKCE 并发、callback、code replay 测试，没有 device-flow producer 或 fixture。

可复现反例：

标准 device authorization flow 产生 device code、user code、verification URI、poll interval 和 token response；它通常没有 callback、state、authorization code或 PKCE verifier。严格 schema 无法为它生成 `OAuthGrantReceipt`；若填占位值，则 receipt 对错误 flow作出虚假证明；若 connector 自建旁路类型，则公共合同分叉。

现有条款为什么挡不住：

“同样绑定 issuer 和最终 subject”不能制造 device flow不存在的 PKCE字段，当前也没有判别型 refinement 或独立一次性消费状态机。

最小修订：

- 拆成 `OAuthPkceGrantReceipt | OAuthDeviceGrantReceipt`。
- device 分支绑定 device-authorization/token endpoint、device-code opaque handle/digest、user-code泄漏策略、verification URI、poll interval/expiry、issuer/audience/scopes、单 flow消费、最终 credential version与subject。
- 分别加入 issuer mix-up、device-code replay、过期后轮询、跨 connector token换挂和轮询节奏负例。
- 若本版不实现 device flow，删除 `oauth_device`，不要公开一个不可构造的分支。

### B-2：WireBudget 缺少整流累计结构和 bundled verifier 的宿主总预算

准确位置：

- §4.11 第 1982–2000 行：raw occurrence和 decoding coverage以数组形式保留。
- §4.13 第 2092 行：仅给出单 event nodes/properties、event 数、response bytes和单 event worker wall time；没有单流累计 JSON nodes/properties/raw occurrences/coverage entries/validation CPU。
- 第 2091 行的宿主 CPU/RSS/queue 总预算只针对第三方 code plugin。
- §12.1 同时要求 100 并发流 RSS 增量不超过 128 MiB。

可复现反例：

建立 100 个合法流，每流发送 16,384 个小事件；每个事件均低于 2 MiB、50,000 nodes和16,384 properties，总解压字节也低于64 MiB。事件包含大量短小字段，使 `RawResponseOccurrence[]` 和 `DecodingPlan.coverage[]` 持续扩张；或让每个事件刚过 worker阈值并合法消耗接近250 ms。所有现有单项限制均通过，但累计对象数、worker CPU和队列可耗尽宿主，明显突破RSS/event-loop SLO并拖慢其他 connector。

现有条款为什么挡不住：

- 字节上限不能约束解析后的对象放大。
- 单 event上限乘以16,384仍是巨量工作。
- per-connector bulkhead可通过多个 connector/principal并行放大。
- “per-plugin/global CPU”不覆盖进程内 bundled framing verifier和其 worker池。

最小修订：

- 在 `WireBudgetProfile v1` 加入每流累计 JSON nodes/properties、raw occurrence、coverage entry、规范化 IR event、验证 CPU与wall-time硬上限。
- 为所有 bundled/plugin decoder共用的 worker池定义宿主级并发、队列字节、CPU/RSS和公平 admission上限。
- raw coverage改用有界增量承诺或受控落盘，不能无界保留对象数组。
- Phase 2/8加入多 connector、100并发、合法小事件洪泛和累计结构临界值测试。

## C

无。
