# AI 供给普适接入 v20 最终对抗审查

## 结论

`FAIL`

精确计数：

- A：6
- B：0
- C：0

存在安全、费用、状态、主路径可构造性及发布假阳性问题，因此未达到 reference-grade 标准。

## 身份核验

| 项目 | 初始值 | 结束前复核 |
|---|---|---|
| 目标 SHA-256 | `33afc197085f92355e12272a9c45a49ce4d560715b7b7992759dac8398c83531` | 相同 |
| 行数 | `48,809` | `48,809` |
| 字节数 | `3,022,748` | `3,022,748` |
| HEAD | `174ab48895aa1e4a6c6b42b9c74187f20efc3cfd` | 相同 |

未修改目标；未读取旧 prompt、旧 finding、journal 或过程日志。42 个 Phase 0 fixture 尚未创建未作为缺陷。

## 方法与机械证据

完整读取目标，并按原顺序抽取全部 16 个 TypeScript block。使用：

- Node `v22.23.1`
- TypeScript `5.9.3`
- ES2023 / NodeNext
- `strict`
- `exactOptionalPropertyTypes`
- `noUncheckedIndexedAccess`
- `skipLibCheck`
- `noEmit`
- `--max-old-space-size=2048`

五个独立冷进程结果：

| Run | diagnostics | types | instantiations | wall |
|---|---:|---:|---:|---:|
| 1 | 0 | 489,891 | 809,365 | 3,816 ms |
| 2 | 0 | 489,891 | 809,365 | 3,405 ms |
| 3 | 0 | 489,891 | 809,365 | 3,498 ms |
| 4 | 0 | 489,891 | 809,365 | 3,874 ms |
| 5 | 0 | 489,891 | 809,365 | 3,674 ms |

抽取结果为 45,728 行、2,282,249 bytes，但实际 SHA-256 是：

```text
99bbb2ecb8a861d5aedb1093decbf10a621dd4261e544790c800db40e08b6dd1
```

不是目标自述的 `234c5ff9…be4e`。

Compiler API AST 审计：

```json
{
  "anyKeywordCount": 0,
  "writablePropertySignatureCount": 0,
  "nonComputedDirectRequiredNeverPropertyCount": 0,
  "directNeverParameterCount": 0,
  "directNeverReturnCount": 0,
  "topLevelNeverAliases": [
    "AuthorityLifecyclePartitionViolationV20",
    "ReferenceJourneyProjectionFailureKeyV4",
    "ReferenceCustomAuthRecipeFailureKeyV4"
  ]
}
```

三个顶层 `never` 均为成功态违规集合断言，不单独构成问题。

## Findings

### A-01：泛型判别没有保持 constituent 相关性，同时造成非法分支可达和 owner 正向路径不可构造

位置：

- [目标 L41284–41347](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:41284)
- [目标 L41684–41834](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:41684)
- [目标 L37099–37119](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:37099)
- [目标 L42391–42456](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:42391)

根因是对 `S["sendState"]`、`C["exactDefinition"]`、`R["onboardingAvailability"]` 做非分布式条件判断，并以包含派生字段的默认泛型实例充当所有 owner row 的上界。

反例一：before/after 联合可提交 `delivery_unknown`：

```ts
type U =
  | (AnyPhysicalAttemptSubjectReceiptV20 & { readonly sendState: "before_send" })
  | (AnyPhysicalAttemptSubjectReceiptV20 & { readonly sendState: "after_send_intent" });

commitExactPhysicalAttemptTerminalV20({
  subject: subject as U,
  exactAuthorityReleaseTuple: releases,
  exactLedgerRange: ledger,
  outcomeAndTransportEvidence: {
    outcome: "delivery_unknown",
    transportOrProviderEvidence: evidence,
  },
});
```

结果：

```text
physical-union-before-send-to-delivery-unknown: diagnostics=0
physical-before-send-control: diagnostics=1
Type '"delivery_unknown"' is not assignable to type '"failed_before_send"'.
```

反例二：联合 credential 把 fixed deadline 挂到 retry credential：

```text
codex-fixed-deadline-attached-to-retry-credential: diagnostics=0
```

反例三：编译器合法导出的 fresh owner requirement 不满足后续公开约束：

```ts
type FreshInput = Extract<
  OwnerAdditionalRequirementInputV7,
  { readonly ownerOnboardingAvailability: "fresh_onboarding" }
>;
type FreshRequirement = OwnerAdditionalRequirementV4<FreshInput>;

type ExpectedValid = ContractAssert<
  FreshRequirement extends OwnerAdditionalRequirementV4 ? true : false
>;
```

结果：

```text
diagnostics=1
Type 'false' does not satisfy the constraint 'true'.
```

影响：before-send 可被洗成已发送未知态；Codex retry/fixed refresh 可换挂；owner 扩展正常 fresh/migration 路径无法按合同串接。

最小修复：

- 在完整泛型参数上使用分布式条件，而不是在 indexed access 上判断。
- `OwnerAdditionalRequirementV4<I>` 对 `I` 整体分布后再计算所有派生字段。
- producer 边界拒绝 union/broad constituent，并用 `NoInfer` 固定判别来源。
- 增加上述三类真实正反 fixture。

### A-02：新增 v20 authority lease 没有进入冻结的生命周期 registry，fallback 还丢失准确 kind 和 alternative ordinal

位置：

- [目标 L984–1061](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:984)
- [目标 L1441–1627](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1441)
- [目标 L41406–41445](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:41406)
- [目标 L41690–41714](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:41690)

`FallbackAttemptLeaseReceiptV20` 和 `CodexCommandAuthRefreshAttemptLeaseReceiptV20` 都持有非空 authority inventory，但不在 `AuthorityLeaseTypeNameV3` 或 `AuthorityLifecycleConstituentKeyV6` 中。前者只继承默认 `AuthorityInventoryBearingLease`，因此 `receiptKind` 仍是任意 receipt kind。

机械反例：

```text
v20-authority-leases-absent-from-registry: diagnostics=0
```

该 probe 证明：

```ts
Extract<
  "FallbackAttemptLeaseReceiptV20",
  AuthorityLifecycleConstituentKeyV6
> // never

Extract<
  "CodexCommandAuthRefreshAttemptLeaseReceiptV20",
  AuthorityLifecycleConstituentKeyV6
> // never
```

此外，advanced cursor 把 ordinal 宽化为 `number`：

```ts
type S = FallbackSubjectReceiptV20<
  "dialog",
  "D",
  "distributions/x",
  readonly ["alt-a", "alt-b"]
>;
type R = FallbackAdvancedReadyCursorReceiptV20<
  S,
  ReceiptRef<"receipt:fallback-advance@20", S>
>;
type L = FallbackAttemptLeaseReceiptV20<S, R>;

type Actual = L["exactAlternativeId"]; // "alt-a" | "alt-b"
```

结果：

```text
fallback-advanced-cursor-loses-exact-alternative: diagnostics=0
```

影响：restart sweep 和准确 terminal/release 映射无法覆盖两类新 authority；fallback 可把错误 provider、费用、rights 或 data-boundary alternative 挂到当前 ordinal。

最小修复：

- 从包含全部 v20 声明的最终 AST 重新生成 registry、source map、policy、producer、terminal 和 recovery 类型。
- 为 fallback lease 增加准确 receipt kind、subject 和私有 producer。
- 将 cursor 的 ordinal 变为 literal 泛型，并以该 literal 索引 alternative tuple。
- 禁止固定 `89` count 在新增 lease 后继续通过。

### A-03：物理 attempt terminal 接受任意 ledger range，没有同 attempt 的类型或证据边

位置：

- [目标 L13785–13842](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:13785)
- [目标 L41284–41347](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:41284)

`exactLedgerRange` 是未参数化的 `AuthoritativeLedgerRangeReceipt`；它与 physical subject 的 `domain/logicalCallId/physicalAttemptId` 没有相等约束或准确比较 receipt。

反例：

```ts
type AttemptA = AnyPhysicalAttemptSubjectReceiptV20 & {
  readonly sendState: "after_send_intent";
  readonly domain: "runtime_inference";
  readonly logicalCallId: "call-A";
  readonly physicalAttemptId: "attempt-A";
};

type LedgerB = AuthoritativeLedgerRangeReceipt & {
  readonly boundSubject: {
    readonly kind: "runtime_inference";
    readonly logicalCallId: "call-B";
    readonly ingressAttemptId: "attempt-B";
  };
};

commitExactPhysicalAttemptTerminalV20({
  subject: attemptA,
  exactAuthorityReleaseTuple: releasesA,
  exactLedgerRange: ledgerB,
  outcomeAndTransportEvidence: {
    outcome: "succeeded",
    transportOrProviderEvidence: evidenceA,
  },
});
```

结果：

```text
cross-attempt-ledger-attachment: diagnostics=0
```

影响：另一 logical call/attempt 的费用和 usage ledger 可进入 terminal，造成费用、结算及重试状态错误。

最小修复：把 ledger 参数化到准确 `BoundSubject`，由 physical subject 机械派生 ledger subject，并让 terminal 保存准确 ledger pointer及逐字段 equality receipt；增加 cross-call、cross-attempt、cross-domain 负例。

### A-04：公共 proof graph 不是自描述闭包；manifest 无法表达验收要求且根 receipt 丢弃关键边

位置：

- [目标 L43198–43220](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:43198)
- [目标 L45206–45216](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:45206)
- [目标 L43250–43313](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:43250)
- [目标 L43579–43612](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:43579)
- [目标 L46938–46940](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:46938)

v20 manifest 复用缩减版 `ReceiptNodeEdgeSchemaV19`，只能表达 kind、pointer、cardinality、简单 ordering 和一个枚举式 CAS。它不能表达验收要求中的：

- edge role
- same-value path pairs
- state-machine identity
- branch predicate
- 复合排序键
- producer DAG
- consumed/released terminal predicate

同时：

- release verifier 输入 `releaseBinding`，输出却只保留一个普通 digest string，没有准确 binding pointer；
- public operation 输入 single-use consumption commit，result 也不保留该边。

机械反例：

```text
public-proof-fields-unrepresentable-or-erased: diagnostics=0
```

该 probe 确认所有上述 manifest key 均不在 schema 中，release root 无 `releaseBinding`，public result 无 consumption commit。

影响：离线 verifier 无法从公共根遍历并重放完整证据链；不同 release binding 可被压成不可解析的 digest；disconnect/revoke 等操作的单次消费无法从结果图证明，形成发布假阳性和重放证明缺口。

最小修复：

- 新建完整 v20 edge/DAG schema，不再复用缩减的 V19 类型。
- release root 直接保留 `ExactReceiptPointerForV20<R>` 和 bootstrap root/content handle。
- public result 保留 typed single-use consumption/CAS terminal pointer。
- 签名 manifest 同时包含 field edges、same-value、state predicate、producer DAG、instance verifier 和 terminal closure。

### A-05：性能 release gate 只能证明一个测量对象，无法证明完整 artifact 加 42 个隔离 fixture

位置：

- [目标 L41892–41915](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:41892)
- [目标 L42080–42100](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:42080)
- [目标 L43499–43543](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:43499)
- [目标 L48805](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:48805)

`TypeContractSourceMetricsV20` 只有一个二选一 `measurementSubject`，`TypeContractCompileGateReceiptV20` 只有一个 `currentMetrics`，且 metrics 不带 fixture ID。release binding 又只消费一个 compile-gate pointer。

机械反例：

```text
compile-gate-cannot-encode-42-isolated-subjects: diagnostics=0
```

该 probe 证明 gate 不含任何 per-fixture collection，`currentMetrics` 是单个 record，且没有 `fixtureId`。

当前完整 artifact 本身五进程满足绝对门，但这不能证明其余 42 个隔离模块。目标自述的抽取 SHA 还与相同 45,728 行、2,282,249 bytes 的实际 SHA 不一致。

影响：release 可只测完整 artifact 或任意一个 fixture 后仍形成 passing gate，属于发布假阳性。

最小修复：

- 定义准确 43 项 subject set：完整 artifact 加 17 positive 和 25 negative。
- 每项保存 fixture ID、source digest、五进程样本和 invocation identity。
- aggregate gate 对 43 项做 exact-key bijection，再由 release 消费。
- 固定可复现的抽取算法并签名其真实 SHA；不接受只匹配 bytes/lines。

### A-06：host-origin read/decode 证据仍是结构对象，可自填 provenance 和 attempt identity

位置：

- [目标 L24928–24992](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:24928)
- [目标 L26301–26369](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:26301)
- [目标 L26457–26464](docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:26457)

`DecodeContext`、`DecodedInferenceEventProposalV20` 和 `LegacyRuntimeChildRawReadEnvelopeV20` 都是无品牌普通结构。Legacy lift 不接收 raw bytes/content handle/host-read receipt；event producer 只绑定任意字符串 `attemptId`，不接收 physical attempt pointer。

反例一：普通 literal 被接受为 `valid_v1` raw read：

```text
fabricated-legacy-valid-raw-read-envelope: diagnostics=0
```

反例二：使用真实 request pointer、但任意 `"forged-attempt"` 的 context/proposal 可生成 committed event，真实 physical attempt 不参与类型关系：

```text
event-with-arbitrary-attempt-string-no-physical-edge: diagnostics=0
```

影响：伪造的旧 JSON 读取 provenance 可进入允许 `lifted` 的结果分支；event 无法从图上证明来自同一物理 attempt，导致跨 attempt 内容、usage、terminal 或计费事件换挂。

最小修复：

- 原始文件读取结果必须由 host-only producer 生成 committed receipt，绑定准确 content handle、raw bytes digest、decoder receipt和读取 authority。
- lift 只接收该 receipt pointer，不接收普通 envelope。
- `DecodeContext` 改为 branded committed receipt，并把 exact physical attempt/send-intent pointer纳入 subject。
- `InferenceEventIR` 保留该 pointer，拒绝 broad/union attempt ID；插件只能返回 proposal，不能提供 host context。

## 覆盖矩阵

`[ok]` 表示本轮未发现独立 A/B 根因，不代表尚未实施的系统已经通过。

| 攻击面 | 结果 | 对应证据 |
|---|---|---|
| 六字段 pointer、wire/hydrated decoder | `[ok]` | 严格编译通过，pointer 保持六字段 |
| 5 facade / 5 root | `[fail]` | A-04 |
| deep-frozen、JCS、readonly、required-never | `[ok]` | 0 writable、0 any、0非品牌直接 required-never |
| edge manifest、producer DAG、instance graph | `[fail]` | A-04 |
| authority lifecycle、restart recovery | `[fail]` | A-02 |
| physical send/release、delivery unknown | `[fail]` | A-01、A-03 |
| fallback 顺序、终态、重试 | `[fail]` | A-02 |
| TUF lineage/time/high-water/distribution | `[fail]` | 内部类型未见独立问题，但公共 release 根无法遍历 binding，见 A-04 |
| Rights/Billing/Network/DataBoundary/claim | `[fail]` | ledger cross-attempt，见 A-03 |
| IR/content/event correlation | `[fail]` | A-06 |
| legacy invalid/unreadable quarantine | `[fail]` | A-06 |
| Execution/plugin/provider/external identity | `[ok]` | 未发现独立 A/B |
| Codex command auth | `[fail]` | A-01、A-02 |
| 81 行 oracle、owner fresh/migration | `[fail]` | A-01 |
| support artifacts、claims | `[ok]` | 未发现独立 A/B；最终闭包仍受 A-04 阻断 |
| remote witness | `[ok]` | 内部 qualification shape 未见独立 A/B；最终闭包仍受 A-04 阻断 |
| 972-cell a11y set | `[ok]` | 严格编译及 exact tuple 断言通过 |
| 37-suite/39-row BOM、orchestrator | `[ok]` | 未发现独立 BOM 前驱问题 |
| release binding / offline verification | `[fail]` | A-04、A-05 |
| 完整 artifact 性能 | `[ok]` | 五冷进程均低于绝对门 |
| 隔离 fixture 性能证据 | `[fail]` | A-05 |
| 当前生态事实 | `[ok]` | 未发现需新增 B 级纠正 |

关键易变事实的一手复核与目标口径一致：Codex custom provider 当前仍只支持 Responses wire，[OpenAI 配置参考](https://developers.openai.com/codex/config-reference)；Anthropic 仍限制未获批第三方提供 claude.ai 登录或限额，[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)；Gemini 个人账号迁移公告仍有效，[Google 官方仓库公告](https://github.com/google-gemini/gemini-cli/discussions/28017)；TokenHub 三协议和双站鉴权保持分离，[腾讯云官方文档](https://cloud.tencent.com/document/product/1823/130079)；LM Studio Messages 当前接受 `x-api-key` 与 Bearer，[LM Studio 官方文档](https://lmstudio.ai/docs/developer/anthropic-compat)；Ollama Responses 仍明确限制为非状态式能力，[Ollama 官方文档](https://docs.ollama.com/api/openai-compatibility)。

最终判定：`FAIL`。