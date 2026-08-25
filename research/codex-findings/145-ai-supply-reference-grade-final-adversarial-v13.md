# AI 供给普适接入 reference-grade 对抗终审 v13

## 冻结身份

评审目标：[2026-08-23-ai-supply-universal-onboarding-final.fable.md](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md)

```text
$ shasum -a 256 <target>
ae03c940ee211ee816c608cbddcd8536d7dc80a2847e057c2844a611226fe743

$ wc -l -c <target>
28097 1679137

$ git rev-parse HEAD
174ab48895aa1e4a6c6b42b9c74187f20efc3cfd

$ git status --short -- <target>
?? docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

- `[ok]` SHA-256、行数、字节数与冻结值完全一致，无漂移。
- 目标目前未纳入 Git，但本次内容身份由给定 SHA-256 精确冻结，因此不计目标漂移。
- 只读取目标、当前代码/canonical 和一手协议资料；未读取 `prompts/`、`research/codex-findings/`、`history/` 或旧评审，未修改工作区文件。
- 两路互补只读审计已完成。额外 `codex exec` 因只读环境无法初始化 `~/.codex/state_5.sqlite`，以 exit code 1 终止；其输出未作为证据，非配额失败也未回落。

## 结论

`FAIL`。

冻结身份通过，但目标存在 9 个 A 级和 4 个 B 级根因。主要阻断点不是“方案还没实施”，而是按方案实施后仍可能：

- 构造出 rights/funding/credential/TUF 非法闭包；
- 用错误 wire auth 发送 credential；
- 让失败的 phase gate 被后续成功命令覆盖；
- 无法交付 GA 强制依赖的远程 witness 和三平台原生 sandbox；
- 无法重复执行规定的真实账号矩阵。

合同规模本身尚未表现为编译性能故障：9 个 TypeScript fence 合计约 25,425 行、1,404 个顶层声明，约为当前 `packages/contracts/src` 3,622 行的 7 倍；TypeScript 5.9.3 strict 检查约 1.9 秒。不可维护根因是合同未闭合、语义边仍是裸 `ReceiptRef`/字符串，以及缺少单一生成源，而不是单纯行数。

本审计没有把当前实现尚未完成未来 Phase 视作缺陷。例如当前 `openaiCompat.ts` 固定 Chat/Bearer、`setupApi.ts` 对未知 endpoint 回落 `OPENROUTER_API_KEY`，目标已明确安排迁移；只有迁移计划自身不能闭合或不能验收时才计入发现。

## A 级

### A-01 TypeScript 合同不是可独立构造的闭包

- 锚点：目标 §4.10.2 L19143-L19209、§4.11 L19389-L19405、§4.12 L19544-L19575、Phase 0 strict compile gate L26598。
- 最小反例：把全部 9 个 TypeScript fence 保留行号组成虚拟 source，用仓库 TypeScript 5.9.3 和 `tsconfig.base.json` 检查，得到 25 个 TS2304、22 个未解析标识符，包括 `InferenceRequestIR`、`InferenceEventIR`、`ProtocolTarget`、`WireRequestPlan`、`CompiledBinding`、`CompiledPolicyProgram`、`ConnectorExtensionCapability` 等。排除目标后的当前代码与 canonical 中同样不存在这些定义。
- 根因级修复：先建立实际模块边界和完整 import/definition closure；IR、adapter、compiler、extension manifest 应由一个版本化 IDL/生成器产出，禁止用 ambient `any` stub 让门禁变绿。
- 机器验收：所有 fence 按最终模块布局以仓库 exact tsconfig 得到零 diagnostics；打包后的 contracts/SDK 在仓外 fresh ESM consumer 编译；删除任一必需声明或 import 的 mutation 必须非零。

### A-02 “immutable receipt envelope”在类型层可直接篡改

- 锚点：`ReceiptRef`，目标 L300-L319。
- 最小反例：

```ts
declare let receipt: ReceiptRef;
receipt.digest = "tampered";
receipt.generation++;
receipt.committedSequence = 0;
receipt.dependencyDomainDigest = "other";
```

在既有 25 个基线诊断上没有产生任何新增诊断。只有 brand payload 被标为 `readonly`，身份、generation、digest 和 sequence 均可写。

- 根因级修复：所有 envelope 身份字段和嵌套 canonical subject 必须 deep-readonly；唯一私有 constructor 在 JCS 校验后返回冻结且无可写别名的对象，持久化层只接受重新验证后的值。
- 机器验收：上述每个赋值都必须触发 `@ts-expect-error`；运行时 `Object.isFrozen`、alias mutation、序列化后篡改、digest mismatch 均被拒；同一 receipt 在 Map/CAS/lease 生命周期中 digest 始终不变。

### A-03 rights 与 credential 首字节保护边没有强类型闭包

- 锚点：`OfficialEnterpriseUnknownMeteringRightsReceipt` L4368-L4385、`CandidateRightsGrantReceipt` L10268-L10280、`RuntimeRightsGrantReceipt` L10297-L10310、`CredentialComponentBinding` L12334-L12350。
- 最小反例：
  - `OfficialEnterpriseUnknownMeteringRightsReceipt.productEligibility` 接受完整 `ProductEligibilityReceipt`，所以 `status:"forbidden"` 分支在类型上可赋值。
  - `credentialExposureDecision`、`credentialEgressDecision`、`brokerAcl` 都是裸 `ReceiptRef`；`TufTargetAuthorizationReceipt` 可被放入 credential egress 位置，编译诊断数不变。
  - candidate/runtime rights grant 只保存任意 `rightsEvidenceDigest`，没有携带并绑定当前 principal、product、surface、operation 的 typed rights receipt。
- 根因级修复：引入封闭的 `AllowedRightsReceipt<Subject,Product,Surface,Operation>`；official unknown 分支只能接受 `Extract<ProductEligibilityReceipt,{status:"eligible"}>`；grant、egress、ACL 和 route 通过 generics/品牌类型逐值绑定，禁止裸 `ReceiptRef`。
- 机器验收：forbidden/unknown eligibility、过期条款、跨 principal/product/surface/operation、TUF-as-egress、ACL/route 换挂均在 TypeScript、strict schema 和 producer verifier 三层失败；失败路径的 broker secret-read 和网络 packet 均为零。

### A-04 funding 类型允许把 unknown metering 洗成 priced/no-new-spend

- 锚点：`OperationBillingClosureReceipt` L11213-L11230、`ExternallyMeteredOperationClosureReceipt` L11232-L11260、`FundingPolicyTemplateBase`/`FundingPolicyTemplateReceipt` L11695-L11728、`NoNewSpendProofReceipt` L11813-L11833。
- 最小反例：
  - priced 分支继承 `operationBillingClosures: NonEmptyReadonly<ReceiptRef>`，因此一个 `ExternallyMeteredOperationClosureReceipt` 可作为 priced closure 成员，编译诊断数不变。
  - `subscriptionEntitlement` 和 `overageDisabledProof` 也是裸 `ReceiptRef`，任意 receipt 可充当无新增费用证明。
- 根因级修复：funding template、closure、binding、operation、effective route、principal 和 biller/account 必须共享同一组类型参数；订阅 entitlement、overage hard cap、owned-capacity lease 使用专门 receipt，不接受通用引用。
- 机器验收：unknown closure 放入 priced、随机 receipt 充当 subscription proof、local lease A 证明 cloud route B、LM Studio/Ollama loopback 包装远程上游、fallback 换 funding subject 等 mutation 必须在推荐、broker-read 和首字节前失败。

### A-05 TUF 的 repository/role 隔离和 root rotation producer 不闭合

- 锚点：`TufRepositoryIdentityReceipt` L6151-L6156、`TufTargetAuthorizationReceipt` L6277-L6325、`verifyAndCommitTufTargetAuthorizationV2` L6327-L6338、`SecurityPolicyAuthorityBinding` L6340-L6344。
- 最小反例：
  - repository identity 没有 `catalog|policy` 判别；`SecurityPolicyAuthorityBinding` 擦除了 repository 与 delegated role，catalog target 可结构性换挂为 policy authority。
  - rotated-root 输出要求 `orderedRotationSteps`，但 producer 输入没有 root rotation evidence；实现只能读取未声明的隐藏状态或无法构造该分支。
- 根因级修复：将 repository kind、expected role、target namespace 编入泛型和品牌；policy binding 只接受 `TufTargetAuthorizationReceipt<PolicyRepo,PolicyRole>`；producer 显式接收连续 raw root rotation chain、可信时间和 high-water CAS 输入。
- 机器验收：catalog→policy、role/path swap、跳版本 root、过期 timestamp、旧 high-watermark、混合 repository、错误时钟全部失败；合法双 root 离线 replay 能从完整显式输入确定性重建。

### A-06 auth 把 wire header、credential custody 和 optional challenge 压成一个字段，63 行中已有错误事实

- 锚点：`ApplicationAuth` L243-L289；63 行矩阵 L23759-L23815，特别是 `google.genai.key`、`azure.key`、`bigmodel.messages`、LM Studio、OpenCode HTTP、LiteLLM。
- 最小反例：
  - Google row 写 `bearer`，但 Gemini API 要求 `x-goog-api-key`。[Google Gemini API](https://ai.google.dev/api)
  - Azure key row 写 `x_api_key`，而 Azure API key 使用 `api-key`；Entra 才使用 `Authorization: Bearer`。[Azure Responses 文档](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses)
  - `bigmodel.messages` 写 `bearer`，智谱 Anthropic-compatible endpoint 使用 `x-api-key`。[智谱 Claude API 兼容文档](https://docs.bigmodel.cn/cn/guide/develop/claude/introduction)
  - OpenCode Server 可选 HTTP Basic，但 row 只有 `upstream_managed_credential`；当前联合无法同时表达“上游托管”和“本 hop Basic”。[OpenCode Server](https://dev.opencode.ai/docs/server/)
  - LM Studio 三行均为 `none`，无法表示启用 token 后必须使用 Bearer 的分支。[LM Studio authentication](https://lmstudio.ai/docs/developer/core/authentication)
- 根因级修复：拆分 `CredentialCustody`、`WireAuthScheme` 和 `ChallengeMode`；wire profile 固定准确 header 名、编码、hop、recipient，optional auth 使用 `none|basic|bearer` 判别联合，矩阵引用 profile ID 而非粗粒度 `authKind`。
- 机器验收：逐产品 raw HTTP fixture 检查准确 header 且错误 header 为零；LM Studio/OpenCode/LiteLLM 的有密钥与无密钥分支均独立运行；任意未经绑定的 credential 在 secret broker 读取前失败。

### A-07 Phase/发布门没有统一 fail-fast 聚合器，可被尾部成功覆盖

- 锚点：9 个多命令 `sh` block：L26627-L26629、L26692-L26696、L26746-L26750、L26847-L26851、L26915-L26917、L26990-L26995、L27044-L27047、L27083-L27086、L27352-L27356。
- 最小反例：9 个 block 均没有 `set -e` 或 `&&`。受控执行 `false` 后接 `true` 的同形 shell block，最终 exit code 为 0。Phase 0 描述的专用 Node orchestrator只覆盖 Phase 0，不能保护其余阶段和共同门禁。
- 根因级修复：每个 Phase 和最终 release 只暴露一个受测 orchestrator，或由 CI 将每个子门定义为独立 required job；release verifier消费结构化逐步结果，不读取 block 最终 exit code。
- 机器验收：注入“第一项失败、最后一项成功”，总门必须非零且后继不执行；删除任一 required job、伪造空报告、只运行最后一项均阻断 release。

### A-08 GA 强制依赖的远程 witness 与三平台 sandbox 没有交付工作流

- 锚点：remote witness release profile L4896-L4930、service profile L4946-L4978、三平台 sandbox §4.13 L19606-L19613、固定 `anchor.witness` row L23816、Phase 5 L26937-L26954、预期代码结构 L27148-L27223。
- 最小反例：
  - remote profile 强制要求 coordinator/member service、entrypoint、IaC、append-only store、monitor、runbook、SBOM 和生产 qualification；预期代码结构和各 Phase 没有对应服务、部署或运营边界。
  - macOS App Sandbox/XPC、Linux namespaces/seccomp/Landlock/cgroup、Windows AppContainer/restricted token/Job Object 被设为 Execution 启用条件，但没有 native helper、签名/entitlement、安装器或 kernel prerequisite 交付路径。当前 `packages/`、`scripts/` 中也没有对应 native source 或 witness service。
  - 即使完整实现列出的目录，Phase 8 仍无法产出这些强制 artifact digest；回落同 UID child 又按目标自身规则只能 inventory。
- 根因级修复：增加明确的 platform-security 和 witness-service 产品阶段，列出 repo/package、owner、构建签名、安装升级、IaC、region/operator、密钥仪式、成本与 rollback；不能仅在 Phase 8 临时“验证”尚无施工来源的产物。
- 机器验收：最终安装包在三平台运行真实 Agent turn，并证明正常 turn/Gate-approved tool 可用而直接 `open/connect/exec/credential-store/foreign-IPC` canary 全拒；witness 从本次 artifact 部署，完成多 member、双 observer、七类 fault 和至少 24 小时生产 replay。

### A-09 GA 真实账号矩阵没有可重放的账号资产生命周期

- 锚点：`JOURNEY_GRAPH_GUIDED_KEY_V3` L22868-L22896、完整 run derivation L26034、UX 表 L27282-L27283、release qualification L27137-L27138。
- 最小反例：29 条 `RECIPE_GUIDED_KEY_V1` requirement 都是 `all_desktop`。只计算 `no_account × 3 OS × 2真实locale × 2 anchor起点`，已经至少 348 次创建新账号的 live run，尚未计 `en-XA`。第一次运行后账号不再是 `no_account`；目标没有 account pool、资产租约、provision/reset/cleanup、MFA/手机号、预算或删除终态，只写了“预配置测试账号”。
- 根因级修复：把确定性的 graph/UI/locale/platform fixture 与有界 live provider qualification 分开；为 live run 定义 account-asset lease、权威起始状态、预算、MFA/manual step、reset/cleanup terminal 和泄漏处置。
- 机器验收：deriver 标出 `fixture|live`；每个 live run 绑定唯一账号租约、起始状态证据、费用 cap、cleanup/reset receipt；连续两次完整 release qualification 能得到相同 coverage，且无残留账号、credential 或付费资产。

## B 级

### B-01 63 行 GA 真相没有覆盖其宣称的完整协议面

- 锚点：矩阵 L23759-L23816；Ollama §6.3 L26172；LiteLLM §9.6 L26494；bridge 替代规则 §9.9 L26560；固定 profile 规则 L26042-L26060。
- 最小反例：
  - OpenAI 只有 `openai.responses.key`，没有 OpenAI Chat row。
  - Ollama 只有 Chat row，但其官方兼容面同时提供 Chat 和 Responses。[Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)
  - LiteLLM 只有 Chat row，但公开 proxy 同时提供 `/responses` 和 `/v1/messages`。[LiteLLM Responses](https://docs.litellm.ai/docs/response_api)、[LiteLLM Messages](https://docs.litellm.ai/docs/anthropic_unified)
  - `cc-switch.control` 是固定 required row；§9.9 又允许由另一具名 bridge 补 category minimum，与“替换固定 row 必须更名 designation”冲突。
- 根因级修复：每个宣称的 protocol/surface 增加独立 requirement、fixture、adapter digest 和 journey；或收窄产品声明。CC Switch replacement 必须成为新 designation/profile，而不是当前 profile 内的隐式替代。
- 机器验收：分别破坏 OpenAI Chat、Ollama Responses、LiteLLM Responses/Messages 时 release 必须红；CC Switch 不可用时只有生成新 designation 的显式替代路径能通过。

### B-02 “扩展只增加最小变化单元”不成立

- 锚点：`ConnectorDefinition` L19143-L19151、Execution protocol union L12695-L12707、implementation receipt L12792-L12817、扩展承诺 §4.11 L19335-L19348。
- 最小反例：
  - `protocolProfiles: readonly string[]` 接受 `["app_server_stdio","not-a-protocol"]` 和跨 plane profile，编译无新增诊断。
  - `Extract<ExecutionProtocolImplementationReceipt,{source:"third_party"}>` 为 `never`；第三方 Execution connector 要么不可构造，要么必须修改 core union。
- 根因级修复：由单一 IDL 生成按 `connectorKind/plane/protocol/source` 判别的定义；增加具名第三方 Execution receipt，绑定 publisher、artifact、sandbox、permission 和 generation，去掉任意字符串协议数组。
- 机器验收：仓外 fresh provider pack 和第三方 Execution driver 可在不修改 daemon/UI/core switch 的情况下打包并通过 TCK；垃圾 protocol、跨 plane、缺 sandbox/publisher/artifact 均在 schema 和 TypeScript 层失败。

### B-03 新 SQLite in-flight registry 与现有文件 child registry 没有迁移/恢复协议

- 锚点：目标 §4.2 L19097-L19117、Phase 1 L26642-L26651；当前 [docs/09-data-contracts.md](docs/09-data-contracts.md:1618)；当前 [runtimeChildRegistry.ts](packages/daemon/src/runtimeChildRegistry.ts:274)；当前 SQLite v31 基线 [ddl.ts](packages/daemon/src/storage/ddl.ts:770)。
- 最小反例：旧实现先写 `$HOME/runtime/children/*.json`，新计划另建 SQLite lease/in-flight SoT。进程在“文件已写、DB 未写”或相反边界崩溃后，新旧版本会对 adopt/kill/hold 得出不同结论；目标没有 correlation key、写入顺序、双读期限或 downgrade 行为。
- 根因级修复：canonical 明确两种介质各自职责和唯一权威源；增加迁移 cursor、共同 child/lease identity、permit barrier、恢复 merge 规则、受控 dual-write 和 downgrade window。
- 机器验收：在每个文件/DB write、fsync、spawn、listener-ready 边界注入 SIGKILL；新版本和上一版本对同一 HOME 恢复后恰有一个 terminal，未知 birth identity 不杀进程，sweep 完成前 admission 保持关闭。

### B-04 UX 标量与 journey graph 自相矛盾

- 锚点：guided-key graph L22868-L22896、机械 UX 规则 L26052、UX 表 L27258/L27283、GA 条目 L27595。
- 最小反例：`no_account + missing billing` 路径需要创建账号、激活 billing、创建 credential、保存字段，共 4 个 SayDo primary actions；机械规则和表允许 4，最终 GA 条目却写“payg 最多三动作”。
- 根因级修复：所有 UX 上限从 versioned graph 和事件 class 自动派生，删除手写的第二份全局数字；如果只想约束某些起始状态，应以判别联合表达。
- 机器验收：穷举每个 account start state 和条件分支，自动计算 scalar/per-class limits；任何文案、profile、row 或 release assertion 与派生值不一致时门禁非零。

## C 级

无独立 C 级发现。可选改进已并入上述根因修复，没有用低严重性条目重复计数。

## 覆盖与反例矩阵

### 具名供给与协议

| 供给 | 独立核对结果 | 判定 |
|---|---|---|
| 智谱 BigModel/Z.AI | 有 Chat、Messages 和 global Z.AI 实质 rows；但 Messages row 使用 Bearer，官方 wire 是 `x-api-key` | `[fail]` A-06 |
| Kimi | 普通 API Chat、Coding Plan Chat/Messages、Server ACP 均有独立 product/funding/state；官方确认 Coding Plan 同时有 OpenAI 与 Anthropic endpoint及真实 User-Agent 要求 | `[ok]`，仍受 A-03/A-04 全局闭包影响。[Kimi Code](https://www.kimi.com/code/docs/en/) |
| OpenCode | Zen/Go 三协议和 Server HTTP/ACP 均有 rows；官方 endpoint/model 映射是实质能力，Server Basic 未被 auth 模型准确表达 | `[fail]` A-06。[OpenCode Go](https://dev.opencode.ai/docs/go/) |
| OpenAI | Responses 有固定 row，Chat 没有 | `[fail]` B-01 |
| Anthropic | Messages 有独立 row 和 `x_api_key` | `[ok]` |
| 通用 CLI | 有 `cli_stdio`、安装/登录/恢复 states，不是只列名字；但正式启用缺三平台 sandbox 交付，第三方 extension 又为 `never` | `[fail]` A-08、B-02 |
| CC Switch | 有独立 bridge-control、route drift/failover 状态，不是 provider 名称占位；官方路由会修改客户端配置并可能 failover，固定 row 与可替代规则冲突 | `[fail]` B-01。[CC Switch routing](https://github.com/farion1231/cc-switch/blob/main/docs/user-manual/en/4-proxy/4.2-routing.md) |
| LiteLLM | 有 bridge row、route/failover/secret states，但只覆盖 Chat，遗漏公开 Responses/Messages | `[fail]` B-01、A-06 |
| Ollama | 有 local/cold/warm/text-only journey，但只覆盖 Chat | `[fail]` B-01 |
| LM Studio | Chat/Responses/Messages 三行齐全，不是名称占位；optional token 没有可执行 auth 分支 | `[fail]` A-06 |
| oMLX | 三协议、macOS arm64、冷/热态均有独立 rows；当前项目代码也确有 Chat、Responses、Messages endpoints | `[ok]`，仍受通用 funding/receipt 闭包影响。[oMLX server](https://github.com/jundot/omlx/blob/main/omlx/server.py) |

### 横向安全与可执行性

| 审计面 | 最小反例或事实 | 归属 |
|---|---|---|
| 当前代码迁移事实 | 当前 fixed Chat/Bearer、未知 endpoint→OpenRouter 属实，但目标已安排移除，不重复计缺陷 | 范围基线 |
| 协议保真/auth | Google、Azure、智谱 header 错；optional Basic/Bearer 与 custody 混在一层 | A-06 |
| rights/credential/data/network | forbidden eligibility 可进入 official receipt；egress/ACL/effective evidence 多处为裸引用 | A-03 |
| funding/unknown metering/隐藏 fallback | unknown closure 可放入 priced；任意 receipt 可冒充 subscription/overage proof | A-04 |
| local/cloud 边界 | loopback/owned-capacity 与远程 effective route 缺同主体强绑定，无法从类型排除本地入口转云 | A-04 |
| lease/crash recovery | 新 SQLite 与旧 child JSON 的双介质 crash window 无 migration cursor | B-03 |
| CLI/Agent 副作用 | Gate/effect 状态描述丰富，但三平台原生拒绝能力没有可交付 backend | A-08 |
| registry/plugin/TUF | TUF repository/role 擦除，rotation producer 输入不全；第三方 Execution 扩展不可构造 | A-05、B-02 |
| TypeScript 构造性 | 25 个 TS2304、22 个核心名字未定义；receipt 可写 | A-01、A-02 |
| 合同规模/维护 | 25,425 TS 行、1,404 顶层声明、约 1.9 秒；性能暂未失控，但没有生成式 SoT，开放与封闭边界同时出错 | A-01、B-02 |
| 63 行 GA 真相 | 总数和唯一 key 可机械得到 63，但协议承诺、固定 row 与替代规则不一致 | B-01 |
| 真实用户 journey | 至少 348 个 no-account live run 无账号资产生命周期；4 动作路径又被写成 3 | A-09、B-04 |
| 三平台性能稳定性 | SLO 数字充分；真正依赖的 native sandbox、witness service 和 24h production source 未排产 | A-08 |
| 迁移与 rollback | legacy active 迁移有总体策略，但 child/lease registry 的跨版本回滚未定义 | B-03 |
| 可执行验收 | 9 个 phase shell block 可吞前项失败；真实账号矩阵不可重复 | A-07、A-09 |
| 首字节安全总判定 | unknown rights、unknown metering、隐藏 fallback、loopback 转云和未授权 credential 均未被现有类型系统证明为不可构造 | A-03、A-04、A-06 |

## A/B/C 计数

| 等级 | 数量 |
|---|---:|
| A | 9 |
| B | 4 |
| C | 0 |

## FAIL