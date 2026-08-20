# 23 · A3-armed 设计方案评审（就绪门证据绑定语义）

## 结论（方案可行 / 需修）

**结论：核心方向可行，当前方案需修；A3 暂不能关闭，也不应按本稿直接 armed 生产。**

评审实际读取到的对象不是任务正文所称 v1.0，而是磁盘上的
`research/2026-07-28-a3-armed-design.md` **v1.1**（sha256
`42b314fca1730797dcfc1d005fdabb00d60c850a000ab724dcf8fd856b3d9483`）；实施参照点是 SayDo
`31e42e29c4197a3e5d3380c9a4b20f0c0d5334bd`。以下裁决均以这两个实读基线为准。

“显式 `readinessKey` + 当前记忆投影现算 + provider 强制注入 + fail-closed”是正确骨架；
v1.1 也已经修正了两个重要问题：拍板不能只信冻结 assessment，以及非 critical 缺口不应阻塞。
但它尚未建立“用户话语支持 claim、且 claim 确实满足该 readiness key”的可信绑定，也没有把
支撑证据的版本绑入 `readinessRef`。因此 Brain 仍能借任意用户轮把 critical key 刷成 covered；
同一 key 换证据也能绕过 proposed 包的 stale 检查。更严重的是，方案把现势复核放在
`issueDispatchReceipt`，却明确豁免其后到真正 dispatch 的窗口；这不是可靠的撤销线性化点。

本轮确认 **5 项 A 级硬伤**：

1. 三／四闸只证明“有一个用户轮”，不证明 claim 或 key 语义，且生产深评仍为空；
2. `covered: string[]` 没有证据版本，挡不住同 key 换证、冲突证据和清单演化；
3. forget 与派发的线性化点放错，pending receipt 到消费入队之间存在 TOCTOU；
4. pending 豁免仍允许“零采访出普通 DecisionPackage”，与目标和 canonical 必填 ref 冲突；
5. 回退方案会重新 fail-open，且没有处理存量 coding 项目零 `readinessKey` 的激活冲击。

实跑当前基线：

```text
pnpm --filter @saydo/daemon exec vitest run \
  test/readiness-skeleton.test.ts test/live-wiring.e2e.test.ts test/memory.test.ts

readiness-skeleton 16/16 passed
live-wiring.e2e 13/13 passed
memory 18/19 passed
总计 47/48，exit 1
```

memory 唯一失败发生在崩溃注入子进程应返回 `SIGKILL/137` 的夹具断言；本沙箱直接运行该
`tsx` 子进程得到 `listen EPERM .../tsx-501/*.pipe`，所以这不是 A3 行为绿灯或红灯，本文不拿它
支持任何方案结论。现有 29 个 readiness/live 绿灯只证明当前未 armed 基线与既有测试一致，
不覆盖下述攻击链。

## A 级硬伤（必修）

### A-1 · `readinessKey` 仍由 Brain 自证，三／四闸可被任意用户轮绕过

**问题**

当前四闸验证的是 key 在词表、当前轮存在、Brain 自报的 trust 在枚举内、projectId 由 daemon
自取；它们没有验证两条真正决定 covered 的语义关系：

1. 当前用户轮是否支持所写的 claim；
2. 该 claim 是否足以覆盖所标的 `readinessKey`。

所以 Brain 可以在用户只说“嗯”“继续”或任何无关内容时，连续调用 `remember`，给 coding
的 `goal/acceptance/scope/codebase_understood` 各写一条 claim。更隐蔽的绕法是把用户原话
“用蓝色”原样写成 claim，再错误标成 `goal`：即使以后 `semanticSupport` 正确判断“原话支持
claim”，也仍未判断“claim 满足 goal”。同一用户轮还能被重复用于全部 critical key。

`trust=user_stated/user_approved` 目前也不是“人背书证明”，而是 Brain 可传的枚举。
`user_approved` 没有绑定 daemon 签发的确认 presentation/receipt、被确认的 claim digest 和
readiness key，不能作为独立的人类背书。

**证据**

- 方案自己承认“Brain 在用户任意轮自报 trust=user_stated 落编造 claim，机械层无法判定语义
  一致性”，并把生产仍为空的深评留给 A5-armed：
  `research/2026-07-28-a3-armed-design.md:15,28-37,112-115`。
- 方案拟议的深评谓词只有“该用户轮上下文是否支持该 claim”，没有
  `claimSatisfiesReadinessKey`：
  `research/2026-07-28-a3-armed-design.md:37`。
- 当前 `remember` 的 `claim` 和 `trust` 都来自模型参数，daemon 只补
  `source={kind:"user_utterance",ref:ctx.turnId}`：
  `packages/daemon/src/brain/liveTools.ts:797-830`。
- 当前信任分类器对 `requestedTrust=user_stated/user_approved` 直接原样返回，没有人类确认
  artifact：
  `packages/daemon/src/memory/classify.ts:61-68`。
- 当前生产深评 `dims` 回调恒空：
  `packages/daemon/src/index.ts:961-975`。
- canonical §4.1 的 `semanticSupport` 是 claim↔source 支持关系，不是 claim↔checklist key
  分类关系：
  `docs/09-data-contracts.md:317-337`。

这不是只针对“蓄意恶意 Brain”的理论攻击。owner 已经实测“编造调研内容”；一次普通模型
归纳错误、错贴 key 或重复工具调用就足以命中同一路径。只有 audit 痕迹意味着事后可追责，
不意味着事前不能出包。

**修法**

1. 新增一等合同（名称可调整）：
   `ReadinessEvidenceBinding{projectId,readinessKey,memoryEventId,claimDigest,
   sourceSnapshotId,sourceTurnDigest,attestationRef?}`；不能只在 audit meta 留一个文本 digest。
2. critical key 进入 covered 的谓词必须同时满足：
   `sourceSupportsClaim=supported ∧ claimSatisfiesReadinessKey=supported`。深评输入须同时包含
   key/label、claim、用户轮摘录，两个原始维度独立持久化；任一缺失、unclear、调用失败均回
   unknown。
3. **所有 critical 绑定必须验，不得只“优先抽查”或采样。**非 critical 才可按预算抽查。
   如果 A5-armed 本批不接生产，则本批只能命名为“可追溯绑定基础”，不能宣称 A3-armed 或
   关闭 owner 的编造问题。
4. `user_approved` 必须由 daemon 的封闭确认流程产生，并绑定
   `{projectId,key,claimDigest,presentation/receipt}`；Brain 不得直接选择这个 trust 值。
   `user_stated` 可保留，但必须过上述双谓词。
5. 若要保持纯机械、零模型路径，可由 daemon 的采访调度器先固定“本轮正在问哪个 key”，再把
   用户回答与该 key 绑定，并对提炼摘要做一次封闭复述确认；不能让 Brain 任意选 key。
6. 反例至少补：无关用户轮刷 key、同一轮刷全 critical、原话 claim 贴错 key、
   `user_approved` 无确认 artifact、深评不可用、双谓词任一失败。

### A-2 · 没有证据版本：同 key 换证、冲突与 checklist 演化都不会 stale

**问题**

v1.1 把现势复核收窄为“逐个旧 assessment dim，看当前 covered set 是否仍含同一 key”。
这只有每 key 一位布尔状态，不是 Codex 22 要求的“证据版本”。

最小绕过链：

1. `mem_A(goal="导出报表")` 使 `goal` covered，系统据此产包 P；
2. P proposed 后 forget `mem_A`，再写入 `mem_B(goal="改成搜索")`；
3. 当前 covered 集前后都含 `goal`，旧 assessment 与现势都是 `goal=verified`；
4. v1.1 的 per-key state 比对通过，按旧目标起草的 P 仍能派发。

若同 key 同时存在两条互相矛盾的 active claim，当前“去重集”也会把冲突压成一个
`covered=true`。方案只在 instructions 里要求“先 forget 旧 claim 再记新”，既没有 key 级
CAS/supersedes 约束，当前生产也没有注册 `forget` live tool；这个纪律不能作为系统保证。

同一算法还无法兑现方案反例 10。它只遍历旧 assessment 的 dims；清单新增 critical key、
删除一个原为 unknown 的 key、或在同 key 上修改 `critical/axis/label`，都可能保持旧 per-key
state 不变而通过。

**证据**

- provider 形状仍是 `{covered:string[]}`，`readinessDimsDigest` 只签
  `{text,critical,state}`，不含支撑 `memId/claimDigest/sourceDigest`：
  `packages/contracts/src/readiness.ts:64-99`。
- 方案拍板复核明确只按旧 dims 解析 key、比较 state：
  `research/2026-07-28-a3-armed-design.md:44-47`。
- 方案同时宣称“任何不一致”都会拒、清单加 critical 会 stale，但上述算法没有全量当前
  checklist 对照：
  `research/2026-07-28-a3-armed-design.md:46,109-110`。
- 当前投影的有效性规则实际还包括 `invalidate`、`forget_soft/hard`、`supersedes`、
  `expiresAt`，而方案公式只写“未被 forget”：
  `packages/daemon/src/memory/ledger.ts:215-259` 对照
  `research/2026-07-28-a3-armed-design.md:21-26,86`。
- canonical/模块已声明新 user_stated 覆盖旧值、invalidate/forget/expiry 即时生效：
  `docs/modules/b-memory.md:7-9`；方案没有给 readiness 域对应的冲突与版本选择规则。

v1.1 删除“foundation generation 变化就让用户亲述 claim 失效”这个决定本身是合理的；
用户亲述需求不应因代码重新奠基自动消失。问题在于它同时删掉了所有版本承载，却没有换成
per-key evidence version，因而仍不满足 Codex 22 ①。

**修法**

1. provider 不返回裸 set，改为确定性、排序后的版本向量，例如：
   `ReadinessEvidence{checklistDigest,bindings:[{key,supports:[{memId,claimDigest,
   sourceTurnDigest,attestationDigest}]}]}`。
2. assessment 持久化 `checklistDigest + evidenceDigest`（或等价完整向量），
   `readinessRef` 同时绑定它们；二者进入 `DecisionPackage.digest`。
3. 拍板／派发时从**当前 type 的完整 checklist**重新生成 skeleton，比较完整
   checklist digest、每 key state 和支撑证据指纹，禁止只遍历旧 dims。
4. 精确定义 eligible claim = 当前 active 投影：排除 invalidate、forget_soft、
   forget_hard、被 supersede、已过 expiresAt；限定 `projectId` 精确等于当前项目，M0/其他项目
   不得覆盖项目 readiness。
5. 定义同 key 多 claim 的规则：互相冲突或无法确定新旧时必须 `unknown/conflicting`；更新走
   `supersedesMemId`/key 级 CAS，不能靠 prompt。把 `forget` 或等价 correction/supersede 工具
   接入 live 路径。
6. 新增同 key 换证、忘 A 加 B、双 active 冲突、invalidate、supersede、expiry、清单
   add/remove/critical/axis/label 变化的反例。

### A-3 · 现势复核放在 pending receipt 签发点，真正 dispatch 仍可消费已撤销证据

**问题**

方案把 `issueDispatchReceipt` 称作“拍板门”，并规定该点以后到 dispatch 的 receipt TTL
窗口不再复核。但当前链上 `issueDispatchReceipt` 只是创建 `outcome=pending` 的收据并播确认句；
用户下一轮命中封闭肯定词后，`dispatchApprovedPackage` 才消费收据、把包置 approved、建 task
并入队。真正的副作用线性化点在后一个 SQLite 事务。

因此存在直接缝隙：

1. issue 点检查通过并签发 pending receipt；
2. 另一个会话／屏幕操作 forget 或 supersede 关键证据；
3. 用户随后确认，或既有 accepted-pending 收据走补发；
4. dispatch 不重验 readiness，照常把旧包入队。

这时 forget 明明先于 dispatch 完成，任务却仍基于被撤销证据启动，不能称为“撤销即传导”。
“窗口很短”不是并发合同；receipt 默认 45 秒，且现代码明确支持 accepted-pending 的补发消费。

**证据**

- 方案明确选择“收据签发后到 dispatch 不重验”：
  `research/2026-07-28-a3-armed-design.md:44-48`。
- 当前 `issueDispatchReceipt` 只插入 pending 收据：
  `packages/daemon/src/approvals/issue.ts:51-75`。
- 当前 live 链在之后的 `dispatchApprovedPackage` 事务里才消费收据、approve 包、建 task、入队：
  `packages/daemon/src/brain/liveTools.ts:203-277`。
- `issueDispatchReceipt` 与 `confirmAndDispatch` 是两个工具／两个时点：
  `packages/daemon/src/brain/liveTools.ts:477-571`；当前 live e2e 也用三轮明确验证
  “签发确认句 → 下一轮可以 → queued”：
  `packages/daemon/test/live-wiring.e2e.test.ts:209-240`。

**修法**

1. issue 点可保留一次预检用于尽早反馈，但**权威现势复核必须移入
   `dispatchApprovedPackage` 的同一 SQLite 事务**，与 receipt consume、package approve、
   task insert/queue 原子化。
2. 事务内重算 A-2 的完整 checklist/evidence version；不一致则不消费收据、不 approve、不建
   task，返回 `readiness_stale`。收据应进入明确的 `superseded/voided_by_evidence_change`
   终态或保持 pending 后立即终局，不能留作再次补发。
3. forget/correct 与 dispatch 使用同一数据库事务边界。序列化语义定为：
   - forget 先提交 ⇒ dispatch 复核失败；
   - dispatch 先提交并已创建 task ⇒ 后续 forget 不追溯已启动任务，进入验收／Plan Delta
     处理。
4. 补两序并发反例、issue 后 forget 再 accept、accepted-pending 补发前 forget、provider 在
   dispatch 事务内 throw 的反例。只有这样，“dispatch 后 forget 不追溯”才有无歧义边界。

### A-4 · pending 豁免保留了“零采访出普通包”，也打破 proposed 起必有 readinessRef

**问题**

owner 已裁决保留“pending 可先出首个提案、不可派发”，这个产品决策应尊重；但 v1.1 的实现
形态是让 `type=pending` 直接跳过骨架门，以普通 `DecisionPackage` 进入 proposed，且不带
`readinessRef`。这有三重冲突：

1. 本方案目标写的是“采访不足 ⇒ 机械出不了包”，owner dogfood 症状正是“零采访出包”；
   pending 是每个新会话的缺省类型，故这不是边角例外，而是首日主路径。
2. canonical 与 modules 当前都规定 proposed 起 `readinessRef` 必填；同一实体不能一边必填、
   一边靠项目类型暗中豁免。
3. 10 #10 对普通决策包使用“我这边评估过了，可以开始了”。pending 包若复用同一读取／口播面，
   即使派发侧最终拦住，也会继续复现“系统没采访却声称已就绪”的用户可见错误，并可承载 Brain
   编造的调研、范围与验收内容。

**证据**

- 方案目标：
  `research/2026-07-28-a3-armed-design.md:11-15`。
- pending 豁免明确“不走骨架门、不产 readinessRef”：
  `research/2026-07-28-a3-armed-design.md:55,87,106`。
- canonical `DecisionPackage.readinessRef` 注释写 proposed 起必填：
  `docs/09-data-contracts.md:97`；模块 A6 同样写“proposed 起必填”：
  `docs/modules/a-dialogue.md:57-60`。
- canonical 普通就绪包话术：
  `docs/10-voice-ux-spec.md:38-43`。
- 当前 readiness 测试自己承认 armed 下 pending 会被 template-missing 拦，所谓 pending
  propose 正例只能手工直插包，尚未走真实 `proposeStart`：
  `packages/daemon/test/readiness-skeleton.test.ts:260-289`。

**修法**

在不推翻 owner (a) 案的前提下，二选一：

1. **推荐：拆实体。**pending 阶段产
   `ProjectTypingProposal`／`proposalKind:"project_typing"`，只含拟定类型、暂定目标和待补问题；
   它不是可执行 `DecisionPackage`，不进入普通 proposed 状态机、不出现 #10“可以开始了”话术，
   也不能签发 dispatch receipt。promote 后重新采访并生成全新、带 readinessRef 的
   DecisionPackage。
2. 或给 pending 定义最小独立 checklist（至少类型意图、粗目标、用户确认），照样产版本化
   readinessRef；promote 后 checklist/type digest 改变，旧提案必 stale，重新组包。

无论选哪案，都不能让普通 proposed DecisionPackage 无 ref。补“新会话零采访不会出现 ready
话术／普通执行包”的产品行为反例，而不只是“最后 dispatch 会拒”。

### A-5 · 回退方案会重新 fail-open，激活也没有存量 coding 项目的安全迁移门

**问题**

方案第三段要删除 null 旁路、删除 `ready,dims:[]` 回退并把 provider 变为 required；但回退
方案又写“只回滚 index.ts 注入一行即回未 armed”。两者在实现上自相矛盾：第三段落地后，
去掉注入要么类型／启动失败，要么按新语义全量 `gap_critical`，不可能恢复旧行为。更重要的是，
即使技术上能恢复，回到 unarmed 就是重新打开本批要关闭的 A 级安全漏洞，属于 fail-open 回退。

激活面的另一半也缺失：所有历史 memory event 都没有 `readinessKey`。provider 一上线，既有
active coding 项目会被视为零覆盖，即使 Context Pack 里已经有目标／范围／验收信息，也会要求
重新确认四个 critical key（含每单都要人工确认的 `codebase_understood`）。这是安全上合理的
fail-closed，但方案只有“改 e2e 主链”一句，没有存量盘点、引导重绑、可用性门和回滚口径，
很容易把 owner 当前 coding 主路径整体拦死。

**证据**

- 恒 armed、删两条回退：
  `research/2026-07-28-a3-armed-design.md:50-56,93`。
- “回滚第二段注入点一行即回未 armed”：
  `research/2026-07-28-a3-armed-design.md:95`。
- 当前生产 composition root 确实以
  `readinessEvidence=undefined` 条件装配整条链：
  `packages/daemon/src/index.ts:922-940`。
- 当前 `skeletonGate` 的 null 旁路与 `assessReadiness` 的空 dims 回退仍在：
  `packages/daemon/src/brain/liveTools.ts:150-164,875-900`。
- 当前专项外还有 `live-wiring.e2e`、`t2-thin` 等 `registerLiveTools` 组装点；至少
  `live-wiring` 的 nominal 派单主链没有 keyed interview：
  `packages/daemon/test/live-wiring.e2e.test.ts:109-240`。

**修法**

1. 回退只能 fail-closed：保留 provider 与硬门，出现生产问题时进入“可继续采访／查看，但暂停
   propose/dispatch”的维护态，给出处方化话术；绝不能退回 `ready,dims:[]` 或 null 放行。
2. 分两步上线：先发布 additive schema/写路径/instructions 和观测，完成真实 keyed interview
   dogfood；再原子开启硬门并同时删除旁路。激活前跑一次存量盘点，列出每个 active coding
   项目缺哪些 critical key。
3. 历史信息不得由 Brain 自动 backfill 为 covered。首次使用时由 daemon 汇总旧事实逐项请
   owner 确认，确认 receipt 生成新绑定；没有确认就保持 unknown。
4. 明确 `codebase_understood` 的一次性／每次任务有效期。若每单必确认是 owner 选择，就把该
   摩擦与话术写进验收；若项目奠基代内可复用，则需绑定 foundation/checklist version，而不是
   模糊沿用。
5. 列出并改造所有生产和测试组装点，执行 typecheck + daemon 全量测试 + 真 live 路径，而非只
   改 `live-wiring` 主链。

## B 级（应修）

### B-1 · 第三消费点只补 promote，不足以覆盖“建立／重建／换绑”的真实生命周期

方案补了 `promoteProject` 成功后立即 `readinessAssemble`，这能修当前“新会话先建 pending，
会话建立装配只看到 pending”的主缝。但当前 `LiveDialog` 只在 `ensured.created` 时装配，
session rebuild/resume 不触发；方案也没有列 reanchor、项目切换、session project rebind 后的
重装配。当前证据：
`packages/daemon/src/live/dialog.ts:71-82`，
`packages/daemon/src/live/voiceSessions.ts:59-89`，
方案 `research/2026-07-28-a3-armed-design.md:60,88`。

**应修：**把第三消费点定义为“每次 session↔project binding 建立或改变”，覆盖
created、rebuilt/resumed、promote type change、reanchor/project switch；装配须幂等，并为每种
生命周期补行为测试。若产品当前没有 reanchor/switch 写口，也应在合同里列明将来的唯一钩子，
而不是继续散落调用。

### B-2 · canonical 变更清单仍漏关键节与 modules

方案 §2 已记得更新 02/04/06/09 §4/§4.1/§12/§13/10，方向不错，尤其 06 术语表没有遗漏。
但按 A 级修法，至少还漏：

- **09 §0.1**：`readinessRef` 新增 checklist/evidence digest 的 producer、签名域、verifier、
  失败动作；对应 §12-1 digest 反例。
- **09 §1**：readiness 来源轮必须属于同一 session、`speaker=user`、`heard=true`，并定义
  turn locator。
- **09 §2**：proposed `readinessRef` 必填与 pending 提案判别型；不能只在 §13 留例外。
- **09 §4/§5**：当前 `Claim` 没有 `readinessKey`；需明确字段属于
  `MemoryEvent`、`ProjectedMemory/MemoryClaim` 还是 readiness dim，避免三个“claim”混读。
- **09 §9**：`memory_events.payload_json` 目前注释只描述 invalidate/forget 负载；
  add/correct 放 `readinessKey` 后须更新映射、round-trip 与 hard-forget 行为。若 assessment
  增 evidence/checklist digest，也须更新 DDL／迁移。
- **09 §11**：若 critical 绑定要求深评全验，需更新调用律与“配额耗尽/冷却”时
  fail-closed 语义。
- **09 §12**：保留现有 15 号作为 readiness 总项可以，但必须同时回挂
  §12-1（digest/version）、§12-4（memory active/forget/replay）、§12-11（双语义谓词），不能
  把跨域反例全塞进 15。不要另起一个与现有引用冲突的重复编号。
- **modules/a-dialogue.md A2/A5/A6** 与 **modules/b-memory.md B2**：它们也是 canonical，
  当前分别写 session 生命周期、就绪评估、proposed ref 必填、账本失效规则。
- 视 pending 判别型是否上屏，补 **10 §2/#10/#stale**，必要时补 **11 UI**；并同步
  `IMPLEMENTATION-PLAN-2.md` 的 A3 状态与实施批入口。

### B-3 · 不应从 `Claim.text` 解析 key，lane 也不应污染语义指纹

方案拟从 assessment `dims[].text` 解析 key，再绕开 lane 后缀。这把展示字符串变成协议：
label 含冒号、文案调整、axis 改名或 lane 渲染变化都可能误解析。当前 skeleton 确实把
`axis:key:label [lane=...]` 拼进 text：
`packages/contracts/src/readiness.ts:75-87`。

**应修：**持久化结构化
`{key,label,axis,critical,state}`，展示 text 只作派生；checklistDigest 签结构字段。lane 若只影响
话术密度，就完全排除 readiness 语义与 digest；若 lane 变化要求重提议，则把 lane 作为独立签名
字段明确纳入，不能靠 text 后缀偶然实现。

### B-4 · “gap 非阻塞”方向正确，但 `ready=false`／Brain instructions／深评门必须一起改

coding 的 `constraints`、writing 的 `form/style_ref` 已被 contracts 标为 non-critical；因此
critical 全覆盖时允许 propose，符合“critical=阻塞、非 critical=建议”的产品意图。v1.1 对开放点
2 的方向判断正确。

但当前 canonical §13 写“ready=false 一律拒组包”，10 §4 写“评估未通过不得提议”，现代码
propose 和拍板都只认 `verdict==="ready"`：
`docs/09-data-contracts.md:1083`，
`docs/10-voice-ux-spec.md:118-119`，
`packages/daemon/src/brain/liveTools.ts:376-404,501-516`。

**应修：**不要继续用含糊的 `ready` 布尔解释四值 verdict。新增纯函数
`isReadinessBlocking(verdict) = verdict==="gap_critical"` 或返回显式
`proposable:boolean`；rules、deep、propose、issue、dispatch 五处同源调用。话术要能说“关键项齐了，
还有两项建议缺口，不妨碍先出提案”，不能对 `gap_knowledge/gap_requirement` 同时说“评估未通过”
和“可以开始”。这是 owner 应显式知道的产品语义变更。

### B-5 · audit 文本 digest 不是深评输入，必须接入既有 SourceSnapshot/Excerpt 链

方案说 `memory.readiness_key_bound` 的转写 digest 是后续深评的“机械输入”，但 hash 不能给
evaluator 提供可读摘录，也不能单独证明 turn 仍可回读。现有 §4.1 深评需要
`SourceSnapshot + VerifiedExcerpt + ClaimSourceVerification`，并通过
`claim_snapshot_links` 参与 hard-forget。

**应修：**绑定时用当前 session/turn 捕获或引用既有 transcript snapshot，落
memoryEventId→snapshotId link；audit 只留
`memId/projectId/sessionId/turnId/key/claimDigest/sourceTextDigest/checklistDigest` 等重建索引，
不把 audit 当证据正文。hard-forget 必须同步清 link、snapshot、assessment 中的绑定明文和
prompt body；digest 是否保留沿用 §4.1 现有隐私纪律。

### B-6 · provider 的“缺失”与“运行失败”应分层收口

生产 composition root 应在类型和启动装配上强制 provider 存在，避免业务代码继续出现
`if (deps.readinessEvidence)`。低层 `assessReadinessSkeleton` 可以保留 optional 依赖，只用于
验证“错误组装也 fail-closed 并落行”的防御测试。否则把所有类型都改 required 后，反而无法
构造 Codex 22 要求的未注入反例。

**应修：**高层 `LiveToolsDeps`/production bootstrap required；低层 gate 接受缺失并持久化
`gap_critical`；启动时若 composition root 真缺 provider，应 fail-fast 并拒启执行面，已有会话
调用仍能得到处方化 gap 行。不要把“配置错误”和“账本为空”折成同一个无上下文提示。

### B-7 · 反例清单数量够，但缺的是决定性攻击面

方案 §4 的十组反例覆盖空账本、provider missing/throw、重启、forget、pending、non-critical、
quick 和清单加项，基础面完整；但尚缺：

- 无关轮／同一轮刷全部 critical、claim 对 source 成立但贴错 key；
- 无确认 artifact 的 `user_approved`；
- 同 key 换证、双 active 冲突、只 forget 多个 supports 中的一条；
- invalidate/supersede/expiry，而不只 forget；
- issue 后 forget、dispatch 事务两种并发顺序；
- checklist 删除／改 critical、axis、label，而不只新增；
- session rebuild/rebind/reanchor；
- 历史 active coding 项目零 key 的引导重绑；
- pending 不出现普通 ready 包／#10 话术；
- provider 在最终 dispatch 事务中失败。

这些应进入 §12 与 SayDo 行为级测试，不能只做纯函数单测。`READINESS_CHECKLISTS` mock、
真实 ledger、真实 package/receipt/task 事务至少各有一条贯通用例。

## C 级（可选）

1. 为 `readiness_stale` 记录结构化 reason：
   `evidence_changed/checklist_changed/type_changed/provider_error/source_missing`，并在 value report
   观察 false-ready、错绑、重提议率；不要把 claim 或转写正文写入指标。
2. 对 evidence vector 做 property-based 测试：事件重放顺序、重复 key、forget/correct 幂等、
   排序稳定与并发交错，能比手写样例更早抓出布尔集退化。
3. 术语建议用 `readinessArmed`／`readinessEvidenceProvider`，不要在全局只写泛化的
   `armed`；06 术语表同时标明“armed 只表示生产硬门接线，不等于语义校准完成”。

## 开放点裁决

### 1. 三闸措辞

**有条件采纳。**落文应写“source 由 daemon 从当前 `ToolContext` 自取、project 由该 session
绑定自取，Brain 无入参”，
避免误导成校验 Brain 自报 source；同时必须补全“同 session、turn 存在、speaker=user、
heard=true”。但不要再称 trust 枚举为“人背书门”：`user_stated` 仍需双语义验证，
`user_approved` 必须 receipt 派生。建议统一称“四个来源完整性闸”，与 A-1 的“语义资格门”
分层。

### 2. critical 全覆盖可出包

**采纳，但前提是 A-1/A-2 关闭，并由 owner 明示批准语义收窄。**双门拒绝集应是
`gap_critical`；`gap_knowledge/gap_requirement` 是可播报建议态，不阻塞。实现用同源
`isReadinessBlocking/proposable`，不要散落 `verdict !== "ready"`。若 critical 绑定的深评失败、
不清楚或版本不一致，仍必须归 `gap_critical`。

### 3. 词表演化

**不采纳当前“失配 key=unknown、不迁移不报错”作为完整方案；改为版本化采纳。**
历史 memory event 无需 DDL 搬迁，失配 key 可忽略并审计；但 checklist 的完整结构 digest 必须
进入 assessment/readinessRef。任何 key 增删或 `critical/axis/label` 语义变化都使旧 proposed
包 stale 并重提议。只有这样，方案反例 10 才是真的。

### 4. quick 车道

**采纳同源门，不采纳任何隐式自动覆盖。**quick 只减少提问与口播密度，不删除／降级 critical，
也不能用奠基或 Brain 归纳自动填 `codebase_understood`。允许一次聚合确认多个 key，但每个 key
仍须分别产生版本化绑定并通过 A-1 双谓词。lane 是否进入 digest 按 B-3 一次定死。

## 关闭条件对照表（与 Codex 22 五条逐条对照）

| Codex 22 关闭条件 | v1.1 覆盖情况 | 本轮裁决 | 关闭前必须补齐 |
|---|---|---|---|
| ① covered 确定性映射 + 证据版本／撤销语义 | 有显式 key、词表、来源／trust／项目闸和 forget 现算；**无 claim→key 语义、无 per-key evidence version，active 失效枚举不全** | **未满足** | A-1 双谓词与真实人背书；A-2 evidence/checklist digest、冲突／supersede／expiry 规则 |
| ② 生产强制 provider；缺失／出错持久化 gap_critical | 正文与实施清单明确恒 armed、missing/throw gap；但回退又要求恢复 unarmed，composition root 仍以可选心智设计 | **部分满足** | 删除 fail-open 回退；高层 required、低层 missing 反例；最终 dispatch 事务 provider error 也落 gap |
| ③ 会话建立第三消费点 + pending→promote/rebind 生命周期 | 当前 nominal created 点已实施；v1.1 补 promote 后重装配 | **部分满足** | created/rebuilt/resumed/promote/reanchor/switch 统一 binding hook 与行为测试 |
| ④ 删除 `ready,dims:[]` 回退 | 第三段明确删除；但 pending 又让普通 proposed 包无 ref 跳门 | **核心动作已列，整体未闭** | 删除 null/空 dims 回退；pending 拆判别型提案或独立 checklist，普通 DecisionPackage proposed 起仍必有 ref |
| ⑤ 未 armed、throw、空账本、重启、撤销的生产路径反例 | §4 已覆盖这五类名义场景及若干扩展 | **部分满足** | 补语义错绑、同 key 换证、最终 dispatch 并发、全 active 失效态、清单全演化、存量迁移与真实 pending UX |

**最终门：**上述 A-1 至 A-5 全部进入 canonical、实施与行为反例后，才能把 A3 从
`not ready_for_review` 翻为关闭。仅做到“每个 covered key 有一条可追踪 memory event”，只能
证明可审计，不能证明就绪，更不能关闭 owner 已复现的“零采访 + 编造内容”问题。
