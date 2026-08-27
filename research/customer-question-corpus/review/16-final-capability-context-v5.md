# SayDo 600 条潜在客户提问语料终局能力与上下文独立复审 v5

- 复审日期：2026-08-26
- 复审身份：全新、零上下文、只读独立评审
- 结论：`[fail]`
- 判定依据：发现 2 条 A 级与 5 组 B 级问题。按本轮规则，任一 A/B 即判失败。

## 1. 范围与方法

本轮只读取任务允许的语料、上下文、canonical、`packages/**`、`pipeline/**`、`rebuild.mjs` 与 `validate.mjs`。未读取旧评审正文、Codex findings、prompts、logs、过程 journal，也未读取 Git diff、status 或 log。除本报告外未修改其他文件，未执行 `rebuild.mjs`，未 commit 或 push。

覆盖方式不是抽样代替全量：

1. 逐行读取 12 个 `questions/*.md`，共 600 条；
2. 逐包读取 16 个 context manifest 与其全部 source 正文；
3. 将 172 条 required claims 逐一对照所列 source，另外检查 supplemental input、`as_of`、`valid_until` 与权威规则；
4. 用只读 Node 扫描覆盖全部 600 条，再人工裁决 109 条广义外部 effect 候选、全部 194 条 S0、全部 33 条 S3、全部 F1/F4、K0/K4、CTX-only 与高敏感候选；
5. 对照 canonical 与当前实现复核实际能力路径，特别是 EffectGrant、S3 challenge、审批收据和风险定义；
6. 静态检查生成器的暂存、校验、晋升、可捕获失败回滚及断电边界。

只读全量扫描的关键原始输出：

```text
QUESTION_FILES=12
RECORDS=600
S3_BY_FIT={"F3":22,"F4":11}
S0_COUNT=194
BROAD_EFFECT_CANDIDATES=109
CONTEXT_PACKS=16 REQUIRED_CLAIMS=172 GENERIC=112 EXPLICIT=60
SCAN_EXIT=0
```

## 2. 结论摘要

### 2.1 已守住的边界

- `[ok]` 33 条 S3 中，22 条为 F3、11 条为 F4；没有 S3 被直接标成 F1/F2。发送、发布、通知、预订、支付、部署、流量切换等已被识别出的显式 S3 题总体没有用 connector 或登录态冒充当前执行能力。
- `[ok]` 11 条 F4 均是明确的越权、自主或专业判断边界题，没有把安全辅助任务机械抬成 F4。
- `[ok]` 16 个 context 包当前均有 `as_of`、`valid_until` 或冻结事件窗口，并有 claim scope 与权威规则；截至 2026-08-26 未发现过期后仍冒充现势的包。
- `[ok]` required claim 所列 source 文件均存在；人工对照后，除 A-2 所述“合同本身没有覆盖题目真正所需输入”外，没有发现 source 正文与已声明具体事实直接矛盾。
- `[ok]` 可捕获 rename 失败的静态回滚路径完整，且文档明确不承诺断电或进程强杀事务性。详见第 7 节。

### 2.2 失败原因

- A-1：`ENG-100` 将真实生产数据库主键迁移标成 S1/B0，违反 S1 仅限 worktree 内写的合同。
- A-2：`DAT-017` 以无手工表输入、无 spreadsheet/filesystem 工具的 `CTX-15+LIVE` 冒充输入闭合；generic required claim 和 digest 让该假闭合通过 validator。
- B-1：多条明显敏感经营、客户、财务或安全读取仍标 S0，validator 的敏感词表漏检。
- B-2：数条真实外部写入题虽为 S2，却缺少主授权边界或清楚的写前确认措辞。
- B-3：存在明显的工具或输入模式不相称。
- B-4：若干隐私、身份、法律或财务主边界仍被标成 B0 或错误主边界。
- B-5：生成器与 validator 只锁住窄正则和少量 ID，无法阻止上述语义反例再次通过。

## 3. A 级发现

### A-1 `ENG-100`：生产数据库迁移被标为 S1/B0

判定：`[fail]` 风险失真与合同破坏。

证据：

- `research/customer-question-corpus/questions/01-software-it.md:228`：题面是“给这张十亿行表做零停机主键迁移”，包含双写、回滚和逐阶段人工放行，却登记为 `S1`、`F2/B0`。
- `docs/06-references.md:96`：S0–S3 的 canonical 定义是“读 / worktree 内写 / 出圈可逆 / 不可逆”。真实数据库结构与数据迁移不可能是 worktree 内写，最低也应为 S2。
- `research/customer-question-corpus/rebuild.mjs:1494-1508`：`deriveRisk()` 的外部 effect 词表不含数据库迁移；随后 ENG 题命中“迁移”即返回 S1。这正是当前错误的生成原因。
- `research/customer-question-corpus/validate.mjs:582-589`：门禁只拒绝 S0 代码写、一个窄 S3 外部 effect 正则和少量工作树外写关键词；“主键迁移/双写”不在其中，所以该反例通过。
- `research/customer-question-corpus/validate.mjs:82`：对 `ENG-100` 只锁 C/D/H/R，没有锁正确风险与授权边界。

影响：模型训练或回放会把生产数据库迁移当作自动可放行的本地代码修改，弱化人审、目标环境、变更窗口、回滚和消费收据要求。

修复要求：

1. 将风险改为至少 S2，并把主边界改为 B-AUTH；
2. 明确题目是“只产迁移方案/演练”还是“经逐阶段确认后真实执行”。若包含真实生产执行，必须登记与目标数据库相称的执行工具、权限、逐阶段收据与回滚终态；若当前路径不能证明，则能力应降为 F3 的人工协作版本；
3. 为“生产数据库迁移、双写、回填、schema 变更”加入语义反例，不能再由 ENG 通用写代码规则落 S1。

### A-2 `DAT-017`：手工表输入与真实写入条件未闭合

判定：`[fail]` RAG 假闭合。

证据：

- `research/customer-question-corpus/questions/08-data-finance.md:74`：题面指向“手工表里的这批指标”，但上下文仅为 `CTX-15+LIVE`，工具为 `repo,test,database,bi,monitoring`；既无 `USER`，也无 `spreadsheet` 或 `filesystem`，运行时没有来源表可读。
- `research/customer-question-corpus/03-频率与语义校准.md:61`：明确规定“用户附件不能因为已有相似 fixture 就省略 USER”。
- `research/customer-question-corpus/contexts/CTX-15/manifest.md:7`：包的 unsupported scope 明确不含数据库 schema 变更或真实生产写权限。
- `research/customer-question-corpus/contexts/CTX-15/manifest.md:35`：该题 required claim 只提供“指标合同、血缘与带日期异常记录”，supplemental 只是泛化的 LIVE 读取；没有手工表正文、目标表、回填窗口或写权限。
- `research/customer-question-corpus/contexts/CTX-15/metric-contracts.md:3-9`、`lineage-notes.md:3-11`、`anomaly-report.md:3-9`：三份 source 只有指标定义、已有血缘和异常摘要，确实不含题面所指的手工表数据。
- 只读统计显示 172 条 required claims 中 112 条是包级 generic claim，仅 60 条为显式逐题 claim。`rebuild.mjs:1641-1653` 对带 USER/LIVE 的题默认复用包级 claim；只有 CTX-only 才强制显式覆盖。
- `validate.mjs:752-799` 校验文件存在、digest、字符串基线与 supplemental 对称，但没有验证 claim 是否覆盖题目真正所需输入。`validate.mjs:133` 与 `validate.mjs:296` 还分别锁住 `DAT-017` 的 S2/B-AUTH 和缺 spreadsheet 的工具集合。

影响：回放会在没有原始数据的情况下看似“可以开始”，并可能把 CTX-15 的现有指标异常误当成待迁移手工表的内容；digest 只能证明字节与登记没漂移，不能证明事实蕴含。

修复要求：

1. 上下文改为 `CTX-15+USER+LIVE`，并加入 `spreadsheet`，或把 hand sheet 明确登记为可由某个 LIVE source 工具读取的具体对象；
2. required claim 必须逐题写明“手工表正文、字段映射、目标表、回填窗口与写权限均不在 fixture”，不得用 CTX-15 包级摘要代替；
3. validator 增加“这份/这批/手工表/附件”等指代与 USER 或具体 live-readable source/tool 的闭合反例；
4. 将 `DAT-017` 的 context 与工具作为修正后的精确基线，移除当前错误锁定。

## 4. B 级发现

### B-1 明显敏感读取仍标 S0

判定：`[fail]` 风险标签与 validator 词表缺口。

`research/customer-question-corpus/03-频率与语义校准.md:69` 明确写明“读敏感材料不一定是 S3，但不能误标成 S0”。以下条目均含清楚的客户、财务、联系人或安全敏感材料，却登记为 S0：

- `RES-018`，`questions/04-research-decision.md:36`：流失/留存客户的行业、采用路径和支持记录，`S0/F2/B0`；
- `RES-031`，`questions/04-research-decision.md:50`：漏洞与内部资产暴露排序，`S0/F2/B0`；
- `OPS-005`，`questions/05-business-operations.md:16`：季度预算、承诺与差异，`S0/F2/B0`；
- `OPS-010`，`questions/05-business-operations.md:26`：项目尾款发票与验收证据，`S0/F2/B0`；
- `SAL-026`，`questions/06-sales-customer-procurement.md:67`：客户采用、成果、支持和关系信号，`S0/F2/B0`；
- `SAL-034`，`questions/06-sales-customer-procurement.md:90`：副总裁级客户升级、补救与赔偿材料，`S0/F2/B0`；
- `SAL-040`，`questions/06-sales-customer-procurement.md:100`：伙伴报备与佣金归属，`S0/F2/B0`；
- `MKT-031`，`questions/07-marketing-growth.md:71`：记者兴趣与历史沟通，`S0/F2/B-AUTH`；
- `DAT-007`，`questions/08-data-finance.md:47`：季度销售 forecast、销售自报与历史偏差，`S0/F2/B0`；
- `DAT-029`，`questions/08-data-finance.md:76`：多币种、多实体预算与内部交易，`S0/F2/B0`。

`validate.mjs:584` 仅识别病历、症状、凭据、护照、简历等少量词，因此上述企业敏感数据全部漏过。应将这些条目提升到至少 S2，并按主要输出补 B-PRIV 或 B-FIN；validator 应从“数据类别 + 使用目的 + 身份/财务/安全资产”判定，而不是只扩一个脆弱名词表。

### B-2 真实外部写入的主授权或写前确认不清

判定：`[fail]` 授权措辞缺口。

- `DAT-015`，`questions/08-data-finance.md:53`：要求“修正血缘”，即修改外部数据治理状态，却是 `S2/F2/B0`，没有写前确认；
- `OPS-017`，`questions/05-business-operations.md:32`：在 calendar/tasks 建 kickoff、材料清单和里程碑，是工作树外写入，却是 `S2/F2/B0`，没有授权门；
- `WRT-047`，`questions/03-writing-content.md:111`：要求“直接更新 live 知识库”，虽为 B-AUTH，但只把冲突交 owner，未要求非冲突内容写前确认；
- `FAM-013`，`questions/12-household-family-community.md:24`：创建共享日历与交接清单，主边界标 B-LEG 可以保留，但题面没有补上共享对象、字段和写前确认。

`03-频率与语义校准.md:70-73` 要求 SaaS 写与真实 effect 相称，并规定一条记录只有一个主边界时，其他限制必须写进问题。上述题应明确“先给变更预览，确认目标、对象、字段与回滚点后再写”，或收窄为只产草案。

本目录在 `README.md:5` 与 `02-覆盖索引.md:50-62` 已诚实声明不附完整授权收据，因此“没有 receipt sidecar”本身不判 A；但将这些题升级为执行 benchmark 时，必须补 subject/digest、授权人、渠道强度、过期、单次消费、结果回执及可逆动作的补偿或回滚证据，不能把用户首句当成已签收据。

### B-3 工具或输入模式明显不相称

判定：`[fail]` 工具与上下文缺口。

- `ENG-027`，`questions/01-software-it.md:131`：要求在现有产品“把月度 CSV 导出做出来”，却只有 `test,spreadsheet,finance`，没有实现代码所需的 `repo`；
- `PRJ-056`，`questions/02-product-project.md:132`：要定义用户离开两周期间的自主权限、等待边界和升级对象，却只有 `LIVE`，没有 `USER` 提供正式授权政策、例外与代理人；工具中的 `shell` 也没有题面依据；
- `LRN-017`，`questions/09-learning-development.md:49`：匿名困难反馈角色扮演可以由题面开始澄清，不需要 `rag+LIVE`；当前 `K1/LIVE` 既制造无来源依赖，也违反 `01-设计与分布.md:21,62-68` 的“只登记确需工具”原则。

修复应分别为：给 ENG-027 增 `repo`；给 PRJ-056 增 USER 与明确授权资料合同，或改成先采访；将 LRN-017 收敛为 K0/`-`，除非题面明确要求从组织案例库取匿名场景。

### B-4 专业、隐私与身份主边界漏标

判定：`[fail]` 边界标签缺口。

- `LIF-017`，`questions/10-personal-life-admin.md:45`：高金额买房、合同疑点与总价比较仍标 `B0`；即使专业判断留给人，主边界仍应是 B-LEG 或 B-FIN；
- `SAL-019`，`questions/06-sales-customer-procurement.md:38`：账户历史、客户承诺、关键人交接标 `B0`，应至少体现 B-PRIV；
- `SAL-021`，`questions/06-sales-customer-procurement.md:40`：推断谁影响、谁卡安全、谁签字，涉及联系人身份与推断，仍标 `B0`，应为 B-ID 或 B-PRIV；
- `SAL-040`，`questions/06-sales-customer-procurement.md:100`：佣金归属与争议流程标 `B0`，应体现 B-FIN；
- `DAT-027`，`questions/08-data-finance.md:65`：现金流情景、融资和裁员判断标 `B0`，虽保留董事会判断，仍应为 B-FIN；
- `DAT-004`，`questions/08-data-finance.md:14`：季度预算计算被标 B-AUTH，但题面没有真实发送或写入 effect，主要边界更接近 B-FIN；同时其敏感预算读取不应为 S0。

这不是“题材敏感就升 F4”；这些条目保留 F2 合理，问题在于 B 标签应准确表达仍需守住的责任边界。

### B-5 生成器与 validator 没有锁住上述语义反例

判定：`[fail]` validator 缺口。受影响实例至少包括 `ENG-100`、`DAT-017`、`RES-018`、`DAT-015`、`OPS-017`、`ENG-027`、`PRJ-056` 与 `LIF-017`，位置见 A-1、A-2、B-1 至 B-4。

代码证据：

- `rebuild.mjs:1402-1414` 直接把现有 `questions/*.md` 当输入；未被 override 或规则命中的语义漂移会成为下一次构建的种子，而不是由独立声明式源重建；
- `rebuild.mjs:1494-1510` 的风险规则用窄正则派生，导致 `ENG-100` 的数据库迁移落入 ENG 通用 S1；
- `rebuild.mjs:1641-1653` 对 CTX+USER/LIVE 默认生成包级 generic claim，ID 后缀让文本表面唯一，却不证明逐题需要已闭合；
- `validate.mjs:586-590` 的外部 effect 与圈外写入词表漏掉迁移、轮换、修正血缘、live 知识库更新、建立 SaaS 日历/任务等形态；
- `validate.mjs:584` 的敏感读取词表漏掉经营预算、客户支持记录、佣金、记者关系、forecast 与资产暴露；
- `validate.mjs:768-772` 只以整行字符串含 ID 的不同判“required claims 逐题唯一”，112 条 generic claim 因 ID 不同而通过；
- `validate.mjs:792-799` 只验证 source 文件存在及 USER/LIVE 字符串对称，不检查问题所需实体、字段与 source 蕴含关系；
- 本轮实际命令仍以退出码 0 结束，证明这些反例确实不在当前门禁内。

建议至少增加以下机器反例：生产 DB/schema/回填写不低于 S2；任何指向附件的“这份/这批/手工表”必须有 USER 或可判定的 live source+read tool；工作树外写必须有 B-AUTH 或题面内授权限制；企业敏感材料不允许 S0；高金额法律/财务判断不允许 B0；generic required claim 不可只靠 ID 后缀满足逐题唯一。

## 5. Context Pack 全量对账

下表的“claims”来自全部 manifest 行数，不是抽样。`[ok]` 表示所列 source 正文能支撑当前声明且 supplemental/时效/权威规则闭合；CTX-15 的 source 本身与声明一致，但 `DAT-017` 的声明不足以闭合题面，故单列失败。

| Context | claims | 结果 | 核对要点 |
|---|---:|---|---|
| CTX-01 | 13 | `[ok]` | 产品 brief 为批准范围，反馈只作带日期线索；自动邮件明确不在范围 |
| CTX-02 | 12 | `[ok]` | 事故时间线高于日志与旧 runbook；冻结事件窗口未冒充持续现势 |
| CTX-03 | 22 | `[ok]` | brief 范围/成功标准高于个人偏好，milestones 是草案；正式 RACI 由 USER 补 |
| CTX-04 | 6 | `[ok]` | 作者确认论点、外部线索与风格样例分层，归属未混写 |
| CTX-05 | 10 | `[ok]` | 官方/监管来源高于访谈与团队假设；需要现势者带 LIVE |
| CTX-06 | 15 | `[ok]` | SOP、四周聚合指标与样本工单职责分开；销售口头同意不构成批准 |
| CTX-07 | 16 | `[ok]` | 客户原话、安全书面问题与账户阶段分权；预算和安全未确认项保留 unknown |
| CTX-08 | 15 | `[ok]` | 品牌规范高于漏斗与素材库存，28 天窗口未外推长期事实 |
| CTX-09 | 8 | `[ok]` | 批准预算高于政策和解释假设，未关账/待确认差异有标记 |
| CTX-10 | 9 | `[ok]` | 考纲、错题摘要与时间约束分层；LRN-002/003 原题和答案由 USER 补 |
| CTX-11 | 9 | `[ok]` | 候选人事实、岗位要求与简历写法不互相覆盖；当前目标岗位/作品由 USER 补 |
| CTX-12 | 4 | `[ok]` | 硬约束高于搬家草案和冻结报价，过期报价需 LIVE |
| CTX-13 | 6 | `[ok]` | 行政指示不冒充诊断，药物冲突维持 unknown，授权/最小共享/当前预约补齐 |
| CTX-14 | 3 | `[ok]` | 2026-08-26 现势；本轮场地反馈高于基线 roster，确认与未确认时段可区分 |
| CTX-15 | 11 | `[fail]` | 定义、血缘、异常三源相符；`DAT-017` 缺 hand sheet、目标与写权限，见 A-2 |
| CTX-16 | 13 | `[ok]` | 评审规则高于 RFP 与厂商自报；价格、迁移实测和审批现势由 LIVE 刷新 |

digest 复算通过只说明 source 与 required-claim 字节未漂移。它不改变 A-2，也不能替代上表的人工蕴含判断。

## 6. 当前能力与真实 effect 对账

当前实现边界与语料 `00-能力边界.md:34` 一致：connector、登录态和用户意图不自动形成 S3 签发/消费能力。

代码证据：

- `packages/contracts/src/types/package.ts:10-12`：当前 EffectGrant 白名单只有 `install_dependency` 与 `push_branch`；
- `docs/09-data-contracts.md:371`：S3 action 虽预留 publish/deploy/delete/external_send 等枚举，但 P0 签发入口只有 register/merge，其余“无签发路径，启用前须另立判别合同”；
- `packages/daemon/src/tier1/s3Tools.ts:105-107`：生产输入 schema 实际只接受 `merge` 或 `register`；
- `packages/daemon/src/policy/engine.ts:39-49`：deploy、spend_money、delete_data、send_external 均为 S3；
- `docs/10-voice-ux-spec.md:154`：合并、部署、花钱、删数据、对外发送语音永不放行。

因此本轮没有把“工具列中出现 email/calendar/cloud”当作能力已接通。33 条显式 S3 全在 F3/F4 是正确的；A-1 的问题是实际生产 effect 被误标成了 S1，A-2 的问题是输入和工具未闭合。

## 7. 生成器、validator 与晋升回滚

### 7.1 validator 实跑

命令：

```bash
node research/customer-question-corpus/validate.mjs
validator_rc=$?
printf 'VALIDATOR_EXIT=%s\n' "$validator_rc"
```

关键原始输出：

```text
"records": 600
"risk": { "S1": 185, "S0": 194, "S2": 188, "S3": 33 }
"fit": { "F1": 49, "F2": 480, "F3": 60, "F4": 11 }
"nearDuplicatePairsAt055": 0

[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
VALIDATOR_EXIT=0
```

解释：结构门通过是真实结果，但不推翻本报告的语义失败。`README.md:54` 本身也诚实声明 validator 不能证明 claim 与 source 的语义蕴含。

### 7.2 staged promotion 与可捕获失败

静态结论：`[ok]`，但本轮未动态执行故障注入。

- `rebuild.mjs:1734-1752`：先在同级 staging 生成 questions、复制 contexts、更新合同，并在 staging 内运行完整 validator；非零即不晋升；
- `rebuild.mjs:1694-1714`：晋升前把两棵 live 目录分别移入独立 backup，再逐棵换入 staging；
- `rebuild.mjs:1715-1728`：任一可捕获 rename 失败时按反序恢复；回滚自身出错会保留 backup 并抛 `AggregateError`，不伪报成功；
- `rebuild.mjs:1729-1731`：只有回滚完整或成功才删除 backup；
- `README.md:54` 与 `03-频率与语义校准.md:80`：明确把断电/进程强杀排除在保证外，没有冒充双目录原子事务。

本轮任务禁止 mutation，因此没有运行 `rebuild.mjs` 或 `CORPUS_TEST_FAIL_RENAME_AT=1..4`。这项结论只证明静态控制流与边界措辞闭合，不声称本会话做过动态回滚测试。后续可在临时副本中对 1..4 四个晋升 rename 点逐个注入，并用两棵目录的全量哈希比较验证恢复。

## 8. 修复优先级

1. 先修 A-1、A-2，并把对应反例加入 validator；
2. 批量复核全部 S0，修 B-1 的敏感企业数据；
3. 统一外部 S2 写入的题面措辞与 B-AUTH，修 B-2；
4. 修 B-3 工具/输入与 B-4 专业边界；
5. 将 generic required claim 改为真正逐题合同，至少对所有包含指代、附件、live write 或高风险 effect 的题强制显式 claim；
6. 回修后重新运行全量 validator，并用全新会话再做一次能力与上下文复审。

## 9. 最终判定

`[fail]`

validator 的结构与已登记反例门为绿，但语料仍存在生产数据库风险误标、RAG 输入假闭合，以及明显的敏感风险、授权、工具和专业边界缺口。按本轮规则，有任一 A/B 即不得判通过。
