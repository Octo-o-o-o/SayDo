# AI 供给普适接入 reference-grade 对抗终审 v14

## 冻结身份与方法

目标文件：[2026-08-23-ai-supply-universal-onboarding-final.fable.md](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md)

身份核验原始结果：

```text
fcde60a8700dbfc14566d7183a30bf14d0310aa070d628173e23177dd1bda1ab
30490 1830991
```

与指定 SHA-256、行数、bytes 三项完全一致，冻结身份通过。

审计边界：

- 只读目标方案、当前 production code、canonical 和必要的一手官方资料。
- 未读取 `prompts/`、`research/codex-findings/`、`history/` 或旧评审。
- 未修改仓库文件。
- 未把“尚未施工”计为缺陷；以下仅记录照方案原样施工后仍不闭合、事实错误、不可构造或无法由机器判定的反例。

实际机械检查：

- `REFERENCE_REQUIREMENT_INPUTS_V3`：73 行、73 个唯一 `requirementKey`、零重复。
- 73 行构成：63 inference、5 execution、4 bridge、1 control plane；37 global、17 China mainland、19 local；40 payg、10 subscription、11 owned capacity、12 externally-metered unknown。
- 抽取全部 11 个 TypeScript block，以 TypeScript 5.9.3、`strict`、`noEmit`、ES2022 编译：`diagnostics=0`，`types=219805`，`instantiations=867615`。
- 向同一内存编译单元注入 mutable receipt、空四槽 tuple、宽化 authority row、错误 OpenAI wire、错误 Azure custody/challenge、跨 run opaque cleanup、thinking→dialog terminal、缺失 Execution closure 等反例后：`probeDiagnostics=0`。
- 反向证明：
  - 诚实的无品牌 receipt candidate 进入唯一 commit 函数得到 `TS2741`。
  - `DeepFrozenCommittedReceiptV1<SupplySolutionReceipt>` 回传给下游 `SupplySolutionReceipt` 得到 `TS2322`，原因是四元素 tuple 被擦成“可能更短”的普通 readonly array。
- 未运行真实供应商付费调用、真实账号资产清理或未来 Phase gate；不以本次只读终审冒充这些 release qualification。

## 结论

`FAIL`。

去重后的阻断项为：

- A：9
- B：4
- C：0

A 项同时覆盖不可构造、secret/费用错误、跨主体换挂、恢复失败和 release gate 自相矛盾。即使所有尚未施工部分严格照方案实现，也不能得到 reference-grade 可发布系统。

## A 发现

### A-01 Receipt 提交、JCS 与 deep-readonly 根合同不可构造且不保证不可变

**目标位置：** `ReceiptRef` 与品牌在 [P:L302](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:302)，`DeepReadonlyV1` 在 [P:L322](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:322)，唯一 commit 函数在 [P:L336](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:336)，四槽 tuple 在 [P:L13570](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:13570)，canonical pointer/JCS 规则在 [P:L21038](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:21038)，Phase 0 readonly 门在 [P:L28857](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28857)。当前 canonical 只给出通用 `digest=sha256(JCS)`：[09:L8](docs/09-data-contracts.md:8)。

**最小反例：**

- `candidate: DeepReadonlyV1<R>` 已要求 `[committedReceiptBrand]`，诚实的未提交对象无法调用唯一 commit 函数，实测 `TS2741`。
- `DeepReadonlyV1<SupplySolutionSlotTuple>` 接受 `[]`，因为 array 分支擦除了 tuple 长度；冻结后的 solution 因此不能赋回下游合同，实测 `TS2322`。
- `LeaseAuthorityInventoryReceipt.authorityEntryCount = 0` 和嵌套 `authorityId = "forged"` 在 strict 编译下均无诊断。
- 根 receipt 的 JCS 输入域没有明确列出 digest、sequence、品牌和 producer subject 的包含/排除规则；两个独立实现可以产生不同 digest，而都声称遵循“对 JSON 做 JCS”。

**根因级修复：** 分离无品牌、无 digest/sequence 的 `ReceiptCandidate<K,S,P>` 与 `CommittedReceiptRef`；commit 私有 producer 才创建品牌。tuple 使用按 `keyof T` 映射、保留精确长度的 deep-readonly。所有 receipt declaration 自身递归 readonly。为根 receipt 发布版本化 canonical serialization schema，明确 digest 排除项、producer/subject 域和嵌套六字段 pointer。

**机器验收：** 未品牌 candidate 正向可提交，预品牌对象和结构 JSON 拒绝；0/3/5 槽 tuple 编译及 schema 均拒绝；冻结结果仍可赋给准确下游 receipt；全合同 Compiler API mutable-property census 为零；跨 TypeScript/Rust/Python 的 RFC 8785 固定向量 digest 完全相同；alias mutation、反序列化漂移和 digest 自指 mutation 均失败。

### A-02 Authority registry 派生器把逐 row 的 lease/cursor/action/terminal 全部擦宽

**目标位置：** 泛型 row 在 [P:L582](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:582)，deriver 返回值在 [P:L1036](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1036)，投影类型在 [P:L1054](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1054)，after-intent/restart 链在 [P:L1121](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1121)，对应机器门在 [P:L29658](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:29658)。

**最小反例：** 对 `(typeof AUTHORITY_LEASE_REGISTRY_V3)[number]` 做精确类型断言，实测以下四项全部成立且零诊断：

- `RegistryLeaseOf<Row> = AuthorityInventoryBearingLease`
- `RegistryInFlightCursorOf<Row> = ReceiptRef`
- action = 通用 registry wrapper
- terminal = 通用 registry wrapper

因此 row A 的普通 `ReceiptRef` cursor、row B 的 lease/terminal 可以占据 row A 的位置；运行时字符串 `sourceTypeName` 无法恢复已经丢失的编译期关系。

**根因级修复：** 由 codegen 生成显式 `as const` typed registry tuple/map，每个 constituent 固定为 `AuthorityLeaseRegistryEntryV3<ExactLease,ExactCursor,ExactTerminal,ExactAction,ExactDomainTerminal>`。AST census 只对生成表做 exact-set 对账，不负责“运行时生成类型”。

**机器验收：** 对每个 registry row 断言五个投影均不等于宽泛基类；普通 `ReceiptRef`、跨 row lease/cursor/action/terminal 均编译失败；生成表与 AST census 集合完全相等；每个 row 的 before-intent、after-intent 和 restart 正例均可构造，漏 row 或跨主体 mutation 非零。

### A-03 Provider 测试账号 lease 绕过 authority census，cleanup 失败后没有可恢复状态

**目标位置：** census 只认 `` `${string}LeaseReceipt` ``：[P:L620](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:620)、[P:L785](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:785)；账号 lease 在 [P:L22436](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:22436)；cleanup 在 [P:L22476](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:22476)；live terminal/cycle 在 [P:L22561](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:22561)。

**最小反例：** `ProviderTestAccountAssetLeaseReceiptV5` 只是普通 `ReceiptRef`，名称又以 `LeaseReceiptV5` 结尾，既不结构继承 `AuthorityInventoryBearingLease`，也不匹配 census 后缀。worker 创建远端资源后崩溃，重启时删除 API 返回 500，真实残留为 1；但 cleanup 只能填写三个 literal `0`，没有 `cleanup_pending` 或 retry cursor。进一步实测，同一个 `ImportedOpaqueEvidenceLeafReceipt` 可同时冒充五类 cleanup 证据，`terminalRunId="unrelated-run"` 仍能生成 `resultingAssetState:"available"`，strict 编译零诊断。

**根因级修复：** 账号 lease 必须成为具名 authority-bearing lease，登记资源、预算、credential、broker 和排他 cursor authority；census 不依赖未版本化后缀。资产生命周期改为 durable CAS：`available → leased → cleanup_pending → available|quarantined|retired`。cleanup 使用 success/pending/quarantined 判别联合，保存真实或 unknown 残留及逐类 typed evidence，失败时禁止释放和再租。

**机器验收：** 在 lease、每次 provider effect、credential/session revoke、usage reconciliation、baseline reset 前后逐点 kill；重启后只能恢复到成功 cleanup 或 typed quarantine。漏 registry、旧 run/旧 lease 换挂、同一 opaque leaf 复用、非零残留伪写 0、quarantine 资产再租均非零。

### A-04 73 行 fixed requirements 没有 exact wire/auth 闭包，可把 secret 发往任意端点

**目标位置：** custody/wire/challenge 基类在 [P:L24503](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24503)，Azure 特判在 [P:L24660](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24660)，wire profile 在 [P:L24816](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24816)，默认回退在 [P:L24963](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24963)，row deriver 在 [P:L25600](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:25600)，静态断言在 [P:L26104](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:26104)，TCK 承诺在 [P:L29667](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:29667)。

**最小反例：**

- `openai.responses.key` 使用 `endpointOrigin="https://attacker.invalid"`、`operationPath="/charge-and-fail"` 可通过 strict 编译。
- `azure.managed-identity` 使用 `custody.kind="manual_secret_broker"`、`challenge.kind="none"` 也可通过。
- profile 没有 HTTP method、model 放置规则或完整 public constant header 集；Anthropic 必需的 `anthropic-version` 只存在于 prose，未进入 fixed-row literal truth。

只有 TokenHub、BigModel、Kimi 得到 literal wire 分支，其余 fixed row 落到全 `string` profile。官方事实明确区分 OpenAI Chat/Responses 路径、Anthropic `POST /v1/messages` 与认证头、Gemini GenAI endpoint/`x-goog-api-key`，以及 Azure resource base/auth scope：[OpenAI Chat](https://developers.openai.com/api/reference/cli/resources/chat/subresources/completions)、[OpenAI Responses](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)、[Claude API](https://platform.claude.com/docs/en/api/overview)、[Claude Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)、[Gemini API](https://ai.google.dev/api)、[Azure Entra 配置](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/configure-entra-id)。

**根因级修复：** 每个非 custom fixed row 携带 closed `wireProfileId` 和 `authProfileId`，映射到独立签名的 literal oracle：method、origin/template、relative path、model 位置、models path、public headers、custody、wire、challenge、principal/key namespace、token resource。只有 custom Base URL 保留受限参数化。

**机器验收：** 用与 SUT deriver 不同源的签名 oracle，对全部 73 行逐字段 mutation；错 origin/path/method/header/custody/challenge/audience/key namespace 必须在 secret read 和首字节前失败。OpenAI Chat/Responses、Anthropic、Gemini、Azure 四 auth、BigModel、Kimi、TokenHub均有准确正例；custom 单独验证 `api_root/version_root` 和编码边界。

### A-05 TokenHub funding 既可跨模型换挂，也无法表达免费额度且未开后付费

**目标位置：** `TokenHubFundingObservationReceiptV5` 在 [P:L24836](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24836)，默认及可选模式在 [P:L24901](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24901)，Phase 3 要求在 [P:L29105](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:29105)。

**最小反例：**

- 类型没有 exact model/service、plan/order、region、operation、overage/hard-cap subject；`planEntitlement` 只是裸 `ReceiptRef`。模型 A 的套餐观察可换挂到模型 B。
- 类型名只出现在定义和 Phase prose 中，没有 constructor、dependent closure 或 TypeScript consumer。
- 官方当前状态允许 `ChargeType=FREE`、`PaymentEnabled=false`，表示只使用免费额度；方案联合只有 payg、Token Plan、TPM、模型单元。该用户只能被伪报为 payg，或被要求开启付费后才能使用。腾讯云还明确说明免费额度耗尽且未开启后付费时服务停止，以及免费、节省计划、按量的扣减顺序。[TokenHub 数据结构](https://cloud.tencent.com/document/product/1823/132279)、[在线推理计费状态](https://cloud.tencent.com/document/product/1823/130087)、[节省计划规则](https://cloud.tencent.com/document/product/1823/136473)。

**根因级修复：** 定义 exact `TokenHubFundingSubject`，包含 site、principal/cloud account、key namespace/version、model/service、plan/order/region、operation、`PaymentEnabled`、free quota/expiry、抵扣顺序、overage 和 hard cap。建立 `free_only | free_then_payg | plan_then_payg | reserved | dedicated` 严格分支，并由私有 producer 生成依赖准确 `FundingPolicyTemplate` 的 closure。

**机器验收：** free-only、free+payg、节省计划、TPM、模型单元分别有正例；site/principal/key/model/plan/order/region/operation 任一换挂均失败；免费耗尽且付费关闭必须变为 stopped/action-required，零付费 send；套餐名、余额或 API 技术成功不能生成 subscription/no-new-spend。

### A-06 当前 CC Switch Desktop 没有可用的公开 route freeze 接口，固定 GA row 因而不可构造

**目标位置：** fixed row 在 [P:L25683](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:25683)，桌面版限制和 route freeze 要求在 [P:L28351](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28351)，不可替换的 mandatory baseline 在 [P:L28811](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28811) 与 [P:L28825](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28825)。

**最小反例：** 当前一手公开资料把 active provider、failover queue、circuit breaker 暴露为 GUI 状态；前端所谓 API 是 Tauri `invoke` 的进程内 UI IPC，而不是对外稳定接口。[Proxy Service](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/4-proxy/4.1-service.md)、[Failover](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/4-proxy/4.3-failover.md)、[proxy.ts](https://github.com/farion1231/cc-switch/blob/main/src/lib/api/proxy.ts)。

配置两个 provider 并开启 auto failover 后，SayDo 只能看到 loopback proxy；方案又禁止读私有 Tauri DB。它无法在请求前公开枚举并冻结 queue/config generation，也无法证明调用中的 effective route。按 [P:L28358](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28358) 只能降为 inventory；但 mandatory row 不允许替换，故 reference-grade/GA 永远不可发布。

**根因级修复：** 二选一：发布新 reference profile ID，在 CC Switch 提供稳定公开接口前取消其固定 minimum；或钉住具备外部 route snapshot/pin/CAS、完整 failover provenance 和版本承诺的官方版本。不得把私有 DB、UI automation 或响应后 route 猜测当接口。

**机器验收：** 仅通过公开接口完成 queue 全量枚举、generation snapshot、route pin/CAS 和逐请求 provenance；在 preflight 后修改 active provider、重排 queue、触发 circuit breaker、重启桌面进程的 mutation 中，调用必须在首字节前停止或继续命中已冻结集合。

### A-07 JSON→SQLite 迁移器无法接收当前生产真实存在的 v1 ownership 记录

**生产事实：** 当前记录仅有 `pid/kind/binary/processStart/ownerPid/ownerInstanceId` 和可选 token/job：[runtimeChildRegistry.ts:L17](packages/daemon/src/runtimeChildRegistry.ts:17)。写入的 `binary` 是 wrapper 的 `process.execPath`，没有目标 argv/spawn intent：[runtimeChildRegistry.ts:L335](packages/daemon/src/runtimeChildRegistry.ts:335)、[runtimeChildRegistry.ts:L458](packages/daemon/src/runtimeChildRegistry.ts:458)。

**目标位置：** v5 identity 在 [P:L21066](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:21066)，legacy projection 在 [P:L21081](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:21081)，conflict 分支在 [P:L21107](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:21107)，成功 receipt 固定零冲突在 [P:L21117](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:21117)。

**最小反例：** 升级时存在一个由当前代码生成且仍存活的 child。`operationId`、writer epoch、containment identity、binary artifact identity 和 spawn intent 从未落盘；但 `legacy_json_v1` projection 和 `conflict_quarantined` 都预先要求完整 v5 identity。实现只能伪造字段，或在形成 typed quarantine 前停死。

**根因级修复：** 迁移输入必须包含原始 `LegacyRuntimeChildOwnershipRecordV1`，输出为 `lifted | unliftable_quarantined`；unliftable 分支不得要求 v5 identity，也不得授予 signal/delete/spawn authority。双存储过程增加 prepare journal、逐 store commit 状态和 `sqlite_only_repair_required | legacy_ahead_repair_required | true_conflict`；成功与 blocked reconciliation receipt 分离。

**机器验收：** 直接消费当前代码产生的 pending/established、token/job 可选组合；在 JSON temp/rename/fsync、SQLite WAL/commit、permit、terminal、release 每个边界 kill。重启后只能精确修复或 typed quarantine，永不编造 identity、误杀 PID、提前 cutover；上一正式版本的真实 downgrade 流程可读。

### A-08 `review_ready` 四槽闭包与固定 `dialog` 正向 terminal 自相矛盾

**目标位置：** 四槽定义在 [P:L13503](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:13503)，供给正向 terminal 固定 `dialog` 在 [P:L26793](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:26793)，逐槽 gate 在 [P:L26882](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:26882)，四元素 qualification tuple 在 [P:L27017](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:27017)。

**最小反例：** 对 ordinal 1 的 thinking gate，实测其 `runGateReport.report.payload.positiveTerminalEvidence.binding.slot` 精确等于 `"dialog"`，类型断言零诊断。若 producer 真执行“nested terminal 与当前槽精确相等”，thinking/cheap/evaluator 永远不可构造；若忽略 nested terminal，则 dialog 的证据可换挂给其他槽。

**根因级修复：** 将 positive terminal、pass payload、run report 和 gate 全链参数化为 `K extends SupplySlotId`，并把 activation manifest/pointer binding 与 `K` 同值绑定；或者定义独立、真正逐槽的 conversation qualification terminal。

**机器验收：** 四个 ordinal 的 nested terminal slot、solution binding、activation binding 和 runtime terminal binding 均编译等于对应槽，四个正例均可构造。任意两槽、pointer、terminal、distribution 或 evaluator proof 换挂必须在类型、Zod、CAS 和 release mutation 四层失败。

### A-09 第三方 Execution policy 到 Activation/session/runtime 的绑定链断裂

**目标位置：** Execution plugin policy 在 [P:L13241](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:13241)，第三方 implementation 在 [P:L13268](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:13268)，Inference 对照闭包在 [P:L13991](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:13991)，session admission 在 [P:L14751](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:14751)，Execution activation 在 [P:L18713](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:18713)。

**最小反例：** implementation A 通过 TUF/TCK，policy 只允许 driver A、sandbox X、只读 filesystem 和零 egress；Activation 保留 implementation A，却独立填入 driver B、sandbox Y 及更宽的 permission/data digest。`executionPolicyBindings` 只是 `ReceiptRef[]`。机械断言确认 Activation 不含 typed policy closure，session admission 不含 runtime closure，strict 编译零诊断。

**根因级修复：** 增加 Execution 版 activation/runtime closure，强绑 implementation core、TUF target、signed manifest、publisher、被打开的 artifact、driver、permission/data/workspace-egress、sandbox、IPC、预算和 generation。Activation 按 bundled/declarative/third-party 判别，第三方 session/start/runtime 必须消费同一 closure。

**机器验收：** 逐对换挂 implementation、policy、publisher、manifest、artifact、driver、sandbox、permission、data 和 generation；保持 adapter digest 不变但扩大 filesystem、egress 或 budget 的 mutation，必须在 spawn/connect 前失败。

## B 发现

### B-01 对外宣称的六个 L0 provider 不在 73 行唯一 SoT 中，GA 可在它们仍为 inventory 时通过

**目标位置：** L0 定义在 [P:L28637](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28637)；xAI、Mistral、Groq、Cerebras、Together、Fireworks 被列为 L0 在 [P:L28699](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28699)；73 行 SoT/机械投影在 [P:L28197](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28197)；Phase 又允许未通过者保持 inventory、不阻塞发布：[P:L29050](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:29050)。

**最小反例：** 发布物完整通过 73 行、matrix 和 mandatory baseline，但没有上述六个 provider 的 row、journey 或 conformance。机器仍可给出 GA/reference-grade，人工表却继续称其为“首发主路径、完整测试矩阵”的 L0。

**根因级修复：** 要么为六个产品增加准确的 product/auth/rights/funding/realm rows，要么明确降为 inventory/L2。所有生态表、支持页和 release note 从唯一 tuple 生成，不再维护手写等级副本。

**机器验收：** 抽取所有人类表格中的 L0 产品，与 literal requirement/owner-addition 集合做 exact bijection；删任一 row、把 required row 降 inventory、或只保留品牌文本均使文档和 release gate 非零。

### B-02 “唯一 typed UI registry”并非 closed registry，且 anchor 自动态仍有主动作

**目标位置：** `SupplyViewStateDefinitionV5` 在 [P:L28506](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28506)，人工状态表在 [P:L28582](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28582)，anchor view 在 [P:L6318](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:6318)，anchor graph automatic validation 在 [P:L24339](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24339)，全局 0/1 主动作规则在 [P:L28205](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:28205)。

**最小反例：**

- `state:"action_required.login"` 可以配 `actionId:"activate-paid-billing"` 和任意 `supply.state.*` key，类型仍通过。
- anchor 进入 `enrolling` 后 graph 正在 automatic validation，但 view 固定给出 `primaryAction:"view_enrollment_progress"`；点击会产生 graph 中不存在的主动作，不点击又证明它只是 secondary control。

**根因级修复：** 建立实际 literal `as const` state registry，由 graph 生成 state、message key、唯一 action 和 DOM/a11y 投影；Supply 与 anchor 使用同一 `automatic | user_required | terminal_start` 联合。`enrolling` 的查看进度降为 details/secondary。

**机器验收：** 穷举所有可达 state，逐项与 graph transition/actionId/ICU/DOM 对账；automatic 恰为 0 primary，user-required/terminal 恰为 1。错 action、错 message key、两主按钮、anchor progress 作为 primary 均非零。

### B-03 `no_account` 注册期和 browser-key exchange 的 MFA 不在 journey graph 中

**目标位置：** MFA variant 只定义在 login：[P:L24077](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24077)；guided-key 的 `no_account` 从 create-account 直接跳 entitlement：[P:L24087](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24087)；browser-key exchange 没有 MFA variant：[P:L24145](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24145)。

**最小反例：** provider 在账号创建后的首次认证或 key exchange 时要求 MFA。用户真实完成了 MFA，但 graph 无对应 nested event；实现若漏记，指标和费用/离返时间错误，若临时补记，事件又不属于签名 graph，run 无法通过。

**根因级修复：** 所有可能完成认证的 external task 都携带 authoritative challenge observation，并有 MFA/no-MFA 分支；或显式拆出注册后认证 step。不能只把 MFA 绑定到名为 `login` 的 step。

**机器验收：** guided-key、OAuth、browser-key 对每种起始账号状态分别跑有/无 MFA fixture；有挑战时恰有一个绑定 parent task nonce 的事件，无挑战为 0，重复、漏记、跨 task nonce 或超过最大次数均失败。

### B-04 可访问性矩阵没有 theme 维度，light 证据可冒充 dark；移动 canonical 又明确无 dark

**目标位置：** snapshot 字段在 [P:L26707](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:26707)，matrix key 在 [P:L26754](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:26754)，Phase 要求 light/dark 与 desktop/mobile 在 [P:L29319](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:29319)。当前 canonical 明定移动端切 dark 仍保持纸色：[11:L55](docs/11-ui-spec.md:55)。

**最小反例：** 只运行 light snapshot，dark 下文字对比度为 2:1。由于 snapshot 和 exact matrix digest 都没有 `colorScheme`，复制 light artifact 即可填满现有键空间。移动端还能把同一纸色截图同时标称 light/dark。

**根因级修复：** 先统一 canonical：若移动端不支持 dark，Phase 明确要求“desktop light/dark + mobile paper”；若支持，则将 `colorScheme:"light"|"dark"` 纳入 snapshot、matrix key、computed-style 与 screenshot identity。

**机器验收：** required matrix 对声明支持 dark 的每个 viewport 都有独立 light/dark cell；删除 dark、复制 light、只改标签不改 artifact、注入 dark-only contrast/focus 回归均使 gate 非零。移动不支持 dark 时，任何 mobile-dark 支持声明反而必须失败。

## C 发现

无独立 C 项。未把单纯的实现复杂度、尚未运行未来 Phase gate、或当前 compile budget 余量较小计为缺陷。

## 主流供给/协议/安全/UX/工程覆盖矩阵

| 覆盖域 | 实际核对范围 | 结论 |
|---|---|---|
| 冻结身份与 73 行 SoT | SHA/lines/bytes；73 key 唯一性；surface/realm/protocol/auth/funding 分布 | 身份通过；发现 B-01 的手写 L0/SoT 分叉 |
| Receipt/producer/JCS/deep-readonly | candidate→commit、品牌、tuple、alias、root JCS、edge pointer | A-01 |
| Authority/cursor/after-intent/restart | registry 泛型投影、跨 row terminal、restart sweep | A-02 |
| Live qualification/account pool/cleanup/reset | asset lease、MFA admission、cleanup、cycle terminal、残留 | A-03 |
| OpenAI Chat/Responses、Anthropic Messages、Gemini、Azure exact wire | origin/path/header、custody、challenge、principal/resource | A-04 |
| BigModel/Kimi/TokenHub wire | BigModel Chat/Messages、Kimi Platform/Code、TokenHub 两 realm 三协议；与当前一手资料核对：[BigModel Chat](https://docs.bigmodel.cn/cn/guide/develop/http/introduction)、[BigModel Messages](https://docs.bigmodel.cn/cn/guide/develop/claude/introduction)、[Kimi Platform](https://platform.kimi.com/docs/api/overview)、[Kimi Code](https://www.kimi.com/code/docs/en/)、[TokenHub API](https://cloud.tencent.com/document/product/1823/130078) | literal wire 本身未发现新的独立错误；统一 exact-row closure 仍受 A-04 阻断 |
| Rights、credential custody、billing/unknown metering | product/key namespace、subscription/payg、custom/official unknown、TokenHub funding overlay | A-04、A-05 |
| TUF/registry/供应链 | root/delegation/rollback、artifact/TCK/provenance、第三方 policy | Execution 绑定断在 A-09；未发现另一独立 TUF 根因 |
| Proxy/network/data/compute/fallback/首字节 | route fence、credential egress、proxy processor、local compute、unknown delivery、fallback fold | 除 A-02/A-04/A-06/A-09 的边界破口外，无新增独立 A/B |
| CLI/API/订阅/本地 runtime | 63 inference、5 execution、4 bridge、1 control；API、订阅、CLI stdio/HTTP、Ollama/LM Studio/oMLX/container runtime | A-06、B-01；未将未施工路径本身计缺陷 |
| Custom Base URL 三协议 | `api_root/version_root`、Chat/Responses/Messages、mTLS、secret header、unknown metering | 方案形状未发现新增独立 A/B；fixed official rows仍受 A-04 影响 |
| 自动发现/主动配置/被动提示/graph UX | automatic 零动作、账户起点、MFA、费用披露、处方与回焦 | B-02、B-03 |
| 可访问性与国际化 | locale、viewport、zoom、input、screen reader、theme | B-04 |
| review-ready 四槽 | solution tuple、activation pointer、chat terminal、journey gate、distribution | A-08 |
| JSON/SQLite migration、三平台 helper/sandbox、remote witness | 当前 v1 registry 与 v5 migration、平台 closure、witness/anchor | A-07；未发现另一独立 sandbox/witness 根因 |
| Connector SDK/第三方 Execution/扩展 | implementation、policy、driver、sandbox、permission、runtime closure | A-09 |
| strict 零 stub、资源预算、fail-fast、Phase 依赖、Definition Complete | 11 blocks strict 编译；`867615 < 900000` instantiation cap；orchestrator/phase gates | 当前抽取编译通过；但通过不消除上述可构造反例 |

## A/B/C 精确计数

| 等级 | 数量 | 编号 |
|---|---:|---|
| A | 9 | A-01 至 A-09 |
| B | 4 | B-01 至 B-04 |
| C | 0 | 无 |
| 总计 | 13 | 已按根因合并去重 |

# FAIL