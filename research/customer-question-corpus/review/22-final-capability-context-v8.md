# SayDo 600 条潜在客户提问语料 v8 最终能力与上下文独立终审

## 1. 结论

总判定：`[fail]`。

本轮发现 1 条 A 级、6 条 B 级、1 条 C 级问题。依据本轮规则，任一 A/B 即不能通过。正式 validator 的退出码为 0，但它证明的是结构、集合、摘要和少量显式反例门，没有推翻下面的语义与能力合同问题。

核心结论如下：

- 465 条 LIVE 合同的 986 个 locator 全部是由题号与 source kind 拼成的模板；752 个仍含 `USER-PROVIDED`，234 个仅指向抽象 `authorized-project-root`，没有一个给出对象 ID、路径/ref、tenant、query/filter 或 query/fragment。它们可以作为待解析前置条件，但不能同时被称为“具体 locator”与闭合来源。
- 986 个对象的字段、authority、freshness 和 principal scope 大量由固定词包机械填充。存在日历没有结束时间/时区、邮件没有正文、性能监控没有延迟/耗时、PR diff 合同却要求金额/币种等直接反例。
- 46 条 F1 中，ENG-001、ENG-048 仍依赖外部 database connector；ENG-053、ENG-089 的 effect kind 与题面动作相反。其余 42 条未发现同级阻断。
- 22 条非 F4 的 S3 请求全部没有逐题 effect 合同；现有 effect 表只覆盖 FAM-013 与 11 条 F4，无法表达 draft、确认、签发、消费、幂等、回滚或补偿。
- ENG-041 把“补上失败通知”标成 F2/S1/B0，与本目录自己的“自动通知不能仅凭工具升为 F2”相冲突。
- 多条 S0 实际读取访谈、学生表单、报名表、财务记录、CRM/预算或执行恢复/压测；SAL-022、SAL-035、RES-029、LRN-020 等也存在 B0 主边界过低。
- 172 条 required claims 的 claim 正文逐条对照 50 个来源后，未发现新的 claim 正文虚构；但 SAL-020 把题面口述的精确日期与“离线未确认”错归为 LIVE 会后原话，且 validator 的语义 spot 常量没有与实际 JSON 字段连接。

## 2. 审查范围与方法

本轮只读了任务允许的当前文件：本目录 README、00 至 04、12 个 questions 文件、16 个 context manifest 与全部 50 个 source 文件、12 个 LIVE JSON、F1 JSON、`validate.mjs`、`rebuild.mjs`，以及核对 locator 是否存在运行时实现所必需的 `docs/`、`packages/`、`pipeline/`。未读取旧 review 内容、`research/codex-findings/`、`prompts/`、`logs/`、`history/PROCESS-JOURNAL.md`、`test-mutations.mjs`，也未运行 Git diff/status/log。

全量对象遍历结果：

```text
questions=600
LIVE contracts=465
LIVE object sources=986
F1 contracts=46
context manifests=16
required claims=172
fixture source files=50
```

标签全集：

```text
F1=46 F2=483 F3=60 F4=11
S0=134 S1=180 S2=253 S3=33
B0=310 B-AUTH=118 B-PRIV=85 B-FIN=37 B-LEG=24 B-MED=11 B-ID=7 B-ATTR=8
```

对 465/986 的审查不是抽样：逐个 JSON object 遍历了 ID、题面、input modes、source kind、locator/provider、required fields、reader、authority、freshness/as_of 与 principal scope；另外按全部 45 个 source kind 汇总了恒定字段与字段并集，再回到题面逐项判断语义。具体反例用于说明全量规则的后果，不代表只检查了这些例子。

## 3. A/B/C 发现

### [A-01] LIVE-ALL：986 个 locator 全是不可解析模板，465 条“严格闭合”不成立

影响范围：全部 465 个 LIVE ID、全部 986 个对象。

规范要求 `LIVE` 为每个所读对象登记“具体 locator”，见 `research/customer-question-corpus/README.md:26-32` 与 `research/customer-question-corpus/03-频率与语义校准.md:60-63`。实际全量统计为：

```text
contracts=465
sources=986
exact_USER_template=752
exact_WORKSPACE_template=234
other_locator=0
unique_locators=986
without_query_or_fragment=986
source_kinds=45
```

这里的“unique”只来自把 ID 和 source kind 放进字符串。例如：

- SAL-020：`connector+crm://USER-PROVIDED/SAL-020/customer_account_state`，见 `research/customer-question-corpus/contracts/live/SAL.json:1113-1115`；没有 tenant、account/record selector 或 authenticated connector instance。
- OPS-002：`connector+calendar://USER-PROVIDED/OPS-002/authorized_calendar_state`，见 `research/customer-question-corpus/contracts/live/OPS.json:49-51`；没有 calendar ID、参与人映射或时间窗。
- ENG-044：`workspace+git://authorized-project-root/ENG-044/workspace_git_history`，见 `research/customer-question-corpus/contracts/live/ENG.json:1748-1750`；没有实际 project root、ref 或 revision range。

在 `docs/`、`packages/`、`pipeline/` 搜索这些 scheme 与 token，没有任何解析器或绑定实现：

```text
rg -l 'workspace\+repo://|connector\+[a-z-]+://|USER-PROVIDED|authorized-project-root' docs packages pipeline
RG_IMPLEMENTATION_EXIT=1
```

validator 只要求 locator 唯一并命中前缀正则，见 `research/customer-question-corpus/validate.mjs:1522-1532`。因此题号变化天然制造“唯一”，却没有制造可读取对象。authority 与 freshness 也同样是模板：986 个 `as_of` 全部相同；freshness 只有 5 种句型，其中 831 个为“本次分析开始前刷新”；authority 去掉角色前缀后只有 8 种后缀，450 个只是“来源系统 owner”。validator 对它们只检查包含 `owner/reviewer/主体`、`只读`、`刷新/陈旧度` 和固定时间 token，见 `validate.mjs:1549-1552`。

影响：运行者无法从合同确定读取哪个对象、由哪个实际主体授权、以什么查询边界读取，也无法证明数据在题面要求的时间点有效。将这些 URI 解释为“运行时待用户补齐”是合理设计，但这时状态必须是 unresolved precondition，不能计入 986 个已闭合对象并输出零缺口。

修复方向：

1. 拆分 `locator_template` 与 `resolved_locator`，增加 `resolution_state`、connector instance/tenant、对象选择器、query/filter/time window、授权凭据引用和读取探针结果；不得保存 secret 本身。
2. WORKSPACE locator 至少解析到真实 project root 下的 path/ref/command/test selector；USER connector 至少解析到具体账户与对象 query。
3. 只有 resolver 成功、只读探针可复核、scope 与题面最小字段匹配后才计作 closed；否则保留 F2/F3 前置条件并 fail closed。
4. validator 不再用 ID 拼接后的字符串唯一性代替对象可定位性。

### [B-01] LIVE-FIELDS：required fields 与题面实体不对应，并在多源对象间机械广播

影响 ID 至少包括 OPS-002、WRT-002、ENG-011、ENG-022、ENG-044、SAL-020；同一生成形态覆盖全部注册表，需要按 986 个对象重建而不是只修这些示例。

全量统计显示，323 个多源合同中，302 个带额外字段；125 个合同在不同 source kind 上拥有完全相同的额外字段集合，231 个合同的共同额外字段占并集至少 70%。这不是对象级 schema，而是把题目级词包广播到每个来源。

直接反例如下：

- OPS-002 的题面需要六个人、45 分钟、两个时区的共同空档，见 `research/customer-question-corpus/questions/05-business-operations.md:10`。日历对象仅登记 `event_id,participant,start_at,status`，却附加 `amount,currency,financial_status`，没有 `end_at/duration/timezone`，见 `contracts/live/OPS.json:38-67`。52 个 calendar 对象中没有一个登记 `end_at` 或 timezone，只有 2 个偶然带 `duration`。
- WRT-002 要从当前邮件线程确定缺失材料、影响节点、收件人与最晚日期，见 `questions/03-writing-content.md:10`；其 email source 没有 subject/body/content/attachment，只登记线程元数据与通用 task 字段，见 `contracts/live/WRT.json:6-40`。17 个 `authorized_email_thread` 全部没有正文/主题/附件字段。
- ENG-011 要定位列表性能瓶颈，见 `questions/01-software-it.md:30`；monitoring source 只有 `event_id,severity,event_time,source_timestamp`，没有 latency、duration、sample/window、route 或 list size，见 `contracts/live/ENG.json:524-604`。
- ENG-022 要证明快照可读且可恢复，见 `questions/01-software-it.md:46`；对象只有文件 digest、通用测试结果和 task 状态，没有 snapshot format、encryption/key reference、restore target、restore result/consistency 或 isolation，见 `contracts/live/ENG.json:1042-1118`。
- ENG-044 只需 diff 与测试结果生成 PR 描述，见 `questions/01-software-it.md:68`；git 和 test 两个 source 却都要求 `amount,currency,financial_status`，见 `contracts/live/ENG.json:1737-1791`。这些字段来自目的中的比喻性“理解成本”，不是题面实体。
- SAL-020 的实际 JSON 只有 CRM record/account/scope/updated_at/customer 字段，没有试点日期、候选状态或离线要求状态，见 `contracts/live/SAL.json:1113-1130`，但 validator 内另一份常量却宣称它有“试点日期、离线未知项、写入目标”，见 `validate.mjs:101-106`。

影响：reader 即使存在，也无法依合同取得回答所需信息；无关字段扩大读取范围，缺失字段则诱导模型从题面、角色或常识补齐。validator 的 `required_fields.length >= 4` 只证明数组非空，见 `validate.mjs:1534-1535`。

修复方向：以题面中的实体、关系、时间窗和输出断言逐对象写 schema；source-specific 字段不能整包复制。增加语义规则和可执行 fixture：calendar 必须能计算占用区间与时区，email/message 必须声明正文/附件读取范围，性能问题必须声明指标与观察窗，恢复任务必须声明隔离目标与一致性 oracle。对 986 个对象逐一回读，不用词包命中率作为通过条件。

### [B-02] F1-001/048/053/089：4 条 F1 不满足缺省 coding/workspace 或 effect 合同

46 条 F1 已逐条核对。以下 4 条失败：

| ID | 证据 | 结论 | 修复方向 |
|---|---|---|---|
| ENG-001 | 题面 `questions/01-software-it.md:121`；F1 合同允许 database 且只把 api 收窄到 workspace-local，`contracts/f1-capability-contracts.json:463-480`；LIVE 合同把 database 登记为 `connector+database://USER-PROVIDED/...`，`contracts/live/ENG.json:3274-3295` | F1 明称本地 workspace，同时依赖外部 connector，并与自身 denied scope 冲突 | 若只读 repo 中 schema/fixture，改成 WORKSPACE database locator 并收窄对象；否则降 F2 |
| ENG-048 | 题面 `questions/01-software-it.md:147`；F1 合同 `contracts/f1-capability-contracts.json:554-570`；外部 database locator `contracts/live/ENG.json:4057-4073` | “老版本 fixture”本可在 workspace 闭环，但合同却要求 USER connector；validator 没把 database 纳入 F1 条件工具检查 | 改成明确 workspace-local fixture/database，或降 F2；validator 覆盖所有非核心工具 |
| ENG-053 | 题面明确“只告诉我状态”，`questions/01-software-it.md:80`；F1 却给 `effect_kind=workspace_patch`，`contracts/f1-capability-contracts.json:388-403` | 查询被授权为 patch，扩大 effect | 改为 `workspace_read_or_document`，并锁定只读 tracker/evidence |
| ENG-089 | 题面要求“做重试、幂等、限流和降级”，`questions/01-software-it.md:100`；F1 却给 `workspace_read_or_document` 且无 test，`contracts/f1-capability-contracts.json:443-458` | 真实代码修改被建模为只读/文档，既不能授权实现，也不能验证行为 | 改为 `workspace_patch`，补相称测试工具与失败/幂等验证；若仅要方案则重写题面 |

validator 只对 `api/monitoring/tasks` 三种工具要求 workspace-local，见 `validate.mjs:1578-1580`，因而 ENG-001/048 的 database 漏过；对 effect kind 仅检查字符串长度，见 `validate.mjs:1572-1573`。

其余 42 条未发现同级阻断：ENG-002、ENG-003、ENG-005、ENG-006、ENG-008、ENG-010、ENG-014、ENG-015、ENG-016、ENG-018、ENG-019、ENG-020、ENG-024、ENG-025、ENG-026、ENG-029、ENG-034、ENG-037、ENG-044、ENG-046、ENG-047、ENG-060、ENG-070、ENG-023、ENG-032、ENG-033、ENG-043、ENG-051、ENG-052、ENG-055、ENG-061、ENG-067、ENG-068、ENG-081、ENG-083、ENG-101、ENG-116、ENG-097、ENG-103、ENG-108、ENG-113、PRJ-031。

### [B-03] EFFECT-22：22 条非 F4 的 S3 没有逐题 effect、消费或回滚合同

受影响 ID：ENG-104、ENG-074、ENG-096、PRJ-045、WRT-046、WRT-066、RES-049、OPS-033、OPS-048、OPS-015、OPS-029、OPS-039、OPS-051、SAL-002、MKT-033、MKT-036、DAT-028、LRN-009、LRN-028、LIF-006、FAM-004、FAM-015。

这些题分别包含流量切换、外部提醒/通知、跨渠道发布、预订、RFP 发题、消息分派、邮件发送、配置写入、quarantine、出题和支付等真实 effect。代表行：

- ENG-074 流量切换与回滚：`questions/01-software-it.md:214`。
- OPS-029 RFP 发题与收件：`questions/05-business-operations.md:79`。
- SAL-002 确认后发送邮件：`questions/06-sales-customer-procurement.md:10`。
- MKT-033 确认后写渠道配置并禁止补发：`questions/07-marketing-growth.md:46`。
- FAM-004 确认后支付：`questions/12-household-family-community.md:14`。

能力边界明确说当前直接签发/消费路径不覆盖这些 effect，见 `research/customer-question-corpus/00-能力边界.md:23-34`。F3 标签本身大体诚实，但合同层只有通用 `READ_ONLY_OR_REVIEWED_EFFECT`，没有 draft、target、decision owner、preview digest、confirmation binding、consumer、idempotency、rollback/compensation 或 evidence 字段。

`finalV8EffectContracts` 仅包含 FAM-013 和 11 条 F4，见 `validate.mjs:187-200`；validator 对它们也只检查三段字符串及少量标签，见 `validate.mjs:1714-1734`。11 条拒绝合同还统一写 `reversible: true`，把“被拒绝的原请求是否可逆”和“安全 rescope 是否可逆”混在一起。

修复方向：为所有 S2/S3 外部 effect 建立逐题 typed contract，至少区分 `requested_effect`、`allowed_effect`、`draft_only`、签发条件、确认绑定对象、consumer、幂等键、回滚或补偿、不可逆标记和证据；F3 必须明确 `consumer_status=unimplemented` 并禁止执行。validator 要求 effect ID 集合与需要 effect 的题面集合全等。

### [B-04] ENG-041：自动失败通知误标 F2/S1/B0

题面要求“查清”后“补上失败通知”，工具是 `automation,notification,monitoring`，没有 repo/test，标签却是 `S1 F2/B0`，见 `research/customer-question-corpus/questions/01-software-it.md:141`。LIVE 合同只登记 monitoring 读取，见 `contracts/live/ENG.json:3853-3884`，完全没有 notification 的 target、收件人、审批、消费或回滚。

这与本目录 `00-能力边界.md:34` 的明文规则冲突：自动通知不能仅因存在工具或登录态升为 F2。validator 的 effect 正则只覆盖固定句式，见 `validate.mjs:1690-1698`，没有命中“补上失败通知”。

修复方向：若题意是配置真实自动通知，改为 F3/S3/B-AUTH 并纳入 [B-03] 的 effect 合同；若题意只是 coding workspace 修改，则改工具为 repo/test/monitoring，明确仅修改本地代码与测试，不发送真实通知，并按真实 workspace 能力重新评 F1/F2。

### [B-05] RISK-S0/B0：敏感读取与专业/授权主边界仍有低标

`03-频率与语义校准.md:65-76` 明确规定敏感读不能 S0、企业敏感数据不能 S0、真实 effect 与专业边界要正交。以下是全量 S0/B0 回读后的明确反例：

| ID | 当前标签与 source 证据 | 问题 | 修复方向 |
|---|---|---|---|
| ENG-022 | S0/B0；快照、restore test 与任务状态，`questions/01-software-it.md:46`、`contracts/live/ENG.json:1042-1118` | 真正证明“能恢复”需要隔离 restore effect，并可能接触全量备份 | 至少 S1；涉及真实敏感备份或非隔离环境则 S2/B-AUTH，补隔离目标与清理门 |
| ENG-073 | S0/B0；真实流量模型、压测和 monitoring，`questions/01-software-it.md:175`、`contracts/live/ENG.json:4827-4896` | 给容量结论必须执行负载 effect；未限定非生产环境 | 至少 S1，若连接共享/生产环境则 S2/B-AUTH；明确 test target 与 stop gate |
| WRT-044 | S0/B-ATTR；具 speaker/utterance 的获授权访谈，`questions/03-writing-content.md:109`、`contracts/live/WRT.json:884-911` | 已授权不等于非敏感 | 至少 S1；保留 B-ATTR，并在题面/合同写最小披露与 retention |
| RES-029 | S0/B0；价格测试访谈 transcript 与 speaker utterance，`questions/04-research-decision.md:50`、`contracts/live/RES.json:937-994` | 读取可识别访谈和价格敏感度，既非 S0 也非 B0 | S1/S2，主边界改 B-PRIV；若只规划研究则删除 transcript LIVE reader |
| OPS-013 | S0/B0；当前报价与 finance 记录，`questions/05-business-operations.md:65`、`contracts/live/OPS.json:1600-1649` | 读取供应商报价/保险/费用属于企业财务材料 | 至少 S1；按实际采购授权选择 B-AUTH 或 B-FIN |
| MKT-010 | S0/B0；报名 form submissions 含 respondent scope，`questions/07-marketing-growth.md:22`、`contracts/live/MKT.json:283-354` | 活动报名人数据不是 S0 | 至少 S1；若读取真实报名者，主边界 B-PRIV；若只审流程则删除 forms 现势读取 |
| MKT-045 | S0/B-AUTH；CRM、spreadsheet 与 finance 中的地区受众、伙伴、预算，`questions/07-marketing-growth.md:106`、`contracts/live/MKT.json:2136-2217` | 明确企业预算与 CRM 读取仍标 S0 | 至少 S2；保留 B-AUTH 并明确最小聚合范围 |
| DAT-016 | S0/B-AUTH；预算差异、table 与 financial records，`questions/08-data-finance.md:28`、`contracts/live/DAT.json:431-489` | 企业财务现势读直接违反“企业敏感数据不得 S0” | 至少 S2；按实际输出决定 B-FIN 或保留 B-AUTH，并记录 owner/period |
| LRN-020 | S0/B0；学生进度 form 含 learner/respondent，`questions/09-learning-development.md:30`、`contracts/live/LRN.json:211-268` | 学生表现数据属于隐私材料 | 至少 S1，主边界 B-PRIV；使用去标识/聚合数据 |
| FAM-012 | S0/B-AUTH；学校申请 form submissions 与家庭日历，`questions/12-household-family-community.md:39`、`contracts/live/FAM.json:535-589` | 家庭/申请内容和 respondent scope 非 S0 | 至少 S1/S2；保留 B-AUTH，并增加 B-PRIV 限制到题面或合同 |
| SAL-022 | S0/B0；正式 RFP 当前答复、owner、证据、风险与截止，`questions/06-sales-customer-procurement.md:61`、`contracts/live/SAL.json:1135-1218` | 正式响应会形成客户能力陈述；同类 WRT-008 已标 B-AUTH | 至少 S1，主边界 B-AUTH，输出限定 draft/approved claims |
| SAL-035 | S2/B0；按 RFP/POC“验收供应商”，`questions/06-sales-customer-procurement.md:92`、`contracts/live/SAL.json:1782-1865` | 题面没有把最终采购验收决定留给 owner | 改 B-AUTH，并改写为“生成验收证据与建议，最终验收由采购 owner” |

这些条目不是因为出现某个工具名就机械升档；上表只列题面目标与实际 source object 同时指向敏感数据或现实 effect 的记录。对于只读公开规范、纯架构元数据等合理 S0，没有硬判。

### [B-06] SAL-020：题面口述被错当 LIVE，会后事实合同与 validator spot 脱节

题面在用户当前口述中给出“2026 年 10 月 1 日前”和“离线还没确认”，见 `questions/06-sales-customer-procurement.md:59`。CTX-07 的真实 source 只说“10 月试点决策”，见 `contexts/CTX-07/account-brief.md:9`；manifest 也正确承认本次会后原话需补充，见 `contexts/CTX-07/manifest.md:42`。

问题在于 LIVE JSON 的 input modes 只有 `CTX-07+LIVE`、`user_locator=-`，并声称 LIVE 读取“本次会后原话”，见 `contracts/live/SAL.json:1101-1115`。实际唯一 source 是 CRM，字段只有 record/account/scope/updated/customer，见同文件 `1116-1130`，既读不到刚刚说出的原话，也没有 decision date/offline status/candidate state。

validator 的 `reviewedLiveReaderSpotContracts` 在另一份常量中写了“试点日期、离线未知项、写入目标”，见 `validate.mjs:101-106`；使用处只检查该常量的字符串长度和题目是否含 crm 工具，见 `validate.mjs:1637-1649`，完全没有与 SAL JSON 的 fields/locator/authority 比较。`questionOnlyConstraintContracts` 只点名 LRN-003、LRN-006，见 `validate.mjs:201-204`，SAL-020 因而漏过。

修复方向：为当前 prompt 增加显式 `QUESTION/USER` 输入来源，CRM LIVE 只负责读取目标 record 与当前状态；required fields 明确 `decision_deadline`、`offline_requirement_status`、`candidate_status`、`target_record_id`。把 spot contract 直接绑定并比较实际 JSON，禁止平行常量自证。

### [C-01] VALIDATOR/REBUILD：边界说明基本诚实，但“rebuild/完整性”名称仍容易被误读

README 已明确承认 validator 不证明任意 claim 蕴含、真实授权或市场概率，见 `research/customer-question-corpus/README.md:57`，这一点应保留。

但 `rebuild.mjs` 并不重建 LIVE/F1 registry：它在 `rebuild.mjs:2436-2445` 直接读取现有 JSON，在 `2468-2486` 做形状检查，在 `2679-2681` 把 contracts 原样复制到 staging，再生成 04 展示。validator 的成功文案是“登记合同完整性与已知语义反例门通过”，见 `validate.mjs:2161-2169`。结合 [A-01]/[B-01]，这里的“完整性”只能解释为 schema presence 与集合对称，不能解释为 object-resolved 或 semantic-complete。

建议把脚本/README 输出改成“registry shape/render rebuild”，并在 summary 同时打印 unresolved locator、未覆盖 effect、payload-field 缺口和 semantic review 状态；不要用 `genericSources=0` 表示没有模板来源。

## 4. Context 与 claim 全量结论

16 个 manifest 的逐条数量为：

```text
CTX-01=13 CTX-02=12 CTX-03=22 CTX-04=6
CTX-05=10 CTX-06=15 CTX-07=16 CTX-08=15
CTX-09=8 CTX-10=9 CTX-11=9 CTX-12=4
CTX-13=6 CTX-14=3 CTX-15=11 CTX-16=13
total=172
```

逐条对照 50 个 source 文件后的结论：

- `[pass]` 172 条 claim 正文均能由列出的 source 直接支持或以“未知/需 USER/LIVE”形式诚实限定；未把分析判断写成来源原文。
- `[pass]` CTX-03/PRJ-047 把 80%、10 月 8 日、50 租户等来源事实与“是否构成采用风险”的推断分开。
- `[pass]` CTX-10/LRN-003 的“十分钟”和 LRN-006 的“下周客户会”没有写成 fixture 事实，属于题面约束。
- `[fail]` CTX-07/SAL-020 的 claim 正文只写“十月”且本身正确；失败点是 supplemental/输入类型把刚刚口述的精确事实说成 LIVE 可读，详见 [B-06]。

因此 claim source entailment 子项可通过，但 CTX+LIVE 输入闭合整体不能通过。

## 5. Validator 真实运行证据

执行命令：

```text
node research/customer-question-corpus/validate.mjs
validator_rc=$?
print -r -- "VALIDATOR_EXIT=$validator_rc"
```

原始输出关键摘录：

```text
"records": 600
"fixtureSources": 50
"requiredClaims": 172
"liveSourceContracts": 465
"liveObjectSources": 986
"liveContractAudit": {
  "missingContracts": 0,
  "extraContracts": 0,
  "genericSources": 0,
  "emptyLocators": 0,
  "missingContractOrSourceFields": 0,
  "readerMismatches": 0,
  "ctxSupplementalMismatches": 0
}
"f1CapabilityContracts": 46
[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
VALIDATOR_EXIT=0
```

判读：结构门通过；由于 [A-01] 至 [B-06] 均可在该退出码下存在，本轮最终能力与上下文语义门为 `[fail]`。

## 6. 建议修复顺序

1. 先处理 [A-01]：把 locator 改成可解析对象或显式 unresolved precondition，停止报告 986 个来源已闭合。
2. 按 source kind 建题面实体 schema 并全量重写 986 个对象，优先 calendar/email/message/table/database/pdf/web 与恢复/性能类对象。
3. 修正 4 条 F1，重新跑 46 条逐题 F1 对账。
4. 为 22 条 S3 及所有 S2 圈外写入补 typed effect contract、消费门和回滚/补偿语义。
5. 回修 ENG-041、S0/B0 表中条目和 SAL-020 输入归因。
6. 将 validator 的 spot 常量绑定实际 registry，再由新的零上下文会话复审 600/465/986/172 全集。
