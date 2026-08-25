# AI Supply 参考架构最终闭包复核 v11

## 读取完整性

- 唯一评审目标：`docs/plan/2026-08-23-ai-supply-universal-onboarding-final.fable.md`。
- 冻结输入核验：[ok] 22,507 行；[ok] 1,363,124 bytes；[ok] SHA-256 `3b93808d641a6f2a59a1938ae6526280da1d7746dc8acf4197d030cdc6bf8ed1`。
- 已连续完整读取第 1–22,507 行；对显示层截断涉及的区间逐段重读至无缺口。没有读取仓库源码、其他 prompt、既有 review、journal、索引或其他文件，也没有修改目标。
- 落盘前最终目标复核：[ok] 22,507 行；[ok] 1,363,124 bytes；[ok] SHA-256 `3b93808d641a6f2a59a1938ae6526280da1d7746dc8acf4197d030cdc6bf8ed1`。

## 计数

- A：4
- B：2
- C：0

## Findings

### A-01 authority inventory 只覆盖最终 lease，descriptor 前已经取得的 socket、compute 与 credential lease 无可构造的逐项关闭

- 严重度：A
- 精确行号：313–377、7468–7511、7550–7567、8191–8229、8712–8749、10581–10601、21279。
- 最短反例：runtime attempt intent 后，在已连接 socket 上取得 `LocalInferencePeerLeaseReceipt`，再取得 `LocalComputeLeaseReceipt` 并写入 `PreparedAttemptDescriptorReceipt`；随后在 final physical lease 签发前因 deadline 或 crash 停止。两份 lease 都只 `extends ReceiptRef`，不含 `authorityInventory`。通用 `PreIntentLeaseClosureReceipt<L>` 要求 `L extends AuthorityInventoryBearingLease`，因此不能为这两份 lease 构造关闭；而 `PhysicalSendAuthorityRetirementReceipt` 又强制引用一个尚不存在的 `finalPhysicalAttemptLease`。连接 socket、compute ownership 或其 admission 因而没有逐 entry、单后继、可重放的释放终态。
- 同根因范围：`PreparedCredentialLeaseReceipt` 的 brokered/OAuth/API-key/workload/signing lease 集合也不是统一的 `AuthorityInventoryBearingLease`；`LanComputeLeaseReceipt` 同样只继承 `ReceiptRef`。部分签名 lease 虽声明 final lease 前不授 secret/signing authority，但 connected peer/compute 已经持有真实 socket/process authority，且 OAuth/API-key/brokered lease 没有统一的无 authority 判别。文本在 21279 行声称所有此类 lease 都实现 inventory，类型合同与该硬约束不一致。
- 现有合同为何挡不住：final lease 自身的 inventory 只能在 final lease 已提交后使用，不能追溯关闭它之前已经取得的独立 lease；`processNetworkAndStdioBytes: 0` 只是结果字段，不能释放未登记资源；generic constraint 反而使缺 inventory 的 lease 无法进入通用关闭路径。没有 descriptor-abort cursor/terminal 可以逐一消费这些 lease。
- 根因级最小修法：把“纯证明、绝不持有 authority”的对象改名并用严格否定分支表达；其余所有 pre-final socket/peer/compute/credential/broker/listener/hold lease 统一继承 `AuthorityInventoryBearingLease`。增加 `PreparedAttemptDescriptorAbortReceipt`，按 descriptor 的准确有序 inventory 对每个已取得 lease 生成 `PreIntentLeaseClosureReceipt`，并与 final-lease 创建 CAS 竞争同一 predecessor。Phase 0 生成一份穷举 authority-lease registry，类型门和 mutation fixture 对任何漏 inventory 的 lease 非零退出。

### A-02 同一个 `authorized-send-envelope/v1` 同时要求先于 bundle 和反向引用 bundle，producer DAG 无解

- 严重度：A
- 精确行号：8061–8113、10453–10471、16847–16863、17462–17463、21279。
- 最短不可达路径：按 receipt 合同先提交 `AuthorizedSendEnvelopeReceipt`，再创建引用该 envelope 的 `PhysicalSendAuthorizationBundleReceipt`，最后创建 send intent。Public SDK 的同 schema `AuthorizedSendEnvelope` 却要求 `physicalSendAuthorizationBundleDigest`。若满足 SDK 字段，envelope 必须等待 bundle；bundle 又必须等待 envelope，形成 `envelope → bundle → envelope` producer 环。若按 receipt 顺序省略该字段，则不满足公开责任接口。
- 现有合同为何挡不住：两处使用相同 schemaVersion `saydo.dev/authorized-send-envelope/v1`，不是两个有明确版本或角色的对象。`provesDescriptorPrecedesFinalLeaseBundleAndEnvelopeWithoutAnyReverseDigestEdge: true` 与实际反向 digest 字段同时存在，只是自相矛盾的布尔声明。edge-manifest/producer-DAG gate 至多拒绝该环，无法生成同时满足两份合同的实例；“Phase 0 再固化字段”也没有给实施者唯一选择。
- 根因级最小修法：从 `AuthorizedSendEnvelope` 删除 `physicalSendAuthorizationBundleDigest`，使唯一顺序固定为 descriptor → final lease → envelope → bundle → send intent。若确需 bundle 后的审计视图，创建不同 schema kind 的 detached projection，只允许它引用 bundle，且任何发送权 receipt 不得反向引用该 projection。为两个 schema 同名或 producer 环增加编译期失败 fixture。

### A-03 turn unknown 的 resolved 路径要求两个 transition 消费同一 reconciliation-in-flight revision，session terminal 不可构造

- 严重度：A
- 精确行号：13317–13360、13374–13410、14119–14135、14316–14378、14441–14444、14460–14474、14572–14592。
- 最短不可达路径：一次 physical request `delivery_unknown` 把 session 推到 `reconciliation_required`；取得 query lease 后进入 `ExecutionSessionReconciliationInFlightCursorReceipt`；权威查询得到 `authoritatively_resolved`。`ExecutionTurnUnknownReconciliationTerminalReceipt` 必须以该 in-flight cursor 为 predecessor，提交 subject-scoped single-successor CAS 并把 session state 写成 `terminal`。但 `turn_delivery_unknown` 的 `ExecutionSessionTerminalReceipt` 又必须包含 `ExecutionSessionClosedIdentityDisposition`，后者要求 `ExecutionSessionCloseLeaseReceipt`；该 close lease 的可用 predecessor 仍是同一个 reconciliation-in-flight cursor，并把同一 revision 写成 `external_close_authorized`。先提交任一者都会使另一者的 expected revision 过期。
- `cleanup_confirmed` 走相同冲突；只有 permanent-block 分支绕开 close lease，因此正常权威恢复与清理成功这两个正向主路径均不可达。
- 现有合同为何挡不住：reconciliation terminal 和 close lease 都声明/要求单后继，而没有一个 post-reconciliation、close-ready cursor；session terminal 同时要求两份互斥 sibling 的存在。布尔 `proves...Exact` 不能让同一 predecessor CAS 出两个不同 successor，也没有原子复合 transition 类型把二者定义成一个 successor。
- 根因级最小修法：为 `authoritatively_resolved | cleanup_confirmed` 增加唯一的 `ExecutionSessionReconciledCloseReadyCursorReceipt`。reconciliation terminal 单次 CAS 到该 cursor；close lease 只从该 cursor 取得并继续 external-close 链。`still_unknown` 仍回 required，permanent-block 仍直接 terminal。TCK 必须覆盖 query-resolved、cleanup-confirmed、still-unknown 和 permanent-block 四条正向路径，并注入“同 revision sibling close/reconcile”负例。

### A-04 61 行最低真相把 `custom_secret_header` 绑定到不含 header 名和值的 recipe，核心 onboarding journey 不可达

- 严重度：A
- 精确行号：19124–19125、19137–19205、19268–19282、19410–19411、19434–19460、19532–19549、20520、21158。
- 最短不可达路径：选择 requirement `custom.secret-header`。唯一 `onboardingRecipe` 是 `RECIPE_CUSTOM_ENDPOINT_V1`，它只要求 base URL、protocol、model，并提供可选 `api_key`；没有 `custom_secret_header_name` 或 `custom_secret_header_value`。由最低真相生成的 UI 无法收集规范 header 名或 secret broker value，因而不能达到该行声明的 `header_policy_verified` 与 `secret_broker_handle_ready`。实现若临时补两个字段，又会在 61 行 requirements 之外制造第二份 recipe 真相。
- 现有合同为何挡不住：字段枚举已经定义两个 custom-header field，但没有任何 recipe 使用它们。critical requirement key/recipe assertions 不包含 `custom.secret-header`；derivation receipt 只统计空 recipe 和非法 field source，没有验证 `authKind` 与必需字段集合的条件对应。因此 61、digest、unique subject 和编译期关键断言都可以全绿，同时该 journey 仍不可实施。
- 根因级最小修法：新增专用 `RECIPE_CUSTOM_SECRET_HEADER_V1`，至少必填规范化 header name 与由 manual secret broker entry 持久化为 handle 的 secret value，并把 requirement 改绑该 recipe。增加映射型 invariant：`authKind: custom_secret_header` 当且仅当 recipe 含这两个字段，且禁止用 `api_key` 代替；deriver、GA journey gate 与 N-1/N/N+1 mutation 都验证该条件。

### B-01 publisher fairness 的负数/正数舍入定义与“toward zero”互相矛盾，独立 evaluator 没有唯一 oracle

- 严重度：B
- 精确行号：17574–17596、17645–17676、17758–17776、17833–17850、20519。
- 最短反例：令 normalized debt 为 `-1/12` worker-ms。数学 `floor(-1/12)=-1`，但 toward-zero 结果为 `0`；令 debt 为 `+1/12`，`ceil(+1/12)=1`，toward-zero 仍为 `0`。17593 行的 literal `ceil-positive-and-floor-negative-toward-zero-after-divide-by-12` 同时指定了两组不同结果。实现与 reference evaluator 分别采用其中一种时，边界 debt/service-curve 判定可差 1 worker-ms。
- 现有合同为何挡不住：全部运行时 recurrence 保留 twelfths 是明确的，但 profile 又要求 normalized debt 上限与 service-curve window；`rounding_drift` mutation 的正确答案依赖这条含矛盾的 oracle。digest 与 `proves...` 只能证明各自重放，不能决定哪种舍入是规范结果。
- 根因级最小修法：用可执行整数公式替代自然语言，例如若确为 toward zero，固定 `q = sign(x) * floor(abs(x) / 12)`；若要远离零则明确写另一公式。把 `-13,-12,-11,-1,0,1,11,12,13` 及 debt clamp N-1/N/N+1 固定为 golden vectors，让实现和独立 evaluator 读取同一版本化算术 profile。

### B-02 discovery SDK 有三个 capability mode，但 conformance subject 折叠为两个，静态文件与被动 loopback 报告可互借

- 严重度：B
- 精确行号：16727–16740、16869、17225–17247、17329–17368、21363、21606。
- 最短反例：同一 detector artifact/config generation 为一个本机服务同时实现静态配置发现和 host-owned loopback metadata 发现；复用相同 provider scope、environment、provenance 和 budget digest。SDK 将它们判别为 `static_filesystem` 与 `passive_loopback_metadata`，但两份 conformance semantic subject 和 flat report 都只能写 `discoveryMode: "passive"`。因此通过零 packet 静态 fixture 的报告可以挂到需要 loopback GET/HEAD、peer admission 和网络预算的 capability，类型和 flat-to-semantic equality 都看不出 mode 变化。
- 现有合同为何挡不住：`candidateKind` 表示候选类别，不表示证据取得 capability；opaque budget/provenance digest 也没有条件类型保证二者不同。`proves...EqualSemanticSubjectExactly` 只会证明 flat 字段等于已经折叠后的 subject，无法恢复丢失的第三态，直接违背 21606 行“前两者不能互相冒充”的门禁。
- 根因级最小修法：让 semantic subject 与 flat report 都使用与 SDK 完全相同的三态判别 `static_filesystem | passive_loopback_metadata | explicit_active`，并为每态加入 `required`/`never` 字段：静态零 packet/零 subprocess；loopback 的 release-bundled capability、peer admission、literal address/method/path/byte budget；active 的用户决定与 sandbox canary。增加三对 cross-mode splice mutation。

## 14 项覆盖矩阵

| # | 覆盖主题 | 复核结论 |
|---:|---|---|
| 1 | receipt DAG、edge manifest、epoch/revision/CAS、anchor/TUF、跨 subject 与正向可达 | A-02 发现同 schema producer 环；A-03 发现同 revision sibling CAS。其余 anchor/TUF/edge-manifest 结构未构造出独立阻断反例。 |
| 2 | 全部 authority lease inventory 与 before-intent closure | A-01：pre-final connected peer/compute/credential authority 不在通用 inventory/closure 域。 |
| 3 | descriptor → final lease → bundle → intent → 首字节及 unused/零字节关闭 | A-02：Public SDK 把 bundle digest 反向写回 envelope；A-01：final lease 前失败无关闭链。 |
| 4 | workload/OAuth/API-key 物理 step、cursor、intent、terminal、旧 credential、delivery unknown | 逐段检查相关联合与物理 step；A-01 覆盖 credential/callback authority 的系统性 inventory 缺口，未发现另一独立根因。 |
| 5 | persistent budget escrow/correction/finality、horizon、late correction、100 并发 | 单后继与 escrow/finality 分支可表达；其 authority-hold lease 的 inventory 缺口并入 A-01，未另拆同根因。 |
| 6 | restart 五 stage、清理、safe retry、query、direct/reconciled success | 五 stage 与 direct/reconciled 判别已出现；process/listener/network pre-intent inventory 的共同问题并入 A-01。 |
| 7 | `SupplySolutionReceipt.slots` 唯一四槽与 anti-splice | slots 是唯一四元 tuple，template 到 advance 保留同一 `invokedSlot`；未构造出额外阻断反例。 |
| 8 | Execution identity、close/turn CAS、close retry、turn query/cleanup | A-03：resolved/cleanup 成功与 close 争用同一 in-flight revision，主路径不可构造；authority inventory 同时受 A-01 影响。 |
| 9 | raw response/evidence/manual result 与真实 send chain | 模型/tool raw inventory、decoding/loss、权威/advisory extraction 和四类 result source 均有判别；未发现独立于 A-01/A-03 的阻断反例。 |
| 10 | remote witness production qualification | 24 小时、逐 member 288 runs、双 observer、quorum/quantile、七类 fault 与 raw corpus replay 均有合同字段和 release 绑定；未发现阻断反例。 |
| 11 | publisher fairness 递推、rounding、actual service、reservation、restart、第 5–9 分支 | B-01：唯一舍入 oracle 自相矛盾；其余 twelfths recurrence、actual-service、reservation、cohort/restart 结构已覆盖。 |
| 12 | 61 requirements、derivation、critical assertions、V1/V2、GA gate | 实数核对为 61 且 requirementKey 无重复；A-04：custom secret-header 的 auth-to-recipe 条件未进入最低真相与编译门。 |
| 13 | discovery conformance mode/budget/provenance/environment/artifact/config/provider scope | B-02：三种执行 capability 被 conformance subject 折叠为两态，静态/loopback 可互借。 |
| 14 | control/data plane、热路径、迁移回滚、隔离、可观测恢复、Phase/TCK 对应 | Phase/TCK 覆盖面广，但 A-02、B-01、B-02 说明 schema/算术/mode 的 oracle 尚未与门禁一一闭合，当前不能作为机械放行合同。 |

## 唯一 verdict

FAIL

存在 4 条 A 与 2 条 B；在 authority 关闭、send producer DAG、Execution unknown 收口、最低 onboarding 真相、fairness oracle 和 discovery conformance subject 修复并由正反 fixture 证明前，不满足最终闭包条件。
