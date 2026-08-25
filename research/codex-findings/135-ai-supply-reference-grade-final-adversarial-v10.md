# SayDo AI Supply 参考实现级最终对抗复核 v10

## 输入完整性

- 行数：19,742
- 大小：1,182,440 bytes
- SHA-256：`e5100062006a86b5828630a068f51b615c38aee2642229f572271b0b5e5a9cdc`
- 读取前后核对一致：`[ok] input stable`

## 发现

### F-01 [A] 通用 pre-intent closure 强制伪造不存在的三类权限，同时又没有覆盖全部无 intent 终态

- 精确行号：L302–341、L3017–3090、L2213–2224。
- 最短反例：创建 `ApiKeyPkceBrowserLaunchLeaseReceipt` 后、浏览器启动前取消。该 lease 没有 funding reservation，但终态必须提供含 resource、worker、funding 三项的 `PreIntentLeaseClosureReceipt`。
- 现有合同为何不能阻断：三项 closure 均不可选，也没有 `not_acquired` 分支；实现只能伪造 reservation generation/subject，或永远无法构造终态。反向地，OAuth exchange 的 `failed_before_send` 又直接关闭 flow，没有同类 authority inventory closure，也没有要求销毁或释放 authorization-code、verifier、refresh-family 等已冻结权限。
- 根因级最小修法：让每张 lease 固化精确的 authority inventory，并把 closure 改成按 authority kind 判别的 exact-set union；只关闭真实取得的权限，禁止多项或漏项。所有 `intentState=absent` 分支必须原子消费该 inventory，并对 broker handle、listener、worker、resource、funding 分别给出 typed disposition。

### F-02 [A] API-key PKCE 的 before-send 分支包含自相矛盾的必真证明

- 精确行号：L3188–3257，尤其 L3252–3257。
- 最短反例：exchange lease 创建后、send intent 前网络准备失败。该分支同时要求 `sendIntent?: never`、`provesNoSendIntentExistsForExchangeLease: true` 和 `provesSendIntentConsumesExactExchangeLeaseAndCursorRevision: true`。
- 现有合同为何不能阻断：TypeScript 会接受这个布尔字面量，但语义证明不存在合法见证；required-`never` 审计也检测不到“字段不存在却必须证明已被消费”。
- 根因级最小修法：删除消费证明，换成 branch-specific no-intent closure；把 family rotation release、code/verifier disposition和 flow cursor CAS 纳入同一原子终态。增加对该精确矛盾的语义 mutation。

### F-03 [A] persistent budget 的首个 escrow cursor 与 settlement apply 构成无有限实例的环

- 精确行号：L5951–5992、L6187–6213。
- 最短反例：第一个 settlement observation 为 `provisional_usage_correction_horizon_open`。首个 `PersistentBudgetChildEscrowReadyCursorReceipt` 必须引用 `hold_retained` apply；该 apply 又必须引用 `resultingChildEscrowCursor`。
- 现有合同为何不能阻断：同一对象互引形成实例环；若改引下一对象，则形成无限递归。两者都违反 target-before-owner DAG，因此正常 correction-horizon 路径不可构造，finality lease 也没有可用的首个 escrow predecessor。
- 根因级最小修法：增加由 child reservation 原子产生、且不反引 apply 的 `escrow_initial` cursor。之后 apply 只消费 predecessor cursor并产生 successor；finality直接消费 initial/open cursor。每条边必须指向更早 committed revision。

### F-04 [A] credentialed request 的 descriptor 生产顺序与 secret-read 禁令形成生产者环

- 精确行号：L1242–1255、L6823–6852、L6891–6910、L15705。
- 最短反例：Bedrock named static profile 首次 SigV4 请求。`AwsStaticProfileSigningLeaseReceipt` 必须已有 `signatureDigest`，它进入 credential closure，再进入含 `exactWireRequestDigest` 的 descriptor；但 L15705 又禁止 broker 在 descriptor 和 final lease 成功前读取 secret。
- 现有合同为何不能阻断：签名必须读取 secret；提前签名违反禁令，等待 final lease 又无法先构造 descriptor。Basic、Bearer 等需要最终 credentialized wire bytes 的路径具有同一问题。
- 根因级最小修法：descriptor 只冻结 unsigned canonical request、credential component handles和 recipient；条件式 final lease 后由 broker生成 credentialized `AuthorizedSendEnvelope`，再让 hosted authorization bundle绑定该 envelope，最后提交 send intent。

### F-05 [A] final-send authority 存在无法关闭的 bundle-before-intent 崩溃窗口

- 精确行号：L7322–7354、L7443–7564、L9581–9628、L15100–15112。
- 最短反例：final physical lease提交，随后 bundle提交，进程在 send intent前崩溃。
- 现有合同为何不能阻断：bundle已经授予最终发送权，并预先声称将被恰好一个未来 intent消费；但无-intent terminal要求证明 bundle和 envelope均不存在。present-intent terminal又需要实际 intent。两类终态都不可用。与此同时 envelope反向引用 bundle，因此实际顺序只能是 lease→bundle→envelope，与要求的 lease→envelope→hosted bundle相反。
- 根因级最小修法：建立 durable CAS cursor：`lease_ready → envelope_committed → hosted_bundle_committed → send_intent_committed`。envelope不得引用未来 bundle；bundle引用 envelope。每个中间阶段都必须有 authority-retirement terminal，或将最后三步原子提交。

### F-06 [A] send intent 已持久化但首字节未发出时，side-effect hosted tool 没有合法 closure

- 精确行号：L7435–7609、L9396–9415、L9517–9577。
- 最短反例：请求声明一个 provider side-effect hosted tool；bundle和send intent已提交，但 socket 首次写入失败。
- 现有合同为何不能阻断：physical terminal允许 `intentState=present/outcome=failed_before_send`，同时强制 `HostedToolEffectClosureReceipt`。side-effect closure要求每个可能 ordinal 都有 terminal；现有 terminal要么需要真实 callback/gate decision，要么需要 provider证明未调用。零网络字节时两类证据都不存在。
- 根因级最小修法：增加 `request_not_sent` effect closure，要求零 callback、零 gate consumption、零 effect，并以CAS逐项退休全部预签发 gate lease和bundle；只有实际发出或 delivery unknown 才使用现有 occurrence terminal集合。

### F-07 [A] workload logical issuance 没有 ordinal 等值约束、单后继 CAS或临时凭据续发路径

- 精确行号：L507–589、L765–786、L1170–1196、L15718、L19727。
- 最短反例：ready cursor 的 `nextIssuanceOrdinal=7`，却签发 `issuanceOrdinal=9` 的 logical request lease；或者从同一 ready cursor并发签发两个 ordinal 7 lease。
- 现有合同为何不能阻断：logical lease只有独立数字、revision和 `singleUse`，没有 `issuanceOrdinal === predecessor.nextIssuanceOrdinal` 或 subject/revision/ordinal CAS；CAS只出现在后续 physical-step lease。terminal后也没有新的 ready successor，尽管 credential具有 `accessNotAfter`。
- 根因级最小修法：logical lease创建时对稳定 issuance subject执行唯一 CAS，强制 ordinal相等并只递增一次；credential commit/expiry后生成下一 ready cursor，或增加独立的 temporary-credential renewal family cursor。加入 wrong-ordinal、sibling、expiry-renewal和旧epoch mutation。

### F-08 [A] Execution external identity 的 before-intent close terminal 没有任何合法 successor commit

- 精确行号：L11392–11493、L11528–11576。
- 最短反例：active identity取得close lease后，在close intent前 hard-stop。
- 现有合同为何不能阻断：terminal规定结果为 `permanently_blocked`；但 permanent-block commit只接受 start manual-resolution或close `delivery_unknown`，closed commit只接受 `closed_confirmed/authoritatively_absent`。该终态不能进入任何 lifecycle cursor。
- 根因级最小修法：无 close intent时经 typed close-release commit恢复 `active`；若政策确实要求封禁，则将精确的 before-intent terminal加入 permanent-block commit，并明确身份、hold及重启权限的 disposition。

### F-09 [A] Execution result authority未绑定原始响应字节，manual committed-result分支还要求不存在的 committed terminal

- 精确行号：L13531–13630、L14000–14063、L14127–14154、L14251–14266、L15194–15242。
- 最短反例：read-only GET真实返回余额1；同一个success terminal可构造 `resultDigest=余额0` 的 `ExecutionResultEvidenceReceipt`。
- 现有合同为何不能阻断：read-only分支只引用success terminal；terminal只有opaque evidence digest，没有 raw response inventory、framing、decoding/extraction plan或权威结果字节等值关系。相比之下 manual authority明确拥有 `authoritativeResultBytesEvidence`。此外，manual `effect_committed` 只把 unknown effect变为executed，却被最终联合接到要求 `committed_effect` terminal的普通 `record_result`；只能换挂无关 committed terminal或无法构造。
- 根因级最小修法：为每种非manual结果源定义host-owned raw/result inventory、版本化提取计划、完整 occurrence覆盖和结果字节digest；结果必须绑定准确terminal、tool subject和producer authority。manual effect-only决定进入 `executed_result_pending`，取得独立 result authority后再直接形成manual result；删除错误的普通 `record_result` 交叉分支。

### F-10 [A] restart失败终态没有表达真实进程阶段、清理闭包或恢复后继

- 精确行号：L6575–6738。
- 最短反例：旧daemon已终止，新daemon已spawn并取得部分listener/credential authority，但健康检查失败，于是写入 `restart_failed`。
- 现有合同为何不能阻断：失败分支只要求通用 `terminalEvidenceDigest` 和 `liveLeaseForbidden`，不要求旧进程终止证据、新进程树清理、listener关闭、credential/network authority撤销，也没有retry/reconciliation successor。失败cursor因此可以与仍运行的孤儿进程并存。
- 根因级最小修法：按 `before_effect / old_terminated / new_spawned / new_loaded_unknown` 建判别终态；每支要求对应进程身份和typed cleanup。未知阶段进入查询/收养/终止 reconciliation cursor，确认所有实际进程authority关闭后才允许失败收口或重试。

### F-11 [A] reference-grade固定最低集合存在多个互相冲突的权威定义

- 精确行号：L16755–16946、L17802–17803、L18164、L18301–18316、L18877–18879。
- 最短反例：从matrix移除BytePlus ModelArk，同时用其他global entry满足category minimum。`requiredNamedEntryKeys`没有BytePlus，因其为L1也不会被“全部L0必选”补回，但§9.9又声明BytePlus是固定mandatory entry。
- 现有合同为何不能阻断：一处允许owner调整具体产品，另一处规定baseline只能增加或填有限slot；Azure又分别出现“四条独立auth”“Entra或Managed Identity”和遗漏service-principal的三条验收口径。不同verifier可合法生成不同固定集合并保留同一designation。
- 根因级最小修法：只保留一个签名、字面量化的reference minimum对象；补入BytePlus准确entry key，统一Azure四条独立journey，owner只能增加或填显式slot。表格和文案必须从该对象生成，并对每个固定entry分别运行 omission mutation。

### F-12 [A] 四槽 solution 有两套未证明相等的 binding真相源，anti-splice仍可被绕过

- 精确行号：L10689–10752、L10756–10939。
- 最短反例：令 `solution.dialog=A`，但 `exactOrderedSlotBindings[0]=B`；A、B均为dialog、同generation。用B计算四槽rights/funding/data closure，用A作为fallback alternative的named binding。
- 现有合同为何不能阻断：现有布尔证明只要求四个slot key互异、binding不出现在另一个slot以及generation相同；没有声明tuple四项逐项等于四个named字段。alternative中的 `invokedSlot` 与 `invokedSlotBinding` 也没有类型级索引关系。
- 根因级最小修法：删除重复表示，只保留一个canonical slot map/tuple；使用以slot为索引的泛型取得binding、rights、funding、fence和data closure。若保留两种投影，必须逐索引等值并加入named-vs-tuple、slot-vs-binding换挂mutation。

### F-13 [B] remote witness发布合同没有可验证的持续阈值服务资格证据

- 精确行号：L3745–3769、L18832–18864、L19071。
- 最短反例：profile指向已经停服的production deployment，同时填入历史单次black-box report和任意availability/latency SLO digest。
- 现有合同为何不能阻断：operational profile只保存SLO、部署和report摘要，没有观测窗口、逐member探针、quorum append/read成功率、连续性、延迟分布或原始签名报告。Phase 8的24小时soak与anchor TCK也未明确要求针对实际远端threshold deployment持续运行。
- 根因级最小修法：增加typed operational qualification receipt，冻结生产member集合、观测窗口、地域/网络探针、逐member及quorum append/read序列、availability/latency计算、原始报告和签名。reference-grade release必须消费满足固定最小窗口和SLO的资格证据。

### F-14 [B] GA组合UX无法机械验证总手填字段上限

- 精确行号：L16352–16418、L16431–16529、L17012–17028。
- 最短反例：`guided_key`上限为2，但actual记录 `secret=1`、`accountOrPrincipal=1`、`regionOrLocation=1`。
- 现有合同为何不能阻断：`GaUxActualMetricsV2`只有分类计数，没有总 `manualFieldCount`，也没有与外部任务相同的“分类和等于总数”证明；reference limit却只有总上限。组合vector虽然有manualFieldCount，但没有与actual分类字段的确定等式。
- 根因级最小修法：在actual中加入总数，并规定它等于全部分类的精确和；composition同时证明prerequisite/main/unified三层逐分量相加。增加“每类分别合法但总和超限”的固定mutation。

### F-15 [B] 公平scheduler的service curve仍不是可判定合同

- 精确行号：L15761–15842、L18868–18870、L19069。
- 最短反例：第五个publisher在区间中途加入；一个verifier用区间起点eligible count，另一个用区间内最大或逐时刻count，两者得到不同的最低服务量。
- 现有合同为何不能阻断：`serviceCurve`和eligible predicate只是字符串；没有离散时间域、变动eligible count的积分规则、boundary debt递推、quantum舍入、cohort加入/退出时债务转移或实际服务状态机。仅列常数和golden场景无法产生唯一oracle。
- 根因级最小修法：定义结构化、逐quantum的scheduler状态和递推公式，包括容量积分、eligibility epoch、debt更新/封顶/重置、舍入、restart恢复及overload cohort转换；用同一reference evaluator生成并验证全部trace。

### F-16 [B] discovery conformance semantic subject缺少其声称绑定的budget语义

- 精确行号：L15429–15510、L15576–15610。
- 最短反例：构造两份具有相同 `DiscoveryConformanceSemanticSubject`，但 `discoveryBudgetProfileDigest`、mode、provenance或environment不同的report。
- 现有合同为何不能阻断：semantic subject没有这些字段，report却要求 `provesDetectorProductScopeAndBudgetEqualSemanticSubjectExactly: true`。budget没有可比较的target path，因而该证明无法定义；按semantic subject索引的缓存或attestation可换挂不同budget报告。
- 根因级最小修法：把mode、budget、provenance、environment全部加入discovery semantic subject，或建立单一canonical subject并消除重复flat字段；edge manifest必须逐路径等值，mutation逐项替换这些字段。

### F-17 [B] 主流产品只有不透明digest和散文步骤，没有机器可执行的onboarding recipe

- 精确行号：L16908–16919、L17887–17908、L18042–18057、L18513–18549。
- 最短反例：两个Bedrock SSO实现分别要求用户手填不同组合的Start URL、SSO region、account、role和profile name；两者都能引用同一opaque `authProfileDigest`/`requiredUserInputsDigest`并声称满足provider-first。
- 现有合同为何不能阻断：没有按 `(entry, auth journey, platform, realm)` 冻结字段、来源、默认值、发现规则、校验、secret处理、帮助动作、模型选择与恢复路由的typed对象。GA只能数输入次数，不能证明询问的是必要字段，也不能阻止空白配置页。
- 根因级最小修法：增加 `OnboardingRecipeV1`，逐字段规定 `discovered/defaulted/manual` 来源、是否secret、校验与错误处方，并由reference profile固定recipe digest；GA事件日志必须证明只询问该recipe仍缺失的字段。

## 计数

| 严重度 | 数量 |
|---|---:|
| A | 12 |
| B | 5 |
| C | 0 |

## 覆盖矩阵

`[ok]` 仅表示未发现独立于上述问题的新缺口，不抵消最终结论。

| 复核面 | 状态 | 对应发现或依据 |
|---|---|---|
| 不可构造、required `never`、receipt环 | `[fail]` | F-01、F-02、F-03 |
| 错cursor取lease/terminal、ordinal CAS | `[fail]` | F-07、F-08 |
| lease→pre-intent closure | `[fail]` | F-01、F-02 |
| durable intent→首字节/effect→terminal | `[fail]` | F-05、F-06、F-10 |
| descriptor→final lease→envelope→bundle | `[fail]` | F-04、F-05 |
| local/LAN compute与full data-exit | `[ok]` | L7886–8016、L9703–9761、L15710已区分per-attempt compute、LAN authority和full sandbox；credentialed local仍受F-04阻断 |
| 权限/凭据/网络/费用/数据/产品换挂 | `[fail]` | F-04、F-09、F-12 |
| OAuth/API-key start/query/revoke/exchange | `[fail]` | F-01、F-02 |
| remote witness持续阈值服务 | `[fail]` | F-13 |
| persistent budget correction/finality | `[fail]` | F-03 |
| 四槽fallback anti-splice | `[fail]` | F-12 |
| restart真实process | `[fail]` | F-10 |
| Execution global identity/hard-stop/result authority | `[fail]` | F-08、F-09 |
| raw response权威提取 | `[fail]` | F-09；Inference侧L15194–15242已有形状，Execution未接入 |
| conformance semantic subject | `[fail]` | F-16 |
| GA正向终态与两种anchor起点 | `[ok]` | L16970–17270已做判别绑定；固定集合仍受F-11阻断 |
| GA组合UX、全部L0与mutation | `[fail]` | F-11、F-14 |
| 公平scheduler容量与服务曲线 | `[fail]` | F-15 |
| Phase 0语义门 | `[fail]` | F-02、F-03、F-05说明现有门定义不能仅靠TS non-never与布尔证明发现语义矛盾 |
| 主流API/CLI/订阅/本地runtime免猜配置 | `[fail]` | F-17 |

## 唯一结论

**FAIL**

当前文本仍允许不可构造的核心终态、不可闭合的发送权限窗口、结果与原始响应脱钩、跨槽策略换挂及reference-grade最低集合失真，并存在持续服务、GA UX、公平调度和onboarding机械合同缺口。A与B均非零，不能冻结为一次到位的参考实现级实施合同。