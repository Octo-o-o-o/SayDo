# SayDo AI Supply 参考架构最终闭包复核 v6

## 1. 读取完整性

- 评审目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 冻结输入实测：8,219 行，638,999 bytes。
- 冻结输入 SHA-256：`fc4454fc6ac05c545d90b0780a5298a16f0a021c5e972da1f4df3de460da4c0e`。
- 读取范围：按连续区间完整读取 1–8,219 行；发生输出截断的区间均缩小范围重新读取至无缺口。定位发现时只对同一目标使用 `sed`/`rg`；未读取源码、旧 prompt、旧 review、journal、计划索引或其他仓库文件。
- 落报告前再次实测目标仍为 8,219 行、638,999 bytes，SHA-256 未变化。

输入无漂移；本报告对上述冻结快照负责。

## 2. 结论与计数

| 严重度 | 数量 |
|---|---:|
| A | 11 |
| B | 3 |
| C | 0 |

单一 verdict：`FAIL`。

当前合同仍允许费用/副作用重复、旧状态或错误报告被接受，且 OAuth/Execution 的若干正常失败路径无法形成合法终态；reference-grade journey 也仍可由类型合法但事实失败的报告自证通过。按本轮规则，A/B 均非零，不能给 `PASS`，也不能进入实施。

## 3. A 级发现

### A-01 receipt edge manifest 无法表达它声称要生成的实例级等值与单后继约束

**精确位置**

- 第 291–304 行：`ReceiptEdgeManifestEntry.orderingRule` 只能从三个字符串中单选一个；没有 state-machine identity、writer epoch、anchor counter、subject/policy identity 的等值投影，也没有可组合 predicate。
- 第 2833–2889 行：`AuthoritativeLedgerRangeReceipt` 没有 writer lease/expected revision；`AuthoritativeLedgerCorrectionReceipt` 只保存不透明的 `singleSuccessorCasEvidenceDigest`。
- 第 2952–2969 行：`ActualAttemptReportBase` 用可分叉的 `predecessorReport`/`reportRevision` 表示后继，同样没有 subject-scoped report cursor。
- 第 5955–5959、6993、7661、7665 行：正文和门禁同时要求目标先提交、同一 state-machine identity、同 epoch、revision 恰少一、单后继 CAS 和旧状态不可复活。

**最短反例/不可达路径**

对同一个费用 subject 的 report revision 4，依次生成两个 correction：二者都引用同一 `predecessorRange`，都写 `expectedReportRevision=4`、`resultingReportRevision=5`，但一个包含迟到费用，另一个漏掉该费用。两个对象均可携带不同的任意 `singleSuccessorCasEvidenceDigest`。字段 manifest 只会看到 target kind、提交顺序和 revision 关系；没有机器字段可证明二者竞争的是同一个 subject-scoped CAS，也没有权威 cursor 能让第二个后继失败。消费者选择漏账分支即可恢复较低费用状态。

同一缺口也允许一个 revision N cursor 把“同类型、N-1 revision、已先提交”但属于另一 policy/session/flow 的 cursor 当 predecessor；现有 `orderingRule` 仍会通过。

**为什么现有合同或门禁挡不住**

正文承诺另有 “instance graph verifier”，但没有给该 verifier 可签名、可生成的 equality/transition predicate 输入。单值 `orderingRule` 甚至不能同时表达“target 先提交”和“revision 恰少一”，更不能表达同 identity/epoch/anchor。`singleSuccessorCasEvidenceDigest` 是 producer 自填摘要，不是可遍历的 authority receipt。`receipt-dag-and-anchor.model` 与 `persistent-budget-ledger.model` 的名称描述了期望结果，却没有可供实现照抄的合同形状。

**最小根因级修法**

给 edge manifest 增加可组合的 `orderingRules[]`、`sameValuePathPairs[]`、`stateMachineIdentityProjectionId`、`writerEpochRule`、`anchorCounterRule` 和版本化 `transitionPredicateId`。为 ledger/report 增加 subject-scoped `LedgerReportCursorReceipt → CorrectionLease → CorrectedRange/ReportCommit`，在同一 writer lease、epoch、外部 anchor counter 下原子 CAS；删除不透明的 `singleSuccessorCasEvidenceDigest` 作为唯一证明。生成器必须从这些机器字段产生 schema、store constraint 和 mutation fixture，而不是依赖未记录的手写 verifier。

### A-02 TUF receipt 缺可信初始 root 到当前 root 的轮换链，也没有分 role 的防回滚状态

**精确位置**

- 第 1329–1341 行：monotonic anchor 只有 counter/state/witness 摘要，没有与具体 TUF repository/role 状态的判别绑定。
- 第 1390–1413 行：`TufTargetAuthorizationReceipt` 只保存一个当前 `rootVersion/rootDigest`，随后是 timestamp/snapshot/top-level targets 和 delegation；没有初始 trust root、逐版本 root rotation step、各 metadata role 的 expiry/high-watermark，只有单个 `antiRollbackHighWatermark: number`。
- 第 5324–5325 行：正文明确要求客户端固定可信初始 root，并可重放 rotation/revocation/rollback/freeze/mix-and-match。
- 第 6478、6992、7007、7167、7661 行：正文和门禁宣称 receipt 保存完整 root-to-target lineage，并能离线重放旧 metadata、rotation 和高水位攻击。

**最短反例/不可达路径**

客户端可信 root 为 v1。构造一套攻击者自签的 root v5、timestamp、snapshot、targets 和 target，再生成 `TufTargetAuthorizationReceipt`：填写 `rootVersion=5`、攻击者 root digest、后续完整摘要、当前 anchor，以及任意较大的标量 high-watermark，并把 `completeRootToTargetLineage=true`。该形状没有位置保存 v1→v2→v3→v4→v5 每次由旧/新 threshold 共同验证的 root 更新，因此仅凭冻结合同无法区分合法轮换与凭空换根。

另一个最短变体是 root/timestamp 维持高版本，而把某个 delegated role 回滚；单标量 watermark 没有 role key，不能同时表示 root、timestamp、snapshot、top-level targets 和每个 delegated role 的独立版本高水位。

**为什么现有合同或门禁挡不住**

`rootDigest` 和 `witnessEvidenceDigest` 都只是字符串，不是从可信初始 root 出发的可遍历 receipt edge。`orderedDelegationLineage` 从 top-level targets 才开始，不能证明 root rotation。`completeRootToTargetLineage: true` 和单个数字无法替代逐 role 状态。现有 fixture 虽写“完整 lineage/rotation”，但 schema 没有承载期望证明的字段，正例与伪造对象不可机械区分。

**最小根因级修法**

加入 release-pinned `TrustedTufRootAnchorReceipt`，以及有序 `TufRootRotationStepReceipt[]`，逐步绑定 old/new root version、digest、old/new threshold 验证结果和 metadata expiry。把标量 high-watermark 改为 repository+role scoped 的不可回退 cursor/map，覆盖 root、timestamp、snapshot、top-level targets 和每个 delegation role；每项绑定外部 anchor counter。receipt 必须强引用已导入、签名验证过的 metadata evidence leaf，离线 verifier 从 pinned root 重放到 target。

### A-03 local-control 链不是所有高影响动作的必经前驱，accepted decision 也没有耐久消费位

**精确位置**

- 第 1536–1548 行：`LocalControlSessionReceipt`。
- 第 1582–1684 行：proposal/disclosure/decision 主链；`UserDecisionReceipt` 只有 `singleUse: true`，没有 writer lease、decision cursor 或 consumption commit。
- 第 614–715 行：标准 OAuth flow authorization/start/browser launch 只保存 `initiatingLocalSessionDigest`，不引用 proposal、disclosure 或 accepted decision。
- 第 1090–1125 行：API-key PKCE cursor/launch lease 同样没有 accepted decision 前驱。
- 第 5072–5124 行：manual reconciliation 只保存 `proposalDigest`/`disclosureRenderDigest`/本地 session/signature，既不是强类型 proposal→disclosure→decision，也没有 `notAfter`；decision outcome 与 transition 分支未绑定。
- 第 5957、6991、7658 行：正文和 TCK 明确声称任何 secret/browser/network/spawn/effect/owner decision 都必须先经过该单向链，并拒绝同 UID、旧 nonce 和事后 disclosure。

**最短反例/不可达路径**

一个能调用本地 daemon 的同 UID 进程取得现有 local-session digest 后，直接构造 `OAuthFlowAuthorizationReceipt → OAuthFlowStartLeaseReceipt → OAuthPkceBrowserLaunchReceipt`。这些类型不需要 `AuthorizationProposalReceipt`、rendered disclosure 或 `AcceptedUserDecisionReceipt`，浏览器动作在类型图上合法。

另一个变体是把同一 accepted decision 引用进两个 final authorization/consent：`singleUse: true` 只描述 decision 自身，没有原子消费 cursor；两个最终 receipt 各自都是 single-use，却共同放大一次同意。manual reconciliation 还可把 `proposedOutcome=no_effect` 的 owner decision 挂到 `manual_reconcile → executed`。

**为什么现有合同或门禁挡不住**

`initiatingLocalSessionDigest` 不是 receipt edge，不能证明 proposal/render/decision 的提交顺序。final authorization 的 schema 没有 decision-consumption 前驱，store 也没有可 CAS 的 nonce/decision 状态。`local-control-authorization.tck` 的文字覆盖 browser/effect，但没有相应 OAuth/API-key/manual-reconcile proposal kind 和消费 receipt 可供 fixture 构造。

**最小根因级修法**

为 standard OAuth flow start、API-key PKCE browser start、manual reconciliation 和 GA owner decision增加严格 proposal kind、用途专属 disclosure 与 accepted decision 引用。新增 writer-fenced `UserDecisionConsumptionCursorReceipt/Lease/Commit`，final authorization 必须原子消费一次 `(session, actionNonce, proposal, render, subject)`；拒绝仅保存 digest 的旁路。manual decision 用判别联合把 proposed outcome、transition target、result/effect evidence 和期限逐分支绑定。

### A-04 OAuth 与 API-key PKCE 缺正常失败终态，若干 terminal 也没有结果 revision/state

**精确位置**

- 第 667–715 行：flow-start cursor/lease；PKCE browser receipt 永远写 `resultingState="started"`。
- 第 716–790 行：callback terminal 只有成功 code 分支；device authorization result 只有取得 device code 的成功形状；`OAuthFlowStartTerminalReceipt` 仅为这两个成功对象的 union。
- 第 793–891 行：exchange terminal 的 pending/slow-down/denied/expired/failed/delivery-unknown 分支没有 `resultingCursorRevision` 或 `resultingCursorState`。
- 第 1090–1145 行：API-key cursor 用通用 `lastTransition?: ReceiptRef`；browser/callback 没有失败 terminal，callback 也没有 resulting revision/state。
- 第 1161–1195 行：只有 exchange 阶段定义 before-send/after-send failure；这不能关闭更早的 browser/callback 状态。
- 第 5972、7053、7170、7659 行：正文和验收承诺 durable start/exchange cursor、callback 劫持防护、sibling 拒绝和恢复。

**最短反例/不可达路径**

1. Device authorization 请求发出后 provider 返回 HTTP 500。cursor 已是 `start_in_flight`，但合法 terminal 只能是含 device code/user code/verification URI 的 `OAuthDeviceAuthorizationResultReceipt`；不能诚实构造。
2. PKCE browser 打不开，或 callback 返回 `error=access_denied`、state mismatch、超时/取消。callback receipt 强制 `stateMatched: true` 且必须含 authorization code；没有失败/拒绝/超时 terminal。
3. Device poll 返回 `authorization_pending`。terminal 不携带 resulting revision/state；两个恢复者可以各自解释下一个 cursor revision/ordinal，合同没有唯一推进结果。

API-key PKCE 对 browser/callback 有相同不可达路径。结果只能是永久 in-flight、伪造成功字段，或实现私下增加未写入 canonical 的状态。

**为什么现有合同或门禁挡不住**

`oauth-state-machine.tck` 罗列 producer 分离、replay 和 winner，却没有可实例化的 browser/device-start/callback 失败判别联合。通用 `lastTransition?: ReceiptRef` 还会掩盖缺失的准确 target kind。后续 exchange failure 不能作为尚未到达 exchange cursor 的前序状态 terminal。

**最小根因级修法**

把 flow-start、browser launch、callback 和 API-key callback 全部改成 `outcome × delivery × continuation` 的严格 terminal union，至少覆盖 failed/cancelled/hard-stopped before action、failed/delivery-unknown after action、provider error、state mismatch、timeout/expiry，并逐分支给出 resulting revision/state 和费用/secret disposition。pending/slow-down/denied 等 exchange terminal 也必须原子提交 resulting cursor revision/state/next ordinal；删除通用 `lastTransition`。

### A-05 OAuth refresh winner 没有 credential-family 级 CAS，两个独立 exchange cursor 可同时成为赢家

**精确位置**

- 第 793–850 行：`OAuthExchangeCursorReceipt` 是 flow/exchange 局部 cursor；refresh lease 只带 `refreshFamilyDigest` 和 predecessor grant。
- 第 908–968 行：transition/commit 由 producer 填 `refreshRotationWinnerRevision`，commit 只 CAS 自己的 predecessor exchange cursor。
- 第 970–982 行：`OAuthCredentialFamilyReceipt` 是 immutable 快照，只含 initial commit 和当前 winner 数字；没有 predecessor family、expected family revision、current refresh-token version 或 family cursor。
- 第 5972、7053、7170、7659 行：正文/门禁要求 refresh reuse 和并发 winner 机械拒绝。

**最短反例/不可达路径**

从同一个 credential family revision N 和同一个 refresh token，创建两个不同的 `OAuthExchangeCursorReceipt`。writer 可以串行提交它们，因为二者 CAS 的是各自 cursor，不是 family。两个 refresh lease 都引用同一 predecessor grant，两个 provider 响应都成功；两个 commit 都填 `refreshRotationWinnerRevision=N+1`。类型图没有共享可争用状态，故两个新 access/refresh credential 都能成为“winner”。

**为什么现有合同或门禁挡不住**

exclusive writer 只防同时写数据库，不会让两个逻辑上独立的 exchange cursor 竞争同一 refresh-family revision。`currentRefreshRotationWinnerRevision` 是 receipt 中的数值副本，不是 CAS authority。现有 TCK 虽命名 refresh winner，但没有 family cursor/lease/commit 可证明 loser 在 token endpoint 首字节前被挡住。

**最小根因级修法**

增加 `OAuthCredentialFamilyCursorReceipt`，状态至少绑定 family、current grant、refresh credential source/version/subject、revocation generation、winner revision、writer epoch 和 anchor。refresh lease 必须先 CAS family cursor 到 in-flight；成功 response、credential transition、旧 token disposition、新 family cursor 和 exchange cursor terminal 在同一事务提交。两个 flow/cursor 共享同一个 family CAS key。

### A-06 conformance 的一个 accepted disclosure 只绑定单轮，却可授权 staged+live 两轮；unknown 分支还在 decision 后追加 target

**精确位置**

- 第 1550–1579 行：`ConformanceAuthorizedRound` 与 target。
- 第 1582–1630 行：两种 conformance proposal 都持有 `[staged, live]` tuple；unknown proposal 没有 `ConformanceAuthorizationTarget`/`attemptSubjectDigest`。
- 第 1688–1705 行：priced final authorization 引用一个 disclosure/decision，却携带两轮 tuple。
- 第 2780–2807 行：unknown final consent 在用户 decision 之后新增 `attemptSubjectDigest`、rights、eligibility 和 physical cap。
- 第 2891–2917 行：`AuthorizationDisclosureReceipt` 的 conformance 分支只有一个 `round` 和一个 `ingressAttemptId`。
- 第 3382–3396、6495–6496、7671 行：completion 和门禁宣称一次决定明确列出两个 round，live 不偷用 staged 额度。

**最短反例/不可达路径**

proposal 内含 staged S 与 live L。只生成 `round="staged"`、`ingressAttemptId=S` 的 disclosure，用户接受后生成 `ConformanceSpendAuthorizationReceipt`；该 authorization 自身又携带 S/L tuple，因此 live lease 可以引用它。类型没有证明用户实际 render 过 L 的 endpoint/request/processor/额度。

unknown 变体更短：用户接受一个只含 candidate billing、endpoint 和 rounds 的 proposal；随后 final consent 选择另一个 `attemptSubjectDigest`/rights/eligibility，因为这些字段不在 proposal target 内，decision 无法约束它们。

**为什么现有合同或门禁挡不住**

`selectedSequenceDigest/renderInputDigest` 是摘要副本，不能修复显式 `round` 单值与两轮授权的形状冲突。`conformance-two-round-budget.model` 只写共享 journey/authorization 和子预算，没有要求 disclosure 是 exact two-round tuple，也没有 unknown target 的 pre-decision equality 字段。

**最小根因级修法**

让 conformance disclosure 明确携带 exact `[staged, live]` tuple、两轮 subject/envelope/request/processor/budget digest，并从 proposal确定性派生；或者由一个 decision 强引用两个用途专属 disclosure。unknown proposal 必须在 decision 前绑定完整 `ConformanceAuthorizationTarget`、eligibility、rights、attempt subject 和 exact cap；final consent只能 `Extract` 同一对象，不得追加可授权事实。

### A-07 credentialed/付费 metadata 可合法写成零 reservation、零 terminal ledger、无 authoritative range

**精确位置**

- 第 6142–6179 行：bootstrap admission 接受任意 `CandidateBillingReceipt`，但 `reservationLedgerEntries` 是可空数组；没有 priced/unknown 判别分支。
- 第 6193–6208 行：physical lease 的 reservation 仍为可空数组。
- 第 6210–6218 行：send intent 缺 `notAfter` 和 `singleUse`。
- 第 6220–6244 行：`outcome="succeeded"` 允许空 `ledgerTerminalRefs`，不区分 automatic zero-cost 与两个 user-initiated admission。
- 第 6246–6254 行：result 的 `authoritativeLedgerRange` 对所有分支可选。
- 第 6480、7272、7667 行：正文/门禁要求所有 credentialed/可能计费 metadata 进入完整 reservation/send/terminal/ledger 链。

**最短反例/不可达路径**

选择 priced bootstrap candidate，生成 user-initiated bootstrap admission，令 `reservationLedgerEntries=[]`。发送后生成 `MetadataProbeTerminalReceipt{outcome:"succeeded", ledgerTerminalRefs:[]}`，再生成不含 `authoritativeLedgerRange` 的 result。所有字段类型合法，但一次真实收费和 credential egress 完全没有 reservation/sent/terminal ledger 闭包。

崩溃恢复时，同一个无 expiry/single-use 标记的 send intent 还可被两个 sender 重新解释为可发送，合同没有在 intent 层给出一次消费证据。

**为什么现有合同或门禁挡不住**

terminal union 只按 transport outcome 判别，没有把 admission kind/billing kind 作为 discriminant。布尔或 prose 无法让 TypeScript/Zod 从 nested admission 自动推出非空 ledger。`metadata-health-admission.tck` 的一句“credentialed metadata进入ledger”没有列出 priced-success-empty-ledger 和 result-no-range mutation，也没有形状可生成严格正例。

**最小根因级修法**

把 bootstrap admission 拆成 priced 与 externally-metered-unknown；priced 强制非空 reservation，unknown 强制明确 hold/unknown ledger。terminal/result 再按 automatic-zero-cost 与 user-initiated 判别：只有 automatic 分支允许空 ledger/range，其他 sent/succeeded/delivery-unknown 都强制连续 authoritative range和对应 entry。send intent增加 expiry、single-use consumption 和恢复后的 delivery-unknown terminal规则。

### A-08 Execution 模型响应未登记强类型 tool-call 集，tool results 可注入、遗漏或换挂

**精确位置**

- 第 4487–4511 行：success terminal 只写 `continuation="await_registered_tool_results"` 和不透明 `terminalEvidenceDigest`，没有 registered tool-call set/reference。
- 第 4571–4579 行：`ExecutionToolResultsAppliedReceipt` 接受任意非空 `completedToolTerminals` 和一个 producer 填写的 result-set digest。
- 第 4768–4784 行：`ToolInvocationReceipt.upstreamCallRefs` 只是 `{attemptId, toolCallId}` 字符串集合，没有强引用产生该 tool call 的 physical terminal/raw occurrence/registered set。
- 第 7669–7670 行：现有 Execution suites 覆盖 surface 和 child lease，但未定义 registered-set exactness。

**最短反例/不可达路径**

上游 response 实际注册 tool A。physical terminal 进入 `await_registered_tool_results`，但不保存 A 的 typed set。构造同 session/turn 的 `ToolInvocationReceipt` B 和 B 的 terminal，再生成 `ExecutionToolResultsAppliedReceipt.completedToolTerminals=[B]`。合同无法证明 B 属于 response，也无法证明 A 没有被漏掉；模型随后收到错误 tool result 并继续执行。

**为什么现有合同或门禁挡不住**

`terminalEvidenceDigest`、`canonicalToolResultSetDigest` 和字符串 `toolCallId` 没有 receipt edge/equality predicate。tool child lease suite 从已经存在的 invocation 开始，无法验证 invocation 是不是由该模型 response 唯一注册。`provesAllChildCursorsTerminal` 也只在 turn terminal 出现，不证明 child 集合完整。

**最小根因级修法**

成功 physical terminal必须强引用由 trusted response IR/raw occurrence 派生的 `RegisteredToolCallSetReceipt`，固定 attempt、call ID、name、arguments、顺序/并行组和 set digest。每个 `ToolInvocationReceipt` 强引用且只能消费其中一个成员；`ExecutionToolResultsAppliedReceipt` 强制与注册集无漏、无重、同序对应，并有 explicit skipped/cancelled terminal 分支。

### A-09 Execution effect terminal 与 manual reconciliation 仍允许 delivery-unknown 后重试和错误 outcome 换挂

**精确位置**

- 第 4976–4989 行：`ExecutionToolEffectTerminalReceipt.outcome` 与 `resultingCursorState` 是独立字段；`externalRequestTerminal` 对所有 effect class 可选。
- 第 5072–5083 行：manual decision 的 `proposedOutcome` 没有判别型 evidence/transition target，且没有 expiry。
- 第 5108–5124 行：`manual_reconcile` 可到 `executed|result_recorded`，`resultDigest` 可选；没有要求 owner decision outcome 与目标一致。
- 第 5959、7670 行：正文/suite 要求 delivery unknown 禁自动重试、effect single-successor 和人工调和。

**最短反例/不可达路径**

provider side effect 的网络送达未知。生成 effect terminal：`outcome="delivery_unknown"`、`resultingCursorState="ready"`，并省略 `externalRequestTerminal`。cursor 随后签发下一 effect ordinal，再执行一次相同副作用。该对象完全符合当前接口。

另一个变体：owner decision 写 `proposedOutcome="no_effect"`，却挂到 `manual_reconcile{to:"executed"}`；或 `to="result_recorded"` 而不提供 `resultDigest`。当前联合都接受。

**为什么现有合同或门禁挡不住**

single-successor 摘要不能替代 discriminated union。`execution-tool-child-lease.model` 虽声称拒绝两个 effect，却没有把 delivery outcome、external terminal、effect class、cursor state 和 owner outcome约束在同一分支；schema 会先接受反例。

**最小根因级修法**

按 effect class 与 outcome 重写 terminal union：external/provider effect 强制对应 external-request terminal；`delivery_unknown` 只能到 terminal/manual-reconcile 且保留 unknown hold；只有权威 `not_committed` 才可回 ready。manual decision复用 A-03 的 accepted-decision consumption链，并用 `Extract` 让 `no_effect→aborted`、`effect_committed→executed`、`result_recorded→result_recorded+required resultDigest` 一一对应。

### A-10 Execution session/turn 无零请求终态，且 delivery-unknown turn 可回 ready

**精确位置**

- 第 4369–4382 行：session cursor 只有可选 last turn lease/terminal 和裸 `state`；没有 `ExecutionSessionTerminalReceipt`。
- 第 4583–4597 行：turn terminal 强制 `physicalRequestTerminals: NonEmptyReadonly`，同时 `outcome` 与 `resultingSessionCursorState` 无判别关系。
- 第 4487–4569 行：physical terminal 只能在已签发 physical request lease/send intent 后形成。
- 第 5959、7669 行：正文/门禁声称 cancellation/hard-stop/deadline 都能关闭 cursor，delivery unknown 禁止自动继续。

**最短反例/不可达路径**

session/turn lease 已提交，但在 dispatch admission 或第一个 physical request lease 前用户取消、deadline 到达或 hard-stop generation 改变。此时不能诚实构造任何 physical terminal，因而也不能构造要求非空数组的 turn terminal；session cursor只能永久 `turn_in_flight`，或被实现私下改成 `terminal` 而没有 typed terminal evidence。

另一个类型合法反例是 `ExecutionTurnTerminalReceipt{outcome:"delivery_unknown", resultingSessionCursorState:"ready"}`，下一 turn 会在上一个执行请求可能已经生效时继续。

**为什么现有合同或门禁挡不住**

现有 suite 名称写“terminal”，但接口没有 zero-request branch 或 session terminal。裸 state 不能证明由哪个 lease/取消证据推进；outcome/state 乘积也没有 superRefine 形状。

**最小根因级修法**

增加 `ExecutionTurnTerminalReceipt` 的 zero-request before-dispatch 分支，要求明确 cancellation/deadline/hard-stop evidence、空 request/tool/ledger sent 集和 not-sent report；增加 `ExecutionSessionTerminalReceipt` 覆盖零 turn、正常关闭、expiry/revocation。把 turn outcome 与 session successor state改成严格联合：delivery unknown只能 terminal/manual reconcile，completed 才可按 remaining cap 回 ready。

### A-11 GA journey evidence 可用事实失败的 payload 和 generic report 自证 `completed_pass`

**精确位置**

- 第 5881–5894 行：通用 `ConformanceResultCore` 仍允许 `reportKind="journey"`，且该形状没有 journey 字段。
- 第 6270–6317 行：journey definition/baseline 没有 expected fixture set 或 runner contract。
- 第 6392–6416 行：`GaJourneyRunPayloadV1` 只有 `completedFixtureSetDigest`，没有 expected set、runner artifact/invocation、raw evidence、exit code或开始/结束时间；`outcome` 可为 fail/incomplete。
- 第 6418–6444 行：release evidence 接受完整 payload 类型，却独立常量写 `gateOutcome="completed_pass"`；`reportAttestation`、`gateReport`、`gateAttestation` 都是通用 `ReceiptRef`；外层 exact-coverage 仍只是布尔。
- 第 6486、6962、7182、7485–7486、7673 行：正文和 gate 宣称强类型 journey、完整 fixture、generic protocol report 不可冒充、当前 distribution 精确绑定。

**最短反例/不可达路径**

生成 `GaJourneyRunPayloadV1{outcome:"completed_fail", completedFixtureSetDigest:digestOfOneTrivialFixture}`；把一个 generic protocol TCK attestation 填入 `reportAttestation`，令 `testedDistributionArtifactDigest` 与 payload 中 distribution 不同，再在 `GaJourneyReleaseEvidenceV1` 写 `gateOutcome="completed_pass"`。所有字段都满足当前类型。外层 evidence set再写 `provesExactRequiredEntryAndJourneyCoverage=true`，即可为失败或旧 binary 报告生成 GA 通过材料。

甚至无需真实 journey runner：`ConformanceResultCore{reportKind:"journey"}` 本身就可冒充 journey report，却没有 entry/auth/UI/readiness/fixture字段。

**为什么现有合同或门禁挡不住**

正文说 release verifier会比较五个 distribution digest、report kind 和 fixture集合，但类型没有 expected fixture输入或 typed journey attestation/payload digest。`gateOutcome` 没有用 `Extract<..., {outcome:"completed_pass"}>` 收窄，generic refs也没有规定可接受 target kind。故 verifier若按当前 canonical生成，就没有足够事实完成承诺；若私下硬编码，则合同不可供外部实现者复现。

**最小根因级修法**

从通用 `ConformanceResultCore` 删除 `journey`。定义独立 `GaJourneyDefinitionCore`（含 expected fixture set/runner contract）和 `GaJourneyRunPayload`（source commit、runner/SUT/distribution/platform、expected+completed set、raw evidence、started/finished、exit code）；定义 typed detached attestation，明确签 payload digest。`GaJourneyReleaseEvidence` 只接受 `Extract<GaJourneyRunPayload,{outcome:"completed_pass"}>`，并在类型上绑定同一 journey/entry/auth/distribution；gate report/attestation禁止通用 ref。

## 4. B 级发现

### B-01 workload credential lease 的“准确签名输入”遗漏 query/header/signature，主流 SigV4 审计需另写核心特例

**精确位置**

- 第 465–473 行：`WorkloadIdentityCredentialLeaseReceipt` 只有 `exactSignedMethodPathBodyDigest` 和 signer artifact，没有 query/header 或 `signatureDigest`。
- 第 493–506 行：相邻的 AWS static profile lease 正确使用 `exactMethodPathQueryHeaderBodyDigest`、recipient/region/service 和 `signatureDigest`。
- 第 5976 行：正文要求 workload 临时 credential 按 inference physical attempt签发 single-use lease；Phase 7 的 suite声称覆盖 workload/AWS signing。

**最短反例/不可达路径**

使用 AWS workload temporary credential调用需要 SigV4 的 endpoint。两个 request 的 method/path/body相同，但 query或 `x-amz-target`/signed headers不同；当前 `exactSignedMethodPathBodyDigest` 相同。虽然 `physicalAttempt` 的 prepared request可以作为额外防线，因此不足以单独断言已越权，但 workload lease本身无法证明 credential实际签了哪组 canonical headers/query，也无法与 static SigV4 共用同一 mutation/TCK判据。

**为什么现有合同或门禁挡不住**

现有 suite 只能依赖未写入 workload lease 的 provider-specific verifier，从而让“统一逐请求 credential lease”在主流 AWS路径上分叉。字段名还会误导实现只比较 method/path/body。

**最小根因级修法**

统一为 typed `ExactSignedRequestScopeReceipt`，至少绑定 method/path/query/canonical signed-header set/body/recipient/service/region、signer artifact和signature digest；AWS static/workload/declarative signer复用同一 scope，仅 credential producer不同。

### B-02 declarative signer 禁止 clock/random，但没有受信动态时间/nonce输入，常见 AK/SK pack 不可达

**精确位置**

- 第 509–523 行：声明式 signer primitives只有 hash/HMAC/encoding/sort，并强制 `forbidsNetworkFilesystemClockRandomAndExec: true`；没有 typed host-supplied timestamp/nonce/input authority。
- 第 3549–3569 行：`RequestProfile` 只允许 public protocol constants；动态 credential headers只能来自 broker。
- 第 5632 行：正文却声称常见 AK/SK 方言只新增 signing profile pack、无需修改 daemon switch。
- 第 7429 行：Phase 7 gate仍只列固定 header/body canonicalization和上述受限 primitive。

**最短反例/不可达路径**

新增一个常见 HMAC provider：签名输入要求当前 UTC timestamp和每请求 nonce，并将二者放入签名 header。RequestProfile不能生成动态值，signing DSL又不能访问 clock/random，也没有 host注入的 typed dynamic input；pack无法构造合法请求。唯一出路是修改 trusted broker/core或降为 code plugin，违反“常见 AK/SK只加 pack”的扩展承诺。

**为什么现有合同或门禁挡不住**

`canonicalInputGrammarDigest` 只描述语法，不提供动态值的生产者、可信时间/随机来源、范围、重放状态或 receipt。deterministic TCK可使用固定向量，但不能证明生产请求的 timestamp/nonce可达且防重放。

**最小根因级修法**

增加 host-owned `SigningDynamicInputReceipt`，用可信时间 authority和持久 nonce cursor产生有界 timestamp/nonce/key-id字段；DSL只读这些已提交值并把它们纳入 exact signed scope，仍禁止自行访问 clock/random。若 v1不做，则把“常见 AK/SK只加 pack”收窄为不需要动态输入的方言。

### B-03 plugin 单实例预算只有 prose，release 固定的机器 profile缺关键 CPU/RSS/process/queue字段

**精确位置**

- 第 5840 行：正文规定单 plugin RSS 256 MiB、CPU 1核/2秒 burst、进程树2、双向队列各4 MiB、prepared attempts 16；全局还要求 CPU 2核等。
- 第 6021–6041 行：唯一 typed `HostWorkerBudgetProfileV1` 只有 aggregate RSS/queue/process/prepared等字段；没有单实例 RSS/CPU/queue/process/prepared profile，也没有全局 CPU cores字段。
- 第 6470 行：正文声称所有 budget profile都是 release固定数据。
- 第 7006、7478 行：Phase 0/8 gate要求这些数字进入 snapshot/TCK digest并出强制报告。

**最短反例/不可达路径**

一个 plugin进程树占6个进程和600 MiB RSS，但系统中只有它一个：它仍低于 typed全局 `maxPluginProcessTreeMembers=8`、`maxAggregateRssBytes=768 MiB`，却违反 prose的单实例2进程/256 MiB。schema/profile digest无法指出违规；不同实现会各自硬编码或遗漏单实例限制。

**为什么现有合同或门禁挡不住**

Phase gate要求验证的数据不在版本化 profile中，无法证明 release manifest、sandbox admission和三平台报告用的是同一数字。`maxPluginProcessTreeMembers` 的命名也无法区分单实例还是全局，和正文两个数值口径冲突。

**最小根因级修法**

新增 `PluginInstanceBudgetProfileV1`，完整冻结 per-instance frame/queue/RSS/CPU burst/process/prepared/restart；在 host profile增加 aggregate CPU和明确 global process字段。plugin policy、sandbox admission、snapshot、TCK report和release manifest都强引用两个 profile digest，N-1/N/N+1逐字段验收。

## 5. 覆盖矩阵

| 审查面 | 覆盖结果 | 对应发现 |
|---|---|---|
| 1. receipt graph / commit order / cursor / epoch / anchor / TUF | manifest缺实例等值/CAS语言；TUF缺root rotation与分role高水位 | A-01、A-02 |
| 2. local control / DNS rebinding / CWSH / same UID / callback | 通用session字段存在，但OAuth/API-key/manual decision可绕过typed decision链，decision无耐久消费位 | A-03、A-04 |
| 3. OAuth / API-key PKCE / workload / static / declarative signer | start/callback失败态不可构造，refresh无family CAS；workload签名scope和声明式动态输入不完整 | A-04、A-05、B-01、B-02 |
| 4. conformance staged/live / fixed/RouteSet / wire / unknown metering | 结果/completion骨架存在；两轮disclosure与unknown target仍可在decision后换挂 | A-06 |
| 5. runtime intent / no-new-spend / persistent budget / late usage / fallback | intent/fallback闭包未发现新的独立反例；ledger correction/report的单后继仍无机器状态 | A-01 |
| 6. metadata / passive loopback / funding / terminal | held connected socket设计可关闭端口TOCTOU；credentialed/付费metadata仍可零ledger成功 | A-07 |
| 7. Execution session/turn/request/tool/effect/delivery unknown | tool注册集未闭合；effect outcome/state可非法组合；零请求终态不可表达 | A-08、A-09、A-10 |
| 8. reference-grade / GA / detached decision / journey / distribution / report kind | profile/baseline分层存在；journey payload和generic refs仍可自证pass或借报告 | A-11 |
| 9. Phase验收 / fixture / commands / DoD | 有具名suite与命令，但多项suite没有可实例化的canonical shape，无法靠测试名称补足 | A-01、A-03、A-04、A-08、A-11、B-03 |
| 10. 性能 / 隔离 / 恢复 / 供应链 / 扩展 | 数值与平台矩阵较完整；plugin预算未完全机器化，AK/SK扩展可达性不足，TUF恢复链不完整 | A-02、B-02、B-03 |

## 6. 最终 verdict

`FAIL`

阻断理由不是“尚未实现”，而是冻结合同自身仍允许上述类型合法反例，且若干承诺没有足够的机器字段让外部实现者和 release verifier得出同一结论。至少应先关闭全部 A-01–A-11，并把 B-01–B-03 写入 canonical shape、对应 Phase acceptance和具名 mutation/kill-point fixture；重新冻结新 SHA 后，再以全新零上下文复审。A=0 且 B=0 之前不得标记 reference-grade/GA 通过或开始实施。
