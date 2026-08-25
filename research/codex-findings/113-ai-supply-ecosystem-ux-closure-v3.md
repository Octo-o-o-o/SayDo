# AI supply 生态与 UX 闭包终审 v3

VERDICT: FAIL

## 审阅证据

- 唯一对象：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`
- 开始 SHA-256：`a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453`
- 结束 SHA-256：`a6333241ff6345773d95e5a98c0889f84ef2f223ddecdb38e0e0798a4a855453`
- 开始 Git HEAD：`bb9d28735598693f03345630eb4dc256862d5c29`
- 结束 Git HEAD：`bb9d28735598693f03345630eb4dc256862d5c29`
- 实际读取范围：第 1–4379 行，完整文件，`420572` 字节
- 评审按完整实施后的合同结果判断，没有把生产代码尚未实施作为问题。
- 除特别标注的产品示例外，以下结论均来自目标文档内部合同对照，不依赖动态外部事实。

## A

### [A1] 预授权必须展示全部可能请求，却又被要求与成功即停后的实际 `sent` 数量逐项相等

- 准确位置：第 2255–2256、2853–2854、2904、3094–3095、3688 行。
- 反例：一次 custom 双协议验证授权候选 `r1`、`r2`。确认前必须展示两个可能物理请求、各自费用上限及“成功即停”；实际 `r1` 成功后，ledger 只有一个 `sent`。renderer 若展示两个请求，违反第 3688 行的数量逐项相等；若只展示一个，则无法在发送前知道哪个请求会成功，并隐去了用户已授权序列中的第二项及其可能费用。
- 现有条款为何挡不住：最坏序列预留、成功即停、逐 attempt 账本分别是正确约束，但第 2854、3688 行把事前“可能集合”和事后“实际集合”错误合并成同一个相等断言。staged/live、gateway retry/failover 同样必然出现可能数大于实际 `sent` 数的正常情况。
- 最小修订：
  - `AuthorizationDisclosure` 精确映射 envelope 中全部允许序列及最坏上限；
  - `ActualAttemptReport` 精确映射 ledger 的实际 `sent`；
  - 门禁改为：实际 `sent` 序列必须是某条已披露允许序列的前缀或合法成员序列；每个 `sent` 都有披露项；实际数量和逐分量费用不超过披露上限；只有事后报告数量才与 ledger 一一相等；
  - 补齐首项成功、首项失败后第二项成功、gateway failover、staged/live 两轮和 `charge_unknown` fixture。

## B

### [B1] 真 custom/private gateway 的未知计量路径仍存在 producer deadlock，且发送侧判别联合没有该分支

- 准确位置：第 1184–1196、1223–1235、2116–2121、2208–2210、2253–2265、2723、3372、3485、4372 行。
- 反例：企业管理员录入一个精确、route-pinned、非官方的私有兼容网关；endpoint、principal、protocol 和 egress consent 均可确定，但网关没有可查询的价格、usage 或 hard cap。`user_or_admin_attested_custom` 只允许保存凭据。首次 conformance 又要求非空且带价格、单位和最坏金额的 `CandidateBilling`；第 2265 行禁止为未知价格创建授权。因此不能发出首测，也不能获得 `ConformanceResult`、Capability、Binding 或 FundingPolicyTemplate。
- 即使绕过首测，`ExternallyMeteredUnknownConsentReceipt` 又必须引用后置的 FundingPolicyTemplate 和 Binding identity；第 2263 行定义的发送侧 `FundingDecisionReceipt` 仅包含 `NoNewSpendProofReceipt | RuntimeSpendAuthorization`，没有 `ExternallyMeteredUnknownConsentReceipt`。
- 现有条款为何挡不住：第 2723、3372、3485、4372 行只是声明“逐次使用 `externally_metered_unknown`”，没有定义首测阶段的 producer、未知计量的 ConformanceResult 分支或发送侧 union。当前结构只能停在 inventory，和“真 custom endpoint 可显式接入”的目标冲突。
- 最小修订：
  - 新增绑定准确 `ConformanceAttemptSubject`、endpoint、prepared request、物理请求 cap、披露、generation 和 single-use 的 `ConformanceExternallyMeteredUnknownConsentReceipt`；
  - 将 CandidateBilling/ConformanceResult 改成严格判别联合，允许显式 custom 的 `externally_metered_unknown` 分支完成 conformance，但不得伪装为 `covered/settled`；
  - FundingPolicyTemplate 生成后保留该模式，并把 `ExternallyMeteredUnknownConsentReceipt` 加入 runtime 发送侧 FundingDecision union；
  - 只允许用户主动、逐次调用，永不进入 no-new-spend、推荐、fallback、evaluator 或后台 health；
  - 增加从 custom key 录入、首测、`connected_verified` 到一次显式调用的正向 fixture。

### [B2] GA matrix 无法机器表达其声称负责的生态层级和多认证旅程

- 准确位置：第 2809–2826、2845、3134–3141、3310、3493、3757、3764、3785 行。
- 反例一：GA 要机械证明“全部 L0 已过门”，但 matrix entry 没有 `L0 | L1 | L2 | inventory` 字段。`requiredForGa` 不能替代层级，因为文档同时把 Gemini API 定义为 L1 production slice，又把它纳入 required 范围；`implementationPhase` 也被第 3139 行明确规定为与生态层级不同的维度。
- 反例二：同一产品可同时有不同认证旅程。OpenRouter credits 有手填 key 和 OAuth PKCE，Azure 有 API key 与 Entra；当前 entry 只有一个 `journeyTier`，也没有 `authProfileDigest` 或稳定 journey identity。实现只能压扁不同负担，或复制无法按认证维度判重的 product row。[OpenRouter OAuth 官方文档](https://openrouter.ai/docs/guides/overview/auth/oauth)、[Azure Responses 官方认证文档](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses)。
- 现有条款为何挡不住：“matrix + registry/report 生成支持面”没有定义机器可判定的 join key、唯一性、tier 来源及逐认证 journey gate；当前验收只检查现有字段，无法发现 L0 被误标、inventory 被写成支持或某一认证路径借另一条路径的 journey report 过门。
- 最小修订：为 entry 增加稳定 `entryId`、`ecosystemTier`、`releaseMaturity`、`authProfileDigest` 或非空 `journeys[]`，每个 journey 独立绑定 auth profile、journey tier、report digest 和 gate；定义包含 region/surface/auth/protocol/deployment 的唯一键及与 registry/TCK report 的 digest join。用 OpenRouter key/OAuth、Azure key/Entra 和一个 inventory/L1 分流产品做正反例。

### [B3] GA matrix 与 passive probe 的 `releaseArtifactDigest` 存在未消解的发布摘要自引用

- 准确位置：第 2688–2697、2795–2826、2845、3310、3852、4176 行。
- 反例：构建包含 `ga-ecosystem-matrix.json` 的 release archive。matrix 内要求写入该 archive 的 digest，但写入 digest 会改变 matrix，继而改变 archive digest；无法生成所声明的固定对象。若 `releaseArtifactDigest` 实际只指某个不含 matrix 的 binary，则 schema 和验收没有定义这个排除边界，离线 verifier 会得到不同解释。release-bundled passive probe 具有相同问题。
- 现有条款为何挡不住：第 2688–2697 行已经为 conformance 正确采用下层 payload 无外层引用、最外层 binding 单向绑定的结构，但 GA matrix/probe 没有复用该模式。“release digest 覆盖”与“形成 digest 闭包”只描述目标，没有定义可构造的哈希边界。
- 最小修订：让 `GaEcosystemMatrixCore` 和 passive probe core 不含 release digest，先分别 JCS 得到自身 digest；再生成 detached、签名的 `ReleaseEcosystemBinding`，单向绑定 matrix、probe capability set、registry snapshot 和明确的 distribution artifact digest。明确每个 digest 的文件集合及 manifest 排除规则，并加入自引用、替换 matrix、替换 binary 和错误 artifact-scope 的 mutation test。

### [B4] `review_ready` 被要求作为首屏状态，却没有可判定的文案和唯一主动作合同

- 准确位置：第 2173–2177、3078–3095、3666–3687、3908、3988 行。
- 反例：四槽和 evaluator 独立性刚刚满足，solution readiness 从 `conversation_ready` 升为 `review_ready`。Phase 6 要求首屏按该状态显示，且每个状态必须由纯函数返回唯一 `primaryAction`；但 §8.2 状态表没有 `review_ready` 行。实现可能得到无动作未知状态，也可能静默复用 `conversation_ready`，无法验证“独立复核已就绪”的文案及降级反馈。
- 现有条款为何挡不住：第 2175、3908、3988 行只规定达到条件；没有定义状态到 view model、主动作、次级入口和降级转移的映射，因此 DOM/a11y 与 ICU 门无法写出唯一预期。
- 最小修订：补充 `review_ready` 的唯一文案、`primaryAction` 和 `secondaryLink[]`，或明确它是独立 badge 维度并给出与 `conversation_ready` 的组合纯函数。增加 `conversation_ready → review_ready`、evaluator 失效后降级、窄屏、screen-reader 和双 locale fixture。

## C

### [C1] 同一个 `wire-budget-v1` 在两处保留互相冲突的数值

- 准确位置：第 2602、2703–2705、2729–2748、3307、3779 行。
- 反例：一个含 75,000 JSON nodes 或 5,000 occurrences 的输入，在 §4.13 的同名 v1 下被拒，在 §4.16 的同名 v1 下被接受。不同 TCK 或平台可对完全相同的 profile ID 得出不同结论。
- 现有条款为何挡不住：§4.16 声明自己是规范性闭包，理论上给出优先级，因此未直接判为 B；但 Phase 0 又写“数值以 §4.13/§4.16 为准”，旧 literals 未被标为 superseded，仍会污染 canonical 回写、N-1/N/N+1 fixture 和贡献者实现。
- 最小修订：删除 §4.13 的重复 literals，或明确标记为已废弃草图并只引用 §4.16 的唯一机器可读对象；把 headers、压缩、schema refs、CPU、wall 等所有字段合并到一个 canonical schema。增加门禁，禁止同一 profile ID 对应两套序列化值。
