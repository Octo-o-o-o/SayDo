# SayDo AI Supply 参考架构最终闭包复核 v8

## 单一结论

`FAIL`

计数：A=6，B=1，C=0。

当前冻结方案仍允许工具状态不可达、fallback 在成功后继续调用、持久预算扩出新的物理请求额度、anchor bootstrap 调和永久卡死，以及正式 conformance 报告脱离其适用主体。按本轮规则，只有 A=0 且 B=0 才能给出 `PASS`。

## 读取完整性

- 评审目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 初始核对：14,502 行，945,084 bytes。
- 初始 SHA-256：`5ae8c540fe32e67cc6bae3788f22b90126223e3914dce5f236d273d0f2e51d65`。
- 读取方式：连续分段完整读取 1–14,502 行；随后只对同一目标做定向 `rg`/`sed` 复核。
- 最终核对：14,502 行，945,084 bytes。
- 最终 SHA-256：`5ae8c540fe32e67cc6bae3788f22b90126223e3914dce5f236d273d0f2e51d65`。
- 输入结论：`[ok] input unchanged`。
- 隔离边界：未读取源码、旧 prompt、旧 review、journal、计划索引或其他仓库文件；未修改目标。

## 发现

### A-1：local state write 的合法 terminal 被复合 literal + `Extract` 静默擦除

位置：10127–10145、10390–10398、10474–10482、10494–10505、14500–14502。

最短反例：

1. 一个本地事务取得 `ExecutorCommitLeaseReceipt`，写入成功。
2. 它合法地产生 `ExecutionToolEffectTerminalReceipt`：`effectClass="local_state_write"`、`outcome="committed"`、`continuation="tool_complete"`。
3. local 分支把 `outcome` 写成单一 constituent 内的 `"committed" | "not_committed"`（10131–10137）。
4. `ToolInvocationTransitionReceipt.transition="commit"` 却要求 `Extract<ExecutionToolEffectTerminalReceipt, { outcome: "committed" }>`（10390–10398）；`ExecutionToolCommittedTerminalCursorReceipt` 又作同类窄化（10474–10482）。TypeScript 的 `Extract` 按 union constituent 判定，含宽 literal union 的 local constituent不满足窄 literal，因此被整体丢弃。
5. 结果是 provider/external committed 分支仍让整个 `Extract` 非 `never`，但 local committed terminal 无法进入 `commit`；local `not_committed` 同样无法进入 10501–10505 的 abortable terminal cursor。

为什么现有合同/门禁挡不住：14502 的“0 diagnostics”和“必填 `never` 为 0”不证明某个具体 constituent仍可赋给下游窄化类型；这里整个 alias仍因 provider分支而非空。13885 的 fixture说明只泛称六类终态与交叉拼接，没有要求一个 local committed 和一个 local not-committed 正向类型构造。实现完全照抄会让本地状态写主路径停在 `effect_terminal`，属于合同可构造但核心分支不可达。

最小根因级修法：把 local 分支按 `outcome` 真正分成 `committed` 与 `not_committed` 两个 union constituent，并与两个 continuation constituent做显式笛卡尔展开；或引入明确的 distributive helper，但最终导出的每个 constituent必须只有一个 outcome literal。新增正向类型断言覆盖 local committed→commit→final、local not-committed→abort/next edge，并保留跨 effect class 的反向断言。

### A-2：人工确认 effect committed 后没有可构造的最终 tool transition

位置：10434–10456、10508–10557、13885、14133。

最短不可达路径：

`executing_unknown` → `manual_reconcile(effect_committed)` → `executed` → `record_result`。

前半段由 10434–10440 明确定义；但 `ToolInvocationFinalTransitionReceipt` 的 `record_result` 分支把 `executedTransition` 固定为 `transition="commit"`（10509–10514）。人工分支只收录 `manual_reconcile_result | manual_reconcile_no_effect`（10542–10549），完全没有 `manual_reconcile(effect_committed)` 后再记录结果的 final 形状。

为什么现有合同/门禁挡不住：`ToolInvocationTransitionReceipt` 中宽泛的 `predecessor?: ReceiptRef` 也无法改变 `ToolInvocationFinalTransitionReceipt` 的必填类型。`ExecutionToolResultsAppliedReceipt.completedToolTerminals` 只接受该 final union，所以这个已由 owner确认提交的工具永远不能进入 results-applied，turn也无法收口。13885 与 14133 宣称人工调和和六类 final transition 可达，但没有一种类型能见证这条路径。

最小根因级修法：为 `record_result` 增加严格分支，使 `executedTransition` 可判别为普通 `commit` 或 `manual_reconcile(effect_committed)`；后者必须绑定原 unknown-effect terminal cursor、同一 owner decision/consumption 和准确 result。也可新增独立 `record_manually_reconciled_committed_result` final constituent。增加这条正向端到端类型/模型 fixture，并拒绝把普通 committed cursor与 unknown cursor互换。

### A-3：fallback 外层 terminal 可把内层 success/unknown 改写成可 advance 的失败

位置：5391–5437、8128–8208、11413、13697、14132。

最短反例：

1. solution A 的 `RuntimeRouteSequenceTerminalReceipt` 已是 `outcome="success"`，内层请求和账本均已 terminal。
2. 构造外层 `FallbackSolutionTerminalReceipt`，引用该合法内层 terminal，却选择 `outcome="retryable_failure"`、`sentState="sent"`、`continuation="advance"`、`resultingFallbackCursorState="ready"`（8152–8157）。
3. `FallbackReadyCursorReceipt` 接受这个外层 terminal，随后 solution B 取得新 lease并再次发送。

同一结构还允许把内层 `delivery_unknown` 改写成外层 `failed_before_send/not_sent`，从而释放/漏记前项 hold并继续 B。`runtimeRouteSequenceTerminal` 在 8137 只是未窄化的强引用；唯一 proof 字段 `provesInnerRuntimeSequenceTerminalBeforeFallbackAdvance`（8139）只证明先后顺序，不证明 inner outcome、任一 sent、actual report、billing disposition 与 outer outcome相容。内层自身的 `terminalReasonFoldDigest`（5404）也没有版本化派生算法或被外层判别联合消费。

为什么现有合同/门禁挡不住：11413 的 prose说“成功立即关闭”，但结构和已命名 proof只要求内层先关闭；通用 edge-manifest声明没有列出该字段的结果映射 predicate。13697 的“字段换挂”和完成定义也未给出 success→terminal、unknown→terminal、仅特定 exhausted/failure→advance 的机器映射。照当前类型实现，第二次调用、额外费用和数据外发均可在有效签名对象下发生。

最小根因级修法：让外层 terminal 按内层 terminal的 typed outcome/sent aggregate判别。至少定义穷尽映射：inner success只能 outer success+terminal；inner delivery_unknown只能 outer delivery_unknown+terminal并保留 hold；只有明确、事前登记且 inner fold判定可 fallback 的结果才能 advance。outer billing disposition必须由内层 actual report/ledger fold派生，不能另填。给每个合法映射一条正例、每个交叉组合一条 mutation。

### A-4：四类正式 conformance report 的适用身份在 canonical core 中不存在

位置：11332–11345、11393、13140、13658、13678–13681、13940–13947。

最短反例：同一个 `connectorDigest/profileDigest/fixturesDigest/deterministicResultsDigest` 的 capability payload，可被解释为模型 A 或模型 B；core中没有 provider product、endpoint、model、artifact identity字段。类似地，discovery core没有 detector/budget/provenance identity，execution core没有 agent surface/peer/sandbox/Gate identity。

为什么现有合同/门禁挡不住：`ConformanceResultCore` 实际只有六个共享 digest，加 `reportKind`；仅 protocol分支多一个 `plane`（11332–11345）。11393 和 13940–13947 却要求按 kind携带上述身份，13678 又要求严格拒绝不适用/占位字段。若 schema是strict，所要求的字段无位置可写，正式报告合同不可构造；若只使用现有 shape，则报告可跨模型、detector或Execution surface借用。外层 `ConformanceRunPayload`/release binding只绑定运行物与distribution，无法补回缺失的被测语义主体，13140 所述 report-kind/surface/protocol/auth equality也没有输入可比。

最小根因级修法：把 `ConformanceResultCore` 改成四个真实 discriminated constituents：protocol绑定plane/protocol/wire implementation；capability绑定product/endpoint/model/artifact/capability profile；discovery绑定detector/mode/budget/provenance；execution绑定surface/wire/peer/sandbox/Gate/funding/idempotency。所有适用身份进入 deterministic core digest，不适用字段用 `never`。新增 A→B model、detector、surface、sandbox 和 distribution换挂的反向fixture。

### A-5：anchor bootstrap 的 reconciliation query 缺少传输失败 terminal，首次故障后可永久卡在 in-flight

位置：2935–2968、3101–3146、3235–3245、3730–3737、12617、13171、13890。

最短不可达路径：

1. enrollment request产生 `delivery_unknown`，进入 `bootstrap_reconciliation_ready`。
2. 取得 `AnchorBootstrapReconciliationLeaseReceipt`，cursor进入 `bootstrap_reconciliation_in_flight`。
3. status query在首字节前遇到offline/proxy失败，或发送后响应丢失、用户取消、deadline。
4. `AnchorBootstrapReconciliationTerminalReceipt` 只允许 `enrollment_found | authoritatively_absent | still_unknown`（3130–3145），且无条件要求 `authoritativeWitnessStatusEvidence`（3125）。没有witness响应时三者都不能诚实构造，也没有 no-send、delivery-unknown、cancel、deadline分支让cursor返回ready或terminal。

为什么现有合同/门禁挡不住：view-state里有offline/proxy blocked不等于状态机存在合法producer。12617、13171 和 `platform-anchor-offline-mode.tck` 声称覆盖offline、proxy和反复调和，但当前 query union无法表达最短网络失败；把本地网络错误伪装成 `authoritativeWitnessStatusEvidence` 又违反字段权限。故fresh install在一次常见故障后可永久失去full-mode enrollment恢复路径。

最小根因级修法：把 reconciliation terminal拆成传输 delivery轴和权威 status轴。not-sent/cancel/deadline返回带退避的 reconciliation-ready；sent/response-loss进入保持稳定identity的 query-unknown状态并禁止重复 enrollment；只有验证过的 witness status才能产出 found/absent/still-unknown。为每次query增加与bootstrap一致的字节/时间/总尝试预算，并让offline/proxy/取消/kill-point拥有正向terminal fixture。

### A-6：late correction 可凭空增加持久预算的物理请求额度并丢掉 outstanding hold

位置：3918–3930、3969–4020、4162–4177、4288–4304、4360–4437、11418、13366–13367、13877。

最短反例：前驱余额cursor已有 `remainingPhysicalRequestCap=0`、`outstandingChildCount=1`、`aggregateOutstandingPhysicalRequestHold=1`。一次仅更正账单金额的 covered late correction可构造 `PersistentBudgetCorrectionImpactReceipt`，把 `resultingPhysicalRequestCap` 填成100，然后生成相等的ready cursor；也可把后继cursor的 outstanding count/physical hold填成0。

为什么现有合同/门禁挡不住：正常 child reservation和final settlement都显式携带 physical cap、outstanding count和aggregate physical hold（4162–4177、4288–4304）。correction impact只携带 `resultingPhysicalRequestCap`，却没有它与前驱相等的公式；甚至完全缺少 `resultingOutstandingChildCount` 与 `resultingAggregateOutstandingPhysicalRequestHold`（4378–4392）。现有 proof名只证明 ledger correction、previously released billing amount与billing delta，ready/exhausted cursor上的 `provesCorrectionDeltaAndBalanceRevisionEqual`也没有给出这些物理字段的派生规则。`persistent-budget-ledger.model` 泛称总cap不超，但没有一条字段级 invariant可供generator生成此处的same-value/predicate；只让后继等于伪造的impact结果并不能阻止扩额。

最小根因级修法：late billing correction必须显式声明并证明 physical request cap、outstanding child set/count和aggregate physical hold与前驱保持不变；若业务确需改变其中任一项，另建有独立授权和精确算术的transition。把全部 resulting字段放进impact receipt，给出固定 derivation algorithm和manifest same-value pairs，并增加“余额0、covered correction不能变成1”的N/N+1 mutation。

### B-1：GA UX actual记录了copy/paste与离开返回，但planned contract没有对应上限

位置：11949–12004、12006–12022、12626、13592、13829–13838、14305。

最短反例：一个 `guided_key` run在同一个外部task和180秒内往返页面20次、copy/paste 20次；它仍可让 `maximumExternalTasks`、各task class、手填字段、provider steps、error/recovery和时间全部不超。actual payload会记录 `copyPasteCount=20`、`leaveAndReturnCount=20`（11995–11996），但 `GaUxPlannedMetricsV2` 没有 `maximumCopyPasteCount` 或 `maximumLeaveAndReturnCount`，所以 `provesActualMetrics...DoNotExceedPlan`没有可比较的planned字段。

为什么现有合同/门禁挡不住：§12.1 对 `guided_key` 明确要求最多一次离开/返回（13837），Phase 6和历史回修又明确把copy/paste、离开/返回分别计数并设硬上限（13592、14305）。typed event inventory能证明“数了多少”，不能凭一个布尔proof补出缺失的上限。若verifier另行硬编码journey tier常量，就产生第二份未进入profile digest的口径，仍不满足“planned/actual逐字段重算”。

最小根因级修法：在 `GaUxPlannedMetricsV2` 增加两项上限，并把journey tier→planned数值的唯一派生表纳入profile/runner digest；actual gate逐字段比较。为0、1、2和快速多次往返添加边界fixture，超限必须自动降到advanced/beta且entry/ecosystem gate非零。

## 覆盖矩阵

| 复核面 | 结果 | 结论 |
|---|---|---|
| 1. receipt DAG、commit order、cursor/revision、writer epoch、anchor、TUF | `[fail]` | 通用edge manifest、writer fencing和TUF lineage方向基本闭合；但anchor reconciliation缺传输失败terminal，见A-5。未另发现可复现的实例摘要环或TUF角色回滚旁路。 |
| 2. TypeScript判别联合与 `Extract` | `[fail]` | local effect constituent被窄化擦除，见A-1；人工effect-committed final缺失，见A-2。 |
| 3. local-control proposal/disclosure/decision/consumption | `[ok]` | 各敏感动作均有事前local session、proposal、disclosure、accepted decision和single-use consumption形状；除A-5 recovery producer缺口外，未发现独立换挂反例。 |
| 4. OAuth、API-key PKCE、workload metadata、AWS static/signer | `[ok]` | 标准OAuth与API-key family分离、winner/recovery/retirement、metadata exact-empty和signer边界均有状态专属形状；本轮未发现新的独立A/B。 |
| 5. conformance staged/live与send链 | `[fail]` | runtime receipt链本身有intent→descriptor→conditional lease→bundle→send顺序；正式TCK report core缺适用身份，见A-4。 |
| 6. runtime/fallback、persistent budget、metadata、preload | `[fail]` | fallback可重写inner terminal并继续，见A-3；budget correction可扩物理cap，见A-6。metadata与local preload未发现新的独立A/B。 |
| 7. Execution start/turn/request/tool/finality | `[fail]` | session-start反复query、turn unknown与zero-work主形状存在；local effect和人工committed终态分别因A-1、A-2不可达。 |
| 8. strong-anchor fresh-boot bootstrap | `[fail]` | 初次request与found/absent/still-unknown主链存在，但query自身失败无terminal，见A-5。 |
| 9. ReferenceGradeProfileV2、GA runs/gates/distribution | `[fail]` | run→journey→entry→ecosystem与distribution digest方向已分层；正式conformance身份缺口见A-4，typed UX hard-cap缺口见B-1。 |
| 10. Phase验收、fixture、命令、DoD、性能/隔离/扩展 | `[fail]` | 阶段命令、数值预算、三平台隔离、供应链和extension namespace总体具体；但现有门的描述无法机械补齐A-1至A-6和B-1中的缺失类型/字段/transition。 |

## 收口判定

本轮没有发现需要单列的C级建议。当前六个A级根因均可在完全遵守现有结构的实现里触发，且至少涉及重复调用/费用、预算扩额、状态永久不可恢复、核心工具旅程不可达和reference-grade证据错绑。因此不能以waiver或“后续refinement实现”替代合同回修；应先修正上述canonical形状和字段级派生规则，再冻结新SHA并重跑完整三路终审。
