# AI Supply 参考架构最终闭包 v7 独立终审

## 唯一结论

`FAIL`

本轮发现 `A=3`、`B=3`、`C=1`。按“A=0 且 B=0 才 PASS”的门槛，当前快照不能进入 reference-grade / GA 收口，也不能用 waiver 保留 reference-grade / GA 结论。

## 读取完整性与边界

- 唯一评审目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。
- 首读前与完整读完后分别核验冻结指纹；末次原始结果为：

```text
   12330  833246 docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
c0d36de218f4a6db475f000d09eb1fe5d26e57ebaab0f9224ce1bc05fb6b2b72  docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md
```

- 已按带行号分块完整读取第 `1–12,330` 行；对工具曾截断的区间另行补读，未以抽样代替完整读取。
- 未读取源码、旧 prompt、旧 review、journal、索引或其他文件；未修改评审目标；未运行仓库实现或测试。以下结论只评价该冻结文档自身能否形成可实施且可机械验收的闭包。

## 分级口径

- `A`：当前合同允许突破 credential/effect-once/授权安全边界，或让不可逆外部状态失去唯一权威归属。
- `B`：不会直接放宽安全边界，但会使 mandatory journey、恢复闭包、并发能力或明确 GA/性能承诺不可达。
- `C`：已有正确合同可依从，但同文规范叙述仍可能把施工方引向相反顺序。

## 覆盖矩阵

| 审查面 | 主要行号 | 结果 |
|---|---:|---|
| Receipt DAG、edge manifest、opaque evidence leaf、writer/anchor | 273–342、2198–2576、9512–9520 | `A-02`；其余未另立发现 |
| 状态专属 cursor / lease / terminal 与 single-successor | 407–580、795–1708、1747–2079、2940–3080、3144–4050、4297–4447、6512–6709、7028–8655、9812–10020 | `A-01`、`A-03`、`B-02`、`B-03` |
| local-control proposal / disclosure / decision / consumption | 2578–2898、9518、11029、11099、11392 | 未发现独立 A/B；消费链本身闭合 |
| OAuth、API-key PKCE、workload/static/declarative signer | 388–648、650–2079、9531–9539、11093–11100、11489–11501 | `A-01`、`A-02`、`B-01` |
| conformance、runtime、fallback 与 compute/credential descriptor | 3144–4050、4083–4261、6444–6709、8814–8827、9520–9524、11219–11255 | `C-01`；未发现另一独立 A/B |
| persistent budget、ledger correction、metadata、preload | 2923–3112、4263–4447、4876–5338、9517、9527、9640–10020、11226–11227、11258–11262、11296–11310 | `B-02`；metadata/ledger/preload 未另立发现 |
| Execution start/turn/request/tool/effect/reconciliation | 6729–8655、8828–8831、9525–9528、11370–11405 | `A-03`、`B-03` |
| GA subject、journey、attestation、release binding | 10020–10486、10980–11000、11048、11234、11524–11558 | 未发现独立 A/B |
| Phase gate、DoD、性能、供应链、扩展边界 | 9190–9649、10468–10488、11002–11755、11981–12007 | `B-01`、`B-02`；供应链和扩展边界未另立发现 |

## A 级发现

### A-01 API-key PKCE 只有逐 flow 终态，没有文档自己要求的 credential-family winner、轮换和不确定态恢复

严重度：`A`

精确行号：246；1710–1745；1747–1844；1985–2079；9535；11095；11729。

最短反例：同一 OpenRouter 账号对同一 profile 并发启动两条独立 PKCE flow。两条 flow 各自的 cursor 都能合法从 `ready` 走到 `credential_commit_pending → terminal`，并各自产生一个 `ApiKeyPkceGrantReceipt`。这里没有跨 flow 的 API-key credential-family cursor、expected winner revision、旧 key disposition 或 loser revoke，因此两个 daemon 都能提交不同 key；其中一个进入本地 active，另一个成为仍在 provider 端有效但不受本地生命周期管理的 key。更短的 kill-point 是 provider 已创建 key、exchange response 丢失：2006–2045 只允许把 flow 关成 `delivery_unknown`，没有 query/adopt/revoke/仍未知的恢复状态，用户重跑后会再创建一把 key。

为何现有设计挡不住：1747–1844 的 CAS authority只约束单条 flow；2047–2079 的 commit/grant没有共同 family identity、family cursor 或 rotation winner。`ApplicationAuth` 在 246 直接引用 immutable grant。与此同时，11095 明确要求“key-credential family 状态机”和可轮换 credential lease，11729 也把 family 列入 TCK，但正文没有可供 schema/store/TCK 实现的对应类型或转移。`singleUse` 只能防同一 lease 重放，不能在两条合法 flow 之间选唯一 winner，也不能处置 provider 已创建而本地未收到的 key。

根因级修法：增加与 OAuth family 分离的 `ApiKeyCredentialFamilyReceipt` 及 durable family cursor；browser flow 在 exchange 前取得 family rotation lease，credential commit与 `(family, expectedRevision)` winner CAS、active key version、旧 key revoke/retire disposition原子提交。为 exchange `delivery_unknown` 增加绑定稳定 exchange identity 的 recovery cursor，至少表达 `adopted_key | authoritatively_absent | revoked_orphan | still_unknown`；`still_unknown` 必须保持可再次查询而不是关死。每个物理请求只接受当前 family cursor签发的 broker lease。TCK加入双 flow、双 daemon、response-loss、loser revoke、旧 key重放和 unknown 后二次调和。

### A-02 refresh token“权威可复用”是不可遍历的自由字符串，能把已消费 token重新放回 ready

严重度：`A`

精确行号：291–342；1265–1353，尤其 1319–1328；9515；11098；11729。

最短反例：refresh 请求已到 provider，provider消费或轮换旧 refresh token后返回一个普通 5xx。生产者把 exchange terminal标成 `provider_failed`，再随便填写一个 `authoritativeCredentialReuseEvidenceDigest`。按 1319–1328，family cursor会回到 `ready`、旧 refresh credential被标为 `retained`，下一次 fresh lease再次发送同一旧 token；这会触发 refresh-token reuse、整族撤销，或在弱 provider 上形成重复 credential issuance。

为何现有设计挡不住：这是唯一允许“请求已发送但 family重新 ready”的分支，却没有 typed evidence receipt、issuer/profile、exact token family/source/version、provider response occurrence、判定算法、expiry或 verifier authority。291–342 的 manifest只能登记 `ReceiptRef` 边；纯字符串 digest不能成为 target kind、same-value path或 trust-domain edge。9515 又明确要求跨域外部证据先导入 `ImportedOpaqueEvidenceLeafReceipt`，所以当前字段与总 DAG 规则相冲突。11098/11729 只重复“必须权威”，没有给 verifier 可判定的对象。

根因级修法：把字符串替换为判别型 `OAuthRefreshCredentialReuseEvidenceReceipt`。它必须引用 exact exchange terminal、family/issuer/client/subject、输入 refresh source+version、原始 response occurrence、provider-specific reuse policy及其当前 TUF/verifier lineage，并给出短 expiry；family release的 transition predicate只能接受该 typed receipt。没有这份收据一律进入 `access_only_reauthorization_required`。增加 wrong issuer、wrong token version、expired policy、任意 digest、5xx-after-consume 和跨 family换挂 mutation。

### A-03 side-effect external request可走通用 retry/terminal分支，绕过 effect terminal并重复不可逆动作

严重度：`A`

精确行号：8205–8207；8247–8348，尤其 8280–8333；8350–8447；8594–8630；9525、9528；11390–11391。

最短反例：工具以 `requestEffect.kind="side_effect"` 和有效 `ExecutorCommitLeaseReceipt` 发送 `POST /create-ticket`。provider 已创建 ticket但返回 500。8247–8348 的 `retryable_failure + sent + advance` 分支没有把 `externalRequestLease.requestEffect` 限定为 `read_only`，所以 cursor可回到 `ready`并再次 POST，创建两个 ticket。若实现选择 `non_retryable_failure`，请求 cursor可直接 terminal，但 8396–8447 又只允许 side-effect 的 effect terminal引用 request `success`、`not_sent`或 `delivery_unknown`，于是没有合法 `committed/not_committed/delivery_unknown` effect终态，tool transition也无法安全收口。

为何现有设计挡不住：只有 8270–8279 的 `success` 分支把 side-effect强制送往 `effect_in_flight`；所有 sent failure/cancel/deadline通用分支都仍接受 side-effect lease。后置 `ExecutionToolEffectTerminalReceipt` 无法修复已经 advance/terminal 的 request cursor。9525/9528 和 11390/11391 的 prose要求 effect-once，但类型联合与它相反，当前列出的 TCK也没有具名覆盖“side-effect 已提交但 HTTP 5xx”的组合。

根因级修法：先按 `requestEffect.kind` 拆开 external terminal联合。`read_only` 才可使用通用 sent retry。`side_effect` 在任何首字节后都必须进入 `effect_in_flight`，再由 typed authority/idempotency query产生 `committed | authoritatively_not_committed | delivery_unknown`；只有 `authoritatively_not_committed` 且命中预登记 retry edge时才可回 ready，unknown只能进 `executing_unknown`。effect terminal、账务 disposition与 commit lease在同一 cursor CAS提交。增加 sent-500、sent-4xx、response-loss、cancel-after-send、权威未提交、幂等 replay和无查询能力的 mutation。

## B 级发现

### B-01 workload issuance强制非空 credential component，使 GA 必需的 managed/instance metadata identity不可构造

严重度：`B`

精确行号：388–405；471–491；5960–5976；8805；10117–10124；10167–10175；11493–11494。

最短反例：Azure Managed Identity 从本机 IMDS取 token。请求带公开的 `Metadata: true` 协议常量，但没有待发送的 application/proxy/mTLS/OAuth-client secret。471–491 却要求 `credentialComponents`、`credentialEgressDecisions`、`brokerAclDigests` 三者全部非空；5960–5976 的 component role也没有“公开 metadata header”。因此合法请求无法构造 lease，只能伪造 credential或绕过合同。AWS instance identity、Google metadata identity有同类问题。

为何现有设计挡不住：388–405 明确把 `instance_identity`、`metadata_identity`、`managed_identity`纳入同一 producer；8805要求它们走该 issuance cursor；10121和10170又把 Azure Managed Identity列为 reference-grade独立 entry/journey。请求 lease却没有 `no_credential_components` 分支或 `NoCredentialEgressProof`，与 6088–6101、6869–6883、8696–8710 已用于其他平面的精确空/非空判别做法不一致。11493的正例门也没有要求无凭据 metadata source可达。

根因级修法：把 issuance lease的 credential闭包改成严格判别联合：`credentialed` 使用非空 component/egress/ACL；`no_credential_components` 使用空 tuple和绑定 exact profile/sourceKind/endpoint/request/generation 的 `NoCredentialEgressProof`。另外把 IMDS authorization、link-local dialer/SSRF保护、hop-limit/nonce/header规则建成 source-kind-specific admission，不把公开协议常量伪装成 secret。GA/TCK至少加入 Azure Managed Identity、AWS instance identity、Google metadata identity的真实空凭据正例及“伪填 Bearer/默认链”负例。

### B-02 一个 persistent budget policy在 child终结前只能容纳一条调用，和并发流承诺不相容

严重度：`B`

精确行号：2940–3012；3028–3080；9527；11226–11227；11536；11682–11684。

最短反例：用户用一份月度持久预算同时启动两个付费对话。第一个 child lease把唯一 balance cursor置为 `child_in_flight`；第二个调用没有可接受的 `PersistentBudgetReadyCursorReceipt`，必须等第一个上游流结束并拿到 terminal ledger后才能 settlement并回 ready。若第一个流持续 120 秒，第二个请求也被串行阻塞 120 秒；100 并发流只能靠拆成100份互不共享总额的 policy，失去全局 cap语义。

为何现有设计挡不住：cursor联合明确只有 `ready → child_in_flight → settlement → ready/exhausted`，且 11227把“in-flight 二次取 lease拒绝”列为验收。余额虽然在 child lease时已经原子预留，设计仍把整个 policy锁到调用终态，错误地把“余额更新必须串行化”扩大成“所有已预留调用必须串行执行”。11536、11682–11684 的并发门没有规定使用同一 persistent policy，因此可以用无付费路径跑绿而掩盖该瓶颈。

根因级修法：余额 cursor只序列化 reservation/revocation事务；预留成功后立即生成新 ready/exhausted balance revision，同时为 child建立独立 settlement cursor，并在 policy账本维护有界 outstanding child set/aggregate hold。settlement只消费该 child，不阻塞其他已获预留的调用；revoke/expiry阻断新 reservation但保留在途最坏 hold。增加“同一 policy、100并发、逐单位总 cap不超、乱序 settlement、charge_unknown、revoke并发”的正反 model/benchmark gate。

### B-03 Execution session-start recovery的 `still_unknown` 消耗唯一 successor后没有再次查询或最终清理路径

严重度：`B`

精确行号：7195–7267，尤其 7204、7228–7232；11375–11376；11743。

最短反例：start进入 `delivery_unknown`，第一次权威 session query因临时控制面故障只能得到 `still_unknown_hold_retained`。7204要求这张 recovery receipt消费 terminal cursor的 subject-scoped single successor。五分钟后 provider恢复、已经可以证明 session不存在或关闭 orphan，但没有 recovery cursor、query lease、`predecessorRecovery`或从 `still_unknown`继续的 transition；第二张 recovery receipt会与第一张争同一 successor并被拒。session和费用 hold只能永久悬挂。

为何现有设计挡不住：四个 outcome被建成一次性 receipt的并列终点，而不是可重试 recovery状态机。`still_unknown`虽然显式 `retryPermitted: false`，却也没有用户授权的 cleanup、后台权威再查询或 ledger correction路径。11375要求 unknown 只能权威调和且不能启动第二个 session，进一步排除了绕行新 admission；11376/11743只测试四分支相交，没有测试 `still_unknown → later absent/closed/adopted`。

根因级修法：增加独立 `ExecutionSessionStartRecoveryCursorReceipt`，至少为 `query_ready → query_in_flight → still_unknown_ready | resolved_terminal`；每次查询使用短期 single-use lease和递增 revision，旧查询不能覆盖新结果。`still_unknown`保留 hold但允许经退避、当前 authority与新时间证明再查询；resolved分支再原子 adopt/close/release或settle账务。无可查询 authority的 surface必须提供显式本地控制下的 orphan处方，且未解决前仍禁止第二次 start。TCK加入第一次 unknown、第二次 absent/closed/adopted、双查询 sibling、旧查询迟到和 hold correction。

## C 级发现

### C-01 conformance 本机 compute的 prose 顺序与类型/Phase gate相反

严重度：`C`

精确行号：3334–3454；4083–4166；9524；11221–11222。

最短反例：施工方按 9524“conformance physical lease不依赖 compute proof，随后取得 peer/LocalComputeLease”的文字顺序先签最终 send lease，再补本机 peer/compute证据。这样会与 3334–3454 中 descriptor必须先含 compute closure、final `ConformancePhysicalAttemptLeaseReceipt`再聚合 descriptor的类型顺序冲突，也违反11221–11222。

为何现有设计挡不住：正确顺序已经在类型和 Phase gate中存在，因此严格按类型施工不会形成独立安全旁路；但 9524 位于“规范性闭包”章节，且使用相反措辞，会让实现、测试说明或 canonical回写产生两套解释。

根因级修法：把 9524 改成明确单向顺序：conformance的无发送权 `ConformanceAttemptIntentLeaseReceipt` 不依赖 final send lease；peer/compute lease绑定该 intent，形成完整 descriptor后才签发 final physical send lease。删除“physical lease不依赖 compute proof”和“随后取得 compute lease”的旧表述，并给该顺序一个唯一 producer-DAG fixture。

## 修复优先顺序

1. 先关闭 `A-03`，因为它能直接重复不可逆外部副作用。
2. 再以同一 credential-lifecycle工作单元关闭 `A-01`、`A-02`，并重跑 OAuth/API-key状态机和 receipt-edge mutation。
3. 关闭 `B-01` 后再宣称 Azure Managed Identity及其他无凭据 metadata source进入 reference-grade journey。
4. 关闭 `B-02`、`B-03`，加入同 policy并发与两阶段 recovery正例；不能只增加拒绝型负例。
5. 同步修正 `C-01`，避免 canonical回写重新引入 send-before-compute顺序。

## 计数与终审门

| 级别 | 数量 |
|---|---:|
| A | 3 |
| B | 3 |
| C | 1 |

唯一 verdict：`FAIL`。
