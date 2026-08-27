不通过

结构门禁为绿，但存在 4 类收口阻断：构建并非 fail-closed、多个 CTX-only 场景缺关键事实、风险/能力标签低标，以及 H/M/L 仍大量由 ID tie-break 决定。

## 审查证据

- 正式命令：`node research/customer-question-corpus/validate.mjs`
- 复跑输出：`[ok] 600 条提问语料结构、分布、上下文与反耦合门禁通过`
- 真实退出码：`VALIDATOR_EXIT=0`
- 独立解析：600 条、12 个领域、600 个唯一规范化问题、600 个唯一目的。
- 领域数量：ENG 120、PRJ 70、WRT 70、RES 60、OPS 55、SAL 45、MKT 45、DAT 35、LRN 30、LIF 30、CAR 20、FAM 20。
- 独立遍历全部 `179,700` 对问题；最高 Dice 为 `0.333`，人工核对前十候选后未发现同场景重复。
- 全量上下文遍历：16 个 manifest、172 条 CTX 引用边、49 条 CTX-only、123 条混合边、49 个来源文件、24,158 字节；引用边集合完全对称，零空文件。
- 未读取用户禁止的 review、codex-findings、prompts、history、logs 或 Git diff；正式语料无改动。

## A 级

### A-1 构建失败会留下半套正式产物

证据：

- [README.md:54](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:54) 声称全部问题和 manifest 生成后才“整体替换”，失败不会留下半套文件。
- 实际代码先逐个替换 12 个问题文件，再逐个更新 16 个 manifest：[rebuild.mjs:895](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:895)、[rebuild.mjs:903](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:903)。
- 内存故障注入在第 3 次 `renameSync` 抛错，真实观测为：`renameAttempts=3`、`committedQuestionRenames=2`、`rollbackRenames=0`、`cleanupCalls=1`。
- 这直接违反 [03-频率与语义校准.md:80](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:80) 的失败不得替换现有问题与 manifest 要求。

影响：磁盘故障、权限变化或中断可让问题文件和 manifest 来自不同构建代，随后 validator 可能只对半更新状态工作。

最小修复：将全部生成物放入一个完整临时语料树，在该树上运行 validator；晋升采用单一目录切换，或为所有替换建立可验证的备份与失败回滚。增加“第 N 次写入/rename 失败后正式树逐文件 checksum 不变”的 mutation test。

### A-2 required claims 是上下文级模板，不是逐题事实合同

证据：

- 16 个 manifest 各自所有题目都只有 `1` 种 required claim 和 `1` 种 source set。
- [rebuild.mjs:554](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:554) 每个 CTX 仅定义一个通用 claim；[rebuild.mjs:922](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:922) 将它复制到该包所有题目。
- 123 条混合 CTX 边中，110 条补充输入都是同一句泛化的 `LIVE 读取当前代码、系统、SaaS 或现势资料`。
- [validate.mjs:286](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:286) 只检查 claim 长度、文件名存在和 USER/LIVE 字符串，不读取来源正文，也不验证来源能否支撑 claim。
- 将 CTX-01 所有 claim 换成无关但长度足够的文字，validator 仍为 exit 0。
- 将 `product-brief.md` 的读取覆写为空白，validator 仍为 exit 0，且 `source_reads=0`。

明确失配：

- `DAT-005` 要对账总账，却仅标 `CTX-01`：[问题:16](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:16)；manifest 明确说不含总账、必须来自 LIVE，却登记补充输入 `-`：[CTX-01 manifest:7](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-01/manifest.md:7)、[同文件:28](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-01/manifest.md:28)。
- `RES-020` 要核席位和合同，却仅标 `CTX-09`：[问题:34](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:34)；fixture 明确不含订阅席位：[CTX-09 manifest:7](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-09/manifest.md:7)。
- `WRT-023` 要把六项安全回答分为已确认、待答和不支持：[问题:36](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:36)；来源只列问题，并仅说明第 4、5 项有草案：[security-questions.md:3](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-07/security-questions.md:3)。
- `MKT-007`、`MKT-014`、`PRJ-055` 分别依赖历史实验、品牌搜索与候选实验成本，但 CTX-08 只有品牌规范、普通漏斗和素材库存；例如 [funnel-metrics.md:1](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-08/funnel-metrics.md:1)。
- `CAR-002` 使用“这个岗位”，fixture 却提供 A/B/C 三类岗位且没有选定项：[job-requirements.md:1](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-11/job-requirements.md:1)。
- `CAR-006` 要重写现有作品集，但 CTX-11 不含作品集正文：[问题:33](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:33)。
- `DAT-006` 要重跑 cohort；CTX-15 有异常摘要但没有事件数据或执行环境：[anomaly-report.md:9](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-15/anomaly-report.md:9)。

影响：49 条 CTX-only 中已有无法启动或会编造关键输入的场景，未达到“合成材料支撑关键 claim”。

最小修复：为每个 ID 单独登记“所需事实、来源内具体事实锚、缺失输入”；上述题目补 `USER`/`LIVE` 或补 fixture。validator 至少读取来源、拒绝空内容、拒绝整包完全相同的逐题 claim，并为明确的 `unsupported_scope` 冲突设置断言。

### A-3 多个现实 effect、敏感读取和当前能力被低标

风险与边界：

- `LIF-006` 读取护照、驾照和保险并实际提醒，却标 `S0/B0`：[问题:18](~/WorkSpace/SayDo/research/customer-question-corpus/questions/10-personal-life-admin.md:18)。
- `FAM-001` 合并含复诊、工作、学校的多人日历，却标 `S0/B0`：[问题:8](~/WorkSpace/SayDo/research/customer-question-corpus/questions/12-household-family-community.md:8)。
- `CAR-001` 读取个人简历材料却标 `S0/B0`：[问题:8](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:8)。
- `SAL-036` 读取客户通话并形成个人绩效辅导材料，却标 `S0/B0`：[问题:94](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:94)。
- 全量保守规则扫描得到 9 个 `S0` 敏感候选；以上四项至少应重新裁决为 `S2` 和相应隐私边界。
- `PRJ-045`、`OPS-039`、`MKT-036` 都要求系统实际发送周期性提醒，却分别为 `S0`、`S2`、`S1`：[PRJ-045](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:56)、[OPS-039](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:50)、[MKT-036](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:46)。
- Canonical 明确规定敏感读取升级、真实对外消息为 S3：[docs/04:132](~/WorkSpace/SayDo/docs/04-key-mechanisms.md:132)。
- 将一条 `S0` 问题改成“现在就把这封邮件群发给所有客户，并记录发送结果”，validator 仍 exit 0；其外部 effect 正则过窄：[validate.mjs:174](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:174)。

能力匹配：

- `ENG-100` 的十亿行零停机主键迁移标为 `C2 D0 H0 R2 K1 S1 F1`，工具仅 `repo`：[问题:228](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:228)。
- `ENG-090` 的 2,000 万行线上回填也标 `F1`、工具仅 `database`：[问题:222](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:222)。
- `WRT-033` 要处理第三方证据却标 F1；引用级写作验证仍属 P2：[问题:101](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:101)、[docs/02:90](~/WorkSpace/SayDo/docs/02-product-definition.md:90)。
- `WRT-068` 涉及作者署名争议却标 F1；归属合同同样仍在 P2：[问题:152](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:152)。
- [rebuild.mjs:757](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:757) 只按领域和工具集合推 F1；空工具集合也会令 `tools.every(...)` 为真，导致 `ENG-007`、`ENG-011` 这类需要读取真实仓库/测量环境的问题成为 `K0/F1`。
- 正式 research、marketing、general 执行器仍属 P2：[docs/05:116](~/WorkSpace/SayDo/docs/05-roadmap.md:116)。

影响：低标风险会绕过正确审批；低标工具又进一步把路线图或 connector 场景伪装为当前核心能力。

最小修复：对全部 600 条重新按“最高现实 effect”裁决 S/B；对所有 F1、K0、S0、通知类记录逐条复核。`deriveFit` 禁止空集合真值，并把引用、署名、大型生产数据操作及未验证 connector 作为明确的非 F1 条件。

## B 级

### B-1 H/M/L 不是由 C/R/K 机械决定，但大量同分记录实际由 ID hash 切桶

通过部分：

- Cramer’s V：C `0.245`、R `0.199`、K `0.103`。
- C/R/K 共 32 种组合，仅 18 条处于完全单一频率组合；按组合多数类预测频率准确率仅 `51.5%`。因此不存在直接的 C/R/K 决定关系。

问题：

- [rebuild.mjs:800](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:800) 的 demand score 只包含硬编码 ID 锚点、少量词面和长度；没有逐条表达目标人群覆盖或即时摩擦。
- 494 条非锚点中有 233 条得分为零，最终却分成 H 16、M 180、L 37；共有 420 条位于跨越多个频率档的同分组，边界内次序实际由 [stableTie](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:815) 的 ID hash 决定。
- `PRJ-057` 年度战略为 H，而更日常的当月项目抢人治理 `PRJ-039` 为 M：[PRJ-057](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:64)、[PRJ-039](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:107)。
- `ENG-116` 受监管审计包为 H，而快速检查 README 是否还能跑通的 `ENG-015` 为 M：[ENG-116](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:114)、[ENG-015](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:127)。

影响：固定配额正确，但领域内语义顺序不能据当前生成逻辑获得支持。

最小修复：为边界附近和全部同分跨桶项保存人工语义序位或逐条评分理由；ID hash 只处理经人工确认等价的场景。validator 增加领域内高于/低于关系断言。

### B-2 C/D/H/R/K 与工具标签存在明显词面派生错误

- `WRT-030` 因“节奏”被强塞 `calendar`：[问题:97](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:97)。
- `WRT-001` 明说“先别拆行动项”，仍被强塞 `tasks`：[问题:8](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:8)。
- `WRT-003` 因观点中出现“验收、自动化”被标 `test,automation`，却遗漏实际写作产物工具：[问题:12](~/WorkSpace/SayDo/research/customer-question-corpus/questions/03-writing-content.md:12)。
- `OPS-027` 因“账户”被标 CRM；`ENG-043` 因“下一步”只标 tasks：[OPS-027](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:40)、[ENG-043](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:157)。
- 规则来源是无否定和语境处理的原始正则：[rebuild.mjs:589](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:589)。
- `ENG-007`、`ENG-011`、`OPS-002`、`MKT-005`、`RES-054` 均为 `K0`，但分别需要仓库、性能测量、日历、搜索数据或预测数据工具。
- `PRJ-070` 和 `CAR-018` 明确涉及一年，却为 H0：[PRJ-070](~/WorkSpace/SayDo/research/customer-question-corpus/questions/02-product-project.md:68)、[CAR-018](~/WorkSpace/SayDo/research/customer-question-corpus/questions/11-career-freelance.md:52)。
- `PRJ-045`、`OPS-039` 要持续运行并提醒，却为 D1；按定义应重新核对 D4：[01-设计与分布.md:35](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:35)。
- `ENG-100` 的 C2/K1、`PRJ-057` 的“逐轮”但 R2，也需重新裁决。

影响：分布覆盖数字为真，但若标签语义不真，覆盖矩阵会产生虚假的广度。

最小修复：工具采用人工 override 为主、词面规则仅产生候选；增加否定词和语境 mutation。对显式周期、持续执行、大规模生产变更及“逐轮/逐阶段”建立保守断言。

## C 级

### C-1 口语总体可用，但安全/oracle 约束密度偏高

- 63 条以问号结尾、90 条以“把”开头；平均长度 H `33.05`、M `34.34`、L `34.34`。
- 采用包含“不要、确认、人工、回滚、护栏、证据、来源、验收”等词的宽松规则，命中 290/600。
- 如 `ENG-074` 已接近预写执行合同，而不是潜在客户首句：[问题:212](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:212)。
- 这不证明 290 条都不自然，但会让后续 benchmark 高估用户主动说出完整安全条件的概率。

最小修复：保留安全对照，同时将一部分题面改成更自然的不完整表达，把授权或验收条件放入后续场景 sidecar；用真实访谈措辞再校准。

## 通过项

- [ok] 数量、12 个领域、连续 ID 和 H/M/L 配额为 `600 / 270 / 210 / 120`。
- [ok] 全部 179,700 对已计算；最高十对经人工核对，没有发现只换角色的同构重复。
- [ok] 16 个 CTX 目录、172 条问题/manifest 边和 49 个来源文件在结构上完全闭合。
- [ok] C1–C5、D0–D4、H0–H4、R1–R4、K0–K4、S0–S3、F1–F4 均有数量覆盖。
- [ok] C/R/K 未机械决定频率档。
- [ok] LIF 30 + FAM 20，恰好 50 条生活生产力场景；扩展娱乐词扫描无命中。
- [ok] 人物、个人到大型组织、状态查询、改需求、失败重试、续接、验收和外部动作均有代表场景。
- [ok] 11 个登记 F4 均为 S3，人工检查其越权方向未发现反标。

## Mutation test 结果

在只读沙箱内使用不落盘的内存虚拟副本：

- 精确重复问题：validator exit 1，正确拒绝。
- `S0` 问题改成直接群发客户邮件：validator exit 0，假绿。
- required claim 改成无关长句：validator exit 0，假绿。
- 来源正文覆写为空白：validator exit 0；validator 对来源正文读取次数为 0。
- 构建器第 3 次 rename 故障：已有 2 个正式问题文件进入替换状态，零回滚。

## Validator 仍可能假绿的范围

- claim 与来源正文是否语义相关。
- 空白、无关或互相矛盾的来源内容。
- 未进入窄正则的敏感数据和外部 effect。
- F1 是否符合当前真实能力，而非仅符合工具词表。
- 工具遗漏、否定语境和跨义词误报。
- H/M/L 同分项的领域内语义顺序。
- 生命周期 ID 是否真的体现所登记状态；当前只检查 ID 存在。
- 低于 Dice `0.55` 的语义改写型重复。
- connector 登录态、权限及真实执行可行性。
- F4 静态白名单之外的新越权场景。

## 必须修后才可收口

1. 修成问题与 manifest 同事务晋升、失败零正式变更的构建流程，并加入 rename/write 故障注入门禁。
2. 将 required claims 改为逐 ID 事实合同，修复全部 CTX-only 缺口，尤其 `DAT-005`、`RES-020`、`WRT-023`、`MKT-007/014`、`CAR-002/006`、`DAT-006`。
3. 全量重审 S0、通知 effect、B0 与 F1；先修本文列出的风险和能力低标项。
4. 对 420 条同分跨桶记录做领域内语义排序，去掉未经语义确认的 ID-hash 分桶。
5. 重审工具及 C/D/H/R/K 标签，增加否定语境、显式周期、持续执行和大型生产变更反例。
6. 回修后运行正式 validator、上述 mutation suite，并由全新零上下文审查者复核。