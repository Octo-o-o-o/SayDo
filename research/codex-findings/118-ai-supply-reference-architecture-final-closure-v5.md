VERDICT: FAIL
START_SHA256: 37f8d831088c8613ef5d91c6ad8d40d73e6d63b2797cf662e26ea3bba60034ff
END_SHA256: 37f8d831088c8613ef5d91c6ad8d40d73e6d63b2797cf662e26ea3bba60034ff
START_BYTES: 552023
END_BYTES: 552023
READ_RANGE: 1–6580
FULL_READ: 是；从第一行到最后一行完整通读，输出截断处均另行补读
READ_SCOPE: 先完整读取 prompts/118-ai-supply-reference-architecture-final-closure-v5.md；之后仅读取目标文档。未读取旧报告、过程日志、代码或其他仓库文件，未联网，未编辑文件
A_COUNT: 7
B_COUNT: 7
C_COUNT: 1

## A

### A-1 本机/LAN `no_new_spend` 收据形成摘要环

- 位置：§4.2 `RuntimeUpstreamAttemptLeaseReceipt`、`InferenceFundingDecisionReceipt`、`NoNewSpendProofReceipt`、`LocalComputeLeaseReceipt`、`LanComputeLeaseReceipt`；§4.6。
- 最小反例：本机 owned-capacity 调用需要 `RuntimeUpstreamAttemptLease.fundingDecision → NoNewSpendProof.currentComputeAdmissionLease`；当前物理 `LocalComputeLease` 又通过 `physicalAttempt.runtimeUpstreamAttemptLease` 指回该 attempt lease。LAN 分支同样如此。没有任何一个对象可以先取得最终 digest。
- 现有条款为何挡不住：§4.2 与 §4.6 明确要求 `currentComputeAdmissionLease` 是“本物理请求”的 local/LAN lease，因而不能解释成早先的静态 capacity policy。后置 `PreparedAttemptDescriptor` 只是再次聚合两者，不能消除反向边。
- 最小修订：拆出不具发送权的 `RuntimeAttemptIntentLease`。先生成 intent，再生成绑定 intent 的 peer/local-or-LAN compute lease与 funding decision，最后生成同时引用二者、原子消费 cursor commit token 的 `RuntimeUpstreamSendLease`；或让 `NoNewSpendProof` 只引用静态 owned-capacity authority，并把当前 compute lease移到最终 send lease，保持严格单向 DAG。

### A-2 `ToolInvocationReceipt` 与工具 cursor 直接互相引用

- 位置：§4.2 `ToolInvocationReceipt.externalRequestCursor` 与 `ExecutionToolRequestCursorReceipt.toolInvocation`。
- 最小反例：创建第一个工具调用时，工具 receipt 的 digest 需要 cursor digest；初始 cursor 的 digest又需要该工具 receipt digest。即使预分配 ID，也无法计算两个互含 digest 的不可变对象。
- 现有条款为何挡不住：append-only、CAS、稳定 logical ID 与 replay lineage 都发生在这两个对象可构造之后，不能解决初始摘要环。
- 最小修订：先生成不含 cursor 的 `ToolInvocationAuthorizationReceipt` 或 `ToolInvocationCoreReceipt`；初始 cursor单向引用该 core。最终聚合状态可再引用 core 与 cursor head，但 core不得反向引用 cursor。

### A-3 fallback 可在内层 runtime sequence 尚未 terminal 时启动下一 solution

- 位置：§4.2 `PhysicalAttemptTerminalReceipt`、`FallbackSolutionTerminalReceipt`、`FallbackSequenceCursorReceipt`；§4.16.1。
- 最小反例：solution A 的某个 physical attempt 返回 `retryable_failure`。该 terminal 明确 `closesCursor:false`，内层 `RuntimeRouteSequenceCursor` 仍允许 successor；外层却可立即用同一 terminal 构造 `FallbackSolutionTerminalReceipt.outcome=retryable_failure` 并启动 solution B。A 的 successor 与 B 可并发发送，造成重复费用或重复结果。
- 现有条款为何挡不住：fallback terminal只保存 `lastPhysicalAttemptTerminal`，没有内层 route-sequence terminal、最终 cursor revision或“序列已耗尽/已关闭”证明。文字上的“上一 solution 权威 terminal”没有可消费的强类型对象。
- 最小修订：新增 `RuntimeRouteSequenceTerminalReceipt`，绑定完整实际序列、最终 cursor revision、全部 physical terminal与账本范围。fallback terminal只能消费该 sequence terminal；内层关闭和外层推进须在同一 writer epoch下原子完成。

### A-4 priced conformance 授权没有绑定实际发送的 request

- 位置：§4.2 `ConformanceSpendAuthorizationReceipt`、`ConformancePhysicalAttemptLeaseReceipt`、`PreparedAttemptDescriptor`；对照 `ConformanceExternallyMeteredUnknownConsentReceipt.exactPreparedRequestDigest`。
- 最小反例：用户批准固定端点、模型、token和金额上限的普通 priced 自检。sender把预期合成 fixture 换成同尺寸的用户对话内容；endpoint、attempt subject、预算、route fence均不变。physical lease没有 canonical IR、prepared request、adaptation plan或 wire digest，descriptor中的 `requestDigest`也没有事前锚点，仍可通过。
- 现有条款为何挡不住：`ConformanceResult.requestEvidenceDigest` 在发送后产生，只能记录已经泄露的请求；request-profile digest只约束公开 header/path，不约束 body。只有 custom unknown 分支显式绑定 exact request，priced 分支没有等价约束。
- 最小修订：每个 round/ordinal 的授权子项和 physical lease都必须绑定 canonical conformance IR、fixture/no-user-content证明、AdaptationPlan、prepared/wire request digest及 hosted-tool occurrence集合；descriptor在 secret read和首字节前逐项相等验证。

### A-5 workload-identity credential issuance 缺少发送前 lease 与 sent terminal

- 位置：§4.2 `WorkloadIdentityCredentialLeaseReceipt`、`WorkloadIdentityProfileReceipt`；§4.10.2 AuthStrategy。
- 最小反例：AWS STS、Google token endpoint或 Azure metadata/token 请求已发送并返回临时凭据，daemon在持久化 receipt前崩溃。恢复后可再次发送；两个 daemon或旧 epoch也没有 issuance cursor阻止 sibling。该请求可能携带签名、assertion或源凭据。
- 现有条款为何挡不住：所谓 credential lease包含 `temporaryCredentialVersion`、`resultingSubject` 和 `notAfter` 等响应后字段，却没有 writer lease/epoch、predecessor cursor、commit token、严格 EndpointCredentialEgress ref、sent state或 issuance terminal。`allowedTokenOrStsEndpointDigests` 和事后 digest不能充当首字节授权。
- 最小修订：建立 `WorkloadIdentityIssuanceCursor → IssuanceRequestLease → IssuanceTerminal → CredentialTransition/Commit` 单向链；request lease事前绑定 endpoint、method/path/body、所有 credential component、egress/ACL、writer epoch和 commit token，成功 terminal之后才能生成临时 credential lease。

### A-6 Execution 工具的真实外部副作用请求可绕过 effect commit lease

- 位置：§4.2 `ExecutionToolExternalRequestLeaseReceipt`、`ExecutorCommitLeaseReceipt`、`ExecutionToolRequestCursorReceipt`、`ToolInvocationTransitionReceipt`。
- 最小反例：一个工具以外部 POST 完成不可逆写入。`ExecutionToolExternalRequestLeaseReceipt`足以描述并发送 endpoint/body，但不要求 `ExecutorCommitLeaseReceipt`；后者也不绑定 externalRequestId、endpoint或prepared body。远端提交后崩溃，cursor没有 effect terminal，恢复可再次发出相同写入。
- 现有条款为何挡不住：cursor虽有 `nextEffectOrdinal/effect_in_flight`，却没有 `lastEffectLease/lastEffectTerminal`；`transition=commit`也不引用或推进该 cursor。文字要求“副作用紧前取 lease”无法在 sender合同中机械验证。
- 最小修订：外部请求 lease增加严格分支：`read_only` 必须引用无副作用证明；`side_effect` 必须引用绑定同一 externalRequestId/endpoint/body/effectOrdinal 的 commit lease。新增 effect terminal，并在同一 cursor CAS中原子推进 effect ordinal、transition revision和费用 terminal。

### A-7 独立 proxy 远端解析只有策略布尔值，没有逐 attempt 证明

- 位置：§4.2 `ProxyResolutionAuthorityReceipt`、`TransportHop`；§4.10.2 `PreparedAttemptDescriptor`；§4.16.2。
- 最小反例：SOCKS/CONNECT proxy使用 `independent_proxy_resolution_authority`，随后把批准的 hostname解析到未批准的内网/metadata地址或另一个有效证书终点。静态 policy中只有 `requiresPerAttemptAttestation:true`，实际 descriptor没有本次解析地址、nonce、attempt、commit token或 attestation ref，仍可发送。
- 现有条款为何挡不住：`ProxyResolutionAuthorityReceipt`进入静态 TransportSecurityProfile；若把它本身当逐请求对象，每次 digest变化又会改变 endpoint identity并触发 hard stop。文档没有另一个可在发送现场生成并绑定的 attestation 类型。
- 最小修订：新增 `ProxyResolutionAttemptAttestationReceipt`，绑定 proxy、请求 hostname/port、实际 resolved socket set、authority policy/generation、attempt、writer epoch、nonce、commit token和短 expiry，并纳入 PreparedAttemptDescriptor；缺该证明时禁止 remote DNS。

## B

### B-1 staged/live 两轮没有可遍历的完成闭包

- 位置：§4.2 `ConformanceSpendAuthorizationReceipt.authorizedRounds`、`ConformancePhysicalAttemptLeaseReceipt`、`ConformanceResultReceipt`、`CapabilityReceipt`、`InferenceActivationManifest`；§4.16.6。
- 最小反例：只执行 staged 并成功，即用这一份 physical lease生成 ConformanceResult、Capability与 Activation。现有类型均可满足；live lease也没有强类型 staged-success predecessor。
- 现有条款为何挡不住：授权虽列出两份子预算，但 ConformanceResult只绑定一个 physical attempt，manifest只要求非空 result列表，没有精确 staged/live tuple、顺序或完成收据。
- 最小修订：新增 `ConformanceJourneyCompletionReceipt`，精确绑定同一 journey/authorization下 staged success、后继 live success、两份 ledger range/report与总预算 fold；Capability、Binding和Activation必须引用该 completion，不能引用孤立 round result。

### B-2 dynamic RouteSet 的 conformance authorization 仍是单 subject/单 policy/单 fence 形状

- 位置：§4.2 `ConformanceSpendAuthorizationReceipt`、`ConformanceRouteSetReceipt`；§4.6。
- 最小反例：gateway可能按 A→B 执行。authorization只有一个 `attemptSubjectDigest`、`candidatePolicyBinding` 和 `candidateRouteFence`。B 要么错误复用 A 的 policy/fence，要么另建一份授权，从而失去一次用户决定下的 A+B 聚合预算与完整序列。
- 现有条款为何挡不住：`authorizedAttemptOrdinalsDigest` 和 terminal graph digest只是不可遍历摘要，未引用 RouteSet、InvocationEnvelope或逐 member typed closure；正文要求的 dynamic 分支未进入联合类型。
- 最小修订：把授权改为 `fixed | route_set` 严格联合。route-set分支保存完整 RouteSet/InvocationEnvelope、按 ordinal 的 subject/policy/fence/billing/data closure、每轮子预算及逐单位 aggregate vector；physical lease必须选择并逐项匹配一个登记 member。

### B-3 PKCE 没有 authorization callback/result receipt

- 位置：§4.2 `OAuthPkceBrowserLaunchReceipt`、`OAuthAuthorizationCodeExchangeLeaseReceipt`、`OAuthPkceGrantReceipt`；§4.16.2。
- 最小反例：并发两个本地 flow，callback收到 code和错误/缺失 state。exchange lease只携带 code digest与原 flow state，没有一份由 callback listener产生、证明返回 state、local session、redirect、issuer和code handle已原子匹配并消费的 receipt。
- 现有条款为何挡不住：browser-launch receipt只证明启动浏览器；grant再次复制预期 state，不证明回调实际返回并核验了同一 state。内部临时表无法让后续 receipt verifier独立复核。
- 最小修订：新增 writer-fenced `OAuthAuthorizationResponseReceipt`/cursor terminal，绑定 flow start terminal、listener admission、原始回调证据、返回 state/issuer/code handle和单次消费；code-exchange lease必须引用它。

### B-4 OAuth access/refresh 生命周期与 endpoint hard-stop 语义冲突

- 位置：§4.2 `OAuthCredentialTransitionReceipt`、三种 `OAuthGrantReceipt`、`EndpointIdentityBase.secretVersion`；§4.8。
- 最小反例：access token一小时过期、refresh token三十天有效。一小时后，若 predecessor grant/flow的单一 `expiresAt`被 temporal fold判过期，合法 refresh不可构造；若把它延到三十天，又无法判定旧 access token已失效。refresh产生新 secretVersion后，§4.8要求 endpoint identity hard stop和重新自检，导致正常 OAuth轮换每小时重建整套能力闭包。
- 现有条款为何挡不住：没有独立的 access-not-after、refresh-not-after/revocation状态和 per-send access credential lease；“secret version变化即 endpoint hard stop”未区分静态 key换主与同一 OAuth family的正常轮换。
- 最小修订：引入稳定 `OAuthCredentialFamilyReceipt` 与逐请求 `OAuthAccessCredentialLeaseReceipt`，分别记录 access/refresh期限和 revocation generation。Activation绑定 family/subject/scope/audience；每个 physical send绑定当前 access version。仅 subject/scope/issuer/audience/family变化才要求完整 hard stop。

### B-5 Execution request cursor 无法安全表达多 turn/tool-loop

- 位置：§4.2 `ExecutionRequestSequenceCursorReceipt`、`ExecutionPhysicalRequestTerminalReceipt`；§4.16.1。
- 最小反例：turn 0首个模型请求成功并返回 tool call。success terminal规定 `closesCursor:true`，cursor进入 terminal；同一 turn工具结果后的第二次模型请求或 turn 1没有定义的合法 successor。若实现自行把 terminal重置为 ready，又绕过“success原子关闭”约束。
- 现有条款为何挡不住：cursor同时保存 `nextTurnOrdinal` 和 session级 aggregate cap，却没有 turn terminal、session-ready successor或分层 cursor；正文也只允许失败边恢复 ready。
- 最小修订：拆 `ExecutionSessionCursor`、`ExecutionTurnCursor` 与 turn内 physical-request cursor。physical success只关闭当前 request序列；具名 `ExecutionTurnTerminal`原子推进 session cursor到下一 turn，最终 session terminal另行关闭。

### B-6 credentialed metadata probe 没有 durable send/terminal链

- 位置：§4.16.3 `MetadataProbeAdmissionReceipt`；§4.16.4。
- 最小反例：用户批准带 API key、mTLS或付费风险的 metadata请求；请求已发送，daemon在写 ledger sent前崩溃。receipt只有 `singleUse:true` 和 `requiresSentAndTerminalLedgerFold:true`，没有 cursor、physicalAttemptId、commit token、sent/terminal refs，恢复无法判定是否可重发。
- 现有条款为何挡不住：布尔声明不是实际 ledger fold；writer lease只能排除旧 writer，不能证明同一 writer没有 sibling，也不能提供发送后的权威 terminal。
- 最小修订：让 credentialed metadata复用标准 runtime physical cursor/lease/terminal，或定义独立 `MetadataProbeCursor → PhysicalLease → Sent/BillingTerminal`，并让结果/report引用连续 authoritative ledger range。

### B-7 GA journey 没有强类型可验报告

- 位置：§4.15 `ConformanceResultCore.reportKind`；§4.16.3 `GaJourneyReleaseEvidenceV1`；§9.9、§12.1。
- 最小反例：`ux_locales_platforms` 或 guided OAuth journey需要证明动作数、外部任务、MFA、离开/返回、app/raw时间、locale、a11y和readiness结果。但 report kind只有 protocol/capability/discovery/execution，`GaJourneyReleaseEvidence.reportPayload`只是通用 `ReceiptRef`，任意通过的协议报告可被挂成旅程证据。
- 现有条款为何挡不住：matrix equality只能验证 journey key；没有可遍历的 journey payload kind与字段，外层 `gateOutcome="completed_pass"`仍是无法重算的结论。
- 最小修订：增加严格 `journey` report或独立 `GaJourneyRunPayload`，绑定 distribution、entry/journey/auth profile、平台/locale、动作与外部任务计数、时间、恢复、readiness/a11y结果及完整 fixture集合；GA verifier按 journey tier执行字段和上限判定。

## C

### C-1 evidence temp 与 potential-orphan 的共同上限没有进入机器 profile

- 位置：§4.16.3 `EvidenceStoreBudgetProfileV1`；§17.5 第五次回修说明。
- 最小反例：同时占用 128 MiB aggregate temporary bytes和128 MiB potential orphan bytes，两个独立字段都不超限，却违反正文所称二者共同受128 MiB原子 admission上限。
- 现有条款为何挡不住：机器对象只有两个各自为128 MiB的上限，没有 combined字段或固定求和算法；不同实现可分别解释为128 MiB或256 MiB。
- 最小修订：增加 `maxCombinedTemporaryAndPotentialOrphanBytes: 134_217_728`，并明确 admission不等式、reservation释放与恢复时的计数口径及 N-1/N/N+1 fixture。

VERDICT: FAIL
