## 实际读取范围与隔离声明

[ok] 本轮未读取任何禁读内容，未运行 `git status`、`git diff`、`git log` 或其他工作区历史命令，未修改、创建或提交正式文件。允许读取的 README、canonical、`HANDOFF.md` 和 `AGENTS.md` 中出现过禁读路径文字，但没有打开对应文件。因此本报告可按用户定义称为零上下文终审。

实际完整读取：

- 根目录 `AGENTS.md`。
- 语料 `README.md`、`00-能力边界.md`、`01-设计与分布.md`、`02-覆盖索引.md`、`03-频率与语义校准.md`。
- `questions/*.md` 全部 12 个文件。
- `contexts/README.md`、16 个 `CTX-*/manifest.md`。
- manifest 登记的全部 49 个来源：
  - CTX-01：`feedback-notes.md`、`product-brief.md`
  - CTX-02：`incident-timeline.md`、`log-excerpts.md`、`runbook-excerpt.md`
  - CTX-03：`launch-brief.md`、`milestones.md`、`stakeholder-notes.md`
  - CTX-04：`author-claims.md`、`source-notes.md`、`style-sample.md`
  - CTX-05：`interview-notes.md`、`official-and-market-snapshot.md`、`research-brief.md`、`source-register.md`
  - CTX-06：`service-sop.md`、`ticket-sample.md`、`weekly-metrics.md`
  - CTX-07：`account-brief.md`、`discovery-call.md`、`security-questions.md`
  - CTX-08：`asset-inventory.md`、`brand-guide.md`、`funnel-metrics.md`
  - CTX-09：`budget-summary.md`、`expense-policy.md`、`variance-notes.md`
  - CTX-10：`exam-outline.md`、`mistake-log.md`、`time-constraints.md`
  - CTX-11：`accomplishment-bank.md`、`job-requirements.md`、`resume-draft.md`
  - CTX-12：`constraints.md`、`moving-plan.md`、`vendor-quotes.md`
  - CTX-13：`care-calendar.md`、`care-notes.md`、`clinic-instructions.md`、`coordination-rules.md`
  - CTX-14：`event-brief.md`、`venue-rules.md`、`volunteer-roster.md`
  - CTX-15：`anomaly-report.md`、`lineage-notes.md`、`metric-contracts.md`
  - CTX-16：`evaluation-rules.md`、`rfp-summary.md`、`vendor-responses.md`
- `validate.mjs`、`rebuild.mjs`、`scripts/check-emoji.sh`、`scripts/check-emoji.mjs`、`HANDOFF.md`。
- 能力核验所需 canonical 相关节：`docs/01`–`05`、`09`–`11`、`docs/modules/c-control-bridge.md`、`docs/modules/e-crosscutting.md`、当前排产源。
- 当前实现中的路由、adapter、类型门、预算熔断、bridge/contracts/config 相关代码。

## 终局结论

[fail] 结构门绿色，但存在关键输入假闭合、真实外部 effect 低标、F1 能力过报、工具标签无法完成任务，以及成组的 D/H 周期错误。语料当前不能安全地按风险、工具、能力和生命周期标签直接选样使用。

## A 级问题

### [fail] A-01：四条 CTX-only 记录把来源不支持的事实写成已闭合

| ID | 实际文本与来源冲突 | 影响与最小修复 |
|---|---|---|
| PRJ-054 | [问题:132](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:132)：“哪些决定产品拍、哪些工程拍……”；[manifest:49](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-03/manifest.md:49) 却声称已有“决定范围”。[stakeholder-notes:3](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-03/stakeholder-notes.md:3) 只有各方偏好，[launch-brief:14](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-03/launch-brief.md:14) 只说“必须有人拍板”。 | 会把意见冒充正式授权。改为 `CTX-03+USER`，要求正式 RACI/授权政策；或只输出“待确认权限草案”。 |
| CAR-005 | [问题:31](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:31)：“根据岗位写一封……”；[job-requirements:9](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-11/job-requirements.md:9) 同时有差异显著的 A/B/C 三岗，未选目标。 | 无法形成针对性求职信。改为 `CTX-11+USER`，要求用户选 A/B/C 或提供完整 JD。 |
| LRN-008 | [问题:43](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:43)：“按我真正会的内容……”；[manifest:32](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-10/manifest.md:32) 声称来源证明“真正掌握”，但 [mistake-log:3](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-10/mistake-log.md:3) 只有错题，[exam-outline:5](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-10/exam-outline.md:5) 只有范围与权重。 | “没记为错题”不能推出已掌握。补 USER/测验证据，或先短测再选分享内容。 |
| LRN-003 | [问题:12](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:12)：“今天的错题”；[manifest:31](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-10/manifest.md:31) 写“当天”，实际 [mistake-log:1](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-10/mistake-log.md:1) 是“最近两次模拟题”。 | 时间和复盘对象均假闭合。改题为“最近两次”，或增加 `USER`/`LIVE` 的当天记录。 |

### [fail] A-02：四条题面明确指向现场材料，却没有登记 USER

| ID | 实际文本 | 最小修复 |
|---|---|---|
| WRT-037 | [问题:56](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:56)：“对照期刊格式检查篇幅、图表、引用和 AI 使用披露”，上下文为 `-`。 | `USER+LIVE`；提供稿件并实时取得期刊规则，工具补 `browser/rag`。 |
| LIF-020 | [问题:53](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:53)：“签证材料……哪些要翻译、快过期或还没预约”，只有 `LIVE`。 | 改 `USER+LIVE`；用户材料不能由现势 connector 冒充。 |
| CAR-004 | [问题:14](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:14)：“两个 offer……职责、成长、总包……”；只有 `LIVE`，工具仅 `spreadsheet,maps`。 | 加 `USER` 与 `pdf/email`；私人薪酬材料同时复核 S/B。 |
| CAR-008 | [问题:37](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:37)：“客户简报只有一页”，却只有 `LIVE`。 | 至少加 `USER` 提供 brief；需要市场现势时保留 `LIVE`。 |

共同影响是评测时模型可能直接编造缺失稿件、报价、材料或岗位选择，属于关键输入假闭合。

### [fail] A-03：真实 effect 或敏感读取被低标

风险 canonical 明确规定敏感读取不能是 S0，本地写至少 S1，对外消息属于 S3，见 [docs/04:134](~/WorkSpace/SayDo/docs/04-key-mechanisms.md:134) 和 [docs/04:138](~/WorkSpace/SayDo/docs/04-key-mechanisms.md:138)。

| ID | 当前文本与标签 | 最小修复 |
|---|---|---|
| LIF-003 | [问题:12](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:12) 读取个人真实账目，却是 `S0/B0`。 | 至少 `S2/B-PRIV`。 |
| ENG-096 | [问题:106](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:106)：“每周巡检……再叫我”，却是 `S0/B0`，还缺 `notification`。 | `S3/B-AUTH`，补通知工具，同时改 D4。 |
| RES-049 | [问题:54](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:54)：“持续更新……变化时给提醒”，却是 `S1/B0`。 | `S3/B-AUTH`、D4。 |
| OPS-051 | [问题:118](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:118)：“自动动作只限通知和分派”，却是 `S2/B0`。 | `S3/B-AUTH`。 |
| LRN-028 | [问题:72](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:72)：“每天……提醒和复盘”，却是 `S1/B0`。 | `S3/B-AUTH`、D4。 |
| DAT-017 | [问题:30](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:30)：“把指标从手工表迁到仓库……刷新和回填”，却是 S0。 | repo-only 至少 S1；若写现场数据库则 S2。 |
| ENG-110 | [问题:238](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:238)：“让发布包可重复构建，并……生成清单”，却是 S0。 | 至少 S1。 |

### [fail] A-04：工具/K 标签有不可执行或明显凑深度的记录

| ID | 实际工具问题 | 最小修复 |
|---|---|---|
| PRJ-005 | [问题:16](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:16) 查询多个项目阻塞，只列 `shell`。 | 改为 `tasks/issue-tracker`；只有明确项目系统是 CLI 才保留 shell。 |
| PRJ-018 | [问题:36](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:36) 要“能点的轻 Demo”，却只有 `tasks,document`。 | 至少 `design,browser`，需要实现时加 `repo/test` 并重算 K。 |
| OPS-012 | [问题:67](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:67) 只要求合同字段提取，却塞入 `tasks,crm,notification` 形成 K4。 | 收敛为 `pdf,spreadsheet,rag`，K2；若要写外部系统必须在题面说明。 |
| MKT-027 | [问题:38](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:38) 要结合产品事件和客服问题，却只有 `transcription,rag`。 | 补 `bi,issue-tracker`，重算为 K3。 |
| DAT-025 | [问题:61](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:61) 要分析历史到量、季节和服务水平，唯一工具却是 `tasks`。 | 改 `spreadsheet,bi`；落排班后才另加 tasks。 |
| OPS-030 | [问题:46](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:46) 盘点 SaaS、权限、数据类型和续费，只有 `tasks`。 | 增加实际 SaaS/身份/台账读取工具。 |
| DAT-026 | [问题:63](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:63) 盘点字段、用途、保留期和下游，只有 `tasks`。 | 至少 `database,rag/document`。 |

这些错误使工具族与 K 档不能作为工具路由或覆盖抽样依据。

### [fail] A-05：D/H 周期存在成组确定性错误

| ID | 题面时间语义 | 当前 | 最小修复 |
|---|---|---:|---:|
| MKT-004 [line 12](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:12) | “下月内容日历” | H0 | H2 |
| OPS-032 [line 85](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:85) | “排下月班” | H0 | H2 |
| SAL-014 [line 28](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:28) | “三年成本” | H0 | H3 |
| RES-033 [line 114](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:114) | “三年成本” | H0 | H3 |
| PRJ-068 [line 154](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:154) | “以后所有项目……” | D1 H0 | D4 H4 |
| OPS-053 [line 122](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:122) | 自动付款并在月底汇总 | D1 H0 | 至少 D4 H2；若持续月结则 H4 |
| ENG-096 [line 106](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:106) | 每周巡检 | D1 H4 | D4 H4 |
| RES-049 [line 54](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:54) | 持续监控并提醒 | D1 H4 | D4 H4 |
| WRT-065 [line 146](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:146) | “以后每天”发布 | D1 H4 | D4 H4 |
| DAT-028 [line 67](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:67) | 每天检查、隔离、通知 | D1 H4 | D4 H4 |
| LRN-028 [line 72](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:72) | 每日改计划和提醒 | D1 H4 | D4 H4 |
| LIF-029 [line 74](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:74) | “以后”完全托管 | D1 H4 | D4 H4 |
| FAM-020 [line 56](~/WorkSpace/SayDo/research/customer-question-corpus/questions/12-household-family-community.md:56) | 长期代决策、月底汇报 | D1 H4 | D4 H4 |

这不是配额审美问题，而是直接违反 [01-设计与分布:35](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:35) 对 D/H 的定义，导致周期标签选样失真。

### [fail] A-06：F1 将条件 connector 任务写成当前核心能力

- [ENG-012:26](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:26) 要读取现场数据库查询计划、索引或 schema，标为 F1。
- [ENG-054:72](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:72) 依赖 `issue-tracker` 续接现场任务，标为 F1。

[00-能力边界:25](~/WorkSpace/SayDo/research/customer-question-corpus/00-能力边界.md:25) 明确外部系统需要工具、登录态和授权时属于 F2。当前实现也没有已验证的通用业务 connector 层。最小修复是改 F2；若要保留 F1，必须把题面限定为本地 fixture、本地数据库或 SayDo 自有任务状态。

## B 级问题

### [warn] B-01：WRT-004 把本地稿件修改误报成 S3

[问题:14](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:14) 实际文本是“沿确认过的论点重写，并删掉找不到原始来源的数字”，没有发布、发送、部署或删外部数据，却标为 `S3/B-AUTH`。

影响是普通文稿修订会被错误送入强认证路径。最小修复：改为 S1；边界用 B0，若强调作者认领可用 B-ATTR。

### [warn] B-02：四处来源语义漂移，但因有 LIVE 或候选语义未形成直接假闭合

- CTX-14 [manifest:29](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-14/manifest.md:29) 将 [venue-rules.md:3](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-14/venue-rules.md:3) 的静态规则写成“场地退回意见”。应改为“场地安全规则”，退回差异由 LIVE 提供。
- [RES-006:18](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:18) 说“用户想要自动邮件”，但 [feedback-notes:7](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-01/feedback-notes.md:7) 明确三位受访者都未要求。应明确这是团队转述的待证假设，或增加 USER 原话。
- CTX-03 [MKT-011 claim:33](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-03/manifest.md:33) 写“主价值”，实际 [stakeholder-notes:4](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-03/stakeholder-notes.md:4) 只是销售希望作为主卖点。应标为候选卖点，等待产品/市场 owner 批准。
- [OPS-019:75](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:75) 要处理“三份供应商安全问卷”，CTX-07 实际只有一份客户向供应商发出的 [安全预问卷](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-07/security-questions.md:1)。LIVE 能补数据，但该 CTX 关联方向不一致；应移除或说明仅作为字段模板。

### [warn] B-03：边界标签漏标

以下题面已明确保留发送、提交、署名或专业判断边界，却仍是 B0：

- [PRJ-066:150](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:150)“外发由人审批”应为 B-AUTH。
- [SAL-038:83](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:83)“正式投标人工提交”应为 B-AUTH。
- [MKT-031:73](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:73)“任何 pitch 人工发送”应为 B-AUTH。
- [DAT-030:76](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:76)“发给投资人之前停住”应为 B-AUTH。
- [LRN-025:68](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:68)“申请由我提交”应为 B-AUTH。
- [CAR-016:43](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:43)“代写部分……让我认领”应为 B-ATTR。
- [MKT-042:100](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:100) 明确涉及投资推荐与自动交易边界，应为 B-FIN。

### [warn] B-04：ENG-062 把普通 coding 施工误归 F3

[ENG-062:78](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:78) 要把现有每日全量管线改为增量。目标管线持续运行不等于 SayDo 自身需要跨日 workflow。

最小修复：若是本地 repo 修改，改 F1 并使用 `repo,test`；若必须操作外部编排器，改 F2 并登记 connector。F3 不准确。

### [warn] B-05：DAT-009 的 R4 无题面依据

[DAT-009:20](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:20) 是基于完整 CTX 的一页月报，覆盖索引还将其列为“直达验收”，却标 R4。题面没有十轮以上或多会话依据，宜改 R1/R2。

## C 级问题

### [warn] C-01：近重复门没有输出人工裁决候选

[validate.mjs:278](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:278) 只做字符 bigram Dice，并在 [line 298](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:298) 仅保留 `>=0.55` 的 pair。本语料字符最高仅 0.324，因此结构门不会输出任何候选。

最小修复：保留硬阈值的同时输出无条件 top-N，供人工裁决；不要让“零过阈值”看起来像已完成跨措辞去重。

## 全量结构、覆盖与近重复结果

[ok] 独立解析结果：

- 固定 12 文件，600 条记录，600 个唯一且连续 ID，规范化问题零精确重复。
- 领域数量：ENG 120、PRJ 70、WRT 70、RES 60、OPS 55、SAL 45、MKT 45、DAT 35、LRN 30、LIF 30、CAR 20、FAM 20。
- 频率：H 270、M 210、L 120。
- C：31/251/237/60/21；D：277/281/26/3/13；现实 H：492/20/21/31/36；R：22/435/90/53；K：35/124/345/91/5；S：213/181/180/26。
- F1/F2/F3/F4：48/494/47/11。
- B0 417；B-AUTH 104；B-PRIV 30；B-FIN 14；B-LEG 14；B-MED 13；B-ID 6；B-ATTR 2。
- 50 条生活生产力，占 8.3%；娱乐主题检索为零。
- 个人、家庭、微型团队、中小组织、中型组织、大型/跨国/公共组织，以及一线、经理、高管、教师、照护者、志愿者均有覆盖。知识工作与数字流程偏重已在文档中诚实披露。

重点集合已全量回读：

- S0 213 条：发现 A-03 所列低标。
- S3 26 条：25 条成立，WRT-004 错标。
- F1 48 条：发现 ENG-012、ENG-054 能力过报。
- F4 11 条：全部为越权、冒充、隐私滥用或完全托管边界题。
- K0 35 条：除已列输入闭合问题外，纯对话或预注入材料成立。
- K4 5 条：ENG-120、OPS-053、MKT-036、DAT-035 成立；OPS-012 为明显工具膨胀。
- CTX-only 37 条：发现四条 A 级假闭合及 MKT-011 的 B 级来源升级。

[ok] 两路算法均实际遍历全部 `600 × 599 / 2 = 179,700` 对：

- 问题字符 bigram Dice：最高 0.324，`>=0.35` 为零。
- 问题加目的的中文分词 TF-IDF：`>=0.35` 17 对、`>=0.40` 4 对、`>=0.45` 2 对、`>=0.50` 1 对；最高是 RES-003/RES-049，0.509。
- 人工裁决了上述 17 对、字符 top 60 及跨措辞动作簇。RES-003/RES-049 是一次竞品地图与持续监控提醒；ENG-114/OPS-046 是身份工单冲突与全运营整合；RES-009/SAL-014 是纯 TCO 与采购硬门；WRT-063/OPS-035 是来源型历史档案与设备台账；LIF-010/LIF-015 分别优化总时间和带放弃项的稳健路线。均至少有两个实质维度不同。
- 未发现需要删除或合并的重复 pair；发现的是近邻标签不一致，而非文本重复。

## Context 与来源核验

[ok] 16 个 manifest、49 个来源、172 条 required-claim 合同、472 条来源引用边全部完成逐项核对；supplemental 为 `-` 37 条、USER 17 条、LIVE 118 条。

[ok] 所有来源文件均登记、非空，文件集合、摘要、白名单、合同 ID 和 supplemental token 结构闭合。

[fail] 语义层存在 A-01 的四条假闭合和 B-02 的四处漂移。除已列问题外，CTX-02、04、05、06、07、08、09、12、13、15、16 未发现额外来源断裂。

## 能力边界核验

[ok] `00-能力边界.md` 的总体现势描述与 canonical/代码一致：

- 当前用户派发固定 `route: "tier1"`：[liveTools:462](~/WorkSpace/SayDo/packages/daemon/src/brain/liveTools.ts:462)。
- 缺省 adapter 是 Cursor：[resolveAdapter:8](~/WorkSpace/SayDo/packages/daemon/src/tier1/resolveAdapter.ts:8)。
- `enabled_project_types` 缺省仅 coding：[config/types:113](~/WorkSpace/SayDo/packages/daemon/src/config/types.ts:113)；未启用类型在 [typeGate:25](~/WorkSpace/SayDo/packages/daemon/src/tier1/typeGate.ts:25) fail-closed。
- `HANDOFF.md` 记载本机曾显式开启 writing，不等于产品缺省；Claude live hooks/conformance 仍未执行：[HANDOFF:60](~/WorkSpace/SayDo/HANDOFF.md:60)。
- 当前实现未发现已验证的通用外部业务 connector 层。
- 单 attempt 的活跃墙钟、回合与成本熔断已接线：[executor:1290](~/WorkSpace/SayDo/packages/daemon/src/tier1/executor.ts:1290)；canonical 也诚实声明可靠跨天 workflow 未实现。

[fail] 文档总口径正确不等于每条 F 标签正确；ENG-012、ENG-054 和 ENG-062 是记录级反例。

## 构建、故障注入、mutation 与门禁

### 构建静态审查

[ok] [rebuild.mjs:1275](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:1275) 先创建完整暂存树，写完 12 个问题文件、复制全部 contexts、更新合同，并在暂存根执行 validator；成功后才晋升。

[ok] [rebuild.mjs:1225](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:1225) 的可捕获第三次 rename 失败控制流会保留旧 contexts、撤回新 questions、恢复旧 questions；回滚自身失败时保留 backup。该静态控制流成立。

[warn] 系统级只读沙箱阻止了真实第三次 rename 注入：

- `mktemp -d /tmp/saydo-corpus-audit.XXXXXX`：exit 1，`Operation not permitted`。
- `CORPUS_TEST_FAIL_RENAME_AT=3 node .../rebuild.mjs`：exit 1，但失败点是 [rebuild.mjs:1275](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:1275) 的初始 `mkdtemp EPERM`，没有到达第三次 rename。
- 正式树前后均为 78 文件；逐文件路径加 SHA-256 聚合摘要前后同为 `e53a92e1faaf576735f8df975f784e78f74e19e5ad1cd668da6a4c26bf7f9948`。

因此正式内容确实未变，但这不能冒充“第三次 rename 回滚实测通过”。

### 四类 mutation

[warn] 由于不能创建文件系统临时副本，以下在隔离的内存只读覆盖层执行，正式文件未变；这不完全满足“文件系统临时副本”的字面条件，但退出码是真实 validator 进程结果。

| Mutation | 实际退出码 | 结果 |
|---|---:|---|
| PRJ-003 改为直接向全部客户群发，保留 S0/B0 | 1 | 检出“真实外部 effect 未标 S3”和“越权自主未标 F4” |
| DAT-025 将 `tasks` 换成语义错误但同为 K1 的 `image` | 0 | 未检出工具语义错误 |
| CTX-10/LRN-008 换成无关长句并同步重算 claim digest | 0 | 未检出 claim 与来源无关 |
| CTX-01 `feedback-notes.md` 置空 | 1 | 检出“来源过短或为空”和 source digest 不匹配 |

### 正式门禁

- [ok] `node research/customer-question-corpus/validate.mjs`：exit 0；末行：`[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过`。
- [warn] 首次直接执行 `scripts/check-emoji.sh ...` 因文件无执行权限 exit 126。
- [ok] 按 README 的 `bash scripts/check-emoji.sh <限定语料文件>` 形态重跑：exit 0；末行：`[ok] emoji gate: clean`。

## 文档诚实性

[ok] 四组要求均诚实区分：

- 专家先验不等于市场概率：[README:7](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:7)。
- 场景清单不等于多轮 benchmark：[README:5](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:5)、[覆盖索引:50](~/WorkSpace/SayDo/research/customer-question-corpus/02-覆盖索引.md:50)。
- 摘要完整性不等于 claim 语义真实性：[contexts/README:16](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/README.md:16)。
- 可捕获回滚不等于断电或进程强杀原子性：[README:54](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:54)、[03:80](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:80)。

## Validator 仍不能证明

- required claim 真的由所列来源语义蕴含；重新计算摘要后的无关长句实际 exit 0。
- 工具族是否足够或必要；同 K 档的错误工具实际 exit 0。
- S/F/B、D/H/R 的完整语义；当前仅有少量 regex 和登记 ID 断言。
- 跨措辞同构；字符 bigram 阈值不能代替人工语义裁决。
- H/M/L 是真实市场概率、角色比例或行业代表性。
- LIVE connector、登录态、授权和当前执行路径实际可用。
- `rebuild.mjs` 在第三次 rename 的真实文件系统回滚表现，以及断电、进程强杀或 rollback rename 二次失败。
- 场景能构成完整多轮 benchmark、授权状态或验收 oracle。

最终裁决：结构完整、文档诚实、重复控制良好，但 A 级语义缺陷足以阻断按标签与上下文合同使用。

[fail]