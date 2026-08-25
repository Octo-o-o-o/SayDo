# AI 供给普适接入 v20 架构终审报告

## 结论

`FAIL`

- A：4
- B：0
- C：0

本报告为全新零上下文、只读、对抗性终审。审查输入仅为
`prompts/164-ai-supply-reference-architecture-final-closure-v20.md`与冻结目标
`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`；未读取旧 prompt、旧 finding、日志、journal 或其他 agent 结论。目标未被修改。

## 冻结身份

初始核验结果：

```text
SHA-256  33afc197085f92355e12272a9c45a49ce4d560715b7b7992759dac8398c83531
lines     48,809
bytes     3,022,748
HEAD      174ab48895aa1e4a6c6b42b9c74187f20efc3cfd
status    ?? docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

目标是未跟踪文件；因此“未漂移”以初末 SHA、行数和 bytes 三项相等为准，不从 Git index 推断。

## 实际方法与命令摘要

1. 用`shasum -a 256`、`wc -l -c`、`git rev-parse HEAD`和精确 pathspec 的`git status --short`锁定身份。
2. 顺序扫描目标全部 Markdown 行和全部 fenced block；以文档规定的精确规则
   `/```ts\n([\s\S]*?)```/g`抽取全部 16 个 TypeScript block，按出现顺序用两个换行连接并追加末尾换行。抽取物为 45,727 个换行、2,282,249 bytes，SHA-256 为
   `234c5ff9a0c68d691eb7547a611e2604d45930ccbaa54a4d8a93874fb810be4e`。
3. 使用 Node `v22.23.1`、TypeScript `5.9.3`，按下列锁定形态编译完整抽取物：

   ```text
   node --max-old-space-size=2048 node_modules/typescript/bin/tsc \
     --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext \
     --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess \
     --skipLibCheck --extendedDiagnostics contract-exact.ts
   ```

   完整合同五个隔离冷进程均为 exit 0；每次均为 45,728 TypeScript lines、489,891 types、809,365 instantiations。一组有效样本的 wall 为
   `4.56/4.39/4.33/4.43/4.55 s`，中位数 4.43 s，spread 51.9 permille；最大 RSS 800,129,024 bytes。绝对 60 秒、900,000 instantiations、2.5 GiB 门均通过。后续两组因机器负载波动超过 200 permille，按合同直接作废，未挑样本参与判定。
4. 用 TypeScript Compiler API 对完整抽取物遍历而非文本抽样：parse diagnostics 0；property signatures 24,806；writable property signatures 0；`any` keyword 0；duplicate property 0；非品牌 required-`never` 0。
5. 对常量和映射做全量集合审计：81 个 requirement key 与 81 个 oracle key 均唯一，missing/extra 均为 0；public producer/root 为 5/5；positive/negative fixture 为 17/25；release suite 为 37，展开 BOM 为 39 行。
6. 对每个可疑类型点把最小反例追加到同一完整合同抽取物，再以同一锁定编译参数独立编译。下列反例均真实 exit 0：

   ```text
   probe-tuf-path-union.ts             exit=0
   probe-wide-protocol.ts              exit=0
   probe-owner-union.ts                exit=0
   probe-owner-claim-omission.ts       exit=0
   probe-terminal-union.ts             exit=0
   probe-fallback-terminal-shape.ts    exit=0
   probe-event-double-terminal.ts      exit=0
   ```

## A 级 findings

### A-01 类型参数被当成运行时身份权威，union、宽模板和同型实例没有统一的失败关闭边界

冻结合同同时依赖两种互相冲突的安全模型：一方面要求 25 个 negative module 以准确 TypeScript diagnostic 失败（目标 43024-43028），另一方面又允许类型无法表达的身份关系只由一个无结构的`ImportedOpaqueEvidenceLeafReceipt`声称已比较。实际反例证明当前静态门不是安全证明；若实现按签名信任类型会旁路，若实现依赖运行时比较，则若干“必须编译失败”的验收目标不可实现。

反例一是 TUF target path。`verifyAndCommitExactTufTargetAuthorizationV20`的`P`可分别从 delegation、high-water 和 raw target 推断为联合，且没有一个单值身份锚或对其余位置使用`NoInfer`（40365-40388）：

```ts
declare const delegationA:
  ExactTufDelegationPathAuthorizationReceiptV20<Repo, "delegated:release", "distributions/a">;
declare const highWaterB:
  ExactTufHighWatermarkAdvanceReceiptV20<Repo, "delegated:release", "distributions/b">;
declare const rawA: TufRawTargetBytesEvidenceReceipt<Repo> & {
  readonly targetPath: "distributions/a";
  readonly targetDigest: "digest-a";
};

const mixed = verifyAndCommitExactTufTargetAuthorizationV20({
  repositoryIdentity: repo,
  rootAndTimeAuthorization: root,
  timestampMetadata: timestamp,
  snapshotMetadata: snapshot,
  delegationPathAuthorization: delegationA,
  highWatermarkAdvance: highWaterB,
  rawTargetBytes: rawA,
  expectedFinalRoleName: "delegated:release",
  atomicRootMetadataDelegationTargetAndHighWatermarkCommitEvidence: evidence,
});

type Accepted = ContractAssert<ExactTypeEqualV7<
  typeof mixed["targetPath"],
  "distributions/a" | "distributions/b"
>>;
```

该文件 exit 0。对照试验中跨 repository 输入会产生 TS2322，说明问题精确位于未锚定的 path，而不是探针把所有泛型都放宽了。

反例二是`AiSupplySingleLiteralV20`。它只排除裸`string`和 union（40204-40215），却接受开放模板
`ext:inference:${string}.${string}@${number}`以及`string & Brand`。因此两个运行时 protocol、digest、path 或 subject 可以有完全相同的静态类型。该开放模板可直接进入`commitProtocolImplementationIdentityV20`（41029-41038），`probe-wide-protocol.ts` exit 0。

反例三是 owner 发布链。`OwnerRequirementCompilationPointerV20`把 canonical subject固定成两个宽数组（42465-42477），因此无法从 pointer type恢复某个 compilation 的准确 owner tuple；映射后的`ownerClaims`也只是宽数组（42578-42590）。一个运行时可解析为非空 compilation 的同型 pointer，在静态上仍可与`ownerClaims: [] as const`一起传给`commitPublishedSupportClaimSetV20`，探针 exit 0。与此同时，`OwnerModeSpecificOnboardingQualificationReceiptV20`对`R["onboardingAvailability"]`做非分布式 indexed-access 条件（42391-42398）；`fresh | migration`联合输入只带一项 fresh qualification 也被接受，输出仍声称含 migration 模式，探针 exit 0。

影响：TUF rollback/mix-and-match、四类 policy component、extension conformance、owner append-only claims及 migration absence gate都可能在“类型已证明”的实现中发生换挂；反过来，如果私有 producer 正确做运行时比较，当前 compile-negative 发布真相又会出现假阳性/不可达验收。这是安全与发布闭包的 A 级矛盾。

一次关闭同类问题的最小根因修复不是继续零散补`NoInfer`，而是先固化统一权威顺序：

1. receipt resolver先验证六字段 pointer、kind、签名/commit、digest和canonical subject bytes；
2. 私有 producer在运行时重算 JCS bytes和等值关系，并对需唯一化的状态执行持久 CAS；只有它能签发不可伪造 committed brand；
3. TypeScript generic只作静态辅助，不授予安全、费用、状态或发布权限；同型实例一律按已解析 pointer/digest/canonical bytes比较；
4. 生成统一的静态 boundary gate，递归拒绝 union、裸`string`、开放 template literal、`string & Brand`、宽数组/对象和由多个参数共同反推的安全身份；一个输入是唯一推断锚，其余依赖位置统一`NoInfer`；
5. 编译负例只证明静态辅助门，另设运行时 mutation/property tests覆盖同型实例、联合变量、宽模板和跨 pointer。无法由 TypeScript区分的场景不得继续要求“必须 diagnostic”，而应要求私有 producer在零副作用前拒绝。

### A-02 物理、fallback 与 response event 的终态不是由同一持久 transition/CAS 内核裁决

三条状态链都能构造不可能终态。

第一，`ExactPhysicalAttemptTerminalReceiptV20`和 producer都使用
`S["sendState"] extends "before_send"`（41284-41346）。这是非分布式 indexed-access 条件；当`S = Before | After`时检查结果落入 after-send 分支。`probe-terminal-union.ts`把一个运行时可能是`before_send`的 subject标成`succeeded`，exit 0。

第二，`FallbackTerminalReceiptV20`不是按 disposition判别的严格 union：predecessor只是宽
`ready-cursor | attempt-start`，physical terminal是 optional，subject中也没有 predecessor/cursor revision（41518-41542）。以下“尚在 ready、没有任何 physical terminal，却宣称 physical_success”的输入 exit 0：

```ts
commitFallbackTerminalV20({
  subject,
  exactPredecessorReadyOrAttemptStart: readyCursor,
  finalDisposition: "physical_success",
  exactAggregateLedgerRange: ledger,
  dispositionTerminalCompatibilityAndHistoryVerifier: evidence,
});
```

同一签名也没有显式 single-winner cursor CAS，无法从合同上排除同一 fallback subject的两个终态。

第三，`InferenceEventIR`把`request/attempt/sequence/kind`写进 subject，但
`verifyAndCommitInferenceEventIrV20`没有 stream cursor、expected next sequence、terminal barrier或 CAS（24962-24992）。相同 request、attempt、sequence和相同 raw evidence可先后提交`terminal_success`与`terminal_error`，`probe-event-double-terminal.ts` exit 0。底层`RawResponseInventoryReceipt`只有`attemptId`，没有 request pointer/request digest（25352-25365）；event producer又只接受不带类型参数的 opaque leaf，因而 canonical graph不能机械证明 raw occurrence属于本 request/attempt/sequence。

同一 Compiler API扫描还发现 Codex refresh trigger 对`C["exactDefinition"]`使用相同非分布式模式（41684-41688、41809-41818）。这不是一个 terminal helper 的局部问题，而是 transition authority没有单一真相源。

影响：before-send可被重标为已发送/成功，fallback可零尝试成功或双终态，恶意 decoder可重放 raw evidence并产生重复/冲突 terminal；随后费用结算、重试、tool side effect和用户输出都会采用错误状态。属 A 级状态/费用/数据错误。

根因修复：从 canonical transition table生成唯一运行时内核，key至少为
`{domain, exactSubjectPointerDigest, cursorRevision}`；event另含
`{requestPointerDigest, attemptId, nextSequence, terminalState}`。每个私有 producer必须在一个持久事务内解析准确前驱、验证 branch、消费 lease/authority、CAS revision并写唯一 successor；terminal 后禁止任何 successor。TypeScript输出再由同一表生成 distributive discriminated union，producer入口先运行时窄化单一 branch并拒绝 union；fallback各 disposition必须携带准确 predecessor和必需/禁止的 physical terminal。raw frame/occurrence改为 host-owned typed receipt，subject直接包含 request pointer、attempt、frame/field sequence及 digest，不再用不透明 leaf代替内部关联。把上述三个已通过反例和 Codex refresh union都纳入同一生成式 mutation gate。

### A-03 authority registry没有从最终 AST闭合，新租约既漏 census 又存在不可构造主路径

合同宣称 authority唯一由最终 TypeScript AST派生，且当前 expected source 固定 76（984-1061），registry由该 expected tuple、alias和 policy表生成（1142-1439）。对冻结后的完整 16-block artifact做 TypeChecker结构遍历，发现 93 个声明/alias具有`AuthorityInventoryBearingLease`完整字段，而 expected tuple仍为 76。helper alias需要由编译器分类，不应直接计作新 source；但至少以下三个 concrete authority-bearing declaration既不在 expected tuple，也不在 alias-only表：

- `FallbackAttemptLeaseReceiptV20`（41423-41433）；
- `CodexCommandAuthRefreshAttemptLeaseReceiptV20`（41690-41710）；
- 冻结 artifact中仍被编译的`FallbackAttemptLeaseV19`（45470-45477）。

其中 v20 fallback lease还只是`extends AuthorityInventoryBearingLease`，没有固定
`receiptKind`和canonical subject；仓内全文也不存在`commitFallbackAttemptLeaseV20`。然而
`commitFallbackAttemptStartV20`要求调用方先提供该 committed lease（41456-41465）。所以正确实现只有两种坏结果：final-AST census按声明工作并因 expected set/policy缺项使构建失败；或继续沿用手写旧清单而把持权 lease排除在 restart/expiry/revoke/release sweep之外。fallback正向主路径本身也没有受信 lease producer。

Codex refresh lease虽有 producer（41820-41835）和完整 release tuple terminal（41837-41843），但同样没有 registry row、lifecycle source group及 restart/expiry policy，daemon crash可留下无法由统一 sweep解释的 process/network/broker/signing authority。

影响：要么公开合同/authority gate不可构造，要么实际持权资源不受完整释放、重启、过期和撤销闭包约束；两者均为 A。

根因修复：authority compiler必须以最终 package program、resolved symbol和source annotation为唯一输入，一次生成 source/alias/branch/constituent/policy/lifecycle group/edge manifest及 signed expected artifact，禁止维护一份早于后续代码块的手写权威清单。每个 concrete lease必须有准确 kind、canonical subject、私有 issuance producer、intent前关闭、intent后 domain terminal、restart/expiry/reconciliation/revoke及 exact release tuple；fallback lease producer还必须原子消费 ready cursor并签发 in-flight successor。release绑定直接消费这次 final-AST编译 receipt，任何未分类声明或无 producer/consumer/recovery路径均非零。

### A-04 性能发布合同既无法标识 43 个测量主体，也无法跨发行物滚动 baseline

方案正文要求完整合同和 42 个单 fixture模块成为分离的 measurement subject，每个各跑五个冷进程，并同时通过绝对、30% source headroom及签名相对 baseline（27511）。v20合同没有表达这项要求：

- `TypeContractSourceMetricsV20.measurementSubject`只有两个枚举值，没有 fixture ID或module path（41892-41915）；
- invocation identity的 receipt subject只有`[D, DP]`，仍没有 measurement target（41919-41938）；
- fixture qualification仅保存两组 ID/path映射、两个失败计数和一份 opaque transcript（43113-43138），没有 42 份各自的五样本 metrics/gate；
- 最外层 release只消费一个`typeContractCompileGate` pointer（43499、43543）。

更严重的是 replacement baseline把 predecessor约束为
`TypeContractCompileBaselinePointerV20<D, DP>`，predecessor passing gate也必须使用相同当前`D,DP`（42045-42066、42115-42130）。发行物 digest/path变化后，新发行物无法引用上一发行物 baseline；而 genesis authority又明确是一次性 repository initialization（41960-41974）。因此第二个发行物只能非法重新 genesis、永远复用不相关基线，或根本无法构造 performance gate。

当前完整抽取合同的绝对编译门真实通过，source bytes/lines也仍有超过 30%余量；这只能证明当前单一合同 artifact没有爆炸，不能证明方案声明的 per-fixture和相对 baseline发布闭包。

影响：后续发行物的相对回退门不可构造，或只凭一个聚合 transcript/单 gate伪装 42 个 fixture逐模块通过，形成 A 级发布假阳性。

根因修复：定义 invariant `MeasurementTarget = complete_contract | {fixtureId, modulePath}`，把它纳入 invocation、metrics、baseline namespace、cursor、gate及 TUF policy subject。replacement receipt显式区分
`predecessorDistribution`和`currentDistribution`，要求相同 target、旧 passing gate、owner批准、环境校准和单胜 CAS。fixture qualification必须包含由固定 42-ID tuple映射出的 42 个准确 gate pointer；release消费完整合同 1 个加 fixture 42 个，共 43 个 target的 exact map/set digest。runner对每个 fixture都加载同一完整合同加且仅加该模块，分别执行五冷进程；不能用 opaque transcript替代 typed per-target metrics。

## 十项逐项结论

| 审查项 | 结论 | 全量反例或证明 |
|---|---|---|
| 1. canonical pointer/wire/hydrated/public graph | `[fail]` | 六字段 pointer为 342-352；projection和 decoder均为 distributive，5 producer/5 root及对应声明全量匹配；JCS/deep-freeze基础形状成立。但 A-01 的宽/联合身份与 A-03 的 broad fallback lease破坏同源失败关闭。 |
| 2. authority与物理生命周期 | `[fail]` | AST/registry全量集合不闭合，且 physical/fallback terminal可重标，见 A-02、A-03。 |
| 3. TUF与四组件同主体 | `[fail]` | repository跨换探针被 TS2322拒绝；path联合探针却 exit 0。四组件虽保存同一`S,D`，但同型运行时实例仍必须由 canonical producer裁决，见 A-01。 |
| 4. host-owned IR correlation | `[fail]` | request occurrence/value/handle形状存在且有 typed value；response event无唯一 sequence/terminal cursor，raw inventory缺 request，双 terminal探针 exit 0，见 A-02。 |
| 5. physical/retry/fallback | `[fail]` | advance类型排除了`delivery_unknown`；但 before-send union可成功、fallback可无 physical terminal成功且无显式单胜 terminal CAS，见 A-02、A-03。 |
| 6. legacy与各域迁移 | `[ok]` | 26338-26463对 valid/invalid/unreadable做分布式 lift/quarantine；27279-27310把 inventory pointer、准确 index和结果纳入 quarantine subject。逐域旧迁移链未发现新的独立反例；Codex refresh的新 authority漏项已计入 A-03。 |
| 7. 81行、owner、claim与extension | `[fail]` | AST全量核验 requirement/oracle均为81且 key集合完全相等；owner pointer tuple擦除、migration联合与开放 extension模板失败，见 A-01。 |
| 8. 37-suite/39-row BOM | `[ok]` | 唯一 suite tuple实际 37，递归结果实际39；每行 argv为tuple且`shell:false`，success要求39个 passed pointer，failed terminal不可晋升。未发现独立漏项/重排/错前驱反例。 |
| 9. witness/platform/a11y/baseline | `[fail]` | 三真实locale加 pseudo、3平台×4 locale×3 presentation×3 viewport×3 zoom×3 modality×各平台screen reader得到972，required/pass set均有resolver和exact set digest；remote witness保留release-time comparison。baseline滚动与per-target身份失败，见 A-04。 |
| 10. TS可构造性与性能 | `[fail]` | 完整合同在锁定工具链下 diagnostics 0，AST无 writable/any/required-never，绝对性能门通过；7个最小反例全部错误地 exit 0，且43-target与跨发行物baseline不可表达，见 A-01、A-02、A-04。 |

## 最终计数与裁决

- A：4
- B：0
- C：0
- 最终：`FAIL`

阻断开工的最短依赖顺序为：先统一“运行时 canonical/private-producer/CAS为权威、TypeScript仅辅助”的裁决模型；再由该模型生成 identity/union门和 transition内核；随后重生 final-AST authority registry；最后重做43-target性能baseline与release consumer。四项完成并让本文全部反例在正确层失败后，才具备再次终审条件。

## 末次未漂移核验

报告落盘后执行；结果记录在本节最终值中：

```text
SHA-256  33afc197085f92355e12272a9c45a49ce4d560715b7b7992759dac8398c83531
lines     48,809
bytes     3,022,748
HEAD      174ab48895aa1e4a6c6b42b9c74187f20efc3cfd
```
