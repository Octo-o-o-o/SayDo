# SayDo AI Supply 参考实现级最终对抗复核 v11

## 输入完整性

审查目标：[2026-08-23-ai-supply-universal-onboarding-final.fable.md](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1)

| 项目 | 预期 | 初检 | 末检 |
|---|---:|---:|---:|
| 行数 | 22,507 | 22,507 | 22,507 |
| bytes | 1,363,124 | 1,363,124 | 1,363,124 |
| SHA-256 | `3b93808d641a6f2a59a1938ae6526280da1d7746dc8acf4197d030cdc6bf8ed1` | 相同 | 相同 |

已完整读取 L1–L22507；输入未漂移。

## 发现

### F-01 [A] 发送 DAG 的 SDK 形状仍反向引用后继 authority，hosted-tool 路径不可同时满足可构造与无环

- 精确行号：L7550–L7571、L7938–L7945、L10299–L10305、L10453–L10460、L16747–L16859、L21279。
- 最短反例：一个 runtime 请求包含一个 hosted-tool occurrence。L16843 要求 `PreparedAttemptDescriptor.hostedToolAuthorizationDigests`；但 `HostedToolAuthorizationBase` 在 L10304 又要求 `upstreamAttemptLease`，而该 lease 在 L7944 反向要求 prepared descriptor。若这些 digest 是准确 authorization digest，则形成 `descriptor → authorization → final lease → descriptor`；若填空集合，则无法证明 hosted-tool occurrence 已无漏授权。第二处同根因是 L16851 的 envelope 含 bundle digest，而 L10456 的 bundle又引用 envelope。
- 现有合同为何不能阻断：内部 `*Receipt` 形状表达了较干净的顺序，但 SDK 同名责任边界给出相反依赖；两者没有唯一优先级。L16859 的 `proves...WithoutAnyReverseDigestEdge: true` 只是声明，无法为循环对象产生首个 digest。
- 根因级最小修法：descriptor 只保存 occurrence inventory、policy/template 与 prepared request，不保存最终 authorization digest；最终 authorization 只进入 bundle。删除 envelope 中的 bundle digest，或将其改名为不被 bundle反向引用的 post-bundle projection。只保留一套 canonical schema，并增加非空 hosted-tool occurrence 的实例 DAG 正例及两条反向边 mutation。

### F-02 [A] authority inventory 是可选且允许空，多个持有排他权/费用 hold 的 lease 无安全退出

- 精确行号：L323–L337、L352–L375、L2040–L2067、L2956、L5841–L5869、L6176–L6207、L6385–L6418、L6603–L6668、L10220、L13463、L15568、L21279。
- 最短反例：`PersistentBudgetCorrectionImpactLeaseReceipt` 原子把 child escrow 和总 balance 都置为 `correction_in_flight`，并冻结新 reservation；随后 daemon 在 apply 前崩溃且 lease 过期。唯一成功后继要求该 in-flight lease，但不存在 abort、expiry、recovery 或 pre-intent closure，余额和 escrow 永久冻结。相同结构还存在于 accepted decision consumption、OAuth refresh family、API-key rotation、settlement/finality、tool gate/commit 与 Execution turn lease。
- 现有合同为何不能阻断：
  - inventory 明确允许 `authorityEntries: readonly []` 和 `permitsEmptyAuthoritySet: true`，没有按 lease kind 推导的必需 authority tuple；
  - 上述 lease 多数仅 `extends ReceiptRef`，不能作为 `PreIntentLeaseClosureReceipt<L extends AuthorityInventoryBearingLease>` 的参数；
  - `notAfter` 只制造过期点，没有过期转换。严格执行期限会永久 in-flight；忽略期限继续提交又会允许过期决定或 authority 生效。
- 根因级最小修法：定义按 lease kind 索引的 `RequiredAuthorityInventory<L>`，对持有 cursor、listener、process、broker、funding、budget、gate 或 effect authority 的类型强制非空准确 tuple；只有显式零 authority 的 lease kind 可为空。为每个 lease 增加 before-intent abort/expiry/restart-recovery terminal，并由 Phase 0 枚举全部 `*LeaseReceipt`，拒绝 plain authority lease、空必需 inventory 和无 terminal 的 in-flight 状态。

### F-03 [A] 人工确认 effect 已提交后，实际 result transition 仍不属于 final union

- 精确行号：L15780–L15791、L15857–L15881、L15997–L16057、L16423–L16429、L22443。
- 最短反例：副作用请求进入 `delivery_unknown`；owner 决定 `effect_committed`，随后产生 `manual_effect_committed_result`。唯一相容转换是 L15865 的 `record_manual_committed_result`，但 `ToolInvocationFinalTransitionReceipt` 没有该分支。L16004 反而再次提取 `record_result`，而该转换只接受 `committed_effect`。
- 现有合同为何不能阻断：所谓可达性断言 L16423–L16429 检查的也是错误组合——`record_result + manual_reconcile`，没有检查真实的 `record_manual_committed_result`。因此断言可绿，但最终 child set 无法收口，下一模型请求不可达。
- 根因级最小修法：将第二个 final 分支改为 `Extract<..., {transition:"record_manual_committed_result"}>`，强绑原 unknown cursor、`manual_reconcile`、owner decision、独立 result authority 和 manual result evidence；增加真实分支 non-`never` 断言及 ordinary-commit/manual-cursor 双向换挂 `never` 断言。

### F-04 [A] unknown-metering 仍有类型级路径进入 evaluator、推荐解和自动 fallback

- 精确行号：L10519–L10540、L10681–L10702、L11569–L11617、L11643–L11720、L17481–L17482、L21273、L21282。
- 最短反例：构造 `FallbackPerSolutionAdmissionReceipt<"dialog">`，令 `fundingDecision.kind="externally_metered_unknown_custom"`；该字段接受完整 `InferenceFundingDecisionReceipt` 联合。相同 unknown template 还能进入任意 `SupplySlotBindingReceipt`，包括 evaluator，并最终生成 `readiness:"review_ready"` 的 solution。
- 现有合同为何不能阻断：fallback admission、slot binding 和 solution 类型均未 `Exclude` 两个 unknown 分支，也没有 `manualOnly/automationEligible:false` 判别字段。引用一致性布尔值至多证明换挂一致，不能把一致但禁止自动化的分支排除。正文却明确要求 custom/official unknown 永不进入推荐、fallback、evaluator或后台。
- 根因级最小修法：把 unknown binding 定义为独立 `ManualOnlySupplyBindingReceipt`；从 evaluator、`SupplySolutionReceipt` 和所有 fallback 类型中静态排除。仅保留用户主动的 exact physical-call consent 路径，并为两个 unknown kind 分别增加 evaluator/recommendation/fallback 提取结果为 `never` 的断言与运行时 mutation。

### F-05 [A] `CapabilityReceipt` 无法表达四槽硬需求，却可签发 `review_ready`

- 精确行号：L10949–L10987、L11569–L11617、L16497–L16526、L21209。
- 最短反例：把同一份 `plain_dialog` 文本能力同时放入 evaluator 的 `capability` 和 `strictSchemaCapability`，再填任意 `ReceiptRef` 作为 independence proof。类型允许生成完整四槽 `SupplySolutionReceipt`，尽管该能力没有 JSON Schema、strictness、reasoning、context/output、usage/cache、vision或 observed-model 字段。
- 现有合同为何不能阻断：正文列出的能力轴大部分根本不存在于 `CapabilityReceipt`；`strictSchemaCapability` 仍只是同一个宽泛类型，thinking/cheap 也没有按槽位收窄。缺失信息无法由 Phase/TCK refinement 重算，`verified...: true` 不能替代证据。
- 根因级最小修法：将 Capability 改为包含完整能力轴、限制值和原始 conformance evidence 的判别联合；定义 `RequiredCapabilityForSlot<S>`，使 thinking、cheap、evaluator 分别要求自己的窄化类型。evaluator 还应强绑同一 subject/route/model evidence 与可验证独立性，并增加 plain-dialog→thinking/cheap/evaluator 的 `never` 断言。

### F-06 [A] discovery semantic subject 把三个安全模式压成两个，static 与 loopback probe 可互相冒充

- 精确行号：L16727–L16741、L16869、L17134、L17225–L17237、L17331–L17368、L21606。
- 最短反例：同一 detector 分别从静态文件和 host-owned loopback probe 发现同一 loopback candidate。两个报告都只能写 `discoveryMode:"passive"`；semantic subject 中没有值能证明究竟执行了零 packet 的 `static_filesystem`，还是有网络能力的 `passive_loopback_metadata`。
- 现有合同为何不能阻断：detector 接口和预算合同使用三个精确 mode，但 semantic subject 与 flat report 仅有 `"passive" | "active_user_initiated"`。签名与逐字段相等检查无法恢复被删除的安全判别信息，直接违背 L21606“前两者不能互相冒充”的验收目标。
- 根因级最小修法：semantic subject 与 flat report统一使用三值 literal；为 static、passive-loopback、explicit-active 分别定义 optional-`never` 的预算、packet、host-probe、sandbox与用户决定字段，并增加三个 mode 的全部 pairwise 换挂负例。

### F-07 [A] 固定 reference minimum 中的 inference `enterprise_managed` 行无法生成 supply journey pass

- 精确行号：L18698–L18725、L18727–L18763、L19110、L19353–L19362、L19387、L19409、L19532–L19552、L19862–L19920。
- 最短反例：投影固定行 `vertex.adc`。它是 `surfaceKind:"inference"`、`journeyTier:"enterprise_managed"`；但 `GaSupplyJourneyUxBindingV2` 只有 `zero_config | guided_key | guided_oauth`。因此 `Extract<GaJourneyDefinitionV2,{journeyClass:"supply";journeyTier:"enterprise_managed"}>` 为 `never`。
- 现有合同为何不能阻断：只有 Execution UX binding 定义了 enterprise tier。固定 minimum 中至少 Vertex 两行、Azure两行、Bedrock三行、Hunyuan和custom mTLS 均为 inference enterprise。现有静态断言只核对若干 key/protocol/recipe，没有对每一 requirement 执行 `surface → journeyClass → tier → definition/pass` 的全函数 non-`never` 检查。
- 根因级最小修法：为 supply 增加 `enterprise_managed` UX binding及对应 scalar/per-class limit，或明确修改相关固定 requirement 的 tier；随后增加对全部61行的穷尽投影断言，要求每行恰好得到一个正确 journey definition、pass payload和 evidence chain，零个或多个都失败。

### F-08 [B] recipe 与 `requiredRuntimeStates` 没有 producer 对账，常见旅程仍可要求未建模配置

- 精确行号：L19111–L19203、L19208–L19220、L19232–L19248、L19257–L19267、L19355–L19362、L19400–L19401、L19532–L19552。
- 最短反例：`azure.key` 要求 `deployment_selected`，但其 `RECIPE_GUIDED_KEY_V1` 只有 `api_key`；`bedrock.api-key` 要求 `region_selected`，仍使用同一只含 key 的 recipe。验证器既可在没有 producer event 时直接声称状态完成，也可在实现时临时增加未进入 recipe/UX 上限的输入。
- 现有合同为何不能阻断：`requiredRuntimeStates` 是任意 `readonly string[]`，没有 state→passive source、field、selection、browser task、broker action或 validation step 的 total mapping。Derivation receipt 只验证已经存在的 recipe fields，不验证每个必需状态恰有一个 producer。
- 根因级最小修法：把 runtime state 改为封闭 typed union，并为每个 requirement提供 `stateProducerMap`，逐状态唯一映射到 trusted default、被动发现、显式选择、外部任务或验证步骤。为 Azure deployment、Bedrock region/model、Execution signed-out/login 等建立产品级 recipe，并把其事件计入 per-class UX 与焦点恢复门。

### F-09 [B] 公平调度 reference evaluator 无法表示 overload，舍入和 signer-realm 共享债务也不唯一

- 精确行号：L17571、L17580–L17594、L17601–L17627、L17650、L17669、L17838–L17868、L21604、L21808。
- 最短反例：五个 publisher 同时满足 `healthy-and-runnable-and-backlogged-and-within-all-quotas`。profile 规定 eligible count=5 开始 overload并最多跟踪8个，但每个 accounting line和step只能表示 `eligibleCountForWholeInterval:0|1|2|3|4`，因此完整 interval无法编码。另对 `-1/12`，`floor-negative` 得到 `-1`，`toward-zero` 得到 `0`，L17593 同时要求二者。
- 现有合同为何不能阻断：状态只要求 stable publisher ID 唯一，没有按 `signerRealmAdmissionAndDebtGroupDigest` 唯一或共享的 group state；同一 signer realm 换两个 publisher ID 可各获初始 credit/debt。artifact digest与 equality 布尔值不能消除输入域和算术本身的歧义。
- 根因级最小修法：区分 `trackedEligibleCount:0..8` 与 `activeReferenceCohortCount:0..4`；明确 waiting publisher 是否参与 accrual。把 admission/debt/reservation 存为 signer-realm group state，publisher ID 仅作 alias。用唯一数学操作定义有符号除法舍入，并发布逐步伪代码；补五至八 publisher、负债除法和同 realm 双 ID 的完整 trace。

### F-10 [B] Execution peer 只按 start kind 收窄，未绑定 admission 的准确 surface

- 精确行号：L12105–L12120、L12611–L12631、L12703–L12757、L12839–L12853、L13209–L13238、L21431。
- 最短反例：session admission 的 `executionSurface.kind="cli_stdio"`；start lease 选择 `local_spawn_or_stdio_handshake`；started terminal 却使用 `LocalExecutionPeerReceipt & {surfaceKind:"agent_http"}`。两者都落在 start-kind helper允许的 identity mode 中，类型可构造。
- 现有合同为何不能阻断：`ExecutionPeerOrProcessIdentityForStartKind<K>` 只检查 `stdio_process | loopback_http_peer | remote_service`，没有以 `sessionAdmission.executionSurface.kind` 为泛型参数。后续 session lease又退回宽泛 `ExecutionPeerOrProcessIdentityReceipt`；`proves...Exact: true` 没有给出可机械生成的 surface/path equality映射。
- 根因级最小修法：以 surface kind 参数化 admission、start lease、terminal和session lease，定义 `StartKindForSurface<S>`、`PeerForSurface<S>`、`SandboxForSurface<S>`；对五种 surface 生成全部 pairwise cross-splice `never` 断言和 strict-schema/CAS mutation。

## 严重度计数

| 严重度 | 数量 |
|---|---:|
| A | 7 |
| B | 3 |
| C | 0 |

## 覆盖矩阵

| 复核面 | 结论 | 关联 |
|---|---|---|
| receipt 可构造性、必填 `never`、实例环 | [fail] 存在循环和不可达分支 | F-01、F-03、F-07 |
| 跨 subject、跨 slot、跨 surface 换挂 | [fail] Execution surface仍可拼接 | F-10 |
| 全部 authority lease inventory 与 before-intent closure | [fail] 非穷尽、可空且多类 lease 不实现 | F-02 |
| descriptor→final lease→bundle→intent→first byte/effect→terminal | [fail] SDK descriptor/envelope存在后继反向 digest | F-01 |
| workload/OAuth/API-key ordinal与 unknown 恢复 | [fail] family/action lease过期后无恢复闭包 | F-02 |
| persistent escrow/finality/correction | [fail] correction/finality/settlement in-flight可永久冻结 | F-02 |
| restart 五阶段、cleanup/reconciliation、direct/reconciled success | [ok] L7135–L7400 未发现独立可复现缺口 | — |
| Execution peer、close/turn CAS、query/cleanup、raw response、manual authority | [fail] peer映射和manual result finality有缺口 | F-03、F-10 |
| production witness实测 | [ok] L3986–L4050、L20529已覆盖production deployment、24小时、逐member run、双observer、quorum、quantile、fault与raw replay | — |
| twelfths公平递推与reference evaluator | [fail] overload输入域、舍入和group state不闭合 | F-09 |
| 61行minimum、recipe、per-class UX、focus | [fail] minimum投影有 `never`，recipe状态无producer | F-07、F-08 |
| discovery semantic subject | [fail] 三种安全模式被压成两种 | F-06 |
| Phase/TCK与核心合同对账 | [fail] 多项验收声明无法由当前类型形状构造或拒绝 | F-01、F-03、F-05、F-07、F-09 |
| 主流API/CLI/订阅/本地runtime是否仍需猜配置 | [fail] required state与输入/动作无全量映射 | F-08 |
| unknown费用、推荐与fallback隔离 | [fail] 类型仍允许unknown进入自动路径 | F-04 |
| 四槽能力与evaluator可信度 | [fail] 缺少槽位所需能力轴 | F-05 |

## 唯一结论

[fail] **FAIL** — 当前文本仍有7项A、3项B，不能作为一次到位、可实施、可验证且达到顶级开源参考实现标准的最终合同。