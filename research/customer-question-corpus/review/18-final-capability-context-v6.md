# SayDo 600 条潜在客户提问语料终审：能力、风险、上下文与工具闭合

- 审查日期：2026-08-26
- 审查身份：返工后的全新、零上下文、只读独立终审
- 审查范围：600 条问题、16 个 manifest、50 个 source、172 条 required claim、`validate.mjs`、`rebuild.mjs`，以及必要的 canonical、`packages/**` 和 `pipeline/**`
- 禁读范围：既有 review、Codex findings、prompts、logs、process journal、Git 状态与历史均未作为输入
- 最终结论：`[fail]`

## 1. 结论摘要

结构门为绿，但语义终审不通过。已确认：

1. 现有 33 条 `S3` 记录中，22 条是 `F3`、11 条是 `F4`；没有 `F1/F2`、`B0` 或空工具条目。这一部分正确地没有把 connector、登录态或用户口头意图当成当前 S3 签发与消费能力。
2. `ENG-112` 被标成 `F1`，但题目要求的是隔离环境中的勒索软件恢复验证，不是缺省启用的本地 workspace coding 闭环，属于当前能力误导。
3. 31 条仅含 `LIVE` 的题目用 `rag/document/pdf` 等通用标签代替具体 reader 或资料位置；另有 8 条带 CTX 的题目虽在 manifest 明确声明现场缺口，工具仍读不到该缺口。属于 RAG/LIVE 假闭合。
4. `CAR-011` 的 fixture 明知谈判优先项缺失，却只登记 `LIVE` 薪酬区间，没有要求用户提供优先项和可让步项。属于 required claim 补充输入假闭合。
5. 多条 `S0/B0` 记录实际读取客户、员工、绩效、审批、资料室或预算等敏感现势，另有明确法律、财务、授权边界仍为 `B0`。属于风险失真。
6. validator 对结构、摘要、固定 digest 和已知反例的边界说明是诚实的；但它用 ID 白名单让通用工具通过 `LIVE`，且风险和能力门主要依赖有限正则或固定 baseline，能够稳定放过本报告中的语义错误。

按本轮口径，存在 A/B 即为失败，故结论为 `[fail]`。

## 2. 审查基线与现有能力证据

### 2.1 F1 仅是缺省 coding 闭环

- `research/customer-question-corpus/00-能力边界.md:9-19` 只把本地项目、缺省 `coding`、Tier1 adapter、worktree、Gate 0、verify 和控制面列为当前核心能力。
- 同文件 `:23-32` 将网页、PDF、SaaS、外部信息与长任务列为有工具、登录、授权或可靠性条件的 `F2`。
- 同文件 `:34` 明确 connector、登录态和用户批准不能把任意 S3 effect 升为 `F2`。
- `packages/daemon/src/config/types.ts:113-121` 显示项目类型缺省启用集是 `['coding']`。
- `packages/daemon/src/tier1/typeGate.ts:14-32` 对未启用项目类型 fail-closed。
- `docs/plan/IMPLEMENTATION-PLAN-2.md:115-123` 将 research、marketing、general 合同、network_fetch 与四类型执行器放在后续 R-C/W8。

### 2.2 当前 effect 与 S3 消费面很窄

- `docs/09-data-contracts.md:273-295` 和 `packages/contracts/src/types/package.ts:10-29` 的 `EffectGrant` 白名单只有 `install_dependency` 与 `push_branch`。
- `packages/contracts/src/effects.ts:20-38` 只为这两类 effect 提供可签名的口播模板。
- `docs/09-data-contracts.md:367-375` 虽保留 publish、deploy、delete_data、external_send 等 S3 词表，但明确当前签发入口仅有 register 与 merge。
- `packages/daemon/src/tier1/s3Tools.ts:102-108` 的实际输入 schema 也仅允许 register 或 merge；`packages/daemon/src/api/s3Routes.ts:48-54` 的 API 只接注册、验签、状态与 approve-merge。

这组证据支持对 33 条 S3 记录的正面结论，也否定任何“有对应 app 工具即可算当前 S3 能力”的推断。

## 3. A 级发现

### A-01 `ENG-112` 把非 coding 的系统恢复验证标成 F1

- 题目证据：`research/customer-question-corpus/questions/01-software-it.md:242`，要求在隔离环境验证勒索软件恢复顺序和备份可信度，工具为 `filesystem,shell,test`，标签为 `F1/B0`。
- 能力证据：`research/customer-question-corpus/00-能力边界.md:64-67` 把 F1 限定在缺省 coding、Cursor adapter、workspace、Gate 0 与 verify 条件；`packages/daemon/src/config/types.ts:113-121` 缺省也只启用 coding。
- 构建原因：`research/customer-question-corpus/rebuild.mjs:1914-1925` 将所有 ENG 且工具都落在 `coreEngineeringTools` 的记录直接推成 F1，没有检查目标是否仍是 workspace coding。
- 影响：客户会把通用 IT 恢复环境、备份介质和系统级演练误读成当前已接线的本地 coding 闭环。
- 修复：将本行改为 `F2/B0`，明确需要隔离实验环境、备份访问权限与人工切换；或者把题面收窄为“在仓库内实现并验证恢复演练 harness”，再保留 F1。validator 增加“F1 必须命中当前 project type 和 workspace effect 合同”的门，不能只按前缀和工具推导。

### A-02 31 条纯 LIVE 记录以通用 RAG/文档工具冒充具体现势 reader

共同证据：

- `research/customer-question-corpus/README.md:25-31` 规定 `LIVE` 必须读当前 repo、系统、SaaS connector 或新鲜 Web 数据。
- `research/customer-question-corpus/03-频率与语义校准.md:53-63` 明确 `rag`、`document`、`pdf` 不能成为任意现势任务的万能 reader。
- 下表各题上下文都是单独的 `LIVE`，没有 `USER` 或 CTX 提供资料位置；工具又没有与题面实体匹配的当前系统 reader。

| ID | 题目证据 | 未闭合的具体输入 | 可执行修复 |
|---|---|---|---|
| PRJ-052 | `questions/02-product-project.md:64` | 原始目的、验收与真实交付结果；`test,automation` 不是项目事实 reader | 加项目系统、artifact/BI reader，或改为 `USER+LIVE` |
| PRJ-066 | `questions/02-product-project.md:150` | 当前政策、采购、公众沟通与技术实施资料 | 加官方 Web、采购/项目系统 reader，或要求 USER 提供受控资料 |
| WRT-035 | `questions/03-writing-content.md:54` | 论文全集、版本与出处 | 加 USER 文件集或学术检索 connector；不能只写 `pdf,rag` |
| WRT-055 | `questions/03-writing-content.md:70` | 现行政策与新版要求 | 加带权威和日期的文档库或官方 Web reader |
| WRT-032 | `questions/03-writing-content.md:93` | 定稿、来源和未核实项 | 加 USER、filesystem 或具体 CMS/repo reader |
| WRT-033 | `questions/03-writing-content.md:95` | 当前产品能力、客户问题和第三方证据 | 加 repo、CRM、browser 或 USER；`rag` 不能指代全部输入 |
| WRT-051 | `questions/03-writing-content.md:117` | 会员意见、少数意见与来源 | 加 forms/email/CRM 或 USER 资料集 |
| WRT-061 | `questions/03-writing-content.md:140` | 当前专业指南与适用版本 | 加权威医学来源或 USER 提供的带日期指南 |
| WRT-062 | `questions/03-writing-content.md:142` | 已批准人数、补偿和法律措辞 | 加 HR/审批文档库或 USER；仅 `rag` 无法证明已批准 |
| WRT-064 | `questions/03-writing-content.md:144` | 多轮评论、处置记录与少数意见 | 加评论系统/document repository 或 USER |
| WRT-068 | `questions/03-writing-content.md:152` | 贡献记录 | 加 USER、git、tasks 或受控贡献台账 reader |
| RES-014 | `questions/04-research-decision.md:32` | 新政策原文、效力日期和适用范围 | 加官方 Web reader或带日期 USER PDF |
| RES-025 | `questions/04-research-decision.md:44` | 题面所指十份材料 | 必须加 `USER` 或具体文档集合 locator |
| RES-027 | `questions/04-research-decision.md:79` | 上周研究、来源日期与刷新结果 | 加 memory/source register 加 browser，不能只有 `rag` |
| RES-039 | `questions/04-research-decision.md:97` | 三种政策结果的定义与当前政策依据 | 加 USER 或官方来源 reader |
| RES-048 | `questions/04-research-decision.md:118` | 过去二十个决定、当时证据和结果 | 加 decision ledger、memory/document store 或 USER |
| RES-053 | `questions/04-research-decision.md:128` | 获授权的社区健康数据与采集范围 | 加 database/forms/USER 与权限、去标识约束 |
| RES-056 | `questions/04-research-decision.md:130` | 十年情景报告的论文、产业证据和现势触发信号 | 加 browser、pdf corpus 或 USER，并登记来源日期 |
| OPS-039 | `questions/05-business-operations.md:108` | 多地点维修、能耗、合同和安全检查现势 | 加 facilities/BI/database/tasks reader；automation/notification 是动作工具，不是事实源 |
| SAL-011 | `questions/06-sales-customer-procurement.md:28` | 客户目标和产品使用 | 加 CRM 与 BI，不能只靠 `rag` |
| SAL-016 | `questions/06-sales-customer-procurement.md:57` | 真实合同、授权表和缺失信息 | 加 USER、e-sign/合同库；`pdf,rag` 只有在绑定具体文档时才成立 |
| SAL-031 | `questions/06-sales-customer-procurement.md:77` | 当前英文产品材料、本地术语和确认状态 | 加文档库、USER 与本地 reviewer 输入 |
| SAL-039 | `questions/06-sales-customer-procurement.md:98` | 临床客户材料、产品事实和获批专业声明 | 加 CRM/document/合规材料库与版本证据 |
| MKT-009 | `questions/07-marketing-growth.md:20` | 已授权案例材料、结果口径和客户原话 | 加 DAM/CRM/document repository 或 USER |
| MKT-028 | `questions/07-marketing-growth.md:69` | 当前文章、流量与事实新鲜度 | 加 CMS、BI 和 browser；automation 不能替代读取 |
| MKT-032 | `questions/07-marketing-growth.md:73` | 受众重合、嘉宾机会和主题证据 | 加 browser、CRM 或活动数据库 |
| MKT-039 | `questions/07-marketing-growth.md:96` | rebrand 各阶段采用证据 | 加 BI/analytics、DAM、tasks；image/design 不是采用证据 reader |
| MKT-041 | `questions/07-marketing-growth.md:98` | 当前临床证据及获批状态 | 加权威、带日期的临床/合规资料 reader |
| LRN-020 | `questions/09-learning-development.md:30` | 课程目标、学生基线与阅读材料 | 加 LMS/document store 或 USER；`rag` 本身不提供语料 |
| LRN-029 | `questions/09-learning-development.md:74` | 八地区当前政策、时区和本地批准要求 | 加官方 Web、政策库与本地 reviewer 输入 |
| LRN-030 | `questions/09-learning-development.md:76` | 文献集合、复现状态和可用资源 | 加 repo/document/artifact reader 或 USER；`test,rag` 未说明输入位置 |

这些行不是“工具尚未登录”的普通 F2 条件，而是语料自身没有表达工具应登录到哪个来源、也没有 USER 输入可供读取。因此执行前无法判断输入是否齐备。

### A-03 8 条 CTX+LIVE 合同声明了现场缺口，但工具读不到该缺口

| ID | 题目与 manifest 证据 | 工具缺口 | 可执行修复 |
|---|---|---|---|
| WRT-011 | `questions/03-writing-content.md:81`；`contexts/CTX-06/manifest.md:41` 要读当前口头交接、例外和升级实践 | `notification,document` 不能读取口头实践 | 加 `USER` 或 transcription/知识库 reader |
| SAL-015 | `questions/06-sales-customer-procurement.md:55`；`contexts/CTX-16/manifest.md:34` 要读当前厂商环境、演示和 POC 实测 | `test,video` 没有厂商环境入口 | 加 browser/vendor connector 与认证状态 |
| MKT-013 | `questions/07-marketing-growth.md:26`；`contexts/CTX-08/manifest.md:35` 要读当前获批素材、渠道授权和草稿状态 | `document,design,rag` 没有 DAM/CMS/审批 reader | 加具体资产与审批系统，或 `USER` |
| LRN-028 | `questions/09-learning-development.md:72`；`contexts/CTX-10/manifest.md:36` 要读每日表现、计划、提醒与目标确认 | `automation,notification,document` 未绑定学习表现或计划系统 | 加 LMS/tasks reader，重大目标确认走明确用户输入 |
| LIF-005 | `questions/10-personal-life-admin.md:16`；`contexts/CTX-13/manifest.md:33` 要读最近症状、两张清单和复诊安排 | `tasks,document` 中 tasks 只能误触 validator 的 direct reader，不能证明能读医疗记录或预约 | 加受权医疗文件与 calendar reader，或要求 USER 提供最新记录 |
| CAR-012 | `questions/11-career-freelance.md:22`；`contexts/CTX-11/manifest.md:36` 要读当前绩效结果、合作证据和反馈 | 只有 `tasks`，无法读取反馈或 HR/文档证据 | 加 `USER`、document/email/HRIS reader |
| PRJ-037 | `questions/02-product-project.md:103`；`contexts/CTX-03/manifest.md:47` 要读 beta 客户候选、招募授权与反馈状态 | `calendar,rag` 不读客户候选或授权 | 加 CRM/forms reader |
| PRJ-057 | `questions/02-product-project.md:121`；`contexts/CTX-05/manifest.md:37` 要读市场证据、能力缺口和竞争状态 | `tasks,document` 不能刷新外部市场与竞争现势 | 加 browser/rag/source register，或收窄为 fixture 内战略访谈 |

### A-04 `CAR-011` 的 required claim 漏掉 USER 补充输入

- 题目：`research/customer-question-corpus/questions/11-career-freelance.md:37` 要整理“我的证据、优先项和可让步项”，上下文只有 `CTX-11+LIVE`。
- manifest：`research/customer-question-corpus/contexts/CTX-11/manifest.md:35` 明说“当前市场薪酬与谈判优先项不在 fixture 内”，但 supplemental 只写“LIVE 获取带日期的市场薪酬区间”。
- source：`contexts/CTX-11/accomplishment-bank.md:3-9` 只有可证实经历；`job-requirements.md:1-9` 只有岗位要求；`resume-draft.md:1-12` 只有简历现状与语气。没有个人谈判优先项或让步边界。
- 影响：172 条合同的摘要和 source digest 都可保持正确，但回放仍会把不存在的用户决策输入当成已闭合。
- 修复：题目上下文改为 `CTX-11+USER+LIVE`；manifest supplemental 同时写明 USER 提供优先项、不可让步项与可让步项，LIVE 只负责带日期的市场区间；工具补充适合的 USER/document 输入路径。

### A-05 S0 敏感读取与高风险边界失真

共同规则：`research/customer-question-corpus/03-频率与语义校准.md:65-75` 明确敏感读取不能是 S0、企业敏感数据不能保留 S0、高金额法律或财务任务不能是 B0；`00-能力边界.md:71-80` 定义了 B-LEG、B-FIN、B-PRIV、B-ATTR 与 B-AUTH。

| ID | 题目证据与当前标签 | 失真 | 可执行修复 |
|---|---|---|---|
| WRT-026 | `questions/03-writing-content.md:87`，`S0 F3/B0` | 读取带说话人归属的访谈原话，缺隐私、同意和最小披露边界 | 至少 `S2/B-PRIV`；登记访谈授权、匿名化与可引用范围 |
| RES-009 | `questions/04-research-decision.md:24`，`S0 F2/B0` | 三年报价、迁移与涨价输入是企业财务现势 | 至少 `S2/B-FIN`；限定报价访问权限和决策 owner |
| RES-012 | `questions/04-research-decision.md:28`，`S0 F2/B0` | 实际席位、使用频率、替代成本和续费判断是敏感财务与使用数据 | 至少 `S2/B-FIN`；保留最终续费决定给 owner |
| RES-033 | `questions/04-research-decision.md:85`，`S0 F2/B0` | 三年成本与“复杂投资选择”仍为 B0 | 至少 `S2/B-FIN`；改成决策辅助并明确财务 owner 拍板 |
| RES-038 | `questions/04-research-decision.md:95`，`S0 F2/B0` | 投资尽调资料室含目标公司的客户、技术和风险机密 | 至少 `S2/B-PRIV`；要求 data-room scope、访问审计与专业转交 |
| OPS-020 | `questions/05-business-operations.md:36`，`S0 F2/B0` | 当前审批的项目、金额和风险属于敏感审批队列 | 至少 `S2/B-PRIV`；加入只读授权和最小字段 |
| OPS-030 | `questions/05-business-operations.md:48`，`S2 F2/B0` | 全公司 SaaS、owner、权限、数据类型和孤儿账号已有明显隐私与安全边界 | 风险可保留 S2，但主边界改 `B-PRIV` |
| SAL-013 | `questions/06-sales-customer-procurement.md:32`，`S0 F2/B0` | CRM/BI 中的团队使用、需求证据和受益人是客户敏感数据 | 至少 `S2/B-PRIV`；限定账户范围与授权用途 |
| MKT-026 | `questions/07-marketing-growth.md:92`，`S0 F2/B0` | 客户和员工材料没有授权、匿名化或披露边界 | 至少 `S2/B-PRIV`，或明确只用公开/已授权且去标识材料 |
| MKT-029 | `questions/07-marketing-growth.md:42`，`S0 F2/B0` | 固定预算和当前渠道成本是财务现势，输出在做资源分配 | 至少 `S2/B-FIN`；保留预算决策给负责人 |
| MKT-044 | `questions/07-marketing-growth.md:104`，`S0 F3/B0` | CRM 与销售反馈进入长期自动化，仍无客户敏感数据边界 | 至少 `S2/B-PRIV`；加账户范围、聚合与留存规则 |
| DAT-020 | `questions/08-data-finance.md:32`，`S0 F2/B0` | CRM 客户生命周期历史与缺失阶段是客户级经营数据 | 至少 `S2/B-PRIV`；优先聚合、最小字段与访问审计 |
| LRN-026 | `questions/09-learning-development.md:70`，`S0 F2/B0` | 岗位、技能、项目证据与晋级直接涉及员工档案与人事判断 | 至少 `S2/B-PRIV`；明确不自动晋级且限制人事数据访问 |
| LIF-024 | `questions/10-personal-life-admin.md:57`，`S0 F3/B0` | 个人副业客户、交付、票据和日历合并读取，涉及客户与个人财务信息 | 至少 `S2/B-PRIV`；分离票据与客户最小字段 |
| CAR-012 | `questions/11-career-freelance.md:22`，`S0 F2/B0` | 当前绩效、合作证据与反馈是个人就业敏感信息 | 至少 `S2/B-PRIV`；同时修复 A-03 的输入工具 |
| ENG-106 | `questions/01-software-it.md:112`，`S1 F2/B0` | 题面明确把法规结论交专业审核，主边界却仍是 B0 | 改为 `B-LEG`；S1 可保留 |
| PRJ-019 | `questions/02-product-project.md:38`，`S2 F2/B0` | 对原合同判断新增范围并明确“不要直接答应”，核心是承诺授权边界 | 改为 `B-AUTH`，并保留 change request 仅为草稿 |

## 4. B 级发现

### B-01 validator 的 scoped LIVE allowlist 不是可核验的来源绑定

- `research/customer-question-corpus/validate.mjs:44-54` 注释声称这些 ID 已绑定具体现势资料源，但实现只有一个 ID 集合与 `memory,rag,test,pdf,document,mobile,video,design,image` 通用工具集合，没有 source locator、connector、authority、scope 或 freshness 字段。
- `validate.mjs:750-755` 只要 ID 在集合且工具命中，就通过 LIVE 门。
- A-02 的 31 条记录由此全部通过；A-03 的若干记录还会被不相干的 `tasks/calendar` 误判为 direct reader。
- 修复：删除 ID 例外通道，改成逐题机器可读的 `live_source_contract`，至少含 `source_kind`、具体 locator/connector、可读字段、authority、as_of/freshness、授权主体；validator 比较题目所需实体与该合同，不允许裸 `rag/document/pdf`。

### B-02 `OPS-024` required claim 是题面名词换序，未登记实际 source 事实

- 题目：`research/customer-question-corpus/questions/05-business-operations.md:42` 要把同一客户的“等待、审批和风险”聚合。
- 合同：`research/customer-question-corpus/contexts/CTX-06/manifest.md:32` 仅写“交付流程中的等待、审批和风险类型”，没有列出任何 fixture 中的具体等待、审批或风险。
- 实际 source：`contexts/CTX-06/ticket-sample.md:3-6` 已有可登记的四个具体事实，包括字段表等待、未走 change request、4% 编码丢失和验收邮件未关联；`service-sop.md:3-10` 也有客户确认、抽检、书面验收和 change request 门。
- validator：`validate.mjs:1011-1020` 只禁止少数固定 generic 短语，换一种抽象措辞即可通过；`genericRequiredClaims=0` 因而不是语义证明。
- 修复：把 required claim 改成上述具体 source 事实，保持 LIVE 只补同一客户的当前事件；generic gate 增加“只复述题面名词、无 source 特有实体或值”的人工登记反例。

### B-03 rebuild 把工具形状当能力和上下文事实

- `research/customer-question-corpus/rebuild.mjs:1823-1839` 会因 live 工具自动加 `LIVE`，还会在 `rag` 且无上下文时自动选择 USER 或 LIVE。
- `rebuild.mjs:1914-1925` 会把 ENG 且工具落入 coreEngineeringTools 的题直接推成 F1。
- `rebuild.mjs:1955-1963` 再用多层固定 override 覆盖派生值；这能固定结果，但不能证明结果与当前实现匹配。
- `rebuild.mjs:2016-2071` 从硬编码 claim/supplemental 表生成 manifest 和 digest，不比较 claim 文本是否被 source 蕴含。
- 修复：F 标签从版本化 capability matrix 派生，矩阵直接引用当前 enabled project types、effect schema 与执行路径；上下文从显式 source contract 派生，禁止因工具词自动补 LIVE；claim/source entailment继续要求独立人工终审，并把已确认反例写成可判定门。

### B-04 validator 的风险与能力类别门覆盖不足

- `validate.mjs:771-773` 的敏感读取只匹配有限关键词，未覆盖 CRM 生命周期、客户团队使用、员工技能/晋级、绩效证据、资料室、审批金额和预算分配等 A-05 场景。
- `validate.mjs:791-802` 的外部 effect、圈外写入和高金额边界也依赖有限正则。
- 当前 33 条 S3 恰好都为 F3/F4，但代码没有一条通用规则表达 `00-能力边界.md:34` 的“未接通 effect 合同、签发、消费与反例门时不得 F2”。
- 修复：增加 `risk_subject`、`effect_kind`、`data_class`、`decision_owner` 等结构字段或等价登记表；validator 以枚举做交叉约束。当前能力矩阵未登记的 S3 `effect_kind` 必须是 F3/F4，不能只靠固定行 baseline。

## 5. 172 条 required claim、50 个 source 与 manifest 结论

### 5.1 全量结果

- 16 个 manifest、50 个 source、172 条 required claim 已逐条核对。
- source 文件数量、manifest 引用集合、digest、required claim ID 对称和 supplemental token 对称均由 validator 通过。
- source 对 claim 的语义蕴含：除 A-04 的 `CAR-011` 补充输入假闭合与 B-02 的 `OPS-024` generic claim 外，未发现其他明确的 A/B 级不蕴含。
- `MKT-029` 的“可约束预算组合假设与停止条件”和 `PRJ-047` 的“受影响角色、培训、试点与采用风险”仍偏抽象，建议下一轮改为 source 特有数值、角色和门槛，列为 C 级增强。

### 5.2 authority、as_of 与 valid_until

- 16 个 manifest 均有 claim_scope、authority 顺序或等价权威说明；冲突 source 没有被静默等权合并。
- 所有 `as_of` 不晚于本次审查日 2026-08-26；CTX-14 的 `as_of` 正好为 2026-08-26。
- 日期型 `valid_until` 均未过期；`fixture-frozen` 与 `immutable_event_window` 是 validator 明确允许的 sentinel。
- CTX-05、CTX-11、CTX-12、CTX-13、CTX-16 等动态包均明确要求在法规、岗位、报价、医疗排期或厂商状态变化时通过 LIVE 刷新。
- 因此未发现 authority、as_of 或 valid_until 的 A/B 级问题；失败来自 LIVE reader 与 supplemental 语义，而不是日期字段格式。

## 6. Effect 全量核对结果

### 6.1 S3 与当前能力映射

程序化核对 33 条 `S3` 记录得到：

```text
count=33
F3=22
F4=11
nonF3F4=0
B0=0
noTools=0
```

发送邮件、跨渠道发布、通知/分派、流量切换、预订、支付和 RFP 外发均没有标为 F2。代表行：

- 邮件发送：`SAL-002`，`questions/06-sales-customer-procurement.md:10`，S3/F3/B-AUTH，复述收件人和日期后确认。
- 跨渠道发布：`WRT-046`，`questions/03-writing-content.md:64`，S3/F3/B-AUTH，逐渠道确认。
- 流量切换：`ENG-074` 与 `ENG-104`，`questions/01-software-it.md:212,199`，S3/F3/B-AUTH，有监控和回滚。
- 支付：`FAM-004`，`questions/12-household-family-community.md:14`，S3/F3/B-AUTH，先复述金额再确认。
- 预订：`OPS-015`，`questions/05-business-operations.md:67`，S3/F3/B-AUTH，先确认总价与人员。
- 外发 RFP：`OPS-029`，`questions/05-business-operations.md:79`，S3/F3/B-AUTH，要求留证据。
- 直接通知和分派：`OPS-051` 与 `WRT-066`，`questions/05-business-operations.md:118`、`questions/03-writing-content.md:148`，均为 S3/F3。
- 渠道配置：`MKT-033`，`questions/07-marketing-growth.md:46`，S3/F3/B-AUTH，包含预览、旧值回滚和禁止历史补发。

这部分与当前只有 register/merge S3 消费路径的代码事实一致。

### 6.2 可逆圈外写入

已核对主要 S2 圈外写入：`OPS-017` 写日历/任务、`SAL-020` 写 CRM、`WRT-047` 更新 live 知识库、`DAT-015` 修正血缘、`FAM-013` 创建共享日历。它们均在题面中要求先给预览或候选、确认对象/目标/回退点后再写，风险不低于 S2，工具也与目标系统相符。未发现 A/B 级问题。

### 6.3 回执与回滚的场景层限制

`research/customer-question-corpus/01-设计与分布.md:5-7` 明确本目录是场景层，不宣称已有完整授权状态和验收 oracle。因此以下缺口列为 C，而不把它伪装成现有合同已坏：

- `SAL-002`、`FAM-004`、`OPS-015`、`WRT-046`、`WRT-066`、`OPS-051` 已表达确认边界，但没有完整的发送、支付、预订、发布或通知回执字段。
- 后续若选作执行 benchmark，必须补 `effect preview`、认证主体与通道、单次 receipt、失败补偿、可回滚条件、不可逆说明和验收 oracle。

## 7. validator 与 rebuild 的诚实边界

实际执行：

```text
command: node research/customer-question-corpus/validate.mjs
exit: 0
records: 600
fixtureSources: 50
requiredClaims: 172
genericRequiredClaims: 0
genericSupplementalInputs: 0
nearDuplicatePairsAt055: 0
final: [ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
```

`research/customer-question-corpus/README.md:46-54` 已明确说 validator 不替代逐题语义评审，也不能证明 claim 与 source 语义相符。这个边界陈述真实。必须据此解读退出码 0：它证明固定结构、digest、登记对称和已知反例门通过，不证明本报告 A/B 项不存在。

固定 baseline 的作用是防漂移，不是语义证明：

- `validate.mjs:812-825` 对部分记录比较固定字段与工具期望。
- `validate.mjs:1000-1003` 比较 required claim digest 与固定 baseline。
- `validate.mjs:1025-1028` 只对一小组 claim 做精确文本 baseline。
- `validate.mjs:1034-1038` 只检查 USER/LIVE token 字面是否对称。

因此 validator 退出 0 与本报告 `[fail]` 不矛盾。

## 8. C 级增强

### C-01 建立机器可读的 live source contract

每个 LIVE 题登记实体、来源类型、具体 locator 或 connector、所需权限、authority、as_of、freshness SLA 和不可用降级。这样可删除 `scopedLiveReaderIds`，也能区分“RAG 检索已给材料”和“联网刷新事实”。

### C-02 为执行 benchmark 增加 effect oracle

在场景层之外增加可选字段：`effect_kind`、`target`、`preview`、`approval_principal`、`auth_strength`、`receipt`、`rollback_or_compensation`、`negative_cases`。S3 只有在当前 capability matrix 中存在判别合同、签发、消费和反例测试时才允许 F2。

### C-03 把偏抽象 claim 改为 source 特有事实

除必须修复的 `OPS-024` 外，优先具体化 `MKT-029` 与 `PRJ-047`：写出 48.9% 漏斗断点、禁止承诺、广告授权缺口、具体试点/培训节点和未决迁移门。这样即使 source 被错误替换，合同也更可能漂移并触发人工复核。

## 9. 最终判定与修复顺序

最终判定：`[fail]`。

建议按以下顺序修复：

1. 先修 A-04 与 A-02/A-03 的输入闭合，禁止无具体 reader 的 LIVE。
2. 修 A-05 的 S0 与边界标签，并给敏感数据增加最小权限和披露范围。
3. 将 `ENG-112` 降为 F2 或收窄成 workspace coding 题。
4. 用机器可读 source/effect/capability matrix 替代 validator 的 ID allowlist 与关键词推导。
5. 具体化 `OPS-024`，再对 172 条 claim 重跑全新上下文人工终审。

在 A/B 全部关闭前，不应把本轮称为语义终审通过。
