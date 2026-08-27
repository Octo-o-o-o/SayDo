# SayDo 600 条潜在客户提问语料 v7 最终独立对抗评审

[fail] 最终裁决。数量、配额、来源登记、去重与自然度门通过，但存在 2 个 A 级、3 个 B 级问题；按规则，任一 A/B 即不能通过。

## 一、范围与方法

隔离门有效：

- 未读取或搜索任何禁止路径。
- 未运行 Git diff/status/log/commit。
- 未运行 `rebuild.mjs` 或 mutation。
- 未修改文件、正式语料或提交。
- 完整读取 README、00/01/02/03、12 个 questions、16 个 manifest、50 个 source、`validate.mjs`、`rebuild.mjs`，并读取必要的 `docs`、`packages`、`pipeline` 能力证据。
- 逐条审阅 600 条记录及 172 条 required claim；独立遍历全部 179,700 对字符近似，并人工检查最高相似对及跨域同构。
- 当前日期为 2026-08-26；16 个 context 均未越过其声明的有效期，冻结或不可变事件窗口也均明确要求 LIVE 刷新现势部分。

## 二、全量计数

### 领域与频率

| 领域 | H | M | L | 合计 |
|---|---:|---:|---:|---:|
| ENG | 54 | 42 | 24 | 120 |
| PRJ | 31 | 25 | 14 | 70 |
| WRT | 32 | 24 | 14 | 70 |
| RES | 27 | 21 | 12 | 60 |
| OPS | 25 | 19 | 11 | 55 |
| SAL | 20 | 16 | 9 | 45 |
| MKT | 20 | 16 | 9 | 45 |
| DAT | 16 | 12 | 7 | 35 |
| LRN | 13 | 11 | 6 | 30 |
| LIF | 13 | 11 | 6 | 30 |
| CAR | 9 | 7 | 4 | 20 |
| FAM | 10 | 6 | 4 | 20 |
| 总计 | 270 | 210 | 120 | 600 |

### 标签

| 维度 | 全量分布 |
|---|---|
| C | C1=31，C2=215，C3=252，C4=78，C5=24 |
| D | D0=238，D1=292，D2=29，D3=3，D4=38 |
| H | H0=479，H1=22，H2=27，H3=31，H4=41 |
| R | R1=23，R2=421，R3=109，R4=47 |
| K | K0=36，K1=80，K2=347，K3=125，K4=12 |
| S | S0=161，S1=182，S2=224，S3=33 |
| F | F1=48，F2=481，F3=60，F4=11 |
| B | B0=339，B-AUTH=117，B-PRIV=66，B-LEG=21，B-ID=7，B-ATTR=8，B-MED=11，B-FIN=31 |

工具数分布为 0=36、1=80、2=177、3=170、4=98、5=27、6=10、7=2。出现最多的工具族为 `document=232`、`rag=182`、`tasks=119`、`test=92`、`repo=88`、`spreadsheet=87`、`browser=83`、`finance=70`。

上下文组合：

| 组合 | 条数 |
|---|---:|
| LIVE | 260 |
| CTX+LIVE | 106 |
| USER+LIVE | 92 |
| USER | 61 |
| CTX | 31 |
| CTX+USER | 28 |
| CTX+USER+LIVE | 7 |
| 自包含 `-` | 15 |

共 16 个 manifest、50 个 source、172 条 required claim。CTX 使用次数依次为：01=13、02=12、03=22、04=6、05=10、06=15、07=16、08=15、09=8、10=9、11=9、12=4、13=6、14=3、15=11、16=13。

## 三、发现

### A-01：LIVE reader 存在系统性假闭合

465 条记录含 `LIVE`，但 `liveSourceContracts` 只覆盖 35 条；其余 430 条只要命中任意一个通用工具就通过。实现见 [`validate.mjs:47`](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:47) 与 [`validate.mjs:1122`](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1122)。这不满足“每个 LIVE 都登记定位、字段、权威、新鲜度及相称 reader”的合同要求，[`03-频率与语义校准.md:61`](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:61)。

已确认的实际假闭合包括：

- `OPS-051` 只登记 `tasks,automation,notification`，但 LIVE 必须读取人流、设备、安全事件和分派状态。`tasks` 最多覆盖分派，`automation/notification` 是编排或输出，不能读取现场态势。[问题行](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:118)，[manifest](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-14/manifest.md:32)。
- `SAL-014` 只有 `spreadsheet,finance,rag`，但 manifest 要求刷新产品状态、迁移实测和审批现势；现有工具最多覆盖价格/TCO，`rag` 不能代替产品、测试及审批 reader。[问题行](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:53)，[manifest](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-16/manifest.md:33)。
- `LRN-009` 只有 `calendar,notification`，但还需读取“当前错题进展”。日历只能覆盖时段，通知是输出；缺学习进度 reader。[问题行](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:20)，[manifest](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-10/manifest.md:33)。
- `SAL-002` 的 supplemental 明确说读取当前 CRM，工具却只有 `email,tasks`，缺 `crm`。[问题行](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:10)，[manifest](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-07/manifest.md:36)。
- `MKT-003` 需要七日行为数据，工具只有 `email,calendar`，缺 BI/分析 reader。[问题行](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:10)，[manifest](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-08/manifest.md:32)。

这是用户定义中的 RAG 假闭合，故为 A。

### A-02：FAM-013 将真实外部写入标为 S0

`FAM-013` 先预览、确认成员与字段，然后“再建”共享日历和交接清单，却标为 `S0`。[问题行](~/WorkSpace/SayDo/research/customer-question-corpus/questions/12-household-family-community.md:24)。

S0 仅适用于非敏感读取；外部 SaaS 写入至少应达到与实际 effect 相称的风险级别，[语料规则](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:67)及[风险 canonical](~/WorkSpace/SayDo/docs/04-key-mechanisms.md:136)均明确这一点。`B-LEG` 和题面确认条件不能抵消 S 风险。

validator 的圈外写入正则只识别“创建共享日历”等固定措辞，未识别“确认后再建”，因此绿色通过，见 [`validate.mjs:1172`](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1172)。这是明确风险失真，故为 A。

### B-01：11 条 F4 的 D 标签衡量了幻想任务，而非实际首个结果

D 的定义是“SayDo 何时给出首个可审阅结果”，不是越权请求假如获准后的运行时长，[`01-设计与分布.md:35`](~/WorkSpace/SayDo/research/customer-question-corpus/01-设计与分布.md:35)。

当前 11 条 F4 分布为：

```text
F4_ROWS=11 F4_D0=0 F4_D1=1 F4_D2=1 F4_D4=9
```

例如：

- `ENG-120` 要求隔夜完成一年路线并直接部署，当前为 D2；实际安全结果应是立即拒绝或改写范围。[问题行](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:256)。
- `MKT-043` 要从私密互助群抓患者信息自动投放，当前为 D1；边界响应同样不需要一个工作日。[问题行](~/WorkSpace/SayDo/research/customer-question-corpus/questions/07-marketing-growth.md:102)。
- 其余 9 条完全托管型 F4 均为 D4。

validator 只检查这些 ID 是否为 F4、S3，不核对 D，见 [`validate.mjs:34`](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:34)及 [`validate.mjs:1098`](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1098)。这是系统性标签错误，故为 B。

### B-02：OPS-040 以 D1/无自动化工具承载持续系统

`OPS-040` 明确要求“建立持续更新的证据索引”，却标 `D1`，工具为 `database,monitoring,rag`。[问题行](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:91)。

当前组合存在二选一冲突：

- 若只交付一次性索引快照，应把题面收窄为一次性产物；
- 若保留“持续更新”，按 D4 定义应登记 D4，并具备相称的更新调度/写入机制。

仅有 `monitoring` 能读取现势，不能自动维持索引更新。validator 的 D4 门只有记录预先被标成 D4 才运行，因此该条以 D1 绕过，见 [`validate.mjs:1138`](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1138)。这是 D/工具合同不一致，故为 B。

### B-03：validator 的语义覆盖不足以支撑其绿色结论

横切缺陷包括：

- 465 条 LIVE 中仅 35 条有逐对象 reader contract。
- 圈外写入使用固定中文措辞正则，`FAM-013` 的“再建”可绕过。
- F4 只检查 F/S，不检查实际响应的 D。
- D4 工具门先信任 D 标签，无法发现“持续运行但被标 D1”的条目。
- required claim 主要通过固定字符串、摘要与少数 token 断言；摘要只能证明未漂移。[`validate.mjs:1413`](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1413)、[`validate.mjs:1430`](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1430)、[`validate.mjs:1460`](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1460)。

README 自身也承认 validator 不能证明任意语义蕴含，[`README.md:55`](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:55)。但现有盲区已经放过真实 A/B 反例，因此构成 B 级 validator 缺陷。

### C-01：PRJ-047 的 required claim 混入未标明的分析性归因

`CTX-03/PRJ-047` 将“10 月 8 日培训、试点二缺客户、迁移只测 50 租户”统称为“采用风险”，见 [manifest](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-03/manifest.md:48)。

来源只直接登记了培训日期、缺客户和测试租户数量，[`milestones.md:3`](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-03/milestones.md:3)与 [`milestones.md:10`](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-03/milestones.md:10)；“均是采用风险”是合理但未标明的分析推断。建议区分来源事实与推断。因尚不能证明其结论必然错误，列 C，不单独触发失败。

除该归因问题外，人工复核未发现其余 required claim 与 source 正文之间可证实的直接矛盾。

## 四、专项结论

### RAG 与上下文

[fail]。CTX/source 的数量、对称性、supplemental 列和有效期结构通过，但 LIVE 的逐对象 reader 闭合失败，见 A-01。

### 能力与风险

[fail]。F1 仅覆盖显式 coding/workspace 清单，与代码中缺省 `["coding"]` 及类型门一致，[`config/types.ts:113`](~/WorkSpace/SayDo/packages/daemon/src/config/types.ts:113)、[`typeGate.ts:25`](~/WorkSpace/SayDo/packages/daemon/src/tier1/typeGate.ts:25)。33 条 S3 均有非 B0 边界，11 条 F4 也均为 S3。

但 `FAM-013` 将真实外部写入标 S0，破坏风险合同。代码侧同样将外部发送列为 S3 effect，[`policy/engine.ts:39`](~/WorkSpace/SayDo/packages/daemon/src/policy/engine.ts:39)。

### 概率顺序

[ok]。逐域检查未确认显著概率逆序：

- D4 共 38 条，H/M/L 分布为 11/4/23。
- 11 条 H/D4 均是依赖、培训、订阅、pipeline、报表或提醒等熟悉的重复触发，不是跨年转型或完全托管。
- 跨国重构、并购整合、长期照护、重大 rebrand、完全自治及全部 F4 均落在 L。
- H/M/L 仍只是专家先验，真实市场概率未验证。

### 去重

[ok]。独立遍历与 validator 都得到 179,700 对，阈值 0.55 以上为 0。top-10 为：

| 排名 | 对 | Dice |
|---:|---|---:|
| 1 | CAR-001 / CAR-005 | 0.333333 |
| 2 | SAL-002 / SAL-012 | 0.324324 |
| 3 | RES-012 / OPS-006 | 0.309859 |
| 4 | ENG-109 / WRT-042 | 0.294118 |
| 5 | ENG-045 / LRN-016 | 0.260870 |
| 6 | PRJ-020 / WRT-019 | 0.254545 |
| 7 | ENG-014 / WRT-006 | 0.245614 |
| 8 | WRT-055 / RES-014 | 0.244898 |
| 9 | SAL-027 / MKT-020 | 0.241379 |
| 10 | ENG-054 / DAT-016 | 0.237288 |

人工复核认为这些分别在产物、决策对象、时域或受众上有实质差异；未发现只替换角色名的跨域同构重复。

### 自然度与覆盖

[ok]。

- 平均长度：H=35.122、M=36.733、L=38.158 字。
- 中位数：H=34、M=35、L=35；P95 分别为 49、51、55；最长为 68。
- 问号结尾率：H=31.1%、M=23.3%、L=18.3%。
- “把”字开头 70 条；最常见二字开头为“这个”22、“我们”12、“根据”11、“客户”10、“我把”9，未形成单一模板垄断。
- `fixture`、`schema`、`cohort`、`dry-run` 等只出现在相称的技术场景；未发现 CTX、S/F 标签等内部验收语言泄漏。
- ENG 至 CAR 等生产力领域 550 条，LIF/FAM 50 条；另有 LRN/CAR 覆盖个人成长。显式娱乐关键词搜索为 0。

## 五、命令证据

实际执行：

```zsh
node research/customer-question-corpus/validate.mjs
validator_rc=$?
printf 'VALIDATOR_EXIT=%d\n' "$validator_rc"
exit "$validator_rc"
```

关键原始输出：

```text
"records": 600,
"questionFiles": 12,
"contextManifests": 16,
"demandPrior": {"H":270,"M":210,"L":120},
"fixtureSources": 50,
"requiredClaims": 172,
"allQuestionPairs": 179700,
"nearDuplicatePairsAt055": 0

[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
VALIDATOR_EXIT=0
```

独立只读统计的关键输出：

```text
LIVE_ROWS=465 OBJECT_CONTRACTS=35 GENERIC_FALLBACK=430
F4_ROWS=11 F4_D0=0 F4_D1=1 F4_D2=1 F4_D4=9
D4_TOTAL=38 H=11 M=4 L=23
PAIR_COUNT 179700
```

一次 heredoc 统计尝试因只读沙箱禁止创建临时文件而失败：

```text
zsh:1: can't create temp file for here document: operation not permitted
```

随后改为不创建临时文件的 `node -e` 完整重跑成功；上述统计来自成功重跑。

## 六、rebuild 与验证边界

代码审阅确认：

- 先在同级 staging 中生成 questions 与 contexts，并运行 staged validator，[`rebuild.mjs:2411`](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2411)。
- 通过多次 rename 晋升两棵目录，并对可捕获异常尝试反向 rename 回滚，[`rebuild.mjs:2371`](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2371)。
- 回滚失败时保留备份并抛出聚合错误，[`rebuild.mjs:2392`](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2392)。

边界表述诚实：这是多次目录 rename，不是跨两棵树的断电事务；进程强杀或断电可能停在中间态，README 也明确披露该限制。

## 七、已验证与未验证

已验证：

- 600 条、连续唯一 ID、12 域和逐域 H/M/L 配额。
- 全部标签与工具数量分布。
- 16 个 manifest、50 个 source、172 条 required claim 的结构及人工语义审阅。
- 465 条 LIVE 的逐题 reader 人工审查及缺陷样本。
- 179,700 对字符近似、validator top-10 与跨域同构。
- 当前 canonical 和代码中的缺省 coding 能力、类型门及风险定义。
- validator 本次退出码为 0。

未验证：

- H/M/L 的真实市场概率、访谈提及率和线上复发率。
- 所列外部 connector、登录态及 LIVE reader 的真实集成可用性。
- source 所描述合成事实之外的现实世界真实性。
- `rebuild.mjs`、mutation、故障注入与断电恢复；本轮按要求未运行。
- Git 工作区、commit 或历史状态；本轮按隔离门禁止检查。

## 最终裁决

[fail]

结构 validator 为绿色，但不能覆盖本轮发现的 reader 假闭合、S0 风险失真和 D/D4 语义问题。至少 A-01、A-02、B-01、B-02、B-03 关闭并由新的零上下文会话复审前，不能判 `[pass]`。