# D1 有限证明提案验收矩阵（2026-10-03）

[warn] 本文附属 [提案](D1-FINITE-PROOF-PROPOSAL-2026-10-03.md)，非产品验收结果。所有将来运行项当前为 NOT_RUN；历史运行不继承当前 PASS。正式合同形状仍以 [09](../09-data-contracts.md) 为准。独立提案审查只判断下列规则是否可靠、可执行、完整有界，不代跑产品或认证native。

## 1. 精确验收对象与否决

| ID | 固定核验对象 | 成功判据 | 必须拒绝的反例 | 当前证据状态 |
|---|---|---|---|---|
| FP16-01 | 原dirty产品与clean提案HEAD、输入MANIFEST | 各自HEAD/fingerprint及输入SHA与真实磁盘一致，提案不冒含dirty代码 | 相同HEAD却替换为clean源、只绑工作树digest冒生产HEAD、陈旧输入 | 提案私有BASIS供独立核；产品冻结NOT_RUN |
| FP16-02 | 全动作/旧22 | 全原101 ID包含；新增入口增N；原3781effects/7754diag逐字段留存；旧22逐ID保留历史和新判定 | 删动作/漏variant/省condition/via、把7755当前blocking当原诊断、80原型替101 | 历史JSON，当前全验NOT_RUN |
| FP16-03 | DAO完整AST+依赖 | 全函数含record/sharesSqlite、词法绑定、六INSERT参数/返回顺序逐节点核；真实SQL行六列等价 | 只比hash/函数名、额外调用、缺key/异原型/getter/proxy、错误后返回ID | 新独立源核NOT_RUN |
| FP16-04 | receipt producer/11字段投影 | 两真实producer所在完整caller、上游self-test/activation/审核接线；JCS完整源与依赖核；额外meta逐字段分开：selfTestStatus/target过滤、activation只pending比较、promotedFromAuditId仅记录且不签名/不reader核；有限own-data展开/覆盖效果保持 | 伪AuditSink返回ID、漏字段/null变化、错actor/action、自报self-test、错排序/unsupported JCS；getter/proxy/symbol/额外key、覆盖表达式副作用和别名改写拒绝；仅改promotedFromAuditId或active activation不要求reader拒绝 | 新独立源核NOT_RUN |
| FP16-05 | receipt完整循环/错误行为 | 固定三列SELECT及WHERE；pending空Map；每行过滤/valid/digest/Mapset；534/535条件spread证明有限字段与无改写；SQL失败传播、坏行不产receipt | 错target/activation/provider、假meta、错digest、吞SQL失败、duplicateID覆盖假设无DDL、条件臂错选/重复读取间改值 | 新独立源核NOT_RUN |
| FP16-06 | caller/init闭包 | DAO一个生产caller及receipt七caller逐点核完整实参；recoveryOnly db回溯；迁移/DDL/关闭/clock/id/primitive登记 | ReturnType当runtime逃逸、动态caller漏记、自定义clock冒default、同名db代真实连接 | 坐标JSON只定位，不是独立通过 |
| FP16-07 | native信任包 | owner具名授权的独立验证者实际source/build/ABI/artifact/domain五项齐，加载绑定、生产schema完整核查且保留audit_log_no_update/no_delete、固定事件/SQL/body与实际定义齐，有限语义/失败证据齐 | prebuild/hash/native marker/object identity当语义证明、ABI错、偷换artifact、未知或未核trigger/extension、删除保护trigger、同名异义body、额外INSERT trigger、未知SELECT函数 | UNKNOWN，未重建/未认证 |
| FP16-08 | 实际SQLite运行与变异 | 真临时SQLite全列独立query、正例及负例实际运行、源码替换均敏感、原错误传播保持 | fixture自证、foreignreceiver、prototype改写、native异常后成功、重复producer token/公共token覆盖 | 新合同运行NOT_RUN；原生产admission0 |
| FP16-09 | 全账origin/version/key | 每输入类别、真实物理来源、同path各版本与每次读取、fee key分开；generated view单列 | 535keys冒539origin、463subset当512全量、别名/新版本免计、落盘view不算origin | 历史539/732分类可核；当前全账UNKNOWN |
| FP16-10 | 全call读取/展开/parse/wall | 完整预声明集合从启动前到终态，全部FS/loader/native/child/mmap封闭或上界；超过即拒绝 | Node hook冒全OS覆盖、先超读后倒扣、缓存跨call免费、移负例到另call拼PASS | 完整engine/native/child/mmap/heap UNKNOWN |
| FP16-11 | 共享图/兼容表示 | 所有N、effects、diagnostics、条件路径完整可还原、共享循环有界、同一环境去重规则可核 | 漏节点/重复effect/错conditions/via、13hop变零、13339shared nodes当256call nodes通过 | 容量/可靠准入当前未通过 |
| FP16-12 | 历史覆盖与新exact-set | 历史cold22files34arrays×3与supplemental2files4arrays×1分别记录；新集合预声明逐case即时exit | 114mapping冒114execution、沿袭JSON文件存在当当前PASS、发现0测试 | 历史纠正可核；新验NOT_RUN |
| FP16-13 | unknown/bounds/能力投影 | nonbounds逐项为0方可闭其域；bounds只承规定三类；unknown不放行；证据性质可见 | bounds吞757nonbounds、runtime冒静态、none凭类型/字符串、accepted0但fixtures绿 | 757/924机制及B1–B4均未闭 |
| FP16-14 | required43与新增门 | frozen I绑定真实argv/exit/日志hash；原43 exact-set无遗漏；替代具名review且增PG/RF/B1实际门 | 2PASS/41NOT_RUN写全绿、continue-on-error/required skip、作者自审 | 新产品门NOT_RUN |

独立审查应给两维结论：可靠性/不降安全、全量可实施性；另核输入与授权事实，判断维度合计不超过四项。若判定只支持“有界可实验而未证明完整可行”，必须明确保留这一限制，不能将提案审查转换为S1生产通过。

### 首次审查后的三项回修判据

| ID | 核查事实与新规则 | 必须保留的边界 |
|---|---|---|
| R17-F1 | 独立逐点核128/354/356/439/441/534/535的spread/rest与caller同类有限展开；完整source、字段、descriptor、求值与覆盖顺序、原型/别名不改写齐；rest不留receipt、两model条件不混臂 | 未知展开仍拒绝；覆盖不能消除原表达式副作用；只改文档不改真实语法 |
| R17-F2 | 冻结ddl中两保护trigger完整SQL及真实schema定义等价；UPDATE/DELETE拒绝，固定INSERT/SELECT不触发；测试库保留生产保护 | 不删安全trigger；未知扩展/函数/相关trigger拒绝；未来真实运行仍NOT_RUN |
| R17-F3 | 11字段签名与五额外meta作用逐字段准确；selfTestStatus/target所有分支过滤、activation仅pending、promotedFromAuditId仅记录 | 不要求当前reader拒绝仅改promotedFromAuditId或active activation的变异；不偷偷新增签名/链路保证 |

## 2. 原22 none的固定ID

下列全部保留；每项新运行/写点证明、处置和依赖齐才可得新结论，当前不恢复none可信性。

```text
ui:POST /api/tasks/:p/explain#one_liner
ui:POST /api/tasks/:p/explain#walkthrough
ui:POST /api/s3/status
setup:postSetupTest
setup:postReprobeCliCapabilities
setup:postConfirmCliCapability
ws:handshake
setup:postFirstRunQuery
setup:postTier1SetupTest
ws:binary
ws:tts.playout
ws:barge_in
ws:console.heartbeat
ws:voice.mode
ws:voice.quiesced_transcript_ack
ws:turn.done_speaking
ws:voice.anchor_prepare
brain:getDecisionPackage
brain:getStatus
brain:approveAction
brain:getFocusStatus
brain:proposeExpectationAck
```

## 3. B1–B4和S0–S6阶段验收

| ID | 分母与必须产物 | 成功 | 失败/未运行的结论 |
|---|---|---|---|
| B1_all_write_points | 全N的物理effectKey/条件/via/来源，setupSecret/attentionDDL/freezeOutbox/anchor及所有同类 | 全写点无漏/重/错variant；manual_exceeds_bounds真实锚点齐 | 任一漏写或未知保留RED |
| B2_actual_runtime | 每action覆盖全部登记effect的具名实际测试与故障/变异；平台条件单列 | 真实执行且行为与合同等价，结果绑定I | 测试名/token存在不算运行；真机缺测NOT_RUN |
| B3_just_ci | just ci完整Node/Python矩阵、默认排除的phase/e2e另跑，43旧门及新增门 | 每项真实退出0且test数量>0/expected set齐 | skip/0tests/无终态/托管CI未跑均不当PASS |
| B4_unknown_separation | 每ID诊断按bounds与nonbounds拆，完整source/caller/native范围 | 非豁免诊断全部关；bounds显式RED保留且满足现09 B | 757nonbounds/4223occ与924bounds/3097occ不互相抵消 |
| S0 | 177审计路径、33字节分歧、123pending_absorb逐件归属，原RF00更新 | 每件有吸收/等价/替代/证伪/明确延期及责任，活写入恢复闭合 | 未知所有权/活调用停止受影响项 |
| S1 | 全N合同/容量、canonical一致性、owner信任/资源决策、fresh检查点 | 实测源/构建/域/全预算与独立结论齐；不得仅通过提案文档门 | native UNKNOWN/新cap未采纳/全call未量测，不入S2 |
| S2 | 审计/CI差额及PG02完整schema/checker/ledger/语料/dry-run；B1–B4 | 所有必须审计处置闭合、产品I/E绑定、阶段required和独立审查齐 | 其它RF仍NOT_RUN；原CI未获当前公开SHA绿仍未关 |
| S3 | PG03/04/05/06各批原required和负例 | gate图完整、敏感/审计失败停止、迁移前一致恢复点、unknown拒绝且probe关闭 | 阶段失败不越过依赖；不可逆历史变换不做 |
| S4 | RF01–11全原编号覆盖矩阵 | 全路由/全Web真实消费者、取消恢复、媒体比较、三端正式平台、安装闭包、贡献维护者演练和RF整体review | 三示例不代全路由；required签名/设备/真人缺测INCOMPLETE |
| S5 | 默认关闭B1consumer与必要合同/整体review | 三真实触发producer；崩溃/未知受理/原ID查询/去重墓碑/旧库恢复暂停/原提醒回归齐 | consumerReleaseAllowed=false保留；mock本地不代跨设备上屏 |
| S6 | 全集成required、43旧门+新增门、freshreview、合法D5集成/远端CI | 仅全部适用required实际过才给对应层次结论 | 本地/托管CI/设备/真人分层；任一required缺测整体INCOMPLETE |

required43的逐项精确argv沿任务外 input-bundle 原始GATES.md与required-status-repair41.json核对。本文不重写一份略去私有工具路径的假可执行清单。新增required在canonical采纳/实现阶段形成冻结manifest，任何旧门替代须有逐ID语义映射，旧失败留存。

## 4. 提案文档门与未来运行证据

本次只执行git diff --check、emoji、文档链接和新增文档落盘/隐私边界检查；即时exit、日志字节/SHA写任务外AUTHOR-RESULT，不冒称产品required通过。没有修改渲染资产，不产生产品截图。禁止在提案审查中运行产品测试、构建native、安装或改task预算。

未来每条运行证据需有 runId、candidateI/HEAD/fingerprint、exact-set清单、原argv、host/平台、startedAt/endedAt、原生进程终态、即时exit、selected/executed/unique/retry/skip/NOT_RUN/FAIL、日志字节/SHA、全部资源计费事件与未知项。日志/私有路径不提交；I/E提交真实且E记I不自指。作者结果不替代fresh独立结论。
