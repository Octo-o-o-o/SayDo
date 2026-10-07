# RF-00 现役命令逐项效果审计(action-effect-audit)

> 目的:支撑 `docs/09-data-contracts.md` §17.2「现役命令逐项归类」表——归类按
> 真实实现效果而非命名。每条记录:入口 → 实现证据(file:line)→ 真实效果 →
> effectClass。这是目标合同下的分类核验,**不改任何路由/实现**;未列入的路由
> 不声称已归类(其余写路由归 RF-05 逐路由台账,分母 = `inventory.json`
> `http_routes`)。

## TASK_ACTIONS(daemon `POST /api/tasks/:id/<action>`)

词表来源 `packages/daemon/src/api/actions.ts`(TASK_ACTIONS 数组);

| action | 实现证据 | 真实效果 | effectClass |
|---|---|---|---|
| `review` `verdict=reject` | `operations.ts:371` `reviewTask` reject 分支 | 评审否决,任务收口不执行 | `control.settle` |
| `review` `verdict=approve` | `operations.ts:371` approve 分支 | 决策写:落 `approved_tree_sha`、冻结收叫、审计;**不执行合并**(合并只走 approve-merge/verify-merge 链) | `write.idempotent`(`expectedAttempt` CAS 防重放) |
| `review` `verdict=request_changes` | `operations.ts:371` request-changes 分支 | 同 task 新 attempt 回 `running`,由执行器认领继续执行 | `write.effect`(认领时适用派发前置与预算记账归属) |
| `cancel` | `operations.ts:283` `cancelWithAutoSettle` | 取消活跃 run;无活跃 run 直接收口 | `control.settle` |
| `retry` | `operations.ts:783` `retryTask` | 两子路径:`failed→queued` 重派发(认领时重过 worktree/预算/Gate 0 前置);`blocked→running` 向在场 run 注入应答 | `write.effect`;仅重派发子路径收新派发谓词,注入子路径不新开预算、不新消费收据 |
| `request-manual-merge` | `operations.ts:728` `requestManualMerge` | `SELECT status` 读状态 → `audit.record task.request_manual_merge` → 返回 `{handoffUrl: saydo://merge/<id>}`;**不执行合并、不建新派发、不起进程、不迁移状态** | `control.settle`(交接收口)。名字含 merge 但不是派发:不收新 Gate 0 准入、不消费收据、不新开预算 |
| `verify-merge` | `operations.ts:743` `verifyAndCompleteMerge`(经 `index.ts` 动作路由) | `execFileSync git` 只读现读 `HEAD^{tree}`,与批准时落库树比对,匹配才 CAS→`task_done` | `control.settle`(对账查询+条件收口跃迁);受信终端约束同 S3 合并链 |
| `approve-merge` | `s3Routes.ts:60` 路由、`:127` `approveMerge`、`:138` `executeMergeSegment` | 消费 `S3MergeReceipt` → `merging` + 异步执行段真合并 | `write.irreversible`;S3MergeReceipt 判别型不变(§3.3) |

## S3 面(`packages/daemon/src/api/s3Routes.ts`,§3.3 四断言先决)

| 入口 | 真实效果 | effectClass |
|---|---|---|
| `POST /api/s3/challenge` | 签发 WebAuthn 挑战(写挑战行) | `write.idempotent` |
| `POST /api/s3/register` | 注册平台凭据(写凭据记录) | `write.idempotent` |
| `POST /api/s3/verify` | 断言验签 → 签发 S3MergeReceipt | `write.idempotent`(收据签发) |
| `POST /api/s3/status` | 注册态查询(POST 仅为 Origin 断言形状,语义为读) | `read` |
| `ANY /api/s3/*` | S3 面总入口,任何业务逻辑前先过 §3.3 四断言;非四断言来源 403 | 入口谓词,不另归类 |

## 通用审批与记忆面(`packages/daemon/src/index.ts`)

| 入口 | 实现证据 | 真实效果 | effectClass |
|---|---|---|---|
| `POST /api/approvals/:id/decide` `reject` | `index.ts:1563` 路由、`:1618` `runtimeApprovals.decide`;S3 行一律拒走本口(`index.ts:1568-1574` `s3.generic_decide_rejected`) | 拒绝批准,收据终局不可消费 | `control.settle` |
| `POST /api/approvals/:id/decide` `accept` | 同上 | 决议写:收据成为可消费 | `write.idempotent` |
| `POST /api/approvals/:id/decide` `edit` | 同上;`edit` 仅本机受信终端 | 改签:新收据替换,S2 限定 | `write.idempotent` |
| `POST /api/memory/:id/approve` | `index.ts:1629` 路由 → memory ledger 晋级 | candidate→trusted 信任晋级写 | `write.idempotent` |
| `POST /api/memory/:id/reject` | `index.ts:1629` 路由 → memory ledger 否决 | candidate 否决收口 | `control.settle` |

## Brain 工具面与同用例映射(追加修复第 1 轮)

本轮重新读取 liveTools 的 32 个注册 handler,并追踪 operations、brain/tools、
summary/explain、approvalFlow 与 Focus/确认入口。下面是静态分类;不声称生产已经
实现 §17 持久幂等或统一准入。附属媒体呈现不等于业务执行,provider 调用与
任务派发的准入分别记录。授权谓词仍只来自 docs/09,此表不能授权执行。

| 工具 | 参数/状态分面 → effectClass / 新派发关系 |
|---|---|
| `addHotword` | `*` → `write.idempotent` / `none` |
| `approveAction` | `accept` → `write.idempotent` / `none`; `reject` → `control.settle` / `none` |
| `assessReadiness` | `provider` → `write.effect` / `none`; `local` → `write.idempotent` / `none` |
| `cancelTask` | `*` → `control.settle` / `none` |
| `confirmAndDispatch` | `*` → `write.effect` / `at_dispatch` |
| `confirmReadiness` | `*` → `write.idempotent` / `none` |
| `createTask` | `provider` → `write.effect` / `none`; `mechanical_fallback` → `write.idempotent` / `none` |
| `explainResult` | `provider` → `write.effect` / `none`; `local` → `read` / `none` |
| `forget` | `*` → `control.settle` / `none` |
| `getDecisionPackage` | `*` → `read` / `none` |
| `getFocusStatus` | `*` → `read` / `none` |
| `getStatus` | `*` → `read` / `none` |
| `issueDispatchReceipt` | `*` → `write.idempotent` / `none` |
| `listProjectDir` | `*` → `read` / `none` |
| `openOnScreen` | `review_url` → `read` / `none`; `editor_link` → `write.effect` / `none` |
| `promoteProject` | `*` → `write.idempotent` / `none` |
| `proposeExpectationAck` | `*` → `write.idempotent` / `none` |
| `proposeFocusAnchor` | `*` → `write.idempotent` / `none` |
| `proposeFocusRevision` | `*` → `write.idempotent` / `none` |
| `proposeLaneSplit` | `*` → `write.idempotent` / `none` |
| `proposeObligation` | `*` → `write.idempotent` / `none` |
| `proposeObligationResolve` | `done` → `write.idempotent` / `none`; `abandoned` → `write.idempotent` / `none`; `no_longer_applicable` → `write.idempotent` / `none` |
| `proposeProjectAnchor` | `*` → `write.idempotent` / `none` |
| `proposeStart` | `*` → `write.effect` / `none`;模型用量准入独立 |
| `readProjectFile` | `*` → `read` / `none` |
| `remember` | `*` → `write.idempotent` / `none` |
| `requestManualMerge` | `*` → `control.settle` / `none` |
| `resolveProject` | `*` → `read` / `none` |
| `retryTask` | `failed` → `write.effect` / `at_dispatch`; `blocked` → `write.effect` / `existing_run` |
| `reviewTask` | `approve` → `write.idempotent` / `none`; `request_changes` → `write.effect` / `at_dispatch`; `reject` → `control.settle` / `none` |
| `steerTask` | `cancel_resume` → `write.effect` / `at_dispatch`; `queued_delta` → `write.idempotent` / `none` |
| `suspendSession` | `*` → `control.settle` / `none` |

`none` 只表示不引入新任务派发准入,不代表不鉴权或不做 provider 成本控制。
`at_dispatch` 在真正派发时检查,`existing_run` 不新开预算/收据。
Focus 提议与直接用户指令可能走不同内部路径,都不是外部任务派发;
`proposeObligationResolve` 的三个 resolution 值全部登记,done 另核证据与验证态。
提议卡中的后续 accept/reject 由 live dialog/审批消费端处理,不把提议工具当接受工具。

同用例映射:

- `approveAction` 的 accept/reject 与 `POST /api/approvals/:id/decide` 共用
  approvalFlow.decide;HTTP 另有 edit。accept 写收据资格,不执行;
  reject 为 control.settle,保留 presentation/S3/身份/状态约束,不套新派发门。
- reviewTask/cancelTask/retryTask/requestManualMerge 与 HTTP 动态 action 路由
  共用 operations;TASK_ACTIONS 五项逐分面匹配。verify-merge 仅 HTTP,
  没有对应 Brain 工具。retry 按 task.status=failed/blocked 区分新派发与在场注入。
- explainResult 的 HTTP/Brain 同委托 summary/explain:one_liner/walkthrough、
  已有 decisions 或无法提炼时只读;缺缓存且有 narrative+drafter 时调用模型并落库。
- CLI 五命令没有审批、接受、拒绝、任务取消或任务恢复命令。status 为恢复查询;
  up 的 attached/available 是进程管理分支,不能映射成业务派发。
- 其它工具的 HTTP/CLI 对应关系在各项 transport_mapping 逐项标注。
  Focus HTTP 的直接写与 Brain 提议/用户显式直通不是同一个参数合同;
  后续消费端的生产迁移仍待 RF-03/05,不能凭名称强作等价。

## 检查边界

checker 从 liveTools 源码 enum 提取 decision/verdict/resolution 分支集合,
从 HTTP parsed.decision 比较提取 accept/reject/edit,要求分面 exact-set;
canonical 的机器投影固定拒绝、批准、交接、取消等已知分类。相同 operation+branch
必须跨 transport 同类且同派发关系。反例覆盖分支删除、reject 升为 write.effect、
拒绝套新派发门、HTTP/Brain 冲突、整个工具分面缺失与 HTTP 动作映射缺失。

全量分母按 inventory.json 当前值读取,不再手写旧 HTTP 169 项。
本轮只核静态合同与反例,fixture、源清单完整性和分类检查都不构成生产验收。


## 追加修复第 2 轮:模型用量与业务派发逐点复核

根因保持 `contract_effect_admission_conflation`。固定输入为
`6f652f64b469dd0653e65911d98ad80ab335c0e9`。旧 checker 在旧映射上通过;
新 checker 对仅恢复旧 proposeStart 派发关系的反例明确拒绝。源码未修改。

| 调用链/分支 | 源码证据 | 目标效果与准入 |
|---|---|---|
| createTask → BrainTools.createTask | brain/liveTools.ts:778 → brain/tools.ts:112 | thinkingProvider 存在才请求模型;无 provider 为机械复述+内存草稿写。provider 分面为 write.effect + providerAdmission,两分面均无任务派发 |
| proposeStart → drafter + 可选深评 | brain/liveTools.ts:850、866、894、911 | 模型请求后 assemble/transitionToProposed;无 dispatch。派发收据在 :976 要求包先为 proposed;不得倒置依赖 |
| explainResult → distillDecisions | brain/liveTools.ts:1131 → summary/explain.ts:133 | decisions 缓存缺失且有 narrative/drafter 才请求;缓存/规则读分开。HTTP explain 同分面 |
| assessReadiness → maybeDeepAssess → assessDeep | brain/liveTools.ts:221、1671 → evaluator/readiness.ts:221 | dims 非空且 governor 准入才调用;缓存/规则回退不请求。proposeStart 共用此链,保留调用律和异族约束 |
| 对话采访/工具环与 CLI 单发 | brain/dialogLoop.ts:22、24、632 | 三处请求含重试,模型本身有用量;解析出的每项工具动作另按自身分面授权,模型响应不代替任务派发授权 |
| setup 模型槽自检/CLI 真实一发 | api/setup.ts:1280、1528 | 本机 setup 显式授权和 provider 用量;与轻量 reprobe 分开,不要求任务包 |
| API/BYOA adapter | providers/openaiCompat.ts:259、providers/byoa/provider.ts:185 | 两个实现承接上述调用;API 绑定见 providers/resolve.ts,BYOA 付费切换资格见 providers/byoa/billing.ts,用量落账见 cost/ledger.ts;不新建授权权威 |
| confirmAndDispatch/failed retry/认领/新 run | brain/liveTools.ts:405、1056; tier1/operations.ts:783; tier1/executor.ts:1609、2094 | 目标 at_dispatch 保持;现役认领方法名为 claimNext,不是 claimDispatch。runAttempt 供给工作区并启动执行器,不能套模型准备免任务收据关系 |

上表源码路径均相对 `packages/daemon/src/`。扫描全 tracked 六语言源中
非 test/spec/e2e 的 `.chat(` 与 `async chat(`,现有 9 个请求点 + 2 个 adapter
实现点逐点摘要/操作映射保存在 semantic-claims.provider_call_sites;新增/删除/
改动调用点或失去模型准入映射均拒绝。既有全源 corpus 摘要仍守护未知别名变动,
但不声称有限词表能证明任意动态调用图。32 个工具的分面全部与 canonical
三元形状比较,不再只比较部分审批操作。未声称这些合同门已装配到生产。

模型准入对象逐字段守护 routeAuthorization/resourceOwnership/budget/billing/audit;
对四个模型工具分别变异每字段,另测对话/setup、删除调用点、新增调用点、
错误纯读/错误派发,及 confirmAndDispatch/retry/claimDispatch/run 派发门丢失。
取消/拒绝、批准、记忆的旧分支反例仍保留。验收矩阵 A 节与全部清单类分母
由同一函数生成/比较,新增 transport_registrations;旧路由数和漏类都有反例。

§17.1 的 K、墓碑与 unknown 规则保留(只将 boundReceiptId 注释限定实际派发);
§17.3–17.8 durable/owner/恢复/媒体/bridge/制品规则未改。上述静态核验与
离线 fixtures 不替代 RF/PG 的生产门,未跨合同检查点进入 PG 实施。
