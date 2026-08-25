# AI supply 参考架构闭包终审 v3

VERDICT: FAIL

## 审阅证据

- 开始 SHA-256：`a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453`
- 结束 SHA-256：`a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453`
- 实际读取范围：唯一评审对象 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md` 第 1–4379 行，全文通读；未读取既往评审报告，未编辑文件。

## A

### A1. OAuth 的发送前授权与 refresh/exchange 链仍不可构造

位置：252–330、2113、2720、3374、3486。

最小反例：

1. `OAuthFlowAuthorizationReceipt` 在发起 PKCE authorization request 前没有冻结 `redirectUri/state/codeChallenge/verifierHandle`；这些字段直到响应后的 `OAuthPkceGrantReceipt` 才出现。因此浏览器首个授权字节并未被当前 flow receipt 绑定。
2. 两个并发 device poll 都可引用相同 `predecessorExchangeLease` 和 `expectedFlowRevision`。文档没有定义带 `revision/nextOrdinal/lastLease/terminal` 的 durable exchange cursor；单个 lease 的 `singleUse` 不能阻止 sibling。
3. `exchangeKind="refresh"` 不引用被刷新的 grant、refresh-token credential source/version/subject，也没有 refresh result receipt。不同账号的 refresh token可被换挂到同一 client/issuer flow，或严格 verifier 只能永久拒绝 refresh。

现有条款为何挡不住：2113/2720 只声明 CAS、scope/aud/azp 和 replay 应被拒绝；`expectedFlowRevision` 没有可引用的 revision-bearing 状态，且初始 grant 两个分支都无法表达 refresh successor。

最小修订：增加 PKCE/device 判别型 flow-start receipt；PKCE 分支在打开浏览器前冻结 redirect/state/challenge/verifier handle，device 分支冻结初始 authorization request。再增加 `OAuthExchangeCursorReceipt`，把 cursor successor、lease、sent 和敏感 egress 同事务提交；新增 refresh receipt，精确引用 predecessor grant、输入 refresh credential source/version/subject、输出 token version、scope/aud/azp。

### A2. local-device 的每物理请求证明在 conformance 与最终发送描述符上断链

位置：562–575、699–804、2123、2383–2401、2713、3549、3566。

最小反例：Bearer 本地端点由进程 P 通过首测前的 `LocalInferencePeerReceipt/LocalComputeEvidenceReceipt`，随后 P 重载模型或端口被 Q 接管。Conformance physical lease 没有 current peer/local-compute lease；现有 `LocalInferencePeerLeaseReceipt` 和 `LocalComputeLeaseReceipt` 又强制引用 runtime fence/upstream lease，无法用于 conformance。运行时虽然可生成 `LocalComputeLeaseReceipt`，但 `PreparedAttemptDescriptor` 只携带 peer lease，没有 local-compute lease。发送器仍可拿到结构合法的 descriptor，而无法机械证明当前 config、model-load generation、artifact file identity、route→artifact、device 和 egress。

现有条款为何挡不住：2123/2713/3566 明文要求真实自检和所有物理请求都具备两份 lease，但当前引用拓扑无法为 conformance 构造它们，且 descriptor 形状与“二者都进入 PreparedAttemptDescriptor”直接冲突。

最小修订：为 conformance/runtime 定义共同的物理请求主体，或分别定义两套 local peer/compute lease；两者都绑定准确 physical lease。`PreparedAttemptDescriptor` 必须强制携带 `localComputeLeaseDigest`，并验证其 peer、endpoint、attempt、generation 与 upstream/conformance lease 全部相等；broker 只能消费这个完整 descriptor 后读 secret。

### A3. Execution 的 credential/no-secret activation 不是判别联合

位置：1678–1708、2078–2099、2297、2714–2715。

最小反例：无 connector secret 的 `app_server_stdio` 或纯本地 `cli_stdio`。规范要求它提供 `noConnectorSecretProof`，但 `ExecutionActivationManifest.credentialEgressDecisions` 同时强制为非空。严格实现要么无法激活合法 stdio surface，要么必须伪造一个不存在 endpoint/secret 的 egress receipt。反向路径中，HTTP surface 还可因 `secretBrokerAclSet` 和 `noConnectorSecretProof` 都是 optional 而形成“二者皆无/二者并存”的形状。

现有条款为何挡不住：2715 给出了互斥语义，但 manifest 和 session admission 没有相同的判别型结构，无法由 schema 证明完整 component/ACL 分支与 no-secret 分支互斥且完备。

最小修订：将 Execution credential 状态改成严格联合：

- `connector_credentials`：非空 component、逐 component egress、ACL 与 complete-set digest；
- `no_connector_secret`：空 component set 加具名 proof。

按 surface/auth refinement 强制恰好一个分支，并让 session admission 引用同一完整 receipt，而非若干 optional digest。

### A4. Execution 的 no-new-spend 证明只能引用 inference 合同

位置：1211–1221、1659–1676、1789–1804、1833–1853、2130。

最小反例：订阅内的 Execution `session_start` 需要 `no_new_spend`。两种 Execution spend decision 都只保存泛型 `proof: ReceiptRef`；唯一已定义的 `NoNewSpendProofReceipt` 却绑定 `InferenceOperation`、`bindingIdentityDigest` 和 inference compute admission。若 verifier 接受它，普通 chat/local proof 可换挂给远程 Agent session；若遵守 receipt-kind 精确校验，则合法 Execution no-spend session 无法构造。owned-capacity 分支若要求 session 后的 compute lease，还会与 pre-spawn admission 形成 producer 环。

现有条款为何挡不住：`proofClass` 是调用方自报字符串，不是 subject-bound proof；`ExecutionFundingPolicyTemplateReceipt` 也没有对应证明类型。

最小修订：新增 `ExecutionNoNewSpendProofReceipt`，绑定 session-admission subject、surface、准确 `ExecutionOperation`、funding template、principal、hard-stop generation，并判别为精确 subscription hard cap 或可在 spawn 前取得的 owned-capacity admission。禁止引用 inference proof。

### A5. security extractor 的字段宇宙互不相容，无法保持 delegation 隔离

位置：421–444、2520–2526、2837、3468。

最小反例：`ExtractorPolicyReceipt<"processing_region">` 由 region delegation 签发，但 `SecurityAuthorityExtractionReceipt` 不允许 `processing_region`，只允许宽泛的 `data_boundary`；`billing_component` 和 `data_processor` 同样没有对应 authority field。实现若把 `data_boundary` 映射成多个字段，就可用一个 delegation 越权声明 processor 和 region；若要求字段精确相等，则云 DataBoundary/Billing 的权威 extraction 永远不可构造。

现有条款为何挡不住：2837 要求逐 field 不重叠 delegation，但两个判别联合连名称都无法一一相等，且没有规范化映射 receipt。

最小修订：所有 extractor policy、authority extraction、ConformanceResult 和 runtime verifier 使用同一个 closed field union；至少分别保留 model、route、usage、processing region、data processor、billing component、terminal。每份 authority receipt 精确引用同 field 的 policy，并加入跨 field/product/profile/raw-path 换挂负例。

## B

### B1. independent enforcement authority 缺少可机器验证的主体和逐 lease 绑定

位置：597–621、640–661、1558–1657、2709。

最小反例：为 gateway G1 签发的有效 authority policy/attestation 被挂到 G2 的 `enforcementByRoute`，或被挂到另一个 remote Agent。`RouteEnforcementAuthorityPolicyReceipt` 不绑定被保护的 endpoint、route、service principal 或 trust domain；runtime 的“fresh” attestation位于可复用 template，`RuntimeRouteFenceLease` 只有裸 `admissionTokenDigest`，没有指向本次 nonce/token/route 的 authority attestation。远程 Agent 的 attestation同样只是泛型 `ReceiptRef`。

现有条款为何挡不住：2709 的“不同信任域、不可绕过”是原则，但当前 receipt graph 无法证明 authority 与被保护主体不同，也无法证明本次 token 被该 authority 单次消费。

最小修订：定义 subject-bound `EnforcementAuthorityAttestationReceipt`，绑定 authority/subject trust domain、endpoint或service principal、route、policy、measurement、nonce、当前 lease/commit token、expiry 和 single-use。Template 只保存 policy；fresh attestation 必须进入每次 runtime/session/physical lease。

### B2. 同名 `wire-budget-v1` 存在互斥数值

位置：2602、2705、2730–2748、3307、3328、3436、3779。

最小反例：单 event JSON 有 50,001 nodes。2602 的 `WireBudgetProfile v1` 要求拒绝，2739 的同名 `WireBudgetProfileV1` 允许到 200,000。类似冲突还包括 properties 16,384/50,000、events 16,384/100,000、occurrences 4,096/8,192、schema nodes 10,000/100,000；旧节还有新 interface 未表达的 header、压缩比、buffer、schema depth/ref 等上限。

现有条款为何挡不住：4.16 虽称规范性闭包，但3307又要求数值“以 §4.13/§4.16 为准”；N-1/N/N+1 TCK无法得到唯一预期。

最小修订：只保留一份完整 profile；删除或明确 supersede 2602 的数值。若新上限确需改变，使用 `wire-budget-v2`，不得让同一 profile digest改变语义。

### B3. 付费生成型 `health_probe` 没有 operation 合同

位置：217、591、625、1097、1184–1196、1330–1334、1388–1413、2839、3469、3515。

最小反例：half-open breaker 需要一次可能计费的生成 probe。规范要求 `operation=health_probe` 的 Rights/DataBoundary/Funding/reservation/physical lease，但 `InferenceOperation` 只有 `chat | tool_roundtrip | evaluate`；PolicySubject、FundingPolicyTemplate、route fence 和 operation billing closure都引用该 closed union。`ApiBaseProfile` 的 `"health"` 只是路径种类，不能形成费用授权。

现有条款为何挡不住：不存在可被准确匹配的 health policy/funding subject；实现只能核心临时分支、错误复用 chat 授权，或永远走“下一次正常请求”退化路径。

最小修订：增加独立、不可进入普通槽位的 `health_probe` operation/profile及完整 candidate/runtime policy、funding和physical lease，或删除生成型自动 probe 分支并只允许正常授权请求携带 half-open token。

### B4. Phase 0/8 和 Definition Done 的评审门仍只阻断 A

位置：3345、3786、4175，与4379对照。

最小反例：实施后留下一个被独立评审定为 B 的关键不可判定性质。Phase 0、GA 与“定义完成”条款均只要求“无未处置 A”，因此所有书面门仍可通过并宣称交付；只有当前方案复审的4379临时要求无 A/B。

现有条款为何挡不住：当前一次性 closure 标准没有被继承到实施阶段和 GA 门。

最小修订：三处统一要求无未处置 A/B；若允许 owner 接受某项 B，必须生成具名 waiver，并自动撤销 reference-grade/GA 声明而不是仍算通过。

## C

无。
