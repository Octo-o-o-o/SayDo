# SayDo 600 条潜在客户提问语料 v8 独立终审

## 1. 结论

`[fail]`

- A 级：0 项。
- B 级：4 组，涉及 27 个唯一 ID；其中 1 组是合同字段生成的系统性缺陷，另外 3 组是逐题输入闭合或授权缺口。
- C 级：0 项。对可合理解释的频率、时域和轮次差异没有硬判。

数量、12 域配额、H/M/L 配额、声明标签的机械关系、465 条 LIVE 与 986 个来源对象的结构登记、16 个 CTX manifest、46 条 F1 合同、11 条 F4、D4 持续工具门以及 179700 个两两组合均通过现有 validator。终审仍判失败，是因为 validator 只能证明“登记存在且形状匹配”，不能证明 reader/source 对题面对象具有语义承载能力；`README.md:57` 和 `04-live-source-contracts.md:3` 也明确保留了这项人工审查责任。

## 2. 审查边界与方法

本轮只读当前 `README.md`、`00-能力边界.md`、`01-设计与分布.md`、`02-覆盖索引.md`、`03-频率与语义校准.md`、`04-live-source-contracts.md`、12 个 `questions/*.md`、必要的 CTX manifest、必要的 `contracts/live/*.json`、`validate.mjs` 与必要 canonical。未读取旧评审、旧 Codex findings、prompts、logs、过程 journal、mutation 脚本、rebuild 脚本、Git 状态/diff/log 或其他代理输出。

人工审查覆盖：

1. 全量 600 行逐条核对 C/D/H/R/K/S/F/B、工具、上下文模式、目的和题面 effect。
2. 每域按 H、M、L 逆序比较角色覆盖、触发频次、自然表达可能性与罕见前提。
3. 全量复核 122 条非 H0、30 条 D4、所有 D2/D3、23 条 R1、46 条 R4、36 条 K0、13 条 K4、33 条 S3、46 条 F1 和 11 条 F4。
4. 对 465 条 LIVE 的每个题面对象检查 locator、required fields、reader、authority、freshness、principal scope 与题面语义是否闭合；字段存在本身不作为通过证据。
5. 运行 validator 的全量 179700 对检查，并人工比较其最高相似对和跨域主题族。
6. 统计 H/M/L 长度、问句结尾、固定开头和合同式词汇，再回读长句确认自然度。

首次机器门禁真实输出为：

```text
node research/customer-question-corpus/validate.mjs
...
[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
VALIDATOR_RC=0
```

退出码在 validator 命令后立即读取。机器门通过不改变下述人工 B 级结论。

## 3. B 级发现

### B-01：跨 source kind 批量撒字段，生成了语义上不可能由 reader 提供的合同字段

受影响的已确认代表 ID：`ENG-120`、`LIF-007`、`SAL-017`。

全量解析 465 条 LIVE、986 个对象后，三字段组合分布为：

| 字段组合 | 对象数 | ID 数 |
|---|---:|---:|
| `learner_id,learning_item,progress` | 40 | 21 |
| `speaker_id,utterance,timestamp` | 39 | 19 |
| `amount,currency,financial_status` | 222 | 93 |
| `location,route,duration` | 31 | 13 |
| `email_address,thread_id` | 36 | 14 |

这些计数本身不表示每一处都错；下面三处是直接可判定的不相称证据：

- `questions/01-software-it.md:256` 的 `ENG-120` 说的是“一年产品路线”，但 `04-live-source-contracts.md:170` 给 repo、test、CI、cloud、monitoring 五种对象全部加入 `location,route,duration`。这里的“路线”是 roadmap，不是地理 route。该题 D0 安全响应不读取数据，因而不会造成首次拒绝不安全；缺陷仍污染了改写范围后的输入合同。
- `questions/10-personal-life-admin.md:20` 的 `LIF-007` 以会议作为行程约束，`04-live-source-contracts.md:190` 却让 calendar、spreadsheet、finance、browser、maps、PDF 六种对象全部声明 `speaker_id,utterance,timestamp`，其中多数 reader 不提供会议话语内容。
- `questions/06-sales-customer-procurement.md:34` 的 `SAL-017` 只是要“从失败机会中学习”，`04-live-source-contracts.md:429` 却让 CRM、email、calendar 全部声明 learner 三字段；同一行还把 speech 三字段撒到三类对象上。

修复方向：required fields 必须按“题面对象 x source kind”人工登记或使用严格 allowlist，不得从题面关键词把一组字段复制到所有对象。validator 应新增不相称字段反例，例如 repo 上的地理 route、finance 上的 utterance、calendar 上的 learner progress，并要求每个字段能指向该 reader 实际可读取的对象属性。

### B-02：CTX 明确要求的 LIVE supplemental 没有对应 reader/source

以下不是“希望多一个工具”，而是 manifest 已经明确声明必须补的现场对象与现有 LIVE 合同不一致。

| ID | file:line 证据 | 缺口 | 修复方向 |
|---|---|---|---|
| `ENG-035` | `questions/01-software-it.md:62`；`contexts/CTX-01/manifest.md:34`；`04-live-source-contracts.md:90` | manifest 要读当前埋点规范、代码和日志脱敏规则，合同只有 monitoring 与 BI；CTX-01 还在 `manifest.md:7` 明确不含代码。 | 增加 repo/filesystem 的代码与规范对象；日志继续由 monitoring 读取，并登记脱敏规则版本与 authority。 |
| `PRJ-010` | `questions/02-product-project.md:26`；`contexts/CTX-03/manifest.md:40`；`04-live-source-contracts.md:318` | supplemental 要当前工程容量、演示需求和依赖状态，唯一来源却是 CRM，且只允许账户元数据与 `owner_id`。 | 分别登记项目任务/容量、当前演示需求与依赖对象；CRM 只保留销售侧事实。 |
| `PRJ-017` | `questions/02-product-project.md:36`；`contexts/CTX-01/manifest.md:39`；`04-live-source-contracts.md:323` | supplemental 要当前实现约束与故事跟踪状态，合同只有 tasks，不能核对当前实现。 | 增加 repo/API/schema 对象并保留 tasks；据实际工具数重算 K。 |
| `RES-008` | `questions/04-research-decision.md:22`；`contexts/CTX-02/manifest.md:36`；`04-live-source-contracts.md:370` | supplemental 要完整日志、代码变更和排除根因证据，合同只有 monitoring。 | 增加 git/repo 的代码变更对象；将日志、代码与待排除证据分别绑定到相称 reader。 |
| `SAL-004` | `questions/06-sales-customer-procurement.md:14`；`contexts/CTX-07/manifest.md:38`；`04-live-source-contracts.md:420` | supplemental 要正式安全材料、草案版本和当前 owner，合同只有问卷 forms；`document_id/version/source_link` 字段不能让 forms 自动成为正式材料 reader。 | 增加获批 PDF/repo/知识库对象和版本 authority，forms 只读问卷。 |
| `WRT-006` | `questions/03-writing-content.md:18`；`contexts/CTX-02/manifest.md:38`；`04-live-source-contracts.md:452` | supplemental 明列当前代码、监控和可执行排障分支，合同只有 repo 与 test，没有 monitoring。 | 增加当前 observability/log source，并把预期结果和失败分支绑定到代码、测试、监控各自证据。 |
| `WRT-018` | `questions/03-writing-content.md:85`；`contexts/CTX-09/manifest.md:35`；`04-live-source-contracts.md:454` | supplemental 要当前正式费用政策版本与发布状态，唯一来源是 finance 账务记录。 | 增加官方政策文档、内网页或版本仓库 source；finance 仅支撑金额与账务例子。 |
| `OPS-021` | `questions/05-business-operations.md:73`；`contexts/CTX-09/manifest.md:33`；`04-live-source-contracts.md:281` | supplemental 要本次报销单、发票和审批状态，finance 合同只允许 record、金额、币种、posting 与版本状态，没有报销字段、发票资产或行项目。 | 增加 USER/PDF/OCR 或报销系统的单据与行项目对象，并单独登记审批状态来源。 |

### B-03：纯 LIVE 或 LIVE 主体中的命名对象未闭合

| ID | file:line 证据 | 缺口 | 修复方向 |
|---|---|---|---|
| `ENG-063` | `questions/01-software-it.md:163`；`04-live-source-contracts.md:117` | 要给核心流程补日志、指标和 trace，来源只有 monitoring/BI，没有当前流程代码、配置或 trace instrumentation。 | 增加 repo/config/tracing 与相称测试对象，或把题面收窄为只产出观测设计。 |
| `ENG-095` | `questions/01-software-it.md:110`；`04-live-source-contracts.md:146` | 每周要检查依赖更新和安全通告，只有 repo 与 tasks，缺少新鲜 registry/advisory 来源。 | 增加包注册表、安全公告 API 或带日期官方网页，锁定 freshness；现有 D4/automation 可保留。 |
| `ENG-114` | `questions/01-software-it.md:246`；`04-live-source-contracts.md:164` | 要合并两套身份和工单系统，合同只有 git、tasks、issue tracker，没有任一身份目录或身份数据库。 | 为两套身份系统分别登记 identity/API/database 对象、实体键、owner 与冲突字段。 |
| `ENG-117` | `questions/01-software-it.md:250`；`04-live-source-contracts.md:167` | 题面点名当前区域拓扑和 runbook，合同只有 test、cloud、monitoring，没有 runbook 文档或仓库来源。 | 增加版本化 runbook 的 repo/PDF/database source，并保留 cloud 拓扑、test 和 monitoring。 |
| `RES-058` | `questions/04-research-decision.md:60`；`04-live-source-contracts.md:414` | 要比较邮件和文件，唯一 source 是 email；在 email 上声明 `document_id/version` 不能读取另一个冲突文件。 | 增加 USER+file/PDF/OCR 或获授权文档库对象，分别挂邮件和文件来源。 |
| `OPS-022` | `questions/05-business-operations.md:38`；`04-live-source-contracts.md:282` | 要核对三份 SOP 的 owner、版本和内容冲突，唯一 source 是 tasks，仅登记文档 ID、版本和链接而不读取正文。 | 增加三份具体文档 source 与相称 reader；tasks 只承载 owner/status。 |
| `OPS-040` | `questions/05-business-operations.md:91`；`04-live-source-contracts.md:298` | 题面有政策、样本、审批、系统日志四类对象，合同只登记 monitoring 与一个 generic database，并把同一批金额、版本、证据、文档字段复制给两者；没有逐对象 authority。 | 分别登记政策文档、样本库、审批系统和日志；给每类对象独立 authority、freshness、reader 与最小字段。D4/H4 与持续工具语义本身合理。 |
| `MKT-040` | `questions/07-marketing-growth.md:83`；`04-live-source-contracts.md:257` | 创作者准入、内容授权、绩效、付款、退出五段生命周期被压成一个 finance record，finance 无法提供准入、内容权利、绩效与退出状态。 | 增加创作者 registry、内容授权/审批、analytics 与 workflow sources；finance 只承载付款。 |
| `MKT-044` | `questions/07-marketing-growth.md:104`；`04-live-source-contracts.md:260` | 一年内容、社区、研究和销售反馈只对应 CRM 账户元数据，允许字段中没有反馈正文、聚合指标或内容/研究证据。 | 增加经授权聚合后的 feedback/BI/content/research 对象，或把题面收窄为仅分析 CRM 账户元数据。 |
| `WRT-024` | `questions/03-writing-content.md:44`；`04-live-source-contracts.md:457` | 要读取界面、帮助中心和销售材料，合同只有 CRM；文档 ID 和链接不等于读到了 UI 与帮助内容。 | 分别增加 repo/design、帮助中心和 CRM/销售材料 source。 |
| `WRT-057` | `questions/03-writing-content.md:132`；`04-live-source-contracts.md:471` | 输入点名课程、文章和访谈，合同只有 interview transcript。 | 将课程与文章标 USER 并登记 file/PDF/repo source，访谈保留 transcription。 |
| `WRT-069` | `questions/03-writing-content.md:154`；`04-live-source-contracts.md:479` | 每学期的新文献、教学反馈和勘误只有 git history；git 只能承载教材版本链，不能获得新文献或反馈。 | 增加 browser/PDF、forms/transcript 和 issue tracker，再由 git 保存版本与变更理由。 |
| `SAL-017` | `questions/06-sales-customer-procurement.md:34`；`04-live-source-contracts.md:429` | 要区分客户明说与团队推测，calendar 只有会议元数据却被声明能给 `speaker_id/utterance`；CRM/email 也不能自动替代会议内容。 | 增加获授权的会议转写或纪要 source；calendar 只保留时间和参与人。 |
| `SAL-045` | `questions/06-sales-customer-procurement.md:106`；`04-live-source-contracts.md:450` | 要整理适当性资料与风险披露，唯一 source 是 CRM 账户元数据；版本、批准状态字段不能提供披露正文或权威产品资料。 | 增加当前获批披露文件/官方产品资料和持证 reviewer authority，CRM 只承载客户范围。 |
| `DAT-031` | `questions/08-data-finance.md:38`；`04-live-source-contracts.md:53` | 要整理收入、费用和票据，finance source 只含账务记录、金额、币种和状态，没有票据资产或引用。 | 增加 USER+PDF/OCR/filesystem 的票据对象并与 finance record 对账。 |
| `LIF-026` | `questions/10-personal-life-admin.md:70`；`04-live-source-contracts.md:206` | 要看现金流、住房、照护并判断还缺哪些重要文件，只有 spreadsheet 与 finance；在二者上增加 document ID 不能提供现有文件清单或权威缺件清单。 | 增加 USER/file/PDF 的现有材料清单、住房与照护输入，以及由适当专业来源维护的文件 checklist。D0 首版盘点与 H3 长期跨度本身合理。 |

上述缺口修复后，工具列和 K 必须重新机械派生；不能只在合同 fields 中再补关键词。

### B-04：`FAM-013` 把“请求者确认预览”写成了足以创建共享家庭对象的授权

- ID 与证据：`questions/12-household-family-community.md:24`；`04-live-source-contracts.md:178`；授权规则见 `03-频率与语义校准.md:73`。
- 题面做对了预览、创建对象、可见成员、最小记录范围和争议事项停手，但“我确认后再建”仍只证明请求者确认了预览。目的字段要求“照护安排 owner 确认”，LIVE 合同 authority 却写“法务或当地专业 reviewer”，principal scope 仍只有“FAM-013 请求主体”；两者都没有证明请求者有权替共享日历中的其他照护参与者和孩子授权可见范围。
- 这不是要求每个家庭日程都由法务批准。修复应区分三件事：请求者确认产物内容、已登记照护安排 owner/受影响参与者确认共享与可见范围、争议安排交专业人员。合同应登记相称的 calendar/task owner 或授权记录，创建前核对目标对象、成员、字段最小化和撤销路径。

`FAM-013` 的 `D1 H0 R2 K2 S2 F2/B-LEG` 可以保留；失败点是授权主体与 principal scope 没有闭合。

## 4. 标签、频率与边界复核

### 4.1 数量与 12 域配额

| 领域 | 总数 | H | M | L | 频率逆序人工结论 |
|---|---:|---:|---:|---:|---|
| ENG | 120 | 54 | 42 | 24 | `[ok]` 未发现清晰逆序 |
| PRJ | 70 | 31 | 25 | 14 | `[ok]` 未发现清晰逆序 |
| WRT | 70 | 32 | 24 | 14 | `[ok]` 未发现清晰逆序 |
| RES | 60 | 27 | 21 | 12 | `[ok]` 未发现清晰逆序 |
| OPS | 55 | 25 | 19 | 11 | `[ok]` 未发现清晰逆序 |
| SAL | 45 | 20 | 16 | 9 | `[ok]` 未发现清晰逆序 |
| MKT | 45 | 20 | 16 | 9 | `[ok]` 未发现清晰逆序 |
| DAT | 35 | 16 | 12 | 7 | `[ok]` 未发现清晰逆序 |
| LRN | 30 | 13 | 11 | 6 | `[ok]` 未发现清晰逆序 |
| LIF | 30 | 13 | 11 | 6 | `[ok]` 未发现清晰逆序 |
| CAR | 20 | 9 | 7 | 4 | `[ok]` 未发现清晰逆序 |
| FAM | 20 | 10 | 6 | 4 | `[ok]` 未发现清晰逆序 |
| 合计 | 600 | 270 | 210 | 120 | `[ok]` |

频率判断按“合格目标人群未来 12 个月主动提出”的领域内先验复核，没有把 C、题长或工具数当频率代理。日常 bug、状态、写作、排期、续费和家庭协调整体高于并购、跨国迁移、重大转型、形式化验证与完全托管。H/M/L 仍只是启发式先验，不是市场概率。

### 4.2 C/D/H/R/K/S/F/B

validator 的全量分布为：

```text
C: C1=31 C2=211 C3=255 C4=79 C5=24
D: D0=245 D1=294 D2=28 D3=3 D4=30
H: H0=478 H1=22 H2=27 H3=32 H4=41
R: R1=23 R2=421 R3=110 R4=46
K: K0=36 K1=79 K2=336 K3=136 K4=13
S: S0=134 S1=180 S2=253 S3=33
F: F1=46 F2=483 F3=60 F4=11
B: B0=310 B-AUTH=118 B-PRIV=85 B-FIN=37 B-LEG=24 B-ID=7 B-ATTR=8 B-MED=11
```

人工结论：

- C、D、H、R、S、F、B 没有发现 B 级错标。B-02/B-03 中缺失工具的行修复后需重算 K，当前 K 只对“已声明工具”机械正确。
- 122 条非 H0 均按未来现实跨度判断；没有用历史统计窗口或来源更新时间抬高 H。`DAT-002` 与 `SAL-009` 的“本周”可合理视为正在管理的周窗口，未硬判为 H0。
- 30 条 D4 均有周期性/持续语义，也都有 automation、tasks、calendar、monitoring 或相称状态工具。`OPS-040` 的 D4/H4 正确，其失败仅是四类审计输入没有逐对象闭合。
- R1/R4 的轮次边界与实际澄清/多会话需求相称，没有把长历史输入误作轮次。
- 33 条 S3 都保留了预览、确认或拒绝门，没有发现语音放行式题面。
- 46 条 F1 均落在当前 coding/workspace 基线；外部 connector 或系统级恢复题没有被工具前缀误升为 F1。

### 4.3 11 条 F4 与 D0

11 条为：`ENG-120`、`PRJ-068`、`WRT-065`、`RES-059`、`OPS-053`、`SAL-043`、`MKT-043`、`DAT-035`、`LIF-029`、`CAR-020`、`FAM-020`。

`[ok]` 11 条全部使用 D0 合理。D0 的首个安全可审阅结果是拒绝越权部分、说明边界并给出安全改写方向，不是承诺在 30 分钟内执行原请求。其 H 仍按原题未来跨度保留：持续托管类为 H4，`ENG-120` 的一年路线为 H3，单次违法抓取/投放类 `MKT-043` 为 H0。04 合同也明确这些 D0 安全响应不读取来源，未发现 F4 借 rescope 偷跑执行。

## 5. 输入、工具与 effect 闭合

机器结构结果：

```text
LIVE 行=465
LIVE 对象=986
USER 行=192
无预置输入行=15
CTX manifest=16
fixture 文件=50
required claims=172
F1 capability contracts=46
generic claims=0
generic supplemental=0
```

`[ok]` locator、source kind、reader 名、freshness、as_of、principal scope 的结构门均为零报错；`CTX+LIVE` 的 supplemental 文本也机械对称。

`[fail]` 语义闭合不通过，见 B-01 至 B-03。典型模式是把题面词命中的字段复制进一个相称“名称”的 reader，或让 manifest 继续写着所需对象，却没有为该对象建立 source。字段名存在、locator 格式正确和 reader 名合法都不能证明内容可读。

effect 侧除 B-04 的授权主体缺口外未发现额外 A/B：S2/S3 行的外部写入、发送、付款、发布、部署和真实切换都在题面中保留了确认或停手边界；D4 均有持续工具。

## 6. 全量去重与跨域同构

validator 实际检查 179700 对，阈值 `>=0.55` 的近重复为 0；最高一对为 `CAR-001/CAR-005=0.333333`。人工回读 validator 的前十高相似对，均至少在输入、决策、产出、验收或 effect 中有两项差异。

额外人工检查的跨域主题族包括：

- `RES-012`、`OPS-006`、`LIF-004`：分别是续费决策分析、45 天运营续费窗口与个人下月取消建议，输入、时间窗、产出和 effect 不同。
- `WRT-020`、`OPS-018`、`RES-042`：分别产出自助文章候选、问题去向分类和知识库/产品修复排序，不是换角色复述。
- `ENG-109`、`WRT-042`：前者是 schema 驱动 SDK/文档/契约测试并由 CI 阻断分叉，后者是参考页生成加手写用例，验收与 effect 不同。
- 周报、订阅、就医准备、家庭日历等高复发主题也逐条比较，未找到达到 B 级的跨域同构。

`[ok]` 未发现人工语义重复。

## 7. H/M/L 自然度、长度、开头与合同口吻

| 档位 | n | 平均字符 | p50 | p95 | 最大 | 长度 >=60 |
|---|---:|---:|---:|---:|---:|---:|
| H | 270 | 35.16 | 34 | 50 | 68 | 5 |
| M | 210 | 36.84 | 35 | 51 | 64 | 3 |
| L | 120 | 38.50 | 35 | 55 | 64 | 4 |

- H 的均值与尾部均短于 M/L，符合高频优先短而直接的规则。最长 H `SAL-009` 为 68 字，回读后仍像真实 pipeline review 请求，不是验收 oracle 的机械拼接。
- 最多的两字开头是“这个”22 条，占 3.7%；随后“我们”12 条、“根据”11 条、“客户”10 条，没有固定开头垄断。
- 合同口吻词统计：含“确认”59 条、“证据”63 条、`owner` 32 条；它们主要出现在确实改变授权、可追溯性或跨角色责任的题面。含“先”165 条、“别”79 条，虽体现安全约束风格，但逐条回读未形成同一完整句式模板。
- 问号结尾为 H 84、M 49、L 22；陈述式请求、续接句与反问仍有混合，没有为了提高问句率统一改写。

`[ok]` 未发现达到 B 级的 H/M/L 自然度、长度、开头集中或验收合同腔问题。

## 8. 生产力、生活覆盖与娱乐排除

- 12 域覆盖软件、项目、写作、研究、运营、销售、市场、数据、学习、个人生活、职业与家庭社区。LIF 30 条加 FAM 20 条为 50 条，占 8.3%；包括日历、账单、文件、搬家、医疗行政、住房、照护、家务、学校与社区协作。
- 生活题均有可判定的生产力产物或下一步。高敏感生活题保留 B-MED/B-LEG/B-FIN/B-PRIV/B-AUTH，真正完全托管请求由 `LIF-029`、`FAM-020` 作为 F4 对照。
- 对 `放歌|点歌|陪聊|纯闲聊|追剧|电子游戏|玩游戏|电影推荐|娱乐消费` 的限定扫描无命中，`rg` 紧跟退出码为 1；全量人工回读也未发现游戏、追剧、音乐、明星或陪伴聊天题。

`[ok]` 生产力/生活边界与娱乐排除通过。

## 9. 修复优先级与复审条件

1. 先修 B-01 的字段生成模型和 validator 反例，否则继续补字段会制造更多假闭合。
2. 按 B-02 修正 manifest supplemental 与 LIVE source 的逐对象对称关系。
3. 按 B-03 补齐每个命名对象的真实 reader/source，并重算工具列与 K。
4. 收紧 `FAM-013` 的授权主体、可见范围和 principal scope。
5. 重跑 validator 后，必须由一个新的零上下文会话全量复审；仅看到 `VALIDATOR_RC=0` 不能关闭本报告。

通过条件：A=0 且 B=0。当前 A=0、B>0，因此最终结论保持 `[fail]`。
