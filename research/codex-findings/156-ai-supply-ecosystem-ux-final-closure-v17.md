# AI 供给生态与零配置体验终审 v17

> 审查日期：2026-08-24
>
> 审查方式：全新零上下文、只读、目标冻结字节终审
>
> 审查边界：只读取指定 prompt、目标文件及必要的一手官方资料；未读取其他 prompt、旧 findings 或 history；未修改目标、生产代码或 canonical

## 1. 最终结论

**FAIL**

- A：2
- B：0
- C：0

两个 A 级根因都能绕过方案自称的机械门：

1. UI capability 铸造入口把已经定义好的品牌化、带可执行 destination 的 action receipt 重新放宽成普通 `ReceiptRef` 加字符串字段；空 destination、错 provider 的 rights 动作可以通过 strict TypeScript 并被铸成单次 capability。
2. Vertex WIF 的 verified external-account profile 允许 AWS source 与 `aws4_request` token type，但 exact auth oracle 固定为 JWT、global STS、无 impersonation；正确 AWS profile 与错误 JWT oracle 的组合仍通过 strict TypeScript。

因此，当前快照不能证明每个用户介入态都有真实可执行的唯一主动作，也不能证明 `rights_unknown/forbidden` 一定落到同 provider 的合格官方 journey 或安全替代 picker；同时也不能如实发布通用 Vertex WIF 支持。

## 2. 冻结身份与完整读取

审查前独立核验：

```text
SHA-256  1fa73d595c2b898637e5e9b573aa01c0e2cbfe7517d45c9e9104bfe4929aec93
wc -l    39300
bytes    2494649
```

三项均与 prompt 指定值完全一致，故继续审查该冻结版本。

完整读取与只读机械检查证据：

- 目标全文按字节读入，共 39,300 行、2,494,649 bytes。
- 全文 11 个 TypeScript block 全量抽取为 36,374 行，在 TypeScript 5.9.3、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、ES2023/NodeNext、零额外 stub 下基线为 0 diagnostics。
- `REFERENCE_REQUIREMENT_INPUTS_V3` 为 73 行，分布为 63 inference、5 execution、4 bridge、1 control plane；`REFERENCE_EXACT_CONNECTION_ORACLE_V6` 也是 73 项，双方无 duplicate、missing 或 extra。
- 关键行 `lmstudio.*` 三项、`opencode.server.http`、`litellm.bridge.*` 三项、`hunyuan.cn`、`vertex.wif` 与 `cc-switch.proxy.messages` 均同时存在于 requirement 与 exact oracle。
- 所有检查均在内存中执行，未生成临时源码或修改目标。

## 3. A 级发现

### A-01：品牌化 action 在 capability 入口退化为普通 `ReceiptRef`，空目的地和错 rights route 可通过类型门

#### 准确锚点

- 目标 L37034-L37049 正确定义了 `SupplyExecutablePrimaryActionReceiptV8`：它有私有品牌，并强制携带 `SupplyExecutablePrimaryActionDestinationV8<S, DS>`。
- 目标 L36347-L36631 正确定义了 rights resolver：正向必须携带 `OfficialApiMigrationJourneyReceiptV8`，负向必须携带 `SafeAlternativeSourcePickerJourneyReceiptV8`。
- 但目标 L37051-L37067 的 `SupplyResolvedPrimaryActionShapeForStateV8` 丢失了上述依赖：
  - 普通状态只剩任意 `ReceiptRef + actionId + labelKey`，不要求 action 私有品牌、`destination`、route、handler profile 或 executable artifact。
  - `rights_unknown/forbidden` 只剩任意 `ReceiptRef + actionId + labelKey + sourceRightsEvidence`，不参数化 provider、distribution、domain subject，也不要求 official journey、absence proof 或 alternative picker。
- 目标 L37098-L37155 的 nonce、capability 与 `mintSupplyExecutablePrimaryActionCapabilityV8` 全部接受这个放宽后的 `R`；`localActionAuthorization` 本身也只是宽 `ReceiptRef`。
- 这与目标 L36071-L36073、L38660 的完成声明相冲突：用户介入态不只是“有一个字符串按钮”，而应有一个直接可执行、同 subject 的主动作。

#### 真实用户反例

场景一：用户的 Claude Code rights 变为 `unknown`。实现传入一份合法提交但与 migration resolver 无关的 receipt，只附加：

```ts
{
  actionId: "switch_to_official_api",
  labelKey: "supply.action.resolve_rights",
  sourceRightsEvidence
}
```

该对象没有 Anthropic Messages destination、准确 realm、auth journey、return state 或 expiry relationship，仍可进入 nonce 和 capability。用户看到唯一主按钮并点击后，只能出现空页、no-op，或迫使 handler 在点击时重新用字符串查 route；三种结果都违背 fail-closed 的 rights 旅程。

场景二：`action_required.login` 使用一份无 `destination` 的 unrelated receipt，只附加 `open_login` 与正确 label。该对象同样能被铸成 capability；界面满足“恰有一个按钮”的表面指标，却没有可执行 provider login journey。

#### 本轮机械实证

在目标自身全部 11 个 TypeScript block 后只追加内存负例，不修改文件：

```text
baselineDiagnostics = 0
hollow login shape + capability probeDiagnostics = 0
hollow rights destination capability diagnostics = 0
probeAccepted = true
```

rights 负例实际调用了 `mintSupplyExecutablePrimaryActionCapabilityV8`，且没有构造 `OfficialApiMigrationJourneyReceiptV8`、`SafeAlternativeSourcePickerJourneyReceiptV8` 或 `SupplyExecutablePrimaryActionDestinationV8`；TypeScript 仍为 0 diagnostics。

#### 根因修复

1. 让 resolved action 保留完整依赖，而不是重新定义宽 shape：
   - 普通状态只能接受 `DeepFrozenCommittedReceiptV1<SupplyExecutablePrimaryActionReceiptV8<S, DS>>`。
   - rights 状态必须把 `P/S/D/E/DS` 参数贯穿到 `RightsBlockedPrimaryActionReceiptV8<P, S, D, E>`，并保持它与 domain subject、source eligibility、provider realm、hard-stop generation、expiry 和当前 released distribution 同值。
2. `SupplyExecutablePrimaryActionCapabilityV8`、nonce、view model、reducer 和 execute 的 `R` 必须是上述封闭联合，不得接受结构相似的普通 `ReceiptRef`。
3. `localActionAuthorization` 改为私有品牌、由 action destination producer 单向生成的 exact receipt；它必须绑定准确 destination/handler artifact，而不只是把宽 `R` 放进 subject tuple。
4. runtime strict schema、receipt-edge manifest 与 producer DAG 同步拒绝无 destination、错 provider、错 distribution、过期 destination、空 route 与跨 state action。

#### 可机械验收

- 把本轮两个最小 hollow action probe 固化为 compile-negative，二者必须产生 diagnostics。
- 对 14 个 actionable states 逐项构造唯一正例；普通状态必须含品牌化 destination，rights 两态必须分别覆盖 official journey 与 absence-proof picker。
- mutation 必须覆盖：删除 destination、删除 journey/picker、`switch_to_official_api` 用于无 policy 的 product、跨 provider/realm/distribution、过期 source rights、空 route、另一 state 的 action、另一 domain subject、另一 local session、nonce replay；全部在 capability mint 前失败。
- E2E 点击后必须直接消费 view model 内嵌 destination，不允许 handler 再按字符串查找 provider 或 route。

### A-02：Vertex WIF exact oracle 与 verified source 脱钩，AWS profile 可与固定 JWT oracle 错配后通过

#### 准确锚点

- 目标 L1916-L1939 的 `VerifiedGoogleExternalAccountSourceProfileV8` 明确允许 `credentialSource.kind="aws_environment"`，且 `subjectTokenType` 为开放的 OAuth token-type URN。
- 目标 L2100-L2142 的 WIF profile继续携带 verified source 的 `subjectTokenType` 与可选 `serviceAccountImpersonation`。
- 目标 L30712-L30724 的 exact flow union只允许 JWT/SAML，其中没有 AWS 所需的 `urn:ietf:params:aws:token-type:aws4_request`。
- 目标 L32288-L32303 的唯一 `AUTH_VERTEX_WIF_V7` 更进一步固定成 global STS、JWT、`serviceAccountImpersonation.kind="none"`。
- 目标 L2152-L2168 的 `commitGoogleWorkloadIdentityProfileV7` 只要求调用方同时传入该常量，没有约束 `Profile.subjectTokenType/stsEndpoint/serviceAccountImpersonation` 与 `exactAuthFlow` 同值。
- `vertex.wif` 又在 L31949 被发布为泛化的 `builtin_stable` requirement，而不是明确收窄为“仅 OIDC JWT、仅 global STS、无 impersonation”。

#### 一手官方事实

Google Cloud 当前官方文档明确把 WIF覆盖到 AWS、Azure、OIDC 与 SAML；AWS credential supplier 的 `subject_token_type` 必须是 `urn:ietf:params:aws:token-type:aws4_request`，并允许可选 service-account impersonation。[Google Cloud：Authenticate workloads with auth libraries](https://docs.cloud.google.com/iam/docs/authenticate-with-auth-libraries?hl=en)

Google 的 deployment pipeline 文档还展示可使用 regional STS URL `https://sts.REGION.rep.googleapis.com/v1/token`；因此把 validated external-account config 的 token URL永久压成 global endpoint并不等价于通用 WIF。[Google Cloud：Workload Identity Federation with deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)

#### 真实用户反例

用户在 AWS EC2/EKS 上运行 SayDo，使用 Google 官方 external-account configuration 访问 Vertex。该配置的 source 是 AWS environment，subject token 是 SigV4 signed request，token type 为 `aws4_request`，并可能需要 service-account impersonation。

当前合同有两种坏结果：

1. 执行器按 fixed oracle 发 STS 请求：把 AWS subject token标成 JWT，认证必然失败；若需要 impersonation，后续 IAM Credentials 请求也被 oracle 静默丢失。
2. 执行器按 verified profile 发正确请求：发布证据仍绑定“JWT、global STS、无 impersonation”的 exact oracle，`connectionOracle`、capture 与实际 wire 不一致，却可能生成通过报告。

这不是“尚未施工”缺陷，而是 frozen contract允许错误 profile/oracle pair通过。

#### 本轮机械实证

本轮在完整合同后构造：

- `sourceKind="workload_identity_federation"`；
- verified source 为 `aws_environment`；
- profile 与 verified source 的 token type 都是 `aws4_request`；
- `exactAuthFlow` 却传现有 `AUTH_VERTEX_WIF_V7.authFlow`，即 JWT/global/no-impersonation。

TypeScript 5.9.3 strict 结果：

```text
probe = AWS WIF profile paired with fixed JWT oracle
diagnostics = 0
accepted = true
```

#### 根因修复

1. 把 `AUTH_VERTEX_WIF_V7` 从一个固定实例改为由已验证 external-account source编译的判别联合；至少分 OIDC JWT、SAML2、AWS `aws4_request`，并把 future source显式 fail-closed。
2. `stsEndpoint` 从 verified credential configuration中取得并经过 official global/regional allowlist、realm、TLS 与 egress policy验证；不要只允许 global URL。
3. `serviceAccountImpersonation` 必须与 profile精确同值；需要 impersonation 时生成独立 `generateAccessToken` physical operation、recipient、scope、lease、stream/error/terminal 与 capture证据。
4. 在 `commitGoogleWorkloadIdentityProfileV7`、exact operation graph、credential-family identity、release claim和 capture compiler之间增加 `subjectTokenType/stsEndpoint/credentialSource/impersonation` dependent equality，不允许一边正确、一边固定 JWT。
5. 若本版只准备支持 OIDC JWT，就必须同步收窄 `credentialSource`、row名称、support claim、picker与文案，移除 AWS/SAML/通用 WIF承诺；不能保留泛化 `vertex.wif` stable row。

#### 可机械验收

- golden：OIDC JWT、SAML2、AWS `aws4_request`，各自覆盖 direct access 与 service-account impersonation；global 与受支持 regional STS各有真实 request capture。
- compile-negative/schema mutation：JWT/AWS、SAML/AWS、global/regional token URL、direct/impersonation、source audience、STS audience、project/location、final Vertex recipient任意交叉换挂都失败。
- AWS golden必须逐字节核对 STS form中的 `subject_token_type=urn:ietf:params:aws:token-type:aws4_request`，并证明实际 operation graph与发布 claim引用同一 derived oracle。
- bounded live资格需至少覆盖一条真实 AWS WIF或明确从当前 support claim排除该分支。

## 4. 十三项覆盖判定

| # | 判定 | 结论与锚点 |
|---|---|---|
| 1 | PASS | §4.1、§6.2、§9.4把 inference、Execution、产品、surface、rights、资金与 secret namespace分开；Kimi、OpenCode、Codex及其余 CLI不再以 `authenticated=true` 混装。未支持的品牌保持 inventory/unknown。 |
| 2 | FAIL | Chat/Responses/Messages、Gemini、Azure、Bedrock、custom Base URL的 origin/path/header/stream骨架总体完整；但 Vertex WIF exact oracle与 verified source脱钩，见 A-02。 |
| 3 | PASS | 73行 SoT覆盖 DeepSeek、百炼、方舟/BytePlus、千帆、硅基流动、MiniMax、TokenHub、OpenRouter；One API/New API等长尾网关保持 L2/registry边界，没有把套餐或 gateway技术成功冒充资金。 |
| 4 | PASS | §6.3、§9.5区分 loopback、LAN、cloud offload、冷态、无模型、未运行与显式 preload；Ollama/LM Studio/oMLX是正式 minimum，其余本地/自托管来源按 L1/L2或 inventory呈现。 |
| 5 | PASS | LM Studio Chat/Responses使用 none/Bearer，Messages使用 none/`x-api-key`/Bearer三分支；native REST、OpenAI-compatible与Messages没有共享认证结论，且每个 physical request恰好一种 credential header。与当前一手官方文档一致。[LM Studio Anthropic compatibility](https://lmstudio.ai/docs/developer/anthropic-compat) |
| 6 | PASS | OpenCode Server、LM Studio与LiteLLM的 optional auth从 row recipe、challenge、field event与 exact scheme map同源；required/absent分支、字段 tuple、endpoint/process generation及跨 row/run换挂均有 typed gate。 |
| 7 | PASS | OpenCode Go的 `go_only_hard_stop/go_then_zen_balance`、Zen payg、TokenHub free-only与其余资金 variant互斥；special funding evidence绑定 site/protocol/principal/model/operation。 |
| 8 | PASS | CC Switch只承诺公开 loopback Messages opaque proxy，不读取私有Tauri/DB、不依赖route pin或provider归因；未来 control API必须新建 requirement。 |
| 9 | PASS | static零进程零packet、passive由host执行固定loopback probe、explicit-active需用户决定；未运行/冷态/无模型/API关闭/端口冲突都有独立处方，未授权时不start/pull/load。 |
| 10 | FAIL | 静态 registry表面满足 automatic=0、actionable=1，但 capability入口允许无 destination 的空 action，见 A-01；因此“唯一按钮”不等于“唯一可直接执行主动作”。 |
| 11 | FAIL | 前段 resolver定义了 official journey/absence picker，但后段 `SupplyResolvedPrimaryActionShapeForStateV8`与mint丢失该依赖，见 A-01；rights blocked不能机械保证同 provider intent、准确realm/generation/expiry与安全替代。 |
| 12 | PASS | `hunyuan.cn`固定为 migration-only；正向从 existing connection只读证据开始，无连接只产 `not_applicable_no_existing_connection`，fresh account/billing/key/CTA计数固定为0。 |
| 13 | PASS | 73 requirement与73 oracle精确双射，分布、critical rows与发布 artifact closure一致；deterministic fixture、bounded live set-cover、账号lease/cleanup、双locale、pseudo locale与a11y均有可执行门。A-01/A-02仍使整体release不得通过。 |

## 5. 只读反例与外部事实复核摘要

- 目标 TypeScript基线：0 diagnostics。
- hollow login action可赋给 resolved shape并进入 capability mint：0 diagnostics。
- hollow rights action不含 official journey或safe picker仍进入 capability mint：0 diagnostics。
- AWS WIF profile与 fixed JWT oracle错配：0 diagnostics。
- OpenCode Zen/Go当前公开 endpoint按模型区分 Chat、Responses与Messages，目标对应 path与产品拆分未发现新偏差。[OpenCode Zen](https://opencode.ai/docs/zen/)、[OpenCode Go](https://opencode.ai/docs/go/)
- LM Studio Messages当前在 Require Authentication开启时接受 `x-api-key`或Bearer，关闭时 credential可省略；目标v17对此已准确修复。[LM Studio Anthropic compatibility](https://lmstudio.ai/docs/developer/anthropic-compat)

## 6. 最终计数

```text
A = 2
B = 0
C = 0
FINAL = FAIL
```

方案尚未施工没有单独计为缺陷；本报告只计入冻结合同本身允许的类型旁路、不可执行journey与错误官方认证事实。

## 7. 落盘后目标身份复核

报告首次落盘后再次执行只读复核，结果如下：

```text
SHA-256  1fa73d595c2b898637e5e9b573aa01c0e2cbfe7517d45c9e9104bfe4929aec93
wc -l    39300
bytes    2494649
```

与审查前冻结身份完全一致，目标未漂移。
