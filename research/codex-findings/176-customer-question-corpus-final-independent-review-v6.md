# SayDo 600 条潜在客户提问语料最终独立对抗评审 v6

## 最终裁决

`[fail]`

结构门禁为绿，但语义审查发现：

- A 类 2 组，涉及 `LRN-015`、`SAL-013`、`DAT-020`、`RES-038`
- B 类 1 组，涉及 `LRN-003`、`LRN-006`

其中包括 RAG 假闭合和敏感数据风险失真。按“存在任一 A/B 即失败”的规则，不能通过最终验收。

## 方法与隔离

隔离门保持有效：

- 未读取或搜索任何禁止目录、Git 状态、历史评审、日志或其他代理输出。
- 未运行 `rebuild.mjs`，未修改或写入任何正式文件。
- 逐条审阅了 12 个问题文件的 600 条记录、16 个 manifest、50 个 source 正文及 172 条 required claim。
- 定向读取了指定 canonical 文档，以及 `packages/contracts`、`packages/daemon`、`pipeline` 中与能力和风险相关的代码。
- 独立遍历全部 179,700 对问题，并人工复核 validator top-10 和高相似跨领域同构。
- 一次只读统计 heredoc 因只读环境不能创建临时文件而未执行；随后改用无临时文件的 `node -e` 重跑成功，没有产生文件。

## 全量计数

领域配额全部精确：

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

标签分布：

| 维度 | 计数 |
|---|---|
| C | C1 30；C2 231；C3 245；C4 70；C5 24 |
| D | D0 251；D1 279；D2 29；D3 3；D4 38 |
| 现实周期 H | H0 482；H1 23；H2 25；H3 30；H4 40 |
| R | R1 23；R2 428；R3 103；R4 46 |
| K | K0 35；K1 99；K2 346；K3 109；K4 11 |
| S | S0 175；S1 182；S2 210；S3 33 |
| F | F1 49；F2 480；F3 60；F4 11 |
| B | B0 361；B-AUTH 119；B-PRIV 51；B-FIN 25；B-LEG 20；B-MED 12；B-ID 7；B-ATTR 5 |

上下文：

- `LIVE` 481 条，`USER` 153 条，无上下文 15 条；模式可重叠。
- CTX 引用共 172 次：CTX-01 至 CTX-16 依次为 `13,12,22,6,10,15,16,15,8,9,9,4,6,3,11,13`。
- 50 个 source、172 条 required claim，数量和引用对称性通过。

## 分级发现

### A-01：LRN-015 把“上线数据抽检”变成了“员工上岗抽检”

题目要求根据现行 SOP 制作微课、练习、评分和“上岗检查”：[09-learning-development.md:47](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:47)。

对应 manifest 宣称来源支持“上岗抽检要求”，且 supplemental input 为 `-`：[CTX-06/manifest.md:29](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-06/manifest.md:29)。

但来源实际只说：

- 上线前由另一位顾问做“数据抽检”：[service-sop.md:7](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-06/service-sop.md:7)
- 上线抽检发现客户编码格式错误：[ticket-sample.md:5](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-06/ticket-sample.md:5)

来源不存在员工上岗、胜任资格或人员抽检制度。“上线”被替换成“上岗”后形成了新的组织政策事实，可能让系统编造岗位资格要求，属于实质性 RAG 假闭合，判 A。

### A-02：三条企业敏感数据读取被错误标为 S0/B0

语料自身规定“企业敏感数据不得保留 S0”：[03-频率与语义校准.md:69](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:69)、[03-频率与语义校准.md:72](~/WorkSpace/SayDo/research/customer-question-corpus/03-频率与语义校准.md:72)。Canonical 也把 S0 限定为不触及敏感数据的读取：[04-key-mechanisms.md:134](~/WorkSpace/SayDo/docs/04-key-mechanisms.md:134)。实际策略代码会把客户或凭据数据提升到至少 S2：[engine.ts:63](~/WorkSpace/SayDo/packages/daemon/src/policy/engine.ts:63)。

下列记录没有匿名化、聚合化或最小披露前提，却仍标为 `S0/F2/B0`：

- `SAL-013`：读取实时 CRM、BI 中的客户团队使用情况、需求证据和受益方：[06-sales-customer-procurement.md:32](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:32)。同文件相近的客户使用分析 `SAL-011` 已正确标为 `S2/B-PRIV`：[06-sales-customer-procurement.md:28](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:28)。
- `DAT-020`：通过实时 CRM 分析客户从获取到续约的生命周期分叉：[08-data-finance.md:32](~/WorkSpace/SayDo/research/customer-question-corpus/questions/08-data-finance.md:32)。
- `RES-038`：索引目标公司的产品、客户、技术和风险尽调资料室：[04-research-decision.md:95](~/WorkSpace/SayDo/research/customer-question-corpus/questions/04-research-decision.md:95)。

三条至少不能保持 S0；`B0` 也应按敏感资料和最小披露边界重新判定。S0 在系统语义中可自动放行，而敏感读取至少应进入 S2，因此属于风险失真，判 A。

### B-01：两条 required claim 把题面条件伪装成来源事实

- `LRN-003` 题面自行提出“十分钟口头复盘”：[09-learning-development.md:12](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:12)，manifest 却把“十分钟口头复盘偏好”登记成 fixture claim：[CTX-10/manifest.md:31](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-10/manifest.md:31)。来源只说通勤有 25 分钟、可口头复盘，并偏好案例和错题回放：[time-constraints.md:3](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-10/time-constraints.md:3)、[time-constraints.md:7](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-10/time-constraints.md:7)，没有“十分钟偏好”。
- `LRN-006` 题面提供“下周客户会”：[09-learning-development.md:18](~/WorkSpace/SayDo/research/customer-question-corpus/questions/09-learning-development.md:18)，manifest 却将其写入来源 claim，并声明无需 supplemental input：[CTX-07/manifest.md:29](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-07/manifest.md:29)。来源只有九月技术评估、十月试点决策及客户业务事实：[account-brief.md:9](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-07/account-brief.md:9)、[discovery-call.md:3](~/WorkSpace/SayDo/research/customer-question-corpus/contexts/CTX-07/discovery-call.md:3)，没有“下周客户会”。

这两条不会像 `LRN-015` 那样直接制造错误组织政策，因为约束已由用户首句提供；但 required claim 的来源归因不真实，属于明确的逐题 claim 缺陷，判 B。

## RAG 与 validator 结论

172 条 claim 中，本轮识别出 3 条语义问题；其余 169 条未发现新的 A/B 级来源闭合问题。16 个 manifest 的 authority、source 集合、supplemental 对称性及截至 2026-08-26 的 `as_of/valid_until` 结构检查通过。

Validator 的诚实边界写得清楚：README 明确承认它不能证明 claim 与来源的语义相符：[README.md:54](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:54)。实际实现检查的是：

- claim 字符串唯一性和 digest：[validate.mjs:998](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:998)
- 与 fixed baseline 相等：[validate.mjs:1000](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1000)、[validate.mjs:1025](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1025)
- 少量 generic 正则：[validate.mjs:1011](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:1011)

因此 `genericRequiredClaims=0` 只说明没有命中现有正则；digest 和 fixed baseline 只能证明文本没漂移，不能证明上述 3 条语义真实。

## 频率、周期与交互轮次

`H/M/L` 在 README 中被正确表述为专家启发式而非市场统计：[README.md:7](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:7)。

我单独复核了全部 13 条处于高频且带 `D4` 或长期周期的记录，包括 `ENG-095/096`、`PRJ-044/045/052`、`OPS-033/034/044`、`SAL-032`、`DAT-014`、`LRN-009`、`LIF-006`、`FAM-015`。它们主要是依赖巡检、异步摘要、到期提醒、pipeline 卫生和周期报告，属于目标角色反复遇到的痛点；没有发现仅因“自动化”标签而机械升入 H 的显著概率逆序。

38 条 D4 均登记了与周期相称的 `automation`、`monitoring`、`notification`、`calendar`、`tasks` 或状态工具；validator 对此有独立门禁：[validate.mjs:757](~/WorkSpace/SayDo/research/customer-question-corpus/validate.mjs:757)。全量人工检查未发现新的 D/H/R A/B 级错标。

这只能支持“内部启发式自洽”，不能证明真实市场概率。

## 能力、工具与效果边界

除 A-02 的敏感读取外，没有发现新的能力误导：

- 33 条 S3 全部落在 F3/F4，且没有 B0。
- 11 条 F4 都是越权自主或高风险边界场景。
- 49 条 F1 集中在当前 coding、状态和受治理执行主线。
- 发送、发布、部署、付款、生产数据变更等没有因为存在 connector、登录态或用户首句而被升级为当前可直接执行能力。

代码也支持该结论：P0 `EffectGrant` 只包含安装依赖和推分支：[package.ts:10](~/WorkSpace/SayDo/packages/contracts/src/types/package.ts:10)；虽然 S3 动作词表预留发布、部署、删除和外发，但注释明确当前签发入口仅有 register/merge：[webauthn.ts:34](~/WorkSpace/SayDo/packages/contracts/src/types/webauthn.ts:34)，实际输入 schema 也只接受这两类：[s3Tools.ts:104](~/WorkSpace/SayDo/packages/daemon/src/tier1/s3Tools.ts:104)。

## 去重结论

独立遍历结果：

- `600 × 599 / 2 = 179,700` 对全部计算。
- Dice `>=0.55`：0 对。
- 独立排序与 validator top-10 完全一致。

| 排名 | Pair | Dice | 人工语义裁决 |
|---:|---|---:|---|
| 1 | CAR-001 / CAR-005 | 0.333333 | 简历缺口诊断与求职信写作，非重复 |
| 2 | SAL-002 / SAL-012 | 0.324324 | 确认后发送与优先级变化后的草稿修订，效果边界不同 |
| 3 | ENG-109 / WRT-042 | 0.294118 | 多资产 schema 同源门禁与 API 参考页生成，范围不同 |
| 4 | ENG-045 / LRN-016 | 0.260870 | reviewer 路由与训练营设计，只有 code review 词面相似 |
| 5 | PRJ-020 / WRT-019 | 0.254545 | 内部事故板与客户外部状态稿，受众及 effect 不同 |
| 6 | ENG-014 / WRT-006 | 0.245614 | 配置项说明与完整排障指南，产物不同 |
| 7 | WRT-055 / RES-014 | 0.244898 | 政策差异写作与政策业务影响研究，决策目的不同 |
| 8 | SAL-027 / MKT-020 | 0.241379 | 续约行动组合与发布日排期，生命周期不同 |
| 9 | ENG-054 / DAT-016 | 0.237288 | 代码任务续接与预算分析续接，仅生命周期结构相似 |
| 10 | SAL-022 / SAL-027 | 0.233333 | RFP 协作与续约组合管理，非同一任务 |

另外人工检查了跨领域的计划续接、政策、事故、提醒、场景模拟等同构簇；存在可解释的生命周期模板复用，但没有达到 B 级语义重复。

## 自然度与覆盖

按“末尾为问号”统计：

| 先验 | 问句数/总数 | 比率 | 平均长度 | 中位数 | P90 | 最大 |
|---|---:|---:|---:|---:|---:|---:|
| H | 83/270 | 30.74% | 34.57 | 33 | 42 | 71 |
| M | 49/210 | 23.33% | 36.31 | 35 | 43 | 64 |
| L | 23/120 | 19.17% | 36.90 | 35 | 47 | 64 |

整体有 155/600 条以问号结束，69 条以“把”开头；三字符开头最高频仅“用一年”4 次，没有固定开场模板集中。最长的是 `SAL-009` 的 71 字：[06-sales-customer-procurement.md:24](~/WorkSpace/SayDo/research/customer-question-corpus/questions/06-sales-customer-procurement.md:24)，虽然密集，但仍符合销售运营角色表达。

定向内部术语筛查主要命中 `ENG-048` 的 `fixture`：[01-software-it.md:151](~/WorkSpace/SayDo/research/customer-question-corpus/questions/01-software-it.md:151)，以及 `OPS-040` 的 `live 证据索引`：[05-business-operations.md:91](~/WorkSpace/SayDo/research/customer-question-corpus/questions/05-business-operations.md:91)；二者均为对应专业角色可自然使用的术语。未发现把 C/D/H/R/K/S/F/B、CTX 或 manifest 合同直接塞入客户原话的情况。

生活管理由 LIF 30 条和 FAM 20 条直接覆盖，职业及副业另有 CAR 20 条；全量未发现娱乐、放歌、游戏或纯陪聊场景。医疗、法律、财务、身份、隐私、归因和授权均有专门边界标签，但 A-02 说明敏感经营及客户数据仍存在漏标。

## rebuild 与回滚边界

静态检查显示：

- 每题必须有显式 claim 规格：[rebuild.mjs:2026](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2026)
- 先生成 staged questions/contexts 并运行 validator：[rebuild.mjs:2125](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2125)
- 通过后才按四次 rename 晋升：[rebuild.mjs:2097](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2097)
- 可捕获失败有逆序回滚和备份保留处理：[rebuild.mjs:2106](~/WorkSpace/SayDo/research/customer-question-corpus/rebuild.mjs:2106)

README 如实限定它不是断电或强杀下的文件系统事务：[README.md:54](~/WorkSpace/SayDo/research/customer-question-corpus/README.md:54)。本轮依要求没有运行 rebuild 或故障注入，所以可捕获失败回滚的动态行为、断电中间态和实际文件系统持久性均为未验证。

## 命令证据

实际执行：

```text
node research/customer-question-corpus/validate.mjs; corpus_validation_rc=$?; echo "VALIDATE_EXIT=$corpus_validation_rc"; exit "$corpus_validation_rc"
```

关键原始输出摘录：

```text
"records": 600
"fixtureSources": 50
"requiredClaims": 172
"genericRequiredClaims": 0
"genericSupplementalInputs": 0
"nearDuplicatePairsAt055": 0

[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
VALIDATE_EXIT=0
```

独立只读统计输出：

```text
rows: 600
pairs: 179700
at055: 0
```

## 已验证与未验证边界

已验证：

- 数量、配额、全部标签计数和上下文/source/claim 数量
- 600 条题面及 C/D/H/R/K/S/F/B 语义复核
- 172 条 required claim 对 50 个 source 的逐条对照
- 179,700 对字符近似及人工跨领域同构检查
- 当前文档与代码中的能力、S3、敏感数据和 connector 边界
- validator 当前真实退出码与输出

未验证：

- H/M/L 的真实市场概率
- 真实用户口语研究和执行 benchmark
- 外部 connector、登录态、现势 SaaS 数据及真实 S2/S3 消费
- rebuild 的动态故障注入、断电或进程强杀恢复
- 自动执行 600 个场景后的多轮质量与最终验收 oracle

最终裁决仍为：`[fail]`。