# VERDICT: FAIL

共发现 12 项 A、5 项 B。以下均针对当前 SHA 的新增残余矛盾；没有以“生产代码尚未实施”为 finding，也没有复述已经被当前版本完整关闭的旧问题。

## A 级

### A-1：extension protocol ID 未按 Inference/Execution 域分离

- 位置：[L206](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:206)、[L214](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:214)、[L1378](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1378)、[L2407](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2407)。
- 最小反例：`ext:evil.agent@1` 同时满足两个协议类型；Execution TCK/adapter receipt 可原样挂到 inference `ProtocolRoute`。
- 挡不住：`ProtocolImplementationReceipt` 没有 `plane`、connector kind 或 TCK kind；通用 `ReceiptRef` 也不能证明 attestation 属于哪一平面。
- 最小修订：使用 `ext:inference:publisher.name@major` / `ext:execution:...`，或让 ID、implementation、TCK 全部绑定 `plane + connectorDefinitionKind`；增加跨平面换挂负例。

### A-2：OAuth confidential-client 与 refresh credential transition 不闭合

- 位置：[L225](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:225)、[L252](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:252)、[L273](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:273)、[L288](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:288)、[L351](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:351)、[L2720](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2720)。
- 最小反例：token endpoint 要求 `private_key_jwt` 或 `client_secret_basic`，成功 refresh 后旋转 refresh token。当前合同既没有 client authentication method/credential binding，也没有 refresh-result receipt 把旧 grant 原子迁移到新 access/refresh secret version。
- 挡不住：`exchangeKind="refresh"` 只授权请求；结果字段只存在于初始 PKCE/device grant。把新 token 写回旧 receipt 破坏不可变性，重新伪造初始 grant 又需要不存在的 code/device 字段。mTLS token endpoint alias及证书绑定的 `cnf` 也未进入结果闭包。
- 最小修订：增加判别型 OAuth client registration/auth、逐敏感组件 ACL/egress，以及带 predecessor CAS 的 `OAuthCredentialTransitionReceipt`，绑定新旧 token version、scope、issuer、audience、`azp/cnf` 和并发 refresh winner。相关标准要求见 [RFC 6749 §2.3](https://www.rfc-editor.org/rfc/rfc6749.html#section-2.3)、[RFC 6749 §6](https://www.rfc-editor.org/rfc/rfc6749.html#section-6) 和 [RFC 8705](https://www.rfc-editor.org/rfc/rfc8705.html)。

### A-3：复合 proxy/TLS/mTLS/application auth 到物理发送前仍会丢凭据授权

- 位置：[L1284](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1284)、[L1295](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1295)、[L1309](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1309)、[L2383](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2383)、[L2414](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2414)、[L2721](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2721)。
- 最小反例：HTTPS proxy 使用 Basic 和私有 CA，CONNECT 后 origin 使用另一 SNI/CA、mTLS 证书和 Bearer。实际需要三个 credential egress 和两个 TLS layer。
- 挡不住：transport profile 只有一组全局 TLS/SNI/terminator/client identity；`PreparedAttemptDescriptor` 又只能携带一个 egress digest。`completeCredentialComponentSetDigest` 只是静态摘要，不能替代每次物理发送的三份授权。
- 最小修订：每个 transport layer 保存独立 hop ordinal、DNS/socket、TLS/SNI/trust/terminator/client identity；descriptor 携带排序、无漏无重的逐组件 egress/ACL 集合。`no_credential` 仅在完整组件集合为空时成立。

### A-4：single-successor cursor 不保证前驱 terminal，不能兑现“成功即停”

- 位置：[L550](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:550)、[L623](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:623)、[L664](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:664)、[L676](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:676)、[L2710](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2710)、[L2854](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2854)。
- 最小反例：序列 `[A,B]` 中，A lease 推进 cursor 后尚未返回，B 即凭新 revision 获得合法 successor lease。两请求同时发送；A 随后成功，但 B 已产生额外费用。
- 挡不住：后继只引用前驱 lease/cursor，没有前驱权威 terminal、outcome 或 retry edge predicate；“不是 sibling”不等于“因果串行”。
- 最小修订：增加持久 attempt terminal transition；只有同一事务消费前驱的 `retryable_failure/failed_before_send` terminal 才能生成后继，`success` 原子关闭 cursor。增加“前驱未 terminal”和“前驱成功后申请后继”的零字节竞态门。

### A-5：fallback 没有跨 solution 的 envelope、总预算与 cursor

- 位置：[L1524](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1524)、[L2050](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2050)、[L2259](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2259)、[L2548](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2548)、[L2580](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2580)。
- 最小反例：A 已发送后超时并成为 `charge_unknown`，snapshot 中 B 的独立预算仍有效，于是 B 被调用并结算；用户披露只来自 A 的 invocation envelope。
- 挡不住：`FallbackPlanReceipt.maxPhysicalAttempts` 不是可执行序列，也没有 trigger terminal receipt、逐单位 A+B 聚合预算或 durable cursor；plan 也未进入 ActivationManifest，snapshot 可在同一 activation 下新增它。
- 最小修订：把 fallback policy 纳入 activation/hard-stop closure，增加有限 `FallbackInvocationEnvelope`、terminal edge predicates、跨 solution 聚合预算和 single-successor cursor；否则只允许在已证明 A 零上游字节时切换。

### A-6：security extraction receipt 既未绑定输出值，字段 enum 也不一致

- 位置：[L421](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:421)、[L1237](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1237)、[L2520](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2520)、[L2837](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2837)。
- 最小反例：raw route 是 A，但构造 route B 的 `EffectiveRouteReceipt`，再引用一份合法 route extractor。现有 extraction receipt 没有 occurrence、canonical value 或 value digest，因而无法证明 B 是实际输出。
- 挡不住：内层字段为 `observed_model/effective_route/processing_region/data_processor/billing_component`，外层却使用 `model/route/data_boundary`，且完全遗漏 billing component；宽泛 `data_boundary` 还能跨 region/processor authority。
- 最小修订：全链复用唯一 `SecurityExtractionField`，receipt 绑定准确 raw occurrence/path、typed canonical value/value digest、目标 subject与 authority；复合 DataBoundary 只能聚合多个逐字段 receipt。

### A-7：生成型 `health_probe` 在合同中不可构造

- 位置：[L217](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:217)、[L1094](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1094)、[L1184](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1184)、[L1332](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1332)、[L2839](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2839)。
- 最小反例：provider 的 half-open 检查必须做一次收费的一 token generation。
- 挡不住：正文要求 `operation=health_probe` 的 Rights/DataBoundary/Funding/lease，但 `InferenceOperation` 只有 `chat | tool_roundtrip | evaluate`；URL 的 `"health"` 不能进入 policy/funding union。
- 最小修订：首版禁止自动生成型 probe，只由下一次正常授权请求携带 half-open token；或新增独立 HealthProbe subject/operation 并贯穿完整费用、数据、权限、lease 和 terminal 闭包。

### A-8：Execution consent 未绑定用户批准的金额和物理请求上限

- 位置：[L1659](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1659)、[L1678](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1678)、[L1789](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1789)、[L1806](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1806)、[L1819](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1819)。
- 最小反例：用户同意 `maxTurns=1`；`sessionWorstCaseLimit` 留空，admission 再设置 `aggregatePhysicalRequestCap=10000` 和高额 funding limit。一个 turn 内即可产生大量付费请求。
- 挡不住：session consent 不绑定 admission subject、`BillingLimitVector`、physical cap 或披露 digest；admission 中独立填写的限制无法证明是用户批准值。tool consent 同样缺金额和调用上限。
- 最小修订：session/tool consent 精确绑定 admission subject、逐 component/unit 金额、总 physical count、disclosure digest 和用户决定；reservation 必须逐单位不超过 consent，已知计费路径的 worst-case 不得 optional。

### A-9：工具状态机没有可审计的 abort terminal

- 位置：[L1921](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1921)、[L1997](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1997)、[L2131](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2131)、[L2283](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2283)、[L3630](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3630)。
- 最小反例：工具到达 `authorized` 后、`start` 前发生 hard stop；或 `executing` 中能够证明尚未发生 effect 并安全杀停。
- 挡不住：transition union 没有 `authorized|executing → aborted`。启动工具违反撤销，删除记录违反不可变审计，保持非 terminal 又使 hard-stop 永远无法收口；把确定未执行标成 `executing_unknown` 也不准确。
- 最小修订：加入带 `abortEvidence` 的 terminal `aborted`，明确 commit lease 前后允许的来源状态、费用释放条件与 CAS；覆盖四个 kill point。

### A-10：Inference code plugin 的 permission/data/sandbox 没进入激活闭包

- 位置：[L1378](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1378)、[L2050](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2050)、[L2330](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2330)、[L2420](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2420)、[L2548](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2548)。
- 最小反例：adapter artifact 不变，仅把数据范围从 `public_endpoint_metadata` 扩为 `prompt_content` 或降低 sandbox policy；新 snapshot 仍引用旧 activation/artifact。
- 挡不住：`manifestDigest` 没有进入 `ProtocolImplementationReceipt` 的闭包，Inference Activation/Snapshot 也没有 permission、data processor、sandbox/backend policy receipt；L2424 的 hard-stop 文字没有机械比较对象。
- 最小修订：增加 `InferencePluginPolicyReceipt`，绑定 manifest/publisher/artifact/capability/permission/data scope/sandbox/IPC/budget，并贯穿 implementation、Activation、Snapshot 和 PreparedAttempt；任一扩大必须增代、撤销在途并重新同意。

### A-11：本机 inference 的“数据不出机”仍只具有 network assurance 形状

- 位置：[L745](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:745)、[L768](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:768)、[L791](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:791)、[L2716](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2716)、[L3564](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3564)、对比 Execution 门 [L3622](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3622)。
- 最小反例：模型进程被禁止直接联网，但能把 prompt 写入 iCloud/Dropbox 同步目录，或发送给本机同步 helper/IPC。
- 挡不住：LocalCompute lease/evidence 只引用 `RuntimeNetworkEgressAssuranceReceipt`；§4.16.1 虽要求 mount/sync/temp/log/IPC/helper 全覆盖，却没有 inference runtime sandbox receipt、realized/denied set 或 Phase 4 对应 canary。Execution 分支反而具备这些机械门。
- 最小修订：为本地 inference 增加真实模型进程树的 sandbox template/runtime receipt，绑定 filesystem/sync/temp/log/IPC/helper/socket/继承 handle 的 realized set，并进入 LocalComputeLease、DataBoundary 和 Activation；三平台从最终 distribution 跑同级 canary。

### A-12：TemporalValidity 可由 producer 漏掉最早过期的安全收据

- 位置：[L412](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:412)、[L2041](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2041)、[L2287](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2287)。
- 最小反例：Rights 在 12:00 到期、Billing 在 18:00 到期；producer 只填 `subjectReceiptRefs=[Billing]`、`earliestNotAfter=18:00`。
- 挡不住：refs 可空且没有与 Activation transitive closure 的完全相等约束；`earliestNotAfter` 和 Activation 的 `earliestSecurityNotAfter` 都是可填写副本。
- 最小修订：定义 `temporal-validity-fold-v1`，从 manifest 的规范安全闭包派生非空、排序、唯一 refs；host 在 compile/promote/send 重算，最早期限和 outcome 不接受 producer 自报。

## B 级

### B-1：TUF extractor receipt 缺少可重放的 metadata lineage

- 位置：[L430](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:430)、[L2184](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2184)。
- 最小反例：同一 target digest 在 snapshot 10 有效，snapshot 11 已撤销其 delegated key；旧 receipt 仍只有 repository、role、threshold、target digest 和 expiry。
- 挡不住：无法确定它验证过哪一版 root/timestamp/snapshot/delegated-targets，也无法重放 rotation、mix-and-match 或 rollback 判定。
- 最小修订：记录 root、timestamp、snapshot、delegated metadata 的 version+digest、target path/hash/length、consistent-snapshot identity、anti-rollback high-watermark 和 verifier generation。

### B-2：ContentHandle 只有单 handle 上限，没有宿主总存储闭包

- 位置：[L2729](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2729)、[L2751](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2751)、[L2829](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2829)、[L3778](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3778)。
- 最小反例：每个 prepared attempt 建立多个合法 32 MiB host-owned handle，并让消费者慢读；每个 handle、prepared count 和 worker RSS 可分别合法，但 spool/temp disk 持续增长。
- 挡不住：HostWorker profile 没有 aggregate handle count/bytes、内存与磁盘 spool、per-publisher handle 配额或崩溃后孤儿回收上限。
- 最小修订：增加 host/publisher/session/attempt 四级 handle count、resident/spooled/temp bytes、lifetime 和恢复清理预算，纳入同一原子 admission 与 N-1/N/N+1 门。

### B-3：LAN `owned_capacity` 缺少可信 producer 和逐请求 compute lease

- 位置：[L1198](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1198)、[L2249](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2249)、[L2709](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2709)、[L3567](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3567)。
- 最小反例：LAN gateway 自报本地 device/artifact/no-charge，实际转发付费云；`OwnedCapacityReceipt.evidenceDigest` 仍可被填充。
- 挡不住：§2709 正确拒绝被测服务自报，但 LAN 分支没有独立 authority policy、fresh measurement/nonce、远端 process/artifact generation 或每次 dispatch lease；严格实现会使承诺路径不可构造，宽松实现会误入 no-new-spend。
- 最小修订：定义 LAN peer/compute authority 与逐 attempt lease，要求 SayDo-managed remote agent或不同信任域 attestation；否则统一降为 unknown/provider-cloud。

### B-4：GA matrix 不是固定基线，也不携带可验证 gate 结果

- 位置：[L2809](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:2809)、[L3310](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3310)、[L3458](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3458)、[L3785](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3785)。
- 最小反例：为 Gemini、BigModel、Kimi、OpenCode、Ollama、oMLX 全部建行但设 `requiredForGa=false`，再放一个容易通过的 required 产品。非空、无重复、有产品级行等现有检查全部通过。
- 挡不住：schema 没有版本化 mandatory product/category baseline；`gateId` 和 `ownerDecisionRef` 是任意字符串，也没有受信 report/evidence digest或 `completed_pass` 状态。
- 最小修订：release 钉住必需 product ID、region/surface/funding/journey/category baseline；每个 mandatory 行引用具名受信 report、attestation、phase gate outcome 与 owner decision receipt，删除或降级必须形成新 baseline。

### B-5：正式阶段门允许未处置 B 进入下一阶段或宣告交付

- 位置：Phase 0 [L3345](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3345)、GA [L3786](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:3786)、DoD [L4175](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:4175)，对比结尾声明 [L4379](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:4379)。
- 最小反例：最终评审为 A=0、B=8；三个正式门都只要求“无未处置 A”，仍可开下一阶段和满足定义完成。
- 挡不住：L4379 的“无 A/B”是叙述性声明，未进入 Phase gate、GA gate 或 DoD 的可执行条件。
- 最小修订：reference-grade/GA 一律要求零未处置 A/B；若 owner 接受 B，必须机械降级 maturity、从 mandatory GA matrix 移除并生成显式决策 receipt，不能仍宣称顶级参考架构。

## C 级

无。

## 完整性记录

- 开始 SHA-256：`a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453`
- 结束 SHA-256：`a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453`
- 实际读取范围：完整逐行读取 `1–4379`，文件大小 `420,572` bytes
- 仓库修改：无
- 最终结论：`VERDICT: FAIL`