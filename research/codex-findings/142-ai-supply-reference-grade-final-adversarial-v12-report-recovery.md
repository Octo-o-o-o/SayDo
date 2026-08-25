# SayDo AI Supply 参考实现级最终对抗复核 v12

## 输入完整性

| 项目 | 期望值 | 实测值 | 结果 |
|---|---:|---:|---|
| 行数 | 25,018 | 25,018 | [ok] |
| bytes | 1,513,595 | 1,513,595 | [ok] |
| SHA-256 | `7ffadde7837eeab3332431a67437aff2a65595cc1e9cda8c88c69a2e970e8d09` | 相同 | [ok] |

实测命令与原始输出：

```text
$ wc -l -c docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
25018 1513595 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md

$ shasum -a 256 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
7ffadde7837eeab3332431a67437aff2a65595cc1e9cda8c88c69a2e970e8d09  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

已连续读取目标文件第 1–25,018 行，并补读核对所有工具输出边界。未读取仓库中的其他 prompt、findings、history、journal、日志或实现者说明；未修改任何文件。

审计时不把 `proves...: true`、digest、未来命令名或 `exitCode: 0`本身视为实现。只有明确的判别类型、具体 producer、唯一前驱、原始证据和可独立重放的 mutation/verifier 才算机械闭包。

## A 级 findings

### A-01 unknown funding 可藏入自动 funding decision

- 精确位置：`RuntimeSpendAuthorizationReceipt` L7021–7051；`FundingPolicyTemplateReceipt` L10975–11008；`NoNewSpendProofReceipt` L11093–11107；`InferenceFundingDecisionReceipt`、`AutomatedInferenceFundingDecisionReceipt` L11148–11173；`AutomatedFundingPolicyTemplateReceipt` L11187–11190；fallback admission L12295–12329；静态断言 L17175–17189。
- 最小反例：令外层 template `P` 为 priced，内层 template `U` 为 `externally_metered_unknown_custom`。构造 `kind:"no_new_spend"` 的 decision，外层引用 `P`，但 `proof.fundingPolicyTemplate=U`；或构造 `kind:"runtime_authorization"`，令 `authorization.fundingPolicyTemplate=U`。两者仍属于 `AutomatedInferenceFundingDecisionReceipt`，可进入四槽、evaluator、fallback 和自动重试链。
- 根因：自动类型只对最外层 `kind` 做 `Extract`，没有让外层 decision、proof/authorization、slot template共享同一个 dependent template 参数。
- 现有门为何抓不到：L17175–17184 只排除了顶层 unknown `kind`；内层 template 可不同。各处“exact equality”仍是布尔声明，当前 mutation 集也没有 inner-template 注入。
- 根因级修复：将 proof、authorization、decision、slot admission统一参数化为同一 `P extends AutomatedFundingPolicyTemplateReceipt`，并要求引用同一 receipt identity；增加 outer-priced/inner-unknown 的 no-new-spend、runtime-authorization、slot、evaluator、fallback、health mutations。

### A-02 `ProductEligibilityReceipt` 可伪造凭据入口及 custom rights

- 精确位置：`ProductEligibilityReceipt` L3887–3906；`UserAdminAttestedCustomRightsReceipt` L3908–3924；规范意图 L17586。
- 最小反例：构造 `{status:"forbidden", permitsCredentialInput:true}`，不提供 `attestedCustomScope`；或让 custom-rights 的 `productEligibility` 指向另一 endpoint、官方 eligible receipt，乃至任意普通 `ReceiptRef`。
- 根因：`status`、`permitsCredentialInput`、`attestedCustomScope` 是互不依赖字段；custom-rights 又把已定义的 eligibility 类型降宽为裸 `ReceiptRef`。
- 现有门为何抓不到：L17586 只有文字约束；目标内没有对应的判别联合、具体 Zod refinement producer或 mutation。抽象 edge manifest即使限制 target kind，也不能推导 endpoint/product/use/distribution/principal 同值。
- 根因级修复：改为严格四分支联合：`eligible` 和完整 custom-attested 分支才允许 `true`，`unknown|forbidden` 固定为 `false`；custom-rights 必须引用 `Extract<ProductEligibilityReceipt,{status:"user_or_admin_attested_custom"}>`，并用 typed edge绑定全部 subject 字段。

### A-03 authority policy 未按 discriminant 分派，并会重复授予 effect authority

- 精确位置：authority policy L542–602，特别是 L598–600；`ExecutionTurnUnknownReconciliationLeaseReceipt` L14831–14884；`ExecutionToolExternalRequestLeaseReceipt` L15754–15777；read-only/side-effect aliases L15808–15814；`ExecutorCommitLeaseReceipt` L16285–16319。
- 最小反例：
  - read-only GET lease 的 `requestEffect.kind="read_only"`，但顶层 policy L599仍要求 `external_effect`。
  - side-effect request外层 lease和其内嵌 `ExecutorCommitLeaseReceipt`均被授予 `external_effect`。
  - `manual_permanent_block` reconciliation branch明确声称无外部 query/cleanup authority，但 L598仍要求 network、effect和cursor authority。
- 根因：policy key只有声明名，没有 `type + discriminant path/value`；alias-only 分支也没有独立精确 authority inventory。
- 现有门为何抓不到：registry evaluator以同一错误 policy为真相，仍会判定 inventory“完全匹配”。现有 mutation没有 read-only 过授、manual-block 过授或 outer-request/commit 双持 effect。
- 根因级修复：为每个 concrete union constituent按 discriminant注册精确 authority；read-only不得持 effect，manual block只持内部 cursor authority；side effect只能由一个明确的 commit/permit lease持有，authority transfer必须原子关闭前任。

### A-04 exactly-once authority release 与 restart recovery 不是机械双射

- 精确位置：inventory entry L316–323；release L373–383；pre-intent closure L385–398；recovery terminal L618–635；restart sweep L637–648；edge manifest形状 L650–698。
- 最小反例：inventory含 `A,B`，closure提交 `[release(A),release(A)]` 或只提交 `[release(A)]`，同时填写正确 count/digest外观和全部 `proves...:true`。restart recovery还可把 workload lease与OAuth registry entry、任意 predecessor/terminal `ReceiptRef`组合。
- 根因：`authorityEntry`只按 kind 定型，不要求属于该 inventory的具体 tuple元素；release数组没有由 inventory tuple逐项映射；recovery registry entry和cursor没有按 lease kind参数化。
- 现有门为何抓不到：Zod形状只能证明非空；本文只有 `ReceiptEdgeManifestV1`接口，没有具体 edge entries、predicate registry或按 `(lease, authorityId, acquisition token)`执行的唯一 CAS producer。
- 根因级修复：inventory使用具体 tuple泛型；release tuple由 inventory逐项映射；唯一键固定为 `(lease receipt, authorityId, acquisitionCommitToken)`。recovery receipt由 registry discriminant map生成准确 cursor和terminal类型，并增加遗漏、重复、外来 entry、跨 subject/epoch/restart mutations。

### A-05 Execution 在首个 spawn/connect 前没有绑定 exact surface

- 精确位置：surface联合 L12610–12658；准确映射辅助类型 L12743–12781；`ExecutionSessionAdmissionBase` L13273–13312；start lease/intent L13365–13447；准确 surface仅进入成功 terminal L13501–13524；unknown/recovery L13541–13565、L13752–13840。
- 最小反例：admission选择 `{kind:"agent_http",connectionMode:"remote_service"}`，start lease/intent却选择 `startKind:"local_spawn_or_stdio_handshake"`并带本地 binary。该 intent可在成功 terminal形成前触发本地 spawn；若写成 `delivery_unknown`，recovery又可选择另一个独立 `S`。
- 根因：`ExecutionSurfaceExactBindingReceipt<S>`没有从 admission贯穿到首个持权 lease和intent，只在事后成功/recovery输出使用。
- 现有门为何抓不到：成功 terminal的强类型属于副作用后的验证；after-intent失败与unknown分支仍是宽类型。未来 TCK名称不能代替 pre-hook 必须消费的 exact binding。
- 根因级修复：从 admission开始建立 distributive `<S>`联合；lease、intent、全部 terminal、unknown cursor、recovery、peer和sandbox都携带同一 `S`。spawn/connect hook必须先消费该绑定，并覆盖七种 surface的完整负笛卡尔积。

### A-06 reconciliation close-ready revision 可跨 session/terminal 换挂

- 精确位置：`ExecutionSessionCursorBase` L13946–13956；`ExecutionSessionReconciledCloseReadyCursorReceipt` L14061–14075；close lease L14090–14098；reconciliation terminal L15033–15095；静态断言 L17309–17335。
- 最小反例：close-ready cursor的 `predecessorCursor`取 session A，`lastReconciliationTerminal`取已解决的 session B，base中的 `sessionLease`取 session C，并自由填写 `expectedRevision/revision`。该对象仍可作为 close lease前驱。
- 根因：close-ready只是宽字段聚合，没有以同一 unknown-turn subject参数化的唯一 transition receipt，也没有类型关系要求 `revision = terminal.resultingSessionCursorRevision`及全部 session/lease/identity相同。
- 现有门为何抓不到：L17309–17335只证明 resolved/cleanup分支“可达”和 close lease“可接受该类型”，没有证明唯一前驱或同 revision。唯一关系仍由 L14075布尔声称。
- 根因级修复：定义 `ExecutionSessionReconciledCloseReadyTransitionReceipt<U>`，由准确 reconciliation terminal原子生成；cursor、terminal、session lease、unknown turn和revision共享 `U`。close lease只能消费该 transition的输出，增加跨 session/surface/revision mutations。

### A-07 manual committed result 可跨 tool/effect/result 换挂

- 精确位置：`ManualReconciliationDecisionBase` L16353–16370；`ManualResultAuthorityReceipt` L16372–16397；`ExecutionResultEvidenceReceipt` L16441–16509；decision L16511–16534；manual transition L16582–16597；final transition L16721–16737；静态断言 L17156–17173。
- 最小反例：unknown cursor属于 tool A；decision使用 tool B并把任意 receipt当 `authoritativeEffectEvidence`；result authority使用 tool C及另一 unknown terminal/result corpus；final transition仍引用 A的cursor并把证明布尔设为真。
- 根因：decision、authority、result、final cursor没有共享同一 unknown-effect subject参数；关键 effect/no-effect/uncertainty字段仍是裸 `ReceiptRef`。
- 现有门为何抓不到：现有断言只区分普通 committed cursor与unknown cursor，没有证明 cursor、tool invocation、effect ordinal、raw occurrence、decision和独立authority同一。
- 根因级修复：引入统一 `U`，参数化 decision、result authority、result evidence及 final transition；独立 evidence leaf的 `subjectDigest`必须由 `U`机械派生，所有 session/request/effect ordinal/commit token/writer epoch走 typed same-value edge。

### A-08 discovery 外层 mode 严格，但 explicit-active 内部可借任意 authority链

- 精确位置：三 mode semantic subject L18341–18408；static/passive evidence L18565–18618；`ExplicitActiveDiscoveryActionAuthorityClosureReceipt` L18620–18634；explicit evidence L18636–18647；core到run映射 L18655–18665。
- 最小反例：core为 `explicit_active`，但 `actionAuthorityClosures`放入 passive transport lease；`actionIntent`使用 passive probe intent，`actionTerminal`使用 passive或另一 subsystem terminal，accepted decision来自另一 action subject。
- 根因：mode discriminant只约束最外层 receipt；内部 closure允许任意 `AuthorityInventoryBearingLease`，intent和terminal均为裸 `ReceiptRef`。
- 现有门为何抓不到：`ConformanceRunEvidenceForCore`只能阻止整份 passive evidence直接换挂，无法检查 explicit容器内部。closure的 exact/closed关系仍是自报布尔。
- 根因级修复：建立 release-bundled explicit-action判别联合，每种 action映射准确 lease、intent、terminal、authority tuple、decision subject和sandbox canary；core冻结准确 action set，并加入 passive/static/cross-action/cross-subject mutations。

### A-09 third-party plugin policy 可在 implementation、Activation和descriptor间换挂

- 精确位置：`ProtocolImplementationReceipt` L11926–11961，特别是 L11944；`InferencePluginPolicyReceipt` L12583–12599；`InferenceActivationManifestBase` L16837–16865，特别是 L16861；SDK descriptor的 `pluginExecution` L17947–17956；规范意图 L17982。
- 最小反例：implementation P1的 `inferencePluginPolicy`引用 P2的宽权限 policy；Activation的 `inferencePluginPolicies`数组仍放 P2；descriptor只抄 P2 policy digest，而实际 adapter artifact为 P1。
- 根因：implementation和Activation把已定义 policy类型降宽为 `ReceiptRef`；descriptor进一步只保留自由 digest；policy自身也没有 typed implementation/TUF/manifest前驱。
- 现有门为何抓不到：L17982的 exact约束只是文字。edge manifest即便限制 target kind，也不能拒绝“同 kind、另一 plugin”的 policy。
- 根因级修复：以 implementation core `P`参数化 implementation、policy、Activation和descriptor；policy直接引用准确 manifest、publisher、artifact、TUF authorization、permission/data/sandbox/IPC/budget receipts；加载前从真实 artifact重建闭包并执行跨 publisher/artifact/policy mutations。

### A-10 TUF delegation、raw metadata与high-watermark可跨 repository换挂

- 精确位置：`TufDelegationStepReceipt` L5525–5536；root与rotation L5538–5562；high-watermark L5564–5583；`TufTargetAuthorizationReceipt` L5585–5628。
- 最小反例：inline delegation steps声称 repository R1的 A→B；`orderedDelegatedMetadataEvidence`使用 R2或另一 role的 opaque leaves；high-watermark cursor再取 R3。三组数组、版本和digest分别填满即可满足结构。
- 根因：delegation step不是独立 receipt且不引用自己的 parent/child原始 metadata；steps和evidence是平行数组；repository/role/version/hash没有作为共享泛型贯穿 root、lineage和high-watermark。
- 现有门为何抓不到：`completeRootToTargetLineage`和 L5627只是布尔。目标没有从原始 metadata bytes生成逐步验签节点、path匹配与高水位commit的唯一 producer。
- 根因级修复：每个 delegation node成为 typed receipt，直接引用 parent/child原始 evidence、keyset、threshold、path/hash-prefix评估和同 repository high-watermark entry；最终 target引用原始target bytes leaf，由独立 TUF client从原始材料重放。

### A-11 remote witness的24小时 qualification可即时伪造或跨 deployment复用

- 精确位置：probe run L4118–4172；member window、threshold、fault receipts L4174–4256；qualification L4258–4305；operational release/service L4307–4366。
- 最小反例：立即填写相差24小时的开始/结束字符串，复制288个“成功”run结构；raw capture、observer/member signature、proof和corpus只填任意 digest；设置 replay exit code为0及全部证明布尔。也可让 service threshold set A引用基于 threshold set B的 operational release。
- 根因：关键原始请求/响应、签名、checkpoint proof、受信时间和独立observer身份都没有 typed evidence leaf；service、release、qualification和threshold set没有 dependent binding。
- 现有门为何抓不到：未来测试命令和 `deterministicReplayExitCode:0`不能证明真实经过24小时或原始签名存在。若实现仅消费这些字段，伪造对象会通过。
- 根因级修复：每个 run引用不可变 raw capture、observer signed statement、member signed statement、inclusion/consistency proof和可信时间链；qualification由独立 replay producer生成并绑定完整 raw corpus、deployment和threshold set。

### A-12 `failed/cancelled/rejected` UX终态可冒充 `completed_pass`

- 精确位置：`GaUxActionEventV3` L19926–19974，特别是 L19938、L19958、L19960；reducer L19976–20003；pass payload L22364–22439；V3 mutation集 L22001–22022。
- 最小反例：记录完整动作，但将 `run_terminal`设为 `cancelled`，必要登录 task设为 `failed`，或管理员等待设为 `rejected`；配对、计数和时间仍合法，再令外层 `outcome:"completed_pass"`。
- 根因：reducer只产生计数与时长，没有产生由 terminal polarity和graph transition fold得出的成功状态；外层 outcome与事件终态独立。
- 现有门为何抓不到：L19991–20002只要求终态存在和成对，没有要求 pass时 run/task/admin终态分别为 completed/completed/approved。V3 mutation没有失败、取消、拒绝注入。
- 根因级修复：reducer输出严格判别的 `GaJourneyFoldResult`；successor只能消费前驱 success。失败、取消、拒绝只能形成 fail/incomplete payload，并补三类逐层 mutations。

### A-13 GA pass未绑定 live conformance、Activation或active pointer

- 精确位置：`ReferenceJourneyGraphV3`终态固定为 `ready_for_live_conformance`，L20847–20863；主要图终止于 staged/peer validation，L20900–21056；recipe虽列有 live与projection，L21179–21186；producer兼容检查 L21814–21850；run/pass payload L22215–22439。
- 最小反例：`openai.responses.key`只走到账户路径和 `staged_conformance`节点，然后直接填写 `finalConnectionReadiness:"connected_verified"`、`finalSolutionReadiness:"conversation_ready"`、`outcome:"completed_pass"`，不提供 live result、Capability、ActivationManifest或active-pointer commit。
- 根因：journey graph只证明“准备做 live”；producer checker只检查 validation名称存在于 recipe数组；pass readiness是可写 literal。
- 现有门为何抓不到：raw evidence、fixture和readiness主要是 digest、literal与证明布尔；`GaJourneyRunGateReportBase` L22494–22508没有可遍历的 live/Activation前驱。
- 根因级修复：按 journey class建立 `GaPositiveJourneyTerminalEvidence`：Supply必须携带准确 live completion、Capability、当前 Activation及pointer commit；Execution携带当前 Execution Activation与真实 session/turn终态；control携带anchor-ready commit。readiness只能由这些证据fold产生。

### A-14 任意 Supply row都可自报 `review_ready`，无需 evaluator solution

- 精确位置：plain-dialog Capability L11514–11528；四槽 `SupplySolutionReceipt` L12193–12213；`GaJourneyDefinitionV2` L20317–20326；row projection L21781–21800；pass payload L22364–22394；`ollama.chat` L21527；plain-dialog正文合同 L23855。
- 最小反例：为 `ollama.chat`选择 `expectedSolutionReadiness:"review_ready"`并令 final同值，不提供四槽 solution、evaluator capability、strict-schema能力或independence proof。
- 根因：所有 supply tier都允许两种 expected readiness；requirement row没有固定允许的terminal readiness，GA payload也不引用 `SupplySolutionReceipt`。
- 现有门为何抓不到：现有比较只拒绝 expected与final不相等；二者一起伪高仍通过。mutation集只覆盖 blocked/action-required等低状态注入。
- 根因级修复：requirements逐 row固定允许的 readiness；`review_ready`分支必须引用当前四槽 solution、全部 Activation、evaluator capability和independence proof；plain-dialog单来源只能生成 `conversation_ready`。

### A-15 61行机器真值与正文GA baseline冲突

- 精确位置：固定rows L21485–21547；execution/bridge rows L21536–21540；derivation固定 count=61，L21931–21965；唯一真值声明 L22986、L23004；GA baseline L23501–23518，特别是 L23516–23517。
- 最小反例：完整满足61行，包括 Codex App Server、Kimi ACP、OpenCode HTTP/ACP和唯一 CC Switch bridge；不提供普通 `cli_stdio`，也不提供 LiteLLM/custom gateway或第二具名bridge。机器派生门可通过，但 L23516–23517明确要求二者。
- 根因：literal requirements和规范性baseline表是两个不同最低集；机器行使用 `execution_subscription_surface/bridge_and_router`，正文表使用 `execution_surface/bridge`。
- 现有门为何抓不到：matrix、profile、baseline和release evidence全部只从61行投影；表中两个缺项没有 requirement key，永远不会进入 expected set。
- 根因级修复：保留一份 literal SoT并由其生成9.9表。若表代表owner意图，新增普通 CLI stdio与第二具名bridge row并重算 count/digest/static assertions；否则必须正式裁决并修正文表。

### A-16 OpenCode HTTP条件式 password没有可执行 journey path

- 精确位置：local graph L21018–21032；execution-local直接继承 L21039–21042；`RECIPE_EXECUTION_HTTP_V1` L21343–21353；`password_optional` producer L21440；required row L21538；producer checker L21814–21822；required-field derivation L21868–21872。
- 最小反例：OpenCode Server已运行且password已启用。run从 passive probe到peer validation收到401，但图中没有输入password的step或条件边；password-free fixture仍能让 requirement通过。
- 根因：“条件必填”被建模成普通 `required:false`字段，graph、run-subject和typed field-event coverage只处理无条件必填字段。
- 现有门为何抓不到：producer checker只确认 recipe中存在 `server_password`；required-field gate因 `required:false`不要求事件。
- 根因级修复：增加 `auth_challenge:none | password_required`判别结果；password分支必须进入一个用户触发的field step并生成事件，none分支自动继续。两分支均进入required runs、正反 fixture和UX fold。

### A-17 OAuth的signed-out起点会跳过缺失billing/entitlement

- 精确位置：账户起点联合 L20692–20700；OAuth entries L20918–20924；billing/login/validation路径 L20925–20932；固定payg例 `openrouter.pkce-key` L21500。
- 最小反例：已有OpenRouter账户、当前signed out且没有credits。它满足 `account_exists_signed_out`，从ordinal 2登录后直接到ordinal 3 validation，永不经过ordinal 1 billing。
- 根因：账户状态没有把 authentication与billing/entitlement状态做笛卡尔积；login后的edge也不按实际 entitlement outcome判别。
- 现有门为何抓不到：deriver只证明从ordinal 2存在一条语法路径到terminal，不能证明billing满足或validation成功。
- 根因级修复：拆分signed-out的billing/entitlement子状态，或在login后增加typed entitlement observation：ready进入validation，missing进入billing再validation；payg、subscription与Execution entitlement分别建模。

### A-18 GA run可换挂另一 requirement的conformance binding

- 精确位置：`ReleaseConformanceBinding` L18713–18719；`GaJourneyRunReleaseConformanceBindingReceipt` L22597–22605；`GaJourneyRunEvidenceV2` L22607–22617；aggregate/release链 L22619–22740。
- 最小反例：run subject为 `openai.responses.key`，但wrapper中的 binding引用同distribution下Anthropic Messages的completed-pass payload/attestation；填写wrapper digest和proof布尔后仍符合形状。
- 根因：binding没有携带typed `ConformanceResultCore`或semantic subject；run evidence也没有以 requirement row为泛型建立 protocol/auth/realm/surface/recipe关系。
- 现有门为何抓不到：现有字段只能比较payload、attestation和distribution digest；`ReceiptEdgeManifestV1`只有通用接口，本文没有该边的具体 target、same-value和transition predicate entry。
- 根因级修复：定义 `ReleaseConformanceBindingForCore<C>`及 `GaJourneyRunEvidence<R>`；semantic subject从 `R`机械映射，并在具体edge manifest登记逐字段同值。增加跨protocol、auth、realm、surface和distribution mutations。

## B 级 findings

### B-01 authority所谓AST census仍以人工清单为输入

- 精确位置：conformance receipt L400–446；手工 `AUTHORITY_LEASE_TYPE_NAMES_V2` L450–517；`deriveAuthorityLeaseRegistryV2` L604–616。
- 最小反例：新增 `ShadowNetworkLeaseReceipt extends AuthorityInventoryBearingLease`但不更新const；示范deriver只接收该const，因此无法观察新AST声明。
- 根因：文档声称AST独立发现，却未定义compiler AST producer、结构发现规则或不可伪造输出。
- 现有门为何抓不到：如果 verifier照示范函数实现，只能验证手工清单自洽；mutation名称不能使输入成为真实AST census。
- 根因级修复：用TypeScript compiler API独立扫描最终导出AST，按结构赋值性、authority字段、alias target及union constituents发现声明，再与registry双向比较；扫描结果必须现场生成。

### B-02 runtime state producer只验证名字存在，不验证语义和方向

- 精确位置：producer联合 L20865–20878；producer registry例 L21433–21456；compatibility L21814–21866。
- 最小反例：`not_enrolled`由“执行enroll”声称产生，`signed_out`由成功login声称产生，`not_running`由recovery action声称产生；这些动作实际消除而不是证明对应状态。
- 根因：producer没有区分 `observes_precondition`、`causes_transition`、`proves_postcondition`，也没有原始证据、前后状态或polarity。
- 现有门为何抓不到：compatibility只检查step/field/validation名称属于recipe或graph，因而错误方向也会得到 `true`。
- 根因级修复：建立typed state assertion receipt，明确input/output polarity、raw evidence、subject、run、时间顺序和唯一 transition；observer与action producer必须分开。

### B-03 signer-realm group digest可由调用方拆分，复制公平资格

- 精确位置：`PublisherFairIdentityV1` L18847–18854；group/publisher state L18911–18934；candidate L19090–19105；mutation集 L19229–19255。
- 最小反例：publisher A/B使用相同registry source与signing realm，但分别自填group digest G1/G2，形成两个candidate、两份debt、credit、admission和overload资格。
- 根因：group identity不是由验证后的 `(registry source, canonical signer realm)`唯一派生的opaque receipt。
- 现有门为何抓不到：虽列出dual-alias mutation，但实现和reference evaluator都可能消费同一错误的预分组digest，仍得到相同state/decision digest。
- 根因级修复：由独立identity normalizer从验证后的signer chain生成group receipt；scheduler和reference evaluator从原始签名事实重算，覆盖同realm不同group及不同realm同group双向mutation。

### B-04 MFA事件缺少可重算的graph及challenge discriminant

- 精确位置：`external_task_started` L19945–19957；terminal L19958；MFA variant L20880–20888；reducer声明 L19999。
- 最小反例：实际发生MFA但只记录父login task；或把任意 `conditionalVariantId`挂到另一graph task的parent nonce。
- 根因：graph-scope task事件没有 `journeyStepId/profileDigest`；variant ID是自由字符串；没有“观察到挑战/确认无挑战”的事件。
- 现有门为何抓不到：正负fixture仅以digest和证明布尔存在，raw log无法独立重算本次是否应出现MFA。
- 根因级修复：task事件绑定准确graph step/profile；增加 `conditional_requirement_observed`正负分支，challenge分支必须有nested start/terminal，无挑战分支必须有权威negative evidence。

### B-05 visibility与app elapsed不是总函数

- 精确位置：`run_started` L19937；visibility事件 L19962；fold声明 L19994–20002。
- 最小反例：run从0到1000毫秒全程前台但没有visibility事件。一种实现得到0，另一种得到1000，两者都符合当前shape。
- 根因：缺初始visibility、交替约束、terminal closure、half-open interval及同时间戳ordinal规则。
- 现有门为何抓不到：低估app elapsed更容易过限；algorithm名称和布尔字段不能消除输入歧义，V3 mutation也没有visibility omission。
- 根因级修复：`run_started`携带initial visibility；change必须交替；terminal强制关闭最后区间；固定半开区间和同毫秒事件排序。

### B-06 UX scalar gate只机械比较了部分指标

- 精确位置：actual metrics L19850–19872；signed limits L20052起；`GaUxPerClassGateReceipt` L20006–20020；run gate L22494–22508。
- 最小反例：令 `saydoPrimaryActionCount=999`、`copyPasteCount=999`、`rawElapsedMillis`超限，同时保持external/manual/admin三组指标在限额内；per-class gate仍可填写 `computedOutcome:"completed_pass"`。
- 根因：具体gate只显式比较external task、manual field和administrator wait；primary action、provider steps、copy/paste、leave-return、error、recovery及elapsed仅由后续布尔声称。
- 现有门为何抓不到：没有完整的逐字段comparison vector、violation联合或对应overflow mutations。
- 根因级修复：由一个总函数生成每个scalar的 `{actual,limit,outcome}` tuple及非空violation联合；gate pass要求该联合为空，并为每个字段加入N、N+1 mutations。

### B-07 passive IPv6 literal存在互不相等的表示

- 精确位置：`PassiveLoopbackMetadataProbe.address` L17830–17838使用 `"::1"`；semantic subject与intent L18372、L18582使用 `"[::1]"`；capability和peer admission L19374–19406又使用 `"::1"`。
- 最小反例：IPv6 capability固定 `::1`，但semantic subject和intent必须为 `[::1]`；所谓exact equality无法同时成立，或实现各自采用不同隐式normalizer。
- 根因：IP address与URL authority字符串未分型。
- 现有门为何抓不到：没有登记canonicalizer；exact关系仍由布尔字段声明。IPv4路径不会暴露该问题。
- 根因级修复：统一保存无括号的规范IP类型；只有URL serializer在IPv6 host位置添加方括号，并固定canonicalizer与golden vectors。

### B-08 accessibility evidence只有不可解释digest

- 精确位置：`GaReturnFocusEvidenceReceipt` L19906–19924；run payload的accessibility/narrow/ICU字段 L22251–22253；Phase门 L23985、L23991–23992。
- 最小反例：填入三个任意SHA字符串并通过普通journey事件；不存在typed report证明locale、viewport、zoom、screen reader、focus order、live region或outcome。
- 根因：缺少a11y report schema、raw snapshots/traces、producer、current distribution及run subject绑定。
- 现有门为何抓不到：attestation只能证明某主体签过这些字符串，不能证明报告内容或pass。
- 根因级修复：增加typed accessibility receipt，绑定distribution、run、locale、viewport、zoom、input modality、screen-reader engine、DOM/a11y snapshots、focus/live-region断言及明确pass/fail。

### B-09 support页、picker、测试矩阵和release note不在release对象图内

- 精确位置：profile声明 L21991–21993；`ReleaseEcosystemBinding` L22776–22795；生成要求 L23005、L23543。
- 最小反例：GA evidence与binding完全通过，但发布旧支持页，遗漏新requirement或把inventory标成正式支持。
- 根因：没有这些产物的schema、generator transcript、source requirement/evidence绑定或完整产物集合。
- 现有门为何抓不到：release binding没有support/picker/test-matrix/release-note artifact digest。
- 根因级修复：定义 `GeneratedSupportArtifactReceipt`，逐产物冻结canonical rows、tier/maturity/readiness、source requirements/evidence、generator和distribution；release binding要求完整准确的产物集合。

### B-10 owner additions没有namespace及combined-set collision约束

- 精确位置：`ReferenceRequirementV3` L21150–21172；fixed derivation L21931–21965；profile L21980–22034；`ownerAdditionalRequirements` L22036–22050。
- 最小反例：owner追加与固定row相同或Unicode-confusable的 `requirementKey`，但改变recipe、tier或maturity。
- 根因：owner key仍是普通 `string`；fixed 61行deriver不覆盖fixed+owner完整集合。
- 现有门为何抓不到：`ownerAdditionsMayOnlyAppendNamespacedRequirements:true`和 `provesNoFixedRequirement...:true`只是声明，mutation集没有namespace/collision反例。
- 根因级修复：使用模板字符串类型的owner namespace key，并对fixed+owner完整集合重新运行规范化、重复/confusable、composite subject、recipe和run derivation。

### B-11 `review_ready`失败降级合同自相矛盾

- 精确位置：`SolutionReadiness` L19782使用 `review_ready`；fallback正文 L23222使用不存在的 `ready_for_review`；Phase门 L23985又要求evaluator失效时降为 `conversation_ready`。
- 最小反例：evaluator失效时，一个实现停在 `ready_for_review`，另一个降为 `conversation_ready`；前者不属于类型，后者违反L23222文字。
- 根因：状态词和transition outcome存在两套规范。
- 现有门为何抓不到：没有单一判别状态机或该transition的golden/mutation；release与UX实现可以分别选择不同文本段落。
- 根因级修复：选定唯一状态词及唯一降级结果，从同一状态机生成类型、UI文案、fallback逻辑和Phase验收。

## C 级 findings

无。所有最终保留的问题均达到安全、费用、权限、发布阻断或参考实现级机械验证缺口，不适合降为非阻断建议。

## 覆盖矩阵

| # | 覆盖面 | 结果 |
|---:|---|---|
| 1 | 输入行数、bytes、SHA-256 | [ok] 精确匹配 |
| 2 | 连续完整读取 | [ok] 已覆盖L1–L25018 |
| 3 | authority AST穷举 | [fail] B-01 |
| 4 | union discriminant准确authority | [fail] A-03 |
| 5 | abort/expiry/restart exactly-once close | [fail] A-04 |
| 6 | descriptor→final lease→envelope→bundle→intent无环 | [ok] L7848–8762未保留独立环反例 |
| 7 | Gate allow/deny/not-invoked与effect三终态 | [partial] 分支可构造，但唯一持权被A-03/A-04破坏 |
| 8 | unknown funding自动推荐、evaluator、fallback、health隔离 | [fail] A-01 |
| 9 | fallback四槽及solution membership | [partial] tuple形状存在；funding和readiness分别受A-01、A-14影响 |
| 10 | capability/evaluator/readiness | [fail] A-14、B-11 |
| 11 | Execution exact surface | [fail] A-05 |
| 12 | Execution close-ready revision | [fail] A-06 |
| 13 | Execution manual committed result | [fail] A-07 |
| 14 | discovery三mode semantic subject/run evidence/authority terminal | [fail] A-08 |
| 15 | passive自动探测IPv4/IPv6 | [fail] B-07 |
| 16 | OAuth真实账户路径 | [fail] A-17 |
| 17 | workload identity/runtime producer语义 | [fail] B-02 |
| 18 | custom auth与凭据入口 | [fail] A-02 |
| 19 | registry/plugin隔离 | [fail] A-09 |
| 20 | TUF root/delegation/target/high-watermark | [fail] A-10 |
| 21 | remote witness生产qualification | [fail] A-11 |
| 22 | signer-realm alias公平性 | [fail] B-03 |
| 23 | parser/worker/resource预算数值 | [ok] 未保留独立数值或算术反例 |
| 24 | 固定requirements最低集 | [fail] A-15 |
| 25 | Execution/bridge category minimum | [fail] A-15 |
| 26 | 本地runtime与条件凭据 | [fail] A-16 |
| 27 | 中国/全球/本地/订阅/API/custom生态 | [partial] 固定rows广泛覆盖，但统一最低真值受A-15阻断 |
| 28 | 真实账户起点到live/Activation | [fail] A-13、A-16、A-17 |
| 29 | `user_primary_action/automatic`与successor语义 | [fail] A-12、B-02 |
| 30 | failed/cancelled/rejected terminal | [fail] A-12 |
| 31 | 条件式MFA与parent nonce | [fail] B-04 |
| 32 | field ID与conditional field | [fail] A-16 |
| 33 | wait/copy/scalar限额 | [fail] B-06 |
| 34 | visibility/clock/window/app elapsed | [fail] B-05 |
| 35 | route/window/focus restore | [partial] 有基础shape；原始a11y证据受B-08阻断 |
| 36 | 可访问性、窄屏、200%、screen reader、ICU | [fail] B-08 |
| 37 | requirement→run→conformance跨主体绑定 | [fail] A-18 |
| 38 | owner附加requirements | [fail] B-10 |
| 39 | support/picker/test matrix/release note | [fail] B-09 |
| 40 | Phase/DoD与合同一致性 | [fail] A-13、A-15、B-08、B-09、B-11 |

## 计数

| 等级 | 数量 |
|---|---:|
| A | 18 |
| B | 11 |
| C | 0 |
| 合计 | 29 |

## 唯一结论

**FAIL**

A与B均非零；当前目标不能作为“别人可直接借鉴的顶级开源参考实现规范”发布。