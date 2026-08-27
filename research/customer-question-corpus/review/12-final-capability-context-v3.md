# SayDo 600 条潜在客户提问语料终审：能力、工具、风险与上下文 v3

- 评审日期：2026-08-26
- 评审角色：零上下文独立终审
- 范围：600 条问题、16 个 context manifest、172 条 required claim、50 份 source 正文，以及当前能力合同和必要实现
- 结论：`[fail]`
- 结论依据：发现 3 组 A 级问题和 1 组 B 级问题；RAG 事实闭合未发现 A/B 级缺口

## 1. 范围与计数

### 1.1 问题全集

| 项目 | 全量结果 |
|---|---:|
| 问题文件 | 12 |
| 问题记录 | 600 |
| 领域记录数 | 120 / 70 / 70 / 60 / 55 / 45 / 45 / 35 / 30 / 30 / 20 / 20 |
| 频率 H / M / L | 270 / 210 / 120 |
| C1 / C2 / C3 / C4 / C5 | 25 / 250 / 242 / 60 / 23 |
| D0 / D1 / D2 / D3 / D4 | 270 / 278 / 27 / 3 / 22 |
| H0 / H1 / H2 / H3 / H4 | 479 / 23 / 26 / 34 / 38 |
| R1 / R2 / R3 / R4 | 19 / 444 / 91 / 46 |
| K0 / K1 / K2 / K3 / K4 | 33 / 120 / 345 / 98 / 4 |
| S0 / S1 / S2 / S3 | 203 / 185 / 183 / 29 |
| F1 / F2 / F3 / F4 | 46 / 497 / 46 / 11 |
| B0 / B-AUTH / B-PRIV / B-ID | 402 / 114 / 33 / 6 |
| B-LEG / B-MED / B-FIN / B-ATTR | 14 / 13 / 14 / 4 |

上下文基础 token 覆盖为：`CTX` 172 条、`USER` 144 条、`LIVE` 477 条、`-` 14 条；组合模式允许重叠，因此前三项不相加。另对题面含“这些、当前、最新、我的、自动、持续、直接”等依赖词的 119 条记录逐条反查输入模式、工具、F/S/B 和目的，没有用词频结果替代人工判断。

### 1.2 context 全集

| context | required claim | source 正文 | as_of | valid_until | 语义闭合 |
|---|---:|---:|---|---|---|
| CTX-01 | 13 | 2 | 2026-08-20 | fixture-frozen | `[pass]` |
| CTX-02 | 12 | 3 | 2026-08-12T10:37:00+08:00 | immutable_event_window | `[pass]` |
| CTX-03 | 22 | 3 | 2026-08-24 | 2026-10-15 | `[pass]` |
| CTX-04 | 6 | 3 | 2026-08-24 | fixture-frozen | `[pass]` |
| CTX-05 | 10 | 4 | 2026-08-20 | 2026-09-20 | `[pass]` |
| CTX-06 | 15 | 3 | 2026-08-23 | 2026-09-23 | `[pass]` |
| CTX-07 | 16 | 3 | 2026-08-22 | 2026-10-31 | `[pass]` |
| CTX-08 | 15 | 3 | 2026-08-24 | 2026-09-21 | `[pass]` |
| CTX-09 | 8 | 3 | 2026-08-24 | 2026-09-30 | `[pass]` |
| CTX-10 | 9 | 3 | 2026-08-24 | 2026-11-21 | `[pass]` |
| CTX-11 | 9 | 3 | 2026-08-24 | 2026-11-24 | `[pass]` |
| CTX-12 | 4 | 3 | 2026-08-24 | 2026-09-30，报价更早失效 | `[pass]` |
| CTX-13 | 6 | 4 | 2026-08-24 | 2026-09-18 | `[pass]` |
| CTX-14 | 3 | 4 | 2026-08-26 | 2026-10-18 | `[pass]` |
| CTX-15 | 11 | 3 | 2026-08-24T00:00:00Z | 2026-09-24 | `[pass]` |
| CTX-16 | 13 | 3 | 2026-08-24 | 2026-09-30 | `[pass]` |
| 合计 | 172 | 50 | - | - | `[pass]` |

50 份 source 正文合计 484 行、24,767 字节。逐题核验不是只看 digest：每一行 required claim 都与列出的具体 source 正文逐项比对，同时检查题目所需但 fixture 没有的事实是否由 `USER` 或 `LIVE` 明示补齐。digest 仅用于确认字节和清单完整性。

## 2. 评审方法

1. 完整阅读适用的全局和仓库 `AGENTS.md`，再读取允许范围内的 canonical、实施计划能力段落、必要代码、语料说明、600 条问题、16 个 manifest、50 份 source 正文与验证器。
2. 把 12 张问题表解析为 600 条记录，逐条核对题面、目的、C/D/H/R/K/S、工具、输入、F 与 B；机械计数只用于防漏。
3. 以当前产品合同作能力基线：缺省启用类型仍是 coding；writing 是需开值的窄版；research、marketing、general、planning 的正式执行器、原生 connector、可靠跨天 workflow 和多人会议仍属路线图。
4. 对 29 条 S3 逐条反查真实 effect、授权路径和所需工具；再从 571 条 S0-S2 反向搜索发送、发布、支付、预订、通知、分派、同步、写回、建索引、合并知识和设置 live 配置等动作。
5. 对 16 个 context 包逐包先读 manifest，再读全部 source；按 required claim 行检查语义蕴含、来源权威、冲突处理、`as_of`、`valid_until`、题目输入模式和 supplemental input。
6. 单独检查专业判断、第三方授权和身份/隐私边界，确认辅助整理没有被误标成自主诊断、法律结论、投资决策或替用户承诺。

## 3. A 级发现

### A-01：7 条 F2/S3 题把“有工具、登录态和批准”误写成当前可直接执行，但当前 S3 签发路径只实现 register 和 merge

影响 ID：`ENG-074`、`WRT-046`、`OPS-015`、`OPS-029`、`OPS-051`、`SAL-002`、`FAM-004`。

这些题目的最高 effect 分别是实际切流/回滚、跨渠道发布、预订购买、外发 RFP、自动通知与分派、发送跟进邮件、支付学校费用。它们的 `S3` 和多数 `B-AUTH` 本身是对的，问题在 `F2` 的执行含义：题面只保留“用户确认/审批”，并没有把最终 effect 明确交给人执行，因此会被读成 SayDo 在确认后直接做 effect。

当前合同不支持这种结论：

- `docs/09-data-contracts.md:273-295` 的 `EffectGrant` 白名单只有 `install_dependency` 与 `push_branch`；不在白名单即整包拒签。
- `docs/09-data-contracts.md:367-372` 虽保留 `publish/deploy/delete_data/external_send` 词表，但明确当前签发入口只有 `register|merge`，其余值没有签发路径。
- 实现与合同一致：`packages/contracts/src/types/package.ts:10-12` 的 effect enum 仍只有上述两项。
- `research/customer-question-corpus/00-能力边界.md:25` 对“发邮件或操作 SaaS”所写的 F2 条件，不能覆盖上述 S3 签发缺口；工具和登录态不等于已有可消费的 S3 授权路径。

逐项题面证据：

- `ENG-074`：`research/customer-question-corpus/questions/01-software-it.md:212`，要求审批后实际切流与回滚。
- `WRT-046`：`research/customer-question-corpus/questions/03-writing-content.md:64`，要求逐渠道确认后按排期发布。
- `OPS-015`：`research/customer-question-corpus/questions/05-business-operations.md:69`，要求确认后预订。
- `OPS-029`：`research/customer-question-corpus/questions/05-business-operations.md:81`，要求运行 RFP，其中包含发题。
- `OPS-051`：`research/customer-question-corpus/questions/05-business-operations.md:118`，要求自动通知和分派。
- `SAL-002`：`research/customer-question-corpus/questions/06-sales-customer-procurement.md:10`，要求确认后发送邮件。
- `FAM-004`：`research/customer-question-corpus/questions/12-household-family-community.md:14`，要求确认后支付。

为什么是 A：这是现时能力断言与 fail-closed 授权合同冲突。语料若把这些题作为 F2 可执行正例，会训练或评测出“确认后可直接做尚无签发路径的 S3 effect”的错误行为。

可接受的语义只有两类：一是保持 F2，但题面和目的明确最终发送、发布、支付、预订、切流由人完成，SayDo 只准备、监控和留证；二是保留“SayDo 直接执行”的需求，但按未接线能力处理，不能称为当前条件可做。

### A-02：3 条实际 effect 的必需工具族不闭合

影响 ID：`WRT-046`、`OPS-051`、`FAM-004`。

- `WRT-046` 的工具只有 `email,calendar,crm,automation`，但题面还要求博客等跨渠道发布；没有 `browser`、`messaging` 或明确的发布 connector。来源：`research/customer-question-corpus/questions/03-writing-content.md:64`。
- `OPS-051` 的工具只有 `automation,notification`，但题面还要求把现场事项“分派”；没有 `tasks` 或其他可持久化 assignment 的工具。来源：`research/customer-question-corpus/questions/05-business-operations.md:118`。
- `FAM-004` 的工具只有 `spreadsheet,email,calendar,rag`，但题面包含实际支付；没有 `finance`、`browser` 或支付工具。来源：`research/customer-question-corpus/questions/12-household-family-community.md:14`。

为什么是 A：`required_tool_families` 定义为“完成当前问题确需”的工具，而不是只覆盖前半段准备工作，见 `research/customer-question-corpus/01-设计与分布.md:20-22`。这三条会让“工具齐全”的判定在外部 effect 处产生假阳性。

### A-03：WRT-066 的“同步事故更新”可能包含外部发布/通知，却标成 S2/B0，且工具不含出站通道

来源：`research/customer-question-corpus/questions/03-writing-content.md:148`。

题面是“事故更新要在四种语言、三个时区同步”，目的又是危机沟通的单一事实源。按自然语义，“同步”至少可能包含把更新送达不同语言和时区的受众；这时最高 effect 是 `send_external`，应落 S3 并保留授权边界。当前只列 `automation,monitoring`，没有 `email`、`messaging` 或 `notification`。

如果作者只想表达“在内部准备四种语言版本并排好时区，不发送”，则当前 S2 可以成立，但题面和目的没有把这个限制写成可判定合同。按“题面预计的最高效果”定 S 的规则，见 `research/customer-question-corpus/01-设计与分布.md:70-72`，不能用较安全解释覆盖外部危机沟通这一自然读法。

为什么是 A：事故沟通属于外部影响动作。当前标注可能把应走 S3 的 effect 降到可由弱授权处理的 S2，同时漏掉出站工具与 B-AUTH。

## 4. B 级发现

### B-01：5 条题目没有明确“只产草稿”，但 S0/S1 与实际持久写入语义不一致

影响 ID：`PRJ-014`、`WRT-047`、`WRT-063`、`OPS-040`、`MKT-033`。

| ID | 来源 | 当前 | 题面中的持久 effect | 问题 |
|---|---|---|---|---|
| PRJ-014 | `research/customer-question-corpus/questions/02-product-project.md:79` | S0 | 做成版本化决策日志 | S0 是读；版本化日志至少需要 S1，若写 live monitoring/project system 则是 S2 |
| WRT-047 | `research/customer-question-corpus/questions/03-writing-content.md:111` | S0 | 合并公司知识库内容并保留 supersede 链 | 若实际修改 live 知识库则是出圈可逆写入 S2；若只做草稿，题面需明说 |
| WRT-063 | `research/customer-question-corpus/questions/03-writing-content.md:123` | S0 | OCR、校对、建索引和来源描述 | `filesystem,database` 加 `LIVE` 指向持久索引，不是纯读 |
| OPS-040 | `research/customer-question-corpus/questions/05-business-operations.md:93` | S0 | 在 database/monitoring 材料上建立证据索引 | 若建 live 索引则是 S2；若只输出索引草稿，缺少范围限定 |
| MKT-033 | `research/customer-question-corpus/questions/07-marketing-growth.md:44` | S1 | 在邮件、应用内和推送渠道设置频率上限 | live 渠道配置是 worktree 外可逆写入，应按 S2；若只给建议值，题面需明说 |

现行风险单源是“读 / worktree 内写 / 出圈可逆 / 不可逆”，见 `docs/06-references.md:96`，代码映射同样把 read 与 write_worktree 分成 S0/S1，见 `packages/daemon/src/policy/engine.ts:39-49`。

为什么是 B：这些题不像 A-03 那样明确指向外部不可逆动作，但产物落点不清使风险档无法唯一判定。现标注至少不能同时覆盖“只给草稿”和“直接更新 live 系统”两种执行语义。

## 5. C 级发现

`[pass]` 未发现需要单列的 C 级能力、工具、风险或 RAG 事实问题。已知 fixture/benchmark 限制放在第 8 节，不把既有设计边界重复记为缺陷。

## 6. RAG 事实闭合结论

`[pass]` 172 条 required claim 均由各自行列出的具体 source 正文支持，或明确把缺失的个体/现势事实交给同题登记的 `USER`/`LIVE`。没有发现以下反例：

- 用 digest 代替语义蕴含；
- required claim 指向未登记或不存在的 source；
- manifest 说支持，但 source 没有该事实且 supplemental input 为空；
- 题目需要新鲜价格、法规、产品状态或 SaaS 状态，却只用冻结 fixture；
- 冲突 source 未给 claim scope 或权威顺序；
- 截至 2026-08-26 已过 `valid_until` 仍无 `LIVE` 复核。

具体时效边界也逐项核对。例：CTX-12 的 manifest 明示报价按各自有效期更早失效，见 `research/customer-question-corpus/contexts/CTX-12/manifest.md:3-11`；三份报价的最早有效期是 2026-08-28，见 `research/customer-question-corpus/contexts/CTX-12/vendor-quotes.md:3-9`，而所有 CTX-12 题均带 `LIVE`。CTX-14 对 roster 与最新场地反馈给了明确权威顺序，见 `research/customer-question-corpus/contexts/CTX-14/manifest.md:3-11`，required claim 也把当前报名和排班交给 `LIVE`，见同文件 `:28-32`。

## 7. 命令证据

### 7.1 结构与登记合同验证

执行主体：

```text
node research/customer-question-corpus/validate.mjs
```

退出码：`0`

关键原始输出：

```text
[ok] 600 条语料结构、登记合同完整性与已知语义反例门通过
VALIDATE_EXIT=0
```

其中最后一行由紧跟验证命令取码的 shell wrapper 追加，不是验证器自行打印。

该命令只证明结构、摘要、登记合同和内置反例门；验证器自己也声明不能证明 claim 文本与来源语义相符，见 `research/customer-question-corpus/README.md:46-54`。本报告的 RAG 结论来自另行全量正文核对。

### 7.2 独立全量计数

对 12 个问题文件和 16 个 context 目录做只读解析，关键原始输出：

```text
records=600
F={"F1":46,"F2":497,"F3":46,"F4":11}
S={"S0":203,"S1":185,"S2":183,"S3":29}
B={"B-ATTR":4,"B-AUTH":114,"B-FIN":14,"B-ID":6,"B-LEG":14,"B-MED":13,"B-PRIV":33,"B0":402}
ctx_refs=172
manifests=16 required_claim_rows=172 source_files=50 source_lines=484 source_bytes=24767
```

### 7.3 限定范围 emoji 门

扫描范围只含本次允许读取的语料说明、12 个 question 文件、16 个 context 包、`validate.mjs` 与本报告；明确排除既往 review、`rebuild.mjs` 和其他禁止范围。

关键原始输出：

```text
[ok] emoji gate: clean
EMOJI_EXIT=0
```

## 8. 剩余限制

1. 本轮是语料合同终审，不调用真实外部 connector，不验证第三方账号、权限、支付、发布或通知平台的现场可用性。
2. 语料本身不是完整多轮 benchmark；没有 transcript、授权状态和验收 oracle，因此不能仅凭本轮证明每条任务在真实执行中会正确澄清和停门。
3. context 时效结论只成立于 2026-08-26；日期后回放仍需按 manifest 和 source 内更早到期日重新判断。
4. 对 A-01 的结论以当前 canonical 和实现白名单为准；以后若为某类 S3 effect 新增判别合同、签发、消费和反例门，应重新评审对应 F 档，而不能只改词表。
5. 本轮没有修改语料、canonical 或实现，也没有 commit。

## 9. 最终判定

`[fail]`

600 条结构和 172 条 RAG claim 的事实闭合通过，但 A-01 至 A-03 会让当前能力、必需工具或 S3 授权边界产生假阳性；B-01 使若干持久写入题无法由题面唯一判定风险。在这些问题回修并重新全量验证前，不应把本语料称为能力/工具/风险终审通过。
