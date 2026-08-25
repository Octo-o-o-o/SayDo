# AI Supply 参考架构最终闭包复核 v10

## 输入与读取完整性

- 唯一目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 冻结行数：19,742
- 冻结字节数：1,182,440
- 冻结 SHA-256：`e5100062006a86b5828630a068f51b615c38aee2642229f572271b0b5e5a9cdc`
- 初次核对与落盘前复核的三项数值均与冻结值一致。
- 已连续读取第 1–19,742 行；工具输出中被截断的区间已逐段补读到边界闭合。完成全读后，仅在同一目标内检索并重读候选位置以确认精确行号。
- 未读取其他仓库文件、旧评审报告或实现代码；未修改目标文件。

## 严重级别计数

- A：7
- B：2
- C：0

## Findings

### 1. [A] persistent budget 的 provisional escrow 形成不可提交的双向 receipt 边

位置：

- `ReceiptEdgeManifestEntry` 定义 receipt 引用边及 `target_committed_before_owner` 排序规则：第 353–384 行；Phase 0 模型明确要求“目标先提交”和实例图无环：第 19053 行。
- `PersistentBudgetChildEscrowReadyCursorReceipt` 的 initial constituent 必填 `provisionalSettlementApply`：第 5964–5980 行。
- 对应 `PersistentBudgetChildSettlementApplyReceipt` 的 `hold_retained` constituent 又必填 `resultingChildEscrowCursor`：第 6187–6215 行。
- 同一反向模式还出现在 bootstrap budget：cursor 可引用 `lastSettlement`，而 settlement 必填 `resultingBudgetCursor`：第 4265–4282、4321–4331 行。

最短不可达路径：

1. bounded-correction-horizon 首次得到 `provisional_usage_correction_horizon_open`。
2. 要提交 initial escrow-ready cursor，必须先提交其 `provisionalSettlementApply`。
3. 要提交该 hold-retained apply，又必须先提交其 `resultingChildEscrowCursor`，即第 2 步的 cursor。
4. 两者互为目标，没有任一合法首节点，producer DAG 和 instance acyclic gate 均无法同时满足。

合同为何没有阻断：类型把“结果 cursor”建成 outcome receipt 的输入，同时又让结果 cursor 反引 outcome；布尔 CAS 证明不能消除对象级强连通分量。bootstrap budget 若填写 `lastSettlement` 同样成环；若省略，又失去 cursor 对该 settlement 的类型化过渡归属。

最小根修：所有 transition receipt 只引用已提交 predecessor、lease、observation 和计算出的 revision/state/digest，不引用尚未提交的 resulting cursor；successor cursor 再单向反引 transition receipt。为 persistent escrow 和 bootstrap budget 各增加正向可达 fixture，并让 producer/instance DAG gate 对这两个具体路径执行。

### 2. [A] workload、OAuth 和 API-key 的物理 before-intent 终态没有关闭准确 lease 权限

位置：

- 通用 `PreIntentLeaseClosureReceipt<L>` 要求原子关闭 resource reservation、worker ownership 与 funding reservation：第 302–341 行。
- workload physical step lease 与 no-send terminal constituent：第 769–866、895–955 行；只有“首个 physical step lease 之前”的外层 logical terminal 带 closure：第 1074–1101 行，而 physical sequence 已取得 lease 后的 not-sent terminal 明确没有 closure：第 1122–1136 行。
- OAuth exchange lease 与 not-sent terminal：第 2070–2122、2213–2223 行。
- API-key exchange lease 与 before-send terminal：第 3188–3212、3250–3258 行；该分支还同时要求 `sendIntent?: never`、`provesNoSendIntentExistsForExchangeLease: true` 和 `provesSendIntentConsumesExactExchangeLeaseAndCursorRevision: true`。

最短反例：

1. reference monitor 取得 workload physical step、OAuth exchange 或 API-key exchange lease，cursor 已进入 in-flight。
2. 在 durable send intent 前发生 cancel、deadline 或 hard stop。
3. 对应 terminal 可以声明 not-sent 并推进终态，但没有 `PreIntentLeaseClosureReceipt<准确 lease>`，因此合同没有证据证明该 lease 的 worker/resource/funding authority 已原子释放。
4. 重复该路径会留下不可审计的 hold/worker ownership；API-key 分支还要求一个在 `sendIntent` 不存在时不可能诚实成立的“intent 消费 lease”证明。

合同为何没有阻断：这些分支只用 `sendIntent?: never` 和自述布尔证明“未发送”，没有把“未发送”与准确 lease 的全权限闭包组成判别联合。外层 workload closure 只覆盖尚未取得 physical lease 的分支，不能替代已取得 physical lease 后的 closure。

最小根修：三类 terminal 都改为按 `intentState: "absent" | "present"` 映射的严格联合；absent constituent 必填 `PreIntentLeaseClosureReceipt<Extract<准确 lease kind>>` 并排除 intent/bytes/effect，present constituent 必填准确 intent。删除 API-key absent constituent 的正向 intent-consumption 证明，并增加每个 lease→intent kill point 的资源、worker、funding 零遗留 fixture。

### 3. [A] Execution external identity 的 close 与 turn 不共享线性化点，且 before-intent close 无法产出永久封锁 cursor

位置：

- external identity available/start/active/close/closed/blocked cursor：第 11321–11412 行。
- permanent-block commit 只接受 start manual permanent-block 或 close `delivery_unknown` 作为 `blockEvidence`：第 11476–11494 行。
- close lease 只 CAS active external-identity cursor：第 11496–11512 行。
- before-intent close terminal 声明 `resultingCursorState: "permanently_blocked"`：第 11529–11554 行；但 close commit 只接受 confirmed/absent：第 11566–11580 行。
- turn lease 独立 CAS session ready cursor：第 12367–12385 行；session terminal 在另一条路径要求 external close commit：第 13001–13020 行。
- unknown-turn manual block 只把 `permanentIdentityBlockCommit` 写成 `ReceiptRef`：第 12898–12930 行。

最短竞态：

1. external identity 为 active，session cursor 为 ready。
2. closer 取得 external close lease；同时另一请求取得 turn lease。两者 CAS 不同 subject，均可成功。
3. closer 持久化 close intent并关闭进程或远端 session；turn 已进入 in-flight，仍可继续 request/dispatch 链，直到更晚的 session-terminal CAS 才可能失败。
4. 因此真实 close side effect 可以先于 session 对“禁止新 turn”的线性化发生。

最短不可达分支：close lease 后在 intent 前取消；terminal 声明 permanently blocked，但 `ExecutionExternalIdentityPermanentBlockCommitReceipt.blockEvidence` 不接受该 terminal，`ExecutionExternalIdentityPermanentlyBlockedCursorReceipt` 因而无法构造。active 已被 close lease 消费，identity 卡在无法合法收口的 generation。

合同为何没有阻断：external identity lifecycle 和 session/turn lifecycle 是两套独立 CAS，close lease 不消费 `session_closing` 状态，也不与 turn lease 原子竞争；before-intent terminal 的结果状态与唯一 blocked-cursor producer 的输入联合不闭合。manual block 的裸 `ReceiptRef` 又允许声称全局封锁而不证明实际 lifecycle transition。

最小根修：先用 session-close lease 对 ready cursor 做 `ready→session_closing` 的唯一 CAS，让它与 turn lease 竞争同一线性化点；external close lease 必须消费该 closing state并绑定当前 active identity generation。before-intent close 应经 typed abort/release commit 原子回到 active，或把该精确 terminal纳入 typed block commit并明示永久封锁理由。manual block 必须引用准确 `ExecutionExternalIdentityPermanentBlockCommitReceipt` 和 blocked cursor。

### 4. [A] Execution peer/process identity 仍可用任意 committed receipt 代替真实连接身份

位置：

- 具备 socket owner、PID-start、binary file identity 与 challenge 的 `LocalExecutionPeerReceipt`：第 11124–11134 行。
- activation commit 的 `activePeerOrProcessIdentity`：第 11431–11447 行。
- start success terminal 的 `peerOrProcessIdentity`：第 11802–11819 行。
- session lease base 的 `peerOrProcessIdentity`：第 12156–12180 行。
- dispatch admission 的 `connectedPeerOrProcessIdentity`：第 12500–12522 行。

最短反例：local ACP HTTP 端口已被非预期进程占用。调用方在上述四个字段填入同一个无关但已提交的 `ReceiptRef`，并把 exact-equality 布尔设为 `true`；TypeScript shape 仍允许 start、activation、session 和 dispatch 链成立，却从未要求该引用是带 connected-socket owner、PID-start、binary/file identity 和 challenge 的 `LocalExecutionPeerReceipt`。

合同为何没有阻断：安全边界虽然定义了强类型 local peer receipt，却没有把它贯穿实际 start→activation→session→dispatch 对象图；裸 `ReceiptRef` 与自述 equality 布尔无法证明 target kind 或 identity generation。对 stdio、remote service 也没有一个按 surface 判别的 peer/process identity union。

最小根修：定义按 `startKind`/surface 映射的 `ExecutionPeerOrProcessIdentityReceipt`：local HTTP 必须是 `LocalExecutionPeerReceipt`，stdio 必须是受信 process/binary identity，remote 必须是独立 authority attestation；四层字段全部参数化为同一 constituent，并由 manifest same-value path、generation 和 connected-socket subject做机械等值校验，禁止裸 `ReceiptRef`。

### 5. [A] Execution success/tool 链没有接入强类型 raw-response inventory、loss 与 authority extraction

位置：

- `RegisteredToolInvocationSetReceipt` 的 `rawResponseInventory` 与 `responseDecodingPlan` 都是裸 `ReceiptRef`：第 12587–12606 行。
- Execution physical success 的 no-tool 分支只要求 `registeredToolCallCount: 0`，terminal base 只有 `terminalEvidenceDigest`，没有 raw inventory、decoding plan、response loss 或 authoritative extraction：第 12572–12661 行。
- 同一目标稍后定义了强类型 `RawResponseInventoryReceipt`、`DecodingPlan`、`ResponseLossReceipt`：第 15194–15237 行，以及按字段/subject 绑定的 `SecurityAuthorityExtractionReceipt`：第 15265–15318 行，并要求 runtime terminal 产生本 attempt 的 loss receipt：第 15320 行。

最短反例一：真实 Execution response 含一个 tool-call occurrence；decoder 隐去该 occurrence，terminal 直接填 `registeredToolCallCount: 0` 并走 `turn_complete`。该 constituent 没有 raw occurrence coverage，合同无法拒绝。

最短反例二：构造一个与 physical response 无关的 committed receipt作为 `rawResponseInventory`，再在 `calls` 中填入任意 tool name/arguments/resource scope。`provesEveryRawToolCallOccurrenceRegisteredExactlyOnce: true` 是标量自述，类型仍允许后续 tool invocation 获得 effect authority。

合同为何没有阻断：强类型 response/authority 模型只在后文定义，却没有成为 Execution terminal 与 tool registration 的必填输入；no-tool 和 tool branches 都存在绕过 raw byte occurrence、loss、model/route/usage/data/terminal-side-effect authority 的路径。

最小根修：建立按 Execution protocol/surface 参数化的 `ExecutionResponseEvidenceReceipt`，必填同 attempt 的 `RawResponseInventoryReceipt`、`DecodingPlan`、`ResponseLossReceipt` 和所需 `SecurityAuthorityExtractionReceipt`；physical terminal 的每个 present-intent success/failure constituent都引用它。`RegisteredToolInvocationSetReceipt` 只能从该 typed inventory 的 tool-call occurrences 做无漏无重映射，no-tool 分支必须以 typed empty occurrence set证明为零。

### 6. [A] turn delivery-unknown reconciliation 把 query 与 cleanup 混在 lease 中，没有 durable intent 或 pre-intent recovery

位置：

- reconciliation lease 直接保存 `exactAuthorityQueryOrCleanupRequestDigest`，并把 session cursor推进 `reconciliation_in_flight`：第 12879–12896 行。
- manual cleanup/permanent block decision：第 12898–12931 行。
- reconciliation terminal 直接接受 resolved/cleanup/block/still-unknown，没有 `intentState`、query/effect intent 或 before-intent terminal：第 12933–12980 行。
- 对照 start recovery 的独立 query lease/intent 与 absent closure：第 11982–12014、12040–12065 行。

最短不可达路径：取得 reconciliation lease 后、发出 authority query 或 cleanup 前崩溃。cursor 已是 `reconciliation_in_flight`，但 terminal 联合没有 absent-intent cancel/deadline/hard-stop 分支，也没有 `PreIntentLeaseClosureReceipt`，不能诚实退回 ready/reconciliation-required 或关闭 authority。

最短重复副作用路径：cleanup 已执行，进程在写 terminal 前崩溃。没有 durable cleanup intent区分“从未执行”与“可能已执行”，恢复者只能停死或再次 cleanup；后者可能重复远端关闭/清理副作用。

合同为何没有阻断：一张 lease 同时承担只读 query 和 effectful cleanup 的请求摘要，却没有 send/effect intent的持久化边界；terminal 只靠宽泛 evidence 和 manual decision声明结果。它也没有完整的 absent/present 判别联合。

最小根修：把 authority query 与 cleanup effect 拆成不同 action kind；各自使用 typed lease→durable intent→terminal，absent branch 必填准确 pre-intent closure，present branch 必填 query evidence或 cleanup commit evidence。所有 cancel/deadline/hard-stop/delivery-unknown 路径必须能回到有界重试或永久保守终态，cleanup 必须具备 effect-once identity。

### 7. [A] four-slot fallback 的默认泛型失去 slot 判别，且 alternative/admission/advance 可跨 solution 拼接

位置：

- `SupplySlotBindingReceipt<S = SupplySlotId>` 把宽泛 `slot: S` 放在 conditional union 外：第 10689–10712 行。
- 完整 solution 的四个具名字段：第 10714–10734 行。
- fallback alternative 使用未参数化 `invokedSlotBinding: SupplySlotBindingReceipt`：第 10736–10744 行。
- per-solution admission、attempt lease 与 advance 继续使用未参数化 binding：第 10782–10799、10880–10903、10921–10939 行。
- 文内 type assertions 只验证 terminal continuation 可达性，不覆盖 slot/solution splice：第 14632–14644 行。

最短反例一：以默认泛型实例化 binding，令 `slot: "evaluator"`，却选择 conditional 的非-evaluator branch，因此可不提供 `evaluatorIndependenceProof` 和 strict-schema capability。原因是分支本身没有把 `slot` 收窄成 literal。

最短反例二：`FallbackSolutionAlternativeReceipt.solution = A`、`invokedSlot = "evaluator"`，但 `invokedSlotBinding = B.dialog`。后续 admission/attempt/advance 都接受同一宽泛类型；`proves...NoCrossSolutionSplice: true` 不能在类型或 schema 层建立对象相等。

合同为何没有阻断：conditional type 的判别字段位于共同 base 上，默认 union 实例化后 branch 与 slot 不相关；fallback 各层也没有携带统一的 slot type parameter或从 `solution[K]` 推导 binding。

最小根修：用 mapped discriminated union 把 `slot: K`、`binding.slot: K` 和 K 专属字段全部放入每个 constituent；将 alternative、admission、attempt、advance 参数化为同一 `K`，令 `invokedSlotBinding` 的唯一来源为 `solution[K]`，并增加 evaluator 缺 independence、dialog/evaluator 互换、A/B solution splice 的编译/schema/mutation 负例。

### 8. [B] fresh witness 的 boot 级 network cap 与 registration+query 预算语义冲突

位置：

- bootstrap profile 明确 `registrationRequestCap: 1`，并要求有限正数 `statusQueryCap`：第 4249–4263 行。
- boot-scoped anchor 同时写死 `anchorWitnessBootstrapNetworkCap: 1`：第 4884–4897 行。
- 规范文字明确 registration response-loss 后只能查询 status，预算是 registration=1 加 statusQuery=N：第 17794–17795 行。

最短反例：fresh enrollment 的 registration request 已发送但 response 丢失；正确恢复至少还要一次 status query。若 `anchorWitnessBootstrapNetworkCap: 1` 表示该 boot 允许的 bootstrap 网络请求数，则第一请求已耗尽 cap，恢复不可达；若它表示 capability family、并发 authorization 或其他单位，合同没有定义单位及其与 durable request budget 的关系，两个 verifier 可以得出相反结论。

合同为何没有阻断：一个无单位的 literal scalar 与有明确 request-kind 的 durable budget并存，缺少推导关系、同值路径或优先级；文字无法消除机械执行歧义。

最小根修：若它是 lifecycle capability 数，重命名并定义为 `anchorWitnessBootstrapLifecycleAuthorizationCap: 1`，明确一次 lifecycle 内可消费 profile 的 registration+query vector；若它是请求数，则改为由 `1 + statusQueryCap` 推导并绑定同一 budget cursor。增加 registration response-loss→至少一次 query 的 fresh-boot 正向 fixture。

### 9. [B] persistent budget finality lease 的 observation kind 与实际 settlement observation 没有判别型同值约束

位置：

- `PersistentBudgetChildEscrowFinalityLeaseReceipt.finalityObservationKind` 可为三种 finality：第 6031–6049 行。
- settlement observation 是独立的五类联合：第 6067–6131 行。
- finalized balance fields 接受 finality lease 和三种 final observation，但没有按 observation 映射收窄 lease kind：第 6133–6185 行。
- apply 继承上述宽泛组合：第 6187–6241 行。

最短反例：finality lease 写 `finalityObservationKind: "authoritatively_not_sent"`，apply 却携带 `settlementObservation: "authoritative_final_usage"`；反向组合也可构造。两张 receipt 各自类型合法，当前联合没有字段把两者锁成同一 constituent。

合同为何没有阻断：`provesReleaseOccursOnlyAfter...: true` 只说明 observation 属于允许集合，不证明 lease 授权的 exact kind 与实际 observation 相等；edge manifest 的拟议机制没有在这里物化所需 mapped union/transition predicate。

最小根修：以 `finalityObservationKind` 为键建立 mapped union，令每个 constituent 的 `childEscrowFinalityLease` 与 `settlementObservation` 精确同 kind；把 correction policy、deadline/authority proof 也放进相同 constituent，并加入三组交叉换挂 mutation。

## 关注面覆盖矩阵

| 关注面 | 复核结果 | 发现映射 |
|---|---|---|
| 1. Receipt DAG、edge manifest、writer epoch | 存在 producer/instance cycle | 1 |
| 2. strict union、Extract、required-never、pre-intent closure | physical absent 分支和 fallback 默认泛型未闭合 | 2、7 |
| 3. send DAG | 三类 credential send 与 turn reconciliation 缺完整 lease→intent→terminal 闭包 | 2、6 |
| 4. local control、secret、process identity、egress、sandbox | process/peer identity 未贯穿 Execution 权限链；其余已读范围未发现独立新增 A/B | 4 |
| 5. workload、OAuth、API-key | 三条 before-intent 物理路径均有同根缺口 | 2 |
| 6. remote witness | fresh registration response-loss 的 cap 语义不闭合 | 8 |
| 7. persistent budget、correction | provisional escrow 成环，finality kind 可换挂 | 1、9 |
| 8. four-slot solution、fallback no-splice | evaluator branch 与跨 solution binding 可拼接 | 7 |
| 9. staged→restart→live | 已审查第 6604–6756、9934–9955、14649–14668 行，未发现独立新增 A/B | 无 |
| 10. Execution start/query/close/block/session/turn/request/tool | close/turn 竞态、blocked producer 缺口、reconciliation intent 缺口 | 3、6 |
| 11. raw response、authority extraction | 后文强类型模型未接入 Execution terminal/tool chain | 5 |
| 12. conformance semantic subjects、TCK、GA | 已审查第 15426–15717、17864–18350、18660–19140 行，未发现独立新增 A/B | 无 |
| 13. core/plugin scheduling | 已审查第 15119–15150、15387–15420、16000–16562 行，未发现独立新增 A/B | 无 |
| 14. control/data plane、性能、迁移、恢复、资源 | 已审查第 15324–15412、16563–17280、18352–19107 行；恢复阻断已归并到 1、3、6、8，未另报重复根因 | 1、3、6、8 |

## 结论

以上 7 个 A 级和 2 个 B 级问题均具有可复现的最短反例或不可达路径，且不能仅靠现有布尔 proof 字段、后续实现约定或文字说明机械排除。当前冻结稿尚未达到参考实现级架构闭包。

Verdict: FAIL
