# AI 供给普适接入方案架构闭包终审 v17

## 结论

`FAIL`

- A：4
- B：1
- C：0

本次只读终审发现四个阻断性类型合同缺陷：canonical receipt 反序列化边界允许调用者自行指定未由 decoder 约束的 body 类型；`unknown`/`forbidden` 权益阻断链的精确状态分支因非分布式 `Extract` 收缩为 `never`，而宽 union 逃生路径又丢失准确状态；TokenHub `reserved`/`dedicated` 两类 funding closure 因相同问题在六条 requirement 上均收缩为 `never`；同协议、同 auth、同 realm 的跨 provider oracle 替换可使整份合同保持零 diagnostics，而专用 exact-oracle conformance receipt 没有进入任何 release graph。另有一个 B 级缺口：当前类型实例化相对签名基线只剩 2,505.6 次、约 0.297% 的余量，十个最小 owner 扩展类型实例化已越过相对门。

## 冻结身份与范围

评审开始时独立执行 SHA-256、行数和字节数核对，原始结果为：

```text
sha256=1fa73d595c2b898637e5e9b573aa01c0e2cbfe7517d45c9e9104bfe4929aec93
lines=39300
bytes=2494649
```

与冻结身份完全一致。随后按行完整读取目标 `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md` 的 1–39300 行。没有读取任何其他 prompt、其他 `research/codex-findings/`、`history/` 或旧评审材料；没有修改目标、生产代码、canonical 或其他文件。本报告是唯一写入。

报告落盘后再次核对目标，结果仍为：

```text
sha256=1fa73d595c2b898637e5e9b573aa01c0e2cbfe7517d45c9e9104bfe4929aec93
lines=39300
bytes=2494649
```

## 实际检查方法与原始结果

### 1. 严格 TypeScript 抽取编译

从目标按原顺序抽取全部 11 个 `ts` fence，以两个换行连接；未添加外部或内部 stub。使用本机实际 TypeScript 5.9.3、ES2023、NodeNext、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`skipLibCheck: true`、`types: []`、`noEmit` 编译。原始摘要：

```json
{"typescript":"5.9.3","blocks":11,"sourceLines":36384,"sourceBytes":1811142,"diagnostics":0,"types":363293,"instantiations":845003,"symbols":446261,"wallMs":2900.1,"rssBytes":787939328}
```

同一次 `/usr/bin/time -l` 观测为：

```text
3.06 real
789643264 maximum resident set size
816085472 peak memory footprint
```

零 diagnostics 只说明声明彼此可编译；A-1 的反例正是在零 diagnostics 下获得伪造 body 类型，A-2/A-3 则是基础编译没有要求正向构造性而漏掉的 `never`。

### 2. Compiler API 结构审计

对最终 program AST 和 checker 实际遍历，结果为：

```json
{"diagnostics":0,"propertySignatures":20932,"writableProperties":0,"anyKeywords":0,"duplicateProperties":0,"typeAliases":1060,"unionAliases":504,"aliasOrUnionConstituents":5031,"requiredNever":273,"computedBrandRequiredNever":261,"nonBrandRequiredNever":12}
```

12 个非品牌 required-`never` 全部是 `SpecialFundingVariantEvidenceV6` 的 `fundingClosure`，逐项结果：

```text
tokenhub.gz.chat       tokenhub_reserved
tokenhub.gz.chat       tokenhub_dedicated
tokenhub.gz.responses  tokenhub_reserved
tokenhub.gz.responses  tokenhub_dedicated
tokenhub.gz.messages   tokenhub_reserved
tokenhub.gz.messages   tokenhub_dedicated
tokenhub.sg.chat       tokenhub_reserved
tokenhub.sg.chat       tokenhub_dedicated
tokenhub.sg.responses  tokenhub_reserved
tokenhub.sg.responses  tokenhub_dedicated
tokenhub.sg.messages   tokenhub_reserved
tokenhub.sg.messages   tokenhub_dedicated
```

这与目标第 39298 行“非品牌必填 `never` 0”的自审结论不一致；该不一致并不另计一条发现，而是 A-3 的机械旁证。

### 3. Authority、requirements、oracle 与静态 UI census

独立 AST census 的原始摘要：

```json
{
  "authority": {
    "expected": 74,
    "aliasOnly": 8,
    "concrete": 66,
    "branchFreePolicies": 60,
    "branchDispatchedTypes": 6,
    "branchConstituents": 23,
    "totalConstituents": 83,
    "missingExpectedPolicy": [],
    "extraPolicy": [],
    "duplicateExpected": [],
    "duplicateBranchKeys": []
  },
  "requirements": {
    "rows": 73,
    "oracleRows": 73,
    "distribution": {"inference": 63, "execution": 5, "bridge": 4, "control_plane": 1},
    "duplicateRequirementKeys": [],
    "duplicateOracleKeys": [],
    "missingOracle": [],
    "extraOracle": []
  }
}
```

静态 UI 两个 literal root 按 14 个禁入键递归扫描：

```json
{"mutation":"static_registry_dynamic_field","actualForbiddenOccurrences":0,"actualHits":[],"syntheticControlEpochOccurrences":1,"auditorRejectsSynthetic":true}
```

### 4. 主动反例摘要

以下检查均在内存虚拟 TypeScript 文件或只读 AST 中执行，没有写入临时合同文件：

| 反例 | 实际结果 | 结论 |
|---|---|---|
| late authority subtype | `expectedTypeNames=74`，新增 subtype 被发现但不在 expected set，`censusMismatchCount=1` | [ok] census 能使门非零 |
| cleanup 后直接 re-lease | `CleanupVerifiedProviderTestAccountCursorV7` 不可赋给 `AvailableProviderTestAccountCursorV6` | [ok] 必须先经过 release barrier 与独立 available successor |
| `delivery_unknown` 直接 retry/fallback | retry subject 中对应 `Extract` 为 `never`；既有 `FallbackUnknownCannotAdvance` 断言也编译通过 | [ok] 未发现直达 advance |
| side-effect 跨 commit lease | 两个 receipt-identity 非赋值断言均通过，suite 为 `diagnostics=0` | [ok] exact request terminal 与 commit lease 同参绑定 |
| cross-use-case rights | software-development grant 不可赋给 quality-evaluation grant；restriction floor 输出 `forbidden_by_restriction_floor` | [ok] restriction floor 未被动态权益放宽 |
| 旧 eligibility/generation/expiry 官方迁移 | 按准确 `unknown`/`forbidden` 状态的 eligibility 在入口已是 `never`；把 `S` 宽化为两值 union 才可构造 | [fail] 形成 A-2：准确状态链不可构造，宽化链又丢失 exact-state 约束 |
| 静态 registry 夹带动态字段 | 实际 0；注入 `controlEpoch` 后 auditor 命中 1 | [ok] 静态门闭合 |
| 旧 capability 跨 session 重放 | 不同 daemon session 的 capability 不可赋值；同 capability 的并发只允许依赖指定的 nonce CAS | [ok] 合同要求 runtime CAS；未把 TypeScript 当线性类型 |
| LM Studio Messages 双 credential header | `none` 携带 credential、`x-api-key` 再携带 Authorization、跨 scheme、跨 endpoint/process generation 均为不可赋值或 `never`，suite 为 `diagnostics=0` | [ok] |
| WIF 把 IdP aud 当 STS audience | 类型断言确认 scheme-less STS audience 与独立 subject-token audience source | [ok] |
| Azure Managed Identity 调 tenant token endpoint | managed-identity flow 不可具有 tenant endpoint；VM 与 App Service source 分支分开 | [ok] |
| Hunyuan fresh 账户笛卡尔 | requirement 为 `existing_connection_migration_only`，absence subject 的开户、计费、建凭据、network send 合计为 0 | [ok] |
| 同协议同 auth 的 row/oracle swap | builder 层 TokenHub GZ→SG 可表达；整份合同把 `openai.chat.key` 换成 Minimax global wire/auth/origin 后仍为 `diagnostics=0` | [fail] 专用 exact-oracle conformance receipt 没有任何调用或 release consumer，见 A-4 |
| 跨 distribution witness | `dist-a` binding 不可赋给 `dist-b` | [ok] |
| owner 自填派生事实 | raw input key 集不含 `semanticCompilation`、`connectionOracle`、`liveQualificationMode`、`onboardingAvailability` | [ok] |
| evaluator proof 跨 solution/generation | 两组非赋值断言均通过 | [ok] |
| dual-write 崩溃边界 | 5 个 migration state、5 个 transition table row、17 个 kill point；step table 对每 state/operation 要求非空 kill-point tuple | [ok] |

综合封闭断言原始结果：

```json
{"mutation":"cross_boundary_negative_invariants_excluding_blocked_rights_bug","diagnostics":0,"allAssertionsHold":true}
{"mutation":"side_effect_cross_commit_lease","diagnostics":0,"rejectedByTypeIdentity":true}
{"mutation":"optional_auth_cross_scheme_cross_run_and_double_header","diagnostics":0,"allRejected":true}
{"migrationStates":5,"transitionTableStateRows":5,"killPointUnionMembers":17,"operationStepTableType":"mapped every state and every operation to NonEmptyReadonly<killPoint>"}
```

整份合同的 oracle 变体与终门可达性原始结果：

```json
{"mutation":"whole_contract_openai_chat_row_replaced_by_minimax_global_same_protocol_auth_realm","replacedOccurrences":1,"diagnostics":0,"mutatedProjection":{"wireProfile":"wire-oracle:minimax-global-chat@6","origin":"https://api.minimax.io","authProfile":"auth-oracle:minimax-global-key@6","principalNamespace":"minimax-international-account-key","signedPath":"providers/minimax-global/connection-oracle.v6.json"}}
{"mutation":"special_oracle_gate_reachability","specialReceiptIdentifierOccurrences":2,"occurrenceOwners":["ReferenceSpecialExactOracleConformanceReceiptV7","compileReferenceSpecialExactOracleConformanceV7"],"compilerCallExpressions":0,"releaseTypeReferences":{"GaEcosystemGateReportReceipt":false,"GaEcosystemReleaseEvidenceSetV3":false,"ReleaseEcosystemBinding":false,"ReferenceGradeProfileV3":false,"PublishedProductProtocolClaimSetReceiptV6":false},"referenceGradeMutationKindsIncludeOracleOrWireSwap":false}
```

### 5. 必要一手协议事实核验

- [LM Studio Anthropic compatibility](https://lmstudio.ai/docs/developer/anthropic-compat) 明确：Require Authentication 开启时同时接受 `x-api-key` 与 `Authorization: Bearer`，关闭时 `x-api-key` 可省略。目标的 three-way optional auth 与该事实一致。
- [Google WIF with other clouds](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-clouds) 明确 STS 请求 `audience` 使用不含 `https:` scheme 的 `//iam.googleapis.com/.../providers/...`；[Google WIF best practices](https://docs.cloud.google.com/iam/docs/best-practices-for-using-workload-identity-federation) 又明确 IdP token 的 `aud` 默认是带 `https://` 的 provider URL。目标把两者作为不同字段。
- [Azure App Service Managed Identity](https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity) 明确使用 `IDENTITY_ENDPOINT`、轮换的 `IDENTITY_HEADER` 值作为 `X-IDENTITY-HEADER`，API version 为 `2019-08-01`；目标与 VM IMDS 分支分开，未把 managed identity 渲染成 tenant token endpoint。
- [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth) 明确 `/auth`、callback code/state/verifier 与 `POST /api/v1/auth/keys` 交换得到 API key；目标将 exchange 和最终 Bearer 请求分开。

## 发现

### A-1：反序列化 decoder 不约束返回 body 泛型，调用者可凭空获得任意已提交字段

准确锚点：目标第 474–488 行，尤其第 477 行独立的 `B extends object`、第 481 行只参数化为 `[K, S]` 的 `schemaGeneratedBodyDecoder`，以及第 483–487 行直接返回 `ReceiptRef<K, S> & B`。

最小反例：为一个只绑定 `K`、`S` 的 decoder 显式选择如下 `B`：

```ts
type ForgedBody = {
  readonly grantsExternalEffect: true;
  readonly arbitrarySecret: string;
};

const forged = deserializeAndVerifyDeepFrozenReceiptV7<
  "receipt:review-safe@1",
  { readonly tenant: "tenant-a" },
  ForgedBody
>({
  persistedCanonicalCommitEnvelopeBytes: envelope,
  persistedReceiptDigest: "digest",
  schemaGeneratedBodyDecoder: decoderForKindAndSubjectOnly,
  currentWriterAndAnchorVerification: writerAnchor,
});

const effect: true = forged.grantsExternalEffect;
const secret: string = forged.arbitrarySecret;
```

实际编译：

```json
{"mutation":"caller_selects_deserialized_body_type_not_bound_to_decoder","diagnostics":0,"accepted":true}
```

根因：`B` 既不能从 input 推导，也没有进入受信 decoder 的 canonical subject；调用者可以显式指定任意结构。无论 runtime decoder 实际返回什么，TypeScript API 都会把它标成深冻结、已提交且具有伪造字段的 receipt。这直接破坏 canonical body、producer DAG 和依赖该类型做权限判定的机器门。

根因修复：让 body 类型成为品牌化 schema decoder 身份的一部分，并只从 decoder 推导，例如 `SchemaGeneratedBodyDecoderReceipt<K, S, B>` 加 `BodyOf<Decoder>`；或建立封闭的 `CanonicalBodyFor<K, S>`。禁止调用者独立提供 `B`。runtime 还必须对 decoder 输出重新 JCS 化并与 envelope payload bytes、digest、id、sequence、token、CAS、epoch、anchor 做 exact roundtrip。

机械验收：

1. 上述反例必须产生 compile diagnostic，且不能通过显式 generic argument 恢复。
2. 同一 `K/S` 的不同 body schema、跨 decoder、跨 generation、跨 envelope 的正反例进入固定 mutation corpus。
3. 合法 decoder 的正向反序列化仍可构造，且三语言 JCS fixture digest 完全相同。

### A-2：`unknown | forbidden` 合并分支使精确 rights-blocked 路径不可构造，宽 union 逃生又丢失状态身份

准确锚点：目标第 5349–5374 行将 `status: "unknown" | "forbidden"` 放在同一个 union constituent；第 36402–36628 行却反复使用 `Extract<ProductEligibilityReceipt, { status: S }>`，其中 `S` 是单一的 `unknown` 或 `forbidden`；第 37051–37067 行的 UI resolved action 又直接按单一 literal `Extract`。

最小反例及实际结果：

```ts
type Unknown = Extract<ProductEligibilityReceipt, { readonly status: "unknown" }>;
type Forbidden = Extract<ProductEligibilityReceipt, { readonly status: "forbidden" }>;

type MustExist1 = AssertTrue<IsNonNever<Unknown>>;
type MustExist2 = AssertTrue<IsNonNever<Forbidden>>;
```

```text
{"mutation":"rights_blocked_positive_constructibility","diagnostics":4,"rejectedAsNever":true}
line=36389 TS2344 Type 'false' does not satisfy the constraint 'true'.
line=36390 TS2344 Type 'false' does not satisfy the constraint 'true'.
line=36391 TS2344 Type 'false' does not satisfy the constraint 'true'.
line=36392 TS2344 Type 'false' does not satisfy the constraint 'true'.
```

四个 diagnostics 分别对应 unknown eligibility、forbidden eligibility、`rights_unknown` action evidence、`rights_forbidden` action evidence。TypeScript 的 `Extract<T, U>` 只保留整体可赋给 `U` 的 union constituent；`{ status: "unknown" | "forbidden" }` 整体不可以赋给任何单一 literal，因此两个精确结果都是 `never`。

若把泛型 `S` 宽化成整个 `RightsBlockedStateV8`，合并 constituent 与 migration resolution 又会变成可构造：

```json
{"mutation":"broad_blocked_union_escape","diagnostics":0,"broadUnionConstructible":true}
```

这不是安全修复：canonical subject 此时只记录 `"unknown" | "forbidden"` 的宽 union，无法证明当前状态是哪一个；而 `rights_unknown`/`rights_forbidden` 两个 UI view shape 仍分别要求已经变成 `never` 的精确 evidence。

影响：按准确 UI 状态，有合格官方目的地时无法构造 `switch_to_official_api`，无合格目的地时也无法构造排除原 principal/credential family 的 `choose_another_source`。若实现退而使用宽 `S`，则 source status 不再是 exact relationship identity。方案第 39296 行声称已把 source eligibility/realm/generation/expiry 直接参数化，但精确 subject 在参数化入口前已经消失。这是主流 rights-blocked 恢复路径不可发布或被迫宽化，不只是 stale receipt 检查缺一条测试。

根因修复：把 `unknown` 与 `forbidden` 拆成两个真实 union constituent；或者定义真正按 status 分布并窄化的 helper，但不得继续对合并 constituent 使用内置 `Extract`。所有 official migration、safe picker、primary action 与 UI view model 应统一使用同一个已验证 helper。

机械验收：

1. `unknown`、`forbidden` 两个精确 eligibility receipt 均有受信 producer 正向构造例，并禁止用宽 `RightsBlockedStateV8` 替代 exact status。
2. 有 policy 的两种状态各能构造准确 official journey；无 policy 的两种状态各能构造安全替代 picker。
3. source product、realm、hard-stop generation、expiry、destination requirement/claim/realm/auth journey/distribution 任一换挂均 compile-negative；过期与 generation 漂移 runtime mutation 在 secret read、route open 前拒绝。
4. `SupplyResolvedPrimaryActionShapeForStateV8<"rights_unknown" | "rights_forbidden">` 的 `sourceRightsEvidence` 均非 `never`。

### A-3：TokenHub reserved/dedicated funding closure 在六条 requirement 上全部是 required-`never`

准确锚点：目标第 31150–31190 行；第 31183–31189 行把 `fundingMode: "reserved" | "dedicated"` 合并在一个 constituent。第 33744–33764 行再用单一 literal 的 `Extract` 生成 variant closure；第 33778–33810 行把该 closure 作为 required `fundingClosure` 展开到 exact evidence map。

实际 checker 对 `SpecialFundingVariantEvidenceV6` 的 36 个 constituent 枚举得到 12 个 required-`never`：两站 × 三协议 × reserved/dedicated。正向构造反例：

```text
{"mutation":"tokenhub_reserved_and_dedicated_positive_constructibility","diagnostics":2,"rejectedAsNever":true}
line=36389 TS2344 Type 'false' does not satisfy the constraint 'true'.
line=36390 TS2344 Type 'false' does not satisfy the constraint 'true'.
```

根因与 A-2 同类但影响域独立：合并的 `"reserved" | "dedicated"` constituent 整体不满足 `{ fundingMode: "reserved" }` 或 `{ fundingMode: "dedicated" }`，所以 `Extract` 返回 `never`。两个资金变体在 GZ/SG 的 Chat、Responses、Messages 上都无法产生发布必需的证据。

根因修复：把 reserved 和 dedicated 拆成两个真实 union constituent，分别固定 `fundingMode`、payment/overage 字段与 capacity entitlement；或使用能实际分发并窄化 merged literal 的 helper。优先拆分，因为两种产品合同后续很可能继续分化。

机械验收：

1. 六条 TokenHub requirement × 五个 funding variant 共 30 个 positive constructor 全部非 `never`；再加 OpenCode Go 的六个组合，共 36 个 exact map member 可构造。
2. Compiler API 对最终展开类型要求“非品牌 required-`never` 为 0”，不能只扫描声明语法中的显式 `never`。
3. reserved/dedicated、site、protocol、principal、model、payment、overage 任一 cross-swap 均失败；两轮 live qualification 的相应 funding evidence 可发布。

### A-4：跨 provider oracle 替换可通过整份合同编译，专用 conformance receipt 又未接入 release graph

准确锚点：目标第 32102–32122 行的 `defineConnectionOracleEntryV6` 只把 requirement 与 wire 的 protocol、requirement 与 auth 的 `authKind` 做同值约束，没有把 product、realm、origin、recipient namespace、slug/evidence path 绑定为同一 provider identity；第 32820–32855 行定义 `ReferenceSpecialExactOracleConformanceReceiptV7` 及其 compiler；第 33419–33470、35188–35227、35731–35820 行的 reference-grade mutation gate、ecosystem gate 与 release evidence 却均不消费它。

不是只在孤立 builder call 上测试。内存中对完整 11 个 TypeScript block 只替换一行：保留 requirement key `openai.chat.key`，把它的 wire、auth、principal namespace、signed oracle/evidence slug 整组换成同为 global、OpenAI Chat protocol、Bearer auth 的 Minimax row。整份变体的实际结果为：

```json
{
  "mutation": "whole_contract_openai_chat_row_replaced_by_minimax_global_same_protocol_auth_realm",
  "replacedOccurrences": 1,
  "diagnostics": 0,
  "mutatedProjection": {
    "wireProfile": "wire-oracle:minimax-global-chat@6",
    "origin": "https://api.minimax.io",
    "authProfile": "auth-oracle:minimax-global-key@6",
    "principalNamespace": "minimax-international-account-key",
    "signedPath": "providers/minimax-global/connection-oracle.v6.json"
  }
}
```

这说明 73/73 key census、现有 literal invariants、requirements derivation 以及所有后续声明都随错误 canonical oracle 自洽地继续编译；它们没有独立的 expected provider-oracle identity。对 intended 终门继续做 AST 可达性检查，结果是 `ReferenceSpecialExactOracleConformanceReceiptV7` 全文只有自身声明与 compiler 返回类型两处 identifier occurrence，compiler call expression 为 0；`GaEcosystemGateReportReceipt`、`GaEcosystemReleaseEvidenceSetV3`、`ReleaseEcosystemBinding`、`ReferenceGradeProfileV3`、`PublishedProductProtocolClaimSetReceiptV6` 对它的引用均为 false。`ReferenceGradeProfileV3.requiredMutationFixtureKinds` 也没有 oracle/wire/provider swap 项。

因此第 32827–32848 行列出的 golden capture 与 `wrong_operation_auth_or_recipient`、TokenHub site/fallback swap 等 mutation 只是一个可选、悬空的 receipt 形状，不是 mandatory release predecessor。最终 claim 的 `exactConnectionOracle` 只会忠实传播已经被换错的 canonical row，不能证明它与独立官方 provider identity 相符。类型内的 `semanticCompilerFailureCount: 0`、`survivingMutationCount: 0` 也因无 consumer 而不会阻断发布。

根因修复：建立独立于 row 输入的、签名且按 requirement key 封闭的 expected oracle identity registry，把 product、realm、wire profile/origin/path、auth profile/recipient namespace、operation graph、evidence-lock target 与 distribution 一次性绑定。`defineConnectionOracleEntryV6` 或其 semantic compiler 必须比较该独立 registry，不能让 expected 与 actual 同源。然后把 `DeepFrozenCommittedReceiptV1<ReferenceSpecialExactOracleConformanceReceiptV7>` 作为 `ReferenceGradeProfileV3`、`GaEcosystemGateReportReceipt`、`GaEcosystemReleaseEvidenceSetV3` 和最终 `ReleaseEcosystemBinding` 的同 digest 必填前驱。

机械验收：

1. 对全部 73 行逐一执行 same-protocol/same-auth/same-realm 的 wire、auth、recipient namespace、slug/evidence path 替换；任一替换都必须让 Phase 0 semantic gate 非零，而不只是特殊五类 golden。
2. AST producer/consumer reachability 要求 exact-oracle conformance compiler 至少有一个真实构造点，并沿 mandatory typed edges 到最终 release binding；删除或换挂该 receipt 必须使 release type/runtime verifier 失败。
3. mutation fixture key tuple 必须精确包含并执行 provider/wire/auth/origin/operation/recipient/evidence-lock/distribution swap，expected 与 actual corpus 分属不同受信来源，防止共同漂移。
4. 保留所有 73 行的合法正向构造及当前特殊 provider capture，确保不是用把 oracle 全部变成 `never` 或禁止扩展制造假绿。

### B-1：相对实例化预算只剩 0.297%，十个最小 owner 扩展已触发回退门

准确锚点：目标第 25307–25356 行规定绝对门与签名基线相对门必须同时通过，实例化相对上限为 115%；第 39298 行记录 v16 签名证据 736,964 和当前 845,003。

计算结果：

```json
{
  "current": 845003,
  "relativeLimit": 847508.6,
  "relativeHeadroom": 2505.6,
  "relativeHeadroomPercentOfCurrent": 0.2965,
  "growthFromBaselinePercent": 14.6600,
  "absoluteHeadroom": 54997
}
```

目标自称“低于回退门”在数值上成立，但没有真实扩展余量。为验证普适扩展承诺，使用现有公开 owner generic 依次实例化独立 namespaced owner requirement 及其 journey qualification，不改任何既有合同：

```json
{
  "relativeLimit": 847508.6,
  "rows": [
    {"ownerExtensions":8,"diagnostics":0,"instantiations":847174,"relativeOutcome":"pass","deltaToLimit":334.6},
    {"ownerExtensions":9,"diagnostics":0,"instantiations":847402,"relativeOutcome":"pass","deltaToLimit":106.6},
    {"ownerExtensions":10,"diagnostics":0,"instantiations":847630,"relativeOutcome":"fail","deltaToLimit":-121.4}
  ]
}
```

这还没有加入新 authority constituent、optional-auth scheme、wire operation 或 mutation fixture。对一个以“普适接入”和 owner append-only 扩展为核心的方案，十个最小扩展就要求 owner 重置基线或拆门，属于重大维护与可扩展性缺口。

根因修复：继续去重 73-row conditional/mapped expansion，把重型 derived union 拆成生成代码或独立编译单元，并让外层 receipt 只携带品牌化索引；不得仅重置基线掩盖增长。

机械验收：在不替换 v16 签名基线、不放宽阈值的前提下，固定扩展储备 corpus 至少包含 16 个独立 owner requirement、一个新 authority constituent、一个新 optional-auth requirement 和相应 mutation assertions，严格编译仍同时通过绝对门与相对门。若产品决定支持上限更低，必须由 owner 明确冻结上限并让 UI、文档和 schema 同步可判定。

## 十三项覆盖结论

| 项 | 结论 | 证据摘要 |
|---:|---|---|
| 1 | [ok] | inference/execution 两平面、三核心推理协议、Execution/bridge/control 判别闭合；third-party core 正向非 `never`，且不可赋给 bundled/declarative receipt。 |
| 2 | [fail] | JCS/envelope/readonly 主体完整，但反序列化 `B` 未绑定 decoder，见 A-1。 |
| 3 | [ok] | 74 expected、8 alias、60 branch-free、23 branch constituent、83 total 精确；late subtype mutation 使 census mismatch 非零。 |
| 4 | [ok] | inference、Execution physical、read-only tool、side-effect tool exact retry subject 闭合；unknown 与跨 commit lease 反例未通过。 |
| 5 | [ok] | product/realm/surface/operation/use-case/principal/distribution 进入 branded rights subject；restriction floor 对受限产品输出 forbidden。 |
| 6 | [fail] | source receipt 本应绑定 exact status/realm/generation/expiry/destination/distribution，但两个精确 blocked eligibility 均为 `never`，宽 union 又丢失 exact status，见 A-2。 |
| 7 | [fail] | 静态 registry 零动态字段，capability/session/CAS 形状正确；但两个 rights-blocked actionable state 的精确 evidence 为 `never`，同属 A-2。 |
| 8 | [fail] | 73 requirement 与 73 oracle 虽零漏、零额外，但完整 OpenAI→Minimax same-protocol/auth/realm 替换仍为零 diagnostics；专用 exact-oracle conformance receipt 不在任何 mandatory release graph，见 A-4。 |
| 9 | [ok] | optional-auth key/scheme tuple 封闭；none/Basic/Bearer/x-api-key、field tuple、endpoint/process generation 与双 header 反例被拒。 |
| 10 | [ok] | WIF 双 audience、Azure VM/App Service Managed Identity、OpenRouter PKCE acquisition 均与最终请求认证分离，并与一手资料相符。 |
| 11 | [fail] | Hunyuan migration-only、cleanup barrier、两 cycle/平台/realm 结构可判定；但 TokenHub 12 个 special funding evidence member 不可构造，见 A-3。 |
| 12 | [ok] | legacy 五态与 17 kill point、第三方 Execution plugin、owner raw→compiler、support claim 四件套、Phase 0–8/1A/Definition Complete 均有具名门。 |
| 13 | [fail] | strict 基础编译为 0 diagnostics，但存在 A-1 的零诊断伪类型、A-2/A-3 的正向 `never`，且相对实例化余量不足，见 B-1。 |

## 最终计数

```text
A=4
B=1
C=0
FINAL=FAIL
```

按照“A=0 且 B=0 才可 PASS”的规则，本冻结快照不能取得架构终审闭包。
