# D1 有限证明合同提案（2026-10-03）

[warn] 非 canonical，待 owner 采纳。本文是可独立核验的合同提案，不是产品变更、PG-02 通过或生产准入。形状权威仍为 [09](../09-data-contracts.md) §17/18；采用后须先修改 canonical 并通过一致性检查点，再施工。这是首次审查后的唯一文档回修版本；第一版提交及原始报告保留，未新增产品修复授权。附属 [验收矩阵](D1-FINITE-PROOF-ACCEPTANCE-2026-10-03.md) 是本提案的一部分。

## 1. 输入、历史与本次终点

产品输入是 HEAD `8f2f42066858c6e9901f9607aec545e8eb0ff866` 的原 dirty 候选，fingerprint `2dd8db18c612479189dc2451d1fa8aa57b29c191f1c436843289eceb7c82a079`。提案 worktree 从同一 clean HEAD 建立，仅新增本文与矩阵；它不包含原 dirty 产品代码。独立核验使用任务外冻结 input-bundle 的真实源、授权与客观 JSON；来源路径、读取时钟和每件 SHA 在私有 BASIS/MANIFEST，不进入公开文档。绑定只证明所核对象，不证明语义。

保留原 101 action IDs、3781 effects、7754 原始诊断、旧 22 none 的逐 ID 历史，不把 repair-41 的 7755 blocking failures 写成旧分母改变。完整现役新增入口加入 N，原 ID 不删；旧 none 重新验证，原理由和新处置并列。保留 757 nonbounds/4223 occurrences/69 modules、924 bounds/3097 occurrences、13 精确 unresolved、C14 unavailable、生产 admission=0。有限 80 actions/434 effects 原型是历史局部证据，不是完整 101 的可靠准入。

旧 repair41/41、同因31/31、rereview15/35、procedure3/5 与全部 RED 保留。当前 owner-decision-16 只授权定稿提案、fresh 独立审查和整块预算建议，不授权 repair42、canonical/product 改动、信任根采纳、资源变更或公开发布。本次独立审查也不冒称正式 D1 生产 checkpoint。

## 2. 具名域 AUDIT_RECEIPT_SOURCE_FINITE_41

### 2.1 允许结论和签名域

仅可输出“指定源码/调用环境内的审计 INSERT 和 receipt 索引算法经有限核查”，证据类别为 `source_bound_finite_contract`，附独立源核查、域内运行/变异证据及另列 native attestation。不是任意 JavaScript 静态证明，也不是 native 无副作用证明。全部前提合取成立才能将该边登记为有限已核；其中任何 UNKNOWN、陈旧或超界均拒绝该边，保留诊断与 effect，不能降为 none。

每份合同收据必须绑定：contractId/version、产品 I 的真实 HEAD、dirtyDigest（生产冻结时应为空）、全部依赖的逐字节 SHA、完整函数 AST/词法作用域坐标、import/实际组合根、每个调用点与完整实参环境、入口 variant、conditions/via、实际 SQL、六参数构造算法、返回/异常算法、evidence 投影算法、primitive attestation ID、平台/ABI/Node/工具链、验证者身份、原始运行命令/即时退出码/负例清单、资源 runId。摘要变更也须重新审核算法，不能只比较 hash。正文不保存敏感 payload。

独立核查者从源文件解析 AST 并逐节点核控制流和数据流，不执行作者提供的命令，不使用作者 `AST_verified=true` 自证。未知节点、遗漏分支、额外调用、getter、proxy、未证明的 spread/rest、动态 import/eval、别名逃逸或实际调用点不可枚举时，拒绝摘要；可回到原保守展开，仍受原界限约束。

具名有限 own-data 展开例外：本域完整 producer/reader/caller 中的对象 spread 与对象 rest，可仅在独立核查实际源、有限完整字段集合、own enumerable data descriptor、允许的原型、无 symbol key/getter/proxy，以及从来源形成至全部读取之间没有属性/描述符/原型或别名改写时展开。不得由类型注解或对象名提供上述前提；函数调用求值仍核其真实效果，条件求值与每次属性读取也仍核来源。按 JavaScript 实际从左至右求值和覆盖顺序还原所有字段；已知覆盖不能吞掉被覆盖值的求值效果，未知 key/描述符/逃逸/超界继续拒绝。

当前必须逐点证明的实例是 `cliRuntime.ts` 约128行的 `registrationEvidence(evidence)`（精确11字段，随后五个meta字段覆盖）；约354行的registration展开（真实有限自有注册字段，bindingDigest随后由实际cliBindingDigest求值并覆盖）；约356/441行的evidence展开（随后真实receipt求值并覆盖）；约439行的 `{ receipt: pendingReceipt, ...evidence }`（先取receipt，rest只复制其余own enumerable字段，不误留receipt）；约534/535行的两条件展开（先核typeof和重复属性读取无改写，分支恰好一个对应model string字段或空对象）。caller中的registry/activation对象展开须按同一规则逐点列字段、有限键及读取/覆盖顺序，不能从这几个实例推导整个cliRuntime免费准入。它们是准入条件而非当前已通过的证明，也不要求产品改写语法。反例须含额外/symbol key、getter读副作用、proxy、spread源返回时写入、覆盖表达式写入、别名在两次读取间改值、rest错误保留receipt与model条件臂错选；各自保留真实effects或UNKNOWN，禁止摘要吞掉。

### 2.2 DAO 和真实 effect

源为 `packages/daemon/src/storage/dao/misc.ts:createSqliteAuditSink` 完整函数，包含 `record` 和 `sharesSqlite`。唯一 SQL：

```sql
INSERT INTO audit_log(id, ts, actor, action, ref_digest, meta_json)
VALUES (@id, @ts, @actor, @action, @refDigest, @metaJson)
```

必须登记 `sql:INSERT:audit_log`，不得把返回 `{id}` 当持久成功证明。核 `newId("aud")` → 当前 ULID 实现/随机来源、默认 `now` → Date → `toISOString`、actor/action/refDigest/meta 的真实 event producer，`JSON.stringify` 的有限输入及原生保证。传给 run 的对象必须是六个 own data 字段、无额外 key/访问器/异原型/proxy：id/ts/actor/action 为已核 string，refDigest/metaJson 为已核 string 或 null。缺任一 named key不得产行或 receipt；null 按当前两个 `??/?:` 分支保持，不等同缺 key。

event 的可审有限形状是 actor/action string、可选 string refDigest、可选普通无 getter/proxy 的有限 JSON meta。JSON 不允许循环、函数、BigInt、非有限数、未知 toJSON 或 Symbol/原型转换副作用；未知 event producer 不靠 TypeScript AuditEvent 注解授信。该约束是证明域准入条件，尚不是产品已有运行守卫；未来若要加守卫，须另核兼容性与全部真实 producer，不能偷偷改变审计业务行为。

`stmt.run`、id/clock/序列化失败均在返回 ID 前传播；绝不能 catch 后仍返回成功。`sharesSqlite(other)` 只声明连接对象同一性用于事务接线，不证明事务提交、磁盘持久、driver 语义或 source→binary 对应。失败造成上层停止不安全写入的行为仍须审每个 caller。

### 2.3 producer、投影和 receipt 算法

生产者为 `packages/daemon/src/config/cliRuntime.ts:issueRegistrationReceipt`；当前两个直接生产点是 register 流程与 promotePending 流程（源约357/442行）。须核所在完整函数、上游 self-test、activation、promotedFromAuditId 与真实 audit 接线，不能只看私有 helper。producer 固定 actor=`daemon`、action=`config.cli_runtime_registered`、refDigest=`registrationEvidenceDigest(evidence)`，audit.record 正常返回后才取 `.id` 构造 `{auditId,evidenceDigest}`。

完整 evidence 域有 11 个字段：slot/provider/bindingDigest/binaryPath/binaryDigest/expectedFamily/requestedModel/observedModel/observedModelSource/observedModelExempted/testedAt。两个可选 model 均投影为 string 或 null；签名不包含 receipt。meta 另含 selfTestStatus=`ok`、target、activationConfigDigest/activationEnvDigest（缺省 null）、promotedFromAuditId（缺省 null）。这些额外字段均不属于11字段evidence digest，当前reader的作用须逐字段区分：selfTestStatus与target在所有目标分支过滤；activationConfigDigest/activationEnvDigest只在pending分支比较，active分支不检查；promotedFromAuditId仅由producer记录，reader不读取也不验证promotion链。保持11字段/ref_digest和其它过滤条件不变时，改promotedFromAuditId、或active行的activation元数据，不改变当前索引纳入结果。源码变异敏感性只能对实际依赖字段提出，不能要求这几种变异被当前reader拒绝。本文不额外要求其签名或链路完整性；若未来需要，必须另有canonical与产品语义变更授权，不当成本域已有保证。核 `registrationEvidenceValid`、`familyFromModelName`、`isWiredCliProvider`、真实 JCS/sha256/UTF-8 依赖完整算法；JCS 的 unsupported 值/排序变化/遗漏字段须拒绝，不用手写期望 hash 自证。

receipt 消费者为完整 `loadCliRuntimeReceiptIndex(db,target="active",activation?)`：pending 缺 activation 或两 digest 都缺时返回空 Map；执行下列唯一 SELECT，SQL/native 失败发生在 try 外，必须传播。

```sql
SELECT id, ref_digest, meta_json FROM audit_log
WHERE actor='daemon' AND action='config.cli_runtime_registered' AND ref_digest IS NOT NULL
```

每行 id/ref_digest 正则及 meta_json 非空后才 JSON.parse；必须过滤 selfTestStatus、精确 target，pending 时比对两个 activation digest。slot 仅四槽，provider 必须真实 wired，source 仅 stream/verified_binary_default，必需字段实际种类检查通过；可选模型只在 string 时进入投影。核 evidenceValid 与完整 JCS digest 相等后才 `out.set(id,ref_digest)`。行级坏 JSON/投影/验证异常当前被 catch 跳过，不产 receipt；不是整次数据库失败可吞错。结果 Map 是本地状态，不证明 CLI/provider 调用成功，也不证明 promotion/registry 写入成功。重复 ID 的不可达性须由当前 audit_log DDL/唯一约束和 driver attestation 支撑，不能用 Map 覆盖语义代替。

运行核验须由独立查询读取 audit_log 全六列，对 INSERT 参数逐列核对；测试替身/伪行不能替代真实 SQLite。SELECT reader/readonly、Statement.source、Database/Statement receiver、run/all 函数身份只是绑定检查，仍须 §3 语义保证。错 SQL、错 actor/action/meta、漏字段、foreign receiver、改写 prototype、改 digest、错 activation、native 失败后返回 ID 等全部否决。

### 2.4 caller 和初始化闭包

当前 DAO 生产接线为 `index.ts` 约509/510行的 `openDb(join(SAYDO_HOME,"saydo.db"))` → createSqliteAuditSink(db)。七个 receipt direct callers 是 index.ts 约544/1095/1403/1478/2474行及 recoveryOnlyServer.ts 约690/746行；坐标用于定位，绑定仍以冻结字节为准。必须核完整所在 caller、import、真实 db 生产者、target/activation 实参、调用前初始化和返回消费者。recoveryOnlyServer 的 input.db 须沿真实 server 构造调用回溯，不凭参数类型授信；测试数据库与 clock 单列，不当生产 default。

openDb 的构造/pragma/migrate/DDL/关闭包装都在初始化闭包中；迁移、锁、事务、CAS、SQL token 和写入不能因 DAO 摘要省略。newId/ULID、Date、JSON、RegExp、Map、crypto/JCS、包导出解析与 native loader 逐项登记来源。声明名字或 ReturnType 类型引用不算 runtime 逃逸；真实导出/回调/动态 caller 逃逸则 UNKNOWN。完整 DAO 的其它 AuditEvent producer 不自动获得 receipt 专用契约；每个实际 action 中的 audit.record 都须具名 producer 证据，不存在整个 AuditSink 免费准入。

## 3. native primitive 的有限信任提案

推荐候选路线 `LOCAL_CONTROLLED_REBUILD_16`：owner 明确委任一个独立本地验证者，并将其受控重建记录和域内语义核查作为具名有限信任边界。它是显式人工信任选择，不假称发现可用第三方证明根、通用形式证明或官方 attestation。未获 owner 选择、未有完整证据或验证者与作者同一时，native 仍 UNKNOWN/拒绝；预装 prebuild、hash、对象身份和 `[native code]` 均不足。

职责与可判定产物：

| 项 | 实施者提供 | 独立验证者实际核查 | 失败行为 |
|---|---|---|---|
| source | 精确 better-sqlite3/SQLite 及 Node primitive 范围、源树/补丁/完整依赖清单 | 自行取得并核 frozen 源；审核仅本域用到的 wrapper/binder/statement/SQLite路径，primitive 的允许输入/结果/错误语义 | 只做摘要或漏依赖则拒绝 |
| build | 无网络隐式下载的 recipe、toolchain/flags/链接依赖、平台 | 在独立目录从固定源强制构建，禁止选择现存 prebuild，保存完整输入/输出/日志；记录执行环境而不假称可信编译器证明 | recipe 漂移/偷换prebuild/未知链接拒绝 |
| ABI | Node 精确版本、arch/OS、NODE_MODULE_VERSION/N-API与构建配置 | 在目标运行环境实际加载；核 Node/动态库/loader 路径与 ABI 兼容，不把加载成功当语义保证 | 错 ABI/错平台/加载未知拒绝 |
| artifact | build 输出及安装/加载映射 | 验证构建输出即实际加载 artifact；可再独立重建比较，非确定输出须逐差异解释，否则拒绝 | hash相同仅绑定，hash差异未解释拒绝 |
| domain | 固定 INSERT/SELECT、普通六参数、经过核验且保留审计不可变保护的生产 schema（含具名触发器）；未知自定义 SQLite 函数/扩展/trigger 不准入 | 自建临时库核所有列/约束，SQL错误、磁盘/事务失败、重放/损坏行/foreign receiver与源码变异；核源算法支持这些有限语义并明确残余信任 | 不满足 schema/域或只跑正例拒绝 |
| attestation | source/build/ABI/artifact/domain/资源清单候选 | 验证者产生带其身份、owner授权ID、验证时间与范围的私有 attestation；宿主消费完整前提 | 无授权身份/陈旧/范围外拒绝 |

Node Date/JSON/RegExp/Map/crypto、ULID随机来源与 JCS 哈希依赖不能夹带在 SQLite attestation 内：每项列具体 API/输入与相关原型完整性前提；owner 可选精确本机 Node 与受控加载模块为有限基础信任，但整个 engine/OS、任意 callback/FFI 不因此获语义豁免。生产默认加载闭包须核所有与本域相关的native extension、自定义函数、trigger及其效果。必须保留并核验 `DDL_V2_AUDIT_IMMUTABLE` 的两个真实触发器：`audit_log_no_update` 为 `BEFORE UPDATE ON audit_log`，`audit_log_no_delete` 为 `BEFORE DELETE ON audit_log`，各自完整body均为 `BEGIN SELECT RAISE(ABORT, 'audit_log immutable (E3)'); END;`，创建语句为 `CREATE TRIGGER IF NOT EXISTS`。它们拒绝UPDATE/DELETE、保护不可变性；对本域固定INSERT/SELECT不触发，不当作附加审计写点。验证者须核迁移确实安装它们、实际sqlite_schema中的完整SQL/目标表/事件/body与冻结生产schema等价，以及不存在同名异义trigger；不能仅看DDL声明或IF NOT EXISTS跳过实际定义。测试库使用经核验的生产schema和迁移，不删除安全触发器制造一致。其他与域相关trigger/扩展/函数必须逐项完整核查事件/调用/效果；未知或改变本域含义且未核查者拒绝。负例含缺失/改名保护trigger、同名body漂移、额外INSERT trigger写其它表、SELECT所调用的未知函数；UPDATE/DELETE应真实报错、INSERT/SELECT按本域核验，不能把测试成功当成所有SQL语义保证。磁盘持久/OS正确性作为明示残余假设，只声明测试覆盖的故障域，不声称证明任意断电。

本次未重建、未认证、未执行 native verifier，不宣称路线已可用。当前 SQLite源码 stat=9,516,284 B、addon stat=1,980,736 B，均不是41 full-read；小构建/选择6文件11,291 B显示默认prebuild选择而非编译来源。必要全源/toolchain/engine成本未知，必须在实际执行前给有限可执行测量计划，触碰上限即停止，不能把这项信任选择当作全D1或S2入口已关。

## 4. 单次完整验收资源合同提案

### 4.1 当前实测与唯一候选上限

现行默认仍为512 physical files、1 MiB/file、8 MiB累计读取/展开、30s、13 hops、256 call nodes、localDepth12；本提案不改变它们。repair-41三个cold约28.136/28.338/28.093s，均exit1、非timeout，不能称全PASS。实际 parent539 origins（超27）、1063 sync reads/6,320,057 B；535 fee keys约8,281,654 B不是物理文件分母。ESM/CJS/transform views=12,131,732 B，proof+views=20,413,379 B；TS实际compile view9,112,572 B超过1MiB。已知origin union732仅是更广来源集合，尚不是完整物理读取事实。

source/proof463子集由444产品源+4ledger/vocab+11driver+2boot+2protocol组成，不能替代539；另50 fixture、21实现依赖、4helper、1Node binary必须入账。当前只减11，原至少38目标未达。兼容独立补测的8,897,767 B超过8MiB 509,159 B；功能exit0不算资源PASS。

唯一供 owner 选择的候选包：**768 physical origins，16 MiB/单物理文件或单生成view，64 MiB累计读取加展开与生成view输入，60s完整acceptance wall；13 hops/256 call nodes/localDepth12保持。** 768以539实读及732已知来源集合为容量起点（距732仅36）；16MiB覆盖已见9.516MB源和9.112MB view；64MiB相对20.413MB已计proof/views并加11.497MB两个stat资产的31.910MB已知容量需求给有限余量；60s相对28.338s冷调用约两倍。以上是可试验上限建议，绝不是全部 engine/native/child 能装下的测量结论；两stat资产只是未来容量估算，不算已付费读取。不得用此算式混淆重叠channel重复计费。

未测native/child/mmap/heap/完整engine可能超过候选包。首次全量验收须将其封闭观测或给保守可计算上界；无法覆盖即UNKNOWN/拒绝，并报告差额。不能先假绿再补。controlled rebuild准备流程与acceptance分开记录但不免费：在实际构建前声明独立有限source/build输入和时间/磁盘预算；目前无实测支撑，故本文不虚构一份可保证构建成功的上限。默认限制无法容纳时须由owner进一步明确准备资源；不得自行另给隐藏预算。

### 4.2 计费规则

单个 runId 从受控输入准备/loader启动之前到所有子进程、schema、投影、运行/反例和最终结果终态之后计完整 wall。分片、缓存、并行、callback不得开第二份额度；计时含Program构造、首次parse/展开、查询和证据生成。60s候选针对一次预声明完整验收集合；若全mutation集合无法在内执行，拒绝容量结论，不能移到另次调用再称同一次PASS。独立三cold各自执行完整集合，不把3次拆分结果拼成一份全通过。

- physical origin：按真实打开对象的canonical路径及设备/inode等记录来源，同一物理文件别名/重复read只计一个origin；无法证明同一性时保守分开。生成内存view不冒充物理文件，单列view identity；落盘生成物重新成为物理origin。
- version：同一origin任一新字节版本另记hash/大小/每次读取；版本数不能替代physical count，也不能把同路径新版本当免费。每次实际读取累计bytes，缓存只在本call有完整不可变绑定且真实没有再次read时节省实际读；绑定验证读仍收费。
- fee key：证明逻辑引用标识，单列数量，绝不能当physical分母。每channel记录origin/version/view/runId与去重依据；无依据则保守累计，禁止负费用抵消。
- bytes：实际FS/loader/child/native输入的每次read、每次解压/转换/生成源码view、first parse的外来输入逐事件登记。首次parse读取已收费同一不可变byte buffer可引用同事件避免虚构第二次物理read；新生成view仍收费。AST/对象共享不把实际展开变成零；完整兼容还原/schema查询实际发生的生成view与materialization也计。
- categories：产品源、fixture、ledger、实现依赖、helper、engine、driver/native、protocol、输出回读全分类，均入origin与byte总账；预观察输入和恢复manifest也计。源码和编译view若是不同事件要分别记，不把源码读冒称覆盖CJS view。
- native/child/mmap：不能仅用Node FS monkeypatch声称全通道。受控runner须覆盖子进程树、OS层IO/mapping和真实native加载；不可观测通道须禁用，或在采用前独立建立具体有限保守上界且入账，缺上界即UNKNOWN。mmap全文件映射保守按映射范围计，未知range拒绝；读取engine也不免费。固定runtime基础信任只涉及语义假设，不移除资源账。
- parse/heap：全程记录最大RSS/heap、parse/view/graph节点及耗时；bytes限额控制输入不等同heap上界。当前graph13339节点不等于每action调用图256节点，不能把共享图节点改名免call-node计数。heap未观测时标UNKNOWN；有上界要求而未给出则资源准入失败。本提案不将heap未知宣称为小于任何新数字。

超限前停止进一步读取/展开，保留原因、已付费总量、原始分母和未运行项。无法预知输入大小则分块有界读，跨限即拒绝而非先全读再倒扣。缓存跨call须在call内完整复核成本，否则禁用。exact-set反例须覆盖循环引用、遗漏/重复effect、错condition/via、伪摘要/陈旧源码、同path新版本、重复producer token、foreignreceiver、native失败、未观察child与超预算；unknown与bounds按每个诊断原样分离。

## 5. 全真实动作推进与闭合条件

只有SOURCE_FINITE一个域不足以收口。按机制图保留13 unresolved及九链69 unique outgoing/117 occurrences、249调用occurrences/152 unique；先按真实模块/来源/变体聚类，而非逐诊断扩展通用分析器。setup secret、attention DDL、writing freezeOutbox、anchor transition必须全量逐写点/conditions/via对账，其余当前101同等要求。完整 caller、provider默认、返回来源和原型前提各自闭合，不因native primitive替代全部调用证明。

每个 action 只能是：原规则精确闭合；具名有限契约闭合并显示证据性质；只承接规定bounds的显式 exceeds_bounds；或 UNKNOWN。只有前两类可作为其具体已核能力的来源。bounds不能吞nonbounds；按现09 B关闭条件接受的显式RED动作也不转公开verified claim。若采用替代证明解除某必需动作，应逐ID指出替代了哪项阻断、全effects覆盖及残余假设；“accepted=0、fixtures绿”不得关PG-02。

B1全部写点、B2实际运行、B3 just ci真实执行覆盖、B4 unknown分离必须有全动作逐ID矩阵。bounds的人工effect仍须真实锚点和完整conditions，runtime证据是实际测试结果，不以测试名/token存在当已执行。原43门逐条required exact-set保留，2PASS/41NOT_RUN是41历史事实。门替代须具名语义映射与独立审查；0测试/skip/未观察终态不通过。

覆盖历史精确口径：cold每次22files/34arrays，三次102真实数组运行；独立补测2files/4arrays仅一次。114行mapping不是114次执行；全旧40集合24files/38arrays。将未来所需每项的原命令/即时exit/实际执行数/日志SHA绑定当前I，保留所有旧RED。

## 6. 整块S0–S6实施建议与预算

后续授权采用一个窗口覆盖全部范围，不按每轮+1。本提案建议**新增最多16次repair、20次fresh语义审查、2次procedure retry；任一同因最多3次repair、同一程序根因最多1次retry**。建议从授权时真实计数追加，未用旧余量吸收到该上限内不叠加；若仍停repair41/同因31/procedure3，则建议repair累计57/procedure累计5。rereview基准须先计本次合同审查真实消耗，再追加最多20；不能照写旧15。未获owner批准前这只是建议，task.json不改，repair42不启动。

估算依据：正常约10个语义节点（统一合同、PG02–06五批、RF整体、B1合同/整体、最终集成），20审留有限回审；16修相对已授权原12窗口给合同/资源/源接线四项额外集成余量，并非由历史31次同因推断成功率。新阶段初次施工与RED回修按真实性质计，不将repair改名continue。当前177审计路径/123pending_absorb、全RF迁移与大量UNKNOWN，缺各阶段工时与native构建测量，因此此预算是有界工作尝试建议，不能保证16修内全交付；没有足够证据给出可信总工时/货币成本。不中途逐项索取新额度。

| 阶段 | 全范围产出和成功条件 | 明确停止条件 |
|---|---|---|
| S0 | 最新归属/活调用/指纹恢复；177路径逐项归属、33字节分歧语义判断、123pending_absorb处置，不搬旧生成物 | 未知活写入/所有权冲突不可安全解决 |
| S1 | owner采纳后canonical同步及一致性；全N容量/无损/语义前提实测；native候选真实有证据；fresh检查点有效 | native信任未选、资源UNKNOWN、完整合同无可行证据；禁止直接S2 |
| S2 | 吸收成立的9/27审计及CI差额；全部N/旧22、B1–B4/schema/ledger/语料/dry-run闭合；I/证据E绑定、PG02 required与独立验收 | 删除分母、unknown冒none、nonbounds未关、required红 |
| S3 | PG03 gate图负例；PG04 typed audit/敏感与写失败；PG05迁移前恢复点/WAL/SHM/崩溃；PG06 inventory与admission分离、probe关闭；各批独立阶段门通过 | Gate0/S3/审计/恢复代际等红线或阶段required未关 |
| S4 | RF01依赖/贡献、02协议SDK读写订阅、03共用用例、04写owner恢复、05全路由WS、06全Web SDK/journey、07provider/executor取消恢复、08媒体有限对照、09三端bridge正式平台、10dist/exports/外部消费/安装闭包、11治理维护者演练，全原编号矩阵及一次RF整体独立审查 | 正式平台/签名/真人等required缺测保留INCOMPLETE；技术不替换需比较理由 |
| S5 | 先核只读Anyvia合同与必要一致性；默认关闭B1消费者：三真实producer、持久交接/完整去重墓碑/原ID查询/旧库恢复暂停/原提醒不回归；临时库严格替身故障及B1整体审查 | provider consumerReleaseAllowed=false不可擅改；跨仓改动/设备grant/真实通知停owner |
| S6 | 最终全适用required及43门、Node/Python/浏览器/Linux、全原编号矩阵；fresh集成审查后才按有效D5安全合入与已授权远端快照/CI | WIP冲突/隐私不明/required远端或真机未过；发布/npm/tag/runtime/真人等旧checkpoint不取消 |

各阶段保留 selected/executed/unique/retry/skip/NOT_RUN/FAIL，源码、制品、本地运行、远端、真设备/真人分开。阶段通过后推进下一已授权阶段，安全/预算停止则先处理所有独立可执行工作再集中报告。某同因第三次前须有量化结构改善；无改善提前停止，不花满预算。任何窗口耗尽或同因耗尽均保留终态，不能新task/根因名清账。

## 7. owner必要决策（最多三项）

1. **有限证明与信任选择**：推荐采用SOURCE_FINITE规则并仅授权探索 `LOCAL_CONTROLLED_REBUILD_16`；正式native信任须独立验证者提供source/build/ABI/artifact/domain五项，owner具名批准其范围。也可保留现信任边界，则native继续UNKNOWN、S1停止。不凭作者/当前安装自证。准备构建资源目前未知，需先给有界测量包；不是买云额度或全局安装授权。
2. **一次完整资源包**：推荐允许试验768/16MiB/64MiB/60s候选，13/256/12不变；理由与已知下界见§4。未封闭engine/native/child/heap仍拒绝，不承诺可完整PASS。保留默认则当前539/20.413MB事实仍超限，不继续同法盲修；全引擎/OS没有免费豁免。
3. **整块实施窗口**：在前两项及fresh合同审查满足后，推荐一次授权§6的16repair/20审/2retry与S0–S6全部范围，累计从真实已用追加；不授权无限重试，旧RED及全部checkpoint保留。未采纳前只交回提案和独立审查，不开repair42。
