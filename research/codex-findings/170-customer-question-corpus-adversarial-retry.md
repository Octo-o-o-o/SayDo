不通过

结构门禁为绿，但安全副作用、上下文充分性、工具依赖和当前能力标签存在系统性语义错标，会造成错误训练真值，不能以 validator 通过收口。

## A 级

### A-1：S/B 标签没有按真实 effect 和敏感性判定

证据：

| 位置 | 当前标签 | 问题 |
|---|---|---|
| [ENG-037](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:50) | S0 | 修复普通成员可读取管理员导出的权限缺陷，至少涉及代码写入；若改权限策略应为 S2 |
| [ENG-053](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:66) | S2/R3 | 只读查看任务状态，无外部 effect，宜为 S0、单轮 |
| [DAT-028](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:82) | S0 | 隔离数据并通知 owner；隔离至少 S2，真正发消息按 canonical 为 S3 |
| [SAL-020](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:61) | S1 | 经确认后写 CRM，是工作树外 SaaS 写入，至少 S2 |
| [OPS-033](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:44) | S0 | 向员工和主管发送提醒，属于真实外部消息，应为 S3 |
| [LIF-019](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:28)、[FAM-011](~/WorkSpace/SayDo/research/customer-question-corpus/questions/12-household-family-community.md:22) | S0 | 读取健康、症状和长期照护资料，不满足“非敏感只读”的 S0 定义 |

同源边界错标还有：

- [ENG-047](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:62) 仅因“可诊断”被标 B-MED，实为 CLI 技术排障。
- [DAT-032](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:61) 涉及投资风险且明确不得建议交易，却只有 B-AUTH，至少缺 B-FIN。
- [LIF-026](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:72) 涉及退休投资，却只有 B-LEG，至少缺 B-FIN。

根因位于 [rebuild.mjs](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:477)：S/B 由词面正则推断，而非按最高真实 effect；`诊断`、`确认`等普通词还会误触边界。它与 [04-key-mechanisms.md](~/WorkSpace/SayDo/docs/04-key-mechanisms.md:132) 的 S0–S3 定义冲突。

影响：可把外发、外部系统写入、权限和敏感数据场景错误当成低风险，也会污染边界能力评测。

最小修复：为每条记录显式登记 `effect_target`、`sensitivity`、`external_action`；人工复核全部 253 条 S0、160 条 S1 和 157 条非 B0。新增硬门：代码写入不低于 S1、工作树外写入不低于 S2、外发/部署/支付/删除为 S3、敏感读取不得 S0。

### A-2：14 条 CTX-only 缺少完成关键 claim 所必需的材料

程序化确认共有 46 条 CTX-only；下列 14 条存在高置信缺口：

- [PRJ-019](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:134)：要比较“客户原话”和“原合同”，CTX-06 没有两份原文。
- [WRT-004、WRT-016](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:79)：分别要求修改首节、长文，CTX-04 manifest 明示不含草稿/终稿；WRT-016 位于同文件第 30 行。
- [DAT-013](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:49)：题目所指图表不存在。
- [LRN-013](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-research.md:20)：缺上周计划和实际进展。
- [LRN-002](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-research.md:66)：重复消费订单的事实位于另一 fixture，当前引用不能支撑。
- [RES-017](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-analysis.md:30)：要求“三个月反馈”，CTX-01 只有 8 月三条记录，且缺严重度/付费影响。
- [RES-021](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-analysis.md:120)：缺目标平台约束。
- [SAL-003](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:10)：缺当前产品能力；CTX-07 还明确不含系统架构。
- [SAL-014](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:90)：缺三年成本数值。
- [SAL-042、SAL-044](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:83)：分别缺现合同退出/双跑事实，以及“五家子公司”材料；SAL-044 位于第 104 行。
- [MKT-015](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:26)：缺本月实际活动及成本。
- [CAR-011](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-job-search.md:39)：需要市场薪酬，而 CTX-11 manifest 明示不含市场薪酬。

126 条 CTX 引用同时带 LIVE，当前信息可以由 LIVE 补足，不能与上述 CTX-only 缺口混为一谈。

影响：模型只能臆造关键事实或反问索取材料；目录不再是可执行的场景层真值。

最小修复：逐条增加缺失 source，或显式增加 USER/LIVE 输入；manifest 增加 `required_claims → source` 映射。修正 [rebuild.mjs](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:423) 中“有 CTX 就不能再标 USER”的互斥逻辑。

### A-3：K、tools 与 context 存在遗漏、强塞和否定词误判

证据：

- [PRJ-048](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:52)、[RES-001](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-analysis.md:67) 均为 `CTX-05 + LIVE`，却是 K0、tools `-`；直接违反 LIVE 和 K0 定义。
- [ENG-065](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:169) 要改代码国际化，却只有 spreadsheet/document，缺 repo/test/LIVE。
- [RES-031](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-analysis.md:79) 要查“当前漏洞且是否影响我们的栈”，却是 K0、无上下文。
- [OPS-015](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:69) 涉及实时航班、酒店、日历和预订，却只有 rag。
- [WRT-015](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:28)、[MKT-008](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:16)、[MKT-002](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:90) 分别因“暂不支持自动邮件”“夸大自动化”“不要承诺全自动赚钱”被错误强塞 automation。
- [WRT-007](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:16) 的十页报告和 [ENG-042](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:147) 的现有导入实现均缺 USER/repo 上下文。
- [LIF-002](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:39) 处理实体账单却缺 image/OCR；同文件 [LIF-018](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:26) 处理照片/小票却被分配 git/monitoring。
- [RES-051](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-analysis.md:136) 跨市场法规缺 browser/rag，却有 maps/automation。

根因是 [rebuild.mjs](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:342) 对整段文本做无否定感知的关键词匹配，第 433 行又能凭 CTX-05 单独制造 LIVE。

影响：K、F、工具覆盖和能力边界统计被共同污染。

最小修复：先显式登记输入来源和工具，再派生 K/F；新增 `LIVE ⇒ 至少一个实时读取工具且 K≥K1`、代码修改必须 repo、指代现有材料必须 USER/CTX/LIVE 的门禁；人工复核全部 53 条 K0 和所有否定语境命中。

### A-4：C/D/H/R 不反映场景真实执行结构

证据：

- [PRJ-055](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:58) 的六周实验“计划”和 [CAR-016](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-job-search.md:41) 的三个月内容计划被标 D3；设计文档明确“写长期计划”本身不等于实际跨周执行。
- [PRJ-058](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:117)、[OPS-050](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:97)、[SAL-033](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:40)、SAL-041 同文件第 44 行、[LRN-025](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-research.md:30) 分别明示 100 天、半年、30 天、90 天、两年，却均为 H0。
- [FAM-011](~/WorkSpace/SayDo/research/customer-question-corpus/questions/12-household-family-community.md:22) 是多人长期照护，却组合成 C1/D3/H0/R4/K0。
- [PRJ-047、PRJ-048](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:50) 分别是多阶段采用和三市场法规分析，却均为 C1。

影响：复杂度、执行时长、未来跨度和轮次切片不能用于评测或产品决策。

最小修复：区分“材料中提到的期限”和“SayDo 实际管理的执行期限”；逐条语义重标，不再从目的文本中的数字或长周期词直接推导。

### A-5：F1 明显夸大当前能力

- [PRJ-026](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:30) 要从一句话拆出多个任务却标 F1；[00-能力边界.md](~/WorkSpace/SayDo/research/customer-question-corpus/00-能力边界.md:40) 明确把“一句话拆多任务”列在 roadmap。
- [ENG-093](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:90) 依赖 LIVE monitoring connector，却标 F1。
- [WRT-055](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:140) 要做当前政策外部研究，却标 F1。
- [ENG-106](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:102) 要全站 WCAG 审计，标 F1 且没有 browser。

[validate.mjs](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:34) 的 connector 集合不完整，第 138 行只能拦少量工具；[rebuild.mjs](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:503) 还按领域前缀直接赋 F1。

影响：直接违反“不夸大 SayDo 当前能力”的核心验收目标。

最小修复：建立按 execution path/connector/当前实现证据维护的能力注册表；F1 必须能指向已验证实现，LIVE 或未验证 connector 默认不得 F1。

## B 级

### B-1：H/M/L 存在明显同域倒挂

同复杂度内的代表性倒挂：

- ENG C3：[ENG-110](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:110) 的可复现构建/SBOM 为 H，普通类型错误修复 ENG-010 为 L。
- MKT C3：全国倡议 MKT-045 为 H，首页改写 MKT-002 为 L。
- WRT C2：作者署名争议 WRT-068 为 H，期刊格式检查 WRT-037 为 L。
- SAL C3：恶意批量冷邮件边界 SAL-043 为 H，常规供应商三年成本比较 SAL-014 为 L。

根因是 [rebuild.mjs](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:515) 先用关键词打分，再在复杂度层内强行填满配额。

影响：H/M/L 不能近似目标人群未来 12 个月的主动需求概率。

最小修复：按领域做盲化成对排序并校准锚点，最后再检查整体比例；不要让精确配额覆盖语义排序。

### B-2：自然口语整体偏“预写 oracle”

统计：仅 25/600 以问号结尾；325/600 以固定动作动词开头；165 条含“先”，154 条含“不要/别/不能/不得”。单条命令式表达可以自然，但整体分布明显像验收步骤和安全答案提示。

影响：模型可能靠复述题目中已写出的过程与护栏通过，而不是识别隐含目标、风险和缺失信息。

最小修复：分层改写部分 H/M 为真实但不完整的自然请求；将期望步骤和安全行为留在 purpose/eval 元数据，仅保留专门的边界对照题显式写出禁令。

### B-3：rebuild 未 fail closed

当前输入下，内存模拟的 12 个生成文件均字节一致，说明当前状态幂等；但在只读内存副本中移除 ENG-001 后，rebuild 仍正常结束并生成 599 条结果，没有总数、ID 集或配额断言。相关流程见 [rebuild.mjs](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:389) 和第 624 行。

影响：后续一次解析遗漏即可静默覆盖成不足 600 条，只有事后另跑 validator 才发现。

最小修复：写盘前校验 600、ID 集、每前缀数量及全部分布；先生成临时目录、运行 validator，再原子替换。

## C 级

### C-1：覆盖存在薄层和不可审计面

- 生活类有 50 条，但低数字素养直接用户场景几乎只见 LIF-002；残障/无障碍更多是生产者侧审计。
- 稀疏工具：e-sign 1、OCR 2、slides 3、video 3、image 5、mobile 5，尚不足以证明实质工具覆盖。
- Quick/Guided/Explore、直达验收/逐步确认虽在说明中出现，但没有行级标签或索引；[validate.mjs](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:170) 对生命周期只验证指定 ID 存在。

影响：宏观“有出现”可以通过，但无法证明各交互模式、生命周期和弱势人群覆盖的深度。

最小修复：为交互模式、生命周期阶段和目标人群增加行级标签及最低覆盖门禁；补少量低数字素养、辅助技术、多语言移动端、OCR/e-sign 场景。

## 通过项

- `node research/customer-question-corpus/validate.mjs` 本会话实跑退出码为 `0`，原始结论为 `[ok] 600 条提问语料结构、分布、上下文与反耦合门禁通过`。
- 独立解析得到恰好 600 条；完整遍历 179,700 对。最高 bigram Dice 为 0.333（SAL-002/SAL-012），`>=0.40` 为 0；人工复核最高候选未发现实质重复。
- 16 个 CTX、172 条引用、49 个 source 文件在引用、manifest 白名单和文件链接层面完全闭合。
- 已登记 11 条 F4 全部为 S3；F4/S3 样本普遍保留确认、强认证或人工介入，F4 注册映射本身通过。
- C/D/H/R/K/S/F/B 各档均非空；工具、个人、团队、组织、生活及五阶段生命周期均有实例。
- 娱乐词面扫描命中 0；`bash scripts/check-emoji.sh` 退出码 0。

## 覆盖盲区

实质薄弱处集中在：低数字素养直接使用、辅助技术用户、多语言移动端输入、纸质材料 OCR、e-sign，以及交互模式与生命周期的行级可审计性。公共服务、教育、照护、制造等虽有出现，但不应把“出现一次”解释为充分覆盖。

## validator 假绿面

- S/B 只查枚举和少量组合，不验证真实最高 effect。
- CTX 只查目录、allowlist 和链接闭合，不验证 source 是否支撑题目 claim。
- 没有 `LIVE ⇒ 工具/K` 一致性门。
- F1 connector 集不完整，且 F4 是硬编码 ID。
- 生命周期只验指定 ID 存在，不验行级分布。
- 自然度只需至少 20 条问号；25/600 即可通过。
- 近重复只用高阈值词面 Dice，不能发现语义模板复写。
- validator 无法阻止 rebuild 先写出 599 条结果。

## 必须修后才可收口

1. 按真实 effect 和敏感性重标 S/B，并加入不可绕过的安全不变量。
2. 补齐上述 14 条 CTX-only 的必要材料或显式 USER/LIVE 输入。
3. 修复 LIVE/K/tools 一致性、否定语境误触和现有材料指代遗漏。
4. 语义重标明显错误的 C/D/H/R。
5. 用能力注册表重审全部 F1，先修 PRJ-026、ENG-093、WRT-055、ENG-106。
6. 对 H/M/L 做同域盲化重排，并降低预写 oracle 式措辞占比。
7. 给 validator 增加语义不变量，给 rebuild 增加写前 600 条 fail-closed 门。