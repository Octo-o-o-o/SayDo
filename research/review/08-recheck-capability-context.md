# 客户问题语料能力与上下文终审复核

- 审查日期：2026-08-26
- 审查对象：`research/customer-question-corpus` 当前冻结产物
- 审查类型：只读、独立能力与上下文复核
- 最终结论：`[fail]`

## 1. 结论先行

结构门禁是绿色，但当前产物不能按“能力、工具、输入、风险与逐题事实合同均已闭合”验收。

阻断原因有三类：

1. `00-能力边界.md` 把尚未接入用户派发路径的 Hopper/Codex、需类型门配置的 writing 与已启用核心能力合并描述，导致 `F1` 的“当前”含义不可判定；
2. 16 个 manifest 虽有 172 行 required claims，但每个包内所有题共用同一条 claim 与同一组来源，合计只有 16 个不同的 claim/source 对。至少 6 题因此形成明确的事实假闭合；
3. 5 题把实际通知或工作树外写入标成 `S0`，与 corpus 自身和 canonical 的 effect-based 风险规则直接冲突。

工具、输入和主边界标签另有一批 B 级语义偏差。`validate.mjs` 能验证集合、格式和对称性，不能验证工具是否真的服务于题目、来源是否真的支持 claim、补充输入是否选对、风险与边界是否符合语义。三组 mutation tests 均在植入明显错误后继续返回 0，证明这不是推测。

## 2. 审查范围与完整性

### 2.1 实际读取范围

本轮读取并直接核对：

- 12 个 questions 文件中的全部 600 条记录；
- 16 个 `CTX-01` 至 `CTX-16` manifest；
- 16 个包内的全部 49 个来源文件；
- corpus 的 `README.md`、`00-能力边界.md` 至 `03-频率与语义校准.md`、`contexts/README.md`、`validate.mjs`；
- 与能力结论直接相关的 canonical 和当前代码，包括项目类型门、派发 route、Tier1 adapter、Brain 工具与本地 repo 读取边界。

未修改 questions、context、validator、canonical 或代码；本文件是唯一新增文件。

### 2.2 隔离完整性说明

本会话出现两次误触，必须如实记录：

- 一次广域 `rg` 查询意外回显了既往审计文件中的两条匹配行；
- 一次最初的 emoji 文件枚举使用了未生效的 review 排除 glob，检查脚本可能读取过 review 文件字节，但没有回显其内容。

两类输出均已隔离，没有作为本报告 finding 的证据。本报告的每项结论只引用当前 corpus 原始产物、canonical 和代码。不过，按“字节级零接触”解释，本会话不能作为绝对隔离通过证据；修复后应由全新会话再做一次终审。

### 2.3 全量遍历结果

独立 Node 遍历脚本逐文件读取 12 个问题文件、16 个 manifest 和 49 个来源文件，并对 ID、问题引用、supported questions、required claims、来源存在性和集合对称性逐项比较。真实输出摘要：

```text
questionFiles=12
questionRecords=600
uniqueIds=600
duplicateIds=[]
contextPackages=16
contextQuestionRows=172
contextReferences=172
requiredClaimRows=172
sourceFiles=49
sourceLines=479
sourceBytes=24158
traversalFiles=77
traversalSha256=289dcf8582b5c9e3b5385d5a75583c26af38637df196d80d5361665a0d6d3a6a
errors=[]
CENSUS_EXIT=0
```

这里的 77 个 traversal files 为 12 个 questions、16 个 manifest、49 个包内来源；corpus 的 7 个治理/说明/校验文件另行完整读取。

## 3. 标签全量统计

程序化解析全部 600 行后的真实分布如下：

| 维度 | 分布 |
|---|---|
| 频率 | H 270，M 210，L 120 |
| C | C1 49，C2 262，C3 226，C4 45，C5 18 |
| D | D0 308，D1 262，D2 20，D3 3，D4 7 |
| H horizon | H0 524，H1 15，H2 13，H3 14，H4 34 |
| R | R1 36，R2 441，R3 73，R4 50 |
| K | K0 57，K1 150，K2 308，K3 80，K4 5 |
| S | S0 233，S1 186，S2 162，S3 19 |
| F | F1 86，F2 464，F3 39，F4 11 |
| B | B0 444，B-AUTH 99，B-PRIV 13，B-LEG 14，B-MED 12，B-FIN 10，B-ID 6，B-ATTR 2 |
| 输入 token | `-` 63，USER 88，LIVE 450，CTX 引用 172 |

全部 11 条 F4 为 `ENG-120, PRJ-068, WRT-065, RES-059, OPS-053, SAL-043, MKT-043, DAT-035, LIF-029, CAR-020, FAM-020`，均为 S3，题面确实包含越权自主、冒充、自动外发、自动付款、交易、诊疗或部署等明确边界。本集合未发现漏标或误标。

## 4. 当前能力对账

### 4.1 当前代码与 canonical 能证明的能力

- `packages/daemon/src/brain/liveTools.ts:454-465` 在 `confirmAndDispatch` 创建任务时把 `route` 固定为 `"tier1"`；全代码搜索只有这一处生产 task route 赋值，没有 `route: "hopper"` 的用户派发入口。
- `packages/daemon/src/tier1/backends/types.ts:4-5` 把已实现后端限定为 `cursor | claude_code`。
- `packages/daemon/src/tier1/validateConfig.ts:191-203` 明确说明 `codex` 仍返回 `unsupported_adapter`，实际执行器仅 cursor/claude_code。
- `packages/daemon/src/config/types.ts:113-121` 与 `docs/09-data-contracts.md:1145` 均表明产品缺省 `enabled_project_types=["coding"]`；writing 只有在全局显式开值后才能 propose/dispatch。
- `packages/daemon/src/tier1/typeGate.ts:14-32` 对未启用类型 fail-closed。
- `packages/daemon/src/brain/repoRead.ts:1-16,54-116` 只提供受限的本地 workspace 读文件/列目录，不是浏览器、邮件、CRM、日历、数据库或 SaaS connector。
- `packages/daemon/src/brain/liveTools.ts:557-1534` 的已注册主工具为项目锚定、决策包、派发、状态、审批、记忆及本地 repo 读取；没有通用外部 connector 工具面。

由此可判定的当前条件是：

- coding 可经 Tier1 走 cursor；claude_code 有代码路径但仍受配置、身份登记和 live conformance 条件约束；
- writing 窄版合同和实现存在，但产品缺省关闭，能否作为“当前启用”必须绑定运行时配置证据；
- Hopper/Codex 有 canonical/bridge 组件或路线设计，不等于当前用户派发已接线；
- 浏览器、PDF、表格、邮件、日历、CRM 等场景只能按 F2 的外部工具、登录态、网络和授权条件解释。

## 5. A 级发现

### A-CAP-001：F1 当前能力声明混合已接线、条件开启和未接线能力

`research/customer-question-corpus/00-能力边界.md:9-15` 声称 F1 都有“当前启用的代码路径”，并列出“Cursor CLI、Claude Code CLI 或 Hopper/Codex 路径”。同文件 `:29` 又承认 Claude Code live conformance 尚未收口。

这与第 4 节代码事实不一致：当前派发 route 恒为 Tier1，codex 明确 unsupported，Hopper 没有生产派发入口。另有 28 条 writing F1：

```text
WRT-004 WRT-005 WRT-006 WRT-007 WRT-009 WRT-010 WRT-014 WRT-015
WRT-019 WRT-022 WRT-023 WRT-025 WRT-027 WRT-029 WRT-031 WRT-032
WRT-033 WRT-036 WRT-039 WRT-041 WRT-043 WRT-045 WRT-049 WRT-050
WRT-052 WRT-062 WRT-064 WRT-068
```

这些条目只有在 writing 类型门显式开启且运行时依赖齐备时，才满足 F1“当前核心能力”的执行含义。当前文档没有把该谓词绑定到 F1 行，也没有把 Hopper/Codex 从 current path 中移出。

影响：86 条 F1 的解释基准不稳定；潜在客户能力盘点会把“合同存在”“条件开启”“已接线”混为一类。

关闭条件：以代码/运行时快照重写 current capability 表；至少区分 Tier1 cursor、条件 claude、条件 writing、未接线 Hopper/Codex，并据此复核 86 条 F1。

### A-CTX-001：逐题 required claims 退化为包级模板，并形成事实假闭合

程序化遍历 172 行 required claims 得到：每个 manifest 内 `required claims + fixture sources` 的不同组合数都恰好为 1，16 个包合计仅 16 个不同组合。也就是说，所谓逐题合同只是把包级摘要复制给每个 ID。

`validate.mjs:286-310` 只检查行存在、ID 对称、claim 长度、来源文件名存在，以及 supplemental token 与问题行文本对称；它不检查 claim 是否回答题目、来源正文是否包含 claim、题目与 manifest 是否共同误报 supplemental input。

至少以下 6 题构成明确假闭合：

| ID | 当前输入 | 无法闭合的原因 |
|---|---|---|
| DAT-005 | CTX-01 | 题目要求对账“账单导出和总账汇总”；`CTX-01/manifest.md:7` 明确不含总账或跨月导出数据，问题没有 LIVE/USER。 |
| WRT-023 | CTX-07 | 题目要求把六个安全回答分为已确认、待答和不支持；来源只有六个问题，并只说明第 4、5 项内部材料是草案，没有任何一项的正式产品答案。 |
| OPS-024 | CTX-06 | 题目要求聚合“相同客户”的等待、审批和风险；来源是四个互不相同的项目 A-D，没有客户同一性、审批事件和风险事件集合。 |
| RES-020 | CTX-09 | 题目明确要求核席位和合同；manifest 明确不含订阅席位，来源只有预算聚合、费用政策和运营猜测，没有登录使用或合同明细。 |
| WRT-030 | CTX-04+LIVE | 题目要重写实际“第二节”；manifest 明确不含待审稿。缺的是用户稿件 USER，不是代码、系统或 Web 的 LIVE。 |
| DAT-006 | CTX-15 | 题目要排除重复事件并重跑 cohort；来源只有指标口径、血缘摘要和异常摘要，没有原始事件、查询、执行连接或真实结果，且没有 LIVE/database。 |

影响：CTX 回放会把缺事实当作已有事实，直接破坏来源治理、拒绝臆测和 RAG 评测的 oracle。

关闭条件：逐题写 required claims；每一条 claim 必须能指到实际来源段落；无法由 fixture 支撑的部分改成 USER/LIVE 或把问题收窄为仅输出缺口/执行计划。

### A-RISK-001：5 条现实 effect 低标，安全标签与 canonical 冲突

`research/customer-question-corpus/03-频率与语义校准.md:67-75` 要求按题面最高现实 effect 分级，明确说敏感读取不能是 S0、外部 SaaS 写入要匹配实际 effect、发送等真实 effect 必须进入确认门。`docs/04-key-mechanisms.md:132-143` 定义工作树外可逆写为 S2、外部消息为 S3。

以下记录违反该规则：

| ID | 当前 | 题面 effect | 至少应为 |
|---|---|---|---|
| PRJ-045 | S0 | 每周自动检查并在风险变化时提醒 | S3 |
| LRN-009 | S0 | 在复习时实际提醒 | S3 |
| LIF-006 | S0 | 按提前量实际提醒证件到期 | S3 |
| FAM-015 | S0 | 在窗口临近时实际提醒 | S3 |
| OPS-011 | S0 | 把报名表转进项目清单，修改外部任务状态 | 至少 S2 |

`validate.mjs:179-181` 使用窄正则识别外部 effect，只覆盖“向本人/员工/主管/客户/厂商提醒”等少数句式，因此没有识别上述同义表达。

影响：训练或评测会把需要确认的实际通知/外部写入当成自动放行，属于安全级 release blocker。

关闭条件：修正 5 个 S 标签，并把 effect 判定从少量表面句式扩成可审查的结构化 effect 字段或至少加入这些反例。

## 6. B 级发现

### B-TOOL-001：20 条必需工具存在明显语义错配

工具列按 corpus 规则应只登记“完成当前问题确需”的工具族。以下不是偏好差异，而是把题目名词误当工具、漏掉核心数据工具或登记了无关工具：

| ID | 当前工具 | 明显问题与建议方向 |
|---|---|---|
| ENG-002 | test,email | email 是被修改字段，不是邮件动作；缺 repo。 |
| WRT-003 | test,automation | 作者采访和论点树不需要 test/automation；需要 USER、memory/transcription、document。 |
| WRT-030 | calendar | 口吻改写与日历无关；需要 document 和用户稿件。 |
| RES-006 | email,automation | 研究“自动邮件”的需求不等于发送邮件；需要 browser/rag/访谈资料。 |
| RES-010 | maps | “玩家、客户和价值链地图”是概念图，不是地理地图；需要 browser/rag/document。 |
| RES-013 | shell,spreadsheet,finance,document | 客户公司与公开风险会前研究缺 browser/crm/rag，shell/finance 无直接必要。 |
| RES-041 | automation | 供应商单点风险调研缺 browser/rag/document。 |
| OPS-027 | tasks,crm,monitoring | 月末关账核心是 spreadsheet/database/document，CRM 不是必需。 |
| MKT-013 | finance | “禁止保证收入”是文案约束，不构成 finance 工具需求；需要 document/design/rag。 |
| DAT-001 | document | 脏表格清洗报告缺 spreadsheet。 |
| DAT-004 | forms | 预算重算缺 spreadsheet/finance，forms 不是核心。 |
| DAT-008 | tasks | 指标合同缺 document/database/bi。 |
| DAT-018 | pdf,rag | 可调年度模型缺 spreadsheet/finance。 |
| LIF-003 | monitoring | 上月账目分类缺 spreadsheet/finance。 |
| LIF-010 | calendar | 路线、地点和营业时间还需 maps/browser。 |
| CAR-013 | maps,document | “团队地图”不是地理 maps；需要 tasks/document。 |
| CAR-019 | finance | 岗位、签证、搬迁、税务和家庭时间线不能只靠 finance；需 browser/calendar/document。 |
| FAM-017 | finance | 一年照护跟踪核心还需 calendar/tasks/document。 |
| FAM-019 | test,database,crm | 家庭账户恢复索引不需要 test/crm；核心是受控 document/database。 |
| SAL-036 | tasks | 通话辅导首先需要 transcription，tasks 不能替代通话证据。 |

影响：K 档虽与工具数量一致，但语义上不是任务真实深度；工具覆盖和 connector 需求统计会失真。

### B-INPUT-001：多条 `-`/USER/LIVE 不能支撑题目中的现势或私有指代

README 把 LIVE 定义为当前 repo、系统、SaaS 或新鲜 Web，把 USER 定义为被访者附件、文本或口述记录。以下 ID 明确依赖这些事实，却没有相应 token，或 token 选错：

- 应补 LIVE 或 USER+LIVE：`ENG-007, ENG-011, ENG-017, ENG-034, ENG-040, ENG-073, ENG-101, PRJ-039, PRJ-043, PRJ-069, RES-011, RES-012, OPS-002, OPS-031, MKT-005, DAT-012`；
- 应补 USER 或 USER+LIVE：`ENG-070, ENG-081, ENG-085, PRJ-058, PRJ-067, WRT-009, WRT-010, WRT-021, WRT-034, WRT-036, WRT-039, WRT-048, WRT-049, WRT-067, RES-009, RES-043, RES-045, RES-054, OPS-045, MKT-037, DAT-022, LRN-027, LIF-015, LIF-030, CAR-007, CAR-017, FAM-002, FAM-007`；
- 已有 token 但类型错误：`WRT-030` 用 LIVE 代替缺失的 USER 稿件；`LRN-023` 只有 USER，但“推三篇当前可读全文论文”还需要 LIVE/browser/rag。

其中部分题目可以在 `-` 模式下“开始澄清”，但不能按当前列出的工具和输入直接产出题面要求的具体结果。当前 schema 没有区分“足以开始采访”和“足以完成首个产物”，因此两种解释会给同一行相反结论。

影响：回放时无法判定模型应先追问、读取现场数据，还是可以直接生成；required claims 的 supplemental input 也只会复制问题行的同一个错误。

关闭条件：明确 input mode 是启动条件还是完成条件。若是启动条件，另加 `required_runtime_inputs`；若是完成条件，为上述 ID 补 USER/LIVE 和相应工具。

### B-BOUND-001：主边界标签漏标或选错

以下题目已有明确专业、隐私或授权主边界，但当前 B 标签未表达：

| ID | 当前 | 建议主边界 |
|---|---|---|
| ENG-070 | B0 | B-PRIV，测试账号和资产要交第三方 |
| PRJ-045 | B0 | B-AUTH，实际发送提醒 |
| WRT-029 | B0 | B-AUTH，对外道歉和补救承诺 |
| WRT-058 | B0 | B-MED，医学系统综述结论 |
| OPS-007 | B0 | B-AUTH，创建账号与设备权限 |
| OPS-011 | B0 | B-AUTH 或 B-PRIV，外部写入报名数据 |
| OPS-027 | B0 | B-FIN，关账异常、估计与凭证判断 |
| OPS-029 | B0 | B-AUTH，向供应商发题并进入审批 |
| OPS-033 | B0 | B-PRIV，员工培训完成与证明的定向披露 |
| SAL-036 | B0 | B-PRIV，通话与个人辅导证据 |
| SAL-045 | B-AUTH | B-FIN，客户适当性与金融产品风险是主边界 |
| DAT-026 | B0 | B-PRIV，敏感字段与用途治理 |
| DAT-028 | B0 | B-AUTH，quarantine 与通知是外部动作 |
| DAT-033 | B-AUTH | B-FIN，保险定价与精算监管结论 |
| DAT-034 | B-AUTH | B-PRIV，去标识与重识别风险是主问题 |
| RES-057 | B-AUTH | B-PRIV，敏感研究数据治理是主问题 |
| CAR-014 | B0 | B-PRIV，客户 CRM 与发票记录 |
| LIF-014 | B0 | B-FIN，保险保障、除外和费用比较 |

一条记录只允许一个主边界，因此 `OPS-011` 等跨域题仍需 owner 选择主标签；无论选择哪个，B0 都不足。

### B-CTX-001：3 个 context 题虽可启动，但题面关键字段仍缺输入

- `WRT-019/CTX-02`：事故窗口到 10:37 结束，但来源没有“下次更新时间”；完整客户状态更新需要 USER 提供承诺时间。
- `WRT-029/CTX-02`：来源没有获批补救承诺；可以写道歉语气变体，不能保证三版的“补救承诺一致”。同时当前 B0 漏掉客户承诺授权边界。
- `CAR-016/CTX-04`：来源只有四条观点和一个项目轶事，不足以支撑三个月“只用真实项目和观点”的内容库存；至少需要 USER 补真实项目清单和可公开边界。

## 7. 16 个 context 包逐包结论

所有 16 个包的目录集合、manifest 字段、来源链接、来源集合、supported questions、required claims ID 集和有效期在 2026-08-26 都通过结构检查。逐包语义结论如下：

| 包 | 问题数 | 来源数 | 语义结论 |
|---|---:|---:|---|
| CTX-01 | 13 | 2 | `[fail]` DAT-005 需要 manifest 明确排除的总账/导出现场数据。 |
| CTX-02 | 12 | 3 | `[warn]` WRT-019 缺下次更新时间；WRT-029 缺获批补救承诺。 |
| CTX-03 | 22 | 3 | `[ok]` 未发现新的 A 级 fixture 越界；LIVE 题均保留现场输入。 |
| CTX-04 | 6 | 3 | `[fail]` WRT-030 缺稿件且错用 LIVE；CAR-016 的真实项目库存不足。 |
| CTX-05 | 10 | 4 | `[ok]` 冻结事实、来源状态与 LIVE 新鲜度分离成立。 |
| CTX-06 | 15 | 3 | `[fail]` OPS-024 的“同一客户”与审批/风险事件没有来源。 |
| CTX-07 | 16 | 3 | `[fail]` WRT-023 只有安全问题，没有可分类的正式答案。 |
| CTX-08 | 15 | 3 | `[ok]` 品牌、漏斗与资产来源能覆盖已声明 claim。 |
| CTX-09 | 8 | 3 | `[fail]` RES-020 缺席位使用和合同明细。 |
| CTX-10 | 9 | 3 | `[ok]` 考试权重、错题和时间约束能覆盖离线题。 |
| CTX-11 | 9 | 3 | `[ok]` 简历、岗位要求与可证明经历边界闭合。 |
| CTX-12 | 4 | 3 | `[ok]` 时间、报价和家庭约束边界闭合。 |
| CTX-13 | 6 | 4 | `[ok]` 行政指示、照护记录、日历与隐私规则分层成立。 |
| CTX-14 | 3 | 3 | `[ok]` 活动、志愿者和场地规则能覆盖声明用途。 |
| CTX-15 | 11 | 3 | `[fail]` DAT-006 需要原始事件与执行连接，冻结摘要不能完成重跑。 |
| CTX-16 | 13 | 3 | `[ok]` RFP 硬门、评审规则和厂商自报分层成立。 |

## 8. C 级发现

### C-VAL-001：校验器只守结构，不守语义，名称“上下文闭合”容易造成误读

这不是要求把全部自然语言判断塞进正则，而是要求门禁不要对已知错误给出与语义验收相同的绿色结论。

三组临时副本 mutation tests 的真实结果：

1. 把 ENG-002 的 `test,email` 改成与修 bug 完全无关的 `calendar,maps`，保持 K2/LIVE；validator 输出 `[ok]`，`MUTATION_TOOL_EXIT=0`。
2. 把 DAT-005 问题改成“根据这份病历给出诊断和用药调整方案”，仍保留 CTX-01、F2/B0 和原 required claims；validator 输出 `[ok]`，`MUTATION_CLAIM_BOUNDARY_EXIT=0`。
3. 把 OPS-024 问题改成“把客户名单发布给所有供应商并创建正式项目记录”，仍保留 K0/S0/F2/B0/CTX-06；validator 输出 `[ok]`，`MUTATION_EFFECT_EXIT=0`。

建议把最终成功文案收窄为“结构与登记对称性通过”，并把上述三类 mutation 作为反例测试；required claim 的语义支持仍应由独立 evaluator 或人工终审裁决。

## 9. 门禁与独立查询证据

### 9.1 原始 validator

```bash
node research/customer-question-corpus/validate.mjs
```

真实输出摘要：

```text
records=600
nearDuplicatePairsAt055=0
[ok] 600 条提问语料结构、分布、上下文与反耦合门禁通过
VALIDATOR_EXIT=0
```

这证明结构门绿色，不反驳第 5 至 8 节的语义发现。

### 9.2 required claims 独立查询

独立脚本逐 manifest 统计 `required claims + fixture sources` 的不同组合：

```text
CTX-01 ... CTX-16: 每包 rows=3..22，distinct_claim_source_pairs=1
TOTAL_ROWS=172
SUM_DISTINCT_CLAIM_SOURCE_PAIRS=16
QUERY_EXIT=0
```

### 9.3 语料范围 emoji 门

最终门禁只枚举允许读取的 corpus 根说明文件、questions、contexts、validate 与本报告，显式排除其他 review 文件：

```text
[ok] emoji gate: clean
FINAL_ALLOWED_SCOPE_EMOJI_EXIT=0
```

## 10. 已通过项与剩余能力条件

已通过：

- 600 个 ID 唯一，12 个领域文件与固定配额一致；
- 16 个 context 目录、172 个引用、172 行合同在集合层完全对称；
- 49 个来源文件全部存在、均在本 context 目录内、manifest 链接集合无遗漏；
- 所有 context 的 as_of 不晚于 2026-08-26，valid_until 未过期或使用登记 sentinel；
- F4 的 11 条固定边界题语义、S3 与主边界总体一致；
- 全量近重复门返回 0 对；
- corpus 已明确 H/M/L 是启发式先验，不是市场概率；语料也明确不是完整多轮 benchmark。

即使修复本报告的 A/B 项，仍必须保留以下能力条件：

- coding 需要可用且已登记的 Tier1 adapter、workspace、Gate 0 与 verify；
- writing 需要显式开启类型门、git worktree 和人工逐节验收；
- Claude Code 需要配置、身份登记及剩余 live conformance；
- Hopper/Codex 在当前用户派发链未接线前不能宣称 F1 current path；
- 浏览器、PDF、表格、邮件、日历、CRM、消息、财务等工具均依赖外部能力、登录态、数据授权与人工确认；
- USER/LIVE 不能由相似 CTX 或模型常识替代；
- 本语料仍只是场景层素材，不是带完整 transcript、授权收据、执行 fixture 和验收 oracle 的可计分 benchmark。

## 11. 最终判定

`[fail]`

当前版本不能作为“能力、工具、输入、S0-S3、F1-F4、B-* 与 context required claims 已终审闭合”的冻结基线。至少先关闭 `A-CAP-001`、`A-CTX-001`、`A-RISK-001`，再修正 B 级 ID 清单、补语义反例门，并由绝对隔离的全新会话重新遍历 600 条、16 个 context 和全部来源后，才可重新判定。
