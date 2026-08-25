# AI Supply reference architecture v16 最终闭包终审

## 结论

`FAIL`

- A：2
- B：0
- C：0
- PASS 条件：A=0 且 B=0；本快照不满足。

这是一份只读架构终审。目标仍是待实施蓝图；本报告没有把生产代码、canonical 回写、provider preset 或未来门禁写成已实施。

## 冻结身份与隔离边界

本轮首先核对指定 prompt：

```text
path  prompts/152-ai-supply-reference-architecture-final-closure-v16.md
sha256 9822154a3b548e751e220203f016724ac65075822babf58f5868c90f35d02cba
lines 34
bytes 5314
```

目标初检身份与 prompt 冻结值完全一致：

```text
path  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
sha256 8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da
lines 36595
bytes 2340853
repo HEAD 174ab48895aa1e4a6c6b42b9c74187f20efc3cfd
git status ?? docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

隔离说明：逐行读取了目标全文；只额外读取当前生产代码、当前 canonical 和门禁脚本以确认现状。没有打开 `prompts/` 下其他文件，没有打开 `research/codex-findings/` 既有报告，没有打开 `history/` 或旧评审。除本报告外没有写入任何文件。

## 方法与原始结果

### 1. 全文、结构与当前实现核对

- 目标按连续行区间读完 1–36595 行。
- Markdown 结构扫描结果：

```json
{
  "fenceDelimiters": 52,
  "tsFences": 11,
  "shellFences": 12,
  "balanced": true,
  "trailingWhitespaceCount": 0
}
```

- `bash scripts/check-emoji.sh <target>` 原始结果：

```text
[ok] emoji gate: clean
```

- 当前实现仍是旧合同，这与目标顶部“禁止开工”和阶段计划相符，不作为本轮缺陷重复计数：`packages/contracts/src/types/modelbinding.ts:9-70` 仍是 7 个 wired CLI 与简单 API provider；`packages/daemon/src/providers/openaiCompat.ts:64-128` 仍固定拼接 `/chat/completions` 与 Bearer；`packages/console/src/lib/setupApi.ts:64-95` 仍使用旧 setup body；`docs/09-data-contracts.md:1167-1232` 仍是当前 ModelBinding canonical。

### 2. TypeScript 5.9.3 零 stub 严格编译

从全部 11 个 `ts` fence 直接内存抽取，未注入 stub，使用 ES2023/NodeNext、`strict`、`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`skipLibCheck` 和 `noEmit`。原始摘要：

```json
{
  "typescriptVersion": "5.9.3",
  "tsBlocks": 11,
  "contractSourceLines": 33695,
  "contractSourceBytes": 1672590,
  "diagnostics": 0,
  "typeCount": 325400,
  "instantiationCount": 736964,
  "symbolCount": 391746,
  "compilerApiWallMillis": 3367.056
}
```

进程实测为 3.56 秒 real、739868672 bytes maximum resident set size；低于文档的 60 秒、2.5 GiB、900000 instantiations、2 MiB/40000 行绝对门。抽取内容若保留末尾换行是 1672591 bytes；上述 `Buffer.byteLength` 不含最后一个换行。

Compiler API 结构扫描原始摘要：

```json
{
  "anyKeywordCount": 0,
  "writablePropertySignatureCount": 0,
  "duplicateMemberCount": 0,
  "requiredNeverCount": 101,
  "requiredNeverNonComputed": 0,
  "parseDiagnostics": []
}
```

### 3. 73 行 requirement 与 exact connection oracle

Compiler API 对两个 literal SoT 做双向集合检查：

```json
{
  "requirementCount": 73,
  "oracleCount": 73,
  "requirementDuplicateKeys": [],
  "oracleDuplicateKeys": [],
  "requirementMissingOracle": [],
  "oracleMissingRequirement": [],
  "surfaceDistribution": {
    "bridge": 4,
    "control_plane": 1,
    "execution": 5,
    "inference": 63
  }
}
```

另外逐项读回 Gemini、Vertex、Bedrock、Kimi Code 和 TokenHub 特例。目标中的静态等值断言确认：Vertex `global` 为 `https://aiplatform.googleapis.com`；TokenHub Messages 业务请求为 `anthropic_x_api_key`、models 请求为 `authorization_bearer`；Kimi Code 两协议均使用 signed-distribution `User-Agent` 且禁止冒充其他客户端；Gemini/Vertex/Bedrock 的 stream path、query 和 framing 为独立 operation override。

### 4. 独立正反例编译

在目标合同尾部仅以内存追加 21 个独立断言，覆盖：plain JSON 不能恢复 receipt brand、bundled/declarative 不能包 third-party core、third-party Execution core 正向可达、cleanup 残留不能成功、cleanup 不能直跳 available、pending 不能预带 retry authority、首响应字节/publication/effect 后 fallback 不安全、evaluator proof 不能跨 generation、remote Execution 不能取 N/A、custom N/A 正例、witness 不能跨 distribution、owner raw input 不能自填 oracle/live mode、迁移五态表精确、迁移 terminal 不含 successor、automatic state 无主动作、rights 动作不可无目的地及 rights event 不可跨 state。结果：

```json
{
  "negativeAndPositiveAssertions": 21,
  "diagnostics": 0,
  "items": []
}
```

另以内存追加 5 个专门寻找本轮缺陷的断言。它们证明新增 plugin runtime lease 结构持权但不在 registry name union，同时证明 cleanup pending、cleanup verified 与 release barrier 的反向引用形状可达。结果同样是 0 diagnostics：

```json
{
  "harnessAliases": 5,
  "diagnostics": 0,
  "items": []
}
```

这第二组的 0 diagnostics 是失败证据，不是通过证据；具体根因见 A-01 与 A-02。

## Findings

### A-01：Execution plugin runtime 租约绕过权威注册表，且无法从既有已提交 dispatch lease 合法“加字段”产生

级别：A

锚点：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:849-922`：72 个 expected lease type name，没有 `ExecutionPluginRuntimeAuthorityLeaseReceiptV7`。
- 同文件 `:937-941`：允许的持权非 lease 纯 alias 只有 3 个，也没有该类型。
- 同文件 `:1040-1061`、`:1240-1321`：required-kind policy 与 lifecycle source groups 只登记 `ExecutionDispatchAdmissionLeaseReceipt`。
- 同文件 `:1496-1510`：生成物硬编码 census/lifecycle/registry 均为 80。
- 同文件 `:14756-14811`：新增 runtime lease 交叉继承 dispatch lease，另有 issuer、process-tree/IPC 身份、单 session 用途、独立 terminal 与 release tuple。

独立 TypeChecker 原始结果：

```json
{
  "authorityLeaseNameUnionCount": 72,
  "authorityLifecycleConstituentUnionCount": 80,
  "runtimeLeaseStructurallyAssignableToAuthorityBase": true,
  "runtimeLeaseNameAssignableToRegisteredNameUnion": false,
  "diagnostics": 0
}
```

AST 集合对账还得到：73 个声明名匹配 `LeaseReceipt(?:Vn)?`，expected 只有 72，唯一 extra 是 `ExecutionPluginRuntimeAuthorityLeaseReceiptV7`。原登记为 64 concrete、5 个 branch-dispatched、59 个 branch-free 与 21 个 branch constituent，共 80 项；加入这个结构持权 branch-free lease 后应为 60+21=81，而不是 80。

最小反例：

1. 先提交一个 `ExecutionDispatchAdmissionLeaseReceipt`。
2. 调用 `issueExecutionPluginRuntimeAuthorityLeaseV7`；其输入没有新的 `LeaseAuthorityInventoryReceipt`，只有已经提交且 deep-frozen 的 dispatch lease。
3. 若返回对象沿用 dispatch receipt 的 id/digest/commit envelope，再添加 activation、artifact handle、process tree 和 IPC 字段，会破坏 JCS body/digest 与 deep-freeze；若返回新 receipt identity，继承来的 authority inventory 又绑定旧 dispatch lease kind/core/token，不可能满足“inventory 精确绑定本 lease”。
4. 即使实现忽略上述矛盾强行落库，restart census、before-intent/recovery producer、after-intent domain terminal 和 release sweep 都只有 80 个 constituent；新 runtime lease 不在其中。其 bare `registeredAfterIntentAuthorityTerminal` 也不是 registry 的 `RegisteredAfterIntentDomainTerminalReceiptV5`。

因此第三方 Execution worker/process/IPC authority 可以成为 registry 外的 active lease，或者与 dispatch lease 对同一 inventory 重复终结/释放。它直接违反文档自己的 `astAndRegistryLeaseTypeSetsEqual`、exact inventory、restart sweep 和“第三方 runtime authority 已注册”承诺；Phase 0 codegen 按本文执行会在 80/81 对账处失败。

根因级修复：不得把一个已提交的 dispatch receipt 通过 intersection 再包装成另一张持权 lease。二选一：

1. 若二者真是同一权威生命周期，把 plugin runtime subject、artifact/process/IPC 约束作为 `ExecutionDispatchAdmissionLeaseReceipt` 的第三方判别 constituent，在首次提交前一次性纳入其 canonical body、inventory、action、terminal 和 release；或
2. 定义独立、带准确 literal receipt kind 和新 inventory 的 `ExecutionPluginRuntimeAuthorityLeaseReceiptV7`，把它加入 expected list、required/constituent kind policy、lifecycle source group、source annotation、逐 constituent action/terminal/release/restart producer、生成 registry 和 mutation corpus，并把生成计数改为真实值。

机械验收：

- Compiler AST 发现集、expected assertion、required policy、lifecycle policy、生成 registry 四个 key set 双向完全相等；本快照若保留独立 runtime lease，应稳定得到 81 个 constituent。
- `ExecutionPluginRuntimeAuthorityLeaseReceiptV7` 不得再由已提交 dispatch receipt 增补 canonical 字段；新 lease 的 inventory kind/core/token 必须逐字段匹配自身。
- 删除 runtime lease 的 registry row、source annotation、restart terminal 或任一 authority kind 的 mutation 必须失败。
- crash/restart fixture 在 worker 已 spawn、IPC 已建立、terminal 前中断时必须让 restart admission 保持关闭，直到准确 runtime constituent 终结或 quarantine；不能由 dispatch terminal 代替。
- 同一 inventory 的二次 release、foreign release 与 runtime/dispatch terminal 交叉换挂必须失败。

### A-02：provider 测试账号 cleanup 把 terminal 与其 successor cursor 相互引用，违反全局先提交 target 的 DAG 规则

级别：A

锚点：

- `docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md:1737-1767`、`:22929-22930`：所有 receipt edge 的 target 必须先提交，且明确拒绝实例 cycle、同序互引和 successor 反向引用。
- 同文件 `:25123-25175`：account cursor 的 `lastTransitionReceipt` 可指 cleanup terminal；`CleanupVerifiedProviderTestAccountCursorV7` 更强制指 `ProviderTestAccountCleanupVerifiedTerminalReceiptV7`。
- 同文件 `:25383-25416`：success/pending terminal 自己包含 `resultingCursor`；success 的 cursor 又强制以 success terminal 为 `lastTransitionReceipt`。
- 同文件 `:25475-25513`：authority release barrier 包含 `resultingAvailableCursor`；正常 post-cleanup available cursor 又以同一 barrier 为 `lastTransitionReceipt`。

最小反例是严格序号矛盾。令成功 cleanup terminal 为 T、其 `resultingCursor` 为 C：

```text
T.resultingCursor -> C      要求 seq(C) < seq(T)
C.lastTransitionReceipt -> T 要求 seq(T) < seq(C)
```

两式不能同时成立。release barrier B 与 post-cleanup available cursor A 同理：

```text
B.resultingAvailableCursor -> A 要求 seq(A) < seq(B)
A.lastTransitionReceipt -> B    要求 seq(B) < seq(A)
```

独立 strict harness 证明三种坏形状均为类型可达且 0 diagnostics：pending terminal 可把自己所属 terminal 类型放进 resulting cursor 的 `lastTransitionReceipt`；verified terminal 的自环可达；release barrier 的 mutual cycle 可达。对 barrier 而言，类型还允许退回 genesis available 分支以避开环，但这会抹掉 cleanup predecessor 和 barrier transition；也不是合法修复。

该问题不是普通 schema 宽松：success terminal 按 exact transition 语义没有任何满足全局 `target.committedSequence < owner.committedSequence` 的实例。于是 `cleanup_succeeded -> cleanup_verified -> authority release barrier -> available` 无法合法落库；provider live qualification 的每个 pass 都要求 `ProviderTestAccountReleasedPostRunClosureV7`，因此两轮真实账户资格及 release closure 一并不可构造。

根因级修复：按全局规则拆成单向提交链，每个 producer 一次只提交一个没有 future edge 的 receipt：

```text
cleanup terminal T
-> cleanup_verified / cleanup_in_flight successor cursor C（C 引用 T）
-> registry terminal / reconciliation / authority release barrier B（B 引用 T、C 与 release）
-> available successor cursor A（A 引用 B）
```

删除 `T.resultingCursor` 与 `B.resultingAvailableCursor` 这两条 future edge；terminal/barrier 只保存 resulting state/revision 等无环 core，后续私有 cursor producer消费已提交前驱。pending 分支的 retry authority 必须消费已提交 T 与已提交 C，然后才允许 retryStart，继续保持 `T -> authority -> retryStart` 的语义顺序。所有 generic 必须绑定同一 lease/run/asset/revision，不能用 foreign verified terminal 或 genesis cursor 逃开环。

机械验收：

- schema edge manifest 和真实 fixture 实例图都能拓扑排序；所有 edge 满足 target sequence 严格小于 owner sequence。
- 恢复 `resultingCursor`、`resultingAvailableCursor`、同序 batch 互引、foreign terminal 或 genesis escape 的 mutation 均失败。
- 在 T 后、C 后、B 后分别 kill，restart 都只能沿唯一 successor 恢复；B 前不能 available，A 前不能重新 lease。
- success、pending、quarantine 每个分支均有独立终态；residual resource/session/credential/billing 或 baseline drift 仍不能形成 success。
- 两个 release cycle 的所有 account lease 最终只落 `available-after-barrier` 或 `quarantined/retired`，且 cursor/lease/raw occurrence 集保持不相交。

## 十二轴覆盖结论

| 轴 | 结论 | 独立核验摘要 |
|---|---|---|
| 1. 两平面、协议 taxonomy 与正向第三方 core | `[ok]` | Inference/Execution plane、三核心 inference protocol、ext ID、bridge/control 分型均可达；bundled/declarative 包 third-party core 的两个反例均为 `never`。 |
| 2. canonical payload、JCS、deep readonly、edge DAG | `[fail] A-02` | envelope/body/brand/deep readonly 与字段 swap 门存在；但 cleanup 的 future edge 与全局 target-before-owner 规则直接矛盾。 |
| 3. authority 生命周期与 provider cleanup | `[fail] A-01/A-02` | provider residual-zero 与 `T -> retry authority -> retryStart` 形状存在；runtime plugin lease漏 registry，cleanup success/barrier 又不能形成无环 successor。 |
| 4. fallback 与 evaluator 同值 | `[ok]` | 非零 response byte、publication、effect 不能满足 automatic retry safety；evaluator commit bundle 不能跨 solution generation。 |
| 5. 第三方 Execution 发布、授权、sandbox、runtime authority | `[fail] A-01` | publisher/TUF/manifest/provenance/artifact/open handle/consent/policy generic 链存在；最终 runtime authority lease 却不在统一 registry。 |
| 6. 73 行 exact connection oracle | `[ok]` | 73/73 双射、63/5/4/1 分布；Gemini、Vertex、Bedrock、Kimi、TokenHub 特例静态断言与逐值读回一致。 |
| 7. live dependency 与两周期证据 | `[fail] 继承 A-02` | remote Execution/bridge 不可取 N/A，local/custom/platform 分型正确，五类集合交集均有 typed proof；但 remote provider/surface pass 依赖不可提交的 account released closure。未另增 finding。 |
| 8. remote witness 与 owner 扩展 | `[ok]` | global/china/enterprise tuple 按 distribution 与 realm 参数化；跨 distribution 不可赋值；owner raw input 不含 oracle/live 派生字段。 |
| 9. legacy JSON/SQLite 五态迁移 | `[ok]` | transition table key 与五态 union 精确相等；operation terminal 不嵌 successor，recovery authority/lease/intent/terminal/successor 分层；kill-point/fair-retry completion 均有门。 |
| 10. rights 与 typed UI reducer | `[ok]` | 5 个 automatic state 的主动作均为 `never`；rights 两分支必须带可执行 journey；跨 rights state event 不可赋值。 |
| 11. 零 stub 编译与资源预算 | `[ok]` | TS 5.9.3 strict 为 0 diagnostics、0 any、0 writable、0 literal duplicate、非 computed required-never 为 0；instantiation/RSS/wall/source 均在绝对门内。 |
| 12. Phase 0–8、1A、owner 决策、四生成物与 Definition Complete | `[fail] 继承 A-01/A-02` | 阶段、owner 前置阻断、canonical rewrite、support page/picker/test matrix/release note 四生成物均有落点；但 Phase 0 的 authority codegen 会得到 80/81 集合冲突，provider account release closure也不可构造，故 Definition Complete 不可判绿。 |

## 分级汇总与最终判定

- A-01：Execution plugin runtime authority lease 未进入统一 registry，且从已提交 dispatch lease 派生新持权 receipt 在 canonical/inventory 上不可实现。
- A-02：provider account cleanup terminal/cursor 与 barrier/available cursor 形成不可满足的 committed-sequence 环。
- B：无。
- C：无。

最终判定：`FAIL`，A=2，B=0，C=0。只有修复两个根因、重新冻结新的 SHA/lines/bytes，并让新的独立终审得到 A=0、B=0，才可 `PASS`。

## 报告落盘后目标身份终检

报告落盘后重新读取目标，结果仍与 prompt 冻结身份逐项一致：

```text
sha256 8541960c14c8b2cd3e7e87ee217580c6bc989b225c204513bd9d0aefdff126da
lines 36595
bytes 2340853
```
