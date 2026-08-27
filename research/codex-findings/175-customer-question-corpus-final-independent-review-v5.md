# SayDo 600 条潜在客户提问语料最终独立对抗评审 v5

## 最终裁决

`[fail]`

发现 1 组 A 级问题、8 组 B 级问题。数量、文件配额和机械合同均通过，但风险标签、工具闭合、required-claims 语义、D/H 标签、跨领域重复和自然度仍未达到最终放行标准。

## 一、方法与隔离

- 逐条读取 12 个 `questions/*.md`，覆盖全部 600 条。
- 读取 16 个 context manifest 和全部 50 个 source 正文，逐项核对 172 条 required-claims 关联。
- 读取指定 corpus 规范、`rebuild.mjs`、`validate.mjs`，以及必要 canonical 和代码。
- 独立遍历全部 179,700 对问题，计算字符二元组 Dice、二元组 Jaccard、三元组 Jaccard，并人工复核 validator top-10 及跨措辞同构候选。
- 未读取禁止路径，未运行任何 Git 命令，未读取其他代理产物。
- 未修改文件、未运行会写盘和晋升目录的 `rebuild.mjs`。

## 二、全量计数

### 领域与频率配额

| 领域 | 总数 | H | M | L |
|---|---:|---:|---:|---:|
| ENG | 120 | 54 | 42 | 24 |
| PRJ | 70 | 31 | 25 | 14 |
| WRT | 70 | 32 | 24 | 14 |
| RES | 60 | 27 | 21 | 12 |
| OPS | 55 | 25 | 19 | 11 |
| SAL | 45 | 20 | 16 | 9 |
| MKT | 45 | 20 | 16 | 9 |
| DAT | 35 | 16 | 12 | 7 |
| LRN | 30 | 13 | 11 | 6 |
| LIF | 30 | 13 | 11 | 6 |
| CAR | 20 | 9 | 7 | 4 |
| FAM | 20 | 10 | 6 | 4 |
| 合计 | 600 | 270 | 210 | 120 |

领域配额和 H/M/L 配额均精确满足。逐领域比较后，没有发现足以定为 A/B 的明显频率逆序。三个简单长尾基线 `ENG-078`、`WRT-068`、`DAT-034` 均确实只要求单一检查或讨论材料，不执行签名、发布或专业裁决，`L/C1/R1` 语义成立。

### 标签总量

- C：C1 28、C2 242、C3 241、C4 65、C5 24。
- D：D0 258、D1 273、D2 27、D3 4、D4 38。
- H：H0 479、H1 23、H2 26、H3 31、H4 41。
- R：R1 23、R2 433、R3 97、R4 47。
- K：K0 32、K1 108、K2 349、K3 103、K4 8。
- S：S0 194、S1 185、S2 188、S3 33。
- F：F1 49、F2 480、F3 60、F4 11。
- B：B0 390、B-AUTH 118、B-PRIV 39、B-ID 6、B-LEG 15、B-ATTR 5、B-MED 13、B-FIN 14。

生产力场景 550 条，生活管理场景 50 条；角色表述 599 个唯一值、目的 600 个唯一值、工具族 36 种。娱乐候选关键词扫描为 0。全局 C/D/H/R/K/S/F/B 均有覆盖。

## 三、发现

### A-01 风险与主边界被低标，构成风险失真

1. `SAL-037` 使用 CRM，处理跨十国相关方、法规、数据驻留和定价，却标为 `S0/B0`：`questions/06-sales-customer-procurement.md:96`。
2. `DAT-029` 读取并合并多实体预算、汇率、关账日和内部交易抵消，也标为 `S0/B0`：`questions/08-data-finance.md:76`。

这两项不是非敏感公开资料读取。语料规则明确规定敏感读取不能是 S0：`03-频率与语义校准.md:69`；实际策略代码也将 `touchesSensitiveData` 升至至少 S2：`packages/daemon/src/policy/engine.ts:29`、`:66`。主边界至少还应重新选择 `B-LEG/B-PRIV` 和 `B-FIN`，不能保持 B0。

### B-01 required-claims 大面积退化为不可判定的通用免责声明

独立统计结果：

```text
TOTAL=172
GENERIC_CLAIMS=112
GENERIC_SUPPLEMENT=100
EXIT_CODE=0
```

构建器对无显式 override 的记录生成：

```text
“<包级主题>；用于 <ID> 时仅支持这些来源事实……”
“LIVE 读取当前代码、系统、SaaS 或现势资料”
```

证据：`rebuild.mjs:1641-1653`。validator 只检查 claim 字符串唯一；因为通用文本中自动带 ID，唯一性天然成立：`validate.mjs:768-799`。这不能证明题目所需事实由来源蕴含。

两个具体暴露点：

- `CAR-010` 需要原十二周计划、前四周具体完成情况和当前可用资源：`questions/11-career-freelance.md:20`。CTX-11 实际只有简历、岗位要求和经历库：`contexts/CTX-11/resume-draft.md:3-12`、`job-requirements.md:3-9`、`accomplishment-bank.md:3-9`。manifest 仅登记通用 LIVE：`contexts/CTX-11/manifest.md:34`，没有把原计划和进度列为 required supplemental facts。
- `RES-002` 要区分厂商自报与实测：`questions/04-research-decision.md:10`。source 明确只有厂商自报：`contexts/CTX-16/vendor-responses.md:3-9`；manifest 仍只给通用 LIVE：`contexts/CTX-16/manifest.md:32`，工具也没有 `test`。

这些记录未必不可完成，但当前合同不能判定输入是否真的闭合。

### B-02 多条工具链不能支撑题面要求

| ID | 证据 | 缺口 |
|---|---|---|
| RES-005 | `questions/04-research-decision.md:16` | `rag+USER` 无法独立寻找原始来源及更新日期；至少需 browser/LIVE，或明确 USER 已提供完整原始来源集。 |
| RES-021 | `questions/04-research-decision.md:73` | 只有 `test`，不足以核验外部平台限制并完成最小 spike；缺 browser/repo/design 中的必要能力。 |
| RES-049 | `questions/04-research-decision.md:56` | 持续监测竞品价格、产品和人员，只列 automation/notification/rag，缺当前 Web reader。 |
| PRJ-064 | `questions/02-product-project.md:146` | 销售、交付、合同、尾款全流程只列 CRM，无法读取合同、项目任务和财务事实。 |
| OPS-034 | `questions/05-business-operations.md:52` | automation/monitoring 不能读取订阅合同、席位和价格；缺 SaaS/finance/spreadsheet/browser 类输入。 |
| DAT-028 | `questions/08-data-finance.md:67` | 要执行质量检查并 quarantine 数据，却没有 database/bi 工具。 |
| LRN-023 | `questions/09-learning-development.md:57` | pdf 只能读已有文件，不能发现三篇当前可访问全文；缺 browser/rag。 |
| CAR-015 | `questions/11-career-freelance.md:41` | 只列 rag，无法可靠计算客户来源、项目利润与容量组合。 |
| ENG-115 | `questions/01-software-it.md:248` | 双写对比、真实成本、退出失败回滚只列 spreadsheet/cloud，缺 repo/database/test。 |

`contexts` 规范明确区分 RAG 与现势读取：`contexts/README.md:5`、`README.md:28-31`。validator 的 `liveInputTools` 却把 rag、document、pdf 等一律视为 LIVE reader：`validate.mjs:39-44`，无法发现上述语义缺口。

### B-03 C/D/H 标签混淆首个结果与总周期

- `WRT-057` 标 `D3 H3`，但题目要求逐章确认，首个可审阅大纲或首章不需要等几个月：`questions/03-writing-content.md:132`。应按首个实际结果重新定为 D1/D2。
- `ENG-062` 标 `H4`，只是把一条每日运行的现有管线改成增量，并未要求 SayDo 持续每日管理：`questions/01-software-it.md:84`。把被改系统的周期误当成请求周期。
- `ENG-103` 的两个场景对照原型标 `C2 D0 R4`：`questions/01-software-it.md:232`。权限撤销、历史压缩、OT/CRDT 原型不可能同时属于少量简单步骤且 30 分钟内可审阅。
- `PRJ-049` 要经过采访形成愿景、用户、流程、数据合同和分阶段文档，却标 `C2 D0`：`questions/02-product-project.md:115`。
- `ENG-115` 要拿到实际双写、成本和回退证据，却标 `C2 D0`：`questions/01-software-it.md:248`。

规范明确 D3 是实际执行 2–6 周后才出现首个结果，不能用总计划周期反填：`01-设计与分布.md:35-51`。

### B-04 专业主边界漏标或选错

- `DAT-027` 董事会现金流、融资和裁员情景为 `B0`，应有 B-FIN：`questions/08-data-finance.md:65`。
- `RES-052` 并购目标、估值和交易结论为 `B0`，应在 B-FIN/B-LEG 中选择主边界：`questions/04-research-decision.md:126`。
- `LIF-017` 高金额买房、维修和合同疑点为 `B0`：`questions/10-personal-life-admin.md:45`。
- `LIF-025` 主动上浮签证、税务和资格判断，却只标 B-MED：`questions/10-personal-life-admin.md:68`。按“一个主边界、以主要输出选择”的规则，需要重新判断 B-LEG/B-FIN：`03-频率与语义校准.md:73`。

边界定义证据：`00-能力边界.md:71-80`。

### B-05 `MKT-023` 无法判断草稿还是 live 外发

`MKT-023` 写“人工批准外发”，但未说明是人亲自发送，还是批准后由 SayDo 发送：`questions/07-marketing-growth.md:63`。

- 若只做草稿，应明确“不外发/由人发送”。
- 若批准后 live 外发，应增加 email/messaging，风险升 S3，能力应为 F3。

当前 `S2/F2` 和 calendar/crm/rag 不能同时覆盖两种解释。canonical 也明确当前直接签发和消费没有覆盖邮件发送：`00-能力边界.md:34`。

### B-06 D4 周期门只覆盖 2/38，且有持续编排工具缺口

统计：

```text
D4_TOTAL=38
WITH_AUTOMATION=32
WITHOUT_AUTOMATION=6
EXIT_CODE=0
```

不带 automation 的 6 条中，提醒类任务可由 calendar/tasks/notification 支撑；但 `PRJ-068` 要长期自主排优先级、调人和承诺客户日期，却只有 tasks/calendar/crm/messaging，没有持续编排能力：`questions/02-product-project.md:154`。

更根本的问题是 validator 的周期门仅硬编码 `MKT-028`、`MKT-044`：`validate.mjs:262`、`:573-575`。它没有对全部 D4 验证是否至少包含登记的持续调度、状态保存或监控工具集合。

### B-07 字符去重通过，但存在两组跨领域语义重复

独立计算精确访问了全部 179,700 对，validator top-10 与独立二元组 Dice 完全一致，阈值 0.55 以上为 0。

人工复核 top-10 后发现：

- `ENG-117` / `RES-060`：都是设计桌面推演、分阶段注入信息、记录决策；主要只替换了“区域故障”与“市场/监管/技术/现金流”场景。证据：`questions/01-software-it.md:250`、`questions/04-research-decision.md:136`。
- `PRJ-016` / `SAL-009`：都是按证据压缩本周真实变化、风险和需要管理层帮助的事项，主要只替换了项目任务与销售 pipeline 数据源。证据：`questions/02-product-project.md:32`、`questions/06-sales-customer-procurement.md:24`。

两组都需要合并，或让输入、决策、输出、验收/effect 至少两项实质分叉。其余 top-10 可保留。

### B-08 至少两条把授权合同和验收规范直接说进客户嘴里

- `OPS-048` 长 107 字，为全库最长；一次性枚举授权主体、收件人、当前渠道、三类 effect、每次确认字段和医疗负面边界：`questions/05-business-operations.md:56`。
- `MKT-033` 长 80 字，连续写入 current config、批准、live 写、下游自动外发、回滚和禁止即时补发：`questions/07-marketing-growth.md:46`。

二者安全信息不可删除，但现有表述更像 required-claim/验收合同，不像潜在客户自然开口。应把不影响首次理解的约束留在目的、输入合同或后续确认中。

附加 C 级自然度观察：`LRN-002/LRN-003` 重复使用“原题、我的作答和可核验答案给你”，`WRT-047` 使用 `live/supersede/owner` 三个内部化术语，建议下一轮口语化。

## 四、自然度统计

| 档位 | 句末问号 | 含任意问号 | 启发式语义问句 | 平均长度 | 中位数 | P90 | 最大 |
|---|---:|---:|---:|---:|---:|---:|---:|
| H | 84/270，31.11% | 127/270，47.04% | 139/270，51.48% | 34.65 | 33 | 42 | 107 |
| M | 49/210，23.33% | 67/210，31.90% | 70/210，33.33% | 36.11 | 35 | 43 | 67 |
| L | 23/120，19.17% | 32/120，26.67% | 33/120，27.50% | 36.41 | 35 | 44 | 64 |

“启发式语义问句”同时检查疑问词、疑问语气和问号，不作为自然度裁决本身。

开头集中度最高的是：“把”70、“这”60、“我”36、“用”24、“按”20、“每”20、“先”20。整体长度与高频较短的设计目标相符，但固定开头和少数合同式长句仍需修。

## 五、RAG 与上下文结论

- 16 个 context、50 个 source、172 条 supported-question/required-claim 关联均已读取。
- 13 个日期型 `valid_until` 在 2026-08-26 未过期；CTX-01/04 使用 `fixture-frozen`，CTX-02 使用 `immutable_event_window`。
- source 链接、source 集合、required-claims 对称、digest 和日期机械检查均通过。
- 各 manifest 均声明 claim scope、unsupported scope 和 authority order。
- digest 只能证明字节未漂移；112 条通用 claim 是本轮主要语义缺口。
- 未发现 CTX-only source 明确伪造事实的 A 级案例；发现的是通用合同无法证明具体 supplemental facts 已闭合。

## 六、能力核对结论

能力档整体没有出现“大量把当前路线图写成 F2”的问题：

- 33 条 S3 全部为 F3 或 F4，没有 S3/F2。
- 11 条 F4 均属于明确越权、完全托管、冒充、自动付款或自动交易。
- 预授权 EffectGrant 实际只有 `install_dependency` 和 `push_branch`：`packages/contracts/src/types/package.ts:10-12`。
- S3 challenge 实际签发入口只有 `register/merge`：`packages/daemon/src/tier1/s3Tools.ts:102-108`。
- 默认启用类型仍为 coding；其他类型需要显式开值：`packages/daemon/src/config/types.ts:113-121`。

因此发布、支付、流量切换、预订、邮件发送等记录落 F3/F4 的主方向正确。红灯是少数风险标签和题面 draft/live 歧义，不是总体 F 分层失控。

## 七、构建器与 validator 诚实边界

### 已验证为真实

- 构建前断言 600 条、ID 基线、领域数量和 H/M/L 配额：`rebuild.mjs:1584-1600`。
- staged trees 先验证，再晋升：`rebuild.mjs:1734-1752`。
- 可捕获 rename 失败会尝试恢复 questions/contexts，回滚失败时保留备份：`rebuild.mjs:1694-1731`。
- validator 重算 source 和 required-claims digest：`validate.mjs:745-772`。
- 全部 179,700 对确实进入 Dice 计算，top-10 来自全量排序：`validate.mjs:659-691`。
- README 正确声明构建器不是进程强杀/断电下的文件系统事务，也承认 validator 不证明语义蕴含或市场概率：`README.md:54`。

### 仍有缺口

- required-claim 唯一性被自动注入 ID 轻易满足。
- LIVE 工具门只检查“命中任一宽泛工具族”，不检查该工具能否读取题目所需现势。
- D4 自动化门只覆盖两个 ID。
- 自然度门主要检查句末问号、`把` 开头和平均长度：`validate.mjs:843-863`，不能发现合同式长句。
- 精确标签 baseline 会防漂移，但也会把现有错误固化为“语义基线”，不能充当独立语义证明。

## 八、命令证据与未验证边界

真实运行：

```text
node research/customer-question-corpus/validate.mjs
...
[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
EXIT_CODE=0
```

独立只读统计关键输出：

```text
FILES=12 RECORDS=600 PAIRS=179700
FREQ={"H":270,"L":120,"M":210}
CONTEXTS=16 SOURCE_FILES=50 SUPPORTED_LINKS=172
TOTAL=172 GENERIC_CLAIMS=112 GENERIC_SUPPLEMENT=100
D4_TOTAL=38 WITH_AUTOMATION=32 WITHOUT_AUTOMATION=6
ENTERTAINMENT_CANDIDATES=0
EXIT_CODE=0
```

独立二元组 Dice top-10 与 validator 十组 ID 和分数完全一致。

未验证：

- 未执行 `rebuild.mjs`，因为它会创建暂存目录并晋升正式 questions/contexts，超出本次只读授权。
- 未实测 rename 故障注入、进程崩溃或断电原子性；这里只核对了代码和 README 的声明边界。
- 未验证真实市场概率；H/M/L 仅按仓内专家启发式做相对一致性复核。
- 统计阶段一次 here-doc 包装因只读环境不能创建临时文件退出 1，另一次正则表达式写法错误退出 1；两次失败输出均未作为证据，随后全部改用只读 `node -e` 重跑并取得退出码 0。

## 九、放行条件

至少完成以下修复并重跑独立评审：

1. 修正 `SAL-037`、`DAT-029` 的 S/B 风险失真。
2. 将 112 条通用 required claims 收窄为题目级事实和明确 supplemental facts，优先修 `CAR-010`、`RES-002`。
3. 修复列出的工具链、C/D/H 和专业边界问题。
4. 明确 `MKT-023` 是草稿还是 live 外发。
5. 扩展 D4 和 LIVE 语义门。
6. 消除两组跨领域语义重复。
7. 重写 `OPS-048`、`MKT-033` 的合同式客户话术。

最终裁决：`[fail]`。