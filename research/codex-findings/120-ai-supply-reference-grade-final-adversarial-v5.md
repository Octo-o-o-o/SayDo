VERDICT: FAIL
START_SHA256: 37f8d831088c8613ef5d91c6ad8d40d73e6d63b2797cf662e26ea3bba60034ff
END_SHA256: 37f8d831088c8613ef5d91c6ad8d40d73e6d63b2797cf662e26ea3bba60034ff
START_BYTES: 552023
END_BYTES: 552023
READ_LINE_RANGE: 1-6580
FULL_READ: YES，从第一行至最后一行完整通读
A_COUNT: 10
B_COUNT: 8
C_COUNT: 0

## A

### A1. `AuthorizationDisclosureReceipt` / `userDecisionDigest` 缺少可验证的事前同意链与本地控制面身份

- 最小反例：恶意网页、同 UID 进程或被劫持的本地 WebSocket 直接调用 daemon 的授权接口并提供任意 `userDecisionDigest`；或者 UI 展示 1 次请求/CNY 1，最终授权却写成 2 次/CNY 10，再事后生成引用该授权的 disclosure。
- 现有条款为何挡不住：`ConformanceSpendAuthorizationReceipt`、`RuntimeSpendAuthorizationReceipt`、Execution consent 只保存无类型的 digest；没有 `LocalControlSessionReceipt`、Origin/Host/CSRF/WebSocket-origin 校验、OS principal、动作 nonce。反过来，`AuthorizationDisclosureReceipt` 又引用已经包含用户决定的授权或 consent，只能证明“事后存在一份渲染”，不能证明用户决定前看到的就是该对象。
- 最小修订：建立不可变的 `AuthorizationProposalReceipt → AuthorizationDisclosureReceipt → UserDecisionReceipt → SpendAuthorization/Consent` 单向链；decision 精确绑定 proposal、渲染摘要、OS 用户、本地控制会话、Origin、一次性 nonce 和期限。所有费用、凭据、Gate、owner 决策 API 增加 local-CSRF/CWSH 负例。

### A2. custom unknown-metering conformance 无法生成规定的披露与实际发送报告

- 最小反例：精确 custom endpoint 通过 `ConformanceExternallyMeteredUnknownConsentReceipt` 发出 staged 请求并得到响应。
- 现有条款为何挡不住：`ConformanceAdmissionDecisionReceipt` 接受 unknown consent，但 `AuthorizationDisclosureReceipt` 的 conformance 分支只接受 `ConformanceSpendAuthorizationReceipt`；`ActualAttemptReportReceipt.reportKind="conformance"` 同样强制 `conformanceAuthorization`，没有 unknown 分支。该调用能进入 cursor/ConformanceResult，却无法形成 §4.16.6 强制的事前、事后证据闭包。
- 最小修订：让 disclosure 和 actual report 引用严格的 `ConformanceAdmissionDecisionReceipt` 判别联合；unknown 分支必须绑定 exact consent/request/cap/ledger range，禁止金额覆盖、`settled` 和 no-new-spend 声明。

### A3. `ToolInvocationReceipt` 与 `ExecutionToolRequestCursorReceipt` 构成不可构造的摘要环

- 最小反例：创建某工具第一次 invocation。
- 现有条款为何挡不住：L3578–3628 中 `ToolInvocationReceipt.externalRequestCursor` 为必填，而 cursor 又必填 `toolInvocation: ToolInvocationReceipt`。两者都是不可变、内容寻址 receipt；任何一个都要求先知道另一个的 digest，没有合法首个 producer。
- 最小修订：先创建不含 cursor 的 `ToolInvocationIntentReceipt/Core`，初始 cursor 单向引用它；若需要聚合对象，只能在 cursor terminal 后创建，或直接从 invocation 删除反向 cursor 引用。

### A4. Execution cursor 把“单次请求结束”错误地当成“整个 session/tool 结束”

- 最小反例一：`maxTurns=2` 的 session 第一轮物理请求成功；`ExecutionPhysicalRequestTerminalReceipt` 强制 `closesCursor:true`，第二轮没有合法 successor。
- 最小反例二：一个工具按文档要求执行两个顺序 HTTP 请求；第一个成功后 `ExecutionToolExternalRequestTerminalReceipt` 强制 `allowsNextOrdinal:false`。同时 cursor 虽有 `nextEffectOrdinal`，却没有 effect lease/terminal 的 `lastTransition` 可推进它。
- 现有条款为何挡不住：当前状态机混合了 session、turn、单次物理 attempt、tool workflow 和 retry 的终止语义，与 §4.16.1 所称的多 turn、多 external request/effect 相矛盾。
- 最小修订：拆分 session cursor、per-turn request cursor 和 per-tool child cursor；分别定义“关闭本 attempt”“继续预登记 workflow edge”“关闭整个 session/tool”，并为 external request 与 effect 各提供 lease、terminal 和 successor CAS。

### A5. 网络首字节与 durable `sent` 无法原子提交，合同却没有 `delivery_unknown`

- 最小反例：socket 已接受请求首字节后 daemon 崩溃，但 `PhysicalAttemptTerminalReceipt` 尚未持久化。
- 现有条款为何挡不住：terminal 只有 `not_sent|sent`。恢复时选 `not_sent` 会允许重复请求/重复费用，选 `sent` 会让“actual sent”报告失真；cursor 留在 `attempt_in_flight` 也没有规定的恢复 terminal。取消或 hard-stop 发生在 lease 后、首字节前时，同样没有能关闭 cursor 的 `cancelled_before_send` 分支，因为 `failed_before_send` 明确不关闭 cursor。
- 最小修订：发送前持久化 `send_intent`；增加 `delivery_unknown`、`cancelled_before_send`、`hard_stopped_before_send`、`deadline_before_send` terminal。崩溃后的 unknown 永不自动重试，除非存在端到端幂等键或权威送达查询；账本保留最坏 hold，报告区分 confirmed-sent 与 possibly-sent。

### A6. passive loopback peer 检查存在检查到连接之间的端口抢占窗口

- 最小反例：宿主从 socket table 观察到合法 Ollama PID，合法进程随即退出，恶意进程抢占 `127.0.0.1:11434`，宿主随后向恶意进程发送已登记 GET。
- 现有条款为何挡不住：`PassiveLoopbackPeerAdmissionReceipt` 明确是 `requestNotYetSent:true`，但不绑定实际 connected socket；没有连接后的 peer/PID/file-identity revalidation 或 challenge。因而 §4.16.4 要求的“端口抢占零 packet”无法由当前对象证明。
- 最小修订：先建立无应用字节的 socket，再对该 connected socket 取得 single-use peer lease并核对 PID-start、binary content/file identity、publisher，最后才发送 GET/HEAD；无法检查的平台保持零 packet。

### A7. PKCE 没有 callback-result producer，authorization code 可作为无来源 digest 注入

- 最小反例：浏览器启动后，错误或恶意本地调用直接给 exchange lease 填入任意 `authorizationCodeDigest`。
- 现有条款为何挡不住：`OAuthPkceBrowserLaunchReceipt` 是唯一 PKCE flow-start terminal；之后没有 receipt 记录实际 callback、state 比对、redirect listener、local session、code broker handle及一次消费。exchange lease直接接收 code digest。文中的“callback hijack 必须拒绝”没有机器可验证的前驱。
- 最小修订：新增 `OAuthAuthorizationCallbackReceipt`，由 durable callback cursor 单次产生，绑定准确 listener/redirect URI、local session、state、code broker handle、收到时间和 writer epoch；authorization-code exchange lease必须引用它而不能直接接受裸 code digest。

### A8. GA core 内嵌 owner decision receipt，批准对象缺少无自引用构造法

- 最小反例：owner 要批准完整 `GaMandatoryBaselineV1`。baseline 含 `baselineOwnerDecisionReceipt`；若 decision 签 baseline digest便形成 baseline→decision→baseline 摘要环，若不签该 digest则不能证明批准的是这份 baseline。entry/journey 的 `ownerDecisionReceipt` 同理。
- 现有条款为何挡不住：文档只对 report/evidence/release binding 做了 detached scope，却没有为 owner decision 定义排除 decision ref 的规范 proposal projection。
- 最小修订：matrix/baseline core 不嵌入 decision receipt；先对不含证明的 proposal core 取 digest，再生成 detached owner-decision attestation，最终由外层 release binding 无漏无重绑定 core 与全部 decisions。

### A9. writer epoch、时间及 anti-rollback 高水位没有不可回滚锚点

- 最小反例：恢复旧的 SQLite/HOME 快照，其中包含旧 active pointer、旧 writer epoch、未消费预算和旧时间/TUF 高水位；旧 daemon据此重新签发 lease并重复消费预算。
- 现有条款为何挡不住：§4.9 指定 SQLite 为 receipt、pointer、journal SoT；`ReferenceMonitorWriterLeaseReceipt.storageAuthorityIdentityDigest` 只是身份摘要，没有独立于可回滚快照的单调状态或见证。`persistedHighWatermarkUtc` 和 TUF anti-rollback watermark 同样没有规定不可回滚存储。
- 最小修订：定义独立 `SecurityMonotonicAnchor`，使用 OS 保护的非回滚计数器、硬件/远程见证或等价机制；检测不到连续性时撤销全部 spend/OAuth/effect/send lease并要求重新授权，禁止从恢复快照继续消费。

### A10. Execution tool 的真实外部请求没有 endpoint 级权限、数据与凭据闭包

- 最小反例：用户批准向 endpoint A 发送工具请求；Agent 随后请求为 endpoint B 签发 `ExecutionToolExternalRequestLeaseReceipt`，仍复用相同 tool consent 和 funding decision。
- 现有条款为何挡不住：该 lease记录 endpoint/body/funding/reservation，但不引用准确的 `ExecutionNetworkAdmissionReceipt`、`ExecutionRightsGrantReceipt`、`ExecutionDataBoundaryReceipt`、transport/credential-egress/ACL 或 temporal closure；session 级 egress-set digest不能证明本请求与用户披露的 processor、凭据接收者和 body 相等。
- 最小修订：增加 `ExecutionToolExternalRequestPolicyBindingReceipt`，精确绑定 endpoint、transport path、credential components、rights、data processor/region、billing components、prepared body、tool consent和当前 generation；lease、descriptor、terminal和实际报告必须引用同一 binding。

## B

### B1. protocol TCK 的判别值不一致

- 最小反例：构造 inference `ProtocolImplementationReceipt`。
- 现有条款为何挡不住：它要求 `protocolTckReportKind:"protocol_inference"`；execution 要求 `"protocol_execution"`，但 `ConformanceResultCore.reportKind` 只允许 `"protocol"|"capability"|"discovery"|"execution"`。文档没有定义可机器验证的映射。
- 最小修订：统一为一个严格联合，例如 `reportKind:"protocol", plane:"inference"|"execution"`，或在 core 中正式增加相同判别值并同步所有 verifier/TCK。

### B2. TUF lineage 的具体合同仍不是“完整逐级 lineage”

- 最小反例：target 经 `targets → team-a → provider-x` 两级 delegation 授权，随后父 role 改 key/path/terminating 条件。
- 现有条款为何挡不住：`ExtractorPolicyReceipt` 只有一个 `tufDelegatedRole/version/digest/threshold`，缺顶层 targets 以及有序父子 delegation 链、key IDs、path/hash-prefix、terminating/order 约束；其他 Rights/Billing/Data/credential-egress receipt 更只有 evidence digest。无法仅从 receipt重放父 role撤销和 mix-and-match。
- 最小修订：定义可复用的 `TufTargetAuthorizationReceipt`，保存从 root/top-level targets 到最终 role 的有序完整步骤；所有由 `policy.tuf` 派生的安全 receipt 强制引用它。

### B3. 首次 credentialed metadata 请求没有独立 bootstrap admission

- 最小反例：用户填入 API key后，需要在 conformance/binding形成前调用账号识别或 `/models`。
- 现有条款为何挡不住：`MetadataProbeAdmissionReceipt.kind="user_initiated_credentialed_metadata"` 强制引用 `InferenceFundingDecisionReceipt`，而该对象依赖已经形成的 binding/FundingPolicyTemplate。§4.6 提到 bootstrap，但没有对应 subject、费用、数据、cursor、terminal合同。
- 最小修订：新增只允许登记 metadata operation 的 `BootstrapMetadataAttemptSubject/Authorization/Cursor/Lease/Terminal`，绑定 ProductEligibility、endpoint egress、candidate Rights/DataBoundary、零费用证明或明确预算，且不能调用生成 endpoint。

### B4. 持久预算只有 prose，没有可消费的机器合同

- 最小反例：两个并发调用同时从剩余 USD 1 的持久预算各派生 USD 1 authorization。
- 现有条款为何挡不住：类型区只定义 single-use `RuntimeSpendAuthorizationReceipt`；§4.6 对持久预算仅列字段，没有 policy receipt、余额 cursor、child lease、CAS revision、恢复和撤销 terminal。
- 最小修订：定义 `PersistentBudgetPolicyReceipt`、逐单位余额 cursor、single-successor child authorization lease及 settle/reconcile transition；生成 runtime authorization必须原子消费该 cursor。

### B5. `AuthoritativeLedgerRangeReceipt.completeForBoundSubject` 无法容纳迟到 usage 与后续调和

- 最小反例：首次报告以 `charge_unknown` 收口，数小时后 provider账单到达并追加 settlement。
- 现有条款为何挡不住：旧 range仍永久声明 `completeForBoundSubject:true`；合同没有 `asOfSequence` 语义、报告 revision、predecessor/supersedes或“完成到某状态”的限定，两个相互冲突的完整报告都可存在。
- 最小修订：把完整性限定为明确 journal high-watermark和 accounting state；增加 report/range revision与单一 successor CAS，迟到 correction生成可验证 superseding report。

### B6. workload-identity credential issuance 不是独立的物理请求状态机

- 最小反例：STS/token endpoint 已返回临时凭据，但 daemon在保存 credential lease前崩溃并重试。
- 现有条款为何挡不住：`WorkloadIdentityCredentialLeaseReceipt`记录 issuance endpoint/request/egress digest，却没有 issuance 自己的 writer-epoch cursor、physical lease、sent/terminal、重试 edge与 delivery-unknown恢复；它只绑定最终 inference attempt。
- 最小修订：把每次 STS/OAuth/metadata credential issuance 建成独立、无生成的 credential physical-attempt 状态机；完成 terminal 后才能生成 inference credential lease。

### B7. native desktop distribution 未机械禁止伪 confidential OAuth client

- 最小反例：provider pack把公开分发的 SayDo桌面客户端标成 `clientType:"confidential"`，并随应用保存共享 client secret。
- 现有条款为何挡不住：`OAuthClientRegistrationReceipt`允许 public/confidential 与 client-secret/private-key/mTLS自由组合；虽然 §15 引用 RFC 8252，schema/refinement没有把 native public distribution限制为 `none_public`，也没有要求 confidential authentication由独立服务器 authority持有。
- 最小修订：增加 distribution/client-deployment kind；native direct PKCE/device默认只能是 public。confidential 分支必须绑定独立服务端或可证明不可导出的实例密钥 authority，并有对应 TCK。

### B8. reference-grade/GA baseline 可由同一 owner 更换目标后自证，主流覆盖不是不可降级门

- 最小反例：owner保留 `global_native_api` 类别名称，却把 OpenAI Responses/Anthropic Messages替换为更容易通过的三个次要产品，然后签发新 baseline decision。
- 现有条款为何挡不住：§9.9允许 owner 调整具体产品，只禁止删除整个 category；release verifier只验证当前 baseline，无法判断其是否仍满足本文声称的主流覆盖。该变化也未被规定为自动撤销 reference-grade/GA 的 waiver。
- 最小修订：发布不可降级的、版本化 reference-grade profile，冻结协议族、realm、auth、funding和最低具名主流 entry；owner可发布自定义 profile，但删除或替换 reference minima 必须更名并机械撤销 reference-grade/GA 标识。

## C

无。

VERDICT: FAIL
