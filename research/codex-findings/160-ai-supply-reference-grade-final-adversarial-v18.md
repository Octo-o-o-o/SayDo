# AI 供给普适接入 v18 最终对抗审查

## 结论

判定：FAIL。

精确计数：

| 级别 | 数量 |
|---|---:|
| A | 20 |
| B | 4 |
| C | 1 |

本报告按根因计数；同一根因在 inference、Execution、tool 或多个 release consumer 中的重复表现不重复计数。A、B 均非零，因此不满足“仅 A=0 且 B=0 才可 PASS”的门槛。

这不是把“计划尚未施工”算作缺陷。本报告所称“悬空 producer”仅指：目标合同已经把某个品牌化、私有或 release-critical receipt 设为主路径必需输入，却没有定义从允许的原始事实到该 receipt 的合法构造边；严格照合同实现时主路径不可构造，或只能退回结构性自填而产生发布假阳性。

## 冻结身份与范围

目标：

    docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

审查开始前实测：

    SHA-256  c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0
    lines     42437
    bytes     2672219
    HEAD      174ab48895aa1e4a6c6b42b9c74187f20efc3cfd

四项均与冻结身份一致。目标当前在该 worktree 中为未跟踪文件；这不改变本次以明确 SHA、行数和字节数冻结的 target-only 身份，也未作为 finding 计数。

范围纪律：

- 顺序完整读取目标 1–42437 行。
- 未打开任何旧 prompt、旧 finding、过程日志、journal、其他审查报告或目标内链接。
- 未读取其他仓库文档或实现文件，未修改目标。
- 目标自身包含历史回顾文字；该文字不是本报告的事实来源、通过证明或 triage 输入。
- 易变外部事实只核对当前官方一手资料，见“外部事实核验”。

## 方法与可复核基线

### 完整 TypeScript 编译

提取目标全部 11 个 ts fence，以内存 CompilerHost 拼接编译。payload 本身为 1,978,244 bytes、39,475 行；块间加入分隔换行后的虚拟源为 1,978,254 bytes、39,485 行。环境与选项：

    Node                         v22.23.1
    TypeScript                   5.9.3
    target                       ES2023
    module/moduleResolution      NodeNext
    strict                       true
    exactOptionalPropertyTypes   true
    noUncheckedIndexedAccess     true
    skipLibCheck                 true
    noEmit                       true

完整合同一次主测原始指标：

    diagnostics       0
    types             418145
    instantiations    630250
    compiler wall     3025.22 ms
    RSS               735543296 bytes

独立读取者复跑两次仍为 0 diagnostics，wall 约 2630 ms 与 4014 ms。该结果只证明声明整体可解析；下述反例证明它不能替代逐 constituent 的可构造性、泛型相关性和负例门。

### Compiler API 与机械 census

- REFERENCE_REQUIREMENT_INPUTS_V3：73 行、73 个唯一 key。
- surface 分布：inference 63、execution 5、bridge 4、control_plane 1。
- exact oracle：73 个 requirement key 与 73 个 oracle key，missing/extra 均为空。
- canonical phase BOM：19 个 step。
- 声明为持续 release gate 的具名 suite：32 个。
- BOM argv 实际直接包含其中 7 个；缺 25 个。
- preflight 不在 canonical BOM。
- authority expected-name tuple 为 74 项，branch-free policy 为 60 项；实际另有可构造且直接持权的 ProviderCleanupPhysicalOperationLeaseV9 未进入二者。

### 最小正反例

所有 TypeScript 反例均追加到完整合同虚拟源后独立 strict 编译，没有用 any、类型断言或落盘 stub。

| 用例 | 预期 | 实测 |
|---|---|---|
| 完整合同基线 | 可解析 | 0 diagnostics |
| runtime precondition assertion 不提供顺序证明 | 应拒绝 | 0 diagnostics，得到品牌化 assertion |
| owner approve 精确实例化但不提供 rejectionReasonDigest | 应可构造 | TS2345；required never 导致不可构造 |
| owner D 显式扩大为 approve 或 reject，同时 decision=approve 且提供 rejection digest | 应拒绝 | 0 diagnostics，返回 approve/reject 联合 receipt |
| 一个 owner input，raw oracle sources 为空数组 | 应拒绝 | 0 diagnostics，输出 tuple 第 0 项仍非 never |
| OpenAI row 与 Anthropic run subject 经 A 或 B 宽联合调用 exact binding | 应拒绝 | 0 diagnostics，返回 GaExactReferenceRunSubjectBindingReceiptV4<A 或 B> |
| 同一调用精确固定 R=A 后换入 B subject | 应拒绝 | 2 个 TS2322；说明漏洞来自联合推断，不是模型本身允许 |
| dist-A evidence、dist-B claims、dist-C artifacts 提交 outer release binding | 应拒绝 | 0 diagnostics，推断 D 为 dist-A 或 dist-B 或 dist-C |
| dist-A artifact tuple 与 dist-B claim set 提交 artifact-set producer | 应拒绝 | 0 diagnostics，推断 D 为 dist-A 或 dist-B |
| 宽 ExecutionActivationManifest 省略 third-party open handle、lease、cursor、runtime authority | 应拒绝 | 0 diagnostics |
| GaMandatoryBaselineV3 将 required key 数组缩成合法 singleton 并自填 proof=true | 应拒绝 | 0 diagnostics，结构类型可构造 |

外部 codex exec 复核曾按仓库规约启动，但当前只读环境拒绝初始化其 state DB，返回 operation not permitted；该失败尝试没有报告产物，也没有被伪称为第三路成功结果。本报告证据来自主审的真实命令与两路当前 target-only 独立读取。

## A 级发现

### A-01 authority census 漏掉真实 cleanup 持权 lease

证据：expected-name tuple 位于 L885–L960，branch-free policy 位于 L1040–L1101；两处均没有 ProviderCleanupPhysicalOperationLeaseV9。该类型在 L28461–L28487 直接扩展 AuthorityInventoryBearingLease，持有 network_admission、external_effect、budget_reservation，且 L28489–L28505 有真实 producer。发布条款 L41223–L41225 仍要求最终 AST 恰为 74 个具名类型、60 个 branch-free policy 和 83 个 constituents。

攻击结果有且只有两种：真实结构 census 纳入 cleanup lease，固定 74/60/83 门必红；或 verifier 只追随手写 expected list 而漏掉 cleanup 的网络、副作用、预算 lifecycle/restart closure。前者使 release 主路径不可通过，后者使清理账户、撤销凭据、对账费用的持权操作逃出统一审计。

关闭条件：从 Compiler API 结构发现结果唯一派生 expected names、policy、registry、constituent count、terminal/restart mapping；把 cleanup lease 纳入，并加入“新增任意持权声明即自动改 census 或使门红”的 mutation。

### A-02 retry/delivery-unknown terminal 没有锁定同一物理主体

inference exact safety subject 在 L11648–L11690，但 authority branch 是非泛型宽联合（L11771–L11904），terminal 主要按 intentState 抽取（L12070–L12080），两个 producer 也不显式接收并锁定 exact lease/intent/cursor/response（L12086–L12113）。Execution 在 L19674–L20147、tool 在 L21612–L21872 重复该形状。

最小换挂是：runtime attempt A 的 safety/ledger 与 conformance attempt B 的 intent-present authority branch拼接；Execution/tool 则令外层 P=A、base 中 lease/cursor=B。类型仍能沿宽分支形成 terminal，继而错误地关闭或推进另一物理请求，破坏 delivery_unknown 永不自动重试、费用结算和 effect-once。

关闭条件：authority/base/outcome/terminal 全部参数化到同一 physical subject、lease、send intent、cursor、response、phase 和 distribution；producer 只从一个推断锚推断，其余使用 NoInfer；加入跨 phase、attempt、tool/effect、distribution 负例。

### A-03 fallback 主状态机除 safety closure 外没有合法 producer DAG

alternative、plan、envelope、admission、cursor、solution-attempt lease 位于 L16908–L17145，advance、solution terminal 与 zero-solution terminal 位于 L17212–L17353。该区唯一明确 producer 是 L17204–L17210 的 commitRuntimeRouteAutomaticFallbackSafetyV8；initial cursor、attempt lease、advance、success terminal、zero-solution terminal 均没有命名构造边。

严格遵循私有 receipt 规则时，连首个 ready cursor 和 solution lease 都不能生成；若实施者用通用 body/ReceiptRef 逃生，则 solution A 的 plan/alternative 可与 solution B 的 admission/binding 换挂。两条路分别是主路径不可构造与错误费用/数据/route 状态。

关闭条件：逐节点私有品牌、typed predecessor、精确 solution/slot/distribution producer；producer census、实例 DAG 和跨 solution 负例纳入 Phase 0。

### A-04 current-distribution support claims 与 runtime rights 构成首发环

ProductSurfaceUseCasePolicyCatalogReceiptV8 强制消费同一 D 的 PublishedSupportClaimSetReceiptV6（L5851–L5870）；exact use-case entitlement 与 runtime rights 又依赖该 catalog（L5920–L5964、L12977–L13027）。反向地，73 行 claim 只有完成 journey、entry/ecosystem gate、live/funding 和当前 distribution 后才能提交（L37932–L38050），聚合 claim set 到 L38326–L38354 才出现。

因此发布 D 要先有 claims(D) 才能授权 D 的 activation/journey，又要先完成 D 的 activation/journey 才能生成 claims(D)。旧 distribution 的 claim set 因 D 不同不能作为同一主体替代。这是证据自引用导致的首个 release 不可构造，不是“尚未跑测试”。

关闭条件：pre-release rights catalog 只由 canonical restriction floor、签名 terms、inventory 与明确 bootstrap policy 编译；support claims 必须保持为测试完成后的单向下游投影，不能反向进入其前置 rights 决策。

### A-05 “rights 先于 credential”在权威 UX 状态中不可表达

目标 L141 要求 unknown/forbidden 权益先于缺 credential 显示。ProductEligibility 的 unknown/forbidden 分支明确 permitsCredentialInput=false（L5693–L5723），但 ExactRightsDecisionReceiptV9 与 commitBlockedRightsDecisionV9 都要求 permitsCredentialInput=true 的 eligibility 和 credentialPrincipalDigest（L5763–L5816）。UX 的 rights_unknown/rights_forbidden 又只接受这种 principal-bound blocked receipt（L39824–L39835）。

对未交 secret 的新 provider，系统既不能构造权威 rights_unknown/forbidden state，也不能按目标先显示该状态；实施只能提前索取 credential，或展示无权威 receipt 的文案。两者分别违反安全目标和状态诚实性。

关闭条件：增加由 ProductEligibility 直接生成的 pre-credential eligibility_unknown/forbidden 权威状态；取得 credential principal 后才进入 exact rights decision，并显式定义二者的单向迁移。

### A-06 ComputePolicy 没有把 Rights、Network、Billing、DataBoundary 锁到同一 subject

RuntimeBillingReceipt 为宽结构（L13029–L13063）；ComputePolicyRefs<S> 只让 rights 使用 S，network、billing、dataBoundary 没有随 S 参数化（L13070–L13077）。ComputePolicyBindingReceipt 在 L13117–L13128 没有私有 producer；DataBoundary 主要靠普通 digest/string 关联（L13192–L13209）；RouteSet 在 L16579–L16582 又把它擦宽。

可将 principal/product A 的 Rights 与 route/resource/distribution B 的 Billing、Network、DataBoundary 组合。后果是费用授权、数据去向与实际网络目的地不一致，正中 A 级费用/数据/安全定义。

关闭条件：定义唯一 exact compute-policy subject，四份 policy receipt 全部参数化到同一 principal/product/realm/surface/operation/use-case/resource/effective-route/distribution；品牌 producer 使用一个推断锚和 NoInfer，并做 canonical byte equality。

### A-07 inference third-party plugin 没有 consent/consumption 与构造闭包

ThirdPartyInferenceProtocolImplementationReceipt 位于 L15767–L15786；InferencePluginPolicy、activation closure、runtime closure 位于 L17356–L17405。它们没有 accepted decision、single-use consumption，也没有命名 producer。对照 Execution 的 authorization subject、accepted decision、consumption、policy 与 activation producer 在 L15875–L16013 明确存在。

照方案实施时 inference plugin 主路径不可构造；若结构性填充，则同 artifact digest 可更换 permission/data/sandbox policy 而无重新同意，或直接加载没有一次性 consent 的第三方代码。

关闭条件：镜像 Execution 的 proposal→disclosure→accepted decision→single-use consumption→policy→implementation→activation→runtime 链，并绑定 TUF、publisher、artifact、distribution、generation 与 revoke/restart。

### A-08 Execution plugin admission 的非分布式 conditional 可省略第三方 authority

ExecutionActivationManifest 对 implementation 的映射本身是分布式的（L23182–L23206），但 ExecutionPluginRuntimeAdmissionCommitInputV7 检查的是 M["executionPluginActivationClosure"] extends ThirdParty...（L23210–L23240）。当 M 是完整 ExecutionActivationManifest 联合时，indexed-access 联合整体不满足该条件，落入 N/A 分支。

已复现：显式 M=ExecutionActivationManifest，提供宽 activationClosure 后，省略 loadedPluginOpenHandle、dispatchAdmissionLease、predecessorRuntimeCursor、singleSessionRuntimeAuthorityAdmission，strict diagnostics 仍为 0。producer 返回联合中仍包含 third-party admission constituent。

关闭条件：对裸 M 做分布式 conditional，或直接按 pluginMode 生成 mapped discriminated input union；manifest 是唯一推断锚，其余 closure/lease 使用 NoInfer，并增加宽联合负例。

### A-09 runtime-state assertion 的 mode 专属证明都是 optional

ReferenceRuntimeStateAssertionReceiptV4 在 L31072–L31094 将 precondition 顺序证明、transition terminal/predecessor/successor、postcondition terminal/current-state proof 全写成 optional conditional；producer L31096–L31107 只接收一个 optional 宽 ReceiptRef terminal。

最小反例选择 ollama.chat 的 not_running 与 observes_precondition，不提供 provesEvidencePrecedesAnyRecoveryAction，strict 仍为 0 diagnostics 并取得品牌化 receipt。transition 和 postcondition 也能缺少各自核心证明。下游 L34143–L34150 直接把这些 assertion 当作 evidence set。

关闭条件：按 mode 建立真正的分布式判别输入/输出联合；适用字段 required，非适用字段才是 optional never；terminal 必须是该 row/state/action 的 exact typed terminal。

### A-10 owner approve 是 required-never 主路径，并可用 D 联合制造矛盾决定

output 在 L36080–L36085 是正确 approve/reject 联合，但 producer L36087–L36099 把 rejectionReasonDigest 写成 required 的条件类型。

精确 D=approve 且省略该字段得到 TS2345：缺少 required rejectionReasonDigest: never，正常批准不可构造。显式 D=approve 或 reject 后，decision=approve 与 rejectionReasonDigest="contradiction" 却是 0 diagnostics，返回 approve/reject 联合 committed receipt。

关闭条件：input 直接使用 Base 与判别联合；approve 分支为 rejectionReasonDigest?: never，reject 分支为 required string。返回值按判别分支映射，禁止调用者扩大独立 D 为联合。

### A-11 owner extension 的 namespace 与 qualification producer 链悬空

OwnerRequirementKeyV4 是 unique-symbol brand，OwnerRequirementNamespaceReceiptV4 又要求该 key（L35888–L35913）；AST producer census 没有函数返回二者。journey/live/funding/mutation qualification receipts 位于 L38102–L38230，也没有各自 producer。唯一外层函数 L38265–L38271 直接接受完整 output 的 Omit body；owner proposal L36053–L36060 同样无专属 brand/producer。

合法调用者无法从 raw publisher/name 进入 owner key，再进入四类 qualification；反向退回外层结构自填时，caller 可自己写零计数和 proves 字段。owner 扩展作为目标的未来普适入口因此既不可实施又不可可信。

关闭条件：增加 namespace normalizer 私有 producer；四类 qualification 各自只从 typed raw evidence 提交；外层只消费 committed child receipts，不接受完整派生 body；owner proposal 也要独立 kind、brand、producer。

### A-12 owner semantic compiler 接受空 raw oracle source 集

compilation receipt 在 L35975–L35998 声称每一 owner output 都由一个 raw input 与一个 raw oracle source 编译；实际 producer L36000–L36015 只要求元素类型数组，没有长度、顺序或 key 双射。

已复现：ownerInputs 是一元素 tuple，ownerConnectionOracleRawSources=[]，strict 为 0 diagnostics，输出 ownerRequirements[0] 仍为非 never 的品牌化 owner requirement。

关闭条件：raw source 改为映射 tuple，逐 I[N] 绑定 requirementKey；或 exact keyed object。producer 必须双向检查 key set、重复和额外项，失败返回明确 failure union。

### A-13 exact run-subject binding 可由联合推断跨 requirement 换挂

GaExactReferenceRunSubjectBindingReceiptV4 声称 exact（L36261–L36279），producer L36282–L36289 却让 requirement 与 subject 共同协变推断 R，未用 NoInfer；相同宽度继续进入 index 与 conformance binding（L36291–L36317、L37478–L37508）。

已复现：包装函数接收 A 或 B 的 row 与 A 或 B 的 subject，传 OpenAI row 和 Anthropic subject，返回 GaExactReferenceRunSubjectBindingReceiptV4<A 或 B>，0 diagnostics。精确固定 R=A 时同一换挂产生两个 TS2322，证明漏洞就是 union inference。

关闭条件：按 requirementKey 生成 row/subject 判别输入联合，或只从 row 推断 R、subject 使用 NoInfer<R>；明确拒绝 union R，并在 producer 内比较 canonical row/subject digest。

### A-14 outer release 与四件套可通过 D 联合跨 distribution 换挂

inner claim producer L38020–L38050 和 claim-set producer L38083–L38094 已正确使用 NoInfer；但 artifact-set producer L38448–L38451、release evidence producer L38488–L38497 和 outer binding L38550–L38556 没有唯一 D 推断锚。distributionArtifact 还是不带 D 的 opaque leaf。

已复现 dist-A evidence、dist-B claims、dist-C artifacts 生成 ReleaseEcosystemBinding<dist-A 或 dist-B 或 dist-C>，0 diagnostics；dist-A artifact tuple 与 dist-B claim set 也生成联合 D 的 artifact-set receipt。于是“73 行 claim 与四件支持产物属于同一发行物”的最终品牌可假阳性。

关闭条件：由品牌化 DistributionArtifactIdentityReceipt<D> 或 literal digest 唯一推断 D；其余所有输入使用 NoInfer<D>；禁止 union D，producer 对 distribution bytes/digest 做相等校验。

### A-15 多个 release-critical trust root 可由 caller 结构性自填

同一根因出现在三个发布门：

- ReferenceGradeProfileV3、GaMandatoryBaselineV3、GaEcosystemMatrixCoreV3 仅有结构接口且没有 producer（L35795–L36051）；下游直接接受。已复现将 baseline required arrays 缩成 singleton、proof=true 仍为 0 diagnostics。
- GaAccessibilityRequiredPresentationMatrixReceiptV6 无品牌、无 producer、无 typed cell tuple（L36494–L36508），UI pass producer L36527–L36552 只相对传入矩阵比较；缩小 expected matrix 可得到 missingMatrixCellCount=0。
- TypeContractCompileBaselineReceiptV1 无品牌/producer（L26789–L26806），只挂一个宽 TufTargetAuthorizationReceipt；L26811–L26879 可接受人为抬高 bytes/instantiations/RSS/wall 的 baseline，使真实回退落在 115%/120% 内。

这是同一“权威 expected/baseline 由被审对象提供”的 trust-root 错误，分别导致 GA、a11y 和性能发布假阳性。

关闭条件：三个根均由固定 canonical bytes、精确 TUF target path/hash/length、distribution/commit/compiler argv 和私有 producer 生成；expected set 必须 typed exact Cartesian/key tuple，baseline replacement 需要 predecessor gate 与 owner approve。

### A-16 UX authoritative state machine 无入口 producer

SafeAutomaticCandidateReceiptV8 是私有品牌且无 producer（L39791–L39803）；SupplyStateAuthoritativeReceiptV9 也是私有品牌、声明“只能由 exact state reducer 生成”，但没有任何 state-specific producer（L39821–L39849）。compileSupplyViewDomainSubjectV8 又强制消费它（L39854–L39874）。

即使 discovery、rights 或 ReviewReadySupplySolution 都合法，view reducer/render/capability 链仍无可构造入口；若实施者自行包装，则 state generation、expiry 与 predecessor 可伪造。

关闭条件：为每个 registry state 建 exhaustive mapped producer，绑定 exact evidence、generation、expiry、合法 predecessor edge；producer 集与 state registry 做双向 census。

### A-17 TUF target authorization 没有绑定本次 update 的可信时刻

可信时间只出现在 root rotation lineage（L8391–L8418）；verifyAndCommitTufTargetAuthorizationV2 的输入 L8529–L8547 没有 current TimeAuthorityReceipt 或 fixed update start time。输出 L8473–L8526 只有 expiresAt，没有本次校验使用的 lower/upper time bound。

最小攻击是在 t0 形成 root lineage/time receipt，t1 metadata 已过期后复用旧 lineage。当前 producer 的依赖图不能证明 timestamp、snapshot、targets 与 delegated targets 按 t1 的同一可信时刻检查。

官方 TUF 规范要求一次 update 用固定开始时刻检查 root、timestamp、snapshot、targets 的 expiration，过期即中止；见 [The Update Framework Specification](https://theupdateframework.github.io/specification/latest/)。

关闭条件：target verifier 显式消费 fresh TimeAuthorityReceipt，绑定同一 anchor/boot/counter/generation，输出 evaluated bounds 与所有 metadata 的 earliest expiry；拒绝 stale max-age 与重启/anchor 换挂。

### A-18 MFA/SCA 图级最坏路径超过已签上限

guided_key 与 guided_oauth_or_subscription 的 mfa class 上限均为 1，enterprise 也为 1（L29548–L29560）。每个 parent external task 的 challenge variant 可出现一次 MFA/SCA（L31109–L31124）。guided key 又分别把该 variant 挂在 create account、login、billing、credential creation（L31126–L31140）；OAuth 的 no_account 路径也包含 account、login、billing 三个 challengeable parent（L31186–L31200）。事件 reducer 把 nested external_task_started 作为真实 class count（L29808–L29831、L29895–L29900）。

no_account guided-key 可出现 3 次 MFA/SCA，signed-out 也可出现 3 次；OAuth no_account 可出现 3 次。合同没有 session-wide 互斥或 shared-challenge receipt，却要求 exhaustive fold 满足 mfa=1。真实用户会遇到披露上限之外的外部任务，或门禁必须漏计才可通过。

关闭条件：增加权威 session-wide single-challenge 证明，或按 Cartesian 路径重算上限与 disclosure；加入多 parent 同时 challenge 的正反例。

### A-19 三平台强 monotonic anchor enrollment 无 producer

基础 enrollment 定义在 L7755–L7797，平台绑定 enrollment 在 L7880–L7918；二者均无合法 producer。helper artifact/qualification 反而有 producer（L7845–L7878），最终三平台 release closure 强制消费 enrollment（L8177–L8220）。

macOS remote witness、Linux TPM2/remote witness、Windows TPM2/remote witness 即使完成 helper qualification，也没有 typed 边把 live backend attestation/enrollment 提交为 PlatformBoundMonotonicAnchorEnrollmentReceiptV6。三平台 GA 主路径不可闭合；结构自填则可跨 artifact/backend/distribution 换挂。

关闭条件：按 platform/backend 增加 enrollment producer，绑定 helper qualification、设备/boot identity、TUF distribution、TPM NV attestation 或 witness threshold/bootstrap、authority generation，并增加跨平台/backend/distribution 负例。

### A-20 canonical phase BOM 可漏 release suites，并可把失败 run 表示为 terminal

canonical BOM 只有 19 行（L38804–L38824），其 type assertion 只比较粗粒度 covers label（L38830–L38833）。L41454–L41489 又明确列出 32 个达到阶段后持续成为 release gate 的 suite；BOM argv 只直接包含 7 个，漏 25 个，且 L41505 要求的开工/收口 preflight 不在 BOM。缺失项：

    type-contract-compile-budget.model
    oauth-state-machine.tck
    receipt-dag-and-anchor.model
    pre-intent-authority-closure.model
    reference-monitor-writer-fence.model
    conformance-round-closure.model
    persistent-budget-ledger.model
    ledger-report-correction.model
    usage-dimension-fold.tck
    metadata-health-admission.tck
    provider-wire-auth-regression.tck
    capability-slot-funding.tck
    passive-loopback-peer.tck
    discovery-conformance.tck
    local-preload-state-machine.model
    local-product-journeys.tck
    execution-surface-chain.tck
    execution-tool-child-lease.model
    bridge-conformance.tck
    conformance-two-round-budget.model
    workload-identity-signing.tck
    plugin-budget-state-machine.tck
    platform-anchor-offline-mode.tck
    local-data-locality.tck
    evidence-orphan-recovery.chaos

此外，signed expected BOM 无 producer（L38835–L38844）；orchestrator terminal 只有任意 ReceiptRef 数组和“passed 或因 predecessor failure 未运行”，没有 step identity、argv、exit code、overall outcome，也无 producer（L38862–L38867）。第一步失败、其余全未运行仍满足这个唯一声明形状。

关闭条件：preflight-before/preflight-close 成为有序 BOM step；每个 mandatory suite 是 exact argv 或由签名 expansion manifest 展开；对 suite/step/predecessor/scope 做双向 exact-set 与 DAG 检查；terminal 使用 passed/failed/not_run 判别联合，只有全部 exact rows exit 0 才产生私有 completed_pass 并接入 release binding。

## B 级发现

### B-01 remote witness observer 没有同 realm 的 failure-domain 独立性

observer identity 只有 key/trustDomain 与“独立于 witness member”布尔（L6274–L6280），qualification 只要求至少两个 observer trust domains（L6528–L6580）。observer_failure_domain 仅作为跨 realm 比较轴出现（L8148–L8166），没有约束同一 realm 内两名 observer。

两个逻辑 trust domain 可同处一个 VM、cloud account、region、network 或 runner，24 小时/288-run 门仍可通过，单点故障却同时抹掉观察证据。应增加 operator/account/region/network/host/runner failure-domain identity 与 pairwise independence receipt。

### B-02 owner 扩展不能表达 migration-only connector

固定 hunyuan.cn 被硬编码派生为 migration-only（L33291–L33306、L33438–L33441）；owner key 只能是 owner.*.*，raw input 又不能直接提供派生事实（L35888–L35925），owner qualification 对 migration live mode 明确落到 never（L38120–L38134）。

未来 owner.vendor.legacy 若只允许迁移既存连接而禁止 fresh onboarding，compiler 无合法表达。应增加受限、可验证的 migration-only raw discriminator、existing-connection recipe/absence evidence，由 compiler 派生；否则公开声明 owner extension 不支持此类目并降级“universal”承诺。

### B-03 strict contract source 门几乎没有扩展余量

预算上限为 2,097,152 bytes、40,000 行（L26753–L26754）。当前 11 个 ts payload 已达 1,978,244 bytes、39,475 行，只剩 118,908 bytes（5.67%）和 525 行（1.31%）。instantiations/RSS/wall 余量尚可，但 source-line 门对 owner 扩展、新协议与新安全 receipt 几乎没有演进空间。

这不会使当前合同编译失败，因此为 B；但它与“未来扩展不牺牲性能或代码质量”的目标冲突。应先拆分/生成重复结构、将预算按稳定生成产物定义，并保留有解释的增长 headroom，而不是发布后临时抬门。

### B-04 当前 Codex custom-provider command auth 没有低配置导入闭包

目标正确记录 custom provider 的 wire_api 当前只允许 Responses（L38984、L39002、L41659），但没有 auth.command 的任何 schema、import 或安全执行边。当前 [OpenAI Codex configuration reference](https://developers.openai.com/codex/config-reference) 还定义了 custom provider 的 command-backed bearer token 获取及 refresh/timeout 参数。

因此已有合法 Codex custom provider 的用户仍需手工重建认证；若未来直接执行该 command，又会新增 process、secret、network、refresh authority，而目标没有对应 receipt。应明确安全导入/候选化方案，或明确不支持并降低该入口成熟度。

## C 级发现

### C-01 prose 引用了不存在的 profile 字段

L40607 引用 ReferenceGradeProfileV3.requiredNamedEntryKeys；实际接口 L35795–L35885 只有 requiredEntryKeys，没有 requiredNamedEntryKeys。当前 73 行 tuple 尚能提供固定 minimum，但该名称会误导 release verifier 实施。应改为真实字段，或新增由 requirements 派生的准确 named-entry projection。

## 覆盖矩阵

| 审查链 | 结果 | 主要证据 |
|---|---|---|
| canonical receipt / producer DAG | [fail] | A-03、A-09、A-11、A-15、A-16、A-19、A-20 |
| authority / secret / network / effect | [fail] | A-01、A-02、A-05、A-06、A-07、A-08 |
| Rights / Billing / DataBoundary | [fail] | A-04、A-05、A-06 |
| retry / delivery_unknown / fallback | [fail] | A-02、A-03 |
| Execution | [fail] | retry/tool exact binding A-02；third-party admission A-08 |
| inference plugin / Execution plugin | [fail] | A-07、A-08 |
| provider 账号与清理 | [fail] | cleanup authority census A-01；MFA/SCA A-18 |
| 固定迁移 | [ok] | existing_connection_migration_only 固定图存在；未发现独立阻断 |
| owner 扩展 | [fail] | A-10、A-11、A-12、B-02 |
| TUF / rollback | [fail] | root/delegation/high-watermark 形状覆盖较完整；current-time closure 缺失 A-17 |
| exact oracle | [ok] | 73/73 exact key census、missing/extra=0；错误 literal wire 调用为 never/TS2345 |
| exact run subject | [fail] | requirement/subject 联合换挂 A-13 |
| 73 行 release claim | [fail] | 73 key 与 inner NoInfer 正确；首发 rights 环 A-04、outer D 换挂 A-14 |
| 四件支持产物 | [fail] | support page/picker/test matrix/release note 四元 tuple 正确；artifact-set 与 outer binding 可跨 D，A-14 |
| UX 状态机 | [fail] | pre-secret rights A-05；authoritative state 无入口 A-16 |
| MFA / SCA | [fail] | graph worst-case 大于 signed class limit，A-18 |
| a11y | [fail] | required presentation matrix 为 caller-shaped expected root，A-15 |
| remote witness | [fail] | B-01 |
| macOS / Linux / Windows | [fail] | helper qualification 存在，platform-bound enrollment producer 缺失，A-19 |
| phase BOM | [fail] | 25/32 suite 缺失、preflight 缺失、failure terminal 假绿，A-20 |
| 性能门 | [fail] | baseline trust root A-15；source headroom B-03 |
| cross-subject / distribution | [fail] | A-02、A-06、A-13、A-14、A-19 |
| required-never / conditional / union inference | [fail] | A-08、A-10、A-13、A-14 |
| 证据自引用 | [fail] | current claims→rights→journey→claims 环，A-04 |
| 中国大陆与全球供给 | [fail] | 73 行 realm census 存在；统一 Rights/ComputePolicy 与发布闭包仍受 A-04、A-06、A-14 阻断 |
| 本地模型与 bridge | [partial] | Ollama/LM Studio/bridge 行与 protocol profiles 存在；全局 release、anchor、UX 门仍失败 |

## 外部事实核验

只使用 2026-08-24 可访问的官方一手资料：

- [The Update Framework Specification](https://theupdateframework.github.io/specification/latest/)：用于 A-17 的固定 update start time 与 metadata expiration 要求。
- [OpenAI Codex configuration reference](https://developers.openai.com/codex/config-reference)：确认 custom provider 的 Responses wire 限制及 command-backed auth 配置，支持 B-04。
- [LM Studio REST API](https://lmstudio.ai/docs/developer/rest) 与 [LM Studio OpenAI compatibility](https://lmstudio.ai/docs/developer/openai-compat)：native REST、OpenAI-compatible Chat/Responses 与 Anthropic-compatible Messages 的目标建模未发现新的独立缺陷。
- [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)：Chat/Responses 与 Responses 非 stateful 的目标建模未发现新的独立缺陷。

未用二手文章、搜索摘要或旧审查结论支撑 finding。

## 最终判定与最小闭包顺序

当前方案不能作为其他开源项目可照抄的 reference-grade 方案。最短的根因闭包顺序是：

1. 先修 A-10、A-08、A-09、A-12、A-13、A-14 的类型级可构造性与联合推断门。
2. 再闭合 A-01、A-02、A-03、A-06、A-07、A-11、A-16、A-19 的 producer/authority DAG。
3. 拆除 A-04 的发布自引用，并为 A-15、A-17 建立不可自填的 trust root。
4. 重算 A-18 UX 最坏路径，重建 A-20 exact phase BOM。
5. 重新运行完整 strict compile、逐 constituent required-never 审计、所有本文正反例、Compiler API census 与 exact suite/BOM 双射。

在 A=20、B=4 的当前状态下，结论只能是 FAIL。

## 结束前冻结复核

报告形成后再次只读核验：

    SHA-256  c9d4c0d3a827f2fc8b4a5a46d6bbf8449e056eec08b68b8170fe5b7f5ce41bd0
    lines     42437
    bytes     2672219
    HEAD      174ab48895aa1e4a6c6b42b9c74187f20efc3cfd

目标 SHA、行数、字节数及仓库 HEAD 均未漂移。