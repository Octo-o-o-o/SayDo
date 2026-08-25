# SayDo AI Supply 参考实现级最终对抗复核 v8

## 输入完整性

| 项目 | 初检 | 完整读取后复检 |
|---|---:|---:|
| 行数 | 14,502 | 14,502 |
| bytes | 945,084 | 945,084 |
| SHA-256 | `5ae8c540fe32e67cc6bae3788f22b90126223e3914dce5f236d273d0f2e51d65` | `5ae8c540fe32e67cc6bae3788f22b90126223e3914dce5f236d273d0f2e51d65` |

输入无漂移。以下行号均指唯一目标文件。

## 发现

### F-01 [A] workload metadata 来源仍可选择 `credentialed` 分支并携带凭据

**精确行号：** L400–444、L510–528、L593–614、L11428、L13240。

**最短反例：** 构造 `provider:"aws", sourceKind:"instance_identity"` 的 profile，却选择 `credentialMode:"credentialed"`，附加 Bearer、proxy 或 mTLS credential component。该分支继承完整 `WorkloadIdentityProfileReceipt`，没有排除 AWS instance identity、Google metadata identity、Azure managed identity，也不要求 metadata admission。

**现有合同/门禁为何挡不住：** “只能走零 credential”仅存在于正文和另一联合分支；当前 TypeScript 联合本身接受该组合。必填 `never` 审计只检查字段存在性，不能检查 `profile.sourceKind × credentialMode` 相关性；Phase 7 未具名要求此交叉负例。

**根因级最小修法：** 按 `(provider, sourceKind)` 建立严格映射联合；`credentialed.profile` 明确排除三种 metadata 来源，metadata 分支强绑同一 profile、endpoint、request、空 component set、no-credential proof 和 source-specific admission。增加 TypeScript、Zod、CAS 三层换挂负例。

### F-02 [A] access-token-only OAuth 成功结果无法形成真实 credential-family cursor

**精确行号：** L1277–1284、L1613–1624、L1715–1755、L1757–1834。

**最短反例：** 标准 PKCE 或 device token response 成功返回 access token、但不返回 refresh token。`OAuthCredentialTransitionBase` 和 grant/family receipt 明确允许 refresh 字段缺失；然而所有 family cursor 都继承必填的 `currentRefreshCredentialSourceDigest/currentRefreshSecretVersion`，access lease又必须引用 family cursor。

**现有合同/门禁为何挡不住：** 没有“初始 access-only”cursor。唯一 `access_only_reauthorization_required` 状态必须先从一个真实 refresh lease释放而来，因此实现只能伪造 refresh source/version、拒绝文本明确允许的成功响应，或让不存在的 refresh credential取得 lease。`oauth-state-machine.tck` 没有该正向可达性要求。

**根因级最小修法：** 将 family/cursor严格拆成 `refreshable` 与 `access_only` 两类。access-only cursor允许签发未过期 access lease，但 `OAuthRefreshFamilyLeaseReceipt` 对其为 `never`；初始 commit必须根据 token response是否含 refresh token选择唯一分支。

### F-03 [A] `authorization_pending/slow_down` 未限于 device poll，可锁死或重放 refresh family

**精确行号：** L1204–1224、L1389–1464、L1488–1516、L1543–1564、L13233–13238。

**最短反例：** 已取得 `OAuthRefreshFamilyLeaseReceipt` 的 refresh exchange被映射为 `authorization_pending`。通用 pending terminal使 exchange cursor回到 `ready`，但 refresh-family release联合没有 pending分支，family仍为 `refresh_in_flight`。遵守 single-use则永久卡死；继续 retry则只能复用已消费的 family lease或 refresh token。authorization-code分支同样可被引向重放 code。

**现有合同/门禁为何挡不住：** pending terminal、`poll_retry` cursor及下一 exchange lease都引用宽泛 `OAuthTokenExchangeLeaseReceipt/OAuthExchangeReadyCursorReceipt`。现有“状态专属联合”门没有定义 `exchangeKind × outcome × cursorCause` 矩阵。

**根因级最小修法：** pending terminal和 `poll_retry` cursor只接受 `OAuthDevicePollExchangeLeaseReceipt`；下一 device poll强绑上一 pending terminal。authorization-code或refresh收到该类响应只能进入具名协议错误终态，并对 refresh执行相应撤销/release。补齐全交叉矩阵负例。

### F-04 [A] credential issuance没有独立 send-intent，refresh零字节重试与 IMDSv2 多请求均不可线性化

**精确行号：** L510–657、L1389–1484、L1531–1540、L2362–2488、L11411、L11425、L13238–13242。

**最短反例：** refresh exchange lease已经提交，请求写出首字节后进程崩溃。恢复时的持久状态与“尚未写出首字节即崩溃”完全相同：只有带 `persistedBeforeAnyNetworkByte:true` 的 lease，没有后续 send-intent；terminal只收自由 `terminalEvidenceDigest`。构造 `failed_before_send` 后即可保留并再次发送可能已经被消费或轮换的 refresh token。

同一根因还使 AWS IMDSv2 不可完整表示：取得 session token的 PUT 与取得 credential的 GET 是两个物理发送，当前 workload issuance只有一个 ordinal、一个 request digest、一个 terminal，token acquisition只被压成布尔声明。

**现有合同/门禁为何挡不住：** 正文和 Phase 1 明确要求“lease后另持久化send intent”以及“只有send intent能证明零字节”，但 OAuth、API-key exchange和 workload issuance均没有相应 receipt。门禁若保守处理只能把所有崩溃都判 unknown，从而无法构造承诺的安全 before-send retry；若接受自由 digest则无法阻断重放。

**根因级最小修法：** 为 OAuth、API-key和 workload issuance增加 writer-fenced、single-use的物理 send-intent。只有在 reference monitor保证“无 intent即绝不发送”时，intent缺失才可权威形成 not-sent；intent已存在但无 terminal一律 unknown。IMDSv2再拆成 token PUT与credential GET两个有界子请求 cursor，每步独立 lease、intent、terminal和账务/恢复状态。

### F-05 [A] fresh witness的普通 TUF authorization依赖尚未取得的持久强锚，形成自举环

**精确行号：** L2713–2754、L3018–3041、L3228–3244、L3327–3375、L11406、L13171–13172。

**最短反例：** fresh macOS只有 `BootScopedEphemeralLocalAnchorReceipt`。要构造 witness service profile，`releaseTufTarget` 必须是普通 `TufTargetAuthorizationReceipt`；后者要求 `SecurityMonotonicAnchorReceipt` 和 repository high-watermark cursor。该持久强锚又只能在 witness enrollment之后取得。

**现有合同/门禁为何挡不住：** `doesNotRequirePersistedTufHighWatermarkBeforeEnrollment:true` 只是 literal，未改变 `releaseTufTarget` 的强类型依赖。把发布者设备生成的普通 TUF receipt直接带入又违反“跨 domain只导入无出边 opaque leaf”，且不能证明当前设备的 anti-rollback状态。

**根因级最小修法：** 新增独立 `ReleasePinnedBootstrapWitnessAuthorizationReceipt`，仅依赖当前 distribution的 immutable manifest、pinned initial root和准确 target bytes，不依赖设备 high-watermark；发布域证据以 opaque leaf导入。enrollment commit后再切换到普通、设备强锚绑定的 TUF authorization。

### F-06 [A] bootstrap“一次请求”能力与 response-loss反复 reconciliation不可同时满足

**精确行号：** L3018–3145、L3228–3244、L12617、L13171。

**最短反例：** 唯一 enrollment请求已发送但响应丢失。若 `anchorWitnessBootstrapNetworkCap:1` 是累计请求上限，status query是第二次请求而不可达；若它只是并发限制，`still_unknown` 可以无限回到 reconciliation ready，形成无界 boot网络权限。

**现有合同/门禁为何挡不住：** request lease与reconciliation lease之间没有共享、可消费的 boot-scoped次数/字节/墙钟 cursor；文本同时要求“恰好一次特殊能力”和“反复查询”。reconciliation lease本身也没有累计 query ordinal或耗尽终态。

**根因级最小修法：** 明确拆成 `registrationRequestCap=1` 与有限 `statusQueryCap=N`，由同一 durable boot budget cursor原子扣除累计次数、请求/响应字节、墙钟、退避及生命周期；耗尽进入具名安全终态。若坚持总请求数为1，则删除网络 reconciliation并定义不可恢复收口。

### F-07 [A] persistent budget的late correction可让实际总费用突破用户硬额度

**精确行号：** L3901–3914、L4263–4275、L4282–4304、L4350–4450、L11418、L13366–13367、L13877。

**最短反例：** 总预算10。child A预留10；“authoritative final usage”报告0并释放10；child B随后消费10；A迟到上调为10。correction到达后才冻结新 reservation并进入 `deficit_hard_stopped`，最终费用已经是20。

**现有合同/门禁为何挡不住：** hard stop只能阻止未来费用，不能撤回B。计划还把“settle→新授权→迟到上调→余额不足后deficit”明确列为合格 gate，因而固化了超额后的止损，而非“总cap永不突破”。这也与 `noFutureUsageForChildCanAppear...:true` 自相矛盾。

**根因级最小修法：** 二选一并写成唯一合同：真正 final后禁止上调，将其视为 authority breach；或在 correction horizon关闭前不把unused hold变为可消费余额，并保留 correction escrow。机械不变量必须为“已付 + outstanding hold + 尚可更正的已释放负债不超过总额度”，correction强引用准确 finalized settlement及释放向量。

### F-08 [A] fallback outer terminal可与inner runtime terminal结果相矛盾

**精确行号：** L5408–5441、L8128–8220、L11413、L13392–13393。

**最短反例：** inner `RuntimeRouteSequenceTerminalReceipt.outcome="success"`，outer却填写 `outcome:"retryable_failure", continuation:"advance"`，随后调用下一 solution；或者inner为 `delivery_unknown`，outer伪装成 `failed_before_send/not_sent` 后 advance。

**现有合同/门禁为何挡不住：** outer只强引用inner terminal并声明其先提交，却独立重填 outcome、sentState、continuation和billing disposition；`transitionPredicateEvidence`仍是裸 `ReceiptRef`。Phase 3文字门列出了应拒绝的例子，但没有给出可生成的 inner→outer判别映射或固定 fold，测试与producer可共享同一错误映射。

**根因级最小修法：** 将 outer terminal定义为从inner terminal派生的严格联合或固定版本化 fold，禁止自由重填结果轴；success、unknown、cancel/deadline、sent state和billing disposition均由inner及权威ledger唯一决定，只有明确 eligible retry edge允许 advance。

### F-09 [A] staged/live没有 restart与loaded-generation barrier，live可验证错误产物

**精确行号：** L83、L3536–3560、L4590–4620、L7254–7277、L12636、L13360–13363、L13572。

**最短反例：** staged对候选配置成功；不执行restart；随后live仍在旧active binary/config generation上成功。两轮顺序、round标签和ledger均正确，仍可填写 completion并生成 Capability/Binding。

**现有合同/门禁为何挡不住：** completion只有 `stagedTerminalPrecedesLiveLeaseEvidenceDigest`，没有 restart receipt、loaded distribution/config generation或live lease对该barrier的强引用。现有门只校验round、顺序、结果和总预算，不验证restart及其加载对象。

**根因级最小修法：** 建立 `staged_passed → restart_committed → live_ready` 的单向cursor。restart barrier必须证明准确候选snapshot、binary/config generation已加载；live intent/lease、result和completion全部强引用同一barrier及loaded identity，并加入旧generation/live-before-restart负例。

### F-10 [A] 人工确认 `effect_committed` 后无法构造最终tool transition

**精确行号：** L9356–9370、L10330–10450、L10508–10556、L11419、L13885。

**最短反例：** side-effect进入 `executing_unknown`；owner合法选择 `effect_committed`，生成 `manual_reconcile: executing_unknown→executed`。结果随后可取得时，唯一 `record_result` final分支要求 `executedTransition` 必须是普通 `transition:"commit"`；final联合又不接受 `manual_reconcile`。

**现有合同/门禁为何挡不住：** `ExecutionToolResultsAppliedReceipt`要求每个child都已有 `ToolInvocationFinalTransitionReceipt`，所以该路径无法继续turn。现有model gate声称六类final可达，但类型联合缺少该正例；类型编译和交叉拼接负例都不能证明活性。

**根因级最小修法：** 让 `record_result.executedTransition` 严格接受普通commit或 `manual_reconcile(effect_committed)`，后者强绑unknown terminal、已消费owner decision、权威effect evidence和结果来源；或增加专用 `record_manually_reconciled_result` final variant。

### F-11 [A] turn `delivery_unknown` 可用任意receipt直接终结session

**精确行号：** L9012–9022、L9470–9522、L11416、L13521、L13884。

**最短反例：** 物理请求进入 `delivery_unknown` 和 `ExecutionSessionReconciliationRequiredCursorReceipt`；随后令 unknown session terminal的 `uncertaintyReconciliationDisposition` 指向任意无关但结构有效的 receipt，即可把session置terminal。

**现有合同/门禁为何挡不住：** 该字段是宽泛 `ReceiptRef`，全文没有 turn-unknown reconciliation的判别cursor、结果类型或人工决定消费状态机。因而无法机械证明远端session/process已关闭、identity已永久封锁、effect/账务hold仍保留或operator决定已消费。现有TCK只明确禁止下一turn lease。

**根因级最小修法：** 新增 writer-fenced `ExecutionTurnUnknownReconciliationReceipt` 状态机，至少区分 authoritative resolved、cleanup confirmed、permanent-block-with-hold和still-unknown；人工分支强绑proposal/disclosure/decision/consumption。session terminal只能消费其具名 committed terminal。

### F-12 [A] GA gate不比较expected/final readiness，也允许inventory成为required GA entry

**精确行号：** L11906–12044、L12077–12256、L12315–12359、L12405–12573、L13140。

**最短反例：** matrix entry填写 `requiredForGa:true, releaseMaturity:"inventory"`；journey定义期望 `conversation_ready`，run payload实际填写 `finalSolutionReadiness:"blocked"`，同时填写 `outcome:"completed_pass", exitCode:0`、fixture全部通过。现有run→journey→entry→ecosystem类型链仍可构造。

**现有合同/门禁为何挡不住：** expected/final readiness只分别存在于definition和payload，没有明确相等refinement或gate字段；pass类型只收紧outcome、exit code、fixture和raw evidence。entry/ecosystem gate也没有eligible maturity判别。L13140列出的release verifier等值项包含surface/protocol/auth/realm/category和 `requiredForGa`，仍未包含readiness或maturity资格。

**根因级最小修法：** 在reference profile冻结GA允许的maturity集合，并令 `requiredForGa:true` 分支只能使用该集合；run gate显式重算并要求actual readiness等于definition expected，正向GA旅程不得以blocked通过。entry/ecosystem gate重复验证该约束，并加入inventory、blocked、降级后沿用旧pass等mutation。

### F-13 [B] `session_closed_before_request` 被投影为ready，下一turn仍可取得lease

**精确行号：** L8981–9001、L9051–9067、L9375–9389、L9443–9454。

**最短反例：** 远端Agent在本turn首请求前权威关闭session。zero-request terminal产生 `session_closed_before_request`，turn terminal仍写 `resultingSessionCursorState:"ready"`；ready cursor只排除 `delivery_unknown`，因此下一writer可立即取得下一turn lease并复用已关闭的session ID/lease。

**现有合同/门禁为何挡不住：** zero-request与turn gate没有为该outcome定义专属session投影；现有“unknown禁止下一turn”测试不覆盖closed outcome。

**根因级最小修法：** 将该outcome直接投影为 `session_closing/terminal`，从ready分支排除。若产品需要重连，必须重新执行session admission/start/recovery并取得新session lease，不得复用旧cursor。

### F-14 [B] Phase 0声称验收receipt语义，但实际gate未运行对应机械检查

**精确行号：** L13172–13173、L13198–13205、L13872、L13900–13917。

**最短反例：** canonical中引入必填 `never`、producer cycle或未登记bare ref，同时保持五处execution-plane投影、链接和emoji检查一致。`check-ai-supply-phase0-gate.mjs` 按当前列明步骤仍可成功，Phase 0即可收口。

**现有合同/门禁为何挡不住：** Phase 0验收明确要求edge manifest、producer DAG和instance verifier使错误非零；但gate编排只列C域文件、legacy path、canonical consistency、links和emoji。`receipt-dag-and-anchor.model` 首次强制阶段却是Phase 1，增量门表也没有Phase 0语义编译项。

**根因级最小修法：** 将schema strict compile、required-`never`枚举、edge-manifest完整性、producer DAG、实例无环和正向可达性fixture直接加入Phase 0 gate，并以故意cycle/裸ref/不可构造联合证明gate会红；Phase 1再承担运行时store/CAS实现。

### F-15 [B] publisher公平预算在正文和Phase 8为必需，但唯一机器profile缺少对应字段

**精确行号：** L11291、L11474–11513、L12605–12606、L13685–13686、L13888。

**最短反例：** publisher A的两个合法plugin各占16个prepared attempts，正好吃满host的32；publisher B已有健康plugin但无法取得prepared slot。A满足单plugin cap、`maxActivePluginsPerPublisher:2`和全部host aggregate cap。

**现有合同/门禁为何挡不住：** `HostWorkerBudgetProfileV1`只有publisher active-plugin和ContentHandle数量上限，没有publisher级queue/prepared/RSS/CPU/process份额；`PluginWorkerBudgetProfileV1`也只有单实例限制。正文另写“单publisher最多占剩余一半”，但Phase 8同时要求所有publisher级数值只能来自唯一profile，禁止第二份文字常量，导致gate没有合法机器输入。

**根因级最小修法：** 在唯一profile中加入publisher级queued jobs/bytes、prepared、RSS、CPU、process、worker-slot及健康核心保留份额，固定weighted-deficit调度、退避和抢占规则；用两个持续负载publisher验证最低服务份额、尾延迟及daemon恢复后的配额连续性。

## 计数

| 严重度 | 数量 |
|---|---:|
| A | 12 |
| B | 3 |
| C | 0 |
| 合计 | 15 |

## 覆盖矩阵

| 对抗面 | 结果 |
|---|---|
| receipt可构造性、必填`never`、实例环 | F-02、F-05、F-10、F-14 |
| 错误状态取得lease/terminal | F-03、F-13 |
| intent、descriptor、conditional lease、hosted bundle、send intent顺序 | F-04、F-09；其余descriptor/bundle链未发现新增阻断 |
| 首字节、effect、账务线性化 | F-04、F-07、F-10、F-11 |
| 权限、凭据、网络、费用、数据、产品权益换挂 | F-01、F-12 |
| OAuth/API-key family、旧key/refresh复用 | F-02、F-03、F-04 |
| workload metadata零credential路径 | F-01、F-04 |
| persistent budget并发与late correction | F-07 |
| Execution recovery、turn unknown、side-effect、zero/read-only结果 | F-10、F-11、F-13；read-only与zero-work专属分支未发现新增阻断 |
| anchor witness自举与boot权限 | F-05、F-06 |
| custom secret header覆盖preset | 已审；当前文本已有规范化、collision和preset同名负例，未发现新增阻断 |
| custom/official unknown可达性 | 已审；当前文本已有两条判别链与逐次consent，未发现新增阻断 |
| fallback不得越过inner runtime | F-08 |
| staged/live round与restart | F-09；round标签本身已有typed约束 |
| GA单run、失败payload、自证、降级、错auth、旧binary | F-12；集合覆盖、auth和distribution绑定其余部分未发现新增阻断 |
| 正文合同进入Phase gate | F-14 |
| 主流API/CLI/订阅/本地runtime免猜配置 | 已审；未发现独立于GA/readiness缺口的新增阻断 |
| 资源、恢复、供应链与扩展边界 | F-05、F-06、F-11、F-12、F-15 |

## 唯一结论

**FAIL**

存在12项A级和3项B级缺口。当前方案尚不能作为一次到位、可实施、可机械验证且达到顶级开源参考实现标准的最终合同。