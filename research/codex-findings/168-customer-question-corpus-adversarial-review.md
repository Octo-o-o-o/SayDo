# 总判定：不通过

当前版本确有 600 个合法表格记录、600 个唯一 ID，结构门禁真实通过；但“600 个不同情境”、标签可信度、能力边界、RAG 可回放性及评测可用性均存在阻断失真。它目前适合作为场景灵感清单，不适合作为产品能力覆盖结论或自动评测集。

## 实际门禁与审查范围

实际执行：

```text
node research/customer-question-corpus/validate.mjs
exit 0
records=600
H/M/L=270/210/120
[ok] 600 条提问语料结构门禁通过
```

未信任上述自报结果，另行解析全部 Markdown 表格，得到：

- 12 个问题文件分别为 `120/70/70/60/55/45/45/35/30/30/20/20` 条。
- 600 个九字段数据行，600 个唯一 ID、600 个精确规范化后唯一题面。
- 0 个未解析数据行、0 个空单元格、0 个 ID 缺口。
- 当前数据中无重复工具 token、无重复 CTX token、无 K 数量计算错误、无 H/M/L 章节错位、无文件前缀错位。
- 16 个 CTX 目录真实存在，当前 manifest 的本地链接都能解析到文件。
- 已遍历全部 600 条，并逐领域检查 H/M/L 三段；另逐条审查 276 条带 CTX 的记录、277 个引用边。
- 语料目录单独执行 emoji 门禁为 `[ok]`。全仓 `bash scripts/check-emoji.sh` 当前退出 1，但命中均在本审查范围外的 `docs/site/`，不能据此判语料违规，也不能声称全仓门禁通过。

---

# A 级问题

## A-1：精确数量为 600，但“600 个不同情境”不成立

证据：

- [README.md:3](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:3) 声称“恰好 600 个互不相同”的场景。
- [01-设计与分布.md:82](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:82) 要求角色、输入、约束、输出、验收至少两个维度不同。
- 仍存在明确的任务级近重复：

  - [DAT-031](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:47) 与 [LIF-015](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:26)：均为整理收入、费用、票据及会计问题，并禁止代做税务分类或申报；主要变化只有角色和少量措辞。
  - [OPS-040](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:51) 与 [DAT-024](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:35)：均按控制项索引样本、审批、凭证/政策和系统日志，并将审计结论留给审计人员。
  - [ENG-028](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:34) 与 [WRT-020](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:26)：均用 CTX-02 写无责事故复盘，拆分根因、促成因素和行动项。
  - [PRJ-046](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:57) 与 [SAL-028](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:39)：均选取不同类型客户顾问、准备议题并记录少数意见。
  - [RES-007](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:13) 与 [MKT-006](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:12)：均针对“邀请队友”漏斗掉点，先按渠道和设备切片再形成假设。
  - [WRT-019](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:25) 与 [SAL-012](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:18)：均根据同一事故包撰写客户状态更新。

- 600 条记录中有 599 个不同的角色字符串，但角色字符串唯一不等于任务情境唯一，反而说明角色文本被用于掩盖任务框架复用。
- 没有证据表明语料是大规模逐字模板扩写；问题是已确认的语义簇足以推翻“600 个互不相同”的绝对结论。

影响：

- 有效情境数低于 600，领域配额和覆盖结论被重复任务抬高。
- 后续抽样可能把同一能力重复计分，并错误认为覆盖了不同用户问题。

最小修复：

- 以“输入、决策、产物、验收、外部 effect”建立语义签名并全量聚类。
- 将同一任务的角色变化显式标为 `persona_variant`，不计入不同场景数。
- 替换确认重复项后，重新保证 600 个任务签名唯一。

## A-2：C/D/R/K/S 不是可信的独立标签，工具深度和风险存在系统性构造

[01-设计与分布.md:41](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:41) 将复杂度、周期、轮次、工具深度和风险定义为独立维度，但全量统计显示强机械耦合：

- 120 条 L 全部是 `C5 + R4`。
- L 中 114/120 为 K4，95/120 为 S3。
- H 中没有 C5；M 中 177/210 为 R4。
- C1 仅 3 条、R1 仅 7 条、K0/K1 合计仅 11 条。
- 342 条 K4 全部恰好列 6 个工具。
- 184 条 K3 中 180 条恰好列 4 个；63 条 K2 中 62 条恰好列 2 个。
- 合计 595/600 条恰好落在所属 K 档的最低工具数，明显是按验证器阈值反填工具。

具体误标：

- [MKT-020](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:26) 只是排发布时间和 owner，却列满 `calendar,tasks,email,crm,document,notification` 并标 K4/S3。
- [DAT-010](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:16) 仅只读识别疑似重复付款，明确“不认定、不冲销”，仍加入 `tasks,e-sign` 并标 S3。
- [WRT-037](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:48) 只做投稿格式检查、投稿由用户确认，却加入 `e-sign,email` 并标 S3。
- [RES-044](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:55) 只比较办公地点、最终选择由管理层做，仍标 S3。
- [LIF-004](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:10) 明确不取消订阅，仍标 S3。
- [CAR-007](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:13) 只要求写消息，未要求发送，仍标 S3。
- [FAM-003](~/WorkSpace/SayDo/research/customer-question-corpus/questions/12-household-family-community.md:9) 只整理复诊材料且不改药，仍标 S3。

[docs/04-key-mechanisms.md:132](~/WorkSpace/SayDo/docs/04-key-mechanisms.md:132) 要求按实际 effect 分级，而不是按主题或潜在下游后果分级。193 条 S3 中至少有 61 条明确将实际动作留给人，或只要求草稿、比较、整理；并非这 61 条都必然应降级，但上述实例已证明存在系统性高估。

D 也混合了两个不同概念：

- [CAR-010](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:21) 因计划覆盖十二周而标 D3。
- [LRN-025](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:41) 因课程覆盖两年而标 D4。

这无法区分“生成计划所需时间”与“现实项目持续时间”。

影响：

- 标签不能用于预测执行成本、交互成本、工具选择或安全策略。
- 一个模型如果正确减少工具或把只读任务降为 S0/S1，反而会与语料标签不一致。
- H/M/L、C/R/K/S 之间的耦合会制造虚假的标签学习捷径。

最小修复：

- 隐去 H/M/L 后重新逐条标注 C/D/R/K/S。
- D 拆为 `agent_elapsed_time` 与 `real_world_horizon`。
- K 只统计完成当前请求必需的唯一工具族，并为每个工具记录 action rationale。
- 工具动作细分为 `email:read|draft|send`、`finance:analyze|pay` 等。
- S3 必须绑定题面明确请求的目标、动作及外部 effect。

## A-3：F1–F4 与当前能力真相源冲突，也混淆了安全边界与产品成熟度

[00-能力边界.md:24](~/WorkSpace/SayDo/research/customer-question-corpus/00-能力边界.md:24) 已将浏览器、PDF、表格、演示、邮件、日历及 SaaS connector 列为条件能力 F2；全量仍有 28 条 F1 使用这些工具。

具体冲突：

- [SAL-007](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:13) 使用 CRM，标 F1。
- [MKT-011](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:17) 使用 slides/CRM 且属于 marketing，标 F1；同一能力说明又将正式 marketing 执行器列为 F3。
- [LIF-013](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:19) 依赖日历，标 F1。
- [CAR-010](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:21) 依赖日历、通知及跨十二周续接，标 F1。
- [FAM-010](~/WorkSpace/SayDo/research/customer-question-corpus/questions/12-household-family-community.md:16) 读取家庭日历和待办，标 F1。

另一方面，F4 将“敏感领域”错误等同于“越界请求”：

- [LIF-005](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:11) 只整理症状、不判断病因，仍为 F4。
- [WRT-055](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:66) 只做政策差异草稿，法律判断交法务，仍为 F4。
- [DAT-024](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:35) 只索引审计证据，结论由审计师作，仍为 F4。
- [FAM-003](~/WorkSpace/SayDo/research/customer-question-corpus/questions/12-household-family-community.md:9) 只做就医准备，仍为 F4。

64 条 F4 中有 47 条已经明确写出人工或专业边界，导致同一标签同时表示：

1. 应安全完成的资料准备；
2. 需要条件工具的任务；
3. 尚未成熟的正式执行器；
4. 应拒绝的医疗、法律、金融判断或未授权动作。

此外，[ENG-100](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:116)、[ENG-111](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:127)、[ENG-112](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:128) 等长期、高风险、跨系统工作仍标 F2，与“尚不承诺任意长期可靠 workflow”的边界冲突。

影响：

- 数据无法可靠回答 SayDo 现在能做、条件能做、未来能做和必须拒绝什么。
- 会把正确完成医疗/法律/金融资料准备误判成越界，也会高估当前 connector 和长期 workflow 能力。

最小修复：

- 将 F 拆成至少三个字段：

  - `executor_fit=core|conditional|roadmap`
  - `dependency=local|connector|auth|fresh_web|human`
  - `boundary=none|medical|legal|financial|authorization|privacy`

- 只有题面真的要求专业结论或未授权 effect 时，才进入拒绝型边界测试。
- 按 `docs/09`、roadmap 和 HANDOFF 当前验证状态重新生成能力矩阵并逐条重标。

## A-4：至少 82 个 RAG 引用边不受配套材料支持

完整审查了全部 277 个 CTX 引用边，保守认定 82 个存在主题、实体、周期、规模或必要数据缺失：

```text
CTX-02: 2   CTX-04: 4   CTX-05: 2   CTX-06: 7
CTX-07: 7   CTX-08: 8   CTX-09: 16  CTX-10: 2
CTX-12: 3   CTX-13: 6   CTX-14: 5   CTX-15: 2
CTX-16: 18
```

硬矛盾和错误复用包括：

- [OPS-037](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:48) 要求规划 500 人活动，但 [CTX-14 manifest:3](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-14/manifest.md:3) 明示预计 120 人。
- [LRN-024](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:35) 要从过去十次事故归纳模式，CTX-02 只有一次 2026-08-12 事故。
- [RES-009](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:15) 要计算三家三年总成本，CTX-16 只有首年预算上限和无具体价格的厂商描述。
- [RES-027](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:33) 要判断来源是否过期，但 CTX-16 没有来源日期或 `as_of`。
- [WRT-069](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:85) 是教材长期更新，却引用单个认证备考包 CTX-10。
- [ENG-072](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:83) 要检查 CI 安装脚本，却引用采购包 CTX-16。
- [ENG-012](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:18) 要分析查询计划、索引和 schema；CTX-15 中不存在这些输入。
- CTX-09 的 24 个引用里，至少 16 个需要包中不存在的发票、续费、审批队列、席位、现金流或审计样本。

82 个保守失败 ID 为：

```text
CTX-02: ENG-093, LRN-024
CTX-04: WRT-026, WRT-044, MKT-010, MKT-032
CTX-05: RES-003, MKT-037
CTX-06: WRT-011, WRT-053, OPS-010, OPS-017, OPS-022, DAT-025, CAR-008
CTX-07: PRJ-046, RES-004, SAL-011, SAL-019, SAL-037, MKT-019, MKT-023
CTX-08: WRT-052, RES-034, RES-037, MKT-004, MKT-029, MKT-033, MKT-036, DAT-013
CTX-09: WRT-018, WRT-067, RES-012, OPS-004, OPS-006, OPS-015, OPS-020,
        OPS-025, OPS-027, OPS-034, DAT-009, DAT-012, DAT-018, DAT-024,
        DAT-027, DAT-030
CTX-10: WRT-069, LRN-021
CTX-12: OPS-028, LIF-022, FAM-016
CTX-13: LIF-001, LIF-012, FAM-001, FAM-006, FAM-017, FAM-020
CTX-14: PRJ-070, WRT-039, OPS-037, MKT-045, FAM-018
CTX-15: ENG-012, DAT-006
CTX-16: ENG-072, ENG-114, ENG-116, PRJ-066, WRT-070, RES-009, RES-027,
        RES-033, RES-042, OPS-018, OPS-040, OPS-054, SAL-030, SAL-035,
        SAL-038, SAL-044, DAT-023, LRN-022
```

影响：

- 按 README 规定只注入问题与指定包时，模型无法完成任务，只能追问或编造。
- RAG 准确率、引用质量、冲突处理及推断边界都没有稳定真值。

最小修复：

- 对 277 个引用边建立 `required_claims → source_file` 支撑表。
- 不需要上下文的改为 `-`；错误复用的改为正确包；确需回放的补专属 fixture。
- 题面规模、实体、日期和所需原始数据必须与包一致。

## A-5：交付物尚不能评测多轮、安全、状态或工具行为

证据：

- 323 条标为 R4，即十轮以上或多 session，但每条只有第一句用户问题，没有后续回答、分支、澄清、重试或验收。
- 数据没有 `channel`、认证状态、任务状态、授权收据、预期系统动作、禁止动作或成功判据。
- [01-设计与分布.md:84](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:84) 声称覆盖新建、续接、改需求、状态、验收、重试和执行模式；全量检查只找到少量续接、[ENG-053](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:59) 的直接状态查询，以及 [PRJ-026](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:32) 的显式多任务拆分。直接的取消、失败重试、Plan Delta、拒绝验收、批准合并、陈旧授权重签基本缺失。
- 95 条记录的工具含 `rag`，RAG 字段却为 `-`。
- 多条题面指向不存在的附件：

  - [PRJ-003](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:9)：“这 38 个需求”。
  - [WRT-005](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:11)：“这份报告”。
  - [OPS-012](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:18)：“这些合同”。
  - [LIF-002](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:8)：“这些账单和通知”。
  - [CAR-015](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:26) 要分析客户、利润和容量，但没有输入数据。

Hard rule 结论：

- 语料范围 emoji 门禁通过。
- 题面中的“完成/做完”属于用户请求，不是 SayDo 执行状态话术，不能据此判状态词违规。
- 未发现题面明确要求语音直接放行 S3；[SAL-020](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:26) 和 [PRJ-061](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:77) 反而正确表达了 candidate/确认及“会议同意不等于授权”。
- 但缺少 channel/auth/task_state/memory source/expected utterance，意味着“S3 语音拒绝”“ready_for_review 不等于交付”“就绪不等于授权”“M0 拒第三方”等规则实际上没有被评测，而不是已经通过。

影响：

- 当前记录只能用于主题阅读或研究访谈提纲。
- 不能作为对话轮次、工具选择、RAG、安全、状态机或失败恢复 benchmark。

最小修复：

- 为评测子集补充完整 fixture、状态、授权、预期动作、禁止动作和验收 oracle。
- 将 R2–R4 改为真实多轮 transcript，至少包含澄清、计划、变更、检查和验收。
- 为每条硬规则加入显式与隐式对照用例；安全边界不能都由用户在问题中提前说出。

---

# B 级问题

## B-1：H/M/L 没冒充市场统计，但“概率”名称和分布仍不可校准

正面事实：

- [README.md:5](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:5) 明确说明 H/M/L 是启发式先验，不是市场统计。这一点表述诚实。

问题证据：

- 12 个领域近乎统一套用 `45%/35%/20%`，没有领域级用户研究、搜索量、访谈或产品遥测依据。
- H/M/L 与 C/R/K/S/F 高度混杂：

  - H：F1/F2/F3/F4 为 `96/166/4/4`。
  - M：`24/128/41/17`。
  - L：`0/16/61/43`。

- H/M/L 题面平均长度分别约 `32.5/32.9/33.3` 字，与“高频更短、长尾承担更多限定”的设计解释不符。
- 当前概率标签更接近“作者的产品评测优先级”，不是潜在客户问题发生率。

影响：

- 不能据此做市场规模、需求频率或采样权重推断。
- 复杂度和产品契合度会成为概率标签的泄漏特征。

最小修复：

- 无外部校准前将“概率”改名为“采样优先级”。
- 拆分 `demand_prior`、`product_priority`、`capability_fit`。
- 每个领域记录配额的证据来源或明确的 owner 判断依据。

## B-2：验证器存在明确假绿空间

[validate.mjs:39](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:39) 及后续逻辑存在以下问题：

- 只接受精确匹配 `| ABC-123 |` 的行，格式稍变或增加额外坏表格行会被静默忽略；只要合法行仍为 600 就可绿。
- 只对部分主要文本做非空/长度检查，没有对九字段逐格执行严格 schema。
- K 使用逗号 token 数，不先去重；同一工具重复六次理论上可伪造 K4。
- 不校验 ID 前缀与文件、H/M/L 章节的绑定。
- 只检查精确题面重复，不查语义近重复。
- 不要求上下文集合恰好为 `CTX-01`–`CTX-16`。
- manifest 的绝对路径或外部链接被跳过存在性验证，也未限制本地链接必须留在对应 CTX 目录。
- 完全不验证 manifest 的 authority、freshness、conflict、inference 或问题与上下文的语义适配。
- 标签覆盖只设极低的最小数量，不检查概率与 C/R/K/S 的异常相关性。

当前数据经独立解析不存在上述结构作弊；问题是门禁本身不能支撑 README 对质量的广义结论。

影响：

- 后续编辑可以在门禁绿色时破坏条数、分布、工具深度或 RAG 质量。
- 当前已发生的近重复、S/F 误标和 82 个 RAG 错配全部未被发现。

最小修复：

- 扫描所有表格样式数据行，遇到无法解析行直接失败。
- 固定 12 个文件、ID 前缀、章节、连续区间和精确 CTX 集合。
- 工具去重后计算 K。
- 增加语义重复簇、标签相关性和 RAG 支撑门禁。
- 将 Markdown 改为结构化数据的生成视图，而不是唯一事实源。

## B-3：RAG 字段与 `rag` 工具语义分叉

全量统计：

- 276 条记录引用 CTX。
- 263 条工具列表含 `rag`。
- 两者交集仅 168。
- 108 条有 CTX 但无 `rag` 工具。
- 95 条有 `rag` 工具但无 CTX fixture。

[README.md:18](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:18) 只定义 RAG 列的加载方式，没有解释两者为何分叉。

影响：

- 无法判断 `rag` 表示运行时动态检索，还是使用已注入 fixture。
- 相同工具标签对应不同评测输入，无法复现工具选择结果。

最小修复：

- 若二者同义，建立双向一致门禁。
- 若不同，重命名为 `retrieval_mode=fixture|dynamic|none`，并为 dynamic 声明检索源、认证条件和 freshness contract。

## B-4：manifest 的权威顺序、新鲜度与推断边界不可复现

证据：

- 8/16 manifest 没有绝对日期或截止时间：`CTX-04/06/07/08/09/11/13/16`。
- CTX-06 只写“最近四周”，CTX-08 只写“最近 28 天”，CTX-09 的季度没有年份，CTX-13 日期没有年份。
- CTX-13 声明“医疗机构书面指示”为最高权威，但配套包中没有该文件。
- 权威顺序是跨异质来源的全局标量。例如 CTX-10 将考试大纲排在用户时间约束之前，但做排期时用户时间约束才是对应 claim 的权威；CTX-09 的预算也不可能覆盖费用政策类 claim。
- 验证器不解析这些字段，README 所称的新鲜度、冲突和推断边界目前只是自然语言约定。

影响：

- 同一包在不同日期运行会得到不同解释。
- 模型无法按 claim 类型解决冲突，评审者也不能机械判定是否越界推断。

最小修复：

- 为 manifest 统一增加：

```text
as_of
valid_from
valid_to
source_role
claim_scope
allowed_inference
forbidden_inference
conflict_rule
```

- 权威顺序按 claim 类型建立，不使用一个全局排序。
- 对离线评测明确采用冻结快照，动态事实则必须提供重验证接口。

## B-5：覆盖广度尚可，但人群、生命周期和工具行为深度失衡

- 工具名义覆盖广，但分布高度集中：`document=465`、`tasks=270`、`spreadsheet=193`；相对地 `mobile=2`、`filesystem=12`、`ci=18`、`shell=23`、`git=28`。
- 软件领域虽有 `repo=123`、`test=112`，但本地系统、shell、git、CI 深度与 120 条软件场景不匹配。
- mobile、通知、语音和跨设备缺少同一请求在不同 channel/auth 状态下的对照。
- 角色是自由文本，无法机械统计组织规模、权限层级、数字熟练度、无障碍需求或一线岗位。整体明显偏知识工作者、管理者和 B2B SaaS。
- 一线轮班、制造、零售、物流、维修、公共服务直接用户，以及低数字熟练度、年长用户、无障碍需求和多语言用户不足。
- email/calendar/finance 等工具没有区分读、草稿、写入、发送、付款等不同 effect。
- 显式多任务拆分主要只有 PRJ-026；SayDo 新建、续接、状态、改需求、拒绝验收、恢复和取消没有形成系统矩阵。

影响：

- 工具覆盖计数看似完整，却无法证明真实 connector 行为或授权边界覆盖。
- 后续用户研究难以按 persona、组织和生命周期分层抽样。

最小修复：

- 增加结构字段 `persona_type/org_size/seniority/permission/digital_literacy/accessibility/channel/lifecycle`。
- 工具改为 action-level taxonomy。
- 为移动、前线工作和 SayDo 生命周期设最小覆盖配额。

---

# C 级问题

## C-1：README 存在断链导航

[README.md:13](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:13) 链接到 `review/`，但当前目录不存在，`test -d` 实际退出 1。

影响：读者无法找到 README 声称的评审交付。

最小修复：若本报告将落入该目录，则创建并补索引；否则删除或改为真实报告路径。

---

# 逐领域 H/M/L 语义检查摘要

| 领域 | H | M | L |
|---|---|---|---|
| ENG 软件 IT | 日常 coding 较自然 | 架构与迁移普遍 R4 膨胀 | 基础设施主题真实，但全 C5/R4 机械化，长期任务多误标 F2 |
| PRJ 产品项目 | 项目文档和少量续接较好 | portfolio、周期治理较全 | 多为组织级 F3，缺直接取消、重试、验收状态用例 |
| WRT 写作内容 | 窄版 writing 覆盖最好 | 格式与内容类型丰富 | 受监管题将安全草稿大量误标 F4/S3 |
| RES 研究决策 | 日常调研主题丰富 | 方法型任务较全 | 全 K4，专业边界与工具条件混淆 |
| OPS 业务运营 | 日常行政有代表性 | 19/19 全 K4 | 11/11 全 S3，明显失真 |
| SAL 销售采购 | CRM、续约、采购覆盖较好 | POC 与 deal desk 较全 | 与 PRJ/RES 重复，草稿和外发未区分 |
| MKT 营销增长 | 活动、漏斗、内容较全 | GTM、品牌项目丰富 | marketing 路线图能力与 F1/F2 混标 |
| DAT 数据财务 | 常规分析较好 | 12/12 全 K4 | 7/7 全 C5/R4/K4/S3，只读任务也被高危化 |
| LRN 学习发展 | 日常学习较自然 | 团队培训较全 | 项目现实周期被当作 agent 耗时 |
| LIF 个人生活 | 生活生产力真实 | 10/11 为 S3 | 6/6 为 S3，安全医疗/金融准备大量误标 F4 |
| CAR 职业自由职业 | 求职与自由职业实用 | 转型、顾问业务较全 | 草稿外联和计划型任务普遍误标 S3 |
| FAM 家庭社区 | 非娱乐且具体 | 6/6 全 K4、5/6 S3 | 4/4 全 S3，照护行政与临床边界混淆 |

---

# 覆盖盲区矩阵

| 维度 | 已覆盖 | 主要盲区 | 判定 |
|---|---|---|---|
| 领域 | 12 个领域，数量配额真实 | 权重无需求数据校准 | 部分满足 |
| 简单任务 | 有少量 C1/R1/K0/K1 | C1 仅 3、R1 仅 7、K0/K1 仅 11 | 严重不足 |
| 复杂项目 | 复杂、长期、跨工具题很多 | 与低概率、S3、F3/F4 机械绑定 | 过度覆盖且失真 |
| 人群角色 | 角色措辞丰富 | 无统一 persona；知识工作者和管理者偏重 | 不可分析 |
| 组织规模/层级 | 若干个人、团队、企业角色 | 无结构字段；一线、基层、低数字熟练度不足 | 不可机械复核 |
| 项目生命周期 | 少量新建、续接、状态、修订 | 取消、失败重试、Plan Delta、拒绝验收、重新授权不足 | 阻断评测 |
| 多任务 | PRJ-026 有明确拆分 | 缺并行/串行、跨项目暂停恢复矩阵 | 不足 |
| 本地工程工具 | repo/test 有覆盖 | shell/git/CI/filesystem 偏低 | 部分满足 |
| 文档办公工具 | 文档、表格、日历、邮件、CRM 广泛出现 | 工具常被凑 K，读写 effect 未区分 | 名义覆盖 |
| Web/PDF/RAG | browser/PDF/16 包均存在 | 82 个错配，95 个 retrieval 无 fixture | 不可回放 |
| 移动/通知/语音 | notification 较多 | mobile 仅 2，无 channel/auth 对照 | 严重不足 |
| 生活生产力 | LIF 30、FAM 20，另有 CAR 20 | 医疗/金融准备被错误 F4/S3 化 | 内容通过、标签失败 |
| 非娱乐 | 未发现娱乐型主体 | 无明显盲区 | 通过 |
| Hard rule | 少量候选记忆、授权边界正例 | 缺状态、通道、授权、预期系统话术 | 未被真正测试 |

---

# 建议门禁增量

1. 严格结构门

   - 固定 12 个问题文件、ID 前缀和连续区间。
   - 扫描所有表格数据候选行；存在未解析行直接失败。
   - 九字段逐格 schema 校验，固定精确 CTX 集合。
   - Markdown 由 JSONL/CSV 等结构化真相源生成。

2. 语义唯一门

   - 以输入、决策、产物、验收、effect 做语义 embedding/规则聚类。
   - 每个近重复簇人工裁决，并维护允许的 persona variant 清单。
   - 不再只查精确题面。

3. 标签一致性门

   - 对 H/M/L 与 C/R/K/S/F 的相关性设异常告警。
   - 任一概率段 100% 落同一 C/R 档应失败。
   - D 必须区分 agent 耗时和现实项目周期。

4. 工具深度门

   - 工具去重后计算 K。
   - 每个工具必须对应题面必需 action。
   - K4 不能仅凭列出六个工具成立。
   - 区分 read/draft/write/send/pay/deploy/delete。

5. 风险与能力门

   - S3 必须有明确 target、effect 和授权要求。
   - “草稿、比较、整理、人工提交”不得仅因领域自动标 S3。
   - F1 与条件 connector、未成熟执行器做矩阵校验。
   - capability fit 与专业边界拆字段。

6. RAG 支撑门

   - 每个问题声明 `required_claims` 和具体 source 文件。
   - 校验题面实体、规模、时间范围和所需字段真实存在。
   - 明确 fixture/dynamic/none 三种 retrieval 模式。
   - manifest 强制绝对 `as_of`、claim-level authority 和推断边界。

7. 评测完整性门

   - R2–R4 必须有真实多轮 transcript。
   - 增加 `channel/auth_state/task_state/memory_source`。
   - 每条提供 expected behavior、prohibited behavior 和验收 oracle。
   - 对 S3/F4 建立用户未预先提示安全边界的隐式对照题。

8. 覆盖门

   - 为 persona、组织规模、层级、生命周期、移动、无障碍和一线岗位建立结构化配额。
   - 为取消、重试、改需求、验收拒绝、恢复、授权过期建立最小测试数。

---

# 必须修后才可收口

1. 替换已确认的任务级近重复，重新证明 600 个语义情境唯一。
2. 对全部 600 条重新标注 C/D/R/K/S/F；不能只修列出的实例。
3. 将 H/M/L 从复杂度和产品契合度中解耦，或改名为“采样优先级”。
4. 修复全部 82 个已确认 RAG 错配，并人工复核完整 277 个引用边。
5. 解决 108 个“有 CTX 无 rag”和 95 个“有 rag 无 fixture”的语义分叉。
6. 将能力成熟度、connector 条件和医疗/法律/金融/授权边界拆成正交字段。
7. 为 R2–R4、状态机、授权、安全和失败恢复补充可执行多轮 fixture 与 oracle。
8. 加固验证器，使上述结构、语义、RAG 和标签问题不能继续假绿。
9. 修复后重新执行：结构门、语料范围 emoji 门、全量语义聚类、全部 RAG 引用审查及能力真相源对账。