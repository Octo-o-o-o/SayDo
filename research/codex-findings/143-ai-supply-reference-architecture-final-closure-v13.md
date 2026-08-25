# AI 供给普适接入方案架构闭包终审 v13

## 1. 最终结论

**Verdict：FAIL**

| 级别 | 数量 |
|---|---:|
| A | 3 |
| B | 2 |
| C | 0 |

冻结前仍有三条机器门可绕过的根本合同缺口，以及两条 TypeScript 合同与资源门缺口。按本轮判定规则，A 或 B 任一非零即不能 PASS。

## 2. 冻结身份核对

终审开始前独立执行：

~~~text
$ shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

$ wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
   28097 1679137 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
~~~

| 项目 | 冻结值 | 实测值 | 结果 |
|---|---:|---:|---|
| SHA-256 | ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743 | ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743 | [ok] |
| 行数 | 28097 | 28097 | [ok] |
| 字节数 | 1679137 | 1679137 | [ok] |

核对通过，以下发现只针对这一冻结字节版本。

报告落盘后再次复核目标，SHA-256、行数和字节数仍分别为
ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743、28097、1679137，
目标未被本轮修改。

## 3. 审查边界与验证方法

- 只读取指定终审 prompt、冻结目标、当前生产代码和 canonical 文件；未读取任何旧评审报告、旧 prompt 或 history 内容。
- 对目标中的 9 个 TypeScript fence 做保留目标行号的提取，使用仓库 TypeScript 5.9.3 执行 strict、noEmit、skipLibCheck、ES2022、NodeNext 编译。
- 先在零 stub 下编译，再按目标第 28097 行的自审口径加入恰好 22 个 any stub；另加入三个最小反例，验证结构合同是否真的拒绝伪造。
- 当前实现基线也做了只读核对。packages/contracts/src/types/modelbinding.ts:29-45 仍是 API、CLI、ACP 的窄联合；packages/daemon/src/providers/openaiCompat.ts:64-118、239-245 仍是直接构造 chat/completions 请求并统一重试一次；packages/daemon/src/config/cliCapability.ts:109-133 仍是扁平能力快照；packages/console/src/lib/setupApi.ts:72-95 仍是四槽简单写入合同。目标第 28095 行明确说当前仅完成方案文档、尚未施工，和代码现状一致。本报告不把未来合同当作已实现能力。

关键机械结果：

~~~text
零 stub：
architecture_compile_exit=2
diagnostics=25
distinct_missing_names=22

22 个 any stub：
compile_exit=0
Lines of TypeScript: 25448
Instantiations: 617899
Memory used: 1651875K
Total time: 10.04s
10.40 real
1807368192 maximum resident set size

22 个 any stub + 三个反例：
counterexample_compile_exit=0
compiler stdout bytes=0
~~~

## 4. 逐条发现

### A-1：runtime recovery 的期望集合不是从 requirement 派生，且证据可跨行换挂

**级别：A**

**准确锚点**

- 目标 22592-22650：ReferenceRuntimeStateV3 明确包含 signed_out、session_recovery、route_drift、failover_unknown 等状态。
- 目标 23142-23150：LOCAL_UNMANAGED_RUNTIME_RECOVERY_SCENARIOS_V4 只列 not_installed、not_running、cold、no_model。
- 目标 23383-23402：Execution stdio 与 local stdio 直接复用上述本地推理恢复场景。
- 目标 23492-23519：Execution HTTP、CC Switch bridge、LiteLLM bridge 继续通过 spread 继承同一组场景，没有按自身 requiredRuntimeStates 改写。
- 目标 23809-23815：Codex、Kimi、OpenCode、普通 CLI、CC Switch、LiteLLM 的 requiredRuntimeStates 分别要求 signed_out、session_recovery、password_optional、route_drift、failover_unknown、secret_optional 等不同状态。
- 目标 23905-23925：GaReferenceRuntimeRecoveryRunSubjectV4 只遍历 onboardingRecipe.runtimeRecoveryScenarios，没有从当前 row 的 requiredRuntimeStates 派生或校验恢复集合。
- 目标 24979-25012：GaRuntimeRecoveryUxGateReceiptV4 和 GaRuntimeRecoveryJourneyEvidenceV4 没有按同一个 requirement、state、scenario、distribution 参数化；precondition、graph terminal、positive report 和 positive terminal 都是宽类型。
- 目标 25631-25663：ecosystem gate 只比较自己派生出的 expected/actual digest 数组，并接受宽泛的 GaRuntimeRecoveryJourneyEvidenceV4 数组。
- 目标 26878、27342：验收文字却要求全部负向 runtime state 有准确恢复图、准确首步与完整后链。

**反例**

以 codex.app-server 为例，row 要求：

~~~text
not_installed, signed_out, ready, session_recovery
~~~

实际恢复 run 的类型投影来自复用 recipe，得到：

~~~text
not_installed, not_running, cold, no_model
~~~

因此 signed_out 和 session_recovery 没有恢复 run；反而多出与该 row 无关的 not_running、cold、no_model。GaEcosystemGateReportReceipt 的 expected 集合也由同一错误输入派生，所以 expected=actual 仍可自洽通过。

另外，以下结构反例在 22 个目标自述 stub 下通过 strict TypeScript：给任意 recoverySubject 配一个别的 requirement 的 observes_precondition 收据、任意 ReceiptRef graph terminal、任意 completed_pass report 和任意 positive terminal，再把 proves...Exact 写为 true，即可构造 GaRuntimeRecoveryJourneyEvidenceV4。编译退出码为 0，零 diagnostics。

这不是单纯漏测。session recovery、delivery unknown、route drift 或 failover unknown 缺少准确恢复终态时，系统仍可能取得 GA/release 证据；执行面可能重复发送或错误恢复会话，bridge 可能在漂移路由上继续工作，属于费用、副作用和机器门绕过风险。

**根因修复**

1. 为每条 ReferenceRequirementRowV3 增加受签且封闭的 runtime-state classification，明确哪些状态是 positive、precondition-only、recovery-required。
2. 定义 RecoveryScenarioTupleFor<R>，由 R 的 recovery-required state 精确映射生成；recipe 只能提供实现模板，不能决定 GA 期望集合。缺、重、多余 state 均应成为类型和 schema 错误。
3. 将 recovery subject、UX gate、precondition、graph terminal、post-graph positive chain 全部参数化为 GaRuntimeRecoveryJourneyEvidenceV5<R,S,D>；只允许私有 commit producer 消费同一个 R、S、run subject 和 distribution。
4. ecosystem gate 消费按 requirement key 和 state key 映射的封闭 tuple，而不是宽数组加调用方可写布尔和 digest。

**机械验收**

- 对全部 63 行重算 recovery-required state 与 scenario key 的双射。
- 删除 Codex 的 signed_out 或 session_recovery、给 Codex 增加 cold、删除 CC Switch 的 route_drift 或 failover_unknown、把 LiteLLM 的 secret_optional 换成 no_model，均须让 TypeScript fixture、Zod refinement 和 ecosystem gate 非零。
- 把 A row 的 precondition、graph terminal、positive report、positive terminal或 distribution 换挂到 B row，必须在编译期或私有 producer 提交时失败。
- 每条 recovery-required state 的正例必须从准确 first step 到 recovery terminal，再经过 live conformance、activation commit 和 active-pointer commit。

### A-2：review_ready 仍可直接伪造，四槽 qualification 还允许复用无关 journey gate

**级别：A**

**准确锚点**

- 目标 13083-13103：SupplySolutionReceipt 是普通结构接口，直接携带 readiness: "review_ready"，没有私有品牌或构造函数。
- 目标 24866-24874：GaReviewConversationReadyGateForDistributionV4 只由 conversation_ready 与 distribution D 约束，不含 solution、slot ordinal、slot binding 或 requirement。
- 目标 24901-24939：逐槽 qualification 虽有私有品牌，但 commit 输入接受上述只按 D 约束的 journey gate。
- 目标 24941-24977：四槽 tuple 和全局 qualification 是另一张收据；它不会生产或改变 SupplySolutionReceipt.readiness。
- 目标 25914-25916：静态断言只证明 GaJourneyPassPayloadV2 不能自报 review_ready，没有验证 SupplySolutionReceipt 不能直接自报。
- 目标 26044、27342：文字宣称全局 review_ready 只能由四槽私有 producer 生成，且每槽必须绑定自己的 conversation-ready journey gate。

**反例**

以下等价最小对象通过 strict TypeScript：

~~~text
const forged: SupplySolutionReceipt = {
  ...arbitraryReceiptRef,
  solutionId: "forged",
  solutionGeneration: 1,
  slots: arbitraryFourSlots,
  slotOrder: ["dialog", "thinking", "cheap", "evaluator"],
  slotTupleDigest: "d",
  completeRightsDataFundingFenceAndComputeClosureDigest: "d",
  crossSlotEvaluatorIndependenceProof: arbitraryProof,
  readiness: "review_ready",
  provesExactlyFourDistinctSlotKeysAndNoBindingAppearsUnderAnotherSlot: true,
  provesAllBindingsPoliciesFundingFencesAndIndependenceShareThisSolutionGeneration: true,
  hardStopGeneration: 1,
  expiresAt: "2099-01-01T00:00:00Z"
}
~~~

它没有任何 GaReviewSolutionQualificationReceiptV4。实测反例编译退出码为 0，零 diagnostics。

即使调用私有 qualification producer，也可以把同一个只绑定 distribution 的 GaReviewConversationReadyGateForDistributionV4<D> 传给四个 slot，因为该类型与 S、I、binding identity 和 requirement 无关。这违反“每槽自己的 journey gate”，但在函数签名上合法。

结果是 UI、fallback 或其他只消费 SupplySolutionReceipt.readiness 的机器路径可以展示或传播 review_ready，而无需四槽 live/activation/evaluator 证据；即使 release gate要求一张 qualification，也仍可能四槽复用同一无关 journey gate。属于验收机器门绕过。

**根因修复**

1. 从 SupplySolutionReceipt 删除 review_ready；它只表达四槽候选解和当前较低 readiness。
2. 新建带私有品牌的 ReviewReadySupplySolutionReceiptV5<S,D>，唯一 producer 必须原子消费准确四槽 qualification tuple，release、UI 与任何 review-ready 路径只接受这一类型。
3. 将 journey gate 参数化为 GaReviewConversationReadyGateV5<S,I,R,D>，其 run subject、bindingIdentityDigest、slot、successful chat terminal、activation pointer 和 distribution 必须与当前 tuple 成员同值。
4. runtime schema 与实例图 verifier 必须拒绝裸 SupplySolutionReceipt 冒充 review-ready，也不能只相信 proves... 布尔字段。

**机械验收**

- 直接写 readiness: "review_ready"、缺任一 qualification、重复 slot ordinal、复用同一 gate、换挂 requirement/binding/pointer/chat terminal/distribution/evaluator proof，均须在 TypeScript、schema、producer 与实例图门至少一层确定失败。
- 正例必须由四个不同 ordinal 的 tuple，逐槽各自 journey gate 和同一 distribution 生成唯一 ReviewReadySupplySolutionReceiptV5。
- mutation gate 必须直接针对 SupplySolutionReceipt 伪造，而不是只针对 GaJourneyPassPayloadV2。

### A-3：restart recovery sweep 用裸 ReceiptRef 冒充 after-intent 对账，无法证明逐租约双射

**级别：A**

**准确锚点**

- 目标 1001-1031：before-intent AuthorityLeaseRecoveryTerminalReceiptV3 至少通过 registry-dependent 私有 producer 绑定 registry entry、lease、cursor 与 closure。
- 目标 1033-1045：AuthorityLeaseRestartRecoverySweepReceiptV3 却是无品牌的普通接口；afterIntentDomainSpecificReconciliationTerminals 的元素类型仅为 ReceiptRef。
- 目标 26596-26599：Phase 0 承诺未登记 bare ref 使 gate 非零，并要求 sweep 精确覆盖全部非终态租约后才放开 restart admission。
- 全文只有这一处 AuthorityLeaseRestartRecoverySweepReceiptV3 定义，没有对应 commit producer。

**反例**

本轮构造了：

~~~text
discoveredNonterminalAuthorityLeases: [oneOutstandingLease]
recoveryTerminals: []
afterIntentDomainSpecificReconciliationTerminals: [unrelatedReceiptRef]
provesEveryNonterminalLeaseHasExactlyOneBeforeIntentRecoveryOrAfterIntentDomainReconciliation: true
provesRecoveredLeaseAndTerminalSetsAreAKeyedBijectionWithoutForeignRegistryEntry: true
~~~

该对象在 strict TypeScript 下合法，编译退出码为 0。它既不证明 unrelatedReceiptRef 属于该 lease，也不证明 intent、cursor、hold disposition、effect/network/funding authority 已终结。

daemon 重启后，任意无关收据都可被当作 after-intent reconciliation terminal，从而提前开放 restart admission。对 network send、tool effect、funding reservation 或 secret lease，这会造成重复副作用、重复费用、泄漏 hold 或数据状态分叉，属于安全与数据一致性 A 级问题。

**根因修复**

1. 把 authority registry 的每个 after-intent 分支映射为封闭的 AfterIntentReconciliationTerminalFor<P>；类型必须携带准确 registry entry、subject lease、intent、in-flight cursor、权威 outcome、hold disposition 和终态 cursor。
2. 定义 RestartRecoveryItem<P> 为 before-intent terminal 与该 P 的 after-intent terminal 的互斥联合。
3. 只允许私有 commitRestartRecoverySweepV4 接受按 canonical lease key 排序的 mapped tuple，并在同一 durable CAS 中验证 discovered set 与 terminal set 的精确双射。
4. restart admission 只消费品牌化 sweep commit，不能消费普通接口或调用方提供的 proves... 布尔。

**机械验收**

- 对 registry 的每个 concrete constituent 至少覆盖 before-intent、after-intent known terminal、delivery/effect unknown with hold 和 crash boundary。
- foreign registry entry、wrong lease、wrong intent、wrong cursor revision、漏项、重复项、一个 terminal 覆盖两条 lease、裸 ReceiptRef，均须使 phase gate 非零。
- 正例必须证明全部 discovered nonterminal leases 恰有一个同 key terminal，并在 sweep 提交前保持 restart admission 关闭。

### B-1：所谓 22 个“外部 SDK 边界”实际包含核心 IR、wire、discovery 与 snapshot 类型，any stub 使 strict 绿灯失去语义

**级别：B**

**准确锚点**

- 目标 19143-19209：ProtocolAdapter、WireEventDecoder、DiscoveryDetector、ConnectorPluginHost 使用未定义的 request/event IR、protocol target、discovery context/evidence 与 host handle。
- 目标 19389-19405：AdaptationPlan 使用未定义的 IrFeature、AdapterWarning、WireRequestPlan。
- 目标 19544-19576：ActiveSupplySnapshot 使用未定义的 compiled binding、endpoint/auth handle、policy/fold/fallback program 与 adapter runtime handle。
- 目标 28097：自审宣称只为 22 个“明确的外部 SDK 边界名称”提供 any stub，并据此报告 strict 0 diagnostics。

**反例**

对 9 个 TypeScript fence 做行号保持提取，不加 stub 时，编译退出 2，产生 25 个 TS2304，涉及 22 个不同名称：

~~~text
AdapterRuntimeHandle, AdapterWarning, AuthHandle,
CompiledAuthorizationFoldProgram, CompiledBinding,
CompiledFallbackPlanTemplate, CompiledPolicyProgram,
ConnectorEvidence, ConnectorExtensionCapability, DecodeContext,
DiscoveryEvidence, EndpointHandle, ExplicitActiveDiscoveryContext,
HostOwnedProbeResult, InferenceEventIR, InferenceRequestIR, IrFeature,
PassiveLoopbackPlanContext, ProtocolTarget, PublicMetadataHandle,
StaticDiscoveryContext, WireRequestPlan
~~~

其中 InferenceRequestIR、InferenceEventIR、WireRequestPlan、CompiledBinding、AuthHandle、policy/fold/fallback program 和 ActiveSupplySnapshot 的 runtime handle 都是本方案的核心内部边界，不是可忽略的第三方 SDK 实现细节。把它们设为 any 后，adapter 可漏 tool occurrence、wire location、auth subject、route fence 或 snapshot identity，strict 编译仍不会报错。

**根因修复**

1. 在冻结方案中给这些 host-owned 类型定义最小、版本化、判别且可闭包的形状；真正的第三方对象只能以 unknown 加 opaque handle 封装，不能用 any。
2. 明确跨 package import 来源和版本；核心 IR、wire plan、snapshot handle 必须由 SayDo 持有并进入 schema/edge manifest。
3. Phase 0 语义编译禁止临时 any stub、skipMissing-style 旁路和未解析名称；对政策、授权、费用、数据、route、occurrence 字段开启 no-explicit-any AST 门。

**机械验收**

- 9 个 fence 在零 stub 下 strict 编译为 0 diagnostics。
- 删除任一 required IR occurrence、把 auth handle 换挂另一 subject、让 wire plan 越过 adaptation coverage、让 runtime handle 指向另一 core entry，均须编译或 verifier 失败。
- 外部 SDK fixture 只能通过显式 decoder/normalizer 从 unknown 进入 typed IR，不能直接写 host receipt。

### B-2：合同冷编译已占约 1.81 GB RSS，但 Phase 0 没有 TypeScript 资源预算或回退门

**级别：B**

**准确锚点**

- 目标 26598：Phase 0 只要求 strict schema/TypeScript 语义编译、never 审计和 fixture，没有 elapsed、RSS、instantiation 或 compiler-version 预算。
- 目标 27291-27293：性能门只覆盖 discovery、dispatch、stream 和 runtime soak，没有合同编译性能。
- 目标 28091：总结声称开放 mapped union 的编译器耗尽内存已修，并落到“strict TypeScript 性能门”，但正文不存在可执行的编译资源门。

**反例**

去掉三个反例，只保留目标的 22 个 stub 与 9 个 fence，实测：

~~~text
Lines of TypeScript: 25448
Types: 199677
Instantiations: 617899
Memory used: 1651875K
Check time: 9.85s
Total time: 10.04s
maximum resident set size: 1807368192 bytes
~~~

编译能够结束，但仅合同草图已占约 1.81 GB RSS，约为方案最低 8 GiB runner 的五分之一；尚未加入真实 Zod、producer、implementation 和测试实例。已知前代根因是类型组合爆炸，而当前没有任何机械阈值阻止它在 Phase 0 或后续 Phase 回归到 OOM。把“这次能编完”当作性能门，会使最低档 CI、开发热循环和多矩阵并发的承诺不可判定。

**根因修复**

1. Phase 0 开工前由 owner 签定 TypeContractCompileBudgetV1，冻结 TypeScript/Node 版本、正式 runner、冷/热条件、elapsed、max RSS、type instantiation 与 diagnostics 上限；不能在施工后用实测坏基线反向定义合格。
2. 将资源测量加入 check-ai-supply-phase0-gate.mjs 和持续 CI；报告原始 extendedDiagnostics 与 OS RSS。
3. 在签预算前先拆分独立合同包、减少全量 distributive conditional/mapped union、为开放扩展改用常数复杂度封闭 core + registry lookup，直到有足够余量容纳真实实现。

**机械验收**

- 同一冻结 fixture 在正式最低档 runner 上重复冷编译，P95 elapsed、max RSS 和 instantiations 全部不超过 owner 预先签定的绝对上限。
- 加入已知 mapped-union 组合爆炸 mutation 时，性能门必须非零，而不是等待进程 OOM。
- Phase 1-8 每阶段在同一 workload 上同时执行绝对门和相对上一冻结基线回退门；版本或 runner 变化必须重新签基线，不能静默放宽。

## 5. 七项覆盖结论

| 审查面 | 结论 |
|---|---|
| 两平面、Inference/Execution/bridge/control | 文本与主判别轴基本分开；但核心 IR、wire plan 和 runtime handle 未定义，见 B-1，因而不能证明数据面闭包。 |
| receipt edge、authority、cursor、首字节与恢复 | before-intent 主链有依赖类型；restart sweep 的 after-intent 裸收据直接破坏闭包，见 A-3。 |
| auth、rights、billing/funding、data/compute/network | 未发现独立于本报告五条之外的新 A/B；这些仍是未来合同，当前代码未实现，不能据文档宣称已受保护。 |
| connector、detector、registry/TUF、sandbox、release | TUF/plugin/release 有分层设计；SDK/host 边界被 any 掏空，见 B-1。未发现额外的三平台不可实现矛盾。 |
| 63 requirements、run/journey/evidence/GA、四槽 readiness | runtime recovery 投影错源且证据可换挂，见 A-1；review_ready 可伪造且 gate 可复用，见 A-2。 |
| TypeScript、扩展复杂度、性能/稳定性 | 零 stub 不可编译，any stub 后语义失真，见 B-1；冷编译资源无门，见 B-2。 |
| Phase 0-8、owner 决策、canonical、测试与 DoD | 阶段顺序和未实施口径可判读；但 A-1/A-2/A-3 的承诺没有对应可拒绝反例的合同，B-2 的性能门也未定义，故当前 DoD 仍不可判定为闭包。 |

## 6. 冻结处置

当前冻结候选不能通过架构闭包终审。应先按 A-1、A-2、A-3 修复机器真值与私有 producer，再补齐 B-1 的零 stub 合同和 B-2 的预签资源门；随后重新冻结准确字节并执行全新零上下文终审。

**最终计数：A=3，B=2，C=0，Verdict=FAIL。**
