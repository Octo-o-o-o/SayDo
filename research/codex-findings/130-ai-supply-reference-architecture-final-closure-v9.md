# AI Supply 通用接入最终架构收口评审 v9

## 1. 冻结输入与读取完整性

- 唯一评审目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。
- 首次只读核对：16,355 行，1,025,192 bytes，SHA-256 `ae6175a7195411f6878f4317ef4413f354df0763e3be6a80e7c54fc2c0c6980e`，与冻结输入完全一致。
- 阅读方式：按行号顺序连续读取 1–16,355 行；工具输出发生截断的边界均立即补读，补读区间为 12,310–12,323、13,066–13,071、15,075–15,120、15,270–15,320、16,105–16,118、16,270–16,296。未以关键词抽样替代全文读取。
- 结束前只读复核：16,355 行，1,025,192 bytes，SHA-256 `ae6175a7195411f6878f4317ef4413f354df0763e3be6a80e7c54fc2c0c6980e`，读取期间输入未漂移。
- 评审边界：未读取源码、AGENTS、旧 prompt/review、journal、索引或其他文件；未修改目标文件。

## 2. 计数

- A：3
- B：3
- C：0

## 3. 发现

### A-01 durable lease 已把 cursor 置为 in-flight，但 intent 尚不存在时，多条核心状态机没有可构造终态

精确位置：

- 通用合同声称 child lease 在同一 CAS 中把 cursor 置为 in-flight，发送前另持久化 intent，并要求发送前 cancel/hard-stop/deadline 能关闭 cursor：L13061–L13062、L15351–L15352。
- fresh witness registration：lease 把状态置为 `bootstrap_request_in_flight`（L3679–L3705），intent 是后续独立 receipt（L3708–L3725），但 terminal 公共部分无条件要求 `sendIntent` 和 budget settlement（L3727–L3738）；所谓 `failed_before_send` 仍继承该必填 intent（L3750–L3755），且 registration union 没有 cancel、hard-stop、deadline 分支（L3740–L3771）。status query 虽有真正的 `sendIntent?: never` 分支，却只覆盖 failed/cancel/deadline，没有 hard-stop（L3848–L3887）。
- inference conformance/runtime：final physical lease 把 cursor 置为 `attempt_in_flight`（L6029–L6036、L6085–L6125），send intent 是后续对象（L6128–L6219）；所有 `PhysicalAttemptTerminalReceipt` 分支先无条件要求 send intent（L6231–L6276），随后却声明 `failed/cancelled/hard_stopped/deadline_before_send`（L6303–L6325）。
- Execution session start：intent 后置于 start lease（L9731–L9744），terminal base 无条件要求 `startIntent`（L9746–L9757），而 before-start outcome 又声称可覆盖 fail/cancel/hard-stop/deadline（L9759–L9779）。Execution physical request 同样在 terminal base 必填 send intent（L10373–L10401），再声明 before-send terminal（L10453–L10476）；tool external request 同样如此（L11244–L11272、L11319–L11370）。
- metadata probe：lease 先进入 `request_in_flight`（L13369–L13419），intent 后置（L13437–L13448），terminal base 必填 intent（L13450–L13460），before-send 分支因此无法表达 intent 缺失（L13472–L13506）。
- workload identity 的物理 step 正确区分 no-intent before-send（L747–L797），但 outcome 集漏掉 hard-stop（L747–L755）；更外层 logical request lease 已把 issuance cursor 置为 `request_in_flight`（L520–L539），而 logical terminal 必须携带非空 physical sequence（L916–L978），因此 lease 后、首个 physical step 前没有 zero-step 终态。
- OAuth/API-key 是本文件内的正确先例：before-send 以 `sendIntent?: never` 表达，unknown 强制 intent（L1926–L1979、L2893–L2966）；显式断言也只覆盖 workload/OAuth/API-key/query，未覆盖上述 inference、Execution、metadata、registration gap（L12059–L12131、L12151–L12165）。

最短反例：

1. writer 以合法 epoch/CAS 提交 final/start/request lease，cursor 已从 ready 变为 in-flight，费用或资源 hold 已预留。
2. 在下一事务写入 send/start intent 之前，hard-stop generation 增加，或 lease 到期、用户取消、进程崩溃后接管者发现旧授权已失效。
3. 新 intent 已不可合法签发；现有 terminal 又强制要求该 intent，或要求至少一个 physical step。cursor、hold、registration identity/session identity 永久无法收口。

为何现有门挡不住：

- TypeScript union 本身允许“有 intent 的 before-send”分支，所以 strict 编译和 `Extract/never` 不会报错；真正缺失的是 no-intent constituent。
- `inference-funding-attempt.model` 只枚举正常链 `final lease → bundle → intent → terminal`，未要求 `final lease committed → intent absent → terminal` 的 kill-point（L15702）。
- `execution-surface-chain.tck` 与 `execution-tool-child-lease.model` 检查 unknown、tool fold 和 cursor 拼接，但未明确要求 start/request/tool lease 后 intent 前的 no-intent terminal（L15711–L15712）。
- `platform-anchor-offline-mode.tck` 检查 query before/after-send，却未覆盖 registration 的 cancel/hard-stop/deadline和 query hard-stop（L15717）。Phase 0 的总括性“所有 kill-point”文字（L14999、L15524）不能自动生成缺失的 union member。

根因级最小修法：

1. 为每个 durable in-flight 边界把 terminal 写成按 `intentState: "absent" | "present"` 映射的判别联合。absent 分支必须 `sendIntent?: never`/`startIntent?: never`、零 process/network/effect bytes、明确释放或保留 disposition，并覆盖 fail/cancel/hard-stop/deadline/expired/revoked；present 分支才允许 sent、zero-byte transport proof 或 delivery-unknown。
2. 为 workload logical issuance 增加从 logical in-flight 到 terminal 的 zero-physical-step no-intent 分支；为 workload physical step和anchor query补 hard-stop。
3. 对 registration、inference conformance/runtime、metadata、Execution start/request/tool逐一增加正向可构造断言、错误 intent 换挂断言，以及 `lease CAS 后 / intent 前` 的 crash、cancel、deadline、revocation、旧 epoch 接管 mutation。门禁必须检查最终 cursor 与 hold 都收口，而不只检查“没有第二次发送”。

### A-02 remote transparency witness 只有 fresh enrollment 外壳，没有持续强锚/阈值服务协议，三平台 full mode 无法实现或验证

精确位置：

- `SecurityMonotonicAnchorReceipt` 对 remote witness 的全部在线证明仅是裸 `witnessEvidenceDigest: string`；没有签名成员集合、quorum、append/read operation、CAS、nonce、checkpoint或一致性证明（L3205–L3219）。
- `RemoteTransparencyWitnessServiceProfileV1` 只保存 endpoint/schema/policy 的 digest 和一个 `thresholdMemberId`（L3244–L3272）；backend 却允许多个 service profile 和任意 `threshold`（L3325–L3348）。类型没有约束 `1 <= threshold <= unique members`，也没有 member key、响应、quorum bundle 或 equivocation proof 的可遍历对象。
- bootstrap success/commit 仍只绑定一个 singular `witnessService` 和一个标量 `verifiedThresholdEnrollmentResponseDigest`（L3741–L3748、L3900–L3911）；最终 enrollment 也只把 threshold set 压成 digest（L3933–L3973）。
- 全部显式网络状态机仅覆盖 enrollment registration/status query（L3380–L3912）。成功 enrollment 之后，没有 `counter N → N+1` 的 append/update lease、send intent、threshold response、commit cursor、重启查询、并发 sibling、rotation或continuity recovery 协议。
- 文本同时要求三平台统一可用阈值 remote witness，并把它称为“一等控制面服务”（L14441–L14443）；GA 又禁止以未实际运行的 witness mock 过门（L15522）。预期代码结构却没有 witness client/service、部署或 operator 组件（L15527–L15613），唯一具名 TCK 只覆盖 fresh bootstrap（L15717）。

最短反例：

1. macOS fresh install 完成 enrollment，得到 counter `N`。
2. daemon 要提交下一次 writer epoch、budget/OAuth/effect cursor，因此必须得到数据库外、不可回滚的 counter `N+1`。
3. 合同没有定义向哪些 threshold members 发送什么、如何原子比较 `N`、如何收集和验证 quorum、成员分叉/超时如何恢复、怎样生成下一张 typed anchor。实现只能自行发明协议，或把任意字节摘要填入 `witnessEvidenceDigest`；前者不再是统一合同，后者无法机械证明强锚。

为何现有门挡不住：

- receipt DAG/TUF verifier无法遍历或验证裸 `witnessEvidenceDigest`、`requestAndResponseSchemaDigest`、`thresholdSetDigest` 内的语义。
- bootstrap TCK 能证明“一次注册不重复”，不能证明注册后的每次受保护 state advance 真的由外部 quorum 线性化。
- “真实 producer”GA 条款没有可调用的 service public entry、服务端状态模型、部署 subject、签名 key set或 black-box fixture，因而无法区分真实阈值服务、单节点代理和自行填 digest 的 mock。

根因级最小修法：

1. 定义 typed `WitnessMemberProfile/KeyReceipt`、`AnchorAdvanceCursor/Lease/SendIntent/Terminal/Commit`、`WitnessMemberResponseReceipt`、`ThresholdQuorumBundleReceipt`、checkpoint/consistency/inclusion/equivocation/rotation/recovery receipt；所有对象绑定 old/new counter、old/new protected state、device pseudonym、nonce、operation ID、writer epoch、idempotency key、member ID/key version、threshold set revision和时限。
2. 约束 member 唯一性与 threshold 范围；明确 client 直连多个成员还是受信 aggregator，并对 partial quorum、成员分叉、重放、并发 sibling、网络分区、key rotation、服务迁移和 continuity loss给出唯一状态转移。
3. 明确服务端/外部 operator 的实现与部署边界、不可变存储和灾备/SLO、rate limit/abuse、数据保留删除、密钥仪式及 release qualification public entry。若服务由第三方提供，也必须有同等机器可读 conformance profile和受信运行报告。
4. 用 typed quorum evidence 替换 `witnessEvidenceDigest`，新增“enroll 后连续推进、双 daemon、rollback、equivocation、成员故障、跨 realm failover、rotation/recovery”的 model/TCK；GA 对真实服务黑盒运行，而非只验客户端 bootstrap。

### A-03 reference-grade 固定最低集强制 Claude subscription surface，但公开分发策略又规定默认 API-only，GA 在无外部批准时不可达

精确位置：

- `ReferenceGradeProfileV2.requiredNamedEntryKeys` 固定包含 `execution.claude-code`（L13804–L13809），并要求 `execution_subscription_surface` 至少 4 个 subscription entry（L13874–L13878）。四个具名 execution entry 中正好包含 Claude，删掉它后该最低数也无法满足。
- GA baseline 的 execution row只要求 Codex App Server、OpenCode ACP 和一个普通 CLI，共 3 个 surface（L14959–L14961），与固定 profile 的 4 个 subscription surface 口径不同。
- Phase 5 明确规定公开分发版 Claude 保持 API-only，除非获得 Anthropic 批准或官方条款/接口改变（L15313–L15327）；owner 默认裁决再次建议禁止分发版 Claude subscription（L15845–L15851）。
- 同一文件又规定 fixed reference minima 不能被 baseline/owner decision 删除，删除会撤销 reference-grade/GA designation（L14450–L14451、L15520–L15523）。

最短反例：

1. 按本文默认且合规的 owner 决策实施：没有 Anthropic 书面批准，Claude 只提供 API，不发布 Claude Code subscription connector。
2. 其余 Phase 全部实现并通过。
3. release verifier仍必须找到 `execution.claude-code`，且必须凑足 4 个 subscription execution entry；两项都失败。若为过门而启用，则直接违反本文自己的 rights/product policy。

为何现有门挡不住：

- TypeScript 能分别构造固定 profile 与 owner decision，未建立“外部 approval artifact存在才把 Claude 加入 fixed tuple”的条件类型。
- `realm-and-ga-binding.tck` 会在 Phase 8 最后发现缺 entry，但它只是把一个从 Phase 0 起已不可达的目标推迟到收口，不会给施工方合法实现路径。
- baseline、profile、Phase 5和owner默认裁决不是由同一个机器 core 生成；各自内部可过 schema，却相互矛盾。

根因级最小修法：

1. 选择一个可在当前权利边界内交付的固定 SoT：从 reference minima 移除 `execution.claude-code` 并把 execution minimum 改为当前合法集合；Claude 保持 conditional/inventory replacement。或者把“有效 Anthropic approval/official surface evidence”变成 Phase 0 必备 typed prerequisite，并由它选择另一个 profile designation，禁止无证据构造该 profile。
2. 从同一机器 core生成 `requiredNamedEntryKeys`、category minima、§9.9 baseline、Phase 5批次与 GA fixtures；Phase 0 增加 exact-set equality gate，禁止依赖 Phase 8 才发现冲突。

### B-01 persistent budget 声称到调和截止时间悲观提交，但类型只有无限 hold-retained 循环

精确位置：

- policy只区分 immutable final 和 bounded correction horizon（L4668–L4701）。
- settlement observation 只有 `authoritative_final_usage`、`authoritatively_not_sent`、`provisional_usage_correction_horizon_open`、`nonfinal_usage|charge_unknown`（L5058–L5103）。
- finalized apply只接受前两类权威观察（L5105–L5124）；后两类只能 `hold_retained → settlement_ready`，完整最坏 reservation继续留在 outstanding set（L5138–L5154）。没有 reconciliation deadline expired/pessimistic final constituent。
- 费用规范却明确要求每个来源/单位都有调和截止时间，截止仍未知时“悲观提交最坏金额，不释放”（L12448–L12450）。后文只重复 unknown 永久保留 hold，没有把 deadline 转成可达 terminal（L13068）。
- `persistent-budget-ledger.model` 只检查 final/horizon close/not-sent 释放与 escrow correction，不检查 deadline pessimistic close（L15704）。

最短反例：

provider 的 usage/账单接口在已发送请求后永久下线。每次 query 都只能得到 `charge_unknown`，apply 永远回到 `settlement_ready`；即使调和截止时间已过，也没有合法 receipt 能把 reserved worst-case记为最终已消费并从 outstanding child set移除。该 policy 的余额、outstanding count和持久存储状态永不收敛。

为何现有门挡不住：

- 安全侧“绝不释放未知费用”会通过现有测试，但恢复/耐久侧“到 deadline 必须收口”没有类型、producer或 mutation。
- bounded horizon只处理允许后续 correction 的 usage authority，不等于通信永久失败时的 reconciliation deadline；不能拿 `authoritativeHorizonCloseEvidence` 伪造 provider finality。

根因级最小修法：

增加 `reconciliation_deadline_pessimistic_final` observation/apply terminal：由 trusted time、policy deadline和完整 query history证明到期，把 `actualBillingVector` 取预留 worst-case、释放量固定为 0、原子移除 outstanding child/physical hold并 terminalize settlement；规定迟到权威 usage只能进入单独 correction/anomaly，不能重新增加用户授权。为永久断联、daemon重启、deadline N-1/N/N+1和迟到 usage增加 model fixture。

### B-02 protocol conformance core 的 plane 与 protocolId 未相关，正式报告可构造跨平面语义主体

精确位置：

- `ProtocolImplementationReceipt` 正确把 inference plane 绑定 `InferenceProtocolId`、execution plane绑定 `ExecutionWireProtocolId`（L8826–L8846），但它只持有一个标量 `protocolTckPayloadDigest`，没有 typed payload relation（L8814–L8823）。
- `ConformanceResultCore` 的 protocol branch 把 `plane` 写成独立 union，同时把 `protocolId` 放宽为 `string`（L12940–L12954）。因此类型不保证 inference/execution namespace、endpoint identity和adapter subject与 plane匹配。
- 现有 ContractAssert 只证明四种 reportKind可达并排除跨 kind字段（L14338–L14364），没有断言 execution plane不能携带 `InferenceProtocolId`，反之亦然。
- prose 和 Phase 门声称跨平面 receipt/TCK swapping 必须拒绝（L12679、L13043、L15083、L15767–L15777），但 machine core本身没有表达该关系。

最短反例：

构造合法 strict-JSON/TypeScript core：`{ reportKind:"protocol", plane:"execution", protocolId:"ext:inference:evil.adapter@1", ... }`。它满足当前 branch；再把其 payload digest填入 execution `ProtocolImplementationReceipt.protocolTckPayloadDigest`。除非实现另写一套文档未指定的 bespoke join，类型、strict schema与现有断言都不会拒绝。

为何现有门挡不住：

- `protocolId: string` 吞掉了两个 namespaced ID union；`plane` 不能自动窄化它。
- attestation和release binding只绑定 payload digest与 distribution，不补充 payload语义关系。
- cross-kind mutation不等于 cross-plane protocol mutation；当前显式断言测试的是错误维度。

根因级最小修法：

把 protocol core改为嵌套判别联合：`plane:"inference"` 必须携带 `InferenceProtocolId`、inference endpoint/adapter subject；`plane:"execution"` 必须携带 `ExecutionWireProtocolId`、execution surface/wire subject。`ProtocolImplementationReceipt` 引用 typed verified payload/binding而非只有 scalar digest，并新增双向 cross-plane `ContractAssert<ContractIsNever<...>>`、strict-schema mutation和 release verifier join。

### B-03 publisher 公平性只有若干常量，没有可判定的 WDRR 语义；Phase 0 断言还漏掉最低份额字段

精确位置：

- `HostWorkerBudgetProfileV1` 给出 max active、per-publisher caps、`minimumHealthyPublisherDispatchSharePermille: 250`、最大连续 4 次和 scheduler 名称（L13124–L13160），但未定义 eligible/healthy集合、share分母与时间窗、job cost单位、weight/quantum来源、deficit上限、idle/new publisher初始化、重启债务、并发 tie-break或 overload 可行性。
- 性能 prose 只重复“公平轮转、最低份额、WDRR、持久 cursor”（L12889、L13162附近），没有算法状态或转移合同。
- `HostWorkerProfileIncludesPublisherFairnessCaps` 的 TypeScript 断言遗漏 `minimumHealthyPublisherDispatchSharePermille` 本身，只检查其他字段存在（L14409–L14426）。
- Phase 8 TCK只要求两个持续负载 publisher，再加重启/ID轮换/并发 admission（L15715）；没有 1–4 active publisher、不同 job cost、active-set churn、短窗饥饿和 deficit overflow 的 oracle。

最短反例：

实现把 share解释为“daemon 生命周期内累计 dispatch 次数”，并把每个 job cost都当 1。Publisher A 先跑 10,000 个廉价 job，B 此后持续排队；调度器可以让 B 长时间无一次 dispatch，仍声称最终累计 share会收敛。另一实现按 CPU-ms计费会给出完全不同顺序；两者都能填写同一 profile digest并通过“两 publisher最终无饥饿”的宽松测试。

为何现有门挡不住：

- 字段存在性不是调度语义；`weighted-deficit-round-robin-v1` 没有版本化算法状态。
- “无饥饿”没有最大等待/最大 dispatch lag，测试可等待任意久后宣告成功。
- 断言未锁定最小 share字段，schema删掉该字段仍可能通过所列语义门。

根因级最小修法：

定义 `PublisherFairSchedulingProfileV1` 与持久 scheduler cursor：eligible/healthy predicate、最大受保证 active set、权重、quantum、job cost单位、share窗口、最大 dispatch/time lag、deficit/debt bounds、idle/new publisher、active-set churn、restart、ID rotation和确定性 tie-break。若 250 permille只对最多4个active publisher成立，应显式写入可行性和第5个 publisher 的 admission/backoff规则。ContractAssert锁全字段；TCK覆盖 N=1..4、N=5 overload、大小 job混排、churn、restart、deficit边界与最大等待上界。

## 4. 覆盖矩阵

| 必审面 | 核对位置 | 结论 |
|---|---|---|
| receipt DAG、writer epoch、revision、CAS、anchor、TUF | L4027–L4117、L4158–L4180、L13058–L13062、L15699–L15701 | DAG/TUF/writer fence主结构有明确方向和门；lease→intent恢复断路见 A-01，remote anchor不可遍历/不可持续见 A-02。 |
| TypeScript真实可构造性、`Extract/never` | L12017–L12291、L14338–L14426、L16355 | OAuth、fallback、restart、Execution局部正反例可构造；缺失 constituent见 A-01，cross-plane漏约束见 B-02，公平断言漏字段见 B-03。 |
| local-control 与 send/effect 顺序 | L13059、L13061–L13069、L15696、L15711–L15712 | proposal→disclosure→decision→consumption和effect commit链有覆盖；send/start lease后 intent前不能收口见 A-01。 |
| workload metadata / IMDSv2 | L447–L980、L13304–L13567、L15714 | credential/no-credential与IMDSv2两步顺序基本闭合；logical zero-step、hard-stop和metadata intent gap见 A-01。 |
| OAuth access-only、device pending、refresh、API-key intent | L1546–L1819、L1880–L2009、L2462–L3072、L12078–L12131、L15697 | 未发现独立 A/B；这些分支反而提供了正确 no-intent/unknown范式。 |
| fresh witness 共享预算 | L3380–L3912、L12135–L12168、L14441–L14443、L15717 | registration/status共享 cap/bytes/time cursor已表达；registration/query终态缺口见 A-01，enroll后持续阈值锚缺失见 A-02。 |
| persistent budget correction escrow | L4668–L5195、L12172–L12198、L13068、L15704 | escrow安全不释放成立；调和 deadline后无法持久收口见 B-01。 |
| fallback inner→outer | L9045–L9323、L12198–L12218、L13063、L15219–L15221、L15702 | inner terminal、outer advance predicate、总预算与 unknown保留已形成一致链；未发现独立 A/B。 |
| staged→restart→loaded generation→live | L5377–L5597、L12223–L12240、L15212–L15218、L15703 | restart barrier、loaded snapshot/distribution/process/config generation与失败不可进live均有类型和门；未发现独立 A/B。 |
| Execution local effect/manual committed/turn reconciliation/remote closed | L9746–L10844、L11046–L11879、L12245–L12288、L15342–L15357、L15711–L15712 | local committed/not-committed、manual committed→record-result、still-unknown不闭session、remote closed不回ready均有窄化分支；start/request/tool intent gap见 A-01。 |
| conformance semantic subject | L8790–L8846、L12930–L13043、L14338–L14364、L15767–L15777 | reportKind分支存在，但 protocol plane/ID/implementation payload无法机械相关，见 B-02。 |
| GA maturity/readiness/UX | L13580–L14409、L14450–L14451、L14945–L14962、L15520–L15523 | readiness同值映射与UX typed metrics较完整；固定 Claude requirement使合法默认分发不可达，见 A-03。 |
| publisher公平、性能稳定性 | L12878–L12901、L13090–L13168、L14409–L14426、L15476–L15517、L15715 | wire/worker/soak预算广泛；publisher scheduler没有机械语义与有界等待，见 B-03。 |
| Phase 0语义门 | L14969–L15030、L15690–L15724 | 门名齐全但未覆盖 A-01/B-01/B-02/B-03 的精确反例，且无法解决 A-02/A-03 的缺失交付目标。 |

## 5. 唯一 verdict

[fail] FAIL。当前冻结合同仍有 3 个 A 和 3 个 B；它尚不足以作为一次做到位、可实施、可机械验证、长期可扩展、性能稳定且可供顶级开源项目借鉴的 reference architecture。只有上述 A/B 全部进入类型、producer、状态机与对应 Phase/release gate并复审为零后，才满足收口条件。
